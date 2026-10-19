// Chess rules + a small alpha-beta engine. Squares 0..63, 0 = a8, 63 = h1. White pieces are
// upper case. A position is { b: [64 chars], w: white to move, cs: castling 'KQkq' subset,
// ep: en-passant target square or -1, half: half-move clock, full: move number }.
// Also runs as a module Web Worker: postMessage({ board, cx, lvl, keys }) -> { move }.
export const START = 'rnbqkbnrpppppppp' + '.'.repeat(32) + 'PPPPPPPPRNBQKBNR';
export const START_CX = 'w KQkq - 0 1';
const N = [-17, -15, -10, -6, 6, 10, 15, 17], KD = [-9, -8, -7, -1, 1, 7, 8, 9];
const DIAG = [-9, -7, 7, 9], ORTH = [-8, -1, 1, 8];
const col = (s) => s & 7, row = (s) => s >> 3;
const isW = (p) => p >= 'A' && p <= 'Z';
const ok = (f, t, d) => t >= 0 && t < 64 && Math.abs(col(t) - col(f)) <= (d === 'n' ? 2 : 1);
export const sqName = (s) => 'abcdefgh'[col(s)] + (8 - row(s));

export function parse(board, cx = START_CX) {
  const [side, cs, ep, half, full] = cx.split(' ');
  return { b: [...board], w: side === 'w', cs: cs === '-' ? '' : cs, ep: ep === '-' ? -1 : +ep, half: +half || 0, full: +full || 1 };
}
export const boardOf = (p) => p.b.join('');
export const cxOf = (p) => `${p.w ? 'w' : 'b'} ${p.cs || '-'} ${p.ep < 0 ? '-' : p.ep} ${p.half} ${p.full}`;

export function attacked(b, s, byW) {
  const P = byW ? 'P' : 'p', Nn = byW ? 'N' : 'n', B = byW ? 'B' : 'b', R = byW ? 'R' : 'r', Q = byW ? 'Q' : 'q', K = byW ? 'K' : 'k';
  // pawns: a white pawn on s+7 / s+9 attacks s
  const pd = byW ? [7, 9] : [-7, -9];
  for (const d of pd) { const f = s + d; if (f >= 0 && f < 64 && Math.abs(col(f) - col(s)) === 1 && b[f] === P) return true; }
  for (const d of N) { const f = s + d; if (ok(s, f, 'n') && b[f] === Nn) return true; }
  for (const d of KD) { const f = s + d; if (ok(s, f) && b[f] === K) return true; }
  for (const d of DIAG) { let f = s; for (;;) { const t = f + d; if (!ok(f, t)) break; f = t; const p = b[f]; if (p !== '.') { if (p === B || p === Q) return true; break; } } }
  for (const d of ORTH) { let f = s; for (;;) { const t = f + d; if (!ok(f, t)) break; f = t; const p = b[f]; if (p !== '.') { if (p === R || p === Q) return true; break; } } }
  return false;
}
const kingSq = (b, w) => b.indexOf(w ? 'K' : 'k');
export const inCheck = (p, w = p.w) => attacked(p.b, kingSq(p.b, w), !w);

