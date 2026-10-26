// Hold gas only (no tilt control) from a standstill: no car should flip over on the starting flat.
import * as P from '../../js/vendor/planck-1.4.2.min.mjs';
import { createSim } from '../../js/rush/sim.js';
import { VEHICLES, STAGE, tuned } from '../../js/rush/data.js';
const st = STAGE[process.argv[2] || 'countryside'], lv = +process.argv[3] || 0;
for (const v of VEHICLES) { const sim = createSim(P, { stage: st, seed: 777 }); const d = tuned(v.id, { engine: lv, susp: lv, tires: lv, tank: lv });
  const car = sim.addCar(d, { x: 4, head: { x: d.seat.x + 0.05, y: d.seat.top + 0.35, r: 0.27 } }); let crash = '', maxA = 0;
  for (let i = 0; i < 600; i++) { car.gas = 1; sim.step(); maxA = Math.max(maxA, car.body.getAngle()); if (car.headHit || car.roofHit) { crash = 'X@' + (i / 60).toFixed(1); break; } }
  console.log(v.id.padEnd(8), Math.round(car.body.getPosition().x) + 'm', 'maxTilt', maxA.toFixed(2), crash); }
