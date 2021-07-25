/**
 * Handle subscription billing
 */

const mysql = require('../../common/mysql');
const moment = require('moment-timezone');
const Organisation = require('../organisation');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.calculateAndCharge = async function () {
  // Handle calculating bills

  let results, subscriptions, plans, fields;

  let date = moment.tz('Europe/London').format('Y-MM-DD');

  // Get subscriptions that need billing
  [subscriptions, fields] = await mysql.query("SELECT DISTINCT tenantPaymentSubscriptions.ID, tenantPaymentSubscriptions.Customer, tenantPaymentSubscriptions.PaymentMethod FROM tenantPaymentSubscriptions INNER JOIN tenantPaymentSubscriptionProducts ON tenantPaymentSubscriptions.ID = tenantPaymentSubscriptionProducts.Subscription WHERE tenantPaymentSubscriptions.Active AND tenantPaymentSubscriptions.StartDate <= ? AND (tenantPaymentSubscriptions.EndDate IS NULL OR tenantPaymentSubscriptions.EndDate >= ?) AND tenantPaymentSubscriptionProducts.NextBills <= ?", [
    date,
    date,
    date
  ]);

  // Get plans requiring billing for those subs
  subscriptions.forEach(subscription => {
    // Get the plans
    [plans, fields] = await mysql.query("SELECT subplans.ID, subplans.NextBills, subplans.Quantity, plans.ID PlanID, plans.PricePerUnit, plans.Currency, plans.BillingInterval, plans.Name PlanName, products.ID ProductID, products.Name ProductName, products.Description ProductDescription FROM tenantPaymentSubscriptionProducts subplans INNER JOIN tenantPaymentPlans plans ON subplans.Plan = plans.ID INNER JOIN tenantPaymentProducts products ON products.ID = plans.Product WHERE subplans.Subscription = ? AND subplans.NextBills <= ? AND plans.UsageType = 'recurring'", [
      subscription['ID'],
      date,
    ]);

    // Create a payment
    let totalFee = 0;
    let currency = 'gbp';
    let invoiceId = uuidv4();
    let invoiceReference = 'SCDS-ONLINE-XXXXXXX';

    let companyData = {
      company_number: null,
      company_vat_number: null,
      company_address: null,
    }

    // Create an invoice
    await mysql.query("INSERT INTO tenantPaymentInvoices (ID, Reference, Customer, Date, SupplyDate, Company, Currency, PaymentTerms, HowToPay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      invoiceId,
      invoiceReference,
      subscription['Customer'],
      date,
      date,
      JSON.stringify(companyData),
      'gbp',
      'Pay within 30 days of invoice date',
      'Pay electronically via the SCDS Online Payments Service'
    ]);

    // Create invoice items
    plans.forEach(plan => {
      let fee = plan['PricePerUnit'] * plan['Quantity'];

      await mysql.query("INSERT INTO tenantPaymentInvoiceItems (ID, Invoice, Description, Amount, Currency, Type, Quantity, PricePerUnit, VATAmount, VATRate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        uuidv4(),
        invoiceId,
        JSON.stringify({}),
        fee,
        plan['Currency'],
        'debit',
        plan['Quantity'],
        plan['PricePerUnit'],
        0,
        0
      ]);

      totalFee += fee;

      // Calculate next billing date and update

    });

    // Create Stripe Payment Intent
    if (totalFee > 100) {
      let paymentIntent = await stripe.paymentIntents.create({
        amount: totalFee,
        currency: currency,
        payment_method_types: ['bacs_debit'],
        customer: subscription['Customer'],
        payment_method: subscription['PaymentMethod'],
        confirm: true,
        off_session: true,
        description: 'Invoice ' + invoiceId,
      });
    }
  });
}
// 75a6ecb3-74d9-42ed-a13c-9efb5df620f1