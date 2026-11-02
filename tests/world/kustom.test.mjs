// Kemy Kustoms look code + catalog checks (node tests/world/kustom.test.mjs)
import assert from 'node:assert/strict';
import { KK, KK_CAPS, KK_KEYS, KK_ITEMS, lookCode, lookV1, lookDn, parseLook, dnLook, blankLook, lookNeeds, normLook, fits } from '../../js/world/kustom-look.js';
for (const o of KK_ITEMS) { assert.match(o.id, /^[a-z_]{2,16}$/, o.id); assert.ok(!!o.d === o.id.startsWith('z_'), o.id); assert.ok(o.p > 0 || o.d > 0); }
assert.equal(new Set(KK_ITEMS.map((o) => o.id)).size, KK_ITEMS.length);
for (const [k, cap] of KK_CAPS) assert.ok(KK[k].length <= cap, k); assert.deepEqual(KK_CAPS.map((x) => x[0]).sort(), [...KK_KEYS].sort());
assert.equal(lookCode(blankLook()), '');
const max = {}; for (const [k, cap] of KK_CAPS) max[k] = cap - 1; assert.ok(lookCode(max).length <= 15, 'dn room: ~c + 3 + code <= 20');
for (let n = 0; n < 3000; n++) { const l = {}; for (const k of KK_KEYS) l[k] = Math.floor(Math.random() * KK[k].length); if (n % 3) for (const k of KK_KEYS.slice(8)) l[k] = 0;
  const c = lookCode(l); if (!c) continue; assert.match(c, /^([0-9a-z]{4}|q[0-9a-z]{4,14})$/); assert.deepEqual(parseLook(c), normLook(l));
  const dn = '~c061' + lookDn(l, 15); assert.ok(dn.length <= 20); assert.deepEqual(parseLook(dnLook(dn)), normLook(l));
  const dr = '~c061oabcdefgh' + lookDn(l, 6); assert.ok(dr.length <= 20); { const got = parseLook(dnLook(dr)); assert.ok(JSON.stringify(got) === JSON.stringify(normLook(l)) || JSON.stringify(got) === JSON.stringify(parseLook(lookV1(l) || '')), 'rider falls back to v1'); } }
assert.deepEqual(parseLook('ZZ!'), blankLook());
assert.equal(dnLook('~c061kbszn'), 'bszn'); assert.equal(dnLook('~c061oabcdefghkbszn'), 'bszn'); assert.equal(dnLook('~c061'), ''); assert.ok(('~c061oabcdefghkbszn').length <= 20);
assert.deepEqual(lookNeeds({ rim: 3, horn: 1 }).map((o) => o.id), ['z_kk_rim_gold']);
assert.ok(!fits(KK.bull[1], false) && fits(KK.bull[1], true) && !fits(KK.kit[1], true) && fits(KK.kit[1], false));
assert.deepEqual(lookNeeds({ bull: 1, kit: 1 }, false).map((o) => o.id), lookNeeds({ kit: 1 }, false).map((o) => o.id));
console.log('kustom ok', KK_ITEMS.length, 'items');
