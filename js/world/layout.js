// Kemy World layout: Pal Park (centre) + Kemy Street (the Halloween neighborhood, south of the park) and the shared
// ground / bounds hooks Pal Park uses. Pure data + math (no three.js) so tests and other modules can import it.
// Written by Lone Keem.
export const PARK = { W: 100, H: 75 };                     // Pal Park half-size (x -100..100, z -75..75)
export const BOUNDS = { x0: -1300, x1: 385, z0: -75, z1: 3460 };  // whole walkable world (presence 1 m = 16 units, rules allow x -40000..10000, y 0..60000)
export const OLD = { x0: -100, z1: 540 };                  // the original hand-made world (x >= -100, z <= 540); everything else streams in chunks (cities.js)
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
export const ROOMS = { x0: 400, x1: 520, z0: -70, z1: 530, cell: 20, per: 6, n: 180 }; // 6 per row x 30 rows; house i uses cell i % 180 (firestore.rules cellNo() mirrors this)
// mansion interiors are bigger: their own 40 m cells south of the strip (x 400..520, z 560..), one per estate
export const MROOMS = { x0: 400, z0: 560, cell: 40, per: 3 };
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
// stage 4: Open Plains, a huge flat meadow south of Kemy Street (x -97..118, z 172..540) for driving + building, joined to
// Kemy Street (east spine) and to the southern highway (x = 122) by long straight country roads
export const PLAINS = { x0: -97, x1: 118, z0: 174, z1: 540 };
export const ROADS3 = [
  { id: 'pa', a: [91, 145], b: [91, 440], w: 8, cr: 1 }, { id: 'pb', a: [-86, 270], b: [122, 270], w: 8, cr: 1 },
  { id: 'pc', a: [-86, 440], b: [122, 440], w: 8, cr: 1 }, { id: 'pd', a: [-40, 270], b: [-40, 440], w: 8, cr: 1 },
];
export const ALL_ROADS = () => ROADS.concat(ROADS2, ROADS3, ROADS4);
export const SIDEWALK = 2.6;
// the friendly entrance from Pal Park's south path
export const GATE = { x: 0, z: 79 };
export const PARK_CORNER = { x0: 6, x1: 58, z0: 106, z1: 139 };
// Kemy Patrol station: east of the center road, west of the gazebo. Original building, not a real department.
// door is just inside the west entrance. lotStreet / lotCountry are route points; a +1.5 lane heading
// north, or a -1.5 lane heading south, lands the car in the lot beside the door.
export const STATION = {
  x: 16, z: 122, x0: 9, x1: 23, z0: 116, z1: 128,
  door: [10.2, 122], desk: [18.4, 122],
  lotStreet: [4.8, 118], lotCountry: [4.8, 126]
};
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
  { id: 'lake', name: '🛶 Willow Lake', x: 245, z: 385, gate: [128, 355] }, { id: 'shore', name: '🏖️ Sunny Shore', x: 245, z: 495, gate: [128, 484] },
  { id: 'plains', name: '🌾 Open Plains', x: 10, z: 355 }];
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

