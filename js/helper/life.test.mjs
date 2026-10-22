import assert from 'assert';
import { ROSTER, lifeInit, stepLife, pathLen } from './team.js';
import { roadD, STATION } from '../world/layout.js';

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
assert.deepEqual(names, ['Kemy Helper', 'Kemy Patrol', 'Helper', 'Kemy Patrol', 'Helper', 'Kemy Patrol']);
assert.equal(byId('lead').lead, true);
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

function alongTo(path, pred) {
  let acc = 0;
  for (let i = 0; i < path.length; i++) {
    if (pred(path[i])) return acc;
    const b = path[(i + 1) % path.length];
    acc += Math.hypot(b[0] - path[i][0], b[1] - path[i][1]);
  }
  return -1;
}

const doorD = alongTo(byId('lead').path, (p) => p[0] === STATION.door[0] && p[1] === STATION.door[1]);
assert.ok(doorD > 0, 'chief route visits the station');
const visit = run(Object.assign({}, byId('lead'), { dist: doorD - 0.4 }), 5);
assert.ok(visit.seen.some((p) => p.mode === 'look' && Math.hypot(p.x - STATION.door[0], p.z - STATION.door[1]) < 0.3), 'chief stands in the station doorway');

for (const id of ['street', 'country']) {
  const src = byId(id);
  const spot = id === 'street' ? STATION.lotStreet : STATION.lotCountry;
  const d = alongTo(src.path, (p) => p[2] === 'park' && p[0] === spot[0] && p[1] === spot[1]);
  assert.ok(d > 0, id + ' parks at the station');
  const lot = run(Object.assign({}, src, { dist: d - 0.5 }), 6);
  const foot = lot.seen.find((p) => p.onFoot);
  assert.ok(foot, id + ' hops out at the station');
  assert.ok(foot.carX > 5 && foot.carX < 8, id + ' car sits in the lot');
  assert.ok(Math.abs(foot.carZ - spot[1]) < 3, id + ' uses its stall');
  const secs = pathLen(src.path) / src.speed + 40;
  const loop = run(Object.assign({}, src, { dist: 0 }), secs);
  for (const p of loop.seen) assert.ok(roadD(p.carX, p.carZ) < 4, id + ' stays by a road at ' + p.carX.toFixed(1) + ',' + p.carZ.toFixed(1));
}

console.log('life ok');
