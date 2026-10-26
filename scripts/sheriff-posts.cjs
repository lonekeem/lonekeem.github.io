// Creates the posts/sheriff-ep<n> docs that back stars + comments on "The Sheriff of Lone Keem".
// One post per released episode, authored by the Lone Keem Studios account, in the same shape as
// the studio's other video posts. Idempotent: a missing doc is created with zero counts; an existing
// doc only gets its static fields refreshed (counts, createdAt, comments and stars are never touched).
//
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/sheriff-posts.cjs          # dry run
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/sheriff-posts.cjs --write  # apply
//
// Run it again after releasing a new episode in js/sheriff-data.js.
const path = require('path');
const { pathToFileURL } = require('url');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const WRITE = process.argv.includes('--write');
const STUDIO = { authorId: 'studio', authorName: 'Lone Keem Studios', authorUsername: 'lonekeemstudios', authorColor: '#8a2be2' };
const ART = 'assets/series/sheriff/';
// Fixed, older createdAt: these posts are filtered out of the newest-first lists by the client, and an
// older date keeps them out of those windows for clients still running a cached older build.
const CREATED = () => admin.firestore.Timestamp.fromDate(new Date('2026-01-01T12:00:00Z'));

(async () => {
  const js = (f) => import(pathToFileURL(path.join(__dirname, '..', 'js', f)).href);
  const { SHERIFF_EPISODES, isOut, sheriffPostId } = await js('sheriff-data.js');
  const { buildKeywords, parseHashtags } = await js('search-index.js');
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT || 'lone-keem-studios' });
  const db = admin.firestore();
  for (const e of SHERIFF_EPISODES.filter(isOut)) {
    const id = sheriffPostId(e.n);
    const text = `The Sheriff of Lone Keem · Episode ${e.n}: ${e.title}`;
    const fixed = {
      ...STUDIO, type: 'media', mediaType: 'video', text, linkUrl: '',
      mediaUrl: `${ART}ep${e.n}.mp4`, poster: `${ART}ep${e.n}.webp`, studio: true,
      keywords: buildKeywords({ text, authorName: STUDIO.authorName, authorUsername: STUDIO.authorUsername }),
      hashtags: parseHashtags(text)
    };
    const ref = db.doc('posts/' + id);
    const res = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        if (WRITE) tx.create(ref, { ...fixed, createdAt: CREATED(), likeCount: 0, commentCount: 0, lastCommentId: '', viewCount: 0 });
        return 'create';
      }
      const cur = snap.data(); const diff = {};
      for (const [k, v] of Object.entries(fixed)) if (JSON.stringify(cur[k]) !== JSON.stringify(v)) diff[k] = v;
      if (!Object.keys(diff).length) return 'unchanged';
      if (WRITE) tx.update(ref, diff);
      return 'update ' + Object.keys(diff).join(',');
    });
    console.log(`${WRITE ? '' : '[dry run] '}posts/${id}: ${res}`);
  }
})().catch((err) => { console.error('ERR', err.code || '', err.message); process.exit(1); });
