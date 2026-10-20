// 3D Pals (three.js, self-hosted & pinned r170). Procedural, stylised-PBR characters on a shared humanoid rig:
// Hips > Spine > Chest > Neck > Head, Chest > L/R Shoulder > UpperArm > LowerArm > Hand (3 fingers),
// Hips > L/R UpperLeg > LowerLeg > Foot (toe pads), Hips > Tail1..3. Bone names follow the humanoid convention
// so human mocap clips can be retargeted (see js/pals/mocap3d.js). Rendered into one shared offscreen WebGL
// canvas and blitted into the existing 2D canvases, so every screen keeps its drawPal()-style API.
// Everything is built from code: no external model files, no licensing beyond three.js (MIT).
import { dressBody, dressHead, bodyScale } from './cloth3d.js';
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { SPEC, SPECIES, stageOf } from './art.js';
import { ITEM } from './catalog.js';
import { WEAR_BY } from './wardrobe.js';
import { DANCES3D, clipFor } from './dances3d.js';

const D = Math.PI / 180;
let R = null, scene, cam, keyL, shadowPlane;
// Graphics: 'ultra' (opt-in) | 'high' (default) | 'low' (light 3D: smaller, no shadows) | 'flat' (2D art, only by choice).
// A sustained slow frame rate steps ultra -> high -> low for this visit only. It never drops to 2D.
const GK = 'kemy-pal-gfx';
export function gfxLevel() { if (autoG) return autoG; try { const v = localStorage.getItem(GK); if (v === 'ultra' || v === 'high' || v === 'low' || v === 'flat') return v; } catch { /* */ } const n = navigator; if ((n.connection && n.connection.saveData) || (n.deviceMemory && n.deviceMemory < 2)) return 'low'; return 'high'; }
let autoG = null; // auto step-down lasts for this visit only (never saved), so a slow moment doesn't stick forever
export function setGfx(v, auto) { if (auto) autoG = v; else { autoG = null; try { localStorage.setItem(GK, v); } catch { /* */ } } if (R) applyGfx(); }
const resOf = (g) => (g === 'ultra' ? 448 : g === 'low' ? 176 : 256);
function applyGfx() { const g = gfxLevel(); RES = resOf(g); R.setSize(RES, RES, false); R.shadowMap.enabled = g !== 'low'; keyL.castShadow = g !== 'low'; shadowPlane.visible = g !== 'low'; keyL.shadow.mapSize.set(g === 'ultra' ? 1024 : 512, g === 'ultra' ? 1024 : 512); keyL.shadow.map?.dispose(); keyL.shadow.map = null; }
let RES = 448;
const cache = new Map(); let lost = false, lostAt = 0, rebuilds = 0;
export function webglOK() {
  try { if (localStorage.getItem('kemy-pal3d') === '0') return false; } catch { /* */ }
  if (gfxLevel() === 'flat') return false; // the user picked 2D art
  try { const cv = document.createElement('canvas'); return !!(cv.getContext('webgl2') || cv.getContext('webgl')); } catch { return false; }
}
function init() {
  RES = resOf(gfxLevel()); const cv = document.createElement('canvas'); cv.width = cv.height = RES;
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  // iOS drops WebGL contexts when the app is backgrounded or memory is tight: show the loading placeholder, then
  // rebuild (restored event, or a fresh renderer if it never comes back). Cached models are rebuilt on the new context.
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; lostAt = performance.now(); });
  cv.addEventListener('webglcontextrestored', () => { dropCache(); lost = false; });
  R.setPixelRatio(1); R.setSize(RES, RES, false); R.setClearColor(0, 0);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.9; R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50); cam.position.set(0, 1.55, 7.2); cam.lookAt(0, 1.15, 0);
  scene.add(new THREE.HemisphereLight(0xfff4ff, 0x6a4fa0, 1.05));
  keyL = new THREE.DirectionalLight(0xfff1dc, 2.2); keyL.position.set(2.5, 5, 4); keyL.castShadow = true;
  keyL.shadow.mapSize.set(RES > 300 ? 1024 : 512, RES > 300 ? 1024 : 512); keyL.shadow.radius = 6; Object.assign(keyL.shadow.camera, { left: -2.2, right: 2.2, top: 3.4, bottom: -1, near: 0.5, far: 14 }); keyL.shadow.bias = -0.002;
  scene.add(keyL);
  const rim = new THREE.DirectionalLight(0xc9a8ff, 1.3); rim.position.set(-3, 2.5, -3); scene.add(rim);
  shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.28 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
  applyGfx();
}
function dropCache() { for (const m of cache.values()) m.traverse?.((o) => { o.geometry?.dispose?.(); }); cache.clear(); }
function rebuild() { rebuilds++; try { dropCache(); R.dispose(); R.forceContextLoss?.(); } catch { /* */ } R = null; lost = false; init(); }
export const status3D = () => ({ ready: !!R && !lost, lost, rebuilds, gfx: gfxLevel(), res: RES });
// test hook: simulate an iOS context loss (WEBGL_lose_context), used by the e2e tests
export function _loseContext(restore = true) { const x = R && R.getContext().getExtension('WEBGL_lose_context'); if (!x) return false; x.loseContext(); if (restore) setTimeout(() => x.restoreContext(), 400); return true; }
// soft pulsing silhouette shown while 3D loads or recovers (instead of switching to the flat 2D art)
export function drawLoading(c, x, y, size) {
  const p = 0.5 + 0.5 * Math.sin(performance.now() / 260); c.save(); c.globalAlpha = 0.28 + p * 0.22; c.fillStyle = '#e9dcff';
  c.beginPath(); c.ellipse(x, y - size * 0.42, size * 0.36, size * 0.42, 0, 0, 7); c.fill(); c.globalAlpha = 0.2; c.beginPath(); c.ellipse(x, y - 2, size * 0.34, size * 0.06, 0, 0, 7); c.fill(); c.restore();
}
// ---------------------------------------------------------------- materials ("fur" = soft sheen PBR, "skin" = smooth clearcoat)
let FUR = null;
function furTex() {
  if (FUR) return FUR; const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); const img = c.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (Math.random() - 0.5) * 70; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
  c.putImageData(img, 0, 0); FUR = new THREE.CanvasTexture(cv); FUR.wrapS = FUR.wrapT = THREE.RepeatWrapping; FUR.repeat.set(6, 6); return FUR;
}
function mat(hex, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: o.r ?? 0.62, sheen: o.sheen ?? 0.6, sheenRoughness: 0.55,
    sheenColor: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.25), clearcoat: o.cc ?? 0, clearcoatRoughness: 0.35,
    transparent: !!o.op, opacity: o.op ?? 1, bumpMap: o.fur ? furTex() : null, bumpScale: o.fur ? 0.35 : 1, emissive: new THREE.Color(o.em || '#000000'), emissiveIntensity: o.em ? 0.35 : 0 });
}
const G = {}; // shared geometries (memory-light)
const geo = (k, f) => G[k] || (G[k] = f());
function mesh(g, m, p) { const o = new THREE.Mesh(g, m); o.castShadow = true; if (p) p.add(o); return o; }
const sph = (r = 1) => geo('s' + r, () => new THREE.SphereGeometry(r, 48, 32));
const cap = (r, l) => geo(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 10, 24));
const cone = (r, h) => geo(`k${r}_${h}`, () => new THREE.ConeGeometry(r, h, 28));
function bone(name, parent, x, y, z) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; }
function shade(hex, k) { const c = new THREE.Color(hex); return k < 0 ? c.multiplyScalar(1 + k) : c.lerp(new THREE.Color('#fff'), k); }

