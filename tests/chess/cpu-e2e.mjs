// Capy Chess UI smoke on localhost (no sign-in): lobby, vs CPU to checkmate by tapping squares, piece-set toggle.
// usage: python3 -m http.server 8961 ; node tests/chess/cpu-e2e.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright'); const { devices } = pw;
const base = process.argv[2] || 'http://localhost:8961/'; const shot = process.argv[3] || '/workspace/chess-remodel/shot-';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined }); const errors = []; const out = {};
const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } });
const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
const W = (ms) => p.waitForTimeout(ms);
await p.goto(base + 'app.html#/games/chess'); await p.waitForSelector('#cxl [data-go=cpu]', { timeout: 30000 }); await W(1500);
await p.screenshot({ path: shot + 'lobby.png' }); await p.screenshot({ path: shot + 'lobby-full.png', fullPage: true });
out.lobbyOverflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await p.click('[data-lvl=easy]').catch(() => {}); await p.click('[data-side=w]');
await p.click('[data-go=cpu]'); await p.waitForSelector('.cx-vs', { timeout: 8000 }).then(() => W(500)).then(() => p.screenshot({ path: shot + 'vs-cpu.png' })).catch((e) => { out.vs = 'no vs ' + e.message.slice(0, 80); });
await p.waitForFunction(() => window.__cx && document.querySelector('.cx-pill.mine'), null, { timeout: 15000 }); await W(400);
await p.screenshot({ path: shot + 'board-start.png' });
// my move: mate-in-1 > check > biggest capture > random; tap from-square then to-square like a phone user
const pick = () => p.evaluate(async () => { const C = await import('/js/games/chess-engine.js'); const pos = window.__cx.pos(); const seen = (window.__seen ||= {});
  const V = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 0 }; const me = pos.w;
  const mat = (q) => { let s = 0; q.b.forEach((c, i) => { const v = V[c.toLowerCase()]; if (!v) return; const w = c === c.toUpperCase(); const adv = c.toLowerCase() === 'p' ? (w ? 7 - (i >> 3) : (i >> 3)) * 8 : 0; s += (w === me ? 1 : -1) * (v + adv); }); return s; };
  const ev = (q, keys) => { const o = C.outcome(q, keys); if (o.over) return o.winner === 'draw' ? -300 : ((o.winner === 'w') === me ? 1e6 : -1e6); return mat(q) + (o.check && q.w !== me ? 15 : 0); };
  let best = null, bs = -1e9;
  for (const m of C.legal(pos)) { const np = C.play(pos, m); let sc = ev(np, []); if (sc < 1e5) { let worst = 1e9; for (const r of C.legal(np)) { const rp = C.play(np, r); let v = ev(rp, []);
        if (v > -1e5) { let bestMine = -1e9; for (const m2 of C.legal(rp)) { const q2 = C.play(rp, m2); const o2 = C.outcome(q2, []); const v2 = o2.over && o2.winner !== 'draw' ? 5e5 : mat(q2); if (v2 > bestMine) bestMine = v2; if (bestMine >= 5e5) break; } if (bestMine > -1e9) v = Math.max(v, bestMine - 1); }
        if (v < worst) worst = v; } sc = worst === 1e9 ? sc : worst; }
    sc += Math.random() * 3 - 40 * (seen[C.key(np)] || 0); if (sc > bs) { bs = sc; best = m; } }
  { const k = C.key(C.play(pos, best)); seen[k] = (seen[k] || 0) + 1; } return best; });
let moves = 0, promos = 0;
for (; moves < 160; moves++) {
  const st = await p.evaluate(() => document.querySelector('.cx-pill')?.className + '|' + document.querySelector('.cx-pill')?.textContent);
  if (/done/.test(st) || await p.$('.cx-result')) break;
  if (!/mine/.test(st)) { await W(250); moves--; continue; }
  const m = await pick(); if (!m) break;
  await p.click(`.cx-sq[data-s="${m.f}"]`); await W(60); await p.click(`.cx-sq[data-s="${m.t}"]`);
  if (m.p) { const d = await p.waitForSelector('.cx-promo [data-p=q]', { timeout: 2000 }).catch(() => null); if (d) { await d.click(); promos++; } }
  if (moves === 6) { await W(450); await p.screenshot({ path: shot + 'board-mid.png' }); }
  await p.waitForFunction(() => !document.querySelector('.cx-pill.mine') || document.querySelector('.cx-result'), null, { timeout: 5000 }).catch(() => { out.stuck = (out.stuck || 0) + 1; });
}
out.moves = moves; out.promos = promos;
await p.waitForSelector('.cx-result', { timeout: 8000 }).catch(() => {}); await W(900);
out.result = await p.evaluate(() => document.querySelector('.cx-result')?.innerText.replace(/\s+/g, ' ').slice(0, 200));
await p.screenshot({ path: shot + 'win.png' });
// piece toggle via 🎨 in game
await p.evaluate(() => document.querySelector('#modal-root [data-close], .cx-result a[href="#/games/chess"]')); 
await p.evaluate(() => { const b = [...document.querySelectorAll('.cx-result button, .cx-result a')].find((x) => /Rematch/.test(x.textContent)); b && b.click(); });
await p.waitForFunction(() => window.__cx && document.querySelector('.cx-pill.mine'), null, { timeout: 15000 }).catch(() => {}); await W(400);
for (const set of ['kitty', 'jungle', 'classic', 'capy']) {
  await p.click('#cx-style'); await p.waitForSelector('.cx-style [data-set]'); await p.click(`.cx-style [data-set=${set}]`); await W(200);
  if (set === 'jungle') await p.click('.cx-style [data-back=spring]').catch(() => {});
  await p.click('.cx-style [data-close]'); await W(700);
  out['set_' + set] = await p.evaluate(() => { const i = document.querySelector('.cx-pcs img'); return i ? i.getAttribute('src') : document.querySelector('.cx-pcs svg') ? 'svg' : 'none'; });
  await p.screenshot({ path: shot + 'set-' + set + '.png' });
}
out.stored = await p.evaluate(() => localStorage.getItem('kemy-chess-set'));
// black side: board flipped
await p.evaluate(() => { location.hash = '#/games/chess/cpu?side=b&fast=1&lvl=medium'; }); await W(2600);
out.blackBottom = await p.evaluate(() => { const sq = document.querySelector('.cx-sq[data-s="0"]').getBoundingClientRect(); const sq2 = document.querySelector('.cx-sq[data-s="63"]').getBoundingClientRect(); return sq.top > sq2.top; });
await p.screenshot({ path: shot + 'board-black.png' });
console.log(JSON.stringify({ out, errors }, null, 1)); await browser.close();
