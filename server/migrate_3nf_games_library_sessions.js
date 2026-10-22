// Run once to migrate Games/Library/Sessions to 3NF relations
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
    console.log('Connected to DB, running 3NF migration...');

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
END
`);

    await pool.request().query(`
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
END
`);

    await pool.request().query(`
IF COL_LENGTH('dbo.Library', 'game_ref_id') IS NULL
  ALTER TABLE dbo.Library ADD game_ref_id INT NULL;
`);
    await pool.request().query(`
IF COL_LENGTH('dbo.Library', 'game_id') IS NOT NULL
BEGIN
  UPDATE l
  SET l.game_ref_id = g.id
  FROM dbo.Library l
  JOIN dbo.Games g ON g.rawg_id = l.game_id
  WHERE l.game_ref_id IS NULL;
END
`);

    await pool.request().query(`
IF COL_LENGTH('dbo.Sessions', 'game_ref_id') IS NULL
  ALTER TABLE dbo.Sessions ADD game_ref_id INT NULL;
`);
    await pool.request().query(`
IF COL_LENGTH('dbo.Sessions', 'game_id') IS NOT NULL
BEGIN
  UPDATE s
  SET s.game_ref_id = g.id
  FROM dbo.Sessions s
  JOIN dbo.Games g ON g.rawg_id = TRY_CONVERT(INT, s.game_id)
  WHERE s.game_ref_id IS NULL
    AND TRY_CONVERT(INT, s.game_id) IS NOT NULL;
END
`);

    await pool.request().query(`
IF EXISTS (SELECT 1 FROM dbo.Library WHERE game_ref_id IS NULL)
  THROW 51000, 'Library rows with NULL game_ref_id found; aborting column cleanup.', 1;
`);

    await pool.request().query(`
IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Library')
    AND name = 'game_ref_id'
    AND is_nullable = 1
)
BEGIN
  IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Library_GameRef')
    ALTER TABLE dbo.Library DROP CONSTRAINT FK_Library_GameRef;
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Library_UserGameRef' AND object_id=OBJECT_ID('dbo.Library'))
    DROP INDEX IX_Library_UserGameRef ON dbo.Library;
  ALTER TABLE dbo.Library ALTER COLUMN game_ref_id INT NOT NULL;
END
`);

    await pool.request().query(`
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Library_GameRef')
  ALTER TABLE dbo.Library ADD CONSTRAINT FK_Library_GameRef FOREIGN KEY (game_ref_id) REFERENCES dbo.Games(id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Library_UserGameRef' AND object_id=OBJECT_ID('dbo.Library'))
  CREATE UNIQUE INDEX IX_Library_UserGameRef ON dbo.Library(user_id, game_ref_id);
`);

    await pool.request().query(`
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Library_UserGame' AND object_id=OBJECT_ID('dbo.Library'))
  DROP INDEX IX_Library_UserGame ON dbo.Library;
`);

    await pool.request().query(`
IF COL_LENGTH('dbo.Library', 'game_id') IS NOT NULL
  ALTER TABLE dbo.Library DROP COLUMN game_id;
IF COL_LENGTH('dbo.Library', 'title') IS NOT NULL
  ALTER TABLE dbo.Library DROP COLUMN title;
IF COL_LENGTH('dbo.Library', 'rawg_json') IS NOT NULL
  ALTER TABLE dbo.Library DROP COLUMN rawg_json;
`);

    await pool.request().query(`
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Sessions_GameRef')
  ALTER TABLE dbo.Sessions ADD CONSTRAINT FK_Sessions_GameRef FOREIGN KEY (game_ref_id) REFERENCES dbo.Games(id);
`);
    await pool.request().query(`
IF COL_LENGTH('dbo.Sessions', 'game_id') IS NOT NULL
  ALTER TABLE dbo.Sessions DROP COLUMN game_id;
IF COL_LENGTH('dbo.Sessions', 'rawg_json') IS NOT NULL
  ALTER TABLE dbo.Sessions DROP COLUMN rawg_json;
`);

    console.log('3NF migration completed.');
    await pool.close();
  } catch (err) {
    console.error('3NF migration failed:', err);
    process.exit(1);
  }
}

run();
