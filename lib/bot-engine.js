// AI Bot engine for Brass: Lancashire
// Pluggable architecture: currently uses heuristic strategy

const { applyAction, getValidActions, getPlayerNetwork, isConnected, getConnectedLocations } = require('./game-engine');
const { locations, links } = require('./board-data');
const { industries } = require('./industry-data');

// Configurable delay between bot actions (ms)
let botDelay = 2000;

function setBotDelay(ms) {
  botDelay = Math.max(500, Math.min(5000, ms));
}

function getBotDelay() {
  return botDelay;
}

// ============ BOT INTERFACE ============

class BotStrategy {
  chooseAction(state, player) {
    throw new Error('Not implemented');
  }
}

// ============ HEURISTIC STRATEGY ============

class HeuristicBot extends BotStrategy {
  chooseAction(state, player) {
    const hand = player.hand;
    if (hand.length === 0) return null;

    const cardPlayed = hand[0];

    const action = this.trySellCotton(state, player, cardPlayed)
      || this.tryBuildIndustry(state, player, cardPlayed)
      || this.tryBuildLink(state, player, cardPlayed)
      || this.tryDevelop(state, player, cardPlayed)
      || this.tryLoan(state, player, cardPlayed)
      || { type: 'pass', cardPlayed };

    return action;
  }

  trySellCotton(state, player, cardPlayed) {
    for (const [locId, loc] of Object.entries(state.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (slot.owner === player.seat && slot.industryType === 'cottonMill' && !slot.flipped) {
          const connected = getConnectedLocations(state, locId);
          for (const cLoc of connected) {
            const portLoc = state.board.locations[cLoc];
            if (!portLoc) continue;
            for (let j = 0; j < portLoc.slots.length; j++) {
              const portSlot = portLoc.slots[j];
              if (portSlot.industryType === 'port' && !portSlot.flipped && portSlot.owner !== null) {
                return {
                  type: 'sellCotton', cardPlayed,
                  sales: [{ millLocation: locId, millSlot: i,
                    target: { type: 'port', location: cLoc, slotIndex: j } }]
                };
              }
            }
          }
          if (state.distantMarketDemand > 1 && isConnectedToPortSimple(state, locId)) {
            return {
              type: 'sellCotton', cardPlayed,
              sales: [{ millLocation: locId, millSlot: i, target: { type: 'distant' } }]
            };
          }
        }
      }
    }
    return null;
  }

  tryBuildIndustry(state, player, cardPlayed) {
    const cardInfo = getCardInfo(cardPlayed);
    const network = getPlayerNetwork(state, player.seat);

    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port']) {
      const mat = player.industryMat[industryType];
      if (!mat || mat.length === 0) continue;
      const level = mat[0];
      if (state.era === 'rail' && level <= 1) continue;
      if (industryType === 'shipyard' && level === 0) continue;

      const tileData = industries[industryType]?.levels[level];
      if (!tileData || player.money < tileData.cost) continue;

      for (const [locId, loc] of Object.entries(state.board.locations)) {
        for (let i = 0; i < loc.slots.length; i++) {
          const slot = loc.slots[i];
          if (!slot.allowed.includes(industryType)) continue;
          if (slot.owner !== null) continue;
          if (cardInfo.type === 'location' && cardInfo.location !== locId) continue;
          if (cardInfo.type === 'industry' && network.size > 0 && !network.has(locId)) continue;
          if (state.era === 'canal' && loc.slots.some(s => s.owner === player.seat)) continue;

          return { type: 'buildIndustry', location: locId, slotIndex: i, industryType, cardPlayed };
        }
      }
    }
    return null;
  }

  tryBuildLink(state, player, cardPlayed) {
    const network = getPlayerNetwork(state, player.seat);
    const era = state.era;

    for (const link of Object.values(state.board.links)) {
      if (link.owner !== null) continue;
      if (era === 'canal' && !link.canal) continue;
      if (era === 'rail' && !link.rail) continue;
      if (network.size > 0 && !network.has(link.from) && !network.has(link.to)) continue;

      const seg = link.segments || 1;
      if (era === 'canal' && player.money >= 3 * seg) {
        return { type: 'buildLink', linkId: link.from + '-' + link.to, cardPlayed };
      } else if (era === 'rail' && player.money >= 5 * seg + 5) {
        return { type: 'buildLink', linkId: link.from + '-' + link.to, cardPlayed };
      }
    }
    return null;
  }

  tryDevelop(state, player, cardPlayed) {
    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks']) {
      const mat = player.industryMat[industryType];
      if (mat && mat.length > 0 && mat[0] <= 1 && state.era === 'rail') {
        return { type: 'develop', cardPlayed, develops: [industryType] };
      }
    }
    return null;
  }

  tryLoan(state, player, cardPlayed) {
    if (player.money < 10) {
      return { type: 'takeLoan', cardPlayed, amount: 30 };
    }
    return null;
  }
}

