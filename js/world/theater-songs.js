// 🎬 Lone Keem Studio big-screen playlist. ONLY songs Keem sends go here (never the Kemy Radio songs).
// The screen shows big synced karaoke lyrics (no video). Empty list = the idle "Now Showing: Coming Soon" screen.
//
// Add a song = 2 files + 1 line:
//   1. assets/theater/<key>.mp3   (key: lowercase letters, numbers, dashes, e.g. my-song)
//   2. assets/theater/<key>.json  lyrics, same format as assets/lyrics/*.json:
//        { "lines": [ { "t": 12.4, "e": 15.9, "line": "First line of the song" }, ... ] }
//      t = start second, e = end second (optional), line = the words.
//   3. one line below: { key: 'my-song', title: 'My Song', artist: 'Lone Keem' },
//      (optional dur: seconds; otherwise the mp3's own length is used)
// Then bump the service-worker cache version in sw.js and push.
export const THEATER_SONGS = [
];
