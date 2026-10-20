// Kemy Challenge Show multiplayer e2e on the real site: 3 throwaway accounts at phone size (logins saved to
// /workspace/show-logins.json so tests/pals/zombie-coop-cleanup.mjs <file> deletes them through the app), Quick Match + Join
// with code, ready → lobby countdown, bots fill, Freeze Dash played with real keyboard input (one player keeps
// moving on red and is caught → Cheer Zone), round progression, host migration, results + Diamonds.
// Run: node tests/pals/show-e2e.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs';
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/rlgl-';
const LOG = '/workspace/show-logins.json'; // tests/pals/show-cleanup.mjs deletes these accounts
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync(LOG, JSON.stringify({ stamp, pass, tags: ['sa', 'sb', 'sc'], base }), { mode: 0o600 });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const P = {}; const DEV = { sa: 'iPhone 13', sb: 'Pixel 7', sc: 'Pixel 7' }; const SP = { sa: 'tiger', sb: 'bunny', sc: 'panda' };
for (const t of ['sa', 'sb', 'sc']) { const ctx = await browser.newContext({ ...devices[DEV[t]], ...(t === 'sb' ? { recordVideo: { dir: '/tmp/showvid', size: devices[DEV[t]].viewport } } : {}) }); await ctx.addInitScript(() => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('kemy-tut-show', '1'); localStorage.setItem('kemy-gfx', 'low'); } catch {} }); const p = await ctx.newPage(); P[t] = p; p._ctx = ctx;
  p.on('pageerror', (e) => errors.push(t + ': ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|404|403/.test(m.text())) errors.push(t + ' console: ' + m.text().slice(0, 160)); }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function signup(t) { const p = P[t];
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Show ' + t.toUpperCase()); await p.fill('#p-user', `${t}${stamp}`); await p.fill('#p-email', `kemy.pals.test+${t}${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 40000 }); await p.click('#modal-root [data-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await p.waitForTimeout(250); }
  await p.waitForSelector('#pal-form', { state: 'attached', timeout: 40000 }); await p.waitForTimeout(800);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`).click(), SP[t]); await p.fill('#pal-name', 'Pal' + t.toUpperCase()); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await p.waitForTimeout(2500);
  await p.evaluate(() => localStorage.setItem('kemy-tut-show', '1')); }
const go = (t, h) => P[t].evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h);
const click = (t, s) => P[t].evaluate((s) => document.querySelector(s).click(), s);
const st = (t) => P[t].evaluate(() => window.__show && window.__show.state).catch(() => null);
const out = {};
// drive Freeze Dash with real keys: hold W on green; `cheat` keeps running through red
function driver(t, cheat) { let on = true, down = false; (async () => { while (on) { const s = await st(t); if (s && s.ph === 'play' && s.round === 'rlgl' && s.me.st === 0 && !s.me.out) { const want = cheat || s.light === 'g'; if (want && !down) { await P[t].keyboard.down('w').catch(() => {}); down = true; } if (!want && down) { await P[t].keyboard.up('w').catch(() => {}); down = false; } } else if (down) { await P[t].keyboard.up('w').catch(() => {}); down = false; } await sleep(120); } })(); return () => { on = false; }; }
try {
  await Promise.all(['sa', 'sb', 'sc'].map(signup)); console.log('signed up 3');
  for (const t of ['sa', 'sb', 'sc']) { await go(t, '#/arcade/show'); await P[t].waitForSelector('[data-a=quick]', { timeout: 25000 }); }
  await P.sa.screenshot({ path: shot + '01-lobby-menu-iphone13.png' });
  await click('sa', '[data-a=quick]'); await P.sa.waitForSelector('[data-code]', { timeout: 20000 }); const code = (await P.sa.textContent('[data-code]')).trim();
  await click('sb', '[data-a=quick]'); await P.sb.waitForSelector('[data-code]', { timeout: 20000 }); const codeB = (await P.sb.textContent('[data-code]')).trim(); out.quickMatched = codeB === code;
  await P.sc.fill('#sl-code', code); await click('sc', '[data-a=join]'); await P.sc.waitForSelector('[data-code]', { timeout: 20000 });
  await P.sa.waitForFunction(() => document.querySelectorAll('.sl-p[data-u]').length === 3, null, { timeout: 20000 });
  await click('sb', '[data-x=qc]'); await P.sb.waitForSelector('.sl-qc button'); await P.sb.evaluate(() => document.querySelector('.sl-qc .qc-list button, .sl-qc button[data-say], .sl-qc button')?.click()); await sleep(1500);
  for (const t of ['sa', 'sb', 'sc']) await click(t, '[data-x=ready]');
  await P.sa.waitForFunction(() => /starts in/.test(document.querySelector('.sl-cd')?.textContent || ''), null, { timeout: 20000 });
  await P.sc.waitForFunction(() => /starts in/.test(document.querySelector('.sl-cd')?.textContent || ''), null, { timeout: 20000 }).catch(() => {});
  await P.sa.screenshot({ path: shot + '02-room-countdown-iphone13.png' }); await P.sc.screenshot({ path: shot + '03-room-countdown-pixel7.png' }); out.countdownSeenByGuest = /starts in/.test(await P.sc.textContent('.sl-cd'));
  for (const t of ['sa', 'sb', 'sc']) await P[t].waitForFunction(() => window.__show && window.__show.state && window.__show.state.ph, null, { timeout: 40000 });
  const s0 = await st('sa'); out.start = s0; out.players = s0.players; console.log('started', JSON.stringify(s0));
  const stops = [driver('sa'), driver('sb'), driver('sc', true)];
  await P.sb.waitForFunction(() => window.__show && window.__show.state && window.__show.state.ph === 'play', null, { timeout: 30000 }); await sleep(4000); await P.sb.screenshot({ path: shot + '04-freeze-dash-green-pixel7.png' });
  for (const t of ['sa', 'sb']) await P[t].evaluate(() => window.__show.game._debug.tp(-4, -60)).catch(() => {});

  await P.sb.waitForFunction(() => window.__show && window.__show.state && window.__show.state.light === 'r', null, { timeout: 30000 }); await sleep(600); await P.sb.screenshot({ path: shot + '05-freeze-red-pixel7.png' });
  await P.sc.waitForFunction(() => window.__show && window.__show.state && window.__show.state.me.out, null, { timeout: 30000 }); out.cheaterCaught = true; await sleep(800); await P.sc.screenshot({ path: shot + '06-caught-bubble-pixel7.png' });
  await sleep(2500); await P.sc.screenshot({ path: shot + '07-cheer-zone-pixel7.png' }); out.cheerZone = await st('sc');
  await P.sc.evaluate(() => document.querySelector('[data-t="wheel"]').click()); await sleep(800); await P.sc.screenshot({ path: shot + '08-emote-wheel-pixel7.png' }); await P.sc.evaluate(() => document.querySelector('.ew-wheel button, .ew button[data-id], [data-emote]')?.click()); await P.sc.keyboard.press('Escape');
  // the honest racers: headless software GL runs ~2-5 fps, so hop them near the line, then they walk over it with real input on green
  await P.sa.waitForFunction(() => { const s = window.__show && window.__show.state; if (!s) return false; return s.ph !== 'play' || s.me.st !== 0; }, null, { timeout: 120000 }).catch(() => {});
  out.afterR1 = { sa: await st('sa'), sb: await st('sb') }; console.log('r1', JSON.stringify(out.afterR1));
  await P.sa.waitForFunction(() => window.__show && window.__show.state && window.__show.state.ph === 'inter' || window.__show.state.ph === 'end', null, { timeout: 90000 }); await sleep(800); await P.sb.screenshot({ path: shot + '09-standings-pixel7.png' }); stops.forEach((f) => f());
  // round 2 (cookie on 6 contestants): pass both, then host migration — host (sa) closes the app
  await P.sb.waitForFunction(() => window.__show && window.__show.state && window.__show.state.ph === 'play', null, { timeout: 40000 }); await sleep(2500); await P.sb.screenshot({ path: shot + '10-round2-pixel7.png' }); out.round2 = (await st('sb')).round;
  await P.sb.evaluate(() => window.__show.game._debug.done(true)); await P.sa.evaluate(() => window.__show.game._debug.done(true)); await sleep(1500);
  await P.sa._ctx.close(); out.hostClosed = true; const t0 = Date.now();
  await P.sb.waitForFunction(() => window.__show && window.__show.state && window.__show.state.host, null, { timeout: 40000 }); out.migrationSec = Math.round((Date.now() - t0) / 1000); console.log('migrated in', out.migrationSec);
  await P.sb.screenshot({ path: shot + '11-new-host-pixel7.png' });
  // fast-forward remaining rounds on the new host (bots + sb play; sb passes each round when possible)
  for (let i = 0; i < 60; i++) { const s = await st('sb'); if (!s || s.ph === 'end') break; if (s.ph === 'play' && s.round !== 'duel' && s.round !== 'tug' && s.me.st === 0 && !s.me.out) await P.sb.evaluate(() => window.__show.game._debug.done(true));
    if (s.ph === 'play' && s.round !== 'duel') { await P.sb.evaluate(() => window.__show.game._debug.passBots(0.6)); await sleep(1500); await P.sb.screenshot({ path: shot + `12-${s.round}-pixel7.png` }); }
    await P.sb.evaluate(() => window.__show.game._debug.skip()); await sleep(2500); }
  await P.sb.waitForFunction(() => window.__show && window.__show.state && window.__show.state.ph === 'end', null, { timeout: 60000 }); await sleep(2000);
  await P.sb.screenshot({ path: shot + '13-results-pixel7.png' }); await P.sc.screenshot({ path: shot + '14-results-spectator-pixel7.png' });
  out.endB = await st('sb'); out.endC = await st('sc');
  await P.sb.waitForFunction(() => /saved|limit|Could not/.test(document.querySelector('[data-dia]')?.textContent || ''), null, { timeout: 70000 }).catch(() => {}); out.diaText = await P.sb.textContent('[data-dia]').catch(() => '');
  out.result = await P.sb.evaluate(() => window.__show && window.__show.result);
} catch (e) { console.log('ERROR', e.message); for (const t of ['sb', 'sc']) await P[t].screenshot({ path: `/tmp/show-err-${t}.png` }).catch(() => {}); }
out.errors = errors; console.log(JSON.stringify(out, null, 1));
for (const t of ['sb', 'sc']) await P[t]._ctx.close().catch(() => {}); await browser.close();
