// 🎬 Lone Keem Studio movie showings: "The Sheriff of Lone Keem" (all released episodes back to back) on the big curved screen.
// Lazy: theater.js imports this only near the theater, and the <video> is created only while you are INSIDE (unloaded on leave).
// Sync needs no writes and no rules change: every client computes the same timeline from the clock.
//   One cycle = CYCLE s: the movie, a short "Thanks for watching" card, then a 5:00 "Next showing in m:ss" countdown.
//   Default cycles line up with the clock (countdowns at :00 :15 :30 :45, shows at :05 :20 :35 :50 local time).
//   The owner can restart the cycle (pl.ma = anchor ms) or switch showtimes off (pl.mo) from the editor: both ride in
//   the existing `pl` map of theater/lone-keem-studio, which the rules already allow for the owner.
// Late joiners seek straight to the right spot in the right episode. A playing song (owner Play) overrides the movie.
import { SHERIFF_EPISODES, isOut } from '../sheriff-data.js';

const DIR = new URL('../../assets/series/sheriff/', import.meta.url).href;
export const MOVIE = { title: 'The Sheriff of Lone Keem', poster: DIR + 'ep1.webp', hero: DIR + 'hero.webp' };
const EPS = SHERIFF_EPISODES.filter(isOut).map((e) => ({ n: e.n, title: e.title, dur: e.dur, src: `${DIR}ep${e.n}.mp4` }));
export const MOVIE_LEN = EPS.reduce((a, e) => a + e.dur, 0); // ~583.4 s
export const COUNTDOWN = 300; // "starts in five minutes"
export const CYCLE = Math.max(900, Math.ceil((MOVIE_LEN + COUNTDOWN + 8) / 60) * 60); // 900 s = 15 min while the movie is under ~9:52
const mod = (a, n) => ((a % n) + n) % n;

// where everyone is on the shared timeline. anchor = ms when a countdown started (any cycle-aligned value works).
export function showAt(nowMs, anchor = 0, off = false) {
  if (off || !EPS.length) return { phase: 'off' };
  const C = CYCLE * 1000, ph = mod(nowMs - anchor, C) / 1000, cStart = nowMs - ph * 1000; // start of this cycle's countdown
  if (ph < COUNTDOWN) { const start = cStart + COUNTDOWN * 1000; return { phase: 'count', left: COUNTDOWN - ph, start, end: start + MOVIE_LEN * 1000 }; }
  const start = cStart + COUNTDOWN * 1000, t = ph - COUNTDOWN, next = cStart + C + COUNTDOWN * 1000;
  if (t >= MOVIE_LEN) return { phase: 'end', start, end: start + MOVIE_LEN * 1000, next, left: (next - nowMs) / 1000 - COUNTDOWN };
  let k = 0, o = 0; while (k < EPS.length - 1 && t >= o + EPS[k].dur) { o += EPS[k].dur; k++; }
  return { phase: 'movie', t, ep: k, epT: t - o, epLeft: o + EPS[k].dur - t, left: MOVIE_LEN - t, start, end: start + MOVIE_LEN * 1000, next };
}
export const clockStr = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const episodes = () => EPS;

