// Phone-size check of the picture/video check (mediascan.js) with generated SAFE media + mocked scores.
// node tests/ui/vidscan.mjs http://127.0.0.1:PORT/   (needs playwright)
import { createRequire } from 'node:module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const base = process.argv[2]; const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(base + 'tests/ui/vidscan.html'); await p.waitForFunction(() => window.ready);
const out = {};
for (const w of ['image', 'video', 'block', 'review', 'caption']) {
  out[w] = await p.evaluate((w) => window.run(w), w);
  if (w === 'video') out.backend = await p.evaluate(() => window.tf && tf.getBackend());
  await p.screenshot({ path: `/workspace/vidscan-${w}.png`, fullPage: true });
  console.log(w, JSON.stringify(out[w], (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)).slice(0, 600));
}
console.log('backend', out.backend, 'errors', errs.join(' | ') || 'none'); await b.close();
