const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const hosts = [process.env.DB_HOST || 'localhost', '127.0.0.1', 'host.docker.internal'];

async function tryStandard(host) {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: host,
    port: Number(process.env.DB_PORT || 1433),
    // omit database to connect to default (master)
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 1, min: 0 }
  };
  console.log('\nStandard config -> host:', host);
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log('Standard: connected to', host);
    await pool.close();
  } catch (err) {
    console.error('Standard error for', host, ':', err && err.message ? err.message : err);
  }
}

async function tryAuthObject(host) {
  const config = {
    server: host,
    port: Number(process.env.DB_PORT || 1433),
    authentication: {
      type: 'default',
      options: {
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      }
    },
    options: {
      encrypt: false,
      trustServerCertificate: true
    },
    pool: { max: 1, min: 0 }
  };
  console.log('\nAuth-object config -> host:', host);
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log('Auth-object: connected to', host);
    await pool.close();
  } catch (err) {
    console.error('Auth-object error for', host, ':', err && err.message ? err.message : err);
  }
}

(async () => {
  for (const h of hosts) {
    await tryStandard(h);
    await tryAuthObject(h);
  }
  process.exit(0);
})();