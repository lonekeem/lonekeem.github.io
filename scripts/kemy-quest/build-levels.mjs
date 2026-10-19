// Builds assets/kemy-quest/levels.json from the hand-placed layouts in scripts/kemy-quest/worlds/*.mjs.
// Run: node scripts/kemy-quest/build-levels.mjs
import { writeFileSync } from 'node:fs';
import w1 from './worlds/w1.mjs'; import w2 from './worlds/w2.mjs'; import w3 from './worlds/w3.mjs'; import w4 from './worlds/w4.mjs';
import w5 from './worlds/w5.mjs'; import w6 from './worlds/w6.mjs'; import w7 from './worlds/w7.mjs'; import w8 from './worlds/w8.mjs'; import bonus from './worlds/bonus.mjs';
const levels = [];
for (const add of [w1, w2, w3, w4, w5, w6, w7, w8, bonus]) add(levels);
const ids = new Set(); for (const l of levels) { if (ids.has(l.id)) throw new Error('dup ' + l.id); ids.add(l.id); }
writeFileSync(new URL('../../assets/kemy-quest/levels.json', import.meta.url), JSON.stringify({ version: 2, levels }));
console.log(levels.length + ' levels:', levels.map((l) => `${l.id} ${l.tiles[0].length}x${l.tiles.length} stars=${l.ents.filter((e) => e.t === 'star').length}`).join(', '));
