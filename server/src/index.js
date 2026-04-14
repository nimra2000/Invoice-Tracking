require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');
const { Pool } = require('pg');

const studentsRouter = require('./routes/students');
const lessonsRouter = require('./routes/lessons');
const invoicesRouter = require('./routes/invoices');
const profileRouter = require('./routes/profile');
const { router: authRouter } = require('./routes/auth');

const app = express();

app.set('trust proxy', 1);

if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}

app.use(express.json());
app.use(session({
  store: new pgSession({
    pool: new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

app.use('/auth', authRouter);

app.use('/api', (req, res, next) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  next();
});

app.use('/api/students', studentsRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/profile', profileRouter);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
