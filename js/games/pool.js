// Star Pool UI: canvas table (portrait; rotates to landscape on wide screens), aim + ghost ball
// guide, pull-back power, spin picker, ball in hand, calling the 8. Online, the shooter sends the
// shot (vx, vy, spin) together with the authoritative end positions; the other client replays the
// same deterministic simulation and then snaps to the stored positions.
import * as P from './pool-engine.js';
import { tsMs, TURN_SECONDS } from './net.js';
import { ask, palByLevel, normLevel, whenOffer, offerHtml, stopOffer, lastLevel, onlyBots } from './bots.js';

const COLORS = { 1: '#f2b31b', 2: '#3d7bff', 3: '#e2558f', 4: '#8a2be2', 5: '#ff7a2f', 6: '#2bb5a8', 7: '#9b1d3a' };
const ballColor = (id) => COLORS[id > 8 ? id - 8 : id];
const logo = new Image(); logo.src = 'logo.png';

function makeSprite(id, px) {
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(px * 2 + 4);
  const g = c.getContext('2d'), r = px, cx = c.width / 2, cy = c.height / 2;
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  if (id === 0) { g.fillStyle = '#f7f3ff'; g.fillRect(0, 0, c.width, c.height); }
  else if (id === 8) { g.fillStyle = '#0d0a14'; g.fillRect(0, 0, c.width, c.height); }
  else if (id < 8) { g.fillStyle = ballColor(id); g.fillRect(0, 0, c.width, c.height); }
  else { g.fillStyle = '#f7f3ff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = ballColor(id); g.fillRect(0, cy - r * 0.55, c.width, r * 1.1); }
  // soft light
  const sh = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,.55)'); sh.addColorStop(0.35, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
  g.fillStyle = sh; g.fillRect(0, 0, c.width, c.height);
  g.restore();
  const star = (x, y, rr, fill) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? rr * 0.45 : rr; g.lineTo(x + q * Math.cos(a), y + q * Math.sin(a)); } g.closePath(); g.fillStyle = fill; g.fill(); };
  if (id === 0) star(cx + r * 0.3, cy + r * 0.3, r * 0.32, '#b57bff');
  else if (id === 8) { star(cx, cy, r * 0.62, '#ffc83d'); }
  else {
    g.beginPath(); g.arc(cx, cy, r * 0.48, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#1a1026'; g.font = `800 ${Math.round(r * 0.62)}px "Space Grotesk", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(id), cx, cy + r * 0.04);
  }
  return c;
}

