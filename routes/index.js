var express = require('express');
var router = express.Router();
var mysql = require('../common/mysql');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.json({
    about: 'SCDS Membership Webhook Event Service'
  });
});

router.get('/test', function(req, res, next) {
  var pool = mysql.getPool();
  let [results, fields] = mysql.query('SELECT Forename, Surname FROM users ORDER BY Forename ASC, Surname ASC');
  res.json(results);
});

module.exports = router;