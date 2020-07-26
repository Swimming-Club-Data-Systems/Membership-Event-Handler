/**
 * Handle stripe payout events
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handlePayout = async function (org, stripe, payout) {
  var results, fields;
  [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripePayouts WHERE ID = ?", [payout.id]);

  var amount = payout.amount;
  if ((payout.status === 'canceled' || payout.status === 'failed') || payout.failure_code) {
    amount = 0;
  }
  var date = moment.unix(payout.arrival_date);

  if (results[0]['COUNT(*)'] > 0) {
    // Update payout item
    await mysql.query("UPDATE stripePayouts SET `Amount` = ?, `ArrivalDate` = ? WHERE `ID` = ?", [
      amount,
      date.format("Y-MM-DD"),
      payout.id,
    ]);
  } else {
    // Add a payout item
    await mysql.query("INSERT INTO stripePayouts (ID, Amount, ArrivalDate, Tenant) VALUES (?, ?, ?, ?)", [
      payout.id,
      amount,
      date.format("Y-MM-DD"),
      org.id,
    ])
  }
}