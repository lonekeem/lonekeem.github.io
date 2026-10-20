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
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate((g) => { localStorage.setItem('kemy-tut-park', '1'); if (g) localStorage.setItem('kemy-gfx', g); location.hash = '#/me'; }, gfx || ''); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), species); await p.fill('#pal-name', tag === 'a' ? 'Bloop' : 'Toots'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, hash); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kw, null, { timeout: 90000 }).catch(async (e) => { await p.screenshot({ path: shot + 'dbg-' + tag + '.png' }); throw e; });
  return p;
}

const out = {}; const S = async (p, n) => { await W(p, 2500); await p.screenshot({ path: shot + n + '.png' }); };
const tp = (p, x, z, yaw = 0) => p.evaluate(([x, z, yaw]) => { window.__p3.teleport(x, z); window.__p3.setYaw(yaw); }, [x, z, yaw]);
try {
  const a = await account('a', 'tiger', 'iPhone 13', process.env.GFX || 'low', '#/street');
  await a.evaluate(() => localStorage.setItem('kemy-pals-debug', '1'));
  await W(a, 6000); out.start = await a.evaluate(() => ({ pos: window.__p3.pos, kh: window.__kh, ke: window.__ke }));
  const towns = [['downtown', 200, 92, Math.PI], ['farm', 300, 30, Math.PI], ['snow', 178, 262, 0], ['desert', 300, 262, Math.PI], ['lake', 245, 382, 0], ['shore', 245, 494, 0], ['highway', 130, -40, Math.PI / 2]];
  for (const [n, x, z, y] of towns) { await tp(a, x, z, y); await S(a, 'town-' + n); out[n] = await a.evaluate(() => ({ area: document.querySelector('.p3-top b')?.textContent, ke: window.__ke, fps: window.__p3.fps })); }
  // demo house: go in, look, come out
  const demo = await a.evaluate(() => window.__kwApi.doors().find((d) => d.id === 'h01')); await tp(a, demo.x, demo.z + 1.4, Math.PI); await W(a, 1500);
  out.inBtn = await a.evaluate(() => ({ t: document.querySelector('.kh-in')?.textContent, hidden: document.querySelector('.kh-in')?.hidden }));
  await a.evaluate(() => document.querySelector('.kh-in').click()); await S(a, 'interior'); out.inside = await a.evaluate(() => ({ kh: window.__kh, pos: window.__p3.pos }));
  await a.evaluate(() => window.__khApi.goOut()); await W(a, 800);
  // for-sale sign + panel + buy attempt
  const sale = await a.evaluate(() => window.__kwApi.doors().find((d) => d.id === 'h02')); await tp(a, sale.x, sale.z + (sale.z > 100 ? -1.4 : 1.4), 0); await W(a, 1500);
  out.salePrompt = await a.evaluate(() => window.__kh.prompt); await a.evaluate(() => window.__khApi.sale('h02')); await S(a, 'forsale'); 
  await a.evaluate(() => document.querySelector('.kh-c [data-b]')?.click()); await W(a, 6000); out.buy = await a.evaluate(() => ({ toast: document.getElementById('ks-toast')?.textContent, kh: window.__kh })); await a.evaluate(() => { const p = document.querySelector('.kh-p'); if (p) p.hidden = true; });
  // garage preview (debug-only local ownership) + drive in + park
  await a.evaluate(() => window.__khApi.fakeOwn('h02', 3)); await W(a, 500); const bays = await a.evaluate(() => window.__khApi.bays()); out.bays = bays;
  await a.evaluate((b) => { window.__kdApi.spawn('pip', 3, { x: b.front[0] + 0 , z: b.front[1] + (b.yaw === Math.PI ? 2.5 : -2.5), yaw: b.yaw }); window.__kdApi.enter(); }, bays[0]); await W(a, 4000); await S(a, 'garage-open');
  await a.evaluate((b) => { window.__khApi.teleport({ x: 0, z: 0 }); }, bays[0]);
  out.garageOpen = await a.evaluate(() => window.__khApi.bays().map((b) => b.open));
  await a.evaluate(() => window.__khApi.parkHere(0)); await W(a, 1500); out.parked = await a.evaluate(() => window.__kh);
  await S(a, 'garage-parked');
  await a.setViewportSize({ width: 844, height: 390 }); await tp(a, 245, 470, 0); await S(a, 'landscape-shore');
  await tp(a, 178, 262, 0); await S(a, 'landscape-snow');
  await a.evaluate(() => { document.querySelector('.kh-home').click(); }); await S(a, 'landscape-home');
  // multiplayer at far coordinates
  const b = await account('b', 'elephant', 'Desktop Chrome', 'low', '#/park'); await W(b, 6000);
  await a.setViewportSize({ width: 390, height: 664 }); await a.evaluate(() => { const p = document.querySelector('.kh-p'); if (p) p.hidden = true; });
  await tp(a, 300, 262, 0); await tp(b, 300, 268, Math.PI); await W(a, 9000);
  out.sync = { a: await a.evaluate(() => [...(window.__p3.extras?.() ? [] : [])].length || window.__p3.pos.others), b: await b.evaluate(() => window.__p3.pos.others) };
  out.bSeesA = await b.evaluate(() => { const o = [...(window.__pp?.others?.values?.() || [])]; return o.length; }).catch(() => null);
  await S(a, 'multi-a'); await S(b, 'multi-b');
  // saved location: reload B and see where it spawns
  await W(b, 32000); await b.reload(); await b.waitForFunction(() => window.__kh && window.__kh.myPlot !== undefined && window.__p3?.pos, null, { timeout: 90000 }); await W(b, 9000);
  out.bReload = await b.evaluate(() => ({ pos: window.__p3.pos, kh: window.__kh }));
} catch (e) { out.err = String(e && e.stack || e); }
out.errors = errors; console.log(JSON.stringify(out, null, 1)); await browser.close();
