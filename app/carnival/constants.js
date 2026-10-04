// Shared by the storefront server code and the admin page (no server-only imports here).
export const GAME_NAMES = {
  1: "Charmacy Claw",
  2: "Spin the Glam Wheel",
  3: "Catch My Charmacy",
  4: "Pick the Right Shade",
  5: "Mirror Match",
  6: "Tap the Sparkle",
  7: "Birthday Balloon Pop",
  8: "Scratch & Win",
  9: "Beauty Word Puzzle",
};

// Luck games use "win chance" as the chance a play wins. Skill games (3,4,5,6,9) reward a successful
// player with a prize unless the chance is lowered, so their default is 100%.
export const SKILL_GAMES = [3, 4, 5, 6, 9];
export const DEFAULT_CHANCE = { 1: 35, 2: 30, 3: 100, 4: 100, 5: 100, 6: 100, 7: 30, 8: 40, 9: 100 };

