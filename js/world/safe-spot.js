// Safe places to stand. Pure math (no three.js) so spawn, the Stuck button, and
// tests all agree. A mansion's porch roof sticks out past the invisible wall, so
// the old "front door" put the camera inside the house mesh: only sky, and no
// way to tell which way is out. Written by Lone Keem.
import { BOUNDS, FLAT, housesNear } from './layout.js';

const worldOf = (h, lx, lz) => [h.x + (h.face > 0 ? lx : -lx), h.z + (h.face > 0 ? lz : -lz)];
const localOf = (h, x, z) => [h.face > 0 ? x - h.x : h.x - x, h.face > 0 ? z - h.z : h.z - z];

// Local box around the solid house, including a mansion porch. +z faces the road.
export function houseShell(h) {
  const porch = h.estate ? 4.2 : 0.45;
  return { front: h.d / 2 + porch, back: h.d / 2 + (h.estate ? 1.2 : 0.45), side: h.w / 2 + (h.estate ? 6.4 : 0.45) };
}

export function insideShell(h, x, z, pad = 0) {
  if (!h || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  const [lx, lz] = localOf(h, x, z);
  const s = houseShell(h);
  return Math.abs(lx) < s.side + pad && lz < s.front + pad && lz > -s.back - pad;
}

export function houseAt(x, z, pad = 0.3) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  for (const h of housesNear(x, z, 42)) if (insideShell(h, x, z, pad)) return h;
  return null;
}

// Sidewalk in front of the porch, far enough that an 8 m camera aimed at the
// house stays outside the mesh. Player faces the door. Camera sits on the road.
export function doorSpot(h) {
  const lz = h.d / 2 + (h.estate ? 16 : 6.5);
  const [x, z] = worldOf(h, 0, lz);
  const yaw = h.face > 0 ? Math.PI : 0;
  return { x, z, yaw, cam: yaw + Math.PI };
}

export function positionBad(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  if (x < BOUNDS.x0 + 1 || x > BOUNDS.x1 - 1 || z < BOUNDS.z0 + 1 || z > BOUNDS.z1 - 1) return true;
  if (x > 392) return true;
  return !!houseAt(x, z, 0.3);
}

// House lots are paved at street level. Never leave the player under that pad.
export function standY(groundY, x, z) {
  let y = Number.isFinite(groundY) ? groundY : FLAT;
  for (const h of housesNear(x, z, 48)) {
    const reach = h.estate ? 40 : 14;
    if (Math.abs(x - h.x) < reach && Math.abs(z - h.z) < reach && y < FLAT) return FLAT;
  }
  return y;
}
