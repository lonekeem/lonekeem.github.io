// Kemy keyboard lift: while typing in any game chat/input (Pal Park, zombie, Challenge Show, lobbies), pins the input's
// bar just above the on-screen keyboard using window.visualViewport, so the typed text stays visible (iOS Safari shrinks
// the visual viewport but leaves fixed/absolute game layers under the keyboard). Shared by every game via js/no-zoom.js.
const GAME_SEL = '.zg, .p3-view, .kc, .rl, .rlgl, [data-kemy-game], [data-nozoom]';
const TEXT = /^(INPUT|TEXTAREA)$/;
const NOTEXT = /^(range|checkbox|radio|color|file|button|submit)$/i;
export function installKbLift() {
  if (window.__kemyKbLift) return window.__kemyKbLift;
  const d = document, vv = window.visualViewport;
  const st = d.createElement('style'); st.id = 'kemy-kblift-css';
  st.textContent = `.kb-lift{position:fixed!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;bottom:auto!important;transform:none!important;width:auto!important;max-width:none!important;min-width:0!important;margin:0!important;z-index:2147482000!important;display:flex!important;gap:6px;align-items:center;padding:6px!important;border-radius:16px!important;background:rgba(18,8,40,.94)!important;box-shadow:0 -4px 18px rgba(0,0,0,.35)!important}
.kb-lift input,.kb-lift textarea,input.kb-lift{flex:1;min-width:0;font-size:max(16px,1em)!important;color:#fff!important;-webkit-text-fill-color:#fff!important;caret-color:#fff;background:rgba(255,255,255,.12)!important;border:1px solid rgba(255,255,255,.45)!important}
.kb-lift input::placeholder{color:rgba(255,255,255,.75)!important}
.kb-lift .kb-send{flex:0 0 auto;min-width:44px;height:40px;border-radius:999px;border:0;background:#7c3aed;color:#fff;font:700 15px Inter,system-ui,sans-serif;padding:0 14px}`;
  d.head.appendChild(st);
  let cur = null, bar = null, added = null, raf = 0;
  const place = () => { raf = 0; if (!bar) return; const h = bar.offsetHeight || 52; const top = vv ? vv.offsetTop + vv.height : innerHeight; bar.style.setProperty('top', Math.max(4, top - h - 6) + 'px', 'important'); };
  const sched = () => { if (!raf) raf = requestAnimationFrame(place); };
  const on = (el) => { const host = el.closest(GAME_SEL); if (!host) return; cur = el; bar = el.closest('form') || el; bar.classList.add('kb-lift');
    if (bar.tagName === 'FORM' && !bar.querySelector('button:not([type=button]),[type=submit]')) { added = d.createElement('button'); added.type = 'submit'; added.className = 'kb-send'; added.textContent = 'Send'; bar.appendChild(added); }
    place(); setTimeout(place, 120); setTimeout(place, 400); };
  const off = () => { if (bar) { bar.classList.remove('kb-lift'); bar.style.removeProperty('top'); } added?.remove(); cur = bar = added = null; };
  d.addEventListener('focusin', (e) => { const t = e.target; if (t && TEXT.test(t.tagName) && !NOTEXT.test(t.type || '') && !t.readOnly) { if (cur !== t) off(); on(t); } }, true);
  d.addEventListener('focusout', (e) => { if (e.target === cur) setTimeout(() => { if (d.activeElement !== cur) off(); }, 60); }, true);
  if (vv) { vv.addEventListener('resize', sched); vv.addEventListener('scroll', sched); }
  addEventListener('resize', sched); addEventListener('orientationchange', () => setTimeout(place, 300));
  return (window.__kemyKbLift = { typing: () => !!cur, place });
}
if (typeof document !== 'undefined') { if (document.head) installKbLift(); else document.addEventListener('DOMContentLoaded', () => installKbLift(), { once: true }); }
