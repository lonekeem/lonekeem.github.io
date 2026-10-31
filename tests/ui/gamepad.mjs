// Headless check of controller + keyboard guides. Usage: NODE_PATH=<pw> node tests/ui/gamepad.mjs http://localhost:8799/
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = (process.argv[2] || 'http://localhost:8799/').replace(/\/?$/, '/');
const exe = process.env.CHROME || undefined;
const browser = await chromium.launch({ executablePath: exe });
let fails = 0; const ok = (n, c, i = '') => { if (!c) fails++; console.log(c ? 'PASS' : 'FAIL', n, i); };
// Mock pad: window.__pad holds buttons/axes; getGamepads returns it once connected.
const mock = (id) => `(() => { const pad = { id: ${JSON.stringify(id)}, index: 0, connected: true, mapping: 'standard', axes: [0,0,0,0], buttons: Array.from({length:17}, () => ({ pressed:false, value:0 })) };
  window.__pad = pad; window.__on = false; navigator.getGamepads = () => window.__on ? [pad] : [];
  window.__connect = () => { window.__on = true; const e = new Event('gamepadconnected'); e.gamepad = pad; window.dispatchEvent(e); };
  window.__btn = (i, v) => { pad.buttons[i] = { pressed: !!v, value: v ? 1 : 0 }; }; })()`;
const errs = [];
async function mk(id, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  await ctx.addInitScript(mock(id));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(url + ': ' + e));
  p.on('console', (m) => { if (m.type() === 'error' && !/firestore|firebase|googleapis|gstatic|ERR_|net::|Failed to load resource/i.test(m.text())) errs.push(url + ': ' + m.text()); });
  await p.goto(base + url);
  return p;
}
const press = async (p, i) => { await p.evaluate((i) => __btn(i, 1), i); await p.waitForTimeout(80); await p.evaluate((i) => __btn(i, 0), i); await p.waitForTimeout(80); };

