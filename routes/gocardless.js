var express = require('express');
var router = express.Router();
var handler = require('../controllers/gocardless/handler');

/**
 * GoCardless webhook handler
 */
router.post('/', handler.webhookHandler);

module.exports = router;
