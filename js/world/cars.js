// Kemy Cars: original, code-built cartoon-realistic cars for the Kemy open world (Pal Park + Kemy Street + roads).
// Every design here is original (no real brands, logos or copies of real models); the only badge is the KL logo.
// Shop: a free starter, Star Coin cars (inv car_<id>) and Diamond premium cars (inv z_car_<id>, placeholder
// productId kemy_car_<id> for a possible future store, NO real-money flow). Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

export const CARS = [
  { id: 'pip', name: 'Pocket Pip', style: 'mini', emoji: '🚗', free: 1, blurb: 'A tiny, bubbly city car. Everyone starts with one!',
    L: 3.1, Wd: 1.62, H: 1.45, wr: 0.32, mass: 850, torque: 150, redline: 6800, gears: [3.4, 2.1, 1.45, 1.05], fd: 4.1, grip: 1.05, steer: 0.62, top: 16, susp: 26, damp: 2.6, color: 6 },
  { id: 'star', name: 'Star Racer', style: 'coupe', emoji: '🏎️', p: 450, blurb: 'A smooth sporty coupe with a little ducktail.',
    L: 4.3, Wd: 1.86, H: 1.3, wr: 0.34, mass: 1300, torque: 330, redline: 7400, gears: [3.3, 2.2, 1.6, 1.25, 1.0, 0.82], fd: 3.7, grip: 1.15, steer: 0.55, top: 27, susp: 34, damp: 3.2, color: 0 },
  { id: 'cruise', name: 'Moonlight Cruiser', style: 'cruiser', emoji: '🚙', p: 650, blurb: 'A long classic cruiser with chrome and tail fins.',
    L: 5.0, Wd: 1.96, H: 1.42, wr: 0.36, mass: 1650, torque: 380, redline: 5600, gears: [2.9, 1.8, 1.25, 1.0], fd: 3.3, grip: 0.95, steer: 0.5, top: 22, susp: 22, damp: 2.4, color: 3 },
  { id: 'bear', name: 'Trail Bear', style: 'truck', truck: 1, emoji: '🛻', p: 900, blurb: 'A tall off-road truck with chunky tires and a light bar.',
    L: 4.9, Wd: 2.06, H: 1.95, wr: 0.48, mass: 2300, torque: 560, redline: 5200, gears: [3.8, 2.4, 1.6, 1.15, 0.9], fd: 3.9, grip: 1.0, steer: 0.52, top: 20, susp: 18, damp: 2.0, color: 2 },
  { id: 'comet', name: 'Purple Comet', style: 'super', emoji: '☄️', d: 1200, prem: 1, blurb: 'A low, wide supercar with a glowing wing. Premium.',
    L: 4.5, Wd: 2.0, H: 1.12, wr: 0.36, mass: 1400, torque: 600, redline: 8400, gears: [3.1, 2.2, 1.65, 1.3, 1.08, 0.92, 0.8], fd: 3.5, grip: 1.3, steer: 0.5, top: 35, susp: 44, damp: 4.0, color: 1 },
  { id: 'aurora', name: 'Aurora GT', style: 'gt', emoji: '🌌', d: 1600, prem: 1, blurb: 'A long-nose grand tourer with an aurora light strip. Premium.',
    L: 4.8, Wd: 1.98, H: 1.2, wr: 0.37, mass: 1550, torque: 650, redline: 7800, gears: [3.0, 2.1, 1.6, 1.28, 1.05, 0.88, 0.76], fd: 3.4, grip: 1.22, steer: 0.5, top: 33, susp: 38, damp: 3.6, color: 4 },
  // ✨ premium sports line (original designs, no real brands): faster + grippier than the regular cars
  { id: 'nova', name: 'Nova Arrow', style: 'super', emoji: '💫', d: 1800, prem: 1, sport: 1, blurb: 'A razor-thin supercar with a split light bar. Premium sports.',
    L: 4.5, Wd: 2.0, H: 1.08, wr: 0.36, mass: 1350, torque: 680, redline: 8800, gears: [3.1, 2.25, 1.7, 1.36, 1.12, 0.95, 0.82], fd: 3.6, grip: 1.38, steer: 0.52, top: 39, susp: 46, damp: 4.2, color: 10 },
  { id: 'blaze', name: 'Solar Blaze', style: 'super', emoji: '🔥', d: 2200, prem: 1, sport: 1, blurb: 'A hypercar with a tall glowing fin and twin wings. Premium sports.',
    L: 4.7, Wd: 2.06, H: 1.06, wr: 0.37, mass: 1300, torque: 780, redline: 9200, gears: [3.0, 2.2, 1.7, 1.38, 1.15, 0.98, 0.86], fd: 3.6, grip: 1.45, steer: 0.5, top: 44, susp: 50, damp: 4.6, color: 4 },
  { id: 'tide', name: 'Tidal Spark', style: 'coupe', emoji: '🌊', p: 2400, sport: 1, blurb: 'A curvy sports coupe with a ducktail and ocean shine.',
    L: 4.35, Wd: 1.9, H: 1.24, wr: 0.35, mass: 1250, torque: 460, redline: 8000, gears: [3.3, 2.2, 1.6, 1.28, 1.04, 0.86], fd: 3.7, grip: 1.28, steer: 0.56, top: 33, susp: 38, damp: 3.6, color: 3 },
  { id: 'breeze', name: 'Sunny Breeze', style: 'coupe', conv: 1, emoji: '🌞', p: 2800, sport: 1, blurb: 'A top-down roadster for sunny drives. Convertible.',
    L: 4.2, Wd: 1.86, H: 1.18, wr: 0.34, mass: 1180, torque: 430, redline: 7800, gears: [3.3, 2.2, 1.6, 1.28, 1.04, 0.86], fd: 3.7, grip: 1.3, steer: 0.58, top: 32, susp: 38, damp: 3.6, color: 9 },
  { id: 'glide', name: 'Velvet Glide', style: 'gt', conv: 1, emoji: '🎀', d: 1700, prem: 1, sport: 1, blurb: 'A long open-top grand tourer with a soft light strip. Premium convertible.',
    L: 4.8, Wd: 1.98, H: 1.16, wr: 0.37, mass: 1500, torque: 640, redline: 7800, gears: [3.0, 2.1, 1.6, 1.28, 1.05, 0.88, 0.76], fd: 3.4, grip: 1.3, steer: 0.52, top: 37, susp: 40, damp: 3.8, color: 6 },
  { id: 'storm', name: 'Thunder Kite', style: 'gt', emoji: '⚡', d: 2000, prem: 1, sport: 1, blurb: 'A muscular GT with a lightning stripe glow. Premium sports.',
    L: 4.75, Wd: 2.02, H: 1.18, wr: 0.38, mass: 1520, torque: 720, redline: 8200, gears: [3.0, 2.15, 1.62, 1.3, 1.08, 0.9, 0.78], fd: 3.5, grip: 1.36, steer: 0.5, top: 40, susp: 42, damp: 4.0, color: 8 },
  { id: 'aurum', name: 'Golden Meteor', style: 'super', emoji: '🌠', d: 3000, prem: 1, sport: 1, blurb: 'The fastest Kemy hypercar: low, wide and gleaming. Premium sports.',
    L: 4.8, Wd: 2.1, H: 1.04, wr: 0.38, mass: 1280, torque: 860, redline: 9500, gears: [2.95, 2.2, 1.72, 1.4, 1.18, 1.0, 0.88], fd: 3.6, grip: 1.5, steer: 0.5, top: 48, susp: 52, damp: 4.8, color: 9 },
  { id: 'pixie', name: 'Pixie Dash', style: 'coupe', conv: 1, emoji: '🧚', p: 2000, sport: 1, blurb: 'A tiny, zippy sports convertible that corners like a go-kart.',
    L: 3.8, Wd: 1.76, H: 1.12, wr: 0.32, mass: 980, torque: 330, redline: 8400, gears: [3.4, 2.3, 1.7, 1.34, 1.1, 0.92], fd: 3.9, grip: 1.34, steer: 0.62, top: 30, susp: 40, damp: 3.6, color: 11 },
  // 🏁 2026 garage expansion (original low-poly designs, no real brands). Appended: CAR_IDX order is part of the sync code.
  { id: 'zapper', name: 'Zap Wedge', style: 'wedge', emoji: '⚡', p: 3200, sport: 1, blurb: 'A low, pointy wedge with pop-up lights. Super quick off the line.',
    L: 4.3, Wd: 1.9, H: 1.1, wr: 0.34, mass: 1200, torque: 520, redline: 8600, gears: [3.2, 2.25, 1.7, 1.35, 1.1, 0.92], fd: 3.7, grip: 1.36, steer: 0.54, top: 37, susp: 44, damp: 4.0, color: 9 },
  { id: 'ripple', name: 'Ripple Coupe', style: 'fastback', emoji: '🌀', p: 2600, sport: 1, blurb: 'A smooth fastback coupe with a long sloping roof.',
    L: 4.45, Wd: 1.88, H: 1.26, wr: 0.35, mass: 1320, torque: 450, redline: 7800, gears: [3.3, 2.2, 1.6, 1.28, 1.04, 0.86], fd: 3.7, grip: 1.26, steer: 0.55, top: 33, susp: 36, damp: 3.5, color: 10 },
  { id: 'hoof', name: 'Thunder Hoof', style: 'muscle', emoji: '🐎', p: 3000, sport: 1, blurb: 'A big-engine muscle car with a hood scoop. Loud and proud (and a bit wiggly).',
    L: 4.9, Wd: 1.98, H: 1.34, wr: 0.37, mass: 1650, torque: 720, redline: 6800, gears: [2.9, 1.95, 1.4, 1.1, 0.9], fd: 3.4, grip: 1.12, steer: 0.5, top: 35, susp: 30, damp: 3.0, rg: 0.92, color: 0 },
  { id: 'roady', name: 'Breezy Roadster', style: 'roadster', conv: 1, emoji: '🍃', p: 2700, sport: 1, blurb: 'A tiny two-seat roadster with roll hoops. Light and nimble.',
    L: 3.95, Wd: 1.78, H: 1.12, wr: 0.33, mass: 1000, torque: 360, redline: 8200, gears: [3.4, 2.3, 1.7, 1.34, 1.1, 0.92], fd: 3.9, grip: 1.32, steer: 0.62, top: 31, susp: 40, damp: 3.6, color: 5 },
  { id: 'halo', name: 'Hyper Halo', style: 'hyper', emoji: '🪐', d: 2600, prem: 1, sport: 1, blurb: 'A bubble-canopy hypercar with a shark fin. Premium sports.',
    L: 4.75, Wd: 2.08, H: 1.06, wr: 0.37, mass: 1260, torque: 840, redline: 9400, gears: [2.95, 2.2, 1.72, 1.4, 1.18, 1.0, 0.88], fd: 3.6, grip: 1.48, steer: 0.5, top: 46, susp: 52, damp: 4.8, color: 1 },
  { id: 'foxy', name: 'Drift Fox', style: 'drift', emoji: '🦊', p: 3400, sport: 1, blurb: 'A light rear-drive drift coupe. The tail loves to slide (Drift mode on = big smoky slides).',
    L: 4.25, Wd: 1.84, H: 1.24, wr: 0.34, mass: 1180, torque: 480, redline: 8400, gears: [3.3, 2.25, 1.65, 1.3, 1.06, 0.88], fd: 3.9, grip: 1.18, steer: 0.68, top: 32, susp: 40, damp: 3.6, rg: 0.86, color: 3 },
  { id: 'sunny', name: 'Sunny Pickup', style: 'pickup', truck: 1, emoji: '🛻', p: 1800, blurb: 'A friendly everyday pickup with a big open bed.',
    L: 5.0, Wd: 2.0, H: 1.82, wr: 0.44, mass: 2000, torque: 480, redline: 5600, gears: [3.6, 2.3, 1.55, 1.12, 0.9], fd: 3.8, grip: 1.0, steer: 0.52, top: 22, susp: 20, damp: 2.2, color: 9 },
  { id: 'rocky', name: 'Rock Hopper 4x4', style: 'lifted', truck: 1, emoji: '🏔️', p: 3600, blurb: 'A lifted off-road 4x4 with a snorkel and huge tires.',
    L: 4.9, Wd: 2.12, H: 2.2, wr: 0.56, mass: 2400, torque: 640, redline: 5200, gears: [4.0, 2.5, 1.65, 1.2, 0.92], fd: 4.0, grip: 1.0, steer: 0.5, top: 21, susp: 16, damp: 1.9, color: 5 },
  { id: 'stomp', name: 'Mega Stomp', style: 'monster', truck: 1, emoji: '🦖', d: 2400, prem: 1, blurb: 'A monster truck with giant wheels that rolls over anything. Premium.',
    L: 4.8, Wd: 2.5, H: 3.0, wr: 0.92, mass: 3000, torque: 1100, redline: 5000, gears: [4.2, 2.6, 1.7, 1.2], fd: 3.6, grip: 0.98, steer: 0.5, top: 20, susp: 12, damp: 1.6, color: 2 },
  { id: 'parcel', name: 'Parcel Pal', style: 'box', truck: 1, emoji: '📦', p: 2200, blurb: 'A box delivery truck. Big, slow and very helpful.',
    L: 6.0, Wd: 2.3, H: 2.9, wr: 0.5, mass: 3600, torque: 700, redline: 4600, gears: [4.4, 2.7, 1.7, 1.2, 0.9], fd: 4.1, grip: 0.95, steer: 0.48, top: 18, susp: 16, damp: 2.0, color: 7 },
  { id: 'hooky', name: 'Hook Buddy', style: 'tow', truck: 1, emoji: '🪝', p: 2500, blurb: 'A tow truck with a boom and a hook (for show, it never takes other cars).',
    L: 5.4, Wd: 2.1, H: 2.0, wr: 0.46, mass: 2800, torque: 620, redline: 5000, gears: [4.0, 2.5, 1.6, 1.15, 0.9], fd: 4.0, grip: 0.98, steer: 0.5, top: 20, susp: 18, damp: 2.1, color: 4 },
  { id: 'whale', name: 'Road Whale', style: 'semi', truck: 1, emoji: '🐋', d: 2000, prem: 1, blurb: 'A big semi truck cab with chrome stacks and an air horn vibe. Premium.',
    L: 6.4, Wd: 2.45, H: 3.1, wr: 0.54, mass: 5200, torque: 1500, redline: 4200, gears: [5.0, 3.2, 2.1, 1.5, 1.1, 0.86], fd: 4.0, grip: 0.95, steer: 0.46, top: 22, susp: 14, damp: 1.9, color: 2 },
  { id: 'trail', name: 'Trail Pup', style: 'jeep', truck: 1, emoji: '🐕', p: 1600, blurb: 'A short open jeep with a roll cage and a spare tire on the back.',
    L: 3.9, Wd: 1.9, H: 1.85, wr: 0.45, mass: 1500, torque: 420, redline: 5600, gears: [3.8, 2.4, 1.6, 1.15, 0.92], fd: 4.0, grip: 1.04, steer: 0.58, top: 22, susp: 22, damp: 2.3, color: 5 },
  { id: 'funbus', name: 'Fun Bus', style: 'van', truck: 1, emoji: '🚐', p: 1400, blurb: 'A roomy van with big windows. Bring all your Pals.',
    L: 4.9, Wd: 2.0, H: 2.1, wr: 0.4, mass: 2100, torque: 420, redline: 5400, gears: [3.6, 2.2, 1.5, 1.1, 0.88], fd: 3.9, grip: 0.98, steer: 0.52, top: 21, susp: 20, damp: 2.2, color: 10 },
  { id: 'bubble', name: 'Retro Bubble', style: 'retro', emoji: '🫧', p: 2000, blurb: 'A round retro classic with fender pods, chrome and whitewall tires.',
    L: 3.95, Wd: 1.8, H: 1.5, wr: 0.36, mass: 1050, torque: 260, redline: 6000, gears: [3.4, 2.1, 1.4, 1.0], fd: 4.0, grip: 1.0, steer: 0.58, top: 20, susp: 24, damp: 2.4, color: 6 },
];
{ const CARV = Object.fromEntries(CARS.map((c) => [c.id, c])); const strip = (c) => { const o = { ...c }; delete o.prem; delete o.d; delete o.free; delete o.emb; return o; }; for (const k in CARV) CARV[k] = strip(CARV[k]);
  CARS.push(
  // 🏷️ Badge editions: same models as the cars above (shared geometry, no new meshes), own name, emblem and default color. Appended.
  { ...CARV.star, id: 'ember', name: 'Ember Dart', base: 'star', emoji: '🔥', p: 900, blurb: 'A zippy coupe wearing the fiery Ember Dart crest.', color: 0, emb: { t: 'ED', ring: '#f97316', bg: '#1f1300' } },
  { ...CARV.zapper, id: 'frost', name: 'Frost Fang', base: 'zapper', emoji: '❄️', p: 3300, blurb: 'The Zap Wedge shape with an icy Frost Fang snowflake badge.', color: 7, emb: { t: '✻', ring: '#7dd3fc', bg: '#0c2a3d' } },
  { ...CARV.hoof, id: 'blitz', name: 'Blitz Hornet', base: 'hoof', emoji: '🐝', p: 3100, blurb: 'A loud muscle car with the striped Blitz Hornet badge.', color: 9, emb: { t: 'BH', ring: '#facc15', bg: '#111111' } },
  { ...CARV.ripple, id: 'wisp', name: 'Wisp Glider', base: 'ripple', emoji: '🌙', p: 2700, blurb: 'A sleek fastback with the moon-crest Wisp badge.', color: 1, emb: { t: '☾', ring: '#c4b5fd', bg: '#2e1065' } },
  { ...CARV.foxy, id: 'jolt', name: 'Jolt Kit', base: 'foxy', emoji: '🔋', p: 3500, blurb: 'A slidey drift coupe from the made-up Jolt Kit garage.', color: 10, emb: { t: 'JK', ring: '#38bdf8', bg: '#082f49' } },
  { ...CARV.roady, id: 'petal', name: 'Petal Zip', base: 'roady', emoji: '🌸', p: 2800, blurb: 'A tiny roadster with a flower Petal Zip emblem.', color: 6, emb: { t: '✿', ring: '#f9a8d4', bg: '#500724' } },
  { ...CARV.sunny, id: 'mule', name: 'Mighty Mule', base: 'sunny', emoji: '🐴', p: 1900, blurb: 'A hard-working pickup with the Mighty Mule shield.', color: 8, emb: { t: 'M', ring: '#e5e7eb', bg: '#374151' } },
  { ...CARV.rocky, id: 'boulder', name: 'Boulder Buddy', base: 'rocky', emoji: '🪨', p: 3700, blurb: 'A lifted 4x4 with the mountain-peak Boulder badge.', color: 4, emb: { t: '▲', ring: '#fbbf24', bg: '#3b2205' } },
  { ...CARV.trail, id: 'ranger', name: 'Ranger Rex', base: 'trail', emoji: '🦕', p: 1700, blurb: 'An open jeep with the Ranger Rex explorer badge.', color: 5, emb: { t: 'RX', ring: '#86efac', bg: '#052e16' } },
  { ...CARV.parcel, id: 'haul', name: 'Haul Hero', base: 'parcel', emoji: '🦸', p: 2300, blurb: 'A big box truck with the star-shield Haul Hero emblem.', color: 2, emb: { t: '★', ring: '#93c5fd', bg: '#172554' } },
  ); }
