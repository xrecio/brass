// Game UI controller
const GameUI = {
  selectedAction: null,
  selectedCard: null,
  actionStep: 0,
  actionParams: {},

  init() {
    BoardRenderer.init();
    this.updateAll();
    this.startPolling();
  },

  updateAll() {
    this.updatePlayerBar();
    this.updateGameInfo();
    this.updateMarkets();
    this.updateActionPanel();
    this.updateHand();
    this.updateMat();
    this.updateLog();
    BoardRenderer.render();
  },

  // ============ POLLING ============

  startPolling() {
    setInterval(() => this.poll(), 3000);
  },

  async poll() {
    try {
      const res = await fetch(`/api/games/${GAME_ID}/state?version=${stateVersion}`);
      if (res.status === 304) return;
      if (!res.ok) return;
      const data = await res.json();
      if (data.state && data.state.incompatible) {
        document.querySelector('.game-container').innerHTML =
          '<div style="text-align:center;padding:80px 20px"><h2 style="color:#e94560">Game No Longer Playable</h2>' +
          '<p>This game was created with an older version that is no longer compatible.</p>' +
          '<a href="/lobby" class="btn btn-primary" style="margin-top:16px">Back to Lobby</a></div>';
        return;
      }
      gameState = data.state;
      stateVersion = data.version;
      this.updateAll();
    } catch (e) {
      // silently ignore polling errors
    }
  },

  // ============ PLAYER BAR ============

  updatePlayerBar() {
    const bar = document.getElementById('player-bar');
    const state = gameState;
    const currentSeat = state.turnOrder[state.currentPlayerIndex];

    bar.innerHTML = state.players.map(p => {
      const isCurrent = p.seat === currentSeat && state.phase === 'actions';
      const isMe = p.userId === USER_ID;
      return `
        <div class="player-info ${isCurrent ? 'current' : ''} ${isMe ? 'me' : ''}"
             style="border-color: ${BOARD.playerColors[p.seat]}">
          <div class="player-name" style="color: ${BOARD.playerColors[p.seat]}">
            ${p.username}${p.isBot ? ' (Bot)' : ''}
            ${isCurrent ? ' *' : ''}
          </div>
          <div class="player-stats">
            <span title="Money">£${p.money}</span>
            <span title="Income">Inc: ${p.income}</span>
            <span title="Victory Points">VP: ${p.vp}</span>
            <span title="Cards">${p.hand ? p.hand.length : p.handCount || 0} cards</span>
          </div>
        </div>
      `;
    }).join('');
  },

  // ============ GAME INFO ============

  updateGameInfo() {
    const panel = document.getElementById('game-info');
    const s = gameState;
    const currentSeat = s.turnOrder[s.currentPlayerIndex];
    const currentPlayer = s.players[currentSeat];

    if (s.phase === 'finished') {
      const winner = s.players.reduce((best, p) => p.vp > best.vp ? p : best, s.players[0]);
      panel.innerHTML = `
        <h3>Game Over!</h3>
        <p>Winner: <strong>${winner.username}</strong> with ${winner.vp} VP</p>
      `;
      return;
    }

    panel.innerHTML = `
      <div class="info-row"><strong>Era:</strong> ${s.era === 'canal' ? 'Canal' : 'Rail'}</div>
      <div class="info-row"><strong>Round:</strong> ${s.round}</div>
      <div class="info-row"><strong>Turn:</strong> ${currentPlayer.username} (${s.actionsRemaining} actions left)</div>
      <div class="info-row"><strong>Deck:</strong> ${s.drawPile.length} cards</div>
    `;
  },

  // ============ MARKETS ============

  updateMarkets() {
    const panel = document.getElementById('market-panel');
    const s = gameState;
    panel.innerHTML = `
      <h4>Markets</h4>
      <div class="market-row">
        <span>Coal: ${s.coalMarket}/13</span>
        <div class="market-bar"><div class="market-fill coal" style="width:${s.coalMarket/13*100}%"></div></div>
      </div>
      <div class="market-row">
        <span>Iron: ${s.ironMarket}/12</span>
        <div class="market-bar"><div class="market-fill iron" style="width:${s.ironMarket/12*100}%"></div></div>
      </div>
      <div class="market-row">
        <span>Demand: ${s.distantMarketDemand}/8</span>
        <div class="market-bar"><div class="market-fill demand" style="width:${s.distantMarketDemand/8*100}%"></div></div>
      </div>
    `;
  },

  // ============ ACTION PANEL ============

  updateActionPanel() {
    const panel = document.getElementById('action-panel');
    const s = gameState;
    const currentSeat = s.turnOrder[s.currentPlayerIndex];
    const myPlayer = s.players.find(p => p.userId === USER_ID);

    if (!myPlayer || myPlayer.seat !== currentSeat || s.phase !== 'actions') {
      panel.innerHTML = '<p class="muted">Waiting for other players...</p>';
      return;
    }

    if (this.selectedAction) {
      this.renderActionFlow(panel);
      return;
    }

    panel.innerHTML = `
      <h4>Your Turn (${s.actionsRemaining} action${s.actionsRemaining > 1 ? 's' : ''} left)</h4>
      <div class="action-buttons">
        <button class="btn action-btn" onclick="GameUI.startAction('buildIndustry')">Build Industry</button>
        <button class="btn action-btn" onclick="GameUI.startAction('buildLink')">Build Link</button>
        <button class="btn action-btn" onclick="GameUI.startAction('sellCotton')">Sell Cotton</button>
        <button class="btn action-btn" onclick="GameUI.startAction('takeLoan')">Take Loan</button>
        <button class="btn action-btn" onclick="GameUI.startAction('develop')">Develop</button>
        <button class="btn action-btn" onclick="GameUI.startAction('pass')">Pass</button>
      </div>
    `;
  },

  startAction(type) {
    this.selectedAction = type;
    this.selectedCard = null;
    this.actionStep = 0;
    this.actionParams = { type };
    BoardRenderer.clearHighlights();
    this.updateActionPanel();
    this.updateHand();
  },

  cancelAction() {
    this.selectedAction = null;
    this.selectedCard = null;
    this.actionStep = 0;
    this.actionParams = {};
    BoardRenderer.clearHighlights();
    this.updateActionPanel();
    this.updateHand();
  },

  renderActionFlow(panel) {
    const type = this.selectedAction;

    switch (type) {
      case 'pass':
        panel.innerHTML = `
          <h4>Pass</h4>
          <p>Select a card to discard:</p>
          ${this.selectedCard ? `
            <p>Discarding: ${this.selectedCard}</p>
            <button class="btn btn-primary" onclick="GameUI.submitAction()">Confirm Pass</button>
          ` : '<p class="muted">Click a card in your hand</p>'}
          <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
        `;
        break;

      case 'takeLoan':
        panel.innerHTML = `
          <h4>Take Loan</h4>
          ${this.selectedCard ? `
            <p>Discarding: ${this.selectedCard}</p>
            <div class="loan-buttons">
              <button class="btn" onclick="GameUI.actionParams.amount=10;GameUI.submitAction()">£10 (1 band)</button>
              <button class="btn" onclick="GameUI.actionParams.amount=20;GameUI.submitAction()">£20 (2 bands)</button>
              <button class="btn btn-primary" onclick="GameUI.actionParams.amount=30;GameUI.submitAction()">£30 (3 bands)</button>
            </div>
          ` : '<p>Select a card to discard:</p>'}
          <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
        `;
        break;

      case 'develop':
        if (!this.selectedCard) {
          panel.innerHTML = `<h4>Develop</h4><p>Select a card to discard:</p>
            <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
        } else {
          const myPlayer = gameState.players.find(p => p.userId === USER_ID);
          const develops = this.actionParams.develops || [];
          panel.innerHTML = `
            <h4>Develop (${develops.length}/2 tiles)</h4>
            <p>Choose industry tiles to remove from your mat:</p>
            <div class="develop-options">
              ${Object.entries(myPlayer.industryMat).map(([type, levels]) =>
                levels.length > 0 ? `<button class="btn ${develops.includes(type) ? 'btn-primary' : ''}"
                  onclick="GameUI.toggleDevelop('${type}')">${type} L${levels[0]}</button>` : ''
              ).join('')}
            </div>
            ${develops.length > 0 ? `<button class="btn btn-primary" onclick="GameUI.submitAction()">Confirm Develop</button>` : ''}
            <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
          `;
        }
        break;

      case 'buildIndustry':
        this.renderBuildIndustryFlow(panel);
        break;

      case 'buildLink':
        this.renderBuildLinkFlow(panel);
        break;

      case 'sellCotton':
        this.renderSellCottonFlow(panel);
        break;

      default:
        panel.innerHTML = `<p>Unknown action</p><button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
    }
  },

  renderBuildIndustryFlow(panel) {
    const p = this.actionParams;

    if (!this.selectedCard) {
      panel.innerHTML = `<h4>Build Industry</h4><p>Select a card to play:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
      return;
    }

    if (!p.industryType) {
      const myPlayer = gameState.players.find(pl => pl.userId === USER_ID);
      panel.innerHTML = `
        <h4>Build Industry</h4>
        <p>Card: ${this.selectedCard}. Choose industry type:</p>
        <div class="industry-options">
          ${Object.entries(myPlayer.industryMat).filter(([_, levels]) => levels.length > 0).map(([type, levels]) =>
            `<button class="btn" onclick="GameUI.selectIndustryType('${type}')">
              ${type} (L${levels[0]})</button>`
          ).join('')}
        </div>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
      `;
      return;
    }

    if (!p.location) {
      // Highlight valid locations on board
      const cardInfo = parseCardId(this.selectedCard);
      const validLocs = [];
      for (const [locId, loc] of Object.entries(gameState.board.locations)) {
        for (let i = 0; i < loc.slots.length; i++) {
          if (loc.slots[i].allowed.includes(p.industryType) && loc.slots[i].owner === null) {
            if (cardInfo.type === 'location' && cardInfo.location === locId) validLocs.push(locId);
            else if (cardInfo.type === 'industry') validLocs.push(locId);
          }
        }
      }
      BoardRenderer.highlightLocations([...new Set(validLocs)], (locId) => {
        p.location = locId;
        // Auto-select slot if only one valid
        const loc = gameState.board.locations[locId];
        const validSlots = [];
        for (let i = 0; i < loc.slots.length; i++) {
          if (loc.slots[i].allowed.includes(p.industryType) && loc.slots[i].owner === null) {
            validSlots.push(i);
          }
        }
        if (validSlots.length === 1) p.slotIndex = validSlots[0];
        this.updateActionPanel();
      });
      panel.innerHTML = `
        <h4>Build ${p.industryType}</h4>
        <p>Click a highlighted location on the board:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
      `;
      return;
    }

    if (p.slotIndex === undefined) {
      const loc = gameState.board.locations[p.location];
      const validSlots = [];
      for (let i = 0; i < loc.slots.length; i++) {
        if (loc.slots[i].allowed.includes(p.industryType) && loc.slots[i].owner === null) {
          validSlots.push(i);
        }
      }
      panel.innerHTML = `
        <h4>Build ${p.industryType} at ${BOARD.locations[p.location].name}</h4>
        <p>Choose slot:</p>
        ${validSlots.map(i => `<button class="btn" onclick="GameUI.actionParams.slotIndex=${i};GameUI.submitAction()">Slot ${i+1}</button>`).join('')}
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
      `;
      return;
    }

    // Ready to submit
    this.submitAction();
  },

  renderBuildLinkFlow(panel) {
    if (!this.selectedCard) {
      panel.innerHTML = `<h4>Build Link</h4><p>Select a card to discard:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
      return;
    }

    if (!this.actionParams.linkId) {
      // Highlight available links
      const era = gameState.era;
      const validLinks = BOARD.links
        .filter(l => {
          const ls = gameState.board.links[l.id];
          if (!ls || ls.owner !== null) return false;
          return era === 'canal' ? l.canal : l.rail;
        })
        .map(l => l.id);

      BoardRenderer.highlightLinks(validLinks, (linkId) => {
        this.actionParams.linkId = linkId;
        this.updateActionPanel();
      });

      panel.innerHTML = `
        <h4>Build Link</h4>
        <p>Click a highlighted link on the board:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
      `;
      return;
    }

    // Can optionally build second link in rail era
    if (gameState.era === 'rail' && !this.actionParams.secondAsked) {
      this.actionParams.secondAsked = true;
      panel.innerHTML = `
        <h4>Build Link</h4>
        <p>Build a second rail link? (costs £15 total for 2)</p>
        <button class="btn btn-primary" onclick="GameUI.submitAction()">Just One (£5)</button>
        <button class="btn" onclick="GameUI.startSecondLink()">Add Second Link</button>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
      `;
      return;
    }

    this.submitAction();
  },

  startSecondLink() {
    const validLinks = BOARD.links
      .filter(l => {
        const ls = gameState.board.links[l.id];
        if (!ls || ls.owner !== null) return false;
        return l.rail && l.id !== this.actionParams.linkId;
      })
      .map(l => l.id);

    BoardRenderer.highlightLinks(validLinks, (linkId) => {
      this.actionParams.secondLinkId = linkId;
      this.submitAction();
    });
  },

  renderSellCottonFlow(panel) {
    if (!this.selectedCard) {
      panel.innerHTML = `<h4>Sell Cotton</h4><p>Select a card to discard:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
      return;
    }

    // Find unflipped mills
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    const mills = [];
    for (const [locId, loc] of Object.entries(gameState.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (slot.owner === myPlayer.seat && slot.industryType === 'cottonMill' && !slot.flipped) {
          mills.push({ locId, slotIndex: i });
        }
      }
    }

    if (mills.length === 0) {
      panel.innerHTML = `<h4>Sell Cotton</h4><p>No unflipped cotton mills!</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
      return;
    }

    if (!this.actionParams.millLocation) {
      BoardRenderer.highlightLocations(mills.map(m => m.locId), (locId) => {
        const mill = mills.find(m => m.locId === locId);
        this.actionParams.millLocation = locId;
        this.actionParams.millSlot = mill.slotIndex;
        this.updateActionPanel();
      });
      panel.innerHTML = `<h4>Sell Cotton</h4><p>Click a cotton mill to sell from:</p>
        <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>`;
      return;
    }

    // Choose port or distant market
    panel.innerHTML = `
      <h4>Sell Cotton from ${BOARD.locations[this.actionParams.millLocation].name}</h4>
      <p>Choose where to sell:</p>
      <button class="btn" onclick="GameUI.sellToDistant()">Distant Market (demand: ${gameState.distantMarketDemand})</button>
      <p>Or click an unflipped port on the board</p>
      <button class="btn" onclick="GameUI.cancelAction()">Cancel</button>
    `;

    // Highlight unflipped ports
    const ports = [];
    for (const [locId, loc] of Object.entries(gameState.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (slot.industryType === 'port' && !slot.flipped && slot.owner !== null) {
          ports.push({ locId, slotIndex: i });
        }
      }
    }
    BoardRenderer.highlightLocations(ports.map(p => p.locId), (locId) => {
      const port = ports.find(p => p.locId === locId);
      this.actionParams.sales = [{
        millLocation: this.actionParams.millLocation,
        millSlot: this.actionParams.millSlot,
        target: { type: 'port', location: locId, slotIndex: port.slotIndex }
      }];
      this.submitAction();
    });
  },

  sellToDistant() {
    this.actionParams.sales = [{
      millLocation: this.actionParams.millLocation,
      millSlot: this.actionParams.millSlot,
      target: { type: 'distant' }
    }];
    this.submitAction();
  },

  selectIndustryType(type) {
    this.actionParams.industryType = type;
    this.updateActionPanel();
  },

  toggleDevelop(type) {
    if (!this.actionParams.develops) this.actionParams.develops = [];
    const idx = this.actionParams.develops.indexOf(type);
    if (idx >= 0) {
      this.actionParams.develops.splice(idx, 1);
    } else if (this.actionParams.develops.length < 2) {
      this.actionParams.develops.push(type);
    }
    this.updateActionPanel();
  },

  // ============ SUBMIT ACTION ============

  async submitAction() {
    const action = { ...this.actionParams };
    action.cardPlayed = this.selectedCard;

    try {
      const res = await fetch(`/api/games/${GAME_ID}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Action failed');
        return;
      }

      gameState = data.state;
      stateVersion = data.version;
      this.cancelAction();
      this.updateAll();
    } catch (e) {
      alert('Network error');
    }
  },

  // ============ HAND ============

  selectCard(cardId) {
    this.selectedCard = cardId;
    this.updateHand();
    this.updateActionPanel();
  },

  updateHand() {
    const panel = document.getElementById('hand-panel');
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer || !myPlayer.hand) {
      panel.innerHTML = '<h4>Hand</h4><p class="muted">Not your cards to see</p>';
      return;
    }

    panel.innerHTML = `
      <h4>Hand (${myPlayer.hand.length})</h4>
      <div class="hand-cards">
        ${myPlayer.hand.map(cardId => {
          const info = parseCardId(cardId);
          const label = info.type === 'location'
            ? (BOARD.locations[info.location]?.name || info.location)
            : info.industry;
          const isSelected = this.selectedCard === cardId;
          return `<div class="card ${info.type} ${isSelected ? 'selected' : ''}"
            onclick="GameUI.selectCard('${cardId}')">
            <div class="card-type">${info.type === 'location' ? 'LOC' : 'IND'}</div>
            <div class="card-label">${label}</div>
          </div>`;
        }).join('')}
      </div>
    `;
  },

  // ============ INDUSTRY MAT ============

  updateMat() {
    const panel = document.getElementById('mat-panel');
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer) { panel.innerHTML = ''; return; }

    panel.innerHTML = `
      <h4>Industry Mat</h4>
      <div class="mat-tiles">
        ${Object.entries(myPlayer.industryMat).map(([type, levels]) =>
          `<div class="mat-row">
            <span class="mat-type">${type}:</span>
            <span class="mat-levels">${levels.length > 0 ? levels.map(l => `L${l}`).join(' ') : '(empty)'}</span>
          </div>`
        ).join('')}
      </div>
    `;
  },

  // ============ LOG ============

  updateLog() {
    const panel = document.getElementById('log-panel');
    const logs = gameState.log || [];
    const recent = logs.slice(-20);
    panel.innerHTML = recent.map(l => `<div class="log-entry">${l.msg}</div>`).join('');
    const wrapper = document.getElementById('log-wrapper');
    if (!wrapper.classList.contains('collapsed')) {
      panel.scrollTop = panel.scrollHeight;
    }
  },

  toggleLog() {
    const wrapper = document.getElementById('log-wrapper');
    wrapper.classList.toggle('collapsed');
    const arrow = document.getElementById('log-arrow');
    arrow.innerHTML = wrapper.classList.contains('collapsed') ? '&#9650;' : '&#9660;';
  }
};

// Card ID parser
function parseCardId(cardId) {
  if (cardId.startsWith('cotton_')) return { type: 'industry', industry: 'cottonMill' };
  if (cardId.startsWith('coal_')) return { type: 'industry', industry: 'coalMine' };
  if (cardId.startsWith('iron_')) return { type: 'industry', industry: 'ironWorks' };
  if (cardId.startsWith('port_')) return { type: 'industry', industry: 'port' };
  if (cardId.startsWith('shipyard_')) return { type: 'industry', industry: 'shipyard' };
  const parts = cardId.split('_');
  const loc = parts.slice(0, -1).join('_');
  return { type: 'location', location: loc };
}

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => GameUI.init());
