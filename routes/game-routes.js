const express = require('express');
const { requireLogin, requireLoginAPI } = require('../lib/auth');
const { applyAction, getValidActions } = require('../lib/game-engine');
const db = require('../lib/db');
const { APP_VERSION, isCompatible } = require('../lib/version');
const router = express.Router();

router.get('/games/:id', requireLogin, (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.session.user.id;

  const game = db.findGame(gameId);
  if (!game) return res.redirect('/lobby');
  if (game.status === 'waiting') return res.redirect('/lobby');

  const isMember = db.isGameMember(gameId, userId);
  const gs = db.getGameState(gameId);
  if (!gs) return res.redirect('/lobby');

  const state = JSON.parse(gs.state);
  const gameVersion = state.gameStateVersion || 0;

  if (!isCompatible(gameVersion)) {
    return res.render('game-incompatible', {
      game,
      gameVersion: state.appVersion || 'unknown',
      currentVersion: APP_VERSION
    });
  }

  const prefs = db.getUserPrefs(userId);
  const customPositions = prefs.nodePositions || null;

  // Get xai's positions as the baseline defaults
  const xaiUser = db.findUserByUsername('xai');
  const xaiPrefs = xaiUser ? db.getUserPrefs(xaiUser.id) : {};
  const xaiPositions = xaiPrefs.nodePositions || null;

  res.render('game', {
    game,
    state,
    version: gs.version,
    userId,
    isMember,
    appVersion: APP_VERSION,
    customPositions: JSON.stringify(customPositions),
    xaiPositions: JSON.stringify(xaiPositions)
  });
});

// API: Get current state (for polling)
router.get('/api/games/:id/state', requireLoginAPI, (req, res) => {
  const gameId = parseInt(req.params.id);
  const clientVersion = parseInt(req.query.version) || -1;

  const gs = db.getGameState(gameId);
  if (!gs) return res.status(404).json({ error: 'Game not found' });

  if (gs.version === clientVersion) {
    return res.status(304).end();
  }

  const state = JSON.parse(gs.state);
  if (!isCompatible(state.gameStateVersion || 0)) {
    return res.json({ state: { ...state, incompatible: true }, version: gs.version });
  }
  const userId = req.session.user.id;
  const sanitized = sanitizeState(state, userId);

  res.json({ state: sanitized, version: gs.version });
});

// API: Submit action
router.post('/api/games/:id/action', requireLoginAPI, (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.session.user.id;
  const action = req.body;

  const gs = db.getGameState(gameId);
  if (!gs) return res.status(404).json({ error: 'Game not found' });

  const state = JSON.parse(gs.state);
  if (!isCompatible(state.gameStateVersion || 0)) {
    return res.status(400).json({ error: 'This game was created with an older version and is no longer playable.' });
  }
  const result = applyAction(state, userId, action);

  if (result.error) {
    return res.status(400).json({ error: result.error });
  }

  // Save with optimistic concurrency
  const success = db.updateGameState(gameId, JSON.stringify(result.newState), gs.version);
  if (!success) {
    return res.status(409).json({ error: 'State changed, please refresh' });
  }

  // Log action
  db.addGameAction(gameId, userId, action.type, JSON.stringify(action), gs.version);

  // Update game status and record results if finished
  if (result.newState.phase === 'finished') {
    db.updateGame(gameId, { status: 'finished' });
    recordGameResult(gameId, result.newState);
  }

  // Check if next player is a bot
  const botModule = require('../lib/bot-engine');
  botModule.checkAndPlayBot(gameId);

  const newGs = db.getGameState(gameId);
  res.json({
    state: sanitizeState(JSON.parse(newGs.state), userId),
    version: newGs.version
  });
});

// API: Get valid actions
router.get('/api/games/:id/actions', requireLoginAPI, (req, res) => {
  const gameId = parseInt(req.params.id);
  const userId = req.session.user.id;

  const gs = db.getGameState(gameId);
  if (!gs) return res.status(404).json({ error: 'Game not found' });

  const state = JSON.parse(gs.state);
  const actions = getValidActions(state, userId);

  res.json({ actions });
});

// API: Save custom node positions
router.post('/api/user/node-positions', requireLoginAPI, (req, res) => {
  const userId = req.session.user.id;
  const positions = req.body;
  if (!positions || typeof positions !== 'object') {
    return res.status(400).json({ error: 'Invalid positions data' });
  }
  db.setUserPrefs(userId, { nodePositions: positions });
  res.json({ ok: true });
});

// API: Reset node positions to defaults
router.delete('/api/user/node-positions', requireLoginAPI, (req, res) => {
  const userId = req.session.user.id;
  db.setUserPrefs(userId, { nodePositions: null });
  res.json({ ok: true });
});

function sanitizeState(state, userId) {
  const sanitized = JSON.parse(JSON.stringify(state));
  for (const player of sanitized.players) {
    if (player.userId !== userId) {
      player.handCount = player.hand.length;
      player.hand = [];
    }
  }
  return sanitized;
}

function recordGameResult(gameId, state) {
  const game = db.findGame(gameId);
  const maxVP = Math.max(...state.players.map(p => p.vp));
  const result = {
    game_id: gameId,
    game_name: game ? game.name : 'Unknown',
    finished_at: new Date().toISOString(),
    era: state.era,
    players: state.players.map(p => ({
      user_id: p.userId,
      username: p.username,
      seat: p.seat,
      vp: p.vp,
      income: p.income,
      money: p.money,
      is_winner: p.vp === maxVP,
      is_bot: p.isBot || false
    }))
  };
  db.addGameResult(result);
}

module.exports = router;
