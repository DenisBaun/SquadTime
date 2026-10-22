const bcrypt = require('bcryptjs');

// Middleware hashes req.body.password (if present) before it reaches handlers
async function hashPassword(req, res, next) {
  try {
    if (req.body && typeof req.body.password === 'string' && req.body.password.length > 0) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(req.body.password, salt);
      req.body.password = hash;
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = hashPassword;