// ============ ACTION DESCRIPTIONS ============

function describeAction(action, player, state) {
  const name = player.username;
  switch (action.type) {
    case 'buildIndustry': {
      const loc = locations[action.location]?.name || action.location;
      const ind = industries[action.industryType]?.name || action.industryType;
      const mat = player.industryMat[action.industryType];
      const level = mat ? mat[0] : '?';
      const data = industries[action.industryType]?.levels[level];
      let desc = name + ' builds ' + ind + ' L' + level + ' at ' + loc;
      if (data) {
        desc += ' (£' + data.cost;
        if (data.coalCost) desc += ' +' + data.coalCost + ' coal';
        if (data.ironCost) desc += ' +' + data.ironCost + ' iron';
        desc += ')';
      }
      return desc;
    }
    case 'buildLink': {
      const link = state.board.links[action.linkId];
      if (link) {
        const from = locations[link.from]?.name || link.from;
        const to = locations[link.to]?.name || link.to;
        const type = state.era === 'canal' ? 'canal' : 'rail';
        return name + ' builds ' + type + ' from ' + from + ' to ' + to;
      }
      return name + ' builds a link';
    }
    case 'sellCotton': {
      const sale = action.sales?.[0];
      if (sale) {
        const mill = locations[sale.millLocation]?.name || sale.millLocation;
        if (sale.target.type === 'port') {
          const port = locations[sale.target.location]?.name || sale.target.location;
          return name + ' sells cotton from ' + mill + ' via port at ' + port;
        }
        return name + ' sells cotton from ' + mill + ' to distant market';
      }
      return name + ' sells cotton';
    }
    case 'takeLoan':
      return name + ' takes a loan of £' + (action.amount || 30);
    case 'develop': {
      const types = (action.develops || []).map(t => industries[t]?.name || t).join(', ');
      return name + ' develops ' + types;
    }
    case 'pass':
      return name + ' passes';
    default:
      return name + ' performs ' + action.type;
  }
}

// ============ HELPERS ============

function getCardInfo(cardId) {
  if (cardId.startsWith('cotton_')) return { type: 'industry', industry: 'cottonMill' };
  if (cardId.startsWith('coal_')) return { type: 'industry', industry: 'coalMine' };
  if (cardId.startsWith('iron_')) return { type: 'industry', industry: 'ironWorks' };
  if (cardId.startsWith('port_')) return { type: 'industry', industry: 'port' };
  if (cardId.startsWith('shipyard_')) return { type: 'industry', industry: 'shipyard' };
  const parts = cardId.split('_');
  const loc = parts.slice(0, -1).join('_');
  return { type: 'location', location: loc };
}

function isConnectedToPortSimple(state, locId) {
  const connected = getConnectedLocations(state, locId);
  for (const cLoc of connected) {
    if (['liverpool', 'ellesmerePort', 'fleetwood'].includes(cLoc)) return true;
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.industryType === 'port' && slot.owner !== null) return true;
    }
  }
  return false;
}

// ============ BOT TURN EXECUTION ============

const botStrategy = new HeuristicBot();
const pendingBots = {}; // gameId -> timer, prevents duplicate scheduling

