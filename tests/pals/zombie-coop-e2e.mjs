// Pal Zombie Survival co-op e2e on a real site: 3 throwaway accounts (logins saved to /workspace/zombie-coop-logins.json
// so tests/pals/zombie-coop-cleanup.mjs can always delete them through the app), Quick Match, Create Team + Join with Code,
// ready check + host start, play, emote, down + revive, host migration (host closes), team wipe, diamonds + scoreboard.
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/zombie-coop-';
const LOG = '/workspace/zombie-coop-logins.json';
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync(LOG, JSON.stringify({ stamp, pass, tags: ['a', 'b', 'c'], base }), { mode: 0o600 });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = []; const out = {};
const P = {}; const DEV = { a: 'iPhone 13', b: 'Pixel 7', c: 'Pixel 7' }; const SP = { a: 'tiger', b: 'bunny', c: 'panda' };
for (const t of ['a', 'b', 'c']) { const ctx = await browser.newContext({ ...devices[DEV[t]], ...(t === 'b' ? { recordVideo: { dir: '/tmp/zcvid', size: devices[DEV[t]].viewport } } : {}) }); const p = await ctx.newPage(); P[t] = p; p._ctx = ctx;
  p.on('pageerror', (e) => errors.push(t + ': ' + String(e).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|404/.test(m.text())) errors.push(t + ' console: ' + m.text().slice(0, 160)); }); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function signup(t) { const p = P[t];
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Coop ' + t.toUpperCase()); await p.fill('#p-user', `zc${t}${stamp}`); await p.fill('#p-email', `kemy.pals.test+${t}${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 40000 }); await p.click('#modal-root [data-close]'); await p.waitForTimeout(300);
  await p.evaluate(() => { location.hash = '#/me'; }); await p.waitForSelector('#pal-crack', { timeout: 25000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await p.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await p.waitForTimeout(250); }
  await p.waitForSelector('#pal-form'); await p.waitForTimeout(600);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`).click(), SP[t]); await p.fill('#pal-name', 'Pal' + t.toUpperCase()); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await p.waitForTimeout(2500); }
const go = (t, h) => P[t].evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, h);
const click = (t, s) => P[t].evaluate((s) => document.querySelector(s).click(), s);
const st = (t) => P[t].evaluate(() => window.__zombie && window.__zombie.state);
try {
  await Promise.all(['a', 'b', 'c'].map(signup)); console.log('signed up 3');
  for (const t of ['a', 'b', 'c']) { await go(t, '#/arcade/zombie'); await P[t].waitForSelector('[data-a=quick]', { timeout: 25000 }); }
  await P.a.screenshot({ path: shot + 'lobby-menu-iphone13.png' });
  // Quick Match: b opens a public team, c gets matched into it
  await click('b', '[data-a=quick]'); await P.b.waitForSelector('[data-code]', { timeout: 20000 }); const qcode = await P.b.textContent('[data-code]');
  await click('c', '[data-a=quick]'); await P.c.waitForSelector('[data-code]', { timeout: 20000 }); const ccode = await P.c.textContent('[data-code]');
  out.quickMatch = { b: qcode, c: ccode, matched: qcode === ccode }; await P.c.waitForTimeout(2500); await P.c.screenshot({ path: shot + 'quickmatch-pixel7.png' });
  await click('b', '[data-x=leave]'); await click('c', '[data-x=leave]'); await sleep(1500);
  // Create Team (a) + Join with Code (b, c)
  await click('a', '[data-a=create]'); await P.a.waitForSelector('[data-code]', { timeout: 20000 }); const code = (await P.a.textContent('[data-code]')).trim(); out.code = code;
  for (const t of ['b', 'c']) { await P[t].waitForSelector('#zl-code'); await P[t].fill('#zl-code', code.toLowerCase()); await click(t, '[data-a=join]'); await P[t].waitForSelector('[data-code]', { timeout: 20000 }); }
  await P.a.waitForFunction(() => document.querySelectorAll('.zl-p[data-u]').length === 3, null, { timeout: 20000 }); await P.a.waitForTimeout(2500);
  await P.a.screenshot({ path: shot + 'team-room-iphone13.png' });
  for (const t of ['a', 'b', 'c']) { await click(t, '[data-x=ready]'); await sleep(400); }
  await P.a.waitForFunction(() => !document.querySelector('[data-x=start]').disabled, null, { timeout: 20000 }); await P.a.screenshot({ path: shot + 'team-ready-iphone13.png' });
  await click('a', '[data-x=start]');
  for (const t of ['a', 'b', 'c']) { await P[t].waitForSelector('.kc-tut button', { timeout: 30000 }); await click(t, '.kc-tut button'); }
  await sleep(4000); out.start = { a: await st('a'), b: await st('b') };
  // play: everyone holds fire and wanders
  const fps = { a: [], b: [], c: [] };
  for (let k = 0; k < 8; k++) { for (const t of ['a', 'b', 'c']) { await P[t].keyboard.down('f'); await P[t].keyboard.down(k % 2 ? 'a' : 'd'); }
    await sleep(1200); for (const t of ['a', 'b', 'c']) { await P[t].keyboard.up(k % 2 ? 'a' : 'd'); fps[t].push((await st(t)).fps); } }
  out.fps = fps; await P.b.screenshot({ path: shot + 'play-pixel7.png' }); await P.a.screenshot({ path: shot + 'play-iphone13.png' });
  // guest b splats every zombie: hits go to the host, which credits b with kills + diamonds
  for (let k = 0; k < 4; k++) { await P.b.evaluate(() => window.__zombie.game._debug.hitAll()); await sleep(1500); }
  out.afterHits = { a: await st('a'), b: await st('b') };
  out.mid = { a: await st('a'), b: await st('b'), c: await st('c') };
  // emote
  for (const t of ['a', 'b', 'c']) await P[t].keyboard.up('f');
  await click('b', '[data-t=chat]'); await sleep(200); await click('b', '[data-em="1"]'); await sleep(1500); await P.a.screenshot({ path: shot + 'emote-iphone13.png' });
  // down + revive: c goes down, b walks over and holds Revive
  await P.c.evaluate(() => window.__zombie.game._debug.down()); await sleep(1500); await P.c.screenshot({ path: shot + 'downed-pixel7.png' });
  const cpos = await P.c.evaluate(() => { const m = window.__zombie.game._debug.me; return [m.x, m.z]; });
  await P.b.evaluate(([x, z]) => { const m = window.__zombie.game._debug.me; m.x = x + 1; m.z = z; }, cpos); await sleep(800);
  await P.b.keyboard.down('e'); await sleep(2000); out.revDbg = { b: await P.b.evaluate(() => { const g = window.__zombie.game._debug; return { rev: g.me.rev, x: g.me.x, team: [...g.team.values()].map((t) => [t.name, t.down, t.x, t.z]) }; }), c: await P.c.evaluate(() => { const g = window.__zombie.game._debug; return { x: g.me.x, z: g.me.z, team: [...g.team.values()].map((t) => [t.name, t.rev, t.x, t.z]) }; }) }; await P.b.screenshot({ path: shot + 'reviving-pixel7.png' }); await sleep(2500); await P.b.keyboard.up('e'); await sleep(1500);
  out.revive = await st('c');
  // host migration: the host (a) closes the app
  await P.a._ctx.close(); delete P.a; await sleep(14000);
  out.migration = { b: await st('b'), c: await st('c') }; await P.b.screenshot({ path: shot + 'after-host-left-pixel7.png' });
  const z1 = (await st('b')).zombies; await sleep(3000); out.migration.zombiesLater = (await st('b')).zombies; out.migration.zombiesBefore = z1;
  // team wipe
  await P.b.evaluate(() => window.__zombie.game._debug.down()); await P.c.evaluate(() => window.__zombie.game._debug.down()); await sleep(5000);
  await P.b.screenshot({ path: shot + 'team-wipe-pixel7.png' });
  for (const t of ['b', 'c']) await P[t].waitForFunction(() => /saved|limit|Could not/.test(document.querySelector('[data-dia]')?.textContent || '') || !document.querySelector('[data-dia]')?.textContent, null, { timeout: 70000 }).catch(() => {});
  await sleep(14000);
  out.end = {}; for (const t of ['b', 'c']) out.end[t] = await P[t].evaluate(() => ({ h: document.querySelector('.zg-card h2')?.textContent, dia: document.querySelector('[data-dia]')?.textContent, rank: document.querySelector('.zg-card a[href="#/scores/pals"]')?.textContent || '' }));
  await P.b.screenshot({ path: shot + 'team-wipe-saved-pixel7.png' });
} catch (e) { console.log('ERR', e.message.split('\n')[0]); for (const t in P) await P[t].screenshot({ path: shot + 'error-' + t + '.png' }).catch(() => {}); }
console.log(JSON.stringify(out)); console.log('errors:', errors.slice(0, 12).join(' | ') || 'none');
const vp = P.b && P.b.video(); for (const t in P) await P[t]._ctx.close().catch(() => {});
if (vp) { const f = await vp.path(); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', f, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', shot + 'full.mp4']); console.log('video', shot + 'full.mp4'); }
await browser.close();
console.log(execFileSync('node', [new URL('./zombie-coop-cleanup.mjs', import.meta.url).pathname, LOG]).toString().trim());
