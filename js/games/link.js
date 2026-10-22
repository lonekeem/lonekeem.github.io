// Shared connection pill and a small server-clock estimate.
// Games and Pal Park both use this so a slow network shows Good / OK / Poor
// or "Reconnecting…" instead of a frozen board.
const STYLE = `.k-link{display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:2px 8px;border-radius:999px;font:800 11px/1.2 Inter,system-ui,sans-serif;background:#2b1d55;color:#fff;border:2px solid #ffd34d;white-space:nowrap;flex-shrink:0}
.k-link i{width:9px;height:9px;border-radius:50%;background:#3ddc84;display:block;flex:none}
.k-link.ok i{background:#ffd34d}.k-link.poor i{background:#ff9f43}
.k-link.re{background:#ffd34d;color:#2b1d55}.k-link.re i{background:#8a2be2;animation:k-link-p 1s infinite}
@keyframes k-link-p{50%{opacity:.3}}
.gm-bar h1{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.p3-top .k-link{margin-left:6px}`;

let styled = false;
function ensureStyle() {
  if (styled || document.getElementById('k-link-css')) { styled = true; return; }
  const s = document.createElement('style'); s.id = 'k-link-css'; s.textContent = STYLE; document.head.appendChild(s); styled = true;
}

const LABEL = { good: 'Good', ok: 'OK', poor: 'Poor', re: 'Reconnecting…' };

export function createLink() {
  let off = 0, samples = 0, rtt = 0, lastSnap = Date.now(), down = false, el = null, writeAt = 0;
  const paint = () => {
    if (!el || !el.isConnected) return;
    const g = grade();
    el.className = 'k-link' + (g === 'good' ? '' : ' ' + g);
    el.dataset.s = g;
    const t = LABEL[g];
    if (el.dataset.t !== t) { el.dataset.t = t; el.innerHTML = `<i></i><span>${t}</span>`; }
    el.title = rtt ? `Connection ${t}, about ${Math.round(rtt)} ms` : `Connection ${t}`;
    el.setAttribute('aria-label', el.title);
  };
  function grade() {
    if (down || (typeof navigator !== 'undefined' && navigator.onLine === false)) return 're';
    // Heartbeats land about every 20s, so a quiet board is not a dead connection.
    if (samples && Date.now() - lastSnap > 28000) return 're';
    if (!rtt) return 'ok';
    if (rtt < 180) return 'good';
    if (rtt < 450) return 'ok';
    return 'poor';
  }
  function noteServer(ms) {
    if (!ms) return;
    const d = ms - Date.now();
    off = samples ? off * 0.8 + d * 0.2 : d;
    samples++;
    lastSnap = Date.now();
    if (down) down = false;
    paint();
  }
  function noteRtt(ms) {
    if (!(ms > 0) || ms > 8000) return;
    rtt = rtt ? rtt * 0.65 + ms * 0.35 : ms;
    lastSnap = Date.now();
    down = false;
    paint();
  }
  function markWrite() { writeAt = performance.now(); }
  function noteSnap(pending) {
    if (pending) return;
    if (writeAt) { noteRtt(performance.now() - writeAt); writeAt = 0; }
    lastSnap = Date.now();
    if (down) down = false;
    paint();
  }
  function fail() { down = true; paint(); }
  function setDown(v) { down = !!v; if (!v) lastSnap = Date.now(); paint(); }
  function serverNow() { return Date.now() + off; }
  function mount(parent) {
    ensureStyle();
    if (!parent) return;
    parent.innerHTML = '';
    el = document.createElement('span');
    el.className = 'k-link ok';
    el.setAttribute('role', 'status');
    parent.appendChild(el);
    paint();
  }
  const onOff = () => { down = true; paint(); };
  const onOn = () => { down = false; lastSnap = Date.now(); paint(); };
  addEventListener('offline', onOff);
  addEventListener('online', onOn);
  const iv = setInterval(paint, 2000);
  return {
    noteServer, noteRtt, markWrite, noteSnap, fail, setDown, serverNow, grade, mount,
    stop() { clearInterval(iv); removeEventListener('offline', onOff); removeEventListener('online', onOn); }
  };
}

// A snapshot older than a move we already showed locally is ignored until the server catches up.
export function reconcile(serverMove, pending) {
  const n = serverMove || 0;
  if (pending == null) return { take: true, pending: null };
  if (n < pending) return { take: false, pending };
  return { take: true, pending: null };
}

export function turnLeftMs(now, turnAtMs, totalMs) {
  if (!turnAtMs) return totalMs;
  return Math.max(0, totalMs - (now - turnAtMs));
}
