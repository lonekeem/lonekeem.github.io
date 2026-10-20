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
export function accAnchors({ J, H, headR, kind, fit, ears }) {
  const hr = headR || (kind === 'jelly' ? 0.58 : 0.45), A = {}; J.acc = A; A.hr = hr; A.kind = kind;
  if (H) { const gl = ears === 'gills' || ears === 'big' || ears === 'floppy', ey = -hr * (gl ? 0.38 : 0.2), ex = hr * (gl ? 1.0 : 1.1), ez = hr * (gl ? 0.32 : 0.1); // gills/big/floppy ears cover the sides: hang lower + further forward
    A.earL = grp(H, ex, ey, ez); A.earR = grp(H, -ex, ey, ez); A.face = grp(H, 0, 0.06, 0); A.head = grp(H, 0, hr, 0); }
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
