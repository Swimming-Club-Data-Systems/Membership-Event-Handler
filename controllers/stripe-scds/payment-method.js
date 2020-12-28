/**
 * Payment method code
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleDetach = async function (stripe, pm) {
  await mysql.query("UPDATE `tenantPaymentMethods` SET `Usable` = ? WHERE `MethodID` = ?", [
    false,
    pm.id,
  ]);
}

exports.handleUpdate = async function (stripe, pm) {
  await mysql.query("UPDATE `tenantPaymentMethods` SET `BillingDetails` = ?, `Type` = ?, `TypeData` = ?, `Fingerprint` = ? WHERE `MethodID` = ?", [
    JSON.stringify(pm.billing_details),
    pm.type,
    JSON.stringify(pm[pm.type]),
    pm[pm.type].fingerprint,
    pm.id,
  ]);
}