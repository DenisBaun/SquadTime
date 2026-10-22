// Run once to add response_reason to SessionInvites table
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
    console.log('Connected to DB, ensuring SessionInvites.response_reason...');
    await pool.request().query(`
IF COL_LENGTH('dbo.SessionInvites', 'response_reason') IS NULL
  ALTER TABLE dbo.SessionInvites ADD response_reason NVARCHAR(1000) NULL;
`);
    console.log('SessionInvites.response_reason ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error altering SessionInvites table:', err);
    process.exit(1);
  }
}

run();
