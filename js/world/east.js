// Kemy World stage 3: the east side. A highway loop around Kemy Downtown, Clover Fields countryside and the
// Sunny Shore beach. Geometry is merged per 64 m chunk and whole chunks are hidden when far (chunked streaming /
// culling); trees, palms, lamps and umbrellas are instanced. NPC cars drive the loop both ways and always stop for
// people. All names and designs are original. Written by Lone Keem.
import { ROADS2, HWY, DOWNTOWN, FIELDS, SHORE, SEA_Y, FLAT, EAST, segD, SNOW, DESERT, LAKE, TOWNS, HOUSES } from './layout.js';
import { buildCar, poseCar, CARS } from './cars.js';

const CH = 64;
export function attachEast(api, W, K) {
  const { THREE, scene, Q, LOW, box, cyl, P } = api; const { put, flush, G, std, rng } = K; const ground = api.ground;
  const root = new THREE.Group(); root.name = 'kemy-east'; scene.add(root); const r = rng(9001);
  const chunks = new Map(); const chunkOf = (x, z) => { const k = Math.floor(x / CH) + ',' + Math.floor(z / CH); if (!chunks.has(k)) { const g = new THREE.Group(); g.userData.c = [(Math.floor(x / CH) + 0.5) * CH, (Math.floor(z / CH) + 0.5) * CH]; root.add(g); chunks.set(k, g); } return k; };
  const keys = new Set(); const P2 = (k, geo, color, x, y, z, ...rest) => { const ck = k + '|' + chunkOf(x, z); keys.add(ck); put(ck, geo, color, x, y, z, ...rest); };
  const tv = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3(), M = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const inRoad = (x, z, pad = 0) => ROADS2.some((rd) => segD(x, z, rd) < rd.w / 2 + pad) || segD(x, z, { a: [98, 100], b: [122, 100] }) < 4 + pad || segD(x, z, { a: [98, 145], b: [122, 145] }) < 4 + pad;

  // ---------------------------------------------------------------- ground (one mesh, vertex coloured by area)
  { const x0 = 96, x1 = 396, z0 = -84, z1 = 532, st = LOW ? 5 : 3; const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.round((x1 - x0) / st), Math.round((z1 - z0) / st)); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const p = g.attributes.position, c = new Float32Array(p.count * 3); const gA = new THREE.Color('#4f9a3e'), gB = new THREE.Color('#6cb04f'), sand = new THREE.Color('#ead39a'), wet = new THREE.Color('#c9ad72'), pave = new THREE.Color('#a9a6a0'), wheat = new THREE.Color('#d9b44a'), soil = new THREE.Color('#8a6a3c'), clover = new THREE.Color('#3f8f46');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, ground(x, z) - (x < 132 ? 0.05 : 0)); const n = Math.sin(x * 0.19) * Math.cos(z * 0.15) * 0.5 + 0.5; col.copy(gA).lerp(gB, n);
      if (x > DOWNTOWN.x0 - 2 && x < DOWNTOWN.x1 + 2 && z > DOWNTOWN.z0 - 2 && z < DOWNTOWN.z1 + 2) col.copy(pave).offsetHSL(0, 0, (Math.floor(x / 2) + Math.floor(z / 2)) % 2 ? 0.02 : -0.02);
      else if (x > FIELDS.x0 && x < FIELDS.x1 && z > FIELDS.z0 && z < FIELDS.z1) { const plot = (Math.floor((x - FIELDS.x0) / 24) * 3 + Math.floor((z - FIELDS.z0) / 30)) % 4; col.copy([wheat, clover, soil, gB][plot]); if (plot !== 3 && Math.sin(z * 2.2) > 0.2) col.offsetHSL(0, 0, -0.05); }
      else if (x > SNOW.x0 && x < SNOW.x1 && z > SNOW.z0 && z < SNOW.z1) col.set('#eef4fb').offsetHSL(0, 0, n * 0.04 - 0.02);
      else if (x > DESERT.x0 && x < DESERT.x1 && z > DESERT.z0 && z < DESERT.z1) { col.set(ground(x, z) > FLAT + 2.5 ? '#b5523b' : '#e3a866'); if (Math.sin(z * 1.3) > 0.7) col.offsetHSL(0, 0, -0.05); }
      else if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) col.lerp(wet, 0.6);
      if (z > SHORE.z0 - 3) col.lerp(sand, Math.min(1, (z - SHORE.z0 + 3) / 4)); if (z > SHORE.sea - 3) col.lerp(wet, Math.min(1, (z - SHORE.sea + 3) / 4));
      c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, api.terrainMat || std('#fff', { vc: true, r: 1 })); m.receiveShadow = true; root.add(m); }
  // sea
  const seaMat = new THREE.MeshStandardMaterial({ color: '#2f9bd6', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.86 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 260, 1, 1), seaMat); sea.rotation.x = -Math.PI / 2; sea.position.set(250, SEA_Y, SHORE.sea + 128); root.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(300, 2.2), new THREE.MeshBasicMaterial({ color: '#f2fbff', transparent: true, opacity: 0.55 })); foam.rotation.x = -Math.PI / 2; foam.position.set(244, SEA_Y + 0.02, SHORE.sea - 1.5); root.add(foam);

  // ---------------------------------------------------------------- roads (highway: 3 lanes worth, dashed white + yellow edges; town roads with sidewalks)
  { const y = FLAT + 0.035;
    for (const rd of ROADS2) { const [ax, az] = rd.a, [bx, bz] = rd.b; const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let t = 0; t < len; t += 32) { const l = Math.min(32, len - t), k = (t + l / 2) / len, cx = ax + (bx - ax) * k, cz = az + (bz - az) * k; P2('road', G.plane, rd.hw ? '#34363f' : '#3b3d48', cx, y + (rd.hw ? 0 : 0.003), cz, ang, rd.w, 1, l + (t === 0 || t + l >= len ? rd.w : 0.01));
        if (rd.hw) for (const s of [-1, 1]) P2('mark', G.plane, '#ffd84a', cx - dz * s * (rd.w / 2 - 0.5), y + 0.006, cz + dx * s * (rd.w / 2 - 0.5), ang, 0.2, 1, l);
        else if (!(rd.id === 'd2' && (cz < DOWNTOWN.z0 - 10 || cz > DOWNTOWN.z1 + 12))) for (const s of [-1, 1]) P2('walk', G.box, '#c9c4bb', cx - dz * s * (rd.w / 2 + 1.3), FLAT + 0.09, cz + dx * s * (rd.w / 2 + 1.3), ang, 2.6, 0.14, l); }
      for (let t = 3; t < len - 3; t += rd.hw ? 7 : 4) { const k = t / len; P2('mark', G.plane, rd.hw ? '#f5f5f5' : '#ffd84a', ax + (bx - ax) * k, y + 0.007, az + (bz - az) * k, ang, 0.18, 1, rd.hw ? 3 : 2); } }
    // highway lamps (instanced, no real lights: it's daytime out east)
    const spots = []; for (const rd of ROADS2.filter((q) => q.hw)) { const [ax, az] = rd.a, [bx, bz] = rd.b; const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len; for (let t = 10; t < len - 6; t += LOW ? 36 : 24) { const x = ax + dx * t - dz * (rd.w / 2 + 1.2), z = az + dz * t + dx * (rd.w / 2 + 1.2); if (inRoad(x, z, 1)) continue; spots.push([x, z, Math.atan2(-dz, dx)]); } }
    const poleG = new THREE.CylinderGeometry(0.09, 0.12, 6, 8); poleG.translate(0, 3, 0); const headG = new THREE.BoxGeometry(1.4, 0.18, 0.4); headG.translate(0.6, 6, 0);
    const poleIM = new THREE.InstancedMesh(poleG, std('#5b6170', { m: 0.6, r: 0.4 }), spots.length), headIM = new THREE.InstancedMesh(headG, std('#fff7d6', { e: '#fff3c4', ei: 0.6 }), spots.length);
    spots.forEach(([x, z, a], i) => { tq.setFromAxisAngle(UP, a); M.compose(tv.set(x, ground(x, z), z), tq, ts.set(1, 1, 1)); poleIM.setMatrixAt(i, M); headIM.setMatrixAt(i, M); cyl.push({ x, z, r: 0.2, top: 99 }); }); root.add(poleIM, headIM); }

  // ---------------------------------------------------------------- Kemy Downtown: friendly towers with lit windows, shops, a plaza
  const SHOPS = ['Kemy Mart', 'Star Café', 'Pal Pizza', 'Moonbeam Books', 'Comet Toys', 'Sunny Scoops', 'Pixel Arcade', 'Clover Bakery', 'Lone Keem Studios'];
  const signs = []; const BC = ['#e8d8c3', '#cdd9e6', '#f0d5c9', '#d5e5d0', '#e2d6f0', '#f3e3b5', '#c9d3dd', '#ead0dc'];
  { const lots = []; for (let x = DOWNTOWN.x0 + 4; x < DOWNTOWN.x1 - 6; x += 15) for (let z = DOWNTOWN.z0 + 4; z < DOWNTOWN.z1 - 6; z += 15) lots.push([x + 6, z + 6]);
    let si = 0; for (const [x, z] of lots) { if (inRoad(x, z, 9) || (Math.hypot(x - 212, z - 62) < 16)) continue; const w = 9 + r() * 3, d = 9 + r() * 3, h = 8 + Math.floor(r() * (LOW ? 6 : 10)) * 3.2; const c = BC[Math.floor(r() * BC.length)]; const y0 = ground(x, z) - 0.2;
      P2('bld', G.box, c, x, y0 + h / 2, z, 0, w, h, d); P2('trim', G.box, '#6b7280', x, y0 + h + 0.25, z, 0, w + 0.4, 0.5, d + 0.4);
      for (let fy = 4.4; fy < h - 1.2; fy += 3.2) for (const [fx, fz, rot, len] of [[0, d / 2 + 0.03, 0, w - 1.4], [0, -d / 2 - 0.03, 0, w - 1.4], [w / 2 + 0.03, 0, Math.PI / 2, d - 1.4], [-w / 2 - 0.03, 0, Math.PI / 2, d - 1.4]]) P2('win', G.box, r() < 0.7 ? '#ffe9a8' : '#9fd8ff', x + fx, y0 + fy, z + fz, rot, len, 1.3, 0.06);
      // shop front + awning on the ground floor
      const sc = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'][si % 6]; for (const s of [-1, 1]) { P2('bld', G.box, '#fefefe', x, y0 + 1.6, z + s * (d / 2 + 0.05), 0, w - 2, 2.6, 0.08); P2('trim', G.box, sc, x, y0 + 3.1, z + s * (d / 2 + 0.6), 0, w - 1.6, 0.18, 1.2, s * 0.25); }
      box.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top: 99, bot: -99 }); if (si < SHOPS.length) signs.push([SHOPS[si], x, y0 + 3.9, z + d / 2 + 0.1, sc]); si++; }
    // plaza: fountain, benches, flower beds
    const px = 212, pz = 62, py = ground(px, pz); P2('walk', G.cyl, '#d6cfc2', px, py + 0.05, pz, 0, 22, 0.1, 22); P2('trim', G.cyl, '#cbd5e1', px, py + 0.4, pz, 0, 7, 0.8, 7); P2('water', G.cyl, '#5ec4f0', px, py + 0.75, pz, 0, 6.2, 0.1, 6.2); P2('trim', G.cyl, '#e2e8f0', px, py + 1.6, pz, 0, 0.8, 2.2, 0.8); P2('trim', G.cyl, '#cbd5e1', px, py + 2.7, pz, 0, 2.6, 0.25, 2.6); cyl.push({ x: px, z: pz, r: 3.6, top: py + 0.8 });
    for (let a = 0; a < 6; a++) { const bx = px + Math.cos(a * 1.047) * 8.5, bz = pz + Math.sin(a * 1.047) * 8.5; P2('wood', G.box, '#a0703c', bx, py + 0.45, bz, -a * 1.047 + Math.PI / 2, 2.2, 0.12, 0.6); P2('wood', G.box, '#a0703c', bx + Math.cos(a * 1.047) * 0.3, py + 0.75, bz + Math.sin(a * 1.047) * 0.3, -a * 1.047 + Math.PI / 2, 2.2, 0.5, 0.1);
      P2('trim', G.cyl, '#22c55e', px + Math.cos(a * 1.047 + 0.5) * 10.5, py + 0.3, pz + Math.sin(a * 1.047 + 0.5) * 10.5, 0, 2.2, 0.6, 2.2); } }

  // ---------------------------------------------------------------- Clover Fields: crops, a red barn, silo, windmill, hay, fences, sheep
  let mill = null; const sheep = [];
  { for (let x = FIELDS.x0 + 2; x < FIELDS.x1 - 2; x += LOW ? 3 : 2) for (let z0 = FIELDS.z0 + 4; z0 < FIELDS.z1 - 4; z0 += 30) { const plot = (Math.floor((x - FIELDS.x0) / 24) * 3 + Math.floor((z0 - FIELDS.z0) / 30)) % 4; if (plot > 1 || inRoad(x, z0 + 13, 2)) continue; P2('crop', G.box, plot === 0 ? '#e0b93e' : '#4caf50', x, ground(x, z0 + 13) + 0.35, z0 + 13, 0, 0.7, plot === 0 ? 0.9 : 0.5, 24); }
    const bx = 300, bz = 140, by = ground(bx, bz); P2('bld', G.box, '#c0392b', bx, by + 3, bz, 0, 12, 6, 9); P2('roof', G.prism, '#7c2d12', bx, by + 7.2, bz, 0, 6.6, 12.4, 3, 0, Math.PI / 2); P2('trim', G.box, '#fff', bx, by + 2.2, bz + 4.55, 0, 4.4, 4.4, 0.1); P2('trim', G.box, '#fff', bx, by + 2.2, bz + 4.6, Math.PI / 4, 0.25, 5.8, 0.1); P2('trim', G.box, '#fff', bx, by + 2.2, bz + 4.6, -Math.PI / 4, 0.25, 5.8, 0.1);
    box.push({ x0: bx - 6, x1: bx + 6, z0: bz - 4.5, z1: bz + 4.5, top: 99, bot: -99 }); P2('bld', G.cyl, '#cbd5e1', bx + 10, by + 5, bz - 2, 0, 4, 10, 4); P2('roof', G.sph, '#94a3b8', bx + 10, by + 10, bz - 2, 0, 4, 2.4, 4); cyl.push({ x: bx + 10, z: bz - 2, r: 2.1, top: 99 });
    for (let i = 0; i < (LOW ? 8 : 16); i++) { const x = 262 + r() * 70, z = 30 + r() * 140; if (inRoad(x, z, 3)) continue; P2('hay', G.cyl, '#e2b85a', x, ground(x, z) + 0.6, z, r() * 3, 1.3, 1.2, 1.3, Math.PI / 2); cyl.push({ x, z, r: 0.7, top: ground(x, z) + 1.2 }); }
    // fences around the fields
    for (const [ax, az, bx2, bz2] of [[FIELDS.x0, FIELDS.z0, FIELDS.x1, FIELDS.z0], [FIELDS.x0, FIELDS.z1, FIELDS.x1, FIELDS.z1]]) { for (let x = ax; x <= bx2; x += 3) { if (inRoad(x, az, 1)) continue; P2('wood', G.box, '#c8a26b', x, ground(x, az) + 0.5, az, 0, 0.14, 1, 0.14); P2('wood', G.box, '#c8a26b', x + 1.5, ground(x, az) + 0.75, az, 0, 3, 0.1, 0.06); P2('wood', G.box, '#c8a26b', x + 1.5, ground(x, az) + 0.4, az, 0, 3, 0.1, 0.06); } void bx2; void bz2; }
    // windmill (blades spin)
    const mx = 330, mz = -10, my = ground(mx, mz); P2('bld', G.cyl, '#f1e4cc', mx, my + 5, mz, 0, 3.2, 10, 3.2); P2('roof', G.cone, '#7c3aed', mx, my + 11, mz, 0, 3.8, 2.4, 3.8); cyl.push({ x: mx, z: mz, r: 1.7, top: 99 });
    mill = new THREE.Group(); mill.position.set(mx, my + 8.6, mz + 1.9); const bm = std('#fff8e7', { r: 0.7 }); for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5, 0.08), bm); b.geometry.translate(0, 2.6, 0); b.rotation.z = i * Math.PI / 2; mill.add(b); } mill.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), std('#7c3aed'))); root.add(mill);
    // fluffy sheep (instanced bodies + heads), wander slowly
    const NS = LOW ? 5 : 10; const sb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 12, 10), std('#f8fafc', { r: 1 }), NS), sh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), std('#3f3f46', { r: 0.8 }), NS);
    for (let i = 0; i < NS; i++) sheep.push({ x: 262 + r() * 20, z: 100 + r() * 20, a: r() * 6, t: r() * 10 }); root.add(sb, sh); sheep.im = [sb, sh];
    for (const [x, z] of [[214, 150], [205, 175], [180, 160]]) { const y = ground(x, z); P2('bld', G.box, '#f5e6c8', x, y + 2, z, 0, 9, 4, 7); P2('roof', G.prism, '#2563eb', x, y + 5, z, 0, 5.4, 9.4, 2.2, 0, Math.PI / 2); P2('win', G.box, '#ffe9a8', x, y + 2.2, z + 3.55, 0, 6, 1, 0.06); box.push({ x0: x - 4.5, x1: x + 4.5, z0: z - 3.5, z1: z + 3.5, top: 99, bot: -99 }); } }

  // ---------------------------------------------------------------- Sunny Shore: palms, umbrellas, towels, lifeguard hut, sandcastles, a pier
  const umb = [];
  { const palms = []; for (let x = 108; x < 378; x += LOW ? 16 : 10) { const z = SHORE.z0 + 2 + r() * 5; if (inRoad(x, z, 2)) continue; palms.push([x, z, r()]); }
    for (let x = 140; x < 360; x += 24) for (let z = SHORE.z0 + 6; z < SHORE.z0 + 13; z += 6) if (!inRoad(x, z, 1)) palms.push([x + r() * 6, z, r()]);
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 6, 7); trunkG.translate(0, 3, 0); const leafG = new THREE.ConeGeometry(2.6, 1.2, 7); leafG.translate(0, 6.2, 0);
    const tI = new THREE.InstancedMesh(trunkG, std('#9a7148', { r: 0.9 }), palms.length), lI = new THREE.InstancedMesh(leafG, std('#2fa84f', { r: 0.7 }), palms.length);
    palms.forEach(([x, z, k], i) => { tq.setFromEuler(new THREE.Euler(0.08 * (k - 0.5), k * 6, 0.1 * (k - 0.5))); M.compose(tv.set(x, ground(x, z), z), tq, ts.set(1, 0.85 + k * 0.35, 1)); tI.setMatrixAt(i, M); lI.setMatrixAt(i, M); cyl.push({ x, z, r: 0.35, top: 99 }); }); tI.castShadow = lI.castShadow = !LOW; root.add(tI, lI);
    const NU = LOW ? 8 : 16; const capG = new THREE.ConeGeometry(1.6, 0.6, 10); capG.translate(0, 2.3, 0); const stickG = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6); stickG.translate(0, 1.15, 0);
    const cI = new THREE.InstancedMesh(capG, std('#fff', { r: 0.6 }), NU), sI = new THREE.InstancedMesh(stickG, std('#f8fafc'), NU), towI = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.03, 2), std('#fff'), NU);
    const UC = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    for (let i = 0; i < NU; i++) { const x = 130 + i * (230 / NU) + r() * 6, z = SHORE.z0 + 9 + r() * 4; if (inRoad(x, z, 1)) continue; const y = ground(x, z); M.compose(tv.set(x, y, z), tq.identity(), ts.set(1, 1, 1)); cI.setMatrixAt(i, M); sI.setMatrixAt(i, M); cI.setColorAt(i, col.set(UC[i % UC.length])); tq.setFromAxisAngle(UP, r()); M.compose(tv.set(x + 1.4, y + 0.03, z + 0.4), tq, ts.set(1, 1, 1)); towI.setMatrixAt(i, M); towI.setColorAt(i, col.set(UC[(i + 3) % UC.length])); umb.push([x, z]); }
    root.add(cI, sI, towI);
    // lifeguard hut + sandcastles
    const lx = 250, lz = SHORE.z0 + 8, ly = ground(lx, lz); for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P2('wood', G.box, '#f5f5f4', lx + dx, ly + 1.5, lz + dz, 0, 0.18, 3, 0.18); P2('bld', G.box, '#ef4444', lx, ly + 3.6, lz, 0, 2.6, 1.6, 2.6); P2('roof', G.cone4, '#fef08a', lx, ly + 4.9, lz, Math.PI / 4, 4, 1, 4); box.push({ x0: lx - 1.3, x1: lx + 1.3, z0: lz - 1.3, z1: lz + 1.3, top: 99, bot: -99 });
    for (let i = 0; i < 5; i++) { const x = 160 + i * 41 + r() * 8, z = SHORE.z0 + 11, y = ground(x, z); P2('sand', G.cyl6, '#e3c27e', x, y + 0.3, z, 0, 1.6, 0.6, 1.6); P2('sand', G.cone4, '#e3c27e', x, y + 0.9, z, 0, 0.9, 0.7, 0.9); P2('sand', G.box, '#f43f5e', x, y + 1.5, z, 0, 0.04, 0.4, 0.3); }
    // pier: a walkable boardwalk out over the water
    const pxx = 300; for (let z = SHORE.z0 + 4; z < SHORE.sea + 4; z += 1.2) P2('wood', G.box, z % 2.4 < 1.2 ? '#b68552' : '#a87745', pxx, FLAT + 0.05, z, 0, 3.2, 0.2, 1.1); for (let z = SHORE.z0 + 8; z < SHORE.sea + 4; z += 4) for (const s of [-1, 1]) P2('wood', G.box, '#8b5e34', pxx + s * 1.6, FLAT - 1, z, 0, 0.3, 2.4, 0.3);
    box.push({ x0: pxx - 1.6, x1: pxx + 1.6, z0: SHORE.z0 + 4, z1: SHORE.sea + 4.6, top: FLAT + 0.15, bot: -99 }); }

  // ---------------------------------------------------------------- trees in the open grass (instanced, round + friendly)
  { const T = []; for (let i = 0; i < (LOW ? 110 : 260); i++) { const x = 104 + r() * 272, z = -66 + r() * 560; if (inRoad(x, z, 3) || z > SHORE.z0 - 4) continue; if (HOUSES.some((h) => Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 11)) continue; if ((z > 222 && z < 332) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 4) continue; if (x > DOWNTOWN.x0 - 3 && x < DOWNTOWN.x1 + 3 && z > DOWNTOWN.z0 - 3 && z < DOWNTOWN.z1 + 3) continue; if (x > FIELDS.x0 - 2 && x < FIELDS.x1 + 2 && z > FIELDS.z0 - 2 && z < FIELDS.z1 + 2) continue; if (Math.hypot(x - 300, z - 140) < 14 || Math.hypot(x - 200, z - 160) < 22) continue; T.push([x, z, r()]); }
    const tg = new THREE.CylinderGeometry(0.2, 0.3, 2.4, 7); tg.translate(0, 1.2, 0); const cg = new THREE.IcosahedronGeometry(1.8, 1); cg.translate(0, 3.4, 0); const tI = new THREE.InstancedMesh(tg, std('#7a5230'), T.length), cI = new THREE.InstancedMesh(cg, std('#fff', { r: 0.85 }), T.length);
    const TC = ['#3f9142', '#4fa34a', '#2f7d3a', '#e08b2b', '#d4a017']; T.forEach(([x, z, k], i) => { M.compose(tv.set(x, ground(x, z), z), tq.setFromAxisAngle(UP, k * 6), ts.set(0.8 + k * 0.6, 0.8 + k * 0.6, 0.8 + k * 0.6)); tI.setMatrixAt(i, M); cI.setMatrixAt(i, M); cI.setColorAt(i, col.set(TC[Math.floor(k * TC.length)])); cyl.push({ x, z, r: 0.4, top: 99 }); });
    tI.castShadow = cI.castShadow = !LOW; root.add(tI, cI); }

  // ---------------------------------------------------------------- southern towns: landmarks
  let lakeW = null;
  { // ❄️ Frostberry Village: snowy pines, an ice rink, a big twinkly tree, snowmen
    const pines = []; for (let i = 0; i < (LOW ? 30 : 60); i++) { const x = 108 + r() * 134, z = 226 + r() * 102; if (inRoad(x, z, 3) || HOUSES.some((h) => Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 11)) continue; pines.push([x, z, r()]); }
    const pg = new THREE.ConeGeometry(1.6, 4.2, 8); pg.translate(0, 3.1, 0); const sg = new THREE.ConeGeometry(1.05, 1.6, 8); sg.translate(0, 4.6, 0); const tg2 = new THREE.CylinderGeometry(0.18, 0.25, 1.2, 6); tg2.translate(0, 0.6, 0);
    const pI = new THREE.InstancedMesh(pg, std('#1f6f4a', { r: 0.8 }), pines.length), sI = new THREE.InstancedMesh(sg, std('#ffffff', { r: 0.6 }), pines.length), tI = new THREE.InstancedMesh(tg2, std('#6b4a2f'), pines.length);
    pines.forEach(([x, z, k], i) => { M.compose(tv.set(x, ground(x, z), z), tq.setFromAxisAngle(UP, k * 6), ts.setScalar(0.8 + k * 0.7)); pI.setMatrixAt(i, M); sI.setMatrixAt(i, M); tI.setMatrixAt(i, M); cyl.push({ x, z, r: 0.5, top: 99 }); }); pI.castShadow = !LOW; root.add(pI, sI, tI);
    const rx = 178, rz = 236, ry = ground(rx, rz); P2('water', G.cyl, '#bfe7ff', rx, ry + 0.06, rz, 0, 16, 0.08, 10); P2('trim', G.box, '#f8fafc', rx, ry + 0.3, rz - 5.2, 0, 16, 0.6, 0.3); P2('trim', G.box, '#f8fafc', rx, ry + 0.3, rz + 5.2, 0, 16, 0.6, 0.3);
    const tx = 230, tz = 236, ty = ground(tx, tz); for (let j = 0; j < 4; j++) P2('roof', G.cone, '#166534', tx, ty + 2 + j * 1.8, tz, 0, 6 - j * 1.3, 2.6, 6 - j * 1.3); P2('win', G.sph, '#fde047', tx, ty + 9.6, tz, 0, 0.9, 0.9, 0.9); cyl.push({ x: tx, z: tz, r: 2.8, top: 99 });
    for (let j = 0; j < 14; j++) { const a = j * 2.4, hh = 2.5 + j * 0.45; P2('win', G.sph, ['#ef4444', '#facc15', '#38bdf8', '#a855f7'][j % 4], tx + Math.cos(a) * (2.9 - j * 0.17), ty + hh, tz + Math.sin(a) * (2.9 - j * 0.17), 0, 0.35, 0.35, 0.35); }
    for (const [x, z] of [[150, 238], [205, 300 - 62], [160, 302 - 60]]) { const y = ground(x, z); P2('sand', G.sph, '#ffffff', x, y + 0.5, z, 0, 1.1, 1, 1.1); P2('sand', G.sph, '#ffffff', x, y + 1.3, z, 0, 0.8, 0.75, 0.8); P2('sand', G.sph, '#ffffff', x, y + 1.95, z, 0, 0.55, 0.55, 0.55); P2('trim', G.cone, '#f97316', x, y + 1.95, z + 0.4, 0, 0.12, 0.4, 0.12, Math.PI / 2); cyl.push({ x, z, r: 0.6, top: 99 }); } }
  { // 🌵 Sunstone Canyon: cacti, rock arches, a water tower, a little cantina-style trading post
    const cac = []; for (let i = 0; i < (LOW ? 18 : 36); i++) { const x = 248 + r() * 130, z = 226 + r() * 100; if (inRoad(x, z, 3) || HOUSES.some((h) => Math.abs(h.x - x) < 8 && Math.abs(h.z - z) < 11)) continue; cac.push([x, z, r()]); }
    for (const [x, z, k] of cac) { const y = ground(x, z); P2('crop', G.cyl, '#3f8f46', x, y + 1.3, z, 0, 0.6, 2.6, 0.6); P2('crop', G.cyl, '#3f8f46', x + 0.55, y + 1.5, z, 0, 0.35, 1.0, 0.35); P2('crop', G.cyl, '#3f8f46', x - 0.5, y + 1.9 + k * 0.3, z, 0, 0.35, 0.9, 0.35); P2('win', G.sph, '#f472b6', x, y + 2.65, z, 0, 0.3, 0.2, 0.3); cyl.push({ x, z, r: 0.45, top: 99 }); }
    const ax = 300, az = 236, ay = ground(ax, az); for (const s of [-1, 1]) P2('bld', G.box, '#c2603f', ax + s * 5, ay + 3.5, az, 0, 2.6, 7, 3); P2('bld', G.box, '#b5523b', ax, ay + 7.6, az, 0, 12.6, 1.6, 3); box.push({ x0: ax - 6.3, x1: ax - 3.7, z0: az - 1.5, z1: az + 1.5, top: 99, bot: -99 }, { x0: ax + 3.7, x1: ax + 6.3, z0: az - 1.5, z1: az + 1.5, top: 99, bot: -99 });
    const wx = 352, wz = 236, wy = ground(wx, wz); for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) P2('wood', G.box, '#8b5e34', wx + dx, wy + 3, wz + dz, 0, 0.22, 6, 0.22); P2('bld', G.cyl, '#a0703c', wx, wy + 7.4, wz, 0, 4.2, 2.8, 4.2); P2('roof', G.cone, '#7c2d12', wx, wy + 9.4, wz, 0, 4.6, 1.4, 4.6); box.push({ x0: wx - 1.6, x1: wx + 1.6, z0: wz - 1.6, z1: wz + 1.6, top: 99, bot: -99 }); }
  { // 🛶 Willow Lake: water, a dock, rowboats, a lakeside lodge, willows
    lakeW = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 4, 40), new THREE.MeshStandardMaterial({ color: '#3b9bc7', roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.88 })); lakeW.rotation.x = -Math.PI / 2; lakeW.position.set(LAKE.x, LAKE.y, LAKE.z); root.add(lakeW);
    const dx0 = LAKE.x, dz0 = LAKE.z - LAKE.r - 6; for (let z = dz0; z < dz0 + 14; z += 1.2) P2('wood', G.box, '#a87745', dx0, FLAT + 0.05, z, 0, 2.6, 0.2, 1.1); box.push({ x0: dx0 - 1.3, x1: dx0 + 1.3, z0: dz0, z1: dz0 + 14, top: FLAT + 0.15, bot: -99 });
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4, bx = LAKE.x + Math.cos(a) * (LAKE.r - 10), bz = LAKE.z + Math.sin(a) * (LAKE.r - 10); P2('wood', G.box, ['#ef4444', '#fbbf24', '#22c55e', '#3b82f6'][i], bx, LAKE.y + 0.25, bz, a, 1.3, 0.5, 3.4); P2('wood', G.box, '#f5f5f4', bx, LAKE.y + 0.42, bz, a, 1.1, 0.08, 0.4); }
    const lx = 300, lz = 380, ly = ground(lx, lz); P2('bld', G.box, '#8b5e34', lx, ly + 2.4, lz, 0, 14, 4.8, 8); P2('roof', G.prism, '#14532d', lx, ly + 6, lz, 0, 4.8, 14.6, 2.6, 0, Math.PI / 2); P2('win', G.box, '#ffe9a8', lx, ly + 2.2, lz - 4.05, 0, 9, 1.2, 0.06); box.push({ x0: lx - 7, x1: lx + 7, z0: lz - 4, z1: lz + 4, top: 99, bot: -99 });
    const wl = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = LAKE.x + Math.cos(a) * (LAKE.r + 9), z = LAKE.z + Math.sin(a) * (LAKE.r + 9); if (inRoad(x, z, 3) || Math.abs(x - LAKE.x) < 4 && z < LAKE.z || Math.hypot(x - lx, z - lz) < 10) continue; wl.push([x, z]); }
    for (const [x, z] of wl) { const y = ground(x, z); P2('wood', G.cyl, '#6b4a2f', x, y + 1.6, z, 0, 0.5, 3.2, 0.5); P2('crop', G.cone, '#7fbf4a', x, y + 3.6, z, 0, 4.6, 4.4, 4.6); cyl.push({ x, z, r: 0.4, top: 99 }); } }
  { // 🏖️ Sunny Shore boardwalk (the pier + umbrellas above moved here with the beach)
    for (let x = 110; x < 378; x += 2) if (!inRoad(x, SHORE.z0 + 1, 0.5)) P2('wood', G.box, x % 4 < 2 ? '#c49a6c' : '#b68552', x + 1, FLAT + 0.06, SHORE.z0 + 1, 0, 2, 0.12, 3); }
  // ---------------------------------------------------------------- district banners (arch at each town entrance) + map labels
  for (const t of TOWNS) { if (!t.gate) continue; const [gx, gz] = t.gate, gy = ground(gx, gz); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const g = cv.getContext('2d'); g.fillStyle = '#1e1b4b'; g.fillRect(0, 0, 512, 112); g.strokeStyle = '#fde68a'; g.lineWidth = 6; g.strokeRect(5, 5, 502, 102); g.fillStyle = '#fff'; g.font = 'bold 44px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.name, 256, 58);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; const b = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.55), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })); b.position.set(gx + 6, gy + 4.2, gz - 6.5); b.rotation.y = Math.PI / 4; chunks.get(chunkOf(gx + 6, gz - 6.5)).add(b);
    for (const s of [-1, 1]) { P2('trim', G.cyl, '#fde68a', gx + 6 + s * 2.4, gy + 2.2, gz - 6.5 - s * 2.4, 0, 0.22, 4.4, 0.22); cyl.push({ x: gx + 6 + s * 2.4, z: gz - 6.5 - s * 2.4, r: 0.15, top: 99 }); } }
  W.townLabels = TOWNS;
  // ---------------------------------------------------------------- flush merged chunks
  const MAT = { road: std('#fff', { vc: true, r: 0.92 }), mark: std('#fff', { vc: true, r: 0.6 }), walk: std('#fff', { vc: true, r: 0.85 }), bld: std('#fff', { vc: true, r: 0.75 }), trim: std('#fff', { vc: true, r: 0.6 }), win: std('#fff', { vc: true, e: '#ffe9a8', ei: 0.45, r: 0.3 }), wood: std('#fff', { vc: true, r: 0.9 }), roof: std('#fff', { vc: true, r: 0.7 }), crop: std('#fff', { vc: true, r: 0.95 }), hay: std('#fff', { vc: true, r: 1 }), sand: std('#fff', { vc: true, r: 1 }), water: std('#fff', { vc: true, r: 0.1 }) };
  for (const ck of keys) { const [k, c] = ck.split('|'); flush(ck, MAT[k] || MAT.trim, !['road', 'mark', 'walk', 'crop', 'win'].includes(k), chunks.get(c)); }
  // shop signs (canvas textures, original names)
  for (const [name, x, y, z, c] of signs) { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 256, 64); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, 128, 34);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); chunks.get(chunkOf(x, z)).add(m); }
  // welcome sign at the park link
  { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#0f766e'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116); g.fillStyle = '#fff'; g.font = 'bold 40px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('🛣️ LOOP HIGHWAY', 256, 56); g.font = '26px system-ui,sans-serif'; g.fillText('Downtown · Clover Fields · Sunny Shore', 256, 98);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide })); s.position.set(110, ground(110, -6) + 3.4, -6); s.rotation.y = -Math.PI / 2; root.add(s);
    for (const dz of [-2.8, 2.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4), std('#64748b')); p.position.set(110, ground(110, -6) + 1.7, -6 + dz); root.add(p); } }

  // ---------------------------------------------------------------- highway traffic (both directions, kid-safe: same stop-for-people logic)
  const HL = [[HWY.x0, HWY.z0], [HWY.x1, HWY.z0], [HWY.x1, HWY.z1], [HWY.x0, HWY.z1]]; const mk = (pts) => ({ pts, len: pts.reduce((s, p, i) => s + Math.hypot(pts[(i + 1) % pts.length][0] - p[0], pts[(i + 1) % pts.length][1] - p[1]), 0) });
  const L1 = mk(HL), L2 = mk(HL.slice().reverse()); const N = LOW ? 4 : Q.tier === 'medium' ? 6 : 10; const designs = CARS.filter((c) => !c.prem).map((c) => c.id);
  for (let i = 0; i < N; i++) { const L = i % 2 ? L2 : L1; const m = buildCar(designs[i % designs.length], Math.floor(r() * 12), { lite: true, noShadow: LOW }); root.add(m); const d = (i >> 1) * L.len / Math.ceil(N / 2) + (i % 2) * 37; const p = K.loopAt(d, -3, L); K.cars.push({ m, drive: true, L, lane: -3, d, v: 0, vmax: 10 + r() * 4, spin: 0, x: p.x, z: p.z }); }
  { const S2 = mk([[122, 206], [362, 206], [362, 490], [122, 490]]), S3 = mk([[122, 490], [362, 490], [362, 206], [122, 206]]); const n2 = LOW ? 2 : 4;
    for (let i = 0; i < n2; i++) { const L = i % 2 ? S3 : S2; const m = buildCar(designs[(i + 2) % designs.length], Math.floor(r() * 12), { lite: true, noShadow: LOW }); root.add(m); const d = (i >> 1) * L.len / 2 + 60; const p = K.loopAt(d, -3, L); K.cars.push({ m, drive: true, L, lane: -3, d, v: 0, vmax: 10 + r() * 3, spin: 0, x: p.x, z: p.z }); } }
  // a few parked downtown
  for (let i = 0; i < (LOW ? 3 : 6); i++) { const x = 140 + i * 15 + r() * 4, z = 20 + (i % 2 ? 2.9 : -2.9); const m = buildCar(designs[Math.floor(r() * designs.length)], Math.floor(r() * 12), { lite: true, noShadow: true }); root.add(m); const yaw = i % 2 ? -Math.PI / 2 : Math.PI / 2; poseCar(m, { x, y: FLAT, z, yaw }, 0, 0); K.cars.push({ m, drive: false, x, z, yaw }); const c = m.userData.def; cyl.push({ x, z, r: c.Wd * 0.5, top: FLAT + c.H }, { x: x + Math.sin(yaw) * c.L * 0.3, z, r: c.Wd * 0.5, top: FLAT + c.H }, { x: x - Math.sin(yaw) * c.L * 0.3, z, r: c.Wd * 0.5, top: FLAT + c.H }); }

  // ---------------------------------------------------------------- minimap extras + streaming update
  W.mapExtra = (g, mx, mz, sc) => { g.fillStyle = 'rgba(56,160,220,.7)'; g.fillRect(mx(100), mz(SHORE.sea), (EAST.x1 - 100) * sc, (EAST.z1 - SHORE.sea) * sc); g.fillStyle = 'rgba(234,211,154,.8)'; g.fillRect(mx(100), mz(SHORE.z0), (EAST.x1 - 100) * sc, (SHORE.sea - SHORE.z0) * sc);
    g.fillStyle = 'rgba(160,160,170,.6)'; g.fillRect(mx(DOWNTOWN.x0), mz(DOWNTOWN.z0), (DOWNTOWN.x1 - DOWNTOWN.x0) * sc, (DOWNTOWN.z1 - DOWNTOWN.z0) * sc); g.fillStyle = 'rgba(217,180,74,.55)'; g.fillRect(mx(FIELDS.x0), mz(FIELDS.z0), (FIELDS.x1 - FIELDS.x0) * sc, (FIELDS.z1 - FIELDS.z0) * sc);
    g.fillStyle = 'rgba(240,248,255,.75)'; g.fillRect(mx(SNOW.x0), mz(SNOW.z0), (SNOW.x1 - SNOW.x0) * sc, (SNOW.z1 - SNOW.z0) * sc); g.fillStyle = 'rgba(227,168,102,.75)'; g.fillRect(mx(DESERT.x0), mz(DESERT.z0), (DESERT.x1 - DESERT.x0) * sc, (DESERT.z1 - DESERT.z0) * sc);
    g.fillStyle = 'rgba(59,155,199,.85)'; g.beginPath(); g.arc(mx(LAKE.x), mz(LAKE.z), LAKE.r * sc, 0, 7); g.fill(); };
  W.mapLabels = (g, mx, mz) => { g.font = 'bold 9px system-ui,sans-serif'; g.textAlign = 'center'; for (const t of TOWNS) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillText(t.name, mx(t.x) + 1, mz(t.z) + 1); g.fillStyle = '#fff'; g.fillText(t.name, mx(t.x), mz(t.z)); } };
  let cullT = 9, shown = 0; const st = { chunks: chunks.size, shown: 0 };
  function update(dt, now) { const t = now / 1000; if (mill) mill.rotation.z = t * 0.8; if (lakeW) lakeW.position.y = LAKE.y + Math.sin(t * 0.9) * 0.03; sea.position.y = SEA_Y + Math.sin(t * 0.7) * 0.05; foam.material.opacity = 0.4 + Math.sin(t * 1.3) * 0.15;
    if (now - cullT > 500) { cullT = now; const far = Q.draw + CH * 0.75; shown = 0; const east = P.x > 60 || P.z > 150; void east; root.visible = east || P.x > 40; for (const g of chunks.values()) { const [cx, cz] = g.userData.c; g.visible = Math.hypot(cx - P.x, cz - P.z) < far; if (g.visible) shown++; } st.shown = shown; }
    if (sheep.im) { const [sb, sh] = sheep.im; sheep.forEach((s, i) => { s.t += dt; if (Math.sin(s.t * 0.4 + i) > 0.6) { s.a += Math.sin(s.t + i) * dt * 0.6; s.x = Math.max(258, Math.min(342, s.x + Math.sin(s.a) * dt * 0.5)); s.z = Math.max(96, Math.min(124, s.z + Math.cos(s.a) * dt * 0.5)); }
      const y = ground(s.x, s.z); M.compose(tv.set(s.x, y + 0.55, s.z), tq.setFromAxisAngle(UP, s.a), ts.set(1.3, 0.9, 0.9)); sb.setMatrixAt(i, M); M.compose(tv.set(s.x + Math.sin(s.a) * 0.75, y + 0.75, s.z + Math.cos(s.a) * 0.75), tq, ts.set(1, 1.1, 1)); sh.setMatrixAt(i, M); }); sb.instanceMatrix.needsUpdate = sh.instanceMatrix.needsUpdate = true; }
    window.__ke = st; }
  function destroy() { scene.remove(root); }
  return { update, destroy, root, chunks };
}