// ---------------------------------------------------------------- stage 5: the big world. Six new cities west + south, long highways,
// rivers with bridges and private estates (mansions). Plot ids continue after h98 (old ids never change).
export const CITIES = [
  { id: 'maple', name: '🍁 Maplewood', x: -380, z: 260, wall: ['#f3d9b1', '#e8c39e', '#fde7c7', '#d9b48f'], roof: ['#9a3412', '#7c2d12', '#b45309'] },
  { id: 'bubble', name: '🫧 Bubbleton', x: -980, z: 260, wall: ['#cffafe', '#fbcfe8', '#e9d5ff', '#fef9c3'], roof: ['#0891b2', '#db2777', '#7c3aed'] },
  { id: 'rainbow', name: '🌈 Rainbow Ridge', x: -380, z: 1000, wall: ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe'], roof: ['#475569', '#1e293b', '#7c3aed'] },
  { id: 'pebble', name: '⚓ Pebble Harbor', x: -980, z: 1000, wall: ['#e2e8f0', '#f8fafc', '#cbd5e1', '#dbeafe'], roof: ['#1e3a8a', '#0f766e', '#334155'] },
  { id: 'honey', name: '🍯 Honeyhill', x: 0, z: 1000, wall: ['#fde68a', '#fcd34d', '#fef3c7', '#f5deb3'], roof: ['#92400e', '#78350f', '#a16207'] },
  { id: 'cloud', name: '☁️ Cloudport', x: 250, z: 960, wall: ['#f1f5f9', '#e0f2fe', '#ede9fe', '#ffffff'], roof: ['#0ea5e9', '#6366f1', '#64748b'] }];
for (const c of CITIES) { c.hx = 70; c.hz = 92; TOWNS.push({ id: c.id, name: c.name, x: c.x, z: c.z, city: 1 }); }
export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));
// water: rivers + the southern sea (axis-aligned rectangles; ground dips under them, roads cross on bridges)
export const WATER = [{ id: 'rv1', name: 'Silver River', x0: -660, x1: -630, z0: -90, z1: 670 }, { id: 'rv2', name: 'Willow River', x0: -1320, x1: 100, z0: 640, z1: 670 },
  { id: 'sea', name: 'Sparkle Sea', x0: 100, x1: 400, z0: 514, z1: 800 },
  { id: 'rv3', name: 'Ribbon River', x0: -1320, x1: 400, z0: 2040, z1: 2072 }, { id: 'rv4', name: 'Lullaby Lake', x0: -1320, x1: 400, z0: 3000, z1: 3034 }];
export const WATER_Y = 1.0;
const HWy = (id, a, b) => ({ id, a, b, w: 12, hw: 1, big: 1 }), St = (id, a, b, w = 8) => ({ id, a, b, w, big: 1 });
export const ROADS4 = [
  HWy('W1', [-95, 100], [-1240, 100]), HWy('W2', [-1240, 100], [-1240, 1400]), HWy('W3', [-1240, 1400], [372, 1400]), HWy('W4', [-520, 100], [-520, 1400]),
  HWy('W5', [91, 440], [91, 1400]), HWy('W6', [188, 490], [188, 894]),
  St('c1', [-442, 100], [-442, 194]), St('c2', [-520, 260], [-442, 260]), St('c3', [-1042, 100], [-1042, 194]), St('c4', [-520, 1000], [-442, 1000]),
  St('c5', [-1240, 1000], [-1042, 1000]), St('c6', [62, 1000], [91, 1000]), St('c7', [-318, 1066], [-318, 1400]), St('c8', [-918, 1066], [-918, 1400]), St('c9', [312, 1026], [312, 1400]),
  // private estate roads (the old palace drive is gone; that hillside is ordinary country now)
  St('e1', [-300, 100], [-300, 52], 6), St('e2', [-820, 100], [-820, 52], 6), St('e3', [-520, 560], [-200, 560], 6), St('e5', [-1240, 1180], [-1100, 1180], 6), St('e6', [312, 894], [372, 894], 6)];
for (const c of CITIES) { for (let j = 0; j < 4; j++) ROADS4.push(St(c.id + 's' + j, [c.x - 62, c.z - 66 + 44 * j], [c.x + 62, c.z - 66 + 44 * j]));
  for (const s of [-1, 1]) ROADS4.push(St(c.id + 'v' + (s > 0 ? 'e' : 'w'), [c.x + s * 62, c.z - 66], [c.x + s * 62, c.z + 66])); }
