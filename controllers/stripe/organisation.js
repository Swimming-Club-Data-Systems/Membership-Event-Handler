/**
 * Org methods for Stripe event handling
 */

const mysql = require('../../common/mysql');

exports.getOrganisation = async function (org) {
  return new Promise(async (resolve, reject) => {
    var results, fields;
    try {
      [results, fields] = await mysql.query("SELECT `Value`, tenants.ID, tenants.Name, tenants.Email FROM `tenantOptions` INNER JOIN tenants ON tenantOptions.Tenant = tenants.id WHERE Option = STRIPE_ACCOUNT_ID AND Value = ?", [org]);

      if (results.length == 0) reject({ message: 'No results' });

      // Otherwise return results as an object
      resolve({
        tenant: results[0].ID,
        name: results[0].Name,
        email: results[0].Email,
        accountId: results[0].Value,
        sendingEmail: 'noreply@myswimmingclub.uk'
      });
    } catch (err) {
      reject(error);
    }
  });
}