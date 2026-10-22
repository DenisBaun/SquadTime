const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const libraryRouter = require('./routes/library');
const sessionsRouter = require('./routes/sessions');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/library', libraryRouter);
app.use('/api/sessions', sessionsRouter);
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
