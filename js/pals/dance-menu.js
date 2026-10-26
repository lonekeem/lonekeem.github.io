// Free dances for the Kemy world. Original names and moves on the existing Pal rig.
// Ids stay short so they fit the presence field (dn, 20 characters). No shop lock.
import { register3D, has3D } from './dances3d.js';

const N = { aL: [24, 6, 14], aR: [24, 6, 14] };
function add(id, beats, keys, o = {}) { register3D(id, { beats, keys, ...o }); }

export const WORLD_DANCES = [
  { id: 'tinpal', name: 'Tin Pal', icon: '🤖' },
  { id: 'backglide', name: 'Back Glide', icon: '🌙' },
  { id: 'twirlpop', name: 'Twirl Pop', icon: '🌀' },
  { id: 'armswing', name: 'Arm Swing', icon: '🙌' },
  { id: 'pawwave', name: 'Paw Wave', icon: '👋' },
  { id: 'icestatue', name: 'Ice Statue', icon: '🧊' },
  { id: 'bouncebeat', name: 'Bounce Beat', icon: '🎵' },
  { id: 'champjump', name: 'Champion Jump', icon: '🏆' },
  { id: 'sidestep', name: 'Side Step', icon: '👟' },
  { id: 'inchworm', name: 'Inch Worm', icon: '🐛' },
  { id: 'starframe', name: 'Star Frame', icon: '⭐' },
  { id: 'tinycrown', name: 'Tiny Crown', icon: '👑' },
];
export const WORLD_DANCE_BY_ID = Object.fromEntries(WORLD_DANCES.map((d) => [d.id, d]));

add('tinpal', 4, [
  { aL: [86, 4, 86], aR: [18, 0, 24], ny: 0.4, hy: -0.03 },
  { aL: [86, 4, 86], aR: [86, 4, 86], ny: 0, hy: -0.07 },
  { aL: [18, 0, 24], aR: [86, 4, 86], ny: -0.4, hry: -0.18 },
  { aL: [70, 36, 78], aR: [70, 36, 78], hy: -0.04, hry: 0.12 },
], { ease: 'snap' });
add('backglide', 4, [
  { hx: 0.28, lL: [4, 0, 42], aL: [22, -8, 36], aR: [22, 12, 36], ry: -0.35 },
  { hx: 0.08, lR: [4, 0, 42], ry: -0.35 },
  { hx: -0.08, lL: [4, 0, 42], ry: -0.35 },
  { hx: -0.28, lR: [4, 0, 42], aL: [22, 12, 36], aR: [22, -8, 36], ry: -0.35 },
], { ease: 'linear', slide: 1 });
add('twirlpop', 2, [
  { ry: 0, hy: -0.04, aL: [50, 10, 40], aR: [50, 10, 40] },
  { ry: Math.PI, hy: 0.08, aL: [140, 0, 28], aR: [140, 0, 28] },
  { ry: Math.PI * 2, hy: -0.04, aL: [50, 10, 40], aR: [50, 10, 40] },
], { ease: 'spin' });
add('armswing', 2, [
  { aL: [150, 20, 28], aR: [36, -20, 70], hrz: 0.1, cz: 0.08, hy: -0.04 },
  { aL: [36, -20, 70], aR: [150, 20, 28], hrz: -0.1, cz: -0.08, hy: -0.04 },
], { ease: 'smooth' });
add('pawwave', 2, [
  { aR: [150, 16, 24], aL: [30, 10, 40], nz: -0.12, hy: -0.02 },
  { aR: [120, 8, 48], aL: [30, 10, 40], nz: 0.1, hy: -0.04 },
  { aR: [156, 20, 20], nz: -0.08 },
  { aR: [118, 6, 50], nz: 0.12, hy: -0.03 },
]);
add('icestatue', 4, [
  { hy: 0.06, hrz: -0.16, aL: [158, 8, 24], aR: [64, -16, 36], lR: [40, 16, 64], nz: -0.16 },
  { hy: 0.06, hrz: -0.16, aL: [158, 8, 24], aR: [64, -16, 36], lR: [40, 16, 64], nz: -0.16 },
  { hy: 0.06, hrz: -0.16, aL: [158, 8, 24], aR: [64, -16, 36], lR: [40, 16, 64], nz: -0.16 },
  { hy: 0.02, hrz: -0.1, aL: [140, 8, 30], aR: [50, -10, 40], lR: [28, 12, 48] },
], { ease: 'snap' });
add('bouncebeat', 1, [
  { hy: -0.12, hx: -0.06, hrz: 0.08, aL: [36, 28, 70], aR: [28, 8, 50], nx: 0.08 },
  { hy: 0.04, hx: 0.06, hrz: -0.08, aL: [28, 8, 50], aR: [36, 28, 70], nx: -0.06 },
]);
add('champjump', 2, [
  { hy: -0.12, aL: [30, 24, 46], aR: [30, 24, 46] },
  { hy: 0.34, aL: [158, 8, 22], aR: [158, 8, 22], lL: [22, 4, 36], lR: [22, 4, 36] },
  { hy: 0.28, aL: [168, 12, 18], aR: [168, 12, 18], lL: [18, 4, 30], lR: [18, 4, 30] },
  { hy: -0.08, aL: [40, 30, 70], aR: [40, 30, 70] },
]);
add('sidestep', 1, [
  { hx: 0.1, hry: 0.22, hy: -0.06, lL: [16, 22, 24], aL: [28, 22, 64], aR: [24, -12, 48] },
  { hx: -0.1, hry: -0.22, hy: -0.02, lR: [16, 22, 24], aL: [24, -12, 48], aR: [28, 22, 64] },
], { ease: 'snap' });
add('inchworm', 2, [
  { cx: -0.22, sx: -0.12, nx: -0.16, hy: -0.02, hz: 0.04, aL: [40, 30, 80], aR: [40, 30, 80] },
  { cx: 0.16, sx: 0.1, nx: 0.18, hy: -0.1, hz: -0.06, hrx: -0.12 },
  { cx: -0.05, hy: -0.14, hrx: -0.2, aL: [50, 40, 90], aR: [50, 40, 90] },
  { ...N, cx: 0.04, hy: -0.04 },
], { ease: 'smooth' });
add('starframe', 2, [
  { aL: [150, 8, 24], aR: [150, 8, 24], lL: [28, 18, 20], lR: [28, 18, 20], hy: 0.02 },
  { aL: [162, 6, 20], aR: [162, 6, 20], lL: [36, 22, 18], lR: [36, 22, 18], hy: 0.06, star: 1 },
  { aL: [150, 8, 24], aR: [150, 8, 24], lL: [24, 14, 18], lR: [24, 14, 18], hy: 0.02 },
], { ease: 'smooth' });
add('tinycrown', 2, [
  { aL: [168, 16, 36], aR: [168, 16, 36], nx: -0.12, hy: -0.04, hrz: 0.06 },
  { aL: [150, 8, 48], aR: [150, 8, 48], nx: 0.08, hy: 0.02, hrz: -0.06 },
  { aL: [168, 20, 30], aR: [168, 20, 30], hy: -0.02 },
], { gentle: 1 });

