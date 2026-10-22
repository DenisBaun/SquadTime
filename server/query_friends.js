(async () => {
  try {
    const { poolPromise } = require('./db');
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT id, user_id, friend_id, created_at FROM dbo.Friends ORDER BY created_at DESC");
    console.log(JSON.stringify(res.recordset, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
