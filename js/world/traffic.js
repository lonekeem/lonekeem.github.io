// 🚦 Kemy Traffic: working stoplights + AI cars that drive like normal (kid-safe) drivers on the whole road network.
// - Road graph built once (lazily, a moment after the world loads) from every public road in layout.js.
// - Stoplights at every 3/4-way junction: green / yellow / red per direction. Poles stand on a sidewalk corner (clearSpot
//   guard, never on asphalt). Lenses are unlit MeshBasicMaterial + instance colours: no scene lights, no shader rebuilds,
//   only the junctions near the player are packed into the instanced meshes.
// - Lane markings, stop lines and crosswalks are InstancedMeshes, built per 400 m tile and only shown near the player.
// - AI cars (pooled, lite builds of the normal Kemy cars, capped by device) only live near the player: they keep their
//   lane, keep a safe gap (IDM car-following), stop at red, go on green, turn at junctions on smooth curves, and always
//   yield to the player, other players, walking Pals and the player's car. They only ever drive on roads.
// Written by Lone Keem.
import { ALL_ROADS, FLAT, clearSpot, POLE_R } from './layout.js';
import { buildCar, poseCar, setBrakeLights, CARS } from './cars.js';

const PRIVATE = /^e[1-9]$/; // estate drives (private: no through traffic, no signals)
export const CYCLE = { green: 9, yellow: 2.6, allRed: 1.6 }; const CY = 2 * (CYCLE.green + CYCLE.yellow + CYCLE.allRed);
// light for axis 0 (east-west) / axis 1 (north-south) at cycle time t: 'g' | 'y' | 'r'
export function lightAt(axis, t) { t = ((t % CY) + CY) % CY; const half = CY / 2; const k = axis ? (t + half) % CY : t; return k < CYCLE.green ? 'g' : k < CYCLE.green + CYCLE.yellow ? 'y' : 'r'; }
export const laneCount = (r) => (r.w >= 14 ? 2 : 1);
// lateral offset of lane i (0 = inner) on the right-hand side of the travel direction
export function laneOff(r, i) { const n = laneCount(r), med = r.med ? 1.0 : r.bv ? 0.4 : 0.15; const lw = (r.w / 2 - med) / n; return med + lw * (Math.min(i, n - 1) + 0.5); }

