/**
 * Routes which allow the web based membership system to invoke a cron-job
 */

const express = require('express');
const router = express.Router();
const register = require('../controllers/attendance/register');

/**
 * Handle events
 */
router.post('/send-register-change-message', register.handleStateChange);

module.exports = router;