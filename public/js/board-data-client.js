// Client-side board data for SVG rendering
// Matches server-side board-data.js - corrected from official game board
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
    liverpool:      { name: 'Liverpool',            x: 65,  y: 315 },
    birkenhead:     { name: 'Birkenhead',           x: 48,  y: 405 },
    warrington:     { name: 'Warrington & Runcorn', x: 235, y: 378 },
    ellesmerePort:  { name: 'Ellesmere Port',       x: 145, y: 445 }
  },

  // Non-buildable waypoints (links through these cost double)
  nonBuildable: {
    northwich:  { name: 'Northwich',  x: 310, y: 455 },
    blackpool:  { name: 'Blackpool',  x: 118, y: 132 },
    southport:  { name: 'Southport',  x: 75,  y: 228 }
  },

  // External ports (permanent, always accessible for selling cotton)
  externalPorts: {
    scotland:     { name: 'Scotland',     connectedTo: ['lancaster'],                   x: 100, y: 8 },
    yorkshire:    { name: 'Yorkshire',    connectedTo: ['colne', 'burnley', 'rochdale'], x: 570, y: 115 },
    theMidlands:  { name: 'The Midlands', connectedTo: ['ellesmerePort', 'stockport'],   x: 360, y: 500 }
  },

  links: [
    { id: 'barrow-lancaster', from: 'barrow', to: 'lancaster', canal: false, rail: true, segments: 1 },
    { id: 'lancaster-fleetwood', from: 'lancaster', to: 'fleetwood', canal: true, rail: true, segments: 1 },
    { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true, segments: 1 },
    { id: 'fleetwood-preston', from: 'fleetwood', to: 'preston', canal: true, rail: true, segments: 2, through: 'blackpool' },
    { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: true, rail: true, segments: 1 },
    { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true, segments: 1 },
    { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true, segments: 1 },
    { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true, segments: 1 },
    { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true, segments: 1 },
    { id: 'wigan-bolton', from: 'wigan', to: 'bolton', canal: true, rail: true, segments: 1 },
    { id: 'wigan-liverpool', from: 'wigan', to: 'liverpool', canal: true, rail: true, segments: 2, through: 'southport' },
    { id: 'bolton-bury', from: 'bolton', to: 'bury', canal: true, rail: true, segments: 1 },
    { id: 'bolton-manchester', from: 'bolton', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'bury-manchester', from: 'bury', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'bury-rochdale', from: 'bury', to: 'rochdale', canal: false, rail: true, segments: 1 },
    { id: 'rochdale-oldham', from: 'rochdale', to: 'oldham', canal: true, rail: true, segments: 1 },
    { id: 'oldham-manchester', from: 'oldham', to: 'manchester', canal: true, rail: true, segments: 1 },
    { id: 'manchester-stockport', from: 'manchester', to: 'stockport', canal: true, rail: true, segments: 1 },
    { id: 'manchester-warrington', from: 'manchester', to: 'warrington', canal: true, rail: true, segments: 1 },
    { id: 'liverpool-warrington', from: 'liverpool', to: 'warrington', canal: true, rail: true, segments: 1 },
    { id: 'liverpool-birkenhead', from: 'liverpool', to: 'birkenhead', canal: false, rail: true, segments: 1 },
    { id: 'liverpool-ellesmerePort', from: 'liverpool', to: 'ellesmerePort', canal: true, rail: true, segments: 1 },
    { id: 'warrington-ellesmerePort', from: 'warrington', to: 'ellesmerePort', canal: true, rail: true, segments: 2, through: 'northwich' }
  ],

  playerColors: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12'],
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

// Deep copy of default positions for reset
const BOARD_DEFAULTS = {
  locations: Object.fromEntries(Object.entries(BOARD.locations).map(([k, v]) => [k, { x: v.x, y: v.y }])),
  nonBuildable: Object.fromEntries(Object.entries(BOARD.nonBuildable).map(([k, v]) => [k, { x: v.x, y: v.y }])),
  externalPorts: Object.fromEntries(Object.entries(BOARD.externalPorts).map(([k, v]) => [k, { x: v.x, y: v.y }]))
};
