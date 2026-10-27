// Theater films + showtimes e2e on the Firebase EMULATORS only (never the live DB). Every film in the program loads, fills the
// screen (cover-fit) and plays (SHERIFF_IN_THEATER is off: the :00 slot is the cartoon triple feature for everyone,
// and no Sheriff poster / plate / board row / marquee / video anywhere in the theater); the lobby board, 7 framed
// posters, 2D showtimes list (board tap + button), title card with credit, portrait + landscape iPhone 13 with no console
// errors, and the Sheriff 13+ gate for a 13+ account and an under-13 account (family film swapped in locally, same clock).
// Needs: emulators (auth+firestore; FS_PORT / AUTH_PORT, default 8199/9199, project lone-keem-studios) and a RANGE-capable
// static server of the repo root. usage: node tests/world/theater-films-e2e.mjs [base] [shotDir]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/theater/films/';
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
// ---- helpers
const setFilm = (id, into, kidProg = false) => p.evaluate(async ([id, into, kp]) => { const M = await import('/js/world/theater-movie.js'); for (const s of M.program(kp)) { const j = s.ids.indexOf(id); if (j >= 0) return Date.now() - (s.o + s.starts[j] + into) * 1000; } return null; }, [id, into, kidProg]);
const anchorTo = async (id, into, kp) => { const a = await setFilm(id, into, kp); await setAnchor(a); return a; };
const view = (x, z, tx, tz) => p.evaluate(([x, z, y]) => window.__theaterDbg.tp(x, z, y), [x, z, Math.atan2(-(tx - x), -(tz - z))]);
const vstate = () => p.evaluate(() => { const D = window.__theaterDbg, m = D.movie, v = m && m.video, s = D.show(); return { phase: s.phase, id: s.id, mode: m && m.mode, src: v && (v.currentSrc || '').split('/').pop(), rs: v && v.readyState, t: v && +v.currentTime.toFixed(2), paused: v && v.paused, vw: v && v.videoWidth, vh: v && v.videoHeight, vids: document.querySelectorAll('video').length, one: !v || (window.__v0 ? window.__v0 === v : !!(window.__v0 = v)) }; });
const plates = () => p.evaluate(() => window.__theaterDbg.ib.lobbyPosters.map((q) => q.id + ' => ' + q.key));
const posterShots = async (pre) => { await p.setViewportSize({ width: 844, height: 390 }); await W(p, 800);
  for (const [n, q] of [['east-sheriff-wing', [3, 16, 16, 16]], ['west-bbb-spring', [-3, 16, -16, 16]], ['back-caminandes-singularity', [-4, 9.5, -8, 22]], ['board', [1.5, 8, 16, 8]]]) { await view(...q); await W(p, 2500); await p.screenshot({ path: shot + pre + n + '.png' }); } };
const EXT = process.env.EXT_PRE || 'exterior-after-'; // facade poster cases ('exterior-before-' when shooting the old build)
const extInfo = () => p.evaluate(() => { const ex = window.__theaterDbg && window.__theaterDbg.ex; return ex && ex.extPosters ? ex.extPosters.map((q) => ({ id: q.id, src: ((q.mesh.material.map && q.mesh.material.map.userData.src) || '').split('/').pop(), ok: !!(q.mesh.material.map && q.mesh.material.map.image && q.mesh.material.map.image.width), plate: q.key })) : null; });
const extShots = async (who) => { await p.setViewportSize({ width: 844, height: 390 }); await W(p, 800);
  for (const [n, x, z] of [['facade', 90, 207], ['left-cases', 65.5, 216.5], ['right-cases', 65.5, 197.5]]) { await p.evaluate(([x, z]) => { window.__p3.teleport(x, z); window.__p3.setYaw(Math.PI / 2); }, [x, z]); await W(p, 3500); await p.screenshot({ path: shot + EXT + who + '-' + n + '.png' }); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { window.__p3.teleport(80, 207); window.__p3.setYaw(Math.PI / 2); }); await W(p, 3000); await p.screenshot({ path: shot + EXT + who + '-portrait.png' }); return extInfo(); };
const FILE = { sheriff: /ep[123]\.mp4/, bbb: 'big-buck-bunny.mp4', spring: 'spring.mp4', c2: 'caminandes-2.mp4', c3: 'caminandes-3.mp4', wing: 'wing-it.mp4', sing: 'singularity.mp4' };
const result = {};
const check = (n, c, d) => { result[n] = c ? 'PASS' : 'FAIL ' + JSON.stringify(d).slice(0, 300); console.log(result[n].slice(0, 4), n); };

