// Kemy Hill Rush vehicle art: original, generic, cartoon vehicles drawn in code (no brands, no logos).
// Vehicle coords are meters, y-DOWN, origin at the body center. Layers: back (cabin inside),
// then the Pal driver, then belt + steering wheel + paws, then front (body, pillars, glass), then wheels.
const INK = '#2b1d4a', INSIDE = '#4b3f78', GLASS = 'rgba(200,236,255,.28)';
const SPEC = {
  scout: { lower: [[-1.66, 0.34], [-1.66, -0.3], [-1.3, -0.42], [-0.95, -0.42], [-0.9, -0.22], [0.25, -0.22], [0.5, -0.4], [1.3, -0.38], [1.68, -0.12], [1.68, 0.3]],
    bar: [[-1.0, -0.42], [-0.95, -1.47], [0.3, -1.47], [0.62, -0.42]], light: [1.56, -0.2] },
  sports: { lower: [[-1.95, 0.3], [-1.95, -0.1], [-1.4, -0.36], [0.75, -0.36], [1.5, -0.22], [2.0, 0.0], [2.0, 0.28]],
    cab: [[-1.35, -0.34], [-0.85, -1.26], [0.1, -1.28], [0.78, -0.34]], win: [[-1.1, -0.42], [-0.75, -1.15], [0.05, -1.17], [0.55, -0.42]], light: [1.88, -0.06] },
  pickup: { lower: [[-2.02, 0.34], [-2.02, -0.44], [-0.45, -0.44], [-0.45, -0.36], [1.25, -0.36], [2.02, -0.12], [2.02, 0.3]],
    cab: [[-0.45, -0.36], [-0.4, -1.55], [0.55, -1.55], [1.05, -0.36]], win: [[-0.27, -0.46], [-0.24, -1.42], [0.5, -1.42], [0.86, -0.46]], light: [1.9, -0.16] },
  buggy: { lower: [[-1.5, 0.3], [-1.5, -0.05], [-0.88, -0.32], [-0.72, -0.15], [0.35, -0.15], [0.6, -0.3], [1.3, -0.18], [1.55, 0.08], [1.25, 0.3]],
    bar: [[-0.86, -0.3], [-0.72, -1.43], [0.25, -1.43], [0.62, -0.3]], light: [1.4, -0.05] },
  rally: { lower: [[-1.82, 0.3], [-1.82, -0.1], [-1.5, -0.45], [0.75, -0.45], [1.82, -0.12], [1.82, 0.28]],
    cab: [[-1.4, -0.45], [-0.95, -1.33], [0.2, -1.35], [0.85, -0.45]], win: [[-1.15, -0.52], [-0.8, -1.22], [0.15, -1.24], [0.62, -0.52]], light: [1.7, -0.14] },
  patrol: { lower: [[-2.07, 0.3], [-2.07, -0.1], [-1.7, -0.4], [1.25, -0.4], [2.07, -0.14], [2.07, 0.28]],
    cab: [[-1.4, -0.4], [-0.95, -1.36], [0.35, -1.37], [0.95, -0.4]], win: [[-1.15, -0.47], [-0.8, -1.26], [0.3, -1.27], [0.72, -0.47]], light: [1.95, -0.16] },
  bus: { lower: [[-2.62, 0.42], [-2.62, -0.86], [2.6, -0.86], [2.7, -0.6], [2.7, 0.42]],
    cab: [[-2.62, -0.86], [-2.62, -1.5], [-2.5, -1.62], [2.25, -1.62], [2.6, -0.86]],
    win: [[1.22, -0.92], [1.22, -1.5], [2.2, -1.5], [2.48, -0.92]], wins: [-2.35, -1.65, -0.95, -0.25, 0.45], light: [2.62, -0.3] },
  tractor: { lower: [[-0.3, -0.64], [1.0, -0.6], [1.58, -0.42], [1.62, 0.16], [-0.3, 0.2]], seatbox: [[-1.27, 0.2], [-1.27, -0.66], [-0.25, -0.66], [-0.25, 0.2]],
    bar: [[-1.08, -0.66], [-1.05, -2.0], [-0.02, -2.0], [0.0, -0.66]], canopy: 1, light: [1.5, -0.25] },
  monster: { lower: [[-1.85, 0.16], [-1.85, -0.62], [-0.75, -0.66], [0.95, -0.66], [1.88, -0.36], [1.88, 0.12]],
    cab: [[-0.75, -0.66], [-0.62, -2.02], [0.56, -2.02], [1.05, -0.66]], win: [[-0.56, -0.76], [-0.46, -1.9], [0.5, -1.9], [0.86, -0.76]], light: [1.78, -0.32] },
  rig: { lower: [[-2.3, 0.35], [-2.3, -0.32], [-0.32, -0.32], [-0.32, -0.76], [2.32, -0.76], [2.32, 0.32]],
    cab: [[-0.32, -0.76], [-0.27, -1.9], [1.15, -1.9], [2.3, -0.82], [2.32, -0.76]], win: [[-0.07, -0.86], [-0.04, -1.77], [1.05, -1.77], [1.98, -0.86]], light: [2.2, -0.3] },
  rover: { lower: [[-1.72, 0.12], [-1.55, -0.3], [1.55, -0.3], [1.72, 0.12]], dome: 1, light: [1.6, -0.1] }
};
const poly = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function gloss(c, pts, col) { // body fill with a soft top highlight
  const ys = pts.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, shade(col, 0.28)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.18));
  poly(c, pts); c.fillStyle = g; c.fill(); c.lineWidth = 0.055; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke();
}
function tube(c, pts, col, w = 0.09) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineCap = c.lineJoin = 'round';
  c.strokeStyle = INK; c.lineWidth = w + 0.06; c.stroke(); c.strokeStyle = col; c.lineWidth = w; c.stroke(); }

