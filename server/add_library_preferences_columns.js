// Run once to add favorite/rating columns to Library table
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
    console.log('Connected to DB, ensuring Library preference columns...');

    await pool.request().query(`
IF COL_LENGTH('dbo.Library', 'is_favorite') IS NULL
  ALTER TABLE dbo.Library ADD is_favorite BIT NOT NULL CONSTRAINT DF_Library_IsFavorite DEFAULT (0);
IF COL_LENGTH('dbo.Library', 'user_rating') IS NULL
  ALTER TABLE dbo.Library ADD user_rating INT NULL;
`);

    console.log('Library preference columns ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error altering Library table:', err);
    process.exit(1);
  }
}

run();
