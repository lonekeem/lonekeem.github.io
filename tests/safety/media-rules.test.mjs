// Rules tests: new-account video hold (3 days), report counting (one per person) + moderator keep, config/mediaReview.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-media "node tests/safety/media-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'demo-media', firestore: { host: '127.0.0.1', port: 8199, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0; const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 200)); } };
const db = (u) => env.authenticatedContext(u, { email: u + '@example.com', email_verified: true }).firestore();
const ADMIN = env.authenticatedContext('admin', { email: 'lillykemoy1@gmail.com', email_verified: true }).firestore();
const Y = new Date().getFullYear();
const prof = (n, made) => ({ displayName: n, username: n, bio: '', color: '#8a2be2', createdAt: made, welcomed: true, birthY: Y - 20, birthM: 1, rulesAt: Timestamp.now() });
await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore();
  await setDoc(doc(f, 'users/newbie'), prof('newbie', Timestamp.now()));
  await setDoc(doc(f, 'users/vet'), prof('vet', Timestamp.fromMillis(Date.now() - 10 * 864e5)));
  for (const u of ['a', 'b', 'c', 'mia']) await setDoc(doc(f, 'users/' + u), prof(u, Timestamp.fromMillis(Date.now() - 10 * 864e5)));
  await setDoc(doc(f, 'roles/mia'), { mod: true, name: 'Mia', uname: 'mia', by: 'admin', at: Timestamp.now() });
  await setDoc(doc(f, 'posts/v1'), { authorId: 'vet', text: 'hi', reportCount: 0 });
});
const C = 'https://res.cloudinary.com/zfmeldgm/';
const media = (u, id, kind) => { const f = db(u); const b = writeBatch(f);
  b.set(doc(f, 'posts', id), { authorId: u, authorName: u, authorUsername: u, authorColor: '#8a2be2', type: 'media', text: 'fun', linkUrl: '',
    mediaUrl: kind === 'video' ? C + 'video/upload/v1/lks/a.mp4' : C + 'image/upload/v1/lks/a.jpg', mediaType: kind, poster: C + 'image/upload/v1/lks/a.jpg', posterUrl: C + 'image/upload/v1/lks/a.jpg',
    width: 100, height: 100, duration: kind === 'video' ? 5 : 0, cloudinaryPublicId: 'lks/a', createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false });
  b.update(doc(f, 'users', u), { lastPostAt: serverTimestamp() }); return b.commit(); };
const held = (u, id) => { const f = db(u); const b = writeBatch(f);
  b.set(doc(f, 'heldPosts', id), { post: { authorId: u, authorName: u, authorUsername: u, authorColor: '#8a2be2', type: 'media', text: 'fun', linkUrl: '', mediaUrl: C + 'video/upload/v1/lks/a.mp4', mediaType: 'video', poster: C + 'image/upload/v1/lks/a.jpg', createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false }, reason: '🌱 New account', level: 'borderline', authorId: u, createdAt: serverTimestamp() });
  b.update(doc(f, 'users', u), { lastPostAt: serverTimestamp() }); return b.commit(); };
const flag = (u, id) => { const f = db(u); const b = writeBatch(f); b.set(doc(f, 'posts', id, 'flags', u), { at: serverTimestamp() }); b.update(doc(f, 'posts', id), { reportCount: increment(1) }); return b.commit(); };

await ok('3-day-old-or-newer account cannot publish a video directly', assertFails(media('newbie', 'n1', 'video')));
await ok('new account video goes to heldPosts', assertSucceeds(held('newbie', 'n3')));
await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users/newbie'), { lastPostAt: Timestamp.fromMillis(0) }));
await ok('new account can still post a picture', assertSucceeds(media('newbie', 'n2', 'image')));
await ok('older account can publish a video', assertSucceeds(media('vet', 'n4', 'video')));
await ok('report flag +1 by a', assertSucceeds(flag('a', 'v1')));
await ok('same person cannot count twice', assertFails(flag('a', 'v1')));
await ok('bump without flag doc fails', assertFails(updateDoc(doc(db('b'), 'posts/v1'), { reportCount: increment(1) })));
await ok('author cannot flag own post', assertFails(flag('vet', 'v1')));
await ok('b flags', assertSucceeds(flag('b', 'v1')));
await ok('c flags (3rd)', assertSucceeds(flag('c', 'v1')));
await ok('non-mod cannot clear', assertFails(updateDoc(doc(db('a'), 'posts/v1'), { reportOk: 3 })));
await ok('mod keeps it (reportOk = reportCount)', assertSucceeds(updateDoc(doc(db('mia'), 'posts/v1'), { reportOk: 3 })));
await ok('mod cannot set a fake reportOk', assertFails(updateDoc(doc(db('mia'), 'posts/v1'), { reportOk: 99 })));
await ok('admin sets minApproved', assertSucceeds(setDoc(doc(ADMIN, 'config/mediaReview'), { minApproved: 5, updatedAt: serverTimestamp() })));
await ok('user cannot set minApproved', assertFails(setDoc(doc(db('a'), 'config/mediaReview'), { minApproved: 0 })));
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
