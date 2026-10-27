// 🎬 Lone Keem Studio geometry (lazy: imported by theater.js only near the theater). Everything is merged per surface,
// so each editable surface is ONE mesh + ONE material the owner can recolor live. Inside is unlit (MeshBasicMaterial with
// baked shading) so dimming the house lights is just a material color change: no real lights, no shadow maps, phone fast.
import { DECOR, SEATS } from './interior.js';

// Default look = the red reference auditorium + a burgundy/gold lobby and facade. Keys are what the owner recolors.
export const SURF = {
  aCarpet: ['Carpet', '#8f1d22', 'a'], aWall: ['Padded walls', '#a3191f', 'a'], aPanel: ['Side panels', '#7a1016', 'a'], aStage: ['Stage', '#111111', 'a'],
  aFrame: ['Screen frame', '#0b0b0b', 'a'], aScreen: ['Screen', '#f5f5f5', 'a'], aCeil: ['Ceiling', '#3a080c', 'a'], aTruss: ['Light truss', '#2b2b2f', 'a'],
  aRail: ['Handrails', '#c9ccd1', 'a'], aSeatF: ['Seat frames', '#5e0d12', 'a'], aSeatC: ['Seat cushions', '#c4161c', 'a'], aStep: ['Step edges', '#ffffff', 'a'],
  aCurt: ['Curtains', '#8b0f17', 'a'], aLight: ['House light color', '#fff1d6', 'a'], aAisle: ['Aisle lights', '#ffb14a', 'a'], aSpot: ['Spotlight color', '#ffffff', 'a'],
  lFloor: ['Lobby carpet', '#5a0f14', 'l'], lWall: ['Lobby walls', '#2a1416', 'l'], lCeil: ['Lobby ceiling', '#1b1012', 'l'], lCounter: ['Counters', '#800020', 'l'],
  lTop: ['Counter tops', '#f3e3c3', 'l'], lTrim: ['Gold trim', '#d4af37', 'l'], lPoster: ['Poster frames', '#d4af37', 'l'], lLight: ['Lobby light color', '#ffe8c2', 'l'],
  oWall: ['Building walls', '#7d1b1f', 'o'], oTrim: ['Trim', '#f1e3c6', 'o'], oMarq: ['Marquee + bulbs', '#d4af37', 'o'], oSign: ['Sign', '#800020', 'o'],
  oDoor: ['Doors', '#1c1c22', 'o'], oWalk: ['Sidewalk', '#c9c3b8', 'o'], oLot: ['Parking lot', '#3a3d42', 'o'], oLine: ['Lot lines', '#ffffff', 'o']
};
export const ZONES = { a: '🎬 Auditorium', l: '🍿 Lobby', o: '🏛️ Outside' };
export const DEF = Object.fromEntries(Object.entries(SURF).map(([k, v]) => [k, v[1]]));

// Theater furniture (same part format as interior.js DECOR: [shape, color, x, y, z, sx, sy, sz, glow, part]).
// 'A' = main color, 'T' = trim; parts f/s/p/c can be recolored one by one like house furniture.
export const TDECOR = {
  xb: { n: 'Padded Bench', e: '🛋️', foot: [3, .8], p: [['box', 'T', 0, .2, 0, 3, .4, .8, 0, 'f'], ['box', 'A', 0, .46, 0, 2.95, .14, .76, 0, 'c'], ['box', 'A', 0, .9, -.34, 2.95, .8, .14, 0, 'c'], ['box', 'T', 0, 1.32, -.34, 3, .06, .18, 0, 'f']] },
  xo: { n: 'Round Ottoman', e: '⭕', foot: [2.4, 2.4], p: [['cyl', 'T', 0, .2, 0, 2.5, .4, 2.5, 0, 'f'], ['cyl', 'A', 0, .45, 0, 2.4, .12, 2.4, 0, 'c'], ['cyl', 'A', 0, .9, 0, .7, .9, .7, 0, 'c'], ['sph', 'T', 0, 1.4, 0, .5, .5, .5, 0, 'f']] },
  xt: { n: 'Cafe Table', e: '☕', foot: [.9, .9], p: [['cyl', 'T', 0, .76, 0, .95, .05, .95, 0, 'f'], ['cyl', '#2b2b2f', 0, .38, 0, .1, .76, .1], ['cyl', '#2b2b2f', 0, .03, 0, .55, .05, .55]] },
  xc: { n: 'Cafe Chair', e: '🪑', foot: [.5, .5], p: [['box', 'A', 0, .45, 0, .5, .08, .5, 0, 'c'], ['box', 'A', 0, .78, -.23, .5, .6, .06, 0, 'c'], ['cyl', 'T', .2, .22, .2, .05, .45, .05, 0, 'f'], ['cyl', 'T', -.2, .22, .2, .05, .45, .05, 0, 'f'], ['cyl', 'T', .2, .22, -.2, .05, .45, .05, 0, 'f'], ['cyl', 'T', -.2, .22, -.2, .05, .45, .05, 0, 'f']] },
  xl: { n: 'Street Lamp', e: '🏮', foot: [.4, .4], p: [['cyl', '#1c1c22', 0, 1.6, 0, .12, 3.2, .12, 0, 'f'], ['cyl', '#1c1c22', 0, .06, 0, .4, .12, .4, 0, 'f'], ['sph', '#fff3c4', 0, 3.35, 0, .45, .45, .45, 1]] },
  xp: { n: 'Planter', e: '🪴', foot: [1, 1], p: [['box', 'T', 0, .35, 0, 1, .7, 1, 0, 'f'], ['sph', '#2f7d3a', 0, 1, 0, 1.1, .9, 1.1], ['sph', '#ff6b8a', .25, 1.3, .2, .25, .25, .25], ['sph', '#ffd34d', -.25, 1.25, -.15, .22, .22, .22]] },
  xn: { n: 'Park Bench', e: '🪵', foot: [2, .7], p: [['box', 'A', 0, .45, 0, 2, .08, .6, 0, 'c'], ['box', 'A', 0, .8, -.28, 2, .45, .06, 0, 'c'], ['box', '#1c1c22', .9, .22, 0, .08, .45, .55, 0, 'f'], ['box', '#1c1c22', -.9, .22, 0, .08, .45, .55, 0, 'f']] },
  xs: { n: 'Popcorn Stand', e: '🍿', foot: [.9, .9], p: [['box', '#c4161c', 0, .5, 0, .9, 1, .9, 0, 'f'], ['box', '#fff7e0', 0, 1.25, 0, .8, .5, .8, 0, 's'], ['sph', '#ffe28a', 0, 1.55, 0, .7, .3, .7]] },
  xr: { n: 'Velvet Rope', e: '🪢', foot: null, p: [['cyl', '#d4af37', -.9, .5, 0, .1, 1, .1, 0, 'f'], ['cyl', '#d4af37', .9, .5, 0, .1, 1, .1, 0, 'f'], ['box', 'A', 0, .82, 0, 1.8, .07, .07, 0, 'c']] }
};
export const TSEATS = { xb: [[-1, .53, .05, 0], [0, .53, .05, 0], [1, .53, .05, 0]], xo: [[0, .51, .9, 0], [0, .51, -.9, Math.PI], [.9, .51, 0, Math.PI / 2], [-.9, .51, 0, -Math.PI / 2]], xc: [[0, .49, .02, 0]], xn: [[-.5, .49, .05, 0], [.5, .49, .05, 0]] };
const HOUSE_OK = ['cs', 'cl', 'ch', 'bb', 'bp', 'rg', 'rr', 'rs', 'rh', 'lp', 'll', 'lc', 'lt', 'pl', 'pc', 'pt', 'pm', 'ps', 'fw', 'ta', 'cr', 'bs', 'sp', 'pn', 'aq', 'ty', 'kb'];
export const ALL_DECOR = { ...Object.fromEntries(HOUSE_OK.filter((c) => DECOR[c]).map((c) => [c, DECOR[c]])), ...TDECOR };
export const ALL_SEATS = { ...SEATS, ...TSEATS };
export const OUT_OK = ['xl', 'xp', 'xn', 'xr', 'pl', 'pt', 'pm', 'ps', 'fw'];
const ITEM_A = '#b0142a', ITEM_T = '#2a1a14';

