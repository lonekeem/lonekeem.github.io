// Kemy Pals - original creature art, drawn in code with layered, recolorable parts.
const TAU = Math.PI * 2;
export const VIBES = { water: { name: 'Water', c: '#5aa8ff' }, star: { name: 'Star', c: '#ffd34d' }, leaf: { name: 'Leaf', c: '#6fd39a' }, flame: { name: 'Flame', c: '#ff8a5c' }, spark: { name: 'Spark', c: '#ffe14d' }, moon: { name: 'Moon', c: '#b9a6ff' } };
import { drawWear } from './wear.js';
import { SPECIES , FOUNDER } from './species.js';
export { SPECIES };
const ALIAS = { twinkbun: 'bunny', nimbo: 'cloudpuff', ember: 'puppy', mossy: 'turtle', prism: 'fox', zap: 'chick', luno: 'owl', petal: 'hamster' };
export const SPEC = Object.fromEntries(SPECIES.map((s) => [s.id, s])); SPEC.founder = FOUNDER;
for (const k in ALIAS) SPEC[k] = SPEC[ALIAS[k]];
export const BODY_PRESETS = ['#f7cdee', '#ffd6a8', '#cdeec0', '#cfe3ff', '#e4d6ff', '#fff3a6', '#ffc0cb', '#d0d0e0'];
export const ACC_PRESETS = ['#8a55dc', '#ff7ab8', '#5aa8ff', '#5fae6e', '#ffb31a', '#ff7a4d', '#6b4fd6', '#3a2a63'];
export const EYE_PRESETS = ['#24133f', '#2a4a8a', '#3b6b3a', '#7a2a4a', '#5a3a1a'];
export const PATTERNS = ['none', 'spots', 'stripes', 'sparkle'];
export const ACCESSORIES = ['none', 'bow', 'crown', 'shades', 'scarf', 'hat', 'badge'];
export const stageOf = (level) => (level >= 12 ? 2 : level >= 5 ? 1 : 0);
export const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
export function hueHex(h, s = 70, l = 85) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join(''); }
function ell(c, x, y, rx, ry, r = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), r, 0, TAU); }
export function star(c, x, y, r, ri = r * 0.48) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? ri : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
export function heart(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45); c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); }
export function drawEgg(c, x, y, size, t, cracks = 0, A = '#b47cf0') {
  const k = size / 40; c.save(); c.translate(x, y); c.scale(k, k); c.rotate(Math.sin(t * 0.15) * 0.08 * (1 + cracks));
  c.fillStyle = 'rgba(30,10,60,.18)'; ell(c, 0, 0, 10, 2.4); c.fill();
  c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(12, -30, 13, -2, 0, -1); c.bezierCurveTo(-13, -2, -12, -30, 0, -30);
  const g = c.createLinearGradient(0, -30, 0, 0); g.addColorStop(0, '#fff6fd'); g.addColorStop(1, '#f2c9f0'); c.fillStyle = g; c.fill(); c.strokeStyle = '#7d4fc0'; c.stroke();
  c.fillStyle = A; for (const [a, b] of [[-4, -20], [5, -14], [-3, -9], [4, -24]]) { star(c, a, b, 2.2); c.fill(); }
  c.strokeStyle = '#5a2a8c'; c.lineWidth = 1;
  if (cracks > 0) { c.beginPath(); c.moveTo(-8, -16); c.lineTo(-4, -13); c.lineTo(-1, -17); c.lineTo(2, -13); if (cracks > 1) { c.lineTo(5, -17); c.lineTo(8.5, -14); } c.stroke(); }
  c.restore();
}
// snacks / props
export function drawSnack(c, x, y, r, kind) {
  c.save(); c.translate(x, y); c.lineWidth = 1.2;
  if (kind === 0) { c.fillStyle = '#ffcf6b'; c.strokeStyle = '#a8700f'; star(c, 0, 0, r); c.fill(); c.stroke(); c.fillStyle = '#7a3a1a'; for (const [a, b] of [[-r * 0.2, -r * 0.1], [r * 0.25, r * 0.15]]) { ell(c, a, b, r * 0.1, r * 0.1); c.fill(); } }
  if (kind === 1) { c.fillStyle = '#ff6f9a'; c.strokeStyle = '#8a2a4a'; ell(c, -r * 0.3, r * 0.1, r * 0.55, r * 0.55); c.fill(); c.stroke(); ell(c, r * 0.35, r * 0.15, r * 0.5, r * 0.5); c.fill(); c.stroke(); c.strokeStyle = '#3b8a4a'; c.beginPath(); c.moveTo(0, -r * 0.3); c.lineTo(r * 0.2, -r * 0.9); c.stroke(); }
  if (kind === 2) { c.fillStyle = '#9fd8ff'; c.strokeStyle = '#2a5a8a'; c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(-r * 0.2, -r * 0.8, r * 0.5, 0); c.quadraticCurveTo(-r * 0.2, r * 0.8, -r, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(r * 0.4, 0); c.lineTo(r, -r * 0.5); c.lineTo(r, r * 0.5); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
export function drawBubble(c, x, y, r) { ell(c, x, y, r, r); const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(0.8, 'rgba(200,180,255,.35)'); g.addColorStop(1, 'rgba(240,190,255,.8)'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.8; c.stroke(); ell(c, x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.13, -0.6); c.fillStyle = '#fff'; c.fill(); }
// ------------------------------------------------------------------ the one Pal renderer
// drawPal(ctx, x, y, size, pal, st): renders ANY Pal at any size. (x, y) = feet centre; size ~ height in px.
// pal = { species, colors: { body, accent, eye }, pattern, acc, level }
// st  = { t (frame), face (1|-1), mode: idle|walk|hop|happy|sleep|eat|shake|react, mood: { dirty, sad, bandage } }
// One look everywhere: when the 3D renderer is loaded (js/pals/dance.js -> pal3d.js) every drawPal() call renders the
// 3D model; the 2D art below is only the fallback (no WebGL / low-end / over the per-frame budget). st.flat forces 2D.
let R3 = null, wait3D = false, err3 = 0, LOADING = null;
export const setPal3D = (fn) => { R3 = fn; };
// while three.js is loading (or retrying) show a soft placeholder instead of the flat 2D art
export const setPal3DWait = (on, loadingFn) => { wait3D = !!on; if (loadingFn) LOADING = loadingFn; };
function drawWait(c, x, y, size) { const p = 0.5 + 0.5 * Math.sin(performance.now() / 260); c.save(); c.globalAlpha = 0.28 + p * 0.22; c.fillStyle = '#e9dcff'; c.beginPath(); c.ellipse(x, y - size * 0.42, size * 0.36, size * 0.42, 0, 0, 7); c.fill(); c.globalAlpha = 0.2; c.beginPath(); c.ellipse(x, y - 2, size * 0.34, size * 0.06, 0, 0, 7); c.fill(); c.restore(); }
export const pal3DOn = () => !!R3;
export const pal3DWaiting = () => !R3 && wait3D; // true while three.js is still loading (drawPal shows a placeholder)
// dance.js asks to be told when a Pal is first drawn, and only then fetches three.js (never just for the feed)
let NEED3D = null; export const onNeed3D = (fn) => { NEED3D = fn; };
const thumbs = new Map();
// Cached still image of a Pal (3D when available). Returns a canvas; re-renders once 3D becomes available.
export function getPalThumbnail(pal, px = 128) {
  const key = JSON.stringify([pal.species, pal.colors, pal.outfit, pal.level >= 12 ? 2 : pal.level >= 5 ? 1 : 0, px, !!R3]);
  let cv = thumbs.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = px; const c = cv.getContext('2d');
  drawPal(c, px / 2, px * 0.92, px * 0.62, pal, { t: 30, mode: 'idle' });
  thumbs.set(key, cv); if (thumbs.size > 60) thumbs.delete(thumbs.keys().next().value); return cv;
}
export function drawPal(c, x, y, size, pal, st = {}) {
  if (R3 && !st.flat) { try { if (R3(c, x, y, size, pal, st)) return; } catch (e) { console.warn('3D Pal draw error:', e); if (++err3 > 30) R3 = null; } }
  else if (!R3 && wait3D && !st.flat) { if (NEED3D) NEED3D(); (LOADING || drawWait)(c, x, y, size); return; }
  const sp = SPEC[pal.species] || SPECIES[0]; const col = pal.colors || {};
  const B = col.body || sp.body, A = col.accent || sp.acc, E = col.eye || '#24133f';
  const stage = stageOf(pal.level || 1); const t = st.t || 0; const face = st.face || 1; const mood = st.mood || {};
  const ex = new Set(sp.extras || []); const kind = sp.body2 || 'blob'; const floaty = ex.has('float');
  const mode = st.mode === 'react' ? (['spin', 'roll'].includes(sp.react) ? 'happy' : 'happy') : st.mode;
  const k = size / 40; c.save(); c.translate(x, y); c.scale(k, k);
  let bob = 0, tilt = 0, sx = 1, sy = 1, leg = 0, earF = 0, tailW = Math.sin(t * 0.1) * 0.2, wing = 0, mouthOpen = 0, cheek = 1, spin = 0;
  if (mode === 'idle') { bob = Math.sin(t * 0.06) * 0.8; earF = Math.sin(t * 0.05) * 0.06; }
  if (mode === 'walk') { leg = Math.sin(t * 0.35); bob = -Math.abs(leg) * 1.2; tilt = 0.06 * face; tailW = Math.sin(t * 0.35) * 0.4; earF = leg * 0.1; }
  if (mode === 'hop') { bob = -Math.abs(Math.sin(t * 0.18)) * 9; earF = -0.25; }
  if (mode === 'happy') { tilt = Math.sin(t * 0.4) * 0.22; bob = -Math.abs(Math.sin(t * 0.2)) * 6; tailW = Math.sin(t * 0.9) * 0.6; wing = Math.sin(t * 0.7) * 0.6; earF = Math.sin(t * 0.4) * 0.2; }
  if (mode === 'shake') { tilt = Math.sin(t * 1.3) * 0.22; earF = Math.sin(t * 1.3) * 0.4; }
  if (mode === 'sleep') { bob = Math.sin(t * 0.03) * 0.5; sy = 0.9; sx = 1.08; earF = 0.15; }
  if (mode === 'eat') { mouthOpen = Math.abs(Math.sin(t * 0.5)); bob = Math.sin(t * 0.5) * 0.6; cheek = ex.has('cheeks') ? 1.3 : 1; }
  // species tap reactions
  const R = st.mode === 'react' ? sp.react : '';
  if (R === 'wag') { tailW = Math.sin(t * 1.4) * 0.9; tilt = Math.sin(t * 0.3) * 0.08; bob = 0; }
  if (R === 'flap') { wing = Math.sin(t * 1.2) * 0.9; bob = -Math.abs(Math.sin(t * 0.3)) * 5; }
  if (R === 'roll' || R === 'spin') spin = (t * 0.12) % TAU;
  if (R === 'puff') { sx = 1.15 + Math.sin(t * 0.2) * 0.05; sy = 1.08; cheek = 1.5; }
  if (R === 'roar' || R === 'honk') { mouthOpen = 1; tilt = -0.15 * face; }
  if (R === 'hop') bob = -Math.abs(Math.sin(t * 0.25)) * 12;
  if (R === 'wiggle') { tilt = Math.sin(t * 0.6) * 0.3; }
  if (R === 'relax') { bob = Math.sin(t * 0.08) * 0.8; tilt = Math.sin(t * 0.07) * 0.12; tailW = 0; wing = 0; earF = Math.sin(t * 0.1) * 0.08; } // capybara: slow, blissed-out sway
  if (floaty) bob += Math.sin(t * 0.07) * 2 - 4;
  const grow = [0.84, 1, 1.12][stage], bodyG = [1, 1.08, 1.22][stage];
  if (stage === 2) { const g = c.createRadialGradient(0, -16, 2, 0, -16, 26); g.addColorStop(0, 'rgba(255,230,140,.35)'); g.addColorStop(1, 'rgba(178,107,255,0)'); c.fillStyle = g; c.fillRect(-28, -46, 56, 48); }
  c.fillStyle = 'rgba(30,10,60,.18)'; ell(c, 0, 0, 11 * grow * (floaty ? 0.7 : 1), 2.4); c.fill();
  c.translate(0, bob); if (spin) { c.translate(0, -10); c.rotate(spin * face); c.translate(0, 10); }
  c.rotate(tilt); c.scale(face * sx * grow, sy * grow);
  // ---------------- rig: joints for arms (shoulder/elbow/hand) and legs (hip/knee/foot)
  const hasLegs = kind === 'blob' && sp.feet !== 'none' && !floaty, legH = hasLegs ? 3.4 : 0;
  const armKind = kind !== 'blob' ? '' : ex.has('wings') ? 'wing' : ex.has('flippers') ? 'flipper' : 'paw';
  const RG = rigPose(st.mode === 'react' ? 'happy' : st.mode || 'idle', t, st.rig, leg);
  c.translate(0, -legH);
  c.lineWidth = 1; c.lineJoin = 'round'; c.lineCap = 'round'; const line = shade(A === '#ffffff' ? B : A, -0.4); c.strokeStyle = line;
  const light = shade(B, 0.5), dark = shade(B, -0.12);
  const P = (fn) => { c.save(); fn(); c.restore(); };
  const fillS = (f) => { c.fillStyle = f; c.fill(); c.stroke(); };
  const hy = -13.5 - (bodyG - 1) * 6, hr = 9.2; // head centre / radius
  // ---------------- back layer: tail, wings
  const tail = sp.tail;
  P(() => { c.translate(-6 * bodyG, -5); c.rotate(-0.5 + tailW);
    if (tail === 'axo') { c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(-8, -6, -13 - stage * 2, -2); c.quadraticCurveTo(-8, 2, 0, 3); c.closePath(); fillS(dark); }
    if (tail === 'wag' || tail === 'thin') { c.strokeStyle = tail === 'wag' ? B : dark; c.lineWidth = tail === 'wag' ? 3 : 2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-6, -1, -7, -8 - stage); c.stroke(); c.lineWidth = 1; }
    if (tail === 'tuft') { c.strokeStyle = dark; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-6, 1, -8, -6); c.stroke(); c.fillStyle = A; ell(c, -8, -7, 2.2, 2.6); c.fill(); }
    if (tail === 'fluffy') { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-12, -6, -8, -16 - stage * 3); c.quadraticCurveTo(-1, -9, 0, 0); fillS(B); c.fillStyle = A; ell(c, -8, -14 - stage * 3, 2.6, 3); c.fill(); }
    if (tail === 'ringed') { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-12, -4, -9, -15); c.quadraticCurveTo(-2, -9, 0, 0); fillS(B); c.strokeStyle = A; c.lineWidth = 2; for (const q of [0.35, 0.6, 0.85]) { c.beginPath(); c.arc(-9 * q, -15 * q + 2, 2.5, 0, Math.PI); c.stroke(); } c.lineWidth = 1; }
    if (tail === 'curl') { c.strokeStyle = A; c.lineWidth = 1.4; c.beginPath(); c.arc(-3, -2, 2.2, 0, TAU * 0.85); c.stroke(); c.lineWidth = 1; }
    if (tail === 'puff') { c.fillStyle = '#fff'; ell(c, -1, 0, 3, 3); c.fill(); c.stroke(); }
    if (tail === 'stub') { ell(c, -1, 0, 2, 1.6); fillS(dark); }
    if (tail === 'flat') { c.beginPath(); c.ellipse(-6, 2, 7, 2.4, 0.3, 0, TAU); fillS(dark); }
    if (tail === 'dragon') { c.beginPath(); c.moveTo(0, -2); c.quadraticCurveTo(-9, 0, -13 - stage * 2, -7); c.lineTo(-11, -2); c.quadraticCurveTo(-7, 3, 0, 3); c.closePath(); fillS(B); c.fillStyle = A; c.beginPath(); c.moveTo(-13 - stage * 2, -7); c.lineTo(-16 - stage * 2, -10); c.lineTo(-12 - stage * 2, -10); c.closePath(); c.fill(); }
  });
  if (ex.has('batwings')) for (const s of [-1, 1]) P(() => { c.translate(s * 4, -10); c.rotate(s * (0.3 + wing * 0.5)); c.beginPath(); c.moveTo(0, 0); c.lineTo(s * (9 + stage * 2), -8); c.lineTo(s * (8 + stage * 2), -2); c.lineTo(s * 10, 1); c.lineTo(s * 5, 2); c.closePath(); fillS(A); });
  if (ex.has('fairywings')) for (const s of [-1, 1]) P(() => { c.translate(s * 5, -14); c.rotate(s * (0.4 + Math.sin(t * 0.5) * 0.3)); c.globalAlpha = 0.7; ell(c, s * 6, -3, 6, 3.5, -0.4 * s); fillS('#e8f4ff'); ell(c, s * 5, 3, 4, 2.4, 0.3 * s); fillS('#ffe8fb'); });
  if (ex.has('wings')) for (const s of [-1, 1]) P(() => { c.translate(s * 6.5 * bodyG, -8); c.rotate(s * (0.3 + wing + ((s < 0 ? RG.sL : RG.sR) - 15) / 110)); ell(c, s * 1.5, 0, 2.6 + stage * 0.5, 4.5 + stage * 0.6); fillS(shade(B, -0.08)); });
  if (ex.has('flippers')) for (const s of [-1, 1]) P(() => { c.translate(s * 6.5, -7); c.rotate(s * (0.5 + wing + ((s < 0 ? RG.sL : RG.sR) - 15) / 90)); ell(c, s * 1.5, 1, 2, 5); fillS(B); });
  if (ex.has('shell')) P(() => { ell(c, -1, -8, 11 * bodyG, 8); fillS(A); c.strokeStyle = shade(A, -0.25); for (const [a, b] of [[-5, -10], [2, -11], [-1, -5]]) { ell(c, a, b, 2.6, 2); c.stroke(); } c.fillStyle = '#7fe08a'; for (let i = 0; i <= stage; i++) { ell(c, -4 + i * 4, -16, 2, 3, 0.4 * (i - 1)); c.fill(); } });
  if (ex.has('spikes')) P(() => { c.fillStyle = A; c.beginPath(); for (let i = 0; i <= 12; i++) { const a = Math.PI * 0.95 + i * (Math.PI * 1.05 / 12); const r = i % 2 ? 11 : 15 + stage; c.lineTo(Math.cos(a) * r - 2, -12 + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke(); });
  const WG = () => ({ bodyG, hy, t, stage, kind, top: (sp.ears === 'long' || sp.ears === 'big' ? hy - 7.6 : hy - 7), ey: hy - 0.5, eyeL: -3.6, eyeR: 3.6 });
  drawWear(c, 'back', pal.outfit, WG());
  // ---------------- feet + body
  const feet = sp.feet;
  const feetPos = hasLegs ? drawLegs(c, RG, { B, dark, line, light, feet, bodyG, legH, sp }) : null;
  if (feetPos) drawWear(c, 'feet', pal.outfit, { ...WG(), feet: feetPos });
  if (!hasLegs && feet === 'flippers') { for (const s of [-1, 1]) { ell(c, s * 5, -0.8, 3.4, 1.3, s * 0.3); fillS(dark); } }
  if (kind === 'blob') {
    ell(c, 0, -5.5 * bodyG, 6.8 * bodyG, 5.2 * bodyG); const g = c.createLinearGradient(0, -11, 0, 0); g.addColorStop(0, light); g.addColorStop(1, B); fillS(g);
    if (ex.has('belly')) { c.fillStyle = sp.id === 'penguin' || sp.id === 'owl' ? '#fbf6ff' : shade(B, 0.55); ell(c, 0.5, -4.6 * bodyG, 4 * bodyG, 3.6 * bodyG); c.fill(); }
    if (ex.has('stripes')) { c.strokeStyle = A; c.lineWidth = 1.3; for (const a of [-4, 0, 4]) { c.beginPath(); c.moveTo(a, -10 * bodyG); c.lineTo(a + 1, -7 * bodyG); c.stroke(); } c.lineWidth = 1; c.strokeStyle = line; }
    if (ex.has('giraffespots')) { c.fillStyle = A; for (const [a, b] of [[-3, -7], [3, -5], [-1, -3], [4, -9]]) { ell(c, a, b * bodyG, 1.5, 1.2); c.fill(); } }
  }
  if (kind === 'cloud') { c.fillStyle = B; for (const [a, b, r] of [[-7, -8, 6], [7, -8, 6], [0, -5, 7], [-4, -14, 6], [5, -14, 6]]) { ell(c, a, b, r, r * 0.9); c.fill(); c.stroke(); } for (const [a, b, r] of [[-7, -8, 5.2], [7, -8, 5.2], [0, -5, 6.2], [-4, -14, 5.2], [5, -14, 5.2]]) { ell(c, a, b, r, r * 0.9); c.fill(); } if (mode === 'happy' || R === 'puff') { c.fillStyle = '#ffd34d'; for (let i = 0; i < 4; i++) { star(c, -6 + i * 4, 2 + ((t * 0.5 + i * 5) % 10), 1.2); c.fill(); } } }
  if (kind === 'jelly') { c.strokeStyle = A; c.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 2.6, -6); c.quadraticCurveTo(i * 2.6 + Math.sin(t * 0.1 + i) * 2, -1, i * 2.6, 3 + stage * 2); c.stroke(); } c.lineWidth = 1; c.strokeStyle = line; }
  if (kind === 'star') { star(c, 0, -12, 13 + stage, 7 + stage * 0.5); const g = c.createLinearGradient(0, -25, 0, 0); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, B); fillS(g); }
  drawWear(c, 'body', pal.outfit, { ...WG(), feet: feetPos });
  // ---------------- ears (behind head)
  const ears = sp.ears;
  const earPair = (fn) => { for (const s of [-1, 1]) P(() => fn(s)); };
  if (ears === 'round') earPair((s) => { ell(c, s * 6.5, hy - 6, 2.9, 2.9); fillS(ex.has('eyepatch') ? A : B); ell(c, s * 6.5, hy - 6, 1.5, 1.5); c.fillStyle = ex.has('eyepatch') ? shade(A, 0.2) : shade(A === '#ffffff' ? B : A, 0.45); c.fill(); });
  if (ears === 'capy') earPair((s) => { c.translate(s * 5.9, hy - 6.5); c.rotate(s * (0.15 + earF)); ell(c, 0, 0, 1.8, 1.5); fillS(shade(B, -0.08)); ell(c, 0, 0.3, 0.9, 0.7); c.fillStyle = shade(A, 0.1); c.fill(); });
  if (ears === 'biground') earPair((s) => { ell(c, s * 8, hy - 4, 4.6, 4.6); fillS(B); ell(c, s * 8, hy - 4, 2.8, 2.8); c.fillStyle = A; c.fill(); });
  if (ears === 'pointy') earPair((s) => { c.translate(s * 5.8, hy - 5); c.rotate(s * (0.25 + earF)); c.beginPath(); c.moveTo(-3.4, 2); c.lineTo(0, -6 - stage); c.lineTo(3.4, 2); c.closePath(); fillS(sp.id === 'fox' || sp.id === 'redpanda' ? B : B); c.beginPath(); c.moveTo(-1.6, 1); c.lineTo(0, -3.6 - stage); c.lineTo(1.6, 1); c.closePath(); c.fillStyle = sp.id === 'piglet' ? A : shade('#ff9fc8', 0.3); c.fill(); });
  if (ears === 'long') earPair((s) => { c.translate(s * 3.8, hy - 6); c.rotate(s * (0.18 + earF)); ell(c, 0, -6, 2.8, 7 + stage); fillS(B); ell(c, 0, -6, 1.3, 5 + stage); c.fillStyle = A; c.fill(); });
  if (ears === 'floppy') earPair((s) => { c.translate(s * 8, hy - 3); c.rotate(s * (0.35 + earF)); ell(c, s * 1, 4, 2.8, 5.5); fillS(A); });
  if (ears === 'big') earPair((s) => { c.translate(s * 8, hy); c.rotate(s * (Math.sin(t * (R === 'spray' ? 0.6 : 0.08)) * 0.2 + earF)); ell(c, s * 3, 0, 5.5 + stage, 7.5 + stage); fillS(B); ell(c, s * 3, 0.5, 3.6 + stage * 0.6, 5.4 + stage * 0.6); c.fillStyle = A; c.fill(); });
  if (ears === 'ossicones') earPair((s) => { c.strokeStyle = shade(B, -0.3); c.lineWidth = 1.6; c.beginPath(); c.moveTo(s * 2.5, hy - 6); c.lineTo(s * 3, hy - 11 - stage); c.stroke(); c.fillStyle = A; ell(c, s * 3, hy - 11.5 - stage, 1.6, 1.6); c.fill(); c.lineWidth = 1; c.strokeStyle = line; ell(c, s * 8.5, hy - 3, 3, 1.6, s * 0.4); fillS(B); });
  if (ears === 'tuft') { if (sp.id === 'chick') P(() => { c.fillStyle = A; c.beginPath(); c.moveTo(-2, hy - 6); c.lineTo(0, hy - 11 - stage * 2); c.lineTo(1, hy - 8.5); c.lineTo(3, hy - 13 - stage * 2); c.lineTo(3.5, hy - 6); c.closePath(); c.fill(); c.stroke(); }); else earPair((s) => { c.beginPath(); c.moveTo(s * 3.5, hy - 5); c.lineTo(s * 7, hy - 11 - stage); c.lineTo(s * 7.5, hy - 4); c.closePath(); fillS(A); }); }
  if (ears === 'gills') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) P(() => { c.translate(s * 7.5, hy - 1.5 + i * 2.6); c.rotate((s < 0 ? Math.PI : 0) + s * (-0.75 + i * 0.6) + (Math.sin(t * 0.08 + i) * 0.08 + earF) * s); const L = 7.6 + stage * 1.6; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(2, -3.4, L * 0.65, -3.2, L, -1.6); c.quadraticCurveTo(L * 0.8, 0, L, 1.4); c.bezierCurveTo(L * 0.65, 3, 2, 3, 0, 0); fillS(A); c.strokeStyle = shade(A, 0.5); c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 0); c.lineTo(L - 1.3, 0); c.stroke(); });
  if (ex.has('mane')) P(() => { c.fillStyle = A; for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ell(c, Math.cos(a) * (hr + 1), hy + Math.sin(a) * 8.6, 3.4 + stage * 0.5, 3.4 + stage * 0.5); c.fill(); } });
  if (ex.has('wool')) P(() => { c.fillStyle = '#fff'; for (const [a, b] of [[-6, -6], [-2, -8], [2, -8], [6, -6], [0, -9]]) { ell(c, a, hy + b, 3.4, 3); c.fill(); c.stroke(); } });
  // ---------------- head
  if (kind === 'blob') { ell(c, 0, hy, hr * (ex.has('cheeks') ? cheek * 1.05 : ex.has('capyface') ? 1.06 : 1), ex.has('capyface') ? 7.3 : 7.6); const g = c.createRadialGradient(-2, hy - 3, 2, 0, hy, 11); g.addColorStop(0, shade(B, 0.65)); g.addColorStop(0.6, shade(B, 0.25)); g.addColorStop(1, B); fillS(g); }
  if (kind === 'jelly') { c.beginPath(); c.moveTo(-10, hy + 6); c.bezierCurveTo(-10, hy - 10, 10, hy - 10, 10, hy + 6); c.quadraticCurveTo(5, hy + 9, 0, hy + 7); c.quadraticCurveTo(-5, hy + 9, -10, hy + 6); c.globalAlpha = 0.92; const g = c.createRadialGradient(-2, hy - 3, 2, 0, hy, 11); g.addColorStop(0, shade(B, 0.65)); g.addColorStop(1, B); fillS(g); c.globalAlpha = 1; }
  if (ex.has('cheeks')) { c.fillStyle = shade(B, 0.45); ell(c, -6.5, hy + 3, 3.4 * cheek, 2.8 * cheek); c.fill(); ell(c, 7.5, hy + 3, 3.4 * cheek, 2.8 * cheek); c.fill(); }
  if (ex.has('mask')) { c.fillStyle = '#fff6ee'; ell(c, -4.5, hy + 2, 3.4, 2.6); c.fill(); ell(c, 6, hy + 2, 3.4, 2.6); c.fill(); c.fillStyle = shade(B, 0.6); ell(c, 1, hy - 4.5, 1.6, 1.2); c.fill(); }
  if (ex.has('stripes') && kind === 'blob') { c.strokeStyle = A; c.lineWidth = 1.2; for (const a of [-3, 0, 3]) { c.beginPath(); c.moveTo(a + 1, hy - 7.4); c.lineTo(a + 1.4, hy - 4.6); c.stroke(); } for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 9, hy); c.lineTo(s * 6.6, hy + 0.6); c.stroke(); } c.lineWidth = 1; c.strokeStyle = line; }
  if (ex.has('giraffespots')) { c.fillStyle = A; for (const [a, b] of [[-6, -3], [5, -5], [-2, -6]]) { ell(c, a, hy + b, 1.4, 1.1); c.fill(); } }
  if (pal.pattern && pal.pattern !== 'none' && kind !== 'star') P(() => { ell(c, 0, hy, hr - 0.5, 7.1); c.clip(); c.fillStyle = shade(A === '#ffffff' ? B : A, 0.25); c.strokeStyle = c.fillStyle; c.globalAlpha = 0.55;
    if (pal.pattern === 'spots') for (const [a, b, r] of [[-6, -4.5, 1.6], [6.5, -3.5, 1.3], [-7.5, 1.5, 1.1], [7, 2.5, 1.5], [0, -6.5, 1.2]]) { ell(c, a, hy + b, r, r); c.fill(); }
    if (pal.pattern === 'stripes') { c.lineWidth = 1.4; for (const a of [-5, 0, 5]) { c.beginPath(); c.moveTo(a - 1, hy - 8); c.quadraticCurveTo(a + 1, hy - 5, a, hy - 3); c.stroke(); } }
    if (pal.pattern === 'sparkle') { c.globalAlpha = 0.95; c.fillStyle = '#fff'; for (const [a, b, r] of [[-6, -3.5, 1.7], [6, -4.5, 1.4], [-7, 2.5, 1.1], [7.5, 1.5, 1.2]]) { star(c, a, hy + b, r, r * 0.4); c.fill(); } } });
  if (ex.has('horn')) P(() => { c.beginPath(); c.moveTo(-1.6, hy - 6.4); c.lineTo(0.4, hy - 13 - stage * 2); c.lineTo(1.8, hy - 6.4); c.closePath(); fillS('#ffe9a8'); c.strokeStyle = '#d9a640'; c.beginPath(); c.moveTo(-1, hy - 8); c.lineTo(1.4, hy - 9); c.moveTo(-0.4, hy - 10); c.lineTo(1, hy - 10.6); c.stroke(); });
  if (ex.has('horns')) for (const s of [-1, 1]) P(() => { c.beginPath(); c.moveTo(s * 3, hy - 6.5); c.quadraticCurveTo(s * 5, hy - 11 - stage, s * 6.5, hy - 11.5 - stage); c.quadraticCurveTo(s * 5, hy - 8, s * 5.6, hy - 6); c.closePath(); fillS('#fff3d0'); });
  if (ex.has('rainbowmane')) P(() => { ['#ff9fc8', '#ffd34d', '#8fe3b0', '#9fc8ff', '#c9a0ff'].forEach((cc, i) => { c.fillStyle = cc; ell(c, -3 - i * 1.6, hy - 6 + i * 2.4, 2.8, 2.2, 0.5); c.fill(); }); });
  const hatOn = pal.acc === 'crown' || pal.acc === 'hat' || !!(pal.outfit && pal.outfit.head);
  if (ex.has('yuzu') && !hatOn) P(() => { c.translate(-1.2, hy - 8.4 + Math.sin(t * 0.08) * 0.25); c.rotate(-0.12 + (R === 'relax' ? Math.sin(t * 0.1) * 0.12 : 0)); ell(c, 0, 0, 2.7, 2.3); const g = c.createRadialGradient(-0.9, -0.9, 0.3, 0, 0, 2.8); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.55, '#ffb53a'); g.addColorStop(1, '#f08a1c'); c.fillStyle = g; c.strokeStyle = '#b8601a'; c.fill(); c.stroke(); c.fillStyle = '#9a5a1a'; ell(c, 0, -2.1, 0.45, 0.35); c.fill(); c.fillStyle = '#5fbf5a'; c.strokeStyle = '#2f7a3a'; ell(c, 1.4, -2.6, 1.6, 0.75, -0.5); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, -1, -0.9, 0.7, 0.45, -0.5); c.fill(); });
  if (sp.id === 'penguin') { c.fillStyle = '#fbf6ff'; ell(c, 1, hy + 1.4, 7, 5.4); c.fill(); }
  if (ex.has('eyepatch')) { c.fillStyle = A; ell(c, -2.6, hy + 0.2, 2.9, 3.3, 0.4); c.fill(); ell(c, 4.8, hy + 0.2, 2.9, 3.3, -0.4); c.fill(); }
  if (ex.has('frogeyes')) for (const s of [-1, 1]) { ell(c, s * 4 + 1, hy - 6, 3.4, 3.2); fillS(B); }
  // ---------------- face
  const fx = 1.2, ey = ex.has('frogeyes') ? hy - 6 : kind === 'star' ? hy + 1.5 : kind === 'cloud' ? -9 : hy - 0.1;
  c.fillStyle = '#ff9fc8'; c.globalAlpha = ex.has('blush2') ? 0.95 : 0.75; ell(c, fx - 6, (ex.has('frogeyes') ? hy : ey) + 2.5, 1.9, 1.1); c.fill(); ell(c, fx + 6, (ex.has('frogeyes') ? hy : ey) + 2.5, 1.9, 1.1); c.fill(); c.globalAlpha = 1;
  const closed = mode === 'sleep' || (mode === 'happy' && Math.sin(t * 0.4) > 0.6) || (mode === 'idle' && t % 200 < 7) || mode === 'shake' || R === 'roar' || R === 'relax';
  const eyeL = fx - 3.6, eyeR = fx + 3.6; const eyeCol = ex.has('eyepatch') ? '#1a1020' : E;
  if (closed) { c.strokeStyle = ex.has('eyepatch') ? '#fff' : E; c.lineWidth = 1.1; const u = mode === 'happy' || R ? -1.4 : 1; c.beginPath(); c.moveTo(eyeL - 1.5, ey); c.quadraticCurveTo(eyeL, ey + u, eyeL + 1.5, ey); c.moveTo(eyeR - 1.5, ey); c.quadraticCurveTo(eyeR, ey + u, eyeR + 1.5, ey); c.stroke(); }
  else if (ex.has('tinyeyes')) { c.fillStyle = eyeCol; ell(c, eyeL, ey - 0.6, 1.25, 1.45); c.fill(); ell(c, eyeR, ey - 0.6, 1.25, 1.45); c.fill(); c.fillStyle = '#fff'; ell(c, eyeL + 0.45, ey - 1.2, 0.5, 0.5); c.fill(); ell(c, eyeR + 0.45, ey - 1.2, 0.5, 0.5); c.fill(); ell(c, eyeL - 0.4, ey - 0.1, 0.22, 0.22); c.fill(); ell(c, eyeR - 0.4, ey - 0.1, 0.22, 0.22); c.fill(); }
  else { c.fillStyle = eyeCol; ell(c, eyeL, ey, 2, 2.3); c.fill(); ell(c, eyeR, ey, 2, 2.3); c.fill(); c.fillStyle = '#fff'; ell(c, eyeL + 0.6, ey - 0.9, 0.75, 0.75); c.fill(); ell(c, eyeR + 0.6, ey - 0.9, 0.75, 0.75); c.fill(); }
  c.strokeStyle = '#24133f'; c.lineWidth = 0.8;
  const my = (ex.has('frogeyes') ? hy + 1 : ey) + 3; const snout = sp.snout;
  if (snout === 'muzzle') { c.fillStyle = shade(B, 0.6); ell(c, fx, my - 0.4, 3.2, 2.3); c.fill(); }
  if (snout === 'capy') { c.fillStyle = shade(B, -0.1); c.beginPath(); c.roundRect(fx - 5.4, my - 3.6, 10.8, 6, 3); c.fill(); c.fillStyle = shade(B, 0.12); ell(c, fx, my - 1.6, 3.6, 1.4); c.globalAlpha = 0.5; c.fill(); c.globalAlpha = 1;
    c.fillStyle = shade(A, -0.35); c.beginPath(); c.roundRect(fx - 2.8, my - 2.9, 5.6, 2.1, 1.05); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, fx - 0.9, my - 2.2, 0.8, 0.35); c.fill(); }
  if (snout === 'pig') { c.fillStyle = A; ell(c, fx, my - 0.6, 2.8, 2); c.fill(); c.stroke(); c.fillStyle = shade(A, -0.4); ell(c, fx - 1, my - 0.6, 0.5, 0.8); c.fill(); ell(c, fx + 1, my - 0.6, 0.5, 0.8); c.fill(); }
  if (snout === 'beak') { c.fillStyle = A; c.beginPath(); c.moveTo(fx - 1.4, my - 0.8); c.lineTo(fx + 1.4, my - 0.8); c.lineTo(fx, my + 1 + mouthOpen); c.closePath(); c.fill(); }
  if (snout === 'duckbill') { c.fillStyle = A; ell(c, fx + 0.6, my - 0.2, 3.2, 1.3 + mouthOpen * 0.6); c.fill(); c.strokeStyle = shade(A, -0.3); c.stroke(); }
  if (snout === 'trunk') P(() => { c.translate(fx, my - 2); const up = R === 'spray' || R === 'honk' ? -1 : (mode === 'happy' ? -0.5 : 0.15 + Math.sin(t * 0.07) * 0.15); c.rotate(-0.2 * up); c.beginPath(); c.moveTo(-1.8, 0); c.quadraticCurveTo(-2, 5, 2 + up * -1, 6.5 + up * 6); c.lineTo(4 + up * -1, 5.5 + up * 6); c.quadraticCurveTo(1.6, 4, 1.8, 0); c.closePath(); fillS(B);
    if (R === 'spray') { c.fillStyle = '#8fd0ff'; for (let i = 0; i < 6; i++) { const q = ((t * 0.08 + i / 6) % 1); ell(c, 4 + q * 10, 0 - q * 14 + q * q * 12, 1, 1.4); c.fill(); } }
    if (R === 'honk' || R === 'spray') { c.fillStyle = '#6b4fd6'; c.font = 'bold 4px sans-serif'; if (t % 40 < 20) c.fillText('♪', 6, -6); } });
  if (snout === 'nose' || snout === 'muzzle') { c.fillStyle = ex.has('eyepatch') ? '#1a1020' : '#5a2a4a'; ell(c, fx, my - 1.2, 0.95, 0.65); c.fill(); }
  // mouth
  if (snout !== 'beak' && snout !== 'duckbill' && snout !== 'trunk' || snout === 'trunk' && false) {
    if (mouthOpen > 0.1 || R === 'roar') { ell(c, fx, my + 0.6, 1.4, 0.8 + mouthOpen * 1.1); c.fillStyle = '#7a2a4a'; c.fill(); if (R === 'roar' && t % 40 < 26) { c.fillStyle = A; c.font = 'bold 4px sans-serif'; c.fillText('rawr!', 8, hy - 6); } }
    else if (mood.sad && mode !== 'happy' && mode !== 'sleep') { c.beginPath(); c.moveTo(fx - 1.8, my + 1.4); c.quadraticCurveTo(fx, my - 0.2, fx + 1.8, my + 1.4); c.stroke(); c.fillStyle = '#8fd0ff'; ell(c, fx - 5, my, 0.8, 1.2); c.fill(); }
    else { c.beginPath(); c.moveTo(fx - 1.8, my - 0.1); c.quadraticCurveTo(fx - 0.9, my + 1.1, fx, my + 0.1); c.quadraticCurveTo(fx + 0.9, my + 1.1, fx + 1.8, my - 0.1); c.stroke(); }
  } else if (snout === 'trunk' && mood.sad && mode !== 'sleep') { c.fillStyle = '#8fd0ff'; ell(c, fx - 5, my, 0.8, 1.2); c.fill(); }
  if (ex.has('whiskers')) { c.strokeStyle = 'rgba(60,30,60,.55)'; c.lineWidth = 0.5; for (const s of [-1, 1]) for (const d of [-0.6, 0.6]) { c.beginPath(); c.moveTo(fx + s * 3, my - 0.8); c.lineTo(fx + s * 7, my - 0.8 + d * 1.6); c.stroke(); } }
  if (R === 'relax') { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.7; for (let i = 0; i < 3; i++) { const q = ((t * 0.012 + i / 3) % 1); c.globalAlpha = Math.sin(q * Math.PI); const x0 = -6 + i * 6, y0 = hy - 10 - q * 12; c.beginPath(); c.moveTo(x0, y0 + 3); c.bezierCurveTo(x0 + 1.6, y0 + 2, x0 - 1.6, y0 + 1, x0, y0); c.stroke(); } c.globalAlpha = 1; c.fillStyle = '#ff8fb8'; if (t % 90 < 60) { heart(c, 10, hy - 8 - (t % 90) * 0.06, 1.3); c.fill(); } c.lineWidth = 0.8; c.strokeStyle = '#24133f'; }
  if (R === 'flame') { c.fillStyle = '#ffb347'; for (let i = 0; i < 4; i++) { const q = ((t * 0.06 + i / 4) % 1); c.globalAlpha = 1 - q; ell(c, fx + 4 + q * 9, my - q * 3, 1.2 + q * 1.5, 1 + q * 1.2); c.fill(); } c.globalAlpha = 1; }
  if (R === 'bubbles' || (mode === 'happy' && sp.id === 'jelly')) for (let i = 0; i < 3; i++) { const q = ((t * 0.02 + i / 3) % 1); drawBubble(c, fx + 6 + Math.sin(q * 9) * 2, hy - q * 16, 1.4 + i * 0.4); }
  if (R === 'sparkle' || ex.has('sparkles') && mode !== 'sleep') { c.fillStyle = '#ffd34d'; for (let i = 0; i < 4; i++) { const a = t * 0.05 + i * TAU / 4; star(c, Math.cos(a) * 15, hy + Math.sin(a) * 9, 1.4 + (i % 2) * 0.6); c.fill(); } }
  // ---------------- mood overlays + accessories
  if (mood.dirty) { c.fillStyle = 'rgba(120,80,50,.75)'; for (const [a, b, r] of [[-5, -7, 1.8], [4, -4, 1.4], [6, hy - 2.5, 1.5], [-7, hy - 1.5, 1.2], [1, -2.5, 1]]) { ell(c, a, b, r * 1.3, r); c.fill(); } }
  if (mood.bandage) P(() => { c.translate(-5, hy - 5.5); c.rotate(-0.5); c.fillStyle = '#ffe1c4'; c.strokeStyle = '#c99b74'; c.beginPath(); c.roundRect(-3.5, -1.2, 7, 2.4, 1.2); c.fill(); c.stroke(); });
  const a = pal.acc, top = ears === 'long' || ears === 'big' ? hy - 7.6 : hy - 7;
  if (a === 'bow') { c.fillStyle = '#ff6fae'; c.strokeStyle = '#a3306a'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4, top); c.lineTo(4 + s * 4, top - 3); c.lineTo(4 + s * 4, top + 3); c.closePath(); c.fill(); c.stroke(); } ell(c, 4, top, 1.3, 1.3); c.fill(); c.stroke(); }
  if (a === 'crown') { c.fillStyle = '#ffd34d'; c.strokeStyle = '#a8700f'; c.beginPath(); c.moveTo(-4, top + 1); c.lineTo(-4, top - 4); c.lineTo(-2, top - 1.5); c.lineTo(0, top - 5); c.lineTo(2, top - 1.5); c.lineTo(4, top - 4); c.lineTo(4, top + 1); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#b26bff'; ell(c, 0, top - 0.5, 0.9, 0.9); c.fill(); }
  if (a === 'shades') { c.fillStyle = '#2a1458'; c.strokeStyle = '#ffd34d'; c.lineWidth = 0.7; star(c, eyeL, ey, 3); c.fill(); c.stroke(); star(c, eyeR, ey, 3); c.fill(); c.stroke(); c.beginPath(); c.moveTo(fx - 1, ey - 0.5); c.lineTo(fx + 1, ey - 0.5); c.stroke(); }
  if (a === 'scarf') { c.fillStyle = '#ff7a8a'; c.strokeStyle = '#a3304a'; c.beginPath(); c.roundRect(-6.5, hy + 4.9, 13, 3, 1.5); c.fill(); c.stroke(); c.beginPath(); c.roundRect(2, hy + 6.5, 3, 6, 1.2); c.fill(); c.stroke(); }
  if (a === 'hat') { c.fillStyle = '#6b4fd6'; c.strokeStyle = '#2a1458'; ell(c, 0, top + 0.5, 7, 1.6); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-4, top - 6, 8, 6.5, 1.5); c.fill(); c.stroke(); c.fillStyle = '#ffd34d'; c.fillRect(-4, top - 1.5, 8, 1.4); }
  if (a === 'badge') { c.fillStyle = '#8a2be2'; c.strokeStyle = '#ffd34d'; ell(c, 3, -6, 2.8, 2.8); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 2.6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KL', 3, -5.9); }
  if (armKind === 'paw') P(() => drawArms(c, RG, { B, dark, line, light, bodyG, sp, ex }));
  drawWear(c, 'head', pal.outfit, { ...WG(), top, ey, eyeL, eyeR, fx });
  if (stage === 2 && a !== 'crown' && a !== 'hat' && !(pal.outfit && pal.outfit.head)) { c.fillStyle = '#ffd34d'; star(c, -5, top - 1, 1.6 + Math.sin(t * 0.08) * 0.3); c.fill(); }
  c.restore();
  if (mode === 'sleep') { c.save(); c.fillStyle = '#c9b8ff'; c.font = `bold ${7 * k}px sans-serif`; for (let i = 0; i < 3; i++) { const p = ((t * 0.01 + i / 3) % 1); c.globalAlpha = 1 - p; c.fillText('z', x + (8 + p * 10) * k, y - (26 + p * 14) * k); } c.restore(); }
}

