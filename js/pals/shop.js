// Pal Closet (mix-and-match outfits + saved looks) and Pal Shop (Star Coins, Daily Deals, rarities, achievements).
import { ITEMS, ITEM, RARITY, SLOTS, SLOT_NAMES, todaysDeals, EARN } from './catalog.js';
import { drawItemIcon } from './wear.js';
import { drawPal } from './art.js';
import { drawDancer } from './dance.js';
import { createEconomy } from './economy.js';
import { getAggregateFromServer, query, collection, where, sum } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function cvs(el, w, h) { const cv = document.createElement('canvas'); const d = Math.min(3, devicePixelRatio || 1); cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); el.innerHTML = ''; el.appendChild(cv); return { cv, c }; }
function anim(cv, fn) { let t = 0; const f = () => { if (!document.body.contains(cv)) return; t++; fn(t); if (!RM()) requestAnimationFrame(f); }; f(); }
const icon = (el, it, s = 56) => { const q = cvs(el, s, s); drawItemIcon(q.c, it, s / 2, s * 0.62, s * 0.9); };
export const SEASON = () => { const m = new Date().getMonth(); return m >= 8 && m <= 10 ? 'fall' : m === 11 || m <= 1 ? 'winter' : ''; };
export function createShopUI(ctx) {
  const { S, db, esc, toast, openModal, closeModal, friendlyError, requireAuth } = ctx;
  let E = null;
  const econ = () => { if (!S.user) return null; if (!E || E.uid !== S.user.uid) { E = createEconomy(db, S.user.uid); E.uid = S.user.uid; } return E; };
  const coinTxt = (n) => `<span class="coin">★</span>${Number(n || 0).toLocaleString()}`;
  // daily login bonus + gold stars on your posts since last check (once a day each, capped by the rules)
  async function daily() {
    const e = econ(); if (!e) return; const k = 'kemy-coins-day-' + S.user.uid; const today = new Date().toDateString(); if (localStorage.getItem(k) === today) return;
    localStorage.setItem(k, today);
    try { await e.wallet(); const got = await e.earn('daily', 50); if (got) toast(`Daily bonus: +${got} Star Coins ★`); } catch {}
    try { const a = await getAggregateFromServer(query(collection(db, 'posts'), where('authorId', '==', S.user.uid)), { n: sum('likeCount') }); const total = a.data().n || 0;
      const sk = 'kemy-coins-stars-' + S.user.uid; const seen = localStorage.getItem(sk); localStorage.setItem(sk, String(total));
      if (seen !== null) { let left = Math.min(50, total - +seen); while (left > 0) { const g = await e.earn('stars', Math.min(5, left)); if (!g) break; left -= g; } } } catch {}
  }
  async function earn(src, n, why) { const e = econ(); if (!e) return 0; const g = await e.earn(src, n); if (g && why) toast(`+${g} Star Coins ★ ${why}`); return g; }
  // ---------------------------------------------------------------- closet
  async function closet(p, save) {
    if (!requireAuth()) return; const e = econ(); const inv = await e.inventory(true); let looks = await e.looks().catch(() => []);
    const fit = { head: '', face: '', neck: '', body: '', feet: '', back: '', ...(p.outfit || {}) }; let tab = 'head';
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-closet"><h2>${esc(p.name)}’s Closet</h2>
      <div class="pal-cl-prev"></div><div class="pal-tabs" role="tablist">${SLOTS.map((s) => `<button role="tab" data-tab="${s}">${SLOT_NAMES[s]}</button>`).join('')}</div>
      <div class="pal-items" id="cl-items"></div>
      <div class="pal-looks"><b class="small">Saved outfits</b><div id="cl-looks"></div></div>
      <div class="btns"><button class="btn" id="cl-save">Wear this</button><a class="btn btn-ghost" href="#/pals/shop" data-close>Shop for more</a></div></div>`);
    const root = document.querySelector('.pal-closet'); const pv = cvs(root.querySelector('.pal-cl-prev'), 220, 170);
    anim(pv.cv, (t) => { pv.c.clearRect(0, 0, 220, 170); drawDancer(pv.c, 110, 160, 130, { ...p, outfit: fit }, { t, mode: t % 240 < 60 ? 'happy' : 'idle' }); });
    function items() {
      const own = ITEMS.filter((i) => i.kind === 'wear' && i.slot === tab && inv[i.id]);
      root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
      const box = root.querySelector('#cl-items');
      box.innerHTML = `<button class="pal-item ${!fit[tab] ? 'on' : ''}" data-wear=""><i class="pal-ic none">✕</i><b>None</b></button>` + own.map((i) => `<button class="pal-item r-${i.r} ${fit[tab] === i.id ? 'on' : ''}" data-wear="${i.id}"><i class="pal-ic" data-ic="${i.id}"></i><b>${esc(i.name)}</b></button>`).join('')
        + (own.length ? '' : `<p class="small muted">No ${SLOT_NAMES[tab].toLowerCase()} yet. Earn Star Coins and visit the Pal Shop!</p>`);
      box.querySelectorAll('[data-ic]').forEach((el) => icon(el, ITEM[el.dataset.ic], 52));
    }
    function lookRow() {
      root.querySelector('#cl-looks').innerHTML = looks.map((l) => `<button class="pal-chip" data-look="${l.id}">${esc(l.name)}</button>`).join('') + (looks.length < 6 ? '<button class="pal-chip" id="cl-addlook">＋ Save this outfit</button>' : '');
    }
    items(); lookRow();
    root.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button'); if (!t) return;
      if (t.dataset.tab) { tab = t.dataset.tab; items(); }
      if (t.dataset.wear !== undefined) { fit[tab] = t.dataset.wear; items(); }
      if (t.dataset.look) { const l = looks.find((x) => x.id === t.dataset.look); for (const s of SLOTS) fit[s] = l.outfit[s] && inv[l.outfit[s]] ? l.outfit[s] : ''; items(); toast(`Outfit “${l.name}” on`); }
      if (t.id === 'cl-addlook') { const name = (prompt('Name this outfit', 'My look') || '').trim(); if (!name) return; const id = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].find((x) => !looks.some((l) => l.id === x));
        try { await e.saveLook(id, name, { ...fit }); looks = await e.looks(); lookRow(); toast('Outfit saved'); } catch (er) { toast(friendlyError(er)); } }
      if (t.id === 'cl-save') { t.disabled = true; const out = {}; for (const s of SLOTS) out[s] = fit[s] || ''; try { await save(out); closeModal(); toast(`${p.name} looks amazing! ✨`); } catch (er) { t.disabled = false; toast(friendlyError(er)); } }
    });
  }
  // ---------------------------------------------------------------- shop page (#/pals/shop)
  async function shopPage(main, { myPals, activeOf, commit }) {
    if (!requireAuth()) return; const e = econ(); main.innerHTML = '<section class="card pad pal-box"><p class="muted">Opening the Pal Shop…</p></section>';
    let w, inv; try { w = await e.wallet(true); inv = await e.inventory(true); } catch (er) { main.innerHTML = `<section class="card pad">${esc(friendlyError(er))}</section>`; return; }
    const m = await myPals(); const act = activeOf(m); let cat = 'wear';
    const deals = todaysDeals(); const season = SEASON();
    const card = (i, dealP) => { const owned = inv[i.id] && i.kind !== 'snack'; const price = dealP !== undefined ? dealP : i.p;
      return `<div class="pal-shopitem r-${i.r}"><i class="pal-ic" data-ic="${i.id}"></i><b>${esc(i.name)}</b><small class="rar" style="color:${RARITY[i.r].col}">${RARITY[i.r].name}${i.season ? ' · ' + (i.season === 'fall' ? '🍂 Fall' : '❄️ Winter') : ''}</small>
        ${owned ? '<span class="pal-owned">Owned</span>' : `<button class="btn btn-sm" data-buy="${i.id}" ${w.coins < price ? 'disabled' : ''}>${dealP !== undefined ? `<s>${i.p}</s> ` : ''}${coinTxt(price)}</button>`}${i.kind === 'snack' && inv[i.id] ? `<small>You have ${inv[i.id]}</small>` : ''}</div>`; };
    function render() {
      const list = ITEMS.filter((i) => !i.ach && i.kind === cat && (!i.season || i.season === season));
      const achs = ITEMS.filter((i) => i.ach);
      main.innerHTML = `<section class="card pad pal-box pal-shop"><div class="pal-box-head"><h1>Pal Shop</h1><span class="pal-coins" title="Star Coins">${coinTxt(w.coins)}</span></div>
        <p class="muted small">Star Coins are free: daily bonus, caring for your Pal, winning games, Bubble Quest stars, gold stars on your posts and Pal Park treasures. They can’t be bought.</p>
        <h2 class="pal-sub">🔥 Daily Deals <small class="muted">new every day</small></h2><div class="pal-deals">${Object.entries(deals).map(([id, pr]) => card(ITEM[id], pr)).join('')}</div>
        <p><button class="btn btn-sm" type="button" id="dance-shop-link">💃 Dance Shop: Trending, Classics, Hip-Hop &amp; Country moves</button></p><div class="pal-tabs">${[['wear', '👒 Clothes'], ['decor', '🏡 Decor'], ['toy', '🧸 Toys'], ['snack', '🍓 Snacks'], ['voice', '🎤 Voices'], ['ach', '🏆 Achievements']].map(([k, l]) => `<button data-cat="${k}" aria-selected="${cat === k}">${l}</button>`).join('')}</div>
        ${cat === 'ach' ? `<div class="pal-shopgrid">${achs.map((i) => `<div class="pal-shopitem r-${i.r}"><i class="pal-ic" data-ic="${i.id}"></i><b>${esc(i.name)}</b><small class="rar" style="color:${RARITY[i.r].col}">${RARITY[i.r].name} · achievement</small><small>${esc(i.how)}</small>${inv[i.id] ? '<span class="pal-owned">Earned</span>' : `<button class="btn btn-sm btn-ghost" data-claim="${i.ach}">Claim</button>`}</div>`).join('')}</div>`
          : `<div class="pal-shopgrid">${list.map((i) => card(i)).join('')}</div>`}
        ${cat === 'decor' ? `<p class="small muted">Decor you own shows in your Pal’s corner on your profile (up to 3). <button class="btn btn-sm btn-ghost" id="room-edit">Arrange room</button></p>` : ''}
        ${cat === 'snack' ? '<p class="small muted">Snacks from the shop fill your Pal right up. Use them from the Feed screen.</p>' : ''}
        <details class="small"><summary>How to earn Star Coins</summary><ul class="pal-earn">${Object.entries({ daily: 'Daily visit bonus', care: 'Caring for your Pal', win: 'Winning games', quest: 'Bubble Quest stars', stars: 'Gold stars on your posts', park: 'Pal Park treasures' }).map(([k, l]) => `<li>${l}: up to ${EARN[k][1]}/day <small class="muted">(${e.leftToday(k)} left today)</small></li>`).join('')}</ul></details>
        <a class="btn btn-sm btn-ghost" href="#/pals">← Pal Box</a></section>`;
      main.querySelectorAll('[data-ic]').forEach((el) => icon(el, ITEM[el.dataset.ic], 64));
      main.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { cat = b.dataset.cat; render(); });
      main.querySelector('#dance-shop-link').onclick = () => dispatchEvent(new Event('kemy:dance-shop'));
      main.querySelectorAll('[data-buy]').forEach((b) => b.onclick = async () => { const it = ITEM[b.dataset.buy]; b.disabled = true;
        try { const paid = await e.buy(it.id); w = e.w; toast(`You got ${it.name}! −${paid} ★`); if (it.kind === 'wear' && act) setTimeout(() => toast('Open the Closet in your Pal Box to wear it'), 1200); render(); }
        catch (er) { b.disabled = false; toast(er.code ? friendlyError(er) : er.message); } });
      main.querySelectorAll('[data-claim]').forEach((b) => b.onclick = async () => { const a = b.dataset.claim; let proof; const pals = m.list;
        if (a === 'glow') { const p = pals.find((x) => x.level >= 12); if (!p) return toast('Glow a Pal up to level 12 first'); proof = p.id; }
        if (a === 'family') { if (pals.length < 3) return toast('Hatch 3 Pals first'); proof = pals.slice(0, 3).map((x) => x.id); }
        if (a === 'coins' && (w.total || 0) < 1000) return toast(`${w.total || 0}/1,000 Star Coins earned so far`);
        try { await e.claim('ach_' + a, proof); inv['ach_' + a] = 1; toast('Achievement unlocked! 🏆'); render(); } catch (er) { toast(a === 'champ' ? 'Win 5 Pal Games first' : 'Not quite yet. Keep going!'); } });
      const re = main.querySelector('#room-edit'); if (re) re.onclick = () => roomPicker(e, inv, () => { w = e.w; });
    }
    render();
  }
  function roomPicker(e, inv, done) {
    const own = ITEMS.filter((i) => i.kind === 'decor' && inv[i.id]); const room = [...(e.w.room || [])];
    if (!own.length) return toast('Buy some decor first');
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-closet"><h2>Pal Room</h2><p class="small muted">Pick up to 3 things for your Pal’s corner.</p><div class="pal-items">${own.map((i) => `<button class="pal-item ${room.includes(i.id) ? 'on' : ''}" data-rm="${i.id}"><i class="pal-ic" data-ic="${i.id}"></i><b>${esc(i.name)}</b></button>`).join('')}</div><button class="btn" id="rm-save">Save room</button></div>`);
    const r = document.querySelector('.pal-closet'); r.querySelectorAll('[data-ic]').forEach((el) => icon(el, ITEM[el.dataset.ic], 52));
    r.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { const id = b.dataset.rm; const k = room.indexOf(id); if (k >= 0) room.splice(k, 1); else if (room.length < 3) room.push(id); else return toast('Up to 3'); b.classList.toggle('on', room.includes(id)); });
    r.querySelector('#rm-save').onclick = async () => { try { await e.setRoom(room); closeModal(); toast('Room saved'); done && done(); } catch (er) { toast(friendlyError(er)); } };
  }
  return { econ, daily, earn, closet, shopPage, coinTxt };
}
