// Kemy Hill Rush: frame-by-frame car-part jitter capture at 60 and 120 Hz while driving over bumps (local server only, guest).
// A test-only route lets the test step frames itself and records what drawCar got for my car each frame (nothing in the repo changes).
// usage: node tests/rush/jitter.mjs [base] [shotDir] [prefix]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright');
const base = process.argv[2] || 'http://localhost:8961/'; const dir = (process.argv[3] || '/workspace/hill-game/fix2') + '/'; const pre = process.argv[4] || 'after';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined });
const errors = [], out = {};
async function run(hz, stage) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript((stage) => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('rush-rot-off', '1'); } catch {} }, stage);
  await ctx.route(/js\/rush\/game\.js/, async (route) => { const r = await route.fetch(); let t = await r.text();
    t = t.replace('function drawCar(x, y, a, def, drv, o) {', 'function drawCar(x, y, a, def, drv, o) { if (drv === me.drv && window.__rec) window.__rec.push({ sx: cam.X(x), sy: cam.Y(y), a, ppm: cam.ppm, bob: o.bob || 0, lean: o.lean || 0, pitch: o.pitch || 0, w: o.wheels.map((q) => [q.x, q.y, q.a]) });');
    t = t.replace('if (!alive) return; raf = requestAnimationFrame(frame);', 'if (!alive) return; if (!window.__man) raf = requestAnimationFrame(frame);'); t = t.replace('function stop() {', 'window.__rushFrame = (n) => { if (!window.__man) { window.__man = 1; cancelAnimationFrame(raf); } frame(n); return { g: keys.gas, x: me.car.body.getPosition().x, o: S.over, p: S.paused, acc }; }; function stop() {');
    await route.fulfill({ response: r, body: t, headers: { ...r.headers(), 'content-type': 'text/javascript' } }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await p.goto(base + 'app.html#/games/rush'); await p.waitForSelector('#rush-go', { timeout: 20000 }); await p.waitForTimeout(600);
  await p.tap('#rush-go'); await p.waitForSelector('.rush-run canvas'); await p.waitForTimeout(1500);
  await p.keyboard.down('ArrowRight');
  const R = await p.evaluate(async (hz) => { let t = performance.now(); window.__rec = null; const dbg = [];
    for (let i = 0; i < hz * 2; i++) { t += 1000 / hz; window.__rushFrame(t); } // warm up 2 s
    dbg.push(window.__rushFrame(t += 1000 / hz)); window.__rec = [];
    for (let i = 0; i < hz * 6; i++) { t += 1000 / hz; window.__rushFrame(t); if (i % 30 === 0) await new Promise((r) => setTimeout(r, 0)); }
    dbg.push(window.__rushFrame(t += 1000 / hz)); window.__t = t; const rec = window.__rec; window.__rec = null; return { rec, dbg }; }, hz);
  const rec = R.rec; out[hz + 'hz-dbg'] = R.dbg;
  // a short burst of consecutive frames as images (over a bump)
  for (let i = 0; i < 6; i++) { await p.evaluate((hz) => { window.__rushFrame(window.__t += 1000 / hz); }, hz); await p.screenshot({ path: dir + `${pre}-jitter-${hz}hz-f${i}.png`, clip: { x: 150, y: 120, width: 420, height: 220 } }); }
  await p.keyboard.up('ArrowRight'); await ctx.close();
  // jitter = mean |second difference| per frame (a smooth path has ~0); the wheel/driver numbers are relative to the body
  out[hz + 'hz-ends'] = [rec[0], rec[rec.length - 1]].map((r) => r && { sx: r.sx, sy: r.sy, a: r.a });
  const d2 = (f) => { let s = 0, n = 0; for (let i = 1; i < rec.length - 1; i++) { s += Math.abs(f(rec[i + 1]) - 2 * f(rec[i]) + f(rec[i - 1])); n++; } return +(s / Math.max(1, n)).toFixed(4); };
  const deg = 180 / Math.PI;
  out[hz + 'hz'] = { frames: rec.length, bodyY_px: d2((r) => r.sy), bodyAngle_deg: d2((r) => r.a * deg), pitch_deg: d2((r) => r.pitch * deg), driverBob_px: d2((r) => r.bob * r.ppm), lean_deg: d2((r) => r.lean * deg),
    wheelRelY_px: d2((r) => r.w[0][1] * r.ppm), wheelRelX_px: d2((r) => r.w[0][0] * r.ppm), wheelSpin_deg: d2((r) => r.w[0][2] * deg) };
}
try { await run(60); await run(120); } catch (e) { errors.push('FATAL ' + String(e.stack || e).slice(0, 400)); }
await browser.close(); console.log(JSON.stringify({ out, errors }, null, 1));
