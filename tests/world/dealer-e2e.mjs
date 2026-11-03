// 🚗 Kemy Motors dealership: walk-in showroom, Buy prompt -> buy -> drive it out, Sell counter (local emulators only).
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/reg-dealer-';
const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199', P = 'lone-keem-studios';
const FSB = `http://127.0.0.1:${FS}/v1/projects/${P}/databases/(default)/documents`, OWN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const fsGet = async (x) => (await fetch(`${FSB}/${x}`, { headers: OWN })).json();
const fsSet = (x, fields, mask) => fetch(`${FSB}/${x}${mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&') : ''}`, { method: 'PATCH', headers: OWN, body: JSON.stringify({ fields }) }).then((r) => r.json());
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: GL }); const errors = []; let fails = 0;
const ok = (c, m, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m, x); };
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (/warn|error/.test(m.type()) && !/favicon|net::/.test(m.text())) console.log('console.' + m.type(), m.text().slice(0, 200)); });
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6); const email = `kemy.dl.test+${tag}@example.com`;
const frames = async (n) => { const f = await p.evaluate(() => window.__p3.frame); await p.waitForFunction(([t, n]) => window.__p3.frame > t + n, [f, n], { timeout: 120000 }); };
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Dl Tester', user: 'dl' + tag, email, pass: 'Dl-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', 'low'); location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser?.uid); ok(!!uid, 'emulator account found', uid);
  await fsSet('config/palShop', { prices: { mapValue: { fields: { car_ember: { integerValue: '900' }, car_haul: { integerValue: '800' } } } } }, ['prices.car_ember', 'prices.car_haul']);
  // the app creates the wallet (full shape) itself; only top up coins once it exists, or the rules see a half-made wallet
  for (let i = 0; i < 60; i++) { const w = await fsGet(`users/${uid}/pal/wallet`); if (w.fields && w.fields.total) break; await W(2000); }
  await fsSet(`users/${uid}/pal/wallet`, { coins: { integerValue: '5000' } }, ['coins']);
  await fsSet(`users/${uid}/inv/car_haul`, { n: { integerValue: '1' }, at: { timestampValue: new Date(Date.now() - 6e4).toISOString() } });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi && window.__kdlApi, null, { timeout: 240000 }); await W(3000);
  // publish the full shop doc (prices + kinds + deals, cars included) like the admin would; the rules check buys/sells against it
  const sd = await p.evaluate(async () => (await import('/js/pals/catalog.js')).shopDoc());
  const enc = (v) => Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
  sd.prices.car_ember = 900; sd.prices.car_haul = 800; sd.kinds.car_ember = sd.kinds.car_ember || 'car'; sd.kinds.car_haul = sd.kinds.car_haul || 'car';
  await fsSet('config/palShop', enc(sd).mapValue.fields);
  const tp = async (x, z, yaw) => { await p.evaluate(([x, z, yaw]) => { window.__p3.teleport(x, z); window.__p3.setYaw(yaw); }, [x, z, yaw]); await W(400); };
  const act = () => p.evaluate(() => { const b = document.getElementById('ks-act'); return b && getComputedStyle(b).display !== 'none' && !b.hidden ? b.textContent : ''; });
  await p.keyboard.press('Escape'); await W(300); await p.evaluate(() => document.querySelector('.kc-x, [aria-label="Close controls"]')?.click());
  await tp(30, 248, Math.PI); await W(5000); await frames(10); await p.screenshot({ path: shot + 'outside.png' });
  await tp(30, 284, Math.PI); await W(6000); await frames(10); await p.screenshot({ path: shot + 'lot.png' });
  await p.waitForFunction(() => window.__kdl && window.__kdl.built > 5, null, { timeout: 60000 }).catch(() => {}); const st = await p.evaluate(() => ({ ...window.__kdl })); ok(st.built > 5 && st.tags, 'display cars + price tags built near the lot', JSON.stringify(st));
  // walk into the showroom through the open doors
  await tp(30, 339.5, Math.PI); await p.keyboard.down('w'); await frames(90); await p.keyboard.up('w'); const pz = await p.evaluate(() => { const q = window.__p3.pos; return (typeof q === "function" ? q() : q).z; });
  ok(pz > 343, 'walked in through the showroom doors', pz); await frames(6); await p.screenshot({ path: shot + 'inside.png' });
  // buy the Ember Dart from its lot spot
  const s = await p.evaluate(() => window.__kdlApi.slots().find((s) => s.id === 'ember')); await tp(s.tag[0], s.tag[1] - 0.6, 0); await W(1500); await frames(8);
  const lab = await act(); ok(/Buy Ember Dart/.test(lab) && /900/.test(lab), 'Buy prompt with name + price', lab);
  await p.evaluate(() => document.getElementById('ks-act').click()); await p.waitForSelector('.dl-buy [data-ok]'); await W(500); await p.screenshot({ path: shot + 'buy.png' });
  await p.click('.dl-buy [data-ok]'); await p.waitForFunction(() => { const c = window.__kdApi.carInfo && window.__kdApi.carInfo(); return c && c.id === 'ember' && c.state === 'drive'; }, null, { timeout: 90000 }).catch(() => {});
  const ci = await p.evaluate(() => window.__kdApi.carInfo()); console.log('lastBuy', await p.evaluate(() => window.__kdl.lastBuy)); console.log('toast', await p.evaluate(() => [...document.querySelectorAll('.ks-say, .kk-toast, .toast, [role=status]')].map((e) => e.textContent).join(' | ').slice(0, 300))); ok(ci && ci.id === 'ember' && ci.state === 'drive', 'bought car spawned + player is driving it', JSON.stringify(ci).slice(0, 120));
  const w1 = await fsGet(`users/${uid}/pal/wallet`); ok(+w1.fields.coins.integerValue === 4100, 'paid 900 ⭐', w1.fields.coins.integerValue);
  await frames(20); await p.screenshot({ path: shot + 'driveout.png' });
  await p.keyboard.down('w'); await frames(25); await p.keyboard.up('w'); const ci2 = await p.evaluate(() => window.__kdApi.carInfo()); console.log('drove out ->', JSON.stringify(ci2).slice(0, 200));
  await p.keyboard.down('s'); await p.waitForFunction(() => { window.__kdApi.out(); const c = window.__kdApi.carInfo(); return !c || c.state !== 'drive'; }, null, { timeout: 120000, polling: 1000 }).catch(() => {}); await p.keyboard.up('s'); await frames(10); await p.evaluate(() => window.__kdApi.reset && 0);
  // selling is switched off (SELL_CARS = false): no Sell prompt at the old counter, no Sell button in My Cars

  const [kx, kz] = await p.evaluate(() => window.__kdlApi.desk); await p.waitForFunction(() => { const c = window.__kdApi.carInfo(); return !c || c.state === 'parked'; }, null, { timeout: 180000, polling: 1000 }).catch(() => {}); await tp(kx, kz - 1, 0); await W(1000); await tp(kx, kz - 1, 0); await W(1000); console.log('at desk', await p.evaluate(() => { const q = window.__p3.pos; const v = typeof q === 'function' ? q() : q; return [v.x, v.z, JSON.stringify(window.__kdApi.carInfo())]; })); await frames(10); await p.waitForFunction(() => /Sell a car/.test(document.getElementById('ks-act')?.textContent || ''), null, { timeout: 60000 }).catch(() => {}); const sl = await act(); ok(!/Sell/.test(sl), 'no Sell prompt at the counter (selling is off)', sl);
  await p.evaluate(() => document.querySelector('.kd-my').click()); await p.waitForSelector('[data-spawn]', { timeout: 30000 }).catch(() => {}); await W(800); ok(!!(await p.$('[data-spawn]')) && !(await p.$('[data-sell]')), 'My Cars open, no Sell button', ''); await p.screenshot({ path: shot + 'nosell.png' }); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('.ks-panel').forEach((d) => d.remove()));


  console.log('dealer stats', JSON.stringify(await p.evaluate(() => window.__kdl)));
  // quick memory check: walk away -> display cars + tags freed; come back + leave twice -> heap / GPU geometry stay flat
  const mem = () => p.evaluate(() => ({ heap: Math.round((performance.memory?.usedJSHeapSize || 0) / 1048576), geo: window.__p3?.R?.info?.memory?.geometries ?? window.__kwApi?.R?.info?.memory?.geometries ?? null, tex: window.__p3?.R?.info?.memory?.textures ?? null, built: window.__kdl.built, tags: window.__kdl.tags }));
  const ms = []; for (let i = 0; i < 2; i++) { await tp(30, 330, 0); await W(2500); await frames(10); ms.push(await mem()); await tp(-300, 140, 0); await W(2500); await frames(10); ms.push(await mem()); }
  console.log('mem', JSON.stringify(ms)); ok(ms[1].built === 0 && ms[3].built === 0 && !ms[3].tags, 'display cars + tags freed when you leave', JSON.stringify(ms[3]));
  ok(ms[3].heap - ms[1].heap < 15, 'heap flat after 2 visits (MB)', ms[1].heap + ' -> ' + ms[3].heap);
} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }).catch(() => {}); }
ok(!errors.length, 'no page errors', errors.slice(0, 3).join(' | ')); await browser.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
