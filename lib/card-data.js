// Brass: Lancashire card deck
// Location cards let you build at that location
// Industry cards let you build that industry type anywhere in your network

const locationCards = [
  // Each location has cards equal to its number of industry slots
  { id: 'lancaster_1', type: 'location', location: 'lancaster' },
  { id: 'lancaster_2', type: 'location', location: 'lancaster' },
  { id: 'barrow_1', type: 'location', location: 'barrow' },
  { id: 'barrow_2', type: 'location', location: 'barrow' },
  { id: 'fleetwood_1', type: 'location', location: 'fleetwood' },
  { id: 'preston_1', type: 'location', location: 'preston' },
  { id: 'preston_2', type: 'location', location: 'preston' },
  { id: 'blackburn_1', type: 'location', location: 'blackburn' },
  { id: 'blackburn_2', type: 'location', location: 'blackburn' },
  { id: 'burnley_1', type: 'location', location: 'burnley' },
  { id: 'burnley_2', type: 'location', location: 'burnley' },
  { id: 'colne_1', type: 'location', location: 'colne' },
  { id: 'colne_2', type: 'location', location: 'colne' },
  { id: 'wigan_1', type: 'location', location: 'wigan' },
  { id: 'wigan_2', type: 'location', location: 'wigan' },
  { id: 'bolton_1', type: 'location', location: 'bolton' },
  { id: 'bolton_2', type: 'location', location: 'bolton' },
  { id: 'bolton_3', type: 'location', location: 'bolton' },
  { id: 'bury_1', type: 'location', location: 'bury' },
  { id: 'bury_2', type: 'location', location: 'bury' },
  { id: 'rochdale_1', type: 'location', location: 'rochdale' },
  { id: 'rochdale_2', type: 'location', location: 'rochdale' },
  { id: 'oldham_1', type: 'location', location: 'oldham' },
  { id: 'oldham_2', type: 'location', location: 'oldham' },
  { id: 'manchester_1', type: 'location', location: 'manchester' },
  { id: 'manchester_2', type: 'location', location: 'manchester' },
  { id: 'manchester_3', type: 'location', location: 'manchester' },
  { id: 'manchester_4', type: 'location', location: 'manchester' },
  { id: 'stockport_1', type: 'location', location: 'stockport' },
  { id: 'stockport_2', type: 'location', location: 'stockport' },
  { id: 'liverpool_1', type: 'location', location: 'liverpool' },
  { id: 'liverpool_2', type: 'location', location: 'liverpool' },
  { id: 'liverpool_3', type: 'location', location: 'liverpool' },
  { id: 'birkenhead_1', type: 'location', location: 'birkenhead' },
  { id: 'warrington_1', type: 'location', location: 'warrington' },
  { id: 'warrington_2', type: 'location', location: 'warrington' },
  { id: 'northwich_1', type: 'location', location: 'northwich' },
  { id: 'northwich_2', type: 'location', location: 'northwich' },
  { id: 'ellesmerePort_1', type: 'location', location: 'ellesmerePort' },
  { id: 'ellesmerePort_2', type: 'location', location: 'ellesmerePort' }
];

const industryCards = [
  { id: 'cotton_1', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_2', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_3', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_4', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_5', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_6', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_7', type: 'industry', industry: 'cottonMill' },
  { id: 'cotton_8', type: 'industry', industry: 'cottonMill' },
  { id: 'coal_1', type: 'industry', industry: 'coalMine' },
  { id: 'coal_2', type: 'industry', industry: 'coalMine' },
  { id: 'iron_1', type: 'industry', industry: 'ironWorks' },
  { id: 'iron_2', type: 'industry', industry: 'ironWorks' },
  { id: 'port_1', type: 'industry', industry: 'port' },
  { id: 'port_2', type: 'industry', industry: 'port' },
  { id: 'shipyard_1', type: 'industry', industry: 'shipyard' },
  { id: 'shipyard_2', type: 'industry', industry: 'shipyard' }
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
