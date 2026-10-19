// Headless browser test. Usage: NODE_PATH=<dir with playwright> node tests/kemy-quest/e2e.mjs <baseUrl> [shotPrefix] [newShotPrefix]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'http://localhost:8799/').replace(/\/?$/, '/');
const shot = process.argv[3] || '/workspace/kemygame-';
const shot2 = process.argv[4] || '/workspace/kemyquest2-';
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const browser = await chromium.launch();
const errors = [];
async function page(ctxOpts, init) {
  const ctx = await browser.newContext(ctxOpts); const p = await ctx.newPage();
  if (init) await ctx.addInitScript(init);
  p.on('console', (m) => { if (m.type() === 'error' && !/firestore|firebase|googleapis|ERR_|net::/i.test(m.text())) errors.push(m.text()); }); p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + 'kemy-quest.html', { waitUntil: 'load' }); await p.waitForFunction(() => window.__kq && window.__kq.screen === 'title');
  return p;
}
const idx = (p, id) => p.evaluate((id) => __kq.levels.indexOf(id), id);
const p = await page({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }, () => { if (!sessionStorage.kqInit) { localStorage.setItem('kq-settings', JSON.stringify({ muted: true })); sessionStorage.kqInit = 1; } });
const nLv = await p.evaluate(() => __kq.levels.length); ok('at least 40 levels load', nLv >= 40, `${nLv} levels`);
await p.waitForTimeout(800); await p.screenshot({ path: shot + 'title.png' }); ok('loads to title screen', true);
await p.click('text=Play'); await p.waitForFunction(() => __kq.screen === 'map'); await p.waitForTimeout(400); await p.screenshot({ path: shot + 'map.png' }); ok('world map opens', true);
const pages = await p.evaluate(() => document.querySelectorAll('.kq-page').length); ok('map has 8 worlds + secret page', pages === 9, `${pages} pages`);
const lock = await p.evaluate(() => ({ l12: !!document.querySelector('[data-play="1"][disabled]'), l41: !!document.querySelector(`[data-play="${__kq.levels.indexOf('4-1')}"][disabled]`), b1: !!document.querySelector(`[data-play="${__kq.levels.indexOf('B-1')}"][disabled]`) }));
ok('fresh save: later levels and secret levels are locked', lock.l12 && lock.l41 && lock.b1, JSON.stringify(lock));
await p.click('[data-pg="1"]'); await p.waitForTimeout(700);
let pg = await p.evaluate(() => ({ page: __kq.page, left: document.querySelector('.kq-pages').scrollLeft }));
ok('map "next world" arrow pages to world 2', pg.page === 1 && pg.left > 100, JSON.stringify(pg));
await p.click('[data-dot="7"]'); await p.waitForTimeout(800); pg = await p.evaluate(() => __kq.page); ok('map dots jump to world 8', pg === 7, `page ${pg}`);
await p.screenshot({ path: shot2 + 'map-castle.png' });
await p.keyboard.press('Escape');
await p.evaluate(() => __kq.renderMap()); await p.waitForTimeout(300);
await p.click('[data-pg="-1"]'); await p.waitForTimeout(300); await p.click('[data-dot="0"]'); await p.waitForTimeout(600);
await p.click('[data-play="0"]'); await p.waitForFunction(() => __kq.screen === 'play');
const x0 = await p.evaluate(() => __kq.world.p.x);
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(700);
const x1 = await p.evaluate(() => __kq.world.p.x); ok('Kemy moves right with the keyboard', x1 > x0 + 30, `${x0 | 0} -> ${x1 | 0}`);
await p.keyboard.down('Space'); await p.waitForTimeout(150); const vy = await p.evaluate(() => __kq.world.p.vy); await p.keyboard.up('Space');
ok('Kemy jumps', vy < 0, `vy=${vy.toFixed(2)}`); await p.keyboard.up('ArrowRight');
// scripted run of 1-1 at real speed (screenshots along the way)
let rp = p.evaluate(() => __kq.replay(0)); await p.waitForTimeout(5200); await p.screenshot({ path: shot + 'pond.png' });
let r = await rp; ok('scripted run finishes 1-1', r.over === 'clear', JSON.stringify(r)); ok('Kemy collects stars', r.stars > 0, `${r.stars} stars`);
await p.waitForFunction(() => __kq.screen === 'clear', null, { timeout: 8000 }); await p.waitForTimeout(500); await p.screenshot({ path: shot + 'clear.png' }); ok('level clear screen', true);
const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('kq-progress')).levels['1-1']); ok('progress saved to localStorage', !!(saved && saved.done && saved.best > 0), JSON.stringify(saved));
// scripted runs of new levels at 4x speed, one per new world, plus bosses and a secret level
const runs = [['2-1', 'kemygame-cave', 2400], ['1-3', 'pond2', 2500], ['4-1', 'meadow', 2600], ['5-3', 'sky', 3200], ['6-2', 'frost', 2400], ['7-4', 'volcano', 3800], ['7-3', 'magma-climb', 2600],
  ['8-3', 'castle', 2600], ['1-5', 'boss-bramble', 1200], ['4-5', 'boss-buzzbelle', 2200], ['8-5', 'boss-noctra', 3000], ['B-1', 'candy', 2200]];
