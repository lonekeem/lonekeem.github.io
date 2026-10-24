// Room-by-room house editor. Loaded only after Decorate opens. Positions stay in
// plan units (the same ones interior.js saves). No THREE in here. Written by Lone Keem.
import { DECOR, hex6, FLOORS } from './interior.js';

export const PALETTE = [
  ['#ffffff', 'White'], ['#fde7c7', 'Cream'], ['#f8fafc', 'Snow'], ['#dbeafe', 'Sky'], ['#93c5fd', 'Blue'],
  ['#a7f3d0', 'Mint'], ['#86efac', 'Leaf'], ['#fce7f3', 'Pink'], ['#f9a8d4', 'Rose'], ['#fecaca', 'Blush'],
  ['#ef4444', 'Red'], ['#f97316', 'Orange'], ['#fde047', 'Yellow'], ['#a78bfa', 'Lilac'], ['#7c3aed', 'Purple'],
  ['#c4b5fd', 'Lavender'], ['#b45309', 'Wood'], ['#6b4423', 'Dark wood'], ['#94a3b8', 'Grey'], ['#1f2937', 'Ink']
];

// Bounds are the room the piece's centre must stay inside. Camera stands inside that room.
const ROOMS = [
  { id: 'L', name: 'Living Room', emoji: '🛋️', x: -3.2, z: 2.0, yaw: 0, cam: Math.PI, x0: -5.7, x1: -1.05, z0: -0.85, z1: 5.55 },
  { id: 'K', name: 'Kitchen', emoji: '🍳', x: -3.2, z: -3.3, yaw: Math.PI, cam: 0, x0: -5.7, x1: -1.05, z0: -5.15, z1: -1.15 },
  { id: 'B', name: 'Bedroom', emoji: '🛏️', x: 2.6, z: -2.2, yaw: Math.PI, cam: 0, x0: 1.15, x1: 5.55, z0: -5.55, z1: -0.15 },
  { id: 'T', name: 'Bathroom', emoji: '🛁', x: 3.0, z: 2.0, yaw: Math.PI / 2, cam: Math.PI / 2 + Math.PI, x0: 1.15, x1: 5.15, z0: 0.15, z1: 5.45 },
  { id: 'H', name: 'Hallway', emoji: '🚪', x: 0, z: 1.2, yaw: 0, cam: Math.PI, x0: -0.8, x1: 0.8, z0: -5.4, z1: 5.4 },
  { id: 'U', name: 'Upstairs', emoji: '🪜', up: true, x: 3.3, z: -1.4, yaw: Math.PI, cam: 0, x0: 1.3, x1: 5.5, z0: -5.4, z1: 4.2 }
];
const BY = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
export const roomById = (id) => BY[id] || null;
export const roomsFor = (two) => ROOMS.filter((r) => r.id !== 'U' || two);

// Same split the walls use: left is living/kitchen, right is bedroom/bath, middle is the hall.
export function itemRoom(x, z, f) {
  if (f === 1) return 'U';
  if (x < -0.95) return z < -1 ? 'K' : 'L';
  if (x > 0.95) return z < 0 ? 'B' : 'T';
  return 'H';
}

const snap = (v) => Math.round(v * 2) / 2;
export function clampToRoom(it, roomId) {
  const R = BY[roomId]; const D = it && DECOR[it.c];
  if (!R || !D || !Number.isFinite(+it.x) || !Number.isFinite(+it.z)) return null;
  it.r = (it.r | 0) & 3;
  it.f = roomId === 'U' ? 1 : 0;
  let hx = 0, hz = 0;
  if (D.foot) { const [w, d] = (it.r & 1) ? [D.foot[1], D.foot[0]] : D.foot; hx = w / 2; hz = d / 2; }
  const x0 = R.x0 + hx, x1 = R.x1 - hx, z0 = R.z0 + hz, z1 = R.z1 - hz;
  it.x = snap(x0 <= x1 ? Math.max(x0, Math.min(x1, +it.x)) : (R.x0 + R.x1) / 2);
  it.z = snap(z0 <= z1 ? Math.max(z0, Math.min(z1, +it.z)) : (R.z0 + R.z1) / 2);
  it.x = Math.max(-6, Math.min(6, it.x));
  it.z = Math.max(-6, Math.min(6, it.z));
  return it;
}

const swatches = (kind, current) => PALETTE.map(([h, n]) => `<button type="button" class="sw${current === h ? ' on' : ''}" style="background:${h}" data-paint="${kind}:${h}" aria-label="${n}"></button>`).join('')
  + `<label class="kh-custom">Custom<input type="color" data-custom="${kind}" value="${hex6(current) || '#7c3aed'}" aria-label="Custom colour"></label>`;

export function roomPickerHtml(two) {
  return `<div class="kh-rooms">${roomsFor(two).map((r) => `<button type="button" data-room="${r.id}" aria-label="Edit ${r.name}">${r.emoji} ${r.name}</button>`).join('')}</div>`;
}

export function colorHtml({ roomName, wall, floor, curtain, itemName, item }) {
  return `<label>${roomName} walls</label><div class="kh-swatches">${swatches('wall', wall)}</div><button type="button" data-clear="wall">Use house wall colour</button>`
    + `<label>${roomName} floor</label><div class="kh-swatches">${swatches('floor', floor)}</div><button type="button" data-clear="floor">Use floor style</button>`
    + `<label>${roomName} curtains</label><div class="kh-swatches">${swatches('curtain', curtain)}</div><button type="button" data-clear="curtain">No curtains</button>`
    + (itemName ? `<label>${itemName}</label><div class="kh-swatches">${swatches('item', item)}</div><button type="button" data-clear="item">Original colour</button>` : '<p class="kh-tip">Tap a couch, bed, chair, table, or rug, then pick its colour here.</p>')
    + `<label>Floor style for rooms with no colour</label><div class="kh-strip">${Object.entries(FLOORS).map(([k, F]) => `<button type="button" data-fl="${k}">${F.n}</button>`).join('')}</div>`;
}