// item strings: code,x*2,z*2,rot[,#hex][,fRRGGBB][,sRRGGBB][,pRRGGBB][,cRRGGBB] joined by ';' (house grammar, wider range)
const HX = /^#[0-9a-f]{6}$/i; export const hexOk = (s) => { const t = String(s || '').trim().toLowerCase(); return HX.test(t) ? t : ''; };
export function parseT(s, lim = 60) {
  const out = [];
  for (const t of String(s || '').split(';')) {
    const p = t.split(','); const c = p[0]; if (!ALL_DECOR[c]) continue;
    const x = +p[1] / 2, z = +p[2] / 2; if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > lim || Math.abs(z) > lim) continue;
    const it = { c, x, z, r: (+p[3] || 0) & 3 };
    for (let i = 4; i < p.length; i++) { const m = /^([fspc])([0-9a-f]{6})$/i.exec(p[i]); if (m) { (it.parts = it.parts || {})[m[1].toLowerCase()] = '#' + m[2].toLowerCase(); continue; } const h = hexOk(p[i]); if (h) it.col = h; }
    out.push(it); if (out.length >= 90) break;
  }
  return out;
}
export const serT = (L) => L.map((i) => [i.c, Math.round(i.x * 2), Math.round(i.z * 2), i.r & 3].join(',') + (hexOk(i.col) ? ',' + hexOk(i.col) : '') + ['f', 's', 'p', 'c'].map((k) => (i.parts && hexOk(i.parts[k]) ? ',' + k + hexOk(i.parts[k]).slice(1) : '')).join('')).join(';');
export const partsOf = (code) => { const s = new Set(); for (const p of (ALL_DECOR[code] || {}).p || []) if (p[9]) s.add(p[9]); return [...s]; };

export function makeKit(THREE) {
  const tq = new THREE.Quaternion(), tm = new THREE.Matrix4(), tv = new THREE.Vector3(), ts = new THREE.Vector3(), eu = new THREE.Euler(), col = new THREE.Color(), nv = new THREE.Vector3(), Ld = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
  const G = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14), sph: new THREE.SphereGeometry(0.5, 12, 8), plane: new THREE.PlaneGeometry(1, 1), cone: new THREE.ConeGeometry(0.5, 1, 14) };
  const B = new Map();
  // bake: true = unlit inside (shade baked into the vertex color); false = lit outside (plain color, the sun shades it)
  function put(k, geo, color, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0, bake = true) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); eu.set(rx, ry, rz); tq.setFromEuler(eu); tm.compose(tv.set(x, y, z), tq, ts.set(sx, sy, sz)); g.applyMatrix4(tm);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), N = g.attributes.normal.array; col.set(color);
    for (let i = 0; i < n; i++) { let f = 1; if (bake) { nv.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); const d = nv.dot(Ld); f = 0.62 + 0.38 * Math.max(0, d) + (N[i * 3 + 1] > 0.5 ? 0.06 : 0); } c[i * 3] = col.r * f; c[i * 3 + 1] = col.g * f; c[i * 3 + 2] = col.b * f; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!B.has(k)) B.set(k, []); B.get(k).push(g);
  }
  function merge(k) {
    const gs = B.get(k); if (!gs || !gs.length) return null; let n = 0; gs.forEach((g) => (n += g.attributes.position.count));
    const out = new THREE.BufferGeometry();
    for (const [a, s] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) { const arr = new Float32Array(n * s); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, s)); }
    out.computeBoundingSphere(); gs.forEach((g) => g.dispose()); B.delete(k); return out;
  }
  function flush(k, mat, parent, shadow) { const geo = merge(k); if (!geo) return null; const m = new THREE.Mesh(geo, mat); if (shadow) { m.castShadow = true; m.receiveShadow = true; } parent.add(m); return m; }
  // one furniture piece (DECOR format) into batch k at local (x, y, z); returns its seats [{x,y,z,yaw}]
  function piece(k, kg, it, y, bake, A = ITEM_A, T = ITEM_T) {
    const D = ALL_DECOR[it.c]; if (!D) return []; const th = it.r * Math.PI / 2, c = Math.cos(th), s = Math.sin(th); const tint = hexOk(it.col);
    const pc = (cl, part) => { const own = part && it.parts && hexOk(it.parts[part]); if (own) return own; if (tint && cl === 'A') return tint; return cl === 'A' ? A : cl === 'T' ? T : cl; };
    for (const [sh, cl, x, yy, z, sx, sy, sz, gl, part] of D.p) { const wx = x * c + z * s, wz = -x * s + z * c; put(gl ? kg : k, G[sh] || G.box, pc(cl, part), it.x + wx, y + yy, it.z + wz, th, sx, sy, sz, 0, 0, bake); }
    return (ALL_SEATS[it.c] || []).map(([x, sy, z, dy]) => ({ x: it.x + x * c + z * s, z: it.z - x * s + z * c, y: y + sy, yaw: th + dy }));
  }
  return { G, put, merge, flush, piece };
}

// ---------------------------------------------------------------- canvases (original art only: no real movies, studios or logos)
export const POSTERS = [
  { t: 'THE SHERIFF', s: 'OF LONE KEEM', a: '#f59e0b', b: '#3b1d0e', i: '🤠' },
  { t: 'SPACE PALS', s: 'TO THE STARS', a: '#7dd3fc', b: '#0b1336', i: '🚀' },
  { t: 'KEMY RACERS', s: 'FULL SPEED', a: '#f43f5e', b: '#1f0a12', i: '🏎️' },
  { t: 'THE BIG BAKE', s: 'A SWEET STORY', a: '#f9a8d4', b: '#3a0f2a', i: '🧁' },
  { t: 'DINO PARK', s: 'PALS', a: '#86efac', b: '#0d2a17', i: '🦕' },
  { t: 'MOON DANCE', s: 'PARTY', a: '#c4b5fd', b: '#1b1035', i: '🌙' }
];
export function posterCanvas(p) {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 280; const g = cv.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 280); gr.addColorStop(0, p.b); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 192, 280);
  g.fillStyle = p.a; g.globalAlpha = 0.18; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(96, 120, 20 + i * 14, 0, 7); g.lineWidth = 3; g.strokeStyle = p.a; g.stroke(); } g.globalAlpha = 1;
  g.font = '86px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.i, 96, 118);
  g.fillStyle = p.a; g.font = '900 25px Inter, Arial, sans-serif'; g.fillText(p.t, 96, 208, 180); g.fillStyle = '#fff'; g.font = '700 15px Inter, Arial, sans-serif'; g.fillText(p.s, 96, 234, 180);
  g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '700 11px Inter, Arial, sans-serif'; g.fillText('LONE KEEM STUDIO · COMING SOON', 96, 262, 184);
  return cv;
}
let ART = new URL('../../assets/series/sheriff/ep1.webp', import.meta.url).href; // the movie's real poster (no copy: same file as the series page)
// theater.js picks the feature poster before building (a family film for under-13 / unknown-age players) and can swap it live
export function setMovieArt(url) { ART = url; }
export const artMeshes = []; // the meshes showing ART (exterior facade + lobby frame)
// the open-movie posters for the lobby frames (assets/theater/films, CC BY Blender Foundation)
const FILM_ART = Object.fromEntries(['big-buck-bunny:bbb', 'spring:spring', 'caminandes-2:c2', 'caminandes-3:c3', 'wing-it:wing'].map((s) => { const [f, id] = s.split(':'); return [id, new URL(`../../assets/theater/films/${f}.webp`, import.meta.url).href]; }));
function movieArt(THREE) { const t = new THREE.TextureLoader().load(ART); t.colorSpace = THREE.SRGBColorSpace; t.userData.src = ART; return t; }
export function textCanvas(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); return cv; }

