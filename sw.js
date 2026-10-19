const CACHE = 'lks-v17';
const CORE = [
  './', 'index.html', 'app.html', 'terms.html', 'privacy.html', 'guidelines.html',
  'css/app.css', 'js/app.js', 'js/home.js', 'js/firebase-init.js', 'js/watch.js',
  'js/create.js', 'js/media-config.js', 'js/search.js', 'js/search-index.js', 'js/stories.js', 'js/avatar-editor.js', 'js/views.js', 'js/icons.js', 'js/live.js', 'js/account-delete.js', 'js/comments.js', 'js/tapstar.js',
  'logo.png', 'icon-192.png', 'icon-512.png', 'favicon.ico'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // Cross-origin (Firebase, googleapis, gstatic, auth, fonts, embeds): network only, never cached here.
  if (url.origin !== self.location.origin) return;
  // Only same-origin GETs; skip media streams and Firebase auth helper paths.
  if (req.method !== 'GET' || req.headers.has('range') || url.pathname.includes('/__/') ||
      /\.(mp4|mov|mp3|m4a|wav)$/i.test(url.pathname)) return;
  // Network first, cache fallback for offline.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
