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
      if (BOARD.externalPorts[locId]) {
        BOARD.externalPorts[locId].x = pos.x;
        BOARD.externalPorts[locId].y = pos.y;
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

    // Draw non-buildable waypoints
    this.drawNonBuildable();

    // Draw external ports
    this.drawExternalPorts();

    // Draw locations as rectangles
    this.drawLocations();
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
      const from = BOARD.locations[link.from];
      const to = BOARD.locations[link.to];
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
      const diamond = this.createSVG('polygon', {
        points: `${wp.x},${wp.y-6} ${wp.x+6},${wp.y} ${wp.x},${wp.y+6} ${wp.x-6},${wp.y}`,
        fill: this.editMode ? '#555588aa' : '#33333388',
        stroke: this.editMode ? '#ffcc00' : '#66666688',
        'stroke-width': 1
      });
      diamond.addEventListener('mousedown', (e) => this.onDragStart(e, id, 'nonBuildable'));
      this.svg.appendChild(diamond);

      const text = this.createSVG('text', {
        x: wp.x, y: wp.y + 14,
        'text-anchor': 'middle',
        'font-size': '6',
        fill: '#aaa',
        'font-style': 'italic',
        'pointer-events': 'none'
      });
      text.textContent = wp.name;
      this.svg.appendChild(text);
    }
  },

  drawExternalPorts() {
    for (const [id, port] of Object.entries(BOARD.externalPorts)) {
      // Dashed lines to connected locations
      for (const locId of port.connectedTo) {
        const loc = BOARD.locations[locId];
        if (!loc) continue;
        this.createAndAppend('line', {
          x1: port.x, y1: port.y, x2: loc.x, y2: loc.y,
          stroke: '#4488cc33', 'stroke-width': 1, 'stroke-dasharray': '3,3'
        });
      }

      const epCircle = this.createAndAppend('circle', {
        cx: port.x, cy: port.y, r: 10,
        fill: '#1a2a3acc',
        stroke: this.editMode ? '#ffcc00' : '#4488cc',
        'stroke-width': 1.5
      });
      epCircle.addEventListener('mousedown', (e) => this.onDragStart(e, id, 'externalPort'));

      this.createAndAppend('text', {
        x: port.x, y: port.y + 3,
        'text-anchor': 'middle', 'font-size': '8', fill: '#88ccff',
        'font-weight': 'bold', 'pointer-events': 'none'
      }).textContent = 'E';

      this.createAndAppend('text', {
        x: port.x, y: port.y + 18,
        'text-anchor': 'middle', 'font-size': '7', fill: '#88ccff',
        'pointer-events': 'none'
      }).textContent = port.name;
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
      : BOARD.externalPorts[nodeId];
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
    } else if (d.type === 'externalPort' && BOARD.externalPorts[d.id]) {
      BOARD.externalPorts[d.id].x = newX;
      BOARD.externalPorts[d.id].y = newY;
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
    for (const [id, ep] of Object.entries(BOARD_DEFAULTS.externalPorts)) {
      BOARD.externalPorts[id].x = ep.x;
      BOARD.externalPorts[id].y = ep.y;
    }
    this.render();
    try {
      await fetch('/api/user/node-positions', { method: 'DELETE' });
    } catch (e) {}
  }
};
