// Jewelry & accessories in 3D: anchor points on EVERY Pal body shape (blob / jelly / star / cloud, paws, wings, flippers)
// plus lightweight original models (metal + gem materials, slightly oversized so they read at game-camera distance,
// a soft twinkle on gems). Built from pal3d.js wear3D(); all pieces are parented to rig bones so they move with dances.
// Slots are independent, so earrings + necklace + bracelet + ring + glasses + hat can all be worn together.
import * as THREE from '../vendor/three-0.170.0.module.min.js';
const TAU = Math.PI * 2;
const G = new Map(); const geo = (k, f) => { let g = G.get(k); if (!g) { g = f(); G.set(k, g); } return g; };
const MT = new Map();
function metal(col, lo) { const k = 'm' + col + lo; let m = MT.get(k); if (!m) { m = lo ? new THREE.MeshStandardMaterial({ color: col, metalness: 0.85, roughness: 0.3, emissive: new THREE.Color(col).multiplyScalar(0.12) })
  : new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.95, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, emissive: new THREE.Color(col).multiplyScalar(0.14) }); m.userData.wear = 1; m.userData.shared = 1; MT.set(k, m); } return m; }
function gem(col, lo) { const k = 'g' + col + lo; let m = MT.get(k); if (!m) { m = lo ? new THREE.MeshStandardMaterial({ color: col, metalness: 0.2, roughness: 0.15, emissive: col, emissiveIntensity: 0.35 })
  : new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.1, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0, emissive: col, emissiveIntensity: 0.3, iridescence: 0.4 }); m.userData.wear = 1; m.userData.shared = 1; MT.set(k, m); } return m; }
function plain(col, o = {}) { const k = 'p' + col + JSON.stringify(o); let m = MT.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color: col, roughness: o.r ?? 0.5, metalness: o.mt ?? 0, emissive: o.em || '#000000', emissiveIntensity: o.ei ?? 1 }); m.userData.wear = 1; m.userData.shared = 1; MT.set(k, m); } return m; }
const add = (g, m, p, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = false; o.userData.acc = 1; p.add(o); return o; };
const torus = (r, t, s, lo) => geo(`t${r}_${t}_${s}_${lo}`, () => new THREE.TorusGeometry(r, t, lo ? 6 : 10, lo ? Math.max(10, s >> 1) : s));
const ball = (r, lo) => geo(`b${r}_${lo}`, () => new THREE.SphereGeometry(r, lo ? 10 : 18, lo ? 8 : 12));
const facet = (r, lo) => geo(`f${r}_${lo}`, () => new THREE.OctahedronGeometry(r, lo ? 0 : 1)); // cut-gem look
const cylG = (r, h, lo) => geo(`c${r}_${h}_${lo}`, () => new THREE.CylinderGeometry(r, r, h, lo ? 12 : 24));
const shapeG = (k, draw, d = 0.02) => geo('sh' + k, () => { const s = new THREE.Shape(); draw(s); const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }); g.translate(0, 0, -d / 2); return g; });
const star = (r, ri = r * 0.45) => (s) => { for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? ri : r; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } s.closePath(); };
const heart = (k) => (s) => { s.moveTo(0, -0.08 * k); s.bezierCurveTo(0.14 * k, 0.02 * k, 0.06 * k, 0.12 * k, 0, 0.05 * k); s.bezierCurveTo(-0.06 * k, 0.12 * k, -0.14 * k, 0.02 * k, 0, -0.08 * k); };
// twinkle: a tiny additive 4-point flare that pulses (skipped on the low graphics tier)
let GT = null; function glintTex() { if (GT) return GT; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(32, 0); c.lineTo(35, 29); c.lineTo(64, 32); c.lineTo(35, 35); c.lineTo(32, 64); c.lineTo(29, 35); c.lineTo(0, 32); c.lineTo(29, 29); c.fill(); GT = new THREE.CanvasTexture(cv); GT.colorSpace = THREE.SRGBColorSpace; return GT; }
function glint(p, x, y, z, k = 1, C) { if (C.lo) return; const m = new THREE.SpriteMaterial({ map: glintTex(), color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }); m.userData.wear = 1;
  const s = new THREE.Sprite(m); s.position.set(x, y, z); const ph = Math.random() * TAU, base = 0.09 * k; s.scale.setScalar(base); s.userData.acc = 1; s.castShadow = false;
  s.onBeforeRender = () => { const t = performance.now() / 1000; const v = Math.max(0, Math.sin(t * 2.2 + ph)); s.scale.setScalar(base * (0.35 + 0.9 * v * v)); m.rotation = t * 0.6 + ph; }; p.add(s); return s; }