// ---- 13+ account: Sheriff page opens, theater shows the full program
await step('age-adult', async () => { const a = await p.evaluate(async () => (await import('/js/safety.js')).viewerAge()); await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/series/sheriff'; }); await W(p, 3500);
  const g = await p.evaluate(() => ({ card: !!document.querySelector('[data-sheriff-age]'), video: !!document.querySelector('main video, #main video, video') })); await p.screenshot({ path: shot + 'age-13plus-sheriff-page.png' });
  check('13+ account: Sheriff page is not gated', a >= 13 && !g.card, { a, g }); return { a, ...g }; });
await setAnchor(await (async () => 0)()); // regular schedule
// SHERIFF_IN_THEATER is off: from here on (street + theater) no Sheriff video may ever be requested
const sherReq = []; p.on('request', (r) => { if (/assets\/series\/sheriff\/.*\.mp4/.test(r.url())) sherReq.push(r.url().split('/').slice(-2).join('/')); });
const noSheriffTxt = (x) => !/Sheriff/i.test(typeof x === 'string' ? x : JSON.stringify(x));
await step('world', async () => { await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 90000 }); await W(p, 3000);
  for (let i = 0; i < 36 && !(await p.evaluate(() => !!(window.__theater && window.__theater.M && window.__theaterDbg))); i++) { await p.evaluate(() => window.__p3.teleport(63, 207)); await W(p, 5000); } // busy boxes: keep nudging until the theater loads
  await p.waitForFunction(() => window.__theater && window.__theater.M && window.__theaterDbg, null, { timeout: 10000 }); await W(p, 1500);
  const v0 = await p.evaluate(() => document.querySelectorAll('video').length); check('no video element outside the theater', v0 === 0, v0); return v0; });
await step('marquee-outside', async () => { await p.evaluate(() => { window.__p3.teleport(75, 207); window.__p3.setYaw(-Math.PI / 2); }); await W(p, 2500); await p.screenshot({ path: shot + 'marquee-outside.png' }); const m = await p.evaluate(() => window.__theaterDbg.marq()); check('marquee names no Sheriff (13+ account)', noSheriffTxt(m), m); return m; });
await step('exterior-adult', async () => { const e = await extShots('adult'); if (EXT === 'exterior-after-') { const want = { sheriff: 'caminandes-double.webp', bbb: 'big-buck-bunny.webp', spring: 'spring.webp', c2: 'caminandes-2.webp', c3: 'caminandes-3.webp', wing: 'wing-it.webp' }; // (no facade case for Singularity yet)
  check('facade: 6 lit poster cases with the new posters (loaded lazily on approach)', e && e.length === 6 && e.every((q) => q.ok && q.src === want[q.id]), e); check('facade: plates show title + next show', e && e.every((q) => /\|(Next show|▶ Now playing)/.test(q.plate)), e);
  check('facade: no Sheriff poster or plate for a 13+ player (family poster in its case)', e && noSheriffTxt(e.map((q) => q.plate).join(' ')) && e.find((q) => q.id === 'sheriff').plate.startsWith('Cartoon Shorts Triple Feature|'), e);
  await p.setViewportSize({ width: 844, height: 390 }); await p.evaluate(() => { window.__p3.teleport(65.5, 216.5); window.__p3.setYaw(Math.PI / 2); }); await W(p, 2500); await p.screenshot({ path: '/workspace/theater/no-sheriff-exterior-cases.png' });
  await p.evaluate(() => { window.__p3.teleport(90, 207); window.__p3.setYaw(Math.PI / 2); }); await W(p, 2500); await p.screenshot({ path: '/workspace/theater/no-sheriff-exterior-facade.png' }); }
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => window.__p3.teleport(63, 207)); await W(p, 1500); return e; });
await step('lobby', async () => { await p.evaluate(() => window.__theaterDbg.enter()); await W(p, 3000); await p.evaluate(() => window.__theaterDbg.drawPlates(window.__theaterDbg.list()));
  const L = await p.evaluate(() => window.__theaterDbg.list().map((e) => ({ id: e.id, n: e.times.length, now: e.now, next: e.next })));
  check('board lists 6 films with 3 times each, no Sheriff', L.length === 6 && L.every((e) => e.n === 3) && !L.some((e) => e.id === 'sheriff'), L);
  const pl = await plates(); check('7 framed lobby posters with title + next show', pl.length === 7 && pl.every((s) => /\|(Next show \d|▶ Now playing)/.test(s)), pl);
  check('lobby: the east-wall gold frame shows the family poster, no Sheriff on any plate (13+ account)', /^sheriff => Cartoon Shorts Triple Feature\|/.test(pl[0]) && noSheriffTxt(pl.join(' ').replace(/^sheriff => /, '').replace(/ sheriff => /g, ' ')), pl);
  const ns = await p.evaluate(() => ({ title: window.__theaterDbg.show().title, line: window.__theaterDbg.line(), kid: window.__theaterDbg.kid() })); check('Now Showing / show title name no Sheriff (13+ account)', noSheriffTxt(ns.title + ns.line), ns);
  await p.setViewportSize({ width: 844, height: 390 }); await W(p, 600); await view(1.5, 8, 16, 8); await W(p, 2500); await p.screenshot({ path: '/workspace/theater/no-sheriff-lobby-board.png' }); await view(9, 13.5, 16, 13.5); await W(p, 6000); await p.screenshot({ path: '/workspace/theater/no-sheriff-lobby-east-wall.png' });
    await posterShots('lobby-'); return { L, pl }; });
