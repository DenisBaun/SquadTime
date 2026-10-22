(async () => {
  try {
    const { poolPromise } = require('./db');
    const pool = await poolPromise;
    const res = await pool.request().query("SELECT id, username, email FROM dbo.Users WHERE id IN (3,4)");
    console.log(JSON.stringify(res.recordset, null, 2));
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
