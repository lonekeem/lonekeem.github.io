// Pal dance test (Play/Mute/Off, low Web Audio gain, persistence). Live Kemy Pals test with two throwaway accounts (both deleted at the end).
// NODE_PATH=<playwright dir> node tests/pals/e2e-live.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/pets-';
const R = []; const ok = (n, c, i = '') => { R.push(c); console.log(c ? 'PASS' : 'FAIL', n, i); };
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
import { writeFileSync } from 'node:fs'; writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const FS = 'https://firestore.googleapis.com/v1/projects/lone-keem-studios/databases/(default)/documents';
async function account(tag, dev = 'iPhone 13') {
  const ctx = await browser.newContext({ ...devices[dev] }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(tag + ': ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  const user = `pt${tag}${stamp}`;
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Pal Tester ' + tag); await p.fill('#p-user', user); await p.fill('#p-email', `kemy.pals.test+${tag}${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 20000 });
  const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser.uid);
  return { ctx, p, user, uid };
}


async function hatch(X, name, species) {
  await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.waitForSelector('#pal-crack', { timeout: 20000 });
  for (let i = 0; i < 3; i++) { await X.p.click('#pal-crack'); await X.p.waitForTimeout(250); }
  await X.p.waitForSelector('#pal-form'); if (species) await X.p.click(`[data-species="${species}"]`); await X.p.fill('#pal-name', name); await X.p.click('#pal-form [type=submit]'); await X.p.waitForTimeout(2500);
}
const clearModal = (X) => X.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });

