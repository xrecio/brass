// Brass: Lancashire board topology
// Locations, industry slots, links, and external markets
// Coordinates are for SVG rendering (approximate board layout)

const locations = {
  lancaster: {
    name: 'Lancaster',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 240, y: 55
  },
  barrow: {
    name: 'Barrow-in-Furness',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['shipyard'] }
    ],
    x: 105, y: 35
  },
  fleetwood: {
    name: 'Fleetwood',
    slots: [
      { allowed: ['port'] }
    ],
    x: 140, y: 80
  },
  preston: {
    name: 'Preston',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] },
      { allowed: ['port'] }
    ],
    x: 225, y: 140
  },
  blackburn: {
    name: 'Blackburn',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 340, y: 140
  },
  burnley: {
    name: 'Burnley',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['coalMine'] }
    ],
    x: 420, y: 95
  },
  colne: {
    name: 'Colne',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['coalMine'] }
    ],
    x: 510, y: 65
  },
  wigan: {
    name: 'Wigan',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['coalMine'] }
    ],
    x: 200, y: 250
  },
  bolton: {
    name: 'Bolton',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] },
      { allowed: ['ironWorks'] }
    ],
    x: 320, y: 230
  },
  bury: {
    name: 'Bury',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 410, y: 210
  },
  rochdale: {
    name: 'Rochdale',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 500, y: 200
  },
  oldham: {
    name: 'Oldham',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 510, y: 275
  },
  manchester: {
    name: 'Manchester',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 400, y: 330
  },
  stockport: {
    name: 'Stockport',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['cottonMill'] }
    ],
    x: 470, y: 400
  },
  liverpool: {
    name: 'Liverpool',
    slots: [
      { allowed: ['port'] },
      { allowed: ['port'] },
      { allowed: ['port'] }
    ],
    x: 70, y: 310
  },
  birkenhead: {
    name: 'Birkenhead',
    slots: [
      { allowed: ['shipyard'] }
    ],
    x: 50, y: 400
  },
  warrington: {
    name: 'Warrington',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['ironWorks'] }
    ],
    x: 210, y: 370
  },
  northwich: {
    name: 'Northwich',
    slots: [
      { allowed: ['cottonMill'] },
      { allowed: ['ironWorks'] }
    ],
    x: 280, y: 440
  },
  ellesmerePort: {
    name: 'Ellesmere Port',
    slots: [
      { allowed: ['port'] },
      { allowed: ['port'] }
    ],
    x: 140, y: 440
  }
};

// Links between locations. canal=true means available in canal era, rail=true in rail era
const links = [
  { id: 'lancaster-preston', from: 'lancaster', to: 'preston', canal: true, rail: true },
  { id: 'lancaster-barrow', from: 'lancaster', to: 'barrow', canal: false, rail: true },
  { id: 'lancaster-fleetwood', from: 'lancaster', to: 'fleetwood', canal: true, rail: false },
  { id: 'fleetwood-preston', from: 'fleetwood', to: 'preston', canal: true, rail: true },
  { id: 'preston-blackburn', from: 'preston', to: 'blackburn', canal: true, rail: true },
  { id: 'preston-wigan', from: 'preston', to: 'wigan', canal: true, rail: true },
  { id: 'blackburn-burnley', from: 'blackburn', to: 'burnley', canal: true, rail: true },
  { id: 'blackburn-bolton', from: 'blackburn', to: 'bolton', canal: false, rail: true },
  { id: 'burnley-colne', from: 'burnley', to: 'colne', canal: true, rail: true },
  { id: 'wigan-bolton', from: 'wigan', to: 'bolton', canal: true, rail: true },
  { id: 'wigan-liverpool', from: 'wigan', to: 'liverpool', canal: true, rail: true },
  { id: 'bolton-bury', from: 'bolton', to: 'bury', canal: true, rail: true },
  { id: 'bolton-manchester', from: 'bolton', to: 'manchester', canal: true, rail: true },
  { id: 'bury-manchester', from: 'bury', to: 'manchester', canal: true, rail: true },
  { id: 'bury-rochdale', from: 'bury', to: 'rochdale', canal: false, rail: true },
  { id: 'rochdale-oldham', from: 'rochdale', to: 'oldham', canal: true, rail: true },
  { id: 'oldham-manchester', from: 'oldham', to: 'manchester', canal: true, rail: true },
  { id: 'manchester-stockport', from: 'manchester', to: 'stockport', canal: true, rail: true },
  { id: 'manchester-warrington', from: 'manchester', to: 'warrington', canal: true, rail: true },
  { id: 'liverpool-warrington', from: 'liverpool', to: 'warrington', canal: true, rail: true },
  { id: 'liverpool-birkenhead', from: 'liverpool', to: 'birkenhead', canal: false, rail: true },
  { id: 'warrington-northwich', from: 'warrington', to: 'northwich', canal: true, rail: true },
  { id: 'northwich-ellesmerePort', from: 'northwich', to: 'ellesmerePort', canal: true, rail: true },
  { id: 'ellesmerePort-liverpool', from: 'ellesmerePort', to: 'liverpool', canal: true, rail: true },
  { id: 'stockport-warrington', from: 'stockport', to: 'warrington', canal: false, rail: true }
];

