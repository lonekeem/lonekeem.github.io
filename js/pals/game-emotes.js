// Emote wheel + tiny 3D Pal avatar cards for games that don't show Pals (board/card games, arcade, Pal Games, Bubble
// Quest, lobbies). A card pops up (top-right, pointer-events off so it never blocks the board), plays the emote, then
// goes away; its render loop only runs while a card is on screen and the tab is visible. Online games sync a compact
// code (100 + emote index, see emotes.js EMOTE_IDX) through their own existing realtime channel; never game logic.
import { openWheel, loadOwnedEmotes } from './emote-wheel.js';
import { EMOTE_IDX, EMOTE_BY_ID, emoteMs } from './emotes.js';
import { drawDancer, danceById } from './dance.js';
import { getActivePal } from './core.js';

export const EMO_BASE = 100;
export const emoCode = (id) => { const i = EMOTE_IDX.indexOf(id); return i < 0 ? -1 : EMO_BASE + i; };
export const emoOf = (code) => (code >= EMO_BASE ? EMOTE_IDX[code - EMO_BASE] || '' : '');
const CSS = `.ge-cards{position:fixed;top:calc(64px + env(safe-area-inset-top));right:8px;z-index:60;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.ge-card{width:96px;border-radius:16px;background:rgba(27,18,51,.86);box-shadow:0 4px 16px rgba(0,0,0,.35);text-align:center;color:#fff;font:700 11px Inter,system-ui,sans-serif;padding:2px 2px 5px;animation:geIn .2s ease-out}
.ge-card small{display:block;color:#ffd34d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ge-card b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes geIn{from{transform:translateX(30px);opacity:0}}
.ge-btn{position:fixed;left:10px;bottom:calc(148px + env(safe-area-inset-bottom));z-index:60;width:50px;height:50px;border-radius:50%;border:0;background:rgba(43,29,85,.9);color:#fff;font-size:26px;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer}
.g-emotes .ge-in{font-size:18px}`;
function css() { if (document.getElementById('ge-css')) return; const s = document.createElement('style'); s.id = 'ge-css'; s.textContent = CSS; document.head.appendChild(s); }
const palCache = new Map();
async function palFor(db, uid) { if (!uid || /^cpu\d$/.test(uid)) return null; if (!palCache.has(uid)) palCache.set(uid, getActivePal(db, uid).catch(() => null)); return palCache.get(uid); }

/**
 * mountGameEmotes(host, { db, uid, send?: async (code) => {}, button?: HTMLElement, onShop?: () => {} })
 * host: the game's root element (everything is torn down when it leaves the page).
 * Returns { recv(uid, code, name), play(uid, id, name), destroy }.
 */
let CUR = null; // one live instance at a time; the send rate limit is shared (max 1 synced emote / 3 s)
export function mountGameEmotes(host, o) {
  css(); const { db, uid } = o; if (CUR) CUR.destroy();
  document.querySelectorAll('.ge-cards').forEach((e) => e.remove());
  const box = document.createElement('div'); box.className = 'ge-cards'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box);
  let btn = o.button; const own = !btn;
  if (!btn) { document.querySelectorAll('.ge-btn').forEach((e) => e.remove()); btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ge-btn'; btn.textContent = '😊'; btn.setAttribute('aria-label', 'Emote wheel'); document.body.appendChild(btn); }
  if (o.z) { box.style.zIndex = o.z; btn.style.zIndex = o.z; } // pages with their own high stacking (Bubble Quest)
  const cards = new Map(); let raf = 0, t = 0, dead = false;
  const route = () => (location.hash || '').split('?')[0]; const r0 = route(); // lives as long as the page/route does (games re-render their DOM)
  const alive = () => !dead && (o.alive ? o.alive() : route() === r0);
  function destroy() { if (CUR && CUR.destroy === destroy) CUR = null; dead = true; cancelAnimationFrame(raf); box.remove(); if (own) btn.remove(); removeEventListener('hashchange', chk); }
  const chk = () => setTimeout(() => { if (!alive()) destroy(); }, 50); addEventListener('hashchange', chk);
  function frame() { raf = 0; if (!alive()) { destroy(); return; } if (document.hidden) { raf = requestAnimationFrame(frame); return; } t++; const now = performance.now();
    for (const [k, c] of cards) { c.left -= Math.min(100, now - (c.lastN || now)); c.lastN = now; // play time counts real frames (a slow first 3D load doesn't eat it)
      if (c.left <= 0) { c.el.remove(); cards.delete(k); continue; } c.ctx.clearRect(0, 0, 92, 92); drawDancer(c.ctx, 46, 88, 66, c.pal, { t, dance: c.d, beat: now / 1000 * 116 / 60 }); }
    if (cards.size) raf = requestAnimationFrame(frame); }
  async function play(who, id, name) { if (!alive()) return; const d = danceById(id); if (!d) return; const pal = await palFor(db, who); if (!pal || !alive()) return;
    let c = cards.get(who); if (!c) { const el = document.createElement('div'); el.className = 'ge-card'; const cv = document.createElement('canvas'); const dpr = Math.min(2, devicePixelRatio || 1); cv.width = 92 * dpr; cv.height = 92 * dpr; cv.style.width = cv.style.height = '92px'; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); el.append(cv, Object.assign(document.createElement('b'), {}), Object.assign(document.createElement('small'), {})); box.appendChild(el); c = { el, ctx }; cards.set(who, c); }
    c.pal = pal; c.d = d; c.left = Math.min(6000, emoteMs(id)); c.lastN = 0; c.el.querySelector('b').textContent = name || 'Pal'; c.el.querySelector('small').textContent = `${d.icon || '💃'} ${d.name}`;
    if (!raf) raf = requestAnimationFrame(frame); }
  btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); if (!uid) { o.requireAuth && o.requireAuth(); return; }
    loadOwnedEmotes(db, uid).then(() => openWheel({ onEmote: async (id) => { const P = dead && CUR ? CUR.play : play; if (Date.now() - (window.__kemyEmoLast || 0) < 3000) { P(uid, id, 'You'); return; } window.__kemyEmoLast = Date.now(); P(uid, id, 'You'); const code = emoCode(id); if (o.send && code >= 0) { try { await o.send(code); } catch { /* best effort */ } } },
      onShop: o.onShop || (() => dispatchEvent(new Event('kemy:dance-shop'))), onLocked: (d) => { (o.toast || (() => {}))(`🔒 ${d.name} is in the Dance Shop`); dispatchEvent(new Event('kemy:dance-shop')); } })); };
  CUR = { destroy, play };
  return { recv: (who, code, name) => { const id = emoOf(code); if (id && who !== uid) play(who, id, name); }, play, destroy, button: btn };
}
export { EMOTE_BY_ID };
