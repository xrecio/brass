// Brass: Lancashire card deck — 66 cards total
// From the physical game

const locationCards = [
  // Barrow-in-Furness x2
  { id: 'barrow_1', type: 'location', location: 'barrow' },
  { id: 'barrow_2', type: 'location', location: 'barrow' },
  // Birkenhead x2
  { id: 'birkenhead_1', type: 'location', location: 'birkenhead' },
  { id: 'birkenhead_2', type: 'location', location: 'birkenhead' },
  // Blackburn x2
  { id: 'blackburn_1', type: 'location', location: 'blackburn' },
  { id: 'blackburn_2', type: 'location', location: 'blackburn' },
  // Bolton x2
  { id: 'bolton_1', type: 'location', location: 'bolton' },
  { id: 'bolton_2', type: 'location', location: 'bolton' },
  // Burnley x2
  { id: 'burnley_1', type: 'location', location: 'burnley' },
  { id: 'burnley_2', type: 'location', location: 'burnley' },
  // Bury x1
  { id: 'bury_1', type: 'location', location: 'bury' },
  // Colne x2
  { id: 'colne_1', type: 'location', location: 'colne' },
  { id: 'colne_2', type: 'location', location: 'colne' },
  // Ellesmere Port x1
  { id: 'ellesmerePort_1', type: 'location', location: 'ellesmerePort' },
  // Fleetwood x1
  { id: 'fleetwood_1', type: 'location', location: 'fleetwood' },
  // Lancaster x3
  { id: 'lancaster_1', type: 'location', location: 'lancaster' },
  { id: 'lancaster_2', type: 'location', location: 'lancaster' },
  { id: 'lancaster_3', type: 'location', location: 'lancaster' },
  // Liverpool x4
  { id: 'liverpool_1', type: 'location', location: 'liverpool' },
  { id: 'liverpool_2', type: 'location', location: 'liverpool' },
  { id: 'liverpool_3', type: 'location', location: 'liverpool' },
  { id: 'liverpool_4', type: 'location', location: 'liverpool' },
  // Macclesfield x2
  { id: 'macclesfield_1', type: 'location', location: 'macclesfield' },
  { id: 'macclesfield_2', type: 'location', location: 'macclesfield' },
  // Manchester x4
  { id: 'manchester_1', type: 'location', location: 'manchester' },
  { id: 'manchester_2', type: 'location', location: 'manchester' },
  { id: 'manchester_3', type: 'location', location: 'manchester' },
  { id: 'manchester_4', type: 'location', location: 'manchester' },
  // Oldham x2
  { id: 'oldham_1', type: 'location', location: 'oldham' },
  { id: 'oldham_2', type: 'location', location: 'oldham' },
  // Preston x3
  { id: 'preston_1', type: 'location', location: 'preston' },
  { id: 'preston_2', type: 'location', location: 'preston' },
  { id: 'preston_3', type: 'location', location: 'preston' },
  // Rochdale x2
  { id: 'rochdale_1', type: 'location', location: 'rochdale' },
  { id: 'rochdale_2', type: 'location', location: 'rochdale' },
  // Stockport x2
  { id: 'stockport_1', type: 'location', location: 'stockport' },
  { id: 'stockport_2', type: 'location', location: 'stockport' },
  // Warrington & Runcorn x2
  { id: 'warrington_1', type: 'location', location: 'warrington' },
  { id: 'warrington_2', type: 'location', location: 'warrington' },
  // Wigan x2
  { id: 'wigan_1', type: 'location', location: 'wigan' },
  { id: 'wigan_2', type: 'location', location: 'wigan' }
];

const industryCards = [
  // Cotton Mill x8
  { id: 'cotton_1', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_2', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_3', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_4', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_5', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_6', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_7', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_8', type: 'industry', industry: 'cottonMill' },
  // Coal Mine x5
  { id: 'coal_1', type: 'industry', industry: 'coalMine' },
  { id: 'coal_2', type: 'industry', industry: 'coalMine' },
  { id: 'coal_3', type: 'industry', industry: 'coalMine' },
  { id: 'coal_4', type: 'industry', industry: 'coalMine' },
  { id: 'coal_5', type: 'industry', industry: 'coalMine' },
  // Iron Works x3
  { id: 'iron_1', type: 'industry', industry: 'ironWorks' },
  { id: 'iron_2', type: 'industry', industry: 'ironWorks' },
  { id: 'iron_3', type: 'industry', industry: 'ironWorks' },
  // Port x6
  { id: 'port_1', type: 'industry', industry: 'port' },
  { id: 'port_2', type: 'industry', industry: 'port' },
  { id: 'port_3', type: 'industry', industry: 'port' },
  { id: 'port_4', type: 'industry', industry: 'port' },
  { id: 'port_5', type: 'industry', industry: 'port' },
  { id: 'port_6', type: 'industry', industry: 'port' },
  // Shipyard x3
  { id: 'shipyard_1', type: 'industry', industry: 'shipyard' },
  { id: 'shipyard_2', type: 'industry', industry: 'shipyard' },
  { id: 'shipyard_3', type: 'industry', industry: 'shipyard' }
];

// Cards to remove from deck per player count per era
const cardsToRemove = {
  3: { canal: 9, rail: 6 },
  4: { canal: 6, rail: 2 }
};

function buildDeck() {
  return [...locationCards, ...industryCards];
}

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { locationCards, industryCards, cardsToRemove, buildDeck, shuffle };
