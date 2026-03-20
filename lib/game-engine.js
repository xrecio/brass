// Core game engine: validates and applies all actions
const { locations, nonBuildable, links, coalMarketPrices, ironMarketPrices, incomeTrack, externalPortIds, MARKET_SLOTS, getMarketBuyPrice, getMarketSellPrice } = require('./board-data');
const { industries } = require('./industry-data');
// card-data used in game-setup.js, not here directly

// ============ HELPERS ============

function locName(locId) {
  return locations[locId]?.name || nonBuildable[locId]?.name || locId;
}

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function getPlayer(state, userId) {
  return state.players.find(p => p.userId === userId);
}

function getCurrentPlayer(state) {
  const seat = state.turnOrder[state.currentPlayerIndex];
  return state.players[seat];
}

function hasCard(player, cardId) {
  return player.hand.includes(cardId);
}

function removeCard(player, cardId) {
  const idx = player.hand.indexOf(cardId);
  if (idx >= 0) player.hand.splice(idx, 1);
}

function getCardInfo(cardId) {
  // Parse card ID to determine type and target
  if (cardId.startsWith('cotton_')) return { type: 'industry', industry: 'cottonMill' };
  if (cardId.startsWith('coal_')) return { type: 'industry', industry: 'coalMine' };
  if (cardId.startsWith('iron_')) return { type: 'industry', industry: 'ironWorks' };
  if (cardId.startsWith('port_')) return { type: 'industry', industry: 'port' };
  if (cardId.startsWith('shipyard_')) return { type: 'industry', industry: 'shipyard' };
  // Location cards: format is locationName_N
  const parts = cardId.split('_');
  const loc = parts.slice(0, -1).join('_');
  return { type: 'location', location: loc };
}

function adjustIncome(player, amount) {
  player.income = Math.max(0, Math.min(40, player.income + amount));
}

function dropIncomeBand(player) {
  // Drop one income band (for loans)
  // Each band is roughly 3-5 income levels depending on position
  if (player.income >= 31) player.income -= 3;
  else if (player.income >= 21) player.income -= 3;
  else if (player.income >= 11) player.income -= 2;
  else player.income = Math.max(0, player.income - 1);
}

// ============ NETWORK / CONNECTIVITY ============

function getPlayerNetwork(state, seat) {
  // Returns set of location IDs in this player's personal network
  const locs = new Set();

  // Locations where player has industry tiles
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.owner === seat) locs.add(locId);
    }
  }

  // Locations connected by player's own links
  for (const link of Object.values(state.board.links)) {
    if (link.owner === seat) {
      locs.add(link.from);
      locs.add(link.to);
    }
  }

  return locs;
}

function isConnected(state, fromLoc, toLoc) {
  // BFS using ANY player's links (for transport/selling)
  if (fromLoc === toLoc) return true;
  const visited = new Set();
  const queue = [fromLoc];
  visited.add(fromLoc);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const link of Object.values(state.board.links)) {
      if (link.type === null) continue; // unbuilt link
      let neighbor = null;
      if (link.from === current) neighbor = link.to;
      else if (link.to === current) neighbor = link.from;
      if (neighbor && !visited.has(neighbor)) {
        if (neighbor === toLoc) return true;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return false;
}

function getConnectedLocations(state, startLoc) {
  // BFS from startLoc through any built links
  const visited = new Set();
  const queue = [startLoc];
  visited.add(startLoc);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const link of Object.values(state.board.links)) {
      if (link.type === null) continue;
      let neighbor = null;
      if (link.from === current) neighbor = link.to;
      else if (link.to === current) neighbor = link.from;
      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return visited;
}

function isConnectedToPort(state, locId) {
  // Check if location is connected to any port (built port tile or external port location)
  const connected = getConnectedLocations(state, locId);
  for (const cLoc of connected) {
    // Check for external port locations (Scotland, Yorkshire, The Midlands)
    if (externalPortIds.includes(cLoc)) return true;
    // Check for built port tiles
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (const slot of loc.slots) {
      if (slot.industryType === 'port' && slot.owner !== null) return true;
    }
  }
  return false;
}

// ============ RESOURCE CONSUMPTION ============

function findAndConsumeIron(state, amount) {
  // Iron can come from any tile on the board (no transport needed)
  let remaining = amount;
  const costs = { money: 0, flipped: [] };

  // First: take from board tiles
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (let i = 0; i < loc.slots.length; i++) {
      const slot = loc.slots[i];
      if (slot.industryType === 'ironWorks' && !slot.flipped && slot.resources > 0) {
        const take = Math.min(remaining, slot.resources);
        slot.resources -= take;
        remaining -= take;
        if (slot.resources === 0) {
          slot.flipped = true;
          const levelData = industries.ironWorks.levels[slot.level];
          adjustIncome(state.players[slot.owner], levelData.incomeGain);
          costs.flipped.push({ loc: locId, slot: i, owner: slot.owner });
        }
        if (remaining === 0) return costs;
      }
    }
  }

  // Then: take from external market
  if (remaining > 0 && state.ironMarket > 0) {
    const take = Math.min(remaining, state.ironMarket);
    for (let i = 0; i < take; i++) {
      costs.money += getMarketBuyPrice(state.ironMarket);
      state.ironMarket--;
    }
    remaining -= take;
  }

  // Then: take from bank at price 5
  if (remaining > 0) {
    costs.money += remaining * 5;
    remaining = 0;
  }

  return costs;
}

