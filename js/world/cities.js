// Kemy World big map: six new cities, long highways, bridges over the rivers + the Sparkle Sea, private estates.
// Everything here streams in 100 m chunks around the player (built a chunk at a time, dropped when far away),
// so phones only ever hold the few chunks nearby. No database reads at all (pure layout data). Written by Lone Keem.
import { HOUSES, ROADS4, CITIES, ESTATES, WATER, WATER_Y, BRIDGES, FLAT, OLD, BOUNDS, bigGround, waterD, roadD, isBig, palaceBays } from './layout.js';
const CH = 100, GX0 = -1300, GZ0 = -160;
export const chunkKey = (x, z) => Math.floor((x - GX0) / CH) + ',' + Math.floor((z - GZ0) / CH);
export const Lh = (h, lx, lz) => [h.x + (h.face > 0 ? lx : -lx), h.z + (h.face > 0 ? lz : -lz)];
// Paintable shell of a mansion (body, wings, tower on the big style, columns, trim, roof, front door).
// emit(part, batch, color, lx, yy, lz, sx, sy, sz, shape). part is w/r/t/d so paintHouse can find it. Style 5 adds the tower.
export function tagEstateShell(h, wc, rc, tc, emit) {
  const big = h.style === 5;
  emit('w', 'wall', wc, 0, 4, 0, h.w, 8, h.d, 'box');
  emit('r', 'roof', rc, 0, 7.95, 0, h.w + 1.2, 3.6, h.d + 1.2, 'gable');
  for (const s of [-1, 1]) {
    emit('w', 'wall', wc, s * (h.w / 2 + 3), 2.8, -1, 6, 5.6, h.d - 3, 'box');
    emit('r', 'roof', rc, s * (h.w / 2 + 3), 5.75, -1, 6.4, 0.3, h.d - 2.6, 'box');
    emit('t', 'trim', tc, s * (h.w / 2 + 3), 5.95, -1, 6.5, 0.12, h.d - 2.4, 'box');
  }
  if (big) { emit('w', 'wall', wc, 0, 9.5, 0, 4, 3, 4, 'cyl'); emit('r', 'roof', rc, 0, 12, 0, 4.6, 2.4, 4.6, 'cone'); }
  for (let i = -2; i <= 2; i++) emit('t', 'trim', '#ffffff', i * 2.2, 3.3, h.d / 2 + 2.4, 0.5, 6.6, 0.5, 'cyl');
  emit('t', 'trim', tc, 0, 6.75, h.d / 2 + 2.4, 11, 0.35, 3.2, 'box');
  emit('d', 'trim', '#7c2d12', 0, 1.4, h.d / 2 + 0.06, 2.2, 2.8, 0.12, 'box');
}
// Recolor tagged ranges. A blank part restores the colour the mesh was built with.
export function applyExt(tagged, id, ext, write) {
  for (const part of ['w', 'r', 't', 'd']) for (const R of tagged.get(id + '|' + part) || []) write(R, (ext && ext[part]) || null);
}
export function forgetTagged(tagged, meshes) {
  const drop = meshes instanceof Set ? meshes : new Set(meshes);
  for (const [k, L] of [...tagged]) { const n = L.filter((R) => !drop.has(R.m)); if (n.length !== L.length) { if (n.length) tagged.set(k, n); else tagged.delete(k); } }
}
// estate layout (local frame, +z = toward the road): mansion body, car gallery, forecourt, pool, lot fence
export const estateRoadD = (h) => ({ '-300,18': 34, '-820,18': 34, '-440,604': 44, '-280,604': 44, '-1100,1222': 42, '342,852': 42 }[h.x + ',' + h.z] || 36);
export const GALLERY = { lx: 22, lz: 0, w: 20, dep: 6.6 };

