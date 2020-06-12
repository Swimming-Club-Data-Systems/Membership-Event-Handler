/**
 * Handle Stripe webhooks
 */

const mysql = require('../../common/mysql');

const payouts = require('./payout');
const paymentMethods = require('./payment-method');

const process = require('process');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;


exports.webhookHandler = async function (req, res, next) {
  const sig = req.get('stripe-signature');
  let event;

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
          const paymentMethod = event.data.object;
          break;
        case 'payment_method.updated':
          const paymentMethod = event.data.object;
          break;
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          break;
        case 'payment_intent.created':
          const paymentIntent = event.data.object;
          break;
        case 'payment_method.detached':
          const paymentMethod = event.data.object;
          // Then define and call a method to handle the successful payment intent.
          // handlePaymentIntentSucceeded(paymentIntent);
          break;
        case 'payment_method.attached':
          const paymentMethod = event.data.object;
          // Then define and call a method to handle the successful attachment of a PaymentMethod.
          // handlePaymentMethodAttached(paymentMethod);
          break;
        case 'payout.canceled':
        case 'payout.created':
        case 'payout.failed':
        case 'payout.paid':
        case 'payout.updated':
          const payout = event.data.object;
          payouts.handlePayout(org, stripe, payout)
          break;
        // ... handle other event types
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

  }


  
}