// ---------------------------------------------------------------- outside: building, marquee, sign, doors, posters, plaza, lot
// world coords; F = ground height. Returns { mats: { key: material[] }, bulbs, signDraw, marqDraw, colliders }
export function buildExterior(THREE, kit, parent, T, F, LOW) {
  const { put, flush, G } = kit; const mats = {}; const reg = (k, m) => { (mats[k] = mats[k] || []).push(m); return m; };
  const lit = (k, o = {}) => reg(k, new THREE.MeshStandardMaterial({ color: DEF[k], vertexColors: true, roughness: o.r ?? 0.8, metalness: o.m ?? 0, ...(o.x || {}) }));
  const p = (k, geo, x, y, z, sx, sy, sz, sh = 1, ry = 0) => put(k, geo, new THREE.Color(sh, sh, sh), x, y, z, ry, sx, sy, sz, 0, 0, false);
  const X1 = T.x1, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, W = T.x1 - T.x0, D = T.z1 - T.z0, H = T.h, dz = T.door[1];
  // walls with a slightly darker rusticated base
  p('oWall', G.box, cx, F + H / 2, cz, W, H, D); p('oWall', G.box, cx, F + 1.1, cz, W + 0.25, 2.2, D + 0.25, 0.82);
  p('oWall', G.box, X1 - 1.5, F + H + 1.6, dz, 2, 3.2, 26); // raised facade parapet over the entrance
  // trim: cornice, base band, pilasters, parapet cap
  p('oTrim', G.box, cx, F + H + 0.3, cz, W + 0.8, 0.6, D + 0.8); p('oTrim', G.box, cx, F + 2.25, cz, W + 0.35, 0.2, D + 0.35);
  p('oTrim', G.box, X1 - 1.5, F + H + 3.3, dz, 2.4, 0.4, 26.4);
  for (const z of [T.z0 + 1, T.z0 + 8, dz - 13.4, dz + 13.4, T.z1 - 8, T.z1 - 1]) p('oTrim', G.box, X1 + 0.12, F + H / 2, z, 0.35, H, 0.8);
  // big facade name sign (canvas) + blade sign
  const signCv = textCanvas(1024, 160, () => {}); const signTex = new THREE.CanvasTexture(signCv); signTex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.75), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false })); sign.position.set(X1 + 0.08, F + H + 1.5, dz); sign.rotation.y = Math.PI / 2; parent.add(sign);
  const bladeCv = textCanvas(128, 640, () => {}); const bladeTex = new THREE.CanvasTexture(bladeCv); bladeTex.colorSpace = THREE.SRGBColorSpace;
  p('oSign', G.box, X1 + 0.9, F + 11.5, T.z0 + 4, 1.0, 12, 2.6); p('oMarq', G.box, X1 + 0.9, F + 17.6, T.z0 + 4, 1.2, 0.3, 2.9); p('oMarq', G.box, X1 + 0.9, F + 5.4, T.z0 + 4, 1.2, 0.3, 2.9);
  for (const s of [1, -1]) { const bl = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 11), new THREE.MeshBasicMaterial({ map: bladeTex, toneMapped: false })); bl.position.set(X1 + 0.9 + s * 0.52, F + 11.5, T.z0 + 4); bl.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; parent.add(bl); }
  // marquee canopy (cantilevered: no posts, so nothing to bump into) + reader board
  const c0 = dz - 9, c1 = dz + 9, cX = X1 + 2.9;
  p('oSign', G.box, cX, F + 4.85, dz, 5.8, 0.8, 18); p('oMarq', G.box, cX, F + 4.4, dz, 5.6, 0.1, 17.8, 1.15); p('oTrim', G.box, X1 + 5.85, F + 4.85, dz, 0.16, 0.9, 18.2);
  p('oSign', G.box, X1 + 5.5, F + 6.5, dz, 0.5, 2.6, 16.5); p('oMarq', G.box, X1 + 5.5, F + 7.9, dz, 0.6, 0.2, 16.8); p('oMarq', G.box, X1 + 5.5, F + 5.15, dz, 0.6, 0.2, 16.8);
  const marqCv = textCanvas(1024, 160, () => {}); const marqTex = new THREE.CanvasTexture(marqCv); marqTex.colorSpace = THREE.SRGBColorSpace;
  const marq = new THREE.Mesh(new THREE.PlaneGeometry(15.6, 2.3), new THREE.MeshBasicMaterial({ map: marqTex, toneMapped: false })); marq.position.set(X1 + 5.77, F + 6.5, dz); marq.rotation.y = Math.PI / 2; parent.add(marq);
  const marqB = marq.clone(); marqB.position.x = X1 + 5.23; marqB.rotation.y = -Math.PI / 2; parent.add(marqB);
  // chase-light bulbs: one InstancedMesh, colors stepped a few times a second
  const bulbPts = [];
  for (let z = c0 + 0.4; z <= c1 - 0.4; z += 0.6) { bulbPts.push([X1 + 5.95, F + 4.85, z]); bulbPts.push([X1 + 5.85, F + 8.1, z]); }
  for (let x = X1 + 0.4; x < X1 + 5.8; x += 0.6) { bulbPts.push([x, F + 4.32, c0 + 0.1]); bulbPts.push([x, F + 4.32, c1 - 0.1]); }
  for (let y = F + 5.8; y < F + 17.3; y += 0.55) { bulbPts.push([X1 + 0.9, y, T.z0 + 2.65]); bulbPts.push([X1 + 0.9, y, T.z0 + 5.35]); }
  for (let z = dz - 11.5; z <= dz + 11.5; z += 0.7) bulbPts.push([X1 + 0.15, F + H - 0.3, z]);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false }), bulbPts.length);
  { const m = new THREE.Matrix4(); bulbPts.forEach((q, i) => { m.makeTranslation(q[0], q[1], q[2]); bulbs.setMatrixAt(i, m); bulbs.setColorAt(i, new THREE.Color('#ffd36b')); }); } parent.add(bulbs);
  // glass doors (4 pairs) with frames + gold handles
  const glass = new THREE.MeshStandardMaterial({ color: '#9fd3ff', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55, emissive: '#3a2a10', emissiveIntensity: 0.5 });
  for (let i = 0; i < 4; i++) { const z = dz - 4.5 + i * 3; p('oDoor', G.box, X1 + 0.1, F + 1.7, z, 0.22, 3.4, 2.9); const gl = new THREE.Mesh(G.box, glass); gl.scale.set(0.05, 2.9, 1.15); for (const s of [-0.65, 0.65]) { const g2 = gl.clone(); g2.position.set(X1 + 0.23, F + 1.65, z + s); parent.add(g2); } p('oMarq', G.box, X1 + 0.3, F + 1.5, z - 0.12, 0.08, 0.5, 0.06); p('oMarq', G.box, X1 + 0.3, F + 1.5, z + 0.12, 0.08, 0.5, 0.06); }
  p('oDoor', G.box, X1 + 0.1, F + 3.55, dz, 0.24, 0.3, 12.2);
  // poster cases on the facade
  const posters = [];
  [[dz - 9.7, 0], [dz - 6.6, 1], [dz + 6.6, 2], [dz + 9.7, 3]].forEach(([z, i]) => { p('oMarq', G.box, X1 + 0.12, F + 2.6, z, 0.18, 3.5, 2.5); const tx = i === 0 ? movieArt(THREE) : new THREE.CanvasTexture(posterCanvas(POSTERS[i])); tx.colorSpace = THREE.SRGBColorSpace; const pm = new THREE.Mesh(new THREE.PlaneGeometry(i === 0 ? 1.93 : 2.1, 3.1), new THREE.MeshBasicMaterial({ map: tx })); pm.position.set(X1 + 0.23, F + 2.6, z); pm.rotation.y = Math.PI / 2; parent.add(pm); posters.push(pm); if (i === 0) artMeshes.push(pm); });
  // plaza / sidewalks (the lot itself has NO colliders so cars park freely)
  const Lt = T.lot; p('oWalk', G.box, X1 + 2, F + 0.03, cz, 4, 0.06, D + 8); p('oWalk', G.box, (X1 + Lt.x1) / 2, F + 0.03, Lt.z0 - 1.2, Lt.x1 - X1, 0.06, 2.4); p('oWalk', G.box, (X1 + Lt.x1) / 2, F + 0.03, Lt.z1 + 1.2, Lt.x1 - X1, 0.06, 2.4);
  p('oWalk', G.box, cx, F + 0.03, T.z0 - 1.5, W + 2, 0.06, 3); p('oWalk', G.box, cx, F + 0.03, T.z1 + 1.5, W + 2, 0.06, 3); p('oWalk', G.box, T.x0 - 1.5, F + 0.03, cz, 3, 0.06, D + 6);
  p('oLot', G.box, (Lt.x0 + Lt.x1) / 2, F + 0.025, (Lt.z0 + Lt.z1) / 2, Lt.x1 - Lt.x0, 0.05, Lt.z1 - Lt.z0);
  // painted stalls: row A along the building, rows B + C back to back, a drive lane to road pa in the middle
  const ln = (x, z, sx, sz) => p('oLine', G.box, x, F + 0.056, z, sx, 0.012, sz);
  const stalls = []; const ax0 = Lt.x0 + 0.4, ax1 = ax0 + 5.5, bx0 = Lt.x1 - 11.5, bx1 = bx0 + 5.5, cx1 = bx1 + 5.5;
  for (let z = Lt.z0 + 1; z <= Lt.z1 - 1 + 0.01; z += 3) ln((ax0 + ax1) / 2, z, 5.5, 0.14);
  for (let z = Lt.z0 + 1; z < Lt.z1 - 1; z += 3) stalls.push({ x: (ax0 + ax1) / 2, z: z + 1.5, yaw: -Math.PI / 2 });
  ln(ax1, (Lt.z0 + Lt.z1) / 2, 0.14, Lt.z1 - Lt.z0 - 2);
  const gap0 = dz - 6, gap1 = dz + 6;
  for (const [z0, z1] of [[Lt.z0 + 1, gap0], [gap1, Lt.z1 - 1]]) { for (let z = z0; z <= z1 + 0.01; z += 3) { ln((bx0 + cx1) / 2, z, 11, 0.14); } ln(bx1, (z0 + z1) / 2, 0.14, z1 - z0); for (let z = z0; z < z1 - 0.01; z += 3) { stalls.push({ x: (bx0 + bx1) / 2, z: z + 1.5, yaw: Math.PI / 2 }); stalls.push({ x: (bx1 + cx1) / 2, z: z + 1.5, yaw: -Math.PI / 2 }); } }
  for (const z of [dz - 2.5, dz + 2.5]) for (let x = ax1 + 1.5; x < Lt.x1 - 1; x += 3.2) ln(x, z, 1.6, 0.16); // dashed lane
  // arrows (little chevrons) in the drive aisle
  for (let z = Lt.z0 + 6; z < Lt.z1 - 4; z += 9) { put('oLine', G.box, new THREE.Color(1, 1, 1), (ax1 + bx0) / 2 - 0.35, F + 0.056, z, Math.PI / 4, 0.14, 0.012, 1.2, 0, 0, false); put('oLine', G.box, new THREE.Color(1, 1, 1), (ax1 + bx0) / 2 + 0.35, F + 0.056, z, -Math.PI / 4, 0.14, 0.012, 1.2, 0, 0, false); }
  // lot lights + P sign just outside the lot edges (thin colliders off the painted area)
  const cols = []; const poles = [[Lt.x0 - 0.8, Lt.z0 - 0.8], [Lt.x0 - 0.8, Lt.z1 + 0.8], [Lt.x1 - 1.2, Lt.z0 - 1.6], [Lt.x1 - 1.2, Lt.z1 + 1.6]];
  for (const [x, z] of poles) { p('oDoor', G.cyl, x, F + 3.5, z, 0.2, 7, 0.2); p('oDoor', G.box, x, F + 7, z, 1.6, 0.18, 0.4); cols.push({ x, z, r: 0.16, top: 99 }); }
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fff4cf', toneMapped: false }); for (const [x, z] of poles) { const l = new THREE.Mesh(G.box, lampMat); l.scale.set(1.3, 0.06, 0.3); l.position.set(x, F + 6.88, z); parent.add(l); }
  const pCv = textCanvas(128, 128, (g) => { g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = '900 96px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 64, 70); });
  { const x = Lt.x1 - 1.2, z = gap0 - 0.8; p('oDoor', G.cyl, x, F + 1.4, Lt.z0 - 1.6 + 0.01, 0.01, 0.01, 0.01); void z; const ps = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(pCv) })); ps.position.set(poles[2][0] + 0.12, F + 2.6, poles[2][1]); ps.rotation.y = Math.PI / 2; parent.add(ps); }
  const meshes = {};
  for (const k of ['oWall', 'oTrim', 'oMarq', 'oSign', 'oDoor', 'oWalk', 'oLot', 'oLine']) meshes[k] = flush(k, lit(k, k === 'oMarq' ? { r: 0.35, m: 0.5 } : k === 'oDoor' ? { r: 0.4, m: 0.3 } : {}), parent, !LOW && ['oWall', 'oTrim', 'oSign', 'oMarq', 'oDoor'].includes(k));
  meshes.oLot && (meshes.oLot.receiveShadow = true); meshes.oWalk && (meshes.oWalk.receiveShadow = true);
  return { mats, bulbs, bulbN: bulbPts.length, signCv, signTex, bladeCv, bladeTex, marqCv, marqTex, cols, stalls, meshes };
}

