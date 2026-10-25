// Radial emote wheel (8 favourite slots the player picks) + tabbed quick-chat phrases. Shared by Pal Park,
// Pal Zombie Survival and the Care stage. Pure DOM; the caller decides what an emote / phrase does (sync etc.).
import { EMOTE_DANCES, allDances, ownsDance, setOwned, loadTrends } from './dance.js';
import { collection, getDocs } from '../fsq.js';
// load which dances/emotes the player owns (inv dn_* and premium z_dn_*); cheap, cached per session
let ownedP = null;
export function loadOwnedEmotes(db, uid, force) { if (!uid || !db) return Promise.resolve(); if (!ownedP || force) ownedP = Promise.resolve().then(() => Promise.all([loadTrends(), getDocs(collection(db, 'users', uid, 'inv'))])).then(([, s]) => { setOwned(s.docs.filter((d) => (d.id.startsWith('dn_') || d.id.startsWith('z_dn_')) && (d.data().n || 0) > 0).map((d) => d.id)); }).catch(() => {}); return ownedP; }

export const QUICK_TABS = [
  { id: 'hi', icon: '👋', name: 'Hi', list: ['Hi! 👋', 'Hello friend!', 'Hey there!', 'Good morning! ☀️', 'Good night! 🌙', 'Welcome!', 'Bye! 👋', 'See you soon!'] },
  { id: 'team', icon: '🤝', name: 'Team', list: ['Follow me!', 'Help!', 'Revive me!', 'Behind you!', 'Watch out!', 'On my way!', 'Wait for me!', 'Over here!', 'Let’s go!', 'Stick together!', 'I got this!', 'Cover me!', 'Reloading!', 'Boss incoming!', 'Thanks for the save!', 'Need Diamonds!'] },
  { id: 'gg', icon: '🏆', name: 'GG', list: ['GG!', 'Good game!', 'Nice shot!', 'Well played!', 'Nice one!', 'So close!', 'Rematch?', 'Good luck!', 'Great teamwork!', 'We did it! 🎉'] },
  { id: 'nice', icon: '💜', name: 'Nice', list: ['Love your outfit!', 'Nice Pal!', 'So cute!', 'Cool dance!', 'Your Pal is adorable!', 'Great style!', 'You’re awesome!', 'You’re so fun!', 'Best friends! 💜', 'Thank you!'] },
  { id: 'park', icon: '🌳', name: 'Park', list: ['Wanna play?', 'Let’s race!', 'Let’s dance! 💃', 'Dance party! 🎉', 'Found a treasure!', 'Come to the fountain!', 'Join my game?', 'Follow the leader!', 'Hide and seek?', 'Let’s explore!', 'Photo time! 📸', 'Brb!'] },
  { id: 'emoji', icon: '😀', name: 'Emoji', list: ['😂', '😍', '😮', '🥳', '👍', '💜', '🔥', '⭐', '😎', '🤩', '🙌', '😴', '🤔', '😅', '👏', '🌈'] },
];
export const ALL_PHRASES = QUICK_TABS.flatMap((t) => t.list);

const FK = 'kemy-emote-favs';
const DEF = ['hiwave', 'cheer', 'giggle', 'thumbsyes', 'clapclap', 'sparkstep', 'moonbounce', 'shrug'];
export function getFavs() { let f = null; try { f = JSON.parse(localStorage.getItem(FK) || 'null'); } catch { /* */ } f = Array.isArray(f) ? f.slice(0, 8) : DEF.slice(); while (f.length < 8) f.push(DEF[f.length]); return f; }
export function setFavs(f) { try { localStorage.setItem(FK, JSON.stringify(f.slice(0, 8))); } catch { /* */ } }
const byId = (id) => allDances().find((d) => d.id === id);
const ownedEmotes = () => [...EMOTE_DANCES, ...allDances().filter((d) => !d.emote)].filter(ownsDance);

