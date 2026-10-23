// Empty plate text saves the preview default. Validation errors are copied beside Save and scrolled into view.
// Run: node tests/world/plate.test.mjs
import assert from 'node:assert/strict';
import { PLATE_PREVIEW, plateText, showPlateError } from '../../js/world/cars.js';

assert.equal(PLATE_PREVIEW, 'KEMY1');
assert.equal(plateText(''), 'KEMY1', 'an empty field saves the preview text');
assert.equal(plateText('   '), 'KEMY1');
assert.equal(plateText(null), 'KEMY1');
assert.equal(plateText('kemy 7!'), 'KEMY7', 'spaces and symbols are dropped, letters uppercased');
assert.equal(plateText('ABCDEFGH'), 'ABCDEFG', 'seven characters max');
assert.equal(plateText('nova'), 'NOVA', 'a real plate is kept');

function el(cls) { return { className: cls, textContent: '', children: [], scrollIntoView(o) { this.seen = o; } }; }
function tree(node) {
  node.querySelector = (sel) => {
    const want = sel.replace('.', '');
    const walk = (e) => {
      if (String(e.className || '').split(/\s+/).includes(want)) return e;
      for (const c of e.children || []) { const h = walk(c); if (h) return h; }
      return null;
    };
    return walk(node);
  };
  return node;
}
const top = el('kp-msg'), by = el('kp-by');
const root = tree({ className: 'kd-plate', children: [top, by] });
showPlateError(root, '🙈 Let’s pick a kinder word.');
assert.equal(top.textContent, '🙈 Let’s pick a kinder word.');
assert.equal(by.textContent, '🙈 Let’s pick a kinder word.', 'the same error sits next to Save');
assert.deepEqual(top.seen, { block: 'nearest', inline: 'nearest' }, 'the top hint is scrolled into view');
assert.deepEqual(by.seen, { block: 'nearest', inline: 'nearest' }, 'the Save-side error is scrolled into view');
showPlateError(null, 'nope');

console.log('plate save tests ok');