// 👑 the palace sits on the old Maple Heights pad (mansion size). No private lot and no second house.
export const ADMIN_HOME = { x: -300, z: 18, name: '👑 Kemy Palace' };
export const PALACE_SIGN = '👑 Kemy Palace';
export const PALACE_SIGN_AT = { x: 0, z: 32.2 }; // local: above the gate, on the clear drive
export const ESTATES = [ // big private plots: hillside (north), waterfront (river), end of a private road, seaside
  { x: -300, z: 18, face: 1, style: 4, spot: '⛰️ Maple Heights', skip: 1 }, { x: -820, z: 18, face: 1, style: 5, spot: '⛰️ Bubble Bluff' },
  { x: -440, z: 604, face: -1, style: 4, spot: '🌊 Riverside Lane' }, { x: -280, z: 604, face: -1, style: 5, spot: '🌊 Riverside Lane' },
  { x: -1100, z: 1222, face: -1, style: 4, spot: '🌲 Hidden Pines Road' }, { x: 342, z: 852, face: 1, style: 5, spot: '🏖️ Cloudport Cliffs' }];
{ let n = HOUSES.length; for (const c of CITIES) for (let j = 0; j < 4; j++) for (const s of [-1, 1]) for (let k = 0; k < 8; k++) { const z = c.z - 66 + 44 * j + s * 16, x = c.x - 49 + 14 * k, face = -s; const num = ++n;
    HOUSES.push({ id: 'hm' + num, num, x, z, face, style: num % 4, seed: (num * 13 + k * 7) % 97, town: c.id, city: c.id, door: { x, z: z + face * 4.02 }, w: 9, d: 8, cs: [0, 3, 5, 6].includes(num % 8) }); /* half for sale, every style (rules: n % 8 in [0, 3, 5, 6]) */ }
  for (const e of ESTATES) { const num = ++n; if (e.skip) continue; /* h483 stays unused so h484..h489 do not move */ HOUSES.push({ id: 'h' + num, x: e.x, z: e.z, face: e.face, style: e.style, seed: num % 97, town: 'estate', estate: 1, spot: e.spot, door: { x: e.x, z: e.z + e.face * 7.02 }, w: 18, d: 14 }); e.id = 'h' + num; }
  // 👑 the admin's palace, mansion-sized on the Maple Heights pad (never for sale; only the admin writes homes/h489)
  HOUSES.push({ id: 'h' + (++n), x: ADMIN_HOME.x, z: ADMIN_HOME.z, face: 1, style: 4, seed: 7, town: 'estate', estate: 1, admin: 1, spot: ADMIN_HOME.name, door: { x: ADMIN_HOME.x, z: ADMIN_HOME.z + 7.02 }, w: 18, d: 14 }); }
export const ADMIN_PLOT = 'h489';
// 🏙️ the Far South (stage 4): 12 big metro cities, every house for sale (h1000 .. h3591, style = number % 4).
// 6 streets x 2 sides x 18 houses each; highways between the rows, two rivers with bridges. Built only near the player (cities.js chunks).
export const METRO0 = 1000;
const MNAMES = [['berry', '🍓 Berrybrook'], ['butterfly', '🦋 Butterfly Bay'], ['sunflower', '🌻 Sunflower City'], ['candy', '🍭 Candy Cove'], ['shell', '🐚 Seashell Springs'], ['moon', '🌙 Moonbeam Meadows'],
  ['clover', '🍀 Clovertown'], ['balloon', '🎈 Balloon Bluffs'], ['buzz', '🐝 Buzzby'], ['cupcake', '🧁 Cupcake Corners'], ['starfall', '🌟 Starfall'], ['melon', '🍉 Melonville']];
const MPAL = [[['#fecdd3', '#fde2e4', '#fff1f2', '#fbcfe8'], ['#be123c', '#9f1239', '#7c3aed']], [['#dbeafe', '#e0e7ff', '#cffafe', '#f5f3ff'], ['#1d4ed8', '#0e7490', '#6d28d9']], [['#fef3c7', '#fde68a', '#fff7ed', '#ecfccb'], ['#a16207', '#4d7c0f', '#b45309']],
  [['#fce7f3', '#e9d5ff', '#ccfbf1', '#fef9c3'], ['#db2777', '#7c3aed', '#0d9488']], [['#f0fdfa', '#e0f2fe', '#fafaf9', '#fef3c7'], ['#0f766e', '#0369a1', '#78716c']], [['#e0e7ff', '#ede9fe', '#f1f5f9', '#e2e8f0'], ['#312e81', '#1e293b', '#4c1d95']]];
