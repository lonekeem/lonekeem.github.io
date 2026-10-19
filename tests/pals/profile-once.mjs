// Regression: exactly one Pal on your own profile. Live Kemy Pals test with two throwaway accounts (both deleted at the end).
// NODE_PATH=<playwright dir> node tests/pals/e2e-live.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/profile-';
const R = []; const ok = (n, c, i = '') => { R.push(c); console.log(c ? 'PASS' : 'FAIL', n, i); };
const browser = await chromium.launch(); const errors = [];
const stamp = Date.now().toString(36).slice(-6); const pass = 'Test-' + Math.random().toString(36).slice(2, 12) + '!9';
import { writeFileSync } from 'node:fs'; writeFileSync('/tmp/pals-test-cred.json', JSON.stringify({ stamp, pass }), { mode: 0o600 });
const FS = 'https://firestore.googleapis.com/v1/projects/lone-keem-studios/databases/(default)/documents';
async function account(tag) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(tag + ': ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(tag + ': ' + m.text()); });
  const user = `pt${tag}${stamp}`;
  await p.goto(base + 'app.html#/signup'); await p.waitForSelector('#signup-form');
  await p.fill('#p-name', 'Pal Tester ' + tag); await p.fill('#p-user', user); await p.fill('#p-email', `kemy.pals.test+${tag}${stamp}@example.com`); await p.fill('#p-pass', pass); await p.check('#p-agree');
  await p.click('#p-btn'); await p.waitForSelector('#welcome-title', { timeout: 20000 });
  await p.click('#modal-root [data-close]'); await p.waitForTimeout(300);
  const uid = await p.evaluate(async () => (await import('/js/firebase-init.js')).auth.currentUser.uid);
  return { ctx, p, user, uid };
}

async function hatch(X, name, species) {
  await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.waitForSelector('#pal-crack', { timeout: 20000 });
  for (let i = 0; i < 3; i++) { await X.p.click('#pal-crack'); await X.p.waitForTimeout(250); }
  await X.p.waitForSelector('#pal-form'); if (species) await X.p.click(`[data-species="${species}"]`); await X.p.fill('#pal-name', name); await X.p.click('#pal-form [type=submit]'); await X.p.waitForTimeout(2500);
}
const clearModal = (X) => X.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });

const count = (X) => X.p.evaluate(() => ({ strips: document.querySelectorAll('.pal-strip').length, cvs: document.querySelectorAll('#ppal canvas').length, actors: [...document.querySelectorAll('.pal-strip')].reduce((n, e) => n + +(e.dataset.pals || 0), 0), pops: document.querySelectorAll('.pal-pop').length }));
async function bounce(X, label, n = 5) {
  let bad = null;
  for (let i = 0; i < n; i++) {
    await X.p.evaluate(() => { location.hash = '#/feed'; }); await X.p.waitForTimeout(500);
    await X.p.evaluate(() => { location.hash = '#/me'; }); if (i % 2) { await X.p.evaluate(() => { location.hash = '#/feed'; location.hash = '#/me'; }); }
    await X.p.waitForSelector('.pal-strip', { timeout: 15000 }); await X.p.mouse.wheel(0, 400); await X.p.waitForTimeout(1800);
    const c = await count(X); if (!(c.strips === 1 && c.cvs === 1 && c.actors === 1 && c.pops === 0)) bad = c;
  }
  ok(`exactly one Pal on own profile after ${n} round trips (${label})`, !bad, JSON.stringify(bad || await count(X)));
}
// fire pop-ups as often as possible so any overlay on the profile would show
const A = await account('a'); await A.p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); localStorage.removeItem('kemy-pals-pop-last'); });
await hatch(A, 'Bloop');
await bounce(A, '1 Pal, iPhone 13'); await A.p.screenshot({ path: shot + 'one-pal-iphone.png' });
await A.p.evaluate(() => { location.hash = '#/me'; }); await A.p.waitForSelector('[data-pa=care]'); await A.p.click('[data-pa=care]'); await A.p.waitForSelector('[data-dbg]');
for (let i = 0; i < 7; i++) { await A.p.evaluate(() => document.querySelector('[data-dbg]')?.click()); await A.p.waitForTimeout(1300); } await clearModal(A);
await A.p.evaluate(() => { location.hash = '#/pals'; }); await A.p.waitForSelector('.pal-box'); await A.p.waitForTimeout(800);
const egg = await A.p.$('[data-hatch]'); if (egg) { await egg.click(); await A.p.waitForSelector('#pal-form'); await A.p.click('[data-species="elephant"]'); await A.p.fill('#pal-name', 'Toots'); await A.p.click('#pal-form [type=submit]'); await A.p.waitForTimeout(3000); }
await clearModal(A);
await bounce(A, '2 Pals, iPhone 13'); await A.p.screenshot({ path: shot + 'two-pals-iphone.png' });
await A.p.setViewportSize({ width: 1280, height: 800 });
await bounce(A, '2 Pals, desktop'); await A.p.screenshot({ path: shot + 'two-pals-desktop.png' });
await A.ctx.close();
const { execFileSync } = await import('node:child_process');
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(R.every(Boolean) ? `ALL ${R.length} PASSED` : `${R.filter((x) => !x).length} FAILED of ${R.length}`); await browser.close();
