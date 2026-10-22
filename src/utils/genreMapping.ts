// Manual mapping from RAWG genre slug -> array of RAWG tag slugs
// This mapping improves which tags are suggested as "Untergenres" for each genre.
// It's editable — add or remove tag slugs based on what your RAWG /tags response contains.

const genreToTags: Record<string, string[]> = {
  action: ['action', 'hack-and-slash', 'souls-like', 'arcade', 'fighting'],
  adventure: ['adventure', 'walking-simulator', 'detective', 'visual-novel'],
  rpg: ['role-playing-games-rpg', 'turn-based', 'character-customization', 'party-based-rpg'],
  strategy: ['strategy', 'turn-based', 'real-time-strategy', '4x'],
  shooter: ['shooter', 'first-person-shooter', 'tps', 'arena-shooter'],
  puzzle: ['puzzle', 'logic', 'physics'],
  racing: ['racing', 'driving', 'kart'],
  sports: ['sports', 'football', 'basketball'],
  simulation: ['simulation', 'life-sim', 'flight', 'driving-sim'],
  platformer: ['platformer', '2d-platformer', 'metroidvania'],
  indie: ['indie', 'pixel-graphics', 'short'],
  horror: ['horror', 'survival', 'psychological-horror'],
  casual: ['casual', 'minigames'],
  mmorpg: ['mmorpg', 'multiplayer'],
  // add more mappings as needed
};

export default genreToTags;
