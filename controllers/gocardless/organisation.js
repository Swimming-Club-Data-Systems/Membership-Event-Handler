/**
 * Get Org Details
 */

const gocardless = require('gocardless-nodejs');
const constants = require('gocardless-nodejs/constants');
const mysql = require('../../common/mysql');

exports.getOrganisation = async function (org) {
  return new Promise(async (resolve, reject) => {
    var results, fields;
    try {
      [results, fields] = await mysql.query("SELECT `AccessToken`, tenants.ID, tenants.Name, tenants.Email FROM `gcCredentials` INNER JOIN tenants ON gcCredentials.Tenant = tenants.id WHERE OrganisationID = ?", [org]);

      if (results.length == 0) reject({ message: 'No results' });

      // Otherwise return results as an object
      resolve({
        tenant: results[0].ID,
        name: results[0].Name,
        email: results[0].Email,
        accessToken: results[0].AccessToken,
        sendingEmail: 'noreply@myswimmingclub.uk'
      });
    } catch (err) {
      reject(error);
    }
  });
}

exports.getClient = async function (accessToken) {
  return new Promise(async (resolve, reject) => {
    let environment = constants.Environments.Live;
    if (process.env.NODE_ENV !== 'production') {
      environment = constants.Environments.Sandbox;
    }

    client = gocardless(
      accessToken,
      environment,
    );

    resolve(client);
  }).catch(err => {
    console.warn(err);
    reject(err);
  });
}

exports.getOrganisationClient = async function (org) {
  return new Promise(async (resolve, reject) => {
    this.getOrganisation(org).then(orgDetails => {
      let environment = constants.Environments.Live;
      if (process.env.NODE_ENV !== 'production') {
        environment = constants.Environments.Sandbox;
      }

      client = gocardless(
        orgDetails.accessToken,
        environment,
      );

      resolve(client);
    }).catch(err => {
      console.warn(err);
      reject(err);
    });
  });
}