// Kemy Cars: original, code-built cartoon-realistic cars for the Kemy open world (Pal Park + Kemy Street + roads).
// Every design here is original (no real brands, logos or copies of real models); the only badge is the KL logo.
// Shop: a free starter, Star Coin cars (inv car_<id>) and Diamond premium cars (inv z_car_<id>, placeholder
// productId kemy_car_<id> for a possible future store, NO real-money flow). Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

export const CARS = [
  { id: 'pip', name: 'Pocket Pip', style: 'mini', emoji: '🚗', free: 1, blurb: 'A tiny, bubbly city car. Everyone starts with one!',
    L: 3.1, Wd: 1.62, H: 1.45, wr: 0.32, mass: 850, torque: 150, redline: 6800, gears: [3.4, 2.1, 1.45, 1.05], fd: 4.1, grip: 1.05, steer: 0.62, top: 16, susp: 26, damp: 2.6, color: 6 },
  { id: 'star', name: 'Star Racer', style: 'coupe', emoji: '🏎️', p: 450, blurb: 'A smooth sporty coupe with a little ducktail.',
    L: 4.3, Wd: 1.86, H: 1.3, wr: 0.34, mass: 1300, torque: 330, redline: 7400, gears: [3.3, 2.2, 1.6, 1.25, 1.0, 0.82], fd: 3.7, grip: 1.15, steer: 0.55, top: 27, susp: 34, damp: 3.2, color: 0 },
  { id: 'cruise', name: 'Moonlight Cruiser', style: 'cruiser', emoji: '🚙', p: 650, blurb: 'A long classic cruiser with chrome and tail fins.',
    L: 5.0, Wd: 1.96, H: 1.42, wr: 0.36, mass: 1650, torque: 380, redline: 5600, gears: [2.9, 1.8, 1.25, 1.0], fd: 3.3, grip: 0.95, steer: 0.5, top: 22, susp: 22, damp: 2.4, color: 3 },
  { id: 'bear', name: 'Trail Bear', style: 'truck', emoji: '🛻', p: 900, blurb: 'A tall off-road truck with chunky tires and a light bar.',
    L: 4.9, Wd: 2.06, H: 1.95, wr: 0.48, mass: 2300, torque: 560, redline: 5200, gears: [3.8, 2.4, 1.6, 1.15, 0.9], fd: 3.9, grip: 1.0, steer: 0.52, top: 20, susp: 18, damp: 2.0, color: 2 },
  { id: 'comet', name: 'Purple Comet', style: 'super', emoji: '☄️', d: 1200, prem: 1, blurb: 'A low, wide supercar with a glowing wing. Premium.',
    L: 4.5, Wd: 2.0, H: 1.12, wr: 0.36, mass: 1400, torque: 600, redline: 8400, gears: [3.1, 2.2, 1.65, 1.3, 1.08, 0.92, 0.8], fd: 3.5, grip: 1.3, steer: 0.5, top: 35, susp: 44, damp: 4.0, color: 1 },
  { id: 'aurora', name: 'Aurora GT', style: 'gt', emoji: '🌌', d: 1600, prem: 1, blurb: 'A long-nose grand tourer with an aurora light strip. Premium.',
    L: 4.8, Wd: 1.98, H: 1.2, wr: 0.37, mass: 1550, torque: 650, redline: 7800, gears: [3.0, 2.1, 1.6, 1.28, 1.05, 0.88, 0.76], fd: 3.4, grip: 1.22, steer: 0.5, top: 33, susp: 38, damp: 3.6, color: 4 },
];
export const CAR = Object.fromEntries(CARS.map((c) => [c.id, c]));
export const CAR_IDX = CARS.map((c) => c.id); // append-only: used in the compact multiplayer code
export const PAINTS = ['#e8434f', '#7c3aed', '#2f7fe6', '#14b8a6', '#f59e0b', '#22c55e', '#ff7ab6', '#f4f4f5', '#1f2937', '#ffd23f', '#38bdf8', '#a3e635'];
export const carItem = (c) => (c.prem ? 'z_car_' : 'car_') + c.id;
export const carProduct = (c) => 'kemy_car_' + c.id; // placeholder product id (not used, no real money)
export async function registerCarItems() { const cat = await import('../pals/catalog.js');
  cat.addItems(CARS.filter((c) => c.p).map((c) => ({ id: carItem(c), name: c.name, kind: 'car', p: c.p, r: 'r' })));
  cat.addDiamondItems(CARS.filter((c) => c.d).map((c) => ({ id: carItem(c), name: c.name, kind: 'car', d: c.d, productId: carProduct(c) }))); }

