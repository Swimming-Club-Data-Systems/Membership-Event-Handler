/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const Organisation = require('../organisation');

exports.handleUpdated = async function (stripe, mandate) {
  // Handle mandate update
  if (mandate.payment_method_details.bacs_debit) {

    var [results, fields] = await mysql.query("SELECT `tenantPaymentMethods`.`ID`, `JSON`, `Tenant` FROM `tenantPaymentMethods` INNER JOIN `tenantStripeCustomers` ON `tenantPaymentMethods`.`Customer` = `tenantStripeCustomers`.`CustomerID` WHERE `MethodID` = ?", [
      mandate.payment_method,
    ]);

    if (results.length > 0) {
      let json = JSON.parse(results[0]['JSON']);
      let tenant = results[0]['Tenant'];
      let mandateId = results[0]['ID'];
      json.network_status = mandate.payment_method_details.bacs_debit.network_status;
      json.status = mandate.status;
      let status = mandate.status === 'active';

      let org = await Organisation.fromId(tenant);

      if (!status && org.getKey('DEFAULT_PAYMENT_MANDATE') === mandateId) {
        // Delete the old one
        await org.setKey('DEFAULT_PAYMENT_MANDATE', null);
      } else if (status && org.getKey('DEFAULT_PAYMENT_MANDATE') == null) {
        // Set new one
        await org.setKey('DEFAULT_PAYMENT_MANDATE', mandateId);
      }

      await mysql.query("UPDATE `tenantPaymentMethods` SET `Usable` = ?, `JSON` = ? WHERE `MethodID` = ?", [
        status,
        JSON.stringify(json),
        mandate.payment_method,
      ]);
    }
  }
}