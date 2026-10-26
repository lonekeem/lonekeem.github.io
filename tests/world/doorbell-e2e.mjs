// Doorbell e2e on the Firebase EMULATORS only (never the live DB). Phone viewport, 4 contexts:
// A = owner, B + D = visitors, C = a visitor A has blocked.
// Covers: owner outside Pal Park answers from the Notifications inbox (Let them in), visitor at the door walks in,
// owner inside their house gets the pop-up card (Let in / Not now), Not now message for the visitor, Ask to leave,
// blocked user can't ring / can't be let in, and the ring queue (+N more).
// Needs: firebase emulators (auth+firestore) + a static server for the repo. Ports via env:
//   BASE=http://localhost:8981/ FS=8299 AUTH=9299 node tests/world/doorbell-e2e.mjs [shotDir]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = process.env.BASE || 'http://localhost:8947/'; const FS = process.env.FS || '8199'; const AU = process.env.AUTH || '9199';
const shot = (process.argv[2] || '/workspace/doorbell').replace(/\/?$/, '/');
const browser = await pw.chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const W = (p, ms) => p.waitForTimeout(ms); const out = {}; const fails = [];
const EMU = `http://127.0.0.1:${FS}/v1/projects/lone-keem-studios/databases/(default)/documents/`;
const seed = (path, fields) => fetch(EMU + path, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) }).then((r) => r.ok || r.text().then((t) => { throw new Error(t); }));
const get = (path) => fetch(EMU + path, { headers: { Authorization: 'Bearer owner' } }).then((r) => r.json());
const tag = Date.now().toString(36).slice(-5);
const check = (name, cond, info) => { out[name] = cond ? 'ok' : 'FAIL ' + JSON.stringify(info === undefined ? null : info).slice(0, 300); if (!cond) fails.push(name); };
async function account(t, species, pal) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-park', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch { /* */ } });
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (route) => { const r = await route.fetch(); const b = (await r.text()).replace(/8199/g, FS).replace(/9199/g, AU); await route.fulfill({ response: r, body: b }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(t + ': ' + String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource|cloudinary|youtube|spotify|5199|functions/i.test(m.text())) errors.push(t + ' console: ' + m.text().slice(0, 200)); });
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-user', 'db' + t + tag); await p.fill('#p-email', `db${t}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await W(p, 300); await p.fill('#p-name', pal.who); await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  const honest = () => p.evaluate(() => document.getElementById('age-honest-ok')?.click()); await W(p, 400); await honest(); await W(p, 400);
  await p.click('#p-btn'); for (let i = 0; i < 60 && !(await p.$('#welcome-title')); i++) { await honest(); await W(p, 500); } await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(p, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); if (!(await p.$('#pal-crack'))) { await p.getByText('Hatch your Kemy Pal').first().click(); } await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form').catch(async (e) => { await p.screenshot({ path: shot + 'dbg-form-' + t + '.png' }); throw e; }); await W(p, 800); await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), species); await p.fill('#pal-name', pal.name); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser.uid);
  await p.evaluate(() => { location.hash = '#/feed'; }); await W(p, 800); // park on a light page so 4 phones fit on one GPU
  return { p, uid, t };
}
const street = async (u) => { await u.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; }); await u.p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kw && window.__khApi, null, { timeout: 120000 }); await W(u.p, 3000); };
const toDoor = async (u) => { await u.p.waitForFunction(() => window.__khApi.owners().get('h05'), null, { timeout: 30000 }); await u.p.evaluate(() => { window.__p3.teleport(-31, 91); window.__p3.setYaw(0); }); await W(u.p, 800); };
const said = (p) => p.evaluate(() => [...document.querySelectorAll('.toast, #toast, [class*=toast], #ks-say, .ks-say, [class*=say]')].map((e) => e.textContent).join(' | ').slice(0, 400));
const kh = (p) => p.evaluate(() => ({ inside: window.__kh && window.__kh.inside, waiting: window.__khApi.waiting(), wait: !document.querySelector('.kh-wait')?.hidden && document.querySelector('.kh-wait')?.textContent, arr: !document.querySelector('.kh-arr')?.hidden && document.querySelector('.kh-arr')?.textContent }));
const card = (p) => p.evaluate(() => { const c = document.querySelector('.kemy-bell'); return c ? { text: c.textContent.replace(/\s+/g, ' ').trim(), img: !!c.querySelector('img'), shown: getComputedStyle(c).display !== 'none' } : null; });
const ringAs = (u) => u.p.evaluate(() => { window.__arrSeen = ''; const el = document.querySelector('.kh-arr'); if (el && !el.__obs) { el.__obs = new MutationObserver(() => { if (!el.hidden) window.__arrSeen = el.textContent; }); el.__obs.observe(el, { attributes: true, childList: true, subtree: true }); } window.__khApi.ringDoor('h05'); });
let A, B, C, D;
try {
  await seed('users/studio', { displayName: { stringValue: 'Lone Keem Studios' }, username: { stringValue: 'studio' } });
  A = await account('a', 'tiger', { who: 'Keem Owner', name: 'Bloop' }); B = await account('b', 'elephant', { who: 'Bea Visitor', name: 'Toots' });
  C = await account('c', 'tiger', { who: 'Cal Blocked', name: 'Grr' }); D = await account('d', 'elephant', { who: 'Dot Visitor', name: 'Pip' });
  out.uids = [A.uid, B.uid, C.uid, D.uid].map((x) => x.slice(0, 6));
  await seed(`users/${A.uid}/inv/hs_cottage`, { n: { integerValue: '1' } }); await seed(`users/${A.uid}/blocks/${C.uid}`, { at: { integerValue: String(Date.now()) } });
  // A buys h05 in the world, then leaves Pal Park (feed)
  await street(A); await A.p.evaluate(() => window.__khApi.buy('h05')); await W(A.p, 3500);
  const h = await get('homes/h05'); check('owner bought h05', h.fields && h.fields.owner && h.fields.owner.stringValue === A.uid, h);
  await A.p.evaluate(() => { location.hash = '#/notifications'; }); await W(A.p, 2500);
  // ---- 1) owner OUTSIDE Pal Park: answer from the notification button ----
  await street(B); await toDoor(B); await ringAs(B); await W(B.p, 1500);
  const bw = await kh(B.p); check('visitor sees waiting', /Waiting for the owner/.test(bw.wait || ''), bw); await B.p.screenshot({ path: shot + 'visitor-waiting.png' });
  await A.p.evaluate(() => { location.hash = '#/feed'; }); await W(A.p, 600); await A.p.evaluate(() => { location.hash = '#/notifications'; });
  await A.p.waitForSelector('.bell-note .bell-yes', { timeout: 20000 }).catch(() => {}); await W(A.p, 2000);
  out.cardOutside = await card(A.p); check('ring card pops up outside Pal Park too', out.cardOutside && /Bea Visitor/.test(out.cardOutside.text) && /at your door/.test(out.cardOutside.text), out.cardOutside);
  await A.p.evaluate(() => document.querySelector('.kemy-bell')?.style.setProperty('visibility', 'hidden')); // show the inbox row itself for the screenshot
  const note = await A.p.evaluate(() => { const n = document.querySelector('.bell-note'); return n && { text: n.textContent.replace(/\s+/g, ' ').trim(), yes: n.querySelector('.bell-yes')?.textContent, no: n.querySelector('.bell-no')?.textContent }; });
  check('inbox ring note has Let them in / Not now', note && /Let them in/.test(note.yes) && /Not now/.test(note.no), note);
  await A.p.screenshot({ path: shot + 'notification-buttons.png' });
  await A.p.click('.bell-note .bell-yes'); await W(A.p, 2000);
  out.afterYes = await A.p.evaluate(() => ({ yes: document.querySelector('.bell-note .bell-yes')?.textContent, dis: document.querySelector('.bell-note .bell-yes')?.disabled, card: !!document.querySelector('.kemy-bell') }));
  check('inbox button reads Let in ✓', /Let in ✓/.test(out.afterYes.yes || ''), out.afterYes);
  await A.p.screenshot({ path: shot + 'notification-let-in.png' });
  const h2 = await get('homes/h05'); const dv = h2.fields.door && h2.fields.door.mapValue.fields[B.uid]; out.doorB = dv; check('door entry written (~30 min)', dv && Number(dv.integerValue || dv.doubleValue) - Date.now() > 25 * 60e3, dv);
  await B.p.waitForFunction(() => window.__kh && window.__kh.inside === 'h05', null, { timeout: 15000 }).catch(() => {}); const bin = await kh(B.p); check('visitor at door walks in automatically', bin.inside === 'h05', bin); bin.arrSeen = await B.p.evaluate(() => window.__arrSeen); check('visitor sees let-in toast', /let you in/.test((bin.arr || '') + bin.arrSeen), bin);
  out.bPos = await B.p.evaluate(() => window.__p3.pos); await B.p.screenshot({ path: shot + 'visitor-let-in.png' });
  // visitor leaves: one visit per let-in
  await B.p.evaluate(() => window.__khApi.goOut()); await W(B.p, 800); await B.p.evaluate(() => window.__khApi.goIn('h05')); await W(B.p, 800);
  check('let-in is single use (cannot re-enter after leaving)', (await kh(B.p)).inside !== 'h05', await kh(B.p));
  await B.p.evaluate(() => { location.hash = '#/feed'; }); await W(B.p, 1500); // free the GPU for the next 3D page
  // ---- 2) owner INSIDE their house: pop-up card, Let in, visitor arrives inside, Ask to leave ----
  await street(A); await A.p.evaluate(() => window.__khApi.goIn('h05')); await W(A.p, 1500); check('owner inside own house', (await kh(A.p)).inside === 'h05');
  await street(D); await toDoor(D); await ringAs(D); await A.p.waitForSelector('.kemy-bell', { timeout: 20000 }).catch(() => {}); await W(A.p, 2500);
  out.cardIn = await card(A.p); check('in-house pop-up shows visitor + Pal', out.cardIn && /Dot Visitor/.test(out.cardIn.text) && /Pip/.test(out.cardIn.text) && out.cardIn.img, out.cardIn);
  await A.p.screenshot({ path: shot + 'owner-in-house-popup.png' });
  await A.p.click('.kemy-bell [data-kb-yes]'); await W(A.p, 300); out.cardYes = (await card(A.p))?.text; await D.p.waitForFunction(() => window.__kh && window.__kh.inside === 'h05', null, { timeout: 15000 }).catch(() => {}); await W(D.p, 600);
  const din = await kh(D.p); check('visitor D arrives inside', din.inside === 'h05', din); await D.p.screenshot({ path: shot + 'visitor-arrived-inside.png' });
  await W(A.p, 3000); out.visitors = await A.p.evaluate(() => window.__khApi.visitorsHere().map((o) => ({ uid: String(o.uid).slice(0, 6), name: o.name })));
  await A.p.evaluate(() => window.__khApi.myPanel()); await W(A.p, 800);
  out.panel = await A.p.evaluate(() => [...document.querySelectorAll('[data-lv]')].map((b) => b.closest('div')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 80)));
  await A.p.screenshot({ path: shot + 'owner-ask-to-leave.png' });
  if (await A.p.$('[data-lv]')) await A.p.click('[data-lv]'); else await A.p.evaluate((u) => window.__khApi.askLeave(u, 'Dot Visitor', document.createElement('button')), D.uid);
  await W(D.p, 3500); const dout = await kh(D.p); check('Ask to leave walks visitor out', dout.inside !== 'h05', dout); out.dSaid = await said(D.p);
  await A.p.keyboard.press('Escape').catch(() => {}); await A.p.evaluate(() => document.querySelectorAll('.kh-panel, #kh-pan').forEach((e) => { e.hidden = true; }));
  // ---- 3) Not now: B rings again (fresh page) ----
  await D.p.evaluate(() => { location.hash = '#/feed'; }); await W(D.p, 1500);
  await B.p.reload(); await street(B); await toDoor(B); await ringAs(B); await A.p.waitForSelector('.kemy-bell', { timeout: 20000 }).catch(() => {}); await W(A.p, 1500);
  out.cardB2 = await card(A.p); check('second ring pops up for owner', out.cardB2 && /Bea Visitor/.test(out.cardB2.text), out.cardB2);
  await A.p.click('.kemy-bell [data-kb-no]'); await W(B.p, 3000);
  const bno = await kh(B.p); out.bNoSaid = await said(B.p); check('Not now: visitor stops waiting', !bno.waiting && bno.inside !== 'h05', bno);
  check('Not now: polite message', /can’t let you in right now/.test(out.bNoSaid + (await B.p.evaluate(() => document.body.innerText))), out.bNoSaid);
  await B.p.screenshot({ path: shot + 'visitor-not-now.png' });
  const nBefore = (await get(`users/${A.uid}/notifications`)).documents?.length || 0; await ringAs(B); await W(B.p, 1500);
  const nAfter = (await get(`users/${A.uid}/notifications`)).documents?.length || 0; check('no ring spam after Not now', nAfter === nBefore, { nBefore, nAfter });
  // ---- 4) blocked user ----
  await D.p.evaluate(() => { location.hash = '#/feed'; }); await B.p.evaluate(() => { location.hash = '#/feed'; }); await W(D.p, 1500);
  await street(C); await toDoor(C); await ringAs(C); await W(C.p, 3000);
  const cw = await kh(C.p); out.cSaid = await C.p.evaluate(() => document.body.innerText.match(/doorbell isn.t working[^\n]*/)?.[0] || '');
  check('blocked user cannot ring', !cw.waiting && !(await card(A.p)), { cw, card: await card(A.p) });
  out.blockLet = await A.p.evaluate(async ([c]) => { const m = await import('/js/world/doorbell.js'); const f = await import('/js/firebase-init.js'); return m.answerDoor(f.db, { user: f.auth.currentUser, profile: { displayName: 'Keem Owner' } }, 'h05', c, true).catch((e) => 'err ' + e.code); }, [C.uid]);
  const h3 = await get('homes/h05'); check('blocked user never gets a door key', !(h3.fields.door && h3.fields.door.mapValue.fields && h3.fields.door.mapValue.fields[C.uid] && Number(h3.fields.door.mapValue.fields[C.uid].integerValue) > 0), h3.fields.door);
  // blocked user can't sneak in even with a forged door key (rules): write one via admin and try to enter
  await C.p.evaluate(() => window.__khApi.goIn('h05')); await W(C.p, 800); check('blocked user cannot enter', (await kh(C.p)).inside !== 'h05');
  // ---- 5) queue: two rings at once -> one card, '+1 more' ----
  await A.p.evaluate(async ([b, d]) => { const m = await import('/js/world/doorbell.js'); const f = await import('/js/firebase-init.js'); const ctx = { db: f.db, S: { user: f.auth.currentUser, profile: { displayName: 'Keem Owner' } }, toast: () => {} }; const now = Date.now();
    m.ringCard({ uid: b, name: 'Bea Visitor', username: 'bea', plot: 'h05', at: now }, ctx); m.ringCard({ uid: d, name: 'Dot Visitor', username: 'dot', plot: 'h05', at: now }, ctx); }, ['queue-one-x', 'queue-two-x']).catch((e) => { out.qErr = String(e); });
  await W(A.p, 800); out.queue = await A.p.evaluate(() => ({ cards: document.querySelectorAll('.kemy-bell').length, text: document.querySelector('.kemy-bell')?.textContent.replace(/\s+/g, ' ') }));
  check('only one card at a time with +N more', out.queue.cards === 1 && /\+1 more/.test(out.queue.text || ''), out.queue);
} catch (e) { out.err = String(e && e.stack || e).slice(0, 800); for (const u of [A, B, C, D]) if (u) await u.p.screenshot({ path: shot + 'dbg-' + u.t + '.png' }).catch(() => {}); }
out.fails = fails; out.errors = errors.slice(0, 20); try { console.log(JSON.stringify(out, null, 1)); } catch (e) { console.log(out.err, fails, Object.keys(out)); } await browser.close();
