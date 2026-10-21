// Kemy World house interiors: hallway, living room, kitchen, bedroom, bathroom (+ stairs and an upstairs room on
// two-story homes), open doorways (no interior doors), seats (beds, chairs, couches), a TV that shows the house music, windows with a painted town view, lamps, per-town styles. Built lazily on entry,
// merged per material (a few draw calls per house). Owner decor (homes/{plot}.decor) = wall colour, floor type and
// movable furniture on a 0.5 m grid. Original content only. Written by Lone Keem
export const PAL = {
  street: { wall: '#fde7c7', trim: '#7c4a2a', acc: '#7c3aed', floor: 'wood', view: 'street' }, down: { wall: '#e5e7eb', trim: '#334155', acc: '#0ea5e9', floor: 'tile', view: 'down' },
  farm: { wall: '#f5e1c0', trim: '#7c2d12', acc: '#dc2626', floor: 'dark', view: 'farm' }, snow: { wall: '#e8d5b5', trim: '#5b3a1f', acc: '#b91c1c', floor: 'dark', view: 'snow' },
  desert: { wall: '#f4c99a', trim: '#9a3412', acc: '#0d9488', floor: 'tile', view: 'desert' }, lake: { wall: '#dbeafe', trim: '#1e3a8a', acc: '#16a34a', floor: 'wood', view: 'lake' },
  shore: { wall: '#f0fdfa', trim: '#0f766e', acc: '#f97316', floor: 'tile', view: 'shore' } };
// per-seed look for the far-south metro homes: every house mixes wall / trim / accent / floor / view from its seed
const ACC = ['#7c3aed', '#0ea5e9', '#dc2626', '#16a34a', '#f97316', '#db2777', '#0d9488', '#ca8a04', '#4f46e5'];
export function palOf(h) { if (!h || (!h.num && PAL[h.town || 'street'])) return PAL[(h && h.town) || 'street'] || PAL.street; const P = Object.values(PAL), s = h.seed || 0;
  const a = P[s % P.length], b = P[Math.floor(s / 7) % P.length]; return { wall: a.wall, trim: b.trim, acc: ACC[Math.floor(s / 3) % ACC.length], floor: ['wood', 'dark', 'tile', 'carpet'][Math.floor(s / 5) % 4], view: P[Math.floor(s / 11) % P.length].view }; }