export function drawBack(c, v) {
  const s = SPEC[v.kind]; c.save();
  if (s.cab) { poly(c, s.cab); c.fillStyle = shade(v.body, -0.1); c.fill(); }
  if (s.win) { poly(c, s.win); c.fillStyle = INSIDE; c.fill(); }
  if (s.wins) for (const x of s.wins) { rrect(c, x, -1.48, 0.58, 0.54, 0.08); c.fillStyle = INSIDE; c.fill(); }
  // seat back
  const st = v.seat; rrect(c, st.x - st.w * 0.55, st.y - 0.78, 0.24, 0.84, 0.1); c.fillStyle = shade(v.acc, -0.35); c.fill();
  if (s.canopy) { c.fillStyle = shade(v.body, -0.25); c.fillRect(-1.27, -0.68, 1.02, 0.08); }
  c.restore();
}

export function drawFront(c, v, o = {}) {
  const s = SPEC[v.kind], t = o.t || 0; c.save();
  if (s.seatbox) gloss(c, s.seatbox, v.acc);
  gloss(c, s.lower, v.body);
  // stripe
  c.save(); poly(c, s.lower); c.clip(); c.fillStyle = v.acc; c.globalAlpha = 0.9; const ly = Math.min(...s.lower.map((p) => p[1]));
  c.fillRect(-3, ly + 0.14, 6, 0.09); c.restore();
  if (s.cab) { c.beginPath(); poly(c, s.cab); if (s.win) { s.win.slice().reverse().forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
    if (s.wins) for (const x of s.wins) { c.moveTo(x, -1.48); c.lineTo(x, -0.94); c.lineTo(x + 0.58, -0.94); c.lineTo(x + 0.58, -1.48); c.closePath(); }
    const g = c.createLinearGradient(0, -2, 0, -0.4); g.addColorStop(0, shade(v.body, 0.3)); g.addColorStop(1, v.body); c.fillStyle = g; c.fill('evenodd');
    poly(c, s.cab); c.lineWidth = 0.055; c.strokeStyle = INK; c.stroke();
    const glass = (pts) => { poly(c, pts); c.fillStyle = GLASS; c.fill(); c.save(); poly(c, pts); c.clip(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.07;
      const x0 = Math.min(...pts.map((p) => p[0])), y0 = Math.min(...pts.map((p) => p[1])); c.beginPath(); c.moveTo(x0 + 0.15, y0 + 0.5); c.lineTo(x0 + 0.5, y0 + 0.05); c.stroke(); c.restore();
      poly(c, pts); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke(); };
    if (s.win) glass(s.win);
    if (s.wins) for (const x of s.wins) { const p = [[x, -1.48], [x + 0.58, -1.48], [x + 0.58, -0.94], [x, -0.94]]; poly(c, p); c.fillStyle = GLASS; c.fill(); c.lineWidth = 0.04; c.strokeStyle = INK; c.stroke(); }
  }
  if (s.bar) { tube(c, s.bar, v.acc); if (v.kind === 'buggy') tube(c, [[-0.78, -0.95], [0.25, -1.43]], v.acc, 0.06); }
  if (s.canopy) { rrect(c, -1.32, -2.12, 1.45, 0.16, 0.07); c.fillStyle = v.acc; c.fill(); c.lineWidth = 0.05; c.strokeStyle = INK; c.stroke(); tube(c, [[0.95, -0.55], [0.95, -1.25]], '#c8c6d8', 0.1); }
  if (s.dome) { c.beginPath(); c.ellipse(-0.17, -0.3, 0.72, 1.42, 0, Math.PI, 2 * Math.PI); c.fillStyle = 'rgba(200,236,255,.22)'; c.fill(); c.lineWidth = 0.05; c.strokeStyle = 'rgba(255,255,255,.8)'; c.stroke();
    c.beginPath(); c.ellipse(-0.42, -1.05, 0.12, 0.4, 0.35, 0, 7); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill(); }
  // details per kind
  const k = v.kind;
  if (k === 'scout') { c.beginPath(); c.arc(-1.78, -0.05, 0.3, 0, 7); c.fillStyle = '#3a3155'; c.fill(); c.beginPath(); c.arc(-1.78, -0.05, 0.14, 0, 7); c.fillStyle = v.acc; c.fill(); }
  if (k === 'sports') { tube(c, [[-1.8, -0.36], [-1.85, -0.58], [-1.45, -0.58]], v.acc, 0.07); }
  if (k === 'pickup') { tube(c, [[-1.95, -0.44], [-0.5, -0.44]], shade(v.body, -0.3), 0.05); }
  if (k === 'buggy') { tube(c, [[-1.3, -0.1], [-1.35, -2.0]], '#fff', 0.025); poly(c, [[-1.35, -2.0], [-0.95, -1.88], [-1.35, -1.75]]); c.fillStyle = v.acc; c.fill(); }
  if (k === 'rally') { c.beginPath(); c.arc(-0.3, -0.16, 0.17, 0, 7); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = INK; c.stroke(); c.fillStyle = v.acc; c.font = 'bold 0.24px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', -0.3, -0.15); }
  if (k === 'patrol') { rrect(c, -0.95, -0.38, 1.6, 0.44, 0.06); c.fillStyle = v.acc; c.fill(); const on = Math.sin(t * 9) > 0;
    rrect(c, -0.55, -1.52, 0.36, 0.15, 0.06); c.fillStyle = on ? '#ff5d7a' : '#ffc2cf'; c.fill(); rrect(c, -0.19, -1.52, 0.36, 0.15, 0.06); c.fillStyle = on ? '#bfe0ff' : '#4aa8ff'; c.fill();
    c.fillStyle = '#ffd23f'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.05 : 0.11; c.lineTo(-0.15 + Math.cos(a) * r, -0.16 + Math.sin(a) * r); } c.fill(); }
  if (k === 'bus') { c.fillStyle = INK; c.fillRect(-2.62, -0.7, 5.3, 0.05); c.fillRect(-2.62, -0.48, 5.3, 0.05); rrect(c, 2.66, -0.1, 0.16, 0.3, 0.04); c.fillStyle = '#c8c6d8'; c.fill();
    c.fillStyle = INK; c.font = 'bold 0.2px sans-serif'; c.textAlign = 'center'; c.fillText('KEMY KIDS', -0.6, -0.55); }
  if (k === 'monster') { for (const x of [-1.25, 1.25]) { tube(c, [[x - 0.2, -0.1], [x, 0.55]], '#c8c6d8', 0.08); } c.fillStyle = v.acc; for (const x of [-1.4, -1.05]) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.06 : 0.13; c.lineTo(x + Math.cos(a) * r, -0.35 + Math.sin(a) * r); } c.fill(); } }
  if (k === 'rig') { tube(c, [[-0.5, -0.7], [-0.5, -2.25]], '#e8e8f2', 0.11); rrect(c, -2.1, -0.46, 1.3, 0.14, 0.05); c.fillStyle = '#3a3155'; c.fill(); for (let i = 0; i < 4; i++) { c.fillStyle = '#e8e8f2'; c.fillRect(2.05, -0.62 + i * 0.16, 0.25, 0.07); } }
  if (k === 'rover') { tube(c, [[1.1, -0.3], [1.25, -1.3]], '#c8c6d8', 0.03); c.beginPath(); c.arc(1.25, -1.36, 0.1, 0, 7); c.fillStyle = v.acc; c.fill(); rrect(c, -1.7, -0.75, 0.6, 0.38, 0.05); c.fillStyle = '#4a6cf0'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = '#bcd0ff'; c.stroke(); }
  // headlight (bright at night)
  if (s.light) { c.beginPath(); c.ellipse(s.light[0], s.light[1], 0.09, 0.07, 0, 0, 7); c.fillStyle = o.night ? '#fffbd0' : '#fff6b0'; c.fill(); c.lineWidth = 0.03; c.strokeStyle = INK; c.stroke(); }
  c.restore();
}