// 🕺 Dance (the music button): a 32-beat routine of four kid-friendly moves, 8 beats (2 bars) each, so it changes every
// couple of bars: bounce, arm swing, side step, paw wave. Two keys per beat and beat-indexed, so it locks to the song's beat
// grid (js/pals/musicbeat.js) and everyone in the room who hears the same song dances in step.
export const GROOVE = 'groove';
{
  const rep = (ks, n) => Array.from({ length: n }, () => ks).flat();
  const bounce = [
    { hy: -0.12, hx: -0.05, hrz: 0.07, aL: [36, 28, 70], aR: [28, 8, 50], nx: 0.08 },
    { hy: 0.03, hx: 0.05, hrz: -0.07, aL: [28, 8, 50], aR: [36, 28, 70], nx: -0.06 },
  ];
  const swing = [
    { aL: [150, 20, 28], aR: [36, -20, 70], hrz: 0.1, cz: 0.08, hy: -0.1 },
    { aL: [96, 4, 40], aR: [96, 4, 40], hy: 0.02 },
    { aL: [36, -20, 70], aR: [150, 20, 28], hrz: -0.1, cz: -0.08, hy: -0.1 },
    { aL: [96, 4, 40], aR: [96, 4, 40], hy: 0.02 },
  ];
  const step = [
    { hx: 0.1, hry: 0.22, hy: -0.08, lL: [16, 22, 24], aL: [28, 22, 64], aR: [24, -12, 48] },
    { hx: -0.1, hry: -0.22, hy: -0.03, lR: [16, 22, 24], aL: [24, -12, 48], aR: [28, 22, 64] },
  ];
  const wave = [
    { aR: [150, 16, 24], aL: [30, 10, 40], nz: -0.12, hy: -0.06 },
    { aR: [120, 8, 48], aL: [30, 10, 40], nz: 0.1, hy: 0 },
    { aL: [150, 16, 24], aR: [30, 10, 40], nz: 0.12, hy: -0.06 },
    { aL: [120, 8, 48], aR: [30, 10, 40], nz: -0.1, hy: 0 },
  ];
  add(GROOVE, 32, [...rep(bounce, 8), ...rep(swing, 4), ...rep(step, 8), ...rep(wave, 4)], { ease: 'smooth' });
}
// which of the four moves is on at a beat (for the hint chip + tests)
export const grooveMove = (beat) => ['Bounce', 'Arm Swing', 'Side Step', 'Paw Wave'][Math.floor((((beat % 32) + 32) % 32) / 8)];

