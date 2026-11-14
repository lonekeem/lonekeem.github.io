// Removed songs must not play, and a saved index for a song that stayed must still be that song.
// Run: node tests/pals/theme-tracks.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.addEventListener = globalThis.addEventListener || (() => {});
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { TRACKS, ORDER, trackAt, setPick, getPick } = await import('../../js/theme.js');

const titles = TRACKS.filter(Boolean).map((t) => t.title);
assert.equal(titles.includes('Walked Away'), false);
assert.equal(titles.includes('Empty Home'), false);
assert.equal(TRACKS[5], null);
assert.equal(TRACKS[9], null);
assert.equal(TRACKS[6].title, 'Keep Going');
assert.equal(TRACKS[10].title, 'Stand Tall');
assert.ok(ORDER.every((i) => TRACKS[i] && TRACKS[i].title));
assert.equal(ORDER.includes(5), false);
assert.equal(ORDER.includes(9), false);
assert.equal(trackAt(5).title, 'Keep Building');
assert.equal(trackAt(9).title, 'Keep Building');
assert.equal(trackAt(6).title, 'Keep Going');
setPick('5');
assert.equal(getPick(), 'all');
setPick('6');
assert.equal(getPick(), '6');
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const beat = readFileSync(new URL('../../js/pals/musicbeat.js', import.meta.url), 'utf8');
assert.equal(html.includes('walked-away'), false);
assert.equal(html.includes('empty-home'), false);
assert.equal(html.includes('>Coming soon<'), false);
assert.equal(beat.includes('walked-away'), false);
assert.equal(beat.includes('empty-home'), false);
assert.match(readFileSync(new URL('../../js/world/drive.js', import.meta.url), 'utf8'), /SELL_CARS = false/);
assert.match(readFileSync(new URL('../../js/sheriff-age.js', import.meta.url), 'utf8'), /SHERIFF_MIN_AGE = 13/);
console.log('theme track tests passed');