export function attachCities(api, W, K) {
  const { THREE, scene, Q, LOW, box } = api; const { put, flush, G, std, rng } = K; const glowMat = K.glowMat;
  const root = new THREE.Group(); root.name = 'kemy-cities'; scene.add(root);
  const M = { ground: api.terrainMat || std('#fff', { vc: true, r: 1 }), road: std('#fff', { vc: true, r: 0.92 }), wall: std('#fff', { vc: true, r: 0.85 }), roof: std('#fff', { vc: true, r: 0.7 }), trim: std('#fff', { vc: true, r: 0.55 }),
    leaf: std('#fff', { vc: true, r: 0.9 }), glow: glowMat || new THREE.MeshBasicMaterial({ vertexColors: true }), water: new THREE.MeshStandardMaterial({ color: '#3fa7d6', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }) };
  // water: one plane per river / sea piece (cheap: 2 triangles each). The old sea mesh already covers z < 774 east.
  for (const w of WATER) { const z0 = w.id === 'sea' ? 770 : w.z0, x0 = w.x0, x1 = w.x1, z1 = w.z1; const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 16, z1 - z0 + (w.id === 'sea' ? 30 : 16)), M.water); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, WATER_Y - (w.id === 'sea' ? 0.01 : 0), (z0 + z1) / 2 + (w.id === 'sea' ? 8 : 0)); m.renderOrder = 1; root.add(m); }
  // ------------------------------------------------ static per-chunk content lists (computed once)
  const pieces = new Map(); const add = (k, it) => { if (!pieces.has(k)) pieces.set(k, { roads: [], houses: [], bridges: [], signs: [] }); pieces.get(k)[it.t].push(it); };
  for (const r of ROADS4) { const [ax, az] = r.a, [bx, bz] = r.b; const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 50)); for (let i = 0; i < n; i++) { const a = [ax + (bx - ax) * i / n, az + (bz - az) * i / n], b = [ax + (bx - ax) * (i + 1) / n, az + (bz - az) * (i + 1) / n];
    add(chunkKey((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), { t: 'roads', r, a, b, first: i === 0, last: i === n - 1 }); } }
  for (const b of BRIDGES) { const [ax, az] = b.a, [bx, bz] = b.b; const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 50)); for (let i = 0; i < n; i++) { const a = [ax + (bx - ax) * i / n, az + (bz - az) * i / n], c = [ax + (bx - ax) * (i + 1) / n, az + (bz - az) * (i + 1) / n]; add(chunkKey((a[0] + c[0]) / 2, (a[1] + c[1]) / 2), { t: 'bridges', b, a, c }); } }
  for (const h of HOUSES) if (h.city || h.estate) add(chunkKey(h.x, h.z), { t: 'houses', h });
  for (const c of CITIES) add(chunkKey(c.x - c.hx - 4, c.z - c.hz + 12), { t: 'signs', c, x: c.x - c.hx - 4, z: c.z - c.hz + 12 });
  const lotOf = (x, z) => { for (const c of CITIES) if (Math.abs(x - c.x) < c.hx && Math.abs(z - c.z) < c.hz) return true; for (const e of ESTATES) if (Math.abs(x - e.x) < 38 && Math.abs(z - e.z) < 50) return true; return false; };
  const chunks = new Map(); // key -> { g, cols }
  const wallC = (h, r) => { const c = CITIES.find((q) => q.id === h.city); return c ? c.wall[Math.floor(r() * c.wall.length)] : '#f5f5f4'; }, roofC = (h, r) => { const c = CITIES.find((q) => q.id === h.city); return c ? c.roof[Math.floor(r() * c.roof.length)] : '#334155'; };
  function buildChunk(key) { const [ci, cj] = key.split(',').map(Number); const x0 = GX0 + ci * CH, z0 = GZ0 + cj * CH; const g = new THREE.Group(); g.name = 'chunk ' + key; const cols = []; const P = pieces.get(key) || { roads: [], houses: [], bridges: [], signs: [] }; const k = 'ck' + key + ':';
    const col = new THREE.Color(); const big = isBig(x0 + 1, z0 + 1) && isBig(x0 + CH - 1, z0 + CH - 1);
    // ground tile
    if (big) { const n = LOW ? 16 : 28; const gg = new THREE.PlaneGeometry(CH, CH, n, n); gg.rotateX(-Math.PI / 2); gg.translate(x0 + CH / 2, 0, z0 + CH / 2); const p = gg.attributes.position, c = new Float32Array(p.count * 3); const cA = new THREE.Color('#4f9a3f'), cB = new THREE.Color('#6cb350'), cS = new THREE.Color('#d9c38a'), cR = new THREE.Color('#7b8a5a');
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const y = bigGround(x, z); p.setY(i, y - 0.06); const nz = Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5 + 0.5; col.copy(cA).lerp(cB, nz); const wd = waterD(x, z); if (wd < 10) col.lerp(cS, 1 - Math.max(0, wd) / 10); if (y > FLAT + 4) col.lerp(cR, Math.min(1, (y - FLAT - 4) / 10)); c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
      gg.setAttribute('color', new THREE.BufferAttribute(c, 3)); gg.computeVertexNormals(); const m = new THREE.Mesh(gg, M.ground); m.receiveShadow = true; g.add(m); }
    // roads (+ sidewalks on city streets, dashed centre lines, shoulders on highways)
    const y = FLAT + 0.035; for (const R of P.roads) { const { r, a, b } = R; const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[0] - a[0], b[1] - a[1]), cx = (a[0] + b[0]) / 2, cz = (a[1] + b[1]) / 2; const ext = (R.first || R.last) ? r.w : 0.2;
      put(k + 'road', G.plane, r.hw ? '#3a3c46' : '#41434d', cx, y, cz, ang, r.w, 1, len + ext);
      if (r.hw) { for (const s of [-1, 1]) put(k + 'road', G.plane, '#f4f4f5', cx + Math.cos(ang) * s * (r.w / 2 - 0.5), y + 0.004, cz - Math.sin(ang) * s * (r.w / 2 - 0.5), ang, 0.16, 1, len); }
      else if (r.w >= 8) for (const s of [-1, 1]) { const ox = Math.cos(ang) * s * (r.w / 2 + 1.3), oz = -Math.sin(ang) * s * (r.w / 2 + 1.3); put(k + 'road', G.box, '#c9c4bb', cx + ox, FLAT + 0.09, cz + oz, ang, 2.6, 0.14, len + ext); }
      for (let t = 2; t < len - 2; t += r.hw ? 6 : 4) { const q = t / len; put(k + 'road', G.plane, r.hw ? '#ffd84a' : '#f2f2f2', a[0] + (b[0] - a[0]) * q, y + 0.006, a[1] + (b[1] - a[1]) * q, ang, 0.16, 1, r.hw ? 3 : 2); } }
    // bridges: deck, side rails (colliders), pillars down into the water
    for (const B of P.bridges) { const { b, a, c } = B; const len = Math.hypot(c[0] - a[0], c[1] - a[1]), ang = Math.atan2(c[0] - a[0], c[1] - a[1]), cx = (a[0] + c[0]) / 2, cz = (a[1] + c[1]) / 2;
      put(k + 'trim', G.box, '#a8a29e', cx, FLAT - 0.35, cz, ang, b.w + 1.2, 0.7, len); for (const s of [-1, 1]) { const ox = Math.cos(ang) * s * (b.w / 2 + 0.4), oz = -Math.sin(ang) * s * (b.w / 2 + 0.4);
        put(k + 'trim', G.box, '#e7e5e4', cx + ox, FLAT + 0.55, cz + oz, ang, 0.3, 1.1, len); put(k + 'trim', G.box, '#7c3aed', cx + ox, FLAT + 1.12, cz + oz, ang, 0.36, 0.08, len);
        const hx = Math.abs(Math.sin(ang)) > 0.5; const bx = { x0: cx + ox - (hx ? len / 2 : 0.25), x1: cx + ox + (hx ? len / 2 : 0.25), z0: cz + oz - (hx ? 0.25 : len / 2), z1: cz + oz + (hx ? 0.25 : len / 2), top: 99, bot: -99 }; cols.push(bx); }
      for (let t = 6; t < len; t += 18) { const q = t / len; put(k + 'trim', G.box, '#d6d3d1', a[0] + (c[0] - a[0]) * q, FLAT - 3, a[1] + (c[1] - a[1]) * q, ang, b.w * 0.6, 5, 1.4); }
      for (let t = 4; t < len; t += 12) { const q = t / len; for (const s of [-1, 1]) put(k + 'glow', G.cyl, '#fde68a', a[0] + (c[0] - a[0]) * q + Math.cos(ang) * s * (b.w / 2 + 0.4), FLAT + 1.25, a[1] + (c[1] - a[1]) * q - Math.sin(ang) * s * (b.w / 2 + 0.4), 0, 0.22, 0.2, 0.22); } }
    // houses (city styles) + estates (mansions with yards)
    for (const { h } of P.houses) { const r = rng(h.seed * 31 + 11 + h.i); if (h.estate) { buildEstate(k, h, r, cols); continue; } const ry = h.face > 0 ? 0 : Math.PI; const wc = wallC(h, r), rc = roofC(h, r); const Lp = (lx, lz) => Lh(h, lx, lz);
      const two = h.style === 1 || h.style === 3, Hh = two ? 5.8 : 3.1, w = h.style === 2 ? 9.6 : h.w, d = h.d; const [cx, cz] = Lp(0, 0);
      put(k + 'wall', G.box, wc, cx, FLAT + Hh / 2, cz, ry, w, Hh, d); const rh = h.style === 2 ? 1.5 : 2.4; put(k + 'roof', G.gable, rc, cx, FLAT + Hh - 0.05, cz, ry, w + 0.8, rh, d + 1.1);
      if (h.style === 3) { for (const sx of [-2.2, 2.2]) { const [px, pz] = Lp(sx, d / 2 + 1.1); put(k + 'trim', G.cyl, '#f8fafc', px, FLAT + 1.5, pz, 0, 0.3, 3, 0.3); } const [px, pz] = Lp(0, d / 2 + 1.1); put(k + 'trim', G.box, '#f8fafc', px, FLAT + 3.05, pz, ry, 5.4, 0.2, 2.4); }
      const [dx, dz] = Lp(0, d / 2 + 0.05); put(k + 'trim', G.box, ['#7c3aed', '#e8434f', '#16a34a', '#2563eb', '#f59e0b'][h.i % 5], dx, FLAT + 1.1, dz, ry, 1.2, 2.2, 0.1);
      for (const sx of [-2.8, 2.8]) for (const fy of two ? [1.6, 4.3] : [1.6]) { const [wx, wz] = Lp(sx, d / 2 + 0.04); put(k + 'glow', G.box, '#fff1c2', wx, FLAT + fy, wz, ry, 1.3, 1, 0.06); put(k + 'trim', G.box, '#ffffff', wx, FLAT + fy - 0.58, wz, ry, 1.5, 0.12, 0.14); }
      if (two) { const [wx, wz] = Lp(0, d / 2 + 0.04); put(k + 'glow', G.box, '#fff1c2', wx, FLAT + 4.3, wz, ry, 1.1, 0.9, 0.06); }
      { const [cx2, cz2] = Lp(0, d / 2 + 2.2); put(k + 'road', G.box, '#d8cdb8', cx2, FLAT + 0.05, cz2, ry, 1.4, 0.08, 4.2); } // front path
      { const [mx, mz] = Lp(-5.4, d / 2 + 6.8); put(k + 'trim', G.box, '#64748b', mx, FLAT + 0.5, mz, 0, 0.1, 1, 0.1); put(k + 'trim', G.box, ['#2563eb', '#dc2626', '#16a34a'][h.i % 3], mx, FLAT + 1.05, mz, ry, 0.3, 0.3, 0.5); } // mailbox
      if (r() < 0.8) { const s = r() < 0.5 ? -1 : 1; const [tx, tz] = Lp(s * 6.2, -d / 2 - 1.2); tree(k, tx, tz, 0.8 + r() * 0.5, r); }
      const ex = (Math.abs(Math.sin(ry)) > 0.5 ? d : w) / 2 + 0.1, ez = (Math.abs(Math.sin(ry)) > 0.5 ? w : d) / 2 + 0.1; cols.push({ x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez, top: 99, bot: -99 }); }
    // welcome signs
    for (const S of P.signs) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const x = cv.getContext('2d'); x.fillStyle = '#fffbeb'; x.fillRect(0, 0, 512, 160); x.strokeStyle = '#7c3aed'; x.lineWidth = 12; x.strokeRect(6, 6, 500, 148); x.fillStyle = '#111827'; x.textAlign = 'center'; x.font = 'bold 30px system-ui,sans-serif'; x.fillText('Welcome to', 256, 56); x.font = 'bold 52px system-ui,sans-serif'; x.fillText(S.c.name, 256, 118, 480);
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); m.position.set(S.x, FLAT + 2.6, S.z); m.rotation.y = Math.PI / 4; g.add(m); m.userData.tex = t;
      for (const s of [-1, 1]) put(k + 'trim', G.box, '#6b4a2f', S.x + s * 2.1 * Math.cos(Math.PI / 4), FLAT + 1, S.z - s * 2.1 * Math.sin(Math.PI / 4), 0, 0.2, 2, 0.2); }
    // countryside trees (seeded per chunk, away from roads, lots and water)
    if (big) { const r = rng(ci * 977 + cj * 131 + 5); const n = LOW ? 8 : 18; for (let i = 0; i < n; i++) { const x = x0 + r() * CH, z = z0 + r() * CH; if (x < BOUNDS.x0 + 6 || z > BOUNDS.z1 || roadD(x, z) < 7 || waterD(x, z) < 6 || lotOf(x, z)) continue; tree(k, x, z, 0.8 + r() * 0.9, r); cols.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, top: 99, bot: -99 }); } }
    for (const [n2, m] of [['road', M.road], ['wall', M.wall], ['roof', M.roof], ['trim', M.trim], ['leaf', M.leaf], ['glow', M.glow]]) flush(k + n2, m, !LOW && n2 !== 'road' && n2 !== 'glow', g);
    for (const c of cols) box.push(c); root.add(g); chunks.set(key, { g, cols });
    for (const { h } of P.houses) if (h.estate && W.recolorHouse) W.recolorHouse(h.id); }
  function tree(k, x, z, s, r) { const y0 = bigGround(x, z); put(k + 'trim', G.cyl6, '#7c4a2a', x, y0 + 1.1 * s, z, 0, 0.32 * s, 2.2 * s, 0.32 * s); if (r() < 0.5) { put(k + 'leaf', G.cone, ['#2f7d32', '#3f8f3a', '#1f6b3a'][Math.floor(r() * 3)], x, y0 + 3.4 * s, z, 0, 2.6 * s, 3.6 * s, 2.6 * s); }
    else put(k + 'leaf', G.sph, ['#4caf50', '#65a30d', '#f9a8d4', '#fbbf24'][Math.floor(r() * (r() < 0.8 ? 2 : 4))], x, y0 + 3 * s, z, 0, 2.8 * s, 2.4 * s, 2.8 * s); }
  // 🏰 estates: mansion, wings, columns, balcony, lawn, fence + gate, forecourt driveway, fountain, pool, hedges, trees
  function buildEstate(k, h, r, cols) { const ry = h.face > 0 ? 0 : Math.PI; const Lp = (lx, lz) => Lh(h, lx, lz); const big = h.style === 5; const rd = estateRoadD(h);
    const wc = big ? '#fdf6e3' : '#ede9fe', rc = big ? '#1e3a8a' : '#4c1d95', tc = big ? '#d4a017' : '#f8fafc';
    const P = (key, geo, c, lx, yy, lz, sx, sy, sz, rx = 0) => { const [x, z] = Lp(lx, lz); put(k + key, geo, c, x, FLAT + yy, z, ry, sx, sy, sz, rx); };
    if (h.admin) {
      // Lawn stops at the pad. Pad and lip share an edge and sit above the road, so nothing stacks under the sign.
      P('road', G.plane, '#7ccf6b', 0, 0.02, -7.8, 68, 1, 36.4); // local z -26 .. 10.4
      P('road', G.plane, '#d6cfc2', 0, 0.05, 20.5, 66, 1, 20.2); // local z 10.4 .. 30.6
      P('road', G.plane, '#cbbfa8', 0, 0.05, 32.4, 66, 1, 3.6); // local z 30.6 .. 34.2, meets the road tip
    } else {
      P('road', G.plane, '#7ccf6b', -2, 0.012, (rd - 26) / 2, 68, 1, rd + 26); // lawn
      P('road', G.plane, '#d6cfc2', 10, 0.03, (7 + rd) / 2, 44, 1, rd - 7); P('road', G.plane, '#cbbfa8', 0, 0.035, rd - 2, 8, 1, 4); // forecourt + driveway
    }
    const geoOf = { box: G.box, gable: G.gable, cyl: G.cyl, cone: G.cone };
    tagEstateShell(h, wc, rc, tc, (part, key, c, lx, yy, lz, sx, sy, sz, shape) => { if (K.tag) K.tag(h.id + '|' + part); try { const [x, z] = Lp(lx, lz); put(k + key, geoOf[shape], c, x, FLAT + yy, z, ry, sx, sy, sz); } finally { if (K.tag) K.tag(null); } });
    P('trim', G.box, '#ffffff', 0, 0.15, h.d / 2 + 2, 12, 0.3, 4.4);
    P('glow', G.box, '#fde68a', 0, 3.1, h.d / 2 + 0.07, 2.2, 0.4, 0.06);
    for (const lx of [-6.5, -3.6, 3.6, 6.5]) for (const fy of [1.8, 5.4]) { P('glow', G.box, '#fff1c2', lx, fy, h.d / 2 + 0.05, 1.6, 1.6, 0.06); P('trim', G.box, '#ffffff', lx, fy - 0.9, h.d / 2 + 0.08, 1.9, 0.14, 0.18); }
    for (const s of [-1, 1]) for (const fy of [1.8]) P('glow', G.box, '#fff1c2', s * (h.w / 2 + 3), fy, h.d / 2 - 1.45, 2.4, 1.4, 0.06);
    // fountain (front lawn) + pool (back yard) + loungers
    { const fx = h.admin ? 22 : -14, fz = h.admin ? -16 : (7 + rd) / 2; P('trim', G.cyl, '#e7e5e4', fx, 0.35, fz, 6, 0.7, 6); P('glow', G.cyl, '#7dd3fc', fx, 0.72, fz, 5.2, 0.05, 5.2); P('trim', G.cyl, '#e7e5e4', fx, 1.3, fz, 0.6, 1.6, 0.6); P('trim', G.cyl, '#e7e5e4', fx, 2.1, fz, 2, 0.25, 2); P('glow', G.sph, '#bae6fd', fx, 2.6, fz, 0.7, 1, 0.7);
      const [x, z] = Lp(fx, fz); cols.push({ x0: x - 3, x1: x + 3, z0: z - 3, z1: z + 3, top: FLAT + 0.7, bot: -99 }); }
    { P('trim', G.box, '#f5f5f4', -12, 0.1, -16, 14, 0.2, 7.5); P('glow', G.box, '#38bdf8', -12, 0.22, -16, 12, 0.05, 5.8); for (const lx of [-17, -14, -11]) P('trim', G.box, ['#f472b6', '#facc15', '#34d399'][Math.floor(r() * 3)], lx + 1, 0.3, -20.6, 1, 0.25, 2.2); }
    // fence around the lot with a big gate gap at the drive
    const fz0 = -25, fz1 = rd - 1.2, fx = 34; const fence = (ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az); const [x0, z0] = Lp(ax, az), [x1, z1] = Lp(bx, bz); const ang = Math.atan2(x1 - x0, z1 - z0); put(k + 'trim', G.box, '#f8fafc', (x0 + x1) / 2, FLAT + 0.9, (z0 + z1) / 2, ang, 0.08, 0.12, len); put(k + 'trim', G.box, '#f8fafc', (x0 + x1) / 2, FLAT + 0.5, (z0 + z1) / 2, ang, 0.08, 0.12, len);
      for (let t = 0; t <= len; t += 2) put(k + 'trim', G.box, '#f8fafc', x0 + (x1 - x0) * t / len, FLAT + 0.6, z0 + (z1 - z0) * t / len, ang, 0.14, 1.2, 0.14); cols.push({ x0: Math.min(x0, x1) - 0.12, x1: Math.max(x0, x1) + 0.12, z0: Math.min(z0, z1) - 0.12, z1: Math.max(z0, z1) + 0.12, top: FLAT + 1.05, bot: -99 }); };
    fence(-fx, fz0, fx, fz0); fence(-fx, fz0, -fx, fz1); fence(fx, fz0, fx, fz1);
    const gateL = h.admin ? -32 : -6, gateR = h.admin ? 32 : 28; // palace gate is centred so every aisle runs straight out
    fence(-fx, fz1, gateL, fz1); fence(gateR, fz1, fx, fz1);
    for (const s of [gateL, gateR]) { P('trim', G.box, tc, s, 1.1, fz1, 0.6, 2.2, 0.6); P('glow', G.sph, '#fef3c7', s, 2.4, fz1, 0.4, 0.4, 0.4); }
    if (h.admin) {
      for (const b of palaceBays()) { const dir = b.yaw > 0 ? 1 : -1;
        P('trim', G.box, '#f8fafc', b.x - dir * 2.65, 0.07, b.z, 0.08, 0.025, 3.05);
        for (const dz of [-1.55, 1.55]) P('trim', G.box, '#f8fafc', b.x - dir * 0.2, 0.07, b.z + dz, 4.7, 0.025, 0.08); }
      for (const [lx, lz] of [[-33.15, 12.4], [33.15, 12.4], [-33.15, 32.5], [33.15, 32.5]]) { P('trim', G.cyl, '#334155', lx, 1.35, lz, 0.22, 2.6, 0.22); P('glow', G.sph, '#fde68a', lx, 2.75, lz, 0.42, 0.42, 0.42); }
      for (const s of [-1, 1]) { P('trim', G.cyl, '#e7e5e4', s * 7.6, 0.28, 33.3, 0.9, 0.46, 0.9); P('leaf', G.sph, '#166534', s * 7.6, 0.66, 33.3, 0.7, 0.55, 0.7); }
    }
    // hedges + trees (kept off the palace forecourt so the aisles stay open)
    if (!h.admin) for (let lx = -30; lx <= -20; lx += 2.5) P('leaf', G.box, '#166534', lx, 0.6, h.d / 2 + 4, 2.4, 1.2, 1.2);
    for (const [lx, lz] of [[-30, -20], [-30, 0], [30, -20], [-24, 18], [-30, 26]]) { if (lz > fz1 - 2 || (h.admin && lz > 8)) continue; const [x, z] = Lp(lx, lz); tree(k, x, z, 1 + r() * 0.4, r); }
    const [cx, cz] = Lp(0, -1); const ex = (Math.abs(Math.sin(ry)) > 0.5 ? h.d : h.w + 12) / 2, ez = (Math.abs(Math.sin(ry)) > 0.5 ? h.w + 12 : h.d) / 2; cols.push({ x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez, top: 99, bot: -99 }); }
  function dropChunk(key) { const C = chunks.get(key); if (!C) return; if (K.forget) K.forget(C.g); root.remove(C.g); C.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.userData.tex) o.userData.tex.dispose(); }); for (const c of C.cols) { const i = box.indexOf(c); if (i >= 0) box.splice(i, 1); } chunks.delete(key); }
  // ------------------------------------------------ streaming: build the nearest missing chunk (one per frame), drop far ones
  let t = 0; const want = new Set(); let queue = [];
  function plan() { const P = api.P; const R = Math.min(Q.draw + 70, LOW ? 220 : 330); want.clear(); queue = [];
    const i0 = Math.floor((P.x - R - GX0) / CH), i1 = Math.floor((P.x + R - GX0) / CH), j0 = Math.floor((P.z - R - GZ0) / CH), j1 = Math.floor((P.z + R - GZ0) / CH);
    for (let i = Math.max(0, i0); i <= i1; i++) for (let j = Math.max(0, j0); j <= j1; j++) { const cx = GX0 + (i + 0.5) * CH, cz = GZ0 + (j + 0.5) * CH; if (cx > 400 || cz > BOUNDS.z1 + 100) continue; const d = Math.hypot(Math.max(0, Math.abs(cx - P.x) - 50), Math.max(0, Math.abs(cz - P.z) - 50)); if (d > R) continue; const key = i + ',' + j;
      if (!isBig(cx - 49, cz - 49) && !pieces.has(key)) continue; want.add(key); if (!chunks.has(key)) queue.push([d, key]); }
    queue.sort((a, b) => a[0] - b[0]); for (const key of [...chunks.keys()]) if (!want.has(key)) { const [i, j] = key.split(',').map(Number); const cx = GX0 + (i + 0.5) * CH, cz = GZ0 + (j + 0.5) * CH; if (Math.hypot(cx - P.x, cz - P.z) > R + 160) dropChunk(key); } }
  function update(dt) { if (api.P.x > 392) return; t += dt; if (t > 0.5) { t = 0; plan(); } if (queue.length) { const [, key] = queue.shift(); if (!chunks.has(key)) buildChunk(key); }
    window.__kc = { chunks: chunks.size, queued: queue.length }; }
  W.cityChunks = () => chunks.size; W.buildAround = (x, z) => { const P = api.P; const ox = P.x, oz = P.z; P.x = x; P.z = z; plan(); while (queue.length) { const [, key] = queue.shift(); if (!chunks.has(key)) buildChunk(key); } P.x = ox; P.z = oz; };
  return { update, destroy() { for (const k of [...chunks.keys()]) dropChunk(k); scene.remove(root); } };
}
