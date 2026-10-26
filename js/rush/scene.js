// Still scenes from the game's own art: menu header, stage cards, garage cards and the Play-tab hero image.
import { makeTerrain } from './terrain.js';
import { tuned } from './data.js';
import { makeDriver, drawVehicle, KEMY } from './driver.js';
import { drawSky, drawParallax, drawGround, drawCity, drawStarCoin, drawDiamond, drawFuel, drawGhost } from './art.js';
const TC = new Map(); const terrFor = (stage, seed) => { const k = stage.id + ':' + seed; let t = TC.get(k); if (!t) { t = makeTerrain(seed, stage); TC.set(k, t); if (TC.size > 24) TC.delete(TC.keys().next().value); } return t; };
const DC = new Map();
// cars: [{ vid, pal, x, lift, spin, mood, ups }] ; opts: { stage, seed, camX, ppm, t, items: [{t:'star'|'dia'|'fuel', x, y}] }
export function drawScene(c, W, H, o) {
  const st = o.stage, terr = terrFor(st, o.seed || 4242), ppm = o.ppm || H / 9, t = o.t || 0;
  const cam = { x: o.camX ?? 30, y: o.camY ?? terr.at(o.camX ?? 30) + 1.2, ppm, X: (x) => (x - cam.x) * ppm + W * (o.ax ?? 0.4), Y: (y) => H * (o.ay ?? 0.62) - (y - cam.y) * ppm };
  cam.x0 = cam.x - W * (o.ax ?? 0.4) / ppm - 1; cam.x1 = cam.x + W / ppm + 1;
  drawSky(c, st, cam, W, H, t); drawParallax(c, st, cam, W, H, t);
  if (st.night) for (let i = 0; i < 3; i++) drawGhost(c, W * (0.15 + i * 0.33), H * (0.28 + (i % 2) * 0.1), H / 420, t, i);
  drawGround(c, st, terr, cam, W, H, t); if (st.deco === 'city') drawCity(c, st, terr, cam, W, H);
  for (const k of o.items || []) { const x = cam.X(k.x), y = cam.Y(k.y ?? terr.at(k.x) + 1.4); if (k.t === 'dia') drawDiamond(c, x, y, ppm * 0.34 * (k.s || 1), t + k.x); else if (k.t === 'fuel') drawFuel(c, x, y, ppm * 0.45 * (k.s || 1), t); else drawStarCoin(c, x, y, ppm * 0.32 * (k.s || 1), 0.3 + k.x); }
  for (const car of o.cars || []) {
    const def = tuned(car.vid, car.ups || {}); const pal = car.pal || KEMY; const key = car.vid + JSON.stringify(pal);
    let drv = DC.get(key); if (!drv) { drv = makeDriver(pal, def, DC); DC.set(key, drv); }
    // rest the car on the ground: wheels touching, angle along the slope (plus optional spin for jumps)
    const xs = def.wheels.map((w) => car.x + w.x), lows = def.wheels.map((w, i) => terr.at(xs[i]) + w.r);
    const i0 = 0, i1 = def.wheels.length - 1; let a = Math.atan2(lows[i1] - lows[i0], def.wheels[i1].x - def.wheels[i0].x) + (car.spin || 0);
    const yb = (lows[i0] + lows[i1]) / 2 + (def.wheels[i0].y + def.wheels[i1].y) / 2 + (car.lift || 0);
    const sx = cam.X(car.x), sy = cam.Y(yb);
    if (car.shadow !== false && car.lift) { c.fillStyle = 'rgba(43,29,74,.18)'; c.beginPath(); c.ellipse(sx, cam.Y(terr.at(car.x)), ppm * 1.8, ppm * 0.22, 0, 0, 7); c.fill(); }
    c.save(); c.translate(sx, sy); c.rotate(-a); c.scale(ppm * (car.s || 1), ppm * (car.s || 1));
    drawVehicle(c, def, drv, { mood: car.mood || 'idle', lean: car.lean || 0, bob: 0, t, wheels: def.wheels.map((w) => ({ x: w.x, y: w.y + (car.drop || 0), a: car.x / w.r })) }); c.restore();
  }
  return cam;
}
export function sceneCanvas(w, h, o, dpr = Math.min(2, window.devicePixelRatio || 1)) {
  const cv = document.createElement('canvas'); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); const c = cv.getContext('2d'); c.scale(dpr, dpr); drawScene(c, w, h, o); return cv;
}
