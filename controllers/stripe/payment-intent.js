/**
 * Stripe payment intent webhook code
 */

const axios = require('axios').default;
const mysql = require('../../common/mysql');
const galas = require('./payment-intent-handlers/gala');
const renewals = require('./payment-intent-handlers/renewal');
const moment = require('moment-timezone');
const BigNumber = require('bignumber.js');
const escape = require('escape-html');
const Email = require('../email/email');

exports.handleCompletedPaymentIntent = async function (org, stripe, payment) {
  var results, fields;

  var intent = await stripe.paymentIntents.retrieve(
    payment.id, {
    expand: ['customer', 'payment_method', 'charges.data.balance_transaction'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Decide if Direct Debit
  if (intent?.metadata?.payment_category === 'monthly_fee') {

    // Set fees if possible
    let fee = 0;
    if (intent.charges.data[0].balance_transaction) {
      // Handle stripe balance transaction for fees
      let fee = intent.charges.data[0].balance_transaction.fee;
    }

    // Handle direct debit payment
    [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ?, `stripeFee` = ? WHERE `stripePaymentIntent` = ?", [
      intent.status,
      fee,
      intent.id,
    ]);

    // Update legacy `paymentsPending` table - For old hangovers
    [results, fields] = await mysql.query("UPDATE `paymentsPending` INNER JOIN payments ON payments.PaymentID = paymentsPending.Payment SET paymentsPending.Status = ? WHERE `stripePaymentIntent` = ?", [
      'Paid',
      intent.id,
    ]);
  } else if (intent?.metadata?.payment_category === 'gala_entry') {
    galas.paymentIntentHandler(org, stripe, intent);
  } else if (intent?.metadata?.payment_category === 'renewal') {
    renewals.paymentIntentHandler(org, stripe, intent);
  } else if (intent?.metadata?.payment_category === 'checkout_v1') {
    // Hand off to PHP app
    console.log(org.getUrl('webhooks/checkout_v1'));

    axios.post(
      org.getUrl('v1/webhooks/checkout_v1'),
      {
        org: org.getId(),
        payment: payment.id,
      }
    ).then(function (response) {
      // handle success
      console.log('sent - success')
    })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  } else if (intent?.metadata?.payment_category === 'checkout_v2') {
    // Hand off to PHP app
    console.log(org.getUrl('webhooks/checkout_v2'));

    axios.post(
      org.getUrl('v1/webhooks/checkout_v2'),
      {
        org: org.getId(),
        payment: payment.id,
      }
    ).then(function (response) {
      // handle success
      console.log('sent - success')
    })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  }
}

exports.handleProcessingPaymentIntent = async function (org, stripe, payment) {
  // Currently do nothing
}

exports.handleCanceledPaymentIntent = async function (org, stripe, payment) {

  payment = await stripe.paymentIntents.retrieve(
    payment.id, {
    expand: ['customer', 'payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  if (payment.payment_method.type === 'bacs_debit') {
    // Handle direct debit payment
    [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ? WHERE `stripePaymentIntent` = ?", [
      payment.status,
      payment.id,
    ]);
  } else {
    // Run code for any other type of payment
    // Such types do not exist yet but this is passive provision
  }
}

exports.handleFailedPaymentIntent = async function (org, stripe, payment) {
  payment = await stripe.paymentIntents.retrieve(
    payment.id, {
    expand: ['customer', 'payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  if (payment.charges.data[0].payment_method_details.type === 'bacs_debit') {

    // Handle direct debit payment status update
    [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ? WHERE `stripePaymentIntent` = ?", [
      payment.status,
      payment.id,
    ]);

    // Work out UserID
    [results, fields] = await mysql.query("SELECT payments.UserID, users.EmailAddress, users.Forename, users.Surname, stripeMandates.SortCode, stripeMandates.Last4, stripeMandates.Reference, payments.Name, payments.Amount FROM payments INNER JOIN users ON users.UserID = payments.UserID INNER JOIN stripeMandates ON payments.stripeMandate = stripeMandates.ID WHERE stripePaymentIntent = ? AND users.Tenant = ?", [
      payment.id,
      org.getId(),
    ]);

    if (results.length > 0) {
      var details = results[0];
      var retrying = false;

      // Work out resubmission date
      var date = moment.tz('Europe/London');
      date.add(7, 'days');
      date.tz('UTC')
      var dbDate = date.format('Y-MM-DD');

      // Get information about the charge failure
      if (payment.charges.data[0].failure_code) {
        var failureCode = payment.charges.data[0].failure_code;

        // Set failure code
        [results, fields] = await mysql.query("UPDATE `payments` SET `stripeFailureCode` = ? WHERE `stripePaymentIntent` = ?", [
          failureCode,
          payment.id,
        ]);

        if (failureCode === 'generic_could_not_process' || failureCode === 'insufficient_funds') {
          // Prepare for retry at later date

          // Count existing retries
          // Add to db
          [results, fields] = await mysql.query("SELECT COUNT(*) FROM `paymentRetries` WHERE `UserID` = ? AND `PMKey` = ?;", [
            details['UserID'],
            payment.id,
          ]);

          // Max retries = 3
          if (results[0]['COUNT(*)'] < 3) {
            try {
              // Add to db
              [results, fields] = await mysql.query("INSERT INTO paymentRetries (`UserID`, `Day`, `PMKey`, `Tried`) VALUES (?, ?, ?, ?)", [
                details['UserID'],
                dbDate,
                payment.id,
                false,
              ]);

              retrying = true;
            } catch (err) {
              // Do nothing - just means retrying stays false
            }
          }
        }
      }

      // Send user an email
      var name = details['Forename'] + ' ' + details['Surname'];
      var email = details['EmailAddress'];
      var message = '<p>Hello ' + escape(name) + ',</p>';
      message += '<p>Your &pound;' + escape((new BigNumber(details['Amount'])).shiftedBy(-2).decimalPlaces(2).toFormat(2)) + ' Direct Debit payment for ' + escape(details['Name']) + ' has failed.</p>';
      message += '<p>We tried to take this payment from the following bank account:</p>';
      message += '<ul><li><strong>Sort Code:</strong> ' + escape(details['SortCode'].substr(0, 2) + '-' + details['SortCode'].substr(2, 2) + '-' + details['SortCode'].substr(4, 2)) + '</li><li><strong>Account Number:</strong> &middot;&middot;&middot;&middot;' + escape(details['Last4']) + '</li></ul>';

      // If retrying, include details
      if (retrying) {
        message += '<p>We plan to retry this payment automatically in around ten working days. The payment will come from the bank account identified above with the reference ' + escape(details['Reference']) + '.</p>';
        message += '<p>Please ensure you have enough money (&pound;' + escape((new BigNumber(details['Amount'])).shiftedBy(-2).decimalPlaces(2).toFormat(2)) + ') in your bank account before ' + escape(date.format('dddd Do MMMM Y')) + ' - Your bank may charge you penalty fees for direct debits which fail due to a lack of funds.</p>';
      } else {
        message += '<p>We cannot automatically retry this payment. Please get in touch with your treasurer.</p>';
      }

      message += '<p>Thank you,<br>The ' + escape(org.getName()) + ' team</p>'

      let mail = new Email(name, email, org, 'Your Direct Debit has failed', message);
      await mail.send();

    }
  } else {
    // Run code for any other type of payment
    // Such types do not exist yet but this is passive provision
  }
}

exports.handleNewPaymentIntent = async function (org, stripe, payment) {
  var results, fields;
  var intentCreatedAt = moment.utc(payment.created);

  payment = await stripe.paymentIntents.retrieve(
    payment.id, {
    expand: ['customer', 'payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Decide if Direct Debit
  if (false && payment.payment_method.type && payment.payment_method.type === 'bacs_debit') {

  } else {

    // Check if intent already exists
    [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripePayments WHERE Intent = ?", [
      payment.id
    ]);

    if (results[0]['COUNT(*)'] == 0) {
      // Get the customer
      // Payments with no customer will be ignored
      [results, fields] = await mysql.query("SELECT `User` FROM stripeCustomers WHERE CustomerID = ?", [
        payment.customer.id
      ]);

      if (results.length > 0) {
        var user = results[0]['User'];

        var refunded = 0;
        if (payment?.charges?.data && payment?.charges?.data[0]?.refunds?.data) {
          let refunds = payment.charges.data[0].refunds.data;
          refunds.forEach(refund => {
            refunded += parseInt(refund.amount);
          });
        }

        // Add this payment intent to the database and assign the id to each entry
        [results, fields] = await mysql.query("INSERT INTO stripePayments (`User`, `DateTime`, Method, Intent, Amount, Currency, Paid, AmountRefunded) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
          user,
          intentCreatedAt.format("Y-MM-DD"),
          null,
          payment.id,
          payment.amount,
          payment.currency,
          0,
          refunded
        ]);
      }

    }
  }
}