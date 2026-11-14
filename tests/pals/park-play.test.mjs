// Pal Park benches, swings, slide, picnic seats and daily stars.
// Run: node tests/pals/park-play.test.mjs
import assert from 'node:assert/strict';
import { benchSpot, swingPose, picnicSeats, dailyStars, nearestSpot, slideAt, slideEnds, STAR_COINS } from '../../js/pals/park-play.js';

const b = benchSpot(10, 0, 0, 2);
assert.ok(b.z > 0, 'seat faces outward, in front of the backrest');
assert.ok(b.az > b.z, 'the Sit spot is further in front than the seat');
assert.equal(b.yaw, 0);
assert.ok(Math.hypot(b.ax - 10, b.az) > 1, 'approach clears the bench box');

const rest = swingPose({ x: 48, z: -36 }, 2.2, -1, 0, 0, true);
const mid = swingPose({ x: 48, z: -36 }, 2.2, -1, 0, 0.5, false);
assert.ok(Math.abs(mid.z - rest.z) > 0.05, 'a swing seat moves');
assert.equal(swingPose({ x: 48, z: -36 }, 2.2, -1, 0, 5, true).z, rest.z);

const seats = picnicSeats(0, 0, 2, 'p');
assert.equal(seats.length, 4);
const ids = new Set(seats.map((s) => s.x.toFixed(2) + ',' + s.z.toFixed(2)));
assert.equal(ids.size, 4, 'picnic seats do not stack');
assert.ok(seats.every((s) => Math.hypot(s.x, s.z) < 1), 'seats stay on the blanket');

const day = 20000;
const a = dailyStars(day), c = dailyStars(day), b2 = dailyStars(day + 1);
assert.equal(a.length, 6);
assert.deepEqual(a, c, 'one day, one layout');
assert.notDeepEqual(a.map((s) => s.x), b2.map((s) => s.x));
assert.equal(new Set(a.map((s) => s.id)).size, 6);

const ends = slideEnds({ x: 48, z: -36 }, 2.2);
assert.ok(ends.bot.x > ends.top.x);
assert.ok(ends.bot.y < ends.top.y);
const half = slideAt(ends, 0.5);
assert.ok(half.x > ends.top.x && half.x < ends.bot.x);
assert.equal(STAR_COINS, 5);
assert.equal(STAR_COINS <= 10, true, 'park earn allows at most 10 coins per write');

const near = nearestSpot(seats, seats[0].ax, seats[0].az, seats[0].useY);
assert.equal(near, seats[0]);
assert.equal(nearestSpot(seats, 40, 40, 0), null);

console.log('park play tests passed');
