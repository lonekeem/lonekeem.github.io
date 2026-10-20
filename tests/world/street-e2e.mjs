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
const out = {};
try {
  const a = await account('a', 'tiger', 'iPhone 13', process.env.GFX || 'medium', '#/street');
  await W(a, 5000); out.a0 = await a.evaluate(() => ({ pos: window.__p3.pos, kw: window.__kw, fps: window.__p3.fps }));
  await a.screenshot({ path: shot + 'portrait-gate.png' });
  // walk into the neighbourhood: teleport onto Pumpkin Lane, face the houses
  await a.evaluate(() => { window.__p3.teleport(-40, 106); window.__p3.setYaw(Math.PI * 0.15); }); await W(a, 3500); await a.screenshot({ path: shot + 'portrait-street.png' });
  // knock on a door
  const d = await a.evaluate(() => window.__kwApi.doors().find((x) => x.id === 'h16') || window.__kwApi.doors()[12]);
  await a.evaluate((d) => { window.__p3.teleport(d.x, d.z + (d.z > 110 ? -1.6 : 1.6)); }, d); await W(a, 1500);
  out.nearDoor = await a.evaluate(() => ({ near: window.__kw.nearDoor, btn: document.getElementById('ks-act')?.textContent, hidden: document.getElementById('ks-act')?.hidden }));
  await a.evaluate(() => document.getElementById('ks-act').click()); await W(a, 1700); await a.screenshot({ path: shot + 'portrait-knock.png' }); await W(a, 2000);
  out.afterKnock = await a.evaluate(() => ({ kw: window.__kw, toast: document.getElementById('ks-toast').textContent }));
  await a.evaluate(() => document.getElementById('ks-bag').click()); await W(a, 600); await a.screenshot({ path: shot + 'portrait-bag.png' }); await a.evaluate(() => document.querySelector('.ks-panel')?.remove());
  // second player
  if (steps.includes('all') || steps.includes('multi')) { const b = await account('b', 'elephant', 'Desktop Chrome', 'low', '#/park');
    await b.evaluate(() => { window.__p3.teleport(-38, 108); }); await a.evaluate(() => { window.__p3.teleport(-41, 104); window.__p3.setYaw(0.6); }); await W(a, 5000);
    out.multi = { aSees: (await a.evaluate(() => window.__p3.pos)).others, bSees: (await b.evaluate(() => window.__p3.pos)).others, room: (await a.evaluate(() => window.__p3.pos)).room };
    await b.evaluate(() => window.__p3.say('Trick or treat from B!')); await W(a, 3000); out.multi.aLog = await a.evaluate(() => document.getElementById('p3-log').textContent); await a.screenshot({ path: shot + 'portrait-two-players.png' });
    await b.close?.(); }
  await a.setViewportSize({ width: 844, height: 390 }); await W(a, 2500); await a.evaluate(() => { window.__p3.teleport(30, 112); window.__p3.setYaw(0.2); }); await W(a, 3000); await a.screenshot({ path: shot + 'landscape-parkcorner.png' });
  await a.evaluate(() => { window.__p3.teleport(0, 60); window.__p3.setYaw(0); }); await W(a, 3000); await a.screenshot({ path: shot + 'landscape-gate-from-park.png' });
  out.fps = await a.evaluate(() => window.__p3.fps);
  if (steps.includes('drive') || steps.includes('all')) out.drive = await (await import('./street-drive.mjs')).default(a, shot, W);
} catch (e) { console.log('ERR', e.message); }
console.log(JSON.stringify(out, null, 1)); console.log('errors:', errors.slice(0, 20).join('\n') || 'none'); await browser.close();
