/**
 * Delete 21 day old contact tracing information automatically
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.deleteOld = async function () {
  // Get pending squad moves
  var date = moment.tz('Europe/London');
  date.subtract(21, 'days');
  date.hour(0);
  date.minute(0);
  date.second(0);
  date.tz('UTC')
  date = date.format('Y-MM-DD HH:mm:ss');
  var [results, fields] = await mysql.query("DELETE FROM covidVisitors WHERE `Time` < ?", [
    date
  ]);
}

/**
 * Express Handler
 * 
 * @param {*} req 
 * @param {*} res 
 * @param {*} next 
 */
exports.webEndpoint = async function (req, res, next) {
  // Call moveMembers
  try {
    deleteOld();
    res.json({
      status: 200
    });
  } catch (err) {
    res.json({
      status: 500,
    });
  }
}