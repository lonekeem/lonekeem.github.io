// Kemy Kustoms Sell-a-car e2e on the Firebase EMULATORS only (no live sign-in).
// Needs: firebase emulators (firebase.emu.json) + python3 -m http.server 8947. Optional EMU_FS / EMU_AUTH ports when 8199/9199 are busy.
// usage: node tests/world/kustom-call-e2e.mjs [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/workspace/pw/');
const pw = require('playwright'); const { devices } = pw;
const base = 'http://localhost:8947/'; const shot = process.argv[2] || '/workspace/sell-'; const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = (p, ms) => p.waitForTimeout(ms); const out = {}; const errors = []; let fail = 0;
const tag = Date.now().toString(36).slice(-5);
async function client(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("'127.0.0.1', 8199", `'127.0.0.1', ${FS}`).replace('127.0.0.1:9199', '127.0.0.1:' + AU) }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(name + ': ' + String(e))); p.on('console', (m) => { if (/sell/i.test(m.text())) errors.push(name + ' console: ' + m.text()); });
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

// Full sale on the emulators: own Star Racer (⭐450), Sell → Tap again → +225 ⭐, inv doc gone, car gone from My Cars.
const P = 'lone-keem-studios', FSB = `http://127.0.0.1:${FS}/v1/projects/${P}/databases/(default)/documents`, OWN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const fsGet = async (p) => (await fetch(`${FSB}/${p}`, { headers: OWN })).json();
const fsSet = (p, fields, mask) => fetch(`${FSB}/${p}${mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&') : ''}`, { method: 'PATCH', headers: OWN, body: JSON.stringify({ fields }) }).then((r) => r.json());
const A = await client('s'); await goWorld(A);
const acc = await (await fetch(`http://127.0.0.1:${AU}/identitytoolkit.googleapis.com/v1/projects/${P}/accounts:query`, { method: 'POST', headers: OWN, body: '{}' })).json();
const uid = acc.userInfo.find((u) => u.email === `kks${tag}@example.com`).localId; out.uid = uid;
await fsSet('config/palShop', { prices: { mapValue: { fields: { car_star: { integerValue: '450' } } } } }, ['prices.car_star']);
await fsSet(`users/${uid}/inv/car_star`, { n: { integerValue: '1' }, at: { timestampValue: new Date(Date.now() - 6e4).toISOString() } });
const w0 = await fsGet(`users/${uid}/pal/wallet`); out.coins0 = +(w0.fields?.coins?.integerValue ?? -1); check('walletExists', out.coins0 >= 0, w0.error || out.coins0);
await A.reload(); await goWorld(A); await A.evaluate(() => window.__kdApi.myCars()); await W(A, 2000);
await A.evaluate(() => document.querySelector('[data-sell="star"]')?.scrollIntoView({ block: 'center' })); await W(A, 400);
check('sellButton', await A.evaluate(() => document.querySelector('[data-sell="star"]')?.textContent), null); await A.screenshot({ path: shot + '1-mycars.png' });
await A.click('[data-sell="star"]'); await W(A, 500); out.armed = await A.evaluate(() => document.querySelector('[data-sell="star"]')?.textContent); check('armed', /Tap again/.test(out.armed), out.armed);
out.focused = await A.evaluate(() => document.activeElement?.dataset?.sell || ''); await A.screenshot({ path: shot + '2-armed.png' });
await A.click('[data-sell="star"]'); await W(A, 3500); await A.screenshot({ path: shot + '3-sold.png' });
const w1 = await fsGet(`users/${uid}/pal/wallet`); out.coins1 = +w1.fields.coins.integerValue; out.sold = w1.fields.sold; check('refund+225', out.coins1 === out.coins0 + 225, [out.coins0, out.coins1]);
const inv = await fsGet(`users/${uid}/inv/car_star`); check('invGone', inv.error && inv.error.code === 404, inv.error?.code);
check('notOwned', !(await A.evaluate(() => window.__kdApi.owned().includes('star'))), null);
check('noSellButton', !(await A.evaluate(() => document.querySelector('[data-sell="star"]'))), null);
await A.reload(); await goWorld(A); check('stillGoneAfterReload', !(await A.evaluate(() => window.__kdApi.owned().includes('star'))), null);
await A.evaluate(() => window.__kdApi.myCars()); await W(A, 1500); await A.screenshot({ path: shot + '4-after-reload.png' });
out.errors = errors.slice(0, 20); console.log(JSON.stringify(out, null, 1)); console.log(fail ? `FAIL ${fail}` : 'PASS'); await browser.close(); process.exit(fail ? 1 : 0);
