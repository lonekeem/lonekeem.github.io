// Human-style dance clips for 3D Pals, keyframed from human dance reference (no audio, no copied choreography).
// Pose format (radians for body, degrees for limbs): hx/hy/hz hip offset, hrx/hry/hrz hip rotation, sx..sz spine,
// cx..cz chest, nx/ny/nz head, aL/aR = [abduct°, forward°, elbow°, twist°], lL/lR = [lift°, spread°, extraKnee°],
// ry whole-body turn. Every clip gets a natural groove layer: a knee bounce on the beat, hip/chest counter-rotation
// and weight shift toward the supporting leg; the rig adds follow-through on head, ears and tail.
// grooveLayer comes from motion3d.js (three.js) when a 3D Pal loads, so 2D Pal code never pulls three.js
let grooveLayer = null;
export function setGroove(fn) { grooveLayer = fn; }
const M = (p) => { const o = { ...p }; for (const [a, b] of [['aL', 'aR'], ['lL', 'lR']]) { o[a] = p[b]; o[b] = p[a]; } for (const k of ['hx', 'hrz', 'hry', 'cz', 'cy', 'nz', 'ny', 'sz', 'ry']) if (o[k]) o[k] = -o[k]; return o; }; // mirror
const N = { aL: [24, 6, 14], aR: [24, 6, 14] };
const K = (beats, keys, o = {}) => ({ beats, keys, ...o });
export const DANCES3D = {
  // ---------- basics
  bounce: K(1, [{ hy: -0.1, aL: [25, 20, 40], aR: [25, 20, 40], nx: 0.1 }, { hy: 0.02, aL: [30, 10, 30], aR: [30, 10, 30], nx: -0.05 }]),
  groove: K(2, [{ hx: -0.08, hrz: 0.08, hy: -0.06, aL: [30, 30, 70], aR: [20, -10, 40], lR: [10, 8, 15] }, { hy: -0.02 }, null, null], { mirror: 1 }),
  twirl: K(2, [{ ry: 0, aL: [60, 0, 30], aR: [60, 0, 30] }, { ry: Math.PI, hy: 0.05, aL: [150, 0, 20], aR: [150, 0, 20] }, { ry: Math.PI * 2, aL: [60, 0, 30], aR: [60, 0, 30] }], { ease: 'spin' }),
  finwave: K(1, [{ aL: [160, 0, 20], aR: [70, 0, 60], hrz: 0.06, nz: -0.1 }, { aL: [70, 0, 60], aR: [160, 0, 20], hrz: -0.06, nz: 0.1 }]),
  hula: K(2, [{ hx: -0.1, hrz: 0.12, cz: -0.1, aL: [72, 25, 45], aR: [60, 30, 55], hy: -0.05 }, { hx: 0.1, hrz: -0.12, cz: 0.1, aL: [60, 30, 55], aR: [72, 25, 45], hy: -0.05 }], { gentle: 1 }),
  beepboop: K(2, [{ aL: [90, 0, 90], aR: [10, 0, 0], ny: 0.4 }, { aL: [10, 0, 0], aR: [90, 0, 90], ny: -0.4 }, { aL: [90, 0, 90], aR: [90, 0, 90], hy: -0.04 }, { ...N, ny: 0 }], { ease: 'snap' }),
  hopclap: K(2, [{ hy: -0.14, aL: [30, 30, 40], aR: [30, 30, 40] }, { hy: 0.32, aL: [160, 10, 10], aR: [160, 10, 10], lL: [20, 5, 40], lR: [20, 5, 40] }, { hy: 0.3, aL: [172, 15, 5], aR: [172, 15, 5], lL: [20, 5, 40], lR: [20, 5, 40] }, { hy: -0.12, aL: [40, 40, 90], aR: [40, 40, 90] }]),
  shoulder: K(1, [{ aL: [40, 10, 100], aR: [30, 10, 100], cz: 0.1, hy: -0.05, nz: -0.08 }, { aL: [30, 10, 100], aR: [40, 10, 100], cz: -0.1, hy: -0.05, nz: 0.08 }]),
  glide: K(4, [{ hx: 0.3, lL: [0, 0, 40] }, { hx: 0.1, lR: [0, 0, 40] }, { hx: -0.1, lL: [0, 0, 40] }, { hx: -0.3, lR: [0, 0, 40] }], { ease: 'linear', mirrorBack: 1, slide: 1 }),
  ripple: K(2, [{ aL: [100, 0, 10], aR: [80, 0, 70], cz: 0.12, hrz: -0.06 }, { aL: [90, 0, 40], aR: [90, 0, 40], cz: 0, hy: -0.06 }, { aL: [80, 0, 70], aR: [100, 0, 10], cz: -0.12, hrz: 0.06 }, { aL: [90, 0, 40], aR: [90, 0, 40], hy: -0.06 }]),
  bodyroll: K(2, [{ cx: -0.2, nx: -0.2, hy: 0 }, { cx: 0.2, sx: 0.1, nx: 0.2, hy: -0.08, hz: 0.06 }, { cx: 0.05, sx: -0.15, hz: -0.06, hy: -0.12, hrx: -0.15 }, { cx: -0.1 }]),
  freeze: K(4, [N, { hy: 0.1, hrz: -0.15, aL: [165, 10, 5], aR: [70, -20, 30], lR: [45, 20, 70], nz: -0.2, star: 1 }, { hy: 0.1, hrz: -0.15, aL: [165, 10, 5], aR: [70, -20, 30], lR: [45, 20, 70], nz: -0.2 }, { hy: 0.1, hrz: -0.15, aL: [165, 10, 5], aR: [70, -20, 30], lR: [45, 20, 70], nz: -0.2 }], { ease: 'snap' }),
  // ---------- Trending (classic named moves, Pal-adapted)
  dab: K(4, [{ hy: -0.06, aL: [30, 20, 50], aR: [30, 20, 50] }, { hx: -0.06, hrz: 0.06, cz: -0.15, nx: 0.5, nz: -0.35, ny: -0.35, aR: [135, 70, 125], aL: [150, -10, 0], star: 1 }, { hx: -0.06, hrz: 0.06, cz: -0.15, nx: 0.5, nz: -0.35, ny: -0.35, aR: [135, 70, 125], aL: [150, -10, 0] }, { hy: -0.06, aL: [30, 20, 50], aR: [30, 20, 50] }], { ease: 'snap', mirror: 1 }),
  woah: K(2, [{ aL: [45, 45, 100], aR: [45, 45, 100], hy: -0.02 }, { hy: -0.15, hrz: 0.1, hry: 0.25, ny: 0.35, aL: [75, 25, 55], aR: [30, 55, 105], lL: [0, 6, 10] }], { ease: 'snap', mirror: 1 }),
  griddy: K(2, [{ hy: -0.07, hx: 0.04, lL: [35, 0, 65], aL: [40, 35, 115], aR: [45, -25, 60], nx: 0.1 }, { hy: -0.03 }], { mirror: 1, ease: 'smooth' }),
  runman: K(2, [{ hy: -0.05, lL: [55, 0, 70], lR: [-12, 0, 12], aL: [20, 55, 90], aR: [20, -35, 60], cx: 0.1 }, { hy: -0.12, lL: [5, 0, 30], aL: [20, 0, 80], aR: [20, 0, 80] }], { mirror: 1 }),
  shuffle: K(1, [{ hx: 0.07, hry: 0.2, hy: -0.06, lL: [18, 25, 25], aL: [25, 25, 70], aR: [25, -15, 50] }, { hy: -0.02 }], { mirror: 1, ease: 'snap' }),
  robot: K(4, [{ aL: [90, 0, 90], aR: [15, 0, 0], ny: 0.5 }, { aL: [90, 0, 90], aR: [90, 0, 90], ny: 0 }, { aL: [15, 0, 0], aR: [90, 0, 90], ny: -0.5, hry: -0.15 }, { aL: [90, 60, 90], aR: [90, 60, 90], hy: -0.05 }], { ease: 'snap' }),
  moonwalk: K(4, [{ hx: 0.35, lL: [0, 0, 45], aL: [20, -10, 30], aR: [20, 10, 30], ry: -0.6 }, { hx: 0.12, lR: [0, 0, 45], ry: -0.6 }, { hx: -0.12, lL: [0, 0, 45], ry: -0.6 }, { hx: -0.35, lR: [0, 0, 45], ry: -0.6 }], { ease: 'linear', slide: 1 }),
  sprinkler: K(4, [{ aL: [150, -20, 150], aR: [90, -40, 5], hry: -0.3, lR: [0, 10, 20] }, { aL: [150, -20, 150], aR: [90, -10, 5], hry: -0.15 }, { aL: [150, -20, 150], aR: [90, 20, 5], hry: 0 }, { aL: [150, -20, 150], aR: [90, 50, 5], hry: 0.2 }], { ease: 'snap', back: 1 }),
  wave: K(4, [{ aL: [100, 0, 0], aR: [80, 0, 60], cz: 0.1 }, { aL: [90, 0, 30], aR: [90, 0, 30], cz: 0.05, nz: 0.1, hy: -0.04 }, { aL: [80, 0, 60], aR: [100, 0, 0], cz: -0.1, nz: -0.1 }, { aL: [90, 0, 30], aR: [90, 0, 30], hrz: 0.1, hy: -0.04 }]),
  cabbage: K(2, [{ hx: -0.06, hy: -0.06, hrz: 0.08, aL: [35, 70, 105], aR: [30, 55, 115] }, { hx: 0, hy: -0.12, aL: [40, 85, 95], aR: [40, 85, 95] }, { hx: 0.06, hy: -0.06, hrz: -0.08, aL: [30, 55, 115], aR: [35, 70, 105] }, { hy: 0, aL: [35, 60, 110], aR: [35, 60, 110] }], { ease: 'smooth' }),
  shoot: K(2, [{ hy: 0.06, lL: [55, 0, 85], aR: [30, 80, 10], aL: [25, -30, 40], cx: 0.1 }, { hy: -0.06, lL: [20, 0, 40], aR: [25, 40, 60], aL: [25, 0, 40] }], { mirror: 1 }),
  quan: K(4, [{ cx: -0.15, hy: -0.08, hrz: 0.1, aL: [60, 30, 90], aR: [55, 35, 95], nz: 0.1 }, { cx: -0.25, hy: -0.12, hrz: -0.05, aL: [70, 50, 80], aR: [70, 50, 80], nx: -0.15 }, { cx: -0.15, hy: -0.08, hrz: -0.1, aL: [55, 35, 95], aR: [60, 30, 90], nz: -0.1 }, { cx: 0, hy: -0.05, aL: [40, 20, 100], aR: [40, 20, 100] }], { ease: 'smooth' }),
  // ---------- Classics
  twist: K(2, [{ hy: -0.12, hry: 0.5, cy: -0.7, aL: [50, 40, 95], aR: [45, -10, 80], lL: [8, 0, 10] }, { hy: -0.14, hry: -0.5, cy: 0.7, aL: [45, -10, 80], aR: [50, 40, 95], lR: [8, 0, 10] }]),
  discopoint: K(4, [{ hrz: 0.1, hx: -0.06, aR: [150, 20, 30], aL: [30, 30, 100], nz: 0.15, ny: 0.3 }, { hrz: -0.06, hx: 0.06, aR: [25, 45, 45, 20], aL: [30, 30, 100], nz: -0.1, ny: -0.3 }], { mirror: 1 }),
  charleston: K(2, [{ lL: [40, 0, 55], hx: 0.05, aL: [60, -35, 50], aR: [60, 40, 50], hy: -0.05 }, { lL: [-22, 0, 55], hx: 0.04, aL: [60, 40, 50], aR: [60, -35, 50], hy: -0.08, cx: 0.12 }], { mirror: 1 }),
  handjive: K(4, [{ aL: [30, 55, 110], aR: [30, 55, 110], hy: -0.1, cx: 0.15 }, { aL: [35, 75, 95], aR: [35, 75, 95], hy: -0.06 }, { aL: [40, 70, 120, 30], aR: [30, 60, 90], hy: -0.08 }, { aL: [30, 60, 90], aR: [40, 70, 120, 30], hy: -0.06 }]),
  // ---------- Trending (more)
  thumbsup: K(2, [{ aL: [55, 65, 120, 20], aR: [40, 40, 110], hx: -0.04, hrz: 0.05, ny: -0.15 }, { aL: [40, 40, 110], aR: [55, 65, 120, 20], hx: 0.04, hrz: -0.05, ny: 0.15 }]),
  funkstep: K(1, [{ lL: [32, 0, 50], hy: -0.08, cz: 0.12, aL: [45, 20, 95], aR: [35, 10, 80] }, { lR: [32, 0, 50], hy: -0.08, cz: -0.12, aL: [35, 10, 80], aR: [45, 20, 95] }]),
  backstage: K(2, [{ hx: -0.08, hrz: 0.1, aL: [32, 25, 65], aR: [26, 10, 50], nz: 0.1, hy: -0.07 }, { hx: 0.08, hrz: -0.1, aL: [26, 10, 50], aR: [32, 25, 65], nz: -0.1, hy: -0.07 }], { gentle: 1 }),
  happyshimmy: K(1, [{ cz: 0.14, cy: 0.2, aL: [60, 40, 100], aR: [55, 35, 105], hy: -0.06, nz: -0.12 }, { cz: -0.14, cy: -0.2, aL: [55, 35, 105], aR: [60, 40, 100], hy: -0.04, nz: 0.12 }]),
  slowmo: K(4, [{ lL: [38, 0, 45], aL: [25, -40, 40], aR: [25, 45, 50], cx: -0.08, nx: -0.1, hy: -0.03 }, { lR: [38, 0, 45], aL: [25, 45, 50], aR: [25, -40, 40], cx: -0.08, hy: -0.03 }], { ease: 'smooth', mirror: 0 }),
  clappop: K(2, [{ aL: [38, 80, 95], aR: [38, 80, 95], hy: -0.08 }, { aL: [150, 5, 35], aR: [60, -15, 75], hy: 0.04, hrz: -0.1, nz: -0.15, star: 1 }]),
  // ---------- Trending (Oct 2026), signature moves simplified
  countshrug: K(2, [{ aL: [30, 60, 95, 40], aR: [25, 55, 85, 40], hy: -0.04, cz: 0.08, nz: -0.1 }, { aL: [25, 55, 85, 40], aR: [30, 60, 95, 40], hy: -0.04, cz: -0.08, nz: 0.1 }, { aL: [45, 40, 100, 60], aR: [45, 40, 100, 60], hy: 0.02, cx: -0.05 }, { aL: [30, 60, 90, 40], aR: [30, 60, 90, 40] }]),
  knockhop: K(2, [{ aR: [35, 80, 120], aL: [20, 10, 30], hy: -0.05 }, { aR: [35, 80, 80], hy: -0.03 }, { aR: [35, 80, 120], hy: 0.15, lL: [25, 0, 40], lR: [25, 0, 40] }, { aR: [35, 80, 80], hy: -0.08 }]),
  powerhits: K(2, [{ aL: [170, 10, 5], aR: [40, 20, 120], hy: -0.08, hrz: 0.08 }, { aL: [40, 20, 120], aR: [170, 10, 5], hy: -0.08, hrz: -0.08 }, { aL: [90, 60, 0], aR: [90, 60, 0], hy: 0, cx: -0.1, star: 1 }, { ...N, hy: -0.1 }], { ease: 'snap' }),
  linestep: K(4, [{ hx: 0.12, lR: [10, 15, 20], aL: [25, 20, 60], aR: [25, 20, 60] }, { hx: 0.2, lL: [15, -10, 30] }, { hx: 0.12, lR: [10, 15, 20] }, { hx: 0.04, aL: [30, 70, 110], aR: [30, 70, 110], hy: -0.04, star: 1 }], { mirror: 1 }),
  posesway: K(2, [{ hx: -0.1, hrz: 0.14, aL: [60, -10, 125], aR: [160, 5, 80], nz: 0.15, hy: -0.04 }, { hx: 0.1, hrz: -0.14, aL: [60, -10, 125], aR: [160, 5, 80], nz: -0.05, hy: -0.04 }], { ease: 'smooth', mirrorEvery: 2 }),
};
const N0 = [24, 6, 14, 0];
// limbs never lock straight: elbows keep a soft bend, side-raised arms bend more (no stiff T-pose frames)
function natural(p) {
  for (const k of ['aL', 'aR']) { const a = p[k] || N0; const ab = Math.min(165, a[0]); let el = Math.max(22, Math.min(150, a[2])); let fw = a[1]; if (ab > 60 && ab < 130) { const k2 = 1 - Math.abs(ab - 95) / 35; el = Math.max(el, 38 + 22 * k2); fw = Math.max(fw, 14 * k2); } p[k] = [ab, fw, el, a[3] || 0]; }
  return p;
}
const cr = (p0, p1, p2, p3, k) => { const k2 = k * k, k3 = k2 * k; return 0.5 * (2 * p1 + (-p0 + p2) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (-p0 + 3 * p1 - 3 * p2 + p3) * k3); };
const val = (o, key, i) => { const v = o[key]; if (Array.isArray(v) || key[0] === 'a' && key.length === 2 || key[0] === 'l' && key.length === 2) return (v || (key[0] === 'a' ? N0 : [0, 0, 0, 0]))[i] || 0; return v || 0; };
const LIMB = new Set(['aL', 'aR', 'lL', 'lR']);
function curve(a, b, c, d, k) {
  const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c), ...Object.keys(d)])) {
    if (key === 'star' || key === 'tx') { o[key] = k < 0.5 ? b[key] : c[key]; continue; }
    if (LIMB.has(key)) o[key] = [0, 1, 2, 3].map((i) => cr(val(a, key, i), val(b, key, i), val(c, key, i), val(d, key, i), k));
    else o[key] = cr(val(a, key), val(b, key), val(c, key), val(d, key), k);
  }
  return o;
}
const smooth = (k) => k * k * (3 - 2 * k);
const compiled = {};
function compile(id) {
  const d = DANCES3D[id] || DANCES3D.groove; let keys = d.keys.map((k, i) => k || (i ? { ...N, hy: -0.03 } : N));
  if (d.mirror) keys = [...keys, ...keys.map(M)];
  return { ...d, keys: keys.map((k) => natural({ ...N, ...k })), beats: d.mirror ? d.beats * 2 : d.beats };
}
export function register3D(id, d) { if (!DANCES3D[id]) DANCES3D[id] = { ease: 'smooth', ...d }; delete compiled[id]; }
export const has3D = (id) => !!DANCES3D[id];
// returns (beat) -> pose. Keys flow through a Catmull-Rom curve (no snapping); `linear` clips (spins/glides) stay linear.
export function clipFor(id) {
  const d = compiled[id] || (compiled[id] = compile(id));
  return (beat) => {
    const n = d.keys.length, ph = (((beat % d.beats) + d.beats) % d.beats) / d.beats * n, i = Math.floor(ph), f = ph - i;
    const K4 = (j) => d.keys[((j % n) + n) % n];
    const p = d.ease === 'linear' ? curve(K4(i), K4(i), K4(i + 1), K4(i + 1), f) : d.ease === 'spin' ? curve(K4(i), K4(i), K4(i + 1), K4(i + 1), f * 0.4 + smooth(f) * 0.6) : curve(K4(i - 1), K4(i), K4(i + 1), K4(i + 2), smooth(f) * 0.35 + f * 0.65);
    // groove layer (motion3d.js): knee bounce on the beat, weight shifts with hip sway, chest isolations, shoulder
    // rolls and head nods/tilts/looks; IK keeps the planted feet locked while the body moves over them
    if (grooveLayer) grooveLayer(p, beat, d.gentle ? 0.6 : d.ease === 'snap' ? 0.8 : 1, (id.length % 5) * 0.7);
    if (d.slide) p.slide = 1;
    p.tw = 0.25; return natural(p);
  };
}
