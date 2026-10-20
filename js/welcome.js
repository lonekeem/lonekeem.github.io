// Kemy welcome video: shows once on first open (localStorage flag), replay via any [data-watch-intro] button.
// Injected by JS only (never in the HTML), so crawlers see the normal landing page. Video is lazy-loaded, never precached.
(() => {
  const KEY = 'kemy-welcome-seen-v1';
  const PARTS = [
    { src: 'assets/video/kemy-welcome.mp4', poster: 'assets/video/kemy-welcome.jpg', title: 'Welcome to Kemy!' },
    { src: 'assets/video/kemy-info.mp4', poster: 'assets/video/kemy-info.jpg', title: 'How to save Kemy' }
  ];
  const BOT = /bot|crawl|spider|slurp|lighthouse|facebookexternalhit|embedly|preview/i.test(navigator.userAgent);
  let open = null;
  const css = `
#kw-ov{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(120% 90% at 50% 0%,rgba(124,58,237,.55),rgba(17,6,38,.88));backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:kwIn .25s ease}
@keyframes kwIn{from{opacity:0}to{opacity:1}}
#kw-ov .kw-card{position:relative;width:min(400px,100%);max-height:100%;display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:26px;background:linear-gradient(160deg,rgba(168,85,247,.32),rgba(76,29,149,.38));border:1px solid rgba(255,255,255,.22);box-shadow:0 20px 60px rgba(76,29,149,.55),inset 0 1px 0 rgba(255,255,255,.25);color:#fff;font-family:Inter,system-ui,sans-serif}
#kw-ov .kw-head{display:flex;align-items:center;gap:8px;padding:2px 4px}
#kw-ov .kw-head b{font-family:'Space Grotesk',Inter,sans-serif;font-size:1.05rem;flex:1}
#kw-ov .kw-vid{position:relative;border-radius:18px;overflow:hidden;background:#12052a;aspect-ratio:9/16;max-height:calc(100dvh - 150px);margin:0 auto;width:100%}
#kw-ov video{width:100%;height:100%;object-fit:contain;display:block}
#kw-ov button{font:600 .92rem Inter,system-ui,sans-serif;color:#fff;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.14);border-radius:999px;padding:9px 16px;cursor:pointer;backdrop-filter:blur(6px)}
#kw-ov button:hover{background:rgba(255,255,255,.24)}
#kw-ov .kw-row{display:flex;gap:8px;justify-content:space-between;align-items:center}
#kw-ov .kw-skip{background:linear-gradient(135deg,#a855f7,#7c3aed);border-color:transparent}
#kw-ov .kw-tap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:1.15rem;padding:16px 26px;background:linear-gradient(135deg,#c084fc,#7c3aed);box-shadow:0 10px 30px rgba(124,58,237,.6);border:2px solid rgba(255,255,255,.5)}
#kw-ov .kw-part{font-size:.78rem;opacity:.85;font-weight:600;white-space:nowrap}
#kw-ov .kw-btns{display:flex;gap:8px}
#kw-ov .kw-credit{font-size:.75rem;opacity:.75;text-align:center;margin:0}`;
  function close() {
    if (!open) return;
    try { open.v.pause(); open.v.removeAttribute('src'); open.v.load(); } catch (e) {}
    open.el.remove(); document.removeEventListener('keydown', open.key); open = null;
  }
  // show(0) = full 2-part intro; show(1, true) = only the "How to save Kemy" video.
  function show(start, only) {
    if (open) return;
    let i = typeof start === 'number' ? start : 0; const multi = !only;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    if (!document.getElementById('kw-css')) { const s = document.createElement('style'); s.id = 'kw-css'; s.textContent = css; document.head.appendChild(s); }
    const el = document.createElement('div');
    el.id = 'kw-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Kemy intro');
    el.innerHTML = `<div class="kw-card"><div class="kw-head"><span aria-hidden="true">🦎</span><b class="kw-title"></b><span class="kw-part"></span></div>
<div class="kw-vid"><video playsinline preload="auto"></video><button type="button" class="kw-tap" hidden>🔊 Tap for sound</button></div>
<div class="kw-row"><button type="button" class="kw-mute">🔊 Mute</button><div class="kw-btns"><button type="button" class="kw-next">Next ▶</button><button type="button" class="kw-skip">Skip intro</button></div></div>
<p class="kw-credit">Written by Lone Keem</p></div>`;
    document.body.appendChild(el);
    const v = el.querySelector('video'), tap = el.querySelector('.kw-tap'), mute = el.querySelector('.kw-mute'), next = el.querySelector('.kw-next'), skip = el.querySelector('.kw-skip');
    const sync = () => { mute.textContent = v.muted ? '🔇 Unmute' : '🔊 Mute'; tap.hidden = !v.muted; };
    const key = (e) => { if (e.key === 'Escape') close(); };
    open = { el, v, key };
    document.addEventListener('keydown', key);
    const play = () => v.play().catch(() => { v.muted = true; sync(); v.play().catch(() => { tap.hidden = false; }); });
    const load = () => {
      const p = PARTS[i];
      el.querySelector('.kw-title').textContent = p.title;
      el.querySelector('.kw-part').textContent = multi ? `Part ${i + 1} of ${PARTS.length}` : '';
      const last = !multi || i >= PARTS.length - 1;
      next.hidden = last; skip.textContent = last ? 'Close ✕' : 'Skip intro';
      v.poster = p.poster; v.src = p.src; play(); sync();
    };
    const advance = () => { if (multi && i < PARTS.length - 1) { i++; load(); } else close(); };
    v.addEventListener('ended', advance);
    v.addEventListener('volumechange', sync);
    next.onclick = () => { v.muted = false; advance(); };
    skip.onclick = close;
    mute.onclick = () => { v.muted = !v.muted; if (v.paused) v.play().catch(() => {}); sync(); };
    tap.onclick = () => { v.muted = false; v.play().catch(() => {}); sync(); };
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    load();
    skip.focus({ preventScroll: true });
  }
  window.kemyWelcome = show;
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-watch-intro]'); if (b) { e.preventDefault(); show(0); return; }
    const h = e.target.closest && e.target.closest('[data-watch-howto]'); if (h) { e.preventDefault(); show(1, true); } });
  let seen = true; try { seen = !!localStorage.getItem(KEY); } catch (e) {}
  if (!seen && !BOT) {
    const go = () => setTimeout(() => show(0), 600);
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }
})();