await step('board-tap', async () => { await view(8.5, 8, 16, 8); await W(p, 1500); const xy = await p.evaluate(() => window.__theaterDbg.boardXY());
  await p.touchscreen.tap(xy.x, xy.y); await W(p, 1200); let open = await p.evaluate(() => !!document.querySelector('[data-th-times]'));
  check('tapping the board opens the 2D list', open, xy); await p.screenshot({ path: shot + 'showtimes-2d-list.png' });
  const rows = await p.evaluate(() => [...document.querySelectorAll('[data-th-times] .th-tr')].map((r) => r.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  check('2D list: 6 rows with credits, no Sheriff', rows.length === 6 && rows.filter((r) => /Blender Foundation \| studio\.blender\.org, CC BY/.test(r)).length === 6 && noSheriffTxt(rows.join(' ')), rows);
  await p.evaluate(() => window.__theaterDbg.closePanels()); await W(p, 300);
  const b = p.locator('button[data-h="times"]'); await b.first().click({ force: true }); await W(p, 800); open = await p.evaluate(() => !!document.querySelector('[data-th-times]')); check('Showtimes button opens the 2D list', open, ''); await p.evaluate(() => window.__theaterDbg.closePanels());
  return rows; });
await step('films', async () => { const s = await p.evaluate(() => window.__theaterDbg.seats()); const m = s.filter((q) => Math.abs(q.x) < 2).sort((a, b) => a.z - b.z)[Math.floor(s.filter((q) => Math.abs(q.x) < 2).length * 0.5)] || s[0];
  await p.evaluate((m) => { const D = window.__theaterDbg; D.tp(m.x, m.z); const q = D.findSeat(); if (q) D.sitAt(q); }, m); await W(p, 1500);
  const r = {}; for (const id of ['bbb', 'spring', 'c2', 'c3', 'wing', 'sing']) { await anchorTo(id, 40); await W(p, 8000); const a = await vstate(); await W(p, 2500); const b = await vstate(); r[id] = { a, b };
    const fileOk = FILE[id] instanceof RegExp ? FILE[id].test(a.src || '') : a.src === FILE[id];
    check(`film ${id}: loads + plays + fills (${a.mode})`, a.phase === 'movie' && a.id === id && fileOk && a.rs >= 2 && !b.paused && b.t > a.t + 1 && a.mode === (id === 'sheriff' ? 'portrait' : 'cover') && a.one && b.one, { a, b }); // ONE reused <video> (kept off the DOM)
    if (id === 'bbb') await p.screenshot({ path: shot + 'wide-film-seated.png' }); if (id === 'spring') await p.screenshot({ path: shot + 'wide-film-seated-spring.png' }); if (id === 'sing') await p.screenshot({ path: shot + 'wide-film-seated-singularity.png' }); if (id === 'sheriff') await p.screenshot({ path: shot + 'portrait-sheriff-seated.png' }); }
  return r; });
await step('title-card', async () => { const a = await setFilm('c3', -7); await setAnchor(a); await W(p, 1500); const s = await p.evaluate(() => { const x = window.__theaterDbg.show(); return { phase: x.phase, id: x.id }; }); await p.screenshot({ path: shot + 'title-card-credit.png' });
  check('title card with credit between films', s.phase === 'title' && s.id === 'c3', s); return s; });
// no projector beam / screen-facing light cone in the theater-in group (auditorium + lobby; street car headlights excluded); auto-dim + owner spotlight still work
const beams = () => p.evaluate(() => { const D = window.__theaterDbg, ib = D.ib; let root = ib.screen; while (root.parent && root.name !== 'theater-in') root = root.parent; const out = [];
  root.traverse((o) => { if (!o.isMesh || o === ib.spotCone || o === ib.spotDisc) return; const g = o.geometry && o.geometry.type, m = o.material || {}; if ((g === 'ConeGeometry' || g === 'CylinderGeometry') && m.transparent && (m.blending === 2 || m.opacity < 0.5) && o.visible) out.push(o.name || g); if (o.isSpotLight) out.push('SpotLight'); });
  root.traverse((o) => { if (o.isSpotLight || o.isPointLight) out.push(o.type); }); return { n: out.length, out, lvl: D.lvl, sp: ib.spotCone.visible, beamKey: 'beam' in ib }; });
await step('no-beam', async () => { await anchorTo('bbb', 40); await W(p, 7000); const a = await beams(); const v = await vstate(); await p.screenshot({ path: '/workspace/theater/no-beam-movie.png' });
  check('no projector beam / screen cone while a movie plays (lights auto-dim)', a.n === 0 && !a.beamKey && v.phase === 'movie' && a.lvl < 0.3 && !a.sp, { a, v });
  const cd = await p.evaluate(async () => (await import('/js/world/theater-movie.js')).anchorFor(0, Date.now() - 60000, true)); await setAnchor(cd); await W(p, 4000);
  const b = await beams(); const s = await p.evaluate(() => window.__theaterDbg.show().phase); await p.screenshot({ path: '/workspace/theater/no-beam-countdown.png' });
  check('no beam during the countdown', b.n === 0 && s === 'count', { b, s });
  await seed(`${TDOC}?updateMask.fieldPaths=lt`, { lt: { mapValue: { fields: { h: { doubleValue: 1 }, sp: { integerValue: '1' }, at: { integerValue: String(Date.now()) } } } } }); await W(p, 2500);
  const c = await p.evaluate(() => ({ sp: window.__theaterDbg.ib.spotCone.visible, lvl: window.__theaterDbg.lvl }));
  await seed(`${TDOC}?updateMask.fieldPaths=lt`, { lt: { mapValue: { fields: { h: { doubleValue: 1 }, sp: { integerValue: '0' }, at: { integerValue: '0' } } } } }); await W(p, 2500);
  const d = await p.evaluate(() => ({ sp: window.__theaterDbg.ib.spotCone.visible, lvl: window.__theaterDbg.lvl }));
  check('owner light controls still apply (manual full + stage spotlight on, then auto)', c.sp && c.lvl > 0.8 && !d.sp, { c, d }); return { a, b, c, d }; });
await step('portrait', async () => { await p.setViewportSize({ width: 390, height: 844 }); await anchorTo('wing', 20); await W(p, 6000); const a = await vstate(); await p.screenshot({ path: shot + 'portrait-wing-it-seated.png' }); check('portrait iPhone 13: Wing It! plays', a.id === 'wing' && !a.paused, a);
  await p.evaluate(() => window.__theaterDbg.standUp()); await W(p, 600); await view(8.5, 8, 16, 8); await W(p, 2000); await p.screenshot({ path: shot + 'portrait-board.png' }); return a; });
await step('leave', async () => { await p.evaluate(() => window.__theaterDbg.leave()); await W(p, 1500); const v = await p.evaluate(() => { const v = window.__theaterDbg.movie?.video; return { src: v ? v.getAttribute('src') : null, paused: v ? v.paused : null }; }); check('video unloaded on exit', !v.src, v); return v; });

// ---- under-13 account (trusted birthday set server-side like sign-up does): Sheriff page shows the 13+ card, theater swaps to the family program locally
await seed(`users/${uid}?updateMask.fieldPaths=birthY&updateMask.fieldPaths=birthM`, { birthY: { integerValue: '2016' }, birthM: { integerValue: '1' } });
await step('age-kid', async () => { await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => { location.hash = '#/feed'; }); await p.reload(); await W(p, 6000); await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; });
  const a = await p.evaluate(async () => (await import('/js/safety.js')).viewerAge()); await p.evaluate(() => { location.hash = '#/series/sheriff'; }); await W(p, 3500); await p.evaluate(() => { const m = document.getElementById('modal-root'); if (m) m.innerHTML = ''; });
  const g = await p.evaluate(() => ({ card: !!document.querySelector('[data-sheriff-age]'), txt: (document.querySelector('[data-sheriff-age]') || {}).innerText || '', video: !!document.querySelector('main video') })); await p.screenshot({ path: shot + 'age-under13-sheriff-card.png' });
  check('under-13 account: Sheriff page shows the friendly 13+ card', a < 13 && g.card && !g.video, { a, g }); return { a, ...g }; });
