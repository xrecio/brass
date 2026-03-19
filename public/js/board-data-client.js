// Client-side board data for SVG rendering
const BOARD = {
  locations: {
    lancaster:      { name: 'Lancaster',            x: 248, y: 58 },
    barrow:         { name: 'Barrow-in-Furness',    x: 108, y: 38 },
    fleetwood:      { name: 'Fleetwood',            x: 138, y: 85 },
    preston:        { name: 'Preston',              x: 228, y: 145 },
    blackburn:      { name: 'Blackburn',            x: 345, y: 142 },
    burnley:        { name: 'Burnley',              x: 430, y: 100 },
    colne:          { name: 'Colne',                x: 518, y: 70 },
    wigan:          { name: 'Wigan',                x: 195, y: 252 },
    bolton:         { name: 'Bolton',               x: 325, y: 235 },
    bury:           { name: 'Bury',                 x: 415, y: 215 },
    rochdale:       { name: 'Rochdale',             x: 505, y: 198 },
    oldham:         { name: 'Oldham',               x: 515, y: 278 },
    manchester:     { name: 'Manchester',           x: 400, y: 335 },
    stockport:      { name: 'Stockport',            x: 475, y: 405 },
    macclesfield:   { name: 'Macclesfield',         x: 425, y: 460 },
    liverpool:      { name: 'Liverpool',            x: 65,  y: 315 },
    birkenhead:     { name: 'Birkenhead',           x: 48,  y: 405 },
    warrington:     { name: 'Warrington & Runcorn', x: 235, y: 378 },
    ellesmerePort:  { name: 'Ellesmere Port',       x: 145, y: 445 }
  },

  nonBuildable: {
    northwich:    { name: 'Northwich',     x: 310, y: 455 },
    blackpool:    { name: 'Blackpool',     x: 118, y: 132 },
    southport:    { name: 'Southport',     x: 75,  y: 228 },
    scotland:     { name: 'Scotland',      x: 100, y: 8,   isExternalPort: true },
    yorkshire:    { name: 'Yorkshire',     x: 570, y: 115, isExternalPort: true },
    theMidlands:  { name: 'The Midlands',  x: 360, y: 500, isExternalPort: true }
  },

  links: [
    { id: 'barrow-lancaster', from: 'barrow', to: 'lancaster', canal: false, rail: true, segments: 1 },
    { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true, segments: 1 },
    { id: 'lancaster-scotland', from: 'lancaster', to: 'scotland', canal: false, rail: true, segments: 2 },
    { id: 'preston-fleetwood', from: 'preston', to: 'fleetwood', canal: true, rail: true, segments: 1 },
    { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: false, rail: true, segments: 1 },
    { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true, segments: 1 },
    { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true, segments: 1 },
    { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true, segments: 1 },
    { id: 'blackburn-wigan', from: 'blackburn', to: 'wigan', canal: true, rail: true, segments: 1 },
    { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true, segments: 1 },
    { id: 'colne-yorkshire', from: 'colne', to: 'yorkshire', canal: true, rail: true, segments: 2 },
    { id: 'rochdale-yorkshire', from: 'rochdale', to: 'yorkshire', canal: true, rail: true, segments: 2 },
    { id: 'wigan-bolton', from: 'wigan', to: 'bolton', canal: false, rail: true, segments: 1 },
    { id: 'wigan-warrington', from: 'wigan', to: 'warrington', canal: true, rail: true, segments: 1 },
    { id: 'wigan-liverpool', from: 'wigan', to: 'liverpool', canal: true, rail: true, segments: 1 },
    { id: 'wigan-southport', from: 'wigan', to: 'southport', canal: false, rail: true, segments: 2 },
    { id: 'southport-liverpool', from: 'southport', to: 'liverpool', canal: false, rail: true, segments: 2 },
    { id: 'bolton-bury', from: 'bolton', to: 'bury', canal: true, rail: true, segments: 1 },
    { id: 'bolton-manchester', from: 'bolton', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'bury-manchester', from: 'bury', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'bury-rochdale', from: 'bury', to: 'rochdale', canal: false, rail: true, segments: 1 },
    { id: 'rochdale-oldham', from: 'rochdale', to: 'oldham', canal: true, rail: true, segments: 1 },
    { id: 'oldham-manchester', from: 'oldham', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'manchester-stockport', from: 'manchester', to: 'stockport', canal: true, rail: true, segments: 1 },
    { id: 'manchester-warrington', from: 'manchester', to: 'warrington', canal: true, rail: true, segments: 1 },
    { id: 'liverpool-warrington', from: 'liverpool', to: 'warrington', canal: false, rail: true, segments: 1 },
    { id: 'liverpool-birkenhead', from: 'liverpool', to: 'birkenhead', canal: false, rail: true, segments: 1 },
    { id: 'liverpool-ellesmerePort', from: 'liverpool', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
    { id: 'warrington-ellesmerePort', from: 'warrington', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
    { id: 'ellesmerePort-northwich', from: 'ellesmerePort', to: 'northwich', canal: true, rail: true, segments: 2 },
    { id: 'northwich-theMidlands', from: 'northwich', to: 'theMidlands', canal: true, rail: true, segments: 2 },
    { id: 'stockport-macclesfield', from: 'stockport', to: 'macclesfield', canal: true, rail: true, segments: 1 },
    { id: 'macclesfield-theMidlands', from: 'macclesfield', to: 'theMidlands', canal: true, rail: true, segments: 2 }
  ],

  playerColors: ['#e74c3c', '#9b59b6', '#2ecc71', '#f39c12'],
  industryIcons: {
    cottonMill: 'M',
    coalMine: 'C',
    ironWorks: 'I',
    port: 'P',
    shipyard: 'S'
  },
  industryColors: {
    cottonMill: '#f8f8f8',
    coalMine: '#555',
    ironWorks: '#d4740e',
    port: '#2196F3',
    shipyard: '#9C27B0'
  }
};

// Income track: square 0-99 -> actual income per round
const INCOME_TRACK = [];
for (let i = 0; i <= 9; i++) INCOME_TRACK[i] = -10 + i;
INCOME_TRACK[10] = 0;
for (let inc = 1; inc <= 10; inc++) { const b = 10 + (inc-1)*2 + 1; INCOME_TRACK[b] = inc; INCOME_TRACK[b+1] = inc; }
for (let inc = 11; inc <= 20; inc++) { const b = 30 + (inc-11)*3 + 1; INCOME_TRACK[b] = inc; INCOME_TRACK[b+1] = inc; INCOME_TRACK[b+2] = inc; }
for (let inc = 21; inc <= 29; inc++) { const b = 60 + (inc-21)*4 + 1; INCOME_TRACK[b] = inc; INCOME_TRACK[b+1] = inc; INCOME_TRACK[b+2] = inc; INCOME_TRACK[b+3] = inc; }
INCOME_TRACK[97] = 30; INCOME_TRACK[98] = 30; INCOME_TRACK[99] = 30;

// Deep copy of default positions for reset
const BOARD_DEFAULTS = {
  locations: Object.fromEntries(Object.entries(BOARD.locations).map(([k, v]) => [k, { x: v.x, y: v.y }])),
  nonBuildable: Object.fromEntries(Object.entries(BOARD.nonBuildable).map(([k, v]) => [k, { x: v.x, y: v.y }])),
  externalPorts: {} // merged into nonBuildable now
};
