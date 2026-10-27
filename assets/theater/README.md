# Lone Keem Studio movie + songs

## The movie (default)

By default the big screen shows **The Sheriff of Lone Keem** (the series videos in
`assets/series/sheriff/`, used in place, never copied). Logic: `js/world/theater-movie.js`.

- Every 15 minutes: a 5:00 "Next showing in m:ss" countdown (screen, outside marquee, lobby
  Now Showing stand), then all episodes back to back, then a short end card.
  Countdowns start at :00 :15 :30 :45 and shows at :05 :20 :35 :50 (local clock).
- Sync needs **no writes and no rules change**: every client works out the same spot from the
  clock, so late joiners seek straight to the right second.
- The owner's 🎬 Screen tab can start a show now, start a 5:00 countdown now, go back to the
  clock schedule, or turn showings off (saved as `pl.ma` / `pl.mo` in the theater doc).
- The `<video>` is created only while you are inside and is unloaded when you leave. Sound plays
  only in the auditorium (muted in the lobby). If the browser blocks sound (iPhone), a
  "Tap for sound" button shows. House lights dim to 12% during the movie and come back up after.
- A song started from the editor plays instead of the movie until it ends or is stopped.
- New episodes join automatically once they are released in `js/sheriff-data.js` (with their `dur`).
  If the movie grows past ~9:50, the cycle grows in whole minutes.

# Songs

The big screen can also play **only Keem's songs**, as big synced
karaoke lyrics (no video). The list ships empty. Never add the Kemy Radio songs here.

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
