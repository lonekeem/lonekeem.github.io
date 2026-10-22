// Chime player: mute, inbox, foreground push, and the What's New dot.
// Soft Breeze itself is js/chime-sound.js, already peaked at about 0.5.
// Written by Lone Keem.
import { playChimeSound } from './chime-sound.js';
const MUTE_KEY = 'kemy-chime-mute';
const BADGE_KEY = 'kemy-chime-badge';
const GAP_MS = 2600;

let ctx = null;
let master = null;
let lastAt = 0;
let pendingBadge = '';

export function chimeOn() {
  try { return localStorage.getItem(MUTE_KEY) !== '1'; } catch { return true; }
}
export function setChimeOn(on) {
  try { localStorage.setItem(MUTE_KEY, on ? '0' : '1'); } catch { /* private mode */ }
  if (!on) pendingBadge = '';
}

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

// Returns true when a chime actually started. Muted, overlapping, or blocked playback returns false.
export async function playChime() {
  if (!chimeOn()) return false;
  const now = Date.now();
  if (now - lastAt < GAP_MS) return false;
  lastAt = now;
  const a = audio();
  if (!a) { lastAt = 0; return false; }
  if (a.state === 'suspended') {
    try { await a.resume(); } catch { lastAt = 0; return false; }
    if (a.state === 'suspended') { lastAt = 0; return false; }
  }
  playChimeSound(a, master, a.currentTime + 0.02);
  return true;
}

export function cancelBadge() { pendingBadge = ''; }

// One chime per unseen What's New entry. If the browser blocks sound, it waits for the next tap.
export function playBadge(id) {
  if (!id || !chimeOn()) { pendingBadge = ''; return; }
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
  document.addEventListener('pointerdown', () => {
    const a = audio();
    if (a && a.state === 'suspended') a.resume().catch(() => {});
    flushBadge();
  }, { passive: true });
}