const CSS = `.ew-btn{position:absolute;z-index:40;width:56px;height:56px;border-radius:50%;border:0;background:rgba(43,29,85,.88);color:#fff;font-size:28px;box-shadow:0 4px 14px rgba(0,0,0,.35);touch-action:manipulation;cursor:pointer}
.ew-ov{position:fixed;inset:0;z-index:9500;background:rgba(10,4,26,.55);display:flex;align-items:center;justify-content:center;flex-direction:column;animation:ewf .15s;font-family:Inter,system-ui,sans-serif;touch-action:none}
@keyframes ewf{from{opacity:0}}.ew-ring{position:relative;width:min(300px,84vw);height:min(300px,84vw);border-radius:50%;background:radial-gradient(circle,rgba(60,40,120,.92) 30%,rgba(43,29,85,.92) 31%);box-shadow:0 0 0 3px rgba(255,211,77,.35)}
.ew-s{position:absolute;width:72px;height:72px;margin:-36px 0 0 -36px;border-radius:50%;border:2px solid rgba(255,255,255,.15);background:#3d2a7a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:28px;line-height:1;cursor:pointer;padding:0}
.ew-s small{font-size:9.5px;font-weight:700;max-width:66px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px}.ew-s.prem{border-color:#ffd34d}.ew-s.pick{outline:3px solid #ffd34d}
.ew-c{position:absolute;left:50%;top:50%;width:78px;height:78px;margin:-39px 0 0 -39px;border-radius:50%;border:0;background:#1b1233;color:#fff;font-weight:800;font-size:14px}
.ew-bar{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center;max-width:94vw}.ew-bar button{min-height:44px;border:0;border-radius:14px;background:#3d2a7a;color:#fff;font-weight:700;padding:0 14px;font-size:15px}
.ew-emo button{font-size:22px;padding:0 10px;min-width:44px}
.ew-grid{background:#1b1233;color:#fff;border-radius:18px;padding:12px;max-width:94vw;width:420px;max-height:46vh;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:6px;margin-top:10px}
.ew-grid button{min-height:58px;border:0;border-radius:12px;background:#3d2a7a;color:#fff;font-size:22px;display:flex;flex-direction:column;align-items:center;justify-content:center}.ew-grid small{font-size:10px;font-weight:700}
.ew-hint{color:#fff;font-weight:700;margin:0 0 10px;text-align:center;text-shadow:0 1px 3px #000}
.qc{display:flex;flex-direction:column;gap:6px}.qc-tabs{display:flex;gap:4px;overflow-x:auto}.qc-tabs button{flex:0 0 auto;min-height:38px;border:0;border-radius:12px;background:#ece4ff;color:#2b1d55;font-weight:700;padding:0 10px}.qc-tabs button[aria-selected=true]{background:#8a55dc;color:#fff}
.qc-list{display:flex;flex-wrap:wrap;gap:6px;max-height:34vh;overflow:auto}.qc-list button{min-height:40px;border:0;border-radius:999px;background:#fff;color:#2b1d55;font-weight:700;padding:0 12px;font-size:14px}.qc-list.emo button{font-size:22px;min-width:46px}`;
function css() { if (document.getElementById('ew-css')) return; const s = document.createElement('style'); s.id = 'ew-css'; s.textContent = CSS; document.head.appendChild(s); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// openWheel({ onEmote(id), reactions?: ['👋',…], onReact?(x), onShop?() }) -> closes itself after a pick
export function openWheel(o = {}) {
  css(); document.querySelectorAll('.ew-ov').forEach((e) => e.remove());
  const ov = document.createElement('div'); ov.className = 'ew-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Emote wheel');
  let favs = getFavs(), edit = -1; document.body.appendChild(ov);
  const close = () => { ov.remove(); o.onClose && o.onClose(); };
  function render() {
    const R = Math.min(300, innerWidth * 0.84) / 2, r = R * 0.72;
    const slots = favs.map((id, i) => { const d = byId(id); const a = -Math.PI / 2 + (i / 8) * Math.PI * 2; const own = d && ownsDance(d);
      return `<button class="ew-s ${d && d.prem ? 'prem' : ''} ${edit === i ? 'pick' : ''}" data-i="${i}" style="left:${R + Math.cos(a) * r}px;top:${R + Math.sin(a) * r}px" aria-label="${esc(d ? d.name : 'Empty slot')}">${d ? (d.icon || '💃') : '➕'}<small>${esc(d ? (own ? d.name : '🔒 ' + d.name) : 'Empty')}</small></button>`; }).join('');
    ov.innerHTML = `<p class="ew-hint">${edit >= 0 ? 'Pick an emote for this slot' : 'Tap an emote · ✏️ to choose your favourites'}</p><div class="ew-ring">${slots}<button class="ew-c" data-x>${edit >= 0 ? 'Done' : '✕'}</button></div>
      ${o.reactions && edit < 0 ? `<div class="ew-bar ew-emo">${o.reactions.map((x) => `<button data-r="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
      <div class="ew-bar"><button data-ed>${edit >= 0 ? '✓ Done editing' : '✏️ Edit favourites'}</button>${o.onShop ? '<button data-shop>🛍️ Emote shop</button>' : ''}</div>
      ${edit >= 0 ? `<div class="ew-grid">${ownedEmotes().map((d) => `<button data-set="${d.id}">${d.icon || '💃'}<small>${esc(d.name)}</small></button>`).join('')}</div>` : ''}`;
  }
  ov.addEventListener('click', (e) => { const b = e.target.closest('button');
    if (!b) { if (e.target === ov) close(); return; }
    if ('x' in b.dataset) { if (edit >= 0) { edit = -1; render(); } else close(); return; }
    if ('ed' in b.dataset) { edit = edit >= 0 ? -1 : 0; render(); return; }
    if ('shop' in b.dataset) { close(); o.onShop(); return; }
    if (b.dataset.r) { close(); o.onReact && o.onReact(b.dataset.r); return; }
    if (b.dataset.set) { favs[edit] = b.dataset.set; setFavs(favs); edit = (edit + 1) % 8; render(); return; }
    if (b.dataset.i) { const i = Number(b.dataset.i); if (edit >= 0) { edit = i; render(); return; } const d = byId(favs[i]);
      if (!d) return; if (!ownsDance(d)) { close(); o.onLocked ? o.onLocked(d) : o.onShop && o.onShop(); return; } close(); o.onEmote(d.id); } });
  render(); return { close };
}
// a round wheel button placed inside `host` (position via style object)
export function wheelButton(host, style, onClick) { css(); const b = document.createElement('button'); b.type = 'button'; b.className = 'ew-btn'; b.textContent = '😊'; b.setAttribute('aria-label', 'Emote wheel'); Object.assign(b.style, style); b.onclick = (e) => { e.stopPropagation(); onClick(); }; host.appendChild(b); return b; }
// tabbed quick-chat panel rendered into `el`; onSay(text)
export function renderQuickChat(el, onSay, tabs = QUICK_TABS) {
  css(); let cur = tabs[0].id;
  const draw = () => { const t = tabs.find((x) => x.id === cur);
    el.innerHTML = `<div class="qc"><div class="qc-tabs" role="tablist">${tabs.map((x) => `<button type="button" role="tab" data-qt="${x.id}" aria-selected="${x.id === cur}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>
      <div class="qc-list ${cur === 'emoji' ? 'emo' : ''}">${t.list.map((p) => `<button type="button" data-qs="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`; };
  el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); if (b.dataset.qt) { cur = b.dataset.qt; draw(); } else if (b.dataset.qs) onSay(b.dataset.qs); };
  draw();
}
