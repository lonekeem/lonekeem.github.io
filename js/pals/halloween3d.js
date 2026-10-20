// 🎃 Halloween costumes in 3D (see js/pals/halloween.js for the list + prices). Original designs, kid-safe:
// funny-spooky, no gore (slime green / purple instead), every prop is a soft foam / rubber / glow toy.
// Built from code on the shared Pal rig: torso shells follow the SAME body profile as cloth3d.js (rAt) inside the
// body-type group, sleeves / legs ride the arm and leg bones (they bend with dances), masks are real sphere-patch
// geometry with cut eye holes fitted to the head ellipsoid, and props sit in the right paw. Graphics tiers: 'low'
// uses fewer segments and skips small extras; 'ultra' adds more detail. Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { rAt, fabric, shadeHex } from './cloth3d.js';

const TAU = Math.PI * 2;
const G = {}; const geo = (k, f) => G[k] || (G[k] = f());
const MT = new Map();
function pm(col, o = {}) {
  const key = col + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (MT.has(key)) return MT.get(key);
  const c = new THREE.Color(col);
  const m = new THREE.MeshPhysicalMaterial({ color: o.map ? 0xffffff : c, map: o.map || null, roughness: o.r ?? 0.6, metalness: o.metal ? 0.75 : 0, clearcoat: o.cc ?? 0, clearcoatRoughness: 0.25,
    sheen: o.sheen ?? 0, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.4), emissive: new THREE.Color(o.em || '#000000'), emissiveIntensity: o.ei ?? 1, emissiveMap: o.emap || null,
    transparent: o.op != null, opacity: o.op ?? 1, depthWrite: o.op == null || o.op > 0.9, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, bumpMap: o.bump || null, bumpScale: o.bs ?? 1 });
  m.userData.wear = 1; MT.set(key, m); return m;
}
const glow = (col, k = 1) => pm(col, { em: col, ei: k, r: 0.4 });
const foam = (col) => pm(col, { r: 0.95, sheen: 0.6, bump: noiseTex(), bs: 0.6 });
const rubber = (col) => pm(col, { r: 0.45, cc: 0.6 });
const slime = (col = '#8cff5a') => pm(col, { r: 0.15, cc: 1, em: col, ei: 0.25 });
const TX = {};
function tex(key, draw, rep = [1, 1], color = true, n = 256) {
  if (TX[key]) return TX[key]; const cv = document.createElement('canvas'); cv.width = cv.height = n; const c = cv.getContext('2d'); draw(c, n);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (TX[key] = t);
}
function noiseTex() { return tex('noise', (c, n) => { const d = c.createImageData(n, n); for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 40; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }, [6, 6], false, 128); }
const T = {
  bones: (bg, bone) => tex('bones' + bg + bone, (c, n) => { c.fillStyle = bg; c.fillRect(0, 0, n, n); c.fillStyle = bone; c.strokeStyle = bone; c.lineCap = 'round';
    const x = n / 2; for (let i = 0; i < 6; i++) { c.beginPath(); c.roundRect(x - 7, n * 0.12 + i * 22, 14, 15, 5); c.fill(); }
    c.lineWidth = 9; for (let i = 0; i < 4; i++) { const y = n * 0.2 + i * 24; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(x + s * 8, y); c.quadraticCurveTo(x + s * 46, y - 6, x + s * 58, y + 12); c.stroke(); } }
    c.beginPath(); c.ellipse(x - 16, n * 0.84, 18, 12, 0.3, 0, TAU); c.ellipse(x + 16, n * 0.84, 18, 12, -0.3, 0, TAU); c.fill(); }),
  chevron: (a, b) => tex('chev' + a + b, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); c.fillStyle = b; for (let y = 0; y < n; y += 64) { c.beginPath(); for (let x = 0; x <= n; x += 32) c.lineTo(x, y + ((x / 32) % 2 ? 0 : 22)); for (let x = n; x >= 0; x -= 32) c.lineTo(x, y + 26 + ((x / 32) % 2 ? 0 : 22)); c.fill(); } }, [3, 2]),
  plaid: (a, b, l) => tex('plaid' + a + b, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); c.globalAlpha = 0.55; c.fillStyle = b; for (let i = 0; i < n; i += 64) { c.fillRect(i, 0, 26, n); c.fillRect(0, i, n, 26); } c.globalAlpha = 1; c.fillStyle = l; for (let i = 40; i < n; i += 64) { c.fillRect(i, 0, 3, n); c.fillRect(0, i, n, 3); } }, [3, 2]),
  dots: (a, b) => tex('dots' + a + b, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); c.fillStyle = b; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.beginPath(); c.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 6, 0, TAU); c.fill(); } }, [3, 2]),
  cord: (a) => tex('cord' + a, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); for (let x = 0; x < n; x += 8) { const g = c.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, shadeHex(a, -0.18)); g.addColorStop(0.5, shadeHex(a, 0.12)); g.addColorStop(1, shadeHex(a, -0.18)); c.fillStyle = g; c.fillRect(x, 0, 8, n); } }, [4, 2]),
  gauze: (a) => tex('gauze' + a, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); c.strokeStyle = shadeHex(a, -0.12); c.lineWidth = 2; for (let y = 4; y < n; y += 10) { c.beginPath(); c.moveTo(0, y); for (let x = 0; x <= n; x += 16) c.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.5); c.stroke(); } for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(120,100,70,.06)'; c.fillRect(Math.random() * n, Math.random() * n, 6, 2); } }, [2, 2]),
  moss: (a) => tex('moss' + a, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() > 0.5 ? shadeHex(a, 0.25) : shadeHex(a, -0.3); c.beginPath(); c.arc(Math.random() * n, Math.random() * n, 1 + Math.random() * 4, 0, TAU); c.fill(); } }, [3, 3]),
  stars: (bg, fg, key = '') => tex('stars' + bg + fg + key, (c, n) => { c.fillStyle = bg; c.fillRect(0, 0, n, n); c.fillStyle = fg; const st = (x, y, r) => { c.beginPath(); for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr); } c.fill(); };
    for (let k = 0; k < 9; k++) st((k * 89) % n + 12, (k * 53) % n + 12, 7 + (k % 3) * 3); for (let k = 0; k < 4; k++) { const x = (k * 71 + 40) % n, y = (k * 113 + 30) % n; c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill(); c.fillStyle = bg; c.beginPath(); c.arc(x + 6, y - 3, 11, 0, TAU); c.fill(); c.fillStyle = fg; } }, [3, 2]),
  ribs: (a) => tex('pribs' + a, (c, n) => { for (let x = 0; x < n; x++) { const k = 0.75 + 0.25 * Math.cos((x / n) * TAU * 8); c.fillStyle = shadeHex(a, (k - 1) * 0.9); c.fillRect(x, 0, 1, n); } }, [1, 1]),
  straw: () => tex('straw', (c, n) => { c.fillStyle = '#e6c46a'; c.fillRect(0, 0, n, n); for (let i = 0; i < 500; i++) { c.strokeStyle = Math.random() > 0.5 ? '#c8a040' : '#f6dc8a'; c.lineWidth = 1.5; const x = Math.random() * n, y = Math.random() * n; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y + (Math.random() - 0.5) * 3); c.stroke(); } }, [4, 2]),
};
function tube(key, rf, y0, y1, o = {}) {
  return geo(key, () => { const rows = o.rows || 24, segs = o.segs || 48, pos = [], uv = [], idx = [];
    for (let i = 0; i <= rows; i++) { const t = i / rows; for (let j = 0; j <= segs; j++) { const a = -Math.PI + TAU * j / segs; let y = y0 + (y1 - y0) * t; if (o.jag) y += o.jag(a) * Math.pow(1 - t, 3); const r = rf(y, a, t); pos.push(r * Math.sin(a), y, r * Math.cos(a)); uv.push(j / segs, t); } }
    for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; });
}
const ring = (r, t, arc = TAU, s = 48) => geo(`r${r.toFixed(3)}_${t}_${arc.toFixed(2)}_${s}`, () => new THREE.TorusGeometry(r, t, 10, s, arc));
const ball = (r, s = 20) => geo(`b${r}_${s}`, () => new THREE.SphereGeometry(r, s, Math.max(8, s * 0.6 | 0)));
const cyl = (r0, r1, h, s = 28, open = true) => geo(`cy${r0.toFixed(3)}_${r1.toFixed(3)}_${h.toFixed(3)}_${s}_${open}`, () => new THREE.CylinderGeometry(r0, r1, h, s, 4, open));
const cone = (r, h, s = 20) => geo(`co${r}_${h}_${s}`, () => new THREE.ConeGeometry(r, h, s));
const capsule = (r, l, s = 16) => geo(`ca${r}_${l}_${s}`, () => new THREE.CapsuleGeometry(r, l, 6, s));
const box = (x, y, z) => geo(`bx${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z));
function add(g, m, p, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.castShadow = true; o.position.set(x, y, z); p.add(o); return o; }
function taper(key, pts, r0, r1, seg = 16, rad = 10) {
  return geo('tp' + key + seg, () => { const cv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); const g = new THREE.TubeGeometry(cv, seg, 1, rad, false); const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i <= seg; i++) { const c0 = cv.getPointAt(i / seg), r = r0 + (r1 - r0) * i / seg; for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; p.setXYZ(k, c0.x + n.getX(k) * r, c0.y + n.getY(k) * r, c0.z + n.getZ(k) * r); } }
    g.computeVertexNormals(); const tip = new THREE.SphereGeometry(Math.max(r1, 0.004), 10, 8); tip.translate(...pts[pts.length - 1]); const c0 = new THREE.SphereGeometry(r0, 10, 8); c0.translate(...pts[0]); return mergeG([g, tip, c0]); });
}
function mergeG(list) {
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off); off += p.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const extrude = (key, draw, depth = 0.02, bev = 0.008) => geo('ex' + key, () => { const sh = new THREE.Shape(); draw(sh); const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 3, curveSegments: 10 }); g.translate(0, 0, -depth / 2); return g; });
const starShape = (r, ri = r * 0.45) => (sh) => { for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } sh.closePath(); };
const moonShape = (r) => (sh) => { sh.absarc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75, false); sh.absarc(r * 0.45, 0, r * 0.8, Math.PI * 1.6, Math.PI * 0.4, true); };

// entry point (pal3d.js wear3D): X(slot) = the Halloween item worn in that slot; taken(slot) = a regular item is there
export function dressHalloween({ J, H, headR, fz, legs, kind, X, taken, tier }) {
  const lo = tier === 'low', hi = tier === 'ultra', S = lo ? 28 : hi ? 64 : 44;
  const fit = J.fit || {}, blob = fit.kind === 'blob' && !!J.TB;
  const hr = headR || 0.5; const HG = new THREE.Group(); if (H) { HG.position.y = headR ? 0 : 0.14; H.add(HG); }
  const C = { J, H: H ? HG : null, hr, fz: fz || hr * 0.9, legs, kind, lo, hi, S, fit, blob };
  const full = X('full'), used = new Set();
  const claim = (s) => { if (taken(s) || X(s) || used.has(s)) return false; used.add(s); return true; };
  if (full) { const f = FULL[full.st]; if (f) { try { f(C, full.col, claim); } catch (e) { console.warn('hw', full.st, e); } } if (J.TB) J.TB.traverse((o) => { if (o.userData.deco) o.visible = false; }); }
  for (const s of ['head', 'face', 'back', 'held']) { const it = X(s); if (!it) continue; const f = PART[it.st]; if (f) { try { f(C, it.col); } catch (e) { console.warn('hw', it.st, e); } } }
}
const sq = (o) => { o.scale.z = 0.88; return o; };
function shell(C, m, o = {}) {
  const { J, S } = C; const off = o.off ?? 0.03, y0 = o.y0 ?? -0.14, y1 = o.y1 ?? 0.59;
  if (!C.blob) { const b = add(ball(1, S), m, J.Spine || J.Chest, 0, 0.12, 0.02); b.scale.set(0.5, 0.4, 0.44); return b; }
  const fy = o.fy ?? 0, k = `sh${off}_${y0}_${y1}_${o.rib || 0}_${o.flare || 0}_${fy}_${o.jk || ''}_${S}`;
  const g = tube(k, (y, a) => { let r = rAt(Math.max(-0.22, y)) + off; if (o.rib) r *= 1 + o.rib * Math.pow(Math.abs(Math.cos(a * 4)), 0.6) - o.rib * 0.5; if (o.flare && y < fy) r += o.flare * Math.pow((fy - y) / (fy - y0), 1.3); return r; }, y0, y1, { segs: S, rows: C.lo ? 14 : 26, jag: o.jag });
  return sq(add(g, m, J.TB));
}
function bandAt(C, y, off, t, m, p) { const r = rAt(y) + off; const o = add(ring(r, t, TAU, C.S), m, p || C.J.TB, 0, y, 0); o.rotation.x = Math.PI / 2; o.scale.set(1, 0.88, 1); return o; }
const onFront = (C, y, off = 0.04) => (rAt(y) + off) * 0.88;
function sleeves(C, m, o = {}) {
  const { J, fit } = C; if (!fit.ar) return; const ar = fit.ar, ua = fit.ua, la = fit.la, off = o.off ?? 0.026, len = o.len ?? 1;
  for (const n of ['Left', 'Right']) { const U = J[n + 'UpperArm'], L = J[n + 'LowerArm']; if (!U) continue;
    add(ball(ar * 1.12 + off, 20), m, U); const ul = len < 1 ? ua * 0.6 : ua; add(cyl(ar + off, ar * 0.97 + off, ul, 24), m, U, 0, -ul / 2, 0);
    if (len < 1) { if (o.cuff) { const h = add(ring(ar * 0.97 + off, 0.014, TAU, 24), o.cuff, U, 0, -ul, 0); h.rotation.x = Math.PI / 2; } if (o.tuft) o.tuft(U, -ul, ar + off); continue; }
    if (!L) continue; add(ball(ar * 0.98 + off, 20), m, L); const ll = la * 0.82, b = o.bell || 0; add(cyl(ar * 0.95 + off, ar * 0.9 + off + b, ll, 24), m, L, 0, -ll / 2, 0);
    if (o.cuff) { const c = add(ring(ar * 0.9 + off + b + 0.004, o.cuffT || 0.016, TAU, 24), o.cuff, L, 0, -ll, 0); c.rotation.x = Math.PI / 2; }
    if (o.tuft) o.tuft(L, -ll, ar * 0.9 + off + b); }
}
function pants(C, m, o = {}) {
  const { J, fit } = C; if (!J.TBh || !C.blob) return; sq(add(tube('hwseat' + C.S, (y) => rAt(Math.max(y, -0.19)) + 0.03, -0.2, -0.02, { segs: C.S, rows: 8 }), m, J.TBh));
  const cr = add(ball(1, 20), m, J.TBh, 0, -0.19, 0); cr.scale.set(0.27, 0.07, 0.22); if (!fit.legs) return;
  for (const n of ['Left', 'Right']) { const U = J[n + 'UpperLeg'], L = J[n + 'LowerLeg']; if (!U) continue; const lr = fit.lr, ul = fit.ul, ll = fit.ll, off = 0.026;
    const u = (o.len ?? 1) < 1 ? ul * 0.62 : ul; add(cyl(lr + off + 0.01, lr * 0.93 + off, u, 24), m, U, 0, -u / 2, 0); add(ball(lr * 1.15 + off * 0.6, 20), m, U);
    if ((o.len ?? 1) < 1) { if (o.tuft) o.tuft(U, -u, lr * 0.93 + off); continue; }
    if (!L) continue; add(ball(lr * 0.95 + off, 20), m, L); const l = ll * 0.86, fl = o.flare || 0; add(cyl(lr * 0.9 + off, lr * 0.88 + off + fl, l, 24), m, L, 0, -l / 2, 0);
    if (o.cuff) { const c = add(ring(lr * 0.88 + off + fl, 0.018, TAU, 24), o.cuff, L, 0, -l, 0); c.rotation.x = Math.PI / 2; } if (o.tuft) o.tuft(L, -l, lr * 0.88 + off + fl); }
}
function cape(C, m, lin, o = {}) {
  const { J } = C; if (!J.Chest) return null; const w = o.w ?? 0.8, h = o.h ?? 0.95, k = `cape${w}_${h}_${C.lo}`;
  const g = geo(k, () => { const g = new THREE.PlaneGeometry(w, h, C.lo ? 8 : 16, C.lo ? 10 : 20); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = h / 2 - y; p.setZ(i, -Math.abs(x) * 0.32 - Math.sin(x * 14) * 0.02 * d); p.setX(i, x * (0.62 + d * 0.5)); } g.computeVertexNormals(); return g; });
  const cp = add(g, m, J.Chest, 0, 0.36 - h / 2 - 0.05, -0.44); cp.rotation.x = 0.14; if (lin) { const l = add(g, lin, J.Chest, 0, 0.36 - h / 2 - 0.05, -0.43); l.rotation.x = 0.14; l.scale.set(0.97, 0.99, 1); }
  if (o.collar) for (const s of [-1, 1]) { const c = add(geo('collar', () => { const g = new THREE.PlaneGeometry(0.36, 0.34, 6, 6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.pow(x + 0.18, 2) * 0.9 + (y + 0.17) * 0.25); p.setX(i, x * (1 + (y + 0.17) * 1.2)); } g.computeVertexNormals(); return g; }), o.collar, J.Chest, s * 0.2, 0.52, -0.2); c.rotation.y = s * 0.75; c.scale.x = s; }
  const cl = add(ring(0.26, 0.02, Math.PI, 24), lin || m, J.Chest, 0, 0.14, -0.05); cl.rotation.set(Math.PI / 2 + 0.2, 0, Math.PI); return cp;
}
function heldGroup(C, rot = true) { const hand = C.J.RightHand; if (!hand) return null; const g = new THREE.Group(); g.position.set(0, -0.12, 0.08); g.scale.setScalar(1.6); if (rot) g.rotation.x = -1.1; hand.add(g); C.J.grip = C.J.grip || 'hw'; return g; }
const hp = (C, lon, lat, k = 1.06) => new THREE.Vector3(Math.sin(lon) * Math.cos(lat) * C.hr * 1.08 * k, Math.sin(lat) * C.hr * k, Math.cos(lon) * Math.cos(lat) * C.hr * 0.98 * k);
const eyeDir = (C, s) => new THREE.Vector3(s * 0.19 / (C.hr * 1.08), 0.06 / C.hr, Math.sqrt(Math.max(0.05, 1 - (0.19 / (C.hr * 1.08)) ** 2 - (0.06 / C.hr) ** 2))).normalize();
function mask(C, m, o = {}) {
  const k = o.k ?? 1.07, key = `mask${o.id}_${k}_${C.hr}_${C.lo}`;
  const g = geo(key, () => { const nl = C.lo ? 22 : 40, nt = C.lo ? 16 : 30, pos = [], uv = [], keep = [], idx = []; const E = [eyeDir(C, -1), eyeDir(C, 1)];
    for (let i = 0; i <= nt; i++) for (let j = 0; j <= nl; j++) { const lat = o.lat0 + (o.lat1 - o.lat0) * i / nt, lon = -o.lon + 2 * o.lon * j / nl; const d = new THREE.Vector3(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat));
      const inHole = o.hole && E.some((e) => d.angleTo(e) < o.hole); keep.push(!inHole && (!o.keep || o.keep(lon, lat)));
      pos.push(d.x * C.hr * 1.08 * k, d.y * C.hr * k, d.z * C.hr * 0.98 * k); uv.push(j / nl, i / nt); }
    for (let i = 0; i < nt; i++) for (let j = 0; j < nl; j++) { const a = i * (nl + 1) + j, b = a + nl + 1; if (keep[a] && keep[a + 1] && keep[b]) idx.push(a, b, a + 1); if (keep[a + 1] && keep[b + 1] && keep[b]) idx.push(a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; });
  let mm = m; if (m.side !== THREE.DoubleSide) { mm = m.clone(); mm.side = THREE.DoubleSide; mm.userData.wear = 1; }
  const o2 = add(g, mm, C.H); if (o.hole && !C.lo) for (const s of [-1, 1]) { const e = eyeDir(C, s); const p = e.clone().multiply(new THREE.Vector3(C.hr * 1.08 * k, C.hr * k, C.hr * 0.98 * k)); const r = add(ring(Math.sin(o.hole) * C.hr * k, 0.012, TAU, 24), o.rim || pm('#1a1428', { r: 0.5 }), C.H); r.position.copy(p.multiplyScalar(Math.cos(o.hole))); r.lookAt(r.position.clone().multiplyScalar(2)); }
  return o2;
}
function dome(C, m, k = 1.06, theta = Math.PI * 0.5, lift = 0) { const g = add(geo(`hd${theta.toFixed(2)}_${C.S}`, () => new THREE.SphereGeometry(1, C.S, C.lo ? 12 : 22, 0, TAU, 0, theta)), m, C.H, 0, lift, 0); g.scale.set(C.hr * 1.08 * k, C.hr * k, C.hr * 0.98 * k); return g; }
const at = (C, obj, lon, lat, k = 1.06) => { obj.position.copy(hp(C, lon, lat, k)); return obj; };
const facing = (obj) => { obj.lookAt(obj.position.clone().multiplyScalar(2)); return obj; };
const cap0 = () => capsule(0.012, 0.16, 8);

// ---------------------------------------------------------------- FULL costumes (body + matching set pieces)
const FULL = {
  hw_boo(C, col, claim) { // a friendly bedsheet ghost: flowing hem, floppy sleeves, hood with big oval eyes
    const m = pm(col, { sheen: 1, r: 0.8, ds: true, bump: noiseTex(), bs: 0.3 });
    shell(C, m, { off: 0.07, y0: -0.5, y1: 0.62, flare: 0.3, fy: 0.25, jag: (a) => Math.sin(a * 7) * 0.05 - 0.02, jk: 'boo' });
    sleeves(C, m, { off: 0.04, bell: 0.07, tuft: (L, y, r) => { const t = add(cone(r * 1.05, 0.08, 14), m, L, 0, y - 0.03, 0); t.rotation.x = Math.PI; } });
    if (claim('head') && C.H) { dome(C, m, 1.12, Math.PI * 0.64, -0.02);
      for (const s of [-1, 1]) { const e = facing(at(C, add(ball(1, 16), pm('#1a1428', { r: 0.3, cc: 1 }), C.H), s * 0.28, 0.12, 1.13)); e.scale.set(0.06, 0.09, 0.02); }
      const mo = facing(at(C, add(ball(1, 14), pm('#1a1428', { r: 0.4 }), C.H), 0, -0.28, 1.12)); mo.scale.set(0.045, 0.055, 0.02);
      if (!C.lo) for (const s of [-1, 1]) { const b = facing(at(C, add(ball(1, 12), pm('#ffb3d0', { op: 0.7 }), C.H), s * 0.5, -0.12, 1.12)); b.scale.set(0.05, 0.03, 0.01); } } },
  hw_skelly(C, col, claim) { skeleton(C, col, '#f4f0e6', false, claim); },
  hw_glowskel(C, col, claim) { skeleton(C, col, '#b8ffe0', true, claim); },
  hw_stitchdoll(C, col, claim) { // mustard corduroy overalls with patches + X-stitches, mint dotted shirt, red yarn hair, button cheeks
    const shirt = pm('#ffffff', { map: T.dots('#9fe0c8', '#ffffff'), sheen: 0.6, r: 0.8 }); const ov = pm('#ffffff', { map: T.cord(col), r: 0.85, sheen: 0.4 });
    shell(C, shirt, { y0: -0.06, y1: 0.585 }); sleeves(C, shirt, { len: 0.5, cuff: pm('#ffffff', { r: 0.7 }) });
    pants(C, ov, { cuff: pm(shadeHex(col, -0.2), { r: 0.8 }) });
    if (C.blob) { sq(add(tube('dollbib' + C.S, (y) => rAt(y) + 0.045, -0.12, 0.34, { segs: C.S, rows: 10 }), ov, C.J.TB)).scale.x = 0.62; shell(C, ov, { off: 0.045, y0: -0.13, y1: 0.06 });
      for (const s of [-1, 1]) { const st = add(capsule(0.024, 0.26, 10), ov, C.J.TB, s * 0.16, 0.46, onFront(C, 0.46, 0.0)); st.rotation.x = -0.35; const b = add(geo('dbtn', () => new THREE.CylinderGeometry(0.035, 0.035, 0.015, 18)), pm('#e8434f', { cc: 1, r: 0.3 }), C.J.TB, s * 0.15, 0.32, onFront(C, 0.32, 0.05)); b.rotation.x = Math.PI / 2; }
      for (const [x, y, c] of [[-0.18, 0.05, '#c9a0ff'], [0.2, -0.03, '#ff9ccf']]) { const p = add(box(0.11, 0.1, 0.012), pm(c, { r: 0.85, sheen: 0.5 }), C.J.TB, x, y, onFront(C, y, 0.05) - Math.abs(x) * 0.25); p.rotation.y = x * 1.6;
        for (const r of [0.7, -0.7]) { const sx = add(box(0.1, 0.012, 0.006), pm('#3a2a63'), p, 0, 0, 0.01); sx.rotation.z = r; } } }
    if (claim('head') && C.H) { const yarn = pm('#e8434f', { r: 0.9, sheen: 1, bump: noiseTex(), bs: 1.2 }); const n = C.lo ? 14 : 30;
      for (let i = 0; i < n; i++) { const lon = Math.PI + (i / n - 0.5) * TAU * 0.8; const lat = 0.35 + (i % 3) * 0.2; facing(at(C, add(ring(0.045, 0.017, TAU, 12), yarn, C.H), lon, lat, 1.02)).rotateY(Math.PI / 2); }
      for (let i = 0; i < (C.lo ? 5 : 9); i++) facing(at(C, add(ring(0.04, 0.017, TAU, 12), yarn, C.H), -0.6 + i * 0.15, 0.95, 1.02)).rotateX(0.6);
      for (const s of [-1, 1]) { const g = new THREE.Group(); at(C, g, s * 1.5, 0.15, 1.04); C.H.add(g); for (let i = 0; i < 4; i++) add(ball(0.05, 12), yarn, g, s * 0.025 * i, -0.04 - i * 0.06, -0.01); const bw = add(ball(1, 12), pm('#9fe0c8', { r: 0.6 }), g, 0, 0.03, 0); bw.scale.set(0.08, 0.04, 0.03); }
      for (const s of [-1, 1]) { const b = facing(at(C, add(geo('cheekbtn', () => new THREE.CylinderGeometry(0.045, 0.045, 0.014, 20)), pm('#ff9ccf', { cc: 1, r: 0.3 }), C.H), s * 0.5, -0.22, 1.03)); b.rotateX(Math.PI / 2);
        if (!C.lo) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(ball(0.007, 6), pm('#7a3a5a'), b, dx * 0.012, 0.008, dy * 0.012); } } },
  hw_dreamfiend(C, col, claim) { // ragged plum + lime chevron sweater, sooty smudges, squashy slate hat, orange foam claw mitt
    const sw = pm('#ffffff', { map: T.chevron(col, '#b8e05a'), r: 0.9, sheen: 0.7, bump: noiseTex(), bs: 0.8 });
    shell(C, sw, { y0: -0.16, y1: 0.59, jag: (a) => -Math.abs(Math.sin(a * 5)) * 0.05, jk: 'df' });
    sleeves(C, sw, { tuft: (L, y, r) => { const n = C.lo ? 4 : 8; for (let i = 0; i < n; i++) { const a = i * TAU / n; const t = add(cone(0.02, 0.05, 6), sw, L, Math.sin(a) * r, y - 0.015, Math.cos(a) * r); t.rotation.x = Math.PI; } } });
    pants(C, pm('#5a4a3a', { r: 0.9, sheen: 0.4 }), { cuff: pm('#3a2e24') });
    if (C.blob && !C.lo) for (const [x, y] of [[-0.2, 0.1], [0.15, 0.3], [0.05, -0.05]]) { const s = add(ball(1, 12), pm('#4a4048', { r: 1, op: 0.55 }), C.J.TB, x, y, onFront(C, y, 0.035) - Math.abs(x) * 0.3); s.scale.set(0.06, 0.045, 0.01); s.rotation.y = x * 1.5; }
    if (claim('head') && C.H) { const hm = pm('#5a6070', { r: 0.85, sheen: 0.6, bump: noiseTex(), bs: 0.5, ds: true }); const y0 = C.hr * 0.62, rr = C.hr * 1.08 * Math.sqrt(1 - 0.62 ** 2) + 0.03;
      const crown = add(geo('dfcrown' + C.S, () => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector2(1 - t * t * 0.55 + Math.sin(t * 9) * 0.03, t * 0.75)); } pts.push(new THREE.Vector2(0, 0.8)); return new THREE.LatheGeometry(pts, C.S); }), hm, C.H, 0, y0, 0); crown.scale.set(rr, C.hr * 0.5, rr * 0.95); crown.rotation.set(-0.08, 0, 0.16);
      const brim = add(geo('dfbrim' + C.S, () => new THREE.CylinderGeometry(1, 1.45, 0.03, C.S, 1, true)), hm, C.H, 0, y0 + 0.01, 0); brim.scale.set(rr, 1, rr * 0.95); brim.rotation.z = 0.16;
      const bd = add(ring(rr, 0.022, TAU, C.S), pm('#b8e05a', { r: 0.6 }), C.H, 0, y0 + 0.05, 0); bd.rotation.set(Math.PI / 2, 0.16, 0); }
    if (claim('held')) PART.hw_rubberclaws(C, '#ff8a2a'); },
  hw_campghoul(C, col, claim) { // camp jacket (zip, knit trims, tent patch) + khakis + generic white sports mask
    const jk = fabric(col, { w: 'twill', bs: 0.6 }); shell(C, jk, { y0: -0.15, y1: 0.585 }); sleeves(C, jk, { cuff: fabric(shadeHex(col, -0.2), { w: 'knit' }), cuffT: 0.022 });
    if (C.blob) { bandAt(C, -0.14, 0.034, 0.024, fabric(shadeHex(col, -0.2), { w: 'knit' })); bandAt(C, 0.585, 0.028, 0.03, fabric('#f4ece0', { w: 'knit' }));
      add(box(0.014, 0.7, 0.01), pm('#d0d4dc', { metal: 1 }), C.J.TB, 0, 0.21, onFront(C, 0.21, 0.04));
      const pt = add(geo('patch', () => new THREE.CircleGeometry(0.06, 24)), pm('#f6e3a1', { r: 0.8 }), C.J.TB, 0.17, 0.32, onFront(C, 0.32, 0.045)); pt.rotation.y = 0.35;
      add(extrude('tent', (s) => { s.moveTo(-0.04, -0.03); s.lineTo(0, 0.035); s.lineTo(0.04, -0.03); s.closePath(); }, 0.006, 0.002), pm('#3f6b52'), pt, 0, 0, 0.005); }
    pants(C, fabric('#c8b080', { w: 'twill' }), { cuff: fabric('#a89060', { w: 'twill' }) });
    if (claim('face') && C.H) PART.hw_sportsmask(C, '#f7f5ef'); },
  hw_mummy(C, col, claim) { // criss-crossed bandage wraps with a loose cartoon tail
    const gz = pm('#ffffff', { map: T.gauze(col), r: 0.95, sheen: 0.5, bump: noiseTex(), bs: 0.6 }); shell(C, gz, { y0: -0.15, y1: 0.6 }); sleeves(C, gz); pants(C, gz);
    const n = C.lo ? 6 : 12; if (C.blob) for (let i = 0; i < n; i++) { const y = -0.12 + i * (0.7 / n); const r = add(ring(rAt(y) + 0.04, 0.02, TAU, C.S), gz, C.J.TB, 0, y, 0); r.rotation.set(Math.PI / 2 + (i % 2 ? 0.16 : -0.16), 0, 0); r.scale.set(1, 0.88, 1); }
    const limb = (b, len, rad) => { if (!b) return; for (let i = 0; i < (C.lo ? 2 : 4); i++) { const r = add(ring(rad + 0.03, 0.013, TAU, 20), gz, b, 0, -len * (0.15 + i * 0.22), 0); r.rotation.x = Math.PI / 2 + (i % 2 ? 0.3 : -0.3); } };
    for (const s of ['Left', 'Right']) { limb(C.J[s + 'UpperArm'], C.fit.ua || 0.3, C.fit.ar || 0.09); limb(C.J[s + 'LowerArm'], (C.fit.la || 0.27) * 0.8, C.fit.ar || 0.09); limb(C.J[s + 'UpperLeg'], C.fit.ul || 0.25, C.fit.lr || 0.1); limb(C.J[s + 'LowerLeg'], (C.fit.ll || 0.25) * 0.85, C.fit.lr || 0.1); }
    if (C.blob) { const tl = add(box(0.05, 0.2, 0.008), gz, C.J.TB, 0.2, -0.22, onFront(C, -0.15, 0.03) - 0.06); tl.rotation.set(0.15, 0.5, 0.25); }
    if (claim('head') && C.H) { for (let i = 0; i < (C.lo ? 5 : 9); i++) { const lat = -0.5 + i * 0.19; if (Math.abs(lat - 0.14) < 0.13) continue; const rr = C.hr * 1.08 * Math.cos(lat) * 1.02 + 0.012; const r = add(ring(rr, 0.022, TAU, C.S), gz, C.H, 0, Math.sin(lat) * C.hr * 1.02, 0); r.rotation.x = Math.PI / 2 + (i % 2 ? 0.08 : -0.08); r.scale.set(1, 0.92, 1); }
      dome(C, gz, 1.04, Math.PI * 0.24); } },
  hw_countfangs(C, col, claim) { // tailcoat + white shirt + purple bow, high-collar cape (purple lining), gold medallion, toy fangs
    const suit = fabric(col, { w: 'twill', bs: 0.4, sheen: 0.5 }); shell(C, fabric('#f7f3ee', { sheen: 0.6 }), { y0: -0.08, y1: 0.585, off: 0.024 });
    shell(C, suit, { off: 0.045, y0: -0.2, y1: 0.5, jk: 'cf', jag: (a) => (Math.abs(a) > 2.3 ? -0.12 : 0) }); sleeves(C, suit, { cuff: fabric('#f7f3ee') }); pants(C, suit);
    if (C.blob) { for (const s of [-1, 1]) { const b = add(cone(0.06, 0.12, 14), pm('#8a3ad0', { sheen: 1, r: 0.5 }), C.J.TB, s * 0.06, 0.55, onFront(C, 0.55, 0.04)); b.rotation.z = s * Math.PI / 2; }
      const md = add(geo('medal', () => new THREE.CylinderGeometry(0.055, 0.055, 0.015, 24)), pm('#ffcf3a', { metal: 1 }), C.J.TB, 0, 0.3, onFront(C, 0.3, 0.07)); md.rotation.x = Math.PI / 2; add(ball(0.025, 12), pm('#b83ad0', { cc: 1, r: 0.1 }), md, 0, 0.012, 0); }
    if (claim('back')) cape(C, pm(col, { sheen: 0.8, r: 0.6, ds: true }), pm('#8a3ad0', { sheen: 1, r: 0.5, ds: true }), { collar: pm('#8a3ad0', { sheen: 1, r: 0.5, ds: true }), h: 1.0 });
    if (claim('face') && C.H) PART.hw_fangs(C); },
  hw_wolfpup(C, col, claim) { // fuzzy suit + light belly, wolf-ear hood, fluffy tail
    const fur = pm(col, { r: 1, sheen: 1, bump: noiseTex(), bs: 2.2 }), lt = pm(shadeHex(col, 0.45), { r: 1, sheen: 1, bump: noiseTex(), bs: 2 });
    shell(C, fur, { y0: -0.15, y1: 0.6 }); sleeves(C, fur, { cuff: lt, cuffT: 0.03 }); pants(C, fur, { cuff: lt });
    if (C.blob) { const b = sq(add(tube('wbelly' + C.S, (y, a) => rAt(y) + 0.036, -0.1, 0.42, { segs: C.S, rows: 10 }), lt, C.J.TB)); b.scale.x = 0.55; b.position.z = 0.05; }
    if (claim('head') && C.H) { dome(C, fur, 1.1, Math.PI * 0.42); const rr = C.hr * 1.08 * Math.sin(Math.PI * 0.42) * 1.1; const rim = add(ring(rr, 0.04, TAU, C.S), lt, C.H, 0, Math.cos(Math.PI * 0.42) * C.hr * 1.1, 0); rim.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) { const e = at(C, add(cone(0.15, 0.32, 4), fur, C.H), s * 0.62, 0.8, 1.22); e.rotation.set(-0.1, Math.PI / 4, -s * 0.38); e.scale.z = 0.55; const i = add(cone(0.09, 0.2, 4), pm('#f4b8c8', { r: 0.8 }), e, 0, -0.03, 0.05); i.scale.z = 0.45; }
      if (!C.lo) for (let i = 0; i < 9; i++) { const lon = -0.9 + i * 0.225; facing(at(C, add(cone(0.035, 0.08, 6), lt, C.H), lon, 0.3, 1.13)).rotateX(-Math.PI / 2.4); } }
    if (claim('back') && C.J.Hips) { add(taper('wtail' + C.lo, [[0, 0, 0], [0, 0.08, -0.15], [0, 0.3, -0.25], [0, 0.46, -0.2]], 0.07, 0.1, C.lo ? 8 : 16, C.lo ? 8 : 12), fur, C.J.Hips, 0, 0, -0.3); add(ball(0.1, 14), lt, C.J.Hips, 0, 0.47, -0.5); } },
  hw_frankenpal(C, col, claim) { // patched short jacket w/ stitches, dark pants, flat-top hair, toy neck bolts
    const jk = fabric(col, { w: 'twill', bs: 0.7 }); shell(C, fabric('#d8d4c8'), { y0: -0.05, y1: 0.585, off: 0.024 });
    shell(C, jk, { off: 0.045, y0: -0.1, y1: 0.56, jk: 'fp', jag: (a) => -Math.abs(Math.sin(a * 3)) * 0.04 }); sleeves(C, jk, { tuft: (L, y, r) => { const c = add(ring(r, 0.012, TAU, 20), pm('#3a3448'), L, 0, y + 0.03, 0); c.rotation.x = Math.PI / 2; } }); pants(C, fabric('#2f2b3a', { w: 'twill' }));
    if (C.blob) for (const [x, y, c] of [[-0.16, 0.12, '#7a5aa8'], [0.18, 0.32, '#8a9a6a'], [0.04, -0.05, '#a87a5a']]) { const p = add(box(0.1, 0.09, 0.012), fabric(c, { w: 'twill' }), C.J.TB, x, y, onFront(C, y, 0.06) - Math.abs(x) * 0.28); p.rotation.y = x * 1.6; for (let i = 0; i < 4; i++) add(box(0.006, 0.026, 0.006), pm('#1a1428'), p, -0.045 + i * 0.03, 0.05, 0.004); }
    if (claim('head') && C.H) { const hair = pm('#2a2438', { r: 0.7, sheen: 0.5 }); add(geo('flattop', () => new THREE.BoxGeometry(1, 1, 1, 2, 2, 2)), hair, C.H, 0, C.hr * 0.92, -0.02).scale.set(C.hr * 1.75, C.hr * 0.4, C.hr * 1.65);
      for (let i = 0; i < 7; i++) { const z = add(cone(0.035, 0.09, 4), hair, C.H, -C.hr * 0.72 + i * C.hr * 0.24, C.hr * 0.68, C.hr * 0.8); z.rotation.x = Math.PI; }
      const sc = facing(at(C, add(box(0.14, 0.012, 0.006), pm('#3a3448'), C.H), 0.4, 0.42, 1.01)); for (let i = 0; i < 4; i++) add(box(0.006, 0.04, 0.006), pm('#3a3448'), sc, -0.05 + i * 0.033, 0, 0); }
    if (C.J.Neck && !C.lo) for (const s of [-1, 1]) { const b = add(cyl(0.025, 0.025, 0.12, 12, false), pm('#b8c0cc', { metal: 1 }), C.J.Neck, s * 0.28, -0.04, 0); b.rotation.z = Math.PI / 2; add(geo('hexnut', () => new THREE.CylinderGeometry(0.045, 0.045, 0.03, 6)), pm('#9aa4b4', { metal: 1 }), b, 0, s * -0.07, 0); } },
  hw_zombie(C, col, claim) { // torn tee + ragged shorts, slime-green drips (no gore), slime-patch knit beanie
    const tee = fabric(col, { bs: 0.8 }), sh = fabric('#5a4a6a', { w: 'twill' }); shell(C, tee, { y0: -0.15, y1: 0.585, jk: 'zb', jag: (a) => -Math.abs(Math.sin(a * 6 + 1)) * 0.06 });
    const rag = (m) => (U, y, r) => { for (let i = 0; i < 6; i++) { const a = i * 1.05; const t = add(cone(0.022, 0.055, 5), m, U, Math.sin(a) * r, y - 0.02, Math.cos(a) * r); t.rotation.x = Math.PI; } };
    sleeves(C, tee, { len: 0.5, tuft: rag(tee) }); pants(C, sh, { len: 0.5, tuft: rag(sh) });
    if (C.blob) { const sl = slime(); for (const [x, y] of [[-0.2, 0.45], [0.22, 0.2], [0.05, 0.05]]) { const z = onFront(C, y, 0.045) - Math.abs(x) * 0.25; const d = add(ball(1, 14), sl, C.J.TB, x, y, z); d.scale.set(0.05, 0.08, 0.025); add(ball(0.02, 10), sl, C.J.TB, x + 0.01, y - 0.09, z + 0.005); } }
    if (claim('head') && C.H) { const bn = fabric('#6a7a5a', { w: 'knit', bs: 1.4 }); dome(C, bn, 1.07, Math.PI * 0.4); const cf = add(ring(C.hr * 1.08 * Math.sin(Math.PI * 0.4) * 1.07, 0.035, TAU, C.S), bn, C.H, 0, Math.cos(Math.PI * 0.4) * C.hr * 1.07, 0); cf.rotation.x = Math.PI / 2;
      const d = at(C, add(ball(1, 12), slime(), C.H), 0.4, 0.8, 1.1); d.scale.set(0.07, 0.04, 0.04); if (!C.lo) add(ball(0.018, 8), slime(), C.H).position.copy(hp(C, 0.5, 0.62, 1.1)); } },
  hw_scarecrow(C, col, claim) { // red / mustard plaid shirt, straw tufts, patched dungarees, rope belt, straw hat + a toy crow
    const pl = pm('#ffffff', { map: T.plaid(col, '#f2c94c', '#3a2a24'), r: 0.9, sheen: 0.5 }); const straw = pm('#ffffff', { map: T.straw(), r: 1 });
    const tufts = (L, y, r) => { const n = C.lo ? 5 : 10; for (let i = 0; i < n; i++) { const a = i * TAU / n; const t = add(cone(0.012, 0.09, 4), straw, L, Math.sin(a) * r * 0.8, y - 0.04, Math.cos(a) * r * 0.8); t.rotation.set(Math.PI + Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4); } };
    shell(C, pl, { y0: -0.08, y1: 0.585 }); sleeves(C, pl, { tuft: tufts }); pants(C, fabric('#6f8fc0', { w: 'twill' }), { tuft: tufts });
    if (C.blob) { const rope = add(ring(rAt(-0.04) + 0.045, 0.02, TAU, C.S), pm('#c8a060', { r: 1, bump: noiseTex(), bs: 2 }), C.J.TB, 0, -0.04, 0); rope.rotation.x = Math.PI / 2; rope.scale.set(1, 0.88, 1);
      const p = add(box(0.09, 0.09, 0.012), fabric('#e8b84a', { w: 'twill' }), C.J.TB, 0.14, 0.15, onFront(C, 0.15, 0.04) - 0.04); p.rotation.y = 0.4; }
    if (claim('head') && C.H) { const y0 = C.hr * 0.6, rr = C.hr * 1.08 * 0.8 + 0.02; add(cyl(rr * 0.8, rr, C.hr * 0.42, C.S, false), straw, C.H, 0, y0 + C.hr * 0.2, 0);
      const tp = add(geo('stop', () => new THREE.CircleGeometry(1, 32)), straw, C.H, 0, y0 + C.hr * 0.41, 0); tp.rotation.x = -Math.PI / 2; tp.scale.setScalar(rr * 0.8);
      const br = add(geo('strawbrim' + C.S, () => { const g = new THREE.RingGeometry(1, 1.9, C.S, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.hypot(x, y); p.setZ(i, -(d - 1) * 0.18 + Math.sin(Math.atan2(y, x) * 5) * 0.05 * (d - 1)); } g.computeVertexNormals(); return g; }), pm('#ffffff', { map: T.straw(), r: 1, ds: true }), C.H, 0, y0, 0); br.rotation.x = -Math.PI / 2; br.scale.setScalar(rr);
      const bd = add(ring(rr * 0.96, 0.024, TAU, C.S), fabric('#c0503a'), C.H, 0, y0 + 0.04, 0); bd.rotation.x = Math.PI / 2;
      if (!C.lo) { const crow = new THREE.Group(); crow.position.set(rr * 1.35, y0 + 0.03, 0.1); crow.rotation.y = -0.6; C.H.add(crow); const bk = pm('#2a2438', { r: 0.6, sheen: 0.6 }); add(ball(0.06, 14), bk, crow, 0, 0.05, 0).scale.set(1, 0.85, 1.2); add(ball(0.04, 12), bk, crow, 0, 0.11, 0.05);
        const b2 = add(cone(0.015, 0.05, 8), pm('#ffb02e', { r: 0.4 }), crow, 0, 0.11, 0.1); b2.rotation.x = Math.PI / 2; for (const s of [-1, 1]) add(ball(0.009, 8), pm('#ffffff', { em: '#ffffff', ei: 0.5 }), crow, s * 0.02, 0.125, 0.08); } } },
  hw_bogbeast(C, col, claim) { // mossy ridged suit, leafy fringe, glossy slime spots, fin crown + lily pad with a flower
    const ms = pm('#ffffff', { map: T.moss(col), r: 0.95, sheen: 0.6, bump: noiseTex(), bs: 1.6 }); const leaf = pm('#6fae4a', { r: 0.6, cc: 0.5, ds: true });
    shell(C, ms, { y0: -0.16, y1: 0.6, rib: 0.04, jk: 'bog' }); sleeves(C, ms, { tuft: (L, y, r) => { for (let i = 0; i < 5; i++) { const a = i * 1.25; const l = add(ball(1, 10), leaf, L, Math.sin(a) * r, y - 0.02, Math.cos(a) * r); l.scale.set(0.025, 0.06, 0.008); l.rotation.y = a; } } }); pants(C, ms);
    if (C.blob) { const n = C.lo ? 10 : 22; for (let i = 0; i < n; i++) { const a = -Math.PI + i * TAU / n; const r = rAt(-0.14) + 0.05; const l = add(ball(1, 10), leaf, C.J.TB, Math.sin(a) * r, -0.18, Math.cos(a) * r * 0.88); l.scale.set(0.035, 0.07, 0.01); l.rotation.set(0, a, 0); }
      for (const [x, y] of [[-0.15, 0.3], [0.2, 0.1], [0.1, 0.42]]) { const s = add(ball(1, 12), slime('#5aff9a'), C.J.TB, x, y, onFront(C, y, 0.035) - Math.abs(x) * 0.25); s.scale.set(0.035, 0.035, 0.015); } }
    if (claim('head') && C.H) { for (let i = 0; i < 5; i++) { const f = facing(at(C, add(cone(0.06, 0.18 - Math.abs(i - 2) * 0.03, 10), pm('#4a8a5a', { r: 0.5, cc: 0.6 }), C.H), 0, 0.5 + i * 0.25, 1.0)); f.rotateX(Math.PI / 2); f.scale.z = 0.25; }
      const pad = at(C, add(geo('lily', () => new THREE.CircleGeometry(1, 32, 0.3, TAU - 0.6)), pm('#5fae4a', { r: 0.5, cc: 0.6, ds: true }), C.H), -0.5, 1.05, 1.03); pad.scale.setScalar(0.17); pad.rotation.x = -Math.PI / 2 + 0.3;
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; add(ball(1, 10), pm('#ff9ccf', { r: 0.5, sheen: 1 }), pad, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.12).scale.set(0.12, 0.12, 0.06); } add(ball(0.06, 10), pm('#ffd23a'), pad, 0, 0, 0.15); } },
  hw_alien(C, col, claim) { // shiny silver suit, glowing lime belt + cuffs + emblem, shoulder pads, bobble antennae
    const sv = pm(col, { metal: 1, r: 0.3, cc: 1 }); shell(C, sv, { y0: -0.15, y1: 0.6 }); sleeves(C, sv, { cuff: glow('#9bff6a', 0.8) }); pants(C, sv, { cuff: glow('#9bff6a', 0.8) });
    if (C.blob) { bandAt(C, -0.04, 0.045, 0.024, glow('#9bff6a', 0.9)); add(ring(0.06, 0.012, TAU, 24), glow('#9bff6a'), C.J.TB, 0, 0.3, onFront(C, 0.3, 0.05)); add(ball(0.025, 12), glow('#b06aff'), C.J.TB, 0, 0.3, onFront(C, 0.3, 0.06));
      for (const s of [-1, 1]) { const p = add(ball(1, 16), pm('#9aa4b4', { metal: 1, r: 0.25 }), C.J.TB, s * 0.3, 0.5, 0); p.scale.set(0.13, 0.06, 0.13); } }
    if (claim('head') && C.H) { const bd = add(ring(C.hr * 1.1, 0.02, Math.PI, C.S), sv, C.H, 0, 0.02, 0); bd.rotation.y = Math.PI / 2;
      for (const s of [-1, 1]) { add(taper('ant' + s, [[0, 0, 0], [s * 0.04, 0.12, 0], [s * 0.1, 0.22, 0.02], [s * 0.14, 0.3, 0.04]], 0.014, 0.01, 12, 8), sv, C.H, s * C.hr * 0.4, C.hr * 0.9, 0); add(ball(0.055, 14), glow('#9bff6a', 1.2), C.H, s * (C.hr * 0.4 + 0.14), C.hr * 0.9 + 0.3, 0.04); } } },
  hw_madsci(C, col, claim) { // long open lab coat w/ pens, purple shirt, wild white hair + brass goggles, glowing toy flask
    shell(C, fabric('#8a55dc', { sheen: 0.6 }), { y0: -0.08, y1: 0.585, off: 0.024 }); const coat = fabric(col, { w: 'twill', bs: 0.4, ds: true });
    if (C.blob) { const o = sq(add(geo('labcoat' + C.S, () => { const g = tube('labcoat0' + C.S, (y) => rAt(Math.max(-0.22, y)) + 0.05 + (y < -0.1 ? (-0.1 - y) * 0.45 : 0), -0.5, 0.56, { segs: C.S, rows: 22 }).clone(); const idx = g.index.array, uv = g.attributes.uv, keep = []; for (let i = 0; i < idx.length; i += 3) { const u = (uv.getX(idx[i]) + uv.getX(idx[i + 1]) + uv.getX(idx[i + 2])) / 3; if (Math.abs(u - 0.5) > 0.045) keep.push(idx[i], idx[i + 1], idx[i + 2]); } g.setIndex(keep); return g; }), coat, C.J.TB)); void o;
      const pk = add(box(0.1, 0.09, 0.012), fabric(col, { w: 'twill' }), C.J.TB, 0.2, 0.3, onFront(C, 0.3, 0.05) - 0.05); pk.rotation.y = 0.5; for (let i = 0; i < 3; i++) add(capsule(0.008, 0.06, 8), pm(['#e8434f', '#4aa8ff', '#9bff6a'][i], { cc: 1 }), pk, -0.025 + i * 0.025, 0.06, 0.004); }
    sleeves(C, coat, { cuff: fabric(shadeHex(col, -0.08)) }); pants(C, fabric('#3a3448', { w: 'twill' }));
    if (claim('head') && C.H) { const hair = pm('#f4f6fa', { r: 1, sheen: 1, bump: noiseTex(), bs: 2 }); const n = C.lo ? 7 : 14; for (let i = 0; i < n; i++) { const lon = Math.PI * 0.4 + (i / (n - 1)) * Math.PI * 1.2, lat = 0.25 + (i % 3) * 0.25; at(C, add(ball(0.09 + (i % 2) * 0.03, 12), hair, C.H), lon, lat, 1.02); }
      const gb = add(ring(C.hr * 1.1, 0.016, TAU, C.S), pm('#3a3448', { r: 0.6 }), C.H, 0, C.hr * 0.5, 0); gb.rotation.x = Math.PI / 2 + 0.2;
      for (const s of [-1, 1]) { const g = facing(at(C, add(cyl(0.07, 0.07, 0.05, 20, false), pm('#c8a040', { metal: 1, r: 0.3 }), C.H), s * 0.3, 0.62, 1.08)); g.rotateX(Math.PI / 2); const l = add(geo('glens', () => new THREE.CircleGeometry(0.06, 20)), pm('#8ae0ff', { op: 0.6, cc: 1, r: 0.05 }), g, 0, 0.026, 0); l.rotation.x = -Math.PI / 2; } }
    if (claim('held')) { const g = heldGroup(C, false); if (g) { add(geo('flask', () => new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.075, 0.02], [0.03, 0.11], [0.022, 0.13], [0.022, 0.17], [0.028, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), 24)), pm('#e8f6ff', { op: 0.35, cc: 1, r: 0.05, ds: true }), g, 0, -0.05, 0);
      add(geo('goo', () => new THREE.LatheGeometry([[0, 0.005], [0.064, 0.005], [0.068, 0.02], [0.045, 0.07], [0, 0.07]].map(([x, y]) => new THREE.Vector2(x, y)), 20)), glow('#b06aff', 0.9), g, 0, -0.05, 0);
      if (!C.lo) for (let i = 0; i < 4; i++) add(ball(0.012, 8), pm('#e0c0ff', { op: 0.6, em: '#b06aff', ei: 0.5 }), g, (i - 1.5) * 0.012, 0.06 + i * 0.03, 0); } } },
  hw_witchy(C, col, claim) { robe(C, col, '#ffcf3a', false, claim); },
  hw_moonwitch(C, col, claim) { robe(C, col, '#bfe8ff', true, claim); },
  hw_bride(C, col, claim) { // ghostly gown: bodice, layered tattered translucent skirt, purple sash + bow, pearl trim, floaty veil, glow bouquet
    const sat = pm(col, { sheen: 1, r: 0.45, cc: 0.3, em: '#c8b8ff', ei: 0.12 }); shell(C, sat, { y0: -0.1, y1: 0.56 }); sleeves(C, pm(col, { op: 0.55, sheen: 1, ds: true, em: '#c8b8ff', ei: 0.2 }), { bell: 0.06 });
    if (C.blob) { const sk = (k, op, len, jg) => { const o = add(tube(`brsk${k}${C.lo}`, (y, a, t) => { const u = 1 - t; return (rAt(-0.08) + 0.04 + 0.42 * Math.pow(u, 1.2)) * (1 + 0.04 * u * Math.cos(a * 14)); }, -0.1 - len, -0.08, { segs: C.lo ? 40 : 96, rows: 18, jag: (a) => -Math.abs(Math.sin(a * jg)) * 0.09 }), pm(k ? shadeHex(col, 0.3) : col, { op, sheen: 1, r: 0.5, ds: true, em: '#c8b8ff', ei: 0.18 }), C.J.TB); o.scale.z = 0.92; return o; };
      sk(0, 0.92, 0.56, 5); if (!C.lo) sk(1, 0.45, 0.62, 8).scale.set(1.06, 1, 0.98);
      bandAt(C, -0.08, 0.05, 0.026, pm('#8a3ad0', { sheen: 1, r: 0.4 })); for (const s of [-1, 1]) { const b = add(cone(0.07, 0.14, 16), pm('#8a3ad0', { sheen: 1, r: 0.4 }), C.J.TB, s * 0.07, -0.08, -(rAt(-0.08) + 0.08) * 0.88); b.rotation.z = s * Math.PI / 2; }
      const np = C.lo ? 8 : 18; for (let i = 0; i < np; i++) { const a = -1.2 + i * (2.4 / (np - 1)); const r = rAt(0.5) + 0.04; add(ball(0.014, 8), pm('#ffffff', { cc: 1, r: 0.2 }), C.J.TB, Math.sin(a) * r, 0.5, Math.cos(a) * r * 0.88); } }
    if (claim('head') && C.H) { const cr = add(ring(C.hr * 0.78, 0.014, TAU, C.S), pm('#5aa070'), C.H, 0, C.hr * 0.78, -0.03); cr.rotation.x = Math.PI / 2 + 0.2; for (let i = 0; i < 9; i++) { const a = i * TAU / 9; add(ball(0.03, 12), pm(i % 2 ? '#8a3ad0' : '#d8c8ff', { sheen: 1 }), C.H, Math.sin(a) * C.hr * 0.78, C.hr * 0.78 + Math.cos(a) * C.hr * 0.16, Math.cos(a) * C.hr * 0.78 - 0.03); }
      const vl = add(geo('veil' + C.lo, () => { const g = new THREE.PlaneGeometry(1, 1.25, 12, 18); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = 0.625 - y; p.setX(i, x * (0.6 + d * 0.45)); p.setZ(i, -Math.abs(x) * 0.45 - d * 0.25 + Math.sin(x * 10 + y * 4) * 0.03); } g.computeVertexNormals(); return g; }), pm('#f0eaff', { op: 0.42, ds: true, sheen: 1, em: '#d8ccff', ei: 0.3 }), C.H, 0, C.hr * 0.1, -C.hr * 0.75); vl.rotation.x = 0.15; vl.scale.setScalar(C.hr * 1.6); }
    if (claim('held')) { const g = heldGroup(C); if (g) { add(cap0(), pm('#5aa070'), g, 0, 0.08, 0); for (let i = 0; i < (C.lo ? 4 : 7); i++) { const a = i * 0.9; add(ball(0.035, 12), pm('#6a2aa8', { sheen: 1, r: 0.5 }), g, Math.sin(a) * 0.04, 0.2 + (i % 2) * 0.02, Math.cos(a) * 0.04); } for (let i = 0; i < 4; i++) add(ball(1, 10), glow('#9bffd0', 0.7), g, Math.sin(i * 1.6) * 0.06, 0.16, Math.cos(i * 1.6) * 0.06).scale.set(0.012, 0.035, 0.008); } } },
  hw_pumpking(C, col, claim) { // ribbed pumpkin velvet tunic + leaf collar, green sleeves/tights, gold buttons, vine cape, gold pumpkin crown
    const vel = pm('#ffffff', { map: T.ribs(col), sheen: 1, r: 0.55 }); shell(C, vel, { y0: -0.2, y1: 0.58, off: 0.05, rib: 0.07 });
    const gr = pm('#2f6a3a', { sheen: 0.9, r: 0.7 }); sleeves(C, gr, { cuff: pm('#ffcf3a', { metal: 1 }) }); sleeves(C, vel, { len: 0.5, off: 0.05, cuff: pm('#3f8a3a', { sheen: 0.8 }) }); pants(C, gr);
    if (C.blob) { const lf = pm('#4aa04a', { r: 0.5, cc: 0.4, ds: true }); const n = C.lo ? 8 : 14; for (let i = 0; i < n; i++) { const a = -Math.PI + i * TAU / n; const r = rAt(0.58) + 0.06; const l = add(geo('lfp', () => new THREE.SphereGeometry(1, 12, 8, 0, TAU, 0, Math.PI / 2)), lf, C.J.TB, Math.sin(a) * r, 0.57, Math.cos(a) * r * 0.88); l.scale.set(0.07, 0.12, 0.02); l.rotation.set(0, a, 0); l.rotateX(1.25); }
      for (let i = 0; i < 3; i++) { const y = 0.38 - i * 0.16; const b = add(geo('gbtn', () => new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16)), pm('#ffcf3a', { metal: 1 }), C.J.TB, 0, y, (rAt(y) + 0.05) * 0.88 * 1.07); b.rotation.x = Math.PI / 2; } }
    if (claim('back')) { const cp = cape(C, pm('#2f6a3a', { sheen: 1, r: 0.55, ds: true }), pm('#ffcf3a', { sheen: 1, r: 0.4, ds: true }), { h: 1.0, w: 0.9 }); if (cp && !C.lo) for (let i = 0; i < 5; i++) add(taper('vine' + (i % 2), [[0, 0, 0], [0.06, -0.06, -0.02], [0.02, -0.12, -0.03], [-0.04, -0.1, -0.03]], 0.008, 0.004, 12, 6), pm('#5a9a3a'), cp, -0.3 + i * 0.15, 0.3 - (i % 2) * 0.2, -0.02); }
    if (claim('head') && C.H) { const gold = pm('#ffcf3a', { metal: 1, r: 0.25 }); const y0 = C.hr * 0.8, rr = C.hr * 1.08 * 0.6 * 0.92; add(cyl(rr * 1.08, rr, C.hr * 0.24, C.S), pm('#ffcf3a', { metal: 1, r: 0.25, ds: true }), C.H, 0, y0 + C.hr * 0.1, 0);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; add(cone(0.04, 0.12, 12), gold, C.H, Math.sin(a) * rr * 1.1, y0 + C.hr * 0.28, Math.cos(a) * rr * 1.1); const pk = add(ball(1, 14), pm('#ff7a1a', { cc: 1, r: 0.2, em: '#ff5a00', ei: 0.25 }), C.H, Math.sin(a) * rr * 1.1, y0 + C.hr * 0.28 + 0.08, Math.cos(a) * rr * 1.1); pk.scale.set(0.03, 0.024, 0.03); }
      add(ball(0.035, 14), pm('#9bff6a', { cc: 1, r: 0.1, em: '#5aff3a', ei: 0.4 }), C.H, 0, y0 + C.hr * 0.12, rr * 1.1); } },
  hw_plague(C, col, claim) { // long dark coat w/ wide skirt, belt + pouch, purple capelet, cartoon beak mask w/ amber lenses, wide hat + feather
    const ct = fabric(col, { w: 'twill', bs: 0.5, sheen: 0.6, ds: true }); shell(C, ct, { y0: -0.5, y1: 0.59, flare: 0.22, fy: -0.06, jk: 'plg' }); sleeves(C, ct, { bell: 0.04, cuff: pm('#8a3ad0', { sheen: 1 }) });
    if (C.blob) { bandAt(C, -0.04, 0.05, 0.024, pm('#5a3a2a', { r: 0.5, cc: 0.5 })); add(box(0.06, 0.05, 0.02), pm('#ffcf3a', { metal: 1 }), C.J.TB, 0, -0.04, onFront(C, -0.04, 0.07)); const pch = add(box(0.1, 0.1, 0.05), pm('#6a4a3a', { r: 0.6, cc: 0.3 }), C.J.TB, 0.26, -0.1, onFront(C, -0.1, 0.0)); pch.rotation.y = 0.6;
      sq(add(tube('capelet' + C.S, (y, a, t) => rAt(Math.max(0.3, y)) + 0.07 + (1 - t) * 0.14, 0.26, 0.6, { segs: C.S, rows: 10, jag: (a) => -Math.abs(Math.sin(a * 6)) * 0.04 }), pm('#6a3a9a', { sheen: 1, r: 0.6, ds: true }), C.J.TB)); }
    if (claim('face') && C.H) { const bm = pm('#f4e8d0', { r: 0.6, cc: 0.4 }); const bk = add(taper('beak' + C.lo, [[0, 0, 0], [0, -0.05, 0.12], [0, -0.14, 0.26], [0, -0.24, 0.34]], 0.13, 0.015, C.lo ? 10 : 20, C.lo ? 10 : 18), bm, C.H, 0, -0.02, C.fz * 0.95); bk.scale.x = 0.9;
      for (let i = 0; i < 3; i++) { const r = add(ring(0.11 - i * 0.03, 0.008, TAU, 20), pm('#8a3ad0', { r: 0.5 }), bk, 0, -0.04 - i * 0.05, 0.1 + i * 0.07); r.rotation.x = 0.5; }
      for (const s of [-1, 1]) { const e = eyeDir(C, s); const p = new THREE.Vector3(e.x * C.hr * 1.08 * 1.1, e.y * C.hr * 1.1, e.z * C.hr * 0.98 * 1.1); const rim = add(cyl(0.085, 0.085, 0.04, 20, false), pm('#5a3a2a', { metal: 1, r: 0.4, ds: true }), C.H); rim.position.copy(p); rim.lookAt(p.clone().multiplyScalar(2)); rim.rotateX(Math.PI / 2);
        const ln = add(geo('pglens', () => new THREE.CircleGeometry(0.075, 24)), pm('#ffc04a', { op: 0.55, cc: 1, r: 0.05, em: '#ff9a1a', ei: 0.3 }), rim, 0, 0.021, 0); ln.rotation.x = -Math.PI / 2; }
      const st = add(ring(C.hr * 1.1, 0.014, TAU, C.S), pm('#5a3a2a', { r: 0.5 }), C.H, 0, 0.05, 0); st.rotation.x = Math.PI / 2; }
    if (claim('head') && C.H) { const y0 = C.hr * 0.66, rr = C.hr * 1.08 * 0.75 + 0.02; const hm = fabric('#1f1c28', { sheen: 0.5, ds: true }); add(cyl(rr * 0.92, rr, C.hr * 0.36, C.S), hm, C.H, 0, y0 + C.hr * 0.18, 0); const tp = add(geo('htop', () => new THREE.CircleGeometry(1, 32)), hm, C.H, 0, y0 + C.hr * 0.36, 0); tp.rotation.x = -Math.PI / 2; tp.scale.setScalar(rr * 0.92);
      const br = add(geo('pbrim', () => new THREE.CylinderGeometry(1, 1.9, 0.02, 40, 1, true)), hm, C.H, 0, y0, 0); br.scale.set(rr, 1, rr); const bd = add(ring(rr * 0.97, 0.02, TAU, C.S), pm('#8a3ad0', { sheen: 1 }), C.H, 0, y0 + 0.03, 0); bd.rotation.x = Math.PI / 2;
      if (!C.lo) add(taper('feather', [[0, 0, 0], [0.04, 0.1, -0.05], [0.05, 0.22, -0.14], [0.02, 0.3, -0.24]], 0.03, 0.004, 14, 8), pm('#b06aff', { sheen: 1, r: 0.7 }), C.H, rr * 0.9, y0 + 0.05, 0).scale.z = 0.4; } },
};
function skeleton(C, col, bone, lit, claim) { // black suit + bone print (glow version: 3D glowing ribs), skull hood with a friendly face
  const suit = pm('#ffffff', { map: T.bones(col, bone), r: 0.8, sheen: 0.5, emap: lit ? T.bones('#000000', '#ffffff') : null, em: lit ? bone : '#000000', ei: lit ? 0.8 : 1 });
  const plain = pm(col, { r: 0.8, sheen: 0.5 }); const bm = lit ? glow(bone, 0.9) : pm(bone, { r: 0.6, cc: 0.3 });
  shell(C, suit, { y0: -0.15, y1: 0.6 }); sleeves(C, plain); pants(C, plain);
  const limb = (b, len, rad) => { if (!b) return; add(capsule(rad * 0.28, len * 0.6, 10), bm, b, 0, -len / 2, rad + 0.03); for (const y of [-len * 0.12, -len * 0.88]) add(ball(rad * 0.38, 10), bm, b, 0, y, rad + 0.03); };
  for (const n of ['Left', 'Right']) { limb(C.J[n + 'UpperArm'], C.fit.ua || 0.3, C.fit.ar || 0.09); limb(C.J[n + 'LowerArm'], (C.fit.la || 0.27) * 0.82, C.fit.ar || 0.09); limb(C.J[n + 'UpperLeg'], C.fit.ul || 0.25, C.fit.lr || 0.1); limb(C.J[n + 'LowerLeg'], (C.fit.ll || 0.25) * 0.86, C.fit.lr || 0.1); }
  if (lit && C.blob && !C.lo) for (let i = 0; i < 4; i++) { const y = 0.42 - i * 0.1; const r = add(ring(rAt(y) + 0.045, 0.014, Math.PI * 0.7, 24), bm, C.J.TB, 0, y, 0); r.rotation.set(Math.PI / 2, 0, Math.PI / 2 - Math.PI * 0.35); r.scale.set(1, 0.88, 1); }
  if (claim('head') && C.H) { dome(C, plain, 1.08, Math.PI * 0.75, 0); mask(C, bm, { lon: 0.95, lat0: -0.55, lat1: 0.85, hole: 0.27, id: 'skull', k: 1.1, keep: (lon, lat) => (lon / 0.95) ** 2 + ((lat - 0.15) / 0.72) ** 2 < 1, rim: pm('#1a1428') });
    facing(at(C, add(extrude('nose', (s) => { s.moveTo(0, 0.03); s.lineTo(0.025, -0.02); s.lineTo(-0.025, -0.02); s.closePath(); }, 0.01, 0.004), pm('#1a1428'), C.H), 0, -0.1, 1.12));
    for (let i = 0; i < 5; i++) facing(at(C, add(box(0.028, 0.04, 0.012), pm('#1a1428'), C.H), -0.2 + i * 0.1, -0.33, 1.11)); }
}
function robe(C, col, star, lit, claim) { // witch robe: long flared robe w/ star + moon print, bell sleeves, belt + moon buckle (moon witch glows)
  const rb = pm('#ffffff', { map: T.stars(col, star, lit ? 'l' : ''), sheen: 1, r: 0.65, ds: true, emap: lit ? T.stars('#000000', '#ffffff', 'e') : null, em: lit ? star : '#000000', ei: lit ? 0.9 : 1 });
  shell(C, rb, { y0: -0.55, y1: 0.59, flare: 0.3, fy: -0.04, jk: 'robe', jag: (a) => -Math.abs(Math.sin(a * 4)) * 0.06 }); sleeves(C, rb, { bell: 0.09, cuff: pm(lit ? '#bfe8ff' : '#ff8a1e', { sheen: 1, em: lit ? '#bfe8ff' : '#000000', ei: 0.4 }) });
  if (C.blob) { bandAt(C, -0.04, 0.05, 0.024, pm(lit ? '#c8d8ff' : '#ff8a1e', { sheen: 1, r: 0.5 })); add(extrude('moonb', moonShape(0.05), 0.014, 0.004), lit ? glow('#fff3a8', 1) : pm('#ffcf3a', { metal: 1 }), C.J.TB, 0, -0.04, onFront(C, -0.04, 0.075));
    if (lit && !C.lo) sq(add(tube('shawl' + C.S, (y, a, t) => rAt(Math.max(0.3, y)) + 0.075 + (1 - t) * 0.1, 0.3, 0.6, { segs: C.S, rows: 8, jag: (a) => -Math.abs(Math.sin(a * 9)) * 0.05 }), pm('#d8f0ff', { op: 0.4, ds: true, sheen: 1, em: '#a8d8ff', ei: 0.35 }), C.J.TB)); }
  if (lit) { if (claim('head') && C.H) PART.hw_witchhat(C, col, true); if (claim('held')) PART.hw_broom(C, '#4a3a7a', true); }
}

// ---------------------------------------------------------------- single pieces (head / face / back / held)
const PART = {
  hw_jack(C, col) { // carved jack-o-lantern head: ribbed pumpkin, glowing carved (toy) face, stem + curly vine
    const pk = pm(col, { r: 0.45, cc: 0.6, sheen: 0.3 }); const k = 1.14;
    const g = add(geo('jackp' + C.S, () => { const g = new THREE.SphereGeometry(1, C.S, C.lo ? 16 : 28); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(x, z); const r = 1 - 0.07 * Math.pow(Math.abs(Math.sin(a * 4)), 0.7) * Math.sqrt(Math.max(0, 1 - y * y)); p.setXYZ(i, x * r, y * (0.92 + 0.08 * Math.abs(y)), z * r); } g.computeVertexNormals(); return g; }), pk, C.H, 0, 0.02, 0);
    g.scale.set(C.hr * 1.08 * k, C.hr * k * 0.95, C.hr * 0.98 * k); const fg = glow('#ffd23a', 1.1);
    for (const s of [-1, 1]) facing(at(C, add(extrude('jeye', (sh) => { sh.moveTo(0, 0.06); sh.lineTo(0.055, -0.035); sh.lineTo(-0.055, -0.035); sh.closePath(); }, 0.02, 0.004), fg, C.H), s * 0.3, 0.14, 1.13));
    facing(at(C, add(extrude('jnose', (sh) => { sh.moveTo(0, 0.03); sh.lineTo(0.03, -0.02); sh.lineTo(-0.03, -0.02); sh.closePath(); }, 0.02, 0.004), fg, C.H), 0, -0.05, 1.14));
    facing(at(C, add(extrude('jmouth', (sh) => { sh.moveTo(-0.17, 0.02); for (let i = 1; i <= 6; i++) sh.lineTo(-0.17 + i * 0.0567, i % 2 ? -0.005 : 0.03); sh.quadraticCurveTo(0.12, -0.1, 0, -0.1); sh.quadraticCurveTo(-0.12, -0.1, -0.17, 0.02); }, 0.02, 0.004), fg, C.H), 0, -0.3, 1.1));
    add(taper('jstem', [[0, 0, 0], [0.01, 0.06, 0], [0.04, 0.11, 0.01], [0.07, 0.13, 0.02]], 0.04, 0.025, 10, 10), pm('#4a7a2a', { r: 0.7 }), C.H, 0, C.hr * k * 0.86, 0);
    if (!C.lo) add(taper('jvine', [[0, 0, 0], [-0.06, 0.03, 0.04], [-0.1, 0, 0.08], [-0.07, -0.03, 0.06], [-0.05, 0, 0.04]], 0.008, 0.004, 16, 6), pm('#5a9a3a'), C.H, 0, C.hr * k * 0.88, 0); },
  hw_witchhat(C, col, moon) { // tall bent cone, wide wavy brim, band + buckle (moon witch: glowing crescent + dangling stars)
    const y0 = C.hr * 0.6, rr = C.hr * 1.08 * 0.8 + 0.03; const m = fabric(col, { sheen: 1, ds: true, bs: 0.5 });
    const cn = add(geo('wcone' + C.S, () => { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector2(Math.max(0.001, (1 - t) * (1 - 0.15 * Math.sin(t * Math.PI))), t * 2.4)); } const g = new THREE.LatheGeometry(pts, C.S); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / 2.4; p.setX(i, p.getX(i) + Math.pow(t, 2.2) * 0.9); p.setY(i, y - Math.pow(t, 3) * 0.35); } g.computeVertexNormals(); return g; }), m, C.H, 0, y0, 0); cn.scale.set(rr * 0.82, C.hr * 0.5, rr * 0.82); cn.rotation.z = 0.08;
    const br = add(geo('wbrim' + C.S, () => { const g = new THREE.RingGeometry(0.75, 2.0, C.S, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.hypot(x, y); p.setZ(i, Math.sin(Math.atan2(y, x) * 3) * 0.08 * (d - 0.75) - (d - 0.75) * 0.06); } g.computeVertexNormals(); return g; }), m, C.H, 0, y0, 0); br.rotation.x = -Math.PI / 2; br.scale.setScalar(rr);
    add(cyl(rr * 0.83, rr * 0.8, 0.07, C.S), pm(moon ? '#bfe8ff' : '#ff8a1e', { sheen: 1, r: 0.5, ds: true }), C.H, 0, y0 + 0.04, 0);
    if (moon) { add(extrude('hmoon', moonShape(0.08), 0.016, 0.005), glow('#fff3a8', 1.1), C.H, 0, y0 + 0.22, rr * 0.72); if (!C.lo) for (let i = 0; i < 3; i++) { const x = (i - 1) * rr * 0.9, z = rr * 1.25; add(capsule(0.003, 0.08, 6), pm('#c8d8ff', { metal: 1 }), C.H, x, y0 - 0.05, z); add(extrude('dstar', starShape(0.03), 0.01, 0.003), glow('#fff3a8', 1), C.H, x, y0 - 0.11, z); } }
    else add(box(0.07, 0.06, 0.012), pm('#ffcf3a', { metal: 1 }), C.H, 0, y0 + 0.04, rr * 0.84); },
  hw_kitmask(C, col) { // black-cat eye mask w/ real eye holes, pointy ears, pink nose, whiskers
    const m = pm(col, { r: 0.4, cc: 0.8 }); mask(C, m, { lon: 1.05, lat0: -0.12, lat1: 0.45, hole: 0.27, id: 'kit', k: 1.08, keep: (lon, lat) => lat < 0.4 - Math.abs(lon) * 0.12 });
    for (const s of [-1, 1]) { const e = facing(at(C, add(cone(0.07, 0.13, 3), m, C.H), s * 0.62, 0.42, 1.06)); e.rotateX(Math.PI / 2); e.scale.z = 0.4; const i = add(cone(0.04, 0.08, 3), pm('#ff9ccf', { r: 0.6 }), e, 0, -0.01, 0.02); i.scale.z = 0.3; }
    const ns = at(C, add(ball(1, 12), pm('#ff9ccf', { cc: 1, r: 0.3 }), C.H), 0, -0.06, 1.12); ns.scale.set(0.035, 0.025, 0.02);
    if (!C.lo) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const w = at(C, add(box(0.16, 0.006, 0.006), pm('#f4f0ff', { r: 0.5 }), C.H), s * 0.45, -0.1 - i * 0.05, 1.08); w.rotation.set(0, s * 0.5, s * (0.12 - i * 0.12)); } },
  hw_grinmask(C, col) { // round sunny grin mask (big cartoon smile + teeth), eye holes, painted brows + cheeks
    const m = pm(col, { r: 0.5, cc: 0.6 }); mask(C, m, { lon: 1.0, lat0: -0.75, lat1: 0.7, hole: 0.26, id: 'grin', k: 1.1, keep: (lon, lat) => (lon / 1.0) ** 2 + ((lat + 0.02) / 0.73) ** 2 < 1 });
    facing(at(C, add(extrude('grin', (sh) => { sh.moveTo(-0.2, 0.03); sh.quadraticCurveTo(0, -0.03, 0.2, 0.03); sh.quadraticCurveTo(0.16, -0.17, 0, -0.18); sh.quadraticCurveTo(-0.16, -0.17, -0.2, 0.03); }, 0.012, 0.004), pm('#4a1a3a', { r: 0.5 }), C.H), 0, -0.3, 1.11));
    if (!C.lo) for (let i = 0; i < 6; i++) facing(at(C, add(box(0.042, 0.035, 0.014), pm('#ffffff', { cc: 1, r: 0.3 }), C.H), -0.21 + i * 0.084, -0.27, 1.12));
    for (const s of [-1, 1]) { const b = facing(at(C, add(capsule(0.014, 0.1, 8), pm('#4a1a3a'), C.H), s * 0.3, 0.45, 1.11)); b.rotateZ(Math.PI / 2 + s * 0.25); const ck = facing(at(C, add(ball(1, 12), pm('#ff6a6a', { op: 0.6 }), C.H), s * 0.55, -0.15, 1.115)); ck.scale.set(0.05, 0.035, 0.01); } },
  hw_monstmask(C, col) { // fuzzy monster mask: furry, white eye rims, tiny horns, two toothy fangs, fur tufts
    const fur = pm(col, { r: 1, sheen: 1, bump: noiseTex(), bs: 2.5 }); mask(C, fur, { lon: 1.15, lat0: -0.6, lat1: 0.95, hole: 0.27, id: 'monst', k: 1.1, rim: pm('#ffffff', { cc: 1, r: 0.2 }) });
    for (const s of [-1, 1]) facing(at(C, add(cone(0.05, 0.14, 12), pm('#f6e3a1', { r: 0.5, cc: 0.4 }), C.H), s * 0.4, 0.95, 1.08)).rotateX(Math.PI / 2);
    for (const s of [-1, 1]) at(C, add(cone(0.03, 0.06, 8), pm('#ffffff', { cc: 1 }), C.H), s * 0.12, -0.32, 1.12).rotation.x = Math.PI;
    if (!C.lo) for (let i = 0; i < 16; i++) { const lon = -1 + (i % 8) * 0.28, lat = i < 8 ? 0.85 : -0.52; facing(at(C, add(cone(0.025, 0.07, 6), fur, C.H), lon, lat, 1.1)).rotateX(Math.PI / 2); } },
  hw_ghostmask(C, col) { // soft white full-face ghost mask, eye holes, little "oo" mouth, faint glow
    const m = pm(col, { r: 0.7, sheen: 0.8, em: '#e0e8ff', ei: 0.15 }); mask(C, m, { lon: 1.05, lat0: -0.7, lat1: 0.8, hole: 0.28, id: 'ghost', k: 1.1, keep: (lon, lat) => (lon / 1.05) ** 2 + ((lat - 0.05) / 0.75) ** 2 < 1, rim: pm('#2a2238') });
    facing(at(C, add(ring(0.04, 0.014, TAU, 16), pm('#2a2238'), C.H), 0, -0.3, 1.11)); facing(at(C, add(ball(1, 12), pm('#2a2238'), C.H), 0, -0.3, 1.105)).scale.set(0.035, 0.035, 0.01); },
  hw_batmask(C, col) { // eye mask with scalloped bat-wing tips + little ears
    const m = pm(col, { r: 0.35, cc: 0.9, sheen: 0.4 }); mask(C, m, { lon: 1.25, lat0: -0.1, lat1: 0.4, hole: 0.26, id: 'bat', k: 1.08, keep: (lon, lat) => lat > -0.1 + (Math.abs(lon) > 0.7 ? Math.abs(Math.sin(lon * 6)) * 0.12 : 0) && lat < 0.4 - (Math.abs(lon) > 0.85 ? (Math.abs(lon) - 0.85) * 0.7 : 0) });
    for (const s of [-1, 1]) { const e = facing(at(C, add(cone(0.05, 0.1, 3), m, C.H), s * 0.3, 0.45, 1.07)); e.rotateX(Math.PI / 2); e.scale.z = 0.35; } },
  hw_sportsmask(C, col) { // generic white sports mask (camp costume): oval, vent dots in a smile, mint chevrons, strap
    const m = pm(col, { r: 0.35, cc: 0.9 }); mask(C, m, { lon: 0.95, lat0: -0.7, lat1: 0.85, hole: 0.24, id: 'sport', k: 1.11, keep: (lon, lat) => (lon / 0.95) ** 2 + ((lat - 0.07) / 0.78) ** 2 < 1, rim: pm('#3f6b52') });
    for (let i = 0; i < (C.lo ? 3 : 8); i++) { const lon = (i - (C.lo ? 1 : 3.5)) * 0.12, lat = -0.33 + Math.abs(lon) * 0.25; facing(at(C, add(ball(1, 10), pm('#3a3448'), C.H), lon, lat, 1.115)).scale.set(0.014, 0.014, 0.006); }
    for (const s of [-1, 1]) facing(at(C, add(extrude('chev', (sh) => { sh.moveTo(0, 0); sh.lineTo(0.05, 0.04); sh.lineTo(0.05, 0.065); sh.lineTo(0, 0.025); sh.lineTo(-0.05, 0.065); sh.lineTo(-0.05, 0.04); sh.closePath(); }, 0.006, 0.002), pm('#5ac8a0', { r: 0.5 }), C.H), s * 0.42, 0.42, 1.115));
    const st = add(ring(C.hr * 1.1, 0.014, TAU, C.S), pm('#3a3448'), C.H, 0, 0.12, 0); st.rotation.x = Math.PI / 2; },
  hw_fangs(C) { for (const s of [-1, 1]) at(C, add(cone(0.016, 0.05, 10), pm('#ffffff', { cc: 1, r: 0.2 }), C.H), s * 0.09, -0.4, 1.0).rotation.x = Math.PI; },
  hw_imphorns(C, col) { // headband + two curly soft-plastic imp horns
    const m = pm(col, { r: 0.35, cc: 0.9 }); const b = add(ring(C.hr * 1.07, 0.018, Math.PI, C.S), pm('#2a2238', { r: 0.4, cc: 0.6 }), C.H, 0, 0.03, 0); b.rotation.y = Math.PI / 2;
    for (const s of [-1, 1]) add(taper('horn' + s, [[0, 0, 0], [s * 0.05, 0.08, 0], [s * 0.1, 0.15, -0.02], [s * 0.08, 0.22, -0.03]], 0.05, 0.008, C.lo ? 8 : 16, C.lo ? 8 : 14), m, C.H, s * C.hr * 0.45, C.hr * 0.85, 0.04); },
  hw_batwings(C, col) { batWings(C, pm(col, { r: 0.5, sheen: 0.6, ds: true }), pm(shadeHex(col, -0.3), { r: 0.4 })); },
  hw_nightcape(C, col) { cape(C, pm(col, { sheen: 1, r: 0.55, ds: true }), pm('#ff8a1e', { sheen: 1, r: 0.5, ds: true }), { collar: pm(col, { sheen: 1, ds: true }), h: 1.0 });
    if (C.J.Chest) add(extrude('capemoon', moonShape(0.04), 0.012, 0.004), pm('#ffcf3a', { metal: 1 }), C.J.Chest, 0.18, 0.3, 0.38); },
  hw_spectral(C, col) { // ghostly feather wings: layered translucent glowing feathers
    if (!C.J.Chest) return; const n = C.lo ? 6 : C.hi ? 14 : 10; const m = pm(col, { op: 0.5, em: col, ei: 0.7, ds: true, r: 0.4 }), m2 = pm('#ffffff', { op: 0.35, em: '#d8f8ff', ei: 0.6, ds: true });
    for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.18, 0.12, -0.42); w.rotation.y = s * -0.35; C.J.Chest.add(w);
      for (let row = 0; row < (C.lo ? 1 : 2); row++) for (let i = 0; i < n; i++) { const t = i / (n - 1); const f = add(ball(1, 12), (i + row) % 2 ? m2 : m, w, s * (0.12 + t * 0.48) * (1 - row * 0.2), 0.25 - t * 0.5 + Math.sin(t * Math.PI) * 0.25 - row * 0.06, -t * 0.05 - row * 0.02); f.scale.set(0.05, (0.22 - t * 0.06) * (1 - row * 0.25), 0.012); f.rotation.z = s * (0.6 + t * 1.6); } } },
  hw_glowwand(C, col) { const g = heldGroup(C); if (!g) return; add(capsule(0.012, 0.28, 8), pm('#6a2aa8', { cc: 1, r: 0.3 }), g, 0, 0.15, 0); add(ring(0.016, 0.006, TAU, 12), pm('#ffcf3a', { metal: 1 }), g, 0, 0.05, 0).rotation.x = Math.PI / 2;
    add(extrude('wstar2', starShape(0.07), 0.025, 0.008), glow(col, 1.2), g, 0, 0.36, 0); if (!C.lo) for (let i = 0; i < 5; i++) { const a = i * 1.26; add(ball(0.01, 8), glow('#ffffff', 1), g, Math.cos(a) * 0.11, 0.36 + Math.sin(a) * 0.11, 0); } },
  hw_candy(C, col) { // toy pumpkin candy pail with handle + wrapped candies
    const g = heldGroup(C, false); if (!g) return;
    add(geo('pail', () => { const g = new THREE.LatheGeometry([[0, 0], [0.07, 0.005], [0.1, 0.04], [0.105, 0.09], [0.09, 0.13], [0.085, 0.135], [0.08, 0.13]].map(([x, y]) => new THREE.Vector2(x, y)), 24); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getX(i), p.getZ(i)); const k = 1 - 0.06 * Math.abs(Math.sin(a * 4)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } g.computeVertexNormals(); return g; }), pm(col, { r: 0.4, cc: 0.8, ds: true }), g, 0, -0.2, 0);
    add(ring(0.09, 0.006, Math.PI, 16), pm('#2a2438', { r: 0.4 }), g, 0, -0.07, 0);
    for (const s of [-1, 1]) add(extrude('peye', (sh) => { sh.moveTo(0, 0.02); sh.lineTo(0.02, -0.012); sh.lineTo(-0.02, -0.012); sh.closePath(); }, 0.006, 0.002), pm('#2a1a12'), g, s * 0.035, -0.12, 0.1);
    add(extrude('pmouth', (sh) => { sh.moveTo(-0.045, 0); sh.quadraticCurveTo(0, -0.04, 0.045, 0); sh.quadraticCurveTo(0, -0.015, -0.045, 0); }, 0.006, 0.002), pm('#2a1a12'), g, 0, -0.15, 0.1);
    const cols = ['#e8434f', '#9bff6a', '#b06aff', '#ffcf3a', '#4aa8ff']; for (let i = 0; i < (C.lo ? 3 : 6); i++) { const a = i * 1.1; const c = add(ball(1, 10), pm(cols[i % 5], { cc: 1, r: 0.2 }), g, Math.sin(a) * 0.045, -0.07, Math.cos(a) * 0.045); c.scale.set(0.022, 0.016, 0.016); c.rotation.y = a; } },
  hw_foamaxe(C, col) { // chunky FOAM toy axe: soft rounded head (no edge), striped grip, pink pommel
    const g = heldGroup(C); if (!g) return; add(capsule(0.025, 0.36, 12), foam('#9a6aff'), g, 0, 0.18, 0); for (let i = 0; i < 4; i++) add(ring(0.027, 0.006, TAU, 14), foam('#ffffff'), g, 0, 0.04 + i * 0.05, 0).rotation.x = Math.PI / 2;
    add(extrude('foamaxe', (sh) => { sh.moveTo(0, 0.06); sh.quadraticCurveTo(0.14, 0.12, 0.17, 0.0); sh.quadraticCurveTo(0.14, -0.12, 0, -0.06); sh.closePath(); }, 0.04, 0.02), foam(col), g, 0.02, 0.36, 0);
    add(ball(0.035, 14), foam('#ff6fae'), g, 0, 0.42, 0); },
  hw_rubberclaws(C, col) { // big squishy rubber monster mitt with round-tipped claws (toy)
    const hand = C.J.RightHand; if (!hand) return; const m = rubber(col); const g = new THREE.Group(); g.position.set(0, -0.06, 0.02); hand.add(g);
    add(ball(1, 18), m, g).scale.set(0.1, 0.09, 0.08); add(ring(0.085, 0.02, TAU, 18), rubber(shadeHex(col, -0.25)), g, 0, 0.06, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const a = -0.6 + i * 0.4; const c = add(capsule(0.016, 0.07, 8), rubber(shadeHex(col, 0.35)), g, Math.sin(a) * 0.07, -0.1, 0.03 + Math.cos(a) * 0.03); c.rotation.set(0.3, 0, a * 0.5); }
    if (!C.lo) for (let i = 0; i < 5; i++) add(ball(0.012, 8), rubber(shadeHex(col, -0.2)), g, -0.05 + i * 0.025, 0.02 + (i % 2) * 0.02, 0.075); },
  hw_broom(C, col, moon) { // toy broom: wavy stick, tied bristle bundle (moon witch: glowing bristles + star)
    const g = heldGroup(C); if (!g) return; add(taper('broomstick', [[0, -0.1, 0], [0.01, 0.1, 0], [-0.01, 0.3, 0], [0, 0.5, 0]], 0.014, 0.012, 12, 8), pm(moon ? '#6a5aa8' : col, { r: 0.6, sheen: 0.4 }), g);
    const br = add(geo('bristle', () => new THREE.ConeGeometry(0.07, 0.16, 18, 4, true)), moon ? glow('#bfe8ff', 0.6) : pm('#ffffff', { map: T.straw(), r: 1, ds: true }), g, 0, -0.16, 0); br.rotation.x = Math.PI;
    add(ring(0.024, 0.008, TAU, 14), pm(moon ? '#fff3a8' : '#8a3ad0', { r: 0.5 }), g, 0, -0.08, 0).rotation.x = Math.PI / 2; if (moon) add(extrude('bstar', starShape(0.03), 0.01, 0.003), glow('#fff3a8', 1), g, 0, 0.53, 0); },
  hw_lantern(C, col) { // paper lantern (glows) with a happy face, stick handle
    const g = heldGroup(C); if (!g) return; add(capsule(0.01, 0.3, 8), pm('#5a3a2a', { r: 0.6 }), g, 0, 0.15, 0);
    add(geo('lant', () => new THREE.LatheGeometry([[0, 0], [0.05, 0.005], [0.075, 0.05], [0.07, 0.1], [0.04, 0.13], [0, 0.135]].map(([x, y]) => new THREE.Vector2(x, y)), 24)), pm(col, { em: col, ei: 0.8, op: 0.92, r: 0.6, sheen: 0.6 }), g, 0, 0.3, 0);
    for (let i = 0; i < 3; i++) add(ring(0.073 - Math.abs(i - 1) * 0.008, 0.004, TAU, 20), pm('#2a1a12'), g, 0, 0.33 + i * 0.035, 0).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) add(ball(0.01, 8), pm('#2a1a12'), g, s * 0.025, 0.37, 0.07); },
};
function batWings(C, m, bone) { // scalloped membrane + finger struts on the chest
  if (!C.J.Chest) return; const g0 = extrude('batw', (sh) => { sh.moveTo(0, 0.1); sh.quadraticCurveTo(0.25, 0.25, 0.5, 0.18); sh.lineTo(0.48, -0.02); sh.quadraticCurveTo(0.4, 0.02, 0.36, -0.08); sh.quadraticCurveTo(0.28, -0.02, 0.22, -0.12); sh.quadraticCurveTo(0.12, -0.04, 0.0, -0.1); sh.closePath(); }, 0.008, 0.004);
  for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.set(s * 0.16, 0.14, -0.42); w.rotation.y = s * -0.4; C.J.Chest.add(w);
    add(g0, m, w).scale.set(s, 1, 1); if (!C.lo) for (const [x, y] of [[0.5, 0.18], [0.36, -0.08], [0.22, -0.12]]) add(taper(`bs${x}`, [[0, 0.08, 0], [x * 0.5, (y + 0.08) * 0.5 + 0.04, 0], [x, y, 0]], 0.012, 0.006, 8, 6), bone, w, 0, 0, 0.006).scale.set(s, 1, 1); }
}
