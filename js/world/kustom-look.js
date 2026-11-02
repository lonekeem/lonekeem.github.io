// 🔧 Kemy Kustoms: the look of a customized car (paint finish, rims, spoiler, decals, underglow, tint, horn).
// Small and always loaded (the garage UI itself lazy-loads from kustoms.js). Original art only, made in code.
// No new textures or shader features: everything reuses the car's existing material types and only changes
// colours/values, all materials and part geometries are cached, so applying a look never rebuilds shaders mid-play.
// Sync: a 4-char base36 code. Presence dn gets 'k'+code after the car/rider part (rules allow 20 chars, max used 19),
// home garages store '.k'+code at the end of each car entry. Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

// ---------------------------------------------------------------- catalog
// cost: null = free basic, { p } = Star Coins, { d } = Diamonds (inventory item ids: letters/_ only, z_ = diamonds)
export const KK = {
  paint: [ // 0 = keep the car's normal colour pick (the 12 free presets live in My Cars / the Paint tab)
    { n: 'Preset colour', hex: null }, { n: 'Candy Apple', hex: '#c3102b', id: 'kk_pa_candy', p: 120 }, { n: 'Mint Fizz', hex: '#7ff0c8', id: 'kk_pa_mint', p: 120 },
    { n: 'Sunset', hex: '#ff6a3d', id: 'kk_pa_sunset', p: 120 }, { n: 'Rose Gold', hex: '#e8a598', id: 'kk_pa_rose', p: 120 }, { n: 'Midnight', hex: '#1e2a78', id: 'kk_pa_night', p: 120 }],
  metal: [{ n: 'Gloss' }, { n: 'Metallic', id: 'kk_metal', p: 200 }],
  rim: [{ n: 'Stock' }, { n: 'Star Spokes', id: 'kk_rim_star', p: 250 }, { n: 'Turbine', id: 'kk_rim_fan', p: 300 }, { n: 'Gold Mesh', id: 'z_kk_rim_gold', d: 80 }, { n: 'Neon Ring', id: 'kk_rim_neon', p: 400 }, { n: 'Steelie' }],
  spoiler: [{ n: 'Stock' }, { n: 'Lip' }, { n: 'Ducktail', id: 'kk_sp_duck', p: 200 }, { n: 'Race Wing', id: 'kk_sp_wing', p: 450 }, { n: 'Twin Wing', id: 'z_kk_sp_twin', d: 120 }],
  decal: [{ n: 'None' }, { n: 'Racing Stripes' }, { n: 'Side Stripe', id: 'kk_dc_side', p: 150 }, { n: 'Lightning', id: 'kk_dc_bolt', p: 300 }, { n: 'Stars', id: 'kk_dc_star', p: 300 }, { n: 'Flames', id: 'z_kk_dc_flame', d: 100 }],
  glow: [{ n: 'Off' }, { n: 'Purple', hex: '#a855f7', id: 'kk_ug_purple', p: 350 }, { n: 'Blue', hex: '#38bdf8', id: 'kk_ug_blue', p: 350 }, { n: 'Green', hex: '#4ade80', id: 'kk_ug_green', p: 350 }, { n: 'Pink', hex: '#f472b6', id: 'kk_ug_pink', p: 350 }, { n: 'Rainbow', hex: '#ff4d6d', id: 'z_kk_ug_rainbow', d: 150 }],
  tint: [{ n: 'Stock' }, { n: 'Light', c: '#3a4f66', o: 0.3 }, { n: 'Dark', c: '#06080d', o: 0.8, id: 'kk_tn_dark', p: 150 }, { n: 'Purple', c: '#3b1a5c', o: 0.64, id: 'kk_tn_purple', p: 200 }],
  horn: [{ n: 'Classic' }, { n: 'Beep Beep' }, { n: 'Duck Quack', id: 'kk_hn_duck', p: 100 }, { n: 'Melody', id: 'kk_hn_tune', p: 200 }, { n: 'Big Truck', id: 'kk_hn_truck', p: 200 }, { n: 'Space Zap', id: 'z_kk_hn_space', d: 60 }],
};
export const KK_KEYS = ['paint', 'metal', 'rim', 'spoiler', 'decal', 'glow', 'tint', 'horn'];
export const KK_ITEMS = KK_KEYS.flatMap((k) => KK[k].filter((o) => o.id).map((o) => ({ ...o, part: k })));
export const blankLook = () => ({ paint: 0, metal: 0, rim: 0, spoiler: 0, decal: 0, glow: 0, tint: 0, horn: 0 });
export async function registerKustomItems() { const cat = await import('../pals/catalog.js');
  cat.addItems(KK_ITEMS.filter((o) => o.p).map((o) => ({ id: o.id, name: '🔧 ' + o.n, kind: 'kustom', p: o.p, r: 'r' })));
  cat.addDiamondItems(KK_ITEMS.filter((o) => o.d).map((o) => ({ id: o.id, name: '🔧 ' + o.n, kind: 'kustom', d: o.d }))); }

