// Motion v3 for 3D Pals: walk/run gait, jumps, dance groove layers, IK foot-locking, contact shadows and spring
// secondary motion. Works on the shared humanoid rig in pal3d.js, so all species (and outfits, which ride the bones)
// get it; stride and step height scale with the rig's leg length.
//
// FOR PAL PARK (js/pals/park.js): to walk/run a Pal, pass its ground speed and turn rate through drawDancer/drawPal:
//   drawDancer(c, x, y, size, pal, { t, mode: 'walk', speed, turn, face })
//     speed: 0 = stand, 1 = normal walk, 1.6+ = full run (blends walk -> run in between). mode 'run' = speed 2.
//     turn: -1..1 (lean + look into the turn).
//   To keep the feet from skating, move the Pal on screen at walkPxPerFrame(size, speed) pixels per frame (60 fps);
//   or call gaitSpeedFor(pxPerFrame, size) to get the `speed` that matches how fast you already move it.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const TAU = Math.PI * 2;
const L0 = 0.54; // reference leg length (upper + lower) of the shared rig
const VIEW = 3.32; // world units visible across the 3D sprite (camera fov 26 at 7.2 units)
export const WALK_V = 0.0085; // ground speed, rig units per frame, at speed 1 for leg length L0

// gait timing for a speed. run blend r: 0 = walk, 1 = run.
function gaitParams(speed, L) {
  const r = smooth(clamp((speed - 1) / 0.6, 0, 1));
  const k = Math.sqrt(L / L0);
  const period = lerp(46, 28, r) * k; // frames per full cycle (two steps)
  const duty = lerp(0.62, 0.38, r); // fraction of the cycle each foot is on the ground
  const v = WALK_V * speed * (L / L0);
  return { r, period, duty, v, stride: v * period * duty };
}
/** pixels per frame a Pal drawn at `size` should move so its feet stay locked to the ground */
export function walkPxPerFrame(size, speed = 1, rootScale = 1) { return WALK_V * speed * rootScale * (size * 1.65) / VIEW; }
export function gaitSpeedFor(pxPerFrame, size, rootScale = 1) { return Math.abs(pxPerFrame) / Math.max(1e-6, WALK_V * rootScale * (size * 1.65) / VIEW); }

// advance a model's gait phase continuously (speed changes never make the legs jump)
export function advancePhase(ud, t, speed, L = L0) {
  const g = gaitParams(Math.max(speed, 0.05), L); const dt = ud.gT == null ? 0 : clamp(t - ud.gT, 0, 4);
  ud.gT = t; ud.gPh = ((ud.gPh || 0) + dt / g.period) % 1; return ud.gPh;
}

