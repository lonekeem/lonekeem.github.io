// Music beat: which song is playing right now (theme player, game radio or a house TV) and where its beat is.
// Players add their <audio> to a tiny global Set (window.__kemyAud) with one line, so nothing new loads on the feed.
// Beat grids are measured offline (librosa beat tracking) and live in the same lazy JSON as the TV lyrics:
// assets/lyrics/<key>.json = { bpm, beats: [seconds…], instrumental?, lines: [{ t, e, line }] } (old files: a plain lines array).
// A song's file is fetched only the first time it plays. Unknown songs (links, community uploads) use a steady 112 bpm.
// Written by Lone Keem.
export const DEFAULT_BPM = 112;
// audio file name -> lyrics / beat key (every song in theme.js TRACKS + the game radio stations)
export const FILES = {
  'kemy-theme.m4a': 'kemy-on-the-screen', 'kemy-theme3.m4a': 'time', 'kemy-theme4.m4a': 'keep-me-alive', 'kemy-theme5.m4a': 'youre-the-one',
  'another-week.mp3': 'another-week', 'walked-away.m4a': 'walked-away', 'keep-going.m4a': 'keep-going', 'not-a-common-person.m4a': 'not-a-common-person',
  'day-dreaming.m4a': 'day-dreaming', 'empty-home.m4a': 'empty-home', 'stand-tall.m4a': 'stand-tall', 'stand-up-strong.m4a': 'stand-up-strong', 'stand-up.m4a': 'stand-up',
  'keep-building.mp3': 'keep-building', 'theme-song-2.mp3': 'kemy-song-2', 'theme-song-3.mp3': 'kemy-song-3'
};
const GAME = /^((chill|hype|lofi|adv)-[a-z0-9-]+)\.m4a$/; // game radio: key = file stem
export function fileOf(src) { try { return decodeURIComponent(String(src || '').split('?')[0].split('#')[0].split('/').pop()); } catch { return ''; } }
export function trackKey(src) { const f = fileOf(src); if (FILES[f]) return FILES[f]; const m = GAME.exec(f); return m ? m[1] : null; }
export const VER = 2;
const cache = new Map(); // key -> Promise<{ bpm, beats, instrumental, lines }>
const ready = new Map(); // key -> resolved data (for the per-frame beat)
function norm(d) {
  const lines = (Array.isArray(d) ? d : (d && Array.isArray(d.lines) ? d.lines : [])).filter((l) => l && typeof l.t === 'number' && l.line).sort((x, y) => x.t - y.t);
  const beats = d && Array.isArray(d.beats) ? d.beats.filter((x) => typeof x === 'number') : [];
  const bpm = d && d.bpm > 40 && d.bpm < 220 ? +d.bpm : DEFAULT_BPM;
  return { bpm, beats, lines, instrumental: !!(d && d.instrumental) };
}
export function loadTrack(key) {
  if (!key) return Promise.resolve(norm(null));
  if (!cache.has(key)) cache.set(key, fetch(new URL(`../../assets/lyrics/${key}.json?v=${VER}`, import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((d) => { const n = norm(d); ready.set(key, n); return n; }).catch(() => { cache.delete(key); return norm(null); }));
  return cache.get(key);
}
// beat number at time t (seconds) from a measured grid; steady tempo before the first / after the last beat
export function beatAt(d, t) {
  const B = d && d.beats, bpm = (d && d.bpm) || DEFAULT_BPM, per = 60 / bpm;
  if (!B || B.length < 2) return t / per;
  if (t <= B[0]) return (t - B[0]) / per;
  const n = B.length - 1; if (t >= B[n]) return n + (t - B[n]) / per;
  let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (B[m] <= t) lo = m; else hi = m; }
  return lo + (t - B[lo]) / Math.max(0.05, B[lo + 1] - B[lo]);
}
const REG = () => (window.__kemyAud || (window.__kemyAud = new Set()));
export function registerAudio(el) { if (el && !REG().has(el)) { REG().add(el); if (el.addEventListener) el.addEventListener('playing', () => { el.__kbAt = performance.now(); }); } return el; }
export function unregisterAudio(el) { if (el) REG().delete(el); }
// the music that is audibly playing now (if two are, the one that started last)
export function playingAudio() {
  let best = null, bt = -1;
  for (const a of REG()) {
    try {
      if (!a || a.paused || a.muted || a.volume === 0 || a.ended || (a.dataset && a.dataset.stopping)) continue;
      if (a instanceof HTMLMediaElement && (a.readyState < 2 || !(a.currentTime > 0))) continue;
      const at = a.__kbAt || 0; if (at > bt) { bt = at; best = a; }
    } catch { /* */ }
  }
  return best;
}
// { on, beat, bpm, key }: beat is a running beat count synced to the playing song's audio time
export function musicBeat() {
  const a = playingAudio();
  if (!a) return { on: false, beat: performance.now() / 1000 * DEFAULT_BPM / 60, bpm: DEFAULT_BPM, key: null };
  if (a.embed) return { on: true, beat: performance.now() / 1000 * DEFAULT_BPM / 60, bpm: DEFAULT_BPM, key: null };
  const key = trackKey(a.currentSrc || a.src); if (key && !cache.has(key)) loadTrack(key);
  const d = key && ready.get(key);
  return { on: true, beat: beatAt(d, a.currentTime || 0), bpm: d ? d.bpm : DEFAULT_BPM, key };
}
