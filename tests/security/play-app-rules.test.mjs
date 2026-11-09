// Play-app flag on members/{uid}. Admin can list it. Nobody else can. The public profile stays closed.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-play "node tests/security/play-app-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, serverTimestamp, Timestamp, deleteField } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-play',
  firestore: { host: '127.0.0.1', port: 8199, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') }
});
let pass = 0, fail = 0;
const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 240)); } };
const now = Math.floor(Date.now() / 1000);
const auth = (uid, extra = {}) => env.authenticatedContext(uid, {
  email: uid + '@example.com', email_verified: true, auth_time: now,
  firebase: { sign_in_provider: 'password' }, ...extra
}).firestore();
const ann = auth('ann');
const bob = auth('bob');
const admin = auth('keem', { email: 'lillykemoy1@gmail.com', email_verified: true });
const row = (name) => ({
  displayName: name, username: name, displayNameLower: name, color: '#8a2be2', photoURL: '',
  createdAt: Timestamp.now(), signup: 'email', lastActive: Timestamp.now()
});

await env.clearFirestore();
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), 'members', 'ann'), row('ann'));
  await setDoc(doc(c.firestore(), 'members', 'lee'), row('lee'));
  await setDoc(doc(c.firestore(), 'users', 'ann'), {
    displayName: 'ann', username: 'ann', bio: '', color: '#8a2be2', createdAt: Timestamp.now(), welcomed: true, birthY: 2000, birthM: 1
  });
});

await ok('owner stamps the Play flag', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('owner refreshes the stamp', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('owner still updates last visit', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { lastActive: serverTimestamp() })));
await ok('owner can change their name without touching the flag', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { displayName: 'Ann', displayNameLower: 'ann' })));
await ok('a stamp alone is not enough', assertFails(updateDoc(doc(auth('lee'), 'members/lee'), { playAppSeen: serverTimestamp() })));
await ok('flag cannot be turned off', assertFails(updateDoc(doc(ann, 'members/ann'), { playApp: false })));
await ok('flag cannot be cleared', assertFails(updateDoc(doc(ann, 'members/ann'), { playApp: deleteField() })));
await ok('stamp cannot be backdated', assertFails(updateDoc(doc(ann, 'members/ann'), { playAppSeen: Timestamp.fromMillis(0) })));
await ok('someone else cannot flag this row', assertFails(updateDoc(doc(bob, 'members/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('someone else cannot read the row', assertFails(getDoc(doc(bob, 'members/ann'))));
await ok('someone else cannot list members', assertFails(getDocs(collection(bob, 'members'))));
await ok('admin reads the flag', assertSucceeds(getDoc(doc(admin, 'members/ann')).then((s) => { if (!s.exists() || s.get('playApp') !== true) throw new Error('flag missing'); })));
await ok('admin lists members', assertSucceeds(getDocs(collection(admin, 'members'))));
await ok('public profile rejects the flag', assertFails(updateDoc(doc(ann, 'users/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('new member row without the flag', assertSucceeds(setDoc(doc(auth('cam'), 'members/cam'), {
  displayName: 'Sunny Panda', username: 'cam', displayNameLower: 'sunny panda', color: '#8a2be2', photoURL: '',
  createdAt: serverTimestamp(), lastActive: serverTimestamp(), signup: 'email'
})));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