export const worldDanceIds = () => WORLD_DANCES.map((d) => d.id);
export const worldDanceReady = () => WORLD_DANCES.every((d) => has3D(d.id) && d.id.length <= 20);

// ---------------------------------------------------------------- 🕺 Dance styles (music button)
// Each style is a routine of full-body moves, 8 beats (2 bars) each, locked to the song's beat grid, so everyone hearing the
// same song sees the same move. Presence: dn = 'groove' (Chill, the default, what older apps also show) or 'g:<s><k>', where
// <s> is the style letter and <k> is the move offset you started on (one digit), e.g. 'g:b3'. No extra writes: the move
// changes on the shared beat, not by sending. Whole-body turns (spins, cartwheels, flips) are procedural (sp: [axis, from,
// to, turns]) so they never "unwind"; hip offsets (slides, leaps) always come back to 0, so you end up back on your spot.
// Original moves on the Pal rig, kid-friendly (no copied game emotes).
const MB = 8; // beats per move
const T = Math.PI * 2;
const up = (a = 165, e = 40) => [a, 14, e];
const MOVES = {};
function mv(id, name, keys, o = {}) { MOVES[id] = { id, name, sp: o.sp || null, lite: o.lite }; register3D(id, { beats: MB, keys, ease: o.ease || 'smooth', ...(o.slide ? { slide: 1 } : {}), ...(o.gentle ? { gentle: 1 } : {}) }); }
const rep = (ks, n) => Array.from({ length: n }, () => ks).flat();

// --- Chill sway (default)
mv('c.sway', 'Sway', rep([
  { hx: -0.08, hrz: 0.1, hy: -0.06, aL: [34, 18, 50], aR: [22, 8, 40], nz: 0.12, cz: -0.06 },
  { hx: 0.08, hrz: -0.1, hy: -0.06, aL: [22, 8, 40], aR: [34, 18, 50], nz: -0.12, cz: 0.06 },
], 2), { gentle: 1 });
mv('c.step', 'Step Touch', rep([
  { hx: 0.12, hy: -0.07, lL: [14, 18, 22], aL: [40, 30, 80], aR: [30, 30, 80], nx: 0.08 },
  { hx: 0, hy: -0.02 },
  { hx: -0.12, hy: -0.07, lR: [14, 18, 22], aL: [30, 30, 80], aR: [40, 30, 80], nx: 0.08 },
  { hx: 0, hy: -0.02 },
], 2), { gentle: 1 });
mv('c.wave', 'Slow Wave', [
  { aL: [150, 10, 30], aR: [40, 10, 40], hrz: -0.08, hy: -0.04, nz: -0.1 },
  { aL: [120, 20, 50], aR: [70, 10, 50], hrz: 0, hy: -0.07 },
  { aL: [40, 10, 40], aR: [150, 10, 30], hrz: 0.08, hy: -0.04, nz: 0.1 },
  { aL: [70, 10, 50], aR: [120, 20, 50], hrz: 0, hy: -0.07 },
], { gentle: 1 });

