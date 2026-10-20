// Deletes the co-op test accounts (logins in /workspace/zombie-coop-logins.json) through the app's own delete flow.
import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);
import { readFileSync } from 'node:fs';
const { chromium } = require('playwright'); const { stamp, pass, tags, base } = JSON.parse(readFileSync(process.argv[2] || '/workspace/zombie-coop-logins.json'));
const b = await chromium.launch();
for (const tag of tags) {
  const p = await (await b.newContext()).newPage();
  try { await p.goto(base + 'app.html#/login'); await p.waitForSelector('#login-form');
    const ins = await p.$$('#login-form input'); await ins[0].fill(`kemy.pals.test+${tag}${stamp}@example.com`); await ins[1].fill(pass); await p.click('#login-form [type=submit]');
    await p.waitForTimeout(4000); const uid = await p.evaluate(async () => { const u = (await import('/js/firebase-init.js')).auth.currentUser; return u && u.uid; });
    if (!uid) { console.log(tag, 'no such account (already deleted)'); continue; }
    await p.evaluate(() => { document.getElementById('modal-root').innerHTML = ''; location.hash = '#/settings'; }); await p.waitForSelector('#s-delete', { timeout: 15000 });
    await p.evaluate(() => (document.getElementById('modal-root').innerHTML = '')); await p.click('#s-delete'); await p.waitForSelector('#del-confirm'); await p.waitForTimeout(800); await p.fill('#del-confirm', 'DELETE'); await p.fill('#del-pass', pass);
    await p.evaluate(() => { const i = document.getElementById('del-confirm'); i.dispatchEvent(new Event('input', { bubbles: true })); const g = document.getElementById('del-go'); g.disabled = false; document.getElementById('del-form').requestSubmit(g); });
    await p.waitForURL(/index\.html/, { timeout: 60000 }); console.log(tag, 'deleted', uid);
  } catch (e) { console.log(tag, 'cleanup error', e.message.split('\n')[0]); }
}
await b.close();
