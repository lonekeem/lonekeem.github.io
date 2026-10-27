// Theater hush e2e (EMULATORS only): radio/music playing outside pauses on entering the theater, stays paused inside, resumes on exit, again on re-enter.
// Theater movie e2e helpers copied from theater-movie-e2e.mjs. On the Firebase EMULATORS only (never the live DB): showtime countdown on the big screen, movie playing
// with dimmed lights + late-join seek, lobby poster + Now Showing stand, console errors at iPhone 13 portrait + landscape.
// Needs: emulators (auth+firestore on 9199/8199, project lone-keem-studios) and a RANGE-capable static server of the repo root.
// usage: node tests/world/theater-movie-e2e.mjs [base] [shotPrefix]   (uses system Chrome for H.264)
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/theater/';
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
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

// the 🎵 Kemy Radio (also the car radio) + a loose page <audio> standing in for a house radio track (registered like homes.js does)
const media = () => p.evaluate(() => { const D = window.__theaterDbg, gm = [...(window.__kemyAud || [])].find((m) => m.dataset && m.dataset.kemyGameMusic), x = window.__hx, v = D.movie && D.movie.video;
  return { inside: D.inside, hush: D.hush.on, radio: gm ? { paused: gm.paused, t: +gm.currentTime.toFixed(1), src: (gm.currentSrc || '').split('/').pop() } : null, house: x ? { paused: x.paused, t: +x.currentTime.toFixed(1) } : null, movie: v ? { paused: v.paused, muted: v.muted } : null, phase: D.show().phase, ma: D.st.pl.ma }; });
await setAnchor(Date.now() - 300000 - 40000); // movie running, 40 s into episode 1
await step('world', async () => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 90000 }); await W(p, 3000);
  await p.evaluate(() => window.__p3.teleport(63, 207)); await p.waitForFunction(() => window.__theater && window.__theater.M && window.__theaterDbg, null, { timeout: 60000 }); await W(p, 1500); return 'ok'; });
await step('radio-on', async () => { await p.evaluate(async () => { const g = await import('/js/gamemusic.js'); await g.radioPlay();
  const x = new Audio('/assets/series/sheriff/ep3.mp4'); x.loop = true; x.volume = 0.2; window.__hx = x; let n = 0; x.__resync = () => { n++; window.__hxResync = n; }; (window.__kemyAud || (window.__kemyAud = new Set())).add(x); await x.play(); });
  await W(p, 4000); return await media(); });
const ok = { };
for (const round of [1, 2]) {
  await step('enter' + round, async () => { await p.evaluate(() => window.__theaterDbg.enter()); await W(p, 2000); const r = await media(); ok['enter' + round] = r.hush && r.radio.paused && r.house.paused; return r; });
  await step('sit' + round, async () => { const s = await p.evaluate(() => window.__theaterDbg.seats()); const m = s[Math.floor(s.length * 0.55)];
    await p.evaluate((m) => { const D = window.__theaterDbg; D.tp(m.x, m.z); const q = D.findSeat(); if (q) D.sitAt(q); }, m); await W(p, 6000); const r = await media(); ok['movie' + round] = r.movie && !r.movie.paused && !r.movie.muted && r.radio.paused; return r; });
  await step('try-radio' + round, async () => { await p.evaluate(async () => { const g = await import('/js/gamemusic.js'); g.play(); }); await W(p, 1500); const r = await media(); ok['stays' + round] = r.radio.paused && r.house.paused; return r; });
  await step('leave' + round, async () => { const before = await media(); await p.evaluate(() => { window.__theaterDbg.standUp(); window.__theaterDbg.leave(); }); await W(p, 3000); const r = await media();
    const g = await p.evaluate(async () => (await import('/js/gamemusic.js')).isPlaying()); ok['back' + round] = !r.hush && !r.radio.paused && !r.house.paused && g; return { before, after: r, gmPlaying: g, resync: await p.evaluate(() => window.__hxResync) }; });
}
// try-radio started the 🎵 player inside; it was paused again, so only what played before you walked in comes back
console.log(JSON.stringify({ ok, pass: Object.values(ok).every(Boolean), errors }, null, 1));
await p.evaluate(async () => { (await import('/js/gamemusic.js')).pause(); window.__hx && window.__hx.pause(); });
if (prev && prev.fields) await seed(TDOC, prev.fields); else await fetch(EMU + TDOC, { method: 'DELETE', headers: H });
await browser.close();
