const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const router = express.Router();

router.get('/login', (req, res) => {
  res.render('login', { error: null, setupMode: false, setupUser: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = db.findUserByUsername(username);
  if (!user || user.is_bot) {
    return res.render('login', { error: 'User not found. Ask the admin to create your account.', setupMode: false, setupUser: null });
  }

  // If user has no password yet (created by admin), prompt to set one
  if (!user.password_hash || user.password_hash === 'pending') {
    return res.render('login', { error: null, setupMode: true, setupUser: username });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.render('login', { error: 'Invalid password', setupMode: false, setupUser: null });
  }

  req.session.user = { id: user.id, username: user.username };
  db.updateUserLoginStats(user.id);

  if (req.body.remember) {
    req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
  } else {
    req.session.cookie.expires = false;
  }

  req.session.save(() => {
    res.redirect('/lobby');
  });
});

// Set password for new user (first login)
router.post('/setup-password', async (req, res) => {
  const { username, password, confirm } = req.body;

  const user = db.findUserByUsername(username);
  if (!user || user.is_bot) {
    return res.render('login', { error: 'User not found', setupMode: false, setupUser: null });
  }
  if (user.password_hash && user.password_hash !== 'pending') {
    return res.render('login', { error: 'Password already set. Please login.', setupMode: false, setupUser: null });
  }
  if (!password || password.length < 4) {
    return res.render('login', { error: 'Password must be at least 4 characters', setupMode: true, setupUser: username });
  }
  if (password !== confirm) {
    return res.render('login', { error: 'Passwords do not match', setupMode: true, setupUser: username });
  }

  user.password_hash = await bcrypt.hash(password, 10);
  db.save();

  // Auto-login
  req.session.user = { id: user.id, username: user.username };
  db.updateUserLoginStats(user.id);
  req.session.cookie.maxAge = 365 * 24 * 60 * 60 * 1000;
  req.session.save(() => {
    res.redirect('/lobby');
  });
});

// Admin: create user (xai only)
router.post('/admin/create-user', async (req, res) => {
  if (!req.session.user || req.session.user.username !== 'xai') {
    return res.redirect('/lobby');
  }
  const { username } = req.body;
  if (!username || username.length < 3 || username.length > 20) {
    return res.redirect('/lobby');
  }
  if (db.findUserByUsername(username)) {
    return res.redirect('/lobby'); // already exists
  }
  db.createUser(username, 'pending'); // no password yet
  res.redirect('/lobby');
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
