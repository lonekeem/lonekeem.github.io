// Kemy Street e2e: two throwaway accounts (A = phone, B = second player), walk/teleport into the neighborhood,
// knock on a door, check sync, screenshots portrait + landscape. Accounts are deleted after via tests/pals/cleanup.mjs.
// usage: NODE_PATH=... node tests/world/street-e2e.mjs <base> <shotPrefix> [steps]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { writeFileSync } from 'node:fs';
const pw = require('playwright'); const { devices } = pw;
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/street-'; const steps = (process.argv[4] || 'all').split(',');
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const W = (p, ms) => p.waitForTimeout(ms);
async function account(tag, species, device, gfx, hash) {
  const ctx = await browser.newContext({ ...devices[device], serviceWorkers: 'block' }); await ctx.addInitScript(() => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } }); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(tag + ': ' + String(e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text().slice(0, 200)); });
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'House Tester ' + tag); await p.fill('#p-user', `pk${tag}${stamp}`); await p.fill('#p-email', `kemy.pals.test+${tag}${stamp}@example.com`); await p.fill('#p-pass', pass); { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption('1995'); } } await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 30000 }); await p.click('#modal-root [data-close]'); await W(p, 300);
  await p.evaluate((g) => { localStorage.setItem('kemy-tut-park', '1'); if (g) localStorage.setItem('kemy-gfx', g); location.hash = '#/me'; }, gfx || ''); await p.waitForSelector('#pal-crack', { timeout: 20000 });
  await p.evaluate(() => document.getElementById('theme-ask')?.querySelector('button:last-child')?.click()); await W(p, 400);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => document.getElementById('pal-crack')?.click()); await W(p, 250); }
  await p.waitForSelector('#pal-form'); await W(p, 800);
  await p.evaluate((s) => document.querySelector(`[data-species="${s}"]`)?.click(), species); await p.fill('#pal-name', tag === 'a' ? 'Bloop' : 'Toots'); await p.evaluate(() => document.querySelector('#pal-form [type=submit]').click()); await W(p, 3000);
  await p.evaluate((h) => { document.getElementById('modal-root').innerHTML = ''; location.hash = h; }, hash); await p.waitForFunction(() => window.__p3 && window.__p3.pos && window.__kw, null, { timeout: 90000 }).catch(async (e) => { await p.screenshot({ path: shot + 'dbg-' + tag + '.png' }); throw e; });
  return p;
}


