// Where the helper team walks and drives. Pure data and math, no rendering.
// Written by Lone Keem.

export const TEAM_KEY = 'kemy-helper-team';

const PARK = [
  [0, 6], [22, 6], [30, 31], [22, 6], [22, -24], [-20, -24], [-20, 18], [0, 34],
  [0, 88], [-46, 100], [46, 100], [46, 142], [-46, 142], [0, 108], [0, 62]
];
// Starts beside the leader, then follows the sidewalk out across Open Plains.
const PLAINS = [
  [3, 8], [18, 8], [18, -16], [-14, -16], [-14, 22], [8, 36],
  [0, 70], [0, 92], [36, 96], [86, 96],
  [86, 180], [86, 270], [86, 430], [86, 446],
  [-46, 446], [-46, 276], [86, 276], [86, 160], [36, 96], [0, 70]
];
// Sidewalk loop: downtown, the highway shoulder, Frostberry, the lake, and the shore.
const TOWNS = [
  [140, 24], [340, 24], [244, 24], [244, 96], [140, 96], [189, 96], [189, 24],
  [244, 24], [244, 214], [132, 214], [132, 274], [340, 274], [132, 274],
  [132, 360], [340, 360], [132, 360], [132, 484], [132, 214], [244, 214], [244, 24], [140, 24]
];
const STREET_DRIVE = [
  [-80, 100], [80, 100], [64, 100], [64, 145], [-64, 145], [-64, 100], [-80, 100]
];
const COUNTRY_DRIVE = [
  [91, 160], [91, 440], [122, 440], [122, 270], [-40, 270], [-40, 440], [91, 440]
];

export const ROSTER = [
  { id: 'lead', role: 'walk', name: 'Kemy Helper', lead: true, speed: 1.35, side: 0, path: PARK, dist: 0, job: 'Keeping chat kind in Pal Park and on Kemy Street. Also watching for stuck spots.' },
  { id: 'street', role: 'drive', name: 'Helper', speed: 6.2, side: 1.5, path: STREET_DRIVE, dist: 70, job: 'Patrolling Kemy Street so chat stays kind, and checking the car stays on the road.' },
  { id: 'play', role: 'sit', name: 'Helper', speed: 0, side: 0, x: 30, z: 31, yaw: Math.PI, job: 'Watching the game tables so play stays fair, and checking that a quick game finishes.' },
  { id: 'plains', role: 'walk', name: 'Helper', speed: 1.35, side: 0, path: PLAINS, dist: 0, job: 'Patrolling Open Plains, keeping chat kind and watching for holes.' },
  { id: 'towns', role: 'walk', name: 'Helper', speed: 1.4, side: 0, path: TOWNS, dist: 30, job: 'Patrolling the towns, staying near players and checking stuck spots.' },
  { id: 'country', role: 'drive', name: 'Helper', speed: 7, side: -1.5, path: COUNTRY_DRIVE, dist: 40, job: 'Patrolling the country roads so chat stays kind, and checking the car stays on the road.' }
];

export function teamShown() {
  try { return localStorage.getItem(TEAM_KEY) !== '0'; } catch { return true; }
}

export function setTeamShown(on) {
  try { localStorage.setItem(TEAM_KEY, on ? '1' : '0'); } catch { /* private mode */ }
  try { dispatchEvent(new Event('kemy:helper-team')); } catch { /* no window */ }
}

export function lowDevice(flags = {}) {
  return !!(flags.low || flags.saver || flags.saveData || flags.tier === 'low');
}

// Leader plus five pals on a normal device. Three on a small or saver device.
// The switch hides everyone except the leader, who can still take a note.
export function crewCount(flags = {}) {
  if (flags.shown === false || !teamShown()) return 1;
  return lowDevice(flags) ? 3 : ROSTER.length;
}

export function pathLen(pts) {
  let n = 0;
  if (!pts || pts.length < 2) return 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return n;
}

export function pathAt(pts, dist, side) {
  if (!pts || !pts.length) return { x: 0, z: 0, yaw: 0 };
  if (pts.length === 1) return { x: pts[0][0], z: pts[0][1], yaw: 0 };
  const L = pathLen(pts) || 1;
  let d = ((dist % L) + L) % L;
  const off = side || 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]) || 0.001;
    if (d <= seg || i === pts.length - 1) {
      const k = Math.max(0, Math.min(1, d / seg));
      const dx = (b[0] - a[0]) / seg, dz = (b[1] - a[1]) / seg;
      return {
        x: a[0] + (b[0] - a[0]) * k - dz * off,
        z: a[1] + (b[1] - a[1]) * k + dx * off,
        yaw: Math.atan2(dx, dz)
      };
    }
    d -= seg;
  }
  return { x: pts[0][0], z: pts[0][1], yaw: 0 };
}

// True when a player or a car is in front of a helper, close enough to stop for.
export function aheadBlocked(x, z, yaw, px, pz, reach) {
  if (!Number.isFinite(px) || !Number.isFinite(pz)) return false;
  const dx = px - x, dz = pz - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.2 || dist > (reach || 8)) return false;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return (dx * fx + dz * fz) / dist > 0.45;
}

export function groundIssue(prev, gy) {
  if (!Number.isFinite(gy)) return 'nan';
  if (gy < -20 || gy > 80) return 'float';
  if (prev != null && Number.isFinite(prev) && gy < prev - 12) return 'under';
  return '';
}
