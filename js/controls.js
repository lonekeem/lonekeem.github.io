// Kemy touch controls (shared by Pal Park and the arcade mini-games, so every 3D screen feels the same).
// - Floating joystick: appears where the left thumb lands, dead zone + smooth analog speed (0..1, run past 85%).
// - Right-side drag area to look / aim (sensitivity setting).
// - Big thumb buttons (>= 64px): any set of { id, icon, label, hold }. Hold buttons report down/up (auto-fire).
// - Haptics (navigator.vibrate where supported), settings panel (button size, sensitivity, left-handed swap,
//   opacity) saved in localStorage, and a one-time tutorial overlay per screen.
// Keyboard + mouse also work (WASD/arrows, Shift run, Space jump, mouse drag to look).
// Usage: const c = createControls(host, { buttons:[...], tutorialKey:'zombie', tips:[...] });
//        each frame: c.move -> {x,y,mag}, c.takeLook() -> {dx,dy}, c.down('fire'); c.on('jump', fn); c.destroy().
import { installNoZoom } from './no-zoom.js';
import { arrowMode, device, eatKey, hintFor, invertY, keyboardLook, moveStick, onDevice, rumble, sample } from './input.js';
installNoZoom();
const KEY = 'kemy-controls';
export const DEFAULTS = { size: 72, sens: 1, left: false, opacity: 0.75, haptics: true };
export function loadSettings() { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...DEFAULTS }; } }
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } }
export function buzz(ms = 12) { try { if (loadSettings().haptics && navigator.vibrate) navigator.vibrate(ms); } catch { /* */ } try { rumble(ms); } catch { /* */ } }
const CSS = `.kc{position:absolute;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.kc-l,.kc-r{position:absolute;top:0;bottom:0;width:50%}.kc-l{left:0}.kc-r{right:0}.kc.lh .kc-l{left:auto;right:0}.kc.lh .kc-r{right:auto;left:0}
.kc-joy{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;background:rgba(255,255,255,.18);border:3px solid rgba(255,255,255,.55);pointer-events:none;display:none}
.kc-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 3px 10px rgba(0,0,0,.3)}
.kc-hint{position:absolute;left:18%;bottom:calc(max(18px,env(safe-area-inset-bottom)) + 40px);width:110px;height:110px;margin-left:-55px;border-radius:50%;border:3px dashed rgba(255,255,255,.4);pointer-events:none}.kc.lh .kc-hint{left:82%}
.kc-btns{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + 14px);display:grid;grid-template-columns:repeat(3,auto);gap:10px;align-items:end;justify-items:center;direction:rtl}.kc.lh .kc-btns{right:auto;left:max(12px,env(safe-area-inset-left));direction:ltr}
.kc-b{direction:ltr;border-radius:50%;border:3px solid rgba(255,255,255,.8);background:rgba(30,20,60,.55);color:#fff;font-size:calc(var(--kc)*.42);width:var(--kc);height:var(--kc);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;touch-action:none;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.kc-b small{font-size:11px;margin-top:2px;font-weight:700}.kc-b.big{width:calc(var(--kc)*1.35);height:calc(var(--kc)*1.35);font-size:calc(var(--kc)*.55);background:rgba(232,67,79,.6)}.kc-b.on{transform:scale(.92);background:rgba(255,255,255,.35)}
.kc-gear{position:absolute;top:max(8px,env(safe-area-inset-top));right:58px;z-index:7;width:48px;height:48px;border-radius:50%;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:22px}
.kc-set,.kc-tut{position:absolute;inset:0;z-index:9;background:rgba(10,5,30,.78);color:#fff;display:flex;align-items:center;justify-content:center;padding:16px}
.kc-card{background:#2b1d55;border-radius:18px;padding:18px;max-width:380px;width:100%;font:15px system-ui}.kc-card h3{margin:0 0 10px}.kc-card label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0}
.kc-all{display:flex;align-items:center;justify-content:center;min-height:48px;margin:0 0 12px;border-radius:12px;background:#ffd23f;color:#2b1d55;font-weight:800;text-decoration:none;text-align:center}
.kc-card button{min-height:48px;border-radius:12px;border:0;padding:0 18px;font-weight:700;background:#ffd23f;color:#2b1d55;font-size:16px}.kc-tut ul{padding-left:20px;line-height:1.7}`;
export function createControls(host, o = {}) {
  if (!document.getElementById('kc-css')) { const s = document.createElement('style'); s.id = 'kc-css'; s.textContent = CSS; document.head.appendChild(s); }
  let S = loadSettings(); const root = document.createElement('div'); root.className = 'kc'; host.appendChild(root);
  const btns = o.buttons || [];
  root.innerHTML = `<div class="kc-l"><div class="kc-hint"></div><div class="kc-joy"><i></i></div></div><div class="kc-r"></div>
    <div class="kc-btns">${btns.map((b) => `<button type="button" class="kc-b${b.big ? ' big' : ''}" data-b="${b.id}" aria-label="${b.label}">${b.icon}<small>${b.label}</small></button>`).join('')}</div>
    ${o.settings === false ? '' : '<button type="button" class="kc-gear" aria-label="Control settings">⚙️</button>'}`;
  const L = root.querySelector('.kc-l'), Rr = root.querySelector('.kc-r'), joy = root.querySelector('.kc-joy'), knob = joy.querySelector('i'), hint = root.querySelector('.kc-hint');
  const apply = () => { root.style.setProperty('--kc', Math.max(64, S.size) + 'px'); root.classList.toggle('lh', !!S.left); root.querySelectorAll('.kc-b,.kc-joy,.kc-hint').forEach((e) => (e.style.opacity = S.opacity)); };
  apply();
  const st = { move: { x: 0, y: 0, mag: 0, run: false }, look: { dx: 0, dy: 0 }, held: new Set(), subs: {}, keys: new Set() };
  const emit = (n, v) => (st.subs[n] || []).forEach((f) => f(v));
  // joystick
  let jid = null, jx = 0, jy = 0, jSeen = 0; const jreset = () => { const id = jid; jid = null; joy.style.display = 'none'; knob.style.transform = ''; st.move = { x: 0, y: 0, mag: 0, run: false }; try { if (id !== null && L.hasPointerCapture(id)) L.releasePointerCapture(id); } catch { /* */ } }; const R = 56, DEAD = 0.14;
  const looks = new Map();
  const beginLook = (e) => { if (e.button > 0) return; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* */ } looks.set(e.pointerId, [e.clientX, e.clientY, e.pointerType || '']); emit('lookstart'); };
  const moveLook = (e) => { const p = looks.get(e.pointerId); if (!p) return; st.look.dx += (e.clientX - p[0]) * S.sens; st.look.dy += (e.clientY - p[1]) * S.sens; looks.set(e.pointerId, [e.clientX, e.clientY, p[2]]); };
  L.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { beginLook(e); return; } // trackpad click-drag looks; a finger still walks
    if (jid !== null && jid !== e.pointerId) jreset(); /* self-heal: a stale/lost pointer never blocks a fresh thumb */ jid = e.pointerId; jSeen = performance.now(); try { L.setPointerCapture(e.pointerId); } catch { /* */ } const r = L.getBoundingClientRect(); jx = e.clientX - r.left; jy = e.clientY - r.top; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; joy.style.display = 'block'; hint.style.display = 'none'; knob.style.transform = '';
  });
  L.addEventListener('pointermove', (e) => { if (looks.has(e.pointerId)) moveLook(e); });
  L.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; jSeen = performance.now(); const r = L.getBoundingClientRect(); let dx = e.clientX - r.left - jx, dy = e.clientY - r.top - jy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.min(1, d / R); const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD); const s = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // smooth analog curve
    st.move = { x: m ? (dx / R / m) * s : 0, y: m ? (dy / R / m) * s : 0, mag: s, run: s > 0.85 }; });
  const jend = (e) => { if (e.pointerId !== jid) return; jreset(); };
  L.addEventListener('pointerup', jend); L.addEventListener('pointercancel', jend); L.addEventListener('lostpointercapture', jend);
  // iOS can cancel touches (notification, edge swipe, overlay/pill stealing the touch, viewport change) without a
  // matching pointer event reaching us. Reset everything on any sign of that, and self-heal if the joystick
  // pointer has no live touch any more.
  const resetAll = () => { jreset(); looks.clear(); st.look.dx = 0; st.look.dy = 0; root.querySelectorAll('.kc-b.on').forEach((b) => b.classList.remove('on')); for (const id of [...st.held]) { st.held.delete(id); emit(id + ':up'); } st.keys.clear(); };
  const onTCancel = () => resetAll();
  const onTEnd = (e) => { if (!e.touches || e.touches.length) return; if (jid !== null) jreset(); for (const id of [...looks.keys()]) if (looks.get(id)[2] === 'touch') looks.delete(id); root.querySelectorAll('.kc-b.on').forEach((b) => { if (b.dataset.ptr === 'touch') { b.classList.remove('on'); const id = b.dataset.b; if (st.held.has(id)) { st.held.delete(id); emit(id + ':up'); } } }); };
  let liveTouches = 0; const countT = (e) => { liveTouches = e.touches ? e.touches.length : 0; };
  const onVisC = () => { if (document.hidden) resetAll(); };
  document.addEventListener('touchstart', countT, { capture: true, passive: true }); document.addEventListener('touchend', countT, { capture: true, passive: true });
  document.addEventListener('touchcancel', countT, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTCancel, { capture: true, passive: true }); document.addEventListener('touchend', onTEnd, { capture: true, passive: true });
  addEventListener('blur', resetAll); addEventListener('pagehide', resetAll); document.addEventListener('visibilitychange', onVisC);
  // watchdog: joystick claims a pointer but no finger is on screen (touch device) -> release it
  const wd = setInterval(() => { if (jid !== null && 'ontouchstart' in window && !liveTouches && performance.now() - jSeen > 400) jreset(); }, 500);
  // look / aim drag
  Rr.addEventListener('pointerdown', (e) => { if (e.button > 0) return; beginLook(e); });
  Rr.addEventListener('pointermove', moveLook);
  const lend = (e) => looks.delete(e.pointerId);
  L.addEventListener('pointerup', lend); L.addEventListener('pointercancel', lend); L.addEventListener('lostpointercapture', lend);
  Rr.addEventListener('pointerup', lend); Rr.addEventListener('pointercancel', lend); Rr.addEventListener('lostpointercapture', lend);
  // Two fingers (touchscreen or a touchpad that sends both) look from the midpoint and pinch to zoom.
  const ptrs = new Map(); let pinch0 = 0, mid0 = null;
  const trackPtr = (e) => { if (e.button > 0) return; if (e.target.closest && e.target.closest('.kc-b, .kc-gear, button, a, input, textarea')) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; mid0 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; } };
  root.addEventListener('pointerdown', trackPtr, true);
  root.addEventListener('pointermove', (e) => { if (!ptrs.has(e.pointerId) || ptrs.size < 2) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; if (mid0) { st.look.dx += (mx - mid0[0]) * S.sens; st.look.dy += (my - mid0[1]) * S.sens; } mid0 = [mx, my]; if (pinch0 && Math.abs(d - pinch0) > 2 && o.onZoom) o.onZoom(pinch0 / d); pinch0 = d; }, true);
  const dropPtr = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) { pinch0 = 0; mid0 = null; } };
  root.addEventListener('pointerup', dropPtr, true); root.addEventListener('pointercancel', dropPtr, true);
  root.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, .kc-card')) return;
    e.preventDefault();
    if (e.ctrlKey) { if (o.onZoom) o.onZoom(1 + Math.sign(e.deltaY) * 0.08); return; }
    const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
    if (ax > ay * 0.75) { st.look.dx += e.deltaX * 0.45 * S.sens; st.look.dy += e.deltaY * 0.15 * S.sens; }
    else { if (o.onZoom) o.onZoom(1 + Math.sign(e.deltaY) * 0.1); if (ax) st.look.dx += e.deltaX * 0.3 * S.sens; }
  }, { passive: false });
  // buttons
  root.querySelectorAll('.kc-b').forEach((b) => { const id = b.dataset.b;
    b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.stopPropagation(); b.dataset.ptr = e.pointerType || ''; try { b.setPointerCapture(e.pointerId); } catch { /* */ } b.classList.add('on'); st.held.add(id); buzz(10); emit(id, true); });
    const up = () => { if (!st.held.has(id)) return; b.classList.remove('on'); st.held.delete(id); emit(id + ':up'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); b.addEventListener('contextmenu', (e) => e.preventDefault()); });
  // keyboard
  const KB = o.keys || {}; // e.g. { ' ': 'jump', q: 'switch', e: 'special', f: 'fire', Shift: 'dodge' }
  const kd = (e) => { if (/input|textarea/i.test(e.target.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (eatKey(k)) return; if (document.querySelector('.kc-set, .kc-tut, .ew-ov, #modal-root .modal-backdrop')) return; st.keys.add(k); const b = KB[k]; if (b && !st.held.has(b)) { st.held.add(b); emit(b, true); } if (/^(Arrow|w$|a$|s$|d$| )/.test(k)) e.preventDefault(); };
  const ku = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; st.keys.delete(k); const b = KB[k]; if (b) { st.held.delete(b); emit(b + ':up'); } };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const kbMove = () => { const K = st.keys; const arrows = arrowMode() !== 'look'; const x = (K.has('d') || (arrows && K.has('ArrowRight')) ? 1 : 0) - (K.has('a') || (arrows && K.has('ArrowLeft')) ? 1 : 0), y = (K.has('s') || (arrows && K.has('ArrowDown')) ? 1 : 0) - (K.has('w') || (arrows && K.has('ArrowUp')) ? 1 : 0); const m = Math.hypot(x, y); return m ? { x: x / m, y: y / m, mag: 1, run: K.has('Shift') } : null; };
  // settings
  function settings() { const d = document.createElement('div'); d.className = 'kc-set';
    d.innerHTML = `<div class="kc-card"><a class="kc-all" href="#/settings">All Kemy settings</a><h3>🎮 Controls</h3><label>Button size <input type="range" min="64" max="110" value="${S.size}" data-k="size"></label><label>Look sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${S.sens}" data-k="sens"></label>
      <label>Control opacity <input type="range" min="0.3" max="1" step="0.05" value="${S.opacity}" data-k="opacity"></label><label>Left-handed (swap sides) <input type="checkbox" ${S.left ? 'checked' : ''} data-k="left"></label><label>Vibration <input type="checkbox" ${S.haptics ? 'checked' : ''} data-k="haptics"></label><label>Invert look <input type="checkbox" ${invertY() ? 'checked' : ''} data-inv></label><p style="margin:8px 0;font-size:13px">Q and E turn the camera. Two-finger drag looks. Scroll or pinch zooms. A controller uses the left stick to walk and the right stick to look. Turn your phone sideways for a bigger view. In the world, tap 🔄 to rotate.</p>
      <div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-reset>Reset</button><button type="button" data-done>Done</button></div></div>`;
    d.addEventListener('input', (e) => { if (e.target.dataset.inv != null) { import('./input.js').then((m) => { const p = m.loadPrefs(); p.invertY = e.target.checked; m.savePrefs(p); }); return; } const k = e.target.dataset.k; if (!k) return; S[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value); saveSettings(S); apply(); });
    d.querySelector('[data-reset]').onclick = () => { S = { ...DEFAULTS }; saveSettings(S); apply(); d.remove(); settings(); };
    d.querySelector('[data-done]').onclick = () => { d.remove(); emit('settings:closed'); }; root.appendChild(d); emit('settings:open'); }
  root.querySelector('.kc-gear')?.addEventListener('click', settings);
  function tutorial(force) { const k = 'kemy-tut-' + (o.tutorialKey || 'x'); try { if (!force && localStorage.getItem(k)) return Promise.resolve(); } catch { /* */ }
    return new Promise((res) => { const d = document.createElement('div'); d.className = 'kc-tut';
      d.innerHTML = `<div class="kc-card"><h3>${o.tutorialTitle || 'How to play'}</h3><ul>${(o.tips || ['👈 Put your thumb anywhere on the left to walk', '👉 Drag on the right to look around']).map((t) => `<li>${t}</li>`).join('')}</ul><button type="button" style="width:100%">Got it! ▶</button></div>`;
      d.querySelector('button').onclick = () => { try { localStorage.setItem(k, '1'); } catch { /* */ } d.remove(); res(); }; root.appendChild(d); }); }
  const paintHints = () => {
    let kind = 'touch'; try { kind = device() || 'touch'; } catch { /* */ }
    const desk = kind !== 'touch';
    root.classList.toggle('kc-desk', desk);
    root.querySelectorAll('.kc-b').forEach((b) => { const small = b.querySelector('small'); if (!small) return; if (!b.dataset.label) b.dataset.label = small.textContent; small.textContent = desk ? (hintFor(b.dataset.b, kind) || b.dataset.label) : b.dataset.label; });
  };
  const offDev = onDevice(paintHints); paintHints();
  return {
    root, settings, tutorial, get settingsNow() { return S; },
    get move() {
      const kb = kbMove(); const pad = moveStick();
      if (kb && pad) return (pad.mag > 0.2 ? { x: pad.x, y: pad.y, mag: pad.mag, run: pad.run || kb.run } : kb);
      return kb || (pad && pad.mag > 0.05 ? pad : null) || st.move;
    },
    takeLook() {
      const pad = sample(); const blocked = new Set(Object.keys(KB));
      const turn = keyboardLook(st.keys, undefined, blocked);
      st.look.dx += (pad.lookX || 0) * S.sens * 10 + turn.x * S.sens * 2.6;
      st.look.dy += (pad.lookY || 0) * S.sens * 10 + turn.y * S.sens * 2.2;
      const inv = invertY() ? -1 : 1;
      const l = { dx: st.look.dx, dy: st.look.dy * inv };
      st.look.dx = 0; st.look.dy = 0; return l;
    },
    addLook(dx, dy) { st.look.dx += dx * S.sens; st.look.dy += dy * S.sens; },
    down: (id) => st.held.has(id),
    on(n, f) { (st.subs[n] = st.subs[n] || []).push(f); return () => { st.subs[n] = st.subs[n].filter((x) => x !== f); }; },
    setLabel(id, icon, label) { const b = root.querySelector(`[data-b="${id}"]`); if (b) b.innerHTML = `${icon}<small>${label}</small>`; },
    reset: () => resetAll(),
    destroy() { offDev(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); clearInterval(wd); removeEventListener('blur', resetAll); removeEventListener('pagehide', resetAll); document.removeEventListener('visibilitychange', onVisC);
      document.removeEventListener('touchstart', countT, true); document.removeEventListener('touchend', countT, true); document.removeEventListener('touchcancel', countT, true); document.removeEventListener('touchcancel', onTCancel, true); document.removeEventListener('touchend', onTEnd, true); root.remove(); }
  };
}
