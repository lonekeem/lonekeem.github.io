// Kemy World layout: Pal Park (centre) + Kemy Street (the Halloween neighborhood, south of the park) and the shared
// ground / bounds hooks Pal Park uses. Pure data + math (no three.js) so tests and other modules can import it.
// Written by Lone Keem.
export const PARK = { W: 100, H: 75 };                     // Pal Park half-size (x -100..100, z -75..75)
export const BOUNDS = { x0: -100, x1: 385, z0: -75, z1: 522 };   // whole walkable world (park sync range 0..10000 units)
// the east side (stage 3): a highway loop around Kemy Downtown, Clover Fields countryside and Sunny Shore beach
export const EAST = { x0: 100, x1: 385, z0: -75, z1: 522 };
export const HWY = { x0: 122, x1: 362, z0: -52, z1: 206, w: 12 };
export const DOWNTOWN = { x0: 138, x1: 232, z0: -38, z1: 84 };
export const FIELDS = { x0: 250, x1: 348, z0: 34, z1: 190 };
export const SHORE = { z0: 500, sea: 514, x0: 104, x1: 382 };
export const SNOW = { x0: 104, x1: 244, z0: 222, z1: 330 };
export const DESERT = { x0: 244, x1: 382, z0: 222, z1: 330 };
export const LAKE = { x: 245, z: 425, r: 34, y: 1.2 };
export const SEA_Y = 1.0;
// interiors live in a hidden strip east of the world (players are teleported in through the front door)
export const ROOMS = { x0: 400, x1: 520, z0: -70, z1: 200, cell: 14 };
export const roomState = { box: null };
export const FLAT = 2.4;                                   // street level
export const STREET = { z0: 77, z1: 170, x0: -95, x1: 95 };
// roads: { id, a:[x,z], b:[x,z], w } (two lanes, w = full width)
export const ROADS = [
  { id: 's1', a: [-95, 100], b: [122, 100], w: 8 }, { id: 's2', a: [-95, 145], b: [122, 145], w: 8 },
  { id: 'a1', a: [-64, 100], b: [-64, 145], w: 8 }, { id: 'a2', a: [64, 100], b: [64, 145], w: 8 }, { id: 'a0', a: [0, 100], b: [0, 145], w: 8 },
];
// stage 3 roads (no sidewalks on the highway): loop, the park link and downtown streets
export const ROADS2 = [
  { id: 'hN', a: [122, -52], b: [362, -52], w: 12, hw: 1 }, { id: 'hE', a: [362, -52], b: [362, 206], w: 12, hw: 1 },
  { id: 'hS', a: [362, 206], b: [122, 206], w: 12, hw: 1 }, { id: 'hW', a: [122, 206], b: [122, -52], w: 12, hw: 1 },
  { id: 'e0', a: [98, 0], b: [122, 0], w: 8 }, { id: 'd1', a: [122, 20], b: [362, 20], w: 8 }, { id: 'd2', a: [240, -52], b: [240, 206], w: 8 },
  { id: 'd3', a: [185, -52], b: [185, 100], w: 8 }, { id: 'd4', a: [122, 100], b: [240, 100], w: 8 },
  // southern towns: a second + third highway loop and town main streets
  { id: 'hW2', a: [122, 206], b: [122, 490], w: 12, hw: 1 }, { id: 'hE2', a: [362, 206], b: [362, 490], w: 12, hw: 1 }, { id: 'hS2', a: [362, 490], b: [122, 490], w: 12, hw: 1 },
  { id: 't1', a: [122, 270], b: [362, 270], w: 8 }, { id: 't2', a: [122, 355], b: [362, 355], w: 8 }, { id: 't3', a: [240, 206], b: [240, 270], w: 8 },
];
export const ALL_ROADS = () => ROADS.concat(ROADS2);
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
// towns (district banners + map labels). Kemy Street + Pal Park are the original centre.
export const TOWNS = [
  { id: 'park', name: '🌳 Pal Park', x: 0, z: 0 }, { id: 'street', name: '🎃 Kemy Street', x: 0, z: 122 },
  { id: 'down', name: '🏙️ Kemy Downtown', x: 185, z: 22, gate: [122, 100] }, { id: 'farm', name: '🌾 Clover Fields', x: 300, z: 60, gate: [300, 20] },
  { id: 'snow', name: '❄️ Frostberry Village', x: 178, z: 270, gate: [128, 270] }, { id: 'desert', name: '🌵 Sunstone Canyon', x: 300, z: 270, gate: [356, 270] },
  { id: 'lake', name: '🛶 Willow Lake', x: 245, z: 385, gate: [128, 355] }, { id: 'shore', name: '🏖️ Sunny Shore', x: 245, z: 495, gate: [128, 484] }];
