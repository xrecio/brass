// Brass: Lancashire board topology
// Corrected from the official game board

// ============ BUILDABLE LOCATIONS ============
const locations = {
  lancaster: {
    name: 'Lancaster',
    slots: [
      { allowed: ['port'] },
      { allowed: ['cottonMill', 'port'] }
    ],
    x: 248, y: 58
  },
  barrow: {
    name: 'Barrow-in-Furness',
    slots: [
      { allowed: ['port'] },
      { allowed: ['shipyard'] }
    ],
    x: 108, y: 38
  },
  fleetwood: {
    name: 'Fleetwood',
    slots: [
      { allowed: ['port'] }
    ],
    x: 138, y: 85
  },
  preston: {
    name: 'Preston',
    slots: [
      { allowed: ['port'] },
      { allowed: ['cottonMill', 'port'] },
      { allowed: ['ironWorks'] }
    ],
    x: 228, y: 145
  },
  blackburn: {
    name: 'Blackburn',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 345, y: 142
  },
  burnley: {
    name: 'Burnley',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 430, y: 100
  },
  colne: {
    name: 'Colne',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 518, y: 70
  },
  wigan: {
    name: 'Wigan',
    slots: [
      { allowed: ['coalMine'] },
      { allowed: ['coalMine'] }
    ],
    x: 195, y: 252
  },
  bolton: {
    name: 'Bolton',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 325, y: 235
  },
  bury: {
    name: 'Bury',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 415, y: 215
  },
  rochdale: {
    name: 'Rochdale',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 505, y: 198
  },
  oldham: {
    name: 'Oldham',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] }
    ],
    x: 515, y: 278
  },
  manchester: {
    name: 'Manchester',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['ironWorks'] }
    ],
    x: 400, y: 335
  },
  stockport: {
    name: 'Stockport',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 475, y: 405
  },
  macclesfield: {
    name: 'Macclesfield',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 425, y: 460
  },
  liverpool: {
    name: 'Liverpool',
    slots: [
      { allowed: ['port'] },
      { allowed: ['port'] },
      { allowed: ['port'] },
      { allowed: ['shipyard'] }
    ],
    x: 65, y: 315
  },
  birkenhead: {
    name: 'Birkenhead',
    slots: [
      { allowed: ['shipyard'] }
    ],
    x: 48, y: 405
  },
  warrington: {
    name: 'Warrington & Runcorn',
    slots: [
      { allowed: ['cottonMill', 'coalMine'] },
      { allowed: ['port'] }
    ],
    x: 235, y: 378
  },
  ellesmerePort: {
    name: 'Ellesmere Port',
    slots: [
      { allowed: ['port'] }
    ],
    x: 145, y: 445
  }
};

// ============ NON-BUILDABLE LOCATIONS ============
// No industry slots. Links to/from these cost double (2 segments).
const nonBuildable = {
  northwich:    { name: 'Northwich',     x: 310, y: 455 },
  blackpool:    { name: 'Blackpool',     x: 118, y: 132 },
  southport:    { name: 'Southport',     x: 75,  y: 228 },
  scotland:     { name: 'Scotland',      x: 100, y: 8,   isExternalPort: true },
  yorkshire:    { name: 'Yorkshire',     x: 570, y: 115, isExternalPort: true },
  theMidlands:  { name: 'The Midlands',  x: 360, y: 500, isExternalPort: true }
};

// External port location IDs (for isConnectedToPort checks)
const externalPortIds = ['scotland', 'yorkshire', 'theMidlands'];

// ============ LINKS ============
const links = [
  // Northern
  { id: 'barrow-lancaster', from: 'barrow', to: 'lancaster', canal: false, rail: true, segments: 1 },
  { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true, segments: 1 },
  { id: 'lancaster-scotland', from: 'lancaster', to: 'scotland', canal: false, rail: true, segments: 2 },
  { id: 'preston-fleetwood', from: 'preston', to: 'fleetwood', canal: true, rail: true, segments: 1 },

  // Central upper
  { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: false, rail: true, segments: 1 },
  { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true, segments: 1 },
  { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true, segments: 1 },
  { id: 'blackburn-wigan', from: 'blackburn', to: 'wigan', canal: true, rail: true, segments: 1 },
  { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true, segments: 1 },
  { id: 'colne-yorkshire', from: 'colne', to: 'yorkshire', canal: true, rail: true, segments: 2 },
  { id: 'rochdale-yorkshire', from: 'rochdale', to: 'yorkshire', canal: true, rail: true, segments: 2 },

  // Central
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

  // Southern
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
];

