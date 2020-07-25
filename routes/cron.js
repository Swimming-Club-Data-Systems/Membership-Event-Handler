/**
 * Routes which allow the web based membership system to invoke a cron-job
 */

const express = require('express');
const router = express.Router();
const squadMoves = require('../controllers/squads/moves');
const contactTracing = require('../controllers/covid/contact-tracing');
const directDebitRetries = require('../controllers/stripe/payment-intent-handlers/payment-retries');

/**
 * GoCardless webhook handler
 */
router.post('/move-squads', squadMoves.webEndpoint);
router.post('/delete-covid-records', contactTracing.webEndpoint);
router.post('/retry-direct-debit-payments', directDebitRetries.webEndpoint);

module.exports = router;