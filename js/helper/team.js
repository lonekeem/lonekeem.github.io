// Where the Kemy Patrol walks and drives. Pure data and math, no rendering.
// Written by Lone Keem.
import { STATION } from '../world/layout.js';

export const TEAM_KEY = 'kemy-helper-team';

// A third value is a pause: look, wave, sit, shop, play, or park.
// A fourth value is the way they face while they pause.
const PARK = [
  [0, 6], [7.5, 7.5, 'sit', -2.356], [22, 6, 'look'], [30, 31, 'shop', Math.PI],
  [22, -8, 'wave'], [22, -24, 'look'], [-20, -24, 'wave'], [-20, 18],
  [0, 34, 'look'], [0, 88], [0, 108], [STATION.door[0], STATION.door[1], 'look', Math.PI / 2], [0, 122],
  [-46, 100], [46, 100, 'wave'], [46, 142], [-46, 142], [0, 108], [0, 62]
];
// Around the game tables, then over to a plaza bench.
const TABLE = [
  [30, 31, 'play', Math.PI], [24, 24, 'shop', Math.PI], [18, 36, 'look'], [8, 40, 'wave'],
  [-3.4, 40, 'sit', Math.PI / 2], [28, 22, 'wave'], [30, 31]
];
// Starts beside the leader, then follows the sidewalk out across Open Plains.
const PLAINS = [
  [3, 8], [18, 8, 'look'], [18, -16, 'wave'], [-14, -16], [-14, 22, 'look'], [8, 36, 'wave'],
  [0, 70], [0, 92], [STATION.door[0], STATION.door[1], 'wave', Math.PI / 2], [0, 108], [36, 96], [86, 96, 'look'],
  [86, 180, 'wave'], [86, 270, 'look'], [86, 430], [86, 446],
  [-46, 446], [-46, 276, 'wave'], [86, 276], [86, 160], [36, 96], [0, 70]
];
// Sidewalk loop: a downtown shop and a plaza bench, then the towns.
const TOWNS = [
  [140, 24], [189, 24, 'shop', 0], [212, 48, 'look'], [219.2, 62, 'sit', -1.5708],
  [212, 78, 'wave'], [244, 96], [340, 24, 'look'], [244, 24], [244, 96],
  [140, 96, 'wave'], [189, 96], [189, 24],
  [244, 24], [244, 214], [132, 214, 'look'], [132, 274, 'wave'], [340, 274], [132, 274],
  [132, 360, 'shop', 0], [340, 360], [132, 360], [132, 484, 'wave'], [132, 214], [244, 214], [244, 24], [140, 24]
];
const STREET_DRIVE = [
  [-80, 100], [28, 100, 'park'], [80, 100], [64, 100], [64, 145, 'park'], [-64, 145], [-64, 100],
  [0, 100], [0, 140], [STATION.lotStreet[0], 132], [STATION.lotStreet[0], STATION.lotStreet[1], 'park'],
  [0, 108], [0, 100], [-80, 100]
];
const COUNTRY_DRIVE = [
  [91, 160], [91, 280, 'park'], [91, 440], [122, 440], [122, 270, 'park'], [-40, 270], [-40, 440], [91, 440],
  [91, 145], [0, 145], [0, 112], [STATION.lotCountry[0], 112], [STATION.lotCountry[0], STATION.lotCountry[1], 'park'],
  [STATION.lotCountry[0], 140], [0, 145], [91, 145]
];

export const ROSTER = [
  { id: 'lead', role: 'walk', name: 'Kemy Helper', lead: true, speed: 1.25, side: 0, path: PARK, dist: 0, job: 'Chief of Kemy Patrol. I keep chat kind in Pal Park and on Kemy Street, and I come and go from the station. Also watching for stuck spots.' },
  { id: 'street', role: 'drive', name: 'Kemy Patrol', speed: 6.2, side: 1.5, path: STREET_DRIVE, dist: 70, job: 'Driving a Kemy Patrol car on Kemy Street so chat stays kind. I park at the station and hop out to say hi, and I check the car stays on the road.' },
  { id: 'play', role: 'walk', name: 'Helper', speed: 1.15, side: 0, path: TABLE, dist: 0, job: 'Watching the game tables so play stays fair, and checking that a quick game finishes.' },
  { id: 'plains', role: 'walk', name: 'Kemy Patrol', speed: 1.3, side: 0, path: PLAINS, dist: 0, job: 'Walking Open Plains and stopping by the station. I keep chat kind and watch for holes.' },
  { id: 'towns', role: 'walk', name: 'Helper', speed: 1.3, side: 0, path: TOWNS, dist: 44, job: 'Walking the towns and stopping at shops, staying near players and checking stuck spots.' },
  { id: 'country', role: 'drive', name: 'Kemy Patrol', speed: 7, side: -1.5, path: COUNTRY_DRIVE, dist: 40, job: 'Driving the country roads in a Kemy Patrol car so chat stays kind. I park at the station and check the car stays on the road.' }
];