// External market connections (for selling cotton)
// These are printed ports on the board edge
const externalPorts = {
  shrewsbury: { name: 'Shrewsbury', connectedTo: ['ellesmerePort'], vpBonus: 0 },
  gloucester: { name: 'Gloucester', connectedTo: ['ellesmerePort'], vpBonus: 0 },
  oxford: { name: 'Oxford', connectedTo: ['birmingham'], vpBonus: 0 },
  nottingham: { name: 'Nottingham', connectedTo: ['stockport', 'manchester'], vpBonus: 0 },
  yorkshire: { name: 'Yorkshire', connectedTo: ['rochdale', 'colne', 'burnley'], vpBonus: 0 }
};

// Distant cotton market demand track
// Each position shows the demand remaining and its sell bonus
const distantMarketTrack = [
  { demand: 8, bonus: 5 },
  { demand: 7, bonus: 4 },
  { demand: 6, bonus: 3 },
  { demand: 5, bonus: 3 },
  { demand: 4, bonus: 2 },
  { demand: 3, bonus: 2 },
  { demand: 2, bonus: 1 },
  { demand: 1, bonus: 1 },
  { demand: 0, bonus: 0 }  // bottomed out
];

// Coal market price track (price based on cubes remaining)
const coalMarketPrices = {
  13: 1, 12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5  // empty - must pay 5 from bank
};

// Iron market price track
const ironMarketPrices = {
  12: 1, 11: 1, 10: 1, 9: 1, 8: 1,
  7: 2, 6: 2, 5: 2,
  4: 3, 3: 3,
  2: 4,
  1: 5,
  0: 5  // empty - must pay 5 from bank
};

// VP icons printed on the board at each location (for link scoring)
// These are the gold circles in connected locations
const locationVPIcons = {
  lancaster: 1, barrow: 1, fleetwood: 1, preston: 1,
  blackburn: 1, burnley: 1, colne: 1, wigan: 1,
  bolton: 1, bury: 1, rochdale: 1, oldham: 1,
  manchester: 1, stockport: 1, liverpool: 1, birkenhead: 1,
  warrington: 1, northwich: 1, ellesmerePort: 1
};

// Income track: maps income level to actual income received
// Levels 0-10 = negative to zero income, 11+ = positive
const incomeTrack = [
  -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, // levels 0-9
  0,   // level 10
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,           // levels 11-20
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,   // levels 21-30
  21, 22, 23, 24, 25, 26, 27, 28, 29, 30    // levels 31-40
];

// Income band sizes (for loan calculations)
// Each band is a range of income levels
const incomeBands = [
  { min: -10, max: -6, levels: 5 },  // band 1
  { min: -5, max: -1, levels: 5 },   // band 2
  { min: 0, max: 0, levels: 1 },     // band 3
  { min: 1, max: 5, levels: 5 },     // band 4
  { min: 6, max: 10, levels: 5 },    // band 5
  { min: 11, max: 20, levels: 10 },  // band 6
  { min: 21, max: 30, levels: 10 },  // band 7
  { min: 31, max: 40, levels: 10 }   // band 8
];

module.exports = {
  locations,
  links,
  externalPorts,
  distantMarketTrack,
  coalMarketPrices,
  ironMarketPrices,
  locationVPIcons,
  incomeTrack,
  incomeBands
};
