// Kemy Hill Rush: stages, vehicles, upgrades. Pure data (no DOM) so tests can run it in node.
// Units are meters / seconds. Vehicle art coordinates are y-DOWN (canvas style), origin at the body center.
// Every design here is original: generic vehicle types, no real brands, logos or other games' looks.
export const GAME_NAME = 'Kemy Hill Rush';

// 10 stages, all data + procedural terrain + canvas art (nothing extra to download).
// shape: wave = big hill length (m), climb = slow rise per m, plus a style flag the terrain generator understands.
// zone: an optional special strip that appears now and then (its own grip, drag, bounce, look).
export const STAGES = [
  { id: 'countryside', name: 'Countryside', emoji: '🌼', blurb: 'Rolling green hills, daisies and hay bales.', quirk: 'Easy start, nice grip', cost: 0, g: 10, grip: 1.0, amp: 1.0, rough: 0.9,
    shape: { wave: 55, climb: 0.012 }, sky: ['#6cc8ff', '#d9f4ff'], far: '#a7e08a', mid: '#7fcf63', dirt: '#b7743f', dirt2: '#8f5530', top: '#59c23a', top2: '#87e05f', deco: 'meadow', sun: '#fff3a8' },
  { id: 'dunes', name: 'Desert Dunes', emoji: '🌵', blurb: 'Big rolling dunes and cactus buddies.', quirk: 'Loose sand: less grip', cost: 300, g: 10, grip: 0.8, amp: 1.15, rough: 0.7,
    shape: { wave: 70, climb: 0.01, dunes: 1 }, zone: { kind: 'loose', p: 0.35, len: [10, 22], grip: 0.75, drag: 0.6 },
    sky: ['#ff9f6b', '#ffe6b5'], far: '#f2b277', mid: '#e79a58', dirt: '#e3ab62', dirt2: '#c98a45', top: '#f6cf86', top2: '#fff0c2', deco: 'desert', sun: '#fff6d8' },
  { id: 'snowy', name: 'Snowy Mountain', emoji: '❄️', blurb: 'Steep snowy slopes with icy patches.', quirk: 'Slippery ice patches', cost: 700, g: 10, grip: 0.72, amp: 1.3, rough: 1.0,
    shape: { wave: 50, climb: 0.02 }, zone: { kind: 'ice', p: 0.5, len: [8, 20], grip: 0.45 },
    sky: ['#8fb6ff', '#eef4ff'], far: '#c9d8f5', mid: '#a9bfe8', dirt: '#dfe8f7', dirt2: '#b8c8e4', top: '#ffffff', top2: '#e6f2ff', deco: 'snow', sun: '#ffffff' },
  { id: 'beach', name: 'Sunny Beach', emoji: '🏖️', blurb: 'Soft sand, palm trees and a wooden boardwalk.', quirk: 'Soft sand slows you, boardwalks are fast', cost: 1100, g: 10, grip: 0.9, amp: 0.8, rough: 0.6,
    shape: { wave: 60, climb: 0.006 }, drag: 0.35, zone: { kind: 'boardwalk', p: 0.55, len: [16, 28], grip: 1.1, drag: -1, flat: 1, lift: 0.8 },
    sky: ['#4fc3f7', '#e0f7ff'], far: '#5ad1e6', mid: '#36b5d8', dirt: '#f3d9a0', dirt2: '#e0be7c', top: '#ffe9b8', top2: '#fff6dc', deco: 'beach', sun: '#fffbe0' },
  { id: 'jungle', name: 'Jungle', emoji: '🌴', blurb: 'Muddy trails and wobbly vine bridges.', quirk: 'Mud slows you, vine bridges cross gaps', cost: 1600, g: 10, grip: 0.95, amp: 1.15, rough: 1.3,
    shape: { wave: 45, climb: 0.012 }, zone: { kind: 'bridge', p: 0.45, len: [12, 20], grip: 1.0, flat: 1, sag: 0.9, gap: 7 }, zone2: { kind: 'mud', p: 0.4, len: [8, 16], grip: 0.7, drag: 1.2 },
    sky: ['#7ed6a5', '#e2fbe9'], far: '#3fae6c', mid: '#2a8f55', dirt: '#6b4a2b', dirt2: '#4d331c', top: '#3fbf4a', top2: '#7be06c', deco: 'jungle', sun: '#fffbd0' },
  { id: 'volcano', name: 'Volcano', emoji: '🌋', blurb: 'Steep rocky peaks with glowing lava pools.', quirk: 'Lava pools burn fuel fast: jump them!', cost: 2200, g: 10, grip: 1.05, amp: 1.3, rough: 1.0,
    shape: { wave: 60, climb: 0.024, steep: 1 }, zone: { kind: 'lava', p: 0.4, len: [6, 11], grip: 0.9, dip: 1.4, drag: 0.5 },
    sky: ['#3a1730', '#ff7a45'], far: '#5a2a3a', mid: '#432036', dirt: '#4a3340', dirt2: '#33222c', top: '#6e5060', top2: '#ff9a5a', deco: 'volcano', sun: '#ffcc66', glow: '#ff6a2a' },
  { id: 'candy', name: 'Candy Land', emoji: '🍬', blurb: 'Wobbly jelly hills and lollipop trees.', quirk: 'Bouncy jelly hills', cost: 2900, g: 9, grip: 1.0, amp: 1.2, rough: 0.5, bounce: 0.25,
    shape: { wave: 38, climb: 0.01, round: 1 }, zone: { kind: 'jelly', p: 0.55, len: [8, 18], grip: 1.0, bounce: 0.75 },
    sky: ['#ffd1e8', '#fff4fb'], far: '#ffc2dd', mid: '#c7b6ff', dirt: '#ff9ccb', dirt2: '#f27eb5', top: '#ffffff', top2: '#9ff0d6', deco: 'candy', sun: '#ffffff' },
  { id: 'city', name: 'City Rooftops', emoji: '🏙️', blurb: 'Jump from roof to roof with ramps.', quirk: 'Ramps and gaps between buildings', cost: 3700, g: 10, grip: 1.05, amp: 1.0, rough: 0,
    shape: { city: 1 }, sky: ['#5b8def', '#cfe0ff'], far: '#9db4e8', mid: '#7f97d6', dirt: '#7b7f99', dirt2: '#5f6380', top: '#b6bad0', top2: '#e2e5f2', deco: 'city', sun: '#fff7d0' },
  { id: 'spooky', name: 'Spooky Night', emoji: '👻', blurb: 'A dark, friendly night with cute ghosts.', quirk: 'Dark: your headlights light the way', cost: 4600, g: 10, grip: 0.95, amp: 1.15, rough: 1.2, night: 1,
    shape: { wave: 48, climb: 0.012 }, sky: ['#141238', '#3a2f6b'], far: '#2a2552', mid: '#221d45', dirt: '#3b2f4f', dirt2: '#2a2139', top: '#5a4a7a', top2: '#9b8ad0', deco: 'spooky', sun: '#fff6c8' },
  { id: 'moon', name: 'Moon', emoji: '🌙', blurb: 'Low gravity and huge crater jumps.', quirk: 'Low gravity: floaty jumps', cost: 5600, g: 3.3, grip: 0.9, amp: 1.55, rough: 0.9,
    shape: { wave: 60, climb: 0.008, craters: 1 }, sky: ['#0d0b2e', '#2f2468'], far: '#3b3570', mid: '#575092', dirt: '#8f8aa8', dirt2: '#6d6889', top: '#c9c5e0', top2: '#e8e5f7', deco: 'moon', sun: '#f2ecff' }
];
export const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// seat: hip point (x, y) where the driver sits, top = roof/roll-bar line (driver head must fit under it),
// w = max driver width, lean = base lean (radians, + leans back), sw = steering wheel center, open = no roof.
// hull: convex physics shape (y-down). wheels: attach points (y-down), r = radius, drive = motor on that axle.
export const VEHICLES = [
  { id: 'scout', name: 'Scout 4x4', type: 'Starter off-roader', cost: 0, body: '#3fb26b', acc: '#ffd23f', kind: 'scout',
    hull: [[-1.62, -0.05], [-1.2, -0.32], [0.95, -0.3], [1.62, -0.08], [1.62, 0.32], [-1.62, 0.36]],
    wheels: [{ x: -1.08, y: 0.48, r: 0.47, drive: 1 }, { x: 1.1, y: 0.48, r: 0.47, drive: 1 }],
    dens: 1.0, wdens: 0.9, hz: 4.2, zeta: 0.62, grip: 1.0, torque: 26, speed: 34, air: 4.2, fuel: 36, use: 1,
    seat: { x: -0.35, y: -0.18, top: -1.42, w: 0.95, lean: 0.06, sw: [0.32, -0.62], open: true } },
  { id: 'zoom', name: 'Zoomster', type: 'Sports car', cost: 400, body: '#ff4f6d', acc: '#ffffff', kind: 'sports',
    hull: [[-1.9, -0.05], [-0.9, -0.36], [1.4, -0.22], [1.95, 0.02], [1.95, 0.26], [-1.9, 0.3]],
    wheels: [{ x: -1.25, y: 0.36, r: 0.38, drive: 1 }, { x: 1.28, y: 0.36, r: 0.38, drive: 0 }],
    dens: 0.85, wdens: 0.8, hz: 5.6, zeta: 0.75, grip: 0.95, torque: 24, speed: 62, air: 3.2, fuel: 30, use: 1.15,
    seat: { x: -0.45, y: -0.12, top: -1.22, w: 0.85, lean: 0.16, sw: [0.15, -0.46], open: false } },
  { id: 'hauler', name: 'Hauler', type: 'Pickup truck', cost: 800, body: '#4a8df0', acc: '#e8f1ff', kind: 'pickup',
    hull: [[-2.0, -0.12], [-2.0, 0.34], [2.0, 0.34], [2.0, -0.06], [1.2, -0.3], [-2.0, -0.14]],
    wheels: [{ x: -1.3, y: 0.5, r: 0.5, drive: 1 }, { x: 1.3, y: 0.5, r: 0.5, drive: 1 }],
    dens: 1.05, wdens: 0.95, hz: 3.8, zeta: 0.6, grip: 1.05, torque: 34, speed: 38, air: 4.0, fuel: 44, use: 1.1,
    seat: { x: 0.12, y: -0.2, top: -1.5, w: 0.9, lean: 0.06, sw: [0.75, -0.62], open: false } },
  { id: 'buggy', name: 'Dune Hopper', type: 'Dune buggy', cost: 1200, body: '#ff9f1c', acc: '#2b1d55', kind: 'buggy',
    hull: [[-1.45, -0.05], [-0.8, -0.3], [1.2, -0.12], [1.5, 0.1], [1.2, 0.3], [-1.45, 0.3]],
    wheels: [{ x: -1.08, y: 0.5, r: 0.52, drive: 1 }, { x: 1.12, y: 0.46, r: 0.44, drive: 0 }],
    dens: 0.7, wdens: 0.7, hz: 3.0, zeta: 0.45, grip: 1.12, torque: 22, speed: 44, air: 5.2, fuel: 32, use: 0.9,
    seat: { x: -0.25, y: -0.12, top: -1.38, w: 0.95, lean: 0.12, sw: [0.38, -0.55], open: true } },
  { id: 'rally', name: 'Rally Comet', type: 'Rally car', cost: 2000, body: '#ffffff', acc: '#1fa2ff', kind: 'rally',
    hull: [[-1.8, -0.02], [-1.2, -0.5], [0.6, -0.52], [1.8, -0.06], [1.8, 0.28], [-1.8, 0.3]],
    wheels: [{ x: -1.2, y: 0.42, r: 0.42, drive: 1 }, { x: 1.2, y: 0.42, r: 0.42, drive: 1 }],
    dens: 0.9, wdens: 0.85, hz: 4.6, zeta: 0.68, grip: 1.15, torque: 30, speed: 52, air: 3.8, fuel: 36, use: 1.05,
    seat: { x: -0.3, y: -0.1, top: -1.28, w: 0.85, lean: 0.1, sw: [0.3, -0.5], open: false } },
  { id: 'patrol', name: 'Patrol Cruiser', type: 'Police cruiser', cost: 3000, body: '#24305e', acc: '#ffffff', kind: 'patrol',
    hull: [[-2.05, -0.06], [-1.3, -0.4], [1.2, -0.38], [2.05, -0.08], [2.05, 0.28], [-2.05, 0.3]],
    wheels: [{ x: -1.35, y: 0.42, r: 0.43, drive: 1 }, { x: 1.35, y: 0.42, r: 0.43, drive: 0 }],
    dens: 1.0, wdens: 0.9, hz: 4.8, zeta: 0.7, grip: 1.0, torque: 30, speed: 56, air: 3.4, fuel: 40, use: 1.1,
    seat: { x: -0.25, y: -0.12, top: -1.32, w: 0.9, lean: 0.1, sw: [0.38, -0.52], open: false } },
  { id: 'bus', name: 'Kemy School Bus', type: 'School bus', cost: 4000, body: '#ffc21a', acc: '#2b2b2b', kind: 'bus',
    hull: [[-2.6, -1.55], [2.3, -1.55], [2.65, -0.9], [2.65, 0.4], [-2.6, 0.4]],
    wheels: [{ x: -1.7, y: 0.55, r: 0.5, drive: 1 }, { x: 1.75, y: 0.55, r: 0.5, drive: 0 }],
    dens: 0.55, wdens: 1.0, hz: 3.4, zeta: 0.7, grip: 1.0, torque: 46, speed: 34, air: 2.2, fuel: 60, use: 1.2,
    seat: { x: 1.62, y: -0.42, top: -1.5, w: 0.85, lean: 0.02, sw: [2.15, -0.75], open: false } },
  { id: 'tractor', name: 'Furrow Tractor', type: 'Farm tractor', cost: 5000, body: '#e84b3c', acc: '#ffd23f', kind: 'tractor',
    hull: [[-1.2, -0.5], [-0.4, -0.6], [1.55, -0.3], [1.55, 0.2], [-1.2, 0.25]],
    wheels: [{ x: -0.85, y: 0.25, r: 0.82, drive: 1 }, { x: 1.15, y: 0.45, r: 0.5, drive: 0 }],
    dens: 1.2, wdens: 0.8, hz: 3.6, zeta: 0.6, grip: 1.3, torque: 24, speed: 21, air: 3.0, fuel: 55, use: 0.85,
    seat: { x: -0.6, y: -0.62, top: -1.95, w: 0.95, lean: 0.04, sw: [-0.05, -1.02], open: true } },
  { id: 'stomp', name: 'Big Stomp', type: 'Monster truck', cost: 7000, body: '#8a55dc', acc: '#5cf2b5', kind: 'monster',
    hull: [[-1.8, -0.55], [0.8, -0.62], [1.85, -0.3], [1.85, 0.12], [-1.8, 0.16]],
    wheels: [{ x: -1.25, y: 0.62, r: 0.82, drive: 1 }, { x: 1.25, y: 0.62, r: 0.82, drive: 1 }],
    dens: 0.95, wdens: 0.55, hz: 2.6, zeta: 0.5, grip: 1.25, torque: 70, speed: 32, air: 5.0, fuel: 46, use: 1.3,
    seat: { x: -0.1, y: -0.7, top: -1.98, w: 0.95, lean: 0.06, sw: [0.5, -1.08], open: false } },
  { id: 'rig', name: 'Road Boss', type: 'Big rig cab', cost: 9000, body: '#2fb6c9', acc: '#f2f6ff', kind: 'rig',
    hull: [[-2.3, -0.3], [-0.2, -1.85], [1.1, -1.85], [2.3, -0.75], [2.3, 0.35], [-2.3, 0.35]],
    wheels: [{ x: -1.55, y: 0.58, r: 0.55, drive: 1 }, { x: -0.55, y: 0.58, r: 0.55, drive: 1 }, { x: 1.55, y: 0.58, r: 0.55, drive: 0 }],
    dens: 0.75, wdens: 1.0, hz: 3.6, zeta: 0.7, grip: 1.05, torque: 64, speed: 38, air: 2.6, fuel: 70, use: 1.25,
    seat: { x: 0.55, y: -0.58, top: -1.72, w: 0.9, lean: 0.03, sw: [1.2, -0.95], open: false } },
  { id: 'rover', name: 'Star Rover', type: 'Moon rover', cost: 12000, body: '#e8ecf7', acc: '#ff7ac8', kind: 'rover',
    hull: [[-1.55, -0.2], [1.55, -0.2], [1.7, 0.12], [-1.7, 0.12]],
    wheels: [{ x: -1.25, y: 0.42, r: 0.42, drive: 1 }, { x: 0, y: 0.42, r: 0.42, drive: 1 }, { x: 1.25, y: 0.42, r: 0.42, drive: 1 }],
    dens: 0.8, wdens: 0.8, hz: 3.2, zeta: 0.5, grip: 1.2, torque: 26, speed: 40, air: 5.5, fuel: 50, use: 0.8,
    seat: { x: -0.2, y: -0.32, top: -1.62, w: 1.0, lean: 0.06, sw: [0.42, -0.72], open: true } }
];
export const VEHICLE = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

