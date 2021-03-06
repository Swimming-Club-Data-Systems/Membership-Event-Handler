/**
 * Payment method code
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleDetach = async function (org, stripe, pm) {
  if (pm.type == 'card') {
    await mysql.query("UPDATE stripePayMethods SET Reusable = ? WHERE MethodID = ?", [
      0,
      pm.id
    ]);
  } else if (pm.type == 'bacs_debit') {

  }
}

exports.handleUpdate = async function (org, stripe, pm) {
  if (pm.type == 'card') {
    await mysql.query("UPDATE stripePayMethods SET City = ?, Country = ?, Line1 = ?, Line2 = ?, PostCode = ?, ExpMonth = ?, ExpYear = ?, Last4 = ? WHERE MethodID = ?", [
      pm.billing_details.address.city,
      pm.billing_details.address.country,
      pm.billing_details.address.line1,
      pm.billing_details.address.line2,
      pm.billing_details.address.postal_code,
      pm.card.exp_month,
      pm.card.exp_year,
      pm.card.last4,
      pm.card.three_d_secure_usage.supported,
      pm.id,
    ]);
  } else if (pm.type == 'bacs_debit') {
    // Update bank details
    await mysql.query("UPDATE stripeMandates SET Last4 = ?, SortCode = ? WHERE ID = ?", [
      pm.bacs_debit.last4,
      pm.bacs_debit.sort_code,
      pm.id,
    ]);
  }
}