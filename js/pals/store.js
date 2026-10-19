// Pal Store: Outfits, Jewelry & Accessories, Looks, Backgrounds, Dances, Pals (+ Rare Pals). Star Coins only.
// Live 3D preview of everything (owned or not). Unowned premium items show "Preview" and are bought on Save.
// Ownership is enforced by firestore.rules (inv docs created only together with a priced wallet purchase).
import { WEAR, WEAR_BY, WSLOTS, WSLOT_NAMES, JEWELRY, PATTERNS, RARES, RARE } from './wardrobe.js';
import { BGS, BG, drawBg } from './bgs.js';
import { addItems, RARITY } from './catalog.js';
import { drawDancer } from './dance.js';
import { SPECIES } from './art.js';
// premium items join the shop catalog (config/palShop prices) so purchases validate server-side
addItems([...WEAR.filter((w) => w.p), ...BGS.filter((b) => b.p).map((b) => ({ ...b, kind: 'bg' })),
  ...PATTERNS.filter((p) => p.p).map((p) => ({ ...p, kind: 'look', r: p.r || 'r' })), ...RARES.map((r) => ({ ...r, kind: 'rare' }))]);
const EMO = { cap: '🧢', beanie: '🧶', bucket: '👒', tiara: '👸', crown: '👑', tophat: '🎩', helmet: '⛑️', earband: '🐱', wizard: '🧙', santa: '🎅', flowers: '🌸', bow: '🎀', bow2: '🎀', clips: '⭐', pigtails: '💇', bun: '🍡', quiff: '💈',
  round: '👓', lens: '🕶️', heart: '💖', star: '🌟', stud: '💎', hoop: '⭕', drop: '✨', beads: '📿', chain: '⛓️', locket: '💝', medal: '🏅', scarf: '🧣', tie: '👔', bowtie: '🎀', tee: '👕', hoodie: '🧥', jersey: '🎽', sweater: '🧶', puffer: '🧥', blouse: '👚',
  shorts: '🩳', skirt: '👗', tutu: '🩰', pants: '👖', dress: '👗', gown: '👸', overalls: '👖', pjs: '🌙', suit: '🤵', kit: '⚽', uniform: '🏫', coat: '🧥', swim: '🩱', dino: '🦖', astro: '🧑‍🚀', hero: '🦸', xmas: '🎄',
  sneakers: '👟', boots: '🥾', flats: '🩰', sandals: '🩴', cape: '🦸', wings: '🧚', angel: '😇', jetpack: '🚀', backpack: '🎒', purse: '👛', satchel: '💼', wand: '🪄', balloon: '🎈', icecream: '🍦', teddy: '🧸', guitar: '🎸', ball: '⚽', mic: '🎤', umbrella: '☂️',
  bracelet: '💫', beadband: '📿', watch: '⌚', ring: '💍', gem: '💍' };
