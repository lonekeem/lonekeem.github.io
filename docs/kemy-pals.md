# Kemy Pals: data model and reuse guide

Kemy Pals are original virtual pets that live next to profiles. This page is for anyone building on them
(Phase 2: Pal vs Pal games and the real-time Pal Park).

## Files
| File | What it is |
|---|---|
| `js/pals/species.js` | The species roster (30 Pals). **Add a species = add one object here.** |
| `js/pals/art.js` | `drawPal()` (the one renderer), parts library, egg/snack/bubble art, color presets |
| `js/pals/core.js` | Firestore data layer, stat decay, public read API |
| `js/pals/index.js` | App UI: profile strip, care sheet, creator, egg hatch, Pal Box, Gallery, play dates |
| `css/pals.css` | Styles |
| `tests/pals/gallery.html` | Renders every species (open locally, `?lv=1|5|12&mode=idle|react|sleep|eat|walk`) |

## Render any Pal: `drawPal(ctx, x, y, size, pal, state)`
```js
import { drawPal } from './js/pals/art.js';
drawPal(ctx, x, y, 64, { species: 'elephant', colors: { body: '#c9cfe8', accent: '#f3b8d3', eye: '#24133f' },
  pattern: 'spots', acc: 'crown', level: 7 }, { t: frame, face: 1, mode: 'walk', mood: { dirty: false, sad: false } });
```
- `(x, y)` is the feet centre; `size` is roughly the height in CSS px. Canvas 2D, vector, so scale freely (set your own DPR transform).
- `mode`: `idle | walk | hop | happy | sleep | eat | shake | react` (`react` plays the species' own tap reaction: trunk spray, tail wag, flap, roll, roar, flame puff...).
- `level` picks the form: 1-4 baby, 5-11 kid, 12+ grown-up glow-up (aura + bigger body).
- Missing colors fall back to the species defaults; unknown species fall back to Kemy.

## Species entry (`species.js`)
`{ id, name, vibe, body, acc, ears, snout, tail, feet, body2?, extras: [], react, forms: [baby, kid, grown], blurb }`
Parts are listed at the top of `species.js`. Vibes (`water, star, leaf, flame, spark, moon`) are flavor for games, not combat.
Species ids must match `^[a-z]{2,16}$` (enforced by the rules), so new species need no rules change.

## Data model (Firestore)
- `users/{uid}.activePet`: `'p1'..'p6'` or `''`: the Pal shown on the profile.
- `users/{uid}/pets/{p1..p6}` (public read, owner write):
  `species, name (1-20), colors {body, accent, eye} (#rrggbb), pattern (none|spots|stripes|sparkle), acc (none|bow|crown|shades|scarf|hat|badge),
  xp (0-4900, +60 max per write), level (= floor(xp/100)+1), stats {happy, hunger, energy, clean} (0-100 ints, snapshot),
  at (time of the stats snapshot), pats (counter, only visitors can +1), createdAt, updatedAt` (owner writes at most once per second).
- `.../pets/{pid}/pats/{visitorUid}` `{uid, at}`: one pat per visitor per Pal per 20 h; written in a batch with `pats + 1`.
- `.../pets/{pid}/playdates/{visitorUid}` `{uid, pet, at}`: a visiting Pal played here; one per visitor per Pal per 20 h.
- Notifications `pal_pat` and `pal_play` go to `users/{uid}/notifications` like other notification types.

Stats are never stored as live values: read `liveStats(pet)` (core.js), which applies decay since `at`
(hunger -4/h, clean -3/h, energy -3/h but +6/h at night, happy -2/h plus more when other needs are low; never below 5, so a Pal never "dies").

## Public read API (`core.js`)
```js
import { getActivePal, listPals, readPet, liveStats, moodOf, formName } from './js/pals/core.js';
const pal = await getActivePal(db, uid);   // a user's active Pal (or first Pal), or null. Works signed out.
const all = await listPals(db, uid);       // all of a user's Pals
liveStats(pal) -> { happy, hunger, energy, clean }; moodOf(stats) -> { dirty, sad, hungry, tired, low }
```

## Phase 2 notes
- **Pal vs Pal games**: load both players' `getActivePal()`, draw with `drawPal`; use `vibe` for game flavor. Award XP through
  `createStore(db, myUid).save(pal, { xpGain })` (rules cap +60 per write) or dispatch `kemy:xp` in the app (`detail: { n }`).
- **Pal Park (real time)**: keep positions in a separate ephemeral collection (e.g. `parkRooms/{room}/walkers/{uid}`
  `{ x, y, face, mode, petId, at }`); render each walker with `drawPal` using the pet doc fetched once. Don't write pet docs per frame.
- Pet docs are small and public, so cache them per session.

## Overlays (`js/pals/overlays.js`)
- `liveOverlay(ctx, root, { liveId, hostId, isHost })`: the host's active Pal bounces onto live screens (in-app WebRTC and YouTube big live) as a DOM canvas overlay (never in the video). Draggable (position saved per device), catches/wiggles when `.lstar` stars float, waves when the viewer count rises, viewers tap to pet (2.5 s local cooldown + one counted pat per day via the pats rules). The host's "Hide Pal" sets `lives/{id}.palHidden` (whitelisted in the host live-update rule).
- `popups({ S, db })`: occasional pop-ups of your own Pal while scrolling video screens (For You, Following, Explore, Movies/Songs, profiles, stories, posts): at most once per 4 minutes, mid-height screen edge (clear of bottom video controls), mood lines ("Feed me!"), tap = bubble poof. Toggle in Pal Box (`localStorage['kemy-pals-popups']`). Reduced motion: fade only.
