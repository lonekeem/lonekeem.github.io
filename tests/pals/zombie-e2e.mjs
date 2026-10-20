// Pal Zombie Survival e2e: throwaway account (deleted afterwards via cleanup.mjs, the app's own delete flow),
// hatch a Pal, open the Arcade + game, play a few waves with simulated touch, record FPS, screenshots and video.
// node tests/pals/zombie-e2e.mjs <base> <shotPrefix> <device> [video]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
const { chromium, webkit, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/zombie-'; const dev = process.argv[4] || 'Pixel 7'; const vid = process.argv[5];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const ctx = await browser.newContext({ ...devices[dev], ...(vid ? { recordVideo: { dir: '/tmp/zvid', size: devices[dev].viewport } } : {}) }); const p = await ctx.newPage();
p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text().slice(0, 160)); });
const out = {};
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Zed Tester'); await p.fill('#p-user', `pta${stamp}`); await p.fill('#p-email', `kemy.pals.test+a${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await p.waitForTimeout(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await p.waitForTimeout(250); }
  await p.waitForSelector('#pal-form'); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('[data-species="tiger"]').click()); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await p.waitForTimeout(3000);
  const go = async (h, sel) => { await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h); await p.waitForSelector(sel, { timeout: 25000 }); await p.waitForTimeout(1500); };
  await go('#/park', '#park-arcade'); await p.screenshot({ path: shot + 'park-button.png' });
  await go('#/arcade', '[data-mg=zombie]'); await p.screenshot({ path: shot + 'arcade.png' });
  await go('#/arcade/armory', '.za-grid'); await p.evaluate(() => document.querySelector('[data-id=z_foam]').click()); await p.waitForTimeout(500); await p.screenshot({ path: shot + 'armory.png' });
  await p.evaluate(() => document.querySelector('.za-sheet [data-close]')?.click());
  await go('#/arcade/zombie', '.kc-tut'); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'tutorial.png' });
  await p.evaluate(() => document.querySelector('.kc-tut button').click()); await p.waitForTimeout(800);
  const vp = p.viewportSize(); const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const fireBtn = await p.evaluate(() => { const r = document.querySelector('[data-b=fire]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  // walk with the floating joystick + hold fire + drag-look, for a while
  const jx = vp.width * 0.22, jy = vp.height * 0.75; const fpsLog = [];
  for (let k = 0; k < 6; k++) {
    const lx = vp.width * 0.7, ly = vp.height * 0.4; await touch('touchStart', [[jx, jy], fireBtn, [lx, ly]]);
    for (let i = 0; i < 20; i++) { const a = (k * 20 + i) / 9; await touch('touchMove', [[jx + Math.cos(a) * 50, jy + Math.sin(a) * 50], fireBtn, [lx + i * 6, ly]]); await p.waitForTimeout(100); }
    await touch('touchEnd', []);
    await p.evaluate(() => window.__zombie?.game?._debug && document.querySelector('[data-b=switch]')); 
    const s = await p.evaluate(() => window.__zombie && window.__zombie.state); fpsLog.push(s.fps);
    if (k === 2) await p.screenshot({ path: shot + 'gameplay-1.png' });
  }
  out.state1 = await p.evaluate(() => window.__zombie.state);
  // jump to a boss wave to show the boss + effects
  await p.evaluate(() => window.__zombie.game._debug.skipTo(5)); await p.waitForTimeout(2500);
  await touch('touchStart', [fireBtn]); await p.waitForTimeout(2500); await p.screenshot({ path: shot + 'boss.png' }); await touch('touchEnd', []);
  await p.evaluate(() => document.querySelector('[data-b=switch]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(300);
  await touch('touchStart', [fireBtn]); await p.waitForTimeout(1500); await touch('touchEnd', []);
  await p.evaluate(() => document.querySelector('[data-t=pov]').click()); await touch('touchStart', [fireBtn]); await p.waitForTimeout(2000); await p.screenshot({ path: shot + 'pov.png' }); await touch('touchEnd', []);
  await p.evaluate(() => document.querySelector('[data-t=pov]').click());
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(1100); fpsLog.push((await p.evaluate(() => window.__zombie.state)).fps); }
  await p.evaluate(() => document.querySelector('.kc-gear').click()); await p.waitForTimeout(400); await p.screenshot({ path: shot + 'controls-settings.png' }); await p.evaluate(() => document.querySelector('.kc-set [data-done]').click());
  out.state2 = await p.evaluate(() => window.__zombie.state); out.fps = fpsLog;
  await p.evaluate(() => window.__zombie.game._debug.setHp(0.01)); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__zombie.game._debug.spawn('walk'); }); await p.waitForTimeout(500);
  await p.evaluate(() => window.__zombie.game.quit()); await p.waitForTimeout(1500); await p.screenshot({ path: shot + 'gameover.png' });
  // diamonds are saved after the 45 s server gap
  await p.waitForFunction(() => /saved|limit|Could not/.test(document.querySelector('[data-dia]')?.textContent || ''), null, { timeout: 70000 }).catch(() => {});
  out.diaMsg = await p.evaluate(() => document.querySelector('[data-dia]')?.textContent); await p.screenshot({ path: shot + 'gameover-saved.png' });
  await p.waitForTimeout(13000); out.lb = await p.evaluate(() => document.querySelector('.zg-card a[href="#/scores/pals"]')?.textContent || '');
  await p.evaluate(() => { document.querySelector('.zg-panel a[href="#/arcade/armory"]').click(); }); await p.waitForSelector('.za-grid', { timeout: 15000 }); await p.waitForTimeout(1500);
  out.bal = await p.evaluate(() => document.querySelector('.za-bal').textContent);
  await p.evaluate(() => document.querySelector('[data-id=z_foam]').click()); await p.waitForTimeout(300); await p.evaluate(() => document.querySelector('.za-sheet [data-buy]')?.click()); await p.waitForTimeout(800);
  await p.screenshot({ path: shot + 'armory-confirm.png' }); await p.evaluate(() => document.querySelector('#bs-yes')?.click()); await p.waitForTimeout(3000);
  out.sheet = await p.evaluate(() => document.querySelector('.bs')?.innerText.replace(/\s+/g, ' ').slice(0, 160) || '');
  out.afterBuy = await p.evaluate(() => [document.querySelector('.za-bal')?.textContent, document.querySelector('.toast, #toast')?.textContent || '']); await p.screenshot({ path: shot + 'armory-after.png' });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); await p.screenshot({ path: shot + 'error.png' }).catch(() => {}); }
console.log(dev, JSON.stringify(out)); console.log('errors:', errors.slice(0, 8).join(' | ') || 'none');
await ctx.close(); if (vid) { const f = await p.video()?.path(); if (f) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', vid]); console.log('video', vid); } }
await browser.close();
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