// --- Ballerina
mv('b.pir', 'Pirouette', [
  { hy: -0.12, aL: [70, 50, 70], aR: [70, 50, 70], lL: [8, 25, 20], lR: [8, 25, 20] }, // plié prep
  { hy: 0.07, aL: up(168, 70), aR: up(168, 70), lL: [62, 40, 110], nx: -0.1 }, // on tiptoe, foot at the knee, arms in a circle overhead
  { hy: 0.07, aL: up(168, 70), aR: up(168, 70), lL: [62, 40, 110] },
  { hy: 0.07, aL: up(168, 70), aR: up(168, 70), lL: [62, 40, 110] },
  { hy: 0.07, aL: up(168, 70), aR: up(168, 70), lL: [62, 40, 110] },
  { hy: 0.07, aL: up(168, 70), aR: up(168, 70), lL: [62, 40, 110] },
  { hy: -0.08, aL: [92, 20, 40], aR: [92, 20, 40] }, // land, arms open
  { hy: 0.02, aL: [40, 30, 60], aR: [40, 30, 60] },
], { sp: ['y', 1, 6, 2], lite: 'b.port', slide: 1 });
mv('b.arab', 'Arabesque', [
  { hy: 0, aL: [30, 30, 60], aR: [30, 30, 60] },
  { hy: 0.05, hrx: 0.32, lR: [-72, 0, 4], aL: [92, 40, 24], aR: [96, -20, 24], nx: -0.3, cx: -0.1 }, // one leg back, arms out
  { hy: 0.05, hrx: 0.36, lR: [-80, 0, 4], aL: [100, 45, 24], aR: [92, -20, 24], nx: -0.3, cx: -0.1 },
  { hy: 0.05, hrx: 0.32, lR: [-72, 0, 4], aL: [92, 40, 24], aR: [96, -20, 24], nx: -0.3, cx: -0.1 },
  { hy: 0, aL: [40, 30, 60], aR: [40, 30, 60] },
  { hy: 0.05, hrx: 0.32, lL: [-72, 0, 4], aR: [92, 40, 24], aL: [96, -20, 24], nx: -0.3, cx: -0.1 },
  { hy: 0.05, hrx: 0.36, lL: [-80, 0, 4], aR: [100, 45, 24], aL: [92, -20, 24], nx: -0.3, cx: -0.1 },
  { hy: 0, aL: [30, 30, 60], aR: [30, 30, 60] },
], { slide: 1 });
mv('b.plie', 'Plié', rep([
  { hy: -0.2, lL: [12, 34, 40], lR: [12, 34, 40], aL: [88, 20, 40], aR: [88, 20, 40], nx: 0.1, cx: 0.04 }, // knees out, arms in second
  { hy: 0.05, aL: up(168, 70), aR: up(168, 70), nx: -0.12 }, // rise, arms overhead
], 4), { lite: 'b.plie' });
mv('b.leap', 'Twirl Leap', [
  { hy: -0.12, hz: 0, aL: [40, 40, 60], aR: [40, 40, 60] },
  { hy: 0.36, hz: 0.28, hrx: 0.12, lL: [62, 0, 4], lR: [-52, 0, 8], aL: [150, 30, 30], aR: [110, -10, 30], nx: -0.2 }, // split leap forward
  { hy: 0.02, hz: 0.5, aL: [92, 20, 40], aR: [92, 20, 40] },
  { hy: 0.36, hz: 0.72, hrx: 0.12, lR: [62, 0, 4], lL: [-52, 0, 8], aR: [150, 30, 30], aL: [110, -10, 30], nx: -0.2 },
  { hy: -0.06, hz: 0.8, aL: up(165, 70), aR: up(165, 70) },
  { hy: 0.06, hz: 0.56, aL: up(165, 70), aR: up(165, 70), lL: [50, 35, 100] }, // twirl back home on tiptoe
  { hy: 0.06, hz: 0.24, aL: up(165, 70), aR: up(165, 70), lL: [50, 35, 100] },
  { hy: 0, hz: 0, aL: [40, 30, 60], aR: [40, 30, 60] },
], { sp: ['y', 4, 7, 2], slide: 1 });
mv('b.port', 'Arm Circles', rep([
  { aL: [20, 30, 60], aR: [20, 30, 60], hy: -0.04, hrz: 0.06 }, // low
  { aL: [50, 85, 60], aR: [50, 85, 60], hy: 0 }, // front
  { aL: up(170, 60), aR: up(170, 60), hy: 0.05, nx: -0.15 }, // overhead circle
  { aL: [95, 10, 30], aR: [95, 10, 30], hy: 0, hrz: -0.06 }, // open to the side
], 2), { gentle: 1 });

