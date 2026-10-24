// Room-by-room house editor. Loaded only after Decorate opens. Positions stay in
// plan units (the same ones interior.js saves). No THREE in here. Written by Lone Keem.
import { DECOR, hex6, FLOORS } from './interior.js';

// CSS colour chips only. This list stays in the lazy editor, not the app shell.
export const FAMILIES = [
  { name: 'Pinks', colors: [['#fbcfe8', 'Baby pink'], ['#ec4899', 'Hot pink'], ['#fecdd3', 'Blush'], ['#e11d48', 'Rose'], ['#d946ef', 'Magenta']] },
  { name: 'Purples', colors: [['#ddd6fe', 'Lavender'], ['#c084fc', 'Lilac'], ['#8b5cf6', 'Violet'], ['#7c3aed', 'Kemy purple']] },
  { name: 'Blues', colors: [['#7dd3fc', 'Sky'], ['#bfdbfe', 'Baby blue'], ['#1e3a8a', 'Navy'], ['#0f766e', 'Teal'], ['#2dd4bf', 'Turquoise']] },
  { name: 'Greens', colors: [['#a7f3d0', 'Mint'], ['#9caf88', 'Sage'], ['#84cc16', 'Lime'], ['#166534', 'Forest']] },
  { name: 'Yellows and oranges', colors: [['#fef08a', 'Butter'], ['#eab308', 'Gold'], ['#fdba74', 'Peach'], ['#fb923c', 'Coral'], ['#f97316', 'Orange']] },
  { name: 'Reds', colors: [['#dc2626', 'Cherry'], ['#9f1239', 'Burgundy']] },
  { name: 'Neutrals', colors: [['#ffffff', 'White'], ['#fde7c7', 'Cream'], ['#e7d3b0', 'Beige'], ['#d2a679', 'Tan'], ['#92400e', 'Brown'], ['#d1d5db', 'Light gray'], ['#374151', 'Charcoal'], ['#111827', 'Black']] },
  { name: 'Pastels', colors: [['#d1fae5', 'Pastel mint'], ['#fef9c3', 'Pastel lemon'], ['#ede9fe', 'Pastel lilac']] },
  { name: 'Bright', colors: [['#ff2bd6', 'Neon pink'], ['#39ff14', 'Neon green'], ['#fff01f', 'Neon yellow'], ['#00f0ff', 'Neon cyan']] }
];
export const PALETTE = FAMILIES.flatMap((f) => f.colors);

const RECENT_KEY = 'kemy-house-colors';
const RECENT_MAX = 8;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Most recent first. Drops anything that is not a #rrggbb colour and keeps eight.
export function pushRecent(list, hex) {
  const prev = (Array.isArray(list) ? list : []).map((h) => hex6(h)).filter(Boolean);
  const c = hex6(hex);
  return (c ? [c, ...prev.filter((h) => h !== c)] : prev).slice(0, RECENT_MAX);
}
function recentMap() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const o = JSON.parse(localStorage.getItem(RECENT_KEY) || '{}');
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}
export function recentColors(uid) {
  const id = String(uid || '').slice(0, 128);
  const map = id ? recentMap() : null;
  return map ? pushRecent(map[id], '') : [];
}
export function rememberColor(uid, hex) {
  const id = String(uid || '').slice(0, 128);
  const map = recentMap();
  const next = pushRecent(map && id ? map[id] : [], hex);
  if (!id || !hex6(hex) || !map) return next;
  map[id] = next;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(map)); } catch { /* private mode or a full disk */ }
  return next;
}

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

const TARGETS = [['wall', 'Walls'], ['floor', 'Floor'], ['curtain', 'Curtains'], ['item', 'Piece']];
const CLEAR = { wall: 'Use house wall colour', floor: 'Use floor style', curtain: 'No curtains', item: 'Original colour' };
const chip = (h, n, on) => `<button type="button" class="sw${on ? ' on' : ''}" style="background:${h}" data-hex="${h}" aria-label="${esc(n)}"></button>`;

export function roomPickerHtml(two) {
  return `<div class="kh-rooms">${roomsFor(two).map((r) => `<button type="button" data-room="${r.id}" aria-label="Edit ${r.name}">${r.emoji} ${r.name}</button>`).join('')}</div>`;
}

// One palette for walls, floor, carpet, curtains, and the selected piece. `target` is which of those the chips paint.
export function colorHtml({ roomName, target, current, recent, itemName }) {
  const kind = TARGETS.some(([k]) => k === target) ? target : 'wall';
  const cur = hex6(current) || '';
  const rec = pushRecent(recent, '');
  const targets = TARGETS.map(([k, n]) => `<button type="button" data-target="${k}" class="${kind === k ? 'on' : ''}" aria-pressed="${kind === k ? 'true' : 'false'}"${k === 'item' && !itemName ? ' disabled' : ''}>${n}</button>`).join('');
  const families = FAMILIES.map((f) => `<div class="kh-fam"><span>${esc(f.name)}</span><div class="kh-swatches">${f.colors.map(([h, n]) => chip(h, n, cur === h)).join('')}</div></div>`).join('');
  const painting = kind === 'item' ? (itemName || 'a piece') : (TARGETS.find(([k]) => k === kind)[1]);
  const pieceTip = kind === 'item' && !itemName ? '<p class="kh-tip">Tap a couch, bed, chair, table, or rug, then pick its colour.</p>' : '';
  const clear = kind === 'item' && !itemName ? '' : `<button type="button" data-clear="${kind}">${CLEAR[kind]}</button>`;
  return `<div class="kh-targets" role="group" aria-label="What to colour">${targets}</div>`
    + `<p class="kh-tip">${esc(roomName)} · ${esc(painting)}. The floor colour also covers carpet.</p>${pieceTip}`
    + `<div class="kh-fam"><span>Recent</span><div class="kh-swatches">${rec.map((h) => chip(h, 'Recent ' + h, cur === h)).join('')}<label class="kh-custom">Custom<input type="color" data-custom value="${cur || '#7c3aed'}" aria-label="Custom colour"></label></div></div>`
    + clear + families
    + `<label>Floor style for rooms with no colour</label><div class="kh-strip">${Object.entries(FLOORS).map(([k, F]) => `<button type="button" data-fl="${k}">${esc(F.n)}</button>`).join('')}</div>`;
}
