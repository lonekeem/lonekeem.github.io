// Rules tests: friend requests (friendreq/{from_to}, friendcap/{uid}) and the mutual follows written on accept.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-friends "node tests/safety/friends-rules.test.mjs"
// (uses FIRESTORE_EMULATOR_HOST when set, so it can run on other ports too)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, getDocs, deleteDoc, collection, query, where, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8199').split(':');
const env = await initializeTestEnvironment({ projectId: 'demo-friends', firestore: { host, port: +port, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0; const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, (e.message || '').slice(0, 200)); } };
const db = (u) => env.authenticatedContext(u, { email: u + '@example.com', email_verified: true }).firestore();
const Y = new Date().getFullYear();
const old = Timestamp.fromMillis(Date.now() - 10 * 864e5);
const prof = (n, y = Y - 20) => ({ displayName: n, username: n, bio: '', color: '#8a2be2', createdAt: old, welcomed: true, birthY: y, birthM: 1, rulesAt: Timestamp.now() });
const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
await admin(async (f) => {
  for (const u of ['amy', 'ben', 'cal', 'dot', 'eve', 'fay', 'gus', 'hal']) await setDoc(doc(f, 'users/' + u), prof(u));
  await setDoc(doc(f, 'users/kid'), prof('kid', Y - 10));
  await setDoc(doc(f, 'users/nob'), { ...prof('nob'), birthY: null, birthM: null });
  await setDoc(doc(f, 'users/ben/blocks/cal'), { at: old });            // ben blocked cal
  await setDoc(doc(f, 'bans/dot'), { until: Timestamp.fromMillis(Date.now() + 3600e3), by: 'auto' }); // dot is timed out
});
// one batched send, the way js/friends.js does it
const send = async (from, to, extra = {}, capOver) => { const f = db(from); const cap = (await getDoc(doc(f, 'friendcap', from))).data();
  const fresh = !cap || cap.start.toMillis() < Date.now() - 864e5; const b = writeBatch(f);
  b.set(doc(f, 'friendcap', from), capOver || (fresh ? { start: serverTimestamp(), n: 1, at: serverTimestamp() } : { start: cap.start, n: cap.n + 1, at: serverTimestamp() }));
  b.set(doc(f, 'friendreq', from + '_' + to), { from, to, name: from, uname: from, status: 'pending', at: serverTimestamp(), ...extra });
  return b.commit(); };
const accept = (me, from, follows = [[from, me], [me, from]]) => { const f = db(me); const b = writeBatch(f);
  b.update(doc(f, 'friendreq', from + '_' + me), { status: 'accepted', at: serverTimestamp() });
  for (const [a, c] of follows) b.set(doc(f, 'follows', a + '_' + c), { follower: a, followee: c, createdAt: serverTimestamp() });
  return b.commit(); };

