// Kemy Kustoms "call car keeps the look" e2e on the Firebase EMULATORS only (no live sign-in).
// Needs: firebase emulators (firebase.emu.json) + python3 -m http.server 8947. Optional EMU_FS / EMU_AUTH ports when 8199/9199 are busy.
// usage: node tests/world/kustom-call-e2e.mjs [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/workspace/pw/');
const pw = require('playwright'); const { devices } = pw;
const base = 'http://localhost:8947/'; const shot = process.argv[2] || '/workspace/qa-'; const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = (p, ms) => p.waitForTimeout(ms); const out = {}; const errors = []; let fail = 0;
const tag = Date.now().toString(36).slice(-5);
async function client(name) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("'127.0.0.1', 8199", `'127.0.0.1', ${FS}`).replace('127.0.0.1:9199', '127.0.0.1:' + AU) }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(cur + ' PAGEERR ' + String(e).slice(0, 300))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|cloudinary|youtube|spotify|emulator/i.test(m.text())) errors.push(cur + ' CONSOLE ' + m.text().slice(0, 250)); });
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form'); await W(p, 800); await p.getByText('I understand').click({ timeout: 4000 }).catch(() => {}); await W(p, 400);
  await p.selectOption('#sbd-m', '1'); await p.selectOption('#sbd-y', { index: 20 }); await p.dispatchEvent('#sbd-y', 'change'); await W(p, 500); await p.fill('#p-name', 'KK ' + name); await p.fill('#p-user', 'kk' + name + tag); await p.fill('#p-email', `kk${name}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) await p.getByText('Hatch your Kemy Pal').first().click(); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400); for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800); await p.evaluate(() => document.querySelector('[data-species="tiger"]')?.click()); await p.fill('#pal-name', 'Vroom'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  return p; }
const goWorld = async (p) => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kdApi && window.__kdApi.carInfo, null, { timeout: 120000 }); await W(p, 4000); };

let cur = 'signup';
const ROUTES = [['feed', 'app.html#/feed'], ['games', 'app.html#/games'], ['chess', 'app.html#/games/chess'], ['checkers', 'app.html#/games/checkers'], ['ludo', 'app.html#/games/ludo'], ['trivia', 'app.html#/games/trivia'],
  ['pool', 'app.html#/games/pool'], ['starcards', 'app.html#/games/starcards'], ['stardrop', 'app.html#/games/stardrop'], ['klgrid', 'app.html#/games/klgrid'], ['rush', 'app.html#/games/rush'], ['palgames', 'app.html#/games/pals'],
  ['store', 'app.html#/pals/store'], ['shop', 'app.html#/pals/shop'], ['zombie', 'app.html#/arcade/zombie'], ['bingo', 'app.html#/arcade/bingo'], ['show', 'app.html#/arcade/show'], ['pals', 'app.html#/pals'],
  ['settings', 'app.html#/settings'], ['messages', 'app.html#/messages'], ['park', 'app.html#/park'], ['street', 'app.html#/street'], ['quest', 'kemy-quest.html']];
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const SIZES = (process.env.SIZES || 'portrait,landscape,desktop').split(',');
const VP = { portrait: [390, 844], landscape: [844, 390], desktop: [1366, 800] };
const A = await client('q'); const report = {};
const probe = (p) => p.evaluate(async () => { const t0 = performance.now(); let n = 0, worst = 0, last = t0; await new Promise((r) => { const f = () => { const t = performance.now(); worst = Math.max(worst, t - last); last = t; n++; if (t - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const btns = [...document.querySelectorAll('button, a[href], [role=button]')].filter(vis);
  const off = btns.filter((b) => { const r = b.getBoundingClientRect(); const fixed = (() => { for (let e = b; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; })(); return fixed && (r.right > innerWidth + 2 || r.left < -2 || r.bottom > innerHeight + 2 || r.top < -2); }).map((b) => (b.id || b.className || b.textContent).toString().slice(0, 40));
  // overlapping clickable controls (fixed/absolute ones that cover the center of another)
  const ov = []; for (const b of btns.slice(0, 250)) { const r = b.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue; const top = document.elementFromPoint(cx, cy); if (top && !b.contains(top) && !top.contains(b) && top.closest('button, a[href], [role=button]') && top.closest('button, a[href], [role=button]') !== b) ov.push((b.textContent || b.id || b.className).toString().trim().slice(0, 25) + ' ⟂ ' + (top.closest('button, a[href], [role=button]').textContent || top.id).toString().trim().slice(0, 25)); }
  return { fps: Math.round(n / 2), worstMs: Math.round(worst), hscroll: document.documentElement.scrollWidth > innerWidth + 2, offscreenFixed: off.slice(0, 6), overlaps: [...new Set(ov)].slice(0, 6), text: document.body.innerText.slice(0, 80).replace(/\s+/g, ' ') }; });
const playish = /^(▶\s*)?(play|start|play now|vs computer|play vs|practice|solo|new game|quick play|let's go|go!?|begin|play offline|1 player)\b/i;
for (const size of SIZES) { await A.setViewportSize({ width: VP[size][0], height: VP[size][1] });
  for (const [n, url] of ROUTES) { if (ONLY && !ONLY.includes(n)) continue; cur = size + '/' + n; const e0 = errors.length;
    try { if (url.startsWith('kemy-quest')) await A.goto(base + url); else { if (!A.url().includes('app.html')) await A.goto(base + 'app.html#/feed'); await A.evaluate((h) => { document.getElementById('modal-root') && (document.getElementById('modal-root').innerHTML = ''); location.hash = h; }, url.slice(url.indexOf('#'))); }
      await W(A, n === 'street' || n === 'park' ? 12000 : 3500);
      await A.screenshot({ path: `${shot}${size}-${n}.png` }); const pre = await probe(A);
      let clicked = []; for (let k = 0; k < 2; k++) { const b = await A.evaluateHandle((re) => [...document.querySelectorAll('button, [role=button], a.btn')].find((b) => new RegExp(re.s, re.f).test(b.textContent.trim()) && b.offsetParent), { s: playish.source, f: playish.flags }); const el = b.asElement(); if (!el) break; clicked.push((await el.textContent()).trim().slice(0, 30)); await el.click({ timeout: 3000 }).catch((e) => clicked.push('clickfail')); await W(A, 2500); }
      for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'Space', 'Enter', 'Tab', 'Tab', 'Enter']) { await A.keyboard.press(key).catch(() => {}); await W(A, 150); }
      // tap center of screen (touch)
      await A.touchscreen.tap(VP[size][0] / 2, VP[size][1] / 2).catch(() => {}); await W(A, 1500);
      await A.screenshot({ path: `${shot}${size}-${n}-play.png` }); const post = await probe(A);
      report[cur] = { pre, clicked, post, errors: errors.slice(e0) }; console.log(cur, JSON.stringify({ fps: [pre.fps, post.fps], worst: [pre.worstMs, post.worstMs], h: pre.hscroll || post.hscroll, off: post.offscreenFixed, ov: post.overlaps, clicked, err: errors.slice(e0).length }));
      if (url.startsWith('kemy-quest')) await A.goto(base + 'app.html#/feed');
    } catch (e) { report[cur] = { fail: String(e).slice(0, 300) }; console.log(cur, 'FAIL', String(e).slice(0, 200)); await A.goto(base + 'app.html#/feed').catch(() => {}); await W(A, 2000); } } }
(await import('node:fs')).writeFileSync('/workspace/qa-report.json', JSON.stringify({ report, errors }, null, 1)); console.log('ERRORS', errors.length); await browser.close();
