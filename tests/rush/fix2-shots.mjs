// Kemy Hill Rush fix2 checks: results card readable + fits at iPhone sizes (portrait, landscape, landscape minus browser chrome),
// pause/menu/garage/stages fit landscape, pickups reachable. Guest only, local server only.
// A test-only route adds window.__rushEnd so the results card can be shown without crashing on purpose (nothing in the repo changes).
// usage: node tests/rush/fix2-shots.mjs [base] [shotDir] [prefix]
import { createRequire } from 'node:module'; const require = createRequire('/tmp/kemy-t/');
const pw = require('playwright');
const base = process.argv[2] || 'http://localhost:8961/'; const dir = (process.argv[3] || '/workspace/hill-game/fix2') + '/'; const pre = process.argv[4] || 'after';
const browser = await pw.chromium.launch({ executablePath: process.env.PW_EXE || undefined });
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const errors = [], out = {};
async function phone(w, h, insets) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-welcome-seen-v1', '1'); localStorage.setItem('rush-rot-off', '1'); } catch {} });
  await ctx.route(/js\/rush\/game\.js/, async (route) => { const r = await route.fetch(); let t = await r.text();
    t = t.replace('document.body.appendChild(root);', 'document.body.appendChild(root); window.__rushEnd = (x) => end(x); window.__rushSt = () => S; window.__rushPick = () => { for (let i = 2; i < 400; i++) { const k = terr.pickups(i).find((q) => q.t === \'dia\'); if (k) { sim.respawn(me.car, k.x - 7); cam.x = k.x - 4; return { x: +k.x.toFixed(1), y: +k.y.toFixed(2), above: +(k.y - terr.at(k.x)).toFixed(2) }; } } };');
    await route.fulfill({ response: r, body: t, headers: { ...r.headers(), 'content-type': 'text/javascript' } }); });
  if (process.env.PASS) await ctx.route(/js\/rush\/index\.js/, async (route) => { const r = await route.fetch(); let t = await r.text(); // test-only: pretend this guest holds a pass
    t = t.replace('export async function passOf(uid) {', `export async function passOf(uid) { return '${process.env.PASS}';`); await route.fulfill({ response: r, body: t, headers: { ...r.headers(), 'content-type': 'text/javascript' } }); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`${w}x${h}: ` + String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::|Failed to load resource/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  if (insets) { try { const s = await ctx.newCDPSession(p); await s.send('Emulation.setSafeAreaInsetsOverride', { insets }); } catch {} }
  return { p, ctx };
}
const fits = (p, sel) => p.evaluate((sel) => { const vh = innerHeight, vw = innerWidth; return [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 18), ok: r.top >= 0 && r.bottom <= vh + 0.5 && r.left >= 0 && r.right <= vw + 0.5, b: Math.round(r.bottom), r: Math.round(r.right) }; }); }, sel);
const rowsReadable = (p) => p.evaluate(() => { const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  return [...document.querySelectorAll('.modal .rush-res > div')].map((d) => { const cs = getComputedStyle(d), sp = d.querySelector('span'), fg = getComputedStyle(sp).webkitTextFillColor || getComputedStyle(sp).color; let bg = cs.backgroundColor; if (/rgba\(.*, 0\)/.test(bg)) bg = 'rgb(20,14,40)';
    const a = lum(fg), b = lum(bg); return { txt: d.textContent.trim().slice(0, 24), fg, bg, ratio: +(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)) }; }); });
async function startSolo(p) { await p.goto(base + 'app.html#/games/rush'); await p.waitForSelector('#rush-go', { timeout: 20000 }); await p.waitForTimeout(600); await p.tap('#rush-go'); await p.waitForSelector('.rush-run canvas'); await p.waitForTimeout(900); }
async function results(name, w, h, insets) { const { p, ctx } = await phone(w, h, insets); await startSolo(p);
  await p.evaluate(() => { const S = window.__rushSt(); S.dias = 3; S.flips = 2; S.stars = 41; window.__rushEnd('crash'); }); await p.waitForSelector('.modal .rush-res', { timeout: 5000 }); await p.waitForTimeout(700);
  out[name] = { rows: await rowsReadable(p), btns: await fits(p, '.modal .btns .btn') };
  await p.screenshot({ path: dir + `${pre}-results-${name}.png` }); await ctx.close(); }
