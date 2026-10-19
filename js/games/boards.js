// Pure rules + computer players for the two-player board games (no DOM, no Firestore).
// Boards are plain strings so Firestore rules can sanity-check them:
//   '.' empty, 'a' player 0 (gold), 'b' player 1 (purple); checkers kings are 'A' / 'B'.
// A state is { board, turn (0|1), last (last move string or '') }.

const other = (t) => 1 - t;
const P = (t) => (t === 0 ? 'a' : 'b');
const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const set = (s, i, c) => s.slice(0, i) + c + s.slice(i + 1);

// ------------------------------------------------------------------ Star Drop (7 x 6 drop-four)
const W = 7, H = 6;
const LINES4 = (() => {
  const out = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
      const cells = [];
      for (let k = 0; k < 4; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= H || cc < 0 || cc >= W) break; cells.push(rr * W + cc); }
      if (cells.length === 4) out.push(cells);
    }
  }
  return out;
})();
function sdDropRow(board, col) { for (let r = H - 1; r >= 0; r--) if (board[r * W + col] === '.') return r; return -1; }
function sdWinner(board) {
  for (const l of LINES4) { const v = board[l[0]]; if (v !== '.' && l.every((i) => board[i] === v)) return { winner: v === 'a' ? 0 : 1, line: l }; }
  if (!board.includes('.')) return { winner: 'draw', line: [] };
  return null;
}
function sdScore(board, me) {
  const mc = P(me), oc = P(other(me));
  let s = 0;
  for (let r = 0; r < H; r++) if (board[r * W + 3] === mc) s += 3;
  for (const l of LINES4) {
    let m = 0, o = 0;
    for (const i of l) { if (board[i] === mc) m++; else if (board[i] === oc) o++; }
    if (m && o) continue;
    if (m === 3) s += 6; else if (m === 2) s += 2;
    if (o === 3) s -= 8; else if (o === 2) s -= 2;
  }
  return s;
}
const SD_ORDER = [3, 2, 4, 1, 5, 0, 6];
function sdSearch(board, turn, me, depth, alpha, beta) {
  const w = sdWinner(board);
  if (w) return w.winner === 'draw' ? 0 : (w.winner === me ? 100000 + depth : -100000 - depth);
  if (depth === 0) return sdScore(board, me);
  const max = turn === me;
  let best = max ? -Infinity : Infinity;
  for (const c of SD_ORDER) {
    const r = sdDropRow(board, c); if (r < 0) continue;
    const v = sdSearch(set(board, r * W + c, P(turn)), other(turn), me, depth - 1, alpha, beta);
    if (max) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}
export const stardrop = {
  name: 'Star Drop',
  init: () => '.'.repeat(W * H),
  moves: (st) => SD_ORDER.filter((c) => sdDropRow(st.board, c) >= 0).sort((a, b) => a - b).map(String),
  apply(st, m) {
    const c = +m, r = sdDropRow(st.board, c);
    if (r < 0) throw new Error('Column full');
    return { board: set(st.board, r * W + c, P(st.turn)), turn: other(st.turn), last: m, cell: r * W + c };
  },
  outcome: (st) => sdWinner(st.board),
  ai(st, level) {
    const moves = this.moves(st), me = st.turn;
    const winNow = moves.find((m) => sdWinner(this.apply(st, m).board)?.winner === me);
    if (winNow) return winNow;
    if (level === 'easy') {
      const block = moves.find((m) => { const c = +m, r = sdDropRow(st.board, c); return sdWinner(set(st.board, r * W + c, P(other(me))))?.winner === other(me); });
      if (block && Math.random() < 0.6) return block;
      return rnd(moves);
    }
    let best = null, bv = -Infinity;
    for (const c of SD_ORDER) {
      const r = sdDropRow(st.board, c); if (r < 0) continue;
      const v = sdSearch(set(st.board, r * W + c, P(me)), other(me), me, 6, -Infinity, Infinity);
      if (v > bv) { bv = v; best = String(c); }
    }
    return best ?? rnd(moves);
  }
};

// ------------------------------------------------------------------ KL Grid (3x3 and ultimate 9x9)
const L3 = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function line3(cells) {
  for (const l of L3) { const v = cells[l[0]]; if ((v === 'a' || v === 'b') && v === cells[l[1]] && v === cells[l[2]]) return { v, line: l }; }
  return null;
}
function smallState(board, b) {
  const cells = board.slice(b * 9, b * 9 + 9);
  const w = line3(cells); if (w) return w.v;
  return cells.includes('.') ? '.' : 'd';
}
function bigCells(board) { let s = ''; for (let b = 0; b < 9; b++) s += smallState(board, b); return s; }
function ultMoves(board, last) {
  const big = bigCells(board);
  let target = last === '' ? -1 : (+last) % 9;
  if (target >= 0 && big[target] !== '.') target = -1;
  const out = [];
  for (let b = 0; b < 9; b++) {
    if (big[b] !== '.' || (target >= 0 && b !== target)) continue;
    for (let i = 0; i < 9; i++) if (board[b * 9 + i] === '.') out.push(String(b * 9 + i));
  }
  return out;
}
function ultOutcome(board) {
  const big = bigCells(board);
  const w = line3(big);
  if (w) return { winner: w.v === 'a' ? 0 : 1, line: w.line, big };
  if (!big.includes('.')) {
    // Board full: whoever won more small boards takes it, else draw.
    const a = [...big].filter((c) => c === 'a').length, b = [...big].filter((c) => c === 'b').length;
    return { winner: a > b ? 0 : b > a ? 1 : 'draw', line: [], big };
  }
  return null;
}
function ultEval(board, me) {
  const big = bigCells(board), mc = P(me), oc = P(other(me));
  let s = 0;
  for (let b = 0; b < 9; b++) { if (big[b] === mc) s += b === 4 ? 14 : 10; else if (big[b] === oc) s -= b === 4 ? 14 : 10; }
  for (const l of L3) {
    const v = l.map((i) => big[i]);
    const m = v.filter((x) => x === mc).length, o = v.filter((x) => x === oc).length, d = v.filter((x) => x === 'd').length;
    if (d) continue;
    if (m === 2 && !o) s += 18; if (o === 2 && !m) s -= 18;
  }
  return s;
}
function ultSearch(board, last, turn, me, depth, alpha, beta) {
  const o = ultOutcome(board);
  if (o) return o.winner === 'draw' ? 0 : o.winner === me ? 10000 + depth : -10000 - depth;
  if (depth === 0) return ultEval(board, me);
  const moves = ultMoves(board, last);
  const max = turn === me; let best = max ? -Infinity : Infinity;
  for (const m of moves) {
    const v = ultSearch(set(board, +m, P(turn)), m, other(turn), me, depth - 1, alpha, beta);
    if (max) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}
function ttMinimax(cells, turn, me) {
  const w = line3(cells);
  if (w) return (w.v === P(me) ? 10 : -10);
  if (!cells.includes('.')) return 0;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) if (cells[i] === '.') {
    const v = ttMinimax(set(cells, i, P(turn)), other(turn), me) * 0.9;
    best = turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}
export const klgrid = {
  name: 'KL Grid',
  init: (mode) => '.'.repeat(mode === 'ultimate' ? 81 : 9),
  moves(st) {
    if (st.board.length === 81) return ultMoves(st.board, st.last);
    if (line3(st.board)) return [];
    return [...st.board].map((c, i) => (c === '.' ? String(i) : null)).filter(Boolean);
  },
  apply(st, m) {
    if (!this.moves(st).includes(m)) throw new Error('Not a legal square');
    return { board: set(st.board, +m, P(st.turn)), turn: other(st.turn), last: m, cell: +m };
  },
  outcome(st) {
    if (st.board.length === 81) return ultOutcome(st.board);
    const w = line3(st.board);
    if (w) return { winner: w.v === 'a' ? 0 : 1, line: w.line };
    return st.board.includes('.') ? null : { winner: 'draw', line: [] };
  },
  bigCells,
  ai(st, level) {
    const moves = this.moves(st), me = st.turn;
    const winNow = moves.find((m) => this.outcome(this.apply(st, m))?.winner === me);
    if (winNow) return winNow;
    if (level === 'easy') return rnd(moves);
    if (st.board.length === 9) {
      let best = null, bv = -Infinity;
      for (const m of moves) { const v = ttMinimax(set(st.board, +m, P(me)), other(me), me); if (v > bv) { bv = v; best = m; } }
      return best;
    }
    let best = null, bv = -Infinity;
    const depth = moves.length > 20 ? 3 : 4;
    for (const m of moves) {
      const v = ultSearch(set(st.board, +m, P(me)), m, other(me), me, depth, -Infinity, Infinity) + Math.random();
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }
};

// ------------------------------------------------------------------ Checkers (8x8, 32 dark squares)
// Square s (0..31): row = s>>2, col = (s&3)*2 + (row even ? 1 : 0). Player 0 ('a') starts on rows 5-7
// and moves up; player 1 ('b') starts on rows 0-2 and moves down. Captures are mandatory and a
// multi-jump is one move written as "from-mid-...-to".
const sqRC = (s) => { const r = s >> 2; return [r, (s & 3) * 2 + (r % 2 === 0 ? 1 : 0)]; };
const rcSq = (r, c) => (r < 0 || r > 7 || c < 0 || c > 7 || (r + c) % 2 === 0 ? -1 : r * 4 + (c >> 1));
const owner = (ch) => (ch === 'a' || ch === 'A' ? 0 : ch === 'b' || ch === 'B' ? 1 : -1);
function dirsFor(ch) {
  if (ch === 'A' || ch === 'B') return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return ch === 'a' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}
function jumpsFrom(board, s, ch, path, out) {
  const [r, c] = sqRC(s); let found = false;
  for (const [dr, dc] of dirsFor(ch)) {
    const mid = rcSq(r + dr, c + dc), to = rcSq(r + 2 * dr, c + 2 * dc);
    if (mid < 0 || to < 0 || board[to] !== '.' || owner(board[mid]) !== 1 - owner(ch)) continue;
    found = true;
    let b2 = set(set(set(board, s, '.'), mid, '.'), to, ch);
    const [tr] = sqRC(to);
    const crowned = (ch === 'a' && tr === 0) || (ch === 'b' && tr === 7);
    if (crowned) { out.push([...path, to].join('-')); continue; } // crowning ends the move
    jumpsFrom(b2, to, ch, [...path, to], out);
  }
  if (!found && path.length > 1) out.push(path.join('-'));
}
function ckMoves(board, turn) {
  const jumps = [], steps = [];
  for (let s = 0; s < 32; s++) {
    const ch = board[s]; if (owner(ch) !== turn) continue;
    jumpsFrom(board, s, ch, [s], jumps);
    const [r, c] = sqRC(s);
    for (const [dr, dc] of dirsFor(ch)) { const to = rcSq(r + dr, c + dc); if (to >= 0 && board[to] === '.') steps.push(`${s}-${to}`); }
  }
  return jumps.length ? jumps : steps;
}
function ckApply(board, turn, m) {
  const path = m.split('-').map(Number);
  let ch = board[path[0]];
  let b = set(board, path[0], '.');
  for (let i = 1; i < path.length; i++) {
    const [r1, c1] = sqRC(path[i - 1]), [r2, c2] = sqRC(path[i]);
    if (Math.abs(r2 - r1) === 2) b = set(b, rcSq((r1 + r2) / 2, (c1 + c2) / 2), '.');
  }
  const end = path[path.length - 1], [er] = sqRC(end);
  if (ch === 'a' && er === 0) ch = 'A'; if (ch === 'b' && er === 7) ch = 'B';
  return set(b, end, ch);
}
function ckEval(board, me) {
  let s = 0;
  for (let i = 0; i < 32; i++) {
    const ch = board[i], o = owner(ch); if (o < 0) continue;
    const [r] = sqRC(i);
    let v = ch === 'A' || ch === 'B' ? 3 : 1 + (o === 0 ? (7 - r) : r) * 0.04;
    s += o === me ? v : -v;
  }
  return s;
}
function ckSearch(board, turn, me, depth, alpha, beta) {
  const moves = ckMoves(board, turn);
  if (!moves.length) return turn === me ? -1000 - depth : 1000 + depth;
  if (depth === 0) return ckEval(board, me);
  const max = turn === me; let best = max ? -Infinity : Infinity;
  for (const m of moves) {
    const v = ckSearch(ckApply(board, turn, m), other(turn), me, depth - 1, alpha, beta);
    if (max) { best = Math.max(best, v); alpha = Math.max(alpha, v); } else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (beta <= alpha) break;
  }
  return best;
}
export const checkers = {
  name: 'Checkers',
  init: () => 'bbbbbbbbbbbb' + '........' + 'aaaaaaaaaaaa',
  moves: (st) => ckMoves(st.board, st.turn),
  apply(st, m) {
    if (!ckMoves(st.board, st.turn).includes(m)) throw new Error('Not a legal move');
    return { board: ckApply(st.board, st.turn, m), turn: other(st.turn), last: m, cell: +m.split('-').pop() };
  },
  outcome(st) {
    if (!ckMoves(st.board, st.turn).length) return { winner: other(st.turn), line: [] };
    if ((st.no || 0) >= 160) return { winner: 'draw', line: [] };
    return null;
  },
  sqRC, rcSq, owner,
  ai(st, level) {
    const moves = ckMoves(st.board, st.turn);
    if (level === 'easy') return rnd(moves);
    let best = null, bv = -Infinity;
    for (const m of moves) {
      const v = ckSearch(ckApply(st.board, st.turn, m), other(st.turn), st.turn, 5, -Infinity, Infinity) + Math.random() * 0.01;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  }
};

export const ENGINES = { stardrop, klgrid, checkers };
