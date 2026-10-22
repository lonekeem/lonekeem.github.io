import assert from 'assert';
import { ROSTER, lifeInit, stepLife } from './team.js';

const byId = (id) => ROSTER.find((m) => m.id === id);

function run(src, seconds, hold) {
  const m = { path: src.path, dist: src.dist || 0, speed: src.speed, side: src.side || 0, role: src.role, hold: !!hold };
  const life = lifeInit();
  const seen = [];
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    const p = stepLife(life, m, dt);
    seen.push(p);
  }
  return { m, life, seen };
}

const names = ROSTER.map((m) => m.name);
assert.deepEqual(names, ['Kemy Helper', 'Helper', 'Helper', 'Helper', 'Helper', 'Helper']);
assert.ok(byId('play').job.includes('a quick game'));

const lead = run(byId('lead'), 12);
const sit = lead.seen.find((p) => p.mode === 'sit');
assert.ok(sit, 'leader sits');
assert.ok(Math.hypot(sit.x - 7.5, sit.z - 7.5) < 0.2, 'sits on the plaza bench');
const sitI = lead.seen.findIndex((p) => p.mode === 'sit');
assert.equal(lead.seen[sitI + 10].mode, 'sit');
assert.ok(Math.hypot(lead.seen[sitI].x - lead.seen[sitI + 10].x, lead.seen[sitI].z - lead.seen[sitI + 10].z) < 0.05);

const look = run(byId('lead'), 40);
const lookI = look.seen.findIndex((p) => p.mode === 'look');
assert.ok(lookI > 0, 'leader looks around');
assert.ok(Math.abs(look.seen[lookI].yaw - look.seen[lookI + 8].yaw) > 0.2);

const wave = run(byId('plains'), 50);
const waved = wave.seen.find((p) => p.mode === 'wave');
assert.ok(waved, 'a walker waves');
assert.equal(waved.say, 'Hi!');

const shop = run(byId('towns'), 12);
const browsing = shop.seen.find((p) => p.mode === 'shop');
assert.ok(browsing, 'town helper visits a shop');
assert.equal(browsing.say, 'Just looking!');
assert.ok(Math.hypot(browsing.x - 189, browsing.z - 24) < 1.5);

const play = run(byId('play'), 2);
assert.equal(play.seen[2].mode, 'play');
assert.equal(play.seen[2].say, 'Want to play?');
const later = run(byId('play'), 70);
assert.ok(later.seen.some((p) => p.mode === 'go' && p.moving), 'table helper gets up and wanders');
assert.ok(later.seen.some((p) => p.mode === 'sit'), 'table helper sits on a bench');
assert.ok(later.seen.some((p) => p.mode === 'shop'), 'table helper browses');

const street = run(byId('street'), 20);
const out = street.seen.find((p) => p.onFoot && p.mode === 'wave' && Math.hypot(p.x - p.carX, p.z - p.carZ) > 1.5);
assert.ok(out, 'street helper gets out');
assert.equal(out.say, 'Hi!');
assert.ok(Math.abs(out.carZ - 100) < 2, 'car stays on Kemy Street');
assert.ok(street.seen.some((p) => p.onFoot && p.say === 'Just looking!'));
const back = street.seen.findIndex((p) => p.onFoot);
let returned = false;
for (let i = back + 1; i < street.seen.length; i++) if (!street.seen[i].onFoot) returned = true;
assert.ok(returned, 'gets back in the car');

const country = run(byId('country'), 20);
assert.ok(country.seen.some((p) => p.onFoot), 'country helper parks and hops out');
assert.ok(country.seen.some((p) => p.onFoot && Math.abs(p.carX - 91) < 2));

for (const src of ROSTER) {
  const trip = run(src, 45);
  for (const p of trip.seen) {
    if (src.role === 'walk') assert.ok(Math.hypot(p.x - p.carX, p.z - p.carZ) < 1.6, src.id + ' stays on the walk');
    if (src.role === 'drive') assert.ok(Math.hypot(p.x - p.carX, p.z - p.carZ) < 3.2, src.id + ' stays by the car');
  }
}

console.log('life ok');
