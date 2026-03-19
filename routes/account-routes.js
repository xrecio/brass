const express = require('express');
const bcrypt = require('bcryptjs');
const { requireLogin } = require('../lib/auth');
const db = require('../lib/db');
const router = express.Router();

router.get('/account', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const user = db.findUserById(userId);
  const stats = db.getUserStats(userId);

  // Count active/started games
  const allGames = db.findGames({});
  const activeGames = allGames.filter(g =>
    (g.status === 'active' || g.status === 'waiting') && db.isGameMember(g.id, userId)
  ).length;
  const finishedGames = allGames.filter(g =>
    g.status === 'finished' && db.isGameMember(g.id, userId)
  ).length;

  // Fix login stats if missing (user logged in before tracking was added)
  if (!user.last_login) {
    user.last_login = new Date().toISOString();
    user.login_count = Math.max(user.login_count || 0, 1);
    db.save();
  }

  res.render('account', { stats, accountUser: user, activeGames, finishedGames, error: null, success: null });
});

router.post('/account/change-password', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const user = db.findUserById(userId);
  const stats = db.getUserStats(userId);
  const { current_password, new_password, confirm_password } = req.body;
  const extra = { activeGames: 0, finishedGames: 0 };

  function render(error, success) {
    res.render('account', { stats, accountUser: user, ...extra, error, success });
  }

  if (!current_password || !new_password) return render('All fields are required', null);

  const valid = await bcrypt.compare(current_password, user.password_hash);
  if (!valid) return render('Current password is incorrect', null);
  if (new_password.length < 4) return render('New password must be at least 4 characters', null);
  if (new_password !== confirm_password) return render('New passwords do not match', null);

  user.password_hash = await bcrypt.hash(new_password, 10);
  db.save();
  render(null, 'Password changed successfully');
});

module.exports = router;