const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.userData.anchor = 1; p.add(g); return g; };
const isGold = (c) => /ffcf3a|ffd34d|d4a020/i.test(c);

// Anchors on every body shape. J.acc = { earL, earR, face, head, neck, wristL, handL, back }
export function accAnchors({ J, H, headR, kind, fit, ears, snout, fz }) {
  const hr = headR || (kind === 'jelly' ? 0.58 : 0.45), A = {}; J.acc = A; A.hr = hr; A.kind = kind;
  if (H) { const gl = ears === 'gills' || ears === 'big' || ears === 'floppy', ey = -hr * (gl ? 0.38 : 0.2), ex = hr * (gl ? 1.0 : 1.1), ez = hr * (gl ? 0.32 : 0.1); // gills/big/floppy ears cover the sides: hang lower + further forward
    A.earL = grp(H, ex, ey, ez); A.earR = grp(H, -ex, ey, ez); A.face = grp(H, 0, 0.06, 0); A.head = grp(H, 0, hr, 0); }
  // 👃 nose anchor per snout type (matches pal3d.js snout meshes) + per body-shape scale; ring hangs from the right nostril
  if (H) { const z = fz || hr * 0.9, sn = snout || 'smile', kS = kind === 'jelly' ? 1.25 : kind === 'cloud' ? 1.1 : kind === 'star' ? 0.95 : 1;
    const NP = { muzzle: [0.032, -0.072, z * 0.95 + 0.115, 1], nose: [0.032, -0.072, z * 0.95 + 0.115, 1], whiskers: [0.032, -0.072, z * 0.95 + 0.115, 1],
      pig: [0.035, -0.118, z + 0.095, 1.05], beak: [0.03, -0.035, z + 0.085, 0.85], duckbill: [0.06, -0.04, z + 0.075, 0.9], trunk: [0.035, -0.095, z * 0.86 + 0.13, 1], capy: [0.035, -0.085, z * 0.9 + 0.12, 1] };
    const [nx, ny, nz, ns] = NP[sn] || [0.025, -0.05, z * 1.03 + 0.01, 0.95];
    A.nose = grp(H, nx, ny, nz); A.noseS = 1.25 * ns * kS * Math.max(0.8, Math.min(1.4, hr / 0.45)); A.nose.scale.setScalar(A.noseS);
    if (sn === 'trunk' && J.trunk && J.trunk.length) { const tb = J.trunk[J.trunk.length - 1]; A.nose.removeFromParent(); A.nose.position.set(0.028, -0.078 - 0.012, 0.03); A.nose.scale.multiplyScalar(0.85); tb.add(A.nose); } }
  // neck ring radius per body shape (blob torso scales with its body width)
  const bw = (fit && fit.bw) || 1; A.neckR = kind === 'jelly' ? 0.47 : kind === 'cloud' ? 0.38 : kind === 'star' ? 0.34 : 0.29 * Math.max(0.9, bw); A.neckY = kind === 'blob' ? -0.06 : kind === 'jelly' ? -0.55 : -0.1;
  if (J.Neck) A.neck = grp(J.Neck, 0, A.neckY, 0);
  if (J.Chest) A.back = grp(J.Chest, 0, 0, -0.42);
  // wrist + hand: paws have a lower arm + paw; wings/flippers get a stub on the upper-arm blade
  const arm = (fit && fit.arm) || 'paw';
  if (arm === 'paw' && J.LeftLowerArm) { A.wristL = grp(J.LeftLowerArm, 0, -0.2, 0); A.wristR0 = (fit.ar || 0.09) * 0.92; A.handL = grp(J.LeftHand, 0, -0.06, 0); A.handR0 = 0.06; A.wristS = [1, 1]; }
  else if (J.LeftUpperArm) { A.wristL = grp(J.LeftUpperArm, 0, -0.36, 0); A.wristR0 = 0.07; A.wristS = [arm === 'wing' ? 0.85 : 0.9, 2.3]; A.handL = grp(J.LeftUpperArm, 0, -0.44, 0.06); A.handR0 = 0.045; }
  return A;
}