/** Walk/run pose with foot targets (fL/fR = [dx, dy, dz, pitch, lockWeight] relative to the rest foot). */
export function gaitPose(phase, speed = 1, turn = 0, L = L0, legs = true) {
  const sp = Math.max(0, speed); const w = smooth(clamp(sp / 0.25, 0, 1)); const g = gaitParams(Math.max(sp, 0.05), L); const { r, duty, stride } = g;
  const P = { aL: [12, 0, 20], aR: [12, 0, 20], fL: null, fR: null };
  const s = L / L0;
  if (!legs) { // floating / legless species: a soft forward glide-bob
    const b = Math.abs(Math.sin(phase * TAU)); Object.assign(P, { hy: b * 0.07 * w, cx: 0.08 * w, nx: -0.05 * w, hrz: turn * 0.15, ny: turn * 0.3, aL: [20 + b * 20, -20, 30], aR: [20 + b * 20, -20, 30] }); return P;
  }
  const clear = L * lerp(0.13, 0.24, r) * Math.min(1, sp + 0.3);
  const foot = (ph) => { // ph = this foot's phase; 0 = heel strike
    if (ph < duty) { // stance: foot locked to the ground, slides back exactly at ground speed
      const u = ph / duty; const z = stride * (0.5 - u);
      let pitch = 0, dy = 0;
      if (u < 0.18) pitch = -0.32 * (1 - smooth(u / 0.18)) * (1 - r * 0.7); // heel strike, toe up -> foot flat
      if (u > 0.7) { const k = smooth((u - 0.7) / 0.3); pitch = 0.55 * k; dy = 0.035 * s * k; } // heel rises, push-off
      return [0, dy, z, pitch, 1];
    }
    const u = (ph - duty) / (1 - duty); // swing: lift, pass, reach forward
    const z = -stride / 2 + stride * smooth(u) + Math.sin(u * Math.PI) * stride * 0.08;
    const dy = clear * Math.pow(Math.sin(u * Math.PI), 1.3) * (u < 0.5 ? 1 : 0.9);
    const pitch = lerp(0.5, -0.3, smooth(u));
    return [0, dy, z, pitch, 1];
  };
  const fL = foot(phase % 1), fR = foot((phase + 0.5) % 1);
  P.fL = fL.map((v, i) => (i < 4 ? v * w : v)); P.fR = fR.map((v, i) => (i < 4 ? v * w : v));
  const c2 = Math.cos(phase * TAU * 2);
  const hyWalk = -0.028 * s * (0.5 + 0.5 * c2); // lowest at heel strike (double support), highest passing
  const hyRun = -0.03 * s * Math.cos(TAU * 2 * (phase - duty / 2)) - 0.035 * s; // compress mid-stance, rise in flight
  const side = Math.cos(TAU * (phase - duty / 2)); // + = left foot is the supporting one
  Object.assign(P, {
    hy: lerp(hyWalk, hyRun, r) * w,
    hx: side * lerp(0.03, 0.012, r) * s * w, // weight over the stance foot
    hrz: (-side * 0.045 + turn * 0.14 * Math.min(1.5, sp)) * w, // pelvis drop on the swing side + lean into turns
    hry: Math.cos(phase * TAU) * lerp(0.12, 0.2, r) * w, // pelvis turns with the forward leg
    cx: lerp(0.04, 0.22, r) * w + turn * 0, cy: -Math.cos(phase * TAU) * lerp(0.17, 0.28, r) * w, // chest counter-rotates
    cz: side * 0.03 * w,
    nx: (-lerp(0.04, 0.16, r) + Math.cos(phase * TAU * 2) * 0.02) * w, ny: turn * 0.35, nz: -side * 0.035 * w,
    sh: Math.cos(phase * TAU) * 0.06 * w,
  });
  const amp = lerp(26, 52, r) * w, el = lerp(18, 85, r);
  P.aL = [lerp(10, 16, r), Math.cos(phase * TAU + Math.PI) * amp + r * 10, el + Math.max(0, Math.cos(phase * TAU + Math.PI)) * 18, 0]; // arm opposite its leg
  P.aR = [lerp(10, 16, r), Math.cos(phase * TAU) * amp + r * 10, el + Math.max(0, Math.cos(phase * TAU)) * 18, 0];
  return P;
}

/** Jump with anticipation, stretch, airborne tuck, squash on landing. k = 0..1 through one jump. */
export function jumpPose(k, height = 0.45) {
  const P = { aL: [24, 6, 14], aR: [24, 6, 14], sq: 0, fL: [0, 0, 0, 0, 1], fR: [0, 0, 0, 0, 1] };
  if (k < 0.22) { const a = smooth(k / 0.22); Object.assign(P, { hy: -0.13 * a, sq: 0.1 * a, cx: 0.18 * a, nx: -0.1 * a, aL: [20, -35 * a, 30], aR: [20, -35 * a, 30] }); }
  else if (k < 0.3) { const a = smooth((k - 0.22) / 0.08); Object.assign(P, { hy: lerp(-0.13, 0.12, a), sq: lerp(0.1, -0.12, a), cx: lerp(0.18, -0.05, a), aL: [lerp(20, 150, a), 10, 20], aR: [lerp(20, 150, a), 10, 20] }); const lw = 1 - a * 0.6; P.fL = [0, 0, 0, 0.5 * a, lw]; P.fR = [0, 0, 0, 0.5 * a, lw]; }
  else if (k < 0.7) { const u = (k - 0.3) / 0.4; const y = 0.12 + (height - 0.12) * Math.sin(u * Math.PI) ; Object.assign(P, { hy: y, sq: -0.08 * (1 - u) + 0.03 * u, cx: -0.05 + 0.1 * u, nx: 0.08 * (1 - u), aL: [150 - 90 * u, 10, 20 + 30 * u], aR: [150 - 90 * u, 10, 20 + 30 * u], lL: [25 * Math.sin(u * Math.PI), 4, 45 * Math.sin(u * Math.PI)], lR: [25 * Math.sin(u * Math.PI), 4, 45 * Math.sin(u * Math.PI)] }); P.fL = [0, 0, 0, 0.2, 0]; P.fR = [0, 0, 0, 0.2, 0]; }
  else if (k < 0.8) { const a = smooth((k - 0.7) / 0.1); Object.assign(P, { hy: lerp(0.12, -0.15, a), sq: lerp(0.03, 0.16, a), cx: 0.2 * a, nx: 0.12 * a, aL: [lerp(60, 45, a), 30, 50], aR: [lerp(60, 45, a), 30, 50] }); P.fL = [0, 0, 0, 0, a]; P.fR = [0, 0, 0, 0, a]; }
  else { const a = smooth((k - 0.8) / 0.2); Object.assign(P, { hy: lerp(-0.15, 0, a), sq: lerp(0.16, 0, a), cx: lerp(0.2, 0, a), nx: lerp(0.12, 0, a), aL: [lerp(45, 24, a), lerp(30, 6, a), lerp(50, 14, a)], aR: [lerp(45, 24, a), lerp(30, 6, a), lerp(50, 14, a)] }); }
  return P;
}

