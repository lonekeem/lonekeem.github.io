// Ludo rules. Track of 52 squares on a 15x15 grid, 4 tokens per player, home stretch of 5,
// 56 = home. A token needs a 6 to leave the yard; landing on a lone rival token (not on a safe
// square) sends it back; a 6, a capture or bringing a token home earns another roll; three 6s in
// a row lose the turn. Dice come from commit-reveal: die = first hex digit 0-5 of
// sha256(reveals + roll index), plus one (see dieFromHex).
export const TRACK = [];
(() => {
  const seg = (r0, c0, dr, dc, n) => { for (let i = 0; i < n; i++) TRACK.push([r0 + dr * i, c0 + dc * i]); };
  seg(6, 1, 0, 1, 5); seg(5, 6, -1, 0, 6); TRACK.push([0, 7], [0, 8]);
  seg(1, 8, 1, 0, 5); seg(6, 9, 0, 1, 6); TRACK.push([7, 14], [8, 14]);
  seg(8, 13, 0, -1, 5); seg(9, 8, 1, 0, 6); TRACK.push([14, 7], [14, 6]);
  seg(13, 6, -1, 0, 5); seg(8, 5, 0, -1, 6); TRACK.push([7, 0], [6, 0]);
})();
export const START = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HOME_COL = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]], [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]];
export const YARD = [[[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]], [[1.5, 10.5], [1.5, 12.5], [3.5, 10.5], [3.5, 12.5]], [[10.5, 10.5], [10.5, 12.5], [12.5, 10.5], [12.5, 12.5]], [[10.5, 1.5], [10.5, 3.5], [12.5, 1.5], [12.5, 3.5]]];
// board corners: 0 top-left, 1 top-right, 2 bottom-right, 3 bottom-left (clockwise)
export const COLORS = ['#2fbf5b', '#ffc21a', '#2f8cf0', '#ef4646'];
export const COLOR_NAMES = ['Green', 'Gold', 'Blue', 'Red'];
export const DARK = ['#1d8a3d', '#d39a00', '#1d62b8', '#b92b2b'];
export const seatColors = (n) => (n === 2 ? [0, 2] : n === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
export const HOME = 56;

// cols: optional board corner per seat. team (4 seats only): seats 0+2 vs 1+3, partners sit opposite and win together.
export function newGame(n, cols, team) { const st = { n, cols: cols || seatColors(n), pos: Array.from({ length: n }, () => [-1, -1, -1, -1]), turn: 0, die: 0, six: 0, k: 0, winner: -1, last: null, msg: '' }; if (team && n === 4) st.team = true; return st; }
export const partnerOf = (st, p) => (st.team ? (p + 2) % 4 : -1);
export const isFoe = (st, me, p) => p !== me && p !== partnerOf(st, me);
export const done = (st, p) => st.pos[p].every((r) => r === HOME);
export const teamOf = (p) => p % 2;
// next seat to play: in team mode a seat whose tokens are all home is skipped
export function nextTurn(st, me) { for (let i = 1; i <= st.n; i++) { const p = (me + i) % st.n; if (!st.team || !done(st, p)) return p; } return me; }
export const encodePos = (pos) => pos.flat().map((v) => (v < 0 ? '--' : String(v).padStart(2, '0'))).join('');
export const decodePos = (s, n) => Array.from({ length: n }, (_, p) => [0, 1, 2, 3].map((t) => { const x = s.substr((p * 4 + t) * 2, 2); return x === '--' ? -1 : +x; }));
// absolute track square of a token (or -1 if in yard / home stretch)
export const absOf = (col, rel) => (rel >= 0 && rel <= 50 ? (START[col] + rel) % 52 : -1);
export function cellOf(col, rel, t) {
  if (rel < 0) return YARD[col][t];
  if (rel <= 50) return TRACK[absOf(col, rel)];
  if (rel < HOME) return HOME_COL[col][rel - 51];
  return [7, 7];
}
export function legal(st, die) {
  const me = st.turn, out = [];
  if (die === 6 && st.six >= 2) return out;          // third six: turn lost
  st.pos[me].forEach((r, t) => { if (r < 0 ? die === 6 : r + die <= HOME) out.push(t); });
  // identical moves (two tokens on the same square) -> keep one
  return out.filter((t, i) => out.findIndex((u) => st.pos[me][u] === st.pos[me][t]) === i || st.pos[me][t] < 0 && out.findIndex((u) => st.pos[me][u] < 0) === i);
}
function occupants(st, abs) {
  const o = [];
  st.pos.forEach((toks, p) => toks.forEach((r, t) => { if (absOf(st.cols[p], r) === abs) o.push([p, t]); }));
  return o;
}
// Apply a roll for the player to move. token = index to move, or -1 when no move is possible.
export function step(st, die, token) {
  const s = { ...st, pos: st.pos.map((x) => [...x]), die, k: st.k + 1, last: null };
  const me = st.turn, col = st.cols[me];
  const L = legal(st, die);
  if (token < 0 || !L.includes(token)) {
    if (L.length && token >= 0) throw new Error('illegal');
    s.msg = die === 6 && st.six >= 2 ? 'Three 6s in a row: turn lost.' : 'No move.';
    s.six = 0; s.turn = nextTurn(st, me);
    return s;
  }
  const from = s.pos[me][token], to = from < 0 ? 0 : from + die;
  s.pos[me][token] = to;
  let cap = null;
  const abs = absOf(col, to);
  if (abs >= 0 && !SAFE.has(abs)) {
    const rivals = occupants(s, abs).filter(([p]) => isFoe(st, me, p));
    const byP = {}; rivals.forEach(([p]) => { byP[p] = (byP[p] || 0) + 1; });
    for (const [p, t] of rivals) if (byP[p] === 1) { s.pos[p][t] = -1; cap = { p, t }; }
  }
  s.last = { p: me, t: token, from, to, cap };
  if (done(s, me)) {
    if (!st.team || done(s, partnerOf(st, me))) { s.winner = me; if (st.team) s.winTeam = teamOf(me); s.msg = st.team ? 'Both partners are home!' : 'All four tokens home!'; return s; }
    s.msg = 'All four home! Cheer on your partner.'; s.six = 0; s.turn = nextTurn(s, me); return s;
  }
  const bonus = die === 6 || cap || to === HOME;
  s.msg = cap ? 'Captured!' : to === HOME ? 'Token home!' : from < 0 ? 'Out of the yard.' : '';
  if (bonus) { s.six = die === 6 ? st.six + 1 : 0; if (s.msg === '' && die === 6) s.msg = 'Rolled a 6: roll again.'; }
  else { s.six = 0; s.turn = nextTurn(s, me); }
  return s;
}
export function dieFromHex(hx) { const m = /[0-5]/.exec(hx); return m ? +m[0] + 1 : 1 + (parseInt(hx.slice(0, 8), 16) % 6); }
export const rollFromRandom = (rand = Math.random) => 1 + Math.floor(rand() * 6);
// how exposed a token on abs square a would be (rival tokens 1-6 squares behind)
function danger(st, me, abs) {
  if (abs < 0 || SAFE.has(abs)) return 0;
  let d = 0;
  st.pos.forEach((toks, p) => { if (!isFoe(st, me, p)) return; toks.forEach((r) => { const b = absOf(st.cols[p], r); if (b < 0) return; const gap = (abs - b + 52) % 52; if (gap >= 1 && gap <= 6 && r + gap <= 50) d++; }); if (toks.some((r) => r < 0) && abs === START[st.cols[p]]) d++; });
  return d;
}
const LUDO_W = {
  medium: { home: 80, out: 45, cap: 60, safe: 14, lane: 24, danger: 10, noise: 6 },
  hard: { home: 110, out: 60, cap: 85, safe: 22, lane: 32, danger: 35, noise: 1.5 },
  expert: { home: 140, out: 78, cap: 120, safe: 30, lane: 40, danger: 58, noise: 0.25 }
};
export function aiPick(st, die, lvl = 'medium', rand = Math.random) {
  const L = legal(st, die); if (!L.length) return -1;
  if (lvl === 'easy') return L[Math.floor(rand() * L.length)];
  const w = LUDO_W[lvl] || LUDO_W.medium;
  const me = st.turn, col = st.cols[me];
  let best = L[0], bs = -Infinity;
  for (const t of L) {
    const from = st.pos[me][t], to = from < 0 ? 0 : from + die, abs = absOf(col, to);
    let sc = to / 4;
    if (to === HOME) sc += w.home;
    if (from < 0) sc += w.out;
    if (abs >= 0 && !SAFE.has(abs) && occupants(st, abs).some(([p]) => isFoe(st, me, p))) sc += w.cap;
    if (abs >= 0 && SAFE.has(abs)) sc += w.safe;
    if (to > 50 && from <= 50) sc += w.lane;
    sc -= danger(st, me, abs) * w.danger;
    sc += danger(st, me, absOf(col, from)) * w.danger * 0.85;
    sc += rand() * w.noise;
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}
// commit-reveal hash chain helpers (browser crypto)
export async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export async function makeChain(len = 600) {
  const seed = [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const c = [seed]; for (let i = 0; i < len; i++) c.push(await sha256hex(c[i]));
  return c; // c[len] is the commitment; reveal k uses c[len - 1 - k]
}
