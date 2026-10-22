// Kemy World: the open world attached to Pal Park. Builds Kemy Street (a friendly Halloween trick-or-treat
// neighborhood south of the park) inside Pal Park's scene, so it is one connected world, one room, one multiplayer.
// Houses, fences, yards and decorations are merged / instanced; lights are pooled; far things are culled by distance.
// Knock on doors for candy + Star Coins (per-house cooldown + daily cap, coins through the existing kemy:coins path).
// Kid-safe: nothing scary, cars always stop for people and only ever push gently. Written by Lone Keem.
import { ROADS3, PLAINS, HOUSES, ROADS, SIDEWALK, GATE, PARK_CORNER, STREET, PARK, FLAT, roadD, segD, BOUNDS, ALL_ROADS, areaAt, TOWN_PAL, OLD, GV, WATER, housesNear } from './layout.js';
import { attachCities } from './cities.js';
import { attachMap } from './map.js';
const OLDH = HOUSES.filter((h) => !h.city && !h.estate); // the hand-built houses (the new cities + estates stream in cities.js)
import { attachEast } from './east.js';
import { currentSeason, SEASONS } from '../seasons.js';
const SEASONS_T = Object.fromEntries(Object.values(SEASONS).filter((x) => x.treat).map((x) => [x.treat.id, x.treat]));
import { attachHomes } from './homes.js';
import { attachRespawn } from './respawn.js';
import { buildCar, poseCar, CAR_IDX, CARS } from './cars.js';
import { attachDrive } from './drive.js';
export { worldGround, worldClamp } from './layout.js';

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export const CANDY = [{ id: 'star', name: 'Choco Star', e: '⭐' }, { id: 'moon', name: 'Moon Drop', e: '🌙' }, { id: 'pump', name: 'Pumpkin Chew', e: '🎃' }, { id: 'ghost', name: 'Ghost Gum', e: '👻' },
  { id: 'pop', name: 'Rainbow Pop', e: '🍭' }, { id: 'corn', name: 'Candy Corn Crunch', e: '🌽' }, { id: 'apple', name: 'Caramel Apple', e: '🍎' }, { id: 'bear', name: 'Gummy Pal', e: '🧸' }];
const GREET = ['Happy Halloween! 🎃', 'Ooh, great costume!', 'Here you go, sweetie! 🍬', 'Take two, you earned it!', 'Boo! Just kidding 😄', 'Stay safe out there!', 'What a cute Pal!', 'Trick or treat? Treat!'];
export const KNOCK_CD_MS = 20 * 60 * 1000, KNOCK_DAY_CAP = 15, KNOCK_COINS = 5;

