(async () => {
  try {
    const { poolPromise } = require('./db');
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT TOP(20) id, from_user, to_user, status, created_at FROM dbo.FriendRequests ORDER BY created_at DESC");
    console.log(JSON.stringify(res.recordset, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