function pseudo(p, capsOnly = false) {
  const b = p.b, w = p.w, out = [];
  const mine = (q) => q !== '.' && isW(q) === w, theirs = (q) => q !== '.' && isW(q) !== w;
  for (let s = 0; s < 64; s++) {
    const q = b[s]; if (!mine(q)) continue;
    const t = q.toLowerCase();
    if (t === 'p') {
      const dir = w ? -8 : 8, start = w ? 6 : 1, last = w ? 0 : 7;
      const one = s + dir;
      const push = (to, cap) => { if (row(to) === last) for (const pr of 'qnrb') out.push({ f: s, t: to, p: pr, c: cap }); else out.push({ f: s, t: to, c: cap }); };
      if (!capsOnly && one >= 0 && one < 64 && b[one] === '.') { push(one, ''); const two = s + 2 * dir; if (row(s) === start && b[two] === '.') out.push({ f: s, t: two, c: '', dbl: 1 }); }
      if (capsOnly && one >= 0 && one < 64 && b[one] === '.' && row(one) === last) push(one, '');
      for (const dc of [-1, 1]) {
        const to = one + dc; if (to < 0 || to >= 64 || Math.abs(col(to) - col(s)) !== 1) continue;
        if (theirs(b[to])) push(to, b[to]);
        else if (to === p.ep) out.push({ f: s, t: to, c: w ? 'p' : 'P', ep: 1 });
      }
    } else if (t === 'n' || t === 'k') {
      for (const d of t === 'n' ? N : KD) { const to = s + d; if (!ok(s, to, t === 'n' ? 'n' : '')) continue; if (mine(b[to])) continue; if (capsOnly && b[to] === '.') continue; out.push({ f: s, t: to, c: b[to] === '.' ? '' : b[to] }); }
      if (t === 'k' && !capsOnly) {
        const home = w ? 60 : 4, cs = p.cs;
        if (s === home && !attacked(b, s, !w)) {
          if (cs.includes(w ? 'K' : 'k') && b[s + 1] === '.' && b[s + 2] === '.' && b[s + 3] === (w ? 'R' : 'r') && !attacked(b, s + 1, !w) && !attacked(b, s + 2, !w)) out.push({ f: s, t: s + 2, c: '', cas: 1 });
          if (cs.includes(w ? 'Q' : 'q') && b[s - 1] === '.' && b[s - 2] === '.' && b[s - 3] === '.' && b[s - 4] === (w ? 'R' : 'r') && !attacked(b, s - 1, !w) && !attacked(b, s - 2, !w)) out.push({ f: s, t: s - 2, c: '', cas: 1 });
        }
      }
    } else {
      const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : KD;
      for (const d of dirs) { let f = s; for (;;) { const to = f + d; if (!ok(f, to)) break; f = to; if (mine(b[to])) break; if (b[to] !== '.') { out.push({ f: s, t: to, c: b[to] }); break; } if (!capsOnly) out.push({ f: s, t: to, c: '' }); } }
    }
  }
  return out;
}
// make / unmake in place (used by search and by legality filtering)
function make(p, m) {
  const b = p.b, q = b[m.f];
  const u = { cs: p.cs, ep: p.ep, half: p.half, full: p.full, q };
  b[m.t] = m.p ? (p.w ? m.p.toUpperCase() : m.p) : q; b[m.f] = '.';
  if (m.ep) b[m.t + (p.w ? 8 : -8)] = '.';
  if (m.cas) { if (m.t > m.f) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = '.'; } else { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = '.'; } }
  let cs = p.cs;
  if (cs) {
    if (q === 'K') cs = cs.replace(/[KQ]/g, ''); else if (q === 'k') cs = cs.replace(/[kq]/g, '');
    for (const [sq, ch] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (m.f === sq || m.t === sq) cs = cs.replace(ch, '');
  }
  p.cs = cs; p.ep = m.dbl ? (m.f + m.t) >> 1 : -1;
  p.half = q.toLowerCase() === 'p' || m.c ? 0 : p.half + 1;
  if (!p.w) p.full++;
  p.w = !p.w;
  return u;
}
function unmake(p, m, u) {
  const b = p.b; p.w = !p.w;
  b[m.f] = u.q; b[m.t] = m.ep ? '.' : m.c || '.';
  if (m.ep) b[m.t + (p.w ? 8 : -8)] = m.c;
  if (m.cas) { if (m.t > m.f) { b[m.f + 3] = b[m.f + 1]; b[m.f + 1] = '.'; } else { b[m.f - 4] = b[m.f - 1]; b[m.f - 1] = '.'; } }
  p.cs = u.cs; p.ep = u.ep; p.half = u.half; p.full = u.full;
}
export function legal(p, capsOnly = false) {
  const out = [];
  for (const m of pseudo(p, capsOnly)) { const u = make(p, m); if (!attacked(p.b, kingSq(p.b, !p.w), p.w)) out.push(m); unmake(p, m, u); }
  return out;
}
export const moveStr = (m) => `${m.f}-${m.t}${m.p ? '-' + ('nbrq'.indexOf(m.p) + 1) : ''}`;
export function findMove(p, s) {
  const [f, t, pr] = s.split('-').map(Number);
  return legal(p).find((m) => m.f === f && m.t === t && (m.p ? 'nbrq'.indexOf(m.p) + 1 === pr : !pr)) || null;
}
export function play(p, m) { const q = { ...p, b: [...p.b] }; make(q, m); return q; }
// position key for repetition: board + side + castling + en passant only if a capture is possible
export function key(p) {
  let ep = '-';
  if (p.ep >= 0 && legal(p).some((m) => m.ep)) ep = p.ep;
  return `${p.b.join('')}${p.w ? 'w' : 'b'}${p.cs}${ep}`;
}
function insufficient(b) {
  const pcs = b.filter((q) => q !== '.' && q.toLowerCase() !== 'k');
  if (!pcs.length) return true;
  if (pcs.length === 1 && 'nNbB'.includes(pcs[0])) return true;
  if (pcs.every((q) => q.toLowerCase() === 'b')) { const shades = new Set(); b.forEach((q, s) => { if (q.toLowerCase() === 'b') shades.add((row(s) + col(s)) & 1); }); return shades.size === 1; }
  return false;
}
// { over, winner: 'w'|'b'|'draw', why } given the position and the list of previous keys (incl. this one)
export function outcome(p, keys = []) {
  const moves = legal(p);
  if (!moves.length) return inCheck(p) ? { over: true, winner: p.w ? 'b' : 'w', why: 'Checkmate' } : { over: true, winner: 'draw', why: 'Stalemate' };
  if (p.half >= 100) return { over: true, winner: 'draw', why: '50-move rule' };
  const k = keys.length ? keys[keys.length - 1] : key(p);
  if (keys.filter((x) => x === k).length >= 3) return { over: true, winner: 'draw', why: 'Threefold repetition' };
  if (insufficient(p.b)) return { over: true, winner: 'draw', why: 'Insufficient material' };
  return { over: false, check: inCheck(p) };
}
// replay a move list from the start: returns { pos, keys, sans }
export function replay(ml) {
  let p = parse(START, START_CX); const keys = [key(p)], sans = [];
  for (const s of (ml || '').split(' ').filter(Boolean)) {
    const m = findMove(p, s); if (!m) break;
    sans.push(san(p, m)); p = play(p, m); keys.push(key(p));
  }
  return { pos: p, keys, sans };
}
export function san(p, m) {
  const q = p.b[m.f].toUpperCase();
  let s;
  if (m.cas) s = m.t > m.f ? 'O-O' : 'O-O-O';
  else {
    s = q === 'P' ? '' : q;
    if (q !== 'P') {
      const others = legal(p).filter((o) => o.t === m.t && o.f !== m.f && p.b[o.f] === p.b[m.f]);
      if (others.length) { const fc = others.some((o) => col(o.f) === col(m.f)), fr = others.some((o) => row(o.f) === row(m.f)); s += !fc ? sqName(m.f)[0] : !fr ? sqName(m.f)[1] : sqName(m.f); }
    }
    if (m.c) s += (q === 'P' ? sqName(m.f)[0] : '') + 'x';
    s += sqName(m.t);
    if (m.p) s += '=' + m.p.toUpperCase();
  }
  const n = play(p, m); const o = outcome(n);
  if (o.over && o.why === 'Checkmate') s += '#'; else if (inCheck(n)) s += '+';
  return s;
}