// ---------------------------------------------------------------- inside (local coords around the hidden room centre)
// Auditorium z -22..4 (screen at the -z end), lobby z 4..22 at floor height LY. Rows step up 0.5 m every 1.4 m.
export const IN = { X: 21, Z0: -22, Z1: 22, LY: 4, ROWS: 8, RZ: -11, RD: 1.4, RH: 0.5, SCR: { w: 32, h: 13.4, y: 2.6, z: -21.3, R: 60 } };
export const CURVE = 0.003; const cz = (x) => -CURVE * x * x; // rows bow toward the screen (about 1 m at the ends)
const BLOCKS = [[-18, -9.6, 8], [-7, 7, 14], [9.6, 18, 8]]; const AISLES = [[-21, -18], [-9.6, -7], [7, 9.6], [18, 21]];
export function buildInterior(THREE, kit, parent, LOW) {
  const { put, flush, G } = kit; const mats = {}; const basic = (k, o = {}) => { const m = new THREE.MeshBasicMaterial({ color: DEF[k], vertexColors: true, toneMapped: false, ...o }); (mats[k] = mats[k] || []).push(m); return m; };
  const p = (k, geo, x, y, z, sx, sy, sz, sh = 1, ry = 0) => put(k, geo, new THREE.Color(sh, sh, sh), x, y, z, ry, sx, sy, sz);
  const { X, Z0, Z1, LY, ROWS, RZ, RD, RH } = IN; const boxes = []; const solid = (x0, x1, z0, z1, top, bot = -2) => boxes.push({ x0, x1, z0, z1, top, bot });
  // --- auditorium shell: long, gently curved stadium rows (custom stepped surface that follows the curve)
  p('aCarpet', G.box, 0, -0.05, (Z0 + RZ) / 2, 2 * X, 0.1, RZ - Z0); // flat front floor
  const QD = new Map(); const Q = (k, sh, a, b, c, d) => { const key = k + '|' + sh; if (!QD.has(key)) QD.set(key, []); QD.get(key).push(a, b, c, a, c, d); };
  function stairs(x0, x1, fronts, back, o) { // fronts: [[zBase, top]] front to back; every z follows the curve except the flat back wall
    const n = Math.max(1, Math.ceil((x1 - x0) / 0.5)), cs = Math.max(1, Math.round((x1 - x0) / 2.2));
    for (let k = 0; k < fronts.length; k++) {
      const [zb, top] = fronts[k], prev = k ? fronts[k - 1][1] : 0, nb = k < fronts.length - 1 ? fronts[k + 1][0] : null;
      const zf = (x) => zb + cz(x), ze = (x) => (nb == null ? back : nb + cz(x));
      for (let i = 0; i < n; i++) { const xa = x0 + (x1 - x0) * i / n, xb = x0 + (x1 - x0) * (i + 1) / n, za = zf(xa), zB = zf(xb);
        Q('aCarpet', o.sh * 0.78, [xa, prev, za], [xa, top, za], [xb, top, zB], [xb, prev, zB]);
        Q('aCarpet', o.sh, [xa, top, za], [xa, top, ze(xa)], [xb, top, ze(xb)], [xb, top, zB]);
        Q('aStep', o.esh, [xa, top + 0.006, za], [xa, top + 0.006, za + o.ew], [xb, top + 0.006, zB + o.ew], [xb, top + 0.006, zB]);
        if (o.lit) { const m = (xa + xb) / 2, ok = Math.abs(m - (x0 + x1) / 2) < (x1 - x0) * 0.36; if (ok) Q('aAisle', 1, [xa, top - 0.12, za - 0.01], [xa, top - 0.06, za - 0.01], [xb, top - 0.06, zB - 0.01], [xb, top - 0.12, zB - 0.01]); } }
      for (const [x, sg] of [[x0, -1], [x1, 1]]) { const a = [x, 0, zf(x)], b = [x, 0, ze(x)], c = [x, top, ze(x)], d = [x, top, zf(x)]; if (sg < 0) Q('aCarpet', o.sh * 0.7, a, b, c, d); else Q('aCarpet', o.sh * 0.7, d, c, b, a); }
      for (let j = 0; j < cs; j++) { const xa = x0 + (x1 - x0) * j / cs, xb = x0 + (x1 - x0) * (j + 1) / cs, xm = (xa + xb) / 2; solid(xa, xb, zf(xm), ze(xm), top); }
    }
  }
  for (const [a, b] of BLOCKS) stairs(a, b, Array.from({ length: ROWS }, (_, r) => [RZ + r * RD, RH * (r + 1)]), 4, { sh: 0.92, esh: 0.55, ew: 0.05 });
  for (const [a, b] of AISLES) { const f = []; for (let r = 0; r < ROWS; r++) { f.push([RZ + r * RD, RH * r + RH / 2]); f.push([RZ + r * RD + RD / 2, RH * (r + 1)]); } stairs(a, b, f, 4, { sh: 0.85, esh: 1, ew: 0.09, lit: true }); }
  for (const [key, pts] of QD) { const [k, sh] = key.split('|'); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)); g.computeVertexNormals(); put(k, g, new THREE.Color(+sh, +sh, +sh), 0, 0, 0); g.dispose(); }
  // walls (padded panels), ceiling, front wall, back wall with doorway + projector window
  const AH = 17; p('aWall', G.box, -X - 0.2, AH / 2, (Z0 + 4) / 2, 0.4, AH, 4 - Z0); p('aWall', G.box, X + 0.2, AH / 2, (Z0 + 4) / 2, 0.4, AH, 4 - Z0);
  for (let z = Z0 + 1.5; z < 3.5; z += 2.2) for (let y = 1; y < AH - 1; y += 2.4) for (const s of [-1, 1]) p('aWall', G.box, s * (X - 0.02), y + 1, z, 0.16, 2.2, 2.05, 0.9 + ((Math.round(z) + Math.round(y)) % 2) * 0.06);
  for (const s of [-1, 1]) for (let z = Z0 + 3; z < 3; z += 6.6) p('aPanel', G.box, s * (X - 0.15), 7.5, z, 0.3, 13, 1.1);
  p('aCeil', G.box, 0, AH + 0.2, (Z0 + 4) / 2, 2 * X + 1, 0.4, 4 - Z0);
  p('aWall', G.box, 0, AH / 2, Z0 - 0.2, 2 * X + 0.8, AH, 0.4, 0.55);
  p('aWall', G.box, -12, LY + (AH - LY) / 2, 4.15, 18, AH - LY, 0.3, 0.75); p('aWall', G.box, 12, LY + (AH - LY) / 2, 4.15, 18, AH - LY, 0.3, 0.75); p('aWall', G.box, 0, LY + 3.2 + (AH - LY - 3.2) / 2, 4.15, 6, AH - LY - 3.2, 0.3, 0.75);
  p('aFrame', G.box, 0, LY + 9.2, 4.0, 3.2, 1.6, 0.2); // projector booth window frame
  // stage + black masking + curtains
  p('aStage', G.box, 0, 0.5, (Z0 + RZ - 6) / 2 - 0.1, 2 * X - 4, 1.0, RZ - 6 - Z0); solid(-X + 2, X - 2, Z0, RZ - 6, 1.0);
  p('aStep', G.box, 0, 1.0, RZ - 6.02, 2 * X - 4, 0.03, 0.06, 0.7);
  for (const s of [-1, 1]) { for (let i = 0; i < 9; i++) p('aCurt', G.cyl, s * (17.4 + i * 0.4), 1 + 7.5, Z0 + 1.2 + (i % 2) * 0.2, 0.5, 15, 0.5, 0.85 + (i % 3) * 0.07); }
  p('aCurt', G.box, 0, AH - 1.2, Z0 + 1.0, 2 * X, 2.4, 0.4, 0.8);
  // big curved screen + black frame
  const S = IN.SCR, th = S.w / S.R; const scrGeo = new THREE.CylinderGeometry(S.R, S.R, S.h, 40, 1, true, Math.PI - th / 2, th);
  const scrCv = document.createElement('canvas'); scrCv.width = LOW ? 768 : 1024; scrCv.height = Math.round(scrCv.width * S.h / S.w); const scrTex = new THREE.CanvasTexture(scrCv); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.wrapS = THREE.RepeatWrapping; scrTex.repeat.x = -1;
  const scrMat = new THREE.MeshBasicMaterial({ map: scrTex, side: THREE.BackSide, toneMapped: false }); (mats.aScreen = mats.aScreen || []).push(scrMat);
  const screen = new THREE.Mesh(scrGeo, scrMat); screen.position.set(0, S.y + S.h / 2, S.z + S.R); parent.add(screen);
  { const fr = (x, y, z, sx, sy, sz, ry) => put('aFrame', G.box, new THREE.Color(1, 1, 1), x, y, z, ry, sx, sy, sz); const n = 16;
    for (let i = 0; i <= n; i++) { const a = -th / 2 + th * i / n, x = Math.sin(a) * (S.R - 0.1), z = S.z + S.R - Math.cos(a) * (S.R - 0.1); fr(x, S.y - 0.3, z, S.w / n + 0.1, 0.6, 0.3, -a); fr(x, S.y + S.h + 0.3, z, S.w / n + 0.1, 0.6, 0.3, -a); }
    for (const s of [-1, 1]) { const a = s * th / 2, x = Math.sin(a) * (S.R - 0.1), z = S.z + S.R - Math.cos(a) * (S.R - 0.1); fr(x + s * 0.35, S.y + S.h / 2, z, 0.7, S.h + 1.2, 0.3, -a); } }
  // ceiling truss with lots of little spotlights (instanced), sconces down the side walls
  const tr = []; for (let z = Z0 + 3; z < 3; z += 5) tr.push(z);
  for (const z of tr) { p('aTruss', G.box, 0, AH - 1.6, z, 2 * X - 2, 0.25, 0.25); p('aTruss', G.box, 0, AH - 2.1, z, 2 * X - 2, 0.25, 0.25); for (let x = -X + 2; x <= X - 2; x += 1.5) p('aTruss', G.box, x, AH - 1.85, z, 0.06, 0.5, 0.06, 1, Math.PI / 4); }
  for (const x of [-12, 0, 12]) p('aTruss', G.box, x, AH - 1.6, (Z0 + 3) / 2, 0.25, 0.25, 3 - Z0 - 3);
  const spots = []; for (const z of tr) for (let x = -X + 2.5; x <= X - 2.4; x += 1.85) spots.push([x, AH - 2.45, z]);
  const canG = new THREE.CylinderGeometry(0.16, 0.12, 0.34, 8); const can = new THREE.InstancedMesh(canG, basic('aTruss'), spots.length);
  const tipM = new THREE.MeshBasicMaterial({ color: DEF.aLight, toneMapped: false }); const tip = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 10), tipM, spots.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); spots.forEach(([x, y, z], i) => { m.makeTranslation(x, y, z); can.setMatrixAt(i, m); m.compose(new THREE.Vector3(x, y - 0.18, z), q, new THREE.Vector3(1, 1, 1)); tip.setMatrixAt(i, m); }); }
  can.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(can.geometry.attributes.position.count * 3).fill(0.8), 3)); parent.add(can); parent.add(tip);
  const sconce = []; for (const s of [-1, 1]) for (let z = Z0 + 4; z < 3; z += 5) sconce.push([s * (X - 0.25), 6.5, z]);
  const scM = new THREE.MeshBasicMaterial({ color: DEF.aLight, toneMapped: false }); const sc = new THREE.InstancedMesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), scM, sconce.length);
  { const m = new THREE.Matrix4(); sconce.forEach(([x, y, z], i) => { m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), new THREE.Vector3(1, 1.6, 1)); sc.setMatrixAt(i, m); }); } parent.add(sc);
  // metal handrails: down every aisle (with posts), along the front row and the back cross aisle (curved), no colliders
  const railGs = []; const top = RH * ROWS;
  const rail = (x0, y0, z0, x1, y1, z1, r = 0.07) => { const dx = x1 - x0, dy = y1 - y0, dz2 = z1 - z0, L = Math.hypot(dx, dy, dz2); if (L < 1e-3) return; const g = new THREE.Object3D(); g.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz2 / L)); g.scale.set(r, L, r); g.updateMatrix(); const gg = G.cyl.toNonIndexed(); gg.applyMatrix4(g.matrix); const n = gg.attributes.position.count, N = gg.attributes.normal.array, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = 0.7 + 0.3 * Math.max(0, N[i * 3 + 1] * 0.6 + N[i * 3] * 0.3 + N[i * 3 + 2] * 0.5); gg.setAttribute('color', new THREE.BufferAttribute(c, 3)); railGs.push(gg); };
  const curveRail = (a, b, y, zb) => { const n = Math.max(2, Math.ceil((b - a) / 1)); for (let i = 0; i < n; i++) { const xa = a + (b - a) * i / n, xb = a + (b - a) * (i + 1) / n; rail(xa, y, zb + cz(xa), xb, y, zb + cz(xb)); } for (let x = a; x <= b + 0.01; x += (b - a) / Math.max(1, Math.round((b - a) / 2.4))) rail(x, y - 0.95, zb + cz(x), x, y, zb + cz(x), 0.05); };
  const aisleRail = (x) => { const z0 = RZ + cz(x), z1 = RZ + RD * ROWS - 0.6 + cz(x); rail(x, 1.0, z0, x, top + 1.0, z1); for (let r = 0; r <= ROWS; r += 2) { const zz = Math.min(z1, RZ + RD * r + 0.2 + cz(x)), yy = Math.min(top, RH * r + RH / 2); rail(x, yy, zz, x, 1.0 + (top) * (zz - z0) / (z1 - z0), zz, 0.05); } };
  for (const s of [-1, 1]) { aisleRail(s * 18.05); aisleRail(s * 20.7); aisleRail(s * 8.3); }
  for (const [a, b] of BLOCKS) { curveRail(a + 0.2, b - 0.2, 0.95, RZ - 0.25); curveRail(a + 0.2, b - 0.2, top + 0.95, RZ + RD * ROWS + 0.05); }
  // green exit signs (always lit) + glow strip over the doorway
  const exitCv = textCanvas(128, 48, (g) => { g.fillStyle = '#0a7d3a'; g.fillRect(0, 0, 128, 48); g.fillStyle = '#eafff1'; g.font = '900 30px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', 64, 26); });
  const exitM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitCv), toneMapped: false });
  for (const [x, y, z, ry] of [[0, LY + 3.7, 3.98, Math.PI], [-X + 0.12, 2.8, Z0 + 3, Math.PI / 2], [X - 0.12, 2.8, Z0 + 3, -Math.PI / 2], [-X + 0.12, top + 3, 2.5, Math.PI / 2], [X - 0.12, top + 3, 2.5, -Math.PI / 2]]) { const e = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), exitM); e.position.set(x, y, z); e.rotation.y = ry; parent.add(e); }
  // projector beam (faint additive cone, brighter while playing)
  const beamM = new THREE.MeshBasicMaterial({ color: '#cfe6ff', transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 24, 1, true), beamM); { const from = new THREE.Vector3(0, LY + 9.2, 3.9), to = new THREE.Vector3(0, S.y + S.h / 2, S.z + 0.5), L = from.distanceTo(to); beam.scale.set(S.w * 0.42, L, S.h * 0.42); beam.position.copy(from).add(to).multiplyScalar(0.5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().sub(from).normalize()); } parent.add(beam);
  // owner spotlight (cone + disc on the stage)
  const spotM = new THREE.MeshBasicMaterial({ color: DEF.aSpot, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const spotCone = new THREE.Mesh(new THREE.ConeGeometry(2.6, AH - 2.4, 24, 1, true), spotM); spotCone.position.set(0, 1 + (AH - 3.4) / 2, -18); parent.add(spotCone);
  const discM = new THREE.MeshBasicMaterial({ color: DEF.aSpot, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const spotDisc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), discM); spotDisc.rotation.x = -Math.PI / 2; spotDisc.position.set(0, 1.03, -18); parent.add(spotDisc);
  // --- lobby (z 4..22 at LY)
  const LX = 16; p('lFloor', G.box, 0, LY - 0.05, 13, 2 * LX, 0.1, 18); solid(-X, X, 4, Z1, LY);
  const LH = 6.5; for (const s of [-1, 1]) { p('lWall', G.box, s * (LX + 0.2), LY + LH / 2, 13, 0.4, LH, 18); solid(s > 0 ? LX : -X - 1, s > 0 ? X + 1 : -LX, 4, Z1, 99); }
  p('lWall', G.box, -9.5, LY + LH / 2, Z1 + 0.2, 13, LH, 0.4); p('lWall', G.box, 9.5, LY + LH / 2, Z1 + 0.2, 13, LH, 0.4); p('lWall', G.box, 0, LY + 3.6 + (LH - 3.6) / 2, Z1 + 0.2, 6, LH - 3.6, 0.4);
  p('lCeil', G.box, 0, LY + LH + 0.2, 13, 2 * LX + 0.8, 0.4, 18.4);
  p('lTrim', G.box, 0, LY + LH - 0.15, 13, 2 * LX - 0.2, 0.3, 17.8); // crown (shows on all walls from inside)
  for (const s of [-1, 1]) p('lTrim', G.box, s * (LX - 0.02), LY + 1.0, 13, 0.08, 0.1, 18);
  // ceiling lights (lobby) + glass front doors
  const lobLights = []; for (let x = -12; x <= 12; x += 6) for (let z = 7; z <= 20; z += 6.5) lobLights.push([x, LY + LH - 0.05, z]);
  const lobM = new THREE.MeshBasicMaterial({ color: DEF.lLight, toneMapped: false }); const lob = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 16), lobM, lobLights.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)); lobLights.forEach(([x, y, z], i) => { m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)); lob.setMatrixAt(i, m); }); } parent.add(lob);
  const glass = new THREE.MeshBasicMaterial({ color: '#9fc7e8', transparent: true, opacity: 0.35, toneMapped: false }); for (const x of [-2.25, -0.75, 0.75, 2.25]) { const gm = new THREE.Mesh(G.box, glass); gm.scale.set(1.35, 3.3, 0.05); gm.position.set(x, LY + 1.7, Z1 + 0.05); parent.add(gm); p('lTrim', G.box, x + 0.55, LY + 1.6, Z1 - 0.05, 0.06, 0.5, 0.08); }
  p('lTrim', G.box, 0, LY + 3.45, Z1, 6.2, 0.2, 0.3); for (const x of [-3, -1.5, 0, 1.5, 3]) p('lTrim', G.box, x, LY + 1.7, Z1, 0.12, 3.4, 0.3);
  // snack counter (west) + ticket counter (east): solid fronts, staff stand behind
  const SN = { x0: -15.6, x1: -6.2, z: 9.6 }, TK = { x0: 7.4, x1: 15.6, z: 9.6 };
  for (const c of [SN, TK]) { p('lCounter', G.box, (c.x0 + c.x1) / 2, LY + 0.55, c.z, c.x1 - c.x0, 1.1, 1.0); p('lTop', G.box, (c.x0 + c.x1) / 2, LY + 1.13, c.z, c.x1 - c.x0 + 0.1, 0.07, 1.15); p('lTrim', G.box, (c.x0 + c.x1) / 2, LY + 0.95, c.z + 0.51, c.x1 - c.x0, 0.08, 0.03); p('lTrim', G.box, (c.x0 + c.x1) / 2, LY + 0.12, c.z + 0.51, c.x1 - c.x0, 0.1, 0.03); solid(c.x0, c.x1, c.z - 0.5, c.z + 0.5, 99); }
  // behind the snack bar: popcorn machine, soda fountain, candy case
  put('lCounter', G.box, new THREE.Color('#ffffff'), -13.6, LY + 0.6, 5.2, 0, 2.2, 1.2, 1.2); put('lCounter', G.box, new THREE.Color('#fff7d6'), -13.6, LY + 1.75, 5.2, 0, 1.6, 1.1, 0.9);
  put('lTop', G.box, new THREE.Color(1, 1, 1), -10.2, LY + 1.3, 4.7, 0, 2.6, 2.6, 0.6); put('lTop', G.box, new THREE.Color(1, 1, 1), -7.6, LY + 0.5, 5.0, 0, 1.6, 1.0, 0.9);
  for (const c of [TK]) for (let x = c.x0 + 1.4; x < c.x1; x += 2.6) { const gm = new THREE.Mesh(G.box, glass); gm.scale.set(2.3, 1.2, 0.04); gm.position.set(x, LY + 1.8, c.z); parent.add(gm); }
  const popM = new THREE.MeshBasicMaterial({ color: '#ffe8a0', toneMapped: false }); { const pc2 = new THREE.Mesh(G.box, popM); pc2.scale.set(1.5, 0.9, 0.85); pc2.position.set(-13.6, LY + 1.72, 5.25); parent.add(pc2); }
  // menu boards + signs (canvas)
  const menuCv = textCanvas(512, 200, () => {}); const menuTex = new THREE.CanvasTexture(menuCv); menuTex.colorSpace = THREE.SRGBColorSpace;
  { const mb = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 3.36), new THREE.MeshBasicMaterial({ map: menuTex, toneMapped: false })); mb.position.set(-10.9, LY + 4.3, 4.32); parent.add(mb); }
  const tkCv = textCanvas(512, 160, (g) => { g.fillStyle = '#800020'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#d4af37'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 144); g.fillStyle = '#f3e3c3'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 56px Inter, Arial, sans-serif'; g.fillText('🎟️ TICKETS', 256, 62); g.font = '700 28px Inter, Arial, sans-serif'; g.fillStyle = '#d4af37'; g.fillText('Free entry today · Enjoy the show!', 256, 118); });
  { const tb = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tkCv), toneMapped: false })); tb.position.set(11.5, LY + 4.3, 4.32); parent.add(tb); }
  const audCv = textCanvas(512, 96, (g) => { g.fillStyle = '#111'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#d4af37'; g.font = '900 46px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('★ AUDITORIUM 1 ★', 256, 50); });
  { const ab = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(audCv), toneMapped: false })); ab.position.set(0, LY + 4.0, 4.33); parent.add(ab); }
  // a framed poster for every film in the rotation (gold frames, the Sheriff style), each with a small title plate on top
  // (title + next showtime, drawn by theater.js ~1x a second in the lobby). Slot 'sheriff' shows ART (a family film for kids).
  const pf = [[LX - 0.05, 13.5, -Math.PI / 2, 'sheriff'], [-LX + 0.05, 13.5, Math.PI / 2, 'bbb'], [-LX + 0.05, 18.5, Math.PI / 2, 'spring'], [LX - 0.05, 18.5, -Math.PI / 2, 'wing'], [6.5, Z1 - 0.05, Math.PI, 'c2'], [-6.5, Z1 - 0.05, Math.PI, 'c3']];
  const lobbyPosters = [];
  for (const [x, z, ry, id] of pf) { const nx = Math.sin(ry), nz = Math.cos(ry), big = id === 'sheriff', pw = big ? 2.55 : 2.2, ph = pw * 694 / 432, py = LY + (big ? 3.3 : 3.2);
    put('lPoster', G.box, new THREE.Color(1, 1, 1), x, py, z, ry, pw + 0.4, ph + 0.45, 0.14);
    // texture loads with the interior (first visit only); small webp (432x694, < 40 KB)
    const tx = big ? movieArt(THREE) : (() => { const t = new THREE.TextureLoader().load(FILM_ART[id]); t.colorSpace = THREE.SRGBColorSpace; t.userData.src = FILM_ART[id]; return t; })();
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); pm.position.set(x + nx * 0.08, py, z + nz * 0.08); pm.rotation.y = ry; pm.name = 'th-poster-' + id; parent.add(pm); if (big) artMeshes.push(pm);
    const ty = py + ph / 2 + 0.55; put('lTrim', G.box, new THREE.Color(1, 1, 1), x + nx * 0.02, ty, z + nz * 0.02, ry, pw + 0.1, 0.58, 0.12);
    const cv = textCanvas(512, 120, (g) => { g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, 512, 120); }), pt = new THREE.CanvasTexture(cv); pt.colorSpace = THREE.SRGBColorSpace;
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.05, (pw - 0.05) * 120 / 512), new THREE.MeshBasicMaterial({ map: pt, toneMapped: false })); lb.position.set(x + nx * 0.09, ty, z + nz * 0.09); lb.rotation.y = ry; parent.add(lb);
    lobbyPosters.push({ id, mesh: pm, cv, tex: pt, key: '' }); }
  // "Now Showing" stand by the entrance: the poster + next showtime (canvas drawn by theater-movie.js once a second)
  const NS = { x: 5.2, z: 13.2, ry: -0.45 }; const nsCv = textCanvas(384, 640, (g) => { g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, 384, 640); }); const nsTex = new THREE.CanvasTexture(nsCv); nsTex.colorSpace = THREE.SRGBColorSpace;
  { const nx = Math.sin(NS.ry), nz = Math.cos(NS.ry); put('lPoster', G.box, new THREE.Color(1, 1, 1), NS.x, LY + 2.15, NS.z, NS.ry, 2.25, 3.55, 0.12); put('lTrim', G.box, new THREE.Color(1, 1, 1), NS.x, LY + 0.06, NS.z, NS.ry, 1.4, 0.12, 0.8);
    for (const s of [-1, 1]) put('lTrim', G.box, new THREE.Color(1, 1, 1), NS.x + Math.cos(NS.ry) * s * 0.85 - nx * 0.12, LY + 0.2, NS.z - Math.sin(NS.ry) * s * 0.85 - nz * 0.12, NS.ry, 0.08, 0.4, 0.08);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3.33), new THREE.MeshBasicMaterial({ map: nsTex, toneMapped: false })); nm.position.set(NS.x + nx * 0.07, LY + 2.15, NS.z + nz * 0.07); nm.rotation.y = NS.ry; parent.add(nm);
    solid(NS.x - 0.8, NS.x + 0.8, NS.z - 0.55, NS.z + 0.55, 99); }
  // showtimes board on the right lobby wall (canvas drawn lazily by theater-movie.js drawBoard, ~1x a second in the lobby)
  const BD = { x: LX - 0.05, z: 8, y: LY + 4.3, w: 6.0, h: 3.4, ry: -Math.PI / 2 }; const bdCv = textCanvas(768, 432, (g) => { g.fillStyle = '#12070a'; g.fillRect(0, 0, 768, 432); }); const bdTex = new THREE.CanvasTexture(bdCv); bdTex.colorSpace = THREE.SRGBColorSpace;
  put('lPoster', G.box, new THREE.Color(1, 1, 1), BD.x, BD.y, BD.z, BD.ry, BD.w + 0.4, BD.h + 0.4, 0.14);
  const bdMesh = new THREE.Mesh(new THREE.PlaneGeometry(BD.w, BD.h), new THREE.MeshBasicMaterial({ map: bdTex, toneMapped: false })); bdMesh.position.set(BD.x - 0.09, BD.y, BD.z); bdMesh.rotation.y = BD.ry; bdMesh.name = 'th-board'; parent.add(bdMesh);
  // flush everything into one mesh per surface
  const meshes = {};
  for (const k of Object.keys(SURF)) { if (k[0] === 'o' || k === 'aScreen') continue; const m = flush(k, basic(k), parent, false); if (m) meshes[k] = m; }
  if (railGs.length) { kit; const merged = (() => { let n = 0; railGs.forEach((g) => (n += g.attributes.position.count)); const out = new THREE.BufferGeometry(); for (const [a, s] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]]) { const arr = new Float32Array(n * s); let o = 0; for (const g of railGs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, s)); } return out; })(); const rm = new THREE.Mesh(merged, basic('aRail')); parent.add(rm); meshes.aRail = rm; }
  // --- seats: two InstancedMeshes (frame + cushion), long gently curved rows facing the screen; ALL sittable
  const seats = []; for (let r = 0; r < ROWS; r++) { const top = RH * (r + 1), zr = RZ + r * RD;
    for (const [a, b, n] of BLOCKS) { const pitch = (b - a) / n; for (let i = 0; i < n; i++) { const x = a + pitch * (i + 0.5); const z = zr + 0.78 + cz(x); const fx = -x, fz = -40 - z, yaw = Math.atan2(fx, fz); seats.push({ x, z, y: top, yaw, row: r, fl: top }); } } }
  const fG = seatGeo(THREE, true, LOW), cG = seatGeo(THREE, false, LOW);
  const fI = new THREE.InstancedMesh(fG, basic('aSeatF'), seats.length), cI = new THREE.InstancedMesh(cG, basic('aSeatC'), seats.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(); seats.forEach((s, i) => { e.set(0, s.yaw, 0); q.setFromEuler(e); m.compose(v.set(s.x, s.y, s.z), q, one); fI.setMatrixAt(i, m); cI.setMatrixAt(i, m); }); }
  parent.add(fI); parent.add(cI);
  return { mats, meshes, boxes, seats, screen, scrCv, scrTex, nsCv, nsTex, NS, bdCv, bdTex, bdMesh, BD, lobbyPosters, beam, beamM, spotCone, spotDisc, spotM, discM, tipM, scM, lobM, menuCv, menuTex, SN, TK, AH, LH, LX };
}
// rounded box (indexed): grid points pulled onto a radius-r skin; bulge puffs one face (y = top, z = front) like a plush cushion
function rbox(THREE, w, h, d, r, s, bulge = 0, ax = 'z') {
  const g = new THREE.BoxGeometry(w, h, d, s, s, s), P = g.attributes.position, N = g.attributes.normal, H = [w / 2, h / 2, d / 2], I = H.map((v) => Math.max(0.001, v - r));
  const remap = (t, i) => { const a = Math.abs(t) / H[i]; return a > 0.99 ? Math.sign(t) * H[i] : a < 0.01 ? 0 : Math.sign(t) * I[i]; }; // interior grid lines sit where the rounding starts
  const v = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) { v.set(remap(P.getX(i), 0), remap(P.getY(i), 1), remap(P.getZ(i), 2)); c.set(Math.max(-I[0], Math.min(I[0], v.x)), Math.max(-I[1], Math.min(I[1], v.y)), Math.max(-I[2], Math.min(I[2], v.z)));
    n.copy(v).sub(c); if (n.lengthSq() < 1e-10) n.set(N.getX(i), N.getY(i), N.getZ(i)); n.normalize(); v.copy(c).addScaledVector(n, r);
    if (bulge) { if (ax === 'z' && v.z > 0) v.z += bulge * Math.max(0, 1 - (v.x / H[0]) ** 2) * Math.max(0, 1 - (v.y / H[1]) ** 2); if (ax === 'y' && v.y > 0) v.y += bulge * Math.max(0, 1 - (v.x / H[0]) ** 2) * Math.max(0, 1 - (v.z / H[2]) ** 2); }
    P.setXYZ(i, v.x, v.y, v.z); N.setXYZ(i, n.x, n.y, n.z); }
  g.deleteAttribute('uv'); return g;
}
// cinema seat facing +z in its own space (rotated by its yaw toward the screen):
// frame = two armrests (shared look of real theater seats) + the back shell; cushion = plush seat + tall rounded backrest
function seatGeo(THREE, frame, LOW) {
  const sg = LOW ? 2 : 4, L = new THREE.Vector3(0.25, 0.8, 0.55).normalize();
  const parts = frame
    ? [[0.445, 0.36, -0.03, 0.1, 0.72, 0.64, 0.045, 0, 0, 1], [-0.445, 0.36, -0.03, 0.1, 0.72, 0.64, 0.045, 0, 0, 1], [0, 0.66, -0.43, 0.84, 1.08, 0.08, 0.035, -0.14, 0, 0.8], [0, 0.17, -0.12, 0.62, 0.3, 0.36, 0.04, 0, 0, 0.6]]
    : [[0, 0.45, 0.04, 0.78, 0.17, 0.58, 0.07, -0.06, 0.035, 1.05, 'y'], [0, 0.97, -0.33, 0.76, 0.86, 0.17, 0.075, -0.14, 0.04, 1], [0, 1.38, -0.39, 0.7, 0.16, 0.2, 0.07, -0.14, 0, 1.08]];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
  const gs = parts.map(([x, y, z, w, h, d, r, rx, bu, sh, ax]) => { const g = rbox(THREE, w, h, d, r, (w < 0.2 || d < 0.1) && !LOW ? 3 : sg, bu, ax || 'z'); g.applyMatrix4(m.compose(pv.set(x, y, z), q.setFromEuler(e.set(rx, 0, 0)), one));
    const P = g.attributes.position, N = g.attributes.normal, c = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { const dl = N.getX(i) * L.x + N.getY(i) * L.y + N.getZ(i) * L.z; const ao = 0.72 + 0.28 * Math.min(1, P.getY(i) / 0.9); const f = sh * ao * (0.58 + 0.42 * Math.max(0, dl)); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; });
  let nv = 0, ni = 0; gs.forEach((g) => { nv += g.attributes.position.count; ni += g.index.count; });
  const out = new THREE.BufferGeometry(), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const [a, s] of [['position', 3], ['normal', 3], ['color', 3]]) { const arr = new Float32Array(nv * s); let o = 0; for (const g of gs) { arr.set(g.attributes[a].array, o); o += g.attributes[a].array.length; } out.setAttribute(a, new THREE.BufferAttribute(arr, s)); }
  for (const g of gs) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx[io + i] = ix[i] + vo; io += ix.length; vo += g.attributes.position.count; g.dispose(); }
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
}