await step('kid-theater', async () => { await anchorTo('c2', 30); await p.evaluate(() => { location.hash = '#/street'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 90000 }); await W(p, 3000);
  await p.evaluate(() => window.__p3.teleport(63, 207)); await p.waitForFunction(() => window.__theaterDbg && window.__theaterDbg.kid, null, { timeout: 60000 }); await W(p, 1500);
  const marq = await p.evaluate(() => window.__theaterDbg.marq()); await p.evaluate(() => { window.__p3.teleport(75, 207); window.__p3.setYaw(-Math.PI / 2); }); await W(p, 2500); await p.screenshot({ path: shot + 'kid-marquee-outside.png' });
  const ext = await extShots('kid'); if (EXT === 'exterior-after-') check('under-13: facade shows the family poster, no Sheriff outside', ext && ext.find((q) => q.id === 'sheriff').src === 'caminandes-double.webp' && ext.every((q) => q.ok) && !/Sheriff/i.test(ext.map((q) => q.plate).join(' ')), ext);
  await p.setViewportSize({ width: 390, height: 844 }); await p.evaluate(() => window.__p3.teleport(63, 207)); await W(p, 1500);
  await p.evaluate(() => window.__theaterDbg.enter()); await W(p, 3000); await p.evaluate(() => window.__theaterDbg.drawPlates(window.__theaterDbg.list()));
  const k = await p.evaluate(() => ({ kid: window.__theaterDbg.kid(), show: window.__theaterDbg.show().id, title: window.__theaterDbg.show().title, list: window.__theaterDbg.list().map((e) => e.id), line: window.__theaterDbg.line() }));
  const pl = await plates(); await posterShots('kid-lobby-');
  await p.evaluate(() => window.__theaterDbg.timesPanel()); await W(p, 800); const rows = await p.evaluate(() => [...document.querySelectorAll('[data-th-times] .th-tr')].map((r) => r.dataset.film)); await p.screenshot({ path: shot + 'kid-showtimes-2d-list.png' }); await p.evaluate(() => window.__theaterDbg.closePanels());
  const s = await p.evaluate(() => window.__theaterDbg.seats()); await p.evaluate((m) => { const D = window.__theaterDbg; D.tp(m.x, m.z); const q = D.findSeat(); if (q) D.sitAt(q); }, s[Math.floor(s.length * 0.5)]); await W(p, 7000); const v = await vstate(); await p.screenshot({ path: shot + 'kid-family-film-in-sheriff-slot.png' });
  check('under-13: same clock, family film in the Sheriff slot', k.kid && k.show === 'c2' && v.src === 'caminandes-2.mp4' && !v.paused, { k, v });
  check('under-13: board + 2D list have no Sheriff', !k.list.includes('sheriff') && rows.length && !rows.includes('sheriff'), { list: k.list, rows });
  check('under-13: Sheriff frame shows the family poster/title', /^sheriff => Cartoon Shorts Triple Feature\|/.test(pl[0]), pl);
  check('under-13: marquee + Now Showing name no Sheriff', !/Sheriff/i.test(JSON.stringify(marq) + k.title + k.line), { marq, title: k.title, line: k.line });
  await p.evaluate(() => window.__theaterDbg.leave()); return { k, pl, rows, v, marq }; });
check('no Sheriff video requested anywhere in the theater/street', sherReq.length === 0, sherReq);
if (prev && prev.fields) await seed(TDOC, prev.fields); else await fetch(EMU + TDOC, { method: 'DELETE', headers: H });
const fails = Object.entries(result).filter(([, v]) => v !== 'PASS');
console.log(JSON.stringify({ result, errors }, null, 1)); console.log(`${Object.keys(result).length - fails.length}/${Object.keys(result).length} checks passed, ${errors.length} console errors`);
await browser.close(); process.exit(fails.length || errors.length ? 1 : 0);
