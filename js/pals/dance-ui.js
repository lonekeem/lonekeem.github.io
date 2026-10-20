import { cachedDoc } from '../fs-cache.js';
import { openBuySheet, coinBadge } from '../buy-sheet.js';
// Dance picker + Dance Shop (Star Coins, the Pals' existing free currency) + the floating companion Pal.
import { EMOTE_DANCES, priceOf, BASIC, TRENDING, PRICE, RARITY_NAME, allDances, danceById, itemId, isFree, loadTrends, tiktok, setOwned, ownsDance, favOf, setFav, drawDancer, forcePreview, busState, isDancing, danceEnabled, BASIC as B0 } from './dance.js';
import { addItems, addDiamondItems, ITEM, shopDoc } from './catalog.js';
import { createDiamonds } from './armory.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const R2 = { c: 'c', r: 'r', l: 'l' };
export async function registerDanceItems() {
  await loadTrends();
  addItems([...TRENDING, ...tiktok()].filter((d) => !isFree(d)).map((d) => ({ id: itemId(d.id), name: d.name, kind: 'dance', p: PRICE[d.r] || PRICE.r, r: R2[d.r] || 'r', dance: d.id })));
  // emotes: Star Coin ones join the Pal Shop items; premium ones are Diamond items (config/palShop.dprices)
  addItems(EMOTE_DANCES.filter((d) => !d.free && !d.prem).map((d) => ({ id: itemId(d.id), name: d.name, kind: 'dance', p: d.p, r: R2[d.r] || 'c', dance: d.id })));
  addDiamondItems(EMOTE_DANCES.filter((d) => d.prem).map((d) => ({ id: d.item, name: d.name, kind: 'dance', d: d.d, productId: d.productId })));
}
// Payment methods. Only 'coins' (free Star Coins) exists; a real-money method could be added here later
// (it would grant the same inv item after a verified receipt). No real-money code is shipped.
const METHODS = { coins: (econ, item) => econ.buy(item.id) };
export async function purchase(econ, item, method = 'coins') { return METHODS[method](econ, item); }

function canvasEl(w, h) { const cv = document.createElement('canvas'); const d = Math.min(2, devicePixelRatio || 1); cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return { cv, c }; }

