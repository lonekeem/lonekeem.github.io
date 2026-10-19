// Kemy's Bubble Quest - deterministic simulation (no DOM, no randomness).
// Runs at a fixed 60 steps per second. Units: pixels and frames. Shared by the game and the Node tests.
export const T = 16;
export const C = {
  walk: 1.5, run: 2.5, acc: 0.09, runAcc: 0.12, dec: 0.15, airDec: 0.05, turn: 0.24, airAcc: 0.08,
  g: 0.62, gHold: 0.3, maxFall: 5.5, jump: 5.4, jumpRun: 5.9, coyote: 6, buffer: 7,
  wG: 0.06, wSink: 1.1, wUp: 0.22, wMaxUp: 1.9, wStroke: 2.0, wMax: 1.35, wLeap: 5.0,
  spring: 9.4, inv: 90, bubbleCD: 22
};
const SOLID = new Set(['#', 'X', 'S']);
export function parseLevel(json) {
  const rows = json.tiles; const h = rows.length; const w = rows[0].length;
  return { ...json, w, h, rows };
}
export const tileAt = (L, tx, ty) => (ty < 0 ? (tx < 0 || tx >= L.w ? '#' : '.') : ty >= L.h ? '.' : tx < 0 || tx >= L.w ? '#' : L.rows[ty][tx]);
const solidAt = (L, tx, ty) => SOLID.has(tileAt(L, tx, ty));
const isWater = (L, px, py) => tileAt(L, Math.floor(px / T), Math.floor(py / T)) === '~';
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const EN = { snail: [14, 11], urchin: [14, 14], frog: [14, 12], puffer: [14, 13] };
export function newWorld(L) {
  const [sx, sy] = L.start;
  const p = { x: sx * T + 2, y: sy * T + 2, w: 12, h: 14, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buffer: 0,
    hearts: 3, inv: 0, power: false, cd: 0, sq: 1, drop: 0, plat: -1, water: false, anim: 0, hurtT: 0, prevJump: false, prevRun: false, spawn: [sx * T + 2, sy * T + 2] };
  const ents = []; const plats = []; const ens = [];
  for (const e of L.ents) {
    const x = e.x * T, y = e.y * T;
    if (EN[e.t]) { const [w, h] = EN[e.t]; ens.push({ t: e.t, x: x + (T - w) / 2, y: y + T - h, w, h, vx: e.t === 'snail' ? -0.35 : 0, vy: 0, x0: x, range: (e.r || 3) * T, alive: true, trap: 0, squish: 0, tm: (e.x * 37) % 90, puff: 0, dir: -1 }); }
    else if (e.t === 'plat' || e.t === 'vplat') plats.push({ x0: x, y0: y, x, y, w: (e.len || 3) * T, h: 6, ax: e.t === 'plat' ? 1 : 0, range: (e.r || 3) * T, sp: e.sp || 0.012, ph: e.ph || 0, dx: 0, dy: 0 });
    else ents.push({ t: e.t, x, y, w: T, h: T, id: e.id ?? 0, got: false, on: false });
  }
  return { p, ents, plats, ens, bubbles: [], frame: 0, stars: 0, big: [false, false, false], over: '', events: [], clearT: 0, cp: -1, springs: {} };
}
function hurt(w, p, knock) {
  if (p.inv > 0 || w.over) return;
  p.hearts--; p.inv = C.inv; p.hurtT = 30; p.vy = -3.2; p.vx = -p.face * 1.6 * (knock ? 1 : 0.5);
  w.events.push('hurt');
  if (p.hearts <= 0) { w.over = 'dead'; w.events.push('dead'); }
}
function moveBody(L, w, o, isPlayer, input) {
  // X axis
  o.x += o.vx; o.wall = false;
  const top = Math.floor(o.y / T), bot = Math.floor((o.y + o.h - 0.01) / T);
  if (o.vx > 0) { const tx = Math.floor((o.x + o.w - 0.01) / T); for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { o.x = tx * T - o.w; o.vx = 0; o.wall = true; break; } }
  else if (o.vx < 0) { const tx = Math.floor(o.x / T); for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { o.x = (tx + 1) * T; o.vx = 0; o.wall = true; break; } }
  // Y axis
  const prevBot = o.y + o.h; o.y += o.vy; o.ground = false; o.spring = false;
  const l = Math.floor(o.x / T), r = Math.floor((o.x + o.w - 0.01) / T);
  if (o.vy >= 0) {
    const ty = Math.floor((o.y + o.h - 0.01) / T);
    for (let tx = l; tx <= r; tx++) {
      const c = tileAt(L, tx, ty);
      const oneway = c === '=' && prevBot <= ty * T + 0.5 && !(isPlayer && o.drop > 0);
      if (SOLID.has(c) || oneway) { o.y = ty * T - o.h; o.vy = 0; o.ground = true; if (c === 'S') { o.spring = true; o.springAt = tx + ',' + ty; } break; }
    }
    if (isPlayer && !o.ground) {
      for (let i = 0; i < w.plats.length; i++) { const q = w.plats[i];
        if (o.x + o.w > q.x && o.x < q.x + q.w && prevBot <= q.y + 0.5 + Math.max(0, q.dy) && o.y + o.h >= q.y && o.drop <= 0) { o.y = q.y - o.h; o.vy = 0; o.ground = true; o.plat = i; break; } }
    }
  } else {
    const ty = Math.floor(o.y / T);
    for (let tx = l; tx <= r; tx++) if (solidAt(L, tx, ty)) { o.y = (ty + 1) * T; o.vy = 0; break; }
  }
}
export function step(w, L, input) {
  w.events = []; const p = w.p; w.frame++;
  if (w.over === 'clear') { w.clearT++; return w; }
  if (w.over) return w;
  // platforms
  for (const q of w.plats) {
    const t = (w.frame * q.sp + q.ph) * Math.PI * 2; const off = (Math.sin(t) * 0.5 + 0.5) * q.range;
    const nx = q.ax ? q.x0 + off : q.x0, ny = q.ax ? q.y0 : q.y0 - off;
    q.dx = nx - q.x; q.dy = ny - q.y; q.x = nx; q.y = ny;
  }
  if (p.plat >= 0) { const q = w.plats[p.plat]; if (q && p.ground) { p.x += q.dx; p.y = q.y - p.h; } }
  p.plat = -1;
  const press = input.jump && !p.prevJump; const runPress = input.run && !p.prevRun;
  p.prevJump = input.jump; p.prevRun = input.run;
  const cx = p.x + p.w / 2;
  const wasWater = p.water; p.water = isWater(L, cx, p.y + p.h * 0.55);
  if (p.water !== wasWater) w.events.push('splash');
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (p.hurtT > 0) p.hurtT--;
  const ctl = p.hurtT > 18 ? 0 : dir;
  const max = p.water ? C.wMax : input.run ? C.run : C.walk;
  if (ctl) {
    p.face = ctl;
    if (p.vx && Math.sign(p.vx) !== ctl) p.vx += ctl * (p.ground ? C.turn : C.airAcc * 1.5);
    else p.vx += ctl * (p.ground ? (input.run ? C.runAcc : C.acc) : C.airAcc);
    if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - C.dec);
  } else {
    const d = p.ground ? C.dec : p.water ? 0.04 : C.airDec;
    p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d;
  }
  if (press) p.buffer = C.buffer; else if (p.buffer > 0) p.buffer--;
  if (p.ground) p.coyote = C.coyote; else if (p.coyote > 0) p.coyote--;
  if (p.drop > 0) p.drop--;
  if (p.water) {
    if (press) { p.vy = -C.wStroke; w.events.push('swim'); }
    else if (input.jump) p.vy = Math.max(p.vy - C.wUp, -C.wMaxUp);
    p.vy = Math.min(p.vy + C.wG, C.wSink);
    // leap out of the surface
    if (input.jump && p.vy < 0 && !isWater(L, cx, p.y - 2)) { p.vy = -C.wLeap; p.water = false; w.events.push('splash'); }
    p.coyote = 0;
  } else {
    if (press && input.down && p.ground && tileAt(L, Math.floor(cx / T), Math.floor((p.y + p.h + 1) / T)) === '=') { p.drop = 10; p.buffer = 0; p.ground = false; p.y += 1; }
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -(Math.abs(p.vx) > 2 ? C.jumpRun : C.jump); p.buffer = 0; p.coyote = 0; p.ground = false; p.sq = 1.25; w.events.push('jump');
    }
    p.vy = Math.min(p.vy + (p.vy < 0 && input.jump ? C.gHold : C.g), C.maxFall);
  }
  const wasGround = p.ground;
  moveBody(L, w, p, true, input);
  if (p.ground && !wasGround && p.vy === 0) { p.sq = 0.78; }
  if (p.spring) { p.vy = -(input.jump ? C.spring : C.spring * 0.72); p.ground = false; p.sq = 1.35; w.springs[p.springAt] = 12; w.events.push('spring'); }
  p.sq += (1 - p.sq) * 0.2;
  for (const k in w.springs) if (--w.springs[k] <= 0) delete w.springs[k];
  // hazards (spike tiles hurt on their lower half)
  {
    const l = Math.floor((p.x + 1) / T), r = Math.floor((p.x + p.w - 1) / T), t = Math.floor(p.y / T), b = Math.floor((p.y + p.h - 1) / T);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (tileAt(L, tx, ty) === '^' && p.y + p.h > ty * T + 7) { hurt(w, p, true); if (!w.over) p.vy = -4.2; }
  }
  if (p.y > L.h * T + 24) { // fell in a pit
    p.inv = 0; hurt(w, p, false);
    if (!w.over) { p.x = p.spawn[0]; p.y = p.spawn[1]; p.vx = 0; p.vy = 0; p.inv = C.inv; w.events.push('respawn'); }
  }
  if (p.inv > 0) p.inv--;
  // bubbles
  if (p.cd > 0) p.cd--;
  if (runPress && p.power && p.cd === 0 && w.bubbles.length < 3) { w.bubbles.push({ x: cx + p.face * 8 - 5, y: p.y + 2, w: 10, h: 10, vx: p.face * 3.2 + p.vx * 0.3, vy: 0, life: 0 }); p.cd = C.bubbleCD; w.events.push('bubble'); }
  for (const b of w.bubbles) {
    b.life++; b.x += b.vx; b.vx *= 0.96; b.y += b.vy; if (b.life > 18) b.vy = -0.5;
    if (solidAt(L, Math.floor((b.x + 5) / T), Math.floor((b.y + 5) / T))) b.life = 999;
    for (const e of w.ens) if (e.alive && !e.trap && !e.squish && overlap(b, e)) { e.trap = 1; b.life = 999; w.events.push('trap'); }
  }
  w.bubbles = w.bubbles.filter((b) => b.life < 70);
  // enemies
  for (const e of w.ens) {
    if (!e.alive) continue;
    if (e.squish) { if (++e.squish > 30) e.alive = false; continue; }
    if (e.trap) { e.trap++; e.y -= 0.7; e.x += Math.sin(e.trap * 0.15) * 0.4; if (e.trap > 150) { e.alive = false; w.events.push('pop'); } }
    else if (e.t === 'snail') {
      const fx = e.vx > 0 ? e.x + e.w + 1 : e.x - 1; const fy = e.y + e.h + 2;
      if (solidAt(L, Math.floor(fx / T), Math.floor((e.y + 4) / T)) || !(solidAt(L, Math.floor(fx / T), Math.floor(fy / T)) || tileAt(L, Math.floor(fx / T), Math.floor(fy / T)) === '=')) e.vx = -e.vx;
      e.x += e.vx; e.dir = Math.sign(e.vx);
    } else if (e.t === 'urchin') { e.tm++; }
    else if (e.t === 'frog') {
      e.tm++; e.vy = Math.min(e.vy + 0.35, 5);
      if (e.ground && e.tm % 100 === 0 && Math.abs(p.x - e.x) < 180) { e.vy = -5.2; e.dir = p.x < e.x ? -1 : 1; e.vx = e.dir * 1.1; }
      moveBody(L, w, e, false); if (e.ground) e.vx = 0;
      if (e.y > L.h * T + 40) e.alive = false;
    } else if (e.t === 'puffer') {
      e.tm++; const t = e.tm * 0.012; const nx = e.x0 + (Math.sin(t) * 0.5 + 0.5) * e.range; e.dir = nx >= e.x ? 1 : -1; e.x = nx;
      e.puff = (e.tm % 200) > 130 ? 1 : 0;
    }
    if (e.trap) {
      if (overlap(p, e)) { e.alive = false; w.events.push('pop'); }
      continue;
    }
    const box = e.puff ? { x: e.x - 3, y: e.y - 3, w: e.w + 6, h: e.h + 6 } : e;
    if (overlap(p, box)) {
      const stompable = e.t === 'snail' || e.t === 'frog' || (e.t === 'puffer' && !e.puff);
      if (stompable && p.vy > 0 && p.y + p.h - p.vy <= e.y + 6) { e.squish = 1; p.vy = input.jump ? -6.2 : -4.2; p.sq = 1.2; w.events.push('stomp'); }
      else hurt(w, p, true);
    }
  }
  // pickups
  for (const it of w.ents) {
    if (it.got) continue;
    const box = { x: it.x + 2, y: it.y + 2, w: 12, h: 12 };
    if (it.t === 'goal') { box.y = it.y - 16; box.h = 32; }
    if (it.t === 'check') { box.y = it.y - 8; box.h = 24; }
    if (!overlap(p, box)) continue;
    if (it.t === 'star') { it.got = true; w.stars++; w.events.push('star'); }
    else if (it.t === 'big') { it.got = true; w.big[it.id] = true; w.events.push('big'); }
    else if (it.t === 'heart') { it.got = true; p.hearts = Math.min(3, p.hearts + 1); w.events.push('heart'); }
    else if (it.t === 'power') { it.got = true; p.power = true; w.events.push('power'); }
    else if (it.t === 'check' && !it.on) { for (const o of w.ents) if (o.t === 'check') o.on = false; it.on = true; p.spawn = [it.x + 2, it.y + 1]; w.events.push('check'); }
    else if (it.t === 'goal') { w.over = 'clear'; p.vx = 0; w.events.push('clear'); }
  }
  p.anim += Math.abs(p.vx) * 0.12 + 0.02;
  return w;
}
export const totals = (L) => ({ stars: L.ents.filter((e) => e.t === 'star').length, big: 3 });
