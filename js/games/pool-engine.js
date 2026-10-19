// Star Pool engine: deterministic fixed-timestep table physics + 8-ball rules + computer player.
// Only + - * / and Math.sqrt are used inside the simulation so every browser computes the same
// result from the same quantized start positions and shot (vx, vy, spin). Table: x 0..1, y 0..2.
export const W = 1, H = 2, R = 0.0225, DT = 1 / 400;
const FRICTION = 1.25, RAIL_E = 0.78, BALL_E = 0.95, STOP = 0.004, MAX_T = 18;
export const MAX_SPEED = 4.8;
export const POCKETS = [
  { x: 0.004, y: 0.004, r: 0.062 }, { x: 0.996, y: 0.004, r: 0.062 },
  { x: -0.012, y: 1, r: 0.052 }, { x: 1.012, y: 1, r: 0.052 },
  { x: 0.004, y: 1.996, r: 0.062 }, { x: 0.996, y: 1.996, r: 0.062 }
];
export const FOOT = { x: 0.5, y: 0.5 }, HEAD = { x: 0.5, y: 1.5 }, KITCHEN_Y = 1.5;
export const groupOf = (id) => (id === 0 ? 'cue' : id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe');
const inMouth = (x, y) => {
  if ((x < 0.075 || x > W - 0.075) && (y < 0.075 || y > H - 0.075)) return true;
  if ((x < 0.06 || x > W - 0.06) && y > 1 - 0.05 && y < 1 + 0.05) return true;
  return false;
};

// ---- encoding: 16 balls, each "xxxxyyyy" (x*5000, y*5000) or "--------" when pocketed
const q = (v) => Math.max(0, Math.min(9999, Math.round(v * 5000)));
export function encode(balls) {
  return balls.map((b) => (b.on ? String(q(b.x)).padStart(4, '0') + String(q(b.y)).padStart(4, '0') : '--------')).join('');
}
export function decode(s) {
  const out = [];
  for (let i = 0; i < 16; i++) {
    const c = s.slice(i * 8, i * 8 + 8);
    out.push(c[0] === '-' ? { id: i, x: 0, y: 0, vx: 0, vy: 0, on: false } : { id: i, x: +c.slice(0, 4) / 5000, y: +c.slice(4) / 5000, vx: 0, vy: 0, on: true });
  }
  return out;
}
export function rack() {
  const rows = [[1], [10, 2], [3, 8, 11], [12, 4, 14, 5], [6, 13, 7, 15, 9]];
  const balls = Array.from({ length: 16 }, (_, id) => ({ id, x: 0, y: 0, vx: 0, vy: 0, on: true }));
  const dy = R * 1.7330 + 0.0006, dx = R + 0.0003;
  rows.forEach((row, r) => row.forEach((id, k) => { balls[id].x = FOOT.x + (k - (row.length - 1) / 2) * 2 * dx; balls[id].y = FOOT.y - r * dy; }));
  balls[0].x = HEAD.x; balls[0].y = HEAD.y + 0.08;
  return encode(balls);
}
export const newState = () => ({ groups: ['', ''], open: true, brk: true, bih: true, call: -1, msg: 'Break!', foul: false });

// ---- simulation. shot = { vx, vy, follow, side } ; returns { frames, events, balls }
export function simulate(start, shot, { record = true } = {}) {
  const b = start.map((o) => ({ ...o, vx: 0, vy: 0 }));
  const cue = b[0];
  cue.vx = shot.vx; cue.vy = shot.vy;
  const ev = { first: -1, railAfter: false, pocketed: [], pockets: {}, cueRails: 0 };
  let spinUsed = false;
  const frames = []; let t = 0, nextFrame = 0;
  const pushFrame = () => frames.push(b.map((o) => (o.on ? [o.x, o.y] : null)));
  if (record) pushFrame();
  const R2 = 4 * R * R;
  while (t < MAX_T) {
    let moving = false;
    for (const o of b) {
      if (!o.on) continue;
      const sp2 = o.vx * o.vx + o.vy * o.vy;
      if (sp2 === 0) continue;
      const sp = Math.sqrt(sp2), dec = FRICTION * DT;
      if (sp <= dec || sp < STOP) { o.vx = 0; o.vy = 0; continue; }
      const k = (sp - dec) / sp; o.vx *= k; o.vy *= k;
      o.x += o.vx * DT; o.y += o.vy * DT;
      moving = true;
      // pockets
      for (let p = 0; p < 6; p++) {
        const P = POCKETS[p], dx = o.x - P.x, dy = o.y - P.y;
        if (dx * dx + dy * dy < P.r * P.r) { o.on = false; o.vx = 0; o.vy = 0; ev.pocketed.push(o.id); ev.pockets[o.id] = p; break; }
      }
      if (!o.on) continue;
      // cushions (no cushion in the pocket mouths)
      if (!inMouth(o.x, o.y)) {
        let hit = 0;
        if (o.x < R) { o.x = 2 * R - o.x; o.vx = -o.vx * RAIL_E; hit = 1; }
        else if (o.x > W - R) { o.x = 2 * (W - R) - o.x; o.vx = -o.vx * RAIL_E; hit = 2; }
        if (o.y < R) { o.y = 2 * R - o.y; o.vy = -o.vy * RAIL_E; hit = hit || 3; }
        else if (o.y > H - R) { o.y = 2 * (H - R) - o.y; o.vy = -o.vy * RAIL_E; hit = hit || 4; }
        if (hit) {
          if (ev.first >= 0) ev.railAfter = true;
          if (o.id === 0 && shot.side) {
            // side spin ("english") kicks the cue ball along the rail
            const s = shot.side * 0.22 * Math.sqrt(o.vx * o.vx + o.vy * o.vy);
            if (hit <= 2) o.vy += hit === 1 ? -s : s; else o.vx += hit === 3 ? s : -s;
            ev.cueRails++;
          }
        }
      } else if (o.x < -0.05 || o.x > W + 0.05 || o.y < -0.05 || o.y > H + 0.05) { o.on = false; ev.pocketed.push(o.id); ev.pockets[o.id] = nearestPocket(o.x, o.y); }
    }
    // ball-ball collisions
    for (let i = 0; i < 16; i++) {
      const a = b[i]; if (!a.on) continue;
      for (let j = i + 1; j < 16; j++) {
        const c = b[j]; if (!c.on) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= R2 || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
        const overlap = (2 * R - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap; c.x += nx * overlap; c.y += ny * overlap;
        if (rel <= 0) continue;
        if (ev.first < 0 && (i === 0 || j === 0)) ev.first = i === 0 ? j : i;
        const pre = i === 0 ? [a.vx, a.vy] : null;
        const imp = rel * (1 + BALL_E) / 2;
        a.vx -= imp * nx; a.vy -= imp * ny; c.vx += imp * nx; c.vy += imp * ny;
        if (pre && !spinUsed && shot.follow) {
          // follow (top) carries the cue ball on; draw (back) pulls it back
          spinUsed = true;
          const k = shot.follow * 0.62 * imp / Math.max(rel, 1e-9);
          a.vx += pre[0] * k * 0.5; a.vy += pre[1] * k * 0.5;
        }
        moving = true;
      }
    }
    t += DT;
    if (record && t >= nextFrame) { pushFrame(); nextFrame += 1 / 60; }
    if (!moving) break;
  }
  if (record) pushFrame();
  b.forEach((o) => { o.vx = 0; o.vy = 0; });
  return { frames, events: ev, balls: b };
}
function nearestPocket(x, y) {
  let best = 0, bd = Infinity;
  POCKETS.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}
export function canPlace(balls, x, y, kitchen) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  if (kitchen && y < KITCHEN_Y) return false;
  return balls.every((o) => o.id === 0 || !o.on || (o.x - x) ** 2 + (o.y - y) ** 2 >= 4 * R * R * 1.02);
}
function spot8(balls) {
  const e = balls[8]; e.on = true; e.x = FOOT.x; e.y = FOOT.y;
  for (let k = 0; k < 60 && !canPlace(balls.map((o) => (o.id === 0 ? { ...o, id: 99 } : o)).filter((o) => o.id !== 8), e.x, e.y, false); k++) e.y += R * 0.5;
}
const remaining = (balls, g) => balls.filter((o) => o.on && groupOf(o.id) === g).length;
export const needsCall = (st, seat, balls) => !st.brk && !st.open && st.groups[seat] && remaining(balls, st.groups[seat]) === 0;

// Applies 8-ball rules to a finished shot. before = balls before, after = sim result.
export function judge(st, seat, before, after, ev) {
  const s = { ...st, groups: [...st.groups], foul: false, msg: '' };
  const own = s.groups[seat];
  const onEight = !s.open && own && remaining(before, own) === 0;
  const scratch = ev.pocketed.includes(0);
  const objs = ev.pocketed.filter((id) => id !== 0 && id !== 8);
  let foul = scratch || ev.first < 0, why = scratch ? 'Scratch' : ev.first < 0 ? 'No ball hit' : '';
  if (!s.brk && !foul) {
    const g = groupOf(ev.first);
    if (s.open && g === 'eight') { foul = true; why = 'Hit the 8 first'; }
    else if (!s.open && onEight && g !== 'eight') { foul = true; why = 'Must hit the 8 first'; }
    else if (!s.open && !onEight && g !== own) { foul = true; why = 'Wrong ball first'; }
  }
  if (!s.brk && !foul && !ev.railAfter && !ev.pocketed.length) { foul = true; why = 'No rail after contact'; }
  let winner = -1;
  const balls = after.map((o) => ({ ...o }));
  if (ev.pocketed.includes(8)) {
    if (s.brk) { spot8(balls); s.msg = '8 on the break: re-spotted. '; }
    else if (onEight && !foul && ev.pockets[8] === s.call) { winner = seat; s.msg = 'Star Pool! The 8 drops in the called pocket.'; }
    else { winner = 1 - seat; s.msg = foul ? `${why} on the 8: game over.` : s.call >= 0 && ev.pockets[8] !== s.call ? '8 in the wrong pocket: game over.' : '8 went down early: game over.'; }
  }
  if (scratch) { const c = balls[0]; c.on = true; c.x = HEAD.x; c.y = HEAD.y; for (let k = 0; k < 40 && !canPlace(balls, c.x, c.y, false); k++) c.x += R * 1.2 * (k % 2 ? -k : k); }
  if (s.open && !s.brk && !foul && objs.length) {
    const g = groupOf(objs[0]); s.groups[seat] = g; s.groups[1 - seat] = g === 'solid' ? 'stripe' : 'solid'; s.open = false;
    s.msg += `${g === 'solid' ? 'Solids' : 'Stripes'} for this player. `;
  }
  const mine = s.groups[seat];
  const ownIn = mine ? objs.filter((id) => groupOf(id) === mine).length : objs.length;
  const cont = winner < 0 && !foul && (s.brk || s.open ? objs.length > 0 : ownIn > 0);
  s.brk = false; s.call = -1; s.bih = foul; s.foul = foul;
  if (winner < 0) s.msg += foul ? `Foul: ${why}. Ball in hand.` : cont ? 'Nice pot, shoot again.' : objs.length ? 'Pocketed, but not yours.' : 'No pot.';
  return { st: s, balls, next: winner >= 0 ? seat : cont ? seat : 1 - seat, winner };
}

// ---- guide line ray cast from the cue ball along (dx, dy)
export function aimInfo(balls, dx, dy) {
  const c = balls[0]; let best = Infinity, hit = null;
  for (const o of balls) {
    if (!o.on || o.id === 0) continue;
    const fx = c.x - o.x, fy = c.y - o.y;
    const bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - 4 * R * R, disc = bq * bq - cq;
    if (disc < 0) continue;
    const t = -bq - Math.sqrt(disc);
    if (t > 0 && t < best) { best = t; hit = o; }
  }
  const walls = [dx < 0 ? (R - c.x) / dx : dx > 0 ? (W - R - c.x) / dx : Infinity, dy < 0 ? (R - c.y) / dy : dy > 0 ? (H - R - c.y) / dy : Infinity];
  const tw = Math.min(...walls);
  if (hit && best < tw) {
    const gx = c.x + dx * best, gy = c.y + dy * best;
    let nx = hit.x - gx, ny = hit.y - gy; const n = Math.sqrt(nx * nx + ny * ny) || 1; nx /= n; ny /= n;
    const dot = dx * nx + dy * ny; let tx = dx - dot * nx, ty = dy - dot * ny; const tn = Math.sqrt(tx * tx + ty * ty) || 1;
    return { ghost: { x: gx, y: gy }, ball: hit, obj: { x: nx, y: ny }, cue: { x: tx / tn, y: ty / tn }, cut: dot };
  }
  const ex = c.x + dx * tw, ey = c.y + dy * tw;
  return { wall: { x: ex, y: ey }, refl: walls[0] < walls[1] ? { x: -dx, y: dy } : { x: dx, y: -dy } };
}

// ---- computer player. Returns { vx, vy, follow, side, place?: {x,y}, call }
function clearPath(balls, ax, ay, bx, by, skip) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  for (const o of balls) {
    if (!o.on || skip.includes(o.id)) continue;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / L2));
    const px = ax + dx * t - o.x, py = ay + dy * t - o.y;
    if (px * px + py * py < 4 * R * R * 0.98) return false;
  }
  return true;
}
function targets(st, seat, balls) {
  const g = st.groups[seat];
  if (st.open || !g) return balls.filter((o) => o.on && o.id !== 0 && o.id !== 8).map((o) => o.id);
  const mine = balls.filter((o) => o.on && groupOf(o.id) === g).map((o) => o.id);
  return mine.length ? mine : [8];
}
function candidates(st, seat, balls, cx, cy) {
  const out = [];
  for (const id of targets(st, seat, balls)) {
    const o = balls[id];
    POCKETS.forEach((P, p) => {
      const px = P.x < 0 ? 0.01 : P.x > 1 ? 0.99 : P.x, py = P.y;
      let ux = px - o.x, uy = py - o.y; const d2 = Math.sqrt(ux * ux + uy * uy); ux /= d2; uy /= d2;
      const gx = o.x - ux * 2 * R, gy = o.y - uy * 2 * R;
      let ax = gx - cx, ay = gy - cy; const d1 = Math.sqrt(ax * ax + ay * ay); if (d1 < 1e-6) return; ax /= d1; ay /= d1;
      const cut = ax * ux + ay * uy;
      if (cut < 0.28) return;
      if (!clearPath(balls, cx, cy, gx, gy, [0, id]) || !clearPath(balls, o.x, o.y, px, py, [0, id])) return;
      const sidePenalty = P.y === 1 ? 0.75 + 0.25 * Math.abs(ux) : 1;
      out.push({ id, p, ax, ay, d1, d2, score: cut * cut * sidePenalty / (0.35 + d1 + d2 * 1.4) });
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
export function aiShot(st, seat, balls, level = 'hard', rand = Math.random) {
  const noise = { easy: 0.07, medium: 0.03, hard: 0.006 }[level] || 0.006;
  const b = balls.map((o) => ({ ...o }));
  let place = null;
  if (st.bih) {
    // ball in hand: try spots and keep the one with the best pot
    const spots = [];
    for (let i = 0; i < (level === 'easy' ? 6 : 40); i++) spots.push({ x: R + rand() * (W - 2 * R), y: (st.brk ? KITCHEN_Y : R) + rand() * ((st.brk ? H - R - KITCHEN_Y : H - 2 * R)) });
    let bestS = -1;
    for (const s of spots) {
      if (!canPlace(b, s.x, s.y, st.brk)) continue;
      const c = st.brk ? 0.5 : (candidates(st, seat, b, s.x, s.y)[0] || { score: 0 }).score;
      if (c > bestS) { bestS = c; place = s; }
    }
    if (!place) place = { x: b[0].x, y: b[0].y };
    b[0].x = place.x; b[0].y = place.y; b[0].on = true;
  }
  const c = b[0];
  if (st.brk) {
    const o = b[1]; let ax = o.x - c.x + (rand() - 0.5) * 0.01, ay = o.y - c.y; const n = Math.sqrt(ax * ax + ay * ay);
    return { vx: ax / n * MAX_SPEED, vy: ay / n * MAX_SPEED, follow: 0, side: 0, place, call: -1 };
  }
  let list = candidates(st, seat, b, c.x, c.y);
  let pick = list[0];
  if (level === 'hard' && list.length > 1) {
    // check the top few with the real engine; prefer ones that pot without a foul
    for (const cand of list.slice(0, 4)) {
      const sp = Math.min(MAX_SPEED, 1.2 + (cand.d1 + cand.d2) * 1.5);
      const r = simulate(b, { vx: cand.ax * sp, vy: cand.ay * sp, follow: 0, side: 0 }, { record: false });
      if (r.events.pocketed.includes(cand.id) && !r.events.pocketed.includes(0)) { pick = cand; break; }
    }
  }
  if (!pick) {
    // safety: roll into one of our balls
    const id = targets(st, seat, b).map((i) => b[i]).sort((x, y) => ((x.x - c.x) ** 2 + (x.y - c.y) ** 2) - ((y.x - c.x) ** 2 + (y.y - c.y) ** 2))[0];
    const o = id || b.find((x) => x.on && x.id !== 0);
    let ax = o.x - c.x, ay = o.y - c.y; const n = Math.sqrt(ax * ax + ay * ay);
    return { vx: ax / n * 2.2, vy: ay / n * 2.2, follow: 0, side: 0, place, call: needsCall(st, seat, b) ? 4 : -1 };
  }
  const ang = (rand() - 0.5) * 2 * noise;
  const ax = pick.ax - pick.ay * ang, ay = pick.ay + pick.ax * ang, n = Math.sqrt(ax * ax + ay * ay);
  const sp = Math.min(MAX_SPEED, 1.15 + (pick.d1 + pick.d2 * 1.2) * 1.45 + (level === 'easy' ? rand() * 0.6 : 0));
  return { vx: ax / n * sp, vy: ay / n * sp, follow: level === 'hard' ? -0.2 : 0, side: 0, place, call: pick.id === 8 ? pick.p : -1 };
}
