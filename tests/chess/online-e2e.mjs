// Capy Chess online e2e on the Firebase EMULATORS only (never the live DB): two phones, Play a Friend → Join with code,
// VS intro, move sync, clocks, resign (win/lose screens), rematch, 60s-a-move timeout claim.
// Needs: firebase emulators (auth 9199, firestore 8199) + python3 -m http.server 8961 in the repo.
// usage: node tests/chess/online-e2e.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = process.argv[2] || 'http://localhost:8961/'; const shot = process.argv[3] || '/workspace/chess-remodel/online-';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined });
const errors = []; const out = {}; const P = {}; const tag = Date.now().toString(36).slice(-5);
const SP = { a: 'tiger', b: 'bunny' };
for (const t of ['a', 'b']) { const ctx = await browser.newContext({ ...devices[t === 'a' ? 'Pixel 7' : 'iPhone 13'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } });
  const p = await ctx.newPage(); P[t] = p; p.on('dialog', (d) => d.accept());
  p.on('pageerror', (e) => errors.push(t + ': ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/i.test(m.text())) errors.push(t + ' console: ' + m.text().slice(0, 200)); }); }
const W = (t, ms) => P[t].waitForTimeout(ms); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (p) => p.evaluate(() => [...document.querySelectorAll('button')].find((x) => /I understand/i.test(x.textContent) && x.offsetParent)?.click());
async function signup(t) { const p = P[t];
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } } await W(t, 500); await ack(p); await W(t, 300);
  if (await p.isVisible('#p-name')) await p.fill('#p-name', t === 'a' ? 'Ava Capy' : 'Ben Otter');
  await p.fill('#p-user', `cx${t}${tag}`); await p.fill('#p-email', `cx${t}${tag}@example.com`); await p.fill('#p-pass', 'Test-pass-123!'); await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
  await ack(p); await p.click('#p-btn'); await W(t, 700); await ack(p); await p.waitForSelector('#welcome-title', { timeout: 30000 }).catch(async (e) => { console.log(t, await p.evaluate(() => document.getElementById('p-err')?.textContent)); throw e; }); await p.click('#modal-root [data-close]'); await W(t, 300);
  await p.evaluate(() => { location.hash = '#/me'; }); await W(t, 2500); await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click());
  if (!(await p.$('#pal-crack'))) await p.getByText('Hatch your Kemy Pal').first().click(); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(t, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(t, 250); }
  await p.waitForSelector('#pal-form'); await W(t, 800); await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), SP[t]); await p.fill('#pal-name', t === 'a' ? 'Mango' : 'Pebble'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(t, 3000); }
const go = (t, h) => P[t].evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h);
const board = (t) => P[t].evaluate(() => [...document.querySelectorAll('.cx-pcs .cx-pc:not(.gone)')].map((e) => e.dataset.s + (e.dataset.q || '')).sort().join(','));
const tap = async (t, f, to) => { await P[t].click(`.cx-sq[data-s="${f}"]`); await W(t, 80); await P[t].click(`.cx-sq[data-s="${to}"]`); };
const sq = (n) => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
const myTurn = (t) => P[t].waitForSelector('.cx-pill.mine', { timeout: 20000 });
async function pair(mode, label) {
  for (const t of ['a', 'b']) { await go(t, '#/games/chess'); await P[t].waitForSelector('#cxl [data-go=friend]', { timeout: 20000 }); }
  await P.a.click(`[data-mode="${mode}"]`); await P.a.click('[data-go=friend]');
  await P.a.waitForSelector('.g-roomcode', { timeout: 20000 }); const code = (await P.a.textContent('.g-roomcode')).trim(); out[label + 'Code'] = code;
  if (label === 'g1') { await P.a.waitForSelector('#kemy-load', { state: 'detached', timeout: 8000 }).catch(() => {}); await W('a', 400); } if (label === 'g1') await P.a.screenshot({ path: shot + 'waiting-code.png' });
  await P.b.click('[data-go=join]'); await P.b.fill('#cxl-code', code.toLowerCase()); await P.b.press('#cxl-code', 'Enter');
  await P.a.waitForSelector('.cx-vs', { timeout: 20000 }); await W('a', 900); if (label === 'g1') await P.a.screenshot({ path: shot + 'vs.png' });
  await P.b.waitForSelector('.cx-vs', { timeout: 20000 }).then(() => (label === 'g1' ? P.b.screenshot({ path: shot + 'vs-b.png' }) : null)).catch(() => { out[label + 'vsB'] = 'missing'; });
  await Promise.all(['a', 'b'].map((t) => P[t].waitForSelector('.cx-vs', { state: 'detached', timeout: 10000 }).catch(() => {})));
  return code; }