const TOWN_ROWS = [ // rows of houses facing a road 16 m away (same lot shape as Kemy Street, so garages fit)
  { town: 'down', z: 116, face: -1, x0: 134, n: 7 }, { town: 'farm', z: 4, face: 1, x0: 256, n: 7 },
  { town: 'snow', z: 254, face: 1, x0: 136, n: 7 }, { town: 'snow', z: 286, face: -1, x0: 136, n: 7 },
  { town: 'desert', z: 254, face: 1, x0: 256, n: 7 }, { town: 'desert', z: 286, face: -1, x0: 256, n: 7 },
  { town: 'lake', z: 339, face: 1, x0: 136, n: 7 }, { town: 'lake', z: 371, face: -1, x0: 136, n: 7 }, { town: 'shore', z: 474, face: 1, x0: 136, n: 7 }];
export const TOWN_PAL = {
  down: { wall: ['#d9c2a7', '#c8d3df', '#e6cfc4', '#cfd9c8'], roof: ['#475569', '#334155', '#7c2d12'] },
  farm: { wall: ['#f5e6c8', '#fde7c7', '#e8dcc0'], roof: ['#b91c1c', '#7c2d12', '#365314'] },
  snow: { wall: ['#7c4a2a', '#8b5a3c', '#e2e8f0', '#9a6b4a'], roof: ['#f8fafc', '#f1f5f9'] },
  desert: { wall: ['#e9b872', '#d99c5b', '#f2d0a4', '#e7a96a'], roof: ['#b45309', '#c2410c', '#9a3412'] },
  lake: { wall: ['#8b5e34', '#a0703c', '#6b4a2f', '#c4a77d'], roof: ['#14532d', '#1e3a8a', '#3f3f46'] },
  shore: { wall: ['#bae6fd', '#fde68a', '#fbcfe8', '#bbf7d0', '#ffffff'], roof: ['#0ea5e9', '#f97316', '#14b8a6'] } };
{ let n = HOUSES.length; for (const [ri, row] of TOWN_ROWS.entries()) for (let k = 0; k < row.n; k++) { const x = row.x0 + 14 * k; const id = 'h' + String(++n).padStart(2, '0'); const seed = (k * 11 + ri * 17 + 5) % 97;
  HOUSES.push({ id, x, z: row.z, face: row.face, style: (k * 3 + ri + 1) % 4, seed, town: row.town, door: { x, z: row.z + row.face * 4.02 }, w: 9, d: 8 }); } }
// property: every third plot is for sale (one owner each); the rest are open "neighbor" houses you can visit + knock at
export const HOME_STYLES = [
  { key: 'cottage', name: 'Pumpkin Cottage', item: 'hs_cottage', p: 800 }, { key: 'twostory', name: 'Maple Two-Story', item: 'hs_twostory', p: 1500 },
  { key: 'ranch', name: 'Sunny Ranch', item: 'hs_ranch', p: 1100 }, { key: 'manor', name: 'Starlight Manor', item: 'z_hs_manor', d: 1200, productId: 'kemy_home_manor' }];
