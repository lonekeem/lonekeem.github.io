// Weapon Shop for Pal Zombie Survival. Splat coins only. Written by Lone Keem.
import {
  WEAPON_LIST, WEAPONS, RARITY_LABEL, RARITY_ORDER, MAX_WEAPON_LEVEL,
  loadProgress, acknowledge, isOwned, levelOf, usableLoadout, statBars, tagsOf,
  upgradeCost, buyWeapon, upgradeWeapon, equipToSlot, weaponSvg, coinPacksForSale
} from './zombie-weapons.js';

const CSS = `
.zw-ov{position:fixed;inset:0;z-index:1200;background:#140c28;color:#1a1030;font-family:system-ui,sans-serif;display:flex;flex-direction:column;min-height:0}
.zw-top{display:flex;align-items:center;gap:8px;padding:max(10px,env(safe-area-inset-top)) 12px 8px;background:#241244;color:#fff}
.zw-top h2{margin:0;font-size:1.25rem;flex:1;line-height:1.2}
.zw-bal{background:#ffd23f;color:#241244;font-weight:800;border-radius:999px;padding:6px 12px;white-space:nowrap}
.zw-x{min-width:44px;min-height:44px;border:0;border-radius:999px;background:#3a246e;color:#fff;font-size:18px;font-weight:800}
.zw-note{margin:0;padding:0 12px 8px;background:#241244;color:#f3e9ff;font-size:.92rem}
.zw-filters{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:#1b1038}
.zw-filters button{flex:0 0 auto;min-height:40px;border:0;border-radius:999px;padding:0 12px;font-weight:800;background:#3a246e;color:#fff}
.zw-filters button.on{background:#ffd23f;color:#241244}
.zw-grid{flex:1;overflow:auto;padding:10px 12px 12px;display:grid;grid-template-columns:1fr;gap:10px;align-content:start}
.zw-card{display:grid;grid-template-columns:92px 1fr;gap:8px;text-align:left;background:#f7f2ff;color:#1a1030;border:3px solid transparent;border-radius:16px;padding:8px;min-height:92px;box-shadow:0 2px 0 #0002;width:100%;font:inherit;cursor:pointer}
.zw-card.on{border-color:#ffd23f}
.zw-card b{display:block;font-size:1rem}
.zw-art{grid-row:span 4;background:#efe6ff;border-radius:12px;display:flex;align-items:center;justify-content:center;min-height:76px}
.zw-svg{width:100%;height:64px}
.zw-card.legend .zw-art,.zw-card.mythic .zw-art{animation:zwGlow 1.6s ease-in-out infinite}
@keyframes zwGlow{50%{filter:drop-shadow(0 0 6px #ffd23f)}}
@media (prefers-reduced-motion:reduce){.zw-card.legend .zw-art,.zw-card.mythic .zw-art{animation:none}}
.zw-badge{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;padding:2px 8px;margin-right:4px}
.zw-r-common{background:#d9d3ef;color:#1a1030}
.zw-r-uncommon{background:#7ee08a;color:#12331c}
.zw-r-rare{background:#8fd8ff;color:#102838}
.zw-r-epic{background:#e0b0ff;color:#2a1048}
.zw-r-legendary{background:#ffd23f;color:#2b1d55}
.zw-r-mythic{background:linear-gradient(90deg,#b48cff,#ffd23f);color:#1a1030}
.zw-tags{color:#3d2a66;font-size:.8rem;font-weight:700}
.zw-price{font-weight:800}
.zw-own{color:#1c7a45}
.zw-dock{display:flex;gap:8px;align-items:center;padding:8px 12px calc(8px + env(safe-area-inset-bottom));background:#241244;color:#fff}
.zw-dock b{font-size:.85rem}
.zw-slot{min-width:52px;min-height:48px;border-radius:14px;border:2px solid rgba(255,255,255,.45);background:#3a246e;color:#fff;font-size:20px;font-weight:800}
.zw-slot.on{border-color:#ffd23f;background:#5a3d96}
.zw-slot small{display:block;font-size:10px;font-weight:800}
.zw-sheet{position:absolute;left:0;right:0;bottom:0;z-index:2;background:#f7f2ff;color:#1a1030;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom));box-shadow:0 -10px 30px #0008;max-height:min(78vh,640px);overflow:auto}
.zw-sheet h3{margin:4px 0;text-align:center;font-size:1.35rem}
.zw-sheet .zw-art{width:min(100%,280px);margin:0 auto 8px;min-height:88px}
.zw-sheet p{margin:4px 0 8px;text-align:center}
.zw-pips{display:flex;gap:6px;justify-content:center;margin:6px 0}
.zw-pips i{width:18px;height:10px;border-radius:99px;background:#ddd3ef;display:block}
.zw-pips i.on{background:#6d35c4}
.zw-bar{display:grid;grid-template-columns:76px 1fr auto;gap:6px;align-items:center;margin:5px 0;font-size:.85rem;font-weight:700}
.zw-bar span{height:12px;background:#efe6ff;border-radius:99px;overflow:hidden;border:1px solid #d9cef0}
.zw-bar i{display:block;height:100%;background:#6d35c4}
.zw-acts{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.zw-acts button{min-height:52px;border:0;border-radius:14px;font-size:1.05rem;font-weight:800}
.zw-buy{background:#ffd23f;color:#241244}
.zw-eq{background:#3d2378;color:#fff}
.zw-up{background:#1f8a70;color:#fff}
.zw-acts button[disabled]{background:#d9d0ea;color:#2e2940}
.zw-close{background:transparent;color:#241244}
.zw-foot{text-align:center;color:#d9ccf5;font-size:.8rem;padding:4px 8px 8px}
.zw-packs{display:none}
@media (min-width:720px){
  .zw-grid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));padding:14px}
  .zw-sheet{left:50%;right:auto;width:min(480px,92vw);transform:translateX(-50%);bottom:16px;border-radius:22px}
}`;

function escHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function ensureCss() {
  if (document.getElementById('zw-css')) return;
  const s = document.createElement('style'); s.id = 'zw-css'; s.textContent = CSS; document.head.appendChild(s);
}

export function openWeaponShop(opts = {}) {
  ensureCss();
  const host = document.createElement('div');
  host.className = 'zw-ov';
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Weapon shop');
  (opts.parent || document.body).appendChild(host);
  const api = mount(host, opts);
  host._zwClose = api.detach;
  return host;
}

function mount(host, opts) {
  const uid = opts.uid || 'guest';
  const inv = opts.inv || {};
  const esc = opts.esc || escHtml;
  let filter = 'all';
  let slot = 0;
  let openId = opts.focus || '';
  let note = '';
  acknowledge(uid, inv);

  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (openId) { openId = ''; paint(); return; }
    close();
  };
  document.addEventListener('keydown', onKey);
  function detach() { document.removeEventListener('keydown', onKey); host.remove(); }
  function close() { detach(); opts.onClose && opts.onClose(); }

  function paint() {
    const prog = acknowledge(uid, inv);
    const loadout = usableLoadout(prog, inv);
    const y = host.querySelector('.zw-grid')?.scrollTop || 0;
    const list = WEAPON_LIST.filter((w) => {
      if (filter === 'owned') return isOwned(prog, w.id, inv);
      if (filter === 'all') return true;
      return w.rarity === filter;
    });
    host.innerHTML = `<div class="zw-top"><button type="button" class="zw-x" data-x aria-label="Close shop">✕</button><h2>🛒 Weapon Shop</h2><div class="zw-bal" aria-live="polite">🪙 ${prog.coins.toLocaleString()}</div></div>
      <p class="zw-note">Earn splat coins by splatting zombies and clearing waves. Free guns are enough to play.</p>
      <div class="zw-filters" role="tablist">${[['all', 'All'], ['owned', 'Owned'], ...RARITY_ORDER.map((k) => [k, RARITY_LABEL[k]])].map(([k, n]) => `<button type="button" data-f="${k}" class="${filter === k ? 'on' : ''}" aria-pressed="${filter === k}">${n}</button>`).join('')}</div>
      <div class="zw-grid">${list.map((w) => card(w, prog)).join('') || '<p class="zw-note">No guns in this filter yet.</p>'}</div>
      <div class="zw-dock" aria-label="Loadout"><b>Loadout</b>${loadout.map((id, i) => { const w = WEAPONS[id]; return `<button type="button" class="zw-slot${i === slot ? ' on' : ''}" data-slot="${i}" aria-label="Loadout slot ${i + 1} ${w ? w.name : ''}">${w ? w.icon : '·'}<small>${i + 1}</small></button>`; }).join('')}</div>
      <p class="zw-foot">Tap a slot, then Equip. During a run, tap a gun or press 1 2 3. Written by Lone Keem.</p>`;
    const grid = host.querySelector('.zw-grid'); if (grid) grid.scrollTop = y;
    host.querySelector('[data-x]').onclick = close;
    host.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; openId = ''; paint(); }));
    host.querySelectorAll('[data-slot]').forEach((b) => (b.onclick = () => { slot = +b.dataset.slot; paint(); }));
    host.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => { openId = b.dataset.id; note = ''; paint(); }));
    if (openId && WEAPONS[openId]) sheet(prog, loadout);
  }

  function card(w, prog) {
    const owned = isOwned(prog, w.id, inv);
    const lvl = owned ? levelOf(prog, w.id) : 1;
    const price = owned ? `<span class="zw-own">Owned${lvl > 1 ? ' · Lv ' + lvl : ''}</span>` : `<span class="zw-price">${w.price ? '🪙 ' + w.price.toLocaleString() : 'Free'}</span>`;
    const tags = tagsOf(w).slice(0, 3).join(' · ');
    return `<button type="button" class="zw-card ${w.skin || ''} ${w.rarity}${openId === w.id ? ' on' : ''}" data-id="${w.id}"><div class="zw-art">${weaponSvg(w)}</div><div><span class="zw-badge zw-r-${w.rarity}">${RARITY_LABEL[w.rarity]}</span></div><b>${esc(w.name)}</b><div class="zw-tags">${esc(tags)}</div><div>${price}</div></button>`;
  }

  function sheet(prog, loadout) {
    const w = WEAPONS[openId];
    const owned = isOwned(prog, w.id, inv);
    const lvl = owned ? levelOf(prog, w.id) : 1;
    const bars = statBars(w, lvl);
    const cost = upgradeCost(w, lvl);
    const inSlot = loadout.indexOf(w.id);
    const d = document.createElement('div');
    d.className = 'zw-sheet';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', w.name);
    const buyLabel = owned ? '' : (prog.coins >= w.price ? `Buy · 🪙 ${w.price.toLocaleString()}` : `Need 🪙 ${(w.price - prog.coins).toLocaleString()} more`);
    const upLabel = !owned ? '' : (lvl >= MAX_WEAPON_LEVEL ? 'Max level' : `Upgrade to Lv ${lvl + 1} · 🪙 ${cost.toLocaleString()}`);
    d.innerHTML = `<div class="zw-art">${weaponSvg(w)}</div><div style="text-align:center"><span class="zw-badge zw-r-${w.rarity}">${RARITY_LABEL[w.rarity]}</span></div><h3>${esc(w.name)}</h3><p>${esc(w.blurb)}</p><p class="zw-tags">${esc(tagsOf(w).join(' · ') || 'Steady shot')}</p>
      <div class="zw-pips" aria-label="Upgrade level ${lvl} of ${MAX_WEAPON_LEVEL}">${Array.from({ length: MAX_WEAPON_LEVEL }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
      ${bars.map((b) => `<div class="zw-bar"><b>${b.k}</b><span><i style="width:${b.pct}%"></i></span><em>${esc(String(b.v))}</em></div>`).join('')}
      ${note ? `<p><b>${esc(note)}</b></p>` : ''}
      <div class="zw-acts">
        ${owned ? '' : `<button type="button" class="zw-buy" data-buy ${prog.coins >= w.price ? '' : 'disabled'}>${buyLabel}</button>`}
        ${owned && lvl < MAX_WEAPON_LEVEL ? `<button type="button" class="zw-up" data-up ${prog.coins >= cost ? '' : 'disabled'}>${upLabel}</button>` : ''}
        ${owned && lvl >= MAX_WEAPON_LEVEL ? `<button type="button" class="zw-up" disabled>Max level</button>` : ''}
        ${owned ? `<button type="button" class="zw-eq" data-eq>${inSlot === slot ? 'Equipped in slot ' + (slot + 1) : inSlot >= 0 ? 'Move to slot ' + (slot + 1) : 'Equip to slot ' + (slot + 1)}</button>` : ''}
        <button type="button" class="zw-close" data-close>Close</button>
      </div>`;
    host.appendChild(d);
    d.querySelector('[data-close]').onclick = () => { openId = ''; note = ''; paint(); };
    const bb = d.querySelector('[data-buy]');
    if (bb) bb.onclick = () => { const r = buyWeapon(uid, w.id, inv); note = r.ok ? 'Added to your armory.' : r.reason === 'coins' ? 'Splat more zombies to earn the rest.' : 'Already yours.'; if (r.ok) opts.onChange && opts.onChange(r.prog); paint(); };
    const ub = d.querySelector('[data-up]');
    if (ub && !ub.disabled) ub.onclick = () => { const r = upgradeWeapon(uid, w.id, inv); note = r.ok ? 'Upgraded!' : 'Need a few more splat coins.'; if (r.ok) opts.onChange && opts.onChange(r.prog); paint(); };
    const eb = d.querySelector('[data-eq]');
    if (eb) eb.onclick = () => { const r = equipToSlot(uid, w.id, slot, inv); note = r.ok ? 'Ready in slot ' + (slot + 1) + '.' : 'Not unlocked yet.'; if (r.ok) opts.onChange && opts.onChange(r.prog); paint(); };
  }

  coinPacksForSale(); // empty until a parent gate and a verified purchase exist; never drawn
  paint();
  return { close, detach, refresh: paint };
}
