import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); const pw = require('playwright');
const b = await pw.webkit.launch(); const out = [];
for (const [name, vp, kb] of [['portrait', { width: 390, height: 664 }, 300], ['landscape', { width: 844, height: 390 }, 210]]) {
  const ctx = await b.newContext({ ...pw.devices['iPhone 13'], viewport: vp }); const p = await ctx.newPage();
  await p.addInitScript((kb) => { const real = window.visualViewport; const et = new EventTarget(); let shrink = 0; const f = { get width() { return innerWidth; }, get height() { return innerHeight - shrink; }, get offsetTop() { return 0; }, get offsetLeft() { return 0; }, get scale() { return 1; }, addEventListener: et.addEventListener.bind(et), removeEventListener: et.removeEventListener.bind(et) };
    Object.defineProperty(window, 'visualViewport', { get: () => f }); window.__kb = (on) => { shrink = on ? kb : 0; et.dispatchEvent(new Event('resize')); }; }, kb);
  await p.goto('http://localhost:8977/tests/ui/kblift.html'); await p.waitForTimeout(500);
  await p.focus('#t'); await p.evaluate(() => window.__kb(true)); await p.keyboard.type('Hi from Maine'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const f = document.getElementById('f').getBoundingClientRect(); const i = getComputedStyle(document.getElementById('t')); return { barBottom: Math.round(f.bottom), kbTop: Math.round(visualViewport.height), lifted: document.getElementById('f').classList.contains('kb-lift'), color: i.color, bg: i.backgroundColor, fs: i.fontSize, val: document.getElementById('t').value }; });
  await p.screenshot({ path: `/workspace/parkhd-kblift-${name}.png` });
  await p.evaluate(() => { document.activeElement.blur(); window.__kb(false); }); await p.waitForTimeout(300);
  r.restored = await p.evaluate(() => !document.getElementById('f').classList.contains('kb-lift') && !document.getElementById('f').style.top);
  out.push({ name, ...r, ok: r.lifted && r.barBottom <= r.kbTop }); await ctx.close(); }
console.log(JSON.stringify(out, null, 1)); await b.close();
