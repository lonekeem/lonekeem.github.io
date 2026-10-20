const CACHE = 'lks-v140';
// Small app shell only (other files are cached as they are used); a big precache on every version bump
// slowed phones down on first open after each update.
const CORE = [
  './', 'index.html', 'app.html', 'css/app.css', 'css/polish.css', 'js/app.js', 'js/home.js', 'js/firebase-init.js',
  'js/watch.js', 'js/discover.js', 'js/loadscreen.js', 'kemy-logo.png', 'favicon-32.png', 'icon-192.png'
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
  // Network first with a time limit: on a slow or stalled phone connection fall back to the cached copy
  // after 3.5s (the network copy still refreshes the cache in the background) so the app never hangs.
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  const fallback = () => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  e.respondWith(new Promise(resolve => {
    let done = false; const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => fallback().then(finish), 3500);
    net.then(r => { clearTimeout(t); finish(r); }).catch(() => { clearTimeout(t); fallback().then(r => { if (r) finish(r); else if (!done) { done = true; resolve(Response.error()); } }); });
  }));
});
