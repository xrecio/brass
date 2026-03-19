// SVG Board Renderer for Brass: Lancashire
// Renders locations as rectangles overlaying the game board map image

const BoardRenderer = {
  svg: null,
  mapImage: null,
  editMode: false,
  resizeMode: false,
  showLinks: true,
  dragging: null,
  resizing: null,  // { id, startY, startScale }
  dragOffset: { x: 0, y: 0 },
  customPositions: {},  // locId -> {x, y, scale}
  positionHistory: [],  // stack of previous customPositions snapshots
  saveTimeout: null,

  init() {
    this.svg = document.getElementById('game-board');
    this.initMarketDefaults();

    // Load saved positions: user's own, or fall back to xai's
    if (typeof CUSTOM_POSITIONS === 'object' && CUSTOM_POSITIONS !== null) {
      this.customPositions = CUSTOM_POSITIONS;
    } else if (typeof XAI_POSITIONS === 'object' && XAI_POSITIONS !== null) {
      this.customPositions = JSON.parse(JSON.stringify(XAI_POSITIONS));
    }
    this.applyCustomPositions();

    // SVG drag handlers
    this.svg.addEventListener('mousemove', (e) => this.onDragMove(e));
    this.svg.addEventListener('mouseup', () => this.onDragEnd());
    this.svg.addEventListener('mouseleave', () => this.onDragEnd());
    this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    this.render();
  },

  applyCustomPositions() {
    for (const [locId, pos] of Object.entries(this.customPositions)) {
      if (BOARD.locations[locId]) {
        BOARD.locations[locId].x = pos.x;
        BOARD.locations[locId].y = pos.y;
      }
      if (BOARD.nonBuildable[locId]) {
        BOARD.nonBuildable[locId].x = pos.x;
        BOARD.nonBuildable[locId].y = pos.y;
      }
    }
  },

  render() {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    // Board map background
    this.mapImage = this.createSVG('image', {
      href: '/img/board-map.jpg',
      x: 0, y: 0,
      width: 600, height: 520,
      preserveAspectRatio: 'xMidYMid meet',
      opacity: 0.7
    });
    this.svg.appendChild(this.mapImage);

    // Restore slider value
    const slider = document.getElementById('map-dim-slider');
    if (slider) this.mapImage.setAttribute('opacity', slider.value / 100);

    // Draw links (toggleable)
    if (this.showLinks) this.drawLinks();

    // Draw non-buildable locations (including external ports)
    this.drawNonBuildable();

    // Draw locations as rectangles
    this.drawLocations();

    // Draw market panels (demand, coal, iron)
    this.drawMarketPanels();
  },

  setMapOpacity(value) {
    if (this.mapImage) {
      this.mapImage.setAttribute('opacity', value / 100);
    }
  },

  minimalMode: false,

  toggleMinimal(checked) {
    this.minimalMode = checked;
    document.body.classList.toggle('minimal-mode', checked);
    this.render(); // re-render SVG panels with minimal styling
  },

  toggleLinks() {
    this.showLinks = !this.showLinks;
    const btn = document.getElementById('toggle-links-btn');
    if (btn) btn.textContent = this.showLinks ? 'Links' : 'No Links';
    this.render();
  },

  toggleResizeMode() {
    this.resizeMode = !this.resizeMode;
    const btn = document.getElementById('resize-nodes-btn');
    if (this.resizeMode) {
      btn.textContent = 'Done Resize';
      btn.classList.add('btn-primary');
    } else {
      btn.textContent = 'Resize';
      btn.classList.remove('btn-primary');
      this.savePositions();
    }
    this.updateEditButtons();
  },

  getScale(id) {
    const pos = this.customPositions[id];
    return (pos && pos.scale) || 1;
  },

  onWheel(e) {
    if (!this.resizeMode) return;
    // Find which panel the wheel is over
    const target = e.target.closest('[data-location]') || e.target;
    // Check all draggable panel backgrounds
    const pt = this.svgPoint(e);
    const panelId = this.findPanelAt(pt);
    if (!panelId) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const currentScale = this.getScale(panelId);
    const newScale = Math.max(0.4, Math.min(3, currentScale + delta));
    if (!this.customPositions[panelId]) {
      const def = this.marketDefaults[panelId] || BOARD.locations[panelId] || BOARD.nonBuildable[panelId] || { x: 100, y: 100 };
      this.customPositions[panelId] = { x: def.x, y: def.y, scale: newScale };
    } else {
      this.customPositions[panelId].scale = newScale;
    }
    this.render();
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.savePositions(), 1500);
  },

  findPanelAt(pt) {
    // Check market panels
    for (const id of Object.keys(this.marketDefaults)) {
      const pos = this.getMarketPos(id);
      const s = this.getScale(id);
      // Rough hit test: within 40px scaled
      if (Math.abs(pt.x - pos.x) < 40 * s && Math.abs(pt.y - pos.y) < 60 * s) return id;
    }
    // Check locations
    for (const id of Object.keys(BOARD.locations)) {
      const loc = BOARD.locations[id];
      const s = this.getScale(id);
      if (Math.abs(pt.x - loc.x) < 25 * s && Math.abs(pt.y - loc.y) < 25 * s) return id;
    }
    // Check non-buildable
    for (const id of Object.keys(BOARD.nonBuildable)) {
      const wp = BOARD.nonBuildable[id];
      const s = this.getScale(id);
      if (Math.abs(pt.x - wp.x) < 15 * s && Math.abs(pt.y - wp.y) < 15 * s) return id;
    }
    return null;
  },

  drawLinks() {
    const state = gameState;
    const era = state.era;

    for (const link of BOARD.links) {
      const from = BOARD.locations[link.from] || BOARD.nonBuildable[link.from];
      const to = BOARD.locations[link.to] || BOARD.nonBuildable[link.to];
      if (!from || !to) continue;

      const linkState = state.board.links[link.id];
      const isAvailable = era === 'canal' ? link.canal : link.rail;

      let color = '#44553322';
      let width = 2;
      let dash = '';

      if (linkState && linkState.owner !== null) {
        color = BOARD.playerColors[linkState.owner];
        width = 5;
        if (linkState.type === 'canal') dash = '8,4';
      } else if (isAvailable) {
        color = era === 'canal' ? '#4488ccaa' : '#886644aa';
        width = 3;
        dash = '4,4';
      } else {
        color = '#33441144';
        width = 1;
        dash = '2,4';
      }

      if (link.through && BOARD.nonBuildable[link.through]) {
        const wp = BOARD.nonBuildable[link.through];
        this.drawLinkLine(from.x, from.y, wp.x, wp.y, color, width, dash, link.id);
        this.drawLinkLine(wp.x, wp.y, to.x, to.y, color, width, dash, link.id);
      } else {
        this.drawLinkLine(from.x, from.y, to.x, to.y, color, width, dash, link.id);
      }
    }
  },

  drawLinkLine(x1, y1, x2, y2, color, width, dash, linkId) {
    const line = this.createSVG('line', {
      x1, y1, x2, y2,
      stroke: color,
      'stroke-width': width,
      'stroke-dasharray': dash,
      'stroke-linecap': 'round',
      'data-link-id': linkId,
      class: 'board-link'
    });
    this.svg.appendChild(line);
  },

  drawNonBuildable() {
    for (const [id, wp] of Object.entries(BOARD.nonBuildable)) {
      const isEP = wp.isExternalPort;

      if (isEP) {
        // External port: circle with "E" marker
        const circle = this.createAndAppend('circle', {
          cx: wp.x, cy: wp.y, r: 10,
          fill: '#1a2a3acc',
          stroke: this.editMode ? '#ffcc00' : '#4488cc',
          'stroke-width': 1.5
        });
        circle.addEventListener('mousedown', (e) => this.onDragStart(e, id, 'nonBuildable'));

        this.createAndAppend('text', {
          x: wp.x, y: wp.y + 3,
          'text-anchor': 'middle', 'font-size': '8', fill: '#88ccff',
          'font-weight': 'bold', 'pointer-events': 'none'
        }).textContent = 'E';

        this.createAndAppend('text', {
          x: wp.x, y: wp.y + 19,
          'text-anchor': 'middle', 'font-size': '7', fill: '#88ccff',
          'pointer-events': 'none'
        }).textContent = wp.name;
      } else {
        // Non-buildable waypoint: diamond
        const diamond = this.createSVG('polygon', {
          points: `${wp.x},${wp.y-6} ${wp.x+6},${wp.y} ${wp.x},${wp.y+6} ${wp.x-6},${wp.y}`,
          fill: this.editMode ? '#555588aa' : '#33333388',
          stroke: this.editMode ? '#ffcc00' : '#66666688',
          'stroke-width': 1
        });
        diamond.addEventListener('mousedown', (e) => this.onDragStart(e, id, 'nonBuildable'));
        this.svg.appendChild(diamond);

        this.createAndAppend('text', {
          x: wp.x, y: wp.y + 14,
          'text-anchor': 'middle', 'font-size': '6', fill: '#aaa',
          'font-style': 'italic', 'pointer-events': 'none'
        }).textContent = wp.name;
      }
    }
  },

  // Original factory defaults for market panels (never mutated)
  MARKET_FACTORY: {
    turnOrderPanel:  { x: 573, y: 200 },
    moneySpentPanel: { x: 573, y: 290 },
    demandPanel:     { x: 573, y: 400 },
    vpPanel:         { x: 30,  y: 20 },
    coalPanel:       { x: 20,  y: 85 },
    ironPanel:       { x: 48,  y: 85 },
    incomePanel:     { x: 30,  y: 220 }
  },

  // Working copy (may be mutated during drag, restored on undo)
  marketDefaults: {},

  initMarketDefaults() {
    this.marketDefaults = JSON.parse(JSON.stringify(this.MARKET_FACTORY));
  },

  getMarketPos(id) {
    if (this.customPositions[id]) return this.customPositions[id];
    if (this.marketDefaults[id]) return this.marketDefaults[id];
    if (this.MARKET_FACTORY[id]) return this.MARKET_FACTORY[id];
    return { x: 100, y: 100 };
  },

  drawMarketPanels() {
    const state = gameState;
    const slotPrices = [1, 1, 2, 2, 3, 3, 4, 4];

    // Right side: turn order, money spent, demand
    this.drawTurnOrderPanel(state);
    this.drawMoneySpentPanel(state);
    this.drawDemandPanel(state);
    // Left side: VP, coal+iron, income
    this.drawVPPanel(state);
    this.drawResourcePanel('coalPanel', 'COAL', state.coalMarket, '#555', '#aaa', slotPrices);
    this.drawResourcePanel('ironPanel', 'IRON', state.ironMarket, '#d4740e', '#ffc080', slotPrices);
    this.drawIncomePanel(state);
  },

  drawDemandPanel(state) {
    const pos = this.getMarketPos('demandPanel');
    this.beginScaledGroup('demandPanel', pos.x, pos.y);
    const demand = state.distantMarketDemand;
    const w = 24, h = 180;
    this.createPanelBg('demandPanel', pos.x - w/2, pos.y - h/2 - 10, w, h + 20);

    const step = h / 8;
    const top = pos.y - h/2;

    // Label
    this.createAndAppend('text', {
      x: pos.x, y: top - 6,
      'text-anchor': 'middle', 'font-size': '6', fill: '#e94560',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = 'DEMAND';

    // Scale
    for (let i = 0; i <= 8; i++) {
      const y = top + i * step;
      this.createAndAppend('text', {
        x: pos.x - 14, y: y + 3,
        'text-anchor': 'end', 'font-size': '6', fill: '#888', 'pointer-events': 'none'
      }).textContent = 8 - i;
    }

    // Marker
    const markerY = top + (8 - demand) * step;
    this.createAndAppend('circle', {
      cx: pos.x, cy: markerY, r: 6,
      fill: '#e94560', stroke: '#fff', 'stroke-width': 1.5
    });
    this.createAndAppend('text', {
      x: pos.x, y: markerY + 3,
      'text-anchor': 'middle', 'font-size': '7', fill: '#fff',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = demand;
    this.endScaledGroup();
  },

  drawResourcePanel(panelId, label, cubes, cubeColor, textColor, slotPrices) {
    const pos = this.getMarketPos(panelId);
    this.beginScaledGroup(panelId, pos.x, pos.y);
    const slotSize = 11, gap = 2;
    const panelW = 24;
    const panelH = 8 * (slotSize + gap) + 16;
    this.createPanelBg(panelId, pos.x - panelW/2, pos.y - 6, panelW, panelH);

    // Label
    this.createAndAppend('text', {
      x: pos.x, y: pos.y + 2,
      'text-anchor': 'middle', 'font-size': '6', fill: textColor,
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = label;

    // Slots vertical: top=cheapest £1, bottom=most expensive £4
    const startY = pos.y + 8;
    for (let i = 0; i < 8; i++) {
      const slotIdx = i; // top = slot 0 (cheapest £1), bottom = slot 7 (expensive £4)
      const sy = startY + i * (slotSize + gap);
      const filled = slotIdx < cubes;
      const price = slotPrices[slotIdx];

      this.createAndAppend('rect', {
        x: pos.x - slotSize/2, y: sy,
        width: slotSize, height: slotSize,
        rx: 1,
        fill: filled ? cubeColor : '#222',
        stroke: '#666', 'stroke-width': 0.5
      });

      // Price + £ symbol inside the colored square
      this.createAndAppend('text', {
        x: pos.x, y: sy + slotSize/2 + 2,
        'text-anchor': 'middle', 'font-size': '6',
        fill: filled ? '#fff' : '#666',
        'font-weight': 'bold', 'pointer-events': 'none'
      }).textContent = '£' + price;
    }
    this.endScaledGroup();
  },

  drawTurnOrderPanel(state) {
    const pos = this.getMarketPos('turnOrderPanel');
    this.beginScaledGroup('turnOrderPanel', pos.x, pos.y);
    const numPlayers = state.players.length;
    const rowH = 14;
    const panelH = numPlayers * rowH + 16;
    const panelW = 60;

    this.createPanelBg('turnOrderPanel', pos.x - panelW/2, pos.y - 6, panelW, panelH);

    this.createAndAppend('text', {
      x: pos.x, y: pos.y + 3,
      'text-anchor': 'middle', 'font-size': '6', fill: '#ccc',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = 'TURN ORDER';

    const currentSeat = state.turnOrder[state.currentPlayerIndex];
    for (let i = 0; i < state.turnOrder.length; i++) {
      const seat = state.turnOrder[i];
      const p = state.players[seat];
      const y = pos.y + 8 + i * rowH;
      const isCurrent = seat === currentSeat;

      this.createAndAppend('rect', {
        x: pos.x - panelW/2 + 3, y: y - 4,
        width: 8, height: 8, rx: 1,
        fill: BOARD.playerColors[seat],
        stroke: isCurrent ? '#fff' : 'none', 'stroke-width': isCurrent ? 1.5 : 0
      });
      this.createAndAppend('text', {
        x: pos.x - panelW/2 + 14, y: y + 3,
        'text-anchor': 'start', 'font-size': '6',
        fill: isCurrent ? '#fff' : '#aaa',
        'font-weight': isCurrent ? 'bold' : 'normal',
        'pointer-events': 'none'
      }).textContent = (isCurrent ? '▸ ' : '') + (p.username || '').substring(0, 8);
    }
    this.endScaledGroup();
  },

  drawMoneySpentPanel(state) {
    const pos = this.getMarketPos('moneySpentPanel');
    this.beginScaledGroup('moneySpentPanel', pos.x, pos.y);
    const numPlayers = state.players.length;
    const rowH = 14;
    const panelH = numPlayers * rowH + 16;
    const panelW = 65;

    this.createPanelBg('moneySpentPanel', pos.x - panelW/2, pos.y - 6, panelW, panelH);

    this.createAndAppend('text', {
      x: pos.x, y: pos.y + 2,
      'text-anchor': 'middle', 'font-size': '5', fill: '#ccc',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = 'SPENT';

    for (let i = 0; i < state.turnOrder.length; i++) {
      const seat = state.turnOrder[i];
      const p = state.players[seat];
      const spent = p.spentThisRound || 0;
      const y = pos.y + 8 + i * rowH;

      // Player color square
      this.createAndAppend('rect', {
        x: pos.x - panelW/2 + 3, y: y - 4,
        width: 6, height: 6, rx: 1,
        fill: BOARD.playerColors[seat]
      });

      // Silver £5 discs and bronze £1 discs
      const fives = Math.floor(spent / 5);
      const ones = spent % 5;
      let dx = pos.x - panelW/2 + 12;
      for (let d = 0; d < Math.min(fives, 8); d++) {
        this.createAndAppend('circle', {
          cx: dx + d * 6, cy: y - 1, r: 2.5,
          fill: '#C0C0C0', stroke: '#888', 'stroke-width': 0.3
        });
      }
      if (fives > 8) {
        this.createAndAppend('text', {
          x: dx + 48, y: y + 2,
          'font-size': '4', fill: '#C0C0C0', 'pointer-events': 'none'
        }).textContent = fives + 'x';
      }
      dx += Math.min(fives, 8) * 6 + 2;
      for (let d = 0; d < ones; d++) {
        this.createAndAppend('circle', {
          cx: dx + d * 5, cy: y - 1, r: 2,
          fill: '#CD7F32', stroke: '#8B5A2B', 'stroke-width': 0.3
        });
      }
    }
    this.endScaledGroup();
  },

  drawVPPanel(state) {
    const pos = this.getMarketPos('vpPanel');
    this.beginScaledGroup('vpPanel', pos.x, pos.y);
    const numPlayers = state.players.length;
    const colW = 28;
    const panelW = numPlayers * colW + 4;
    const panelH = 36;

    this.createPanelBg('vpPanel', pos.x - 2, pos.y - 6, panelW, panelH);

    // Label
    this.createAndAppend('text', {
      x: pos.x + panelW/2 - 2, y: pos.y + 2,
      'text-anchor': 'middle', 'font-size': '5', fill: '#ccc',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = 'VICTORY POINTS';

    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const cx = pos.x + i * colW + colW/2;

      // Colored square with VP
      const vpFill = this.minimalMode ? 'none' : BOARD.playerColors[p.seat];
      this.createAndAppend('rect', {
        x: cx - 9, y: pos.y + 6,
        width: 18, height: 14, rx: 2,
        fill: vpFill, stroke: BOARD.playerColors[p.seat], 'stroke-width': this.minimalMode ? 1.5 : 0.5
      });
      this.createAndAppend('text', {
        x: cx, y: pos.y + 16,
        'text-anchor': 'middle', 'font-size': '8',
        fill: this.minimalMode ? BOARD.playerColors[p.seat] : '#fff',
        'font-weight': 'bold', 'pointer-events': 'none'
      }).textContent = p.vp;
      // Name below
      this.createAndAppend('text', {
        x: cx, y: pos.y + 26,
        'text-anchor': 'middle', 'font-size': '4', fill: '#aaa',
        'pointer-events': 'none'
      }).textContent = (p.username || '').substring(0, 6);
    }
    this.endScaledGroup();
  },

  drawIncomePanel(state) {
    const pos = this.getMarketPos('incomePanel');
    this.beginScaledGroup('incomePanel', pos.x, pos.y);
    const boxSize = 7;
    const gap = 1;
    const cols = 5;
    const rows = 20; // 0-99
    const panelW = cols * (boxSize + gap) + 8;
    const panelH = rows * (boxSize + gap) + 14;

    this.createPanelBg('incomePanel', pos.x - 4, pos.y - 6, panelW, panelH);

    this.createAndAppend('text', {
      x: pos.x + panelW/2 - 4, y: pos.y + 2,
      'text-anchor': 'middle', 'font-size': '5', fill: '#ccc',
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = 'INCOME';

    // Player income positions
    const playerIncomes = {};
    for (const p of state.players) {
      if (!playerIncomes[p.income]) playerIncomes[p.income] = [];
      playerIncomes[p.income].push(p.seat);
    }

    // Draw serpentine track
    const startY = pos.y + 8;
    for (let num = 0; num < 100; num++) {
      const row = Math.floor(num / cols);
      const colInRow = num % cols;
      // Serpentine: even rows left-to-right, odd rows right-to-left
      const col = row % 2 === 0 ? colInRow : (cols - 1 - colInRow);
      const bx = pos.x + col * (boxSize + gap);
      const by = startY + row * (boxSize + gap);

      const players = playerIncomes[num] || [];

      if (players.length === 0) {
        // Empty square
        this.createAndAppend('rect', {
          x: bx, y: by, width: boxSize, height: boxSize,
          fill: '#222', stroke: '#444', 'stroke-width': 0.3, rx: 0.5
        });
      } else if (players.length === 1) {
        // Single player
        this.createAndAppend('rect', {
          x: bx, y: by, width: boxSize, height: boxSize,
          fill: BOARD.playerColors[players[0]], stroke: '#fff', 'stroke-width': 0.8, rx: 0.5
        });
      } else {
        // Multiple players: split square evenly
        const n = players.length;
        if (n === 2) {
          // Left/right split
          this.createAndAppend('rect', { x: bx, y: by, width: boxSize/2, height: boxSize, fill: BOARD.playerColors[players[0]], rx: 0.5 });
          this.createAndAppend('rect', { x: bx + boxSize/2, y: by, width: boxSize/2, height: boxSize, fill: BOARD.playerColors[players[1]], rx: 0.5 });
        } else if (n === 3) {
          // Three vertical strips
          const w = boxSize / 3;
          for (let pi = 0; pi < 3; pi++) {
            this.createAndAppend('rect', { x: bx + pi * w, y: by, width: w, height: boxSize, fill: BOARD.playerColors[players[pi]] });
          }
        } else {
          // Four quadrants
          const h2 = boxSize / 2;
          this.createAndAppend('rect', { x: bx, y: by, width: h2, height: h2, fill: BOARD.playerColors[players[0]] });
          this.createAndAppend('rect', { x: bx + h2, y: by, width: h2, height: h2, fill: BOARD.playerColors[players[1]] });
          this.createAndAppend('rect', { x: bx, y: by + h2, width: h2, height: h2, fill: BOARD.playerColors[players[2]] });
          this.createAndAppend('rect', { x: bx + h2, y: by + h2, width: h2, height: h2, fill: BOARD.playerColors[players[3] || players[0]] });
        }
        // Border
        this.createAndAppend('rect', { x: bx, y: by, width: boxSize, height: boxSize, fill: 'none', stroke: '#fff', 'stroke-width': 0.5, rx: 0.5 });
      }

      // Show number every 10
      if (num % 10 === 0) {
        this.createAndAppend('text', {
          x: bx + boxSize/2, y: by + boxSize/2 + 1.5,
          'text-anchor': 'middle', 'font-size': '3', fill: players.length > 0 ? '#fff' : '#888',
          'pointer-events': 'none'
        }).textContent = num;
      }
    }
    this.endScaledGroup();
  },

  drawLocations() {
    const state = gameState;

    for (const [locId, loc] of Object.entries(BOARD.locations)) {
      const locState = state.board.locations[locId];
      if (!locState) continue;

      this.beginScaledGroup(locId, loc.x, loc.y);
      const numSlots = locState.slots.length;
      const cols = Math.min(numSlots, 2);
      const rows = Math.ceil(numSlots / 2);

      // Rectangle dimensions
      const slotSize = 14;
      const slotGap = 3;
      const padX = 4;
      const padY = 3;
      const nameHeight = 10;

      const rectW = cols * slotSize + (cols - 1) * slotGap + padX * 2;
      const rectH = nameHeight + rows * slotSize + (rows - 1) * slotGap + padY * 2;
      const rx = loc.x - rectW / 2;
      const ry = loc.y - rectH / 2;

      // Location rectangle
      const rect = this.createAndAppend('rect', {
        x: rx, y: ry, width: rectW, height: rectH,
        rx: 3, ry: 3,
        fill: '#d6c8a8aa',
        stroke: this.editMode ? '#ffcc00' : '#8b7355',
        'stroke-width': this.editMode ? 2 : 1.5,
        'data-location': locId,
        class: 'board-location'
      });
      rect.addEventListener('mousedown', (e) => this.onDragStart(e, locId, 'location'));

      // Location name inside the rectangle
      this.createAndAppend('text', {
        x: loc.x, y: ry + nameHeight,
        'text-anchor': 'middle',
        'font-size': '6.5',
        'font-family': 'sans-serif',
        fill: '#332211',
        'font-weight': 'bold',
        'pointer-events': 'none'
      }).textContent = loc.name;

      // Draw slots in grid (max 2 per row)
      const slotsStartY = ry + nameHeight + padY;
      const slotsStartX = rx + padX;

      for (let i = 0; i < numSlots; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx = slotsStartX + col * (slotSize + slotGap) + slotSize / 2;
        const sy = slotsStartY + row * (slotSize + slotGap) + slotSize / 2;

        this.drawSlot(locId, locState.slots[i], i, sx, sy, slotSize);
      }
      this.endScaledGroup();
    }
  },

  drawSlot(locId, slot, index, cx, cy, size) {
    const half = size / 2;

    if (slot.owner !== null) {
      // Filled slot
      const fillColor = slot.flipped
        ? BOARD.playerColors[slot.owner]
        : BOARD.industryColors[slot.industryType] || '#ccc';

      this.createAndAppend('rect', {
        x: cx - half, y: cy - half,
        width: size, height: size,
        rx: 2,
        fill: fillColor,
        stroke: BOARD.playerColors[slot.owner],
        'stroke-width': slot.flipped ? 2.5 : 1,
        'data-location': locId, 'data-slot': index,
        class: 'board-slot filled'
      });

      this.createAndAppend('text', {
        x: cx, y: cy + 3,
        'text-anchor': 'middle', 'font-size': '7', 'font-weight': 'bold',
        fill: slot.industryType === 'coalMine' ? '#fff' : '#333',
        'pointer-events': 'none'
      }).textContent = BOARD.industryIcons[slot.industryType] + slot.level;

      // Resource cubes
      if (slot.resources > 0) {
        const cubeColor = slot.industryType === 'coalMine' ? '#111' : '#d4740e';
        for (let r = 0; r < slot.resources; r++) {
          this.createAndAppend('rect', {
            x: cx - half + r * 4, y: cy + half + 1,
            width: 3, height: 3,
            fill: cubeColor, stroke: '#fff', 'stroke-width': 0.3
          });
        }
      }
    } else {
      // Empty slot
      const allowed = slot.allowed;
      const isDual = allowed.length > 1;

      this.createAndAppend('rect', {
        x: cx - half, y: cy - half,
        width: size, height: size,
        rx: 2,
        fill: isDual ? '#ffffff33' : '#ffffff18',
        stroke: '#8b735555', 'stroke-width': 0.8,
        'stroke-dasharray': '2,1.5',
        'data-location': locId, 'data-slot': index,
        class: 'board-slot empty'
      });

      this.createAndAppend('text', {
        x: cx, y: cy + 2.5,
        'text-anchor': 'middle',
        'font-size': isDual ? '5' : '6',
        fill: '#8b7355aa',
        'pointer-events': 'none'
      }).textContent = allowed.map(t => BOARD.industryIcons[t] || '?').join('/');
    }
  },

  // SVG helpers
  createSVG(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  },

  createAndAppend(tag, attrs) {
    const el = this.createSVG(tag, attrs);
    // If we're inside a scaled group, append there; otherwise to svg
    const target = this._currentGroup || this.svg;
    target.appendChild(el);
    return el;
  },

  _currentGroup: null,

  // Begin a scaled group centered at (cx, cy) with scale from customPositions
  beginScaledGroup(id, cx, cy) {
    const s = this.getScale(id);
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(' + cx + ',' + cy + ') scale(' + s + ') translate(' + (-cx) + ',' + (-cy) + ')');
    this.svg.appendChild(g);
    this._currentGroup = g;
    return g;
  },

  endScaledGroup() {
    this._currentGroup = null;
  },

  // Draw resize handles on a panel background rect
  addResizeHandle(panelId, x, y, w, h) {
    if (!this.resizeMode) return;
    // Bottom-right corner triangle
    const tri = this.createAndAppend('polygon', {
      points: (x + w) + ',' + (y + h - 6) + ' ' + (x + w) + ',' + (y + h) + ' ' + (x + w - 6) + ',' + (y + h),
      fill: '#ffcc00cc', stroke: '#fff', 'stroke-width': 0.3,
      cursor: 'nwse-resize'
    });
    tri.addEventListener('mousedown', (e) => this.onResizeStart(e, panelId));

    // Bottom bar
    const bar = this.createAndAppend('rect', {
      x: x + 3, y: y + h - 2.5,
      width: w - 6, height: 2.5,
      rx: 1, fill: '#ffcc0077',
      cursor: 'ns-resize'
    });
    bar.addEventListener('mousedown', (e) => this.onResizeStart(e, panelId));
  },

  // Convenience: create panel bg and add resize handle
  createPanelBg(panelId, x, y, w, h) {
    const bg = this.createAndAppend('rect', {
      x, y, width: w, height: h,
      rx: 3, fill: '#00000077',
      stroke: (this.editMode || this.resizeMode) ? '#ffcc00' : '#88888844',
      'stroke-width': (this.editMode || this.resizeMode) ? 1.5 : 0.5
    });
    bg.addEventListener('mousedown', (e) => this.onDragStart(e, panelId, 'market'));
    this.addResizeHandle(panelId, x, y, w, h);
    return bg;
  },

  onResizeStart(e, panelId) {
    e.preventDefault();
    e.stopPropagation();
    const pt = this.svgPoint(e);
    this.resizing = {
      id: panelId,
      startY: pt.y,
      startScale: this.getScale(panelId)
    };
  },

  highlightLocations(locIds, callback) {
    document.querySelectorAll('.board-location').forEach(el => {
      const locId = el.getAttribute('data-location');
      if (locIds.includes(locId)) {
        el.classList.add('highlight');
        el.style.cursor = 'pointer';
        el.onclick = () => callback(locId);
      }
    });
  },

  highlightLinks(linkIds, callback) {
    document.querySelectorAll('.board-link').forEach(el => {
      const linkId = el.getAttribute('data-link-id');
      if (linkIds.includes(linkId)) {
        el.classList.add('highlight');
        el.style.cursor = 'pointer';
        el.onclick = () => callback(linkId);
      }
    });
  },

  clearHighlights() {
    document.querySelectorAll('.highlight').forEach(el => {
      el.classList.remove('highlight');
      el.style.cursor = '';
      el.onclick = null;
    });
  },

  // ============ EDIT MODE: DRAG NODES ============

  updateEditButtons() {
    const active = this.editMode || this.resizeMode;
    document.getElementById('reset-nodes-btn').style.display = active ? '' : 'none';
    document.getElementById('like-xai-btn').style.display = active ? '' : 'none';
  },

  toggleEditMode() {
    this.editMode = !this.editMode;
    const btn = document.getElementById('edit-nodes-btn');
    if (this.editMode) {
      btn.textContent = 'Done';
      btn.classList.add('btn-primary');
      this.svg.style.cursor = 'move';
    } else {
      btn.textContent = 'Move';
      btn.classList.remove('btn-primary');
      this.svg.style.cursor = '';
      this.savePositions();
    }
    this.updateEditButtons();
  },

  svgPoint(e) {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(this.svg.getScreenCTM().inverse());
  },

  onDragStart(e, nodeId, nodeType) {
    if (!this.editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = this.svgPoint(e);
    const source = nodeType === 'location' ? BOARD.locations[nodeId]
      : nodeType === 'nonBuildable' ? BOARD.nonBuildable[nodeId]
      : nodeType === 'market' ? this.getMarketPos(nodeId)
      : null;
    if (!source) return;
    this.dragging = { id: nodeId, type: nodeType };
    this.dragOffset = { x: pt.x - source.x, y: pt.y - source.y };
  },

  onDragMove(e) {
    // Handle resize drag
    if (this.resizing) {
      const pt = this.svgPoint(e);
      const deltaY = pt.y - this.resizing.startY;
      const newScale = Math.max(0.4, Math.min(3, this.resizing.startScale + deltaY * 0.01));
      const id = this.resizing.id;
      if (!this.customPositions[id]) {
        const def = this.marketDefaults[id] || BOARD.locations[id] || BOARD.nonBuildable[id] || { x: 100, y: 100 };
        this.customPositions[id] = { x: def.x, y: def.y, scale: newScale };
      } else {
        this.customPositions[id].scale = newScale;
      }
      this.render();
      return;
    }

    if (!this.dragging) return;
    const pt = this.svgPoint(e);
    const newX = Math.round(pt.x - this.dragOffset.x);
    const newY = Math.round(pt.y - this.dragOffset.y);
    const d = this.dragging;

    if (d.type === 'location' && BOARD.locations[d.id]) {
      BOARD.locations[d.id].x = newX;
      BOARD.locations[d.id].y = newY;
    } else if (d.type === 'nonBuildable' && BOARD.nonBuildable[d.id]) {
      BOARD.nonBuildable[d.id].x = newX;
      BOARD.nonBuildable[d.id].y = newY;
    } else if (d.type === 'market') {
      this.marketDefaults[d.id] = { x: newX, y: newY };
    }

    this.customPositions[d.id] = { x: newX, y: newY };
    this.render();
  },

  onDragEnd() {
    if (this.resizing) {
      this.resizing = null;
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => this.savePositions(), 1500);
      return;
    }
    if (!this.dragging) return;
    this.dragging = null;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.savePositions(), 2000);
  },

  pushHistory() {
    // Save current state before making changes
    this.positionHistory.push(JSON.stringify(this.customPositions));
    // Keep max 50 history entries
    if (this.positionHistory.length > 50) this.positionHistory.shift();
  },

  async savePositions() {
    this.pushHistory();
    if (Object.keys(this.customPositions).length === 0) return;
    try {
      await fetch('/api/user/node-positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.customPositions)
      });
    } catch (e) {
      // silent fail
    }
  },

  applyAndRender(positions) {
    // Reset everything to factory defaults
    for (const [locId, loc] of Object.entries(BOARD_DEFAULTS.locations)) {
      BOARD.locations[locId].x = loc.x;
      BOARD.locations[locId].y = loc.y;
    }
    for (const [id, wp] of Object.entries(BOARD_DEFAULTS.nonBuildable)) {
      BOARD.nonBuildable[id].x = wp.x;
      BOARD.nonBuildable[id].y = wp.y;
    }
    this.initMarketDefaults(); // reset market panels to factory positions

    // Apply the given positions on top
    this.customPositions = positions;
    this.applyCustomPositions();
    // Update marketDefaults for panels that have custom positions
    for (const id of Object.keys(this.MARKET_FACTORY)) {
      if (this.customPositions[id]) {
        this.marketDefaults[id] = { x: this.customPositions[id].x, y: this.customPositions[id].y };
      }
    }
    this.render();
  },

  async resetPositions() {
    if (this.positionHistory.length > 0) {
      this.applyAndRender(JSON.parse(this.positionHistory.pop()));
    } else {
      // Nothing to undo - reset to factory defaults
      this.applyAndRender({});
    }
    // Save to server
    try {
      if (Object.keys(this.customPositions).length > 0) {
        await fetch('/api/user/node-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.customPositions)
        });
      } else {
        await fetch('/api/user/node-positions', { method: 'DELETE' });
      }
    } catch (e) {}
  },

  async loadXaiPositions() {
    if (typeof XAI_POSITIONS === 'object' && XAI_POSITIONS !== null) {
      this.pushHistory();
      this.applyAndRender(JSON.parse(JSON.stringify(XAI_POSITIONS)));
      // Save as user's own
      try {
        await fetch('/api/user/node-positions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.customPositions)
        });
      } catch (e) {}
    }
  }
};
