const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET) {
  throw new Error("ERROR: JWT_SECRET ist in der .env-Datei nicht definiert!");
}
const secret = process.env.JWT_SECRET;

module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = payload; // payload contains id, username, email
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
