// Kemy Kustoms look code + catalog checks (node tests/world/kustom.test.mjs)
import assert from 'node:assert/strict';
import { KK, KK_ITEMS, lookCode, parseLook, dnLook, blankLook, lookNeeds, normLook } from '../../js/world/kustom-look.js';
for (const o of KK_ITEMS) { assert.match(o.id, /^[a-z_]{2,16}$/, o.id); assert.ok(!!o.d === o.id.startsWith('z_'), o.id); assert.ok(o.p > 0 || o.d > 0); }
assert.equal(new Set(KK_ITEMS.map((o) => o.id)).size, KK_ITEMS.length);
assert.equal(lookCode(blankLook()), '');
for (let n = 0; n < 500; n++) { const l = {}; for (const k of Object.keys(KK)) l[k] = Math.floor(Math.random() * KK[k].length); const c = lookCode(l); if (c) { assert.match(c, /^[0-9a-z]{4}$/); assert.deepEqual(parseLook(c), normLook(l)); } }
assert.deepEqual(parseLook('ZZ!'), blankLook());
assert.equal(dnLook('~c061kbszn'), 'bszn'); assert.equal(dnLook('~c061oabcdefghkbszn'), 'bszn'); assert.equal(dnLook('~c061'), ''); assert.ok(('~c061oabcdefghkbszn').length <= 20);
assert.deepEqual(lookNeeds({ rim: 3, horn: 1 }).map((o) => o.id), ['z_kk_rim_gold']);
console.log('kustom ok', KK_ITEMS.length, 'items');
