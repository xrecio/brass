// Scoring for Canal and Rail eras
const { locations, links } = require('./board-data');
const { industries } = require('./industry-data');

function scoreCanalEra(state) {
  state.log.push({ msg: '=== Canal Era Scoring ===' });

  // Score flipped industry tiles
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.flipped && slot.owner !== null) {
        const tileData = industries[slot.industryType]?.levels[slot.level];
        if (tileData) {
          state.players[slot.owner].vp += tileData.vp;
        }
      }
    }
  }

  // Score canal links
  for (const link of Object.values(state.board.links)) {
    if (link.type === 'canal' && link.owner !== null) {
      const vpFrom = countLocationVP(state, link.from);
      const vpTo = countLocationVP(state, link.to);
      const linkVP = vpFrom + vpTo;
      state.players[link.owner].vp += linkVP;
      if (linkVP > 0) {
        state.log.push({
          msg: `${state.players[link.owner].username} scores ${linkVP} VP from canal ${locations[link.from].name}-${locations[link.to].name}`
        });
      }
    }
  }

  for (const player of state.players) {
    state.log.push({ msg: `${player.username}: ${player.vp} VP` });
  }
}

function scoreRailEra(state) {
  state.log.push({ msg: '=== Rail Era Scoring ===' });

  // Score flipped industry tiles
  for (const [locId, loc] of Object.entries(state.board.locations)) {
    for (const slot of loc.slots) {
      if (slot.flipped && slot.owner !== null) {
        const tileData = industries[slot.industryType]?.levels[slot.level];
        if (tileData) {
          state.players[slot.owner].vp += tileData.vp;
        }
      }
    }
  }

  // Score rail links
  for (const link of Object.values(state.board.links)) {
    if (link.type === 'rail' && link.owner !== null) {
      const vpFrom = countLocationVP(state, link.from);
      const vpTo = countLocationVP(state, link.to);
      const linkVP = vpFrom + vpTo;
      state.players[link.owner].vp += linkVP;
      if (linkVP > 0) {
        state.log.push({
          msg: `${state.players[link.owner].username} scores ${linkVP} VP from rail ${locations[link.from].name}-${locations[link.to].name}`
        });
      }
    }
  }

  for (const player of state.players) {
    state.log.push({ msg: `${player.username}: ${player.vp} VP` });
  }
}

function countLocationVP(state, locId) {
  const loc = state.board.locations[locId];
  if (!loc) return 0;
  let vp = 0;
  for (const slot of loc.slots) {
    if (slot.flipped && slot.owner !== null) {
      // Each flipped tile contributes 1 VP icon for link scoring
      vp += 1;
    }
  }
  return vp;
}

module.exports = { scoreCanalEra, scoreRailEra };
