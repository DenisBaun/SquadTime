const express = require('express');
const sql = require('mssql');
const { poolPromise } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

async function upsertGame(pool, game) {
  if (!game || !game.id) throw new Error('Missing game data');
  const rawgId = Number(game.id);
  if (!Number.isInteger(rawgId) || rawgId <= 0) throw new Error('Invalid game id');
  const title = game.name || game.title || 'Unknown';
  const rawgJson = JSON.stringify(game);

  await pool.request()
    .input('rawg_id', sql.Int, rawgId)
    .input('slug', sql.NVarChar(255), game.slug || null)
    .input('title', sql.NVarChar(500), title)
    .input('cover_image_url', sql.NVarChar(1000), game.background_image || null)
    .input('released', sql.NVarChar(40), game.released || null)
    .input('rating', sql.Decimal(4, 2), typeof game.rating === 'number' ? game.rating : null)
    .input('rawg_json', sql.NVarChar(sql.MAX), rawgJson)
    .query(`
UPDATE dbo.Games
SET
  slug=@slug,
  title=@title,
  cover_image_url=@cover_image_url,
  released=@released,
  rating=@rating,
  rawg_json=@rawg_json,
  updated_at=SYSUTCDATETIME()
WHERE rawg_id=@rawg_id;

IF @@ROWCOUNT = 0
BEGIN
  INSERT INTO dbo.Games (rawg_id, slug, title, cover_image_url, released, rating, rawg_json, created_at, updated_at)
  VALUES (@rawg_id, @slug, @title, @cover_image_url, @released, @rating, @rawg_json, SYSUTCDATETIME(), SYSUTCDATETIME());
END
`);

  const gameRef = await pool.request()
    .input('rawg_id', sql.Int, rawgId)
    .query('SELECT TOP 1 id FROM dbo.Games WHERE rawg_id=@rawg_id');
  if (!gameRef.recordset || gameRef.recordset.length === 0) throw new Error('Game upsert failed');
  return gameRef.recordset[0].id;
}

async function resolveGameRefId(pool, gameIdRawg, rawgJsonString) {
  if (rawgJsonString) {
    let parsed;
    try {
      parsed = JSON.parse(rawgJsonString);
    } catch (e) {
      throw new Error('Invalid rawg_json payload');
    }
    return upsertGame(pool, parsed);
  }

  if (!gameIdRawg) return null;
  const rawgId = Number(gameIdRawg);
  if (!Number.isInteger(rawgId) || rawgId <= 0) throw new Error('Invalid game id');

  const existing = await pool.request()
    .input('rawg_id', sql.Int, rawgId)
    .query('SELECT TOP 1 id FROM dbo.Games WHERE rawg_id=@rawg_id');
  if (existing.recordset && existing.recordset.length > 0) {
    return existing.recordset[0].id;
  }

  await pool.request()
    .input('rawg_id', sql.Int, rawgId)
    .input('title', sql.NVarChar(500), `Game ${rawgId}`)
    .query('INSERT INTO dbo.Games (rawg_id, title, created_at, updated_at) VALUES (@rawg_id, @title, SYSUTCDATETIME(), SYSUTCDATETIME())');
  const created = await pool.request()
    .input('rawg_id', sql.Int, rawgId)
    .query('SELECT TOP 1 id FROM dbo.Games WHERE rawg_id=@rawg_id');
  return created.recordset[0].id;
}

const sessionSelect = `
SELECT
  s.id,
  s.creator,
  g.rawg_id AS game_id,
  s.title,
  s.description,
  s.start_at,
  s.end_at,
  g.rawg_json AS rawg_json,
  s.created_at,
  g.rawg_json as game_rawg_json,
  g.cover_image_url as game_cover_image_url,
  g.released as game_released,
  g.rating as game_rating,
  g.title as game_title
FROM dbo.Sessions s
LEFT JOIN dbo.Games g ON g.id = s.game_ref_id
`;

