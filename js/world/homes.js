// Kemy World property: buy a house on a "For Sale" plot (one owner each, any town), add a garage (1-3 bays),
// go inside furnished interiors (living room, kitchen, bedroom; built only when you walk in), drive into your own
// garage (the roll-up door opens for the owner and closes after), "Park here" saves the car in that bay, your last
// spot + a car left on the street are remembered (localStorage + a throttled private Firestore doc).
// Purchases use the existing validated coin / diamond shop paths; firestore.rules check deed + owner. Written by Lone Keem.
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, documentId, orderBy, limit, serverTimestamp, writeBatch, deleteDoc, addDoc } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { HOUSES, HOUSE_BY_ID, HOME_STYLES, GARAGES, FLAT, roomState, worldClamp, roomOf, garageCap, maxTier, ADMIN_CAP, ADMIN_PLOT, CITIES, CITY_BY_ID, METROS, housesNear, palaceBays, PALACE_SIGN, PALACE_SIGN_AT } from './layout.js';
import { CAR, CARS, PAINTS, buildCar, poseCar, addPlate } from './cars.js';
import { parseCar } from './drive.js';
import { GALLERY } from './cities.js';
import { checkInput, clean } from '../pals/talk.js';
import { ADMIN_EMAIL, EMU } from '../firebase-init.js';
import { attachHomeLife } from './homelife.js';
export const plateBad = (t) => { const s = String(t || ''); return !!(checkInput(s) || checkInput(s.toLowerCase()) || checkInput(s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').toLowerCase())); };
import { buildInterior, SC as SC0, scOf, DECOR, decorItem, parseItems, defaultItems, placedItems, packLayout, unpackStash, WALL_SW, WALL_ROOMS, parseWalls, parseFloors, serFloors, hex6, EXT_SW, FLOORS, healItems, placeItem } from './interior.js';
import { itemAabb, pickIndex, nearestReach, nudgePlan, screenStep, xzGap, stashOnRemove } from './decorate.js';
import { doorSpot, positionBad, standY } from './safe-spot.js';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const RADIO_RE = /^https:\/\/(?:open\.spotify\.com|embed\.music\.apple\.com|music\.apple\.com|(?:www\.|m\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com|(?:www\.)?youtu\.be)\//;
// House TV accepts the same YouTube links as the rest of Kemy. The id is checked again before an iframe is created.
export function ytRadioId(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/) || [])[1] || '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
export const radioLinkOk = (url) => { const u = String(url || '').trim(); return !!u && u.length <= 300 && RADIO_RE.test(u) && (!/youtube|youtu\.be/.test(u) || !!ytRadioId(u)); };

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
  const paintsOutside = (h) => !!(h && (h.sale || h.estate));
  W.recolorHouse = (id) => { const h = HOUSE_BY_ID[id]; if (!paintsOutside(h) || !W.paintHouse) return; const o = owners.get(id); W.paintHouse(id, (o && o.decor && o.decor.ext) || null); };
  const LS = 'kemy-world-save-' + (uid || 'anon'); let save = (() => { try { return JSON.parse(lsg(LS) || 'null') || {}; } catch { return {}; } })(); save.cars = save.cars || [];
  const say = (t) => (W.say ? W.say(t) : api.toast && api.toast(t));
  async function shop() { if (!econ) { const [{ createEconomy }, { createDiamonds }] = await Promise.all([import('../pals/economy.js'), import('../pals/armory.js')]); await registerHomeItems(); econ = createEconomy(db, uid); dia = createDiamonds(db, uid); } return { econ, dia }; }

  // ---------------------------------------------------------------- HUD: Go home button, second action button, panel
  const css = document.createElement('style'); css.textContent = `.kh-home{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 76px);top:calc(max(8px,env(safe-area-inset-top)) + 180px);pointer-events:auto;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(43,29,85,.75);color:#fff;font:800 14px Inter,sans-serif;padding:0 12px}
.kh-in,.kh-fl{position:absolute;left:50%;transform:translateX(-50%);pointer-events:auto;height:44px;border-radius:999px;border:2px solid #fff;color:#fff;font:800 15px Inter,sans-serif;padding:0 18px;z-index:8}.kh-in{bottom:calc(max(16px,env(safe-area-inset-bottom)) + 150px);background:#0f766e}.kh-fl{bottom:calc(max(16px,env(safe-area-inset-bottom)) + 206px);background:#7c3aed}.kh-in[hidden],.kh-fl[hidden],.kh-p[hidden]{display:none}
.kh-p{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,30,.55);pointer-events:auto;z-index:30}.kh-c{background:#fff;color:#111;border-radius:18px;padding:16px;width:min(92vw,380px);max-height:80vh;overflow:auto;font:500 14px Inter,sans-serif}
.kh-c h3{margin:0 0 6px;font:800 18px Inter,sans-serif;color:#111}.kh-c button{margin:6px 6px 0 0;border:0;border-radius:12px;padding:10px 14px;font:800 14px Inter,sans-serif;background:#6d28d9;color:#fff}.kh-c button.g{background:#e5e7eb;color:#111}.kh-c .row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;color:#111}.kh-c small{color:#444}
@media (orientation:landscape) and (max-height:500px){.kh-home{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 300px)}.kh-in{bottom:110px}.kh-fl{bottom:164px}}`;
  document.head.appendChild(css);
  const homeB = document.createElement('button'); homeB.className = 'kh-home'; homeB.textContent = '🏠 Home'; const inB = document.createElement('button'); inB.className = 'kh-in'; inB.hidden = true; const flB = document.createElement('button'); flB.id = 'kh-floor'; flB.className = 'kh-fl'; flB.hidden = true; flB.type = 'button'; flB.textContent = '🪜 Upstairs';
  const pan = document.createElement('div'); pan.className = 'kh-p'; pan.hidden = true; pan.innerHTML = '<div class="kh-c"></div>'; const card = pan.firstChild;
  pan.onclick = (e) => { if (e.target === pan) pan.hidden = true; }; const host = W.hud || view; host.append(homeB, inB, flB, pan);
  function panel(html, wire) { card.innerHTML = html + '<div><button class="g" data-x>Close</button></div>'; card.querySelector('[data-x]').onclick = () => (pan.hidden = true); pan.hidden = false; if (wire) wire(card); }
  const busy = (b, t) => { b.disabled = true; b.textContent = t; };

  // ---------------------------------------------------------------- signs: For Sale / owner nameplate (canvas, redrawn on change)
  const signs = new Map();
  function makeSign(h) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group(); const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); g.position.set(sx, FLAT, sz); g.rotation.y = h.face > 0 ? 0 : Math.PI;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.9, 0.12), std('#f8fafc')); post.position.y = 0.95; const bd = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); bd.position.set(0, 1.55, 0.08); g.add(post, bd); root.add(g); signs.set(h.id, { cv, tex, g }); drawSign(h); }
  // signs exist only near the player (hundreds of plots now): made within 90 m, dropped beyond 140 m
  let sT = 0; function signTick(dt) { if ((sT += dt) < 0.6) return; sT = 0; for (const h of housesNear(P.x, P.z, 160)) { if (!h.sale) continue; const d = Math.abs(h.x - P.x) + Math.abs(h.z - P.z); const s0 = signs.get(h.id); if (!s0 && d < 110) makeSign(h); else if (s0 && d > 180) { root.remove(s0.g); s0.tex.dispose(); s0.g.children.forEach((c) => c.geometry && c.geometry.dispose()); signs.delete(h.id); } } }
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
  const signOf = (o) => { const t = o && typeof o.sign === 'string' ? o.sign.trim() : ''; return t || PALACE_SIGN; };
  function buildGarage(h) { dropGarage(h.id); const o = owners.get(h.id); if (!o) return; const cars = parseCars(o.cars); const cap = capOf(h, o); if (!cap && !cars.length) return;
    if (h.admin) { try { buildPalaceYard(h, o, cars); } catch (err) { console.error('palace yard', err); } return; }
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
    for (const c of cols) box.push(c); const G0 = { g, slots, cars, carMs: [], cols, h, key: (o.cars || '') + '|' + cap, hide: '' }; garages.set(h.id, G0); placeCars(G0); }
  // 👑 Kemy Palace: no garage. Cars sit in tidy bays on the front pad. The gold sign hangs over the gate.
  function paintSign(text) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const x2 = cv.getContext('2d'); const gr = x2.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff4c2'); gr.addColorStop(1, '#d4a017'); x2.fillStyle = '#1f1300'; x2.fillRect(0, 0, 512, 128); x2.strokeStyle = gr; x2.lineWidth = 8; x2.strokeRect(6, 6, 500, 116); x2.fillStyle = gr; x2.textAlign = 'center'; x2.textBaseline = 'middle'; const label = text || PALACE_SIGN; x2.font = 'bold ' + (label.length > 16 ? 36 : 48) + 'px Georgia, serif'; x2.fillText(label, 256, 64); return cv; }
  function buildPalaceYard(h, o, cars) { const g = new THREE.Group(); g.name = 'garage-' + h.id; root.add(g); const ry = ry0(h);
    const slots = palaceBays().map((b) => { const [x, z] = Lw(h, b.x, b.z); return { x, y: FLAT + 0.06, z, yaw: ry + b.yaw, show: 1 }; });
    const t = new THREE.CanvasTexture(paintSign(signOf(o))); t.colorSpace = THREE.SRGBColorSpace; g.userData.tex = t;
    const boardY = FLAT + 3.235; const [sx, sz] = Lw(h, PALACE_SIGN_AT.x, PALACE_SIGN_AT.z);
    // Two thin boards, a finger-width apart, so the two sides never share a face and sparkle.
    for (const side of [1, -1]) { const mat = new THREE.MeshBasicMaterial({ map: t, side: THREE.FrontSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); const board = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.55), mat);
      const [bx, bz] = Lw(h, PALACE_SIGN_AT.x, PALACE_SIGN_AT.z + side * 0.03); board.position.set(bx, boardY, bz); board.rotation.y = ry + (side < 0 ? Math.PI : 0); g.add(board); }
    const cols = [];
    // Posts start above the paving and stop short of the board. Slim colliders sit beside the centre drive, not under it.
    for (const s2 of [-1, 1]) { const lx = PALACE_SIGN_AT.x + s2 * 4.05; const [qx, qz] = Lw(h, lx, PALACE_SIGN_AT.z); const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.36, 0.28), goldM); post.position.set(qx, FLAT + 1.26, qz); g.add(post);
      cols.push({ x0: qx - 0.14, x1: qx + 0.14, z0: qz - 0.14, z1: qz + 0.14, top: FLAT + 2.44, bot: -99 }); }
    for (const c of cols) box.push(c);
    const G0 = { g, slots, cars, carMs: [], cols, h, key: (o.cars || '') + '|' + capOf(h, o) + '|' + signOf(o), hide: '' }; garages.set(h.id, G0); placeCars(G0); }
  function hiddenModel(h) { const o = owners.get(h.id); if (!o) return ''; if (o.owner === uid) { const m = D && D.mine && D.mine(); return m ? m.id : ''; } // the owner's active car is out on the road, not parked
    if (api.others) for (const p of api.others.values()) if (p.uid === o.owner || p.id === o.owner) { const c = parseCar(p.dn); if (c) return c.id; } return ''; }
  function placeCars(G0) { for (const m of G0.carMs) { root.remove(m); m.traverse((q) => { if (q.userData && q.userData.plateTex) q.userData.plateTex.dispose(); }); } for (const c of G0.carCols || []) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } G0.carMs = []; G0.carCols = [];
    const hide = hiddenModel(G0.h); G0.hide = hide; let si = 0, skipped = false; G0.shown = [];
    for (const car of G0.cars) { if (!skipped && car.m === hide) { skipped = true; continue; } const s = G0.slots[si++]; if (!s) break; const m = buildCar(CAR[car.m], car.c, { lite: true, noShadow: LOW || G0.cars.length > 6 }); if (car.p) addPlate(m, car.p); poseCar(m, { x: s.x, y: s.y, z: s.z, yaw: s.yaw }, 0, 0); m.userData.slot = s; m.userData.car = car; root.add(m); G0.carMs.push(m); G0.shown.push({ car, s });
      if (!s.lv) { const cy = { x: s.x, z: s.z, r: CAR[car.m].Wd * 0.55, top: FLAT + CAR[car.m].H, parked: 1 }; api.cyl.push(cy); G0.carCols.push(cy); } }
    G0.overflow = Math.max(0, G0.cars.length - (skipped ? 1 : 0) - G0.slots.length); }
  function dropGarage(id) { const G0 = garages.get(id); if (!G0) return; for (const m of G0.carMs) root.remove(m); for (const c of G0.carCols || []) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } root.remove(G0.g); G0.g.traverse((q) => { if (q.userData.tex) q.userData.tex.dispose(); }); for (const c of G0.cols) { const i = box.indexOf(c); if (i >= 0) box.splice(i, 1); } garages.delete(id); }
  // near-only: (re)build garages within 140 m, drop beyond 200 m; checked twice a second (no reads, just the cached owners map)
  let gT = 0; function garageTick(dt) { if ((gT += dt) < 0.5) return; gT = 0; for (const [id, o] of owners) { const h = HOUSE_BY_ID[id]; if (!h) continue; const d = Math.hypot(h.x - P.x, h.z - P.z); const G0 = garages.get(id);
      if (d < 140 && !inside) { const key = (o.cars || '') + '|' + capOf(h, o) + (h.admin ? '|' + signOf(o) : ''); if (!G0 || G0.key !== key) { buildGarage(h); if (garages.get(id)) return; continue; } if (G0.hide !== hiddenModel(h)) placeCars(G0); } else if (G0 && d > 200) dropGarage(id); }
    for (const id of [...garages.keys()]) if (!owners.has(id)) dropGarage(id); }
  function showParked() { const G0 = myPlot && garages.get(myPlot); if (G0) placeCars(G0); }
  // ---------------------------------------------------------------- interiors (built on first entry, kept after)
  const rooms = new Map(); let roomLight = null, roomLight2 = null, deco = null, radioOff = null;
  function buildRoom(h) { if (rooms.has(h.id)) return rooms.get(h.id); const { cx, cz } = roomCell(h); const o = owners.get(h.id); const dec = (o && o.decor) || {};
    const I = buildInterior(api, { put, flush, G, y: FLAT }, h, cx, cz, dec); root.add(I.g); const r0 = { g: I.g, cx, cz, I, h, dk: JSON.stringify(dec) }; rooms.set(h.id, r0); return r0; }
  function applyDecor(id) { const o = owners.get(id); const dec = (o && o.decor) || {}; if (W.paintHouse && paintsOutside(HOUSE_BY_ID[id])) W.paintHouse(id, dec.ext || null); const r = rooms.get(id); const k = JSON.stringify(dec);
    if (r && r.dk !== k && !(deco && inside && inside.id === id)) { r.dk = k; r.I.setWall(dec.wall, dec.walls); r.I.setFloor(dec.floor || r.I.S.floor, dec.floors || ''); r.I.setItems(placedItems(dec, r.h, r.I.two)); } }
  const canEnter = (h) => { if (!h.sale) return true; const o = owners.get(h.id); if (!o) return false; return o.owner === uid || o.open === true || (Array.isArray(o.inv) && o.inv.includes(uid)); };
  // A doorbell or a visit on someone else's Kemy Street home. One note per owner per kind per half hour.
  const noted = new Map();
  function noteHouse(ownerUid, plot, kind) {
    if (!uid || !db || !S.profile || !ownerUid || ownerUid === uid) return;
    const key = ownerUid + ':' + kind; const now = Date.now();
    if (now - (noted.get(key) || 0) < 30 * 60 * 1000) return;
    noted.set(key, now);
    const text = kind === 'ring' ? 'rang your doorbell on Kemy Street' : 'visited your home on Kemy Street';
    addDoc(collection(db, 'users', ownerUid, 'notifications'), {
      type: 'house', fromUid: uid, fromName: S.profile.displayName, fromUsername: S.profile.username,
      postId: String(plot || '').slice(0, 40), text, createdAt: serverTimestamp(), read: false
    }).catch((e) => console.warn('house note', e && e.code));
  }
  // Someone at the door. The owner's open page hears it from their notification inbox.
  let pendingRing = null, ringBoot = true;
  const rungAt = new Map();
  function ringDoor(id) {
    const h = HOUSE_BY_ID[id]; const o = h && owners.get(id);
    if (!h || !o || !o.owner || o.owner === uid || canEnter(h)) return;
    const now = Date.now();
    if (now - (rungAt.get(id) || 0) < 15000) { say('🔔 You already rang. The owner can invite you in.'); return; }
    rungAt.set(id, now);
    try { dispatchEvent(new CustomEvent('kemy:house-ring', { detail: { plot: id } })); } catch { /* */ }
    say('🔔 You rang the doorbell. The owner can invite you in.');
  }
  function considerRing(d) {
    if (!d || d.type !== 'house' || !d.fromUid || d.fromUid === uid) return;
    if (!/rang your doorbell/.test(String(d.text || ''))) return;
    const plot = String(d.postId || '');
    if (myPlot && plot && plot !== myPlot) return;
    pendingRing = { uid: d.fromUid, name: String(d.fromName || 'A Pal').slice(0, 24), username: String(d.fromUsername || 'pal').replace(/[^a-z0-9_.]/gi, '').slice(0, 20) || 'pal', plot, at: Date.now() };
    say(pendingRing.name + ' rang your doorbell');
    paintInvite();
  }
  if (window.__kemyHouseRing) removeEventListener('kemy:house-ring', window.__kemyHouseRing);
  window.__kemyHouseRing = (e) => { const plot = e.detail && e.detail.plot; const o = plot && owners.get(plot); if (o && o.owner) noteHouse(o.owner, plot, 'ring'); };
  addEventListener('kemy:house-ring', window.__kemyHouseRing);
  function placeAt(p) { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return; P.sit = null; P.x = p.x; P.z = p.z; if (p.yaw != null) P.yaw = p.yaw; P.vy = 0; P.onGround = true; const gy = ground(p.x, p.z); let y = standY(Number.isFinite(gy) ? gy : FLAT, p.x, p.z); if (!Number.isFinite(y)) y = FLAT; P.y = y; try { if (p.cam != null && window.__p3 && window.__p3.setYaw) window.__p3.setYaw(((p.cam % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)); } catch { /* */ } api.markDirty && api.markDirty(); }
  function goIn(h) { if (!h) return; if (deco && deco.out) { say('Tap Done or Exit first. Outside decorating stays in the yard.'); return; } SC = scOf(h); if (!canEnter(h)) { say('🔒 Only the owner and invited friends can go inside'); return; } if (D && D.mine && D.mine() && D.mine().state !== 'parked') return; const r = buildRoom(h); if (deco) endDeco(false); inside = h; roomState.box = { x0: r.cx - 5.6 * SC, x1: r.cx + 5.6 * SC, z0: r.cz - 5.6 * SC, z1: r.cz + 5.5 * SC };
    standUp(true); P.x = r.cx; P.z = r.cz + 4.6 * SC; P.yaw = Math.PI; P.y = FLAT; P.vy = 0; P.onGround = true; try { if (window.__p3 && window.__p3.setYaw) window.__p3.setYaw(0); } catch { /* */ } if (!roomLight) { roomLight = new THREE.PointLight('#fff1d6', LOW ? 22 : 32, 22, 1.6); scene.add(roomLight); } roomLight.position.set(r.cx - 3 * SC, FLAT + 2.7, r.cz + 1.5); roomLight.visible = true; if (!LOW) { if (!roomLight2) { roomLight2 = new THREE.PointLight('#fff1d6', 24, 20, 1.6); scene.add(roomLight2); } roomLight2.position.set(r.cx + 3.5 * SC, FLAT + 2.7, r.cz - 2); roomLight2.visible = true; }
    roomState.inId = h.id; const ow = owners.get(h.id); if (ow && ow.owner && ow.owner !== uid) noteHouse(ow.owner, h.id, 'visit'); say(ow && ow.owner !== uid ? '🏠 Visiting ' + (ow.name || 'a Pal') + '’s home' : '🏠 Welcome in!' + (r.I.two ? ' Stairs to the 2nd floor are on the right.' : '')); radioOff = null; startRadio(); decB.hidden = !(ow && ow.owner === uid); yardB.hidden = true; api.markDirty && api.markDirty(); watchDecor(h.id); startParty(h, r); }
  function goOut(spot) { const h = inside; if (!h) { if (spot) placeAt(spot); return; } standUp(true); stopParty(); watchDecor(null); flB.hidden = true; tvHide(); if (deco && !deco.out) endDeco(false); inside = null; roomState.box = null; roomState.inId = null; decB.hidden = true; if (rad && !radioBox.hidden) minimizeRadio(); if (roomLight2) roomLight2.visible = false; placeAt(spot || doorSpot(h)); if (roomLight) roomLight.visible = false; api.send && api.send(true); }
  let partyP = null, party = null, decorUnsub = null;
  function watchDecor(id) {
    if (decorUnsub) { decorUnsub(); decorUnsub = null; }
    if (!id || !db || !uid) return;
    decorUnsub = onSnapshot(doc(db, 'homes', id), (snap) => {
      if (!snap.exists() || !inside || inside.id !== id) return;
      owners.set(id, snap.data());
      applyDecor(id);
    }, (e) => console.warn('house decor', e && e.code));
  }
  function stopParty() { partyP = null; if (party) { try { party.stop(); } catch { /* */ } party = null; } }
  function startParty(h, r) {
    stopParty();
    if (!db || !uid || !api.others) return;
    const job = partyP = import('./housemates.js').then((m) => {
      if (partyP !== job || !inside || inside.id !== h.id) return;
      party = m.startHouseParty({
        db, uid, plot: h.id, cx: r.cx, cz: r.cz, P, S, others: api.others, say,
        quietPark: api.quietPark, dropPal: api.dropPal,
        onFull: () => { say('This house is full (12 Pals). Try again in a little bit.'); goOut(); }
      });
    }).catch((e) => console.warn('house party', e));
  }
  function changeFloor() {
    if (!inside) return;
    const r = rooms.get(inside.id); if (!r || !r.I.two) return;
    standUp(true);
    const sc = scOf(inside); const up = P.y <= FLAT + 2.5;
    if (up) { P.x = r.cx + 3.3 * sc; P.z = r.cz - 1.4 * sc; P.y = FLAT + 3.4; P.yaw = Math.PI; }
    else { P.x = r.cx + 0.2 * sc; P.z = r.cz + 4.2 * sc; P.y = FLAT; P.yaw = 0; }
    P.vy = 0; P.onGround = true;
    try { if (window.__p3 && window.__p3.setYaw) window.__p3.setYaw(up ? 0 : Math.PI); } catch { /* */ }
    api.markDirty && api.markDirty();
  }
  flB.onclick = () => changeFloor();

  // ---------------------------------------------------------------- house radio (homes/{plot}.radio: Spotify/Apple/YouTube embed or Kemy Radio synced by startedAt)
  const css2 = document.createElement('style'); css2.textContent = `.kh-radio{position:absolute;left:50%;transform:translateX(-50%);top:calc(max(8px,env(safe-area-inset-top)) + 54px);width:min(92vw,340px);background:rgba(20,12,45,.88);color:#fff;border-radius:14px;padding:8px 10px;pointer-events:auto;z-index:9;font:600 13px Inter,sans-serif}.kh-radio[hidden],.kh-dbar[hidden],.kh-dec[hidden]{display:none}
.kh-rh{display:flex;justify-content:space-between;align-items:center;gap:6px}.kh-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kh-ract{display:flex;gap:4px;align-items:center;flex:0 0 auto}.kh-rh button,.kh-rb button{border:0;border-radius:10px;background:#7c3aed;color:#fff;font:800 13px Inter,sans-serif;padding:6px 10px;min-height:34px}.kh-rb iframe{width:100%;border:0;border-radius:10px;display:block}.kh-rb small,.kh-radio .mx-credit{display:block;opacity:.75;font-size:11px;margin:4px 0 0}.kh-radio .mx-credit a{color:#c4b5fd}
.kh-radio.min{width:200px;padding:6px 8px;z-index:20;touch-action:none;cursor:grab;user-select:none;box-shadow:0 8px 22px rgba(0,0,0,.35)}
.kh-radio.min .kh-rh{flex-wrap:wrap}.kh-radio.min .kh-title{flex:1 1 100%}.kh-radio.min .kh-ract{width:100%}.kh-radio.min .kh-ract button{flex:1;min-height:32px;padding:4px 6px}
.kh-radio.min .kh-rb iframe,.kh-radio.min .mx-embed{height:96px!important;max-height:96px;overflow:hidden}.kh-radio.min .kh-rb iframe{pointer-events:none}
.kh-radio.min .kh-rb > :not(iframe):not(.mx-embed),.kh-radio.min .mx-credit,.kh-radio.min .kh-note{display:none}
.kh-radio.dock{left:-9999px!important;top:0!important;right:auto!important;bottom:auto!important;width:min(92vw,340px)!important;transform:none!important;opacity:.02;pointer-events:none;z-index:0}
.kh-radio.dock .kh-rb iframe,.kh-radio.dock .mx-embed{height:152px!important;max-height:none;visibility:visible}
.kh-note-btn{position:absolute;width:40px;height:40px;padding:0;border-radius:50%;border:1px solid rgba(255,214,90,.9);background:rgba(20,12,45,.92);color:#ffe08a;font:800 20px/1 Inter,sans-serif;display:grid;place-items:center;z-index:21;pointer-events:auto;box-shadow:0 4px 14px rgba(0,0,0,.35);touch-action:manipulation}
.kh-note-btn[hidden]{display:none}.kh-note-btn .kh-eq{position:absolute;left:9px;right:9px;bottom:6px;height:8px;display:flex;align-items:flex-end;gap:2px;opacity:0}
.kh-note-btn.on{animation:kh-note-pulse 1.6s ease-in-out infinite}.kh-note-btn.on .kh-eq{opacity:.95}
.kh-note-btn .kh-eq i{flex:1;height:35%;background:#ffe08a;border-radius:1px;transform-origin:bottom}
.kh-note-btn.on .kh-eq i{animation:kh-eq .8s ease-in-out infinite}.kh-note-btn .kh-eq i:nth-child(2){animation-delay:-.25s}.kh-note-btn .kh-eq i:nth-child(3){animation-delay:-.45s}
@keyframes kh-note-pulse{50%{transform:scale(1.08);box-shadow:0 0 0 4px rgba(255,214,90,.28)}}
@keyframes kh-eq{50%{height:100%}}
@media (prefers-reduced-motion:reduce){.kh-note-btn.on,.kh-note-btn.on .kh-eq i{animation:none}.kh-note-btn.on .kh-eq i{height:70%}}
.kh-note-btn:focus-visible,.kh-radio button:focus-visible{outline:3px solid #ffd34d;outline-offset:3px}
.kh-now,.kh-pick{display:flex;gap:8px;align-items:center}.kh-now img,.kh-pick img{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none}.kh-pick small{display:block;opacity:.75;font-size:11px;font-weight:600}
.kh-dec,.kh-yard{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 76px);top:calc(max(8px,env(safe-area-inset-top)) + 226px);pointer-events:auto;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(15,118,110,.85);color:#fff;font:800 14px Inter,sans-serif;padding:0 12px}
.kh-stuck{position:absolute;right:max(10px,env(safe-area-inset-right));top:calc(max(8px,env(safe-area-inset-top)) + 108px);z-index:28;pointer-events:auto;height:44px;border-radius:999px;border:2px solid #fff;background:#c2410c;color:#fff;font:800 14px Inter,sans-serif;padding:0 12px;box-shadow:0 4px 12px rgba(0,0,0,.35)}
.kh-yard[hidden],.kh-dec[hidden]{display:none}
.kh-dbar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(8px,env(safe-area-inset-bottom)) + 150px);width:min(94vw,520px);display:flex;flex-direction:column;gap:6px;background:transparent;color:#111;pointer-events:none;z-index:12;font:600 13px Inter,sans-serif}
.kh-dbar .kh-handle,.kh-dbar .kh-tools,.kh-dbar .kh-body{pointer-events:auto;background:rgba(255,255,255,.96);border-radius:16px;box-shadow:0 8px 24px rgba(0,0,0,.28)}
.kh-dbar .kh-handle{display:flex;gap:6px;align-items:center;overflow-x:auto;touch-action:pan-x;padding:6px 8px}
.kh-dbar .kh-body{padding:0 8px 6px;max-height:86px;overflow:hidden}
.kh-dbar.open .kh-body{max-height:200px;overflow:auto}
.kh-dbar button{border:0;border-radius:10px;padding:7px 10px;font:800 15px Inter,sans-serif;background:#e5e7eb;color:#111;min-height:48px;flex:none}
.kh-dbar button.on,.kh-dbar button.p{background:#6d28d9;color:#fff}
.kh-dbar button.x{background:#fee2e2;color:#991b1b}
.kh-dbar .kh-acts{display:flex;gap:6px;flex:1 0 100%}
.kh-dbar .kh-acts button{flex:1}
.kh-dbar .kh-tabs{display:flex;gap:6px;flex:1 0 100%}
.kh-dbar .kh-tabs button{flex:1}
.kh-dbar.rooms .kh-body,.kh-dbar.tall .kh-body,.kh-dbar.tall.open .kh-body{max-height:46vh;overflow:auto}
.kh-dbar .kh-add{flex:1 0 100%;background:#15803d;color:#fff;min-height:52px;font-size:18px}
.kh-dbar .kh-cats{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;padding:4px 0}
.kh-dbar .kh-cats button{flex:none;min-height:40px;font-size:13px;padding:6px 8px}
.kh-dbar .kh-grid{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0 8px}
.kh-dbar .kh-grid .it{flex:1 1 86px;max-width:112px}
.kh-dbar .kh-parts{display:flex;gap:6px;position:sticky;top:46px;z-index:2;background:#fff;padding:4px 0}
.kh-dbar .kh-parts button{flex:1;min-height:44px;font-size:14px}
.kh-rooms{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 0}
.kh-rooms button{min-height:64px;font-size:16px}
.kh-swatches{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 0 8px}
.kh-dbar .sw{width:44px;height:44px;min-width:44px;min-height:44px}
.kh-dbar .sw.on{box-shadow:0 0 0 3px #6d28d9}
.kh-custom{display:flex;flex-direction:column;align-items:center;font-size:11px;font-weight:800;color:#333}
.kh-custom input[type=color]{width:48px;height:48px;border:0;padding:0;background:transparent}
.kh-dbar .kh-tip{margin:0;padding:2px 10px 0;color:#3f3f46;font:600 12px/1.35 Inter,sans-serif}
.kh-dbar .kh-grip{background:transparent;color:#111;padding-left:4px}
.kh-dbar .kh-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px}
.kh-dbar .kh-tools b,.kh-dbar .kh-tools small{flex:1 1 100%;color:#333;font-weight:700}
.kh-dbar .kh-strip{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;touch-action:pan-x;padding:6px 0 2px}
.kh-dbar .sw{width:32px;height:32px;border-radius:50%;padding:0;min-height:32px;min-width:32px;border:2px solid #fff;box-shadow:0 0 0 1px #94a3b8}
.kh-targets{display:flex;gap:6px;position:sticky;top:0;z-index:2;background:#fff;padding:6px 0 4px}
.kh-targets button{flex:1 1 22%;min-height:44px;font-size:13px;padding:6px 4px}
.kh-fam>span{display:block;font:800 12px/1.2 Inter,sans-serif;color:#3f3f46;margin:8px 0 0}
.kh-dbar .kh-swatches .sw{width:44px;height:44px;min-width:44px;min-height:44px;border-radius:12px;scroll-margin:76px 0 16px}
.kh-fam{scroll-margin-top:76px}
.kh-dbar .it{flex:0 0 78px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;min-height:68px;text-align:center;line-height:1.15}
.kh-dbar .it i{font-style:normal;font-size:20px}.kh-dbar .it em{font-style:normal;font-size:10px;color:#6d28d9}
.kh-dbar label{display:block;margin:6px 0 2px;font-weight:800}
body.kh-decorating #ks-map,body.kh-decorating .kh-home,body.kh-decorating .kh-yard,body.kh-decorating .kd-my,body.kh-decorating .p3-chat,body.kh-decorating .p3-log,body.kh-decorating #ks-bag,body.kh-decorating .p3-top,body.kh-decorating #p3-set,body.kh-decorating #p3-rot,body.kh-decorating .p3-rotip,body.kh-decorating .kc-gear{display:none!important}
body.kh-decorating .kh-stuck{display:inline-block!important}
@media (min-width:900px) and (pointer:fine){.kh-dbar{bottom:12px}}
@media (orientation:landscape) and (max-height:500px){.kh-dec,.kh-yard{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 400px)}.kh-stuck{top:calc(max(8px,env(safe-area-inset-top)) + 4px);right:calc(max(8px,env(safe-area-inset-right)) + 56px)}.kh-dbar{width:min(58vw,460px);left:auto;right:8px;bottom:8px;transform:none}.kh-dbar .kh-body,.kh-dbar.open .kh-body{max-height:28vh}.kh-radio:not(.min):not(.dock){top:calc(max(8px,env(safe-area-inset-top)) + 4px)}}`; document.head.appendChild(css2);
  const radioBox = document.createElement('div'); radioBox.className = 'kh-radio'; radioBox.hidden = true; const decB = document.createElement('button'); decB.className = 'kh-dec'; decB.textContent = '🛠️ Decorate'; decB.hidden = true;
  const yardB = document.createElement('button'); yardB.type = 'button'; yardB.className = 'kh-yard'; yardB.textContent = '🎨 Outside'; yardB.hidden = true; yardB.setAttribute('aria-label', 'Decorate the outside of your house');
  const stuckB = document.createElement('button'); stuckB.type = 'button'; stuckB.className = 'kh-stuck'; stuckB.textContent = 'Stuck? 🔄'; stuckB.setAttribute('aria-label', 'Stuck? Go back to your front door');
  const noteBtn = document.createElement('button'); noteBtn.type = 'button'; noteBtn.className = 'kh-note-btn'; noteBtn.hidden = true; noteBtn.setAttribute('aria-label', 'House music. Show player');
  noteBtn.innerHTML = '<span class="kh-note-glyph" aria-hidden="true">♪</span><span class="kh-eq" aria-hidden="true"><i></i><i></i><i></i></span>';
  const dbar = document.createElement('div'); dbar.className = 'kh-dbar'; dbar.hidden = true; host.append(radioBox, noteBtn, decB, yardB, stuckB, dbar);
  const radioKey = (o) => (o && o.radio ? JSON.stringify(o.radio) : '');
  let rad = null, miniAt = null, drag = null;
  const linkLabel = (url) => (ytRadioId(url) ? 'YouTube' : /apple/.test(url || '') ? 'Apple Music' : 'Spotify');
  function setRadioTitle(title) { const el = radioBox.querySelector('.kh-title'); if (el) el.textContent = title || 'Music'; if (rad) rad.tvTitle = title || rad.tvTitle; }
  function syncChrome() {
    const card = radioBox.classList.contains('min') && !radioBox.classList.contains('dock');
    const pp = radioBox.querySelector('[data-pp]'), mn = radioBox.querySelector('[data-min]'), ex = radioBox.querySelector('[data-ex]');
    if (pp) { pp.hidden = !card; pp.textContent = rad && rad.paused ? '▶' : '⏸'; pp.setAttribute('aria-label', rad && rad.paused ? 'Play' : 'Pause'); }
    if (mn) mn.hidden = card; if (ex) ex.hidden = !card;
    if (!noteBtn.hidden) {
      const title = (rad && rad.tvTitle) || 'House music';
      noteBtn.classList.toggle('on', !(rad && rad.paused));
      noteBtn.setAttribute('aria-label', (rad && rad.paused ? 'House music paused: ' : 'House music playing: ') + title + '. Show player');
    }
  }
  function paintChrome(title) {
    radioBox.classList.remove('min', 'dock'); radioBox.removeAttribute('aria-hidden');
    noteBtn.hidden = true; noteBtn.classList.remove('on');
    radioBox.style.left = radioBox.style.top = radioBox.style.right = radioBox.style.bottom = radioBox.style.transform = '';
    radioBox.innerHTML = `<div class="kh-rh"><b class="kh-title"></b><span class="kh-ract"><button type="button" data-pp hidden aria-label="Pause">⏸</button><button type="button" data-min aria-label="Minimize">Minimize</button><button type="button" data-ex hidden aria-label="Expand">Expand</button><button type="button" data-s aria-label="Close">✕</button></span></div><div class="kh-rb"></div>`;
    setRadioTitle(title); syncChrome();
  }
  function markPaused(p) { if (!rad) return; rad.paused = !!p; syncChrome(); }
  function controlPads() {
    const w = innerWidth, h = innerHeight;
    // The walking joystick sits in the lower-left corner and the action buttons sit lower-right, even before a thumb shows the knob.
    const pads = [{ l: 0, t: h - 190, r: 145, b: h }, { l: w - 160, t: h - 210, r: w, b: h }];
    document.querySelectorAll('#ks-act, .kc-joy, .kc-btns, .kh-in, .dh-c, #p3-set, #p3-rot, #ks-bag, #ks-map, .kh-home, .p3-top, .p3-joy, .p3-btns, .p3-chat, .p3-log, .gm-fab, .rs-q, .p3-act').forEach((el) => {
      if (el.hidden || el.closest('.kh-radio')) return;
      const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') return;
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return;
      pads.push({ l: r.left - 6, t: r.top - 6, r: r.right + 6, b: r.bottom + 6 });
    });
    return pads;
  }
  const hitsPad = (b) => controlPads().some((p) => b.l < p.r && b.r > p.l && b.t < p.b && b.b > p.t);
  function placeMini(l, t) {
    const w = radioBox.offsetWidth || 200, h = radioBox.offsetHeight || 160, m = 8;
    l = Math.max(m, Math.min(l, innerWidth - w - m)); t = Math.max(m, Math.min(t, innerHeight - h - m));
    radioBox.style.left = l + 'px'; radioBox.style.top = t + 'px'; radioBox.style.right = 'auto'; radioBox.style.bottom = 'auto'; radioBox.style.transform = 'none';
    miniAt = { l, t };
  }
  function headerBottom() {
    let b = 8;
    for (const sel of ['.p3-top', '#p3-set', '#ks-map']) {
      const el = document.querySelector(sel); if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect(); if (r.height < 8) continue;
      if (sel === '.p3-top' || r.right > innerWidth * 0.55) b = Math.max(b, r.bottom + 8);
    }
    return b;
  }
  function settleMini() {
    if (!radioBox.classList.contains('min')) return;
    const w = radioBox.offsetWidth || 200;
    const right = Math.max(8, innerWidth - w - 8);
    const below = headerBottom();
    const tries = [];
    for (let t = below; t >= 8; t -= 22) tries.push({ l: right, t });
    tries.push({ l: 8, t: below }, { l: 8, t: 8 }, { l: right, t: 8 });
    if (miniAt) tries.unshift(miniAt);
    for (const c of tries) {
      placeMini(c.l, c.t);
      const r = radioBox.getBoundingClientRect();
      if (!hitsPad({ l: r.left, t: r.top, r: r.right, b: r.bottom })) return;
    }
    placeMini(right, below);
  }
  function defaultMiniCorner() {
    const w = radioBox.offsetWidth || 200;
    return { l: Math.max(8, innerWidth - w - 8), t: headerBottom() };
  }
  function placeNote() {
    if (noteBtn.hidden) return;
    const size = 40, m = 8, w = innerWidth, h = innerHeight;
    const right = Math.max(m, w - size - m);
    let below = headerBottom();
    for (const sel of ['#p3-set', '#p3-rot', '.rs-q', '.gm-fab', '#ks-map', '.kh-home', '#ks-bag']) {
      const el = document.querySelector(sel); if (!el || el.hidden) continue;
      const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.left < w * 0.45) continue;
      below = Math.max(below, r.bottom + 8);
    }
    const spots = [{ l: right, t: below }, { l: m, t: below }, { l: right, t: Math.max(m, h - size - 220) }, { l: m, t: Math.max(m, h - size - 220) }];
    for (const c of spots) {
      const l = Math.max(m, Math.min(c.l, w - size - m)), t = Math.max(m, Math.min(c.t, h - size - m));
      noteBtn.style.left = l + 'px'; noteBtn.style.top = t + 'px'; noteBtn.style.right = 'auto'; noteBtn.style.bottom = 'auto';
      const r = noteBtn.getBoundingClientRect();
      const box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
      const fab = document.querySelector('.gm-fab');
      let onFab = false;
      if (fab) { const f = fab.getBoundingClientRect(); onFab = box.l < f.right + 10 && box.r > f.left - 10 && box.t < f.bottom + 10 && box.b > f.top - 10; }
      if (!onFab && !hitsPad(box)) return;
    }
    noteBtn.style.left = right + 'px'; noteBtn.style.top = below + 'px';
  }
  // Minimize hides the player completely. The iframe or audio stays mounted off-screen so Spotify, YouTube, and Apple keep playing.
  function dockRadio() {
    if (!rad || radioBox.hidden) return;
    radioBox.classList.remove('min'); radioBox.classList.add('dock'); radioBox.setAttribute('aria-hidden', 'true');
    radioBox.style.left = '-9999px'; radioBox.style.top = '0px'; radioBox.style.right = 'auto'; radioBox.style.bottom = 'auto'; radioBox.style.transform = 'none';
    const ae = document.activeElement;
    if (ae && ae !== noteBtn && (radioBox.contains(ae) || ae.tagName === 'IFRAME')) { try { ae.blur(); } catch { /* */ } }
    noteBtn.hidden = false; syncChrome(); placeNote(); noteBtn.focus();
    requestAnimationFrame(() => { if (radioBox.classList.contains('dock')) placeNote(); });
  }
  function restoreCard() {
    if (!rad || radioBox.hidden) return;
    radioBox.classList.remove('dock'); radioBox.classList.add('min'); radioBox.removeAttribute('aria-hidden');
    noteBtn.hidden = true; syncChrome();
    const spot = miniAt || defaultMiniCorner();
    placeMini(spot.l, spot.t); settleMini();
    requestAnimationFrame(() => { if (radioBox.classList.contains('min') && !radioBox.classList.contains('dock')) settleMini(); });
    const focus = radioBox.querySelector('[data-pp]') || radioBox.querySelector('[data-ex]');
    if (focus) focus.focus();
  }
  function minimizeRadio() { dockRadio(); }
  function expandRadio() {
    if (!rad) return;
    radioBox.classList.remove('min', 'dock'); radioBox.removeAttribute('aria-hidden'); noteBtn.hidden = true;
    radioBox.style.left = radioBox.style.top = radioBox.style.right = radioBox.style.bottom = radioBox.style.transform = '';
    syncChrome();
  }
  function togglePlay() {
    if (!rad) return;
    if (rad.au) { if (rad.au.paused) rad.au.play().then(() => markPaused(false)).catch(() => {}); else { rad.au.pause(); markPaused(true); } return; }
    if (!rad.emb || typeof rad.emb.toggle !== 'function' || !rad.emb.toggle()) return;
    if (rad.emb.service === 'youtube') markPaused(!rad.paused);
  }
  function closeRadio() { radioOff = (inside && inside.id) || (rad && rad.plot) || null; stopRadio(); }
  // YouTube (and the other embeds) stay the same iframe node. Minimize only resizes it — recreating the iframe pauses iPhone and Android.
  function mountHouseYouTube(body, id) {
    const frame = document.createElement('iframe');
    frame.className = 'kh-yt'; frame.title = 'YouTube'; frame.width = '100%'; frame.height = '180';
    frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen'); frame.allowFullscreen = true;
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=' + encodeURIComponent(location.origin);
    body.appendChild(frame);
    const note = document.createElement('small'); note.className = 'kh-note'; note.textContent = 'Tap ▶ on the video, then Minimize. It keeps playing while you walk, drive, or leave.'; body.appendChild(note);
    const cmd = (func) => { try { frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: '' }), '*'); } catch { /* */ } };
    frame.addEventListener('load', () => { try { frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify({ event: 'listening' }), '*'); } catch { /* */ } });
    dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'house-radio', service: 'youtube' } }));
    return { service: 'youtube', frame, toggle() { cmd(rad && rad.paused ? 'playVideo' : 'pauseVideo'); return true; }, pause() { cmd('pauseVideo'); },
      destroy() { cmd('stopVideo'); frame.remove(); dispatchEvent(new CustomEvent('kemy:media-stop', { detail: { source: 'house-radio', service: 'youtube' } })); } };
  }
  function fetchYtTitle(id, me0, by) {
    fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id)).then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!d || !d.title || rad !== me0) return;
      const title = String(d.title).replace(/\s+/g, ' ').trim().slice(0, 80);
      setRadioTitle(title); if (inside && inside.id === me0.plot) tvShow(title.slice(0, 28), by);
    }).catch(() => {});
  }
  radioBox.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || !radioBox.contains(b) || b.dataset.p != null) return;
    if (b.dataset.s != null) closeRadio(); else if (b.dataset.min != null) minimizeRadio(); else if (b.dataset.ex != null) expandRadio(); else if (b.dataset.pp != null) togglePlay();
  });
  radioBox.addEventListener('pointerdown', (e) => {
    if (!radioBox.classList.contains('min') || e.target.closest('button')) return;
    const r = radioBox.getBoundingClientRect();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, l: r.left, t: r.top, moved: false };
    try { radioBox.setPointerCapture(e.pointerId); } catch { /* */ }
    e.preventDefault();
  });
  radioBox.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (dx * dx + dy * dy > 36) drag.moved = true;
    placeMini(drag.l + dx, drag.t + dy);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved; drag = null;
    if (moved) settleMini(); else dockRadio();
  };
  radioBox.addEventListener('pointerup', endDrag);
  radioBox.addEventListener('pointercancel', (e) => { if (!drag || e.pointerId !== drag.id) return; drag = null; settleMini(); });
  function onMiniResize() { if (radioBox.classList.contains('dock')) placeNote(); else if (radioBox.classList.contains('min')) settleMini(); }
  noteBtn.addEventListener('click', (e) => { e.stopPropagation(); restoreCard(); });
  function onHouseMusic(ev) { const d = ev.detail || {}; if (!rad || d.source !== 'house-radio' || d.service !== 'spotify') return; markPaused(d.state !== 'play'); }
  addEventListener('resize', onMiniResize); addEventListener('kemy:music', onHouseMusic);
  async function startRadio() {
    if (!inside || radioOff === inside.id) return;
    const plot = inside.id, o = owners.get(plot), Rd = o && o.radio;
    if (!Rd || (Rd.k !== 'link' && Rd.k !== 'kemy')) { stopRadio(); return; }
    const key = radioKey(o);
    if (rad && rad.key === key && rad.plot === plot) { radioBox.hidden = false; tvShow(rad.tvTitle || 'Music', o.name); if (window.__kh) window.__kh.radio = Rd.k; return; }
    const yid = Rd.k === 'link' ? ytRadioId(Rd.url || '') : '';
    if (Rd.k === 'link' && !yid && (!RADIO_RE.test(Rd.url || '') || !radioLinkOk(Rd.url))) { stopRadio(); return; }
    stopRadio();
    const me0 = (rad = { key, plot, paused: false, tvTitle: Rd.k === 'kemy' ? 'Kemy Radio' : linkLabel(Rd.url || '') });
    paintChrome(me0.tvTitle); radioBox.hidden = false;
    const body = radioBox.querySelector('.kh-rb');
    if (Rd.k === 'link' && yid) { me0.emb = mountHouseYouTube(body, yid); setRadioTitle('YouTube'); fetchYtTitle(yid, me0, o.name); }
    else if (Rd.k === 'link') {
      const { musicEmbed, mountMusicEmbed } = await import('../embeds.js'); if (rad !== me0) return;
      const e = musicEmbed(Rd.url); if (!e) { stopRadio(); return; }
      e.height = Math.min(e.height || 152, 152); me0.emb = mountMusicEmbed(body, e, { source: 'house-radio' });
      const note = document.createElement('small'); note.className = 'kh-note'; note.textContent = 'Tap ▶ to listen. Spotify and Apple embeds play 30 s previews unless you’re signed in there.'; body.appendChild(note);
      setRadioTitle(e.service === 'apple' ? 'Apple Music' : 'Spotify');
    } else {
      const { TRACKS } = await import('../theme.js'); if (rad !== me0) return;
      const t = TRACKS[Rd.t | 0] || TRACKS[0]; const au = new Audio(); au.preload = 'none'; au.loop = true; au.volume = 0.5; if (!t.lazy) au.src = t.src; me0.au = au;
      const sync = () => { try { au.currentTime = Math.max(0, ((Date.now() - (Rd.s || Date.now())) / 1000) % (t.dur || 120)); } catch { /* */ } };
      body.innerHTML = `<div class="kh-now">${t.cover ? `<img src="${esc(t.cover)}" alt="" width="44" height="44">` : ''}<div><b>🎵 ${esc(t.title)}</b><small>${esc(t.artist)}${t.credit ? ` · ${esc(t.credit)}` : ''}</small><small class="kh-note">Everyone inside hears the same spot.</small></div></div><button type="button" data-p hidden>Tap to listen 🎵</button>`;
      const tb = body.querySelector('[data-p]');
      const go = () => { if (!au.getAttribute('src')) { au.preload = 'none'; au.src = t.src; } sync(); au.play().then(() => { tb.hidden = true; markPaused(false); dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'house-radio' } })); }).catch(() => { tb.hidden = false; markPaused(true); }); };
      tb.onclick = go; au.addEventListener('loadedmetadata', sync, { once: true }); go(); setRadioTitle(t.title);
    }
    if (rad !== me0) return;
    syncChrome(); tvShow(me0.tvTitle, o.name); if (window.__kh) window.__kh.radio = Rd.k;
  }
  function stopRadio() {
    tvHide();
    if (rad) { try { if (rad.emb) rad.emb.destroy(); } catch { /* */ } if (rad.au) { try { rad.au.pause(); rad.au.removeAttribute('src'); rad.au.load(); } catch { /* */ } dispatchEvent(new CustomEvent('kemy:media-stop', { detail: { source: 'house-radio' } })); } }
    rad = null; miniAt = null; drag = null; radioBox.classList.remove('min', 'dock'); radioBox.removeAttribute('aria-hidden');
    noteBtn.hidden = true; noteBtn.classList.remove('on');
    radioBox.style.left = radioBox.style.top = radioBox.style.right = radioBox.style.bottom = radioBox.style.transform = '';
    radioBox.hidden = true; radioBox.innerHTML = ''; if (window.__kh) window.__kh.radio = null;
  }
  // owner writes (merge; rules re-check owner/name/garage/at on every write)
  const homeW = (patch) => { const o = owners.get(myPlot); return setDoc(doc(db, 'homes', myPlot), { ...patch, owner: uid, name: S.profile.displayName, style: o.style, garage: o.garage || 0, at: serverTimestamp() }, { merge: true }); };
  const wErr = (e) => say(e && e.code === 'permission-denied' ? '⚠️ Saving this needs the updated house rules (ask the admin to deploy firestore.rules)' : (e && e.message) || 'Could not save');
  function radioPanel() { const o = owners.get(myPlot) || {}; const Rd = o.radio || {}; import('../theme.js').then(({ TRACKS }) => panel(`<h3>📺 TV &amp; house music</h3><p><small>Plays on the living room TV for you and visitors while inside. Paste a Spotify, Apple Music, or YouTube link, or pick a Kemy Radio track (synced for everyone). Minimize tucks it into a small music button and keeps it playing while you walk around.</small></p>
      <input data-u placeholder="https://open.spotify.com/… or a YouTube link" value="${esc(Rd.k === 'link' ? Rd.url : '')}" style="width:100%;min-height:40px;border-radius:10px;border:1px solid #ccc;padding:0 8px;box-sizing:border-box"><button data-l>Use link</button>
      <div class="kh-pick" style="margin-top:8px"><img data-cv alt="" width="44" height="44" hidden><div style="flex:1;min-width:0"><select data-t style="min-height:40px;border-radius:10px;max-width:100%">${TRACKS.map((t, i) => `<option value="${i}" ${Rd.k === 'kemy' && (Rd.t | 0) === i ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select><small data-cr></small></div></div><button data-k>Play Kemy Radio</button><button class="g" data-o>Radio off</button>`,
    (c) => { const sel = c.querySelector('[data-t]'), img = c.querySelector('[data-cv]'), cr = c.querySelector('[data-cr]');
      const paintPick = () => { const t = TRACKS[+sel.value] || TRACKS[0]; if (t.cover) { img.hidden = false; img.src = t.cover; } else { img.hidden = true; img.removeAttribute('src'); } cr.textContent = `${t.artist}${t.credit ? ' · ' + t.credit : ''}`; };
      sel.onchange = paintPick; paintPick();
      c.querySelector('[data-l]').onclick = () => { const u = c.querySelector('[data-u]').value.trim(); if (!radioLinkOk(u)) { say('Paste an open.spotify.com, music.apple.com, or YouTube link'); return; } homeW({ radio: { k: 'link', url: u } }).then(() => { pan.hidden = true; say('📻 Radio set'); }).catch(wErr); };
      c.querySelector('[data-k]').onclick = () => homeW({ radio: { k: 'kemy', t: +c.querySelector('[data-t]').value, s: Date.now() } }).then(() => { pan.hidden = true; say('📻 Kemy Radio on'); }).catch(wErr);
      c.querySelector('[data-o]').onclick = () => homeW({ radio: { k: 'off' } }).then(() => { pan.hidden = true; say('📻 Radio off'); }).catch(wErr); })); }
  function guestPanel() { const o = owners.get(myPlot) || {}; const inv = Array.isArray(o.inv) ? o.inv : [], invN = Array.isArray(o.invN) ? o.invN : [];
    panel(`<h3>🚪 Open house & invites</h3><div class="row"><span>Open house<br><small>${o.open ? 'Anyone can visit' : 'Only you + invited friends'}</small></span><button data-o>${o.open ? 'On ✅' : 'Off'}</button></div>
      <div class="row"><input data-n placeholder="@username" style="flex:1;min-height:38px;border-radius:10px;border:1px solid #ccc;padding:0 8px"><button data-a>Invite</button></div>${inv.map((u, i) => `<div class="row"><span>@${esc(invN[i] || 'pal')}</span><button class="g" data-r="${i}">Remove</button></div>`).join('') || '<p><small>No invites yet.</small></p>'}`,
    (c) => { c.querySelector('[data-o]').onclick = () => homeW({ open: !o.open }).then(() => { pan.hidden = true; say(o.open ? '🔒 Home closed to visitors' : '🚪 Open house! Anyone can visit'); }).catch(wErr);
      c.querySelector('[data-a]').onclick = async () => { const n = c.querySelector('[data-n]').value.trim().replace(/^@/, '').toLowerCase(); if (!/^[a-z0-9_.]{2,20}$/.test(n)) { say('Type a username'); return; } if (inv.length >= 50) { say('Max 50 invites'); return; }
        try { const d = await getDoc(doc(db, 'usernames', n)); const u2 = d.exists() && d.data().uid; if (!u2) { say('No Pal named @' + n); return; } if (u2 === uid || inv.includes(u2)) { say('Already invited'); return; } await homeW({ inv: [...inv, u2], invN: [...invN, n] }); pan.hidden = true; say('✉️ Invited @' + n); } catch (e) { wErr(e); } };
      c.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { const i = +b.dataset.r; homeW({ inv: inv.filter((_, j) => j !== i), invN: invN.filter((_, j) => j !== i) }).then(() => { pan.hidden = true; say('Removed'); }).catch(wErr); })); }); }
  function ownerHere() {
    if (!myPlot || (pendingRing && pendingRing.plot && pendingRing.plot !== myPlot)) return false;
    if (inside && inside.id === myPlot) return true;
    if (inside) return false;
    const h = HOUSE_BY_ID[myPlot];
    return !!(h && Math.hypot(h.door.x - P.x, h.door.z - P.z) < 18);
  }
  function paintInvite() {
    const fresh = pendingRing && Date.now() - pendingRing.at < 3 * 60 * 1000 && ownerHere();
    if (fresh) { const lab = '✉️ Invite ' + pendingRing.name.slice(0, 12); if (homeB.textContent !== lab) homeB.textContent = lab; homeB.dataset.ring = '1'; return lab; }
    if (homeB.dataset.ring) { homeB.textContent = '🏠 Home'; delete homeB.dataset.ring; }
    return '';
  }
  async function inviteRinger() {
    const r = pendingRing; if (!r || !myPlot) return;
    const o = owners.get(myPlot) || {}; const inv = Array.isArray(o.inv) ? o.inv.slice() : [], invN = Array.isArray(o.invN) ? o.invN.slice() : [];
    if (inv.includes(r.uid)) { pendingRing = null; paintInvite(); say('✉️ ' + r.name + ' is already invited'); return; }
    if (inv.length >= 50) { say('Max 50 invites'); return; }
    try { await homeW({ inv: inv.concat(r.uid), invN: invN.concat(r.username || 'pal') }); pendingRing = null; paintInvite(); say('✉️ Invited ' + r.name + ' in'); }
    catch (e) { wErr(e); }
  }

  // ---------------------------------------------------------------- 🛠️ Decorate mode (owner, inside): paint, floors, furniture on a 0.5 m grid
  let owned = null; async function loadOwned() { try { const { econ: e } = await shop(); owned = await e.inventory(true); } catch { owned = {}; } return owned; }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 32), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.9, depthTest: false })); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 9; ring.visible = false; root.add(ring);
  const hi = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.32, depthTest: false })); hi.renderOrder = 8; hi.visible = false; root.add(hi);
  const hiEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#facc15', depthTest: false })); hiEdge.renderOrder = 9; hiEdge.visible = false; root.add(hiEdge);
  const passMove = W.move || ((m) => m);
  W.move = (m) => { if (deco && deco.out) return passMove(m); if (deco && deco.moving && deco.sel >= 0 && m && m.mag > 0.2) { deco.stick = m; return { x: 0, y: 0, mag: 0, run: false }; } if (deco) deco.stick = null; return passMove(m); };
  function itemBaseY(it) { return FLAT + (it.f && deco.r.I.two ? 3.35 : 0); }
  function aabbOf(it) { return itemAabb(it, SC, deco.r.cx, deco.r.cz, itemBaseY(it)); }
  function sameFloor(it) { if (!deco.r.I.two) return true; return (it.f || 0) === (P.y > FLAT + 2.5 ? 1 : 0); }
  let roomEditP = null;
  const loadRoomEdit = () => (roomEditP || (roomEditP = import('./roomedit.js')));
  function inRoom(it) { if (!deco.room) return true; if (!deco.edit) return false; return deco.edit.itemRoom(it.x, it.z, it.f) === deco.room; }
  function keepInRoom(it, keepRot) { if (!(deco.room && deco.edit && it)) return it; return deco.edit.isWall(it.c) ? deco.edit.snapWall(it, deco.room, !!keepRot) : deco.edit.clampToRoom(it, deco.room); }
  function aabbWalk(it) { if (deco.room && !inRoom(it)) return null; return sameFloor(it) ? aabbOf(it) : null; }
  function nearest() { return nearestReach(deco.items, P.x, P.z, aabbWalk, 1.35); }
  function focusRoom(id) {
    const R = deco.edit && deco.edit.roomById(id); const r = deco.r; if (!R || !r) return;
    const sc = scOf(r.h); P.sit = null; P.x = r.cx + R.x * sc; P.z = r.cz + R.z * sc; P.y = R.up ? FLAT + 3.4 : FLAT; P.yaw = R.yaw; P.vy = 0; P.onGround = true;
    try { if (window.__p3 && window.__p3.setYaw) window.__p3.setYaw(R.cam); } catch { /* */ }
    if (roomLight) roomLight.position.set(P.x, P.y + 2.4, P.z); api.markDirty && api.markDirty();
  }
  function surfNow() { if (!deco.r) return; deco.r.I.setWall(deco.wall, deco.walls); deco.r.I.setFloor(deco.floor, serFloors(deco.surf)); }
  function camBasis() {
    const cam = api.cam; let fx = 0, fz = 1;
    if (cam) { fx = P.x - cam.position.x; fz = P.z - cam.position.z; const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len; }
    return { fx, fz, rx: fz, rz: -fx };
  }
  function placeHi() {
    const it = deco && deco.items[deco.sel];
    ring.visible = hi.visible = hiEdge.visible = !!it;
    if (!it) return;
    const b = aabbOf(it); const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, cz = (b.z0 + b.z1) / 2;
    const sx = Math.max(0.45, b.x1 - b.x0), sy = Math.max(0.45, b.y1 - b.y0), sz = Math.max(0.45, b.z1 - b.z0);
    hi.position.set(cx, cy, cz); hi.scale.set(sx, sy, sz); hiEdge.position.copy(hi.position); hiEdge.scale.copy(hi.scale);
    ring.position.set(cx, b.y0 + 0.05, cz); ring.scale.setScalar(Math.max(0.8, Math.max(sx, sz) * 0.55));
  }
  function snapDeco() { return { items: deco.items.map((i) => ({ ...i, ...(i.parts ? { parts: { ...i.parts } } : {}) })), stash: deco.stash.slice(), wall: deco.wall, walls: deco.walls, floor: deco.floor, surf: { ...(deco.surf || {}) }, ext: { ...deco.ext }, sel: deco.sel, room: deco.room || '' }; }
  function remember() { if (!deco) return; deco.hist = deco.hist || []; deco.hist.push(snapDeco()); if (deco.hist.length > 25) deco.hist.shift(); }
  function undoDeco() {
    if (!deco || !deco.hist || !deco.hist.length) { say('Nothing to undo'); return; }
    const s = deco.hist.pop();
    deco.items = s.items; deco.stash = s.stash; deco.wall = s.wall; deco.walls = s.walls; deco.floor = s.floor; deco.surf = s.surf || {}; deco.ext = s.ext; deco.sel = s.sel; deco.room = s.room || ''; deco.moving = false; deco.paintNoted = false;
    if (!deco.out && deco.r) { relItems(); surfNow(); if (deco.room) focusRoom(deco.room); }
    else if (W.paintHouse) W.paintHouse(myPlot, deco.ext);
    drawDeco();
  }
  function nudgeScreen(sx, sy) {
    const it = deco && !deco.out && deco.items[deco.sel]; if (!it || !inRoom(it)) return;
    remember(); const step = screenStep(sx, sy, camBasis()); nudgePlan(it, step.dx, step.dz); keepInRoom(it); relItems(); placeHi();
  }
  function rotateSel() { const it = deco && !deco.out && deco.items[deco.sel]; if (!it || !inRoom(it)) return; remember(); it.r = (it.r + 1) & 3; if (deco.edit && deco.edit.isWall(it.c)) keepInRoom(it, true); else { placeItem(it); keepInRoom(it); } relItems(); placeHi(); }
  function starterOf(r) { return parseItems(defaultItems(r.I.two, r.h && r.h.num ? r.h.seed : 0)); }
  function removeSel() {
    if (!deco || deco.out || deco.sel < 0 || !inRoom(deco.items[deco.sel])) return; remember(); const it = deco.items[deco.sel]; const name = (DECOR[it.c] && DECOR[it.c].n) || 'Piece'; const code = it.c;
    const before = deco.stash.length; deco.items.splice(deco.sel, 1); stashOnRemove(code, deco.base, deco.items.filter((q) => q.c === code).length, deco.stash);
    deco.sel = -1; deco.moving = false; relItems(); drawDeco();
    say(deco.stash.length > before ? name + ' is in your furniture. Place it again any time, free.' : name + ' put away. You can place it again.');
  }
  function selectItem(i) { if (!deco || deco.out || i < 0 || i >= deco.items.length || !inRoom(deco.items[i])) return; if (deco.sel === i) { placeHi(); return; } deco.sel = i; deco.resetSure = false; const spec = deco.edit && deco.edit.partsFor(deco.items[i].c); if (spec) { deco.paintTarget = 'item'; if (!spec.some(([k]) => k === deco.part)) deco.part = spec[0][0]; } placeHi(); paintTools(); markMine(); if (deco.tab === 'c') paintBody(); }
  function beginOutside() {
    const h = HOUSE_BY_ID[myPlot]; if (!h || inside || deco) return;
    if (D && D.mine && D.mine() && D.mine().state !== 'parked') { say('Park and get out first 🙂'); return; }
    const near = Math.hypot(P.x - h.x, P.z - h.z) < (h.estate ? 55 : 28);
    if (!near || positionBad(P.x, P.z) || !Number.isFinite(P.y)) placeAt(doorSpot(h));
    else { const y = standY(ground(P.x, P.z), P.x, P.z); if (P.y < y - 0.2) { P.y = y; P.vy = 0; P.onGround = true; } }
    const o = owners.get(myPlot) || {}; const d0 = o.decor || {};
    deco = { out: true, spot: { x: P.x, z: P.z, y: P.y, yaw: P.yaw || 0 }, r: null, wall: d0.wall || '', walls: d0.walls || '', wroom: '', floor: d0.floor || '', surf: parseFloors(d0.floors), ext: { w: '', r: '', d: '', t: '', ...(d0.ext || {}) }, items: [], stash: [], base: {}, sel: -1, tab: 'p', room: '', hist: [], t: 0, open: true, moving: false, drag: null, stick: null, stickT: 0, parkedRadio: false, resetSure: false };
    document.body.classList.add('kh-decorating'); yardB.hidden = true; decB.hidden = true;
    if (rad && !radioBox.hidden && !radioBox.classList.contains('dock')) { dockRadio(); deco.parkedRadio = true; }
    drawDeco(); window.__kh && (window.__kh.deco = true); say('Decorating the outside. You stay in the yard.');
  }
  function startDeco(mode) {
    if (deco) return;
    if (mode === 'out' || (mode !== 'in' && !inside)) { beginOutside(); return; }
    if (!inside || !myPlot || inside.id !== myPlot) return; const r = rooms.get(myPlot); const o = owners.get(myPlot) || {}; const d0 = o.decor || {};
    const base = {}; for (const it of starterOf(r)) base[it.c] = (base[it.c] || 0) + 1;
    deco = { out: false, spot: { x: P.x, z: P.z, y: P.y, yaw: P.yaw || 0 }, r, wall: d0.wall || r.I.S.wall, walls: d0.walls || '', wroom: '', floor: d0.floor || r.I.S.floor, surf: parseFloors(d0.floors), ext: { w: '', r: '', d: '', t: '', ...(d0.ext || {}) }, items: r.I.items().map((i) => ({ ...i, ...(i.parts ? { parts: { ...i.parts } } : {}) })), stash: unpackStash(d0.items), base, sel: -1, tab: 'c', cat: 'plant', part: 'f', room: '', edit: null, editState: 'loading', hist: [], t: 0, open: true, moving: false, drag: null, stick: null, stickT: 0, parkedRadio: false, resetSure: false, paintNoted: false, paintTarget: 'wall' };
    document.body.classList.add('kh-decorating');
    if (rad && !radioBox.hidden && !radioBox.classList.contains('dock')) { dockRadio(); deco.parkedRadio = true; }
    loadOwned().then(() => deco && drawDeco());
    loadRoomEdit().then((mod) => { if (!deco || deco.out) return; deco.edit = mod; deco.editState = 'ready'; drawDeco(); }).catch(() => { if (!deco || deco.out) return; deco.editState = 'fail'; drawDeco(); });
    drawDeco(); decB.hidden = true; yardB.hidden = true; window.__kh && (window.__kh.deco = true); }
  function endDeco(save) { const d = deco; if (!d) return;
    if (save && !d.out) { const packed = packLayout(d.items, d.stash); const floors = serFloors(d.surf || {}); if (packed.length > 2000 || floors.length > 160) { say(packed.length > 2000 ? 'Too many pieces to save. Remove one, then tap Done.' : 'Too many colours to save.'); return; } }
    document.body.classList.remove('kh-decorating'); const parked = d.parkedRadio; const spot = d.spot; deco = null; dbar.hidden = true; dbar.classList.remove('rooms', 'tall'); ring.visible = false; hi.visible = false; hiEdge.visible = false; decB.hidden = !(inside && inside.id === myPlot); window.__kh && (window.__kh.deco = false);
    if (parked && rad && !radioBox.hidden) restoreCard();
    if (d.out) {
      if (save) { const prev = (owners.get(myPlot) || {}).decor || {}; const dec = { ext: d.ext, v: 2 }; if (typeof prev.items === 'string') dec.items = prev.items; if (prev.wall) dec.wall = prev.wall; if (prev.walls) dec.walls = prev.walls; if (prev.floor) dec.floor = prev.floor; if (prev.floors) dec.floors = prev.floors; homeW({ decor: dec }).then(() => say('💾 Outside colours saved. You are still in the yard.')).catch((e) => { wErr(e); applyDecor(myPlot); }); }
      else { applyDecor(myPlot); say('Old outside colours are back. You stayed in the yard.'); }
      const y = standY(ground(P.x, P.z), P.x, P.z);
      if (inside || positionBad(P.x, P.z) || !Number.isFinite(P.y) || P.y < y - 0.4) placeAt(spot);
      return;
    }
    if (save) { const floors = serFloors(d.surf || {}); const dec = { wall: d.wall, ...(d.walls ? { walls: d.walls } : {}), floor: d.floor, ...(floors ? { floors } : {}), ext: d.ext, items: packLayout(d.items, d.stash), v: 2 }; homeW({ decor: dec }).then(() => say('💾 Home saved! Visitors see your new look.')).catch((e) => { wErr(e); applyDecor(myPlot); }); const r = rooms.get(myPlot); if (r) r.dk = JSON.stringify(dec); }
    else { const r = rooms.get(myPlot); if (r) r.dk = ''; applyDecor(myPlot); } }
  const relItems = () => { if (deco && !deco.out && deco.r) deco.r.I.setItems(deco.items); };
  function decoTick(dt) {
    if (!deco || deco.out || !deco.r) return;
    if (!deco.drag && deco.sel < 0) { const n = nearest(); if (n >= 0) selectItem(n); }
    placeHi();
    const s = deco.stick; if (deco.moving && s && deco.sel >= 0 && s.mag > 0.45) { deco.stickT += dt; if (deco.stickT >= 0.28) { deco.stickT = 0; if (Math.abs(s.x) >= Math.abs(s.y)) nudgeScreen(Math.sign(s.x), 0); else nudgeScreen(0, Math.sign(s.y)); } }
  }
  const priceOf = (D) => (D.d ? `💎${D.d}` : D.c ? `⭐${D.c}` : 'Free');
  const have = (c) => { const D = DECOR[c]; return !D.c && !D.d ? true : !!(owned && owned[decorItem(c)]); };
  function mineName(it, i) { const D = DECOR[it.c]; const n = deco.items.slice(0, i + 1).filter((q) => q.c === it.c).length; const many = deco.items.filter((q) => q.c === it.c).length > 1; return `${D.e} ${D.n}${many ? ' ' + n : ''}${it.f ? ' · Up' : ''}`; }
  function paintTools() {
    const box = dbar.querySelector('.kh-tools'); if (!box || !deco) return; const it = deco.items[deco.sel];
    if (deco.out) { box.innerHTML = '<small>Walk around your yard. The colours update on the house while you watch.</small>'; return; }
    if (!deco.room) { box.innerHTML = '<small>Pick a room. You edit one room at a time.</small>'; return; }
    const here = it && inRoom(it) ? it : null;
    const add = '<button type="button" class="kh-add" data-addopen>Add item</button>';
    box.innerHTML = add + (here ? `<b>${DECOR[here.c].e} ${DECOR[here.c].n}</b><button type="button" data-move class="${deco.moving ? 'on' : ''}" aria-pressed="${deco.moving ? 'true' : 'false'}">Move</button><button type="button" data-nudge="-1,0" aria-label="Nudge left">←</button><button type="button" data-nudge="1,0" aria-label="Nudge right">→</button><button type="button" data-nudge="0,-1" aria-label="Nudge away">↑</button><button type="button" data-nudge="0,1" aria-label="Nudge closer">↓</button><button type="button" data-rot>Rotate</button><button type="button" data-color>Color</button><button type="button" data-del>Delete</button>` : '<small>Tap Add item for plants, pictures, and furniture. Tap a piece to move, colour, or remove it.</small>');
    const addB = box.querySelector('[data-addopen]'); if (addB) addB.onclick = () => { deco.tab = 'f'; deco.open = true; drawDeco(); };
    const mv = box.querySelector('[data-move]'); if (mv) mv.onclick = () => { deco.moving = !deco.moving; paintTools(); };
    const cb = box.querySelector('[data-color]'); if (cb) cb.onclick = () => { deco.paintTarget = 'item'; deco.tab = 'c'; deco.open = true; drawDeco(); };
    box.querySelectorAll('[data-nudge]').forEach((b) => (b.onclick = () => { const [sx, sy] = b.dataset.nudge.split(',').map(Number); nudgeScreen(sx, sy); }));
    const rb = box.querySelector('[data-rot]'); if (rb) rb.onclick = () => rotateSel();
    const db2 = box.querySelector('[data-del]'); if (db2) db2.onclick = () => removeSel();
  }
  function markMine() { dbar.querySelectorAll('[data-mine]').forEach((b) => b.classList.toggle('on', +b.dataset.mine === deco.sel)); }
  function paintKind(kind, hex, live) {
    if (!deco || deco.out || !deco.room || !deco.r) return;
    const c = hex ? hex6(hex) : '';
    if (hex && !c) return;
    if (!deco.paintNoted) { remember(); deco.paintNoted = true; }
    if (kind === 'wall') { const m = parseWalls(deco.walls); if (c) m[deco.room] = c; else delete m[deco.room]; deco.walls = Object.entries(m).map(([k, v]) => k + ':' + v).join(','); }
    else if (kind === 'floor') { if (c) deco.surf[deco.room] = c; else delete deco.surf[deco.room]; }
    else if (kind === 'curtain') { const k = 'c' + deco.room; if (c) deco.surf[k] = c; else delete deco.surf[k]; }
    else if (kind === 'item') { const it = deco.items[deco.sel]; if (!it || !inRoom(it)) return; const spec = deco.edit && deco.edit.partsFor(it.c); const key = spec ? (spec.some(([k]) => k === deco.part) ? deco.part : spec[0][0]) : ''; const prevCol = it.col, prevParts = it.parts ? { ...it.parts } : null; if (key) { const parts = { ...(it.parts || {}) }; if (c) parts[key] = c; else delete parts[key]; if (Object.keys(parts).length) it.parts = parts; else delete it.parts; } else if (c) it.col = c; else delete it.col; if (packLayout(deco.items, deco.stash).length > 2000) { if (prevParts) it.parts = prevParts; else delete it.parts; if (prevCol) it.col = prevCol; else delete it.col; say('Too many colours to save. Remove a piece first.'); return; } relItems(); }
    if (kind !== 'item') surfNow();
    if (!live) { if (c && deco.edit && deco.edit.rememberColor) deco.edit.rememberColor(uid, c); deco.paintNoted = false; paintBody(); }
  }
  function paintBody() {
    const body = dbar.querySelector('.kh-body'); if (!body || !deco) return; const t = deco.tab;
    const extRows = [['w', 'Walls'], ['r', 'Roof'], ['d', 'Door'], ['t', 'Trim']].map(([k, n]) => `<label>${n}</label><div class="kh-strip">${EXT_SW.map((c) => `<button type="button" class="sw" style="background:${c}" data-e="${k}:${c}" aria-label="${n} ${c}"></button>`).join('')}</div>`).join('') + '<button type="button" data-e="reset">Reset outside colours</button>';
    const oldPaint = () => { body.innerHTML = `<div class="kh-strip" aria-label="Wall colours">${WALL_SW.map((c) => `<button type="button" class="sw" style="background:${c}" data-w="${c}" aria-label="wall ${c}"></button>`).join('')}</div><div class="kh-strip">${[['', 'Whole home'], ...WALL_ROOMS.filter(([k]) => k !== 'U' || deco.r.I.two)].map(([k, n]) => `<button type="button" data-wr="${k}" class="${deco.wroom === k ? 'on' : ''}">${n}</button>`).join('')}${Object.entries(FLOORS).map(([k, F]) => `<button type="button" data-fl="${k}" class="${deco.floor === k ? 'on' : ''}">${F.n}</button>`).join('')}</div>`; };
    if (deco.out) body.innerHTML = extRows;
    else if (deco.editState === 'loading') body.innerHTML = '<p class="kh-tip">Opening the room editor…</p>';
    else if (!deco.edit) oldPaint();
    else if (!deco.room) body.innerHTML = deco.edit.roomPickerHtml(!!deco.r.I.two) + `<button type="button" data-reset>${deco.resetSure ? 'Tap again to reset the whole home' : 'Reset whole home'}</button>`;
    else if (t === 'm') { const mine = deco.items.map((it, i) => ({ it, i })).filter(({ it }) => inRoom(it)); body.innerHTML = `<div class="kh-strip" aria-label="Furniture in this room">${mine.map(({ it, i }) => `<button type="button" class="it${i === deco.sel ? ' on' : ''}" data-mine="${i}">${mineName(it, i)}</button>`).join('') || '<small>Nothing in this room yet. Use Add.</small>'}</div>`; }
    else if (t === 'f') { const stored = (c) => deco.stash.filter((q) => q === c).length; const cat = deco.edit.CATS.some((c) => c.id === deco.cat) ? deco.cat : 'plant'; deco.cat = cat;
      const rows = Object.entries(DECOR).filter(([c]) => deco.edit.catOf(c) === cat).map(([c, D]) => { const n = stored(c); const em = n ? 'Stored' + (n > 1 ? ' ' + n : '') : have(c) ? (D.c || D.d ? 'Owned' : 'Free') : priceOf(D); return { c, e: D.e, n: D.n, em, rank: n ? 0 : have(c) ? 1 : 2 }; }).sort((a, b) => a.rank - b.rank || a.n.localeCompare(b.n));
      body.innerHTML = deco.edit.addHtml(cat, rows); }
    else { const walls = parseWalls(deco.walls); const it = deco.items[deco.sel]; const here = it && inRoom(it) ? it : null; const R = deco.edit.roomById(deco.room);
      let kind = deco.paintTarget || 'wall'; if (!['wall', 'floor', 'curtain', 'item'].includes(kind) || (kind === 'item' && !here)) kind = 'wall'; deco.paintTarget = kind;
      const spec = here && kind === 'item' ? deco.edit.partsFor(here.c) : null; if (spec && !spec.some(([k]) => k === deco.part)) deco.part = spec[0][0];
      const surf = deco.surf || {}; const current = kind === 'floor' ? (surf[deco.room] || '') : kind === 'curtain' ? (surf['c' + deco.room] || '') : kind === 'item' ? (spec ? ((here.parts && here.parts[deco.part]) || '') : (here.col || '')) : (walls[deco.room] || '');
      body.innerHTML = deco.edit.colorHtml({ roomName: R.name, target: kind, current, recent: deco.edit.recentColors(uid), itemName: here ? `${DECOR[here.c].e} ${DECOR[here.c].n}` : '', partList: spec, part: deco.part });
      body.querySelectorAll('[data-fl]').forEach((b) => b.classList.toggle('on', b.dataset.fl === deco.floor)); }
    body.querySelectorAll('[data-room]').forEach((b) => (b.onclick = () => { const id = b.dataset.room; if (!deco.edit.roomById(id)) return; deco.room = id; deco.sel = -1; deco.moving = false; deco.tab = 'c'; deco.open = true; focusRoom(id); placeHi(); drawDeco(); say(deco.edit.roomById(id).name + '. Only this room can be edited.'); }));
    body.querySelectorAll('[data-mine]').forEach((b) => (b.onclick = () => selectItem(+b.dataset.mine)));
    body.querySelectorAll('[data-wr]').forEach((b) => (b.onclick = () => { deco.wroom = b.dataset.wr; paintBody(); }));
    body.querySelectorAll('[data-w]').forEach((b) => (b.onclick = () => { if (deco.out || !deco.r) return; remember(); const c = b.dataset.w; if (deco.wroom) { const m = parseWalls(deco.walls); m[deco.wroom] = c; deco.walls = Object.entries(m).map(([k, v]) => k + ':' + v).join(','); } else { deco.wall = c; deco.walls = ''; } deco.r.I.setWall(deco.wall, deco.walls); }));
    body.querySelectorAll('[data-target]').forEach((b) => (b.onclick = () => { const k = b.dataset.target; if (k === 'item') { const it = deco.items[deco.sel]; if (!it || !inRoom(it)) return; } deco.paintTarget = k; paintBody(); }));
    body.querySelectorAll('[data-part]').forEach((b) => (b.onclick = () => { deco.part = b.dataset.part; paintBody(); }));
    body.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { deco.cat = b.dataset.cat; paintBody(); }));
    body.querySelectorAll('[data-hex]').forEach((b) => (b.onclick = () => paintKind(deco.paintTarget || 'wall', b.dataset.hex, false)));
    body.querySelectorAll('[data-custom]').forEach((el) => { const apply = (live) => { const c = hex6(el.value); if (c) paintKind(deco.paintTarget || 'wall', c, live); }; el.oninput = () => apply(true); el.onchange = () => apply(false); });
    body.querySelectorAll('[data-clear]').forEach((b) => (b.onclick = () => paintKind(b.dataset.clear, '', false)));
    body.querySelectorAll('[data-fl]').forEach((b) => (b.onclick = () => { if (deco.out || !deco.r) return; remember(); deco.floor = b.dataset.fl; surfNow(); paintBody(); }));
    body.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => { remember(); if (b.dataset.e === 'reset') deco.ext = { w: '', r: '', d: '', t: '' }; else { const [k, c] = b.dataset.e.split(':'); deco.ext[k] = c; } W.paintHouse && W.paintHouse(myPlot, deco.ext); say(deco.out ? '🎨 That colour is on the house.' : '🎨 Outside colour set. Step out to see it, or use Decorate outside from the yard.'); }));
    const resetB = body.querySelector('[data-reset]'); if (resetB) resetB.onclick = () => { if (!deco.resetSure) { deco.resetSure = true; paintBody(); say('Tap again to put back the furniture that came with the house. Colours stay.'); return; }
      remember(); deco.items = starterOf(deco.r).map((i) => ({ ...i })); deco.stash = []; deco.sel = -1; deco.moving = false; deco.resetSure = false; relItems(); drawDeco(); say('Starter furniture is back. Pieces you bought are still yours.'); };
    body.querySelectorAll('[data-add]').forEach((b) => (b.onclick = async () => { if (deco.out || !deco.r || !deco.room || !deco.edit) return; const c = b.dataset.add, D = DECOR[c]; if (!D) return; const cap = deco.edit.ROOM_CAP || 12; const inThis = deco.items.reduce((n, q) => n + (inRoom(q) ? 1 : 0), 0); if (inThis >= cap) { say('This room is full (' + cap + '). Remove one, then add another.'); return; }
      const si = deco.stash.indexOf(c);
      if (si < 0 && !have(c)) { if (!b.dataset.sure) { b.dataset.sure = 1; b.querySelector('em').textContent = 'Tap to buy ' + priceOf(D); return; } try { b.disabled = true; const { econ: e, dia: d } = await shop(); if (D.d) await d.buy(decorItem(c)); else await e.buy(decorItem(c)); owned = owned || {}; owned[decorItem(c)] = 1; say('🛍️ Bought ' + D.n); }
        catch (e) { b.disabled = false; say(e.code === 'permission-denied' ? 'The shop isn’t selling decor yet (prices not published).' : /Diamond|reading 'd'/.test(e.message || '') ? 'You need more 💎 Diamonds' : e.message || 'Could not buy'); return; } }
      const r = deco.r; const fx = Math.sin(P.yaw || 0), fz = Math.cos(P.yaw || 0);
      const draft = { c, x: (P.x - r.cx + fx * 1.2) / scOf(r.h), z: (P.z - r.cz + fz * 1.2) / scOf(r.h), r: 0, f: deco.room === 'U' ? 1 : 0 };
      const it = keepInRoom(placeItem(draft) || draft); if (!it || deco.edit.itemRoom(it.x, it.z, it.f) !== deco.room) { say('That piece does not fit in this room.'); return; }
      const stash2 = deco.stash.slice(); if (si >= 0) stash2.splice(si, 1);
      const next = deco.items.concat([it]); if (packLayout(next, stash2).length > 2000 || next.length > 72) { say('Too many pieces to save. Remove one, then tap Done.'); return; }
      remember(); if (si >= 0) deco.stash.splice(si, 1); deco.items.push(it); deco.sel = deco.items.length - 1; const spec = deco.edit.partsFor(c); if (spec) { deco.paintTarget = 'item'; deco.part = spec[0][0]; } relItems(); drawDeco(); }));
  }
  function drawDeco() { if (!deco) return; const t = deco.tab; const roomed = !deco.out && deco.editState === 'ready' && deco.edit;
    dbar.classList.toggle('open', !!deco.open); dbar.classList.toggle('rooms', !!(roomed && !deco.room)); dbar.classList.toggle('tall', !!(roomed && deco.room && (t === 'c' || t === 'f'))); dbar.hidden = false;
    const R = roomed && deco.room ? deco.edit.roomById(deco.room) : null;
    const tip = deco.out ? 'You stay in the yard. Tap a colour. Done saves. Exit puts the old colours back.' : !roomed ? 'Opening the room editor…' : !deco.room ? 'Tap a room. The camera moves there. Only that room can be edited. Done saves. Exit cancels.' : `${R.name}. Tap Add item for plants, pictures, and furniture. Wall art snaps to a wall. Done saves every room. Exit cancels.`;
    const count = roomed && deco.room ? deco.items.filter((it) => inRoom(it)).length : deco.items.length;
    const acts = `<div class="kh-acts">${roomed && deco.room ? '<button type="button" data-rooms>Rooms</button>' : ''}<button type="button" data-undo>Undo</button><button type="button" class="x" data-x>Exit</button><button type="button" class="p" data-sv>Done</button></div>`;
    const tabs = roomed && deco.room ? `<div class="kh-tabs"><button type="button" data-tab="c" class="${t === 'c' ? 'on' : ''}">Color</button><button type="button" data-tab="f" class="${t === 'f' ? 'on' : ''}">Add</button><button type="button" data-tab="m" class="${t === 'm' ? 'on' : ''}">Mine ${count}</button></div>` : '';
    dbar.innerHTML = `<div class="kh-handle"><button type="button" class="kh-grip" data-handle aria-expanded="${deco.open ? 'true' : 'false'}">${deco.open ? '▾' : '▴'} ${deco.out ? 'Outside' : (R ? R.name : 'Decorate')}</button>${acts}${tabs}</div><p class="kh-tip">${tip}</p><div class="kh-tools"></div><div class="kh-body"></div>`;
    dbar.querySelector('[data-handle]').onclick = () => { deco.open = !deco.open; drawDeco(); };
    dbar.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { deco.tab = b.dataset.tab; deco.open = true; drawDeco(); }));
    const roomsB = dbar.querySelector('[data-rooms]'); if (roomsB) roomsB.onclick = () => { deco.room = ''; deco.sel = -1; deco.moving = false; placeHi(); drawDeco(); };
    const undoB = dbar.querySelector('[data-undo]'); if (undoB) undoB.onclick = () => undoDeco();
    dbar.querySelector('[data-x]').onclick = () => endDeco(false); dbar.querySelector('[data-sv]').onclick = () => endDeco(true);
    paintTools(); paintBody(); }
  function rayAt(clientX, clientY) {
    const cam = api.cam, cv = view.querySelector('canvas'); if (!cam || !cv) return null;
    const rect = cv.getBoundingClientRect(); if (rect.width < 2 || rect.height < 2) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1, ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    const origin = cam.position.clone(); const dir = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(cam).sub(origin).normalize();
    return { origin, dir };
  }
  function onDecoDown(e) {
    if (!deco || deco.out || !deco.room || e.button > 0) return;
    if (e.target.closest && e.target.closest('button, a, input, textarea, select, label, .kh-dbar, .kh-radio, .kh-note-btn, .kc-b, .kc-gear, .kh-p, .ks-panel')) return;
    const ray = rayAt(e.clientX, e.clientY); if (!ray) return;
    const hit = pickIndex(deco.items, ray.origin, ray.dir, (it) => (inRoom(it) ? aabbOf(it) : null));
    const idx = hit >= 0 ? hit : (deco.moving && deco.sel >= 0 ? deco.sel : -1);
    if (idx < 0) return;
    e.preventDefault(); e.stopPropagation(); selectItem(idx);
    const it = deco.items[idx]; const y = itemBaseY(it) + 0.02;
    let wx = null, wz = null;
    if (Math.abs(ray.dir.y) > 1e-5) { const t = (y - ray.origin.y) / ray.dir.y; if (t > 0) { wx = ray.origin.x + ray.dir.x * t; wz = ray.origin.z + ray.dir.z * t; } }
    deco.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, sel: idx, ox: it.x, oz: it.z, wx, wz };
  }
  function onDecoMove(e) {
    const d = deco && deco.drag; if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y; if (dx * dx + dy * dy > 36) d.moved = true;
    if (!d.moved || d.wx == null) return; const it = deco.items[d.sel]; if (!it) return;
    const ray = rayAt(e.clientX, e.clientY); if (!ray || Math.abs(ray.dir.y) < 1e-5) return;
    const y = itemBaseY(it) + 0.02, t = (y - ray.origin.y) / ray.dir.y; if (t < 0) return;
    const wx = ray.origin.x + ray.dir.x * t, wz = ray.origin.z + ray.dir.z * t;
    if (!d.noted) { remember(); d.noted = true; }
    it.x = d.ox + (wx - d.wx) / SC; it.z = d.oz + (wz - d.wz) / SC; placeItem(it); keepInRoom(it);
    relItems(); placeHi();
  }
  function onDecoUp(e) { if (deco && deco.drag && e.pointerId === deco.drag.id) deco.drag = null; }
  function onDecoKey(e) {
    if (!deco) return; const tag = e.target && e.target.tagName; if (tag && /^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
    if (deco.sel >= 0 && e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); nudgeScreen(-1, 0); }
    else if (deco.sel >= 0 && e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); nudgeScreen(1, 0); }
    else if (deco.sel >= 0 && e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); nudgeScreen(0, -1); }
    else if (deco.sel >= 0 && e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); nudgeScreen(0, 1); }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); e.stopPropagation(); rotateSel(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !deco.out) { e.preventDefault(); e.stopPropagation(); removeSel(); }
    else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopPropagation(); undoDeco(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endDeco(false); }
  }
  function decoratePad(pressed) {
    if (!deco || !pressed) return false;
    if (pressed.back) { endDeco(false); return true; }
    if (deco.sel < 0 && (pressed.confirm || pressed.use)) { const n = nearest(); if (n >= 0) selectItem(n); return true; }
    if (pressed.left) nudgeScreen(-1, 0); if (pressed.right) nudgeScreen(1, 0); if (pressed.up) nudgeScreen(0, -1); if (pressed.down) nudgeScreen(0, 1);
    if (pressed.use) rotateSel(); if (pressed.menu) removeSel();
    if (pressed.confirm) { deco.moving = !deco.moving; paintTools(); }
    return true;
  }
  function decoState() { if (!deco) return null; const it = deco.items[deco.sel]; return { sel: deco.sel, n: deco.items.length, open: !!deco.open, moving: !!deco.moving, out: !!deco.out, room: deco.room || '', floors: serFloors(deco.surf || {}), col: it && it.col || '', parts: it && it.parts ? { ...it.parts } : null, name: it ? DECOR[it.c].n : '', code: it ? it.c : '', x: it ? it.x : null, z: it ? it.z : null, r: it ? it.r : null, f: it ? it.f || 0 : 0, stash: deco.stash.slice(), hud: document.body.classList.contains('kh-decorating'), dock: radioBox.classList.contains('dock'), note: !noteBtn.hidden, spot: deco.spot }; }
  function screenOf(i) {
    if (!deco || !deco.items[i] || !api.cam) return null; const b = aabbOf(deco.items[i]); api.cam.updateMatrixWorld(); const v = new THREE.Vector3((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); v.project(api.cam);
    const rect = view.querySelector('canvas').getBoundingClientRect(); return { x: (v.x + 1) / 2 * rect.width + rect.left, y: (1 - v.y) / 2 * rect.height + rect.top, behind: v.z > 1 };
  }
  view.addEventListener('pointerdown', onDecoDown, true); view.addEventListener('pointermove', onDecoMove, true); view.addEventListener('pointerup', onDecoUp, true); view.addEventListener('pointercancel', onDecoUp, true);
  addEventListener('keydown', onDecoKey, true);
  decB.onclick = () => startDeco('in');
  yardB.onclick = () => startDeco('out');
  function unstick() { const own = myPlot && HOUSE_BY_ID[myPlot]; const h = own || inside; if (deco) endDeco(false); const spot = h ? doorSpot(h) : { x: 0, z: 82, yaw: Math.PI, cam: 0 }; if (inside) goOut(own ? spot : undefined); else placeAt(spot); document.body.classList.remove('kh-decorating'); if (!inside) { roomState.box = null; roomState.inId = null; } say('Back at the front door. You can look around and move.'); }
  stuckB.onclick = () => unstick();
  // ---------------------------------------------------------------- owners (live) + buying
  // reads stay per-area: one listener for the classic world (ids < 'hm'), one for my own homes, and one per far-south metro city,
  // opened the first time you get near it (or open its Find-a-home tab) and then kept (cached) for the session
  const parts = new Map(), subs = [], metroOn = new Set(); let unsub = () => subs.forEach((f) => f && f());
  const listen = (key, q) => { if (!(uid && db)) return; try { subs.push(onSnapshot(q, (qs) => { const m = new Map(); qs.forEach((d) => m.set(d.id, d.data())); parts.set(key, m); onOwners(); }, (e) => { console.warn('homes', key, e); if (!snapOk && key === 'old') { snapOk = true; firstSpawn(); } })); } catch (e) { console.warn(e); } };
  function metroSub(cid) { if (metroOn.has(cid) || !db) return; const hs = HOUSES.filter((h) => h.city === cid && h.num); if (!hs.length) return; metroOn.add(cid);
    listen('m:' + cid, query(collection(db, 'homes'), where(documentId(), '>=', hs[0].id), where(documentId(), '<=', hs[hs.length - 1].id))); }
  let mT = 0; function metroTick(dt) { if ((mT += dt) < 2) return; mT = 0; for (const c of METROS) if (!metroOn.has(c.id) && Math.abs(P.x - c.x) < c.hx + 260 && Math.abs(P.z - c.z) < c.hz + 260) metroSub(c.id); }
  if (uid && db) { listen('old', query(collection(db, 'homes'), where(documentId(), '<', 'hm'))); listen('mine', query(collection(db, 'homes'), where('owner', '==', uid)));
    try { subs.push(onSnapshot(query(collection(db, 'users', uid, 'notifications'), orderBy('createdAt', 'desc'), limit(5)), (qs) => {
      if (ringBoot) { ringBoot = false; const d0 = qs.docs[0] && qs.docs[0].data(); const at = d0 && d0.createdAt && d0.createdAt.toMillis ? d0.createdAt.toMillis() : 0; if (d0 && d0.read !== true && at && Date.now() - at < 3 * 60 * 1000) considerRing(d0); return; }
      qs.docChanges().forEach((c) => { if (c.type === 'added') considerRing(c.doc.data()); });
    }, () => {})); } catch { /* */ } }
  function onOwners() { if (!parts.has('old')) return; const prev = new Map(owners); owners.clear(); for (const m of parts.values()) for (const [id, v] of m) owners.set(id, v); myPlot = null; myTier = 0;
      for (const [id, o] of owners) if (o.owner === uid && !HOUSE_BY_ID[id]?.admin) { myPlot = id; myTier = o.garage || 0; } if (amAdmin && owners.get(ADMIN_PLOT)?.owner === uid && !myPlot) { myPlot = ADMIN_PLOT; myTier = 0; }
      for (const id of new Set([...prev.keys(), ...owners.keys()])) { const h = HOUSE_BY_ID[id]; if (!h) continue; const a = prev.get(id), b = owners.get(id); if (h.sale && JSON.stringify(a) !== JSON.stringify(b)) drawSign(h); if (paintsOutside(h) && JSON.stringify((a || {}).decor) !== JSON.stringify((b || {}).decor)) applyDecor(id); }
      if (inside && !canEnter(inside)) { goOut(); say('🚪 The owner closed this home'); } else if (inside && radioKey(prev.get(inside.id)) !== radioKey(owners.get(inside.id))) { radioOff = null; startRadio(); }
      syncCars(); ensurePalace(); healDecor(); if (!snapOk) { snapOk = true; firstSpawn(); } }
  let decorHealed = false;
  function healDecor() { if (decorHealed || !myPlot || !uid || !db || deco) return; const o = owners.get(myPlot); const h = HOUSE_BY_ID[myPlot]; if (!o || !h || !o.decor || typeof o.decor.items !== 'string') { decorHealed = true; return; }
    const heal = healItems(o.decor.items, h.style === 1 || h.style === 3 || !!h.estate); decorHealed = true; if (!heal.changed) return;
    const ext0 = o.decor.ext && typeof o.decor.ext === 'object' ? o.decor.ext : {}; const decor = { ext: { w: ext0.w || '', r: ext0.r || '', d: ext0.d || '', t: ext0.t || '' }, items: heal.packed, v: 2 };
    if (o.decor.wall) decor.wall = o.decor.wall; if (o.decor.walls) decor.walls = o.decor.walls; if (o.decor.floor) decor.floor = o.decor.floor; if (o.decor.floors) decor.floors = o.decor.floors;
    homeW({ decor }).then(() => { const r = rooms.get(myPlot); if (r) { r.dk = ''; applyDecor(myPlot); } }).catch(() => {}); }
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
  function myPanel() { const h = HOUSE_BY_ID[myPlot]; const st = HOME_STYLES[h.style]; const carNote = (() => { const G0 = garages.get(myPlot); const n = G0 ? G0.cars.length : 0; const ov = G0 ? G0.overflow : 0; if (h.admin) return `🚗 ${n} car${n === 1 ? '' : 's'} parked in the front yard for everyone to see. Walk up to one to drive it.`; return `🚗 ${n} car${n === 1 ? '' : 's'} parked here for everyone to see (garage holds ${garageCap(myTier)}, plus driveway${h.estate ? '' : ' + curb'} spots).${ov ? ` <b>${ov} more need a bigger garage.</b>` : ''} Walk up to a parked car to drive it; drive home and tap 🅿️ Park at home.`; })(); panel(`<h3>🏠 My ${h.admin ? h.spot : st.name}</h3>${h.admin ? '' : `<div class="row"><span>Garage</span><b>${myTier ? myTier + ' bay' + (myTier > 1 ? 's' : '') : 'none'}</b></div>`}` + GARAGES.filter((g) => g.tier > myTier && g.tier <= maxTier(h)).map((g) => `<div class="row"><span>${g.name}</span><button data-g="${g.tier}">${price(g)}</button></div>`).join('') + `<p><small>${carNote}</small></p><div><button data-gu>🚪 Open house & invites</button><button data-rd>📻 House radio</button><button data-dc>🛠️ Decorate inside</button><button data-yd>🎨 Decorate outside</button>${h.admin ? '<button data-sign>✏️ Edit sign</button>' : ''}</div><button class="g" data-m>Move out</button>${h.admin ? '' : ' <button class="g" data-sell>🏷️ Sell house</button>'}`,
    (c) => { c.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => buyGarage(+b.dataset.g, b))); c.querySelector('[data-gu]').onclick = () => guestPanel(); c.querySelector('[data-rd]').onclick = () => radioPanel(); c.querySelector('[data-dc]').onclick = () => { pan.hidden = true; if (deco && deco.out) { say('Exit outside decorating first.'); return; } if (inside && inside.id === myPlot) startDeco('in'); else { goIn(HOUSE_BY_ID[myPlot]); setTimeout(() => startDeco('in'), 50); } }; const yd = c.querySelector('[data-yd]'); if (yd) yd.onclick = () => { pan.hidden = true; if (deco && !deco.out) endDeco(false); if (inside) goOut(); startDeco('out'); }; const sg = c.querySelector('[data-sign]'); if (sg) sg.onclick = () => signPanel(); c.querySelector('[data-m]').onclick = (e) => { if (e.target.dataset.sure) moveOut(e.target); else { e.target.dataset.sure = 1; e.target.textContent = 'Tap again to move out'; } }; const sb = c.querySelector('[data-sell]'); if (sb) sb.onclick = () => sellPanel(); }); }
  async function signAllowed(s) { if (!s || checkInput(s) || checkInput(s.toLowerCase()) || clean(s) !== s) return false; try { const { autoFlag } = await import('../moderation.js'); if (autoFlag(s)) return false; } catch { /* the word lists are the backup */ } return true; }
  function signPanel() { if (!amAdmin) return; const cur = signOf(owners.get(ADMIN_PLOT)); panel(`<h3>👑 Palace sign</h3><p><small>This is the gold sign out front. Everyone sees the same words. Up to 24 characters.</small></p><input id="kh-sign" maxlength="24" value="${esc(cur)}" style="width:100%;box-sizing:border-box;font:700 16px Inter,sans-serif;padding:8px;border-radius:10px;border:1px solid #ccc">`, (c) => { const b = document.createElement('button'); b.textContent = 'Save sign'; b.onclick = async () => { const raw = Array.from(c.querySelector('#kh-sign').value.replace(/\s+/g, ' ').trim()).slice(0, 24).join(''); const sign = raw || PALACE_SIGN; if (!(await signAllowed(sign))) { say('Let’s keep the sign friendly.'); return; } const o = owners.get(ADMIN_PLOT) || {}; try { await setDoc(doc(db, 'homes', ADMIN_PLOT), { owner: uid, name: S.profile.displayName, style: 'estate', garage: o.garage || 0, sign, at: serverTimestamp() }, { merge: true }); pan.hidden = true; say('👑 Sign updated'); } catch (e) { say(e && e.code === 'permission-denied' ? 'Only the admin can change this sign.' : 'Could not save the sign'); } }; c.insertBefore(b, c.querySelector('[data-x]').parentElement); }); }
  // 🏷️ sell back: a server function (sellHome) checks ownership + the deed and credits 60% in the same currency, once
  const refundOf = (st) => (st.d ? { cur: '💎', n: Math.floor(st.d * 0.6), name: 'Diamonds' } : { cur: '⭐', n: Math.floor(st.p * 0.6), name: 'Star Coins' });
  function sellPanel() { const h = HOUSE_BY_ID[myPlot]; if (!h || h.admin) return; const st = HOME_STYLES[h.style]; const r = refundOf(st);
    panel(`<h3>🏷️ Sell your ${esc(st.name)}?</h3><div class="row"><span>You paid</span><b>${price(st)}</b></div><div class="row"><span>You get back (60%)</span><b style="font-size:18px">${r.cur}${r.n} ${r.name}</b></div>
      <p><small>The house goes back <b>For Sale</b> for other players. Your parked cars stay yours (they just leave the driveway). Garage, decorations and paint are cleared; garage kits stay in your bag, so a new home can rebuild them free (they are not refunded).</small></p>
      <p><b>Grown-ups: this can’t be undone.</b></p><div class="row"><button class="g" data-no>Keep my house</button><button data-yes style="background:#dc2626;color:#fff">Sell for ${r.cur}${r.n}</button></div>`,
      (c) => { c.querySelector('[data-no]').onclick = () => myPanel(); c.querySelector('[data-yes]').onclick = (e) => sellHome(e.target); }); }
  async function sellHome(btn) { const plot = myPlot; try { busy(btn, 'Selling…'); const [{ getApp }, F] = await Promise.all([import('https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'), import('https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js')]);
      const fns = F.getFunctions(getApp(), 'us-central1'); if (EMU && !fns.__emu) { F.connectFunctionsEmulator(fns, '127.0.0.1', 5199); fns.__emu = 1; }
      const res = (await F.httpsCallable(fns, 'sellHome')({ plot })).data; if (inside && inside.id === plot) goOut(); save.cars = []; persist(true); pan.hidden = true;
      say(`🏷️ Sold! ${res.cur === 'star' ? '⭐' : '💎'}${res.n} added to your wallet.`); try { api.sfx && api.sfx('coin'); } catch { /* */ } }
    catch (e) { btn.disabled = false; btn.textContent = 'Try again'; say((e && e.message) || 'Could not sell'); } }
  function homeFront(h) { return h ? doorSpot(h) : null; }
  function teleport(p) { if (deco && deco.out) endDeco(false); if (inside) goOut(p); else placeAt(p); }
  homeB.onclick = () => { if (homeB.dataset.ring) { inviteRinger(); return; } if (D && D.mine && D.mine() && D.mine().state !== 'parked') { say('Park and get out first 🙂'); return; }
    if (myPlot) { teleport(homeFront(HOUSE_BY_ID[myPlot])); say('🏠 Home sweet home'); return; }
    findHome('all', 0); };
  const placeName = (h) => (h.estate ? h.spot : h.city ? CITY_BY_ID[h.city].name : h.town ? ({ down: '🏙️ Kemy Downtown', farm: '🌾 Clover Fields', snow: '❄️ Frostberry', desert: '🌵 Sunstone', lake: '🛶 Willow Lake', shore: '🏖️ Sunny Shore' }[h.town] || h.town) : '🎃 Kemy Street');
  function findHome(f, pg) { if (CITY_BY_ID[f] && CITY_BY_ID[f].metro) metroSub(f); const all = HOUSES.filter((h) => h.sale && !owners.has(h.id)); const free = all.filter((h) => f === 'all' || (f === 'estate' ? h.estate : f === 'old' ? !h.city && !h.estate : h.city === f)); const per = 25, pages = Math.max(1, Math.ceil(free.length / per)); pg = Math.min(pg, pages - 1);
    const tabs = [['all', 'All'], ['estate', '🏰 Mansions'], ['old', '🎃 Original towns'], ...CITIES.map((c) => [c.id, c.name])];
    panel(`<h3>🏠 Find a home</h3><p><small>${all.length} homes for sale right now (Star Coins or Diamonds). Mansions are the top tier.</small></p><div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${tabs.map(([k, n]) => `<button class="${k === f ? '' : 'g'}" data-f="${k}" style="white-space:nowrap">${n}</button>`).join('')}</div>`
      + free.slice(pg * per, pg * per + per).map((h) => `<div class="row"><span>${HOME_STYLES[h.style].name}<br><small>${h.id} · ${esc(placeName(h))}</small></span><button data-v="${h.id}">${price(HOME_STYLES[h.style])} · Visit</button></div>`).join('') + (free.length ? '' : '<p><small>Nothing for sale here right now.</small></p>')
      + (pages > 1 ? `<div class="row"><button class="g" data-p="${pg - 1}" ${pg ? '' : 'disabled'}>‹ Prev</button><small>Page ${pg + 1} / ${pages}</small><button class="g" data-p="${pg + 1}" ${pg < pages - 1 ? '' : 'disabled'}>Next ›</button></div>` : ''),
      (c) => { c.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => { pan.hidden = true; const h = HOUSE_BY_ID[b.dataset.v]; if (h.num) metroSub(h.city); const [x, z] = Lw(h, h.estate ? -10 : -6.3, h.d / 2 + (h.estate ? 14 : 6.2)); teleport({ x, z, yaw: h.face > 0 ? Math.PI : 0 }); }));
        c.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => findHome(b.dataset.f, 0))); c.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => findHome(f, +b.dataset.p))); }); }

  // ---------------------------------------------------------------- sitting (beds, chairs, couches; shared via presence dn='sit')
  const seatsHere = () => { const r = inside && rooms.get(inside.id); return r && r.I.seats ? r.I.seats() : []; };
  const seatTaken = (s) => { if (!api.others) return false; for (const o of api.others.values()) if (o.dn === 'sit' && Math.hypot(o.x - s.x, o.z - s.z) < 0.4) return true; return false; };
  function nearSeat() { let bi = -1, bd = 1.5; seatsHere().forEach((s, i) => { if (Math.abs(P.y - s.fl) > 1.2) return; const d = Math.hypot(s.x - P.x, s.z - P.z); if (d < bd && !seatTaken(s)) { bd = d; bi = i; } }); return bi; }
  function sitDown(i) { const s = seatsHere()[i]; if (!s || !inside || seatTaken(s)) return; P.sit = { x: s.x, z: s.z, y: s.y - 0.36, yaw: s.yaw, seat: s, back: [s.x + s.fx * 0.95, s.z + s.fz * 0.95, s.fl], off: () => standUp(true, true) };
    P.x = s.x; P.z = s.z; P.yaw = s.yaw; P.dance = 'sit'; P.danceUntil = Date.now() + 864e5; api.markDirty && api.markDirty(); api.send && api.send(true); window.__kh && (window.__kh.sit = s.c); }
  function standUp(quiet, fromMove) { const st = P.sit; if (!st) return; if (life.busy() === 'sleep') { life.act('wake'); return; } P.sit = null; if (P.dance === 'sit') { P.dance = ''; P.danceUntil = 0; } P.x = st.back[0]; P.z = st.back[1]; P.y = st.back[2]; P.vy = 0; void fromMove; api.markDirty && api.markDirty(); api.send && api.send(true); window.__kh && (window.__kh.sit = null); void quiet; }
  // ---------------------------------------------------------------- living room TV = house music player (owner picks, everyone inside hears)
  const tvC = document.createElement('canvas'); tvC.width = 512; tvC.height = 256; let tvTex = null, tvMeshes = [], tvT = 0, tvTitle = '', tvBy = '';
  function tvHide() { for (const m of tvMeshes) { m.parent && m.parent.remove(m); m.geometry.dispose(); } tvMeshes = []; window.__kh && (window.__kh.tv = null); }
  function tvShow(title, by) { tvHide(); if (!inside) return; tvTitle = String(title || 'Music').slice(0, 28); tvBy = String(by || '').slice(0, 16); if (!tvTex) { tvTex = new THREE.CanvasTexture(tvC); tvTex.colorSpace = THREE.SRGBColorSpace; }
    const mat = new THREE.MeshBasicMaterial({ map: tvTex, toneMapped: false }); for (const sc of (rooms.get(inside.id)?.I.screens?.() || [])) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), mat); m.position.set(sc.x, sc.y, sc.z); m.rotation.y = sc.yaw; m.name = 'tv-now-playing'; root.add(m); tvMeshes.push(m); const gl = new THREE.Mesh(new THREE.PlaneGeometry(sc.w * 1.5, sc.h * 1.6), new THREE.MeshBasicMaterial({ color: tvTitle === 'Spotify' ? '#1ed760' : tvTitle === 'Apple Music' ? '#fa2d48' : '#a855f7', transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })); gl.position.set(sc.x - Math.sin(sc.yaw) * 0.03, sc.y, sc.z - Math.cos(sc.yaw) * 0.03); gl.rotation.y = sc.yaw; gl.name = 'tv-led-glow'; root.add(gl); tvMeshes.push(gl); }
    tvDraw(0); window.__kh && (window.__kh.tv = tvTitle); }
  // TV "now playing": a text-only service label (no logos) — Spotify in green, Apple Music in red/pink — with a running LED strip
  // around the screen and a glowing equalizer. Kemy Radio keeps the purple look. Canvas 512x256, redrawn ~12x/s while visible.
  function tvDraw(t) { const g = tvC.getContext('2d'), Wc = tvC.width, Hc = tvC.height; const sp = tvTitle === 'Spotify', am = tvTitle === 'Apple Music';
    const pal = sp ? { bg0: '#06140b', bg1: '#0c2a17', main: '#1ed760', alt: '#a7f3d0' } : am ? { bg0: '#1a0610', bg1: '#2d0a1c', main: '#fa2d48', alt: '#ff8fb1' } : { bg0: '#1e1038', bg1: '#2e1065', main: '#c084fc', alt: '#fde68a' };
    const gr = g.createLinearGradient(0, 0, Wc, Hc); gr.addColorStop(0, pal.bg0); gr.addColorStop(1, pal.bg1); g.fillStyle = gr; g.fillRect(0, 0, Wc, Hc);
    // LED strip: dots chase around the edge
    const per = 2 * (Wc + Hc), n = 64; for (let i = 0; i < n; i++) { let d = (i / n) * per; let x, y; if (d < Wc) { x = d; y = 6; } else if ((d -= Wc) < Hc) { x = Wc - 6; y = d; } else if ((d -= Hc) < Wc) { x = Wc - d; y = Hc - 6; } else { x = 6; y = Hc - (d - Wc); }
      const on = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 0.45)); g.globalAlpha = on; g.fillStyle = am && i % 2 ? pal.alt : pal.main; g.shadowColor = pal.main; g.shadowBlur = 10; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); } g.globalAlpha = 1;
    // equalizer
    const bars = 24, bw = (Wc - 80) / bars; for (let i = 0; i < bars; i++) { const v = 0.15 + 0.85 * Math.abs(Math.sin(t * (2.6 + (i % 7) * 0.55) + i * 1.3)) * (0.6 + 0.4 * Math.sin(t * 1.3 + i)); const bh = v * 70;
      const eg = g.createLinearGradient(0, Hc - 26 - bh, 0, Hc - 26); eg.addColorStop(0, pal.alt); eg.addColorStop(1, pal.main); g.fillStyle = eg; g.shadowColor = pal.main; g.shadowBlur = 14; g.fillRect(40 + i * bw + 2, Hc - 26 - bh, bw - 4, bh); }
    // the label (text only) with a soft neon glow
    g.textAlign = 'center'; g.textBaseline = 'middle'; const lab = tvTitle || 'Music'; g.font = `900 ${Math.min(64, (Wc - 70) * 1.7 / Math.max(6, lab.length))}px Inter, Arial, sans-serif`;
    g.shadowColor = pal.main; g.shadowBlur = 22 + Math.sin(t * 3) * 6; g.fillStyle = pal.main; g.fillText(lab, Wc / 2, 82); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 20px Inter, Arial, sans-serif';
    g.fillText('Now playing' + (tvBy ? ' · ' + tvBy + '’s TV' : ''), Wc / 2, 128, Wc - 60); g.shadowBlur = 0; if (tvTex) tvTex.needsUpdate = true; }
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
  function act(a) { const [k, v] = a.split(':'); if (k === 'sale') salePanel(HOUSE_BY_ID[v]); else if (k === 'mine') myPanel(); else if (k === 'sign') signPanel(); else if (k === 'ring') ringDoor(v); else if (k === 'invite') inviteRinger(); else if (k === 'locked') { orphanCheck(v); say('🔒 ' + (owners.get(v)?.name || 'A Pal') + '’s home. Only the owner can go inside.'); } else if (k === 'out') goOut(); else if (k === 'sit') sitDown(+v); else if (k === 'stand') standUp(); else if (k === 'life') { if (v !== 'wait') life.act(v); } else if (k === 'tv') tvAct(); else if (k === 'park') parkHome(); else if (k === 'take') takeCar(pendingTake); }
  inB.onclick = () => { const h = HOUSE_BY_ID[inB.dataset.h]; if (h) goIn(h); };
  // my cars at home: walk up to any parked car to drive it; drive back home and tap Park to put it away (it reappears in its spot)
  const ownHomes = () => [...owners.entries()].filter(([, o]) => o.owner === uid).map(([id]) => HOUSE_BY_ID[id]).filter(Boolean);
  function nearMyCar() { let best = null, bd = 2.9; for (const h of ownHomes()) { const G0 = garages.get(h.id); if (!G0 || !G0.shown) continue; for (const { car, s } of G0.shown) { const fx = s.lv ? s.front[0] : s.x, fz = s.lv ? s.front[1] : s.z; const d = Math.hypot(P.x - fx, P.z - fz) - (s.lv ? 0 : 1.2); if (d < bd) { bd = d; best = { car, s, h }; } } } return best; }
  function takeCar(n) { if (!n) return; const { car, s, h } = n; if (owners.get(h.id)?.owner !== uid) return; const at = s.lv ? { x: s.front[0], z: s.front[1], yaw: s.yaw + Math.PI } : { x: s.x, z: s.z, yaw: s.yaw }; D.place(car.m, car.c, at, true); const G0 = garages.get(h.id); if (G0) placeCars(G0); say('🚗 ' + CAR[car.m].name + ' · drive safe!'); }
  function parkHome() { const m = D.mine(); if (!m) return; const h = ownHomes().find((q) => Math.hypot(q.x - m.x, q.z - m.z) < (q.estate ? 70 : 32)); if (!h) return; D.stash(); const [fx, fz] = Lw(h, -6.3, h.d / 2 + 6); P.x = fx; P.z = fz; P.y = ground(fx, fz); save.street = null; const G0 = garages.get(h.id); if (G0) placeCars(G0); persist(true); say('🅿️ Parked at home. Your car stays here for everyone to see.'); }
  let pendingTake = null;
  // owner car list -> homes/{plot}.cars (one write when it changes; visitors read nothing extra: it rides on the homes snapshot)
  let syncing = false, again = false; const lastSync = {};
  async function syncCars(force) { if (syncing) { again = again || force || 1; return; } if (!uid || !db) return; const mine = ownHomes().sort((a, b) => (b.admin ? 1 : 0) - (a.admin ? 1 : 0)); if (!mine.length || !D || !D.ownedCars) return; syncing = true;
    try { const list = await D.ownedCars(); for (const h of mine) { const o = owners.get(h.id); const prevL = parseCars(o.cars); const out = list.map((c) => { const pv = prevL.find((q) => q.m === c.id); const p = c.plate || (pv && pv.p); return { m: c.id, c: c.color, ...(p ? { p } : {}) }; });
        const str = serCars(out.slice(0, h.admin ? ADMIN_CAP : 15)); if (str !== (o.cars || '') && (force || str !== lastSync[h.id])) { lastSync[h.id] = str; await setDoc(doc(db, 'homes', h.id), { owner: uid, name: S.profile.displayName, style: o.style, garage: o.garage || 0, cars: str, at: serverTimestamp() }, { merge: true }); } } }
    catch (e) { console.warn('cars sync', e.code || e); } finally { syncing = false; if (again) { const f = again === true; again = false; setTimeout(() => syncCars(f), 200); } } }
  addEventListener('kemy:cars-changed', () => syncCars(true));
  W.plateFor = (ownerUid, model) => { for (const o of owners.values()) if (o.owner === ownerUid) { const c = parseCars(o.cars).find((q) => q.m === model); if (c && c.p) return c.p; } return null; };
  // orphaned homes (owner account gone) go back on sale: checked only when someone looks at that house (1 cached read)
  const orphanChecked = new Set(); async function orphanCheck(id) { const o = owners.get(id); if (!o || orphanChecked.has(id) || !db || HOUSE_BY_ID[id]?.admin) return; orphanChecked.add(id); try { const u = await getDoc(doc(db, 'users', o.owner)); if (!u.exists()) { await deleteDoc(doc(db, 'homes', id)); say('🏷️ This home is back on sale!'); } } catch { /* */ } }
  // 👑 the admin palace: created by the admin's own client the first time (rules: admin only)
  let palaceTried = false; function ensurePalace() { if (!amAdmin || palaceTried || !db || owners.has(ADMIN_PLOT)) return; palaceTried = true; setDoc(doc(db, 'homes', ADMIN_PLOT), { owner: uid, name: S.profile.displayName, style: 'estate', garage: 0, at: serverTimestamp() }).catch((e) => console.warn('palace', e.code || e)); }
  W.landmarks = () => { const h = HOUSE_BY_ID[ADMIN_PLOT]; const [gx, gz] = Lw(h, 0, h.d / 2 + 20); return [{ name: h.spot, x: h.x, z: h.z, gx, gz }]; };

  // ---------------------------------------------------------------- save / restore location (+ street car)
  let lastLS = 0, lastFS = 0, lastSent = null;
  function snapshot() { let x = P.x, z = P.z, yaw = P.yaw || 0; if (inside) { const f = homeFront(inside); x = f.x; z = f.z; yaw = f.yaw; } else if (positionBad(x, z)) { const f = (deco && deco.out && deco.spot && !positionBad(deco.spot.x, deco.spot.z)) ? deco.spot : (myPlot && homeFront(HOUSE_BY_ID[myPlot])); if (f) { x = f.x; z = f.z; yaw = f.yaw || yaw; } } const m = D && D.mine && D.mine(); let street = null;
    if (m) { street = { id: m.id, c: m.color, x: Math.round(m.x * 10) / 10, z: Math.round(m.z * 10) / 10, yaw: Math.round(m.yaw * 100) / 100 }; }
    return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: Math.round(yaw * 100) / 100, cars: [], street }; }
  function persist(force) { const now = Date.now(); const s = snapshot(); Object.assign(save, s); if (force || now - lastLS > 3000) { lastLS = now; lss(LS, JSON.stringify(save)); }
    if (!uid || !db) return; const moved = !lastSent || Math.hypot(lastSent.x - s.x, lastSent.z - s.z) > 4 || JSON.stringify(lastSent.cars) !== JSON.stringify(s.cars) || JSON.stringify(lastSent.street) !== JSON.stringify(s.street);
    if (moved && (now - lastFS > (force ? 6000 : 30000))) { lastFS = now; lastSent = s; setDoc(doc(db, 'users', uid, 'pal', 'world'), { ...s, at: serverTimestamp() }).catch((e) => console.warn('world save', e.code || e)); } }
  const onHide = () => persist(true); addEventListener('pagehide', onHide); document.addEventListener('visibilitychange', onHide);
  let spawned = false; const startAt = { x: P.x, z: P.z };
  async function firstSpawn() { if (spawned) return; spawned = true; document.body.classList.remove('kh-decorating'); deco = null; dbar.hidden = true; let fs = null; if (uid && db) try { const d = await getDoc(doc(db, 'users', uid, 'pal', 'world')); if (d.exists()) fs = d.data(); } catch { /* */ }
    if (fs) { if ('street' in fs) save.street = fs.street; }
    const loc = fs || (save.x != null ? save : null); if (Math.hypot(P.x - startAt.x, P.z - startAt.z) > 4) return; // already walking: don't yank
    const home = myPlot && HOUSE_BY_ID[myPlot];
    const savedBad = !!(loc && loc.x != null && positionBad(+loc.x, +loc.z));
    if (home) teleport(homeFront(home));
    else if (loc && loc.x != null && !positionBad(+loc.x, +loc.z)) teleport({ x: +loc.x, z: +loc.z, yaw: +loc.yaw || 0, cam: (+loc.yaw || 0) + Math.PI });
    else teleport({ x: 0, z: 82, yaw: Math.PI, cam: 0 });
    if (savedBad) persist(true); // rewrite a broken saved spot so the next visit does not restore it
    if (save.street && CAR[save.street.id] && D && D.place && !D.mine() && !positionBad(+save.street.x, +save.street.z)) D.place(save.street.id, save.street.c || 0, { x: save.street.x, z: save.street.z, yaw: save.street.yaw }, false);
    showParked(); window.__kh && (window.__kh.spawned = home ? 'home' : loc && !savedBad ? 'saved' : 'default'); }
  if (!uid) setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 50); setTimeout(() => { if (!snapOk) { snapOk = true; firstSpawn(); } }, 6000);

  // ---------------------------------------------------------------- per-frame: prompts, garage doors, light
  function update(dt) { life.update(dt); if (tvMeshes.length) { const q = Math.floor((tvT += dt) * 8); if (q !== tvDraw.q) { tvDraw.q = q; tvDraw(tvT); } } if (P.sit && !inside) standUp(true); promptNow = null; let showIn = null; const m = D && D.mine && D.mine(); const driving = m && m.state !== 'parked';
    if (inside && (!Number.isFinite(P.y) || P.y < FLAT - 0.25)) { const r = rooms.get(inside.id); if (r) { P.x = r.cx; P.z = r.cz + 4.6 * SC; } P.y = FLAT; P.vy = 0; P.onGround = true; }
    if (deco && deco.out) { const y = standY(ground(P.x, P.z), P.x, P.z); if (inside || positionBad(P.x, P.z) || !Number.isFinite(P.y) || P.y < y - 0.45) placeAt(deco.spot); }
    if (driving && rad && !radioBox.hidden) { if (radioBox.classList.contains('dock')) placeNote(); else if (!radioBox.classList.contains('min')) dockRadio(); else { const rr = radioBox.getBoundingClientRect(); if (hitsPad({ l: rr.left, t: rr.top, r: rr.right, b: rr.bottom })) dockRadio(); } }
    if (inside) { const { cx, cz } = roomCell(inside); if (Math.hypot(P.x - cx, P.z - (cz + 5.4 * SC)) < 1.8 && !(deco && deco.out)) promptNow = { id: 'kh:out', label: '🚪 Go outside' }; else if (!deco) promptNow = roomPrompt(); }
    else if (!driving && !(deco && deco.out)) { let best = null, bd = 2.8; for (const h of housesNear(P.x, P.z, 12)) { const d = Math.hypot(h.door.x - P.x, h.door.z - P.z); if (d < bd) { bd = d; best = h; } }
      if (best) { const o = owners.get(best.id); if (best.sale) { if (!o) promptNow = { id: 'kh:sale:' + best.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[best.style]) }; else if (o.owner === uid) { promptNow = { id: 'kh:mine:' + best.id, label: '🏠 My home' }; showIn = best; } else if (canEnter(best)) showIn = best; else promptNow = { id: 'kh:ring:' + best.id, label: '🚪 Ring doorbell' }; } else showIn = best; }
      else for (const h of housesNear(P.x, P.z, 20)) if (h.sale && !owners.has(h.id)) { const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); if (Math.hypot(sx - P.x, sz - P.z) < 2.4) { promptNow = { id: 'kh:sale:' + h.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[h.style]) }; break; } } }
    garageTick(dt); signTick(dt); metroTick(dt);
    if (!inside && !promptNow) { if (driving) { if (Math.abs(m.speed) < 2 && ownHomes().some((q) => Math.hypot(q.x - m.x, q.z - m.z) < (q.estate ? 70 : 32))) promptNow = { id: 'kh:park', label: '🅿️ Park at home' }; }
      else { const n = nearMyCar(); if (n) { pendingTake = n; promptNow = { id: 'kh:take', label: '🚗 Drive ' + CAR[n.car.m].name }; } if (!promptNow && amAdmin) { const [sx, sz] = Lw(HOUSE_BY_ID[ADMIN_PLOT], PALACE_SIGN_AT.x, PALACE_SIGN_AT.z); if (Math.hypot(P.x - sx, P.z - sz) < 4.5) promptNow = { id: 'kh:sign', label: '✏️ Edit sign' }; } } }
    inB.hidden = !showIn; if (showIn) { inB.dataset.h = showIn.id; const ow = owners.get(showIn.id); inB.textContent = ow && ow.owner !== uid ? '🏠 Visit ' + String(ow.name || 'Pal').slice(0, 12) : '🏠 Go in'; }
    const two = !!(inside && !deco && rooms.get(inside.id) && rooms.get(inside.id).I.two); flB.hidden = !two; if (two) flB.textContent = P.y <= FLAT + 2.5 ? '🪜 Upstairs' : '🪜 Downstairs';
    const mineH = myPlot && HOUSE_BY_ID[myPlot]; yardB.hidden = !!(inside || deco || driving || !mineH || Math.hypot(P.x - mineH.x, P.z - mineH.z) > (mineH.estate ? 55 : 28));
    if (inside && roomLight) { roomLight.intensity = (LOW ? 18 : 26); const r = rooms.get(inside.id); if (r) { r.I.update(dt, P); if (roomLight2) { const up = P.y > FLAT + 2.5; roomLight2.position.set(r.cx + 3.4, FLAT + (up ? 5.9 : 2.7), r.cz + (up ? -2.5 : -1)); } if (deco) decoTick(dt); } }
    const inviteLab = paintInvite(); if (inviteLab && !promptNow && !deco) promptNow = { id: 'kh:invite', label: inviteLab };
    persist(false);
    window.__kh = Object.assign(window.__kh || {}, { myPlot, myTier, inside: inside && inside.id, owners: owners.size, cars: [...garages.values()].reduce((a, g) => a + g.carMs.length, 0), garages: garages.size, signs: signs.size, street: !!save.street, prompt: promptNow && promptNow.label, mini: radioBox.classList.contains('min'), dock: radioBox.classList.contains('dock'), radioOpen: !radioBox.hidden, mates: party && party.state ? party.state.n : 0, floor: flB.hidden ? '' : flB.textContent }); }
  // debug only (kemy-pals-debug=1): pretend to own a plot locally to preview garages/interiors (no writes)
  const fakeOwn = (id, tier, cars, who) => { if (lsg('kemy-pals-debug') !== '1') return false; const h = HOUSE_BY_ID[id]; owners.set(id, { owner: who || uid, name: (who ? 'Pal ' + who : S.profile?.displayName) || 'Me', style: HOME_STYLES[h.style].key, garage: tier, ...(cars != null ? { cars } : {}) }); if (!who && !h.admin) { myPlot = id; myTier = tier; } drawSign(h); buildGarage(h); return true; };
  W.homeSpot = () => (myPlot ? homeFront(HOUSE_BY_ID[myPlot]) : null); W.leaveRoom = () => { if (inside) goOut(); };
  const life = attachHomeLife(api, { inside: () => inside, room: () => (inside && rooms.get(inside.id)) || null, say,
    sitAt: (o) => { P.sit = { x: o.x, z: o.z, y: o.y, yaw: o.yaw, seat: o.seat || null, back: o.back, off: () => (o.dn === 'sleep' ? life.act('wake') : null) }; P.x = o.x; P.z = o.z; P.yaw = o.yaw; api.markDirty && api.markDirty(); },
    unsit: () => { const st = P.sit; if (!st) return; P.sit = null; P.x = st.back[0]; P.z = st.back[1]; P.y = st.back[2]; P.vy = 0; api.markDirty && api.markDirty(); } });
  window.__khApi = { life, lookOnly, myPanel, sellPanel, drive: D, sitDown, standUp, seats: () => seatsHere().map((q) => ({ c: q.c, x: q.x, z: q.z, y: q.y })), screens: () => (inside && rooms.get(inside.id)?.I.screens()) || [], tvShow, tvAct, fakeOwn, startDeco, endDeco, unstick, deco: () => deco, decoratePad, decoState, screenOf, guestPanel, radioPanel, rooms: () => rooms, ring: () => ring, goIn: (id) => goIn(HOUSE_BY_ID[id]), goOut, floor: () => changeFloor(), sale: (id) => salePanel(HOUSE_BY_ID[id]), home: () => homeB.click(), buy: (id) => buyHome(HOUSE_BY_ID[id], document.createElement('button')), garage: (t) => buyGarage(t, document.createElement('button')), parkHome, takeNear: () => takeCar(nearMyCar()), persist, shown: (id) => ((garages.get(id || myPlot) || {}).shown || []).map(({ car, s }) => ({ m: car.m, x: s.x, z: s.z, lv: s.lv || 0 })), garageInfo: (id) => { const g = garages.get(id || myPlot); return g ? { cars: g.carMs.length, shown: (g.shown || []).length } : null; }, syncCars, owners: () => owners, teleport };
  function destroy() { try { life.destroy(); } catch { /* */ } stopParty(); watchDecor(null); document.body.classList.remove('kh-decorating'); persist(true); removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); removeEventListener('resize', onMiniResize); removeEventListener('kemy:music', onHouseMusic); removeEventListener('keydown', onDecoKey, true); view.removeEventListener('pointerdown', onDecoDown, true); view.removeEventListener('pointermove', onDecoMove, true); view.removeEventListener('pointerup', onDecoUp, true); view.removeEventListener('pointercancel', onDecoUp, true); if (unsub) unsub(); roomState.box = null; roomState.inId = null; stopRadio(); if (roomLight) scene.remove(roomLight); if (roomLight2) scene.remove(roomLight2); radioBox.remove(); noteBtn.remove(); decB.remove(); yardB.remove(); stuckB.remove(); dbar.remove(); scene.remove(root); homeB.remove(); inB.remove(); flB.remove(); pan.remove(); css.remove(); css2.remove(); }
  void Q; void K;
  return { update, destroy };
}