// ---------------------------------------------------------------- code (4 base36 chars; '' = stock look)
const b36 = (n) => n.toString(36);
const clampI = (v, n) => { v = v | 0; return v >= 0 && v < n ? v : 0; };
export function normLook(l) { const o = blankLook(); if (l) for (const k of KK_KEYS) o[k] = clampI(l[k], KK[k].length); return o; }
export function lookCode(l) { const o = normLook(l); if (KK_KEYS.every((k) => !o[k])) return '';
  return b36(o.paint * 2 + o.metal) + b36(o.rim * 6 + o.spoiler) + b36(o.decal * 6 + o.glow) + b36(o.tint * 6 + o.horn); }
export function parseLook(s) { s = String(s || ''); if (!/^[0-9a-z]{4}$/.test(s)) return blankLook(); const v = [...s].map((c) => parseInt(c, 36));
  return normLook({ paint: v[0] >> 1, metal: v[0] & 1, rim: Math.floor(v[1] / 6), spoiler: v[1] % 6, decal: Math.floor(v[2] / 6), glow: v[2] % 6, tint: Math.floor(v[3] / 6), horn: v[3] % 6 }); }
// presence dn: '~c' + car(3) [+ 'o' + rider8] [+ 'k' + code4]
export function dnLook(dn) { if (!dn || dn.slice(0, 2) !== '~c') return ''; for (const i of [5, 14]) if (dn[i] === 'k') { const c = dn.slice(i + 1, i + 5); if (/^[0-9a-z]{4}$/.test(c)) return c; } return ''; }
// which priced items a look needs (to check ownership before saving)
export function lookNeeds(l) { const o = normLook(l); return KK_KEYS.map((k) => KK[k][o[k]]).filter((x) => x && x.id); }

