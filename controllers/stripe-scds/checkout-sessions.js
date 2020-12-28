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
      // Add the new PM to the DB
      var [results, fields] = await mysql.query("INSERT INTO `tenantPaymentMethods` (`ID`, `MethodID`, `Customer`, `BillingDetails`, `Type`, `TypeData`, `Fingerprint`, `Usable`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        uuidv4(),
        intent.payment_method.id,
        intent.customer,
        JSON.stringify(intent.payment_method.billing_details),
        intent.payment_method.type,
        JSON.stringify(intent.payment_method[intent.payment_method.type]),
        intent.payment_method[intent.payment_method.type].fingerprint,
        true
      ]);

      // Add the mandate info to the DB
      var [results, fields] = await mysql.query("INSERT INTO `tenantPaymentMandates` (`ID`, `MandateID`, `AcceptanceData`, `PaymentMethod`, `MethodDetails`, `Status`, `UsageType`, `UsageData`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
        uuidv4(),
        intent.mandate.id,
        JSON.stringify(intent.mandate.customer_acceptance),
        intent.payment_method.id,
        JSON.stringify(intent.mandate.payment_method_details),
        intent.mandate.status,
        intent.mandate.type,
        JSON.stringify(intent.mandate[intent.mandate.type])
      ]);
    }
  }
}