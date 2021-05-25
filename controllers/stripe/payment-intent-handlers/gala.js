/**
 * Specialist handler for gala entry payments
 */

const mysql = require("../../../common/mysql");
const moment = require('moment-timezone');
const BigNumber = require('bignumber.js');
const escape = require('escape-html');
const Email = require('../../email/email');
const stripeHelpers = require('../helpers');
const { Connection } = require("mysql2");

exports.paymentIntentHandler = async function (org, stripe, intent) {
  try {
    var results, fields;
    const swimsArray = {
      '25Free': '25 Free',
      '50Free': '50 Free',
      '100Free': '100 Free',
      '200Free': '200 Free',
      '400Free': '400 Free',
      '800Free': '800 Free',
      '1500Free': '1500 Free',
      '25Back': '25 Back',
      '50Back': '50 Back',
      '100Back': '100 Back',
      '200Back': '200 Back',
      '25Breast': '25 Breast',
      '50Breast': '50 Breast',
      '100Breast': '100 Breast',
      '200Breast': '200 Breast',
      '25Fly': '25 Fly',
      '50Fly': '50 Fly',
      '100Fly': '100 Fly',
      '200Fly': '200 Fly',
      '100IM': '100 IM',
      '150IM': '150 IM',
      '200IM': '200 IM',
      '400IM': '400 IM'
    }

    var reuse = true;

    // intent = await stripe.paymentIntents.retrieve(
    //   intent.id, {
    //   expand: ['customer', 'payment_method'],
    // },
    //   {
    //     stripeAccount: org.getStripeAccount()
    //   }
    // );

    // Get id
    [results, fields] = await mysql.query("SELECT ID FROM stripePayments WHERE Intent = ?", [
      intent.id
    ]);

    if (results.length == 0) {
      return;
    }

    var databaseId = results[0].ID;

    // Set fees if possible
    if (intent.charges.data[0].balance_transaction) {
      // Handle stripe balance transaction for fees
      // CALL A METHOD
      let fee = intent.charges.data[0].balance_transaction.fee;
      [results, fields] = await mysql.query("UPDATE `stripePayments` SET `Fees` = ? WHERE `Intent` = ?;", [
        fee,
        intent.id,
      ]);
    }

    // Get the user
    [results, fields] = await mysql.query("SELECT `User` FROM stripePayments WHERE Intent = ?", [
      intent.id
    ]);

    if (results.length == 0) {
      return;
    }

    var userId = results[0].User;

    if (intent.charges.data[0].payment_method_details.card.wallet != null) {
      reuse = false;
    }

    var cardCount = 0;
    var customerId, method, pm;

    var newMethod = true;

    if (intent.payment_method) {
      [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripePayMethods WHERE MethodID = ?", [
        intent.payment_method.id
      ]);

      if (results[0]['COUNT(*)'] > 0) {
        newMethod = false;
      }
    }

    // Get user email etc
    [results, fields] = await mysql.query("SELECT Forename, Surname, EmailAddress, Mobile FROM users WHERE UserID = ?", [
      userId
    ]);

    if (results.length == 0) {
      return;
    }

    var user = results[0];

    if (newMethod) {
      // Check if existing customer
      [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripeCustomers WHERE User = ?", [
        userId
      ]);
      if (results[0]['COUNT(*)'] == 0) {
        // Create a customer
        var customer = await stripe.customers.create({
          payment_method: intent.payment_method.id,
          name: user.Forename + ' ' + user.Surname,
          description: 'Customer for ' + userId + ' (' + user.EmailAddress + ')',
          email: user.EmailAddress,
          phone: user.Mobile
        }, {
          stripeAccount: org.getStripeAccount()
        });

        await mysql.query("INSERT INTO stripeCustomers (User, CustomerID) VALUES (?, ?)", [
          userId,
          customer.id,
        ]);
      } else {
        // Get customer id
        [results, fields] = await mysql.query("SELECT CustomerID FROM stripeCustomers WHERE User = ?", [
          userId
        ]);

        var customer = await stripe.customers.retrieve(
          results[0]['CustomerID'],
          {
            stripeAccount: org.getStripeAccount()
          });

        // Check if any details need updating
        if (customer.name != user.Forename + ' ' + user.Surname || customer.email != user.EmailAddress || customer.phone != user.Mobile) {
          await stripe.customers.update(
            customer.id,
            {
              name: user.Forename + ' ' + user.Surname,
              email: user.EmailAddress,
              phone: user.Mobile
            }, {
            stripeAccount: org.getStripeAccount()
          }
          );
        }
      }

      var method = intent.payment_method;
      var pm = await stripe.paymentMethods.retrieve(
        method.id,
        {
          stripeAccount: org.getStripeAccount()
        }
      );

      // Get this card count
      [results, fields] = await mysql.query("SELECT COUNT(*) FROM stripePayMethods WHERE Fingerprint = ? AND Customer = ? AND Reusable = '1'", [
        pm.card.fingerprint,
        customer.id,
      ]);

      if (results[0]['COUNT(*)'] > 0) {
        reuse = false;
      }

      // Attach payment method to customer iff it's to be reused
      // Also only if we can't see it in the DB for this user
      // Otherwise we're saving loads of non reusable Apple Pay cards etc.
      if (reuse && (!pm.customer || pm.customer == null)) {
        pm.attach(customer.id);
      } else if (!pm.customer || pm.customer == null) {
        reuse = false;
      }

      [results, fields] = await mysql.query("INSERT INTO stripePayMethods (Customer, MethodID, `Name`, CardName, City, Country, Line1, Line2, PostCode, Brand, IssueCountry, ExpMonth, ExpYear, Funding, Last4, Fingerprint, Reusable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
        customer.id,
        pm.id,
        'Unnamed card',
        pm.card.name,
        pm.billing_details.address.city,
        pm.billing_details.address.country,
        pm.billing_details.address.line1,
        pm.billing_details.address.line2,
        pm.billing_details.address.postal_code,
        pm.card.brand,
        pm.card.country,
        pm.card.exp_month,
        pm.card.exp_year,
        pm.card.funding,
        pm.card.last4,
        pm.card.fingerprint,
        reuse,
      ]);
    }

    if (intent.status == 'succeeded') {
      // Begin a transaction
      var pool = mysql.getPool();
      var conn = await pool.getConnection();
      await conn.beginTransaction();
      try {
        // Get payment method
        [results, fields] = await conn.query("SELECT ID FROM stripePayMethods WHERE MethodID = ?", [
          intent.payment_method.id,
        ]);
        var paymentMethodId = null;
        if (results.length > 0) {
          paymentMethodId = results[0].ID;
        }

        if (paymentMethodId == null && cardCount > 0) {
          // Get card from other details
          [results, fields] = await conn.query("SELECT ID FROM stripePayMethods WHERE Customer = ? AND Fingerprint = ? AND Reusable = ?", [
            customer.id,
            pm.card.fingerprint,
            1
          ]);
          if (results.length > 0) {
            paymentMethodId = results[0].ID;
          }

          if (paymentMethodId == null) {
            // Can't execute further so return
            return;
          }
        }

        // Set the date to now
        var date = moment.utc();

        try {
          // Add to stripe payments
          [results, fields] = await conn.query("UPDATE stripePayments SET Method = ?, Amount = ?, Currency = ?, Paid = ?, AmountRefunded = ?, `DateTime` = ? WHERE Intent = ?", [
            paymentMethodId,
            intent.amount,
            intent.currency,
            true,
            0,
            date.format("Y-MM-DD HH:mm:ss"),
            intent.id,
          ]);

          // Update entries
          [results, fields] = await conn.query("UPDATE galaEntries SET Charged = ? WHERE StripePayment = ?", [
            true,
            databaseId
          ]);

          // Get entries
          [results, fields] = await conn.query("SELECT * FROM ((galaEntries INNER JOIN members ON galaEntries.MemberID = members.MemberID) INNER JOIN galas ON galaEntries.GalaID = galas.GalaID) WHERE StripePayment = ?", [
            databaseId
          ]);

          var entries = results;

          entries.forEach(async (entry) => {
            // Add payment items
            [results, fields] = await conn.query("INSERT INTO stripePaymentItems (Payment, `Name`, `Description`, Amount, Currency, AmountRefunded) VALUES (?, ?, ?, ?, ?, ?)", [
              databaseId,
              'Gala entry',
              'Gala entry number ' + entry.EntryID,
              parseInt((new BigNumber(entry.FeeToPay)).shiftedBy(2).decimalPlaces(0)),
              intent.currency,
              0,
            ]);
          });

          if (pm == null) {
            pm = await stripe.paymentMethods.retrieve(
              intent.payment_method.id,
              {
                stripeAccount: org.getStripeAccount()
              }
            );
          }

          var message = '<p>Here is your payment receipt for your gala entries.</p>';

          entries.forEach(entry => {
            message += '<p>' + escape(entry.MForename + ' ' + entry.MSurname) + ' for ' + escape(entry.GalaName) + '</p>';
          });

          message += '<p><strong>Total</strong> <br>&pound;' + escape((new BigNumber(intent.amount)).shiftedBy(-2).decimalPlaces(2).toFormat(2)) + '</p><p><strong>Payment reference</strong> <br>SPM' + databaseId + '</p>';

          if (intent.charges.data[0].payment_method_details.card) {
            message += '<p><strong>Card</strong> <br>' + stripeHelpers.getCardBrand(intent.charges.data[0].payment_method_details.card.brand) + ' ' + escape(intent.charges.data[0].payment_method_details.card.funding) + ' card <br>&middot;&middot;&middot;&middot; &middot;&middot;&middot;&middot; &middot;&middot;&middot;&middot; ' + escape(intent.charges.data[0].payment_method_details.card.last4) + '</p>';

            if (intent.charges.data[0].payment_method_details.card.wallet) {
              message += '<p><strong>Mobile wallet</strong> <br>' + stripeHelpers.getWalletName(intent.charges.data[0].payment_method_details.card.wallet.type) + '</p>';

              if (intent.charges.data[0].payment_method_details.card.wallet.dynamic_last4) {
                message += '<p><strong>Device account number</strong> <br>&middot;&middot;&middot;&middot; &middot;&middot;&middot;&middot; &middot;&middot;&middot;&middot; ' + escape(intent.charges.data[0].payment_method_details.card.wallet.dynamic_last4) + '</p>';
              }
            }

          }

          if (intent.charges.data[0].billing_details.address) {
            var billingAddress = intent.charges.data[0].billing_details.address;

            message += '<p class="mb-0"><strong>Billing address</strong></p>';
            message += '<address>';

            if (billingAddress.name) {
              message += escape(billingAddress.name) + '<br>';
            }

            if (billingAddress.line1) {
              message += escape(billingAddress.line1) + '<br>';
            }

            if (billingAddress.line2) {
              message += escape(billingAddress.line2) + '<br>';
            }

            if (billingAddress.postal_code) {
              message += escape(billingAddress.postal_code) + '<br>';
            }

            if (billingAddress.state) {
              message += escape(billingAddress.state) + '<br>';
            }

            if (billingAddress.country) {
              message += escape(billingAddress.country) + '<br>';
            }

            message += '</address>';

          }

          message += '<p>In accordance with card network rules, refunds for gala rejections will only be made to the payment card which was used.</p>';
          message += '<p>Should you wish to withdraw your swimmers you will need to contact the gala coordinator. Depending on the gala and host club, you may not be eligible for a refund in such circumstances unless you have a reason which can be evidenced, such as a doctors note.</p>';

          var email, name;
          if (intent.charges.data[0].billing_details.email) {
            email = intent.charges.data[0].billing_details.email;
            name = user.Forename + ' ' + user.Surname;
            if (intent.charges.data[0].billing_details.name) {
              name = intent.charges.data[0].billing_details.name;
            }
          } else {
            email = user.EmailAddress;
            name = user.Forename + ' ' + user.Surname;
          }

          let mail = new Email(name, email, org, 'Payment Receipt', message);
          mail.send();

        } catch (err) {
          console.error(err);
        }

        await conn.commit();
      } catch (err) {
        await conn.rollback();
        console.error(err);
      }
      conn.release();
    }
  } catch (err) {
    console.warn(err.stack);
  }
}