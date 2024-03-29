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
const { length } = require("mysql2/lib/constants/charset_encodings");

exports.paymentIntentHandler = async function (org, stripe, intent) {
  try {
    var results, fields;

    var reuse = true;

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

    // Get renewal info
    let renewalId = parseInt(intent.metadata.renewal_id);
    let userId = parseInt(intent.metadata.user_id);

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

        [results, fields] = await conn.query("UPDATE `renewalProgress` SET `Stage` = 6, `Substage` = 0 WHERE `RenewalID` = ? AND `UserID` = ? AND `Stage` < 6", [
          renewalId,
          userId,
        ]);

        if (renewalId != 0) {
          // Get members for this user
          [results, fields] = await conn.query("SELECT renewalMembers.ID FROM renewalMembers INNER JOIN members ON members.MemberID = renewalMembers.MemberID WHERE members.UserID = ? AND renewalMembers.RenewalID = ?", [
            userId,
            renewalId,
          ]);

          let renewalMembers = results;

          for (let i = 0; i < renewalMembers.length; i++) {
            let id = renewalMembers[i]['ID'];
            [results, fields] = await conn.query("UPDATE renewalMembers SET PaymentID = ?, `Date` = ?, CountRenewal = ?, Renewed = ? WHERE ID = ?", [
              null,
              date.format("Y-MM-DD HH:mm:ss"),
              true,
              true,
              id,
            ]);
          }
        }

        // If user needs registration
        [results, fields] = await conn.query("SELECT `RR` FROM `users` WHERE `UserID` = ?", [
          userId,
        ]);
        if (results.length > 0 && results[0]['RR']) {
          [results, fields] = await conn.query("UPDATE `users` SET `RR` = 0 WHERE `UserID` = ?", [
            userId,
          ]);

          [results, fields] = await conn.query("UPDATE `members` SET `RR` = 0, `RRTransfer` = 0 WHERE `UserID` = ?", [
            userId,
          ]);

          // Remove from status tracker
          [results, fields] = await conn.query("DELETE FROM renewalProgress WHERE UserID = ? AND RenewalID = ?", [
            userId,
            0,
          ]);
        }

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

          if (pm == null) {
            pm = await stripe.paymentMethods.retrieve(
              intent.payment_method.id,
              {
                stripeAccount: org.getStripeAccount()
              }
            );
          }

          var message = '<p>Here is your payment receipt for your club membership fees.</p>';

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
            message += '<address class="mb-3">';

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

          message += '<p>Thank you for renewing your membership with ' + escape(org.getName()) + '.</p>';
          message += '<p>In accordance with card network rules, refunds will only be made to the payment card which was used.</p>';

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
          await mail.send();

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