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
