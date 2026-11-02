// Shared helpers for emulator-only e2e tests. Never point these at the live site.
// CHROME / PW_EXE = browser path (optional). EMU_FS / EMU_AUTH = emulator ports when 8199/9199 are busy.
import { createRequire } from 'node:module';
export function playwright() { for (const from of [import.meta.url, '/workspace/pw/']) { try { return createRequire(from)('playwright'); } catch { /* next */ } } throw new Error('playwright not found'); }
export const exe = () => process.env.CHROME || process.env.PW_EXE || undefined;
export const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
export function assertLocal(base) { if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(base)) throw new Error('emulator tests only run against localhost, got ' + base); }
// Context that talks to the local Firebase emulators (kemy-emu flag + optional port rewrite).
export async function emuContext(browser, opts = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.addInitScript(() => { try { localStorage.setItem('kemy-emu', '1'); localStorage.setItem('kemy-welcome-seen-v1', '1'); } catch { /* */ } setInterval(() => document.getElementById('age-honest-ok')?.click(), 400); });
  const FS = process.env.EMU_FS || '8199', AU = process.env.EMU_AUTH || '9199';
  if (FS !== '8199' || AU !== '9199') await ctx.route('**/js/firebase-init.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace("'127.0.0.1', 8199", `'127.0.0.1', ${FS}`).replace('127.0.0.1:9199', '127.0.0.1:' + AU) }); });
  return ctx;
}
// Current sign-up form: notice, birthday first (reveals the name box), then the fields and agree boxes.
export async function signup(p, { name, user, email, pass }) {
  await p.waitForSelector('#signup-form'); await p.waitForTimeout(800); await p.getByText('I understand').click({ timeout: 4000 }).catch(() => {}); await p.waitForTimeout(400);
  await p.selectOption('#sbd-m', '1'); await p.selectOption('#sbd-y', { index: 20 }); await p.dispatchEvent('#sbd-y', 'change'); await p.waitForTimeout(500);
  await p.fill('#p-name', name); await p.fill('#p-user', user); await p.fill('#p-email', email); await p.fill('#p-pass', pass);
  { const sels = await p.$$('select.bd-sel'); if (sels.length === 2) { await sels[0].selectOption('1'); await sels[1].selectOption({ index: 20 }); } }
  await p.evaluate(() => document.querySelectorAll('#signup-form input[type=checkbox]').forEach((c) => { c.checked = true; }));
}
