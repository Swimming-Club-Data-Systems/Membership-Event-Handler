/**
 * Handle Stripe webhooks
 */

const mysql = require('../../common/mysql');
const Organisation = require('../organisation');
const payouts = require('./payout');
const paymentMethods = require('./payment-method');
const paymentIntents = require('./payment-intent');
const checkoutSessions = require('./checkout-sessions');
const mandates = require('./mandate');
const disputes = require('./dispute');

const process = require('process');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;


exports.webhookHandler = async function (req, res, next) {
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

    const org = await Organisation.fromStripeAccount(event.account);

    // Do if event has same mode as system
    if (event.livemode === (process.env.NODE_ENV === 'production')) {
      // Handle the event
      switch (event.type) {
        case 'payment_method.automatically_updated':
          paymentMethod = event.data.object;
          paymentMethods.handleUpdate(org, stripe, paymentMethod);
          break;
        case 'payment_method.updated':
          paymentMethod = event.data.object;
          paymentMethods.handleUpdate(org, stripe, paymentMethod);
          break;
        case 'payment_intent.created':
          paymentIntent = event.data.object;
          paymentIntents.handleNewPaymentIntent(org, stripe, paymentIntent);
          break;
        case 'payment_intent.processing':
          paymentIntent = event.data.object;
          paymentIntents.handleProcessingPaymentIntent(org, stripe, paymentIntent);
          break;
        case 'payment_intent.canceled':
          paymentIntent = event.data.object;
          paymentIntents.handleCanceledPaymentIntent(org, stripe, paymentIntent);
          break;
        case 'payment_intent.payment_failed':
          paymentIntent = event.data.object;
          paymentIntents.handleFailedPaymentIntent(org, stripe, paymentIntent);
          break;
          case 'payment_intent.succeeded':
          paymentIntent = event.data.object;
          paymentIntents.handleCompletedPaymentIntent(org, stripe, paymentIntent);
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
        case 'checkout.session.completed':
          checkoutSession = event.data.object;
          checkoutSessions.handleCompleted(org, stripe, checkoutSession);
          break;
        case 'mandate.updated':
          mandate = event.data.object;
          mandates.handleUpdated(org, stripe, mandate);
          break;
        case 'charge.dispute.created':
          dispute = event.data.object;
          disputes.handleCreated(org, stripe, dispute);
          break;
        case 'charge.dispute.updates':
          dispute = event.data.object;
          disputes.handleUpdated(org, stripe, dispute);
          break;
        case 'charge.dispute.closed':
          dispute = event.data.object;
          disputes.handleClosed(org, stripe, dispute);
          break;
        case 'charge.dispute.funds_withdrawn':
          dispute = event.data.object;
          disputes.handleFundsWithdrawn(org, stripe, dispute);
          break;
        case 'charge.dispute.funds_reinstated':
          dispute = event.data.object;
          disputes.handleFundsReinstated(org, stripe, dispute);
          break;
        default:
          // Unexpected event type
          return res.status(400).end();
      }
    } else {
      return res.status(200).end();
    }

    // Return a response to acknowledge receipt of the event
    res.json({ received: true });

  } catch (err) {
    console.error(err);
    return res.status(400).end();
  }



}