// Run once to ensure each session creator exists in SessionInvites as accepted participant
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
    console.log('Connected to DB, backfilling creator session invites...');
    await pool.request().query(`
INSERT INTO dbo.SessionInvites (session_id, to_user, status, responded_at)
SELECT s.id, s.creator, 'accepted', GETUTCDATE()
FROM dbo.Sessions s
LEFT JOIN dbo.SessionInvites si ON si.session_id = s.id AND si.to_user = s.creator
WHERE si.id IS NULL;
`);
    console.log('Creator session invites backfilled.');
    await pool.close();
  } catch (err) {
    console.error('Backfill failed:', err);
    process.exit(1);
  }
}

run();
