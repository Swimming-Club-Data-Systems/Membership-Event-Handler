/**
 * Handle mandate events
 */

const mysql = require('../../common/mysql');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment-timezone');

async function updateDetails(org, stripe, dispute) {
  let created, dueBy = null;

  if (dispute.created) {
    try {
      created = moment.unix(dispute.created);
    } catch (error) {
      // Ignore
    }
  }

  if (dispute.evidence_details.due_by) {
    try {
      dueBy = moment.unix(dispute.evidence_details.due_by);
    } catch (error) {
      // Ignore
    }
  }

  // Update dispute info
  var [results, fields] = await mysql.query("UPDATE `stripeDisputes` SET `Amount` = ?, `Currency` = ?, `PaymentIntent` = ?, `Reason` = ?, `Status` = ?, `Created` = ?, `EvidenceDueBy` = ?, `IsRefundable` = ?, `HasEvidence` = ?, `EvidencePastDue` = ?, `EvidenceSubmissionCount` = ? WHERE `SID` = ?", [ 
    dispute.amount,
    dispute.currency,
    dispute.payment_intent,
    dispute.reason,
    dispute.status,
    created.format("Y-MM-DD HH:mm:ss"),
    dueBy.format("Y-MM-DD HH:mm:ss"),
    dispute.is_charge_refundable,
    dispute.evidence_details.has_evidence,
    dispute.evidence_details.past_due,
    dispute.evidence_details.submission_count,
    dispute.id,
  ]);
}

exports.handleCreated = async function (org, stripe, dispute) {
  // Handle new dispute

  dispute = await stripe.disputes.retrieve(
    dispute.id, {
    expand: ['payment_intent.payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  let created, dueBy = null;

  if (dispute.created) {
    try {
      created = moment.unix(dispute.created);
    } catch (error) {
      // Ignore
    }
  }

  if (dispute.evidence_details.due_by) {
    try {
      dueBy = moment.unix(dispute.evidence_details.due_by);
    } catch (error) {
      // Ignore
    }
  }

  var [results, fields] = await mysql.query("INSERT INTO `stripeDisputes` (`ID`, `SID`, `Amount`, `Currency`, `PaymentIntent`, `Reason`, `Status`, `Created`, `EvidenceDueBy`, `IsRefundable`, `HasEvidence`, `EvidencePastDue`, `EvidenceSubmissionCount`, `Tenant`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [ 
    uuidv4(),
    dispute.id,
    dispute.amount,
    dispute.currency,
    dispute.payment_intent,
    dispute.reason,
    dispute.status,
    created.format("Y-MM-DD HH:mm:ss"),
    dueBy.format("Y-MM-DD HH:mm:ss"),
    dispute.is_charge_refundable,
    dispute.evidence_details.has_evidence,
    dispute.evidence_details.past_due,
    dispute.evidence_details.submission_count,
    org.id,
  ]);
}

exports.handleClosed = async function (org, stripe, dispute) {

  dispute = await stripe.disputes.retrieve(
    dispute.id, {
    expand: ['payment_intent.payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Handle closed dispute
  await updateDetails(org, stripe, dispute);
}

exports.handleFundsWithdrawn = async function (org, stripe, dispute) {

  dispute = await stripe.disputes.retrieve(
    dispute.id, {
    expand: ['payment_intent.payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Handle dispute - funds withdrawn
  await updateDetails(org, stripe, dispute);

  // If BACS Direct Debit update payment record
  if (dispute.payment_intent.payment_method.type && dispute.payment_intent.payment_method.type == 'bacs_debit') {
    // Set matching payment as failed
    let status = 'failed';

    if (dispute.reason = 'credit_not_processed' || dispute.reason == 'duplicate' || dispute.reason == 'fraudulent' || dispute.reason == 'general' || dispute.reason == 'product_not_received' || dispute.reason == 'product_unacceptable' || dispute.reason == 'subscription_canceled' || dispute.reason == 'unrecognized') {
      status = 'charged_back';
    }

    var [results, fields] = await mysql.query("UPDATE `payments` SET `Status` = ?, `stripeFailureCode` = ? WHERE `stripePaymentIntent` = ?", [
      status,
      dispute.reason,
      dispute.payment_intent.id,
    ]);
  }
}

exports.handleFundsReinstated= async function (org, stripe, dispute) {

  dispute = await stripe.disputes.retrieve(
    dispute.id, {
    expand: ['payment_intent.payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Handle dispute - funds reinstated
  await updateDetails(org, stripe, dispute);
}

exports.handleUpdated = async function (org, stripe, dispute) {

  dispute = await stripe.disputes.retrieve(
    dispute.id, {
    expand: ['payment_intent.payment_method'],
  },
    {
      stripeAccount: org.getStripeAccount()
    }
  );

  // Handle dispute updates
  await updateDetails(org, stripe, dispute);
}