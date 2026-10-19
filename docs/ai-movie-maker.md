# Kemy AI Movie Maker

Open it from **Create → Make an AI movie** or the **✨ Make an AI movie** button on Explore → Movies (`#/new/aimovie`). Code: `js/moviemaker.js`.
It's free and runs on the Firebase Spark plan with no server, no paid APIs and no keys in the front end.

| Part | How | Cost / limits |
|---|---|---|
| Script | Pollinations text API, `POST https://text.pollinations.ai/openai` (no key, JSON mode). If it fails or is busy, a built-in template writer makes a starter script. | Free, anonymous. About 1 request per 30 s per IP. Busy replies are 402/429 with `Retry-After`. |
| Scene pictures | Pollinations image API, `https://image.pollinations.ai/prompt/…?seed=…&width=1024&height=576&safe=true&nologo=true`. Each movie uses one seed and one style prompt so the look stays consistent. | Free, anonymous. About **1 image per 45 s per IP**, so a 5-scene movie takes about 3 to 4 minutes. Images can carry a small Pollinations logo. Best effort, no uptime guarantee. |
| Narration | The browser's built-in `speechSynthesis` voices (you pick the voice). | Free. Voices differ by device. |
| Music | Original chord, bass and drum loops synthesised in code (`startMusic`) in four moods. | Free, no samples. |
| Video | `<canvas>` 1280×720 at 30 fps with pan/zoom, crossfades, captions, a title card and the "Made with Kemy AI Movie Maker" end card, recorded with `MediaRecorder` (MP4 if supported, otherwise WebM). | Recorded in real time (a 5-scene movie takes about 35 s). The tab must stay open. |
| Posting | `works.publishMovie()` uploads to Cloudinary (`lks_user_uploads`, unsigned) and writes a `type: 'movie'` post with `aiTools: 'Kemy AI Movie Maker'`, rated All ages. | Same rules as Community Movies: 100 MB, 10 min. |

**Queue and retries:** one Pollinations request at a time per service. On 402/429/5xx the app waits for `Retry-After` (or backs off) and retries up to 5 times for images and 3 times for the script, showing a countdown on the scene. If a scene still fails, it gets a placeholder card the user can regenerate later.

**Editing:** change the title, any narration line or picture prompt, get a new picture (new seed), upload your own image, reorder, delete or add scenes (3 to 12).

**Safety:** `checkPrompt()` blocks sexual and gore terms, deepfake and real-person requests (including a list of well-known names) and well-known copyrighted characters or franchises. It runs on the idea, edited prompts and the title/description before posting. The page shows a "keep it original" notice. Pollinations also runs its own `safe=true` filter. This is a light filter; reports and admin moderation still apply.

**Known limits:**
- Browser speech voices can't be captured by `MediaRecorder`. The downloaded or posted video has music and burned-in captions. The spoken narrator is heard in the preview. On desktop Chrome, ticking "Record the narrator voice too" asks to share the tab's audio and mixes it in (OS voices may not be captured on every system).
- Free AI limits are per IP, so people on the same network share them.
- Very old browsers without MediaRecorder or canvas `captureStream` can't render (iOS Safari 14.5+ and current Chrome/Edge/Firefox work).

## Animated mode (default)
Characters move and talk instead of a slideshow, still free and in the browser (`js/animator.js`).
- The free text AI returns a cast (name, look, voice) and shots (background, characters with action,
  expression and position, dialogue lines, weather, camera). A built-in template is used when it's busy.
- Pictures: **one full-body image per character** ("full body character … plain solid pure white
  background") reused in every shot, plus **one background plate per shot**. A 4-shot cartoon with 2
  characters = 6 pictures ≈ 5 minutes at the free limit (~1 picture / 45 s).
- Cut-out: an edge flood-fill removes the plain background in the browser (no model download). If it can't
  find a clean edge it keeps the whole image and says so; tap **Redraw** or upload your own image.
- Puppets: walk in/out/across, slide, hop, wave, dance, pop-in, idle breathing; squash & stretch, shadows,
  blinking, mouth flaps while their line plays (tap the mouth on the character picture to line it up),
  expressions (happy, sad, surprised, angry, scared) with small effects. Parallax background, weather
  (rain, snow, sparkles, bubbles, leaves), camera moves (push in, pull out, pan, shake) and cuts.
- Voices: each character has a voice preset (Narrator, Hero, Kid, Deep, Grandpa, Grandma, Villain, Robot,
  Chipmunk, Royal, plus the free Pal voices) built on the device's speech voices. Dialogue captions show who
  is talking. As with Storybook mode, the browser can't record speech into the file unless you tick
  "Record the narrator voice too" (tab audio).
- Per shot you can change each character's position, action and expression, the lines and who says them,
  the weather and the camera, regenerate the background, reorder and delete shots.

## Series episodes
"Make next episode" (from a series page) reuses the series' style, seed and cast, and can open with a
"Previously on…" card. Posting picks the series, season and episode; the style memory is saved to the series.
