// Shared 🔄 control for every Kemy game. Same cycle as Pal Park: auto → landscape → portrait → auto,
// via screen.orientation.lock (fullscreen first, which Android needs). If the phone won't lock,
// the hint is "Turn your phone sideways to rotate".
// watchGameRotate() puts one button on every game route, so a new game screen gets it without a new copy.
export const ROT_FRIENDLY = 'Turn your phone sideways to rotate';

let rotWant = 'auto';
const buttons = new Set();

function rotLabel() {
  for (const rotBtn of buttons) {
    if (!rotBtn.isConnected) { buttons.delete(rotBtn); continue; }
    rotBtn.classList.toggle('on', rotWant !== 'auto');
    rotBtn.setAttribute('aria-label', rotWant === 'landscape' ? 'Landscape. Tap for portrait' : rotWant === 'portrait' ? 'Portrait. Tap for auto rotate' : 'Rotate. Tap for landscape');
  }
}

export async function cycleRotate(hint) {
  const ori = screen.orientation;
  if (!ori || typeof ori.lock !== 'function') { hint(ROT_FRIENDLY); return; }
  const next = rotWant === 'auto' ? 'landscape' : rotWant === 'landscape' ? 'portrait' : 'auto';
  try {
    if (next === 'auto') { try { ori.unlock(); } catch { /* already free */ } rotWant = 'auto'; rotLabel(); hint('Auto rotate'); return; }
    const hadFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    if (!hadFs) {
      const el = document.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) { try { await req.call(el); } catch { /* a home-screen or Play app may already be full screen */ } }
    }
    try { await ori.lock(next); }
    catch (err) {
      if (!hadFs && (document.fullscreenElement || document.webkitFullscreenElement)) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) { try { await exit.call(document); } catch { /* leave the page as it was */ } }
      }
      throw err;
    }
    rotWant = next; rotLabel(); hint(next === 'landscape' ? 'Landscape' : 'Portrait');
  } catch { hint(ROT_FRIENDLY); }
}

export function attachRotate(btn, hint) {
  if (!btn) return;
  buttons.add(btn);
  btn.onclick = () => { cycleRotate(hint); };
  rotLabel();
}

function releaseLock() {
  if (rotWant === 'auto') return;
  try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch { /* already free */ }
  rotWant = 'auto';
  rotLabel();
}

const CSS = `#k-rot{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:rgba(27,20,40,.92);color:#fff;font-size:20px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0;flex:none;box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
#k-rot.on{background:#7c3aed}
#k-rot.in-tools{position:relative;z-index:2;border:1px solid var(--border,rgba(160,110,255,.22));background:rgba(138,43,226,.1);color:var(--text,#fff)}
#k-rot.in-tools.on{background:#7c3aed;color:#fff;border-color:#7c3aed}
.gm-bar .g-tools #k-rot,.g-hero .g-tools #k-rot{width:44px;height:44px}
.pg-top #k-rot{margin-left:auto}
.zg-tb #k-rot,.sg-tb #k-rot{width:42px;height:42px;border-radius:50%;border:0;background:rgba(0,0,0,.45);font-size:18px}
#k-rot.corner{position:fixed;z-index:940;top:calc(env(safe-area-inset-top) + var(--krot-top,8px));right:calc(env(safe-area-inset-right) + var(--krot-right,8px));box-shadow:0 6px 18px rgba(0,0,0,.35)}
body.k-rot-underhead #k-rot.corner{--krot-top:calc(var(--header-h,64px) + 8px)}
body:has(.gm.top-right) #k-rot.corner{--krot-right:58px}
body:has(#modal-root .modal-backdrop) #k-rot.corner{z-index:40}
body.k-rot-underhead .app-main > section > :first-child:not(.zl-card):not(.sl-card){padding-right:56px;box-sizing:border-box}
body.k-rot-underhead .zl h2,body.k-rot-underhead .sl h2,body.k-rot-underhead .pal-box-head,body.k-rot-underhead .za-top{padding-right:56px;box-sizing:border-box}
#k-rot-hint{position:fixed;z-index:941;max-width:min(280px,calc(100vw - 24px));padding:8px 12px;border-radius:12px;background:rgba(43,29,85,.94);color:#fff;border:2px solid #ffd23f;font:800 13px/1.35 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.35)}
#k-rot-hint[hidden]{display:none!important}
body:has(#modal-root .modal-backdrop) #k-rot-hint{z-index:40}
@media (orientation:landscape) and (max-height:500px){
  #k-rot.corner{width:40px;height:40px}
  body:has(.zg-tb #k-rot) .zg-hud,body:has(.sg-tb #k-rot) .sg-hud{right:278px}
}`;

function ensureCss() {
  if (document.getElementById('k-rot-css')) return;
  const s = document.createElement('style'); s.id = 'k-rot-css'; s.textContent = CSS; document.head.appendChild(s);
}

