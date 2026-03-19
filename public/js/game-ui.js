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
    this.initFloatingHandDrag();
    this.initFloatingHandResize();
  },

  async setBotDelay(seconds) {
    document.getElementById('bot-delay-val').textContent = seconds;
    try { await fetch('/api/bot-delay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seconds: parseInt(seconds) }) }); } catch (e) {}
  },

  lastBotLogCount: 0,

  checkBotAnnouncement() {
    const logs = gameState.log || [];
    // Find new bot messages since last check
    if (logs.length > this.lastBotLogCount) {
      for (let i = this.lastBotLogCount; i < logs.length; i++) {
        if (logs[i].bot) {
          this.showBotOverlay(logs[i].msg);
        }
      }
      this.lastBotLogCount = logs.length;
    }
  },

  showBotOverlay(msg) {
    let overlay = document.getElementById('bot-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bot-overlay';
      overlay.className = 'bot-overlay';
      document.querySelector('.game-main').appendChild(overlay);
    }
    overlay.textContent = msg;
    overlay.style.display = 'block';
    overlay.style.opacity = '1';
    clearTimeout(this._botOverlayTimer);
    this._botOverlayTimer = setTimeout(() => {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 500);
    }, 3000);
  },

  _sizingCards: false,

  sizeFloatingCards() {
    if (this._sizingCards) return;
    this._sizingCards = true;

    const container = document.getElementById('floating-hand-cards');
    if (!container) { this._sizingCards = false; return; }
    const cards = container.querySelectorAll('.card');
    if (cards.length === 0) { this._sizingCards = false; return; }

    const h = container.clientHeight;
    if (h <= 0) { this._sizingCards = false; return; }

    // Width from golden ratio
    let w = Math.round(h / 1.618);

    // Minimum width: measure the longest word in any card + margin
    let minW = 30;
    cards.forEach(c => {
      const label = c.querySelector('.card-label');
      if (label) {
        const words = (label.textContent || '').split(/\s+/);
        words.forEach(word => {
          // Measure word width using a temp span
          const span = document.createElement('span');
          span.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:' + getComputedStyle(label).fontSize + ';font-weight:bold;';
          span.textContent = word;
          document.body.appendChild(span);
          const wordW = span.offsetWidth + 12; // + padding/margin
          document.body.removeChild(span);
          if (wordW > minW) minW = wordW;
        });
      }
    });

    if (w < minW) w = minW;

    cards.forEach(c => {
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      c.style.minWidth = w + 'px';
      c.style.flex = '0 0 ' + w + 'px';
    });

    // Enforce floating hand min-width to fit all cards in one row
    const el = document.getElementById('floating-hand');
    if (el) {
      const gap = 4;
      const padding = 20;
      const totalCardsW = cards.length * w + (cards.length - 1) * gap + padding;
      el.style.minWidth = totalCardsW + 'px';

      // Convert CSS centering to absolute left on first sizing (prevents resize jump)
      if (el.style.transform && el.style.transform.includes('translateX')) {
        const rect = el.getBoundingClientRect();
        el.style.left = rect.left + 'px';
        el.style.transform = 'none';
        el.style.bottom = 'auto';
        el.style.top = rect.top + 'px';
      }
    }

    this._sizingCards = false;
  },

  _floatResizeTimer: null,

  initFloatingHandResize() {
    const el = document.getElementById('floating-hand');
    if (!el || this._floatResizeObserver) return;
    this._floatResizeObserver = new ResizeObserver(() => {
      if (this._sizingCards) return;
      clearTimeout(this._floatResizeTimer);
      this._floatResizeTimer = setTimeout(() => this.sizeFloatingCards(), 50);
    });
    this._floatResizeObserver.observe(el);
  },

  initFloatingHandDrag() {
    const el = document.getElementById('floating-hand');
    if (!el) return;
    const header = el.querySelector('.floating-hand-header');
    let dragging = false, ox = 0, oy = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      ox = e.clientX - el.offsetLeft;
      oy = e.clientY - el.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      el.style.left = (e.clientX - ox) + 'px';
      el.style.top = (e.clientY - oy) + 'px';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  },

  leftPanelCollapsed: false,

  toggleLeftPanel() {
    this.leftPanelCollapsed = !this.leftPanelCollapsed;
    const panel = document.getElementById('left-panel');
    const arrow = document.getElementById('left-panel-arrow');
    panel.classList.toggle('collapsed');
    arrow.innerHTML = this.leftPanelCollapsed ? '&#9654;' : '&#9664;';
  },

  updateAll() {
    this.updateGameInfo();
    this.updatePlayerBar();
    this.updateActionPanel();
    this.updateHand();
    this.updateMat();
    this.updateLog();
    this.checkBotAnnouncement();
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
      const cardCount = (p.hand && p.hand.length > 0) ? p.hand.length : (p.handCount || 0);
      const fives = Math.floor(p.money / 5);
      const ones = p.money % 5;
      const moneyDiscs = Array(fives).fill('<span class="money-disc silver">5</span>').join('')
        + Array(ones).fill('<span class="money-disc bronze">1</span>').join('');
      return '<div class="player-info ' + (isCurrent ? 'current' : '') + ' ' + (isMe ? 'me' : '') + '"'
        + ' style="border-color: ' + BOARD.playerColors[p.seat] + '">'
        + '<div class="player-name" style="color: ' + BOARD.playerColors[p.seat] + '">'
        + p.username + (p.isBot ? ' (Bot)' : '') + (isCurrent ? ' ▸' : '')
        + '</div>'
        + '<div class="player-stats-grid">'
        + '<span class="pstat"><span class="tile-vp-hex tile-vp-inline">' + p.vp + '</span></span>'
        + '<span class="pstat" title="Income level"><span class="tile-inc-circle tile-inc-inline">' + p.income + '</span></span>'
        + '<span class="pstat" title="Cards">' + cardCount + ' cards</span>'
        + '</div>'
        + '<div class="money-discs" title="£' + p.money + '">' + moneyDiscs + '</div>'
        + '</div>';
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
      panel.innerHTML = '<div class="info-row" style="color:var(--gold);font-weight:bold">Game Over!</div>'
        + '<div class="info-row">Winner: <strong>' + winner.username + '</strong> ' + winner.vp + ' VP</div>';
      return;
    }

    panel.innerHTML = ''
      + '<div class="info-row"><strong>' + (s.era === 'canal' ? 'Canal' : 'Rail') + '</strong> Era — Round ' + s.round + '</div>'
      + '<div class="info-row" style="color:' + BOARD.playerColors[currentSeat] + '">' + currentPlayer.username + ' (' + s.actionsRemaining + ' action' + (s.actionsRemaining > 1 ? 's' : '') + ')</div>'
      + '<div class="info-row">Deck: ' + s.drawPile.length + ' cards</div>';
  },

  // ============ MARKETS ============

  // ============ ACTION PANEL ============

  updateActionPanel() {
    const panel = document.getElementById('action-panel');
    const s = gameState;
    const currentSeat = s.turnOrder[s.currentPlayerIndex];
    const myPlayer = s.players.find(p => p.userId === USER_ID);

    if (!myPlayer || myPlayer.seat !== currentSeat || s.phase !== 'actions') {
      const cp = s.players[currentSeat];
      if (cp && cp.isBot) {
        panel.innerHTML = '<p class="muted">' + cp.username + ' is thinking...</p>';
      } else if (s.phase === 'finished') {
        panel.innerHTML = '<p class="muted">Game finished</p>';
      } else {
        panel.innerHTML = '<p class="muted">Waiting for ' + (cp ? cp.username : 'other players') + '...</p>';
      }
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
  handDetached: true, // floating by default
  hoveredCard: null,

  toggleHand() {
    this.handCollapsed = !this.handCollapsed;
    this.updateHand();
  },

  toggleDetachHand() {
    this.handDetached = !this.handDetached;
    document.getElementById('floating-hand').style.display = this.handDetached ? 'block' : 'none';
    this.updateHand();
  },

  selectCard(cardId) {
    this.selectedCard = cardId;
    this.updateHand();
    this.updateActionPanel();
  },

  onCardHover(cardId, event) {
    if (this.selectedAction) return;
    this.hoveredCard = cardId;
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
    this.showActionPopup(cardId, info, event);
  },

  onCardLeave() {
    if (this.selectedAction) return;
    this.hoveredCard = null;
    BoardRenderer.clearHighlights();
    // Delay hide so user can click actions
    setTimeout(() => {
      if (!this.hoveredCard && !this.actionPopupHovered) this.hideActionPopup();
    }, 200);
  },

  actionPopupHovered: false,

  showActionPopup(cardId, info, event) {
    let popup = document.getElementById('action-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'action-popup';
      popup.className = 'action-popup';
      popup.addEventListener('mouseenter', () => { this.actionPopupHovered = true; });
      popup.addEventListener('mouseleave', () => {
        this.actionPopupHovered = false;
        if (!this.hoveredCard) this.hideActionPopup();
      });
      document.body.appendChild(popup);
    }

    // Position relative to the hovered card
    if (event && event.target) {
      const card = event.target.closest('.card');
      if (card) {
        const rect = card.getBoundingClientRect();
        if (this.handDetached) {
          // Floating hand: show above the card
          popup.style.left = rect.left + 'px';
          popup.style.top = (rect.top - 10) + 'px';
          popup.style.right = 'auto';
          popup.style.transform = 'translateY(-100%)';
        } else {
          // Docked: show to the left of the card
          popup.style.left = (rect.left - 10) + 'px';
          popup.style.top = rect.top + 'px';
          popup.style.right = 'auto';
          popup.style.transform = 'translateX(-100%)';
        }
      }
    }

    const myPlayer = gameState.players.find(p => p.userId === USER_ID);
    const currentSeat = gameState.turnOrder[gameState.currentPlayerIndex];
    const isMyTurn = myPlayer && myPlayer.seat === currentSeat && gameState.phase === 'actions';

    let html = '<div class="popup-title">Actions</div>';

    if (!isMyTurn) {
      html += '<div class="popup-muted">Not your turn</div>';
    } else {
      // Build Industry
      if (info.type === 'location') {
        const loc = BOARD.locations[info.location];
        if (loc) html += '<button class="popup-action" onclick="GameUI.quickAction(\'buildIndustry\',\'' + cardId + '\')">Build Industry at ' + loc.name + '</button>';
      } else {
        const validLocs = this.getValidBuildLocations(info.industry);
        if (validLocs.length > 0) {
          html += '<button class="popup-action" onclick="GameUI.quickAction(\'buildIndustry\',\'' + cardId + '\')">Build ' + (INDUSTRIES[info.industry]?.name || '') + ' (' + validLocs.length + ' spots)</button>';
        }
      }
      html += '<button class="popup-action" onclick="GameUI.quickAction(\'buildLink\',\'' + cardId + '\')">Build Link</button>';
      html += '<button class="popup-action" onclick="GameUI.quickAction(\'sellCotton\',\'' + cardId + '\')">Sell Cotton</button>';
      html += '<button class="popup-action" onclick="GameUI.quickAction(\'takeLoan\',\'' + cardId + '\')">Take Loan</button>';
      html += '<button class="popup-action" onclick="GameUI.quickAction(\'develop\',\'' + cardId + '\')">Develop</button>';
      html += '<button class="popup-action popup-pass" onclick="GameUI.quickAction(\'pass\',\'' + cardId + '\')">Pass</button>';
    }
    popup.innerHTML = html;
    popup.style.display = 'block';
  },

  hideActionPopup() {
    const el = document.getElementById('action-popup');
    if (el) el.style.display = 'none';
  },

  quickAction(type, cardId) {
    this.hideActionPopup();
    this.selectedCard = cardId;
    this.startAction(type);
    this.updateHand();
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

  renderCardHTML(cardId) {
    const info = parseCardId(cardId);
    const label = info.type === 'location'
      ? (BOARD.locations[info.location]?.name || info.location)
      : (INDUSTRIES[info.industry]?.name || info.industry);
    const isSelected = this.selectedCard === cardId;
    return '<div class="card ' + info.type + (isSelected ? ' selected' : '') + '"'
      + ' onclick="GameUI.selectCard(\'' + cardId + '\')"'
      + ' onmouseenter="GameUI.onCardHover(\'' + cardId + '\', event)"'
      + ' onmouseleave="GameUI.onCardLeave()">'
      + '<div class="card-type">' + (info.type === 'location' ? 'LOC' : 'IND') + '</div>'
      + '<div class="card-label">' + label + '</div>'
      + '</div>';
  },

  updateHand() {
    const panel = document.getElementById('hand-panel');
    const floatCards = document.getElementById('floating-hand-cards');
    const myPlayer = gameState.players.find(p => p.userId === USER_ID);

    if (!myPlayer || !myPlayer.hand) {
      panel.innerHTML = '<h4>Hand</h4><p class="muted">Not your cards to see</p>';
      if (floatCards) floatCards.innerHTML = '';
      return;
    }

    // cardsHTML no longer used directly; built per context below

    const floatCheck = '<label class="float-check" onclick="event.stopPropagation()"><input type="checkbox" ' + (this.handDetached ? 'checked' : '') + ' onchange="GameUI.toggleDetachHand()"> Float</label>';
    const cardsHTML = myPlayer.hand.map(c => this.renderCardHTML(c)).join('');

    if (this.handDetached) {
      panel.innerHTML = '<h4 class="collapsible-header" onclick="GameUI.toggleHand()">Hand (' + myPlayer.hand.length + ') ' + floatCheck + '</h4>';
      if (floatCards) floatCards.innerHTML = cardsHTML;
      requestAnimationFrame(() => this.sizeFloatingCards());
    } else {
      const arrow = this.handCollapsed ? '&#9654;' : '&#9660;';
      panel.innerHTML = '<h4 class="collapsible-header" onclick="GameUI.toggleHand()">'
        + 'Hand (' + myPlayer.hand.length + ') <span class="collapse-arrow">' + arrow + '</span> '
        + floatCheck
        + '</h4>'
        + (this.handCollapsed ? '' : '<div class="hand-cards">' + cardsHTML + '</div>');
      if (floatCards) floatCards.innerHTML = '';
    }
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

  renderTileBox(lv, status, topLevel) {
    const cls = status === 'available' ? 'tile-avail' : status === 'onBoard' ? 'tile-board' : 'tile-used';
    const isTop = status === 'available' && lv === topLevel;
    return '<span class="mat-tile-box ' + cls + (isTop ? ' tile-next' : '') + '">' +
      '<span class="tile-num">' + lv + '</span></span>';
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

        // Group tiles by level
        const levelGroups = {};
        for (const t of tiles) {
          if (!levelGroups[t.lv]) levelGroups[t.lv] = [];
          levelGroups[t.lv].push(t);
        }

        // Render each level as its own row
        for (const [lv, group] of Object.entries(levelGroups)) {
          const ld = ind.levels[lv];
          html += '<div class="mat-level-row">';
          html += '<div class="mat-level-tiles">';
          for (const t of group) {
            html += this.renderTileBox(t.lv, t.status, topLevel);
          }
          html += '</div>';
          if (showDetail && ld) {
            html += '<div class="mat-level-stats">';
            html += '<span class="tile-inc-circle tile-inc-inline">+' + ld.income + '</span>';
            html += '<span class="tile-vp-hex tile-vp-inline">' + ld.vp + '</span>';
            html += '</div>';
          }
          html += '</div>';
        }

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
    panel.innerHTML = recent.map(l => {
      // Find player color from message
      let color = '';
      for (const p of gameState.players) {
        if (l.msg && l.msg.includes(p.username)) {
          color = BOARD.playerColors[p.seat];
          break;
        }
      }
      const style = color ? ' style="color:' + color + '"' : '';
      return '<div class="log-entry"' + style + '>' + l.msg + '</div>';
    }).join('');
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
