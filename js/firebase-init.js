// Firebase setup for Lone Keem Studios. The web config below is public by design;
// access is controlled by Firestore security rules (firestore.rules).
export const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyCF3hTcGkjpYb_4k-35R-qYcHsDcOR9yoY',
  authDomain: 'lone-keem-studios.firebaseapp.com',
  projectId: 'lone-keem-studios',
  storageBucket: 'lone-keem-studios.firebasestorage.app',
  messagingSenderId: '109889516666',
  appId: '1:109889516666:web:eb0e1e7f319f500974b7c3'
};

// Web Push public key only. The private key stays in the Firebase console and must never be committed.
// Firebase console → Project settings (gear) → Cloud Messaging → Web configuration →
// Web Push certificates → Generate key pair → paste the Key pair value here, replacing the placeholder.
// Until it is replaced, production push stays off. The local emulator can still save a test token.
export const VAPID_KEY = 'REPLACE_WITH_WEB_PUSH_VAPID_PUBLIC_KEY';
export const VAPID_READY = /^[A-Za-z0-9_-]{80,}$/.test(VAPID_KEY);

export const ADMIN_EMAIL = 'lillykemoy1@gmail.com';
export const STUDIO_UID = 'studio';

// Photo / video uploads use Cloudinary (free plan); config lives in js/media-config.js.

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Persistent IndexedDB cache: listeners resume cheaply and js/fs-cache.js serves repeat reads for free.
// Local testing only: on localhost with localStorage 'kemy-emu' = '1' everything talks to the Firebase emulators
// (firebase.emu.json: auth 9199, firestore 8199). Never active on the live site.
export const EMU = (() => { try { return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && localStorage.getItem('kemy-emu') === '1'; } catch { return false; } })();
export const db = (() => { if (EMU) { const d = initializeFirestore(app, { localCache: memoryLocalCache() }); connectFirestoreEmulator(d, '127.0.0.1', 8199); connectAuthEmulator(auth, 'http://127.0.0.1:9199', { disableWarnings: true }); return d; }
  try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch { return getFirestore(app); } })();
