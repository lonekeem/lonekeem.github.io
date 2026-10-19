// Star Cards: an original shedding card game (pure rules + computer players, no DOM / Firestore).
// Card codes: colour + value. Colours p (purple) g (gold) t (teal) r (rose); values 0-9,
// S = Skip, F = Flip (reverse), D = Draw 2. Wilds have no colour: W = Star Wild, X = Star Wild +4.
export const COLORS = ['p', 'g', 't', 'r'];
export const COLOR_NAME = { p: 'Purple', g: 'Gold', t: 'Teal', r: 'Rose' };
export const VALUE_NAME = { S: 'Skip', F: 'Flip', D: 'Draw 2', W: 'Star Wild', X: 'Star Wild +4' };
export const HAND = 7;

export function fullDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push(c + '0');
    for (const v of '123456789SFD') d.push(c + v, c + v);
  }
  for (let i = 0; i < 4; i++) d.push('W', 'X');
  return d; // 108 cards
}
export const isWild = (card) => card === 'W' || card === 'X';
export const colorOf = (card) => (isWild(card) ? '' : card[0]);
export const valueOf = (card) => (isWild(card) ? card : card[1]);
export const points = (card) => (isWild(card) ? 50 : /[SFD]/.test(card[1]) ? 20 : +card[1]);
export const cardName = (card) => isWild(card) ? VALUE_NAME[card] : `${COLOR_NAME[card[0]]} ${VALUE_NAME[card[1]] || card[1]}`;

// ---- seeded shuffle (xmur3 + mulberry32). The seed is committed by its SHA-256 at deal time
// and revealed when the round ends, so everyone can re-run the shuffle and check the deal.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, seed) {
  const r = mulberry32(xmur3(seed)()); const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function newSeed() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---- round setup. Deck top = end of array. Deal 7 each in seat order, then flip the first
// number card for the discard (action cards met while flipping go to the bottom).
export function deal(seed, n) {
  const deck = shuffle(fullDeck(), seed);
  const hands = Array.from({ length: n }, () => []);
  for (let k = 0; k < HAND; k++) for (let s = 0; s < n; s++) hands[s].push(deck.pop());
  let top = deck.pop();
  while (!/^[pgtr][0-9]$/.test(top)) { deck.unshift(top); top = deck.pop(); }
  return { deck, hands, discard: [top], color: top[0] };
}
export function newRound(seed, n, prev = {}) {
  const d = deal(seed, n);
  const dealer = prev.round ? ((prev.dealer ?? 0) + 1) % n : 0;
  return {
    n, seed, round: (prev.round || 0) + 1, dealer,
    deck: d.deck, hands: d.hands, discard: d.discard, color: d.color,
    turn: (dealer + 1) % n, dir: 1, drew: false, drawn: null, exposed: -1, called: Array(n).fill(false),
    scores: prev.scores || Array(n).fill(0), target: prev.target ?? 500, reshuffles: 0,
    roundWinner: -1, matchWinner: -1, roundPoints: 0, msg: '', seq: (prev.seq || 0) + 1
  };
}
export const top = (st) => st.discard[st.discard.length - 1];
export function canPlay(st, card) {
  if (isWild(card)) return true;
  const t = top(st);
  return card[0] === st.color || (!isWild(t) && card[1] === t[1]);
}
export function playable(st, seat) {
  if (st.turn !== seat || st.roundWinner >= 0) return [];
  const hand = st.hands[seat];
  if (st.drew) return st.drawn && hand.includes(st.drawn) && canPlay(st, st.drawn) ? [st.drawn] : [];
  return [...new Set(hand.filter((c) => canPlay(st, c)))];
}
const nextSeat = (st, from, steps = 1) => ((from + st.dir * steps) % st.n + st.n * 4) % st.n;
function drawCards(st, seat, k) {
  const got = [];
  for (let i = 0; i < k; i++) {
    if (!st.deck.length) {
      if (st.discard.length <= 1) break;
      const keep = st.discard.pop();
      st.reshuffles++;
      st.deck = shuffle(st.discard, st.seed + ':' + st.reshuffles);
      st.discard = [keep];
    }
    const c = st.deck.pop(); st.hands[seat].push(c); got.push(c);
  }
  st.called[seat] = false;
  return got;
}
const clone = (st) => JSON.parse(JSON.stringify(st));

