// Original Kemy notification chime, synthesized in the browser.
// A soft two-note bloop-bling and a short sparkle, under a second. No recorded or third-party audio.
// Written by Lone Keem.
const MUTE_KEY = 'kemy-chime-mute';
const BADGE_KEY = 'kemy-chime-badge';

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
    master.gain.value = 0.2;
    master.connect(ctx.destination);
  } catch { ctx = null; }
  return ctx;
}

function tone(a, when, freq, dur, peak, glide) {
  const o = a.createOscillator();
  const g = a.createGain();
  const filter = a.createBiquadFilter();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * glide, when);
  o.frequency.exponentialRampToValueAtTime(freq, when + dur * 0.5);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(filter);
  filter.connect(g);
  g.connect(master);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function sparkle(a, when) {
  [1760, 2093, 2637].forEach((freq, i) => {
    const o = a.createOscillator();
    const g = a.createGain();
    const st = when + i * 0.045;
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.03, st + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.07);
    o.connect(g);
    g.connect(master);
    o.start(st);
    o.stop(st + 0.08);
  });
}

// Returns true when a chime actually started. Muted, overlapping, or blocked playback returns false.
export async function playChime() {
  if (!chimeOn()) return false;
  const now = Date.now();
  if (now - lastAt < 900) return false;
  lastAt = now;
  const a = audio();
  if (!a) { lastAt = 0; return false; }
  if (a.state === 'suspended') {
    try { await a.resume(); } catch { lastAt = 0; return false; }
    if (a.state === 'suspended') { lastAt = 0; return false; }
  }
  const t = a.currentTime + 0.02;
  tone(a, t, 523, 0.18, 0.14, 1.45);
  tone(a, t + 0.16, 784, 0.2, 0.11, 1.12);
  sparkle(a, t + 0.34);
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
