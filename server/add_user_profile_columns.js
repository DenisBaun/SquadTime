// Run once to add user profile settings columns
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
    console.log('Connected to DB, ensuring Users profile columns...');
    await pool.request().query(`
IF COL_LENGTH('dbo.Users', 'display_name') IS NULL
  ALTER TABLE dbo.Users ADD display_name NVARCHAR(60) NULL;
IF COL_LENGTH('dbo.Users', 'avatar_url') IS NULL
  ALTER TABLE dbo.Users ADD avatar_url NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users', 'avatar_path') IS NULL
  ALTER TABLE dbo.Users ADD avatar_path NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Users', 'bio') IS NULL
  ALTER TABLE dbo.Users ADD bio NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.Users', 'library_private') IS NULL
  ALTER TABLE dbo.Users ADD library_private BIT NOT NULL CONSTRAINT DF_Users_LibraryPrivate DEFAULT (0);
IF COL_LENGTH('dbo.Users', 'library_visibility') IS NULL
  ALTER TABLE dbo.Users ADD library_visibility NVARCHAR(20) NOT NULL CONSTRAINT DF_Users_LibraryVisibility DEFAULT ('everyone');
`);
    await pool.request().query(`
UPDATE dbo.Users
SET display_name = username
WHERE display_name IS NULL OR LTRIM(RTRIM(display_name)) = '';
UPDATE dbo.Users
SET library_visibility = CASE WHEN library_private = 1 THEN 'friends' ELSE 'everyone' END
WHERE library_visibility IS NULL OR LTRIM(RTRIM(library_visibility)) = '';
`);
    console.log('Users profile columns ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error altering Users table:', err);
    process.exit(1);
  }
}

run();
