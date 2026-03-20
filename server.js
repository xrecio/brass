const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const db = require('./lib/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
db.load();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionDir = process.env.SESSION_DIR || path.join(__dirname, 'data', 'sessions');
app.use(session({
  store: new FileStore({ path: sessionDir, ttl: 365 * 24 * 60 * 60, retries: 0, logFn: function(){} }),
  secret: process.env.SESSION_SECRET || 'brass-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 365 * 24 * 60 * 60 * 1000 }
}));

// Auth middleware - make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const authRoutes = require('./routes/auth-routes');
const lobbyRoutes = require('./routes/lobby-routes');
const gameRoutes = require('./routes/game-routes');
const wikiRoutes = require('./routes/wiki-routes');
const profileRoutes = require('./routes/profile-routes');
const accountRoutes = require('./routes/account-routes');

app.use('/', authRoutes);
app.use('/', lobbyRoutes);
app.use('/', gameRoutes);
app.use('/', profileRoutes);
app.use('/', accountRoutes);
app.use('/wiki', wikiRoutes);

// Home redirect
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/lobby');
  } else {
    res.redirect('/login');
  }
});

app.listen(PORT, () => {
  console.log(`Brass: Lancashire running on http://localhost:${PORT}`);
});
