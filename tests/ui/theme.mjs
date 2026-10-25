// Theme music test (Play/Mute/Off, low Web Audio gain, persistence). Live Kemy Pals test with two throwaway accounts (both deleted at the end).
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


const T = (X) => X.p.evaluate(async () => (await import('/js/theme.js')).gainInfo());
const fab = (X) => X.p.evaluate(() => { const b = document.querySelector('.theme-fab'); return b ? { hidden: b.hidden, text: b.textContent } : null; });
for (const [tag, dev] of [['a', 'iPhone 13'], ['b', 'Pixel 7']]) {
  const X = await account(tag, dev); const N = (s) => `${s} (${dev})`;
  await X.p.waitForSelector('#theme-ask', { timeout: 8000 }).then(() => ok(N('first-run prompt shows on welcome'), true)).catch(() => ok(N('first-run prompt shows on welcome'), false));
  if (tag === 'a') await X.p.screenshot({ path: shot + 'prompt-welcome.png' });
  await X.p.click('#theme-ask [data-m=play]'); await X.p.waitForTimeout(200);
  const g0 = await T(X); await X.p.waitForTimeout(1700); const g1 = await T(X);
  ok(N('plays through Web Audio gain, fades in to ~20%'), g1.webAudio && g1.playing && g0.gain < 0.15 && Math.abs(g1.gain - 0.2) < 0.02 && g1.elVolume === 1, JSON.stringify({ g0: g0.gain, g1: g1.gain, el: g1.elVolume }));
  ok(N('first theme song is Keep Building (mp3, ~189.6 s), Kemy on the Screen next'), /keep-building\.mp3(\?v=1)?$/.test(g1.src || '') && Math.abs(g1.duration - 189.6) < 0.5, `${g1.src} ${g1.duration}`);
  await X.p.click('#modal-root [data-close]').catch(() => {}); await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.waitForTimeout(2500); await X.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; }); await X.p.waitForTimeout(300);
  const f1 = await fab(X); ok(N('floating button shows 🎵 on profile'), f1 && !f1.hidden && f1.text === '🎵', JSON.stringify(f1));
  if (tag === 'a') await X.p.screenshot({ path: shot + 'button-playing.png' });
  await X.p.evaluate(() => dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'test' } }))); await X.p.waitForTimeout(800);
  ok(N('kemy:media-play stops the theme'), !(await T(X)).playing);
  await X.p.$eval('.theme-fab', (b) => b.click()); await X.p.waitForTimeout(1800); ok(N('tap button while paused resumes'), (await T(X)).playing);
  await X.p.$eval('.theme-fab', (b) => b.click()); await X.p.waitForTimeout(1800); const m = await T(X); const f2 = await fab(X);
  ok(N('tap button mutes (fade out, paused, 🔇)'), !m.playing && m.mode === 'mute' && f2.text === '🔇', JSON.stringify({ m, f2 }));
  if (tag === 'a') await X.p.screenshot({ path: shot + 'button-muted.png' });
  await X.p.reload(); await X.p.waitForTimeout(3000); await X.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; }); const f3 = await fab(X); const m3 = await T(X);
  ok(N('Mute remembered after reload, no prompt'), m3.mode === 'mute' && f3 && !f3.hidden && f3.text === '🔇' && !(await X.p.$('#theme-ask')), JSON.stringify({ f3, mode: m3.mode }));
  await X.p.evaluate(() => { location.hash = '#/settings'; }); await X.p.waitForSelector('[name=s-theme-mode]');
  const st = await X.p.evaluate(() => ({ mode: document.querySelector('[name=s-theme-mode]:checked')?.value, vol: document.querySelector('#s-theme-vol').value }));
  ok(N('Settings shows the same choice + 20% volume'), st.mode === 'mute' && st.vol === '20', JSON.stringify(st));
  if (tag === 'a') { await X.p.$eval('#snd-h', (e) => e.scrollIntoView({ block: 'start' })); await X.p.waitForTimeout(300); await X.p.screenshot({ path: shot + 'settings-sound.png' }); }
  // Delete-account button: what is on top of it?
  await X.p.$eval('#s-delete', (e) => e.scrollIntoView({ block: 'center' })); await X.p.waitForTimeout(400);
  const top = await X.p.$eval('#s-delete', (b) => { const r = b.getBoundingClientRect(); const pts = [[.5, .5], [.1, .5], [.9, .5]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y)); return pts.map((e) => e === b || b.contains(e) ? 'ok' : (e ? (e.className || e.tagName) : 'none')); });
  ok(N('nothing overlaps Delete account'), top.every((t) => t === 'ok'), JSON.stringify(top));
  await X.p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await X.p.waitForTimeout(400);
  const top2 = await X.p.$eval('#s-delete', (b) => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e) ? 'ok' : (e ? (e.className || e.tagName) + ' bottom=' + r.bottom + ' vh=' + innerHeight : 'offscreen ' + r.top); });
  ok(N('Delete account tappable when scrolled to the very bottom'), top2 === 'ok', top2);
  await X.p.click('#s-delete', { trial: true, timeout: 4000 }).then(() => ok(N('Playwright tap on Delete account (trial)'), true)).catch((e) => ok(N('Playwright tap on Delete account (trial)'), false, String(e).split('\n').find((l) => /intercepts/.test(l)) || ''));
  await X.p.click('label:has([name=s-theme-mode][value=off]) span'); await X.p.waitForTimeout(300);
  await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.reload(); await X.p.waitForTimeout(3000); await X.p.mouse.click(180, 300); await X.p.waitForTimeout(800);
  const f4 = await fab(X); const m4 = await T(X); ok(N('Off: button hidden, never auto-starts, no prompt'), (!f4 || f4.hidden) && !m4.playing && m4.mode === 'off' && !(await X.p.$('#theme-ask')), JSON.stringify({ f4, m4 }));
  await X.ctx.close();
}
const { execFileSync } = await import('node:child_process');
console.log(execFileSync('node', [new URL('../pals/cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(R.every(Boolean) ? `ALL ${R.length} PASSED` : `${R.filter((x) => !x).length} FAILED of ${R.length}`); await browser.close();
