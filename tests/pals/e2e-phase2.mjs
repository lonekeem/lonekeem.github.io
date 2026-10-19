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

async function hatch(X, name, species) {
  await X.p.evaluate(() => { location.hash = '#/me'; }); await X.p.waitForSelector('#pal-crack', { timeout: 20000 });
  for (let i = 0; i < 3; i++) { await X.p.click('#pal-crack'); await X.p.waitForTimeout(250); }
  await X.p.waitForSelector('#pal-form'); if (species) await X.p.click(`[data-species="${species}"]`); await X.p.fill('#pal-name', name); await X.p.click('#pal-form [type=submit]'); await X.p.waitForTimeout(2500);
}
const clearModal = (X) => X.p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; });
const A = await account('a'); await A.p.evaluate(() => localStorage.setItem('kemy-pals-debug', '1'));
await hatch(A, 'Bloop');
// coins + shop
await A.p.evaluate(() => { location.hash = '#/pals/shop'; }); await A.p.waitForSelector('.pal-shop', { timeout: 20000 }); await A.p.waitForTimeout(3000);
await A.p.evaluate(() => { location.hash = '#/feed'; }); await A.p.waitForTimeout(300); await A.p.evaluate(() => { location.hash = '#/pals/shop'; }); await A.p.waitForSelector('.pal-shop'); await A.p.waitForTimeout(1500);
const coins = await A.p.textContent('.pal-coins'); ok('daily bonus gives Star Coins', /50/.test(coins), coins);
await A.p.screenshot({ path: shot + 'shop.png' });
await A.p.click('[data-buy="roundspecs"]'); await A.p.waitForTimeout(3500);
const inv = await (await fetch(`${FS}/users/${A.uid}/inv/roundspecs`)).json(); const wal = await (await fetch(`${FS}/users/${A.uid}/pal/wallet`)).json();
ok('purchase is atomic (item added, 50 coins spent)', inv.fields && wal.fields.coins.integerValue === '0', wal.fields && wal.fields.coins.integerValue);
// closet
await A.p.evaluate(() => { location.hash = '#/pals'; }); await A.p.waitForSelector('[data-c=closet]', { timeout: 15000 }); await A.p.click('[data-c=closet]');
await A.p.waitForSelector('.pal-closet'); await A.p.click('[data-tab=face]'); await A.p.click('[data-wear="roundspecs"]'); await A.p.waitForTimeout(600); await A.p.screenshot({ path: shot + 'closet.png' });
await A.p.click('#cl-save'); await A.p.waitForTimeout(2500);
const pet = await (await fetch(`${FS}/users/${A.uid}/pets/p1`)).json(); ok('outfit saved on the Pal', pet.fields.outfit && pet.fields.outfit.mapValue.fields.face.stringValue === 'roundspecs');
// talk
await A.p.click('[data-c=talk]'); await A.p.waitForSelector('#tk-in', { timeout: 10000 }); await A.p.waitForTimeout(800);
await A.p.fill('#tk-in', 'Hi Bloop! What is your favorite game?'); await A.p.click('#tk-form [type=submit]');
await A.p.waitForFunction(() => { const b = document.querySelector('#tk-bub'); return b && b.textContent && b.textContent !== '…' && document.querySelectorAll('.tk-p').length >= 2; }, null, { timeout: 25000 }).catch(() => {});
const rep = await A.p.textContent('#tk-bub'); ok('Pal replies in chat', rep && rep.length > 3 && rep !== '…', rep); await A.p.waitForTimeout(1000); await A.p.screenshot({ path: shot + 'talk.png' });
await A.p.fill('#tk-in', 'I want to hurt myself'); await A.p.click('#tk-form [type=submit]'); await A.p.waitForTimeout(1500);
const safe = await A.p.textContent('#tk-bub'); ok('self-harm message gets the trusted-adult reply', /trusted adult/i.test(safe), safe.slice(0, 80));
await A.p.click('#tk-voice'); await A.p.waitForSelector('.pal-v'); const nv = await A.p.$$eval('.pal-v', (l) => l.length); ok('voice library has 20+ presets', nv >= 20, String(nv)); await A.p.screenshot({ path: shot + 'voices.png' });
await A.p.click('[data-use="squeaky"]'); await A.p.waitForTimeout(2500);
const pv = await (await fetch(`${FS}/users/${A.uid}/pets/p1`)).json(); ok('voice choice saved per Pal', pv.fields.voice && pv.fields.voice.stringValue === 'squeaky');
await clearModal(A);
// level up to unlock a 2nd egg, hatch it, then switch the active Pal
await A.p.evaluate(() => { location.hash = '#/me'; }); await A.p.waitForSelector('[data-pa=care]'); await A.p.click('[data-pa=care]'); await A.p.waitForSelector('[data-dbg]');
for (let i = 0; i < 7; i++) { await A.p.click('[data-dbg]'); await A.p.waitForTimeout(1300); } await clearModal(A);
await A.p.evaluate(() => { location.hash = '#/pals'; }); await A.p.waitForSelector('.pal-box'); await A.p.waitForTimeout(800);
const egg = await A.p.$('[data-hatch]'); if (egg) { await egg.click(); await A.p.waitForSelector('#pal-form'); await A.p.click('[data-species="elephant"]'); await A.p.fill('#pal-name', 'Toots'); await A.p.click('#pal-form [type=submit]'); await A.p.waitForTimeout(3000); }
await A.p.waitForSelector('[data-act]', { timeout: 10000 }).catch(() => {}); const sw = await A.p.$$('[data-act]'); ok('active Pal switcher shows', sw.length >= 2, String(sw.length));
if (sw.length >= 2) { await A.p.click('[data-act="p2"]'); await A.p.waitForTimeout(2500); const u = await (await fetch(`${FS}/users/${A.uid}`)).json(); ok('switching sets activePet', u.fields.activePet && u.fields.activePet.stringValue === 'p2'); await A.p.screenshot({ path: shot + 'switcher.png' }); }
// Pal Games vs computer
await A.p.evaluate(() => { location.hash = '#/games/pals'; }); await A.p.waitForSelector('.pg-lobby', { timeout: 15000 }); await A.p.screenshot({ path: shot + 'palgames.png' });
await A.p.click('[data-g=stars]'); await A.p.click('[data-m=cpu]'); await A.p.waitForSelector('.pg-cv', { timeout: 10000 });
await A.p.waitForTimeout(2600); { const bb = await (await A.p.$('.pg-cv')).boundingBox(); for (let i = 0; i < 10; i++) { await A.p.mouse.click(bb.x + 40 + i * 25, bb.y + bb.height * 0.85); await A.p.waitForTimeout(800); } }
await A.p.screenshot({ path: shot + 'palgames-stars.png' });
await A.p.waitForSelector('.g-result', { timeout: 40000 }).then(() => ok('Pal Games vs computer finishes with a result', true)).catch(() => ok('Pal Games vs computer finishes with a result', false));
await clearModal(A);
// online Pal Game: A creates a link game, B joins
const B = await account('b'); await hatch(B, 'Puff', 'kitten');
await A.p.evaluate(() => { location.hash = '#/games/pals'; }); await A.p.waitForSelector('[data-m=friend]'); await A.p.click('[data-g=bubbles]'); await A.p.click('[data-m=friend]'); await A.p.click('#pg-friend [type=submit]');
await A.p.waitForSelector('.pg-wait input', { timeout: 15000 }); const link = await A.p.inputValue('.pg-wait input');
await B.p.evaluate((h) => { location.hash = h; }, '#' + link.split('#')[1]);
await Promise.all([A.p.waitForSelector('.pg-cv', { timeout: 20000 }), B.p.waitForSelector('.pg-cv', { timeout: 20000 })]).then(() => ok('friend match starts for both', true)).catch(() => ok('friend match starts for both', false));
await B.p.waitForTimeout(5500); { const bb = await (await B.p.$('.pg-cv')).boundingBox(); for (let i = 0; i < 12; i++) { await B.p.mouse.click(bb.x + bb.width * (0.2 + (i % 4) * 0.2), bb.y + bb.height * (0.8 - i * 0.04)); await A.p.waitForTimeout(700); } }
await A.p.screenshot({ path: shot + 'palgames-online.png' });
await A.p.waitForSelector('.g-result', { timeout: 60000 }).catch(() => {}); await B.p.waitForSelector('.g-result', { timeout: 30000 }).catch(() => {}); await A.p.waitForTimeout(3000);
const sa = await (await fetch(`${FS}/palStats/${A.uid}`)).json(); const sb = await (await fetch(`${FS}/palStats/${B.uid}`)).json();
ok('leaderboard stats recorded for both players', !!(sa.fields && sb.fields), `${sa.fields ? sa.fields.wins.integerValue : '-'} / ${sb.fields ? sb.fields.wins.integerValue : '-'}`);
await clearModal(A); await clearModal(B);
// Pal Park with two players
await A.p.evaluate(() => { location.hash = '#/park'; }); await B.p.evaluate(() => { location.hash = '#/park'; });
await A.p.waitForSelector('#park-cv', { timeout: 20000 }); await B.p.waitForSelector('#park-cv', { timeout: 20000 }); await A.p.waitForTimeout(4000);
await A.p.keyboard.down('ArrowRight'); await A.p.waitForTimeout(1500); await A.p.keyboard.up('ArrowRight');
await A.p.click('#pk-chat'); await A.p.click('[data-say="Nice Pal!"]'); await B.p.waitForTimeout(3000);
const rooms = await B.p.evaluate(async (uid) => { const fs = await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'); const { db } = await import('/js/firebase-init.js'); for (let i = 1; i <= 3; i++) { const s = await fs.getDoc(fs.doc(db, 'parkRooms', 'r' + i, 'p', uid)); if (s.exists()) return s.data(); } return null; }, A.uid);
ok('Park presence visible to the other player (same room, chat bubble)', rooms && rooms.say === 'Nice Pal!', rooms ? `x=${rooms.x}` : 'none');
await B.p.screenshot({ path: shot + 'park.png' }); await A.p.screenshot({ path: shot + 'park-a.png' });
await A.p.evaluate(() => { location.hash = '#/feed'; }); await B.p.evaluate(() => { location.hash = '#/feed'; }); await A.p.waitForTimeout(2000);
await A.ctx.close(); await B.ctx.close();
const { execFileSync } = await import('node:child_process');
console.log(execFileSync('node', [new URL('./cleanup.mjs', import.meta.url).pathname, base], { env: process.env }).toString().trim());
const left = await (await fetch(`${FS}/users/${A.uid}/inv`)).json(); ok('account deletion removed coins/items', !left.documents);
ok('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(R.every(Boolean) ? `ALL ${R.length} PASSED` : `${R.filter((x) => !x).length} FAILED of ${R.length}`); await browser.close();
