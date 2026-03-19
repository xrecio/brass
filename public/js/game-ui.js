// Game UI controller
const GameUI = {
  selectedAction: null,
  selectedCard: null,
  actionStep: 0,
  actionParams: {},
  rightPanelCollapsed: false,

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
    const slotPrices = [1, 1, 2, 2, 3, 3, 4, 4];
    const coalPrice = s.coalMarket > 0 ? slotPrices[s.coalMarket - 1] : 5;
    const ironPrice = s.ironMarket > 0 ? slotPrices[s.ironMarket - 1] : 5;
    const tilesLeft = s.distantMarketTiles ? s.distantMarketTiles.length : 0;
    const flipped = s.distantMarketFlipped || [];
    panel.innerHTML = `
      <h4>Markets</h4>
      <div class="market-row">
        <span>Coal: ${s.coalMarket}/8</span>
        <span class="market-price">£${coalPrice}/cube</span>
      </div>
      <div class="market-bar"><div class="market-fill coal" style="width:${s.coalMarket/8*100}%"></div></div>
      <div class="market-row">
        <span>Iron: ${s.ironMarket}/8</span>
        <span class="market-price">£${ironPrice}/cube</span>
      </div>
      <div class="market-bar"><div class="market-fill iron" style="width:${s.ironMarket/8*100}%"></div></div>
      <div class="market-row">
        <span>Demand: ${s.distantMarketDemand}/8</span>
        <span class="market-price">${tilesLeft} tiles</span>
      </div>
      <div class="market-bar"><div class="market-fill demand" style="width:${s.distantMarketDemand/8*100}%"></div></div>
      ${flipped.length > 0 ? `<div class="market-detail"><span class="muted">Flipped: ${flipped.map(t => t === 0 ? '0' : t).join(', ')}</span></div>` : ''}
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

  handCollapsed: false,

  toggleHand() {
    this.handCollapsed = !this.handCollapsed;
    this.updateHand();
  },

  selectCard(cardId) {
    this.selectedCard = cardId;
    this.updateHand();
    this.updateActionPanel();
  },

  onCardHover(cardId) {
    if (this.selectedAction) return; // don't interfere with action flow
    BoardRenderer.clearHighlights();
    const info = parseCardId(cardId);
    if (info.type === 'location') {
      if (BOARD.locations[info.location]) {
        BoardRenderer.highlightLocations([info.location], () => {});
      }
    } else if (info.type === 'industry') {
      const validLocs = this.getValidBuildLocations(info.industry);
      if (validLocs.length > 0) {
        BoardRenderer.highlightLocations(validLocs, () => {});
      }
    }
    // Show action hints
    this.showActionHints(cardId, info);
  },

  onCardLeave() {
    if (this.selectedAction) return;
    BoardRenderer.clearHighlights();
    this.hideActionHints();
  },

  showActionHints(cardId, info) {
    let existing = document.getElementById('action-hints-float');
    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'action-hints-float';
      existing.className = 'action-hints-float';
      document.querySelector('.game-main').appendChild(existing);
    }
    const hints = [];
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer) return;

    if (info.type === 'location') {
      const loc = BOARD.locations[info.location];
      if (loc) hints.push(`<div class="action-hint"><strong>Build Industry</strong> at ${loc.name}</div>`);
    } else {
      const validLocs = this.getValidBuildLocations(info.industry);
      if (validLocs.length > 0) {
        hints.push(`<div class="action-hint"><strong>Build ${INDUSTRIES[info.industry]?.name}</strong> at ${validLocs.length} location${validLocs.length > 1 ? 's' : ''}</div>`);
      }
    }
    hints.push(`<div class="action-hint"><strong>Build Link</strong> — discard to build canal/rail</div>`);
    hints.push(`<div class="action-hint"><strong>Sell Cotton</strong> — discard to sell mills</div>`);
    hints.push(`<div class="action-hint"><strong>Take Loan</strong> — discard for £10-30</div>`);
    hints.push(`<div class="action-hint"><strong>Develop</strong> — discard + iron to skip tiles</div>`);
    hints.push(`<div class="action-hint"><strong>Pass</strong> — discard and do nothing</div>`);
    hints.push(`<div class="action-hint"><strong>Wild Build</strong> — use 2 actions + 2 cards to build anywhere</div>`);
    existing.innerHTML = hints.join('');
  },

  hideActionHints() {
    const el = document.getElementById('action-hints-float');
    if (el) el.remove();
  },

  getValidBuildLocations(industryType) {
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer) return [];

    const mat = myPlayer.industryMat[industryType];
    if (!mat || mat.length === 0) return [];
    const level = mat[0];

    // Rail era can't build level 1
    if (gameState.era === 'rail' && level <= 1) return [];
    // Shipyard level 0 can't be built
    if (industryType === 'shipyard' && level === 0) return [];

    const tileData = INDUSTRIES[industryType]?.levels[level];
    if (!tileData || myPlayer.money < tileData.cost) return [];

    const validLocs = [];
    for (const [locId, loc] of Object.entries(gameState.board.locations)) {
      for (let i = 0; i < loc.slots.length; i++) {
        const slot = loc.slots[i];
        if (!slot.allowed.includes(industryType)) continue;
        if (slot.owner !== null && slot.owner !== myPlayer.seat) continue;
        // Canal era: one per location
        if (gameState.era === 'canal' && loc.slots.some(s => s.owner === myPlayer.seat) && slot.owner !== myPlayer.seat) continue;
        validLocs.push(locId);
        break; // one match per location is enough
      }
    }
    return [...new Set(validLocs)];
  },

  updateHand() {
    const panel = document.getElementById('hand-panel');
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer || !myPlayer.hand) {
      panel.innerHTML = '<h4>Hand</h4><p class="muted">Not your cards to see</p>';
      return;
    }

    const arrow = this.handCollapsed ? '&#9654;' : '&#9660;';
    panel.innerHTML = `
      <h4 class="collapsible-header" onclick="GameUI.toggleHand()">Hand (${myPlayer.hand.length}) <span class="collapse-arrow">${arrow}</span></h4>
      ${this.handCollapsed ? '' : `<div class="hand-cards">
        ${myPlayer.hand.map(cardId => {
          const info = parseCardId(cardId);
          const label = info.type === 'location'
            ? (BOARD.locations[info.location]?.name || info.location)
            : (INDUSTRIES[info.industry]?.name || info.industry);
          const isSelected = this.selectedCard === cardId;
          return `<div class="card ${info.type} ${isSelected ? 'selected' : ''}"
            onclick="GameUI.selectCard('${cardId}')"
            onmouseenter="GameUI.onCardHover('${cardId}')"
            onmouseleave="GameUI.onCardLeave()">
            <div class="card-type">${info.type === 'location' ? 'LOC' : 'IND'}</div>
            <div class="card-label">${label}</div>
          </div>`;
        }).join('')}
      </div>`}
    `;
  },

  // ============ INDUSTRY MAT ============

  matCollapsed: false,
  matDetailVisible: true,

  toggleMat() {
    this.matCollapsed = !this.matCollapsed;
    this.updateMat();
  },

  toggleMatDetail() {
    this.matDetailVisible = !this.matDetailVisible;
    this.updateMat();
  },

  toggleRightPanel() {
    this.rightPanelCollapsed = !this.rightPanelCollapsed;
    const panel = document.getElementById('right-panel');
    const arrow = document.getElementById('right-panel-arrow');
    panel.classList.toggle('collapsed');
    arrow.innerHTML = this.rightPanelCollapsed ? '&#9664;' : '&#9654;';
  },

  renderTileBox(lv, status, topLevel, ind, showDetail) {
    const ld = ind.levels[lv];
    const cls = status === 'available' ? 'tile-avail' : status === 'onBoard' ? 'tile-board' : 'tile-used';
    const isTop = status === 'available' && lv === topLevel;
    const tooltip = ld ? '£' + ld.cost + (ld.coal ? ' +' + ld.coal + ' coal' : '') + (ld.iron ? ' +' + ld.iron + ' iron' : '') : '';
    let html = '<span class="mat-tile-box ' + cls + (isTop ? ' tile-next' : '') + '" title="' + tooltip + '">';
    html += '<span class="tile-num">' + lv + '</span>';
    if (showDetail && ld) {
      html += '<span class="tile-vp-hex">' + ld.vp + '</span>';
      html += '<span class="tile-inc-circle">+' + ld.income + '</span>';
    }
    html += '</span>';
    return html;
  },

  updateMat() {
    const panel = document.getElementById('mat-panel');
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    if (!myPlayer) { panel.innerHTML = ''; return; }

    const arrow = this.matCollapsed ? '&#9654;' : '&#9660;';
    const showDetail = this.matDetailVisible;
    const developed = myPlayer.developedTiles || [];
    const canalRemoved = myPlayer.canalRemovedTiles || [];

    // Count tiles on board for this player
    const onBoard = {};
    for (const loc of Object.values(gameState.board.locations)) {
      for (const slot of loc.slots) {
        if (slot.owner === myPlayer.seat && slot.industryType) {
          const key = slot.industryType + '_' + slot.level;
          onBoard[key] = (onBoard[key] || 0) + 1;
        }
      }
    }

    let html = '<h4 class="collapsible-header" onclick="GameUI.toggleMat()">Industry Mat <span class="collapse-arrow">' + arrow + '</span></h4>';

    if (!this.matCollapsed) {
      html += '<div style="text-align:right;margin-bottom:3px"><span class="muted" style="font-size:9px;cursor:pointer" onclick="GameUI.toggleMatDetail()">' + (showDetail ? 'Hide' : 'Show') + ' detail</span></div>';
      html += '<div class="mat-tiles">';

      for (const [type, ind] of Object.entries(INDUSTRIES)) {
        const matLevels = myPlayer.industryMat[type] || [];
        const topLevel = matLevels[0];
        const tileData = topLevel !== undefined ? ind.levels[topLevel] : null;

        // Build full tile list
        const allTiles = [];
        for (const [lv, data] of Object.entries(ind.levels)) {
          const count = data.tiles || 1;
          for (let i = 0; i < count; i++) allTiles.push(parseInt(lv));
        }

        // Count per level per source
        const matCounts = {};
        for (const l of matLevels) matCounts[l] = (matCounts[l] || 0) + 1;
        const devCounts = {};
        for (const d of developed) { if (d.type === type) devCounts[d.level] = (devCounts[d.level] || 0) + 1; }
        const canalCounts = {};
        for (const c of canalRemoved) { if (c.type === type) canalCounts[c.level] = (canalCounts[c.level] || 0) + 1; }

        // Assign status to each tile
        const used = { mat: {}, board: {}, dev: {}, canal: {} };
        const tiles = allTiles.map(lv => {
          const key = type + '_' + lv;
          const inMat = (matCounts[lv] || 0) - (used.mat[lv] || 0);
          const inBoard = (onBoard[key] || 0) - (used.board[lv] || 0);
          const inDev = (devCounts[lv] || 0) - (used.dev[lv] || 0);
          const inCanal = (canalCounts[lv] || 0) - (used.canal[lv] || 0);
          let status = 'available';
          if (inMat > 0) { used.mat[lv] = (used.mat[lv] || 0) + 1; status = 'available'; }
          else if (inBoard > 0) { used.board[lv] = (used.board[lv] || 0) + 1; status = 'onBoard'; }
          else if (inDev > 0) { used.dev[lv] = (used.dev[lv] || 0) + 1; status = 'developed'; }
          else if (inCanal > 0) { used.canal[lv] = (used.canal[lv] || 0) + 1; status = 'canalRemoved'; }
          return { lv, status };
        });

        html += '<div class="mat-group"><div class="mat-header"><span class="mat-name">' + ind.name + '</span></div>';
        html += '<div class="mat-tiles-row">';
        for (const t of tiles) {
          html += this.renderTileBox(t.lv, t.status, topLevel, ind, showDetail);
        }
        html += '</div>';

        if (tileData) {
          html += '<div class="mat-detail">Next: ' + topLevel + ' — £' + tileData.cost;
          if (tileData.coal) html += ' +' + tileData.coal + '⬛';
          if (tileData.iron) html += ' +' + tileData.iron + '🟧';
          html += ' → <span class="tile-inc-circle tile-inc-inline">+' + tileData.income + '</span>';
          html += ' <span class="tile-vp-hex tile-vp-inline">' + tileData.vp + '</span></div>';
        }
        html += '</div>';
      }
      html += '</div>';

      // Out of game section
      if (developed.length > 0 || canalRemoved.length > 0) {
        html += '<div class="mat-outofgame"><div class="mat-header"><span class="mat-name muted">Out of game</span></div>';
        if (developed.length > 0) {
          html += '<div class="mat-oog-row"><span class="muted">Developed:</span> ';
          html += developed.map(d => '<span class="mat-tile-box tile-used" title="Developed">' + d.level + '</span>').join('');
          html += '</div>';
        }
        if (canalRemoved.length > 0) {
          html += '<div class="mat-oog-row"><span class="muted">Canal removed:</span> ';
          html += canalRemoved.map(c => '<span class="mat-tile-box tile-used" title="Removed end of Canal era">' + c.level + '</span>').join('');
          html += '</div>';
        }
        html += '</div>';
      }
    }

    panel.innerHTML = html;
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
