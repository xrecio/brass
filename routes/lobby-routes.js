const express = require('express');
const { requireLogin } = require('../lib/auth');
const { createInitialState } = require('../lib/game-setup');
const { playerColorNames } = require('../lib/industry-data');
const db = require('../lib/db');
const { APP_VERSION, isCompatible } = require('../lib/version');
const router = express.Router();

router.get('/lobby', requireLogin, (req, res) => {
  const userId = req.session.user.id;

  const allGames = db.findGames({}).filter(g => g.status === 'waiting' || g.status === 'active');

  const games = allGames.map(g => {
    const players = db.getGamePlayers(g.id);
    const creator = db.findUserById(g.created_by);
    const gs = db.getGameState(g.id);
    let gameAppVersion = null;
    let compatible = true;
    if (gs) {
      const state = JSON.parse(gs.state);
      gameAppVersion = state.appVersion || null;
      compatible = isCompatible(state.gameStateVersion || 0);
    }
    return {
      ...g,
      player_count: players.length,
      is_member: players.some(p => p.user_id === userId),
      creator_name: creator ? creator.username : 'Unknown',
      gameAppVersion,
      compatible
    };
  }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.render('lobby', { games, appVersion: APP_VERSION });
});

router.post('/games/create', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const { name, numPlayers, numBots } = req.body;
  const np = Math.min(4, Math.max(3, parseInt(numPlayers) || 4));
  const nb = Math.min(np - 1, Math.max(0, parseInt(numBots) || 0));

  const game = db.createGame(name || 'New Game', np, userId);

  // Creator joins as seat 0
  db.addGamePlayer(game.id, userId, 0, playerColorNames[0]);

  // Add bots
  for (let i = 0; i < nb; i++) {
    const botName = `Bot_${['Alpha', 'Beta', 'Gamma'][i]}`;
    let bot = db.findUserByUsername(botName);
    if (!bot || !bot.is_bot) {
      bot = db.createUser(botName, 'bot', true);
    }
    db.addGamePlayer(game.id, bot.id, i + 1, playerColorNames[i + 1], true);
  }

  res.redirect('/lobby');
});

// Quick game: create + add bots + start immediately
router.post('/games/quick', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const nb = Math.min(3, Math.max(1, parseInt(req.body.numBots) || 2));
  const np = nb + 1;
  const names = ['Lancashire', 'Birmingham', 'Industrial', 'Revolution', 'Canal', 'Railway', 'Empire', 'Trade'];
  const name = names[Math.floor(Math.random() * names.length)] + ' ' + Math.floor(Math.random() * 1000);

  const game = db.createGame(name, np, userId);
  db.addGamePlayer(game.id, userId, 0, playerColorNames[0]);

  for (let i = 0; i < nb; i++) {
    const botName = 'Bot_' + ['Alpha', 'Beta', 'Gamma'][i];
    let bot = db.findUserByUsername(botName);
    if (!bot || !bot.is_bot) {
      bot = db.createUser(botName, 'bot', true);
    }
    db.addGamePlayer(game.id, bot.id, i + 1, playerColorNames[i + 1], true);
  }

  // Start immediately
  const dbPlayers = db.getGamePlayers(game.id);
  const players = dbPlayers.map(p => {
    const user = db.findUserById(p.user_id);
    return { userId: p.user_id, username: user ? user.username : 'Unknown', color: p.color, isBot: p.is_bot };
  });

  const state = createInitialState(players, players.length);
  db.updateGame(game.id, { status: 'active' });
  db.setGameState(game.id, JSON.stringify(state), 0);

  // Redirect first, then trigger bots (so page loads before bots modify state)
  res.redirect('/games/' + game.id);

  // Trigger bots after redirect
  setTimeout(() => {
    const botModule = require('../lib/bot-engine');
    botModule.checkAndPlayBot(game.id);
  }, 2000);
});

router.post('/games/:id/join', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const gameId = parseInt(req.params.id);

  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting') return res.redirect('/lobby');

  const players = db.getGamePlayers(gameId);
  if (players.length >= game.num_players) return res.redirect('/lobby');
  if (players.some(p => p.user_id === userId)) return res.redirect('/lobby');

  const seat = players.length;
  db.addGamePlayer(gameId, userId, seat, playerColorNames[seat]);

  res.redirect('/lobby');
});

// GET fallback in case browser navigates directly
router.get('/games/:id/start', requireLogin, (req, res) => {
  res.redirect('/lobby');
});

router.post('/games/:id/start', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const gameId = parseInt(req.params.id);

  const game = db.findGame(gameId);
  if (!game || game.status !== 'waiting' || game.created_by !== userId) {
    return res.redirect('/lobby');
  }

  const dbPlayers = db.getGamePlayers(gameId);
  if (dbPlayers.length < 3) return res.redirect('/lobby');

  const players = dbPlayers.map(p => {
    const user = db.findUserById(p.user_id);
    return {
      userId: p.user_id,
      username: user ? user.username : 'Unknown',
      color: p.color,
      isBot: p.is_bot
    };
  });

  const state = createInitialState(players, players.length);

  db.updateGame(gameId, { status: 'active' });
  db.setGameState(gameId, JSON.stringify(state), 0);

  // Trigger bot play if first player is a bot
  const botModule = require('../lib/bot-engine');
  botModule.checkAndPlayBot(gameId);

  res.redirect(`/games/${gameId}`);
});

module.exports = router;
