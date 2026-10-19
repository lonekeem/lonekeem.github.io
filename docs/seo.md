# SEO: getting Kemy found on Google

## What is in place
- Unique titles and descriptions on every public page, all naming "Kemy by Lone Keem Studios".
- Canonical URLs, Open Graph and Twitter cards. The image is `kemy-og.jpg` (the axolotl icon); Bubble Quest uses `assets/kemy-quest/og.png`.
- JSON-LD:
  - `/`: Organization, Person, WebSite, SoftwareApplication+MobileApplication (Kemy), the music video and the recording.
  - `/kemy/`: WebPage + breadcrumb, the app, an FAQPage and one VideoGame per game.
  - `/kemy-quest.html`: VideoGame.
- `/kemy/`: a landing page with plain HTML text and no JavaScript needed. The home page has a "What you can do in the Kemy app" section. app.html and kemy-quest.html have static fallback text.
- robots.txt allows everything. sitemap.xml lists all public pages with lastmod. There is no noindex anywhere.

The WebSite SearchAction was removed: the in-app search is a `#/search` hash route, which Google cannot use.

## Google Search Console (user steps)
1. Go to https://search.google.com/search-console, signed in with the Google account that should own the site.
2. Add property → **URL prefix** → `https://lonekeem.github.io/` → choose **HTML tag** and copy the `<meta name="google-site-verification" ...>` tag.
3. Send the tag to the developer/agent. It goes into `index.html` at the block marked
   `GOOGLE SEARCH CONSOLE VERIFICATION`. After it is live (about 1-2 minutes after the push), press **Verify**.
4. Sitemaps (left menu) → enter `sitemap.xml` → Submit.
5. URL inspection (top search bar) → enter each of these → **Request indexing**:
   - `https://lonekeem.github.io/`
   - `https://lonekeem.github.io/kemy/`
   - `https://lonekeem.github.io/kemy-quest.html`
   - `https://lonekeem.github.io/app.html`

## When the Play Store listing is live
Search for `PLAY_STORE_LINK` in `kemy/index.html`. In `kemy/index.html`:
- Uncomment the "Get it on Google Play" button.
- Add `"sameAs": ["https://play.google.com/store/apps/details?id=com.lonekeemstudios.kemy"]` to the app JSON-LD, here and in `index.html`.
- Put the same Play link in the Play Console's website field as `https://lonekeem.github.io/kemy/`.
