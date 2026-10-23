// Mansions and the admin palace expose the same outside-paint parts as a sale house.
// Run: node tests/world/estate-paint.test.mjs
import assert from 'node:assert/strict';
import { HOUSES, ADMIN_PLOT } from '../../js/world/layout.js';
import { tagEstateShell, applyExt, forgetTagged } from '../../js/world/cities.js';

const palace = HOUSES.find((h) => h.id === ADMIN_PLOT);
const manor = HOUSES.find((h) => h.estate && !h.admin && h.style === 4);
const big = HOUSES.find((h) => h.estate && !h.admin && h.style === 5);
assert.ok(palace && palace.admin && !palace.sale, 'the palace is an estate and not for sale');
assert.ok(manor && big);

function parts(h) {
  const out = [];
  tagEstateShell(h, '#fff', '#000', '#ccc', (part, batch) => out.push(part + ':' + batch));
  return out;
}
function count(list, part) { return list.filter((s) => s.startsWith(part + ':')).length; }

for (const h of [palace, manor, big]) {
  const p = parts(h);
  assert.ok(count(p, 'w') >= 3, h.id + ' body and both wings');
  assert.ok(count(p, 'r') >= 3, h.id + ' main roof and wing roofs');
  assert.ok(count(p, 't') >= 7, h.id + ' columns and trim');
  assert.equal(count(p, 'd'), 1, h.id + ' has one front door');
  assert.ok(!p.some((s) => s.endsWith(':road') || s.endsWith(':leaf')), h.id + ' lawn and hedges stay untagged');
}
assert.equal(palace.style, 4, 'the palace is the mansion mesh');
assert.equal(palace.w, 18);
assert.equal(palace.d, 14);
assert.equal(count(parts(palace), 'w'), count(parts(manor), 'w'), 'the palace uses the mansion shell');
assert.ok(count(parts(big), 'w') > count(parts(manor), 'w'), 'style 5 still has the tower');

const mesh = { id: 'shell' };
const tagged = new Map([
  [ADMIN_PLOT + '|w', [{ m: mesh, orig: [1, 0.9, 0.8] }]],
  [ADMIN_PLOT + '|d', [{ m: mesh, orig: [0.4, 0.1, 0.05] }]],
  ['h04|w', [{ m: { id: 'street' }, orig: [0, 0, 0] }]]
]);
const seen = [];
applyExt(tagged, ADMIN_PLOT, { w: '#22c55e', r: '', d: '#2563eb', t: '' }, (R, want) => seen.push([R.m.id, want, R.orig[0]]));
assert.deepEqual(seen, [['shell', '#22c55e', 1], ['shell', '#2563eb', 0.4]]);
seen.length = 0;
applyExt(tagged, ADMIN_PLOT, { w: '', r: '', d: '', t: '' }, (R, want) => seen.push(want));
assert.deepEqual(seen, [null, null], 'reset restores the built-in colours');

forgetTagged(tagged, [mesh]);
assert.equal(tagged.has(ADMIN_PLOT + '|w'), false);
assert.equal(tagged.has(ADMIN_PLOT + '|d'), false);
assert.equal(tagged.has('h04|w'), true, 'another house keeps its tags');

console.log('estate paint tests ok');
