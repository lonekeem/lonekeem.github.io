// Headless browser test. Usage: NODE_PATH=<dir with playwright> node tests/kemy-quest/e2e.mjs <baseUrl> [shotPrefix]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'http://localhost:8799/').replace(/\/?$/, '/');
const shot = process.argv[3] || '/workspace/kemygame-';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const browser = await chromium.launch();
const errors = [];
async function page(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts); const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + 'kemy-quest.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__kq && window.__kq.screen === 'title');
  return p;
}
const p = await page({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await p.waitForTimeout(1200); await p.screenshot({ path: shot + 'title.png' }); ok('loads to title screen', true);
await p.click('text=Play'); await p.waitForFunction(() => __kq.screen === 'map'); await p.screenshot({ path: shot + 'map.png' }); ok('world map opens', true);
await p.click('[data-play="0"]'); await p.waitForFunction(() => __kq.screen === 'play');
const x0 = await p.evaluate(() => __kq.world.p.x);
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(700);
const x1 = await p.evaluate(() => __kq.world.p.x); ok('Kemy moves right with the keyboard', x1 > x0 + 30, `${x0 | 0} -> ${x1 | 0}`);
await p.keyboard.down('Space'); await p.waitForTimeout(150); const vy = await p.evaluate(() => __kq.world.p.vy); await p.keyboard.up('Space');
ok('Kemy jumps', vy < 0, `vy=${vy.toFixed(2)}`); await p.keyboard.up('ArrowRight');
// scripted run of 1-1 (screenshots along the way)
let rp = p.evaluate(() => __kq.replay(0)); await p.waitForTimeout(5200); await p.screenshot({ path: shot + 'pond.png' });
let r = await rp; ok('scripted run finishes 1-1', r.over === 'clear', JSON.stringify(r)); ok('Kemy collects stars', r.stars > 0, `${r.stars} stars`);
await p.waitForFunction(() => __kq.screen === 'clear', null, { timeout: 8000 }); await p.waitForTimeout(500); await p.screenshot({ path: shot + 'clear.png' }); ok('level clear screen', true);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('kq-progress')).levels['1-1']); ok('progress saved to localStorage', !!(saved && saved.done && saved.best > 0), JSON.stringify(saved));
for (const [i, name, at] of [[2, 'cave', 9000], [4, 'reef-water', 7000], [1, 'pond-water', 4200], [5, 'reef', 10500]]) {
  rp = p.evaluate((i) => __kq.replay(i), i); await p.waitForTimeout(at); await p.screenshot({ path: shot + name + '.png' }); r = await rp; ok(`scripted run finishes level ${i + 1}`, r.over === 'clear', JSON.stringify(r));
  await p.waitForFunction(() => __kq.screen === 'clear', null, { timeout: 8000 });
}
await p.evaluate(() => __kq.start(0)); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('pause menu opens', await p.evaluate(() => __kq.screen === 'pause')); await p.screenshot({ path: shot + 'pause.png' });
// mobile portrait + landscape with touch controls
const iphone = devices['iPhone 13'];
const m = await page({ ...iphone }); await m.evaluate(() => __kq.start(0)); await m.waitForTimeout(800);
const vis = await m.evaluate(() => { const b = document.querySelector('[data-k=jump]').getBoundingClientRect(); const l = document.querySelector('[data-k=left]').getBoundingClientRect(); return b.width > 60 && l.width > 60 && b.bottom <= innerHeight + 1; });
ok('touch controls render on a phone (portrait)', vis);
const mx0 = await m.evaluate(() => __kq.world.p.x); const btn = await m.$('[data-k=right]'); const bb = await btn.boundingBox();
await m.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
const cdp = await m.context().newCDPSession(m);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }] }); await m.waitForTimeout(600);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mx1 = await m.evaluate(() => __kq.world.p.x); ok('touch right button moves Kemy', mx1 > mx0 + 10, `${mx0 | 0} -> ${mx1 | 0}`);
await m.screenshot({ path: shot + 'mobile-portrait.png' });
const ml = await page({ ...devices['iPhone 13 landscape'] }); await ml.evaluate(() => __kq.start(2)); await ml.waitForTimeout(800); await ml.screenshot({ path: shot + 'mobile-landscape.png' });
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
const f = results.filter((x) => x[0] === 'FAIL').length; console.log(f ? `${f} FAILED` : `ALL ${results.length} PASSED`); process.exit(f ? 1 : 0);