/** Natural body/head groove layered over any dance clip (beats = music beats). g = intensity. */
export function grooveLayer(p, beat, g = 1, seed = 0) {
  const b = beat * TAU;
  const hit = Math.pow(0.5 + 0.5 * Math.cos(b), 3); // sharp on the beat, soft in between (not a linear tween)
  // knees bounce on the beat; weight shifts every 2 beats with the hips swaying over the supporting leg
  p.hy = (p.hy || 0) - hit * 0.035 * g;
  const ws = Math.sin(b / 2 + seed);
  p.hx = (p.hx || 0) + ws * 0.035 * g; p.hrz = (p.hrz || 0) + ws * 0.055 * g;
  p.hry = (p.hry || 0) + Math.sin(b / 4 + seed) * 0.06 * g;
  // chest isolations (counter to the hips) + pump on the beat
  p.cz = (p.cz || 0) - ws * 0.07 * g + Math.sin(b / 2 + 1.2) * 0.03 * g;
  p.cx = (p.cx || 0) + hit * 0.05 * g; p.cy = (p.cy || 0) - (p.hry || 0) * 0.6;
  p.sz = (p.sz || 0) - (p.hrz || 0) * 0.5;
  // shoulder rolls (circular, L and R half a beat apart)
  p.shL = [Math.sin(b + seed) * 0.09 * g, Math.cos(b + seed) * 0.07 * g]; p.shR = [Math.sin(b + Math.PI + seed) * 0.09 * g, Math.cos(b + Math.PI + seed) * 0.07 * g];
  // head: nod just after the beat, tilts with the weight shift, a slow look around, stays level-ish over the chest
  p.nx = (p.nx || 0) + (Math.pow(0.5 + 0.5 * Math.cos(b - 0.7), 2) - 0.35) * 0.16 * g - (p.cx || 0) * 0.35;
  p.nz = (p.nz || 0) + ws * 0.09 * g - (p.cz || 0) * 0.4;
  p.ny = (p.ny || 0) + Math.sin(b / 8 + seed * 2) * 0.22 * g;
  return p;
}

