// Simple file-based JSON database
// Good enough for a small group of friends playing Brass
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

const defaultData = {
  users: [],
  games: [],
  gamePlayers: [],
  gameStates: [],
  gameActions: [],
  gameResults: [],
  gameInvites: [],
  trainingResults: [],
  gameStateHistory: [],
  nextId: { users: 1, games: 1, gameActions: 1 }
};

let data = null;

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } else {
      data = JSON.parse(JSON.stringify(defaultData));
      save();
    }
  if (data) migrate();
  } catch (err) {
    console.error('DB load failed, trying backup:', err.message);
    const bakPath = DB_PATH + '.bak';
    try {
      if (fs.existsSync(bakPath)) {
        data = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
        console.log('Restored from backup');
        save(); // re-save as main
      } else {
        data = JSON.parse(JSON.stringify(defaultData));
        save();
      }
    } catch {
      data = JSON.parse(JSON.stringify(defaultData));
      save();
    }
  }
}

// Migrate: add new fields to existing DBs without losing data
function migrate() {
  let changed = false;
  if (!data.gameResults) { data.gameResults = []; changed = true; }
  if (!data.gameInvites) { data.gameInvites = []; changed = true; }
  if (!data.trainingResults) { data.trainingResults = []; changed = true; }
  if (!data.gameStateHistory) { data.gameStateHistory = []; changed = true; }
  // Ensure "xai" user always exists
  if (!data.users.find(u => u.username === 'xai' && !u.is_bot)) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('xai2024', 10);
    const id = data.nextId.users++;
    data.users.push({ id, username: 'xai', password_hash: hash, is_bot: false, prefs: {}, created_at: new Date().toISOString() });
    changed = true;
  }
  if (changed) save();
}

function save() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(data, null, 2);
  const tmpPath = DB_PATH + '.tmp';
  const bakPath = DB_PATH + '.bak';
  // Atomic write: write to temp file, backup old, rename temp to main
  fs.writeFileSync(tmpPath, json);
  if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, bakPath);
  fs.renameSync(tmpPath, DB_PATH);
}

function get() {
  if (!data) load();
  return data;
}

// User operations
function createUser(username, passwordHash, isBot = false) {
  const d = get();
  const id = d.nextId.users++;
  const user = { id, username, password_hash: passwordHash, is_bot: isBot, created_at: new Date().toISOString() };
  d.users.push(user);
  save();
  return user;
}

function updateUserLoginStats(userId) {
  const user = findUserById(userId);
  if (!user) return;
  user.last_login = new Date().toISOString();
  user.login_count = (user.login_count || 0) + 1;
  save();
}

function setUserPrefs(userId, prefs) {
  const user = findUserById(userId);
  if (!user) return;
  user.prefs = { ...(user.prefs || {}), ...prefs };
  save();
}

function getUserPrefs(userId) {
  const user = findUserById(userId);
  return user?.prefs || {};
}

function findUserByUsername(username) {
  return get().users.find(u => u.username === username);
}

function findUserById(id) {
  return get().users.find(u => u.id === id);
}

// Game operations
function createGame(name, numPlayers, createdBy) {
  const d = get();
  const id = d.nextId.games++;
  const game = { id, name, status: 'waiting', num_players: numPlayers, created_by: createdBy, created_at: new Date().toISOString() };
  d.games.push(game);
  save();
  return game;
}

function findGame(id) {
  return get().games.find(g => g.id === id);
}

function findGames(filter) {
  return get().games.filter(g => {
    for (const [k, v] of Object.entries(filter)) {
      if (Array.isArray(v)) { if (!v.includes(g[k])) return false; }
      else if (g[k] !== v) return false;
    }
    return true;
  });
}

function updateGame(id, updates) {
  const game = findGame(id);
  if (game) Object.assign(game, updates);
  save();
}

// Game players
function addGamePlayer(gameId, userId, seat, color, isBot = false) {
  const d = get();
  d.gamePlayers.push({ game_id: gameId, user_id: userId, seat, color, is_bot: isBot });
  save();
}

function getGamePlayers(gameId) {
  return get().gamePlayers.filter(p => p.game_id === gameId);
}

function isGameMember(gameId, userId) {
  return get().gamePlayers.some(p => p.game_id === gameId && p.user_id === userId);
}

// Game state
function setGameState(gameId, state, version = 0) {
  const d = get();
  const existing = d.gameStates.find(s => s.game_id === gameId);
  if (existing) {
    existing.state = state;
    existing.version = version;
  } else {
    d.gameStates.push({ game_id: gameId, state, version });
  }
  // Store in history
  pushStateHistory(gameId, state, version);
  save();
}

function getGameState(gameId) {
  return get().gameStates.find(s => s.game_id === gameId);
}

function updateGameState(gameId, newState, expectedVersion) {
  const gs = getGameState(gameId);
  if (!gs || gs.version !== expectedVersion) return false;
  gs.state = newState;
  gs.version++;
  // Store in history
  pushStateHistory(gameId, newState, gs.version);
  save();
  return true;
}

function pushStateHistory(gameId, state, version) {
  const d = get();
  d.gameStateHistory.push({
    game_id: gameId, version, state,
    ts: new Date().toISOString()
  });
}

