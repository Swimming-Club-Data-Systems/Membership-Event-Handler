/**
 * SCDS - Modern Cron
 * 
 * Our modern cron works without sending webhooks
 */

const cron = require('node-cron');
const axios = require('axios').default;
const dotenv = require('dotenv');
const fs = require('fs');
const mysql = require('../common/mysql');
const squadMoves = require('../controllers/squads/moves');

const timezone = process.env.TIMEZONE || 'Europe/London';

async function getSites() {
  var [results, fields] = await mysql.query("SELECT ID, Code FROM tenants");
  var sites = [];
  results.forEach(tenant => {
    var web = tenant.ID + '/';
    if (tenant.Code != null) {
      web = tenant.Code.toLowerCase() + '/';
    }
    sites.push({
      id: tenant.ID,
      code: tenant.Code,
      url: process.env.PUBLIC_URL + web,
    });
  });

  return sites;
}

/**
 * Handle sending notify emails each minute
 */
let notifyHandler = cron.schedule('* * * * *', async () => {
  // console.log('Checking for and sending notify emails every minute');
  const sites = await getSites();

  sites.forEach(site => {
    axios.get(site.url + 'webhooks/notifysend')
      .then(function (response) {
        // handle success
      })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  });
},
  { timezone: timezone }
);

/**
 * Handles charging users via GoCardless every minute
 */
let chargeUsers = cron.schedule('* * * * *', async () => {
  // console.log('Handle pending GoCardless charges every minute');
  const sites = await getSites();

  sites.forEach(site => {
    axios.get(site.url + 'webhooks/chargeusers')
      .then(function (response) {
        // handle success
      })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  });
},
  { timezone: timezone }
);

/**
 * Update register weeks at the start of each attendance week
 */
let updateRegisterWeeks = cron.schedule('1 0 * * 0', async () => {
  // console.log('Update register weeks');
  const sites = await getSites();

  sites.forEach(site => {
    axios.get(site.url + 'webhooks/updateregisterweeks')
      .then(function (response) {
        // handle success
      })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  });
},
  { timezone: timezone }
);

/**
 * Retry failed direct debit payments
 */
let retryDirectDebit = cron.schedule('*/30 * * * *', async () => {
  // console.log('Retrying failed payments');
  const sites = await getSites();

  sites.forEach(site => {
    axios.get(site.url + 'webhooks/retrypayments')
      .then(function (response) {
        // handle success
      })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  });
},
  { timezone: timezone }
);

/**
 * Handle squad moves
 */
let handleSquadMoves = cron.schedule('1 * * * *', async () => {
  // console.log('Handle squad moves');
  squadMoves.moveMembers();
},
  { timezone: timezone }
);

/**
 * Sum payments on the first day of every month
 */
let sumPayments = cron.schedule('0 3 1 * *', async () => {
  // console.log('Handle summing payments at 3 am on first day of month');
  const sites = await getSites();

  sites.forEach(site => {
    axios.get(site.url + 'webhooks/sumpayments')
      .then(function (response) {
        // handle success
      })
      .catch(function (error) {
        // handle error
        console.warn(error);
      })
  });
},
  { timezone: timezone }
);