// Car presence stays on the doc after a denied write, plates round-trip, and driving extrapolates farther than walking.
// Run: node tests/pals/presence-sync.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAR_IDX } from '../../js/world/cars.js';
import {
  PRESENCE_GAP_MS, PRESENCE_GAP_DRIVE_MS, EXTRAP_DRIVE, presenceDeny, extrapSec, keepRemotePal, followGain,
  carWorldVel, presenceVelInt, plateCode, parsePlate, lookKey, inVehicle, afterPresenceDeny,
  presenceGapMs, samplePose, takePose, HEARTBEAT_MS, STALE_PRESENCE_MS, RENDER_BEHIND_MS, CAR_SNAP_M
} from '../../js/pals/presence-sync.js';

const denied = presenceDeny({ indoors: false, inDen: 2 });
assert.equal(denied.dropExtras, false, 'a denied write must keep the car code and velocity');
assert.ok(denied.waitMs >= PRESENCE_GAP_MS, 'backoff stays above the 70ms presence rule');
assert.equal(denied.giveUpInside, false);

const inside = presenceDeny({ indoors: true, inDen: 2 });
assert.equal(inside.dropExtras, false, 'indoors also keeps dn');
assert.equal(inside.giveUpInside, true);
assert.equal(inside.inDen, 3);
assert.equal(afterPresenceDeny(0, true).dropPlate, false, 'one denial can be the rate limit');
assert.equal(afterPresenceDeny(1, true).dropPlate, true, 'a second denial drops only the plate');
assert.equal(afterPresenceDeny(1, false).dropPlate, false);
assert.equal(afterPresenceDeny(1, false).bare, false, 'two denials keep the extras');
assert.equal(afterPresenceDeny(2, false).bare, true, 'a third denial sends the bare pose so I stay visible');

assert.equal(extrapSec('walk', ''), 0.22);
assert.equal(extrapSec('drive', ''), EXTRAP_DRIVE);
assert.ok(extrapSec('idle', '~c501') > extrapSec('run', 'groove'), 'a car code extrapolates like driving');
assert.ok(EXTRAP_DRIVE > PRESENCE_GAP_MS / 1000, 'one late driving sample still moves');

assert.equal(keepRemotePal(true, '', 500, false), true);
assert.equal(keepRemotePal(false, 'groove', 10, false), false, 'a walker outside the nearest 30 is culled');
assert.equal(keepRemotePal(false, '~c501', 40, false), true, 'a driver stays visible with the car');
assert.equal(keepRemotePal(false, '~rabcdefgh', 40, false), true, 'a passenger stays visible');
assert.equal(keepRemotePal(false, '~c501', 180, false), true, 'a pal stays with a car that is still drawn');
assert.equal(keepRemotePal(false, '~c501', 400, false), false, 'a far car is still culled');
assert.equal(presenceGapMs(false), PRESENCE_GAP_MS);
assert.equal(presenceGapMs(true), PRESENCE_GAP_DRIVE_MS);
assert.ok(PRESENCE_GAP_DRIVE_MS > 70, 'drive writes stay above the 70ms rule');
assert.ok(1000 / PRESENCE_GAP_DRIVE_MS >= 10 && 1000 / PRESENCE_GAP_DRIVE_MS <= 15, 'about 12 car updates a second');
assert.ok(HEARTBEAT_MS * 2 < STALE_PRESENCE_MS, 'one missed heartbeat must not hide a still Pal');
assert.ok(RENDER_BEHIND_MS >= 100 && RENDER_BEHIND_MS <= 150);
assert.equal(extrapSec('idle', '~rabcdefgh'), EXTRAP_DRIVE, 'a passenger extrapolates like a car');
assert.equal(CAR_SNAP_M, 12);

const mid = samplePose([{ t: 0, x: 0, z: 0, yaw: 0, vx: 0, vz: 10 }, { t: 1000, x: 0, z: 10, yaw: 0, vx: 0, vz: 10 }], 630, 130, 0.28);
assert.ok(Math.abs(mid.x) < 1e-9 && Math.abs(mid.z - 5) < 1e-9, 'cars render halfway between snapshots');
const coast = samplePose([{ t: 0, x: 0, z: 0, yaw: 0, vx: 0, vz: 10 }], 230, 130, 0.28);
assert.ok(Math.abs(coast.z - 1) < 1e-9, 'a short gap dead-reckons from velocity');
const held = samplePose([{ t: 0, x: 0, z: 0, yaw: 0, vx: 0, vz: 10 }], 2000, 130, 0.28);
assert.ok(Math.abs(held.z - 2.8) < 1e-9 && held.vz === 0, 'a long gap holds instead of flying off');
const snapFar = takePose({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 20, yaw: 0 });
const snapNear = takePose({ x: 0, z: 0, yaw: 0 }, { x: 0, z: 1, yaw: 0.2 });
assert.equal(snapFar.snap, true);
assert.equal(snapNear.snap, false);