function findAndConsumeCoal(state, targetLoc, amount) {
  // Coal MUST be transported - find cheapest connected source via BFS
  let remaining = amount;
  const costs = { money: 0, flipped: [] };
  const connected = getConnectedLocations(state, targetLoc);

  // First: take from connected board tiles (sorted by distance - BFS already handles this)
  for (const cLoc of connected) {
    const loc = state.board.locations[cLoc];
    if (!loc) continue;
    for (let i = 0; i < loc.slots.length; i++) {
      const slot = loc.slots[i];
      if (slot.industryType === 'coalMine' && !slot.flipped && slot.resources > 0) {
        const take = Math.min(remaining, slot.resources);
        slot.resources -= take;
        remaining -= take;
        if (slot.resources === 0) {
          slot.flipped = true;
          const levelData = industries.coalMine.levels[slot.level];
          adjustIncome(state.players[slot.owner], levelData.incomeGain);
          costs.flipped.push({ loc: cLoc, slot: i, owner: slot.owner });
        }
        if (remaining === 0) return costs;
      }
    }
  }

  // Then: if connected to any port, buy from external market
  if (remaining > 0 && isConnectedToPort(state, targetLoc)) {
    if (state.coalMarket > 0) {
      const take = Math.min(remaining, state.coalMarket);
      for (let i = 0; i < take; i++) {
        costs.money += getMarketBuyPrice(state.coalMarket);
        state.coalMarket--;
      }
      remaining -= take;
    }
    // If market empty, buy from bank at 5
    if (remaining > 0) {
      costs.money += remaining * 5;
      remaining = 0;
    }
  }

  if (remaining > 0) {
    return null; // cannot consume coal - not connected
  }
  return costs;
}

function canConsumeCoal(state, targetLoc, amount) {
  // Check without modifying state
  const testState = clone(state);
  return findAndConsumeCoal(testState, targetLoc, amount) !== null;
}

// ============ ACTION VALIDATORS & APPLIERS ============

function applyAction(state, userId, action) {
  const s = clone(state);
  const player = getPlayer(s, userId);
  const currentPlayer = getCurrentPlayer(s);

  if (!player || player.seat !== currentPlayer.seat) {
    return { error: 'Not your turn' };
  }
  if (s.phase !== 'actions') {
    return { error: 'Game is not in action phase' };
  }

  let result;
  switch (action.type) {
    case 'buildIndustry': result = actionBuildIndustry(s, player, action); break;
    case 'buildLink': result = actionBuildLink(s, player, action); break;
    case 'sellCotton': result = actionSellCotton(s, player, action); break;
    case 'takeLoan': result = actionTakeLoan(s, player, action); break;
    case 'develop': result = actionDevelop(s, player, action); break;
    case 'pass': result = actionPass(s, player, action); break;
    default: return { error: 'Unknown action type' };
  }

  if (result.error) return result;

  // Advance turn
  advanceTurn(s);

  return { newState: s };
}