// ------------------------------------------------------------ shared materials
const MAT = new Map();
function mat(key, make) { if (!MAT.has(key)) MAT.set(key, make()); return MAT.get(key); }
export function paintMat(col) { return mat('p' + col, () => new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 })); }
const M = {
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: '#1b2a3c', metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.42, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false })),
  chrome: () => mat('chrome', () => new THREE.MeshStandardMaterial({ color: '#e9eef5', metalness: 1, roughness: 0.12, envMapIntensity: 1.5 })),
  rubber: () => mat('rub', () => new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.85, metalness: 0 })),
  trim: () => mat('trim', () => new THREE.MeshStandardMaterial({ color: '#1d1f27', roughness: 0.5, metalness: 0.3 })),
  seat: () => mat('seat', () => new THREE.MeshStandardMaterial({ color: '#3b2a55', roughness: 0.75 })),
  dash: () => mat('dash', () => new THREE.MeshStandardMaterial({ color: '#2a2833', roughness: 0.6 })),
  head: () => mat('head', () => new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 2.2, roughness: 0.2 })),
  tail: () => mat('tail', () => new THREE.MeshStandardMaterial({ color: '#ff3048', emissive: '#ff2040', emissiveIntensity: 1.6, roughness: 0.3 })),
  brake: () => mat('brake', () => new THREE.MeshStandardMaterial({ color: '#ff3048', emissive: '#ff2040', emissiveIntensity: 4, roughness: 0.3 })),
  glow: (c) => mat('g' + c, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.5, roughness: 0.3 })),
  badge: () => mat('badge', () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#f3f4f6'); g.addColorStop(1, '#9ca3af'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
    x.fillStyle = '#5b21b6'; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 54px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KL', 64, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.25, transparent: true }); }),
};

// ------------------------------------------------------------ geometry helpers
// side profile (x = length, y = height) extruded across the width with a rounded bevel, then turned so the car faces +z
function extrudeSide(pts, width, bevel, curve = 10) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); } s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 5, curveSegments: curve, steps: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; }
// shape the slab into a car body: tumblehome above the beltline, rounded plan view at nose/tail, tucked rocker
function sculpt(g, c, belt, top, k = 1) { const p = g.attributes.position, hl = c.L / 2 + 0.2; for (let i = 0; i < p.count; i++) { let x = p.getX(i); const y = p.getY(i), z = p.getZ(i);
    const tb = Math.max(0, Math.min(1, (y - belt) / Math.max(0.05, top - belt))); x *= 1 - 0.2 * k * tb * tb; const t = Math.min(1, Math.abs(z) / hl); x *= 1 - 0.16 * Math.pow(t, 5); if (y < c.wr * 0.75) x *= 0.95; p.setX(i, x); }
  g.computeVertexNormals(); return g; }
