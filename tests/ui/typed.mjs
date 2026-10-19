import { createRequire } from 'node:module'; const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [base, tag] = process.argv.slice(2); const b = await chromium.launch();
const res = [];
for (const [name, dev] of [['iphone13', devices['iPhone 13']], ['pixel7', devices['Pixel 7']]]) {
  for (const scheme of ['dark', 'light', 'forced']) {
    const ctx = await b.newContext({ ...dev, colorScheme: scheme === 'forced' ? 'dark' : scheme, forcedColors: scheme === 'forced' ? 'active' : 'none' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + 'tests/ui/typed.html'); await p.waitForFunction(() => window.ready);
    if (scheme !== 'light' || name === 'pixel7') await p.screenshot({ path: `/workspace/typed-${tag}-${name}-${scheme}-forms.png`, fullPage: true });
    const cols = await p.evaluate(() => { const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number); const L = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
  const bgOf = (e) => { for (; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length && (c[3] ?? 1) > .5) return c; } return [0, 0, 0]; };
  const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  return [...document.querySelectorAll('main input, main textarea, main [contenteditable], #tk-in')].map((e) => { const s = getComputedStyle(e); const fg = rgb(s.webkitTextFillColor || s.color); const bg = bgOf(e); const ph = rgb(getComputedStyle(e, '::placeholder').color); return `${e.id || e.className || e.tagName}: text ${cr(fg, bg).toFixed(1)} ph ${cr(ph, bg).toFixed(1)} ${s.fontSize}`; }); });
    res.push([name, scheme, 'forms', cols.join(' | '), errs.join(';')]);
    // talk + simulated keyboard
    await p.goto(base + 'tests/ui/typed.html#talk'); await p.reload(); await p.waitForFunction(() => window.ready); await p.waitForTimeout(400); const er = await p.evaluate(() => window.err); if (er) console.log('ERR', er);
    await p.focus('#tk-in'); await p.keyboard.type('hello pal');
    const vh = dev.viewport.height, kb = Math.round(vh * 0.42);
    await p.setViewportSize({ width: dev.viewport.width, height: vh - kb }); // keyboard shrinks the visual/layout viewport (resizes-content)
    await p.waitForTimeout(500);
    const vis = await p.evaluate(() => { const H = (window.visualViewport || window).height; const r = document.querySelector('#tk-in').getBoundingClientRect(); const log = document.querySelector('#tk-log'); const last = log.lastElementChild.getBoundingClientRect(); const s = getComputedStyle(document.querySelector('#tk-in')); return { inputVisible: r.top >= 0 && r.bottom <= H, lastMsgVisible: last.top >= 0 && last.bottom <= H, color: s.color, bg: s.backgroundColor, fs: s.fontSize, H }; });
    res.push([name, scheme, 'talk-kb', JSON.stringify(vis), errs.join(';')]);
    if (scheme === 'dark') await p.screenshot({ path: `/workspace/typed-${tag}-${name}-talk-keyboard.png` });
    await ctx.close();
  }
}
for (const r of res) console.log(r.join('  '));
await b.close();
