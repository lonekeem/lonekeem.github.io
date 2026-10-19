// Kemy's Bubble Quest - renderer (canvas 2D, vector art, crisp at any DPR)
import { T, tileAt } from './sim.js';
import { drawKemy, drawStar, drawHeart, drawBubble, drawEnemy, drawCheck, drawGoal, drawPower, THEMES, starPath } from './art.js';
export const VW = 400, VH = 225;
export function createRenderer(canvas) {
  const c = canvas.getContext('2d');
  const R = { scale: 1, ox: 0, oy: 0, dpr: 1, cam: { x: 0, y: 0, look: 0 }, parts: [], shake: 0, opts: { rm: false, hc: false } };
  R.resize = (cssW, cssH) => {
    R.dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(cssW * R.dpr); canvas.height = Math.round(cssH * R.dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    R.scale = Math.min(cssW / VW, cssH / VH); R.ox = (cssW - VW * R.scale) / 2; R.oy = (cssH - VH * R.scale) / 2; R.cssW = cssW; R.cssH = cssH;
  };
  R.resetCam = (w, L) => { R.cam.x = Math.max(0, w.p.x - VW * 0.35); R.cam.y = Math.max(0, Math.min(L.h * T - VH, w.p.y - VH * 0.55)); R.cam.look = 0; R.parts = []; };
  R.burst = (x, y, col, n = 8) => { if (R.opts.rm) n = Math.min(n, 3); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; R.parts.push({ x, y, vx: Math.cos(a) * 1.4, vy: Math.sin(a) * 1.4 - 0.5, life: 30, col }); } };
  R.update = (w, L) => {
    const p = w.p; const target = p.face * 44 + p.vx * 10;
    R.cam.look += (target - R.cam.look) * 0.04;
    const tx = p.x + p.w / 2 - VW / 2 + R.cam.look; const ty = p.y - VH * 0.55;
    R.cam.x += (tx - R.cam.x) * 0.12; R.cam.y += (ty - R.cam.y) * (p.ground || p.water ? 0.08 : 0.04);
    R.cam.x = Math.max(0, Math.min(L.w * T - VW, R.cam.x)); R.cam.y = Math.max(0, Math.min(L.h * T - VH, R.cam.y));
    for (const q of R.parts) { q.x += q.vx; q.y += q.vy; q.vy += 0.05; q.life--; }
    R.parts = R.parts.filter((q) => q.life > 0); if (R.shake > 0) R.shake--;
  };
  function bg(th, t) {
    const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, th.sky[0]); g.addColorStop(0.55, th.sky[1]); g.addColorStop(1, th.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    const px = (f) => -(R.cam.x * f) % 400;
    // far layer: soft hills / crystal spires / coral fans
    c.fillStyle = th.far;
    for (let k = -1; k < 3; k++) { const ox = px(0.15) + k * 400; c.beginPath(); c.moveTo(ox, VH);
      for (let i = 0; i <= 8; i++) c.lineTo(ox + i * 50, VH - 70 - Math.sin(i * 1.7) * 26 - (th === THEMES.cave ? (i % 2) * 40 : 0)); c.lineTo(ox + 400, VH); c.fill(); }
    c.fillStyle = th.near;
    for (let k = -1; k < 3; k++) { const ox = px(0.35) + k * 400; c.beginPath(); c.moveTo(ox, VH);
      for (let i = 0; i <= 10; i++) c.lineTo(ox + i * 40, VH - 34 - Math.cos(i * 2.3) * 16 - (th === THEMES.cave ? (i % 3 === 0) * 30 : 0)); c.lineTo(ox + 400, VH); c.fill(); }
    // floating sparkles / bubbles
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 97 - R.cam.x * 0.25) % 420 + 420) % 420 - 10; const sy = (i * 53) % 150 + 10 + (R.opts.rm ? 0 : Math.sin(t * 0.02 + i) * 4);
      if (th === THEMES.reef) drawBubble(c, sx, (sy - (R.opts.rm ? 0 : t * 0.3) % 240 + 240) % 240, 1.5 + (i % 3));
      else { c.fillStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.15})`; starPath(c, sx, sy, 1.5 + (i % 2), 0.6); c.fill(); }
    }
  }
  function tiles(L, th, w, t) {
    const x0 = Math.floor(R.cam.x / T), x1 = Math.ceil((R.cam.x + VW) / T), y0 = Math.floor(R.cam.y / T), y1 = Math.ceil((R.cam.y + VH) / T);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(L, tx, ty); if (ch === '.' || ch === '~') continue; if (tx < 0 || tx >= L.w) continue;
      const x = tx * T, y = ty * T;
      if (ch === '#' || ch === 'X') {
        const above = tileAt(L, tx, ty - 1); const open = above !== '#' && above !== 'X' && above !== 'S';
        if (ch === '#') {
          c.fillStyle = (tx + ty) % 2 ? th.dirt : th.dirt2; c.fillRect(x, y, T, T);
          c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + ((tx * 7) % 10) + 2, y + ((ty * 5) % 10) + 3, 2, 2);
          if (open) { c.fillStyle = th.top2; c.fillRect(x, y, T, 6); c.fillStyle = th.top; c.fillRect(x, y, T, 4);
            for (let i = 0; i < 4; i++) c.fillRect(x + i * 4 + 1, y + 4, 2, 2 + ((tx + i) % 2)); }
        } else {
          c.fillStyle = th.block; c.fillRect(x, y, T, T); c.fillStyle = th.blockT; c.fillRect(x, y, T, 2); c.fillRect(x, y, 2, T);
          c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x, y + T - 2, T, 2); c.fillRect(x + T - 2, y, 2, T);
          if (th === THEMES.cave && (tx * 3 + ty) % 5 === 0) { c.fillStyle = 'rgba(220,200,255,.7)'; c.beginPath(); c.moveTo(x + 5, y + 12); c.lineTo(x + 8, y + 4); c.lineTo(x + 11, y + 12); c.fill(); }
        }
      } else if (ch === '=') {
        c.fillStyle = th.plat; c.strokeStyle = th.platS; c.lineWidth = 1;
        c.beginPath(); c.ellipse(x + 8, y + 3, 9, 3.2, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      } else if (ch === '^') {
        const hc = R.opts.hc;
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
      const top = tileAt(L, tx, ty - 1) !== '~' && tileAt(L, tx, ty - 1) !== '#' && tileAt(L, tx, ty - 1) !== 'X';
      if (top) { c.fillRect(tx * T, ty * T + 2, T, T - 2); c.fillStyle = th.waterTop; const wv = R.opts.rm ? 0 : Math.sin(t * 0.06 + tx) * 0.8; c.fillRect(tx * T, ty * T + 1 + wv, T, 1.5); c.fillStyle = th.water; }
      else c.fillRect(tx * T, ty * T, T, T);
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
    tiles(L, th, w, t);
    for (const q of w.plats) { c.fillStyle = th.plat; c.strokeStyle = th.platS; c.lineWidth = 1; c.beginPath(); c.roundRect(q.x, q.y, q.w, q.h, 3); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(q.x + 3, q.y + 1, q.w - 6, 1.5); }
    const vis = (o) => o.x > R.cam.x - 40 && o.x < R.cam.x + VW + 40;
    for (const it of w.ents) { if (!vis(it)) continue;
      if (it.t === 'goal') drawGoal(c, it.x, it.y, t, R.opts.rm);
      else if (it.t === 'check') drawCheck(c, it.x, it.y, it.on, t);
      else if (it.got) continue;
      else if (it.t === 'star') drawStar(c, it.x + 8, it.y + 8, 5, k, R.opts.rm ? 0 : t);
      else if (it.t === 'big') drawStar(c, it.x + 8, it.y + 8, 8, k, R.opts.rm ? 0 : t, true);
      else if (it.t === 'heart') drawHeart(c, it.x + 8, it.y + 8 + Math.sin(t * 0.07) * 1.2, 5);
      else if (it.t === 'power') drawPower(c, it.x, it.y, t);
    }
    for (const e of w.ens) { if (!e.alive || !vis(e)) continue; drawEnemy(c, e, t, R.opts.hc); if (e.trap) drawBubble(c, e.x + e.w / 2, e.y + e.h / 2, 11, t); }
    for (const b of w.bubbles) drawBubble(c, b.x + 5, b.y + 5, 5, t);
    const p = w.p;
    const mode = w.over === 'clear' ? 'happy' : p.water ? 'swim' : !p.ground ? (p.vy < 0 ? 'jump' : 'fall') : Math.abs(p.vx) > 0.2 ? 'run' : 'idle';
    if (!(p.inv > 0 && Math.floor(p.inv / 4) % 2 === 0) || w.over) drawKemy(c, p.x + p.w / 2, p.y + p.h + 1, { face: p.face, t: mode === 'run' ? p.anim * 4 : t, mode, sq: R.opts.rm ? 1 : p.sq, blink: p.hurtT > 0 });
    if (p.power) { c.globalAlpha = 0.6; drawBubble(c, p.x + p.w / 2 + p.face * 9, p.y - 4 + Math.sin(t * 0.1), 2.2); c.globalAlpha = 1; }
    water(L, th, t);
    for (const q of R.parts) { c.globalAlpha = q.life / 30; c.fillStyle = q.col; starPath(c, q.x, q.y, 2, 0.9); c.fill(); }
    c.globalAlpha = 1; c.restore();
    hud(w, L, t, extra);
    c.restore();
  };
  function hud(w, L, t, extra) {
    c.save(); c.font = 'bold 11px system-ui, sans-serif'; c.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) drawHeart(c, 14 + i * 15, 13, 5.5, i < w.p.hearts ? '#ff6fae' : 'rgba(255,255,255,.25)', i < w.p.hearts ? '#7d2a6a' : 'rgba(40,20,70,.5)');
    drawStar(c, 66, 13, 5, R.scale * R.dpr);
    const pill = (x, wd) => { c.fillStyle = 'rgba(30,14,64,.55)'; c.beginPath(); c.roundRect(x, 5, wd, 16, 8); c.fill(); };
    pill(74, 34); c.fillStyle = '#fff'; c.fillText(String(w.stars).padStart(2, '0'), 80, 13.5);
    for (let i = 0; i < 3; i++) { starPath(c, 120 + i * 13, 13, 5.2); c.fillStyle = w.big[i] ? '#ffd34d' : 'rgba(255,255,255,.18)'; c.fill(); c.strokeStyle = w.big[i] ? '#7a3fd0' : 'rgba(255,255,255,.4)'; c.lineWidth = 1; c.stroke(); }
    const s = w.frame / 60; const txt = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
    pill(VW - 106, 54); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(txt, VW - 98, 13.5);
    if (extra.label) { c.textAlign = 'center'; c.font = 'bold 14px system-ui, sans-serif'; c.globalAlpha = Math.min(1, extra.labelT / 30); c.fillStyle = 'rgba(30,14,64,.6)'; c.beginPath(); c.roundRect(VW / 2 - 90, 34, 180, 26, 13); c.fill(); c.fillStyle = '#fff'; c.fillText(extra.label, VW / 2, 47.5); }
    c.restore();
  }
  // title backdrop: pond scene with Kemy waving
  R.drawTitle = (t) => {
    const th = THEMES.pond; c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#1a0d38'; c.fillRect(0, 0, canvas.width, canvas.height);
    const k = R.scale * R.dpr; c.setTransform(k, 0, 0, k, R.ox * R.dpr, R.oy * R.dpr);
    c.save(); c.beginPath(); c.rect(0, 0, VW, VH); c.clip(); R.cam.x = t * 0.3; R.cam.y = 0; bg(th, t);
    c.fillStyle = th.water; c.fillRect(0, 170, VW, 60); c.fillStyle = th.waterTop; c.fillRect(0, 170, VW, 2);
    for (let i = 0; i < 5; i++) { c.fillStyle = th.plat; c.strokeStyle = th.platS; c.beginPath(); c.ellipse(((i * 110 - t * 0.2) % 520 + 520) % 520 - 60, 176 + (i % 2) * 14, 22, 6, 0, 0.3, Math.PI * 2 - 0.3); c.lineTo(((i * 110 - t * 0.2) % 520 + 520) % 520 - 60, 176 + (i % 2) * 14); c.fill(); c.stroke(); }
    c.save(); c.translate(VW / 2, 178); c.scale(3, 3); drawKemy(c, 0, 0, { face: 1, t, mode: R.opts.rm ? 'idle' : (t % 400 < 200 ? 'idle' : 'happy') }); c.restore();
    for (let i = 0; i < 7; i++) drawStar(c, 40 + i * 54, 34 + Math.sin(i * 1.3) * 10 + (R.opts.rm ? 0 : Math.sin(t * 0.04 + i) * 3), 5, k, t);
    c.restore();
  };
  return R;
}