// ---------------------------------------------------------------- IK foot locking + contact shadows
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qx = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0), XAX = new THREE.Vector3(1, 0, 0);
let SHTEX = null, SHMAT = null, SHGEO = null;
function shadowMat() {
  if (SHMAT) return SHMAT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(20,6,40,0.55)'); g.addColorStop(0.6, 'rgba(20,6,40,0.22)'); g.addColorStop(1, 'rgba(20,6,40,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  SHTEX = new THREE.CanvasTexture(cv); SHGEO = new THREE.PlaneGeometry(1, 1); SHGEO.rotateX(-Math.PI / 2);
  SHMAT = new THREE.MeshBasicMaterial({ map: SHTEX, transparent: true, depthWrite: false }); return SHMAT;
}
function contact(root, J) {
  if (J.csh) return J.csh; const m = shadowMat();
  const mk = (sx, sz) => { const o = new THREE.Mesh(SHGEO, m.clone()); o.scale.set(sx, 1, sz); o.renderOrder = -1; o.castShadow = false; o.receiveShadow = false; root.add(o); return o; };
  J.csh = { body: mk(0.95, 0.6), L: mk(0.32, 0.4), R: mk(0.32, 0.4) }; return J.csh;
}
/**
 * After the FK pose is set: plant the feet (2-bone IK per leg), keep soles flat / heel-toe pitched, never below the
 * ground, and update the contact shadows. P.fL/fR give explicit targets (gait, jumps); otherwise a foot is locked to its
 * rest spot unless the dance lifts it (lL/lR lift or extra knee), and P.slide (glides) lets the feet travel with the hips.
 */
export function plantFeet(root, P, legs) {
  const J = root.userData.J; const sh = contact(root, J);
  const hipsY = J.Hips.position.y;
  sh.body.position.set(J.Hips.position.x * 0.6, 0.006, J.Hips.position.z * 0.6);
  const air = clamp((hipsY - (legs ? 0.64 : 0.95)) / 0.5, 0, 1); const bs = 1 - air * 0.45; sh.body.scale.set(0.95 * bs, 1, 0.6 * bs); sh.body.material.opacity = 0.75 - air * 0.45;
  if (!legs) { sh.L.visible = sh.R.visible = false; return; }
  const ul = J.fit ? J.fit.ul : 0.27, ll = J.fit ? J.fit.ll : 0.27, reach = (ul + ll) * 0.9995;
  root.updateMatrix(); J.Hips.updateMatrix(); J.Hips.updateMatrixWorld(true);
  const toRoot = _m.copy(root.matrixWorld).invert();
  for (const [n, key, lk] of [['Left', 'fL', 'lL'], ['Right', 'fR', 'lR']]) {
    const up = J[n + 'UpperLeg'], lo = J[n + 'LowerLeg'], ft = J[n + 'Foot'];
    const fk = ft.getWorldPosition(_v).applyMatrix4(toRoot); // where the dance put the foot
    const fkQ = _q2.copy(ft.quaternion); const restY = 0.64 - (ul + ll); const rx = up.position.x;
    let tgt, pitch = 0, wgt;
    const f = P[key];
    if (f) { tgt = new THREE.Vector3(rx + f[0], restY + f[1], f[2]); pitch = f[3]; wgt = f[4]; }
    else { const lg = P[lk] || [0, 0, 0]; const lifted = Math.max(0, lg[0]) + Math.max(0, lg[2]) * 0.6; wgt = P.slide ? 0 : clamp(1 - (lifted - 3) / 14, 0, 1); tgt = new THREE.Vector3(rx, restY, 0); }
    const T = fk.clone().lerp(tgt, wgt); if (T.y < restY) T.y = restY; // never through the floor
    // solve in the hips frame
    const hipInv = new THREE.Matrix4().copy(J.Hips.matrix).invert(); const th = T.clone().applyMatrix4(hipInv); _d.copy(th).sub(up.position);
    const len = clamp(_d.length(), 0.08, reach); _d.normalize();
    const alpha = Math.acos(clamp((ul * ul + len * len - ll * ll) / (2 * ul * len), -1, 1));
    const gamma = Math.acos(clamp((ul * ul + ll * ll - len * len) / (2 * ul * ll), -1, 1));
    _q.setFromUnitVectors(DOWN, _d); _qx.setFromAxisAngle(XAX, -alpha); up.quaternion.copy(_q).multiply(_qx);
    lo.quaternion.setFromAxisAngle(XAX, Math.PI - gamma);
    // sole: flat on the ground (with heel/toe pitch) while planted, the dance's own foot angle while lifted
    const chain = new THREE.Quaternion().copy(J.Hips.quaternion).multiply(up.quaternion).multiply(lo.quaternion);
    const flat = chain.invert().multiply(new THREE.Quaternion().setFromAxisAngle(XAX, pitch));
    ft.quaternion.copy(fkQ).slerp(flat, Math.max(wgt, f ? 1 : 0));
    // contact shadow under the foot: fades and shrinks as it lifts
    const h = clamp((T.y - restY) / 0.25, 0, 1); const s = sh[n[0]]; s.visible = true; s.position.set(T.x, 0.008, T.z + 0.05); const k = 1 - h * 0.5; s.scale.set(0.32 * k, 1, 0.4 * k); s.material.opacity = 0.7 * (1 - h);
  }
}

// ---------------------------------------------------------------- springs for ears, tails, trunks, gills, tentacles
// damped springs driven by how the head and hips move (accelerations), so floppy parts lag, overshoot and settle
export function springs(root, P) {
  const st = root.userData.spr || (root.userData.spr = { e: [0, 0], ev: [0, 0], tl: [0, 0], tv: [0, 0], ph: null });
  const drv = { hy: P.hy || 0, hrz: P.hrz || 0, hx: P.hx || 0, nz: P.nz || 0, nx: P.nx || 0, ry: P.hry || 0 };
  const pv = st.ph || drv; st.ph = drv;
  const acc = { y: drv.hy - pv.hy, z: drv.hrz - pv.hrz + (drv.nz - pv.nz) * 0.6, x: drv.nx - pv.nx, side: drv.hx - pv.hx, yaw: drv.ry - pv.ry };
  const step = (x, v, i, target, kick, k = 0.16, d = 0.78) => { v[i] = (v[i] + (target - x[i]) * k - kick) * d; x[i] += v[i]; x[i] = clamp(x[i], -0.9, 0.9); };
  step(st.e, st.ev, 0, -(P.nx || 0) * 0.25, acc.y * 6 + acc.x * 1.5); // ears pitch (flop on bounces)
  step(st.e, st.ev, 1, -(P.nz || 0) * 0.3, acc.z * 4 + acc.side * 4); // ears roll
  step(st.tl, st.tv, 0, -(P.hrz || 0) * 1.6 - (P.hx || 0) * 2, acc.z * 6 + acc.side * 10 + acc.yaw * 5, 0.1, 0.84); // tail side
  step(st.tl, st.tv, 1, (P.hy || 0) * -1.5, acc.y * 8, 0.12, 0.8); // tail up/down
  return st;
}
