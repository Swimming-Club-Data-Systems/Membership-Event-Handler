/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const Organisation = require('../organisation');

exports.handleUpdated = async function (stripe, mandate) {
  // Handle mandate update

  var [results, fields] = await mysql.query("SELECT `ID` FROM `tenantPaymentMethods` WHERE `MethodID` = ?", [
    mandate.payment_method.id,
  ]);

  if (results.length > 0) {

    let mandateId = results[0]['ID'];

    var [results, fields] = await mysql.query("UPDATE `tenantPaymentMethods` SET `BillingDetails` = ?, `Type` = ? `TypeData` = ? WHERE `MethodID` = ?", [
      JSON.stringify(mandate.payment_method.billing_details),
      mandate.payment_method.type,
      JSON.stringify(mandate.payment_method[intent.payment_method.type]),
      mandate.payment_method.id,
    ]);

    var [results, fields] = await mysql.query("UPDATE `tenantPaymentMandates` SET `AcceptanceData` = ?, `MethodDetails` = ? `Status` = ?, `UsageType` = ?, `UsageData` = ? WHERE `PaymentMethod` = ?", [
      JSON.stringify(mandate.customer_acceptance),
      JSON.stringify(mandate.payment_method_details),
      mandate.status,
      mandate.payment_method.id,
    ]);

    let org = await Organisation.fromId(tenant);

    if (mandate.status !== 'active' && org.getKey('DEFAULT_PAYMENT_MANDATE') === mandateId) {
      // Delete the old one
      await org.setKey('DEFAULT_PAYMENT_MANDATE', null);
    } else if (mandate.status === 'active' && org.getKey('DEFAULT_PAYMENT_MANDATE') == null) {
      // Set new one
      await org.setKey('DEFAULT_PAYMENT_MANDATE', mandateId);
    }

  }
}