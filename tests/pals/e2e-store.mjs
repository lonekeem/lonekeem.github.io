// Live visual check of 3D Pals inside the real app (one throwaway account, deleted afterwards via cleanup.mjs).
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const { chromium, devices } = playwright();
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/pal3d-app-';
const browser = await chromium.launch({ executablePath: exe(), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const ctx = await emuContext(browser, { ...devices[process.argv[4] || 'iPhone 13'] }); const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e)));
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Pal Tester a', user: `pta${stamp}`, email: `kemy.pals.test+a${stamp}@example.com`, pass });
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
  { // real buy: cheapest unowned starred tile we can afford, through the buy sheet
    if (process.env.EMU_FS) { // emulator only: top up the throwaway account's wallet with the owner token so a priced item is affordable
      const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser?.uid);
      const r = await fetch(`http://localhost:${process.env.EMU_FS}/v1/projects/lone-keem-studios/databases/(default)/documents/users/${uid}/pal/wallet?updateMask.fieldPaths=coins`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { coins: { integerValue: '5000' } } }) });
      const shopJ = await p.evaluate(async () => (await import('/js/pals/catalog.js')).shopDoc()); // publish the catalog prices like the admin does on live
      const enc = (v) => Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : v && typeof v === 'object' ? { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'boolean' ? { booleanValue: v } : v == null ? { nullValue: null } : { stringValue: String(v) };
      const r2 = await fetch(`http://localhost:${process.env.EMU_FS}/v1/projects/lone-keem-studios/databases/(default)/documents/config/palShop`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: enc(shopJ).mapValue.fields }) });
      console.log('seed wallet', uid, r.status, 'shop', r2.status); await p.reload(); await p.waitForTimeout(2500); await go('#/pals/store', '#ps-cv'); }
    const pick = await p.evaluate(() => { const bal = +(document.getElementById('ps-c')?.textContent || '0').replace(/\D/g, ''); let best = null; for (const t of document.querySelectorAll('.ps-tile[data-id]')) { const m = /★ (\d+)/.exec(t.querySelector('small')?.textContent || ''); if (m && +m[1] > 0 && +m[1] <= bal && (!best || +m[1] < best.p)) best = { id: t.dataset.id, p: +m[1] }; } return { bal, best }; });
    console.log('buy pick', JSON.stringify(pick));
    if (pick.best) { await tap(`[data-id="${pick.best.id}"]`); await p.waitForSelector('#ps-buynow'); await tap('#ps-buynow'); await p.waitForSelector('#bs-yes', { timeout: 10000 }); await p.screenshot({ path: shot + 'buy-sheet.png' }); await tap('#bs-yes'); await p.waitForSelector('.bs-ok, .bs-need', { timeout: 15000 }); await p.screenshot({ path: shot + 'buy-done.png' });
      const after = await p.evaluate(() => +(document.getElementById('ps-c')?.textContent || '0').replace(/\D/g, '')); console.log((after === pick.bal - pick.best.p ? 'PASS' : 'FAIL') + ' buy charged', pick.bal, '->', after);
      await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; }); await p.waitForTimeout(500);
      const owned = await p.evaluate((id) => document.querySelector(`.ps-tile[data-id="${id}"] small`)?.textContent, pick.best.id); console.log((/Owned/.test(owned || '') ? 'PASS' : 'FAIL') + ' tile shows owned', owned); }
  }
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
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/settings'; }); await p.waitForSelector('#set-theme-pick', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('set-theme-pick').scrollIntoView({ block: 'center' })); await p.waitForTimeout(600); await p.screenshot({ path: '/workspace/theme-playlist' + (process.argv[4] ? '-' + process.argv[4].replace(/\W/g, '') : '') + '.png' });
  const pl = await p.evaluate(async () => { const t = await import('/js/theme.js'); t.setPick('1'); await t.play({ force: true }); await new Promise((r) => setTimeout(r, 2500)); const g = t.gainInfo(); const cached = await caches.keys().then(async (ks) => { for (const k of ks) { const c = await caches.open(k); const r = await c.keys(); if (r.some((q) => /m4a/.test(q.url))) return true; } return false; }); t.stop(0); return { title: g.title, t: g.currentTime, dur: g.duration, cached }; });
  console.log('playlist', JSON.stringify(pl));
  const fps = await p.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => (++n < 60 ? requestAnimationFrame(f) : r(60000 / (performance.now() - t0))); requestAnimationFrame(f); })); console.log('fps', fps.toFixed(1));
} catch (e) { console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png' }); }
console.log('errors:', errors.join(' | ') || 'none'); await browser.close();
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