export function createPalStore(ctx) {
  const { S, esc, toast, openModal, closeModal, friendlyError, requireAuth, econ, myPals, activeOf, commit } = ctx;
  async function page(main) {
    if (!requireAuth()) return; const m = await myPals(true); const p = m && activeOf(m);
    if (!p) { main.innerHTML = `<section class="card"><h2>Pal Store</h2><p>Hatch a Pal first, then come back to dress it up!</p><a class="btn" href="#pals">Go to my Pals</a></section>`; return; }
    const e = econ(); let inv = {}; try { await e.wallet(); inv = await e.inventory(true); } catch {}
    const own = (id) => !id || id.startsWith('f_') || id.startsWith('b_') || ['none', 'spots', 'stripes', 'sparkle'].includes(id) || !!inv[id];
    const saved = () => ({ outfit: { ...(p.outfit || {}) }, bg: p.bg || '', variant: p.variant || '', pattern: p.pattern || 'none' });
    let D = saved(); const hist = []; let tab = 'outfits', slot = 'all', gf = 'a', yaw = 0, zoom = 1;
    const snap = () => { hist.push(JSON.stringify(D)); if (hist.length > 30) hist.shift(); };
    const unowned = () => { const l = []; for (const id of Object.values(D.outfit)) if (id && !own(id)) l.push(WEAR_BY[id]); if (D.bg && !own(D.bg)) l.push(BG[D.bg]); if (D.variant && !own(D.variant)) l.push(RARE[D.variant]); const pt = PATTERNS.find((x) => x.id === D.pattern); if (pt && pt.p && !own(pt.id)) l.push(pt); return l.filter(Boolean); };
    main.innerHTML = `<section class="card pstore"><div class="ps-top"><h2>Pal Store</h2><span class="ps-coins">★ <b id="ps-c">${(e.w && e.w.coins) || 0}</b></span></div>
      <div class="ps-stage"><canvas id="ps-cv"></canvas><span class="ps-prev" id="ps-prev" hidden>Preview</span>
        <button class="ps-bgbtn" id="ps-bgbtn" type="button" aria-label="Change background">🖼️</button><button class="ps-bgbtn ps-rot" id="ps-rot" type="button" aria-label="Spin">🔄</button></div>
      <div class="ps-actions"><button class="btn btn-sm btn-ghost" id="ps-undo">↶ Undo</button><button class="btn btn-sm btn-ghost" id="ps-reset">Reset</button><button class="btn btn-sm btn-ghost" id="ps-rand">🎲 Random</button><button class="btn btn-sm" id="ps-save">💾 Save Look</button></div>
      <div class="ps-looks" id="ps-looks"></div>
      <div class="ps-tabs" role="tablist">${[['outfits', '👗 Outfits'], ['jewelry', '💍 Jewelry & Accessories'], ['looks', '🎨 Looks'], ['bgs', '🖼️ Backgrounds'], ['dances', '💃 Dances'], ['pals', '🐾 Pals']].map(([k, n]) => `<button class="chip" data-tab="${k}" role="tab">${n}</button>`).join('')}</div>
      <div id="ps-filters" class="ps-filters"></div><div id="ps-grid" class="ps-grid"></div></section>`;
    const $ = (s) => main.querySelector(s);
    // stage: background + 3D Pal, drag to rotate, wheel/pinch to zoom
    const cv = $('#ps-cv'); const W = Math.min(340, main.clientWidth - 24 || 320), H = 260; const dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; const c = cv.getContext('2d'); c.scale(dpr, dpr);
    let drag = null, pinch = 0, spin = false; cv.style.touchAction = 'none';
    cv.onpointerdown = (ev) => { drag = ev.clientX; cv.setPointerCapture(ev.pointerId); }; cv.onpointermove = (ev) => { if (drag !== null) { yaw += (ev.clientX - drag) * 0.015; drag = ev.clientX; } }; cv.onpointerup = cv.onpointercancel = () => { drag = null; };
    cv.onwheel = (ev) => { ev.preventDefault(); zoom = Math.max(0.8, Math.min(1.8, zoom - ev.deltaY * 0.001)); };
    cv.addEventListener('touchmove', (ev) => { if (ev.touches.length === 2) { const d = Math.hypot(ev.touches[0].clientX - ev.touches[1].clientX, ev.touches[0].clientY - ev.touches[1].clientY); if (pinch) zoom = Math.max(0.8, Math.min(1.8, zoom * d / pinch)); pinch = d; } }, { passive: true }); cv.addEventListener('touchend', () => { pinch = 0; });
    $('#ps-rot').onclick = () => { spin = !spin; };
    let t = 0; const frame = () => { if (!document.body.contains(cv)) return; t++; if (spin) yaw += 0.02; c.clearRect(0, 0, W, H);
      if (!drawBg(c, W, H, D.bg, t)) { c.fillStyle = '#2a1458'; c.beginPath(); c.roundRect(0, 0, W, H, 18); c.fill(); }
      drawDancer(c, W / 2, H - 12, 120 * zoom, { ...p, outfit: D.outfit, bg: D.bg, variant: D.variant, pattern: D.pattern }, { t, mode: 'idle', yaw }); requestAnimationFrame(frame); }; frame();
    const refresh = () => { const u = unowned(); const pv = $('#ps-prev'); pv.hidden = !u.length; pv.textContent = u.length ? `Preview · ${u.length} to buy · ★${u.reduce((a, b) => a + (b.p || 0), 0)}` : ''; grid(); };
    const tile = (id, name, price, r, emo, on, ownd, extra = '') => `<button class="ps-tile ${on ? 'on' : ''}" data-id="${esc(id)}" ${extra} style="--rc:${RARITY[r] ? RARITY[r].col : '#9aa3b5'}"><span class="ps-emo">${emo}</span><b>${esc(name)}</b><small>${ownd ? (price ? '✓ Owned' : 'Free') : `★ ${price}`}${r && r !== 'c' && RARITY[r] ? ` · ${RARITY[r].name}` : ''}</small></button>`;
    function filters() {
      const f = $('#ps-filters'); if (tab !== 'outfits' && tab !== 'jewelry') { f.innerHTML = ''; return; }
      const sl = tab === 'jewelry' ? JEWELRY : WSLOTS.filter((s) => !JEWELRY.includes(s));
      f.innerHTML = `<div class="ps-row">${[['a', 'All'], ['g', 'Girls'], ['b', 'Boys']].map(([k, n]) => `<button class="chip ${gf === k ? 'on' : ''}" data-g="${k}">${n}</button>`).join('')}</div>
        <div class="ps-row"><button class="chip ${slot === 'all' ? 'on' : ''}" data-s="all">Everything</button>${sl.map((s) => `<button class="chip ${slot === s ? 'on' : ''}" data-s="${s}">${WSLOT_NAMES[s]}</button>`).join('')}</div><p class="small">Anyone can wear anything ✨</p>`;
      f.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { gf = b.dataset.g; filters(); grid(); });
      f.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { slot = b.dataset.s; filters(); grid(); });
    }
    function grid() {
      const g = $('#ps-grid'); let h = '';
      if (tab === 'outfits' || tab === 'jewelry') { const sl = tab === 'jewelry' ? JEWELRY : WSLOTS.filter((s) => !JEWELRY.includes(s));
        const list = WEAR.filter((w) => sl.includes(w.slot) && (slot === 'all' || w.slot === slot) && (gf === 'a' || w.g === gf || w.g === 'a'));
        h = list.map((w) => tile(w.id, w.name, w.p, w.r, EMO[w.st] || '✨', D.outfit[w.slot] === w.id, own(w.id), `data-slot="${w.slot}" style="--ic:${w.col}"`)).join(''); }
      if (tab === 'bgs') h = `<button class="ps-tile ${!D.bg ? 'on' : ''}" data-bg=""><span class="ps-emo">🟪</span><b>Plain Stage</b><small>Free</small></button>` + BGS.map((b) => `<button class="ps-tile ps-bgt ${D.bg === b.id ? 'on' : ''}" data-bg="${b.id}" style="--rc:${RARITY[b.r].col}"><canvas width="96" height="64"></canvas><b>${esc(b.name)}</b><small>${own(b.id) ? (b.p ? '✓ Owned' : 'Free') : `★ ${b.p} · ${RARITY[b.r].name}`}${b.fx && !/sparkle|twinkle/.test(b.fx) ? ' · animated' : ''}</small></button>`).join('');
      if (tab === 'looks') h = `<h3 class="ps-h">Patterns</h3>` + PATTERNS.map((x) => tile(x.id, x.name, x.p, x.r || 'c', { none: '⬜', spots: '🟤', stripes: '〰️', sparkle: '✨', pt_hearts: '💗', pt_stars: '⭐', pt_rainbow: '🌈', pt_galaxy: '🌌' }[x.id], D.pattern === x.id, own(x.id), 'data-pt="1"')).join('')
        + `<h3 class="ps-h">Colours</h3><div class="ps-row"><label>Body <input type="color" id="ps-col-b" value="${esc((p.colors && p.colors.body) || '#ffffff')}"></label><label>Accent <input type="color" id="ps-col-a" value="${esc((p.colors && p.colors.accent) || '#ffffff')}"></label></div><p class="small">More accessories are in the Jewelry & Accessories tab.</p>`;
      if (tab === 'pals') h = `<h3 class="ps-h">Rare Pals ✨</h3><p class="small">Turn ${esc(p.name)} into a rare version. Rare looks are clearly marked and cost more Star Coins.</p>`
        + `<button class="ps-tile ${!D.variant ? 'on' : ''}" data-rv=""><span class="ps-emo">🐾</span><b>Normal</b><small>Free</small></button>` + RARES.map((r) => tile(r.id, r.name + ' ' + (SPECIES.find((s) => s.id === p.species) || {}).name, r.p, r.r, { rare_shiny: '💠', rare_glow: '🌟', rare_galaxy: '🌌', rare_gold: '🏆', rare_crystal: '💎' }[r.id], D.variant === r.id, own(r.id), 'data-rv="1"')).join('')
        + `<h3 class="ps-h">More Pals</h3><p class="small">You can have up to 6 Pals and switch which one is on your profile. Every species can be hatched for free.</p><a class="btn btn-sm" href="#pals">🥚 Hatch or switch Pals</a>`;
      if (tab === 'dances') h = `<p>Dance moves live in the Dance Shop.</p><button class="btn" id="ps-dshop">💃 Open the Dance Shop</button>`;
      g.innerHTML = h;
      g.querySelectorAll('[data-slot]').forEach((b) => b.onclick = () => { snap(); const s = b.dataset.slot, id = b.dataset.id; if (D.outfit[s] === id) delete D.outfit[s]; else { D.outfit[s] = id; if (s === 'full') { delete D.outfit.body; delete D.outfit.bottom; } if (s === 'body' || s === 'bottom') delete D.outfit.full; } refresh(); });
      g.querySelectorAll('[data-bg]').forEach((b) => { const q = b.querySelector('canvas'); if (q) drawBg(q.getContext('2d'), 96, 64, b.dataset.bg, 0); b.onclick = () => { snap(); D.bg = b.dataset.bg; refresh(); }; });
      g.querySelectorAll('[data-pt]').forEach((b) => b.onclick = () => { snap(); D.pattern = b.dataset.id; refresh(); });
      g.querySelectorAll('[data-rv]').forEach((b) => b.onclick = () => { snap(); D.variant = b.dataset.rv ? b.dataset.id : ''; refresh(); });
      const cb = $('#ps-col-b'), ca = $('#ps-col-a'); if (cb) { cb.oninput = () => { p.colors = { ...p.colors, body: cb.value }; }; ca.oninput = () => { p.colors = { ...p.colors, accent: ca.value }; }; }
      const ds = $('#ps-dshop'); if (ds) ds.onclick = () => dispatchEvent(new Event('kemy:dance-shop'));
    }
    function setTab(k) { tab = k; main.querySelectorAll('[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === k); b.setAttribute('aria-selected', b.dataset.tab === k); }); slot = 'all'; filters(); grid(); }
    main.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => setTab(b.dataset.tab));
    $('#ps-bgbtn').onclick = () => { setTab('bgs'); $('#ps-grid').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('#ps-undo').onclick = () => { if (!hist.length) return toast('Nothing to undo'); D = JSON.parse(hist.pop()); refresh(); };
    $('#ps-reset').onclick = () => { snap(); D = saved(); refresh(); toast('Back to your saved look'); };
    $('#ps-rand').onclick = () => { snap(); const o = {}; for (const s of ['head', 'hair', 'face', 'neck', 'feet', 'held']) if (Math.random() < 0.6) { const l = WEAR.filter((w) => w.slot === s && w.free); o[s] = l[Math.floor(Math.random() * l.length)].id; }
      const fl = WEAR.filter((w) => w.slot === 'full' && w.free); if (Math.random() < 0.5) o.full = fl[Math.floor(Math.random() * fl.length)].id; else for (const s of ['body', 'bottom']) { const l = WEAR.filter((w) => w.slot === s && w.free); o[s] = l[Math.floor(Math.random() * l.length)].id; }
      D.outfit = o; const fb = BGS.filter((b) => !b.p); D.bg = fb[Math.floor(Math.random() * fb.length)].id; refresh(); };
    async function save() {
      const u = unowned(); const cost = u.reduce((a, b) => a + (b.p || 0), 0);
      if (u.length) { const coins = (e.w && e.w.coins) || 0; if (coins < cost) return toast(`You need ★${cost} to buy ${u.length} item${u.length > 1 ? 's' : ''} (you have ★${coins}). Earn coins by caring, playing and daily bonuses!`);
        const ok = await new Promise((res) => { openModal(`<h3>Buy and save?</h3><ul>${u.map((x) => `<li>${esc(x.name)} · ★${x.p}</li>`).join('')}</ul><p>Total: <b>★${cost}</b> Star Coins (no real money).</p><div class="row"><button class="btn" id="ps-yes">Buy & Save</button><button class="btn btn-ghost" id="ps-no">Not now</button></div>`); document.getElementById('ps-yes').onclick = () => { closeModal(); res(true); }; document.getElementById('ps-no').onclick = () => { closeModal(); res(false); }; });
        if (!ok) return;
        for (const x of u) { try { await e.buy(x.id); inv[x.id] = 1; } catch (er) { toast(er.code ? friendlyError(er) : er.message || 'Purchase failed'); return; } }
        $('#ps-c').textContent = e.w.coins; }
      try { await commit(p, { outfit: D.outfit, bg: D.bg, variant: D.variant, pattern: D.pattern, colors: p.colors }); toast(`${p.name}'s look is saved ✨`); dispatchEvent(new Event('kemy:pal-changed')); refresh(); } catch (er) { toast(friendlyError(er)); }
    }
    $('#ps-save').onclick = save;
    // 3 saved look slots
    async function looks() { let L = []; try { L = await e.looks(); } catch {} const el = $('#ps-looks');
      el.innerHTML = ['l1', 'l2', 'l3'].map((id, i) => { const l = L.find((x) => x.id === id); return `<span class="ps-look"><button class="chip" data-load="${id}" ${l ? '' : 'disabled'}>${l ? esc(l.name) : 'Look ' + (i + 1)}</button><button class="chip" data-store="${id}" aria-label="Save to look ${i + 1}">⤓</button></span>`; }).join('');
      el.querySelectorAll('[data-load]').forEach((b) => b.onclick = () => { const l = L.find((x) => x.id === b.dataset.load); if (!l) return; snap(); D = { outfit: { ...l.outfit }, bg: l.bg || '', variant: l.variant || '', pattern: l.pattern || 'none' }; refresh(); toast(`Trying on ${l.name}. Tap Save Look to keep it.`); });
      el.querySelectorAll('[data-store]').forEach((b) => b.onclick = async () => { try { const i = b.dataset.store.slice(1); await e.saveLook(b.dataset.store, 'Look ' + i, D.outfit, { bg: D.bg, variant: D.variant, pattern: D.pattern }); toast(`Saved to Look ${i}`); looks(); } catch (er) { toast(friendlyError(er)); } }); }
    looks(); setTab(location.hash.includes('store-bg') ? 'bgs' : 'outfits'); refresh();
  }
  return { page };
}
