// No player ever sees a "you're going too fast" note. Run: node --test tests/writes/no-speed-text.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'vendor') walk(p); } else if (/\.(js|html)$/.test(f)) files.push(p); } };
walk('js'); for (const f of readdirSync('.')) if (/\.html$/.test(f)) files.push(f);
const BANNED = [/going a little fast/i, /slow down a bit/i, /slow down a little/i, /You can post once every/i, /You can send again in/i, /wait a few seconds between/i, /following lots of people really fast/i];
test('speed-blaming text is gone from every page and script', () => {
  assert.ok(files.length > 50);
  const hits = [];
  for (const f of files) { const s = readFileSync(f, 'utf8'); for (const re of BANNED) if (re.test(s)) hits.push(`${f}: ${re}`); }
  assert.deepEqual(hits, []);
});
test('permission-denied reads calm and never mentions speed', () => {
  const s = readFileSync('js/app.js', 'utf8');
  const m = s.match(/'permission-denied': '([^']*)'/); assert.ok(m);
  assert.doesNotMatch(m[1], /fast|slow|wait|second/i);
});
test('every Firestore write module goes through the pacing shim', () => {
  const direct = files.filter((f) => !/js[\\/](fsq|fs-cache|firebase-init)\.js$/.test(f) && /firebasejs\/[\d.]+\/firebase-firestore\.js/.test(readFileSync(f, 'utf8')) && f.startsWith('js'));
  assert.deepEqual(direct, []);
});
