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
    .query('SELECT TOP 1 id, rawg_id, title, rawg_json FROM dbo.Games WHERE rawg_id=@rawg_id');
  if (!gameRef.recordset || gameRef.recordset.length === 0) {
    throw new Error('Game upsert failed');
  }
  return gameRef.recordset[0];
}

function mapLibraryRow(r) {
  let rawg = null;
  if (r.rawg_json) {
    try {
      rawg = JSON.parse(r.rawg_json);
    } catch (e) {
      rawg = { id: r.game_id, name: r.title };
    }
  } else {
    rawg = { id: r.game_id, name: r.title };
  }
  return {
    id: r.id,
    game_id: r.game_id,
    title: r.title,
    rawg,
    is_favorite: !!r.is_favorite,
    user_rating: r.user_rating,
    created_at: r.created_at
  };
}

async function getLibraryRows(pool, userId) {
  const result = await pool.request()
    .input('uid', sql.Int, userId)
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
WHERE l.user_id = @uid
ORDER BY l.is_favorite DESC, l.created_at DESC
`);
  return result.recordset.map(mapLibraryRow);
}

// GET /api/library - list library entries for current user
router.get('/', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const pool = await poolPromise;
    const rows = await getLibraryRows(pool, userId);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/library - add a game to library. body: { game: {...} }
router.post('/', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  const game = req.body && req.body.game;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!game || !game.id) return res.status(400).json({ message: 'Missing game data' });

  try {
    const pool = await poolPromise;
    const gameRow = await upsertGame(pool, game);

    const check = await pool.request()
      .input('uid', sql.Int, userId)
      .input('gid', sql.Int, gameRow.id)
      .query('SELECT id FROM dbo.Library WHERE user_id=@uid AND game_ref_id=@gid');
    if (check.recordset.length > 0) return res.status(409).json({ message: 'Already in library' });

    const insert = await pool.request()
      .input('uid', sql.Int, userId)
      .input('gid', sql.Int, gameRow.id)
      .query('INSERT INTO dbo.Library (user_id, game_ref_id, is_favorite, user_rating, created_at) OUTPUT INSERTED.id VALUES (@uid, @gid, 0, NULL, GETUTCDATE())');

    const newId = insert.recordset[0].id;
    return res.status(201).json({ id: newId, game_id: gameRow.rawg_id, title: gameRow.title, rawg: game, is_favorite: false, user_rating: null });
  } catch (err) {
    console.error(err);
    if (err && err.message === 'Missing game data') return res.status(400).json({ message: 'Missing game data' });
    if (err && err.message === 'Invalid game id') return res.status(400).json({ message: 'Invalid game id' });
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/library/:id - update library entry preferences (favorite/rating)
router.patch('/:id', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  const id = Number(req.params.id);
  const { is_favorite, user_rating } = req.body || {};
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  const hasFavorite = typeof is_favorite === 'boolean';
  const hasRating = user_rating === null || user_rating === undefined || Number.isInteger(user_rating);
  if (!hasFavorite && user_rating === undefined) {
    return res.status(400).json({ message: 'No updatable fields provided' });
  }
  if (!hasRating) return res.status(400).json({ message: 'Invalid rating value' });
  if (Number.isInteger(user_rating) && (user_rating < 1 || user_rating > 10)) {
    return res.status(400).json({ message: 'Rating must be between 1 and 10' });
  }

  try {
    const pool = await poolPromise;
    const check = await pool.request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, userId)
      .query('SELECT id FROM dbo.Library WHERE id=@id AND user_id=@uid');
    if (check.recordset.length === 0) return res.status(404).json({ message: 'Not found' });

    await pool.request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, userId)
      .input('favorite_provided', sql.Bit, hasFavorite ? 1 : 0)
      .input('rating_provided', sql.Bit, user_rating !== undefined ? 1 : 0)
      .input('is_favorite', sql.Bit, hasFavorite ? (is_favorite ? 1 : 0) : null)
      .input('user_rating', sql.Int, user_rating === undefined ? null : user_rating)
      .query(`
UPDATE dbo.Library
SET
  is_favorite = CASE WHEN @favorite_provided=1 THEN @is_favorite ELSE is_favorite END,
  user_rating = CASE WHEN @rating_provided=1 THEN @user_rating ELSE user_rating END
WHERE id=@id AND user_id=@uid
`);

    const updated = await pool.request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, userId)
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
WHERE l.id=@id AND l.user_id=@uid
`);
    const row = updated.recordset[0];
    return res.json(mapLibraryRow(row));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/library/by-game/:gameId - update stored RAWG details for current user
router.patch('/by-game/:gameId', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  const gameId = Number(req.params.gameId);
  const game = req.body && req.body.game;
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!gameId || !game || !game.id || Number(game.id) !== gameId) return res.status(400).json({ message: 'Invalid game data' });

  try {
    const pool = await poolPromise;
    const gameRow = await upsertGame(pool, game);
    const check = await pool.request()
      .input('uid', sql.Int, userId)
      .input('gid', sql.Int, gameRow.id)
      .query('SELECT id FROM dbo.Library WHERE user_id=@uid AND game_ref_id=@gid');
    if (check.recordset.length === 0) return res.status(404).json({ message: 'Not found in library' });
    return res.json({ message: 'Library details updated' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/library/:id - remove library entry by id
router.delete('/:id', auth, async (req, res) => {
  const userId = req.user && req.user.id;
  const id = Number(req.params.id);
  if (!userId) return res.status(401).json({ message: 'Unauthorized' });
  if (!id) return res.status(400).json({ message: 'Invalid id' });

  try {
    const pool = await poolPromise;
    const check = await pool.request()
      .input('id', sql.Int, id)
      .input('uid', sql.Int, userId)
      .query('SELECT id FROM dbo.Library WHERE id=@id AND user_id=@uid');
    if (check.recordset.length === 0) return res.status(404).json({ message: 'Not found' });

    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Library WHERE id=@id');
    return res.json({ message: 'Removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
