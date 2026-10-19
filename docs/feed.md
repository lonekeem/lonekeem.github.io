# Kemy video feed: tabs, ranking and outside content

## Before (up to Oct 19, 2026)
`js/watch.js` loaded 60 video, 60 photo and 60 link posts (three queries with no ordering, so
Firestore returned them in document-id order, not newest), merged them, dropped blocked creators and
sorted **newest first**. There was no personalisation, no categories and no outside content.

## Now
Tabs: **For You · Following · Funny · News · Dance · Trending** (`#/watch`, `#/watch/funny`, …).

- **Categories.** The upload forms (camera/library post, text/link post, movie/song) have category chips:
  Funny, News, Music, Gaming, Pals, Art, Sports, Movies, Animals, Food, Dance, Learning, Other (`post.cat`).
  Older posts get a guessed category from #hashtags, the caption or the movie genre (`js/feed-cats.js`).
  For example, a Lone Keem Studios video tagged #funny shows up in Funny. The admin or the author can
  also set `cat` later; the rules allow it.
- **For You** (`js/feedrank.js`, all on the device):
  - score = engagement × freshness × interests.
    - engagement = log(stars×2 + comments×3 + shares×4 + views×0.2)
    - freshness halves after about 36 h
    - interests = learned weights for categories and creators
  - Interests go up when you watch to the end, star, comment, share or save. They go down when you
    swipe away within 2 s. Things you watched in the last 3 days sink. Followed creators get ×1.3.
  - A diversity pass stops the same creator appearing within 3 slots.
  - A little randomness keeps it fresh. Up to 12 curated funny YouTube videos are mixed in, one per 4 Kemy posts.
- **Trending**: engagement per hour over the last 72 h (7 days when it's quiet).
- **Following**: posts from people you follow, newest first.
- **Funny / Dance**: Kemy posts in that category first, with curated YouTube videos mixed in (one per 2).
  **News**: Kemy news posts, then alternating headline cards and news videos.
- **Storage**: interests sit in localStorage and, when signed in, in `users/{uid}/prefs/feed`. Only the
  owner can read that doc; it's written at most once a minute and deleted with the account.
- **Shares** are counted once per account: `posts/{id}/shares/{uid}` + `shareCount`.
- **Reads**: 180 post reads per feed load, cached for 3 minutes, so switching tabs is free. The Following
  tab adds up to 3 small queries. That's well inside the Spark free tier.

## Outside content (legal, kid-safe)
- **Source list**: `data/discover-sources.json` (YouTube channel ids + news RSS feeds + blocked words).
  Edit it to add or remove sources.
- **Refresh**: `.github/workflows/discover.yml` runs `scripts/discover-fetch.mjs` every 6 h (free GitHub Actions,
  public RSS, no API key). It commits `data/discover.json` only when something changed.
- **Nothing is re-uploaded.**
  - YouTube items show YouTube's thumbnail and play in a youtube-nocookie embed only after you tap
    Watch, labelled "From YouTube · <channel>" with a link to YouTube.
  - News items are headline cards with the source name that open the original article.
- **Kid-safe filtering**: only family-friendly channels and kid/science news outlets are listed. Titles and
  descriptions with mature words are skipped. YouTube's own safety systems apply inside the player.
