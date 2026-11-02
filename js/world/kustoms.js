// 🔧 Kemy Kustoms garage (lazy-loaded the first time it opens). Pick one of your cars, try paint, rims, spoilers,
// decals, underglow, window tint and horns on a turning 3D preview, buy with ⭐ Star Coins or 💎 Diamonds
// (in-game only, no real money), save the look per car. Works with touch, controllers (focus-nav: d-pad/stick
// moves the highlight, A/✕ selects, B/○ goes back, LB/RB switch tabs) and keyboard. Original art only.
// The preview has its own small renderer that only exists while the garage is open. Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { CAR, PAINTS, buildCar, carMats } from './cars.js';
import { KK, normLook, lookNeeds, applyKustom, playHorn, registerKustomItems, tickKustoms } from './kustom-look.js';
import { makeSky, envFromSky } from '../gfx.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TABS = [['paint', '🎨 Paint'], ['rim', '🛞 Wheels'], ['spoiler', '🪽 Spoiler'], ['decal', '⚡ Decals'], ['glow', '💡 Underglow'], ['tint', '🕶️ Tint'], ['horn', '📯 Horn']];
const PAINT_NAMES = ['Cherry', 'Grape', 'Ocean', 'Teal', 'Amber', 'Lime Green', 'Bubblegum', 'Snow', 'Charcoal', 'Sunshine', 'Sky', 'Kiwi'];
let cssDone = false;
function css() { if (cssDone) return; cssDone = true; const s = document.createElement('style'); s.textContent = `
.kk-ov .kk-card{box-sizing:border-box;background:#21173f;color:#fff;border-radius:20px;padding:12px;width:min(820px,98vw);max-height:94vh;overflow:auto;display:grid;gap:8px;font:600 13px Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.kk-ov h3{margin:0;font-size:18px}.kk-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.kk-top .kk-w{margin-left:auto;background:rgba(255,255,255,.1);border-radius:999px;padding:4px 10px;font-weight:800}
.kk-body{display:grid;gap:8px}.kk-body>*{min-width:0}@media (min-aspect-ratio:4/3){.kk-body{grid-template-columns:1.05fr 1fr}}
.kk-pv{position:relative;border-radius:14px;overflow:hidden;background:#140d2b;min-height:180px;aspect-ratio:16/10;max-height:36vh;width:100%}@media (min-aspect-ratio:4/3){.kk-pv{max-height:none}}.kk-pv canvas{width:100%;height:100%;display:block;touch-action:none}
.kk-pv .kk-rot{position:absolute;bottom:6px;display:flex;gap:6px;left:6px}.kk-rot button{min-width:40px;min-height:36px}
.kk-ov button{font:800 13px Inter,system-ui,sans-serif;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:#3b2a75;color:#fff;padding:7px 10px;cursor:pointer;min-height:38px}
.kk-ov button:focus-visible,.kk-ov button:focus{outline:3px solid #ffd23f;outline-offset:2px}.kk-ov button.on{border-color:#ffd23f;background:#5b3fb0}.kk-ov button.ghost{background:transparent}
.kk-cars,.kk-tabs{display:flex;gap:6px;overflow-x:auto;padding:2px}.kk-cars button,.kk-tabs button{flex:0 0 auto}
.kk-opts{max-height:34vh;overflow:auto;padding:2px;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:6px;align-content:start}.kk-opts button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
.kk-opts small{font-weight:700;opacity:.85}.kk-opts .sw{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.6);display:inline-block}
.kk-msg{min-height:18px;color:#ffd23f}.kk-act{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;align-items:center}.kk-act .grow{flex:1;min-width:120px}
.kk-hint{opacity:.8;font-size:12px}.kk-hint .kg-b{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;margin:0 2px;color:#fff;text-align:center}`; document.head.appendChild(s); }

