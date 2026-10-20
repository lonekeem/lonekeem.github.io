// Kemy World property: buy a house on a "For Sale" plot (one owner each, any town), add a garage (1-3 bays),
// go inside furnished interiors (living room, kitchen, bedroom; built only when you walk in), drive into your own
// garage (the roll-up door opens for the owner and closes after), "Park here" saves the car in that bay, your last
// spot + a car left on the street are remembered (localStorage + a throttled private Firestore doc).
// Purchases use the existing validated coin / diamond shop paths; firestore.rules check deed + owner. Written by Lone Keem.
import { doc, getDoc, setDoc, onSnapshot, collection, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { HOUSES, HOUSE_BY_ID, HOME_STYLES, GARAGES, FLAT, ROOMS, roomState, worldClamp } from './layout.js';
import { CAR, buildCar, poseCar } from './cars.js';

const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export async function registerHomeItems() { const cat = await import('../pals/catalog.js'); const all = [...HOME_STYLES, ...GARAGES];
  cat.addItems(all.filter((x) => x.p).map((x) => ({ id: x.item, name: x.name, kind: 'home', p: x.p, r: 'r' })));
  cat.addDiamondItems(all.filter((x) => x.d).map((x) => ({ id: x.item, name: x.name, kind: 'home', d: x.d, productId: x.productId }))); }
const price = (x) => (x.d ? `💎${x.d}` : `⭐${x.p}`);
export const roomCell = (h) => ({ cx: ROOMS.x0 + 7 + (h.i % 8) * ROOMS.cell, cz: ROOMS.z0 + 7 + Math.floor(h.i / 8) * ROOMS.cell });
const Lw = (h, lx, lz) => [h.x + (h.face > 0 ? lx : -lx), h.z + (h.face > 0 ? lz : -lz)];
const BAYX = [3.7, -3.7];

export function attachHomes(api, W, K) {
  const { THREE, scene, Q, LOW, box, P, S, db, view } = api; const ground = api.ground; const { put, flush, G, std } = K;
  const uid = S.user && S.user.uid; const root = new THREE.Group(); root.name = 'kemy-homes'; scene.add(root); const D = W.drive;
  const owners = new Map(); let myPlot = null, myTier = 0, inside = null, econ = null, dia = null, snapOk = false;
  const LS = 'kemy-world-save-' + (uid || 'anon'); let save = (() => { try { return JSON.parse(lsg(LS) || 'null') || {}; } catch { return {}; } })(); save.cars = save.cars || [];
  const say = (t) => (W.say ? W.say(t) : api.toast && api.toast(t));
  async function shop() { if (!econ) { const [{ createEconomy }, { createDiamonds }] = await Promise.all([import('../pals/economy.js'), import('../pals/armory.js')]); await registerHomeItems(); econ = createEconomy(db, uid); dia = createDiamonds(db, uid); } return { econ, dia }; }

  // ---------------------------------------------------------------- HUD: Go home button, second action button, panel
  const css = document.createElement('style'); css.textContent = `.kh-home{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 76px);top:calc(max(8px,env(safe-area-inset-top)) + 180px);pointer-events:auto;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(43,29,85,.75);color:#fff;font:800 14px Inter,sans-serif;padding:0 12px}
.kh-in{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(16px,env(safe-area-inset-bottom)) + 150px);pointer-events:auto;height:44px;border-radius:999px;border:2px solid #fff;background:#0f766e;color:#fff;font:800 15px Inter,sans-serif;padding:0 18px;z-index:8}.kh-in[hidden],.kh-p[hidden]{display:none}
.kh-p{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,30,.55);pointer-events:auto;z-index:30}.kh-c{background:#fff;color:#111;border-radius:18px;padding:16px;width:min(92vw,380px);max-height:80vh;overflow:auto;font:500 14px Inter,sans-serif}
.kh-c h3{margin:0 0 6px;font:800 18px Inter,sans-serif;color:#111}.kh-c button{margin:6px 6px 0 0;border:0;border-radius:12px;padding:10px 14px;font:800 14px Inter,sans-serif;background:#6d28d9;color:#fff}.kh-c button.g{background:#e5e7eb;color:#111}.kh-c .row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;color:#111}.kh-c small{color:#444}
@media (orientation:landscape) and (max-height:500px){.kh-home{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 300px)}.kh-in{bottom:110px}}`;
  document.head.appendChild(css);
  const homeB = document.createElement('button'); homeB.className = 'kh-home'; homeB.textContent = '🏠 Home'; const inB = document.createElement('button'); inB.className = 'kh-in'; inB.hidden = true;
  const pan = document.createElement('div'); pan.className = 'kh-p'; pan.hidden = true; pan.innerHTML = '<div class="kh-c"></div>'; const card = pan.firstChild;
  pan.onclick = (e) => { if (e.target === pan) pan.hidden = true; }; const host = W.hud || view; host.append(homeB, inB, pan);
  function panel(html, wire) { card.innerHTML = html + '<div><button class="g" data-x>Close</button></div>'; card.querySelector('[data-x]').onclick = () => (pan.hidden = true); pan.hidden = false; if (wire) wire(card); }
  const busy = (b, t) => { b.disabled = true; b.textContent = t; };

  // ---------------------------------------------------------------- signs: For Sale / owner nameplate (canvas, redrawn on change)
  const signs = new Map();
  for (const h of HOUSES) if (h.sale) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); g.position.set(sx, FLAT, sz); g.rotation.y = h.face > 0 ? 0 : Math.PI;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), std('#f8fafc')); post.position.y = 0.95; const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); bd.position.set(0, 1.55, 0.08); g.add(post, bd); root.add(g); signs.set(h.id, { cv, tex, g }); }
  function drawSign(h) { const s = signs.get(h.id); if (!s) return; const o = owners.get(h.id); const g = s.cv.getContext('2d'); const st = HOME_STYLES[h.style];
    g.fillStyle = o ? '#4c1d95' : '#ea580c'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120); g.fillStyle = '#fff'; g.textAlign = 'center';
    if (o) { g.font = 'bold 26px system-ui,sans-serif'; g.fillText('🏠 ' + (o.name || 'A Pal').slice(0, 14), 128, 56); g.font = '20px system-ui,sans-serif'; g.fillText(o.owner === uid ? 'Your home!' : 'Home sweet home', 128, 96); }
    else { g.font = 'bold 34px system-ui,sans-serif'; g.fillText('FOR SALE', 128, 50); g.font = 'bold 22px system-ui,sans-serif'; g.fillText(st.name + ' ' + price(st), 128, 96); } s.tex.needsUpdate = true; }
  HOUSES.forEach(drawSign);

  // ---------------------------------------------------------------- garages (only for owned plots with a garage tier)
  const garages = new Map(); // plot -> { g, bays:[{door, col, x, z, yaw, open, carM}], tier }
  const gMat = std('#f1f5f9', { r: 0.7 }), dMat = std('#cbd5e1', { r: 0.5, m: 0.3 }), rMat = std('#475569', { r: 0.6 });
  function buildGarage(h, tier) { dropGarage(h.id); if (!tier) return; const g = new THREE.Group(); root.add(g); const bays = []; const ry = h.face > 0 ? 0 : Math.PI;
    for (let k = 0; k < Math.min(tier, 2); k++) { const lx = BAYX[k], lz0 = h.d / 2 + 0.1, dep = 5.3; const [cx, cz] = Lw(h, lx, lz0 + dep / 2);
      const bg = new THREE.Group(); bg.position.set(cx, FLAT, cz); bg.rotation.y = ry; g.add(bg);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, dep), gMat); w.position.set(s * 1.85, 1.35, 0); w.castShadow = !LOW; bg.add(w); }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, dep + 0.3), rMat); roof.position.y = 2.8; bg.add(roof); const hdr = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.45, 0.3), gMat); hdr.position.set(0, 2.5, dep / 2); bg.add(hdr);
      const door = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.3, 0.07), dMat); door.position.set(0, 1.15, dep / 2 - 0.05); bg.add(door); for (let i = 1; i < 6; i++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.03, 0.02), rMat); ln.position.set(0, -1.15 + i * 0.38, 0.045); door.add(ln); }
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.2), std('#fff7d6', { e: '#fff3c4', ei: 1 })); lamp.position.set(0, 2.62, dep / 2 + 0.2); bg.add(lamp);
      // colliders (world space): two side walls + the door (disabled when open)
      const cols = []; for (const s of [-1, 1]) { const [wx, wz] = Lw(h, lx + s * 1.85, lz0 + dep / 2); const vert = true; void vert; cols.push({ x0: wx - 0.12, x1: wx + 0.12, z0: wz - dep / 2, z1: wz + dep / 2, top: 99, bot: -99 }); }
      const [dx, dz] = Lw(h, lx, lz0 + dep - 0.05); const dcol = { x0: dx - 1.75, x1: dx + 1.75, z0: dz - 0.08, z1: dz + 0.08, top: 99, bot: -99 }; cols.push(dcol); cols.forEach((c) => box.push(c));
      const yaw = h.face > 0 ? Math.PI : 0; // a car parked nose-in faces the house
      bays.push({ k, door, dcol, cols, open: 0, cx, cz, yaw, front: Lw(h, lx, lz0 + dep + 1.6), carM: null }); }
    if (tier >= 3) { const [cx, cz] = Lw(h, 0, 13.1); const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 5.6), std('#fff', { r: 0.6 })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 2; m.position.set(cx, FLAT + 0.05, cz); m.material.transparent = true; m.material.opacity = 0.35; g.add(m);
      bays.push({ k: 2, curb: true, cx, cz, yaw: Math.PI / 2, front: [cx, cz + (h.face > 0 ? -3 : 3)], carM: null, open: 1 }); }
    garages.set(h.id, { g, bays, tier, h }); showParked(); }
  function dropGarage(id) { const G0 = garages.get(id); if (!G0) return; root.remove(G0.g); for (const b of G0.bays) { (b.cols || []).forEach((c) => { const i = box.indexOf(c); if (i >= 0) box.splice(i, 1); }); if (b.carM) root.remove(b.carM); } garages.delete(id); }
  function showParked() { const G0 = myPlot && garages.get(myPlot); if (!G0) return; for (const b of G0.bays) { const c = save.cars.find((q) => q && q.bay === b.k); if (b.carM && (!c || b.carM.userData.key !== c.id + c.c)) { root.remove(b.carM); b.carM = null; }
      if (c && !b.carM && CAR[c.id]) { b.carM = buildCar(CAR[c.id], c.c || 0, { lite: true, noShadow: LOW }); b.carM.userData.key = c.id + c.c; poseCar(b.carM, { x: b.cx, y: FLAT, z: b.cz, yaw: b.curb ? b.yaw : (c.yaw ?? b.yaw) }, 0, 0); root.add(b.carM); } } }

  // ---------------------------------------------------------------- interiors (built on first entry, kept after)
  const rooms = new Map(); let roomLight = null;
  function buildRoom(h) { if (rooms.has(h.id)) return rooms.get(h.id); const { cx, cz } = roomCell(h); const g = new THREE.Group(); root.add(g); const y = FLAT; const k = 'rm' + h.id; const R5 = (a) => Math.abs(Math.sin(h.seed * 9.1 + a));
    const wallC = ['#fde7c7', '#e0f2fe', '#fce7f3', '#ecfccb', '#ede9fe'][h.seed % 5], floorC = ['#b07a4a', '#c08b5c', '#9c6b43'][h.seed % 3];
    const B = (c, x, yy, z, sx, sy, sz, ry = 0, solid = 0, sh = 'box') => { put(k, G[sh], c, cx + x, y + yy, cz + z, ry, sx, sy, sz); if (solid) box.push({ x0: cx + x - sx / 2, x1: cx + x + sx / 2, z0: cz + z - sz / 2, z1: cz + z + sz / 2, top: solid === 2 ? y + yy + sy / 2 : 99, bot: -99 }); };
    B(floorC, 0, -0.05, 0, 12.4, 0.1, 12.4); for (let i = -5; i <= 5; i++) B('#8a5a34', i * 1.1, 0.005, 0, 0.03, 0.01, 12.2);
    for (const [x, z, sx, sz] of [[0, -6.1, 12.4, 0.2], [-6.1, 0, 0.2, 12.4], [6.1, 0, 0.2, 12.4], [-3.6, 6.1, 5.2, 0.2], [3.6, 6.1, 5.2, 0.2]]) B(wallC, x, 1.6, z, sx, 3.2, sz, 0, 1);
    B(wallC, 0, 2.85, 6.1, 2, 0.7, 0.2); B('#7c4a2a', 0, 1.1, 6.15, 1.4, 2.2, 0.08); B('#22c55e', 0, 2.45, 6.0, 0.9, 0.22, 0.04); // exit door + green sign
    B(wallC, 1.0, 1.6, -3.1, 0.18, 3.2, 6.0, 0, 1); B(wallC, 3.9, 1.6, -0.1, 4.4, 3.2, 0.18, 0, 1); // bedroom walls (doorway at x 1..1.7)
    // living room (front-left): rug, sofa, coffee table, TV, lamp, plant, bookshelf
    B('#7c3aed', -3, 0.01, 2.6, 4.2, 0.02, 3); B('#2563eb', -3, 0.3, 4.9, 3.2, 0.5, 1.0, 0, 2); B('#1d4ed8', -3, 0.8, 5.35, 3.2, 0.7, 0.25); for (const s of [-1, 1]) B('#1d4ed8', -3 + s * 1.55, 0.55, 4.9, 0.25, 0.6, 1.0);
    B('#a16207', -3, 0.25, 2.8, 1.6, 0.08, 0.9, 0, 2); B('#78350f', -3, 0.12, 2.8, 1.4, 0.24, 0.7); B('#3f3f46', -3, 0.35, 0.3, 2.4, 0.7, 0.5, 0, 1); B('#111827', -3, 1.25, 0.25, 2.2, 1.1, 0.08);
    B('#6b4a2f', -5.6, 1.0, 3.2, 0.6, 2.0, 1.8, 0, 1); for (let i = 0; i < 4; i++) B(['#ef4444', '#3b82f6', '#22c55e', '#f59e0b'][i], -5.45, 0.3 + i * 0.48, 3.2, 0.3, 0.36, 1.5);
    B('#a16207', -5.4, 0.3, 5.4, 0.5, 0.6, 0.5, 0, 1, 'cyl'); B('#16a34a', -5.4, 1.0, 5.4, 0.9, 0.9, 0.9, 0, 0, 'sph');
    // kitchen (back-left): counters, stove, fridge, sink, table + chairs
    B('#f8fafc', -3.4, 0.45, -5.55, 5.0, 0.9, 0.8, 0, 1); B('#cbd5e1', -3.4, 0.92, -5.55, 5.0, 0.05, 0.85); B('#111827', -2.2, 0.95, -5.55, 0.9, 0.03, 0.6); for (const [a, b] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) B('#ef4444', -2.2 + a, 0.97, -5.55 + b, 0.22, 0.01, 0.22, 0, 0, 'cyl');
    B('#94a3b8', -4.2, 0.95, -5.5, 0.7, 0.05, 0.45); B('#e2e8f0', -5.6, 1.0, -5.5, 0.8, 2.0, 0.8, 0, 1); B('#94a3b8', -5.25, 1.2, -5.1, 0.04, 0.6, 0.04);
    B('#b45309', -3, 0.75, -2.6, 1.6, 0.08, 1.1, 0, 2); B('#78350f', -3, 0.37, -2.6, 0.12, 0.74, 0.12); for (const [a, b] of [[-1.1, 0], [1.1, 0], [0, -0.8], [0, 0.8]]) { B('#fbbf24', -3 + a, 0.45, -2.6 + b, 0.45, 0.06, 0.45); B('#fbbf24', -3 + a * 1.18, 0.75, -2.6 + b * 1.25, a ? 0.06 : 0.45, 0.6, a ? 0.45 : 0.06); }
    // bedroom (back-right): bed, nightstand + lamp, wardrobe, rug, picture
    B('#8b5e34', 4, 0.25, -4.2, 2.0, 0.5, 2.9, 0, 2); B('#f8fafc', 4, 0.56, -4.2, 1.9, 0.14, 2.8); B(['#ec4899', '#38bdf8', '#a3e635'][h.seed % 3], 4, 0.65, -3.8, 1.95, 0.08, 1.9); B('#ffffff', 4, 0.7, -5.25, 1.3, 0.14, 0.45); B('#8b5e34', 4, 0.8, -5.8, 2.0, 1.1, 0.12);
    B('#a16207', 5.5, 0.3, -5.5, 0.6, 0.6, 0.6, 0, 1); B('#fde68a', 5.5, 0.85, -5.5, 0.35, 0.4, 0.35, 0, 0, 'cyl'); B('#6b4a2f', 2.0, 1.1, -5.6, 1.6, 2.2, 0.7, 0, 1); B('#f472b6', 4, 0.01, -1.6, 2.2, 0.02, 1.2); B('#fef08a', 5.95, 1.9, -3, 0.04, 0.8, 1.1);
    // pictures + ceiling + lamp
    B('#f59e0b', -6.0, 1.9, 1.0, 0.04, 0.8, 1.2); B('#0ea5e9', 6.0, 1.9, 3, 0.04, 0.9, 1.4); B('#fffbeb', -3, 3.05, 2.5, 0.6, 0.08, 0.6);
    const m = flush(k, std('#fff', { vc: true, r: 0.8 }), true, g); void m; void R5;
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(12.4, 12.4), std(wallC, { r: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, y + 3.2, cz); g.add(ceil);
    // TV picture (canvas)
    { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); const gr = c.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, '#7c3aed'); gr.addColorStop(1, '#0ea5e9'); c.fillStyle = gr; c.fillRect(0, 0, 256, 128); c.fillStyle = '#fff'; c.font = 'bold 34px system-ui'; c.textAlign = 'center'; c.fillText('Kemy TV ⭐', 128, 76);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const tv = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.0), new THREE.MeshBasicMaterial({ map: t })); tv.position.set(cx - 3, y + 1.25, cz + 0.3); g.add(tv); }
    const r0 = { g, cx, cz }; rooms.set(h.id, r0); return r0; }
  const canEnter = (h) => !h.sale || (owners.get(h.id) && owners.get(h.id).owner === uid);
  function goIn(h) { if (!canEnter(h)) { say('🔒 Only the owner can go inside'); return; } if (D && D.mine && D.mine() && D.mine().state !== 'parked') return; const r = buildRoom(h); inside = h; roomState.box = { x0: r.cx - 5.6, x1: r.cx + 5.6, z0: r.cz - 5.6, z1: r.cz + 5.5 };
    P.x = r.cx; P.z = r.cz + 4.6; P.yaw = Math.PI; P.y = FLAT; if (!roomLight) { roomLight = new THREE.PointLight('#fff1d6', LOW ? 18 : 26, 16, 1.6); scene.add(roomLight); } roomLight.position.set(r.cx - 1, FLAT + 2.7, r.cz); roomLight.visible = true; say('🏠 Welcome in! Living room, kitchen and bedroom'); api.markDirty && api.markDirty(); }
  function goOut() { const h = inside; if (!h) return; inside = null; roomState.box = null; const [x, z] = Lw(h, 0, h.d / 2 + 3.2); P.x = x; P.z = z; P.yaw = h.face > 0 ? 0 : Math.PI; P.y = ground(x, z); if (roomLight) roomLight.visible = false; api.markDirty && api.markDirty(); }

  // ---------------------------------------------------------------- owners (live) + buying
  let unsub = null; if (uid && db) try { unsub = onSnapshot(collection(db, 'homes'), (qs) => { const prev = new Map(owners); owners.clear(); qs.forEach((d) => owners.set(d.id, d.data())); myPlot = null; myTier = 0;
      for (const [id, o] of owners) if (o.owner === uid) { myPlot = id; myTier = o.garage || 0; }
      for (const h of HOUSES) if (h.sale) { const a = prev.get(h.id), b = owners.get(h.id); if (JSON.stringify(a) !== JSON.stringify(b)) drawSign(h); const t = b ? b.garage || 0 : 0; const cur = garages.get(h.id); if ((cur ? cur.tier : 0) !== t) buildGarage(h, t); }
      if (!snapOk) { snapOk = true; firstSpawn(); } }, (e) => { console.warn('homes', e); if (!snapOk) { snapOk = true; firstSpawn(); } }); } catch (e) { console.warn(e); }
  async function buyHome(h, btn) { try { if (myPlot) throw new Error('You already own a home (one per player). Move out first to buy another.'); if (owners.has(h.id)) throw new Error('Someone just bought this one!');
      busy(btn, 'Buying…'); const st = HOME_STYLES[h.style]; const { econ: e, dia: d } = await shop(); const inv = await e.inventory(true); if (!inv[st.item]) { if (st.d) await d.buy(st.item); else await e.buy(st.item); }
      const b = writeBatch(db); b.set(doc(db, 'homes', h.id), { owner: uid, name: S.profile.displayName, style: st.key, garage: 0, at: serverTimestamp() }); b.set(doc(db, 'users', uid, 'pal', 'home'), { plot: h.id, at: serverTimestamp() }); await b.commit();
      pan.hidden = true; say('🎉 You bought ' + st.name + '! Tap 🏠 Home any time to come back.'); try { api.sfx && api.sfx('coin'); } catch { /* */ } }
    catch (e) { btn.disabled = false; btn.textContent = 'Try again'; say(e.code === 'permission-denied' ? 'The shop isn’t open for homes yet (prices not published).' : /reading 'd'|Diamonds/.test(e.message || '') ? 'You need more 💎 Diamonds for this house.' : e.message || 'Could not buy'); } }
  async function buyGarage(t, btn) { try { const it = GARAGES[t - 1]; busy(btn, 'Building…'); const { econ: e, dia: d } = await shop(); const inv = await e.inventory(true); const have = GARAGES.slice(t - 1).some((g) => inv[g.item]);
      if (!have) { if (it.d) await d.buy(it.item); else await e.buy(it.item); } const o = owners.get(myPlot); await setDoc(doc(db, 'homes', myPlot), { owner: uid, name: S.profile.displayName, style: o.style, garage: t, at: serverTimestamp() }); pan.hidden = true; say('🔧 Garage ready: ' + it.name); }
    catch (e) { btn.disabled = false; btn.textContent = 'Try again'; say(e.code === 'permission-denied' ? 'The shop isn’t open for garages yet (prices not published).' : e.message || 'Could not build'); } }
  async function moveOut(btn) { try { busy(btn, 'Moving out…'); const b = writeBatch(db); b.delete(doc(db, 'homes', myPlot)); b.delete(doc(db, 'users', uid, 'pal', 'home')); await b.commit(); save.cars = []; persist(true); pan.hidden = true; say('📦 Moved out. Your deed stays, so you can claim another house of that style for free.'); } catch (e) { btn.disabled = false; say(e.message || 'Could not move out'); } }
  function salePanel(h) { const st = HOME_STYLES[h.style]; panel(`<h3>🏷️ ${st.name}</h3><div class="row"><span>Plot ${h.id} · ${(h.town ? h.town : 'Kemy Street')}</span><b>${price(st)}</b></div><p><small>Living room, kitchen and bedroom inside. One home per player. Add a garage later.</small></p>${myPlot ? `<p><b>You already own ${myPlot}.</b></p>` : '<button data-b>Buy for ' + price(st) + '</button>'}`, (c) => { const b = c.querySelector('[data-b]'); if (b) b.onclick = () => buyHome(h, b); }); }
  function myPanel() { const h = HOUSE_BY_ID[myPlot]; const st = HOME_STYLES[h.style]; panel(`<h3>🏠 My ${st.name}</h3><div class="row"><span>Garage</span><b>${myTier ? myTier + ' bay' + (myTier > 1 ? 's' : '') : 'none'}</b></div>` + GARAGES.filter((g) => g.tier > myTier).map((g) => `<div class="row"><span>${g.name}</span><button data-g="${g.tier}">${price(g)}</button></div>`).join('') + `<p><small>Drive into a bay and tap 🅿️ Park here. Bay 3 is your reserved curb spot.</small></p><button class="g" data-m>Move out</button>`,
    (c) => { c.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => buyGarage(+b.dataset.g, b))); c.querySelector('[data-m]').onclick = (e) => { if (e.target.dataset.sure) moveOut(e.target); else { e.target.dataset.sure = 1; e.target.textContent = 'Tap again to move out'; } }; }); }
  function homeFront(h) { const [x, z] = Lw(h, 0, h.d / 2 + 3.2); return { x, z, yaw: h.face > 0 ? 0 : Math.PI }; }
  function teleport(p) { if (inside) goOut(); P.x = p.x; P.z = p.z; P.yaw = p.yaw || 0; P.y = ground(p.x, p.z); api.markDirty && api.markDirty(); }
  homeB.onclick = () => { if (D && D.mine && D.mine() && D.mine().state !== 'parked') { say('Park and get out first 🙂'); return; }
    if (myPlot) { teleport(homeFront(HOUSE_BY_ID[myPlot])); say('🏠 Home sweet home'); return; }
    const free = HOUSES.filter((h) => h.sale && !owners.has(h.id)); panel(`<h3>🏠 Find a home</h3><p><small>Houses with an orange FOR SALE sign can be bought with Star Coins or Diamonds. ${free.length} for sale right now.</small></p>` + free.slice(0, 40).map((h) => `<div class="row"><span>${HOME_STYLES[h.style].name}<br><small>${h.id} · ${h.town || 'Kemy Street'}</small></span><button data-v="${h.id}">${price(HOME_STYLES[h.style])} · Visit</button></div>`).join(''),
      (c) => c.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { pan.hidden = true; const h = HOUSE_BY_ID[b.dataset.v]; const [x, z] = Lw(h, -6.3, h.d / 2 + 6.2); teleport({ x, z, yaw: h.face > 0 ? Math.PI : 0 }); }))); };

  // ---------------------------------------------------------------- prompts + action routing
  api.houseLocked = (id) => { const h = HOUSE_BY_ID[id]; return !!(h && h.sale); };
  let promptNow = null; const prevPrompt = api.prompt; api.prompt = () => { const p0 = prevPrompt && prevPrompt(); if (p0) return p0; return promptNow; };
  const prevAct = api.onAction; api.onAction = (a) => { if (a && a.startsWith('kh:')) act(a.slice(3)); else if (prevAct) prevAct(a); };
  function act(a) { const [k, v] = a.split(':'); if (k === 'sale') salePanel(HOUSE_BY_ID[v]); else if (k === 'mine') myPanel(); else if (k === 'locked') say('🔒 ' + (owners.get(v)?.name || 'A Pal') + '’s home. Only the owner can go inside.'); else if (k === 'out') goOut(); else if (k === 'park') parkHere(+v); else if (k === 'take') takeCar(+v); }
  inB.onclick = () => { const h = HOUSE_BY_ID[inB.dataset.h]; if (h) goIn(h); };
  function parkHere(k) { const m = D.mine(); if (!m) return; const G0 = garages.get(myPlot); const b = G0 && G0.bays.find((q) => q.k === k); if (!b) return; save.cars = save.cars.filter((c) => c && c.bay !== k); save.cars.push({ id: m.id, c: m.color, bay: k, yaw: m.yaw }); save.street = null; D.stash();
    const [fx, fz] = b.front; P.x = fx; P.z = fz; P.y = ground(fx, fz); showParked(); persist(true); say('🅿️ Parked in bay ' + (k + 1) + '. It will be here next time.'); }
  function takeCar(k) { const c = save.cars.find((q) => q && q.bay === k); const G0 = garages.get(myPlot); const b = G0 && G0.bays.find((q) => q.k === k); if (!c || !b) return; save.cars = save.cars.filter((q) => q !== c); showParked(); D.place(c.id, c.c || 0, { x: b.cx, z: b.cz, yaw: b.curb ? b.yaw : (c.yaw ?? b.yaw) }, true); persist(true); }

  // ---------------------------------------------------------------- save / restore location (+ street car)
  let lastLS = 0, lastFS = 0, lastSent = null;
  function snapshot() { let x = P.x, z = P.z, yaw = P.yaw || 0; if (inside) { const f = homeFront(inside); x = f.x; z = f.z; yaw = f.yaw; } const m = D && D.mine && D.mine(); let street = null;
    if (m) { const inBay = garages.get(myPlot) && garages.get(myPlot).bays.some((b) => Math.hypot(b.cx - m.x, b.cz - m.z) < 1.5); if (!inBay) street = { id: m.id, c: m.color, x: Math.round(m.x * 10) / 10, z: Math.round(m.z * 10) / 10, yaw: Math.round(m.yaw * 100) / 100 }; }
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round(yaw * 100) / 100, cars: save.cars.filter(Boolean).slice(0, 3), street }; }
  function persist(force) { const now = Date.now(); const s = snapshot(); Object.assign(save, s); if (force || now - lastLS > 3000) { lastLS = now; lss(LS, JSON.stringify(save)); }
    if (!uid || !db) return; const moved = !lastSent || Math.hypot(lastSent.x - s.x, lastSent.z - s.z) > 4 || JSON.stringify(lastSent.cars) !== JSON.stringify(s.cars) || JSON.stringify(lastSent.street) !== JSON.stringify(s.street);
    if (moved && (now - lastFS > (force ? 6000 : 30000))) { lastFS = now; lastSent = s; setDoc(doc(db, 'users', uid, 'pal', 'world'), { ...s, at: serverTimestamp() }).catch((e) => console.warn('world save', e.code || e)); } }
  const onHide = () => persist(true); addEventListener('pagehide', onHide); document.addEventListener('visibilitychange', onHide);
  let spawned = false; const startAt = { x: P.x, z: P.z };
  async function firstSpawn() { if (spawned) return; spawned = true; let fs = null; if (uid && db) try { const d = await getDoc(doc(db, 'users', uid, 'pal', 'world')); if (d.exists()) fs = d.data(); } catch { /* */ }
    if (fs) { save.cars = fs.cars || save.cars; if ('street' in fs) save.street = fs.street; }
    const loc = fs || (save.x != null ? save : null); if (Math.hypot(P.x - startAt.x, P.z - startAt.z) > 4) return; // already walking: don't yank
    if (myPlot) teleport(homeFront(HOUSE_BY_ID[myPlot])); else if (loc && loc.x != null) { const [x, z] = worldClamp(loc.x, loc.z); teleport({ x, z, yaw: loc.yaw }); }
    if (save.street && CAR[save.street.id] && D && D.place && !D.mine()) D.place(save.street.id, save.street.c || 0, { x: save.street.x, z: save.street.z, yaw: save.street.yaw }, false);
    showParked(); window.__kh && (window.__kh.spawned = myPlot ? 'home' : loc ? 'saved' : 'default'); }
  if (!uid) setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 50); setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 6000);

  // ---------------------------------------------------------------- per-frame: prompts, garage doors, light
  function update(dt) { promptNow = null; let showIn = null; const m = D && D.mine && D.mine(); const driving = m && m.state !== 'parked';
    if (inside) { const { cx, cz } = roomCell(inside); if (Math.hypot(P.x - cx, P.z - (cz + 5.4)) < 1.8) promptNow = { id: 'kh:out', label: '🚪 Go outside' }; }
    else if (!driving) { let best = null, bd = 2.8; for (const h of HOUSES) { const d = Math.hypot(h.door.x - P.x, h.door.z - P.z); if (d < bd) { bd = d; best = h; } }
      if (best) { const o = owners.get(best.id); if (best.sale) { if (!o) promptNow = { id: 'kh:sale:' + best.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[best.style]) }; else if (o.owner === uid) { promptNow = { id: 'kh:mine:' + best.id, label: '🏠 My home' }; showIn = best; } else promptNow = { id: 'kh:locked:' + best.id, label: '🔒 ' + (o.name || 'A Pal') + '’s home' }; } else showIn = best; }
      else for (const h of HOUSES) if (h.sale && !owners.has(h.id)) { const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); if (Math.hypot(sx - P.x, sz - P.z) < 2.4) { promptNow = { id: 'kh:sale:' + h.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[h.style]) }; break; } } }
    const G0 = myPlot && garages.get(myPlot);
    for (const [id, gg] of garages) for (const b of gg.bays) { if (b.curb) continue; let want = 0;
      if (id === myPlot) { if (driving && Math.hypot(m.x - b.front[0], m.z - b.front[1]) < 11) want = 1; if (driving && Math.hypot(m.x - b.cx, m.z - b.cz) < 3.2) want = 1; if (!driving && save.cars.some((c) => c && c.bay === b.k) && Math.hypot(P.x - b.front[0], P.z - b.front[1]) < 3) want = 1; if (Math.hypot(P.x - b.cx, P.z - b.cz) < 2.8) want = 1; }
      b.open += (want - b.open) * Math.min(1, dt * 2.5); const o = b.open; b.door.position.y = 1.15 + o * 1.25; b.door.scale.y = 1 - o * 0.82; b.door.position.z = 5.3 / 2 - 0.05 - o * 0.4; b.dcol.top = o > 0.6 ? -99 : 99; }
    if (G0 && !inside) for (const b of G0.bays) { const has = save.cars.some((c) => c && c.bay === b.k);
      if (driving && !has && Math.hypot(m.x - b.cx, m.z - b.cz) < (b.curb ? 2.2 : 1.6) && Math.abs(m.speed) < 1.5) promptNow = { id: 'kh:park:' + b.k, label: '🅿️ Park here' };
      else if (!driving && has && Math.hypot(P.x - b.front[0], P.z - b.front[1]) < 2.6) promptNow = { id: 'kh:take:' + b.k, label: '🚗 Take car' }; }
    inB.hidden = !showIn; if (showIn) { inB.dataset.h = showIn.id; inB.textContent = '🏠 Go in'; }
    if (inside && roomLight) roomLight.intensity = (LOW ? 18 : 26);
    persist(false);
    window.__kh = Object.assign(window.__kh || {}, { myPlot, myTier, inside: inside && inside.id, owners: owners.size, cars: save.cars.length, street: !!save.street, prompt: promptNow && promptNow.label }); }
  // debug only (kemy-pals-debug=1): pretend to own a plot locally to preview garages/interiors (no writes)
  const fakeOwn = (id, tier) => { if (lsg('kemy-pals-debug') !== '1') return false; owners.set(id, { owner: uid, name: S.profile?.displayName || 'Me', style: HOME_STYLES[HOUSE_BY_ID[id].style].key, garage: tier }); myPlot = id; myTier = tier; drawSign(HOUSE_BY_ID[id]); buildGarage(HOUSE_BY_ID[id], tier); return true; };
  W.homeSpot = () => (myPlot ? homeFront(HOUSE_BY_ID[myPlot]) : null); W.leaveRoom = () => { if (inside) goOut(); };
  window.__khApi = { fakeOwn, goIn: (id) => goIn(HOUSE_BY_ID[id]), goOut, sale: (id) => salePanel(HOUSE_BY_ID[id]), home: () => homeB.click(), buy: (id) => buyHome(HOUSE_BY_ID[id], document.createElement('button')), garage: (t) => buyGarage(t, document.createElement('button')), parkHere, takeCar, persist, bays: () => (garages.get(myPlot) || { bays: [] }).bays.map((b) => ({ k: b.k, x: b.cx, z: b.cz, yaw: b.yaw, front: b.front, open: b.open })), teleport };
  function destroy() { persist(true); removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); if (unsub) unsub(); roomState.box = null; if (roomLight) scene.remove(roomLight); scene.remove(root); homeB.remove(); inB.remove(); pan.remove(); css.remove(); }
  void Q; void K;
  return { update, destroy };
}
