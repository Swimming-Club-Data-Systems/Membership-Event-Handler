/**
 * Handle GoCardless webhooks
 */

const mysql = require('../../common/mysql');

const payments = require('./payment');
const mandates = require('./mandate');
const payouts = require('./payout');
const refunds = require('./refund');
const subscriptions = require('./subscription');
const installmentSchedules = require('./installment-schedule');
const creditors = require('./creditor');

const process = require('process');
const webhooks = require('gocardless-nodejs/webhooks');

const webhookEndpointSecret = process.env.GC_WEBHOOK_ENDPOINT_SECRET;

exports.webhookHandler = async function (req, res, next) {
  const parseEvents = (
    eventsRequestBody,
    signatureHeader // From webhook header
  ) => {
    try {
      var webhookData = webhooks.parse(
        eventsRequestBody,
        webhookEndpointSecret,
        signatureHeader
      );
      return webhookData;
    } catch (error) {
      if (error instanceof webhooks.InvalidSignatureError) {
        res.status(498).end();
      }
    }
  };

  var events = parseEvents(req.body, req.get('Webhook-Signature'));

  if (events) {
    let eventHandle = await Promise.all(
      events.map(async event => {
        // Record event as handled OR check not done before!
        let pool = mysql.getPool();
        let sql = "SELECT COUNT(*) FROM paymentWebhookOps WHERE EventID = ?";
        let data = [event.id];
        pool.query(sql, data, (error, results, fields) => {
          if (results[0]['COUNT(*)'] == 0) {
            // Good to go ahead

            // Record event in db
            pool.query("INSERT INTO paymentWebhookOps (EventID) VALUES (?)", [event.id], async (error, results, fields) => {
              if (!error) {
                // Handle the events
                switch (event.resource_type) {
                  case 'payments':
                    await payments.handleEvent(event);
                    break;
                  case 'mandates':
                    await mandates.handleEvent(event);
                    break;
                  case 'payouts':
                    await payouts.handleEvent(event);
                    break;
                  case 'refunds':
                    await refunds.handleEvent(event);
                    break;
                  case 'subscriptions':
                    await subscriptions.handleEvent(event);
                    break;
                  case 'instalment_schedules':
                    await installmentSchedules.handleEvent(event);
                    break;
                  case 'creditors':
                    await creditors.handleEvent(event);
                    break;
                }
              }
            });
          }
        });
      })
    ).catch(err => {
      // console.warn(err);
    })
  }

  // console.log());

  res.json({
    status: 200
  });
}

