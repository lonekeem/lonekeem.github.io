# Lone Keem Studio movie + songs

## Showtimes (default)

The big screen runs a fixed **2-hour program** (local clock; hour A is every even hour, hour B every odd
hour). Logic: `js/world/theater-movie.js` (`PROGRAM`, `showAt`, `listings`). Every show gets a 5:00
"Next showing in m:ss" countdown, and every show **starts on a quarter hour**:

| Hour | Starts | Film | Runtime | Ends |
|---|---|---|---|---|
| A (even) | :00 | **Spring** | 7:44 | :07:44 |
| A (even) | :15 | **Double feature:** Singularity (:15:00), Caminandes 2 (:21:39) | 6:31 + 2:26 | :24:05 |
| A (even) | :30 | **Big Buck Bunny** (the Sheriff slot) | 9:56 | :39:56 |
| A (even) | :45 | **Double feature:** Caminandes 3 (:45:00), Wing It! (:47:38) | 2:30 + 3:58 | :51:36 |
| B (odd) | :00 | **Big Buck Bunny** | 9:56 | :09:56 |
| B (odd) | :15 | **Spring** | 7:44 | :22:44 |
| B (odd) | :30 | **Double feature:** Singularity (:30:00), Caminandes 3 (:36:39) | 6:31 + 2:30 | :39:09 |
| B (odd) | :45 | **Double feature:** Caminandes 2 (:45:00), Wing It! (:47:34) | 2:26 + 3:58 | :51:32 |

Countdowns run 5:00 before each start (:55, :10, :25, :40 every hour). Each film is preceded by an
8 s title card (inside the countdown, or between the two films of a double feature):
the first 4 s are the poster title card, the **last 4 s (`CARD`) a full-screen credit card** (black, gold frame, big
white/gold type: title, makers, "Licensed under CC BY 4.0", the license deed address and the source page), so no
start time moves. Multi-part films get it once, before part 1. The seat "Screen view" fills the phone with it.
When a film (or each back-to-back short) starts, or you walk in mid-film, a one-line **credit line** (title, makers
truncated with …, license; under the Stuck button / minimap) shows for 8 s, then fades to a small round 🎬 button. It is off
while the big card is up (your own name tag hides then too, so it never covers "Starting in"). Tap it, or **📜 Film credits & licenses** in the 🕒 Showtimes list, for the **credits panel** (every film, makers,
license + deed, source page, the "shown unchanged except re-encoded" note; the Stuck and top-right buttons hide while a theater panel is open). Web addresses there and on
`#/sounds` are plain selectable text, never links (kid-directed app: no `<a href>` / `window.open` to outside sites).
The 6 films fill four 15-minute slots (the shorts paired up), so every film plays **twice** every 2 hours, in a
different order each hour. Every slot fits in 15 minutes, so the longest end card before the next countdown is about 3.5 minutes.

- **The Sheriff is not in the theater yet.** `SHERIFF_IN_THEATER = false` in `js/world/theater-movie.js`
  gives everyone the family lineup in the Sheriff slot (A :30, Big Buck Bunny), and no Sheriff poster, plate, board row, marquee or
  video appears anywhere in the theater. Set it to `true` to bring it back (13+ only, ep 1–3, 9:43 at :00).
  The Kemy series page `#/series/sheriff` and its 13+ gate are separate and unchanged.
- **13+ gate (when the flag is on):** The Sheriff needs age 13+ from the trusted age source (`viewerAge()` in `js/safety.js`,
  wrapped by `js/sheriff-age.js`). Under-13 or unknown-age viewers see the friendly card on the
  Sheriff page, and in the theater the Sheriff slot (A :30) becomes **Big Buck Bunny**
  (same clock) on the screen, board, 2D list, lobby poster and marquee. This is
  local only: no writes and no rules change.
- **Lobby:** the showtimes board (poster thumbs, titles, runtimes, the next 3 times, NOW PLAYING /
  UP NEXT, live) is on the lobby wall. Tap it, or the 🎟 Showtimes button, to open the 2D list.
  There are 6 gold-framed posters, one per film (east wall: Big Buck Bunny/Sheriff frame + Wing It!; west wall: Singularity + Spring; back wall: Caminandes 2 + 3 either side of the auditorium doors) with title plates and the next showtime. Poster textures load
  lazily and are about 20–40 KB webp each.
- **Outside:** the facade has 6 lit, gold-framed poster cases, one per film (Singularity, Spring,
  Big Buck Bunny (Sheriff case) | doors | Caminandes 2, Caminandes 3, Wing It!), each with a title plate and the next show. The textures load the first time a player
  comes near. Under-13 and unknown-age players see the Big Buck Bunny poster in the Sheriff case.
- **Fit:** wide films cover-fit the screen. The portrait Sheriff is shown sharp in the centre with
  blurred sides.
- Sync needs **no writes and no rules change**: every client works out the same spot from the
  clock, so late joiners seek straight to the right second.
- The owner's 🎬 Screen tab can start any slot now, start a 5:00 countdown now, go back to the
  clock schedule, or turn showings off (saved as `pl.ma` / `pl.mo` / `pl` slot in the theater doc).
- **Long films are split into parts** (< 50 MB each, cut on keyframes). The player has two `<video>`
  decks (A/B, never in the DOM): about 12 s before a part ends, the next part is buffered paused on the
  other deck, and at the boundary the screen swaps to it with no gap (the old frame stays up until the
  new deck has a frame). At most the current and next part are loaded. A mid-movie join loads only the
  part the clock is in and seeks to the right second. Decks are created only while you are inside and
  unloaded when you leave.
  Sound plays only in the auditorium (muted in the lobby). If the browser blocks sound (iPhone), a
  "Tap for sound" button shows. House lights dim to 12% during a film.
- A song started from the editor plays instead of the movie until it ends or is stopped.
- Tests: `node tests/world/theater-schedule.test.mjs` (unit) and `tests/world/theater-films-e2e.mjs` (emulator).

## Film files and credits (`assets/theater/films/`)

All films are shown unchanged (re-encoded to H.264 + AAC, faststart, 720p, ~0.8–1.2 Mbps, every file
under 50 MB, webp posters under 100 KB). The credit is shown on each title card, in the countdown, on
the board and 2D list, in the in-play credit line and credits panel, and on `#/sounds` (license deed as plain text).

**Blender Foundation** (studio.blender.org), from official Blender sources:

> *Title* © Blender Foundation | studio.blender.org, CC BY *version* (makers: Blender Studio / Blender Foundation; source page studio.blender.org/films/*file*/)

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
`theater-movie.js` (slots are whole 15-minute steps, including the 5:00 countdown; split long films into `reels`), update the
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
