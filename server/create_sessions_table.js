// Run once to create Sessions and SessionInvites tables
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
    console.log('Connected to DB, creating sessions tables if not exists...');

    const createSessions = `
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
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Sessions' AND xtype='U')
CREATE TABLE dbo.Sessions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  creator INT NOT NULL,
  game_ref_id INT NULL,
  title NVARCHAR(255) NULL,
  description NVARCHAR(1000) NULL,
  start_at DATETIME2 NOT NULL,
  end_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT FK_Sessions_Creator FOREIGN KEY (creator) REFERENCES dbo.Users(id),
  CONSTRAINT FK_Sessions_Game FOREIGN KEY (game_ref_id) REFERENCES dbo.Games(id)
);
`;

    const createInvites = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SessionInvites' AND xtype='U')
CREATE TABLE dbo.SessionInvites (
  id INT IDENTITY(1,1) PRIMARY KEY,
  session_id INT NOT NULL,
  to_user INT NOT NULL,
  status NVARCHAR(50) NOT NULL DEFAULT ('pending'),
  response_reason NVARCHAR(1000) NULL,
  responded_at DATETIME2 NULL,
  created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT FK_SI_Session FOREIGN KEY (session_id) REFERENCES dbo.Sessions(id),
  CONSTRAINT FK_SI_ToUser FOREIGN KEY (to_user) REFERENCES dbo.Users(id)
);
`;

    await pool.request().query(createSessions);
    await pool.request().query(createInvites);

    console.log('Sessions tables ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error creating sessions tables:', err);
    process.exit(1);
  }
}

run();
