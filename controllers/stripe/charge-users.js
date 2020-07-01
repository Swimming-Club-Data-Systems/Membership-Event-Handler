/**
 * Charge users
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const organisation = require('../organisation');

exports.chargeUsers = async function () {
  // Work out first day of month
  var day = moment.tz('Europe/London').format('Y-MM') + '-01';

  // Get payments
  var [results, fields] = await mysql.query("SELECT payments.UserID, Amount, Currency, `Name`, PaymentID, users.Tenant, stripeCustomers.CustomerID FROM (((payments INNER JOIN users ON users.UserID = payments.UserID) LEFT JOIN paymentSchedule ON payments.UserID = paymentSchedule.UserID) INNER JOIN stripeCustomers ON stripeCustomers.User = users.UserID) WHERE (Status = 'not_charged' AND `Day` <= ? AND Type = 'Payment') OR (Status = 'not_charged' AND `Day` IS NULL AND `Type` = 'Payment') LIMIT 4", [
    day
  ]);

  var updatePaymentsQuery = 'UPDATE `payments` SET `Status` = ?, `stripeMandate` = ?, `stripePaymentIntent` = ? WHERE `PaymentID` = ?';
  var updatePaymentsPendingQuery = 'UPDATE `paymentsPending` SET `Status` = ? WHERE Payment = ?';

  results.forEach(userToCharge => {
    // Get the payment method desired by this user

    var pm = null;
    var idempotencyKey = 'PaymentID-' + userToCharge.PaymentID;
    var org = await organisation.fromId(userToCharge.Tenant);
    var stripeAccount = org.getStripeAccount();

    try {

      if (!stripeAccount) {
        // Tenant has no Stripe account - cannot proceed
        throw 'No Stripe account';
      }

      // Make API call to Stripe
      const intent = await stripe.paymentIntents.create({
        payment_method_types: ['bacs_debit'],
        payment_method: pm,
        customer: userToCharge.CustomerID,
        confirm: true,
        amount: userToCharge.Amount,
        currency: 'gbp',
      }, {
        stripeAccount: org.getStripeAccount()
      });

      var id = intent.id;

      await mysql.query(
        updatePaymentsQuery,
        [
          intent.status,
          intent.payment_method,
          intent.id,
          userToCharge.PaymentID
        ]
      );

      await mysql.query(
        updatePaymentsPendingQuery,
        [
          'Requested',
          userToCharge.PaymentID
        ]
      );

    } catch (err) {

    }


  });
}