// ---------------------------------------------------------------- build one Pal
function build(pal) {
  const sp = SPEC[pal.species] || SPECIES[0]; const col = pal.colors || {};
  const B = col.body || sp.body, A = col.accent || sp.acc, E = col.eye || '#24133f';
  const ex = new Set(sp.extras || []); const kind = sp.body2 || 'blob'; const stage = stageOf(pal.level || 1);
  const skin = ['frog', 'kemy', 'turtle', 'dragon', 'penguin', 'seal', 'jelly', 'starsprite'].includes(sp.id);
  const mB = mat(B, skin ? { sheen: 0.2, cc: 0.6, r: 0.45 } : { fur: 1 }), mA = mat(A), mDark = mat(shade(B, -0.25)), mLight = mat(shade(B, 0.5));
  const mEye = new THREE.MeshPhysicalMaterial({ color: E, roughness: 0.15, clearcoat: 1 }), mWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mPink = mat('#ff9ec4', { op: 0.75, sheen: 0 }), mNose = mat('#3a2440', { sheen: 0, cc: 1, r: 0.3 });
  const root = new THREE.Group(); const S = [0.86, 1, 1.1][stage];
  const J = {}; // joints
  J.Hips = bone("Hips", root, 0, 0.64, 0);
  const [bw, bh, bd] = kind === 'blob' ? bodyScale(sp.id) : [1, 1, 1]; // per-species body type (small/medium/large/long/round)
  J.Spine = bone('Spine', J.Hips, 0, 0.12, 0); J.Chest = bone('Chest', J.Spine, 0, 0.32 * bh, 0);
  J.Neck = bone('Neck', J.Chest, 0, 0.2 * bh, 0);
  J.TB = new THREE.Group(); J.TB.scale.set(bw, bh, bd); J.Spine.add(J.TB); J.TBh = new THREE.Group(); J.TBh.position.y = 0.12; J.TBh.scale.set(bw, bh, bd); J.Hips.add(J.TBh); J.Head = bone('Head', J.Neck, 0, 0.1, 0);
  // torso: pear-shaped belly + chest (soft, chubby kid proportions)
  if (kind === 'blob') {
    const torso = mesh(geo('torso', () => { const pts = [[0, -0.24], [0.2, -0.22], [0.33, -0.15], [0.41, -0.02], [0.42, 0.1], [0.38, 0.24], [0.31, 0.36], [0.25, 0.46], [0.22, 0.54], [0.2, 0.62], [0, 0.66]].map(([r, y]) => new THREE.Vector2(r, y));
      return new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(48), 56); }), mB, J.TB); torso.scale.set(1, 1, 0.88);
    if (ex.has('belly') || sp.id === 'penguin' || sp.id === 'owl') { const b = mesh(sph(1), mat(sp.id === 'penguin' ? '#fbf6ff' : shade(B, 0.6)), J.TB); b.scale.set(0.3, 0.36, 0.2); b.position.set(0, 0.04, 0.2); b.userData.deco = 1; }
    if (ex.has('shell')) { const sh = mesh(sph(1), mat(A, { cc: 0.8, sheen: 0 }), J.TB); sh.scale.set(0.5, 0.52, 0.34); sh.position.set(0, 0.12, -0.18); }
    if (ex.has('plates')) for (let i = 0; i < 5; i++) { const k = mesh(geo('plate', () => { const g = new THREE.CylinderGeometry(0.0, 0.11, 0.18, 4); g.scale(1, 1, 0.25); return g; }), mA, J.TB); k.position.set(0, 0.48 - i * 0.14, -0.4 + i * 0.02); k.rotation.x = -0.6 - i * 0.15; }
    if (ex.has('fin')) { const f = mesh(cone(0.12, 0.3), mA, J.TB); f.scale.z = 0.3; f.position.set(0, 0.42, -0.36); f.rotation.x = -0.6; }
    if (ex.has('spikes')) for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const s = mesh(cone(0.075, 0.3), mA, J.TB); const a = -1.35 + i * 0.45; const y = 0.42 - r * 0.24; const rad = 0.5 - (r === 2 ? 0.06 : 0); s.position.set(Math.sin(a) * rad, y, -Math.cos(a) * rad * 0.9); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(a) * 0.8, 0.55, -Math.cos(a)).normalize()); }
    if (ex.has('stripes') || ex.has('giraffespots')) for (let i = 0; i < 6; i++) { const s = mesh(sph(1), mA, J.TB); s.scale.set(ex.has('stripes') ? 0.03 : 0.06, ex.has('stripes') ? 0.12 : 0.05, 0.04); const a = -1 + (i % 3) * 1; s.position.set(Math.sin(a) * 0.4, -0.05 + Math.floor(i / 3) * 0.2, Math.cos(a) * 0.33); s.userData.deco = 1; }
    if (ex.has('wool')) for (let i = 0; i < 10; i++) { const w = mesh(sph(0.15), mat('#ffffff'), J.TB); const a = i * 0.63; w.position.set(Math.sin(a) * 0.34, 0.02 + (i % 2) * 0.14, Math.cos(a) * 0.28); w.userData.deco = 1; }
  } else if (kind === 'jelly') {
    const bell = mesh(sph(1), mat(B, { op: 0.82, cc: 1, sheen: 0, r: 0.2 }), J.Chest); bell.scale.set(0.62, 0.52, 0.58);
    J.tent = []; for (let i = 0; i < 6; i++) { const a = i * 1.05; const t = bone('Tent' + i, J.Spine, Math.sin(a) * 0.3, -0.05, Math.cos(a) * 0.3); const m = mesh(cap(0.05, 0.45), mat(A, { op: 0.85 }), t); m.position.y = -0.25; J.tent.push(t); }
  } else if (kind === 'star') {
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.28 : 0.62; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const g = geo('star', () => { const e = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.14, bevelSegments: 6 }); e.center(); return e; });
    mesh(g, mat('#ffe680', { em: '#ffcc33', cc: 0.6 }), J.Chest).position.y = 0.05;
  } else if (kind === 'cloud') {
    for (const [x, y, r] of [[0, 0, 0.4], [-0.35, -0.05, 0.3], [0.35, -0.05, 0.3], [-0.18, 0.25, 0.28], [0.2, 0.25, 0.3]]) mesh(sph(r), mat(B, { sheen: 1 }), J.Chest).position.set(x, y, 0);
  }
  // head: big round head, slightly squashed, kid-friendly
  const headR = (kind === 'blob' ? 0.44 : 0.4) * (sp.id === 'jelly' ? 0 : 1);
  if (headR) { const h = mesh(sph(1), mB, J.Head); h.scale.set(headR * 1.08, headR, headR * 0.98); h.position.y = headR * 0.82; const ch = mesh(sph(1), mB, J.Head); ch.scale.set(headR * 0.95, headR * 0.6, headR * 0.85); ch.position.set(0, headR * 0.52, headR * 0.08); }
  const hy = headR * 0.82 || 0.05, fz = headR * 0.9 || 0.6;
  const H = new THREE.Group(); H.position.y = hy - (sp.id === 'jelly' ? 0.42 : 0); J.Head.add(H); J.face = H;
  if (ex.has('antennae') && headR) for (const q of [-1, 1]) { const st = mesh(cap(0.014, 0.26), mA, H); st.position.set(q * 0.14, headR * 1.05, 0.05); st.rotation.z = -q * 0.35; mesh(sph(0.045), mat(A, { em: A }), H).position.set(q * 0.21, headR * 1.05 + 0.15, 0.05); }
  if (ex.has('crest') && headR) for (let i = 0; i < 4; i++) { const k = mesh(cone(0.06 - i * 0.008, 0.16), mA, H); k.position.set(0, headR * 0.95 - i * 0.1 * 0.3, -i * 0.12); k.rotation.x = -0.5 - i * 0.25; }
  if (ex.has('mane')) for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14; mesh(sph(0.16), mA, H).position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.5, -0.12); }
  if (ex.has('wool')) for (let i = 0; i < 6; i++) mesh(sph(0.14), mat('#ffffff'), H).position.set(-0.25 + i * 0.1, 0.42 + (i % 2) * 0.04, 0.05);
  // eyes (glossy, with catch-lights) + blush
  const eyes = []; const er = 0.085 * (ex.has('frogeyes') ? 1.3 : 1);
  for (const s of [-1, 1]) {
    const ey = ex.has('frogeyes') ? 0.36 : 0.06, ex0 = s * 0.19, hz = headR ? headR * 0.98 * Math.sqrt(Math.max(0.05, 1 - (ex0 / (headR * 1.08)) ** 2 - (ey / headR) ** 2)) : fz;
    const g = new THREE.Group(); g.position.set(ex0, ey, ex.has('frogeyes') ? fz * 0.92 : hz - er * 0.22); g.rotation.y = s * 0.28; H.add(g);
    if (ex.has('frogeyes')) mesh(sph(0.15), mB, g).position.z = -0.06;
    if (new THREE.Color(B).getHSL({}).l < 0.3) { const w = mesh(sph(1), mat('#ffffff', { sheen: 0 }), g); w.scale.set(er * 1.5, er * 1.6, er * 0.5); w.position.z = -0.02; }
    const e = mesh(sph(1), mEye, g); e.scale.set(er, er * 1.15, er * 0.42);
    const hl = mesh(sph(0.024), mWhite, g); hl.position.set(-0.028, 0.04, er * 0.4); const hl2 = mesh(sph(0.011), mWhite, g); hl2.position.set(0.025, -0.03, er * 0.4);
    const lid = mesh(sph(1), mB, g); lid.scale.set(er * 1.2, er * 1.3, er * 0.6); lid.position.y = er * 2.6; lid.userData.open = er * 2.6; lid.userData.shut = er * 0.25; g.userData.lid = lid; eyes.push(g);
    if (sp.id === 'panda' || ex.has('eyepatch')) { const p = mesh(sph(1), mat(A), H); p.scale.set(0.13, 0.15, 0.05); p.position.set(s * 0.19, 0.04, fz * 0.88); p.rotation.z = s * 0.4; }
    const bl = mesh(sph(1), mPink, H); bl.scale.set(0.08, 0.05, 0.03); bl.position.set(s * 0.3, -0.08, fz * 0.84);
  }
  J.eyes = eyes;
  // snout
  const sn = sp.snout; const snz = fz;
  if (sn === 'muzzle' || sn === 'nose' || sn === 'whiskers') { const m = mesh(sph(1), mLight, H); m.scale.set(0.16, 0.11, 0.1); m.position.set(0, -0.1, snz * 0.95); const n = mesh(sph(1), mNose, H); n.scale.set(0.05, 0.035, 0.03); n.position.set(0, -0.06, snz * 0.95 + 0.09); }
  if (ex.has('whiskers')) for (const s of [-1, 1]) for (const k of [-1, 1]) { const w = mesh(cap(0.006, 0.18), mNose, H); w.position.set(s * 0.22, -0.1 + k * 0.025, snz * 0.95); w.rotation.z = Math.PI / 2 + k * 0.15 * s; }
  if (sn === 'beak' || sn === 'duckbill') { const b = mesh(cone(0.08, 0.16), mat('#ffa53a', { sheen: 0, cc: 0.6 }), H); b.rotation.x = Math.PI / 2; b.position.set(0, -0.07, snz + 0.1); b.scale.setScalar(1.25); if (sn === 'duckbill') b.scale.set(1.9, 1.25, 0.75); }
  if (sn === 'pig') { const p = mesh(geo('pig', () => new THREE.CylinderGeometry(0.1, 0.1, 0.08, 18)), mat(shade(B, -0.12)), H); p.rotation.x = Math.PI / 2; p.position.set(0, -0.1, snz + 0.05); for (const q of [-1, 1]) { const h = mesh(sph(0.018), mat(shade(B, -0.5), { sheen: 0 }), H); h.position.set(q * 0.035, -0.1, snz + 0.09); h.scale.z = 0.4; } }
  if (sn === 'trunk') {
    J.trunk = []; let par = H; const n = 7, L = 0.078;
    const base = mesh(sph(1), mB, H); base.scale.set(0.13, 0.12, 0.1); base.position.set(0, -0.06, snz * 0.86);
    let b = bone('Trunk0', H, 0, -0.07, snz * 0.9); par = b;
    for (let k = 0; k < n; k++) { const r0 = 0.1 - k * 0.0075, r1 = r0 - 0.0075;
      const seg = mesh(geo(`tr${k}`, () => new THREE.CylinderGeometry(r1, r0, L * 1.08, 28, 1, true)), mB, par); seg.position.y = -L / 2;
      mesh(sph(r1 * 1.0), mB, par).position.y = -L; J.trunk.push(par);
      if (k < n - 1) par = bone('Trunk' + (k + 1), par, 0, -L, 0); }
    const tip = mesh(geo('trtip', () => new THREE.CylinderGeometry(0.06, 0.047, 0.03, 28)), mB, par); tip.position.y = -L - 0.012;
    const nos = mesh(geo('trnos', () => new THREE.CircleGeometry(0.04, 24)), mat(shade(B, -0.4), { sheen: 0 }), par); nos.rotation.x = Math.PI / 2; nos.position.y = -L - 0.028;
    for (const sx of [-1, 1]) { const tk = mesh(cone(0.022, 0.09), mat('#fffaf0', { sheen: 0, cc: 0.8 }), H); tk.position.set(sx * 0.1, -0.15, snz * 0.86); tk.rotation.set(0.9, 0, sx * -0.3); }
  }
  // mouth: small smile
  const mo = mesh(geo('smile', () => new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI)), mNose, H); mo.rotation.z = Math.PI; mo.position.set(0, sn === 'trunk' ? -0.2 : -0.16, snz * 0.97 + 0.02); J.mouth = mo;
  // ears
  J.ears = []; const ea = sp.ears;
  for (const s of [-1, 1]) {
    const e = bone(s < 0 ? 'EarR' : 'EarL', H, s * 0.3, 0.32, 0); let m;
    if (ea === 'round' || ea === 'biground') { const r = ea === 'round' ? 0.13 : 0.2; m = mesh(sph(1), mB, e); m.scale.set(r, r, r * 0.55); const i = mesh(sph(1), mat(ex.has('eyepatch') ? A : '#ffc0d8'), e); i.scale.set(r * 0.6, r * 0.6, r * 0.2); i.position.z = r * 0.42; e.position.set(s * (ea === 'round' ? 0.34 : 0.4), 0.34, -0.02); }
    if (ea === 'pointy') { m = mesh(cone(0.13, 0.3), sp.id === 'fox' || sp.id === 'redpanda' ? mA : mB, e); m.position.y = 0.12; m.scale.z = 0.6; const ie = mesh(cone(0.075, 0.2), mat('#ffc0d8'), e); ie.position.set(0, 0.1, 0.035); ie.scale.z = 0.3; e.rotation.z = -s * 0.25; }
    if (ea === 'long') { m = mesh(cap(0.08, 0.38), mB, e); m.position.y = 0.26; m.scale.z = 0.5; const i = mesh(cap(0.045, 0.3), mat('#ffb3cf'), e); i.position.set(0, 0.26, 0.03); i.scale.z = 0.3; e.position.set(s * 0.14, 0.4, 0); e.rotation.z = -s * 0.12; }
    if (ea === 'floppy') { m = mesh(cap(0.1, 0.22), mA, e); m.position.y = -0.14; m.scale.z = 0.45; e.position.set(s * 0.42, 0.22, 0); e.rotation.z = s * 0.35; }
    if (ea === 'big') { m = mesh(sph(1), mB, e); m.scale.set(0.3, 0.36, 0.075); m.position.set(s * 0.24, 0, 0); m.rotation.y = -s * 0.35; const i = mesh(sph(1), mat('#ffb8d4'), e); i.scale.set(0.21, 0.26, 0.04); i.position.set(s * 0.25, 0, 0.045); i.rotation.y = -s * 0.35; e.position.set(s * 0.36, 0.04, -0.06); e.userData.flap = 1; }
    if (ea === 'ossicones') { m = mesh(cap(0.03, 0.16), mDark, e); m.position.y = 0.1; mesh(sph(0.055), mA, e).position.y = 0.22; e.position.set(s * 0.14, 0.42, 0); }
    if (ea === 'gills') for (let i = 0; i < 3; i++) { const g = mesh(cap(0.035, 0.2), mA, e); g.position.set(s * 0.12, 0.05 - i * 0.12, 0); g.rotation.z = -s * (0.9 - i * 0.6); e.position.set(s * 0.4, 0.05, 0); }
    if (ea === 'tuft' && s > 0) { m = mesh(cone(0.05, 0.2), mA, e); m.position.set(-0.3, 0.18, 0.1); }
    J.ears.push(e);
  }
  if (ex.has('horn') || ex.has('horns')) for (const s of ex.has('horn') ? [0] : [-1, 1]) { const h = mesh(cone(0.06, 0.26), mat(ex.has('horn') ? '#ffe88a' : '#fff0d0', { em: ex.has('horn') ? '#ffd34d' : undefined }), H); h.position.set(s * 0.2, 0.5, 0.15); h.rotation.set(0.3, 0, -s * 0.3); }
  if (ex.has('rainbowmane')) ['#ff8ab8', '#ffd34d', '#7fe0a0', '#7fb8ff', '#c49aff'].forEach((c, i) => mesh(sph(0.1), mat(c), H).position.set(-0.05, 0.42 - i * 0.12, -0.32 - i * 0.02));
  // arms: shoulder > upper > lower > hand (+3 fingers); flippers / wings swap the hand shape
  const armType = ex.has('wings') ? 'wing' : ex.has('flippers') ? 'flipper' : 'paw';
  const ua = 0.3, la = 0.27, ar = (kind === 'blob' ? 0.09 : 0.078) * (1 + (bw - 1) * 0.6), shY = kind === 'blob' ? 0.1 : 0;
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    const sh = bone(n + 'Shoulder', J.Chest, s * (kind === 'blob' ? 0.36 * bw : 0.45), shY, 0);
    const up = bone(n + 'UpperArm', sh, 0, 0, 0); const lo = bone(n + 'LowerArm', up, 0, -ua, 0); const hd = bone(n + 'Hand', lo, 0, -la, 0);
    if (armType === 'wing') { const w = mesh(sph(1), mat(shade(B, -0.08)), up); w.scale.set(0.07, 0.28, 0.18); w.position.y = -0.2; }
    else if (armType === 'flipper') { const w = mesh(sph(1), mB, up); w.scale.set(0.07, 0.3, 0.13); w.position.y = -0.22; }
    else {
      mesh(cap(ar, ua), mB, up).position.y = -ua / 2; mesh(cap(ar * 0.92, la), mB, lo).position.y = -la / 2; mesh(sph(ar * 1.12), mB, up); mesh(sph(ar * 0.98), mB, lo);
      const p = mesh(sph(1), skin ? mB : mLight, hd); p.scale.set(0.11, 0.1, 0.09); p.position.y = -0.04;
      for (const f of [-1, 0, 1]) { const fi = mesh(cap(0.022, 0.04), skin ? mB : mLight, hd); fi.position.set(f * 0.04, -0.11, 0.015); fi.rotation.z = f * 0.25; }
    }
    J[n + 'Shoulder'] = sh; J[n + 'UpperArm'] = up; J[n + 'LowerArm'] = lo; J[n + 'Hand'] = hd;
  }
  // legs: hip > upper > lower > foot (+ toe pads)
  const ul = 0.27, ll = 0.27, lr = 0.122 * (1 + (bw - 1) * 0.6); J.legL = ul + ll;
  const legs = kind === 'blob' && sp.feet !== 'none' && !ex.has('float');
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    const up = bone(n + 'UpperLeg', J.Hips, s * 0.19 * bw, 0, 0); const lo = bone(n + 'LowerLeg', up, 0, -ul, 0); const ft = bone(n + 'Foot', lo, 0, -ll, 0);
    if (legs) {
      mesh(cap(lr, ul), mB, up).position.y = -ul / 2; mesh(cap(lr * 0.9, ll), mB, lo).position.y = -ll / 2; mesh(sph(lr * 1.15), mB, up); mesh(sph(lr * 0.95), mB, lo);
      if (sp.feet === 'webbed') { const f = mesh(sph(1), mat('#ffa53a', { sheen: 0 }), ft); f.scale.set(0.11, 0.035, 0.16); f.position.set(0, -0.02, 0.06); }
      else if (sp.feet === 'flippers') { const f = mesh(sph(1), mDark, ft); f.scale.set(0.12, 0.04, 0.2); f.position.set(0, -0.02, 0.08); }
      else { const f = mesh(sph(1), mB, ft); f.scale.set(0.13, 0.08, 0.17); f.position.set(0, -0.02, 0.05); for (const q of [-1, 0, 1]) { const tp = mesh(sph(0.025), mat('#ffb3cf', { sheen: 0 }), ft); tp.position.set(q * 0.045, -0.04, 0.18); } }
    }
    J[n + 'UpperLeg'] = up; J[n + 'LowerLeg'] = lo; J[n + 'Foot'] = ft;
  }
  if (!legs) J.Hips.position.y = 0.95;
  J.fit = { ar, lr, ua, la, ul, ll, legs, kind };
  // tail chain (3 bones) per species
  J.tail = []; const tl = sp.tail;
  if (tl !== 'none') {
    let p = bone('Tail1', J.Hips, 0, 0.05, -0.3); J.tail.push(p);
    const segs = { wag: [0.05, 0.16], thin: [0.042, 0.18], tuft: [0.042, 0.17], fluffy: [0.11, 0.14], ringed: [0.09, 0.15], axo: [0.07, 0.17], dragon: [0.07, 0.18], flat: [0.08, 0.1] }[tl];
    if (segs) { for (let i = 0; i < 3; i++) { const m = mesh(cap(segs[0] * 1.35 * (1 - i * 0.16), segs[1]), tl === 'ringed' && i === 1 ? mA : tl === 'flat' ? mDark : mB, p); m.position.y = segs[1] / 2 + 0.03; if (tl === 'flat') m.scale.z = 0.4; p = bone('Tail' + (i + 2), p, 0, segs[1] + 0.03, 0); J.tail.push(p); } p.parent.rotation && 0; }
    if (tl === 'tuft' || tl === 'fluffy') mesh(sph(tl === 'tuft' ? 0.07 : 0.1), tl === 'tuft' ? mA : mat('#ffffff'), p);
    if (tl === 'dragon') { const k = mesh(cone(0.09, 0.16), mA, p); k.position.y = 0.04; }
    if (tl === 'puff' || tl === 'stub') mesh(sph(tl === 'puff' ? 0.12 : 0.08), tl === 'puff' ? mat('#ffffff') : mDark, J.tail[0]);
    if (tl === 'curl') mesh(geo('curl', () => new THREE.TorusGeometry(0.075, 0.032, 12, 24, Math.PI * 1.6)), mA, J.tail[0]);
    J.tail[0].rotation.x = -2.2;
  }
  if (ex.has('batwings') || ex.has('fairywings')) for (const s of [-1, 1]) { const w = bone('Wing' + s, J.Chest, s * 0.18, 0.1, -0.25); const m = mesh(sph(1), mat(ex.has('fairywings') ? '#e8f4ff' : A, { op: ex.has('fairywings') ? 0.6 : 1 }), w); m.scale.set(0.32, 0.22, 0.02); m.position.x = s * 0.3; (J.wings = J.wings || []).push(w); }
  // outfit: simple 3D pieces by slot (keeps the item's colour)
  const of = pal.outfit || {}; const it = (s) => { const i = WEAR_BY[of[s]] ? null : ITEM[of[s]]; return i && i.slot === s ? i : null; };
  const head = it('head'); if (head && headR) { const st = head.st || ''; const c = mat(head.col || '#ffd34d', { cc: 0.4 });
    if (/crown|tiara/.test(st)) { const g = mesh(geo('crown', () => new THREE.CylinderGeometry(0.2, 0.17, 0.14, 8, 1, true)), mat('#ffd34d', { em: '#ffb000', cc: 1 }), H); g.position.y = 0.52; }
    else if (/wizard|witch|santa/.test(st)) { const g = mesh(cone(0.3, 0.5), c, H); g.position.y = 0.6; g.rotation.z = 0.15; }
    else if (/halo/.test(st)) { const g = mesh(geo('halo', () => new THREE.TorusGeometry(0.22, 0.03, 8, 24)), mat('#ffe88a', { em: '#ffd34d' }), H); g.rotation.x = Math.PI / 2; g.position.y = 0.7; }
    else if (/flowers/.test(st)) { for (let i = 0; i < 7; i++) { const a = i * 0.9; mesh(sph(0.06), mat(['#ff8ab8', '#ffd34d', '#ffffff'][i % 3]), H).position.set(Math.cos(a) * 0.32, 0.38, Math.sin(a) * 0.28); } }
    else if (/bow/.test(st)) { for (const s of [-1, 1]) { const b = mesh(cone(0.09, 0.16), c, H); b.position.set(0.2 + s * 0.08, 0.42, 0.1); b.rotation.z = s * Math.PI / 2; } }
    else { const g = mesh(sph(1), c, H); g.scale.set(0.42, 0.2, 0.42); g.position.y = 0.38; if (/top/.test(st)) { g.scale.set(0.26, 0.3, 0.26); g.position.y = 0.62; } } }
  const face = it('face'); if (face && headR && /round|monocle|goggles/.test(face.st || '')) for (const s of face.st === 'monocle' ? [1] : [-1, 1]) { const g = mesh(geo('rim', () => new THREE.TorusGeometry(0.11, 0.018, 8, 20)), mat(face.col || '#3a2a63', { cc: 1 }), H); g.position.set(s * 0.19, 0.06, fz + 0.03); }
  else if (face && headR) for (const s of [-1, 1]) { const g = mesh(geo('lens', () => new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16)), mat(face.col || '#222', { cc: 1 }), H); g.rotation.x = Math.PI / 2; g.position.set(s * 0.19, 0.06, fz + 0.04); }
  const neck = it('neck'); if (neck) { const n = mesh(geo('scarf', () => new THREE.TorusGeometry(0.26, 0.06, 8, 20)), mat(neck.col || '#ff7ab8'), J.Neck); n.rotation.x = Math.PI / 2; n.position.y = -0.03; }
  const body = it('body'); if (body && kind === 'blob') { const t = mesh(sph(1), mat(body.col || '#5aa8ff'), J.Spine); t.scale.set(0.43, 0.33, 0.38); t.position.y = 0.1; const t2 = mesh(sph(1), mat(body.col || '#5aa8ff'), J.Chest); t2.scale.set(0.37, 0.28, 0.32); }
  const feet = it('feet'); if (feet && legs) for (const n of ['Left', 'Right']) { const s = mesh(sph(1), mat(feet.col || '#ff5a6a', { cc: 0.5 }), J[n + 'Foot']); s.scale.set(0.125, 0.08, 0.17); s.position.set(0, -0.01, 0.06); }
  wear3D(of, { J, H, headR, fz, legs, kind, B, sp, ex });
  const pt = pal.pattern; if (pt && pt.startsWith('pt_') && kind === 'blob') { const cols = pt === 'pt_rainbow' ? ['#ff6a7a', '#ffb34a', '#ffe64a', '#6ad870', '#4aa8ff', '#9a6aff'] : pt === 'pt_galaxy' ? ['#3a1a8a', '#ffffff', '#6a3aff'] : pt === 'pt_hearts' ? ['#ff6fae'] : ['#ffe680'];
    for (let i = 0; i < 14; i++) { const a = -1.2 + (i % 7) * 0.4, y = 0.02 + Math.floor(i / 7) * 0.2; const d = mesh(sph(1), mat(cols[i % cols.length], { em: pt === 'pt_galaxy' && i % 3 === 1 ? '#ffffff' : undefined }), J.Spine); d.scale.set(0.04, 0.04, 0.015); d.position.set(Math.sin(a) * 0.47, y, Math.cos(a) * 0.43); d.lookAt(Math.sin(a) * 2, y, Math.cos(a) * 2); } }
  // rare variants (shiny / glow / galaxy / gold / crystal)
  const vr = pal.variant; if (vr) root.traverse((o) => { if (!o.isMesh || !o.material || o.material.userData.wear) return; const m0 = o.material; if (m0.userData.vx || !m0.isMeshStandardMaterial) return; const m = m0.clone(); m.userData.vx = 1;
    if (vr === 'rare_shiny') { m.clearcoat = 1; m.clearcoatRoughness = 0.1; m.sheen = 1; }
    if (vr === 'rare_glow') { m.emissive.copy(m.color).multiplyScalar(0.55); m.emissiveIntensity = 0.8; }
    if (vr === 'rare_galaxy') { m.color.lerp(new THREE.Color('#3a1a8a'), 0.6); m.emissive.set('#2a0a5a'); m.emissiveIntensity = 0.7; m.clearcoat = 1; }
    if (vr === 'rare_gold') { m.color.lerp(new THREE.Color('#ffcf3a'), 0.75); m.metalness = 0.75; m.roughness = 0.25; m.clearcoat = 1; }
    if (vr === 'rare_crystal') { m.transparent = true; m.opacity = 0.78; m.clearcoat = 1; m.color.lerp(new THREE.Color('#d8f0ff'), 0.5); }
    m.needsUpdate = true; o.material = m; });
  if (vr === 'rare_galaxy' || vr === 'rare_glow' || vr === 'rare_crystal') for (let i = 0; i < 10; i++) { const a = i * 2.4, y = 0.1 + (i % 5) * 0.12; const st = mesh(sph(0.02), new THREE.MeshBasicMaterial({ color: '#fffbe0' }), J.Spine); st.position.set(Math.sin(a) * 0.43, y, Math.cos(a) * 0.4); }
  // rest pose
  J.LeftUpperArm.rotation.z = 0.25; J.RightUpperArm.rotation.z = -0.25;
  root.scale.setScalar(S); root.userData = { J, sp, legs, kind, S }; root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return root;
}
// ---------------------------------------------------------------- posing
const spring = new WeakMap();
// Applies a full-body human-style pose (see dances3d.js for the joint format) plus procedural life:
// breathing, blinks, foot-planted knee IK for crouches/weight shifts, and follow-through on head, ears, tail.
function apply(rootObj, P, t, mode) {
  const { J, legs } = rootObj.userData; const L = J.legL;
  J.Hips.position.set(P.hx || 0, (legs ? 0.64 : 0.95) + (P.hy || 0), P.hz || 0);
  J.Hips.rotation.set(P.hrx || 0, P.hry || 0, P.hrz || 0);
  J.Spine.rotation.set(P.sx || 0, P.sy || 0, P.sz || 0); J.Chest.rotation.set(P.cx || 0, P.cy || 0, P.cz || 0);
  // head with lag (follow-through)
  const sp = spring.get(rootObj) || { hx: 0, hz: 0, e: 0, tl: 0 }; spring.set(rootObj, sp);
  sp.hx += ((P.nx || 0) - sp.hx) * 0.35; sp.hz += ((P.nz || 0) - sp.hz) * 0.35;
  J.Neck.rotation.set(sp.hx * 0.4, (P.ny || 0) * 0.5, sp.hz * 0.4); J.Head.rotation.set(sp.hx * 0.6, (P.ny || 0) * 0.5, sp.hz * 0.6);
  // arms: [abduct°, forward°, elbow°, twist°]
  for (const [n, s, a] of [['Left', 1, P.aL], ['Right', -1, P.aR]]) {
    const [ab = 14, fw = 0, el = 10, tw = 0] = a || [];
    const u = J[n + 'UpperArm']; u.rotation.set(-fw * D, tw * D * s, s * ab * D, 'ZXY');
    J[n + 'LowerArm'].rotation.set(-el * D, 0, 0); J[n + 'Hand'].rotation.set(0, 0, s * (P.wr || 0) * D);
  }
  // legs: [lift°, spread°, extraKnee°], plus foot-planted IK from hip drop/shift
  if (legs) for (const [n, s, lg] of [['Left', 1, P.lL], ['Right', -1, P.lR]]) {
    const [lift = 0, spr = 0, kn = 0] = lg || [];
    const drop = Math.max(0, -(P.hy || 0) + s * (P.hx || 0) * 0.35); const a = Math.acos(Math.max(0.2, Math.min(1, (L - drop) / L)));
    J[n + 'UpperLeg'].rotation.set(-a - lift * D, 0, s * spr * D - (P.hrz || 0));
    J[n + 'LowerLeg'].rotation.set(2 * a + kn * D, 0, 0); J[n + 'Foot'].rotation.set(-a + (lift - kn) * D * 0.5, 0, 0);
  }
  // life: breathing, blink, ears + tail spring
  const br = Math.sin(t * 0.05) * 0.015; J.Chest.scale.set(1 + br, 1 + br, 1 + br);
  const shut = (Math.floor(t / 4) % 55 === 0) || mode === 'sleep'; for (const e of J.eyes) { const l = e.userData.lid; if (l) { l.position.y += ((shut ? l.userData.shut : l.userData.open) - l.position.y) * 0.6; l.visible = l.position.y < l.userData.open * 0.95; } }
  sp.e += ((-(P.hy || 0) * 3 + (P.hrz || 0)) - sp.e) * 0.15;
  J.ears.forEach((e, i) => { e.rotation.x = sp.e * 0.4; e.rotation.y = e.userData.flap ? (i ? 1 : -1) * (Math.sin(t * 0.09) * 0.18 + (mode === 'react' ? Math.sin(t * 0.6) * 0.4 : 0)) : 0; e.userData.z ??= e.rotation.z; e.rotation.z = e.userData.z + Math.sin(t * 0.07 + i) * 0.04 + (i ? -1 : 1) * sp.e * 0.2; });
  sp.tl += ((P.hrz || 0) * -2 + (P.hx || 0) * -2 - sp.tl) * 0.12;
  J.tail.forEach((b, i) => { if (i) b.rotation.set(0.3, 0, Math.sin(t * (P.tw || 0.1) - i * 0.6) * 0.25 + sp.tl * 0.3); else b.rotation.z = Math.sin(t * (P.tw || 0.1)) * 0.3 + sp.tl; });
  if (J.tent) J.tent.forEach((b, i) => { b.rotation.x = Math.sin(t * 0.12 + i) * 0.3; b.rotation.z = Math.cos(t * 0.1 + i) * 0.2; });
  if (J.wings) J.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.4 + Math.sin(t * 0.3) * 0.3); });
  if (J.trunk) { const up = mode === 'react' || mode === 'happy'; J.trunk.forEach((b, k) => { b.rotation.x = (up ? -0.45 : -(0.08 + k * 0.06)) + Math.sin(t * 0.08 - k * 0.55) * (0.07 + k * 0.012); b.rotation.z = Math.sin(t * 0.05 - k * 0.4) * 0.05 * k; }); }
  J.mouth.scale.set(1, mode === 'eat' || mode === 'happy' ? 1.6 : 1, 1);
}
// everyday motions (idle, walk, wave, hop, happy, sleep, eat) in the same joint format
export function modePose(mode, t) {
  const s = Math.sin; const P = { aL: [24, 6, 14], aR: [24, 6, 14] };
  if (mode === 'walk') { const p = t * 0.3; Object.assign(P, { hy: -0.03 - Math.abs(s(p)) * 0.03, hry: s(p) * 0.12, cy: -s(p) * 0.18, hrz: s(p) * 0.04, lL: [s(p) * 28, 0, Math.max(0, -s(p)) * 30], lR: [-s(p) * 28, 0, Math.max(0, s(p)) * 30], aL: [12, -s(p) * 30, 25], aR: [12, s(p) * 30, 25], nz: -s(p) * 0.05 }); }
  else if (mode === 'wave') Object.assign(P, { hrz: 0.04, hx: 0.02, cz: -0.05, aR: [150 + s(t * 0.35) * 18, 10, 30 + s(t * 0.35) * 25], nz: 0.12 });
  else if (mode === 'hop') { const a = Math.abs(s(t * 0.18)); Object.assign(P, { hy: a * 0.5 - 0.1 * (1 - a), aL: [30 + a * 120, 10, 20], aR: [30 + a * 120, 10, 20], lL: [a * 25, 0, a * 40], lR: [a * 25, 0, a * 40] }); }
  else if (mode === 'happy' || mode === 'react') { const a = s(t * 0.4); Object.assign(P, { hy: Math.abs(s(t * 0.2)) * 0.25, hrz: a * 0.08, aL: [140 + a * 20, 5, 15], aR: [140 - a * 20, 5, 15], nz: a * 0.15 }); }
  else if (mode === 'sleep') Object.assign(P, { hy: -0.18, cx: 0.25, nx: 0.35, aL: [20, 40, 100], aR: [20, 40, 100] });
  else if (mode === 'eat') Object.assign(P, { aR: [20, 60, 120 + s(t * 0.5) * 10], nx: 0.1 });
  else if (mode === 'shake') Object.assign(P, { hrz: s(t * 1.3) * 0.12, nz: s(t * 1.3) * 0.3 });
  else Object.assign(P, { hy: s(t * 0.05) * 0.01, hrz: s(t * 0.03) * 0.02, aL: [23 + s(t * 0.05) * 3, 6, 16], aR: [23 - s(t * 0.05) * 3, 6, 16] });
  return P;
}
const sane = (P) => Object.values(P).every((v) => (Array.isArray(v) ? v.every(Number.isFinite) : typeof v !== 'number' || Number.isFinite(v)));
function blend(a, b, k) { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[key], y = b[key]; if (Array.isArray(x) || Array.isArray(y)) { const X = x || [14, 0, 10, 0], Y = y || [14, 0, 10, 0]; o[key] = X.map((v, i) => v + ((Y[i] ?? v) - v) * k); } else o[key] = (x || 0) + ((y || 0) - (x || 0)) * k; } return o; }
// ---------------------------------------------------------------- draw into a 2D canvas (same args as drawPal)
let frameN = -1, frameCount = 0; const BUDGET = 8;
let lastF = 0, slow = 0;
// FPS watch: ignores the first 6 s, the 3 s after any tab switch / backgrounding / rotation, and pauses (gaps > 100 ms).
// Needs ~8 s of sustained slow frames, then steps down one level (ultra -> high -> low). Never switches to 2D.
let firstF = 0, quietUntil = 0;
if (typeof document !== 'undefined') { const q = () => { quietUntil = performance.now() + 3000; slow = 0; lastF = 0; }; document.addEventListener('visibilitychange', q); addEventListener('pageshow', q); addEventListener('resize', q); addEventListener('orientationchange', q); }
function watchFps(now) {
  if (!firstF) firstF = now;
  if (document.hidden || now - firstF < 6000 || now < quietUntil) { lastF = now; return; }
  if (lastF) { const dt = now - lastF; if (dt > 100) { /* pause, not slowness */ } else if (dt > 40) slow++; else if (dt < 25) slow = Math.max(0, slow - 3);
    if (slow > 240) { slow = 0; quietUntil = now + 4000; const g = gfxLevel(); if (g === 'ultra') setGfx('high', 1); else if (g === 'high') setGfx('low', 1); } }
  lastF = now;
}
export function drawPal3D(c, x, y, size, pal, st = {}) {
  const now = performance.now(), f = Math.floor(now / 16); if (f !== frameN) { frameN = f; frameCount = 0; watchFps(now); }
  if (++frameCount > BUDGET) return false; // too many Pals this frame: caller draws 2D
  if (!R) init();
  if (lost) { // context lost (iOS backgrounding / memory): placeholder until restored, or rebuild after 2.5 s
    if (now - lostAt > 2500 && !document.hidden) { if (rebuilds >= 6) return false; rebuild(); } else { drawLoading(c, x, y, size); return true; }
  }
  const key = JSON.stringify([pal.species, pal.colors, pal.outfit, pal.variant || '', pal.pattern || '', stageOf(pal.level || 1)]);
  let m = cache.get(key); if (!m) { m = build(pal); cache.set(key, m); if (cache.size > 24) { const k0 = cache.keys().next().value; cache.delete(k0); } }
  const t = st.t || 0;
  let P = modePose(st.mode || 'idle', t);
  if (st.dance3d) { const D3 = clipFor(st.dance3d, m.userData.sp); P = blend(P, D3(st.beat || 0, t), st.amt ?? 1); }
  if (!sane(P)) P = modePose('idle', t); // never leave a broken / T-pose on screen
  // overlap & follow-through: every joint eases toward its target (limbs a bit slower than the hips), so moves and
  // dance changes flow into each other instead of snapping
  const pv = m.userData.prev; if (pv && Math.abs(t - (m.userData.pt || 0)) < 30) { const o = {}; for (const k in P) { const a = pv[k], b = P[k]; o[k] = Array.isArray(b) ? b.map((v, i) => (a && Number.isFinite(a[i]) ? a[i] + (v - a[i]) * 0.28 : v)) : typeof b === 'number' && typeof a === 'number' && k !== 'ry' ? a + (b - a) * 0.42 : b; } P = o; }
  m.userData.prev = P; m.userData.pt = t;
  apply(m, P, t, st.mode); grip(m, st.dance3d ? st.amt ?? 1 : 0, st.mode, t);
  m.rotation.y = st.yaw != null ? st.yaw : ((st.face || 1) < 0 ? -0.28 : 0.28) + (P.ry || 0);
  scene.add(m); try { R.render(scene, cam); } finally { scene.remove(m); }
  if (R.getContext().isContextLost?.()) { if (!lost) { lost = true; lostAt = now; } drawLoading(c, x, y, size); return true; }
  const w = size * 1.65; c.drawImage(R.domElement, x - w / 2, y - w * 0.87, w, w);
  return true;
}
export { DANCES3D };
export const THREE_VERSION = THREE.REVISION;

