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

## Phase 2 (shipped): Closet & Shop, Talk to your Pal, Pal Games, Pal Park

### Outfits (`js/pals/wear.js`, `js/pals/catalog.js`)
- Pet docs have an optional `outfit` map `{ head, face, neck, body, feet, back }` of item ids. `drawPal()` draws them in three passes (back, body+feet, neck/face/head) anchored to the shared head/body layout, so every item fits every species at any size. Outfits therefore show everywhere `drawPal` is used: profile, live overlay, pop-ups, Pal Park and Pal Games (the Park/Games presence snapshot includes `outfit`).
- The rules only accept outfit items the owner has in `users/{uid}/inv/{item}`.
- Saved outfits: `users/{uid}/looks/l1..l6` `{ name, outfit }`.
- Pet `voice`: a preset id from `js/pals/voice.js`; `vx_*` voices must be owned (bought in the shop).

### Star Coins economy (cheat-resistant, no Cloud Functions)
- Wallet `users/{uid}/pal/wallet` `{ coins, total, day, earned{src:n}, src, last, lastBuy, paid, buyAt, room[] }`, public read.
- Earning: each write adds `coins` from one `src` with a per-write max and per-day cap enforced in the rules (`daily 50/50, care 5/60, win 25/150, quest 10/60, stars 5/50, park 10/100, chat 2/20`), at least 1 s apart. `total` (lifetime) can only grow with coins.
- Buying: one batch = wallet (`coins -= paid`, `lastBuy`, `buyAt = now`) + `inv/{item}` (`n + 1`). The rules check `paid` against `config/palShop.prices[item]` or today's deal (`deals[dayNumber % deals.length]`), keep `coins >= 0`, and only allow the inventory +1 with a matching wallet purchase in the same batch. Wearables/decor/toys/voices can only be owned once; snacks stack.
- `config/palShop` is the price catalog, admin-write only. `shopDoc()` in catalog.js builds it (keep both in sync).
- Achievement items (`ach_*`) are created by the owner only when the rules can verify the goal (level 12 Pal, 1,000 coins earned, 3 Pals, 5 Pal Games wins).
- Decor in `wallet.room` (up to 3, must be owned) is drawn in the profile Pal strip.

### Talk to your Pal (`js/pals/talk.js`, `js/pals/voice.js`)
- AI: `POST https://text.pollinations.ai/openai` (free, keyless, ~1 request/30 s per IP). The client waits 31 s between AI calls and uses a scripted personality (species vibe, name, level, stats, owner handle, facts) the rest of the time or on any error.
- Safety: input filter (self-harm → gentle "talk to a trusted adult" + 988; sexual, violent and personal-info topics → safe redirect, never sent to the AI), strict kid-safe system prompt, output filter (same checks, profanity mask, no links, ≤220 chars), "AI can make mistakes" note.
- Memory: `users/{uid}/pal/chat` `{ msgs (≤12), facts (≤6) }`, owner-only; "Forget our chat" deletes it.
- Visitors get preset lines unless the owner turns on `users/{uid}/pal/settings.visitorChat`.
- Voices: 24 presets (4 unlockable). Each picks the best natural/neural device voice for its language and adds pitch/rate plus code-made giggles, squeaks and species sounds (trunk toot, purr, chirp…). Browsers don't let speech synthesis go through Web Audio, so echo/tremolo/ring-mod effects apply to the generated sound layers, not the spoken words.

### Pal Games (`js/pals/games.js`)
- `palGames/{id}` `{ game, status, players[2], names, unames, pals[2] (snapshots), seed, startAt }`; both clients play the same seeded 30 s course.
- `palGames/{id}/live/{uid}` `{ p, s, fin }`: progress/score written about twice a second (≥300 ms apart, score can't go down, frozen once `fin`).
- `palStats/{uid}` `{ wins, games }`: the rules only count a win if both players finished and your score beats theirs, once per game (`rec/{uid}` marker).
- Quick match uses `gameQueue/pal-{game}`. Friend invites reuse `type: 'game'` notifications (and `#/game/{id}` redirects to Pal Games).
- `playGame(host, game, seed, opts)` is reusable (e.g. for Pal Park mini-events).

### Pal Park (`js/pals/park.js`)
- World 3200×2400 with 4 zones (Lily Pond, Meadow, Candy Plaza, Beach), a fountain plaza with 4 Pal Games portals, and 16 daily treasures (same for everyone, seeded by date; each pays 10 coins, capped at 100/day).
- Presence `parkRooms/r{1..20}/p/{uid}` `{ x, y, d, e, eAt, say, sayAt, tgt, name, uname, color, pal, at }`. You join the first room with fewer than 20 fresh players. Writes only while moving, at most 4/s (rules: ≥200 ms apart), plus a 15 s heartbeat. Remote players are interpolated. Anyone may delete presence older than 2 min. Docs are deleted when leaving.
- Spark budget note: Firestore Spark allows 20k writes/day. One player walking non-stop for an hour is about 14k writes, so heavy use will hit the free quota. Moving the Park presence to Realtime Database (free tier, `onDisconnect`) is the recommended upgrade once a database instance is created in the Firebase console.
- Chat: preset phrases or ≤40 chars, run through the same filter as the AI chat. Tap a player for profile, pet, Report (`reports`, `targetType: 'user'`) or Block (`users/{me}/blocks`).