const out = {}; const S = async (p, n) => { await W(p, 2200); await p.screenshot({ path: shot + n + '.png' }); };
const tp = (p, x, z, yaw = 0, y) => p.evaluate(([x, z, yaw, y]) => { window.__p3.teleport(x, z, y); window.__p3.setYaw(yaw); }, [x, z, yaw, y]);
const st = (p) => p.evaluate(() => ({ pos: window.__p3.pos, kh: { inside: window.__kh.inside, prompt: window.__kh.prompt, sit: window.__kh.sit, tv: window.__kh.tv }, act: document.getElementById('ks-act')?.hidden ? null : document.getElementById('ks-act')?.textContent }));
const walk = async (p, x, y, ms) => { await p.evaluate(([x, y]) => window.__p3.input({ x, y }), [x, y]); await W(p, ms); await p.evaluate(() => window.__p3.input({ x: 0, y: 0 })); await W(p, 300); };
let b = null;
try {
  const a = await account('a', 'tiger', 'iPhone 13', process.env.GFX || 'low', '#/street');
  await a.evaluate(() => localStorage.setItem('kemy-pals-debug', '1')); await W(a, 5000);
  const H = process.env.HOUSE || 'h04';
  await a.evaluate((h) => window.__khApi.goIn(h), H); await W(a, 1500); out.in = await st(a); await S(a, 'portrait-entry');
  const R = await a.evaluate(() => { const r = window.__khApi.rooms(); const k = [...r.keys()][0]; return { cx: r.get(k).cx, cz: r.get(k).cz }; }); out.cell = R;
  // walk straight down the hallway towards the back (should pass all the way: no doors)
  await walk(a, 0, 1, 3500); out.hall = await st(a); await S(a, 'portrait-hall');
  // living room: stand in it facing the TV
  await tp(a, R.cx - 3, R.cz + 5.5, Math.PI); await S(a, 'portrait-living');
  out.seats = await a.evaluate(() => window.__khApi.seats()); out.screens = await a.evaluate(() => window.__khApi.screens().length);
  const sofa = out.seats.filter((q) => q.c === 'cs');
  if (sofa[0]) { await tp(a, sofa[0].x, sofa[0].z + 0.0, 0); await a.evaluate(([x, z]) => window.__p3.teleport(x, z), [sofa[0].x + 0.0, sofa[0].z - 0.9]); await W(a, 900); out.nearSofa = await st(a);
    if (out.nearSofa.act && /Sit/.test(out.nearSofa.act)) { await a.evaluate(() => document.getElementById('ks-act').click()); await W(a, 1200); out.sitting = await st(a); await S(a, 'portrait-sit'); } }
  // TV prompt near the TV
  const sc = (await a.evaluate(() => window.__khApi.screens()))[0]; if (sc) { await a.evaluate(() => window.__khApi.standUp()); await tp(a, sc.x + Math.sin(sc.yaw) * 1.6, sc.z + Math.cos(sc.yaw) * 1.6, sc.yaw); await W(a, 1000); out.nearTV = await st(a); await a.evaluate(() => window.__khApi.tvShow('Kemy Radio test', 'Bloop')); await S(a, 'portrait-tv'); }
  // stairs (two-story): walk up + down
  out.two = await a.evaluate(() => { const r = window.__khApi.rooms(); return [...r.values()][0].I.two; });
  if (out.two) { await tp(a, R.cx + 1.2 * 1.4, R.cz + 5.5 * 1.4, Math.PI / 2); await W(a, 600); await walk(a, -1, 0, 1); await walk(a, 0, 1, 3200); out.up = await st(a); await S(a, 'portrait-upstairs');
    await a.evaluate(() => window.__p3.setYaw(-Math.PI / 2)); await walk(a, 0, 1, 3200); out.down = await st(a); }
  await a.setViewportSize({ width: 844, height: 390 }); await tp(a, R.cx - 3, R.cz + 6, Math.PI); await S(a, 'landscape-living');
  if (out.two) { await tp(a, R.cx + 1.2 * 1.4, R.cz + 5.5 * 1.4, Math.PI / 2); await W(a, 500); await walk(a, 0, 1, 3200); out.upL = await st(a); await S(a, 'landscape-upstairs'); await a.evaluate(() => window.__p3.setYaw(-Math.PI / 2)); await walk(a, 0, 1, 3200); out.downL = await st(a); }
  // sync: second player sees A sitting
  if (process.env.MULTI !== '0' && sofa[1]) { await a.evaluate(([x, z]) => window.__p3.teleport(x, z), [sofa[1].x, sofa[1].z - 0.9]); await W(a, 900); await a.evaluate(() => window.__khApi.sitDown(window.__khApi.seats().findIndex((q) => q.c === 'cs' && Math.abs(q.x - window.__p3.pos.x) < 0.3 + 0))); await W(a, 300);
    out.aSit2 = await st(a); if (!out.aSit2.kh.sit) { const i = await a.evaluate(() => window.__khApi.seats().findIndex((q) => q.c === 'cs')); await a.evaluate((i) => window.__khApi.sitDown(i + 1), i); }
    b = await account('b', 'elephant', 'Desktop Chrome', 'low', '#/street'); await W(b, 5000); await b.evaluate((h) => window.__khApi.goIn(h), H); await W(b, 1500);
    await tp(b, R.cx - 3, R.cz + 3.2, Math.PI); await W(b, 6000); out.bSees = await b.evaluate(() => window.__p3.othersInfo()); await S(b, 'desktop-b-sees-sit');
    out.aNow = await st(a); }
} catch (e) { out.err = String(e && e.stack || e); }
out.errors = errors.slice(0, 15); console.log(JSON.stringify(out, null, 1)); await browser.close();
