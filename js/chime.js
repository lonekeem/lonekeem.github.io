// Chime player: mute, the chosen sound, inbox, foreground push, and the What's New dot.
// The sounds themselves are sounds/notify/*.ogg, made by tools/make-notify-sounds.py.
// Written by Lone Keem.
import { CHIME_SOUNDS, DEFAULT_CHIME, chimeFile, validChime } from './notify-sounds.js';

const MUTE_KEY = 'kemy-chime-mute';
const SOUND_KEY = 'kemy-chime-sound';
const BADGE_KEY = 'kemy-chime-badge';
const GAP_MS = 2600;

export { CHIME_SOUNDS, DEFAULT_CHIME, validChime };

let lastAt = 0;
let pendingBadge = '';
let clip = null;

export function chimeOn() {
  try { return localStorage.getItem(MUTE_KEY) !== '1'; } catch { return true; }
}
export function setChimeOn(on) {
  try { localStorage.setItem(MUTE_KEY, on ? '0' : '1'); } catch { /* private mode */ }
  if (!on) pendingBadge = '';
}
export function chimeSound() {
  let id = DEFAULT_CHIME;
  try { id = localStorage.getItem(SOUND_KEY) || DEFAULT_CHIME; } catch { id = DEFAULT_CHIME; }
  return validChime(id) ? id : DEFAULT_CHIME;
}
export function setChimeSound(id) {
  const next = validChime(id) ? id : DEFAULT_CHIME;
  try { localStorage.setItem(SOUND_KEY, next); } catch { /* private mode */ }
  return next;
}

function stopClip() {
  if (!clip) return;
  try { clip.pause(); } catch { /* already stopped */ }
  clip = null;
}
function startClip(id) {
  const file = chimeFile(id);
  if (!file) return null;
  stopClip();
  const audio = new Audio(file);
  audio.preload = 'auto';
  clip = audio;
  return audio;
}

// A tap on Play always previews, even when the chime is muted, so a player can compare sounds.
export function previewSound(id) {
  if (!chimeFile(id)) return false;
  const audio = startClip(id);
  if (!audio) return false;
  const played = audio.play();
  if (played && played.catch) played.catch(() => {});
  return true;
}

// Returns true when a chime actually started. Muted, silent, overlapping, or blocked playback returns false.
export async function playChime() {
  if (!chimeOn()) return false;
  const id = chimeSound();
  if (id === 'none' || !chimeFile(id)) return false;
  const now = Date.now();
  if (now - lastAt < GAP_MS) return false;
  lastAt = now;
  const audio = startClip(id);
  if (!audio) { lastAt = 0; return false; }
  try { await audio.play(); return true; }
  catch { lastAt = 0; return false; }
}

export function cancelBadge() { pendingBadge = ''; }

// One chime per unseen What's New entry. If the browser blocks sound, it waits for the next tap.
export function playBadge(id) {
  if (!id || !chimeOn() || chimeSound() === 'none') { pendingBadge = ''; return; }
  let prev = '';
  try { prev = sessionStorage.getItem(BADGE_KEY) || ''; } catch { prev = ''; }
  if (prev === id) { pendingBadge = ''; return; }
  pendingBadge = id;
  playChime().then((ok) => {
    if (!ok || pendingBadge !== id) return;
    pendingBadge = '';
    try { sessionStorage.setItem(BADGE_KEY, id); } catch { /* played anyway */ }
  }).catch(() => {});
}

function flushBadge() {
  if (!pendingBadge || !chimeOn()) return;
  const id = pendingBadge;
  playChime().then((ok) => {
    if (!ok || pendingBadge !== id) return;
    pendingBadge = '';
    try { sessionStorage.setItem(BADGE_KEY, id); } catch { /* played anyway */ }
  }).catch(() => {});
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', () => { flushBadge(); }, { passive: true });
}
