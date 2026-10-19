// Human-style dance clips for 3D Pals, keyframed from human dance reference (no audio, no copied choreography).
// Pose format (radians for body, degrees for limbs): hx/hy/hz hip offset, hrx/hry/hrz hip rotation, sx..sz spine,
// cx..cz chest, nx/ny/nz head, aL/aR = [abduct°, forward°, elbow°, twist°], lL/lR = [lift°, spread°, extraKnee°],
// ry whole-body turn. Every clip gets a natural groove layer: a knee bounce on the beat, hip/chest counter-rotation
// and weight shift toward the supporting leg; the rig adds follow-through on head, ears and tail.
const M = (p) => { const o = { ...p }; for (const [a, b] of [['aL', 'aR'], ['lL', 'lR']]) { o[a] = p[b]; o[b] = p[a]; } for (const k of ['hx', 'hrz', 'hry', 'cz', 'cy', 'nz', 'ny', 'sz', 'ry']) if (o[k]) o[k] = -o[k]; return o; }; // mirror
const N = { aL: [24, 6, 14], aR: [24, 6, 14] };
const K = (beats, keys, o = {}) => ({ beats, keys, ...o });
export const DANCES3D = {
  // ---------- basics
  bounce: K(1, [{ hy: -0.1, aL: [25, 20, 40], aR: [25, 20, 40], nx: 0.1 }, { hy: 0.02, aL: [30, 10, 30], aR: [30, 10, 30], nx: -0.05 }]),
  groove: K(2, [{ hx: -0.08, hrz: 0.08, hy: -0.06, aL: [30, 30, 70], aR: [20, -10, 40], lR: [10, 8, 15] }, { hy: -0.02 }, null, null], { mirror: 1 }),
  twirl: K(2, [{ ry: 0, aL: [60, 0, 30], aR: [60, 0, 30] }, { ry: Math.PI, hy: 0.05, aL: [150, 0, 20], aR: [150, 0, 20] }, { ry: Math.PI * 2, aL: [60, 0, 30], aR: [60, 0, 30] }], { ease: 'linear' }),
  finwave: K(1, [{ aL: [160, 0, 20], aR: [70, 0, 60], hrz: 0.06, nz: -0.1 }, { aL: [70, 0, 60], aR: [160, 0, 20], hrz: -0.06, nz: 0.1 }]),
  hula: K(2, [{ hx: -0.1, hrz: 0.12, cz: -0.1, aL: [95, 0, 30], aR: [80, 0, 40], hy: -0.05 }, { hx: 0.1, hrz: -0.12, cz: 0.1, aL: [80, 0, 40], aR: [95, 0, 30], hy: -0.05 }], { gentle: 1 }),
  beepboop: K(2, [{ aL: [90, 0, 90], aR: [10, 0, 0], ny: 0.4 }, { aL: [10, 0, 0], aR: [90, 0, 90], ny: -0.4 }, { aL: [90, 0, 90], aR: [90, 0, 90], hy: -0.04 }, { ...N, ny: 0 }], { ease: 'snap' }),
  hopclap: K(2, [{ hy: -0.14, aL: [30, 30, 40], aR: [30, 30, 40] }, { hy: 0.32, aL: [160, 10, 10], aR: [160, 10, 10], lL: [20, 5, 40], lR: [20, 5, 40] }, { hy: 0.3, aL: [172, 15, 5], aR: [172, 15, 5], lL: [20, 5, 40], lR: [20, 5, 40] }, { hy: -0.12, aL: [40, 40, 90], aR: [40, 40, 90] }]),
  shoulder: K(1, [{ aL: [40, 10, 100], aR: [30, 10, 100], cz: 0.1, hy: -0.05, nz: -0.08 }, { aL: [30, 10, 100], aR: [40, 10, 100], cz: -0.1, hy: -0.05, nz: 0.08 }]),
  glide: K(4, [{ hx: 0.3, lL: [0, 0, 40] }, { hx: 0.1, lR: [0, 0, 40] }, { hx: -0.1, lL: [0, 0, 40] }, { hx: -0.3, lR: [0, 0, 40] }], { ease: 'linear', mirrorBack: 1 }),
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
  moonwalk: K(4, [{ hx: 0.35, lL: [0, 0, 45], aL: [20, -10, 30], aR: [20, 10, 30], ry: -0.6 }, { hx: 0.12, lR: [0, 0, 45], ry: -0.6 }, { hx: -0.12, lL: [0, 0, 45], ry: -0.6 }, { hx: -0.35, lR: [0, 0, 45], ry: -0.6 }], { ease: 'linear' }),
  sprinkler: K(4, [{ aL: [150, -20, 150], aR: [90, -40, 5], hry: -0.3, lR: [0, 10, 20] }, { aL: [150, -20, 150], aR: [90, -10, 5], hry: -0.15 }, { aL: [150, -20, 150], aR: [90, 20, 5], hry: 0 }, { aL: [150, -20, 150], aR: [90, 50, 5], hry: 0.2 }], { ease: 'snap', back: 1 }),
  wave: K(4, [{ aL: [100, 0, 0], aR: [80, 0, 60], cz: 0.1 }, { aL: [90, 0, 30], aR: [90, 0, 30], cz: 0.05, nz: 0.1, hy: -0.04 }, { aL: [80, 0, 60], aR: [100, 0, 0], cz: -0.1, nz: -0.1 }, { aL: [90, 0, 30], aR: [90, 0, 30], hrz: 0.1, hy: -0.04 }]),
  cabbage: K(2, [{ hx: -0.06, hy: -0.06, hrz: 0.08, aL: [35, 70, 105], aR: [30, 55, 115] }, { hx: 0, hy: -0.12, aL: [40, 85, 95], aR: [40, 85, 95] }, { hx: 0.06, hy: -0.06, hrz: -0.08, aL: [30, 55, 115], aR: [35, 70, 105] }, { hy: 0, aL: [35, 60, 110], aR: [35, 60, 110] }], { ease: 'smooth' }),
  shoot: K(2, [{ hy: 0.06, lL: [55, 0, 85], aR: [30, 80, 10], aL: [25, -30, 40], cx: 0.1 }, { hy: -0.06, lL: [20, 0, 40], aR: [25, 40, 60], aL: [25, 0, 40] }], { mirror: 1 }),
  quan: K(4, [{ cx: -0.15, hy: -0.08, hrz: 0.1, aL: [60, 30, 90], aR: [55, 35, 95], nz: 0.1 }, { cx: -0.25, hy: -0.12, hrz: -0.05, aL: [70, 50, 80], aR: [70, 50, 80], nx: -0.15 }, { cx: -0.15, hy: -0.08, hrz: -0.1, aL: [55, 35, 95], aR: [60, 30, 90], nz: -0.1 }, { cx: 0, hy: -0.05, aL: [40, 20, 100], aR: [40, 20, 100] }], { ease: 'smooth' }),
  // ---------- New on TikTok (Oct 2026), signature moves simplified
  countshrug: K(2, [{ aL: [30, 60, 95, 40], aR: [25, 55, 85, 40], hy: -0.04, cz: 0.08, nz: -0.1 }, { aL: [25, 55, 85, 40], aR: [30, 60, 95, 40], hy: -0.04, cz: -0.08, nz: 0.1 }, { aL: [45, 40, 100, 60], aR: [45, 40, 100, 60], hy: 0.02, cx: -0.05 }, { aL: [30, 60, 90, 40], aR: [30, 60, 90, 40] }]),
  knockhop: K(2, [{ aR: [35, 80, 120], aL: [20, 10, 30], hy: -0.05 }, { aR: [35, 80, 80], hy: -0.03 }, { aR: [35, 80, 120], hy: 0.15, lL: [25, 0, 40], lR: [25, 0, 40] }, { aR: [35, 80, 80], hy: -0.08 }]),
  powerhits: K(2, [{ aL: [170, 10, 5], aR: [40, 20, 120], hy: -0.08, hrz: 0.08 }, { aL: [40, 20, 120], aR: [170, 10, 5], hy: -0.08, hrz: -0.08 }, { aL: [90, 60, 0], aR: [90, 60, 0], hy: 0, cx: -0.1, star: 1 }, { ...N, hy: -0.1 }], { ease: 'snap' }),
  linestep: K(4, [{ hx: 0.12, lR: [10, 15, 20], aL: [25, 20, 60], aR: [25, 20, 60] }, { hx: 0.2, lL: [15, -10, 30] }, { hx: 0.12, lR: [10, 15, 20] }, { hx: 0.04, aL: [30, 70, 110], aR: [30, 70, 110], hy: -0.04, star: 1 }], { mirror: 1 }),
  posesway: K(2, [{ hx: -0.1, hrz: 0.14, aL: [60, -10, 125], aR: [160, 5, 80], nz: 0.15, hy: -0.04 }, { hx: 0.1, hrz: -0.14, aL: [60, -10, 125], aR: [160, 5, 80], nz: -0.05, hy: -0.04 }], { ease: 'smooth', mirrorEvery: 2 }),
};
const ease = { smooth: (k) => k * k * (3 - 2 * k), linear: (k) => k, snap: (k) => (k < 0.35 ? (k / 0.35) ** 2 * 0.5 : 1 - 0.5 * ((1 - k) / 0.65) ** 3 * 0.0 + 0) };
ease.snap = (k) => Math.min(1, 1 - (1 - Math.min(1, k * 2.4)) ** 3); // fast hit, then hold
function lerpP(a, b, k) { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[key], y = b[key]; if (Array.isArray(x) || Array.isArray(y)) { const X = x || N[key] || [0, 0, 0, 0], Y = y || N[key] || [0, 0, 0, 0]; o[key] = [0, 1, 2, 3].map((i) => (X[i] || 0) + ((Y[i] || 0) - (X[i] || 0)) * k); } else o[key] = (x || 0) + ((y || 0) - (x || 0)) * k; } return o; }
const compiled = {};
function compile(id) {
  const d = DANCES3D[id] || DANCES3D.groove; let keys = d.keys.map((k, i) => k || (i ? d.keys[0] && { ...N, hy: -0.03 } : N));
  if (d.mirror) keys = [...keys, ...keys.map(M)];
  return { ...d, keys, beats: d.mirror ? d.beats * 2 : d.beats };
}
// returns (beat, t) -> pose
export function clipFor(id) {
  const d = compiled[id] || (compiled[id] = compile(id)); const E = ease[d.ease || 'smooth'];
  return (beat) => {
    const n = d.keys.length, ph = (((beat % d.beats) + d.beats) % d.beats) / d.beats * n, i = Math.floor(ph), k = E(ph - i);
    const p = lerpP(d.keys[i], d.keys[(i + 1) % n], k);
    // groove layer: knee bounce on every beat, weight shift + counter-rotation
    const b = beat * Math.PI * 2; p.hy = (p.hy || 0) - (1 - Math.cos(b)) * 0.025; p.cy = (p.cy || 0) - (p.hry || 0) * 0.6; p.sz = (p.sz || 0) - (p.hrz || 0) * 0.5;
    p.tw = 0.25; return p;
  };
}