for (let i = 0; i < 12; i++) { const [id, name] = MNAMES[i]; const pal = MPAL[i % 6]; CITIES.push({ id, name, x: [-1000, -440, 120][i % 3], z: 1800 + 500 * Math.floor(i / 3), hx: 140, hz: 124, metro: 1, wall: pal[0], roof: pal[1] }); }
export const METROS = CITIES.filter((c) => c.metro);
for (const c of METROS) { TOWNS.push({ id: c.id, name: c.name, x: c.x, z: c.z, city: 1 }); CITY_BY_ID[c.id] = c; }
for (const z of [1650, 2150, 2650, 3150]) ROADS4.push(HWy('S' + z, [-1240, z], [372, z]));
ROADS4.push(HWy('SW', [-1240, 1400], [-1240, 3400]), HWy('SE', [372, 1400], [372, 3400]), HWy('SB', [-1240, 3400], [372, 3400]), HWy('SM', [-720, 1400], [-720, 3400]), HWy('SN', [-150, 1400], [-150, 3400]));
for (const c of METROS) { for (let j = 0; j < 6; j++) ROADS4.push(St(c.id + 's' + j, [c.x - 132, c.z - 110 + 44 * j], [c.x + 132, c.z - 110 + 44 * j]));
  for (const s of [-1, 1]) ROADS4.push(St(c.id + 'v' + (s > 0 ? 'e' : 'w'), [c.x + s * 132, c.z - 150], [c.x + s * 132, c.z + 110])); }
{ let num = METRO0; for (const c of METROS) for (let j = 0; j < 6; j++) for (const s of [-1, 1]) for (let k = 0; k < 18; k++) { const z = c.z - 110 + 44 * j + s * 16, x = c.x - 119 + 14 * k, face = -s;
  HOUSES.push({ id: 'hm' + num, num, x, z, face, style: num % 4, seed: (num * 13 + k * 7) % 997, town: c.id, city: c.id, door: { x, z: z + face * 4.02 }, w: 9, d: 8, cs: true }); num++; } }
// property: every third plot is for sale (one owner each); the rest are open "neighbor" houses you can visit + knock at
export const HOME_STYLES = [
  { key: 'cottage', name: 'Pumpkin Cottage', item: 'hs_cottage', p: 800 }, { key: 'twostory', name: 'Maple Two-Story', item: 'hs_twostory', p: 1500 },
  { key: 'ranch', name: 'Sunny Ranch', item: 'hs_ranch', p: 1100 }, { key: 'manor', name: 'Starlight Manor', item: 'z_hs_manor', d: 1200, productId: 'kemy_home_manor' },
  // 🏰 mansions: the top tier (estate plots only): biggest interiors, best yards, garages up to 15 cars
  { key: 'mansion', name: 'Moonbeam Mansion', item: 'z_hs_mansion', d: 3000, productId: 'kemy_home_mansion', big: 1 }, { key: 'estate', name: 'Sunrise Grand Estate', item: 'z_hs_estate', d: 5000, productId: 'kemy_home_estate', big: 1 }];
// garages: cap = cars inside (glass fronts, car lifts stack 2-3 high). Houses go up to tier 5, mansions up to tier 7.
export const GARAGES = [{ tier: 1, cap: 1, name: 'Garage · 1 car', item: 'gr_one', p: 400 }, { tier: 2, cap: 2, name: 'Garage · 2 cars', item: 'gr_two', p: 900 }, { tier: 3, cap: 3, name: 'Garage · 3 cars (car lift)', item: 'z_gr_three', d: 800, productId: 'kemy_garage_three' },
  { tier: 4, cap: 4, name: 'Glass Garage · 4 cars', item: 'z_gr_four', d: 1200, productId: 'kemy_garage_four' }, { tier: 5, cap: 6, name: 'Glass Car Tower · 6 cars', item: 'z_gr_five', d: 1600, productId: 'kemy_garage_five' },
  { tier: 6, cap: 10, name: 'Mansion Car Gallery · 10 cars', item: 'z_gr_six', d: 2400, productId: 'kemy_garage_six', big: 1 }, { tier: 7, cap: 15, name: 'Mansion Car Gallery · 15 cars', item: 'z_gr_seven', d: 3200, productId: 'kemy_garage_seven', big: 1 }];
