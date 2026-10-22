// Run this once to alter Sessions.end_at to allow NULL
const sql = require('mssql');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'SquadTimeDB',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function run() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to DB, altering Sessions.end_at to NULLABLE...');
    await pool.request().query("ALTER TABLE dbo.Sessions ALTER COLUMN end_at DATETIME2 NULL");
    console.log('Altered Sessions.end_at to NULLABLE');
    await pool.close();
  } catch (err) {
    console.error('Error altering table:', err);
    process.exit(1);
  }
}

run();