export function drawWheel(c, v, x, y, r, ang) {
  c.save(); c.translate(x, y); c.rotate(ang);
  const k = v.kind;
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = '#2d2540'; c.fill();
  if (k === 'monster' || k === 'tractor' || k === 'buggy') { c.fillStyle = '#3e3456'; const n = k === 'tractor' ? 10 : 12; for (let i = 0; i < n; i++) { c.save(); c.rotate(i * 2 * Math.PI / n); c.fillRect(-r * 0.12, -r * 1.02, r * 0.24, r * 0.2); c.restore(); } }
  c.beginPath(); c.arc(0, 0, r, 0, 7); c.lineWidth = 0.05; c.strokeStyle = INK; c.stroke();
  const rim = r * (k === 'rover' ? 0.8 : 0.55);
  c.beginPath(); c.arc(0, 0, rim, 0, 7); c.fillStyle = k === 'rover' ? 'rgba(200,198,216,.35)' : v.acc; c.fill();
  c.strokeStyle = k === 'rover' ? '#c8c6d8' : shade(v.acc, -0.3); c.lineWidth = r * 0.08;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * rim, Math.sin(a) * rim); c.stroke(); }
  c.beginPath(); c.arc(0, 0, r * 0.16, 0, 7); c.fillStyle = '#fff'; c.fill();
  c.beginPath(); c.arc(-rim * 0.35, -rim * 0.35, rim * 0.22, 0, 7); c.fillStyle = 'rgba(255,255,255,.35)'; c.fill();
  c.restore();
}

// Steering column + wheel (drawn over the driver's body, under the paws)
export function drawSteer(c, v) { const [x, y] = v.seat.sw; c.save(); c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = 0.06; c.beginPath(); c.moveTo(x + 0.25, y + 0.32); c.lineTo(x, y); c.stroke();
  c.beginPath(); c.ellipse(x, y, 0.07, 0.2, -0.35, 0, 7); c.lineWidth = 0.075; c.strokeStyle = INK; c.stroke(); c.lineWidth = 0.035; c.strokeStyle = '#7c6fa8'; c.stroke(); c.restore(); }
// Clip to the closed cab outline so tails/wings never poke through the body (open cars: no clip).
export function clipCab(c, v) { const s = SPEC[v.kind]; if (!s || !s.cab || s.bar) return false; c.beginPath(); poly(c, s.cab); c.clip(); return true; }
