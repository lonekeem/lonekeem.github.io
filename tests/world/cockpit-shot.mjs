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
  await p.evaluate((g) => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-pal-gfx', g); localStorage.setItem('kemy-car-cam', 'pov'); localStorage.setItem('kemy-car-cam-manual', '1'); location.hash = '#/me'; }, process.env.GFX || 'medium'); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi, null, { timeout: 240000 }); await W(3000); await p.keyboard.press('Escape'); await W(500);
  for (const id of (process.env.CARS || 'pip,haul,comet').split(',')) {
    await p.evaluate(() => window.__kdApi.out && window.__kdApi.out()); await W(1500);
    await p.evaluate((id) => { window.__p3.teleport(31.5, 270); window.__kdApi.spawn(id, undefined, { x: 30, z: 270, yaw: Math.PI / 2 }); }, id); await W(1500);
    await p.evaluate(() => window.__kdApi.enter()); await p.waitForFunction(() => window.__kdApi.carInfo()?.state === 'drive', null, { timeout: 90000 });
    await p.keyboard.down('a'); await W(500); await frames(10); await p.screenshot({ path: shot + id + '.png' }); if (process.env.PROBE) console.log('near', JSON.stringify(await p.evaluate(() => { const sc = window.__p3.scene(), out = []; const q0 = window.__p3.pos; const c0 = (typeof q0 === 'function' ? q0() : q0).cam; let v = null; sc.traverse((o) => { if (!v && o.isMesh) v = o.position.clone(); }); const cp = v.clone().set(c0.x, c0.y, c0.z); sc.traverse((o) => { if (!o.isMesh || !o.visible) return; let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false; if (!vis) return; o.getWorldPosition(v); const d = v.distanceTo(cp); if (d < 2.5) { o.geometry.computeBoundingSphere(); out.push([o.name || o.parent && o.parent.name, o.geometry.type, +d.toFixed(2), +(o.geometry.boundingSphere.radius * o.getWorldScale(v.clone()).x).toFixed(2)]); } }); return out.filter((x) => x[3] > 0.25).slice(0, 30); }))); await p.keyboard.up('a');
    console.log(id, JSON.stringify(await p.evaluate(() => window.__kd.cockpit)));
  }
} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }).catch(() => {}); }
console.log('errors', errors.slice(0, 3)); await browser.close(); process.exit(fails ? 1 : 0);
