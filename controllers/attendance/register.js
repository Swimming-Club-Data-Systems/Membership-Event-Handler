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
  // console.log(json.room);
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

/**
 * Handles and triggers register state change event
 * @param req http request
 * @param res http response
 */
exports.handleBookingUpdate = function (req, res) {
  let json = JSON.parse(req.body);
  // console.log(json.room);
  try {
    req.app.io.sockets.to(json.room).emit('booking-page-book-cancel-event', {
      event: 'booking-page-book-cancel',
      update: json.update,
    });
  } catch (err) {
    console.error(err);
  }
  res.end();
}

exports.getWeekId = async function (tenant, dateString = undefined) {

  var date = moment.tz(dateString, 'Europe/London');

  if (date.format('E') != '7') {
    date = date.startOf('week');
  }

  // Get the week id
  var [results, fields] = await mysql.query("SELECT `WeekID` FROM `sessionsWeek` WHERE `WeekDateBeginning` = ? AND `Tenant` = ?", [
    date.format('Y-MM-DD'),
    tenant,
  ]);

  if (results.length == 0) {
    throw Error('No WeekID');
  }

  let weekId = results[0]['WeekID'];

  if (weekId) {
    return weekId;
  }

  throw Error('Undefined WeekID');

}

exports.handlePreBookedRegisterGeneration = async function () {

  // Get sessions for which we need to generate a register
  var date = moment.tz('Europe/London').add(15, 'minutes');
  var dateString = date.format('Y-MM-DD');
  var timeString = date.format('HH:mm');
  var [results, fields] = await mysql.query("SELECT `sessionsBookable`.`Session`, `sessionsBookable`.`Date`, `sessions`.`Tenant` FROM `sessionsBookable` INNER JOIN `sessions` ON `sessionsBookable`.`Session` = `sessions`.`SessionID` WHERE `sessionsBookable`.`Date` = ? AND `sessions`.`StartTime` <= ? AND NOT `RegisterGenerated`", [
    dateString,
    timeString,
  ]);

  // Begin a transaction in case anything breaks

  // From results loop through, gethting bookings and adding to a new register session entry
  for (let i = 0; i < results.length; i++) {
    const bookableSession = results[i];

    var pool = mysql.getPool();
    var conn = await pool.getConnection();
    await conn.beginTransaction();

    try {

      // Get member bookings - only where member is currently active
      // This means we don't add recently deleted members to the register
      var [bookings, fields] = await mysql.query("SELECT `sessionsBookings`.`Member` FROM `sessionsBookings` INNER JOIN `members` ON `sessionsBookings`.`Member` = `members`.`MemberID` WHERE `sessionsBookings`.`Session` = ? AND `sessionsBookings`.`Date` = ? AND `members`.`Tenant` = ? AND `members`.`Active`", [
        bookableSession['Session'],
        bookableSession['Date'],
        bookableSession['Tenant'],
      ]);

      // Now work out the week id for this session (boring bit)
      let weekId = await this.getWeekId(bookableSession['Tenant'], bookableSession['Date']);
      // Error will be thrown if no week id

      for (let y = 0; y < bookings.length; y++) {
        const member = bookings[y];

        var [addRecordResult, fields] = await mysql.query("INSERT INTO `sessionsAttendance` (`WeekID`, `SessionID`, `MemberID`, `AttendanceBoolean`, `AttendanceRequired`) VALUES (?, ?, ?, ?, ?)", [
          weekId,
          bookableSession['Session'],
          member['Member'],
          0,
          1,
        ]);

      }

      // Mark as register generated
      var [addRecordResult, fields] = await mysql.query("UPDATE `sessionsBookable` SET `RegisterGenerated` = ? WHERE `Session` = ? AND `Date` = ?", [
        1,
        bookableSession['Session'],
        bookableSession['Date'],
      ]);

      await conn.commit();

    } catch (error) {

      // If an error occurred, roll back
      await conn.rollback();
      // console.error(error);

    }

    conn.release();

  }

  // Commit or roll back and report error

}