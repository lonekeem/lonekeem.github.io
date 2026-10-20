// Kemy World property: buy a house on a "For Sale" plot (one owner each, any town), add a garage (1-3 bays),
// go inside furnished interiors (living room, kitchen, bedroom; built only when you walk in), drive into your own
// garage (the roll-up door opens for the owner and closes after), "Park here" saves the car in that bay, your last
// spot + a car left on the street are remembered (localStorage + a throttled private Firestore doc).
// Purchases use the existing validated coin / diamond shop paths; firestore.rules check deed + owner. Written by Lone Keem.
import { doc, getDoc, setDoc, onSnapshot, collection, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { HOUSES, HOUSE_BY_ID, HOME_STYLES, GARAGES, FLAT, ROOMS, roomState, worldClamp } from './layout.js';
import { CAR, buildCar, poseCar } from './cars.js';
import { buildInterior, DECOR, decorItem, parseItems, serItems, defaultItems, WALL_SW, EXT_SW, FLOORS } from './interior.js';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const RADIO_RE = /^https:\/\/(open\.spotify\.com|embed\.music\.apple\.com|music\.apple\.com)\//;

const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export async function registerHomeItems() { const cat = await import('../pals/catalog.js'); const all = [...HOME_STYLES, ...GARAGES];
  cat.addItems(all.filter((x) => x.p).map((x) => ({ id: x.item, name: x.name, kind: 'home', p: x.p, r: 'r' })));
  cat.addDiamondItems(all.filter((x) => x.d).map((x) => ({ id: x.item, name: x.name, kind: 'home', d: x.d, productId: x.productId })));
  const DE = Object.entries(DECOR); cat.addItems(DE.filter(([, d]) => d.c).map(([c, d]) => ({ id: decorItem(c), name: '🛠️ ' + d.n, kind: 'home', p: d.c, r: 'r' })));
  cat.addDiamondItems(DE.filter(([, d]) => d.d).map(([c, d]) => ({ id: decorItem(c), name: '🛠️ ' + d.n, kind: 'home', d: d.d, productId: 'kemy_decor_' + c }))); }
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
  const rooms = new Map(); let roomLight = null, roomLight2 = null, deco = null, radioOff = null;
  function buildRoom(h) { if (rooms.has(h.id)) return rooms.get(h.id); const { cx, cz } = roomCell(h); const o = owners.get(h.id); const dec = (o && o.decor) || {};
    const I = buildInterior(api, { put, flush, G, y: FLAT }, h, cx, cz, dec); root.add(I.g); const r0 = { g: I.g, cx, cz, I, dk: JSON.stringify(dec) }; rooms.set(h.id, r0); return r0; }
  function applyDecor(id) { const o = owners.get(id); const dec = (o && o.decor) || {}; if (W.paintHouse && HOUSE_BY_ID[id] && HOUSE_BY_ID[id].sale) W.paintHouse(id, dec.ext || null); const r = rooms.get(id); const k = JSON.stringify(dec);
    if (r && r.dk !== k && !(deco && inside && inside.id === id)) { r.dk = k; r.I.setWall(dec.wall); r.I.setFloor(dec.floor || r.I.S.floor); r.I.setItems(parseItems(dec.items || defaultItems(r.I.two))); } }
  const canEnter = (h) => { if (!h.sale) return true; const o = owners.get(h.id); if (!o) return false; return o.owner === uid || o.open === true || (Array.isArray(o.inv) && o.inv.includes(uid)); };
  function goIn(h) { if (!canEnter(h)) { say('🔒 Only the owner and invited friends can go inside'); return; } if (D && D.mine && D.mine() && D.mine().state !== 'parked') return; const r = buildRoom(h); inside = h; roomState.box = { x0: r.cx - 5.6, x1: r.cx + 5.6, z0: r.cz - 5.6, z1: r.cz + 5.5 };
    P.x = r.cx; P.z = r.cz + 4.6; P.yaw = Math.PI; P.y = FLAT; if (!roomLight) { roomLight = new THREE.PointLight('#fff1d6', LOW ? 18 : 26, 16, 1.6); scene.add(roomLight); } roomLight.position.set(r.cx - 3, FLAT + 2.7, r.cz); roomLight.visible = true; if (!LOW) { if (!roomLight2) { roomLight2 = new THREE.PointLight('#fff1d6', 20, 14, 1.6); scene.add(roomLight2); } roomLight2.visible = true; }
    roomState.inId = h.id; const ow = owners.get(h.id); say(ow && ow.owner !== uid ? '🏠 Visiting ' + (ow.name || 'a Pal') + '’s home' : '🏠 Welcome in!' + (r.I.two ? ' Stairs to the 2nd floor are on the right.' : '')); radioOff = null; startRadio(); decB.hidden = !(ow && ow.owner === uid); api.markDirty && api.markDirty(); }
  function goOut() { const h = inside; if (!h) return; if (deco) endDeco(false); inside = null; roomState.box = null; roomState.inId = null; stopRadio(); decB.hidden = true; if (roomLight2) roomLight2.visible = false; const [x, z] = Lw(h, 0, h.d / 2 + 3.2); P.x = x; P.z = z; P.yaw = h.face > 0 ? 0 : Math.PI; P.y = ground(x, z); if (roomLight) roomLight.visible = false; api.markDirty && api.markDirty(); }

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
    window.__kh && (window.__kh.radio = Rd.k); }
  function stopRadio() { if (rad) { try { if (rad.emb) rad.emb.destroy(); } catch { /* */ } if (rad.au) { try { rad.au.pause(); rad.au.removeAttribute('src'); rad.au.load(); } catch { /* */ } dispatchEvent(new CustomEvent('kemy:media-stop', { detail: { source: 'house-radio' } })); } } rad = null; radioBox.hidden = true; radioBox.innerHTML = ''; window.__kh && (window.__kh.radio = null); }
  // owner writes (merge; rules re-check owner/name/garage/at on every write)
  const homeW = (patch) => { const o = owners.get(myPlot); return setDoc(doc(db, 'homes', myPlot), { ...patch, owner: uid, name: S.profile.displayName, style: o.style, garage: o.garage || 0, at: serverTimestamp() }, { merge: true }); };
  const wErr = (e) => say(e && e.code === 'permission-denied' ? '⚠️ Saving this needs the updated house rules (ask the admin to deploy firestore.rules)' : (e && e.message) || 'Could not save');
  function radioPanel() { const o = owners.get(myPlot) || {}; const Rd = o.radio || {}; import('../theme.js').then(({ TRACKS }) => panel(`<h3>📻 House radio</h3><p><small>Plays for you and visitors while inside. Paste a Spotify or Apple Music link, or pick a Kemy Radio track (synced for everyone).</small></p>
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
  function nearest() { const r = deco.r; const up = P.y > FLAT + 2.5 ? 1 : 0; let bi = -1, bd = 2.6; deco.items.forEach((it, i) => { if ((it.f || 0) !== up && deco.r.I.two) return; const d = Math.hypot(r.cx + it.x - P.x, r.cz + it.z - P.z); if (d < bd) { bd = d; bi = i; } }); return bi; }
  function decoTick(dt) { deco.t += dt; if (deco.t > 0.3) { deco.t = 0; const n = nearest(); if (n !== deco.sel) { deco.sel = n; if (deco.tab === 's' || deco.tab === 'f') drawDeco(); } } const it = deco.items[deco.sel]; ring.visible = !!it; if (it) ring.position.set(deco.r.cx + it.x, FLAT + (it.f && deco.r.I.two ? 3.37 : 0.03), deco.r.cz + it.z); }
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
      deco.items.push({ c, x: snap(P.x - r.cx + fx * 1.6), z: snap(P.z - r.cz + fz * 1.6), r: (Math.round(((P.yaw || 0) + Math.PI) / (Math.PI / 2)) % 4 + 4) % 4, f: r.I.two && P.y > FLAT + 2.5 ? 1 : 0 }); deco.sel = deco.items.length - 1; relItems(); drawDeco(); })); }
  decB.onclick = () => startDeco();
  // ---------------------------------------------------------------- owners (live) + buying
  let unsub = null; if (uid && db) try { unsub = onSnapshot(collection(db, 'homes'), (qs) => { const prev = new Map(owners); owners.clear(); qs.forEach((d) => owners.set(d.id, d.data())); myPlot = null; myTier = 0;
      for (const [id, o] of owners) if (o.owner === uid) { myPlot = id; myTier = o.garage || 0; }
      for (const h of HOUSES) if (h.sale) { const a = prev.get(h.id), b = owners.get(h.id); if (JSON.stringify(a) !== JSON.stringify(b)) drawSign(h); const t = b ? b.garage || 0 : 0; const cur = garages.get(h.id); if ((cur ? cur.tier : 0) !== t) buildGarage(h, t); }
      for (const h of HOUSES) if (h.sale && JSON.stringify((prev.get(h.id) || {}).decor) !== JSON.stringify((owners.get(h.id) || {}).decor)) applyDecor(h.id);
      if (inside && !canEnter(inside)) { goOut(); say('🚪 The owner closed this home'); } else if (inside && radioKey(prev.get(inside.id)) !== radioKey(owners.get(inside.id))) { radioOff = null; startRadio(); }
      if (!snapOk) { snapOk = true; firstSpawn(); } }, (e) => { console.warn('homes', e); if (!snapOk) { snapOk = true; firstSpawn(); } }); } catch (e) { console.warn(e); }
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
  function myPanel() { const h = HOUSE_BY_ID[myPlot]; const st = HOME_STYLES[h.style]; panel(`<h3>🏠 My ${st.name}</h3><div class="row"><span>Garage</span><b>${myTier ? myTier + ' bay' + (myTier > 1 ? 's' : '') : 'none'}</b></div>` + GARAGES.filter((g) => g.tier > myTier).map((g) => `<div class="row"><span>${g.name}</span><button data-g="${g.tier}">${price(g)}</button></div>`).join('') + `<p><small>Drive into a bay and tap 🅿️ Park here. Bay 3 is your reserved curb spot.</small></p><div><button data-gu>🚪 Open house & invites</button><button data-rd>📻 House radio</button><button data-dc>🛠️ Decorate</button></div><button class="g" data-m>Move out</button>`,
    (c) => { c.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => buyGarage(+b.dataset.g, b))); c.querySelector('[data-gu]').onclick = () => guestPanel(); c.querySelector('[data-rd]').onclick = () => radioPanel(); c.querySelector('[data-dc]').onclick = () => { pan.hidden = true; if (inside && inside.id === myPlot) startDeco(); else { goIn(HOUSE_BY_ID[myPlot]); setTimeout(startDeco, 50); } }; c.querySelector('[data-m]').onclick = (e) => { if (e.target.dataset.sure) moveOut(e.target); else { e.target.dataset.sure = 1; e.target.textContent = 'Tap again to move out'; } }; }); }
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
      if (best) { const o = owners.get(best.id); if (best.sale) { if (!o) promptNow = { id: 'kh:sale:' + best.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[best.style]) }; else if (o.owner === uid) { promptNow = { id: 'kh:mine:' + best.id, label: '🏠 My home' }; showIn = best; } else if (canEnter(best)) showIn = best; else promptNow = { id: 'kh:locked:' + best.id, label: '🔒 ' + (o.name || 'A Pal') + '’s home' }; } else showIn = best; }
      else for (const h of HOUSES) if (h.sale && !owners.has(h.id)) { const [sx, sz] = Lw(h, -6.3, h.d / 2 + 4.6); if (Math.hypot(sx - P.x, sz - P.z) < 2.4) { promptNow = { id: 'kh:sale:' + h.id, label: '🏷️ For Sale · ' + price(HOME_STYLES[h.style]) }; break; } } }
    const G0 = myPlot && garages.get(myPlot);
    for (const [id, gg] of garages) for (const b of gg.bays) { if (b.curb) continue; let want = 0;
      if (id === myPlot) { if (driving && Math.hypot(m.x - b.front[0], m.z - b.front[1]) < 11) want = 1; if (driving && Math.hypot(m.x - b.cx, m.z - b.cz) < 3.2) want = 1; if (!driving && save.cars.some((c) => c && c.bay === b.k) && Math.hypot(P.x - b.front[0], P.z - b.front[1]) < 3) want = 1; if (Math.hypot(P.x - b.cx, P.z - b.cz) < 2.8) want = 1; }
      b.open += (want - b.open) * Math.min(1, dt * 2.5); const o = b.open; b.door.position.y = 1.15 + o * 1.25; b.door.scale.y = 1 - o * 0.82; b.door.position.z = 5.3 / 2 - 0.05 - o * 0.4; b.dcol.top = o > 0.6 ? -99 : 99; }
    if (G0 && !inside) for (const b of G0.bays) { const has = save.cars.some((c) => c && c.bay === b.k);
      if (driving && !has && Math.hypot(m.x - b.cx, m.z - b.cz) < (b.curb ? 2.2 : 1.6) && Math.abs(m.speed) < 1.5) promptNow = { id: 'kh:park:' + b.k, label: '🅿️ Park here' };
      else if (!driving && has && Math.hypot(P.x - b.front[0], P.z - b.front[1]) < 2.6) promptNow = { id: 'kh:take:' + b.k, label: '🚗 Take car' }; }
    inB.hidden = !showIn; if (showIn) { inB.dataset.h = showIn.id; const ow = owners.get(showIn.id); inB.textContent = ow && ow.owner !== uid ? '🏠 Visit ' + String(ow.name || 'Pal').slice(0, 12) : '🏠 Go in'; }
    if (inside && roomLight) { roomLight.intensity = (LOW ? 18 : 26); const r = rooms.get(inside.id); if (r) { r.I.update(dt, P); if (roomLight2) { const up = P.y > FLAT + 2.5; roomLight2.position.set(r.cx + 3.4, FLAT + (up ? 5.9 : 2.7), r.cz + (up ? -2.5 : -1)); } if (deco) decoTick(dt); } }
    persist(false);
    window.__kh = Object.assign(window.__kh || {}, { myPlot, myTier, inside: inside && inside.id, owners: owners.size, cars: save.cars.length, street: !!save.street, prompt: promptNow && promptNow.label }); }
  // debug only (kemy-pals-debug=1): pretend to own a plot locally to preview garages/interiors (no writes)
  const fakeOwn = (id, tier) => { if (lsg('kemy-pals-debug') !== '1') return false; owners.set(id, { owner: uid, name: S.profile?.displayName || 'Me', style: HOME_STYLES[HOUSE_BY_ID[id].style].key, garage: tier }); myPlot = id; myTier = tier; drawSign(HOUSE_BY_ID[id]); buildGarage(HOUSE_BY_ID[id], tier); return true; };
  W.homeSpot = () => (myPlot ? homeFront(HOUSE_BY_ID[myPlot]) : null); W.leaveRoom = () => { if (inside) goOut(); };
  window.__khApi = { fakeOwn, startDeco, endDeco, deco: () => deco, guestPanel, radioPanel, rooms: () => rooms, ring: () => ring, goIn: (id) => goIn(HOUSE_BY_ID[id]), goOut, sale: (id) => salePanel(HOUSE_BY_ID[id]), home: () => homeB.click(), buy: (id) => buyHome(HOUSE_BY_ID[id], document.createElement('button')), garage: (t) => buyGarage(t, document.createElement('button')), parkHere, takeCar, persist, bays: () => (garages.get(myPlot) || { bays: [] }).bays.map((b) => ({ k: b.k, x: b.cx, z: b.cz, yaw: b.yaw, front: b.front, open: b.open })), teleport };
  function destroy() { persist(true); removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide); if (unsub) unsub(); roomState.box = null; roomState.inId = null; stopRadio(); if (roomLight) scene.remove(roomLight); if (roomLight2) scene.remove(roomLight2); radioBox.remove(); decB.remove(); dbar.remove(); scene.remove(root); homeB.remove(); inB.remove(); pan.remove(); css.remove(); }
  void Q; void K;
  return { update, destroy };
}
