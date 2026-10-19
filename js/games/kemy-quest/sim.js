// Kemy's Bubble Quest - deterministic simulation (no DOM, no randomness).
// Runs at a fixed 60 steps per second. Units: pixels and frames. Shared by the game and the Node tests.
export const T = 16;
export const C = {
  walk: 1.5, run: 2.5, acc: 0.09, runAcc: 0.12, dec: 0.15, airDec: 0.05, turn: 0.24, airAcc: 0.08,
  g: 0.62, gHold: 0.3, maxFall: 5.5, jump: 5.4, jumpRun: 5.9, coyote: 6, buffer: 7,
  wG: 0.06, wSink: 1.1, wUp: 0.22, wMaxUp: 1.9, wStroke: 2.0, wMax: 1.35, wLeap: 5.0,
  spring: 9.4, inv: 90, bubbleCD: 22,
  mush: 8.2, mushLo: 6.9, lavaB: 6.6, belt: 0.85, iceAcc: 0.3, iceDec: 0.1
};
// Tiles: # ground, X block, S spring, = one-way, ^ spikes, ~ water, I ice, M bouncy mushroom, < > conveyor belts,
// C crumbling block, A/B switch blocks (A solid while switch is off, B while on), D boss gate, L lava.
const SOLID = new Set(['#', 'X', 'S', 'I', 'M', '<', '>']);
export const CR_T = 26, CR_GONE = 210;
let CUR = null; // world being stepped (dynamic tile state lookups)
export function solidC(w, c, tx, ty) {
  if (SOLID.has(c)) return true;
  if (c === 'C') return !(w && w.cr[tx + ',' + ty] > CR_T);
  if (c === 'A') return !(w && w.sw);
  if (c === 'B') return !!(w && w.sw);
  if (c === 'D') return !!(w && w.boss && w.boss.hp > 0);
  return false;
}
export function parseLevel(json) {
  const rows = json.tiles; const h = rows.length; const w = rows[0].length;
  return { ...json, w, h, rows };
}
export const tileAt = (L, tx, ty) => (ty < 0 ? (tx < 0 || tx >= L.w ? '#' : '.') : ty >= L.h ? '.' : tx < 0 || tx >= L.w ? '#' : L.rows[ty][tx]);
const solidAt = (L, tx, ty) => solidC(CUR, tileAt(L, tx, ty), tx, ty);
const isWater = (L, px, py) => tileAt(L, Math.floor(px / T), Math.floor(py / T)) === '~';
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// lava surface height (px) at frame f: optional tide (amp/per) plus a slow steady rise
export function lavaY(L, f) {
  const v = L.lava; if (!v) return Infinity;
  let y = v.y * T - (v.amp ? v.amp * T * (0.5 - 0.5 * Math.cos(f * Math.PI * 2 / v.per)) : 0);
  if (v.rise) y -= Math.max(0, f - (v.delay || 0)) * v.rise;
  return Math.max(y, (v.top ?? -99) * T);
}
export const windOn = (z, f) => !z.per || ((f + z.ph) % z.per) < z.on;
export const geyserH = (g, f) => { const c = (f + g.ph) % g.per; return c < g.on ? Math.min(1, c / 6) * g.hh : 0; };