await ok('amy sends ben a request', assertSucceeds(send('amy', 'ben')));
await ok('amy cannot send a second one while pending', assertFails(send('amy', 'ben')));
await ok('ben reads it', assertSucceeds(getDoc(doc(db('ben'), 'friendreq/amy_ben'))));
await ok('ben lists his pending requests', assertSucceeds(getDocs(query(collection(db('ben'), 'friendreq'), where('to', '==', 'ben'), where('status', '==', 'pending')))));
await ok('eve cannot read amy_ben', assertFails(getDoc(doc(db('eve'), 'friendreq/amy_ben'))));
await ok('eve can check her own missing pair', assertSucceeds(getDoc(doc(db('eve'), 'friendreq/eve_amy'))));
await ok('amy cannot accept her own request', assertFails(accept('amy', 'ben', [])));
await ok('amy cannot make ben follow her (no accept)', assertFails(setDoc(doc(db('amy'), 'follows/ben_amy'), { follower: 'ben', followee: 'amy', createdAt: serverTimestamp() })));
await ok('eve cannot accept for ben', assertFails((() => { const f = db('eve'); const b = writeBatch(f); b.update(doc(f, 'friendreq/amy_ben'), { status: 'accepted', at: serverTimestamp() }); return b.commit(); })()));
await ok('ben cannot write a follow for a stranger in the accept', assertFails(accept('ben', 'amy', [['amy', 'ben'], ['ben', 'amy'], ['eve', 'ben']])));
await ok('ben accepts: both follows written', assertSucceeds(accept('ben', 'amy')));
await ok('follow amy→ben exists', admin(async (f) => { if (!(await getDoc(doc(f, 'follows/amy_ben'))).exists()) throw new Error('missing'); }));
await ok('follow ben→amy exists', admin(async (f) => { if (!(await getDoc(doc(f, 'follows/ben_amy'))).exists()) throw new Error('missing'); }));
await ok('accept cannot be replayed to write more follows', assertFails(setDoc(doc(db('ben'), 'follows/ben_amy2'), { follower: 'ben', followee: 'amy2', createdAt: serverTimestamp() })));
await ok('ben cannot flip accepted back to pending', assertFails(setDoc(doc(db('ben'), 'friendreq/amy_ben'), { from: 'amy', to: 'ben', name: 'amy', uname: 'amy', status: 'pending', at: serverTimestamp() })));
// decline
await ok('fay sends gus', assertSucceeds(send('fay', 'gus')));
await ok('gus declines (status+at only)', assertSucceeds((() => { const f = db('gus'); const b = writeBatch(f); b.update(doc(f, 'friendreq/fay_gus'), { status: 'declined', at: serverTimestamp() }); return b.commit(); })()));
await ok('decline wrote no follows', admin(async (f) => { if ((await getDoc(doc(f, 'follows/gus_fay'))).exists() || (await getDoc(doc(f, 'follows/fay_gus'))).exists()) throw new Error('follow exists'); }));
await ok('gus cannot follow-back via the declined request', assertFails(setDoc(doc(db('gus'), 'follows/fay_gus'), { follower: 'fay', followee: 'gus', createdAt: serverTimestamp() })));
await ok('fay cannot re-ask right after a decline (cooldown)', assertFails(send('fay', 'gus')));
await ok('fay cannot delete the declined doc to skip the cooldown', assertFails(deleteDoc(doc(db('fay'), 'friendreq/fay_gus'))));
await admin((f) => setDoc(doc(f, 'friendreq/fay_gus'), { from: 'fay', to: 'gus', name: 'fay', uname: 'fay', status: 'declined', at: Timestamp.fromMillis(Date.now() - 4 * 864e5) }));
await ok('fay can re-ask after the 3-day cooldown', assertSucceeds(send('fay', 'gus')));
await ok('gus can clear a request', assertSucceeds(deleteDoc(doc(db('gus'), 'friendreq/fay_gus'))));
// safety
await ok('cal (blocked by ben) cannot send to ben', assertFails(send('cal', 'ben')));
await ok('ben cannot send to cal (he blocked them)', assertFails(send('ben', 'cal')));
await ok('timed-out dot cannot send', assertFails(send('dot', 'amy')));
await ok('cannot send to an under-13 account', assertFails(send('amy', 'kid')));
await ok('under-13 cannot send', assertFails(send('kid', 'amy')));
await ok('unknown age cannot send', assertFails(send('nob', 'amy')));
await ok('cannot send to unknown age', assertFails(send('amy', 'nob')));
await ok('cannot send to yourself', assertFails(send('amy', 'amy')));
await ok('cannot fake the sender', assertFails((() => { const f = db('eve'); const b = writeBatch(f); b.set(doc(f, 'friendcap/eve'), { start: serverTimestamp(), n: 1, at: serverTimestamp() }); b.set(doc(f, 'friendreq/hal_amy'), { from: 'hal', to: 'amy', name: 'hal', uname: 'hal', status: 'pending', at: serverTimestamp() }); return b.commit(); })()));
await ok('cannot fake the display name', assertFails(send('eve', 'hal', { name: 'Kemy Moderators' })));
await ok('send without the daily counter rejected', assertFails(setDoc(doc(db('eve'), 'friendreq/eve_amy'), { from: 'eve', to: 'amy', name: 'eve', uname: 'eve', status: 'pending', at: serverTimestamp() })));
await ok('send straight as accepted rejected', assertFails(send('eve', 'amy', { status: 'accepted' })));
await ok('pending→accepted on accept needs receiver not timed out', (async () => {
  await assertSucceeds(send('hal', 'dot'));
  await assertFails(accept('dot', 'hal'));
  await assertSucceeds((() => { const f = db('dot'); const b = writeBatch(f); b.update(doc(f, 'friendreq/hal_dot'), { status: 'declined', at: serverTimestamp() }); return b.commit(); })());
})());
await ok('blocked after sending: receiver cannot accept', (async () => {
  await assertSucceeds(send('eve', 'fay'));
  await admin((f) => setDoc(doc(f, 'users/fay/blocks/eve'), { at: old }));
  await assertFails(accept('fay', 'eve'));
})());
await ok('notification type friend allowed', assertSucceeds(setDoc(doc(db('amy'), 'users/hal/notifications/n1'), { type: 'friend', fromUid: 'amy', fromName: 'amy', fromUsername: 'amy', postId: '', text: '', createdAt: serverTimestamp(), read: false })));
await ok('notification type friend_ok allowed', assertSucceeds(setDoc(doc(db('ben'), 'users/amy/notifications/n2'), { type: 'friend_ok', fromUid: 'ben', fromName: 'ben', fromUsername: 'ben', postId: '', text: '', createdAt: serverTimestamp(), read: false })));
await ok('blocked sender cannot notify', assertFails(setDoc(doc(db('cal'), 'users/ben/notifications/n3'), { type: 'friend', fromUid: 'cal', fromName: 'cal', fromUsername: 'cal', postId: '', text: '', createdAt: serverTimestamp(), read: false })));
// rate limit: 20 a day
await ok('sender flagged under-13 after sending: receiver cannot accept', (async () => {
  await admin(async (f) => { await setDoc(doc(f, 'users/ivy'), prof('ivy')); await setDoc(doc(f, 'users/jon'), prof('jon')); });
  await assertSucceeds(send('ivy', 'jon'));
  await admin((f) => setDoc(doc(f, 'underage/ivy'), { at: old }));
  await assertFails(accept('jon', 'ivy'));
  await assertSucceeds(updateDoc(doc(db('jon'), 'friendreq/ivy_jon'), { status: 'declined', at: serverTimestamp() })); // declining still works
})());
await ok('20 a day, the 21st is refused', (async () => {
  await admin(async (f) => { for (let i = 0; i < 21; i++) await setDoc(doc(f, 'users/p' + String.fromCharCode(97 + i) + 'x'), prof('p' + i)); });
  await admin((f) => setDoc(doc(f, 'friendcap/hal'), { start: Timestamp.now(), n: 1, at: Timestamp.now() })); // hal already sent 1 today
  for (let i = 0; i < 19; i++) await assertSucceeds(send('hal', 'p' + String.fromCharCode(97 + i) + 'x'));
  await assertFails(send('hal', 'p' + String.fromCharCode(97 + 19) + 'x'));
  await assertFails(send('hal', 'p' + String.fromCharCode(97 + 19) + 'x', {}, { start: serverTimestamp(), n: 1, at: serverTimestamp() })); // can't reset the window early
  await assertFails(send('hal', 'p' + String.fromCharCode(97 + 19) + 'x', {}, { start: Timestamp.fromMillis(Date.now() - 2 * 864e5), n: 20, at: serverTimestamp() }));
})());
await ok('a new day resets the counter', (async () => {
  await admin((f) => setDoc(doc(f, 'friendcap/hal'), { start: Timestamp.fromMillis(Date.now() - 25 * 3600e3), n: 20, at: Timestamp.now() }));
  await assertSucceeds(send('hal', 'ptx'));
})());
await ok('normal follow still works (z43)', (async () => { const f = db('gus'); const b = writeBatch(f);
  b.set(doc(f, 'follows/gus_hal'), { follower: 'gus', followee: 'hal', createdAt: serverTimestamp() }); b.update(doc(f, 'users/gus'), { lastFollowAt: serverTimestamp() }); await assertSucceeds(b.commit()); })());
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
