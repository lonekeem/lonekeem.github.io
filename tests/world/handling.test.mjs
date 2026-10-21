// Headless handling run: every car through launch, braking, a sharp turn at speed, hands-off straightening and reverse.
// Run: node tests/world/handling.test.mjs
import { CAR, createVehicle } from '../../js/world/cars.js';
const flat = () => 0; let bad = 0; const H = 1 / 60;
const run = (V, t, inp) => { for (let i = 0; i < t / H; i++) V.update(H, inp); };
for (const id of Object.keys(CAR)) { const c = CAR[id]; const V = createVehicle(c, flat); V.place(0, 0, 0);
  run(V, 1, { thr: 1 }); const v1 = V.vf; run(V, 9, { thr: 1 }); const vTop = V.vf;
  const y0 = V.yaw; run(V, 2, { thr: 1, steer: 1 }); const slip = Math.abs(V.vl), spun = Math.abs(V.r) > 2.2 || Math.abs(V.vl) > Math.abs(V.vf) * 0.5;
  run(V, 1.5, { thr: 0.5 }); const yawRate = Math.abs(V.r), steerLeft = Math.abs(V.steer);
  const vb = V.vf; let tb = 0; while (V.vf > 0.5 && tb < 10) { V.update(H, { brk: 1 }); tb += H; }
  run(V, 2.5, { brk: 1 }); const back = V.vf;
  const ok = !spun && yawRate < 0.08 && steerLeft < 0.01 && back < -0.5 && v1 < 7 && tb < vb / 7;
  if (!ok) bad++; console.log((ok ? 'OK  ' : 'BAD ') + id.padEnd(8), `0-1s ${v1.toFixed(1)}m/s top ${vTop.toFixed(1)} turn-slide ${slip.toFixed(2)} brake ${vb.toFixed(1)}->0 in ${tb.toFixed(2)}s, reverse ${back.toFixed(1)}`); }
console.log(bad ? bad + ' cars failed' : 'all cars handle well'); process.exit(bad ? 1 : 0);