// Applies one action and returns { st, events }. Throws on an illegal action.
// Actions: {t:'play', card, color, last} | {t:'draw'} | {t:'pass'} | {t:'last'} | {t:'catch'}
export function act(prev, seat, a) {
  const st = clone(prev); const ev = [];
  if (st.roundWinner >= 0) throw new Error('Round is over');
  if (a.t === 'last') {
    if (st.hands[seat].length > 2) throw new Error('You can call LAST STAR! with two cards or one');
    st.called[seat] = true; if (st.exposed === seat) st.exposed = -1;
    ev.push({ k: 'last', seat }); st.msg = 'LAST STAR!'; st.seq++;
    return { st, events: ev };
  }
  if (a.t === 'catch') {
    if (st.exposed < 0 || st.exposed === seat) throw new Error('Nobody to catch');
    const who = st.exposed; drawCards(st, who, 2); st.exposed = -1;
    ev.push({ k: 'caught', seat: who, by: seat }); st.msg = 'Caught! +2'; st.seq++;
    return { st, events: ev };
  }
  if (st.turn !== seat) throw new Error('Not your turn');
  if (st.exposed >= 0 && st.exposed !== seat) st.exposed = -1; // the window to catch closes
  if (a.t === 'draw') {
    if (st.drew) throw new Error('You already drew');
    const got = drawCards(st, seat, 1);
    st.drew = true; st.drawn = got[0] || null;
    ev.push({ k: 'draw', seat, n: got.length });
    if (!st.drawn || !canPlay(st, st.drawn)) { advance(st, 1); ev.push({ k: 'pass', seat }); }
    st.seq++;
    return { st, events: ev };
  }
  if (a.t === 'pass') {
    if (!st.drew) throw new Error('Draw first');
    advance(st, 1); ev.push({ k: 'pass', seat }); st.seq++;
    return { st, events: ev };
  }
  if (a.t !== 'play') throw new Error('Unknown action');
  const card = a.card;
  if (!playable(st, seat).includes(card)) throw new Error('That card can’t be played now');
  const hand = st.hands[seat];
  hand.splice(hand.indexOf(card), 1);
  st.discard.push(card);
  if (isWild(card)) {
    if (!COLORS.includes(a.color)) throw new Error('Pick a colour');
    st.color = a.color;
  } else st.color = card[0];
  if (a.last) st.called[seat] = true;
  ev.push({ k: 'play', seat, card, color: st.color });
  if (hand.length === 1 && !st.called[seat]) st.exposed = seat;
  if (hand.length > 2) st.called[seat] = false;
  const v = valueOf(card);
  if (hand.length === 0) {
    // Draw cards still land on the next player before the round is scored.
    if (v === 'D') drawCards(st, nextSeat(st, seat), 2);
    if (v === 'X') drawCards(st, nextSeat(st, seat), 4);
    st.roundWinner = seat;
    st.roundPoints = st.hands.reduce((s, h, i) => s + (i === seat ? 0 : h.reduce((x, c) => x + points(c), 0)), 0);
    st.scores[seat] += st.roundPoints;
    if (!st.target || st.scores[seat] >= st.target) st.matchWinner = seat;
    st.exposed = -1; st.drew = false; st.drawn = null;
    ev.push({ k: 'round', seat, pts: st.roundPoints });
    st.seq++;
    return { st, events: ev };
  }
  if (v === 'S') { advance(st, 2); ev.push({ k: 'skip', seat: nextSeat(prev, seat) }); }
  else if (v === 'F') {
    if (st.n === 2) advance(st, 2);
    else { st.dir = -st.dir; advance(st, 1); }
    ev.push({ k: 'flip' });
  } else if (v === 'D' || v === 'X') {
    const victim = nextSeat(st, seat);
    drawCards(st, victim, v === 'D' ? 2 : 4);
    ev.push({ k: 'drawn', seat: victim, n: v === 'D' ? 2 : 4 });
    advance(st, 2);
  } else advance(st, 1);
  st.seq++;
  return { st, events: ev };
}
function advance(st, steps) { st.turn = nextSeat(st, st.turn, steps); st.drew = false; st.drawn = null; }

// ---- computer players
export function bestColor(hand) {
  const n = { p: 0, g: 0, t: 0, r: 0 };
  hand.forEach((c) => { if (!isWild(c)) n[c[0]] += 1 + points(c) / 40; });
  return COLORS.reduce((a, b) => (n[b] > n[a] ? b : a), COLORS[Math.floor(Math.random() * 4)]);
}
export function aiAction(st, seat, level = 'hard') {
  const opts = playable(st, seat);
  if (!opts.length) return st.drew ? { t: 'pass' } : { t: 'draw' };
  const hand = st.hands[seat];
  let card;
  if (level === 'easy') card = opts[Math.floor(Math.random() * opts.length)];
  else {
    const nextCount = st.hands[nextSeat(st, seat)].length;
    const colorCount = (c) => hand.filter((h) => h[0] === c).length;
    const score = (c) => {
      let s = 0;
      if (isWild(c)) s -= 30 - (nextCount <= 2 ? 40 : 0) - (hand.length <= 2 ? 30 : 0);
      else {
        s += colorCount(c[0]) * 3 + points(c) * 0.3;
        if (/[SDF]/.test(c[1]) && nextCount <= 3) s += 25;
      }
      if (c === 'X') s -= 5;
      return s;
    };
    card = opts.slice().sort((a, b) => score(b) - score(a))[0];
  }
  const after = hand.filter((c, i) => i !== hand.indexOf(card));
  const callLast = hand.length === 2 && (level === 'hard' || Math.random() < 0.7);
  return { t: 'play', card, color: isWild(card) ? bestColor(after) : undefined, last: callLast };
}
// Public projection written to the room doc (no hands, no deck order).
export function publicView(st) {
  return {
    top: top(st), color: st.color, turn: st.turn, dir: st.dir, drew: st.drew, exposed: st.exposed,
    counts: st.hands.map((h) => h.length), deckCount: st.deck.length, discardCount: st.discard.length,
    scores: st.scores, round: st.round, roundWinner: st.roundWinner, matchWinner: st.matchWinner,
    roundPoints: st.roundPoints, called: st.called, seq: st.seq, target: st.target
  };
}
