// Pal Bingo room games: public halls are always normal bingo; a private room's pick rides in its seed.
// Run: node tests/bingo/room-game.test.mjs
import assert from 'node:assert/strict';
import { PICK_IDS, PICK_NAME, PATTERN_IDS, pickSeed, roomPick, roomPattern, patternFor, masksFor, ballsFor, roundSeed } from '../../js/bingo/logic.js';

assert.equal(PICK_IDS[0], 'line');
assert.equal(PICK_NAME.line, 'Normal bingo (any line)');
assert.ok(PICK_IDS.includes('mix'));
// public halls: any line, every round, whatever the seed
for (let r = 0; r < 30; r++) assert.equal(roomPattern({ pub: true, seed: 123456907 }, r), 'line');
// any line = 5 rows + 5 columns + 2 diagonals
const L = masksFor('line'); assert.equal(L.length, 12); L.forEach((m) => assert.equal(m.filter(Boolean).length, 5));
// private picks: every phone decodes the same pick, the seed stays inside the rules' 1..2e9 range
for (const id of PICK_IDS) {
  for (const rnd of [0, 1, 7.7, 999999, 1998999.9, 5e9]) {
    const seed = pickSeed(rnd, id);
    assert.ok(Number.isInteger(seed) && seed > 0 && seed <= 2000000000, `seed ${seed}`);
    const room = { pub: false, seed };
    assert.equal(roomPick(room), id);
    for (let r = 0; r < 14; r++) assert.equal(roomPattern(room, r), id === 'mix' ? patternFor(r) : id);
  }
}
// older private rooms (plain random seed) keep the old rotation
assert.equal(roomPick({ pub: false, seed: 123456 }), 'mix');
for (let r = 0; r < 7; r++) assert.equal(roomPattern({ pub: false, seed: 123456 }, r), PATTERN_IDS[r]);
// the pick doesn't break ball draws
const b = ballsFor(roundSeed(pickSeed(42, 'heart'), 3)); assert.equal(new Set(b).size, 75);
console.log('bingo room-game ok');
