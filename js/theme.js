// Kemy's theme song. To swap the song, change THEME_FILE + THEME_TITLE (one place; kemy/index.html reads these too).
// Rules: only ever starts after a user tap, plays LOW (default 20%) through Web Audio so the volume also works on
// iPhone (iOS ignores audio.volume), fades in/out over ~1.5 s, never plays over videos, lives, songs, Movie Maker
// previews or games (kemy:media-play / any other unmuted media stops it), pauses while the tab is hidden.
// The user picks Play / Mute / Off (one-time prompt, floating 🎵 button, Settings > Sound); stored on this device.
export const THEME_FILE = 'kemy-theme.m4a?v=2'; // "Kemy on the Screen" by Keem, audio extracted unchanged from Keem's video (AAC stream copy, 127.6 s)
export const THEME_TITLE = 'Kemy on the Screen';
export const THEME_ARTIST = 'Keem';
export const THEME_CREDIT = `Theme song: ${THEME_TITLE} by ${THEME_ARTIST} — Lone Keem Studios`;
// Track 3 title (placeholder) — change it here.
export const THEME3_TITLE = 'Kemy Theme 3';
export const THEME3_ARTIST = 'Keem';
export const THEME_SRC = new URL('../assets/audio/' + THEME_FILE, import.meta.url).href;
// Theme playlist (original song files, unchanged). Track 1 is always the welcome / hatch song.
export const TRACKS = [
  { title: THEME_TITLE, artist: 'Keem', src: THEME_SRC, dur: 124.8 },
  { title: 'Julian', artist: 'Keem', src: new URL('../assets/audio/julian.m4a', import.meta.url).href, dur: 161.2 },
  { title: THEME3_TITLE, artist: THEME3_ARTIST, src: new URL('../assets/audio/kemy-theme3.m4a?v=1', import.meta.url).href, dur: 167.6 },
];
export const PLAYLIST_CREDIT = `Theme songs: ${TRACKS.map((t) => `${t.title} by ${t.artist}`).join(', ')} — Lone Keem Studios`;
const PICK = 'kemy-theme-track'; // 'all' (in order, loops) | 'shuffle' | '0', '1'… (one track, loops)
export function getPick() { const v = ls.get(PICK); return v === 'shuffle' || (v && TRACKS[+v]) ? v : 'all'; }
let cur = 0;
export const currentTrack = () => cur;

const MODE = 'kemy-theme-mode', VOLK = 'kemy-theme-vol', OLD = 'kemy-theme-bgm';
export const DEFAULT_VOL = 0.2, FADE = 1.5;
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
// '' = not asked yet, 'play', 'mute' (paused, tap to resume), 'off' (never starts, button hidden)
export function getMode() { const m = ls.get(MODE); if (m === 'play' || m === 'mute' || m === 'off') return m; if (ls.get(OLD) === '1') return 'play'; return ''; }
export function getVolume() { const v = parseFloat(ls.get(VOLK)); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOL; }
const emit = () => document.dispatchEvent(new CustomEvent('kemy-theme', { detail: { playing: isPlaying(), mode: getMode() } }));
export function setMode(m, { start = true } = {}) {
  ls.set(MODE, m);
  if (m === 'play') { if (start) play(); } else stop();
  emit(); paintFab();
}
export function setVolume(v) { ls.set(VOLK, String(v)); if (gain && actx && el && !el.paused) { const g = gain.gain; g.cancelScheduledValues(actx.currentTime); g.setTargetAtTime(v, actx.currentTime, 0.05); } else if (el && !actx) el.volume = v; }
// legacy API (old Settings checkbox)
export const bgmOn = () => getMode() === 'play';
export const setBgm = (on) => setMode(on ? 'play' : 'mute');

