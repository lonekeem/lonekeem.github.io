// Play-app flag on members/{uid}. Admin can list it. Nobody else can. The public profile stays closed.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-play "node tests/security/play-app-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, collection, serverTimestamp, Timestamp, deleteField, writeBatch } from 'firebase/firestore';
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
const user = (name) => ({ displayName: name, username: name, bio: '', color: '#8a2be2', createdAt: Timestamp.now(), welcomed: true, birthY: 2000, birthM: 1 });
await env.withSecurityRulesDisabled(async (c) => {
  const fx = c.firestore();
  await setDoc(doc(fx, 'members', 'ann'), row('ann'));
  await setDoc(doc(fx, 'members', 'lee'), { ...row('lee'), playApp: true, playTold: Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000) });
  await setDoc(doc(fx, 'members', 'jay'), row('jay'));
  await setDoc(doc(fx, 'members', 'pip'), row('pip'));
  await setDoc(doc(fx, 'members', 'sam'), { ...row('sam'), playApp: true, playTold: Timestamp.fromMillis(Date.now() - 4 * 60 * 60 * 1000) });
  await setDoc(doc(fx, 'members', 'keem'), row('keem'));
  await setDoc(doc(fx, 'users', 'ann'), user('ann'));
  await setDoc(doc(fx, 'users', 'lee'), user('lee'));
  await setDoc(doc(fx, 'users', 'jay'), user('jay'));
  await setDoc(doc(fx, 'users', 'sam'), user('sam'));
  await setDoc(doc(fx, 'users', 'pip'), user('pip'));
  await setDoc(doc(fx, 'users', 'bob'), user('bob'));
  await setDoc(doc(fx, 'users', 'keem'), { ...user('keem'), displayName: 'Kemy' });
});

await ok('owner stamps the Play flag', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('owner refreshes the stamp', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { playApp: true, playAppSeen: serverTimestamp() })));
await ok('owner still updates last visit', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { lastActive: serverTimestamp() })));
await ok('owner can change their name without touching the flag', assertSucceeds(updateDoc(doc(ann, 'members/ann'), { displayName: 'Ann', displayNameLower: 'ann' })));
await ok('a stamp alone is not enough', assertFails(updateDoc(doc(auth('pip'), 'members/pip'), { playAppSeen: serverTimestamp() })));
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

function playBatch(db, who, text, extra) {
  const b = writeBatch(db);
  b.update(doc(db, 'members', who), { playApp: true, playAppSeen: serverTimestamp(), playTold: serverTimestamp(), ...extra });
  b.set(doc(collection(db, 'users', 'keem', 'notifications')), {
    type: 'play', fromUid: who, fromName: who, fromUsername: who, postId: '',
    text, createdAt: serverTimestamp(), read: false
  });
  return b.commit();
}
const lee = auth('lee');
const jay = auth('jay');
const keem = auth('keem');
await ok('visit note to Keem', assertSucceeds(playBatch(ann, 'ann', '🧪 @ann is on Kemy (Play app)')));
await ok('second visit inside 3 hours is refused', assertFails(playBatch(ann, 'ann', '🧪 @ann is on Kemy (Play app)')));
await ok('visit after 3 hours is allowed', assertSucceeds(playBatch(lee, 'lee', '🧪 @lee is on Kemy (Play app)')));
await ok('join note once', assertSucceeds(playBatch(jay, 'jay', '🧪 New Play tester joined: @jay', { playJoined: true })));
await ok('join note cannot repeat', assertFails(playBatch(jay, 'jay', '🧪 New Play tester joined: @jay', { playJoined: true })));
const sam = auth('sam');
await ok('note cannot go to someone else', assertFails((() => {
  const b = writeBatch(sam);
  b.update(doc(sam, 'members/sam'), { playApp: true, playAppSeen: serverTimestamp(), playTold: serverTimestamp() });
  b.set(doc(collection(sam, 'users/bob/notifications')), {
    type: 'play', fromUid: 'sam', fromName: 'sam', fromUsername: 'sam', postId: '',
    text: '🧪 @sam is on Kemy (Play app)', createdAt: serverTimestamp(), read: false
  });
  return b.commit();
})()));
await ok('Keem is not notified about Keem', assertFails(playBatch(keem, 'keem', '🧪 @keem is on Kemy (Play app)')));
await ok('made-up play text is refused', assertFails(playBatch(sam, 'sam', '🧪 @sam is on Kemy right now')));

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
