import assert from 'node:assert/strict';
import { itemAabb, rayHitAabb, pickIndex, nearestReach, nudgePlan, screenStep, xzGap } from '../../js/world/decorate.js';

const sofa = { c: 'cs', x: 0, z: 0, r: 0, f: 0 };
const box = itemAabb(sofa, 1.4, 100, 200, 2.4);
assert.ok(box.x1 - box.x0 > 3, 'sofa is wide');
assert.ok(box.y1 > 2.4, 'sofa rises off the floor');

const down = { x: 0, y: -1, z: 0 };
const above = { x: (box.x0 + box.x1) / 2, y: 8, z: (box.z0 + box.z1) / 2 };
assert.ok(rayHitAabb(above, down, box) > 0, 'a ray from above hits the sofa');
assert.equal(rayHitAabb({ x: box.x1 + 3, y: 8, z: above.z }, down, box), null);

const items = [sofa, { c: 'lp', x: 4, z: 0, r: 0, f: 0 }];
const aabb = (it) => itemAabb(it, 1.4, 100, 200, 2.4);
const hit = pickIndex(items, { x: 100 + 4 * 1.4, y: 6, z: 200 }, down, aabb);
assert.equal(hit, 1, 'the lamp is the piece under that ray');

const beside = { x: box.x1 + 0.5, z: (box.z0 + box.z1) / 2 };
assert.ok(xzGap(beside.x, beside.z, box) < 1.25);
assert.equal(nearestReach(items, beside.x, beside.z, aabb, 1.25), 0);
assert.equal(nearestReach(items, box.x0 - 6, beside.z, aabb, 1.25), -1, 'too far to count as standing next to it');

const bed = { c: 'bd', x: 5.4, z: -5.4, r: 0 };
nudgePlan(bed, 0.5, -0.5);
assert.equal(bed.x, 5.5);
assert.equal(bed.z, -5.5);
nudgePlan(bed, 0.5, 0);
assert.equal(bed.x, 5.5, 'nudge stays inside the room');

const step = screenStep(1, 0, { fx: 0, fz: 1, rx: 1, rz: 0 });
assert.deepEqual(step, { dx: 0.5, dz: 0 });
const away = screenStep(0, -1, { fx: 0, fz: 1, rx: 1, rz: 0 });
assert.deepEqual(away, { dx: 0, dz: 0.5 });

console.log('decorate tests ok');
