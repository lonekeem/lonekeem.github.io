// Landscape lock is only for Pal Park and Kemy Street, and a failed lock never traps fullscreen.
// Run: node tests/world/orient.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldOrient, isWorldHash, needsTurnHint, TURN_HINT } from '../../js/world-orient.js';

assert.equal(isWorldHash('#/park'), true);
assert.equal(isWorldHash('#/street'), true);
assert.equal(isWorldHash('#/feed'), false);
assert.equal(isWorldHash('#/games/chess'), false);
assert.equal(isWorldHash('#/arcade/bingo'), false);
assert.equal(needsTurnHint(false, true), true);
assert.equal(needsTurnHint(true, true), false);
assert.equal(needsTurnHint(false, false), false);
assert.equal(TURN_HINT, 'Turn your phone sideways for the best view');

function fake({ lockable = true, alreadyFs = false, lockError = null } = {}) {
  const calls = [];
  let fs = alreadyFs;
  const io = {
    orientation: lockable ? {
      lock: async (mode) => { calls.push('lock:' + mode); if (lockError) throw lockError; },
      unlock: () => { calls.push('unlock'); }
    } : {},
    get fullscreenElement() { return fs ? {} : null; },
    get webkitFullscreenElement() { return null; },
    requestFullscreen: async () => { calls.push('fs'); fs = true; },
    exitFullscreen: async () => { calls.push('exit'); fs = false; }
  };
  return { io, calls, get fs() { return fs; } };
}

const held = fake({ alreadyFs: true });
const a = createWorldOrient(held.io);
await a.enter();
assert.deepEqual(held.calls, ['lock:landscape']);
assert.equal(a.leave('#/street').stayed, true);
assert.equal(held.calls.includes('unlock'), false, 'park to street stays landscape');
const left = a.leave('#/feed');
assert.equal(left.unlocked, true);
assert.equal(left.exited, false, 'a fullscreen we did not open stays open');
assert.deepEqual(held.calls, ['lock:landscape', 'unlock']);

const fresh = fake();
const b = createWorldOrient(fresh.io);
await b.enter();
assert.deepEqual(fresh.calls, ['fs', 'lock:landscape']);
const out = b.leave('#/watch');
assert.equal(out.exited, true);
assert.ok(fresh.calls.includes('exit'));

const broken = fake({ lockError: new Error('no') });
const c = createWorldOrient(broken.io);
assert.equal(await c.enter(), false);
assert.ok(broken.calls.includes('exit'), 'a lock failure leaves fullscreen if we opened it');
assert.equal(c.heldFullscreen, false);

const iphone = fake({ lockable: false });
const d = createWorldOrient(iphone.io);
assert.equal(await d.enter(), false);
assert.deepEqual(iphone.calls, [], 'no lock API means no fullscreen and no throw');

let release;
const gate = new Promise((r) => { release = r; });
const raced = [];
let fs2 = false;
const race = createWorldOrient({
  orientation: { lock: async () => { raced.push('lock'); await gate; raced.push('locked'); }, unlock: () => raced.push('unlock') },
  get fullscreenElement() { return fs2 ? {} : null; },
  requestFullscreen: async () => { raced.push('fs'); fs2 = true; },
  exitFullscreen: async () => { raced.push('exit'); fs2 = false; }
});
const first = race.enter();
const second = race.enter();
release();
await first; await second;
assert.equal(raced.includes('unlock'), false, 'the tap and the scene start do not unlock each other');
assert.ok(raced.includes('locked'));

const manifest = readFileSync(new URL('../../manifest.webmanifest', import.meta.url), 'utf8');
assert.match(manifest, /"orientation": "any"/);
const park = readFileSync(new URL('../../js/pals/park3d.js', import.meta.url), 'utf8');
assert.match(park, /enterWorldLandscape\(\)/);
assert.match(park, /leaveWorldLandscape\(\)/);
assert.match(park, /bindWorldTurnHint/);
const rush = readFileSync(new URL('../../js/rush/game.js', import.meta.url), 'utf8');
assert.equal(rush.includes('enterWorldLandscape'), false);
const bingo = readFileSync(new URL('../../js/bingo/bingo.js', import.meta.url), 'utf8');
assert.equal(bingo.includes('enterWorldLandscape'), false);

console.log('PASS world orient');
