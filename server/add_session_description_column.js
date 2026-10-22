// Run once to add description column to Sessions table
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
    console.log('Connected to DB, ensuring Sessions.description...');
    await pool.request().query(`
IF COL_LENGTH('dbo.Sessions', 'description') IS NULL
  ALTER TABLE dbo.Sessions ADD description NVARCHAR(1000) NULL;
`);
    console.log('Sessions.description ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error altering Sessions table:', err);
    process.exit(1);
  }
}

run();