// Calm screens where the theme may play and the floating button shows.
const CALM = /^(#\/(me|home|u\/[^/]+|pals(?:\/(?:gallery|shop))?|settings|notifications))$/i;
const LOUD = /^#\/(watch|feed|post|live|game|games|park|new|explore|series|chat|messages|movie|create|songs|music)/i;
const calmNow = () => CALM.test(location.hash || '') || !!document.querySelector('.welcome-modal, #welcome-title');

let el = null, actx = null, gain = null, analyser = null, stopT = 0, wasPlaying = false, iosVol = false;
export const themeAnalyser = () => analyser;
export const themeEl = () => el;
export function isPlaying() { return !!el && !el.paused && !el.dataset.stopping; }
function otherMediaPlaying() { return [...document.querySelectorAll('video, audio')].some((m) => m !== el && !m.paused && !m.ended && !m.muted && m.volume > 0); }
function ensureEl() {
  if (el) return el;
  el = new Audio(); el.preload = 'auto'; el.loop = false; el.dataset.kemyTheme = '1'; el.src = TRACKS[cur].src;
  el.addEventListener('ended', () => { const pk = getPick(); if (pk !== 'all' && pk !== 'shuffle') { el.currentTime = 0; el.play().catch(() => {}); return; } loadTrack(nextIndex()); el.play().catch(() => {}); }); el.setAttribute('playsinline', '');
  try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { actx = new AC(); gain = actx.createGain(); gain.gain.value = 0; const srcN = actx.createMediaElementSource(el); srcN.connect(gain); gain.connect(actx.destination); analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.5; srcN.connect(analyser); /* analyser is a dead end: it never changes loudness */ } } catch { actx = null; gain = null; }
  el.addEventListener('play', emit); el.addEventListener('pause', () => { emit(); paintFab(); });
  return el;
}
function ramp(to, sec) {
  if (actx && gain) { const g = gain.gain, t = actx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + sec); return; }
  // fallback (no Web Audio): element volume
  const a = el, from = a.volume, t0 = performance.now(); clearInterval(a._f);
  a._f = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / (sec * 1000)); a.volume = from + (to - from) * k; if (k >= 1) clearInterval(a._f); }, 40);
}
// Start (or resume) the theme. Call from a tap. fromStart: welcome screen / egg hatch play the song from the top.
export async function play({ fromStart = false, force = false } = {}) {
  if (document.hidden || otherMediaPlaying()) return false;
  if (!force && getMode() !== 'play') return false;
  const a = ensureEl(); clearTimeout(stopT); delete a.dataset.stopping;
  if (fromStart) { if (cur !== 0) loadTrack(0); try { a.currentTime = 0; } catch { /* */ } }
  else if (a.ended) { try { a.currentTime = 0; } catch { /* */ } }
  try { if (actx && actx.state !== 'running') await actx.resume(); } catch { /* */ }
  if (!actx) a.volume = 0; else gain.gain.value = Math.min(gain.gain.value, 0.0001);
  try { await a.play(); } catch { return false; }
  ramp(getVolume(), FADE); emit(); paintFab(); return true;
}
// Fade out and pause (keeps the position so Mute -> Play resumes).
export function stop(sec = FADE) {
  if (!el || el.paused) return; const a = el; a.dataset.stopping = '1'; ramp(0, sec);
  clearTimeout(stopT); stopT = setTimeout(() => { if (a.dataset.stopping) { a.pause(); delete a.dataset.stopping; emit(); paintFab(); } }, sec * 1000 + 60);
  emit(); paintFab();
}
export const silence = () => stop(0.25);
// Welcome screen / egg hatch: play the full song from the start (asks first if never asked).
export function playIntro() { const m = getMode(); if (m === '') { ask(); return Promise.resolve(false); } return m === 'play' ? play({ fromStart: true }) : Promise.resolve(false); }
export const playShort = playIntro;
function nextIndex() { const pk = getPick(); if (pk === 'shuffle') { if (TRACKS.length < 2) return 0; let n; do n = Math.floor(Math.random() * TRACKS.length); while (n === cur); return n; } if (pk !== 'all') return +pk; return (cur + 1) % TRACKS.length; }
function loadTrack(i) { cur = i; if (el && el.src !== TRACKS[i].src) { el.src = TRACKS[i].src; el.load(); } emit(); }
// Settings: choose the playlist order or one track; starts it if the theme is on.
export function setPick(v) { ls.set(PICK, v); const i = v === 'all' || v === 'shuffle' ? (v === 'shuffle' ? nextIndex() : 0) : +v; if (el) { const was = isPlaying(); loadTrack(i); if (was) { el.play().catch(() => {}); } } else cur = i; }
export function skip() { if (!el) return; const was = isPlaying(); loadTrack(nextIndex()); if (was) el.play().catch(() => {}); }
export function gainInfo() { return { track: cur, title: TRACKS[cur].title, currentTime: el ? el.currentTime : null, webAudio: !!(actx && gain), gain: gain ? gain.gain.value : null, elVolume: el ? el.volume : null, playing: isPlaying(), state: actx ? actx.state : null, mode: getMode(), vol: getVolume(), duration: el ? el.duration : null, src: el ? el.currentSrc : null }; }

