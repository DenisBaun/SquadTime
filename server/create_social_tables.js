// Run this once to create FriendRequests and Friends tables
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
    console.log('Connected to DB, creating tables if not exists...');

    const createFriendRequests = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='FriendRequests' AND xtype='U')
CREATE TABLE dbo.FriendRequests (
  id INT IDENTITY(1,1) PRIMARY KEY,
  from_user INT NOT NULL,
  to_user INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
  status NVARCHAR(50) NOT NULL DEFAULT ('pending'),
  CONSTRAINT FK_FR_FromUser FOREIGN KEY (from_user) REFERENCES dbo.Users(id),
  CONSTRAINT FK_FR_ToUser FOREIGN KEY (to_user) REFERENCES dbo.Users(id)
);
`;

    const createFriends = `
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Friends' AND xtype='U')
CREATE TABLE dbo.Friends (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  friend_id INT NOT NULL,
  created_at DATETIME2 NOT NULL DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT FK_F_User FOREIGN KEY (user_id) REFERENCES dbo.Users(id),
  CONSTRAINT FK_F_Friend FOREIGN KEY (friend_id) REFERENCES dbo.Users(id)
);
CREATE UNIQUE INDEX IDX_Friends_UniquePair ON dbo.Friends (user_id, friend_id);
`;

    await pool.request().query(createFriendRequests);
    await pool.request().query(createFriends);

    console.log('Tables ensured.');
    await pool.close();
  } catch (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
}

run();