// --- Breakdance
mv('k.top', 'Toprock', rep([
  { hx: 0.06, hry: 0.4, hy: -0.08, lL: [30, -24, 44], aL: [40, 70, 115], aR: [60, 30, 120], nx: 0.12 }, // cross step, guard up
  { hx: 0, hry: 0, hy: -0.02, aL: [70, 20, 90], aR: [70, 20, 90] },
  { hx: -0.06, hry: -0.4, hy: -0.08, lR: [30, -24, 44], aR: [40, 70, 115], aL: [60, 30, 120], nx: 0.12 },
  { hx: 0, hry: 0, hy: -0.02, aL: [70, 20, 90], aR: [70, 20, 90] },
], 2), { ease: 'snap', lite: 'k.top' });
mv('k.six', 'Six Step', [ // on the floor, hands down, legs stepping around in a circle
  { hy: -0.4, hrx: 0.5, hz: -0.1, aL: [20, 70, 20], aR: [20, 70, 20], lL: [80, 10, 120], lR: [40, 30, 60] },
  { hy: -0.42, hrx: 0.45, hx: 0.12, aL: [24, 70, 20], aR: [24, 70, 20], lL: [50, -10, 90], lR: [90, 30, 110] },
  { hy: -0.38, hrx: 0.4, hz: 0.1, aL: [20, 70, 20], aR: [20, 70, 20], lL: [100, 25, 100], lR: [60, -10, 80] },
  { hy: -0.42, hrx: 0.45, hx: -0.12, aL: [24, 70, 20], aR: [24, 70, 20], lL: [40, 30, 60], lR: [80, 10, 120] },
  { hy: -0.4, hrx: 0.5, hz: -0.1, aL: [20, 70, 20], aR: [20, 70, 20], lL: [80, 10, 120], lR: [40, 30, 60] },
  { hy: -0.42, hrx: 0.45, hx: 0.12, aL: [24, 70, 20], aR: [24, 70, 20], lL: [50, -10, 90], lR: [90, 30, 110] },
  { hy: -0.38, hrx: 0.4, hz: 0.1, aL: [20, 70, 20], aR: [20, 70, 20], lL: [100, 25, 100], lR: [60, -10, 80] },
  { hy: -0.1, hrx: 0.1, aL: [40, 40, 80], aR: [40, 40, 80] },
], { sp: ['y', 0, 7, 1], slide: 1 });
mv('k.mill', 'Windmill', [
  { hy: -0.3, hrx: 0.6, aL: [30, 60, 30], aR: [30, 60, 30], lL: [60, 20, 80], lR: [60, 20, 80] },
  { hy: -0.34, hrx: -1.2, hrz: 0.4, lL: [70, 55, 0], lR: [70, 55, 0], aL: [95, 0, 20], aR: [95, 0, 20], nx: 0.3 }, // on the back, legs in a big V
  { hy: -0.34, hrx: -1.2, hrz: -0.4, lL: [70, 55, 0], lR: [70, 55, 0], aL: [95, 0, 20], aR: [95, 0, 20], nx: 0.3 },
  { hy: -0.34, hrx: -1.2, hrz: 0.4, lL: [70, 55, 0], lR: [70, 55, 0], aL: [95, 0, 20], aR: [95, 0, 20], nx: 0.3 },
  { hy: -0.34, hrx: -1.2, hrz: -0.4, lL: [70, 55, 0], lR: [70, 55, 0], aL: [95, 0, 20], aR: [95, 0, 20], nx: 0.3 },
  { hy: -0.34, hrx: -1.2, hrz: 0.4, lL: [70, 55, 0], lR: [70, 55, 0], aL: [95, 0, 20], aR: [95, 0, 20], nx: 0.3 },
  { hy: -0.3, hrx: 0.6, aL: [30, 60, 30], aR: [30, 60, 30], lL: [60, 20, 80], lR: [60, 20, 80] },
  { hy: -0.06, aL: [40, 40, 80], aR: [40, 40, 80] },
], { sp: ['y', 1, 6, 3], slide: 1 });
mv('k.head', 'Headspin', [
  { hy: -0.3, hrx: 0.7, aL: [30, 70, 40], aR: [30, 70, 40], lL: [70, 20, 100], lR: [70, 20, 100] }, // tuck, hands down
  { hy: 0.36, hrx: Math.PI, aL: [60, 20, 90], aR: [60, 20, 90], lL: [0, 24, 6], lR: [0, 24, 6] }, // upside down, legs up in a V
  { hy: 0.36, hrx: Math.PI, aL: [100, 0, 30], aR: [100, 0, 30], lL: [0, 32, 6], lR: [0, 32, 6] },
  { hy: 0.36, hrx: Math.PI, aL: [100, 0, 30], aR: [100, 0, 30], lL: [0, 32, 6], lR: [0, 32, 6] },
  { hy: 0.36, hrx: Math.PI, aL: [60, 20, 90], aR: [60, 20, 90], lL: [0, 14, 6], lR: [0, 14, 6] },
  { hy: 0.3, hrx: Math.PI, aL: [60, 20, 90], aR: [60, 20, 90], lL: [40, 14, 60], lR: [40, 14, 60] },
  { hy: -0.3, hrx: 0.7, aL: [30, 70, 40], aR: [30, 70, 40], lL: [70, 20, 100], lR: [70, 20, 100] },
  { hy: -0.06, aL: [40, 40, 80], aR: [40, 40, 80] },
], { sp: ['y', 1.5, 5.5, 3], slide: 1 });
mv('k.back', 'Backspin', [
  { hy: -0.34, hrx: 0.5, aL: [30, 60, 30], aR: [30, 60, 30], lL: [70, 20, 100], lR: [70, 20, 100] },
  { hy: -0.42, hrx: -1.35, aL: [40, 60, 120], aR: [40, 60, 120], lL: [110, 10, 120], lR: [110, 10, 120], nx: 0.5 }, // on the back, knees hugged
  { hy: -0.42, hrx: -1.35, aL: [40, 60, 120], aR: [40, 60, 120], lL: [110, 10, 120], lR: [110, 10, 120], nx: 0.5 },
  { hy: -0.42, hrx: -1.35, aL: [100, 0, 30], aR: [100, 0, 30], lL: [80, 40, 30], lR: [80, 40, 30], nx: 0.5 },
  { hy: -0.42, hrx: -1.35, aL: [40, 60, 120], aR: [40, 60, 120], lL: [110, 10, 120], lR: [110, 10, 120], nx: 0.5 },
  { hy: -0.42, hrx: -1.35, aL: [40, 60, 120], aR: [40, 60, 120], lL: [110, 10, 120], lR: [110, 10, 120], nx: 0.5 },
  { hy: -0.34, hrx: 0.5, aL: [30, 60, 30], aR: [30, 60, 30], lL: [70, 20, 100], lR: [70, 20, 100] },
  { hy: -0.06, aL: [40, 40, 80], aR: [40, 40, 80] },
], { sp: ['y', 1.5, 5.5, 2], slide: 1 });
mv('k.frz', 'Freeze', [
  { hy: -0.1, aL: [40, 40, 80], aR: [40, 40, 80] },
  { hy: -0.22, hrz: 0.9, hrx: 0.3, aR: [165, 10, 20], aL: [70, 40, 110], lL: [90, 30, 120], lR: [50, 10, 120], nz: -0.3, star: 1 }, // sideways on one hand
  { hy: -0.22, hrz: 0.9, hrx: 0.3, aR: [165, 10, 20], aL: [70, 40, 110], lL: [90, 30, 120], lR: [50, 10, 120], nz: -0.3 },
  { hy: -0.22, hrz: 0.9, hrx: 0.3, aR: [165, 10, 20], aL: [70, 40, 110], lL: [90, 30, 120], lR: [50, 10, 120], nz: -0.3 },
  { hy: -0.1, aL: [40, 40, 80], aR: [40, 40, 80] },
  { hy: -0.22, hrz: -0.9, hrx: 0.3, aL: [165, 10, 20], aR: [70, 40, 110], lR: [90, 30, 120], lL: [50, 10, 120], nz: 0.3, star: 1 },
  { hy: -0.22, hrz: -0.9, hrx: 0.3, aL: [165, 10, 20], aR: [70, 40, 110], lR: [90, 30, 120], lL: [50, 10, 120], nz: 0.3 },
  { hy: -0.06, aL: [40, 40, 80], aR: [40, 40, 80] },
], { ease: 'snap', slide: 1 });