export const CAR = Object.fromEntries(CARS.map((c) => [c.id, c]));
export const CAR_IDX = CARS.map((c) => c.id); // append-only: used in the compact multiplayer code
export const PAINTS = ['#e8434f', '#7c3aed', '#2f7fe6', '#14b8a6', '#f59e0b', '#22c55e', '#ff7ab6', '#f4f4f5', '#1f2937', '#ffd23f', '#38bdf8', '#a3e635'];
export const isTruck = (c) => !!(c && (c.truck || c.style === 'truck'));
// display models (garages, NPCs) are built once per design and their geometry cached: big/new models only cost when first seen
export const ORIGINAL_DESIGNS = CARS.slice(0, 14).map((c) => c.id);
export const geoId = (c) => c.id; // every design has its own look now (badge editions no longer share their base's body)
export const carItem = (c) => (c.prem ? 'z_car_' : 'car_') + c.id;
export const carProduct = (c) => 'kemy_car_' + c.id; // placeholder product id (not used, no real money)
export async function registerCarItems() { const cat = await import('../pals/catalog.js');
  cat.addItems(CARS.filter((c) => c.p).map((c) => ({ id: carItem(c), name: c.name, kind: 'car', p: c.p, r: 'r' })));
  cat.addDiamondItems(CARS.filter((c) => c.d).map((c) => ({ id: carItem(c), name: c.name, kind: 'car', d: c.d, productId: carProduct(c) }))); }

