// Goo shots are green drops. Only the Star Cannon keeps a star.
// Run: node tests/pals/shot-fx.test.mjs
import assert from 'node:assert/strict';
import { WEAPON_LIST } from '../../js/pals/zombie-weapons.js';
import { FX_SHAPES, GOO_COLORS, fxIndex, shotColors, shotFx } from '../../js/pals/shot-fx.js';

const byId = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, w]));
assert.equal(shotFx(byId.goo), 'drop');
assert.equal(shotFx(byId.glue), 'drop');
assert.equal(shotFx(byId.star), 'star');
assert.notEqual(fxIndex('drop'), fxIndex('star'));

for (const w of WEAPON_LIST) {
  const shape = shotFx(w);
  assert.ok(FX_SHAPES.includes(shape), w.id + ' ' + shape);
  if (w.id !== 'star') assert.notEqual(shape, 'star', w.name + ' must not use the star particle');
}

const green = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return g > r + 30 && g > b + 30;
};
assert.ok(shotColors(byId.goo).every(green), 'goo particles stay green');
assert.ok(shotColors(byId.glue).every(green));
assert.equal(shotColors(byId.pop), null);
assert.deepEqual(shotColors(byId.goo), GOO_COLORS);
assert.equal(shotFx(null), 'blob');
assert.equal(shotFx(byId.bubble), 'puff');
assert.equal(shotFx(byId.rocket), 'chip');
assert.equal(shotFx(byId.spark), 'zap');
assert.equal(shotFx(byId.toast), 'flame');
assert.equal(shotFx(byId.pop), 'dot');

console.log('shot fx tests ok');
