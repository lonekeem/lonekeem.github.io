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

// Dance styles: one short presence value, clock-synced so every viewer sees the same move.
{
  const { DANCE_STYLES, styleDn, isStyleDn, styleOf, styleAt, danceBeat } = await import('../../js/pals/dance-menu.js');
  assert.deepEqual(DANCE_STYLES.map((s) => s.k), ['c', 'b', 'k', 'h', 'f']);
  for (const s of DANCE_STYLES) {
    const dn = styleDn(s.k, 2.5, 107.7);
    assert.ok(dn.length <= 20 && isStyleDn(dn), dn);
    assert.equal(styleOf(dn).k, s.k);
    if (s.k === 'c') continue;
    const bt = danceBeat(dn, 999);
    assert.ok(Math.abs(bt - 2.5) < 0.3, `${dn} beat ${bt}`);
    assert.equal(styleAt(dn, bt).i, 0); // starts on the style's first move
    for (let m = 0; m < s.moves.length; m++) assert.equal(styleAt(dn, m * 8 + 1).i, m);
    assert.equal(styleAt(dn, bt, true).i, 0); // Pals: lite
  }
  assert.equal(isStyleDn('g:z1000.abc'), false);
  assert.equal(isStyleDn('g:b1000.abc!'), false);
}
