/**
 * Set up mysql pool
 * 
 * A pool is used for concurrency
 */

var mysql = require('mysql2/promise');
var pool;

async function createPool() {
  if (pool) {
    return pool;
  }

  pool = await mysql.createPool({
    connectionLimit : 5,
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

function query(query, args = []) {
  let pool = getPool();
  return pool.query(query, args);
}

module.exports = {
  createPool,
  getPool,
  query,
}