// ---- UI: floating button + first-run prompt ----
let fab = null;
function paintFab() {
  if (!fab) return; const m = getMode(); const show = calmNow() && (m === 'play' || m === 'mute');
  fab.hidden = !show; const on = isPlaying();
  fab.textContent = on ? '🎵' : '🔇'; fab.classList.toggle('on', on);
  fab.setAttribute('aria-label', on ? `Kemy's theme is playing. Tap to mute` : `Kemy's theme is muted. Tap to play`); fab.setAttribute('aria-pressed', String(on));
}
export function ask() {
  if (getMode() !== '' || document.getElementById('theme-ask')) return;
  const d = document.createElement('div'); d.id = 'theme-ask'; d.className = 'theme-ask'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Theme song');
  d.innerHTML = `<p><b>Play Kemy’s theme song?</b><small>${THEME_TITLE} · plays softly, stops for videos</small></p><div><button type="button" class="btn btn-sm" data-m="play">🎵 Play</button><button type="button" class="btn btn-sm btn-ghost" data-m="mute">🔇 Mute</button><button type="button" class="btn btn-sm btn-ghost" data-m="off">Turn off</button></div>`;
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (!b) return; d.remove(); setMode(b.dataset.m, { start: false }); if (b.dataset.m === 'play') play({ fromStart: true }); });
  document.body.appendChild(d);
}
let armed = false;
export function initThemeMusic() {
  if (armed) return; armed = true;
  fab = document.createElement('button'); fab.type = 'button'; fab.className = 'theme-fab'; fab.hidden = true; document.body.appendChild(fab);
  fab.addEventListener('click', (e) => { e.stopPropagation(); if (isPlaying()) setMode('mute'); else { ls.set(MODE, 'play'); play(); } });
  document.addEventListener('play', (e) => { const m = e.target; if (m === el || m.dataset?.kemyTheme) return; if (!m.muted && m.volume > 0) stop(0.25); }, true);
  document.addEventListener('volumechange', (e) => { const m = e.target; if (m !== el && m.tagName && !m.paused && !m.muted && m.volume > 0) stop(0.25); }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { wasPlaying = isPlaying(); if (el) el.pause(); } else if (wasPlaying && getMode() === 'play' && calmNow()) play(); });
  addEventListener('pagehide', () => { if (el) el.pause(); });
  addEventListener('kemy:media-play', (e) => { if (e.detail?.source !== 'kemy-theme') stop(0.25); });
  const route = () => { if (!calmNow() || LOUD.test(location.hash || '')) stop(0.6); paintFab(); if (calmNow() && getMode() === '') setTimeout(() => { if (calmNow()) ask(); }, 1200); };
  addEventListener('hashchange', route);
  new MutationObserver(() => paintFab()).observe(document.getElementById('modal-root') || document.body, { childList: true });
  // Browsers need a tap before sound: resume on the first tap on a calm screen when the choice is Play.
  const kick = (e) => { if (e.target.closest?.('.theme-fab, #theme-ask, [data-theme-ctl]')) return; if (getMode() === 'play' && !isPlaying() && calmNow() && !otherMediaPlaying()) play(); };
  document.addEventListener('pointerdown', kick, true); document.addEventListener('keydown', kick, true);
  route();
}
