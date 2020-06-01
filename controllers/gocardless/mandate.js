/**
 * Handle GC mandate events
 */

const orgMethods = require('./organisation');
const mysql = require('../../common/mysql');

exports.handleEvent = async function (event) {
  try {
    let client = await orgMethods.getOrganisationClient(event.links.organisation);
    console.log(client);
  } catch (error) {
    console.warn(error);
  }
}