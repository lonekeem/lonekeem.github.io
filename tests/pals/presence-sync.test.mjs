// Car presence stays on the doc after a denied write, plates round-trip, and driving extrapolates farther than walking.
// Run: node tests/pals/presence-sync.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CAR_IDX } from '../../js/world/cars.js';
import {
  PRESENCE_GAP_MS, EXTRAP_DRIVE, presenceDeny, extrapSec, keepRemotePal, followGain,
  carWorldVel, presenceVelInt, plateCode, parsePlate, lookKey, inVehicle, afterPresenceDeny
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

assert.equal(extrapSec('walk', ''), 0.22);
assert.equal(extrapSec('drive', ''), EXTRAP_DRIVE);
assert.ok(extrapSec('idle', '~c501') > extrapSec('run', 'groove'), 'a car code extrapolates like driving');
assert.ok(EXTRAP_DRIVE > PRESENCE_GAP_MS / 1000, 'one late driving sample still moves');

assert.equal(keepRemotePal(true, '', 500, false), true);
assert.equal(keepRemotePal(false, 'groove', 10, false), false, 'a walker outside the nearest 30 is culled');
assert.equal(keepRemotePal(false, '~c501', 40, false), true, 'a driver stays visible with the car');
assert.equal(keepRemotePal(false, '~rabcdefgh', 40, false), true, 'a passenger stays visible');
assert.equal(keepRemotePal(false, '~c501', 400, false), false, 'a far car is still culled');
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