async function pauseFit(name, w, h) { const { p, ctx } = await phone(w, h); await startSolo(p); await p.tap('.rush-pause'); await p.waitForTimeout(400);
  out['pause-' + name] = await fits(p, '.rush-pausebox .btn'); await p.screenshot({ path: dir + `${pre}-pause-${name}.png` }); await ctx.close(); }
async function pageFit(name, w, h, hash) { const { p, ctx } = await phone(w, h); await p.goto(base + 'app.html' + hash); await p.waitForSelector('.rush-page', { timeout: 20000 }); await p.waitForTimeout(1200);
  out['page-' + name] = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth })); await p.screenshot({ path: dir + `${pre}-${name}.png` }); await ctx.close(); }
async function pickups(name, w, h) { const { p, ctx } = await phone(w, h); await startSolo(p);
  // landscape gameplay: hold gas for a few seconds
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(3500); await p.screenshot({ path: dir + `${pre}-gameplay-${name}.png` }); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(300);
  // jump ahead to the first diamond, park the camera next to it, then drive through it
  const r = await p.evaluate(() => window.__rushPick && window.__rushPick()); await p.waitForTimeout(1200);
  await p.screenshot({ path: dir + `${pre}-diamond-${name}.png` });
  const d0 = await p.evaluate(() => window.__rushSt().dias); await p.keyboard.down('ArrowRight'); await p.waitForTimeout(2600); await p.keyboard.up('ArrowRight');
  r.got = (await p.evaluate(() => window.__rushSt().dias)) - d0; out['pick-' + name] = r; await ctx.close(); }
async function passShots(w, h) { for (const hsh of ['#/games/rush/garage', '#/games/rush/stages']) { const { p, ctx } = await phone(w, h); await p.goto(base + 'app.html' + hsh); await p.waitForSelector('.rush-page', { timeout: 20000 }); await p.waitForTimeout(1500);
    out['pass-' + hsh] = await p.evaluate(() => ({ chip: document.querySelector('.rush-pass')?.textContent, locks: document.querySelectorAll('.rush-card2.lock').length, cards: document.querySelectorAll('.rush-card2').length, max: !!document.getElementById('rush-max'), text: document.querySelector('.rush-page')?.innerText.replace(/\s+/g, ' ').slice(0, 400) }));
    await p.screenshot({ path: dir + `${pre}-pass-${process.env.PASS}-${hsh.split('/').pop()}-${w}x${h}.png`, fullPage: true }); await ctx.close(); } }
try {
  const which = (process.argv[5] || 'results,pause,pages').split(',');
  if (which.includes('results')) {
    await results('portrait-390x844', 390, 844, { top: 59, bottom: 34 });
    await results('land-844x390', 844, 390, { left: 59, right: 59, bottom: 21 });
    await results('land-844x330-chrome', 844, 330, { left: 59, right: 59, bottom: 21 });
    await results('land-812x375', 812, 375, { left: 44, right: 44, bottom: 21 });
    await results('land-812x315-chrome', 812, 315, { left: 44, right: 44, bottom: 21 });
    await results('land-740x360', 740, 360); await results('land-740x300-chrome', 740, 300);
    await results('land-667x375', 667, 375); await results('land-667x315-chrome', 667, 315); }
  if (which.includes('pause')) { await pauseFit('land-844x330', 844, 330); await pauseFit('land-667x315', 667, 315); }
  if (which.includes('pages')) { for (const [n, hsh] of [['menu', '#/games/rush'], ['garage', '#/games/rush/garage'], ['stages', '#/games/rush/stages']]) await pageFit(n + '-land-844x330', 844, 330, hsh); }
  if (which.includes('pick')) { await pickups('land-844x390', 844, 390); await pickups('land-667x375', 667, 375); }
  if (which.includes('pass')) { await passShots(390, 844); await passShots(844, 390); }
} catch (e) { errors.push('FATAL ' + (e.stack || e).toString().slice(0, 400)); }
await browser.close();
console.log(JSON.stringify({ out, errors }, null, 1));
