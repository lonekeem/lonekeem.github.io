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
