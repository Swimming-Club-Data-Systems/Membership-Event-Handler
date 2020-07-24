/**
 * Stripe payment intent webhook code
 */

const mysql = require('../../common/mysql');
const galas = require('./payment-intent-handlers/gala');
const moment = require('moment-timezone');

exports.handleCompletedPaymentIntent = async function (org, stripe, payment) {
  var results, fields;

  var intent = await stripe.paymentIntents.retrieve(
    payment.id, {
    expand: ['customer', 'payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );
  // console.log(payment);

  // Decide if Direct Debit
  if (intent.payment_method.type === 'bacs_debit') {
    // Handle direct debit payment
    [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ? WHERE `stripePaymentIntent` = ?", [
      intent.status,
      intent.id,
    ]);

    // console.log(payment);
    // console.log([
    //   intent.status,
    //   intent.id,
    // ]);

    // Update legacy `paymentsPending` table - For old hangovers
    [results, fields] = await mysql.query("UPDATE `paymentsPending` INNER JOIN payments ON payments.PaymentID = paymentsPending.Payment SET paymentsPending.Status = ? WHERE `stripePaymentIntent` = ?", [
      'Paid',
      intent.id,
    ]);
  } else {

    // Check if there are gala entries for this payment intent
    [results, fields] = await mysql.query("SELECT ID FROM stripePayments WHERE Intent = ?", [
      intent.id
    ]);

    if (results.length == 0) {
      return;
    }

    var databaseId = results[0].ID;

    // Get gala count
    // Check if there are gala entries for this payment intent
    [results, fields] = await mysql.query("SELECT COUNT(*) FROM galaEntries WHERE StripePayment = ?", [
      databaseId
    ]);

    if (results[0]['COUNT(*)'] > 0) {
      // This payment was for galas so run the code for a successful gala payment
      galas.paymentIntentHandler(org, stripe, intent);
    } else {
      // Run code for any other type of payment
      // Such types do not exist yet but this is passive provision
    }
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

  if (payment.payment_method.type === 'bacs_debit') {

    // Get information about the charge failure
    if (payment.charges.data[0].failure_code) {
      var failureCode = payment.charges.data[0].failure_code;

      if (failureCode === 'generic_could_not_process' || failureCode === 'insufficient_funds') {
        // Can retry payment at some point by re-confirming
      }

      // Store failure code on row
      // [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ? WHERE `stripePaymentIntent` = ?", [
      //   payment.status,
      //   payment.id,
      // ]);
    }

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
  if (intent.payment_method.type === 'bacs_debit') {

  } else {

    // Check if intent already exists
    [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripePayments WHERE Intent = ?", [
      payment.id
    ]);

    if (results[0]['COUNT(*)'] == 0) {
      // Get the customer
      // Payments with no customer will be ignored
      [results, fields] = await mysql.query("SELECT `User` FROM stripeCustomers WHERE CustomerID = ?", [
        payment.customer
      ]);

      if (results.length > 0) {
        var user = results[0]['User'];

        var refunded = 0;
        if (payment.charges.data[0].refunds.data) {
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