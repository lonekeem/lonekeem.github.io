// Keyboard, touchpad, mouse, and gamepad input for Kemy.
// Phones keep the on-screen joystick. A laptop can play with a touchpad and
// keyboard together, and a controller can run every menu. Remaps are saved on
// this device, one set for the keyboard and one for each controller family.
const STORE = 'kemy-input';
const DEAD = 0.18;

export const DEFAULT_PREFS = {
  invertY: false,
  arrowMode: 'move',
  sensPad: 1,
  keys: {
    jump: ' ',
    run: 'Shift',
    interact: 'e',
    patrol: 'f',
    use: 'x',
    menu: 'Escape',
    map: 'm',
    camera: 'v',
    lookLeft: 'q',
    lookRight: 'e',
    zoomIn: '=',
    zoomOut: '-',
    horn: 'h',
    fire: 'f',
    dodge: 'c',
    switch: 'q'
  },
  pads: {
    xbox: null,
    ps: null,
    generic: null
  }
};

const PAD_DEFAULT = {
  confirm: 0, back: 1, use: 2, menu: 3, tabPrev: 4, tabNext: 5,
  brake: 6, gas: 7, map: 8, pause: 9, up: 12, down: 13, left: 14, right: 15
};

const BUTTON_ACTION = {
  jump: 'jump', run: 'run', emote: 'use', cam: 'camera', fire: 'fire',
  dodge: 'dodge', switch: 'switch', special: 'use'
};

const KEY_LABEL = {
  ' ': 'Space', Shift: 'Shift', Escape: 'Esc', Tab: 'Tab',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓'
};

let prefsCache = null;
let deviceName = 'touch';
let world = null;
let eaten = '';
let suppress = new Set();
let sim = null;
let lastPad = null;
let frame = emptyFrame();
let seenPad = new Set();
let toastFn = () => {};
let started = false;
let capture = null;
const sampleFns = new Set();
const deviceFns = new Set();
let prevDown = new Set();
let synth = false;
let loopOn = false;
let stickRep = { dir: '', at: 0 };
const BRIDGE_SEL = '.rush-run, .pl-stage';

// Label family the player picked in Settings (auto follows the controller).
export function labelKind(kind) {
  let o = 'auto';
  try { o = (mem() && mem().getItem('kemy-pad-labels')) || 'auto'; } catch { /* */ }
  if (o === 'ps' || o === 'xbox') return o;
  return kind === 'ps' ? 'ps' : kind === 'xbox' ? 'xbox' : 'generic';
}

function emptyFrame() {
  return {
    dt: 0.016, device: 'touch',
    moveX: 0, moveY: 0, moveMag: 0,
    lookX: 0, lookY: 0,
    gas: 0, brake: 0, hand: false,
    down: {}, pressed: {},
    zoom: 0
  };
}

function mem() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function kindFromId(id = '') {
  const s = String(id).toLowerCase();
  if (/054c|sony|dualshock|dualsense|playstation|\bps[345]\b/.test(s)) return 'ps';
  if (/045e|xbox|microsoft|xinput|x-box/.test(s)) return 'xbox';
  return 'generic';
}

function clonePads() {
  return { xbox: { ...PAD_DEFAULT }, ps: { ...PAD_DEFAULT }, generic: { ...PAD_DEFAULT } };
}

export function defaultPrefs() {
  return { ...DEFAULT_PREFS, keys: { ...DEFAULT_PREFS.keys }, pads: clonePads() };
}

export function loadPrefs() {
  if (prefsCache) return prefsCache;
  const base = defaultPrefs();
  try {
    const raw = mem() && mem().getItem(STORE);
    const d = raw ? JSON.parse(raw) : null;
    if (d && typeof d === 'object') {
      if (d.keys) base.keys = { ...base.keys, ...d.keys };
      if (d.pads) for (const k of ['xbox', 'ps', 'generic']) if (d.pads[k]) base.pads[k] = { ...PAD_DEFAULT, ...d.pads[k] };
      if (d.invertY === true) base.invertY = true;
      if (d.arrowMode === 'look') base.arrowMode = 'look';
      if (Number.isFinite(d.sensPad)) base.sensPad = Math.max(0.3, Math.min(2.5, d.sensPad));
    }
  } catch { /* keep defaults */ }
  prefsCache = base;
  return base;
}

export function savePrefs(p) {
  prefsCache = p;
  try { mem() && mem().setItem(STORE, JSON.stringify(p)); } catch { /* private mode */ }
}

