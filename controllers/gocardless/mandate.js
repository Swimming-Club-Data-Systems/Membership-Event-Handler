/**
 * Handle GC mandate events
 */

const Organisation = require('../organisation');
const mysql = require('../../common/mysql');
const escape = require('escape-html');
const Email = require('../email/email');

async function created(org, client, event) {
  // Check if exists
  // let pool = mysql.getPool();
  // pool.query("SELECT COUNT(*) FROM paymentMandates WHERE Mandate = ?", [event.links.mandate], (err, results, fields) => {
  //   if (results[0]['COUNT(*)'] == 0) {
  //     // Does not exist so add new mandate to db
  //     let mandate = await client.mandates.find(event.links.mandate);
  //   }
  // });
}

async function setDefaultMandate(userId, mandateId) {
  var rows, fields;
  [rows, fields] = await mysql.query("SELECT COUNT(*) FROM paymentPreferredMandate WHERE UserID = ?", [userId]);

  if (rows[0]['COUNT(*)'] == 0) {
    // Add pref mandate
    await mysql.query("INSERT INTO paymentPreferredMandate (UserID, MandateID) VALUES (?, ?)", [
      userId,
      mandateId
    ]);
  } else {
    // Modify pref mandate
    await mysql.query("UPDATE paymentPreferredMandate SET MandateID = ? WHERE UserID = ?", [
      mandateId,
      userId
    ]);
  }
}

async function resubmissionRequested(org, client, event) {
  var rows, fields;

  // Check if is in db, if so set enabled
  var mandate = await client.mandates.find(event.links.mandate);

  await mysql.query("UPDATE `paymentMandates` SET `InUse` = ? WHERE `Mandate` = ?", [1, mandate.id]);

  // Get User
  [rows, fields] = await mysql.query("SELECT users.UserID, `Forename`, `Surname`, `EmailAddress`, `MandateID`, users.Active FROM `paymentMandates` INNER JOIN `users` ON users.UserID = paymentMandates.UserID WHERE `Mandate` = ?", [mandate.id]);

  if (rows[0]) {
    var userId = rows[0].UserID;
    var mandateId = rows[0].MandateID;

    // Get count of mandates
    [rows, fields] = await mysql.query("SELECT COUNT(*) FROM `paymentMandates` INNER JOIN `users` ON users.UserID = paymentMandates.UserID WHERE users.UserID = ? AND paymentMandates.InUse", [rows[0].UserID]);
    if (rows[0]['COUNT(*)'] == 1) {
      // Set new default mandate
      setDefaultMandate(userId, mandateId);
    }
  }
}

async function cancelled(org, client, event) {
  var mandates, prefCount, rows, fields, prefMandate, oldMandate, newMandate;
  console.log('CANCELLED')
  try {
    // Disable in system
    await mysql.query("UPDATE `paymentMandates` SET `InUse` = ? WHERE `Mandate` = ?", [0, event.links.mandate]);

    // Get User
    [rows, fields] = await mysql.query("SELECT users.UserID, `Forename`, `Surname`, `EmailAddress`, `MandateID`, users.Active FROM `paymentMandates` INNER JOIN `users` ON users.UserID = paymentMandates.UserID WHERE `Mandate` = ?", [event.links.mandate]);

    if (rows[0]) {
      // User exists
      let mandateId = rows[0].MandateID;

      // Remove mandate preference
      await mysql.query("DELETE FROM `paymentPreferredMandate` WHERE `MandateID` = ?", [mandateId]);

      // Get any other active mandates
      [mandates, fields] = await mysql.query("SELECT MandateID FROM paymentMandates WHERE UserID = ? AND InUse = 1", [rows[0].UserID]);
      [prefCount, fields] = await mysql.query("SELECT COUNT(*) FROM paymentPreferredMandate WHERE UserID = ?", [rows[0].UserID]);

      if (prefCount[0]['COUNT(*)'] == 0 && mandates.length > 0) {
        // Set first available as preferred
        await mysql.query("INSERT INTO paymentPreferredMandate (UserID, MandateID) VALUES (?, ?)", [rows[0].UserID, mandates[0].MandateID]);
      }

      // Get info about current pref and old pref
      [oldMandate, fields] = await mysql.query("SELECT Mandate, BankName, AccountHolderName, AccountNumEnd FROM paymentMandates INNER JOIN paymentPreferredMandate ON paymentPreferredMandate.MandateID = paymentMandates.MandateID WHERE paymentPreferredMandate.UserID = ?", [rows[0].UserID]);
      [newMandate, fields] = await mysql.query("SELECT Mandate, BankName, AccountHolderName, AccountNumEnd FROM paymentMandates WHERE MandateID = ?", [mandateId]);

      // If user is active
      if (rows[0].Active) {
        // Send an email to the user
        let name = rows[0].Forename + ' ' + rows[0].Surname;
        let subject = 'Direct debit mandate cancelled';
        let content = '<p>Hello ' + escape(name) + ',</p>';
        content += '<p>Your Direct Debit mandate for ' + escape(org.getName()) + ' has been cancelled.</p>';

        if (oldMandate[0]) {
          content += '<p>The cancelled mandate was on ' + escape(oldMandate[0].AccountHolderName) + '\'s account with ' + escape(oldMandate[0].BankName) + '. Account number ending in &middot;&middot;&middot;&middot;&middot;&middot;'.escape(oldMandate[0].AccountNumEnd) + '. Our internal reference for the mandate was ' + escape(oldMandate[0].Mandate) + '.</p>';
        }

        if (newMandate[0]) {
          content += '<p>Your current direct debit mandate is set to ' + escape(newMandate[0].AccountHolderName) + '\'s account with ' + escape(newMandate[0].BankName) + '. Account number ending in &middot;&middot;&middot;&middot;&middot;&middot;'.escape(newMandate[0].AccountNumEnd) + '. Our internal reference for the mandate is ' + escape(oldMandate[0].Mandate) + '.</p>';
        }

        content += '<p>Sign in to your club account to make any changes to your account and direct debit options.</p>';

        content += '<p>Kind regards,<br>The ' + escape(org.getName()) + ' team</p>';

        let mail = new Email(name, rows[0].EmailAddress, org, subject, content);
        await mail.send();
      }
    }
  } catch (err) {
    console.warn(err);
  }
}