const B = (X) => X.p.evaluate(async () => { const m = await import('/js/pals/dance.js'); const s = m.busState(); return { amt: +s.amt.toFixed(2), src: s.src, bpm: s.bpm, energy: +s.energy.toFixed(2) }; });
const G = (X) => X.p.evaluate(async () => (await import('/js/theme.js')).gainInfo());
async function frames(X, sel, out, n = 36) { const dir = '/tmp/dframes-' + Date.now(); const { mkdirSync } = await import('node:fs'); mkdirSync(dir); const el = await X.p.$(sel); for (let i = 0; i < n; i++) { await el.screenshot({ path: `${dir}/f${String(i).padStart(3, '0')}.png` }); await X.p.waitForTimeout(60); } const { execFileSync } = await import('node:child_process'); execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', `${dir}/f%03d.png`, '-vf', 'scale=360:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', out]); }
for (const [tag, dev] of (process.env.ONE ? [['a', 'iPhone 13']] : [['a', 'iPhone 13'], ['b', 'Pixel 7']])) {
  const X = await account(tag, dev); const N = (s) => `${s} (${dev})`; const A = tag === 'a';
  await X.p.waitForSelector('#theme-ask', { timeout: 8000 }).catch(() => {}); await X.p.click('#theme-ask [data-m=mute]').catch(() => {});
  await X.p.click('#modal-root [data-close]').catch(() => {}); await clearModal(X);
  await hatch(X, A ? 'Groovy' : 'Boogie', A ? 'elephant' : 'kitten'); await clearModal(X);
  await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.waitForSelector('.pal-strip', { timeout: 15000 }); await clearModal(X);
  ok(N('Pal still before music'), (await B(X)).amt === 0);
  await X.p.$eval('.theme-fab', (b) => b.click()); await X.p.waitForTimeout(2200);
  const b1 = await B(X), g1 = await G(X); ok(N('theme plays -> Pal dances (beat from analyser), gain still 20%'), b1.amt === 1 && b1.src === 'theme' && Math.abs(g1.gain - 0.2) < 0.02, JSON.stringify({ b1, gain: g1.gain }));
  await X.p.$eval('#ppal', (e) => e.scrollIntoView({ block: 'center' })); await X.p.waitForTimeout(500);
  if (A) { await X.p.screenshot({ path: shot + 'profile-dancing.png' }); await frames(X, '.pal-strip .pal-cv canvas', '/workspace/pal-dance.gif'); }
  await X.p.$eval('.theme-fab', (b) => b.click()); await X.p.waitForTimeout(2600);
  const b2 = await B(X); ok(N('mute -> Pal stops dancing smoothly'), b2.amt === 0, JSON.stringify(b2));
  // a song in the Music mini player
  await X.p.evaluate(() => { location.hash = '#/music'; }); await X.p.waitForFunction(() => !!window.__kemyPlayer, null, { timeout: 15000 });
  await X.p.evaluate(() => window.__kemyPlayer.play({ id: 'test-song', type: 'song', mediaUrl: '/assets/audio/kemy-theme.m4a', work: { title: 'Test song', artist: 'Test' }, authorName: 'Test', authorId: 'x' }, []));
  await X.p.waitForTimeout(1800); const b3 = await B(X); ok(N('song in Music player -> Pal dances'), b3.amt === 1 && b3.src === 'audio', JSON.stringify(b3) + JSON.stringify(await X.p.evaluate(() => { const a = window.__kemyPlayer.audio; return { p: a.paused, m: a.muted, v: a.volume, s: a.currentSrc, e: a.error && a.error.code, n: document.querySelectorAll('audio,video').length, inDoc: document.contains(a) }; })));
  await X.p.evaluate(() => window.__kemyPlayer.audio.pause()); await X.p.waitForTimeout(1500); const b4 = await B(X); ok(N('song paused -> stops'), b4.amt === 0, JSON.stringify(b4));
  await X.p.evaluate(() => window.__kemyPlayer.close());
  // dance picker + shop
  await X.p.evaluate(() => { location.hash = '#/pals'; }); await X.p.waitForSelector('[data-c=dance]', { timeout: 15000 }); await X.p.click('[data-c=dance]');
  await X.p.waitForSelector('.pal-dance [data-pick=free]'); const nT = await X.p.$$eval('.pal-dance .pal-dtile', (l) => l.length);
  ok(N('dance picker lists Freestyle + moves + Trending'), nT >= 1 + 12 + 12 + 5, String(nT));
  if (A) await X.p.screenshot({ path: shot + 'picker.png' });
  await X.p.click('[data-dt=shop]'); await X.p.click('[data-pv=dab]'); await X.p.waitForTimeout(900);
  ok(N('preview shows the dance'), /Preview: the Dab/.test(await X.p.textContent('.pal-dance-now')));
  if (A) await X.p.screenshot({ path: '/workspace/dance-shop.png' });
  await X.p.click('[data-ask=countshrug]'); await X.p.waitForSelector('#dc-yes'); const conf = await X.p.textContent('.pal-confirm');
  ok(N('buy asks to confirm with price'), /Unlock Count & Shrug/.test(conf) && /★/.test(conf), conf.slice(0, 80));
  if (A) await X.p.screenshot({ path: shot + 'confirm.png' });
  await X.p.click('#dc-no'); await clearModal(X);
  // keep Pal on screen while scrolling
  await X.p.evaluate(() => { location.hash = '#/settings'; }); await X.p.waitForSelector('#s-pal-keep'); await X.p.$eval('#s-pal-keep', (e) => e.click());
  ok(N('settings: dance on by default, keep-on-screen toggled'), await X.p.$eval('#s-pal-dance', (e) => e.checked) && await X.p.$eval('#s-pal-keep', (e) => e.checked));
  if (A) { await X.p.$eval('#spals-h', (e) => e.scrollIntoView({ block: 'start' })); await X.p.screenshot({ path: shot + 'settings.png' }); }
  await X.p.evaluate(() => { location.hash = '#/watch'; }); await X.p.waitForTimeout(4000); await clearModal(X);
  const vis = await X.p.evaluate(() => { const f = document.querySelector('.pal-float'); return f && !f.hidden; });
  ok(N('floating Pal shows while scrolling the feed (no music)'), vis);
  await X.p.mouse.wheel(0, 700); await X.p.waitForTimeout(1500);
  if (A) await X.p.screenshot({ path: '/workspace/pal-keep-on-screen.png' });
  // double-tap the Pal -> hides
  const fb = await (await X.p.$('.pal-float')).boundingBox(); const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2;
  await X.p.mouse.click(cx, cy); await X.p.waitForTimeout(120); await X.p.mouse.click(cx, cy); await X.p.waitForTimeout(1500);
  ok(N('double-tap Pal -> wave + hidden for the session'), await X.p.evaluate(() => document.querySelector('.pal-float').hidden && sessionStorage.getItem('kemy-pal-float-hidden') === '1'));
  // triple-tap the feed -> comes back, no accidental like
  const likeBefore = await X.p.evaluate(() => [...document.querySelectorAll('[data-a=like].on')].length);
  const vp = X.p.viewportSize(); await X.p.evaluate(() => { const sl = document.querySelector('.vslide:not(.vext)'); if (sl) sl.scrollIntoView(); }); await X.p.waitForTimeout(1200); const tx = vp.width * 0.4, ty = vp.height * 0.45;
  await X.p.evaluate(() => { window.__pu = 0; window.addEventListener('pointerup', () => window.__pu++, true); });
  for (let i = 0; i < 3; i++) { await X.p.mouse.click(tx, ty); await X.p.waitForTimeout(110); } await X.p.waitForTimeout(1500);
  const back = await X.p.evaluate(() => !document.querySelector('.pal-float').hidden);
  const likeAfter = await X.p.evaluate(() => [...document.querySelectorAll('[data-a=like].on')].length);
  ok(N('triple-tap screen -> Pal bounces back'), back, JSON.stringify(await X.p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return { t: e && (e.className || e.tagName), h: sessionStorage.getItem('kemy-pal-float-hidden'), pu: window.__pu, armed: window.__kemyPalSummon && window.__kemyPalSummon.armed() }; }, [tx, ty]))); ok(N('no like from the summon taps'), likeAfter === likeBefore, `${likeBefore}->${likeAfter}`);
  await X.ctx.close();
}
const { execFileSync } = await import('node:child_process');
console.log(execFileSync('node', [new URL('../pals/cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(R.every(Boolean) ? `ALL ${R.length} PASSED` : `${R.filter((x) => !x).length} FAILED of ${R.length}`); await browser.close();