export function attachWorld(api) { const SEA = currentSeason(), HW = SEA.id === 'halloween'; GV.nob = true;
  const { THREE, scene, R, Q, LOW, ULTRA, box, cyl, P, me, view, hint, S, sky, sun, hemi } = api;
  const ground = api.ground; const root = new THREE.Group(); root.name = 'kemy-world'; scene.add(root);
  const det = Q.detail || 1, R0 = rng(4242); const uid = (S.user && S.user.uid) || 'anon';
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.8, metalness: o.m ?? 0, emissive: o.e || '#000', emissiveIntensity: o.ei ?? 1, vertexColors: !!o.vc, ...(o.x || {}) });
  const tmpM = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  // ---------------------------------------------------------------- merged, vertex-coloured geometry batches
  const batches = {}; const batch = (k) => (batches[k] = batches[k] || []); let ptag = null; const tagged = new Map(); // tag 'h02|w' -> [{ m, s, n, orig }] (owner paint)
  function put(k, geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) { const g = geo.index ? geo.toNonIndexed() : geo.clone(); tq.setFromEuler(new THREE.Euler(rx, ry, rz)); tmpM.compose(tv.set(x, y, z), tq, ts.set(sx, sy, sz)); g.applyMatrix4(tmpM);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, c = new Float32Array(n * 3); col.set(color); for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (ptag) g.userData.tg = ptag; batch(k).push(g); }
  function flush(k, material, shadow = true, parent = root) { const gs = batches[k]; if (!gs || !gs.length) return null; let n = 0; gs.forEach((g) => (n += g.attributes.position.count));
    const out = new THREE.BufferGeometry(); for (const [a, s] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) { const arr = new Float32Array(n * s); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, s)); }
    out.computeBoundingSphere(); const m = new THREE.Mesh(out, material); { let v = 0; for (const g of gs) { const c = g.attributes.position.count; if (g.userData.tg) { const L = tagged.get(g.userData.tg) || []; L.push({ m, s: v, n: c, orig: g.attributes.color.array.slice(0, 3) }); tagged.set(g.userData.tg, L); } v += c; } } m.castShadow = shadow && !LOW; m.receiveShadow = true; parent.add(m); gs.forEach((g) => g.dispose()); delete batches[k]; return m; }
  const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12), cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6), prism: new THREE.CylinderGeometry(1, 1, 1, 3), cone4: new THREE.ConeGeometry(0.7071, 1, 4), cone: new THREE.ConeGeometry(0.5, 1, 16), sph: new THREE.SphereGeometry(0.5, 14, 10), plane: new THREE.PlaneGeometry(1, 1) };
  G.plane.rotateX(-Math.PI / 2);
  // symmetric gable roof: ridge along local x (length 1), triangle in y/z (base 1 wide at y = 0, apex at y = 1). Only yaw it:
  // (the old prism + pitch Euler applied the tilt after the yaw, which skewed every roof that didn't face +z)
  G.gable = (() => { const sh = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]); const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2); return g; })();
  G.hip = new THREE.ConeGeometry(0.7071, 1, 4); G.hip.rotateY(Math.PI / 4); // square hip roof, axis-aligned before scaling

  // ---------------------------------------------------------------- ground of the neighborhood (the park terrain stops at z = H + 30)
  { const x0 = OLD.x0, x1 = STREET.x1 + 40, z0 = PARK.H - 20, z1 = OLD.z1; const sx = Math.round((x1 - x0) / (LOW ? 4 : 2.5)), sz = Math.round((z1 - z0) / (LOW ? 4 : 2.5));
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, sx, sz); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2); const p = g.attributes.position, c = new Float32Array(p.count * 3);
    const cA = new THREE.Color('#3f8f3a'), cB = new THREE.Color('#5aa548'), cL = new THREE.Color('#b8862f');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, ground(x, z) - (z < PARK.H + 29 ? 0.06 : 0)); const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + 0.5; col.copy(cA).lerp(cB, n); if (Math.sin(x * 0.7 + z * 0.3) > 0.85) col.lerp(cL, 0.25); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, api.terrainMat || std('#fff', { vc: true, r: 1 })); m.receiveShadow = true; root.add(m); }

  // ---------------------------------------------------------------- roads, sidewalks, crosswalks, lane marks
  { const asphalt = std('#3a3c46', { r: 0.92, vc: true }); const y = FLAT + 0.035;
    for (const r of ROADS) { const [ax, az] = r.a, [bx, bz] = r.b; const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2;
      put('road', G.plane, '#3b3d48', cx, y, cz, ang, r.w, 1, len + r.w);
      for (const s of [-1, 1]) { const ox = Math.cos(ang) * s * (r.w / 2 + SIDEWALK / 2), oz = -Math.sin(ang) * s * (r.w / 2 + SIDEWALK / 2); put('walk', G.box, '#c9c4bb', cx + ox, FLAT + 0.09, cz + oz, ang, SIDEWALK, 0.14, len + r.w + SIDEWALK * 2);
        const kx = Math.cos(ang) * s * (r.w / 2 + 0.06), kz = -Math.sin(ang) * s * (r.w / 2 + 0.06); put('walk', G.box, '#9c968c', cx + kx, FLAT + 0.1, cz + kz, ang, 0.14, 0.18, len); }
      for (let t = 2; t < len - 2; t += 4) { const k = t / len; put('mark', G.plane, '#ffd84a', ax + (bx - ax) * k, y + 0.006, az + (bz - az) * k, ang, 0.16, 1, 2); } }
    // crosswalk stripes at every crossing + the gate path
    const X = [[-64, 100], [64, 100], [0, 100], [-64, 145], [64, 145], [0, 145]];
    for (const [x, z] of X) for (const [dx, dz, rot] of [[0, -6.2, 0], [0, 6.2, 0], [-6.2, 0, Math.PI / 2], [6.2, 0, Math.PI / 2]]) for (let i = -3; i <= 3; i++) put('mark', G.plane, '#f2f2f2', x + dx + (rot ? 0 : i * 1.05), y + 0.007, z + dz + (rot ? i * 1.05 : 0), rot, 0.55, 1, 2.4);
    put('walk', G.box, '#d8cdb8', 0, FLAT + 0.06, (PARK.H - 8 + 96) / 2, 0, 4.5, 0.1, 96 - PARK.H + 8); // path from the park
    // Open Plains country roads: asphalt, dashed yellow centre, white edge lines (merged into the same batches = no extra draw calls)
    for (const r of ROADS3) { const [ax, az] = r.a, [bx, bz] = r.b; const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), cx = (ax + bx) / 2, cz = (az + bz) / 2, dx = (bx - ax) / len, dz = (bz - az) / len;
      put('road', G.plane, '#3b3d48', cx, y - 0.004, cz, ang, r.w, 1, len + r.w);
      for (const s2 of [-1, 1]) put('mark', G.plane, '#e8e8e8', cx - dz * s2 * (r.w / 2 - 0.35), y + 0.005, cz + dx * s2 * (r.w / 2 - 0.35), ang, 0.16, 1, len);
      for (let t = 3; t < len - 3; t += 6) { const k = t / len; put('mark', G.plane, '#ffd84a', ax + (bx - ax) * k, y + 0.006, az + (bz - az) * k, ang, 0.16, 1, 3); } }
    flush('road', asphalt, false); flush('walk', std('#fff', { vc: true, r: 0.85 }), false); flush('mark', std('#fff', { vc: true, r: 0.6 }), false); }

  // ---------------------------------------------------------------- houses (4 original styles, merged by material)
  const WALL = ['#f6e7c8', '#cfe3f0', '#f3d1dc', '#d8ecd0', '#efe0ff', '#ffe2b8', '#e2e8f0', '#f5d0a9'], ROOF = ['#5b3a7a', '#7a3b3b', '#3b4a7a', '#2f5d50', '#6b4a2f', '#4a3a6b'], TRIM = ['#ffffff', '#fff6e0', '#3b2a55'];
  const doors = []; const pumpkins = [], ghosts = [], bulbs = [], hay = [], lamps = [], bats = [];
  for (const h of OLDH) { const r = rng(h.seed * 31 + 7); const TP = h.town && TOWN_PAL[h.town]; const wall = TP ? TP.wall[Math.floor(r() * TP.wall.length)] : WALL[Math.floor(r() * WALL.length)], roof = TP ? TP.roof[Math.floor(r() * TP.roof.length)] : ROOF[Math.floor(r() * ROOF.length)], trim = TRIM[r() < 0.8 ? 0 : 1];
    const f = h.face, x = h.x, z = h.z, y0 = FLAT; const W = h.w, D = h.d; const ry = f > 0 ? 0 : Math.PI; const two = h.style === 1 || h.style === 3; const Hh = two ? 5.6 : 3.4;
    const L = (lx, lz) => [x + (f > 0 ? lx : -lx), z + (f > 0 ? lz : -lz)]; // local (front = +lz) -> world
    const TK = h.town ? '@' + h.town : ''; const P3 = (k, g, c, lx, ly, lz, sx, sy, sz, rot = 0, rx = 0) => { const [wx, wz] = L(lx, lz); ptag = !h.sale ? null : k === 'wall' && c === wall ? h.id + '|w' : k === 'roof' ? h.id + '|r' : k === 'trim' && c === trim ? h.id + '|t' : null; put(k + TK, g, c, wx, y0 + ly, wz, ry + rot, sx, sy, sz, rx); };
    P3('wall', G.box, '#8b8378', 0, 0.2, 0, W + 0.4, 0.4, D + 0.4); // foundation
    P3('wall', G.box, wall, 0, 0.4 + Hh / 2, 0, W, Hh, D);
    if (h.style === 2) { P3('wall', G.box, wall, -W / 2 - 2.2, 0.4 + 1.5, -0.5, 4.4, 3, D - 1); P3('roof', G.hip, roof, -W / 2 - 2.2, 0.4 + 3 + 0.7, -0.5, 5.2, 1.4, D - 0.4); }
    if (h.style === 3) { P3('wall', G.cyl, wall, W / 2 - 0.4, 0.4 + (Hh + 1.6) / 2, D / 2 - 0.6, 2.6, Hh + 1.6, 2.6); P3('roof', G.cone, roof, W / 2 - 0.4, 0.4 + Hh + 1.6 + 1.4, D / 2 - 0.6, 3.4, 2.8, 3.4); }
    // gable roof: triangular prism along x
    { const rh = two ? 2.4 : 2.2; const [wx, wz] = L(0, 0); ptag = h.sale ? h.id + '|r' : null; put('roof' + TK, G.gable, roof, wx, y0 + 0.4 + Hh - 0.05, wz, ry, W + 0.8, rh, D + 1.2); }
    P3('wall', G.box, '#7c4a2a', W / 3, 0.4 + Hh + 1.6, -1, 0.8, 2.2, 0.8); // chimney
    // porch, steps, door frame, windows (glowing warm)
    P3('wall', G.box, '#a08c74', 0, 0.3, D / 2 + 1, 3.2, 0.25, 2); P3('wall', G.box, '#a08c74', 0, 0.12, D / 2 + 2.2, 2.4, 0.22, 0.6);
    for (const sx of [-1.45, 1.45]) P3('trim', G.box, trim, sx, 0.4 + 1.4, D / 2 + 1.8, 0.16, 2.8, 0.16); P3('roof', G.box, roof, 0, 0.4 + 2.85, D / 2 + 1, 3.6, 0.18, 2.4);
    P3('trim', G.box, trim, 0, 0.4 + 1.15, D / 2 + 0.02, 1.5, 2.4, 0.12);
    const wins = two ? [[-W / 3, 1.6], [W / 3, 1.6], [-W / 3, 4.1], [0, 4.1], [W / 3, 4.1]] : [[-W / 3, 1.6], [W / 3, 1.6]];
    for (const [wx, wy] of wins) { P3('glow', G.box, r() < 0.7 ? '#ffd27a' : '#ffb65c', wx, 0.4 + wy, D / 2 + 0.03, 1.3, 1.1, 0.06); P3('trim', G.box, trim, wx, 0.4 + wy - 0.62, D / 2 + 0.08, 1.6, 0.12, 0.2); P3('trim', G.box, trim, wx, 0.4 + wy, D / 2 + 0.06, 0.08, 1.1, 0.08); }
    for (const sx of [-1, 1]) P3('glow', G.box, '#ffcf80', sx * W / 2 + sx * 0.03, 0.4 + 1.6, 0, 0.06, 1.0, 1.2);
    // yard: path, fence with a gap, mailbox, a tree spot
    const yardF = D / 2 + 5.5; P3('walk', G.box, '#d9cfbd', 0, 0.05, (D / 2 + 2.4 + yardF) / 2, 1.4, 0.1, yardF - D / 2 - 2.4);
    if (h.sale) for (const side of [-1, 1]) P3('walk', G.box, '#bdb6aa', side * 3.7, 0.04, D / 2 + 2.75, 3.6, 0.08, 5.4); // driveways (garage bays)
    if (!h.sale) for (const side of [-1, 1]) { const len = W / 2 + 1.2; const cx = side * (1.2 + len / 2); P3('trim', G.box, '#ffffff', cx, 0.75, yardF - 0.2, len, 0.1, 0.08); P3('trim', G.box, '#ffffff', cx, 0.4, yardF - 0.2, len, 0.1, 0.08);
      for (let i = 0; i <= Math.floor(len / 0.5); i++) P3('trim', G.box, '#fbfbfb', side * (1.2 + i * 0.5), 0.5, yardF - 0.2, 0.09, 1.0, 0.06); }
    if (!h.sale) P3('trim', G.box, '#6b4a2f', 2.1, 0.55, yardF - 0.7, 0.12, 1.1, 0.12); if (!h.sale) P3('wall', G.box, f > 0 ? '#7c3aed' : '#2f7fe6', 2.1, 1.2, yardF - 0.7, 0.32, 0.3, 0.55);
    // colliders (house body + porch posts); doors are handled by the knock system
    { const [cx, cz] = L(0, 0); const ex = W / 2 + (h.style === 2 ? 4.4 : 0.1), ez = D / 2 + 0.1; box.push({ x0: cx - ex - (h.style === 2 && f < 0 ? -4.4 + 0 : 0), x1: cx + ex, z0: cz - ez, z1: cz + ez, top: 99, bot: -99 });
      if (h.style === 2) { const b = box[box.length - 1]; if (f > 0) { b.x1 = cx + W / 2 + 0.1; b.x0 = cx - W / 2 - 4.5; } else { b.x0 = cx - W / 2 - 0.1; b.x1 = cx + W / 2 + 4.5; } }
      for (const sx of [-1.45, 1.45]) { const [px, pz] = L(sx, D / 2 + 1.8); cyl.push({ x: px, z: pz, r: 0.12, top: 99 }); }
      if (!h.sale) for (const side of [-1, 1]) { const len = W / 2 + 1.2; const [fx, fz] = L(side * (1.2 + len / 2), yardF - 0.2); box.push({ x0: fx - (f > 0 ? len : len) / 2, x1: fx + len / 2, z0: fz - 0.1, z1: fz + 0.1, top: FLAT + 1.05, bot: -99 }); } }
    ptag = null;
    // door (animated, instanced below), decorations
    { const [dx, dz] = L(0, D / 2 + 0.07); const [hx, hz] = L(-0.7, D / 2 + 0.07); doors.push({ h, x: dx, z: dz, hx, hz, ry, a: 0, want: 0 }); }
    const nP = h.sale ? 2 : 2 + Math.floor(r() * 4 * det); for (let i = 0; i < nP; i++) { const side = i % 2 ? 1 : -1; const [px, pz] = i < 2 ? L(side * 1.1, D / 2 + 2.15 + (i > 1 ? 0.5 : 0)) : L(side * (2 + r() * (W / 2 - 1)), D / 2 + 2.5 + r() * 2.4); pumpkins.push({ x: px, z: pz, s: 0.5 + r() * 0.55, ry: ry + (r() - 0.5) * 0.8 }); }
    if (r() < 0.55 && !h.sale) { const [gx, gz] = L((r() < 0.5 ? -1 : 1) * (W / 2 - 0.5), D / 2 + 3.6); ghosts.push({ x: gx, z: gz, y: 1.4 + r(), ph: r() * TAU }); }
    if (r() < 0.6) for (let i = 0; i < 12; i++) { const [bx, bz] = L(-1.7 + i * 0.31, D / 2 + 2.1); bulbs.push({ x: bx, z: bz, y: 0.4 + 2.72 - Math.sin(i / 11 * Math.PI) * 0.18, c: ['#ff8a1f', '#a855f7', '#4ade80'][i % 3] }); }
    if (r() < 0.45 && !h.sale) { const [hx, hz] = L(-(W / 2 - 1.2), D / 2 + 4.2); hay.push({ x: hx, z: hz, ry: ry }); }
    if (r() < 0.4) { const [bx, bz] = L(0, D / 2 + 3.0); bats.push({ x: bx, z: bz, y: 3.3, ph: r() * TAU }); } }
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#555', emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.4 });
  glowMat.onBeforeCompile = (sh) => { sh.uniforms.gK = api.nightU; sh.fragmentShader = 'uniform float gK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = vColor * (0.35 + gK * 1.6);'); };
  api.nightU = api.nightU || { value: 0 };
  const sidingT = api.proceduralTex ? api.proceduralTex('siding', Q, [1, 1]) : null; const wallMat = std('#fff', { vc: true, r: 0.85 }); if (sidingT) { wallMat.normalMap = sidingT.normalMap; wallMat.normalScale = new THREE.Vector2(0.6, 0.6); }
  const townG = {}; const roofM = std('#fff', { vc: true, r: 0.7 }), trimM = std('#fff', { vc: true, r: 0.55 }), walkM = std('#fff', { vc: true, r: 0.9 });
  for (const t of ['', ...Object.keys(TOWN_PAL)]) { const tk = t ? '@' + t : ''; let par = root; if (!t) { par = townG._street = new THREE.Group(); par.userData.c = [0, 122]; root.add(par); } if (t) { par = townG[t] = new THREE.Group(); const hs = OLDH.filter((h) => h.town === t); par.userData.c = [hs.reduce((a, h) => a + h.x, 0) / hs.length, hs.reduce((a, h) => a + h.z, 0) / hs.length]; root.add(par); }
    flush('wall' + tk, wallMat, true, par); flush('roof' + tk, roofM, true, par); flush('trim' + tk, trimM, true, par); flush('glow' + tk, glowMat, false, par); flush('walk' + tk, walkM, false, par); }
  // instanced front doors (each one can swing open)
  const doorG = new THREE.BoxGeometry(1.2, 2.2, 0.1); doorG.translate(0.6, 1.1, 0); const doorM = new THREE.InstancedMesh(doorG, std('#fff', { r: 0.6 }), doors.length);
  const DCOL = ['#8a3ffc', '#e8434f', '#16a34a', '#2563eb', '#f59e0b', '#7c2d12']; doors.forEach((d, i) => { doorM.setColorAt(i, col.set(DCOL[i % DCOL.length])); });
  function poseDoor(i) { const d = doors[i]; tq.setFromAxisAngle(UP, d.ry - d.a * 1.6); tmpM.compose(tv.set(d.hx, FLAT + 0.42, d.hz), tq, ts.set(1, 1, 1)); doorM.setMatrixAt(i, tmpM); }
  doors.forEach((d, i) => poseDoor(i)); doorM.castShadow = !LOW; root.add(doorM);
  // owner paint (homes/{plot}.decor.ext): recolour the tagged vertex ranges + the instanced front door; null restores
  const paintHouse = (id, ext) => { const c2 = new THREE.Color(); for (const part of ['w', 'r', 't']) for (const R of tagged.get(id + '|' + part) || []) { const a = R.m.geometry.attributes.color; const want = ext && ext[part];
      if (want) c2.set(want); else c2.setRGB(R.orig[0], R.orig[1], R.orig[2]); for (let i = R.s; i < R.s + R.n; i++) a.setXYZ(i, c2.r, c2.g, c2.b); a.needsUpdate = true; }
    const di = doors.findIndex((d) => d.h.id === id); if (di >= 0) { doorM.setColorAt(di, col.set((ext && ext.d) || DCOL[di % DCOL.length])); doorM.instanceColor.needsUpdate = true; } };

  // ---------------------------------------------------------------- jack-o'-lanterns (friendly faces), ghosts, lights, hay, bats
  const faceTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#fff';
    // the face sits around u = 0.25 (front of the sphere): happy eyes + a big smile
    const cx = 64, cy = 60; x.beginPath(); x.moveTo(cx - 22, cy - 6); x.lineTo(cx - 12, cy - 22); x.lineTo(cx - 3, cy - 6); x.fill(); x.beginPath(); x.moveTo(cx + 3, cy - 6); x.lineTo(cx + 12, cy - 22); x.lineTo(cx + 22, cy - 6); x.fill();
    x.beginPath(); x.moveTo(cx - 26, cy + 4); x.quadraticCurveTo(cx, cy + 34, cx + 26, cy + 4); x.quadraticCurveTo(cx, cy + 16, cx - 26, cy + 4); x.fill(); const t = new THREE.CanvasTexture(cv); return t; })();
  const pumpG = (() => { const pts = []; for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; pts.push(new THREE.Vector2(Math.cos(a) * 0.5, Math.sin(a) * 0.42 + 0.42)); } const g = new THREE.LatheGeometry(pts, 32); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const a = Math.atan2(z, x); const k = 1 - 0.07 * Math.pow(Math.abs(Math.cos(a * 4)), 0.5); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); return g; })();
  const pumpMat = new THREE.MeshStandardMaterial({ color: '#ff8a1f', roughness: 0.55, emissive: '#ffb020', emissiveMap: faceTex, emissiveIntensity: 1.5 });
  const pumpIM = new THREE.InstancedMesh(pumpG, pumpMat, pumpkins.length + 40); const stemIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.06, 0.16, 6), std('#4d7c0f'), pumpkins.length + 40);
  const addPumpkin = (p) => { const i = pumpIM.count; tq.setFromAxisAngle(UP, p.ry - Math.PI / 2); tmpM.compose(tv.set(p.x, ground(p.x, p.z) + 0.02, p.z), tq, ts.set(p.s, p.s, p.s)); pumpIM.setMatrixAt(i, tmpM); tmpM.compose(tv.set(p.x, ground(p.x, p.z) + p.s * 0.86, p.z), tq, ts.set(p.s, p.s, p.s)); stemIM.setMatrixAt(i, tmpM); pumpIM.count = stemIM.count = i + 1; };
  pumpIM.count = stemIM.count = 0; pumpkins.forEach(addPumpkin); pumpIM.castShadow = !LOW; root.add(pumpIM, stemIM);
  const ghostG = (() => { const g = new THREE.CapsuleGeometry(0.32, 0.4, 6, 14); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -0.2) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.sin(a * 5) * 0.05); p.setX(i, p.getX(i) * 1.25); p.setZ(i, p.getZ(i) * 1.25); } } g.computeVertexNormals(); return g; })();
  const ghostTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#fbfbff'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#2b1d55';
    for (const ex of [54, 74]) { x.beginPath(); x.ellipse(ex, 52, 6, 9, 0, 0, 7); x.fill(); } x.fillStyle = '#ff9fc3'; for (const ex of [46, 82]) { x.beginPath(); x.ellipse(ex, 66, 6, 3, 0, 0, 7); x.fill(); } x.strokeStyle = '#2b1d55'; x.lineWidth = 3; x.beginPath(); x.arc(64, 64, 7, 0.2, Math.PI - 0.2); x.stroke(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const ghostIM = new THREE.InstancedMesh(ghostG, new THREE.MeshStandardMaterial({ map: ghostTex, roughness: 0.6, emissive: '#d8d4ff', emissiveIntensity: 0.25, transparent: true, opacity: 0.94 }), Math.max(1, ghosts.length)); ghostIM.count = ghosts.length; root.add(ghostIM);
  const bulbIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' }), Math.max(1, bulbs.length)); bulbs.forEach((b, i) => { tmpM.compose(tv.set(b.x, FLAT + b.y, b.z), tq.identity(), ts.set(1, 1, 1)); bulbIM.setMatrixAt(i, tmpM); bulbIM.setColorAt(i, col.set(b.c).multiplyScalar(2)); }); bulbIM.count = bulbs.length; root.add(bulbIM);
  const hayIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.6, 0.7), std('#d9b45a', { r: 1 }), Math.max(1, hay.length * 2)); let hk = 0; for (const h of hay) for (let j = 0; j < 2; j++) { tq.setFromAxisAngle(UP, h.ry + j * 0.2); tmpM.compose(tv.set(h.x + j * 0.2, FLAT + 0.3 + j * 0.6, h.z), tq, ts.set(1, 1, 1)); hayIM.setMatrixAt(hk++, tmpM); } hayIM.count = hk; hayIM.castShadow = !LOW; root.add(hayIM);
  const batG = (() => { const s = new THREE.Shape(); s.moveTo(0, 0.05); s.quadraticCurveTo(0.2, 0.2, 0.42, 0.12); s.quadraticCurveTo(0.34, 0.04, 0.36, -0.04); s.quadraticCurveTo(0.24, 0.02, 0.18, -0.06); s.quadraticCurveTo(0.1, 0, 0, -0.08); s.quadraticCurveTo(-0.1, 0, -0.18, -0.06); s.quadraticCurveTo(-0.24, 0.02, -0.36, -0.04); s.quadraticCurveTo(-0.34, 0.04, -0.42, 0.12); s.quadraticCurveTo(-0.2, 0.2, 0, 0.05); return new THREE.ShapeGeometry(s); })();
  const batIM = new THREE.InstancedMesh(batG, new THREE.MeshBasicMaterial({ color: '#4c3a78', side: THREE.DoubleSide }), Math.max(1, bats.length * 3)); batIM.count = bats.length * 3; root.add(batIM); // paper bat garlands (cute, purple)

  // ---------------------------------------------------------------- street lamps (instanced) + pooled point lights
  for (const r of ROADS) { const [ax, az] = r.a, [bx, bz] = r.b; const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    for (let t = 6; t < len; t += 22) { const k = t / len, s = (Math.floor(t / 22) % 2) ? 1 : -1; const ox = Math.cos(ang) * s * (r.w / 2 + 0.6), oz = -Math.sin(ang) * s * (r.w / 2 + 0.6); const x = ax + (bx - ax) * k + ox, z = az + (bz - az) * k + oz;
      if (lamps.some((l) => Math.hypot(l.x - x, l.z - z) < 9)) continue; lamps.push({ x, z, s, ang }); cyl.push({ x, z, r: 0.14, top: 99 }); } }
  const postIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.11, 4.4, 8), std('#2b2840', { r: 0.4, m: 0.6 }), lamps.length), headIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffe08a', emissiveIntensity: 2.4 }), lamps.length);
  const capIM = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 0.3, 12), std('#2b2840', { r: 0.4, m: 0.6 }), lamps.length);
  lamps.forEach((l, i) => { tmpM.compose(tv.set(l.x, FLAT + 2.2, l.z), tq.identity(), ts.set(1, 1, 1)); postIM.setMatrixAt(i, tmpM); tmpM.compose(tv.set(l.x, FLAT + 4.45, l.z), tq.identity(), ts.set(1, 1, 1)); headIM.setMatrixAt(i, tmpM); tmpM.compose(tv.set(l.x, FLAT + 4.75, l.z), tq.identity(), ts.set(1, 1, 1)); capIM.setMatrixAt(i, tmpM); });
  postIM.castShadow = !LOW; root.add(postIM, headIM, capIM);
  const NPL = LOW ? 0 : Q.tier === 'medium' ? 6 : ULTRA ? 14 : 10; const pls = []; for (let i = 0; i < NPL; i++) { const l = new THREE.PointLight('#ffd58a', 0, 18, 1.6); l.castShadow = false; scene.add(l); pls.push(l); }
  const lightSpots = [...lamps.map((l) => ({ x: l.x, y: FLAT + 4.2, z: l.z, c: '#ffd58a', i: 26 })), ...doors.map((d) => ({ x: d.x, y: FLAT + 2.6, z: d.z + 0, c: '#ffb050', i: 10 }))];

  // ---------------------------------------------------------------- autumn trees (instanced), leaf piles, park corner
  const trees = []; { const r = rng(99); for (const h of OLDH) { if (r() < 0.75) { const s = r() < 0.5 ? -1 : 1; const f = h.face; trees.push({ x: h.x + s * (h.w / 2 + 2), z: h.z + f * (h.d / 2 + 4.4), s: 0.8 + r() * 0.5, c: ['#f97316', '#dc2626', '#facc15', '#84cc16', '#ea580c'][Math.floor(r() * 5)] }); } }
    for (let i = 0; i < 26 * det; i++) { const x = PARK_CORNER.x0 + 3 + r() * (PARK_CORNER.x1 - PARK_CORNER.x0 - 6), z = PARK_CORNER.z0 + 3 + r() * (PARK_CORNER.z1 - PARK_CORNER.z0 - 6); if (Math.hypot(x - 32, z - 122) < 9 || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 5)) continue; trees.push({ x, z, s: 0.9 + r() * 0.6, c: ['#f97316', '#dc2626', '#facc15', '#b45309'][Math.floor(r() * 4)] }); } }
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.3, 3, 8), std('#6b4a2f', { r: 0.9 }), trees.length), leafG = new THREE.IcosahedronGeometry(1.7, Q.phone || LOW ? 0 : 1); { const p = leafG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 3.1 + p.getZ(i) * 2.3) * 0.12; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.85, p.getZ(i) * k); } leafG.computeVertexNormals(); }
  const leafIM = new THREE.InstancedMesh(leafG, std('#fff', { r: 0.8, x: { flatShading: false } }), trees.length * 2), pileIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.8, 10, 6), std('#fff', { r: 1 }), trees.length);
  trees.forEach((t, i) => { tmpM.compose(tv.set(t.x, FLAT + 1.5 * t.s, t.z), tq.identity(), ts.set(t.s, t.s, t.s)); trunkIM.setMatrixAt(i, tmpM); for (let j = 0; j < 2; j++) { tq.setFromAxisAngle(UP, i + j); tmpM.compose(tv.set(t.x + (j ? 0.7 : -0.3) * t.s, FLAT + (3.4 + j * 1.1) * t.s, t.z + (j ? -0.4 : 0.3) * t.s), tq, ts.setScalar(t.s * (j ? 0.75 : 1))); leafIM.setMatrixAt(i * 2 + j, tmpM); leafIM.setColorAt(i * 2 + j, col.set(t.c).offsetHSL(0, 0, j ? 0.05 : 0)); }
    tmpM.compose(tv.set(t.x + 1, FLAT - 0.35, t.z + 0.6), tq.identity(), ts.set(1.3, 0.6, 1)); pileIM.setMatrixAt(i, tmpM); pileIM.setColorAt(i, col.set(t.c).offsetHSL(0, -0.1, -0.08)); cyl.push({ x: t.x, z: t.z, r: 0.35 * t.s, top: 99 }); });
  trunkIM.castShadow = leafIM.castShadow = !LOW; root.add(trunkIM, leafIM, pileIM);
  // street-only decorations ride in the street group, so they are distance-culled with it (not drawn from the far towns)
  for (const o of [pumpIM, stemIM, ghostIM, bulbIM, hayIM, batIM, postIM, headIM, capIM, trunkIM, leafIM, pileIM]) townG._street.add(o);
  // park corner: a gazebo, benches, a pumpkin patch and a big friendly scarecrow-free hay maze ring
  { const cx = 32, cz = 122, y = FLAT; const wood = std('#f3e8ff', { r: 0.6 }), purple = std('#6d28d9', { r: 0.5 }); const g = new THREE.Group(); g.position.set(cx, y, cz); root.add(g);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.4, 8), wood); fl.position.y = 0.2; g.add(fl); box.push({ x0: cx - 3.4, x1: cx + 3.4, z0: cz - 3.4, z1: cz + 3.4, top: y + 0.4, bot: -99 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), wood); p.position.set(Math.cos(a) * 3.7, 1.9, Math.sin(a) * 3.7); g.add(p); cyl.push({ x: cx + Math.cos(a) * 3.7, z: cz + Math.sin(a) * 3.7, r: 0.15, top: 99 }); }
    const rf = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 8), purple); rf.position.y = 4.5; g.add(rf); g.traverse((o) => { if (o.isMesh) { o.castShadow = !LOW; o.receiveShadow = true; } });
    const rr = rng(5); for (let i = 0; i < 22 * det; i++) { const a = rr() * TAU, d = 6 + rr() * 6; addPumpkin({ x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d, s: 0.45 + rr() * 0.9, ry: rr() * TAU }); } }
  // ---------------------------------------------------------------- the Kemy Street gate (Pal Park side) + a sign back to the park
  function signTex(text, bg = '#2b1d55', fg = '#ffd23f') { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192; const x = cv.getContext('2d'); x.fillStyle = bg; x.beginPath(); x.roundRect(8, 8, 1008, 176, 60); x.fill(); x.strokeStyle = '#ff8a1f'; x.lineWidth = 10; x.stroke(); x.fillStyle = fg; x.font = '900 104px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 512, 104); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const gate = new THREE.Group(); gate.position.set(GATE.x, FLAT, GATE.z); root.add(gate);
  { const arch = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.35, 14, 48, Math.PI), new THREE.MeshStandardMaterial({ color: '#ff8a1f', emissive: '#ff6a00', emissiveIntensity: 0.6, roughness: 0.4 })); arch.position.y = 3.2; gate.add(arch);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 3.2, 12), std('#5b21b6', { r: 0.5 })); p.position.set(s * 4.2, 1.6, 0); gate.add(p); cyl.push({ x: GATE.x + s * 4.2, z: GATE.z, r: 0.5, top: 99 }); const pk = new THREE.Mesh(pumpG, pumpMat); pk.scale.setScalar(1.1); pk.position.set(s * 4.2, 3.2, 0); pk.rotation.y = -Math.PI / 2 + (s > 0 ? 0 : 0); gate.add(pk); }
    const portal = new THREE.Mesh(new THREE.CircleGeometry(3.9, 48, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#c084fc', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })); portal.position.y = 3.2; gate.add(portal); gate.userData.portal = portal;
    for (const [rz, txt] of [[0, '🎃 KEMY STREET'], [Math.PI, '🌳 PAL PARK']]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshBasicMaterial({ map: signTex(txt), transparent: true })); s.position.set(0, 8.2, rz ? 0.06 : -0.06); s.rotation.y = rz ? 0 : Math.PI; gate.add(s); }
    // signposts in the neighbourhood
    gate.traverse((o) => { if (o.isMesh) o.castShadow = !LOW; }); }
  // street name signs
  for (const [x, z, t] of [[-61, 103, 'Pumpkin Lane'], [61, 103, 'Lantern Way'], [3, 148, 'Candy Court'], [-61, 142, 'Moonbeam Ave']]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.6), new THREE.MeshBasicMaterial({ map: signTex(t, '#14532d', '#ffffff'), side: THREE.DoubleSide })); s.position.set(x, FLAT + 3.2, z); root.add(s); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 6), std('#4b5563')); p.position.set(x, FLAT + 1.6, z); root.add(p); cyl.push({ x, z, r: 0.08, top: 99 }); }

  // ---------------------------------------------------------------- seasons (js/seasons.js): Halloween decor only in October, other holidays reuse
  // the same spots (pumpkin places, string-light bulbs, the arch banner) with one instanced prop set + light colours
  let seasonFx = null;
  { const pc = SEA.pc || ['#ffffff']; const isPump = SEA.prop === 'pumpkin';
    if (!HW) { ghostIM.count = 0; batIM.count = 0; ghostIM.visible = batIM.visible = false; }
    if (!isPump) { pumpIM.visible = stemIM.visible = false; gate.traverse((o) => { if (o.geometry === pumpG) o.visible = false; }); }
    else if (!HW) { pumpMat.emissiveMap = null; pumpMat.emissive.set('#000000'); pumpMat.color.set(pc[0]); }
    bulbs.forEach((b, i) => bulbIM.setColorAt(i, col.set(HW ? b.c : SEA.lights[i % SEA.lights.length]).multiplyScalar(SEA.respectful ? 1.2 : 2))); if (bulbIM.instanceColor) bulbIM.instanceColor.needsUpdate = true;
    if (!HW) gate.traverse((o) => { if (o.geometry && o.geometry.type === 'TorusGeometry') { o.material = o.material.clone(); o.material.color.set(pc[0]); o.material.emissive.set(pc[0]); o.material.emissiveIntensity = 0.25; } });
    // the arch banner shows the season's text (first sign = street side)
    { let k = 0; gate.traverse((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material.map && k++ === 0 && !HW) o.material.map = signTex(SEA.banner, SEA.respectful ? '#1e293b' : '#2b1d55', '#ffffff'); }); }
    if (!isPump) { const geo = seasonProp(SEA.prop); const im = new THREE.InstancedMesh(geo, std('#fff', { r: 0.6, vc: true, ...(SEA.respectful ? {} : { e: '#000' }) }), pumpkins.length); im.castShadow = !LOW && !Q.phone;
      pumpkins.forEach((p, i) => { tq.setFromAxisAngle(UP, p.ry); const sc = (SEA.prop === 'flag' || SEA.prop === 'banner' ? 1 : 0.8) * (0.8 + p.s * 0.5); tmpM.compose(tv.set(p.x, ground(p.x, p.z), p.z), tq, ts.set(sc, sc, sc)); im.setMatrixAt(i, tmpM); im.setColorAt(i, col.set(pc[i % pc.length])); });
      townG._street.add(im); }
    // fireworks (party days only, never on respectful days) / gentle snow: one pooled Points system each, around the player
    if (SEA.fx && !SEA.respectful) { const N = SEA.fx === 'snow' ? (LOW ? 300 : 700) : (LOW ? 240 : 480); const pos = new Float32Array(N * 3), colA = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(colA, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: SEA.fx === 'snow' ? 0.18 : 0.5, vertexColors: true, transparent: true, depthWrite: false, fog: SEA.fx === 'snow' })); pts.frustumCulled = false; scene.add(pts);
      const R3 = rng(321); let burstT = 0, bi = 0; for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -999; colA[i * 3] = colA[i * 3 + 1] = colA[i * 3 + 2] = 1; }
      seasonFx = { pts, update(dt) { const cx = P.x, cz = P.z;
        if (SEA.fx === 'snow') { for (let i = 0; i < N; i++) { let y = pos[i * 3 + 1]; if (y < FLAT - 1) { pos[i * 3] = cx + (R3() - 0.5) * 60; pos[i * 3 + 2] = cz + (R3() - 0.5) * 60; y = FLAT + 4 + R3() * 18; } pos[i * 3 + 1] = y - dt * (1.2 + (i % 5) * 0.15); pos[i * 3] += Math.sin(y * 0.7 + i) * dt * 0.3; } }
        else { burstT -= dt; if (burstT <= 0) { burstT = 0.9 + R3() * 1.2; const bx = cx + (R3() - 0.5) * 70, bz = cz + 40 + R3() * 50, by = FLAT + 28 + R3() * 18; const c = col.set(SEA.lights[Math.floor(R3() * SEA.lights.length)]); const per = 60;
            for (let j = 0; j < per; j++) { const i = (bi++) % N; const a = R3() * TAU, e = Math.acos(2 * R3() - 1), sp = 9 + R3() * 3; pos[i * 3] = bx; pos[i * 3 + 1] = by; pos[i * 3 + 2] = bz; vel[i * 3] = Math.sin(e) * Math.cos(a) * sp; vel[i * 3 + 1] = Math.cos(e) * sp; vel[i * 3 + 2] = Math.sin(e) * Math.sin(a) * sp; life[i] = 1.6; colA[i * 3] = c.r * 2; colA[i * 3 + 1] = c.g * 2; colA[i * 3 + 2] = c.b * 2; } g.attributes.color.needsUpdate = true; }
          for (let i = 0; i < N; i++) { if (life[i] <= 0) continue; life[i] -= dt; vel[i * 3 + 1] -= 6 * dt; for (let k = 0; k < 3; k++) { vel[i * 3 + k] *= 1 - dt * 1.2; pos[i * 3 + k] += vel[i * 3 + k] * dt; } if (life[i] <= 0) pos[i * 3 + 1] = -999; } }
        g.attributes.position.needsUpdate = true; } }; } }
  function seasonProp(kind) { const parts = []; const P2 = (g, c, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { g = g.index ? g.toNonIndexed() : g; g.scale(sx, sy, sz); g.translate(x, y, z); const n = g.attributes.position.count, a = new Float32Array(n * 3); col.set(c); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g); };
    const W = '#ffffff', G2 = '#9ca3af', GR = '#4d7c0f';
    if (kind === 'heart') { P2(new THREE.SphereGeometry(0.18, 10, 8), W, -0.12, 0.52, 0); P2(new THREE.SphereGeometry(0.18, 10, 8), W, 0.12, 0.52, 0); P2(new THREE.ConeGeometry(0.26, 0.4, 12), W, 0, 0.3, 0, 1, -1, 0.7); P2(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), GR, 0, 0.15, 0); }
    else if (kind === 'egg') P2(new THREE.SphereGeometry(0.22, 12, 10), W, 0, 0.3, 0, 1, 1.35, 1);
    else if (kind === 'shamrock') { for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + Math.PI / 2; P2(new THREE.SphereGeometry(0.15, 8, 6), W, Math.cos(a) * 0.15, 0.55 + Math.sin(a) * 0.15, 0, 1, 1, 0.35); } P2(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), GR, 0, 0.25, 0); }
    else if (kind === 'lantern') { P2(new THREE.SphereGeometry(0.28, 12, 8), W, 0, 0.62, 0, 1, 0.8, 1); P2(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), '#facc15', 0, 0.85, 0); P2(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), '#facc15', 0, 0.39, 0); P2(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5), '#7c2d12', 0, 0.18, 0); }
    else if (kind === 'gift') { P2(new THREE.BoxGeometry(0.5, 0.42, 0.5), W, 0, 0.21, 0); P2(new THREE.BoxGeometry(0.52, 0.44, 0.08), '#fde68a', 0, 0.22, 0); P2(new THREE.BoxGeometry(0.08, 0.44, 0.52), '#fde68a', 0, 0.22, 0); P2(new THREE.TorusGeometry(0.08, 0.025, 6, 12), '#fde68a', 0, 0.48, 0); }
    else if (kind === 'candle') { P2(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 8), W, 0, 0.28, 0); P2(new THREE.SphereGeometry(0.05, 6, 5), '#fbbf24', 0, 0.6, 0, 1, 1.6, 1); P2(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 10), G2, 0, 0.03, 0); }
    else if (kind === 'flag') { P2(new THREE.CylinderGeometry(0.02, 0.025, 1.3, 6), G2, 0, 0.65, 0); P2(new THREE.BoxGeometry(0.55, 0.34, 0.02), W, 0.28, 1.1, 0); for (let k = 0; k < 3; k++) P2(new THREE.BoxGeometry(0.55, 0.05, 0.024), '#b91c1c', 0.28, 0.96 + k * 0.1, 0); P2(new THREE.BoxGeometry(0.22, 0.17, 0.028), '#1e3a8a', 0.12, 1.18, 0); }
    else if (kind === 'banner') { for (const s of [-1, 1]) P2(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), G2, s * 0.45, 0.6, 0); P2(new THREE.BoxGeometry(0.9, 0.36, 0.02), W, 0, 0.95, 0); }
    else if (kind === 'sapling') { P2(new THREE.ConeGeometry(0.26, 0.6, 8), W, 0, 0.55, 0); P2(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6), '#7c4a2a', 0, 0.15, 0); P2(new THREE.CylinderGeometry(0.2, 0.16, 0.12, 10), '#a16207', 0, 0.06, 0); }
    else if (kind === 'star') { P2(new THREE.OctahedronGeometry(0.26, 0), W, 0, 0.75, 0, 1, 1, 0.35); P2(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), G2, 0, 0.3, 0); }
    else { P2(new THREE.SphereGeometry(0.14, 8, 6), W, 0, 0.42, 0, 1, 0.6, 1); P2(new THREE.SphereGeometry(0.05, 6, 4), '#facc15', 0, 0.46, 0); P2(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 4), GR, 0, 0.2, 0); } // flower
    let n = 0; parts.forEach((g) => (n += g.attributes.position.count)); const out = new THREE.BufferGeometry(); for (const [a, sz] of [['position', 3], ['normal', 3], ['color', 3]]) { const arr = new Float32Array(n * sz); let o = 0; for (const g of parts) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, sz)); } return out; }

  // ---------------------------------------------------------------- night sky (blends in as you walk into Kemy Street)
  const SU = sky.material.uniforms; const DAY = { top: SU.top.value.clone(), hor: SU.hor.value.clone(), ground: SU.ground.value.clone(), sunCol: SU.sunCol.value.clone(), cloud: SU.cloud.value, sun: sun.intensity, sunC: sun.color.clone(), hemi: hemi.intensity, hs: hemi.color.clone(), hg: hemi.groundColor.clone(), fog: scene.fog.color.clone(), env: scene.environmentIntensity, exp: R.toneMappingExposure };
  const NIGHT = { top: new THREE.Color('#1c1446'), hor: new THREE.Color('#7a4fb0'), ground: new THREE.Color('#2a2050'), sunCol: new THREE.Color('#e6e9ff'), cloud: 0.25, sun: 0.9, sunC: new THREE.Color('#aab8ff'), hemi: 1.15, hs: new THREE.Color('#9d8cff'), hg: new THREE.Color('#3a3060'), fog: new THREE.Color('#3b2d6b'), env: 0.18, exp: 1.12 };
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshBasicMaterial({ color: '#fff8e1', fog: false, transparent: true, depthWrite: false })); root.add(moon);
  const stars = (() => { const n = LOW ? 300 : 900, p = new Float32Array(n * 3); const r = rng(77); for (let i = 0; i < n; i++) { const a = r() * TAU, e = 0.12 + r() * 1.3; p[i * 3] = Math.cos(a) * Math.cos(e) * 380; p[i * 3 + 1] = Math.sin(e) * 380; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 380; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); })(); stars.frustumCulled = false; root.add(stars);
  let nk = -1; const lerpC = (o, a, b, k) => o.copy(a).lerp(b, k);
  function setNight(k) { if (Math.abs(k - nk) < 0.004) return; nk = k; lerpC(SU.top.value, DAY.top, NIGHT.top, k); lerpC(SU.hor.value, DAY.hor, NIGHT.hor, k); lerpC(SU.ground.value, DAY.ground, NIGHT.ground, k); lerpC(SU.sunCol.value, DAY.sunCol, NIGHT.sunCol, k); SU.cloud.value = DAY.cloud + (NIGHT.cloud - DAY.cloud) * k;
    sun.intensity = DAY.sun + (NIGHT.sun - DAY.sun) * k; lerpC(sun.color, DAY.sunC, NIGHT.sunC, k); hemi.intensity = DAY.hemi + (NIGHT.hemi - DAY.hemi) * k; lerpC(hemi.color, DAY.hs, NIGHT.hs, k); lerpC(hemi.groundColor, DAY.hg, NIGHT.hg, k); lerpC(scene.fog.color, DAY.fog, NIGHT.fog, k);
    scene.environmentIntensity = DAY.env + (NIGHT.env - DAY.env) * k; R.toneMappingExposure = DAY.exp + (NIGHT.exp - DAY.exp) * k; stars.material.opacity = k * 0.9; moon.material.opacity = k; api.nightU.value = k; pumpMat.emissiveIntensity = 0.6 + k * 1.6; headIM.material.emissiveIntensity = 0.6 + k * 2.4; }

  // ---------------------------------------------------------------- NPC cars: parked along the curbs + a few slowly driving the loop
  const cars = []; const PH = !!Q.phone; const NDRIVE = LOW ? 3 : PH || Q.tier === 'medium' ? 4 : 7, NPARK = LOW ? 8 : PH ? 10 : Q.tier === 'medium' ? 14 : 20; // phones: fewer NPC cars
  const LOOP = [[-64, 100], [64, 100], [64, 145], [-64, 145]]; // driven counter-clockwise on the right-hand lane
  const loopLen = LOOP.reduce((s, p, i) => s + Math.hypot(LOOP[(i + 1) % 4][0] - p[0], LOOP[(i + 1) % 4][1] - p[1]), 0);
  const LOOP0 = { pts: LOOP, len: loopLen };
  function loopAt(d, lane, Lp = LOOP0) { const LOOP = Lp.pts, loopLen = Lp.len; d = ((d % loopLen) + loopLen) % loopLen; for (let i = 0; i < LOOP.length; i++) { const a = LOOP[i], b = LOOP[(i + 1) % LOOP.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= l) { const k = d / l, dx = (b[0] - a[0]) / l, dz = (b[1] - a[1]) / l; return { x: a[0] + (b[0] - a[0]) * k - dz * lane, z: a[1] + (b[1] - a[1]) * k + dx * lane, yaw: Math.atan2(dx, dz) }; } d -= l; } return { x: 0, z: 0, yaw: 0 }; }
  { const r = rng(31); const designs = CARS.filter((c) => !c.prem).map((c) => c.id);
    for (let i = 0; i < NDRIVE; i++) { const def = designs[i % designs.length]; const m = buildCar(def, Math.floor(r() * 12), { lite: true, noShadow: LOW || PH }); root.add(m); cars.push({ m, drive: true, d: i * loopLen / NDRIVE, v: 0, vmax: 5 + r() * 2, spin: 0 }); }
    const spots = []; for (const z of [100, 145]) for (let x = -88; x <= 88; x += 9) { if (Math.abs(x + 64) < 9 || Math.abs(x - 64) < 9 || Math.abs(x) < 9) continue; if (HOUSES.some((h) => h.sale && Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 20)) continue; spots.push([x, z + (r() < 0.5 ? -1 : 1) * 2.9]); }
    for (let i = 0; i < NPARK && spots.length; i++) { const [x, z] = spots.splice(Math.floor(r() * spots.length), 1)[0]; const def = designs[Math.floor(r() * designs.length)]; const m = buildCar(def, Math.floor(r() * 12), { lite: true, noShadow: true }); root.add(m); const yaw = (z % 100 < 50 ? (z < 100 ? -1 : 1) : 1) * Math.PI / 2 * (z > (z > 120 ? 145 : 100) ? -1 : 1);
      poseCar(m, { x, y: FLAT, z, yaw }, 0, 0); cars.push({ m, drive: false, x, z, yaw }); const c = m.userData.def; cyl.push({ x, z, r: c.Wd * 0.5, top: FLAT + c.H, car: 1 }); cyl.push({ x: x + Math.sin(yaw) * c.L * 0.3, z: z + Math.cos(yaw) * c.L * 0.3, r: c.Wd * 0.5, top: FLAT + c.H }, { x: x - Math.sin(yaw) * c.L * 0.3, z: z - Math.cos(yaw) * c.L * 0.3, r: c.Wd * 0.5, top: FLAT + c.H }); } }

  // ---------------------------------------------------------------- AI neighbors + trick-or-treaters (Pal rigs, LOD + distance culling)
  const SPEC = ['kemy', 'puppy', 'kitten', 'bunny', 'panda', 'fox', 'penguin', 'duckling', 'frog', 'owl', 'unicorn', 'dragon', 'hamster', 'koala', 'lamb', 'otter'];
  const COST = [{ hat: 'wizard' }, { hat: 'tophat' }, { cape: 'cape' }, {}, { hat: 'beanie' }];
  const NAMES = ['Mimi', 'Toby', 'Pip', 'Luna', 'Ziggy', 'Bea', 'Coco', 'Milo', 'Nori', 'Juno', 'Ollie', 'Kiki', 'Bo', 'Ruby', 'Taro', 'Suki'];
  const bots = []; const NB = LOW ? 12 : Q.phone ? 14 : Q.tier === 'medium' ? 20 : ULTRA ? 32 : 26;
  const WALKS = [[[-90, 96.2], [90, 96.2]], [[90, 103.8], [-90, 103.8]], [[-90, 141.2], [90, 141.2]], [[90, 148.8], [-90, 148.8]], [[-67.8, 104], [-67.8, 141]], [[67.8, 141], [67.8, 104]], [[3.8, 104], [3.8, 141]],
    // townspeople along each town's main street sidewalk
    [[132, 95.2], [236, 95.2]], [[252, 24.8], [346, 24.8]], [[132, 265.2], [236, 265.2]], [[250, 274.8], [354, 274.8]], [[132, 350.2], [236, 350.2]], [[250, 359.8], [354, 359.8]], [[132, 485.2], [354, 485.2]], [[200, 58], [224, 58]], [[110, 503], [370, 503]]];
  function mkBot(i, kind) { const r = rng(1000 + i); const ps = { species: SPEC[i % SPEC.length], name: NAMES[i % NAMES.length], colors: {}, pattern: '', acc: '', outfit: kind === 'tt' ? COST[i % COST.length] : {}, level: 3 + (i % 9) };
    let obj; try { obj = api.palObj(ps, !LOW); } catch { return null; } root.add(obj); const w = WALKS[i % WALKS.length]; const b = { obj, ps, kind, r, seg: w, k: r(), dir: 1, v: kind === 'tt' ? 1.2 + r() * 0.5 : 0.9, t: r() * 100, x: 0, z: 0, yaw: 0, pause: 0, say: '', sayAt: 0, name: ps.name + (kind === 'tt' ? ' 🎃' : ' 🏡') }; return b; }
  for (let i = 0; i < NB; i++) { const b = mkBot(i, i % 3 === 2 ? 'nb' : 'tt'); if (b) { if (Q.phone) b.obj.traverse((c) => { if (c.isMesh) c.castShadow = false; }); bots.push(b); } } // phones: NPC Pals don't cast real shadows (each rig is ~40 meshes = 40 extra shadow draw calls)
  // neighbour at the door (one pooled rig) + candy pop
  const host = (() => { try { const o = api.palObj({ species: 'bear', name: 'Neighbor', colors: {}, outfit: { hat: 'wizard' }, level: 10 }, false); o.visible = false; root.add(o); return o; } catch { return null; } })();
  const candyFx = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: '#ff6fae', emissive: '#ff6fae', emissiveIntensity: 1.2 })); candyFx.visible = false; root.add(candyFx);

  // ---------------------------------------------------------------- HUD: knock button, candy counter + bag, minimap, world picker
  const hud = document.createElement('div'); hud.className = 'ks-hud'; view.appendChild(hud);
  if (!document.getElementById('ks-css')) { const st = document.createElement('style'); st.id = 'ks-css'; st.textContent = `.ks-hud{position:absolute;inset:0;pointer-events:none;z-index:6;font-family:Inter,system-ui,sans-serif}
.ks-act{position:absolute;right:max(16px,env(safe-area-inset-right));bottom:calc(max(18px,env(safe-area-inset-bottom)) + 200px);pointer-events:auto;min-height:44px;max-width:min(62vw,260px);padding:0 14px;border-radius:999px;border:2px solid #fff;background:#ff8a1f;color:#2b1d55;font:900 14px Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.35);z-index:6}
.ks-act[hidden]{display:none}.ks-bagb{position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 134px);left:max(8px,env(safe-area-inset-left));pointer-events:auto;min-width:48px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(43,29,85,.75);color:#fff;font:800 15px Inter,sans-serif;padding:0 12px}
.ks-map{position:absolute;left:max(8px,env(safe-area-inset-left));top:calc(max(8px,env(safe-area-inset-top)) + 180px);width:100px;height:100px;border-radius:50%;border:0;background:rgba(20,12,45,.55);pointer-events:auto}
.ks-panel{position:absolute;inset:0;z-index:12;display:flex;align-items:center;justify-content:center;background:rgba(10,5,30,.6);pointer-events:auto;padding:14px}.ks-card{background:#2b1d55;color:#fff;border-radius:20px;padding:18px;max-width:380px;width:100%;max-height:86vh;overflow:auto}
.ks-card h3{margin:0 0 8px;font-size:20px}.ks-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ks-grid div{background:rgba(255,255,255,.1);border-radius:12px;padding:6px;text-align:center;font-size:12px}.ks-grid b{display:block;font-size:24px}
.ks-card button{min-height:48px;border-radius:12px;border:0;padding:0 16px;font-weight:800;background:#ffd23f;color:#2b1d55;font-size:16px;margin-top:10px}.ks-card .ghost{background:rgba(255,255,255,.15);color:#fff}
.ks-toast{position:absolute;left:50%;top:22%;transform:translate(-50%,0);background:rgba(43,29,85,.9);color:#fff;border-radius:16px;padding:10px 16px;font-weight:800;font-size:16px;text-align:center;opacity:0;transition:opacity .3s;pointer-events:none}.ks-toast.on{opacity:1}
.ks-tag{position:absolute;left:0;top:0;font:800 11px Inter,sans-serif;color:#fff;background:rgba(30,16,60,.55);padding:2px 7px;border-radius:999px;white-space:nowrap;transform:translate(-50%,-100%)}
.ks-bub{position:absolute;left:0;top:0;max-width:180px;background:#fff;color:#2a1458;font:700 13px Inter,sans-serif;padding:6px 10px;border-radius:14px;transform:translate(-50%,-100%);box-shadow:0 3px 10px rgba(0,0,0,.25);text-align:center}
@media (max-height:500px){.ks-bagb{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 112px)}.ks-map{top:calc(max(8px,env(safe-area-inset-top)) + 62px);left:calc(max(8px,env(safe-area-inset-left)) + 172px);width:84px;height:84px}}`; document.head.appendChild(st); }
  hud.innerHTML = `<button type="button" class="ks-act" id="ks-act" hidden></button><button type="button" class="ks-bagb" id="ks-bag" aria-label="Candy bag">🍬 0</button><canvas class="ks-map" id="ks-map" width="184" height="184" aria-label="Map"></canvas><div class="ks-toast" id="ks-toast"></div><div id="ks-tags"></div>`;
  const $ = (s) => hud.querySelector(s); const actB = $('#ks-act'), bagB = $('#ks-bag'), mapC = $('#ks-map'), toastEl = $('#ks-toast'), tagsEl = $('#ks-tags'); const mapX = mapC.getContext('2d');
  const say = (t) => { toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastEl._t); toastEl._t = setTimeout(() => toastEl.classList.remove('on'), 2600); };
  // candy bag (per account, on this device) + knock bookkeeping
  const BK = 'kemy-street-bag-' + uid, KK = 'kemy-street-knock-' + uid; const day = () => Math.floor(Date.now() / 86400000);
  let bag = {}; try { bag = JSON.parse(lsg(BK) || '{}') || {}; } catch { bag = {}; } let kn = {}; try { kn = JSON.parse(lsg(KK) || '{}') || {}; } catch { kn = {}; } if (kn.day !== day()) kn = { day: day(), n: 0, at: kn.at || {} };
  const candyTotal = () => Object.values(bag).reduce((s, v) => s + (v | 0), 0); const paintBag = () => { bagB.textContent = (HW ? '🍬 ' : SEA.treat.e + ' ') + candyTotal(); }; paintBag();
  bagB.onclick = () => { const d = document.createElement('div'); d.className = 'ks-panel'; d.innerHTML = `<div class="ks-card"><h3>${HW ? '🍬 My Candy Bag' : SEA.treat.e + ' My Treat Bag'}</h3><p style="margin:0 0 10px;opacity:.85;font-size:14px">${candyTotal()} treats · ${Math.max(0, KNOCK_DAY_CAP - kn.n)} coin knocks left today</p><div class="ks-grid">${[...CANDY, ...Object.values(SEASONS_T)].filter((c, i, a) => a.findIndex((q) => q.id === c.id) === i && (HW && CANDY.includes(c) || (bag[c.id] | 0) > 0 || c === SEA.treat)).map((c) => `<div><b>${c.e}</b>${c.name}<br>×${bag[c.id] | 0}</div>`).join('')}</div><button type="button" style="width:100%">Close</button></div>`; d.querySelector('button').onclick = () => d.remove(); d.onclick = (e) => { if (e.target === d) d.remove(); }; hud.appendChild(d); };
  let knockAt = null; // { door idx, t }
  function knock(i) { const d = doors[i]; if (knockAt) return; const now = Date.now(); const last = kn.at[d.h.id] || 0;
    if (now - last < KNOCK_CD_MS) { const m = Math.ceil((KNOCK_CD_MS - (now - last)) / 60000); say(`🕒 This neighbor gave you a treat already. Come back in ${m} min!`); return; }
    knockAt = { i, t: 0, given: false }; d.want = 1; actB.hidden = true; try { api.sfx && api.sfx('knock'); } catch { /* */ } }
  function giveCandy(i) { const d = doors[i]; const c = HW ? CANDY[Math.floor(Math.random() * CANDY.length)] : SEA.treat; const n = 1 + Math.floor(Math.random() * 3); bag[c.id] = (bag[c.id] | 0) + n; lss(BK, JSON.stringify(bag)); paintBag();
    kn.at[d.h.id] = Date.now(); let coins = 0; if (kn.n < KNOCK_DAY_CAP) { kn.n++; coins = KNOCK_COINS; dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'park', n: KNOCK_COINS, why: HW ? 'for trick-or-treating' : 'for visiting neighbors' } })); }
    for (const k of Object.keys(kn.at)) if (Date.now() - kn.at[k] > KNOCK_CD_MS) delete kn.at[k]; kn.at[d.h.id] = Date.now(); lss(KK, JSON.stringify(kn));
    const GR2 = HW ? GREET : SEA.greet; say(`${GR2[Math.floor(Math.random() * GR2.length)]}\n+${n} ${c.e} ${c.name}${coins ? ` · +${coins} ⭐ Star Coins` : ' · (daily coin limit reached, candy only)'}`); window.__kw && (window.__kw.knocks = (window.__kw.knocks || 0) + 1); try { dispatchEvent(new CustomEvent('kemy:house-ring', { detail: { plot: d.h.id } })); } catch { /* */ } }
  const placeAct = () => { const c = document.querySelector('.kc-btns'); if (!c) return; const r = c.getBoundingClientRect(); if (!r.height) return; const H = hud.getBoundingClientRect(); const lh = !!document.querySelector('.kc.lh'); const bs = [...c.querySelectorAll('.kc-b')]; const low = bs.length > 3 ? bs[bs.length - 1].getBoundingClientRect() : null; if (low && H.height > H.width && r.top - H.top < H.height * 0.7) { /* narrow phone: cluster reaches the Pal, so sit beside the lone bottom-row button instead */ actB.style.bottom = Math.round(H.bottom - (low.top + low.bottom) / 2 - 22) + 'px'; if (lh) { actB.style.right = 'auto'; actB.style.left = Math.round(low.right - H.left + 10) + 'px'; } else { actB.style.left = 'auto'; actB.style.right = Math.round(H.right - low.left + 10) + 'px'; } return; } actB.style.bottom = Math.round(H.bottom - r.top + 10) + 'px'; if (lh) { actB.style.right = 'auto'; actB.style.left = Math.round(r.left - H.left) + 'px'; } else { actB.style.left = 'auto'; actB.style.right = Math.round(H.right - r.right) + 'px'; } };
  addEventListener('resize', placeAct);
  actB.onclick = () => { const a = actB.dataset.a; if (a && /^k\d+$/.test(a)) knock(+a.slice(1)); else if (api.onAction) api.onAction(a); };
  // tags for bots
  function tag(o, text, x, y, z) {
    if (!o.tagEl) { o.tagEl = document.createElement('div'); o.tagEl.className = 'ks-tag'; o.tagEl.dataset.n = text; o.tagEl.textContent = text; tagsEl.appendChild(o.tagEl); o.bubEl = document.createElement('div'); o.bubEl.className = 'ks-bub'; o.bubEl.hidden = true; tagsEl.appendChild(o.bubEl); }
    else if (o.tagEl.dataset.n !== text) { o.tagEl.dataset.n = text; o.tagEl.textContent = text; }
    tv.set(x, y, z).project(api.cam); const vis = tv.z < 1 && Math.abs(tv.x) < 1.05 && Math.abs(tv.y) < 1.05;
    const disp = vis ? '' : 'none'; if (o.tagEl.style.display !== disp) o.tagEl.style.display = disp; if (!vis) { if (!o.bubEl.hidden) o.bubEl.hidden = true; return; }
    const w = view.clientWidth, h = view.clientHeight, px = (tv.x + 1) / 2 * w, py = (1 - tv.y) / 2 * h;
    const tf = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px) translate(-50%,-100%)`; if (o.tagEl.style.transform !== tf) o.tagEl.style.transform = tf;
    const show = o.say && Date.now() - o.sayAt < 5000; if (o.bubEl.hidden !== !show) o.bubEl.hidden = !show; if (show) { if (o.bubEl.textContent !== o.say) o.bubEl.textContent = o.say; const bf = `translate(${px.toFixed(0)}px,${(py - 22).toFixed(0)}px) translate(-50%,-100%)`; if (o.bubEl.style.transform !== bf) o.bubEl.style.transform = bf; } }
  const hideTag = (o) => { if (o.tagEl) { o.tagEl.style.display = 'none'; o.bubEl.hidden = true; } };
  const BOTSAY = ['Trick or treat! 🎃', 'Love your costume!', 'Want to trade candy? 🍬', 'Wheee!', 'Happy Halloween!', 'Let’s go to the gazebo!', 'My bag is so full 😄', 'Boo! 👻 hehe'];

  // ---------------------------------------------------------------- minimap
  function drawMap() { const S2 = 184; const RM = W.navOn && W.navOn() ? 130 : 200; const x0 = P.x - RM, x1 = P.x + RM, z0 = P.z - RM, z1 = P.z + RM; /* centred on me (the world is big now) */ const sc = S2 / Math.max(x1 - x0, z1 - z0); const mx = (x) => (x - x0) * sc + (S2 - (x1 - x0) * sc) / 2, mz = (z) => (z - z0) * sc;
    /* heading-up: the map turns with me / my car, so 'ahead' is always up */ const yaw = W.heading ? W.heading() : P.yaw || 0; const th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    mapX.clearRect(0, 0, S2, S2); mapX.save(); mapX.beginPath(); mapX.arc(S2 / 2, S2 / 2, S2 / 2 - 2, 0, 7); mapX.clip(); mapX.fillStyle = 'rgba(30,60,40,.7)'; mapX.fillRect(0, 0, S2, S2); mapX.translate(S2 / 2, S2 / 2); mapX.rotate(th); mapX.translate(-S2 / 2, -S2 / 2); mapX.fillStyle = '#3fa7d6'; for (const w of WATER) mapX.fillRect(mx(w.x0), mz(w.z0), (w.x1 - w.x0) * sc, (w.z1 - w.z0) * sc); if (W.mapExtra) W.mapExtra(mapX, mx, mz, sc); mapX.fillStyle = 'rgba(80,160,80,.55)'; mapX.fillRect(mx(-PARK.W), mz(-PARK.H), PARK.W * 2 * sc, PARK.H * 2 * sc); mapX.fillStyle = 'rgba(70,50,120,.6)'; mapX.fillRect(mx(STREET.x0), mz(STREET.z0), (STREET.x1 - STREET.x0) * sc, (STREET.z1 - STREET.z0) * sc);
    for (const r of ALL_ROADS()) { mapX.strokeStyle = r.hw ? '#fbbf24' : '#e7e5e4'; mapX.lineWidth = r.hw ? 4 : 2.5; mapX.beginPath(); mapX.moveTo(mx(r.a[0]), mz(r.a[1])); mapX.lineTo(mx(r.b[0]), mz(r.b[1])); mapX.stroke(); }
    mapX.fillStyle = '#ff8a1f'; for (const h of housesNear(P.x, P.z, RM)) mapX.fillRect(mx(h.x) - 1, mz(h.z) - 1, 2, 2); if (W.mapRoute) W.mapRoute(mapX, mx, mz); if (W.mapLabels) W.mapLabels(mapX, mx, mz);
    mapX.fillStyle = '#7dd3fc'; for (const o of api.others.values()) { if (o.x > 392) continue; mapX.beginPath(); mapX.arc(mx(o.x), mz(o.z), 3, 0, 7); mapX.fill(); }
    mapX.restore(); const c2 = S2 / 2; mapX.fillStyle = '#ffd23f'; mapX.strokeStyle = '#111'; mapX.lineWidth = 2; mapX.beginPath(); mapX.moveTo(c2, c2 - 13); mapX.lineTo(c2 + 9, c2 + 9); mapX.lineTo(c2, c2 + 4); mapX.lineTo(c2 - 9, c2 + 9); mapX.closePath(); mapX.fill(); mapX.stroke();
    { const nx = c2 + Math.cos(th - Math.PI / 2) * (c2 - 14), ny = c2 + Math.sin(th - Math.PI / 2) * (c2 - 14); mapX.fillStyle = '#fff'; mapX.beginPath(); mapX.arc(nx, ny, 10, 0, 7); mapX.fill(); mapX.fillStyle = '#b91c1c'; mapX.font = '800 13px system-ui'; mapX.textAlign = 'center'; mapX.textBaseline = 'middle'; mapX.fillText('N', nx, ny + 1); }
    mapX.strokeStyle = 'rgba(255,255,255,.85)'; mapX.lineWidth = 4; mapX.beginPath(); mapX.arc(c2, c2, c2 - 2, 0, 7); mapX.stroke(); }
  mapC.onclick = () => { if (W.openMap) W.openMap(); };

  // ---------------------------------------------------------------- per-frame update
  let lightT = 0, mapT = 0, cullT = 0; const peds = () => { const out = [{ x: P.x, z: P.z }]; for (const o of api.others.values()) out.push({ x: o.x, z: o.z }); for (const b of bots) out.push({ x: b.x, z: b.z }); return out; };
  const titleEl = view.querySelector('.p3-top b'); let area = '';
  function update(dt, now) { const tt = now / 1000; const inS = P.z > PARK.H - 14 && P.x < 392 ? sstep(PARK.H - 16, PARK.H + 14, P.z) * (1 - sstep(104, 124, P.x)) * (1 - sstep(PLAINS.z0 - 14, PLAINS.z0 + 8, P.z)) * (SEA.night ? 1 : 0) : 0; if (seasonFx) seasonFx.update(dt); setNight(inS);
    const ar = HW ? areaAt(P.x, P.z) : areaAt(P.x, P.z).replace('🎃', '🏡'); if (ar !== area && titleEl) { area = ar; titleEl.textContent = ar; }
    const cp = api.cam.position; moon.position.set(cp.x - 120, cp.y + 160, cp.z + 260); moon.lookAt(cp); stars.position.copy(cp); const near = P.z > PARK.H - 40;
    root.visible = true; // culling per object below
    if (now - cullT > 400) { cullT = now; const far = Q.draw * 0.75; for (const g of Object.values(townG)) g.visible = Math.hypot(g.userData.c[0] - P.x, g.userData.c[1] - P.z) < (g === townG._street ? Q.draw * 0.6 + 60 : Q.draw + 70); for (const c of cars) { const x = c.drive ? c.m.position.x : c.x, z = c.drive ? c.m.position.z : c.z; c.m.visible = Math.hypot(x - P.x, z - P.z) < (c.drive ? far : Math.min(far, Q.phone ? 60 : 110)); } }
    // pooled lights -> nearest lamps / porches
    if (NPL && (lightT += dt) > 0.5 && inS > 0.05) { lightT = 0; const s = lightSpots.map((l) => [l, (l.x - P.x) ** 2 + (l.z - P.z) ** 2]).sort((a, b) => a[1] - b[1]); pls.forEach((pl, i) => { const l = s[i] && s[i][0]; if (!l) return; pl.position.set(l.x, l.y, l.z); pl.color.set(l.c); pl.userData.i = l.i; }); }
    for (const pl of pls) pl.intensity = (pl.userData.i || 0) * inS;
    // ghosts bob, bats flap
    ghosts.forEach((g, i) => { tq.setFromAxisAngle(UP, Math.sin(tt * 0.6 + g.ph) * 0.6); tmpM.compose(tv.set(g.x + Math.sin(tt * 0.5 + g.ph) * 0.4, FLAT + g.y + Math.sin(tt * 1.4 + g.ph) * 0.18, g.z), tq, ts.set(1, 1, 1)); ghostIM.setMatrixAt(i, tmpM); }); ghostIM.instanceMatrix.needsUpdate = true;
    bats.forEach((b, i) => { for (let j = 0; j < 3; j++) { const fl = 1 + Math.sin(tt * 6 + b.ph + j) * 0.25; tq.setFromAxisAngle(UP, 0); tmpM.compose(tv.set(b.x - 1 + j, FLAT + b.y - j % 2 * 0.15, b.z), tq, ts.set(fl, 1, 1)); batIM.setMatrixAt(i * 3 + j, tmpM); } }); batIM.instanceMatrix.needsUpdate = true;
    gate.userData.portal.material.opacity = 0.16 + Math.sin(tt * 2) * 0.08;
    // driving NPC cars: slow, stop for anyone ahead, never touch people
    const ppl = peds(); for (const c of cars) { if (!c.drive) continue; const Lp = c.L || LOOP0, ln = c.lane || -2, loopLen = Lp.len; if (c.L && !c.m.visible && Math.hypot(c.x - P.x, c.z - P.z) > 120) { c.d += c.vmax * dt; c.x = loopAt(c.d, ln, Lp).x; c.z = loopAt(c.d, ln, Lp).z; continue; }
      const here = loopAt(c.d, ln, Lp); const ahead = loopAt(c.d + 3, ln, Lp); let block = 99;
      for (const p of ppl) { const dx = p.x - here.x, dz = p.z - here.z; const fwd = dx * Math.sin(here.yaw) + dz * Math.cos(here.yaw), lat = Math.abs(dx * Math.cos(here.yaw) - dz * Math.sin(here.yaw)); if (fwd > -1 && fwd < 12 && lat < 2.6) block = Math.min(block, fwd); }
      for (const o of cars) if (o !== c && o.drive && o.L === c.L) { const dd = ((o.d - c.d) % loopLen + loopLen) % loopLen; if (dd > 0 && dd < 9) block = Math.min(block, dd - 3); }
      if (api.myCar && api.myCar()) { const mc = api.myCar(); const dx = mc.x - here.x, dz = mc.z - here.z; const fwd = dx * Math.sin(here.yaw) + dz * Math.cos(here.yaw), lat = Math.abs(dx * Math.cos(here.yaw) - dz * Math.sin(here.yaw)); if (fwd > 0 && fwd < 14 && lat < 3) block = Math.min(block, fwd - 2); }
      const want = block < 3.5 ? 0 : block < 10 ? c.vmax * (block - 3.5) / 6.5 : c.vmax; c.v += clamp(want - c.v, -6 * dt, 1.5 * dt); c.d += c.v * dt; const p = loopAt(c.d, ln, Lp); c.spin += c.v / c.m.userData.def.wr * dt;
      let dy = ahead.yaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yawS = (c.yawS ?? p.yaw) + Math.atan2(Math.sin(p.yaw - (c.yawS ?? p.yaw)), Math.cos(p.yaw - (c.yawS ?? p.yaw))) * Math.min(1, dt * 4);
      if (c.m.visible) poseCar(c.m, { x: p.x, y: ground(p.x, p.z), z: p.z, yaw: c.yawS, pitch: c.v < 1 && want === 0 ? 0.01 : 0 }, dy * 0.8, c.spin); c.x = p.x; c.z = p.z; c.yaw = c.yawS; }
    // gentle push: if anything car-shaped overlaps me, slide me aside (never damage)
    for (const c of cars) if (c.drive && c.m.visible) { const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz); if (d < 2.2 && d > 0.01) { P.x += dx / d * (2.2 - d) * 0.3; P.z += dz / d * (2.2 - d) * 0.3; } }
    // bots
    const bt = api.beatNow ? api.beatNow() : { beat: 0 }; for (const b of bots) { const [a, c] = b.seg; const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (b.pause > 0) b.pause -= dt; else { let blocked = false; for (const p of ppl) if (p.x !== b.x && Math.hypot(p.x - b.x, p.z - b.z) < 0.9) blocked = true; if (!blocked) b.k += b.dir * b.v * dt / L; if (b.k > 1 || b.k < 0) { b.dir *= -1; b.k = clamp(b.k, 0, 1); } if (Math.random() < dt * 0.04) { b.pause = 2 + Math.random() * 3; if (Math.random() < 0.5) { { const L2 = HW ? BOTSAY : SEA.greet.concat(['Nice day for a walk!', 'Love your Pal!', 'Let’s go to the gazebo!']); b.say = L2[Math.floor(Math.random() * L2.length)]; } b.sayAt = Date.now(); } } }
      const nx = a[0] + (c[0] - a[0]) * b.k, nz = a[1] + (c[1] - a[1]) * b.k; const mv = Math.hypot(nx - b.x, nz - b.z) / Math.max(dt, 1e-3); if (mv > 0.05) b.yaw = Math.atan2(nx - b.x, nz - b.z); b.x = nx; b.z = nz;
      const d = Math.hypot(b.x - P.x, b.z - P.z); b.obj.visible = d < (LOW ? 45 : Q.phone ? 38 : 80); if (!b.obj.visible) { hideTag(b); continue; }
      b.obj.position.set(b.x, ground(b.x, b.z), b.z); b.obj.rotation.y = b.yaw; b.t += dt * 60; const nr = d < (LOW ? 14 : 26); b.n = (b.n || 0) + 1;
      if (nr || b.n % 4 === 0) { const g = api.gaitFor(b.obj, b.pause > 0 ? 0 : b.v, false); const st = b.pause > 0 ? { mode: 'idle', t: b.t, dt60: dt * 60 * (nr ? 1 : 4) } : { mode: 'walk', t: b.t, dt60: dt * 60 * (nr ? 1 : 4), speed: g.speed, cadence: g.cadence, stride: g.stride }; if (b.pause > 0 && b.kind === 'tt' && b.sayAt && Date.now() - b.sayAt < 3000) { st.dance3d = 'wave'; st.beat = bt.beat; st.amt = 1; } api.posePal3D(b.obj.userData.m, st); }
      if (d < 30) tag(b, b.name, b.x, ground(b.x, b.z) + 1.85, b.z); else hideTag(b); }
    // doors + knocking
    let best = -1, bd = 2.6; if (!api.driving || !api.driving()) for (let i = 0; i < doors.length; i++) { const d = doors[i]; const dd = Math.hypot(d.x - P.x, d.z - P.z); if (dd < bd) { bd = dd; best = i; } }
    const lockedHouse = (i) => api.houseLocked && api.houseLocked(doors[i].h.id);
    if (!knockAt) { if (actB.hidden) placeAct(); const extra = api.prompt && api.prompt(); if (extra) { actB.hidden = false; actB.textContent = extra.label; actB.dataset.a = extra.id; } else if (best >= 0 && !lockedHouse(best)) { actB.hidden = false; actB.textContent = '🚪 Knock'; actB.dataset.a = 'k' + best; } else actB.hidden = true; }
    for (let i = 0; i < doors.length; i++) { const d = doors[i]; if (Math.abs(d.a - d.want) > 0.001) { d.a += clamp(d.want - d.a, -dt * 1.6, dt * 1.6); poseDoor(i); doorM.instanceMatrix.needsUpdate = true; } }
    if (knockAt) { knockAt.t += dt; const d = doors[knockAt.i]; const fx = Math.sin(d.ry), fz = Math.cos(d.ry);
      if (host) { host.visible = knockAt.t > 0.6; host.position.set(d.x - fx * 0.6 + fx * Math.min(0.9, (knockAt.t - 0.6) * 1.2), FLAT + 0.42, d.z - fz * 0.6 + fz * Math.min(0.9, (knockAt.t - 0.6) * 1.2)); host.rotation.y = d.ry; host.userData.t = (host.userData.t || 0) + dt * 60; api.posePal3D(host.userData.m, { mode: 'idle', t: host.userData.t, dt60: dt * 60, dance3d: knockAt.t > 1.2 ? 'wave' : '', beat: tt * 2, amt: 1 }); }
      if (knockAt.t > 1.4 && !knockAt.given) { knockAt.given = true; giveCandy(knockAt.i); candyFx.visible = true; }
      if (candyFx.visible) { const k = clamp((knockAt.t - 1.4) / 0.8, 0, 1); candyFx.position.set(d.x + fx * (0.8 + k * 0.8), FLAT + 1.6 + Math.sin(k * Math.PI) * 1.2, d.z + fz * (0.8 + k * 0.8)); candyFx.rotation.y += dt * 6; if (k >= 1) candyFx.visible = false; }
      if (knockAt.t > 3.4) d.want = 0; if (knockAt.t > 4.4) { if (host) host.visible = false; knockAt = null; } }
    if ((mapT += dt) > 0.25) { mapT = 0; drawMap(); }
    window.__kw = Object.assign(window.__kw || {}, { season: SEA.id, night: nk, bots: bots.length, cars: cars.length, houses: HOUSES.length, candy: candyTotal(), coinKnocks: kn.n, nearDoor: best }); }
  function spawnStreet() { P.x = GATE.x + (Math.random() - 0.5) * 3; P.z = GATE.z + 6 + Math.random() * 3; P.yaw = 0; P.y = ground(P.x, P.z); }
  function destroy() { hud.remove(); pls.forEach((l) => scene.remove(l)); for (const k of ['top', 'hor', 'ground', 'sunCol']) SU[k].value.copy(DAY[k]); }
  window.__kwApi = { knock: (i) => knock(i), doors: () => doors.map((d) => ({ id: d.h.id, x: d.x, z: d.z })) };
  const W = { update: null, paintHouse, spawnStreet, destroy: null, doors, cars, bots, root, say, hud, setNight, lamps, move: (m) => m, driving: () => false };
  const D = attachDrive(api, W); W.drive = D;
  const E = (() => { try { return attachEast(api, W, { put, flush, G, std, rng, loopAt, cars, glowMat, lightSpots }); } finally { GV.nob = false; } })();
  const Hm = attachHomes(api, W, { put, flush, G, std, rng, doors, glowMat });
  const Rs = attachRespawn(api, W);
  const Ci = attachCities(api, W, { put, flush, G, std, rng, glowMat }); const Mp = attachMap(api, W);
  W.update = (dt, now) => { D.update(dt, now); E.update(dt, now); Ci.update(dt, now); Hm.update(dt, now); Mp.update(dt, now); Rs.update(dt); update(dt, now); };
  W.destroy = () => { for (const x of [D, E, Ci, Hm, Mp, Rs]) try { x.destroy(); } catch { /* */ } destroy(); };
  return W;
}
export const WORLDS = [{ id: 'park', name: 'Pal Park', emoji: '🌳', href: '#/park' }, { id: 'street', name: 'Kemy Street', emoji: '🎃', href: '#/street', tag: 'Halloween' }];
void CAR_IDX; void roadD; void segD;