// ---------------------------------------------------------------- rig
// Joint angles in degrees. Arms: s = shoulder (0 down, 90 out, 180 up), e = elbow bend (+ folds the hand in).
// Legs: h = hip swing (+ forward), k = knee bend. st.rig = { aL, aR, eL, eR } overrides (dances).
export function rigPose(mode, t, o, leg = 0) {
  const r = { sL: 14, sR: 14, eL: 18, eR: 18, hL: 0, hR: 0, kL: 4, kR: 4 };
  const w = Math.sin(t * 0.06);
  if (mode === 'idle') { r.sL = 13 + w * 3; r.sR = 13 - w * 3; r.eL = r.eR = 20 + w * 4; }
  else if (mode === 'walk') { const p = Math.sin(t * 0.35); r.hL = p * 26; r.hR = -p * 26; r.kL = Math.max(0, -p) * 40 + 4; r.kR = Math.max(0, p) * 40 + 4; r.sL = 16 - p * 14; r.sR = 16 + p * 14; r.eL = r.eR = 32; }
  else if (mode === 'wave') { r.sL = 14; r.eL = 20; r.sR = 105; r.eR = -(62 + Math.sin(t * 0.45) * 28); }
  else if (mode === 'hop' || mode === 'jump') { const a = Math.abs(Math.sin(t * 0.18)); r.sL = r.sR = 40 + a * 110; r.eL = r.eR = 20; r.hL = r.hR = a * 22; r.kL = r.kR = 10 + a * 55; }
  else if (mode === 'happy') { const a = Math.sin(t * 0.4); r.sL = 130 + a * 22; r.sR = 130 - a * 22; r.eL = r.eR = 15; r.kL = r.kR = 8; }
  else if (mode === 'sleep') { r.sL = r.sR = 22; r.eL = r.eR = 105; }
  else if (mode === 'eat') { r.sL = 18; r.sR = 38; r.eR = 118 + Math.sin(t * 0.5) * 8; }
  else if (mode === 'shake') { const a = Math.sin(t * 1.3); r.sL = 30 + a * 15; r.sR = 30 - a * 15; }
  if (o) { if (o.aL != null) { r.sL = o.aL; r.eL = o.eL ?? 14; } if (o.aR != null) { r.sR = o.aR; r.eR = o.eR ?? 14; } if (o.hL != null) r.hL = o.hL; if (o.hR != null) r.hR = o.hR; if (o.kL != null) r.kL = o.kL; if (o.kR != null) r.kR = o.kR; }
  return r;
}
const D2R = Math.PI / 180;
function limb(c, x0, y0, x1, y1, x2, y2, w, col, line) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = line; c.lineWidth = w + 1.1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}
function drawArms(c, R, { B, line, light, bodyG, sp, ex }) {
  const shY = -6.9 * bodyG, shX = 5.5 * bodyG, L1 = 3.3 * bodyG, L2 = 3.1 * bodyG;
  for (const s of [-1, 1]) {
    const a = (s < 0 ? R.sL : R.sR) * D2R, e = (s < 0 ? R.eL : R.eR) * D2R, a2 = a - e;
    const x0 = s * shX, y0 = shY, x1 = x0 + s * Math.sin(a) * L1, y1 = y0 + Math.cos(a) * L1, x2 = x1 + s * Math.sin(a2) * L2, y2 = y1 + Math.cos(a2) * L2;
    limb(c, x0, y0, x1, y1, x2, y2, 2.5 * bodyG, B, line);
    // hand / paw with little fingers (frogs get round finger tips)
    c.fillStyle = B; c.strokeStyle = line; c.lineWidth = 0.8; ell(c, x2, y2, 1.55 * bodyG, 1.45 * bodyG); c.fill(); c.stroke();
    const dx = s * Math.sin(a2), dy = Math.cos(a2);
    if (sp.id === 'frog') { c.fillStyle = light; for (const q of [-0.6, 0, 0.6]) { ell(c, x2 + (dx * Math.cos(q) - dy * Math.sin(q) * s) * 1.7, y2 + (dy * Math.cos(q) + dx * Math.sin(q) * s) * 1.7, 0.55, 0.55); c.fill(); } }
    else { c.strokeStyle = line; c.lineWidth = 0.45; for (const q of [-0.45, 0, 0.45]) { const ux = dx * Math.cos(q) - dy * Math.sin(q), uy = dy * Math.cos(q) + dx * Math.sin(q); c.beginPath(); c.moveTo(x2 + ux * 0.7, y2 + uy * 0.7); c.lineTo(x2 + ux * 1.45, y2 + uy * 1.45); c.stroke(); } }
  }
  c.lineWidth = 1; c.strokeStyle = line;
}
function drawLegs(c, R, { B, dark, line, light, feet, bodyG, legH }) {
  const hipY = -1.6, hipX = 3.1 * bodyG, L = (legH - hipY) / 2 + 0.15, out = [];
  for (const s of [-1, 1]) {
    const h = (s < 0 ? R.hL : R.hR) * D2R, k = (s < 0 ? R.kL : R.kR) * D2R;
    const x0 = s * hipX, y0 = hipY, x1 = x0 + Math.sin(h) * L, y1 = y0 + Math.cos(h) * L, x2 = x1 + Math.sin(h - k) * L, y2 = Math.min(legH, y1 + Math.cos(h - k) * L);
    limb(c, x0, y0, x1, y1, x2, y2, 2.9 * bodyG, B, line);
    c.lineWidth = 0.9; c.strokeStyle = line;
    if (feet === 'webbed') { c.fillStyle = '#ffa53a'; c.strokeStyle = '#a8600f'; c.beginPath(); c.moveTo(x2 - 0.6, y2 - 0.6); c.lineTo(x2 - 1.4, y2 + 0.5); c.lineTo(x2 + 3.4, y2 + 0.5); c.closePath(); c.fill(); c.stroke(); }
    else if (feet === 'flippers') { c.fillStyle = dark; ell(c, x2 + 1, y2, 3.2, 1.2, 0.15); c.fill(); c.stroke(); }
    else { c.fillStyle = dark; ell(c, x2 + 0.7, y2 - 0.3, 2.3, 1.35); c.fill(); c.stroke(); c.fillStyle = light; for (const q of [-1, 0, 1]) { ell(c, x2 + 1.9 + q * 0.15, y2 - 0.35 + q * 0.75, 0.42, 0.42); c.fill(); } ell(c, x2 + 0.3, y2 - 0.25, 0.8, 0.6); c.fill(); }
    out.push({ x: x2 + 0.4, y: y2 + 0.2, r: 0 });
  }
  c.lineWidth = 1; c.strokeStyle = line; return out;
}
if (typeof window !== 'undefined') setTimeout(() => { import('./dance.js').catch(() => {}); }, 800); // loads the 3D renderer on capable devices
