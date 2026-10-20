// Zombie Armory: weapons, upgrades and armor-style outfits for Pal Zombie Survival.
// Prices: Diamonds (💎, earned in the game) or Star Coins (★). Both are checked server-side by firestore.rules
// against config/palShop (prices / dprices), which the Admin page's "Publish shop prices" button writes.
// Diamonds live in users/{uid}/pal/diamonds; owned items are users/{uid}/inv/z_* (same inventory as the Pal Store).
import { doc, getDoc, setDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { addItems, addDiamondItems, DITEMS, dayNo } from './catalog.js';
import { createEconomy, isAdminUid } from './economy.js';
export const ARMORY = [
  { id: 'z_foam', kind: 'zweapon', name: 'Foam Launcher', icon: '🧽', d: 80, desc: 'Bouncy foam balls that splash 3 zombies.' },
  { id: 'z_bubble', kind: 'zweapon', name: 'Bubble Cannon', icon: '🫧', d: 150, desc: 'Big slow bubbles that float zombies away.' },
  { id: 'z_freeze', kind: 'zweapon', name: 'Freeze Ray', icon: '❄️', p: 120, desc: 'A frosty beam that turns zombies into popsicles.' },
  { id: 'z_star', kind: 'zweapon', name: 'Star Bomb', icon: '🌟', d: 200, desc: 'Toss it: a sparkly boom clears the crowd.' },
  { id: 'z_dmg', kind: 'zup', name: 'Power Goo', icon: '💪', d: 180, desc: '+25% damage for every weapon.' },
  { id: 'z_hp', kind: 'zup', name: 'Extra Hearts', icon: '💖', d: 120, desc: '+30 max health.' },
  { id: 'z_speed', kind: 'zup', name: 'Zoomy Shoes', icon: '👟', p: 90, desc: 'Run 15% faster.' },
  { id: 'z_ammo', kind: 'zup', name: 'Big Tanks', icon: '🛢️', d: 100, desc: '+50% ammo per tank, faster refills.' },
  { id: 'z_arm_card', kind: 'zarmor', name: 'Cardboard Knight', icon: '📦', d: 150, armor: 0.12, col: '#8fb0ff', desc: 'Painted box armor + a paper helmet. −12% damage.' },
  { id: 'z_arm_rain', kind: 'zarmor', name: 'Goo-Proof Raincoat', icon: '🧥', p: 160, armor: 0.12, col: '#ffd23f', desc: 'Shiny yellow coat. −12% damage.' },
  { id: 'z_arm_astro', kind: 'zarmor', name: 'Space Suit', icon: '🧑‍🚀', d: 300, armor: 0.2, col: '#e8ecf5', desc: 'Puffy suit + bubble visor. −20% damage.' },
  { id: 'z_arm_pillow', kind: 'zarmor', name: 'Pillow Fort Armor', icon: '🛏️', d: 450, armor: 0.28, col: '#b48cff', desc: 'Soft pillow plates. −28% damage.' }
];
export const ARM = Object.fromEntries(ARMORY.map((a) => [a.id, a]));
addItems(ARMORY.filter((a) => a.p).map((a) => ({ id: a.id, name: a.name, kind: a.kind, p: a.p, r: 'r' })));
addDiamondItems(ARMORY.filter((a) => a.d).map((a) => ({ id: a.id, name: a.name, kind: a.kind, d: a.d })));
export const RUN_CAP = 250, DAY_CAP = 1500; // mirrored in firestore.rules
const EQ = 'kemy-z-armor';
export const equippedArmor = () => { try { return localStorage.getItem(EQ) || ''; } catch { return ''; } };
export const setArmor = (id) => { try { localStorage.setItem(EQ, id || ''); } catch { /* */ } };
// Diamonds wallet
export function createDiamonds(db, uid) {
  const ref = doc(db, 'users', uid, 'pal', 'diamonds'); let w = null, last = 0;
  async function get(force) { if (w && !force) return w; const s = await getDoc(ref);
    if (!s.exists()) { await setDoc(ref, { d: 0, total: 0, day: dayNo(), today: 0, last: serverTimestamp(), lastBuy: '', paid: 0, buyAt: serverTimestamp(), updatedAt: serverTimestamp() }); w = { d: 0, total: 0, day: dayNo(), today: 0 }; last = Date.now(); }
    else { w = s.data(); last = w.last && w.last.toMillis ? w.last.toMillis() : 0; }
    if (isAdminUid(uid)) w = { ...w, d: Infinity, admin: true }; return w; }
  // one reward per finished run; clamps to the per-run + per-day caps; waits out the 45 s gap if needed
  async function earnRun(n) { await get(true); if (w.admin) return 0; const today = w.day === dayNo() ? w.today : 0; const amt = Math.max(0, Math.min(Math.round(n), RUN_CAP, DAY_CAP - today)); if (!amt) return 0;
    const wait = 46000 - (Date.now() - last); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const next = { d: w.d + amt, total: w.total + amt, day: dayNo(), today: today + amt, last: serverTimestamp(), updatedAt: serverTimestamp() };
    const b = writeBatch(db); b.update(ref, next); await b.commit(); Object.assign(w, next); last = Date.now(); return amt; }
  async function buy(id) { const it = ARM[id] || DITEMS.find((x) => x.id === id); await get(true); // Armory + premium dances (z_dn_*), Halloween costumes (z_hw_*)
    if (!it || !it.d) throw new Error('That item can’t be bought with Diamonds.'); if (w.d < it.d) throw new Error('Not enough Diamonds yet. Play a run to earn more!');
    if (w.admin) { const b = writeBatch(db); b.update(ref, { lastBuy: id, paid: 0, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
      b.set(doc(db, 'users', uid, 'inv', id), { n: 1, at: serverTimestamp() }); await b.commit(); return 0; }
    const b = writeBatch(db); b.update(ref, { d: w.d - it.d, lastBuy: id, paid: it.d, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
    b.set(doc(db, 'users', uid, 'inv', id), { n: 1, at: serverTimestamp() }); await b.commit(); w.d -= it.d; return it.d; }
  return { get, earnRun, buy, get w() { return w; } };
}
const CSS = `.za{max-width:720px;margin:0 auto;padding:12px}.za-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.za-top h2{margin:0;flex:1}.za-bal{font-weight:800;font-size:1.1rem;background:#2b1d55;color:#fff;border-radius:99px;padding:6px 14px}
.za-tabs{display:flex;gap:8px;margin:12px 0;overflow-x:auto}.za-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.za-it{border-radius:16px;background:var(--card,#fff);box-shadow:0 2px 10px rgba(0,0,0,.12);padding:12px;text-align:center;min-height:150px;border:3px solid transparent;cursor:pointer}.za-it.sel{border-color:#8a55dc}
.za-it .ic{font-size:44px}.za-it b{display:block;margin:4px 0}.za-it .pr{font-weight:800}.za-own{color:#2a9d5b;font-weight:800}
.za-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1000;background:#2b1d55;color:#fff;border-radius:22px 22px 0 0;padding:18px 18px max(18px,env(safe-area-inset-bottom));box-shadow:0 -8px 30px rgba(0,0,0,.4);animation:zaUp .2s ease-out}
@keyframes zaUp{from{transform:translateY(100%)}}.za-sheet .ic{font-size:64px;text-align:center}.za-sheet h3{margin:4px 0;text-align:center}.za-sheet p{text-align:center;opacity:.85;margin:4px 0 12px}
.za-buy{width:100%;min-height:60px;border:0;border-radius:16px;font-size:1.25rem;font-weight:800;background:#ffd23f;color:#2b1d55}.za-buy[disabled]{opacity:.5}.za-x{width:100%;min-height:48px;margin-top:8px;border:0;border-radius:14px;background:transparent;color:#fff;font-weight:700}`;
export function createArmory(ctx) {
  const { S, db, esc, toast, requireAuth } = ctx;
  async function page(main) {
    if (!requireAuth()) return;
    if (!document.getElementById('za-css')) { const s = document.createElement('style'); s.id = 'za-css'; s.textContent = CSS; document.head.appendChild(s); }
    const uid = S.user.uid, econ = createEconomy(db, uid), dia = createDiamonds(db, uid);
    let inv = {}, coins = 0, dias = 0, tab = 'zweapon';
    const refresh = async () => { try { const [w, d, i] = await Promise.all([econ.wallet(true), dia.get(true), econ.inventory(true)]); coins = w.coins; dias = d.d; inv = i; } catch (e) { console.warn('armory', e.code || e.message); } };
    await refresh();
    const render = () => {
      main.innerHTML = `<section class="za"><div class="za-top"><h2>🛡️ Zombie Armory</h2><span class="za-bal">💎 ${dias.toLocaleString()} · ★ ${coins.toLocaleString()}</span></div>
        <p class="muted small">Tap an item to preview it. Earn 💎 Diamonds by surviving waves in Pal Zombie Survival.</p>
        <div class="za-tabs">${[['zweapon', '🔫 Weapons'], ['zup', '⬆️ Upgrades'], ['zarmor', '🛡️ Armor']].map(([k, n]) => `<button class="chip${k === tab ? ' on' : ''}" data-tab="${k}">${n}</button>`).join('')}</div>
        <div class="za-grid">${ARMORY.filter((a) => a.kind === tab).map((a) => `<div class="za-it" data-id="${a.id}" role="button" tabindex="0"><div class="ic">${a.icon}</div><b>${esc(a.name)}</b>${inv[a.id] ? `<span class="za-own">${a.kind === 'zarmor' && equippedArmor() === a.id ? 'Wearing ✓' : 'Owned ✓'}</span>` : `<span class="pr">${a.d ? '💎 ' + a.d : '★ ' + a.p}</span>`}</div>`).join('')}</div>
        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><a class="btn" href="#/arcade/zombie">🧟 Play Pal Zombie Survival</a><a class="btn btn-ghost" href="#/arcade">🎮 Arcade</a></div></section>`;
      main.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
      main.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => sheet(ARM[b.dataset.id])));
    };
    function sheet(it) {
      document.querySelector('.za-sheet')?.remove(); main.querySelectorAll('.za-it').forEach((e) => e.classList.toggle('sel', e.dataset.id === it.id));
      const owned = !!inv[it.id], cur = it.d ? '💎' : '★', price = it.d || it.p, bal = it.d ? dias : coins, can = bal >= price;
      const d = document.createElement('div'); d.className = 'za-sheet'; d.setAttribute('role', 'dialog');
      d.innerHTML = `<div class="ic">${it.icon}</div><h3>${esc(it.name)}</h3><p>${esc(it.desc)}</p>
        ${owned ? (it.kind === 'zarmor' ? `<button class="za-buy" data-eq>${equippedArmor() === it.id ? 'Take off' : 'Wear it'}</button>` : '<button class="za-buy" disabled>Owned ✓</button>')
          : `<button class="za-buy" data-buy ${can ? '' : 'disabled'}>Buy · ${cur} ${price}</button><p class="small" style="margin-top:8px">You have ${cur} ${bal}${can ? ` · after: ${cur} ${bal - price}` : ` · need ${price - bal} more`}</p>`}
        <button class="za-x" data-close>Close</button>`;
      document.body.appendChild(d);
      d.querySelector('[data-close]').onclick = () => d.remove();
      d.querySelector('[data-eq]')?.addEventListener('click', () => { setArmor(equippedArmor() === it.id ? '' : it.id); d.remove(); render(); });
      const bb = d.querySelector('[data-buy]');
      if (bb) bb.onclick = async () => { d.remove(); // shared one-tap buy sheet (confirm, success, auto-equip)
        const { openBuySheet } = await import('../buy-sheet.js');
        const ok = await openBuySheet({ name: it.name, price, icon: it.icon, balance: bal, currency: cur, note: it.desc,
          equipped: it.kind === 'zarmor' ? 'Wearing it now ✓' : 'Ready for your next run ✓',
          earn: it.d ? [{ label: '🧟 Play Pal Zombie Survival', href: '#/arcade/zombie' }] : undefined,
          buy: async () => { try { if (it.d) await dia.buy(it.id); else await econ.buy(it.id); } catch (e) { throw new Error(e.code === 'permission-denied' ? 'The Armory isn’t open yet (prices not published). Try again later.' : e.message || 'Could not buy'); } return bal - price; },
          onSuccess: () => { if (it.kind === 'zarmor') setArmor(it.id); } });
        if (ok) { await refresh(); render(); } };
    }
    render();
  }
  return { page };
}
