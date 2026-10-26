// Kemy Hill Rush physics (planck.js / Box2D). No DOM, so node tests can drive it too.
// World is y-UP meters; vehicle data in data.js is y-DOWN, so we flip y here.
import { CHUNK, STEP, makeTerrain } from './terrain.js';

export function createSim(P, { stage, seed }) {
  const world = new P.World({ gravity: { x: 0, y: -stage.g } });
  const terr = makeTerrain(seed, stage);
  const chunks = new Map(); const cars = [];
  const zoneFx = (z) => ({ friction: stage.grip * (z ? z.grip ?? 1 : 1), restitution: z && z.bounce != null ? z.bounce : stage.bounce || 0 });
  function chunk(i) {
    if (chunks.has(i) || i < -2) return;
    const b = world.createBody({ type: 'static' });
    let run = [], cur;
    const flush = () => { if (run.length > 1) { const f = zoneFx(cur); b.createFixture({ shape: new P.Chain(run, false), ...f, userData: 'g' }); } };
    for (let x = i * CHUNK; x <= (i + 1) * CHUNK + 1e-6; x += STEP) {
      const p = { x, y: terr.at(x) }, z = terr.zoneAt(x + STEP / 2);
      if (run.length && z !== cur) { run.push(p); flush(); run = [p]; cur = z; continue; }
      if (!run.length) cur = z; run.push(p);
    }
    flush();
    if (i === -1) b.createFixture({ shape: new P.Edge({ x: -30, y: -5 }, { x: -30, y: 40 }), friction: 0.5, userData: 'g' });
    chunks.set(i, b);
  }
  function keepChunks() {
    let lo = Infinity, hi = -Infinity; for (const c of cars) { const x = c.body.getPosition().x; lo = Math.min(lo, x); hi = Math.max(hi, x); }
    if (!cars.length) { lo = 0; hi = 0; }
    const a = Math.floor((lo - 30) / CHUNK), z = Math.floor((hi + 90) / CHUNK);
    for (let i = Math.max(-1, a); i <= z; i++) chunk(i);
    for (const [i, b] of chunks) if (i < a - 1 || i > z + 2) { world.destroyBody(b); chunks.delete(i); }
  }
  // def: tuned() vehicle. head: { x, y, r } in vehicle (y-down) coords, from the seated driver's size.
  function addCar(def, { x = 4, head = null } = {}) {
    const gy = terr.at(x); const lowest = Math.max(...def.wheels.map((w) => w.y + w.r));
    const pos = { x, y: gy + lowest + 0.15 };
    const body = world.createBody({ type: 'dynamic', position: pos, angularDamping: 0.6 });
    const F = (v) => ({ x: v[0], y: -v[1] });
    body.createFixture({ shape: new P.Polygon(def.hull.map(F)), density: def.dens, friction: 0.5, filterGroupIndex: -1, userData: 'hull' });
    let headFx = null;
    if (head) headFx = body.createFixture({ shape: new P.Circle({ x: head.x, y: -head.y }, head.r), isSensor: true, density: 0, filterGroupIndex: -1, userData: 'head' });
    const wheels = [], joints = [];
    for (const w of def.wheels) {
      const wb = world.createBody({ type: 'dynamic', position: { x: pos.x + w.x, y: pos.y - w.y }, angularDamping: 0.3 });
      wb.createFixture({ shape: new P.Circle(w.r), density: def.wdens, friction: def.grip, restitution: 0.05, filterGroupIndex: -1, userData: 'wheel' });
      const j = world.createJoint(new P.WheelJoint({ enableMotor: false, maxMotorTorque: 0, motorSpeed: 0, frequencyHz: def.hz, dampingRatio: def.zeta },
        body, wb, wb.getPosition(), { x: 0, y: 1 }));
      wheels.push(wb); joints.push(j);
    }
    const nd = def.wheels.filter((w) => w.drive).length || 1;
    const car = { def, body, wheels, joints, headFx, nd, gas: 0, brake: 0, down: 0, wheelDown: def.wheels.map(() => false), headHit: false, roofHit: false,
      air: 0, spin: 0, lastA: 0, fuelOut: false, dead: false };
    cars.push(car); return car;
  }
  function removeCar(car) { const i = cars.indexOf(car); if (i < 0) return; cars.splice(i, 1); for (const w of car.wheels) world.destroyBody(w); world.destroyBody(car.body); }
  const touchingGround = (b, which) => { for (let ce = b.getContactList(); ce; ce = ce.next) { const c = ce.contact; if (!c.isTouching()) continue; const a = c.getFixtureA(), z = c.getFixtureB();
    const mine = a.getBody() === b ? a : z, other = mine === a ? z : a; if (other.getUserData() !== 'g') continue; if (!which || mine.getUserData() === which) return true; } return false; };
  const GK = Math.sqrt(Math.max(0.3, Math.min(1, (stage.g || 10) / 10)));
  function control(car) {
    const d = car.def, gas = car.dead || car.fuelOut ? 0 : car.gas, brake = car.dead ? 0 : car.brake;
    // wheelie guard: on the ground with the nose high, ease the engine so a held gas pedal does not flip you at once
    let tc = 1; if (gas && car.down) { const rel = car.body.getAngle() - Math.atan(terr.slope(car.body.getPosition().x)); if (rel > 0.35) tc = Math.max(0.2, 1 - (rel - 0.35) / 0.5); }
    if (!car.down && car.air > 0.12) tc = 0.15;
    car.tc = tc;
    if (car.down && !car.dead) { const rel = car.body.getAngle() - Math.atan(terr.slope(car.body.getPosition().x)), av = car.body.getAngularVelocity();
      if (rel > 0.3 && !brake) car.body.applyTorque(-((rel - 0.3) * 40 + Math.max(0, av) * 8) * (car.I || car.body.getInertia()), true); }
    car.joints.forEach((j, i) => {
      if (!d.wheels[i].drive) { j.enableMotor(brake > 0 && !car.dead); j.setMotorSpeed(0); j.setMaxMotorTorque(brake ? d.torque * 0.25 : 0); return; }
      j.enableMotor(true);
      if (gas && !brake) { j.setMotorSpeed(-d.speed * (car.pace || 1)); j.setMaxMotorTorque(d.torque / car.nd * gas * tc); }
      else if (brake && !gas) { j.setMotorSpeed(d.speed * 0.45); j.setMaxMotorTorque(d.torque / car.nd * 0.8); }
      else { j.setMotorSpeed(0); j.setMaxMotorTorque(car.dead ? 3 : 0.9); }
    });
    if (car.dead) return;
    if (car.down) { const z = terr.zoneAt(car.body.getPosition().x), dr = z && z.drag != null ? Math.max(0, z.drag) : stage.drag || 0;
      if (dr) { const v = car.body.getLinearVelocity(), m = car.body.getMass() + car.wheels.reduce((s, w) => s + w.getMass(), 0); car.body.applyForceToCenter({ x: -v.x * dr * m * 0.5, y: 0 }, true); } }
    const t = (gas ? 1 : 0) - (brake ? 1 : 0);
    if (t && !car.down && car.air > 0.12) { // air tilt: gas leans back (nose up), brake leans forward
      const I = car.body.getInertia() + car.wheels.reduce((s, w) => { const p = w.getPosition(), c = car.body.getWorldCenter(); return s + w.getMass() * ((p.x - c.x) ** 2 + (p.y - c.y) ** 2); }, 0);
      car.I = I; const av = car.body.getAngularVelocity(); if (Math.abs(av) < 7 || Math.sign(av) !== t) car.body.applyTorque(t * d.air * I * GK, true);
    } else if (t && car.down && car.down < car.wheels.length && (t < 0 || tc > 0.99)) car.body.applyTorque(t * d.air * 0.25 * car.body.getInertia(), true);
  }
  function sense(car, dt) {
    car.wheelDown = car.wheels.map((w) => touchingGround(w));
    car.down = car.wheelDown.filter(Boolean).length;
    car.headHit = !!car.headFx && touchingGround(car.body, 'head');
    const a = car.body.getAngle(); car.roofHit = Math.cos(a) < -0.25 && touchingGround(car.body, 'hull');
    let da = a - car.lastA; car.lastA = a; if (Math.abs(da) > 1) da = 0;
    if (!car.down) { car.air += dt; car.spin += da; } else { car.landed = car.air > 0 ? { air: car.air, spin: car.spin } : null; car.air = 0; car.spin = 0; }
  }
  const H = 1 / 60;
  function step(dt) {
    keepChunks();
    for (const c of cars) control(c);
    world.step(H, 8, 3);
    for (const c of cars) sense(c, H);
  }
  // put a car back on its wheels a bit behind x (race respawn)
  function respawn(car, x) {
    const gy = terr.at(x), lowest = Math.max(...car.def.wheels.map((w) => w.y + w.r)); const p = { x, y: gy + lowest + 0.4 };
    car.body.setTransform(p, 0); car.body.setLinearVelocity({ x: 0, y: 0 }); car.body.setAngularVelocity(0);
    car.def.wheels.forEach((w, i) => { const b = car.wheels[i]; b.setTransform({ x: p.x + w.x, y: p.y - w.y }, 0); b.setLinearVelocity({ x: 0, y: 0 }); b.setAngularVelocity(0); });
    car.lastA = 0; car.air = 0; car.spin = 0; car.dead = false; car.headHit = car.roofHit = false;
  }
  return { world, terr, cars, addCar, removeCar, step, respawn, H };
}

// Simple computer driver: floor it, ease off when tipping back, tilt to land flat.
export function botDrive(car, terr, skill = 0.7, t = 0) {
  const a = car.body.getAngle(), av = car.body.getAngularVelocity(), x = car.body.getPosition().x;
  const g = Math.atan(terr.slope(x + 1));
  if (!car.down) { const want = Math.atan(terr.slope(x + 3)), err = want - a - av * 0.25; car.gas = err > 0.15 ? 1 : 0; car.brake = err < -0.15 ? 1 : 0; return; }
  const rel = a - g; car.brake = 0;
  car.gas = rel > 0.55 + 0.25 * skill || av > 2.2 ? 0 : (Math.sin(t * 0.7 + skill * 9) > -0.6 - skill ? 1 : 0);
  if (rel < -0.7) car.gas = 1;
}
