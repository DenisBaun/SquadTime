const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Prefer JS route when running node; if running TS via ts-node it still works with import
let authRouter;
try {
  authRouter = require('./routes/auth');
} catch (e) {
  // fallback if ts-node loads the TS route
  authRouter = require('./routes/auth');
}

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Auth routes (registration / login)
app.use('/api/auth', authRouter);

app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});