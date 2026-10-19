// Kemy's theme song: "Stand Up Strong" (Instrumental), written by Lone Keem.
// Rules: only ever starts after a user tap (no autoplay with sound), never plays over videos, lives,
// songs, Movie Maker previews or games (any other unmuted <video>/<audio> playing stops it), pauses
// while the tab is hidden, and the optional home background music is OFF unless the user turns it on.
export const THEME_TITLE = 'Stand Up Strong (Instrumental)';
export const THEME_CREDIT = 'Theme song: Stand Up Strong (Instrumental) — Lone Keem';
const BASE = new URL('../assets/audio/', import.meta.url).href;
const pick = (name) => { const a = document.createElement('audio');
  return BASE + name + (a.canPlayType('audio/ogg; codecs="opus"') ? '.ogg' : '.mp3'); };
export const THEME_SRC = { full: BASE + 'kemy-theme.mp3', short: BASE + 'kemy-theme-short.mp3' };
const KEY = 'kemy-theme-bgm';
// Routes where the optional background music may play: calm screens without their own sound.
const CALM = /^#\/(me|u\/[^/]+|pals(?:\/(?:gallery|shop))?|settings|notifications)$/i;
// Routes that always silence the theme (their own sound or media).
const LOUD = /^#\/(watch|feed|post|live|game|games|park|new|explore|series|chat|messages)/i;

let el = null, kind = '', fadeT = 0, wasPlayingBeforeHide = false;
const VOL = { short: 0.55, full: 0.32 };
export const bgmOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
export function setBgm(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* */ }
  if (on) startBgm(); else if (kind === 'full') stop();
}
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = () => !!(navigator.connection && navigator.connection.saveData);
function otherMediaPlaying() {
  return [...document.querySelectorAll('video, audio')].some((m) => m !== el && !m.paused && !m.ended && !m.muted && m.volume > 0);
}
function fadeTo(v, ms, done) {
  clearInterval(fadeT); if (!el) return done && done();
  const a = el, from = a.volume, t0 = performance.now();
  fadeT = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (v - from) * k)); if (k >= 1) { clearInterval(fadeT); done && done(); } }, 40);
}
export function isPlaying() { return !!el && !el.paused; }
export function stop(ms = 400) {
  if (!el) return; const a = el; el = null; kind = '';
  const v0 = a.volume, t0 = performance.now(); clearInterval(fadeT);
  const t = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = v0 * (1 - k); if (k >= 1) { clearInterval(t); a.pause(); a.removeAttribute('src'); a.load(); } }, 40);
  document.dispatchEvent(new CustomEvent('kemy-theme', { detail: { playing: false } }));
}
// Play the theme. Call from a click/tap handler. Returns a promise resolving true if it is playing.
export async function play(which = 'short', { loop = false } = {}) {
  if (document.hidden || otherMediaPlaying()) return false;
  if (LOUD.test(location.hash || '') && location.pathname.endsWith('app.html') && which === 'full') return false;
  if (el && kind === which) return true;
  if (el) stop(200);
  const a = new Audio(); a.preload = 'auto'; a.loop = loop; a.volume = 0; a.dataset.kemyTheme = '1';
  a.src = which === 'full' ? pick('kemy-theme') : pick('kemy-theme-short');
  el = a; kind = which;
  a.onended = () => { if (el === a) { el = null; kind = ''; document.dispatchEvent(new CustomEvent('kemy-theme', { detail: { playing: false } })); } };
  try { await a.play(); } catch { if (el === a) { el = null; kind = ''; } return false; }
  if (el !== a) { a.pause(); return false; }
  fadeTo(VOL[which], 900);
  document.dispatchEvent(new CustomEvent('kemy-theme', { detail: { playing: true, which } }));
  return true;
}
export const playShort = () => play('short');
// Splash / onboarding: play the short theme once on the user's tap, unless the user prefers less motion
// or is saving data (they can still press the play button).
export function playIntro() { if (reduced() || saveData()) return Promise.resolve(false); return playShort(); }
function startBgm() {
  if (!bgmOn() || !CALM.test(location.hash || '')) return;
  play('full', { loop: true });
}
// Background music hooks (app only).
let armed = false;
export function initThemeMusic() {
  if (armed) return; armed = true;
  // Any other media with sound starts -> theme stops (videos, lives, songs, Movie Maker previews).
  document.addEventListener('play', (e) => { const m = e.target; if (m === el || (m.dataset && m.dataset.kemyTheme)) return; if (!m.muted && m.volume > 0) stop(250); }, true);
  document.addEventListener('volumechange', (e) => { const m = e.target; if (m !== el && !m.paused && !m.muted && m.volume > 0) stop(250); }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { wasPlayingBeforeHide = isPlaying() && kind === 'full'; if (el) el.pause(); }
    else if (el && el.paused) { if (wasPlayingBeforeHide && !otherMediaPlaying()) el.play().catch(() => {}); else stop(0); }
  });
  addEventListener('pagehide', () => stop(0));
  // Feed autoplay announces videos that start with sound.
  addEventListener('kemy:media-play', () => stop(250));
  addEventListener('hashchange', () => {
    const h = location.hash || '';
    if (kind === 'full' && !CALM.test(h)) stop();
    else if (kind === 'short' && LOUD.test(h)) stop();
    else if (!el && bgmOn()) setTimeout(startBgm, 300);
  });
  // Browsers need a tap before music: start the background music on the first tap on a calm screen.
  const kick = () => { if (!el && bgmOn()) startBgm(); };
  document.addEventListener('pointerdown', kick, true);
  document.addEventListener('keydown', kick, true);
}
// Silence the theme (e.g. a game or Movie Maker preview with WebAudio sound starts).
export const silence = () => stop(200);