// ---------------------------------------------------------------- the road graph (pure math, also used by tests)
export function buildGraph(roads = ALL_ROADS().filter((r) => !PRIVATE.test(r.id))) {
  const nodes = []; const nodeAt = (x, z) => { for (const n of nodes) if (Math.abs(n.x - x) < 2.5 && Math.abs(n.z - z) < 2.5) return n; const n = { id: nodes.length, x, z, out: [], roads: new Set(), w: 0 }; nodes.push(n); return n; };
  const cuts = roads.map((r) => { const L = Math.hypot(r.b[0] - r.a[0], r.b[1] - r.a[1]); return { r, L, ts: [0, L] }; });
  for (let i = 0; i < cuts.length; i++) for (let j = i + 1; j < cuts.length; j++) { const A = cuts[i], B = cuts[j]; const [ax, az] = A.r.a, [bx, bz] = B.r.a; const dax = (A.r.b[0] - ax) / A.L, daz = (A.r.b[1] - az) / A.L, dbx = (B.r.b[0] - bx) / B.L, dbz = (B.r.b[1] - bz) / B.L;
    const den = dax * dbz - daz * dbx; if (Math.abs(den) < 1e-6) { // collinear end-to-end joins
      for (const [P, Q] of [[A, B], [B, A]]) for (const e of [P.r.a, P.r.b]) { const t = (e[0] - Q.r.a[0]) * (Q.r.b[0] - Q.r.a[0]) / Q.L + (e[1] - Q.r.a[1]) * (Q.r.b[1] - Q.r.a[1]) / Q.L; const off = Math.abs((e[0] - Q.r.a[0]) * (Q.r.b[1] - Q.r.a[1]) / Q.L - (e[1] - Q.r.a[1]) * (Q.r.b[0] - Q.r.a[0]) / Q.L); if (off < 1 && t > -1 && t < Q.L + 1) Q.ts.push(Math.max(0, Math.min(Q.L, t))); }
      continue; }
    const t = ((bx - ax) * dbz - (bz - az) * dbx) / den, u = ((bx - ax) * daz - (bz - az) * dax) / den; const ta = B.r.w / 2 + 1, tb = A.r.w / 2 + 1;
    if (t > -ta && t < A.L + ta && u > -tb && u < B.L + tb) { A.ts.push(Math.max(0, Math.min(A.L, t))); B.ts.push(Math.max(0, Math.min(B.L, u))); } }
  const edges = [];
  for (const c of cuts) { const ts = [...new Set(c.ts.map((t) => Math.round(t * 10) / 10))].sort((a, b) => a - b); const dx = (c.r.b[0] - c.r.a[0]) / c.L, dz = (c.r.b[1] - c.r.a[1]) / c.L; let prev = null, pt = 0;
    for (const t of ts) { const n = nodeAt(c.r.a[0] + dx * t, c.r.a[1] + dz * t); n.roads.add(c.r); n.w = Math.max(n.w, c.r.w); if (prev && prev !== n && t - pt > 4) { const len = Math.hypot(n.x - prev.x, n.z - prev.z); const ex = (n.x - prev.x) / len, ez = (n.z - prev.z) / len;
        const e1 = { id: edges.length, r: c.r, a: prev, b: n, len, dx: ex, dz: ez }; edges.push(e1); const e2 = { id: edges.length, r: c.r, a: n, b: prev, len, dx: -ex, dz: -ez }; edges.push(e2); e1.rev = e2; e2.rev = e1; prev.out.push(e1); n.out.push(e2); }
      if (prev !== n) { prev = n; pt = t; } } }
  for (const n of nodes) { n.deg = n.out.length; n.signal = n.deg >= 3; // cross width: the widest *other* road at this node
    for (const e of n.out) { let cw = 0; for (const o of n.out) if (Math.abs(o.dx * e.dx + o.dz * e.dz) < 0.7) cw = Math.max(cw, o.r.w); e.rev.stopBack = n.deg >= 3 ? cw / 2 + 1.6 : n.deg === 2 ? Math.min(e.r.w, (n.out.find((o) => o !== e) || e).r.w) * 0.5 + 0.5 : 2; }
    n.ph = (n.id * 7.31) % CY; }
  for (const e of edges) { e.s0 = e.a.out.length >= 2 ? (e.rev.stopBack || 2) : 1; e.s1 = e.len - (e.stopBack || 2); if (e.s1 - e.s0 < 2) { const m = e.len / 2; e.s0 = Math.min(e.s0, m - 1); e.s1 = Math.max(e.s1, m + 1); } e.axis = Math.abs(e.dx) > Math.abs(e.dz) ? 0 : 1; }
  return { nodes, edges }; }

// signal pole spot for traffic arriving on edge e at node n: far-right corner, pushed off every road by the clearSpot guard
export function poleSpot(e) { const n = e.b; const rx = -e.dz, rz = e.dx; let cw = 0; for (const o of n.out) if (Math.abs(o.dx * e.dx + o.dz * e.dz) < 0.7) cw = Math.max(cw, o.r.w);
  const x = n.x + e.dx * (cw / 2 + 1.3) + rx * (e.r.w / 2 + 1.3), z = n.z + e.dz * (cw / 2 + 1.3) + rz * (e.r.w / 2 + 1.3); const p = clearSpot(x, z, [[0, 0, POLE_R]], 3, 0.25); return p; }