export function createDanceUI(ctx) {
  const { S, db, esc, toast, openModal, closeModal, friendlyError, isAdmin } = ctx;
  let econ = null;
  async function refreshOwned() { if (!econ) return; try { const inv = await econ.inventory(true); setOwned(Object.keys(inv).filter((k) => (k.startsWith('dn_') || k.startsWith('z_dn_')) && inv[k] > 0)); } catch { /* */ } }
  async function pricesLive() { try { const s = await cachedDoc('cfg:palShop', doc(db, 'config', 'palShop'), 6 * 3600e3); const dt = s.exists() ? s.data() : {}; return { ...(dt.prices || {}), ...(dt.dprices || {}) }; } catch { return {}; } }

  // the modal: tabs "Pick a dance" / "Dance Shop"
  async function open(pal, { tab = 'pick', econOf } = {}) {
    await registerDanceItems(); econ = econOf ? econOf() : econ; await refreshOwned();
    let coins = 0; try { coins = (await econ.wallet(true)).coins; } catch { /* signed out */ }
    let dia = null, gems = 0; if (S.user) { try { dia = createDiamonds(db, S.user.uid); gems = (await dia.get(true)).d || 0; } catch { /* */ } }
    let sel = favOf(pal), prev = null, confirm = null; const live = await pricesLive();
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-dance"><h2>💃 ${esc(pal.name)}’s dances</h2><div style="text-align:center" id="dc-coins">${coinBadge(coins)}</div>
      <div class="pal-dance-stage"></div><p class="small muted pal-dance-now"></p>
      <div class="pal-tabs" role="tablist"><button role="tab" data-dt="pick">Pick a dance</button><button role="tab" data-dt="shop">🛍️ Dance Shop</button><span class="pal-coins" title="Star Coins"><span class="coin">★</span>${coins.toLocaleString()}</span></div>
      <div class="pal-dance-body"></div></div>`);
    const root = document.querySelector('.pal-dance'); const body = root.querySelector('.pal-dance-body');
    const { cv, c } = canvasEl(220, 150); root.querySelector('.pal-dance-stage').appendChild(cv);
    forcePreview(true); let t = 0;
    const frame = () => { if (!document.body.contains(cv)) { forcePreview(false); return; } t++; c.clearRect(0, 0, 220, 150);
      const d = prev ? danceById(prev) : sel !== 'free' ? danceById(sel) : null;
      drawDancer(c, 110, 140, 96, { ...pal, _dance: d && ownsDance(d) ? d.id : 'free' }, { t, dance: d || undefined });
      root.querySelector('.pal-dance-now').textContent = prev ? `Preview: ${danceById(prev).name}` : d ? `Favourite: ${d.name}` : 'Freestyle: mixes all your moves to the beat';
      requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    const tile = (d) => { const own = ownsDance(d); const price = priceOf(d); const picked = sel === d.id; const cur = d.prem ? '💎' : '★';
      return `<div class="pal-dtile ${own ? 'own' : 'lock'} ${picked ? 'on' : ''} r-${d.r || 'c'} ${d.prem ? 'prem' : ''}">${d.prem ? '<small class="pal-prem">👑 PREMIUM</small>' : ''}<b>${d.icon ? d.icon + ' ' : ''}${esc(d.name)}</b>${d.tag ? `<small class="pal-tt">${esc(d.tag)}</small>` : ''}${d.credit ? `<small class="muted pal-credit">${esc(d.credit)}</small>` : ''}${!isFree(d) && !d.prem ? `<small class="rar r-${d.r}">${RARITY_NAME[d.r]}</small>` : ''}${d.free && d.emote ? '<small class="rar">Free</small>' : ''}
        <span class="pal-dbtns"><button class="btn btn-sm btn-ghost" data-pv="${d.id}" aria-label="Preview ${esc(d.name)}">▶</button>${own ? `<button class="btn btn-sm" data-pick="${d.id}">${picked ? '✓ Picked' : 'Pick'}</button>` : `<button class="btn btn-sm" data-ask="${d.id}">🔒 ${cur}${price}</button>`}</span></div>`; };
    function render(which) { tab = which; root.querySelectorAll('[data-dt]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.dt === tab)));
      const tt = tiktok();
      const EM = (c, prem) => EMOTE_DANCES.filter((d) => d.cat === c && !d.prem), PR = () => EMOTE_DANCES.filter((d) => d.prem);
      const EMS = () => `<h3 class="pal-sub pal-gold">👑 Premium dances</h3><p class="small muted">The showstoppers. Diamonds for now (earn them in Pal Zombie Survival).</p><div class="pal-dgrid">${PR().map(tile).join('')}</div>
        <h3 class="pal-sub">😊 Quick emotes</h3><div class="pal-dgrid">${EM('quick').map(tile).join('')}</div>
        <h3 class="pal-sub">💃 Kemy dances</h3><div class="pal-dgrid">${EM('dance').map(tile).join('')}</div>
        <h3 class="pal-sub">🤪 Silly</h3><div class="pal-dgrid">${EM('silly').map(tile).join('')}</div>`;
      const TR = () => tt.filter((d) => d.group === 'trending'), HH = () => [...TRENDING.filter((d) => d.group !== 'classic'), ...tt.filter((d) => d.group === 'hiphop')], CL = () => [...TRENDING.filter((d) => d.group === 'classic'), ...tt.filter((d) => d.group === 'classic')], LN = () => tt.filter((d) => d.group === 'line');
      if (confirm) { const d = danceById(confirm); const price = PRICE[d.r] || PRICE.r;
        body.innerHTML = `<div class="pal-confirm"><p><b>Unlock ${esc(d.name)}</b> for <span class="coin">★</span>${price}?</p><p class="small muted">You have ★${coins.toLocaleString()}. Star Coins are free and can’t be bought. ${esc(pal.name)} can do it right away.</p>
          <div class="btns"><button class="btn" id="dc-yes" ${coins < price ? 'disabled' : ''}>${coins < price ? 'Not enough Star Coins yet' : 'Unlock'}</button><button class="btn btn-ghost" id="dc-no">Cancel</button></div></div>`;
        body.querySelector('#dc-no').onclick = () => { confirm = null; render(tab); };
        body.querySelector('#dc-yes').onclick = async (ev) => { const it = ITEM[itemId(d.id)]; ev.target.disabled = true;
          if (!(it.id in live)) { toast('The Dance Shop is opening soon. Prices are being set up!'); if (isAdmin && isAdmin()) adminSync(); ev.target.disabled = false; return; }
          try { const paid = await purchase(econ, it); coins -= paid; await refreshOwned(); toast(`${pal.name} learned ${d.name}! −${paid} ★`); sel = d.id; setFav(pal, d.id); confirm = null; prev = null; render('pick'); }
          catch (er) { ev.target.disabled = false; toast(er.code ? friendlyError(er) : er.message); } };
        return; }
      if (tab === 'pick') body.innerHTML = `<div class="pal-dtile free ${sel === 'free' ? 'on' : ''}"><b>🎲 Freestyle</b><small>Mixes your moves to the beat</small><span class="pal-dbtns"><button class="btn btn-sm" data-pick="free">${sel === 'free' ? '✓ Picked' : 'Pick'}</button></span></div>
        ${EMS()}
        <h3 class="pal-sub">🔥 Trending</h3><div class="pal-dgrid">${TR().map(tile).join('')}</div>
        <h3 class="pal-sub">🕺 Classics</h3><div class="pal-dgrid">${CL().map(tile).join('')}</div>
        <h3 class="pal-sub">👟 Hip-Hop &amp; Footwork</h3><div class="pal-dgrid">${HH().map(tile).join('')}</div>
        <h3 class="pal-sub">🤠 Country &amp; Line</h3><div class="pal-dgrid">${LN().map(tile).join('')}</div>
        <h3 class="pal-sub">💜 Pal Originals</h3><div class="pal-dgrid">${BASIC.map(tile).join('')}</div>
        <p class="small muted">Pals dance whenever music plays: the theme song, songs, music videos. ${danceEnabled() ? '' : '<b>Dancing is off in Settings.</b>'}</p>`;
      else body.innerHTML = `<p class="small muted">Unlock emotes and dances with free Star Coins or 💎 Diamonds. Tap ▶ to preview on your Pal first. ${dia ? `<b>💎 ${gems.toLocaleString()}</b>` : ''}</p>${EMS()}
        <h3 class="pal-sub">🔥 Trending</h3><div class="pal-dgrid">${TR().map(tile).join('')}</div>
        <h3 class="pal-sub">🕺 Classics</h3><div class="pal-dgrid">${CL().map(tile).join('')}</div>
        <h3 class="pal-sub">👟 Hip-Hop &amp; Footwork</h3><div class="pal-dgrid">${HH().map(tile).join('')}</div>
        <h3 class="pal-sub">🤠 Country &amp; Line</h3><div class="pal-dgrid">${LN().map(tile).join('')}</div>
        ${isAdmin && isAdmin() ? '<p class="small"><button class="btn btn-sm btn-ghost" id="dc-sync">Admin: publish dance prices</button></p>' : ''}`;
      body.querySelectorAll('[data-pv]').forEach((b) => b.onclick = () => { prev = b.dataset.pv; });
      body.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => { sel = b.dataset.pick; prev = null; setFav(pal, sel); render(tab); toast(sel === 'free' ? 'Freestyle on' : `${pal.name}’s favourite: ${danceById(sel).name}`); });
      body.querySelectorAll('[data-ask]').forEach((b) => b.onclick = async () => { prev = b.dataset.ask; if (!S.user) return toast('Sign in to unlock dances'); const d = danceById(b.dataset.ask); const price = priceOf(d);
        if (d.prem) { if (!(d.item in live)) { toast('The Dance Shop is opening soon. Prices are being set up!'); if (isAdmin && isAdmin()) adminSync(); return; }
          const ok = await openBuySheet({ name: d.name, price, icon: d.icon || '👑', balance: gems, currency: '💎', note: `👑 Premium dance. ${pal.name} can do it right away. Diamonds only, no real money.`, equipped: `${pal.name} will dance it next ✓`, earn: [{ label: '🧟 Earn Diamonds in Pal Zombie Survival', href: '#/arcade' }],
            buy: async () => { try { const paid = await dia.buy(d.item); gems -= paid; return gems; } catch (er) { throw new Error(er.code ? friendlyError(er) : er.message); } },
            onSuccess: async () => { await refreshOwned(); sel = d.id; setFav(pal, d.id); } });
          if (ok) { prev = null; render('pick'); } return; }
        const it = ITEM[itemId(d.id)];
        if (!(it.id in live)) { toast('The Dance Shop is opening soon. Prices are being set up!'); if (isAdmin && isAdmin()) adminSync(); return; }
        const ok = await openBuySheet({ name: d.name, price, icon: '💃', balance: coins, note: `${pal.name} can do it right away. Star Coins only, no real money.`, equipped: `${pal.name} will dance it next ✓`,
          buy: async () => { try { const paid = await purchase(econ, it); coins -= paid; return coins; } catch (er) { throw new Error(er.code ? friendlyError(er) : er.message); } },
          onSuccess: async () => { await refreshOwned(); sel = d.id; setFav(pal, d.id); } });
        if (ok) { prev = null; const cc = document.getElementById('dc-coins'); if (cc) cc.innerHTML = coinBadge(coins); render('pick'); } });
      const sy = body.querySelector('#dc-sync'); if (sy) sy.onclick = adminSync;
    }
    root.querySelectorAll('[data-dt]').forEach((b) => b.onclick = () => { confirm = null; render(b.dataset.dt); });
    render(tab);
  }
  async function adminSync() { try { await registerDanceItems(); await setDoc(doc(db, 'config', 'palShop'), shopDoc()); toast('Shop prices published (incl. dances)'); } catch (e) { toast(friendlyError(e)); } }
  return { open, refreshOwned, setEcon: (e) => { econ = e; refreshOwned(); }, adminSync };
}

// ---------------------------------------------------------------- floating companion Pal
const KEEP = 'kemy-pal-keep', HIDE = 'kemy-pal-float-hidden', HINT = 'kemy-pal-float-hint', POS = 'kemy-pal-float-pos';
export const keepOn = () => { try { return localStorage.getItem(KEEP) === '1'; } catch { return false; } };
export function setKeep(on) { try { localStorage.setItem(KEEP, on ? '1' : '0'); if (on) sessionStorage.removeItem(HIDE); } catch { /* */ } window.dispatchEvent(new Event('kemy:pal-float')); }
const hiddenSession = () => { try { return sessionStorage.getItem(HIDE) === '1'; } catch { return false; } };
const PAL_SCREENS = /^#\/(me|u\/|pals|park|games|game\/|live|new|settings)/;
const palOnPage = () => { for (const e of document.querySelectorAll('[data-pal-stage], .pal-strip, .pal-sheet, .pal-talk, .pal-dance, .park-view, .pal-pop')) if (e.isConnected && (e.offsetParent !== null || e.classList.contains('pal-pop'))) return true; return false; };
export function initFloat({ getPal, toast }) {
  document.querySelectorAll('.pal-float').forEach((e) => e.remove()); // idempotent: never two floating Pals
  const el = document.createElement('div'); el.className = 'pal-float'; el.hidden = true; el.setAttribute('role', 'button'); el.tabIndex = 0;
  el.setAttribute('aria-label', 'Your Pal. Tap for a move, double-tap to hide'); document.body.appendChild(el);
  const { cv, c } = canvasEl(84, 84); el.appendChild(cv);
  let pal = null, t = 0, running = false, special = 0, specialD = null, leaving = 0, entering = 0;
  try { const p = JSON.parse(sessionStorage.getItem(POS) || 'null'); if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.classList.add('moved'); } } catch { /* */ }
  const want = () => {
    if (!pal || document.hidden) return false; const h = location.hash || '#/watch';
    if (PAL_SCREENS.test(h)) return false; if (document.querySelector('.modal-backdrop')) return false;
    if (palOnPage()) return false; // one Pal on screen at a time: the page (or a pop-up) already shows it
    if (keepOn() && !hiddenSession()) return true;
    return danceEnabled() && isDancing() && !hiddenSession();
  };
  const loop = () => { if (!running) return; t++;
    const show = want() || leaving > 0;
    if (!show) { el.hidden = true; running = false; return; }
    c.clearRect(0, 0, 84, 84);
    let st = { t, mode: 'idle', face: 1 };
    if (special > 0) { special--; st.dance = specialD; }
    if (leaving > 0) { leaving--; const k = leaving / 36; c.save(); c.globalAlpha = k; c.translate(42, 80); c.scale(0.4 + k * 0.6, 0.4 + k * 0.6); drawDancer(c, 0, 0, 60, pal, { ...st, dance: TRENDING.find((d) => d.id === 'wave') }); c.restore(); if (!leaving) { el.hidden = true; } }
    else { const k = entering > 0 ? (entering--, 1 + Math.sin((1 - entering / 24) * Math.PI) * 0.25) : 1; c.save(); c.translate(42, 80); c.scale(k, k); drawDancer(c, 0, 0, 60, pal, st); c.restore(); }
    requestAnimationFrame(loop); };
  const wake = () => { if (!running && want()) { el.hidden = false; running = true; if (!localStorage.getItem(HINT)) { localStorage.setItem(HINT, '1'); toast && toast('Double-tap your Pal to hide it · triple-tap the screen to bring it back'); } requestAnimationFrame(loop); } };
  const refresh = async () => { try { pal = await getPal(); } catch { pal = null; } wake(); };
  function hide() { if (leaving) return; try { sessionStorage.setItem(HIDE, '1'); } catch { /* */ } leaving = 36; el.classList.add('bye'); setTimeout(() => el.classList.remove('bye'), 700); }
  function summon() { try { sessionStorage.removeItem(HIDE); } catch { /* */ } entering = 24; leaving = 0; if (!want() && pal && !PAL_SCREENS.test(location.hash || '#/watch')) { /* keep-off + no music: show for a moment */ } wake(); if (!running && pal && !PAL_SCREENS.test(location.hash || '#/watch')) { el.hidden = false; running = true; requestAnimationFrame(loop); } }
  // gestures on the Pal: tap = special move, double-tap = wave + pop out, drag = move, swipe = hide
  let taps = 0, tapT = 0, down = null, moved = false;
  el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now(), ox: el.offsetLeft, oy: el.offsetTop }; moved = false; el.setPointerCapture(e.pointerId); e.stopPropagation(); });
  el.addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 8) moved = true; if (!moved) return;
    el.classList.add('moved'); el.style.left = Math.max(0, Math.min(innerWidth - 84, down.ox + dx)) + 'px'; el.style.top = Math.max(0, Math.min(innerHeight - 84, down.oy + dy)) + 'px'; });
  el.addEventListener('pointerup', (e) => { if (!down) return; const dx = e.clientX - down.x, dt = performance.now() - down.t; const d0 = down; down = null; e.stopPropagation();
    if (moved) { if (Math.abs(dx) > 70 && dt < 260) { hide(); return; } try { sessionStorage.setItem(POS, JSON.stringify({ x: el.offsetLeft, y: el.offsetTop })); } catch { /* */ } return; }
    taps++; clearTimeout(tapT);
    tapT = setTimeout(() => { const n = taps; taps = 0; if (n >= 2) hide(); else { const pool = [...TRENDING, ...B0].filter(ownsDance); specialD = pool[Math.floor(Math.random() * pool.length)] || B0[2]; special = RM() ? 60 : 110; } }, 330);
  });
  el.addEventListener('click', (e) => e.stopPropagation());
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { specialD = B0[6]; special = 90; } if (e.key === 'Escape' || e.key === 'Delete') hide(); });
  // triple-tap anywhere (not a control) brings it back; a feed double-tap like waits briefly so it can't double up
  let tt = [], pendingLike = null;
  window.addEventListener('pointerup', (e) => {
    if (e.target.closest?.('button, a, input, textarea, select, [contenteditable], .pal-float, .theme-fab')) return;
    const now = performance.now(); tt = tt.filter((x) => now - x.t < 700 && Math.hypot(x.x - e.clientX, x.y - e.clientY) < 60); tt.push({ t: now, x: e.clientX, y: e.clientY });
    if (tt.length >= 3 && hiddenSession() && pal) { tt = []; if (pendingLike) { clearTimeout(pendingLike); pendingLike = null; } summon(); }
  }, true);
  window.__kemyPalSummon = { armed: () => hiddenSession() && !!pal && (keepOn() || isDancing()), deferLike: (fn) => { clearTimeout(pendingLike); pendingLike = setTimeout(() => { pendingLike = null; fn(); }, 360); }, hide, summon };
  addEventListener('hashchange', () => setTimeout(wake, 300)); addEventListener('kemy:pal-float', refresh); addEventListener('kemy:pal-changed', refresh);
  document.addEventListener('visibilitychange', wake); document.addEventListener('play', () => setTimeout(wake, 200), true); document.addEventListener('kemy-theme', () => setTimeout(wake, 200));
  addEventListener('kemy:media-play', () => setTimeout(wake, 300));
  setInterval(wake, 1500); // cheap check (music started elsewhere, modal closed…)
  refresh();
  return { refresh, hide, summon, el };
}
