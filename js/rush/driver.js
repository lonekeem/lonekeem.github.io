// The player's Pal as the driver: pre-rendered sprites (one per mood), fitted into each vehicle's seat.
import { drawPal } from '../pals/art.js';
import { drawBack, drawFront, drawWheel, drawSteer, clipCab } from './cars.js';

export const KEMY = { species: 'kemy', name: 'Kemy', colors: {}, outfit: {}, level: 5, variant: '', pattern: 'none' };
export const CAPY = { species: 'capybara', name: 'Capy', colors: {}, outfit: {}, level: 5, variant: '', pattern: 'none' };
export function snap(p) { if (!p || !p.species) return null; const o = { ...(p.outfit || {}) }; delete o.held;
  return { species: String(p.species).slice(0, 30), name: String(p.name || '').slice(0, 30), colors: p.colors || {}, outfit: o, level: Number(p.level) || 1, variant: p.variant || '', pattern: p.pattern || 'none' }; }

const W = 560, H = 600, FEET = 580, SIZE = 200;
function render(pal, mode) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  try { drawPal(c, W / 2, FEET, SIZE, pal, { t: mode === 'happy' ? 6 : mode === 'shake' ? 3 : 37, mode, flat: true }); } catch { drawPal(c, W / 2, FEET, SIZE, KEMY, { t: 0, mode, flat: true }); }
  const d = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0) { x0 = 200; x1 = 360; y0 = 300; y1 = FEET; }
  // head band (top 40%) gives the true center + body width, so tails and wings do not shrink the fit
  let hx0 = W, hx1 = 0; const hy = y0 + (y1 - y0) * 0.4;
  for (let y = y0; y < hy; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 90) { if (x < hx0) hx0 = x; if (x > hx1) hx1 = x; }
  if (hx1 <= hx0) { hx0 = x0; hx1 = x1; }
  return { cv, x0, y0, w: x1 - x0 + 2, h: y1 - y0 + 2, hcx: (hx0 + hx1) / 2, hw: hx1 - hx0 + 2 };
}
// body color for paws
function bodyColor(pal) { return (pal.colors && pal.colors.body) || null; }

// Build a driver for a vehicle: sprites + fit + head circle (vehicle coords) for the crash sensor.
export function makeDriver(pal, v, cache = new Map()) {
  pal = pal || KEMY; const key = JSON.stringify(pal);
  let spr = cache.get(key); if (!spr) { spr = { idle: render(pal, 'idle'), happy: render(pal, 'happy'), shake: render(pal, 'shake') }; cache.set(key, spr); }
  const s = v.seat, b = spr.idle;
  // full height from sill-to-roof (72% shows above the door); wide Pals may overlap the pillars a bit
  let Hs = (s.y - s.top - 0.04) / 0.72, Ws = Hs * b.hw / b.h; const maxW = s.w * 1.55;
  if (Ws > maxW) { Ws = maxW; Hs = Ws * b.h / b.hw; }
  let top = s.top + 0.04, bottom = top + Hs; if (bottom < s.y + 0.08) { bottom = s.y + 0.08; top = bottom - Hs; }
  const k = Hs / b.h, cx = s.x;
  const head = { x: cx, y: top + Hs * 0.4, r: Math.max(0.16, Math.min(Hs * 0.42, Ws * 0.4)) };
  let paw = bodyColor(pal); if (!paw) { const c = b.cv.getContext('2d'); const d = c.getImageData(b.hcx | 0, b.y0 + b.h * 0.62 | 0, 1, 1).data; paw = `rgb(${d[0]},${d[1]},${d[2]})`; }
  return { pal, spr, k, bottom, top, cx, Hs, Ws, head, paw };
}

// Draw the whole vehicle + driver in vehicle coords. o: { wheels:[{x,y,a}], lean, bob, mood, t, night }
export function drawVehicle(c, v, drv, o = {}) {
  drawBack(c, v);
  if (drv) {
    const s = v.seat, sp = drv.spr[o.mood || 'idle'] || drv.spr.idle, lean = (s.lean || 0) + (o.lean || 0), bob = o.bob || 0;
    c.save(); clipCab(c, v); c.translate(s.x, s.y + bob); c.rotate(-lean); c.translate(-s.x, -s.y);
    // sprite: its measured box maps onto [cx - Ws/2, top] .. [cx + Ws/2, bottom]
    const k = drv.k; c.drawImage(sp.cv, sp.x0, sp.y0, sp.w, sp.h, drv.cx - (sp.hcx - sp.x0) * k, drv.bottom - sp.h * k, sp.w * k, sp.h * k);
    // seatbelt across the chest
    const by = drv.bottom - drv.Hs * 0.42; c.lineCap = 'round'; c.strokeStyle = '#2b1d4a'; c.lineWidth = 0.075;
    c.beginPath(); c.moveTo(drv.cx - drv.Ws * 0.36, by - drv.Hs * 0.13); c.lineTo(drv.cx + drv.Ws * 0.3, by + drv.Hs * 0.12); c.stroke();
    c.strokeStyle = '#ffd23f'; c.lineWidth = 0.045; c.stroke();
    var sh = [drv.cx + drv.Ws * 0.12, drv.bottom - drv.Hs * 0.36]; // shoulder (in leaned space)
    const m = c.getTransform(); c.restore();
    const inv = c.getTransform().inverse().multiply(m); var shW = inv.transformPoint({ x: sh[0], y: sh[1] });
    if (o.mood === 'shake') { const t = o.t || 0; for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; drawStar(c, drv.cx + Math.cos(a) * drv.Ws * 0.45, drv.top - 0.05 + Math.sin(a) * 0.1, 0.09); } }
  }
  drawSteer(c, v);
  if (drv) { const [x, y] = v.seat.sw; c.lineCap = 'round'; c.strokeStyle = drv.paw; c.lineWidth = 0.12;
    c.beginPath(); c.moveTo(shW.x, shW.y); c.quadraticCurveTo((shW.x + x) / 2, shW.y + 0.12, x - 0.03, y + 0.08); c.stroke();
    for (const dy of [-0.13, 0.11]) { c.beginPath(); c.ellipse(x + 0.02, y + dy, 0.075, 0.065, 0, 0, 7); c.fillStyle = drv.paw; c.fill(); c.lineWidth = 0.025; c.strokeStyle = 'rgba(43,29,74,.6)'; c.stroke(); } }
  drawFront(c, v, o);
  const ws = o.wheels || v.wheels.map((w) => ({ x: w.x, y: w.y, a: 0 }));
  v.wheels.forEach((w, i) => drawWheel(c, v, ws[i].x, ws[i].y, w.r, ws[i].a));
}
function drawStar(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 0.02; c.strokeStyle = '#b8860b'; c.stroke(); }
