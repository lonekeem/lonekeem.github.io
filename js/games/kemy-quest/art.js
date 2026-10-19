// Kemy's Bubble Quest - all art is drawn in code (original). Kemy, tiles, enemies, items.
export const PAL = {
  body1: '#fde6f7', body2: '#e9b6ef', line: '#7d4fc0', gill1: '#6c3fd1', gill2: '#b47cf0', stem: '#f28dca',
  eye: '#24133f', blush: '#ff9fc8', gold: '#ffd34d', gold2: '#ffb21f', glow: '#b26bff'
};
const TAU = Math.PI * 2;
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); }
// Kemy, origin at feet centre. s: {face, t, mode:'idle'|'run'|'jump'|'fall'|'swim'|'happy', sq, blink}
export function drawKemy(c, x, y, s) {
  const t = s.t || 0; const face = s.face || 1; const sq = s.sq || 1;
  c.save(); c.translate(x, y);
  let tilt = 0, bob = 0, gillLift = 0, legA = 0, tailW = Math.sin(t * 0.12) * 0.15;
  if (s.mode === 'idle') bob = Math.sin(t * 0.07) * 0.9;
  if (s.mode === 'run') { legA = Math.sin(t * 0.45); tilt = 0.08 * face; bob = Math.abs(Math.sin(t * 0.45)) * -1.2; tailW = Math.sin(t * 0.45) * 0.35; }
  if (s.mode === 'jump') { gillLift = -0.35; tilt = -0.05 * face; }
  if (s.mode === 'fall') { gillLift = 0.45; }
  if (s.mode === 'swim') { tilt = 0.18 * face; tailW = Math.sin(t * 0.25) * 0.5; gillLift = Math.sin(t * 0.25) * 0.25; bob = Math.sin(t * 0.1) * 1; }
  if (s.mode === 'happy') { tilt = Math.sin(t * 0.35) * 0.28; bob = -Math.abs(Math.sin(t * 0.17)) * 5; gillLift = Math.sin(t * 0.35) * 0.4; }
  c.translate(0, bob); c.rotate(tilt); c.scale(face * (2 - sq) ** 0.5, sq);
  c.lineWidth = 1; c.strokeStyle = PAL.line; c.lineJoin = 'round';
  // tail
  c.save(); c.translate(-5, -6); c.rotate(-0.3 + tailW);
  c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(-8, -6, -13, -2); c.quadraticCurveTo(-8, 2, 0, 3); c.closePath();
  const tg = c.createLinearGradient(-13, 0, 0, 0); tg.addColorStop(0, '#f6a6d6'); tg.addColorStop(1, PAL.body2); c.fillStyle = tg; c.fill(); c.stroke();
  c.restore();
  // legs
  c.fillStyle = PAL.body2;
  ell(c, -3 + legA * 1.5, -1.5, 2.2, 1.8); c.fill(); c.stroke();
  ell(c, 3.5 - legA * 1.5, -1.5, 2.2, 1.8); c.fill(); c.stroke();
  // body
  let g = c.createLinearGradient(0, -12, 0, 0); g.addColorStop(0, PAL.body1); g.addColorStop(1, PAL.body2);
  ell(c, 0, -5.5, 6.5, 5); c.fillStyle = g; c.fill(); c.stroke();
  ell(c, 0.5, -4.5, 3.6, 2.8); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
  // gills (3 frilly fronds each side)
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const a = (side < 0 ? Math.PI : 0) + side * (-0.75 + i * 0.6) + gillLift * side * (i - 1 + 1.4);
    const gx = side * 7.5, gy = -15 + i * 2.6;
    c.save(); c.translate(gx, gy); c.rotate(a);
    const gg = c.createLinearGradient(0, 0, 7, 0); gg.addColorStop(0, PAL.gill2); gg.addColorStop(1, PAL.gill1);
    c.beginPath(); c.moveTo(0, 0);
    c.bezierCurveTo(2, -3.4, 5, -3.2, 7.6, -1.6); c.quadraticCurveTo(6.2, 0, 7.6, 1.4); c.bezierCurveTo(5, 3, 2, 3, 0, 0);
    c.fillStyle = gg; c.fill(); c.stroke();
    c.strokeStyle = PAL.stem; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0.5, 0); c.lineTo(6.3, 0); c.stroke();
    c.lineWidth = 1; c.strokeStyle = PAL.line; c.restore();
  }
  // head
  g = c.createRadialGradient(-2, -17, 2, 0, -13, 11); g.addColorStop(0, '#fff3fc'); g.addColorStop(0.6, PAL.body1); g.addColorStop(1, PAL.body2);
  ell(c, 0, -13.5, 9.2, 7.6); c.fillStyle = g; c.fill(); c.stroke();
  // face (shifted toward facing side)
  const fx = 1.4;
  c.fillStyle = PAL.blush; c.globalAlpha = 0.75; ell(c, fx - 6, -11, 1.9, 1.1); c.fill(); ell(c, fx + 6, -11, 1.9, 1.1); c.fill(); c.globalAlpha = 1;
  if (s.blink || (s.mode === 'idle' && (t % 220) < 7)) {
    c.strokeStyle = PAL.eye; c.lineWidth = 1.1; c.beginPath(); c.moveTo(fx - 5, -13.4); c.quadraticCurveTo(fx - 3.5, -12.4, fx - 2, -13.4); c.moveTo(fx + 2, -13.4); c.quadraticCurveTo(fx + 3.5, -12.4, fx + 5, -13.4); c.stroke();
  } else {
    c.fillStyle = PAL.eye; ell(c, fx - 3.6, -13.6, 2, 2.3); c.fill(); ell(c, fx + 3.6, -13.6, 2, 2.3); c.fill();
    c.fillStyle = '#fff'; ell(c, fx - 3, -14.5, 0.75, 0.75); c.fill(); ell(c, fx + 4.2, -14.5, 0.75, 0.75); c.fill();
    c.globalAlpha = 0.7; ell(c, fx - 4.1, -12.7, 0.35, 0.35); c.fill(); ell(c, fx + 3.1, -12.7, 0.35, 0.35); c.fill(); c.globalAlpha = 1;
  }
  // smile (a soft "w")
  c.strokeStyle = PAL.eye; c.lineWidth = 0.8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(fx - 1.8, -10.6); c.quadraticCurveTo(fx - 0.9, -9.4, fx, -10.4); c.quadraticCurveTo(fx + 0.9, -9.4, fx + 1.8, -10.6); c.stroke();
  c.restore();
}
export function starPath(c, x, y, r, ri = r * 0.48, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5; const rr = i % 2 ? ri : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
// glowing gold star with purple glow (pre-rendered sprites, scale k for crispness)
const sprites = {};
function sprite(key, size, k, draw) {
  const id = key + k; if (sprites[id]) return sprites[id];
  const cv = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(size * k, size * k) : Object.assign(document.createElement('canvas'), { width: size * k, height: size * k });
  const c = cv.getContext('2d'); c.scale(k, k); draw(c, size / 2); sprites[id] = cv; return cv;
}
export function drawStar(c, x, y, r, k, t = 0, big = false) {
  const size = Math.ceil(r * 4); const kk = Math.min(4, Math.ceil(k));
  const img = sprite((big ? 'B' : 's') + r, size, kk, (g, m) => {
    const rg = g.createRadialGradient(m, m, 0, m, m, r * 2); rg.addColorStop(0, 'rgba(178,107,255,.75)'); rg.addColorStop(1, 'rgba(178,107,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, size, size);
    starPath(g, m, m, r); const sg = g.createLinearGradient(0, m - r, 0, m + r); sg.addColorStop(0, '#fff2a8'); sg.addColorStop(0.5, PAL.gold); sg.addColorStop(1, PAL.gold2);
    g.fillStyle = sg; g.fill(); g.lineWidth = Math.max(0.8, r * 0.14); g.strokeStyle = big ? '#7a3fd0' : '#c77d12'; g.stroke();
    starPath(g, m - r * 0.15, m - r * 0.2, r * 0.35); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
  });
  const sc = 1 + Math.sin(t * 0.08 + x * 0.1) * (big ? 0.08 : 0.05);
  c.save(); c.translate(x, y); c.scale(Math.cos(t * 0.04 + x) * 0.25 + 0.85, 1); c.scale(sc, sc); c.drawImage(img, -size / 2, -size / 2, size, size); c.restore();
}
export function drawHeart(c, x, y, r, fill = '#ff6fae', stroke = '#7d2a6a') {
  c.beginPath(); c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  c.fillStyle = fill; c.fill(); c.lineWidth = 1; c.strokeStyle = stroke; c.stroke();
}
export function drawBubble(c, x, y, r, t = 0) {
  ell(c, x, y, r, r * (1 + Math.sin(t * 0.2) * 0.04));
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.15)'); g.addColorStop(0.75, 'rgba(190,160,255,.25)'); g.addColorStop(1, 'rgba(240,170,255,.75)');
  c.fillStyle = g; c.fill(); c.lineWidth = 0.8; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
  ell(c, x - r * 0.38, y - r * 0.4, r * 0.25, r * 0.14, -0.6); c.fillStyle = 'rgba(255,255,255,.9)'; c.fill();
}
// enemies: e = sim enemy, hc = high-contrast hazard mode
export function drawEnemy(c, e, t, hc) {
  const x = e.x + e.w / 2, y = e.y + e.h; const d = e.dir || -1;
  c.save(); c.translate(x, y);
  if (e.squish) c.scale(1.3, 0.35);
  c.lineWidth = 1; c.lineJoin = 'round';
  const grumpy = (ex, ey, s = 1) => { // angry brows + eyes
    c.fillStyle = '#fff'; ell(c, ex - 2.3 * s, ey, 1.8 * s, 2 * s); c.fill(); ell(c, ex + 2.3 * s, ey, 1.8 * s, 2 * s); c.fill();
    c.fillStyle = '#1b0f2e'; ell(c, ex - 2 * s + d * 0.4, ey + 0.4, 0.9 * s, 1.1 * s); c.fill(); ell(c, ex + 2.6 * s + d * 0.4, ey + 0.4, 0.9 * s, 1.1 * s); c.fill();
    c.strokeStyle = '#1b0f2e'; c.lineWidth = 1; c.beginPath(); c.moveTo(ex - 4 * s, ey - 2.6 * s); c.lineTo(ex - 0.8 * s, ey - 1.6 * s); c.moveTo(ex + 4 * s, ey - 2.6 * s); c.lineTo(ex + 0.8 * s, ey - 1.6 * s); c.stroke();
  };
  const spikeCol = hc ? '#ffffff' : '#ff9a1f', spikeLine = hc ? '#000000' : '#3b1606';
  if (e.t === 'snail') {
    c.scale(-d, 1);
    c.fillStyle = '#9fe0c8'; c.strokeStyle = '#2d6b5f';
    c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(-9, -6, -5, -7); c.lineTo(8, -2); c.quadraticCurveTo(9, 0, 7, 0); c.closePath(); c.fill(); c.stroke();
    ell(c, 1.5, -6, 5.5, 5.5); const sg = c.createRadialGradient(0, -7, 1, 1.5, -6, 6); sg.addColorStop(0, '#ffd2ef'); sg.addColorStop(1, '#a35bd6'); c.fillStyle = sg; c.fill(); c.strokeStyle = '#5b2a8c'; c.stroke();
    c.beginPath(); for (let a = 0; a < 10; a += 0.3) c.lineTo(1.5 + Math.cos(a) * a * 0.45, -6 + Math.sin(a) * a * 0.45); c.stroke();
    c.scale(-1, 1); grumpy(6, -6, 0.8);
  } else if (e.t === 'urchin') {
    const n = 12; const pulse = Math.sin(t * 0.1 + e.x) * 0.8;
    c.beginPath(); for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n; const r = i % 2 ? 5.5 : 9 + pulse; c.lineTo(Math.cos(a) * r, -7 + Math.sin(a) * r); } c.closePath();
    c.fillStyle = spikeCol; c.fill(); c.strokeStyle = spikeLine; c.lineWidth = hc ? 1.4 : 1; c.stroke();
    ell(c, 0, -7, 5.6, 5.6); c.fillStyle = hc ? '#000' : '#2a1a5e'; c.fill(); grumpy(0, -7.5, 0.75);
  } else if (e.t === 'frog') {
    const air = !e.ground; c.scale(d, 1);
    c.fillStyle = '#6fd0a0'; c.strokeStyle = '#1f5a46';
    ell(c, -4, -1.5, 3, 2); c.fill(); c.stroke(); ell(c, 4, -1.5, 3, 2); c.fill(); c.stroke();
    ell(c, 0, air ? -7 : -5.5, 7, air ? 6 : 5); c.fill(); c.stroke();
    ell(c, -3, air ? -12 : -10, 2.6, 2.6); c.fill(); c.stroke(); ell(c, 3, air ? -12 : -10, 2.6, 2.6); c.fill(); c.stroke();
    c.fillStyle = '#1b0f2e'; ell(c, -2.6, air ? -12 : -10, 1, 1.2); c.fill(); ell(c, 3.4, air ? -12 : -10, 1, 1.2); c.fill();
    c.strokeStyle = '#1b0f2e'; c.beginPath(); c.moveTo(-5, air ? -14.5 : -12.5); c.lineTo(-1.5, air ? -13.5 : -11.5); c.moveTo(5, air ? -14.5 : -12.5); c.lineTo(1.5, air ? -13.5 : -11.5); c.stroke();
    c.beginPath(); c.moveTo(-3, air ? -5 : -4); c.quadraticCurveTo(0, air ? -6.5 : -5.4, 3, air ? -5 : -4); c.stroke();
  } else if (e.t === 'puffer') {
    c.translate(0, -7); c.scale(-d, 1); const r = e.puff ? 9 : 6.5;
    if (e.puff) { c.beginPath(); for (let i = 0; i < 28; i++) { const a = i * Math.PI / 14; const rr = i % 2 ? r : r + 3.5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fillStyle = spikeCol; c.fill(); c.strokeStyle = spikeLine; c.stroke(); }
    c.fillStyle = '#ffe07a'; c.strokeStyle = '#8a5a12'; c.beginPath(); c.moveTo(r - 1, 0); c.lineTo(r + 5, -3.5); c.lineTo(r + 5, 3.5); c.closePath(); c.fill(); c.stroke();
    ell(c, 0, 0, r, r * 0.9); const pg = c.createLinearGradient(0, -r, 0, r); pg.addColorStop(0, '#ffe58a'); pg.addColorStop(1, '#ffc0d8'); c.fillStyle = pg; c.fill(); c.stroke();
    c.scale(-1, 1); grumpy(-2, -1.5, 0.7); c.strokeStyle = '#1b0f2e'; ell(c, -4.5, 2.5, 1, 1.4); c.stroke();
  }
  c.restore();
}
// level objects
export function drawCheck(c, x, y, on, t) {
  // a scallop shell that opens and glows when reached
  c.save(); c.translate(x + 8, y + 16); c.lineWidth = 1; c.strokeStyle = '#6b3a8f';
  if (on) { const g = c.createRadialGradient(0, -8, 1, 0, -8, 16); g.addColorStop(0, 'rgba(255,190,240,.8)'); g.addColorStop(1, 'rgba(255,190,240,0)'); c.fillStyle = g; c.fillRect(-16, -24, 32, 28); }
  c.fillStyle = on ? '#ffc4ea' : '#c9b8e6';
  c.beginPath(); c.moveTo(-7, 0); c.quadraticCurveTo(-9, -9, 0, -11); c.quadraticCurveTo(9, -9, 7, 0); c.closePath(); c.fill(); c.stroke();
  for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 1.2, -1); c.lineTo(i * 3.2, -9.5); c.stroke(); }
  if (on) { c.fillStyle = '#fff6ff'; ell(c, 0, -13 - Math.sin(t * 0.08) * 1.5, 2.6, 2.6); c.fill(); c.stroke(); }
  c.restore();
}
export function drawGoal(c, x, y, t, rm) {
  c.save(); c.translate(x + 8, y + 16);
  const pulse = rm ? 0 : Math.sin(t * 0.06) * 2;
  const g = c.createRadialGradient(0, -20, 2, 0, -20, 26 + pulse); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(0.4, 'rgba(190,120,255,.55)'); g.addColorStop(1, 'rgba(160,90,255,0)');
  c.fillStyle = g; c.fillRect(-30, -50, 60, 50);
  c.lineWidth = 2.2; for (let i = 0; i < 3; i++) { c.strokeStyle = ['#ffd34d', '#c79bff', '#ff9fd6'][i]; ell(c, 0, -20, 10 - i * 2.6 + pulse * 0.3, 14 - i * 3.5 + pulse * 0.3, rm ? 0 : t * 0.02 * (i % 2 ? -1 : 1)); c.stroke(); }
  c.lineWidth = 1; c.fillStyle = '#72d39a'; c.strokeStyle = '#2b6b4c';
  c.beginPath(); c.ellipse(0, -1, 13, 4, 0, 0.25, TAU - 0.25); c.lineTo(0, -1); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffb3de'; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + 0.3; ell(c, Math.cos(a) * 2.6, -4 + Math.sin(a) * 1.2, 2.2, 1.2, a); c.fill(); }
  c.fillStyle = '#ffe680'; ell(c, 0, -4.4, 1.3, 1); c.fill();
  c.restore();
}
export function drawPower(c, x, y, t) {
  drawBubble(c, x + 8, y + 8 + Math.sin(t * 0.08) * 1.5, 7, t);
  c.fillStyle = '#c99bff'; starPath(c, x + 8, y + 8 + Math.sin(t * 0.08) * 1.5, 3.2); c.fill();
}
export const THEMES = {
  pond: { sky: ['#ffd9f1', '#c9a8ff', '#8e6ae6'], dirt: '#6a4a96', dirt2: '#5a3d84', top: '#86e0a6', top2: '#55bd83', block: '#a48ad8', blockT: '#cdb8ff', plat: '#7fdc9d', platS: '#2f7c55', far: '#b897f2', near: '#8c6fd6', water: 'rgba(110,150,255,.38)', waterTop: 'rgba(220,240,255,.85)' },
  cave: { sky: ['#2a1650', '#1d1040', '#120a2c'], dirt: '#3a2a6b', dirt2: '#2e2158', top: '#a07bff', top2: '#7b57e6', block: '#6b48d6', blockT: '#b79bff', plat: '#c2a8ff', platS: '#5a3fb0', far: '#2e1d5c', near: '#3d2775', water: 'rgba(90,120,255,.38)', waterTop: 'rgba(190,210,255,.8)' },
  reef: { sky: ['#ff9fd2', '#8b5cf0', '#3a1d8c'], dirt: '#e59ac0', dirt2: '#cf7fac', top: '#ffd0e4', top2: '#ff8fbe', block: '#c25aa0', blockT: '#ff9fd0', plat: '#ff9fc8', platS: '#9a3e78', far: '#6b3fc7', near: '#a24fbf', water: 'rgba(60,90,230,.42)', waterTop: 'rgba(170,240,255,.85)' }
};