// entry point: W(slot) = the regular wardrobe item worn in that slot (or undefined); lg = legacy catalog item getter
export function dressAccessories({ J, W, tier, fz, hat, clothed, legacyNeck }) {
  const A = J.acc; if (!A) return; const lo = tier === 'low', C = { lo }; const hr = A.hr;
  // ---- earrings + headphones (ear area on both sides)
  let w = W('ears'); if (w && A.earL) { const st = w.st, c = w.col;
    if (st === 'phones') { const band = !hat; for (const [s, a] of [[1, A.earL], [-1, A.earR]]) { const cup = add(cylG(0.12, 0.08, lo), plain(c, { r: 0.35 }), a, s * 0.03, 0.04, 0); cup.rotation.z = Math.PI / 2; const pad = add(cylG(0.09, 0.03, lo), plain('#2a2438', { r: 0.8 }), a, -s * 0.015, 0.04, 0); pad.rotation.z = Math.PI / 2;
        const rim = add(torus(0.12, 0.014, 24, lo), metal('#d0d8e8', lo), a, s * 0.07, 0.04, 0); rim.rotation.y = Math.PI / 2; add(ball(0.035, lo), plain(c, { em: c, ei: 0.6 }), a, s * 0.075, 0.04, 0); }
      if (band) { const b = add(geo('hpband' + hr + lo, () => new THREE.TorusGeometry(hr * 1.14, 0.03, lo ? 6 : 10, lo ? 16 : 32, Math.PI)), plain(c, { r: 0.35 }), A.earL.parent, 0, -hr * 0.14, -0.02); b.scale.y = 1.05; } }
    else for (const [s, a] of [[1, A.earL], [-1, A.earR]]) { const m = metal(c, lo);
      if (st === 'hoop') { add(ball(0.022, lo), m, a); const h = add(torus(0.085, 0.017, 28, lo), m, a, s * 0.005, -0.09, 0); h.rotation.y = Math.PI / 2; }
      else if (st === 'drop') { add(ball(0.03, lo), m, a); add(cylG(0.008, 0.05, lo), m, a, 0, -0.04, 0); const d = add(shapeG('drop', star(0.09, 0.04), 0.03), gem(c, lo), a, s * 0.01, -0.11, 0); d.rotation.y = s * Math.PI / 2; glint(a, s * 0.03, -0.1, 0.03, 1.1, C); }
      else { add(ball(0.04, lo), m, a); const g = add(facet(0.062, lo), gem(st === 'stud' && isGold(c) ? '#fff6d8' : c === '#d0d8e8' ? '#e8f4ff' : c, lo), a, s * 0.02, 0, 0); g.scale.set(0.7, 1, 1); glint(a, s * 0.05, 0.02, 0.03, 0.8, C); } } }
  // ---- 👃 nose rings (cartoon clip-on look, hang from the nostril, face the camera)
  w = W('nose'); if (w && A.nose) { const st = w.st, c = w.col, N = w.mini ? grp(A.nose) : A.nose; if (w.mini) N.scale.setScalar(0.55); const m = metal(c, lo); add(ball(0.016, lo), m, N);
    const hoop = (r, t, x = 0, mat = m) => { const h = add(torus(r, t, 28, lo), mat, N, x, -r + 0.006, 0.004); h.rotation.y = 0.35; return h; };
    if (st === 'nhoop') { hoop(0.05, 0.012); add(ball(0.014, lo), m, N, 0, -0.1, 0.01); glint(N, 0.03, -0.02, 0.03, 0.6, C); }
    else if (st === 'ndouble') { hoop(0.042, 0.011); hoop(0.06, 0.011, 0.024); glint(N, 0.04, -0.03, 0.03, 0.6, C); }
    else if (st === 'nstud') { const bz = add(torus(0.036, 0.008, 20, lo), metal(w.mini ? '#d0d8e8' : '#ffffff', lo), N, 0, 0, 0.012); bz.rotation.y = 0; add(facet(0.034, lo), gem(c, lo), N, 0, 0, 0.014).scale.set(1, 1, 0.75); if (!w.mini) add(facet(0.04, lo), plain('#5a1838', { r: 0.6 }), N, 0, 0, 0.006).scale.set(1, 1, 0.3); glint(N, 0.02, 0.02, 0.04, 0.7, C); }
    else if (st === 'nstar') { add(shapeG('nstar', star(0.045, 0.02), 0.014), m, N, 0, 0, 0.012); glint(N, 0.025, 0.025, 0.04, 0.7, C); }
    else if (st === 'nheartstud') { add(shapeG('nheart', heart(0.5), 0.016), gem(c, lo), N, 0, 0, 0.012); glint(N, 0.02, 0.02, 0.03, 0.6, C); }
    else if (st === 'nheart') { hoop(0.04, 0.01); const hh = add(shapeG('nheart', heart(0.5), 0.016), gem('#ff7fb0', lo), N, 0, -0.088, 0.012); hh.scale.setScalar(1); glint(N, 0.02, -0.08, 0.03, 0.6, C); }
    else if (st === 'nchain') { add(ball(0.02, lo), m, N, 0.1, 0.03, -0.02); for (let i = 0; i < (lo ? 5 : 7); i++) { const f = (i + 1) / ((lo ? 5 : 7) + 1), x = 0.1 * f, y = 0.03 * f - Math.sin(f * Math.PI) * 0.06; const l = add(torus(0.013, 0.005, 10, lo), m, N, x, y, -0.01 * f); l.rotation.y = i % 2 ? Math.PI / 2 : 0; } hoop(0.03, 0.009); }
    else if (st === 'nrainbow') { const RB = ['#ff5a5a', '#ff9f3a', '#ffd93a', '#5ccf6a', '#4aa8ff', '#a070ff'], r = 0.052, n = RB.length;
      for (let i = 0; i < n; i++) { const g = geo(`nrb${i}${lo}`, () => new THREE.TorusGeometry(r, 0.013, lo ? 6 : 10, lo ? 4 : 8, TAU / n + 0.02)); const a = add(g, plain(RB[i], { r: 0.3, em: RB[i], ei: 0.25 }), N, 0, -r + 0.006, 0.004); a.rotation.set(0, 0.35, Math.PI / 2 + i * TAU / n); } glint(N, 0.03, -0.03, 0.03, 0.7, C); }
    else if (st === 'ncrystal') { hoop(0.048, 0.011, 0, metal('#d0d8e8', lo)); add(facet(0.03, lo), gem(c, lo), N, 0, -0.1, 0.012).scale.set(0.9, 1.25, 0.8); add(shapeG('ncst', star(0.022, 0.01), 0.01), metal('#ffcf3a', lo), N, 0.0, 0.0, 0.02); glint(N, 0.02, -0.09, 0.04, 1, C); glint(N, -0.01, 0.02, 0.04, 0.6, C); }
    else hoop(0.05, 0.012); }
  // ---- necklaces, chains, pendants, badges (neck slot; scarf/tie/bowtie stay in pal3d.js)
  w = W('neck') || legacyNeck; if (w && A.neck && ['beads', 'chain', 'locket', 'medal', 'pearls', 'bell', 'badge'].includes(w.st)) { const st = w.st, c = w.col, R = A.neckR + (clothed ? 0.035 : 0.01), N = A.neck;
    const along = (n, fn) => { for (let i = 0; i < n; i++) { const a = -Math.PI * 0.92 + i * (Math.PI * 1.84) / (n - 1); const sag = (1 - Math.abs(a) / Math.PI) * 0.07; fn(Math.sin(a) * R, -sag, Math.cos(a) * R * 0.95, a, i); } };
    if (st === 'beads' || st === 'pearls') along(lo ? 12 : 18, (x, y, z, a, i) => add(ball(st === 'pearls' ? 0.036 : 0.04, lo), st === 'pearls' ? gem('#fff8f0', lo) : gem(i % 2 ? '#ffffff' : c, lo), N, x, y, z));
    else if (st === 'chain') along(lo ? 12 : 20, (x, y, z, a, i) => { const l = add(torus(0.042, 0.014, 14, lo), metal(c, lo), N, x, y, z); l.rotation.y = a + (i % 2) * Math.PI / 2; });
    else { const cord = add(geo('cord' + R.toFixed(3) + lo, () => new THREE.TorusGeometry(R, 0.012, 6, lo ? 20 : 36)), st === 'medal' ? plain('#e8434f') : st === 'bell' ? plain('#e8434f') : st === 'badge' ? plain('#2f3d6e') : metal(c, lo), N, 0, -0.03, 0); cord.rotation.x = Math.PI / 2 + 0.28; cord.scale.y = 0.95;
      const py = -0.2, pz = R * 0.95 + 0.06; let p;
      if (st === 'locket') { p = add(shapeG('lockH', heart(1.2), 0.04), metal(c, lo), N, 0, py, pz); add(facet(0.025, lo), gem('#ff6fae', lo), N, 0, py + 0.01, pz + 0.03); glint(N, 0.03, py + 0.03, pz + 0.04, 1, C); }
      else if (st === 'medal') { p = add(cylG(0.085, 0.02, lo), metal(c, lo), N, 0, py, pz); p.rotation.x = Math.PI / 2; add(shapeG('mstar', star(0.055), 0.012), metal(isGold(c) ? '#fff0a8' : '#ffffff', lo), N, 0, py, pz + 0.015); glint(N, 0.04, py + 0.04, pz + 0.03, 1, C); }
      else if (st === 'bell') { p = add(ball(0.07, lo), metal(c, lo), N, 0, py + 0.02, pz); add(ball(0.02, lo), plain('#3a2440'), N, 0, py - 0.035, pz + 0.04); }
      else { p = add(cylG(0.09, 0.025, lo), plain(c, { r: 0.3 }), N, 0, py, pz); p.rotation.x = Math.PI / 2; add(shapeG('bstar', star(0.06), 0.012), plain('#ffffff', { em: '#ffffff', ei: 0.3 }), N, 0, py, pz + 0.018); add(torus(0.09, 0.012, 24, lo), metal('#ffcf3a', lo), N, 0, py, pz + 0.006); } } }
  // ---- bracelets + watches (left wrist so a held item never hides them)
  w = W('wrist'); if (w && A.wristL) { const st = w.st, c = w.col, R = A.wristR0 + (clothed ? 0.04 : 0.02), a = A.wristL, [sx, sz] = A.wristS;
    const g = grp(a); g.scale.set(sx, 1, sz);
    if (st === 'beadband') for (let i = 0; i < (lo ? 8 : 12); i++) { const t = i * TAU / (lo ? 8 : 12); add(ball(0.026, lo), gem(i % 2 ? '#ffffff' : c, lo), g, Math.sin(t) * R, 0, Math.cos(t) * R); }
    else { const b = add(torus(R, st === 'watch' ? 0.024 : 0.02, 28, lo), st === 'watch' ? plain(/8a55dc|9a74d6/.test(c) ? '#3a2458' : '#2a2438', { r: 0.4 }) : metal(c, lo), g); b.rotation.x = Math.PI / 2;
      if (st === 'watch') { const f = add(cylG(0.055, 0.025, lo), metal('#d0d8e8', lo), a, 0, 0, R * sz + 0.01); f.rotation.x = Math.PI / 2; add(cylG(0.045, 0.006, lo), plain(c, { em: c, ei: /8a55dc|9a74d6/.test(c) ? 0.9 : 0.25, r: 0.15 }), a, 0, 0, R * sz + 0.025).rotation.x = Math.PI / 2; }
      else { add(facet(0.03, lo), gem(isGold(c) ? '#fff6d8' : c === '#d0d8e8' ? '#cfe8ff' : '#ff8ab8', lo), a, 0, 0, R * sz + 0.02); glint(a, 0.03, 0.02, R * sz + 0.04, 0.9, C); } } }
  // ---- rings (left paw / wing tip): an oversized band + a big faceted gem facing forward
  w = W('hand'); if (w && A.handL) { const st = w.st, c = w.col, a = A.handL; const band = add(torus(A.handR0 + 0.012, 0.016, 22, lo), metal(st === 'gem' ? '#ffcf3a' : c, lo), a); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 0.9);
    if (st === 'gem') { const big = /ffcf3a/.test(c) && w.p >= 400; const gm = add(facet(big ? 0.07 : 0.06, lo), gem(big ? '#fff2a8' : c, lo), a, 0, 0.01, A.handR0 + 0.05); gm.scale.set(1, 1.15, 0.8); for (const s of [-1, 1]) add(ball(0.012, lo), metal('#ffcf3a', lo), a, s * 0.04, 0.0, A.handR0 + 0.035); glint(a, 0.03, 0.04, A.handR0 + 0.09, big ? 1.4 : 1, C); }
    else { add(cylG(0.03, 0.012, lo), metal(c, lo), a, 0, 0, A.handR0 + 0.025).rotation.x = Math.PI / 2; glint(a, 0.02, 0.02, A.handR0 + 0.04, 0.7, C); } }
}

