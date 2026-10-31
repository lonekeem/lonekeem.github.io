import assert from 'node:assert/strict';
import { kindFromId, keyboardLook, defaultPrefs, stickAxis, savePrefs, loadPrefs, resetPrefs, hintFor, glyph, keyLabel } from './input.js';

const mem = new Map();
globalThis.localStorage = {
  getItem(k) { return mem.has(k) ? mem.get(k) : null; },
  setItem(k, v) { mem.set(k, String(v)); },
  removeItem(k) { mem.delete(k); }
};

const prefs = defaultPrefs();
assert.equal(kindFromId('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'ps');
assert.equal(kindFromId('DualSense'), 'ps');
assert.equal(kindFromId('Xbox 360 Controller (XInput)'), 'xbox');
assert.equal(kindFromId('045e-02ea'), 'xbox');
assert.equal(kindFromId('Generic USB Joystick'), 'generic');

assert.deepEqual(stickAxis(0.05, 0), { x: 0, y: 0, mag: 0 });
const full = stickAxis(1, 0);
assert.ok(Math.abs(full.x - 1) < 1e-6 && full.mag > 0.99);

const keys = defaultPrefs().keys;
assert.equal(keyboardLook(new Set(['q']), prefs).x, -1);
assert.equal(keyboardLook(new Set(['e']), prefs).x, 1);
assert.equal(keyboardLook(new Set(['q']), prefs, new Set(['q'])).x, 0);
assert.equal(keyboardLook(new Set(['ArrowRight']), prefs).x, 0);
const lookArrows = { ...prefs, arrowMode: 'look', keys };
assert.equal(keyboardLook(new Set(['ArrowLeft']), lookArrows).x, -1);
assert.equal(keyboardLook(new Set(['ArrowUp']), lookArrows).y, -1);

assert.equal(hintFor('jump', 'keyboard', prefs), 'Space');
assert.equal(hintFor('emote', 'xbox', prefs), 'X');
assert.equal(hintFor('jump', 'ps', prefs), '✕');
assert.equal(keyLabel('Escape'), 'Esc');
assert.match(glyph('confirm', 'ps'), /<svg/);
assert.match(glyph('confirm', 'xbox'), /A/);

resetPrefs();
const edited = loadPrefs();
edited.invertY = true;
edited.keys.interact = 'g';
edited.pads.xbox.confirm = 2;
savePrefs(edited);
const stored = JSON.parse(localStorage.getItem('kemy-input'));
assert.equal(stored.invertY, true);
assert.equal(stored.keys.interact, 'g');
assert.equal(stored.pads.xbox.confirm, 2);
assert.equal(stored.pads.ps.confirm, 0);
resetPrefs();
assert.equal(loadPrefs().invertY, false);

console.log('input tests ok');
