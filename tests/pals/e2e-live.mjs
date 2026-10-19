// Live Kemy Pals test with two throwaway accounts (both deleted at the end).
// NODE_PATH=<playwright dir> node tests/pals/e2e-live.mjs [base] [shotPrefix]
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/'); const shot = process.argv[3] || '/workspace/pets-';
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
const A = await account('a');
await A.p.evaluate(() => { localStorage.setItem('kemy-pals-debug', '1'); location.hash = '#/me'; });
await A.p.waitForSelector('.pal-intro', { timeout: 15000 }); ok('Meet your Pal egg intro appears for a new user', true);
await A.p.waitForTimeout(800); await A.p.screenshot({ path: shot + 'hatch.png' });
for (let i = 0; i < 3; i++) { await A.p.click('#pal-crack'); await A.p.waitForTimeout(250); }
await A.p.waitForSelector('#pal-form', { timeout: 5000 }); ok('egg hatches into the creator', true);
await A.p.fill('#pal-name', 'Bloop'); await A.p.click('[data-body="#cfe3ff"]'); await A.p.click('[data-accent="#ff7ab8"]'); await A.p.click('[data-pattern="sparkle"]'); await A.p.click('[data-acc="crown"]');
await A.p.waitForTimeout(400); await A.p.screenshot({ path: shot + 'creator.png' });
await A.p.click('#pal-form [type=submit]'); await A.p.waitForTimeout(2500);
const pet = await (await fetch(`${FS}/users/${A.uid}/pets/p1`)).json();
ok('pet saved to Firestore with custom look', pet.fields && pet.fields.name.stringValue === 'Bloop' && pet.fields.acc.stringValue === 'crown', pet.fields ? pet.fields.colors.mapValue.fields.body.stringValue : JSON.stringify(pet).slice(0, 200));
await A.p.evaluate(() => { location.hash = '#/feed'; }); await A.p.waitForTimeout(500); await A.p.evaluate(() => { location.hash = '#/me'; });
await A.p.waitForSelector('.pal-strip canvas', { timeout: 15000 }); await A.p.waitForTimeout(1500); ok('Pal shows next to the profile', true);
await A.p.screenshot({ path: shot + 'profile.png' });
// care sheet
await A.p.click('[data-pa=care]'); await A.p.waitForSelector('.pal-sheet canvas');
const cv = await A.p.$('.pal-scene canvas'); const bb = await cv.boundingBox(); const cx = bb.x + bb.width / 2, cy = bb.y + bb.height - 75;
await A.p.mouse.click(cx, cy); await A.p.waitForTimeout(400); ok('tap reaction', true);
await A.p.click('[data-m=shower]');
await A.p.mouse.move(cx - 40, cy); await A.p.mouse.down();
for (let i = 0; i < 160; i++) await A.p.mouse.move(cx + Math.sin(i * 0.4) * 45, cy + Math.cos(i * 0.3) * 30, { steps: 1 });
await A.p.mouse.up(); await A.p.screenshot({ path: shot + 'shower.png' });
const rinseHint = await A.p.textContent('.pal-hint'); ok('lather fills up', /rinse|shakes|clean/i.test(rinseHint), rinseHint);
await A.p.mouse.move(cx, bb.y + 30); await A.p.mouse.down();
for (let r = 0; r < 12; r++) for (let i = 0; i < 30; i++) { await A.p.mouse.move(cx - 70 + i * 4.6, bb.y + 30); await A.p.waitForTimeout(16); }
await A.p.mouse.up(); await A.p.waitForTimeout(2600);
const afterShower = await A.p.textContent('.pal-hint'); ok('rinse + shake dry finishes the shower', /clean|shakes/i.test(afterShower), afterShower);
await A.p.screenshot({ path: shot + 'after-shower.png' });
// feed: drag snack to mouth
await A.p.click('[data-m=feed]'); await A.p.waitForTimeout(200);
await A.p.mouse.move(bb.x + 40, bb.y + 26); await A.p.mouse.down(); await A.p.mouse.move(bb.x + bb.width / 2 + 4, bb.y + bb.height - 30 - 42, { steps: 12 }); await A.p.mouse.up(); await A.p.waitForTimeout(600);
const fed = await A.p.textContent('.pal-hint'); ok('feeding by dragging a snack', /yum|treat/i.test(fed), fed);
// debug XP to glow up (level 5)
for (let i = 0; i < 9 && !(await A.p.$('.pal-glow')); i++) { await A.p.click('[data-dbg]'); await A.p.waitForTimeout(1400); }
const glow = await A.p.$('.pal-glow'); if (glow) { await A.p.waitForTimeout(1800); await A.p.screenshot({ path: shot + 'glowup.png' }); }
ok('evolution (glow up) via test XP grant', !!glow);
const pet2 = await (await fetch(`${FS}/users/${A.uid}/pets/p1`)).json(); ok('level stored', +pet2.fields.level.integerValue >= 5, 'level ' + pet2.fields.level.integerValue);
// gallery + mystery/species count
await A.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/pals/gallery'; }); await A.p.waitForSelector('.pal-gal'); await A.p.waitForTimeout(1200);
const gc = await A.p.textContent('.pal-count'); ok('Pal Gallery with collected count', /1\/30/.test(gc), gc); await A.p.screenshot({ path: shot + 'gallery.png', fullPage: false });
// pop-up test
await A.p.evaluate(() => { location.hash = '#/pals'; }); await A.p.waitForSelector('#pal-poptest'); await A.p.click('#pal-poptest'); await A.p.waitForSelector('.pal-pop', { timeout: 8000 }); await A.p.waitForTimeout(900);
await A.p.screenshot({ path: shot + 'popup.png' }); await A.p.click('.pal-pop'); await A.p.waitForTimeout(900); ok('scroll pop-up shows and poofs away on tap', !(await A.p.$('.pal-pop')));
// A goes live (YouTube big live) -> Pal overlay
await A.p.evaluate(() => { location.hash = '#/live/new'; }); await A.p.waitForSelector('[data-mode=yt]', { timeout: 15000 }); await A.p.click('[data-mode=yt]');
await A.p.fill('#lv-yt', 'https://youtu.be/jNQXAC9IVRw'); await A.p.click('#lv-yt-start');
let liveId = null; try { await A.p.waitForSelector('.pal-live canvas', { timeout: 20000 }); liveId = (await A.p.evaluate(() => location.hash)).split('/').pop(); await A.p.waitForTimeout(1500); await A.p.screenshot({ path: shot + 'live-host.png' }); } catch {}
ok('host Pal appears on the live screen', !!liveId, liveId || '');
// visitor B: hatch own Pal, then visit A's profile
const B = await account('b');
await B.p.waitForSelector('#pal-crack', { timeout: 15000 }).catch(() => {}); await B.p.evaluate(() => { location.hash = '#/me'; }); await B.p.waitForSelector('#pal-crack', { timeout: 15000 });
for (let i = 0; i < 3; i++) { await B.p.click('#pal-crack'); await B.p.waitForTimeout(250); }
await B.p.waitForSelector('#pal-form'); await B.p.click('[data-species="elephant"]'); await B.p.fill('#pal-name', 'Toots'); await B.p.click('#pal-form [type=submit]'); await B.p.waitForTimeout(2500);
if (liveId) { await B.p.evaluate((id) => { location.hash = '#/live/' + id; }, liveId); const seen = await B.p.waitForSelector('.pal-live canvas', { timeout: 20000 }).then(() => true).catch(() => false); ok('viewers see the host Pal on the live', seen); if (seen) { await B.p.waitForTimeout(1200); await B.p.screenshot({ path: shot + 'live-viewer.png' }); } }
await B.p.evaluate((u) => { location.hash = '#/u/' + u; }, A.user); await B.p.waitForSelector('.pal-strip [data-pa=pat]', { timeout: 15000 });
await B.p.waitForTimeout(1500); if (await B.p.$('#pal-skip')) await B.p.click('#pal-skip');
await B.p.click('[data-pa=pat]'); await B.p.waitForTimeout(2500);
const pats = await B.p.textContent('.pal-pats b'); ok('visitor pat counted', pats === '1', 'pats=' + pats);
await B.p.click('[data-pa=pat]'); await B.p.waitForTimeout(2000);
const pats2 = (await (await fetch(`${FS}/users/${A.uid}/pets/p1`)).json()).fields.pats.integerValue; ok('second pat same day is refused', pats2 === '1', 'pats=' + pats2);
await B.p.click('[data-pa=bring]'); await B.p.waitForTimeout(3500); await B.p.screenshot({ path: shot + 'playdate.png' });
await B.p.waitForTimeout(3500);
const pd = await (await fetch(`${FS}/users/${A.uid}/pets/p1/playdates/${B.uid}`)).json(); ok('play date recorded (once per pair per day)', !!pd.fields, pd.fields ? pd.fields.pet.stringValue : JSON.stringify(pd).slice(0, 100));
const notes = await A.p.evaluate(async (uid) => { const fs = await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'); const { db } = await import('/js/firebase-init.js'); const s = await fs.getDocs(fs.collection(db, 'users', uid, 'notifications')); return s.docs.map((d) => d.data().type); }, A.uid);
ok('owner notified of pat and play date', notes.includes('pal_pat') && notes.includes('pal_play'), notes.join(','));
await A.ctx.close(); await B.ctx.close();
// delete both accounts (desktop viewport; uses the app's own delete flow)
const { execFileSync } = await import('node:child_process');
const out = execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString(); console.log(out.trim());
const left = await (await fetch(`${FS}/users/${A.uid}/pets`)).json(); const leftP = await (await fetch(`${FS}/users/${A.uid}/pets/p1/pats`)).json(); const leftD = await (await fetch(`${FS}/users/${A.uid}/pets/p1/playdates`)).json();
ok('account deletion removed pets, pats and play dates', !left.documents && !leftP.documents && !leftD.documents);
ok('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close(); console.log(R.every(Boolean) ? `ALL ${R.length} PASSED` : `${R.filter((x) => !x).length} FAILED`);