const ACT_SEC = { look: 2.6, wave: 2.4, sit: 6.5, shop: 4.4, play: 7, park: 11 };

export function lifeInit() {
  return { mode: 'go', left: 0, elapsed: 0, mark: -1, yaw: null, say: '', greet: 0, spot: null };
}

function pointKind(pt) {
  return pt && typeof pt[2] === 'string' ? pt[2] : '';
}

function sayFor(mode) {
  if (mode === 'wave') return 'Hi!';
  if (mode === 'shop') return 'Just looking!';
  if (mode === 'play') return 'Want to play?';
  return '';
}

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

// Walk the route, and pause at a marked spot to look, wave, sit, or browse.
// A driver stops, steps out to the curb, waves, looks, and gets back in.
// life is mutated. m.dist advances only while they are walking or driving.
export function stepLife(life, m, dt) {
  const path = m.path;
  const L = pathLen(path) || 1;
  dt = Math.max(0, Math.min(0.1, dt || 0));
  if (life.left > 0) {
    life.left -= dt;
    life.elapsed += dt;
    if (life.left <= 0) {
      life.mode = 'go';
      life.left = 0;
      life.say = '';
      life.yaw = null;
      life.spot = null;
    }
  }
  const held = !!m.hold && life.mode === 'go';
  let moving = life.mode === 'go' && !held;
  if (moving) {
    const wobble = m.role === 'drive' ? 1 : 0.86 + 0.14 * Math.sin(m.dist * 0.37);
    m.dist += m.speed * wobble * dt;
  }
  if (life.mode === 'go' && !held && path) {
    const lap = Math.floor(m.dist / L);
    const along = ((m.dist % L) + L) % L;
    let acc = 0;
    for (let i = 0; i < path.length; i++) {
      const kind = pointKind(path[i]);
      if (kind && !(kind === 'park' && m.role !== 'drive')) {
        const delta = Math.abs(along - acc);
        const wrap = Math.min(delta, L - delta);
        const id = lap * 100 + i;
        if (wrap < 1.2 && life.mark !== id) {
          life.mark = id;
          life.mode = kind;
          life.left = ACT_SEC[kind] || 2.4;
          life.elapsed = 0;
          life.yaw = typeof path[i][3] === 'number' ? path[i][3] : null;
          life.say = sayFor(kind);
          life.spot = [path[i][0], path[i][1]];
          if (kind === 'park') m.dist = lap * L + acc;
          moving = false;
          break;
        }
      }
      const b = path[(i + 1) % path.length];
      acc += Math.hypot(b[0] - path[i][0], b[1] - path[i][1]);
    }
  }
  const pose = pathAt(path, m.dist, m.side);
  let mode = life.mode;
  const parked = life.spot && life.mode !== 'go' && life.mode !== 'park' && m.role !== 'drive';
  let x = parked ? life.spot[0] : pose.x;
  let z = parked ? life.spot[1] : pose.z;
  let yaw = Number.isFinite(life.yaw) ? life.yaw : pose.yaw;
  let onFoot = m.role !== 'drive';
  let say = life.left > 0 ? life.say : '';
  if (mode === 'look') yaw += Math.sin(life.elapsed * 1.35) * 0.95;
  if (m.role === 'drive' && life.mode === 'park') {
    const t = life.elapsed;
    const sign = (m.side || 1) >= 0 ? 1 : -1;
    const ox = -Math.cos(pose.yaw) * sign;
    const oz = Math.sin(pose.yaw) * sign;
    const curb = 2.6;
    const at = (k) => { x = pose.x + ox * k; z = pose.z + oz * k; };
    if (t < 1) {
      onFoot = false;
      say = '';
      mode = 'park';
    } else if (t < 2.3) {
      at(0.9 * ((t - 1) / 1.3));
      yaw = Math.atan2(ox, oz);
      onFoot = true;
      say = '';
      mode = 'go';
    } else if (t < 5.6) {
      at(0.9 + (curb - 0.9) * Math.min(1, (t - 2.3) / 1.2));
      yaw = Math.atan2(ox, oz);
      onFoot = true;
      say = 'Hi!';
      mode = 'wave';
    } else if (t < 8.4) {
      at(curb);
      yaw = Math.atan2(ox, oz) + Math.sin(t * 1.2) * 0.5;
      onFoot = true;
      say = 'Just looking!';
      mode = 'shop';
    } else if (t < 10.2) {
      at(curb * (1 - (t - 8.4) / 1.8));
      yaw = Math.atan2(-ox, -oz);
      onFoot = true;
      say = '';
      mode = 'go';
    } else {
      onFoot = false;
      say = '';
      mode = 'park';
    }
  } else if (moving && m.role !== 'drive') {
    const w = Math.sin(m.dist * 0.42) * 0.42;
    x += Math.cos(pose.yaw) * w;
    z += -Math.sin(pose.yaw) * w;
  }
  return { mode, x, z, yaw, moving, onFoot, say, carX: pose.x, carZ: pose.z, carYaw: pose.yaw };
}
