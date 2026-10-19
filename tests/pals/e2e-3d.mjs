// Live visual check of 3D Pals inside the real app (one throwaway account, deleted afterwards via cleanup.mjs).
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/pal3d-app-';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const ctx = await browser.newContext({ ...devices[process.argv[4] || 'iPhone 13'] }); const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e)));
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Pal Tester a'); await p.fill('#p-user', `pta${stamp}`); await p.fill('#p-email', `kemy.pals.test+a${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => localStorage.setItem('kemy-pals-debug', '1'));
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await p.waitForTimeout(250); }
  await p.waitForSelector('#pal-form'); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'hatch.png' });
  await p.click('[data-species="puppy"]'); await p.fill('#pal-name', 'Bloop'); await p.click('#pal-form [type=submit]'); await p.waitForTimeout(3000);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForSelector('[data-pa=care]'); await p.click('[data-pa=care]'); await p.waitForSelector('[data-dbg]');
  for (let i = 0; i < 7; i++) { await p.evaluate(() => document.querySelector('[data-dbg]')?.click()); await p.waitForTimeout(1300); }
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/pals'; }); await p.waitForSelector('.pal-box'); await p.waitForTimeout(800);
  const egg = await p.$('[data-hatch]'); if (egg) { await egg.click(); await p.waitForSelector('#pal-form'); await p.click('[data-species="elephant"]'); await p.fill('#pal-name', 'Toots'); await p.click('#pal-form [type=submit]'); await p.waitForTimeout(3000); }
  await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'pals.png' });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/me'; }); await p.waitForTimeout(3500); await p.screenshot({ path: shot + 'profile.png' });
  await p.evaluate(() => { location.hash = '#/park'; }); await p.waitForSelector('#park-cv', { timeout: 20000 }); await p.waitForTimeout(3500); await p.screenshot({ path: shot + 'park.png' });
  await p.evaluate(() => { location.hash = '#/games/pals'; }); await p.waitForSelector('.pg-lobby', { timeout: 15000 }); await p.click('[data-g=stars]'); await p.click('[data-m=cpu]'); await p.waitForSelector('.pg-cv'); await p.waitForTimeout(2500); await p.screenshot({ path: shot + 'game.png' });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/pals'; }); await p.waitForSelector('[data-c=talk]', { timeout: 15000 }); await p.click('[data-c=talk]'); await p.waitForSelector('#tk-in'); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'chat.png' });
  // dancing: start the theme, measure FPS on the profile
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/me'; }); await p.waitForTimeout(2000);
  await p.evaluate(async () => { const t = await import('/js/theme.js'); t.setMode && t.setMode('play', { start: true }); });
  await p.waitForTimeout(3000); await p.screenshot({ path: shot + 'profile-dance.png' });
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 90 ? requestAnimationFrame(f) : r(90000 / (performance.now() - t0))); requestAnimationFrame(f); }));
  console.log('3d ready', await p.evaluate(async () => (await import('/js/pals/dance.js')).pal3dReady()), 'profile fps', fps.toFixed(1));
} catch (e) { console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }); }
console.log('errors:', errors.join(' | ') || 'none'); await browser.close();
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
