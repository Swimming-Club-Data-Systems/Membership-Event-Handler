/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleUpdated = async function (org, stripe, mandate) {
  // Handle mandate update
  await mysql.query("UPDATE stripeMandates SET Status = ? WHERE ID = ?", [
    mandate.status,
    mandate.payment_method,
  ]);
}