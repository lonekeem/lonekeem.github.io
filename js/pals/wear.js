// Pal wearables, drawn in code in drawPal's local space (head centre (0, hy), radius 9.2; body centre (0, -5.5*bodyG)).
// They fit every species because they are anchored to the shared head/body/feet layout.
import { ITEM } from './catalog.js';
import { WEAR_BY } from './wardrobe.js';
const TAU = Math.PI * 2;
function ell(c, x, y, rx, ry, r = 0) { c.beginPath(); c.ellipse(x, y, Math.abs(rx), Math.abs(ry), r, 0, TAU); }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)); return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1); }
function starP(c, x, y, r, ri = r * 0.48) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? ri : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
const fs = (c, f, s) => { c.fillStyle = f; c.strokeStyle = s || shade(f, -0.45); c.fill(); c.stroke(); };
// outfit = { head, face, neck, body, feet, back } of item ids; layer = which pass drawPal is in
export function drawWear(c, layer, outfit, g) {
  if (!outfit) return;
  const slots = layer === 'back' ? ['back'] : layer === 'feet' ? ['feet'] : layer === 'body' ? (g.feet ? ['body'] : ['feet', 'body']) : ['neck', 'face', 'head'];
  for (const s of slots) { const it = ITEM[outfit[s]] || WEAR_BY[outfit[s]]; if (it && it.slot === s && !it.hw) { c.save(); c.lineWidth = 0.8; try { STYLE[it.st] && STYLE[it.st](c, it.col, g); } catch {} c.restore(); } }
  // 💍 2D/flat fallback for jewelry & accessories (earrings, headphones, bracelets, watches, rings) on top of the head pass
  if (layer === 'head') for (const s of ['ears', 'nose', 'wrist', 'hand']) { const it = WEAR_BY[outfit[s]]; if (it && it.slot === s && JEWEL2D[it.st]) { c.save(); c.lineWidth = 0.7; try { JEWEL2D[it.st](c, it.col, g); } catch {} c.restore(); } }
}
const glint2 = (c, x, y, k, t) => { const v = 0.5 + 0.5 * Math.sin((t || 0) * 0.12 + x); c.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * v})`; starP(c, x, y, k * (0.6 + 0.6 * v), k * 0.2); c.fill(); };
const gemC = (col) => (/ffcf3a/i.test(col) ? '#fff2a8' : /d0d8e8/i.test(col) ? '#e8f4ff' : col);
const EARX = 9.5, wx = (g) => 6.9 * g.bodyG;
const NX = 1.0, NY = (g) => g.hy + 1.3; // 👃 flat nose-ring spot (just right of the nose on the shared head layout)
const nh = (c, col, g, r = 1.2, x = NX) => { c.strokeStyle = col; c.lineWidth = 0.6; ell(c, x, NY(g) + r * 0.9, r, r); c.stroke(); };
const JEWEL2D = {
  nhoop(c, col, g) { nh(c, col, g); }, ndouble(c, col, g) { nh(c, col, g, 1); nh(c, col, g, 1.4, NX + 0.6); },
  nstud(c, col, g) { ell(c, NX, NY(g), 0.8, 0.8); fs(c, col, '#5a1838'); glint2(c, NX + 0.4, NY(g) - 0.4, 0.6, g.t); },
  nheartstud(c, col, g) { ell(c, NX, NY(g), 0.7, 0.6); fs(c, col); },
  nstar(c, col, g) { starP(c, NX, NY(g), 1.1); fs(c, col); glint2(c, NX + 0.4, NY(g) - 0.4, 0.6, g.t); },
  nheart(c, col, g) { nh(c, col, g, 0.9); ell(c, NX, NY(g) + 2, 0.7, 0.6); fs(c, '#ff7fb0'); },
  nchain(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.5; c.setLineDash([0.6, 0.4]); c.beginPath(); c.moveTo(NX, NY(g)); c.quadraticCurveTo(NX + 2.5, NY(g) + 2.2, NX + 5, NY(g) - 0.5); c.stroke(); c.setLineDash([]); nh(c, col, g, 0.7); },
  nrainbow(c, col, g) { ['#ff5a5a', '#ffd93a', '#5ccf6a', '#4aa8ff', '#a070ff'].forEach((k, i) => { c.strokeStyle = k; c.lineWidth = 0.6; c.beginPath(); c.arc(NX, NY(g) + 1.1, 1.2, i * TAU / 5, (i + 1) * TAU / 5); c.stroke(); }); },
  ncrystal(c, col, g) { nh(c, '#d0d8e8', g); ell(c, NX, NY(g) + 2.4, 0.7, 0.9); fs(c, col); glint2(c, NX + 0.4, NY(g) + 2, 0.7, g.t); },
  stud(c, col, g) { for (const s of [-1, 1]) { ell(c, s * EARX, g.hy + 1.6, 1.3, 1.3); fs(c, gemC(col), shade(col, -0.5)); glint2(c, s * EARX + 0.5, g.hy + 1.1, 1, g.t); } },
  hoop(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.9; for (const s of [-1, 1]) { ell(c, s * EARX, g.hy + 3.6, 1.9, 2.2); c.stroke(); } },
  drop(c, col, g) { for (const s of [-1, 1]) { c.strokeStyle = shade(col, -0.3); c.beginPath(); c.moveTo(s * EARX, g.hy + 1.4); c.lineTo(s * EARX, g.hy + 3); c.stroke(); starP(c, s * EARX, g.hy + 4.4, 2); fs(c, col); glint2(c, s * EARX + 0.6, g.hy + 3.8, 0.9, g.t); } },
  phones(c, col, g) { c.strokeStyle = col; c.lineWidth = 1.6; c.beginPath(); c.arc(0, g.hy, 10.2, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * EARX - 2, g.hy - 3, 4, 5.4, 1.6); fs(c, col); } },
  bracelet(c, col, g) { c.beginPath(); c.roundRect(wx(g) - 0.4, -4.6, 3.4, 1.5, 0.7); fs(c, col); glint2(c, wx(g) + 1.3, -3.9, 0.8, g.t); },
  beadband(c, col, g) { for (let i = 0; i < 4; i++) { ell(c, wx(g) + i * 0.9, -3.9, 0.6, 0.6); fs(c, i % 2 ? '#ffffff' : col); } },
  watch(c, col, g) { c.beginPath(); c.roundRect(wx(g) - 0.4, -4.6, 3.4, 1.5, 0.6); fs(c, '#2a2438'); ell(c, wx(g) + 1.3, -3.85, 1.3, 1.3); fs(c, col, '#d0d8e8'); },
  ring(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.8; ell(c, wx(g) + 1.4, -1.6, 1.1, 1.1); c.stroke(); glint2(c, wx(g) + 2.1, -2.3, 0.7, g.t); },
  gem(c, col, g) { c.strokeStyle = '#ffcf3a'; c.lineWidth = 0.8; ell(c, wx(g) + 1.4, -1.4, 1.1, 1.1); c.stroke(); c.beginPath(); c.moveTo(wx(g) + 1.4, -4); c.lineTo(wx(g) + 2.6, -2.8); c.lineTo(wx(g) + 1.4, -1.8); c.lineTo(wx(g) + 0.2, -2.8); c.closePath(); fs(c, gemC(col)); glint2(c, wx(g) + 2.2, -3.6, 0.9, g.t); },
};
const by = (g) => -5.5 * g.bodyG, bw = (g) => 6.9 * g.bodyG, bh = (g) => 5.3 * g.bodyG;
function bodyClip(c, g) { ell(c, 0, by(g), bw(g), bh(g)); c.clip(); }
// shoes sit on the rigged feet (g.feet = [{x,y,r}] from drawPal), or the classic spots
function onFeet(c, g, fn) { for (const f of (g && g.feet) || [{ x: -3.3, y: 0, r: 0 }, { x: 3.3, y: 0, r: 0 }]) { c.save(); c.translate(f.x, f.y); c.rotate(f.r || 0); fn(); c.restore(); } }
const STYLE = {
  // ---- back
  cape(c, col, g) { const sw = Math.sin(g.t * 0.08) * 1.2; c.beginPath(); c.moveTo(-5, g.hy + 7); c.quadraticCurveTo(-11 - sw, by(g), -9 - sw, 0); c.lineTo(9 + sw, 0); c.quadraticCurveTo(11 + sw, by(g), 5, g.hy + 7); c.closePath(); fs(c, col); if (col === '#2a1a6a') { c.fillStyle = '#fff'; for (const [x, y] of [[-5, -4], [4, -7], [6, -2], [-2, -9]]) { starP(c, x, y, 0.9); c.fill(); } } },
  backpack(c, col, g) { c.beginPath(); c.roundRect(-11 * g.bodyG, by(g) - 4, 6, 8, 2); fs(c, col); c.fillStyle = shade(col, 0.3); c.fillRect(-10.5 * g.bodyG, by(g), 5, 2); },
  wings(c, col, g) { c.globalAlpha = 0.8; for (const s of [-1, 1]) { ell(c, s * 9, by(g) - 4 + Math.sin(g.t * 0.3) * 0.6, 6, 3.5, -0.5 * s); fs(c, col, '#9ac8f0'); ell(c, s * 8, by(g) + 1, 4, 2.4, 0.4 * s); fs(c, '#ffe8fb', '#e0a8d8'); } },
  balloon(c, col, g) { c.strokeStyle = '#7a6a9a'; c.beginPath(); c.moveTo(-6, by(g)); c.quadraticCurveTo(-10, g.hy, -12, g.hy - 14 + Math.sin(g.t * 0.05)); c.stroke(); starP(c, -12, g.hy - 18 + Math.sin(g.t * 0.05), 4.5); fs(c, col); },
  // ---- feet
  sneakers(c, col, g) { onFeet(c, g, () => { c.beginPath(); c.roundRect(-2.6, -2.4, 5.4, 2.6, 1.3); fs(c, col); c.fillStyle = '#fff'; c.fillRect(-2.6, -0.6, 5.4, 0.8); }); },
  boots(c, col, g) { onFeet(c, g, () => { c.beginPath(); c.roundRect(-2.3, -4, 4.8, 4.2, 1.2); fs(c, col); }); },
  slippers(c, col, g) { onFeet(c, g, () => { ell(c, 0.2, -1.1, 3, 1.6); fs(c, col, '#d8a8c8'); ell(c, -0.8, -2.8, 0.7, 1.5); fs(c, col, '#d8a8c8'); ell(c, 1.2, -2.8, 0.7, 1.5); fs(c, col, '#d8a8c8'); }); },
  // ---- body
  tee(c, col, g) { c.save(); bodyClip(c, g); c.fillStyle = col; c.fillRect(-12, by(g) - bh(g), 24, bh(g) * 1.35); c.restore(); ell(c, 0, by(g), bw(g), bh(g)); c.strokeStyle = shade(col, -0.45); c.stroke(); },
  hoodie(c, col, g) { STYLE.tee(c, col, g); c.fillStyle = shade(col, -0.15); c.beginPath(); c.roundRect(-3, by(g) + 0.5, 6, 2.6, 1); c.fill(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(-1.2, by(g) - bh(g) + 1); c.lineTo(-1.2, by(g) - 1); c.moveTo(1.2, by(g) - bh(g) + 1); c.lineTo(1.2, by(g) - 1); c.stroke(); },
  dress(c, col, g) { c.beginPath(); c.moveTo(-4.5 * g.bodyG, by(g) - 3); c.lineTo(4.5 * g.bodyG, by(g) - 3); c.lineTo(8.5 * g.bodyG, -1); c.quadraticCurveTo(0, 1, -8.5 * g.bodyG, -1); c.closePath(); fs(c, col); c.fillStyle = '#fff'; for (const x of [-4, 0, 4]) { ell(c, x, -2.5, 0.7, 0.7); c.fill(); } },
  sweater(c, col, g) { STYLE.tee(c, col, g); c.save(); bodyClip(c, g); c.fillStyle = shade(col, 0.45); for (let y = by(g) - 3; y < 0; y += 2.6) c.fillRect(-12, y, 24, 1.1); c.restore(); },
  overalls(c, col, g) { c.save(); bodyClip(c, g); c.fillStyle = col; c.fillRect(-12, by(g) - 0.5, 24, 10); c.fillRect(-3, by(g) - 3, 6, 3); c.restore(); c.strokeStyle = col; c.lineWidth = 1; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 2.5, by(g) - 3); c.lineTo(s * 4, by(g) - bh(g) + 0.5); c.stroke(); } c.fillStyle = '#ffd34d'; ell(c, -2.3, by(g) - 2.4, 0.6, 0.6); c.fill(); ell(c, 2.3, by(g) - 2.4, 0.6, 0.6); c.fill(); },
  tutu(c, col, g) { c.beginPath(); for (let i = 0; i <= 12; i++) { const x = -9 * g.bodyG + i * 1.5 * g.bodyG; c.lineTo(x, by(g) + (i % 2 ? 4.5 : 2)); } c.lineTo(8 * g.bodyG, by(g)); c.lineTo(-8 * g.bodyG, by(g)); c.closePath(); c.globalAlpha = 0.9; fs(c, col, '#e090c8'); c.globalAlpha = 1; c.fillStyle = '#ffd34d'; for (const x of [-5, 0, 5]) { starP(c, x, by(g) + 2, 0.9); c.fill(); } },
  jersey(c, col, g) { STYLE.tee(c, col, g); c.fillStyle = '#ffd34d'; c.font = `bold ${3.6 * g.bodyG}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KL', 0, by(g) + 0.5); },
  raincoat(c, col, g) { STYLE.tee(c, col, g); c.strokeStyle = shade(col, -0.4); c.beginPath(); c.moveTo(0, by(g) - bh(g)); c.lineTo(0, 0); c.stroke(); c.fillStyle = shade(col, -0.4); for (const y of [-2, 1.2]) { ell(c, 1.2, by(g) + y, 0.5, 0.5); c.fill(); } },
  // ---- neck
  scarf(c, col, g) { c.beginPath(); c.roundRect(-6.5, g.hy + 4.9, 13, 3, 1.5); fs(c, col); c.beginPath(); c.roundRect(2, g.hy + 6.5, 3, 6, 1.2); fs(c, col); },
  bowtie(c, col, g) { const y = g.hy + 7; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(0, y); c.lineTo(s * 3.6, y - 2); c.lineTo(s * 3.6, y + 2); c.closePath(); fs(c, col); } ell(c, 0, y, 1, 1); fs(c, col); },
  bandana(c, col, g) { const y = g.hy + 5.5; c.beginPath(); c.moveTo(-6, y); c.lineTo(6, y); c.lineTo(0, y + 6); c.closePath(); fs(c, col); c.fillStyle = '#fff'; for (const [x, yy] of [[-2.5, 1.2], [2, 1.4], [0, 3.4]]) { ell(c, x, y + yy, 0.5, 0.5); c.fill(); } },
  beads(c, col, g) { for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.0875); ell(c, Math.cos(a) * 6.5, g.hy + 3 + Math.sin(a) * 4, 0.9, 0.9); fs(c, i % 2 ? '#ffffff' : col); } },
  chain(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.6; for (let i = 0; i < 10; i++) { const a = Math.PI * (0.12 + i * 0.084); ell(c, Math.cos(a) * 6.5, g.hy + 3 + Math.sin(a) * 4, 0.9, 0.6, a); c.stroke(); } },
  locket(c, col, g) { STYLE.chain(c, col, g); const y = g.hy + 8.2; c.beginPath(); c.moveTo(0, y + 1.6); c.bezierCurveTo(2.6, y - 0.2, 1.2, -2 + y, 0, y - 0.6); c.bezierCurveTo(-1.2, -2 + y, -2.6, y - 0.2, 0, y + 1.6); fs(c, col); glint2(c, 0.8, y - 0.6, 0.9, g.t); },
  medal(c, col, g) { c.strokeStyle = '#e8434f'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-5, g.hy + 4.5); c.lineTo(0, g.hy + 7.4); c.lineTo(5, g.hy + 4.5); c.stroke(); ell(c, 0, g.hy + 8.8, 1.9, 1.9); fs(c, col); c.fillStyle = '#fff'; starP(c, 0, g.hy + 8.8, 1.1); c.fill(); },
  badge(c, col, g) { ell(c, 2.8, g.hy + 9.5, 2, 2); fs(c, col, '#ffcf3a'); c.fillStyle = '#fff'; starP(c, 2.8, g.hy + 9.5, 1.2); c.fill(); },
  pearls(c, col, g) { for (let i = 0; i < 9; i++) { const a = Math.PI * (0.15 + i * 0.0875); ell(c, Math.cos(a) * 6.5, g.hy + 3 + Math.sin(a) * 4, 0.9, 0.9); fs(c, col, '#c8b8a8'); } },
  bell(c, col, g) { c.beginPath(); c.roundRect(-6, g.hy + 5.5, 12, 1.8, 0.9); fs(c, '#e8434f'); ell(c, 0, g.hy + 8.4, 1.6, 1.6); fs(c, col); },
  // ---- face
  lens(c, col, g) { for (const x of [g.eyeL, g.eyeR]) { ell(c, x, g.ey, 2.7, 2.4); fs(c, '#1a1428', col); } c.strokeStyle = col; c.beginPath(); c.moveTo(g.eyeL + 2.6, g.ey); c.lineTo(g.eyeR - 2.6, g.ey); c.stroke(); },
  round(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.7; for (const x of [g.eyeL, g.eyeR]) { ell(c, x, g.ey, 2.6, 2.6); c.stroke(); } c.beginPath(); c.moveTo(g.eyeL + 2.6, g.ey); c.lineTo(g.eyeR - 2.6, g.ey); c.stroke(); },
  heart(c, col, g) { c.fillStyle = col; c.strokeStyle = shade(col, -0.4); c.lineWidth = 0.5; for (const x of [g.eyeL, g.eyeR]) { const r = 2.6, y = g.ey - 1; c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45); c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); c.fill(); c.stroke(); } },
  star(c, col, g) { c.fillStyle = '#2a1458'; c.strokeStyle = col; c.lineWidth = 0.7; for (const x of [g.eyeL, g.eyeR]) { starP(c, x, g.ey, 3); c.fill(); c.stroke(); } },
  monocle(c, col, g) { c.strokeStyle = col; c.lineWidth = 0.7; ell(c, g.eyeR, g.ey, 2.8, 2.8); c.stroke(); c.beginPath(); c.moveTo(g.eyeR + 2, g.ey + 2); c.quadraticCurveTo(g.eyeR + 4, g.ey + 6, g.eyeR + 2, g.ey + 9); c.stroke(); },
  goggles(c, col, g) { c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-9, g.ey); c.lineTo(9, g.ey); c.stroke(); c.fillStyle = 'rgba(160,230,255,.55)'; for (const x of [g.eyeL, g.eyeR]) { ell(c, x, g.ey, 2.7, 2.4); c.fill(); c.stroke(); } },
  // ---- head
  beanie(c, col, g) { const y = g.top + 1; c.beginPath(); c.moveTo(-7, y); c.quadraticCurveTo(-6.5, y - 8, 0, y - 8); c.quadraticCurveTo(6.5, y - 8, 7, y); c.closePath(); fs(c, col); c.beginPath(); c.roundRect(-7.4, y - 1.6, 14.8, 2.6, 1.2); fs(c, shade(col, -0.15)); ell(c, 0, y - 8.6, 1.8, 1.8); fs(c, '#fff', '#c8b8d8'); },
  cap(c, col, g) { const y = g.top + 1; c.beginPath(); c.moveTo(-6.5, y); c.quadraticCurveTo(-6, y - 6.5, 0, y - 6.5); c.quadraticCurveTo(6, y - 6.5, 6.5, y); c.closePath(); fs(c, col); ell(c, 6, y - 0.2, 5, 1.3); fs(c, shade(col, -0.2)); ell(c, 0, y - 6.5, 0.9, 0.9); fs(c, '#fff'); },
  bow(c, col, g) { const y = g.top; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(4, y); c.lineTo(4 + s * 5, y - 3.6); c.lineTo(4 + s * 5, y + 3.6); c.closePath(); fs(c, col); } ell(c, 4, y, 1.6, 1.6); fs(c, col); },
  tophat(c, col, g) { const y = g.top + 0.5; ell(c, 0, y, 7.5, 1.7); fs(c, col); c.beginPath(); c.roundRect(-4.2, y - 8, 8.4, 8.2, 1); fs(c, col); c.fillStyle = '#ff6fae'; c.fillRect(-4.2, y - 2.6, 8.4, 1.6); },
  flowers(c, col, g) { const cs = [col, '#fff6a8', '#c8e8ff', '#ffc6a8', col]; for (let i = 0; i < 5; i++) { const x = -6 + i * 3, y = g.top + 0.5 - Math.sin(i / 4 * Math.PI) * 1.4; for (let k = 0; k < 5; k++) { const a = k * TAU / 5; ell(c, x + Math.cos(a) * 1.1, y + Math.sin(a) * 1.1, 0.9, 0.9); c.fillStyle = cs[i]; c.fill(); } ell(c, x, y, 0.6, 0.6); c.fillStyle = '#ffb31a'; c.fill(); } },
  wizard(c, col, g) { const y = g.top + 1; ell(c, 0, y, 8, 1.8); fs(c, col); c.beginPath(); c.moveTo(-5, y); c.quadraticCurveTo(-1, y - 8, 3 + Math.sin(g.t * 0.05), y - 14); c.quadraticCurveTo(2, y - 6, 5, y); c.closePath(); fs(c, col); c.fillStyle = '#ffd34d'; starP(c, 0, y - 4, 1.4); c.fill(); starP(c, 2.5, y - 9, 0.9); c.fill(); },
  crown(c, col, g) { const y = g.top; c.beginPath(); c.moveTo(-4.5, y + 1); c.lineTo(-4.5, y - 4.5); c.lineTo(-2.2, y - 1.8); c.lineTo(0, y - 5.6); c.lineTo(2.2, y - 1.8); c.lineTo(4.5, y - 4.5); c.lineTo(4.5, y + 1); c.closePath(); fs(c, col); c.fillStyle = '#ff4f8f'; ell(c, 0, y - 0.6, 1, 1); c.fill(); c.fillStyle = '#4aa8ff'; ell(c, -2.8, y - 0.2, 0.7, 0.7); c.fill(); ell(c, 2.8, y - 0.2, 0.7, 0.7); c.fill(); },
  bunny(c, col, g) { const y = g.top + 0.5; c.strokeStyle = '#d0a0c0'; c.lineWidth = 1; c.beginPath(); c.arc(0, y + 5, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); for (const s of [-1, 1]) { ell(c, s * 3.2, y - 5, 1.8, 4.6, s * 0.2); fs(c, col, '#d0a0c0'); ell(c, s * 3.2, y - 5, 0.8, 3.2, s * 0.2); c.fillStyle = '#ffb3d9'; c.fill(); } },
  santa(c, col, g) { const y = g.top + 1; c.beginPath(); c.moveTo(-6.5, y); c.quadraticCurveTo(0, y - 10, 8, y - 6); c.lineTo(6.5, y); c.closePath(); fs(c, col); c.beginPath(); c.roundRect(-7, y - 1.6, 14, 2.6, 1.3); fs(c, '#fff', '#d0c8d8'); ell(c, 8.4, y - 6, 1.7, 1.7); fs(c, '#fff', '#d0c8d8'); },
  witch(c, col, g) { const y = g.top + 1; ell(c, 0, y, 9, 2); fs(c, col); c.beginPath(); c.moveTo(-4.5, y); c.lineTo(-1 + Math.sin(g.t * 0.04), y - 12); c.lineTo(4.5, y); c.closePath(); fs(c, col); c.fillStyle = '#ffb31a'; c.fillRect(-4, y - 2.2, 8, 1.4); },
  pumpkin(c, col, g) { const y = g.top - 1.5; for (const x of [-3, 0, 3]) { ell(c, x, y, 3, 3.4); fs(c, col); } c.fillStyle = '#4a8a3a'; c.fillRect(-0.5, y - 5.5, 1.2, 2.4); },
  halo(c, col, g) { c.strokeStyle = col; c.lineWidth = 1.4; c.shadowColor = col; c.shadowBlur = 4; ell(c, 0, g.top - 4 + Math.sin(g.t * 0.06) * 0.6, 6, 1.6); c.stroke(); }
};
// shop/closet thumbnails for any item (wearables are drawn on a plain blob outline)
export function drawItemIcon(c, it, cx, cy, s) {
  c.save(); c.translate(cx, cy); const k = s / 28; c.scale(k, k); c.lineWidth = 0.8; c.lineJoin = 'round';
  const g = { bodyG: 1, hy: -13.5, top: -20.5, ey: -14, eyeL: -3.6, eyeR: 3.6, fx: 0, t: 0, stage: 0 };
  if (it.kind === 'wear') {
    const off = { head: [0, 16], face: [0, 14], neck: [0, 6], body: [0, -6 + 12], feet: [0, 10], back: [0, 6] }[it.slot] || [0, 0];
    c.translate(off[0], off[1]); c.globalAlpha = 0.25; ell(c, 0, -5.5, 6.8, 5.2); c.fillStyle = '#c9b8ff'; c.fill(); ell(c, 0, g.hy, 9.2, 8.6); c.fill(); c.globalAlpha = 1;
    STYLE[it.st] && STYLE[it.st](c, it.col, g);
  } else DECOR[it.st] && DECOR[it.st](c, it.col, 0, 0, 1);
  c.restore();
}
// decor / toys / snacks, drawn centred at (x, y) on the floor line, scale k
export const DECOR = {
  rug(c, col, x, y, k) { ell(c, x, y + 2 * k, 12 * k, 3 * k); fs(c, col); ell(c, x, y + 2 * k, 8 * k, 1.8 * k); c.strokeStyle = '#fff'; c.stroke(); },
  plant(c, col, x, y, k) { c.beginPath(); c.moveTo(x - 4 * k, y - 6 * k); c.lineTo(x + 4 * k, y - 6 * k); c.lineTo(x + 3 * k, y + 2 * k); c.lineTo(x - 3 * k, y + 2 * k); c.closePath(); fs(c, '#d07a4a'); for (const a of [-0.6, 0, 0.6]) { ell(c, x + Math.sin(a) * 4 * k, y - 11 * k, 2.2 * k, 5 * k, a); fs(c, col); } },
  lamp(c, col, x, y, k) { c.fillStyle = '#8a7aa8'; c.fillRect(x - 0.6 * k, y - 12 * k, 1.2 * k, 12 * k); c.shadowColor = col; c.shadowBlur = 10; ell(c, x, y - 15 * k, 4.5 * k, 4.5 * k); fs(c, col); c.shadowBlur = 0; c.fillStyle = shade(col, -0.2); ell(c, x + 1.5 * k, y - 16 * k, 1 * k, 1 * k); c.fill(); },
  bed(c, col, x, y, k) { for (const [a, b, r] of [[-7, -3, 5], [0, -4, 6], [7, -3, 5]]) { ell(c, x + a * k, y + b * k, r * k, r * 0.7 * k); fs(c, col, '#b0a0d8'); } },
  castle(c, col, x, y, k) { c.beginPath(); c.rect(x - 8 * k, y - 10 * k, 16 * k, 12 * k); fs(c, col); for (const a of [-8, 4]) { c.beginPath(); c.rect(x + a * k, y - 15 * k, 4 * k, 5 * k); fs(c, col); } c.fillStyle = '#5a3a8a'; c.beginPath(); c.arc(x, y + 2 * k, 3 * k, Math.PI, 0); c.fill(); },
  rainbow(c, col, x, y, k) { ['#ff7a8a', '#ffb31a', '#ffe14d', '#6fd39a', '#5aa8ff', '#b26bff'].forEach((cc, i) => { c.strokeStyle = cc; c.lineWidth = 1.6 * k; c.beginPath(); c.arc(x, y + 2 * k, (14 - i * 1.6) * k, Math.PI, 0); c.stroke(); }); },
  pumpkins(c, col, x, y, k) { for (const [a, r] of [[-5, 3.6], [3, 4.6]]) { for (const d of [-1, 0, 1]) { ell(c, x + (a + d * r * 0.45) * k, y - r * k, r * 0.6 * k, r * k); fs(c, col); } } },
  tree(c, col, x, y, k) { for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x, y - (20 - i * 5) * k); c.lineTo(x + (6 + i * 2) * k, y - (9 - i * 4) * k); c.lineTo(x - (6 + i * 2) * k, y - (9 - i * 4) * k); c.closePath(); fs(c, col); } c.fillStyle = '#ffd34d'; starP(c, x, y - 20 * k, 2.4 * k); c.fill(); },
  ball(c, col, x, y, k) { ell(c, x, y - 4 * k, 4 * k, 4 * k); fs(c, col); c.strokeStyle = '#fff'; c.beginPath(); c.arc(x, y - 4 * k, 2.6 * k, 0.3, 2.2); c.stroke(); },
  yarn(c, col, x, y, k) { ell(c, x, y - 4 * k, 4 * k, 4 * k); fs(c, col); c.strokeStyle = shade(col, 0.4); for (const a of [-1.5, 0, 1.5]) { c.beginPath(); c.arc(x + a * k, y - 4 * k, 3 * k, 0.5, 2.6); c.stroke(); } },
  duck(c, col, x, y, k) { ell(c, x, y - 3 * k, 5 * k, 3 * k); fs(c, col); ell(c, x + 2.5 * k, y - 7 * k, 2.6 * k, 2.6 * k); fs(c, col); c.fillStyle = '#ff8a2a'; ell(c, x + 5 * k, y - 6.6 * k, 1.4 * k, 0.8 * k); c.fill(); },
  kite(c, col, x, y, k) { c.beginPath(); c.moveTo(x, y - 16 * k); c.lineTo(x + 5 * k, y - 9 * k); c.lineTo(x, y - 2 * k); c.lineTo(x - 5 * k, y - 9 * k); c.closePath(); fs(c, col); c.fillStyle = '#ffd34d'; starP(c, x, y - 9 * k, 1.8 * k); c.fill(); },
  mic(c, col, x, y, k) { c.beginPath(); c.roundRect(x - 3 * k, y - 14 * k, 6 * k, 9 * k, 3 * k); fs(c, col); c.strokeStyle = shade(col, -0.4); c.beginPath(); c.arc(x, y - 9 * k, 5 * k, 0.1, Math.PI - 0.1); c.stroke(); c.fillRect(x - 0.6 * k, y - 4 * k, 1.2 * k, 4 * k); c.fillStyle = '#ffd34d'; starP(c, x + 6 * k, y - 15 * k, 1.8 * k); c.fill(); },
  berry(c, col, x, y, k) { ell(c, x, y - 4 * k, 3.4 * k, 4 * k); fs(c, col); c.fillStyle = '#4a9a4a'; c.fillRect(x - 1.5 * k, y - 8.6 * k, 3 * k, 1.2 * k); },
  cookie(c, col, x, y, k) { starP(c, x, y - 4 * k, 5 * k, 3 * k); fs(c, col); c.fillStyle = '#7a4a2a'; ell(c, x - 1 * k, y - 4 * k, 0.6 * k, 0.6 * k); c.fill(); },
  cake(c, col, x, y, k) { c.beginPath(); c.roundRect(x - 5 * k, y - 7 * k, 10 * k, 7 * k, 1.5 * k); fs(c, col); c.fillStyle = '#fff'; c.fillRect(x - 5 * k, y - 7 * k, 10 * k, 1.6 * k); c.fillStyle = '#ff4f6f'; ell(c, x, y - 8.4 * k, 1.2 * k, 1.2 * k); c.fill(); },
  apple(c, col, x, y, k) { ell(c, x, y - 4.5 * k, 4.4 * k, 4.4 * k); c.shadowColor = col; c.shadowBlur = 6; fs(c, col); c.shadowBlur = 0; c.fillStyle = '#4a9a4a'; ell(c, x + 1.6 * k, y - 9.4 * k, 1.6 * k, 0.8 * k, -0.5); c.fill(); }
};
