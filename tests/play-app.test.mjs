// Play app detection: TWA referrer, remembered for the tab, admin chip text.
// Run: node tests/play-app.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPlayReferrer, notePlayApp, inPlayApp, playNoted, rememberPlayNoted, playTesterChip, PLAY_PREFIX } from '../js/play-app.js';

const mem = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

assert.equal(isPlayReferrer(PLAY_PREFIX), true);
assert.equal(isPlayReferrer(PLAY_PREFIX + '/'), true);
assert.equal(isPlayReferrer(PLAY_PREFIX + '?x=1'), true);
assert.equal(isPlayReferrer(''), false);
assert.equal(isPlayReferrer('https://kemy.example/'), false);
assert.equal(isPlayReferrer('android-app://com.other.app'), false);
assert.equal(isPlayReferrer(PLAY_PREFIX + '.evil'), false);
assert.equal(isPlayReferrer('android-app://com.lonekeemstudios.kemyextra'), false);

const fresh = mem();
assert.equal(notePlayApp('https://lonekeem.github.io/', fresh), false);
assert.equal(inPlayApp(fresh), false);
assert.equal(notePlayApp(PLAY_PREFIX, fresh), true);
assert.equal(inPlayApp(fresh), true);
assert.equal(notePlayApp('', fresh), true, 'a later page with no referrer stays in the Play app');

const other = mem();
notePlayApp('android-app://com.lonekeemstudios.kemy.fake', other);
assert.equal(inPlayApp(other), false);

assert.equal(playNoted(fresh), false);
rememberPlayNoted(fresh);
assert.equal(playNoted(fresh), true);

assert.equal(playTesterChip(true), '<span class="nm-play">Play tester</span>');
assert.equal(playTesterChip(false), '');
assert.equal(playTesterChip(undefined), '');

const members = readFileSync(new URL('../js/members.js', import.meta.url), 'utf8');
const devices = readFileSync(new URL('../js/devices.js', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
assert.match(members, /playTesterChip\(m\.playApp\)/);
assert.match(members, /Play app: /);
assert.match(members, /countWhere\('playApp', '==', true\)/);
assert.match(devices, /playApp: true, playAppSeen: serverTimestamp\(\)/);
assert.match(devices, /inPlayApp\(\) && !playNoted\(\)/);
assert.doesNotMatch(devices, /getDoc\(doc\(db, 'members'/);
assert.match(rules, /'playApp', 'playAppSeen'/);
assert.match(readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /const CACHE = 'lks-v288'/);

console.log('play-app tests passed');
