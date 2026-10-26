// Headless physics check: every vehicle on every stage, driven by the bot for 60 s. node tests/rush/sim-check.mjs
import * as P from '../../js/vendor/planck-1.4.2.min.mjs';
import { createSim, botDrive } from '../../js/rush/sim.js';
import { VEHICLES, STAGES, tuned } from '../../js/rush/data.js';
const secs = +process.argv[2] || 60; const only = process.argv[3];
for (const st of STAGES) { const row = [];
  for (const v of VEHICLES) { if (only && v.id !== only) continue;
    const sim = createSim(P, { stage: st, seed: 12345 }); const d = tuned(v.id, {});
    const car = sim.addCar(d, { x: 4, head: { x: d.seat.x + 0.05, y: d.seat.top + 0.35, r: 0.27 } });
    let t = 0, crash = '', flips = 0, maxAir = 0, maxV = 0;
    for (let i = 0; i < secs * 60; i++) { botDrive(car, sim.terr, 0.8, t); sim.step(); t += 1 / 60; maxAir = Math.max(maxAir, car.air); maxV = Math.max(maxV, car.body.getLinearVelocity().x);
      if (car.landed) { flips += Math.floor((Math.abs(car.landed.spin) + 0.6) / (2 * Math.PI)); car.landed = null; }
      if (car.headHit || car.roofHit) { crash = (car.headHit ? 'head' : 'roof') + '@' + t.toFixed(1); break; } }
    row.push(`${v.id}:${Math.round(car.body.getPosition().x)}m${crash ? ' X' + crash : ''} v${maxV.toFixed(0)} air${maxAir.toFixed(1)}${flips ? ' f' + flips : ''}`); }
  console.log(st.id.padEnd(7), row.join(' | ')); }
