// Pal Park play spots: bench / swing / slide / picnic seats, and the day's hidden stars.
// Pure math so the park can stay light and the positions can be tested without WebGL.
// A star is worth 5 Star Coins through the existing "park" earn (max 10 per write, 100 a day).

const TAU = Math.PI * 2;

function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One bench seat, facing away from the backrest (local +Z). Approach point is in front, off the collision box.
export function benchSpot(x, z, ry, gy) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  return {
    kind: 'bench', id: 'b',
    x: x + fx * 0.05, z: z + fz * 0.05, y: gy + 0.14, yaw: ry,
    ax: x + fx * 1.25, az: z + fz * 1.25, useY: gy
  };
}

// Swing seat. Matches the playground swing: pivot 3 m up, board 2.4 m below, rocking on X.
export function swingPose(play, y0, sx, i, t, still) {
  const rx = still ? 0 : Math.sin(t * 1.6 + i * 1.3) * 0.35;
  const px = play.x - 2 + sx, py = y0 + 3, pz = play.z - 7, hang = 2.4;
  return { x: px, y: py - hang * Math.cos(rx) - 0.08, z: pz - hang * Math.sin(rx), yaw: 0 };
}

export function swingSpot(play, y0, sx, i, gy) {
  const rest = swingPose(play, y0, sx, i, 0, true);
  return { kind: 'swing', id: 'sw' + i, sx, i, x: rest.x, z: rest.z, y: rest.y, yaw: 0, ax: rest.x, az: rest.z + 1.15, useY: gy };
}

// Slide: stand on the deck, ride down to the bottom. Smoothstep along the chute.
export function slideEnds(play, y0) {
  const topY = y0 + 2.4;
  return {
    use: { x: play.x + 0.9, z: play.z, y: topY },
    top: { x: play.x + 1.7, y: topY - 0.05, z: play.z, yaw: Math.PI / 2 },
    bot: { x: play.x + 5.65, y: y0 + 0.15, z: play.z, yaw: Math.PI / 2 }
  };
}

export function slideAt(ends, k) {
  const e = k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  return {
    x: ends.top.x + (ends.bot.x - ends.top.x) * e,
    y: ends.top.y + (ends.bot.y - ends.top.y) * e,
    z: ends.top.z + (ends.bot.z - ends.top.z) * e,
    yaw: ends.top.yaw
  };
}

// Four seats around a blanket, facing in, so friends can sit together.
export function picnicSeats(x, z, gy, id) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4, fx = Math.sin(a), fz = Math.cos(a);
    out.push({
      kind: 'picnic', id: id + i,
      x: x + fx * 0.8, z: z + fz * 0.8, y: gy + 0.02, yaw: a + Math.PI,
      ax: x + fx * 1.65, az: z + fz * 1.65, useY: gy
    });
  }
  return out;
}

// 6 hidden stars. Same places for everyone on a given UTC day, different the next day.
export function dailyStars(day, n = 6) {
  const R = rnd(Math.floor(day) * 9176 + 13);
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = R() * TAU;
    const rad = 18 + R() * 46;
    out.push({ id: 'star' + i, x: Math.cos(ang) * rad * (0.75 + R() * 0.45), z: Math.sin(ang) * rad });
  }
  return out;
}

export const STAR_COINS = 5;

// Nearest use-point. `y` keeps a deck prompt off the ground under the slide.
export function nearestSpot(spots, x, z, y, maxD = 1.25) {
  let best = null, bd = maxD;
  for (const s of spots) {
    const d = Math.hypot(s.ax - x, s.az - z);
    if (d < bd && Math.abs((s.useY ?? 0) - y) < 1.5) { bd = d; best = s; }
  }
  return best;
}
