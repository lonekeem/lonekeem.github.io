// Deletes the throwaway accounts from the last e2e run (credentials in /tmp/pals-test-cred.json), via the app's own delete flow.
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { readFileSync } from 'node:fs';
const { chromium } = require('playwright'); const { stamp, pass } = JSON.parse(readFileSync('/tmp/pals-test-cred.json'));
const base = (process.argv[2] || 'https://lonekeem.github.io/').replace(/\/?$/, '/');
const b = await chromium.launch();
for (const tag of ['a', 'b']) {
  const p = await (await b.newContext()).newPage();
  await p.goto(base + 'app.html#/login'); await p.waitForSelector('#login-form');
  const ins = await p.$$('#login-form input'); await ins[0].fill(`kemy.pals.test+${tag}${stamp}@example.com`); await ins[1].fill(pass); await p.click('#login-form [type=submit]');
  await p.waitForTimeout(4000); const uid = await p.evaluate(async () => { const u = (await import('/js/firebase-init.js')).auth.currentUser; return u && u.uid; });
  if (!uid) { console.log(tag, 'no such account (already deleted)'); continue; }
  await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/settings'; }); await p.waitForSelector('#s-delete', { timeout: 15000 });
  await p.evaluate(() => (document.getElementById('modal-root').innerHTML = '')); await p.click('#s-delete'); await p.fill('#del-confirm', 'DELETE'); await p.fill('#del-pass', pass); await p.click('#del-go');
  await p.waitForURL(/index\.html/, { timeout: 60000 }); console.log(tag, 'deleted', uid);
}
await b.close();
