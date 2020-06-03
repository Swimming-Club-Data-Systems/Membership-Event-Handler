/**
 * Handle GC payment events
 */

const orgMethods = require('./organisation');
const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const escape = require('escape-html');
const Email = require('../email/email');

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
    try {
      let [row, fields] = await mysql.query("SELECT COUNT(*) FROM payments WHERE PMkey = ?", [payment]);
      if (row && row[0]['COUNT(*)'] > 0) {
        resolve(true);
      }
      resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

async function created(org, client, event) {
  // Check if payment already exists
  console.log('PAYMENT CREATED HANDLER');
  let exists = await paymentExists(client, event.links.payment);

  if (!exists) {
    var result, fields;
    let payment = await client.payments.find(event.links.payment);

    console.log(payment);

    if (event.links.payout) {
      // Create or update payout
      // TODO;

    }

    // Get mandate and user
    [result, fields] = await mysql.query("SELECT MandateID, UserID FROM paymentMandates WHERE Mandate = ?", [payment.links.mandate]);
    var manUser = result;
    if (manUser[0]) {
      // Sort details
      var date = moment.utc(payment.created_at).format('Y-MM-DD');

      // Add payment to db
      [result, fields] = await mysql.query("INSERT INTO `payments` (`Date`, `Status`, `UserID`, `MandateID`, `Name`, `Amount`, `Currency`, `PMkey`, `Type`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
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

async function customerApprovalGranted(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function customerApprovalDenied(org, client, event) {
  let payment = await client.payments.find(event.links.payment);

  updatePaymentStatus(client, payment);

  var userRow, fields;

  [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname, EmailAddress FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  // Send failure email
  let name = userRow[0].Forename + ' ' + userRow[0].Surname;
  let subject = userRow[0].Name + ' payment failed';
  let content = '<p>Hello ' + escape(name) + ',</p>';
  content += '<p>Your Direct Debit payment (' + escape(userRow[0].Name) + ') of £' + userRow[0].Amount + ', has failed because customer approval was denied. This means your bank requires two people two authorise a direct debit mandate on your account and that this authorisation has not been given. Because we cannot automatically retry this payment, you will be contacted by the treasurer to arrange payment and correct you direct debit mandate.</p>';
  content += '<p>Kind regards,<br>The ' + escape(org.name) + ' team</p>';

  let mail = new Email(name, userRow[0].EmailAddress, org, subject, content);
  mail.send();
}

async function submitted(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function confirmed(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function chargebackCancelled(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function paidOut(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);

  await mysql.query("UPDATE `paymentsPending` SET `Status` = ? WHERE `PMkey` = ?", [
    'Paid',
    payment.id
  ]);
}

async function lateFailureSettled(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function chargebackSettled(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function failed(org, client, event) {
  let payment = await client.payments.find(event.links.payment);

  updatePaymentStatus(client, payment);

  var [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname, EmailAddress FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  if (userRow[0]) {
    var user = userRow[0];

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
      // Send failure email
      var name = user.Forename + ' ' + user.Surname;
      var subject = user.Name + ' payment failed';
      var content = '<p>Hello ' + escape(name) + ',</p>';
      content += '<p>Your Direct Debit payment (' + escape(user.Name) + ') of £' + user.Amount + ', has failed.</p>';

      if (numRetries < 3) {
        content += '<p>We will automatically retry this payment in around ten days time. These precise date will vary by bank and working days.</p>';

        if (numRetries < 2) {
          content += '<p>You don\'t need to take any action. Should this payment fail, we will retry the payment up to ' + (2 - numRetries) + ' times.</p>';
        } else if (numRetries == 2) {
          content += '<p>You don\'t need to take any action. Should this payment fail however, you will need to contact the club treasurer as we will have retried this direct debit payment the maximum of three times.</p>';
        }
      } else {
        content += '<p>We have retried this payment request three times and it has still not succeeded. As a result, you will need to contact the club treasurer to take further action. Failure to pay may lead to the suspension or termination of your membership.</p>';
      }

      content += '<p>Kind regards,<br>The ' + escape(org.name) + ' team</p>';

      let mail = new Email(name, user.EmailAddress, org, subject, content);
      mail.send();
    }

  }
}

async function chargedBack(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);

  let [userRow, fields] = await mysql.query("SELECT payments.UserID, Name, Amount, Forename, Surname, EmailAddress FROM payments INNER JOIN users ON payments.UserID = users.UserID WHERE PMkey = ?", [
    payment.id
  ]);

  // Send email to user
  let name = userRow[0].Forename + ' ' + userRow[0].Surname;
  let subject = userRow[0].Name + ' payment failed';
  let content = '<p>Hello ' + escape(name) + ',</p>';
  content += '<p>Your Direct Debit payment (' + escape(userRow[0].Name) + ') of £' + userRow[0].Amount + ', has been charged back to us. You will be contacted by the treasurer to confirm the situation and arrange for you to pay and outstanding amounts.</p>';
  content += '<p>Under the direct debit guarantee, your bank should have refunded you £' + userRow[0].Amount + ' immediately.</p>';
  content += '<p>If you made an indemnity claim because you mistakenly misidentified the payment, please get in touch with us straight away. If you are ever unsure about the amount we are charging you, get in touch with us straight away or log in to your account to see a full itemised list for this payment.</p>';

  content += '<p>Kind regards,<br>The ' + escape(org.name) + ' team</p>';

  let mail = new Email(name, userRow[0].EmailAddress, org, subject, content);
  mail.send();
}

async function cancelled(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

async function resubmissionRequested(org, client, event) {
  let payment = await client.payments.find(event.links.payment);
  updatePaymentStatus(client, payment);
}

exports.handleEvent = async function (event) {
  try {
    let org = await orgMethods.getOrganisation(event.links.organisation);
    let client = await orgMethods.getClient(org.accessToken);
    
    switch (event.action) {
      case 'created':
        created(org, client, event)
        break;
      case 'customer_approval_granted':
        customerApprovalGranted(org, client, event)
        break;
      case 'customer_approval_denied':
        customerApprovalDenied(org, client, event)
        break;
      case 'submitted':
        submitted(org, client, event)
        break;
      case 'confirmed':
        confirmed(org, client, event)
        break;
      case 'chargeback_cancelled':
        chargebackCancelled(org, client, event)
        break;
      case 'paid_out':
        paidOut(org, client, event)
        break;
      case 'late_failure_settled':
        lateFailureSettled(org, client, event)
        break;
      case 'chargeback_settled':
        chargebackSettled(org, client, event)
        break;
      case 'failed':
        failed(org, client, event)
        break;
      case 'charged_back':
        chargedBack(org, client, event)
        break;
      case 'cancelled':
        cancelled(org, client, event)
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