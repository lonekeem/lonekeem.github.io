# Series & Episodes (Community Movies)

A **series** groups a creator's own movie posts into numbered seasons and episodes.

- `series/{sid}`: owner, title, description, genre, AI tools, age rating, cover (Cloudinary image or empty),
  `episodes: [{p: postId, s: season, e: episode}]`, `postIds` (same ids, for "which series is this movie in"),
  `followerCount`, and optional `ai` (Movie Maker style, seed, cast) so the next episode matches.
- `series/{sid}/followers/{uid}`: followers. Each new episode sends them an `episode` notification.
- `users/{uid}/watch/{postId}`: private progress `{sid, t, dur}` for **Continue watching**.
- Studio series (`ownerId: 'studio'`, created by the admin with "Lone Keem Studios Original") show under
  **Lone Keem Studios Originals** in Explore → Movies.

Where it shows up: Explore → Movies (Originals row, Series row, "Series" filter chip), the series page
`#/series/:id` (banner, Follow, season picker, episode list with thumbnail, length, views, stars, progress bar,
Continue watching), each episode's page (S1 E3 label, Previous / Next, next-episode autoplay with an 8-second
countdown, resume where you left off), profiles (Series tab) and the home page Community Movies row.

Creating: `#/series/new`. Add episodes when sharing a movie ("Add to a series": series, season, episode
number; later episodes in that season move down one), or later from the series' Edit page, where episodes can
also be reordered (↑/↓) or removed. **Make next episode** opens the AI Movie Maker with the series' style,
characters and seed, plus an optional "Previously on…" card.

Rules (firestore.rules → `match /series/{sid}`): only the owner (or the admin for 'studio') edits a series and
its episode list; a newly added episode must be a movie post by the owner; `postIds`/`episodeCount` must match
`episodes`; followers can only change `followerCount` by one, tied to their own follower doc; progress docs
are private. Tests: `pwtest/rules/series-test.mjs`.

Account deletion removes your series (and their follower docs), unfollows series you follow and clears your
watch progress. Movies themselves are deleted as before.