// ------------------------------------------------------------ engine
const VAL = { p: 100, n: 320, b: 335, r: 500, q: 920, k: 0 };
// piece-square tables from white's point of view, index 0 = a8
const PST = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60, 12, 14, 22, 32, 32, 22, 14, 12, 6, 8, 12, 26, 26, 12, 8, 6, 2, 2, 6, 22, 22, 6, 2, 2, 4, -2, -6, 4, 4, -6, -2, 4, 4, 8, 8, -18, -18, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -38, -30, -30, -30, -30, -38, -50, -38, -18, 0, 2, 2, 0, -18, -38, -30, 2, 12, 16, 16, 12, 2, -30, -30, 6, 16, 22, 22, 16, 6, -30, -30, 2, 16, 22, 22, 16, 2, -30, -30, 6, 12, 16, 16, 12, 6, -30, -38, -18, 2, 6, 6, 2, -18, -38, -50, -36, -30, -30, -30, -30, -36, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 6, 10, 10, 6, 0, -10, -10, 6, 6, 10, 10, 6, 6, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 6, 0, 0, 0, 0, 6, -10, -20, -10, -12, -10, -10, -12, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 6, 12, 12, 12, 12, 12, 12, 6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, 0, 0, 2, 8, 8, 4, 0, 0],
  q: [-20, -10, -10, -4, -4, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 4, 4, 4, 4, 0, -10, -4, 0, 4, 4, 4, 4, 0, -4, -2, 0, 4, 4, 4, 4, 0, -4, -10, 4, 4, 4, 4, 4, 0, -10, -10, 0, 4, 0, 0, 0, 0, -10, -20, -10, -10, -4, -4, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 16, 16, 0, -4, -4, 0, 16, 16, 20, 30, 8, 0, 0, 8, 30, 20],
  ke: [-50, -36, -28, -20, -20, -28, -36, -50, -30, -18, -8, 0, 0, -8, -18, -30, -30, -8, 20, 30, 30, 20, -8, -30, -30, -8, 30, 40, 40, 30, -8, -30, -30, -8, 30, 40, 40, 30, -8, -30, -30, -8, 20, 30, 30, 20, -8, -30, -30, -28, 0, 0, 0, 0, -28, -30, -50, -30, -30, -30, -30, -30, -30, -50]
};
function evaluate(p) {
  let s = 0, mat = 0;
  for (const q of p.b) if (q !== '.' && q.toLowerCase() !== 'k' && q.toLowerCase() !== 'p') mat += VAL[q.toLowerCase()];
  const end = mat < 1600;
  for (let i = 0; i < 64; i++) {
    const q = p.b[i]; if (q === '.') continue;
    const t = q.toLowerCase(), w = isW(q), idx = w ? i : (7 - row(i)) * 8 + col(i);
    const v = VAL[t] + (t === 'k' && end ? PST.ke : PST[t])[idx];
    s += w ? v : -v;
  }
  return p.w ? s : -s;
}
const MATE = 100000;
function order(ms) { return ms.sort((a, b) => (b.c ? VAL[b.c.toLowerCase()] * 10 : 0) + (b.p ? 800 : 0) - (a.c ? VAL[a.c.toLowerCase()] * 10 : 0) - (a.p ? 800 : 0)); }
export function search(p, { depth = 3, ms = 800, noise = 0, rand = Math.random } = {}) {
  const t0 = Date.now(); let nodes = 0, stop = false;
  const pos = { ...p, b: [...p.b] };
  function qs(a, bt, d) {
    nodes++;
    const sp = evaluate(pos); if (sp >= bt) return sp; if (sp > a) a = sp;
    if (d > 6) return sp;
    for (const m of order(legal(pos, true))) { const u = make(pos, m); const v = -qs(-bt, -a, d + 1); unmake(pos, m, u); if (v >= bt) return v; if (v > a) a = v; }
    return a;
  }
  function ab(d, a, bt, ply) {
    if ((++nodes & 1023) === 0 && Date.now() - t0 > ms) stop = true;
    if (stop) return 0;
    if (pos.half >= 100) return 0;
    if (d <= 0) return qs(a, bt, 0);
    const ms2 = order(legal(pos));
    if (!ms2.length) return inCheck(pos) ? -MATE + ply : 0;
    let best = -Infinity;
    for (const m of ms2) {
      const u = make(pos, m); const v = -ab(d - 1, -bt, -a, ply + 1); unmake(pos, m, u);
      if (v > best) best = v; if (v > a) a = v; if (a >= bt) break;
    }
    return best;
  }
  let root = order(legal(pos)); if (!root.length) return null;
  let bestMove = root[0], bestScore = -Infinity;
  for (let d = 1; d <= depth; d++) {
    let a = -Infinity, cur = null, curS = -Infinity;
    const scored = [];
    for (const m of root) {
      const u = make(pos, m); let v = -ab(d - 1, -Infinity, -a + (noise ? noise : 0), 1); unmake(pos, m, u);
      if (stop) break;
      if (noise) v += (rand() - 0.5) * noise;
      scored.push([v, m]);
      if (v > curS) { curS = v; cur = m; } if (v > a) a = v;
    }
    if (stop && d > 1) break;
    if (cur) { bestMove = cur; bestScore = curS; }
    root = scored.sort((x, y) => y[0] - x[0]).map((x) => x[1]).concat(root.filter((m) => !scored.some((x) => x[1] === m)));
    if (Date.now() - t0 > ms * 0.55) break;
  }
  return { move: bestMove, score: bestScore, nodes };
}
const LEVELS = { easy: { depth: 1, ms: 200, noise: 260 }, medium: { depth: 2, ms: 500, noise: 40 }, hard: { depth: 5, ms: 1200, noise: 0 } };
export function aiMove(board, cx, lvl = 'medium', rand = Math.random) {
  const p = parse(board, cx); const L = LEVELS[lvl] || LEVELS.medium;
  const ms = legal(p); if (!ms.length) return null;
  if (lvl === 'easy' && rand() < 0.25) return moveStr(ms[Math.floor(rand() * ms.length)]);
  const r = search(p, { ...L, rand });
  return r && moveStr(r.move);
}
// module worker entry
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => { const { board, cx, lvl, id } = e.data; self.postMessage({ id, move: aiMove(board, cx, lvl) }); };
}
