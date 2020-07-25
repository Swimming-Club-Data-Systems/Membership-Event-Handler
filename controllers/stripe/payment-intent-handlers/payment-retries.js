/**
 * Delete 21 day old contact tracing information automatically
 */

const mysql = require('../../../common/mysql');
const moment = require('moment-timezone');
const stripeHelpers = require('../helpers');
const organisation = require('../../organisation');
const { TooManyRequests } = require('http-errors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.retryPayments = async function () {
  // Retry Stripe DD payments
  var date = moment.tz('Europe/London');
  date.tz('UTC')
  date = date.format('Y-MM-DD');

  var [results, fields] = await mysql.query("SELECT paymentRetries.PMKey, payments.stripeMandate, users.Tenant FROM paymentRetries INNER JOIN payments ON paymentRetries.PMKey = payments.stripePaymentIntent INNER JOIN users ON users.UserID = payments.UserID WHERE Day <= ? AND NOT Tried", [
    date
  ]);

  for (let i = 0; i < results.length; i++) {

    // Assign result value to var
    var retryDetails = results[i];

    // Get org
    var org = await organisation.fromId(retryDetails['Tenant']);

    try {
      var intent = await stripe.paymentIntents.confirm(
        retryDetails['PMKey'],
        {
          payment_method: retryDetails['stripeMandate'],
        },
        {
          stripeAccount: org.getStripeAccount()
        }
      );

      if (intent.status === 'pending' || intent.status === 'succeeded') {
        [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ?, `stripeFailureCode` = NULL WHERE `stripePaymentIntent` = ?", [
          intent.status,
          intent.id,
        ]);
      } else {

      }
    } catch (err) {
      // Could not retry
    }

    // Mark retry attempt as done
    [results, fields] = await mysql.query("UPDATE `paymentRetries` SET `Tried` = ?, `stripeFailureCode` = NULL WHERE `PMKey` = ?", [
      true,
      retryDetails['PMKey'],
    ]);
  }
}

/**
 * Express Handler
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.webEndpoint = async function (req, res, next) {
  // Call moveMembers
  try {
    retryPayments();
    res.json({
      status: 200
    });
  } catch (err) {
    res.json({
      status: 500,
    });
  }
}