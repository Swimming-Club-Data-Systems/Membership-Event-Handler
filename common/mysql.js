/**
 * Set up mysql pool
 * 
 * A pool is used for concurrency
 */

var mysql = require('mysql');
var pool;

function createPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    connectionLimit : 25,
    host            : process.env.DB_HOST || 'localhost',
    user            : process.env.DB_USER,
    password        : process.env.DB_PASS,
    database        : process.env.DB_NAME
  });
}

function getPool() {
  if (pool) {
    return pool;
  } else {
    throw 'No connection pool';
  }
}

module.exports = {
  createPool,
  getPool
}