export function attachTraffic(api, W) { const { THREE, scene, Q, P, ground } = api; const LOW = !!api.LOW, PH = !!Q.phone;
  const CAP = LOW ? 8 : PH ? 10 : Q.tier === 'medium' ? 14 : 20, RAD = PH || LOW ? 140 : 190, SIGCAP = PH || LOW ? 20 : 36;
  const root = new THREE.Group(); root.name = 'kemy-traffic'; scene.add(root); let G = null, ready = false, t0 = performance.now(), simT = 0;
  const st = { cars: 0, cap: CAP, signals: 0, junctions: 0, edges: 0, shownSig: 0, stoppedRed: 0 }; window.__kt = st;
  const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  // ---------------------------------------------------------------- markings (per tile InstancedMesh, built lazily)
  const markMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2); const tiles = new Map(); const TILE = 400;
  const fillMat = new THREE.MeshStandardMaterial({ color: '#3a3c46', roughness: 0.92 }); const disc = new THREE.CircleGeometry(1, 20); disc.rotateX(-Math.PI / 2);
  function marks() { const L = []; const add = (x, z, ang, w, l, c) => L.push([x, z, ang, w, l, c]); const done = new Set();
    for (const e of G.edges) { if (done.has(e.rev.id)) continue; done.add(e.id); const r = e.r, ang = Math.atan2(e.dx, e.dz), rx = -e.dz, rz = e.dx; const a = e.s0 + 1, b = e.len - (e.stopBack || 2) - 1;
      if (laneCount(r) > 1) { // lane dividers each way + double yellow median line
        for (let t = a + 2; t < b - 2; t += 9) for (const s of [-1, 1]) { const o = s * (laneOff(r, 0) + laneOff(r, 1)) / 2; add(e.a.x + e.dx * t + rx * o, e.a.z + e.dz * t + rz * o, ang, 0.15, 3, 0); }
        if (b - a > 2) for (const s of [-1, 1]) add(e.a.x + e.dx * (a + b) / 2 + rx * s * (r.med ? 0.9 : 0.18), e.a.z + e.dz * (a + b) / 2 + rz * s * (r.med ? 0.9 : 0.18), ang, 0.14, b - a, 1); } }
    for (const n of G.nodes) if (n.signal) for (const e of n.out) { const r = e.r, ang = Math.atan2(e.dx, e.dz), rx = -e.dz, rz = e.dx; const k = e.rev.stopBack; if (r.hw && !n.cw) continue;
      // stop line on the incoming half + crosswalk across the whole road (skip Kemy Street: it has its own)
      const ax = n.x + e.dx * (k - 0.2), az = n.z + e.dz * (k - 0.2); const hw = r.w / 2 - 0.3; add(ax - rx * hw / 2, az - rz * hw / 2, ang + Math.PI / 2, hw, 0.4, 0);
      if (!/^[sa][0-2]$/.test(r.id)) for (let i = -Math.floor(hw / 1.05); i <= Math.floor(hw / 1.05); i++) add(n.x + e.dx * (k - 1.9) + rx * i * 1.05, n.z + e.dz * (k - 1.9) + rz * i * 1.05, ang, 0.55, 2.4, 0); }
    return L; }
  function buildTiles() { const all = marks(); const by = new Map(); for (const m of all) { const k = Math.floor(m[0] / TILE) + ',' + Math.floor(m[1] / TILE); if (!by.has(k)) by.set(k, []); by.get(k).push(m); }
    const Y = new THREE.Color('#ffd84a'), Wc = new THREE.Color('#f4f4f5'); let n = 0;
    for (const [k, L] of by) { const im = new THREE.InstancedMesh(quad, markMat, L.length); L.forEach(([x, z, ang, w, l, c], i) => { tq.setFromAxisAngle(UP, ang); tm.compose(tv.set(x, FLAT + 0.06, z), tq, ts.set(w, 1, l)); im.setMatrixAt(i, tm); im.setColorAt(i, c ? Y : Wc); });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.matrixAutoUpdate = false; im.receiveShadow = false; im.visible = false; const [i, j] = k.split(',').map(Number); im.userData.c = [(i + 0.5) * TILE, (j + 0.5) * TILE]; root.add(im); tiles.set(k, im); n += L.length; }
    // rounded corner fills where two roads meet at an angle (smooth curves instead of notched corners)
    const corners = G.nodes.filter((n2) => n2.deg === 2 && Math.abs(n2.out[0].dx * n2.out[1].dx + n2.out[0].dz * n2.out[1].dz) < 0.7);
    if (corners.length) { const im = new THREE.InstancedMesh(disc, fillMat, corners.length); corners.forEach((c, i) => { const w = Math.max(c.out[0].r.w, c.out[1].r.w) / 2 + 0.2; tm.compose(tv.set(c.x, FLAT + 0.028, c.z), tq.identity(), ts.set(w, 1, w)); im.setMatrixAt(i, tm); }); im.computeBoundingSphere(); root.add(im); }
    st.marks = n; st.corners = corners.length; }
  // ---------------------------------------------------------------- stoplights (nearby junctions packed into shared instanced meshes)
  const poleG = new THREE.CylinderGeometry(0.1, 0.12, 5.2, 6); poleG.translate(0, 2.6, 0); const armG = new THREE.BoxGeometry(1, 0.12, 0.12); armG.translate(0.5, 0, 0);
  const headG = new THREE.BoxGeometry(0.42, 1.25, 0.32); const lensG = new THREE.CircleGeometry(0.15, 10); lensG.translate(0, 0, 0.17);
  const metal = new THREE.MeshStandardMaterial({ color: '#3f4652', roughness: 0.55, metalness: 0.4 }), headM = new THREE.MeshStandardMaterial({ color: '#1f2933', roughness: 0.7 });
  const lensM = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }); // unlit: glows by itself, no real lights
  const HEADS = SIGCAP * 4; const poleIM = new THREE.InstancedMesh(poleG, metal, HEADS), armIM = new THREE.InstancedMesh(armG, metal, HEADS), headIM = new THREE.InstancedMesh(headG, headM, HEADS), lensIM = new THREE.InstancedMesh(lensG, lensM, HEADS * 3);
  for (const m of [poleIM, armIM, headIM, lensIM]) { m.count = 0; m.frustumCulled = false; m.castShadow = false; root.add(m); }
  for (let i = 0; i < HEADS * 3; i++) lensIM.setColorAt(i, col.set('#222'));
  const ON = { r: new THREE.Color('#ff2a2a'), y: new THREE.Color('#ffc21a'), g: new THREE.Color('#22e36b') }, OFF = { r: new THREE.Color('#3a1414'), y: new THREE.Color('#3a3010'), g: new THREE.Color('#123a20') };
  let shown = [], heads = [], colCyl = [], packAt = null;
  function pack() { packAt = [P.x, P.z]; const near = G.nodes.filter((n) => n.signal && Math.abs(n.x - P.x) < RAD + 80 && Math.abs(n.z - P.z) < RAD + 80).map((n) => [n, (n.x - P.x) ** 2 + (n.z - P.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, SIGCAP).map((a) => a[0]);
    for (const c of colCyl) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } colCyl = []; heads = []; shown = near;
    for (const n of near) for (const e of G.edges) if (e.b === n) { if (!n.spots) n.spots = new Map(); if (!n.spots.has(e.id)) n.spots.set(e.id, poleSpot(e)); const p = n.spots.get(e.id); if (!p) continue; heads.push({ n, e, x: p[0], z: p[1], k: heads.length, st: '' }); }
    heads.forEach((h, i) => { const e = h.e; const y = ground(h.x, h.z); const yaw = Math.atan2(-e.dx, -e.dz); // head faces the arriving cars
      // arm reaches from the pole back over the incoming lanes (overhead only: nothing stands on the road)
      const ax = (h.e.b.x + e.dx * 0 - e.dz * laneOff(e.r, 0)) - h.x, az = (h.e.b.z + e.dz * 0 + e.dx * laneOff(e.r, 0)) - h.z; const reach = Math.min(Math.abs(ax * -e.dz + az * e.dx), 6.5); const armYaw = Math.atan2(e.dz, -e.dx) + Math.PI; void armYaw;
      tq.identity(); tm.compose(tv.set(h.x, y, h.z), tq, ts.set(1, 1, 1)); poleIM.setMatrixAt(i, tm);
      const ux = e.dz, uz = -e.dx; // from the pole toward the road centre (left of travel)
      tq.setFromAxisAngle(UP, Math.atan2(-uz, ux)); tm.compose(tv.set(h.x, y + 5.0, h.z), tq, ts.set(reach, 1, 1)); armIM.setMatrixAt(i, tm);
      const hx = h.x + ux * reach, hz = h.z + uz * reach; tq.setFromAxisAngle(UP, yaw); tm.compose(tv.set(hx, y + 4.3, hz), tq, ts.set(1, 1, 1)); headIM.setMatrixAt(i, tm);
      for (let j = 0; j < 3; j++) { tm.compose(tv.set(hx, y + 4.3 + (1 - j) * 0.38, hz), tq, ts.set(1, 1, 1)); lensIM.setMatrixAt(i * 3 + j, tm); }
      const c = { x: h.x, z: h.z, r: 0.14, top: 99, sig: 1 }; api.cyl.push(c); colCyl.push(c); });
    poleIM.count = armIM.count = headIM.count = heads.length; lensIM.count = heads.length * 3; for (const m of [poleIM, armIM, headIM, lensIM]) m.instanceMatrix.needsUpdate = true; st.shownSig = shown.length; st.heads = heads.length; paint(true); }
  function paint(all) { let dirty = false; for (const h of heads) { const s = lightAt(h.e.axis, simT + h.n.ph); if (!all && s === h.st) continue; h.st = s; dirty = true;
      lensIM.setColorAt(h.k * 3, s === 'r' ? ON.r : OFF.r); lensIM.setColorAt(h.k * 3 + 1, s === 'y' ? ON.y : OFF.y); lensIM.setColorAt(h.k * 3 + 2, s === 'g' ? ON.g : OFF.g); }
    if (dirty && lensIM.instanceColor) lensIM.instanceColor.needsUpdate = true; }
  // ---------------------------------------------------------------- AI cars
  const designs = CARS.filter((c) => !c.prem).map((c) => c.id); const pool = []; let seed = 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const vmaxOf = (r) => (r.hw ? 17 : r.bv ? 12.5 : 9) * (0.85 + rnd() * 0.25);
  function posOn(c) { const e = c.e, o = laneOff(e.r, c.lane); if (!c.turn) return [e.a.x + e.dx * c.s - e.dz * o, e.a.z + e.dz * c.s + e.dx * o, Math.atan2(e.dx, e.dz)];
    const T = c.turn, t = Math.min(1, c.s / T.len), u = 1 - t; const x = u * u * T.p0[0] + 2 * u * t * T.p1[0] + t * t * T.p2[0], z = u * u * T.p0[1] + 2 * u * t * T.p1[1] + t * t * T.p2[1];
    const gx = 2 * u * (T.p1[0] - T.p0[0]) + 2 * t * (T.p2[0] - T.p1[0]), gz = 2 * u * (T.p1[1] - T.p0[1]) + 2 * t * (T.p2[1] - T.p1[1]); return [x, z, Math.atan2(gx, gz)]; }
  function pickNext(e) { const n = e.b; const opts = n.out.filter((o) => o !== e.rev && !PRIVATE.test(o.r.id)); if (!opts.length) return e.rev; // dead end: U-turn
    const straight = opts.find((o) => o.dx * e.dx + o.dz * e.dz > 0.7); if (straight && rnd() < 0.55) return straight; return opts[Math.floor(rnd() * opts.length)]; }
  function startTurn(c) { const e = c.e, nx = c.next, n = e.b; const oi = laneOff(e.r, c.lane), lane2 = Math.min(c.lane, laneCount(nx.r) - 1), oo = laneOff(nx.r, lane2);
    const p0 = [e.a.x + e.dx * e.s1 - e.dz * oi, e.a.z + e.dz * e.s1 + e.dx * oi], p2 = [nx.a.x + nx.dx * nx.s0 - nx.dz * oo, nx.a.z + nx.dz * nx.s0 + nx.dx * oo];
    const cr = e.dx * nx.dz - e.dz * nx.dx; let p1; if (Math.abs(cr) < 0.2) { const dot = e.dx * nx.dx + e.dz * nx.dz; p1 = dot > 0 ? [(p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2] : [n.x + e.dx * (e.stopBack + 3), n.z + e.dz * (e.stopBack + 3)]; }
    else { const t = ((p2[0] - p0[0]) * nx.dz - (p2[1] - p0[1]) * nx.dx) / cr; p1 = [p0[0] + e.dx * t, p0[1] + e.dz * t]; }
    let len = 0, px = p0[0], pz = p0[1]; for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], z = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]; len += Math.hypot(x - px, z - pz); px = x; pz = z; }
    c.turn = { p0, p1, p2, len, node: n, from: e, to: nx, lane2, left: cr > 0.2 }; c.s = 0; (n.occ = n.occ || new Set()).add(c); }
  function canEnter(c) { const n = c.e.b; if (!n.occ || !n.occ.size) return true; for (const o of n.occ) { if (o === c) continue; const T = o.turn; if (!T) continue; if (T.from.axis !== c.e.axis) return false; if ((T.left || (c.next && turnLeft(c))) && T.from !== c.e) return false; } return true; }
  const turnLeft = (c) => c.e.dx * c.next.dz - c.e.dz * c.next.dx > 0.2;
  function spawn(c, edges) { for (let k = 0; k < 6; k++) { const e = edges[Math.floor(rnd() * edges.length)]; if (!e || e.s1 - e.s0 < 12) continue; const s = e.s0 + 4 + rnd() * (e.s1 - e.s0 - 8), lane = Math.floor(rnd() * laneCount(e.r));
      const tmp = { e, s, lane }; const [x, z] = posOn(tmp); if (Math.hypot(x - P.x, z - P.z) < 45) continue; if (pool.some((o) => o.on && Math.hypot(o.x - x, o.z - z) < 14)) continue;
      Object.assign(c, { on: true, e, s, lane, turn: null, next: null, v: 4, vmax: vmaxOf(e.r), x, z, yaw: Math.atan2(e.dx, e.dz), spin: 0, brake: false }); c.m.visible = true; return true; } c.on = false; c.m.visible = false; return false; }
  function free(c) { if (c.turn && c.turn.node.occ) c.turn.node.occ.delete(c); c.turn = null; c.on = false; c.m.visible = false; }
  let near = [], nearT = 9, buildQ = 0;
  function nearEdges() { near = G.edges.filter((e) => !PRIVATE.test(e.r.id) && Math.min(Math.hypot(e.a.x - P.x, e.a.z - P.z), Math.hypot(e.b.x - P.x, e.b.z - P.z), segDist(e)) < RAD - 20); }
  const segDist = (e) => { const t = Math.max(0, Math.min(e.len, (P.x - e.a.x) * e.dx + (P.z - e.a.z) * e.dz)); return Math.hypot(e.a.x + e.dx * t - P.x, e.a.z + e.dz * t - P.z); };
  function people() { const out = [{ x: P.x, z: P.z, r: 1.4 }]; if (api.others) for (const o of api.others.values()) if (o && o.x != null) out.push({ x: o.x, z: o.z, r: 1.4 }); if (W.peds) for (const p of W.peds()) out.push({ x: p.x, z: p.z, r: 1.2 });
    const mc = api.myCar && api.myCar(); if (mc) out.push({ x: mc.x, z: mc.z, r: 2.4, car: 1 }); return out; }
  function drive(c, dt, ppl) { const [x, z, yaw] = posOn(c); const hx = Math.sin(yaw), hz = Math.cos(yaw); let gap = 1e9, vLead = 0; c.why = '';
    // car ahead (any car roughly in my path), people / the player (always yield), red lights (virtual stopped car at the stop line)
    for (const o of pool) { if (o === c || !o.on) continue; const dx = o.x - x, dz = o.z - z; const f = dx * hx + dz * hz; if (f <= 0 || f > 40) continue; const lat = Math.abs(dx * hz - dz * hx); if (lat > 1.7) continue; const g = f - 4.6; if (g < gap) { gap = g; c.why = 'car'; vLead = o.v * Math.max(0, Math.sin(o.yaw) * hx + Math.cos(o.yaw) * hz); } }
    for (const p of ppl) { const dx = p.x - x, dz = p.z - z; const f = dx * hx + dz * hz; if (f < -1 || f > 22) continue; const lat = Math.abs(dx * hz - dz * hx); if (lat > 1.3 + p.r) continue; const g = f - 2.4 - p.r; if (g < gap) { gap = Math.max(0, g); vLead = 0; c.why = 'ped'; } }
    let red = false; if (!c.turn) { const e = c.e; const toLine = e.s1 - c.s; if (!c.next) c.next = pickNext(e);
      if (toLine < 45) { const n = e.b; let stop = false; if (n.signal) { const L = lightAt(e.axis, simT + n.ph); if (L === 'r' || (L === 'y' && toLine > c.v * c.v / 6 + 1)) stop = true; }
        if (!stop && toLine < 8 && !canEnter(c)) stop = 'lock';
        if (stop && toLine > -0.5) { if (toLine < gap) { gap = Math.max(0, toLine - 0.3); vLead = 0; red = true; c.why = stop === 'lock' ? 'lock' : 'light'; } }
        const curve = c.next && c.next.dx * e.dx + c.next.dz * e.dz < 0.7; if (curve && toLine < 25) { const vt = 5.5 + toLine * 0.35; if (c.v > vt) gap = Math.min(gap, Math.max(0.5, toLine + 3)), vLead = Math.min(vLead, 5); } } }
    // IDM car-following: smooth, keeps a safe time gap, brakes harder when needed
    const v0 = c.turn ? 6 : c.vmax, a = 2.2, b = 3.2, s0 = 2.2, T = 1.3; const sStar = s0 + Math.max(0, c.v * T + c.v * (c.v - vLead) / (2 * Math.sqrt(a * b))); let acc = a * (1 - Math.pow(c.v / v0, 4) - (gap < 1e8 ? (sStar / Math.max(gap, 0.1)) ** 2 : 0));
    acc = Math.max(-9, Math.min(a, acc)); c.v = Math.max(0, c.v + acc * dt); if (gap < 0.4) c.v = 0; c.brakeOn = acc < -0.6 || c.v < 0.2; if (red && c.v < 0.3) st.stoppedRed++;
    c.s += c.v * dt;
    if (c.turn) { if (c.s >= c.turn.len) { const T2 = c.turn; T2.node.occ.delete(c); c.e = T2.to; c.lane = T2.lane2; c.s = c.e.s0; c.turn = null; c.next = null; c.vmax = vmaxOf(c.e.r); } }
    else if (c.s >= c.e.s1) { c.s = c.s - c.e.s1; startTurn(c); }
    const q = posOn(c); let dy = q[2] - (c.yaw ?? q[2]); dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw = (c.yaw ?? q[2]) + dy * Math.min(1, dt * 10); c.x = q[0]; c.z = q[1]; c.spin += c.v / (c.m.userData.def.wr || 0.34) * dt;
    poseCar(c.m, { x: c.x, y: ground(c.x, c.z), z: c.z, yaw: c.yaw, pitch: 0 }, Math.max(-0.5, Math.min(0.5, dy * 6)), c.spin);
    if (c.brakeOn !== c.brake) { c.brake = c.brakeOn; setBrakeLights(c.m, c.brake); } }
  function init() { const g0 = performance.now(); G = buildGraph(); st.edges = G.edges.length; st.junctions = G.nodes.filter((n) => n.deg >= 3).length; st.signals = G.nodes.filter((n) => n.signal).length; st.nodes = G.nodes.length;
    try { buildTiles(); } catch (err) { console.warn('[traffic] markings', err); } st.initMs = Math.round(performance.now() - g0); ready = true; }
  let packT = 0, tileT = 9;
  function update(dt, now) { if (!ready) { if (now - t0 > 1500 && document.visibilityState !== 'hidden') init(); return; } dt = Math.min(dt, 0.1); simT += dt;
    const inRoom = P.x > 392; root.visible = !inRoom; if (inRoom) { for (const c of pool) if (c.on) free(c); return; }
    if (!packAt || Math.hypot(P.x - packAt[0], P.z - packAt[1]) > 40 || (packT += dt) > 6) { packT = 0; pack(); }
    paint(false);
    if ((tileT += dt) > 1) { tileT = 0; for (const im of tiles.values()) { const [cx, cz] = im.userData.c; im.visible = Math.abs(cx - P.x) < TILE * 0.5 + 260 && Math.abs(cz - P.z) < TILE * 0.5 + 260; } }
    if ((nearT += dt) > 1.5) { nearT = 0; nearEdges(); }
    // lazy pool: build at most one car per frame (no hitch), up to the device cap
    if (pool.length < CAP && near.length && (buildQ += dt) > 0.25) { buildQ = 0; const m = buildCar(designs[pool.length % designs.length], Math.floor(rnd() * 12), { lite: true, noShadow: true }); m.visible = false; root.add(m); pool.push({ m, on: false }); }
    for (const c of pool) { if (c.on && Math.hypot(c.x - P.x, c.z - P.z) > RAD + 30) free(c); if (!c.on && near.length) spawn(c, near); }
    const ppl = people(); st.stoppedRed = 0; let n = 0; for (const c of pool) if (c.on) { drive(c, dt, ppl); n++; } st.cars = n;
    // gentle push: a walking player overlapping a car slides aside (never hurt)
    for (const c of pool) if (c.on) { const dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz); if (d < 2.2 && d > 0.01) { P.x += dx / d * (2.2 - d) * 0.3; P.z += dz / d * (2.2 - d) * 0.3; } } }
  function destroy() { for (const c of colCyl) { const i = api.cyl.indexOf(c); if (i >= 0) api.cyl.splice(i, 1); } scene.remove(root); }
  window.__ktApi = { graph: () => G, cars: () => pool.filter((c) => c.on).map((c) => ({ x: c.x, z: c.z, v: c.v, road: c.e.r.id, turn: !!c.turn, why: c.why })), light: (n) => G && lightAt(0, simT + G.nodes[n].ph), setT: (t) => { simT = t; } };
  return { update, destroy, root, stats: st };
}