// --- Hip-hop
mv('h.bnc', 'Bounce', rep([
  { hy: -0.14, hx: -0.05, hrz: 0.07, hrx: 0.1, aL: [36, 40, 90], aR: [28, 20, 70], nx: 0.14, lL: [10, 10, 20] },
  { hy: 0.03, hx: 0.05, hrz: -0.07, aL: [28, 20, 70], aR: [36, 40, 90], nx: -0.06, lR: [10, 10, 20] },
], 4), { ease: 'snap', lite: 'h.bnc' });
mv('h.wave', 'Arm Wave', rep([
  { aL: [100, 0, 60, 30], aR: [80, 0, 20], hrz: 0.1, cz: -0.12, hy: -0.06, nz: 0.15 }, // the wave rolls left to right
  { aL: [88, 0, 20], aR: [88, 0, 20], cz: 0, hy: -0.02 },
  { aL: [80, 0, 20], aR: [100, 0, 60, 30], hrz: -0.1, cz: 0.12, hy: -0.06, nz: -0.15 },
  { aL: [88, 0, 20], aR: [88, 0, 20], cz: 0, hy: -0.02 },
], 2));
mv('h.shuf', 'Shuffle', rep([
  { hx: 0.14, hry: 0.35, hy: -0.08, lL: [24, 20, 30], aL: [30, 40, 90], aR: [26, 20, 70] }, // heel-toe slides side to side
  { hx: 0.06, hry: -0.2, hy: -0.04, lR: [16, 10, 20] },
  { hx: -0.14, hry: -0.35, hy: -0.08, lR: [24, 20, 30], aR: [30, 40, 90], aL: [26, 20, 70] },
  { hx: -0.06, hry: 0.2, hy: -0.04, lL: [16, 10, 20] },
], 2), { slide: 1 });
mv('h.run', 'Running Man', rep([
  { hy: 0.02, lL: [72, 0, 95], lR: [-22, 0, 14], aL: [30, -30, 90], aR: [30, 60, 100], hrx: -0.06, nx: 0.1 }, // knee up, other foot slides back
  { hy: -0.1, lL: [8, 0, 20], lR: [4, 0, 20], aL: [24, 20, 60], aR: [24, 20, 60] },
  { hy: 0.02, lR: [72, 0, 95], lL: [-22, 0, 14], aR: [30, -30, 90], aL: [30, 60, 100], hrx: -0.06, nx: 0.1 },
  { hy: -0.1, lL: [4, 0, 20], lR: [8, 0, 20], aL: [24, 20, 60], aR: [24, 20, 60] },
], 2), { slide: 1 });

