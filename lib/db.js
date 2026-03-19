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
  } catch {
    data = JSON.parse(JSON.stringify(defaultData));
    save();
  }
}

function save() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
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
  save();
  return true;
}

// Game actions log
function addGameAction(gameId, userId, actionType, actionData, stateVersion) {
  const d = get();
  const id = d.nextId.gameActions++;
  d.gameActions.push({ id, game_id: gameId, user_id: userId, action_type: actionType, action_data: actionData, state_version: stateVersion, created_at: new Date().toISOString() });
  save();
}

module.exports = {
  load, save, get,
  createUser, findUserByUsername, findUserById,
  createGame, findGame, findGames, updateGame,
  addGamePlayer, getGamePlayers, isGameMember,
  setGameState, getGameState, updateGameState,
  addGameAction
};
