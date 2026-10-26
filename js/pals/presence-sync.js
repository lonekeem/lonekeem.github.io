// Shared presence decisions for Pal Park / Kemy World.
// The Firestore rule rejects a presence write until 70ms after the previous one.
// Callers wait PRESENCE_GAP_MS after each ack so a fast reply cannot trip that rule.
// A denied write must not drop vx/dn: the next setDoc replaces the whole doc, and
// without dn everyone else's car (and dance) disappears.

export const PRESENCE_GAP_MS = 120;
// Rules reject a second presence write until 70ms after the previous one.
// 80ms after the ack is about 12 writes/s while driving (inside the 10–15/s window).
export const PRESENCE_GAP_DRIVE_MS = 80;
export const PRESENCE_DENY_MS = 300;
export const EXTRAP_WALK = 0.22;
export const EXTRAP_DRIVE = 0.28;
// Heartbeat must land well before the local stale drop, or a still Pal (and their car) vanishes and pops back.
export const HEARTBEAT_MS = 5000;
export const STALE_PRESENCE_MS = 20000;
export const RENDER_BEHIND_MS = 130;
export const CAR_SNAP_M = 12;

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
// Still denied after 3 tries: send the bare pose (no extras) for a while so I never vanish for others,
// then put the extras back (RECOVER_MS). Silent: players never see a "too fast" style message.
export const RECOVER_MS = 15000;
export function afterPresenceDeny(streak, sendingPlate) {
  const n = (streak || 0) + 1;
  return { streak: n, dropPlate: !!(sendingPlate && n >= 2), bare: n >= 3 };
}

export function extrapSec(an, dn) {
  const car = an === 'drive' || inVehicle(dn);
  return car ? EXTRAP_DRIVE : EXTRAP_WALK;
}

export function presenceGapMs(driving) {
  return driving ? PRESENCE_GAP_DRIVE_MS : PRESENCE_GAP_MS;
}

function angDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

// Render a pose buffer `delay` ms behind `now` (100–150ms). Between snapshots the
// position and heading are linear, so a noisy velocity cannot bow the car off the
// path. A short gap past the newest snapshot is dead-reckoned from velocity and
// heading rate, then held.
export function samplePose(buf, now, delay = RENDER_BEHIND_MS, extrap = EXTRAP_DRIVE) {
  if (!buf || !buf.length || !Number.isFinite(now)) return null;
  const rt = now - delay;
  const n = buf.length;
  const pose = (x, z, yaw, vx, vz) => ({ x, z, yaw: yaw || 0, vx: vx || 0, vz: vz || 0 });
  if (rt <= buf[0].t) {
    const a = buf[0];
    return pose(a.x, a.z, a.yaw, a.vx, a.vz);
  }
  const last = buf[n - 1];
  if (rt >= last.t) {
    const ahead = (rt - last.t) / 1000;
    const ah = Math.max(0, Math.min(extrap, ahead));
    let w = 0;
    if (n >= 2 && buf[n - 2].yaw != null && last.yaw != null) {
      const prev = buf[n - 2];
      w = angDelta(prev.yaw, last.yaw) / Math.max(0.001, (last.t - prev.t) / 1000);
    }
    const live = ahead <= extrap + 1e-6;
    return pose(last.x + (last.vx || 0) * ah, last.z + (last.vz || 0) * ah, (last.yaw || 0) + w * ah, live ? last.vx : 0, live ? last.vz : 0);
  }
  let i = 0;
  while (i < n - 2 && buf[i + 1].t < rt) i++;
  const a = buf[i], b = buf[i + 1];
  const span = Math.max(1, b.t - a.t);
  const u = Math.max(0, Math.min(1, (rt - a.t) / span));
  const yaw = a.yaw == null || b.yaw == null ? (a.yaw ?? b.yaw ?? 0) : a.yaw + angDelta(a.yaw, b.yaw) * u;
  const s1 = Math.max(0.001, span / 1000);
  return pose(a.x + (b.x - a.x) * u, a.z + (b.z - a.z) * u, yaw, (b.x - a.x) / s1, (b.z - a.z) / s1);
}

// Show the interpolated pose. Jump only when it is a real teleport, not a 1-frame correction.
export function takePose(cur, next, snapM = CAR_SNAP_M) {
  if (!next) return cur;
  if (!cur || Math.hypot(next.x - cur.x, next.z - cur.z) > snapM) return { ...next, snap: true };
  return { x: next.x, z: next.z, yaw: next.yaw, vx: next.vx, vz: next.vz, snap: false };
}

export function inVehicle(dn) {
  const k = typeof dn === 'string' ? dn.slice(0, 2) : '';
  return k === '~c' || k === '~r';
}

// The nearest-30 cap hides a driver while the car mesh still draws. Keep the pal
// when they are in a car (or a passenger) out to the same distance the car stays drawn.
export function keepRemotePal(inNearest, dn, dist, low) {
  if (inNearest) return true;
  if (!inVehicle(dn)) return false;
  return dist < (low ? 110 : 190);
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
    return Math.max(-600, Math.min(600, r)) || 0; // never -0 (stored as a double, denied by `is int`)
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
