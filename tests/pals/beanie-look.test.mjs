// Emulator: equip the new black beanie, one other new color, and an existing mint look.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-beanie "node tests/pals/beanie-look.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({ projectId: 'demo-beanie', firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0;
const ok = async (name, p) => { try { await p; pass++; console.log('PASS', name); } catch (e) { fail++; console.log('FAIL', name, e.message.slice(0, 300)); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pet = { species: 'kemy', name: 'Bloop', colors: { body: '#f7cdee', accent: '#8a55dc', eye: '#24133f' }, pattern: 'none', acc: 'none', xp: 0, level: 1, pats: 0, stats: { happy: 80, hunger: 80, energy: 80, clean: 80 }, outfit: { head: 'f_beanie_mint' }, at: Timestamp.now(), createdAt: Timestamp.now(), updatedAt: Timestamp.fromMillis(Date.now() - 5000) };
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'users/alice/pets/p1'), pet); });
const A = env.authenticatedContext('alice').firestore();
const B = env.authenticatedContext('bob').firestore();
const wear = (head) => updateDoc(doc(A, 'users/alice/pets/p1'), { outfit: { head }, xp: 0, level: 1, stats: pet.stats, at: serverTimestamp(), updatedAt: serverTimestamp() });

await ok('existing mint beanie still equips', assertSucceeds(wear('f_beanie_mint')));
await sleep(1100);
await ok('new black beanie equips without a purchase', assertSucceeds(wear('f_beanie_black')));
await sleep(1100);
await ok('new red beanie equips without a purchase', assertSucceeds(wear('f_beanie_red')));
await ok('saved look keeps the existing mint beanie', assertSucceeds(setDoc(doc(A, 'users/alice/looks/l1'), { name: 'Mint day', outfit: { head: 'f_beanie_mint' } })));
await ok('saved look can store the black beanie', assertSucceeds(setDoc(doc(A, 'users/alice/looks/l2'), { name: 'Midnight', outfit: { head: 'f_beanie_black' } })));
await ok('another player cannot equip this Pal', assertFails(updateDoc(doc(B, 'users/alice/pets/p1'), { outfit: { head: 'f_beanie_black' }, at: serverTimestamp(), updatedAt: serverTimestamp() })));
let saved, worn;
await env.withSecurityRulesDisabled(async (c) => {
  saved = (await getDoc(doc(c.firestore(), 'users/alice/looks/l1'))).data();
  worn = (await getDoc(doc(c.firestore(), 'users/alice/pets/p1'))).data();
});
if (saved && saved.outfit && saved.outfit.head === 'f_beanie_mint') { pass++; console.log('PASS stored mint look id unchanged'); }
else { fail++; console.log('FAIL stored mint look', JSON.stringify(saved)); }
if (worn && worn.outfit && worn.outfit.head === 'f_beanie_red' && worn.name === 'Bloop') { pass++; console.log('PASS pet still named Bloop and wearing red'); }
else { fail++; console.log('FAIL worn pet', JSON.stringify(worn && { name: worn.name, head: worn.outfit && worn.outfit.head })); }

console.log(fail ? `${fail} FAILED, ${pass} passed` : `ALL ${pass} PASSED`);
await env.cleanup();
process.exit(fail ? 1 : 0);
