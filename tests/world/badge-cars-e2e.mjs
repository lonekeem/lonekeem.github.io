// Badge-edition cars (shared models, own emblem): shop listing, drive + Kustoms + plate, presence code, no Sell while selling is off (local emulators only).
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/reg-newcars-';
const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199', P = 'lone-keem-studios';
const FSB = `http://127.0.0.1:${FS}/v1/projects/${P}/databases/(default)/documents`, OWN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const fsGet = async (x) => (await fetch(`${FSB}/${x}`, { headers: OWN })).json();
const fsSet = (x, fields, mask) => fetch(`${FSB}/${x}${mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&') : ''}`, { method: 'PATCH', headers: OWN, body: JSON.stringify({ fields }) }).then((r) => r.json());
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: GL }); const errors = []; let fails = 0;
const ok = (c, m, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m, x); };
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6); const email = `kemy.bc.test+${tag}@example.com`;
const frames = async (n) => { const f = await p.evaluate(() => window.__p3.frame); await p.waitForFunction(([t, n]) => window.__p3.frame > t + n, [f, n], { timeout: 120000 }); };
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Bc Tester', user: 'bc' + tag, email, pass: 'Bc-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', 'low'); location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser?.uid); ok(!!uid, 'emulator account found', uid);
  await fsSet('config/palShop', { prices: { mapValue: { fields: { car_ember: { integerValue: '900' } } } } }, ['prices.car_ember']);
  await fsSet(`users/${uid}/inv/car_ember`, { n: { integerValue: '1' }, at: { timestampValue: new Date(Date.now() - 6e4).toISOString() } });
  await fsSet(`users/${uid}/inv/car_haul`, { n: { integerValue: '1' }, at: { timestampValue: new Date(Date.now() - 6e4).toISOString() } });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi, null, { timeout: 240000 }); await W(3000);
  await p.evaluate(() => window.__kdApi.myCars()); await p.waitForSelector('[data-plate="ember"]', { timeout: 60000 }).catch(() => {}); await W(1500);
  const names = await p.evaluate(() => [...document.querySelectorAll('.kd-car b')].map((b) => b.textContent));
  const want = ['Ember Dart', 'Frost Fang', 'Blitz Hornet', 'Wisp Glider', 'Jolt Kit', 'Petal Zip', 'Mighty Mule', 'Boulder Buddy', 'Ranger Rex', 'Haul Hero'];
  ok(want.every((n) => names.includes(n)), 'all 10 badge cars listed in My Cars shop', names.length);
  await p.evaluate(() => document.querySelector('[data-plate="ember"]')?.closest('.kd-car')?.scrollIntoView({ block: 'center' })); await W(500); await p.screenshot({ path: shot + 'shop.png', timeout: 180000 });
  await p.evaluate(() => { const e = [...document.querySelectorAll('.kd-car b')].find((b) => b.textContent === 'Haul Hero'); e && e.closest('.kd-car').scrollIntoView({ block: 'center' }); }); await W(500); await p.screenshot({ path: shot + 'shop2.png', timeout: 180000 });
  await p.evaluate(() => document.querySelector('.ks-card [data-close], .kk-ov [data-close], [data-close]')?.click()); await W(800);
  for (const id of ['ember', 'boulder', 'blitz']) {
    await p.evaluate((id) => window.__kdApi.spawn(id, undefined), id); await W(2500);
    const info = await p.evaluate(() => { const ci = window.__kdApi.carInfo && window.__kdApi.carInfo(); return ci; });
    await p.evaluate(() => window.__p3.setYaw(0)); await frames(4); await p.screenshot({ path: shot + id + '.png', timeout: 180000 }); console.log('car', id, JSON.stringify(info).slice(0, 160));
  }
  // presence code round trip for an escaped (35+) index
  const rt = await p.evaluate(async () => { const d = await import('/js/world/drive.js'); const k = await import('/js/world/kustom-look.js'); return ['pip', 'petal', 'mule', 'haul'].map((id) => { const c = d.carCode(id, 3, true) + 'oABCDEFGH' + 'kabcd'; const pc = d.parseCar(c); return [id, c, pc && pc.id, pc && pc.color, k.dnLook(c)]; }); });
  ok(rt.every((r) => r[0] === r[2] && r[3] === 3 && r[4] === 'abcd'), 'presence car code + look round-trip (incl. 2-char index)', JSON.stringify(rt));
  // Kustoms + plate on a badge car
  await p.evaluate(() => window.__kdApi.spawn('haul', 2)); await W(1500); await p.evaluate(() => window.__kdApi.kk('haul')); await p.waitForSelector('[data-plate]', { timeout: 60000 }); await W(2000); await p.screenshot({ path: shot + 'kustoms-haul.png', timeout: 180000 });
  await p.evaluate(() => document.querySelector('[data-plate]').click()); await p.waitForSelector('.kd-plate input'); await p.fill('.kd-plate input', 'HAUL1'); await p.evaluate(() => document.querySelector('.kd-plate [data-hc]').click()); await p.evaluate(() => document.querySelector('.kd-plate [data-save]').click()); await W(800);
  const pl = await p.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.plates && v.plates.haul) return v.plates; } catch {} } return { keys: Object.keys(localStorage).filter((k) => /plates/.test(localStorage.getItem(k))), ed: document.querySelector('.kd-plate input')?.value ?? 'no-editor' }; });
  ok(pl && pl.haul && pl.haul.t === 'HAUL1' && (pl.haul.fr & 8), 'badge car plate saved with ♿ badge', JSON.stringify(pl));
  await p.evaluate(() => document.querySelector('.kk-x, [data-close], .kk [aria-label="Close"]')?.click()); await p.keyboard.press('Escape'); await W(1500);
  // selling is switched off (SELL_CARS = false): My Cars shows no Sell button for the owned badge car

  await p.evaluate(() => window.__kdApi.myCars()); await p.waitForSelector('[data-plate="ember"]', { timeout: 60000 }); await W(800);
  ok(!(await p.$('[data-sell]')), 'no Sell button in My Cars', '');


} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png', timeout: 180000 }).catch(() => {}); }
ok(!errors.length, 'no page errors', errors.slice(0, 3).join(' | ')); await browser.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
