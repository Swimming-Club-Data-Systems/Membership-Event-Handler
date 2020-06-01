/**
 * Handle GoCardless webhooks
 */

// const gocardless = require('gocardless');
// const constants = require('gocardless/constants');

// const client = gocardless(
//   // We recommend storing your access token in an environment
//   // variable for security
//   process.env.GC_ACCESS_TOKEN,
//   // Change this to constants.Environments.Live when you're ready to go live
//   constants.Environments.Sandbox
// );


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
        // Handle the events
        await console.log(event.links.organisation);
      })
    );
  }

  // console.log());

  res.json({
    status: 200
  });
}

