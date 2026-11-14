// Leaving Pal Park or Kemy Street must drop the timers and window listeners that
// keep the 3D world (and its Firestore sync) alive.
// Run: node tests/world/cleanup-leaks.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const park = text('js/pals/park3d.js');
const homes = text('js/world/homes.js');
const world = text('js/world/kemyworld.js');
const drive = text('js/world/drive.js');
const life = text('js/world/homelife.js');

assert.match(park, /const roomTick = setInterval/);
assert.match(park, /clearInterval\(roomTick\)/);
assert.match(park, /removeEventListener\('kemy:chat-mode', applyPhrase\)/);
assert.match(homes, /const onCars = \(\) => syncCars\(true\)/);
assert.match(homes, /removeEventListener\('kemy:cars-changed', onCars\)/);
assert.match(world, /removeEventListener\('resize', placeAct\)/);
assert.match(drive, /const onBlur = \(\) => resetInput\(\)/);
assert.match(drive, /removeEventListener\('blur', onBlur\)/);
assert.match(life, /const onHideLife = \(\) => flush\(\)/);
assert.match(life, /removeEventListener\('pagehide', onHideLife\)/);
assert.match(text('js/theme.js'), /if \(!calmNow\(\)\) \{ if \(askEl\) askEl\.remove\(\); return; \}/);
assert.match(text('sw.js'), /const CACHE = 'lks-v292'/);
assert.doesNotMatch(text('js/world/drive.js'), /SELL_CARS\s*=\s*true/);

console.log('cleanup leak tests passed');
