// Song check for video and audio posts. The browser fingerprints the first two minutes
// (mono) and asks AcoustID what song it is. The file itself never leaves the phone.
// A miss, a timeout, or an empty key does not block the post.
import { ACOUSTID_CLIENT_KEY } from './media-config.js';

export const BLOCK_MSG = "🎵 This song belongs to another artist, so it can't be posted on Kemy. Try your own sound or a Kemy Sound instead!";
const LOOKUP = 'https://api.acoustid.org/v2/lookup';
const MAX_SEC = 120;

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Keem's own songs are allowed. Names that only contain "keem" (like someone else's) are not.
function ownArtist(name) {
  const n = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return n === 'keem' || n === 'lonekeem' || n === 'lonekeemstudios';
}

function clientKey() {
  const k = String(ACOUSTID_CLIENT_KEY || '').trim();
  if (k) return k;
  // Local testing only, so the committed key can stay empty until Keem pastes it.
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return String(sessionStorage.getItem('kemy-acoustid-test') || '').trim();
  } catch { /* private mode */ }
  return '';
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
  const ctx = Module._chromaprint_new(1); // algorithm 1 is the AcoustID / fpcalc default
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

async function lookup(fingerprint, seconds) {
  const body = new URLSearchParams({ client: clientKey(), meta: 'recordings', duration: String(seconds), fingerprint });
  const signal = typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined;
  const res = await fetch(LOOKUP, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal });
  const data = await res.json();
  if (!res.ok || !data || data.status !== 'ok') return { unchecked: true };
  const results = Array.isArray(data.results) ? data.results : [];
  let best = null;
  for (const r of results) {
    const score = Number(r && r.score);
    if (!(score >= 0) || (best && score <= best.score)) continue;
    const rec = r.recordings && r.recordings[0];
    best = { score, rec };
  }
  if (!best || !(best.score >= 0.5)) return { ok: true };
  const title = clip(best.rec && best.rec.title, 80) || 'Unknown song';
  const artist = clip(best.rec && best.rec.artists && best.rec.artists[0] && best.rec.artists[0].name, 80) || 'Unknown artist';
  if (ownArtist(artist)) return { ok: true };
  return { block: true, title, artist, score: best.score };
}

// One check at a time. Always resolves: a problem becomes "unchecked", never a block.
let chain = Promise.resolve();
export function checkSongFile(file) {
  const run = chain.then(() => checkOne(file));
  chain = run.then(() => {}, () => {});
  return run;
}
async function checkOne(file) {
  try {
    if (!file || !clientKey()) return { unchecked: true };
    const { pcm, rate, seconds } = await monoPcm(file);
    if (!pcm.length) return { unchecked: true };
    const fp = await fingerprintOf(pcm, rate);
    if (!fp || fp.length > 20000) return { unchecked: true };
    return await lookup(fp, seconds);
  } catch { return { unchecked: true }; }
}

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// true = they say they made it (hold for Keem). false = they picked something else.
export function chooseSongBlock(match) {
  const root = document.getElementById('modal-root');
  if (!root) return Promise.resolve(false);
  return new Promise((resolve) => {
    root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true" data-lock="1"><div class="card modal">
      <p id="song-block-msg">${BLOCK_MSG}</p>
      <p>Matched: <b>${esc(match.title)}</b> by ${esc(match.artist)}</p>
      <div class="btns">
        <button class="btn" type="button" id="song-mine">I made this sound myself</button>
        <button class="btn btn-ghost" type="button" id="song-no">Choose another</button>
      </div>
    </div></div>`;
    const done = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('#song-mine').onclick = () => done(true);
    root.querySelector('#song-no').onclick = () => done(false);
  });
}

export function holdReason(match) {
  return `🎵 Player says they made this sound. Matched “${clip(match.title, 60)}” by ${clip(match.artist, 40)}.`.slice(0, 180);
}

// A claim is not published. Keem approves it from the Review queue, which copies `post` live.
export function claimFields(postId, authorId, by, note, post) {
  return { kind: 'claim', postId, authorId, by, note: String(note || '').slice(0, 180), status: 'open', post };
}

// Fields for songChecks/{postId}. The caller adds createdAt.
export function uncheckedFields(postId, authorId, by) {
  return { kind: 'unchecked', postId, authorId, by, note: 'unchecked', status: 'open' };
}

// Runs the check and, on a match, asks. cancel = don't upload.
export async function reviewSongFile(file) {
  const v = await checkSongFile(file);
  if (v.block) {
    const mine = await chooseSongBlock(v);
    return mine ? { action: 'hold', reason: holdReason(v) } : { action: 'cancel' };
  }
  return v.unchecked ? { action: 'unchecked' } : { action: 'ok' };
}
