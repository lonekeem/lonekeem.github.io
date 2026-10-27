// Firestore rules: modded-keyboard characters are refused server-side (zero-width, bidi, fillers, zalgo).
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-kind "node tests/kind/text-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-kind', firestore: { host: '127.0.0.1', port: 8199, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let fail = 0; const ok = async (n, p) => { try { await p; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 160)); } };
const T0 = Timestamp.fromMillis(1700000000000);
// 13+ birthday: the under-13 rule blocks free-text bio/name edits for accounts with no known age.
const prof = (o) => ({ displayName: 'Mia', username: 'mia', bio: '', color: '#8a2be2', createdAt: T0, welcomed: true, birthY: 2000, birthM: 1, ...o });
await env.withSecurityRulesDisabled(async (c) => { for (const u of ['aaa','bbb','ccc','ddd','eee','fff','ggg','hhh']) await setDoc(doc(c.firestore(), 'users', u), prof({ username: u })); });
const put = (uid, o) => setDoc(doc(env.authenticatedContext(uid).firestore(), 'users', uid), prof({ username: uid, ...o }), { merge: false });
await ok('plain name + emoji family bio ok', assertSucceeds(put('aaa', { displayName: 'Mia ✨', bio: '👨‍👩‍👧 ❤️ Привет café' })));
await ok('zero-width in name refused', assertFails(put('bbb', { displayName: 'M\u200Bia' })));
await ok('bidi override in bio refused', assertFails(put('ccc', { bio: '\u202Eolleh' })));
await ok('hangul filler name refused', assertFails(put('ddd', { displayName: '\u3164' })));
await ok('zalgo bio refused', assertFails(put('eee', { bio: 'h\u0337\u031B\u0324i' })));
await ok('one accent ok', assertSucceeds(put('fff', { bio: 'cafe\u0301 nai\u0308ve' })));
await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users', 'ggg'), { displayName: 'Mia', username: 'ggg', bio: '', color: '#8a2be2', createdAt: T0, welcomed: true }));
await ok('no known age: bio refused', assertFails(setDoc(doc(env.authenticatedContext('ggg').firestore(), 'users', 'ggg'), { displayName: 'Mia', username: 'ggg', bio: 'hi', color: '#8a2be2', createdAt: T0, welcomed: true })));
const U13 = { birthY: new Date().getFullYear() - 8, birthM: 1 };
await env.withSecurityRulesDisabled(async (c) => setDoc(doc(c.firestore(), 'users', 'hhh'), prof({ username: 'hhh', ...U13 })));
await ok('under 13: bio refused', assertFails(put('hhh', { ...U13, bio: 'hi' })));
await ok('reserved name refused', assertFails(put('aaa', { displayName: 'K3my' })));
await env.cleanup(); console.log(fail ? `${fail} failed` : 'all passed'); process.exit(fail ? 1 : 0);
