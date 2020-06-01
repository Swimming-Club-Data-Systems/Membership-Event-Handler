/**
 * Membership Task Scheduling Application
 */

const cron = require('node-cron');
const axios = require('axios').default;
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

console.log('Loading system urls from ' + process.env.SITES_CONFIG_FILE + '.');
const sites = JSON.parse(fs.readFileSync(process.env.SITES_CONFIG_FILE)).sites;
let numSites = sites.length;

if (numSites === 0) {
  console.warn('No sites have been loaded from ' + process.env.SITES_CONFIG_FILE + '. The system will quit.');
  console.log('Quitting');
  process.exit(1);
}

const timezone = process.env.TIMEZONE || 'Europe/London';

console.log(sites.length + ' sites loaded.');
console.log('Ready to go.');

/**
 * Handle sending notify emails each minute
 */
let notifyHandler = cron.schedule('* * * * *', () => {
  // console.log('Checking for and sending notify emails every minute');
  sites.forEach(site => {
    axios.get(site + 'webhooks/notifysend')
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
let chargeUsers = cron.schedule('* * * * *', () => {
  // console.log('Handle pending GoCardless charges every minute');
  sites.forEach(site => {
    axios.get(site + 'webhooks/chargeusers')
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
let updateRegisterWeeks = cron.schedule('1 0 * * 0', () => {
  // console.log('Update register weeks');
  sites.forEach(site => {
    axios.get(site + 'webhooks/updateregisterweeks')
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
let retryDirectDebit = cron.schedule('*/30 * * * *', () => {
  // console.log('Retrying failed payments');
  sites.forEach(site => {
    axios.get(site + 'webhooks/retrypayments')
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
let handleSquadMoves = cron.schedule('1 * * * *', () => {
  // console.log('Handle squad moves');
  sites.forEach(site => {
    axios.get(site + 'webhooks/updatesquadmembers')
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
 * Sum payments on the first day of every month
 */
let sumPayments = cron.schedule('0 3 1 * *', () => {
  // console.log('Handle summing payments at 3 am on first day of month');
  sites.forEach(site => {
    axios.get(site + 'webhooks/sumpayments')
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