export function resetPrefs() {
  const p = defaultPrefs();
  savePrefs(p);
  return p;
}

try {
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) deviceName = 'keyboard';
} catch { /* touch stays the default */ }

export function device() { return deviceName; }

function noteDevice(name) {
  if (!name || name === deviceName) return;
  deviceName = name;
  const body = typeof document !== 'undefined' ? document.body : null;
  if (body) body.classList.toggle('kemy-pad', name === 'xbox' || name === 'ps' || name === 'generic');
  deviceFns.forEach((f) => { try { f(name); } catch { /* */ } });
}

export function onDevice(fn) { deviceFns.add(fn); return () => deviceFns.delete(fn); }
export function onSample(fn) { sampleFns.add(fn); return () => sampleFns.delete(fn); }

export function eatKey(k) { return eaten === k; }

export function normKey(e) {
  if (!e || e.key == null) return '';
  if (e.key === ' ') return ' ';
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

export function stickAxis(x, y) {
  const m = Math.hypot(x || 0, y || 0);
  if (m < DEAD) return { x: 0, y: 0, mag: 0 };
  const s = Math.min(1, (m - DEAD) / (1 - DEAD));
  return { x: (x / m) * s, y: (y / m) * s, mag: s };
}

export function keyboardLook(keys, prefs, blocked) {
  prefs = prefs || loadPrefs();
  const has = (k) => !!(k && keys && keys.has(k) && !(blocked && blocked.has(k)));
  let x = 0, y = 0;
  if (has(prefs.keys.lookLeft)) x -= 1;
  if (has(prefs.keys.lookRight)) x += 1;
  if (prefs.arrowMode === 'look') {
    if (has('ArrowLeft')) x -= 1;
    if (has('ArrowRight')) x += 1;
    if (has('ArrowUp')) y -= 1;
    if (has('ArrowDown')) y += 1;
  }
  if (suppress.has(prefs.keys.lookRight)) x = Math.min(0, x);
  if (suppress.has(prefs.keys.lookLeft)) x = Math.max(0, x);
  return { x, y };
}

export function arrowMode() { return loadPrefs().arrowMode; }
export function invertY() { return !!loadPrefs().invertY; }

const PAD_FACE = {
  xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu' },
  ps: { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 8: 'Share', 9: 'Options' },
  generic: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'Select', 9: 'Start' }
};

export function padLabel(index, kind) {
  const map = PAD_FACE[labelKind(kind)] || PAD_FACE.generic;
  if (map[index]) return map[index];
  if (index === 12) return 'Up';
  if (index === 13) return 'Down';
  if (index === 14) return 'Left';
  if (index === 15) return 'Right';
  return 'B' + index;
}

export function keyLabel(k) {
  if (!k) return '';
  if (KEY_LABEL[k]) return KEY_LABEL[k];
  return k.length === 1 ? k.toUpperCase() : k;
}

export function hintFor(buttonId, kind = deviceName, prefs = loadPrefs()) {
  const action = BUTTON_ACTION[buttonId] || buttonId;
  if (kind === 'xbox' || kind === 'ps' || kind === 'generic') {
    const idx = prefs.pads[kind][action];
    if (idx == null && action === 'jump') return padLabel(prefs.pads[kind].confirm, kind);
    if (idx == null) return '';
    return padLabel(idx, kind);
  }
  const key = prefs.keys[action];
  return keyLabel(key);
}

function svgWrap(inner) {
  return `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">${inner}</svg>`;
}

export function glyph(name, kind = 'xbox') {
  const face = kind === 'ps'
    ? { confirm: 'cross', back: 'circle', use: 'square', menu: 'triangle' }
    : { confirm: 'A', back: 'B', use: 'X', menu: 'Y' };
  const n = face[name] || name;
  if (n === 'cross') return svgWrap('<circle cx="16" cy="16" r="13" fill="#3a2460"/><path d="M10 10l12 12M22 10L10 22" stroke="#ffd34d" stroke-width="3" stroke-linecap="round"/>');
  if (n === 'circle') return svgWrap('<circle cx="16" cy="16" r="13" fill="#3a2460"/><circle cx="16" cy="16" r="6" fill="none" stroke="#ffd34d" stroke-width="3"/>');
  if (n === 'square') return svgWrap('<circle cx="16" cy="16" r="13" fill="#3a2460"/><rect x="10" y="10" width="12" height="12" fill="none" stroke="#ffd34d" stroke-width="3" rx="1"/>');
  if (n === 'triangle') return svgWrap('<circle cx="16" cy="16" r="13" fill="#3a2460"/><path d="M16 9l7 12H9z" fill="none" stroke="#ffd34d" stroke-width="3" stroke-linejoin="round"/>');
  const fill = { A: '#2f6b4f', B: '#8a3a4a', X: '#2a4f86', Y: '#8a6a22' }[n] || '#3a2460';
  return svgWrap(`<circle cx="16" cy="16" r="13" fill="${fill}"/><text x="16" y="21" text-anchor="middle" font-size="13" font-family="system-ui,sans-serif" font-weight="700" fill="#fff8e8">${n}</text>`);
}

