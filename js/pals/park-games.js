// Pal Park Game Hub: the booths in the park's arcade corner. Each booth is a glowing portal that opens a mini-game.
// To plug a game in, add an entry here, or call registerParkGame({ id, name, emoji, href, color }) before the park opens
// (e.g. from your game's module). Up to 8 booths; empty slots show "Coming soon".
export const PARK_GAMES = [
  { id: 'race', name: 'Pal Race', emoji: '🏁', href: '#/games/pals?g=race', color: '#4f8dff' },
  { id: 'bubbles', name: 'Bubble Pop', emoji: '🫧', href: '#/games/pals?g=bubbles', color: '#38bdf8' },
  { id: 'stars', name: 'Star Catch', emoji: '⭐', href: '#/games/pals?g=stars', color: '#f59e0b' },
  { id: 'dance', name: 'Dance-Off', emoji: '💃', href: '#/games/pals?g=dance', color: '#ec4899' },
];
export function registerParkGame(g) { if (!g || !g.id || !g.href) return; const i = PARK_GAMES.findIndex((x) => x.id === g.id); if (i >= 0) PARK_GAMES[i] = { ...PARK_GAMES[i], ...g }; else PARK_GAMES.push({ color: '#b26bff', emoji: '🎮', ...g }); dispatchEvent(new CustomEvent('kemy:park-games')); }
export const parkGames = () => PARK_GAMES.slice(0, 8);
export const HUB_SLOTS = 6;
