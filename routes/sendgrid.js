/**
 * Routes for handling SendGrid inbound emails
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

/**
 * Handle events
 */
router.post('/', upload.any(), function (req, res, next) {
  // console.log(req.body);
  try {
    console.log('FROM:    ' + req.body.from);
    console.log('TO:      ' + req.body.to);
    console.log('SUBJECT: ' + req.body.subject);
    console.log('SPAMSCR: ' + req.body.spam_score);
    console.log('HTML:    ' + req.body.html.length);
    console.log('TEXT:    ' + req.body.text.length);
    console.log('SEND_IP: ' + req.body.sender_ip);
    console.log('CHARSET: ' + JSON.parse(req.body.charsets));
    console.log('SPF:     ' + req.body.SPF);
    // console.log(JSON.parse(JSON.stringify(req.body)));
    res.status(200);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500);
    res.end();
  }
});

module.exports = router;