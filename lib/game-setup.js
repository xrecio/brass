// Initialize a new game state
const { locations, links } = require('./board-data');
const { industries } = require('./industry-data');
const { buildDeck, shuffle, cardsToRemove } = require('./card-data');

function createInitialState(players, numPlayers) {
  // Build and shuffle deck, remove cards for player count
  let deck = shuffle(buildDeck());
  const removeCount = cardsToRemove[numPlayers]?.canal || 0;
  deck = deck.slice(removeCount); // remove from top

  // Deal 8 cards to each player
  const playerStates = players.map((p, i) => {
    const hand = deck.splice(0, 8);
    return {
      seat: i,
      userId: p.userId,
      username: p.username,
      isBot: p.isBot || false,
      color: p.color,
      money: 30,
      income: 10, // level 10 = £0 income
      vp: 0,
      spentThisRound: 0,
      hand: hand.map(c => c.id),
      industryMat: buildIndustryMat()
    };
  });

  // Initialize board
  const boardLocations = {};
  for (const [locId, loc] of Object.entries(locations)) {
    boardLocations[locId] = {
      slots: loc.slots.map(s => ({
        allowed: s.allowed,
        owner: null,
        industryType: null,
        level: null,
        flipped: false,
        resources: 0
      }))
    };
  }

  const boardLinks = {};
  for (const link of links) {
    boardLinks[link.id] = {
      from: link.from,
      to: link.to,
      canal: link.canal,
      rail: link.rail,
      owner: null,
      type: null // 'canal' or 'rail'
    };
  }

  // Random turn order
  const turnOrder = players.map((_, i) => i);
  for (let i = turnOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
  }

  return {
    era: 'canal',
    round: 1,
    turnOrder,
    currentPlayerIndex: 0,
    actionsRemaining: 1, // first turn of canal = 1 action
    phase: 'actions',
    numPlayers,
    players: playerStates,
    board: {
      locations: boardLocations,
      links: boardLinks
    },
    coalMarket: 13, // cubes in external market
    ironMarket: 12,
    distantMarketDemand: 8,
    drawPile: deck.map(c => c.id),
    discardPile: [],
    log: []
  };
}

function buildIndustryMat() {
  return {
    cottonMill: [1, 2, 3, 4],
    coalMine: [1, 2, 3, 4],
    ironWorks: [1, 2, 3, 4],
    port: [1, 2],
    shipyard: [0, 1, 2]
  };
}

// Prepare state for rail era transition
function transitionToRailEra(state) {
  const newState = JSON.parse(JSON.stringify(state));

  // Remove all canal links
  for (const linkId of Object.keys(newState.board.links)) {
    const link = newState.board.links[linkId];
    if (link.type === 'canal') {
      link.owner = null;
      link.type = null;
    }
  }

  // Remove all level 1 industry tiles from board
  for (const locId of Object.keys(newState.board.locations)) {
    const loc = newState.board.locations[locId];
    for (const slot of loc.slots) {
      if (slot.owner !== null && slot.level === 1) {
        slot.owner = null;
        slot.industryType = null;
        slot.level = null;
        slot.flipped = false;
        slot.resources = 0;
      }
    }
  }

  // Reset distant market and coal/iron markets
  newState.distantMarketDemand = 8;
  newState.coalMarket = 13;
  newState.ironMarket = 12;

  // Rebuild and deal new cards
  const { shuffle: shuffleFn, buildDeck } = require('./card-data');
  let deck = shuffleFn(buildDeck());
  const removeCount = cardsToRemove[newState.numPlayers]?.rail || 0;
  deck = deck.slice(removeCount);

  for (const player of newState.players) {
    player.hand = deck.splice(0, 8).map(c => c.id);
    player.spentThisRound = 0;
  }

  newState.drawPile = deck.map(c => c.id);
  newState.discardPile = [];
  newState.era = 'rail';
  newState.round = 1;
  newState.currentPlayerIndex = 0;
  newState.actionsRemaining = 2; // no first-turn restriction in rail era
  newState.phase = 'actions';

  // Recompute turn order by VP (ascending) for rail era start
  newState.turnOrder = newState.players
    .map((p, i) => ({ seat: i, vp: p.vp }))
    .sort((a, b) => a.vp - b.vp)
    .map(p => p.seat);

  newState.log.push({ msg: '=== Rail Era begins ===' });
  return newState;
}

module.exports = { createInitialState, transitionToRailEra };
