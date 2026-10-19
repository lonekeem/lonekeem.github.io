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
  await p.evaluate(() => document.querySelector('[data-species="tiger"]').click()); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await p.waitForTimeout(3000);
  const go = async (h, sel) => { await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h); await p.waitForSelector(sel, { timeout: 20000 }); await p.waitForTimeout(2500); };
  const tap = (sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
  await go('#/pals/store', '#ps-cv'); await p.screenshot({ path: shot + 'store-outfits.png', fullPage: true });
  for (const id of ['f_cap_blue', 'f_hoodie_pink', 'f_skirt_pink', 'f_boots_yellow']) { await tap(`[data-id="${id}"]`); await p.waitForTimeout(200); }
  await tap('[data-tab=hand]'); await p.waitForTimeout(300); await tap('[data-id="f_balloon_red"]'); await tap('[data-tab=outfits]'); await p.waitForTimeout(300);
  await tap('[data-g=g]'); await p.waitForTimeout(300); await tap('[data-id="tiara_gold"]'); await p.waitForTimeout(1200); await p.screenshot({ path: shot + 'store-preview.png' });
  await tap('#ps-undo'); await tap('[data-tab=jewelry]'); await p.waitForTimeout(300);
  for (const id of ['f_beads_pink', 'f_studs_gold', 'f_bracelet_gold', 'f_ring_gold']) { await tap(`[data-id="${id}"]`); await p.waitForTimeout(150); }
  await p.waitForTimeout(1200); await p.screenshot({ path: shot + 'store-jewelry.png', fullPage: true });
  await tap('#ps-bgbtn'); await p.waitForTimeout(500); await tap('[data-bg="b_candy"]'); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'store-bgs.png', fullPage: true });
  await tap('[data-tab=pals]'); await tap('[data-id="rare_galaxy"]'); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'store-rare.png' });
  await tap('[data-rv=""]'); await tap('#ps-save'); await p.waitForTimeout(3500);
  const saved = await p.evaluate(async () => { const m = await import('/js/pals/core.js'); return 1; });
  await p.reload(); await p.waitForTimeout(2000); await go('#/me', '[data-pa=care]'); await p.waitForTimeout(2500); await p.screenshot({ path: shot + 'profile.png' });
  await tap('[data-pa=care]'); await p.waitForSelector('.pal-scene canvas'); await p.waitForTimeout(3000); await p.screenshot({ path: shot + 'care.png' });
  await p.reload(); await p.waitForTimeout(1500); await go('#/pals', '.pal-card[data-id]'); await p.waitForTimeout(2000); await p.screenshot({ path: shot + 'palbox-after-reload.png' });
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/settings'; }); await p.waitForSelector('#s-theme-pick', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('s-theme-pick').scrollIntoView({ block: 'center' })); await p.waitForTimeout(600); await p.screenshot({ path: '/workspace/theme-playlist' + (process.argv[4] ? '-' + process.argv[4].replace(/\W/g, '') : '') + '.png' });
  const pl = await p.evaluate(async () => { const t = await import('/js/theme.js'); t.setPick('1'); await t.play({ force: true }); await new Promise((r) => setTimeout(r, 2500)); const g = t.gainInfo(); const cached = await caches.keys().then(async (ks) => { for (const k of ks) { const c = await caches.open(k); const r = await c.keys(); if (r.some((q) => /m4a/.test(q.url))) return true; } return false; }); t.stop(0); return { title: g.title, t: g.currentTime, dur: g.duration, cached }; });
  console.log('playlist', JSON.stringify(pl));
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 60 ? requestAnimationFrame(f) : r(60000 / (performance.now() - t0))); requestAnimationFrame(f); })); console.log('fps', fps.toFixed(1));
} catch (e) { console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }); }
console.log('errors:', errors.join(' | ') || 'none'); await browser.close();
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
