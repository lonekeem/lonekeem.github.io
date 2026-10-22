// Decode the on-device Kemy QR (with the center logo) and check share / copy.
// Run: node tests/share/decode-qr.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { SHARE_URL, SHARE_MESSAGE, QR_DARK, QR_LIGHT, qrMatrix, renderSymbol, shareKemy } from '../../js/share-kemy.js';

const require = createRequire(import.meta.url);
const png = PNG.sync.read(fs.readFileSync(new URL('../../kemy-logo.png', import.meta.url)));
const logo = { width: png.width, height: png.height, data: png.data };

// Future Play listing. The live code uses SHARE_URL; this only proves a longer link still scans.
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.lonekeemstudios.kemy';

function lum(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const contrast = (a, b) => {
  const L1 = lum(...a), L2 = lum(...b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
};

function decode(sym) {
  const copy = new Uint8ClampedArray(sym.data);
  return jsQR(copy, sym.width, sym.height, { inversionAttempts: 'attemptBoth' });
}

const src = fs.readFileSync(new URL('../../js/share-kemy.js', import.meta.url), 'utf8');
assert.match(src, /https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.lonekeemstudios\.kemy/);
assert.match(src, /Once the Android app is public on/);
assert.equal(SHARE_URL, 'https://lonekeem.github.io/');
assert.equal(SHARE_MESSAGE, 'Play Kemy: 10+ free games, no ads! 💜');
assert.ok(contrast(QR_DARK, QR_LIGHT) >= 7, 'module contrast ' + contrast(QR_DARK, QR_LIGHT).toFixed(2));

function check(text, label) {
  const matrix = qrMatrix(text);
  const sym = renderSymbol(matrix, { modulePx: 8, logo });
  const code = decode(sym);
  assert.ok(code, label + ' did not scan (version modules ' + matrix.length + ')');
  assert.equal(code.data, text, label);
  console.log(label, 'ok', matrix.length + ' modules', sym.width + 'px');
}

check(SHARE_URL, 'site qr');
check(PLAY_URL, 'play store qr');

// No logo: still the same link, so a missing image cannot hide the address.
{
  const code = decode(renderSymbol(qrMatrix(SHARE_URL), { modulePx: 6 }));
  assert.equal(code && code.data, SHARE_URL);
}

{
  let payload = null;
  const nav = {
    canShare: () => true,
    share: async (d) => { payload = d; }
  };
  const result = await shareKemy({ toast() { throw new Error('share should not toast'); }, nav });
  assert.equal(result, 'shared');
  assert.equal(payload.text, SHARE_MESSAGE);
  assert.equal(payload.url, SHARE_URL);
  assert.equal(payload.title, 'Kemy');
}

{
  let toasted = null, copied = null;
  const nav = { clipboard: { writeText: async (t) => { copied = t; } } };
  const result = await shareKemy({ toast: (m) => { toasted = m; }, nav });
  assert.equal(result, 'copied');
  assert.equal(toasted, 'Link copied!');
  assert.equal(copied, SHARE_URL);
}

{
  const nav = {
    canShare: () => true,
    share: async () => { const e = new Error('nope'); e.name = 'AbortError'; throw e; },
    clipboard: { writeText: async () => { throw new Error('should not copy after cancel'); } }
  };
  assert.equal(await shareKemy({ toast() {}, nav }), 'cancelled');
}

console.log('share and copy ok');

// The saved card is drawn in a browser. Decode that PNG too.
if (process.argv.includes('--card')) {
  const { spawn } = await import('node:child_process');
  const http = await import('node:http');
  const path = await import('node:path');
  const root = path.resolve(new URL('../..', import.meta.url).pathname);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('missing'); return; }
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.png') ? 'image/png' : 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      res.end(buf);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const chrome = '/usr/bin/google-chrome-stable';
  const page = `http://127.0.0.1:${port}/tests/share/harness.html`;
  const out = await new Promise((resolve, reject) => {
    const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=8000', '--dump-dom', page], { stdio: ['ignore', 'pipe', 'pipe'] });
    let body = '', err = '';
    child.stdout.on('data', (d) => { body += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => code === 0 ? resolve(body) : reject(new Error('chrome ' + code + '\n' + err.slice(-500))));
  });
  server.close();
  const m = out.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/);
  assert.ok(m, 'card data url missing:\n' + out.slice(0, 400));
  const card = PNG.sync.read(Buffer.from(m[0].split(',')[1], 'base64'));
  const found = jsQR(new Uint8ClampedArray(card.data), card.width, card.height, { inversionAttempts: 'attemptBoth' });
  assert.ok(found, 'saved card did not scan');
  assert.equal(found.data, SHARE_URL);
  const text = card.data.some((v, i) => i % 4 === 0 && v > 240 && card.data[i + 1] > 180 && card.data[i + 2] < 120);
  assert.ok(text, 'card is missing the gold label');
  fs.writeFileSync('/tmp/kemy-qr-card.png', Buffer.from(m[0].split(',')[1], 'base64'));
  console.log('card png ok', card.width + 'x' + card.height);
}