// Distant cotton market
// 11 demand tiles, shuffled at start of each era
// When selling to distant market, flip a tile: value is how much demand drops
// 0 = no drop (lucky), -1 to -4 = demand drops by that amount
const distantMarketTileValues = [0, 0, -1, -2, -2, -2, -2, -3, -3, -3, -4];

// Demand track: starts at 8, marker moves down as tiles are flipped
const DISTANT_MARKET_START = 8;

// Coal & Iron markets: 8 slots each, 30 total cubes each
// Slots numbered 8 (full) down to 1 (nearly empty), 0 = empty
// Price to buy from market depends on which slot the cube is in
// Slots: [1£, 1£, 2£, 2£, 3£, 3£, 4£, 4£] — cheapest slots fill first
// When selling TO market, cubes fill cheapest slots first (and you get paid that price)
// When buying FROM market, you pay the price of the slot being emptied (most expensive first)
const MARKET_SLOTS = 8;
const MARKET_TOTAL_CUBES = 30; // total in game per resource type

// Price for buying the Nth cube from market (cubes remaining → price)
// 8 cubes = slot 8 costs 1, slot 7 costs 1, slot 6 costs 2, ...
const marketSlotPrices = [1, 1, 2, 2, 3, 3, 4, 4]; // index 0=cheapest slot, 7=most expensive

function getMarketBuyPrice(cubesInMarket) {
  if (cubesInMarket <= 0) return 5; // empty market, buy from bank
  // Buying removes from the most expensive filled slot
  return marketSlotPrices[cubesInMarket - 1];
}

function getMarketSellPrice(cubesInMarket) {
  if (cubesInMarket >= MARKET_SLOTS) return 0; // market full, can't sell
  // Selling fills the cheapest empty slot
  return marketSlotPrices[cubesInMarket];
}

// Legacy compat: price lookup by cubes remaining (for game engine)
const coalMarketPrices = {};
const ironMarketPrices = {};
for (let i = 0; i <= MARKET_SLOTS; i++) {
  coalMarketPrices[i] = getMarketBuyPrice(i);
  ironMarketPrices[i] = getMarketBuyPrice(i);
}

// Income track: 100 squares (0-99) mapping to actual income per round
// 0-9: -10 to -1 (one per square)
// 10: 0 (starting position)
// 11-30: income 1-10 (2 squares each)
// 31-60: income 11-20 (3 squares each)
// 61-96: income 21-29 (4 squares each)
// 97-99: income 30
const incomeTrack = [];
for (let i = 0; i <= 9; i++) incomeTrack[i] = -10 + i;
incomeTrack[10] = 0;
for (let inc = 1; inc <= 10; inc++) { const b = 10 + (inc-1)*2 + 1; incomeTrack[b] = inc; incomeTrack[b+1] = inc; }
for (let inc = 11; inc <= 20; inc++) { const b = 30 + (inc-11)*3 + 1; incomeTrack[b] = inc; incomeTrack[b+1] = inc; incomeTrack[b+2] = inc; }
for (let inc = 21; inc <= 29; inc++) { const b = 60 + (inc-21)*4 + 1; incomeTrack[b] = inc; incomeTrack[b+1] = inc; incomeTrack[b+2] = inc; incomeTrack[b+3] = inc; }
incomeTrack[97] = 30; incomeTrack[98] = 30; incomeTrack[99] = 30;

const incomeBands = [
  { min: -10, max: -6, levels: 5 },
  { min: -5, max: -1, levels: 5 },
  { min: 0, max: 0, levels: 1 },
  { min: 1, max: 5, levels: 5 },
  { min: 6, max: 10, levels: 5 },
  { min: 11, max: 20, levels: 10 },
  { min: 21, max: 30, levels: 10 },
  { min: 31, max: 40, levels: 10 }
];

module.exports = {
  locations,
  nonBuildable,
  externalPortIds,
  links,
  distantMarketTileValues,
  DISTANT_MARKET_START,
  MARKET_SLOTS,
  MARKET_TOTAL_CUBES,
  marketSlotPrices,
  getMarketBuyPrice,
  getMarketSellPrice,
  coalMarketPrices,
  ironMarketPrices,
  incomeTrack,
  incomeBands
};