function actionBuildIndustry(state, player, action) {
  const { location, slotIndex, industryType, cardPlayed } = action;

  // Validate card
  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };

  // Validate location and slot
  const loc = state.board.locations[location];
  if (!loc) return { error: 'Invalid location' };
  if (slotIndex < 0 || slotIndex >= loc.slots.length) return { error: 'Invalid slot' };

  const slot = loc.slots[slotIndex];
  if (!slot.allowed.includes(industryType)) return { error: 'Industry not allowed in this slot' };

  // Check slot availability
  if (slot.owner !== null) {
    // Can overbuild own tiles with higher tech or opponent coal/iron if market bottomed
    if (slot.owner === player.seat) {
      // OK - overbuilding own
    } else if ((slot.industryType === 'coalMine' || slot.industryType === 'ironWorks')) {
      const marketKey = slot.industryType === 'coalMine' ? 'coalMarket' : 'ironMarket';
      if (state[marketKey] > 0) return { error: 'Cannot overbuild opponent - market not empty' };
    } else {
      return { error: 'Slot occupied by another player' };
    }
  }

  // Canal era: one industry per location
  if (state.era === 'canal') {
    const hasIndustryHere = loc.slots.some(s => s.owner === player.seat);
    if (hasIndustryHere && slot.owner !== player.seat) {
      return { error: 'Canal era: one industry per location' };
    }
  }

  // Get top tile from player's mat
  const mat = player.industryMat[industryType];
  if (!mat || mat.length === 0) return { error: 'No tiles available' };
  const level = mat[0];

  // Rail era: cannot build level 1
  if (state.era === 'rail' && level <= 1) return { error: 'Cannot build level 1 in Rail era' };

  // Shipyard level 0 cannot be built
  if (industryType === 'shipyard' && level === 0) return { error: 'Must develop through level 0 shipyard' };

  const tileData = industries[industryType].levels[level];
  if (!tileData) return { error: 'Invalid tile level' };

  // Check card validity for this location
  const cardInfo = getCardInfo(cardPlayed);
  const network = getPlayerNetwork(state, player.seat);

  if (cardInfo.type === 'location') {
    if (cardInfo.location !== location) return { error: 'Card does not match location' };
  } else if (cardInfo.type === 'industry') {
    // Industry card: must be in personal network (or no tiles on board = play anywhere)
    if (network.size > 0 && !network.has(location)) {
      return { error: 'Location not in your network (for industry card)' };
    }
  }

  // Check money
  if (player.money < tileData.cost) return { error: 'Not enough money' };

  // Consume resources
  let totalResourceCost = 0;

  if (tileData.ironCost > 0) {
    const ironResult = findAndConsumeIron(state, tileData.ironCost);
    totalResourceCost += ironResult.money;
  }

  if (tileData.coalCost > 0) {
    const coalResult = findAndConsumeCoal(state, location, tileData.coalCost);
    if (!coalResult) return { error: 'Cannot get coal to this location' };
    totalResourceCost += coalResult.money;
  }

  if (player.money < tileData.cost + totalResourceCost) {
    return { error: 'Not enough money for tile + resources' };
  }

  // Apply
  const totalCost = tileData.cost + totalResourceCost;
  player.money -= totalCost;
  player.spentThisRound += totalCost;
  removeCard(player, cardPlayed);
  mat.shift(); // remove top tile from mat

  slot.owner = player.seat;
  slot.industryType = industryType;
  slot.level = level;
  slot.flipped = false;
  slot.resources = tileData.resources || 0;

  // Coal/Iron: if has resources, try to sell to external market
  if (industryType === 'ironWorks' && slot.resources > 0) {
    // Move iron to external market if not full (8 slots)
    while (slot.resources > 0 && state.ironMarket < MARKET_SLOTS) {
      const sellPrice = getMarketSellPrice(state.ironMarket);
      slot.resources--;
      state.ironMarket++;
      player.money += sellPrice;
    }
    if (slot.resources === 0) {
      slot.flipped = true;
      adjustIncome(player, tileData.incomeGain);
    }
  }

  if (industryType === 'coalMine' && slot.resources > 0 && isConnectedToPort(state, location)) {
    while (slot.resources > 0 && state.coalMarket < MARKET_SLOTS) {
      const sellPrice = getMarketSellPrice(state.coalMarket);
      slot.resources--;
      state.coalMarket++;
      player.money += sellPrice;
    }
    if (slot.resources === 0) {
      slot.flipped = true;
      adjustIncome(player, tileData.incomeGain);
    }
  }

  // Shipyard: flip immediately
  if (industryType === 'shipyard') {
    slot.flipped = true;
    adjustIncome(player, tileData.incomeGain);
  }

  state.log.push({ msg: `${player.username} built ${industries[industryType].name} L${level} at ${locations[location].name} (spent £${totalCost}, has £${player.money}, inc ${player.income})` });
  return { success: true };
}