// ctx: { cars: [{id,color}], startId, getLook(id), saveLook(id, look, color), loadShop(): {inv, econ, dia}, say, LOW, onClose }
export async function openKustoms(ctx) { css(); registerKustomItems().catch(() => {});
  const cars = ctx.cars.filter((c) => CAR[c.id]); if (!cars.length) { ctx.say && ctx.say('Get a car in 🚗 My Cars first!'); return null; }
  let carId = cars.some((c) => c.id === ctx.startId) ? ctx.startId : cars[0].id; let color = 0, look = null, tab = 'paint', confirmId = '', busy = false, msg = '';
  let inv = {}, econ = null, dia = null, coins = null, gems = null;
  const load = (id) => { carId = id; const c = cars.find((x) => x.id === id); color = c.color ?? CAR[id].color; look = normLook(ctx.getLook(id)); confirmId = ''; msg = ''; };
  load(carId);
  const el = document.createElement('div'); el.className = 'ks-panel kk-ov'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Kemy Kustoms garage'); (ctx.host || document.body).appendChild(el);
  // ------------------------------------------------ preview renderer (own small context; disposed on close)
  el.innerHTML = `<div class="kk-card"><div class="kk-top"><h3>🔧 Kemy Kustoms</h3><span class="kk-w">…</span></div><div class="kk-body"><div class="kk-pv"><canvas></canvas><div class="kk-rot"><button type="button" data-rot="-1" aria-label="Turn left">⟲</button><button type="button" data-rot="1" aria-label="Turn right">⟳</button></div></div><div class="kk-side"></div></div></div>`;
  const cv = el.querySelector('canvas'); const LOW = !!ctx.LOW;
  const R = new THREE.WebGLRenderer({ canvas: cv, antialias: !LOW, powerPreference: 'low-power' }); R.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1 : 1.5)); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a1236'); const camP = new THREE.PerspectiveCamera(34, 1.6, 0.1, 100);
  try { const sky = makeSky({ top: '#3b2a75', hor: '#c4b5fd', ground: '#2a1d55', cloud: 0.2 }); scene.environment = envFromSky(R, sky); } catch { /* lights only */ }
  scene.add(new THREE.HemisphereLight('#e9d5ff', '#2a1d55', 1.1)); const sun = new THREE.DirectionalLight('#ffffff', 2.2); sun.position.set(4, 7, 5); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2b1f5a', roughness: 0.7 })); scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.0, 4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); ring.position.y = 0.005; scene.add(ring);
  let car = null, yaw = 0.7, spinV = 0.35, drag = null, raf = 0, last = performance.now(), alive = true;
  const rebuild = () => { if (car) scene.remove(car); car = buildCar(CAR[carId], color, { noShadow: true }); car.userData.chassis.position.y = 0.06; scene.add(car); car.userData.kkKey = undefined; applyKustom(car, look, carMats); frame(); };
  const frame = () => { const d = CAR[carId]; const t = Math.tan(THREE.MathUtils.degToRad(camP.fov / 2)) * Math.min(camP.aspect, 1.9); const dist = Math.max((d.L * 0.56) / (t * 0.72), (d.H * 0.9) / (Math.tan(THREE.MathUtils.degToRad(camP.fov / 2)) * 0.8)); camP.position.set(0, d.H * 0.9 + dist * 0.32, dist); camP.lookAt(0, d.H * 0.42, 0); };
  const refreshLook = () => { if (car) applyKustom(car, look, carMats); };
  rebuild();
  const size = () => { const w = cv.clientWidth || 320, h = cv.clientHeight || 200; R.setSize(w, h, false); camP.aspect = w / h; camP.updateProjectionMatrix(); if (car) frame(); };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(size) : null; if (ro) ro.observe(cv); size();
  const loop = (now) => { if (!alive) return; raf = requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now; if (!drag) yaw += spinV * dt; if (car) car.rotation.y = yaw; tickKustoms(now); R.render(scene, camP); };
  raf = requestAnimationFrame(loop);
  cv.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y0: yaw }; try { cv.setPointerCapture(e.pointerId); } catch { /* */ } });
  cv.addEventListener('pointermove', (e) => { if (drag) yaw = drag.y0 + (e.clientX - drag.x) * 0.012; });
  const endDrag = () => { drag = null; }; cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  // ------------------------------------------------ shop state
  const owns = (o) => !o || !o.id || !!inv[o.id];
  const price = (o) => (o.p ? `⭐ ${o.p}` : o.d ? `💎 ${o.d}` : 'Free');
  async function shop(force) { try { const s = await ctx.loadShop(force); inv = s.inv || {}; econ = s.econ; dia = s.dia;
      const [w, g] = await Promise.all([econ ? econ.wallet().catch(() => null) : null, dia ? dia.get().catch(() => null) : null]); coins = w ? w.coins : null; gems = g ? g.d : null; } catch { /* offline: free items still work */ } paintTop(); paintSide(); }
  const fmt = (n) => (n == null ? '…' : n === Infinity ? '∞' : n);
  const paintTop = () => { el.querySelector('.kk-w').textContent = `⭐ ${fmt(coins)} · 💎 ${fmt(gems)}`; };
  let padHint = '';
  import('../input/gamepad-ui.js').then((g) => { import('../input.js').then((i) => { const d = i.device(); if (d === 'touch') return; const f = d === 'ps' ? 'ps' : 'xbox';
    padHint = d === 'keyboard' ? 'Arrows move · Enter selects · Esc goes back' : `${g.badge('dpad', f)} move ${g.badge('a', f)} select ${g.badge('b', f)} back ${g.badge('lb', f)}${g.badge('rb', f)} tabs`; paintSide(); }); }).catch(() => {});
  function optHTML(part, o, i) { const sel = part === 'paint' ? false : look[part] === i; const lock = owns(o) ? '' : ' 🔒'; const sw = o.hex ? `<span class="sw" style="background:${o.hex}"></span>` : '';
    return `<button type="button" data-part="${part}" data-i="${i}" class="${sel ? 'on' : ''}" aria-pressed="${sel}">${sw}<b>${esc(o.n)}${lock}</b><small>${owns(o) && o.id ? '✓ Owned' : price(o)}</small></button>`; }
  function paintSide() { const side = el.querySelector('.kk-side'); if (!side) return; const focusKey = document.activeElement && el.contains(document.activeElement) ? keyOf(document.activeElement) : '';
    let opts = '';
    if (tab === 'paint') { opts = PAINTS.map((hx, i) => { const sel = !look.paint && color === i; return `<button type="button" data-preset="${i}" class="${sel ? 'on' : ''}" aria-pressed="${sel}"><span class="sw" style="background:${hx}"></span><b>${PAINT_NAMES[i]}</b><small>Free</small></button>`; }).join('')
        + KK.paint.slice(1).map((o, j) => { const i = j + 1; const sel = look.paint === i; return optHTML('paint', o, i).replace(/class="[^"]*"/, `class="${sel ? 'on' : ''}"`); }).join('')
        + KK.metal.map((o, i) => optHTML('metal', o, i).replace('<b>', '<b>✨ ')).join(''); }
    else opts = KK[tab].map((o, i) => optHTML(tab, o, i)).join('');
    const need = lookNeeds(look).filter((o) => !owns(o)); const cur = need[0];
    const act = cur ? `<span class="grow">🔒 ${esc(cur.n)} isn’t yours yet.</span><button type="button" data-buy="${cur.id}">${confirmId === cur.id ? 'Tap again to buy · ' : 'Buy · '}${price(cur)}</button>` : '<span class="grow">✓ Everything here is yours.</span>';
    side.innerHTML = `<div class="kk-cars" aria-label="Your cars">${cars.map((c) => `<button type="button" data-car="${c.id}" class="${c.id === carId ? 'on' : ''}">${CAR[c.id].emoji} ${esc(CAR[c.id].name)}</button>`).join('')}</div>
      <div class="kk-tabs" role="tablist">${TABS.map(([k, n]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="kk-opts">${opts}</div><div class="kk-msg" role="status">${esc(msg)}</div>
      <div class="kk-act">${act}</div><div class="kk-act"><button type="button" class="ghost" data-reset>↺ Stock look</button><button type="button" class="ghost" data-close>Close</button><button type="button" data-save>💾 Save look</button></div>
      <div class="kk-hint">${padHint}</div>`;
    if (focusKey) { const n = [...side.querySelectorAll('button')].find((b) => keyOf(b) === focusKey); if (n) n.focus(); } }
  const keyOf = (b) => ['car', 'tab', 'part', 'i', 'preset', 'buy', 'rot'].map((k) => b.dataset[k] ?? '').join('|') + (b.dataset.save !== undefined ? 's' : '') + (b.dataset.reset !== undefined ? 'r' : '') + (b.dataset.close !== undefined ? 'c' : '');
  paintTop(); paintSide(); shop(false);
  function close() { if (!alive) return; alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); try { R.dispose(); R.forceContextLoss(); } catch { /* */ } el.remove(); if (ctx.onClose) ctx.onClose(); }
  el.addEventListener('click', async (e) => { const b = e.target.closest('button'); if (e.target === el) { close(); return; } if (!b || busy) return;
    if (b.dataset.close !== undefined) { close(); return; }
    if (b.dataset.rot) { yaw += +b.dataset.rot * 0.6; spinV = 0; return; }
    if (b.dataset.car) { if (b.dataset.car !== carId) { load(b.dataset.car); rebuild(); } paintSide(); return; }
    if (b.dataset.tab) { tab = b.dataset.tab; confirmId = ''; paintSide(); const t = el.querySelector(`[data-tab="${tab}"]`); if (t) t.focus(); return; }
    if (b.dataset.preset) { color = +b.dataset.preset; look.paint = 0; rebuild(); msg = ''; paintSide(); return; }
    if (b.dataset.part) { const part = b.dataset.part, i = +b.dataset.i; look[part] = i; confirmId = ''; msg = ''; refreshLook(); if (part === 'horn') playHorn(i, () => playHorn(1)); paintSide(); return; }
    if (b.dataset.reset !== undefined) { look = normLook(null); refreshLook(); msg = 'Stock look (press Save to keep it).'; paintSide(); return; }
    if (b.dataset.buy) { const id = b.dataset.buy; const o = lookNeeds(look).find((x) => x.id === id); if (!o) return; if (confirmId !== id) { confirmId = id; paintSide(); return; }
      busy = true; b.disabled = true; b.textContent = 'Buying…';
      try { if (!econ || !dia) await shop(true); if (o.p) await econ.buy(id); else await dia.buy(id); inv[id] = 1; msg = `🎉 ${o.n} is yours! It works on all your cars.`; confirmId = ''; await shop(true); inv[id] = 1; }
      catch (er) { msg = er && er.code === 'permission-denied' ? 'The Kustoms shop isn’t open yet (prices not published). Try again soon!' : (er && er.message) || 'Could not buy right now.'; confirmId = ''; }
      busy = false; paintSide(); return; }
    if (b.dataset.save !== undefined) { const need = lookNeeds(look).filter((o) => !owns(o)); if (need.length) { msg = `Buy ${need.map((o) => o.n).join(', ')} first, or pick a free one.`; paintSide(); return; }
      ctx.saveLook(carId, look, color); const c = cars.find((x) => x.id === carId); if (c) c.color = color; msg = '💾 Saved! Everyone in Pal Park will see it.'; paintSide(); return; } });
  window.__kkApi = { el, close, state: () => ({ carId, color, look: { ...look }, tab, inv: { ...inv } }), pick: (part, i) => { look[part] = i; refreshLook(); paintSide(); }, tab: (t) => { tab = t; paintSide(); } };
  return { close, el };
}
