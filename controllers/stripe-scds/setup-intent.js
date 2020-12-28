/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const Organisation = require('../organisation');
const { v4: uuidv4 } = require('uuid');

exports.handleCanceled = async function (stripe, intent) {
  // Handle setup intent

}

exports.handleCreated = async function (stripe, intent) {
  // Handle setup intent

}

exports.handleRequiresAction = async function (stripe, intent) {
  // Handle setup intent

}

exports.handleSetupFailed = async function (stripe, intent) {
  // Handle setup intent

}

exports.handleSucceeded = async function (stripe, intentObject) {
  // Handle setup intent
  const intent = await stripe.setupIntents.retrieve(intentObject.id, {
    expand: ['payment_method', 'payment_method.billing_details.address', 'mandate'],
  });

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

  if (intent.mandate) {
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