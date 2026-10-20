// 'Get Stars & Diamonds' shop overlay (purple/black Kemy style, kid-safe, no ads).
// Opened by tapping the wallet chip ('Get more' tab) or any element with [data-coinshop].
// Purchases go through js/billing.js; coins are never credited client-side.
import { PACKS, status, priceOf, buy } from './billing.js';
import { walletState } from './wallet-chip.js';
const CSS = `.cs-ov{position:fixed;inset:0;z-index:9500;background:rgba(8,3,18,.82);display:flex;align-items:flex-end;justify-content:center;font-family:Inter,system-ui,sans-serif}
.cs-box{background:#140a28;color:#fff;width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:16px 14px calc(env(safe-area-inset-bottom) + 18px);border:1px solid #5b2a8a}
.cs-hd{display:flex;align-items:center;gap:8px}.cs-hd h2{margin:0;font-size:1.2rem;flex:1;color:#fff}
.cs-x{background:#2a1450;color:#fff;border:0;border-radius:999px;width:34px;height:34px;font-size:18px}
.cs-tabs{display:flex;gap:6px;margin:12px 0}.cs-tabs button{flex:1;border:1px solid #7a3fc0;background:#1f0f3c;color:#e9dcff;border-radius:999px;padding:8px;font-weight:700}
.cs-tabs button.on{background:#e9dcff;color:#000}
.cs-bal{background:#e9dcff;color:#000;border-radius:14px;padding:8px 12px;font-weight:700;margin-bottom:10px}
.cs-sec{color:#e9dcff;font-size:1rem;margin:14px 2px 8px}
.cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
.cs-p{position:relative;background:#f3ecff;color:#000;border-radius:16px;padding:12px 10px;text-align:center}
.cs-p .em{font-size:28px}.cs-p b{display:block;font-size:1.1rem}.cs-p small{color:#3b1c66;font-weight:700}
.cs-tag{position:absolute;top:-7px;right:8px;background:#7a3fc0;color:#fff;font-size:11px;border-radius:999px;padding:2px 8px;font-weight:800}
.cs-soon{position:absolute;top:-7px;left:8px;background:#000;color:#ffd34d;font-size:11px;border-radius:999px;padding:2px 8px;font-weight:800}
.cs-buy{margin-top:8px;width:100%;border:0;border-radius:999px;padding:9px;background:#5b2a8a;color:#fff;font-weight:800;font-size:1rem}
.cs-buy:disabled{background:#c9b8e6;color:#3b3050}
.cs-note{background:#2a1450;color:#e9dcff;border-radius:14px;padding:10px 12px;font-size:.85rem;margin-top:14px}
.cs-links a{display:block;background:#f3ecff;color:#000;border-radius:14px;padding:12px;margin:8px 0;text-decoration:none;font-weight:700}
.cs-gate{background:#f3ecff;color:#000;border-radius:16px;padding:14px;margin-top:10px}.cs-gate input{width:100%;font-size:1.1rem;padding:8px;border-radius:10px;border:1px solid #7a3fc0;margin:8px 0;box-sizing:border-box}`;
const em = (c) => (c === 'star' ? '⭐' : '💎'); const nm = (c) => (c === 'star' ? 'Star Coins' : 'Diamonds');
function css() { if (document.getElementById('cs-css')) return; const s = document.createElement('style'); s.id = 'cs-css'; s.textContent = CSS; document.head.appendChild(s); }
function shopHref() { return /^#\/(park|street)|zombie|armory/.test(location.hash) ? '#/pals/shop' : '#/pals/store'; }
export async function openCoinShop(tab = 'get') {
  css(); document.querySelector('.cs-ov')?.remove();
  const ov = document.createElement('div'); ov.className = 'cs-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Get Stars and Diamonds');
  ov.innerHTML = `<div class="cs-box"><div class="cs-hd"><h2>⭐ Get Stars &amp; 💎 Diamonds</h2><button class="cs-x" aria-label="Close">✕</button></div>
    <div class="cs-tabs"><button data-t="spend">🛍️ Shops</button><button data-t="get">➕ Get more</button></div><div class="cs-body"></div></div>`;
  document.body.appendChild(ov); const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); }; ov.querySelector('.cs-x').onclick = close;
  const body = ov.querySelector('.cs-body'); const st = await status().catch(() => ({ ready: false }));
  const show = (t) => { ov.querySelectorAll('.cs-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); t === 'spend' ? spend() : get(); };
  ov.querySelectorAll('.cs-tabs button').forEach((b) => b.onclick = () => show(b.dataset.t));
  function spend() { body.innerHTML = `<div class="cs-links"><a href="${shopHref()}" data-x>🛍️ Pal Shop &amp; Store</a><a href="#/pals/shop" data-x>🍎 Food &amp; treats</a><a href="#/games" data-x>🎮 Play games to earn ⭐</a><a href="#/pals/park" data-x>🌳 Find treasures in Pal Park</a></div>`;
    body.querySelectorAll('[data-x]').forEach((a) => a.onclick = close); }
  function get() { const w = walletState();
    const card = (p) => `<div class="cs-p">${p.tag ? `<span class="cs-tag">${p.tag}</span>` : ''}${st.ready ? '' : '<span class="cs-soon">Coming soon</span>'}<div class="em">${em(p.cur)}</div><b>${(p.amount + p.bonus).toLocaleString()}</b><small>${p.bonus ? `${p.amount.toLocaleString()} + ${p.bonus.toLocaleString()} bonus` : nm(p.cur)}</small><button class="cs-buy" data-id="${p.id}" ${st.ready ? '' : 'disabled'}>${priceOf(p)}</button></div>`;
    body.innerHTML = `<div class="cs-bal">Your wallet: ⭐ ${w.admin ? '∞' : (w.c ?? 0).toLocaleString()} · 💎 ${w.admin ? '∞' : (w.d ?? 0).toLocaleString()}</div>
      <h3 class="cs-sec">⭐ Star Coins</h3><div class="cs-grid">${PACKS.filter((p) => p.cur === 'star').map(card).join('')}</div>
      <h3 class="cs-sec">💎 Diamonds</h3><div class="cs-grid">${PACKS.filter((p) => p.cur === 'diamond').map(card).join('')}</div>
      <div class="cs-note">${st.ready ? '' : '🔒 Buying is coming soon. '}A grown-up must say yes before any purchase. You can always earn ⭐ for free by playing games and caring for your Pal.</div>`;
    body.querySelectorAll('.cs-buy').forEach((b) => b.onclick = () => gate(PACKS.find((p) => p.id === b.dataset.id))); }
  function gate(p) { const a = 12 + Math.floor(Math.random() * 8), b = 6 + Math.floor(Math.random() * 7);
    body.insertAdjacentHTML('beforeend', `<div class="cs-gate"><b>👪 Grown-ups only</b><p>Buying ${(p.amount + p.bonus).toLocaleString()} ${em(p.cur)} for ${priceOf(p)}. Please ask a parent. What is ${a} × ${b}?</p><input inputmode="numeric" aria-label="Answer"><button class="cs-buy">Continue</button></div>`);
    const g = body.lastElementChild; g.scrollIntoView({ block: 'center' });
    g.querySelector('.cs-buy').onclick = async () => { if (Number(g.querySelector('input').value) !== a * b) { g.querySelector('p').textContent = 'That is not right. Please ask a grown-up.'; return; }
      try { const r = await buy(p, walletState().uid); g.innerHTML = r.ok ? '<b>Thanks! Your purchase is being checked. It will appear in your wallet soon.</b>' : '<b>Buying is coming soon.</b>'; } catch (e) { g.innerHTML = '<b>Purchase cancelled.</b>'; } }; }
  show(tab);
}
document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-coinshop]'); if (t) { e.preventDefault(); openCoinShop(t.dataset.coinshop || 'get'); } });
window.kemyCoinShop = openCoinShop;