try {
  await signup('a'); await signup('b'); out.signup = 'ok';
  // game 1: 5-minute clocks, sync, resign
  await pair('5', 'g1');
  out.chips = await Promise.all(['a', 'b'].map((t) => P[t].evaluate(() => [...document.querySelectorAll('.cx-card')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()))));
  const flip = await P.b.evaluate(() => document.querySelector('.cx-sq[data-s="0"]').getBoundingClientRect().top > document.querySelector('.cx-sq[data-s="63"]').getBoundingClientRect().top); out.bFlipped = flip;
  const seq = [['a', 'e2', 'e4'], ['b', 'e7', 'e5'], ['a', 'g1', 'f3'], ['b', 'b8', 'c6'], ['a', 'f1', 'c4'], ['b', 'g8', 'f6']];
  for (const [t, f, to] of seq) { await myTurn(t); await tap(t, sq(f), sq(to)); await W(t, 900); }
  await sleep(1500); out.sync1 = (await board('a')) === (await board('b'));
  out.clocks = await Promise.all(['a', 'b'].map((t) => P[t].evaluate(() => [...document.querySelectorAll('.cx-clock')].map((c) => c.textContent))));
  await myTurn('a'); await P.a.click(`.cx-sq[data-s="${sq('f3')}"]`); await W('a', 300); await P.a.screenshot({ path: shot + 'board-a.png' }); await P.b.screenshot({ path: shot + 'board-b.png' });
  await P.a.click(`.cx-sq[data-s="${sq('g5')}"]`); await W('a', 1200);
  await P.b.click('#g-forfeit'); await P.a.waitForSelector('.cx-result', { timeout: 15000 }); await P.b.waitForSelector('.cx-result', { timeout: 15000 }); await W('a', 1400);
  out.resignA = await P.a.evaluate(() => document.querySelector('.cx-result').innerText.replace(/\s+/g, ' ').slice(0, 160));
  out.resignB = await P.b.evaluate(() => document.querySelector('.cx-result').innerText.replace(/\s+/g, ' ').slice(0, 160));
  await P.a.screenshot({ path: shot + 'win.png' }); await P.b.screenshot({ path: shot + 'lose.png' });
  // rematch from the result screen (B taps, A follows)
  await P.b.evaluate(() => [...document.querySelectorAll('.cx-result .btn')].find((x) => /Rematch/.test(x.textContent)).click());
  await P.b.waitForFunction((g) => location.hash.startsWith('#/game/') && !location.hash.includes(g), out.g1Code, { timeout: 20000 });
  await P.a.waitForFunction((g) => location.hash.startsWith('#/game/') && !location.hash.includes(g), out.g1Code, { timeout: 20000 });
  out.rematch = await Promise.all(['a', 'b'].map((t) => P[t].evaluate(() => location.hash)));
  await Promise.all(['a', 'b'].map((t) => P[t].waitForSelector('.cx-pill.mine, .cx-pill.theirs', { timeout: 20000 })));
  out.rematchSides = await Promise.all(['a', 'b'].map((t) => P[t].evaluate(() => document.querySelector('#cx-bot .cx-chip')?.textContent)));
  // game 2: 60 s a move, the player to move goes idle → the other claims a timeout win
  await pair('', 'g2');
  await myTurn('a'); await tap('a', sq('d2'), sq('d4')); await W('a', 2000);
  out.turnPillA = await P.a.evaluate(() => document.querySelector('.cx-pill').textContent);
  await P.b.screenshot({ path: shot + 'turn-b.png' });
  const t0 = Date.now(); await P.a.waitForSelector('.cx-result', { timeout: 110000 }); out.timeoutAfter = Math.round((Date.now() - t0) / 1000) + 's';
  await P.b.waitForSelector('.cx-result', { timeout: 15000 }).catch(() => {}); await W('a', 1200);
  out.timeoutA = await P.a.evaluate(() => document.querySelector('.cx-result').innerText.replace(/\s+/g, ' ').slice(0, 160));
  out.timeoutB = await P.b.evaluate(() => document.querySelector('.cx-result')?.innerText.replace(/\s+/g, ' ').slice(0, 160));
  await P.a.screenshot({ path: shot + 'timeout-win.png' });
} catch (e) { out.err = e.message.slice(0, 400); for (const t of ['a', 'b']) await P[t].screenshot({ path: shot + 'dbg-' + t + '.png' }).catch(() => {}); }
console.log(JSON.stringify({ out, errors }, null, 1)); await browser.close();
