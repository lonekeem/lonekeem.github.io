// Free world dances: original names, short presence ids, poses on the Pal rig.
// Run: node tests/pals/dance-menu.test.mjs
import assert from 'node:assert/strict';
import { WORLD_DANCES, worldDanceReady } from '../../js/pals/dance-menu.js';
import { clipFor, has3D } from '../../js/pals/dances3d.js';

const banned = /\b(moonwalk|floss|griddy|dab)\b/i;
assert.ok(WORLD_DANCES.length >= 12);
assert.equal(worldDanceReady(), true);
const ids = new Set();
for (const d of WORLD_DANCES) {
  assert.equal(ids.has(d.id), false, d.id);
  ids.add(d.id);
  assert.ok(d.id.length >= 1 && d.id.length <= 20, d.id);
  assert.equal(has3D(d.id), true, d.id);
  assert.equal(banned.test(d.id + ' ' + d.name), false, d.name);
  assert.ok(d.icon && d.name);
  const pose = clipFor(d.id)(0.4);
  assert.ok(Array.isArray(pose.aL) && pose.aL.length >= 3, d.id);
  assert.ok(Array.isArray(pose.aR) && pose.aR.length >= 3, d.id);
}
const a = clipFor('armswing')(0.1);
const b = clipFor('armswing')(1.1);
assert.notEqual(a.aL[0], b.aL[0]);
console.log('dance menu tests ok', WORLD_DANCES.length);
