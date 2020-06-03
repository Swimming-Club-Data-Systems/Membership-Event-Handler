/**
 * Handle GC mandate events
 */

const orgMethods = require('./organisation');
const mysql = require('../../common/mysql');

async function created(client, event) {
  // Check if exists
  // let pool = mysql.getPool();
  // pool.query("SELECT COUNT(*) FROM paymentMandates WHERE Mandate = ?", [event.links.mandate], (err, results, fields) => {
  //   if (results[0]['COUNT(*)'] == 0) {
  //     // Does not exist so add new mandate to db
  //     let mandate = await client.mandates.find(event.links.mandate);
  //   }
  // });
}

async function cancelled(client, event) {
  var mandates, prefCount, fields, prefMandate;
  try {
    // Disable in system
    await mysql.query("UPDATE `paymentMandates` SET `InUse` = ? WHERE `Mandate` = ?", [0, event.links.mandate]);

    // Get User
    let [rows, fields] = await mysql.query("SELECT users.UserID, `Forename`, `Surname`, `EmailAddress`, `MandateID`, users.Active FROM `paymentMandates` INNER JOIN `users` ON users.UserID = paymentMandates.UserID WHERE `Mandate` = ?", [event.links.mandate]);

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
  } catch (err) {

  }
}

async function transferred(client, event) {
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

async function expired(client, event) {
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

async function replaced(client, event) {
  /*
   * THIS EVENT MUST BE HANDLED
   * WHEN USERS UPGRADE TO PLUS, MANDATES ARE REPLACED
   */
}

exports.handleEvent = async function (event) {
  try {
    let client = await orgMethods.getOrganisationClient(event.links.organisation);
    
    switch (event.action) {
      case 'created':
        created(client, event)
        break;
      case 'cancelled':
        cancelled(client, event)
        break;
      case 'transferred':
        transferred(client, event)
        break;
      case 'expired':
        expired(client, event)
        break;
      case 'replaced':
        replaced(client, event)
        break;
    
      default:
        // Can not handle event
        break;
    }
    
  } catch (error) {
    console.warn(error);
  }
}