export const maxTier = (h) => (h && h.admin ? 0 : h && h.estate ? 7 : 5);
export const ADMIN_CAP = 50;
// Front-yard bays on the Maple Heights pad (local metres, +z toward the road). Noses point at the
// centre drive so every car can pull out. The fountain and the house stay clear. 50 = ADMIN_CAP.
export function palaceBays() {
  const bays = []; const fountain = { x: -14, z: 20.5, r: 3.6 };
  for (let z = 13; z <= 29.2; z += 2.55) for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = side * (8 + i * 5.15), zz = Math.round(z * 10) / 10;
    if (Math.hypot(x - fountain.x, zz - fountain.z) < fountain.r + 2.2) continue;
    bays.push({ x, z: zz, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2 });
  }
  return bays.slice(0, ADMIN_CAP);
}
export const garageCap = (t) => (GARAGES[t - 1] ? GARAGES[t - 1].cap : 0);
HOUSES.forEach((h, i) => { h.i = i; h.sale = h.admin ? false : h.estate ? true : h.city ? h.cs : i % 3 === 1; });
export const ESTATE_IDS = ['h483', 'h484', 'h485', 'h486', 'h487', 'h488', 'h489']; // h483 has no house; cells stay put (rules inCellOk)
export const roomOf = (h) => { if (h.estate) { const k = ESTATE_IDS.indexOf(h.id); return { cx: MROOMS.x0 + MROOMS.cell / 2 + (k % MROOMS.per) * MROOMS.cell, cz: MROOMS.z0 + MROOMS.cell / 2 + Math.floor(k / MROOMS.per) * MROOMS.cell }; } const c = (h.num || h.i) % ROOMS.n; return { cx: ROOMS.x0 + ROOMS.cell / 2 + (c % ROOMS.per) * ROOMS.cell, cz: ROOMS.z0 + ROOMS.cell / 2 + Math.floor(c / ROOMS.per) * ROOMS.cell }; };
export const HOUSE_BY_ID = Object.fromEntries(HOUSES.map((h) => [h.id, h]));
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export function segD(x, z, r) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t); }
export const roadD = (x, z) => { let d = 1e9; for (const r of ROADS.concat(ROADS2, ROADS3, ROADS4)) d = Math.min(d, segD(x, z, r) - r.w / 2); return d; };

// ---------------------------------------------------------------- big-world ground: flat country, rivers, sea, rim hills, hillside estates
const rectD = (r, x, z) => { const dx = Math.max(r.x0 - x, x - r.x1), dz = Math.max(r.z0 - z, z - r.z1); return dx > 0 || dz > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) : Math.max(dx, dz); }; // < 0 inside
export const waterD = (x, z) => { let d = 1e9; for (const r of WATER) d = Math.min(d, rectD(r, x, z)); return d; };
// bridges: every road piece that crosses water (sampled once at load); the deck is the walkable/drivable ground
export const BRIDGES = (() => { const out = []; for (const r of ROADS2.concat(ROADS3, ROADS4)) { const [ax, az] = r.a, [bx, bz] = r.b; const L = Math.hypot(bx - ax, bz - az); let t0 = -1;
  for (let t = 0; t <= L; t += 2) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; const wet = waterD(x, z) < 7; if (wet && t0 < 0) t0 = t; if ((!wet || t + 2 > L) && t0 >= 0) { const t1 = wet ? L : t; const k0 = Math.max(0, t0 - 6) / L, k1 = Math.min(L, t1 + 6) / L;
    out.push({ id: r.id + '~' + out.length, road: r.id, a: [ax + (bx - ax) * k0, az + (bz - az) * k0], b: [ax + (bx - ax) * k1, az + (bz - az) * k1], w: r.w + 1.6 }); t0 = -1; } } } return out; })();