export const WALL_SW = ['#fde7c7', '#ffffff', '#e5e7eb', '#dbeafe', '#fce7f3', '#ecfccb', '#ede9fe', '#fef3c7', '#f4c99a', '#1f2937'];
export const EXT_SW = ['#f6e7c8', '#ffffff', '#cfe3f0', '#f3d1dc', '#d8ecd0', '#efe0ff', '#fca5a5', '#fde047', '#93c5fd', '#475569', '#7c3aed', '#7a3b3b', '#2f5d50', '#111827'];
export const FLOORS = { wood: { n: 'Wood', c: '#b07a4a', l: '#8a5a34' }, dark: { n: 'Dark wood', c: '#6b4423', l: '#4a2e17' }, tile: { n: 'Tile', c: '#e5e7eb', l: '#cbd5e1' }, carpet: { n: 'Carpet', c: '#a78bfa', l: null } };
// furniture: parts [shape, colour ('A' accent, 'T' trim), x, y, z, sx, sy, sz, glow?]; foot = collider [w, d] or null
export const DECOR = {
  bd: { n: 'Cozy Bed', e: '🛏️', foot: [2, 2.9], p: [['box', 'T', 0, .25, 0, 2, .5, 2.9], ['box', '#f8fafc', 0, .56, 0, 1.9, .14, 2.8], ['box', 'A', 0, .65, .4, 1.95, .08, 1.9], ['box', '#fff', 0, .7, -1.05, 1.3, .14, .45], ['box', 'T', 0, .8, -1.4, 2, 1.1, .12]] },
  bc: { n: 'Canopy Bed', e: '👑', c: 300, foot: [2.1, 3], p: [['box', 'T', 0, .25, 0, 2, .5, 2.9], ['box', '#f8fafc', 0, .56, 0, 1.9, .14, 2.8], ['box', '#f9a8d4', 0, .65, .4, 1.95, .08, 1.9], ['box', '#fff', 0, .7, -1.05, 1.3, .14, .45], ['box', 'T', .95, 1.2, 1.4, .1, 2.4, .1], ['box', 'T', -.95, 1.2, 1.4, .1, 2.4, .1], ['box', 'T', .95, 1.2, -1.4, .1, 2.4, .1], ['box', 'T', -.95, 1.2, -1.4, .1, 2.4, .1], ['box', '#fbcfe8', 0, 2.42, 0, 2.1, .06, 3]] },
  bk: { n: 'Bunk Bed', e: '🪜', c: 450, foot: [1.4, 2.4], p: [['box', 'T', 0, .25, 0, 1.3, .3, 2.3], ['box', 'A', 0, .45, 0, 1.25, .12, 2.2], ['box', 'T', 0, 1.45, 0, 1.3, .3, 2.3], ['box', '#38bdf8', 0, 1.65, 0, 1.25, .12, 2.2], ['box', 'T', .62, 1, 1.12, .08, 2, .08], ['box', 'T', -.62, 1, 1.12, .08, 2, .08], ['box', 'T', .62, 1, -1.12, .08, 2, .08], ['box', 'T', -.62, 1, -1.12, .08, 2, .08], ['box', '#fbbf24', .7, .9, 0, .05, 1.2, .5]] },
  br: { n: 'Round Star Bed', e: '🌟', d: 60, foot: [2.6, 2.6], p: [['cyl', '#fde68a', 0, .25, 0, 2.8, .5, 2.8], ['cyl', 'A', 0, .56, 0, 2.6, .12, 2.6], ['sph', '#fff', 0, .7, -.8, .9, .3, .5], ['cyl', '#facc15', 0, .63, .5, .9, .02, .9, 1]] },
  cs: { n: 'Sofa', e: '🛋️', foot: [3.2, 1], p: [['box', 'A', 0, .3, 0, 3.2, .5, 1], ['box', 'A', 0, .8, -.38, 3.2, .7, .25], ['box', 'T', 1.55, .55, 0, .22, .6, 1], ['box', 'T', -1.55, .55, 0, .22, .6, 1], ['box', '#fff', .8, .65, -.15, .5, .4, .15], ['box', '#fff', -.8, .65, -.15, .5, .4, .15]] },
  cl: { n: 'Corner Sofa', e: '🛋️', c: 350, foot: [3.2, 2.2], p: [['box', 'A', 0, .3, -.6, 3.2, .5, 1], ['box', 'A', 0, .8, -.98, 3.2, .7, .25], ['box', 'A', 1.1, .3, .5, 1, .5, 1.3], ['box', 'A', 1.48, .8, .2, .25, .7, 1.9], ['box', '#fff', -.8, .65, -.75, .5, .4, .15]] },
  ch: { n: 'Armchair', e: '🪑', foot: [1, 1], p: [['box', 'A', 0, .3, 0, 1, .5, 1], ['box', 'A', 0, .8, -.38, 1, .7, .25], ['box', 'T', .45, .55, 0, .14, .5, 1], ['box', 'T', -.45, .55, 0, .14, .5, 1]] },
  tv: { n: 'TV + Stand', e: '📺', foot: [2.4, .5], p: [['box', '#3f3f46', 0, .35, 0, 2.4, .7, .5], ['box', '#111827', 0, 1.25, -.05, 2.2, 1.1, .08], ['box', '#60a5fa', 0, 1.25, 0, 2, .95, .01, 1]] },
  tg: { n: 'Big Screen TV', e: '🎬', c: 400, foot: [3.4, .5], p: [['box', '#27272a', 0, .3, 0, 3.4, .6, .5], ['box', '#09090b', 0, 1.5, -.05, 3.2, 1.7, .08], ['box', '#a78bfa', 0, 1.5, 0, 3, 1.5, .01, 1]] },
  rg: { n: 'Rug', e: '🟪', foot: null, p: [['box', 'A', 0, .012, 0, 4, .02, 2.8], ['box', '#fff', 0, .015, 0, 3.4, .02, .1]] },
  rr: { n: 'Round Rug', e: '⭕', foot: null, p: [['cyl', '#f9a8d4', 0, .012, 0, 3, .02, 3], ['cyl', '#fff', 0, .015, 0, 1.6, .02, 1.6]] },
  rs: { n: 'Star Rug', e: '⭐', c: 150, foot: null, p: [['cyl6', '#facc15', 0, .012, 0, 3.2, .02, 3.2], ['cyl6', '#fff7ae', 0, .015, 0, 1.6, .02, 1.6]] },
  lp: { n: 'Floor Lamp', e: '💡', foot: [.4, .4], p: [['cyl', '#475569', 0, .03, 0, .4, .06, .4], ['cyl', '#475569', 0, .8, 0, .06, 1.6, .06], ['cyl', '#fef3c7', 0, 1.65, 0, .5, .4, .5, 1]] },
  ll: { n: 'Lava Lamp', e: '🫧', c: 200, foot: [.6, .6], p: [['box', 'T', 0, .3, 0, .6, .6, .6], ['cyl', '#64748b', 0, .7, 0, .3, .2, .3], ['cyl', '#f472b6', 0, 1.1, 0, .22, .6, .22, 1]] },
  lc: { n: 'Crystal Lamp', e: '💎', d: 30, foot: [.6, .6], p: [['box', 'T', 0, .3, 0, .6, .6, .6], ['cone4', '#a5f3fc', 0, 1, 0, .5, .8, .5, 1]] },
  pl: { n: 'Fern', e: '🪴', foot: [.6, .6], p: [['cyl', '#a16207', 0, .3, 0, .5, .6, .5], ['sph', '#16a34a', 0, 1, 0, .9, .9, .9]] },
  pc: { n: 'Cactus', e: '🌵', foot: [.5, .5], p: [['cyl', '#ea580c', 0, .2, 0, .45, .4, .45], ['cyl', '#15803d', 0, .9, 0, .28, 1.1, .28], ['cyl', '#15803d', .22, 1, 0, .14, .5, .14]] },
  pt: { n: 'Indoor Tree', e: '🌳', c: 180, foot: [.7, .7], p: [['cyl', '#a16207', 0, .3, 0, .6, .6, .6], ['cyl', '#78350f', 0, 1.2, 0, .15, 1.6, .15], ['sph', '#22c55e', 0, 2.1, 0, 1.4, 1.2, 1.4]] },
  ar: { n: 'Sunset Art', e: '🖼️', foot: null, p: [['box', 'T', 0, 1.8, 0, 1.3, .9, .05], ['box', '#f59e0b', 0, 1.95, .03, 1.1, .35, .01], ['box', '#ef4444', 0, 1.62, .03, 1.1, .35, .01]] },
  ak: { n: 'Kemy Star Art', e: '✨', c: 120, foot: null, p: [['box', 'T', 0, 1.8, 0, 1.3, .9, .05], ['box', '#4c1d95', 0, 1.8, .03, 1.1, .7, .01], ['cyl6', '#facc15', 0, 1.8, .05, .4, .4, .02]] },
  aa: { n: 'Abstract Art', e: '🎨', c: 120, foot: null, p: [['box', 'T', 0, 1.8, 0, 1.3, .9, .05], ['box', '#0ea5e9', -.3, 1.9, .03, .5, .5, .01], ['box', '#f43f5e', .25, 1.7, .035, .5, .4, .01], ['box', '#facc15', .1, 2.0, .04, .3, .2, .01]] },
  ta: { n: 'Table', e: '🍽️', foot: [1.6, 1.1], p: [['box', '#b45309', 0, .75, 0, 1.6, .08, 1.1], ['box', '#78350f', 0, .37, 0, .14, .74, .14], ['box', '#78350f', 0, .03, 0, .7, .06, .5]] },
  cr: { n: 'Chair', e: '🪑', foot: [.5, .5], p: [['box', '#fbbf24', 0, .45, 0, .45, .06, .45], ['box', '#fbbf24', 0, .75, -.2, .45, .6, .06], ['box', 'T', 0, .22, 0, .08, .44, .08]] },
  bs: { n: 'Bookshelf', e: '📚', foot: [1.8, .6], p: [['box', 'T', 0, 1, 0, 1.8, 2, .6], ['box', '#ef4444', -.4, .45, .2, .7, .36, .3], ['box', '#3b82f6', .4, .95, .2, .8, .36, .3], ['box', '#22c55e', -.3, 1.45, .2, .9, .36, .3], ['box', '#f59e0b', .3, 1.85, .2, .7, .2, .3]] },
  dr: { n: 'Dresser', e: '🗄️', foot: [1.4, .6], p: [['box', 'T', 0, .5, 0, 1.4, 1, .6], ['box', '#fde68a', -.35, .7, .31, .1, .06, .02], ['box', '#fde68a', .35, .7, .31, .1, .06, .02], ['box', '#fde68a', 0, .35, .31, .1, .06, .02]] },
  sp: { n: 'Speaker', e: '🔊', foot: [.5, .5], p: [['box', '#111827', 0, .5, 0, .5, 1, .5], ['cyl', '#334155', 0, .65, .26, .32, .02, .32], ['cyl', '#22d3ee', 0, .3, .26, .14, .02, .14, 1]] },
  pn: { n: 'Piano', e: '🎹', c: 500, foot: [1.6, .7], p: [['box', '#111111', 0, .6, 0, 1.6, 1.2, .6], ['box', '#ffffff', 0, .8, .38, 1.5, .05, .25], ['box', '#111111', 0, .4, .3, 1.5, .5, .3]] },
  aq: { n: 'Aquarium', e: '🐠', d: 40, foot: [1.4, .5], p: [['box', 'T', 0, .4, 0, 1.4, .8, .5], ['box', '#38bdf8', 0, 1.15, 0, 1.4, .7, .5, 1], ['box', '#f97316', -.3, 1.2, .26, .2, .1, .01], ['box', '#facc15', .3, 1.05, .26, .2, .1, .01]] } };
