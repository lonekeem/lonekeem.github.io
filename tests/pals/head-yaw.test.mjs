// The head must not spin the long way around when Kemy Street (or any game) first poses a Pal.
// Run: node tests/pals/head-yaw.test.mjs
import assert from 'node:assert/strict';
import { angDelta, stepAngle } from '../../js/pals/pal3d.js';

const almostTurn = Math.PI * 2 - 0.15;
assert.ok(Math.abs(angDelta(0, almostTurn) + 0.15) < 1e-9, 'a hair under a full turn is a small step back, not a spin');
assert.ok(Math.abs(stepAngle(0, Math.PI * 1.5, 1) + Math.PI / 2) < 1e-9, '270 degrees takes the 90-degree short way');
assert.equal(stepAngle(0, 3, 0.1, true), 3, 'the first frame snaps to the facing');
assert.ok(Math.abs(stepAngle(0, 0.4, 0.5) - 0.2) < 1e-9, 'a small look still eases');

// What the old lerp did on load: start at 0 and walk toward a wrapped angle. That is a full spin.
let long = 0;
for (let i = 0; i < 24; i++) long += (almostTurn - long) * 0.35;
assert.ok(long > 5, 'the old lerp travels almost a full circle');

// The new path snaps, then only takes short steps, and is already facing the right way.
let yaw = stepAngle(0, almostTurn, 0.35, true);
let biggest = 0;
for (let i = 0; i < 24; i++) {
  const next = stepAngle(yaw, almostTurn, 0.35);
  biggest = Math.max(biggest, Math.abs(angDelta(yaw, next)));
  yaw = next;
}
assert.ok(Math.abs(angDelta(yaw, almostTurn)) < 1e-6, 'it settles on the target facing');
assert.ok(biggest < 0.2, 'no frame turns more than a small look');
assert.ok(Math.abs(angDelta(0, yaw)) < 0.2, 'the head never travels the long way around');

console.log('PASS head yaw');