export function createPool(ctx) {
  const { S, db, main, esc, $, toast, friendlyError, requireAuth, stale, ui } = ctx;
  const { net } = ui;

  // ------------------------------------------------------------ table view (shared)
  function mountTable(host, opts) {
    host.innerHTML = `<div class="pl-wrap"><canvas class="pl-canvas" aria-label="Pool table"></canvas></div>
      <div class="pl-ctrl">
        <div class="pl-spin" role="slider" aria-label="Cue ball spin" tabindex="0"><span class="pl-spin-dot"></span></div>
        <div class="pl-pow"><div class="pl-pull" aria-hidden="true"><span class="pl-pull-fill"></span><span class="pl-pull-txt">Pull back to shoot</span></div>
          <label class="sr-only" for="pl-power">Power</label><input type="range" id="pl-power" min="5" max="100" value="55"></div>
        <button class="btn btn-sm" id="pl-shoot">Shoot</button>
      </div>
      <p class="muted small center pl-hint" id="pl-hint"></p>`;
    const cv = host.querySelector('canvas'), g = cv.getContext('2d');
    const wrap = host.querySelector('.pl-wrap');
    const V = { balls: [], aim: { x: 0, y: -1 }, power: 0.55, spin: { x: 0, y: 0 }, canShoot: false, placing: false, kitchen: false, callMode: false, call: -1, pull: 0, anim: null, sprites: {}, rot: false, s: 1, ox: 0, oy: 0, dpr: 1, bg: null };
    const RAIL = 0.07;
    function layout() {
      const w = wrap.clientWidth || 340;
      const avail = Math.max(300, window.innerHeight - 365);
      V.rot = w > avail * 0.9 && w > 520;
      const tw = V.rot ? H() : 1, th = V.rot ? 1 : H();
      const sx = w / (tw + RAIL * 2), sy = (V.rot ? w * 0.6 : avail) / (th + RAIL * 2);
      V.s = Math.min(sx, sy);
      const cw = Math.round((tw + RAIL * 2) * V.s), ch = Math.round((th + RAIL * 2) * V.s);
      V.dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = cw * V.dpr; cv.height = ch * V.dpr; cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
      V.sprites = {}; V.bg = null; draw();
    }
    const H = () => P.H;
    // table -> canvas css px
    const T = (x, y) => V.rot ? [(RAIL + y) * V.s, (RAIL + (1 - x)) * V.s] : [(RAIL + x) * V.s, (RAIL + y) * V.s];
    const Tinv = (px, py) => V.rot ? [1 - (py / V.s - RAIL), px / V.s - RAIL] : [px / V.s - RAIL, py / V.s - RAIL];
    function background() {
      const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      const b = c.getContext('2d'); b.scale(V.dpr, V.dpr);
      const cw = cv.width / V.dpr, ch = cv.height / V.dpr, rr = RAIL * V.s;
      const rg = b.createLinearGradient(0, 0, cw, ch); rg.addColorStop(0, '#fff0b3'); rg.addColorStop(0.35, '#f2a900'); rg.addColorStop(0.7, '#b77a00'); rg.addColorStop(1, '#ffd36b');
      b.fillStyle = rg; roundRect(b, 0, 0, cw, ch, rr * 0.9); b.fill();
      b.fillStyle = '#2a0f4d'; roundRect(b, rr * 0.45, rr * 0.45, cw - rr * 0.9, ch - rr * 0.9, rr * 0.5); b.fill();
      const fg = b.createRadialGradient(cw / 2, ch / 2, 10, cw / 2, ch / 2, Math.max(cw, ch) * 0.7); fg.addColorStop(0, '#5a20a8'); fg.addColorStop(1, '#2a0b55');
      b.fillStyle = fg; b.fillRect(rr, rr, cw - 2 * rr, ch - 2 * rr);
      // KL logo on the felt
      if (logo.complete && logo.naturalWidth) { const L = Math.min(cw, ch) * 0.38; b.save(); b.beginPath(); b.arc(cw / 2, ch / 2, L * 0.47, 0, 7); b.clip(); b.globalAlpha = 0.2; b.drawImage(logo, cw / 2 - L / 2, ch / 2 - L / 2, L, L); b.restore(); b.strokeStyle = 'rgba(255,200,61,.18)'; b.lineWidth = 1.5; b.beginPath(); b.arc(cw / 2, ch / 2, L * 0.5, 0, 7); b.stroke(); }
      // head string + spots
      b.strokeStyle = 'rgba(255,255,255,.12)'; b.setLineDash([4, 6]); b.beginPath(); const [h1x, h1y] = T(0, P.KITCHEN_Y), [h2x, h2y] = T(1, P.KITCHEN_Y); b.moveTo(h1x, h1y); b.lineTo(h2x, h2y); b.stroke(); b.setLineDash([]);
      for (const sp of [P.FOOT, P.HEAD]) { const [x, y] = T(sp.x, sp.y); b.fillStyle = 'rgba(255,255,255,.3)'; b.beginPath(); b.arc(x, y, 2, 0, 7); b.fill(); }
      // diamonds
      b.fillStyle = '#fff7d6';
      for (let i = 1; i < 8; i++) { if (i === 4) continue; const [x1, y1] = T(-0.035, i / 4); const [x2, y2] = T(1.035, i / 4); dia(b, x1, y1); dia(b, x2, y2); }
      for (let i = 1; i < 4; i++) { const [x1, y1] = T(i / 4, -0.035); const [x2, y2] = T(i / 4, P.H + 0.035); dia(b, x1, y1); dia(b, x2, y2); }
      P.POCKETS.forEach((pk) => { const [x, y] = T(pk.x, pk.y); const r = pk.r * V.s * 0.95; const pg = b.createRadialGradient(x, y, 1, x, y, r); pg.addColorStop(0, '#000'); pg.addColorStop(0.8, '#05020a'); pg.addColorStop(1, '#3a1470'); b.fillStyle = pg; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill(); });
      return c;
    }
    const dia = (b, x, y) => { b.beginPath(); b.moveTo(x, y - 3); b.lineTo(x + 3, y); b.lineTo(x, y + 3); b.lineTo(x - 3, y); b.closePath(); b.fill(); };
    function roundRect(b, x, y, w, h, r) { b.beginPath(); b.moveTo(x + r, y); b.arcTo(x + w, y, x + w, y + h, r); b.arcTo(x + w, y + h, x, y + h, r); b.arcTo(x, y + h, x, y, r); b.arcTo(x, y, x + w, y, r); b.closePath(); }
    function sprite(id) { const px = P.R * V.s * V.dpr; return V.sprites[id] || (V.sprites[id] = makeSprite(id, px)); }
    function drawBall(id, x, y) { const sp = sprite(id), [cx, cy] = T(x, y); const s = sp.width / V.dpr; g.drawImage(sp, cx - s / 2, cy - s / 2, s, s); }
    function draw(frame) {
      if (!cv.isConnected) return;
      if (!V.bg) V.bg = background();
      g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(V.bg, 0, 0); g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
      const pos = frame || V.balls.map((b) => (b.on ? [b.x, b.y] : null));
      // shadows
      g.fillStyle = 'rgba(0,0,0,.35)';
      pos.forEach((p) => { if (!p) return; const [x, y] = T(p[0] + 0.004, p[1] + 0.006); g.beginPath(); g.arc(x, y, P.R * V.s, 0, 7); g.fill(); });
      if (V.call >= 0) { const pk = P.POCKETS[V.call]; const [x, y] = T(pk.x, pk.y); g.strokeStyle = '#ffc83d'; g.lineWidth = 3; g.shadowColor = '#ffc83d'; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, pk.r * V.s, 0, 7); g.stroke(); g.shadowBlur = 0; }
      if (V.callMode) P.POCKETS.forEach((pk, i) => { if (i === V.call) return; const [x, y] = T(pk.x, pk.y); g.strokeStyle = 'rgba(255,200,61,.55)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, pk.r * V.s, 0, 7); g.stroke(); g.setLineDash([]); });
      // guide
      if (!frame && V.canShoot && V.balls[0] && V.balls[0].on) {
        const c = V.balls[0], a = V.aim, info = P.aimInfo(V.balls, a.x, a.y);
        const [cx, cy] = T(c.x, c.y);
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([6, 5]);
        g.beginPath(); g.moveTo(cx, cy);
        if (info.ghost) {
          const [gx, gy] = T(info.ghost.x, info.ghost.y); g.lineTo(gx, gy); g.stroke(); g.setLineDash([]);
          g.strokeStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(gx, gy, P.R * V.s, 0, 7); g.stroke();
          const ob = info.ball; const [ox, oy] = T(ob.x, ob.y); const L = 0.12 + 0.18 * Math.max(0, info.cut);
          const [ex, ey] = T(ob.x + info.obj.x * L, ob.y + info.obj.y * L);
          g.strokeStyle = '#ffc83d'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ex, ey); g.stroke();
          const cl = 0.1 * (1 - Math.max(0, info.cut)) + 0.03; const [tx, ty] = T(info.ghost.x + info.cue.x * cl, info.ghost.y + info.cue.y * cl);
          g.strokeStyle = 'rgba(201,166,255,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx, gy); g.lineTo(tx, ty); g.stroke();
        } else {
          const [wx, wy] = T(info.wall.x, info.wall.y); g.lineTo(wx, wy); g.stroke(); g.setLineDash([]);
          const [rx, ry] = T(info.wall.x + info.refl.x * 0.12, info.wall.y + info.refl.y * 0.12);
          g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(wx, wy); g.lineTo(rx, ry); g.stroke();
        }
        // cue stick, pulled back with power
        const back = (0.03 + V.pull * 0.16) * V.s, len = 0.75 * V.s;
        const [ax, ay] = T(c.x + a.x, c.y + a.y); let ux = ax - cx, uy = ay - cy; const un = Math.hypot(ux, uy) || 1; ux /= un; uy /= un;
        const sx = cx - ux * (P.R * V.s + back), sy = cy - uy * (P.R * V.s + back);
        const grad = g.createLinearGradient(sx, sy, sx - ux * len, sy - uy * len); grad.addColorStop(0, '#fff3c4'); grad.addColorStop(0.08, '#2bb5a8'); grad.addColorStop(0.1, '#e8d8b0'); grad.addColorStop(0.7, '#8a2be2'); grad.addColorStop(1, '#2a0f4d');
        g.strokeStyle = grad; g.lineCap = 'round'; g.lineWidth = Math.max(4, P.R * V.s * 0.55); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - ux * len, sy - uy * len); g.stroke(); g.lineCap = 'butt';
      }
      pos.forEach((p, id) => { if (p) drawBall(id, p[0], p[1]); });
      if (!frame && V.placing && V.balls[0]) { const [x, y] = T(V.balls[0].x, V.balls[0].y); g.strokeStyle = '#ffc83d'; g.lineWidth = 2; g.setLineDash([3, 3]); g.beginPath(); g.arc(x, y, P.R * V.s * 1.7, 0, 7); g.stroke(); g.setLineDash([]); }
    }
    // play a recorded simulation at 60fps
    function play(frames, done) {
      cancelAnimationFrame(V.raf); let i = 0, t0 = performance.now(); V.anim = true;
      const step = (now) => {
        if (!cv.isConnected) return;
        i = Math.min(frames.length - 1, Math.floor((now - t0) / (1000 / 60)));
        draw(frames[i]);
        if (i < frames.length - 1) V.raf = requestAnimationFrame(step); else { V.anim = false; done && done(); }
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
    // ---- input
    let dragging = null;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return Tinv(e.clientX - r.left, e.clientY - r.top); };
    cv.addEventListener('pointerdown', (e) => {
      if (!V.canShoot || V.anim) return;
      const [x, y] = pt(e); const c = V.balls[0];
      if (V.callMode) {
        let best = -1, bd = 0.025;
        P.POCKETS.forEach((pk, i) => { const d = (pk.x - x) ** 2 + (pk.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
        if (best >= 0) { V.call = best; opts.onCall && opts.onCall(best); ui.sfx.play('tap'); draw(); return; }
      }
      if (V.placing && (c.x - x) ** 2 + (c.y - y) ** 2 < (P.R * 7) ** 2) dragging = 'cue'; else dragging = 'aim';
      cv.setPointerCapture(e.pointerId); move(x, y);
    });
    const move = (x, y) => {
      const c = V.balls[0];
      if (dragging === 'cue') { if (P.canPlace(V.balls, x, y, V.kitchen)) { c.x = x; c.y = y; } }
      else if (dragging === 'aim') { let dx = x - c.x, dy = y - c.y; const n = Math.sqrt(dx * dx + dy * dy); if (n > 1e-4) V.aim = { x: dx / n, y: dy / n }; }
      draw();
    };
    cv.addEventListener('pointermove', (e) => { if (!dragging) return; const [x, y] = pt(e); move(x, y); });
    cv.addEventListener('pointerup', () => { dragging = null; });
    cv.addEventListener('pointercancel', () => { dragging = null; });
    const pull = host.querySelector('.pl-pull'), fill = host.querySelector('.pl-pull-fill'), range = host.querySelector('#pl-power');
    let pullStart = null;
    pull.addEventListener('pointerdown', (e) => { if (!V.canShoot || V.anim) return; pullStart = e.clientX; pull.setPointerCapture(e.pointerId); });
    pull.addEventListener('pointermove', (e) => { if (pullStart == null) return; V.pull = Math.max(0, Math.min(1, (e.clientX - pullStart) / (pull.clientWidth * 0.8))); fill.style.width = V.pull * 100 + '%'; draw(); });
    pull.addEventListener('pointerup', () => { if (pullStart == null) return; pullStart = null; const p = V.pull; V.pull = 0; fill.style.width = '0'; if (p > 0.04) { V.power = p; range.value = Math.round(p * 100); shoot(); } else draw(); });
    range.oninput = () => { V.power = range.value / 100; V.pull = V.power; draw(); };
    range.onchange = () => { V.pull = 0; draw(); };
    host.querySelector('#pl-shoot').onclick = () => { V.power = range.value / 100; shoot(); };
    const spin = host.querySelector('.pl-spin'), dot = host.querySelector('.pl-spin-dot');
    const setSpin = (x, y) => { const n = Math.hypot(x, y); if (n > 1) { x /= n; y /= n; } V.spin = { x, y }; dot.style.transform = `translate(${x * 18}px, ${y * 18}px)`; };
    spin.addEventListener('pointerdown', (e) => { const r = spin.getBoundingClientRect(); setSpin((e.clientX - r.left - r.width / 2) / (r.width / 2 - 6), (e.clientY - r.top - r.height / 2) / (r.height / 2 - 6)); ui.sfx.play('tap'); });
    spin.addEventListener('dblclick', () => setSpin(0, 0));
    function shoot() {
      if (!V.canShoot || V.anim) return;
      if (V.callMode && V.call < 0) { toast('Tap a pocket to call the 8 first'); return; }
      const sp = 0.25 + V.power * (P.MAX_SPEED - 0.25);
      const r6 = (v) => Math.round(v * 1e6) / 1e6;
      ui.sfx.play('capture');
      opts.onShoot({ vx: r6(V.aim.x * sp), vy: r6(V.aim.y * sp), follow: r6(-V.spin.y), side: r6(V.spin.x) }, { x: V.balls[0].x, y: V.balls[0].y });
    }
    const ro = new ResizeObserver(() => layout()); ro.observe(wrap);
    logo.onload = () => { V.bg = null; draw(); };
    layout();
    const api = {
      V, draw, play, ease, layout,
      set(balls, o = {}) { V.balls = balls; Object.assign(V, o); host.querySelector('.pl-ctrl').classList.toggle('off', !V.canShoot); draw(); },
      hint(t) { const h = host.querySelector('#pl-hint'); if (h) h.textContent = t; },
      aimAt(x, y) { const c = V.balls[0]; let dx = x - c.x, dy = y - c.y; const n = Math.sqrt(dx * dx + dy * dy); V.aim = { x: dx / n, y: dy / n }; draw(); },
      stop() { ro.disconnect(); cancelAnimationFrame(V.raf); }
    };
    return api;
  }

  // ------------------------------------------------------------ helpers
  const groupLabel = (gname) => (gname === 'solid' ? 'Solids' : gname === 'stripe' ? 'Stripes' : '');
  function rackRow(balls, gname) {
    const ids = gname === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : gname === 'stripe' ? [9, 10, 11, 12, 13, 14, 15] : [];
    return ids.map((id) => `<i class="pl-mini ${balls[id] && balls[id].on ? '' : 'gone'} ${id > 8 ? 'st' : ''}" style="--bc:${ballColor(id)}"></i>`).join('');
  }
  function playersHtml(ps, st, turn, balls, timer, done) {
    return ps.map((p, i) => `<div class="g-pl ${!done && turn === i ? 'on' : ''}" data-side="${i}">${ui.chip(p)}<span class="pl-grp">${st.groups[i] ? `<b>${groupLabel(st.groups[i])}</b><span class="pl-rack">${rackRow(balls, st.groups[i])}</span>` : '<span class="muted">open</span>'}</span>${!done && turn === i && timer != null ? `<span class="g-timer ${timer <= 10 ? 'low' : ''}">${timer}s</span>` : ''}</div>`).join('<span class="g-vs">vs</span>');
  }
  function shell(title, back) {
    ui.shell(esc(title), `<div class="g-players pl-players" id="g-players"></div><div class="g-status" id="g-status" aria-live="polite"></div>
      <div class="g-stage pl-stage"><div class="g-fx"></div><div id="pl-table"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
    document.body.classList.add('pool-mode');
    setTimeout(() => { const el = document.getElementById('g-players'); if (el && window.innerWidth < 600) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 70) }); }, 60);
    S.unsubs.push(() => document.body.classList.remove('pool-mode'));
  }
  function turnHint(st, seat, balls, mine) {
    if (!mine) return '';
    if (st.bih) return st.brk ? 'Place the cue ball behind the line, aim, then pull back to break.' : 'Ball in hand: drag the cue ball anywhere, then shoot.';
    if (P.needsCall(st, seat, balls)) return 'On the 8: tap a pocket to call it, then shoot.';
    return 'Drag on the table to aim. Pull back (or slide power) to shoot. Set spin on the white ball dial.';
  }

  // ------------------------------------------------------------ vs computer
  function local(params) {
    const lvl = normLevel(params.lvl);
    const pal = palByLevel(lvl);
    shell('Star Pool', '#/games/pool');
    ui.wireEmotes(main, '', () => '');
    const human = Math.random() < 0.5 ? 0 : 1;
    const me = { uid: ui.myUid(), name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const cpu = { uid: 'cpu1', name: pal.name, bot: true };
    const ps = human === 0 ? [me, cpu] : [cpu, me];
    let balls = P.decode(P.rack()), st = P.newState(), turn = 0, alive = true, over = false;
    S.unsubs.push(() => { alive = false; table.stop(); });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="pl-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/pool">Leave</a>`;
    $('#pl-new').onclick = () => local(params);
    const table = mountTable($('#pl-table'), { onShoot: (shot, cuePos) => take(shot, cuePos), onCall: (p) => { st.call = p; } });
    function refresh() {
      const mine = turn === human && !over;
      $('#g-players').innerHTML = playersHtml(ps, st, turn, balls, null, over);
      $('#g-status').textContent = over ? '' : (st.msg ? st.msg + ' ' : '') + (mine ? 'Your shot' : `${pal.name} is lining up…`);
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
      const n = Math.hypot(shot.vx, shot.vy); table.V.aim = { x: shot.vx / n, y: shot.vy / n }; table.V.canShoot = true; table.V.pull = n / P.MAX_SPEED; table.draw(); table.V.canShoot = false;
      setTimeout(() => { if (alive) { ui.sfx.play('capture'); take(shot, null); } }, 650);
    }
    refresh();
  }

  // ------------------------------------------------------------ online
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
      $('#g-players').innerHTML = playersHtml(ps, st, g.turn, balls, left, done);
      const status = $('#g-status');
      if (g.status === 'waiting') status.textContent = side === 0 ? (g.invitee ? 'Waiting for your friend…' : g.quick ? 'Looking for an opponent…' : 'Share the link so a friend can join') : 'Waiting for players';
      else if (g.status === 'done') status.textContent = g.endReason === 'cancelled' ? 'Cancelled' : `${names(g.winnerUid)} wins${g.endReason === 'forfeit' ? ' (forfeit)' : g.endReason === 'timeout' ? ' (time ran out)' : ''}`;
      else status.textContent = (st.msg ? st.msg + ' ' : '') + (side === g.turn ? `Your shot${left <= 15 ? ` · ${left}s` : ''}` : `${g.names[g.turn]}’s shot`);
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
