const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const variants = [process.env.DB_HOST || 'localhost', '127.0.0.1', 'host.docker.internal'];
const encOptions = [false, true];

async function tryConnect(host, encrypt) {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: host,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    options: {
      encrypt: encrypt,
      trustServerCertificate: true
    },
    pool: { max: 1, min: 0 }
  };

  console.log(`\nTrying host: ${host}, encrypt=${encrypt}`);
  try {
    const pool = await new sql.ConnectionPool(config).connect();
    console.log('Connected to', host, 'encrypt=', encrypt);
    await pool.close();
  } catch (err) {
    console.error('Connection error for', host, 'encrypt=', encrypt, ':', err && err.message ? err.message : err);
  }
}

(async () => {
  for (const h of variants) {
    for (const e of encOptions) {
      await tryConnect(h, e);
    }
  }
  process.exit(0);
})();