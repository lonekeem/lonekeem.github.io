// Furniture picking for Decorate mode. Pure math so a tap, a walk-up, and a test
// all use the same boxes. Piece positions stay in plan units; the room scale
// turns them into world metres. Written by Lone Keem.
import { DECOR, placeItem } from './interior.js';

const PAD = 0.28;

export function itemAabb(it, SC, cx, cz, baseY) {
  const D = DECOR[it.c];
  if (!D) return null;
  let minX = 0, maxX = 0, minY = 0, maxY = 0.2, minZ = 0, maxZ = 0;
  for (const part of D.p) {
    const x = part[2], y = part[3], z = part[4], sx = part[5], sy = part[6], sz = part[7];
    minX = Math.min(minX, x - sx / 2); maxX = Math.max(maxX, x + sx / 2);
    minY = Math.min(minY, y - sy / 2); maxY = Math.max(maxY, y + sy / 2);
    minZ = Math.min(minZ, z - sz / 2); maxZ = Math.max(maxZ, z + sz / 2);
  }
  const th = ((it.r | 0) & 3) * Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of [[minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ]]) {
    const wx = x * c + z * s, wz = -x * s + z * c;
    x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz);
  }
  const ox = cx + it.x * SC, oz = cz + it.z * SC;
  return { x0: ox + x0 - PAD, x1: ox + x1 + PAD, y0: baseY + minY, y1: baseY + Math.max(0.4, maxY) + 0.12, z0: oz + z0 - PAD, z1: oz + z1 + PAD };
}

export function rayHitAabb(o, d, b) {
  let tmin = 0, tmax = 1e9;
  const axes = [['x', 'x0', 'x1'], ['y', 'y0', 'y1'], ['z', 'z0', 'z1']];
  for (const [k, a0, a1] of axes) {
    const oc = o[k], dc = d[k];
    if (Math.abs(dc) < 1e-8) { if (oc < b[a0] || oc > b[a1]) return null; continue; }
    let t1 = (b[a0] - oc) / dc, t2 = (b[a1] - oc) / dc;
    if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return tmin >= 0 ? tmin : tmax;
}

export function pickIndex(items, origin, dir, aabbOf) {
  let best = -1, bt = 1e9;
  items.forEach((it, i) => {
    const b = aabbOf(it);
    if (!b) return;
    const t = rayHitAabb(origin, dir, b);
    if (t != null && t < bt) { bt = t; best = i; }
  });
  return best;
}

export function xzGap(px, pz, b) {
  const dx = px < b.x0 ? b.x0 - px : px > b.x1 ? px - b.x1 : 0;
  const dz = pz < b.z0 ? b.z0 - pz : pz > b.z1 ? pz - b.z1 : 0;
  return Math.hypot(dx, dz);
}

// Reach is measured to the piece, not its centre, so a sofa you are standing
// against still counts when its middle is more than a couple of metres away.
export function nearestReach(items, px, pz, aabbOf, reach = 1.25) {
  let best = -1, bd = reach;
  items.forEach((it, i) => {
    const b = aabbOf(it);
    if (!b) return;
    const d = xzGap(px, pz, b);
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

// 0.5 grid, kept inside the room. Large pieces are pulled in again by placeItem
// so a sofa foot cannot stick through the wall.
export function clampPlan(v) { return Math.max(-5.5, Math.min(5.5, Math.round(v * 2) / 2)); }

// A removed piece goes into house storage when the room now has fewer of that
// starter than the house came with. Bought extras stay in the shop inventory.
export function stashOnRemove(code, base, placedAfter, stash) {
  const stored = stash.filter((c) => c === code).length;
  const need = (base[code] || 0) - placedAfter;
  if (need > stored) stash.push(code);
  return stash;
}

export function nudgePlan(it, dx, dz) {
  it.x += dx;
  it.z += dz;
  return placeItem(it);
}

// sx/sy are screen steps: +sx right, +sy down. Forward on screen is away from the camera.
export function screenStep(sx, sy, basis) {
  const wx = basis.rx * sx - basis.fx * sy;
  const wz = basis.rz * sx - basis.fz * sy;
  if (Math.abs(wx) >= Math.abs(wz)) return { dx: Math.sign(wx) * 0.5, dz: 0 };
  return { dx: 0, dz: Math.sign(wz) * 0.5 };
}
