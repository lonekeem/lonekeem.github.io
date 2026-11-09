// Name tags stay off the movie screen during the countdown and the film, and come back after.
// Run: node tests/world/theater-names.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { screenHidesNames } from '../../js/world/theater-movie.js';

for (const phase of ['count', 'title', 'movie']) assert.equal(screenHidesNames(phase, false), true, phase);
for (const phase of ['end', 'off']) assert.equal(screenHidesNames(phase, false), false, phase);
assert.equal(screenHidesNames('movie', true), false, 'a theater song on the screen is not this hide');

const css = readFileSync(new URL('../../js/world/theater.js', import.meta.url), 'utf8');
assert.match(css, /body\.th-film \.p3-tag>span,body\.th-film \.p3-tag>\.p3-safe,body\.th-film \.ks-tag\{visibility:hidden\}/);
assert.equal(css.includes('body.th-film .p3-bub'), false, 'chat bubbles stay visible');
assert.equal(css.includes('body.th-film .th-hud'), false, 'the theater buttons stay visible');
assert.match(css, /screenHidesNames\(sh\.phase, playing\(\)\)/);
assert.match(css, /classList\.remove\('th-film'\)/);

console.log('PASS theater names');
