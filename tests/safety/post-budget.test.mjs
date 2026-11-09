// Normal-account video save. Before: expression cap. After: one profile read, media rules only.
// firebase emulators:exec --config firebase.emu.json --only firestore --project demo-postbudget "node tests/safety/post-budget.test.mjs"
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { deliveryUrls } from '../../js/media-config.js';
import { searchFields } from '../../js/search-index.js';

const afterRules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
console.log('rules bytes', Buffer.byteLength(afterRules));
const Y = new Date().getFullYear();
const DAY = Math.floor(Date.now() / 864e5);
const OLD = Timestamp.fromMillis(Date.now() - 40 * 864e5);
const RECENT = Timestamp.fromMillis(Date.now() - 120e3);
const base = (name, user, extra = {}) => ({
  displayName: name, username: user, bio: '', color: '#8a2be2', createdAt: OLD, welcomed: true,
  birthY: Y - 16, birthM: 6, rulesAt: OLD, usernameLower: user, displayNameLower: name.toLowerCase(),
  lastPostAt: RECENT, ...extra
});
const users = {
  tilly: base('Tilly.Bee.Nova', 'tilly.bee'),
  just12: base('Tiny Bear', 'tiny.bear', { birthY: 2013, birthM: 12 }),
  norules: base('Cool Star', 'cool.star'),
  nobirth: base('Gold Lion', 'gold.lion'),
  newbie: base('Happy Duck', 'happy.duck', { createdAt: Timestamp.fromMillis(Date.now() - 3600e3), postDay: DAY, postsToday: 0 })
};
delete users.norules.rulesAt;
delete users.nobirth.birthY;
delete users.nobirth.birthM;
const up = deliveryUrls({
  public_id: 'lks/user-uploads/mva1b2c3d4e5f60789', version: 1762480000, resource_type: 'video', secure_url: 'x'
});
let seq = 0;
const rows = [];
function video(id, text, sound) {
  const p = users[id];
  return {
    authorId: id, authorName: p.displayName, authorUsername: p.username, authorColor: p.color,
    type: 'media', text, linkUrl: '', mediaUrl: up.mediaUrl, mediaType: 'video',
    poster: up.posterUrl, posterUrl: up.posterUrl, width: 576, height: 826, duration: 102.1,
    cloudinaryPublicId: 'lks/user-uploads/mva1b2c3d4e5f60789', cat: 'music',
    ...(sound ? { sound: { id: 'cx-16626', vol: 0.8, orig: 1 } } : {}),
    ...searchFields({ text, authorName: p.displayName, authorUsername: p.username }),
    createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false
  };
}
async function run(label, rules, cases) {
  const env = await initializeTestEnvironment({
    projectId: 'demo-b' + label, firestore: { host: '127.0.0.1', port: 8199, rules }
  });
  await env.withSecurityRulesDisabled(async (c) => {
    const f = c.firestore();
    for (const [id, p] of Object.entries(users)) await setDoc(doc(f, 'users', id), p);
  });
  const db = (id) => env.authenticatedContext(id, { email: id + '@example.com', email_verified: true }).firestore();
  for (const c of cases) {
    const f = db(c.id);
    const b = writeBatch(f);
    c.build(b, f);
    const prof = users[c.id];
    b.update(doc(f, 'users', c.id), { lastPostAt: serverTimestamp(), postDay: DAY, postsToday: (prof.postsToday || 0) + 1 });
    let result = 'PASS';
    try { await b.commit(); }
    catch (e) { result = String(e.message || '').includes('1000 expressions') ? 'EXPR' : 'DENY'; }
    const ok = c.expect === 'BLOCK' ? result !== 'PASS' : result === c.expect;
    rows.push(ok);
    console.log(ok ? 'PASS' : 'FAIL', label, result.padEnd(5), 'want', c.expect.padEnd(5), c.label);
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'users', c.id), { lastPostAt: RECENT, postsToday: prof.postsToday || 0 }, { merge: true }));
  }
  await env.cleanup();
}
const put = (id, label, kind, data, expect) => ({
  id, label, expect, build: (b, f) => b.set(doc(f, kind + (++seq)), data)
});
await run('after', afterRules, [
  put('tilly', 'original-audio empty', 'posts/p', video('tilly', '', false), 'PASS'),
  put('tilly', 'original-audio caption', 'posts/p', video('tilly', 'New music video', false), 'PASS'),
  put('tilly', 'added sound empty', 'posts/p', video('tilly', '', true), 'PASS'),
  put('tilly', 'added sound caption', 'posts/p', video('tilly', 'New music video', true), 'PASS'),
  put('newbie', 'direct video under 3 days', 'posts/p', video('newbie', '', false), 'BLOCK'),
  { id: 'newbie', label: 'held original-audio video', expect: 'PASS', build: (b, f) => b.set(doc(f, 'heldPosts/h' + (++seq)), { post: video('newbie', '', false), reason: 'New account video', level: 'borderline', authorId: 'newbie', createdAt: serverTimestamp() }) },
  put('just12', 'under 13', 'posts/p', video('just12', '', false), 'BLOCK'),
  put('norules', 'no rules agreement', 'posts/p', video('norules', '', false), 'BLOCK'),
  put('nobirth', 'no birthday', 'posts/p', video('nobirth', '', false), 'BLOCK'),
  put('tilly', 'off-cloud url', 'posts/p', { ...video('tilly', 'New music video', false), mediaUrl: 'https://evil.example/video/upload/v1/a.mp4' }, 'BLOCK'),
  put('tilly', 'query on our host', 'posts/p', { ...video('tilly', 'New music video', false), mediaUrl: up.mediaUrl + '?x=1' }, 'BLOCK'),
  put('tilly', 'three links in a video caption', 'posts/p', video('tilly', 'http://a.co http://b.co http://c.co', false), 'BLOCK'),
  put('tilly', 'three links', 'posts/p', {
    authorId: 'tilly', authorName: 'Tilly.Bee.Nova', authorUsername: 'tilly.bee', authorColor: '#8a2be2',
    type: 'text', text: 'https://a.com https://b.com https://c.com', linkUrl: '', mediaUrl: '', mediaType: '', poster: '',
    createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false
  }, 'BLOCK'),
  put('tilly', 'two links allowed', 'posts/p', {
    authorId: 'tilly', authorName: 'Tilly.Bee.Nova', authorUsername: 'tilly.bee', authorColor: '#8a2be2',
    type: 'text', text: 'see https://a.com and www.b.com', linkUrl: '', mediaUrl: '', mediaType: '', poster: '',
    createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false
  }, 'PASS')
]);
const bad = rows.filter((ok) => !ok).length;
console.log(`\n${rows.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
