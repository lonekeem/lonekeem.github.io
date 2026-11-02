// ♿ accessible parking bays + accessible plate badge (local emulators only).
// usage: CHROME=... EMU_FS=8377 EMU_AUTH=9377 node tests/world/hc-e2e.mjs [base] [shotPrefix]
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/hc-';
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: GL }); const errors = []; let fails = 0;
const ok = (c, m, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m, x); };
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6);
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Hc Tester', user: 'hc' + tag, email: `kemy.hc.test+${tag}@example.com`, pass: 'Hc-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', 'low'); location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 240000 });
  // walk to the theater lot (west aisle) and look at row A by the door
  await p.evaluate(() => { window.__p3.teleport(74, 207); window.__p3.setYaw(-Math.PI / 2); });
  await p.waitForFunction(() => window.__p3.scene().getObjectByName('hc-bay'), null, { timeout: 240000, polling: 1000 });
  const sc = await p.evaluate(() => { let bays = 0, signs = 0; const at = []; window.__p3.scene().traverse((o) => { if (o.name === 'hc-bay') { bays++; at.push([+o.position.x.toFixed(1), +o.position.z.toFixed(1)]); } if (o.name === 'hc-sign') signs++; }); return { bays, signs, at }; });
  ok(sc.bays === 3, 'three accessible bays by the theater door', JSON.stringify(sc)); ok(sc.signs === 3, 'each bay has a sign post on the sidewalk');
  const f0 = await p.evaluate(() => window.__p3.frame); await p.waitForFunction((t) => window.__p3.frame > t + 4, f0, { timeout: 120000 }); await p.screenshot({ path: shot + 'theater-lot.png' });
  await p.evaluate(() => { window.__p3.teleport(70, 200); window.__p3.setYaw(-2.2); }); const f1 = await p.evaluate(() => window.__p3.frame); await p.waitForFunction((t) => window.__p3.frame > t + 4, f1, { timeout: 120000 }); await p.screenshot({ path: shot + 'theater-lot-2.png' });
  // plate: spawn a car (debug), Kustoms -> 🔖 Plate -> type text, pick a frame, toggle ♿, save
  await p.evaluate(() => window.__kdApi.spawn('pip', 2)); await W(1500);
  await p.evaluate(() => window.__kdApi.kk('pip')); await p.waitForSelector('[data-plate]', { timeout: 60000 }); await W(1500); await p.screenshot({ path: shot + 'kustoms.png' });
  await p.evaluate(() => document.querySelector('[data-plate]').click()); await p.waitForSelector('.kd-plate input');
  await p.fill('.kd-plate input', 'KEEM7'); await p.evaluate(() => document.querySelector('.kd-plate [data-fr="2"]').click()); await p.evaluate(() => document.querySelector('.kd-plate [data-hc]').click()); await W(300);
  const ed = await p.evaluate(() => ({ t: document.querySelector('.kd-plate input').value, hcOn: document.querySelector('.kd-plate [data-hc]').classList.contains('on'), frOn: document.querySelector('.kd-plate [data-fr="2"]').classList.contains('on') }));
  ok(ed.t === 'KEEM7' && ed.hcOn && ed.frOn, 'editor keeps text + frame with the ♿ badge on', JSON.stringify(ed));
  await (await p.$('.kd-plate .kp-card')).screenshot({ path: shot + 'plate-editor.png' });
  await p.evaluate(() => document.querySelector('.kd-plate [data-save]').click()); await W(800);
  const saved = await p.evaluate(async () => { const m = await import('/js/pals/presence-sync.js'); const pl = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /"plates"/.test(localStorage.getItem(k))) || '""') || 'null'); return { pl, sync: window.__p3 && null, code: pl && pl.plates && pl.plates.pip ? m.plateCode(pl.plates.pip) : '' }; });
  ok(saved.pl && saved.pl.plates && saved.pl.plates.pip && saved.pl.plates.pip.t === 'KEEM7' && (saved.pl.plates.pip.fr & 8) && (saved.pl.plates.pip.fr & 7) === 2, 'plate saved with text, frame and ♿ badge', JSON.stringify(saved.pl && saved.pl.plates));
  ok(saved.code.length <= 12, 'presence plate code fits 12 chars', saved.code);
  await p.evaluate(() => document.querySelector('.kk-x, [data-close], .kk [aria-label="Close"]')?.click()); await W(800);
  await p.evaluate(() => { window.__p3.setYaw(0); }); const f2 = await p.evaluate(() => window.__p3.frame); await p.waitForFunction((t) => window.__p3.frame > t + 4, f2, { timeout: 120000 }); await p.screenshot({ path: shot + 'car-plate.png' });
} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }).catch(() => {}); }
ok(!errors.length, 'no page errors', errors.slice(0, 3).join(' | ')); await browser.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
