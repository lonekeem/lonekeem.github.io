// One wallet badge per screen: the header chip while the top bar is open, the
// floating chip only when a game hides that bar, removed on the way out.
// Run: node tests/pals/wallet-badge.test.mjs
import assert from 'node:assert/strict';
import { chipWhere, planBadges } from '../../js/wallet-badge.js';

const H = (n) => ({ where: 'header', id: 'h' + n, el: { n } });
const F = (n) => ({ where: 'fab', id: 'wallet-fab', el: { n } });
const S = (n) => ({ where: 'sheet', id: 's' + n, el: { n } });
const wheres = (list) => list.map((c) => c.where);

const star = planBadges({ game: true, headerOpen: true, loggedIn: true, chips: [H(1), H(2), F(1), S(1)] });
assert.deepEqual(wheres(star.keep), ['header', 'sheet'], 'Star Drop keeps the first header chip and the buy sheet');
assert.equal(star.keep[0], star.keep.find((c) => c.where === 'header'));
assert.equal(star.keep[0].id, 'h1');
assert.deepEqual(wheres(star.remove), ['header', 'fab']);
assert.deepEqual(star.create, []);

const park = planBadges({ game: true, headerOpen: false, loggedIn: true, chips: [H(1)] });
assert.deepEqual(park.create, ['fab'], 'a full-screen game mounts one floating chip');
assert.deepEqual(wheres(park.remove), ['header']);

const twoFabs = planBadges({ game: true, headerOpen: false, loggedIn: true, chips: [F(1), F(2)] });
assert.deepEqual(wheres(twoFabs.keep), ['fab']);
assert.equal(twoFabs.keep[0].id, 'wallet-fab');
assert.equal(twoFabs.remove.length, 1);
assert.deepEqual(twoFabs.create, [], 'a second mount does not add another floating chip');

const left = planBadges({ game: false, headerOpen: true, loggedIn: true, chips: [F(1), H(1)] });
assert.deepEqual(wheres(left.keep), ['header']);
assert.deepEqual(wheres(left.remove), ['fab'], 'leaving a game removes the floating chip');
assert.deepEqual(left.create, []);

const sheetOnly = planBadges({ game: true, headerOpen: false, loggedIn: false, chips: [H(1), F(1), S(1)] });
assert.deepEqual(wheres(sheetOnly.keep), ['sheet']);
assert.deepEqual(wheres(sheetOnly.remove), ['header', 'fab']);
assert.deepEqual(sheetOnly.create, []);

const fresh = planBadges({ game: false, headerOpen: true, loggedIn: true, chips: [] });
assert.deepEqual(fresh.create, ['header']);
const full = planBadges({ game: true, headerOpen: false, loggedIn: true, chips: [] });
assert.deepEqual(full.create, ['fab']);

const stray = planBadges({ game: true, headerOpen: true, loggedIn: true, chips: [H(1), { where: 'other', id: 'x', el: { n: 9 } }] });
assert.deepEqual(wheres(stray.remove), ['other']);

function el({ id = '', sheet = false, header = false }) {
  return { id, closest: (sel) => (sheet && sel === '.bs-ov') || (header && sel === '#header-actions') ? {} : null };
}
assert.equal(chipWhere(el({ sheet: true, id: 'wallet-fab' })), 'sheet');
assert.equal(chipWhere(el({ id: 'wallet-fab' })), 'fab');
assert.equal(chipWhere(el({ header: true })), 'header');
assert.equal(chipWhere(el({})), 'other');
assert.equal(chipWhere(null), 'other');

console.log('wallet badge tests ok');
