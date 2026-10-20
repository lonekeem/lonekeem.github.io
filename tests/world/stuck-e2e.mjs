// Kemy Street e2e: two throwaway accounts (A = phone, B = second player), walk/teleport into the neighborhood,
// knock on a door, check sync, screenshots portrait + landscape. Accounts are deleted after via tests/pals/cleanup.mjs.
// usage: NODE_PATH=... node tests/world/street-e2e.mjs <base> <shotPrefix> [steps]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs';
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/street-'; const steps = (process.argv[4] || 'all').split(',');
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const W = (p, ms) => p.waitForTimeout(ms);
async function account(tag, species, device, gfx, hash) {
  const ctx = await browser.newContext({ ...devices[device], serviceWorkers: 'block' }); await ctx.addInitScript(() => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text().slice(0, 200)); });
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Street Tester ' + tag); await p.fill('#p-user', `pk${tag}${stamp}`); await p.fill('#p-email', `kemy.pals.test+${tag}${stamp}@example.com`); await p.fill('#p-pass', pass); { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption('1995'); } } await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 60000 }).catch(async (e) => { await p.screenshot({ path: '/tmp/signup-fail.png' }); throw e; }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate((g) => { localStorage.setItem('kemy-tut-park', '1'); if (g) localStorage.setItem('kemy-gfx', g); location.hash = '#/me'; }, gfx || ''); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), species); await p.fill('#pal-name', tag === 'a' ? 'Bloop' : 'Toots'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, hash); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kw, null, { timeout: 90000 }).catch(async (e) => { await p.screenshot({ path: shot + 'dbg-' + tag + '.png' }); throw e; });
  return p;
}

const out = {}; const st = (p) => p.evaluate(() => ({ kd: window.__kd, probe: window.__kdApi.stuckProbe() }));
try {
  const a = await account('a', 'tiger', 'iPhone 13', 'low', '#/street'); await a.evaluate(() => localStorage.setItem('kemy-pals-debug', '1')); await W(a, 5000);
  await a.evaluate(() => { window.__kdApi.spawn('pip', 2, { x: -30, z: 98, yaw: Math.PI / 2 }); window.__p3.teleport(-30, 95.5); }); await W(a, 1500);
  for (let round = 0; round < 2; round++) { await a.evaluate(() => window.__kdApi.enter()); await W(a, 3500); out['in' + round] = await st(a);
    await a.evaluate(() => window.__kdApi.test({ thr: 1 })); await W(a, 4000); out['go' + round] = await st(a); await a.evaluate(() => window.__kdApi.test({ brk: 1 })); await W(a, 3000); await a.evaluate(() => window.__kdApi.test({})); await W(a, 800);
    await a.evaluate(() => window.__kdApi.out()); await W(a, 3000); }
  // wedge into a house: drive north into the houses, hold gas
  await a.evaluate(() => window.__kdApi.enter()); await W(a, 3500); await a.evaluate(() => window.__kdApi.test({ thr: 1, steer: -1 })); await W(a, 12000); out.wedge = await st(a);
  await a.screenshot({ path: shot + 'stuck-after.png' }); await a.evaluate(() => window.__kdApi.reset()); await W(a, 800); out.reset = await st(a);
} catch (e) { out.err = String(e && e.stack || e); }
out.errors = errors; console.log(JSON.stringify(out)); await browser.close();
