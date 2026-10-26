// Rules tests: creator age limit on posts (minAge 0 / 13 / 17), set on create and changed later by the owner.
// Run: firebase emulators:exec --config firebase.emu.json --only firestore --project demo-age "node tests/safety/age-rules.test.mjs"
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
const ps = async (f, u) => { const d = (await getDoc(doc(f, 'users', u))).data() || {}; const D = Math.floor(Date.now() / 864e5); return { postDay: D, postsToday: d.postDay === D ? (d.postsToday || 0) + 1 : 1 }; };
const env = await initializeTestEnvironment({ projectId: 'demo-age', firestore: { host: '127.0.0.1', port: 8199, rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
let pass = 0, fail = 0; const ok = async (n, p) => { try { await p; pass++; console.log('PASS', n); } catch (e) { fail++; console.log('FAIL', n, e.message.slice(0, 200)); } };
const db = (u) => env.authenticatedContext(u, { email: u + '@example.com', email_verified: true }).firestore();
const Y = new Date().getFullYear();
const old = Timestamp.fromMillis(Date.now() - 10 * 864e5);
const prof = (n) => ({ displayName: n, username: n, bio: '', color: '#8a2be2', createdAt: old, welcomed: true, birthY: Y - 20, birthM: 1, rulesAt: Timestamp.now() });
await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); for (const u of ['vet', 'other']) await setDoc(doc(f, 'users/' + u), prof(u)); });
const C = 'https://res.cloudinary.com/zfmeldgm/';
const reset = (u) => env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users/' + u), { lastPostAt: Timestamp.fromMillis(0) }));
const media = async (u, id, extra) => { await reset(u); const f = db(u); const b = writeBatch(f);
  b.set(doc(f, 'posts', id), { authorId: u, authorName: u, authorUsername: u, authorColor: '#8a2be2', type: 'media', text: 'fun', linkUrl: '',
    mediaUrl: C + 'video/upload/v1/lks/a.mp4', mediaType: 'video', poster: C + 'image/upload/v1/lks/a.jpg', posterUrl: C + 'image/upload/v1/lks/a.jpg',
    width: 100, height: 100, duration: 5, cloudinaryPublicId: 'lks/a', createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false, ...extra });
  b.update(doc(f, 'users', u), { lastPostAt: serverTimestamp(), ...(await ps(f, u)) }); return b.commit(); };

await ok('post without minAge (all ages, old shape)', assertSucceeds(media('vet', 'p0', {})));
await ok('post with minAge 13', assertSucceeds(media('vet', 'p13', { minAge: 13 })));
await ok('post with minAge 17', assertSucceeds(media('vet', 'p17', { minAge: 17 })));
await ok('post with minAge 0', assertSucceeds(media('vet', 'pz', { minAge: 0 })));
await ok('minAge 18 rejected', assertFails(media('vet', 'p18', { minAge: 18 })));
await ok('minAge string rejected', assertFails(media('vet', 'ps', { minAge: '13' })));
await ok('owner raises 0 → 17', assertSucceeds(updateDoc(doc(db('vet'), 'posts/p0'), { minAge: 17 })));
await ok('owner lowers 17 → 13', assertSucceeds(updateDoc(doc(db('vet'), 'posts/p17'), { minAge: 13 })));
await ok('owner clears to all ages', assertSucceeds(updateDoc(doc(db('vet'), 'posts/p13'), { minAge: 0 })));
await ok('owner cannot set 16', assertFails(updateDoc(doc(db('vet'), 'posts/p13'), { minAge: 16 })));
await ok('someone else cannot change it', assertFails(updateDoc(doc(db('other'), 'posts/p0'), { minAge: 0 })));
await ok('minAge + other field together rejected', assertFails(updateDoc(doc(db('vet'), 'posts/p0'), { minAge: 13, text: 'x' })));
await ok('category change still works', assertSucceeds(updateDoc(doc(db('vet'), 'posts/p0'), { cat: 'funny' })));
await ok('bad category still rejected', assertFails(updateDoc(doc(db('vet'), 'posts/p0'), { cat: 'nope' })));
console.log(`\n${pass} passed, ${fail} failed`); await env.cleanup(); process.exit(fail ? 1 : 0);
