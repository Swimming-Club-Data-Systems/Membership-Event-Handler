/**
 * Routes which allow the web based membership system to invoke a cron-job
 */

const express = require('express');
const router = express.Router();
const contactTracing = require('../controllers/covid/contact-tracing');

/**
 * Handle events
 */
router.post('/send-change-message', contactTracing.signOutChangeEvent);

module.exports = router;