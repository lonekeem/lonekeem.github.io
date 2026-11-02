// Kemy Kustoms "call car keeps the look" e2e on the Firebase EMULATORS only (no live sign-in).
// Needs: firebase emulators (firebase.emu.json) + python3 -m http.server 8947. Optional EMU_FS / EMU_AUTH ports when 8199/9199 are busy.
// usage: node tests/world/kustom-call-e2e.mjs [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/workspace/pw/');
const pw = require('playwright'); const { devices } = pw;
const base = 'http://localhost:8947/'; const shot = process.argv[2] || '/workspace/qa-'; const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = (p, ms) => p.waitForTimeout(ms); const out = {}; const errors = []; let fail = 0;
const tag = Date.now().toString(36).slice(-5);
async function client(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("'127.0.0.1', 8199", `'127.0.0.1', ${FS}`).replace('127.0.0.1:9199', '127.0.0.1:' + AU) }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(cur + ' PAGEERR ' + String(e).slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|cloudinary|youtube|spotify|emulator/i.test(m.text())) errors.push(cur + ' CONSOLE ' + m.text().slice(0, 250)); });
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form'); await W(p, 800); await p.getByText('I understand').click({ timeout: 4000 }).catch(() => {}); await W(p, 400);
  await p.selectOption('#sbd-m', '1'); await p.selectOption('#sbd-y', { index: 20 }); await p.dispatchEvent('#sbd-y', 'change'); await W(p, 500); await p.fill('#p-name', 'KK ' + name); await p.fill('#p-user', 'kk' + name + tag); await p.fill('#p-email', `kk${name}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) await p.getByText('Hatch your Kemy Pal').first().click(); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400); for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800); await p.evaluate(() => document.querySelector('[data-species="tiger"]')?.click()); await p.fill('#pal-name', 'Vroom'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  return p; }
const goWorld = async (p) => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi && window.__kdApi.carInfo, null, { timeout: 120000 }); await W(p, 4000); };

let cur='x';
const A = await client('st');
await A.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: false }); });
const cdp = await A.context().newCDPSession(A); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
for (const run of [1]) { await cdp.send('Profiler.start'); await A.evaluate(() => { window.__lt.length = 0; window.__t0 = performance.now(); location.hash = '#/pals/store'; }); await W(A, 6000);
  const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const dt = profile.timeDeltas; const byId = new Map(profile.nodes.map((n) => [n.id, n])); profile.samples.forEach((id, i) => { const n = byId.get(id); const k = n.callFrame.functionName + ' ' + n.callFrame.url.split('/').pop() + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); }); console.log([...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => Math.round(v / 1000) + 'ms ' + k).join('\n'));
  console.log('run', run, JSON.stringify(await A.evaluate(() => window.__lt.map(([s, d]) => [Math.round(s - window.__t0), d]))));
  await A.screenshot({ path: '/workspace/qa2-storeload-' + run + '.png' }); await A.evaluate(() => { location.hash = '#/feed'; }); await W(A, 2000); }
console.log('errors', errors); await browser.close();
