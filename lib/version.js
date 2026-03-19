// App version and game state compatibility
// Bump GAME_STATE_VERSION when game state structure changes in a breaking way
// Bump APP_VERSION for any release

const APP_VERSION = '0.0.76';
const GAME_STATE_VERSION = 2;

// Minimum game state version that is still playable with current code
const MIN_COMPATIBLE_VERSION = 2;

function isCompatible(gameStateVersion) {
  return gameStateVersion >= MIN_COMPATIBLE_VERSION && gameStateVersion <= GAME_STATE_VERSION;
}

module.exports = { APP_VERSION, GAME_STATE_VERSION, MIN_COMPATIBLE_VERSION, isCompatible };
