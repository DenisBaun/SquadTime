// Run this once to create Library table
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
    console.log('Connected to DB, creating Library table if not exists...');

    const createLibrary = `
IF OBJECT_ID('dbo.Games', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Games (
    id INT IDENTITY(1,1) PRIMARY KEY,
    rawg_id INT NOT NULL UNIQUE,
    slug NVARCHAR(255) NULL,
    title NVARCHAR(500) NOT NULL,
    cover_image_url NVARCHAR(1000) NULL,
    released NVARCHAR(40) NULL,
    rating DECIMAL(4,2) NULL,
    rawg_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME())
  );
END
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Library' AND xtype='U')
CREATE TABLE dbo.Library (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
      game_ref_id INT NOT NULL,
      is_favorite BIT NOT NULL DEFAULT (0),
      user_rating INT NULL,
  created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT FK_Library_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id),
      CONSTRAINT FK_Library_Game FOREIGN KEY (game_ref_id) REFERENCES dbo.Games(id)
    );
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Library_UserGameRef' AND object_id=OBJECT_ID('dbo.Library'))
      CREATE UNIQUE INDEX IX_Library_UserGameRef ON dbo.Library (user_id, game_ref_id);
    `;

    await pool.request().query(createLibrary);

    console.log('Library table ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error creating Library table:', err);
    process.exit(1);
  }
}

run();