// --- Fun moves
mv('f.bot', 'Robot', rep([
  { aL: [86, 4, 90], aR: [18, 0, 24], ny: 0.5, hry: 0.3, hy: -0.03 },
  { aL: [86, 4, 90], aR: [86, 4, 90], ny: 0, hry: 0, hy: -0.08 },
  { aL: [18, 0, 24], aR: [86, 4, 90], ny: -0.5, hry: -0.3, hy: -0.03 },
  { aL: [70, 60, 90], aR: [70, 60, 90], ny: 0, hy: -0.08, nx: 0.2 },
], 2), { ease: 'snap', lite: 'f.bot' });
mv('f.moon', 'Moonwalk', [ // glide backwards on alternating heels, then spin and step home
  { hz: 0, lL: [6, 0, 40], aL: [24, -20, 40], aR: [24, 30, 50], hrx: -0.05 },
  { hz: -0.14, lR: [6, 0, 40], aL: [24, 30, 50], aR: [24, -20, 40], hrx: -0.05 },
  { hz: -0.28, lL: [6, 0, 40], aL: [24, -20, 40], aR: [24, 30, 50], hrx: -0.05 },
  { hz: -0.42, lR: [6, 0, 40], aL: [24, 30, 50], aR: [24, -20, 40], hrx: -0.05 },
  { hz: -0.56, lL: [6, 0, 40], aL: [24, -20, 40], aR: [24, 30, 50], hrx: -0.05 },
  { hz: -0.6, hy: 0.06, aL: [120, 0, 40], aR: [40, 0, 40], lL: [30, 10, 60] }, // spin on the toes
  { hz: -0.3, hy: 0.02, aL: [40, 30, 60], aR: [40, 30, 60] },
  { hz: 0, aL: [30, 20, 60], aR: [30, 20, 60] },
], { ease: 'linear', slide: 1, sp: ['y', 5, 6.4, 1] });
mv('f.worm', 'The Worm', [
  { hy: -0.3, hrx: 0.7, aL: [30, 80, 40], aR: [30, 80, 40], lL: [70, 10, 100], lR: [70, 10, 100] }, // drop down
  { hy: -0.48, hrx: 1.45, aL: [30, 60, 120], aR: [30, 60, 120], lL: [0, 4, 0], lR: [0, 4, 0], nx: -0.6 }, // flat on the tummy
  { hy: -0.38, hrx: 1.3, cx: -0.4, aL: [30, 40, 60], aR: [30, 40, 60], nx: -0.6, hz: 0.06 }, // wave up through the hips
  { hy: -0.48, hrx: 1.55, cx: 0.2, lL: [-30, 4, 30], lR: [-30, 4, 30], aL: [30, 60, 120], aR: [30, 60, 120], nx: -0.6, hz: 0.12 },
  { hy: -0.38, hrx: 1.3, cx: -0.4, aL: [30, 40, 60], aR: [30, 40, 60], nx: -0.6, hz: 0.18 },
  { hy: -0.48, hrx: 1.55, cx: 0.2, lL: [-30, 4, 30], lR: [-30, 4, 30], aL: [30, 60, 120], aR: [30, 60, 120], nx: -0.6, hz: 0.12 },
  { hy: -0.3, hrx: 0.7, aL: [30, 80, 40], aR: [30, 80, 40], lL: [70, 10, 100], lR: [70, 10, 100], hz: 0.05 },
  { hy: 0, aL: [120, 10, 30], aR: [120, 10, 30], hz: 0 }, // pop up, ta-da
], { slide: 1 });
mv('f.cart', 'Cartwheel', [ // one sideways cartwheel, then skip back to the spot
  { hy: 0, hx: 0, aL: up(165, 30), aR: up(165, 30) },
  { hy: -0.04, hx: 0, aL: up(170, 20), aR: up(170, 20), lL: [0, 20, 10] },
  { hy: 0.04, hx: 0.16, aL: up(170, 10), aR: up(170, 10), lL: [0, 50, 0], lR: [0, 50, 0] }, // hands down
  { hy: 0.44, hx: 0.32, aL: up(170, 10), aR: up(170, 10), lL: [0, 55, 0], lR: [0, 55, 0] }, // upside down, a big star
  { hy: 0.04, hx: 0.48, aL: up(170, 10), aR: up(170, 10), lL: [0, 50, 0], lR: [0, 50, 0] },
  { hy: 0, hx: 0.64, aL: up(165, 30), aR: up(165, 30) }, // land, ta-da
  { hy: 0.08, hx: 0.32, lL: [40, 0, 70], aL: [40, 30, 60], aR: [40, 30, 60] }, // skip home
  { hy: 0, hx: 0, aL: [30, 20, 60], aR: [30, 20, 60] },
], { ease: 'linear', slide: 1, sp: ['z', 1, 5, -1] });
mv('f.jack', 'Jumping Jacks', rep([
  { hy: 0.16, aL: up(168, 20), aR: up(168, 20), lL: [0, 26, 4], lR: [0, 26, 4], sq: -0.06 },
  { hy: -0.06, aL: [16, 0, 24], aR: [16, 0, 24], lL: [0, 0, 6], lR: [0, 0, 6], sq: 0.06 },
], 4), { slide: 1 });
mv('f.swing', 'Swing Swing', rep([ // arms swing low across the front and behind while the hips sway the other way (original)
  { hx: 0.1, hrz: -0.12, aL: [36, 50, 20], aR: [10, 40, 20], hy: -0.05 },
  { hx: -0.1, hrz: 0.12, aL: [10, -40, 20], aR: [36, -50, 20], hy: -0.05 },
  { hx: 0.1, hrz: -0.12, aL: [36, -50, 20], aR: [10, -40, 20], hy: -0.05 },
  { hx: -0.1, hrz: 0.12, aL: [10, 40, 20], aR: [36, 50, 20], hy: -0.05 },
], 2), { ease: 'snap' });