function getStateAtVersion(gameId, version) {
  const d = get();
  return d.gameStateHistory.find(h => h.game_id === gameId && h.version === version);
}

function getStateVersionCount(gameId) {
  const d = get();
  return d.gameStateHistory.filter(h => h.game_id === gameId).length;
}

// Game actions log
function addGameAction(gameId, userId, actionType, actionData, stateVersion) {
  const d = get();
  const id = d.nextId.gameActions++;
  d.gameActions.push({ id, game_id: gameId, user_id: userId, action_type: actionType, action_data: actionData, state_version: stateVersion, created_at: new Date().toISOString() });
  save();
}

// Game results (recorded when a game finishes)
function addGameResult(result) {
  // result: { game_id, game_name, finished_at, players: [{ user_id, username, seat, vp, income, money, is_winner, is_bot }] }
  const d = get();
  d.gameResults.push(result);
  save();
}

function getGameResultsForUser(userId) {
  const d = get();
  return (d.gameResults || []).filter(r =>
    r.players.some(p => p.user_id === userId)
  );
}

function getUserStats(userId) {
  const results = getGameResultsForUser(userId);
  const stats = {
    gamesPlayed: 0,
    wins: 0,
    totalVP: 0,
    bestVP: 0,
    avgVP: 0,
    opponents: {},
    recentGames: []
  };

  for (const r of results) {
    const me = r.players.find(p => p.user_id === userId);
    if (!me) continue;

    stats.gamesPlayed++;
    stats.totalVP += me.vp;
    if (me.vp > stats.bestVP) stats.bestVP = me.vp;
    if (me.is_winner) stats.wins++;

    for (const p of r.players) {
      if (p.user_id !== userId) {
        if (!stats.opponents[p.username]) {
          stats.opponents[p.username] = { played: 0, winsAgainst: 0 };
        }
        stats.opponents[p.username].played++;
        if (me.is_winner) stats.opponents[p.username].winsAgainst++;
      }
    }

    stats.recentGames.push({
      game_id: r.game_id,
      game_name: r.game_name,
      finished_at: r.finished_at,
      myVP: me.vp,
      won: me.is_winner,
      players: r.players.map(p => ({ username: p.username, vp: p.vp, is_winner: p.is_winner, is_bot: p.is_bot }))
    });
  }

  stats.avgVP = stats.gamesPlayed > 0 ? Math.round(stats.totalVP / stats.gamesPlayed) : 0;
  stats.recentGames.reverse(); // most recent first
  return stats;
}

// Training results
function addTrainingResult(result) {
  const d = get();
  d.trainingResults.push(result);
  // Keep only last 100 results to avoid bloat
  if (d.trainingResults.length > 100) {
    d.trainingResults = d.trainingResults.slice(-100);
  }
  save();
}

function getTrainingStats() {
  const d = get();
  const results = d.trainingResults || [];
  if (results.length === 0) {
    return { totalGames: 0, rankings: {}, tiers: { pro: null, average: null, noob: null }, lastUpdate: null };
  }
  const latest = results[results.length - 1];
  return {
    totalGames: latest.totalGames || 0,
    rankings: latest.rankings || {},
    tiers: latest.tiers || { pro: null, average: null, noob: null },
    lastUpdate: latest.timestamp || null,
    batchCount: results.length
  };
}

// Delete game completely
function deleteGame(gameId) {
  const d = get();
  d.games = d.games.filter(g => g.id !== gameId);
  d.gamePlayers = d.gamePlayers.filter(p => p.game_id !== gameId);
  d.gameStates = d.gameStates.filter(s => s.game_id !== gameId);
  d.gameActions = d.gameActions.filter(a => a.game_id !== gameId);
  d.gameStateHistory = (d.gameStateHistory || []).filter(h => h.game_id !== gameId);
  d.gameInvites = (d.gameInvites || []).filter(i => i.game_id !== gameId);
  save();
}

// Game invites
function inviteToGame(gameId, username) {
  const d = get();
  const user = findUserByUsername(username);
  if (!user || user.is_bot) return false;
  // Don't invite if already member or already invited
  if (isGameMember(gameId, user.id)) return false;
  if (d.gameInvites.some(i => i.game_id === gameId && i.user_id === user.id)) return false;
  d.gameInvites.push({ game_id: gameId, user_id: user.id, created_at: new Date().toISOString() });
  save();
  return true;
}

function getInvitesForUser(userId) {
  return get().gameInvites.filter(i => i.user_id === userId);
}

function getInvitesForGame(gameId) {
  return get().gameInvites.filter(i => i.game_id === gameId);
}

function removeInvite(gameId, userId) {
  const d = get();
  d.gameInvites = d.gameInvites.filter(i => !(i.game_id === gameId && i.user_id === userId));
  save();
}

module.exports = {
  load, save, get,
  createUser, findUserByUsername, findUserById, setUserPrefs, getUserPrefs, updateUserLoginStats,
  createGame, findGame, findGames, updateGame,
  addGamePlayer, getGamePlayers, isGameMember,
  setGameState, getGameState, updateGameState,
  addGameAction,
  addGameResult, getGameResultsForUser, getUserStats,
  getStateAtVersion, getStateVersionCount,
  deleteGame, inviteToGame, getInvitesForUser, getInvitesForGame, removeInvite,
  addTrainingResult, getTrainingStats
};
