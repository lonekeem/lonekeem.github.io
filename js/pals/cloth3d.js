// Kemy Pals wardrobe v2: tailored, fabric-shaded clothes that conform to the shared rig.
// Garments are built from the SAME torso profile as the body (offset outward), live in the
// body-type group (so they scale with small/medium/large/long/round Pals), and sleeves / pant
// legs are split at the elbow / knee onto the arm and leg bones so they bend with dances.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

// body profile used by pal3d.js for the blob torso (radius, y) in Spine space
export const TORSO_PTS = [[0, -0.24], [0.2, -0.22], [0.33, -0.15], [0.41, -0.02], [0.42, 0.1], [0.38, 0.24], [0.31, 0.36], [0.25, 0.46], [0.22, 0.54], [0.2, 0.62], [0, 0.66]];
const PROF = new THREE.SplineCurve(TORSO_PTS.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(160);
export function rAt(y) { // torso radius at height y (monotonic in y along the spline)
  if (y <= PROF[0].y) return PROF[0].x; for (let i = 1; i < PROF.length; i++) if (PROF[i].y >= y) { const a = PROF[i - 1], b = PROF[i]; const k = (y - a.y) / Math.max(1e-6, b.y - a.y); return a.x + (b.x - a.x) * k; } return 0;
}
// body types: [width, height, depth] for the torso group
const TYPES = { small: [0.9, 0.9, 0.92], medium: [1, 1, 1], large: [1.1, 1.05, 1.06], long: [0.93, 1.12, 0.94], round: [1.15, 0.95, 1.1], barrel: [1.24, 0.9, 1.26] };
const BY = {
  round: 'panda bear koala hamster hamsterb piglet penguin seal walrus manatee sloth hippo pufferfish owl yeti rxyeti rxpanda whale rxwhale gorilla golem cupcake boba mole badger',
  large: 'elephant rhino moose cow camel lion tiger trex triceratops bronto wolf husky rxdragon dragon griffin stego',
  long: 'giraffe deer fox otter flamingo swan seahorse rxkitsune zebra horse pegasus kirin unicorn alpaca dalmatian shark dolphin narwhal mermaid ptero',
  small: 'chick duckling mouse bee ladybug hummingbird butterfly firefly robin fairy caterpillar snail cherub rxmoth crab starfish clownfish',
};
BY.barrel = 'capybara'; // wide, deep barrel body (capybara)
const TYPE_OF = {}; for (const [t, s] of Object.entries(BY)) for (const id of s.split(' ')) TYPE_OF[id] = t;
export const bodyType = (id) => TYPE_OF[id] || 'medium';
export const bodyScale = (id) => TYPES[bodyType(id)];

// ---------------------------------------------------------------- fabric materials
const TEX = {};
function canvasTex(key, draw, rep = [4, 4], color = false) {
  if (TEX[key]) return TEX[key]; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); draw(c, 128);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (TEX[key] = t);
}
const WEAVE = {
  plain: () => canvasTex('plain', (c, n) => { const d = c.createImageData(n, n); for (let i = 0; i < d.data.length; i += 4) { const x = (i / 4) % n, y = Math.floor(i / 4 / n); const v = 128 + ((x + y) % 2 ? 14 : -14) + (Math.random() - 0.5) * 20; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.putImageData(d, 0, 0); }, [10, 10]),
  knit: () => canvasTex('knit', (c, n) => { c.fillStyle = '#808080'; c.fillRect(0, 0, n, n); for (let x = 0; x < n; x += 8) for (let y = 0; y < n; y += 8) { const g = c.createLinearGradient(x, y, x + 4, y + 8); g.addColorStop(0, '#c8c8c8'); g.addColorStop(1, '#505050'); c.fillStyle = g; c.beginPath(); c.ellipse(x + 2.2, y + 4, 2, 4, -0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(x + 5.8, y + 4, 2, 4, 0.5, 0, 7); c.fill(); } }, [8, 6]),
  twill: () => canvasTex('twill', (c, n) => { c.fillStyle = '#808080'; c.fillRect(0, 0, n, n); c.strokeStyle = '#b8b8b8'; c.lineWidth = 2; for (let i = -n; i < n * 2; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + n, n); c.stroke(); } }, [8, 8]),
  quilt: () => canvasTex('quiltb', (c, n) => { c.fillStyle = '#909090'; c.fillRect(0, 0, n, n); for (let i = 0; i < 2000; i++) { c.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},.05)`; c.fillRect(Math.random() * n, Math.random() * n, 2, 2); } }, [6, 6]),
};
function prints(kind, a, b) { // colour maps (prints): dots, stars, check (gingham), stripe, fairisle
  return canvasTex(`p_${kind}_${a}_${b}`, (c, n) => { c.fillStyle = a; c.fillRect(0, 0, n, n); c.fillStyle = b;
    if (kind === 'dots') for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.beginPath(); c.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 5, 0, 7); c.fill(); }
    if (kind === 'stars') for (let k = 0; k < 6; k++) { const x = (k * 47) % n + 10, y = (k * 71) % n + 10; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 3 : 7, t = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); } c.fill(); }
    if (kind === 'check') { c.globalAlpha = 0.45; for (let i = 0; i < n; i += 32) { c.fillRect(i, 0, 16, n); c.fillRect(0, i, n, 16); } }
    if (kind === 'stripe') for (let i = 0; i < n; i += 32) c.fillRect(0, i, n, 12);
    if (kind === 'fairisle') { for (let x = 0; x < n; x += 16) { c.beginPath(); c.moveTo(x, 64); c.lineTo(x + 8, 52); c.lineTo(x + 16, 64); c.lineTo(x + 8, 76); c.fill(); c.fillRect(x + 6, 30, 4, 4); c.fillRect(x + 6, 94, 4, 4); } c.fillRect(0, 16, n, 4); c.fillRect(0, 108, n, 4); }
  }, kind === 'fairisle' ? [6, 1] : [5, 3], true);
}
const MATS = new Map();
export function fabric(col, o = {}) {
  const key = col + JSON.stringify(o); if (MATS.has(key)) return MATS.get(key);
  const base = new THREE.Color(col);
  const m = new THREE.MeshPhysicalMaterial({ color: o.map ? 0xffffff : base, map: o.map || null, roughness: o.r ?? 0.86, sheen: o.sheen ?? 0.9, sheenRoughness: 0.45,
    sheenColor: base.clone().lerp(new THREE.Color('#ffffff'), 0.35), clearcoat: o.cc ?? 0, bumpMap: (WEAVE[o.w || 'plain'])(), bumpScale: o.bs ?? 0.9,
    side: o.ds ? THREE.DoubleSide : THREE.FrontSide, transparent: !!o.op, opacity: o.op ?? 1, metalness: o.metal ? 0.8 : 0 });
  if (o.metal) { m.roughness = 0.28; m.bumpMap = null; m.sheen = 0; }
  m.userData.wear = 1; MATS.set(key, m); return m;
}
const hexOf = (c) => '#' + new THREE.Color(c).getHexString();
export const shadeHex = (c, k) => hexOf(k < 0 ? new THREE.Color(c).multiplyScalar(1 + k) : new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k));
const lum = (c) => new THREE.Color(c).getHSL({}).l;
const trimOf = (c) => (lum(c) < 0.45 ? '#f4ece0' : shadeHex(c, -0.28));

// ---------------------------------------------------------------- geometry helpers
const GEO = {};
const geo = (k, f) => GEO[k] || (GEO[k] = f());
// open tube around the Y axis; rf(y, a) gives the radius; a = 0 is the front (+z)
function tube(key, rf, y0, y1, o = {}) {
  return geo(key, () => { const rows = o.rows || 28, segs = o.segs || 56, p0 = o.phi0 ?? 0, pl = o.phiL ?? Math.PI * 2;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= rows; i++) { const y = y0 + (y1 - y0) * i / rows; for (let j = 0; j <= segs; j++) { const a = p0 + pl * j / segs; const r = rf(y, a, i / rows); pos.push(r * Math.sin(a), y, r * Math.cos(a)); uv.push(j / segs, i / rows); } }
    for (let i = 0; i < rows; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, b = a + segs + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; });
}
const ring = (r, t, arc = Math.PI * 2) => geo(`ring${r.toFixed(3)}_${t}_${arc.toFixed(2)}`, () => new THREE.TorusGeometry(r, t, 10, 64, arc));
const ball = (r) => geo('b' + r, () => new THREE.SphereGeometry(r, 24, 16));
const cyl = (r0, r1, h) => geo(`cy${r0.toFixed(3)}_${r1.toFixed(3)}_${h.toFixed(3)}`, () => new THREE.CylinderGeometry(r0, r1, h, 32, 6, true));
const box = (x, y, z) => geo(`bx${x}_${y}_${z}`, () => new THREE.BoxGeometry(x, y, z, 2, 2, 1));
function add(g, m, p, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(g, m); o.castShadow = true; o.position.set(x, y, z); p.add(o); return o; }
// trim ring hugging the torso at height y (inside the torso group: z is squashed like the body)
function band(p, y, off, t, m) { const r = rAt(y) + off; const o = add(ring(r, t), m, p, 0, y, 0); o.rotation.x = Math.PI / 2; o.scale.set(1, 0.88, 1); return o; }

// ---------------------------------------------------------------- dress the body
// K: { J, fit, W }  fit: { ar, lr, ua, la, ul, ll, legs, kind }
export function dressBody(K) {
  const { J, W, fit } = K; if (fit.kind !== 'blob' || !J.TB) return;
  const TB = J.TB, TH = J.TBh; // torso group (Spine) and hip group (Hips), both scaled per body type
  const top = W('body'), bot = W('bottom'), full = W('full');
  const sq = (o) => { o.scale.z = 0.88; return o; };
  // --- building blocks
  const shirt = (col, o = {}) => { // torso shell from hem y0 to neckline y1
    const off = o.off ?? 0.03, y0 = o.y0 ?? -0.13, y1 = o.y1 ?? 0.58, q = o.quilt || 0, k = `sh${off}_${y0}_${y1}_${q}_${o.phi0 || 0}_${o.peplum || 0}`;
    const g = tube(k, (y, a) => { let r = rAt(y) + off; if (q) r += q * Math.abs(Math.sin((y - y0) / 0.13 * Math.PI)); if (o.peplum && y < y0 + 0.08) r += o.peplum * (1 - (y - y0) / 0.08); return r; }, y0, y1, { phi0: o.phi0, phiL: o.phiL });
    const m = add(g, o.mat || fabric(col, o.f || {}), TB); sq(m); if (o.phi0) m.material = (o.mat || fabric(col, { ...(o.f || {}), ds: true }));
    if (!o.noHem) band(TB, y0 + 0.008, off + 0.004, o.hemT ?? 0.018, o.trim ? fabric(o.trim, { w: 'knit' }) : fabric(shadeHex(col, -0.12), o.f || {}));
    if (!o.noNeck) band(TB, y1 - 0.006, off - 0.002, o.neckT ?? 0.02, o.trim ? fabric(o.trim, { w: 'knit' }) : fabric(shadeHex(col, -0.12), o.f || {}));
    // clothed shoulders bridge neckline -> sleeve caps
    for (const s of [-1, 1]) { const y = 0.42, r = 0.1 + off; const c = add(geo(`yoke${off}`, () => new THREE.CapsuleGeometry(r, 0.12, 8, 20)), o.mat || fabric(col, o.f || {}), TB, s * 0.24, y, 0); c.rotation.z = Math.PI / 2 + s * 0.35; c.scale.set(1, 1, 0.8); }
    return m;
  };
  const sleeves = (col, len, o = {}) => { // len: 0 none, 0.5 short, 1 long; o.puff, o.cuff colour, o.quilt
    if (!len) return; const ar = fit.ar, ua = fit.ua, la = fit.la, mt = o.mat || fabric(col, o.f || {}), cuff = fabric(o.cuff || shadeHex(col, -0.12), { w: o.cuffKnit ? 'knit' : (o.f && o.f.w) || 'plain' });
    for (const n of ['Left', 'Right']) { const U = J[n + 'UpperArm'], L = J[n + 'LowerArm']; if (!U) continue; const off = 0.024 + (o.quilt ? 0.025 : 0);
      add(geo(`scap${ar}_${off}`, () => new THREE.SphereGeometry(ar * 1.12 + off, 24, 16)), mt, U); // shoulder
      const ul = len < 1 ? ua * 0.62 : ua; const s1 = add(cyl(ar + off, ar * 0.97 + off, ul), mt, U, 0, -ul / 2, 0);
      if (o.quilt) for (let i = 1; i < 3; i++) { const r = add(ring(ar + off + 0.008, 0.012), fabric(shadeHex(col, -0.1)), U, 0, -ul * i / 3, 0); r.rotation.x = Math.PI / 2; }
      if (o.puff) { const p = add(ball(1), mt, U, 0, -0.06, 0); p.scale.set(ar + 0.07, 0.11, ar + 0.07); }
      if (len < 1) { const h = add(ring(ar * 0.97 + off, 0.014), cuff, U, 0, -ul, 0); h.rotation.x = Math.PI / 2; continue; }
      add(geo(`selb${ar}_${off}`, () => new THREE.SphereGeometry(ar * 0.98 + off, 24, 16)), mt, L); // elbow cover bends with the joint
      const ll = la * 0.8; add(cyl(ar * 0.95 + off, ar * 0.9 + off, ll), mt, L, 0, -ll / 2, 0);
      if (o.fold) { const f = add(ring(ar * 0.95 + off, 0.008), mt, L, 0, -ll * 0.35, 0); f.rotation.x = Math.PI / 2 + 0.15; }
      const c = add(ring(ar * 0.9 + off + 0.004, o.cuffKnit ? 0.022 : 0.015), cuff, L, 0, -ll, 0); c.rotation.x = Math.PI / 2;
      void s1; }
  };
  const pants = (col, len, o = {}) => { // len 0.5 shorts, 1 long; seat on the hip group, legs on leg bones
    if (!TH) return; const mt = o.mat || fabric(col, o.f || { w: 'twill' }); const lr = fit.lr, ul = fit.ul, ll = fit.ll;
    const seat = add(tube('seat2', (y) => rAt(Math.max(y, -0.19)) + 0.03, -0.2, -0.02, {}), mt, TH); sq(seat);
    const cr = add(ball(1), mt, TH, 0, -0.19, 0); cr.scale.set(0.27, 0.07, 0.22);
    band(TH, -0.025, 0.032, 0.02, fabric(o.waist || shadeHex(col, -0.15), o.f || { w: 'twill' }));
    if (!fit.legs) return;
    for (const n of ['Left', 'Right']) { const U = J[n + 'UpperLeg'], L = J[n + 'LowerLeg']; const off = 0.026;
      const u = len < 1 ? ul * 0.62 : ul; add(cyl(lr + off + 0.01, lr * 0.93 + off, u), mt, U, 0, -u / 2, 0); add(ball(lr * 1.15 + off * 0.6), mt, U);
      if (len < 1) { const h = add(ring(lr * 0.93 + off, 0.016), fabric(o.cuff || shadeHex(col, -0.15), o.f || { w: 'twill' }), U, 0, -u, 0); h.rotation.x = Math.PI / 2; continue; }
      add(ball(lr * 0.95 + off), mt, L); const l = ll * 0.86; add(cyl(lr * 0.9 + off, lr * 0.88 + off + (o.flare || 0), l), mt, L, 0, -l / 2, 0);
      if (o.seam) { const sm = add(box(0.006, l, 0.006), fabric(o.seam, { r: 0.6 }), L, lr * 0.9 + off, -l / 2, 0); void sm; }
      const c = add(ring(lr * 0.88 + off + (o.flare || 0), o.roll ? 0.028 : 0.016), fabric(o.cuff || shadeHex(col, o.roll ? 0.12 : -0.15), o.f || { w: 'twill' }), L, 0, -l, 0); c.rotation.x = Math.PI / 2; }
  };
  const skirt = (col, o = {}) => { // flared, pleated skirt on the hip group
    if (!TH) return; const len = o.len ?? 0.32, flare = o.flare ?? 0.18, pl = o.pleats ?? 16, amp = o.amp ?? 0.018, y0 = o.y0 ?? 0.02;
    const k = `sk${len}_${flare}_${pl}_${amp}_${y0}`; const r0 = rAt(y0 - 0.12) + 0.034;
    const g = tube(k, (y, a, t) => { const u = 1 - t; return (r0 + flare * Math.pow(u, 1.3)) * (1 + amp * u * Math.cos(a * pl)) ; }, y0 - 0.12 - len, y0 - 0.12, { rows: 20, segs: 96 });
    const m = add(g, o.mat || fabric(col, { ds: true, ...(o.f || {}) }), TH); m.scale.z = 0.9;
    if (o.trim) { const h = add(ring(r0 + flare, 0.012), fabric(o.trim), TH, 0, y0 - 0.12 - len + 0.006, 0); h.rotation.x = Math.PI / 2; h.scale.set(1, 0.9, 1); }
    const wb = add(ring(r0, 0.022), fabric(o.waist || shadeHex(col, -0.1)), TH, 0, y0 - 0.12, 0); wb.rotation.x = Math.PI / 2; wb.scale.set(1, 0.88, 1);
    return m;
  };
  const buttons = (n, y0, dy, col, z = 0.03, x = 0) => { const m = fabric(col, { cc: 0.8, r: 0.35 }); for (let i = 0; i < n; i++) { const y = y0 + i * dy; const b = add(geo('btn', () => new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16)), m, TB, x, y, (rAt(y) + z) * 0.88); b.rotation.x = Math.PI / 2; } };
  const pocket = (p, x, y, w, h, col, z) => { const pk = add(box(w, h, 0.012), fabric(col, { w: 'twill' }), p, x, y, z); return pk; };
  const collarPts = (col) => { for (const s of [-1, 1]) { const c = add(geo('cpt', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.09, -0.02); sh.lineTo(0.02, -0.08); sh.lineTo(0, 0); return new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2 }); }), fabric(col), TB, s * 0.012, 0.58, 0.19); c.scale.x = s; c.rotation.x = -0.35; } };
  const lapels = (col) => { for (const s of [-1, 1]) { const l = add(geo('lapel', () => { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.06, 0.02); sh.lineTo(0.13, -0.14); sh.lineTo(0.09, -0.3); sh.lineTo(0.0, -0.36); sh.lineTo(0, 0); return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2 }); }), fabric(col), TB, s * 0.05, 0.58, 0.2); l.scale.x = s; l.rotation.x = -0.32; l.rotation.y = s * 0.28; } };
  const tie = (col) => { const k = add(geo('tie2', () => { const sh = new THREE.Shape(); sh.moveTo(-0.025, 0); sh.lineTo(0.025, 0); sh.lineTo(0.045, -0.24); sh.lineTo(0, -0.29); sh.lineTo(-0.045, -0.24); sh.lineTo(-0.025, 0); return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelSize: 0.005, bevelThickness: 0.004, bevelSegments: 2 }); }), fabric(col, { w: 'twill', sheen: 0.4, r: 0.6 }), TB, 0, 0.56, 0.225); k.rotation.x = -0.3; add(ball(0.03), fabric(col), TB, 0, 0.56, 0.2).scale.set(1, 0.8, 0.6); };
  const socks = (col) => { if (!fit.legs) return; for (const n of ['Left', 'Right']) { const L = J[n + 'LowerLeg']; const m = fabric(col, { w: 'knit' }); add(cyl(fit.lr * 0.9 + 0.012, fit.lr * 0.88 + 0.012, fit.ll * 0.6), m, L, 0, -fit.ll * 0.62, 0); const c = add(ring(fit.lr * 0.9 + 0.014, 0.016), m, L, 0, -fit.ll * 0.33, 0); c.rotation.x = Math.PI / 2; } };
  const blazer = (col, o = {}) => { // tailored, open-front jacket over a shirt
    shirt(o.shirt || '#f7f3ee', { off: 0.026, y0: -0.08, y1: 0.585, noHem: true }); collarPts(o.shirt || '#f7f3ee');
    shirt(col, { off: 0.05, y0: -0.17, y1: 0.56, phi0: 0.34, phiL: Math.PI * 2 - 0.68, noNeck: true, f: { w: 'twill', bs: 0.5 } }); lapels(shadeHex(col, -0.08));
    for (const s of [-1, 1]) { const f = add(box(0.13, 0.03, 0.03), fabric(shadeHex(col, -0.08), { w: 'twill' }), TB, s * 0.22, -0.03, rAt(-0.03) * 0.88 * 0.92 + 0.02); f.rotation.y = s * 0.45; }
    buttons(2, -0.06, 0.1, o.btn || '#d8c39a', 0.056, -0.155); sleeves(col, 1, { cuff: shadeHex(col, -0.1), f: { w: 'twill', bs: 0.5 }, fold: 1 });
  };
  // --- full outfits first; else top + bottom
  if (full) { const st = full.st, c = full.col, tr = trimOf(c);
    if (st === 'dress' || st === 'gown' || st === 'tutudress' || st === 'pinafore') {
      if (st === 'pinafore') { shirt('#f7f3ee', { y0: -0.06, y1: 0.585, off: 0.026 }); collarPts('#f7f3ee'); sleeves('#f7f3ee', 1, { cuff: '#f7f3ee', fold: 1 }); shirt(c, { off: 0.042, y0: -0.12, y1: 0.36, noNeck: true, f: { w: 'twill' } }); for (const s of [-1, 1]) { const st2 = add(geo('pstr', () => new THREE.CapsuleGeometry(0.024, 0.2, 6, 12)), fabric(c, { w: 'twill' }), TB, s * 0.15, 0.46, 0.25 * 0.88); st2.rotation.x = -0.4; } buttons(2, 0.33, 0, '#d8c39a', 0.05, -0.1); buttons(1, 0.33, 0, '#d8c39a', 0.05, 0.1); skirt(c, { len: 0.3, flare: 0.16, pleats: 20, amp: 0.035, f: { w: 'twill' } }); socks('#f7f3ee'); return; }
      shirt(c, { y0: -0.1, y1: 0.57, off: 0.03, noHem: true, f: st === 'gown' ? { sheen: 1, r: 0.55, cc: 0.2 } : {} });
      sleeves(c, 0.5, { puff: 1, cuff: tr });
      const sash = add(ring(rAt(-0.08) + 0.034, 0.024), fabric(st === 'gown' ? '#fff3c4' : tr, { sheen: 1, r: 0.5 }), TB, 0, -0.08, 0); sash.rotation.x = Math.PI / 2; sash.scale.set(1, 0.88, 1);
      for (const s of [-1, 1]) { const b = add(geo('sbow', () => new THREE.ConeGeometry(0.05, 0.11, 18)), fabric(tr, { sheen: 1 }), TB, s * 0.05, -0.08, -0.4); b.rotation.z = s * Math.PI / 2; }
      if (st === 'gown') { skirt(c, { len: 0.52, flare: 0.36, pleats: 12, amp: 0.05, f: { ds: true, sheen: 1, r: 0.55 } }); const tl = skirt(shadeHex(c, 0.45), { len: 0.5, flare: 0.42, pleats: 24, amp: 0.03, f: { ds: true, op: 0.45, sheen: 1 } }); if (tl) tl.scale.set(1.03, 1, 0.93); for (let i = 0; i < 14; i++) { const a = i * 0.449; const r = (rAt(-0.1) + 0.034 + 0.34) * 1.02; add(ball(0.012), fabric('#fff6d0', { metal: 1 }), TH, Math.sin(a) * r, -0.6, Math.cos(a) * r * 0.9); } }
      else if (st === 'tutudress') { for (let i = 0; i < 3; i++) { const t = skirt(shadeHex(c, i * 0.15), { len: 0.13 + i * 0.015, flare: 0.3 - i * 0.04, pleats: 30, amp: 0.08, y0: 0.0 - i * 0.03, f: { ds: true, op: 0.72, sheen: 1 } }); if (t) t.scale.z = 0.92; } }
      else skirt(c, { len: 0.34, flare: 0.2, pleats: 14, amp: 0.03, trim: tr });
      return; }
    if (st === 'overalls') { shirt('#f7f3ee', { y0: -0.06, y1: 0.585, off: 0.024 }); sleeves('#f7f3ee', 0.5, { cuff: '#f7f3ee' });
      pants(c, 1, { roll: 1, seam: '#e8b860', f: { w: 'twill' } }); const bib = shirt(c, { off: 0.04, y0: -0.12, y1: 0.34, phi0: -0.8, phiL: 1.6, noNeck: true, noHem: true, f: { w: 'twill' } }); void bib;
      shirt(c, { off: 0.04, y0: -0.12, y1: 0.06, noNeck: true, noHem: true, f: { w: 'twill' } });
      for (const s of [-1, 1]) { const st2 = add(geo('ostr', () => new THREE.TorusGeometry(0.29, 0.02, 8, 30, Math.PI * 0.95)), fabric(c, { w: 'twill' }), TB, s * 0.15, 0.32, 0); st2.rotation.set(0, Math.PI / 2, Math.PI * 0.03); st2.scale.set(1, 1, 0.92); }
      buttons(1, 0.31, 0, '#e8c05a', 0.048, -0.15); buttons(1, 0.31, 0, '#e8c05a', 0.048, 0.15); pocket(TB, 0, 0.17, 0.14, 0.1, shadeHex(c, -0.08), rAt(0.17) * 0.88 + 0.042); return; }
    if (st === 'pjs' || st === 'pjs2') { const map = st === 'pjs' ? prints('stars', c, '#fff3c4') : prints('check', '#fffaf2', c); const m = fabric('#ffffff', { map, sheen: 0.8 });
      shirt(c, { mat: m, y0: -0.15, y1: 0.58, trim: '#fff3e0', hemT: 0.014, neckT: 0.018 }); collarPts(shadeHex(c, st === 'pjs' ? 0.2 : 0)); const pl = add(box(0.012, 0.6, 0.008), fabric('#fff3e0'), TB, 0, 0.2, rAt(0.2) * 0.88 + 0.035); void pl; buttons(4, -0.06, 0.15, '#fff3e0', 0.042, 0.03);
      sleeves(c, 1, { mat: m, cuff: '#fff3e0' }); pants(c, 1, { mat: m, cuff: '#fff3e0', waist: '#fff3e0' }); return; }
    if (st === 'uniform') { blazer(c, { btn: '#d8c39a' }); tie('#b8434f'); pants(shadeHex(c, 0.15), 0.5, { f: { w: 'twill' } }); socks('#f4f0ea'); const crest = add(geo('crest', () => new THREE.CircleGeometry(0.04, 20)), fabric('#e8c86a'), TB, 0.17, 0.34, rAt(0.34) * 0.88 + 0.058); void crest; return; }
    if (st === 'suit') { blazer(c, { btn: '#2a2438' }); tie('#9a3a4a'); pants(c, 1, { f: { w: 'twill', bs: 0.4 }, seam: shadeHex(c, 0.15) }); return; }
    if (st === 'kit') { shirt(c, { trim: '#ffffff' }); sleeves(c, 0.5, { cuff: '#ffffff' }); const st2 = add(tube('kitstripe', (y) => rAt(y) + 0.034, 0.16, 0.22, { rows: 4 }), fabric('#ffffff'), TB); sq(st2); pants('#ffffff', 0.5, { cuff: c, f: {} }); socks(c); return; }
    if (st === 'coat') { const m = fabric(c, { w: 'quilt', sheen: 1, r: 0.55, cc: 0.35 }); shirt(c, { mat: m, quilt: 0.012, y0: -0.13, y1: 0.6, trim: shadeHex(c, -0.1) });
      skirt(c, { len: 0.3, flare: 0.08, pleats: 0, amp: 0, y0: 0.0, mat: m }); for (let i = 1; i < 3; i++) { const h = add(ring(rAt(-0.12) + 0.04 + 0.03 * i, 0.012), fabric(shadeHex(c, -0.12)), TH, 0, -0.12 - i * 0.1, 0); h.rotation.x = Math.PI / 2; h.scale.set(1, 0.9, 1); }
      const fur = add(ring(rAt(0.6) + 0.04, 0.05), fabric('#f8f4ee', { w: 'knit', bs: 2, sheen: 1 }), TB, 0, 0.6, 0); fur.rotation.x = Math.PI / 2; fur.scale.set(1, 0.88, 1.2);
      for (let i = 0; i < 3; i++) { const tg = add(geo('tog', () => new THREE.CapsuleGeometry(0.012, 0.05, 4, 8)), fabric('#e8d8b8', { cc: 0.6 }), TB, 0, 0.0 + i * 0.16, (rAt(i * 0.16) + 0.07) * 0.88); tg.rotation.z = Math.PI / 2; }
      sleeves(c, 1, { mat: m, quilt: 1, cuff: shadeHex(c, -0.1) }); return; }
    if (st === 'swim') { const m = fabric('#ffffff', { map: prints('dots', c, '#fff8ec'), r: 0.5, cc: 0.4, sheen: 0.4 }); shirt(c, { mat: m, y0: -0.2, y1: 0.4, noNeck: true, trim: shadeHex(c, -0.1) });
      for (const s of [-1, 1]) { const st2 = add(geo('swstr', () => new THREE.TorusGeometry(0.17, 0.016, 8, 24, Math.PI)), fabric(c, { r: 0.5 }), TB, s * 0.17, 0.4, 0); st2.rotation.set(0, Math.PI / 2, 0); st2.scale.set(1, 0.9, 1.2); }
      skirt(c, { len: 0.09, flare: 0.07, pleats: 22, amp: 0.06, y0: -0.06, mat: m, f: { ds: true } }); return; }
    if (st === 'dino' || st === 'astro' || st === 'hero' || st === 'xmas') {
      const m = st === 'xmas' ? fabric(c, { w: 'knit', bs: 1.4 }) : st === 'astro' ? fabric('#f4f6fa', { w: 'quilt', sheen: 0.6 }) : fabric(c, { w: st === 'dino' ? 'knit' : 'plain', sheen: st === 'hero' ? 0.5 : 0.9, r: st === 'hero' ? 0.5 : 0.86 });
      const col = st === 'astro' ? '#f4f6fa' : c;
      shirt(col, { mat: m, y0: -0.14, y1: 0.59, trim: st === 'xmas' ? '#f4ece0' : shadeHex(col, -0.12), quilt: st === 'astro' ? 0.012 : 0 }); sleeves(col, 1, { mat: m, cuff: st === 'xmas' ? '#f4ece0' : shadeHex(col, -0.12), cuffKnit: st === 'xmas', quilt: st === 'astro' });
      if (st === 'xmas') { const b = add(tube('fair', (y) => rAt(y) + 0.033, 0.24, 0.36, { rows: 6 }), fabric('#ffffff', { map: prints('fairisle', c, '#f4ece0'), w: 'knit' }), TB); sq(b); pants(shadeHex(c, -0.35), 1, { f: { w: 'twill' } }); return; }
      pants(col, 1, { mat: m, cuff: shadeHex(col, -0.12) });
      if (st === 'dino') { const belly = add(tube('dbelly', (y) => rAt(y) + 0.036, -0.1, 0.36, { phi0: -0.6, phiL: 1.2, rows: 10 }), fabric('#f6e8b0', { w: 'knit', ds: true }), TB); sq(belly); for (let i = 0; i < 5; i++) { const k = add(geo('dsp', () => new THREE.ConeGeometry(0.05, 0.12, 16)), fabric('#f2c94c', { w: 'knit' }), TB, 0, 0.5 - i * 0.15, -(rAt(0.5 - i * 0.15) + 0.06) * 0.88); k.rotation.x = -1.2; } }
      if (st === 'astro') { const belt = add(ring(rAt(-0.04) + 0.04, 0.022), fabric('#8a96b0', { r: 0.5 }), TB, 0, -0.04, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.88, 1); const pk = add(geo('pack2', () => new RoundBox(0.38, 0.4, 0.14)), fabric('#dfe4ee', { w: 'quilt' }), J.Chest, 0, -0.02, -0.44); void pk; add(box(0.12, 0.08, 0.02), fabric('#7ab8ff', { cc: 1, r: 0.3 }), TB, 0, 0.26, rAt(0.26) * 0.88 + 0.05); }
      if (st === 'hero') { const belt = add(ring(rAt(-0.04) + 0.04, 0.024), fabric('#f2c94c', { r: 0.5 }), TB, 0, -0.04, 0); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.88, 1);
        const em = add(geo('hstar', () => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.035 : 0.08; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.01, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2 }); }), fabric('#f2c94c', { r: 0.4 }), TB, 0, 0.28, rAt(0.28) * 0.88 + 0.03); void em;
        const cp = add(geo('cape4', () => { const g = new THREE.PlaneGeometry(0.72, 0.8, 8, 10); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.abs(x) * 0.25 + Math.sin(x * 18) * 0.015 * (0.4 - y)); p.setX(i, x * (1 + (0.4 - y) * 0.35)); } g.computeVertexNormals(); return g; }), fabric(c === '#d9505c' || c === '#e8434f' ? '#f2c94c' : '#d9505c', { ds: true, sheen: 1, r: 0.6 }), J.Chest, 0, -0.32, -0.44); cp.rotation.x = 0.12; }
      return; }
  }
  if (top) { const st = top.st, c = top.col, tr = trimOf(c);
    if (st === 'blazer') blazer(c);
    else if (st === 'cardigan') { shirt('#f7f3ee', { y0: -0.08, y1: 0.585, off: 0.024, noHem: true }); shirt(c, { off: 0.044, y0: -0.15, y1: 0.55, phi0: 0.22, phiL: Math.PI * 2 - 0.44, noNeck: true, f: { w: 'knit', bs: 1.3 }, trim: shadeHex(c, -0.08) }); buttons(4, -0.1, 0.13, '#f7f3ee', 0.048, -0.075); sleeves(c, 1, { f: { w: 'knit', bs: 1.3 }, cuffKnit: 1, cuff: shadeHex(c, -0.08) }); }
    else if (st === 'hoodie') { shirt(c, { y0: -0.16, y1: 0.59, trim: shadeHex(c, -0.12), hemT: 0.026, f: { w: 'knit', bs: 0.5 } });
      const pk = add(tube('kanga', (y) => rAt(y) + 0.046, -0.1, 0.1, { phi0: -0.6, phiL: 1.2, rows: 6 }), fabric(shadeHex(c, -0.05), { w: 'knit', bs: 0.5, ds: true }), TB); sq(pk);
      const hood = add(geo('hood2', () => new THREE.TorusGeometry(0.24, 0.085, 14, 32, Math.PI * 1.25)), fabric(c, { w: 'knit', bs: 0.5 }), TB, 0, 0.6, -0.03); hood.rotation.set(Math.PI / 2 - 0.35, 0, Math.PI * 0.375 + Math.PI); hood.scale.set(1, 1.1, 1);
      for (const s of [-1, 1]) { const d = add(geo('dstr', () => new THREE.CapsuleGeometry(0.008, 0.16, 4, 8)), fabric('#f7f3ee'), TB, s * 0.06, 0.45, rAt(0.45) * 0.88 + 0.05); d.rotation.x = 0.25; add(ball(0.012), fabric('#d8c39a', { metal: 1 }), TB, s * 0.06, 0.36, rAt(0.36) * 0.88 + 0.062); }
      sleeves(c, 1, { f: { w: 'knit', bs: 0.5 }, cuffKnit: 1, cuff: shadeHex(c, -0.12), fold: 1 }); }
    else if (st === 'sweater') { const m = fabric(c, { w: 'knit', bs: 1.6 }); shirt(c, { mat: m, y0: -0.14, y1: 0.59, trim: shadeHex(c, -0.1), hemT: 0.028, neckT: 0.03 }); const b = add(tube('fair2', (y) => rAt(y) + 0.033, 0.27, 0.35, { rows: 6 }), fabric('#ffffff', { map: prints('fairisle', c, tr), w: 'knit' }), TB); sq(b); sleeves(c, 1, { mat: m, cuffKnit: 1, cuff: shadeHex(c, -0.1), fold: 1 }); }
    else if (st === 'puffer') { const m = fabric(c, { w: 'quilt', sheen: 1, r: 0.5, cc: 0.4 }); shirt(c, { mat: m, quilt: 0.015, y0: -0.15, y1: 0.56, trim: shadeHex(c, -0.12), hemT: 0.024 });
      const col2 = add(cyl(rAt(0.62) + 0.05, rAt(0.56) + 0.06, 0.1), fabric(c, { w: 'quilt', sheen: 1, r: 0.5 }), TB, 0, 0.6, 0); col2.scale.z = 0.9; col2.material = fabric(c, { w: 'quilt', sheen: 1, r: 0.5, ds: true });
      add(box(0.014, 0.74, 0.01), fabric('#d0d4dc', { metal: 1 }), TB, 0, 0.2, rAt(0.2) * 0.88 + 0.075); sleeves(c, 1, { mat: m, quilt: 1, cuff: shadeHex(c, -0.12) }); }
    else if (st === 'jersey') { shirt(c, { trim: tr }); sleeves(c, 0.5, { cuff: tr }); const s2 = add(tube('jstripe', (y) => rAt(y) + 0.034, 0.18, 0.23, { rows: 4 }), fabric(tr), TB); sq(s2); }
    else if (st === 'blouse') { shirt(c, { y0: -0.12, y1: 0.585, peplum: 0.04, noNeck: true, f: { sheen: 1, r: 0.7 } }); for (const s of [-1, 1]) { const pc = add(geo('ppc', () => new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24)), fabric(c === '#f7f3ee' || c === '#f6f2ff' ? '#f4a6c4' : '#f7f3ee'), TB, s * 0.07, 0.575, 0.18); pc.rotation.x = Math.PI / 2 - 0.5; } buttons(3, 0.05, 0.11, '#fffaf2', 0.036); sleeves(c, 0.5, { puff: 1, cuff: tr }); }
    else { shirt(c, { trim: shadeHex(c, -0.1) }); sleeves(c, 0.5, { cuff: shadeHex(c, -0.1) }); pocket(TB, 0.15, 0.3, 0.08, 0.08, shadeHex(c, -0.06), rAt(0.3) * 0.88 * 0.97 + 0.04).rotation.y = 0.35; }
  }
  if (bot) { const st = bot.st, c = bot.col;
    if (st === 'skirt') skirt(c, { len: 0.28, flare: 0.16, pleats: 18, amp: 0.035, f: { w: 'twill' } });
    else if (st === 'tutu') { for (let i = 0; i < 3; i++) { const t = skirt(shadeHex(c, i * 0.15), { len: 0.11 + i * 0.015, flare: 0.32 - i * 0.05, pleats: 30, amp: 0.09, y0: 0.0 - i * 0.025, f: { ds: true, op: 0.7, sheen: 1 } }); if (t) t.scale.z = 0.92; } }
    else if (st === 'shorts') pants(c, 0.5, { f: { w: 'twill' }, cuff: shadeHex(c, 0.1) });
    else if (st === 'pants' && bot.g === 'b') pants(c, 1, { f: { w: 'knit', bs: 0.4 }, cuff: shadeHex(c, -0.12), waist: shadeHex(c, -0.12) });
    else pants(c, 1, { roll: 1, seam: '#e8b860', f: { w: 'twill' } });
  }
}
class RoundBox extends THREE.BufferGeometry { constructor(w, h, d) { super(); const g = new THREE.CapsuleGeometry(Math.min(w, d) / 2, h - Math.min(w, d), 6, 16); g.scale(w / Math.min(w, d), 1, 1); this.copy(g); } }

// ---------------------------------------------------------------- hats fitted to the head
// K: { H, hr, ea, ex:Set, J, col, st }  head = ellipsoid (1.08hr, hr, 0.98hr) centred at H origin
export function dressHead(K) {
  const { H, hr, ea, ex, J, st } = K; const c = K.col; const G = new THREE.Group(); G.position.y = K.dy || 0; H.add(G);
  const topEars = ['round', 'capy', 'biground', 'pointy', 'long', 'ossicones'].includes(ea) || ex.has('horn') || ex.has('horns') || ex.has('antennae');
  const sideBig = ['big', 'gills', 'floppy'].includes(ea);
  const ex2 = (y) => Math.sqrt(Math.max(0, 1 - (y / hr) ** 2)); // ellipse factor at height y
  const m = fabric(c, { w: st === 'beanie' ? 'knit' : st === 'cap' || st === 'bucket' ? 'twill' : 'plain', bs: st === 'beanie' ? 1.5 : 0.8, sheen: st === 'tophat' ? 0.4 : 0.9 });
  const tr = trimOf(c); const metal = fabric(c, { metal: 1 });
  const dome = (k, theta, lift = 0) => { const g = add(geo('dome' + k + theta, () => new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, theta)), m, G, 0, lift, 0); g.scale.set(hr * 1.08 * k, hr * k, hr * 0.98 * k); return g; };
  // protrusions (ears / horns / antennae) poking through head-hugging hats get neat finished holes
  const holes = (yMin) => { const pts = []; for (const e of J.ears || []) if (topEars && e.position.y > yMin && !['gills', 'big', 'floppy', 'tuft'].includes(ea)) pts.push([e.position.x * 0.92, Math.max(e.position.y, yMin + 0.02), e.position.z, ea === 'long' ? 0.07 : ea === 'biground' ? 0.12 : 0.09]);
    if (ex.has('horn')) pts.push([0, 0.5, 0.15, 0.05]); if (ex.has('horns')) for (const s of [-1, 1]) pts.push([s * 0.2, 0.5, 0.15, 0.055]); if (ex.has('antennae')) for (const s of [-1, 1]) pts.push([s * 0.15, hr * 1.0, 0.05, 0.03]);
    for (const [x, y, z, r] of pts) { const v = new THREE.Vector3(x / (hr * 1.08), y / hr, z / (hr * 0.98)); if (v.length() < 0.01) continue; v.normalize(); const p = new THREE.Vector3(v.x * hr * 1.1, v.y * hr * 1.03, v.z * hr * 1.0); const o = add(ring(r, 0.016), fabric(shadeHex(c, -0.18), { w: 'knit' }), G, p.x, p.y, p.z); o.lookAt(p.clone().multiplyScalar(2)); } };
  if (st === 'cap') { G.position.y += 0.035; dome(1.04, Math.PI * 0.42); const btn = add(ball(0.03), m, G, 0, hr * 1.04, 0); void btn;
    for (let i = 0; i < 6; i++) { const s = add(ring(hr * 1.045, 0.004, Math.PI * 0.42), fabric(shadeHex(c, -0.2)), G); s.rotation.set(0, i * Math.PI / 3, Math.PI / 2); s.scale.set(1.04, 1, 0.94); }
    const brim = add(geo('brim2', () => { const g = new THREE.SphereGeometry(1, 32, 8, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.36, Math.PI * 0.07); return g; }), m, G); brim.scale.set(hr * 1.2, hr * 1.04, hr * 1.42); brim.position.set(0, hr * 0.02, 0); brim.material = fabric(c, { w: 'twill', ds: true });
    const band2 = add(ring(hr * 1.08 * 1.04 * ex2(hr * 0.26), 0.012), fabric(shadeHex(c, -0.15)), G, 0, hr * 0.27, 0); band2.rotation.x = Math.PI / 2; band2.scale.set(1, 0.9, 1);
    holes(hr * 0.3); }
  else if (st === 'beanie') { dome(1.06, Math.PI * 0.5, 0.01); const cuff = add(ring(hr * 1.08 * 1.07, 0.05), fabric(shadeHex(c, -0.06), { w: 'knit', bs: 1.5 }), G, 0, hr * 0.06, 0); cuff.rotation.x = Math.PI / 2; cuff.scale.set(1, 0.9, 1.4);
    const pom = add(ball(0.09), fabric(tr, { w: 'knit', bs: 2.5, sheen: 1 }), G, 0, hr * 1.08, 0); void pom; holes(hr * 0.25); }
  else if (st === 'bucket') { const y0 = hr * (sideBig ? 0.5 : 0.4), rr = hr * 1.08 * ex2(y0) + 0.03; add(cyl(rr * 0.82, rr, hr * 0.45), m, G, 0, y0 + hr * 0.22, 0).material = fabric(c, { w: 'twill', ds: true }); const tp = add(geo('bktop', () => new THREE.CircleGeometry(1, 32)), m, G, 0, y0 + hr * 0.445, 0); tp.rotation.x = -Math.PI / 2; tp.scale.setScalar(rr * 0.82);
    const brim = add(geo('bbrim' + sideBig, () => new THREE.CylinderGeometry(1, 1.32, 0.12, 48, 1, true)), fabric(c, { w: 'twill', ds: true }), G, 0, y0 - 0.03, 0); brim.scale.set(rr, 1, rr * 0.95); if (sideBig) brim.scale.set(rr * 0.85, 0.8, rr * 0.85);
    for (const k of [0.25, 0.32]) { const s = add(ring(rr * 1.0 + k * 0.3, 0.004), fabric(shadeHex(c, -0.2)), G, 0, y0 - 0.02 - (k - 0.25) * 0.4, 0); s.rotation.x = Math.PI / 2; }
    const bd = add(ring(rr * 0.98, 0.018), fabric(tr), G, 0, y0 + 0.03, 0); bd.rotation.x = Math.PI / 2; holes(y0); }
  else if (st === 'tophat') { const y0 = hr * 0.78, rr = hr * 0.62; const bm = add(geo('thb2', () => new THREE.CylinderGeometry(1, 1, 0.025, 40)), m, G, 0, y0, 0); bm.scale.set(rr * 1.45, 1, rr * 1.35); add(geo('tht2', () => new THREE.CylinderGeometry(0.92, 1, 1, 40)), m, G, 0, y0 + hr * 0.36, 0).scale.set(rr, hr * 0.7, rr * 0.95);
    const bd = add(ring(rr * 0.99, 0.02), fabric('#9a3a4a', { sheen: 1, r: 0.5 }), G, 0, y0 + 0.05, 0); bd.rotation.x = Math.PI / 2; bd.scale.set(1, 0.95, 1); G.rotation.z = 0.12; }
  else if (st === 'tiara' || st === 'crown') { const y0 = hr * (st === 'crown' ? 0.82 : 0.72), rr = hr * 1.08 * ex2(y0) * (st === 'crown' ? 0.9 : 1.03); const gold = metal;
    if (st === 'crown') { const g = add(cyl(rr * 1.08, rr, hr * 0.28), fabric(c, { metal: 1, ds: true }), G, 0, y0 + hr * 0.12, 0); void g; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const k = add(geo('cpk', () => new THREE.ConeGeometry(0.035, 0.1, 12)), gold, G, Math.sin(a) * rr * 1.1, y0 + hr * 0.3, Math.cos(a) * rr * 1.1); void k; add(ball(0.018), gold, G, Math.sin(a) * rr * 1.1, y0 + hr * 0.3 + 0.06, Math.cos(a) * rr * 1.1); } }
    else { const b = add(ring(rr, 0.012, Math.PI * 1.1), gold, G, 0, y0, 0); b.rotation.set(Math.PI / 2, 0, -Math.PI * 0.05 + Math.PI); b.rotation.z = Math.PI * 1.45; for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.28; const h = 0.05 + (3 - Math.abs(i - 3)) * 0.025; const k = add(geo('tpk' + h, () => new THREE.ConeGeometry(0.018, h, 10)), gold, G, Math.sin(a) * rr, y0 + h / 2, Math.cos(a) * rr); k.rotation.x = 0.35; } }
    add(ball(0.028), fabric('#f48ab8', { cc: 1, r: 0.15 }), G, 0, y0 + (st === 'crown' ? hr * 0.12 : 0.05), rr * 1.08 + 0.01); G.rotation.x = topEars ? -0.18 : -0.08; }
  else if (st === 'wizard' || st === 'santa') { const y0 = hr * (topEars ? 0.62 : 0.55), rr = hr * 1.08 * ex2(y0) + 0.02;
    const cone2 = add(geo('wz' + st, () => { const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector2(1 - t * 0.98, t * 2.3 + (st === 'santa' ? 0 : Math.sin(t * 3) * 0.05))); } return new THREE.LatheGeometry(pts, 40); }), fabric(c, { w: st === 'santa' ? 'knit' : 'plain', ds: true, sheen: 1 }), G, 0, y0, 0); cone2.scale.set(rr, hr * 0.5, rr); cone2.rotation.z = st === 'santa' ? 0.5 : 0.14;
    const brim = add(ring(rr, st === 'santa' ? 0.055 : 0.03), fabric(st === 'santa' ? '#f8f4ee' : '#f2c94c', { w: st === 'santa' ? 'knit' : 'plain', bs: 2 }), G, 0, y0, 0); brim.rotation.x = Math.PI / 2;
    if (st === 'santa') add(ball(0.07), fabric('#f8f4ee', { w: 'knit', bs: 2.5 }), G, rr * 0.95, y0 + hr * 0.6, 0); else for (let i = 0; i < 5; i++) { const a = i * 1.3; add(ball(0.016), fabric('#ffe680', { metal: 1 }), G, Math.sin(a) * rr * 0.6, y0 + 0.08 + i * 0.07, Math.cos(a) * rr * 0.6); } }
  else if (st === 'earband') { const b = add(ring(hr * 1.06, 0.018, Math.PI), fabric(c, { cc: 0.8, r: 0.4 }), G, 0, 0, 0); b.rotation.y = Math.PI / 2; b.rotation.order = 'YXZ'; b.rotation.x = -0.25; b.scale.set(1, 1, 1.02);
    for (const s of [-1, 1]) { const e = add(geo('ebe', () => new THREE.ConeGeometry(0.09, 0.15, 3)), fabric(c, { w: 'knit' }), G, s * hr * 0.55, hr * 0.98, 0.04); e.rotation.z = -s * 0.35; e.scale.z = 0.45; const i2 = add(geo('ebi', () => new THREE.ConeGeometry(0.05, 0.09, 3)), fabric('#f4c0d8'), G, s * hr * 0.55, hr * 0.97, 0.07); i2.rotation.z = -s * 0.35; i2.scale.z = 0.3; } }
  else if (st === 'flowers') { const y0 = hr * 0.72, rr = hr * 1.08 * ex2(y0) + 0.02; const vine = add(ring(rr, 0.012), fabric('#7ab07a'), G, 0, y0, 0); vine.rotation.x = Math.PI / 2; vine.scale.set(1, 0.92, 1);
    for (let i = 0; i < 11; i++) { const a = i * Math.PI * 2 / 11; const x = Math.sin(a) * rr, z = Math.cos(a) * rr * 0.92; const col = ['#f4a6c4', '#fff3c4', '#c9b3f0', '#f7f3ee'][i % 4]; for (let p = 0; p < 5; p++) { const pa = p * 1.256; add(ball(0.024), fabric(col, { sheen: 1 }), G, x + Math.cos(pa) * 0.025, y0 + Math.sin(pa) * 0.025, z); } add(ball(0.016), fabric('#f2c94c'), G, x, y0, z + 0.01); if (i % 2) { const l = add(ball(1), fabric('#7ab07a'), G, x * 1.02, y0 - 0.02, z * 1.02); l.scale.set(0.03, 0.012, 0.018); } } G.rotation.x = -0.12; }
  else if (st === 'helmet') { dome(1.07, Math.PI * 0.5).material = fabric(c, { cc: 1, r: 0.3, sheen: 0 }); const s = add(ring(hr * 1.1, 0.02, Math.PI), fabric('#f7f3ee', { cc: 1 }), G); s.rotation.y = Math.PI / 2; holes(hr * 0.3); }
  // fit for eared / horned Pals: tilt back a little so it sits between and behind the ears
  if (topEars && ['cap', 'beanie', 'bucket', 'helmet'].includes(st)) { G.rotation.x += ea === 'long' ? -0.18 : -0.1; G.position.y += 0.012; }
  if (sideBig && ['cap', 'beanie'].includes(st)) G.position.y += 0.01;
  return G;
}
