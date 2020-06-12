var express = require('express');
var router = express.Router();
var handler = require('../controllers/stripe/handler');

router.post('/', handler.webhookHandler);

module.exports = router;
