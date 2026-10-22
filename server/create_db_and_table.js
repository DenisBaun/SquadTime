const sql = require('mssql');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const baseConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 1433),
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 1, min: 0 }
};

async function main() {
  try {
    const pool = await new sql.ConnectionPool(baseConfig).connect();
    console.log('Connected to server, creating database if needed...');
    await pool.request().query("IF DB_ID('SquadTimeDB') IS NULL CREATE DATABASE SquadTimeDB;");
    await pool.close();

    // connect to the new database and create Users table if not exists
    const dbConfig = { ...baseConfig, database: 'SquadTimeDB' };
    const pool2 = await new sql.ConnectionPool(dbConfig).connect();
    console.log('Connected to SquadTimeDB, ensuring Users table exists...');

    const createTableSql = `IF OBJECT_ID('dbo.Users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(500) NOT NULL,
    display_name NVARCHAR(60) NULL,
    avatar_url NVARCHAR(500) NULL,
    avatar_path NVARCHAR(1000) NULL,
    bio NVARCHAR(500) NULL,
    library_private BIT NOT NULL DEFAULT (0),
    library_visibility NVARCHAR(20) NOT NULL DEFAULT ('everyone'),
    created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME())
  );
END`;

    await pool2.request().query(createTableSql);
    console.log('Users table ready.');
    await pool2.close();
  } catch (err) {
    console.error('Error creating DB/table:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();