// 🎒 Backpacks ('bag' slot, so they can be worn together with wings / capes in the 'back' slot).
// The torso of every body shape is approximated by an ellipsoid in Chest space (centre y, radii rx/ry/rz, taken from
// the pal3d.js torso meshes and the blob body scale bw/bh/bd). The pack sits just off the back surface and the two
// shoulder straps are closed tubes that hug that ellipsoid (inflated a little, more when clothed), going over the
// shoulders, down the front and back under the arms, so they never cut into the body. Everything is parented to the
// Chest bone, so it follows walking, dancing, sitting and sleeping.
const BODY = (k, f) => { const bw = (f && f.bw) || 1, bh = (f && f.bh) || 1, bd = (f && f.bd) || 1;
  return k === 'jelly' ? { cy: 0, rx: 0.62, ry: 0.52, rz: 0.58, sy: 0.3 } : k === 'star' ? { cy: 0.05, rx: 0.5, ry: 0.55, rz: 0.32, sy: 0.32 }
    : k === 'cloud' ? { cy: 0.05, rx: 0.62, ry: 0.42, rz: 0.42, sy: 0.3 } : { cy: -0.12 * bh, rx: 0.41 * bw, ry: 0.44 * bh, rz: 0.38 * bd + ((f && f.backX) || 0), sy: 0.28 * bh }; }; // backX: shells / spikes / plates stick out of the back
