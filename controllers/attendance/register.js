/**
 * Delete 21 day old contact tracing information automatically
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const socketModule = require('../../socket.io/socket-io');

/**
 * Handles and triggers register state change event
 * @param req http request
 * @param res http response
 */
exports.handleStateChange = function (req, res) {
  let json = JSON.parse(req.body);
  console.log(json.room);
  try {
    req.app.io.sockets.to(json.room).emit('register-tick-event', {
      event: 'register-item-state-change',
      field: json.field,
      state: json.state,
    });
  } catch (err) {
    console.error(err);
  }
  res.end();
}