// Palace sits on the old Maple Heights pad. Plot id stays h489. h483 is not a house.
// Run: node tests/world/palace-move.test.mjs
import assert from 'node:assert/strict';
import { HOUSES, HOUSE_BY_ID, ESTATES, ROADS, ROADS4, ADMIN_PLOT, ADMIN_HOME, ESTATE_IDS, palaceBays, PALACE_SIGN, PALACE_SIGN_AT, areaAt, roomOf } from '../../js/world/layout.js';
import { placedItems, scOf } from '../../js/world/interior.js';

const palace = HOUSE_BY_ID[ADMIN_PLOT];
assert.equal(palace.id, 'h489');
assert.equal(palace.x, -300);
assert.equal(palace.z, 18);
assert.equal(palace.face, 1);
assert.equal(palace.style, 4);
assert.equal(palace.w, 18);
assert.equal(palace.d, 14);
assert.equal(palace.admin, 1);
assert.equal(palace.sale, false);
assert.equal(palace.spot, '👑 Kemy Palace');
assert.equal(palace.door.z, 18 + 7.02);
assert.equal(ADMIN_HOME.lot, undefined);
assert.equal(PALACE_SIGN, '👑 Kemy Palace');

assert.equal(HOUSES.some((h) => h.id === 'h483'), false, 'Maple Heights is not a separate house');
const kept = {
  h484: { x: -820, z: 18, style: 5 },
  h485: { x: -440, z: 604, style: 4 },
  h486: { x: -280, z: 604, style: 5 },
  h487: { x: -1100, z: 1222, style: 4 },
  h488: { x: 342, z: 852, style: 5 }
};
for (const [id, want] of Object.entries(kept)) {
  const h = HOUSE_BY_ID[id];
  assert.ok(h, id);
  assert.equal(h.x, want.x, id);
  assert.equal(h.z, want.z, id);
  assert.equal(h.style, want.style, id);
  assert.equal(h.sale, true, id);
}
assert.deepEqual(ESTATE_IDS, ['h483', 'h484', 'h485', 'h486', 'h487', 'h488', 'h489']);
assert.equal(ESTATE_IDS.indexOf('h489'), 6);
assert.deepEqual(roomOf(palace), roomOf({ id: 'h489', estate: 1 }));
assert.equal(ESTATES[0].skip, 1);
assert.equal(ESTATES.filter((e) => e.id).length, 5);

assert.equal(ROADS4.some((r) => r.id === 'a1'), false, 'the old palace drive is gone');
assert.ok(ROADS.some((r) => r.id === 'a1' && r.a[0] === -64), 'Kemy Street stays');
assert.equal(HOUSES.some((h) => h.x === -190 && h.z === 1220), false);
assert.equal(areaAt(-300, 18), '👑 Kemy Palace');
assert.equal(areaAt(-190, 1220), '🌲 Countryside');

const bays = palaceBays();
assert.equal(bays.length, 50);
const fountain = { x: -14, z: 20.5, r: 3 };
for (const b of bays) {
  assert.ok(Math.abs(b.x) + 2.4 < 33, 'inside the fence');
  assert.ok(b.z > 12 && b.z < 31, 'on the front pad');
  assert.ok(Math.hypot(b.x - fountain.x, b.z - fountain.z) > fountain.r + 2.2, 'clear of the fountain');
  assert.ok(!(Math.abs(b.x) < 6 && b.z < 12), 'clear of the porch');
}
assert.equal(bays.some((b) => Math.abs(b.x) < 4), false, 'centre aisle stays empty');
assert.ok(Math.abs(PALACE_SIGN_AT.x) < 1 && PALACE_SIGN_AT.z > 31 && PALACE_SIGN_AT.z < 33);
assert.ok(bays.every((b) => Math.hypot(b.x - PALACE_SIGN_AT.x, b.z - PALACE_SIGN_AT.z) > 2.5));

assert.equal(scOf(palace), 2.1);
const items = placedItems({ items: 'bd,12,12,0' }, palace, true);
assert.equal(items.length, 1);
assert.ok(Math.abs(items[0].x) <= 5.4 && Math.abs(items[0].z) <= 5.4);
const street = HOUSES.find((h) => !h.admin && !h.estate);
const loose = placedItems({ items: 'bd,12,0,0' }, street, false);
assert.equal(loose[0].x, 6, 'other houses keep a saved spot at the wall');

console.log('palace move tests ok', bays.length, 'bays');