function strap(B, sx, inf, lo) { const pts = [], n = lo ? 14 : 24, q = Math.sqrt(Math.max(0.2, 1 - (sx / B.rx) ** 2)) * inf;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; // a = 0 at the top of the shoulder, going forward
    let y = Math.cos(a) * B.ry * q, z = Math.sin(a) * B.rz * q; if (y > B.sy) y = B.sy + (y - B.sy) * 0.25; // flatten over the shoulder line
    pts.push(new THREE.Vector3(sx * (1 + 0.12 * Math.max(0, -Math.cos(a))), B.cy + y, z)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), lo ? 28 : 56, 0.022, lo ? 5 : 8, true); }
const rbox = (w, h, d, r, lo) => geo(`rb${w}_${h}_${d}_${lo}`, () => { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: Math.min(0.03, d * 0.3), bevelThickness: Math.min(0.03, d * 0.3), bevelSegments: lo ? 1 : 3, curveSegments: lo ? 3 : 6 }); g.translate(0, 0, -d / 2); return g; });
let KLT = null; function klTex() { if (KLT) return KLT; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d');
  c.fillStyle = '#ffcf3a'; c.beginPath(); c.arc(64, 64, 58, 0, TAU); c.fill(); c.fillStyle = '#5a2a9a'; c.beginPath(); c.arc(64, 64, 50, 0, TAU); c.fill();
  c.fillStyle = '#ffd84a'; c.font = '900 62px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KL', 64, 68); KLT = new THREE.CanvasTexture(cv); KLT.colorSpace = THREE.SRGBColorSpace; return KLT; }