for (const [id, name, at] of runs) {
  const i = await idx(p, id); rp = p.evaluate((i) => __kq.replay(i, 4), i); await p.waitForTimeout(at);
  await p.screenshot({ path: name.startsWith('kemygame') ? `/workspace/${name}.png` : shot2 + name + '.png' }); r = await rp;
  ok(`scripted run finishes ${id}`, r.over === 'clear', JSON.stringify(r));
  await p.waitForFunction(() => __kq.screen === 'clear', null, { timeout: 8000 });
}
const clearTxt = await p.evaluate(() => document.querySelector('.kq-clear h2').textContent); ok('boss/secret clear screen renders', clearTxt.length > 3, clearTxt);
await p.evaluate(() => __kq.start(0)); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('pause menu opens', await p.evaluate(() => __kq.screen === 'pause')); await p.screenshot({ path: shot + 'pause.png' });
// legacy save from the 6-level version keeps its unlocks; Big Stars open secret levels
const legacy = { levels: Object.fromEntries(['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'].map((id) => [id, { done: true, best: 30000, stars: 10, big: [true, true, true] }])) };
const pl = await page({ viewport: { width: 1280, height: 720 } }, (s) => { if (!sessionStorage.kqInit) { localStorage.setItem('kq-progress', s); localStorage.setItem('kq-settings', '{"muted":true}'); sessionStorage.kqInit = 1; } }, JSON.stringify(legacy));
await pl.addInitScript(() => {}); await pl.evaluate((s) => { localStorage.setItem('kq-progress', s); }, JSON.stringify(legacy)); await pl.reload(); await pl.waitForFunction(() => window.__kq && __kq.screen === 'title');
const un = await pl.evaluate(() => Object.fromEntries(['1-3', '2-1', '2-3', '3-1', '3-3', '4-1', 'B-1'].map((id) => [id, __kq.unlocked(__kq.levels.indexOf(id))])));
ok('old 6-level save: finished levels stay unlocked and the next ones open', un['2-1'] && un['3-1'] && un['1-3'] && un['2-3'] && un['3-3'] && !un['4-1'], JSON.stringify(un));
ok('18 Big Stars is not enough for the first secret level', !un['B-1']);
await pl.click('text=Play'); await pl.waitForFunction(() => __kq.screen === 'map'); await pl.waitForTimeout(500);
const big = await pl.evaluate(() => document.querySelector('.kq-map .kq-bar .kq-pill').textContent.trim()); ok('Big Star total carried over', /^18\//.test(big), big);
const pg0 = await pl.evaluate(() => __kq.page); ok('map opens on the newest unlocked world', pg0 === 2, `page ${pg0}`);
await pl.evaluate(() => { const p = JSON.parse(localStorage.getItem('kq-progress')); p.levels['1-3'] = { done: true, best: 30000, stars: 1, big: [true, true, false] }; localStorage.setItem('kq-progress', JSON.stringify(p)); });
await pl.reload(); await pl.waitForFunction(() => window.__kq && __kq.screen === 'title');
ok('20 Big Stars unlocks secret level B-1', await pl.evaluate(() => __kq.unlocked(__kq.levels.indexOf('B-1'))));
// reduced motion + high contrast on a lava level
await pl.evaluate(() => localStorage.setItem('kq-settings', JSON.stringify({ muted: true, rm: true, hc: true }))); await pl.reload(); await pl.waitForFunction(() => window.__kq && __kq.screen === 'title');
rp = pl.evaluate((i) => __kq.replay(i, 2), await idx(pl, '7-1')); await pl.waitForTimeout(3500); await pl.screenshot({ path: shot2 + 'volcano-hc-rm.png' }); r = await rp;
ok('reduced motion + high contrast: 7-1 still finishes', r.over === 'clear', JSON.stringify(r));
// mobile portrait: map swipes, touch controls, a new level
const iphone = devices['iPhone 13'];
const m = await page({ ...iphone }, () => { if (!sessionStorage.kqInit) { localStorage.setItem('kq-settings', '{"muted":true}'); sessionStorage.kqInit = 1; } });
await m.evaluate(() => __kq.renderMap()); await m.waitForTimeout(600);
const fit = await m.evaluate(() => { const b = document.querySelector('.kq-pages'), pg = document.querySelector('.kq-page'), pn = document.querySelector('.kq-map'); return { bw: b.clientWidth, pw: pg.getBoundingClientRect().width, right: pn.getBoundingClientRect().right, vw: innerWidth }; });
ok('mobile map pages fit the screen', Math.abs(fit.bw - fit.pw) < 2 && fit.right <= fit.vw + 1, JSON.stringify(fit));
const box = await (await m.$('.kq-pages')).boundingBox(); const cdp0 = await m.context().newCDPSession(m);
const y = box.y + box.height * 0.3;
await cdp0.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.85, y }] });
for (let k = 1; k <= 8; k++) { await cdp0.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * (0.85 - k * 0.08), y }] }); await m.waitForTimeout(16); }
await cdp0.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(900);
const sw = await m.evaluate(() => ({ page: __kq.page, left: document.querySelector('.kq-pages').scrollLeft }));
ok('mobile: swiping the map pages to the next world', sw.page >= 1 && sw.left > 50, JSON.stringify(sw));
const nb = await m.$('[data-pg="1"]'); const nbb = await nb.boundingBox(); await m.touchscreen.tap(nbb.x + nbb.width / 2, nbb.y + nbb.height / 2); await m.waitForTimeout(900);
const sw2 = await m.evaluate(() => __kq.page); ok('mobile: tapping the next arrow pages again', sw2 === sw.page + 1, `page ${sw2}`);
await m.screenshot({ path: shot2 + 'map-mobile.png' });
await m.evaluate((i) => __kq.start(i), await idx(m, '6-1')); await m.waitForTimeout(800);
const vis = await m.evaluate(() => { const b = document.querySelector('[data-k=jump]').getBoundingClientRect(); const l = document.querySelector('[data-k=left]').getBoundingClientRect(); return b.width > 60 && l.width > 60 && b.bottom <= innerHeight + 1; });
ok('touch controls render on a phone (portrait)', vis);
const mx0 = await m.evaluate(() => __kq.world.p.x); const btn = await m.$('[data-k=right]'); const bb = await btn.boundingBox();
const cdp = await m.context().newCDPSession(m);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }] }); await m.waitForTimeout(600);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
const mx1 = await m.evaluate(() => __kq.world.p.x); ok('touch right button moves Kemy (on ice in 6-1)', mx1 > mx0 + 10, `${mx0 | 0} -> ${mx1 | 0}`);
await m.screenshot({ path: shot + 'mobile-portrait.png' });
// frame pacing on a busy level on the phone profile (soft check: headless timing)
await m.evaluate((i) => __kq.replay(i, 1), await idx(m, '8-4')); await m.waitForTimeout(1500);
const fps = await m.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); }; requestAnimationFrame(f); }));
ok('phone profile renders a busy level smoothly (>= 30 fps headless)', fps >= 30, `${fps.toFixed(0)} fps`);
const ml = await page({ ...devices['iPhone 13 landscape'] }); await ml.evaluate((i) => __kq.start(i), await idx(ml, '5-2')); await ml.waitForTimeout(800); await ml.screenshot({ path: shot + 'mobile-landscape.png' });
const ml2 = await ml.evaluate(() => { const s = document.querySelector('.kq-canvas').getBoundingClientRect(); return s.width > 300 && s.height > 200; }); ok('landscape phone shows the game canvas', ml2);
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
await browser.close();
const f = results.filter((x) => x[0] === 'FAIL').length; console.log(f ? `${f} FAILED` : `ALL ${results.length} PASSED`); process.exit(f ? 1 : 0);
