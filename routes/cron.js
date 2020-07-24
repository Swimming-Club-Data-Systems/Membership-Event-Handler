/**
 * Routes which allow the web based membership system to invoke a cron-job
 */

var express = require('express');
var router = express.Router();
var squadMoves = require('../controllers/squads/moves');
var contactTracing = require('../controllers/covid/contact-tracing');

/**
 * GoCardless webhook handler
 */
router.post('/move-squads', squadMoves.webEndpoint);
router.post('/delete-covid-records', contactTracing.webEndpoint);

module.exports = router;