function checkAndPlayBot(gameId) {
  try {
    // Don't schedule if one is already pending for this game
    if (pendingBots[gameId]) return;

    const db = require('./db');
    const gs = db.getGameState(gameId);
    if (!gs) return;

    const state = JSON.parse(gs.state);
    if (state.phase !== 'actions') return;

    const currentSeat = state.turnOrder[state.currentPlayerIndex];
    const currentPlayer = state.players[currentSeat];
    if (!currentPlayer || !currentPlayer.isBot) return;

    console.log('[Bot] Scheduling turn for', currentPlayer.username, 'in game', gameId, 'delay:', botDelay + 'ms');
    pendingBots[gameId] = setTimeout(() => {
      delete pendingBots[gameId];
      try {
        playBotTurn(gameId);
      } catch (e) {
        console.error('[Bot] Error in playBotTurn:', e.message, e.stack);
      }
    }, botDelay);
  } catch (e) {
    console.error('[Bot] Error in checkAndPlayBot:', e.message, e.stack);
  }
}

function playBotTurn(gameId) {
  const db = require('./db');
  const gs = db.getGameState(gameId);
  if (!gs) { console.log('[Bot] No game state'); return; }

  let state = JSON.parse(gs.state);
  if (state.phase !== 'actions') { console.log('[Bot] Not in actions phase'); return; }

  const currentSeat = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players[currentSeat];
  if (!currentPlayer || !currentPlayer.isBot) { console.log('[Bot] Not a bot turn'); return; }

  // Choose action
  const action = botStrategy.chooseAction(state, currentPlayer);
  if (!action) {
    console.log('[Bot] No action chosen for', currentPlayer.username);
    return;
  }

  // Generate description
  const description = describeAction(action, currentPlayer, state);
  console.log('[Bot]', description);

  // Apply action (game engine adds its own log entry)
  const result = applyAction(state, currentPlayer.userId, action);
  if (result.error) {
    console.log('[Bot] Action failed:', result.error, '- falling back to pass');
    const passAction = { type: 'pass', cardPlayed: currentPlayer.hand[0] };
    const passResult = applyAction(state, currentPlayer.userId, passAction);
    if (passResult.error) {
      console.error('[Bot] Even pass failed:', passResult.error);
      return;
    }
    state = passResult.newState;
  } else {
    state = result.newState;
  }

  // Prefix new log entries with 🤖 for bot actions
  const oldLogLen = JSON.parse(gs.state).log.length;
  for (let i = oldLogLen; i < state.log.length; i++) {
    if (state.log[i] && !state.log[i].msg.startsWith('🤖')) {
      state.log[i].msg = '🤖 ' + state.log[i].msg;
      state.log[i].bot = true;
    }
  }

  // Save
  const success = db.updateGameState(gameId, JSON.stringify(state), gs.version);
  if (!success) {
    console.log('[Bot] State save failed (concurrent modification) - will retry');
    // Retry on next poll
    return;
  }

  // Log action
  db.addGameAction(gameId, currentPlayer.userId, action.type, JSON.stringify(action), gs.version);

  // Record results if game finished
  if (state.phase === 'finished') {
    db.updateGame(gameId, { status: 'finished' });
    const game = db.findGame(gameId);
    const maxVP = Math.max(...state.players.map(p => p.vp));
    db.addGameResult({
      game_id: gameId,
      game_name: game ? game.name : 'Unknown',
      finished_at: new Date().toISOString(),
      era: state.era,
      players: state.players.map(p => ({
        user_id: p.userId, username: p.username, seat: p.seat,
        vp: p.vp, income: p.income, money: p.money,
        is_winner: p.vp === maxVP, is_bot: p.isBot || false
      }))
    });
    console.log('[Bot] Game', gameId, 'finished!');
    return;
  }

  // Check if next player is also a bot
  checkAndPlayBot(gameId);
}

module.exports = { checkAndPlayBot, setBotDelay, getBotDelay, BotStrategy, HeuristicBot, describeAction };
