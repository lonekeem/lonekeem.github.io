// Traffic e2e on the Firebase EMULATORS only: sign up, Pal, Kemy World, stoplights + AI cars + new roads screenshots.
// Needs emulators + python3 -m http.server 8947 (see emu-e2e.mjs). usage: node tests/world/traffic-e2e.mjs [shotPrefix]
// Needs: firebase emulators:start --config firebase.emu.json --only auth,firestore --project lone-keem-studios ; python3 -m http.server 8947
// usage: node tests/world/emu-e2e.mjs [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/workspace/pw/');
const pw = require('playwright'); const { devices } = pw;
const base = 'http://localhost:8947/'; const shot = process.argv[2] || '/workspace/traffic-';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const W = (p, ms) => p.waitForTimeout(ms); const out = {};
const EMU = 'http://127.0.0.1:8199/v1/projects/lone-keem-studios/databases/(default)/documents/';
const seed = (path, fields) => fetch(EMU + path, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }).then((r) => r.ok || r.text().then((t) => { throw new Error(t); }));
const tag = Date.now().toString(36).slice(-5);
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'medium'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|cloudinary|youtube|spotify/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300) + ' @' + JSON.stringify(m.location())); });
const step = async (n, f) => { try { out[n] = await f(); } catch (e) { out[n] = 'ERR ' + e.message.slice(0, 300); await p.screenshot({ path: shot + 'dbg-' + n + '.png' }).catch(() => {}); } };
await seed('users/studio', { displayName: { stringValue: 'Lone Keem Studios' }, username: { stringValue: 'studio' } });
await step('signup', async () => { await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form'); await W(p, 800); await p.getByText('I understand').click({ timeout: 4000 }).catch(() => {}); await W(p, 400);
  await p.selectOption('#sbd-m', '1'); await p.selectOption('#sbd-y', { index: 20 }); await p.dispatchEvent('#sbd-y', 'change'); await W(p, 500); await p.fill('#p-name', 'Emu Tester'); await p.fill('#p-user', 'emu' + tag); await p.fill('#p-email', process.env.ADMIN ? 'lillykemoy1@gmail.com' : `emu${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) { await p.getByText('Hatch your Kemy Pal').first().click(); } await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800); await p.evaluate(() => document.querySelector('[data-species="tiger"]')?.click()); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  return await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser.uid); });
await step('world', async () => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kw && window.__ktApi, null, { timeout: 90000 }); await W(p, 6000); return await p.evaluate(() => ({ kt: window.__kt, fps: window.__p3.fps })); });
// look at a signalised junction from a sidewalk corner, a few seconds apart, so lights change and cars queue
const look = async (name, x, z, dx, dz, waits) => { const res = []; await p.evaluate(([x, z, dx, dz]) => { window.__p3.teleport(x + dx, z + dz); window.__p3.setYaw(Math.atan2(dx, dz)); }, [x, z, dx, dz]);
  for (let i = 0; i < waits.length; i++) { await W(p, waits[i]); await p.screenshot({ path: shot + name + '-' + i + '.png' }); res.push(await p.evaluate(() => ({ ...window.__kt, cars: window.__ktApi.cars().length, near: window.__ktApi.cars().filter((c) => Math.hypot(c.x - window.__p3.pos.x, c.z - window.__p3.pos.z) < 60).map((c) => [Math.round(c.x), Math.round(c.z), +c.v.toFixed(1), c.road, c.why]) }))); } return res; };
await step('junctions', async () => { const js = await p.evaluate(() => window.__ktApi.graph().nodes.filter((n) => n.signal).map((n) => [n.x, n.z])); return js.slice(0, 400).map(([x, z]) => [Math.round(x), Math.round(z)]); });
const jn = out.junctions; const near = (x, z) => jn.reduce((b, j) => (Math.hypot(j[0] - x, j[1] - z) < Math.hypot(b[0] - x, b[1] - z) ? j : b));
await step('lights', async () => { const [x, z] = near(-40, 140); return look('lights', x, z, 14, 14, [6000, 9000, 9000]); });
await step('redstop', async () => { return look('red-stop', -40, 440, 6, 34, [12000, 7000, 7000]); });
await step('roads', async () => { await p.evaluate(() => { window.__p3.teleport(-300, 445); window.__p3.setYaw(-Math.PI / 2); }); await W(p, 7000); await p.screenshot({ path: shot + 'roads-sunset.png' });
  await p.evaluate(() => { window.__p3.teleport(-600, 1306); window.__p3.setYaw(-Math.PI / 2); }); await W(p, 8000); await p.screenshot({ path: shot + 'roads-parkway.png' }); return p.evaluate(() => ({ ...window.__kt, fps: window.__p3.fps })); });
await step('highway', async () => { await p.evaluate(() => { window.__p3.teleport(30, 3456); window.__p3.setYaw(Math.PI / 2); }); await W(p, 8000); await p.screenshot({ path: shot + 'highway.png' }); return p.evaluate(() => ({ ...window.__kt, fps: window.__p3.fps })); });
out.errors = errors.slice(0, 20); console.log(JSON.stringify(out, null, 1)); await browser.close();
