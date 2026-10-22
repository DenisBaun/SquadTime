const express = require('express');
const sql = require('mssql');
const { poolPromise } = require('../db');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const AVATAR_STORAGE_DIR = process.env.AVATAR_STORAGE_DIR
  ? (path.isAbsolute(process.env.AVATAR_STORAGE_DIR) ? process.env.AVATAR_STORAGE_DIR : path.resolve(process.cwd(), process.env.AVATAR_STORAGE_DIR))
  : path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(AVATAR_STORAGE_DIR)) {
  fs.mkdirSync(AVATAR_STORAGE_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_STORAGE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
      const userId = req.user && req.user.id ? req.user.id : 'user';
      cb(null, `${userId}-${Date.now()}-${Math.round(Math.random() * 1e6)}${safeExt}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

function mapProfileRow(row) {
  const visibility = row.library_visibility || (row.library_private ? 'friends' : 'everyone');
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name || null,
    avatar_url: row.avatar_url || null,
    avatar_path: row.avatar_path || null,
    bio: row.bio || null,
    library_private: visibility !== 'everyone',
    library_visibility: visibility,
    created_at: row.created_at
  };
}

async function buildUserProfileResponse(pool, viewerId, targetUserId) {
  const userResult = await pool.request().input('id', sql.Int, targetUserId)
    .query('SELECT id, username, display_name, avatar_url, bio, library_private, library_visibility, created_at FROM dbo.Users WHERE id=@id');
  if (!userResult.recordset || userResult.recordset.length === 0) return null;
  const profile = userResult.recordset[0];

  const friendship = await pool.request().input('a', sql.Int, viewerId).input('b', sql.Int, targetUserId)
    .query('SELECT TOP 1 1 as is_friend FROM dbo.Friends WHERE user_id=@a AND friend_id=@b');
  const isSelf = viewerId === targetUserId;
  const isFriend = friendship.recordset.length > 0;
  const visibility = profile.library_visibility || (profile.library_private ? 'friends' : 'everyone');
  const canViewLibrary = isSelf || visibility === 'everyone' || (visibility === 'friends' && isFriend);

  let library = [];
  if (canViewLibrary) {
    const libraryResult = await pool.request().input('uid', sql.Int, targetUserId)
      .query(`
SELECT
  l.id,
  g.rawg_id AS game_id,
  g.title,
  g.rawg_json,
  l.is_favorite,
  l.user_rating,
  l.created_at
FROM dbo.Library l
JOIN dbo.Games g ON g.id = l.game_ref_id
WHERE l.user_id=@uid
ORDER BY l.is_favorite DESC, l.created_at DESC
`);
    library = libraryResult.recordset.map((r) => ({
      rawg: (() => {
        if (r.rawg_json) {
          try {
            return JSON.parse(r.rawg_json);
          } catch (e) {
            return { id: r.game_id, name: r.title };
          }
        }
        return { id: r.game_id, name: r.title };
      })(),
      id: r.id,
      game_id: r.game_id,
      title: r.title,
      is_favorite: !!r.is_favorite,
      user_rating: r.user_rating
    }));
  }

  return {
    user: mapProfileRow(profile),
    viewer: {
      is_self: isSelf,
      is_friend: isFriend,
      can_view_library: canViewLibrary
    },
    library
  };
}

// GET /api/users/search?q=...
router.get('/search', auth, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);

  try {
    const pool = await poolPromise;
    const param = `%${q}%`;
    const result = await pool.request()
      .input('q', sql.NVarChar, param)
      .query('SELECT TOP(20) id, username, display_name, avatar_url, library_private, library_visibility FROM dbo.Users WHERE username LIKE @q OR email LIKE @q');

    return res.json(result.recordset.map(r => ({
      library_visibility: r.library_visibility || (r.library_private ? 'friends' : 'everyone'),
      id: r.id,
      username: r.username,
      display_name: r.display_name || null,
      avatar_url: r.avatar_url || null,
      library_private: (r.library_visibility || (r.library_private ? 'friends' : 'everyone')) !== 'everyone'
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/friends/request { toUserId }
router.post('/friends/request', auth, async (req, res) => {
  const fromUserId = req.user && req.user.id;
  const toUserId = req.body && req.body.toUserId;
  if (!fromUserId || !toUserId) return res.status(400).json({ message: 'Missing fields' });
  if (fromUserId === toUserId) return res.status(400).json({ message: 'Cannot friend yourself' });

  try {
    const pool = await poolPromise;
    // check already friends
    const checkFriend = await pool.request()
      .input('a', sql.Int, fromUserId)
      .input('b', sql.Int, toUserId)
      .query('SELECT 1 FROM dbo.Friends WHERE (user_id=@a AND friend_id=@b) OR (user_id=@b AND friend_id=@a)');
    if (checkFriend.recordset.length > 0) return res.status(409).json({ message: 'Already friends' });

    // check existing pending request
    const checkReq = await pool.request()
      .input('from', sql.Int, fromUserId)
      .input('to', sql.Int, toUserId)
      .query("SELECT id FROM dbo.FriendRequests WHERE from_user=@from AND to_user=@to AND status='pending'");
    if (checkReq.recordset.length > 0) return res.status(409).json({ message: 'Request already pending' });

    await pool.request()
      .input('from', sql.Int, fromUserId)
      .input('to', sql.Int, toUserId)
      .query("INSERT INTO dbo.FriendRequests (from_user, to_user, created_at, status) VALUES (@from, @to, GETUTCDATE(), 'pending')");

    return res.status(201).json({ message: 'Friend request sent' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/friends - list friends
router.get('/friends', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query('SELECT u.id, u.username, u.display_name, u.avatar_url, u.library_private, u.library_visibility FROM dbo.Friends f JOIN dbo.Users u ON f.friend_id = u.id WHERE f.user_id = @id');

    return res.json(result.recordset.map(r => ({
      library_visibility: r.library_visibility || (r.library_private ? 'friends' : 'everyone'),
      id: r.id,
      username: r.username,
      display_name: r.display_name || null,
      avatar_url: r.avatar_url || null,
      library_private: (r.library_visibility || (r.library_private ? 'friends' : 'everyone')) !== 'everyone'
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/requests - incoming friend requests
router.get('/requests', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id', sql.Int, userId)
      .query("SELECT fr.id, fr.from_user, u.username as from_username, fr.created_at FROM dbo.FriendRequests fr JOIN dbo.Users u ON fr.from_user = u.id WHERE fr.to_user=@id AND fr.status='pending'");

    return res.json(result.recordset);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/friends/accept { fromUserId }
router.post('/friends/accept', auth, async (req, res) => {
  const toUserId = req.user && req.user.id;
  const fromUserId = req.body && req.body.fromUserId;
  const fs = require('fs');
  const logLine = `[${new Date().toISOString()}] /api/users/friends/accept called, req.user=${JSON.stringify(req.user)} body=${JSON.stringify(req.body)}\n`;
  try { fs.appendFileSync('server/accept_debug.log', logLine); } catch(e) { console.warn('Could not write debug log', e); }
  console.log('[DEBUG] /api/users/friends/accept called, req.user=', req.user, 'body=', req.body);
  if (!fromUserId || !toUserId) {
    const missingLine = `[${new Date().toISOString()}] Missing fields in accept request; fromUserId=${fromUserId} toUserId=${toUserId}\n`;
    try { fs.appendFileSync('server/accept_debug.log', missingLine); } catch(e) {}
    console.log('[DEBUG] Missing fields in accept request; fromUserId=', fromUserId, 'toUserId=', toUserId);
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const pool = await poolPromise;
    const check = await pool.request()
      .input('from', sql.Int, fromUserId)
      .input('to', sql.Int, toUserId)
      .query("SELECT id FROM dbo.FriendRequests WHERE from_user=@from AND to_user=@to AND status='pending'");
    console.log('[DEBUG] FriendRequests check recordcount=', (check.recordset || []).length);
    if (check.recordset.length === 0) {
      console.log('[DEBUG] No pending friend request found for from=', fromUserId, 'to=', toUserId);
      return res.status(404).json({ message: 'Request not found' });
    }

    // create friendship both directions
    const tx = pool.transaction();
    await tx.begin();
    try {
      await tx.request().input('a', sql.Int, toUserId).input('b', sql.Int, fromUserId)
        .query('INSERT INTO dbo.Friends (user_id, friend_id, created_at) VALUES (@a, @b, GETUTCDATE())');
      await tx.request().input('a', sql.Int, fromUserId).input('b', sql.Int, toUserId)
        .query('INSERT INTO dbo.Friends (user_id, friend_id, created_at) VALUES (@a, @b, GETUTCDATE())');

      await tx.request().input('from', sql.Int, fromUserId).input('to', sql.Int, toUserId)
        .query("UPDATE dbo.FriendRequests SET status='accepted' WHERE from_user=@from AND to_user=@to");

      await tx.commit();
      console.log('[DEBUG] Friend request accepted and committed');
      return res.json({ message: 'Friend request accepted' });
    } catch (e) {
      await tx.rollback();
      console.error('[DEBUG] Transaction error during accept:', e);
      try { fs.appendFileSync('server/accept_debug.log', `[${new Date().toISOString()}] TRANSACTION ERROR: ${e.stack || e}\n`); } catch (ee) {}
      throw e;
    }
  } catch (err) {
    console.error('[DEBUG] Error in accept handler:', err);
    try { fs.appendFileSync('server/accept_debug.log', `[${new Date().toISOString()}] HANDLER ERROR: ${err.stack || err}\n`); } catch (ee) {}
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/friends/remove { userId }
router.post('/friends/remove', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const other = req.body && req.body.userId;
  if (!me || !other) return res.status(400).json({ message: 'Missing fields' });
  try {
    const pool = await poolPromise;
    await pool.request().input('a', sql.Int, me).input('b', sql.Int, other)
      .query('DELETE FROM dbo.Friends WHERE (user_id=@a AND friend_id=@b) OR (user_id=@b AND friend_id=@a)');
    return res.json({ message: 'Friend removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/me/settings
router.get('/me/settings', auth, async (req, res) => {
  const me = req.user && req.user.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('id', sql.Int, me)
      .query('SELECT id, username, email, display_name, avatar_url, avatar_path, bio, library_private, library_visibility, created_at FROM dbo.Users WHERE id=@id');
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const row = result.recordset[0];
    const visibility = row.library_visibility || (row.library_private ? 'friends' : 'everyone');
    return res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      display_name: row.display_name || '',
      avatar_url: row.avatar_url || '',
      avatar_path: row.avatar_path || '',
      bio: row.bio || '',
      library_private: visibility !== 'everyone',
      library_visibility: visibility,
      created_at: row.created_at
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/users/me/settings
router.patch('/me/settings', auth, async (req, res) => {
  const me = req.user && req.user.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  const { display_name, avatar_url, bio, library_private, library_visibility } = req.body || {};
  const hasDisplayName = display_name !== undefined;
  const hasAvatar = avatar_url !== undefined;
  const hasBio = bio !== undefined;
  const hasPrivacy = library_private !== undefined || library_visibility !== undefined;
  if (!hasDisplayName && !hasAvatar && !hasBio && !hasPrivacy) return res.status(400).json({ message: 'No changes provided' });
  if (hasDisplayName && typeof display_name !== 'string') return res.status(400).json({ message: 'Invalid display name' });
  if (hasDisplayName && display_name.trim().length > 60) return res.status(400).json({ message: 'Display name too long' });
  if (hasAvatar && typeof avatar_url !== 'string') return res.status(400).json({ message: 'Invalid avatar url' });
  if (hasAvatar && avatar_url.trim().length > 500) return res.status(400).json({ message: 'Avatar URL too long' });
  if (hasBio && typeof bio !== 'string') return res.status(400).json({ message: 'Invalid bio' });
  if (hasBio && bio.trim().length > 500) return res.status(400).json({ message: 'Bio too long' });
  if (library_visibility !== undefined && !['nobody', 'friends', 'everyone'].includes(library_visibility)) {
    return res.status(400).json({ message: 'Invalid library visibility' });
  }
  if (library_visibility === undefined && library_private !== undefined && typeof library_private !== 'boolean') {
    return res.status(400).json({ message: 'Invalid privacy value' });
  }

  try {
    const pool = await poolPromise;
    const nextVisibility = library_visibility !== undefined
      ? library_visibility
      : (library_private === undefined ? null : (library_private ? 'friends' : 'everyone'));
    const nextPrivate = nextVisibility ? (nextVisibility !== 'everyone') : null;

    await pool.request()
      .input('id', sql.Int, me)
      .input('has_display_name', sql.Bit, hasDisplayName ? 1 : 0)
      .input('display_name', sql.NVarChar(60), hasDisplayName ? display_name.trim() : null)
      .input('has_avatar_url', sql.Bit, hasAvatar ? 1 : 0)
      .input('avatar_url', sql.NVarChar(500), hasAvatar ? avatar_url.trim() : null)
      .input('has_bio', sql.Bit, hasBio ? 1 : 0)
      .input('bio', sql.NVarChar(500), hasBio ? bio.trim() : null)
      .input('has_library_private', sql.Bit, hasPrivacy ? 1 : 0)
      .input('library_private', sql.Bit, hasPrivacy && nextPrivate !== null ? (nextPrivate ? 1 : 0) : null)
      .input('library_visibility', sql.NVarChar(20), hasPrivacy ? nextVisibility : null)
      .query(`
UPDATE dbo.Users
SET
  display_name = CASE WHEN @has_display_name=1 THEN @display_name ELSE display_name END,
  avatar_url = CASE WHEN @has_avatar_url=1 THEN @avatar_url ELSE avatar_url END,
  bio = CASE WHEN @has_bio=1 THEN @bio ELSE bio END,
  library_private = CASE WHEN @has_library_private=1 THEN @library_private ELSE library_private END,
  library_visibility = CASE WHEN @has_library_private=1 THEN @library_visibility ELSE library_visibility END
WHERE id=@id
`);

    const updated = await pool.request().input('id', sql.Int, me)
      .query('SELECT id, username, email, display_name, avatar_url, avatar_path, bio, library_private, library_visibility FROM dbo.Users WHERE id=@id');
    const row = updated.recordset[0];
    const visibility = row.library_visibility || (row.library_private ? 'friends' : 'everyone');
    return res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      display_name: row.display_name || '',
      avatar_url: row.avatar_url || '',
      avatar_path: row.avatar_path || '',
      bio: row.bio || '',
      library_private: visibility !== 'everyone',
      library_visibility: visibility
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/me/change-password
router.post('/me/change-password', auth, async (req, res) => {
  const me = req.user && req.user.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing fields' });
  if (typeof newPassword !== 'string' || newPassword.length < 6) return res.status(400).json({ message: 'New password must be at least 6 chars' });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('id', sql.Int, me)
      .query('SELECT password_hash FROM dbo.Users WHERE id=@id');
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, result.recordset[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Current password is invalid' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.request().input('id', sql.Int, me).input('pw', sql.NVarChar(500), newHash)
      .query('UPDATE dbo.Users SET password_hash=@pw WHERE id=@id');
    return res.json({ message: 'Password updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/me/avatar-upload (multipart form-data with field "avatar")
router.post('/me/avatar-upload', auth, upload.single('avatar'), async (req, res) => {
  const me = req.user && req.user.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const newAvatarPath = path.resolve(req.file.path);
  const newAvatarUrl = `/api/users/avatar/${me}`;

  try {
    const pool = await poolPromise;
    const current = await pool.request().input('id', sql.Int, me)
      .query('SELECT avatar_url, avatar_path FROM dbo.Users WHERE id=@id');
    if (!current.recordset || current.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const oldAvatarPath = current.recordset[0].avatar_path;

    await pool.request()
      .input('id', sql.Int, me)
      .input('avatar_url', sql.NVarChar(500), newAvatarUrl)
      .input('avatar_path', sql.NVarChar(1000), newAvatarPath)
      .query('UPDATE dbo.Users SET avatar_url=@avatar_url, avatar_path=@avatar_path WHERE id=@id');

    if (oldAvatarPath && typeof oldAvatarPath === 'string' && oldAvatarPath !== newAvatarPath && fs.existsSync(oldAvatarPath)) {
      try { fs.unlinkSync(oldAvatarPath); } catch (_err) { }
    }

    return res.json({ avatar_url: newAvatarUrl, avatar_path: newAvatarPath });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/avatar/:id - serve avatar via path stored in DB
router.get('/avatar/:id', async (req, res) => {
  const userId = Number(req.params.id);
  if (!userId) return res.status(400).json({ message: 'Invalid user id' });
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('id', sql.Int, userId)
      .query('SELECT avatar_path FROM dbo.Users WHERE id=@id');
    if (!result.recordset || result.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const avatarPath = result.recordset[0].avatar_path;
    if (!avatarPath || typeof avatarPath !== 'string') return res.status(404).json({ message: 'Avatar not found' });
    const resolvedPath = path.resolve(avatarPath);
    if (!fs.existsSync(resolvedPath)) return res.status(404).json({ message: 'Avatar file not found' });
    return res.sendFile(resolvedPath);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/:id/profile
router.get('/:id/profile', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const userId = Number(req.params.id);
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!userId) return res.status(400).json({ message: 'Invalid user id' });
  try {
    const pool = await poolPromise;
    const payload = await buildUserProfileResponse(pool, me, userId);
    if (!payload) return res.status(404).json({ message: 'User not found' });
    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/users/by-username/:username/profile
router.get('/by-username/:username/profile', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const username = (req.params.username || '').toString().trim();
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!username) return res.status(400).json({ message: 'Invalid username' });
  try {
    const pool = await poolPromise;
    const lookup = await pool.request().input('username', sql.NVarChar(255), username)
      .query('SELECT id FROM dbo.Users WHERE username=@username');
    if (!lookup.recordset || lookup.recordset.length === 0) return res.status(404).json({ message: 'User not found' });
    const targetId = lookup.recordset[0].id;
    const payload = await buildUserProfileResponse(pool, me, targetId);
    if (!payload) return res.status(404).json({ message: 'User not found' });
    return res.json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