// POST /api/sessions - create a session and invite users
router.post('/', auth, async (req, res) => {
  const creator = req.user && req.user.id;
  const { game_id, title, description, start_at, end_at, invitedUserIds, rawg_json } = req.body;
  if (!creator || !start_at) return res.status(400).json({ message: 'Missing fields' });

  try {
    const pool = await poolPromise;
    const gameRefId = await resolveGameRefId(pool, game_id, rawg_json || null);

    const insert = await pool.request()
      .input('creator', sql.Int, creator)
      .input('game_ref_id', sql.Int, gameRefId)
      .input('title', sql.NVarChar(255), title || null)
      .input('description', sql.NVarChar(1000), description || null)
      .input('start_at', sql.DateTime2, start_at)
      .input('end_at', sql.DateTime2, end_at || null)
      .query('INSERT INTO dbo.Sessions (creator, game_ref_id, title, description, start_at, end_at) VALUES (@creator, @game_ref_id, @title, @description, @start_at, @end_at); SELECT SCOPE_IDENTITY() as id');

    const sessionId = Math.floor(insert.recordset[0].id);

    // creator is also a participant by default
    await pool.request()
      .input('session_id', sql.Int, sessionId)
      .input('to_user', sql.Int, creator)
      .query("IF NOT EXISTS (SELECT 1 FROM dbo.SessionInvites WHERE session_id=@session_id AND to_user=@to_user) INSERT INTO dbo.SessionInvites (session_id, to_user, status, responded_at) VALUES (@session_id, @to_user, 'accepted', GETUTCDATE())");

    if (Array.isArray(invitedUserIds) && invitedUserIds.length > 0) {
      const tx = pool.transaction();
      await tx.begin();
      try {
        for (const uid of invitedUserIds) {
          await tx.request().input('session_id', sql.Int, sessionId).input('to_user', sql.Int, uid)
            .query("INSERT INTO dbo.SessionInvites (session_id, to_user) VALUES (@session_id, @to_user)");
        }
        await tx.commit();
      } catch (e) {
        await tx.rollback();
        throw e;
      }
    }

    return res.status(201).json({ message: 'Session created', id: sessionId });
  } catch (err) {
    console.error('Error creating session:', err);
    if (err && (err.message === 'Invalid rawg_json payload' || err.message === 'Invalid game id' || err.message === 'Missing game data')) {
      return res.status(400).json({ message: 'Invalid game payload' });
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/sessions - sessions relevant to current user (owned or accepted invite)
router.get('/', auth, async (req, res) => {
  const me = req.user && req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('me', sql.Int, me)
      .query(`
${sessionSelect}
WHERE
  s.creator=@me
  OR EXISTS (
    SELECT 1
    FROM dbo.SessionInvites si
    WHERE si.session_id = s.id
      AND si.to_user = @me
      AND si.status = 'accepted'
  )
ORDER BY s.start_at DESC
`);
    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/sessions/invites - pending incoming invites for current user
router.get('/invites', auth, async (req, res) => {
  const me = req.user && req.user.id;
  try {
    const pool = await poolPromise;
    const result = await pool.request().input('me', sql.Int, me)
      .query(`
SELECT
  si.id as invite_id,
  si.session_id,
  si.status,
  si.responded_at,
  s.creator,
  g.rawg_id as game_id,
  s.title,
  s.description,
  s.start_at,
  s.end_at,
  g.rawg_json as rawg_json,
  u.username as creator_username,
  u.display_name as creator_display_name,
  u.avatar_url as creator_avatar_url
FROM dbo.SessionInvites si
JOIN dbo.Sessions s ON si.session_id = s.id
JOIN dbo.Users u ON s.creator = u.id
LEFT JOIN dbo.Games g ON g.id = s.game_ref_id
WHERE si.to_user=@me
  AND si.status='pending'
ORDER BY s.start_at DESC
`);
    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching invites:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/sessions/:id - details for a session including invites
router.get('/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const pool = await poolPromise;
    const sessionRes = await pool.request().input('id', sql.Int, id)
      .query(`
SELECT
  s.id,
  s.creator,
  g.rawg_id AS game_id,
  s.title,
  s.description,
  s.start_at,
  s.end_at,
  g.rawg_json AS rawg_json,
  s.created_at,
  u.username as creator_username,
  g.rawg_json as game_rawg_json,
  g.cover_image_url as game_cover_image_url,
  g.released as game_released,
  g.rating as game_rating,
  g.title as game_title
FROM dbo.Sessions s
JOIN dbo.Users u ON s.creator = u.id
LEFT JOIN dbo.Games g ON g.id = s.game_ref_id
WHERE s.id=@id
`);
    if (!sessionRes.recordset || sessionRes.recordset.length === 0) return res.status(404).json({ message: 'Session not found' });
    const session = sessionRes.recordset[0];

    const invitesRes = await pool.request().input('id', sql.Int, id)
      .query('SELECT si.id as invite_id, si.to_user, si.status, si.response_reason, si.responded_at, u.username FROM dbo.SessionInvites si JOIN dbo.Users u ON si.to_user = u.id WHERE si.session_id=@id');
    const invites = (invitesRes.recordset || []).map((inv) => ({
      ...inv,
      is_creator: inv.to_user === session.creator
    }));
    if (!invites.some((inv) => inv.to_user === session.creator)) {
      invites.unshift({
        invite_id: null,
        to_user: session.creator,
        status: 'accepted',
        response_reason: null,
        responded_at: null,
        username: session.creator_username,
        is_creator: true
      });
    }
    return res.json({ session, invites });
  } catch (err) {
    console.error('Error fetching session details:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/sessions/:id - update session (creator only)
router.patch('/:id', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const id = Number(req.params.id);
  const body = req.body || {};
  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title');
  const hasDescription = Object.prototype.hasOwnProperty.call(body, 'description');
  const hasStartAt = Object.prototype.hasOwnProperty.call(body, 'start_at');
  const hasEndAt = Object.prototype.hasOwnProperty.call(body, 'end_at');

  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!id) return res.status(400).json({ message: 'Invalid session id' });
  if (!hasTitle && !hasDescription && !hasStartAt && !hasEndAt) return res.status(400).json({ message: 'No changes provided' });
  if (hasStartAt && !body.start_at) return res.status(400).json({ message: 'start_at is required when provided' });

  try {
    const pool = await poolPromise;
    const ownerRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT creator FROM dbo.Sessions WHERE id=@id');
    if (!ownerRes.recordset || ownerRes.recordset.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (ownerRes.recordset[0].creator !== me) return res.status(403).json({ message: 'Only creator can edit this session' });

    await pool.request()
      .input('id', sql.Int, id)
      .input('has_title', sql.Bit, hasTitle ? 1 : 0)
      .input('title', sql.NVarChar(255), hasTitle ? (body.title || null) : null)
      .input('has_description', sql.Bit, hasDescription ? 1 : 0)
      .input('description', sql.NVarChar(1000), hasDescription ? (body.description || null) : null)
      .input('has_start_at', sql.Bit, hasStartAt ? 1 : 0)
      .input('start_at', sql.DateTime2, hasStartAt ? body.start_at : null)
      .input('has_end_at', sql.Bit, hasEndAt ? 1 : 0)
      .input('end_at', sql.DateTime2, hasEndAt ? (body.end_at || null) : null)
      .query(`
UPDATE dbo.Sessions
SET
  title = CASE WHEN @has_title=1 THEN @title ELSE title END,
  description = CASE WHEN @has_description=1 THEN @description ELSE description END,
  start_at = CASE WHEN @has_start_at=1 THEN @start_at ELSE start_at END,
  end_at = CASE WHEN @has_end_at=1 THEN @end_at ELSE end_at END
WHERE id=@id
`);

    const updated = await pool.request().input('id', sql.Int, id).query(`${sessionSelect} WHERE s.id=@id`);
    return res.json({ message: 'Session updated', session: updated.recordset[0] });
  } catch (err) {
    console.error('Error updating session:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/sessions/:id - delete session (creator only)
router.delete('/:id', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const id = Number(req.params.id);
  const { confirmPhrase, confirmTitle } = req.body || {};
  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!id) return res.status(400).json({ message: 'Invalid session id' });
  if (confirmPhrase !== 'LÖSCHEN') {
    return res.status(400).json({ message: 'Deletion confirmation phrase invalid' });
  }

  try {
    const pool = await poolPromise;
    const ownerRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT creator, title FROM dbo.Sessions WHERE id=@id');
    if (!ownerRes.recordset || ownerRes.recordset.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (ownerRes.recordset[0].creator !== me) return res.status(403).json({ message: 'Only creator can delete this session' });
    const existingTitle = ownerRes.recordset[0].title;
    if (existingTitle && confirmTitle !== existingTitle) {
      return res.status(400).json({ message: 'Session title confirmation does not match' });
    }

    const tx = pool.transaction();
    await tx.begin();
    try {
      await tx.request().input('id', sql.Int, id).query('DELETE FROM dbo.SessionInvites WHERE session_id=@id');
      const delSession = await tx.request().input('id', sql.Int, id).query('DELETE FROM dbo.Sessions WHERE id=@id; SELECT @@ROWCOUNT as removed');
      if (!delSession.recordset || !delSession.recordset[0] || delSession.recordset[0].removed === 0) {
        throw new Error('Session delete failed');
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return res.json({ message: 'Session deleted' });
  } catch (err) {
    console.error('Error deleting session:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/sessions/:id/invites/:inviteId - remove participant/invite (creator only)
router.delete('/:id/invites/:inviteId', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const id = Number(req.params.id);
  const inviteId = Number(req.params.inviteId);

  if (!me) return res.status(401).json({ message: 'Unauthorized' });
  if (!id || !inviteId) return res.status(400).json({ message: 'Invalid ids' });

  try {
    const pool = await poolPromise;
    const ownerRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT creator FROM dbo.Sessions WHERE id=@id');
    if (!ownerRes.recordset || ownerRes.recordset.length === 0) return res.status(404).json({ message: 'Session not found' });
    if (ownerRes.recordset[0].creator !== me) return res.status(403).json({ message: 'Only creator can remove participants' });

    const del = await pool.request()
      .input('id', sql.Int, id)
      .input('invite_id', sql.Int, inviteId)
      .query('DELETE FROM dbo.SessionInvites WHERE session_id=@id AND id=@invite_id; SELECT @@ROWCOUNT as removed');
    if (!del.recordset || !del.recordset[0] || del.recordset[0].removed === 0) return res.status(404).json({ message: 'Participant invite not found' });

    return res.json({ message: 'Participant removed' });
  } catch (err) {
    console.error('Error removing participant:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/sessions/:id/respond { status: 'accepted'|'declined' }
router.post('/:id/respond', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const sessionId = Number(req.params.id);
  const { status, reason } = req.body || {};
  if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
  if (reason !== undefined && typeof reason !== 'string') return res.status(400).json({ message: 'Invalid reason' });
  if (typeof reason === 'string' && reason.length > 1000) return res.status(400).json({ message: 'Reason too long' });

  try {
    const pool = await poolPromise;
    const check = await pool.request().input('sid', sql.Int, sessionId).input('me', sql.Int, me)
      .query('SELECT id, status FROM dbo.SessionInvites WHERE session_id=@sid AND to_user=@me');
    if (!check.recordset || check.recordset.length === 0) return res.status(404).json({ message: 'Invite not found' });

    const updateRes = await pool.request()
      .input('sid', sql.Int, sessionId)
      .input('me', sql.Int, me)
      .input('status', sql.NVarChar, status)
      .input('reason', sql.NVarChar(1000), typeof reason === 'string' && reason.trim() ? reason.trim() : null)
      .query('UPDATE dbo.SessionInvites SET status=@status, response_reason=@reason, responded_at=GETUTCDATE() WHERE session_id=@sid AND to_user=@me; SELECT @@ROWCOUNT as updated');
    if (updateRes.recordset && updateRes.recordset[0] && updateRes.recordset[0].updated === 0) return res.status(500).json({ message: 'No rows updated' });

    return res.json({ message: 'Responded' });
  } catch (err) {
    console.error('Error responding to invite:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/sessions/:id/leave { reason?: string } - invited/accepted user leaves session
router.post('/:id/leave', auth, async (req, res) => {
  const me = req.user && req.user.id;
  const sessionId = Number(req.params.id);
  const { reason } = req.body || {};
  if (!me || !sessionId) return res.status(400).json({ message: 'Missing fields' });
  if (reason !== undefined && typeof reason !== 'string') return res.status(400).json({ message: 'Invalid reason' });
  if (typeof reason === 'string' && reason.length > 1000) return res.status(400).json({ message: 'Reason too long' });

  try {
    const pool = await poolPromise;
    const sessionCheck = await pool.request().input('sid', sql.Int, sessionId)
      .query('SELECT creator FROM dbo.Sessions WHERE id=@sid');
    if (!sessionCheck.recordset || sessionCheck.recordset.length === 0) return res.status(404).json({ message: 'Session not found' });

    const inviteCheck = await pool.request().input('sid', sql.Int, sessionId).input('me', sql.Int, me)
      .query("SELECT id, status FROM dbo.SessionInvites WHERE session_id=@sid AND to_user=@me");
    if (!inviteCheck.recordset || inviteCheck.recordset.length === 0) {
      if (sessionCheck.recordset[0].creator !== me) return res.status(404).json({ message: 'Invite not found' });
      await pool.request()
        .input('sid', sql.Int, sessionId)
        .input('me', sql.Int, me)
        .input('reason', sql.NVarChar(1000), typeof reason === 'string' && reason.trim() ? reason.trim() : null)
        .query("INSERT INTO dbo.SessionInvites (session_id, to_user, status, response_reason, responded_at) VALUES (@sid, @me, 'left', @reason, GETUTCDATE())");
      return res.json({ message: 'Session left' });
    }
    if (inviteCheck.recordset[0].status !== 'accepted') return res.status(409).json({ message: 'Only accepted participants can leave' });

    const updateRes = await pool.request()
      .input('sid', sql.Int, sessionId)
      .input('me', sql.Int, me)
      .input('reason', sql.NVarChar(1000), typeof reason === 'string' && reason.trim() ? reason.trim() : null)
      .query("UPDATE dbo.SessionInvites SET status='left', response_reason=@reason, responded_at=GETUTCDATE() WHERE session_id=@sid AND to_user=@me; SELECT @@ROWCOUNT as updated");
    if (!updateRes.recordset || !updateRes.recordset[0] || updateRes.recordset[0].updated === 0) {
      return res.status(500).json({ message: 'Leave action failed' });
    }

    return res.json({ message: 'Session left' });
  } catch (err) {
    console.error('Error leaving session:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