function actionBuildLink(state, player, action) {
  const { linkId, cardPlayed, secondLinkId } = action;

  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };

  const link = state.board.links[linkId];
  if (!link) return { error: 'Invalid link' };
  if (link.owner !== null) return { error: 'Link already built' };

  const network = getPlayerNetwork(state, player.seat);

  // Must connect to personal network (unless no tiles on board)
  if (network.size > 0 && !network.has(link.from) && !network.has(link.to)) {
    return { error: 'Link must connect to your network' };
  }

  // segments: links through non-buildable locations count as 2
  const seg = link.segments || 1;

  if (state.era === 'canal') {
    if (!link.canal) return { error: 'This link is not available in Canal era' };
    const canalCost = 3 * seg; // £3 per segment
    if (player.money < canalCost) return { error: `Not enough money (costs £${canalCost})` };

    player.money -= canalCost;
    player.spentThisRound += canalCost;
    link.owner = player.seat;
    link.type = 'canal';
    removeCard(player, cardPlayed);

    const throughNote = link.through ? ` (via ${link.through})` : '';
    state.log.push({ msg: `${player.username} built canal ${locName(link.from)} - ${locName(link.to)}${throughNote} (spent £${canalCost}, has £${player.money})` });
  } else {
    // Rail era
    if (!link.rail) return { error: 'This link is not available in Rail era' };

    if (secondLinkId) {
      // Building 2 links in one action
      const link2 = state.board.links[secondLinkId];
      if (!link2) return { error: 'Invalid second link' };
      if (link2.owner !== null) return { error: 'Second link already built' };
      if (!link2.rail) return { error: 'Second link not available in Rail era' };

      const seg2 = link2.segments || 1;
      // Per rules: 2 tracks in one action = £15 flat cost
      const baseCost = 15;

      if (player.money < baseCost) return { error: 'Not enough money (2 tracks costs £15)' };

      // Need coal for each segment
      const coalCost1 = findAndConsumeCoal(state, link.from, seg);
      if (!coalCost1) return { error: 'Cannot transport coal to first link' };
      const coalCost2 = findAndConsumeCoal(state, link2.from, seg2);
      if (!coalCost2) return { error: 'Cannot transport coal to second link' };

      const totalMoney = baseCost + coalCost1.money + coalCost2.money;
      if (player.money < totalMoney) return { error: 'Not enough money' };

      player.money -= totalMoney;
      player.spentThisRound += totalMoney;
      link.owner = player.seat;
      link.type = 'rail';
      link2.owner = player.seat;
      link2.type = 'rail';
      removeCard(player, cardPlayed);

      state.log.push({ msg: `${player.username} built 2 rail links (spent £${totalMoney}, has £${player.money})` });
    } else {
      // Building 1 link
      const railCost = 5 * seg; // £5 per segment
      if (player.money < railCost) return { error: `Not enough money (costs £${railCost} + coal)` };

      const coalCost = findAndConsumeCoal(state, link.from, seg);
      if (!coalCost) return { error: 'Cannot transport coal to link' };

      const totalMoney = railCost + coalCost.money;
      if (player.money < totalMoney) return { error: 'Not enough money' };

      player.money -= totalMoney;
      player.spentThisRound += totalMoney;
      link.owner = player.seat;
      link.type = 'rail';
      removeCard(player, cardPlayed);

      const throughNote = link.through ? ` (via ${link.through})` : '';
      state.log.push({ msg: `${player.username} built rail ${locName(link.from)} - ${locName(link.to)}${throughNote} (spent £${totalMoney}, has £${player.money})` });
    }
  }

  return { success: true };
}

