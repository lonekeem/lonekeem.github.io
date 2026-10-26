// House TV karaoke lyrics for every Kemy song in theme.js TRACKS (instrumentals show the title + ♪ instrumental ♪).
// Lazy: homes.js imports this file (and fetches one small JSON) only when a TV plays a Kemy song.
// Lyric files: assets/lyrics/<key>.json = { bpm, beats, instrumental?, lines: [{ t: start seconds, e: end seconds, line }] }, timed to
// the original audio (old files were a plain lines array; both load). The same file carries the beat grid the Pals dance to.
// Synced to the TV's own <audio>.currentTime every frame, so pause / seek / loop / track change just follow the audio.
import { trackKey, loadTrack } from '../pals/musicbeat.js';
export function lyricsKey(src) { return trackKey(src); }
// { lines, instrumental } for a song key (one cached fetch per song, shared with the dance beat)
export function loadSong(key) { return loadTrack(key).then((d) => ({ lines: d.lines, instrumental: d.instrumental })); }
export function loadLyrics(key) { return loadSong(key).then((d) => d.lines); }
const NOTE = '♪  ♪  ♪', FADE = 0.4, GAP = 2.5;
// What to show at time `now`: { cur, next, at } where at = when `cur` started (for the slide-in).
export function lyricAt(L, now) {
  let lo = 0, hi = L.length - 1, i = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].t <= now) { i = m; lo = m + 1; } else hi = m - 1; }
  if (i < 0) return { cur: NOTE, next: L[0] ? L[0].line : '', at: 0, i: -1 };
  const l = L[i], n = L[i + 1], end = l.e != null ? l.e : l.t + 6;
  // instrumental break: once a line has finished and the next is still a while away, show notes + the upcoming line
  if (now > end + 1.2 && (!n || n.t - now > GAP)) return { cur: NOTE, next: n ? n.line : '', at: end + 1.2, i: i + 0.5 };
  return { cur: l.line, next: n && n.t - end < 8 ? n.line : '', at: l.t, i };
}
function fit(g, text, max, w, weight, min) { let s = max; g.font = `${weight} ${s}px Inter, Arial, sans-serif`; while (s > min && g.measureText(text).width > w) { s -= 2; g.font = `${weight} ${s}px Inter, Arial, sans-serif`; } return s; }
function wrap(g, text, w) { if (g.measureText(text).width <= w) return [text]; const ws = text.split(' '); let a = '', b = ''; for (let k = 0; k < ws.length; k++) { const tryA = a ? a + ' ' + ws[k] : ws[k]; if (!b && g.measureText(tryA).width <= w) a = tryA; else b = b ? b + ' ' + ws[k] : ws[k]; } return b ? [a, b] : [a]; }
function line(g, text, y, size, weight, color, alpha, glow, w) {
  if (!text || alpha <= 0.01) return; g.globalAlpha = Math.min(1, alpha); const s = fit(g, text, size, w, weight, Math.max(16, size * 0.62)); const ls = wrap(g, text, w);
  g.fillStyle = color; g.shadowColor = glow || 'transparent'; g.shadowBlur = glow ? 16 : 0; const lh = s * 1.08, y0 = y - (ls.length - 1) * lh / 2;
  ls.forEach((t, k) => g.fillText(t, g.canvas.width / 2, y0 + k * lh, w)); g.shadowBlur = 0; g.globalAlpha = 1;
}
const ease = (p) => 1 - Math.pow(1 - p, 3);
// Draws the lyric layer (title on top, current line big + highlighted, next line dimmed below, smooth slide-up).
export function drawLyrics(g, Wc, Hc, L, now, pal, title, sub) {
  if (!L || !L.length) { // instrumental: just the title + a gently pulsing ♪ instrumental ♪
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = pal.main; g.font = '800 19px Inter, Arial, sans-serif'; g.shadowColor = pal.main; g.shadowBlur = 8; g.fillText('🎵 ' + title + (sub ? '  ·  ' + sub : ''), Wc / 2, 30, Wc - 50); g.shadowBlur = 0;
    line(g, title, 112, 38, 900, '#ffffff', 1, pal.alt, Wc - 56);
    line(g, '♪ instrumental ♪', 186, 28, 800, pal.alt, 0.7 + 0.3 * Math.sin(now * 2.4), pal.alt, Wc - 56);
    return { cur: '♪ instrumental ♪', next: '', at: 0, i: -1 };
  }
  const st = lyricAt(L, now), p = ease(Math.max(0, Math.min(1, (now - st.at) / FADE))), w = Wc - 56;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = pal.main; g.font = '800 19px Inter, Arial, sans-serif'; g.shadowColor = pal.main; g.shadowBlur = 8; g.fillText('🎵 ' + title + (sub ? '  ·  ' + sub : ''), Wc / 2, 30, Wc - 50); g.shadowBlur = 0;
  const yC = 112, yN = 192;
  // previous line drifts up and fades out while the new one slides up from the dimmed "next" slot
  if (p < 1 && st.at > 0) { const pv = lyricAt(L, st.at - 0.01); if (pv.cur !== st.cur) line(g, pv.cur, yC - 46 * p, 38, 900, '#ffffff', (1 - p) * 0.9, null, w); }
  line(g, st.cur, yN + (yC - yN) * p, 26 + 12 * p, 900, p > 0.5 ? pal.alt : '#e9d5ff', 0.45 + 0.55 * p, pal.alt, w);
  line(g, st.next, yN + 30 * (1 - p), 24, 700, 'rgba(255,255,255,.5)', p, null, w);
  return st;
}
