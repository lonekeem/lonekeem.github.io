// Star Pool UI: purple felt, wood and gold rails, aim guide, fine-aim wheel, side power bar, spin.
// Portrait on phones, landscape on wide screens. Online, the shooter sends the shot plus the
// authoritative end positions; the other client replays the same simulation, then eases onto
// those positions when a foul moved the cue ball.
// Written by Lone Keem.
import * as P from './pool-engine.js';
import { tsMs, TURN_SECONDS } from './net.js';
import { ask, palByLevel, normLevel, whenOffer, offerHtml, stopOffer, lastLevel, onlyBots } from './bots.js';
import { syncPlates } from './plates.js';
import { onSample } from '../input.js';

const COLORS = { 1: '#f2b31b', 2: '#3d7bff', 3: '#e2558f', 4: '#8a2be2', 5: '#ff7a2f', 6: '#2bb5a8', 7: '#9b1d3a' };
const ballColor = (id) => COLORS[id > 8 ? id - 8 : id];
const logo = new Image(); logo.src = 'logo.png';
const SPR = 96;

function star(g, x, y, rr, fill) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rr * 0.45 : rr;
    g.lineTo(x + q * Math.cos(a), y + q * Math.sin(a));
  }
  g.closePath(); g.fillStyle = fill; g.fill();
}
function makeSprite(id) {
  const c = document.createElement('canvas'); c.width = c.height = SPR;
  const g = c.getContext('2d'), r = SPR / 2 - 3, cx = SPR / 2, cy = SPR / 2;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (id === 0) { g.fillStyle = '#f6f3ec'; g.fillRect(0, 0, SPR, SPR); }
  else if (id === 8) { g.fillStyle = '#100e16'; g.fillRect(0, 0, SPR, SPR); }
  else if (id < 8) { g.fillStyle = ballColor(id); g.fillRect(0, 0, SPR, SPR); }
  else {
    g.fillStyle = '#f7f4ee'; g.fillRect(0, 0, SPR, SPR);
    g.fillStyle = ballColor(id); g.fillRect(0, cy - r * 0.34, SPR, r * 0.68);
  }
  const sh = g.createRadialGradient(cx - r * 0.36, cy - r * 0.42, r * 0.08, cx + r * 0.1, cy + r * 0.15, r * 1.15);
  sh.addColorStop(0, 'rgba(255,255,255,.82)'); sh.addColorStop(0.22, 'rgba(255,255,255,.12)');
  sh.addColorStop(0.55, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = sh; g.fillRect(0, 0, SPR, SPR);
  g.fillStyle = 'rgba(255,255,255,.9)';
  g.beginPath(); g.ellipse(cx - r * 0.32, cy - r * 0.36, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2); g.fill();
  g.restore();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.stroke();
  if (id === 0) star(g, cx + r * 0.28, cy + r * 0.28, r * 0.28, '#8a2be2');
  else {
    g.beginPath(); g.arc(cx, cy, r * 0.5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.lineWidth = id === 8 ? 4 : 2; g.strokeStyle = id === 8 ? '#ffc83d' : 'rgba(20,10,30,.25)'; g.stroke();
    g.fillStyle = '#1a1028'; g.font = `800 ${id === 8 ? 40 : 34}px "Space Grotesk", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(id), cx, cy + 2);
  }
  return c;
}

export function createPool(ctx) {
  const { S, main, esc, $, toast, friendlyError, ui } = ctx;
  const { net } = ui;

  function mountTable(host, opts) {
    host.innerHTML = `<div class="pl-board">
        <div class="pl-wrap"><canvas class="pl-canvas" aria-label="Pool table"></canvas></div>
        <div class="pl-side"><div class="pl-power" role="slider" tabindex="0" aria-label="Shot power. Pull down, then let go to shoot" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="pl-power-track"><div class="pl-power-fill"></div><div class="pl-power-knob"></div></div>
          <span class="pl-power-lab">Pull</span>
        </div></div>
      </div>
      <div class="pl-ctrl">
        <div class="pl-aim">
          <span class="pl-aim-lab">Fine aim</span>
          <button type="button" class="pl-nudge" id="pl-aim-l" aria-label="Aim a little to the left">‹</button>
          <div class="pl-wheel" role="slider" tabindex="0" aria-label="Fine-tune aim. Drag left or right" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"></div>
          <button type="button" class="pl-nudge" id="pl-aim-r" aria-label="Aim a little to the right">›</button>
        </div>
        <div class="pl-spin-wrap">
          <div class="pl-spin" role="slider" aria-label="Cue ball spin. Drag the dot. Double tap to clear" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50"><span class="pl-spin-dot"></span></div>
          <span class="pl-spin-lab">Spin</span>
        </div>
      </div>
      <p class="small center pl-hint" id="pl-hint"></p>`;
    const cv = host.querySelector('canvas'), g = cv.getContext('2d');
    const wrap = host.querySelector('.pl-wrap');
    const V = { balls: [], aim: { x: 0, y: -1 }, power: 0.55, spin: { x: 0, y: 0 }, canShoot: false, placing: false, kitchen: false, callMode: false, call: -1, pull: 0, anim: null, rot: false, s: 1, dpr: 1, bg: null, key: '', raf: 0 };
    const RAIL = 0.074;
    const sprites = {};
    const sprite = (id) => sprites[id] || (sprites[id] = makeSprite(id));
    function layout() {
      const board = host.querySelector('.pl-board');
      const sideW = 64;
      const bw = (board && board.clientWidth) || wrap.clientWidth || 320;
      const availW = Math.max(150, bw - sideW - 8);
      const ctrl = host.querySelector('.pl-ctrl'), hint = host.querySelector('#pl-hint');
      const short = window.innerHeight < 520 && window.innerWidth > window.innerHeight;
      const below = Math.max(short ? 70 : 0, (ctrl ? ctrl.offsetHeight : 80) + (hint ? hint.offsetHeight : 0) + 4);
      const em = document.querySelector('.g-emotes'), act = document.querySelector('#g-actions');
      const tail = short ? 0 : (em ? em.offsetHeight : 0) + (act ? act.offsetHeight : 0) + 8;
      const top = board ? Math.max(0, board.getBoundingClientRect().top) : 100;
      const room = Math.max(90, window.innerHeight - top - below - tail - 8);
      const availH = short ? room : Math.max(220, room);
      V.rot = short || (availW > availH * 1.25 && availW > 680);
      const tw = V.rot ? P.H : 1, th = V.rot ? 1 : P.H;
      V.s = Math.max(48, Math.min(availW / (tw + RAIL * 2), availH / (th + RAIL * 2)));
      const cw = Math.round((tw + RAIL * 2) * V.s), ch = Math.round((th + RAIL * 2) * V.s);
      const key = cw + 'x' + ch + (V.rot ? 'r' : 'p');
      if (key === V.key) return;
      V.key = key;
      V.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cw * V.dpr); cv.height = Math.round(ch * V.dpr);
      cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
      V.bg = null; draw();
    }
    const T = (x, y) => V.rot ? [(RAIL + y) * V.s, (RAIL + (1 - x)) * V.s] : [(RAIL + x) * V.s, (RAIL + y) * V.s];
    const Tinv = (px, py) => V.rot ? [1 - (py / V.s - RAIL), px / V.s - RAIL] : [px / V.s - RAIL, py / V.s - RAIL];
    function roundRect(b, x, y, w, h, r) { b.beginPath(); b.moveTo(x + r, y); b.arcTo(x + w, y, x + w, y + h, r); b.arcTo(x + w, y + h, x, y + h, r); b.arcTo(x, y + h, x, y, r); b.arcTo(x, y, x + w, y, r); b.closePath(); }
    function wood(b, x, y, w, h, r) {
      const grd = b.createLinearGradient(x, y, x + w, y + h);
      grd.addColorStop(0, '#a8753c'); grd.addColorStop(0.22, '#6d4120'); grd.addColorStop(0.5, '#3e2412'); grd.addColorStop(0.78, '#7a4e28'); grd.addColorStop(1, '#2c160c');
      b.fillStyle = grd; roundRect(b, x, y, w, h, r); b.fill();
      b.save(); roundRect(b, x, y, w, h, r); b.clip();
      b.strokeStyle = 'rgba(70, 32, 12, .35)'; b.lineWidth = 1;
      for (let i = 6; i < h; i += 4) {
        b.beginPath(); b.moveTo(x, y + i);
        b.bezierCurveTo(x + w * 0.3, y + i + ((i * 3) % 5) - 2, x + w * 0.7, y + i - ((i * 5) % 4), x + w, y + i + 1);
        b.stroke();
      }
      const sheen = b.createLinearGradient(x, y, x, y + h * 0.22);
      sheen.addColorStop(0, 'rgba(255,226,170,.32)'); sheen.addColorStop(1, 'rgba(255,226,170,0)');
      b.fillStyle = sheen; b.fillRect(x, y, w, h * 0.28);
      b.restore();
      b.strokeStyle = '#1a0c06'; b.lineWidth = 2; roundRect(b, 1, 1, w - 2, h - 2, r); b.stroke();
    }
    function bolt(b, x, y) {
      const grd = b.createRadialGradient(x - 1, y - 1, 0.4, x, y, 3.4);
      grd.addColorStop(0, '#fff4c8'); grd.addColorStop(0.6, '#e0b044'); grd.addColorStop(1, '#7a5418');
      b.fillStyle = grd; b.beginPath(); b.arc(x, y, 3.3, 0, 7); b.fill();
      b.fillStyle = '#4a3010'; b.beginPath(); b.arc(x, y, 1.1, 0, 7); b.fill();
    }
    function pocket(b, x, y, r) {
      b.fillStyle = 'rgba(0,0,0,.4)'; b.beginPath(); b.ellipse(x + r * 0.08, y + r * 0.16, r * 0.95, r * 0.7, 0, 0, 7); b.fill();
      const leather = b.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.15, x, y, r);
      leather.addColorStop(0, '#5a3a22'); leather.addColorStop(0.55, '#1a100c'); leather.addColorStop(1, '#000');
      b.fillStyle = leather; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill();
      const hole = b.createRadialGradient(x - r * 0.12, y - r * 0.16, 1, x + r * 0.05, y + r * 0.08, r * 0.75);
      hole.addColorStop(0, '#000'); hole.addColorStop(0.72, '#07040c'); hole.addColorStop(1, '#2a140c');
      b.fillStyle = hole; b.beginPath(); b.arc(x, y, r * 0.7, 0, 7); b.fill();
      b.strokeStyle = '#f0d078'; b.lineWidth = Math.max(1.6, r * 0.11); b.beginPath(); b.arc(x, y, r * 0.9, 0, 7); b.stroke();
      b.strokeStyle = 'rgba(255,255,255,.35)'; b.lineWidth = 1.25; b.beginPath(); b.arc(x, y, r * 0.74, Math.PI * 1.05, Math.PI * 1.75); b.stroke();
    }
    function dia(b, x, y) {
      b.save(); b.translate(x, y); b.rotate(V.rot ? Math.PI / 2 : 0);
      b.fillStyle = '#fff6d4'; b.beginPath(); b.moveTo(0, -4.2); b.lineTo(3.4, 0); b.lineTo(0, 4.2); b.lineTo(-3.4, 0); b.closePath(); b.fill();
      b.fillStyle = '#b8862e'; b.beginPath(); b.moveTo(0, 0); b.lineTo(3.4, 0); b.lineTo(0, 4.2); b.closePath(); b.fill();
      b.restore();
    }
    function background() {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      const b = c.getContext('2d'); b.scale(V.dpr, V.dpr);
      const cw = cv.width / V.dpr, ch = cv.height / V.dpr, rr = RAIL * V.s;
      wood(b, 0, 0, cw, ch, Math.min(26, rr * 0.85));
      b.strokeStyle = '#f0d078'; b.lineWidth = Math.max(2, rr * 0.09);
      roundRect(b, rr * 0.28, rr * 0.28, cw - rr * 0.56, ch - rr * 0.56, rr * 0.62); b.stroke();
      const lip = b.createLinearGradient(0, rr * 0.4, 0, ch);
      lip.addColorStop(0, '#8a5a30'); lip.addColorStop(1, '#3a2010');
      b.fillStyle = lip; roundRect(b, rr * 0.42, rr * 0.42, cw - rr * 0.84, ch - rr * 0.84, rr * 0.5); b.fill();
      const cush = rr * 0.4;
      const cg = b.createLinearGradient(0, rr - cush, 0, rr);
      cg.addColorStop(0, '#fff1c2'); cg.addColorStop(0.45, '#e6b43a'); cg.addColorStop(1, '#a87820');
      b.fillStyle = cg; roundRect(b, rr - cush, rr - cush, cw - 2 * (rr - cush), ch - 2 * (rr - cush), cush * 0.8); b.fill();
      const felt = b.createRadialGradient(cw / 2, ch * 0.42, Math.min(cw, ch) * 0.08, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
      felt.addColorStop(0, '#7a3ad4'); felt.addColorStop(0.45, '#4a178e'); felt.addColorStop(1, '#1c063c');
      b.fillStyle = felt; b.fillRect(rr, rr, cw - 2 * rr, ch - 2 * rr);
      b.save(); b.beginPath(); b.rect(rr, rr, cw - 2 * rr, ch - 2 * rr); b.clip();
      b.fillStyle = 'rgba(255,255,255,.04)';
      for (let i = 0; i < 520; i++) b.fillRect(rr + ((i * 97) % 1000) / 1000 * (cw - 2 * rr), rr + ((i * 57) % 1000) / 1000 * (ch - 2 * rr), 1.3, 1.3);
      b.fillStyle = 'rgba(0,0,0,.05)';
      for (let i = 0; i < 380; i++) b.fillRect(rr + ((i * 131) % 1000) / 1000 * (cw - 2 * rr), rr + ((i * 89) % 1000) / 1000 * (ch - 2 * rr), 1.3, 1.3);
      if (logo.complete && logo.naturalWidth) {
        const L = Math.min(cw, ch) * 0.34;
        b.save(); b.beginPath(); b.arc(cw / 2, ch / 2, L * 0.48, 0, 7); b.clip();
        b.globalAlpha = 0.16; b.drawImage(logo, cw / 2 - L / 2, ch / 2 - L / 2, L, L); b.restore();
        b.strokeStyle = 'rgba(255,200,61,.22)'; b.lineWidth = 1.5; b.beginPath(); b.arc(cw / 2, ch / 2, L * 0.5, 0, 7); b.stroke();
      }
      const vig = b.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.2, cw / 2, ch / 2, Math.max(cw, ch) * 0.62);
      vig.addColorStop(0, 'rgba(255,255,255,.05)'); vig.addColorStop(0.55, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.38)');
      b.fillStyle = vig; b.fillRect(rr, rr, cw - 2 * rr, ch - 2 * rr);
      b.restore();
      b.strokeStyle = 'rgba(255,236,190,.28)'; b.setLineDash([5, 7]); b.lineWidth = 1.25;
      b.beginPath(); const [h1x, h1y] = T(0, P.KITCHEN_Y), [h2x, h2y] = T(1, P.KITCHEN_Y); b.moveTo(h1x, h1y); b.lineTo(h2x, h2y); b.stroke(); b.setLineDash([]);
      for (const sp of [P.FOOT, P.HEAD]) { const [x, y] = T(sp.x, sp.y); b.fillStyle = 'rgba(255,244,210,.75)'; b.beginPath(); b.arc(x, y, 2.4, 0, 7); b.fill(); }
      for (let i = 1; i < 8; i++) { if (i === 4) continue; const [x1, y1] = T(-0.034, i / 4), [x2, y2] = T(1.034, i / 4); dia(b, x1, y1); dia(b, x2, y2); }
      for (let i = 1; i < 4; i++) { const [x1, y1] = T(i / 4, -0.034), [x2, y2] = T(i / 4, P.H + 0.034); dia(b, x1, y1); dia(b, x2, y2); }
      [[18, 18], [cw - 18, 18], [18, ch - 18], [cw - 18, ch - 18]].forEach(([x, y]) => bolt(b, x, y));
      P.POCKETS.forEach((pk) => { const [x, y] = T(pk.x, pk.y); pocket(b, x, y, pk.r * V.s * 0.98); });
      return c;
    }
    function pocketScale(x, y) {
      let sc = 1;
      for (let i = 0; i < P.POCKETS.length; i++) {
        const pk = P.POCKETS[i], dx = x - pk.x, dy = y - pk.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < pk.r) sc = Math.min(sc, 0.32 + 0.68 * (d / pk.r));
      }
      return sc;
    }
    function drawBall(id, x, y) {
      const sc = pocketScale(x, y), d = P.R * 2 * V.s * sc, [cx, cy] = T(x, y);
      g.drawImage(sprite(id), cx - d / 2, cy - d / 2, d, d);
    }
    function arrow(x1, y1, x2, y2, color, width) {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (len < 8) return;
      const ux = dx / len, uy = dy / len;
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(8,4,16,.75)'; g.lineWidth = width + 2.4;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = color; g.lineWidth = width;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const ah = Math.max(9, width * 3.4), bx = x2 - ux * ah, by = y2 - uy * ah, px = -uy * ah * 0.42, py = ux * ah * 0.42;
      g.fillStyle = color; g.beginPath(); g.moveTo(x2, y2); g.lineTo(bx + px, by + py); g.lineTo(bx - px, by - py); g.closePath(); g.fill();
      g.lineCap = 'butt';
    }
    function paintPower() {
      const fill = host.querySelector('.pl-power-fill'), knob = host.querySelector('.pl-power-knob'), lab = host.querySelector('.pl-power-lab'), bar = host.querySelector('.pl-power');
      const pct = Math.round((V.pull || V.power || 0) * 100);
      if (fill) fill.style.height = pct + '%';
      if (knob) knob.style.bottom = pct <= 0 ? '4px' : `calc(${pct}% - 16px)`;
      if (lab) lab.textContent = pct > 3 ? pct + '%' : 'Pull';
      if (bar) bar.setAttribute('aria-valuenow', String(pct));
    }
    function draw(frame) {
      if (!cv.isConnected) return;
      if (!V.bg) V.bg = background();
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(V.bg, 0, 0);
      g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
      const pos = frame || V.balls.map((b) => (b.on ? [b.x, b.y] : null));
      g.fillStyle = 'rgba(0,0,0,.4)';
      pos.forEach((p) => { if (!p) return; const [x, y] = T(p[0], p[1]); g.beginPath(); g.ellipse(x + 1.6, y + 2.4, P.R * V.s * 0.95, P.R * V.s * 0.68, 0, 0, 7); g.fill(); });
      if (!frame && V.canShoot && V.balls[0] && V.balls[0].on) {
        const c = V.balls[0], a = V.aim, info = P.aimInfo(V.balls, a.x, a.y);
        const [cx, cy] = T(c.x, c.y);
        const back = (0.028 + V.pull * 0.18) * V.s, len = 0.72 * V.s;
        const [ax, ay] = T(c.x + a.x, c.y + a.y); let ux = ax - cx, uy = ay - cy; const un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un;
        const sx = cx - ux * (P.R * V.s + 3 + back), sy = cy - uy * (P.R * V.s + 3 + back);
        const grad = g.createLinearGradient(sx, sy, sx - ux * len, sy - uy * len);
        grad.addColorStop(0, '#f3e2b0'); grad.addColorStop(0.045, '#1c1c1c'); grad.addColorStop(0.07, '#f7f4ee'); grad.addColorStop(0.5, '#e2c48a'); grad.addColorStop(1, '#6a3b1c');
        g.strokeStyle = grad; g.lineCap = 'round'; g.lineWidth = Math.max(5, P.R * V.s * 0.62);
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - ux * len, sy - uy * len); g.stroke(); g.lineCap = 'butt';
        g.setLineDash([6, 5]); g.lineWidth = 2.25;
        if (info.ghost) {
          const [gx, gy] = T(info.ghost.x, info.ghost.y);
          const [ex, ey] = T(c.x + a.x * P.R * 1.15, c.y + a.y * P.R * 1.15);
          g.strokeStyle = 'rgba(10,6,20,.7)'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(ex, ey); g.lineTo(gx, gy); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.25; g.beginPath(); g.moveTo(ex, ey); g.lineTo(gx, gy); g.stroke();
          g.setLineDash([]);
          g.fillStyle = 'rgba(255,255,255,.14)'; g.strokeStyle = '#fff'; g.lineWidth = 2;
          g.beginPath(); g.arc(gx, gy, P.R * V.s, 0, 7); g.fill(); g.stroke();
          const ob = info.ball;
          const objRay = P.rayHit(V.balls, ob.x, ob.y, info.obj.x, info.obj.y, [0, ob.id]);
          let ox = objRay.x, oy = objRay.y;
          if (objRay.ball) { ox -= info.obj.x * P.R; oy -= info.obj.y * P.R; }
          const [osx, osy] = T(ob.x + info.obj.x * P.R * 1.2, ob.y + info.obj.y * P.R * 1.2);
          const [oex, oey] = T(ox, oy);
          arrow(osx, osy, oex, oey, '#ffc83d', 3);
          if (Math.hypot(info.cue.x, info.cue.y) > 0.08) {
            const cueRay = P.rayHit(V.balls, info.ghost.x, info.ghost.y, info.cue.x, info.cue.y, [ob.id]);
            let qx = cueRay.x, qy = cueRay.y;
            if (cueRay.ball) { qx -= info.cue.x * P.R; qy -= info.cue.y * P.R; }
            const [csx, csy] = T(info.ghost.x + info.cue.x * P.R * 1.15, info.ghost.y + info.cue.y * P.R * 1.15);
            const [cex, cey] = T(qx, qy);
            arrow(csx, csy, cex, cey, '#e7d4ff', 2.6);
          }
          const px = -info.obj.y, py = info.obj.x;
          let [bx, by] = T(ob.x + px * 0.075, ob.y + py * 0.075);
          const mw = cv.width / V.dpr, mh = cv.height / V.dpr;
          bx = Math.max(22, Math.min(mw - 22, bx)); by = Math.max(22, Math.min(mh - 22, by));
          g.beginPath(); g.arc(bx, by, 20, 0, 7); g.fillStyle = 'rgba(14,8,28,.8)'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#ffc83d'; g.stroke();
          g.drawImage(sprite(ob.id), bx - 16, by - 16, 32, 32);
        } else if (info.wall) {
          const [ex, ey] = T(c.x + a.x * P.R * 1.15, c.y + a.y * P.R * 1.15);
          const [wx, wy] = T(info.wall.x, info.wall.y);
          g.strokeStyle = 'rgba(10,6,20,.7)'; g.lineWidth = 4.5; g.beginPath(); g.moveTo(ex, ey); g.lineTo(wx, wy); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.25; g.beginPath(); g.moveTo(ex, ey); g.lineTo(wx, wy); g.stroke();
          g.setLineDash([]);
          const [rx, ry] = T(info.wall.x + info.refl.x * 0.28, info.wall.y + info.refl.y * 0.28);
          arrow(wx, wy, rx, ry, 'rgba(255,255,255,.85)', 2.4);
        }
        g.setLineDash([]);
      }
      pos.forEach((p, id) => { if (p) drawBall(id, p[0], p[1]); });
      if (V.call >= 0) { const pk = P.POCKETS[V.call]; const [x, y] = T(pk.x, pk.y); g.strokeStyle = '#ffc83d'; g.lineWidth = 3; g.shadowColor = '#ffc83d'; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, pk.r * V.s, 0, 7); g.stroke(); g.shadowBlur = 0; }
      if (!frame && V.callMode) P.POCKETS.forEach((pk, i) => { if (i === V.call) return; const [x, y] = T(pk.x, pk.y); g.strokeStyle = 'rgba(255,230,170,.8)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, pk.r * V.s + 3, 0, 7); g.stroke(); g.setLineDash([]); });
      if (!frame && V.placing && V.balls[0] && V.balls[0].on) {
        const [x, y] = T(V.balls[0].x, V.balls[0].y);
        g.strokeStyle = '#ffc83d'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(x, y, 32, 0, 7); g.stroke(); g.setLineDash([]);
        const label = V.kitchen ? 'Drag the cue ball behind the line' : 'Drag the cue ball';
        const maxW = cv.width / V.dpr - 14; let fs = 13; // narrow phone tables: shrink the hint so it fits inside the rails
        do { g.font = `700 ${fs}px "Space Grotesk", system-ui, sans-serif`; } while (g.measureText(label).width > maxW && --fs >= 10);
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const lx = cv.width / V.dpr / 2, ly = Math.min(cv.height / V.dpr - 18, Math.max(18, y + 46));
        g.lineWidth = 3; g.strokeStyle = '#140a24'; g.strokeText(label, lx, ly, maxW); g.fillStyle = '#fff6d4'; g.fillText(label, lx, ly, maxW);
      }
      paintPower();
    }
    function play(frames, done) {
      cancelAnimationFrame(V.raf); let i = 0; const t0 = performance.now(); V.anim = true;
      const step = (now) => {
        if (!cv.isConnected) { V.anim = false; return; }
        i = Math.min(frames.length - 1, Math.floor((now - t0) / (1000 / 60)));
        draw(frames[i]);
        if (i < frames.length - 1) V.raf = requestAnimationFrame(step);
        else { V.anim = false; done && done(); }
      };
      V.raf = requestAnimationFrame(step);
    }
    // Ease from the simulated end onto the authoritative balls when a foul moved the cue ball.
    function ease(balls, done) {
      const from = V.balls.map((b) => (b.on ? [b.x, b.y] : null));
      const to = balls.map((b) => (b && b.on ? [b.x, b.y] : null));
      const same = from.length === to.length && from.every((p, i) => (!p && !to[i]) || (p && to[i] && Math.abs(p[0] - to[i][0]) < 0.002 && Math.abs(p[1] - to[i][1]) < 0.002));
      if (same) { V.balls = balls; V.anim = false; done && done(); return; }
      cancelAnimationFrame(V.raf); const t0 = performance.now(); V.anim = true;
      const step = (now) => {
        if (!cv.isConnected) return;
        const u = Math.min(1, (now - t0) / 200);
        const frame = to.map((p, i) => {
          if (!p) return null;
          const a = from[i] || p;
          return [a[0] + (p[0] - a[0]) * u, a[1] + (p[1] - a[1]) * u];
        });
        draw(frame);
        if (u < 1) V.raf = requestAnimationFrame(step);
        else { V.balls = balls; V.anim = false; done && done(); }
      };
      V.raf = requestAnimationFrame(step);
    }
    let dragging = null;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: Tinv(e.clientX - r.left, e.clientY - r.top) }; };
    cv.addEventListener('pointerdown', (e) => {
      if (!V.canShoot || V.anim || !V.balls[0]) return;
      const p = pt(e), [x, y] = p.t;
      if (V.callMode) {
        let best = -1, bd = 0.12;
        P.POCKETS.forEach((pk, i) => { const d = Math.hypot(pk.x - x, pk.y - y); if (d < bd) { bd = d; best = i; } });
        if (best >= 0) { V.call = best; opts.onCall && opts.onCall(best); ui.sfx.play('tap'); draw(); return; }
      }
      const [bx, by] = T(V.balls[0].x, V.balls[0].y);
      dragging = V.placing && Math.hypot(p.x - bx, p.y - by) < 36 ? 'cue' : 'aim';
      try { cv.setPointerCapture(e.pointerId); } catch { /* already gone */ }
      move(x, y);
    });
    const move = (x, y) => {
      const c = V.balls[0]; if (!c) return;
      if (dragging === 'cue') { if (P.canPlace(V.balls, x, y, V.kitchen)) { c.x = x; c.y = y; } }
      else if (dragging === 'aim') { const dx = x - c.x, dy = y - c.y, n = Math.hypot(dx, dy); if (n > 0.02) V.aim = { x: dx / n, y: dy / n }; }
      draw();
    };
    cv.addEventListener('pointermove', (e) => { if (!dragging) return; const [x, y] = pt(e).t; move(x, y); });
    const endDrag = () => { dragging = null; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
    function nudge(rad) {
      const a = Math.atan2(V.aim.y, V.aim.x) + rad;
      V.aim = { x: Math.cos(a), y: Math.sin(a) }; draw();
    }
    let rep = 0;
    const stopNudge = () => { clearInterval(rep); rep = 0; };
    host.querySelectorAll('.pl-nudge').forEach((btn) => {
      const dir = btn.id === 'pl-aim-l' ? -1 : 1;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); if (!V.canShoot || V.anim) return;
        nudge(dir * 0.01); stopNudge(); rep = setInterval(() => nudge(dir * 0.01), 55);
      });
      btn.addEventListener('pointerup', stopNudge); btn.addEventListener('pointercancel', stopNudge); btn.addEventListener('pointerleave', stopNudge);
    });
    const wheel = host.querySelector('.pl-wheel');
    let wheelX = null;
    wheel.addEventListener('pointerdown', (e) => { if (!V.canShoot || V.anim) return; wheelX = e.clientX; try { wheel.setPointerCapture(e.pointerId); } catch { /* noop */ } });
    wheel.addEventListener('pointermove', (e) => { if (wheelX == null) return; nudge((e.clientX - wheelX) * 0.0024); wheelX = e.clientX; });
    wheel.addEventListener('pointerup', () => { wheelX = null; }); wheel.addEventListener('pointercancel', () => { wheelX = null; });
    const power = host.querySelector('.pl-power');
    let pullY = null;
    power.addEventListener('pointerdown', (e) => { if (!V.canShoot || V.anim) return; pullY = e.clientY; try { power.setPointerCapture(e.pointerId); } catch { /* noop */ } });
    power.addEventListener('pointermove', (e) => {
      if (pullY == null) return;
      const travel = Math.max(80, power.clientHeight * 0.72);
      V.pull = Math.max(0, Math.min(1, (e.clientY - pullY) / travel));
      draw();
    });
    const endPull = () => {
      if (pullY == null) return; pullY = null;
      const p = V.pull; V.pull = 0;
      if (p > 0.04) { V.power = p; shoot(); } else draw();
    };
    power.addEventListener('pointerup', endPull); power.addEventListener('pointercancel', endPull);
    const spin = host.querySelector('.pl-spin'), dot = host.querySelector('.pl-spin-dot');
    const setSpin = (x, y) => { const n = Math.hypot(x, y); if (n > 1) { x /= n; y /= n; } V.spin = { x, y }; dot.style.transform = `translate(${x * 22}px, ${y * 22}px)`; };
    let spinning = false;
    const spinAt = (e) => { const r = spin.getBoundingClientRect(); setSpin((e.clientX - r.left - r.width / 2) / (r.width / 2 - 10), (e.clientY - r.top - r.height / 2) / (r.height / 2 - 10)); };
    spin.addEventListener('pointerdown', (e) => { spinning = true; spinAt(e); try { spin.setPointerCapture(e.pointerId); } catch { /* noop */ } ui.sfx.play('tap'); });
    spin.addEventListener('pointermove', (e) => { if (spinning) spinAt(e); });
    spin.addEventListener('pointerup', () => { spinning = false; }); spin.addEventListener('pointercancel', () => { spinning = false; });
    spin.addEventListener('dblclick', () => setSpin(0, 0));
    function onKey(e) {
      if (!cv.isConnected || !V.canShoot || V.anim) return;
      if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-0.012); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(0.012); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); V.power = Math.min(1, (V.power || 0.4) + 0.06); paintPower(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); V.power = Math.max(0.08, (V.power || 0.4) - 0.06); paintPower(); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); V.power = V.power || 0.55; shoot(); }
    }
    window.addEventListener('keydown', onKey);
    const offPad = onSample((s) => {
      if (!cv.isConnected || !V.canShoot || V.anim || !s) return;
      if (Math.abs(s.lookX) > 0.2) nudge(s.lookX * 0.02);
      if (s.lookY < -0.35) { V.power = Math.min(1, (V.power || 0.4) + 0.02); paintPower(); }
      if (s.pressed && (s.pressed.gas || s.pressed.confirm)) { V.power = V.power || 0.55; shoot(); }
    });
    function shoot() {
      if (!V.canShoot || V.anim || !V.balls[0] || !V.balls[0].on) return;
      if (V.callMode && V.call < 0) { toast('Tap a pocket to call the 8 first'); return; }
      const sp = 0.25 + V.power * (P.MAX_SPEED - 0.25);
      const r6 = (v) => Math.round(v * 1e6) / 1e6;
      ui.sfx.play('capture');
      opts.onShoot({ vx: r6(V.aim.x * sp), vy: r6(V.aim.y * sp), follow: r6(-V.spin.y), side: r6(V.spin.x) }, { x: V.balls[0].x, y: V.balls[0].y });
      setSpin(0, 0); V.pull = 0; paintPower();
    }
    let layoutQueued = false;
    const queueLayout = () => {
      if (layoutQueued) return;
      layoutQueued = true;
      requestAnimationFrame(() => { layoutQueued = false; if (cv.isConnected) layout(); });
    };
    const ro = new ResizeObserver(() => queueLayout());
    const stage = host.closest('.pl-stage');
    if (stage && stage.parentElement) ro.observe(stage.parentElement);
    const onResize = () => { V.key = ''; queueLayout(); };
    window.addEventListener('resize', onResize);
    logo.onload = () => { V.bg = null; draw(); };
    layout();
    const api = {
      V, draw, play, ease, layout,
      set(balls, o = {}) {
        V.balls = balls; Object.assign(V, o);
        if (!V.canShoot) V.pull = 0;
        host.querySelector('.pl-ctrl').classList.toggle('off', !V.canShoot);
        const side = host.querySelector('.pl-side');
        if (side) side.classList.toggle('off', !V.canShoot);
        draw();
      },
      hint(t) { const h = host.querySelector('#pl-hint'); if (h) h.textContent = t; },
      aimAt(x, y) { const c = V.balls[0]; if (!c) return; const dx = x - c.x, dy = y - c.y, n = Math.hypot(dx, dy) || 1; V.aim = { x: dx / n, y: dy / n }; draw(); },
      stop() { offPad(); ro.disconnect(); window.removeEventListener('resize', onResize); window.removeEventListener('keydown', onKey); stopNudge(); cancelAnimationFrame(V.raf); V.anim = false; }
    };
    return api;
  }

  const groupLabel = (gname) => (gname === 'solid' ? 'Solids' : gname === 'stripe' ? 'Stripes' : '');
  function rackRow(balls, gname) {
    const ids = gname === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : gname === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [];
    return ids.map((id) => `<i class="pl-mini ${balls[id] && balls[id].on ? '' : 'gone'} ${id > 8 ? 'st' : ''}" style="--bc:${ballColor(id)}">${id}</i>`).join('');
  }
  function rackSig(balls, gname) {
    if (!gname) return 'open';
    const ids = gname === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
    return gname + ':' + ids.map((id) => (balls[id] && balls[id].on ? '1' : '0')).join('');
  }
  function paintPlayers(ps, st, turn, balls, timer, done) {
    const parent = $('#g-players'); if (!parent) return;
    syncPlates(parent, ps.map((p, i) => {
      const on = !done && turn === i;
      const gname = st.groups[i];
      const bits = [{
        key: 'grp', className: 'pl-grp', sig: rackSig(balls, gname),
        html: gname ? `<b>${groupLabel(gname)}</b><span class="pl-rack">${rackRow(balls, gname)}</span>` : '<span class="pl-open">Open table</span>'
      }];
      if (on && timer != null) bits.push({ key: 'tm', className: 'g-timer' + (timer <= 10 ? ' low' : ''), text: timer + 's' });
      return { key: 'p' + i, className: 'g-pl' + (on ? ' on' : ''), side: String(i), person: p, bits };
    }), { sep: true });
  }
  function statusLine(st, seat, mine, left, otherName) {
    const grp = groupLabel(st.groups[seat]);
    const who = mine ? 'Your shot' : `${otherName}’s shot`;
    const urgent = mine && left != null && left <= 10 ? ` · ${left}s` : '';
    const msg = st.msg ? String(st.msg).trim() : '';
    return [msg, who + (grp ? ` · ${grp}` : ' · open table') + urgent].filter(Boolean).join(' ');
  }
  function shell(title, back) {
    ui.shell(esc(title), `<div class="g-players pl-players" id="g-players"></div><div class="g-status" id="g-status" aria-live="polite"></div>
      <div class="g-stage pl-stage"><div class="g-fx"></div><div id="pl-table"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
    document.body.classList.add('pool-mode');
    setTimeout(() => { const el = document.getElementById('g-players'); if (el && window.innerWidth < 600) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 8) }); }, 60);
    S.unsubs.push(() => document.body.classList.remove('pool-mode'));
  }
  function turnHint(st, seat, balls, mine) {
    const keys = window.matchMedia('(pointer: fine)').matches ? ' Arrow keys nudge. Space shoots.' : '';
    if (!mine) return '';
    if (P.needsCall(st, seat, balls)) return 'On the 8: tap the pocket you want. The gold ring marks it. Then pull the side bar to shoot.';
    if (st.bih && st.brk) return 'Break: drag the cue ball behind the line, then pull the side bar down and let go.' + keys;
    if (st.bih) return 'Ball in hand: drag the cue ball anywhere it fits, then pull the side bar to shoot.';
    return 'Drag on the table to aim. Gold line is the object ball, purple is the cue ball. Use Fine aim for small changes. Pull the side bar down and let go to shoot.' + keys;
  }

  let killLocal = () => {};
  function local(params) {
    killLocal();
    const lvl = normLevel(params.lvl);
    const pal = palByLevel(lvl);
    shell('Star Pool', '#/games/pool');
    ui.wireEmotes(main, '', () => '');
    const human = Math.random() < 0.5 ? 0 : 1;
    const me = { uid: ui.myUid(), name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const cpu = { uid: 'cpu1', name: pal.name, bot: true };
    const ps = human === 0 ? [me, cpu] : [cpu, me];
    let balls = P.decode(P.rack()), st = P.newState(), turn = 0, alive = true, over = false, stamp = Date.now(), shown = -2, cpuT = 0;
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="pl-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/pool">Leave</a>`;
    $('#pl-new').onclick = () => local(params);
    const table = mountTable($('#pl-table'), { onShoot: (shot, cuePos) => take(shot, cuePos), onCall: (p) => { st.call = p; } });
    const tick = setInterval(() => {
      if (!alive || over || !$('#g-players')) return;
      const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - stamp) / 1000));
      const el = document.querySelector('#g-players .g-pl.on .g-timer');
      if (el) { el.textContent = left + 's'; el.classList.toggle('low', left <= 10); }
      if (left === 0 && turn === human && table.V.canShoot && !table.V.anim) {
        st = { ...st, groups: [...st.groups], foul: true, bih: true, msg: "Time's up. Ball in hand." };
        turn = 1 - turn; refresh();
      }
    }, 250);
    killLocal = () => { alive = false; clearInterval(tick); clearTimeout(cpuT); table.stop(); };
    S.unsubs.push(killLocal);
    function refresh() {
      if (!alive) return;
      if (turn !== shown) { shown = turn; stamp = Date.now(); }
      const mine = turn === human && !over;
      const left = Math.max(0, TURN_SECONDS - Math.floor((Date.now() - stamp) / 1000));
      paintPlayers(ps, st, turn, balls, over ? null : left, over);
      const status = $('#g-status');
      status.textContent = over ? (st.msg || '') : statusLine(st, turn, mine, left, pal.name);
      status.className = 'g-status' + (over ? '' : st.foul ? ' foul' : mine ? ' you' : ' wait');
      const callMode = mine && P.needsCall(st, turn, balls);
      table.set(balls, { canShoot: mine, placing: mine && st.bih, kitchen: st.brk, callMode, call: callMode ? st.call : -1 });
      table.hint(turnHint(st, turn, balls, mine));
      if (mine && !st.bih && !st.brk) { /* keep aim */ } else if (mine && st.brk) table.aimAt(balls[1].x, balls[1].y);
      if (!over && turn !== human && !lining) { lining = true; cpuTurn(); }
    }
    function take(shot, cuePos) {
      const before = balls.map((b) => ({ ...b }));
      if (cuePos) { before[0].x = cuePos.x; before[0].y = cuePos.y; before[0].on = true; }
      const start = P.decode(P.encode(before));
      const r = P.simulate(start, shot);
      table.set(start, { canShoot: false, placing: false, callMode: false });
      table.play(r.frames, () => {
        if (!alive) return;
        const j = P.judge(st, turn, start, r.balls, r.events);
        balls = P.decode(P.encode(j.balls)); st = j.st;
        if (r.events.pocketed.length) ui.sfx.play('drop');
        if (j.winner >= 0) {
          over = true; refresh();
          const win = j.winner === human; ui.addCpuResult('pool', win ? 'w' : 'l');
          ui.resultModal({ title: win ? 'You win!' : `${pal.name} wins`, sub: st.msg, win, vsBot: true, buttons: [{ label: 'Play again', onClick: () => local(params) }, { label: 'Back to games', href: '#/games' }] });
          return;
        }
        turn = j.next; refresh();
      });
    }
    let lining = false;
    async function cpuTurn() {
      if (!alive || over || turn === human) { lining = false; return; }
      const shot = await ask({ kind: 'pool', st, seat: turn, balls: balls.map((b) => ({ ...b })), level: lvl });
      lining = false;
      if (!alive || over || turn === human || !shot) return;
      if (shot.call >= 0 || P.needsCall(st, turn, balls)) st.call = shot.call >= 0 ? shot.call : 0;
      if (shot.place) { balls[0] = { ...balls[0], x: shot.place.x, y: shot.place.y, on: true }; }
      table.set(balls, { canShoot: false, call: st.call });
      const n = Math.hypot(shot.vx, shot.vy) || 1;
      table.V.aim = { x: shot.vx / n, y: shot.vy / n }; table.V.canShoot = true; table.V.pull = Math.min(1, n / P.MAX_SPEED); table.draw(); table.V.canShoot = false;
      cpuT = setTimeout(() => { if (alive) { ui.sfx.play('capture'); take(shot, null); } }, 650);
    }
    refresh();
  }

  async function online(g0, token) {
    const gid = g0.id;
    let g = g0, serverG = g0, ended = false, stopHb = null, claimT = 0, lastMove = g0.moveNo, playing = false, iEnded = false, joinTried = false, pendingNo = null;
    shell('Star Pool', '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    ui.wireEmotes(main, gid, names);
    const mySide = () => g.players.indexOf(ui.myUid());
    const stOf = () => { try { return JSON.parse(g.ps || '{}'); } catch { return P.newState(); } };
    let localCall = -1;
    const table = mountTable($('#pl-table'), { onShoot: (shot, cuePos) => shootOnline(shot, cuePos), onCall: (p) => { localCall = p; } });
    const tick = setInterval(() => header(), 1000);
    S.unsubs.push(() => { clearInterval(tick); clearTimeout(claimT); if (stopHb) stopHb(); table.stop(); });
    function header() {
      if (!$('#g-players')) return;
      const st = stOf(), balls = P.decode(g.pos), side = mySide(), done = g.status !== 'active';
      const ps = g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
      while (ps.length < 2) ps.push({ uid: '', name: 'Waiting…' });
      const left = g.status === 'active' ? net.turnLeft(g.turnAt) : null;
      paintPlayers(ps, st, g.turn, balls, left, done);
      const status = $('#g-status');
      if (g.status === 'waiting') { status.textContent = side === 0 ? (g.invitee ? 'Waiting for your friend…' : g.quick ? 'Looking for an opponent…' : 'Share the link so a friend can join') : 'Waiting for players'; status.className = 'g-status wait'; }
      else if (g.status === 'done') { status.textContent = g.endReason === 'cancelled' ? 'Cancelled' : `${names(g.winnerUid)} wins${g.endReason === 'forfeit' ? ' (forfeit)' : g.endReason === 'timeout' ? ' (time ran out)' : ''}`; status.className = 'g-status'; }
      else { status.textContent = statusLine(st, g.turn, side === g.turn, left, g.names[g.turn] || 'Opponent'); status.className = 'g-status' + (st.foul ? ' foul' : side === g.turn ? ' you' : ' wait'); }
    }
    let syncKey = '';
    function sync() {
      const key = `${g.moveNo}|${g.status}|${g.players.length}|${playing}`;
      if (key === syncKey) { header(); actions(); return; }
      syncKey = key;
      const st = stOf(), balls = P.decode(g.pos), side = mySide();
      const mine = g.status === 'active' && side === g.turn && !playing;
      const callMode = mine && P.needsCall(st, side, balls);
      table.set(balls, { canShoot: mine, placing: mine && st.bih, kitchen: st.brk, callMode, call: callMode ? localCall : -1 });
      table.hint(g.status === 'active' ? turnHint(st, side, balls, mine) : '');
      const ctl = document.querySelector('.pl-ctrl'); if (ctl) ctl.style.display = side < 0 ? 'none' : '';
      const sideEl = document.querySelector('.pl-side'); if (sideEl) sideEl.style.display = side < 0 ? 'none' : '';
      if (mine && st.brk) table.aimAt(balls[1].x, balls[1].y);
      header(); actions();
    }
    function settle(simBalls, done) {
      const end = () => { playing = false; pendingNo = null; localCall = -1; syncKey = ''; sync(); if (g.status === 'done') onEnd(); done && done(); };
      if (P.encode(simBalls) === g.pos) end();
      else table.ease(P.decode(g.pos), end);
    }
    async function shootOnline(shot, cuePos) {
      if (pendingNo != null || playing) return;
      const st = stOf(), side = mySide();
      if (g.status !== 'active' || side !== g.turn) return;
      const before = P.decode(g.pos);
      if (st.bih && cuePos) { before[0].x = cuePos.x; before[0].y = cuePos.y; before[0].on = true; }
      const start = P.decode(P.encode(before));
      const s0 = { ...st, call: P.needsCall(st, side, start) ? localCall : -1 };
      const r = P.simulate(start, shot);
      const j = P.judge(s0, side, start, r.balls, r.events);
      const pos = P.encode(j.balls);
      const expect = g.moveNo || 0;
      const upd = { pos, ps: JSON.stringify(j.st), shot: { ...shot, from: P.encode(start), by: side }, turn: j.next, moveNo: expect + 1, turnAt: net.fs.serverTimestamp() };
      if (j.winner >= 0) Object.assign(upd, { status: 'done', winnerUid: g.players[j.winner], endReason: j.winner === side ? 'win' : 'loss' });
      playing = true; pendingNo = upd.moveNo; lastMove = upd.moveNo;
      g = { ...g, ...upd, turnAt: { toMillis: () => Date.now() } };
      table.set(start, { canShoot: false, placing: false, callMode: false });
      syncKey = '';
      const wp = net.commitMove(gid, expect, upd).then(() => { if (j.winner >= 0) iEnded = true; }, (e) => {
        pendingNo = null; iEnded = false; g = serverG; lastMove = serverG.moveNo || 0;
        console.warn('pool: shot rejected', e.code || e.message);
        toast(e && e.code === 'stale' ? 'That shot already happened.' : friendlyError(e));
      });
      table.play(r.frames, () => {
        if (r.events.pocketed.length) ui.sfx.play('drop');
        wp.finally(() => settle(j.balls));
      });
    }
    function replay() {
      const sh = g.shot; if (!sh || !sh.from) { sync(); return; }
      playing = true; syncKey = '';
      const r = P.simulate(P.decode(sh.from), sh);
      table.set(P.decode(sh.from), { canShoot: false, placing: false, callMode: false });
      ui.sfx.play('capture');
      table.play(r.frames, () => {
        if (r.events.pocketed.length) ui.sfx.play('drop');
        const simSum = P.encode(r.balls);
        if (simSum === g.pos) { playing = false; syncKey = ''; sync(); if (g.status === 'done') onEnd(); }
        else table.ease(P.decode(g.pos), () => { playing = false; syncKey = ''; sync(); if (g.status === 'done') onEnd(); });
      });
    }
    function actions() {
      const box = $('#g-actions'); if (!box) return;
      const side = mySide();
      if (g.status === 'waiting') {
        const offer = side === 0 && !g.invitee && g.players.length < 2 && whenOffer(gid, () => actions());
        box.innerHTML = `${side === 0 ? '<button class="btn btn-sm btn-ghost" id="g-share">Copy invite link</button><button class="btn btn-sm btn-ghost" id="g-cancel">Cancel</button>' : ''}${!ui.signedIn() ? `<a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to play</a>` : ''}${offer ? offerHtml() : ''}`;
      }
      else if (g.status === 'active') box.innerHTML = side >= 0 ? '<button class="btn btn-sm btn-danger" id="g-forfeit">Forfeit</button><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>' : '<span class="muted small">You’re watching</span><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>';
      else box.innerHTML = `${side >= 0 && g.endReason !== 'cancelled' ? (g.rematch ? `<a class="btn btn-sm" href="#/game/${esc(g.rematch)}">Go to rematch</a>` : '<button class="btn btn-sm" id="g-rematch">Rematch</button>') : ''}<a class="btn btn-sm btn-ghost" href="#/games">Games</a>`;
      const sh = $('#g-share'); if (sh) sh.onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const cn = $('#g-cancel'); if (cn) cn.onclick = async () => { try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('pool', '', gid); location.hash = '#/games'; } catch (e) { toast(friendlyError(e)); } };
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = async () => { stopOffer(gid); try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('pool', '', gid); } catch { /* already gone */ } location.hash = `#/games/pool/cpu?lvl=${lastLevel()}`; };
      const ff = $('#g-forfeit'); if (ff) ff.onclick = () => { if (confirm('Forfeit this game? It counts as a loss.')) net.update(gid, { status: 'done', winnerUid: g.players[1 - mySide()], endReason: 'forfeit' }).catch((e) => toast(friendlyError(e))); };
      const rm = $('#g-rematch'); if (rm) rm.onclick = async () => {
        rm.disabled = true;
        try { const other = g.players[1 - side]; const nid = await net.createGame('pool', '', { invitee: other, from: gid }); await net.update(gid, { rematch: nid }); net.invite(other, nid, 'Star Pool rematch').catch(() => {}); location.hash = '#/game/' + nid; }
        catch (e) { toast(friendlyError(e)); rm.disabled = false; }
      };
    }
    function onEnd() {
      if (ended || playing) return; ended = true;
      if (stopHb) { stopHb(); stopHb = null; }
      if (g.endReason === 'cancelled') return;
      const side = mySide();
      const botGame = onlyBots(g.players, ui.myUid());
      if (side >= 0 && !botGame) setTimeout(() => net.recordResult(g, iEnded || g.endReason !== 'win'), iEnded ? 0 : 2500);
      if (side >= 0 && botGame) ui.addCpuResult('pool', g.winnerUid === ui.myUid() ? 'w' : 'l');
      const win = side >= 0 && g.winnerUid === ui.myUid();
      ui.resultModal({ title: side < 0 ? `${names(g.winnerUid)} wins` : win ? 'You win!' : 'You lost', sub: g.endReason === 'forfeit' ? 'Forfeit.' : g.endReason === 'timeout' ? 'Time ran out.' : stOf().msg, win, vsBot: botGame,
        buttons: side >= 0 ? [{ label: 'Rematch', onClick: () => $('#g-rematch')?.click() }, { label: 'Back to games', href: '#/games' }] : [{ label: 'Back to games', href: '#/games' }] });
    }
    function scheduleClaim() {
      clearTimeout(claimT);
      const side = mySide();
      if (g.status !== 'active' || side < 0 || g.turn === side) return;
      const other = g.players[1 - side];
      const tTurn = (tsMs(g.turnAt) || net.serverNow()) + (TURN_SECONDS + 6) * 1000 - net.serverNow();
      const hb = g.hb && g.hb[other] ? tsMs(g.hb[other]) : 0;
      const tHb = hb ? hb + 48000 - Date.now() : Infinity;
      claimT = setTimeout(() => net.update(gid, { status: 'done', winnerUid: ui.myUid(), endReason: 'timeout' }).catch(() => {}), Math.max(1500, Math.min(tTurn, tHb)));
    }
    let first = true;
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This game was removed. <a href="#/games">Games</a></div>'; return; }
      serverG = ng;
      const rec = net.reconcile(ng.moveNo, pendingNo);
      if (!rec.take) { header(); scheduleClaim(); return; }
      const prevMove = g.moveNo; g = ng; pendingNo = rec.pending;
      if (g.status === 'active' && mySide() >= 0 && !stopHb) stopHb = net.heartbeat(gid);
      if (g.status === 'active' && first === false && g.moveNo === 0) net.leaveQueue('pool', '', gid);
      if (g.status === 'waiting' && ui.signedIn() && mySide() < 0 && !joinTried && (!g.invitee || g.invitee === ui.myUid())) { joinTried = true; net.join(gid).catch((e) => toast(friendlyError(e))); }
      if (!first && g.moveNo > lastMove && !playing && g.shot && g.shot.by !== mySide()) { lastMove = g.moveNo; replay(); }
      else if (!playing) { lastMove = g.moveNo; sync(); }
      else header();
      first = false;
      scheduleClaim();
      if (g.status === 'done' && !playing) onEnd();
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }
  return { local, online };
}