// ------------------------------------------------------------ shared materials
const MAT = new Map();
function mat(key, make) { if (!MAT.has(key)) MAT.set(key, make()); return MAT.get(key); }
export function paintMat(col) { return mat('p' + col, () => new THREE.MeshPhysicalMaterial({ color: col, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.25 })); }
export const carMats = () => M; // shared materials (Kemy Kustoms reuses them: no new shader programs)
const RIM = { chrome: () => M.chrome(), dark: () => mat('rimd', () => new THREE.MeshStandardMaterial({ color: '#2a2d35', metalness: 0.8, roughness: 0.3 })), gold: () => mat('rimg', () => new THREE.MeshStandardMaterial({ color: '#d4a63a', metalness: 1, roughness: 0.2 })), white: () => mat('rimw', () => new THREE.MeshStandardMaterial({ color: '#f1f1ee', metalness: 0.2, roughness: 0.35 })), steel: () => mat('rims', () => new THREE.MeshStandardMaterial({ color: '#8b9099', metalness: 0.7, roughness: 0.45 })) };
const M = {
  glass: () => mat('glass', () => new THREE.MeshPhysicalMaterial({ color: '#1b2a3c', metalness: 0.2, roughness: 0.04, transparent: true, opacity: 0.42, envMapIntensity: 1.6, clearcoat: 1, depthWrite: false })),
  chrome: () => mat('chrome', () => new THREE.MeshStandardMaterial({ color: '#e9eef5', metalness: 1, roughness: 0.12, envMapIntensity: 1.5 })),
  rubber: () => mat('rub', () => new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.85, metalness: 0 })),
  trim: () => mat('trim', () => new THREE.MeshStandardMaterial({ color: '#1d1f27', roughness: 0.5, metalness: 0.3 })),
  seat: () => mat('seat', () => new THREE.MeshStandardMaterial({ color: '#3b2a55', roughness: 0.75 })),
  dash: () => mat('dash', () => new THREE.MeshStandardMaterial({ color: '#2a2833', roughness: 0.6 })),
  head: () => mat('head', () => new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff4c8', emissiveIntensity: 2.2, roughness: 0.2 })),
  tail: () => mat('tail', () => new THREE.MeshStandardMaterial({ color: '#ff3048', emissive: '#ff2040', emissiveIntensity: 1.6, roughness: 0.3 })),
  brake: () => mat('brake', () => new THREE.MeshStandardMaterial({ color: '#ff3048', emissive: '#ff2040', emissiveIntensity: 4, roughness: 0.3 })),
  cargo: () => mat('cargo', () => new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.55, metalness: 0.1 })),
  glow: (c) => mat('g' + c, () => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.5, roughness: 0.3 })),
  emb: (e) => mat('emb' + e.t + e.ring + e.bg, () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    x.fillStyle = e.ring; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.fillStyle = e.bg; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill();
    x.fillStyle = e.ring; x.font = `900 ${e.t.length > 1 ? 46 : 62}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e.t, 64, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.25, transparent: true }); }),
  badge: () => mat('badge', () => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#f3f4f6'); g.addColorStop(1, '#9ca3af'); x.fillStyle = g; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill();
    x.fillStyle = '#5b21b6'; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 54px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KL', 64, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.25, transparent: true }); }),
};

// ------------------------------------------------------------ geometry helpers
// side profile (x = length, y = height) extruded across the width with a rounded bevel, then turned so the car faces +z
function extrudeSide(pts, width, bevel, curve = 10) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) { const p = pts[i]; if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]); else s.lineTo(p[0], p[1]); } s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 5, curveSegments: curve, steps: 1 });
  g.translate(0, 0, -(width - bevel * 2) / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals(); return g; }
// shape the slab into a car body: tumblehome above the beltline, rounded plan view at nose/tail, tucked rocker
function sculpt(g, c, belt, top, k = 1) { const p = g.attributes.position, hl = c.L / 2 + 0.2; for (let i = 0; i < p.count; i++) { let x = p.getX(i); const y = p.getY(i), z = p.getZ(i);
    const tb = Math.max(0, Math.min(1, (y - belt) / Math.max(0.05, top - belt))); x *= 1 - 0.2 * k * tb * tb; const t = Math.min(1, Math.abs(z) / hl); x *= 1 - 0.16 * Math.pow(t, 5); if (y < c.wr * 0.75) x *= 0.95; p.setX(i, x); }
  g.computeVertexNormals(); return g; }
// body profiles per style, as fractions of length (x from -0.5 front... we use +x = front) and height
function profiles(c) { const L = c.L, H = c.H, r = c.wr, cl = r * 0.55; const f = L / 2, b = -L / 2;
  switch (c.style) {
    case 'mini': return { body: [[b, cl], [f, cl], [f + 0.02, H * 0.5, f - 0.05, H * 0.58], [f - L * 0.2, H * 0.62], [b + 0.05, H * 0.62], [b - 0.02, H * 0.42, b, cl]],
      cabin: [[f - L * 0.24, H * 0.6], [f - L * 0.42, H * 0.98, f - L * 0.5, H * 1.0], [b + L * 0.1, H * 1.0], [b + 0.08, H * 0.98, b + 0.06, H * 0.6]], roofW: 0.86 };
    case 'truck': return { body: [[b, cl + 0.15], [f, cl + 0.15], [f + 0.03, H * 0.5], [f - 0.05, H * 0.6], [f - L * 0.3, H * 0.62], [b, H * 0.6]],
      cabin: [[f - L * 0.32, H * 0.6], [f - L * 0.42, H * 0.97], [b + L * 0.42, H * 0.97], [b + L * 0.4, H * 0.6]], roofW: 0.9, bed: 1 };
    case 'cruiser': return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.42, f - 0.05, H * 0.52], [f - L * 0.3, H * 0.56], [b + 0.2, H * 0.56], [b - 0.06, H * 0.5, b, cl]],
      cabin: [[f - L * 0.36, H * 0.55], [f - L * 0.47, H * 0.92], [b + L * 0.32, H * 0.92], [b + L * 0.24, H * 0.55]], roofW: 0.86, fins: 1 };
    case 'super': return { body: [[b, cl], [f, cl], [f + 0.05, H * 0.32, f - 0.1, H * 0.38], [f - L * 0.3, H * 0.52], [b + L * 0.1, H * 0.6], [b - 0.03, H * 0.56, b, cl]],
      cabin: [[f - L * 0.28, H * 0.5], [f - L * 0.5, H * 0.97, f - L * 0.56, H * 0.98], [b + L * 0.24, H * 0.9], [b + L * 0.14, H * 0.6]], roofW: 0.78, wing: 1 };
    case 'gt': return { body: [[b, cl], [f, cl], [f + 0.05, H * 0.36, f - 0.1, H * 0.44], [f - L * 0.38, H * 0.58], [b + 0.1, H * 0.62], [b - 0.04, H * 0.5, b, cl]],
      cabin: [[f - L * 0.42, H * 0.57], [f - L * 0.56, H * 0.97, f - L * 0.62, H * 0.98], [b + L * 0.2, H * 0.94], [b + L * 0.08, H * 0.62]], roofW: 0.8, strip: 1 };
    case 'wedge': return { body: [[b, cl], [f, cl], [f + 0.02, H * 0.3], [f - L * 0.45, H * 0.6], [b, H * 0.66]],
      cabin: [[f - L * 0.32, H * 0.52], [f - L * 0.5, H * 0.95], [b + L * 0.27, H * 0.95], [b + L * 0.15, H * 0.64]], roofW: 0.76, pop: 1, louvre: 1 };
    case 'fastback': return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.38, f - 0.06, H * 0.48], [f - L * 0.32, H * 0.56], [b + 0.08, H * 0.58], [b - 0.03, H * 0.46, b, cl]],
      cabin: [[f - L * 0.36, H * 0.55], [f - L * 0.52, H * 0.97, f - L * 0.58, H * 0.98], [b + L * 0.14, H * 0.66], [b + 0.12, H * 0.58]], roofW: 0.8 };
    case 'muscle': return { body: [[b, cl], [f, cl], [f + 0.03, H * 0.55], [f - L * 0.42, H * 0.62], [b + 0.05, H * 0.62], [b - 0.02, H * 0.5, b, cl]],
      cabin: [[f - L * 0.45, H * 0.6], [f - L * 0.55, H * 0.95], [b + L * 0.27, H * 0.95], [b + L * 0.16, H * 0.62]], roofW: 0.84, duck: 1, scoop: 1 };
    case 'roadster': return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.42, f - 0.08, H * 0.5], [f - L * 0.45, H * 0.6], [b + 0.1, H * 0.62], [b - 0.03, H * 0.45, b, cl]],
      cabin: [[f - L * 0.34, H * 0.55], [f - L * 0.5, H * 0.95], [b + L * 0.2, H * 0.93], [b + L * 0.1, H * 0.6]], roofW: 0.82, hoops: 1 };
    case 'hyper': return { body: [[b, cl], [f, cl], [f + 0.06, H * 0.26, f - 0.12, H * 0.32], [f - L * 0.28, H * 0.48], [b + L * 0.05, H * 0.62], [b - 0.02, H * 0.58, b, cl]],
      cabin: [[f - L * 0.26, H * 0.46], [f - L * 0.48, H * 0.98, f - L * 0.56, H * 0.98], [b + L * 0.28, H * 0.86], [b + L * 0.18, H * 0.6]], roofW: 0.72, fin: 1, wing: 1 };
    case 'drift': return { body: [[b, cl], [f, cl], [f + 0.02, H * 0.45], [f - L * 0.3, H * 0.58], [b, H * 0.62]],
      cabin: [[f - L * 0.33, H * 0.57], [f - L * 0.46, H * 0.96], [b + L * 0.2, H * 0.96], [b + L * 0.1, H * 0.62]], roofW: 0.84, gtw: 1 };
    case 'pickup': case 'lifted': case 'tow': { const lf = c.style === 'lifted' ? r * 0.45 : 0.15; return { body: [[b, cl + lf], [f, cl + lf], [f + 0.03, H * 0.5], [f - 0.05, H * 0.58], [f - L * 0.3, H * 0.6], [b, H * 0.58]],
      cabin: [[f - L * 0.32, H * 0.58], [f - L * 0.42, H * 0.97], [b + L * 0.44, H * 0.97], [b + L * 0.42, H * 0.58]], roofW: 0.9, bed: 1, snork: c.style === 'lifted', boom: c.style === 'tow' }; }
    case 'monster': { const yb = r * 1.35; return { body: [[b, yb], [f, yb], [f + 0.03, yb + H * 0.16], [f - L * 0.3, yb + H * 0.2], [b, yb + H * 0.19]],
      cabin: [[f - L * 0.32, yb + H * 0.2], [f - L * 0.42, H * 0.98], [b + L * 0.38, H * 0.98], [b + L * 0.34, yb + H * 0.19]], roofW: 0.8, bed: 1, mon: 1 }; }
    case 'box': return { body: [[b, cl + 0.25], [f, cl + 0.25], [f + 0.03, H * 0.38], [f - L * 0.22, H * 0.42], [b, H * 0.42]],
      cabin: [[f - 0.06, H * 0.42], [f - L * 0.1, H * 0.78], [f - L * 0.28, H * 0.78], [f - L * 0.28, H * 0.42]], roofW: 0.92, cargo: 1 };
    case 'semi': return { body: [[b, cl + 0.3], [f, cl + 0.3], [f + 0.02, H * 0.46], [f - L * 0.26, H * 0.5], [b, H * 0.38]],
      cabin: [[f - L * 0.27, H * 0.5], [f - L * 0.33, H * 0.86], [f - L * 0.56, H * 0.86], [f - L * 0.56, H * 0.5]], roofW: 0.9, semi: 1 };
    case 'jeep': return { body: [[b, cl + 0.12], [f, cl + 0.12], [f + 0.02, H * 0.55], [f - L * 0.3, H * 0.58], [b, H * 0.58]],
      cabin: [[f - L * 0.32, H * 0.58], [f - L * 0.36, H * 0.95], [b + 0.18, H * 0.95], [b + 0.12, H * 0.58]], roofW: 0.9, spare: 1 };
    case 'van': return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.4, f - 0.08, H * 0.47], [f - L * 0.14, H * 0.52], [b, H * 0.52]],
      cabin: [[f - L * 0.15, H * 0.5], [f - L * 0.3, H * 0.96], [b + 0.08, H * 0.96], [b + 0.03, H * 0.5]], roofW: 0.92, vanb: 1 };
    case 'retro': return { body: [[b, cl], [f, cl], [f + 0.05, H * 0.35, f - 0.12, H * 0.5], [f - L * 0.25, H * 0.56], [b + 0.15, H * 0.56], [b - 0.05, H * 0.35, b, cl]],
      cabin: [[f - L * 0.3, H * 0.54], [f - L * 0.4, H * 1.0, f - L * 0.55, H * 1.0], [b + L * 0.22, H * 0.98], [b + L * 0.12, H * 0.56]], roofW: 0.82, pods: 1 };
    default: return { body: [[b, cl], [f, cl], [f + 0.04, H * 0.4, f - 0.06, H * 0.5], [f - L * 0.32, H * 0.56], [b + 0.12, H * 0.6], [b - 0.03, H * 0.48, b, cl]],
      cabin: [[f - L * 0.34, H * 0.55], [f - L * 0.5, H * 0.95, f - L * 0.56, H * 0.96], [b + L * 0.2, H * 0.93], [b + L * 0.1, H * 0.6]], roofW: 0.82, duck: 1 };
  } }
// ------------------------------------------------------------ per-car looks: every design gets its own nose, roofline, tail, add-ons + wheels
// p: profile tweaks (nose/deck = front/rear height scale, rh = roof height, rf/rb = windscreen/back-glass top shift, cx = cabin shift; all x as a share of L)
// x: cheap shared add-ons (cached boxes/cylinders, shared materials) | sp: rim spokes | rm: rim finish | ww: tire width | ride: visual body lift (physics untouched) | two: contrast paint (roof + side band)
export const LOOK = {
  ember: { p: { nose: 0.82, rb: -0.09, rh: 0.9 }, x: ['wing', 'skirt', 'diff'], sp: 10, rm: 'dark', ww: 1.15, ride: -0.04, two: '#1f2937' },
  frost: { p: { rh: 1.12, rf: -0.04 }, x: ['rack', 'bar', 'mud', 'flare'], sp: 6, rm: 'white', ww: 1.1, ride: 0.09 },
  blitz: { p: { nose: 0.86, deck: 1.14 }, x: ['blower', 'pipes', 'skirt'], sp: 16, rm: 'chrome', ww: 1.3, two: '#f4f4f5' },
  wisp: { p: { rb: 0.16, rh: 1.04 }, x: ['rack', 'spoiler'], sp: 8, rm: 'gold', two: '#f4f4f5' },
  jolt: { p: { nose: 0.9, rh: 0.92 }, x: ['wing', 'canard', 'flare', 'diff'], sp: 4, rm: 'dark', ww: 1.2, ride: -0.05 },
  petal: { p: { nose: 1.12, deck: 1.08, rh: 0.86 }, x: ['trunkrack', 'lamps'], sp: 12, rm: 'white', ww: 0.9, two: '#f4f4f5' },
  mule: { p: { rh: 1.06 }, x: ['ladder', 'bull', 'bar', 'mud'], sp: 8, rm: 'steel', ride: 0.06 },
  boulder: { p: { rh: 0.94, nose: 1.06 }, x: ['bull', 'lamps', 'basket', 'flare', 'mud'], sp: 5, rm: 'dark', ww: 1.15, ride: 0.14 },
  ranger: { p: { rh: 0.84, rf: 0.03 }, x: ['bull', 'bar', 'snork', 'flare'], sp: 10, rm: 'dark', ride: 0.04, two: '#1f2937' },
  haul: { p: { deck: 1.0, rh: 1.12 }, x: ['visor', 'ladder', 'band'], sp: 7, rm: 'steel', ride: -0.03, two: '#f59e0b' },
};
function reshape(pr, c, lk) { const p = lk.p || {}, L = c.L, H = c.H, f = L / 2, b = -L / 2, cl = c.wr * 0.55; const each = (q, fn) => { for (let i = 0; i < q.length; i += 2) { const [x, y] = fn(q[i], q[i + 1]); q[i] = x; q[i + 1] = y; } };
  const sy = (k, x0, x1) => (x, y) => (x > x0 && x < x1 && y > cl + 0.02 ? [x, cl + (y - cl) * k] : [x, y]);
  pr.body = pr.body.map((q) => { q = q.slice(); if (p.nose) each(q, sy(p.nose, f - L * 0.3, 99)); if (p.deck) each(q, sy(p.deck, -99, b + L * 0.3)); return q; });
  const y0 = pr.cabin[0].length === 4 ? pr.cabin[0][3] : pr.cabin[0][1];
  pr.cabin = pr.cabin.map((q, i) => { q = q.slice(); each(q, (x, y) => { if (p.cx) x += p.cx * L; if (i === 1 && p.rf) x += p.rf * L; if (i === 2 && p.rb) x -= p.rb * L; if ((i === 1 || i === 2) && p.rh) y = y0 + (y - y0) * p.rh; return [x, y]; }); return q; }); return pr; }
function addOns(lk, c, add, A) { const { W, H, r, b0, f0, roofY, cabF, cabB, hood, deck, by, bumpY, axF, axR, paint, two } = A; const L = c.L, T = M.trim(), C = M.chrome(), X = lk.x || [];
  const rc = (cabF + cabB) / 2, rl = Math.max(0.4, (cabF - cabB) * 0.7);
  for (const k of X) switch (k) {
    case 'spoiler': add(BOX(W * 0.8, 0.04, 0.22), paint, (m) => { m.position.set(0, deck + 0.06, b0 + 0.16); m.rotation.x = 0.2; }); break;
    case 'wing': add(BOX(W * 0.96, 0.05, 0.34), T, (m) => { m.position.set(0, deck + 0.42, b0 + 0.2); m.rotation.x = 0.1; }); for (const s of [-1, 1]) { add(BOX(0.05, 0.42, 0.14), T, (m) => m.position.set(s * W * 0.3, deck + 0.21, b0 + 0.24)); add(BOX(0.03, 0.2, 0.42), paint, (m) => m.position.set(s * W * 0.48, deck + 0.44, b0 + 0.2)); } break;
    case 'diff': for (const s of [-0.3, -0.1, 0.1, 0.3]) add(BOX(0.03, 0.14, 0.3), T, (m) => m.position.set(s * W, r * 0.5, b0 - 0.02)); add(BOX(W * 0.8, 0.03, 0.32), T, (m) => m.position.set(0, r * 0.45, b0 - 0.02)); break;
    case 'canard': for (const s of [-1, 1]) for (const dy of [0, 0.1]) add(BOX(0.22, 0.025, 0.12), T, (m) => { m.position.set(s * (W / 2 - 0.05), by - 0.15 + dy, f0 - 0.02); m.rotation.z = s * 0.2; }); add(BOX(W * 0.9, 0.03, 0.18), T, (m) => m.position.set(0, r * 0.4, f0 + 0.06)); break;
    case 'skirt': for (const s of [-1, 1]) add(BOX(0.07, 0.1, Math.max(0.3, axF - axR - r * 2.3)), T, (m) => m.position.set(s * (W / 2 + 0.01), r * 0.55, (axF + axR) / 2)); break;
    case 'flare': for (const z of [axF, axR]) for (const s of [-1, 1]) add(BOX(0.12, 0.07, r * 2.5), T, (m) => m.position.set(s * (W / 2 + 0.04), r * 1.42, z)); break;
    case 'mud': for (const z of [axF, axR]) for (const s of [-1, 1]) add(BOX(0.03, r * 0.8, 0.03), T, (m) => m.position.set(s * (W / 2 - r * 0.2), r * 0.55, z - r * 1.12)); for (const s of [-1, 1]) add(BOX(r * 0.6, r * 0.7, 0.025), M.rubber(), (m) => m.position.set(s * (W / 2 - r * 0.2), r * 0.5, axR - r * 1.12)); break;
    case 'rack': for (const s of [-1, 1]) add(BOX(0.04, 0.05, rl), T, (m) => m.position.set(s * W * 0.34, roofY + 0.07, rc)); for (const dz of [-0.4, 0, 0.4]) add(BOX(W * 0.74, 0.03, 0.04), T, (m) => m.position.set(0, roofY + 0.1, rc + dz * rl)); break;
    case 'basket': add(BOX(W * 0.72, 0.03, rl), T, (m) => m.position.set(0, roofY + 0.08, rc)); for (const s of [-1, 1]) { add(BOX(0.04, 0.16, rl), T, (m) => m.position.set(s * W * 0.36, roofY + 0.16, rc)); add(BOX(W * 0.72, 0.16, 0.04), T, (m) => m.position.set(0, roofY + 0.16, rc + s * rl / 2)); } add(BOX(0.4, 0.2, 0.3), M.cargo(), (m) => m.position.set(0, roofY + 0.2, rc)); break;
    case 'bar': add(BOX(W * 0.7, 0.09, 0.1), M.glow('#fff7cc'), (m) => m.position.set(0, roofY + 0.09, cabF - 0.12)); add(BOX(W * 0.74, 0.04, 0.14), T, (m) => m.position.set(0, roofY + 0.03, cabF - 0.12)); break;
    case 'visor': add(BOX(W * 0.86, 0.04, 0.3), T, (m) => { m.position.set(0, roofY - 0.04, cabF + 0.1); m.rotation.x = -0.15; }); break;
    case 'bull': { const z = f0 + 0.2; for (const s of [-1, 1]) add(CYL(0.035, 0.035, H * 0.42, 6), C, (m) => m.position.set(s * W * 0.3, bumpY + H * 0.16, z)); for (const dy of [0, H * 0.3]) add(CYL(0.035, 0.035, W * 0.66, 6), C, (m) => { m.rotation.z = Math.PI / 2; m.position.set(0, bumpY + 0.04 + dy, z); }); break; }
    case 'lamps': for (const s of [-1, 1]) add(gc('lamp', () => new THREE.SphereGeometry(0.09, 10, 6)), M.head(), (m) => { m.scale.set(1, 1, 0.6); m.position.set(s * W * 0.2, bumpY + 0.2, f0 + 0.24); }); break;
    case 'ladder': { const lz = rc - 0.2, ll = Math.max(1.0, (cabF - b0) * 0.9); for (const s of [-1, 1]) add(BOX(0.05, 0.05, ll), C, (m) => m.position.set(s * W * 0.38, roofY + 0.12, cabF - ll / 2)); for (let i = 0; i < 4; i++) add(BOX(W * 0.76, 0.03, 0.03), C, (m) => m.position.set(0, roofY + 0.12, cabF - 0.1 - i * (ll - 0.2) / 3)); void lz; break; }
    case 'snork': add(CYL(0.06, 0.06, roofY - hood + 0.1, 8), T, (m) => m.position.set(W / 2 + 0.04, (roofY + hood) / 2 + 0.05, cabF - 0.02)); add(BOX(0.14, 0.1, 0.18), T, (m) => m.position.set(W / 2 + 0.04, roofY + 0.1, cabF + 0.02)); break;
    case 'blower': add(BOX(W * 0.28, 0.24, 0.4), C, (m) => m.position.set(0, hood + 0.12, f0 - L * 0.22)); add(BOX(W * 0.34, 0.08, 0.3), T, (m) => m.position.set(0, hood + 0.3, f0 - L * 0.22)); break;
    case 'pipes': for (const s of [-1, 1]) add(CYL(0.05, 0.05, L * 0.4, 8), C, (m) => { m.rotation.x = Math.PI / 2; m.position.set(s * (W / 2 + 0.06), r * 0.62, (axF + axR) / 2); }); break;
    case 'trunkrack': for (const dz of [0.12, 0.3, 0.48]) add(BOX(W * 0.56, 0.025, 0.03), C, (m) => m.position.set(0, deck + 0.06, b0 + dz)); for (const s of [-1, 1]) add(BOX(0.03, 0.03, 0.42), C, (m) => m.position.set(s * W * 0.28, deck + 0.07, b0 + 0.3)); add(BOX(0.42, 0.22, 0.3), M.seat(), (m) => m.position.set(0, deck + 0.18, b0 + 0.3)); break;
    case 'band': add(BOX(W + 0.03, H * 0.08, L * 0.8), two || T, (m) => m.position.set(0, H * 0.36, -L * 0.04)); break;
  } }
function rim(r, w, spokes, fin) { const g = new THREE.Group(); const ch = RIM[fin || 'chrome']();
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.66, r * 0.66, w * 0.86, 24), ch); d.rotation.z = Math.PI / 2; g.add(d);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.02, 12), M.trim()); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let i = 0; i < spokes; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, r * 1.1, r * 0.13), ch); s.rotation.x = (i / spokes) * Math.PI; s.position.x = 0; g.add(s); }
  return g; }
// One car model. Returns a Group (root: position/yaw) with .userData: chassis (pitch/roll/heave), wheels, doors, steer
// Heavy geometry (extruded body/cabin/roof) is cached per design: a garage full of the same models builds each shape once.
const GC = new Map(); const gc = (k, f) => { if (!GC.has(k)) GC.set(k, f()); return GC.get(k); };
const BOX = (x, y, z) => gc(`b${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`, () => new THREE.BoxGeometry(x, y, z));
const CYL = (r0, r1, h, n = 12) => gc(`c${r0.toFixed(3)}|${r1.toFixed(3)}|${h.toFixed(3)}|${n}`, () => new THREE.CylinderGeometry(r0, r1, h, n));
export const axles = (c) => [c.L * (c.axF ?? 0.33), -c.L * (c.axR ?? 0.32)];
export function buildCar(def, color, o = {}) { const c = typeof def === 'string' ? CAR[def] : def; const col = PAINTS[color ?? c.color] || PAINTS[0]; const lite = !!o.lite;
  const root = new THREE.Group(); const ch = new THREE.Group(); root.add(ch); const paint = paintMat(col); const TR = isTruck(c);
  const lk = LOOK[c.id] || {}; const pr = lk.p ? reshape(profiles(c), c, lk) : profiles(c); const cab0 = pr.cabin; if (c.conv) { const f = c.L / 2, H = c.H; pr.cabin = [[f - c.L * 0.3, H * 0.55], [f - c.L * 0.4, H * 0.84], [f - c.L * 0.43, H * 0.84], [f - c.L * 0.37, H * 0.55]]; } const W = c.Wd, r = c.wr; const bev = Math.min(0.16, W * 0.08);
  const gk = geoId(c) + (lite ? 'l' : 'h'); const add = (gm, m, f) => { const x = new THREE.Mesh(gm, m); if (f) f(x); ch.add(x); return x; };
  const body = add(gc(gk + 'body', () => sculpt(extrudeSide(pr.body, W, bev, lite ? 6 : 12), c, c.H * 0.3, c.H * 0.62)), paint);
  const cabW = W * pr.roofW; const cab = add(gc(gk + 'cab', () => sculpt(extrudeSide(pr.cabin, cabW, 0.1, lite ? 6 : 12), c, c.H * 0.55, c.H, 1.1)), M.glass()); cab.renderOrder = 2;
  const pt = (p) => (p.length === 4 ? [p[2], p[3]] : p); const roofY = Math.max(...pr.cabin.map((p) => pt(p)[1])); const cabF = pt(pr.cabin[0])[0], cabB = pt(pr.cabin[pr.cabin.length - 1])[0];
  // roof skin (paint) as a thin slab following the top of the cabin
  if (!c.conv) { const top = pr.cabin.filter((p, i) => i === 1 || i === 2).map(pt); const x0 = Math.min(top[0][0], top[1][0]) , x1 = Math.max(top[0][0], top[1][0]); const y = Math.max(top[0][1], top[1][1]);
    add(gc(gk + 'roof', () => extrudeSide([[x0 + 0.05, y - 0.06], [x1 - 0.05, y - 0.06], [x1 - 0.12, y + 0.03], [x0 + 0.12, y + 0.03]], cabW * 0.9, 0.05, 4)), lk.two ? paintMat(lk.two) : paint, (m) => { m.userData.roof = 1; }); }
  // wheel arch flares
  const [axF, axR] = axles(c), tw = W / 2 - r * 0.2;
  if (!pr.mon) for (const z of [axF, axR]) for (const s of [-1, 1]) add(gc('fl' + r.toFixed(3), () => new THREE.TorusGeometry(r * 1.12, r * 0.18, 8, 18, Math.PI)), paint, (fl) => { fl.rotation.y = Math.PI / 2; fl.position.set(s * (W / 2 - 0.02), r, z); fl.scale.set(1, 1, 1.4); fl.userData.flare = 1; });
  // lights + grille + badge
  const fz = c.L / 2 + bev * 0.9 + 0.02, by = pr.hy ?? c.H * (c.style === 'super' ? 0.28 : 0.38), ty = pr.ty ?? c.H * 0.45, hsx = c.style === 'super' || c.style === 'gt' || c.style === 'hyper' ? 2.2 : 1.2; const heads = [];
  for (const s of [-1, 1]) { const hl = add(gc('hl', () => new THREE.SphereGeometry(0.13, 16, 10)), M.head(), (m) => { m.scale.set(hsx, 0.7, 0.5); m.position.set(s * W * 0.33, by + 0.05, (pr.hz ?? fz) - 0.06); m.userData.head = 1; }); heads.push(hl);
    add(BOX(c.style === 'gt' ? W * 0.3 : 0.32, 0.1, 0.06), M.tail(), (tl) => { tl.position.set(s * W * 0.3, ty, -c.L / 2 - bev * 0.9 - 0.01); tl.userData.tail = 1; }); }
  add(BOX(W * 0.42, c.H * (pr.semi ? 0.24 : 0.12), 0.05), pr.semi ? M.chrome() : M.trim(), (gr) => gr.position.set(0, by - 0.08, fz - 0.03));
  const ry = pr.ry ?? c.H * 0.24;
  for (const [z, rot] of [[fz + 0.005, 0], [-c.L / 2 - bev * 0.9 - 0.03, Math.PI]]) add(gc('badge', () => new THREE.CircleGeometry(0.09, 20)), c.emb ? M.emb(c.emb) : M.badge(), (b) => { b.position.set(0, rot ? ry + 0.13 : by + 0.1, z); b.rotation.y = rot; });
  // bumpers (chrome for the cruiser, trucks and the retro classic)
  const bumpY = pr.bumpY ?? r * 0.75;
  for (const z of [c.L / 2, -c.L / 2]) add(gc('bm' + W.toFixed(3), () => new THREE.CapsuleGeometry(0.07, W - 0.3, 4, 10)), c.style === 'cruiser' || c.style === 'retro' || TR ? M.chrome() : M.trim(), (bm) => { bm.rotation.z = Math.PI / 2; bm.position.set(0, bumpY, z); });
  // style extras
  const b0 = -c.L / 2, f0 = c.L / 2, H = c.H;
  if (pr.fins) for (const s of [-1, 1]) add(gc('fin', () => new THREE.ConeGeometry(0.1, 0.9, 8)), paint, (f) => { f.rotation.x = -Math.PI / 2 - 0.15; f.position.set(s * (W / 2 - 0.15), H * 0.62, b0 + 0.4); });
  if (pr.wing) { add(BOX(W * 0.92, 0.05, 0.36), paint, (w) => w.position.set(0, H * 0.92, b0 + 0.25)); for (const s of [-1, 1]) add(BOX(0.05, 0.3, 0.16), M.trim(), (p) => p.position.set(s * W * 0.32, H * 0.76, b0 + 0.28));
    add(BOX(W * 0.9, 0.02, 0.03), M.glow('#c084fc'), (gl) => gl.position.set(0, H * 0.95, b0 + 0.08)); }
  if (pr.gtw) { add(BOX(W * 0.86, 0.04, 0.26), M.trim(), (w) => { w.position.set(0, H * 0.84, b0 + 0.22); w.rotation.x = 0.08; }); for (const s of [-1, 1]) add(BOX(0.04, 0.2, 0.12), M.trim(), (p) => p.position.set(s * W * 0.3, H * 0.73, b0 + 0.24)); }
  if (pr.duck) add(BOX(W * 0.8, 0.04, 0.2), paint, (d) => { d.position.set(0, H * 0.63, b0 + 0.12); d.rotation.x = 0.25; });
  if (pr.strip) add(BOX(W * 0.86, 0.03, 0.03), M.glow('#5eead4'), (s) => s.position.set(0, by + 0.18, fz - 0.1));
  if (pr.pop) for (const s of [-1, 1]) add(BOX(W * 0.24, 0.14, 0.34), paint, (p) => p.position.set(s * W * 0.33, by + 0.05, (pr.hz ?? fz) + 0.1));
  if (pr.scoop) { add(BOX(W * 0.3, 0.12, 0.7), paint, (s) => s.position.set(0, H * 0.6 + 0.05, f0 - c.L * 0.24)); add(BOX(W * 0.26, 0.07, 0.03), M.trim(), (s) => s.position.set(0, H * 0.6 + 0.07, f0 - c.L * 0.24 + 0.36)); }
  if (pr.fin) add(BOX(0.04, 0.22, c.L * 0.3), paint, (f) => { f.position.set(0, H * 0.8, b0 + c.L * 0.24); f.rotation.x = -0.12; });
  const bedY = pt(pr.body[pr.body.length - 1])[1];
  if (pr.bed) { const bl = Math.max(0.6, cabB - b0 - 0.08); add(BOX(W * 0.88, 0.05, bl), M.trim(), (bed) => bed.position.set(0, bedY, b0 + bl / 2 + 0.02));
    if (c.style === 'truck') add(BOX(W * 0.7, 0.08, 0.1), M.glow('#fff7cc'), (bar) => bar.position.set(0, H * 1.0, c.L * 0.08));
    for (const s of [-1, 1]) add(CYL(0.03, 0.03, bl * 0.94, 6), M.chrome(), (rl) => { rl.rotation.x = Math.PI / 2; rl.position.set(s * W * 0.42, bedY + H * 0.15, b0 + bl / 2 + 0.02); }); }
  if (pr.snork) { add(CYL(0.06, 0.06, roofY - bedY + 0.1, 10), M.trim(), (s) => s.position.set(W / 2 + 0.03, (roofY + bedY) / 2 + 0.05, cabF + 0.02)); add(BOX(0.16, 0.1, 0.18), M.trim(), (s) => s.position.set(W / 2 + 0.03, roofY + 0.1, cabF + 0.06)); }
  if (pr.boom) { const bz = b0 + 0.25; add(BOX(0.18, 0.18, 1.7), M.trim(), (bm) => { bm.position.set(0, bedY + 0.55, bz + 0.55); bm.rotation.x = -0.55; }); add(BOX(0.5, 0.3, 0.5), M.trim(), (bs) => bs.position.set(0, bedY + 0.15, cabB - 0.4));
    add(CYL(0.015, 0.015, 0.55, 4), M.chrome(), (cn) => cn.position.set(0, bedY + 0.72, b0 - 0.13)); add(gc('hook', () => new THREE.TorusGeometry(0.09, 0.025, 6, 14, Math.PI * 1.4)), M.chrome(), (hk) => { hk.position.set(0, bedY + 0.42, b0 - 0.13); hk.rotation.set(0, Math.PI / 2, Math.PI * 0.8); });
    add(BOX(W * 0.5, 0.07, 0.12), M.glow('#fde68a'), (lb) => lb.position.set(0, roofY + 0.05, (cabF + cabB) / 2)); }
  if (pr.mon) { add(BOX(W * 0.42, 0.28, c.L * 0.86), M.trim(), (fr) => fr.position.set(0, r * 1.15, 0));
    for (const z of [axF, axR]) { add(BOX(W * 0.86, 0.1, 0.12), M.chrome(), (ax) => ax.position.set(0, r, z)); for (const s of [-1, 1]) { add(BOX(r * 0.9, 0.08, r * 2.3), paint, (fd) => fd.position.set(s * (W / 2 - 0.05), r * 2.08, z)); add(CYL(0.06, 0.06, r * 1.05, 8), M.chrome(), (sh) => { sh.position.set(s * W * 0.22, r * 1.4, z + 0.25); sh.rotation.z = s * 0.35; }); } } }
  if (pr.cargo) { const cz0 = b0 + 0.02, cz1 = cabB - 0.08, cy0 = H * 0.42, cy1 = H * 0.98, cl2 = cz1 - cz0; add(BOX(W * 0.98, cy1 - cy0, cl2), M.cargo(), (bx) => bx.position.set(0, (cy0 + cy1) / 2, (cz0 + cz1) / 2));
    add(BOX(W * 0.99 + 0.01, 0.28, cl2 * 0.96), paint, (st) => st.position.set(0, cy0 + (cy1 - cy0) * 0.42, (cz0 + cz1) / 2)); for (let i = 1; i < 6; i++) add(BOX(W * 0.9, 0.02, 0.02), M.trim(), (ln) => ln.position.set(0, cy0 + (cy1 - cy0) * i / 6, cz0 - 0.005));
    add(BOX(W * 0.9, 0.12, 0.5), M.trim(), (fr) => fr.position.set(0, (pr.bumpY ?? r * 0.75) + 0.12, b0 + 0.3)); }
  if (pr.semi) { const sz1 = cabB - 0.02, sz0 = sz1 - c.L * 0.17; add(BOX(W * 0.92, roofY - H * 0.38, sz1 - sz0), paint, (sl) => sl.position.set(0, (roofY + H * 0.38) / 2, (sz0 + sz1) / 2));
    add(BOX(W * 0.5, 0.22, sz0 - b0), M.trim(), (rail) => rail.position.set(0, r * 1.05, (sz0 + b0) / 2)); add(CYL(0.55, 0.55, 0.08, 18), M.trim(), (fw) => fw.position.set(0, r * 1.25, b0 + (sz0 - b0) * 0.45));
    for (const s of [-1, 1]) { add(CYL(0.075, 0.075, H * 0.75, 10), M.chrome(), (st) => st.position.set(s * (W / 2 - 0.02), H * 0.72, sz1 - 0.05)); add(CYL(0.2, 0.2, 1.1, 14), M.chrome(), (ft) => { ft.rotation.x = Math.PI / 2; ft.position.set(s * (W / 2 - 0.16), r * 0.95, (sz0 + sz1) / 2 + 0.15); }); } }
  if (pr.spare) { add(gc('sp' + r.toFixed(3), () => new THREE.TorusGeometry(r * 0.72, r * 0.24, 8, 20)), M.rubber(), (t) => t.position.set(0, H * 0.48, b0 - 0.17)); add(CYL(r * 0.5, r * 0.5, 0.1, 14), M.chrome(), (h) => { h.rotation.x = Math.PI / 2; h.position.set(0, H * 0.48, b0 - 0.17); }); }
  if (pr.pods) for (const z of [axF, axR]) for (const s of [-1, 1]) add(gc('pod' + r.toFixed(3), () => new THREE.SphereGeometry(r * 1.25, 16, 10)), paint, (p) => { p.scale.set(0.42, 0.72, 1.18); p.position.set(s * (W / 2 - 0.08), r * 1.02, z); p.userData.flare = 1; });
  { const deck = Math.max(...pr.body.flatMap((q) => (q.length === 4 ? [[q[0], q[1]], [q[2], q[3]]] : [q])).filter((q) => q[0] < 0).map((q) => q[1])); addOns(lk, c, add, { W, H, r, b0, f0, roofY, cabF, cabB, hood: pt(pr.body[3] || pr.body[2])[1], deck, by, bumpY, axF, axR, paint, two: lk.two && paintMat(lk.two) }); }
  // interior: seats, dash, steering wheel (visible through the glass, used by the POV camera)
  const cabBot = Math.min(...cab0.map((p) => pt(p)[1])); const seatY = Math.max(r * 0.9, c.H * 0.38, cabBot - 0.35), drvX = W * 0.22, seatZ = (cab0[0][0] + cab0[cab0.length - 1][0]) / 2 - 0.1;
  for (const s of [1, -1]) { add(BOX(0.46, 0.14, 0.48), M.seat(), (st) => { st.position.set(s * drvX, seatY, seatZ); st.userData.seat = 1; }); add(BOX(0.46, 0.6, 0.12), M.seat(), (bk) => { bk.position.set(s * drvX, seatY + 0.32, seatZ - 0.26); bk.rotation.x = -0.18; bk.userData.seat = 1; }); }
  if (pr.hoops) for (const s of [1, -1]) add(gc('hoop', () => new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI)), M.chrome(), (h) => h.position.set(s * drvX, seatY + 0.62, seatZ - 0.42));
  const dashZ = cab0[0][0] - 0.12; add(BOX(W * 0.74, 0.16, 0.36), M.dash(), (dash) => dash.position.set(0, seatY + 0.26, dashZ - 0.22));
  add(gc('gauge', () => new THREE.CircleGeometry(0.06, 16)), M.glow('#7dd3fc'), (gauge) => { gauge.position.set(drvX, seatY + 0.35, dashZ - 0.41); gauge.rotation.x = -0.4; gauge.rotation.y = Math.PI; });
  const steer = new THREE.Group(); steer.position.set(drvX, seatY + 0.4, dashZ - 0.5); steer.rotation.x = -0.45; ch.add(steer);
  { const wr = new THREE.Mesh(gc('swr', () => new THREE.TorusGeometry(0.17, 0.025, 8, 24)), M.trim()); steer.add(wr); const sp = new THREE.Mesh(BOX(0.3, 0.03, 0.02), M.trim()); steer.add(sp); const cen = new THREE.Mesh(gc('swc', () => new THREE.CircleGeometry(0.05, 12)), M.badge()); cen.position.z = -0.012; cen.rotation.y = Math.PI; steer.add(cen); }
  // doors: hinged panels at the front edge on each side (pivot = hinge)
  const doors = []; const dz0 = pr.cabin[0][0] - 0.02, dlen = Math.min(1.25, c.L * 0.3, Math.max(0.6, cabF - cabB - 0.1)), dh = c.H * (TR ? 0.36 : 0.32);
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * (W / 2 + 0.005), seatY - 0.12, dz0); ch.add(piv);
    const pnl = new THREE.Mesh(BOX(0.05, dh, dlen), paint); pnl.position.set(0, dh / 2 - 0.05, -dlen / 2); piv.add(pnl);
    const hd = new THREE.Mesh(BOX(0.05, 0.03, 0.16), M.chrome()); hd.position.set(s * 0.03, dh - 0.12, -dlen * 0.8); piv.add(hd); doors.push({ piv, s, a: 0 }); }
  // wheels: steer pivot -> spin group (tire + rim)
  const wheels = []; const ww = r * 0.75 * (TR ? 1.3 : 1) * (pr.mon ? 1.25 : 1) * (lk.ww || 1); const spokes = lk.sp || (TR ? 6 : c.style === 'cruiser' || c.style === 'retro' ? 12 : 5);
  const tireG = gc('tire' + r.toFixed(3) + (lite ? 'l' : 'h'), () => new THREE.TorusGeometry(r * 0.78, r * 0.24, lite ? 8 : 14, lite ? 18 : 32)); const rimT = gc('rim' + r.toFixed(3) + '|' + ww.toFixed(3) + '|' + spokes + (lk.rm || ''), () => rim(r, ww, spokes, lk.rm));
  for (const [z, front] of [[axF, 1], [axR, 0]]) for (const s of [-1, 1]) { const st = new THREE.Group(); st.position.set(s * tw, r, z); root.add(st); const sp = new THREE.Group(); st.add(sp);
    const tire = new THREE.Mesh(tireG, M.rubber()); tire.rotation.y = Math.PI / 2; tire.scale.set(1, 1, ww / (r * 0.48)); sp.add(tire);
    sp.add(rimT.clone()); wheels.push({ st, sp, front, s, z, x: s * tw, comp: 0, vel: 0, y: r }); }
  const ride = lk.ride || 0; if (ride) for (const m of ch.children) m.position.y += ride;
  root.traverse((m) => { if (m.isMesh) { m.castShadow = !o.noShadow && m.material !== M.glass(); m.receiveShadow = false; } });
  root.userData = { pl: { fz: fz + 0.035, rz: c.L / 2 + bev * 0.9 + 0.045, fy: by - 0.2 + ride, ry: ry + ride }, def: c, chassis: ch, wheels, doors, steer, seat: new THREE.Vector3(drvX, seatY + 0.07 + ride, seatZ), ride, dashZ, color: col, tails: [], paint, cab, spokes, lite,
    heads, kk: { by: by + 0.05 + ride, hz: (pr.hz ?? fz) - 0.06, hsx, ty: ty + ride, fz, rz: c.L / 2 + bev * 0.9, bumpY: bumpY + ride, roofY: roofY + ride + (lk.x && (lk.x.includes('rack') || lk.x.includes('basket') || lk.x.includes('ladder')) ? 0.14 : 0), cabF, cabB, bedY: bedY + ride, truck: TR, ww, tw, axF, axR, seatY: seatY + ride, seatZ, drvX, bed: !!pr.bed, hood: pt(pr.body[3] || pr.body[2])[1] + ride } };
  ch.traverse((m) => { if (m.userData.tail) root.userData.tails.push(m); });
  return root; }
export function setBrakeLights(car, on) { for (const t of car.userData.tails) t.material = on ? M.brake() : M.tail(); }
export function setDoors(car, k) { for (const d of car.userData.doors) { d.a = k; d.piv.rotation.y = d.s * k * 1.05; } }

// ------------------------------------------------------------ vehicle physics (fixed step, raycast suspension per wheel)
// State in world space: x,z,yaw, local velocity (vf fwd, vl lateral), yaw rate; body heave/pitch/roll on springs.
export function createVehicle(def, groundAt) { const c = typeof def === 'string' ? CAR[def] : def;
  const L = c.L * 0.65, a = L * 0.5, b = L * 0.5, m = c.mass, I = m * (c.L * c.L) / 10, g = 9.81, hcg = c.H * 0.4;
  const V = { def: c, x: 0, z: 0, y: 0, yaw: 0, vf: 0, vl: 0, r: 0, steer: 0, thr: 0, brk: 0, gear: 1, rpm: 900, rev: false, heave: 0, hv: 0, pitch: 0, pv: 0, roll: 0, rv: 0, spin: 0, slip: 0, prev: null, acc: 0,
    wheelY: [0, 0, 0, 0], wheelsLocal: [[-1, a], [1, a], [-1, -b], [1, -b]].map(([s, z]) => [s * (c.Wd / 2 - c.wr * 0.2), z]) };
  const torqueAt = (rpm) => { const k = rpm / c.redline; return c.torque * Math.max(0.35, 1 - (k - 0.62) * (k - 0.62) * 2.2); };
  V.place = (x, z, yaw) => { V.x = x; V.z = z; V.yaw = yaw; V.vf = V.vl = V.r = 0; V.y = groundAt(x, z); V.prev = { x, z, yaw, y: V.y, heave: 0, pitch: 0, roll: 0 }; };
  V.speed = () => Math.abs(V.vf);
  function step(h, inp) { // inp: { thr 0..1, brk 0..1, steer -1..1, hand }
    // smoothed input: gradual throttle, speed-sensitive steering
    // easy-drive assists (on by default): gentle throttle ramp, quick release, firm predictable brakes
    const tIn = inp.thr || 0; V.thr += (tIn - V.thr) * Math.min(1, h * (tIn > V.thr ? 2.2 : 7)); V.brk += ((inp.brk || 0) - V.brk) * Math.min(1, h * 9);
    const spd = Math.abs(V.vf); const maxSt = c.steer / (1 + spd * 0.085) * (V.abs === false && V.brk > 0.8 && spd > 6 ? 0.4 : 1); const sIn = inp.steer || 0; V.steer += ((sIn * maxSt) - V.steer) * Math.min(1, h * (Math.abs(sIn) < 0.05 ? 7 : 4.5)); // speed-scaled, smoothed, self-centring
    // reverse: brake held when (nearly) stopped
    if (V.brk > 0.5 && V.vf < 1.0 && !V.rev && V.thr < 0.1) V.revT = (V.revT || 0) + h; else V.revT = 0; if (V.revT > 0.2) V.rev = true; if (V.rev && (V.thr > 0.1 || V.vf > 0.3) && V.brk < 0.1) V.rev = false;
    // gears + rpm (auto box)
    const wheelRpm = Math.abs(V.vf) / c.wr * 60 / (2 * Math.PI); const ratio = (V.rev ? 3.2 : c.gears[V.gear - 1]) * c.fd;
    let rpm = Math.max(900, wheelRpm * ratio); if (!V.rev) { if (V.manual) { if (V.wantShift) { V.gear = Math.max(1, Math.min(c.gears.length, V.gear + V.wantShift)); V.shiftT = 0.2; V.wantShift = 0; } } else if (rpm > c.redline * 0.9 && V.gear < c.gears.length) { V.gear++; V.shiftT = 0.25; V.shifted = 1; } else if (V.gear > 1 && rpm < c.redline * 0.38) V.gear--; } else V.gear = 1;
    V.shiftT = Math.max(0, (V.shiftT || 0) - h); const pedal = V.rev ? V.brk : V.thr;
    rpm = Math.min(c.redline, Math.max(rpm, 900 + pedal * 2200 * (spd < 3 ? 1 : 0.2))); V.rpm += (rpm - V.rpm) * Math.min(1, h * 10);
    let Fd = (V.shiftT > 0 ? 0.3 : 1) * pedal * torqueAt(V.rpm) * ratio * 0.9 / c.wr; if (V.rpm >= c.redline * 0.995) Fd *= 0.2; if (V.tc && V.slip > 0.5 && !V.drift) Fd *= 0.55; if (V.rev) Fd = -Fd * 0.6;
    if (spd > c.top && !V.rev) Fd = Math.min(Fd, 0); if (V.rev && V.vf < -6) Fd = Math.max(Fd, 0); // calm reverse speed
    const brakeF = (V.rev ? 0 : V.brk) * m * g * 1.15 + (inp.hand ? m * g * 0.6 : 0);
    const Fb = Math.abs(V.vf) < 0.05 ? 0 : -Math.sign(V.vf) * Math.min(brakeF, Math.abs(V.vf) * m / h * 0.9);
    const drag = -V.vf * Math.abs(V.vf) * 0.42 - V.vf * 14 - Math.sign(V.vf) * (Math.abs(V.vf) > 0.05 ? m * 0.012 * g : 0);
    // tires (bicycle model): slip angles -> lateral forces capped by grip * load (weight transfer)
    const ax0 = V.acc || 0; const Nf = m * g * (b / L) - m * ax0 * hcg / L, Nr = m * g * (a / L) + m * ax0 * hcg / L; const mu = c.grip * (inp.hand ? 0.55 : 1);
    if (spd < 1.2) { // low speed: kinematic, no jitter
      V.r = V.vf * Math.tan(V.steer) / L; V.vl *= Math.max(0, 1 - h * 10);
      V.acc = (Fd + Fb + drag) / m; V.vf += V.acc * h; } else {
      const sf = Math.atan2(V.vl + a * V.r, Math.abs(V.vf)) - V.steer * Math.sign(V.vf), sr = Math.atan2(V.vl - b * V.r, Math.abs(V.vf));
      const Cf = m * 9, Cr = m * 9.6; const Fyf = Math.max(-mu * Nf, Math.min(mu * Nf, -Cf * sf)), rg = (inp.hand ? 0.6 : V.drift && Math.abs(V.steer) > 0.15 && V.thr > 0.5 ? 0.9 : 1.12) * (inp.hand || (V.drift && V.thr > 0.5) ? (c.rg ?? 1) : 1), Fyr = Math.max(-mu * Nr * rg, Math.min(mu * Nr * rg, -Cr * sr));
      V.slip = Math.max(Math.abs(sf), Math.abs(sr)) * (Math.abs(Cr * sr) > mu * Nr ? 1.6 : 0.6);
      V.acc = (Fd + Fb + drag - Fyf * Math.sin(V.steer)) / m; const ay = (Fyr + Fyf * Math.cos(V.steer)) / m - V.vf * V.r; V.ay = ay;
      V.vf += V.acc * h; V.vl += ay * h; V.r += (a * Fyf * Math.cos(V.steer) - b * Fyr) / I * h; V.vl *= 1 - h * 0.6; V.r *= 1 - h * 0.25; const rmax = mu * g * (inp.hand ? 1.6 : 1.15) / Math.max(spd, 3); V.r = Math.max(-rmax, Math.min(rmax, V.r));
      // grip assist: pull yaw rate toward what the wheels ask for and bleed off sideways slide (no spin-outs)
      if (V.assist !== false && !inp.hand && !V.drift) { const rk = V.vf * Math.tan(V.steer) / L; V.r += (rk - V.r) * Math.min(1, h * 3.2); V.vl *= 1 - Math.min(1, h * 2.4); } }
    if (Math.abs(V.vf) < 0.03 && pedal < 0.05) V.vf = 0;
    // integrate world position
    let sy = Math.sin(V.yaw), cy = Math.cos(V.yaw); V.yaw += V.r * h;
    V.x += (sy * V.vf + cy * V.vl) * h; V.z += (cy * V.vf - sy * V.vl) * h; V.spin += V.vf / c.wr * h;
    // suspension: 4 rays to the ground -> spring + damper per wheel -> body heave / pitch / roll, plus weight-transfer moments
    const kw = m * c.susp * 3 / 4, dw = 2 * 0.32 * c.damp * Math.sqrt(kw * m / 4), pre = m * g / 4 / kw; let Fs = 0, Tp = 0, Tr = 0, gs = 0;
    V.wheelsLocal.forEach(([lx, lz], i) => { const wx = V.x + sy * lz + cy * lx, wz = V.z + cy * lz - sy * lx; const bump = (Math.sin(wx * 1.7) * Math.cos(wz * 1.3) + Math.sin(wx * 0.43 + wz * 0.61)) * 0.008; const gy = groundAt(wx, wz) + bump; gs += gy;
      const bodyAt = V.y + V.heave + V.pitch * lz - V.roll * lx; const comp = gy - bodyAt; const cv = (comp - (V.wheelY[i] ?? comp)) / h; V.wheelY[i] = comp;
      const F = Math.max(0, kw * (comp + pre) + dw * cv); Fs += F; Tp += F * lz; Tr -= F * lx; });
    const Ip = m * L * L / 6, Ir = m * c.Wd * c.Wd / 5; V.y = gs / 4;
    V.hv += (Fs / m - g) * h; V.heave += V.hv * h; if (V.heave < -0.3) { V.heave = -0.3; V.hv = Math.max(0, V.hv); } if (V.heave > 0.4) { V.heave = 0.4; V.hv = Math.min(0, V.hv); }
    V.pv += (Tp + m * V.acc * hcg * 0.6) / Ip * h; V.pv *= 1 - h * 1.5; V.pitch += V.pv * h; V.pitch = Math.max(-0.14, Math.min(0.14, V.pitch));
    V.rv += (Tr - m * (V.ay || 0) * hcg * 0.6) / Ir * h; V.rv *= 1 - h * 1.5; V.roll += V.rv * h; V.roll = Math.max(-0.14, Math.min(0.14, V.roll)); }
  // fixed-timestep driver with interpolation (render state = lerp(prev, cur, alpha))
  V.update = (dt, inp, after) => { V.acc0 = (V.acc0 || 0) + Math.min(dt, 0.1); const H = 1 / 120; let n = 0;
    while (V.acc0 >= H && n < 24) { V.prev = { x: V.x, z: V.z, yaw: V.yaw, y: V.y, heave: V.heave, pitch: V.pitch, roll: V.roll }; step(H, inp); if (after) after(V); V.acc0 -= H; n++; }
    const al = V.acc0 / H, p = V.prev || V; const lerp = (u, v) => u + (v - u) * al; let dy = V.yaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    return { x: lerp(p.x, V.x), z: lerp(p.z, V.z), y: lerp(p.y, V.y), yaw: p.yaw + dy * al, heave: lerp(p.heave, V.heave), pitch: lerp(p.pitch, V.pitch), roll: lerp(p.roll, V.roll) }; };
  return V; }
// pose a car model from a render state (+ wheel spin/steer)
export function poseCar(car, s, steer, spin, wheelDrop) { car.position.set(s.x, s.y, s.z); car.rotation.y = s.yaw; const ch = car.userData.chassis;
  ch.position.y = 0.06 + (s.heave || 0) + (car.userData.lift || 0); ch.rotation.set(-(s.pitch || 0), 0, s.roll || 0);
  for (const w of car.userData.wheels) { w.st.rotation.y = w.front ? steer : 0; w.sp.rotation.x = spin; w.st.position.y = (car.userData.wrY || car.userData.def.wr) + (wheelDrop || 0); }
  car.userData.steer.rotation.z = -steer * 4; }

// ------------------------------------------------------------ procedural engine + horn sound (Web Audio)
let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { AC = null; } return AC; };
export function createEngineSound() { const a = ac(); if (!a) return { set() {}, stop() {} };
  const g = a.createGain(); g.gain.value = 0; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.connect(g); g.connect(a.destination);
  const o1 = a.createOscillator(), o2 = a.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; const g2 = a.createGain(); g2.gain.value = 0.35; o1.connect(f); o2.connect(g2); g2.connect(f); o1.start(); o2.start();
  return { set(rpm, load, vol = 0.07) { const t = a.currentTime; const hz = 28 + rpm / 60 * 1.6; o1.frequency.setTargetAtTime(hz, t, 0.05); o2.frequency.setTargetAtTime(hz * 0.5, t, 0.05); f.frequency.setTargetAtTime(500 + rpm * 0.25 + load * 900, t, 0.08); g.gain.setTargetAtTime(vol * (0.45 + load * 0.55), t, 0.1); },
    stop() { try { g.gain.setTargetAtTime(0, a.currentTime, 0.05); setTimeout(() => { o1.stop(); o2.stop(); g.disconnect(); }, 400); } catch { /* */ } } }; }
export function honk() { const a = ac(); if (!a) return; const t = a.currentTime; for (const [hz, d] of [[420, 0], [530, 0]]) { const o = a.createOscillator(), g = a.createGain(); o.type = 'square'; o.frequency.value = hz; o.connect(g); g.connect(a.destination); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.06, t + d + 0.02); g.gain.setValueAtTime(0.06, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4); o.start(t); o.stop(t + 0.45); } }

// ---------------------------------------------------------------- 🔖 custom license plates (original designs; text is kid-safe filtered by the caller)
// p = { t: 'ABC123' (1-7 A-Z/0-9), b: background idx, f: text idx, r: border idx, fr: frame idx (+ PLATE_HC bit = ♿ accessible badge) }
// The accessible badge rides in bit 8 of fr so every existing save path (presence nibble, house car list, prefs) carries it unchanged.
export const PLATE_HC = 8;
export const plateHc = (p) => !!(p && ((p.fr | 0) & PLATE_HC));
// white wheelchair symbol (international access style) drawn with paths, centred at cx,cy, size s
export function drawWheelchair(x, cx, cy, s, col = '#ffffff') { x.save(); x.strokeStyle = col; x.fillStyle = col; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = s * 0.09;
  x.beginPath(); x.arc(cx - s * 0.06, cy - s * 0.36, s * 0.09, 0, 7); x.fill();
  x.beginPath(); x.moveTo(cx - s * 0.08, cy - s * 0.22); x.lineTo(cx - s * 0.04, cy + s * 0.04); x.lineTo(cx + s * 0.2, cy + s * 0.04); x.lineTo(cx + s * 0.3, cy + s * 0.3); x.stroke();
  x.beginPath(); x.moveTo(cx - s * 0.07, cy - s * 0.1); x.lineTo(cx + s * 0.14, cy - s * 0.1); x.stroke();
  x.beginPath(); x.arc(cx - s * 0.06, cy + s * 0.16, s * 0.24, -0.35 * Math.PI, 1.15 * Math.PI); x.stroke(); x.restore(); }
export const PLATE_PREVIEW = 'KEMY1';
// Empty text matches the preview: the editor draws PLATE_PREVIEW until the player types.
export function plateText(t) { const s = String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7); return s || PLATE_PREVIEW; }
// Validation errors used to land only in .kp-msg at the top of a scrolled sheet. Repeat them beside Save and scroll that copy into view.
export function showPlateError(root, text) { if (!root) return; const top = root.querySelector('.kp-msg'), by = root.querySelector('.kp-by');
  if (top) top.textContent = text; if (by) by.textContent = text; const opts = { block: 'nearest', inline: 'nearest' };
  if (top && top.scrollIntoView) top.scrollIntoView(opts); if (by && by.scrollIntoView) by.scrollIntoView(opts); }
export const PLATE_COLS = ['#ffffff', '#fef3c7', '#fde047', '#fb923c', '#ef4444', '#f9a8d4', '#c084fc', '#7c3aed', '#60a5fa', '#1d4ed8', '#5eead4', '#22c55e', '#166534', '#94a3b8', '#111827', '#7c2d12'];
export const PLATE_FRAMES = ['Plain', 'Chrome', 'Gold', 'Stars', 'Hearts', 'Rainbow', 'Dots'];
export function drawPlate(cv, p) { const x = cv.getContext('2d'), W = cv.width, H = cv.height, C = PLATE_COLS; const bg = C[p.b] || C[0], tx = C[p.f] ?? C[14], br = C[p.r] ?? C[14];
  x.clearRect(0, 0, W, H); const hc = plateHc(p), fr = (p.fr | 0) & 7, pad = fr ? H * 0.12 : 0; const rr = (a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
  if (fr === 1 || fr === 2) { const g = x.createLinearGradient(0, 0, 0, H); const s = fr === 1 ? ['#f8fafc', '#94a3b8', '#e2e8f0'] : ['#fef08a', '#ca8a04', '#fde68a']; g.addColorStop(0, s[0]); g.addColorStop(0.5, s[1]); g.addColorStop(1, s[2]); x.fillStyle = g; rr(0, 0, W, H, H * 0.14); x.fill(); }
  else if (fr === 5) { const g = x.createLinearGradient(0, 0, W, 0); ['#ef4444', '#f59e0b', '#fde047', '#22c55e', '#3b82f6', '#a855f7'].forEach((c, i) => g.addColorStop(i / 5, c)); x.fillStyle = g; rr(0, 0, W, H, H * 0.14); x.fill(); }
  else if (fr) { x.fillStyle = fr === 3 ? '#1e1b4b' : fr === 4 ? '#fce7f3' : '#0f172a'; rr(0, 0, W, H, H * 0.14); x.fill(); }
  x.fillStyle = bg; rr(pad, pad, W - pad * 2, H - pad * 2, H * 0.1); x.fill(); x.lineWidth = H * 0.05; x.strokeStyle = br; rr(pad + H * 0.04, pad + H * 0.04, W - pad * 2 - H * 0.08, H - pad * 2 - H * 0.08, H * 0.08); x.stroke();
  if (fr === 3 || fr === 4 || fr === 6) { x.font = `${H * 0.1}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 0; i < 9; i++) { const ax = (i + 0.5) * W / 9; for (const ay of [pad / 2, H - pad / 2]) { if (fr === 6) { x.fillStyle = '#fde047'; x.beginPath(); x.arc(ax, ay, H * 0.03, 0, 7); x.fill(); } else x.fillText(fr === 3 ? '★' : '♥', ax, ay); } } x.fillStyle = fr === 3 ? '#fde047' : '#ec4899'; }
  let tx0 = 0; if (hc) { const bs = H - pad * 2 - H * 0.22, bx = pad + H * 0.11, by = (H - bs) / 2; x.fillStyle = '#1d4ed8'; rr(bx, by, bs, bs, bs * 0.14); x.fill(); drawWheelchair(x, bx + bs / 2, by + bs / 2 + bs * 0.02, bs * 0.9); tx0 = bs + H * 0.08; }
  x.fillStyle = tx; x.textAlign = 'center'; x.textBaseline = 'middle'; const t = String(p.t || '').slice(0, 7); x.font = `900 ${Math.min(H * 0.56, (W - pad * 2 - tx0) * 1.5 / Math.max(3, t.length))}px Inter, Arial, sans-serif`; x.fillText(t, (W + tx0) / 2, H / 2 + H * 0.03); }
export function addPlate(car, p) { const c = car.userData.def; if (!c) return; for (const o of car.userData.plates || []) { o.parent && o.parent.remove(o); o.material.map.dispose(); o.material.dispose(); o.geometry.dispose(); } car.userData.plates = []; if (!p || !p.t) return;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; drawPlate(cv, p); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; car.userData.plateTex = tex;
  const ch = car.userData.chassis || car; for (const s of [1, -1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshBasicMaterial({ map: tex })); const q = car.userData.pl || { fz: c.L / 2 + 0.1, rz: c.L / 2 + 0.1, fy: c.H * 0.25, ry: c.H * 0.25 }; m.position.set(0, s > 0 ? q.fy : q.ry, s > 0 ? q.fz : -q.rz); m.rotation.y = s > 0 ? 0 : Math.PI; m.userData.plate = 1; ch.add(m); car.userData.plates.push(m); } }
