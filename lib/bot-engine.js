// AI Bot engine for Brass: Lancashire
// Pluggable architecture: currently uses heuristic strategy
// Can be swapped with DRL-trained model in the future

const { applyAction, getValidActions, getPlayerNetwork, isConnected, getConnectedLocations } = require('./game-engine');
const { locations, links, coalMarketPrices, ironMarketPrices } = require('./board-data');
const { industries } = require('./industry-data');

// ============ BOT INTERFACE ============

// This is the interface a DRL model would implement
class BotStrategy {
  /**
   * Given a game state and the bot's player info, return an action
   * @param {object} state - Full game state
   * @param {object} player - Bot's player object
   * @returns {object} action - Action to perform
   */
  chooseAction(state, player) {
    throw new Error('Not implemented');
  }
}

// ============ HEURISTIC STRATEGY ============

class HeuristicBot extends BotStrategy {
  chooseAction(state, player) {
    const hand = player.hand;
    if (hand.length === 0) return null;

    const cardPlayed = hand[0]; // simple: play first card

    // Priority: Sell > Build Industry > Build Link > Develop > Loan > Pass
    const action = this.trySellCotton(state, player, cardPlayed)
      || this.tryBuildIndustry(state, player, cardPlayed)
      || this.tryBuildLink(state, player, cardPlayed)
      || this.tryDevelop(state, player, cardPlayed)
      || this.tryLoan(state, player, cardPlayed)
      || { type: 'pass', cardPlayed };

    return action;
  }

  trySellCotton(state, player, cardPlayed) {
    // Find an unflipped cotton mill we own
    for (const [locId, loc] of Object.entries(state.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (slot.owner === player.seat && slot.industryType === 'cottonMill' && !slot.flipped) {
          // Find connected unflipped port
          const connected = getConnectedLocations(state, locId);
          for (const cLoc of connected) {
            const portLoc = state.board.locations[cLoc];
            if (!portLoc) continue;
            for (let j = 0; j < portLoc.slots.length; j++) {
              const portSlot = portLoc.slots[j];
              if (portSlot.industryType === 'port' && !portSlot.flipped && portSlot.owner !== null) {
                return {
                  type: 'sellCotton',
                  cardPlayed,
                  sales: [{
                    millLocation: locId,
                    millSlot: i,
                    target: { type: 'port', location: cLoc, slotIndex: j }
                  }]
                };
              }
            }
          }
          // Try distant market
          if (state.distantMarketDemand > 1 && isConnectedToPortSimple(state, locId)) {
            return {
              type: 'sellCotton',
              cardPlayed,
              sales: [{
                millLocation: locId,
                millSlot: i,
                target: { type: 'distant' }
              }]
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

    // Try to build cotton mills (most straightforward)
    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks', 'port']) {
      const mat = player.industryMat[industryType];
      if (!mat || mat.length === 0) continue;

      const level = mat[0];
      if (state.era === 'rail' && level <= 1) continue;
      if (industryType === 'shipyard' && level === 0) continue;

      const tileData = industries[industryType]?.levels[level];
      if (!tileData || player.money < tileData.cost) continue;

      // Find a valid location
      for (const [locId, loc] of Object.entries(state.board.locations)) {
        for (let i = 0; i < loc.slots.length; i++) {
          const slot = loc.slots[i];
          if (!slot.allowed.includes(industryType)) continue;
          if (slot.owner !== null) continue;

          // Check if we can play here with our card
          if (cardInfo.type === 'location' && cardInfo.location !== locId) continue;
          if (cardInfo.type === 'industry' && network.size > 0 && !network.has(locId)) continue;

          // Canal era: one per location
          if (state.era === 'canal' && loc.slots.some(s => s.owner === player.seat)) continue;

          return {
            type: 'buildIndustry',
            location: locId,
            slotIndex: i,
            industryType,
            cardPlayed
          };
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

      // Must connect to network
      if (network.size > 0 && !network.has(link.from) && !network.has(link.to)) continue;

      if (era === 'canal') {
        if (player.money >= 3) {
          return { type: 'buildLink', linkId: getLinkId(link), cardPlayed };
        }
      } else {
        if (player.money >= 10) { // 5 + estimated coal cost
          return { type: 'buildLink', linkId: getLinkId(link), cardPlayed };
        }
      }
    }
    return null;
  }

  tryDevelop(state, player, cardPlayed) {
    // Develop if we have low-level tiles blocking us
    for (const industryType of ['cottonMill', 'coalMine', 'ironWorks']) {
      const mat = player.industryMat[industryType];
      if (mat && mat.length > 0 && mat[0] <= 1 && state.era === 'rail') {
        return {
          type: 'develop',
          cardPlayed,
          develops: [industryType]
        };
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

function getLinkId(link) {
  return `${link.from}-${link.to}`;
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

function checkAndPlayBot(gameId) {
  const db = require('./db');
  const gs = db.getGameState(gameId);
  if (!gs) return;

  const state = JSON.parse(gs.state);
  if (state.phase !== 'actions') return;

  const currentSeat = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players[currentSeat];
  if (!currentPlayer || !currentPlayer.isBot) return;

  // Bot plays with a small delay to feel natural
  setTimeout(() => {
    playBotTurn(gameId);
  }, 1000);
}

function playBotTurn(gameId) {
  const db = require('./db');
  const gs = db.getGameState(gameId);
  if (!gs) return;

  let state = JSON.parse(gs.state);
  if (state.phase !== 'actions') return;

  const currentSeat = state.turnOrder[state.currentPlayerIndex];
  const currentPlayer = state.players[currentSeat];
  if (!currentPlayer || !currentPlayer.isBot) return;

  // Choose and apply action
  const action = botStrategy.chooseAction(state, currentPlayer);
  if (!action) return;

  const result = applyAction(state, currentPlayer.userId, action);
  if (result.error) {
    // Fallback to pass
    const passAction = { type: 'pass', cardPlayed: currentPlayer.hand[0] };
    const passResult = applyAction(state, currentPlayer.userId, passAction);
    if (passResult.error) return;
    state = passResult.newState;
  } else {
    state = result.newState;
  }

  // Save
  const success = db.updateGameState(gameId, JSON.stringify(state), gs.version);
  if (!success) return; // concurrent modification

  // Log
  db.addGameAction(gameId, currentPlayer.userId, action.type, JSON.stringify(action), gs.version);

  // Check if next player is also a bot
  checkAndPlayBot(gameId);
}

module.exports = { checkAndPlayBot, BotStrategy, HeuristicBot };
