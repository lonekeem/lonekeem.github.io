// ♿ accessible plate badge rides in fr bit 8: survives the presence code (12 chars max) and keeps the player's text + options
import assert from 'node:assert/strict';
import { plateCode, parsePlate } from '../../js/pals/presence-sync.js';
const p = { t: 'KEEM7', b: 3, f: 14, r: 9, fr: 2 | 8 };
const c = plateCode(p); assert.ok(c.length <= 12 && /^[1-7][A-Z0-9]{1,7}[0-9a-f]{4}$/.test(c), c);
assert.deepEqual(parsePlate(c), p);
const full = { t: 'ABCDEFG', b: 15, f: 15, r: 15, fr: 6 | 8 }; const c2 = plateCode(full); assert.equal(c2.length, 12); assert.deepEqual(parsePlate(c2), full);
assert.equal(parsePlate(plateCode({ ...p, fr: 2 })).fr & 8, 0);
console.log('hc plate code ok', c, c2);
