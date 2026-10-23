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
assert.equal(bays.length, 24);
const e1 = ROADS4.find((r) => r.id === 'e1');
assert.equal(e1.b[1], 55.2, 'estate road stops where the palace lip starts');
assert.equal(e1.w, 6);
const HALF_L = 2.5, HALF_W = 1.05;
const extOf = (b) => { const s = Math.abs(Math.sin(b.yaw)), c = Math.abs(Math.cos(b.yaw)); return { hx: s * HALF_L + c * HALF_W, hz: c * HALF_L + s * HALF_W }; };
const bodyOf = (b) => { const e = extOf(b); return { x0: b.x - e.hx, x1: b.x + e.hx, z0: b.z - e.hz, z1: b.z + e.hz }; };
for (const b of bays) {
  assert.ok(Math.abs(b.x) + 2.5 < 33.2, 'inside the fence');
  assert.ok(b.z > 12 && b.z + 1.1 < 32.2, 'on the front pad, clear of the gate');
  assert.ok(Math.abs(b.x) >= 12, 'centre lane stays empty');
  assert.ok(Math.abs(Math.abs(b.yaw) - Math.PI / 2) < 1e-9, 'nose points across an aisle');
  assert.ok(bays.some((o) => o !== b && o.x === -b.x && o.z === b.z && o.yaw === -b.yaw), 'layout is symmetric');
}
assert.equal(bays.some((b) => Math.abs(b.x) < 12), false, 'centre lane stays empty');
assert.ok(Math.abs(PALACE_SIGN_AT.x) < 1 && PALACE_SIGN_AT.z > 31 && PALACE_SIGN_AT.z < 33);
assert.ok(bays.every((b) => Math.hypot(b.x - PALACE_SIGN_AT.x, b.z - PALACE_SIGN_AT.z) > 2.5));
for (let i = 0; i < bays.length; i++) {
  const a = bodyOf(bays[i]);
  const dir = bays[i].yaw > 0 ? 1 : -1;
  const noseX = bays[i].x + dir * (HALF_L + 2.2);
  for (let j = 0; j < bays.length; j++) {
    if (i === j) continue;
    const o = bodyOf(bays[j]);
    const overlap = Math.min(a.x1, o.x1) > Math.max(a.x0, o.x0) && Math.min(a.z1, o.z1) > Math.max(a.z0, o.z0);
    assert.equal(overlap, false, 'parked bodies overlap');
    const probeIn = noseX > o.x0 && noseX < o.x1 && bays[i].z > o.z0 && bays[i].z < o.z1;
    assert.equal(probeIn, false, 'the pull-out in front of the nose hits another car');
    const aisle = Math.min(noseX + 1.3, o.x1) > Math.max(noseX - 1.3, o.x0) && Math.min(34, o.z1) > Math.max(bays[i].z, o.z0);
    assert.equal(aisle, false, 'the aisle to the gate is blocked');
  }
}

assert.equal(scOf(palace), 2.1);
const items = placedItems({ items: 'bd,12,12,0' }, palace, true);
assert.equal(items.length, 1);
assert.ok(Math.abs(items[0].x) <= 5.4 && Math.abs(items[0].z) <= 5.4);
const wall = placedItems({ items: 'ar,12,0,0' }, palace, true);
assert.equal(wall.length, 1);
assert.equal(wall[0].x, 5.4, 'palace wall art is pulled inside the room');
const street = HOUSES.find((h) => !h.admin && !h.estate);
const loose = placedItems({ items: 'ar,12,0,0' }, street, false);
assert.equal(loose[0].x, 6, 'other houses keep wall art at the wall');

console.log('palace move tests ok', bays.length, 'bays');
