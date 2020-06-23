/**
 * Payment method code
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');

exports.handleCompleted = async function (org, stripe, cs) {
  if (cs.mode == 'setup' && cs.setup_intent) {
    const intent = await stripe.setupIntents.retrieve(cs.setup_intent, {
      expand: ['payment_method'],
    }, {
      stripeAccount: org.getStripeAccount()
    });
    console.log(intent);
  }
}