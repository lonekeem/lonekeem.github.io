// Badge-edition cars (shared models, own emblem): shop listing, drive + Kustoms + plate, presence code, sell (local emulators only).
import { playwright, exe, GL, emuContext, signup, assertLocal } from '../helpers/emu.mjs';
const base = (process.argv[2] || 'http://localhost:8947/').replace(/\/?$/, '/'); assertLocal(base); const shot = process.argv[3] || '/workspace/reg-pov-';
const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199', P = 'lone-keem-studios';
const FSB = `http://127.0.0.1:${FS}/v1/projects/${P}/databases/(default)/documents`, OWN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const fsGet = async (x) => (await fetch(`${FSB}/${x}`, { headers: OWN })).json();
const fsSet = (x, fields, mask) => fetch(`${FSB}/${x}${mask ? '?' + mask.map((m) => 'updateMask.fieldPaths=' + encodeURIComponent(m)).join('&') : ''}`, { method: 'PATCH', headers: OWN, body: JSON.stringify({ fields }) }).then((r) => r.json());
const { chromium } = await playwright(); const browser = await chromium.launch({ executablePath: exe(), args: GL }); const errors = []; let fails = 0;
const ok = (c, m, x = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m, x); };
const ctx = await emuContext(browser, { viewport: { width: 900, height: 600 } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(String(e)));
// Decorated-room screenshots (flush fit check): goes into demo house h01, lays out a wall TV, posters, art, lamp + plant, shoots 4 yaws.
const W = (ms) => p.waitForTimeout(ms); const tag = Date.now().toString(36).slice(-6);
try {
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await signup(p, { name: 'Room Tester', user: 'rm' + tag, email: `kemy.rm.test+${tag}@example.com`, pass: 'Rm-' + Math.random().toString(36).slice(2, 12) + '!9' });
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(300);
  await p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); location.hash = '#/me'; });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(250); }
  await p.waitForSelector('#pal-form'); await W(800); await p.fill('#pal-name', 'Bloop'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/street'; });
  await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__khApi, null, { timeout: 240000 }); await W(3000); await p.keyboard.press('Escape');
  await p.evaluate(() => window.__khApi.goIn('h01')); await p.waitForFunction(() => window.__kh && window.__kh.inside === 'h01', null, { timeout: 120000 }); await W(2000);
  const info = await p.evaluate(async () => { const r = window.__khApi.rooms().get('h01'); const RE = await import('./js/world/roomedit.js');
    const L = [RE.snapWall({ c: 'tw', x: -5, z: 2.5, r: 1 }, 'L'), RE.snapWall({ c: 'po', x: -3.5, z: 5.5, r: 2 }, 'L'), RE.snapWall({ c: 'am', x: -1.2, z: 3, r: 3 }, 'L'),
      { c: 'lp', x: -5.5, z: 5.5, r: 0 }, { c: 'pl', x: -5.5, z: 1, r: 0 }, { c: 'cs', x: -2.5, z: 1, r: 0 }, { c: 'rg', x: -3, z: 3, r: 0 }];
    r.I.setItems(L); const sc = r.I.g.userData.sc || 1.4; window.__p3.teleport(r.cx - 2.4 * sc, r.cz + 2.6 * sc); return { cx: r.cx, cz: r.cz, L }; });
  console.log('layout', JSON.stringify(info));
  for (const [n, yaw] of [['w', Math.PI / 2], ['s', 0], ['e', -Math.PI / 2], ['n', Math.PI]]) { await p.evaluate((y) => window.__p3.setYaw(y), yaw); await W(2500); await p.screenshot({ path: shot + n + '.png', timeout: 180000 }); console.log('shot', n); }
} catch (e) { fails++; console.log('ERR', e.message); await p.screenshot({ path: shot + 'error.png', timeout: 180000 }).catch(() => {}); }
console.log('errors', errors.slice(0, 3)); await browser.close(); process.exit(fails ? 1 : 0);
