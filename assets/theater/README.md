# Lone Keem Studio songs

The big screen in the Lone Keem Studio theater plays **only Keem's songs**, as big synced
karaoke lyrics (no video). The list ships empty, so the screen shows the idle
"LONE KEEM STUDIO · Now Showing · Coming Soon" card. Never add the Kemy Radio songs here.

## Add a song (2 files + 1 line)

1. `assets/theater/<key>.mp3` — the audio. `key` = lowercase letters, numbers and dashes, e.g. `my-song`.
2. `assets/theater/<key>.json` — the lyrics, same format as `assets/lyrics/*.json`:

   ```json
   { "bpm": 96, "instrumental": false, "lines": [ { "t": 12.4, "e": 15.9, "line": "First line of the song" } ] }
   ```

   `t` = start second, `e` = end second (optional), `line` = the words shown on the screen.
   `bpm` and `instrumental` are optional.
3. Add one line to `THEATER_SONGS` in `js/world/theater-songs.js`:

   ```js
   { key: 'my-song', title: 'My Song', artist: 'Lone Keem' }, // optional dur: seconds
   ```

4. Bump the service-worker cache version in `sw.js`, then push.

## How playback works

Keem's admin account (the owner) gets ▶ Play / ⏸ Pause / ⏭ Next in the theater's 🎨 Edit theater panel.
Play is saved to the shared `theater/lone-keem-studio` doc, so everyone inside hears the same
spot in the song and sees the same lyric line. The house lights fade down over about 2–3 seconds when
a song starts (aisle/step lights and exit signs stay lit) and fade back up on pause or end.

## Testing without committing a song

On localhost you can set `window.__theaterTestSongs = [{ key: 'test-track', title: 'Test', src: '/path/test.mp3', lrc: '/path/test.json' }]`
before the page loads (for example from a Playwright init script). Don't commit test tracks.
