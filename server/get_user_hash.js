const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 1, min: 0 }
  };

  try {
    const pool = await new sql.ConnectionPool(config).connect();
    const res = await pool.request().input('email', sql.NVarChar, 'denis@example.com').query('SELECT password_hash FROM dbo.Users WHERE email = @email');
    console.log('Password hash (stored):', res.recordset[0] && res.recordset[0].password_hash ? res.recordset[0].password_hash : '(not found)');
    await pool.close();
  } catch (err) {
    console.error('Error querying user hash:', err && err.message ? err.message : err);
  }
}

main();