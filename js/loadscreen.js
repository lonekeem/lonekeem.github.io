// Kemy game loading screen: "Welcome to <Game>" · "Kemy by Lone Keem Studios", logo glow + shimmer.
// show(name) when a game starts loading, hide() when it's ready (min 0.6 s on screen, auto-hides after 10 s).
// Written by Lone Keem
const MIN = 600, MAX = 10000;
let el = null, shownAt = 0, maxT = 0, hideT = 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function css() {
  if (document.getElementById('kls-css')) return;
  const st = document.createElement('style'); st.id = 'kls-css';
  st.textContent = `#kemy-load{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:radial-gradient(circle at 50% 40%,#2a0d4a 0,#0b0612 62%,#000 100%);color:#fff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;transition:opacity .3s ease}
#kemy-load.out{opacity:0;pointer-events:none}
#kemy-load img{width:96px;height:96px;border-radius:22px;animation:klsPulse 1.6s ease-in-out infinite}
#kemy-load h1{margin:8px 16px 0;font-size:1.6rem;font-weight:800;background:linear-gradient(90deg,#fff,#e3c8ff,#fff);-webkit-background-clip:text;background-clip:text;color:transparent}
#kemy-load p{margin:0;font-size:.92rem;color:#c9a8f5}
#kemy-load .kls-bar{width:160px;height:4px;margin-top:16px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
#kemy-load .kls-bar i{display:block;height:100%;width:40%;background:linear-gradient(90deg,transparent,#a855f7,#e879f9,transparent);animation:klsShim 1.1s linear infinite}
@keyframes klsPulse{0%,100%{transform:scale(1);box-shadow:0 0 24px rgba(138,43,226,.45)}50%{transform:scale(1.05);box-shadow:0 0 48px rgba(168,85,247,.85)}}
@keyframes klsShim{from{transform:translateX(-110%)}to{transform:translateX(290%)}}
@media (prefers-reduced-motion:reduce){#kemy-load img,#kemy-load .kls-bar i{animation:none}}`;
  document.head.appendChild(st);
}
export function show(name = 'Kemy') {
  css(); clearTimeout(hideT); clearTimeout(maxT);
  if (!el) { el = document.createElement('div'); el.id = 'kemy-load'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.classList.remove('out');
  el.setAttribute('aria-label', `Loading ${name}`);
  el.innerHTML = `<img src="icon-192.png" alt="" width="96" height="96"><h1>Welcome to ${esc(name)}</h1><p>Kemy by Lone Keem Studios</p><div class="kls-bar"><i></i></div>`;
  shownAt = Date.now(); maxT = setTimeout(hide, MAX);
}
export function hide() {
  if (!el) return; clearTimeout(maxT); const e = el;
  hideT = setTimeout(() => { e.classList.add('out'); setTimeout(() => { if (e === el && e.classList.contains('out')) { e.remove(); el = null; } }, 350); }, Math.max(0, MIN - (Date.now() - shownAt)));
}
// Games can also call these directly when they finish loading heavy assets.
window.kemyLoadScreen = { show, hide };
