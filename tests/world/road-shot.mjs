// Badge-edition cars (shared models, own emblem): shop listing, drive + Kustoms + plate, presence code, sell (local emulators only).
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/reg-pov-';
const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199', P = 'lone-keem-studios';
const FSB = `http://127.0.0.1:${FS}/v1/projects/${P}/databases/(default)/documents`, OWN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const fsGet = async (x) => (await fetch(`${FSB}/${x}`, { headers: OWN })).json();
const fsSet = (x, fields, mask) => fetch(`${FSB}/${x}${mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&') : ''}`, { method: 'PATCH', headers: OWN, body: JSON.stringify({ fields }) }).then((r) => r.json());
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: GL }); const errors = []; let fails = 0;
const ok = (c, m, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m, x); };
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6); const email = `kemy.bc.test+${tag}@example.com`;
// First-person cockpit screenshots for a car, a truck and a premium car (debug spawn; no account needed beyond a guest park).
const frames = async (n) => { const f = await p.evaluate(() => window.__p3.frame); await p.waitForFunction(([t, n]) => window.__p3.frame > t + n, [f, n], { timeout: 120000 }); };
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Pov Tester', user: 'pv' + tag, email: `kemy.pv.test+${tag}@example.com`, pass: 'Pv-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate((g) => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', g);  location.hash = '#/me'; }, process.env.GFX || 'medium'); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi, null, { timeout: 240000 }); await W(3000); await p.keyboard.press('Escape'); await W(500);
  const spots = (process.env.SPOTS || 'sw:-97,122,1.57;pw:-86,300,0;pwN:-86,440,0;pbW:-62,270,1.57').split(';').map((t) => { const [n, v] = t.split(':'); const [x, z, y] = v.split(',').map(Number); return { n, x, z, y }; });
  for (const s of spots) { await p.evaluate((s) => { window.__p3.teleport(s.x, s.z); window.__p3.setYaw(s.y); }, s); await W(6000); await frames(30);
    await p.evaluate((s) => window.__p3.teleport(s.x, s.z, 26), s); await frames(2); await p.screenshot({ path: shot + s.n + '.png', timeout: 180000 }); console.log('shot', s.n); }
} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png', timeout: 180000 }).catch(() => {}); }
console.log('errors', errors.slice(0, 3)); await browser.close(); process.exit(fails ? 1 : 0);
