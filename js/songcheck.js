// Song check for a video or audio file the player is about to post.
// Loaded only from js/sounds.js when that file still has their own audio.
// The browser fingerprints the first two minutes and asks AcoustID if it matches
// a released recording. The file itself never leaves the phone.
// An original, a cover sung in the player's own voice, a Kemy Sound, a miss,
// a timeout, or a lookup problem is posted normally.
import { ACOUSTID_CLIENT_KEY } from './media-config.js';

const LOOKUP = 'https://api.acoustid.org/v2/lookup';
const MAX_SEC = 120;
const MIN_SCORE = 0.85;
export const SONG_MATCH = 'Song match: ';

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Keem's own songs are allowed. A name that merely contains "keem" is not.
export function ownArtist(name) {
  const n = norm(name);
  return n === 'keem' || n === 'lonekeem' || n === 'lonekeemstudios';
}

function clientKey() {
  return String(ACOUSTID_CLIENT_KEY || '').trim();
}

// Highest AcoustID hit that is actually a released recording.
// No release group, a low score, Keem, or a Kemy Sounds track returns null (post it).
export function decideReleased(data, catalog) {
  if (!data || data.status !== 'ok' || !Array.isArray(data.results)) return null;
  const allow = new Set((catalog || []).map((t) => norm(t && t.title) + '\n' + norm(t && t.artist)));
  let top = null;
  for (const r of data.results) {
    const score = Number(r && r.score);
    if (!(score >= 0) || (top && score <= Number(top.score))) continue;
    top = r;
  }
  if (!top || !(Number(top.score) >= MIN_SCORE)) return null;
  const recs = Array.isArray(top.recordings) ? top.recordings : [];
  const rec = recs.find((x) => x && x.title && x.artists && x.artists[0] && x.artists[0].name && Array.isArray(x.releasegroups) && x.releasegroups.length);
  if (!rec) return null;
  const best = { score: Number(top.score), rec };
  const title = clip(best.rec.title, 80);
  const artist = clip(best.rec.artists[0].name, 80);
  if (!title || !artist) return null;
  if (ownArtist(artist) || allow.has(norm(title) + '\n' + norm(artist))) return null;
  return { title, artist, score: best.score };
}

export function songHoldReason(match) {
  return (SONG_MATCH + clip(match.title, 80) + ' by ' + clip(match.artist, 60)).slice(0, 200);
}

export function freeSuggestion(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  const trend = list.filter((t) => t && Number(t.trending) > 0).sort((a, b) => Number(a.trending) - Number(b.trending));
  const t = trend[0] || list[0];
  return t && t.title ? { id: t.id || '', title: t.title, artist: t.artist || '' } : null;
}

let catP = null;
function loadCatalog() {
  if (!catP) {
    catP = fetch(new URL('../data/sounds.json', import.meta.url))
      .then((r) => (r.ok ? r.json() : { tracks: [] }))
      .then((j) => j.tracks || [])
      .catch(() => []);
  }
  return catP;
}

let wasmP = null;
function loadWasm() {
  if (!wasmP) {
    wasmP = import('./vendor/chromaprint/chromaprint.js').then((m) => m.default()).catch((e) => { wasmP = null; throw e; });
  }
  return wasmP;
}

async function monoPcm(file) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('no-audio');
  const ac = new AC();
  try {
    const raw = await file.arrayBuffer();
    const audio = await ac.decodeAudioData(raw.slice(0));
    const rate = audio.sampleRate | 0;
    if (!rate || !audio.length) throw new Error('empty');
    const frames = Math.min(audio.length, Math.floor(rate * MAX_SEC));
    const pcm = new Int16Array(frames);
    const nch = audio.numberOfChannels || 1;
    const chans = [];
    for (let c = 0; c < nch; c++) chans.push(audio.getChannelData(c));
    for (let i = 0; i < frames; i++) {
      let s = 0;
      for (let c = 0; c < nch; c++) s += chans[c][i] || 0;
      s /= nch;
      if (s > 1) s = 1;
      else if (s < -1) s = -1;
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const seconds = Math.max(1, Math.min(86400, Math.round(audio.duration || frames / rate)));
    return { pcm, rate, seconds };
  } finally { ac.close && ac.close(); }
}