// body profiles per style, as fractions of length (x from -0.5 front... we use +x = front) and height
function profiles(c) { const L = c.L, H = c.H, r = c.wr, cl = r * 0.55; const f = L / 2, b = -L / 2;
  switch (c.style) {
    case 'mini': return { body: [[b, cl], [f, cl], [f + 0.02, H * 0.5, f - 0.05, H * 0.58], [f - L * 0.2, H * 0.62], [b + 0.05, H * 0.62], [b - 0.02, H * 0.42, b, cl]],
      cabin: [[f - L * 0.24, H * 0.6], [f - L * 0.42, H * 0.98, f - L * 0.5, H * 1.0], [b + L * 0.1, H * 1.0], [b + 0.08, H * 0.98, b + 0.06, H * 0.6]], roofW: 0.86 };
    case 'truck': return { body: [[b, cl + 0.15], [f, cl + 0.15], [f + 0.03, H * 0.5], [f - 0.05, H * 0.6], [f - L * 0.3, H * 0.62], [b, H * 0.6]],
      cabin: [[f - L * 0.32, H * 0.6], [f - L * 0.42, H * 0.97], [b + L * 0.42, H * 0.97], [b + L * 0.4, H * 0.6]], roofW: 0.9, bed: 1 };
    case 'cruiser': return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.42, f - 0.05, H * 0.52], [f - L * 0.3, H * 0.56], [b + 0.2, H * 0.56], [b - 0.06, H * 0.5, b, cl]],
      cabin: [[f - L * 0.36, H * 0.55], [f - L * 0.47, H * 0.92], [b + L * 0.32, H * 0.92], [b + L * 0.24, H * 0.55]], roofW: 0.86, fins: 1 };
    case 'super': return { body: [[b, cl], [f, cl], [f + 0.05, H * 0.32, f - 0.1, H * 0.38], [f - L * 0.3, H * 0.52], [b + L * 0.1, H * 0.6], [b - 0.03, H * 0.56, b, cl]],
      cabin: [[f - L * 0.28, H * 0.5], [f - L * 0.5, H * 0.97, f - L * 0.56, H * 0.98], [b + L * 0.24, H * 0.9], [b + L * 0.14, H * 0.6]], roofW: 0.78, wing: 1 };
    case 'gt': return { body: [[b, cl], [f, cl], [f + 0.05, H * 0.36, f - 0.1, H * 0.44], [f - L * 0.38, H * 0.58], [b + 0.1, H * 0.62], [b - 0.04, H * 0.5, b, cl]],
      cabin: [[f - L * 0.42, H * 0.57], [f - L * 0.56, H * 0.97, f - L * 0.62, H * 0.98], [b + L * 0.2, H * 0.94], [b + L * 0.08, H * 0.62]], roofW: 0.8, strip: 1 };
    default: return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.4, f - 0.06, H * 0.5], [f - L * 0.32, H * 0.56], [b + 0.12, H * 0.6], [b - 0.03, H * 0.48, b, cl]],
      cabin: [[f - L * 0.34, H * 0.55], [f - L * 0.5, H * 0.95, f - L * 0.56, H * 0.96], [b + L * 0.2, H * 0.93], [b + L * 0.1, H * 0.6]], roofW: 0.82, duck: 1 };
  } }
function rim(r, w, spokes) { const g = new THREE.Group(); const ch = M.chrome();
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w * 0.86, 24), ch); d.rotation.z = Math.PI / 2; g.add(d);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.02, 12), M.trim()); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let i = 0; i < spokes; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, r * 1.1, r * 0.13), ch); s.rotation.x = (i / spokes) * Math.PI; s.position.x = 0; g.add(s); }
  return g; }
