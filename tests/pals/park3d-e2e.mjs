// Pal Park 3D e2e: two throwaway accounts in separate browser contexts (A = phone under test, B = second player).
// Checks movement, jumping, stairs, collisions, camera anti-clip, POV, chat between players, FPS. Accounts deleted after via cleanup.mjs.
// usage: node park3d-e2e.mjs <base> <shotPrefix> <device> [engine]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/park3d-'; const dev = process.argv[4] || 'iPhone 13'; const engine = process.argv[5] || 'chromium';
const args = engine === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } : {};
const browser = await pw[engine].launch(args); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
if (existsSync('/tmp/pals-test-cred.json')) writeFileSync('/tmp/pals-cred-prev-' + Date.now() + '.json', readFileSync('/tmp/pals-test-cred.json'));
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const W = (p, ms) => p.waitForTimeout(ms);
async function account(tag, species, device, gfx) {
  const d = { ...devices[device] }; if (engine !== 'chromium') delete d.defaultBrowserType;
  const ctx = await browser.newContext({ ...d, serviceWorkers: 'block' }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + String(e)));
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Park Tester ' + tag); await p.fill('#p-user', `pk${tag}${stamp}`); await p.fill('#p-email', `kemy.pals.test+${tag}${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate((g) => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.setItem('kemy-tut-park', '1'); if (g) localStorage.setItem('kemy-pal-gfx', g); location.hash = '#/me'; }, gfx || ''); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), species); await p.fill('#pal-name', tag === 'a' ? 'Bloop' : 'Toots'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/park'; }); await p.waitForFunction(() => window.__p3 && window.__p3.pos, null, { timeout: 60000 }).catch(async (e) => { await p.screenshot({ path: "/workspace/park3d-dbg-" + tag + ".png" }); throw e; });
  return p;
}
const out = {};
try {
  const a = await account('a', 'tiger', dev, process.env.MULTI ? 'low' : ''); const b = await account('b', 'elephant', 'Desktop Chrome', 'low');
  await W(a, 4000);
  const F = async (p, n) => { const f0 = await p.evaluate(() => window.__p3.frame); await p.waitForFunction((t) => window.__p3.frame >= t, f0 + n, { timeout: 180000, polling: 50 }); };
  const pos = () => a.evaluate(() => window.__p3.pos); const inp = (o) => a.evaluate((o) => window.__p3.input(o), o);
  // multiplayer first (both players at the plaza), chat both ways
  await a.evaluate(() => { window.__p3.teleport(2, 17); window.__p3.setYaw(Math.PI * 0.85); }); await b.evaluate(() => { window.__p3.teleport(-1, 19.5); window.__p3.setYaw(0.3); }); await F(a, 6); await W(a, 3000); await F(a, 4);
  await b.evaluate(() => window.__p3.say('Hi from player B!')); await W(a, 3000); await F(a, 4);
  out.multi = { aSeesOthers: (await pos()).others, bSeesOthers: (await b.evaluate(() => window.__p3.pos)).others, aLog: await a.evaluate(() => document.getElementById('p3-log').textContent), aNet: await a.evaluate(() => window.__p3.net), aFps: await a.evaluate(() => window.__p3.fps), bNet: await b.evaluate(() => window.__p3.net), extras: await a.evaluate(() => window.__p3.extras()) };
  await a.fill('#p3-t', 'Hello park!'); await a.press('#p3-t', 'Enter'); await W(a, 3000); await F(b, 3);
  out.multi.bLog = await b.evaluate(() => document.getElementById('p3-log').textContent);
  await b.evaluate(() => window.__p3.emote('🎉')); await W(a, 2500); await F(a, 4); out.multi.remoteDance = (await a.evaluate(() => window.__p3.othersInfo()))[0]?.dn;
  await a.screenshot({ path: shot + 'remote-dance.png' });
  out.gear = await a.evaluate(() => { const r = (e) => e && e.getBoundingClientRect(); const g = r(document.getElementById('p3-set')); const hit = [...document.querySelectorAll('.p3-top > *, .gm, .kc-b, .p3-chat, .p3-log')].filter((e) => { const b = r(e); return b.width && !(b.right <= g.left || b.left >= g.right || b.bottom <= g.top || b.top >= g.bottom); }).map((e) => e.className || e.id); return { x: g.left, y: g.top, w: g.width, overlaps: hit }; });
  await b.evaluate(() => window.__p3.input({ jump: true })); let maxUp = 0; for (let i = 0; i < 12; i++) { await W(a, 150); const o = (await a.evaluate(() => window.__p3.othersInfo()))[0]; if (o && o.th != null) maxUp = Math.max(maxUp, o.th - o.ground); } out.multi.remoteJumpSeen = +maxUp.toFixed(2);
  await W(a, 6000); out.multi.remoteDanceAfter = (await a.evaluate(() => window.__p3.othersInfo()))[0]?.dn;
  await a.screenshot({ path: shot + 'multiplayer.png' }); await b.screenshot({ path: shot + 'multiplayer-desktop.png' });
  // a third observer view: B walks, A sees it move (interpolated)
  const bx0 = await a.evaluate(() => { const o = [...document.querySelectorAll('.p3-tag')]; return o.length; });
  out.multi.tags = bx0;
  await b.evaluate(() => { location.hash = '#/pals'; }); await W(a, 3000); await F(a, 4); out.multi.afterBLeft = (await pos()).others;
  await b.close(); if (process.env.MULTI) throw new Error('multi-only done');
  // movement
  await a.evaluate(() => { window.__p3.teleport(0, 30); window.__p3.setYaw(0); }); await F(a, 3); out.start = await pos(); await a.screenshot({ path: shot + 'start.png' });
  await inp({ x: 0, y: -1 }); await F(a, 40); out.walk = await pos(); await a.screenshot({ path: shot + 'walk.png' }); await inp({ x: 0, y: 0 });
  out.walked = Math.hypot(out.walk.x - out.start.x, out.walk.z - out.start.z).toFixed(2) + ' m in 40 frames (expect ~8.8 at <=20 fps cap)';
  await inp({ x: 0, y: -1, run: true }); await F(a, 40); const r = await pos(); out.ran = Math.hypot(r.x - out.walk.x, r.z - out.walk.z).toFixed(2) + ' m in 40 frames (expect ~16)'; await a.screenshot({ path: shot + 'run.png' }); await inp({ x: 0, y: 0, run: false }); await F(a, 3);
  const g0 = await pos(); await inp({ jump: true }); await F(a, 6); const j = await pos(); await a.screenshot({ path: shot + 'jump.png' }); await F(a, 30); const j2 = await pos();
  out.jump = { up: (j.y - g0.y).toFixed(2), air: !j.onGround, mode: j.mode, landed: j2.onGround, backTo: (j2.y - g0.y).toFixed(2) };
  // stairs + building wall collision (studio porch)
  await a.evaluate(() => { const S = window.__p3.STUDIO; window.__p3.teleport(S.x, S.z + 18); window.__p3.setYaw(0); }); await F(a, 3); const s0 = await pos();
  await inp({ x: 0, y: -1 }); await F(a, 110); const s1 = await pos(); await a.screenshot({ path: shot + 'studio-stairs.png' }); await inp({ x: 0, y: 0 });
  const S = await a.evaluate(() => window.__p3.STUDIO);
  out.stairs = { climbed: (s1.y - s0.y).toFixed(2), z: s1.z.toFixed(2), wallZ: S.z + S.d / 2, blockedByWall: s1.z > S.z + S.d / 2 && s1.z < S.z + S.d / 2 + 1 };
  // camera anti-clip: camera swung behind into the building
  await a.evaluate(() => window.__p3.setYaw(Math.PI)); await F(a, 25); const c1 = await pos(); out.camClip = { dist: c1.camDist.toFixed(2), camZ: c1.cam[2].toFixed(2), wallZ: S.z + S.d / 2, outside: c1.cam[2] > S.z + S.d / 2 }; await a.screenshot({ path: shot + 'camera-wall.png' });
  // tree collision: walk at the nearest tree trunk
  out.tree = await a.evaluate(() => window.__p3.treeTest && window.__p3.treeTest());
  if (out.tree) { await inp({ x: 0, y: -1 }); await F(a, 60); await inp({ x: 0, y: 0 }); const t1 = await pos(); out.tree.end = Math.hypot(t1.x - out.tree.tx, t1.z - out.tree.tz).toFixed(2); await a.screenshot({ path: shot + 'tree.png' }); }
  // playground tower stairs
  await a.evaluate(() => { const L = window.__p3.PLAY; window.__p3.teleport(L.x - 8, L.z); window.__p3.setYaw(-Math.PI / 2); }); await F(a, 3); const p0 = await pos();
  await inp({ x: 0, y: -1 }); await F(a, 34); const p1 = await pos(); await inp({ x: 0, y: 0 }); await a.screenshot({ path: shot + 'playground.png' });
  out.tower = { from: p0.y.toFixed(2), to: p1.y.toFixed(2), x: p1.x.toFixed(2) };
  // game hub
  await a.evaluate(() => { const H = window.__p3.HUB; window.__p3.teleport(H.x, H.z - 3); window.__p3.setYaw(Math.PI); }); await F(a, 20); await a.screenshot({ path: shot + 'hub.png' });
  // dance (music on) + POV
  await a.evaluate(() => { window.__p3.teleport(4, 20); window.__p3.setYaw(0.6); window.__p3.emote('🎉'); }); await F(a, 20); out.dance = (await pos()).dance; await a.screenshot({ path: shot + 'dance.png' });
  await a.evaluate(() => window.__p3.toggleCam()); await inp({ x: 0, y: -0.6 }); await F(a, 15); out.pov = (await pos()).pov; await a.screenshot({ path: shot + 'pov.png' }); await inp({ x: 0, y: 0 }); await a.evaluate(() => window.__p3.emote('👋')); await F(a, 12); await a.screenshot({ path: shot + 'pov-wave.png' }); await a.evaluate(() => window.__p3.toggleCam());
  out.music = await a.evaluate(async () => { const m = await import('/js/gamemusic.js'); return m.state(); });
  // FPS (single player active)
  await a.evaluate(() => { window.__p3.teleport(-20, 25); window.__p3.setYaw(2.2); }); await inp({ x: 0.3, y: -1 }); await W(a, 8000); out.fps = await a.evaluate(() => ({ fps: +window.__p3.fps.toFixed(1), cpuMsPerFrame: +window.__p3.cpu.toFixed(1) })); await inp({ x: 0, y: 0 });
  await a.evaluate(() => { window.__p3.teleport(-30, 10); window.__p3.setYaw(2.3); }); await F(a, 15); await a.screenshot({ path: shot + 'scenery.png' });
  await a.evaluate(() => { window.__p3.teleport(-45, -40); window.__p3.setYaw(-2.2); }); await F(a, 15); await a.screenshot({ path: shot + 'pond.png' });
  await a.evaluate(() => { window.__p3.teleport(-2, 22); window.__p3.setYaw(0.2); }); await F(a, 15); await a.screenshot({ path: shot + 'fountain.png' });
  out.gfx = await a.evaluate(async () => (await import('/js/pals/pal3d.js')).gfxLevel());
  await a.evaluate(() => { location.hash = '#/pals'; }); await W(a, 1500);
} catch (e) { out.ERR = e.message; for (const [i, pg] of browser.contexts().entries()) for (const q of pg.pages()) await q.screenshot({ path: shot + 'error' + i + '.png' }).catch(() => {}); }
console.log(JSON.stringify(out, null, 1)); console.log('errors:', errors.join(' | ') || 'none'); await browser.close();
