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
  } else if (e.t === 'bee') {
    c.scale(d, 1); c.translate(0, -6); const flap = Math.sin(t * 0.9 + e.x) * 0.5;
    c.fillStyle = 'rgba(230,245,255,.85)'; c.strokeStyle = '#7aa0c8'; ell(c, -2, -6, 3.2, 5 + flap, -0.5); c.fill(); c.stroke(); ell(c, 2.5, -6.5, 3, 4.6 - flap, 0.4); c.fill(); c.stroke();
    ell(c, 0, 0, 7, 5.6); const bg = c.createLinearGradient(-7, 0, 7, 0); bg.addColorStop(0, '#ffd34d'); bg.addColorStop(1, '#ffb21f'); c.fillStyle = bg; c.fill(); c.strokeStyle = '#6b3d0a'; c.stroke();
    c.fillStyle = '#3b2412'; c.fillRect(-3.5, -5, 2, 10); c.fillRect(0.5, -5.4, 2, 10.8);
    c.beginPath(); c.moveTo(-7, 0.5); c.lineTo(-10, 1); c.lineTo(-7, 2); c.fill();
    c.scale(1 / d, 1); grumpy(d * 4, -1, 0.6);
  } else if (e.t === 'pengu') {
    c.scale(-d, 1); const slide = Math.sin(t * 0.3) * 0.3;
    c.fillStyle = '#2d3b6e'; c.strokeStyle = '#141c3d'; ell(c, 0, -6.5, 6.5, 6.5); c.fill(); c.stroke();
    c.fillStyle = '#f4f8ff'; ell(c, -1.5, -5.5, 4.4, 5); c.fill();
    c.fillStyle = '#2d3b6e'; ell(c, 4.5, -5 + slide, 2, 4, 0.6); c.fill();
    c.fillStyle = '#ffb21f'; c.beginPath(); c.moveTo(-6, -8); c.lineTo(-9.5, -7); c.lineTo(-6, -6); c.fill(); ell(c, -2, -0.5, 2.4, 1); c.fill(); ell(c, 3, -0.5, 2.4, 1); c.fill();
    c.fillStyle = '#ff6fae'; ell(c, 0, -12.4, 4.5, 1.4); c.fill(); c.fillStyle = '#fff'; ell(c, 0, -14, 1.5, 1.5); c.fill();
    c.scale(-1, 1); grumpy(1.5, -9, 0.6);
  } else if (e.t === 'wisp') {
    const f = Math.sin(t * 0.2 + e.x) * 1.2; c.translate(0, -6);
    if (!hc) { const gl = c.createRadialGradient(0, 0, 1, 0, 0, 14); gl.addColorStop(0, 'rgba(140,220,255,.55)'); gl.addColorStop(1, 'rgba(140,220,255,0)'); c.fillStyle = gl; c.fillRect(-14, -14, 28, 28); }
    c.beginPath(); c.moveTo(0, -11 - f); c.quadraticCurveTo(6, -4, 6, 1); c.quadraticCurveTo(6, 6, 0, 6); c.quadraticCurveTo(-6, 6, -6, 1); c.quadraticCurveTo(-6, -4, 0, -11 - f); c.closePath();
    c.fillStyle = hc ? '#ffffff' : '#9fe6ff'; c.fill(); c.strokeStyle = hc ? '#000' : '#3a6fb0'; c.lineWidth = hc ? 1.4 : 1; c.stroke();
    ell(c, 0, 2, 3.4, 3); c.fillStyle = hc ? '#ffe600' : '#e8f9ff'; c.fill();
    c.fillStyle = '#1b0f2e'; ell(c, -1.8 + d * 0.5, 0.5, 0.9, 1.3); c.fill(); ell(c, 1.8 + d * 0.5, 0.5, 0.9, 1.3); c.fill();
    c.strokeStyle = '#1b0f2e'; c.beginPath(); c.arc(d * 0.5, 3, 1.2, 0.2, Math.PI - 0.2); c.stroke();
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
// ------------------------------------------------------------------ expansion art: hazards, shots, switches, bosses
export function drawSwitch(c, x, y, sw, pressed) {
  c.save(); c.translate(x + 8, y + 16); c.lineWidth = 1;
  c.fillStyle = '#3b2f6e'; c.strokeStyle = '#18103a'; c.beginPath(); c.roundRect(-7, -3, 14, 3, 1.5); c.fill(); c.stroke();
  const h = pressed ? 2 : 4.5; c.fillStyle = sw ? '#6fc8ff' : '#ff7fc8'; c.strokeStyle = sw ? '#1d5a8f' : '#8f2a63';
  c.beginPath(); c.ellipse(0, -3, 5.5, h, 0, Math.PI, 0); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; starPath(c, 0, -3 - h * 0.45, 1.8); c.fill(); c.restore();
}
export function drawGeyser(c, g, f, hh, hc, rm) {
  const x = g.x, y = g.y + 16; const cyc = (f + g.ph) % g.per; const warn = cyc >= g.per - 40;
  c.save(); c.fillStyle = '#4a2a2a'; c.strokeStyle = '#1e0c0c'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 1, y); c.lineTo(x + 4, y - 4); c.lineTo(x + 12, y - 4); c.lineTo(x + 15, y); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = warn || hh ? '#ff9a3a' : '#2a1010'; c.fillRect(x + 5, y - 5, 6, 2);
  if (warn && !hh) { for (let i = 0; i < 3; i++) { const by = y - 7 - ((rm ? i * 4 : (f * 0.4 + i * 4) % 10)); c.globalAlpha = 0.8; c.fillStyle = hc ? '#ffe600' : '#ffd0a8'; ell(c, x + 6 + i * 2, by, 1.5, 1.5); c.fill(); } c.globalAlpha = 1; }
  if (hh > 0) {
    const top = y - hh; const wob = rm ? 0 : Math.sin(f * 0.5) * 1.2;
    const g2 = c.createLinearGradient(0, top, 0, y); g2.addColorStop(0, hc ? '#ffffff' : 'rgba(255,240,250,.95)'); g2.addColorStop(1, hc ? '#ffe600' : 'rgba(255,170,120,.9)');
    c.fillStyle = g2; c.beginPath(); c.moveTo(x + 4, y - 4); c.quadraticCurveTo(x + 2 + wob, (top + y) / 2, x + 3, top + 4); c.arc(x + 8, top + 4, 5 + wob * 0.5, Math.PI, 0); c.quadraticCurveTo(x + 14 - wob, (top + y) / 2, x + 12, y - 4); c.closePath(); c.fill();
    if (hc) { c.strokeStyle = '#000'; c.lineWidth = 1.4; c.stroke(); }
  }
  c.restore();
}
export function drawIcicle(c, h, f, hc) {
  if (h.gone) return; const sh = h.st === 1 ? Math.sin(f * 1.7) * 0.8 : 0;
  c.save(); c.translate(h.x + 8 + sh, h.y); c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.lineTo(0.5, 15); c.lineTo(-0.5, 15); c.closePath();
  const g = c.createLinearGradient(-5, 0, 5, 0); g.addColorStop(0, hc ? '#ffffff' : '#e8fbff'); g.addColorStop(1, hc ? '#ffe600' : '#8fd3ff'); c.fillStyle = g; c.fill();
  c.strokeStyle = hc ? '#000' : '#3a7ab8'; c.lineWidth = hc ? 1.4 : 0.8; c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(-2.5, 1, 1.2, 7); c.restore();
}
export function drawPopper(c, h, f) {
  const cyc = (f + h.ph) % h.per; const k = cyc < 8 ? 1.15 - cyc * 0.02 : 1;
  c.save(); c.translate(h.x + 8, h.y + 16); c.lineWidth = 1; c.strokeStyle = '#6b2450';
  c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(-7, -6, 14, 6, 2); c.fill(); c.stroke();
  c.save(); c.rotate(h.dir * 0.35); c.scale(1, k);
  c.fillStyle = '#ff7fbf'; c.beginPath(); c.roundRect(-5, -16, 10, 12, 3); c.fill(); c.stroke();
  c.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) c.fillRect(-5, -14 + i * 4, 10, 1.5);
  c.fillStyle = '#5a1a40'; ell(c, 0, -16, 4, 1.6); c.fill(); c.restore(); c.restore();
}
const GUM = ['#ff6fae', '#7fdcff', '#ffd34d', '#9dff8a', '#c99bff'];
export function drawShot(c, s, f, hc) {
  const x = s.x + s.w / 2, y = s.y + s.h / 2; c.save(); c.lineWidth = 1;
  if (s.k === 'wave') { c.strokeStyle = hc ? '#ffe600' : '#9dffcf'; c.fillStyle = hc ? 'rgba(0,0,0,.6)' : 'rgba(120,230,170,.5)'; c.beginPath(); c.ellipse(x, y + 2, 6, 4, 0, Math.PI, 0); c.fill(); c.lineWidth = 1.6; c.stroke(); }
  else if (s.k === 'shard' || s.k === 'star') {
    if (s.k === 'star') { c.translate(x, y); c.rotate(f * 0.2); starPath(c, 0, 0, 5, 2.2); c.fillStyle = hc ? '#ffffff' : '#e3c8ff'; c.fill(); c.strokeStyle = hc ? '#000' : '#6a3fd0'; c.stroke(); }
    else { c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x - 4, y - 2); c.lineTo(x, y - 6); c.lineTo(x + 4, y - 2); c.closePath(); c.fillStyle = hc ? '#ffffff' : '#c7a8ff'; c.fill(); c.strokeStyle = hc ? '#000' : '#5a3fb0'; c.stroke(); }
  } else if (s.k === 'spark' || s.k === 'ember') {
    const col = s.k === 'spark' ? ['rgba(140,240,255,', '#e8ffff'] : ['rgba(255,150,60,', '#fff1b0'];
    if (!hc) { const g = c.createRadialGradient(x, y, 0, x, y, 7); g.addColorStop(0, col[0] + '.9)'); g.addColorStop(1, col[0] + '0)'); c.fillStyle = g; c.fillRect(x - 7, y - 7, 14, 14); }
    ell(c, x, y, 2.6, 2.6); c.fillStyle = hc ? '#ffe600' : col[1]; c.fill(); if (hc) { c.strokeStyle = '#000'; c.stroke(); }
  } else if (s.k === 'pollen') { ell(c, x, y, 3.5, 3.5); c.fillStyle = hc ? '#ffe600' : '#fff07a'; c.fill(); c.strokeStyle = hc ? '#000' : '#c79a1a'; c.stroke(); c.fillStyle = '#c79a1a'; ell(c, x - 1, y - 1, 0.7, 0.7); c.fill(); ell(c, x + 1.2, y + 0.8, 0.7, 0.7); c.fill(); }
  else if (s.k === 'rain') { c.beginPath(); c.moveTo(x, y - 4); c.quadraticCurveTo(x + 3, y + 1, x, y + 3); c.quadraticCurveTo(x - 3, y + 1, x, y - 4); c.fillStyle = hc ? '#ffffff' : '#7fc8ff'; c.fill(); c.strokeStyle = hc ? '#000' : '#2a6fb0'; c.stroke(); }
  else if (s.k === 'snow') { ell(c, x, y, 4.5, 4.5); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = hc ? '#000' : '#7aa0d8'; c.lineWidth = hc ? 1.4 : 1; c.stroke(); }
  else if (s.k === 'gum') { ell(c, x, y, 4.5, 4.5); c.fillStyle = GUM[((s.x0 ?? (s.x0 = Math.floor(s.x))) >> 3) % GUM.length]; c.fill(); c.strokeStyle = '#5a1a40'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; ell(c, x - 1.5, y - 1.5, 1.3, 1); c.fill(); }
  c.restore();
}
function dizzyStars(c, t, y, r = 9) { for (let i = 0; i < 3; i++) { const a = t * 0.12 + i * 2.1; c.fillStyle = '#ffd34d'; starPath(c, Math.cos(a) * r, y + Math.sin(a) * 2.5, 2.3); c.fill(); } }
function bossEyes(c, x, y, s, d, mood) {
  c.fillStyle = '#fff'; ell(c, x - 3.4 * s, y, 2.6 * s, 2.9 * s); c.fill(); ell(c, x + 3.4 * s, y, 2.6 * s, 2.9 * s); c.fill();
  if (mood === 'dizzy') { c.strokeStyle = '#1b0f2e'; c.lineWidth = 1; for (const ex of [-3.4, 3.4]) { c.beginPath(); c.arc(x + ex * s, y, 1.4 * s, 0, 5); c.stroke(); } return; }
  if (mood === 'sleepy') { c.strokeStyle = '#1b0f2e'; c.lineWidth = 1.2; for (const ex of [-3.4, 3.4]) { c.beginPath(); c.moveTo(x + (ex - 2) * s, y); c.lineTo(x + (ex + 2) * s, y); c.stroke(); } return; }
  c.fillStyle = '#1b0f2e'; ell(c, x - 3 * s + d * 0.8, y + 0.5, 1.3 * s, 1.6 * s); c.fill(); ell(c, x + 3.8 * s + d * 0.8, y + 0.5, 1.3 * s, 1.6 * s); c.fill();
  c.strokeStyle = '#1b0f2e'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x - 6 * s, y - 3.6 * s); c.lineTo(x - 1.2 * s, y - 2.4 * s); c.moveTo(x + 6 * s, y - 3.6 * s); c.lineTo(x + 1.2 * s, y - 2.4 * s); c.stroke();
}
// Bosses: all original designs, drawn around their hitbox (b.x,b.y,b.w,b.h)
export function drawBoss(c, b, t, hc) {
  if (b.hp <= 0) { if (b.dead > 60) return; const k = b.dead / 60; c.save(); c.globalAlpha = 1 - k; c.translate(b.x + b.w / 2, b.y + b.h / 2);
    for (let i = 0; i < 10; i++) { const a = i * 0.628; c.fillStyle = i % 2 ? '#ffd34d' : '#ffb3de'; starPath(c, Math.cos(a) * k * 30, Math.sin(a) * k * 30, 3); c.fill(); } c.restore(); return; }
  if (b.inv > 0 && Math.floor(b.inv / 4) % 2) return;
  const x = b.x + b.w / 2, y = b.y + b.h; const d = b.dir || -1; const mood = b.ph === 'dizzy' || b.ph === 'stuck' ? 'dizzy' : b.ph === 'rest' || b.ph === 'sag' ? 'sleepy' : 'grr';
  c.save(); c.translate(x, y); c.globalAlpha = b.alpha ?? 1; c.lineWidth = 1.2; c.lineJoin = 'round';
  if (b.k === 'bullfrog') { // chunky lilac-green frog with a leafy crown and a bramble cape
    const air = b.ph === 'air'; c.scale(d, 1);
    c.fillStyle = '#6a8f3a'; c.strokeStyle = '#2b4416'; c.beginPath(); c.moveTo(-12, -6); c.quadraticCurveTo(-18, -14, -9, -20); c.lineTo(-4, -12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#8fdc8a'; c.strokeStyle = '#2b6b3c'; ell(c, -9, -2, 6, 3); c.fill(); c.stroke(); ell(c, 9, -2, 6, 3); c.fill(); c.stroke();
    ell(c, 0, air ? -13 : -11, 14, air ? 11 : 10); c.fill(); c.stroke(); c.fillStyle = '#e8ffd8'; ell(c, 2, air ? -9 : -7, 8, 5); c.fill();
    c.fillStyle = '#8fdc8a'; ell(c, -6, -21, 4.5, 4.5); c.fill(); c.stroke(); ell(c, 6, -21, 4.5, 4.5); c.fill(); c.stroke();
    c.scale(d, 1); bossEyes(c, 0, -21, 0.95, d, mood); c.scale(d, 1);
    c.fillStyle = '#ff9fc8'; ell(c, -9, -14, 2.2, 1.2); c.fill(); ell(c, 9, -14, 2.2, 1.2); c.fill();
    c.strokeStyle = '#2b4416'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-5, -12); c.quadraticCurveTo(0, -9.5, 5, -12); c.stroke();
    c.fillStyle = '#ffd34d'; c.strokeStyle = '#8a5a12'; c.beginPath(); c.moveTo(-6, -26); c.lineTo(-4, -31); c.lineTo(-1, -27); c.lineTo(1, -32); c.lineTo(3, -27); c.lineTo(6, -31); c.lineTo(6, -25.5); c.closePath(); c.fill(); c.stroke();
  } else if (b.k === 'geode') { // armadillo with amethyst plates; curls into a spiky crystal ball
    const ball = b.ph === 'curl' || b.ph === 'roll';
    if (ball) { c.rotate(b.ph === 'roll' ? b.x * 0.09 : Math.sin(t * 0.8) * 0.1); c.translate(0, 0);
      c.beginPath(); for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10; const r = i % 2 ? 9 : 14; c.lineTo(Math.cos(a) * r, -11 + Math.sin(a) * r); } c.closePath();
      c.fillStyle = hc ? '#ffffff' : '#c79bff'; c.fill(); c.strokeStyle = hc ? '#000' : '#4a2a8f'; c.stroke(); ell(c, 0, -11, 8, 8); c.fillStyle = '#7a4fd0'; c.fill(); c.stroke();
    } else { c.scale(d, 1);
      c.fillStyle = '#b89870'; c.strokeStyle = '#5a4020'; ell(c, -7, -2, 3, 2); c.fill(); c.stroke(); ell(c, 6, -2, 3, 2); c.fill(); c.stroke();
      ell(c, -1, -10, 13, 9.5); c.fillStyle = '#9a6fe0'; c.fill(); c.strokeStyle = '#4a2a8f'; c.stroke();
      for (let i = 0; i < 4; i++) { c.fillStyle = ['#d8c0ff', '#b18cff', '#e8d8ff', '#a07bff'][i]; c.beginPath(); c.moveTo(-10 + i * 5, -14); c.lineTo(-8 + i * 5, -22 - (i % 2) * 3); c.lineTo(-6 + i * 5, -14); c.fill(); c.stroke(); }
      c.fillStyle = '#d8b890'; c.strokeStyle = '#5a4020'; ell(c, 10, -7, 6, 5); c.fill(); c.stroke(); ell(c, 15, -8, 2, 1.6); c.fillStyle = '#ff9fc8'; c.fill();
      c.scale(d, 1); bossEyes(c, d * 10, -9, 0.6, d, mood);
    }
    if (b.ph === 'dizzy') dizzyStars(c, t, -26);
  } else if (b.k === 'jelly') { // glowing jellyfish queen with a pearl tiara
    if (!hc) { const g = c.createRadialGradient(0, -16, 2, 0, -16, 26); g.addColorStop(0, 'rgba(255,170,240,.5)'); g.addColorStop(1, 'rgba(255,170,240,0)'); c.fillStyle = g; c.fillRect(-28, -42, 56, 52); }
    c.strokeStyle = hc ? '#ffe600' : '#ff8fd0'; c.lineWidth = 1.6; for (let i = 0; i < 5; i++) { const tx = -9 + i * 4.5; c.beginPath(); c.moveTo(tx, -10); c.quadraticCurveTo(tx + Math.sin(t * 0.1 + i) * 4, -4, tx + Math.sin(t * 0.1 + i + 1) * 3, 2); c.stroke(); }
    c.lineWidth = 1.2; c.beginPath(); c.moveTo(-13, -10); c.quadraticCurveTo(-14, -26, 0, -26); c.quadraticCurveTo(14, -26, 13, -10); c.quadraticCurveTo(0, -6, -13, -10); c.closePath();
    const g2 = c.createLinearGradient(0, -26, 0, -8); g2.addColorStop(0, '#ffe0f6'); g2.addColorStop(1, '#ff9fd8'); c.fillStyle = g2; c.fill(); c.strokeStyle = '#9a3e78'; c.stroke();
    bossEyes(c, 0, -16, 0.75, d, mood); c.strokeStyle = '#7a2a5a'; c.beginPath(); c.arc(0, -13, 1.6, 0.3, Math.PI - 0.3); c.stroke();
    c.fillStyle = '#fff6ff'; for (let i = -2; i <= 2; i++) { ell(c, i * 3, -27 - (i === 0 ? 2 : 0), 1.4, 1.4); c.fill(); }
  } else if (b.k === 'bee') { // round duchess bee with a lace collar and a tiny tiara
    c.scale(d, 1); const flap = Math.sin(t * 1.1) * 0.5;
    c.fillStyle = 'rgba(235,248,255,.85)'; c.strokeStyle = '#7aa0c8'; ell(c, -4, -24, 6, 9 + flap * 3, -0.5); c.fill(); c.stroke(); ell(c, 5, -25, 5.5, 8 - flap * 3, 0.4); c.fill(); c.stroke();
    ell(c, 0, -11, 13, 11); const bg = c.createLinearGradient(-13, 0, 13, 0); bg.addColorStop(0, '#ffd34d'); bg.addColorStop(1, '#ffa81f'); c.fillStyle = bg; c.fill(); c.strokeStyle = '#6b3d0a'; c.stroke();
    c.fillStyle = '#3b2412'; c.fillRect(-7, -21, 3.5, 20); c.fillRect(-1, -22, 3.5, 22);
    c.fillStyle = '#fff'; c.strokeStyle = '#c0a0d0'; for (let i = 0; i < 5; i++) { ell(c, 6 + i * 1.6, -17 + i * 1.8, 2, 1.4); c.fill(); }
    c.fillStyle = b.ph === 'stuck' || b.ph === 'dive' ? '#ff6fae' : '#3b2412'; c.beginPath(); c.moveTo(-12, -9); c.lineTo(-18, b.ph === 'stuck' ? -2 : -8); c.lineTo(-12, -6); c.fill();
    c.scale(d, 1); bossEyes(c, d * 6, -13, 0.7, d, mood);
    c.fillStyle = '#ffd34d'; c.strokeStyle = '#8a5a12'; c.beginPath(); c.moveTo(d * 2, -22); c.lineTo(d * 3, -26); c.lineTo(d * 5, -23); c.lineTo(d * 7, -27); c.lineTo(d * 8, -22); c.closePath(); c.fill(); c.stroke();
    if (b.ph === 'stuck') dizzyStars(c, t, -28);
  } else if (b.k === 'cloud') { // grumpy storm cloud with puffy cheeks
    const dark = b.ph === 'rain' ? '#8a96c8' : '#c8d2f0'; c.fillStyle = hc ? '#ffffff' : dark; c.strokeStyle = hc ? '#000' : '#4a5a9a';
    for (const [cx, cy, r] of [[-12, -7, 8], [12, -7, 8], [-5, -12, 9], [6, -13, 9], [0, -6, 9]]) { ell(c, cx, cy, r, r * 0.85); c.fill(); c.stroke(); }
    for (const [cx, cy, r] of [[-12, -7, 7], [12, -7, 7], [-5, -12, 8], [6, -13, 8], [0, -6, 8]]) { ell(c, cx, cy, r, r * 0.85); c.fill(); }
    if (b.gust) { c.fillStyle = '#ffb3de'; ell(c, -8, -8, 3.4, 2.6); c.fill(); ell(c, 8, -8, 3.4, 2.6); c.fill(); }
    bossEyes(c, 0, -11, 0.8, d, mood); c.strokeStyle = '#2a2f5a'; c.lineWidth = 1.2; c.beginPath(); b.gust ? ell(c, d * 1, -5, 2, 2) : (c.moveTo(-4, -4.5), c.quadraticCurveTo(0, -6.5, 4, -4.5)); c.stroke();
    if (b.ph === 'rain' && !hc) { c.strokeStyle = '#ffe66a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-14, 0); c.lineTo(-11, 4); c.lineTo(-13, 4); c.lineTo(-10, 9); c.stroke(); }
  } else if (b.k === 'walrus') { // big frosty walrus with a scarf and tusks
    c.scale(d, 1); const slide = b.ph === 'slide';
    c.fillStyle = '#c69a8a'; c.strokeStyle = '#5a3a32'; c.beginPath(); c.ellipse(-2, slide ? -8 : -11, 16, slide ? 8 : 11, slide ? 0.1 : 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = '#e8c8b8'; ell(c, 8, slide ? -9 : -14, 8, 7); c.fill(); c.stroke();
    c.fillStyle = '#5ab0ff'; c.strokeStyle = '#1d4a8f'; c.beginPath(); c.roundRect(-6, slide ? -12 : -19, 12, 4, 2); c.fill(); c.stroke(); c.fillRect(-8, slide ? -12 : -19, 3, 9);
    c.fillStyle = '#ffffff'; c.strokeStyle = '#8a8a9a'; c.beginPath(); c.moveTo(9, slide ? -6 : -10); c.lineTo(10, slide ? 1 : -2); c.lineTo(12, slide ? -6 : -10); c.fill(); c.stroke(); c.beginPath(); c.moveTo(13, slide ? -6 : -10); c.lineTo(14.5, slide ? 1 : -2); c.lineTo(16, slide ? -6 : -10); c.fill(); c.stroke();
    c.fillStyle = '#e8c8b8'; c.strokeStyle = '#5a3a32'; ell(c, -14, -2, 4, 2.4); c.fill(); c.stroke(); ell(c, 4, -2, 4, 2.4, 0.4); c.fill(); c.stroke();
    c.scale(d, 1); bossEyes(c, d * 7, slide ? -14 : -20, 0.65, d, mood);
    if (b.ph === 'dizzy') dizzyStars(c, t, -30);
  } else if (b.k === 'moth') { // fiery moth with glowing wing eyes
    const flap = b.ph === 'rest' ? 0.15 : Math.sin(t * 0.5) * 0.45; c.scale(d, 1);
    if (!hc) { const g = c.createRadialGradient(0, -11, 2, 0, -11, 24); g.addColorStop(0, 'rgba(255,160,60,.45)'); g.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = g; c.fillRect(-26, -36, 52, 50); }
    for (const s of [-1, 1]) { c.save(); c.translate(s * 3, -12); c.rotate(s * (0.3 + flap)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(s * 18, -16, s * 16, 2); c.quadraticCurveTo(s * 10, 8, 0, 0);
      const wg = c.createLinearGradient(0, -10, s * 16, 4); wg.addColorStop(0, '#ff7a3a'); wg.addColorStop(1, '#ffd34d'); c.fillStyle = hc ? '#ffffff' : wg; c.fill(); c.strokeStyle = hc ? '#000' : '#7a2a10'; c.stroke();
      ell(c, s * 9, -3, 2.6, 2.6); c.fillStyle = '#7a2ad0'; c.fill(); c.restore(); }
    ell(c, 0, -10, 5, 9); c.fillStyle = '#ffe0b0'; c.fill(); c.strokeStyle = '#7a2a10'; c.stroke();
    c.strokeStyle = '#7a2a10'; c.beginPath(); c.moveTo(-1, -18); c.quadraticCurveTo(-4, -26, -7, -25); c.moveTo(1, -18); c.quadraticCurveTo(4, -26, 7, -25); c.stroke();
    c.scale(d, 1); bossEyes(c, 0, -14, 0.55, d, mood);
  } else if (b.k === 'owl') { // midnight owl in a starry cloak, moon crest
    c.scale(d, 1);
    c.fillStyle = '#2e2266'; c.strokeStyle = '#120b3a'; c.beginPath(); c.moveTo(-13, 0); c.quadraticCurveTo(-16, -18, -8, -26); c.lineTo(8, -26); c.quadraticCurveTo(16, -18, 13, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ffd34d'; for (let i = 0; i < 5; i++) { starPath(c, -9 + (i * 37 % 18), -4 - (i * 23 % 16), 1.3); c.fill(); }
    c.fillStyle = '#6a5cc0'; ell(c, 0, -17, 10, 9); c.fill(); c.stroke(); c.fillStyle = '#e8e0ff'; ell(c, 0, -10, 6, 6); c.fill();
    c.fillStyle = '#6a5cc0'; c.beginPath(); c.moveTo(-9, -22); c.lineTo(-11, -30); c.lineTo(-4, -25); c.fill(); c.beginPath(); c.moveTo(9, -22); c.lineTo(11, -30); c.lineTo(4, -25); c.fill();
    c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(0, -28, 3.4, 0.6, Math.PI * 2 - 0.6); c.lineTo(0, -28); c.fill();
    c.scale(d, 1); bossEyes(c, 0, -18, 0.85, d, mood); c.fillStyle = '#ffb21f'; c.beginPath(); c.moveTo(-1.6, -14); c.lineTo(1.6, -14); c.lineTo(0, -11); c.fill();
    if (b.ph === 'rest') { c.fillStyle = '#fff'; c.font = 'bold 7px system-ui'; c.fillText('z', 10, -30 - (t % 40) / 8); }
  }
  c.restore();
}
export const THEMES = {
  pond: { style: 'hills', sky: ['#ffd9f1', '#c9a8ff', '#8e6ae6'], dirt: '#6a4a96', dirt2: '#5a3d84', top: '#86e0a6', top2: '#55bd83', block: '#a48ad8', blockT: '#cdb8ff', plat: '#7fdc9d', platS: '#2f7c55', far: '#b897f2', near: '#8c6fd6', water: 'rgba(110,150,255,.38)', waterTop: 'rgba(220,240,255,.85)' },
  cave: { style: 'spires', sky: ['#2a1650', '#1d1040', '#120a2c'], dirt: '#3a2a6b', dirt2: '#2e2158', top: '#a07bff', top2: '#7b57e6', block: '#6b48d6', blockT: '#b79bff', plat: '#c2a8ff', platS: '#5a3fb0', far: '#2e1d5c', near: '#3d2775', water: 'rgba(90,120,255,.38)', waterTop: 'rgba(190,210,255,.8)' },
  reef: { style: 'reef', sky: ['#ff9fd2', '#8b5cf0', '#3a1d8c'], dirt: '#e59ac0', dirt2: '#cf7fac', top: '#ffd0e4', top2: '#ff8fbe', block: '#c25aa0', blockT: '#ff9fd0', plat: '#ff9fc8', platS: '#9a3e78', far: '#6b3fc7', near: '#a24fbf', water: 'rgba(60,90,230,.42)', waterTop: 'rgba(170,240,255,.85)' },
  meadow: { style: 'meadow', sky: ['#9fdcff', '#d8f3ff', '#fff2c2'], dirt: '#9a6a48', dirt2: '#8a5d3e', top: '#8fe36a', top2: '#5cbf4a', block: '#f2b84b', blockT: '#ffe08a', plat: '#ffd36b', platS: '#a8741c', far: '#b4e69a', near: '#7fcf72', water: 'rgba(90,170,255,.4)', waterTop: 'rgba(230,250,255,.9)', mush: ['#ff6f8f', '#c23a5e'], stem: '#fff1dc' },
  sky: { style: 'clouds', sky: ['#7cc4ff', '#bfe3ff', '#ffeefa'], dirt: '#eef2ff', dirt2: '#e2e9fc', top: '#ffffff', top2: '#dde7ff', block: '#ffd6f0', blockT: '#ffffff', plat: '#ffffff', platS: '#8aa6e0', far: '#e6f2ff', near: '#cfe4ff', water: 'rgba(120,180,255,.4)', waterTop: 'rgba(255,255,255,.9)', crumb: ['#ffffff', '#b8c8f0'] },
  frost: { style: 'peaks', sky: ['#2c3e86', '#6a8fd6', '#cfe6ff'], dirt: '#6d84b8', dirt2: '#5f76a8', top: '#f4fbff', top2: '#c9e6ff', block: '#8fc8ee', blockT: '#e8fbff', plat: '#e6f6ff', platS: '#5a86c0', far: '#8fb0e6', near: '#b8d3f5', water: 'rgba(120,200,255,.45)', waterTop: 'rgba(235,250,255,.9)' },
  volcano: { style: 'volcano', sky: ['#2a0b26', '#6e1a2e', '#ff7a3a'], dirt: '#3b2230', dirt2: '#301c28', top: '#7a3e3a', top2: '#5a2a30', block: '#5a2d3a', blockT: '#a8504a', plat: '#d0683a', platS: '#4a1a14', far: '#5a1830', near: '#3e1226', water: 'rgba(255,120,60,.4)', waterTop: 'rgba(255,220,150,.9)' },
  castle: { style: 'castle', sky: ['#0f0a33', '#271865', '#4a2b8a'], dirt: '#3c3170', dirt2: '#352b64', top: '#9a8ae0', top2: '#6a5cc0', block: '#5b4aa8', blockT: '#a99bff', plat: '#c7b8ff', platS: '#4a3a99', far: '#1d1449', near: '#2a1d60', water: 'rgba(110,130,255,.4)', waterTop: 'rgba(210,220,255,.85)', mush: ['#c99bff', '#6a3fd0'], stem: '#e8e0ff' },
  candy: { style: 'candy', sky: ['#ffc8e8', '#ffe8f6', '#c8f0ff'], dirt: '#ff9ccf', dirt2: '#ffaad6', top: '#ffffff', top2: '#ffd8ee', block: '#9be8ff', blockT: '#e0faff', plat: '#ffe28a', platS: '#d17aa8', far: '#ffc2e2', near: '#ffa8d6', water: 'rgba(255,140,200,.4)', waterTop: 'rgba(255,240,250,.9)', mush: ['#7fdcff', '#2a8fc0'], stem: '#ffffff', crumb: ['#fff2a8', '#d8a040'] }
};