// One car model. Returns a Group (root: position/yaw) with .userData: chassis (pitch/roll/heave), wheels, doors, steer
export function buildCar(def, color, o = {}) { const c = typeof def === 'string' ? CAR[def] : def; const col = PAINTS[color ?? c.color] || PAINTS[0]; const lite = !!o.lite;
  const root = new THREE.Group(); const ch = new THREE.Group(); root.add(ch); const paint = paintMat(col);
  const pr = profiles(c); const W = c.Wd, r = c.wr; const bev = Math.min(0.16, W * 0.08);
  const body = new THREE.Mesh(sculpt(extrudeSide(pr.body, W, bev, lite ? 6 : 12), c, c.H * 0.3, c.H * 0.62), paint); ch.add(body);
  const cabW = W * pr.roofW; const cab = new THREE.Mesh(sculpt(extrudeSide(pr.cabin, cabW, 0.1, lite ? 6 : 12), c, c.H * 0.55, c.H, 1.1), M.glass()); cab.renderOrder = 2; ch.add(cab);
  // roof skin (paint) as a thin slab following the top of the cabin
  { const top = pr.cabin.filter((p, i) => i === 1 || i === 2).map((p) => p.length === 4 ? [p[2], p[3]] : p); const x0 = Math.min(top[0][0], top[1][0]) , x1 = Math.max(top[0][0], top[1][0]); const y = Math.max(top[0][1], top[1][1]);
    const roof = new THREE.Mesh(extrudeSide([[x0 + 0.05, y - 0.06], [x1 - 0.05, y - 0.06], [x1 - 0.12, y + 0.03], [x0 + 0.12, y + 0.03]], cabW * 0.9, 0.05, 4), paint); ch.add(roof); }
  // wheel arch flares
  const axF = c.L * 0.33, axR = -c.L * 0.32, tw = W / 2 - r * 0.2;
  for (const z of [axF, axR]) for (const s of [-1, 1]) { const fl = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, r * 0.18, 8, 18, Math.PI), paint); fl.rotation.y = Math.PI / 2; fl.position.set(s * (W / 2 - 0.02), r, z); fl.scale.set(1, 1, 1.4); ch.add(fl); }
  // lights + grille + badge
  const fz = c.L / 2 + bev * 0.9 + 0.02, by = c.H * (c.style === 'super' ? 0.28 : 0.38);
  for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), M.head()); hl.scale.set(c.style === 'super' || c.style === 'gt' ? 2.2 : 1.2, 0.7, 0.5); hl.position.set(s * W * 0.33, by + 0.05, fz - 0.06); ch.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(c.style === 'gt' ? W * 0.3 : 0.32, 0.1, 0.06), M.tail()); tl.position.set(s * W * 0.3, c.H * 0.45, -c.L / 2 - bev * 0.9 - 0.01); ch.add(tl); tl.userData.tail = 1; }
  const gr = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, c.H * 0.12, 0.05), M.trim()); gr.position.set(0, by - 0.08, fz - 0.03); ch.add(gr);
  for (const [z, ry] of [[fz + 0.005, 0], [-c.L / 2 - bev * 0.9 - 0.03, Math.PI]]) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), M.badge()); b.position.set(0, ry ? c.H * 0.36 : by + 0.1, z); b.rotation.y = ry; ch.add(b); }
  // bumpers (chrome for the cruiser)
  for (const z of [c.L / 2, -c.L / 2]) { const bm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, W - 0.3, 4, 10), c.style === 'cruiser' || c.style === 'truck' ? M.chrome() : M.trim()); bm.rotation.z = Math.PI / 2; bm.position.set(0, r * 0.75, z); ch.add(bm); }
  // style extras
  if (pr.fins) for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 8), paint); f.rotation.x = -Math.PI / 2 - 0.15; f.position.set(s * (W / 2 - 0.15), c.H * 0.62, -c.L / 2 + 0.4); ch.add(f); }
  if (pr.wing) { const w = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.05, 0.36), paint); w.position.set(0, c.H * 0.92, -c.L / 2 + 0.25); ch.add(w); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.16), M.trim()); p.position.set(s * W * 0.32, c.H * 0.76, -c.L / 2 + 0.28); ch.add(p); }
    const gl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.02, 0.03), M.glow('#c084fc')); gl.position.set(0, c.H * 0.95, -c.L / 2 + 0.08); ch.add(gl); }
  if (pr.duck) { const d = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.04, 0.2), paint); d.position.set(0, c.H * 0.63, -c.L / 2 + 0.12); d.rotation.x = 0.25; ch.add(d); }
  if (pr.strip) { const s = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.03, 0.03), M.glow('#5eead4')); s.position.set(0, by + 0.18, fz - 0.1); ch.add(s); }
  if (pr.bed) { const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 0.05, c.L * 0.36), M.trim()); bed.position.set(0, c.H * 0.6, -c.L * 0.29); ch.add(bed);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.08, 0.1), M.glow('#fff7cc')); bar.position.set(0, c.H * 1.0, c.L * 0.08); ch.add(bar);
    for (const s of [-1, 1]) { const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, c.L * 0.34, 6), M.chrome()); rl.rotation.x = Math.PI / 2; rl.position.set(s * W * 0.42, c.H * 0.75, -c.L * 0.29); ch.add(rl); } }
  // interior: seats, dash, steering wheel (visible through the glass, used by the POV camera)
  const seatY = Math.max(r * 0.9, c.H * 0.38), drvX = W * 0.22, seatZ = (pr.cabin[0][0] + pr.cabin[pr.cabin.length - 1][0]) / 2 - 0.1;
  for (const s of [1, -1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.48), M.seat()); st.position.set(s * drvX, seatY, seatZ); ch.add(st); const bk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.12), M.seat()); bk.position.set(s * drvX, seatY + 0.32, seatZ - 0.26); bk.rotation.x = -0.18; ch.add(bk); }
  const dashZ = pr.cabin[0][0] - 0.12; const dash = new THREE.Mesh(new THREE.BoxGeometry(W * 0.74, 0.16, 0.36), M.dash()); dash.position.set(0, seatY + 0.26, dashZ - 0.22); ch.add(dash);
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), M.glow('#7dd3fc')); gauge.position.set(drvX, seatY + 0.35, dashZ - 0.41); gauge.rotation.x = -0.4; gauge.rotation.y = Math.PI; ch.add(gauge);
  const steer = new THREE.Group(); steer.position.set(drvX, seatY + 0.4, dashZ - 0.5); steer.rotation.x = -0.45; ch.add(steer);
  { const wr = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24), M.trim()); steer.add(wr); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.02), M.trim()); steer.add(sp); const cen = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), M.badge()); cen.position.z = -0.012; cen.rotation.y = Math.PI; steer.add(cen); }
  // doors: hinged panels at the front edge on each side (pivot = hinge)
  const doors = []; const dz0 = pr.cabin[0][0] - 0.02, dlen = Math.min(1.25, c.L * 0.3), dh = c.H * (c.style === 'truck' ? 0.36 : 0.32);
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * (W / 2 + 0.005), seatY - 0.12, dz0); ch.add(piv);
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.05, dh, dlen), paint); pnl.position.set(0, dh / 2 - 0.05, -dlen / 2); piv.add(pnl);
    const gw = new THREE.Mesh(new THREE.BoxGeometry(0.03, c.H * 0.3, dlen * 0.82), M.glass()); gw.position.set(-s * 0.02, dh + c.H * 0.14, -dlen * 0.52); gw.renderOrder = 3; gw.visible = false;
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.16), M.chrome()); hd.position.set(s * 0.03, dh - 0.12, -dlen * 0.8); piv.add(hd); doors.push({ piv, s, a: 0 }); }
  // wheels: steer pivot -> spin group (tire + rim)
  const wheels = []; const ww = r * 0.75 * (c.style === 'truck' ? 1.3 : 1);
  for (const [z, front] of [[axF, 1], [axR, 0]]) for (const s of [-1, 1]) { const st = new THREE.Group(); st.position.set(s * tw, r, z); root.add(st); const sp = new THREE.Group(); st.add(sp);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(r * 0.78, r * 0.24, lite ? 8 : 14, lite ? 18 : 32), M.rubber()); tire.rotation.y = Math.PI / 2; tire.scale.set(1, 1, ww / (r * 0.48)); sp.add(tire);
    sp.add(rim(r, ww, c.style === 'truck' ? 6 : c.style === 'cruiser' ? 12 : 5)); wheels.push({ st, sp, front, s, z, x: s * tw, comp: 0, vel: 0, y: r }); }
  root.traverse((m) => { if (m.isMesh) { m.castShadow = !o.noShadow && m.material !== M.glass(); m.receiveShadow = false; } });
  root.userData = { def: c, chassis: ch, wheels, doors, steer, seat: new THREE.Vector3(drvX, seatY + 0.07, seatZ), dashZ, color: col, tails: [] };
  ch.traverse((m) => { if (m.userData.tail) root.userData.tails.push(m); });
  return root; }
