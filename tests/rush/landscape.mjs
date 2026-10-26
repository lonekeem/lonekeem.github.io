// Kemy Hill Rush: landscape-first checks (guest, no sign-in, local server only).
// usage: node tests/rush/landscape.mjs [base] [shotDir]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright');
const base = process.argv[2] || 'http://localhost:8961/'; const dir = (process.argv[3] || '/workspace/hill-game') + '/';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined });
const errors = [], out = {};
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
async function phone(w, h, insets) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch {}
    window.__locks = []; try { const o = screen.orientation; if (o) { o.lock = (m) => { window.__locks.push(m); return Promise.resolve(); }; o.unlock = () => { window.__locks.push('unlock'); }; } } catch {} });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  let cdpInsets = false;
  if (insets) { try { const s = await ctx.newCDPSession(p); await s.send('Emulation.setSafeAreaInsetsOverride', { insets }); cdpInsets = true; } catch (e) { cdpInsets = 'n/a: ' + e.message.slice(0, 80); } }
  return { p, ctx, cdpInsets };
}
const box = (p, s) => p.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) } : null; }, s);
const dist = (p) => p.evaluate(() => parseInt(document.querySelector('.rush-dist')?.textContent || '0', 10));
async function startSolo(p) { await p.goto(base + 'app.html#/games/rush'); await p.waitForSelector('#rush-go', { timeout: 20000 }); await p.waitForTimeout(700); await p.tap('#rush-go'); await p.waitForSelector('.rush-run canvas'); await p.waitForTimeout(1200); }
async function hold(p, ms) { const g = await box(p, '.rush-pedal.gas'); const x = (g.l + g.r) / 2, y = (g.t + g.b) / 2;
  await p.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); el.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, bubbles: true, pointerType: 'touch' })); }, [x, y]);
  await p.waitForTimeout(ms); await p.evaluate(() => document.querySelector('.rush-pedal.gas').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, bubbles: true }))); }
try {
  // 1) notched landscape 844x390 (iPhone-style insets: notch left, home bar bottom)
  { const { p, ctx, cdpInsets } = await phone(844, 390, { top: 0, left: 47, right: 47, bottom: 21 }); out.notchInsets = cdpInsets;
    await startSolo(p); await hold(p, 5000);
    out.notch = { gas: await box(p, '.rush-pedal.gas'), brake: await box(p, '.rush-pedal.brake'), hud: await box(p, '.rush-hud'), pause: await box(p, '.rush-pause'), hint: await box(p, '.rush-rot'), hintShown: await p.evaluate(() => { const e = document.querySelector('.rush-rot'); return !!e && getComputedStyle(e).display !== 'none'; }), locks: await p.evaluate(() => window.__locks), vp: await p.evaluate(() => document.querySelector('meta[name=viewport]').content) };
    await p.screenshot({ path: dir + 'landscape-notch-844x390.png' }); await ctx.close(); }
  // 2) short landscape 667x375
  { const { p, ctx } = await phone(667, 375, { top: 0, left: 0, right: 0, bottom: 0 });
    await startSolo(p); await hold(p, 5000);
    out.short = { gas: await box(p, '.rush-pedal.gas'), brake: await box(p, '.rush-pedal.brake'), hud: await box(p, '.rush-hud'), chips: await box(p, '.rush-chips') };
    await p.screenshot({ path: dir + 'landscape-667x375.png' }); await ctx.close(); }
  // 3) portrait: hint shows, dismiss sticks; rotate mid-run keeps the same run
  { const { p, ctx } = await phone(390, 844);
    await startSolo(p); out.portraitHint = await box(p, '.rush-rot'); await p.screenshot({ path: dir + 'portrait-rotate-hint.png' });
    await p.evaluate(() => { document.querySelector('.rush-cv').__mark = 42; });
    await hold(p, 3500); const d1 = await dist(p);
    await p.evaluate(() => { const g = document.querySelector('.rush-pedal.gas'); g.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, bubbles: true, pointerType: 'touch' })); });
    await p.setViewportSize({ width: 844, height: 390 }); await p.evaluate(() => dispatchEvent(new Event('orientationchange'))); await p.waitForTimeout(2500);
    const mid = await p.evaluate(() => ({ same: document.querySelector('.rush-cv')?.__mark === 42, runs: document.querySelectorAll('.rush-run').length, cw: document.querySelector('.rush-cv').width, hint: (() => { const e = document.querySelector('.rush-rot'); return !!e && getComputedStyle(e).display !== 'none'; })() }));
    const d2 = await dist(p); await p.screenshot({ path: dir + 'rotate-mid-run-landscape.png' });
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(2000); const d3 = await dist(p);
    await p.evaluate(() => document.querySelector('.rush-pedal.gas').dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true })));
    out.rotate = { d1, d2, d3, ...mid, sameAfter: await p.evaluate(() => document.querySelector('.rush-cv')?.__mark === 42), modal: await p.evaluate(() => !!document.querySelector('#modal-root .rush-res')) };
    const hb = await p.$('.rush-rot button'); if (hb) { await hb.tap(); out.dismissed = await p.evaluate(() => localStorage.getItem('rush-rot-off')); }
    await p.tap('.rush-pause'); await p.tap('[data-a=quit]'); await p.waitForTimeout(800); out.unlock = await p.evaluate(() => window.__locks);
    await p.tap('#modal-root [data-close], #modal-root .btn').catch(() => {}); await p.waitForTimeout(400);
    await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; }); await startSolo(p); out.hintAfterDismiss = await box(p, '.rush-rot'); await ctx.close(); }
} catch (e) { out.err = e.message.slice(0, 400); }
console.log(JSON.stringify({ out, errors }, null, 1)); await browser.close();
