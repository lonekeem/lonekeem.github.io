/* Kemy web push worker. Written by Lone Keem.
   The site registers sw.js (offline cache and the share target). That file importScripts
   this one, so there is still a single service worker. If a browser registers this file
   on its own, it loads sw.js first so caching and sharing are not dropped. */
(function () {
  if (!self.__kemyShell && !self.__kemyPushBoot) {
    self.__kemyPushBoot = true;
    importScripts('./sw.js');
    return;
  }
  if (self.__kemyMessagingReady) return;
  self.__kemyMessagingReady = true;

  const ICON = () => new URL('icon-192.png', self.location).href;
  const BADGE = () => new URL('favicon-32.png', self.location).href;

  try {
    importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging-compat.js');
    if (!self.firebase.apps || !self.firebase.apps.length) {
      self.firebase.initializeApp({
        apiKey: 'AIzaSyCF3hTcGkjpYb_4k-35R-qYcHsDcOR9yoY',
        authDomain: 'lone-keem-studios.firebaseapp.com',
        projectId: 'lone-keem-studios',
        storageBucket: 'lone-keem-studios.firebasestorage.app',
        messagingSenderId: '109889516666',
        appId: '1:109889516666:web:eb0e1e7f319f500974b7c3'
      });
    }
    self.firebase.messaging().onBackgroundMessage((payload) => {
      const d = payload.data || {};
      if (payload.notification) return;
      const title = d.title || 'Kemy';
      self.registration.showNotification(title, {
        body: d.body || '',
        icon: ICON(),
        badge: BADGE(),
        tag: d.tag || 'kemy',
        data: { url: d.url || 'app.html' }
      });
    });
  } catch (e) {
    // Push can fail offline or before the web key exists. The app shell still caches and shares.
  }

  if (self.__kemyClickReady) return;
  self.__kemyClickReady = true;

  function urlOf(n) {
    const d = (n && n.data) || {};
    const fcm = d.FCM_MSG || {};
    return d.url || (fcm.data && fcm.data.url) || (fcm.fcmOptions && fcm.fcmOptions.link) || 'app.html';
  }
  function sameOrigin(raw) {
    try {
      const u = new URL(raw, self.location.origin);
      if (u.origin !== self.location.origin) return new URL('app.html', self.location.origin).href;
      return u.href;
    } catch (e) {
      return new URL('app.html', self.location.origin).href;
    }
  }
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const target = sameOrigin(urlOf(event.notification));
    event.waitUntil((async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        try {
          if (new URL(c.url).origin !== self.location.origin) continue;
          if (typeof c.navigate === 'function') { try { await c.navigate(target); } catch (e) { /* keep the open window */ } }
          if (typeof c.focus === 'function') return c.focus();
        } catch (e) { /* try the next window */ }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })());
  });
})();
