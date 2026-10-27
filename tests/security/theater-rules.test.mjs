// Firestore rules tests for the Lone Keem Studio theater doc (js/world/theater.js).
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-sec "node tests/security/theater-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const port = +(process.env.FS_PORT || 8199);
const env = await initializeTestEnvironment({ projectId: 'demo-th', firestore: { host: '127.0.0.1', port, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0; const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 200)); } };
const now = Math.floor(Date.now() / 1000);
const ctx = (u, email, verified = true) => env.authenticatedContext(u, { email, email_verified: verified, auth_time: now }).firestore();
const ADM = ctx('keem', 'lillykemoy1@gmail.com'), UNV = ctx('fake', 'lillykemoy1@gmail.com', false), KID = ctx('kid', 'kid@example.com'), PASS = ctx('pass', 'pass@example.com');
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'infPass', 'pass'), { unlimitedPass: true }); });
const T = (db) => doc(db, 'theater', 'lone-keem-studio');
const good = (by) => ({ col: { aSeatC: '#b0121f' }, li: '', la: '', lo: '', lt: { h: 0.4, tint: '', sp: 0, spc: '', at: 1 }, pl: { i: 0, s: 0, p: 0, on: false, at: 1 }, at: serverTimestamp(), by });
await ok('admin writes the theater doc', assertSucceeds(setDoc(T(ADM), good('keem'))));
await ok('signed-in kid reads it', assertSucceeds(getDoc(T(KID))));
await ok('signed-out cannot read', assertFails(getDoc(T(env.unauthenticatedContext().firestore()))));
await ok('kid cannot write', assertFails(setDoc(T(KID), good('kid'))));
await ok('unverified admin email cannot write', assertFails(setDoc(T(UNV), good('fake'))));
await ok('∞ Pass holder can write', assertSucceeds(setDoc(T(PASS), good('pass'))));
await ok('wrong by is rejected', assertFails(setDoc(T(ADM), good('someone'))));
await ok('extra keys rejected', assertFails(setDoc(T(ADM), { ...good('keem'), link: 'x' })));
// (string sizes are capped in the client: only the trusted owner can write, and the rules are at the compiled-size cap)
await ok('other doc ids rejected', assertFails(setDoc(doc(ADM, 'theater', 'other-one'), good('keem'))));
await ok('kid cannot delete', assertFails(deleteDoc(T(KID))));
await ok('admin can delete', assertSucceeds(deleteDoc(T(ADM))));
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
