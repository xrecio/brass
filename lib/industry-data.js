// Brass: Lancashire industry tile definitions
// Each industry type has tech levels with costs, resources, income, and VP

const industries = {
  cottonMill: {
    name: 'Cotton Mill',
    color: '#e8e8e8',
    icon: '🏭',
    levels: {
      1: { cost: 12, coalCost: 0, ironCost: 0, incomeGain: 5, vp: 5, canBuildCanal: true, canBuildRail: false },
      2: { cost: 14, coalCost: 1, ironCost: 0, incomeGain: 5, vp: 5, canBuildCanal: true, canBuildRail: true },
      3: { cost: 16, coalCost: 1, ironCost: 1, incomeGain: 4, vp: 9, canBuildCanal: true, canBuildRail: true },
      4: { cost: 18, coalCost: 1, ironCost: 1, incomeGain: 3, vp: 12, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'sell',
    count: { 3: [1, 2, 3, 4], 4: [1, 2, 3, 4] } // tech levels available per player count
  },
  coalMine: {
    name: 'Coal Mine',
    color: '#4a4a4a',
    icon: '⛏️',
    levels: {
      1: { cost: 5, coalCost: 0, ironCost: 0, incomeGain: 4, vp: 1, resources: 2, canBuildCanal: true, canBuildRail: false },
      2: { cost: 7, coalCost: 0, ironCost: 0, incomeGain: 7, vp: 2, resources: 3, canBuildCanal: true, canBuildRail: true },
      3: { cost: 8, coalCost: 0, ironCost: 1, incomeGain: 6, vp: 3, resources: 4, canBuildCanal: true, canBuildRail: true },
      4: { cost: 10, coalCost: 0, ironCost: 1, incomeGain: 5, vp: 4, resources: 5, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'empty',
    count: { 3: [1, 2, 3, 4], 4: [1, 2, 3, 4] }
  },
  ironWorks: {
    name: 'Iron Works',
    color: '#d4740e',
    icon: '🔨',
    levels: {
      1: { cost: 5, coalCost: 1, ironCost: 0, incomeGain: 3, vp: 3, resources: 4, canBuildCanal: true, canBuildRail: false },
      2: { cost: 7, coalCost: 1, ironCost: 0, incomeGain: 3, vp: 5, resources: 4, canBuildCanal: true, canBuildRail: true },
      3: { cost: 9, coalCost: 1, ironCost: 0, incomeGain: 2, vp: 7, resources: 5, canBuildCanal: true, canBuildRail: true },
      4: { cost: 12, coalCost: 1, ironCost: 0, incomeGain: 1, vp: 9, resources: 6, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'empty',
    count: { 3: [1, 2, 3, 4], 4: [1, 2, 3, 4] }
  },
  port: {
    name: 'Port',
    color: '#2196F3',
    icon: '⚓',
    levels: {
      1: { cost: 9, coalCost: 0, ironCost: 0, incomeGain: 3, vp: 2, canBuildCanal: true, canBuildRail: false },
      2: { cost: 12, coalCost: 0, ironCost: 0, incomeGain: 3, vp: 4, canBuildCanal: true, canBuildRail: true }
    },
    flipCondition: 'sell',
    count: { 3: [1, 2], 4: [1, 2] }
  },
  shipyard: {
    name: 'Shipyard',
    color: '#9C27B0',
    icon: '🚢',
    levels: {
      0: { cost: 0, coalCost: 0, ironCost: 0, incomeGain: 0, vp: 0, canBuildCanal: false, canBuildRail: false }, // must develop through
      1: { cost: 16, coalCost: 1, ironCost: 1, incomeGain: 2, vp: 10, canBuildCanal: true, canBuildRail: false },
      2: { cost: 25, coalCost: 1, ironCost: 1, incomeGain: 1, vp: 18, canBuildCanal: false, canBuildRail: true }
    },
    flipCondition: 'immediate',
    count: { 3: [0, 1, 2], 4: [0, 1, 2] }
  }
};

// Player colors
const playerColors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12']; // red, blue, green, yellow
const playerColorNames = ['Red', 'Blue', 'Green', 'Yellow'];

module.exports = { industries, playerColors, playerColorNames };
