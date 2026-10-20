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
  await p.waitForSelector('#pal-form'); await p.evaluate(() => document.querySelector('[data-species=bear]').click()); await p.fill('#pal-name', 'Teddy'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await p.waitForTimeout(3000);
  const go = async (h, n) => { await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; scrollTo(0, 0); }, h); await p.waitForTimeout(4500); await p.screenshot({ path: shot + n + '.png' }); };
  for (const [h, n] of [['#/watch', 'foryou'], ['#/feed', 'feed'], ['#/explore', 'explore'], ['#/me', 'profile'], ['#/messages', 'messages'], ['#/settings', 'settings'], ['#/games', 'games'], ['#/scores', 'scores'], ['#/pals/store', 'store']]) await go(h, n);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForTimeout(3500); await p.evaluate(() => document.querySelector('[data-pa=care]').click()); await p.waitForTimeout(3500); await p.screenshot({ path: shot + 'care.png' });
} catch (e) { console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }); }
console.log('errors:', errors.join(' | ') || 'none'); await browser.close();
console.log(execFileSync('node', [new URL('./pals/cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