export const UPGRADES = [
  { id: 'engine', name: 'Engine', icon: '⚙️', what: 'More pull and top speed' },
  { id: 'susp', name: 'Suspension', icon: '🌀', what: 'Smoother, bouncier landings' },
  { id: 'tires', name: 'Tires', icon: '🛞', what: 'More grip on hills and ice' },
  { id: 'tank', name: 'Fuel Tank', icon: '💧', what: 'Drive further on one fill' }
];
export const MAX_LV = 5;
export function upgradeCost(v, up, lv) { const base = 40 + Math.round((VEHICLE[v]?.cost || 0) / 25); return Math.round(base * Math.pow(lv + 1, 1.6) / 5) * 5 + (up === 'engine' ? 10 : 0); }

// Final physics numbers for a vehicle with its upgrade levels { engine, susp, tires, tank } (0..5).
export function tuned(id, ups = {}) {
  const v = VEHICLE[id] || VEHICLES[0]; const L = (k) => Math.max(0, Math.min(MAX_LV, ups[k] | 0));
  return { ...v, torque: v.torque * (1 + 0.13 * L('engine')), speed: v.speed * (1 + 0.06 * L('engine')),
    hz: v.hz * (1 + 0.05 * L('susp')), zeta: Math.min(0.95, v.zeta + 0.04 * L('susp')),
    grip: v.grip * (1 + 0.07 * L('tires')), fuel: v.fuel * (1 + 0.16 * L('tank')) };
}

// Rewards
export const STAR_FLIP = 5;          // in-run Rush Stars per flip
export const STAR_CHECK = 25;        // per checkpoint
export const DIA_RUN_CAP = 5;        // Kemy diamonds per run
export const DIA_DAY_CAP = 20;       // Kemy diamonds per day from this game (the wallet's own server caps also apply)
export const COIN_RUN_CAP = 10;      // Kemy Star Coins per solo run (source 'win', server-capped at 150/day)
export const COIN_DAY_CAP = 40;      // Kemy Star Coins per day from solo runs of this game
export const RACE_LEN = { sprint: 600, classic: 1200 };
