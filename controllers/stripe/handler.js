/**
 * Handle Stripe webhooks
 */

const mysql = require('../../common/mysql');
const orgMethods = require('./organisation');
const payouts = require('./payout');
const paymentMethods = require('./payment-method');
const paymentIntents = require('./payment-intent');

const process = require('process');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;


exports.webhookHandler = async function (req, res, next) {
  const sig = req.get('stripe-signature');
  let event;
  var paymentMethod, paymentIntent, payout;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    response.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const org = await orgMethods.getOrganisation(event.account);

    // Do if event has same mode as system
    if (event.livemode === (process.env.NODE_ENV === 'production')) {
      // Handle the event
      switch (event.type) {
        case 'payment_method.card_automatically_updated':
          paymentMethod = event.data.object;
          paymentMethods.handleUpdate(org, stripe, paymentMethod);
          break;
        case 'payment_method.updated':
          paymentMethod = event.data.object;
          paymentMethods.handleUpdate(org, stripe, paymentMethod);
          break;
        case 'payment_intent.succeeded':
          paymentIntent = event.data.object;
          paymentIntents.handleCompletedPaymentIntent(org, stripe, paymentIntent);
          break;
        case 'payment_intent.created':
          paymentIntent = event.data.object;
          paymentIntents.handleNewPaymentIntent(org, stripe, paymentIntent);
          break;
        case 'payment_method.detached':
          paymentMethod = event.data.object;
          paymentMethods.handleDetach(org, stripe, paymentMethod);
          break;
        // case 'payment_method.attached':
        //   const paymentMethod = event.data.object;
        //   break;
        case 'payout.canceled':
        case 'payout.created':
        case 'payout.failed':
        case 'payout.paid':
        case 'payout.updated':
          payout = event.data.object;
          payouts.handlePayout(org, stripe, payout);
          break;
        default:
          // Unexpected event type
          return res.status(400).end();
      }
    } else {
      return res.status(400).end();
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (err) {
    // console.error(err);
    return res.status(400).end();
  }



}