export function dressPack({ J, w, tier, clothed, wings }) {
  if (!J.Chest) return; const lo = tier === 'low', C = { lo }, f = J.fit || {}, B = BODY(f.kind, f), st = w.st, c = w.col;
  const mini = st === 'pk_mini', tall = st === 'pk_hiker', k = mini ? 0.68 : 1;
  const PW = Math.min(0.5, B.rx * 0.95) * k, PH = Math.min(0.56, B.ry * 1.05) * k * (tall ? 1.2 : 1), PD = 0.15 * k;
  const g = new THREE.Group(); g.userData.anchor = 1; J.Chest.add(g); const gap = clothed ? 0.04 : 0.015;
  g.position.set(0, B.cy + B.ry * (mini ? 0.12 : 0.02) + (tall ? 0.04 : 0), -(B.rz + gap + PD / 2)); g.rotation.x = -0.08; if (wings) g.position.z -= 0.02;
  const fz = PD / 2 + 0.012; // front (outer) face of the pack is -z, so put details at z = -fz
  const body = plain(c, { r: 0.55 }), dark = plain(shadeHex(c, -0.25), { r: 0.6 }), lite = plain(shadeHex(c, 0.35), { r: 0.5 });
  const shell = (geom, m = body) => add(geom, m, g);
  const pocket = (yy = -PH * 0.18, ww = PW * 0.72, hh = PH * 0.38, m = lite) => { const p = add(rbox(ww, hh, 0.05, 0.05, lo), m, g, 0, yy, -fz - 0.01); add(cylG(0.006, ww * 0.9, lo), metal('#d0d8e8', lo), g, 0, yy + hh / 2 - 0.012, -fz - 0.04).rotation.z = Math.PI / 2; return p; };
  if (st === 'pk_star') { const s2 = add(shapeG('pkstar' + k, star(PW * 0.62, PW * 0.3), PD), body, g); s2.scale.z = 1; add(shapeG('pkstar2' + k, star(PW * 0.3, PW * 0.14), 0.03), metal('#ffcf3a', lo), g, 0, 0, -fz); glint(g, 0.05, 0.06, -fz - 0.03, 1, C); }
  else if (st === 'pk_heart') { add(shapeG('pkheart' + k, heart(PW * 3.2), PD), body, g, 0, -0.02, 0); add(shapeG('pkheart2', heart(PW * 1.3), 0.03), lite, g, 0, -0.03, -fz); }
  else { shell(rbox(PW, PH, PD, 0.09 * k, lo));
    if (st === 'pk_rainbow') { const RB = ['#ff5a5a', '#ff9f3a', '#ffd93a', '#5ccf6a', '#4aa8ff', '#a070ff']; RB.forEach((col, i) => add(geo('pkrb' + PW + PH + lo, () => new THREE.BoxGeometry(PW * 0.96, PH / 7, 0.02)), plain(col, { r: 0.5 }), g, 0, PH * 0.42 - (i + 0.5) * (PH * 0.84 / 6), -PD / 2 - 0.028)); pocket(-PH * 0.3, PW * 0.5, PH * 0.2, plain('#ffffff', { r: 0.5 })); }
    else if (st === 'pk_kl') { pocket(-PH * 0.22, PW * 0.78, PH * 0.42, plain('#3a1a6a', { r: 0.5 })); const m = new THREE.MeshStandardMaterial({ map: klTex(), roughness: 0.4, metalness: 0.2, transparent: true }); m.userData.wear = 1;
      const d = new THREE.Mesh(geo('kld', () => new THREE.CircleGeometry(0.1, 32)), m); d.position.set(0, -PH * 0.22, -fz - 0.045); d.rotation.y = Math.PI; d.scale.setScalar(PW / 0.42); d.userData.acc = 1; g.add(d);
      for (const s of [-1, 1]) add(cylG(0.012, PH * 0.9, lo), metal('#ffcf3a', lo), g, s * PW * 0.47, 0, -PD / 2 - 0.02); glint(g, 0.06, -PH * 0.1, -fz - 0.07, 1.1, C); }
    else if (st === 'pk_glitter') { pocket(); for (let i = 0; i < (lo ? 10 : 22); i++) { const r = Math.random; add(facet(0.012 + r() * 0.01, lo), gem(i % 3 ? '#ffffff' : shadeHex(c, 0.5), lo), g, (r() - 0.5) * PW * 0.9, (r() - 0.5) * PH * 0.9, -PD / 2 - 0.035); } glint(g, 0.08, 0.1, -fz - 0.04, 1.2, C); glint(g, -0.1, -0.08, -fz - 0.04, 0.9, C); }
    else if (st === 'pk_sports') { pocket(-PH * 0.2, PW * 0.7, PH * 0.34, dark); for (const yy of [PH * 0.18, PH * 0.26]) add(geo('pksp' + PW, () => new THREE.BoxGeometry(PW * 1.0, 0.02, 0.02)), plain('#ffffff', { em: '#ffffff', ei: 0.25 }), g, 0, yy, -PD / 2 - 0.03);
      const bt = add(cylG(0.035, 0.16, lo), plain('#4aa8ff', { r: 0.2 }), g, PW / 2 + 0.035, -PH * 0.15, 0); add(cylG(0.02, 0.03, lo), plain('#ffffff'), bt, 0, 0.09, 0); }
    else if (st === 'pk_hiker') { pocket(-PH * 0.25, PW * 0.6, PH * 0.3, dark); const roll = add(cylG(0.07, PW * 1.05, lo), plain('#c8955f', { r: 0.8 }), g, 0, PH / 2 + 0.06, 0); roll.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) { add(geo('pkhs' + PH, () => new THREE.BoxGeometry(0.03, PH * 0.9, 0.02)), dark, g, s * PW * 0.3, 0, -PD / 2 - 0.035); add(torus(0.075, 0.01, 12, lo), dark, g, s * PW * 0.3, PH / 2 + 0.06, 0).rotation.y = Math.PI / 2; }
      add(torus(0.03, 0.008, 12, lo), metal('#ff8a2a', lo), g, PW / 2 - 0.02, PH * 0.3, -fz - 0.02); }
    else if (st === 'pk_jet') { for (const s of [-1, 1]) { const t = add(cap(0.075 * k, PH * 0.6), metal(c, lo), g, s * PW * 0.32, 0.02, -0.02); const fl = add(cone(0.055, 0.14), plain('#ffb04a', { em: '#ff7a1a', ei: 0.8 }), g, s * PW * 0.32, -PH * 0.5, -0.02); fl.rotation.x = Math.PI;
        const fin = add(shapeG('pkfin', (sh) => { sh.moveTo(0, 0); sh.lineTo(0.09, -0.05); sh.lineTo(0.09, -0.14); sh.lineTo(0, -0.08); sh.closePath(); }, 0.02), plain('#e8434f', { r: 0.4 }), g, s * PW * 0.5, -PH * 0.2, -0.02); fin.rotation.y = s < 0 ? Math.PI : 0; }
      add(cylG(0.04, 0.02, lo), plain('#7ad0ff', { em: '#7ad0ff', ei: 0.6 }), g, 0, PH * 0.15, -fz - 0.005).rotation.x = Math.PI / 2; }
    else { pocket(); if (st === 'pk_bunny') { for (const s of [-1, 1]) { const e = add(cap(0.05 * k, 0.2 * k), body, g, s * PW * 0.26, PH / 2 + 0.1 * k, 0); e.rotation.z = -s * 0.2; e.scale.z = 0.5; const in2 = add(cap(0.028 * k, 0.14 * k), plain('#ffc6dc'), g, s * PW * 0.26, PH / 2 + 0.1 * k, -0.025); in2.rotation.z = -s * 0.2; in2.scale.z = 0.4; } add(ball(0.05, lo), plain('#ffffff'), g, 0, -PH * 0.42, -fz - 0.02); }
      if (st === 'pk_dino') for (let i = 0; i < 5; i++) { const sp = add(cone(0.05 * k, 0.1 * k), plain(shadeHex(c, -0.3), { r: 0.5 }), g, 0, PH / 2 - 0.02 - i * PH * 0.22, PD / 2 - 0.01); sp.rotation.x = -Math.PI / 2 - 0.5; sp.scale.x = 0.5; sp.position.z = -PD / 2 - 0.03; sp.position.x = 0; if (i) { sp.position.x = 0; } }
      if (st === 'pk_dino') for (let i = 0; i < 3; i++) { const sp = add(cone(0.05 * k, 0.12 * k), plain(shadeHex(c, -0.3), { r: 0.5 }), g, (i - 1) * PW * 0.3, PH / 2 + 0.04 * k, 0); sp.scale.z = 0.5; }
      if (st === 'pk_school' || st === 'pk_mini') add(torus(0.05 * k, 0.012, 14, lo), dark, g, 0, PH / 2 + 0.01, 0); } }
  // shoulder straps (+ a chest clip across the front on the bigger packs)
  const inf = 1.06 + (clothed ? 0.06 : 0), sx = Math.min(B.rx * 0.45, 0.2) * (mini ? 0.85 : 1), sm = st === 'pk_kl' ? metal('#ffcf3a', lo) : dark;
  for (const s of [-1, 1]) add(geo(`pkstr${f.kind}${B.rx}${B.ry}${B.rz}${s}${inf}${sx}${lo}`, () => strap(B, s * sx, inf, lo)), sm, J.Chest);
  if (!mini && (f.kind || 'blob') === 'blob') { const q = Math.sqrt(Math.max(0.2, 1 - (sx / B.rx) ** 2)) * inf, zf = B.rz * q * 0.92 + 0.01;
    add(geo('pkclip' + sx, () => new THREE.BoxGeometry(sx * 2, 0.025, 0.018)), sm, J.Chest, 0, B.cy + B.ry * 0.42, zf); }
}
function shadeHex(hex, k) { const col = new THREE.Color(hex); const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k * (k > 0 ? 1 - hsl.l : hsl.l)))); return '#' + col.getHexString(); }
const cap = (r, h) => geo(`cap${r}_${h}`, () => new THREE.CapsuleGeometry(r, h, 4, 10));
const cone = (r, h) => geo(`cone${r}_${h}`, () => new THREE.ConeGeometry(r, h, 12));
