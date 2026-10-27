// Theater movie e2e on the Firebase EMULATORS only (never the live DB): showtime countdown on the big screen, movie playing
// with dimmed lights + late-join seek, lobby poster + Now Showing stand, console errors at iPhone 13 portrait + landscape.
// Needs: emulators (auth+firestore on 9199/8199, project lone-keem-studios) and a RANGE-capable static server of the repo root.
// usage: node tests/world/theater-movie-e2e.mjs [base] [shotPrefix]   (uses system Chrome for H.264)
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/theater/';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const W = (p, ms) => p.waitForTimeout(ms); const out = {};
const FS = process.env.FS_PORT || '8199', AU = process.env.AUTH_PORT || '9199';
const EMU = `http://127.0.0.1:${FS}/v1/projects/lone-keem-studios/databases/(default)/documents/`;
const H = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const seed = (path, fields) => fetch(EMU + path, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) }).then((r) => r.ok || r.text().then((t) => { throw new Error(t); }));
const tag = Date.now().toString(36).slice(-5);
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'medium'); } catch { /* */ } });
if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (route) => { const r = await route.fetch(); const b = (await r.text()).replace(/8199/g, FS).replace(/9199/g, AU); await route.fulfill({ response: r, body: b }); });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|cloudinary|youtube|spotify/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 300)); });
const step = async (n, f) => { try { out[n] = await f(); } catch (e) { out[n] = 'ERR ' + e.message.slice(0, 300); await p.screenshot({ path: shot + 'dbg-' + n + '.png' }).catch(() => {}); } console.log(n, JSON.stringify(out[n])); };
const TDOC = 'theater/lone-keem-studio'; const prev = await fetch(EMU + TDOC, { headers: H }).then((r) => r.json());
const setAnchor = (ma) => seed(TDOC, { pl: { mapValue: { fields: { i: { integerValue: '0' }, s: { integerValue: '0' }, p: { integerValue: '0' }, on: { booleanValue: false }, at: { integerValue: '0' }, ma: { integerValue: String(ma) } } } } });
await seed('users/studio', { displayName: { stringValue: 'Lone Keem Studios' }, username: { stringValue: 'studio' } });
await step('signup', async () => { await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-user', 'th' + tag); await p.fill('#p-email', `th${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await W(p, 300); await p.fill('#p-name', 'Theater Tester'); await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  const honest = () => p.evaluate(() => document.getElementById('age-honest-ok')?.click()); await W(p, 400); await honest(); await W(p, 400);
  await p.click('#p-btn'); for (let i = 0; i < 60 && !(await p.$('#welcome-title')); i++) { await honest(); await W(p, 500); } await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) { await p.getByText('Hatch your Kemy Pal').first().click(); } await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800); await p.evaluate(() => document.querySelector('[data-species="tiger"]')?.click()); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  return await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser.uid); });
const uid = out.signup;

await setAnchor(Date.now() + 1500); // countdown starts now (5:00)
await step('world', async () => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 90000 }); await W(p, 3000);
  await p.evaluate(() => window.__p3.teleport(63, 207)); await p.waitForFunction(() => window.__theater && window.__theater.M && window.__theaterDbg, null, { timeout: 60000 }); await W(p, 1500);
  const v0 = await p.evaluate(() => document.querySelectorAll('video').length); return { videosOutside: v0 }; });
await step('outside', async () => { await p.evaluate(() => { window.__p3.teleport(75, 207); window.__p3.setYaw(-Math.PI / 2); }); await W(p, 3000); await p.screenshot({ path: shot + 'dbg-outside.png' }); return 'ok'; });
await step('lobby', async () => { await p.evaluate(() => window.__theaterDbg.enter()); await W(p, 2500);
  await p.setViewportSize({ width: 844, height: 390 }); // landscape keeps the HUD off the art
  for (const [n, q] of [['lobby-poster', [9.5, 15.8, Math.atan2(-6.5, 2.3)]], ['lobby-stand', [2.4, 18.6, Math.atan2(-2.8, 5.4)]]]) { await p.evaluate((q) => window.__theaterDbg.tp(...q), q); await W(p, 2500); await p.screenshot({ path: shot + n + '.png' }); }
  await p.setViewportSize({ width: 390, height: 844 }); await W(p, 1000);
  return await p.evaluate(() => ({ inside: window.__theaterDbg.inside, show: window.__theaterDbg.show(), vids: document.querySelectorAll('video').length })); });
