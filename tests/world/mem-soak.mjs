// Memory soak: JS heap + WebGL geometries/textures over ~5 min of world play (local emulators only).
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/reg-';
const MIN = +(process.env.SOAK_MIN || 5);
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: [...GL, '--enable-precise-memory-info', '--js-flags=--expose-gc'] }); const errors = [];
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push('pageerror ' + String(e).slice(0, 200)));
p.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 200)); });
let navs = 0; p.on('framenavigated', (f) => { if (f === p.mainFrame()) { navs++; console.log('NAV', f.url()); } });
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6);
const sample = async (lbl) => { const s = await p.evaluate(() => { try { window.gc && window.gc(); } catch {} const g = window.__p3 && window.__p3.gfx ? window.__p3.gfx() : {}; return { heap: Math.round(performance.memory.usedJSHeapSize / 1048576), geo: g.geometries, tex: g.textures, prog: g.programs, tri: g.triangles, calls: g.calls, hash: location.hash }; }); console.log('SAMPLE', lbl, JSON.stringify(s)); return s; };
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Soak Tester', user: 'sk' + tag, email: `kemy.sk.test+${tag}@example.com`, pass: 'Sk-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate((g) => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', g); location.hash = '#/me'; }, process.env.GFX || 'low');
  await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 240000 }); await W(5000);
  const s0 = await sample('start'); const t0 = Date.now(); let i = 0; const spots = [[62, 207], [0, 0], [150, -80], [-120, 60], [40, 300], [-200, -150]]; const cars = ['pip', 'zapper', 'whale', 'stomp', 'halo', 'parcel', 'bear'];
  while (Date.now() - t0 < MIN * 60000) {
    i++; const [x, z] = spots[i % spots.length]; await p.evaluate(([x, z]) => window.__p3.teleport(x, z), [x, z]); await W(4000);
    if (i % 3 === 0) { await p.evaluate(() => { window.__p3.teleport(62, 207); window.__p3.setYaw(Math.PI / 2); }); await p.waitForFunction(() => { const b = document.getElementById('ks-act'); return b && !b.hidden && /Enter/.test(b.textContent); }, null, { timeout: 60000, polling: 500 }).catch(() => {});
      await p.evaluate(() => document.getElementById('ks-act')?.click()); await p.waitForFunction(() => { const h = document.querySelector('.th-hud'); return h && !h.hidden; }, null, { timeout: 60000, polling: 500 }).catch(() => {}); await W(3000);
      await p.evaluate(() => { const b = [...document.querySelectorAll('.th-hud button')].find((x) => /leave|exit/i.test(x.textContent)); b && b.click(); }); await W(3000); }
    const c = cars[i % cars.length]; await p.evaluate((c) => window.__kdApi.spawn(c, 2), c); await W(2500);
    if (i % 2 === 0) { await p.evaluate((c) => window.__kdApi.kk(c), c); await p.waitForSelector('[data-plate]', { timeout: 60000 }).catch(() => {}); await W(2500); await p.evaluate(() => document.querySelector('.kk-x, .kk-ov [data-close], .kk [aria-label="Close"]')?.click()); await W(1500); }
    await sample('it' + i);
  }
  const s1 = await sample('end'); console.log('DELTA heap', s1.heap - s0.heap, 'MB geo', s1.geo - s0.geo, 'tex', s1.tex - s0.tex, 'navs', navs, 'iters', i);
  await p.screenshot({ path: shot + 'soak-end.png' });
} catch (e) { console.log('ERR', e.message); await p.screenshot({ path: shot + 'soak-error.png' }).catch(() => {}); }
console.log('ERRORS', errors.length, errors.slice(0, 8).join('\n')); await browser.close(); process.exit(0);
