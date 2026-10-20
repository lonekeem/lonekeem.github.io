// Kemy no-zoom guard: stops iOS Safari / home-screen double-tap, pinch and
// focus zoom while any game / 3D view is on screen, and auto-recovers if the
// page ever ends up zoomed or scrolled. Idempotent; imported by app.html and
// js/controls.js so every game (zombie, Pal Park, red-light, arcade) gets it.
const GAME_SEL = '.zg, .p3-view, .kc, .rl, .rlgl, [data-kemy-game], [data-nozoom]';
const VP_GAME = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

export function installNoZoom() {
  if (window.__kemyNoZoom) return window.__kemyNoZoom;
  const d = document, html = d.documentElement;
  let meta = d.querySelector('meta[name=viewport]');
  if (!meta) { meta = d.createElement('meta'); meta.name = 'viewport'; d.head.appendChild(meta); }
  const baseVp = meta.getAttribute('content') || 'width=device-width, initial-scale=1';
  const extra = /interactive-widget=[^,]+/.exec(baseVp); // keep keyboard behaviour
  const gameVp = VP_GAME + (extra ? ', ' + extra[0] : '');

  const st = d.createElement('style'); st.id = 'kemy-nozoom-css';
  st.textContent = `html.kz-game,html.kz-game body{overscroll-behavior:none;overflow:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}
html.kz-game body{position:fixed;inset:0;width:100%;height:100%;touch-action:none}
html.kz-game :is(.zg,.p3-view,.kc,.rl,.rlgl,[data-kemy-game],[data-nozoom]){touch-action:none;-webkit-tap-highlight-color:transparent}
html.kz-game :is(.zg,.p3-view,.kc,.rl,.rlgl,[data-kemy-game],[data-nozoom]) canvas{touch-action:none}
html.kz-game :is(button,a,[role=button],label,select,.zg-panel,.zg-card){touch-action:manipulation}
html.kz-game :is(input,textarea,select){font-size:max(16px,1em)!important;touch-action:manipulation}
html.kz-game :is(.zg-panel,.zg-card,[class*=-scroll],[class*=-list],[class*=-log]){touch-action:pan-y}`;
  d.head.appendChild(st);

  let on = false;
  const inGame = () => !!d.querySelector(GAME_SEL);
  const relayout = () => { try { window.dispatchEvent(new Event('resize')); } catch { /* */ } };
  let resetting = false;
  const reset = () => { // force: re-write meta, scroll home, re-layout renderers
    resetting = true;
    meta.setAttribute('content', gameVp.replace('maximum-scale=1', 'maximum-scale=1.0001'));
    requestAnimationFrame(() => { meta.setAttribute('content', on ? gameVp : baseVp); window.scrollTo(0, 0); if (d.scrollingElement) d.scrollingElement.scrollTop = 0; setTimeout(() => { resetting = false; relayout(); }, 60); });
  };
  const recover = () => {
    if (!on || resetting) return;
    const v = window.visualViewport;
    if (v && (Math.abs(v.scale - 1) > 0.01 || (!/^(INPUT|TEXTAREA)$/.test((d.activeElement || {}).tagName || '') && (Math.abs(v.offsetLeft) > 1 || Math.abs(v.offsetTop) > 1)))) { reset(); return; }
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    if (d.scrollingElement) d.scrollingElement.scrollTop = 0;
  };
  const set = (v) => {
    if (v === on) return; on = v;
    html.classList.toggle('kz-game', v);
    meta.setAttribute('content', v ? gameVp : baseVp);
    if (v) { window.scrollTo(0, 0); setTimeout(recover, 50); }
  };
  const check = () => set(inGame());

  // Pinch (Safari gesture events + any 2-finger touchmove not on a control layer)
  const stop = (e) => { if (on) e.preventDefault(); };
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) d.addEventListener(t, stop, { passive: false, capture: true });
  d.addEventListener('touchmove', (e) => {
    if (!on) return;
    if (e.touches.length > 1 || (e.scale && e.scale !== 1)) { if (e.cancelable) e.preventDefault(); }
  }, { passive: false, capture: true });
  // Double-tap zoom. Only guard single-finger quick re-taps; never touches with
  // other fingers down, so joystick + fire multi-touch is untouched.
  let lastEnd = 0, lastX = 0, lastY = 0;
  d.addEventListener('touchend', (e) => {
    if (!on || e.touches.length || e.changedTouches.length !== 1) { lastEnd = 0; return; }
    const t = e.changedTouches[0], now = e.timeStamp || performance.now();
    const tag = (e.target && e.target.tagName) || '';
    if (e.target && e.target.closest && e.target.closest('.kc')) { lastEnd = 0; return; } // control layer: touch-action:none already blocks zoom
    if (now - lastEnd < 350 && Math.abs(t.clientX - lastX) < 40 && Math.abs(t.clientY - lastY) < 40 && !/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) {
      if (e.cancelable) e.preventDefault();
      // preventDefault on touchend suppresses the synthetic click; re-issue it for buttons
      const b = e.target && e.target.closest && e.target.closest('button,a,[role=button],label');
      if (b) b.click();
      lastEnd = 0; return;
    }
    lastEnd = now; lastX = t.clientX; lastY = t.clientY;
  }, { passive: false, capture: true });
  d.addEventListener('dblclick', stop, { passive: false, capture: true });

  const vv = window.visualViewport;
  if (vv) { vv.addEventListener('resize', recover); vv.addEventListener('scroll', recover); }
  window.addEventListener('resize', recover);
  window.addEventListener('orientationchange', () => { setTimeout(recover, 60); setTimeout(recover, 400); });
  window.addEventListener('scroll', recover, { passive: true });
  d.addEventListener('focusout', () => setTimeout(recover, 80)); // keyboard close can leave page offset
  d.addEventListener('focusin', () => setTimeout(recover, 300));
  d.addEventListener('visibilitychange', () => { if (!d.hidden) setTimeout(recover, 60); });
  // Safety net: if iOS still ends up magnified (user could not pinch back out), poll while in-game.
  setInterval(() => { if (on && !d.hidden) recover(); }, 250);

  new MutationObserver(check).observe(d.body || html, { childList: true, subtree: true });
  check();
  return (window.__kemyNoZoom = { check, recover, reset, get active() { return on; } });
}

if (typeof document !== 'undefined') {
  if (document.body) installNoZoom(); else document.addEventListener('DOMContentLoaded', () => installNoZoom(), { once: true });
}
