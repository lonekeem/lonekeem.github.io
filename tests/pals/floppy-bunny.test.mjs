// Account-specific lop ears stay off the pet document and off every other Pal.
// Run: node tests/pals/floppy-bunny.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { floppyBunny, withOwner, copyPal, FLOPPY_BUNNY_UID } from '../../js/pals/floppy-bunny.js';

const tilly = {
  species: 'bunny', name: 'Tilly Eyelash',
  colors: { body: '#d0d0e0', accent: '#5fae6e', eye: '#3b6b3a' },
  pattern: 'stripes', acc: 'none', level: 1
};
const snap = (p) => ({ species: p.species, name: p.name, colors: p.colors || {}, pattern: p.pattern || '', acc: p.acc || '', outfit: p.outfit || {}, level: p.level || 1, variant: p.variant || '' });

const hers = withOwner({ ...tilly }, FLOPPY_BUNNY_UID);
assert.equal(floppyBunny(hers), true);
assert.equal(Object.keys(hers).includes('owner'), false);
assert.equal(JSON.stringify(hers).includes(FLOPPY_BUNNY_UID), false);
assert.equal(JSON.stringify(snap(hers)).includes('owner'), false);

const other = withOwner({ ...tilly }, 'other-account');
assert.equal(floppyBunny(other), false);
assert.equal(floppyBunny(withOwner({ species: 'puppy', name: 'Pup' }, FLOPPY_BUNNY_UID)), false);
assert.equal(floppyBunny(withOwner({ species: 'lamb' }, FLOPPY_BUNNY_UID)), false);
assert.equal(floppyBunny({ species: 'bunny' }), false);

const viewed = copyPal(hers, { _others: 1 });
assert.equal(floppyBunny(viewed), true);
assert.equal(viewed._others, 1);
assert.equal(Object.keys(viewed).includes('owner'), false);
assert.equal(floppyBunny(copyPal(other, { _others: 1 })), false);

const species = readFileSync(new URL('../../js/pals/species.js', import.meta.url), 'utf8');
assert.match(species, /id: 'bunny'[\s\S]*?ears: 'long'/);
const art = readFileSync(new URL('../../js/pals/art.js', import.meta.url), 'utf8');
assert.match(art, /ears === 'long' && floppyBunny\(pal\)/);
assert.match(art, /ears === 'long' && !floppyBunny\(pal\)/);
const pal3d = readFileSync(new URL('../../js/pals/pal3d.js', import.meta.url), 'utf8');
assert.match(pal3d, /ea === 'long' && floppyBunny\(pal\)/);
assert.match(pal3d, /ea === 'floppy'/);
const park = readFileSync(new URL('../../js/pals/park3d.js', import.meta.url), 'utf8');
assert.match(park, /withOwner\(snapOf\(pal\), S\.user\.uid\)/);
assert.match(park, /withOwner\(o\.pal, o\.uid\)/);
const sw = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
assert.match(sw, /const CACHE = 'lks-v280'/);
console.log('floppy-bunny ok');
