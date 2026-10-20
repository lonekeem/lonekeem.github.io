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