function actionSellCotton(state, player, action) {
  const { cardPlayed, sales } = action;
  // sales is an array of { millLocation, millSlot, target }
  // target can be { type: 'port', location, slotIndex } or { type: 'distant' }

  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };

  if (!sales || sales.length === 0) return { error: 'Must sell at least one mill' };

  for (const sale of sales) {
    const loc = state.board.locations[sale.millLocation];
    if (!loc) return { error: 'Invalid mill location' };

    const millSlot = loc.slots[sale.millSlot];
    if (!millSlot || millSlot.owner !== player.seat) return { error: 'Not your cotton mill' };
    if (millSlot.industryType !== 'cottonMill') return { error: 'Not a cotton mill' };
    if (millSlot.flipped) return { error: 'Mill already flipped' };

    if (sale.target.type === 'port') {
      // Sell through a port tile
      const portLoc = state.board.locations[sale.target.location];
      if (!portLoc) return { error: 'Invalid port location' };
      const portSlot = portLoc.slots[sale.target.slotIndex];
      if (!portSlot || portSlot.industryType !== 'port') return { error: 'Not a port' };
      if (portSlot.flipped) return { error: 'Port already flipped' };

      // Check connection
      if (!isConnected(state, sale.millLocation, sale.target.location)) {
        return { error: 'Mill not connected to port' };
      }

      // Flip both
      millSlot.flipped = true;
      const millData = industries.cottonMill.levels[millSlot.level];
      adjustIncome(state.players[millSlot.owner], millData.incomeGain);

      portSlot.flipped = true;
      const portData = industries.port.levels[portSlot.level];
      adjustIncome(state.players[portSlot.owner], portData.incomeGain);

      state.log.push({ msg: `${player.username} sold cotton from ${locations[sale.millLocation].name} via port at ${locations[sale.target.location].name} (inc ${state.players[millSlot.owner].income})` });

    } else if (sale.target.type === 'distant') {
      // Sell to distant market
      if (!isConnectedToPort(state, sale.millLocation)) {
        return { error: 'Mill not connected to any port for distant market' };
      }
      if (state.distantMarketDemand <= 0) {
        return { error: 'Distant market bottomed out' };
      }
      if (!state.distantMarketTiles || state.distantMarketTiles.length === 0) {
        return { error: 'No demand tiles remaining' };
      }

      // Flip a demand tile
      const tile = state.distantMarketTiles.shift();
      if (!state.distantMarketFlipped) state.distantMarketFlipped = [];
      state.distantMarketFlipped.push(tile);
      const drop = Math.abs(tile);
      state.distantMarketDemand = Math.max(0, state.distantMarketDemand - drop);

      state.log.push({ msg: `${player.username} flipped demand tile: ${tile} (demand now ${state.distantMarketDemand})` });

      if (state.distantMarketDemand <= 0) {
        // Bottomed out - action ends, mill does NOT flip
        state.log.push({ msg: 'Distant market bottomed out! Mill does not flip.' });
        break;
      }

      // Mill flips, gain income bonus equal to remaining demand
      millSlot.flipped = true;
      const millData = industries.cottonMill.levels[millSlot.level];
      adjustIncome(state.players[millSlot.owner], millData.incomeGain);
      adjustIncome(player, state.distantMarketDemand);

      state.log.push({ msg: `${player.username} sold cotton to distant market (demand: ${state.distantMarketDemand}, inc ${player.income})` });
    }
  }

  removeCard(player, cardPlayed);
  return { success: true };
}

function actionTakeLoan(state, player, action) {
  const { cardPlayed, amount } = action;

  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };

  // Rail era: cannot take loan after draw deck exhausted
  if (state.era === 'rail' && state.drawPile.length === 0) {
    return { error: 'Cannot take loans after draw deck is exhausted in Rail era' };
  }

  const loanAmount = amount || 30; // default to max loan
  if (![10, 20, 30].includes(loanAmount)) return { error: 'Loan must be 10, 20, or 30' };

  player.money += loanAmount;
  const bands = loanAmount / 10;
  for (let i = 0; i < bands; i++) {
    dropIncomeBand(player);
  }

  removeCard(player, cardPlayed);
  state.log.push({ msg: `${player.username} took a loan of £${loanAmount} (has £${player.money}, inc ${player.income})` });
  return { success: true };
}

