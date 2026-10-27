// No pole on the road: every Kemy Street lamp, the theater lot lights and the default theater outdoor lamps stand fully off
// every road / crossing (their footprint clears the asphalt), and lamps stay on the sidewalk next to their own street.
// usage: node tests/world/poles.test.mjs
import assert from 'node:assert/strict';
import { streetLamps, roadD, segD, ROADS, SIDEWALK, THEATER, POLE_R, poleClear } from '../../js/world/layout.js';

const lamps = streetLamps();
assert.ok(lamps.length >= 24, 'Kemy Street still has its lamps (' + lamps.length + ')');
for (const l of lamps) {
  assert.ok(roadD(l.x, l.z) >= POLE_R, `lamp at ${l.x.toFixed(1)},${l.z.toFixed(1)} is on a road (roadD ${roadD(l.x, l.z).toFixed(2)})`);
  const r = ROADS.find((q) => q.id === l.road); const d = segD(l.x, l.z, r) - r.w / 2;
  assert.ok(d > 0 && d < SIDEWALK, `lamp at ${l.x.toFixed(1)},${l.z.toFixed(1)} stays on the ${l.road} sidewalk`);
  for (const o of lamps) if (o !== l) assert.ok(Math.hypot(o.x - l.x, o.z - l.z) >= 9, 'lamps keep their spacing');
}
// the four spots that used to sit in the cross streets (a0, a1, a2) and on country road pa
for (const [x, z] of [[-1, 104.6], [-67, 140.4], [65, 140.4], [87, 149.6]]) assert.ok(!lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 0.5), `no lamp left at ${x},${z}`);
// theater parking-lot light poles (theater-build.js) + default outdoor lamps (theater.js DEF_LO, origin x1 + 2, door z)
const Lt = THEATER.lot; for (const [x, z] of [[Lt.x0 - 0.8, Lt.z0 - 0.8], [Lt.x0 - 0.8, Lt.z1 + 0.8], [Lt.x1 - 1.2, Lt.z0 - 1.6], [Lt.x1 - 1.2, Lt.z1 + 1.6]]) assert.ok(poleClear(x, z), `lot pole ${x},${z} is off the road`);
for (const [x, z] of [[1.5, -13], [1.5, 13], [1.5, -21], [1.5, 21]]) assert.ok(poleClear(THEATER.x1 + 2 + x, THEATER.door[1] + z), 'theater lamp off the road');
assert.equal(poleClear(91, 200), false, 'a spot on country road pa is not clear');
console.log('poles ok:', lamps.length, 'street lamps,', lamps.filter((l) => l.moved).length, 'slid off a crossing');
