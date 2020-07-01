/**
 * Payment method code
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleCompleted = async function (org, stripe, cs) {
  if (cs.mode == 'setup' && cs.setup_intent) {
    const intent = await stripe.setupIntents.retrieve(cs.setup_intent, {
      expand: ['payment_method', 'payment_method.billing_details.address', 'mandate'],
    }, {
      stripeAccount: org.getStripeAccount()
    });

    if (intent.payment_method && intent.payment_method.type == 'bacs_debit') {
      // Add the new PM to the DB
      var [results, fields] = await mysql.query("INSERT INTO stripeMandates (ID, Customer, Mandate, Fingerprint, Last4, SortCode, Address, Status, MandateStatus, Reference, URL) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        intent.payment_method.id,
        intent.customer,
        intent.mandate.id,
        intent.payment_method.bacs_debit.fingerprint,
        intent.payment_method.bacs_debit.last4,
        intent.payment_method.bacs_debit.sort_code,
        JSON.stringify(intent.payment_method.billing_details.address),
        intent.mandate.payment_method_details.bacs_debit.network_status,
        intent.mandate.status,
        intent.mandate.payment_method_details.bacs_debit.reference,
        intent.mandate.payment_method_details.bacs_debit.url
      ]);
    }
  }
}