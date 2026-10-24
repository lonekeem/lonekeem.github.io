// Pal Bingo — pure rules (cards, calls, patterns). Same seed => same balls for every player.
// Written by Lone Keem.
export const PATTERN_IDS = ['line', 'corners', 'x', 'heart', 'star', 'crown', 'blackout'];
export const PATTERN_NAME = { line: 'Any line', corners: 'Four corners', x: 'Big X', heart: 'Heart', star: 'Star', crown: 'Crown', blackout: 'Blackout' };
const PIC = {
  corners: '1000100000000000000010001',
  x: '1000101010001000101010001',
  heart: '0101111111111011100010000',
  star: '0010001110111110101010001',
  crown: '1010111110011100010000000',
  blackout: '1111111111111111111111111'
};
const mask = (s) => [...s].map((c) => (c === '1' ? 1 : 0));
const LINES = (() => {
  const out = [];
  for (let r = 0; r < 5; r++) { const m = Array(25).fill(0); for (let c = 0; c < 5; c++) m[r * 5 + c] = 1; out.push(m); }
  for (let c = 0; c < 5; c++) { const m = Array(25).fill(0); for (let r = 0; r < 5; r++) m[r * 5 + c] = 1; out.push(m); }
  const d1 = Array(25).fill(0), d2 = Array(25).fill(0);
  for (let i = 0; i < 5; i++) { d1[i * 5 + i] = 1; d2[i * 5 + (4 - i)] = 1; }
  out.push(d1, d2); return out;
})();
export const masksFor = (id) => (id === 'line' ? LINES : [mask(PIC[id] || PIC.corners)]);
export const patternFor = (round) => PATTERN_IDS[((round % PATTERN_IDS.length) + PATTERN_IDS.length) % PATTERN_IDS.length];
export const luckyRound = (round) => round % 5 === 4;
export const letterOf = (n) => 'BINGO'[Math.floor((n - 1) / 15)] || '';
export const levelOf = (xp) => 1 + Math.floor(Math.max(0, xp) / 30);
export const cardSlots = (lv) => (lv >= 5 ? 4 : lv >= 3 ? 3 : lv >= 2 ? 2 : 1);

// ready: countdown before ball 1. call: gap between balls. claim: time after ball 75 to press BINGO.
// Every phone derives the same ball from the room start time, so a new interval stays in sync.
export function timing(fast) {
  return fast
    ? { ready: 0, call: 400, claim: 1600, gap: 4000 }
    : { ready: 4500, call: 5500, claim: 12000, gap: 18000 };
}
export function roundAt(startMs, now, fast) {
  const T = timing(fast);
  const play = T.ready + 74 * T.call + T.claim;
  const cycle = play + T.gap;
  const elapsed = Math.max(0, now - startMs);
  const round = Math.floor(elapsed / cycle);
  const t = elapsed - round * cycle;
  const live = t < play;
  let called = 0, count = 0;
  if (t < T.ready) {
    const leftReady = T.ready - t;
    count = leftReady <= 1000 ? 1 : leftReady <= 2000 ? 2 : leftReady <= 3000 ? 3 : 0;
  } else called = Math.min(75, 1 + Math.floor((t - T.ready) / T.call));
  const nextIn = !live || called >= 75 ? 0 : called === 0 ? T.ready - t : T.call - ((t - T.ready) % T.call);
  return { round, t, live, called, nextIn, left: live ? play - t : Math.max(0, cycle - t), phase: t < T.ready ? 'ready' : 'call', count, call: T.call, ready: T.ready, play, cycle };
}
// How long a bot waits after its card is complete before it presses BINGO. Same seed, same wait.
export function botReactMs(seed, botId, fast) {
  return (fast ? 800 : 7000) + (mix(seed, 'react-' + botId) % (fast ? 500 : 4500));
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function mix(seed, s) {
  let h = (seed >>> 0) || 1; const str = String(s);
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) || 1;
}
export const roundSeed = (roomSeed, round) => mix(roomSeed, 'r' + round);
export function ballsFor(seed) {
  const r = rng(seed), b = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = 74; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = b[i]; b[i] = b[j]; b[j] = t; }
  return b;
}
export function cardFor(seed, uid, idx) {
  const r = rng(mix(seed, uid + '#' + idx)); const card = Array(25);
  for (let col = 0; col < 5; col++) {
    const bag = []; for (let n = 1; n <= 15; n++) bag.push(col * 15 + n);
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    for (let row = 0; row < 5; row++) card[row * 5 + col] = bag[row];
  }
  card[12] = 0; return card;
}
// How many pattern squares are still missing. freeIdx marks one earned free-daub cell.
export function cardMiss(card, called, masks, freeIdx = -1) {
  let best = 99;
  for (const mask of masks) {
    let miss = 0;
    for (let i = 0; i < 25; i++) {
      if (!mask[i] || i === 12 || i === freeIdx) continue;
      if (!called.has(card[i])) miss++;
    }
    if (miss < best) best = miss;
  }
  return best;
}
export function markedWin(card, daubed, masks, freeIdx = -1) {
  for (const mask of masks) {
    let ok = true;
    for (let i = 0; i < 25; i++) {
      if (!mask[i] || i === 12 || i === freeIdx) continue;
      if (!daubed.has(card[i])) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
export function bingoCall(seed, uid, nCards, pat) {
  const balls = ballsFor(seed), masks = masksFor(pat);
  for (let c = 1; c <= balls.length; c++) {
    const set = new Set(balls.slice(0, c));
    for (let i = 0; i < nCards; i++) if (cardMiss(cardFor(seed, uid, i), set, masks) === 0) return c;
  }
  return 0;
}
// True when the called prefix already covers a pattern on one of this player's cards.
export function claimOk(seed, uid, nCards, pat, claim) {
  if (claim < 4 || claim > 75) return false;
  const set = new Set(ballsFor(seed).slice(0, claim)), masks = masksFor(pat);
  for (let i = 0; i < Math.min(4, nCards | 0); i++) if (cardMiss(cardFor(seed, uid, i), set, masks) === 0) return true;
  return false;
}
export function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`;
}
export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const BOTS = [
  { id: 'bot-pip', name: 'Pip', species: 'bunny', acc: 'bow' },
  { id: 'bot-momo', name: 'Momo', species: 'kitten', acc: 'bow' },
  { id: 'bot-nib', name: 'Nib', species: 'puppy', acc: 'scarf' },
  { id: 'bot-lulu', name: 'Lulu', species: 'panda', acc: 'hat' },
  { id: 'bot-zip', name: 'Zip', species: 'fox', acc: 'none' },
  { id: 'bot-coco', name: 'Coco', species: 'duckling', acc: 'crown' }
];
export const LUCKY_BALLS = [7, 22, 42, 55, 75];
