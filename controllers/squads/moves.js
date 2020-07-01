/**
 * Handle squad moves automatically
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.moveMembers = async function () {
  // Get pending squad moves
  var date = moment.tz('Europe/London').format('Y-MM-DD');
  var [results, fields] = await mysql.query("SELECT ID, Member, Date, Old, New, Paying FROM squadMoves WHERE Date <= ?", [
    date
  ]);

  // For each result, check member is not in squad, if not do the move
  // Then delete the move from the DB
  results.forEach(move => {
    if (move.Old) {
      try {
        // Remove from old squad
        await mysql.query("DELETE FROM squadMembers WHERE Member = ? AND Squad = ?", [
          move.Member,
          move.Old,
        ]);
      } catch (err) {

      }
    }

    if (move.New) {
      try {
        // Add to new squad
        await mysql.query("INSERT INTO squadMembers (Member, Squad, Paying) VALUES (?, ?, ?)", [
          move.Member,
          move.New,
          move.Paying,
        ]);
      } catch (err) {

      }
    }

    try {
      // Delete squad move
      await mysql.query("DELETE FROM squadMoves WHERE ID = ?", [
        move['ID'],
      ]);
    } catch (err) {

    }
  });
}