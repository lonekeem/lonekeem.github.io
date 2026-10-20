// Shared one-tap purchase sheet (Pal Store, Dance Shop, rare Pals, zombie Armory…).
// Usage:
//   import { openBuySheet } from './buy-sheet.js';
//   const ok = await openBuySheet({ name: 'Crown', price: 400, icon: '👑', balance: 120,
//     buy: async () => { await econ.buy(id); return econ.w.coins; },   // returns the new balance (or nothing)
//     onSuccess: () => equip(id), earn: [{ label: 'Daily visit bonus', href: '#/pals/shop' }] });
// Shows: 'Buy X for ★N?' with the current balance, a big Buy button, success feedback (auto-closes),
// and when coins are short: how many more are needed plus ways to earn them. Star Coins only.
const CSS = `.bs-ov{position:fixed;inset:0;z-index:9000;background:rgba(8,4,20,.55);display:flex;align-items:flex-end;justify-content:center;animation:bsf .18s}
.bs{width:min(480px,100%);background:#1b1233;color:#fff;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.45);animation:bsu .22s ease-out;font:500 16px Inter,system-ui,sans-serif;text-align:center}
.bs-ic{font-size:44px;line-height:1.1}.bs-ic canvas{width:96px;height:96px;border-radius:16px;background:#2a1d4d}
.bs h3{margin:6px 0 4px;font-size:20px}.bs .bs-bal{display:inline-flex;gap:6px;align-items:center;background:#2a1d4d;border-radius:999px;padding:6px 14px;margin:6px 0 12px;font-weight:700}
.bs .bs-bal b{color:#ffd34d}.bs-btn{display:block;width:100%;min-height:54px;border:0;border-radius:16px;font:700 18px Inter,system-ui,sans-serif;margin-top:10px;cursor:pointer}
.bs-buy{background:linear-gradient(135deg,#8a55dc,#c06cf0);color:#fff}.bs-buy:disabled{opacity:.6}.bs-no{background:transparent;color:#cbbcf0;border:1px solid #4a3a7a}
.bs-need{color:#ffb31a;font-weight:700}.bs-earn{list-style:none;padding:0;margin:8px 0 0;text-align:left}.bs-earn li{margin:6px 0}.bs-earn a{display:flex;align-items:center;min-height:46px;padding:0 14px;border-radius:12px;background:#2a1d4d;color:#fff;text-decoration:none;font-weight:600}
.bs-ok{font-size:56px;animation:bsp .4s}.bs small{color:#b9a8e6}
@keyframes bsu{from{transform:translateY(40px);opacity:0}}@keyframes bsf{from{opacity:0}}@keyframes bsp{0%{transform:scale(.3)}70%{transform:scale(1.2)}}`;
function css() { if (document.getElementById('bs-css')) return; const s = document.createElement('style'); s.id = 'bs-css'; s.textContent = CSS; document.head.appendChild(s); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const DEFAULT_EARN = [{ label: '🎁 Daily visit bonus', href: '#/pals/shop' }, { label: '🫧 Care for your Pal', href: '#/pals' }, { label: '🎮 Play and win games', href: '#/games' }, { label: '🌳 Find treasures in Pal Park', href: '#/pals/park' }];
// coin badge for page headers: coinBadge(n) -> html
export const coinBadge = (n, id = '') => `<span class="ps-coins" ${id ? `id="${id}"` : ''} style="min-height:40px;display:inline-flex;align-items:center;gap:4px;padding:0 14px;border-radius:999px;background:#2a1d4d;color:#ffd34d;font-weight:800">★ <b>${Number(n || 0).toLocaleString()}</b></span>`;
// big buy button html: buyButton({ name, price, balance })
export const buyButton = ({ name, price, balance, id = 'bs-open' }) => { css(); return `<button type="button" class="bs-btn bs-buy" id="${id}" style="max-width:420px;margin:10px auto 0">Buy ${esc(name)} · ★${price}<small style="display:block;font-weight:600;color:#f1e6ff">You have ★${Number(balance || 0).toLocaleString()}</small></button>`; };

export function openBuySheet(o) {
  css(); const cur = o.currency || '★';
  return new Promise(async (resolve) => {
    let bal = typeof o.balance === 'function' ? await o.balance() : o.balance || 0; bal = Number(bal) || 0;
    const ov = document.createElement('div'); ov.className = 'bs-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    const sh = document.createElement('div'); sh.className = 'bs'; ov.appendChild(sh); document.body.appendChild(ov); import('./wallet-chip.js').then((m) => { if (ov.isConnected && m.walletState().uid) ov.appendChild(m.walletChip()); }).catch(() => {});
    let done = false; const close = (v) => { if (done) return; done = true; ov.remove(); resolve(v); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(false); });
    const icon = () => (o.icon instanceof HTMLCanvasElement ? '<div class="bs-ic" id="bs-ic"></div>' : `<div class="bs-ic">${esc(o.icon || '🛍️')}</div>`);
    const mountIcon = () => { const el = sh.querySelector('#bs-ic'); if (el) el.appendChild(o.icon); };
    const confirmView = () => { const short = o.price - bal;
      if (short > 0) { sh.innerHTML = `${icon()}<h3>${esc(o.name)} · ${cur}${o.price}</h3><div class="bs-bal">You have <b>${cur}${bal.toLocaleString()}</b></div>
        <p class="bs-need">You need ${cur}${short.toLocaleString()} more</p><small>Star Coins are free, earn them by:</small>
        <ul class="bs-earn">${(o.earn || DEFAULT_EARN).map((w) => `<li><a href="${esc(w.href)}" data-earn>${esc(w.label)}</a></li>`).join('')}</ul><button class="bs-btn bs-no" id="bs-no">OK</button>`;
        mountIcon(); sh.querySelectorAll('[data-earn]').forEach((a) => a.onclick = () => close(false)); sh.querySelector('#bs-no').onclick = () => close(false); return; }
      sh.innerHTML = `${icon()}<h3>Buy ${esc(o.name)} for ${cur}${o.price}?</h3><div class="bs-bal">You have <b>${cur}${bal.toLocaleString()}</b> → ${cur}${(bal - o.price).toLocaleString()} after</div>
        ${o.note ? `<p><small>${esc(o.note)}</small></p>` : ''}<button class="bs-btn bs-buy" id="bs-yes">Buy for ${cur}${o.price}</button><button class="bs-btn bs-no" id="bs-no">Not now</button>`;
      mountIcon(); sh.querySelector('#bs-no').onclick = () => close(false);
      const yes = sh.querySelector('#bs-yes'); yes.focus();
      yes.onclick = async () => { yes.disabled = true; yes.textContent = 'Buying…';
        try { const nb = await o.buy(); if (typeof nb === 'number') bal = nb; else bal -= o.price;
          try { o.onSuccess && (await o.onSuccess()); } catch { /* equip failure shouldn't hide the purchase */ }
          sh.innerHTML = `<div class="bs-ok">🎉</div><h3>You got ${esc(o.name)}!</h3><div class="bs-bal">Balance <b>${cur}${bal.toLocaleString()}</b></div><small>${esc(o.equipped || 'Equipped ✓')}</small><button class="bs-btn bs-buy" id="bs-done">Yay!</button>`;
          try { o.sound && o.sound(); } catch { /* */ }
          sh.querySelector('#bs-done').onclick = () => close(true); setTimeout(() => close(true), 2200);
        } catch (er) { yes.disabled = false; yes.textContent = `Buy for ${cur}${o.price}`; const m = document.createElement('p'); m.className = 'bs-need'; m.textContent = (er && er.message) || 'Purchase failed. Try again.'; sh.insertBefore(m, yes); } };
    };
    confirmView();
  });
}
