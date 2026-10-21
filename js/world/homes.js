// Kemy World property: buy a house on a "For Sale" plot (one owner each, any town), add a garage (1-3 bays),
// go inside furnished interiors (living room, kitchen, bedroom; built only when you walk in), drive into your own
// garage (the roll-up door opens for the owner and closes after), "Park here" saves the car in that bay, your last
// spot + a car left on the street are remembered (localStorage + a throttled private Firestore doc).
// Purchases use the existing validated coin / diamond shop paths; firestore.rules check deed + owner. Written by Lone Keem.
import { doc, getDoc, setDoc, onSnapshot, collection, serverTimestamp, writeBatch, deleteDoc } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { HOUSES, HOUSE_BY_ID, HOME_STYLES, GARAGES, FLAT, roomState, worldClamp, roomOf, garageCap, maxTier, ADMIN_CAP, ADMIN_PLOT, CITIES, CITY_BY_ID } from './layout.js';
import { CAR, CARS, PAINTS, buildCar, poseCar } from './cars.js';
import { parseCar } from './drive.js';
import { GALLERY } from './cities.js';
import { checkInput } from '../pals/talk.js';
import { ADMIN_EMAIL } from '../firebase-init.js';
import { attachHomeLife } from './homelife.js';
export const plateBad = (t) => { const s = String(t || ''); return !!(checkInput(s) || checkInput(s.toLowerCase()) || checkInput(s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').toLowerCase())); };
import { buildInterior, SC as SC0, scOf, DECOR, decorItem, parseItems, serItems, defaultItems, WALL_SW, EXT_SW, FLOORS } from './interior.js';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const RADIO_RE = /^https:\/\/(open\.spotify\.com|embed\.music\.apple\.com|music\.apple\.com)\//;

const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export async function registerHomeItems() { const cat = await import('../pals/catalog.js'); const all = [...HOME_STYLES, ...GARAGES];
  cat.addItems(all.filter((x) => x.p).map((x) => ({ id: x.item, name: x.name, kind: 'home', p: x.p, r: 'r' })));
  cat.addDiamondItems(all.filter((x) => x.d).map((x) => ({ id: x.item, name: x.name, kind: 'home', d: x.d, productId: x.productId })));
  const DE = Object.entries(DECOR); cat.addItems(DE.filter(([, d]) => d.c).map(([c, d]) => ({ id: decorItem(c), name: '🛠️ ' + d.n, kind: 'home', p: d.c, r: 'r' })));
  cat.addDiamondItems(DE.filter(([, d]) => d.d).map(([c, d]) => ({ id: decorItem(c), name: '🛠️ ' + d.n, kind: 'home', d: d.d, productId: 'kemy_decor_' + c }))); }
const price = (x) => (x.d ? `💎${x.d}` : `⭐${x.p}`);
export const roomCell = (h) => roomOf(h);
const Lw = (h, lx, lz) => [h.x + (h.face > 0 ? lx : -lx), h.z + (h.face > 0 ? lz : -lz)];
const BAYX = [3.7, -3.7];

export function attachHomes(api, W, K) {
  let SC = SC0; // room scale of the house I'm in (mansions are bigger)
  const { THREE, scene, Q, LOW, box, P, S, db, view } = api; const ground = api.ground; const { put, flush, G, std } = K;
  const uid = S.user && S.user.uid; const amAdmin = !!(S.user && S.user.email === ADMIN_EMAIL && S.user.emailVerified !== false); const root = new THREE.Group(); root.name = 'kemy-homes'; scene.add(root); const D = W.drive;
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
  function makeSign(h) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); g.position.set(sx, FLAT, sz); g.rotation.y = h.face > 0 ? 0 : Math.PI;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), std('#f8fafc')); post.position.y = 0.95; const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); bd.position.set(0, 1.55, 0.08); g.add(post, bd); root.add(g); signs.set(h.id, { cv, tex, g }); drawSign(h); }
  // signs exist only near the player (hundreds of plots now): made within 90 m, dropped beyond 140 m
  let sT = 0; function signTick(dt) { if ((sT += dt) < 0.6) return; sT = 0; for (const h of HOUSES) { if (!h.sale) continue; const d = Math.abs(h.x - P.x) + Math.abs(h.z - P.z); const s0 = signs.get(h.id); if (!s0 && d < 110) makeSign(h); else if (s0 && d > 180) { root.remove(s0.g); s0.tex.dispose(); s0.g.children.forEach((c) => c.geometry && c.geometry.dispose()); signs.delete(h.id); } } }
  function drawSign(h) { const s = signs.get(h.id); if (!s) return; const o = owners.get(h.id); const g = s.cv.getContext('2d'); const st = HOME_STYLES[h.style];
    g.fillStyle = o ? '#4c1d95' : '#ea580c'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120); g.fillStyle = '#fff'; g.textAlign = 'center';
    if (o) { g.font = 'bold 26px system-ui,sans-serif'; g.fillText('🏠 ' + (o.name || 'A Pal').slice(0, 14), 128, 56); g.font = '20px system-ui,sans-serif'; g.fillText(o.owner === uid ? 'Your home!' : 'Home sweet home', 128, 96); }
    else { g.font = 'bold 34px system-ui,sans-serif'; g.fillText('FOR SALE', 128, 50); g.font = 'bold 22px system-ui,sans-serif'; g.fillText(st.name + ' ' + price(st), 128, 96); } s.tex.needsUpdate = true; }

  // ---------------------------------------------------------------- garages + parked cars (built only near the player)
  // homes/{plot}.cars = 'id.colour[.PLATE.bg.fg.border.frame];…' (owner-written, max 50). Everyone sees every listed car
  // parked at the house: glass-walled, open-front garage bays (car lifts stack 2-3 high) first, then the driveway / curb.
  const garages = new Map(); // plot -> { g, slots:[{x,z,y,yaw,front,kind}], cars:[{m,c,p}], carMs:[], cols:[], key }
  const gMat = std('#f1f5f9', { r: 0.6 }), postM = std('#334155', { r: 0.4, m: 0.6 }), rMat = std('#475569', { r: 0.6 }), ledM = new THREE.MeshBasicMaterial({ color: '#a5f3fc' }), padM = std('#cbd5e1', { r: 0.35, m: 0.5 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const goldM = std('#d4a017', { r: 0.25, m: 0.9 }); const BX = new THREE.BoxGeometry(1, 1, 1);
  const bx = (g, m, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(BX, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); g.add(o); return o; };
  const capOf = (h, o) => (h.admin ? ADMIN_CAP : garageCap((o && o.garage) || 0));
  // layout for a plot: columns of bays (local frame: +z toward the road) + extra driveway / curb spots
  function layoutOf(h, cap) { const L = { cols: [], extra: [] }; const LV = 2.55;
    if (h.admin) { const n = 10, lv = 5; for (let c = 0; c < n; c++) L.cols.push({ lx: 34 + c * 4.2, lz: -2, lv, dep: 7 }); for (let i = 0; i < 10; i++) L.extra.push({ lx: 34 + (i % 5) * 8.4, lz: 14 + Math.floor(i / 5) * 8, yaw: 0, kind: 'drive' }); L.LV = LV; L.w = 4.2; return L; }
    if (h.estate) { const n = Math.min(5, Math.max(1, cap)), lv = Math.max(1, Math.ceil(cap / 5)); if (cap) for (let c = 0; c < n; c++) L.cols.push({ lx: GALLERY.lx - 8 + c * 4, lz: GALLERY.lz, lv, dep: GALLERY.dep }); for (let i = 0; i < 10; i++) L.extra.push({ lx: 14 + (i % 5) * 4, lz: 11 + Math.floor(i / 5) * 6.5, yaw: 0, kind: 'drive' }); L.LV = LV; L.w = 4; return L; }
    const n = Math.min(2, cap), lv = cap ? Math.ceil(cap / n) : 0; const dz = h.d / 2 + 0.1 + 2.8; for (let c = 0; c < n; c++) L.cols.push({ lx: BAYX[c], lz: dz, lv, dep: 5.6 });
    for (let c = n; c < 2; c++) L.extra.push({ lx: BAYX[c], lz: dz, yaw: Math.PI, kind: 'drive' }); for (const lx of [-3.3, 3.3]) L.extra.push({ lx, lz: 13.1, yaw: Math.PI / 2, kind: 'curb' }); L.LV = LV; L.w = 3.7; return L; }
  const ry0 = (h) => (h.face > 0 ? 0 : Math.PI);
  function slotsOf(h, cap, nCars) { const L = layoutOf(h, cap); const out = []; const used = Math.min(cap, nCars); const lvUsed = L.cols.length ? Math.max(1, Math.ceil(used / L.cols.length)) : 0;
    for (let lv = 0; lv < (L.cols[0] ? L.cols[0].lv : 0); lv++) for (const c of L.cols) { if (out.length >= cap) break; const [x, z] = Lw(h, c.lx, c.lz); const [fx, fz] = Lw(h, c.lx, c.lz + c.dep / 2 + 2.6); out.push({ x, z, y: FLAT + lv * L.LV + (lv ? 0.16 : 0), yaw: ry0(h) + Math.PI, front: [fx, fz], kind: lv ? 'lift' : 'bay', lv }); }
    for (const e of L.extra) { const [x, z] = Lw(h, e.lx, e.lz); out.push({ x, z, y: FLAT, yaw: ry0(h) + e.yaw, front: [x, z], kind: e.kind, lv: 0 }); } return { slots: out, L, lvUsed }; }
  function parseCars(str) { const out = []; for (const t of String(str || '').split(';').slice(0, ADMIN_CAP)) { const q = t.split('.'); if (!CAR[q[0]]) continue; const c = Math.max(0, Math.min(PAINTS.length - 1, q[1] | 0)); const it = { m: q[0], c };
      if (q.length >= 7 && /^[A-Z0-9]{1,7}$/.test(q[2]) && !plateBad(q[2])) it.p = { t: q[2], b: q[3] | 0, f: q[4] | 0, r: q[5] | 0, fr: q[6] | 0 }; out.push(it); } return out; }
  const serCars = (L) => L.map((i) => i.m + '.' + (i.c | 0) + (i.p ? `.${i.p.t}.${i.p.b | 0}.${i.p.f | 0}.${i.p.r | 0}.${i.p.fr | 0}` : '')).join(';');
  function buildGarage(h) { dropGarage(h.id); const o = owners.get(h.id); if (!o) return; const cars = parseCars(o.cars); const cap = capOf(h, o); if (!cap && !cars.length) return;
    const g = new THREE.Group(); g.name = 'garage-' + h.id; root.add(g); const { slots, L, lvUsed } = slotsOf(h, cap, cars.length); const cols = []; const ry = ry0(h);
    // structure: one glass box per column run (posts, glass sides + back, roof, LED strip, lift decks); open front
    if (L.cols.length) { const c0 = L.cols[0], cN = L.cols[L.cols.length - 1]; const W2 = (cN.lx - c0.lx) + L.w + 0.3, dep = c0.dep, lvB = Math.max(1, lvUsed), Hh = lvB * L.LV + 0.25; const mid = (c0.lx + cN.lx) / 2; const [cx, cz] = Lw(h, mid, c0.lz);
      const sg = new THREE.Group(); sg.position.set(cx, FLAT, cz); sg.rotation.y = ry; g.add(sg);
      bx(sg, padM, 0, 0.04, 0, W2, 0.08, dep); bx(sg, rMat, 0, Hh + 0.1, 0, W2 + 0.3, 0.2, dep + 0.3); bx(sg, h.admin ? goldM : ledM, 0, Hh - 0.05, dep / 2 + 0.12, W2, 0.1, 0.06);
      for (const s of [-1, 1]) { bx(sg, glassM, s * W2 / 2, Hh / 2, 0, 0.06, Hh, dep); for (const zz of [-1, 1]) bx(sg, h.admin ? goldM : postM, s * W2 / 2, Hh / 2, zz * dep / 2, 0.16, Hh, 0.16); }
      bx(sg, glassM, 0, Hh / 2, -dep / 2, W2, Hh, 0.06); // see-through back too
      for (let i = 1; i < L.cols.length; i++) { const xm = (L.cols[i - 1].lx + L.cols[i].lx) / 2 - mid; for (const zz of [-1, 1]) bx(sg, postM, xm, Hh / 2, zz * dep / 2, 0.1, Hh, 0.1); }
      for (let lv = 1; lv < lvB; lv++) for (const c of L.cols) { const lx = c.lx - mid; bx(sg, padM, lx, lv * L.LV + 0.06, 0, L.w - 0.3, 0.1, dep - 0.4); bx(sg, ledM, lx, lv * L.LV + 0.0, dep / 2 - 0.25, L.w - 0.3, 0.04, 0.04); }
      // colliders: the two outer glass walls + back (world AABBs)
      for (const s of [-1, 1]) { const [wx, wz] = Lw(h, mid + s * W2 / 2, c0.lz); const ax = Math.abs(Math.sin(ry)) > 0.5; cols.push({ x0: wx - (ax ? dep / 2 : 0.12), x1: wx + (ax ? dep / 2 : 0.12), z0: wz - (ax ? 0.12 : dep / 2), z1: wz + (ax ? 0.12 : dep / 2), top: 99, bot: -99 }); }
      { const [wx, wz] = Lw(h, mid, c0.lz - dep / 2); cols.push({ x0: wx - W2 / 2, x1: wx + W2 / 2, z0: wz - 0.12, z1: wz + 0.12, top: 99, bot: -99 }); } }
    if (h.admin) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x2 = cv.getContext('2d'); const gr = x2.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff4c2'); gr.addColorStop(1, '#d4a017'); x2.fillStyle = '#1f1300'; x2.fillRect(0, 0, 512, 128); x2.strokeStyle = gr; x2.lineWidth = 8; x2.strokeRect(6, 6, 500, 116); x2.fillStyle = gr; x2.textAlign = 'center'; x2.font = 'bold 40px Georgia,serif'; x2.fillText('👑 ' + String(o.name || 'Admin').slice(0, 18), 256, 60); x2.font = 'bold 24px Georgia,serif'; x2.fillText('Kemy Palace · Car Gallery', 256, 102);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: t })); const [px, pz] = Lw(h, 34 + 4.5 * 4.2, -2 + 3.62); m.position.set(px, FLAT + 5 * 2.55 + 1.5, pz); m.rotation.y = ry; m.userData.tex = t; g.add(m); }
    for (const c of cols) box.push(c); const G0 = { g, slots, cars, carMs: [], cols, h, key: (o.cars || '') + '|' + cap, hide: '' }; garages.set(h.id, G0); placeCars(G0); }
  function hiddenModel(h) { const o = owners.get(h.id); if (!o) return ''; if (o.owner === uid) { const m = D && D.mine && D.mine(); return m ? m.id : ''; } // the owner's active car is out on the road, not parked
    if (api.others) for (const p of api.others.values()) if (p.uid === o.owner || p.id === o.owner) { const c = parseCar(p.dn); if (c) return c.id; } return ''; }
  function placeCars(G0) { for (const m of G0.carMs) { root.remove(m); m.traverse((q) => { if (q.userData && q.userData.plateTex) q.userData.plateTex.dispose(); }); } for (const c of G0.carCols || []) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } G0.carMs = []; G0.carCols = [];
    const hide = hiddenModel(G0.h); G0.hide = hide; let si = 0, skipped = false; G0.shown = [];
    for (const car of G0.cars) { if (!skipped && car.m === hide) { skipped = true; continue; } const s = G0.slots[si++]; if (!s) break; const m = buildCar(CAR[car.m], car.c, { lite: true, noShadow: LOW || G0.cars.length > 6 }); if (car.p && W.addPlate) W.addPlate(m, car.p); poseCar(m, { x: s.x, y: s.y, z: s.z, yaw: s.yaw }, 0, 0); m.userData.slot = s; m.userData.car = car; root.add(m); G0.carMs.push(m); G0.shown.push({ car, s });
      if (!s.lv) { const cy = { x: s.x, z: s.z, r: CAR[car.m].Wd * 0.55, top: FLAT + CAR[car.m].H, parked: 1 }; api.cyl.push(cy); G0.carCols.push(cy); } }
    G0.overflow = Math.max(0, G0.cars.length - (skipped ? 1 : 0) - G0.slots.length); }
  function dropGarage(id) { const G0 = garages.get(id); if (!G0) return; for (const m of G0.carMs) root.remove(m); for (const c of G0.carCols || []) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } root.remove(G0.g); G0.g.traverse((q) => { if (q.userData.tex) q.userData.tex.dispose(); }); for (const c of G0.cols) { const i = box.indexOf(c); if (i >= 0) box.splice(i, 1); } garages.delete(id); }
  // near-only: (re)build garages within 140 m, drop beyond 200 m; checked twice a second (no reads, just the cached owners map)
  let gT = 0; function garageTick(dt) { if ((gT += dt) < 0.5) return; gT = 0; for (const [id, o] of owners) { const h = HOUSE_BY_ID[id]; if (!h) continue; const d = Math.hypot(h.x - P.x, h.z - P.z); const G0 = garages.get(id);
      if (d < 140 && !inside) { const key = (o.cars || '') + '|' + capOf(h, o); if (!G0 || G0.key !== key) { buildGarage(h); return; } if (G0.hide !== hiddenModel(h)) placeCars(G0); } else if (G0 && d > 200) dropGarage(id); }
    for (const id of [...garages.keys()]) if (!owners.has(id)) dropGarage(id); }
  function showParked() { const G0 = myPlot && garages.get(myPlot); if (G0) placeCars(G0); }
  // ---------------------------------------------------------------- interiors (built on first entry, kept after)
  const rooms = new Map(); let roomLight = null, roomLight2 = null, deco = null, radioOff = null;
  function buildRoom(h) { if (rooms.has(h.id)) return rooms.get(h.id); const { cx, cz } = roomCell(h); const o = owners.get(h.id); const dec = (o && o.decor) || {};
    const I = buildInterior(api, { put, flush, G, y: FLAT }, h, cx, cz, dec); root.add(I.g); const r0 = { g: I.g, cx, cz, I, dk: JSON.stringify(dec) }; rooms.set(h.id, r0); return r0; }
  function applyDecor(id) { const o = owners.get(id); const dec = (o && o.decor) || {}; if (W.paintHouse && HOUSE_BY_ID[id] && HOUSE_BY_ID[id].sale) W.paintHouse(id, dec.ext || null); const r = rooms.get(id); const k = JSON.stringify(dec);
    if (r && r.dk !== k && !(deco && inside && inside.id === id)) { r.dk = k; r.I.setWall(dec.wall); r.I.setFloor(dec.floor || r.I.S.floor); r.I.setItems(parseItems(dec.items || defaultItems(r.I.two))); } }
  const canEnter = (h) => { if (!h.sale) return true; const o = owners.get(h.id); if (!o) return false; return o.owner === uid || o.open === true || (Array.isArray(o.inv) && o.inv.includes(uid)); };
  function goIn(h) { SC = scOf(h); if (!canEnter(h)) { say('🔒 Only the owner and invited friends can go inside'); return; } if (D && D.mine && D.mine() && D.mine().state !== 'parked') return; const r = buildRoom(h); inside = h; roomState.box = { x0: r.cx - 5.6 * SC, x1: r.cx + 5.6 * SC, z0: r.cz - 5.6 * SC, z1: r.cz + 5.5 * SC };
    standUp(true); P.x = r.cx; P.z = r.cz + 4.6 * SC; P.yaw = Math.PI; P.y = FLAT; if (!roomLight) { roomLight = new THREE.PointLight('#fff1d6', LOW ? 22 : 32, 22, 1.6); scene.add(roomLight); } roomLight.position.set(r.cx - 3 * SC, FLAT + 2.7, r.cz + 1.5); roomLight.visible = true; if (!LOW) { if (!roomLight2) { roomLight2 = new THREE.PointLight('#fff1d6', 24, 20, 1.6); scene.add(roomLight2); } roomLight2.position.set(r.cx + 3.5 * SC, FLAT + 2.7, r.cz - 2); roomLight2.visible = true; }
    roomState.inId = h.id; const ow = owners.get(h.id); say(ow && ow.owner !== uid ? '🏠 Visiting ' + (ow.name || 'a Pal') + '’s home' : '🏠 Welcome in!' + (r.I.two ? ' Stairs to the 2nd floor are on the right.' : '')); radioOff = null; startRadio(); decB.hidden = !(ow && ow.owner === uid); api.markDirty && api.markDirty(); }
  function goOut() { const h = inside; if (!h) return; standUp(true); tvHide(); if (deco) endDeco(false); inside = null; roomState.box = null; roomState.inId = null; stopRadio(); decB.hidden = true; if (roomLight2) roomLight2.visible = false; const [x, z] = Lw(h, 0, h.d / 2 + 3.2); P.x = x; P.z = z; P.yaw = h.face > 0 ? 0 : Math.PI; P.y = ground(x, z); if (roomLight) roomLight.visible = false; api.markDirty && api.markDirty(); }

  // ---------------------------------------------------------------- house radio (homes/{plot}.radio: Spotify/Apple embed or Kemy Radio synced by startedAt)
  const css2 = document.createElement('style'); css2.textContent = `.kh-radio{position:absolute;left:50%;transform:translateX(-50%);top:calc(max(8px,env(safe-area-inset-top)) + 54px);width:min(92vw,340px);background:rgba(20,12,45,.88);color:#fff;border-radius:14px;padding:8px 10px;pointer-events:auto;z-index:9;font:600 13px Inter,sans-serif}.kh-radio[hidden],.kh-dbar[hidden],.kh-dec[hidden]{display:none}
.kh-rh{display:flex;justify-content:space-between;align-items:center}.kh-rh button,.kh-rb button{border:0;border-radius:10px;background:#7c3aed;color:#fff;font:800 13px Inter,sans-serif;padding:6px 10px;min-height:34px}.kh-rb iframe{width:100%;border:0;border-radius:10px}.kh-rb small,.kh-radio .mx-credit{display:block;opacity:.75;font-size:11px;margin:4px 0 0}.kh-radio .mx-credit a{color:#c4b5fd}
.kh-dec{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 76px);top:calc(max(8px,env(safe-area-inset-top)) + 226px);pointer-events:auto;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(15,118,110,.85);color:#fff;font:800 14px Inter,sans-serif;padding:0 12px}
.kh-dbar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(8px,env(safe-area-inset-bottom)) + 4px);width:min(96vw,560px);max-height:46vh;overflow:auto;background:rgba(255,255,255,.97);color:#111;border-radius:16px;padding:8px;pointer-events:auto;z-index:12;font:600 13px Inter,sans-serif}
.kh-dbar .tabs{display:flex;gap:6px;margin-bottom:6px}.kh-dbar button{border:0;border-radius:10px;padding:7px 10px;font:800 13px Inter,sans-serif;background:#e5e7eb;color:#111;min-height:36px}.kh-dbar button.on,.kh-dbar button.p{background:#6d28d9;color:#fff}
.kh-dbar .sw{width:30px;height:30px;border-radius:50%;padding:0;min-height:0;border:2px solid #fff;box-shadow:0 0 0 1px #94a3b8;margin:2px}.kh-dbar .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:6px}.kh-dbar .it{display:flex;flex-direction:column;align-items:center;font-size:12px}.kh-dbar .it i{font-style:normal;font-size:22px}.kh-dbar .it em{font-style:normal;font-size:11px;color:#6d28d9}
.kh-dbar .mv{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.kh-dbar label{display:block;margin:6px 0 2px;font-weight:800}
@media (orientation:landscape) and (max-height:500px){.kh-dec{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 400px)}.kh-dbar{max-height:44vh;width:min(62vw,520px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 6px);transform:none}.kh-dbar .grid{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:84px;overflow-x:auto}.kh-radio{top:calc(max(8px,env(safe-area-inset-top)) + 4px)}}`; document.head.appendChild(css2);
  const radioBox = document.createElement('div'); radioBox.className = 'kh-radio'; radioBox.hidden = true; const decB = document.createElement('button'); decB.className = 'kh-dec'; decB.textContent = '🛠️ Decorate'; decB.hidden = true;
  const dbar = document.createElement('div'); dbar.className = 'kh-dbar'; dbar.hidden = true; host.append(radioBox, decB, dbar);
  const radioKey = (o) => (o && o.radio ? JSON.stringify(o.radio) : '');
  let rad = null;
  async function startRadio() { stopRadio(); if (!inside || radioOff === inside.id) return; const o = owners.get(inside.id); const Rd = o && o.radio; if (!Rd || (Rd.k !== 'link' && Rd.k !== 'kemy')) return; const me0 = (rad = { key: radioKey(o) });
    radioBox.hidden = false; radioBox.innerHTML = `<div class="kh-rh"><b>📻 ${esc(o.name || 'House')}’s radio</b><button data-s aria-label="Stop radio">✕</button></div><div class="kh-rb"></div>`; radioBox.querySelector('[data-s]').onclick = () => { radioOff = inside && inside.id; stopRadio(); };
    const body = radioBox.querySelector('.kh-rb');
    if (Rd.k === 'link') { if (!RADIO_RE.test(Rd.url || '')) { stopRadio(); return; } const { musicEmbed, mountMusicEmbed } = await import('../embeds.js'); if (rad !== me0) return; const e = musicEmbed(Rd.url); if (!e) { stopRadio(); return; }
      e.height = Math.min(e.height || 152, 152); me0.emb = mountMusicEmbed(body, e, { source: 'house-radio' }); body.insertAdjacentHTML('beforeend', '<small>Tap ▶ to listen 🎵 · Spotify/Apple embeds play 30 s previews unless you’re signed in there.</small>'); }
    else { const { TRACKS } = await import('../theme.js'); if (rad !== me0) return; const t = TRACKS[Rd.t | 0] || TRACKS[0]; const au = new Audio(t.src); au.loop = true; au.volume = 0.5; me0.au = au;
      const sync = () => { try { au.currentTime = Math.max(0, ((Date.now() - (Rd.s || Date.now())) / 1000) % (t.dur || 120)); } catch { /* */ } };
      body.innerHTML = `<div>🎵 ${esc(t.title)} · Kemy Radio <small>(everyone inside hears the same spot)</small></div><button data-p hidden>Tap to listen 🎵</button>`; const tb = body.querySelector('[data-p]');
      const go = () => { sync(); au.play().then(() => { tb.hidden = true; dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'house-radio' } })); }).catch(() => { tb.hidden = false; }); };
      tb.onclick = go; au.addEventListener('loadedmetadata', sync, { once: true }); go(); }
    tvShow(Rd.k === 'kemy' ? (await import('../theme.js')).TRACKS[Rd.t | 0]?.title || 'Kemy Radio' : /apple/.test(Rd.url || '') ? 'Apple Music' : 'Spotify', o.name); window.__kh && (window.__kh.radio = Rd.k); }
  function stopRadio() { tvHide(); if (rad) { try { if (rad.emb) rad.emb.destroy(); } catch { /* */ } if (rad.au) { try { rad.au.pause(); rad.au.removeAttribute('src'); rad.au.load(); } catch { /* */ } dispatchEvent(new CustomEvent('kemy:media-stop', { detail: { source: 'house-radio' } })); } } rad = null; radioBox.hidden = true; radioBox.innerHTML = ''; window.__kh && (window.__kh.radio = null); }
  // owner writes (merge; rules re-check owner/name/garage/at on every write)
  const homeW = (patch) => { const o = owners.get(myPlot); return setDoc(doc(db, 'homes', myPlot), { ...patch, owner: uid, name: S.profile.displayName, style: o.style, garage: o.garage || 0, at: serverTimestamp() }, { merge: true }); };
  const wErr = (e) => say(e && e.code === 'permission-denied' ? '⚠️ Saving this needs the updated house rules (ask the admin to deploy firestore.rules)' : (e && e.message) || 'Could not save');
  function radioPanel() { const o = owners.get(myPlot) || {}; const Rd = o.radio || {}; import('../theme.js').then(({ TRACKS }) => panel(`<h3>📺 TV &amp; house music</h3><p><small>Plays on the living room TV for you and visitors while inside. Paste a Spotify or Apple Music link, or pick a Kemy Radio track (synced for everyone).</small></p>
      <input data-u placeholder="https://open.spotify.com/…" value="${esc(Rd.k === 'link' ? Rd.url : '')}" style="width:100%;min-height:40px;border-radius:10px;border:1px solid #ccc;padding:0 8px;box-sizing:border-box"><button data-l>Use link</button>
      <div style="margin-top:8px"><select data-t style="min-height:40px;border-radius:10px;max-width:100%">${TRACKS.map((t, i) => `<option value="${i}" ${Rd.k === 'kemy' && (Rd.t | 0) === i ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select> <button data-k>Play Kemy Radio</button></div><button class="g" data-o>Radio off</button>`,
    (c) => { c.querySelector('[data-l]').onclick = () => { const u = c.querySelector('[data-u]').value.trim(); if (!RADIO_RE.test(u) || u.length > 300) { say('Paste an open.spotify.com or music.apple.com link'); return; } homeW({ radio: { k: 'link', url: u } }).then(() => { pan.hidden = true; say('📻 Radio set'); }).catch(wErr); };
      c.querySelector('[data-k]').onclick = () => homeW({ radio: { k: 'kemy', t: +c.querySelector('[data-t]').value, s: Date.now() } }).then(() => { pan.hidden = true; say('📻 Kemy Radio on'); }).catch(wErr);
      c.querySelector('[data-o]').onclick = () => homeW({ radio: { k: 'off' } }).then(() => { pan.hidden = true; say('📻 Radio off'); }).catch(wErr); })); }
  function guestPanel() { const o = owners.get(myPlot) || {}; const inv = Array.isArray(o.inv) ? o.inv : [], invN = Array.isArray(o.invN) ? o.invN : [];
    panel(`<h3>🚪 Open house & invites</h3><div class="row"><span>Open house<br><small>${o.open ? 'Anyone can visit' : 'Only you + invited friends'}</small></span><button data-o>${o.open ? 'On ✅' : 'Off'}</button></div>
      <div class="row"><input data-n placeholder="@username" style="flex:1;min-height:38px;border-radius:10px;border:1px solid #ccc;padding:0 8px"><button data-a>Invite</button></div>${inv.map((u, i) => `<div class="row"><span>@${esc(invN[i] || 'pal')}</span><button class="g" data-r="${i}">Remove</button></div>`).join('') || '<p><small>No invites yet.</small></p>'}`,
    (c) => { c.querySelector('[data-o]').onclick = () => homeW({ open: !o.open }).then(() => { pan.hidden = true; say(o.open ? '🔒 Home closed to visitors' : '🚪 Open house! Anyone can visit'); }).catch(wErr);
      c.querySelector('[data-a]').onclick = async () => { const n = c.querySelector('[data-n]').value.trim().replace(/^@/, '').toLowerCase(); if (!/^[a-z0-9_.]{2,20}$/.test(n)) { say('Type a username'); return; } if (inv.length >= 50) { say('Max 50 invites'); return; }
        try { const d = await getDoc(doc(db, 'usernames', n)); const u2 = d.exists() && d.data().uid; if (!u2) { say('No Pal named @' + n); return; } if (u2 === uid || inv.includes(u2)) { say('Already invited'); return; } await homeW({ inv: [...inv, u2], invN: [...invN, n] }); pan.hidden = true; say('✉️ Invited @' + n); } catch (e) { wErr(e); } };
      c.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { const i = +b.dataset.r; homeW({ inv: inv.filter((_, j) => j !== i), invN: invN.filter((_, j) => j !== i) }).then(() => { pan.hidden = true; say('Removed'); }).catch(wErr); })); }); }

  // ---------------------------------------------------------------- 🛠️ Decorate mode (owner, inside): paint, floors, furniture on a 0.5 m grid
  let owned = null; async function loadOwned() { try { const { econ: e } = await shop(); owned = await e.inventory(true); } catch { owned = {}; } return owned; }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.85, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 9; ring.visible = false; root.add(ring);
  function startDeco() { if (!inside || !myPlot || inside.id !== myPlot) return; const r = rooms.get(myPlot); const o = owners.get(myPlot) || {}; const d0 = o.decor || {};
    deco = { r, wall: d0.wall || r.I.S.wall, floor: d0.floor || r.I.S.floor, ext: { ...(d0.ext || {}) }, items: r.I.items().map((i) => ({ ...i })), sel: -1, tab: 'f', t: 0 }; loadOwned().then(() => deco && drawDeco()); drawDeco(); decB.hidden = true; window.__kh && (window.__kh.deco = true); }
  function endDeco(save) { const d = deco; if (!d) return; deco = null; dbar.hidden = true; ring.visible = false; decB.hidden = !(inside && inside.id === myPlot); window.__kh && (window.__kh.deco = false);
    if (save) { const dec = { wall: d.wall, floor: d.floor, ext: d.ext, items: serItems(d.items), v: 1 }; homeW({ decor: dec }).then(() => say('💾 Home saved! Visitors see your new look.')).catch((e) => { wErr(e); applyDecor(myPlot); }); const r = rooms.get(myPlot); if (r) r.dk = JSON.stringify(dec); }
    else { const r = rooms.get(myPlot); if (r) r.dk = ''; applyDecor(myPlot); } }
  const relItems = () => deco.r.I.setItems(deco.items);
  function nearest() { const r = deco.r; const up = P.y > FLAT + 2.5 ? 1 : 0; let bi = -1, bd = 2.6; deco.items.forEach((it, i) => { if ((it.f || 0) !== up && deco.r.I.two) return; const d = Math.hypot(r.cx + it.x * SC - P.x, r.cz + it.z * SC - P.z); if (d < bd) { bd = d; bi = i; } }); return bi; }
  function decoTick(dt) { deco.t += dt; if (deco.t > 0.3) { deco.t = 0; const n = nearest(); if (n !== deco.sel) { deco.sel = n; if (deco.tab === 's' || deco.tab === 'f') drawDeco(); } } const it = deco.items[deco.sel]; ring.visible = !!it; if (it) ring.position.set(deco.r.cx + it.x * SC, FLAT + (it.f && deco.r.I.two ? 3.37 : 0.03), deco.r.cz + it.z * SC); }
  const priceOf = (D) => (D.d ? `💎${D.d}` : D.c ? `⭐${D.c}` : 'Free');
  const have = (c) => { const D = DECOR[c]; return !D.c && !D.d ? true : !!(owned && owned[decorItem(c)]); };
  function drawDeco() { if (!deco) return; const t = deco.tab; const it = deco.items[deco.sel];
    const selRow = `<div class="mv">${it ? `<b>${DECOR[it.c].e} ${DECOR[it.c].n}</b><button data-m="-1,0">⬅️</button><button data-m="1,0">➡️</button><button data-m="0,-1">⬆️</button><button data-m="0,1">⬇️</button><button data-rot>⟳</button><button data-del>🗑️</button>` : '<small>Walk next to a piece of furniture to move, rotate or remove it.</small>'}</div>`;
    let body = '';
    if (t === 'p') body = `<label>Inside walls</label>${WALL_SW.map((c) => `<button class="sw" style="background:${c}" data-w="${c}" aria-label="wall ${c}"></button>`).join('')}<label>Floor</label>${Object.entries(FLOORS).map(([k, F]) => `<button data-fl="${k}" class="${deco.floor === k ? 'on' : ''}">${F.n}</button>`).join(' ')}
      ${[['w', 'Outside walls'], ['r', 'Roof'], ['d', 'Front door'], ['t', 'Trim']].map(([k, n]) => `<label>${n}</label>${EXT_SW.map((c) => `<button class="sw" style="background:${c}" data-e="${k}:${c}"></button>`).join('')}`).join('')}<div><button data-e="reset">Reset outside colours</button></div>`;
    else if (t === 'f') body = selRow + `<label>Add furniture <small>(placed in front of you)</small></label><div class="grid">${Object.entries(DECOR).map(([c, D]) => `<button class="it" data-add="${c}"><i>${D.e}</i>${D.n}<em>${have(c) ? (D.c || D.d ? 'Owned' : 'Free') : priceOf(D)}</em></button>`).join('')}</div>`;
    dbar.innerHTML = `<div class="tabs"><button data-tab="f" class="${t === 'f' ? 'on' : ''}">🛋️ Furniture</button><button data-tab="p" class="${t === 'p' ? 'on' : ''}">🎨 Paint</button><span style="flex:1"></span><button class="g" data-x>Cancel</button><button class="p" data-sv>💾 Save</button></div>${body}`; dbar.hidden = false;
    dbar.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { deco.tab = b.dataset.tab; drawDeco(); })); dbar.querySelector('[data-x]').onclick = () => endDeco(false); dbar.querySelector('[data-sv]').onclick = () => endDeco(true);
    dbar.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { deco.wall = b.dataset.w; deco.r.I.setWall(deco.wall); }));
    dbar.querySelectorAll('[data-fl]').forEach((b) => (b.onclick = () => { deco.floor = b.dataset.fl; deco.r.I.setFloor(deco.floor); drawDeco(); }));
    dbar.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { if (b.dataset.e === 'reset') deco.ext = { w: '', r: '', d: '', t: '' }; else { const [k, c] = b.dataset.e.split(':'); deco.ext[k] = c; } W.paintHouse && W.paintHouse(myPlot, deco.ext); say('🎨 Outside colour set (see it when you go out)'); }));
    dbar.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { const it2 = deco.items[deco.sel]; if (!it2) return; const [dx, dz] = b.dataset.m.split(',').map(Number); it2.x = Math.max(-5.5, Math.min(5.5, it2.x + dx * 0.5)); it2.z = Math.max(-5.5, Math.min(5.5, it2.z + dz * 0.5)); relItems(); }));
    const rb = dbar.querySelector('[data-rot]'); if (rb) rb.onclick = () => { const it2 = deco.items[deco.sel]; if (it2) { it2.r = (it2.r + 1) & 3; relItems(); } };
    const db2 = dbar.querySelector('[data-del]'); if (db2) db2.onclick = () => { if (deco.sel >= 0) { deco.items.splice(deco.sel, 1); deco.sel = -1; relItems(); drawDeco(); } };
    dbar.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => { const c = b.dataset.add, D = DECOR[c]; if (deco.items.length >= 60) { say('Max 60 pieces'); return; }
      if (!have(c)) { if (!b.dataset.sure) { b.dataset.sure = 1; b.querySelector('em').textContent = 'Tap to buy ' + priceOf(D); return; } try { b.disabled = true; const { econ: e, dia: d } = await shop(); if (D.d) await d.buy(decorItem(c)); else await e.buy(decorItem(c)); owned = owned || {}; owned[decorItem(c)] = 1; say('🛍️ Bought ' + D.n); }
        catch (e) { b.disabled = false; say(e.code === 'permission-denied' ? 'The shop isn’t selling decor yet (prices not published).' : /Diamond|reading 'd'/.test(e.message || '') ? 'You need more 💎 Diamonds' : e.message || 'Could not buy'); return; } }
      const r = deco.r; const fx = Math.sin(P.yaw || 0), fz = Math.cos(P.yaw || 0); const snap = (v) => Math.max(-5.5, Math.min(5.5, Math.round(v * 2) / 2));
      deco.items.push({ c, x: snap((P.x - r.cx + fx * 1.6) / SC), z: snap((P.z - r.cz + fz * 1.6) / SC), r: (Math.round(((P.yaw || 0) + Math.PI) / (Math.PI / 2)) % 4 + 4) % 4, f: r.I.two && P.y > FLAT + 2.5 ? 1 : 0 }); deco.sel = deco.items.length - 1; relItems(); drawDeco(); })); }
  decB.onclick = () => startDeco();
  // ---------------------------------------------------------------- owners (live) + buying
  let unsub = null; if (uid && db) try { unsub = onSnapshot(collection(db, 'homes'), (qs) => { const prev = new Map(owners); owners.clear(); qs.forEach((d) => owners.set(d.id, d.data())); myPlot = null; myTier = 0;
      for (const [id, o] of owners) if (o.owner === uid && !HOUSE_BY_ID[id]?.admin) { myPlot = id; myTier = o.garage || 0; } if (amAdmin && owners.get(ADMIN_PLOT)?.owner === uid && !myPlot) { myPlot = ADMIN_PLOT; myTier = 0; }
      for (const h of HOUSES) if (h.sale) { const a = prev.get(h.id), b = owners.get(h.id); if (JSON.stringify(a) !== JSON.stringify(b)) drawSign(h); }
      for (const h of HOUSES) if (h.sale && JSON.stringify((prev.get(h.id) || {}).decor) !== JSON.stringify((owners.get(h.id) || {}).decor)) applyDecor(h.id);
      if (inside && !canEnter(inside)) { goOut(); say('🚪 The owner closed this home'); } else if (inside && radioKey(prev.get(inside.id)) !== radioKey(owners.get(inside.id))) { radioOff = null; startRadio(); }
      syncCars(); ensurePalace(); if (!snapOk) { snapOk = true; firstSpawn(); } }, (e) => { console.warn('homes', e); if (!snapOk) { snapOk = true; firstSpawn(); } }); } catch (e) { console.warn(e); }
  async function buyHome(h, btn) { try { if (myPlot) throw new Error('You already own a home (one per player). Move out first to buy another.'); if (owners.has(h.id)) throw new Error('Someone just bought this one!');
      busy(btn, 'Buying…'); const st = HOME_STYLES[h.style]; const { econ: e, dia: d } = await shop(); const inv = await e.inventory(true); if (!inv[st.item]) { if (st.d) await d.buy(st.item); else await e.buy(st.item); }
      const b = writeBatch(db); b.set(doc(db, 'homes', h.id), { owner: uid, name: S.profile.displayName, style: st.key, garage: 0, at: serverTimestamp() }); b.set(doc(db, 'users', uid, 'pal', 'home'), { plot: h.id, at: serverTimestamp() }); await b.commit();
      pan.hidden = true; say('🎉 You bought ' + st.name + '! Tap 🏠 Home any time to come back.'); try { api.sfx && api.sfx('coin'); } catch { /* */ } }
    catch (e) { btn.disabled = false; btn.textContent = 'Try again'; say(e.code === 'permission-denied' ? 'The shop isn’t open for homes yet (prices not published).' : /reading 'd'|Diamonds/.test(e.message || '') ? 'You need more 💎 Diamonds for this house.' : e.message || 'Could not buy'); } }
  async function buyGarage(t, btn) { try { const it = GARAGES[t - 1]; busy(btn, 'Building…'); const { econ: e, dia: d } = await shop(); const inv = await e.inventory(true); const have = GARAGES.slice(t - 1).some((g) => inv[g.item]);
      if (!have) { if (it.d) await d.buy(it.item); else await e.buy(it.item); } const o = owners.get(myPlot); await setDoc(doc(db, 'homes', myPlot), { owner: uid, name: S.profile.displayName, style: o.style, garage: t, at: serverTimestamp() }, { merge: true }); pan.hidden = true; say('🔧 Garage ready: ' + it.name); }
    catch (e) { btn.disabled = false; btn.textContent = 'Try again'; say(e.code === 'permission-denied' ? 'The shop isn’t open for garages yet (prices not published).' : e.message || 'Could not build'); } }
  async function moveOut(btn) { try { busy(btn, 'Moving out…'); const b = writeBatch(db); b.delete(doc(db, 'homes', myPlot)); b.delete(doc(db, 'users', uid, 'pal', 'home')); await b.commit(); save.cars = []; persist(true); pan.hidden = true; say('📦 Moved out. Your deed stays, so you can claim another house of that style for free.'); } catch (e) { btn.disabled = false; say(e.message || 'Could not move out'); } }
  function salePanel(h) { const st = HOME_STYLES[h.style]; panel(`<h3>🏷️ ${st.name}</h3><div class="row"><span>Plot ${h.id} · ${(h.town ? h.town : 'Kemy Street')}</span><b>${price(st)}</b></div><p><small>Living room, kitchen and bedroom inside. One home per player. Add a garage later.</small></p>${myPlot ? `<p><b>You already own ${myPlot}.</b></p>` : '<button data-b>Buy for ' + price(st) + '</button>'}`, (c) => { const b = c.querySelector('[data-b]'); if (b) b.onclick = () => buyHome(h, b); }); }
  function myPanel() { const h = HOUSE_BY_ID[myPlot]; const st = HOME_STYLES[h.style]; panel(`<h3>🏠 My ${st.name}</h3><div class="row"><span>Garage</span><b>${myTier ? myTier + ' bay' + (myTier > 1 ? 's' : '') : 'none'}</b></div>` + GARAGES.filter((g) => g.tier > myTier && g.tier <= maxTier(h)).map((g) => `<div class="row"><span>${g.name}</span><button data-g="${g.tier}">${price(g)}</button></div>`).join('') + `<p><small>${(() => { const G0 = garages.get(myPlot); const n = G0 ? G0.cars.length : 0; const ov = G0 ? G0.overflow : 0; return `🚗 ${n} car${n === 1 ? '' : 's'} parked here for everyone to see (garage holds ${garageCap(myTier)}, plus driveway${h.estate ? '' : ' + curb'} spots).${ov ? ` <b>${ov} more need a bigger garage.</b>` : ''}`; })()} Walk up to a parked car to drive it; drive home and tap 🅿️ Park at home.</small></p><div><button data-gu>🚪 Open house & invites</button><button data-rd>📻 House radio</button><button data-dc>🛠️ Decorate</button></div><button class="g" data-m>Move out</button>`,
    (c) => { c.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => buyGarage(+b.dataset.g, b))); c.querySelector('[data-gu]').onclick = () => guestPanel(); c.querySelector('[data-rd]').onclick = () => radioPanel(); c.querySelector('[data-dc]').onclick = () => { pan.hidden = true; if (inside && inside.id === myPlot) startDeco(); else { goIn(HOUSE_BY_ID[myPlot]); setTimeout(startDeco, 50); } }; c.querySelector('[data-m]').onclick = (e) => { if (e.target.dataset.sure) moveOut(e.target); else { e.target.dataset.sure = 1; e.target.textContent = 'Tap again to move out'; } }; }); }
  function homeFront(h) { const [x, z] = Lw(h, 0, h.d / 2 + 3.2); return { x, z, yaw: h.face > 0 ? 0 : Math.PI }; }
  function teleport(p) { if (inside) goOut(); P.x = p.x; P.z = p.z; P.yaw = p.yaw || 0; P.y = ground(p.x, p.z); api.markDirty && api.markDirty(); }
  homeB.onclick = () => { if (D && D.mine && D.mine() && D.mine().state !== 'parked') { say('Park and get out first 🙂'); return; }
    if (myPlot) { teleport(homeFront(HOUSE_BY_ID[myPlot])); say('🏠 Home sweet home'); return; }
    findHome('all', 0); };
  const placeName = (h) => (h.estate ? h.spot : h.city ? CITY_BY_ID[h.city].name : h.town ? ({ down: '🏙️ Kemy Downtown', farm: '🌾 Clover Fields', snow: '❄️ Frostberry', desert: '🌵 Sunstone', lake: '🛶 Willow Lake', shore: '🏖️ Sunny Shore' }[h.town] || h.town) : '🎃 Kemy Street');
  function findHome(f, pg) { const all = HOUSES.filter((h) => h.sale && !owners.has(h.id)); const free = all.filter((h) => f === 'all' || (f === 'estate' ? h.estate : f === 'old' ? !h.city && !h.estate : h.city === f)); const per = 25, pages = Math.max(1, Math.ceil(free.length / per)); pg = Math.min(pg, pages - 1);
    const tabs = [['all', 'All'], ['estate', '🏰 Mansions'], ['old', '🎃 Original towns'], ...CITIES.map((c) => [c.id, c.name])];
    panel(`<h3>🏠 Find a home</h3><p><small>${all.length} homes for sale right now (Star Coins or Diamonds). Mansions are the top tier.</small></p><div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${tabs.map(([k, n]) => `<button class="${k === f ? '' : 'g'}" data-f="${k}" style="white-space:nowrap">${n}</button>`).join('')}</div>`
      + free.slice(pg * per, pg * per + per).map((h) => `<div class="row"><span>${HOME_STYLES[h.style].name}<br><small>${h.id} · ${esc(placeName(h))}</small></span><button data-v="${h.id}">${price(HOME_STYLES[h.style])} · Visit</button></div>`).join('') + (free.length ? '' : '<p><small>Nothing for sale here right now.</small></p>')
      + (pages > 1 ? `<div class="row"><button class="g" data-p="${pg - 1}" ${pg ? '' : 'disabled'}>‹ Prev</button><small>Page ${pg + 1} / ${pages}</small><button class="g" data-p="${pg + 1}" ${pg < pages - 1 ? '' : 'disabled'}>Next ›</button></div>` : ''),
      (c) => { c.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { pan.hidden = true; const h = HOUSE_BY_ID[b.dataset.v]; const [x, z] = Lw(h, h.estate ? -10 : -6.3, h.d / 2 + (h.estate ? 14 : 6.2)); teleport({ x, z, yaw: h.face > 0 ? Math.PI : 0 }); }));
        c.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => findHome(b.dataset.f, 0))); c.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => findHome(f, +b.dataset.p))); }); }

  // ---------------------------------------------------------------- sitting (beds, chairs, couches; shared via presence dn='sit')
  const seatsHere = () => { const r = inside && rooms.get(inside.id); return r && r.I.seats ? r.I.seats() : []; };
  const seatTaken = (s) => { if (!api.others) return false; for (const o of api.others.values()) if (o.dn === 'sit' && Math.hypot(o.x - s.x, o.z - s.z) < 0.4) return true; return false; };
  function nearSeat() { let bi = -1, bd = 1.5; seatsHere().forEach((s, i) => { if (Math.abs(P.y - s.fl) > 1.2) return; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd && !seatTaken(s)) { bd = d; bi = i; } }); return bi; }
  function sitDown(i) { const s = seatsHere()[i]; if (!s || !inside || seatTaken(s)) return; P.sit = { x: s.x, z: s.z, y: s.y - 0.36, yaw: s.yaw, seat: s, back: [s.x + s.fx * 0.95, s.z + s.fz * 0.95, s.fl], off: () => standUp(true, true) };
    P.x = s.x; P.z = s.z; P.yaw = s.yaw; P.dance = 'sit'; P.danceUntil = Date.now() + 864e5; api.markDirty && api.markDirty(); api.send && api.send(true); window.__kh && (window.__kh.sit = s.c); }
  function standUp(quiet, fromMove) { const st = P.sit; if (!st) return; if (life.busy() === 'sleep') { life.act('wake'); return; } P.sit = null; if (P.dance === 'sit') { P.dance = ''; P.danceUntil = 0; } P.x = st.back[0]; P.z = st.back[1]; P.y = st.back[2]; P.vy = 0; void fromMove; api.markDirty && api.markDirty(); api.send && api.send(true); window.__kh && (window.__kh.sit = null); void quiet; }
  // ---------------------------------------------------------------- living room TV = house music player (owner picks, everyone inside hears)
  const tvC = document.createElement('canvas'); tvC.width = 256; tvC.height = 128; let tvTex = null, tvMeshes = [], tvT = 0, tvTitle = '', tvBy = '';
  function tvHide() { for (const m of tvMeshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); } tvMeshes = []; window.__kh && (window.__kh.tv = null); }
  function tvShow(title, by) { tvHide(); if (!inside) return; tvTitle = String(title || 'Music').slice(0, 28); tvBy = String(by || '').slice(0, 16); if (!tvTex) { tvTex = new THREE.CanvasTexture(tvC); tvTex.colorSpace = THREE.SRGBColorSpace; }
    const mat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }); for (const sc of (rooms.get(inside.id)?.I.screens?.() || [])) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), mat); m.position.set(sc.x, sc.y, sc.z); m.rotation.y = sc.yaw; m.name = 'tv-now-playing'; root.add(m); tvMeshes.push(m); }
    tvDraw(0); window.__kh && (window.__kh.tv = tvTitle); }
  function tvDraw(t) { const g = tvC.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 128); const h = (t * 40) % 360; gr.addColorStop(0, `hsl(${h},70%,32%)`); gr.addColorStop(1, `hsl(${(h + 80) % 360},75%,22%)`); g.fillStyle = gr; g.fillRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(46, 50, 28 + Math.sin(t * 6) * 3, 0, 7); g.fill(); g.font = '30px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('🎵', 46, 61);
    g.textAlign = 'left'; g.font = 'bold 17px sans-serif'; g.fillText(tvTitle, 84, 44, 166); g.font = '12px sans-serif'; g.fillStyle = 'rgba(255,255,255,.8)'; g.fillText('Now playing' + (tvBy ? ' · ' + tvBy + '’s TV' : ''), 84, 64, 166);
    for (let i = 0; i < 14; i++) { const v = 0.3 + 0.7 * Math.abs(Math.sin(t * (3 + i * 0.7) + i)); g.fillStyle = `hsla(${(h + i * 18) % 360},90%,70%,.95)`; g.fillRect(18 + i * 16, 118 - v * 34, 10, v * 34); } if (tvTex) tvTex.needsUpdate = true; }
  function tvAct() { if (!inside) return; const o = owners.get(inside.id); if (o && o.owner === uid && inside.id === myPlot) { radioPanel(); return; }
    if (rad) { if (radioOff === inside.id) { radioOff = null; startRadio(); } else say('📺 ' + (o && o.name ? o.name : 'The owner') + ' picks the music on this TV'); } else if (radioOff === inside.id) { radioOff = null; startRadio(); } else say('📺 The TV is off. Only ' + (o && o.name ? o.name : 'the owner') + ' can pick the music.'); }
  function nearTV() { const r = inside && rooms.get(inside.id); for (const sc of (r && r.I.screens ? r.I.screens() : [])) { if (Math.abs(P.y - sc.fl) > 1.2) continue; const dx = P.x - sc.x, dz = P.z - sc.z; const fwd = dx * Math.sin(sc.yaw) + dz * Math.cos(sc.yaw); if (Math.hypot(dx, dz) < 2.6 && fwd > -0.2) return true; } return false; }
  const lookOnly = () => !!(inside && inside.admin && !amAdmin); // 👑 the palace: visitors may only look around
  function roomPrompt() { if (lookOnly()) return null; const lp = life.prompt(); if (P.sit) return lp || { id: 'kh:stand', label: '🧍 Stand up' }; if (lp && lp.id !== 'kh:life:eatnow') return lp; const s = nearSeat(); if (s >= 0) { const c = seatsHere()[s].c; return { id: 'kh:sit:' + s, label: c[0] === 'b' ? '🛏️ Sit on bed' : c === 'cs' || c === 'cl' ? '🛋️ Sit' : '🪑 Sit' }; }
    if (nearTV()) { const o = owners.get(inside.id); return { id: 'kh:tv', label: o && o.owner === uid ? '📺 TV music' : rad ? '📺 Now playing' : '📺 TV' }; } return lp; }

  // ---------------------------------------------------------------- prompts + action routing
  api.houseLocked = (id) => { const h = HOUSE_BY_ID[id]; return !!(h && h.sale); };
  let promptNow = null; const prevPrompt = api.prompt; api.prompt = () => { const p0 = prevPrompt && prevPrompt(); if (p0) return p0; return promptNow; };
  const prevAct = api.onAction; api.onAction = (a) => { if (a && a.startsWith('kh:')) act(a.slice(3)); else if (prevAct) prevAct(a); };
  function act(a) { const [k, v] = a.split(':'); if (k === 'sale') salePanel(HOUSE_BY_ID[v]); else if (k === 'mine') myPanel(); else if (k === 'locked') { orphanCheck(v); say('🔒 ' + (owners.get(v)?.name || 'A Pal') + '’s home. Only the owner can go inside.'); } else if (k === 'out') goOut(); else if (k === 'sit') sitDown(+v); else if (k === 'stand') standUp(); else if (k === 'life') { if (v !== 'wait') life.act(v); } else if (k === 'tv') tvAct(); else if (k === 'park') parkHome(); else if (k === 'take') takeCar(pendingTake); }
  inB.onclick = () => { const h = HOUSE_BY_ID[inB.dataset.h]; if (h) goIn(h); };
  // my cars at home: walk up to any parked car to drive it; drive back home and tap Park to put it away (it reappears in its spot)
  const ownHomes = () => [...owners.entries()].filter(([, o]) => o.owner === uid).map(([id]) => HOUSE_BY_ID[id]).filter(Boolean);
  function nearMyCar() { let best = null, bd = 2.9; for (const h of ownHomes()) { const G0 = garages.get(h.id); if (!G0 || !G0.shown) continue; for (const { car, s } of G0.shown) { const fx = s.lv ? s.front[0] : s.x, fz = s.lv ? s.front[1] : s.z; const d = Math.hypot(P.x - fx, P.z - fz) - (s.lv ? 0 : 1.2); if (d < bd) { bd = d; best = { car, s, h }; } } } return best; }
  function takeCar(n) { if (!n) return; const { car, s, h } = n; if (owners.get(h.id)?.owner !== uid) return; const at = s.lv ? { x: s.front[0], z: s.front[1], yaw: s.yaw + Math.PI } : { x: s.x, z: s.z, yaw: s.yaw }; D.place(car.m, car.c, at, true); const G0 = garages.get(h.id); if (G0) placeCars(G0); say('🚗 ' + CAR[car.m].name + ' · drive safe!'); }
  function parkHome() { const m = D.mine(); if (!m) return; const h = ownHomes().find((q) => Math.hypot(q.x - m.x, q.z - m.z) < (q.estate ? 70 : 32)); if (!h) return; D.stash(); const [fx, fz] = Lw(h, -6.3, h.d / 2 + 6); P.x = fx; P.z = fz; P.y = ground(fx, fz); save.street = null; const G0 = garages.get(h.id); if (G0) placeCars(G0); persist(true); say('🅿️ Parked at home. Your car stays here for everyone to see.'); }
  let pendingTake = null;
  // owner car list -> homes/{plot}.cars (one write when it changes; visitors read nothing extra: it rides on the homes snapshot)
  let syncing = false, lastSync = '';
  async function syncCars(force) { if (!uid || !db || syncing) return; const mine = ownHomes(); if (!mine.length || !D || !D.ownedCars) return; syncing = true;
    try { const list = await D.ownedCars(); for (const h of mine) { const o = owners.get(h.id); const prevL = parseCars(o.cars); const out = list.map((c) => { const pv = prevL.find((q) => q.m === c.id); const p = c.plate || (pv && pv.p); return { m: c.id, c: c.color, ...(p ? { p } : {}) }; });
        const str = serCars(out.slice(0, h.admin ? ADMIN_CAP : 15)); if (str !== (o.cars || '') && (force || str !== lastSync)) { lastSync = str; await setDoc(doc(db, 'homes', h.id), { owner: uid, name: S.profile.displayName, style: o.style, garage: o.garage || 0, cars: str, at: serverTimestamp() }, { merge: true }); } } }
    catch (e) { console.warn('cars sync', e.code || e); } finally { syncing = false; } }
  addEventListener('kemy:cars-changed', () => syncCars(true));
  W.plateFor = (ownerUid, model) => { for (const o of owners.values()) if (o.owner === ownerUid) { const c = parseCars(o.cars).find((q) => q.m === model); if (c && c.p) return c.p; } return null; };
  // orphaned homes (owner account gone) go back on sale: checked only when someone looks at that house (1 cached read)
  const orphanChecked = new Set(); async function orphanCheck(id) { const o = owners.get(id); if (!o || orphanChecked.has(id) || !db || HOUSE_BY_ID[id]?.admin) return; orphanChecked.add(id); try { const u = await getDoc(doc(db, 'users', o.owner)); if (!u.exists()) { await deleteDoc(doc(db, 'homes', id)); say('🏷️ This home is back on sale!'); } } catch { /* */ } }
  // 👑 the admin palace: created by the admin's own client the first time (rules: admin only)
  let palaceTried = false; function ensurePalace() { if (!amAdmin || palaceTried || !db || owners.has(ADMIN_PLOT)) return; palaceTried = true; setDoc(doc(db, 'homes', ADMIN_PLOT), { owner: uid, name: S.profile.displayName, style: 'estate', garage: 0, at: serverTimestamp() }).catch((e) => console.warn('palace', e.code || e)); }
  W.landmarks = () => [{ name: '👑 Kemy Palace', x: HOUSE_BY_ID[ADMIN_PLOT].x, z: HOUSE_BY_ID[ADMIN_PLOT].z, gx: -190, gz: 1300 }];

  // ---------------------------------------------------------------- save / restore location (+ street car)
  let lastLS = 0, lastFS = 0, lastSent = null;
  function snapshot() { let x = P.x, z = P.z, yaw = P.yaw || 0; if (inside) { const f = homeFront(inside); x = f.x; z = f.z; yaw = f.yaw; } const m = D && D.mine && D.mine(); let street = null;
    if (m) { street = { id: m.id, c: m.color, x: Math.round(m.x * 10) / 10, z: Math.round(m.z * 10) / 10, yaw: Math.round(m.yaw * 100) / 100 }; }
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round(yaw * 100) / 100, cars: [], street }; }
  function persist(force) { const now = Date.now(); const s = snapshot(); Object.assign(save, s); if (force || now - lastLS > 3000) { lastLS = now; lss(LS, JSON.stringify(save)); }
    if (!uid || !db) return; const moved = !lastSent || Math.hypot(lastSent.x - s.x, lastSent.z - s.z) > 4 || JSON.stringify(lastSent.cars) !== JSON.stringify(s.cars) || JSON.stringify(lastSent.street) !== JSON.stringify(s.street);
    if (moved && (now - lastFS > (force ? 6000 : 30000))) { lastFS = now; lastSent = s; setDoc(doc(db, 'users', uid, 'pal', 'world'), { ...s, at: serverTimestamp() }).catch((e) => console.warn('world save', e.code || e)); } }
  const onHide = () => persist(true); addEventListener('pagehide', onHide); document.addEventListener('visibilitychange', onHide);
  let spawned = false; const startAt = { x: P.x, z: P.z };
  async function firstSpawn() { if (spawned) return; spawned = true; let fs = null; if (uid && db) try { const d = await getDoc(doc(db, 'users', uid, 'pal', 'world')); if (d.exists()) fs = d.data(); } catch { /* */ }
    if (fs) { if ('street' in fs) save.street = fs.street; }
    const loc = fs || (save.x != null ? save : null); if (Math.hypot(P.x - startAt.x, P.z - startAt.z) > 4) return; // already walking: don't yank
    if (myPlot) teleport(homeFront(HOUSE_BY_ID[myPlot])); else if (loc && loc.x != null) { const [x, z] = worldClamp(loc.x, loc.z); teleport({ x, z, yaw: loc.yaw }); }
    if (save.street && CAR[save.street.id] && D && D.place && !D.mine()) D.place(save.street.id, save.street.c || 0, { x: save.street.x, z: save.street.z, yaw: save.street.yaw }, false);
    showParked(); window.__kh && (window.__kh.spawned = myPlot ? 'home' : loc ? 'saved' : 'default'); }
  if (!uid) setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 50); setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 6000);

  // ---------------------------------------------------------------- per-frame: prompts, garage doors, light
  function update(dt) { life.update(dt); if (tvMeshes.length) { const q = Math.floor((tvT += dt) * 8); if (q !== tvDraw.q) { tvDraw.q = q; tvDraw(tvT); } } if (P.sit && !inside) standUp(true); promptNow = null; let showIn = null; const m = D && D.mine && D.mine(); const driving = m && m.state !== 'parked';
    if (inside) { const { cx, cz } = roomCell(inside); if (Math.hypot(P.x - cx, P.z - (cz + 5.4 * SC)) < 1.8) promptNow = { id: 'kh:out', label: '🚪 Go outside' }; else if (!deco) promptNow = roomPrompt(); }
    else if (!driving) { let best = null, bd = 2.8; for (const h of HOUSES) { const d = Math.hypot(h.door.x - P.x, h.door.z - P.z); if (d < bd) { bd = d; best = h; } }
      if (best) { const o = owners.get(best.id); if (best.sale) { if (!o) promptNow = { id: 'kh:sale:' + best.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[best.style]) }; else if (o.owner === uid) { promptNow = { id: 'kh:mine:' + best.id, label: '🏠 My home' }; showIn = best; } else if (canEnter(best)) showIn = best; else promptNow = { id: 'kh:locked:' + best.id, label: '🔒 ' + (o.name || 'A Pal') + '’s home' }; } else showIn = best; }
      else for (const h of HOUSES) if (h.sale && !owners.has(h.id)) { const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); if (Math.hypot(sx - P.x, sz - P.z) < 2.4) { promptNow = { id: 'kh:sale:' + h.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[h.style]) }; break; } } }
    garageTick(dt); signTick(dt);
    if (!inside && !promptNow) { if (driving) { if (Math.abs(m.speed) < 2 && ownHomes().some((q) => Math.hypot(q.x - m.x, q.z - m.z) < (q.estate ? 70 : 32))) promptNow = { id: 'kh:park', label: '🅿️ Park at home' }; }
      else { const n = nearMyCar(); if (n) { pendingTake = n; promptNow = { id: 'kh:take', label: '🚗 Drive ' + CAR[n.car.m].name }; } } }
    inB.hidden = !showIn; if (showIn) { inB.dataset.h = showIn.id; const ow = owners.get(showIn.id); inB.textContent = ow && ow.owner !== uid ? '🏠 Visit ' + String(ow.name || 'Pal').slice(0, 12) : '🏠 Go in'; }
    if (inside && roomLight) { roomLight.intensity = (LOW ? 18 : 26); const r = rooms.get(inside.id); if (r) { r.I.update(dt, P); if (roomLight2) { const up = P.y > FLAT + 2.5; roomLight2.position.set(r.cx + 3.4, FLAT + (up ? 5.9 : 2.7), r.cz + (up ? -2.5 : -1)); } if (deco) decoTick(dt); } }
    persist(false);
    window.__kh = Object.assign(window.__kh || {}, { myPlot, myTier, inside: inside && inside.id, owners: owners.size, cars: [...garages.values()].reduce((a, g) => a + g.carMs.length, 0), garages: garages.size, signs: signs.size, street: !!save.street, prompt: promptNow && promptNow.label }); }
  // debug only (kemy-pals-debug=1): pretend to own a plot locally to preview garages/interiors (no writes)
  const fakeOwn = (id, tier, cars, who) => { if (lsg('kemy-pals-debug') !== '1') return false; const h = HOUSE_BY_ID[id]; owners.set(id, { owner: who || uid, name: (who ? 'Pal ' + who : S.profile?.displayName) || 'Me', style: HOME_STYLES[h.style].key, garage: tier, ...(cars != null ? { cars } : {}) }); if (!who && !h.admin) { myPlot = id; myTier = tier; } drawSign(h); buildGarage(h); return true; };
  W.homeSpot = () => (myPlot ? homeFront(HOUSE_BY_ID[myPlot]) : null); W.leaveRoom = () => { if (inside) goOut(); };
  const life = attachHomeLife(api, { inside: () => inside, room: () => (inside && rooms.get(inside.id)) || null, say,
    sitAt: (o) => { P.sit = { x: o.x, z: o.z, y: o.y, yaw: o.yaw, seat: o.seat || null, back: o.back, off: () => (o.dn === 'sleep' ? life.act('wake') : null) }; P.x = o.x; P.z = o.z; P.yaw = o.yaw; api.markDirty && api.markDirty(); },
    unsit: () => { const st = P.sit; if (!st) return; P.sit = null; P.x = st.back[0]; P.z = st.back[1]; P.y = st.back[2]; P.vy = 0; api.markDirty && api.markDirty(); } });
  window.__khApi = { life, lookOnly, sitDown, standUp, seats: () => seatsHere().map((q) => ({ c: q.c, x: q.x, z: q.z, y: q.y })), screens: () => (inside && rooms.get(inside.id)?.I.screens()) || [], tvShow, tvAct, fakeOwn, startDeco, endDeco, deco: () => deco, guestPanel, radioPanel, rooms: () => rooms, ring: () => ring, goIn: (id) => goIn(HOUSE_BY_ID[id]), goOut, sale: (id) => salePanel(HOUSE_BY_ID[id]), home: () => homeB.click(), buy: (id) => buyHome(HOUSE_BY_ID[id], document.createElement('button')), garage: (t) => buyGarage(t, document.createElement('button')), parkHome, takeNear: () => takeCar(nearMyCar()), persist, shown: (id) => ((garages.get(id || myPlot) || {}).shown || []).map(({ car, s }) => ({ m: car.m, x: s.x, z: s.z, lv: s.lv || 0 })), garageInfo: (id) => { const g = garages.get(id || myPlot); return g ? { cars: g.carMs.length, shown: (g.shown || []).length } : null; }, syncCars, owners: () => owners, teleport };
  function destroy() { try { life.destroy(); } catch { /* */ } persist(true); removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); if (unsub) unsub(); roomState.box = null; roomState.inId = null; stopRadio(); if (roomLight) scene.remove(roomLight); if (roomLight2) scene.remove(roomLight2); radioBox.remove(); decB.remove(); dbar.remove(); scene.remove(root); homeB.remove(); inB.remove(); pan.remove(); css.remove(); }
  void Q; void K;
  return { update, destroy };
}