export function setBrakeLights(car, on) { for (const t of car.userData.tails) t.material = on ? M.brake() : M.tail(); }
export function setDoors(car, k) { for (const d of car.userData.doors) { d.a = k; d.piv.rotation.y = d.s * k * 1.05; } }

// ------------------------------------------------------------ vehicle physics (fixed step, raycast suspension per wheel)
// State in world space: x,z,yaw, local velocity (vf fwd, vl lateral), yaw rate; body heave/pitch/roll on springs.
export function createVehicle(def, groundAt) { const c = typeof def === 'string' ? CAR[def] : def;
  const L = c.L * 0.65, a = L * 0.5, b = L * 0.5, m = c.mass, I = m * (c.L * c.L) / 10, g = 9.81, hcg = c.H * 0.4;
  const V = { def: c, x: 0, z: 0, y: 0, yaw: 0, vf: 0, vl: 0, r: 0, steer: 0, thr: 0, brk: 0, gear: 1, rpm: 900, rev: false, heave: 0, hv: 0, pitch: 0, pv: 0, roll: 0, rv: 0, spin: 0, slip: 0, prev: null, acc: 0,
    wheelY: [0, 0, 0, 0], wheelsLocal: [[-1, a], [1, a], [-1, -b], [1, -b]].map(([s, z]) => [s * (c.Wd / 2 - c.wr * 0.2), z]) };
  const torqueAt = (rpm) => { const k = rpm / c.redline; return c.torque * Math.max(0.35, 1 - (k - 0.62) * (k - 0.62) * 2.2); };
  V.place = (x, z, yaw) => { V.x = x; V.z = z; V.yaw = yaw; V.vf = V.vl = V.r = 0; V.y = groundAt(x, z); V.prev = { x, z, yaw, y: V.y, heave: 0, pitch: 0, roll: 0 }; };
  V.speed = () => Math.abs(V.vf);
  function step(h, inp) { // inp: { thr 0..1, brk 0..1, steer -1..1, hand }
    // smoothed input: gradual throttle, speed-sensitive steering
    V.thr += ((inp.thr || 0) - V.thr) * Math.min(1, h * 3.5); V.brk += ((inp.brk || 0) - V.brk) * Math.min(1, h * 8);
    const spd = Math.abs(V.vf); const maxSt = c.steer / (1 + spd * 0.055) * (V.abs === false && V.brk > 0.8 && spd > 6 ? 0.4 : 1); V.steer += (((inp.steer || 0) * maxSt) - V.steer) * Math.min(1, h * 6);
    // reverse: brake held when (nearly) stopped
    if (V.brk > 0.5 && V.vf < 0.6 && !V.rev && V.thr < 0.1) V.revT = (V.revT || 0) + h; else V.revT = 0; if (V.revT > 0.35) V.rev = true; if (V.rev && (V.thr > 0.1 || V.vf > 0.3) && V.brk < 0.1) V.rev = false;
    // gears + rpm (auto box)
    const wheelRpm = Math.abs(V.vf) / c.wr * 60 / (2 * Math.PI); const ratio = (V.rev ? 3.2 : c.gears[V.gear - 1]) * c.fd;
    let rpm = Math.max(900, wheelRpm * ratio); if (!V.rev) { if (V.manual) { if (V.wantShift) { V.gear = Math.max(1, Math.min(c.gears.length, V.gear + V.wantShift)); V.shiftT = 0.2; V.wantShift = 0; } } else if (rpm > c.redline * 0.9 && V.gear < c.gears.length) { V.gear++; V.shiftT = 0.25; V.shifted = 1; } else if (V.gear > 1 && rpm < c.redline * 0.38) V.gear--; } else V.gear = 1;
    V.shiftT = Math.max(0, (V.shiftT || 0) - h); const pedal = V.rev ? V.brk : V.thr;
    rpm = Math.min(c.redline, Math.max(rpm, 900 + pedal * 2200 * (spd < 3 ? 1 : 0.2))); V.rpm += (rpm - V.rpm) * Math.min(1, h * 10);
    let Fd = (V.shiftT > 0 ? 0.3 : 1) * pedal * torqueAt(V.rpm) * ratio * 0.9 / c.wr; if (V.rpm >= c.redline * 0.995) Fd *= 0.2; if (V.tc && V.slip > 0.5 && !V.drift) Fd *= 0.55; if (V.rev) Fd = -Fd * 0.6;
    if (spd > c.top && !V.rev) Fd = Math.min(Fd, 0);
    const brakeF = (V.rev ? 0 : V.brk) * m * g * 0.95 + (inp.hand ? m * g * 0.6 : 0);
    const Fb = Math.abs(V.vf) < 0.05 ? 0 : -Math.sign(V.vf) * Math.min(brakeF, Math.abs(V.vf) * m / h * 0.9);
    const drag = -V.vf * Math.abs(V.vf) * 0.42 - V.vf * 14 - Math.sign(V.vf) * (Math.abs(V.vf) > 0.05 ? m * 0.012 * g : 0);
    // tires (bicycle model): slip angles -> lateral forces capped by grip * load (weight transfer)
    const ax0 = V.acc || 0; const Nf = m * g * (b / L) - m * ax0 * hcg / L, Nr = m * g * (a / L) + m * ax0 * hcg / L; const mu = c.grip * (inp.hand ? 0.55 : 1);
    if (spd < 1.2) { // low speed: kinematic, no jitter
      V.r = V.vf * Math.tan(V.steer) / L; V.vl *= Math.max(0, 1 - h * 10);
      V.acc = (Fd + Fb + drag) / m; V.vf += V.acc * h; } else {
      const sf = Math.atan2(V.vl + a * V.r, Math.abs(V.vf)) - V.steer * Math.sign(V.vf), sr = Math.atan2(V.vl - b * V.r, Math.abs(V.vf));
      const Cf = m * 9, Cr = m * 9.6; const Fyf = Math.max(-mu * Nf, Math.min(mu * Nf, -Cf * sf)), rg = inp.hand ? 0.6 : V.drift && Math.abs(V.steer) > 0.15 && V.thr > 0.5 ? 0.9 : 1.12, Fyr = Math.max(-mu * Nr * rg, Math.min(mu * Nr * rg, -Cr * sr));
      V.slip = Math.max(Math.abs(sf), Math.abs(sr)) * (Math.abs(Cr * sr) > mu * Nr ? 1.6 : 0.6);
      V.acc = (Fd + Fb + drag - Fyf * Math.sin(V.steer)) / m; const ay = (Fyr + Fyf * Math.cos(V.steer)) / m - V.vf * V.r; V.ay = ay;
      V.vf += V.acc * h; V.vl += ay * h; V.r += (a * Fyf * Math.cos(V.steer) - b * Fyr) / I * h; V.vl *= 1 - h * 0.6; V.r *= 1 - h * 0.25; const rmax = mu * g * (inp.hand ? 1.6 : 1.15) / Math.max(spd, 3); V.r = Math.max(-rmax, Math.min(rmax, V.r)); }
    if (Math.abs(V.vf) < 0.03 && pedal < 0.05) V.vf = 0;
    // integrate world position
    let sy = Math.sin(V.yaw), cy = Math.cos(V.yaw); V.yaw += V.r * h;
    V.x += (sy * V.vf + cy * V.vl) * h; V.z += (cy * V.vf - sy * V.vl) * h; V.spin += V.vf / c.wr * h;
    // suspension: 4 rays to the ground -> spring + damper per wheel -> body heave / pitch / roll, plus weight-transfer moments
    const kw = m * c.susp * 3 / 4, dw = 2 * 0.32 * c.damp * Math.sqrt(kw * m / 4), pre = m * g / 4 / kw; let Fs = 0, Tp = 0, Tr = 0, gs = 0;
    V.wheelsLocal.forEach(([lx, lz], i) => { const wx = V.x + sy * lz + cy * lx, wz = V.z + cy * lz - sy * lx; const bump = (Math.sin(wx * 1.7) * Math.cos(wz * 1.3) + Math.sin(wx * 0.43 + wz * 0.61)) * 0.008; const gy = groundAt(wx, wz) + bump; gs += gy;
      const bodyAt = V.y + V.heave + V.pitch * lz - V.roll * lx; const comp = gy - bodyAt; const cv = (comp - (V.wheelY[i] ?? comp)) / h; V.wheelY[i] = comp;
      const F = Math.max(0, kw * (comp + pre) + dw * cv); Fs += F; Tp += F * lz; Tr -= F * lx; });
    const Ip = m * L * L / 6, Ir = m * c.Wd * c.Wd / 5; V.y = gs / 4;
    V.hv += (Fs / m - g) * h; V.heave += V.hv * h; if (V.heave < -0.3) { V.heave = -0.3; V.hv = Math.max(0, V.hv); } if (V.heave > 0.4) { V.heave = 0.4; V.hv = Math.min(0, V.hv); }
    V.pv += (Tp + m * V.acc * hcg * 0.6) / Ip * h; V.pv *= 1 - h * 1.5; V.pitch += V.pv * h; V.pitch = Math.max(-0.14, Math.min(0.14, V.pitch));
    V.rv += (Tr - m * (V.ay || 0) * hcg * 0.6) / Ir * h; V.rv *= 1 - h * 1.5; V.roll += V.rv * h; V.roll = Math.max(-0.14, Math.min(0.14, V.roll)); }
  // fixed-timestep driver with interpolation (render state = lerp(prev, cur, alpha))
  V.update = (dt, inp, after) => { V.acc0 = (V.acc0 || 0) + Math.min(dt, 0.1); const H = 1 / 120; let n = 0;
    while (V.acc0 >= H && n < 24) { V.prev = { x: V.x, z: V.z, yaw: V.yaw, y: V.y, heave: V.heave, pitch: V.pitch, roll: V.roll }; step(H, inp); if (after) after(V); V.acc0 -= H; n++; }
    const al = V.acc0 / H, p = V.prev || V; const lerp = (u, v) => u + (v - u) * al; let dy = V.yaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return { x: lerp(p.x, V.x), z: lerp(p.z, V.z), y: lerp(p.y, V.y), yaw: p.yaw + dy * al, heave: lerp(p.heave, V.heave), pitch: lerp(p.pitch, V.pitch), roll: lerp(p.roll, V.roll) }; };
  return V; }
