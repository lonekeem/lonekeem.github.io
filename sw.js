const CACHE = 'lks-v77';
const CORE = [
  './', 'index.html', 'app.html', 'terms.html', 'privacy.html', 'guidelines.html',
  'css/app.css', 'kemy-logo.png', 'favicon-32.png', 'js/app.js', 'js/home.js', 'js/firebase-init.js', 'js/watch.js', 'js/feed-cats.js', 'js/feedrank.js', 'js/discover.js', 'js/autoplay.js', 'js/gamemusic.js', 'js/embeds.js', 'js/leaderboard.js', 'css/gamemusic.css',
  'js/create.js', 'js/media-config.js', 'js/search.js', 'js/search-index.js', 'js/stories.js', 'js/avatar-editor.js', 'js/views.js', 'js/icons.js', 'js/live.js', 'js/account-delete.js', 'js/comments.js', 'js/tapstar.js', 'js/snapedit.js', 'js/works.js', 'js/moviemaker.js', 'js/theme.js', 'js/search-plus.js', 'js/interests.js', 'js/music.js', 'js/richcomments.js', 'js/series.js', 'js/animator.js', 'js/emoji-data.json', 'js/fx/looks.js', 'js/fx/engine.js', 'js/fx/face.js', 'js/fx/pipeline.js', 'js/fx/picker.js',
  'css/games.css', 'js/games/index.js', 'js/games/boards.js', 'js/games/cards.js', 'js/games/net.js', 'js/games/sfx.js', 'js/games/art.js', 'js/games/trivia.js', 'js/games/starcards.js', 'js/games/questions.json', 'js/games/pool.js', 'js/games/pool-engine.js', 'js/games/chess.js', 'js/games/chess-engine.js', 'js/games/ludo.js', 'js/games/ludo-engine.js',
  'logo.png', 'icon-192.png', 'icon-512.png', 'favicon.ico'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'kemy-share').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Web Share Target (manifest.webmanifest): a video shared from CapCut, InShot, Gallery… arrives as a
  // POST here. Keep the file in a cache for a moment and open the "Share a movie" form, which picks it up.
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const file = fd.get('media'); const meta = { title: String(fd.get('title') || ''), text: String(fd.get('text') || ''), url: String(fd.get('url') || ''), name: '', type: '' };
        const c = await caches.open('kemy-share');
        if (file && typeof file === 'object' && file.size) { meta.name = file.name || 'shared-video.mp4'; meta.type = file.type || 'video/mp4'; await c.put('./__shared-media', new Response(file, { headers: { 'content-type': meta.type } })); }
        else await c.delete('./__shared-media');
        await c.put('./__shared-meta', new Response(JSON.stringify(meta), { headers: { 'content-type': 'application/json' } }));
      } catch (err) { /* fall through to the form */ }
      return Response.redirect('./app.html#/new/movie?shared=1', 303);
    })());
    return;
  }
  // Cross-origin (Firebase, googleapis, gstatic, auth, fonts, embeds): network only, never cached here.
  if (url.origin !== self.location.origin) return;
  // Only same-origin GETs; skip media streams and Firebase auth helper paths.
  if (req.method !== 'GET' || req.headers.has('range') || url.pathname.includes('/__/') ||
      /\.(mp4|mov|mp3|m4a|wav|ogg|opus)$/i.test(url.pathname)) return;
  // Network first, cache fallback for offline.
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