function actionDevelop(state, player, action) {
  const { cardPlayed, develops } = action;
  // develops: array of industryType strings to develop (1-2)

  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };
  if (!develops || develops.length === 0 || develops.length > 2) {
    return { error: 'Must develop 1 or 2 tiles' };
  }

  // Each develop costs 1 iron
  const totalIron = develops.length;

  // Check iron availability (don't consume yet)
  const testState = clone(state);
  const ironResult = findAndConsumeIron(testState, totalIron);
  if (player.money < ironResult.money) return { error: 'Not enough money for iron' };

  // Now actually consume
  const actualIronResult = findAndConsumeIron(state, totalIron);
  player.money -= actualIronResult.money;
  player.spentThisRound += actualIronResult.money;

  for (const industryType of develops) {
    const mat = player.industryMat[industryType];
    if (!mat || mat.length === 0) return { error: `No ${industryType} tiles to develop` };
    const removed = mat.shift();
    if (!player.developedTiles) player.developedTiles = [];
    player.developedTiles.push({ type: industryType, level: removed });
    state.log.push({ msg: `${player.username} developed ${industries[industryType].name} L${removed} (spent £${actualIronResult.money}, has £${player.money})` });
  }

  removeCard(player, cardPlayed);
  return { success: true };
}

function actionPass(state, player, action) {
  const { cardPlayed } = action;
  if (!hasCard(player, cardPlayed)) return { error: 'You don\'t have that card' };
  removeCard(player, cardPlayed);
  state.log.push({ msg: `${player.username} passed` });
  return { success: true };
}

// ============ TURN / ROUND MANAGEMENT ============

function advanceTurn(state) {
  state.actionsRemaining--;

  if (state.actionsRemaining <= 0) {
    // Move to next player
    state.currentPlayerIndex++;

    if (state.currentPlayerIndex >= state.turnOrder.length) {
      // All players have gone - end of round
      endRound(state);
    } else {
      // First round of Canal era: each player gets only 1 action
      state.actionsRemaining = (state.era === 'canal' && state.round === 1) ? 1 : 2;
    }
  }
}

function endRound(state) {
  // Collect income for all players
  for (const player of state.players) {
    const incomeAmount = incomeTrack[player.income] || 0;
    player.money += incomeAmount;
    if (player.money < 0) player.money = 0; // can't go below 0 (simplified)
    player.spentThisRound = 0;
  }

  // Check if era is over (draw pile empty and all hands empty)
  const allHandsEmpty = state.players.every(p => p.hand.length === 0);
  if (state.drawPile.length === 0 && allHandsEmpty) {
    endEra(state);
    return;
  }

  // Reorder by spending (ascending - least spent goes first)
  const order = state.players
    .map((p, i) => ({ seat: i, spent: p.spentThisRound }))
    .sort((a, b) => a.spent - b.spent)
    .map(p => p.seat);
  state.turnOrder = order;

  // Refill hands
  for (const seat of state.turnOrder) {
    const player = state.players[seat];
    while (player.hand.length < 8 && state.drawPile.length > 0) {
      player.hand.push(state.drawPile.shift());
    }
  }

  state.round++;
  state.currentPlayerIndex = 0;
  state.actionsRemaining = 2;
}

function endEra(state) {
  const scoring = require('./scoring');

  if (state.era === 'canal') {
    scoring.scoreCanalEra(state);
    const { transitionToRailEra } = require('./game-setup');
    const newState = transitionToRailEra(state);
    Object.assign(state, newState);
  } else {
    // Rail era scoring = game over
    scoring.scoreRailEra(state);
    state.phase = 'finished';
    // Add money bonus
    for (const player of state.players) {
      player.vp += Math.floor(player.money / 10);
    }
    state.log.push({ msg: '=== Game Over ===' });
    for (const p of state.players) {
      const moneyVP = Math.floor(p.money / 10);
      state.log.push({ msg: `${p.username}: ${p.vp} VP (inc £${p.money} → +${moneyVP} VP)` });
    }

    // Determine winner
    const winner = state.players.reduce((best, p) =>
      p.vp > best.vp ? p : best, state.players[0]);
    state.log.push({ msg: `🏆 ${winner.username} wins with ${winner.vp} VP!` });
  }
}

// ============ PUBLIC API ============

function getValidActions(state, userId) {
  // Returns list of valid action types for UI hints
  const player = getPlayer(state, userId);
  if (!player) return [];
  const current = getCurrentPlayer(state);
  if (player.seat !== current.seat) return [];
  if (state.phase !== 'actions') return [];

  const actions = ['pass']; // can always pass

  if (player.hand.length > 0) {
    actions.push('takeLoan');
    actions.push('develop');
    actions.push('buildIndustry');
    actions.push('buildLink');
    actions.push('sellCotton');
  }

  return actions;
}

module.exports = { applyAction, getValidActions, getPlayerNetwork, isConnected, getConnectedLocations };
