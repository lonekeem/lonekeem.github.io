// Road clearance check: how far each road's asphalt edge is from house plots, buildings and estates.
// usage: node tools/road-clear.mjs [minClear]
import { HOUSES, ALL_ROADS, THEATER, ESTATES, ADMIN_HOME, segD, LOTS } from '../js/world/layout.js';
export const KUSTOMS = { x0: 54, x1: 70, z0: 241, z1: 258 }, HALL = { x0: 32, x1: 48, z0: 241, z1: 258 }, STATIONB = { x0: 9, x1: 23, z0: 116, z1: 128 };
export function obstacles() { const o = [];
  for (const h of HOUSES) { const ex = h.w / 2 + 5, back = h.d / 2 + 2, front = h.d / 2 + 6; o.push({ id: h.id, x0: h.x - ex, x1: h.x + ex, z0: h.face > 0 ? h.z - back : h.z - front, z1: h.face > 0 ? h.z + front : h.z + back, yard: 1 }); }
  o.push({ id: 'theater', x0: THEATER.x0, x1: THEATER.x1, z0: THEATER.z0, z1: THEATER.z1 }, { id: 'kustoms', ...KUSTOMS }, { id: 'hall', ...HALL }, { id: 'station', ...STATIONB });
  for (const e of ESTATES) o.push({ id: 'estate' + e.x, x0: e.x - 34, x1: e.x + 34, z0: e.z - 30, z1: e.z + 30 });
  o.push({ id: 'mansion', x0: ADMIN_HOME.x - 34, x1: ADMIN_HOME.x + 34, z0: ADMIN_HOME.z - 30, z1: ADMIN_HOME.z + 30 }); return o; }
// distance from a segment to a box (sampled)
export function segBoxD(r, b) { const [ax, az] = r.a, [bx, bz] = r.b; const L = Math.hypot(bx - ax, bz - az); let d = 1e9;
  for (let t = 0; t <= L; t += 0.5) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; const dx = Math.max(b.x0 - x, x - b.x1, 0), dz = Math.max(b.z0 - z, z - b.z1, 0); d = Math.min(d, Math.hypot(dx, dz)); if (d === 0) break; } return d; }
export function clearance(r, obs = obstacles()) { let best = 1e9, who = ''; for (const b of obs) { // a private drive may end at its own estate
    const d = segBoxD(r, b) - r.w / 2; if (d < best) { best = d; who = b.id; } } return { d: best, who }; }
if (import.meta.url === 'file://' + process.argv[1]) { const obs = obstacles(); for (const r of ALL_ROADS()) { const c = clearance(r, obs); console.log(r.id.padEnd(12), 'w', r.w, r.hw ? 'HW' : '  ', 'clear', c.d.toFixed(1), c.who); } }
