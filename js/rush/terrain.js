// Seeded endless terrain, special zones and pickups. Same seed + stage -> same track on every phone
// (online races share both). All DOM-free.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(seed, i) { let h = Math.imul((i | 0) ^ 0x27d4eb2d, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1); h = Math.imul(h ^ (h >>> 15), 0x85ebca77); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae3d); h ^= h >>> 16; return ((h >>> 0) / 4294967296) * 2 - 1; }
function noise(seed, x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(seed, i) * (1 - u) + hash(seed, i + 1) * u; }
const lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sm = (t) => t * t * (3 - 2 * t);

export const CHUNK = 40, STEP = 0.5, START_FLAT = 22, BLEND = 3;
export function checkpointAt(n) { let x = 0; for (let i = 1; i <= n; i++) x += 280 + i * 40; return x; } // 320, 680, 1080...

export function makeTerrain(seed, stage) {
  const A = stage.amp, R = stage.rough, S = stage.shape || {};
  const s1 = seed ^ 0x1234, s2 = seed ^ 0x5678, s3 = seed ^ 0x9abc, s4 = seed ^ 0xdef0;
  const wave = S.wave || 55;
  // ---- city: a row of buildings, each ending in a kicker ramp, then a small gap with a safety awning
  const blds = [];
  function cityBuild(upto) {
    if (!blds.length) blds.push({ x0: -60, x1: START_FLAT + 34, h: 0, ramp: 0.7, up: 0 });
    while (blds[blds.length - 1].x1 < upto) {
      const p = blds[blds.length - 1], d = p.x1, r = rng(seed ^ 0xc17c ^ (blds.length * 7919));
      if (p.up) { // stairs up: a sloped walkway onto a taller roof, no gap
        blds.push({ x0: d + 5, x1: d + 5 + 12 + r() * 16, h: p.h + p.up, ramp: 0.5 + r() * 0.5 + Math.min(0.4, d / 3000), up: r() < 0.4 ? 1 + r() * 1.4 : 0 }); continue; }
      const gap = 2.4 + Math.min(1.4, d / 1000) + r() * 1.1, top = p.h + p.ramp, h = top - 0.25 - r() * 1.6;
      blds.push({ x0: d + 4 + gap, x1: d + 4 + gap + 12 + r() * 18, h, ramp: 0.5 + r() * 0.5 + Math.min(0.4, d / 3000), up: r() < 0.4 ? 1 + r() * 1.4 : 0, gap });
    }
  }
  function cityH(x) {
    cityBuild(x + 80);
    let lo = 0, hi = blds.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (blds[m].x0 <= x) lo = m; else hi = m - 1; }
    const b = blds[lo], n = blds[lo + 1];
    if (x <= b.x1) return b.h; // flat roof
    if (b.up) return lerp(b.h, n.h, sm((x - b.x1) / (n.x0 - b.x1))); // walkway up
    if (x <= b.x1 + 4) { const u = (x - b.x1) / 4; return b.h + b.ramp * u * u; } // kicker ramp
    const top = b.h + b.ramp, gx = b.x1 + 4, w = n.x0 - gx, floor = n.h - 0.7, u = (x - gx) / w;
    return u < 0.25 ? lerp(top, floor, sm(u / 0.25)) : u > 0.5 ? lerp(floor, n.h, sm((u - 0.5) / 0.5)) : floor; // gap with a bouncy awning
  }
  function base(x) {
    if (S.city) return cityH(x);
    if (x < START_FLAT) return 0;
    const d = x - START_FLAT, ramp = Math.min(1, d / 900), ease = Math.min(1, d / 60);
    let big = noise(s1, d / wave);
    if (S.steep) big = sm(1 - Math.abs(noise(s1, d / wave))) * 1.1 - 0.55; // pointy peaks
    if (S.round) big = Math.sin(d / wave * 2.1 + noise(s1, d / 90) * 2) * 0.9; // round jelly humps
    let h = big * (5 + 9 * ramp) + noise(s2, d / 21) * (1.2 + 2.4 * ramp) * R + noise(s3, d / 6.5) * (0.25 + 0.55 * ramp) * R;
    h += d * (S.climb ?? 0.012);
    if (S.dunes) h += Math.max(0, noise(s4, d / 30)) * 4 * ramp;
    if (S.craters) { const c = noise(s4, d / 26); if (c > 0.35) h -= (c - 0.35) * 9; }
    return h * A * ease;
  }
  // ---- zones: at most one per 40 m chunk, kept inside the chunk so lookups stay local
  const zc = new Map();
  function zoneOf(i) {
    if (zc.has(i)) return zc.get(i);
    let z = null;
    if (i >= 1 && !S.city) {
      const r = rng(seed * 977 + i * 131 + 7);
      for (const def of [stage.zone, stage.zone2]) { if (z || !def) continue; if (r() >= def.p) { r(); continue; }
        const len = lerp(def.len[0], def.len[1], r()), x0 = i * CHUNK, a = x0 + BLEND + 1 + r() * (CHUNK - len - 2 * BLEND - 2);
        if (a < START_FLAT + 30) continue;
        z = { ...def, a, b: a + len, ya: base(a) + (def.lift || 0), yb: base(a + len) + (def.lift || 0) }; }
    }
    zc.set(i, z); if (zc.size > 400) zc.delete(zc.keys().next().value); return z;
  }
  const zoneAt = (x) => { const z = zoneOf(Math.floor(x / CHUNK)); return z && x >= z.a && x <= z.b ? z : null; };
  function zoneH(z, x) { const u = (x - z.a) / (z.b - z.a);
    if (z.flat) return lerp(z.ya, z.yb, u) - (z.sag || 0) * Math.sin(Math.PI * u);
    if (z.dip) return base(x) - z.dip * Math.sin(Math.PI * u);
    return base(x); }
  function at(x) {
    const z = zoneOf(Math.floor(x / CHUNK)); if (!z || !(z.flat || z.dip)) return base(x);
    if (x >= z.a && x <= z.b) return zoneH(z, x);
    if (z.flat && x > z.a - BLEND && x < z.a) return lerp(base(x), z.ya, sm((x - z.a + BLEND) / BLEND));
    if (z.flat && x < z.b + BLEND && x > z.b) return lerp(z.yb, base(x), sm((x - z.b) / BLEND));
    return base(x);
  }
  // lava surface / bridge-gap depth for the renderer
  function poolTop(z) { return Math.min(base(z.a), base(z.b)) - 0.2; }
  function zonesIn(x0, x1) { const out = []; for (let i = Math.floor(x0 / CHUNK); i <= Math.floor(x1 / CHUNK); i++) { const z = zoneOf(i); if (z) out.push(z); } return out; }
  function buildings(x0, x1) { if (!S.city) return []; cityBuild(x1 + 40); return blds.filter((b, i) => { const n = blds[i + 1]; return (n ? n.x0 : b.x1 + 10) >= x0 && b.x0 <= x1; }).map((b) => ({ ...b, next: blds[blds.indexOf(b) + 1] })); }
  const slope = (x) => (at(x + 0.25) - at(x - 0.25)) / 0.5;
  function pickups(i) {
    const r = rng(seed * 31 + i * 7919 + 17), out = [], x0 = i * CHUNK;
    if (x0 < START_FLAT) return out;
    const n = r() < 0.75 ? 1 : 2;
    for (let k = 0; k < n; k++) { const sx = x0 + 4 + r() * (CHUNK - 14), m = 3 + Math.floor(r() * 4); for (let j = 0; j < m; j++) { const x = sx + j * 1.3; out.push({ t: 'star', x, y: at(x) + 1.1 + Math.sin((j / Math.max(1, m - 1)) * Math.PI) * 0.9 }); } }
    if (r() < 0.12 + Math.min(0.1, x0 / 20000)) { const x = x0 + 8 + r() * (CHUNK - 16); out.push({ t: 'dia', x, y: at(x) + 2.6 + r() * 1.5 }); }
    return out;
  }
  function fuelXs(upto) { const r = rng(seed ^ 0xf00d), xs = []; let x = 120; while (x < upto) { xs.push(x); x += 150 + Math.min(110, x / 40) + r() * 50; } return xs; }
  return { y: at, at, base, slope, zoneAt, zonesIn, poolTop, buildings, pickups, fuelXs };
}