// The player: one <video> (never duplicated: it streams the same files as the series page) on ONE full-width curved panel
// in front of the screen. The episodes are portrait 720x1156 and the screen is ~2.4:1, so a cover-crop would cut faces:
// instead a tiny shader draws the sharp film full-height in the centre and fills both sides edge to edge with a zoomed,
// blurred, darkened copy of the same frame (same texture, no second decode, no stretching).
const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FS = `uniform sampler2D map; uniform float cw, zy, dim; varying vec2 vUv;
vec3 tap(vec2 p) { return texture2D(map, clamp(p, vec2(0.002), vec2(0.998))).rgb; }
void main() {
  float x = 1.0 - vUv.x, y = vUv.y, d = abs(x - 0.5) - cw * 0.5; vec3 c;
  if (d <= 0.0) c = tap(vec2((x - 0.5) / cw + 0.5, y));
  else { // side fill: the frame scaled to cover the full width (so it is magnified, never squashed), soft 13-tap blur
    vec2 p = vec2(x, 0.5 + (y - 0.5) * zy), r = vec2(0.022, 0.022 * zy * 2.4);
    c = tap(p) * 0.2;
    c += (tap(p + vec2(r.x, 0.0)) + tap(p - vec2(r.x, 0.0)) + tap(p + vec2(0.0, r.y)) + tap(p - vec2(0.0, r.y))) * 0.1;
    c += (tap(p + r) + tap(p - r) + tap(p + vec2(r.x, -r.y)) + tap(p + vec2(-r.x, r.y))) * 0.075;
    c += (tap(p + vec2(2.0 * r.x, 0.0)) + tap(p - vec2(2.0 * r.x, 0.0)) + tap(p + vec2(0.0, 2.0 * r.y)) + tap(p - vec2(0.0, 2.0 * r.y))) * 0.025;
    c *= dim * (0.55 + 0.45 * smoothstep(0.0, 0.035, d)); // a soft shadow where the sharp film begins
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;
export function createMoviePlayer(THREE, ib, { IN, LOW, onBlocked }) {
  const S = IN.SCR, ar = 720 / 1156, th = S.w / S.R; // full screen width, same arc as the screen itself
  const geo = new THREE.CylinderGeometry(S.R - 0.03, S.R - 0.03, S.h, 40, 1, true, Math.PI - th / 2, th);
  let video = null, tex = null, cur = -1, blocked = false, upT = 0, lastSeek = 0, wantSound = false;
  const uni = { map: { value: null }, cw: { value: (S.h * ar) / S.w }, zy: { value: (S.h * ar) / S.w }, dim: { value: 0.42 } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(ib.screen.position); mesh.visible = false; ib.screen.parent.add(mesh);
  function ensure() {
    if (video) return video; video = document.createElement('video');
    video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.preload = 'auto'; video.crossOrigin = 'anonymous'; video.muted = true; video.disablePictureInPicture = true;
    video.width = 720; video.height = 1156; // three r170 sizes the texture from .width/.height (0 on a <video> by default -> black)
    tex = new THREE.Texture(video); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
    uni.map.value = tex; return video;
  }
  function tryPlay() { const v = video; if (!v || !v.paused) return; v.play().catch(() => { if (!v.muted) { v.muted = true; setBlocked(true); v.play().catch(() => {}); } }); }
  function setBlocked(b) { if (b !== blocked) { blocked = b; onBlocked && onBlocked(b); } }
  // per frame while inside. sh = showAt(); aud = in the auditorium (sound on + texture updates), lobby = muted
  function update(sh, aud, dt) {
    if (!sh || sh.phase !== 'movie') { mesh.visible = false; if (video && !video.paused) video.pause();
      if (sh && sh.phase === 'count' && sh.left < 20 && cur !== 0) load(0, 0); // buffer episode 1 just before the show
      return; }
    const v = ensure(); if (cur !== sh.ep) load(sh.ep, sh.epT);
    wantSound = aud; const mute = !aud || blocked; if (v.muted !== mute) { v.muted = mute; }
    const nowP = performance.now();
    if (v.readyState >= 1 && Math.abs(v.currentTime - sh.epT) > 1.5 && nowP - lastSeek > 2500 && sh.epLeft > 1) { lastSeek = nowP; try { v.currentTime = sh.epT; } catch { /* */ } }
    if (v.paused && !v.ended && sh.epLeft > 0.3) tryPlay();
    mesh.visible = v.readyState >= 2;
    if (aud && mesh.visible && (upT -= dt) <= 0) { upT = LOW ? 1 / 15 : 1 / 30; tex.needsUpdate = true; } // only upload frames you can see
  }
  function load(k, at) { const v = ensure(), e = EPS[k]; if (!e) return; cur = k; v.src = e.src; try { v.currentTime = at || 0; } catch { /* */ } lastSeek = performance.now();
    v.addEventListener('loadedmetadata', () => { if (at > 0.5) try { v.currentTime = at + (performance.now() - lastSeek) / 1000; } catch { /* */ } }, { once: true }); }
  function unlockSound() { setBlocked(false); if (video) { video.muted = !wantSound; video.play().catch(() => { video.muted = true; setBlocked(true); video.play().catch(() => {}); }); } }
  // leave / destroy: stop the download and free the decoder
  function unload() { if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* */ } } cur = -1; mesh.visible = false; }
  function dispose() { unload(); mesh.removeFromParent(); geo.dispose(); mat.dispose(); if (tex) tex.dispose(); video = null; tex = null; }
  return { update, unload, dispose, unlockSound, get blocked() { return blocked; }, get video() { return video; }, mesh };
}

// --- canvases (screen around the film, countdown screen, lobby "Now Showing" stand)
const img = (src) => { const i = new Image(); i.decoding = 'async'; i.src = src; return i; };
let POSTER = null, HERO = null; const art = () => { if (!POSTER) { POSTER = img(MOVIE.poster); HERO = img(MOVIE.hero); } return { poster: POSTER, hero: HERO }; };
const ok = (i) => i && i.complete && i.naturalWidth > 0;
function cover(g, im, x, y, w, h) { const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / s, sh = h / s; g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h); }
const F = (wt, px) => `${wt} ${Math.round(px)}px Inter, Arial, sans-serif`;
// whole screen (canvas is mirrored onto the curved screen by its texture). Returns true when it drew.
export function drawMovieScreen(g, w, h, sh, now) {
  const { poster, hero } = art(); g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (sh.phase === 'movie') { // dark curtains around the tall film + quiet titles at the sides
    g.fillStyle = '#050304'; g.fillRect(0, 0, w, h); const e = EPS[sh.ep], cx = w / 2, vw = h * 720 / 1156;
    const gr = g.createRadialGradient(cx, h / 2, vw * 0.4, cx, h / 2, w * 0.55); gr.addColorStop(0, 'rgba(120,70,20,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(212,175,55,.55)'; g.font = F(900, h * 0.07); g.fillText('THE SHERIFF', w * 0.2, h * 0.42, w * 0.3); g.fillText('OF LONE KEEM', w * 0.2, h * 0.52, w * 0.3);
    g.fillStyle = 'rgba(243,227,195,.45)'; g.font = F(700, h * 0.045); g.fillText(`Episode ${e.n}`, w * 0.8, h * 0.42, w * 0.3); g.fillText(e.title, w * 0.8, h * 0.5, w * 0.3);
    return true;
  }
  // countdown / thanks: poster art left + big clock
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0610'); gr.addColorStop(1, '#0d0204'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.25; for (let i = 0; i < 30; i++) { const x = (i * 97.3 + now * 7 * (1 + (i % 3))) % w, y = (i * 53.7) % h; g.fillStyle = '#d4af37'; g.fillRect(x, y, 3, 3); } g.globalAlpha = 1;
  const ph = h * 0.86, pw = ph * 540 / 868, px = w * 0.07, py = (h - ph) / 2;
  if (ok(poster)) { g.fillStyle = '#d4af37'; g.fillRect(px - 5, py - 5, pw + 10, ph + 10); g.drawImage(poster, px, py, pw, ph); }
  if (ok(hero)) { const hx = w - px - pw; g.fillStyle = '#d4af37'; g.fillRect(hx - 5, py - 5, pw + 10, ph + 10); cover(g, hero, hx, py, pw, ph); }
  const cx = w / 2, tw = w - 2 * (px + pw) - 40;
  if (sh.phase === 'end') {
    g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.12); g.fillText('Thanks for watching!', cx, h * 0.4, tw);
    g.fillStyle = '#f3e3c3'; g.font = F(700, h * 0.065); g.fillText('The Sheriff of Lone Keem', cx, h * 0.56, tw); g.fillText(`Next showing ${clockStr(sh.next)}`, cx, h * 0.68, tw); return true;
  }
  g.fillStyle = '#d4af37'; g.font = F(800, h * 0.06); g.fillText('★ LONE KEEM STUDIO ★', cx, h * 0.16, tw);
  g.fillStyle = '#f3e3c3'; g.font = F(700, h * 0.07); g.fillText('Next showing in', cx, h * 0.33, tw);
  g.fillStyle = '#ffffff'; g.shadowColor = '#d4af37'; g.shadowBlur = 20; g.font = F(900, h * 0.26); g.fillText(mmss(sh.left), cx, h * 0.53, tw); g.shadowBlur = 0;
  g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.08); g.fillText('The Sheriff of Lone Keem', cx, h * 0.73, tw);
  g.fillStyle = 'rgba(243,227,195,.8)'; g.font = F(700, h * 0.05); g.fillText(`Starts ${clockStr(sh.start)} · ${EPS.length} episodes · ${Math.round(MOVIE_LEN / 60)} min`, cx, h * 0.85, tw);
  return true;
}
// lobby "Now Showing" stand by the entrance (portrait canvas)
export function drawNowShowing(g, w, h, sh) {
  const { poster } = art(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4af37'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd36b'; g.font = F(900, w * 0.11); g.fillText('NOW SHOWING', w / 2, h * 0.06, w - 30);
  const pw = w * 0.78, ph = pw * 868 / 540, px = (w - pw) / 2, py = h * 0.11; if (ok(poster)) g.drawImage(poster, px, py, pw, ph); else { g.fillStyle = '#3b1d0e'; g.fillRect(px, py, pw, ph); }
  const y = py + ph + (h - py - ph) / 2; let a = '', b = '';
  if (sh.phase === 'off') { a = 'Showtimes paused'; b = 'Check back soon'; }
  else if (sh.phase === 'movie') { a = '▶ Playing now'; b = `Next show ${clockStr(sh.next)}`; }
  else if (sh.phase === 'end') { a = `Next show ${clockStr(sh.next)}`; b = 'Thanks for watching!'; }
  else { a = `Next show ${clockStr(sh.start)}`; b = `Starts in ${mmss(sh.left)}`; }
  g.fillStyle = '#fff6dc'; g.font = F(900, w * 0.085); g.fillText(a, w / 2, y - h * 0.03, w - 30); g.fillStyle = '#d4af37'; g.font = F(800, w * 0.075); g.fillText(b, w / 2, y + h * 0.035, w - 30);
}
