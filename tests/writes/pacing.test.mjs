// Write pacing, quiet retries, follow queue and Ludo queue ids. Run: node --test tests/writes/pacing.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { laneFor, createPacer, retryable, RATE_FIELDS } from '../../js/fsq-plan.js';
import { followDelay, SPAM } from '../../js/spam.js';

test('lanes mirror the rules gaps', () => {
  assert.deepEqual(laneFor('users/u1', ['bio']), []);
  assert.deepEqual(laneFor('users/u1', ['lastPostAt', 'postsToday']).map((l) => l.key), ['users/u1#lastPostAt']);
  for (const [f, secs] of Object.entries({ lastPostAt: 20, lastCommentAt: 5, lastMessageAt: 1, lastFollowAt: 2, lastNewChatAt: 8 })) assert.ok(RATE_FIELDS[f] > secs * 1000 && RATE_FIELDS[f] < secs * 1000 + 1000, f);
  assert.equal(laneFor('users/u1/pets/p1', ['xp'])[0].gap, 1200);
  assert.equal(laneFor('bingoRooms/hall/seats/u1', ['n']).length, 1);
  assert.deepEqual(laneFor('posts/*', ['text']), []);
  assert.deepEqual(laneFor('parkRooms/a/p/u1', ['x']), [], 'live presence is never queued');
  assert.ok(retryable({ code: 'permission-denied' })); assert.ok(!retryable({ code: 'not-found' }));
});

test('rapid writes on one lane are spaced by the gap, none refused', async () => {
  const run = createPacer({}, [20, 40]);
  const times = []; const t0 = Date.now();
  await Promise.all([1, 2, 3].map(() => run([{ key: 'k', gap: 60 }], async () => { times.push(Date.now() - t0); })));
  assert.equal(times.length, 3);
  assert.ok(times[1] - times[0] >= 55 && times[2] - times[1] >= 55, JSON.stringify(times));
});

test('a server "no" inside the gap is retried quietly until it lands', async () => {
  const stats = {}; const run = createPacer(stats, [10, 10, 10]);
  let n = 0;
  const r = await run([{ key: 'p', gap: 15 }], async () => { if (++n < 3) throw Object.assign(new Error('x'), { code: 'permission-denied' }); return 'ok'; });
  assert.equal(r, 'ok'); assert.equal(n, 3); assert.equal(stats.retried, 2);
});

test('a real, final no still reaches the caller after a few tries (no endless loop)', async () => {
  const run = createPacer({}, [5, 5]);
  let n = 0;
  await assert.rejects(run([{ key: 'q', gap: 1 }], async () => { n++; throw Object.assign(new Error('x'), { code: 'permission-denied' }); }));
  assert.equal(n, 3);
  n = 0; await assert.rejects(run([{ key: 'q', gap: 1 }], async () => { n++; throw Object.assign(new Error('x'), { code: 'invalid-argument' }); }));
  assert.equal(n, 1, 'non-timing errors are not retried');
});

test('unpaced writes go straight through', async () => {
  const run = createPacer({});
  assert.equal(await run([], async () => 7), 7);
});

test('follow bursts wait instead of being refused', () => {
  const t = 100000;
  assert.equal(followDelay([], t), 0);
  const five = [t - 5000, t - 4000, t - 3000, t - 2000, t - 1000];
  assert.equal(followDelay(five, t), 0);
  const six = [t - 6000, ...five];
  const w = followDelay(six, t); assert.ok(w > 0 && w <= SPAM.follows[0].ms, String(w));
});

test('Ludo / chess quick-match queue ids satisfy the rules (no digits)', () => {
  const src = readFileSync('js/games/net.js', 'utf8');
  const fn = src.match(/const DIGIT_WORDS = [^\n]+\n[^\n]*\n(export function queueIdOf[\s\S]*?\n}\n)/);
  assert.ok(fn, 'queueIdOf found');
  const queueIdOf = new Function('DIGIT_WORDS', fn[1].replace('export ', '') + 'return queueIdOf;')(['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);
  const re = /^[a-z-]{3,30}$/;
  for (const raw of ['ludo-2', 'ludo-3', 'ludo-4', 'chess-5', 'chess-10', 'stardrop', 'checkers-fast', 'pool']) assert.match(queueIdOf(raw), re, raw);
  assert.equal(queueIdOf('ludo-2'), 'ludo-two'); assert.equal(queueIdOf('chess-10'), 'chess-onezero');
  assert.notEqual(queueIdOf('ludo-2'), queueIdOf('ludo-4'));
  const rule = readFileSync('firestore.rules', 'utf8'); assert.ok(rule.includes("qid.matches('^[a-z-]{3,30}$')"));
});

// -0 is written as a double -0.0 and fails `is int` rules (idle players vanished); fsq fixes it on every write
{
  const { noNegZero } = await import('../../js/fsq-plan.js');
  const ts = { toMillis() { return 1; } }; const o = { vx: 3, vz: -0, a: [1, -0], m: { h: -0 }, at: ts };
  const n = noNegZero(o);
  assert.ok(Object.is(n.vz, 0) && Object.is(n.a[1], 0) && Object.is(n.m.h, 0), 'every -0 becomes 0');
  assert.equal(n.at, ts, 'sentinels / class instances are passed through untouched');
  assert.ok(Object.is(o.vz, -0), 'the caller object is not mutated');
  const clean = { x: 1, p: { y: 2 } }; assert.equal(noNegZero(clean), clean, 'no copy when nothing to fix');
  console.log('noNegZero ok');
}