async function fingerprintOf(pcm, rate) {
  const Module = await loadWasm();
  const ctx = Module._chromaprint_new(1);
  if (!ctx) throw new Error('fp');
  const ptr = Module._malloc(pcm.length * 2);
  const fpPtr = Module._malloc(4);
  try {
    if (!ptr || !fpPtr || !Module._chromaprint_start(ctx, rate, 1)) throw new Error('start');
    Module.HEAP16.set(pcm, ptr >> 1);
    if (!Module._chromaprint_feed(ctx, ptr, pcm.length)) throw new Error('feed');
    if (!Module._chromaprint_finish(ctx)) throw new Error('finish');
    if (!Module._chromaprint_get_fingerprint(ctx, fpPtr)) throw new Error('get');
    const cstr = Module.HEAP32[fpPtr >> 2];
    const fp = cstr ? Module.UTF8ToString(cstr) : '';
    if (cstr) Module._free(cstr);
    return fp;
  } finally {
    if (fpPtr) Module._free(fpPtr);
    if (ptr) Module._free(ptr);
    Module._chromaprint_free(ctx);
  }
}

async function lookup(fingerprint, seconds, catalog) {
  const body = new URLSearchParams({
    client: clientKey(),
    meta: 'recordings releasegroups',
    duration: String(seconds),
    fingerprint
  });
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
  const res = await fetch(LOOKUP, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal });
  const data = await res.json();
  const hit = decideReleased(data, catalog);
  if (!res.ok || !hit) return null;
  return { ...hit, suggestion: freeSuggestion(catalog) };
}

let chain = Promise.resolve();
function checkSongFile(file) {
  const run = chain.then(() => checkOne(file));
  chain = run.then(() => {}, () => {});
  return run;
}
async function checkOne(file) {
  try {
    if (!file || !clientKey()) return null;
    const catalog = await loadCatalog();
    const { pcm, rate, seconds } = await monoPcm(file);
    if (!pcm.length) return null;
    const fp = await fingerprintOf(pcm, rate);
    if (!fp || fp.length > 20000) return null;
    return await lookup(fp, seconds, catalog);
  } catch { return null; }
}

// "hold" sends the post for review. "cancel" stays in the composer.
export function chooseSongHold(match) {
  const root = document.getElementById('modal-root');
  if (!root) return Promise.resolve('hold');
  const sug = match.suggestion;
  return new Promise((resolve) => {
    root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" data-lock="1"><div class="card modal">
      <p>This audio matches a released song, so it stays off the feed until a moderator checks it.</p>
      <p>Matched: <b>${esc(match.title)}</b> by ${esc(match.artist)}</p>
      ${sug ? `<p>Try a free Kemy Sound instead: <b>${esc(sug.title)}</b> by ${esc(sug.artist)}.</p>` : '<p>Try a free track from Kemy Sounds instead.</p>'}
      <div class="btns">
        <button class="btn" type="button" id="song-use">Use a Kemy Sound instead</button>
        <button class="btn btn-ghost" type="button" id="song-review">Send it for review</button>
      </div>
    </div></div>`;
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('#song-use').onclick = () => done('cancel');
    root.querySelector('#song-review').onclick = () => done('hold');
  });
}

// Always resolves. A problem posts normally. A released-recording match asks first.
export async function reviewSongFile(file) {
  const hit = await checkSongFile(file);
  if (!hit) return { action: 'ok' };
  const choice = await chooseSongHold(hit);
  if (choice === 'cancel') return { action: 'cancel' };
  return { action: 'hold', reason: songHoldReason(hit), suggestion: hit.suggestion || null };
}
