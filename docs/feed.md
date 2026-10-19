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

## Search that customizes the feed (Oct 19, 2026)
- **Search** (`#/search`, `js/search.js` + `js/search-plus.js`): grouped results — In Kemy (pages + Games), Creators,
  Music & Songs, Music Videos, Videos, Movies & Series, Pals, Hashtags, Posts. Sources: indexed Firestore queries
  (`keywords` / `hashtags` array-contains, username / displayNameLower prefixes), a scan of the newest 150 posts and
  200 profiles (covers posts that were never re-indexed), the latest 40 series, the curated outside videos in
  `data/discover.json`, and a built-in catalog (Games, pages, the 30 Pal species). Ranking is on the device and
  typo-tolerant (1 typo for 4+ letters, 2 for 8+, adjacent swaps count as one).
- **Kid-safe queries**: `blockedQuery()` (leet-speak aware). Blocked searches show a gentle message, are not saved
  to history and are not counted.
- **Recent searches**: localStorage + private `users/{uid}/prefs/search` `{ recent[≤20], updatedAt }` (owner only;
  "Clear all" deletes it; deleted with the account).
- **Trending searches**: `searchTrends/{day}_{slug}` `{ day, q, n }`. Signed-in users add +1 once per query per day;
  rules allow only create with n == 1 or +1 updates; the app shows queries searched 2+ times today/yesterday.
  Two small queries (index `day asc, n desc`), cached 5 min.
- **How search shapes For You** (`js/interests.js`, one shared store with the feed): a submitted search whose words
  point to a topic (e.g. "dance", "#funny", "kidz bop songs") adds +0.5 to that topic; tapping a result adds +0.6 to
  its topic and its creator (Kemy user or YouTube channel). Onboarding topic picks set that topic to 2.
  Settings › Your interests shows the weights and lets you remove one, re-pick topics or reset.
- **Optional "More from YouTube"**: set `YOUTUBE.key` in `js/media-config.js` (referrer-restricted YouTube Data API
  key, ~100 searches/day free). Empty = hidden.

## Music (`#/music`, `js/music.js`)
Lone Keem Studios songs + music videos, Kemy Community Songs, and curated official music videos (`cat: "music"`
in `data/discover-sources.json`: DisneyMusicVEVO, Pentatonix, Lindsey Stirling, The Piano Guys, Super Simple Songs,
plus KIDZ BOP from the Dance list). Songs play in the persistent mini player (`js/works.js`), which dispatches
`kemy:media-play` (stops the theme, pauses feed videos) and pauses when another source dispatches it.
The feed has a **Music** tab and music/dance videos are mixed into For You (muted autoplay like other videos).