function sharedHint(t) {
  const park = document.getElementById('p3-hint');
  if (park && document.body.classList.contains('p3-on')) {
    park.textContent = t; park.classList.add('on'); clearTimeout(park._t); park._t = setTimeout(() => park.classList.remove('on'), 2200); return;
  }
  let el = document.getElementById('k-rot-hint');
  if (!el) { el = document.createElement('div'); el.id = 'k-rot-hint'; el.setAttribute('role', 'status'); el.hidden = true; document.body.appendChild(el); }
  const btn = document.getElementById('k-rot');
  if (btn) {
    const r = btn.getBoundingClientRect();
    el.style.top = Math.max(8, Math.min(window.innerHeight - 56, r.bottom + 8)) + 'px';
    el.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    el.style.left = 'auto';
  }
  el.hidden = false; el.textContent = t; clearTimeout(el._t); el._t = setTimeout(() => { el.hidden = true; }, 2200);
}

function placeHint() {
  const el = document.getElementById('k-rot-hint');
  const btn = document.getElementById('k-rot');
  if (!el || el.hidden || !btn) return;
  const r = btn.getBoundingClientRect();
  el.style.top = Math.max(8, Math.min(window.innerHeight - 56, r.bottom + 8)) + 'px';
  el.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  el.style.left = 'auto';
}

function ensureBtn() {
  let btn = document.getElementById('k-rot');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'k-rot'; btn.type = 'button'; btn.textContent = '🔄';
    btn.setAttribute('aria-label', 'Rotate. Tap for landscape');
    attachRotate(btn, sharedHint);
  }
  return btn;
}

function headerVisible() {
  const h = document.querySelector('.app-header');
  if (!h) return false;
  if (document.querySelector('.zg, .sg') || document.body.classList.contains('p3-on')) return false;
  const s = getComputedStyle(h);
  return s.display !== 'none' && s.visibility !== 'hidden';
}

function onGame() {
  if (document.body.classList.contains('kq-body')) return true;
  if (document.querySelector('.zg, .sg')) return true;
  return /^#\/(park|street|arcade|games|game)(\/|$|\?)/.test(location.hash || '');
}

const shortLand = () => matchMedia('(orientation: landscape) and (max-height: 500px)').matches;

function sync() {
  ensureCss();
  if (document.getElementById('p3-rot')) {
    const extra = document.getElementById('k-rot'); if (extra) extra.remove();
    const hint = document.getElementById('k-rot-hint'); if (hint) hint.hidden = true;
    document.body.classList.remove('k-rot-underhead');
    return;
  }
  if (!onGame()) {
    const extra = document.getElementById('k-rot'); if (extra) extra.remove();
    const hint = document.getElementById('k-rot-hint'); if (hint) hint.hidden = true;
    document.body.classList.remove('k-rot-underhead');
    releaseLock();
    return;
  }
  const btn = ensureBtn();
  const full = document.querySelector('.zg, .sg');
  const tools = document.querySelector('.gm-bar .g-tools, [data-k-rot]');
  const pg = document.querySelector('.pg-top');
  const kqBar = document.querySelector('.kq-bar');
  const tb = shortLand() ? document.querySelector('.zg-tb, .sg-tb') : null;
  if (tb) {
    btn.className = 'in-tb';
    if (tb.firstElementChild !== btn) tb.prepend(btn);
    document.body.classList.remove('k-rot-underhead');
    placeHint();
    return;
  }
  if (!full && tools) {
    btn.className = 'in-tools';
    const slot = tools.querySelector(':scope > .k-link-slot');
    if (slot) { if (slot.nextElementSibling !== btn) slot.after(btn); }
    else if (tools.firstElementChild !== btn) tools.prepend(btn);
    document.body.classList.remove('k-rot-underhead');
    placeHint();
    return;
  }
  if (!full && pg) {
    btn.className = 'in-tools';
    if (btn.parentElement !== pg) pg.append(btn);
    document.body.classList.remove('k-rot-underhead');
    placeHint();
    return;
  }
  if (!full && kqBar) {
    btn.className = 'in-tools';
    if (kqBar.lastElementChild !== btn) kqBar.append(btn);
    document.body.classList.remove('k-rot-underhead');
    placeHint();
    return;
  }
  btn.className = 'corner';
  if (btn.parentElement !== document.body) document.body.append(btn);
  document.body.classList.toggle('k-rot-underhead', headerVisible() && !full);
  placeHint();
}

let armed = false;
let observer = null;
let raf = 0;
function kick() {
  // Off a game screen the button is gone and the observer is disconnected, so feed
  // updates do not schedule rotate work.
  if (!onGame()) {
    if (observer) { observer.disconnect(); observer = null; }
    cancelAnimationFrame(raf);
    sync();
    return;
  }
  if (!observer && document.body) {
    observer = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(sync);
}
export function watchGameRotate() {
  if (!armed) {
    armed = true;
    window.addEventListener('hashchange', kick);
    window.addEventListener('resize', kick);
  }
  kick();
}
