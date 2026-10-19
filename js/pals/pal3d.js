// 3D Pals (three.js, self-hosted & pinned r170). Procedural, stylised-PBR characters on a shared humanoid rig:
// Hips > Spine > Chest > Neck > Head, Chest > L/R Shoulder > UpperArm > LowerArm > Hand (3 fingers),
// Hips > L/R UpperLeg > LowerLeg > Foot (toe pads), Hips > Tail1..3. Bone names follow the humanoid convention
// so human mocap clips can be retargeted (see js/pals/mocap3d.js). Rendered into one shared offscreen WebGL
// canvas and blitted into the existing 2D canvases, so every screen keeps its drawPal()-style API.
// Everything is built from code: no external model files, no licensing beyond three.js (MIT).
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { SPEC, SPECIES, stageOf } from './art.js';
import { ITEM } from './catalog.js';
import { DANCES3D, clipFor } from './dances3d.js';

const D = Math.PI / 180;
let R = null, scene, cam, keyL, shadowPlane; const RES = 256;
const cache = new Map(); let lost = false;
export function webglOK() {
  try { if (localStorage.getItem('kemy-pal3d') === '0') return false; } catch { /* */ }
  const n = navigator; if (n.connection && n.connection.saveData) return false;
  if (n.deviceMemory && n.deviceMemory < 2) return false;
  try { const cv = document.createElement('canvas'); return !!(cv.getContext('webgl2') || cv.getContext('webgl')); } catch { return false; }
}
function init() {
  const cv = document.createElement('canvas'); cv.width = cv.height = RES;
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; }); cv.addEventListener('webglcontextrestored', () => { lost = false; });
  R.setPixelRatio(1); R.setSize(RES, RES, false); R.setClearColor(0, 0);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.9; R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50); cam.position.set(0, 1.55, 7.2); cam.lookAt(0, 1.15, 0);
  scene.add(new THREE.HemisphereLight(0xfff4ff, 0x6a4fa0, 1.05));
  keyL = new THREE.DirectionalLight(0xfff1dc, 2.2); keyL.position.set(2.5, 5, 4); keyL.castShadow = true;
  keyL.shadow.mapSize.set(512, 512); keyL.shadow.radius = 6; Object.assign(keyL.shadow.camera, { left: -2.2, right: 2.2, top: 3.4, bottom: -1, near: 0.5, far: 14 }); keyL.shadow.bias = -0.002;
  scene.add(keyL);
  const rim = new THREE.DirectionalLight(0xc9a8ff, 1.3); rim.position.set(-3, 2.5, -3); scene.add(rim);
  shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.28 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
}
// ---------------------------------------------------------------- materials ("fur" = soft sheen PBR, "skin" = smooth clearcoat)
function mat(hex, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: o.r ?? 0.62, sheen: o.sheen ?? 0.6, sheenRoughness: 0.55,
    sheenColor: new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.25), clearcoat: o.cc ?? 0, clearcoatRoughness: 0.35,
    transparent: !!o.op, opacity: o.op ?? 1, emissive: new THREE.Color(o.em || '#000000'), emissiveIntensity: o.em ? 0.35 : 0 });
}
const G = {}; // shared geometries (memory-light)
const geo = (k, f) => G[k] || (G[k] = f());
function mesh(g, m, p) { const o = new THREE.Mesh(g, m); o.castShadow = true; if (p) p.add(o); return o; }
const sph = (r = 1) => geo('s' + r, () => new THREE.SphereGeometry(r, 24, 18));
const cap = (r, l) => geo(`c${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const cone = (r, h) => geo(`k${r}_${h}`, () => new THREE.ConeGeometry(r, h, 16));
function bone(name, parent, x, y, z) { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); parent.add(b); return b; }
function shade(hex, k) { const c = new THREE.Color(hex); return k < 0 ? c.multiplyScalar(1 + k) : c.lerp(new THREE.Color('#fff'), k); }

// ---------------------------------------------------------------- build one Pal
function build(pal) {
  const sp = SPEC[pal.species] || SPECIES[0]; const col = pal.colors || {};
  const B = col.body || sp.body, A = col.accent || sp.acc, E = col.eye || '#24133f';
  const ex = new Set(sp.extras || []); const kind = sp.body2 || 'blob'; const stage = stageOf(pal.level || 1);
  const skin = ['frog', 'kemy', 'turtle', 'dragon', 'penguin', 'seal', 'jelly', 'starsprite'].includes(sp.id);
  const mB = mat(B, skin ? { sheen: 0.2, cc: 0.6, r: 0.45 } : {}), mA = mat(A), mDark = mat(shade(B, -0.25)), mLight = mat(shade(B, 0.5));
  const mEye = new THREE.MeshPhysicalMaterial({ color: E, roughness: 0.15, clearcoat: 1 }), mWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mPink = mat('#ff9ec4', { op: 0.75, sheen: 0 }), mNose = mat('#3a2440', { sheen: 0, cc: 1, r: 0.3 });
  const root = new THREE.Group(); const S = [0.86, 1, 1.1][stage];
  const J = {}; // joints
  J.Hips = bone("Hips", root, 0, 0.64, 0);
  J.Spine = bone('Spine', J.Hips, 0, 0.12, 0); J.Chest = bone('Chest', J.Spine, 0, 0.32, 0);
  J.Neck = bone('Neck', J.Chest, 0, 0.3, 0); J.Head = bone('Head', J.Neck, 0, 0.1, 0);
  // torso: pear-shaped belly + chest (soft, chubby kid proportions)
  if (kind === 'blob') {
    const belly = mesh(sph(1), mB, J.Spine); belly.scale.set(0.42, 0.42, 0.37); belly.position.y = 0.04;
    const chest = mesh(sph(1), mB, J.Chest); chest.scale.set(0.36, 0.3, 0.31); chest.position.y = 0.02;
    if (ex.has('belly') || sp.id === 'penguin' || sp.id === 'owl') { const b = mesh(sph(1), mat(sp.id === 'penguin' ? '#fbf6ff' : shade(B, 0.6)), J.Spine); b.scale.set(0.3, 0.34, 0.12); b.position.set(0, 0.05, 0.28); }
    if (ex.has('shell')) { const sh = mesh(sph(1), mat(A, { cc: 0.8, sheen: 0 }), J.Spine); sh.scale.set(0.5, 0.52, 0.34); sh.position.set(0, 0.12, -0.18); }
    if (ex.has('spikes')) for (let i = 0; i < 9; i++) { const s = mesh(cone(0.07, 0.3), mA, J.Chest); const a = -1.2 + i * 0.3; s.position.set(Math.sin(a) * 0.3, 0.05 + Math.cos(a) * 0.1, -0.24); s.rotation.set(-1.2, 0, -a * 0.6); }
    if (ex.has('stripes') || ex.has('giraffespots')) for (let i = 0; i < 6; i++) { const s = mesh(sph(1), mA, J.Spine); s.scale.set(ex.has('stripes') ? 0.03 : 0.06, ex.has('stripes') ? 0.12 : 0.05, 0.04); const a = -1 + (i % 3) * 1; s.position.set(Math.sin(a) * 0.4, -0.05 + Math.floor(i / 3) * 0.2, Math.cos(a) * 0.33); }
    if (ex.has('wool')) for (let i = 0; i < 10; i++) { const w = mesh(sph(0.15), mat('#ffffff'), J.Spine); const a = i * 0.63; w.position.set(Math.sin(a) * 0.34, 0.02 + (i % 2) * 0.14, Math.cos(a) * 0.28); }
  } else if (kind === 'jelly') {
    const bell = mesh(sph(1), mat(B, { op: 0.82, cc: 1, sheen: 0, r: 0.2 }), J.Chest); bell.scale.set(0.62, 0.52, 0.58);
    J.tent = []; for (let i = 0; i < 6; i++) { const a = i * 1.05; const t = bone('Tent' + i, J.Spine, Math.sin(a) * 0.3, -0.05, Math.cos(a) * 0.3); const m = mesh(cap(0.05, 0.45), mat(A, { op: 0.85 }), t); m.position.y = -0.25; J.tent.push(t); }
  } else if (kind === 'star') {
    const sh = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.28 : 0.62; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const g = geo('star', () => { const e = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.1, bevelSegments: 3 }); e.center(); return e; });
    mesh(g, mat('#ffe680', { em: '#ffcc33', cc: 0.6 }), J.Chest).position.y = 0.05;
  } else if (kind === 'cloud') {
    for (const [x, y, r] of [[0, 0, 0.4], [-0.35, -0.05, 0.3], [0.35, -0.05, 0.3], [-0.18, 0.25, 0.28], [0.2, 0.25, 0.3]]) mesh(sph(r), mat(B, { sheen: 1 }), J.Chest).position.set(x, y, 0);
  }
  // head: big round head, slightly squashed, kid-friendly
  const headR = (kind === 'blob' ? 0.44 : 0.4) * (sp.id === 'jelly' ? 0 : 1);
  if (headR) { const h = mesh(sph(1), mB, J.Head); h.scale.set(headR * 1.08, headR, headR * 0.98); h.position.y = headR * 0.82; }
  const hy = headR * 0.82 || 0.05, fz = headR * 0.9 || 0.6;
  const H = new THREE.Group(); H.position.y = hy; J.Head.add(H); J.face = H;
  if (ex.has('mane')) for (let i = 0; i < 14; i++) { const a = i * Math.PI * 2 / 14; mesh(sph(0.16), mA, H).position.set(Math.cos(a) * 0.55, Math.sin(a) * 0.5, -0.12); }
  if (ex.has('wool')) for (let i = 0; i < 6; i++) mesh(sph(0.14), mat('#ffffff'), H).position.set(-0.25 + i * 0.1, 0.42 + (i % 2) * 0.04, 0.05);
  // eyes (glossy, with catch-lights) + blush
  const eyes = []; const er = 0.085 * (ex.has('frogeyes') ? 1.3 : 1);
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(s * 0.19, ex.has('frogeyes') ? 0.36 : 0.06, fz * 0.92); H.add(g);
    if (ex.has('frogeyes')) mesh(sph(0.15), mB, g).position.z = -0.06;
    if (new THREE.Color(B).getHSL({}).l < 0.3) { const w = mesh(sph(1), mat('#ffffff', { sheen: 0 }), g); w.scale.set(er * 1.5, er * 1.6, er * 0.5); w.position.z = -0.02; }
    const e = mesh(sph(1), mEye, g); e.scale.set(er, er * 1.15, er * 0.6);
    const hl = mesh(sph(0.026), mWhite, g); hl.position.set(-0.03, 0.04, er * 0.55); eyes.push(g);
    if (sp.id === 'panda' || ex.has('eyepatch')) { const p = mesh(sph(1), mat(A), H); p.scale.set(0.13, 0.15, 0.05); p.position.set(s * 0.19, 0.04, fz * 0.88); p.rotation.z = s * 0.4; }
    const bl = mesh(sph(1), mPink, H); bl.scale.set(0.08, 0.05, 0.03); bl.position.set(s * 0.3, -0.08, fz * 0.84);
  }
  J.eyes = eyes;
  // snout
  const sn = sp.snout; const snz = fz;
  if (sn === 'muzzle' || sn === 'nose' || sn === 'whiskers') { const m = mesh(sph(1), mLight, H); m.scale.set(0.16, 0.11, 0.1); m.position.set(0, -0.1, snz * 0.95); const n = mesh(sph(1), mNose, H); n.scale.set(0.05, 0.035, 0.03); n.position.set(0, -0.06, snz * 0.95 + 0.09); }
  if (ex.has('whiskers')) for (const s of [-1, 1]) for (const k of [-1, 1]) { const w = mesh(cap(0.006, 0.18), mNose, H); w.position.set(s * 0.22, -0.1 + k * 0.025, snz * 0.95); w.rotation.z = Math.PI / 2 + k * 0.15 * s; }
  if (sn === 'beak' || sn === 'duckbill') { const b = mesh(cone(0.08, 0.16), mat('#ffa53a', { sheen: 0, cc: 0.6 }), H); b.rotation.x = Math.PI / 2; b.position.set(0, -0.06, snz + 0.05); if (sn === 'duckbill') b.scale.set(1.5, 1, 0.6); }
  if (sn === 'pig') { const p = mesh(geo('pig', () => new THREE.CylinderGeometry(0.1, 0.1, 0.08, 18)), mat(shade(B, -0.12)), H); p.rotation.x = Math.PI / 2; p.position.set(0, -0.1, snz + 0.02); }
  if (sn === 'trunk') { const t1 = bone('Trunk', H, 0, -0.08, snz * 0.95); mesh(cap(0.07, 0.2), mB, t1).position.y = -0.1; const t2 = bone('Trunk2', t1, 0, -0.22, 0); mesh(cap(0.06, 0.14), mB, t2).position.y = -0.08; t1.rotation.x = 0.5; t2.rotation.x = -1; J.trunk = [t1, t2]; }
  // mouth: small smile
  const mo = mesh(geo('smile', () => new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI)), mNose, H); mo.rotation.z = Math.PI; mo.position.set(0, sn === 'trunk' ? -0.2 : -0.16, snz * 0.97 + 0.02); J.mouth = mo;
  // ears
  J.ears = []; const ea = sp.ears;
  for (const s of [-1, 1]) {
    const e = bone(s < 0 ? 'EarR' : 'EarL', H, s * 0.3, 0.32, 0); let m;
    if (ea === 'round' || ea === 'biground') { const r = ea === 'round' ? 0.13 : 0.2; m = mesh(sph(1), mB, e); m.scale.set(r, r, r * 0.4); const i = mesh(sph(1), mat(ex.has('eyepatch') ? A : '#ffc0d8'), e); i.scale.set(r * 0.6, r * 0.6, r * 0.2); i.position.z = 0.03; e.position.set(s * (ea === 'round' ? 0.34 : 0.4), 0.34, -0.02); }
    if (ea === 'pointy') { m = mesh(cone(0.13, 0.3), sp.id === 'fox' || sp.id === 'redpanda' ? mA : mB, e); m.position.y = 0.12; m.scale.z = 0.5; e.rotation.z = -s * 0.25; }
    if (ea === 'long') { m = mesh(cap(0.08, 0.38), mB, e); m.position.y = 0.26; m.scale.z = 0.5; const i = mesh(cap(0.045, 0.3), mat('#ffb3cf'), e); i.position.set(0, 0.26, 0.03); i.scale.z = 0.3; e.position.set(s * 0.14, 0.4, 0); e.rotation.z = -s * 0.12; }
    if (ea === 'floppy') { m = mesh(cap(0.1, 0.22), mA, e); m.position.y = -0.14; m.scale.z = 0.45; e.position.set(s * 0.42, 0.22, 0); e.rotation.z = s * 0.35; }
    if (ea === 'big') { m = mesh(sph(1), mB, e); m.scale.set(0.3, 0.36, 0.06); m.position.x = s * 0.2; const i = mesh(sph(1), mat('#ffb8d4'), e); i.scale.set(0.2, 0.25, 0.03); i.position.set(s * 0.2, 0, 0.03); e.position.set(s * 0.42, 0.05, -0.05); }
    if (ea === 'ossicones') { m = mesh(cap(0.03, 0.16), mDark, e); m.position.y = 0.1; mesh(sph(0.055), mA, e).position.y = 0.22; e.position.set(s * 0.14, 0.42, 0); }
    if (ea === 'gills') for (let i = 0; i < 3; i++) { const g = mesh(cap(0.035, 0.2), mA, e); g.position.set(s * 0.12, 0.05 - i * 0.12, 0); g.rotation.z = -s * (0.9 - i * 0.6); e.position.set(s * 0.4, 0.05, 0); }
    if (ea === 'tuft' && s > 0) { m = mesh(cone(0.05, 0.2), mA, e); m.position.set(-0.3, 0.18, 0.1); }
    J.ears.push(e);
  }
  if (ex.has('horn') || ex.has('horns')) for (const s of ex.has('horn') ? [0] : [-1, 1]) { const h = mesh(cone(0.06, 0.26), mat(ex.has('horn') ? '#ffe88a' : '#fff0d0', { em: ex.has('horn') ? '#ffd34d' : undefined }), H); h.position.set(s * 0.2, 0.5, 0.15); h.rotation.set(0.3, 0, -s * 0.3); }
  if (ex.has('rainbowmane')) ['#ff8ab8', '#ffd34d', '#7fe0a0', '#7fb8ff', '#c49aff'].forEach((c, i) => mesh(sph(0.1), mat(c), H).position.set(-0.05, 0.42 - i * 0.12, -0.32 - i * 0.02));
  // arms: shoulder > upper > lower > hand (+3 fingers); flippers / wings swap the hand shape
  const armType = ex.has('wings') ? 'wing' : ex.has('flippers') ? 'flipper' : 'paw';
  const ua = 0.3, la = 0.27, ar = kind === 'blob' ? 0.075 : 0.06, shY = kind === 'blob' ? 0.1 : 0;
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    const sh = bone(n + 'Shoulder', J.Chest, s * (kind === 'blob' ? 0.36 : 0.45), shY, 0);
    const up = bone(n + 'UpperArm', sh, 0, 0, 0); const lo = bone(n + 'LowerArm', up, 0, -ua, 0); const hd = bone(n + 'Hand', lo, 0, -la, 0);
    if (armType === 'wing') { const w = mesh(sph(1), mat(shade(B, -0.08)), up); w.scale.set(0.07, 0.28, 0.18); w.position.y = -0.2; }
    else if (armType === 'flipper') { const w = mesh(sph(1), mB, up); w.scale.set(0.07, 0.3, 0.13); w.position.y = -0.22; }
    else {
      mesh(cap(ar, ua), mB, up).position.y = -ua / 2; mesh(cap(ar * 0.92, la), mB, lo).position.y = -la / 2;
      const p = mesh(sph(1), skin ? mB : mLight, hd); p.scale.set(0.085, 0.08, 0.07); p.position.y = -0.04;
      for (const f of [-1, 0, 1]) { const fi = mesh(cap(0.022, 0.04), skin ? mB : mLight, hd); fi.position.set(f * 0.04, -0.11, 0.015); fi.rotation.z = f * 0.25; }
    }
    J[n + 'Shoulder'] = sh; J[n + 'UpperArm'] = up; J[n + 'LowerArm'] = lo; J[n + 'Hand'] = hd;
  }
  // legs: hip > upper > lower > foot (+ toe pads)
  const ul = 0.27, ll = 0.27, lr = 0.095; J.legL = ul + ll;
  const legs = kind === 'blob' && sp.feet !== 'none' && !ex.has('float');
  for (const [s, n] of [[1, 'Left'], [-1, 'Right']]) {
    const up = bone(n + 'UpperLeg', J.Hips, s * 0.17, 0, 0); const lo = bone(n + 'LowerLeg', up, 0, -ul, 0); const ft = bone(n + 'Foot', lo, 0, -ll, 0);
    if (legs) {
      mesh(cap(lr, ul), mB, up).position.y = -ul / 2; mesh(cap(lr * 0.9, ll), mB, lo).position.y = -ll / 2;
      if (sp.feet === 'webbed') { const f = mesh(sph(1), mat('#ffa53a', { sheen: 0 }), ft); f.scale.set(0.11, 0.035, 0.16); f.position.set(0, -0.02, 0.06); }
      else if (sp.feet === 'flippers') { const f = mesh(sph(1), mDark, ft); f.scale.set(0.12, 0.04, 0.2); f.position.set(0, -0.02, 0.08); }
      else { const f = mesh(sph(1), mB, ft); f.scale.set(0.11, 0.07, 0.15); f.position.set(0, -0.02, 0.05); for (const q of [-1, 0, 1]) { const tp = mesh(sph(0.025), mat('#ffb3cf', { sheen: 0 }), ft); tp.position.set(q * 0.045, -0.04, 0.18); } }
    }
    J[n + 'UpperLeg'] = up; J[n + 'LowerLeg'] = lo; J[n + 'Foot'] = ft;
  }
  if (!legs) J.Hips.position.y = 0.95;
  // tail chain (3 bones) per species
  J.tail = []; const tl = sp.tail;
  if (tl !== 'none') {
    let p = bone('Tail1', J.Hips, 0, 0.05, -0.3); J.tail.push(p);
    const segs = { wag: [0.05, 0.16], thin: [0.03, 0.18], tuft: [0.03, 0.17], fluffy: [0.11, 0.14], ringed: [0.09, 0.15], axo: [0.07, 0.17], dragon: [0.07, 0.18], flat: [0.08, 0.1] }[tl];
    if (segs) { for (let i = 0; i < 3; i++) { const m = mesh(cap(segs[0] * (1 - i * 0.18), segs[1]), tl === 'ringed' && i === 1 ? mA : tl === 'flat' ? mDark : mB, p); m.position.y = segs[1] / 2 + 0.03; if (tl === 'flat') m.scale.z = 0.4; p = bone('Tail' + (i + 2), p, 0, segs[1] + 0.03, 0); J.tail.push(p); } p.parent.rotation && 0; }
    if (tl === 'tuft' || tl === 'fluffy') mesh(sph(tl === 'tuft' ? 0.07 : 0.1), tl === 'tuft' ? mA : mat('#ffffff'), p);
    if (tl === 'dragon') { const k = mesh(cone(0.09, 0.16), mA, p); k.position.y = 0.04; }
    if (tl === 'puff' || tl === 'stub') mesh(sph(tl === 'puff' ? 0.12 : 0.08), tl === 'puff' ? mat('#ffffff') : mDark, J.tail[0]);
    if (tl === 'curl') mesh(geo('curl', () => new THREE.TorusGeometry(0.07, 0.02, 6, 14, Math.PI * 1.6)), mA, J.tail[0]);
    J.tail[0].rotation.x = -2.2;
  }
  if (ex.has('batwings') || ex.has('fairywings')) for (const s of [-1, 1]) { const w = bone('Wing' + s, J.Chest, s * 0.18, 0.1, -0.25); const m = mesh(sph(1), mat(ex.has('fairywings') ? '#e8f4ff' : A, { op: ex.has('fairywings') ? 0.6 : 1 }), w); m.scale.set(0.32, 0.22, 0.02); m.position.x = s * 0.3; (J.wings = J.wings || []).push(w); }
  // outfit: simple 3D pieces by slot (keeps the item's colour)
  const of = pal.outfit || {}; const it = (s) => { const i = ITEM[of[s]]; return i && i.slot === s ? i : null; };
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
  const blink = (Math.floor(t / 4) % 55 === 0) || mode === 'sleep' ? 0.12 : 1; for (const e of J.eyes) e.scale.y = blink;
  sp.e += ((-(P.hy || 0) * 3 + (P.hrz || 0)) - sp.e) * 0.15;
  J.ears.forEach((e, i) => { e.rotation.x = sp.e * 0.4; e.rotation.y = 0; e.userData.z ??= e.rotation.z; e.rotation.z = e.userData.z + Math.sin(t * 0.07 + i) * 0.04 + (i ? -1 : 1) * sp.e * 0.2; });
  sp.tl += ((P.hrz || 0) * -2 + (P.hx || 0) * -2 - sp.tl) * 0.12;
  J.tail.forEach((b, i) => { if (i) b.rotation.set(0.3, 0, Math.sin(t * (P.tw || 0.1) - i * 0.6) * 0.25 + sp.tl * 0.3); else b.rotation.z = Math.sin(t * (P.tw || 0.1)) * 0.3 + sp.tl; });
  if (J.tent) J.tent.forEach((b, i) => { b.rotation.x = Math.sin(t * 0.12 + i) * 0.3; b.rotation.z = Math.cos(t * 0.1 + i) * 0.2; });
  if (J.wings) J.wings.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.4 + Math.sin(t * 0.3) * 0.3); });
  if (J.trunk) { J.trunk[0].rotation.x = 0.5 + Math.sin(t * 0.08) * 0.15 - (mode === 'react' ? 1.2 : 0); }
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
export function drawPal3D(c, x, y, size, pal, st = {}) {
  const f = Math.floor(performance.now() / 16); if (f !== frameN) { frameN = f; frameCount = 0; }
  if (++frameCount > BUDGET) return false; // too many Pals this frame: caller draws 2D
  if (!R) init();
  if (lost) return false; // context lost (iOS memory pressure): caller draws the 2D Pal
  const key = JSON.stringify([pal.species, pal.colors, pal.outfit, stageOf(pal.level || 1)]);
  let m = cache.get(key); if (!m) { m = build(pal); cache.set(key, m); if (cache.size > 24) { const k0 = cache.keys().next().value; cache.delete(k0); } }
  const t = st.t || 0;
  let P = modePose(st.mode || 'idle', t);
  if (st.dance3d) { const D3 = clipFor(st.dance3d, m.userData.sp); P = blend(P, D3(st.beat || 0, t), st.amt ?? 1); }
  if (!sane(P)) P = modePose('idle', t); // never leave a broken / T-pose on screen
  // overlap & follow-through: every joint eases toward its target (limbs a bit slower than the hips), so moves and
  // dance changes flow into each other instead of snapping
  const pv = m.userData.prev; if (pv && Math.abs(t - (m.userData.pt || 0)) < 30) { const o = {}; for (const k in P) { const a = pv[k], b = P[k]; o[k] = Array.isArray(b) ? b.map((v, i) => (a && Number.isFinite(a[i]) ? a[i] + (v - a[i]) * 0.28 : v)) : typeof b === 'number' && typeof a === 'number' && k !== 'ry' ? a + (b - a) * 0.42 : b; } P = o; }
  m.userData.prev = P; m.userData.pt = t;
  apply(m, P, t, st.mode);
  m.rotation.y = ((st.face || 1) < 0 ? -0.28 : 0.28) + (P.ry || 0);
  scene.add(m); R.render(scene, cam); scene.remove(m);
  const w = size * 1.65; c.drawImage(R.domElement, x - w / 2, y - w * 0.87, w, w);
  return true;
}
export { DANCES3D };
export const THREE_VERSION = THREE.REVISION;
