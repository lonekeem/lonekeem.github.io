// Extra colors on the existing free Beanie. Ids, hexes and order of the original
// pink / navy / mint beanies stay put so saved looks still resolve.
// Run: node tests/pals/beanie-colors.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEAR, WEAR_BY } from '../../js/pals/wardrobe.js';

const FREE = /^f_[a-z0-9_]{1,13}$/;
const beanies = WEAR.filter((w) => w.st === 'beanie' && String(w.id).startsWith('f_beanie'));
const ids = beanies.map((w) => w.id);

const kept = {
  f_beanie_pink: ['#f4a6c4', 'Pink Beanie'],
  f_beanie_navy: ['#2f3d6e', 'Navy Beanie'],
  f_beanie_mint: ['#9fdcc6', 'Mint Beanie'],
};
const added = {
  f_beanie_black: ['#34303f', 'Midnight Beanie'],
  f_beanie_white: ['#f7f3ee', 'White Beanie'],
  f_beanie_red: ['#d9505c', 'Red Beanie'],
  f_beanie_blue: ['#6f9fe0', 'Blue Beanie'],
  f_beanie_green: ['#6bb48a', 'Green Beanie'],
};

assert.deepEqual(ids, [...Object.keys(kept), ...Object.keys(added)], 'original beanies stay first; only the new colors follow');
for (const [id, [col, name]] of Object.entries({ ...kept, ...added })) {
  const w = WEAR_BY[id];
  assert.ok(w, id);
  assert.equal(w.id, id);
  assert.equal(w.col, col, id);
  assert.equal(w.name, name, id);
  assert.equal(w.slot, 'head', id);
  assert.equal(w.st, 'beanie', id);
  assert.equal(w.free, true, id);
  assert.equal(w.p, 0, id);
  assert.equal(w.hidden, undefined, id);
  assert.equal(w.id.length <= 15, true, id);
  assert.match(w.id, FREE, id);
}
assert.equal(new Set(ids).size, ids.length, 'beanie ids do not collide after the 15-character cut');
assert.equal(WEAR_BY.f_cap_black.name, 'Midnight Cap', 'the shared black swatch name is unchanged on other items');
assert.equal(WEAR_BY.f_hoodie_black.col, '#34303f');
assert.match(readFileSync(new URL('../../sw.js', import.meta.url), 'utf8'), /const CACHE = 'lks-v284'/);

console.log('PASS beanie colors', ids.join(' '));
