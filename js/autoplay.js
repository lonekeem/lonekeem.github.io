// Autoplay preferences + shared media helpers (feed, profile viewer, Movies/Series rows).
// Settings live in localStorage; "sound on" is remembered for this browser session only.
const K_ON = 'kemy-autoplay', K_WIFI = 'kemy-autoplay-wifi', K_SOUND = 'kemy-sound-on';
const conn = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

export const autoplayEnabled = () => localStorage.getItem(K_ON) !== 'off';
export const wifiOnly = () => localStorage.getItem(K_WIFI) === 'on';
export function setAutoplay(on) { localStorage.setItem(K_ON, on ? 'on' : 'off'); }
export function setWifiOnly(on) { localStorage.setItem(K_WIFI, on ? 'on' : 'off'); }
// Wi-Fi is only detectable where the Network Information API exposes `type` (mostly Android Chrome).
export const canDetectWifi = () => !!(conn() && 'type' in conn());
export function saveData() {
  const c = conn();
  if (c && c.saveData) return true;
  try { return matchMedia('(prefers-reduced-data: reduce)').matches; } catch { return false; }
}
function onWifi() {
  const c = conn(); if (!c || !('type' in c)) return true;   // unknown: don't block
  return ['wifi', 'ethernet', 'wimax', 'none', 'unknown'].includes(c.type) && c.type !== 'cellular';
}
// Should videos start by themselves right now?
export function canAutoplay() {
  if (!autoplayEnabled() || saveData()) return false;
  if (wifiOnly() && !onWifi()) return false;
  return true;
}
export const soundOn = () => { try { return sessionStorage.getItem(K_SOUND) === '1'; } catch { return false; } };
export function setSoundOn(on) { try { sessionStorage.setItem(K_SOUND, on ? '1' : '0'); } catch { /* private mode */ } }

// A feed video started: tell other media (e.g. the Kemy theme music) to stop.
export function claimAudio(source = 'feed') {
  window.dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source } }));
  document.querySelectorAll('audio[data-kemy-theme], audio.kemy-theme, audio[src*="kemy-theme"]').forEach((a) => { try { a.pause(); } catch { /* ignore */ } });
  try { window.kemyTheme?.pause?.(); } catch { /* ignore */ }
}

// Play the <video> that is >= 60 % in view inside `root`, one at a time (used outside the full-screen feed).
export function autoplayIn(root, sel = 'video[data-autoplay]') {
  if (!root || !('IntersectionObserver' in window)) return () => {};
  let current = null;
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6 && canAutoplay() && !document.hidden) {
        if (current && current !== v) current.pause();
        current = v; v.muted = true; v.loop = true; v.playsInline = true;
        if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    });
  }, { threshold: [0, 0.6] });
  root.querySelectorAll(sel).forEach((v) => io.observe(v));
  const vis = () => { if (document.hidden) current?.pause(); };
  document.addEventListener('visibilitychange', vis);
  return () => { io.disconnect(); document.removeEventListener('visibilitychange', vis); current?.pause(); };
}
