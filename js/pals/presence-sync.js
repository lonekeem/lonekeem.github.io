// Shared presence decisions for Pal Park / Kemy World.
// The Firestore rule rejects a presence write until 70ms after the previous one.
// Callers wait PRESENCE_GAP_MS after each ack so a fast reply cannot trip that rule.
// A denied write must not drop vx/dn: the next setDoc replaces the whole doc, and
// without dn everyone else's car (and dance) disappears.

export const PRESENCE_GAP_MS = 120;
export const PRESENCE_DENY_MS = 300;
export const EXTRAP_WALK = 0.22;
export const EXTRAP_DRIVE = 0.55;

export function presenceDeny({ indoors, inDen } = {}) {
  if (indoors) {
    const n = (inDen || 0) + 1;
    return { dropExtras: false, waitMs: 400, inDen: n, giveUpInside: n >= 3 };
  }
  return { dropExtras: false, waitMs: PRESENCE_DENY_MS, inDen: 0, giveUpInside: false };
}

// A denied write is usually the 70ms rule (the next try, after the wait, succeeds).
// If it keeps failing, the new plate field is the likely cause (rules not deployed yet).
// Stop sending the plate and keep the car code. Never drop dn/velocity.
export function afterPresenceDeny(streak, sendingPlate) {
  const n = (streak || 0) + 1;
  return { streak: n, dropPlate: !!(sendingPlate && n >= 2) };
}

export function extrapSec(an, dn) {
  const car = an === 'drive' || (typeof dn === 'string' && dn.slice(0, 2) === '~c');
  return car ? EXTRAP_DRIVE : EXTRAP_WALK;
}

export function inVehicle(dn) {
  const k = typeof dn === 'string' ? dn.slice(0, 2) : '';
  return k === '~c' || k === '~r';
}

// The nearest-30 cap hides a driver while the car mesh still draws. Keep the pal
// when they are in a car (or a passenger) and still inside the car's draw distance.
export function keepRemotePal(inNearest, dn, dist, low) {
  if (inNearest) return true;
  if (!inVehicle(dn)) return false;
  return dist < (low ? 90 : 160);
}

// Remote cars already follow an interpolated pose. Driving uses a higher gain so
// that second smooth does not leave the car a step behind.
export function followGain(dt, drive, hasBuf) {
  const rate = hasBuf ? (drive ? 60 : 24) : (drive ? 18 : 12);
  return Math.min(1, Math.max(0, dt) * rate);
}

export function carWorldVel(yaw, vf, vl) {
  const sy = Math.sin(yaw), cy = Math.cos(yaw), side = vl || 0;
  return { x: sy * vf + cy * side, z: cy * vf - sy * side };
}

export function presenceVelInt(vx, vz) {
  const c = (n) => {
    const r = Math.round(Number(n) * 10);
    if (!Number.isFinite(r)) return 0;
    return Math.max(-600, Math.min(600, r));
  };
  return { vx: c(vx), vz: c(vz) };
}

// Plate on the presence doc: length digit, 1–7 letters, then 4 hex colour/frame nibbles.
// Fits the rules (max 12) and does not need its own write.
export function plateCode(p) {
  if (!p || !p.t) return '';
  const t = String(p.t).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (!t) return '';
  const hex = (n) => Math.max(0, Math.min(15, n | 0)).toString(16);
  return String(t.length) + t + hex(p.b) + hex(p.f) + hex(p.r) + hex(p.fr);
}

export function parsePlate(s) {
  if (!s || typeof s !== 'string') return null;
  const n = parseInt(s[0], 10);
  if (!(n >= 1 && n <= 7) || s.length !== 1 + n + 4) return null;
  const t = s.slice(1, 1 + n);
  if (!/^[A-Z0-9]+$/.test(t)) return null;
  const nums = [1, 2, 3, 4].map((i) => parseInt(s[n + i], 16));
  if (nums.some((x) => Number.isNaN(x))) return null;
  return { t, b: nums[0], f: nums[1], r: nums[2], fr: nums[3] };
}

export function lookKey(p) {
  if (!p) return '';
  return JSON.stringify([p.species || '', p.variant || '', p.pattern || '', p.acc || '', p.level || 1, p.colors || {}, p.outfit || {}]);
}