await step('countdown', async () => { const s = await p.evaluate(() => window.__theaterDbg.seats()); const m = s[Math.floor(s.length * 0.55)];
  const sat = await p.evaluate((m) => { const D = window.__theaterDbg; D.tp(m.x, m.z); const q = D.findSeat(); if (q) D.sitAt(q); return { m, q: !!q, sit: !!window.__p3.P?.sit }; }, m); console.log('sat', JSON.stringify(sat)); await W(p, 2500);
  await p.screenshot({ path: shot + 'countdown-screen.png' }); return await p.evaluate(() => ({ show: window.__theaterDbg.show(), lvl: window.__theaterDbg.lvl, hud: document.body.innerText.includes('Tap for sound'), vid: !!window.__theaterDbg.movie })); });
await step('movie', async () => { await setAnchor(Date.now() - 300000 - 95000); await W(p, 9000); // late join: 95 s into episode 1
  const r = await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { show: window.__theaterDbg.show(), lvl: window.__theaterDbg.lvl, t: v && v.currentTime, paused: v && v.paused, muted: v && v.muted, rs: v && v.readyState, src: v && v.currentSrc.split('/').slice(-2).join('/'), tap: [...document.querySelectorAll('button')].some((b) => /Tap for sound/.test(b.textContent) && b.offsetParent) }; });
  await p.screenshot({ path: shot + 'movie-playing-dimmed.png' }); return r; });
await step('tap', async () => { const b = p.getByText('Tap for sound').first(); if (await b.count()) { await b.click({ force: true }); await W(p, 1500); } return await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { muted: v && v.muted, paused: v && v.paused, t: v && v.currentTime }; }); });
await step('ep3', async () => { await setAnchor(Date.now() - 300000 - (205.5 + 256 + 30) * 1000); await W(p, 8000); return await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { show: window.__theaterDbg.show().ep, t: v && v.currentTime, src: v && v.currentSrc.split('/').pop(), paused: v && v.paused }; }); });
await step('landscape', async () => { await p.setViewportSize({ width: 844, height: 390 }); await W(p, 3000); await p.screenshot({ path: shot + 'dbg-movie-landscape.png' }); await p.screenshot({ path: shot + 'movie-fullscreen.png' }); await setAnchor(Date.now() - 20000); await W(p, 3000); await p.screenshot({ path: shot + 'dbg-countdown-landscape.png' }); await p.screenshot({ path: shot + 'countdown-fullscreen.png' }); return 'ok'; });
await step('lobbypos', async () => { await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { const D = window.__theaterDbg; D.standUp(); }); await W(p, 800); await setAnchor(Date.now() - 300000 - 60000); await p.evaluate(() => window.__theaterDbg.tp(4, 8, Math.PI)); await W(p, 3500);
  const r = await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { muted: v && v.muted, paused: v && v.paused, show: window.__theaterDbg.show().phase }; }); await p.screenshot({ path: shot + 'dbg-lobbypos.png' }); return r; });
await step('leave', async () => { await p.evaluate(() => window.__theaterDbg.leave()); await W(p, 2000); return await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { vid: !!v, src: v ? v.getAttribute('src') : null, paused: v ? v.paused : null, lvl: window.__theaterDbg.lvl }; }); });
// restore the emulator's theater doc
if (prev && prev.fields) await seed(TDOC, prev.fields); else await fetch(EMU + TDOC, { method: 'DELETE', headers: H });
console.log(JSON.stringify({ out, errors }, null, 1)); await browser.close();