export function registerWorld(handlers) {
  world = handlers;
  return () => { if (world === handlers) world = null; };
}

function typing(t) {
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  if (!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return false;
  const type = (t.type || '').toLowerCase();
  return !/^(range|checkbox|radio|color|file|button|submit)$/.test(type);
}

function isShown(el) {
  if (!el || el.hidden || (el.closest && el.closest('[hidden]'))) return false;
  const st = getComputedStyle(el);
  return st.display !== 'none' && st.visibility !== 'hidden';
}
function overlayEl() {
  if (typeof document === 'undefined') return null;
  const sel = '.kg-ov, #modal-root .modal-backdrop, .kc-set, .kc-tut, .ks-panel, .zw-ov, .ew-ov, .kd-plate, .zg-pause, .set-remap.capturing';
  const hit = [...document.querySelectorAll(sel)].find(isShown);
  if (hit) return hit;
  const house = document.querySelector('.kh-radio.min:not(.dock)');
  return isShown(house) ? house : null;
}

function inPlay() {
  return !!(world && world.active && world.active() && !overlayEl());
}

function menuMode() {
  if (typeof document === 'undefined') return false;
  if (overlayEl()) return true;
  if (document.querySelector('.p3-view, .zg, .pl-stage')) return false;
  return true;
}

function visible(el) {
  if (!el || el.disabled || el.hidden) return false;
  if (el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function focusRoot() {
  const ov = overlayEl();
  if (ov) return ov;
  if (!menuMode()) return null;
  return document.querySelector('main') || document.body;
}

function focusables(root) {
  if (!root) return [];
  const sel = 'button, a[href], input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
  return [...root.querySelectorAll(sel)].filter((el) => visible(el) && el.tabIndex !== -1);
}

function moveFocus(dir) {
  const root = focusRoot();
  const els = focusables(root);
  if (!els.length) return false;
  const cur = document.activeElement;
  if (!els.includes(cur)) { els[0].focus(); return true; }
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, score = 1e12;
  for (const el of els) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const x = b.left + b.width / 2 - cx, y = b.top + b.height / 2 - cy;
    if (dir === 'ArrowUp' && y >= -8) continue;
    if (dir === 'ArrowDown' && y <= 8) continue;
    if (dir === 'ArrowLeft' && x >= -8) continue;
    if (dir === 'ArrowRight' && x <= 8) continue;
    const primary = (dir === 'ArrowUp' || dir === 'ArrowDown') ? Math.abs(y) : Math.abs(x);
    const secondary = (dir === 'ArrowUp' || dir === 'ArrowDown') ? Math.abs(x) : Math.abs(y);
    const s = primary + secondary * 3;
    if (s < score) { score = s; best = el; }
  }
  if (!best) {
    const i = els.indexOf(cur);
    const step = (dir === 'ArrowRight' || dir === 'ArrowDown') ? 1 : -1;
    best = els[(i + step + els.length) % els.length];
  }
  if (best) { best.focus(); return true; }
  return false;
}

function activateFocus() {
  const el = document.activeElement;
  if (!el || el === document.body) {
    const first = focusables(focusRoot())[0];
    if (first) first.focus();
    return;
  }
  if (typeof el.click === 'function') el.click();
}

function closeTop() {
  const done = document.querySelector('.kg-ov [data-close], .kc-set [data-done], .kc-tut button, .ks-panel [data-close], .ew-ov [data-close], .zw-ov [data-x], .zw-ov [data-close], .kd-plate [data-x]');
  if (done) { done.click(); return true; }
  const modal = document.querySelector('#modal-root [data-close]');
  if (modal) { modal.click(); return true; }
  const house = document.querySelector('.kh-radio.min:not(.dock) [data-min]');
  if (house) { house.click(); return true; }
  return false;
}

function switchTab(dir) {
  const tabs = [...document.querySelectorAll('[role="tab"]')].filter(visible);
  if (tabs.length > 1) {
    let i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true' || t.classList.contains('on'));
    if (i < 0) i = 0;
    const n = tabs[(i + dir + tabs.length) % tabs.length];
    n.click(); n.focus(); return;
  }
  if (inPlay()) return;
  const nav = [...document.querySelectorAll('#bottom-nav a')].filter(visible);
  if (nav.length) {
    let i = nav.findIndex((a) => a.classList.contains('active'));
    if (i < 0) i = 0;
    nav[(i + dir + nav.length) % nav.length].click();
    return;
  }
  const secs = [...document.querySelectorAll('.set-sec')].filter(visible);
  if (secs.length) {
    let i = secs.findIndex((s) => s.getBoundingClientRect().top > 40);
    if (i < 0) i = dir > 0 ? 0 : secs.length - 1;
    else if (dir < 0) i = Math.max(0, i - 1);
    const s = secs[Math.max(0, Math.min(secs.length - 1, i))];
    s.scrollIntoView({ block: 'start' });
    const f = focusables(s)[0]; if (f) f.focus();
  }
}

function boundKey(k, action) {
  const keys = loadPrefs().keys;
  return keys[action] === k;
}

function onKeyDown(e) {
  eaten = '';
  if (capture && capture.device === 'keyboard') {
    e.preventDefault(); e.stopPropagation();
    const k = normKey(e);
    const p = loadPrefs();
    p.keys[capture.action] = k;
    savePrefs(p);
    const done = capture.done;
    capture = null;
    done && done();
    return;
  }
  if (synth) return;
  if (typing(e.target)) return;
  if (!e.repeat && (e.key === '?' || (e.key === '/' && e.shiftKey))) {
    import('./input/gamepad-ui.js').then((m) => m.openGuide()).catch(() => {});
    e.preventDefault(); return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.closest && e.target.closest('.kh-note-btn, .kh-radio')) return;
  const k = normKey(e);
  if (!k) return;
  noteDevice('keyboard');
  if (e.repeat) return;
  const play = inPlay();
  if (k === 'Escape' || (play && boundKey(k, 'menu'))) {
    if (closeTop()) { e.preventDefault(); return; }
    if (play) { world.menu && world.menu(); e.preventDefault(); return; }
  }
  if (k === 'Tab' && !e.shiftKey) {
    const note = document.querySelector('.kh-note-btn:not([hidden])');
    const modal = [...document.querySelectorAll('#modal-root .modal-backdrop, .kc-set, .kc-tut, .ks-panel')].some(isShown);
    if (note && !modal && document.activeElement !== note) { note.focus(); e.preventDefault(); return; }
  }
  if (!play && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') && menuMode()) {
    if (e.target && e.target.type === 'range') return;
    if (moveFocus(k)) e.preventDefault();
    return;
  }
  if (!play) return;
  if (k === 'Tab' || boundKey(k, 'map')) { world.map && world.map(); e.preventDefault(); return; }
  if (boundKey(k, 'patrol')) {
    if (!(world.driving && world.driving())) { world.patrol && world.patrol(); e.preventDefault(); }
    return;
  }
  if (boundKey(k, 'interact')) {
    if (world.driving && world.driving()) { eaten = k; return; }
    if (world.interact && world.interact()) { eaten = k; suppress.add(k); e.preventDefault(); return; }
  }
  if (k === ' ' && !(world.driving && world.driving())) {
    if (world.interact && world.interact()) { eaten = k; e.preventDefault(); return; }
  }
  if (boundKey(k, 'use') && k !== loadPrefs().keys.interact) { world.use && world.use(); }
  if (/^[1-8]$/.test(k) && !(world.driving && world.driving())) world.hotbar && world.hotbar(+k - 1);
  if (boundKey(k, 'zoomIn')) { world.zoom && world.zoom(1); e.preventDefault(); }
  if (boundKey(k, 'zoomOut')) { world.zoom && world.zoom(-1); e.preventDefault(); }
}

function onKeyUp(e) {
  const k = normKey(e);
  suppress.delete(k);
  eaten = '';
}

function readGamepads() {
  if (sim) return [sim];
  try {
    const list = (navigator.getGamepads && navigator.getGamepads()) || [];
    return [...list].filter(Boolean);
  } catch { return []; }
}

function buttonDown(p, i) {
  const b = p.buttons && p.buttons[i];
  if (!b) return false;
  return typeof b === 'object' ? !!(b.pressed || b.value > 0.45) : !!b;
}
function buttonValue(p, i) {
  const b = p.buttons && p.buttons[i];
  if (!b) return 0;
  if (typeof b === 'object') return b.value > 0 ? b.value : (b.pressed ? 1 : 0);
  return b ? 1 : 0;
}

export function simulatePad(state) {
  sim = state;
  if (state) startLoop();
  if (state && state.id) noteDevice(kindFromId(state.id));
  else if (state) noteDevice('generic');
}

export function tick() {
  const pads = readGamepads();
  const p = loadPrefs();
  let pad = null;
  for (const g of pads) {
    if (!g) continue;
    pad = g;
    const id = g.index != null ? g.index : 'sim';
    if (!sim && !seenPad.has(id)) {
      seenPad.add(id);
      noteDevice(kindFromId(g.id || ''));
      announce(g.id || '');
    } else noteDevice(kindFromId(g.id || (sim ? 'generic' : '')));
    break;
  }
  if (!pad && (deviceName === 'xbox' || deviceName === 'ps' || deviceName === 'generic') && !sim) {
    /* keep the last family so hints stay until a key or a finger */
  }
  lastPad = pad;
  const kind = pad ? kindFromId(pad.id || '') : (deviceName === 'ps' || deviceName === 'xbox' ? deviceName : 'generic');
  const map = p.pads[kind] || p.pads.generic;
  const axes = (pad && pad.axes) || [0, 0, 0, 0];
  const left = stickAxis(axes[0] || 0, axes[1] || 0);
  const look = stickAxis(axes[2] || 0, axes[3] || 0);
  const down = {};
  const pressed = {};
  for (const [action, idx] of Object.entries(map)) {
    const on = !!(pad && buttonDown(pad, idx));
    down[action] = on;
    if (on && !prevDown.has(action)) pressed[action] = true;
  }
  prevDown = new Set(Object.keys(down).filter((a) => down[a]));
  let mx = left.x, my = left.y;
  const play = inPlay();
  const decorating = !!(play && world.decorating && world.decorating());
  if (inPlay() && !decorating) {
    if (down.left) mx -= 1;
    if (down.right) mx += 1;
    if (down.up) my -= 1;
    if (down.down) my += 1;
  }
  const mag = Math.min(1, Math.hypot(mx, my));
  frame = {
    dt: 0.016,
    device: pad ? kind : deviceName,
    moveX: mag ? mx / (Math.hypot(mx, my) || 1) * mag : 0,
    moveY: mag ? my / (Math.hypot(mx, my) || 1) * mag : 0,
    moveMag: mag,
    lookX: look.x * p.sensPad,
    lookY: look.y * p.sensPad,
    gas: pad ? buttonValue(pad, map.gas) : 0,
    brake: pad ? buttonValue(pad, map.brake) : 0,
    hand: !!(play && world.driving && world.driving() && down.tabPrev),
    down, pressed, zoom: 0
  };
  if (capture && capture.device !== 'keyboard' && pad) {
    for (let i = 0; i < 16; i++) if (buttonDown(pad, i) && !capture.seen) {
      capture.seen = true;
      const prefs = loadPrefs();
      prefs.pads[capture.kind][capture.action] = i;
      savePrefs(prefs);
      const done = capture.done;
      capture = null;
      done && done();
      break;
    }
    sampleFns.forEach((f) => { try { f(frame); } catch { /* */ } });
    return frame;
  }
  const bridge = !play && typeof document !== 'undefined' && document.querySelector(BRIDGE_SEL);
  if (bridge) { bridgeKeys(bridge, down, pressed, left, frame.gas, frame.brake); sampleFns.forEach((f) => { try { f(frame); } catch { /* */ } }); return frame; }
  if (pad && menuMode() && !play) stickNav(left, look);
  if (decorating && world.decorate) world.decorate(pressed);
  else {
  if (pressed.confirm) {
    const ae = document.activeElement;
    if (ae && ae.closest && ae.closest('.kh-note-btn, .kh-radio')) ae.click();
    else if (menuMode()) activateFocus();
    else if (play) {
      if (!(world.interact && world.interact())) world.jump && world.jump();
    }
  }
  const kgx = pressed.back && document.querySelector('.kg-toast:not(.out) .kg-x');
  if (kgx) { kgx.click(); pressed.back = false; }
  if (pressed.back) {
    if (!closeTop()) {
      if (play) world.back && world.back();
      else {
        const b = document.querySelector('.gm-bar a[aria-label="Back"], a[aria-label="Leave Pal Park"]');
        if (b) b.click();
        else if (location.hash && location.hash !== '#/' && location.hash !== '#/home') history.back();
      }
    }
  }
  if (pressed.use && play) {
    if (world.driving && world.driving()) world.horn && world.horn();
    else world.use && world.use();
  }
  if ((pressed.menu || pressed.pause) && !capture) {
    if (!closeTop()) {
      if (play) world.menu && world.menu();
      else if (location.hash !== '#/settings') location.hash = '#/settings';
    }
  }
  }
  if (pressed.map && play) world.map && world.map();
  if (pressed.tabPrev && !(play && world.driving && world.driving())) {
    const note = document.querySelector('.kh-note-btn:not([hidden])');
    const modal = [...document.querySelectorAll('#modal-root .modal-backdrop, .kc-set, .kc-tut, .ks-panel')].some(isShown);
    if (note && !modal && document.activeElement !== note) note.focus();
    else switchTab(-1);
  }
  if (pressed.tabNext) switchTab(1);
  if (menuMode() && !play) {
    if (pressed.up) moveFocus('ArrowUp');
    if (pressed.down) moveFocus('ArrowDown');
    if (pressed.left) moveFocus('ArrowLeft');
    if (pressed.right) moveFocus('ArrowRight');
  }
  sampleFns.forEach((f) => { try { f(frame); } catch { /* */ } });
  return frame;
}

function keyEv(type, key, code) {
  synth = true;
  try { document.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true })); } catch { /* */ }
  synth = false;
}
const held = new Map();
function hold(name, on, key, code) {
  if (on && !held.get(name)) { held.set(name, true); keyEv('keydown', key, code); }
  else if (!on && held.get(name)) { held.set(name, false); keyEv('keyup', key, code); }
}
// Games that only listen for keys (Kemy Rush, Pool) get key presses from the pad.
function bridgeKeys(root, down, pressed, left, gas, brake) {
  const kgx = pressed.back && document.querySelector('.kg-toast:not(.out) .kg-x');
  if (kgx) { kgx.click(); return; }
  if (root.classList.contains('rush-run')) {
    hold('gas', gas > 0.3 || down.confirm || left.x > 0.4 || down.right, 'ArrowRight', 'ArrowRight');
    hold('brake', brake > 0.3 || down.back || left.x < -0.4 || down.left, 'ArrowLeft', 'ArrowLeft');
    if (pressed.pause || pressed.menu) keyEv('keydown', 'Escape', 'Escape');
    return;
  }
  // Pool: d-pad/stick aim and power, A shoots, B goes back.
  const tapKey = (k) => { keyEv('keydown', k, k); keyEv('keyup', k, k); };
  const now = performance.now();
  const dir = down.left || left.x < -0.5 ? 'ArrowLeft' : down.right || left.x > 0.5 ? 'ArrowRight' : down.up || left.y < -0.5 ? 'ArrowUp' : down.down || left.y > 0.5 ? 'ArrowDown' : '';
  if (dir && (dir !== stickRep.dir || now - stickRep.at > 90)) { stickRep = { dir, at: now }; tapKey(dir); }
  if (!dir) stickRep.dir = '';
  if (pressed.confirm) tapKey('Enter');
  if (pressed.back && !closeTop()) { const b = document.querySelector('.gm-bar a[aria-label="Back"]'); if (b) b.click(); }
}
// Left stick moves the focus ring like the d-pad; right stick scrolls.
function stickNav(left, look) {
  const now = performance.now();
  let dir = '';
  if (Math.abs(left.x) > 0.55 || Math.abs(left.y) > 0.55) dir = Math.abs(left.x) > Math.abs(left.y) ? (left.x > 0 ? 'ArrowRight' : 'ArrowLeft') : (left.y > 0 ? 'ArrowDown' : 'ArrowUp');
  if (dir) {
    const first = dir !== stickRep.dir;
    if (first || now - stickRep.at > (stickRep.n > 1 ? 120 : 380)) { stickRep = { dir, at: now, n: first ? 1 : (stickRep.n || 1) + 1 }; moveFocus(dir); }
  } else stickRep = { dir: '', at: 0 };
  if (look.mag) {
    const ov = overlayEl();
    const t = (ov && [ov, ...ov.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY))) || document.scrollingElement;
    if (t) t.scrollBy(look.x * 14, look.y * 18);
  }
}
function announce(id) {
  import('./input/gamepad-ui.js').then((m) => m.padConnected(kindFromId(id))).catch(() => { try { toastFn('🎮 Controller connected'); } catch { /* */ } });
}
function anyPad() {
  try { return [...((navigator.getGamepads && navigator.getGamepads()) || [])].some(Boolean); } catch { return false; }
}
// Polls only while a controller is plugged in; nothing runs when none is.
function startLoop() {
  if (loopOn || typeof requestAnimationFrame !== 'function') return;
  loopOn = true;
  const loop = () => {
    if (!sim && !anyPad()) {
      loopOn = false; seenPad.clear(); prevDown = new Set(); frame = emptyFrame();
      held.forEach((on, k) => { if (on) hold(k, false, k === 'gas' ? 'ArrowRight' : 'ArrowLeft', k === 'gas' ? 'ArrowRight' : 'ArrowLeft'); });
      return;
    }
    tick(); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function loadHaptics() {
  try {
    const c = JSON.parse(localStorage.getItem('kemy-controls') || '{}');
    return c.haptics !== false;
  } catch { return true; }
}

export function sample() { return frame; }

export function moveStick() {
  if (!frame.moveMag) return null;
  return { x: frame.moveX, y: frame.moveY, mag: frame.moveMag, run: frame.moveMag > 0.85 };
}

export function rumble(ms = 16, mag = 0.35) {
  if (!loadHaptics()) return;
  const p = lastPad;
  const act = p && (p.vibrationActuator || (p.hapticActuators && p.hapticActuators[0]));
  if (!act) return;
  const opts = { duration: ms, strongMagnitude: mag, weakMagnitude: mag * 0.6, startDelay: 0 };
  try {
    if (act.playEffect) act.playEffect('dual-rumble', opts);
    else if (act.pulse) act.pulse(mag, ms);
  } catch { /* this controller cannot rumble */ }
}

const HELP = 'On a laptop, WASD or the arrow keys walk. Q turns the camera left. E turns it right, and E or Space also enters a door or car when that button is showing. Drag with one finger on the touchpad to look. A two-finger drag looks around. Pinch, or scroll up and down, zooms. F talks to Kemy Patrol or opens a report. Esc opens controls. M or Tab opens the map. Keys 1 to 8 are quick emotes. Nothing needs a right-click or a middle-click.';

export function mountRemap(host) {
  if (!host || host.querySelector('.set-remap')) return;
  const box = document.createElement('div');
  box.className = 'set-remap';
  host.appendChild(box);
  const rows = [
    ['interact', 'Enter / use'],
    ['patrol', 'Talk or report'],
    ['jump', 'Jump'],
    ['lookLeft', 'Camera left'],
    ['lookRight', 'Camera right'],
    ['map', 'Map'],
    ['menu', 'Pause / settings'],
    ['use', 'Emote or item'],
    ['zoomIn', 'Zoom in'],
    ['zoomOut', 'Zoom out'],
    ['horn', 'Horn'],
    ['camera', 'Camera view'],
    ['fire', 'Fire (arcade)'],
    ['switch', 'Swap (arcade)']
  ];
  const padRows = [
    ['confirm', 'Confirm / jump'],
    ['back', 'Back'],
    ['use', 'Use item'],
    ['menu', 'Menu'],
    ['pause', 'Pause'],
    ['map', 'Map'],
    ['gas', 'Gas'],
    ['brake', 'Brake'],
    ['tabPrev', 'Previous tab'],
    ['tabNext', 'Next tab']
  ];
  const paint = () => {
    const p = loadPrefs();
    const kind = deviceName === 'ps' || deviceName === 'xbox' ? deviceName : 'generic';
    box.innerHTML = `<p class="muted small">${HELP}</p>
      <label class="set-row" for="set-invert"><span>Invert look up and down</span><input id="set-invert" type="checkbox" ${p.invertY ? 'checked' : ''}></label>
      <label class="set-row" for="set-arrows"><span>Arrow keys<small>Move, or turn the camera when you have no mouse.</small></span>
        <select id="set-arrows"><option value="move" ${p.arrowMode !== 'look' ? 'selected' : ''}>Walk / drive</option><option value="look" ${p.arrowMode === 'look' ? 'selected' : ''}>Turn camera</option></select></label>
      <div class="set-slider"><label for="set-pad-sens">Controller look <span class="muted" id="set-pad-sens-n">${p.sensPad}</span></label><input id="set-pad-sens" type="range" min="0.3" max="2.5" step="0.1" value="${p.sensPad}"></div>
      <p><b>Keyboard</b></p>
      <div class="set-binds">${rows.map(([a, label]) => `<div class="set-bind"><span>${label}</span><button type="button" data-key="${a}">${keyLabel(p.keys[a])}</button></div>`).join('')}</div>
      <p><b>Controller</b> <span class="muted small">${kind === 'ps' ? 'PlayStation' : kind === 'xbox' ? 'Xbox' : 'Gamepad'}</span></p>
      <div class="set-binds">${padRows.map(([a, label]) => `<div class="set-bind"><span>${label}</span><button type="button" data-pad="${a}">${padLabel(p.pads[kind][a], kind)}</button></div>`).join('')}</div>
      <div class="set-glyphs" aria-hidden="true">${glyph('confirm', kind)}${glyph('back', kind)}${glyph('use', kind)}${glyph('menu', kind)}</div>
      <div class="set-actions"><button class="btn btn-ghost" type="button" data-reset-input>Reset controls</button></div>`;
    box.querySelector('#set-invert').onchange = (e) => { const n = loadPrefs(); n.invertY = e.target.checked; savePrefs(n); };
    box.querySelector('#set-arrows').onchange = (e) => { const n = loadPrefs(); n.arrowMode = e.target.value === 'look' ? 'look' : 'move'; savePrefs(n); };
    const sens = box.querySelector('#set-pad-sens');
    sens.oninput = () => { const n = loadPrefs(); n.sensPad = Number(sens.value); savePrefs(n); box.querySelector('#set-pad-sens-n').textContent = String(n.sensPad); };
    box.querySelectorAll('[data-key]').forEach((b) => b.onclick = () => {
      b.textContent = 'Press a key';
      capture = { device: 'keyboard', action: b.dataset.key, done: paint };
    });
    box.querySelectorAll('[data-pad]').forEach((b) => b.onclick = () => {
      b.textContent = 'Press a button';
      capture = { device: 'pad', kind, action: b.dataset.pad, done: paint };
    });
    box.querySelector('[data-reset-input]').onclick = () => { resetPrefs(); paint(); };
  };
  paint();
  onDevice(() => { if (box.isConnected) paint(); });
}

const CSS = `body.kemy-pad :focus{outline:3px solid #ffd34d;outline-offset:3px}
.kc-desk .kc-hint{display:none!important}
.set-binds{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.set-bind{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:4px 8px;border-radius:12px;background:rgba(138,43,226,.18)}
.set-bind button{min-width:72px;min-height:40px;border-radius:10px;border:0;background:#ffd34d;color:#2b1d55;font-weight:800}
.set-glyphs{display:flex;gap:6px;margin:8px 0}
.set-remap select{min-height:40px;border-radius:10px;background:#fff;color:#111;border:0;padding:0 8px}
button,a,[role=button],label,summary{touch-action:manipulation}`;

export function startInput(opts = {}) {
  if (started) return api;
  started = true;
  toastFn = (opts && opts.toast) || toastFn;
  if (typeof document !== 'undefined') {
    if (!document.getElementById('kemy-input-css')) {
      const s = document.createElement('style'); s.id = 'kemy-input-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') noteDevice('touch');
      else if (e.pointerType === 'mouse' && deviceName === 'touch') noteDevice('keyboard');
    }, true);
    document.addEventListener('contextmenu', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('.kc, .p3-view, .zg, .pl-stage, [data-kemy-game]')) e.preventDefault();
    }, true);
    addEventListener('gamepadconnected', startLoop);
    if (anyPad()) startLoop();
    // Lazy: only loads on desktop (keyboard hint) or once a pad connects.
    if (deviceName === 'keyboard') setTimeout(() => import('./input/gamepad-ui.js').then((m) => m.startKeyboardHint()).catch(() => {}), 1500);
  }
  if (typeof window !== 'undefined') window.__kemyInput = api;
  return api;
}

const api = {
  tick, sample, device, simulatePad, loadPrefs, savePrefs, resetPrefs,
  eatKey, hintFor, glyph, kindFromId, keyboardLook, moveStick, rumble, mountRemap
};
