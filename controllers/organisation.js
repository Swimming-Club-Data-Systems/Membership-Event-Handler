const mysql = require('../common/mysql');

/**
 * Organisation (tenant) class for SCDS membership
 */
module.exports = class Organisation {

  // Instance vars
  keys;
  id;
  tenant;
  name;
  code;
  website;
  email;
  verified;
  goCardless;

  constructor(id, name, code, website, email, verified) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.website = website;
    this.email = email;
    this.verified = verified;

    this.goCardless = {
      token: null,
      organisationId: null,
      loaded: false,
    }

    // await this.getKeys();
  }

  static async fromId(id) {
    // Get tenant
    var [results, fields] = await mysql.query("SELECT `ID`, `Name`, `Code`, `Website`, `Email`, `Verified` FROM tenants WHERE ID = ?", [
      id
    ]);

    if (results.length > 0) {
      let r = results[0];
      let org = new Organisation(r.ID, r.Name, r.Code, r.Website, r.Email, r.Verified);
      await org.getKeys();
      return org;
    } else {
      return null;
    }
  }

  static async fromStripeAccount(id) {
    // Get tenant
    var [results, fields] = await mysql.query("SELECT tenants.ID, tenants.Name, tenants.Code, tenants.Website, tenants.Email, tenants.Verified FROM `tenantOptions` INNER JOIN tenants ON tenantOptions.Tenant = tenants.id WHERE Option = 'STRIPE_ACCOUNT_ID' AND Value = ?", [
      id
    ]);

    if (results.length > 0) {
      let r = results[0];
      let org = new Organisation(r.ID, r.Name, r.Code, r.Website, r.Email, r.Verified);
      await org.getKeys();
      return org;
    } else {
      return null;
    }
  }

  static async fromGoCardlessAccount(id) {
    // Get tenant
    var [results, fields] = await mysql.query("SELECT tenants.ID, tenants.Name, tenants.Code, tenants.Website, tenants.Email, tenants.Verified FROM `gcCredentials` INNER JOIN tenants ON gcCredentials.Tenant = tenants.id WHERE OrganisationID = ?", [
      id
    ]);

    if (results.length > 0) {
      let r = results[0];
      let org = new Organisation(r.ID, r.Name, r.Code, r.Website, r.Email, r.Verified);
      await org.getKeys();
      return org;
    } else {
      return null;
    }
  }

  async getKeys() {
    var [results, fields] = await mysql.query("SELECT Option, Value FROM tenantOptions WHERE Tenant = ?", [
      this.id
    ]);

    // Instantiate and set default values
    var keys = {
      'CLUB_NAME': null,
      'CLUB_SHORT_NAME': null,
      'ASA_CLUB_CODE': null,
      'CLUB_EMAIL': null,
      'CLUB_TRIAL_EMAIL': null,
      'CLUB_WEBSITE': null,
      'GOCARDLESS_USE_SANDBOX': null,
      'GOCARDLESS_SANDBOX_ACCESS_TOKEN': null,
      'GOCARDLESS_ACCESS_TOKEN': null,
      'GOCARDLESS_WEBHOOK_KEY': null,
      'CLUB_ADDRESS': null,
      'SYSTEM_COLOUR': '#007bff',
      'ASA_DISTRICT': 'E',
      'ASA_COUNTY': 'NDRE',
      'STRIPE': null,
      'STRIPE_PUBLISHABLE': null,
      'STRIPE_APPLE_PAY_DOMAIN': null,
      'EMERGENCY_MESSAGE': false,
      'EMERGENCY_MESSAGE_TYPE': 'NONE',
    }

    // Sort key pairs
    results.forEach(keyPair => {
      keys[keyPair['Option']] = keyPair['Value'];
    });

    this.keys = keys;
  }

  async loadGoCardless() {
    var [results, fields] = await mysql.query("SELECT OrganisationId, AccessToken FROM gcCredentials WHERE Tenant = ?", [
      this.id
    ]);

    if (results.length > 0) {
      this.goCardless.token = results[0].AccessToken;
      this.goCardless.organisationId = results[0].OrganisationId;
    }

    this.goCardless.loaded = true;
  }

  async getGoCardlessAccessToken() {
    if (!this.goCardless.loaded) {
      await this.loadGoCardless();
    }

    return this.goCardless.token;
  }

  async getGoCardlessOrgId() {
    if (!this.goCardless.loaded) {
      await this.loadGoCardless();
    }

    return this.goCardless.organisationId;
  }

  async getGoCardlessClient() {
    return new Promise(async (resolve, reject) => {
      let environment = constants.Environments.Live;
      if (process.env.NODE_ENV !== 'production') {
        environment = constants.Environments.Sandbox;
      }
  
      let accessToken = await this.getGoCardlessAccessToken();
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

  getStripeAccount() {
    return this.getKey('STRIPE_ACCOUNT_ID');
  }

  getId() {
    return this.id;
  }

  getName() {
    return this.name;
  }

  getWebsite() {
    return this.website;
  }

  getEmail() {
    return this.email;
  }

  isVerified() {
    return this.verified;
  }

  getKey(key) {
    if (key in this.keys) {
      return this.keys[key];
    }
    return null;
  }

  getCodeId() {
    if (this.code) {
      return this.code;
    }
    return this.id;
  }

  isCLS() {
    return this.code == 'CLSE';
  }

  getSendingEmail() {
    return 'noreply@myswimmingclub.uk';
  }

  async setKey(key, value) {
    if (value == "") {
      value = null;
    }

    if (key in this.keys) {
      this.keys[key] = value;
    }

    var [results, fields] = await mysql.query("SELECT COUNT(*) FROM tenantOptions WHERE `Option` = ? AND `Tenant` = ?", [
      key,
      this.id
    ]);

    if (results[0]['COUNT(*)'] > 0 && value === null) {
      var [results, fields] = await mysql.query("DELETE FROM tenantOptions WHERE `Option` = ? AND `Tenant` = ?", [
        key,
        this.id
      ]);
    } else if (results[0]['COUNT(*)'] == 0 && value !== null) {
      var [results, fields] = await mysql.query("INSERT INTO tenantOptions (`Option`, `Value`, `Tenant`) VALUES (?, ?, ?)", [
        key,
        value,
        this.id
      ]);
    } else if (results[0]['COUNT(*)'] > 0) {
      var [results, fields] = await mysql.query("UPDATE tenantOptions SET `Value` = ? WHERE `Option` = ? AND `Tenant` = ?", [
        value,
        key,
        this.id
      ]);
    }
  }

  
}