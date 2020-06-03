/**
 * Handle GC payout events
 */

const orgMethods = require('./organisation');
const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.createOrUpdate = async function (org, client, payoutId, update = false) {
  try {
    var results, fields;
    var payout = await client.payouts.find(payoutId);
    // Check if payout exists

    [results, fields] = await mysql.query("SELECT COUNT(*) FROM paymentsPayouts WHERE ID = ?", payout.id);
    var count = results[0]['COUNT(*)'];

    if (count == 0) {
      try {
        await mysql.query("INSERT INTO paymentsPayouts (ID, Amount, Fees, Currency, ArrivalDate, Tenant) VALUES (?, ?, ?, ?, ?, ?)", [
          payout.id,
          payout.amount,
          payout.deducted_fees,
          payout.currency,
          payout.arrival_date,
          org.tenant
        ]);
      } catch (err) {

      }
    } else if (count == 1 && update) {
      await mysql.query("UPDATE paymentsPayouts SET Amount = ?, Fees = ?, Currency = ?, ArrivalDate = ? WHERE ID = ?", [
        payout.amount,
        payout.deducted_fees,
        payout.currency,
        payout.arrival_date,
        payout.id
      ]);
    }
  } catch (err) {
    console.warn(err);
  }

}

exports.handleEvent = async function (event) {
  try {
    let org = await orgMethods.getOrganisation(event.links.organisation);
    let client = await orgMethods.getClient(org.accessToken);
    this.createOrUpdate(org, client, event.links.payout, true);
  } catch (err) {
    console.warn(err);
  }
}