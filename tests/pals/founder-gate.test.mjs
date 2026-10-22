// The Founder axolotl is admin-only: not hatchable, not in the shop, and refused unless the admin check passes.
import { founderAllowed, assertFounderSpecies, FOUNDER_SPECIES } from '../../js/pals/founder-gate.js';
import { FOUNDER_MOTION } from '../../js/pals/founder-motion.js';
import { FOUNDER, SPECIES } from '../../js/pals/species.js';
import { ITEMS } from '../../js/pals/catalog.js';

let fail = 0;
const ok = (name, cond) => { if (!cond) { fail++; console.log('FAIL', name); } else console.log('ok', name); };

ok('non-admin cannot equip the founder', founderAllowed(FOUNDER_SPECIES, false) === false);
ok('verified admin can', founderAllowed(FOUNDER_SPECIES, true) === true);
ok('any other species stays open', founderAllowed('kemy', false) === true && founderAllowed('puppy', false) === true);
ok('assert throws for a non-admin', (() => { try { assertFounderSpecies('founder', false); return false; } catch (e) { return e.code === 'founder-only'; } })());
ok('assert allows the admin', (() => { try { assertFounderSpecies('founder', true); return true; } catch { return false; } })());
ok('not on the hatch list', !SPECIES.some((s) => s.id === 'founder' || s.admin));
ok('marked admin-only and not for sale as a rare unlock', FOUNDER.admin === true && FOUNDER.founder === true && !FOUNDER.rare);
ok('shop does not sell it', !ITEMS.some((i) => /founder/i.test(`${i.id} ${i.name}`)) && !SPECIES.some((s) => s.id === 'founder' && s.rare));
ok('motion knobs are present for later video tweaks', FOUNDER_MOTION.idleBob > 0 && FOUNDER_MOTION.gillWiggle > 0 && FOUNDER_MOTION.tailSway > 0 && FOUNDER_MOTION.blinkEvery > FOUNDER_MOTION.blinkFrames && (FOUNDER_MOTION.waveArm === 'aL' || FOUNDER_MOTION.waveArm === 'aR'));

console.log(fail ? `${fail} FAILED` : 'ALL PASSED');
process.exit(fail ? 1 : 0);
