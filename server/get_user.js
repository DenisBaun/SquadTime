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
    const res = await pool.request().input('email', sql.NVarChar, 'denis@example.com').query('SELECT id, username, email, created_at FROM dbo.Users WHERE email = @email');
    console.log('Query result:', res.recordset);
    await pool.close();
  } catch (err) {
    console.error('Error querying user:', err && err.message ? err.message : err);
  }
}

main();