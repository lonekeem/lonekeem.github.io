// Kemy Hill Rush e2e on the Firebase EMULATORS only (never the live DB).
// Needs: firebase emulators (auth 9199, firestore 8199) + python3 -m http.server 8961 in the repo.
// usage: node tests/rush/e2e.mjs [solo|mp2|mp4|all] [base] [shotDir]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright');
const part = process.argv[2] || 'all'; const base = process.argv[3] || 'http://localhost:8961/'; const dir = (process.argv[4] || '/workspace/hill-game') + '/';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined });
const errors = []; const out = {}; const P = {}; const tag = Date.now().toString(36).slice(-5);
const SP = { a: 'tiger', b: 'bunny', c: 'fox', d: 'panda' }; const NM = { a: 'Ava Capy', b: 'Ben Otter', c: 'Cleo Fox', d: 'Dev Panda' };
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' };
async function mk(t, opts = PHONE) { const ctx = await browser.newContext({ ...opts, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } });
  const p = await ctx.newPage(); P[t] = p; p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => errors.push(t + ': ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/i.test(m.text())) errors.push(t + ' console: ' + m.text().slice(0, 200)); });
  return p; }
const W = (t, ms) => P[t].waitForTimeout(ms); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (p) => p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /I understand/i.test(x.textContent) && x.offsetParent)?.click());
async function signup(t) { const p = P[t];
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await W(t, 500); await ack(p); await W(t, 300);
  if (await p.isVisible('#p-name')) await p.fill('#p-name', NM[t]);
  await p.fill('#p-user', `rh${t}${tag}`); await p.fill('#p-email', `rh${t}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!'); await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await ack(p); await p.click('#p-btn'); await W(t, 700); await ack(p); await p.waitForSelector('#welcome-title', { timeout: 30000 }).catch(async (e) => { console.log(t, await p.evaluate(() => document.getElementById('p-err')?.textContent)); throw e; }); await p.click('#modal-root [data-close]'); await W(t, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(t, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click());
  if (!(await p.$('#pal-crack'))) await p.getByText('Hatch your Kemy Pal').first().click(); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(t, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(t, 250); }
  await p.waitForSelector('#pal-form'); await W(t, 800); await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), SP[t]); await p.fill('#pal-name', { a: 'Mango', b: 'Pebble', c: 'Ziggy', d: 'Bao' }[t]); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(t, 3000); }

const go = (t, h) => P[t].evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h);
const modal = (t) => P[t].evaluate(() => document.getElementById('modal-root')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 300));
const gas = async (t, on) => { if (on) await P[t].keyboard.down('ArrowRight'); else await P[t].keyboard.up('ArrowRight'); };
const hud = (t) => P[t].evaluate(() => ({ d: document.querySelector('.rush-dist')?.textContent, pos: document.querySelector('.rush-chip.pos')?.textContent, cnt: document.querySelector('.rush-count')?.textContent }));
// drive: hold gas, tap brake when nose climbs; wait for result modal
async function drive(t, maxMs, shotAt) { const t0 = Date.now(); let shot = false;
  await gas(t, true);
  while (Date.now() - t0 < maxMs) { await W(t, 400);
    if (shotAt && !shot && Date.now() - t0 > shotAt.ms) { shot = true; await P[t].screenshot({ path: dir + shotAt.f }); }
    if (await P[t].evaluate(() => !!document.querySelector('#modal-root .rush-res'))) break; }
  await gas(t, false); return Date.now() - t0; }
try {
if (part === 'solo' || part === 'all') {
  await mk('a'); await signup('a');
  await go('a', '#/games'); await P.a.waitForSelector('.rsh-hero'); await W('a', 600);
  await P.a.evaluate(() => document.querySelector('.cxh-hero').scrollIntoView({ block: 'start' })); await P.a.evaluate(() => scrollBy(0, -60)); await W('a', 900);
  out.heroOrder = await P.a.evaluate(() => { const h = document.querySelector('.rsh-hero'); return h.previousElementSibling?.className + ' -> rush -> ' + h.nextElementSibling?.className; });
  out.heroImg = await P.a.evaluate(() => { const i = document.querySelector('.rsh-art'); return i.complete + ' ' + i.naturalWidth + 'x' + i.naturalHeight + ' ' + i.loading; });
  await P.a.screenshot({ path: dir + 'hero-card-phone.png' }); await (await P.a.$('.rsh-hero')).screenshot({ path: dir + 'hero-card.png' });
  await P.a.click('.rsh-hero'); await P.a.waitForSelector('#rush-go', { timeout: 15000 }); await W('a', 900); await P.a.screenshot({ path: dir + 'menu-portrait.png' });
  await go('a', '#/games/rush/stages'); await P.a.waitForSelector('#rush-sg'); await W('a', 900); await P.a.screenshot({ path: dir + 'stages.png' });
  await go('a', '#/games/rush/garage'); await P.a.waitForSelector('#rush-gc'); await W('a', 900); await P.a.screenshot({ path: dir + 'garage.png' }); await P.a.screenshot({ path: dir + 'garage-full.png', fullPage: true });
  await go('a', '#/games/rush'); await P.a.waitForSelector('#rush-go'); await P.a.click('#rush-go'); await P.a.waitForSelector('.rush-run canvas'); await W('a', 1500);
  out.soloMs = await drive('a', 90000, { ms: 5000, f: 'gameplay-portrait.png' }); await W('a', 900);
  if (!(await P.a.$('#modal-root .rush-res'))) { out.soloStillDriving = (await hud('a')).d; await P.a.click('.rush-pause'); await W('a', 400); await P.a.click('[data-a=quit]'); await W('a', 1500); } // still going (fuel cans kept it alive): quit for the card
  out.soloResult = await modal('a'); await P.a.screenshot({ path: dir + 'results.png' });
  // landscape
  await go('a', '#/games/rush'); await P.a.setViewportSize({ width: 844, height: 390 }); await P.a.waitForSelector('#rush-go'); await W('a', 500); await P.a.screenshot({ path: dir + 'menu-landscape.png' });
  await P.a.click('#rush-go'); await P.a.waitForSelector('.rush-run canvas'); await W('a', 1500); await gas('a', true); await W('a', 6000); await P.a.screenshot({ path: dir + 'gameplay-landscape.png' }); await gas('a', false);
  out.landHud = await hud('a');
  await P.a.click('.rush-pause'); await W('a', 400); await P.a.screenshot({ path: dir + 'paused.png' }); await P.a.click('[data-a=quit]'); await W('a', 1200); out.afterQuit = await modal('a');
  // cpu race (landscape)
  await go('a', '#/games/rush'); await P.a.waitForSelector('[data-m=cpu]'); await P.a.click('[data-m=cpu]'); await P.a.waitForSelector('.rush-run canvas'); await W('a', 1200);
  await P.a.screenshot({ path: dir + 'cpu-countdown.png' });
  out.cpuMs = await drive('a', 170000, { ms: 9000, f: 'cpu-race.png' }); await W('a', 900); out.cpuResult = await modal('a'); await P.a.screenshot({ path: dir + 'cpu-results.png' });
  // desktop guest
  await mk('dk', { viewport: { width: 1366, height: 800 } }); await P.dk.goto(base + 'app.html#/games/rush'); await P.dk.waitForSelector('#rush-go', { timeout: 20000 }); await W('dk', 900); await P.dk.screenshot({ path: dir + 'menu-desktop.png' });
  await P.dk.click('#rush-go'); await P.dk.waitForSelector('.rush-run canvas'); await W('dk', 1500); await gas('dk', true); await W('dk', 7000); await P.dk.screenshot({ path: dir + 'gameplay-desktop.png' }); await gas('dk', false); out.deskHud = await hud('dk');
  await P.dk.click('.rush-pause'); await P.dk.click('[data-a=quit]'); await W('dk', 1000); out.deskQuit = await modal('dk');
}
async function race(ts, label) {
  await Promise.all(ts.map(async (t) => { await P[t].waitForSelector('.rush-run canvas', { timeout: 60000 }); }));
  await W(ts[0], 2500); await P[ts[0]].screenshot({ path: dir + label + '-countdown.png' });
  // first player full gas, others with small brake taps so places differ
  const res = await Promise.all(ts.map(async (t, i) => { await sleep(2500 + i * 900); return drive(t, 200000, i === 0 ? { ms: 7000, f: label + '-race.png' } : i === 1 ? { ms: 7000, f: label + '-race-b.png' } : null); }));
  out[label + 'Ms'] = res; await sleep(4000);
  for (const t of ts) { out[label + '-' + t] = await modal(t); const dbg = await P[t].evaluate(() => window.__rushDbg || null); if (dbg) out[label + '-dbg-' + t] = dbg; await P[t].screenshot({ path: dir + label + '-results-' + t + '.png' }); }
}
if (part === 'mp2' || part === 'all') {
  for (const t of ['a', 'b']) { if (!P[t]) { await mk(t); await signup(t); } else await P[t].setViewportSize({ width: 390, height: 844 }); }
  for (const t of ['a', 'b']) { await go(t, '#/games/rush'); await P[t].waitForSelector('[data-m=online]'); }
  await P.a.click('[data-m=online]'); await P.a.click('[data-room=sprint]'); await P.a.waitForSelector('.g-roomcode', { timeout: 20000 }); const code = (await P.a.textContent('.g-roomcode')).trim(); out.code2 = code;
  await W('a', 1200); await P.a.screenshot({ path: dir + 'mp2-waiting.png' });
  await P.b.click('[data-m=online]'); await P.b.waitForSelector('#rush-code'); await P.b.fill('#rush-code', code.toLowerCase()); await P.b.press('#rush-code', 'Enter');
  await P.b.waitForSelector('#rw-seats', { timeout: 20000 }); await P.a.waitForFunction(() => document.querySelectorAll('#rw-seats .rush-seat').length >= 2 && !document.getElementById('rw-go')?.disabled, null, { timeout: 20000 });
  await W('a', 800); await P.a.screenshot({ path: dir + 'mp2-waiting-2.png' }); await P.b.screenshot({ path: dir + 'mp2-waiting-b.png' });
  await P.a.click('#rw-go'); await race(['a', 'b'], 'mp2');
}
if (part === 'mp4' || part === 'all') {
  for (const t of ['a', 'b', 'c', 'd']) { if (!P[t]) { await mk(t); await signup(t); } }
  for (const t of ['a', 'b', 'c', 'd']) { await go(t, '#/games/rush'); await P[t].waitForSelector('[data-m=online]'); await P[t].click('[data-m=online]'); }
  for (const t of ['a', 'b', 'c', 'd']) { await P[t].click('[data-q]'); await W(t, 2500); }
  await P.a.waitForSelector('#rw-seats', { timeout: 30000 }).catch(() => {}); await W('a', 600); await P.a.screenshot({ path: dir + 'mp4-waiting.png' });
  out.mp4hashes = await Promise.all(['a', 'b', 'c', 'd'].map((t) => P[t].evaluate(() => location.hash)));
  await race(['a', 'b', 'c', 'd'], 'mp4');
}
} catch (e) { out.err = e.message.slice(0, 500); for (const t of Object.keys(P)) await P[t].screenshot({ path: dir + 'dbg-' + t + '.png' }).catch(() => {}); }
console.log(JSON.stringify({ out, errors }, null, 1)); await browser.close();
