// Kemy touch controls (shared by Pal Park and the arcade mini-games, so every 3D screen feels the same).
// - Floating joystick: appears where the left thumb lands, dead zone + smooth analog speed (0..1, run past 85%).
// - Right-side drag area to look / aim (sensitivity setting).
// - Big thumb buttons (>= 64px): any set of { id, icon, label, hold }. Hold buttons report down/up (auto-fire).
// - Haptics (navigator.vibrate where supported), settings panel (button size, sensitivity, left-handed swap,
//   opacity) saved in localStorage, and a one-time tutorial overlay per screen.
// Keyboard + mouse also work (WASD/arrows, Shift run, Space jump, mouse drag to look).
// Usage: const c = createControls(host, { buttons:[...], tutorialKey:'zombie', tips:[...] });
//        each frame: c.move -> {x,y,mag}, c.takeLook() -> {dx,dy}, c.down('fire'); c.on('jump', fn); c.destroy().
const KEY = 'kemy-controls';
export const DEFAULTS = { size: 72, sens: 1, left: false, opacity: 0.75, haptics: true };
export function loadSettings() { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { return { ...DEFAULTS }; } }
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* */ } }
export function buzz(ms = 12) { try { if (loadSettings().haptics && navigator.vibrate) navigator.vibrate(ms); } catch { /* */ } }
const CSS = `.kc{position:absolute;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.kc-l,.kc-r{position:absolute;top:0;bottom:0;width:50%}.kc-l{left:0}.kc-r{right:0}.kc.lh .kc-l{left:auto;right:0}.kc.lh .kc-r{right:auto;left:0}
.kc-joy{position:absolute;width:130px;height:130px;margin:-65px 0 0 -65px;border-radius:50%;background:rgba(255,255,255,.18);border:3px solid rgba(255,255,255,.55);pointer-events:none;display:none}
.kc-joy i{position:absolute;left:50%;top:50%;width:58px;height:58px;margin:-29px 0 0 -29px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 3px 10px rgba(0,0,0,.3)}
.kc-hint{position:absolute;left:18%;bottom:16%;width:110px;height:110px;margin-left:-55px;border-radius:50%;border:3px dashed rgba(255,255,255,.4);pointer-events:none}.kc.lh .kc-hint{left:82%}
.kc-btns{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(14px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,auto);gap:10px;align-items:end;justify-items:center;direction:rtl}.kc.lh .kc-btns{right:auto;left:max(12px,env(safe-area-inset-left));direction:ltr}
.kc-b{direction:ltr;border-radius:50%;border:3px solid rgba(255,255,255,.8);background:rgba(30,20,60,.55);color:#fff;font-size:calc(var(--kc)*.42);width:var(--kc);height:var(--kc);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;touch-action:none;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.kc-b small{font-size:11px;margin-top:2px;font-weight:700}.kc-b.big{width:calc(var(--kc)*1.35);height:calc(var(--kc)*1.35);font-size:calc(var(--kc)*.55);background:rgba(232,67,79,.6)}.kc-b.on{transform:scale(.92);background:rgba(255,255,255,.35)}
.kc-gear{position:absolute;top:max(8px,env(safe-area-inset-top));right:58px;z-index:7;width:48px;height:48px;border-radius:50%;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:22px}
.kc-set,.kc-tut{position:absolute;inset:0;z-index:9;background:rgba(10,5,30,.78);color:#fff;display:flex;align-items:center;justify-content:center;padding:16px}
.kc-card{background:#2b1d55;border-radius:18px;padding:18px;max-width:380px;width:100%;font:15px system-ui}.kc-card h3{margin:0 0 10px}.kc-card label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:10px 0}
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
  let jid = null, jx = 0, jy = 0; const R = 56, DEAD = 0.14;
  L.addEventListener('pointerdown', (e) => { if (jid !== null) return; jid = e.pointerId; L.setPointerCapture(e.pointerId); const r = L.getBoundingClientRect(); jx = e.clientX - r.left; jy = e.clientY - r.top; joy.style.left = jx + 'px'; joy.style.top = jy + 'px'; joy.style.display = 'block'; hint.style.display = 'none'; knob.style.transform = ''; });
  L.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; const r = L.getBoundingClientRect(); let dx = e.clientX - r.left - jx, dy = e.clientY - r.top - jy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; const m = Math.min(1, d / R); const k = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD); const s = k * k * (3 - 2 * k) * 0.35 + k * 0.65; // smooth analog curve
    st.move = { x: m ? (dx / R / m) * s : 0, y: m ? (dy / R / m) * s : 0, mag: s, run: s > 0.85 }; });
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; joy.style.display = 'none'; st.move = { x: 0, y: 0, mag: 0, run: false }; };
  L.addEventListener('pointerup', jend); L.addEventListener('pointercancel', jend);
  // look / aim drag
  const looks = new Map();
  Rr.addEventListener('pointerdown', (e) => { Rr.setPointerCapture(e.pointerId); looks.set(e.pointerId, [e.clientX, e.clientY]); emit('lookstart'); });
  Rr.addEventListener('pointermove', (e) => { const p = looks.get(e.pointerId); if (!p) return; st.look.dx += (e.clientX - p[0]) * S.sens; st.look.dy += (e.clientY - p[1]) * S.sens; looks.set(e.pointerId, [e.clientX, e.clientY]); });
  const lend = (e) => looks.delete(e.pointerId); Rr.addEventListener('pointerup', lend); Rr.addEventListener('pointercancel', lend);
  // buttons
  root.querySelectorAll('.kc-b').forEach((b) => { const id = b.dataset.b;
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); b.classList.add('on'); st.held.add(id); buzz(10); emit(id, true); });
    const up = () => { if (!st.held.has(id)) return; b.classList.remove('on'); st.held.delete(id); emit(id + ':up'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('contextmenu', (e) => e.preventDefault()); });
  // keyboard
  const KB = o.keys || {}; // e.g. { ' ': 'jump', q: 'switch', e: 'special', f: 'fire', Shift: 'dodge' }
  const kd = (e) => { if (/input|textarea/i.test(e.target.tagName)) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; st.keys.add(k); const b = KB[k]; if (b && !st.held.has(b)) { st.held.add(b); emit(b, true); } if (/^(Arrow|w$|a$|s$|d$| )/.test(k)) e.preventDefault(); };
  const ku = (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; st.keys.delete(k); const b = KB[k]; if (b) { st.held.delete(b); emit(b + ':up'); } };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const kbMove = () => { const K = st.keys; const x = (K.has('d') || K.has('ArrowRight') ? 1 : 0) - (K.has('a') || K.has('ArrowLeft') ? 1 : 0), y = (K.has('s') || K.has('ArrowDown') ? 1 : 0) - (K.has('w') || K.has('ArrowUp') ? 1 : 0); const m = Math.hypot(x, y); return m ? { x: x / m, y: y / m, mag: 1, run: K.has('Shift') } : null; };
  // settings
  function settings() { const d = document.createElement('div'); d.className = 'kc-set';
    d.innerHTML = `<div class="kc-card"><h3>🎮 Controls</h3><label>Button size <input type="range" min="64" max="110" value="${S.size}" data-k="size"></label><label>Look sensitivity <input type="range" min="0.3" max="2.5" step="0.1" value="${S.sens}" data-k="sens"></label>
      <label>Control opacity <input type="range" min="0.3" max="1" step="0.05" value="${S.opacity}" data-k="opacity"></label><label>Left-handed (swap sides) <input type="checkbox" ${S.left ? 'checked' : ''} data-k="left"></label><label>Vibration <input type="checkbox" ${S.haptics ? 'checked' : ''} data-k="haptics"></label>
      <div style="display:flex;gap:8px;justify-content:space-between"><button type="button" data-reset>Reset</button><button type="button" data-done>Done</button></div></div>`;
    d.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; S[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value); saveSettings(S); apply(); });
    d.querySelector('[data-reset]').onclick = () => { S = { ...DEFAULTS }; saveSettings(S); apply(); d.remove(); settings(); };
    d.querySelector('[data-done]').onclick = () => { d.remove(); emit('settings:closed'); }; root.appendChild(d); emit('settings:open'); }
  root.querySelector('.kc-gear')?.addEventListener('click', settings);
  function tutorial(force) { const k = 'kemy-tut-' + (o.tutorialKey || 'x'); try { if (!force && localStorage.getItem(k)) return Promise.resolve(); } catch { /* */ }
    return new Promise((res) => { const d = document.createElement('div'); d.className = 'kc-tut';
      d.innerHTML = `<div class="kc-card"><h3>${o.tutorialTitle || 'How to play'}</h3><ul>${(o.tips || ['👈 Put your thumb anywhere on the left to walk', '👉 Drag on the right to look around']).map((t) => `<li>${t}</li>`).join('')}</ul><button type="button" style="width:100%">Got it! ▶</button></div>`;
      d.querySelector('button').onclick = () => { try { localStorage.setItem(k, '1'); } catch { /* */ } d.remove(); res(); }; root.appendChild(d); }); }
  return {
    root, settings, tutorial, get settingsNow() { return S; },
    get move() { return kbMove() || st.move; },
    takeLook() { const l = { ...st.look }; st.look.dx = 0; st.look.dy = 0; return l; },
    addLook(dx, dy) { st.look.dx += dx * S.sens; st.look.dy += dy * S.sens; },
    down: (id) => st.held.has(id),
    on(n, f) { (st.subs[n] = st.subs[n] || []).push(f); return () => { st.subs[n] = st.subs[n].filter((x) => x !== f); }; },
    setLabel(id, icon, label) { const b = root.querySelector(`[data-b="${id}"]`); if (b) b.innerHTML = `${icon}<small>${label}</small>`; },
    destroy() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); root.remove(); }
  };
}
