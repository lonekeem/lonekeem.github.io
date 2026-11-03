// 🚗 Kemy Motors: a big walk-in car dealership on the Open Plains (layout.js DEALER). Every car + truck in the game is on
// display: diamond cars inside the glass showroom on glowing turntables, the rest in painted rows on the lot. Walk up to one
// for a Buy prompt (same purchase path as My Cars), then drive it straight out to the road. The covered Sales counter opens
// the Sell flow (half back). Performance: the building is a few merged meshes + instanced flags/lamps, no real lights
// (glow materials only); display cars are lite builds made only when you are near and dropped when you leave (fewer +
// closer on phones / low graphics); price tags share one canvas atlas made on approach and freed when far.
// Original name, logo and designs. Written by Lone Keem.
import { DEALER, FLAT } from './layout.js';
import { buildCar, poseCar, CARS, CAR } from './cars.js';
import { device, labelKind } from '../input.js';

export function attachDealer(api, W, K) {
  const { THREE, scene, Q, P, box } = api; const LOW = !!api.LOW, PH = !!(Q && Q.phone); const { put, flush, G, std } = K;
  const D = DEALER, S = D.show, Y = FLAT; const root = new THREE.Group(); root.name = 'kemy-motors'; scene.add(root);
  const k = (n) => 'dl-' + n; const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(), M4 = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  // ---------------------------------------------------------------- slots: diamond cars inside, the rest on two lot rows
  const prem = CARS.filter((c) => c.prem), lot = CARS.filter((c) => !c.prem); const slots = [];
  prem.forEach((c, i) => { const row = i < 6 ? 0 : 1, j = row ? i - 6 : i; slots.push({ id: c.id, x: S.x0 + 7 + j * 7.6 + (row ? 3.8 : 0), z: row ? 363 : 352, yaw: Math.PI, spin: 1, in: 1 }); });
  lot.forEach((c, i) => { const row = i < 14 ? 0 : 1, j = row ? i - 14 : i; slots.push({ id: c.id, x: -17 + j * 6.9, z: row ? 323 : 301, yaw: Math.PI }); });
  for (const s of slots) { const c = CAR[s.id]; s.c = c; s.half = c.L / 2; s.tag = [s.x, s.z - s.half - 1.1]; if (!s.in) box.push({ x0: s.x - c.Wd / 2 - 0.1, x1: s.x + c.Wd / 2 + 0.1, z0: s.z - s.half, z1: s.z + s.half, top: 99, bot: -99, dl: 1 }); else box.push({ x0: s.x - 2.6, x1: s.x + 2.6, z0: s.z - 2.6, z1: s.z + 2.6, top: Y + 0.32, bot: -99, dl: 1 }); }

  // ---------------------------------------------------------------- lot: asphalt, curbs, painted stalls, driveways
  const px = (D.x0 + D.x1) / 2, pz = (D.z0 + D.z1) / 2;
  put(k('pave'), G.plane, '#3b3f48', px, Y + 0.03, pz, 0, D.x1 - D.x0, 1, D.z1 - D.z0);
  put(k('pave'), G.plane, '#3b3f48', D.gateN[0], Y + 0.031, (D.gateN[1] + D.z0) / 2 - 0.2, 0, 12, 1, D.z0 - D.gateN[1] + 1.2); // entrance off pb
  put(k('pave'), G.plane, '#3b3f48', (D.x1 + D.gateE[0]) / 2 + 0.2, Y + 0.031, D.gateE[1], 0, D.gateE[0] - D.x1 + 1.2, 1, 12); // entrance off pa
  for (const [x0, x1, z0, z1] of [[D.x0, D.gateN[0] - 6, D.z0, D.z0], [D.gateN[0] + 6, D.x1, D.z0, D.z0], [D.x0, D.x0, D.z0, D.z1], [D.x1, D.x1, D.z0, D.gateE[1] - 6], [D.x1, D.x1, D.gateE[1] + 6, D.z1], [D.x0, D.x1, D.z1, D.z1]]) {
    const w = Math.max(0.3, x1 - x0), d = Math.max(0.3, z1 - z0); put(k('trim'), G.box, '#d6d3cc', (x0 + x1) / 2, Y + 0.09, (z0 + z1) / 2, 0, w, 0.18, d); }
  for (const z of [301, 323]) for (let j = 0; j <= 14; j++) put(k('mark'), G.plane, '#f8fafc', -17 - 3.45 + j * 6.9, Y + 0.045, z, 0, 0.16, 1, 6.6);
  for (const z of [290, 312, 333]) for (let x = D.x0 + 4; x < D.x1 - 4; x += 5) put(k('mark'), G.plane, '#facc15', x, Y + 0.045, z, 0, 2.2, 1, 0.18);
  // big "KEMY MOTORS" arrows painted at both entrances
  put(k('mark'), G.plane, '#f8fafc', D.gateN[0], Y + 0.046, 284, 0, 0.5, 1, 3.2); put(k('mark'), G.cone4, '#f8fafc', D.gateN[0], Y + 0.04, 286.2, 0, 1.6, 0.02, 1.6);
  // ---------------------------------------------------------------- the glass showroom (walk-in: 12 m wide open doorway)
  const [d0, d1] = S.door, sw = S.x1 - S.x0, sd = S.z1 - S.z0, scx = (S.x0 + S.x1) / 2, scz = (S.z0 + S.z1) / 2;
  put(k('floor'), G.box, '#eef2f7', scx, Y + 0.12, scz, 0, sw, 0.2, sd);
  for (let x = S.x0 + 2; x < S.x1; x += 4) for (let z = S.z0 + 2; z < S.z1; z += 4) put(k('floor'), G.plane, (Math.round(x + z) / 4) % 2 ? '#e2e8f0' : '#f8fafc', x, Y + 0.225, z, 0, 3.9, 1, 3.9);
  put(k('bld'), G.box, '#1e1b4b', scx, Y + S.h / 2, S.z1 - 0.3, 0, sw, S.h, 0.6); // back wall
  put(k('bld'), G.box, '#f1f5f9', scx, Y + S.h + 0.4, scz, 0, sw + 2.4, 0.8, sd + 2.4); // roof slab (overhang = shade)
  put(k('glow'), G.box, '#38bdf8', scx, Y + S.h + 0.05, S.z0 - 1.21, 0, sw + 2.4, 0.18, 0.05); // glow fascia
  for (let x = S.x0; x <= S.x1 + 0.01; x += sw / 8) if (x < d0 - 0.2 || x > d1 + 0.2) put(k('frame'), G.box, '#334155', x, Y + S.h / 2, S.z0, 0, 0.3, S.h, 0.3); // mullions
  for (const x of [S.x0, S.x1]) for (let z = S.z0; z <= S.z1; z += sd / 4) put(k('frame'), G.box, '#334155', x, Y + S.h / 2, z, 0, 0.3, S.h, 0.3);
  put(k('frame'), G.box, '#334155', scx, Y + 3.6, S.z0, 0, sw, 0.25, 0.3);
  const glass = []; const gpane = (x0, x1, z0, z1, y0) => glass.push([(x0 + x1) / 2, Y + (y0 + S.h) / 2, (z0 + z1) / 2, Math.max(0.06, x1 - x0), S.h - y0, Math.max(0.06, z1 - z0)]);
  gpane(S.x0, d0, S.z0, S.z0, 0); gpane(d1, S.x1, S.z0, S.z0, 0); gpane(d0, d1, S.z0, S.z0, 3.7); gpane(S.x0, S.x0, S.z0, S.z1, 0); gpane(S.x1, S.x1, S.z0, S.z1, 0);
  for (const g of glass) put(k('glass'), G.box, '#bfe3ff', g[0], g[1], g[2], 0, g[3], g[4], g[5]);
  for (const [x0, x1] of [[S.x0, d0], [d1, S.x1]]) box.push({ x0, x1, z0: S.z0 - 0.2, z1: S.z0 + 0.2, top: Y + S.h, bot: -99 });
  box.push({ x0: S.x0, x1: S.x1, z0: S.z1 - 0.6, z1: S.z1, top: Y + S.h, bot: -99 }, { x0: S.x0 - 0.2, x1: S.x0 + 0.2, z0: S.z0, z1: S.z1, top: Y + S.h, bot: -99 }, { x0: S.x1 - 0.2, x1: S.x1 + 0.2, z0: S.z0, z1: S.z1, top: Y + S.h, bot: -99 });
  // turntables under the diamond cars (glowing rings)
  for (const s of slots) if (s.in) { put(k('trim'), G.cyl, '#cbd5e1', s.x, Y + 0.27, s.z, 0, 5.2, 0.1, 5.2); put(k('glow'), G.cyl, '#a78bfa', s.x, Y + 0.25, s.z, 0, 5.5, 0.06, 5.5); }
  // inside: welcome desk + a big logo wall
  put(k('bld'), G.box, '#f8fafc', scx, Y + 0.6, S.z1 - 3, 0, 8, 1.2, 1.4); put(k('glow'), G.box, '#38bdf8', scx, Y + 1.22, S.z1 - 3, 0, 8.1, 0.06, 1.5); box.push({ x0: scx - 4, x1: scx + 4, z0: S.z1 - 3.7, z1: S.z1 - 2.3, top: Y + 1.2, bot: -99 });
  // ---------------------------------------------------------------- covered Sales canopy + Sell counter
  const [kx, kz] = D.desk; const cx0 = 60, cx1 = 82, cz0 = 342, cz1 = 364;
  for (const [x, z] of [[cx0, cz0], [cx1, cz0], [cx0, cz1], [cx1, cz1]]) { put(k('frame'), G.cyl, '#94a3b8', x, Y + 2.6, z, 0, 0.4, 5.2, 0.4); api.cyl.push({ x, z, r: 0.25, top: 99 }); }
  put(k('bld'), G.box, '#1e1b4b', (cx0 + cx1) / 2, Y + 5.4, (cz0 + cz1) / 2, 0, cx1 - cx0 + 1.4, 0.5, cz1 - cz0 + 1.4); put(k('glow'), G.box, '#facc15', (cx0 + cx1) / 2, Y + 5.1, cz0 - 0.71, 0, cx1 - cx0 + 1.4, 0.14, 0.05);
  put(k('bld'), G.box, '#f59e0b', kx, Y + 0.6, kz + 1.4, 0, 6, 1.2, 1.2); put(k('trim'), G.box, '#fef3c7', kx, Y + 1.24, kz + 1.4, 0, 6.2, 0.08, 1.4); box.push({ x0: kx - 3, x1: kx + 3, z0: kz + 0.8, z1: kz + 2, top: Y + 1.2, bot: -99 });
  put(k('trim'), G.box, '#e2e8f0', (cx0 + cx1) / 2, Y + 0.08, (cz0 + cz1) / 2, 0, cx1 - cx0, 0.1, cz1 - cz0);
  // ---------------------------------------------------------------- tall pylon sign by the road
  const PY = [D.gateN[0] - 20, 277.2]; put(k('bld'), G.box, '#1e1b4b', PY[0], Y + 7, PY[1], 0, 1.2, 14, 1.2); put(k('glow'), G.box, '#38bdf8', PY[0], Y + 14.2, PY[1], 0, 6.6, 0.25, 1.4); box.push({ x0: PY[0] - 0.6, x1: PY[0] + 0.6, z0: PY[1] - 0.6, z1: PY[1] + 0.6, top: 99, bot: -99 });
  // ---------------------------------------------------------------- flush static meshes
  const glassM = new THREE.MeshStandardMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false, vertexColors: true });
  const glowM = std('#fff', { vc: true, e: '#ffffff', ei: 0.9, r: 0.4 }); glowM.emissive.set('#ffffff'); glowM.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive * vColor;'); };
  const MAT = { pave: std('#fff', { vc: true, r: 0.95 }), mark: std('#fff', { vc: true, r: 0.7, x: { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 } }), floor: std('#fff', { vc: true, r: 0.25 }), glass: glassM, glow: glowM };
  for (const n of ['pave', 'mark', 'trim', 'floor', 'bld', 'frame', 'glow', 'glass']) { const m = flush(k(n), MAT[n] || std('#fff', { vc: true, r: 0.6 }), !['pave', 'mark', 'floor', 'glass', 'glow'].includes(n), root); if (m && n === 'glass') m.renderOrder = 3; }
  // signs (one canvas each, made once): pylon (both faces), showroom fascia, sales canopy
  const signTex = (w, h, draw) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const logo = (g, w, h, sub) => { g.fillStyle = '#1e1b4b'; g.fillRect(0, 0, w, h); g.strokeStyle = '#38bdf8'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#facc15'; g.beginPath(); g.arc(h * 0.5, h * 0.5, h * 0.3, 0, 7); g.fill(); g.fillStyle = '#1e1b4b'; g.font = `900 ${h * 0.34}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K', h * 0.5, h * 0.53);
    g.fillStyle = '#fff'; g.font = `900 ${h * (sub ? 0.32 : 0.4)}px system-ui,sans-serif`; g.fillText('KEMY MOTORS', (w + h * 0.8) / 2, h * (sub ? 0.4 : 0.52)); if (sub) { g.fillStyle = '#7dd3fc'; g.font = `700 ${h * 0.16}px system-ui,sans-serif`; g.fillText(sub, (w + h * 0.8) / 2, h * 0.74); } };
  const sMat = (t) => new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, toneMapped: false });
  const pyT = signTex(512, 256, (g, w, h) => logo(g, w, h, 'Every car + truck · Buy & Sell')); const pyS = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), sMat(pyT)); pyS.position.set(PY[0], Y + 12.2, PY[1]); root.add(pyS);
  const faT = signTex(1024, 160, (g, w, h) => logo(g, w, h)); const fa = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.4), sMat(faT)); fa.position.set(scx, Y + S.h + 2.1, S.z0 - 1.25); fa.rotation.y = Math.PI; root.add(fa);
  const faB = new THREE.Mesh(new THREE.BoxGeometry(23, 3.8, 0.4), std('#1e1b4b')); faB.position.set(scx, Y + S.h + 2.1, S.z0 - 1.0); root.add(faB);
  const slT = signTex(512, 128, (g, w, h) => { g.fillStyle = '#f59e0b'; g.fillRect(0, 0, w, h); g.fillStyle = '#1e1b4b'; g.font = '900 54px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💰 SELL YOUR CAR', w / 2, h / 2 + 2); });
  const sl = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), sMat(slT)); sl.position.set((cx0 + cx1) / 2, Y + 4.4, cz0 - 0.75); sl.rotation.y = Math.PI; root.add(sl);
  // flags along the front + lot lamps (instanced; lamp heads glow, no real lights)
  { const fl = []; for (let x = D.x0 + 3; x < D.x1 - 2; x += 8) if (Math.abs(x - D.gateN[0]) > 7 && Math.abs(x - PY[0]) > 2) fl.push(x);
    const poleG = new THREE.CylinderGeometry(0.06, 0.08, 6, 6); poleG.translate(0, 3, 0); const flagG = new THREE.BoxGeometry(1.6, 0.9, 0.03); flagG.translate(0.82, 5.4, 0);
    const pI = new THREE.InstancedMesh(poleG, std('#cbd5e1', { m: 0.6, r: 0.3 }), fl.length), fI = new THREE.InstancedMesh(flagG, std('#ffffff', { r: 0.7, x: { side: THREE.DoubleSide } }), fl.length); const FC = ['#ef4444', '#38bdf8', '#facc15', '#22c55e', '#a855f7'];
    fl.forEach((x, i) => { M4.compose(tv.set(x, Y, D.z0 + 0.6), tq.setFromAxisAngle(UP, 0.3 + (i % 3) * 0.25), ts.set(1, 1, 1)); pI.setMatrixAt(i, M4); fI.setMatrixAt(i, M4); fI.setColorAt(i, col.set(FC[i % FC.length])); api.cyl.push({ x, z: D.z0 + 0.6, r: 0.1, top: 99 }); }); root.add(pI, fI);
    const lamps = []; for (const z of [312]) for (let x = D.x0 + 6; x < D.x1 - 4; x += LOW ? 26 : 16) lamps.push([x, z]); lamps.push([D.x0 + 2, 338], [D.x1 - 2, 338]);
    const lpG = new THREE.CylinderGeometry(0.1, 0.14, 7, 6); lpG.translate(0, 3.5, 0); const lhG = new THREE.BoxGeometry(1.8, 0.2, 0.6); lhG.translate(0, 7, 0); const lpI = new THREE.InstancedMesh(lpG, std('#64748b', { m: 0.6, r: 0.4 }), lamps.length), lhI = new THREE.InstancedMesh(lhG, std('#fff7d6', { e: '#fff3c4', ei: 0.7 }), lamps.length);
    lamps.forEach(([x, z], i) => { M4.compose(tv.set(x, Y, z), tq.identity(), ts.set(1, 1, 1)); lpI.setMatrixAt(i, M4); lhI.setMatrixAt(i, M4); api.cyl.push({ x, z, r: 0.18, top: 99 }); }); root.add(lpI, lhI); }

  // ---------------------------------------------------------------- price tags: one canvas atlas (4 x 10 cells), one merged mesh, made on approach
  let tags = null; const owned = () => { const o = new Set(), Dr = W.drive; if (Dr && Dr.isOwned) for (const s of slots) if (Dr.isOwned(s.id)) o.add(s.id); return o; }; let ownSig = '';
  function drawTags(cv) { const g = cv.getContext('2d'); g.clearRect(0, 0, 1024, 1024); const o = owned(); slots.forEach((s, i) => { const x = (i % 4) * 256, y = Math.floor(i / 4) * 102.4, c = s.c, mine = o.has(s.id);
    g.fillStyle = mine ? '#16a34a' : c.prem ? '#4c1d95' : '#1e1b4b'; g.fillRect(x + 2, y + 2, 252, 98); g.fillStyle = '#facc15'; g.fillRect(x + 2, y + 2, 252, 8); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 28px system-ui,sans-serif'; g.fillText(c.name, x + 128, y + 38, 240); g.font = '900 32px system-ui,sans-serif'; g.fillStyle = mine ? '#fff' : '#fde68a'; g.fillText(mine ? '✅ OWNED' : c.free ? 'FREE' : c.p ? '⭐ ' + c.p.toLocaleString() : '💎 ' + c.d.toLocaleString(), x + 128, y + 76, 240); }); }
  function makeTags() { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 1024; drawTags(cv); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const n = slots.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = []; const w = 1.5, h = 0.6;
    slots.forEach((s, i) => { const [x, z] = s.tag, y = Y + (s.in ? 1.35 : 1.25); const cx = (i % 4) / 4, cy = 1 - Math.floor(i / 4) * 0.1; const v = [[x + w / 2, y + h, z], [x - w / 2, y + h, z], [x - w / 2, y, z], [x + w / 2, y, z]];
      v.forEach((p, j) => pos.set(p, i * 12 + j * 3)); uv.set([cx + 0.25, cy, cx, cy, cx, cy - 0.1, cx + 0.25, cy - 0.1], i * 8); const b = i * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeBoundingSphere();
    const tm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), mesh = new THREE.Mesh(geo, tm); root.add(mesh);
    // back face: same quads, mirrored u, so the tag reads correctly from both sides (no mirror writing)
    const geoB = geo.clone(), ub = geoB.attributes.uv.array; for (let i = 0; i < n; i++) { const o = i * 8, a0 = ub[o], a1 = ub[o + 2]; ub[o] = a1; ub[o + 2] = a0; ub[o + 4] = a0; ub[o + 6] = a1; }
    const tmB = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.BackSide }), meshB = new THREE.Mesh(geoB, tmB); root.add(meshB);
    const postG = new THREE.CylinderGeometry(0.04, 0.04, 1.25, 5); postG.translate(0, 0.62, 0); const pI = new THREE.InstancedMesh(postG, std('#94a3b8', { m: 0.5 }), n); slots.forEach((s, i) => { M4.makeTranslation(s.tag[0], Y + (s.in ? 0.2 : 0), s.tag[1]); pI.setMatrixAt(i, M4); }); root.add(pI);
    tags = { cv, tex, mesh, meshB, pI }; ownSig = [...owned()].sort().join(); }
  function dropTags() { if (!tags) return; root.remove(tags.mesh, tags.meshB, tags.pI); tags.meshB.geometry.dispose(); tags.meshB.material.dispose(); tags.mesh.geometry.dispose(); tags.mesh.material.dispose(); tags.tex.dispose(); tags.pI.geometry.dispose(); tags.pI.material.dispose(); tags.pI.dispose(); tags = null; }

  // ---------------------------------------------------------------- lazy display cars
  const NEAR = LOW || PH ? 46 : 85, FAR = NEAR + 22, PER = LOW || PH ? 1 : 2, MAXB = PH ? 6 : LOW ? 10 : 24; const order = slots.slice(); const st = { built: 0, tags: false, tris: 0 }; window.__kdl = st;
  function buildSlot(s) { const m = buildCar(s.c, s.c.color, { lite: true, noShadow: true }); poseCar(m, { x: s.x, y: Y + (s.in ? 0.3 : 0), z: s.z, yaw: s.yaw }, 0, 0); m.userData.dl = 1; root.add(m); s.m = m; }
  function dropSlot(s) { if (!s.m) return; root.remove(s.m); s.m = null; } // geometry + materials are shared via cars.js caches (nothing per car to free)
  let tick = 0, tAll = 0, visT = 0;
  function update(dt, now) { const d0 = Math.hypot(P.x - px, P.z - pz); if (now - visT > 400) { visT = now; root.visible = d0 < (Q.draw || 300) + 80; }
    if (!root.visible) { if (st.built) for (const s of slots) dropSlot(s); st.built = 0; if (tags) dropTags(); st.tags = false; return; }
    for (const s of slots) if (s.spin && s.m) s.m.rotation.y += dt * 0.3;
    if ((tick += dt) < 0.25) return; tick = 0; let made = 0; st.built = 0;
    // nearest first, capped (phones / low graphics keep only a handful of display cars alive at once)
    for (const s of slots) s.d = Math.hypot(P.x - s.x, P.z - s.z); order.sort((a, b) => a.d - b.d);
    order.forEach((s, i) => { if (s.m && (s.d > FAR || i >= MAXB)) dropSlot(s); else if (!s.m && s.d < NEAR && i < MAXB && made < PER) { buildSlot(s); made++; } if (s.m) st.built++; });
    if (!tags && d0 < 120) makeTags(); else if (tags && d0 > 170) dropTags(); st.tags = !!tags;
    if (tags) { const sig = [...owned()].sort().join(); if (sig !== ownSig) { ownSig = sig; drawTags(tags.cv); tags.tex.needsUpdate = true; } }
    if ((tAll += 0.25) > 2) { tAll = 0; let t = 0; root.traverse((o) => { if (o.isMesh && o.visible && o.geometry) { const g = o.geometry, n = g.index ? g.index.count / 3 : g.attributes.position.count / 3; t += n * (o.isInstancedMesh ? o.count : 1); } }); st.tris = Math.round(t); } }

  // ---------------------------------------------------------------- prompts: walk up to a car = Buy (or Owned · Drive), the counter = Sell
  const pre = () => { const d = device(); if (d === 'touch') return ''; if (d === 'keyboard') return 'E '; return labelKind(d) === 'ps' ? '✕ ' : 'A '; };
  const price = (c) => (c.free ? 'Free' : c.p ? '⭐ ' + c.p : '💎 ' + c.d);
  function nearSlot() { let best = null, bd = 1e9; for (const s of slots) { const dx = Math.abs(P.x - s.x) - (s.in ? 2.6 : s.c.Wd / 2), dz = Math.abs(P.z - s.z) - (s.in ? 2.6 : s.half); const d = Math.max(dx, dz); if (d < 2.4 && d < bd) { bd = d; best = s; } } return best; }
  const driving = () => (W.driving ? W.driving() : false);
  const pp = api.prompt; api.prompt = () => { if (!driving() && Math.hypot(P.x - kx, P.z - kz) < 3.2) return { id: 'dl:sell', label: `${pre()}💰 Sell a car` }; const p0 = pp && pp(); if (p0) return p0; if (driving() || Math.abs(P.x - px) > 70 || Math.abs(P.z - pz) > 60) return null;
    if (Math.hypot(P.x - kx, P.z - kz) < 3.2) return { id: 'dl:sell', label: `${pre()}💰 Sell a car` };
    const s = nearSlot(); if (!s) return null; const c = s.c; if (W.drive && W.drive.isOwned && W.drive.isOwned(c.id)) return { id: 'dl:drive:' + c.id, label: `✅ Owned · ${pre()}Drive ${c.name}` };
    return { id: 'dl:buy:' + c.id, label: `${pre()}Buy ${c.name} · ${price(c)}` }; };
  const pa = api.onAction; api.onAction = (a) => { if (!a || !a.startsWith('dl:')) { if (pa) pa(a); return; } const [, v, id] = a.split(':'); const Dr = W.drive; if (!Dr) return;
    if (v === 'sell') Dr.openSell(); else if (v === 'drive') driveOut(id); else if (v === 'buy') buyPanel(id); };
  function driveOut(id) { const Dr = W.drive; const pref = Dr.pref || {}; const [x, z, yaw] = D.exit; Dr.place(id, (pref.colors || {})[id] ?? CAR[id].color, { x, z, yaw }, true); window.__kdl.out = id; }
  let panel = null; const host = K.hud || W.hud || api.view;
  function buyPanel(id) { if (panel) panel.remove(); panel = null; const c = CAR[id]; if (!c || (W.drive.isOwned && W.drive.isOwned(id))) return; const d = document.createElement('div'); d.className = 'ks-panel dl-buy'; panel = d;
    d.innerHTML = `<div class="ks-card" role="dialog" aria-label="Buy ${c.name}"><h3>${c.emoji} ${c.name}</h3><p style="margin:0 0 10px;opacity:.85">${c.blurb}</p><p style="margin:0 0 12px;font-size:18px"><b>${price(c)}</b> <small style="opacity:.75">${c.p ? 'Star Coins' : 'Diamonds'} · no real money</small></p>
      <div class="row" style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-ok>${pre()}Buy · ${price(c)}</button><button type="button" class="ghost" data-close>Not now</button></div></div>`;
    host.appendChild(d); const ok = d.querySelector('[data-ok]'); ok.focus();
    d.onclick = async (e) => { const b = e.target.closest('button'); if (e.target === d || (b && b.dataset.close !== undefined)) { d.remove(); if (panel === d) panel = null; return; } if (!b || b.dataset.ok === undefined) return;
      b.disabled = true; b.textContent = 'Buying…'; let r = false; try { r = await W.drive.buyCar(id); } catch (er) { console.warn('dealer buy', er); } window.__kdl.lastBuy = r; d.remove(); if (panel === d) panel = null; if (r) { driveOut(id); (K.say || W.say || api.toast || (() => {}))(`🎉 ${c.name} is yours! Drive it out to the road 🛣️`); } }; }
  // ---------------------------------------------------------------- map + landmarks
  const pl = W.landmarks; W.landmarks = () => (pl ? pl() : []).concat([{ name: '🚗 Kemy Motors', x: px, z: pz, gx: D.gateN[0], gz: D.gateN[1] + 6 }]);
  const pml = W.mapLabels; W.mapLabels = (g, mx, mz, sc) => { if (pml) pml(g, mx, mz, sc); g.font = 'bold 9px system-ui,sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText('🚗 Kemy Motors', mx(px) + 1, mz(pz) + 1); g.fillStyle = '#7dd3fc'; g.fillText('🚗 Kemy Motors', mx(px), mz(pz)); };
  const pmx = W.mapExtra; W.mapExtra = (g, mx, mz, sc) => { if (pmx) pmx(g, mx, mz, sc); g.fillStyle = 'rgba(59,63,72,.8)'; g.fillRect(mx(D.x0), mz(D.z0), (D.x1 - D.x0) * sc, (D.z1 - D.z0) * sc); g.fillStyle = 'rgba(191,227,255,.9)'; g.fillRect(mx(S.x0), mz(S.z0), (S.x1 - S.x0) * sc, (S.z1 - S.z0) * sc); };
  window.__kdlApi = { slots: () => slots.map((s) => ({ id: s.id, x: s.x, z: s.z, tag: s.tag, built: !!s.m })), desk: D.desk, exit: D.exit, door: S.door };
  function destroy() { dropTags(); for (const s of slots) dropSlot(s); if (panel) panel.remove(); scene.remove(root); for (let i = box.length - 1; i >= 0; i--) if (box[i].dl) box.splice(i, 1); }
  return { update, destroy, root, slots };
}