// ---------------------------------------------------------------- shared materials (values only; same programs as the car's own)
const MAT = new Map(); const mat = (k, f) => { if (!MAT.has(k)) MAT.set(k, f()); return MAT.get(k); };
const paintFor = (hex, metal) => mat('kp' + hex + metal, () => new THREE.MeshPhysicalMaterial(metal ? { color: hex, metalness: 0.95, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 } : { color: hex, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 }));
const flat = (hex, o = {}) => mat('kf' + hex + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.45, metalness: o.m ?? 0.1, envMapIntensity: o.e ?? 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
const glowStd = (hex) => mat('kg' + hex, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.5, roughness: 0.3 }));
const glowFloor = (hex, op) => mat('ku' + hex + op, () => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
const tintMat = (glass, t) => mat('kt' + t.c + t.o, () => { const m = glass.clone(); m.color.set(t.c); m.opacity = t.o; return m; });
const RAINBOW = []; // rainbow underglow materials, shifted in tickKustoms
export function tickKustoms(now) { if (!RAINBOW.length) return; const h = (now / 2600) % 1; for (const [i, m] of RAINBOW.entries()) m.color.setHSL((h + i * 0.08) % 1, 1, 0.6); }

// ---------------------------------------------------------------- cached part geometry
const GEO = new Map(); const geo = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
const box = (x, y, z) => geo(`b${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (r, h, n = 20) => geo(`c${r.toFixed(3)}|${h.toFixed(3)}|${n}`, () => new THREE.CylinderGeometry(r, r, h, n));
const RIMS = new Map();
function rimTemplate(style, r, w, chrome, trim) { const k = style + '|' + r.toFixed(3) + '|' + w.toFixed(3); if (RIMS.has(k)) return RIMS.get(k);
  const g = new THREE.Group(); const add = (gm, m, f) => { const o = new THREE.Mesh(gm, m); if (f) f(o); g.add(o); return o; }; const axle = (o) => { o.rotation.z = Math.PI / 2; };
  const gold = flat('#f5c542', { m: 1, r: 0.2, e: 1.5 });
  if (style === 1) { add(cyl(r * 0.66, w * 0.8), trim, axle); for (let i = 0; i < 5; i++) add(box(w * 0.24, r * 0.6, r * 0.2), chrome, (o) => { const a = i / 5 * Math.PI * 2; o.rotation.x = a; o.position.set(0, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); }); add(cyl(r * 0.18, w * 1.04, 12), chrome, axle); }
  else if (style === 2) { add(cyl(r * 0.66, w * 0.84), chrome, axle); for (let i = 0; i < 10; i++) add(box(w * 0.9, r * 0.56, r * 0.06), trim, (o) => { const a = i / 10 * Math.PI * 2; o.rotation.set(a, 0, 0.5); o.position.set(0, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); }); add(cyl(r * 0.2, w * 1.04, 12), chrome, axle); }
  else if (style === 3) { add(cyl(r * 0.66, w * 0.82), trim, axle); for (let i = 0; i < 8; i++) for (const t of [-0.35, 0.35]) add(box(w * 0.9, r * 1.24, r * 0.05), gold, (o) => { o.rotation.x = i / 8 * Math.PI + t; }); add(cyl(r * 0.67, w * 0.5), gold, (o) => { axle(o); o.scale.set(1, 0.4, 1); }); add(cyl(r * 0.16, w * 1.04, 12), gold, axle); }
  else if (style === 4) { add(cyl(r * 0.66, w * 0.84), trim, axle); const tg = geo('tr' + r.toFixed(3), () => new THREE.TorusGeometry(r * 0.56, r * 0.05, 8, 28));
    for (const sx of [-1, 1]) add(tg, glowStd('#22d3ee'), (o) => { o.rotation.y = Math.PI / 2; o.position.x = sx * w * 0.4; }); for (let i = 0; i < 6; i++) add(box(w * 0.92, r * 1.0, r * 0.08), chrome, (o) => { o.rotation.x = i / 6 * Math.PI; }); add(cyl(r * 0.16, w * 1.04, 12), chrome, axle); }
  else if (style === 5) { add(cyl(r * 0.64, w * 0.84), flat('#f1f5f9', { m: 0.4, r: 0.35 }), axle); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(cyl(r * 0.08, w * 0.88, 10), trim, (o) => { axle(o); o.position.set(0, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); }); } add(cyl(r * 0.2, w * 1.0, 12), chrome, axle); }
  g.userData.kk = 1; RIMS.set(k, g); return g; }

// ---------------------------------------------------------------- surface probe (once per car model, cached): top height along the length
const PROBE = new Map(); const rc = new THREE.Raycaster(); const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(0, -1, 0);
function probeTop(car) { const c = car.userData.def; const key = c.id + (car.userData.lite ? 'l' : ''); if (PROBE.has(key)) return PROBE.get(key);
  // build a clean un-posed copy of the hit meshes so the probe never depends on the car's pose or chassis bounce
  const ch = car.userData.chassis; const paint = car.userData.paint, glass = car.userData.cab;
  const hits = ch.children.filter((m) => m.isMesh && (m.material === paint || m === glass) && m.geometry.type !== 'TorusGeometry' && m.geometry.type !== 'ConeGeometry').map((m) => { const o = new THREE.Mesh(m.geometry); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); o.userData.glass = m === glass; o.updateMatrixWorld(true); return o; });
  const N = 44, out = []; for (const x of [0, 0.16]) { const row = []; for (let i = 0; i <= N; i++) { const z = -c.L / 2 + (c.L * i) / N; v0.set(x, c.H + 2, z); rc.set(v0, v1); const h = rc.intersectObjects(hits, false)[0]; row.push(h ? { y: h.point.y, glass: h.object.userData.glass, z } : null); } out.push(row); }
  PROBE.set(key, out); return out; }

// ---------------------------------------------------------------- decals (geometry, no textures)
function shapeGeo(pts) { const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))); return new THREE.ShapeGeometry(s); }
function starPts(cx, cy, R) { const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
const SIDE = { // u: 0 = front end of the band -> 1 = rear end, v: 0..1 band height; [polygon, colour key]
  2: [[[[0, 0.52], [1, 0.52], [1, 0.72], [0, 0.72]], 'a'], [[[0.04, 0.8], [0.96, 0.8], [0.96, 0.87], [0.04, 0.87]], 'a']],
  3: [[[[0, 0.62], [0.45, 0.9], [0.42, 0.66], [1, 0.74], [0.55, 0.28], [0.58, 0.52]], 'y']],
  4: [[null, 'y', [0.2, 0.55, 0.32]], [null, 'a', [0.5, 0.6, 0.24]], [null, 'y', [0.78, 0.52, 0.17]]],
  5: [[[[0, 0.12], [0.62, 0.18], [0.36, 0.3], [0.86, 0.42], [0.5, 0.5], [1, 0.62], [0.46, 0.68], [0.72, 0.84], [0, 0.9]], 'o'], [[[0, 0.28], [0.4, 0.3], [0.24, 0.4], [0.58, 0.48], [0.3, 0.55], [0.64, 0.63], [0.28, 0.7], [0, 0.74]], 'y', null, 0.004]],
};
function decalGroup(car, style, light) { const c = car.userData.def, r = c.wr, W = c.Wd; const g = new THREE.Group(); g.userData.kk = 1;
  const col = { a: light ? '#1f2937' : '#f8fafc', y: '#fde047', o: '#fb923c' };
  if (style === 1) { const key = 'st' + c.id + (car.userData.lite ? 'l' : ''); const gm = geo(key, () => { const P = probeTop(car); const pos = [];
      for (const xs of [-0.17, 0.17]) { const row = P[Math.abs(xs) > 0.08 ? 1 : 0]; for (let i = 0; i < row.length - 1; i++) { const a = row[i], b = row[i + 1]; if (!a || !b || a.glass || b.glass || Math.abs(a.y - b.y) > 0.22) continue;
        const ya = a.y + 0.012, yb = b.y + 0.012, x0 = xs - 0.07, x1 = xs + 0.07; pos.push(x0, ya, a.z, x1, yb, b.z, x1, ya, a.z, x0, ya, a.z, x0, yb, b.z, x1, yb, b.z); } }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals(); return gg; });
    g.add(new THREE.Mesh(gm, flat(col.a))); return g; }
  const spec = SIDE[style]; if (!spec) return g;
  const axF = c.L * 0.33, axR = -c.L * 0.32; const zf = axF - r * 1.3, zr = axR + r * 1.3, len = Math.max(0.4, zf - zr); const yb = r * 1.02, bh = Math.max(0.2, Math.min(0.42, c.H * 0.45 - yb));
  for (const s of [1, -1]) spec.forEach(([pts, ck, st, lift], i) => { const key = `dc${style}|${i}|${len.toFixed(2)}|${bh.toFixed(2)}|${s}`;
      const gm = geo(key, () => { const P = pts ? pts.map(([u, v]) => [u * len, v * bh]) : starPts(st[0] * len, st[1] * bh, st[2] * bh * 1.3); const sg = shapeGeo(P.map(([u, v]) => [s < 0 ? -u : u, v]));
        if (s < 0) { const ix = sg.index.array; for (let j = 0; j < ix.length; j += 3) { const t = ix[j]; ix[j] = ix[j + 1]; ix[j + 1] = t; } } return sg; });
      const m = new THREE.Mesh(gm, flat(col[ck])); m.rotation.y = s * Math.PI / 2; m.position.set(s * (W / 2 + 0.036 + (lift || 0)), yb, zf); g.add(m); });
  return g; }

// ---------------------------------------------------------------- spoilers
function spoilerGroup(car, style, paint, trim) { const c = car.userData.def, W = c.Wd; const g = new THREE.Group(); g.userData.kk = 1; if (!style) return g;
  const P = probeTop(car)[0]; let yT = c.H * 0.6; for (let i = 0; i < 6; i++) if (P[i] && !P[i].glass) { yT = P[i].y; break; } const zB = -c.L / 2;
  const add = (gm, m, f) => { const o = new THREE.Mesh(gm, m); f(o); o.castShadow = !car.userData.lite; g.add(o); return o; };
  if (style === 1) add(box(W * 0.78, 0.04, 0.16), paint, (o) => { o.position.set(0, yT + 0.03, zB + 0.12); o.rotation.x = 0.3; });
  else if (style === 2) add(box(W * 0.86, 0.06, 0.32), paint, (o) => { o.position.set(0, yT + 0.06, zB + 0.18); o.rotation.x = 0.38; });
  else { const h = style === 4 ? 0.42 : 0.32; add(box(W * 0.94, 0.05, 0.38), paint, (o) => { o.position.set(0, yT + h, zB + 0.22); o.rotation.x = 0.1; });
    for (const s of [-1, 1]) { add(box(0.05, h, 0.14), trim, (o) => { o.position.set(s * W * 0.3, yT + h / 2, zB + 0.26); }); add(box(0.03, 0.2, 0.42), trim, (o) => { o.position.set(s * W * 0.47, yT + h, zB + 0.22); }); }
    if (style === 4) { add(box(W * 0.9, 0.04, 0.3), paint, (o) => { o.position.set(0, yT + h - 0.17, zB + 0.24); o.rotation.x = 0.14; }); add(box(W * 0.9, 0.02, 0.03), glowStd('#c084fc'), (o) => { o.position.set(0, yT + h + 0.03, zB + 0.03); }); } }
  return g; }

// ---------------------------------------------------------------- underglow (flat additive planes + two glow bars; no lights added)
function glowGroup(car, hex, rainbow) { const c = car.userData.def; const g = new THREE.Group(); g.userData.kk = 1;
  const mIn = rainbow ? (RAINBOW[0] || (RAINBOW[0] = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }))) : glowFloor(hex, 0.6);
  const mOut = rainbow ? (RAINBOW[1] || (RAINBOW[1] = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending }))) : glowFloor(hex, 0.24);
  const bar = rainbow ? (RAINBOW[2] || (RAINBOW[2] = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.5, roughness: 0.3 }))) : glowStd(hex);
  const pl = geo('ugp', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const a = new THREE.Mesh(pl, mIn); a.scale.set(c.Wd * 0.92, 1, c.L * 0.86); a.position.y = -0.03; a.renderOrder = 1; g.add(a);
  const b = new THREE.Mesh(pl, mOut); b.scale.set(c.Wd * 1.5, 1, c.L * 1.12); b.position.y = -0.035; b.renderOrder = 1; g.add(b);
  for (const s of [-1, 1]) { const o = new THREE.Mesh(box(0.03, 0.03, c.L * 0.5), bar); o.position.set(s * (c.Wd / 2 - 0.1), c.wr * 0.42, 0); g.add(o); }
  return g; }

// ---------------------------------------------------------------- apply a look to a car built by buildCar (idempotent; cheap)
export function applyKustom(car, look, mats) { const U = car.userData; if (!U || !U.chassis || !U.def) return; const l = normLook(look); const key = lookCode(l); if (U.kkKey === key) return; U.kkKey = key;
  const M = mats(); const ch = U.chassis; const base = U.paint;
  if (!U.kkPaint) { U.kkPaint = []; ch.traverse((m) => { if (m.isMesh && m.material === base) U.kkPaint.push(m); }); U.kkGlass = []; ch.traverse((m) => { if (m.isMesh && m.material === M.glass()) U.kkGlass.push(m); }); }
  // paint finish
  const hex = KK.paint[l.paint].hex || ('#' + base.color.getHexString()); const pm = l.paint || l.metal ? paintFor(hex, l.metal) : base; for (const m of U.kkPaint) m.material = pm;
  // tint
  const t = KK.tint[l.tint]; const gm = l.tint ? tintMat(M.glass(), t) : M.glass(); for (const m of U.kkGlass) m.material = gm;
  // remove old parts
  for (const o of U.kkParts || []) o.parent && o.parent.remove(o); U.kkParts = [];
  // rims
  for (const w of U.wheels) { const sp = w.sp; if (!w.rim0) w.rim0 = sp.children[1]; const cur = sp.children[1]; const want = l.rim ? rimTemplate(l.rim, U.def.wr, U.def.wr * 0.75 * (U.def.style === 'truck' ? 1.3 : 1), M.chrome(), M.trim()).clone() : w.rim0;
    if (cur !== want) { sp.remove(cur); sp.add(want); } }
  const light = new THREE.Color(hex).getHSL({}).l > 0.68;
  const parts = [spoilerGroup(car, l.spoiler, pm, M.trim()), decalGroup(car, l.decal, light)]; if (l.glow) parts.push(glowGroup(car, KK.glow[l.glow].hex, l.glow === 5));
  for (const p of parts) { if (!p.children.length) continue; ch.add(p); U.kkParts.push(p); }
  U.look = l; }
export function hornOf(look) { return normLook(look).horn; }

// ---------------------------------------------------------------- horns (Web Audio, original little synth sounds)
let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { AC = null; } return AC; };
function tone(a, type, f0, f1, t0, dur, vol = 0.06) { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); o.connect(g); g.connect(a.destination);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.setValueAtTime(vol, t0 + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.02); }
export function playHorn(h, fallback) { if (!h) { if (fallback) fallback(); return; } const a = ac(); if (!a) return; const t = a.currentTime;
  if (h === 1) { for (const d of [0, 0.18]) { tone(a, 'square', 520, 520, t + d, 0.12, 0.05); tone(a, 'square', 650, 650, t + d, 0.12, 0.04); } }
  else if (h === 2) { for (const d of [0, 0.2]) tone(a, 'sawtooth', 900, 480, t + d, 0.16, 0.05); }
  else if (h === 3) { [523, 659, 784, 1047].forEach((f, i) => tone(a, 'triangle', f, f, t + i * 0.11, 0.13, 0.08)); }
  else if (h === 4) { tone(a, 'sawtooth', 170, 165, t, 0.7, 0.05); tone(a, 'sawtooth', 214, 210, t, 0.7, 0.04); }
  else if (h === 5) { for (const d of [0, 0.16]) tone(a, 'sine', 1500, 220, t + d, 0.15, 0.07); } }
