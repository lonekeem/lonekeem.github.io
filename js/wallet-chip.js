// Shared live wallet chip: '⭐ 1,240 · 💎 35'. One onSnapshot per balance doc for the whole app
// (users/{uid}/pal/wallet → coins, users/{uid}/pal/diamonds → d). Every chip on screen reads from this.
// Admin or ∞ Pass holder (js/inf-pass.js) shows ∞. Logged out: no chip.
import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { auth, db } from './firebase-init.js';
import { isAdminUser, watchPass } from './inf-pass.js';
import { chipWhere, planBadges } from './wallet-badge.js';
const st = { uid: null, admin: false, c: null, d: null }; const chips = new Set(); let unsub = [];
const fmt = (n) => (st.admin ? '∞' : n == null ? '…' : n > 9999 ? (n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K') : Number(n).toLocaleString());
const CSS = `.wchip{position:relative;display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(255,211,77,.5);background:rgba(20,10,40,.78);color:#fff;border-radius:999px;padding:4px 9px;font:700 13px/1.1 Inter,system-ui,sans-serif;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent}
.wchip .wc-s{color:#ffd34d}.wchip .wc-d{color:#9fe8ff}.wchip .wc-x{opacity:.55}
.wchip.sm{font-size:12px;padding:3px 7px}
.wc-pop{position:absolute;left:50%;top:-4px;transform:translateX(-50%);font:800 13px Inter,system-ui,sans-serif;pointer-events:none;animation:wcp 1.1s ease-out forwards;text-shadow:0 1px 3px #000}
.wc-pop.up{color:#7dffa1}.wc-pop.dn{color:#ff8a8a}
@keyframes wcp{0%{opacity:0;transform:translate(-50%,4px)}15%{opacity:1}100%{opacity:0;transform:translate(-50%,-22px)}}
/* Floating chip only when the app header is hidden. Top-left, clear of the top-right music button and the bottom music bar. */
#wallet-fab{position:fixed;z-index:94;top:calc(env(safe-area-inset-top) + 8px);left:calc(env(safe-area-inset-left) + 8px);right:auto;transform:none;max-width:min(168px,calc(100vw - 88px));overflow:hidden}
body.wc-video .wchip:not(.bs-ov .wchip),body.feed-mode #wallet-fab,body.live-mode #wallet-fab{display:none!important}
body.p3-on:has(#wallet-fab) .p3-top{padding-left:calc(max(8px, env(safe-area-inset-left)) + 136px)}
body.pool-mode:has(#wallet-fab) .gm-bar{padding-left:136px}
.app-header .inner{min-width:0}
.header-actions{min-width:0;flex:1 1 auto;justify-content:flex-end;flex-wrap:nowrap}
.header-actions>*{flex:none}
.header-actions .wchip{position:relative;left:auto;top:auto;transform:none;flex:none;max-width:none;overflow:visible}
@media (max-width:430px){
  .app-header .inner{gap:2px;padding-left:6px;padding-right:4px}
  .app-header .brand img{width:28px;height:28px}
  .header-actions{gap:1px}
  .header-actions .icon-btn{padding:4px}
  .header-actions .icon-btn svg{width:20px;height:20px}
  .header-actions .mod-pill{padding:0 4px}
  .header-actions .avatar.sm{width:28px;height:28px;font-size:.7rem}
}
.bs-ov .wchip{position:fixed;top:calc(env(safe-area-inset-top) + 10px);left:50%;transform:translateX(-50%);z-index:9001}
@media (max-width:400px){.header-actions .wchip{font-size:12px;padding:3px 7px;gap:3px}.header-actions .don-pill{font-size:0;padding:5px 8px}.header-actions .don-pill::before{content:'💜';font-size:.85rem}.header-actions{gap:4px}}
@media (prefers-reduced-motion:reduce){.wc-pop{animation-duration:.01s}}`;
function css() { if (document.getElementById('wchip-css')) return; const s = document.createElement('style'); s.id = 'wchip-css'; s.textContent = CSS; document.head.appendChild(s); }
function paint(el) { el.hidden = !st.uid; el.innerHTML = `<span class="wc-s">⭐ ${fmt(st.c)}</span><span class="wc-x">·</span><span class="wc-d">💎 ${fmt(st.d)}</span>`;
  el.setAttribute('aria-label', st.admin ? 'Wallet: unlimited Star Coins and Diamonds' : `Wallet: ${st.c ?? 0} Star Coins, ${st.d ?? 0} Diamonds. Open shop`); }
function pop(diff, cur) { if (!diff || st.admin) return; for (const el of chips) { if (!el.isConnected || el.hidden) continue; const p = document.createElement('span');
  p.className = 'wc-pop ' + (diff > 0 ? 'up' : 'dn'); p.textContent = (diff > 0 ? '+' : '−') + cur + Math.abs(diff).toLocaleString(); el.appendChild(p); setTimeout(() => p.remove(), 1200); } }
function render() { for (const el of [...chips]) { if (!el.isConnected) { chips.delete(el); continue; } paint(el); } }
function set(k, v, cur) { const old = st[k]; st[k] = v; render(); if (old != null && v != null) pop(v - old, cur); }
onAuthStateChanged(auth, (u) => {
  unsub.forEach((f) => f()); unsub = []; st.uid = u ? u.uid : null; st.c = st.d = null; st.admin = isAdminUser(u); render(); syncBadges();
  if (!u) return;
  if (!st.admin) unsub.push(watchPass(u.uid, (on) => { st.admin = on; render(); }));
  unsub.push(onSnapshot(doc(db, 'users', u.uid, 'pal', 'wallet'), (s) => set('c', s.exists() ? Number(s.data().coins) || 0 : 0, '⭐'), () => {}));
  unsub.push(onSnapshot(doc(db, 'users', u.uid, 'pal', 'diamonds'), (s) => set('d', s.exists() ? Number(s.data().d) || 0 : 0, '💎'), () => {}));
});
const SHOP = '#/pals/store';
export function walletChip(o = {}) { css(); const el = document.createElement('button'); el.type = 'button'; el.className = 'wchip' + (o.small ? ' sm' : '');
  el.onclick = (e) => { e.stopPropagation(); if (o.onTap) o.onTap(); if (o.href) { location.hash = o.href; return; } import('./coinshop.js').then((m) => m.openCoinShop('get')).catch(() => { location.hash = /^#\/(park|street)|zombie|armory/.test(location.hash) ? '#/pals/shop' : SHOP; }); };
  chips.add(el); paint(el); return el; }
let gameOn = false, watching = false;
function headerOpen() {
  const h = document.querySelector('.app-header');
  if (!h || typeof getComputedStyle !== 'function') return true;
  return getComputedStyle(h).display !== 'none';
}
function placeChip(where) {
  if (where === 'fab') {
    if (document.getElementById('wallet-fab')) return;
    const f = walletChip({ small: true }); f.id = 'wallet-fab'; document.body.appendChild(f); return;
  }
  const ha = document.getElementById('header-actions');
  if (!ha || ha.querySelector('.wchip')) return;
  const el = walletChip(); const pill = ha.querySelector('.don-pill');
  if (pill) pill.after(el); else ha.prepend(el);
}
function syncBadges() {
  watchHeader(); css();
  const plan = planBadges({ game: gameOn, headerOpen: headerOpen(), loggedIn: !!st.uid, chips: [...chips].map((el) => ({ el, where: chipWhere(el), id: el.id })) });
  for (const item of plan.remove) { item.el.remove(); chips.delete(item.el); }
  for (const where of plan.create) placeChip(where);
}
function watchHeader() {
  if (watching || typeof MutationObserver !== 'function' || !document.body) return;
  watching = true;
  const mo = new MutationObserver(() => syncBadges());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
export function mountHeaderChip() { syncBadges(); }
// One chip in the top bar, or one floating chip when a game hides that bar. Removed on the way out.
export function gameChip(on) {
  gameOn = !!on;
  document.body.classList.toggle('wc-video', /^#\/(watch|post|live|feed)(\/|\?|$)/.test(location.hash) || /^#?\/?$/.test(location.hash));
  syncBadges();
}
export const walletState = () => ({ ...st });
window.kemyWallet = { walletChip, gameChip, walletState };