async function transferred(org, client, event) {
  try {
    let mandate = await client.mandates.find(event.links.mandate);
    let bankAccount = await client.customerBankAccounts.find(mandate.links.customer_bank_account);

    // Bank details
    let accHolderName = bankAccount.account_holder_name;
    let accNumEnd = bankAccount.account_number_ending;
    let bankName = bankAccount.bank_name;

    // Update the bank details
    await mysql.query("UPDATE `paymentMandates` SET `BankAccount` = ?, `AccountHolderName` = ?, `AccountNumEnd` = ?, `BankName` = ? WHERE `Mandate` = ?", [
      mandate.links.customer_bank_account.substring(0, 20),
      accHolderName.substring(0, 30),
      accNumEnd,
      bankName.substring(0, 100),
      event.links.mandate.substring(0, 20)
    ]);
  } catch (err) {

  }
}

async function expired(org, client, event) {
  await mysql.query("UPDATE `paymentMandates` SET `InUse` = ? WHERE `Mandate` = ?", [false, event.links.mandate]);

  var fields, mandates, prefCount, prefMandate, rows;

  // Get the user ID, set to another bank if possible and let them know.
  [rows, fields] = await mysql.query("SELECT users.UserID, `Forename`, `Surname`, `EmailAddress`, `MandateID`, users.Active FROM `paymentMandates` INNER JOIN `users` ON users.UserID = paymentMandates.UserID WHERE `Mandate` = ?", [event.links.mandate]);

  if (rows[0]) {
    // User exists
    let mandateId = rows[0].MandateID;

    // Remove mandate preference
    await mysql.query("DELETE FROM `paymentPreferredMandate` WHERE `MandateID` = ?", [MandateID]);

    // Get any other active mandates
    [mandates, fields] = await mysql.query("SELECT MandateID FROM paymentMandates WHERE UserID = ? AND InUse = 1", [rows[0].UserID]);
    [prefCount, fields] = await mysql.query("SELECT COUNT(*) FROM paymentPreferredMandate WHERE UserID = ?", [rows[0].UserID]);

    if (prefCount[0]['COUNT(*)'] == 0 && mandates.length > 0) {
      // Set first available as preferred
      await mysql.query("INSERT INTO paymentPreferredMandate (UserID, MandateID) VALUES (?, ?)", [rows[0].UserID, mandates[0].MandateID]);
    }

    // Get info about current pref and old pref
    [prefMandate, fields] = await mysql.query("SELECT Mandate, BankName, AccountHolderName, AccountNumEnd FROM paymentMandates INNER JOIN paymentPreferredMandate ON paymentPreferredMandate.MandateID = paymentMandates.MandateID WHERE paymentPreferredMandate.UserID = ?", [rows[0].UserID]);
    [prefMandate, fields] = await mysql.query("SELECT Mandate, BankName, AccountHolderName, AccountNumEnd FROM paymentMandates WHERE MandateID = ?", [mandateId]);

    // If user is active
    if (rows[0].Active) {
      // Send an email to the user
      // Need to write handlers for sendgrid in js
    }
  }
}

async function replaced(org, client, event) {
  /*
   * THIS EVENT MUST BE HANDLED
   * WHEN USERS UPGRADE TO PLUS, MANDATES ARE REPLACED
   */
}

exports.handleEvent = async function (event) {
  try {
    let org = await Organisation.fromGoCardlessAccount(event.links.organisation);
    let client = await org.getGoCardlessClient();

    switch (event.action) {
      case 'created':
        created(org, client, event)
        break;
      case 'cancelled':
        cancelled(org, client, event)
        break;
      case 'transferred':
        transferred(org, client, event)
        break;
      case 'expired':
        expired(org, client, event)
        break;
      case 'replaced':
        replaced(org, client, event)
        break;
      case 'resubmission_requested':
        resubmissionRequested(org, client, event)
        break;

      default:
        // Can not handle event
        break;
    }

  } catch (error) {
    console.warn(error);
  }
}