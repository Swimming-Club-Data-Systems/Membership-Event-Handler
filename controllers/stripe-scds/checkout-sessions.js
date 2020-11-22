/**
 * Payment method code
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');

exports.handleCompleted = async function (stripe, cs) {
  if (cs.mode == 'setup' && cs.setup_intent) {
    const intent = await stripe.setupIntents.retrieve(cs.setup_intent, {
      expand: ['payment_method', 'payment_method.billing_details.address', 'mandate'],
    });

    if (intent.payment_method && intent.payment_method.type == 'bacs_debit') {
      let status = intent.mandate.status === 'active';
      let json = {
        fingerprint: intent.payment_method.bacs_debit.fingerprint,
        last4: intent.payment_method.bacs_debit.last4,
        sort_code: intent.payment_method.bacs_debit.sort_code,
        address: intent.payment_method.billing_details.address,
        network_status: intent.mandate.payment_method_details.bacs_debit.network_status,
        status: intent.mandate.status,
        reference: intent.mandate.payment_method_details.bacs_debit.reference,
        url: intent.mandate.payment_method_details.bacs_debit.url,
      }

      // Add the new PM to the DB
      var [results, fields] = await mysql.query("INSERT INTO `tenantPaymentMethods` (`ID`, `Customer`, `MethodID`, `MandateID`, `Fingerprint`, `Type`, `JSON`, `Usable`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        uuidv4(),
        intent.customer,
        intent.payment_method.id,
        intent.mandate.id,
        intent.payment_method.bacs_debit.fingerprint,
        'bacs_debit',
        JSON.stringify(json),
        status
      ]);
    }
  }
}