for (const [fam, id, a, b] of [['ps', 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', '✕', '○'], ['xbox', 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'A', 'B']]) {
  const p = await mk(id, 'tests/ui/gamepad.html');
  await p.waitForFunction(() => window.ready);
  const idle = await p.evaluate(() => new Promise((r) => { let n = 0; const g = navigator.getGamepads; navigator.getGamepads = () => { n++; return g(); }; setTimeout(() => { navigator.getGamepads = g; r(n); }, 500); }));
  ok(`${fam}: no polling with no pad`, idle === 0, `calls=${idle}`);
  await p.evaluate(() => __connect());
  await p.waitForSelector('.kg-toast', { timeout: 4000 });
  const t = await p.textContent('.kg-toast');
  ok(`${fam}: toast names controller`, t.includes(fam === 'ps' ? 'PlayStation controller connected' : 'Xbox controller connected'), t.slice(0, 40));
  ok(`${fam}: toast glyphs`, t.includes(a) && t.includes(b));
  await p.screenshot({ path: `/workspace/gp-toast-${fam}.png` });
  // Move with left stick
  await p.evaluate(() => { __pad.axes[0] = 0.9; }); await p.waitForTimeout(100);
  const mv = await p.evaluate(() => moveStick()); ok(`${fam}: left stick moves`, mv && mv.x > 0.5, JSON.stringify(mv));
  await p.evaluate(() => { __pad.axes[0] = 0.1; }); await p.waitForTimeout(100);
  ok(`${fam}: deadzone`, (await p.evaluate(() => moveStick())) === null);
  await p.evaluate(() => { __pad.axes[0] = 0; });
  await p.waitForTimeout(450); const dbg = await p.evaluate(() => !!document.querySelector('.kg-toast')); await press(p, 0); await press(p, 2); await press(p, 9);
  const log = await p.evaluate(() => log);
  ok(`${fam}: confirm=jump, X=use, Start=menu`, log.includes('jump') && log.includes('use') && log.includes('menu'), log.join(','));
  const td = await p.evaluate(() => new Promise((r) => setTimeout(() => r([...document.querySelectorAll('.kg-toast')].map((e) => e.className).join()), 700)));
  ok(`${fam}: toast stays after gameplay buttons`, dbg && /kg-toast/.test(td) && !/ out/.test(td), td);
  const xb = await p.textContent('.kg-toast .kg-x'); ok(`${fam}: close button has ${b} + Esc badge`, xb.includes(b) && xb.includes('Esc'), xb);
  const box = await p.evaluate(() => { const r = document.querySelector('.kg-toast').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
  ok(`${fam}: toast compact in a corner`, box[0] < 40 && box[2] < 360, JSON.stringify(box));
  await p.waitForTimeout(6500); ok(`${fam}: toast still up after 7 s`, !!(await p.$('.kg-toast:not(.out)')));
  await p.screenshot({ path: `/workspace/gp-toast-stays-${fam}.png` });
  await press(p, 1); await p.waitForTimeout(400); ok(`${fam}: ${b} closes toast`, !(await p.$('.kg-toast')));
  const hint = await p.evaluate(() => [...document.querySelectorAll('.kc-b small')].map((s) => s.textContent).join(' '));
  ok(`${fam}: on-screen button badges`, hint.includes(a), hint);
  // Guide overlay + tabs + B closes, focus nav
  await p.evaluate(() => { playing = false; import('/js/input/gamepad-ui.js').then((m) => m.openGuide()); }); await p.waitForSelector('.kg-ov');
  const sel = await p.getAttribute('.kg-tabs [aria-selected=true]', 'data-tab'); ok(`${fam}: guide opens on detected tab`, sel === fam, sel);
  await press(p, 15); const foc = await p.evaluate(() => document.activeElement && document.activeElement.dataset.tab); ok(`${fam}: d-pad moves focus`, !!foc && foc !== fam, foc);
  await press(p, 0); ok(`${fam}: A selects tab`, (await p.getAttribute('.kg-tabs [aria-selected=true]', 'data-tab')) === foc);
  await p.screenshot({ path: `/workspace/gp-guide-${fam}.png` });
  await press(p, 1); ok(`${fam}: B closes guide`, !(await p.$('.kg-ov')));
  // unplug -> loop stops
  await p.evaluate(() => { __on = false; }); await p.waitForTimeout(200);
  const after = await p.evaluate(() => new Promise((r) => { let n = 0; const g = navigator.getGamepads; navigator.getGamepads = () => { n++; return g(); }; setTimeout(() => { navigator.getGamepads = g; r(n); }, 400); }));
  ok(`${fam}: polling stops after unplug`, after === 0, `calls=${after}`);
  await p.context().close();

  // Kemy Quest with pad
  const q = await mk(id, 'kemy-quest.html');
  await q.waitForFunction(() => window.__kq && window.__kq.screen === 'title');
  await q.evaluate(() => __connect());
  await q.waitForSelector('.kg-toast', { timeout: 4000 });
  ok(`${fam}: Kemy Quest toast`, (await q.textContent('.kg-toast')).includes(a));
  await press(q, 0); await q.waitForTimeout(6500); ok(`${fam}: KQ toast stays`, !!(await q.$('.kg-toast:not(.out)')));
  await press(q, 1); await q.waitForTimeout(400); ok(`${fam}: KQ ${b} closes toast`, !(await q.$('.kg-toast')));
  await q.evaluate(() => __connect()); await q.waitForSelector('.kg-toast'); await q.keyboard.press('Escape'); await q.waitForTimeout(400);
  ok(`${fam}: KQ Esc closes toast`, !(await q.$('.kg-toast')));
  await q.context().close();
}
// Settings page guide in the real app (signed-out route rendering via module)
{
  const p = await mk('054c', 'tests/ui/gamepad.html');
  await p.waitForFunction(() => window.ready);
  await p.evaluate(() => import('/js/input/gamepad-ui.js').then((m) => m.mountGuide(document.getElementById('guide'), 'kb')));
  const t = await p.textContent('#guide');
  ok('keyboard tab lists real bindings', t.includes('Space') && t.includes('Kemy Rush') && t.includes('Pool') && t.includes('Shift'));
  await p.evaluate(() => import('/js/input/gamepad-ui.js').then((m) => m.mountGuide(document.getElementById('guide'), 'ps')));
  ok('ps tab has PS glyphs and L2/R2', (await p.textContent('#guide')).match(/✕.*○|R2/s) != null);
  await p.context().close();
}
// Desktop first-play keyboard hint and ? key
{
  const p = await mk('none', 'tests/ui/gamepad.html');
  await p.waitForFunction(() => window.ready);
  await p.mouse.click(5, 5);
  await p.waitForSelector('.kg-kbhint', { timeout: 5000 }).catch(() => {});
  ok('desktop first-play hint', !!(await p.$('.kg-kbhint')));
  ok('hint remembered', await p.evaluate(() => localStorage.getItem('kemy-kb-hint-seen') === '1'));
  ok('? button present', !!(await p.$('.kg-help')));
  await p.keyboard.press('w'); await p.waitForTimeout(9500); ok('kb hint stays after keys and 9 s', !!(await p.$('.kg-kbhint:not(.out)')));
  await p.screenshot({ path: '/workspace/gp-kbhint-stays.png' });
  await p.click('.kg-kbhint .kg-x'); await p.waitForTimeout(400); ok('kb hint closes with ×', !(await p.$('.kg-kbhint')));
  await p.keyboard.press('?'); await p.waitForTimeout(300);
  ok('? opens guide on keyboard tab', (await p.getAttribute('.kg-tabs [aria-selected=true]', 'data-tab')) === 'kb');
  await p.screenshot({ path: '/workspace/gp-kb.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok('Esc closes guide', !(await p.$('.kg-ov')));
  await p.reload(); await p.waitForFunction(() => window.ready); await p.waitForTimeout(2500);
  ok('hint not shown again', !(await p.$('.kg-kbhint')));
  await p.context().close();
}
// Phone: no keyboard hint, no badges
{
  const p = await mk('none', 'tests/ui/gamepad.html', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await p.waitForFunction(() => window.ready); await p.waitForTimeout(2500);
  ok('touch: no keyboard hint', !(await p.$('.kg-kbhint')));
  await p.context().close();
}
// Real app shell loads clean with a PS pad
{
  const p = await mk('Wireless Controller (Vendor: 054c)', 'app.html');
  await p.waitForTimeout(3000); await p.evaluate(() => __connect());
  await p.waitForSelector('.kg-toast', { timeout: 5000 }).catch(() => {});
  ok('app.html: PS toast', !!(await p.$('.kg-toast')));
  await p.screenshot({ path: '/workspace/gp-app.png' });
  await p.context().close();
}
ok('no console errors', errs.length === 0, errs.slice(0, 5).join(' | '));
await browser.close(); console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
