// Firebase setup for Lone Keem Studios. The web config below is public by design;
// access is controlled by Firestore security rules (firestore.rules).
export const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyCF3hTcGkjpYb_4k-35R-qYcHsDcOR9yoY',
  authDomain: 'lone-keem-studios.firebaseapp.com',
  projectId: 'lone-keem-studios',
  storageBucket: 'lone-keem-studios.firebasestorage.app',
  messagingSenderId: '109889516666',
  appId: '1:109889516666:web:eb0e1e7f319f500974b7c3'
};

export const ADMIN_EMAIL = 'lillykemoy1@gmail.com';
export const STUDIO_UID = 'studio';

// Photo / video uploads use Cloudinary (free plan); config lives in js/media-config.js.

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Persistent IndexedDB cache: listeners resume cheaply and js/fs-cache.js serves repeat reads for free.
export const db = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch { return getFirestore(app); } })();
