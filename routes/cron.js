/**
 * Routes which allow the web based membership system to invoke a cron-job
 */

var express = require('express');
var router = express.Router();
var squadMoves = require('../controllers/squads/moves');

/**
 * GoCardless webhook handler
 */
router.post('/move-squads', squadMoves.webEndpoint);

module.exports = router;