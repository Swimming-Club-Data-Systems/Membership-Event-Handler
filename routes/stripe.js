var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({
    about: 'SCDS Membership Stripe Webhook Handler'
  });
});

module.exports = router;
