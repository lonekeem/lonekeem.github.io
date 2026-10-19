// Kemy Pals - original creature art, drawn in code with layered, recolorable parts.
const TAU = Math.PI * 2;
export const VIBES = { water: { name: 'Water', c: '#5aa8ff' }, star: { name: 'Star', c: '#ffd34d' }, leaf: { name: 'Leaf', c: '#6fd39a' }, flame: { name: 'Flame', c: '#ff8a5c' }, spark: { name: 'Spark', c: '#ffe14d' }, moon: { name: 'Moon', c: '#b9a6ff' } };
// body / accent / eye defaults per species; forms = names of the 3 glow-up stages
export const SPECIES = [
  { id: 'kemy', name: 'Kemy', kind: 'axolotl', vibe: 'water', body: '#f7cdee', acc: '#8a55dc', forms: ['Kemy Sprout', 'Kemy', 'Kemy Royale'], blurb: 'A cheerful axolotl with frilly gills. The original Pal.' },
  { id: 'twinkbun', name: 'Twinkbun', kind: 'bunny', vibe: 'star', body: '#fff1c9', acc: '#ffc94d', forms: ['Twinklet', 'Twinkbun', 'Starhop'], blurb: 'A bunny whose ear tips glow like little stars.' },
  { id: 'nimbo', name: 'Nimbo', kind: 'kitten', vibe: 'moon', body: '#eaf2ff', acc: '#9fb8ff', forms: ['Puffkit', 'Nimbo', 'Stratocat'], blurb: 'A fluffy cloud kitten that naps on breezes.' },
  { id: 'ember', name: 'Emberpup', kind: 'pup', vibe: 'flame', body: '#ffc9a8', acc: '#ff7a4d', forms: ['Cinder', 'Emberpup', 'Blazehound'], blurb: 'A warm little pup with a flickering tail tuft.' },
  { id: 'mossy', name: 'Mossle', kind: 'turtle', vibe: 'leaf', body: '#cdeec0', acc: '#5fae6e', forms: ['Sproutle', 'Mossle', 'Grovetop'], blurb: 'A sleepy turtle with a garden growing on its shell.' },
  { id: 'jelly', name: 'Bubbelle', kind: 'jelly', vibe: 'water', body: '#d9d2ff', acc: '#ff9fd6', forms: ['Droplet', 'Bubbelle', 'Lumajelly'], blurb: 'A bubbly jelly that floats instead of walking.' },
  { id: 'prism', name: 'Prismfox', kind: 'fox', vibe: 'star', body: '#e4d6ff', acc: '#7fd8ff', forms: ['Shardkit', 'Prismfox', 'Gemtail'], blurb: 'A crystal fox whose tail sparkles in the light.' },
  { id: 'zap', name: 'Zappip', kind: 'chick', vibe: 'spark', body: '#fff3a6', acc: '#ffb31a', forms: ['Pip', 'Zappip', 'Voltwing'], blurb: 'A buzzy chick with a zigzag crest.' },
  { id: 'luno', name: 'Lunowl', kind: 'owl', vibe: 'moon', body: '#cfc4ff', acc: '#6b4fd6', forms: ['Hootling', 'Lunowl', 'Eclipsowl'], blurb: 'A wise little owl with a crescent on its chest.' },
  { id: 'petal', name: 'Petalmouse', kind: 'mouse', vibe: 'leaf', body: '#ffd6e6', acc: '#ff8fbf', forms: ['Budmouse', 'Petalmouse', 'Bloomwhisk'], blurb: 'A tiny mouse with flower-petal ears.' }
];
export const SPEC = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const BODY_PRESETS = ['#f7cdee', '#ffd6a8', '#cdeec0', '#cfe3ff', '#e4d6ff', '#fff3a6', '#ffc0cb', '#d0d0e0'];
export const ACC_PRESETS = ['#8a55dc', '#ff7ab8', '#5aa8ff', '#5fae6e', '#ffb31a', '#ff7a4d', '#6b4fd6', '#3a2a63'];
export const EYE_PRESETS = ['#24133f', '#2a4a8a', '#3b6b3a', '#7a2a4a', '#5a3a1a'];
export const PATTERNS = ['none', 'spots', 'stripes', 'sparkle'];
export const ACCESSORIES = ['none', 'bow', 'crown', 'shades', 'scarf', 'hat', 'badge'];
export const stageOf = (level) => (level >= 12 ? 2 : level >= 5 ? 1 : 0);
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
export function hueHex(h, s = 70, l = 85) { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l); const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join(''); }
function ell(c, x, y, rx, ry, r = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), r, 0, TAU); }
export function star(c, x, y, r, ri = r * 0.48) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? ri : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
export function heart(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45); c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); }
// pal: {species, colors:{body,accent,eye}, pattern, acc, level}
// st: {t, face, mode:'idle'|'walk'|'hop'|'happy'|'sleep'|'shake'|'eat', mood:{dirty,sad,bandage}, squash}
export function drawPal(c, x, y, size, pal, st = {}) {
  const sp = SPEC[pal.species] || SPECIES[0]; const col = pal.colors || {}; const B = col.body || sp.body, A = col.accent || sp.acc, E = col.eye || '#24133f';
  const stage = stageOf(pal.level || 1); const t = st.t || 0; const face = st.face || 1; const mood = st.mood || {};
  const k = size / 40; // drawn in a 40-unit box, origin feet centre
  c.save(); c.translate(x, y); c.scale(k, k);
  let bob = 0, tilt = 0, sx = 1, sy = 1, leg = 0;
  if (st.mode === 'idle') bob = Math.sin(t * 0.06) * 0.8;
  if (st.mode === 'walk') { leg = Math.sin(t * 0.35); bob = -Math.abs(leg) * 1.2; tilt = 0.06 * face; }
  if (st.mode === 'hop') { bob = -Math.abs(Math.sin(t * 0.18)) * 9; }
  if (st.mode === 'happy') { tilt = Math.sin(t * 0.4) * 0.25; bob = -Math.abs(Math.sin(t * 0.2)) * 6; }
  if (st.mode === 'shake') { tilt = Math.sin(t * 1.3) * 0.22; }
  if (st.mode === 'sleep') { bob = Math.sin(t * 0.03) * 0.5; sy = 0.92; sx = 1.06; }
  if (sp.kind === 'jelly') bob += Math.sin(t * 0.07) * 2 - 3;
  const sc = [0.82, 1, 1.12][stage];
  if (stage === 2) { const g = c.createRadialGradient(0, -16, 2, 0, -16, 26); g.addColorStop(0, 'rgba(255,230,140,.35)'); g.addColorStop(1, 'rgba(178,107,255,0)'); c.fillStyle = g; c.fillRect(-28, -44, 56, 46); }
  // shadow
  c.fillStyle = 'rgba(30,10,60,.18)'; ell(c, 0, 0, 11 * sc, 2.4); c.fill();
  c.translate(0, bob); c.rotate(tilt); c.scale(face * sx * sc * (st.squash ? 1 / st.squash : 1) ** 0.5, sy * sc * (st.squash || 1));
  c.lineWidth = 1; c.lineJoin = 'round'; c.lineCap = 'round'; const line = shade(A, -0.35); c.strokeStyle = line;
  const bodyGrad = (y0, y1) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, shade(B, 0.45)); g.addColorStop(1, B); return g; };
  const feature = (fn) => { c.save(); fn(); c.restore(); };
  const kind = sp.kind;
  // ---- back features (tail, wings, shell)
  if (kind === 'axolotl') feature(() => { c.translate(-6, -6); c.rotate(-0.3 + Math.sin(t * 0.12) * 0.2); c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(-8, -6, -13 - stage * 2, -2); c.quadraticCurveTo(-8, 2, 0, 3); c.closePath(); c.fillStyle = shade(B, -0.08); c.fill(); c.stroke(); });
  if (kind === 'fox') feature(() => { c.translate(-6, -6); c.rotate(-0.6 + Math.sin(t * 0.1) * 0.2); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-10, -14 - stage * 3, -4, -18 - stage * 3); c.quadraticCurveTo(2, -8, 0, 0); c.fillStyle = A; c.fill(); c.stroke(); if (stage) { c.fillStyle = 'rgba(255,255,255,.8)'; star(c, -4, -15 - stage * 3, 2); c.fill(); } });
  if (kind === 'pup' || kind === 'kitten' || kind === 'mouse') feature(() => { c.translate(-6, -5); c.rotate(-0.8 + Math.sin(t * 0.14) * 0.3); c.strokeStyle = kind === 'kitten' ? B : A; c.lineWidth = kind === 'mouse' ? 1.4 : 3.2; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-7, -2, -8, -9); c.stroke(); if (kind === 'pup') { c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-8, -7); c.quadraticCurveTo(-12, -13, -8, -17 - stage * 2); c.quadraticCurveTo(-4, -12, -8, -7); c.fill(); } });
  if (kind === 'turtle') feature(() => { ell(c, -1, -8, 11, 8); c.fillStyle = A; c.fill(); c.stroke(); c.strokeStyle = shade(A, -0.25); for (const [a, b] of [[-5, -10], [2, -11], [-1, -5]]) { ell(c, a, b, 2.6, 2); c.stroke(); } c.fillStyle = '#7fe08a'; for (let i = 0; i <= stage; i++) { ell(c, -4 + i * 4, -16, 2, 3, 0.4 * (i - 1)); c.fill(); } if (stage === 2) { c.fillStyle = '#ff9fd6'; ell(c, 0, -17.5, 1.5, 1.5); c.fill(); } });
  if (kind === 'chick' || kind === 'owl') feature(() => { for (const s of [-1, 1]) { c.save(); c.translate(s * 7, -9); c.rotate(s * (0.4 + (st.mode === 'happy' ? Math.sin(t * 0.6) * 0.4 : 0))); ell(c, s * 2, 0, 3 + stage, 5 + stage); c.fillStyle = A; c.fill(); c.stroke(); c.restore(); } });
  // ---- legs
  if (kind !== 'jelly') { c.fillStyle = shade(B, -0.1); ell(c, -3 + leg * 1.5, -1.5, 2.4, 1.8); c.fill(); c.stroke(); ell(c, 3.5 - leg * 1.5, -1.5, 2.4, 1.8); c.fill(); c.stroke(); }
  else { c.strokeStyle = A; c.lineWidth = 1.6; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 2.6, -4); c.quadraticCurveTo(i * 2.6 + Math.sin(t * 0.1 + i) * 2, 1, i * 2.6, 4 + stage * 2); c.stroke(); } c.lineWidth = 1; c.strokeStyle = line; }
  // ---- body + head (one chubby blob for most)
  if (kind !== 'jelly') { ell(c, 0, -5.5, 6.8, 5.2); c.fillStyle = bodyGrad(-11, 0); c.fill(); c.stroke(); }
  // ears / head features behind head
  if (kind === 'bunny') for (const s of [-1, 1]) feature(() => { c.translate(s * 4, -20); c.rotate(s * 0.25 + Math.sin(t * 0.05 + s) * 0.06); ell(c, 0, -6, 2.8, 7 + stage); c.fillStyle = B; c.fill(); c.stroke(); ell(c, 0, -6, 1.3, 5 + stage); c.fillStyle = shade(A, 0.4); c.fill(); c.fillStyle = A; star(c, 0, -13.5 - stage, 2.6 + stage * 0.4); c.fill(); c.stroke(); });
  if (kind === 'kitten' || kind === 'fox' || kind === 'pup') for (const s of [-1, 1]) feature(() => { c.translate(s * 6, -19); c.rotate(s * (kind === 'pup' ? 0.9 : 0.25)); c.beginPath(); c.moveTo(-3.5, 2); c.lineTo(0, -6 - stage); c.lineTo(3.5, 2); c.closePath(); c.fillStyle = kind === 'kitten' ? B : A; c.fill(); c.stroke(); });
  if (kind === 'mouse') for (const s of [-1, 1]) feature(() => { c.translate(s * 7, -19); for (let i = 0; i < 3 + stage; i++) { c.save(); c.rotate(i * 1.5); ell(c, 0, -3, 2.2, 3.6); c.fillStyle = i % 2 ? A : shade(A, 0.35); c.fill(); c.stroke(); c.restore(); } });
  if (kind === 'axolotl') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) feature(() => { c.translate(s * 7.5, -15 + i * 2.6); c.rotate((s < 0 ? Math.PI : 0) + s * (-0.75 + i * 0.6) + Math.sin(t * 0.08 + i) * 0.08 * s); const L = 7.6 + stage * 1.6; c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(2, -3.4, L * 0.65, -3.2, L, -1.6); c.quadraticCurveTo(L * 0.8, 0, L, 1.4); c.bezierCurveTo(L * 0.65, 3, 2, 3, 0, 0); c.fillStyle = A; c.fill(); c.stroke(); c.strokeStyle = shade(A, 0.5); c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 0); c.lineTo(L - 1.3, 0); c.stroke(); });
  if (kind === 'chick') feature(() => { c.fillStyle = A; c.beginPath(); c.moveTo(-2, -20); c.lineTo(0, -25 - stage * 2); c.lineTo(1, -22); c.lineTo(3, -27 - stage * 2); c.lineTo(3.5, -20); c.closePath(); c.fill(); c.stroke(); });
  if (kind === 'owl') for (const s of [-1, 1]) feature(() => { c.translate(s * 6, -20); c.beginPath(); c.moveTo(-2.5, 2); c.lineTo(s * 2, -4 - stage); c.lineTo(2.5, 2); c.fillStyle = A; c.fill(); c.stroke(); });
  if (kind === 'kitten') feature(() => { c.fillStyle = 'rgba(255,255,255,.95)'; for (const [a, b, r] of [[-8, -9, 3.2], [8, -9, 3.2], [-6, -4, 2.6], [6, -4, 2.6]]) { ell(c, a, b, r, r * 0.8); c.fill(); } });
  // head
  const hy = kind === 'jelly' ? -10 : -13.5, hr = kind === 'jelly' ? 10 : 9.2;
  if (kind === 'jelly') { c.beginPath(); c.moveTo(-hr, hy + 4); c.bezierCurveTo(-hr, hy - 12, hr, hy - 12, hr, hy + 4); c.quadraticCurveTo(hr * 0.5, hy + 7, 0, hy + 5); c.quadraticCurveTo(-hr * 0.5, hy + 7, -hr, hy + 4); c.globalAlpha = 0.92; }
  else ell(c, 0, hy, hr, 7.6);
  { const g = c.createRadialGradient(-2, hy - 3, 2, 0, hy, 11); g.addColorStop(0, shade(B, 0.65)); g.addColorStop(0.6, shade(B, 0.25)); g.addColorStop(1, B); c.fillStyle = g; c.fill(); c.stroke(); c.globalAlpha = 1; }
  // pattern (clipped to head)
  if (pal.pattern && pal.pattern !== 'none') feature(() => { ell(c, 0, hy, hr - 0.5, 7.1); c.clip(); c.fillStyle = shade(A, 0.25); c.strokeStyle = shade(A, 0.2); c.globalAlpha = 0.55;
    if (pal.pattern === 'spots') for (const [a, b, r] of [[-6, -18, 1.6], [6.5, -17, 1.3], [-7.5, -12, 1.1], [7, -11, 1.5], [0, -20, 1.2]]) { ell(c, a, b - (hy + 13.5) * -1 + 0, r, r); c.fill(); }
    if (pal.pattern === 'stripes') { c.lineWidth = 1.4; for (const a of [-5, 0, 5]) { c.beginPath(); c.moveTo(a - 1, hy - 8); c.quadraticCurveTo(a + 1, hy - 5, a, hy - 3); c.stroke(); } }
    if (pal.pattern === 'sparkle') { c.globalAlpha = 0.9; c.fillStyle = '#fff'; for (const [a, b, r] of [[-6, -17, 1.7], [6, -18, 1.4], [-7, -11, 1.1], [7.5, -12, 1.2]]) { star(c, a, b + (hy + 13.5), r, r * 0.4); c.fill(); } }
  });
  if (kind === 'owl') { c.fillStyle = shade(A, 0.3); c.beginPath(); c.arc(0, -6, 3, 0.6, TAU - 0.6); c.arc(1.6, -6, 2.4, TAU - 0.9, 0.9, true); c.fill(); }
  // face
  const fx = 1.2, ey = hy - 0.1;
  c.fillStyle = '#ff9fc8'; c.globalAlpha = 0.75; ell(c, fx - 6, ey + 2.5, 1.9, 1.1); c.fill(); ell(c, fx + 6, ey + 2.5, 1.9, 1.1); c.fill(); c.globalAlpha = 1;
  const closed = st.mode === 'sleep' || st.mode === 'happy' && Math.sin(t * 0.4) > 0.6 || (st.mode === 'idle' && t % 200 < 7) || st.mode === 'shake';
  if (closed) { c.strokeStyle = E; c.lineWidth = 1.1; c.beginPath(); c.moveTo(fx - 5, ey); c.quadraticCurveTo(fx - 3.5, ey + (st.mode === 'happy' ? -1.4 : 1), fx - 2, ey); c.moveTo(fx + 2, ey); c.quadraticCurveTo(fx + 3.5, ey + (st.mode === 'happy' ? -1.4 : 1), fx + 5, ey); c.stroke(); }
  else { c.fillStyle = E; ell(c, fx - 3.6, ey, 2, 2.3); c.fill(); ell(c, fx + 3.6, ey, 2, 2.3); c.fill(); c.fillStyle = '#fff'; ell(c, fx - 3, ey - 0.9, 0.75, 0.75); c.fill(); ell(c, fx + 4.2, ey - 0.9, 0.75, 0.75); c.fill(); }
  c.strokeStyle = '#24133f'; c.lineWidth = 0.8;
  if (kind === 'chick' || kind === 'owl') { c.fillStyle = '#ffb31a'; c.beginPath(); c.moveTo(fx - 1.3, ey + 2.4); c.lineTo(fx + 1.3, ey + 2.4); c.lineTo(fx, ey + 4.2); c.closePath(); c.fill(); }
  else if (mood.sad && st.mode !== 'happy' && st.mode !== 'sleep') { c.beginPath(); c.moveTo(fx - 1.8, ey + 4.4); c.quadraticCurveTo(fx, ey + 2.8, fx + 1.8, ey + 4.4); c.stroke(); c.fillStyle = '#8fd0ff'; ell(c, fx - 5, ey + 3.4, 0.8, 1.2); c.fill(); }
  else if (st.mode === 'eat') { ell(c, fx, ey + 3.6, 1.6, 1.4 + Math.abs(Math.sin(t * 0.5))); c.fillStyle = '#7a2a4a'; c.fill(); }
  else { c.beginPath(); c.moveTo(fx - 1.8, ey + 2.9); c.quadraticCurveTo(fx - 0.9, ey + 4.1, fx, ey + 3.1); c.quadraticCurveTo(fx + 0.9, ey + 4.1, fx + 1.8, ey + 2.9); c.stroke(); }
  if (kind === 'pup' || kind === 'kitten' || kind === 'fox' || kind === 'mouse') { c.fillStyle = '#5a2a4a'; ell(c, fx, ey + 1.9, 0.9, 0.6); c.fill(); }
  // mud spots + bandage
  if (mood.dirty) { c.fillStyle = 'rgba(120,80,50,.75)'; for (const [a, b, r] of [[-5, -7, 1.8], [4, -4, 1.4], [6, -16, 1.5], [-7, -15, 1.2], [1, -2.5, 1]]) { ell(c, a, b, r * 1.3, r); c.fill(); } }
  if (mood.bandage) { c.save(); c.translate(-5, -19); c.rotate(-0.5); c.fillStyle = '#ffe1c4'; c.strokeStyle = '#c99b74'; c.beginPath(); c.roundRect(-3.5, -1.2, 7, 2.4, 1.2); c.fill(); c.stroke(); c.fillStyle = '#e8bf98'; c.fillRect(-1, -0.8, 2, 1.6); c.restore(); }
  // accessories
  const a = pal.acc;
  if (a === 'bow') { c.fillStyle = '#ff6fae'; c.strokeStyle = '#a3306a'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4, -21); c.lineTo(4 + s * 4, -24); c.lineTo(4 + s * 4, -18); c.closePath(); c.fill(); c.stroke(); } ell(c, 4, -21, 1.3, 1.3); c.fill(); c.stroke(); }
  if (a === 'crown') { c.fillStyle = '#ffd34d'; c.strokeStyle = '#a8700f'; c.beginPath(); c.moveTo(-4, -20); c.lineTo(-4, -25); c.lineTo(-2, -22.5); c.lineTo(0, -26); c.lineTo(2, -22.5); c.lineTo(4, -25); c.lineTo(4, -20); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#b26bff'; ell(c, 0, -21.5, 0.9, 0.9); c.fill(); }
  if (a === 'shades') { c.fillStyle = '#2a1458'; c.strokeStyle = '#ffd34d'; c.lineWidth = 0.7; star(c, fx - 3.6, ey, 3); c.fill(); c.stroke(); star(c, fx + 3.6, ey, 3); c.fill(); c.stroke(); c.beginPath(); c.moveTo(fx - 1, ey - 0.5); c.lineTo(fx + 1, ey - 0.5); c.stroke(); }
  if (a === 'scarf') { c.fillStyle = '#ff7a8a'; c.strokeStyle = '#a3304a'; c.beginPath(); c.roundRect(-6.5, -8.6, 13, 3, 1.5); c.fill(); c.stroke(); c.beginPath(); c.roundRect(2, -7, 3, 6, 1.2); c.fill(); c.stroke(); }
  if (a === 'hat') { c.fillStyle = '#6b4fd6'; c.strokeStyle = '#2a1458'; ell(c, 0, -20.5, 7, 1.6); c.fill(); c.stroke(); c.beginPath(); c.roundRect(-4, -27, 8, 6.5, 1.5); c.fill(); c.stroke(); c.fillStyle = '#ffd34d'; c.fillRect(-4, -22.5, 8, 1.4); }
  if (a === 'badge') { c.fillStyle = '#8a2be2'; c.strokeStyle = '#ffd34d'; ell(c, 3, -6, 2.8, 2.8); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 2.6px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KL', 3, -5.9); }
  if (stage === 2 && a !== 'crown' && a !== 'hat') { c.fillStyle = '#ffd34d'; star(c, -5, -22, 1.6 + Math.sin(t * 0.08) * 0.3); c.fill(); }
  c.restore();
  if (st.mode === 'sleep') { c.save(); c.fillStyle = '#c9b8ff'; c.font = `bold ${7 * k}px sans-serif`; for (let i = 0; i < 3; i++) { const p = ((t * 0.01 + i / 3) % 1); c.globalAlpha = 1 - p; c.fillText('z', x + (8 + p * 10) * k, y - (26 + p * 14) * k); } c.restore(); }
}
export function drawEgg(c, x, y, size, t, cracks = 0, A = '#b47cf0') {
  const k = size / 40; c.save(); c.translate(x, y); c.scale(k, k); c.rotate(Math.sin(t * 0.15) * 0.08 * (1 + cracks));
  c.fillStyle = 'rgba(30,10,60,.18)'; ell(c, 0, 0, 10, 2.4); c.fill();
  c.beginPath(); c.moveTo(0, -30); c.bezierCurveTo(12, -30, 13, -2, 0, -1); c.bezierCurveTo(-13, -2, -12, -30, 0, -30);
  const g = c.createLinearGradient(0, -30, 0, 0); g.addColorStop(0, '#fff6fd'); g.addColorStop(1, '#f2c9f0'); c.fillStyle = g; c.fill(); c.strokeStyle = '#7d4fc0'; c.stroke();
  c.fillStyle = A; for (const [a, b] of [[-4, -20], [5, -14], [-3, -9], [4, -24]]) { star(c, a, b, 2.2); c.fill(); }
  c.strokeStyle = '#5a2a8c'; c.lineWidth = 1;
  if (cracks > 0) { c.beginPath(); c.moveTo(-8, -16); c.lineTo(-4, -13); c.lineTo(-1, -17); c.lineTo(2, -13); if (cracks > 1) { c.lineTo(5, -17); c.lineTo(8.5, -14); } c.stroke(); }
  c.restore();
}
// snacks / props
export function drawSnack(c, x, y, r, kind) {
  c.save(); c.translate(x, y); c.lineWidth = 1.2;
  if (kind === 0) { c.fillStyle = '#ffcf6b'; c.strokeStyle = '#a8700f'; star(c, 0, 0, r); c.fill(); c.stroke(); c.fillStyle = '#7a3a1a'; for (const [a, b] of [[-r * 0.2, -r * 0.1], [r * 0.25, r * 0.15]]) { ell(c, a, b, r * 0.1, r * 0.1); c.fill(); } }
  if (kind === 1) { c.fillStyle = '#ff6f9a'; c.strokeStyle = '#8a2a4a'; ell(c, -r * 0.3, r * 0.1, r * 0.55, r * 0.55); c.fill(); c.stroke(); ell(c, r * 0.35, r * 0.15, r * 0.5, r * 0.5); c.fill(); c.stroke(); c.strokeStyle = '#3b8a4a'; c.beginPath(); c.moveTo(0, -r * 0.3); c.lineTo(r * 0.2, -r * 0.9); c.stroke(); }
  if (kind === 2) { c.fillStyle = '#9fd8ff'; c.strokeStyle = '#2a5a8a'; c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(-r * 0.2, -r * 0.8, r * 0.5, 0); c.quadraticCurveTo(-r * 0.2, r * 0.8, -r, 0); c.fill(); c.stroke(); c.beginPath(); c.moveTo(r * 0.4, 0); c.lineTo(r, -r * 0.5); c.lineTo(r, r * 0.5); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
export function drawBubble(c, x, y, r) { ell(c, x, y, r, r); const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(0.8, 'rgba(200,180,255,.35)'); g.addColorStop(1, 'rgba(240,190,255,.8)'); c.fillStyle = g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 0.8; c.stroke(); ell(c, x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.13, -0.6); c.fillStyle = '#fff'; c.fill(); }
