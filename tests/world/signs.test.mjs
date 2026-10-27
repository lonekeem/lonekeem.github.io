// No sign in the road: every sign and sign post (Kemy Street name signs, the Loop Highway welcome sign, district banners,
// city welcome signs, For Sale signs, mailboxes, theater lot poles) has its whole footprint off every road, crossing and
// parking lot. Also checks the clearSpot / placeSign guard itself.
// usage: node tests/world/signs.test.mjs
import assert from 'node:assert/strict';
import { STREET_SIGNS, LOOP_SIGN, TOWNS, CITIES, HOUSES, THEATER, SIDEWALK, ROADS, segD, roadD, driveD, footClear, clearSpot, signFoot, bannerAt, saleSignAt, BANNER_FOOT, SALE_FOOT, streetLamps, offDrive } from '../../js/world/layout.js';

const fails = []; const check = (kind, x, z, foot) => { if (!footClear(x, z, foot, 0)) fails.push(`${kind} at ${x.toFixed(1)},${z.toFixed(1)} (driveD ${Math.min(...foot.map(([dx, dz, r]) => driveD(x + dx, z + dz) - r)).toFixed(2)})`); };
// Kemy Street name signs: off both roads, on a sidewalk (inside SIDEWALK of the nearest road)
for (const s of STREET_SIGNS) { check('street sign ' + s.t, s.x, s.z, s.foot); const near = Math.min(...ROADS.map((r) => segD(s.x, s.z, r) - r.w / 2)); assert.ok(near > 0 && near < SIDEWALK, s.t + ' stands on a sidewalk'); }
// the old spots were all inside intersections
for (const [x, z] of [[-61, 103], [61, 103], [3, 148], [-61, 142]]) { assert.ok(roadD(x, z) < 0, 'old spot was on a road'); assert.ok(!STREET_SIGNS.some((s) => Math.hypot(s.x - x, s.z - z) < 2), `no street sign left at ${x},${z}`); }
check('LOOP HIGHWAY sign', LOOP_SIGN.x, LOOP_SIGN.z, LOOP_SIGN.foot);
assert.equal(footClear(110, -6, LOOP_SIGN.foot, 0), false, 'the old Loop Highway sign spot (post in e0) is caught');
for (const t of TOWNS) if (t.gate) { const p = bannerAt(t); assert.ok(p, t.name + ' banner has a spot'); check('banner ' + t.name, p[0], p[1], BANNER_FOOT); }
for (const c of CITIES) check('welcome sign ' + c.name, c.x - c.hx - 4, c.z - c.hz + 12, signFoot(6, Math.PI / 4, [-2.1, 2.1], 0.1));
// For Sale signs + mailboxes. Plots whose own house footprint sits on a road are a layout problem (reported separately), skipped here.
const Lw = (h, lx, lz) => [h.x + (h.face > 0 ? lx : -lx), h.z + (h.face > 0 ? lz : -lz)];
const onRoad = (h) => roadD(h.x, h.z) < Math.max(h.w, h.d) / 2; const skipped = HOUSES.filter((h) => !h.admin && onRoad(h));
let sale = 0; for (const h of HOUSES) { if (h.admin || onRoad(h)) continue;
  if (h.sale) { const [x, z] = saleSignAt(h); check('sale sign ' + h.id, x, z, SALE_FOOT); sale++; }
  if (!h.estate && !h.sale && !h.city) { const [x, z] = Lw(h, 2.1, h.d / 2 + 4.8); check('mailbox ' + h.id, x, z, [[0, 0, 0.3]]); }
  if (h.city && !h.estate) { const [x, z] = Lw(h, -5.4, h.d / 2 + 6.8); check('mailbox ' + h.id, x, z, [[0, 0, 0.25]]); } }
// theater lot light poles stand outside the lot
const Lt = THEATER.lot; for (const [x, z] of [[Lt.x0 - 0.8, Lt.z0 - 0.8], [Lt.x0 - 0.8, Lt.z1 + 0.8], [Lt.x1 - 1.2, Lt.z0 - 1.6], [Lt.x1 - 1.2, Lt.z1 + 1.6]]) check('theater lot pole', x, z, [[0, 0, 0.2]]);
// street lamps now keep off the parking lots too (the a0 lamp used to stand in the patrol station lot)
for (const l of streetLamps()) assert.ok(offDrive(l.x, l.z), `lamp ${l.x.toFixed(1)},${l.z.toFixed(1)} off roads and lots`);
// the guard: a spot in the middle of an intersection is pushed to the nearest clear spot nearby
{ const f = signFoot(3.4, 0, [0], 0.08); const p = clearSpot(-64, 100, f); assert.ok(p && footClear(p[0], p[1], f, 0) && Math.hypot(p[0] + 64, p[1] - 100) < 12, 'clearSpot pushes a sign off a crossing'); assert.deepEqual(clearSpot(-57.6, 104.9, f), [-57.6, 104.9], 'a clear spot stays put'); }
assert.deepEqual(fails, [], 'signs on a road:\n' + fails.join('\n'));
console.log('signs ok:', STREET_SIGNS.length, 'street signs, loop sign,', TOWNS.filter((t) => t.gate).length, 'banners,', CITIES.length, 'city signs,', sale, 'sale signs; skipped', skipped.length, 'plots that sit on a road themselves (' + [...new Set(skipped.map((h) => h.city || h.town))].join(', ') + ')');
