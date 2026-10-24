import assert from 'node:assert/strict';
import { itemAabb, rayHitAabb, pickIndex, nearestReach, nudgePlan, screenStep, xzGap, stashOnRemove } from '../../js/world/decorate.js';
import { defaultItems, parseItems, placedItems, packLayout, unpackStash, serItems, parseFloors, serFloors, healItems } from '../../js/world/interior.js';
import { itemRoom, clampToRoom, roomsFor } from '../../js/world/roomedit.js';

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
assert.equal(bed.x, 4.5);
assert.equal(bed.z, -4.05);
nudgePlan(bed, 0.5, 0);
assert.equal(bed.x, 4.5, 'a bed foot stays inside the room');

const step = screenStep(1, 0, { fx: 0, fz: 1, rx: 1, rz: 0 });
assert.deepEqual(step, { dx: 0.5, dz: 0 });
const away = screenStep(0, -1, { fx: 0, fz: 1, rx: 1, rz: 0 });
assert.deepEqual(away, { dx: 0, dz: 0.5 });

const starters = parseItems(defaultItems(true, 0));
assert.equal(starters.length, defaultItems(true, 0).split(';').length, 'every starter piece loads, including ones on the wall');
assert.ok(starters.some((it) => it.c === 'ar' && it.x === 6));
assert.ok(starters.some((it) => it.c === 'bk' && it.f === 1), 'the bunk that comes with a two-story house is a real piece');
assert.equal(placedItems({ items: '' }, { seed: 0 }, true).length, 0, 'a saved empty room stays empty');
assert.equal(placedItems({}, { seed: 0 }, true).length, starters.length, 'a house with no save still has its starter set');
const oneLess = starters.filter((it) => it.c !== 'cs');
assert.equal(placedItems({ items: serItems(oneLess) }, { seed: 0 }, true).some((it) => it.c === 'cs'), false, 'a removed starter stays removed');

const stash = [];
stashOnRemove('bk', { bk: 1, cs: 1 }, 0, stash);
assert.deepEqual(stash, ['bk'], 'a starter bunk goes into storage');
stashOnRemove('bk', { bk: 1 }, 0, stash);
assert.deepEqual(stash, ['bk'], 'storage does not duplicate the same starter');
stashOnRemove('cs', { cs: 1 }, 1, stash);
assert.deepEqual(stash, ['bk'], 'an extra copy is not stored on top of the one still in the room');
const packed = packLayout(oneLess, ['cs', 'bk']);
assert.equal(placedItems({ items: packed }, { seed: 0 }, true).some((it) => it.c === 'cs'), false);
assert.deepEqual(unpackStash(packed), ['cs', 'bk']);
assert.deepEqual(unpackStash(''), []);

assert.equal(serItems(parseItems(defaultItems(true, 0))), defaultItems(true, 0), 'starter furniture still saves the old way');
const tinted = parseItems('cs,-4,10,2,#7c3aed;bk,9,-9,0,1,#f9a8d4');
assert.equal(tinted[0].col, '#7c3aed');
assert.equal(tinted[0].f, 0);
assert.equal(tinted[1].f, 1);
assert.equal(tinted[1].col, '#f9a8d4');
assert.equal(serItems(tinted), 'cs,-4,10,2,#7c3aed;bk,9,-9,0,1,#f9a8d4');
const healed = healItems('cs,-4,10,2,#7C3AED;nope,1,1,0', false);
assert.equal(healed.items[0].col, '#7c3aed');
assert.equal(healed.items.length, 1);
assert.equal(healed.changed, true);
assert.match(healed.packed, /#7c3aed/);

assert.equal(itemRoom(-3, 2, 0), 'L');
assert.equal(itemRoom(-3, -3, 0), 'K');
assert.equal(itemRoom(3, -2, 0), 'B');
assert.equal(itemRoom(3, 2, 0), 'T');
assert.equal(itemRoom(0, 1, 0), 'H');
assert.equal(itemRoom(3, -2, 1), 'U');
assert.equal(roomsFor(false).some((r) => r.id === 'U'), false);
assert.equal(roomsFor(true).some((r) => r.id === 'U'), true);
const moved = { c: 'cs', x: 0, z: 0, r: 0, f: 0 };
clampToRoom(moved, 'L');
assert.equal(itemRoom(moved.x, moved.z, moved.f), 'L');
assert.ok(moved.x < -1, 'a sofa stays in the living room');
const floors = serFloors({ L: '#aabbcc', cL: '#ffffff', nope: 'red', K: 'blue' });
assert.equal(floors, 'L:#aabbcc,cL:#ffffff');
assert.deepEqual(parseFloors(floors), { L: '#aabbcc', cL: '#ffffff' });
assert.equal(serFloors({}), '');

console.log('decorate tests ok');
