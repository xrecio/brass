// SVG Board Renderer for Brass: Lancashire

const BoardRenderer = {
  svg: null,

  init() {
    this.svg = document.getElementById('game-board');
    this.render();
  },

  render() {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    // Background
    this.addRect(0, 0, 600, 520, '#2d5016', 1);

    // Draw links
    this.drawLinks();

    // Draw locations
    this.drawLocations();
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

      let color = '#445533';
      let width = 2;
      let dash = '';

      if (linkState && linkState.owner !== null) {
        color = BOARD.playerColors[linkState.owner];
        width = 4;
        if (linkState.type === 'canal') dash = '8,4';
      } else if (isAvailable) {
        color = era === 'canal' ? '#5599cc55' : '#88664455';
        width = 2;
        dash = '4,4';
      } else {
        color = '#33441188';
        width = 1;
        dash = '2,4';
      }

      const line = this.createSVG('line', {
        x1: from.x, y1: from.y,
        x2: to.x, y2: to.y,
        stroke: color,
        'stroke-width': width,
        'stroke-dasharray': dash,
        'data-link-id': link.id,
        class: 'board-link'
      });
      this.svg.appendChild(line);
    }
  },

  drawLocations() {
    const state = gameState;

    for (const [locId, loc] of Object.entries(BOARD.locations)) {
      const locState = state.board.locations[locId];
      if (!locState) continue;

      const numSlots = locState.slots.length;
      const radius = 18 + numSlots * 4;

      // Location circle
      const circle = this.createSVG('circle', {
        cx: loc.x, cy: loc.y, r: radius,
        fill: '#e8dcc8',
        stroke: '#8b7355',
        'stroke-width': 2,
        'data-location': locId,
        class: 'board-location'
      });
      this.svg.appendChild(circle);

      // Location name
      const text = this.createSVG('text', {
        x: loc.x, y: loc.y - radius - 5,
        'text-anchor': 'middle',
        'font-size': '9',
        'font-family': 'sans-serif',
        fill: '#fff',
        'font-weight': 'bold'
      });
      text.textContent = loc.name;
      this.svg.appendChild(text);

      // Draw industry slots
      this.drawSlots(locId, loc, locState);
    }
  },

  drawSlots(locId, loc, locState) {
    const slots = locState.slots;
    const spacing = 20;
    const startX = loc.x - (slots.length - 1) * spacing / 2;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const sx = startX + i * spacing;
      const sy = loc.y;

      if (slot.owner !== null) {
        // Filled slot
        const fillColor = slot.flipped
          ? BOARD.playerColors[slot.owner]
          : BOARD.industryColors[slot.industryType] || '#ccc';

        const rect = this.createSVG('rect', {
          x: sx - 8, y: sy - 8,
          width: 16, height: 16,
          rx: 2,
          fill: fillColor,
          stroke: BOARD.playerColors[slot.owner],
          'stroke-width': slot.flipped ? 3 : 1.5,
          'data-location': locId,
          'data-slot': i,
          class: 'board-slot filled'
        });
        this.svg.appendChild(rect);

        // Industry icon
        const icon = this.createSVG('text', {
          x: sx, y: sy + 3,
          'text-anchor': 'middle',
          'font-size': '9',
          'font-weight': 'bold',
          fill: slot.industryType === 'coalMine' ? '#fff' : '#333',
          'pointer-events': 'none'
        });
        icon.textContent = BOARD.industryIcons[slot.industryType] + slot.level;
        this.svg.appendChild(icon);

        // Resource cubes
        if (slot.resources > 0) {
          const cubeColor = slot.industryType === 'coalMine' ? '#111' : '#d4740e';
          for (let r = 0; r < slot.resources; r++) {
            const cube = this.createSVG('rect', {
              x: sx - 8 + r * 5, y: sy + 10,
              width: 4, height: 4,
              fill: cubeColor,
              stroke: '#fff',
              'stroke-width': 0.5
            });
            this.svg.appendChild(cube);
          }
        }
      } else {
        // Empty slot - show allowed type
        const allowed = slot.allowed[0];
        const rect = this.createSVG('rect', {
          x: sx - 7, y: sy - 7,
          width: 14, height: 14,
          rx: 2,
          fill: 'none',
          stroke: '#8b735555',
          'stroke-width': 1,
          'stroke-dasharray': '3,2',
          'data-location': locId,
          'data-slot': i,
          class: 'board-slot empty'
        });
        this.svg.appendChild(rect);

        const label = this.createSVG('text', {
          x: sx, y: sy + 3,
          'text-anchor': 'middle',
          'font-size': '7',
          fill: '#8b735588',
          'pointer-events': 'none'
        });
        label.textContent = BOARD.industryIcons[allowed] || '?';
        this.svg.appendChild(label);
      }
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

  addRect(x, y, w, h, fill, opacity) {
    const rect = this.createSVG('rect', {
      x, y, width: w, height: h,
      fill, opacity: opacity || 1
    });
    this.svg.appendChild(rect);
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
  }
};
