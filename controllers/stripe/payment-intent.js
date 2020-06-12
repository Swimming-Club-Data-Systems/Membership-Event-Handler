/**
 * Stripe payment intent webhook code
 */

const mysql = require('../../common/mysql');
const galas = require('./payment-intent-handlers/gala');
const moment = require('moment-timezone');

exports.handleCompletedPaymentIntent = async function (org, stripe, payment) {
  var results, fields;

  // Check if there are gala entries for this payment intent
  [results, fields] = await mysql.query("SELECT ID FROM stripePayments WHERE Intent = ?", [
    payment.id
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
    galas.paymentIntentHandler(org, stripe, payment);
  } else {
    // Run code for any other type of payment
    // Such types do not exist yet but this is passive provision
  }
}

exports.handleNewPaymentIntent = async function (org, stripe, payment) {
  var results, fields;
  var intentCreatedAt = moment.utc(payment.created);

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