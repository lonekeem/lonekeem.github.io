// Kemy's Bubble Quest - renderer (canvas 2D, vector art, crisp at any DPR)
import { T, tileAt, solidC, CR_T, lavaY, windOn, geyserH } from './sim.js?v=2';
import { drawKemy, drawStar, drawHeart, drawBubble, drawEnemy, drawCheck, drawGoal, drawPower, drawSwitch, drawGeyser, drawIcicle, drawPopper, drawShot, drawBoss, THEMES, starPath } from './art.js?v=2';
export const VW = 400, VH = 225;
const TAU = Math.PI * 2;
export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  const R = { scale: 1, ox: 0, oy: 0, dpr: 1, cam: { x: 0, y: 0, look: 0 }, parts: [], shake: 0, opts: { rm: false, hc: false } };
  R.resize = (cssW, cssH) => {
    R.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * R.dpr); canvas.height = Math.round(cssH * R.dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    R.scale = Math.min(cssW / VW, cssH / VH); R.ox = (cssW - VW * R.scale) / 2; R.oy = (cssH - VH * R.scale) / 2; R.cssW = cssW; R.cssH = cssH;
  };
  R.resetCam = (w, L) => { R.cam.x = Math.max(0, Math.min(L.w * T - VW, w.p.x - VW * 0.35)); R.cam.y = Math.max(0, Math.min(L.h * T - VH, w.p.y - VH * 0.55)); R.cam.look = 0; R.parts = []; };
  R.burst = (x, y, col, n = 8) => { if (R.opts.rm) n = Math.min(n, 3); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; R.parts.push({ x, y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4 - 0.5, life: 30, col }); } };
  R.update = (w, L) => {
    const p = w.p; const target = p.face * 44 + p.vx * 10;
    R.cam.look += (target - R.cam.look) * 0.04;
    let tx = p.x + p.w / 2 - VW / 2 + R.cam.look; let ty = p.y - VH * 0.55;
    const B = w.boss; if (B && B.act && B.hp > 0) { tx = Math.max(B.ax0 - 8, Math.min(B.ax1 + 8 - VW, tx)); } // keep the arena in view
    R.cam.x += (tx - R.cam.x) * 0.12; R.cam.y += (ty - R.cam.y) * (p.ground || p.water ? 0.08 : 0.04);
    R.cam.x = Math.max(0, Math.min(L.w * T - VW, R.cam.x)); R.cam.y = Math.max(0, Math.min(L.h * T - VH, R.cam.y));
    for (const q of R.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.05; q.life--; }
    R.parts = R.parts.filter((q) => q.life > 0); if (R.shake > 0) R.shake--;
  };
  // ---------------------------------------------------------------- backgrounds (one style per world)
  const px = (f) => -(R.cam.x * f) % 400;
  function ridge(fill, f, base, amp, n, fn) { c.fillStyle = fill; for (let k = -1; k < 3; k++) { const ox = px(f) + k * 400; c.beginPath(); c.moveTo(ox, VH); for (let i = 0; i <= n; i++) c.lineTo(ox + i * 400 / n, VH - base - fn(i) * amp); c.lineTo(ox + 400, VH); c.fill(); } }
  function puff(x, y, r) { c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.arc(x + r * 1.1, y + r * 0.2, r * 0.75, Math.PI, 0); c.arc(x - r * 1.05, y + r * 0.25, r * 0.7, Math.PI, 0); c.closePath(); c.fill(); }
  function bg(th, t) {
    const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    const rm = R.opts.rm, st = th.style;
    if (st === 'hills' || st === 'reef' || st === 'spires') {
      c.fillStyle = th.far;
      for (let k = -1; k < 3; k++) { const ox = px(0.15) + k * 400; c.beginPath(); c.moveTo(ox, VH);
        for (let i = 0; i <= 8; i++) c.lineTo(ox + i * 50, VH - 70 - Math.sin(i * 1.7) * 26 - (st === 'spires' ? (i % 2) * 40 : 0)); c.lineTo(ox + 400, VH); c.fill(); }
      c.fillStyle = th.near;
      for (let k = -1; k < 3; k++) { const ox = px(0.35) + k * 400; c.beginPath(); c.moveTo(ox, VH);
        for (let i = 0; i <= 10; i++) c.lineTo(ox + i * 40, VH - 34 - Math.cos(i * 2.3) * 16 - (st === 'spires' ? (i % 3 === 0) * 30 : 0)); c.lineTo(ox + 400, VH); c.fill(); }
    } else if (st === 'meadow') {
      c.fillStyle = 'rgba(255,240,170,.9)'; c.beginPath(); c.arc(330 - R.cam.x * 0.02 % 40, 42, 22, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(255,230,140,.6)'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + (rm ? 0 : t * 0.003); c.beginPath(); c.moveTo(330 + Math.cos(a) * 28, 42 + Math.sin(a) * 28); c.lineTo(330 + Math.cos(a) * 36, 42 + Math.sin(a) * 36); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 4; i++) puff(((i * 130 - R.cam.x * 0.08 + (rm ? 0 : t * 0.05)) % 520 + 520) % 520 - 60, 30 + (i % 2) * 22, 9);
      ridge(th.far, 0.15, 60, 22, 8, (i) => Math.sin(i * 1.3) * 0.5 + 0.8);
      ridge(th.near, 0.35, 26, 14, 10, (i) => Math.cos(i * 1.9) * 0.5 + 0.8);
      for (let i = 0; i < 16; i++) { const fx = ((i * 61 - R.cam.x * 0.35) % 420 + 420) % 420 - 10; const fy = VH - 22 - (i * 7) % 12; c.fillStyle = ['#fff', '#ffd34d', '#ff9fc8'][i % 3]; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(fx + Math.cos(k * 1.26) * 2, fy + Math.sin(k * 1.26) * 2, 1.4, 0, TAU); c.fill(); } }
    } else if (st === 'clouds') {
      for (let layer = 0; layer < 2; layer++) { c.fillStyle = layer ? th.near : th.far; const f = layer ? 0.35 : 0.12;
        for (let i = 0; i < 6; i++) puff(((i * 90 - R.cam.x * f + (rm ? 0 : t * (layer ? 0.08 : 0.03))) % 540 + 540) % 540 - 70, VH - 30 - layer * -18 - (i % 3) * 22 - (layer ? 0 : 50), 16 + (i % 2) * 8); }
      c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(0, VH - 14, VW, 14);
    } else if (st === 'peaks') {
      const peaks = (fill, cap, f, base, hgt) => { for (let k = -1; k < 3; k++) { const ox = px(f) + k * 400; for (let i = 0; i < 5; i++) { const x = ox + i * 90 + (i % 2) * 20, hh = hgt + (i * 37 % 30);
        c.fillStyle = fill; c.beginPath(); c.moveTo(x - 60, VH - base); c.lineTo(x, VH - base - hh); c.lineTo(x + 60, VH - base); c.fill();
        c.fillStyle = cap; c.beginPath(); c.moveTo(x - 18, VH - base - hh + 18 * hh / 60); c.lineTo(x, VH - base - hh); c.lineTo(x + 18, VH - base - hh + 18 * hh / 60); c.lineTo(x + 6, VH - base - hh + 22 * hh / 60); c.lineTo(x - 4, VH - base - hh + 16 * hh / 60); c.fill(); } } };
      peaks(th.far, '#f4fbff', 0.12, 40, 90); peaks(th.near, '#ffffff', 0.3, 0, 60);
    } else if (st === 'volcano') {
      const vx = 260 - (R.cam.x * 0.06) % 500; c.fillStyle = th.far; c.beginPath(); c.moveTo(vx - 150, VH); c.lineTo(vx - 30, VH - 130); c.lineTo(vx + 30, VH - 130); c.lineTo(vx + 150, VH); c.fill();
      const gl = c.createRadialGradient(vx, VH - 130, 4, vx, VH - 130, 70); gl.addColorStop(0, 'rgba(255,170,60,.8)'); gl.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = gl; c.fillRect(vx - 80, VH - 200, 160, 140);
      ridge(th.near, 0.35, 30, 20, 10, (i) => Math.abs(Math.sin(i * 1.7)));
    } else if (st === 'castle') {
      c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(300, 44, 18, 0, TAU); c.fill(); c.fillStyle = th.sky[0]; c.beginPath(); c.arc(308, 38, 15, 0, TAU); c.fill();
      for (let layer = 0; layer < 2; layer++) { c.fillStyle = layer ? th.near : th.far; const f = layer ? 0.35 : 0.15;
        for (let k = -1; k < 3; k++) { const ox = px(f) + k * 400; for (let i = 0; i < 4; i++) { const x = ox + i * 100 + layer * 40, w = 34, h = 70 + ((i * 53 + layer * 29) % 50) - layer * 24;
          c.fillRect(x, VH - h, w, h); for (let m = 0; m < 4; m++) c.fillRect(x + m * 9, VH - h - 6, 6, 6);
          c.beginPath(); c.moveTo(x - 4, VH - h - 6); c.lineTo(x + w / 2, VH - h - 34); c.lineTo(x + w + 4, VH - h - 6); c.fill();
          if (!layer) { c.fillStyle = 'rgba(255,220,120,.7)'; c.fillRect(x + 13, VH - h + 18, 7, 10); c.fillStyle = th.far; } } } }
    } else if (st === 'candy') {
      ridge(th.far, 0.15, 50, 26, 8, (i) => Math.sin(i * 1.2) * 0.5 + 0.7);
      for (let k = -1; k < 3; k++) { const ox = px(0.3) + k * 400; for (let i = 0; i < 4; i++) { const x = ox + i * 100 + 30, y = VH - 70 - (i % 2) * 20;
        c.fillStyle = '#fff'; c.fillRect(x - 1.5, y, 3, 70); c.fillStyle = ['#ff7fbf', '#7fdcff', '#ffd34d', '#9dff8a'][i]; c.beginPath(); c.arc(x, y, 14, 0, TAU); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); for (let a = 0; a < 12; a += 0.3) c.lineTo(x + Math.cos(a) * a * 1.1, y + Math.sin(a) * a * 1.1); c.stroke(); } }
      ridge(th.near, 0.4, 20, 12, 12, (i) => (i % 2 ? 1 : 0.4));
    }
    // floating sparkles / bubbles / snow / embers
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 97 - R.cam.x * 0.25) % 420 + 420) % 420 - 10; const sy = (i * 53) % 150 + 10 + (rm ? 0 : Math.sin(t * 0.02 + i) * 4);
      if (st === 'reef') drawBubble(c, sx, (sy - (rm ? 0 : t * 0.3) % 240 + 240) % 240, 1.5 + (i % 3));
      else if (st === 'peaks') { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc((sx + (rm ? 0 : Math.sin(t * 0.01 + i) * 10) + 420) % 420, (sy + (rm ? 0 : t * 0.4)) % 230, 1.2 + (i % 2), 0, TAU); c.fill(); }
      else if (st === 'volcano') { c.fillStyle = `rgba(255,${150 + (i % 3) * 30},60,${0.5 + (i % 2) * 0.3})`; c.beginPath(); c.arc(sx, ((sy - (rm ? 0 : t * 0.35)) % 230 + 230) % 230, 1.2, 0, TAU); c.fill(); }
      else if (st === 'meadow' || st === 'candy') { if (i % 3) continue; c.fillStyle = st === 'candy' ? GUMS[i % 4] : 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(sx, sy, 1.4, 0, TAU); c.fill(); }
      else { c.fillStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.15})`; starPath(c, sx, sy, 1.5 + (i % 2), 0.6); c.fill(); }
    }
  }
  const GUMS = ['#ff7fbf', '#7fdcff', '#ffd34d', '#9dff8a'];
  // ---------------------------------------------------------------- tiles
  const isBlock = (ch) => ch === '#' || ch === 'X' || ch === 'S' || ch === 'I' || ch === 'M' || ch === '<' || ch === '>' || ch === 'C';
  function tiles(L, th, w, t) {
    const x0 = Math.floor(R.cam.x / T), x1 = Math.ceil((R.cam.x + VW) / T), y0 = Math.floor(R.cam.y / T), y1 = Math.ceil((R.cam.y + VH) / T);
    const rm = R.opts.rm, hc = R.opts.hc;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(L, tx, ty); if (ch === '.' || ch === '~') continue; if (tx < 0 || tx >= L.w) continue;
      const x = tx * T, y = ty * T;
      if (ch === '#' || ch === 'X') {
        const above = tileAt(L, tx, ty - 1); const open = !isBlock(above) && above !== 'A' && above !== 'B';
        if (ch === '#') {
          c.fillStyle = (tx + ty) % 2 ? th.dirt : th.dirt2; c.fillRect(x, y, T, T);
          c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + ((tx * 7) % 10) + 2, y + ((ty * 5) % 10) + 3, 2, 2);
          if (th.style === 'candy') { c.fillStyle = GUMS[(tx * 3 + ty) % 4]; c.fillRect(x + ((tx * 5) % 11) + 2, y + ((ty * 7) % 9) + 5, 3, 1.5); }
          if (th.style === 'castle') { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + 7, T, 1); c.fillRect(x + ((ty % 2) ? 4 : 12), y, 1, 7); c.fillRect(x + ((ty % 2) ? 10 : 2), y + 8, 1, 8); }
          if (open) { c.fillStyle = th.top2; c.fillRect(x, y, T, 6); c.fillStyle = th.top; c.fillRect(x, y, T, 4);
            if (th.style === 'clouds') { c.beginPath(); c.arc(x + 4, y + 1, 4, Math.PI, 0); c.arc(x + 12, y + 1, 4, Math.PI, 0); c.fill(); }
            else if (th.style === 'candy') { for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(x + 4 + i * 8, y + 5, 2.6, 0, Math.PI); c.fill(); } }
            else for (let i = 0; i < 4; i++) c.fillRect(x + i * 4 + 1, y + 4, 2, 2 + ((tx + i) % 2));
            if (th.style === 'volcano' && (tx * 7) % 5 === 0) { c.fillStyle = '#ff8a3a'; c.fillRect(x + 6, y + 6, 4, 1.5); }
            if (th.style === 'meadow' && (tx * 11) % 7 === 0) { c.fillStyle = (tx % 2) ? '#fff' : '#ffd34d'; c.beginPath(); c.arc(x + 8, y - 2, 2, 0, TAU); c.fill(); c.fillStyle = '#5cbf4a'; c.fillRect(x + 7.5, y - 1, 1, 2); }
          }
        } else {
          c.fillStyle = th.block; c.fillRect(x, y, T, T); c.fillStyle = th.blockT; c.fillRect(x, y, T, 2); c.fillRect(x, y, 2, T);
          c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + T - 2, T, 2); c.fillRect(x + T - 2, y, 2, T);
          if (th.style === 'spires' && (tx * 3 + ty) % 5 === 0) { c.fillStyle = 'rgba(220,200,255,.7)'; c.beginPath(); c.moveTo(x + 5, y + 12); c.lineTo(x + 8, y + 4); c.lineTo(x + 11, y + 12); c.fill(); }
        }
      } else if (ch === 'I') {
        c.fillStyle = (tx + ty) % 2 ? '#a8dcfa' : '#b8e4fc'; c.fillRect(x, y, T, T);
        c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(x + 3, y + 13); c.lineTo(x + 9, y + 4); c.lineTo(x + 10.5, y + 4); c.lineTo(x + 4.5, y + 13); c.fill();
        if (!isBlock(tileAt(L, tx, ty - 1))) { c.fillStyle = '#f4fdff'; c.fillRect(x, y, T, 3); c.fillStyle = 'rgba(80,150,210,.5)'; c.fillRect(x, y + 3, T, 1); }
        c.fillStyle = 'rgba(40,90,150,.25)'; c.fillRect(x, y + T - 1, T, 1);
      } else if (ch === 'M') {
        const m = th.mush || ['#ff6f8f', '#c23a5e'], stem = th.stem || '#fff1dc';
        if (!isBlock(tileAt(L, tx, ty + 1))) { let yy = y + T; c.fillStyle = stem; for (let k = 1; k < 6 && !isBlock(tileAt(L, tx, ty + k)); k++) { c.fillRect(x + 4, yy - 2, 8, T + 2); yy += T; } }
        else { c.fillStyle = (tx + ty) % 2 ? th.dirt : th.dirt2; c.fillRect(x, y + 6, T, T - 6); }
        const left = tileAt(L, tx - 1, ty) !== 'M', right = tileAt(L, tx + 1, ty) !== 'M';
        c.fillStyle = m[0]; c.strokeStyle = m[1]; c.lineWidth = 1; c.beginPath(); c.roundRect(x - (left ? 1 : 0), y + 1, T + (left ? 1 : 0) + (right ? 1 : 0), 9, [left ? 6 : 0, right ? 6 : 0, 2, 2]); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x + 5 + (tx % 2) * 5, y + 4.5, 1.8, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 11 - (tx % 2) * 6, y + 7.5, 1.2, 0, TAU); c.fill();
      } else if (ch === '<' || ch === '>') {
        const d = ch === '>' ? 1 : -1; c.fillStyle = '#3a2f6e'; c.fillRect(x, y, T, T); c.fillStyle = '#5a4aa8'; c.fillRect(x, y, T, 5);
        c.fillStyle = hc ? '#ffe600' : '#ffd34d'; const off = rm ? 0 : ((t * 0.85 * d) % 8 + 8) % 8;
        for (let i = -1; i < 2; i++) { const ax = x + i * 8 + off; if (ax < x - 4 || ax > x + T - 2) continue; c.beginPath(); c.moveTo(ax + 4 - d * 2, y + 0.8); c.lineTo(ax + 4 + d * 1.5, y + 2.5); c.lineTo(ax + 4 - d * 2, y + 4.2); c.fill(); }
        c.fillStyle = '#9a8ae0'; for (let i = 0; i < 2; i++) { c.beginPath(); c.arc(x + 4 + i * 8, y + 10, 2.5, 0, TAU); c.fill(); }
      } else if (ch === 'C') {
        const st = w.cr[tx + ',' + ty] || 0; const col = th.crumb || [th.block, th.blockT];
        if (st > CR_T) { c.strokeStyle = 'rgba(255,255,255,.3)'; c.setLineDash([2, 3]); c.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); c.setLineDash([]); continue; }
        const sh = st && !rm ? Math.sin(t * 2.1 + tx) * 1.2 : 0; c.save(); c.translate(sh, st ? st * 0.08 : 0);
        c.fillStyle = col[0]; c.strokeStyle = col[1]; c.lineWidth = 1;
        if (th.style === 'clouds') { c.beginPath(); c.arc(x + 5, y + 8, 5.5, 0, TAU); c.arc(x + 11, y + 8, 5.5, 0, TAU); c.fill(); c.beginPath(); c.arc(x + 8, y + 5, 5, 0, TAU); c.fill(); c.stroke(); c.fillStyle = col[0]; c.fillRect(x + 2, y + 6, 12, 6); }
        else { c.beginPath(); c.roundRect(x + 0.5, y + 0.5, T - 1, T - 1, 3); c.fill(); c.stroke(); }
        if (st || hc) { c.strokeStyle = hc ? '#000' : col[1]; c.beginPath(); c.moveTo(x + 4, y + 2); c.lineTo(x + 7, y + 8); c.lineTo(x + 5, y + 14); c.moveTo(x + 7, y + 8); c.lineTo(x + 12, y + 10); c.stroke(); }
        c.restore();
      } else if (ch === 'A' || ch === 'B') {
        const on = solidC(w, ch, tx, ty); const pink = ch === 'A';
        if (on) { c.fillStyle = pink ? '#ff7fc8' : '#6fc8ff'; c.fillRect(x, y, T, T); c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(x, y, T, 2); c.fillRect(x, y, 2, T);
          c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x, y + T - 2, T, 2); c.fillRect(x + T - 2, y, 2, T); c.fillStyle = 'rgba(255,255,255,.75)'; starPath(c, x + 8, y + 8, 4); c.fill(); }
        else { c.strokeStyle = pink ? 'rgba(255,140,210,.75)' : 'rgba(120,200,255,.75)'; c.lineWidth = 1; c.setLineDash([2, 2]); c.strokeRect(x + 1.5, y + 1.5, T - 3, T - 3); c.setLineDash([]); }
      } else if (ch === 'D') {
        if (!solidC(w, 'D', tx, ty)) continue;
        c.fillStyle = 'rgba(30,14,64,.55)'; c.fillRect(x + 2, y, 12, T); c.fillStyle = hc ? '#ffe600' : '#c99bff'; c.fillRect(x + 3, y, 3, T); c.fillRect(x + 10, y, 3, T);
        if (tileAt(L, tx, ty - 1) !== 'D') { c.fillStyle = '#ffd34d'; starPath(c, x + 8, y + 3, 4); c.fill(); }
      } else if (ch === 'L') {
        const top = tileAt(L, tx, ty - 1) !== 'L'; c.fillStyle = hc ? '#ff3a00' : (tx + ty) % 2 ? '#ff5a2a' : '#ff6a30'; c.fillRect(x, y, T, T);
        if (hc) { c.fillStyle = '#000'; for (let i = 0; i < 2; i++) c.fillRect(x + i * 8 + 2, y + 4, 3, T - 4); }
        if (top) { const wv = rm ? 0 : Math.sin(t * 0.08 + tx) * 1; c.fillStyle = '#ffd34d'; c.fillRect(x, y + 1 + wv, T, 3); c.fillStyle = 'rgba(255,240,180,.8)'; c.beginPath(); c.arc(x + 5 + (tx * 3) % 6, y + 7 + wv, 1.4, 0, TAU); c.fill(); }
      } else if (ch === '=') {
        c.fillStyle = th.plat; c.strokeStyle = th.platS; c.lineWidth = 1;
        c.beginPath(); c.ellipse(x + 8, y + 3, 9, 3.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      } else if (ch === '^') {
        c.fillStyle = hc ? '#ffe600' : '#2b1250'; c.fillRect(x, y + 12, T, 4);
        if (hc) { c.fillStyle = '#000'; for (let i = 0; i < 4; i++) c.fillRect(x + i * 4, y + 12, 2, 4); }
        c.fillStyle = hc ? '#fff' : '#ff9a1f'; c.strokeStyle = hc ? '#000' : '#3b1606'; c.lineWidth = hc ? 1.4 : 1;
        c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(x + i * 5.33, y + 12); c.lineTo(x + i * 5.33 + 2.66, y + 4); c.lineTo(x + i * 5.33 + 5.33, y + 12); } c.fill(); c.stroke();
      } else if (ch === 'S') {
        const k = w.springs[tx + ',' + ty] ? 0.45 : 1;
        c.fillStyle = '#5a3fb0'; c.fillRect(x + 1, y + 13, 14, 3);
        c.strokeStyle = '#ffd34d'; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 4; i++) { const yy = y + 13 - (i + 0.5) * 2.5 * k; c.moveTo(x + 4, yy); c.lineTo(x + 12, yy - 1.2 * k); } c.stroke();
        c.fillStyle = '#ff8fd0'; c.strokeStyle = '#7d2a6a'; c.lineWidth = 1; c.beginPath(); c.roundRect(x, y + 13 - 11 * k - 2, 16, 4, 2); c.fill(); c.stroke();
      }
    }
  }
  function water(L, th, t) {
    const x0 = Math.floor(R.cam.x / T), x1 = Math.ceil((R.cam.x + VW) / T), y0 = Math.floor(R.cam.y / T), y1 = Math.ceil((R.cam.y + VH) / T);
    c.fillStyle = th.water;
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (tileAt(L, tx, ty) === '~') {
      const ab = tileAt(L, tx, ty - 1); const top = ab !== '~' && !isBlock(ab) && ab !== 'A' && ab !== 'B' && ab !== 'D';
      if (top) { c.fillRect(tx * T, ty * T + 2, T, T - 2); c.fillStyle = th.waterTop; const wv = R.opts.rm ? 0 : Math.sin(t * 0.06 + tx) * 0.8; c.fillRect(tx * T, ty * T + 1 + wv, T, 1.5); c.fillStyle = th.water; }
      else c.fillRect(tx * T, ty * T, T, T);
    }
  }
  function lavaTide(L, w, t) {
    if (!L.lava) return; const ly = lavaY(L, w.frame); if (ly > R.cam.y + VH + 4) return; const hc = R.opts.hc, rm = R.opts.rm;
    const g = c.createLinearGradient(0, ly, 0, ly + 60); g.addColorStop(0, hc ? '#ff3a00' : '#ff7a2a'); g.addColorStop(1, hc ? '#ff3a00' : '#c8202a');
    c.fillStyle = g; c.beginPath(); c.moveTo(R.cam.x - 4, R.cam.y + VH + 4);
    for (let x = R.cam.x - 4; x <= R.cam.x + VW + 8; x += 8) c.lineTo(x, ly + (rm ? 0 : Math.sin(x * 0.08 + t * 0.07) * 1.6));
    c.lineTo(R.cam.x + VW + 8, R.cam.y + VH + 4); c.closePath(); c.fill();
    c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); for (let x = R.cam.x - 4; x <= R.cam.x + VW + 8; x += 8) c.lineTo(x, ly + (rm ? 0 : Math.sin(x * 0.08 + t * 0.07) * 1.6)); c.stroke();
    if (hc) { c.fillStyle = 'rgba(0,0,0,.55)'; for (let x = Math.floor(R.cam.x / 12) * 12; x < R.cam.x + VW; x += 12) c.fillRect(x, ly + 6, 4, Math.max(0, R.cam.y + VH - ly)); }
  }
  function winds(w, t) {
    const rm = R.opts.rm;
    for (const z of w.winds) {
      if (z.x > R.cam.x + VW || z.x + z.w < R.cam.x) continue; const on = windOn(z, w.frame);
      c.strokeStyle = on ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.18)'; c.lineWidth = 1.2; c.lineCap = 'round';
      const n = Math.max(4, Math.round(z.w * z.h / 2600));
      for (let i = 0; i < n; i++) {
        const u = (i * 0.618034) % 1, v = (i * 0.38197 + 0.13) % 1;
        if (z.fy) { const yy = z.y + ((v * z.h - (rm || !on ? 0 : t * 2.2)) % z.h + z.h) % z.h; const xx = z.x + u * z.w; c.beginPath(); c.moveTo(xx, yy); c.quadraticCurveTo(xx + 3, yy - 5, xx, yy - 10); c.stroke(); }
        else { const xx = z.x + ((u * z.w + (rm || !on ? 0 : t * 2.4 * Math.sign(z.fx))) % z.w + z.w) % z.w; const yy = z.y + v * z.h; if (xx < R.cam.x - 20 || xx > R.cam.x + VW + 20) continue; c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx - Math.sign(z.fx) * 14, yy); c.stroke(); }
      }
      c.lineCap = 'butt';
    }
  }
  R.draw = (w, L, t, extra = {}) => {
    const th = THEMES[L.theme] || THEMES.pond;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1a0d38'; c.fillRect(0, 0, canvas.width, canvas.height);
    const k = R.scale * R.dpr;
    c.setTransform(k, 0, 0, k, R.ox * R.dpr, R.oy * R.dpr);
    c.save(); c.beginPath(); c.rect(0, 0, VW, VH); c.clip();
    bg(th, t);
    const sx = R.shake && !R.opts.rm ? (Math.sin(t * 2.3) * 2) : 0;
    const camX = Math.round(R.cam.x * k) / k, camY = Math.round(R.cam.y * k) / k;
    c.save(); c.translate(-camX + sx, -camY);
    if (w.winds.length) winds(w, t);
    tiles(L, th, w, t);
    for (const q of w.plats) { c.fillStyle = th.plat; c.strokeStyle = th.platS; c.lineWidth = 1; c.beginPath(); c.roundRect(q.x, q.y, q.w, q.h, 3); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(q.x + 3, q.y + 1, q.w - 6, 1.5); }
    const vis = (o) => o.x > R.cam.x - 40 && o.x < R.cam.x + VW + 40;
    for (const h of w.haz) { if (!vis(h)) continue; if (h.t === 'geyser') drawGeyser(c, h, w.frame, geyserH(h, w.frame), R.opts.hc, R.opts.rm); else if (h.t === 'icicle') drawIcicle(c, h, w.frame, R.opts.hc); else if (h.t === 'popper') drawPopper(c, h, w.frame); }
    const bossAlive = w.boss && w.boss.hp > 0;
    for (const it of w.ents) { if (!vis(it)) continue;
      if (it.t === 'goal') { if (!bossAlive) drawGoal(c, it.x, it.y, t, R.opts.rm); }
      else if (it.t === 'check') drawCheck(c, it.x, it.y, it.on, t);
      else if (it.t === 'switch') drawSwitch(c, it.x, it.y, w.sw, it.on);
      else if (it.got) continue;
      else if (it.t === 'star') drawStar(c, it.x + 8, it.y + 8, 5, k, R.opts.rm ? 0 : t);
      else if (it.t === 'big') drawStar(c, it.x + 8, it.y + 8, 8, k, R.opts.rm ? 0 : t, true);
      else if (it.t === 'heart') drawHeart(c, it.x + 8, it.y + 8 + Math.sin(t * 0.07) * 1.2, 5);
      else if (it.t === 'power') drawPower(c, it.x, it.y, t);
    }
    for (const e of w.ens) { if (!e.alive || !vis(e)) continue; drawEnemy(c, e, t, R.opts.hc); if (e.trap) drawBubble(c, e.x + e.w / 2, e.y + e.h / 2, 11, t); }
    if (w.boss) drawBoss(c, w.boss, t, R.opts.hc);
    for (const s of w.shots) drawShot(c, s, t, R.opts.hc);
    for (const b of w.bubbles) drawBubble(c, b.x + 5, b.y + 5, 5, t);
    const p = w.p;
    const mode = w.over === 'clear' ? 'happy' : p.water ? 'swim' : !p.ground ? (p.vy < 0 ? 'jump' : 'fall') : Math.abs(p.vx) > 0.2 ? 'run' : 'idle';
    if (!(p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0) || w.over) drawKemy(c, p.x + p.w / 2, p.y + p.h + 1, { face: p.face, t: mode === 'run' ? p.anim * 4 : t, mode, sq: R.opts.rm ? 1 : p.sq, blink: p.hurtT > 0 });
    if (p.power) { c.globalAlpha = 0.6; drawBubble(c, p.x + p.w / 2 + p.face * 9, p.y - 4 + Math.sin(t * 0.1), 2.2); c.globalAlpha = 1; }
    water(L, th, t);
    lavaTide(L, w, t);
    for (const q of R.parts) { c.globalAlpha = q.life / 30; c.fillStyle = q.col; starPath(c, q.x, q.y, 2, 0.9); c.fill(); }
    c.globalAlpha = 1; c.restore();
    hud(w, L, t, extra);
    c.restore();
  };
  function hud(w, L, t, extra) {
    c.save(); c.font = 'bold 11px system-ui, sans-serif'; c.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) drawHeart(c, 14 + i * 15, 13, 5.5, i < w.p.hearts ? '#ff6fae' : 'rgba(255,255,255,.25)', i < w.p.hearts ? '#7d2a6a' : 'rgba(40,20,70,.5)');
    drawStar(c, 66, 13, 5, R.scale * R.dpr);
    const pill = (x, wd, y = 5) => { c.fillStyle = 'rgba(30,14,64,.55)'; c.beginPath(); c.roundRect(x, y, wd, 16, 8); c.fill(); };
    pill(74, 34); c.fillStyle = '#fff'; c.fillText(String(w.stars).padStart(2, '0'), 80, 13.5);
    for (let i = 0; i < 3; i++) { starPath(c, 120 + i * 13, 13, 5.2); c.fillStyle = w.big[i] ? '#ffd34d' : 'rgba(255,255,255,.18)'; c.fill(); c.strokeStyle = w.big[i] ? '#7a3fd0' : 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.stroke(); }
    const s = w.frame / 60; const txt = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
    pill(VW - 106, 54); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(txt, VW - 98, 13.5);
    const B = w.boss;
    if (B && B.act && B.hp > 0) { // boss name + health pips
      c.textAlign = 'center'; c.font = 'bold 9px system-ui, sans-serif'; const bw = 170; pill(VW / 2 - bw / 2, bw, 205); c.fillStyle = '#ffd34d'; c.fillText(B.name, VW / 2, 210);
      for (let i = 0; i < B.max; i++) { c.fillStyle = i < B.hp ? '#ff6fae' : 'rgba(255,255,255,.2)'; c.beginPath(); c.roundRect(VW / 2 - B.max * 9 + i * 18 + 2, 214.5, 14, 4, 2); c.fill(); }
    }
    if (extra.label) { c.textAlign = 'center'; c.font = 'bold 14px system-ui, sans-serif'; c.globalAlpha = Math.min(1, extra.labelT / 30); const lw = Math.max(180, c.measureText(extra.label).width + 30); c.fillStyle = 'rgba(30,14,64,.6)'; c.beginPath(); c.roundRect(VW / 2 - lw / 2, 34, lw, 26, 13); c.fill(); c.fillStyle = '#fff'; c.fillText(extra.label, VW / 2, 47.5); }
    c.restore();
  }
  // title backdrop: pond scene with Kemy waving
  R.drawTitle = (t, theme = 'pond') => {
    const th = THEMES[theme] || THEMES.pond; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1a0d38'; c.fillRect(0, 0, canvas.width, canvas.height);
    const k = R.scale * R.dpr; c.setTransform(k, 0, 0, k, R.ox * R.dpr, R.oy * R.dpr);
    c.save(); c.beginPath(); c.rect(0, 0, VW, VH); c.clip(); R.cam.x = R.opts.rm ? 0 : t * 0.3; R.cam.y = 0; bg(th, t);
    c.fillStyle = th.water; c.fillRect(0, 170, VW, 60); c.fillStyle = th.waterTop; c.fillRect(0, 170, VW, 2);
    for (let i = 0; i < 5; i++) { c.fillStyle = th.plat; c.strokeStyle = th.platS; c.beginPath(); c.ellipse(((i * 110 - t * 0.2) % 520 + 520) % 520 - 60, 176 + (i % 2) * 14, 22, 6, 0, 0.3, Math.PI * 2 - 0.3); c.lineTo(((i * 110 - t * 0.2) % 520 + 520) % 520 - 60, 176 + (i % 2) * 14); c.fill(); c.stroke(); }
    c.save(); c.translate(VW / 2, 178); c.scale(3, 3); drawKemy(c, 0, 0, { face: 1, t, mode: R.opts.rm ? 'idle' : (t % 400 < 200 ? 'idle' : 'happy') }); c.restore();
    for (let i = 0; i < 7; i++) drawStar(c, 40 + i * 54, 34 + Math.sin(i * 1.3) * 10 + (R.opts.rm ? 0 : Math.sin(t * 0.04 + i) * 3), 5, k, t);
    c.restore();
  };
  return R;
}