// pose a car model from a render state (+ wheel spin/steer)
export function poseCar(car, s, steer, spin, wheelDrop) { car.position.set(s.x, s.y, s.z); car.rotation.y = s.yaw; const ch = car.userData.chassis;
  ch.position.y = 0.06 + (s.heave || 0); ch.rotation.set(-(s.pitch || 0), 0, s.roll || 0);
  for (const w of car.userData.wheels) { w.st.rotation.y = w.front ? steer : 0; w.sp.rotation.x = spin; w.st.position.y = car.userData.def.wr + (wheelDrop || 0); }
  car.userData.steer.rotation.z = -steer * 4; }

// ------------------------------------------------------------ procedural engine + horn sound (Web Audio)
let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { AC = null; } return AC; };
export function createEngineSound() { const a = ac(); if (!a) return { set() {}, stop() {} };
  const g = a.createGain(); g.gain.value = 0; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g); g.connect(a.destination);
  const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; const g2 = a.createGain(); g2.gain.value = 0.35; o1.connect(f); o2.connect(g2); g2.connect(f); o1.start(); o2.start();
  return { set(rpm, load, vol = 0.07) { const t = a.currentTime; const hz = 28 + rpm / 60 * 1.6; o1.frequency.setTargetAtTime(hz, t, 0.05); o2.frequency.setTargetAtTime(hz * 0.5, t, 0.05); f.frequency.setTargetAtTime(500 + rpm * 0.25 + load * 900, t, 0.08); g.gain.setTargetAtTime(vol * (0.45 + load * 0.55), t, 0.1); },
    stop() { try { g.gain.setTargetAtTime(0, a.currentTime, 0.05); setTimeout(() => { o1.stop(); o2.stop(); g.disconnect(); }, 400); } catch { /* */ } } }; }
export function honk() { const a = ac(); if (!a) return; const t = a.currentTime; for (const [hz, d] of [[420, 0], [530, 0]]) { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = hz; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.06, t + d + 0.02); g.gain.setValueAtTime(0.06, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.start(t); o.stop(t + 0.45); } }
