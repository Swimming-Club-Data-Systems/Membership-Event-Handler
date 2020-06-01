/**
 * Get Org Details
 */

const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');
const mysql = require('../../common/mysql');

exports.getOrganisation = async function (org) {
  return new Promise(async (resolve, reject) => {
    let pool = mysql.getPool();
    let sql = "SELECT `AccessToken`, tenants.ID, tenants.Name, tenants.Email FROM `gcCredentials` INNER JOIN tenants ON gcCredentials.Tenant = tenants.id WHERE OrganisationID = ?";
    let data = [org];
    await pool.query(sql, data, (error, results, fields) => {
      // Stop execution if error
      if (error) reject(error);

      if (results.length == 0) reject({ message: 'No results' });

      // Otherwise return results as an object
      resolve({
        tenant: results[0].ID,
        name: results[0].Name,
        email: results[0].Email,
        accessToken: results[0].AccessToken
      });
    });
  });
}

exports.getOrganisationClient = async function (org) {
  return new Promise(async (resolve, reject) => {
    this.getOrganisation(org).then(orgDetails => {
      console.log(org);

      let environment = constants.Environments.Live;
      if (process.env.NODE_ENV !== 'production') {
        environment = constants.Environments.Sandbox;
      }

      client = gocardless(
        org.accessToken,
        environment,
      );

      resolve(client);
    }).catch(err => {
      reject(err);
    });
  });
}