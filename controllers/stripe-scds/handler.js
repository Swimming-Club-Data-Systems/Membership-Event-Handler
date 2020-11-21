/**
 * Handle Stripe webhooks
 */

const mysql = require('../../common/mysql');
// const Organisation = require('../organisation');
// const payouts = require('./payout');
// const paymentMethods = require('./payment-method');
// const paymentIntents = require('./payment-intent');
// const checkoutSessions = require('./checkout-sessions');
// const mandates = require('./mandate');
// const disputes = require('./dispute');

const process = require('process');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_SCDS_WEBHOOK_SECRET;


exports.webhookHandler = async function (req, res, next) {
  console.info(endpointSecret);
  const sig = req.get('stripe-signature');
  let event;
  var paymentMethod, paymentIntent, payout, checkoutSession, dispute;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {

    if (!event) {
      throw new Error();
    }

    // Do if event has same mode as system
    // Handle the event
    switch (event.type) {
      case 'account.updated':
        console.log(event);
        break;
      default:
        // Unexpected event type
        return res.status(400).end();
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (err) {
    console.error(err);
    return res.status(400).end();
  }



}