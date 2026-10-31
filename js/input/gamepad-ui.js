// Button guides for Kemy: a toast when a controller connects, a guide in Settings
// (PlayStation / Xbox / Keyboard tabs), a first-play keyboard hint on computers, and
// small "what to press" badges beside on-screen buttons. Original art only.
// Loaded lazily by js/input.js. Written by Lone Keem.
import { device, labelKind, loadPrefs, keyLabel, onDevice } from '../input.js';

const LS_LABELS = 'kemy-pad-labels';
const LS_HINT = 'kemy-kb-hint-seen';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const FACE = {
  ps: { a: '✕', b: '○', x: '□', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', sel: 'Share', start: 'Options', ls: 'Left stick', rs: 'Right stick', dpad: 'D-pad' },
  xbox: { a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', sel: 'View', start: 'Menu', ls: 'Left stick', rs: 'Right stick', dpad: 'D-pad' }
};
const COLOR = { a: '#2f6b4f', b: '#8a3a4a', x: '#2a4f86', y: '#8a6a22' };

export function badge(btn, fam) {
  const f = FACE[fam === 'ps' ? 'ps' : 'xbox'];
  const t = f[btn] || btn;
  const face = /^[abxy]$/.test(btn);
  const bg = face ? (fam === 'ps' ? '#3a2460' : COLOR[btn]) : '#3a2460';
  return `<span class="kg-b${face ? ' kg-face' : ''}" style="background:${bg}" data-btn="${btn}">${esc(t)}</span>`;
}
const kbd = (k) => `<kbd class="kg-k">${esc(k)}</kbd>`;

function famNow() {
  const d = device();
  const k = labelKind(d === 'ps' || d === 'xbox' ? d : 'generic');
  return k === 'ps' ? 'ps' : 'xbox';
}

// What each button does, per place. Pad rows: [buttons[], text]. Key rows: [keys[], text].
function padContexts() {
  return [
    ['Open world', [
      [['ls', 'dpad'], 'Walk (push far to run) / steer'], [['rs'], 'Turn the camera'],
      [['a'], 'Jump, or enter a door or car'], [['b'], 'Back / get out of a car'],
      [['x'], 'Emote or use item (horn in a car)'], [['y'], 'Menu'],
      [['rt'], 'Gas'], [['lt'], 'Brake'], [['lb'], 'Hand brake / previous tab'], [['rb'], 'Next tab'],
      [['sel'], 'Map'], [['start'], 'Pause']]],
    ['Menus and shop', [
      [['dpad', 'ls'], 'Move between buttons'], [['a'], 'Select'], [['b'], 'Back / close'],
      [['lb', 'rb'], 'Switch tabs'], [['rs'], 'Scroll'], [['start'], 'Open Settings']]],
    ['Kemy Quest', [
      [['ls', 'dpad'], 'Move'], [['a', 'y'], 'Jump'], [['b', 'x', 'rt'], 'Run'], [['start'], 'Pause']]],
    ['Kemy Rush', [
      [['rt', 'a'], 'Gas'], [['lt', 'b'], 'Brake / lean back'], [['start'], 'Pause']]],
    ['Pool', [
      [['ls', 'dpad'], 'Left/right aim, up/down power'], [['a'], 'Shoot'], [['b'], 'Leave']]],
    ['Pal Games', [
      [['a'], 'Jump (race)'], [['ls'], 'Move (star catch)'], [['dpad'], 'Dance lanes ← ↓ ↑ →']]]
  ];
}
function keyContexts() {
  const k = loadPrefs().keys;
  const L = (a) => keyLabel(k[a]);
  return [
    ['Open world', [
      [['W A S D', '← ↑ ↓ →'], 'Walk / drive'], [['Mouse drag', 'Touchpad'], 'Look around'],
      [[L('lookLeft'), L('lookRight')], 'Turn the camera'], [[L('jump')], 'Jump (or enter when shown)'],
      [[L('run')], 'Run'], [[L('interact')], 'Enter a door or car'], [[L('patrol')], 'Talk to Kemy Patrol / report'],
      [[L('use')], 'Emote or item'], [['1–8'], 'Quick emotes'], [[L('map'), 'Tab'], 'Map'],
      [['Scroll', L('zoomIn'), L('zoomOut')], 'Zoom'], [[L('horn')], 'Horn (in a car)'], [[L('camera')], 'Camera view'],
      [[L('menu')], 'Controls / pause'], [['?'], 'Show this guide']]],
    ['Menus and shop', [
      [['Click'], 'Select'], [['← ↑ ↓ →', 'Tab'], 'Move between buttons'], [['Enter'], 'Select'], [['Esc'], 'Close']]],
    ['Kemy Quest', [
      [['← →', 'A D'], 'Move'], [['Space', 'Z', 'W', 'K'], 'Jump'], [['X', 'Shift', 'J'], 'Run'], [['Esc', 'P'], 'Pause']]],
    ['Kemy Rush', [
      [['→', '↑', 'D', 'W'], 'Gas'], [['←', '↓', 'A', 'S'], 'Brake'], [['Esc', 'P'], 'Pause']]],
    ['Pool', [
      [['Mouse drag'], 'Aim and pull back'], [['← →'], 'Fine aim'], [['↑ ↓'], 'Power'], [['Space', 'Enter'], 'Shoot']]],
    ['Pal Games', [
      [['Space', '↑'], 'Jump (race)'], [['← →', 'A D'], 'Move (star catch)'], [['D F J K', '← ↓ ↑ →'], 'Dance lanes']]]
  ];
}

export function guideHTML(tab, compact) {
  const ctx = tab === 'kb' ? keyContexts() : padContexts();
  const row = ([btns, text]) => `<li><span class="kg-keys">${btns.map((b) => tab === 'kb' ? kbd(b) : badge(b, tab)).join('')}</span><span>${esc(text)}</span></li>`;
  if (compact) return `<ul class="kg-list">${ctx[0][1].filter((r, i) => [0, 1, 2, 3, 4, 5].includes(i)).map(row).join('')}</ul>`;
  return ctx.map(([name, rows]) => `<section class="kg-ctx"><h3>${esc(name)}</h3><ul class="kg-list">${rows.map(row).join('')}</ul></section>`).join('');
}

const CSS = `.kg-b{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 6px;border-radius:13px;color:#fff8e8;font:800 12px system-ui,sans-serif;border:2px solid rgba(255,255,255,.35);box-sizing:border-box;white-space:nowrap}
.kg-b.kg-face{width:26px;padding:0;font-size:14px}
.kg-k{display:inline-block;min-width:22px;padding:2px 6px;border-radius:6px;background:#fff8e8;color:#2b1d55;font:800 12px system-ui,sans-serif;border-bottom:3px solid #b9a6e8;text-align:center;white-space:nowrap}
.kg-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.kg-list li{display:flex;align-items:center;gap:10px;min-height:32px}
.kg-keys{display:inline-flex;gap:4px;flex-wrap:wrap;min-width:96px}
.kg-ctx h3{font-size:15px;margin:12px 0 6px}
.kg-toast{position:fixed;left:calc(10px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));z-index:99999;max-width:min(330px,80vw);max-height:60vh;overflow:auto;padding:10px 12px;font-size:13px;border-radius:18px;background:rgba(32,18,64,.94);color:#fff8e8;box-shadow:0 8px 30px rgba(0,0,0,.4);transition:opacity .5s;pointer-events:auto}
.kg-toast.out{opacity:0}
.kg-toast .kg-list li{min-height:26px;gap:8px}.kg-toast .kg-keys{min-width:78px}
.kg-toast .kg-x{position:static;float:right;display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:2px 6px;margin:-4px -4px 4px 8px;border-radius:12px;background:rgba(255,255,255,.12);font-size:16px}
.kg-toast .kg-x:focus{outline:3px solid #ffd34d}
.kg-toast b{display:block;margin-bottom:8px}
.kg-toast small{display:block;margin-top:8px;opacity:.75}
.kg-x{position:absolute;top:6px;right:8px;background:none;border:0;color:#fff8e8;font-size:18px;min-width:32px;min-height:32px}
.kg-tabs{display:flex;gap:6px;margin:8px 0}
.kg-tabs button{flex:1;min-height:40px;border-radius:12px;border:0;background:rgba(138,43,226,.25);color:inherit;font-weight:800}
.kg-tabs button[aria-selected=true]{background:#ffd34d;color:#2b1d55}
.kg-ov{position:fixed;inset:0;z-index:99998;background:rgba(10,6,24,.7);display:flex;align-items:center;justify-content:center}
.kg-card{background:#1f1240;color:#fff8e8;border-radius:20px;padding:16px;width:min(560px,94vw);max-height:86vh;overflow:auto;position:relative}
.kg-help{position:fixed;right:12px;top:calc(64px + env(safe-area-inset-top));z-index:9000;min-width:36px;min-height:36px;border-radius:18px;border:0;background:rgba(32,18,64,.85);color:#ffd34d;font-weight:900;display:none}
body.kemy-kb .kg-help,body.kemy-pad .kg-help{display:block}
body.kemy-kb [data-kbh]::after,body.kemy-pad [data-pdh]::after{content:attr(data-kbh);margin-left:6px;padding:1px 5px;border-radius:6px;background:#fff8e8;color:#2b1d55;font:800 11px system-ui,sans-serif;vertical-align:middle}
body.kemy-pad [data-pdh]::after{content:attr(data-pdh);border-radius:10px;background:#3a2460;color:#fff8e8;border:1px solid rgba(255,255,255,.4)}
body.kemy-pad [data-kbh]:not([data-pdh])::after{content:none}`;

function css() {
  if (document.getElementById('kg-css')) return;
  const s = document.createElement('style'); s.id = 'kg-css'; s.textContent = CSS; document.head.appendChild(s);
}

let toastEl = null, toastT = 0, offToast = null;
function closeToast() {
  if (!toastEl) return;
  const el = toastEl; toastEl = null; clearTimeout(toastT);
  if (offToast) { offToast(); offToast = null; }
  removeEventListener('keydown', onEsc, true);
  el.classList.add('out'); setTimeout(() => el.remove(), 300);
}
export function padConnected(kind) {
  css(); badges();
  const fam = labelKind(kind) === 'ps' ? 'ps' : 'xbox';
  const name = kind === 'ps' ? 'PlayStation' : kind === 'xbox' ? 'Xbox' : 'Game';
  closeToast();
  const el = document.createElement('div');
  el.className = 'kg-toast'; el.setAttribute('role', 'status'); el.dataset.fam = fam;
  el.innerHTML = `${closeBtn(fam)}<b>🎮 ${name} controller connected</b>${guideHTML(fam, true)}<small>Full guide: Settings › Controls</small>`;
  el.querySelector('.kg-x').onclick = closeToast;
  document.body.appendChild(el);
  toastEl = el;
  watchClose();
}
// The guide stays until the player closes it: the × button, Esc, or ○/B.
function closeBtn(fam) {
  return `<button class="kg-x" type="button" aria-label="Close controls guide">× ${badge('b', fam)} ${kbd('Esc')}</button>`;
}
function onEsc(e) {
  if (toastEl && e.key === 'Escape' && !ov) { e.preventDefault(); e.stopImmediatePropagation(); closeToast(); }
}
function watchClose() {
  addEventListener('keydown', onEsc, true);
  // Pages without the shared input loop (Kemy Quest) watch ○/B themselves, only while the guide is up.
  if (window.__kemyInput) return;
  let was = true;
  const poll = () => {
    if (!toastEl) return;
    let b = false;
    try { for (const g of navigator.getGamepads() || []) if (g && g.buttons[1] && g.buttons[1].pressed) b = true; } catch { /* */ }
    if (b && !was) { closeToast(); return; }
    was = b; requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);
}

let ov = null;
export function openGuide(tab) {
  css();
  if (ov) { closeGuide(); return; }
  const d = device();
  tab = tab || (d === 'keyboard' || d === 'touch' ? 'kb' : famNow());
  ov = document.createElement('div');
  ov.className = 'kg-ov modal-backdrop';
  ov.innerHTML = `<div class="kg-card" role="dialog" aria-label="Controls guide"><button class="kg-x" type="button" data-close aria-label="Close">×</button><h2 style="margin:0 0 4px">Controls</h2><div class="kg-host"></div></div>`;
  ov.addEventListener('click', (e) => { if (e.target === ov) closeGuide(); });
  ov.querySelector('[data-close]').onclick = closeGuide;
  document.body.appendChild(ov);
  mountGuide(ov.querySelector('.kg-host'), tab);
  const f = ov.querySelector('.kg-tabs button[aria-selected=true]'); if (f) f.focus();
}
export function closeGuide() { if (ov) { ov.remove(); ov = null; } }

export function mountGuide(host, tab) {
  if (!host) return;
  css();
  tab = tab || (device() === 'keyboard' || device() === 'touch' ? 'kb' : famNow());
  const paint = () => {
    let lab = 'auto'; try { lab = localStorage.getItem(LS_LABELS) || 'auto'; } catch { /* */ }
    const tabs = [['ps', 'PlayStation'], ['xbox', 'Xbox'], ['kb', 'Keyboard & mouse']];
    host.innerHTML = `<div class="kg-guide"><div class="kg-tabs" role="tablist">${tabs.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${n}</button>`).join('')}</div>
      <div class="kg-body">${guideHTML(tab)}</div>
      <label class="set-row" for="kg-labels"><span>Button labels<small>Auto follows the controller you plug in.</small></span>
      <select id="kg-labels"><option value="auto">Auto</option><option value="ps">PlayStation (✕ ○ □ △)</option><option value="xbox">Xbox (A B X Y)</option></select></label>
      <p class="muted small">Typing a message: move to the text box and press ${badge('a', famNow())} to open the on-screen keyboard.</p></div>`;
    host.querySelector('#kg-labels').value = lab;
    host.querySelector('#kg-labels').onchange = (e) => { try { localStorage.setItem(LS_LABELS, e.target.value); } catch { /* */ } if (e.target.value !== 'auto') tab = e.target.value; paint(); badges(); };
    host.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; paint(); const n = host.querySelector(`[data-tab="${tab}"]`); if (n) n.focus(); });
  };
  paint();
}

// Small badges beside common on-screen buttons (Back, Close) when not on touch.
const BADGE_SEL = [
  ['.gm-bar a[aria-label="Back"], a[aria-label="Leave Pal Park"], #modal-root [data-close], .kg-card .kg-x', 'b', 'Esc']
];
let badgeQ = 0;
function paintBadges() {
  badgeQ = 0;
  const fam = famNow();
  for (const [sel, btn, key] of BADGE_SEL) document.querySelectorAll(sel).forEach((el) => {
    const p = FACE[fam][btn];
    if (el.dataset.pdh !== p) el.dataset.pdh = p;
    if (el.dataset.kbh !== key) el.dataset.kbh = key;
  });
}
let mo = null;
export function badges() {
  css();
  const d = device();
  document.body.classList.toggle('kemy-kb', d === 'keyboard');
  if (d === 'touch') { if (mo) { mo.disconnect(); mo = null; } return; }
  paintBadges();
  if (!mo && typeof MutationObserver === 'function') {
    mo = new MutationObserver(() => { if (!badgeQ) badgeQ = setTimeout(paintBadges, 250); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
}
let devHooked = false;
function hookDevice() { if (devHooked) return; devHooked = true; onDevice(() => badges()); }

// Desktop only: a one-time "Controls" hint the first time someone plays, and a ? button.
export function startKeyboardHint() {
  hookDevice(); badges();
  if (!document.querySelector('.kg-help')) {
    const b = document.createElement('button');
    b.className = 'kg-help'; b.type = 'button'; b.textContent = '?'; b.title = 'Controls (press ?)'; b.setAttribute('aria-label', 'Controls guide');
    b.onclick = () => openGuide();
    document.body.appendChild(b);
  }
  let seen = false; try { seen = localStorage.getItem(LS_HINT) === '1'; } catch { /* */ }
  if (seen) return;
  const fine = matchMedia('(pointer: fine)').matches && !matchMedia('(pointer: coarse)').matches && !(navigator.maxTouchPoints > 0);
  if (!fine) return;
  const check = () => {
    if (!document.querySelector('.p3-view, .zg, .pl-stage, .rush-run, [data-kemy-game]')) return false;
    if (device() !== 'keyboard') return device() !== 'touch';
    showKbHint(); return true;
  };
  if (check()) return;
  const m = new MutationObserver(() => { if (check()) m.disconnect(); });
  m.observe(document.body, { childList: true, subtree: true });
}
function showKbHint() {
  try { localStorage.setItem(LS_HINT, '1'); } catch { /* */ }
  closeToast();
  const el = document.createElement('div');
  el.className = 'kg-toast kg-kbhint'; el.setAttribute('role', 'status');
  el.innerHTML = `${closeBtn(famNow())}<b>⌨️ Controls</b>${guideHTML('kb', true)}<small>Press ${kbd('?')} any time for the full guide.</small>`;
  el.querySelector('.kg-x').onclick = closeToast;
  document.body.appendChild(el);
  toastEl = el; watchClose();
}
hookDevice();
