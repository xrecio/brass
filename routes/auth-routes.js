const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = db.findUserByUsername(username);
  if (!user || user.is_bot) {
    return res.render('login', { error: 'Invalid username or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.render('login', { error: 'Invalid username or password' });
  }

  req.session.user = { id: user.id, username: user.username };

  if (req.body.remember) {
    req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
  } else {
    req.session.cookie.expires = false;
  }

  req.session.save(() => {
    res.redirect('/lobby');
  });
});

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, password, confirm } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Username and password required' });
  }
  if (username.length < 3 || username.length > 20) {
    return res.render('register', { error: 'Username must be 3-20 characters' });
  }
  if (password.length < 4) {
    return res.render('register', { error: 'Password must be at least 4 characters' });
  }
  if (password !== confirm) {
    return res.render('register', { error: 'Passwords do not match' });
  }

  if (db.findUserByUsername(username)) {
    return res.render('register', { error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, 10);
  db.createUser(username, hash);

  res.redirect('/login');
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
