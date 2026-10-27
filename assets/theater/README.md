# Lone Keem Studio movie + songs

## Showtimes (default)

The big screen runs a fixed program every hour (local clock). Logic: `js/world/theater-movie.js`
(`PROGRAM`, `showAt`, `listings`). Every show gets a 5:00 "Next showing in m:ss" countdown, and
every show **starts on a quarter hour**:

| Starts | Film | Runtime | Ends |
|---|---|---|---|
| :00 | **Cartoon Shorts Triple Feature:** Caminandes 2 (:00:00), Caminandes 3 (:02:34), Wing It! (:05:12) | 2:26 + 2:30 + 3:58 | :09:10 |
| :15 | **Big Buck Bunny** | 9:56 | :24:56 |
| :30 | **Spring** | 7:44 | :37:44 |
| :45 | **Singularity** | 6:31 | :51:31 |

Countdowns run :55–:00, :10–:15, :25–:30, :40–:45. Each Blender film is preceded by an 8 s title
card that shows its credit.

- **The Sheriff is not in the theater yet.** `SHERIFF_IN_THEATER = false` in `js/world/theater-movie.js`
  gives everyone the family lineup in the :00 slot (the cartoon triple feature), and no Sheriff poster, plate, board row, marquee or
  video appears anywhere in the theater. Set it to `true` to bring it back (13+ only, ep 1–3, 9:43 at :00).
  The Kemy series page `#/series/sheriff` and its 13+ gate are separate and unchanged.
- **13+ gate (when the flag is on):** The Sheriff needs age 13+ from the trusted age source (`viewerAge()` in `js/safety.js`,
  wrapped by `js/sheriff-age.js`). Under-13 or unknown-age viewers see the friendly card on the
  Sheriff page, and in the theater the :00 slot becomes the **Cartoon Shorts Triple Feature**
  (Caminandes 2, Caminandes 3, Wing It!, same clock) on the screen, board, 2D list, lobby poster and marquee. This is
  local only: no writes and no rules change.
- **Lobby:** the showtimes board (poster thumbs, titles, runtimes, the next 3 times, NOW PLAYING /
  UP NEXT, live) is on the lobby wall. Tap it, or the 🎟 Showtimes button, to open the 2D list.
  There are 7 gold-framed posters (Singularity hangs left of the entrance doors, next to Caminandes 3) with title plates and the next showtime. Poster textures load
  lazily and are about 20–40 KB webp each.
- **Outside:** the facade has 6 lit, gold-framed poster cases (Spring, Big Buck Bunny, The Sheriff | doors |
  Caminandes 2, Caminandes 3, Wing It!), each with a title plate and the next show. The textures load the first time a player
  comes near. Under-13 and unknown-age players see the Caminandes Double Feature poster in the Sheriff case.
  Singularity has no facade case yet (lobby frame, board and list only).
- **Fit:** wide films cover-fit the screen. The portrait Sheriff is shown sharp in the centre with
  blurred sides.
- Sync needs **no writes and no rules change**: every client works out the same spot from the
  clock, so late joiners seek straight to the right second.
- The owner's 🎬 Screen tab can start any slot now, start a 5:00 countdown now, go back to the
  clock schedule, or turn showings off (saved as `pl.ma` / `pl.mo` / `pl` slot in the theater doc).
- There is only ONE `<video>`. It is created only while you are inside and unloaded when you leave.
  Sound plays only in the auditorium (muted in the lobby). If the browser blocks sound (iPhone), a
  "Tap for sound" button shows. House lights dim to 12% during a film.
- A song started from the editor plays instead of the movie until it ends or is stopped.
- Tests: `node tests/world/theater-schedule.test.mjs` (unit) and `tests/world/theater-films-e2e.mjs` (emulator).

## Film files and credits (`assets/theater/films/`)

All of these open movies are by the **Blender Foundation** (studio.blender.org). They were downloaded from
official Blender sources and re-encoded to H.264 + AAC, faststart, 720p, under 50 MB, with webp posters
under 100 KB. No other changes were made. The required credit, shown on each title card, on the board
and on `#/sounds`, is:

> *Title* © Blender Foundation | studio.blender.org, CC BY

| File | Film | Year | License | Size |
|---|---|---|---|---|
| big-buck-bunny.mp4 | Big Buck Bunny | 2008 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 46.9 MB |
| spring.mp4 | Spring | 2019 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 46.9 MB |
| caminandes-2.mp4 | Caminandes 2: Gran Dillama | 2013 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 27.5 MB |
| caminandes-3.mp4 | Caminandes 3: Llamigos | 2016 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 28.3 MB |
| wing-it.mp4 | Wing It! | 2023 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 47.3 MB |
| singularity.mp4 | Singularity | 2026 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 45.4 MB |

Singularity's credit is Blender Studio's own line: *Singularity (CC) Blender Foundation | studio.blender.org, CC BY 4.0*.
Source: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:SINGULARITY_-_Blender_Open_Movie-full_movie.webm)
(4K HDR AV1, CC BY 4.0, Blender Studio). Tone-mapped from HDR to SDR and re-encoded to 1280x536; the poster is a
frame from the film (6:31 total, no dialogue).

To add a film, put `<key>.mp4` and `<key>.webp` here, add it to `FILMS` and `PROGRAM` in
`theater-movie.js` (the slot must fit inside 15 minutes, including the 5:00 countdown), update the
schedule test, and bump `sw.js`.

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
