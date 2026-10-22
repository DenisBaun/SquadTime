// Run once to create Games table if not exists
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
    console.log('Connected to DB, creating Games table if not exists...');
    await pool.request().query(`
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
`);
    await pool.request().query(`
IF COL_LENGTH('dbo.Library', 'game_id') IS NOT NULL
BEGIN
  INSERT INTO dbo.Games (rawg_id, title, rawg_json, created_at, updated_at)
  SELECT l.game_id, MAX(COALESCE(l.title, CONCAT('Game ', l.game_id))), MAX(l.rawg_json), SYSUTCDATETIME(), SYSUTCDATETIME()
  FROM dbo.Library l
  LEFT JOIN dbo.Games g ON g.rawg_id = l.game_id
  WHERE g.id IS NULL
  GROUP BY l.game_id;
END;

IF COL_LENGTH('dbo.Sessions', 'game_id') IS NOT NULL
BEGIN
  INSERT INTO dbo.Games (rawg_id, title, rawg_json, created_at, updated_at)
  SELECT src.rawg_id, src.title, src.rawg_json, SYSUTCDATETIME(), SYSUTCDATETIME()
  FROM (
    SELECT
      TRY_CONVERT(INT, s.game_id) AS rawg_id,
      MAX(COALESCE(s.title, CONCAT('Game ', TRY_CONVERT(INT, s.game_id)))) AS title,
      MAX(s.rawg_json) AS rawg_json
    FROM dbo.Sessions s
    WHERE TRY_CONVERT(INT, s.game_id) IS NOT NULL
    GROUP BY TRY_CONVERT(INT, s.game_id)
  ) src
  LEFT JOIN dbo.Games g ON g.rawg_id = src.rawg_id
  WHERE g.id IS NULL;
END;
`);
    console.log('Games table ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error creating Games table:', err);
    process.exit(1);
  }
}

run();
