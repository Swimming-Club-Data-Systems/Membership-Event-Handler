/**
 * Handle GC payment events
 */

const orgMethods = require('./organisation');
const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

async function updatePaymentStatus(client, paymentObject) {
  if (paymentObject.links.payout) {
    // Create or update payout
    // TODO;

  }

  await mysql.query("UPDATE `payments` SET `Status` = ?, `Payout` = ? WHERE `PMkey` = ?", [
    paymentObject.status,
    paymentObject.payout,
    paymentObject.id
  ]);
}

async function paymentExists(client, payment) {
  return new Promise(async (resolve, reject) => {
    let [row, fields] = await mysql.query("SELECT COUNT(*) FROM payments WHERE PMkey = ?", [payment]);
    if (row && row[0]['COUNT(*)'] > 0) {
      resolve(true);
    }
    resolve(false);
  });
}

async function created(client, event) {
  // Check if payment already exists
  console.log('PAYMENT CREATED HANDLER');
  let exists = await paymentExists(client, event.links.payment);

  if (!exists) {
    let payment = await client.payments.find(event.links.payment);

    if (event.links.payout) {
      // Create or update payout
      // TODO;

    }

    // Get mandate and user
    let [result, fields] = await mysql.query("SELECT MandateID, UserID FROM paymentMandates WHERE Mandate = ?", [payment.links.mandate]);
    var manUser = result;
    if (manUser[0]) {
      // Sort details
      let date = moment.utc(payment.created_at).format('Y-MM-DD');

      // Add payment to db
      let [result, fields] = await mysql.query("INSERT INTO `payments` (`Date`, `Status`, `UserID`, `MandateID`, `Name`, `Amount`, `Currency`, `PMkey`, `Type`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        date,
        payment.status,
        manUser[0].UserID,
        manUser[0].MandateID,
        payment.description.substring(0, 50),
        payment.amount,
        payment.currency,
        payment.id,
        'Payment'
      ]);

      // Get db id of payment
      let paymentId = result.insertId;

      // Check if we need to add an item to payments pending for tracking
      [result, fields] = await mysql.query("SELECT COUNT(*) FROM paymentsPending WHERE Payment = ?", [paymentId]);
      if (result[0]['COUNT(*)'] == 0) {
        await mysql.query("INSERT INTO paymentsPending (`Date`, `Status`, `UserID`, `Name`, `Amount`, `Currency`, `PMkey`, `Type`, `Payment`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
          date,
          'Pending',
          manUser[0].UserID,
          payment.description.substring(0, 500),
          payment.amount,
          payment.currency,
          payment.id,
          'Payment',
          paymentId
        ]);
      }
    }
  }
}

async function customerApprovalGranted(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function customerApprovalDenied(client, event) {
  let payment = client.payments.find(event.links.payment);

  updatePaymentStatus(client, payment);

  let [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  // Send failure email
}

async function submitted(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function confirmed(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function chargebackCancelled(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function paidOut(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);

  await mysql.query("UPDATE `paymentsPending` SET `Status` = ? WHERE `PMkey` = ?", [
    'Paid',
    payment.id
  ]);
}

async function lateFailureSettled(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function chargebackSettled(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function failed(client, event) {
  let payment = client.payments.find(event.links.payment);

  updatePaymentStatus(client, payment);

  let [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  if (userRow[0]) {
    let user = userRow[0];

    // Get date of ten days time
    let newDate = moment().add(7, 'days').format('Y-MM-DD');

    let [rows, fields] = await mysql.query("SELECT COUNT(*) FROM paymentRetries WHERE UserID = ? AND `Day` = ? AND PMKey = ? AND Tried = ?", [
      user.UserID,
      newDate,
      payment.id,
      0
    ]);

    if (rows[0]['COUNT(*)'] == 0) {
      // Get the number of retries
      let [rows, fields] = await mysql.query("SELECT COUNT(*) FROM paymentRetries WHERE PMKey = ?", [payment.id]);
      let numRetries = rows[0]['COUNT(*)'];

      if (numRetries < 3) {
        // Add retry to list
        await mysql.query("INSERT INTO paymentRetries (`UserID`, `Day`, `PMKey`, `Tried`) VALUES (?, ?, ?, ?)", [
          user.UserID,
          newDate,
          payment.id,
          0
        ]);
      }

      // Send an email to the user telling them we will retry
    }

  }
}

async function chargedBack(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);

  let [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  // Send email to user
}

async function cancelled(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function resubmissionRequested(client, event) {
  let payment = client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

exports.handleEvent = async function (event) {
  console.log('PAYMENT HANDLER GOT EVENT');
  try {
    let client = await orgMethods.getOrganisationClient(event.links.organisation);

    console.log(client);
    console.log(event.action);
    
    switch (event.action) {
      case 'created':
        console.log('SENDING TO PAYMENT CREATED HANDLER');
        created(client, event)
        break;
      case 'customer_approval_granted':
        customerApprovalGranted(client, event)
        break;
      case 'customer_approval_denied':
        customerApprovalDenied(client, event)
        break;
      case 'submitted':
        submitted(client, event)
        break;
      case 'confirmed':
        confirmed(client, event)
        break;
      case 'chargeback_cancelled':
        chargebackCancelled(client, event)
        break;
      case 'paid_out':
        paidOut(client, event)
        break;
      case 'late_failure_settled':
        lateFailureSettled(client, event)
        break;
      case 'chargeback_settled':
        chargebackSettled(client, event)
        break;
      case 'failed':
        failed(client, event)
        break;
      case 'charged_back':
        chargedBack(client, event)
        break;
      case 'cancelled':
        cancelled(client, event)
        break;
      case 'resubmission_requested':
        resubmissionRequested(client, event)
        break;
    
      default:
        // Can not handle event
        break;
    }
    
  } catch (error) {
    console.warn(error);
  }
}