export const GARAGES = [{ tier: 1, name: 'Garage · 1 bay', item: 'gr_one', p: 400 }, { tier: 2, name: 'Garage · 2 bays', item: 'gr_two', p: 900 }, { tier: 3, name: 'Garage · 3 bays', item: 'z_gr_three', d: 800, productId: 'kemy_garage_three' }];
HOUSES.forEach((h, i) => { h.i = i; h.sale = i % 3 === 1; });
export const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function segD(x, z, r) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
export const roadD = (x, z) => { let d = 1e9; for (const r of ROADS.concat(ROADS2)) d = Math.min(d, segD(x, z, r) - r.w / 2); return d; };
// Pal Park calls this with its own park height h (already including its rim hills): the south edge melts into the flat
// street level and the outer world rim gets gentle hills.
export function worldGround(x, z, h) { const { W, H } = PARK;
  if (x > ROMS_X) return FLAT;
  const ws = Math.max(sstep(H - 14, H - 1, z), sstep(W - 14, W - 1, x)); if (ws <= 0) return h;
  const east = sstep(96, 112, x);
  // neighborhood rim (west + south of the street) fades out toward the east side
  const rimN = Math.max(BOUNDS.x0 + 10 - x, (z - 164) * (1 - east), 0);
  // east side: outer rim hills, rolling countryside, beach slope down to the sea
  const rimE = Math.max(x - 374, -66 - z, 0) * east;
  let base = FLAT + rimN * rimN * 0.09 + rimE * rimE * 0.12;
  if (east > 0) { const f = sstep(FIELDS.x0 - 4, FIELDS.x0 + 8, x) * (1 - sstep(FIELDS.x1 - 8, FIELDS.x1 + 2, x)) * sstep(FIELDS.z0, FIELDS.z0 + 10, z) * (1 - sstep(FIELDS.z1 - 10, FIELDS.z1, z));
    base += f * (Math.sin(x * 0.07) * Math.cos(z * 0.05) + 1) * 1.1 * Math.min(1, roadD(x, z) / 6);
    if (z > SHORE.z0) base -= (z - SHORE.z0) * 0.16 * sstep(100, 112, x);
    const ld = Math.hypot(x - LAKE.x, z - LAKE.z); if (ld < LAKE.r + 8) base -= (1 - sstep(LAKE.r - 6, LAKE.r + 8, ld)) * 2.6;
    // snowy peaks + red mesas behind the village/canyon rows (z 300..328), away from roads
    if (z > 296 && z < 332 && x > 128 && x < 356 && Math.abs(x - 240) > 8) { const k = Math.sin((z - 296) / 36 * Math.PI); base += k * (x < 244 ? 7 + Math.sin(x * 0.12) * 4 : 4 + (Math.sin(x * 0.2) > 0.3 ? 6 : 0)); } }
  return h + (base - h) * ws; }
const ROMS_X = 392;
export function worldClamp(x, z) { const { W, H } = PARK; void SNOW; void DESERT;
  if (roomState.box) { const b = roomState.box; return [Math.max(b.x0, Math.min(b.x1, x)), Math.max(b.z0, Math.min(b.z1, z))]; }
  x = Math.max(BOUNDS.x0 + 3, Math.min(BOUNDS.x1 - 3, x)); z = Math.max(BOUNDS.z0 + 3, Math.min(SHORE.sea + 4, z));
  if (x < 100 && z > 169) z = 169; // south of the neighborhood is hills
  { const dx = x - LAKE.x, dz = z - LAKE.z, d = Math.hypot(dx, dz); if (d < LAKE.r - 3) { x = LAKE.x + dx / d * (LAKE.r - 3); z = LAKE.z + dz / d * (LAKE.r - 3); } }
  if (z > 297 && z < 331 && x > 128 && x < 356 && Math.abs(x - 240) > 6) z = z < 314 ? 297 : 331; // peaks/mesas: walk around via the canyon pass
  void W; void H; return [x, z]; }
export const inStreet = (x, z) => z > PARK.H - 4 && x < 100;
export function areaAt(x, z) { if (x > ROMS_X) return '🏠 Inside'; if (z > SHORE.z0 - 30 && x > 100) return '🏖️ Sunny Shore';
  if (x > 100 && z > 330) return '🛶 Willow Lake'; if (x > 100 && z > 222) return x < 244 ? '❄️ Frostberry Village' : '🌵 Sunstone Canyon'; if (x > 100 && ROADS2.some((r) => r.hw && segD(x, z, r) < 9)) return '🛣️ Loop Highway'; if (x > 100 && z < 206 && x < 244 && z > -52) return '🏙️ Kemy Downtown'; if (x >= FIELDS.x0 - 6 && x < 380 && z < FIELDS.z1 + 6) return '🌾 Clover Fields';
  if (x > 104) return (x < 240 && z < 92) ? '🏙️ Kemy Downtown' : '🛣️ Loop Highway'; if (z > PARK.H + 2) return '🎃 Kemy Street'; return '🌳 Pal Park'; }