export const onBridge = (x, z) => { for (const b of BRIDGES) if (segD(x, z, b) < b.w / 2 + 0.6) return b; return null; };
export const GV = { nob: false }; // true while the old hand-built ground meshes are generated (no bridge decks baked into them)
export const isBig = (x, z) => x < OLD.x0 || z > OLD.z1;
export function bigGround(x, z) { let h = FLAT;
  // outer rim hills (soft-capped) at the world edge
  const e = Math.max(BOUNDS.x0 + 40 - x, z - (BOUNDS.z1 - 40), z > OLD.z1 ? x - (BOUNDS.x1 - 10) : 0, x < OLD.x0 ? BOUNDS.z0 + 30 - z : 0, 0); if (e > 0) h += 16 * (1 - Math.exp(-e * e * 0.02 / 16));
  // hills north of the west highway (the hillside estates sit on flat pads in them) + the Pal Park rim
  if (z < 64 && x < OLD.x0) { let k = (1 - sstep(-30, 64, z)) * (0.6 + 0.4 * Math.sin(x * 0.03) * Math.cos(z * 0.05)); for (const es of ESTATES) if (es.z < 100) { const d = Math.max(Math.abs(x - es.x) - 34, Math.abs(z - es.z) - 30, 0); k *= sstep(0, 18, d); } k *= sstep(4, 14, Math.min(Math.abs(x + 300), Math.abs(x + 820)) + Math.max(0, 40 - z)); h += k * 11; }
  if (x < OLD.x0 && x > -150 && z < 88) h += 13 * sstep(-150, -102, x) * sstep(95, 70, z);
  const wd = waterD(x, z); if (wd < 8) h = Math.min(h, FLAT - 3.6 * (1 - sstep(-3, 8, wd)));
  return h; }
// Pal Park calls this with its own park height h (already including its rim hills): the south edge melts into the flat
// street level and the outer world rim gets gentle hills.
export function worldGround(x, z, h) { const { W, H } = PARK;
  if (x > ROMS_X) return FLAT;
  if (!GV.nob && (z > 480 || x < OLD.x0) && onBridge(x, z)) return FLAT; if (isBig(x, z)) return bigGround(x, z);
  const ws = Math.max(sstep(H - 14, H - 1, z), sstep(W - 14, W - 1, x)); if (ws <= 0) return h;
  const east = sstep(96, 112, x);
  // neighborhood rim (west + south of the street) fades out toward the east side
  // (the south side of the street is now the Open Plains: only the far west / far south edges rise)
  const pl = x < PLAINS.x1 + 4 ? sstep(PLAINS.z0 - 8, PLAINS.z0, z) : 0;
  const rimN = Math.max(BOUNDS.x0 + 10 - x, (z - 164) * (1 - east) * (1 - pl), (z - PLAINS.z1) * (1 - east), 0);
  // east side: outer rim hills, rolling countryside, beach slope down to the sea
  const rimE = Math.max(x - 374, -66 - z, 0) * east;
  // rim hills are capped (soft) at ~16 m: they used to grow quadratically into km-high walls whose stretched grass
  // texture showed up as giant green/white streaks in the sky from the southern towns
  const cap = (v) => 16 * (1 - Math.exp(-v / 16));
  let base = FLAT + cap(rimN * rimN * 0.09) + cap(rimE * rimE * 0.12);
  if (pl > 0 && x < PLAINS.x1) base += pl * Math.sin(x * 0.031) * Math.cos(z * 0.027) * 0.25 * Math.min(1, Math.max(0, roadD(x, z) - 2) / 8); // almost perfectly flat
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
  x = Math.max(BOUNDS.x0 + 3, Math.min(BOUNDS.x1 - 3, x)); z = Math.max(BOUNDS.z0 + 3, Math.min(BOUNDS.z1 - 3, z));
  // no swimming: step back onto the bank (bridges are fine)
  if (waterD(x, z) < -1 && !onBridge(x, z)) for (const r of WATER) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { const o = [[r.x0 - 0.5 - x, 0], [r.x1 + 0.5 - x, 0], [0, r.z0 - 0.5 - z], [0, r.z1 + 0.5 - z]].filter(([dx, dz]) => !(r.id === 'sea' && dz > 0 && false)).sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]))[0]; x += o[0]; z += o[1]; break; }
  // south of the neighborhood is now the Open Plains (walk or drive straight in)
  { const dx = x - LAKE.x, dz = z - LAKE.z, d = Math.hypot(dx, dz); if (d < LAKE.r - 3) { x = LAKE.x + dx / d * (LAKE.r - 3); z = LAKE.z + dz / d * (LAKE.r - 3); } }
  if (z > 297 && z < 331 && x > 128 && x < 356 && Math.abs(x - 240) > 6) z = z < 314 ? 297 : 331; // peaks/mesas: walk around via the canyon pass
  void W; void H; return [x, z]; }