// interiors are laid out in 'plan units' (the old 12 m house) and scaled up SC x on the ground plane: bigger rooms,
// wider halls; fixtures + furniture keep their real size (only their positions spread out). Decor saves stay in plan units.
export const SC = 1.4;
// mansions are much bigger (rooms 1.5x wider, two floors, tall upper hall); the admin palace is the biggest of all
export const scOf = (h) => (h && h.admin ? 2.6 : h && h.estate ? 2.1 : SC);
// seats [x, seatTop, z, yawOffset] in a piece's local frame (front = +z)
export const SEATS = { bd: [[-.5, .63, .9, 0], [.5, .63, .9, 0]], bc: [[-.5, .63, .9, 0], [.5, .63, .9, 0]], bk: [[0, .51, .5, 0]], br: [[-.5, .62, .6, 0], [.5, .62, .6, 0]],
  cs: [[-1, .55, .05, 0], [0, .55, .05, 0], [1, .55, .05, 0]], cl: [[-1, .55, -.5, 0], [0, .55, -.5, 0], [1, .55, .5, Math.PI / 2]], ch: [[0, .55, .05, 0]], cr: [[0, .48, .02, 0]] };
export const SCREENS = { tv: [0, 1.25, .02, 2, .95], tg: [0, 1.5, .02, 3, 1.5] };
export const decorItem = (code) => { const d = DECOR[code]; return d ? (d.d ? 'z_hd_' + code : 'hd_' + code) : null; };
export function parseItems(s) { const out = []; for (const t of String(s || '').split(';')) { const [c, x, z, r, f] = t.split(','); if (!DECOR[c]) continue; const X = +x / 2, Z = +z / 2; if (!isFinite(X) || !isFinite(Z) || Math.abs(X) > 6 || Math.abs(Z) > 6) continue; out.push({ c, x: X, z: Z, r: (+r || 0) & 3, f: f === '1' ? 1 : 0 }); if (out.length >= 80) break; } return out; }
export const serItems = (L) => L.map((i) => [i.c, Math.round(i.x * 2), Math.round(i.z * 2), i.r & 3].join(',') + (i.f ? ',1' : '')).join(';');
export const defaultItems = (two, seed = 0) => serItems([{ c: ['cs', 'cs', 'cl'][seed % 3], x: -2.2, z: 4.9, r: 2 }, { c: 'tv', x: -2.2, z: 1.0, r: 0 }, { c: 'rg', x: -2.6, z: 3, r: 0 }, { c: 'lp', x: -5.5, z: 5.5, r: 0 }, { c: 'bs', x: -5.7, z: 3, r: 1 }, { c: 'pl', x: -5.5, z: 1.1, r: 0 },
  { c: 'ta', x: -3.2, z: -2.4, r: 0 }, { c: 'cr', x: -4.3, z: -2.4, r: 1 }, { c: 'cr', x: -2.1, z: -2.4, r: 3 }, { c: ['bd', 'bd', 'bc', 'br'][Math.floor(seed / 3) % 4], x: 4.2, z: -4.2, r: 0 }, { c: 'dr', x: 2.1, z: -5.7, r: 0 }, { c: 'ar', x: 6, z: -2, r: 3 }, { c: 'pl', x: 5.6, z: -.5, r: 0 },
  ...(two ? [{ c: 'bk', x: 4.6, z: -4.4, r: 0, f: 1 }, { c: 'ta', x: 3.2, z: -1, r: 0, f: 1 }, { c: 'cr', x: 3.2, z: -.1, r: 2, f: 1 }, { c: 'rr', x: 3.4, z: -3.2, r: 0, f: 1 }, { c: 'lp', x: 1.6, z: -5.6, r: 0, f: 1 }, { c: 'ak', x: 3, z: -6, r: 0, f: 1 }] : [{ c: 'pl', x: 2, z: 5.5, r: 0 }])]);

