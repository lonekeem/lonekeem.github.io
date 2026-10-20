// Kemy World layout: Pal Park (centre) + Kemy Street (the Halloween neighborhood, south of the park) and the shared
// ground / bounds hooks Pal Park uses. Pure data + math (no three.js) so tests and other modules can import it.
// Written by Lone Keem.
export const PARK = { W: 100, H: 75 };                     // Pal Park half-size (x -100..100, z -75..75)
export const BOUNDS = { x0: -100, x1: 148, z0: -75, z1: 172 };   // whole walkable world (fits the park sync range 0..4000 units)
export const FLAT = 2.4;                                   // street level
export const STREET = { z0: 77, z1: 170, x0: -95, x1: 95 };
// roads: { id, a:[x,z], b:[x,z], w } (two lanes, w = full width)
export const ROADS = [
  { id: 's1', a: [-95, 100], b: [95, 100], w: 8 }, { id: 's2', a: [-95, 145], b: [95, 145], w: 8 },
  { id: 'a1', a: [-64, 100], b: [-64, 145], w: 8 }, { id: 'a2', a: [64, 100], b: [64, 145], w: 8 }, { id: 'a0', a: [0, 100], b: [0, 145], w: 8 },
];
export const SIDEWALK = 2.6;
// the friendly entrance from Pal Park's south path
export const GATE = { x: 0, z: 79 };
export const PARK_CORNER = { x0: 6, x1: 58, z0: 106, z1: 139 };
// houses: rows facing their street. face: +1 = front door looks toward +z, -1 toward -z
const ROWS = [{ z: 84, face: 1 }, { z: 116, face: -1 }, { z: 129, face: 1 }, { z: 161, face: -1 }];
export const HOUSES = (() => { const out = []; let n = 0;
  for (const [ri, row] of ROWS.entries()) for (let k = 0; k <= 12; k++) { const x = -87 + 14 * k; const mid = ri === 1 || ri === 2;
    if (ri === 0 && Math.abs(x) < 10) continue; if (mid && (Math.abs(x + 64) < 10 || Math.abs(x - 64) < 10 || Math.abs(x) < 10)) continue;
    if (mid && x > PARK_CORNER.x0 - 4 && x < PARK_CORNER.x1 + 4) continue;
    const id = 'h' + String(++n).padStart(2, '0'); const seed = (k * 7 + ri * 13) % 97; out.push({ id, x, z: row.z, face: row.face, style: (k * 3 + ri) % 4, seed,
      door: { x, z: row.z + row.face * 4.02 }, w: 9, d: 8 }); }
  return out; })();
export const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function segD(x, z, r) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
export const roadD = (x, z) => { let d = 1e9; for (const r of ROADS) d = Math.min(d, segD(x, z, r) - r.w / 2); return d; };
// Pal Park calls this with its own park height h (already including its rim hills): the south edge melts into the flat
// street level and the outer world rim gets gentle hills.
export function worldGround(x, z, h) { const { W, H } = PARK;
  const ws = sstep(H - 14, H - 1, z); if (ws <= 0) return h;
  const rim = Math.max(BOUNDS.x0 + 10 - x, x - (STREET.x1 - 2), z - (BOUNDS.z1 - 8), 0); const base = FLAT + rim * rim * 0.09;
  void W; return h + (base - h) * ws; }
export function worldClamp(x, z) { const { W, H } = PARK; const inStreet = z > H - 6;
  const x0 = BOUNDS.x0 + 3, x1 = inStreet ? STREET.x1 + 1 : W - 3; return [Math.max(x0, Math.min(x1, x)), Math.max(BOUNDS.z0 + 3, Math.min(BOUNDS.z1 - 3, z))]; }
export const inStreet = (x, z) => z > PARK.H - 4;
