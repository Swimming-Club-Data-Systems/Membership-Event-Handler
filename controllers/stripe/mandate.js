/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleUpdated = async function (org, stripe, mandate) {
  // Handle mandate update
  if (mandate.payment_method_details.bacs_debit) {
    await mysql.query("UPDATE stripeMandates SET Status = ?, MandateStatus = ? WHERE ID = ?", [
      mandate.payment_method_details.bacs_debit.network_status,
      mandate.status,
      mandate.payment_method,
    ]);
  }
}