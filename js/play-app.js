// Kemy's Play app is a Trusted Web Activity (package com.lonekeemstudios.kemy).
// Chrome sets document.referrer to android-app://com.lonekeemstudios.kemy on launch.
// Later pages in the same tab often have an empty referrer, so the first hit is kept in sessionStorage.
// The admin New Members list is the only place this is shown. Written by Lone Keem.

export const PLAY_PREFIX = 'android-app://com.lonekeemstudios.kemy';
const SEEN = 'kemy-play-app';
const NOTED = 'kemy-play-noted';

function box() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

// Exact package, or that package plus a path. A longer package name must not match.
export function isPlayReferrer(referrer) {
  if (typeof referrer !== 'string' || !referrer.startsWith(PLAY_PREFIX)) return false;
  const next = referrer.charAt(PLAY_PREFIX.length);
  return next === '' || next === '/' || next === '?' || next === '#';
}

export function notePlayApp(referrer, storage = box()) {
  if (!storage) return false;
  try {
    if (storage.getItem(SEEN) === '1') return true;
    if (isPlayReferrer(referrer)) { storage.setItem(SEEN, '1'); return true; }
  } catch { /* private mode */ }
  return false;
}

export function inPlayApp(storage = box()) {
  try { return !!(storage && storage.getItem(SEEN) === '1'); } catch { return false; }
}

export function playNoted(storage = box()) {
  try { return !!(storage && storage.getItem(NOTED) === '1'); } catch { return false; }
}

export function rememberPlayNoted(storage = box()) {
  try { if (storage) storage.setItem(NOTED, '1'); } catch { /* private mode */ }
}

export function playTesterChip(on) {
  return on ? '<span class="nm-play">Play tester</span>' : '';
}

if (typeof document !== 'undefined') notePlayApp(document.referrer);
