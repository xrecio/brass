// SVG Board Renderer for Brass: Lancashire
// Renders locations as rectangles overlaying the game board map image

const BoardRenderer = {
  svg: null,
  mapImage: null,
  editMode: false,
  dragging: null,
  dragOffset: { x: 0, y: 0 },
  customPositions: {},  // locId -> {x, y}
  saveTimeout: null,

  init() {
    this.svg = document.getElementById('game-board');

    // Load saved positions
    if (typeof CUSTOM_POSITIONS === 'object' && CUSTOM_POSITIONS !== null) {
      this.customPositions = CUSTOM_POSITIONS;
      this.applyCustomPositions();
    }

    // SVG drag handlers
    this.svg.addEventListener('mousemove', (e) => this.onDragMove(e));
    this.svg.addEventListener('mouseup', () => this.onDragEnd());
    this.svg.addEventListener('mouseleave', () => this.onDragEnd());

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

    // Draw links
    this.drawLinks();

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

  // Default positions for market panels (draggable)
  marketDefaults: {
    demandPanel:  { x: 573, y: 380 },
    coalPanel:    { x: 30,  y: 80 },
    ironPanel:    { x: 30,  y: 140 }
  },

  getMarketPos(id) {
    return this.customPositions[id] || this.marketDefaults[id] || { x: 100, y: 100 };
  },

  drawMarketPanels() {
    const state = gameState;
    const slotPrices = [1, 1, 2, 2, 3, 3, 4, 4];

    // Demand panel
    this.drawDemandPanel(state);
    // Coal panel
    this.drawResourcePanel('coalPanel', 'COAL', state.coalMarket, '#555', '#aaa', slotPrices);
    // Iron panel
    this.drawResourcePanel('ironPanel', 'IRON', state.ironMarket, '#d4740e', '#ffc080', slotPrices);
  },

  drawDemandPanel(state) {
    const pos = this.getMarketPos('demandPanel');
    const demand = state.distantMarketDemand;
    const w = 24, h = 180;

    // Background (draggable)
    const bg = this.createAndAppend('rect', {
      x: pos.x - w/2, y: pos.y - h/2 - 10,
      width: w, height: h + 20,
      rx: 3, fill: '#00000077', stroke: this.editMode ? '#ffcc00' : '#88888844', 'stroke-width': this.editMode ? 1.5 : 0.5
    });
    bg.addEventListener('mousedown', (e) => this.onDragStart(e, 'demandPanel', 'market'));

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
  },

  drawResourcePanel(panelId, label, cubes, cubeColor, textColor, slotPrices) {
    const pos = this.getMarketPos(panelId);
    const slotSize = 11, gap = 2;
    const panelW = 24;
    const panelH = 8 * (slotSize + gap) + 16;

    // Background (draggable)
    const bg = this.createAndAppend('rect', {
      x: pos.x - panelW/2, y: pos.y - 6,
      width: panelW, height: panelH,
      rx: 3, fill: '#00000077', stroke: this.editMode ? '#ffcc00' : '#88888844', 'stroke-width': this.editMode ? 1.5 : 0.5
    });
    bg.addEventListener('mousedown', (e) => this.onDragStart(e, panelId, 'market'));

    // Label
    this.createAndAppend('text', {
      x: pos.x, y: pos.y + 2,
      'text-anchor': 'middle', 'font-size': '6', fill: textColor,
      'font-weight': 'bold', 'pointer-events': 'none'
    }).textContent = label;

    // Slots vertical (top=most expensive £4, bottom=cheapest £1)
    const startY = pos.y + 8;
    for (let i = 0; i < 8; i++) {
      const slotIdx = 7 - i; // top = slot 7 (expensive), bottom = slot 0 (cheap)
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

      // Price label to the right
      this.createAndAppend('text', {
        x: pos.x + slotSize/2 + 3, y: sy + slotSize/2 + 2,
        'text-anchor': 'start', 'font-size': '5', fill: '#888',
        'pointer-events': 'none'
      }).textContent = '£' + price;
    }
  },

  drawLocations() {
    const state = gameState;

    for (const [locId, loc] of Object.entries(BOARD.locations)) {
      const locState = state.board.locations[locId];
      if (!locState) continue;

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
    this.svg.appendChild(el);
    return el;
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

  toggleEditMode() {
    this.editMode = !this.editMode;
    const btn = document.getElementById('edit-nodes-btn');
    const resetBtn = document.getElementById('reset-nodes-btn');
    if (this.editMode) {
      btn.textContent = 'Done';
      btn.classList.add('btn-primary');
      resetBtn.style.display = '';
      this.svg.style.cursor = 'move';
    } else {
      btn.textContent = 'Move Nodes';
      btn.classList.remove('btn-primary');
      resetBtn.style.display = 'none';
      this.svg.style.cursor = '';
      this.savePositions();
    }
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
      // Market panels: update defaults so getMarketPos picks them up
      this.marketDefaults[d.id] = { x: newX, y: newY };
    }

    this.customPositions[d.id] = { x: newX, y: newY };
    this.render();
  },

  onDragEnd() {
    if (!this.dragging) return;
    this.dragging = null;
    // Debounced save
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.savePositions(), 2000);
  },

  async savePositions() {
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

  async resetPositions() {
    this.customPositions = {};
    // Reset BOARD data to defaults
    for (const [locId, loc] of Object.entries(BOARD_DEFAULTS.locations)) {
      BOARD.locations[locId].x = loc.x;
      BOARD.locations[locId].y = loc.y;
    }
    for (const [id, wp] of Object.entries(BOARD_DEFAULTS.nonBuildable)) {
      BOARD.nonBuildable[id].x = wp.x;
      BOARD.nonBuildable[id].y = wp.y;
    }
    this.render();
    try {
      await fetch('/api/user/node-positions', { method: 'DELETE' });
    } catch (e) {}
  }
};
