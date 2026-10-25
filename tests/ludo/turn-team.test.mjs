// Pal Ludo: turn clock, AUTO and reward rule, team mode. Run: node tests/ludo/turn-team.test.mjs
import assert from 'node:assert/strict';
import * as L from '../../js/games/ludo-engine.js';
import * as T from '../../js/games/ludo-turn.js';
let pass = 0; const t = (name, f) => { f(); pass++; console.log('ok -', name); };

t('clock: 15 s to roll, 10 s to move, ticks in last 3 s, expires once', () => {
  let now = 0; const c = T.makeClock(() => now);
  assert.equal(T.ROLL_S, 15); assert.equal(T.MOVE_S, 10);
  c.arm('0r', T.ROLL_S); assert.equal(c.secs(), 15); assert.equal(c.frac(), 1);
  now = 7500; assert.equal(c.frac(), 0.5); assert.equal(c.tick(), false); assert.equal(c.expired(), false);
  c.arm('0r', T.ROLL_S); assert.equal(c.frac(), 0.5, 'same key does not restart');
  now = 12100; assert.equal(c.secs(), 3); assert.equal(c.tick(), true); assert.equal(c.tick(), false, 'one tick per second');
  now = 13100; assert.equal(c.tick(), true);
  now = 15000; assert.equal(c.expired(), true); assert.equal(c.expired(), false, 'fires once');
  c.arm('0m', T.MOVE_S); assert.equal(c.secs(), 10); now = 25000; assert.equal(c.expired(), true);
});

t('auto: a missed turn switches AUTO on; rewards withheld after any AUTO turn', () => {
  const a = T.makeAuto(); assert.equal(T.rewardsAllowed(a), true);
  a.miss(); assert.equal(a.on, true); a.played(); assert.equal(T.rewardsAllowed(a), false);
  a.set(false); assert.equal(T.rewardsAllowed(a), false, 'switching off later still means no rewards this game');
  const b = T.makeAuto(); b.set(true); assert.equal(T.rewardsAllowed(b), false, 'AUTO on at the end: no rewards');
  b.set(false); assert.equal(T.rewardsAllowed(b), true, 'toggled on and off without a turn played: still fine');
  assert.match(T.AUTO_NOTE, /No XP or rewards given while on AUTO/);
});

t('autoMove picks a legal token, -1 when none', () => {
  const st = L.newGame(4, [3, 0, 1, 2]);
  assert.equal(T.autoMove(st, 3), -1);
  const m = T.autoMove(st, 6); assert.ok(L.legal(st, 6).includes(m));
});

t('newGame: custom seat corners, You bottom-left', () => {
  const s2 = L.newGame(2, [3, 1]); assert.deepEqual(s2.cols, [3, 1]); assert.equal(s2.team, undefined);
  const s4 = L.newGame(4, [3, 0, 1, 2], true); assert.equal(s4.team, true); assert.equal(L.partnerOf(s4, 0), 2); assert.equal(L.partnerOf(s4, 1), 3);
  assert.equal(L.newGame(2, null, true).team, undefined, 'team only with 4 seats');
  assert.equal(L.COLOR_NAMES.length, 4);
});

const HOME = L.HOME;
t('team: partner cannot be captured, rivals can', () => {
  const st = L.newGame(4, [3, 0, 1, 2], true);
  // seat 0 (col 3) token at rel 2; partner seat 2 (col 1) sits on the square seat 0 lands on with a 3
  const target = L.absOf(3, 5);
  const relFor = (col) => (target - L.START[col] + 52) % 52;
  st.pos[0][0] = 2; st.pos[2][0] = relFor(1);
  if (!L.SAFE.has(target)) {
    const s1 = L.step(st, 3, 0); assert.equal(s1.pos[2][0], relFor(1), 'partner stays');
    const ff = L.newGame(4, [3, 0, 1, 2], false); ff.pos[0][0] = 2; ff.pos[2][0] = relFor(1);
    const s2 = L.step(ff, 3, 0); assert.equal(s2.pos[2][0], -1, 'free-for-all captures');
    const rv = L.newGame(4, [3, 0, 1, 2], true); rv.pos[0][0] = 2; rv.pos[1][0] = relFor(0);
    const s3 = L.step(rv, 3, 0); assert.equal(s3.pos[1][0], -1, 'rival captured in team mode');
  }
});

t('team win: one partner home is not a win; both home wins for the team', () => {
  const st = L.newGame(4, [3, 0, 1, 2], true);
  st.pos[0] = [HOME, HOME, HOME, 53];
  const s1 = L.step(st, 3, 3);
  assert.equal(s1.winner, -1, 'partner still racing');
  assert.equal(s1.turn, 1, 'turn passes on, no bonus for finishing');
  // finished seat 0 is skipped from now on
  let s = { ...s1, turn: 3 }; s.pos = s1.pos.map((x) => [...x]);
  s = L.step(s, 2, -1); assert.equal(s.turn, 1, 'seat 0 is skipped: 3 -> 1');
  // partner (seat 2) brings the last token home
  const s2 = { ...s1, turn: 2, pos: s1.pos.map((x) => [...x]) }; s2.pos[2] = [HOME, HOME, HOME, 54];
  const w = L.step(s2, 2, 3);
  assert.equal(w.winner, 2); assert.equal(w.winTeam, 0, 'team of seats 0+2 wins');
});

t('free for all still ends when one player gets home', () => {
  const st = L.newGame(4, [3, 0, 1, 2]); st.pos[1] = [HOME, HOME, HOME, 55]; st.turn = 1;
  const s = L.step(st, 1, 3); assert.equal(s.winner, 1); assert.equal(s.winTeam, undefined);
});

t('AI never targets its partner in team mode', () => {
  const st = L.newGame(4, [3, 0, 1, 2], true);
  const target = L.absOf(3, 6); st.pos[0] = [1, 2, -1, -1]; st.pos[2][0] = (target - L.START[1] + 52) % 52;
  for (const lvl of ['easy', 'medium', 'hard', 'expert']) { const m = L.aiPick(st, 4, lvl, () => 0.5); assert.ok(L.legal(st, 4).includes(m)); }
});

t('a full random team game ends with both partners home', () => {
  let rnd = 7; const R = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  let st = L.newGame(4, [3, 0, 1, 2], true), n = 0;
  while (st.winner < 0 && n++ < 20000) { const d = 1 + Math.floor(R() * 6); const mv = L.legal(st, d); st = L.step(st, d, mv.length ? L.aiPick(st, d, 'medium', R) : -1); }
  assert.ok(st.winner >= 0, 'game finished');
  const p = st.winner, mate = (p + 2) % 4;
  assert.ok(L.done(st, p) && L.done(st, mate)); assert.equal(st.winTeam, p % 2);
});
console.log(`\n${pass} passed`);
