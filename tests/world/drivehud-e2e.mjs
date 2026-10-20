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


const out = {}; const S = async (p, n) => { await W(p, 1800); await p.screenshot({ path: shot + n + '.png' }); };
const cfg = (p, c) => p.evaluate((c) => { const k = 'kemy-drive-cfg-v1'; const o = JSON.parse(localStorage.getItem(k) || '{}'); Object.assign(o, c); localStorage.setItem(k, JSON.stringify(o)); return import('/js/world/drivecfg.js').then((m) => m.setCfg(c)); }, c);
try {
  const a = await account('a', 'tiger', 'iPhone 13', 'low', '#/street'); await a.evaluate(() => localStorage.setItem('kemy-pals-debug', '1')); await W(a, 5000);
  await a.evaluate(() => { window.__kdApi.spawn('star', 4, { x: -30, z: 102, yaw: Math.PI / 2 }); window.__p3.teleport(-30, 98.5); }); await W(a, 1500);
  await a.evaluate(() => window.__kdApi.enter()); await W(a, 9000);
  await cfg(a, { style: 'arrows', pedals: 'pedals', hud: 'classic' }); await S(a, 'drive-arrows');
  await a.evaluate(() => window.__kdApi.test({ thr: 1 })); await W(a, 6000); out.go = await a.evaluate(() => window.__kd); await S(a, 'drive-night-moving');
  await a.evaluate(() => window.__kdApi.test({ thr: 0.8, steer: 0.9 })); await W(a, 5000); out.turn = await a.evaluate(() => window.__kd); await S(a, 'drive-turn-fx');
  await a.evaluate(() => window.__kdApi.test({ brk: 1 })); await W(a, 4000); await a.evaluate(() => window.__kdApi.test({}));
  await cfg(a, { style: 'wheel', skin: 'kemy', hud: 'full', trans: 'manual', hand: true }); await S(a, 'drive-wheel-full');
  await cfg(a, { style: 'joystick', pedals: 'slider', lefty: true, theme: 'sport' }); await S(a, 'drive-joystick-lefty');
  await cfg(a, { style: 'arrows', pedals: 'pedals', lefty: false, theme: 'night', hud: 'classic', trans: 'auto' });
  await a.evaluate(() => document.querySelector('.dh-c[data-ctl=set]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9 }))); await S(a, 'drive-settings');
  await a.evaluate(() => document.querySelector('.dh-set').remove());
  await a.evaluate(() => { const d = document.querySelector('.dh'); d && 0; }); await a.evaluate(() => import('/js/world/drivecfg.js'));
  await a.evaluate(() => { document.querySelector('.dh-c[data-ctl=set]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 10 })); document.querySelector('.dh-set [data-a=edit]').click(); }); await S(a, 'drive-layout-editor');
  await a.evaluate(() => document.querySelector('.dh-bar [data-cancel]').click());
  await a.setViewportSize({ width: 844, height: 390 }); await S(a, 'drive-landscape');
  await a.evaluate(() => document.querySelector('.dh-c[data-ctl=reset]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 11 }))); await S(a, 'respawn-menu');
  await a.evaluate(() => document.querySelector('.rs-p [data-k=safe]').click()); await W(a, 2000); out.afterRespawn = await a.evaluate(() => window.__kd);
  await a.evaluate(() => window.__kdApi.test({})); await a.evaluate(() => window.__kdApi.out()); await W(a, 8000);
  await a.setViewportSize({ width: 390, height: 664 }); await a.evaluate(() => { window.__p3.teleport(5, 5); }); await W(a, 1000); await a.evaluate(() => window.__p3.teleport(5, -9999)); await W(a, 4000); out.fellOut = await a.evaluate(() => window.__p3.pos); await S(a, 'respawn-auto');
} catch (e) { out.err = String(e && e.stack || e); }
out.errors = errors; console.log(JSON.stringify(out)); await browser.close();
