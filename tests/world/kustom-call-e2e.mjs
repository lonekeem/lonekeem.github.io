// Kemy Kustoms "call car keeps the look" e2e on the Firebase EMULATORS only (no live sign-in).
// Needs: firebase emulators (firebase.emu.json) + python3 -m http.server 8947. Optional EMU_FS / EMU_AUTH ports when 8199/9199 are busy.
// usage: node tests/world/kustom-call-e2e.mjs [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/workspace/pw/');
const pw = require('playwright'); const { devices } = pw;
const base = 'http://localhost:8947/'; const shot = process.argv[2] || '/workspace/kkfix-'; const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = (p, ms) => p.waitForTimeout(ms); const out = {}; const errors = []; let fail = 0;
const tag = Date.now().toString(36).slice(-5);
async function client(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("'127.0.0.1', 8199", `'127.0.0.1', ${FS}`).replace('127.0.0.1:9199', '127.0.0.1:' + AU) }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(name + ': ' + String(e)));
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form'); await W(p, 800); await p.getByText('I understand').click({ timeout: 4000 }).catch(() => {}); await W(p, 400);
  await p.selectOption('#sbd-m', '1'); await p.selectOption('#sbd-y', { index: 20 }); await p.dispatchEvent('#sbd-y', 'change'); await W(p, 500); await p.fill('#p-name', 'KK ' + name); await p.fill('#p-user', 'kk' + name + tag); await p.fill('#p-email', `kk${name}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) await p.getByText('Hatch your Kemy Pal').first().click(); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400); for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800); await p.evaluate(() => document.querySelector('[data-species="tiger"]')?.click()); await p.fill('#pal-name', 'Vroom'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  return p; }
const goWorld = async (p) => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi && window.__kdApi.carInfo, null, { timeout: 120000 }); await W(p, 4000); };
const check = (n, ok, v) => { out[n] = { ok: !!ok, v }; if (!ok) fail++; };
const A = await client('a'); await goWorld(A);
const LOOK = { rim: 5, spoiler: 1, decal: 1, tint: 1, horn: 1 };
const CID = await A.evaluate(async () => { await new Promise((r) => setTimeout(r, 1500)); return window.__kdApi.owned()[0] || ''; }); out.carId = CID;
out.spawn = await A.evaluate((CID) => { const at = { x: window.__p3.pos.x + 3, z: window.__p3.pos.z, yaw: 0 }; return window.__kdApi.spawn(CID, 1, at); }, CID);
await W(A, 1500); await A.evaluate(() => { const c = window.__kdApi.carInfo(); window.__p3.teleport(c.x + 4.5, c.z + 4.5); }); await W(A, 2500); await A.screenshot({ path: shot + 'before-stock.png' });
await A.evaluate((CID) => window.__kdApi.kk(CID), CID); await A.waitForFunction(() => window.__kkApi && window.__kkApi.el && document.body.contains(window.__kkApi.el), null, { timeout: 30000 }); await W(A, 1500);
await A.evaluate((L) => { for (const [k, v] of Object.entries(L)) window.__kkApi.pick(k, v); }, LOOK); await W(A, 500);
await A.evaluate(() => window.__kkApi.el.querySelector('[data-save]').click()); await W(A, 800); out.kkMsg = await A.evaluate(() => window.__kkApi.el.textContent.match(/Saved[^.]*|Buy[^.]*/)?.[0]);
await A.screenshot({ path: shot + 'garage-saved.png' }); await A.evaluate(() => window.__kkApi.close()); await W(A, 800);
const want = await A.evaluate(() => window.__kdApi.carInfo().saved); check('saved', want, want);
check('afterSave', (await A.evaluate(() => window.__kdApi.carInfo().kk)) === want, await A.evaluate(() => window.__kdApi.carInfo()));
// call it again from My Cars (▶ Drive it)
await A.evaluate(() => window.__kdApi.myCars()); await W(A, 1500); await A.evaluate((CID) => document.querySelector(`[data-spawn="${CID}"]`).click(), CID); await W(A, 2000);
const c1 = await A.evaluate(() => window.__kdApi.carInfo()); check('callMyCars', c1 && c1.kk === want, c1);
await A.evaluate(() => { const c = window.__kdApi.carInfo(); window.__p3.teleport(c.x + 4.5, c.z + 4.5); }); await W(A, 2500); await A.screenshot({ path: shot + 'after-call.png' });
// sell flow is tested below once the car is parked; first: reload (new session) and call again
await A.reload(); await goWorld(A); await A.evaluate(() => window.__kdApi.myCars()); await W(A, 1500); await A.evaluate((CID) => document.querySelector(`[data-spawn="${CID}"]`)?.click(), CID); await W(A, 2000);
const c2 = await A.evaluate(() => window.__kdApi.carInfo()); check('callAfterReload', c2 && c2.kk === want, c2);
// new device / app (Play TWA vs phone browser): local copy wiped, look must come back from the account
await W(A, 3000); await A.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('kemy-mycars-') || k === 'kemy-drive-cfg-v1') localStorage.removeItem(k); }); await A.reload(); await goWorld(A); await W(A, 2500);
await A.evaluate(() => window.__kdApi.myCars()); await W(A, 1500); out.sellOnFree = await A.evaluate((CID) => !!document.querySelector(`[data-sell="${CID}"]`), CID); await A.screenshot({ path: shot + 'mycars.png' });
await A.evaluate((CID) => document.querySelector(`[data-spawn="${CID}"]`)?.click(), CID); await W(A, 2000);
const c3 = await A.evaluate(() => window.__kdApi.carInfo()); check('callOnNewDevice', c3 && c3.kk === want, c3);
// second client sees it
if (process.env.TWO !== '0') { const B = await client('b'); await goWorld(B); const pa = await A.evaluate(() => window.__p3.pos); await B.evaluate(([x, z]) => window.__p3.teleport(x - 2, z - 4), [pa.x, pa.z]); await A.evaluate(() => window.__kdApi.enter()); await W(A, 4000);
  await B.waitForFunction(() => window.__kdApi.remoteLooks && window.__kdApi.remoteLooks().length, null, { timeout: 45000 }).catch(() => {});
  const rl = await B.evaluate(() => window.__kdApi.remoteLooks ? window.__kdApi.remoteLooks() : []); check('remoteSeesLook', rl.some((r) => r.kk === want), rl); await B.screenshot({ path: shot + 'after-remote.png' }); }
out.errors = errors.slice(0, 20); console.log(JSON.stringify(out, null, 1)); console.log(fail ? `FAIL ${fail}` : 'PASS'); await browser.close(); process.exit(fail ? 1 : 0);