const EN = { snail: [14, 11], urchin: [14, 14], frog: [14, 12], puffer: [14, 13], bee: [14, 12], pengu: [14, 13], wisp: [12, 12] };
export const BOSSES = {
  bullfrog: { w: 28, h: 24, hp: 3, name: 'Bramble the Bullyfrog' },
  geode: { w: 26, h: 22, hp: 3, name: 'Quartzback the Crystal Armadillo' },
  jelly: { w: 26, h: 24, hp: 3, name: 'Queen Lumajelly' },
  bee: { w: 28, h: 24, hp: 3, name: 'Duchess Buzzbelle' },
  cloud: { w: 38, h: 20, hp: 3, name: 'Nimbo the Grumble Cloud' },
  walrus: { w: 32, h: 24, hp: 4, name: 'Tusky the Frost Walrus' },
  moth: { w: 30, h: 22, hp: 4, name: 'Moltara the Ember Moth' },
  owl: { w: 28, h: 28, hp: 5, name: 'Noctra the Midnight Owl' }
};
export function newWorld(L) {
  const [sx, sy] = L.start;
  const p = { x: sx * T + 2, y: sy * T + 2, w: 12, h: 14, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buffer: 0,
    hearts: 3, inv: 0, power: false, cd: 0, sq: 1, drop: 0, plat: -1, water: false, anim: 0, hurtT: 0, prevJump: false, prevRun: false, spawn: [sx * T + 2, sy * T + 2], ex: 0, gt: '' };
  const ents = []; const plats = []; const ens = []; const winds = []; const haz = []; let boss = null;
  for (const e of L.ents) {
    const x = e.x * T, y = e.y * T;
    if (EN[e.t]) { const [w, h] = EN[e.t]; ens.push({ t: e.t, x: x + (T - w) / 2, y: y + T - h, w, h, vx: e.t === 'snail' ? -0.35 : e.t === 'pengu' ? -0.9 : 0, vy: 0, x0: x, y0: y + T - h, range: (e.r || 3) * T, alive: true, trap: 0, squish: 0, tm: (e.x * 37) % 90, puff: 0, dir: -1 }); }
    else if (e.t === 'plat' || e.t === 'vplat') plats.push({ x0: x, y0: y, x, y, w: (e.len || 3) * T, h: 6, ax: e.t === 'plat' ? 1 : 0, range: (e.r || 3) * T, sp: e.sp || 0.012, ph: e.ph || 0, dx: 0, dy: 0 });
    else if (e.t === 'wind') winds.push({ x, y, w: e.w * T, h: e.h * T, fx: e.fx || 0, fy: e.fy || 0, per: e.per || 0, on: e.on || 0, ph: e.ph || 0 });
    else if (e.t === 'geyser') haz.push({ t: 'geyser', x, y, per: e.per || 160, on: e.on || 55, ph: e.ph || 0, hh: (e.hh || 4.5) * T });
    else if (e.t === 'icicle') haz.push({ t: 'icicle', x, y, st: 0, vy: 0, tm: 0, gone: false });
    else if (e.t === 'popper') haz.push({ t: 'popper', x, y, per: e.per || 130, ph: e.ph || 0, dir: e.dir || -1, sp: e.sp || 1.3 });
    else if (e.t === 'boss') { const B = BOSSES[e.k];
      boss = { k: e.k, name: B.name, w: B.w, h: B.h, x: x + T / 2 - B.w / 2, y: (e.y + 1) * T - B.h, hp: B.hp, max: B.hp, t: 0, pt: 0, ph: 'start', inv: 0, vx: 0, vy: 0, dir: -1, act: false,
        ax0: e.a0 * T, ax1: (e.a1 + 1) * T, fy: (e.y + 1) * T, top: (e.top ?? e.y - 9) * T, perch: e.perch || null, pi: 0, n: 0, dead: 0, vuln: false, alpha: 1, tang: true, water: !!e.water }; }
    else ents.push({ t: e.t, x, y, w: T, h: T, id: e.id ?? 0, got: false, on: false });
  }
  return { p, ents, plats, ens, winds, haz, boss, shots: [], cr: {}, sw: 0, bubbles: [], frame: 0, stars: 0, big: [false, false, false], over: '', events: [], clearT: 0, cp: -1, springs: {} };
}
function hurt(w, p, knock) {
  if (p.inv > 0 || w.over) return;
  p.hearts--; p.inv = C.inv; p.hurtT = 30; p.vy = -3.2; p.vx = -p.face * 1.6 * (knock ? 1 : 0.5);
  w.events.push('hurt');
  if (p.hearts <= 0) { w.over = 'dead'; w.events.push('dead'); }
}
function moveBody(L, w, o, isPlayer, input) {
  // X axis
  const dx = o.vx + (o.ex || 0); o.x += dx; o.wall = false;
  const top = Math.floor(o.y / T), bot = Math.floor((o.y + o.h - 0.01) / T);
  if (dx > 0) { const tx = Math.floor((o.x + o.w - 0.01) / T); for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { o.x = tx * T - o.w; if (o.vx > 0) o.vx = 0; o.wall = true; break; } }
  else if (dx < 0) { const tx = Math.floor(o.x / T); for (let ty = top; ty <= bot; ty++) if (solidAt(L, tx, ty)) { o.x = (tx + 1) * T; if (o.vx < 0) o.vx = 0; o.wall = true; break; } }
  // Y axis
  const prevBot = o.y + o.h; o.y += o.vy; o.ground = false; o.spring = false; o.mush = false;
  const l = Math.floor(o.x / T), r = Math.floor((o.x + o.w - 0.01) / T);
  if (o.vy >= 0) {
    const ty = Math.floor((o.y + o.h - 0.01) / T);
    for (let tx = l; tx <= r; tx++) {
      const c = tileAt(L, tx, ty);
      const oneway = c === '=' && prevBot <= ty * T + 0.5 && !(isPlayer && o.drop > 0);
      if (solidC(CUR, c, tx, ty) || oneway) { o.y = ty * T - o.h; o.vy = 0; o.ground = true; o.gt = c; if (c === 'S') { o.spring = true; o.springAt = tx + ',' + ty; } if (c === 'M') o.mush = true; break; }
    }
    if (isPlayer && !o.ground) {
      for (let i = 0; i < w.plats.length; i++) { const q = w.plats[i];
        if (o.x + o.w > q.x && o.x < q.x + q.w && prevBot <= q.y + 0.5 + Math.max(0, q.dy) && o.y + o.h >= q.y && o.drop <= 0) { o.y = q.y - o.h; o.vy = 0; o.ground = true; o.plat = i; o.gt = 'plat'; break; } }
    }
  } else {
    const ty = Math.floor(o.y / T);
    for (let tx = l; tx <= r; tx++) if (solidAt(L, tx, ty)) { o.y = (ty + 1) * T; o.vy = 0; break; }
  }
}
function shot(w, x, y, vx, vy, g, k, life = 240, sz = 8, stomp = false) { if (w.shots.length < 40) w.shots.push({ x, y, w: sz, h: sz, vx, vy, g, k, life, stomp }); }
function tileOverlap(L, o, tx, ty) { return o.x < (tx + 1) * T && o.x + o.w > tx * T && o.y < (ty + 1) * T && o.y + o.h > ty * T; }
export function step(w, L, input) {
  CUR = w; w.events = []; const p = w.p; w.frame++;
  if (w.over === 'clear') { w.clearT++; return w; }
  if (w.over) return w;
  // platforms
  for (const q of w.plats) {
    const t = (w.frame * q.sp + q.ph) * Math.PI * 2; const off = (Math.sin(t) * 0.5 + 0.5) * q.range;
    const nx = q.ax ? q.x0 + off : q.x0, ny = q.ax ? q.y0 : q.y0 - off;
    q.dx = nx - q.x; q.dy = ny - q.y; q.x = nx; q.y = ny;
  }
  // crumbling blocks: shake, vanish, then reform when Kemy is clear
  for (const k in w.cr) {
    const v = ++w.cr[k];
    if (v === CR_T + 1) w.events.push('crumble');
    if (v > CR_T + CR_GONE) { const [tx, ty] = k.split(',').map(Number); if (!tileOverlap(L, p, tx, ty)) delete w.cr[k]; else w.cr[k]--; }
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
  const ice = p.ground && p.gt === 'I'; const kA = ice ? C.iceAcc : 1, kD = ice ? C.iceDec : 1;
  if (ctl) {
    p.face = ctl;
    if (p.vx && Math.sign(p.vx) !== ctl) p.vx += ctl * (p.ground ? C.turn * kA : C.airAcc * 1.5);
    else p.vx += ctl * (p.ground ? (input.run ? C.runAcc : C.acc) * kA : C.airAcc);
    if (Math.abs(p.vx) > max) p.vx = Math.sign(p.vx) * Math.max(max, Math.abs(p.vx) - C.dec * kD);
  } else {
    const d = p.ground ? C.dec * kD : p.water ? 0.04 : C.airDec;
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
  // external push: conveyor belts and wind gusts / updrafts
  p.ex = p.ground && p.gt === '>' ? C.belt : p.ground && p.gt === '<' ? -C.belt : 0;
  for (const z of w.winds) if (windOn(z, w.frame) && cx > z.x && cx < z.x + z.w && p.y + p.h > z.y && p.y < z.y + z.h) {
    p.ex += z.fx; if (z.fy) p.vy = Math.max(p.vy - z.fy, -3.2);
  }
  if (w.boss && w.boss.gust) p.ex += w.boss.gust;
  const wasGround = p.ground;
  moveBody(L, w, p, true, input);
  if (p.ground && !wasGround && p.vy === 0) { p.sq = 0.78; }
  if (p.spring) { p.vy = -(input.jump ? C.spring : C.spring * 0.72); p.ground = false; p.sq = 1.35; w.springs[p.springAt] = 12; w.events.push('spring'); }
  else if (p.mush) { p.vy = -(input.jump ? C.mush : C.mushLo); p.ground = false; p.sq = 1.4; w.events.push('boing'); }
  if (p.ground && p.plat < 0) { const ty = Math.floor((p.y + p.h + 1) / T);
    for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++) if (tileAt(L, tx, ty) === 'C' && !w.cr[tx + ',' + ty]) w.cr[tx + ',' + ty] = 1; }
  p.sq += (1 - p.sq) * 0.2;
  for (const k in w.springs) if (--w.springs[k] <= 0) delete w.springs[k];
  // hazards (spike tiles hurt on their lower half, lava tiles bounce Kemy out)
  {
    const l = Math.floor((p.x + 1) / T), r = Math.floor((p.x + p.w - 1) / T), t = Math.floor(p.y / T), b = Math.floor((p.y + p.h - 1) / T);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) {
      const c = tileAt(L, tx, ty);
      if (c === '^' && p.y + p.h > ty * T + 7) { hurt(w, p, true); if (!w.over) p.vy = -4.2; }
      else if (c === 'L' && p.y + p.h > ty * T + 5) { hurt(w, p, false); if (!w.over) { p.vy = -C.lavaB; w.events.push('sizzle'); } }
    }
  }
  if (L.lava && p.y + p.h > lavaY(L, w.frame) + 3) { hurt(w, p, false); if (!w.over) { p.vy = -C.lavaB; w.events.push('sizzle'); } }
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
    const B = w.boss; if (B && B.hp > 0 && B.act && B.vuln && !B.inv && B.tang && b.life < 999 && overlap(b, B)) { b.life = 999; bossHit(w, B); }
  }
  w.bubbles = w.bubbles.filter((b) => b.life < 70);
  // enemies
  for (const e of w.ens) {
    if (!e.alive) continue;
    if (e.squish) { if (++e.squish > 30) e.alive = false; continue; }
    if (e.trap) { e.trap++; e.y -= 0.7; e.x += Math.sin(e.trap * 0.15) * 0.4; if (e.trap > 150) { e.alive = false; w.events.push('pop'); } }
    else if (e.t === 'snail' || e.t === 'pengu') {
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
    } else if (e.t === 'bee') {
      e.tm++; e.y = e.y0 - (Math.sin(e.tm * 0.045) * 0.5 + 0.5) * e.range; e.dir = p.x < e.x ? -1 : 1;
    } else if (e.t === 'wisp') {
      e.tm++; const ddx = p.x + p.w / 2 - (e.x + e.w / 2), ddy = p.y + p.h / 2 - (e.y + e.h / 2);
      const near = Math.abs(ddx) < 150 && Math.abs(ddy) < 110;
      const tx = near ? ddx : e.x0 + 2 - e.x, ty = near ? ddy : e.y0 - e.y; const sp = near ? 0.42 : 0.3;
      e.x += Math.sign(tx) * Math.min(sp, Math.abs(tx)); e.y += Math.sign(ty) * Math.min(sp * 0.75, Math.abs(ty)); e.dir = ddx < 0 ? -1 : 1;
    }
    if (e.trap) {
      if (overlap(p, e)) { e.alive = false; w.events.push('pop'); }
      continue;
    }
    const box = e.puff ? { x: e.x - 3, y: e.y - 3, w: e.w + 6, h: e.h + 6 } : e;
    if (overlap(p, box)) {
      const stompable = e.t === 'snail' || e.t === 'frog' || e.t === 'bee' || e.t === 'pengu' || (e.t === 'puffer' && !e.puff);
      if (stompable && p.vy > 0 && p.y + p.h - p.vy <= e.y + 6) { e.squish = 1; p.vy = input.jump ? -6.2 : -4.2; p.sq = 1.2; w.events.push('stomp'); }
      else hurt(w, p, true);
    }
  }
  // timed hazards: steam geysers, falling icicles, gumball poppers
  for (const h of w.haz) {
    if (h.t === 'geyser') { const hh = geyserH(h, w.frame); if (hh > 0 && overlap(p, { x: h.x + 3, y: h.y + T - hh, w: 10, h: hh })) hurt(w, p, true); }
    else if (h.t === 'icicle') {
      if (h.gone) continue;
      if (h.st === 0 && Math.abs(cx - (h.x + 8)) < 30 && p.y > h.y) { h.st = 1; w.events.push('creak'); }
      else if (h.st === 1 && ++h.tm > 16) h.st = 2;
      else if (h.st === 2) { h.vy = Math.min(h.vy + 0.35, 6); h.y += h.vy; if (solidAt(L, Math.floor((h.x + 8) / T), Math.floor((h.y + 15) / T)) || h.y > L.h * T) { h.gone = true; w.events.push('shatter'); } }
      if (!h.gone && overlap(p, { x: h.x + 4, y: h.y, w: 8, h: 14 })) hurt(w, p, true);
    } else if (h.t === 'popper' && (w.frame + h.ph) % h.per === 0 && Math.abs(h.x - p.x) < 320) { shot(w, h.x + 4 + h.dir * 5, h.y - 4, h.dir * h.sp, -5.2, 0.2, 'gum', 300, 9, true); w.events.push('popper'); }
  }
  if (w.boss) bossStep(w, L, p, input);
  // projectiles
  for (const s of w.shots) {
    s.x += s.vx; s.vy += s.g; s.y += s.vy; s.life--;
    if (s.k !== 'spark' && s.k !== 'star' && solidAt(L, Math.floor((s.x + s.w / 2) / T), Math.floor((s.y + s.h / 2) / T))) s.life = 0;
    if (s.life > 0 && overlap(p, s)) {
      if (s.stomp && p.vy > 0 && p.y + p.h - p.vy <= s.y + 5) { s.life = 0; p.vy = input.jump ? -6.2 : -4.2; w.events.push('stomp'); }
      else hurt(w, p, true);
    }
  }
  w.shots = w.shots.filter((s) => s.life > 0 && s.y < L.h * T + 20);
  // pickups
  for (const it of w.ents) {
    if (it.got) continue;
    const box = { x: it.x + 2, y: it.y + 2, w: 12, h: 12 };
    if (it.t === 'goal') { box.y = it.y - 16; box.h = 32; if (w.boss && w.boss.hp > 0) continue; }
    if (it.t === 'check') { box.y = it.y - 8; box.h = 24; }
    if (it.t === 'switch') { box.y = it.y + 8; box.h = 8; const o = overlap(p, box); if (o && !it.on && p.vy >= 0) { w.sw ^= 1; w.events.push('switch'); } it.on = o; continue; }
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
// ------------------------------------------------------------------ bosses
function bossHit(w, B) {
  B.hp--; B.inv = 70; w.events.push('bosshit');
  if (B.hp <= 0) { B.dead = 1; w.shots = []; B.gust = 0; w.events.push('bossdown'); return; }
  if (B.k === 'bee' || B.k === 'cloud' || B.k === 'moth') setPh(B, B.k === 'bee' ? 'rise' : 'fly');
  if (B.k === 'cloud') setPh(B, 'float');
  if (B.k === 'owl') setPh(B, 'vanish');
}
const setPh = (B, ph) => { B.ph = ph; B.pt = 0; };
const approach = (v, t, s) => (Math.abs(t - v) <= s ? t : v + Math.sign(t - v) * s);
function bossStep(w, L, p, input) {
  const B = w.boss;
  if (B.hp <= 0) { if (B.dead) B.dead++; return; }
  if (!B.act) { if (p.x > B.ax0 + 8) { B.act = true; w.events.push('boss'); } else return; }
  B.t++; B.pt++; if (B.inv > 0) B.inv--;
  const pcx = p.x + p.w / 2, bcx = B.x + B.w / 2, toward = pcx < bcx ? -1 : 1; const dmg = B.max - B.hp;
  const cx = (B.ax0 + B.ax1) / 2, half = (B.ax1 - B.ax0) / 2 - B.w / 2 - 10;
  const clampX = () => { const lo = B.ax0 + 2, hi = B.ax1 - B.w - 2; if (B.x < lo) { B.x = lo; return -1; } if (B.x > hi) { B.x = hi; return 1; } return 0; };
  const floorY = B.fy - B.h; B.tang = true; B.gust = 0;
  switch (B.k) {
    case 'bullfrog':
      B.vuln = true;
      if (B.ph === 'start') setPh(B, 'sit');
      if (B.ph === 'sit') { B.y = floorY; if (B.pt > 70 - dmg * 15) { B.dir = toward; B.vy = -6.6; B.vx = B.dir * (1.25 + 0.3 * dmg); setPh(B, 'air'); } }
      else if (B.ph === 'air') {
        B.vy += 0.28; B.x += B.vx; if (clampX()) B.vx = -B.vx; B.y += B.vy;
        if (B.y >= floorY) { B.y = floorY; setPh(B, 'sit'); w.events.push('thump');
          shot(w, B.x - 10, B.fy - 9, -1.7, 0, 0, 'wave', 90); shot(w, B.x + B.w + 2, B.fy - 9, 1.7, 0, 0, 'wave', 90); }
      }
      break;
    case 'geode':
      B.y = floorY;
      if (B.ph === 'start') setPh(B, 'walk');
      if (B.ph === 'walk') { B.vuln = true; B.dir = toward; B.x += toward * 0.55; clampX(); if (B.pt > 110) setPh(B, 'curl'); }
      else if (B.ph === 'curl') { B.vuln = false; if (B.pt > 30) { B.vx = toward * (2.7 + 0.35 * dmg); B.n = 0; setPh(B, 'roll'); } }
      else if (B.ph === 'roll') { B.vuln = false; B.x += B.vx; B.dir = Math.sign(B.vx);
        if (clampX()) { B.vx = -B.vx; B.n++; w.events.push('thump'); shot(w, B.ax0 + 30 + ((B.n * 97 + B.t * 13) % Math.max(1, B.ax1 - B.ax0 - 60)), B.top, 0, 0, 0.12, 'shard', 300, 9); if (B.n >= 3) setPh(B, 'dizzy'); } }
      else if (B.ph === 'dizzy') { B.vuln = true; if (B.pt > 85) setPh(B, 'walk'); }
      break;
    case 'jelly':
      B.vuln = true;
      B.x = cx + Math.sin(B.t * 0.010) * half - B.w / 2; B.y = B.top + 2 * T + (0.5 - 0.5 * Math.cos(B.t * 0.021)) * 4 * T; B.dir = toward;
      if (B.t % (140 - dmg * 20) === 70) { for (const v of [-0.7, 0, 0.7]) shot(w, bcx - 4, B.y + B.h - 4, v, 0.8, 0, 'spark', 220); w.events.push('zap'); }
      break;
    case 'bee': {
      const hy = B.fy - 6.5 * T - B.h;
      if (B.ph === 'start') { B.y = hy; setPh(B, 'fly'); }
      B.vuln = B.ph === 'stuck'; B.dir = toward;
      if (B.ph === 'fly') { B.x = approach(B.x, cx + Math.sin(B.t * 0.02) * half - B.w / 2, 1.6); B.y = hy + Math.sin(B.t * 0.08) * 6;
        if (B.pt % 55 === 30) shot(w, bcx - 4, B.y + B.h, 0, 1.1, 0.03, 'pollen', 200);
        if (B.pt > 160 - dmg * 25) setPh(B, 'aim'); }
      else if (B.ph === 'aim') { B.x = approach(B.x, pcx - B.w / 2, 2.2); clampX(); if (B.pt > 28) setPh(B, 'dive'); }
      else if (B.ph === 'dive') { B.y += 4.2; if (B.y >= floorY) { B.y = floorY; setPh(B, 'stuck'); w.events.push('thump'); } }
      else if (B.ph === 'stuck') { if (B.pt > 80) setPh(B, 'rise'); }
      else if (B.ph === 'rise') { B.y -= 1.6; if (B.y <= hy) setPh(B, 'fly'); }
      break; }
    case 'cloud': {
      const hy = B.fy - 7 * T - B.h, low = B.fy - 2.2 * T;
      if (B.ph === 'start') { B.y = hy; setPh(B, 'float'); }
      B.vuln = B.ph === 'sag' && B.y >= low - 1; B.dir = toward;
      if (B.ph === 'float' || B.ph === 'rain') { B.x = approach(B.x, cx + Math.sin(B.t * 0.017) * half - B.w / 2, 1.5); B.y = approach(B.y, hy, 1.2); }
      if (B.ph === 'float') { if (dmg && B.pt > 50 && B.pt < 110) B.gust = pcx > bcx ? 0.55 : -0.55; if (B.pt > 130) setPh(B, 'rain'); }
      else if (B.ph === 'rain') { if (B.pt % 14 === 0) shot(w, B.x + 6 + ((B.pt * 7) % (B.w - 12)), B.y + B.h - 4, 0, 2.6, 0, 'rain', 160, 6); if (B.pt > 110) setPh(B, 'sag'); }
      else if (B.ph === 'sag') { B.y = approach(B.y, low, 1.4); if (B.pt > 175) setPh(B, 'float'); }
      break; }
    case 'walrus':
      B.y = floorY;
      if (B.ph === 'start') setPh(B, 'throw');
      if (B.ph === 'throw') { B.vuln = true; B.dir = toward;
        if (B.pt === 20 || B.pt === 55) { const vx = Math.max(-2.2, Math.min(2.2, (pcx - bcx) / 60)); shot(w, bcx - 4, B.y - 4, vx, -4.2, 0.14, 'snow', 200, 9); w.events.push('throw'); }
        if (B.pt > 85) setPh(B, 'prep'); }
      else if (B.ph === 'prep') { B.vuln = true; if (B.pt > 26) { B.vx = B.dir * (3 + 0.3 * dmg); setPh(B, 'slide'); } }
      else if (B.ph === 'slide') { B.vuln = false; B.x += B.vx; if (clampX()) { w.events.push('thump'); B.dir = -B.dir;
        for (let i = 0; i < 2; i++) shot(w, B.ax0 + 30 + ((B.t * 31 + i * 151) % Math.max(1, B.ax1 - B.ax0 - 60)), B.top, 0, 0, 0.12, 'shard', 300, 9); setPh(B, 'dizzy'); } }
      else if (B.ph === 'dizzy') { B.vuln = true; if (B.pt > 75) setPh(B, 'throw'); }
      break;
    case 'moth': {
      const hy = B.top + 2.5 * T;
      if (B.ph === 'start') { B.y = hy; setPh(B, 'fly'); }
      B.vuln = B.ph === 'rest'; B.dir = toward;
      if (B.ph === 'fly') { B.x = approach(B.x, cx + Math.sin(B.t * 0.018) * half - B.w / 2, 2); B.y = approach(B.y, hy + Math.sin(B.t * 0.036) * 1.5 * T, 2);
        if (B.pt % 45 === 20) shot(w, bcx - 4, B.y + B.h - 2, 0, 1.0, 0.03, 'ember', 220);
        if (B.pt > 230 - dmg * 20) setPh(B, 'land'); }
      else if (B.ph === 'land') { const [px, py] = B.perch; const tx = px * T + 8 - B.w / 2, ty = py * T - B.h; B.x = approach(B.x, tx, 2); B.y = approach(B.y, ty, 2); if (B.x === tx && B.y === ty) setPh(B, 'rest'); }
      else if (B.ph === 'rest') { if (B.pt > 95) setPh(B, 'fly'); }
      break; }
    case 'owl': {
      const pr = B.perch[B.pi]; const tx = pr[0] * T + 8 - B.w / 2, ty = pr[1] * T - B.h;
      if (B.ph === 'start') { B.x = tx; B.y = ty; setPh(B, 'appear'); }
      B.vuln = B.ph === 'rest'; B.dir = toward;
      if (B.ph === 'vanish') { B.tang = false; B.alpha = Math.max(0, 1 - B.pt / 25); if (B.pt > 30) { B.pi = (B.pi + 1 + (B.hp % 2)) % B.perch.length; const q = B.perch[B.pi]; B.x = q[0] * T + 8 - B.w / 2; B.y = q[1] * T - B.h; setPh(B, 'appear'); } }
      else if (B.ph === 'appear') { B.tang = false; B.alpha = Math.min(1, B.pt / 25); if (B.pt > 25) setPh(B, 'attack'); }
      else if (B.ph === 'attack') { B.alpha = 1;
        if (B.pt === 22) { const a0 = Math.atan2(p.y + p.h / 2 - (B.y + B.h / 2), pcx - bcx); const n = B.hp <= 2 ? 5 : 3;
          for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.3; shot(w, bcx - 4, B.y + B.h / 2 - 4, Math.cos(a) * 1.7, Math.sin(a) * 1.7, 0, 'star', 230); } w.events.push('zap'); }
        if (B.pt > 60) setPh(B, 'rest'); }
      else if (B.ph === 'rest') { B.alpha = 1; if (B.pt > 85) setPh(B, 'vanish'); }
      break; }
  }
  if (!B.tang || B.inv > 0) return;
  const box = { x: B.x + 2, y: B.y + 2, w: B.w - 4, h: B.h - 3 };
  if (overlap(p, box)) {
    if (B.vuln && p.vy > 0 && p.y + p.h - p.vy <= B.y + 10) { bossHit(w, B); p.vy = p.water ? -3 : input.jump ? -7 : -5.5; p.sq = 1.25; }
    else hurt(w, p, true);
  }
}
export const totals = (L) => ({ stars: L.ents.filter((e) => e.t === 'star').length, big: 3 });