// Before: Hermite bows off the road when the sent velocity does not match the position step.
// After: the shown pose stays on the straight line between snapshots.
function hermite(a, b, u) {
  const s1 = (b.t - a.t) / 1000, u2 = u * u, u3 = u2 * u;
  const h1 = 2 * u3 - 3 * u2 + 1, h2 = -2 * u3 + 3 * u2, h3 = u3 - 2 * u2 + u, h4 = u3 - u2;
  return { x: h1 * a.x + h2 * b.x + (h3 * a.vx + h4 * b.vx) * s1, z: h1 * a.z + h2 * b.z + (h3 * a.vz + h4 * b.vz) * s1 };
}
const speed = 12, buf = [];
for (let i = 0; i < 40; i++) buf.push({ t: i * 80, x: 0, z: speed * i * 0.08, yaw: 0, vx: (i % 2 ? 40 : -40), vz: speed });
function track(kind) {
  const pts = [];
  for (let now = 500; now < 2800; now += 16) {
    const rt = now - 130;
    if (kind === 'old') {
      let a = buf[0], b = null;
      for (let i = 0; i < buf.length - 1; i++) if (buf[i].t <= rt && buf[i + 1].t >= rt) { a = buf[i]; b = buf[i + 1]; break; }
      if (!b) continue;
      pts.push(hermite(a, b, (rt - a.t) / (b.t - a.t)));
    } else pts.push(samplePose(buf, now, 130, 0.28));
  }
  let acc = 0, n = 0, peak = 0, lateral = 0, prev = null;
  for (const p of pts) {
    lateral = Math.max(lateral, Math.abs(p.x));
    if (prev) {
      const step = Math.hypot(p.x - prev.x, p.z - prev.z);
      if (prev.step != null) { const j = Math.abs(step - prev.step); acc += j; n++; peak = Math.max(peak, j); }
      prev = { ...p, step };
    } else prev = { ...p, step: null };
  }
  return { meanJerk: acc / n, peak, lateral };
}
const before = track('old'), after = track('new');
assert.ok(before.lateral > 0.4, 'the old Hermite path leaves the road');
assert.ok(after.lateral < 0.02, 'the new path stays on the road');
assert.ok(after.meanJerk < before.meanJerk, 'passenger step-to-step jitter drops');
console.log('ride jitter before', before, 'after', after);
assert.equal(inVehicle('~c501'), true);
assert.equal(inVehicle('groove'), false);

assert.ok(followGain(1 / 60, true, true) > followGain(1 / 60, false, true));
assert.ok(followGain(1 / 60, true, true) > 0.9);

const fwd = carWorldVel(0, 10, 0);
assert.ok(Math.abs(fwd.x) < 1e-9 && Math.abs(fwd.z - 10) < 1e-9);
const side = carWorldVel(0, 0, 4);
assert.ok(Math.abs(side.x - 4) < 1e-9 && Math.abs(side.z) < 1e-9);
const top = presenceVelInt(48, -80);
assert.deepEqual(top, { vx: 480, vz: -600 }, 'sent velocity stays inside the ±60 m/s rule');

const code = plateCode({ t: 'kemy 1!', b: 0, f: 14, r: 9, fr: 1 });
assert.equal(code, '5KEMY10e91');
assert.equal(code.length <= 12, true);
assert.deepEqual(parsePlate(code), { t: 'KEMY1', b: 0, f: 14, r: 9, fr: 1 });
assert.equal(plateCode({ t: '' }), '');
assert.equal(parsePlate('hello'), null);
assert.equal(parsePlate('5KE MY0e91'), null);

const driveSrc = readFileSync(new URL('../../js/world/drive.js', import.meta.url), 'utf8');
const parkSrc = readFileSync(new URL('../../js/pals/park3d.js', import.meta.url), 'utf8');
assert.match(driveSrc, /export const carCode = \(id, color, door\) => '~c' \+ CAR_IDX\.indexOf\(id\)\.toString\(36\) \+ \(color \| 0\)\.toString\(36\) \+ \(door \? '1' : '0'\);/);
assert.match(parkSrc, /presenceDeny\(/);
assert.doesNotMatch(parkSrc, /extras = false; dirty = true; lastSend = 0/, 'a denied write no longer deletes the car code');
const carCode = (id, color, door) => '~c' + CAR_IDX.indexOf(id).toString(36) + (color | 0).toString(36) + (door ? '1' : '0');
const parseCar = (dn) => { if (!dn || dn.slice(0, 2) !== '~c' || dn.length < 5) return null; const id = CAR_IDX[parseInt(dn[2], 36)]; if (!id) return null; return { id, color: parseInt(dn[3], 36) || 0, door: dn[4] === '1' }; };
const dn = carCode('pip', 5, true) + 'oabcdefgh';
assert.ok(dn.length <= 20, 'car + rider still fits the dn rule');
assert.equal(dn.slice(0, 2), '~c');
const parsed = parseCar(dn);
assert.equal(parsed.id, 'pip');
assert.equal(parsed.color, 5);
assert.equal(parsed.door, true);

const a = lookKey({ species: 'kemy', outfit: { hat: 'crown' }, colors: { body: '#fff' } });
const b = lookKey({ species: 'kemy', outfit: { hat: 'cap' }, colors: { body: '#fff' } });
const c = lookKey({ species: 'kemy', outfit: { hat: 'crown' }, colors: { body: '#000' } });
assert.notEqual(a, b);
assert.notEqual(a, c);

console.log('presence sync tests ok');