export const inStreet = (x, z) => z > PARK.H - 4 && x < 100;
export function areaAt(x, z) { if (x > ROMS_X) return '🏠 Inside';
  if (isBig(x, z)) { for (const c of CITIES) if (Math.abs(x - c.x) < c.hx + 10 && Math.abs(z - c.z) < c.hz + 4) return c.name; if (Math.hypot(x - ADMIN_HOME.x, z - ADMIN_HOME.z) < 45) return ADMIN_HOME.name; for (const e of ESTATES) if (!e.skip && Math.hypot(x - e.x, z - e.z) < 45) return e.spot; const b = onBridge(x, z); if (b) return '🌉 ' + (WATER.find((w) => rectD(w, x, z) < 10) || { name: 'Bridge' }).name + ' Bridge';
    if (ROADS4.some((r) => r.hw && segD(x, z, r) < 9)) return '🛣️ Kemy Highway'; return '🌲 Countryside'; } if (z > SHORE.z0 - 30 && x > 100) return '🏖️ Sunny Shore';
  if (x > 100 && z > 330) return '🛶 Willow Lake'; if (x > 100 && z > 222) return x < 244 ? '❄️ Frostberry Village' : '🌵 Sunstone Canyon'; if (x > 100 && ROADS2.some((r) => r.hw && segD(x, z, r) < 9)) return '🛣️ Loop Highway'; if (x > 100 && z < 206 && x < 244 && z > -52) return '🏙️ Kemy Downtown'; if (x >= FIELDS.x0 - 6 && x < 380 && z < FIELDS.z1 + 6) return '🌾 Clover Fields';
  if (x < PLAINS.x1 + 2 && z > PLAINS.z0 - 4) return '🌾 Open Plains';
  if (x > 104) return (x < 240 && z < 92) ? '🏙️ Kemy Downtown' : '🛣️ Loop Highway'; if (z > PARK.H + 2) return '🎃 Kemy Street'; return '🌳 Pal Park'; }

// spatial index (64 m cells) so per-frame checks only touch nearby houses (there are 3,000+)
const HG = new Map(); for (const h of HOUSES) { const k = Math.floor(h.x / 64) + ',' + Math.floor(h.z / 64); if (!HG.has(k)) HG.set(k, []); HG.get(k).push(h); }
export function housesNear(x, z, r) { const out = []; const x0 = Math.floor((x - r) / 64), x1 = Math.floor((x + r) / 64), z0 = Math.floor((z - r) / 64), z1 = Math.floor((z + r) / 64);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const a = HG.get(i + ',' + j); if (a) for (const h of a) out.push(h); } return out; }
