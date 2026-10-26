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
