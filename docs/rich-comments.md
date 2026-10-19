# Rich comments

Comments on posts, movies, songs and replies can hold **text, one media item, or text plus one
media item**. Stars, replies, Report and delete work on all of them. Live chat has an emoji button
(live chat stays text-only, so there are no GIFs or photos in lives).

| Media | Stored on the comment | Where it comes from |
|---|---|---|
| Emoji | inside `text` | `js/emoji-data.json` (Unicode emoji up to E14, 9 categories, skin tones, recents in localStorage) |
| GIF | `media: {kind:'gif', id, url, w, h}` | GIPHY search and trending, rating `pg`, "Powered by GIPHY" shown |
| Photo | `media: {kind:'photo', url, w, h}` | Cloudinary unsigned preset `lks_comment_media` → `lks/comment-media/` |
| Pal sticker | `media: {kind:'sticker', petId, pose}` | The commenter's own Pal, drawn live with `drawPal` from `js/pals/art.js`. Poses: wave, love, laugh, cry, wow, dance, sleepy |

Code: `js/richcomments.js` (pickers, upload, sticker renderer, `mediaHtml`) and `js/comments.js`.

## GIFs need a free GIPHY key (one-time setup)
GIFs stay hidden until a key is set. GIPHY keys are public, client-side keys by design.
1. Create a free account at https://developers.giphy.com/ → **Create an API key** → choose **API** (not SDK).
2. Paste the key into `js/media-config.js`: `export const GIFS = { provider: 'giphy', key: 'YOUR_KEY', rating: 'pg' }`.
3. Bump the `CACHE` version in `sw.js` and push.
A beta key allows about 100 searches an hour. Apply for a production key (free) in the GIPHY
dashboard once the app gets more use. Only the GIF id and its giphy.com URL are saved.

## Photo limits
JPG, PNG, WebP, GIF or HEIC, up to 15 MB picked. The app shrinks photos to 1600 px JPEG first, and anything still over 10 MB is refused.
The preset accepts images only (jpg, png, webp, gif) into `lks/comment-media`. Re-create it with
`scripts/cloudinary-setup.mjs`.

## Rules (firestore.rules → comments)
- `media` must be one of the three shapes above, with no extra fields.
- GIF URLs must be `https://media*.giphy.com/…` or `https://i.giphy.com/…` (no query strings).
- Photo URLs must be `https://res.cloudinary.com/zfmeldgm/image/upload/…/lks/comment-media/<id>`.
- A sticker's `petId` must exist under `users/{author}/pets`.
- Text can be 0–500 characters with media, or 1–500 without it. Media can't be edited later.
- Blanking a comment that has replies ("Comment deleted") also removes its media.

Tests: `pwtest/rules/richcomments-test.mjs`.

## Deleting comment photos
The browser can't delete Cloudinary files (that needs the API secret). When a comment, post or
account is deleted, its photo becomes an orphan. `node scripts/cloudinary-cleanup.mjs` reads every
comment (collection-group query) and removes `lks/comment-media` files nothing uses any more. See
docs/media-cleanup.md.