// Wardrobe pieces: each is parented to a rig bone, so it moves with every dance and walk.
function wear3D(of, { J, H, headR, fz, legs, kind, B, sp, ex }) {
  const W = (s) => WEAR_BY[of[s]]; const M = (col, o = {}) => { const m = mat(col, { cc: 0.3, ...o }); m.userData.wear = 1; return m; };
  const metal = (col) => { const m = mat(col, { cc: 1, sheen: 0 }); m.metalness = 0.8; m.roughness = 0.25; m.userData.wear = 1; return m; };
  const hd = headR && H;
  // head
  let w = W('head'); if (w && (hd || kind === 'jelly')) dressHead({ H, hr: headR || 0.5, dy: headR ? 0 : 0.14, ea: sp.ears, ex, J, col: w.col, st: w.st });
  // hair
  w = W('hair'); if (w && hd) { const st = w.st, c = w.col;
    if (st === 'bow' || st === 'bow2') { const k = st === 'bow2' ? 1.6 : 1; for (const s of [-1, 1]) { const b = mesh(cone(0.08 * k, 0.15 * k), M(c), H); b.position.set(0.2 + s * 0.08 * k, headR * 0.98, 0.1); b.rotation.z = s * Math.PI / 2; } mesh(sph(0.035 * k), M(c), H).position.set(0.2, headR * 0.98, 0.1); }
    else if (st === 'clips') for (const s of [-1, 1]) { const k = mesh(sph(1), M(c, { em: c }), H); k.scale.set(0.05, 0.05, 0.02); k.position.set(s * 0.28, headR * 0.7, headR * 0.6); }
    else if (st === 'pigtails') for (const s of [-1, 1]) { const p = mesh(cap(0.08, 0.2), M(c), H); p.position.set(s * headR * 1.05, headR * 0.2, -0.05); p.rotation.z = s * 0.5; }
    else if (st === 'bun') mesh(sph(0.13), M(c), H).position.set(0, headR * 1.05, -0.05);
    else if (st === 'quiff') { const q = mesh(sph(1), M(c), H); q.scale.set(0.2, 0.1, 0.18); q.position.set(0, headR * 0.98, headR * 0.35); q.rotation.x = -0.4; } }
  // face
  w = W('face'); if (w && hd) { const st = w.st, c = w.col; const m = st === 'round' ? metal(c) : M(c, { cc: 1 });
    for (const s of [-1, 1]) { let g; if (st === 'round') { g = mesh(geo('rim2', () => new THREE.TorusGeometry(0.1, 0.016, 10, 24)), m, H); } else if (st === 'heart' || st === 'star') { const sh = new THREE.Shape(); if (st === 'heart') { sh.moveTo(0, -0.08); sh.bezierCurveTo(0.14, 0.02, 0.06, 0.12, 0, 0.05); sh.bezierCurveTo(-0.06, 0.12, -0.14, 0.02, 0, -0.08); } else for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.045 : 0.11; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } g = mesh(geo('sh' + st, () => new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false })), m, H); } else { g = mesh(geo('lens2', () => new THREE.CylinderGeometry(0.1, 0.1, 0.025, 24)), M('#1a1428', { cc: 1 }), H); g.rotation.x = Math.PI / 2; const r = mesh(geo('rim3', () => new THREE.TorusGeometry(0.1, 0.014, 8, 24)), M(c), H); r.position.set(s * 0.19, 0.06, fz + 0.05); }
      g.position.set(s * 0.19, 0.06, fz + 0.05); }
    const br = mesh(cap(0.012, 0.08), m, H); br.rotation.z = Math.PI / 2; br.position.set(0, 0.07, fz + 0.06); }
  // earrings (hang under the head sides)
  w = W('ears'); if (w && hd) for (const s of [-1, 1]) { const m = metal(w.col); const y = -headR * 0.15, x = s * headR * 1.0;
    if (w.st === 'hoop') { const h = mesh(geo('hoop', () => new THREE.TorusGeometry(0.05, 0.01, 8, 20)), m, H); h.position.set(x, y - 0.05, 0); h.rotation.y = Math.PI / 2; }
    else if (w.st === 'drop') { mesh(sph(0.015), m, H).position.set(x, y, 0); const d = mesh(geo('drp', () => { const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.018 : 0.045; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }); }), m, H); d.position.set(x, y - 0.07, 0); d.rotation.y = Math.PI / 2; }
    else mesh(sph(0.025), m, H).position.set(x, y, 0.02); }
  // neck
  w = W('neck'); if (w) { const st = w.st, c = w.col, N = J.Neck;
    if (st === 'beads' || st === 'chain') { const n = st === 'chain' ? 14 : 18; for (let i = 0; i < n; i++) { const a = -Math.PI * 0.9 + i * (Math.PI * 1.8) / (n - 1); const b = st === 'chain' ? mesh(geo('lnk', () => new THREE.TorusGeometry(0.03, 0.011, 8, 14)), metal(c), N) : mesh(sph(0.026), M(i % 2 ? '#ffffff' : c, { cc: 1 }), N); b.position.set(Math.sin(a) * 0.3, -0.06 - Math.cos(a) * 0.03 - (1 - Math.abs(a) / 3) * 0.06, Math.cos(a) * 0.29); b.rotation.y = a + (i % 2) * 1.57; } }
    else if (st === 'locket' || st === 'medal') { const r = mesh(geo('cord', () => new THREE.TorusGeometry(0.28, 0.01, 6, 30)), st === 'medal' ? M('#e8434f') : metal(c), N); r.rotation.x = Math.PI / 2 + 0.25; r.position.y = -0.06; const p = mesh(st === 'medal' ? geo('mdl', () => new THREE.CylinderGeometry(0.06, 0.06, 0.015, 24)) : sph(0.05), metal(c), N); p.position.set(0, -0.2, 0.3); if (st === 'medal') p.rotation.x = Math.PI / 2; else p.scale.z = 0.4; }
    else if (st === 'scarf') { const n = mesh(geo('scarf2', () => new THREE.TorusGeometry(0.27, 0.07, 10, 24)), M(c), N); n.rotation.x = Math.PI / 2; n.position.y = -0.04; const t = mesh(cap(0.06, 0.18), M(c), N); t.position.set(0.12, -0.2, 0.28); t.rotation.z = 0.2; }
    else if (st === 'tie') { const t = mesh(cone(0.06, 0.3), M(c), N); t.rotation.x = Math.PI; t.position.set(0, -0.22, 0.34); t.scale.z = 0.3; mesh(sph(0.04), M(c), N).position.set(0, -0.06, 0.32); }
    else if (st === 'bowtie') for (const s of [-1, 1]) { const b = mesh(cone(0.06, 0.12), M(c), N); b.position.set(s * 0.055, -0.07, 0.31); b.rotation.z = s * Math.PI / 2; } }
  // tops / bottoms / full outfits (shells slightly larger than the torso, sleeves on the arm bones)
  dressBody({ J, W, fit: J.fit }); if ((W('body') || W('full')) && J.TB) J.TB.traverse((o) => { if (o.userData.deco) o.visible = false; });
  // feet
  w = W('feet'); if (w && legs) for (const n of ['Left', 'Right']) { const f = J[n + 'Foot'], c = w.col; const st = w.st;
    const s = mesh(sph(1), st === 'sneakers' && /cf3a/.test(c) ? metal(c) : M(c, { cc: 0.6 }), f); s.scale.set(0.14, st === 'flats' || st === 'sandals' ? 0.05 : 0.09, 0.185); s.position.set(0, -0.02, 0.05);
    if (st === 'sneakers') { const sole = mesh(sph(1), M('#ffffff'), f); sole.scale.set(0.145, 0.03, 0.19); sole.position.set(0, -0.07, 0.05); }
    if (st === 'boots') { const b = mesh(cap(0.12, 0.1), M(c), J[n + 'LowerLeg']); b.position.y = -0.2; }
    if (st === 'flats') mesh(sph(0.025), M('#ffffff'), f).position.set(0, 0.02, 0.18); }
  // back
  w = W('back'); if (w) { const st = w.st, c = w.col;
    if (st === 'cape') { const cp = mesh(geo('cape5', () => { const g = new THREE.PlaneGeometry(0.72, 0.82, 10, 12); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = 0.41 - y; p.setZ(i, -Math.abs(x) * 0.28 + Math.sin(x * 16) * 0.018 * d); p.setX(i, x * (0.7 + d * 0.5)); } g.computeVertexNormals(); return g; }), M(c, { r: 0.7 }), J.Chest); cp.material.side = THREE.DoubleSide; cp.position.set(0, -0.3, -0.44); cp.rotation.x = 0.16; const cl = mesh(geo('capecl', () => new THREE.TorusGeometry(0.25, 0.022, 8, 28, Math.PI)), M(shade(c, -0.15)), J.Chest); cl.rotation.set(Math.PI / 2 + 0.2, 0, Math.PI); cl.position.set(0, 0.12, -0.05); }
    else if (st === 'wings' || st === 'angel') for (const s of [-1, 1]) { const m = mesh(sph(1), M(c, { op: st === 'wings' ? 0.6 : 1, em: st === 'wings' ? c : undefined }), J.Chest); m.scale.set(0.3, st === 'angel' ? 0.2 : 0.26, 0.03); m.position.set(s * 0.32, 0.12, -0.42); m.rotation.z = s * 0.4; }
    else if (st === 'jetpack') for (const s of [-1, 1]) { const t = mesh(cap(0.08, 0.22), metal(c), J.Chest); t.position.set(s * 0.12, -0.05, -0.46); const fl = mesh(cone(0.06, 0.14), M('#ffb04a', { em: '#ff7a1a' }), t); fl.position.y = -0.24; fl.rotation.x = Math.PI; } }
  // bag
  w = W('bag'); if (w) { const st = w.st, c = w.col;
    if (st === 'backpack') { const b = mesh(cap(0.2, 0.12), M(c), J.Chest); b.position.set(0, -0.08, -0.46); b.scale.z = 0.55; for (const s of [-1, 1]) { const st2 = mesh(geo('strp', () => new THREE.TorusGeometry(0.2, 0.018, 6, 20, Math.PI)), M(c), J.Chest); st2.rotation.y = Math.PI / 2; st2.position.set(s * 0.22, 0.02, -0.05); } }
    else { const b = mesh(geo('bagb' + st, () => new THREE.BoxGeometry(st === 'purse' ? 0.16 : 0.22, st === 'purse' ? 0.12 : 0.16, 0.06)), M(c, { cc: 0.8 }), J.Hips); b.position.set(0.5, 0.05, 0.12); const s2 = mesh(geo('bagstrap', () => new THREE.TorusGeometry(0.55, 0.012, 6, 30)), M(c), J.Chest); s2.rotation.set(0, Math.PI / 2, 0.75); s2.position.y = -0.1; } }
  // held item (right hand)
  w = W('held'); const hand = J.RightHand; if (w && hand) { const st = w.st, c = w.col, g = new THREE.Group(); g.position.set(0, -0.1, 0.06); g.scale.setScalar(st === 'guitar2' || st === 'balloon' || st === 'handbag' || st === 'umbrella' ? 1.35 : 1.7); if (!['handbag', 'balloon', 'guitar2', 'bball', 'ball'].includes(st)) { g.rotation.x = -1.1; g.position.set(0, -0.12, 0.08); } hand.add(g); J.grip = st; if (st === 'guitar2') J.twoHand = 1;
    // fingers curl around the grip
    hand.children.forEach((o) => { if (o.isMesh && o.geometry && o.geometry.type === 'CapsuleGeometry') { o.rotation.x = -1.1; o.position.z += 0.03; } });
    if (st === 'handbag') { const b = mesh(geo('hbag', () => new THREE.BoxGeometry(0.2, 0.15, 0.08)), M(c, { cc: 0.8 }), g); b.position.y = -0.14; const h = mesh(geo('hbh', () => new THREE.TorusGeometry(0.06, 0.012, 8, 18, Math.PI)), M(c), g); h.position.y = -0.06; }
    else if (st === 'phone') { const ph = mesh(geo('phn', () => new THREE.BoxGeometry(0.08, 0.15, 0.015)), M(c, { cc: 1 }), g); ph.position.set(0, 0.05, 0.02); const sc = mesh(geo('phs', () => new THREE.PlaneGeometry(0.065, 0.12)), M('#9ad8ff', { em: '#4a8aff' }), g); sc.position.set(0, 0.05, 0.029); }
    else if (st === 'bouquet') { const k = mesh(cone(0.06, 0.2), M('#7ad070'), g); k.rotation.x = Math.PI; k.position.y = 0.04; for (let i = 0; i < 6; i++) { const a = i * 1.05; mesh(sph(0.04), M(i % 2 ? c : '#ffffff'), g).position.set(Math.cos(a) * 0.06, 0.17, Math.sin(a) * 0.06); } mesh(sph(0.04), M('#ffd34d'), g).position.y = 0.19; }
    else if (st === 'boba') { const cu = mesh(geo('boba', () => new THREE.CylinderGeometry(0.06, 0.045, 0.16, 20)), M(c, { op: 0.85, cc: 1 }), g); cu.position.y = 0.05; for (let i = 0; i < 5; i++) mesh(sph(0.012), M('#3a2a2a'), g).position.set(-0.03 + i * 0.015, -0.01, 0.03); const lid = mesh(sph(1), M('#ffffff', { op: 0.7 }), g); lid.scale.set(0.062, 0.025, 0.062); lid.position.y = 0.13; const st2 = mesh(cap(0.008, 0.12), M('#ff6fae'), g); st2.position.set(0.02, 0.2, 0); }
    else if (st === 'bball') { const b = mesh(sph(0.12), M(c, { r: 0.8 }), g); b.position.y = 0.04; for (const r of [0, Math.PI / 2]) { const l = mesh(geo('bbl', () => new THREE.TorusGeometry(0.121, 0.005, 6, 32)), M('#2a1a1a'), g); l.position.y = 0.04; l.rotation.y = r; } }
    else if (st === 'guitar2') { g.rotation.set(0.2, 0, -0.95); g.position.set(0.12, 0.02, 0.16); const b = mesh(sph(1), M(c, { cc: 1 }), g); b.scale.set(0.16, 0.2, 0.05); const n = mesh(geo('gneck', () => new THREE.BoxGeometry(0.04, 0.42, 0.025)), M('#5a3a2a'), g); n.position.y = 0.36; mesh(geo('ghd', () => new THREE.BoxGeometry(0.07, 0.08, 0.03)), M('#2a2438'), g).position.y = 0.6; for (let i = 0; i < 4; i++) { const s2 = mesh(cap(0.002, 0.5), M('#e0e0e0'), g); s2.position.set(-0.012 + i * 0.008, 0.3, 0.03); } }
    else if (['berry', 'cookie', 'cake', 'apple', 'carrot', 'fish', 'bamboo', 'honey', 'leaf', 'seed'].includes(st)) {
      if (st === 'cookie') { const k = mesh(geo('cook', () => new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20)), M(c), g); k.rotation.x = Math.PI / 2; }
      else if (st === 'cake') { mesh(geo('cakeb', () => new THREE.CylinderGeometry(0.07, 0.07, 0.07, 20)), M('#fff0f8'), g); mesh(sph(0.02), M('#e8434f'), g).position.y = 0.05; }
      else if (st === 'carrot' || st === 'bamboo') { const k = mesh(st === 'carrot' ? cone(0.03, 0.16) : cap(0.025, 0.2), M(c), g); k.rotation.z = 1.2; }
      else if (st === 'fish') { const f = mesh(sph(1), M(c, { cc: 1 }), g); f.scale.set(0.1, 0.045, 0.03); const tl = mesh(cone(0.04, 0.06), M(c), g); tl.position.x = -0.11; tl.rotation.z = Math.PI / 2; }
      else if (st === 'honey') { mesh(geo('hjar', () => new THREE.CylinderGeometry(0.05, 0.05, 0.09, 18)), M(c, { op: 0.9, cc: 1 }), g); }
      else if (st === 'leaf') { const l = mesh(sph(1), M(c), g); l.scale.set(0.08, 0.04, 0.012); }
      else mesh(sph(st === 'seed' ? 0.03 : st === 'apple' ? 0.07 : 0.05), M(c, { cc: 0.8 }), g); }
    if (st === 'wand') { const s = mesh(cap(0.012, 0.3), M('#ffffff'), g); s.position.y = 0.16; const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.035 : 0.08; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } const st2 = mesh(geo('wstar', () => new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false })), M(c, { em: c }), g); st2.position.y = 0.34; }
    else if (st === 'balloon') { const k = new THREE.Group(); k.rotation.set(-0.35, 0, 0.75); g.add(k); const s = mesh(cap(0.004, 0.62), M('#ffffff'), k); s.position.y = 0.32; const b = mesh(sph(1), M(c, { cc: 1 }), k); b.scale.set(0.15, 0.18, 0.15); b.position.y = 0.78; mesh(cone(0.025, 0.04), M(c), k).position.y = 0.6; J.balloon = k; }
    else if (st === 'icecream') { const k = mesh(cone(0.05, 0.14), M('#e0a060'), g); k.rotation.x = Math.PI; k.position.y = 0.03; mesh(sph(0.06), M(c), g).position.y = 0.13; }
    else if (st === 'teddy') { mesh(sph(0.08), M(c), g).position.y = 0.0; mesh(sph(0.06), M(c), g).position.y = 0.11; for (const s of [-1, 1]) mesh(sph(0.025), M(c), g).position.set(s * 0.045, 0.16, 0); }
    else if (st === 'guitar') { const b = mesh(sph(1), M(c, { cc: 1 }), g); b.scale.set(0.11, 0.13, 0.04); const n = mesh(cap(0.015, 0.2), M('#8a5a3a'), g); n.position.y = 0.2; g.rotation.z = 0.8; }
    else if (st === 'ball') mesh(sph(0.09), M(c, { cc: 0.7 }), g).position.y = 0.02;
    else if (st === 'mic') { mesh(cap(0.018, 0.12), M('#2a2438'), g).position.y = 0.04; mesh(sph(0.04), metal(c), g).position.y = 0.14; }
    else if (st === 'umbrella') { const s = mesh(cap(0.01, 0.5), M('#5a4a3a'), g); s.position.y = 0.25; const d = mesh(geo('umb', () => new THREE.SphereGeometry(0.3, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M(c), g); d.material.side = THREE.DoubleSide; d.position.y = 0.5; } }
  // wrist + ring (left arm so they show with a held item)
  w = W('wrist'); if (w) for (const n of ['LeftLowerArm']) { const lo = J[n]; if (!lo) continue; const st = w.st, c = w.col;
    if (st === 'beadband') for (let i = 0; i < 10; i++) { const a = i * 0.628; mesh(sph(0.018), M(i % 2 ? '#ffffff' : c, { cc: 1 }), lo).position.set(Math.sin(a) * 0.085, -0.22, Math.cos(a) * 0.085); }
    else { const b = mesh(geo('brc', () => new THREE.TorusGeometry(0.085, 0.016, 8, 24)), st === 'watch' ? M('#2a2438') : metal(c), lo); b.rotation.x = Math.PI / 2; b.position.y = -0.22; if (st === 'watch') { const f = mesh(geo('wf', () => new THREE.CylinderGeometry(0.04, 0.04, 0.02, 20)), M(c, { em: c === '#8a55dc' ? c : undefined, cc: 1 }), lo); f.position.set(0, -0.22, 0.09); f.rotation.x = Math.PI / 2; } } }
  w = W('hand'); if (w && J.LeftHand) { const r = mesh(geo('ring', () => new THREE.TorusGeometry(0.03, 0.009, 8, 18)), metal(w.st === 'gem' ? '#ffcf3a' : w.col), J.LeftHand); r.position.set(0, -0.1, 0.03); if (w.st === 'gem') mesh(sph(0.022), M(w.col, { cc: 1, em: w.col }), J.LeftHand).position.set(0, -0.07, 0.04); }
}
const C_RED = '#e8434f';
// Store thumbnails: the REAL 3D item rendered on the user's own Pal (only that item worn), framed on the slot.
const FOCUS = { head: [0, -0.06, 1, 0.6], hair: [0, -0.06, 1, 0.6], face: [0.15, 0.1, 0.7, 0.45], ears: [0.1, 0.1, 0.8, 0.5], neck: [0.15, 0.25, 0.7, 0.45], feet: [0.15, 0.72, 0.7, 0.3], hand: [0.6, 0.45, 0.5, 0.32], wrist: [0.6, 0.42, 0.5, 0.32] };
export function renderItemThumb(pal, slot, id, px = 96, opt = {}) {
  if (!R) init(); if (lost || !R) return null;
  const p2 = { ...pal, outfit: id ? { [slot]: id } : {}, variant: opt.variant != null ? opt.variant : '', pattern: opt.pattern || 'none' };
  const m = build(p2); apply(m, modePose('idle', 30), 30, 'idle');
  m.rotation.y = slot === 'back' || slot === 'bag' ? 2.6 : 0.35; scene.add(m); R.render(scene, cam); scene.remove(m);
  m.traverse((o) => { if (o.isMesh && o.material && !o.material.userData.shared) o.material.dispose(); });
  const cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d'); const S0 = R.domElement.width;
  // the Pal fills the lower ~87% of the render; focus boxes are fractions of that area
  const [fx, fy, fw, fh] = FOCUS[slot] || [-0.05, -0.04, 1.1, 1.08]; const bx = S0 * 0.31, bw = S0 * 0.38, by = S0 * 0.06, bh = S0 * 0.8; // Pal's box in the render
  const sw = Math.max(fw * bw, fh * bh), sx = bx + fx * bw + (fw * bw - sw) / 2, sy = by + fy * bh + (fh * bh - sw) / 2;
  c.drawImage(R.domElement, sx, sy, sw, sw, 0, 0, px, px); return cv;
}