export const DANCE_STYLES = [
  { k: 'c', name: 'Chill Sway', icon: '🌊', moves: ['c.sway', 'c.step', 'c.wave'] },
  { k: 'b', name: 'Ballerina', icon: '🩰', moves: ['b.pir', 'b.arab', 'b.plie', 'b.leap', 'b.port'] },
  { k: 'k', name: 'Breakdance', icon: '🌀', moves: ['k.top', 'k.six', 'k.mill', 'k.head', 'k.back', 'k.frz'] },
  { k: 'h', name: 'Hip-Hop', icon: '🎧', moves: ['h.bnc', 'h.wave', 'h.shuf', 'h.run'] },
  { k: 'f', name: 'Fun Moves', icon: '🤸', moves: ['f.bot', 'f.moon', 'f.worm', 'f.cart', 'f.jack', 'f.swing'] },
];
const STYLE_BY_K = Object.fromEntries(DANCE_STYLES.map((s) => [s.k, s]));
// presence value: style + the dancer's beat clock, so everyone sees the same move at the same time even
// when they hear a different song (or none). "g:<k><bpm*10>.<t0>" (t0 = when beat 0 was, 0.1s, base36, wraps
// every ~70 days). Max 14 chars (the dn field allows 20). Written once when the dance starts (and again
// only if the song changes), never per move.
const CLK = 36 ** 5;
export function styleDn(k, beat, bpm) {
  if (!STYLE_BY_K[k] || k === 'c') return GROOVE;
  const b = Math.max(400, Math.min(2400, Math.round((bpm || 112) * 10))); const lb = beat - Math.floor(beat / MB) * MB; const t0 = Date.now() / 1000 - (lb * 600) / b; // starts on the first move, on the bar
  return `g:${k}${b}.${(((Math.floor(t0 * 10) % CLK) + CLK) % CLK).toString(36)}`;
}
const DN_RE = /^g:([a-z])(\d{3,4})\.([0-9a-z]{1,5})$/;
export const isStyleDn = (dn) => dn === GROOVE || (typeof dn === 'string' && DN_RE.test(dn) && !!STYLE_BY_K[dn[2]]);
export const styleOf = (dn) => (dn === GROOVE ? STYLE_BY_K.c : isStyleDn(dn) ? STYLE_BY_K[dn[2]] : null);
// the dancer's beat right now from their presence value (fallback: your own music's beat, e.g. Chill)
export function danceBeat(dn, fallback) {
  const m = typeof dn === 'string' && DN_RE.exec(dn); if (!m) return fallback;
  const bpm = +m[2] / 10, enc = parseInt(m[3], 36), n10 = Math.floor(Date.now() / 100);
  const t0 = (n10 - ((((n10 - enc) % CLK) + CLK) % CLK)) / 10; return ((Date.now() / 1000 - t0) * bpm) / 60;
}
const ease3 = (k) => k * k * (3 - 2 * k);
// what to play at this beat for a presence value: { dance3d, beat (local), ry/rz/rx whole-body turns, name, i }
// lite: the simple version for Pals nearby (the style's easy move, softer, no spins or floor work)
export function styleAt(dn, beat, lite) {
  const s = styleOf(dn); if (!s) return null; const n = s.moves.length;
  const blk = Math.floor(beat / MB), i = ((blk % n) + n) % n; let id = s.moves[i]; const lb = beat - blk * MB;
  if (lite) { id = MOVES[s.moves[0]].lite || s.moves[0]; return { dance3d: id, beat: lb, name: MOVES[id].name, i: 0, amt: 0.7 }; }
  const o = { dance3d: id, beat: lb, name: MOVES[id].name, i, amt: 1 }; const sp = MOVES[id].sp;
  if (sp) { const [ax, a, b, turns] = sp; const f = Math.max(0, Math.min(1, (lb - a) / (b - a))); o['r' + ax] = ease3(f) * turns * T; }
  return o;
}
export const styleMoveName = (dn, beat) => { const r = styleAt(dn, beat); return r ? r.name : ''; };
export const STYLE_MOVE_IDS = Object.keys(MOVES);
