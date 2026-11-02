// ♿ Accessible parking: blue bays with the wheelchair symbol painted on the ground and a small sign post on the
// sidewalk side. Cheap: one shared canvas texture per kind, unlit MeshBasicMaterial (no lights), no colliders on the lot.
// Sign posts go through placeSign (clearSpot) so they never land on a road or a parking lot; a post with no clear spot is dropped.
import { placeSign, signFoot } from './layout.js';
import { drawWheelchair } from './cars.js';

let bayTex = null, signTex = null;
const cv = (w, h, f) => { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c; };
function tex(THREE, c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// ground decal: blue fill, white edge, big white symbol (drawn upright toward +y of the canvas = the aisle end of the bay)
function bayTexture(THREE) { return bayTex || (bayTex = tex(THREE, cv(256, 448, (g, w, h) => { g.fillStyle = '#1d4ed8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  drawWheelchair(g, w / 2, h * 0.62, w * 0.62); }))); }
function signTexture(THREE) { return signTex || (signTex = tex(THREE, cv(128, 160, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4ed8'; g.fillRect(8, 8, w - 16, 104);
  drawWheelchair(g, w / 2, 62, 88); g.fillStyle = '#1d4ed8'; g.font = '900 30px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ONLY', w / 2, 137); }))); }

// bay: { x, z, yaw (the stall's parking yaw: car faces this way when parked), w: stall width, l: stall length }, y = ground height
export function addAccessibleBay(THREE, parent, b, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w - 0.3, b.l - 0.3), new THREE.MeshBasicMaterial({ map: bayTexture(THREE), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, b.yaw + Math.PI, 0); m.position.set(b.x, y + 0.066, b.z); m.renderOrder = 1; m.name = 'hc-bay'; m.userData.hc = 1; parent.add(m); return m; }
// small sign post at (x, z) (nudged off roads/lots by placeSign), face turned to yaw. Returns the collider or null.
const SIGN_FOOT = signFoot(0.5, 0, [0], 0.07);
export function addAccessibleSign(THREE, parent, x, z, yaw, y) { const at = placeSign('accessible parking', x, z, SIGN_FOOT); if (!at) return null; const [sx, sz] = at;
  const g = new THREE.Group(); g.name = 'hc-sign'; g.position.set(sx, y, sz); g.rotation.y = yaw;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6), new THREE.MeshBasicMaterial({ color: '#9ca3af' })); post.position.y = 1.1; g.add(post);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.625), new THREE.MeshBasicMaterial({ map: signTexture(THREE), side: THREE.DoubleSide })); face.position.set(0, 1.95, 0.05); g.add(face);
  parent.add(g); return { x: sx, z: sz, r: 0.08, top: 99 }; }
