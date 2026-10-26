// "The Sheriff of Lone Keem" release config, shared by the small entry cards and the lazy series page.
// Keem releases episodes by hand. To release the next one: copy its encoded epN.mp4 into
// assets/series/sheriff/ and flip that episode's `released` to true below. Written by Lone Keem.
export const SHERIFF_EPISODES = [
  { n: 1, title: 'The Stranger in Lone Keem', dur: 210.8, released: true },
  { n: 2, title: 'An Unlikely Alliance', dur: 256, released: true },
  { n: 3, title: 'Bringing the Fight Home', dur: 121.9, released: true }
];
export const SHERIFF_PROGRESS_KEY = 'lks-sheriff-progress';
export const isOut = (e) => !!(e && e.released);
// Stars + comments: every episode is backed by a real post doc posts/sheriff-ep<n>, authored by the
// Lone Keem Studios account, so Kemy's normal star / comment / report / safety code works unchanged.
// A new episode's post is created once with scripts/sheriff-posts.cjs (Admin SDK, idempotent).
// These posts are hidden from the normal lists (home, explore, studio grid, For You) because the
// series has its own cards, and Episode 1 is placed in For You by js/watch.js.
export const sheriffPostId = (n) => `sheriff-ep${n}`;
export const isSheriffPost = (p) => !!p && /^sheriff-ep\d+$/.test(String(p.id || p));
export const sheriffEpOf = (p) => { const m = /^sheriff-ep(\d+)$/.exec(String((p && p.id) || p || '')); return m ? Number(m[1]) : 0; };
