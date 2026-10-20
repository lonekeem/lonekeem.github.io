// Driving checks for street-e2e.mjs (debug flag lets the test preview premium designs; normal players need to own them).
export default async function (a, shot, W) { const o = {};
  await a.evaluate(() => localStorage.setItem('kemy-pals-debug', '1'));
  const st = () => a.evaluate(() => ({ ...window.__kd }));
  await a.evaluate(() => { window.__kdApi.spawn('comet', 1, { x: -30, z: 98, yaw: Math.PI / 2 }); window.__p3.teleport(-30, 94.5); window.__p3.setYaw(Math.PI); }); await W(a, 2500);
  await a.screenshot({ path: shot + 'car-comet.png' }); o.prompt = await a.evaluate(() => document.getElementById('ks-act').textContent);
  await a.evaluate(() => window.__kdApi.enter()); await W(a, 700); await a.screenshot({ path: shot + 'car-enter-doors.png' }); await W(a, 2500); o.afterEnter = await st();
  await a.evaluate(() => window.__kdApi.test({ thr: 1 })); await W(a, 5000); o.accel = await st(); await a.screenshot({ path: shot + 'car-chase.png' });
  await a.evaluate(() => window.__kdApi.test({ thr: 0.6, steer: 0.7 })); await W(a, 2500); o.turn = await st();
  await a.evaluate(() => window.__kdApi.cam()); await W(a, 1500); await a.screenshot({ path: shot + 'car-far.png' });
  await a.evaluate(() => window.__kdApi.cam()); await W(a, 1500); await a.screenshot({ path: shot + 'car-pov.png' });
  await a.evaluate(() => window.__kdApi.cam()); await a.evaluate(() => window.__kdApi.test({ brk: 1 })); await W(a, 4000); o.brake = await st();
  await a.evaluate(() => window.__kdApi.test({})); await a.evaluate(() => window.__kdApi.doors()); await W(a, 1500); await a.screenshot({ path: shot + 'car-doors-open.png' }); await a.evaluate(() => window.__kdApi.doors());
  await a.evaluate(() => window.__kdApi.out()); await W(a, 3000); o.out = await st(); await a.screenshot({ path: shot + 'car-out.png' });
  // the other designs, parked side by side for a showroom shot
  await a.evaluate(() => { window.__kdApi.showroom(-86, 122.5); window.__p3.teleport(-72, 127); window.__p3.setYaw(Math.PI * 0.62); }); await W(a, 3000); await a.screenshot({ path: shot + 'car-showroom.png' });
  return o; }
