var express = require('express');
var router = express.Router();
var mysql = require('../common/mysql');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.json({
    about: 'SCDS Membership Webhook Event Service'
  });
});

module.exports = router;