const views = {};
function viewTex(THREE, kind) { if (views[kind]) return views[kind]; const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const g = cv.getContext('2d');
  const sky = { snow: ['#c7d2fe', '#f1f5f9'], desert: ['#fb923c', '#fde68a'], down: ['#60a5fa', '#e0f2fe'] }[kind] || ['#60a5fa', '#dbeafe']; const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  g.fillStyle = 'rgba(255,255,255,.85)'; for (const [x, y] of [[50, 30], [170, 22], [220, 45]]) { g.beginPath(); g.ellipse(x, y, 26, 9, 0, 0, 7); g.fill(); }
  const hill = (c, y0, a) => { g.fillStyle = c; g.beginPath(); g.moveTo(0, 160); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y0 - Math.sin(x / 40 + a) * 12); g.lineTo(256, 160); g.fill(); };
  if (kind === 'down') { for (let i = 0; i < 12; i++) { const h = 40 + ((i * 37) % 60); g.fillStyle = ['#475569', '#64748b', '#334155'][i % 3]; g.fillRect(i * 22, 120 - h, 20, h + 40); g.fillStyle = '#fde68a'; for (let y = 125 - h; y < 115; y += 10) g.fillRect(i * 22 + 4, y, 4, 4); } hill('#4d7c0f', 140, 0); }
  else if (kind === 'snow') { hill('#e2e8f0', 100, 1); hill('#ffffff', 125, 3); g.fillStyle = '#14532d'; for (let i = 0; i < 9; i++) { const x = 15 + i * 28, y = 130 - (i % 3) * 8; g.beginPath(); g.moveTo(x, y - 30); g.lineTo(x - 10, y); g.lineTo(x + 10, y); g.fill(); } }
  else if (kind === 'desert') { g.fillStyle = '#c2410c'; g.fillRect(30, 70, 60, 60); g.fillRect(170, 85, 70, 50); hill('#fdba74', 125, 2); g.fillStyle = '#15803d'; g.fillRect(120, 95, 8, 40); g.fillRect(110, 105, 8, 4); g.fillRect(110, 100, 4, 9); }
  else if (kind === 'lake' || kind === 'shore') { hill('#65a30d', 95, 0); g.fillStyle = kind === 'shore' ? '#0ea5e9' : '#38bdf8'; g.fillRect(0, 105, 256, 55); g.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 8; i++) g.fillRect(i * 33 + 5, 118 + (i % 3) * 10, 14, 2); if (kind === 'shore') { g.fillStyle = '#fde68a'; g.fillRect(0, 145, 256, 15); } }
  else { hill('#84cc16', 110, 0); hill('#4d7c0f', 130, 2); if (kind === 'farm') { g.fillStyle = '#b91c1c'; g.fillRect(160, 90, 40, 30); g.fillStyle = '#facc15'; for (let i = 0; i < 10; i++) g.fillRect(i * 26, 140, 20, 3); } else { g.fillStyle = '#fef3c7'; g.fillRect(150, 100, 30, 22); g.fillStyle = '#7c3aed'; g.beginPath(); g.moveTo(146, 100); g.lineTo(165, 86); g.lineTo(184, 100); g.fill(); g.fillStyle = '#16a34a'; g.beginPath(); g.arc(60, 108, 16, 0, 7); g.fill(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; views[kind] = t; return t; }

// build one interior in a ROOMS cell. K = { put, flush, G, std }. Returns a handle with live setters.
export function buildInterior(api, K, h, cx, cz, decor) {
  const { THREE, box, LOW } = api; const { put, flush, G } = K; const y = K.y ?? 0; const SC = scOf(h); const two = h.style === 1 || h.style === 3 || !!h.estate; const S = palOf(h);
  const g = new THREE.Group(); g.name = 'interior-' + h.id; const vc = (o = {}) => (LOW ? new THREE.MeshLambertMaterial({ color: '#fff', vertexColors: true, ...o }) : new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.8, vertexColors: true, ...o }));
  const k = 'in' + h.id; const cols = []; const HR = two ? (h.admin ? 8.8 : h.estate ? 7.6 : 6.55) : 3.2; const T = S.trim, A = S.acc;
  const B = (key, c, x, yy, z, sx, sy, sz, solid = 0, sh = 'box', ry = 0, fs = 0) => { x *= SC; z *= SC; if (fs) { sx *= SC; sz *= SC; } put(key, G[sh], c, cx + x, y + yy, cz + z, ry, sx, sy, sz); if (solid) { const b = { x0: cx + x - sx / 2, x1: cx + x + sx / 2, z0: cz + z - sz / 2, z1: cz + z + sz / 2, top: solid === 2 ? y + yy + sy / 2 : solid === 3 ? y + 3.2 : 99, bot: solid === 4 ? y + 3.2 : -99 }; box.push(b); cols.push(b); } };
  const Wl = (x0, x1, z0, z1, h0, h1, solid = 1) => B(k + 'w', '#ffffff', (x0 + x1) / 2, (h0 + h1) / 2, (z0 + z1) / 2, Math.max(0.18, x1 - x0), h1 - h0, Math.max(0.18, z1 - z0), solid, 'box', 0, 1);
  // outer shell (left half + hallway 3.2 m, right half full height on two-story)
  Wl(-6.2, 1, -6.2, -6.0, 0, 3.2); Wl(1, 6.2, -6.2, -6.0, 0, HR); Wl(-6.2, -6.0, -6.2, 6.2, 0, 3.2); Wl(6.0, 6.2, -6.2, 6.2, 0, HR); Wl(-6.2, -0.7, 6.0, 6.2, 0, 3.2); Wl(0.7, 6.2, 6.0, 6.2, 0, HR); Wl(-0.7, 0.7, 6.0, 6.2, 2.3, 3.2, 0);
  // hallway walls (x = -1 with two archways; x = 1 with bedroom + bath doors, open to the stairs/closet at the front)
  for (const [a, b] of [[-6.1, -4.2], [-1.6, 0.6], [5.2, 6.1]]) Wl(-1.09, -0.91, a, b, 0, 3.2); for (const [a, b] of [[-4.2, -1.6], [0.6, 5.2]]) Wl(-1.09, -0.91, a, b, 2.6, 3.2, 0);
  Wl(-6.1, -4.8, -1.09, -0.91, 0, 3.2); Wl(-1.8, -1, -1.09, -0.91, 0, 3.2); Wl(-4.8, -1.8, -1.09, -0.91, 2.6, 3.2, 0);
  const s3 = two ? 3 : 1; for (const [a, b] of [[-6.1, -3.0], [-0.5, 0.9], [2.7, 4.9]]) Wl(0.91, 1.09, a, b, 0, 3.2, s3); for (const [a, b] of [[-3.0, -0.5], [0.9, 2.7]]) Wl(0.91, 1.09, a, b, 2.6, 3.2, 0);
  Wl(1, 6.1, -0.09, 0.09, 0, 3.2, s3); Wl(1, 6.1, 4.81, 4.99, 0, 3.2, s3);
  if (!two) Wl(5.2, 6.1, 4.9, 6.1, 0, 0.0001, 0); // (closet nook stays open)
  if (two) { // upstairs: slab, partitions, railing, stairs
    Wl(0.91, 1.09, -6.1, 6.1, 3.2, HR, 4); B(k + 's', FLOORS[S.floor].l || '#8a5a34', 3.55, 3.275, -0.6, 5.1, 0.15, 11, 0, 'box', 0, 1); { const b = { x0: cx + 1 * SC, x1: cx + 6.1 * SC, z0: cz - 6.1 * SC, z1: cz + 4.9 * SC, top: y + 3.35, bot: y + 3.2 }; box.push(b); cols.push(b); const b2 = { x0: cx + 5.5 * SC, x1: cx + 6.1 * SC, z0: cz + 4.9 * SC, z1: cz + 6.1 * SC, top: y + 3.35, bot: y + 3.2 }; box.push(b2); cols.push(b2); }
    B(k + 's', '#fafaf9', 3.55, 3.3, 5.5, 5.1, 0.05, 1.2, 0, 'box', 0, 1); // landing edge trim
    B(k + 's', T, 3.2, 4.0, 4.9, 4.4, 0.08, 0.08, 0, 'box', 0, 1); for (let x = 1.2; x < 5.4; x += 0.4) B(k + 's', T, x, 3.7, 4.9, 0.05, 0.7, 0.05); { const b = { x0: cx + 1 * SC, x1: cx + 5.45 * SC, z0: cz + 4.84 * SC, z1: cz + 4.96 * SC, top: 99, bot: y + 3.2 }; box.push(b); cols.push(b); }
    for (let i = 0; i < 10; i++) { const top = (i + 1) * 0.335; B(k + 's', i % 2 ? FLOORS[S.floor].c : FLOORS[S.floor].l || '#8a5a34', 1.4 + i * 0.48, top / 2, 5.5, 0.48, top, 1.0, 2, 'box', 0, 1); }
    B(k + 's', T, 3.4, 1.9, 5.02, 4.8, 0.06, 0.06, 0, 'box', 0, 1); }
  // ceilings
  B(k + 's', '#fafaf9', -2.55, 3.2, 0, 7.1, 0.04, 12.2, 0, 'box', 0, 1); B(k + 's', '#fafaf9', 3.55, HR, 0, 5.1, 0.04, 12.2, 0, 'box', 0, 1); if (two) B(k + 's', '#fafaf9', 3.55, 3.18, -0.6, 5.1, 0.02, 11, 0, 'box', 0, 1);
  // baseboards + door frames + front door
  for (const [x, z, sx, sz] of [[-2.55, -5.98, 7.1, .04], [3.55, -5.98, 5.1, .04], [-5.98, 0, .04, 12], [5.98, 0, .04, 12]]) B(k + 's', T, x, 0.06, z, sx, 0.12, sz, 0, 'box', 0, 1);
  B(k + 's', '#7c4a2a', 0, 1.1, 6.05, 1.4, 2.2, 0.08, 0, 'box', 0, 1); B(k + 's', '#fde68a', 0.5, 1.1, 5.99, 0.08, 0.08, 0.04); B(k + 'g', '#22c55e', 0, 2.45, 5.96, 0.9, 0.22, 0.04);
  // hallway runner + console
  B(k + 's', A, 0, 0.012, 1.5, 1.1, 0.02, 7.5, 0, 'box', 0, 1);
  // kitchen (fixed): counter, sink, stove, fridge, upper cabinets
  B(k + 's', '#f8fafc', -3, 0.45, -5.6, 3.8, 0.9, 0.8, 1); B(k + 's', '#cbd5e1', -3, 0.92, -5.6, 3.9, 0.05, 0.85); B(k + 's', '#111827', -2.0, 0.95, -5.6, 0.9, 0.03, 0.6); B(k + 's', '#94a3b8', -3.8, 0.95, -5.55, 0.7, 0.05, 0.45);
  for (const [a, b] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) B(k + 'g', '#ef4444', -2.0 + a, 0.97, -5.6 + b, 0.22, 0.01, 0.22, 0, 'cyl');
  B(k + 's', T, -3, 2.3, -5.8, 3.8, 0.7, 0.4); B(k + 's', '#e2e8f0', -5.6, 1.0, -5.5, 0.8, 2.0, 0.8, 1); B(k + 's', '#94a3b8', -5.25, 1.2, -5.1, 0.04, 0.6, 0.04);
  // bathroom (fixed): tub, toilet, sink + mirror, bath mat
  B(k + 's', '#f8fafc', 5.5, 0.3, 2.3, 0.9, 0.6, 2.0, 1); B(k + 's', '#cbd5e1', 5.5, 2.2, 2.3, 0.04, 0.04, 2.0); B(k + 's', '#cbd5e1', 5.95, 1.9, 2.3, 0.05, 0.05, 0.05); B(k + 's', '#94a3b8', 5.92, 1.85, 2.3, 0.12, 0.06, 0.06); // shower head + curtain rail B(k + 's', '#7dd3fc', 5.5, 0.58, 2.3, 0.7, 0.02, 1.8); B(k + 's', '#f8fafc', 2.0, 0.25, 4.45, 0.45, 0.5, 0.6, 1); B(k + 's', '#f8fafc', 2.0, 0.65, 4.7, 0.45, 0.4, 0.15);
  B(k + 's', '#f8fafc', 3.6, 0.45, 4.6, 0.9, 0.9, 0.5, 1); B(k + 'g', '#e0f2fe', 3.6, 1.6, 4.86, 0.8, 0.7, 0.02); B(k + 's', A, 4.2, 0.012, 2.4, 1.0, 0.02, 0.6); for (let i = -2; i <= 2; i++) B(k + 's', '#cbd5e1', 3.55, 1.2, 0.1 + 0, 5.0, 0.02, 0.01, 0, 'box', 0, 1);
  // windows (painted views) + frames
  const vk = k + 'v'; const win = (x, yy, z, ry, w, hh) => { put(vk, G.plane, '#ffffff', cx + x * SC, y + yy, cz + z * SC, ry, w, hh, 1); const fx = Math.abs(Math.sin(ry)), fz = Math.abs(Math.cos(ry)); B(k + 's', '#ffffff', x, yy - hh / 2, z, w * fz + 0.12 * fx, 0.08, w * fx + 0.12 * fz); B(k + 's', '#ffffff', x, yy + hh / 2, z, w * fz + 0.1 * fx, 0.06, w * fx + 0.1 * fz); B(k + 's', '#ffffff', x, yy, z, 0.05 * fz + 0.06 * fx, hh, 0.05 * fx + 0.06 * fz); };
  win(-3.6, 1.6, 5.98, Math.PI, 1.8, 1.2); win(-3, 1.85, -5.98, 0, 1.6, 0.8); win(-5.98, 1.6, -2.4, Math.PI / 2, 1.4, 1.1); win(5.98, 1.6, -4.0, -Math.PI / 2, 1.4, 1.1); win(5.98, 2.0, 4.0, -Math.PI / 2, 0.8, 0.6);
  if (two) { win(3.6, 4.9, -5.98, 0, 1.6, 1.1); win(5.98, 4.9, -2.0, -Math.PI / 2, 1.4, 1.1); }
  // ceiling lamps (glow) per room
  for (const [x, z, yy] of [[-3.5, 3.2, 3.15], [-3.5, -3, 3.15], [3.5, -3, 3.15], [3.8, 2.4, 3.15], [0, 0, 3.15], [0, 4.5, 3.15], ...(two ? [[3.5, -2.5, HR - 0.05]] : [])]) { B(k + 'g', '#fff7d6', x, yy, z, 0.6, 0.06, 0.6, 0, 'cyl'); B(k + 's', '#cbd5e1', x, yy + 0.04, z, 0.7, 0.02, 0.7, 0, 'cyl'); }
  const wallMat = vc({ color: decor.wall || S.wall }); const structM = vc(); const glowM = new THREE.MeshBasicMaterial({ vertexColors: true }); const viewM = new THREE.MeshBasicMaterial({ map: viewTex(THREE, S.view), vertexColors: true });
  flush(k + 'w', wallMat, !LOW, g); flush(k + 's', structM, !LOW, g); flush(k + 'g', glowM, false, g); flush(vk, viewM, false, g);
  // (interior doors removed: open doorways everywhere)
  // floor (rebuildable) + furniture (rebuildable)
  let floorM = null, decG = null; let decCols = [], seats = [], screens = []; let items = parseItems(decor.items || defaultItems(two, h.num ? h.seed : 0));
  function setFloor(t) { const F = FLOORS[t] || FLOORS[S.floor]; if (floorM) { g.remove(floorM); floorM.geometry.dispose(); } const fk = k + 'f'; put(fk, G.box, F.c, cx, y - 0.05, cz, 0, 12.4 * SC, 0.1, 12.4 * SC);
    if (t === 'tile') { for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) if ((i + j) & 1) put(fk, G.plane, F.l, cx + (i + 0.5) * SC, y + 0.002, cz + (j + 0.5) * SC, 0, SC, SC, 1, -Math.PI / 2); }
    else if (F.l) for (let i = -5; i <= 5; i++) put(fk, G.box, F.l, cx + i * 1.1 * SC, y + 0.002, cz, 0, 0.03, 0.004, 12.2 * SC);
    floorM = flush(fk, vc({ roughness: t === 'carpet' ? 1 : 0.6 }), false, g); }
  function setItems(L) { items = L; if (decG) { g.remove(decG); decG.traverse((o) => o.geometry && o.geometry.dispose()); } for (const b of decCols) { const i = box.indexOf(b); if (i >= 0) box.splice(i, 1); } decCols = []; decG = new THREE.Group(); g.add(decG);
    const dk = k + 'd', gk = k + 'dg'; seats = []; screens = []; for (const it of L) { const D = DECOR[it.c]; if (!D) continue; const th = it.r * Math.PI / 2, c = Math.cos(th), s = Math.sin(th), yb = it.f && two ? 3.35 : 0; const ix = it.x * SC, iz = it.z * SC;
      for (const [x, sy, z, dy] of SEATS[it.c] || []) seats.push({ x: cx + ix + x * c + z * s, z: cz + iz - x * s + z * c, y: y + yb + sy, yaw: th + dy, fx: Math.sin(th + dy), fz: Math.cos(th + dy), fl: y + yb, c: it.c });
      if (SCREENS[it.c]) { const [x, sy, z, w, hh] = SCREENS[it.c]; screens.push({ x: cx + ix + x * c + z * s, z: cz + iz - x * s + z * c, y: y + yb + sy, yaw: th, w, h: hh, fl: y + yb }); }
      for (const [sh, col, x, yy, z, sx, sy, sz, gl] of D.p) { const wx = x * c + z * s, wz = -x * s + z * c; put(gl ? gk : dk, G[sh], col === 'A' ? A : col === 'T' ? T : col, cx + ix + wx, y + yb + yy, cz + iz + wz, th, sx, sy, sz); }
      if (D.foot) { const [w, d] = it.r & 1 ? [D.foot[1], D.foot[0]] : D.foot; const b = { x0: cx + ix - w / 2, x1: cx + ix + w / 2, z0: cz + iz - d / 2, z1: cz + iz + d / 2, top: y + (it.f && two ? 3.35 : 0) + 1.2, bot: it.f && two ? y + 3.3 : -99 }; box.push(b); decCols.push(b); } }
    flush(dk, vc(), !LOW, decG); flush(gk, new THREE.MeshBasicMaterial({ vertexColors: true }), false, decG); }
  setFloor(decor.floor || S.floor); setItems(items);
  function update() { /* doors removed */ }
  // kitchen + bath fixtures for homelife.js (fridge / stove / sink / shower): where to stand, where the thing is, which way to face
  const at = (x, z) => [cx + x * SC, cz + z * SC];
  const spots = [{ k: 'fridge', s: at(-5.6, -4.45), o: at(-5.6, -5.5), yaw: Math.PI }, { k: 'stove', s: at(-2.0, -4.6), o: at(-2.0, -5.6), yaw: Math.PI }, { k: 'sink', s: at(-3.8, -4.6), o: at(-3.8, -5.55), yaw: Math.PI },
    { k: 'shower', s: at(4.55, 2.3), o: at(5.5, 2.3), yaw: Math.PI / 2 }].map((q) => ({ ...q, y, top: q.k === 'stove' ? y + 0.97 : y + 1 }));
  if (h.estate) for (const [sx, sz] of h.admin ? [[5.3, -5.3], [1.8, -5.3]] : [[5.3, -5.3]]) { // mansions: more showers upstairs (glass stalls)
    const sh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), new THREE.MeshStandardMaterial({ color: '#e2e8f0' })); sh.position.set(cx + sx * SC, y + 3.41, cz + sz * SC); g.add(sh); const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.6 })); hd.position.set(cx + sx * SC, y + 5.55, cz + sz * SC); g.add(hd);
    spots.push({ k: 'shower', s: at(sx, sz + 0.95), o: at(sx, sz), yaw: Math.PI, y: y + 3.35, top: y + 4.3 }); }
  // fridge door (own mesh, hinged on the right) so it can swing open
  const fd = new THREE.Group(); fd.position.set(cx - 5.2 * SC, y + 1.0, cz - 5.1 * SC); const fdm = new THREE.Mesh(new THREE.BoxGeometry(0.8 * SC, 1.96, 0.06), new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.5 })); fdm.position.x = -0.4 * SC; fd.add(fdm);
  const fh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: '#94a3b8' })); fh.position.set(-0.72 * SC, 0.2, 0.05); fd.add(fh); const fin = new THREE.Mesh(new THREE.BoxGeometry(0.7 * SC, 1.8, 0.02), new THREE.MeshBasicMaterial({ color: '#e0f2fe' })); fin.position.set(cx - 5.6 * SC, y + 1.0, cz - 5.11 * SC); g.add(fin); g.add(fd);
  return { g, two, S, update, spots, fridgeDoor: fd, setWall: (c) => wallMat.color.set(c || S.wall), setFloor, setItems, items: () => items, seats: () => seats, screens: () => screens, cols };
}