// Hand items: elbow bent so the item is held up in front; two-handed guitar brings the other paw to the neck;
// eating lifts the food to the mouth. Dances keep their arm motion (blend shrinks with dance amount).
function grip(m, amt, mode, t) {
  const J = m.userData.J; if (!J.grip) return; const k = 1 - Math.min(1, amt) * 0.6;
  // rig axes: upper arm -x = raise forward, lower arm +x = bend elbow forward
  if (J.RightLowerArm) J.RightLowerArm.rotation.x += 0.9 * k;
  if (J.RightUpperArm) J.RightUpperArm.rotation.x += -0.3 * k;
  if (mode === 'eat' && J.RightUpperArm) { const bite = 0.5 + 0.5 * Math.sin(t * 0.25); J.RightUpperArm.rotation.x += -0.9 - 0.4 * bite; J.RightUpperArm.rotation.z += -0.35; J.RightLowerArm.rotation.x += 0.8 + 0.5 * bite; if (J.LeftLowerArm) { J.LeftUpperArm.rotation.x += -0.6; J.LeftLowerArm.rotation.x += 1.0; } }
  if (J.twoHand && J.LeftUpperArm) { const k2 = 1 - Math.min(1, amt) * 0.7; J.LeftUpperArm.rotation.x += -0.9 * k2; J.LeftUpperArm.rotation.z += 0.55 * k2; J.LeftLowerArm.rotation.x += 1.1 * k2;
    J.RightLowerArm.rotation.x += Math.sin(t * 0.5) * 0.15 * k2; }
}
