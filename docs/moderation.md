# Moderators

- **Appoint / remove**: Admin page (`#/admin`) → "✓ Moderators" card → search name/@handle → *Make moderator* / *Remove moderator*. Only the verified admin can write `roles/{uid}` (firestore.rules).
- **Blue check**: everyone in `roles/` gets a blue ✓ next to their name (profiles, feed, comments, chat, search, Pal Park name tags + bubbles, zombie lobby, game lobbies). Tap = "Kemy Moderator".
- **Moderator Tools** (`#/mod`): "🛡️ Mod" pill in the top bar (floating 🛡️ button on the full-screen feed), "Moderator" on your profile, "Moderator Tools" in Settings. Red number = open + in-review reports.
  - Reports: filters (To do / Open / In review / Resolved / All, type). Actions: In review, Dismiss, Remove content, Warn, Suspend (1 / 7 / 30 days / permanent, reason, optional "remove account"), Unsuspend, Reply to reporter. Messages arrive as "Kemy Moderators" notifications.
  - Users: search anyone, warn / suspend / unsuspend; list of suspended accounts.
  - Audit log (`#/mod/log`, admin only): every moderator action (`modLog/`, append-only).
- **Suspensions** (`bans/{uid}`) are enforced by rules: no posts, stories, comments, chats, Pal Park, zombie lobbies, game creation / matchmaking. The app shows "Your account is paused".
- **No server** (free GitHub Pages): Auth accounts can't be deleted. "Remove account" = permanent suspension + `hiddenUsers/{uid}` (their posts / comments hidden in the app).
- Tests: `firebase emulators:exec --config firebase.emu.json --only firestore --project demo-mod "node tests/mod/mod-rules.test.mjs"`

## Mod Hub (`#/mod/<tab>`)
Tabs: Dashboard · Review queue · Reports · Users · Bugs & feedback · Content · Mod inbox · Team notes · Audit log (admin) · Admin (admin: moderators + invites, publish shop prices).
- **Auto-flag / hold**: every new post (text, link, photo/video, movie, song) runs a kid-safe word check (`autoFlag` in js/moderation.js). Clearly bad *and* borderline matches go to `heldPosts/{id}` instead of `posts/`, so nobody else can read them (rules). The poster sees "Your post is being reviewed". Queue actions: Restore (exact copy back into posts/), Delete, Delete + Warn (pre-filled), Suspend. Moderators can also "Hide for review" any live post from Content.
- **Mod inbox**: `modThreads/{uid}/m` two-way threads; users see "Kemy Moderators" in Messages (`#/support`) and can reply (even while suspended, to appeal).
- **Bugs & feedback**: `feedback/` from Settings → "Report a bug / Send feedback" (`#/feedback`); statuses new / in progress / fixed / closed + notes.
- **Team notes**: `modNotes/`.
- **Invites**: admin taps "🛡️ Invite as moderator" (profile or Admin card) → `modInvites/{uid}` pending → the user opens `#/mod-invite` and Accepts (creates their own `roles/{uid}` in the same batch, allowed only from a pending invite) or Declines; the admin gets a notification.
