// 🎬 Lone Keem Studio showings: a clock-based rotating program on the big curved screen.
//   "The Sheriff of Lone Keem" (13+, only when SHERIFF_IN_THEATER is on; off for now) plus four Blender Foundation open movies
//   (CC BY, files in assets/theater/films/, credits in assets/theater/README.md).
// Lazy: theater.js imports this only near the theater, and the <video> is created only while you are INSIDE (unloaded on leave).
// Sync needs no writes and no rules change: every client computes the same timeline from the clock.
//   The program is one hour of 15-minute slots (a slot grows in whole 15-min steps if a show is longer). Each slot =
//   5:00 "Up next" countdown (its last 8 s = the film's title card with its credit), the show, then a short end card.
//   Default hours line up with the clock: countdowns at :00 :15 :30 :45, shows at :05 :20 :35 :50 (local time).
//   The owner can restart the program at any show (pl.ma = anchor ms) or switch showtimes off (pl.mo) from the editor:
//   both ride in the existing `pl` map of theater/lone-keem-studio, which the rules already allow for the owner.
// Kids: under-13 / unknown-age players (trusted age, see theater.js) get the SAME clock but a family film in the
// Sheriff slot, on their own screen only (local, no writes).
// Late joiners seek straight to the right spot in the right reel. A playing song (owner Play) overrides the movie.
import { SHERIFF_EPISODES, isOut } from '../sheriff-data.js';

// ⭐ The Sheriff of Lone Keem in the theater: OFF for now (Keem: not in the theater yet). false = everyone gets the family
// lineup in the :00 slot (Caminandes 2 + 3), no Sheriff poster/plate/marquee/board row anywhere in the theater, and no
// Sheriff video is ever loaded there. Flip to true to bring it back (13+ only; under-13 still get the family lineup).
// The Kemy series page (#/series/sheriff) and its 13+ gate don't use this flag.
export const SHERIFF_IN_THEATER = false;

const DIR = new URL('../../assets/series/sheriff/', import.meta.url).href;
const FD = new URL('../../assets/theater/films/', import.meta.url).href;
export const CREDIT = '© Blender Foundation | studio.blender.org, CC BY';
const EPS = SHERIFF_EPISODES.filter(isOut).map((e) => ({ n: e.n, title: e.title, dur: e.dur, src: `${DIR}ep${e.n}.mp4`, w: 720, h: 1156 }));
const blender = (id, title, file, dur, w, h, lic, year) => ({ id, title, short: title, poster: FD + file + '.webp', reels: [{ src: FD + file + '.mp4', dur, w, h }], dur, credit: `${title} ${CREDIT}`, lic, year, rating: 'All ages' });
export const FILMS = {
  sheriff: { id: 'sheriff', title: 'The Sheriff of Lone Keem', short: 'The Sheriff', poster: DIR + 'ep1.webp', hero: DIR + 'hero.webp', reels: EPS, dur: EPS.reduce((a, e) => a + e.dur, 0), credit: '', rating: '13+', min: 13 },
  bbb: blender('bbb', 'Big Buck Bunny', 'big-buck-bunny', 596.48, 1280, 720, 'CC BY 3.0', 2008),
  spring: blender('spring', 'Spring', 'spring', 464.167, 1280, 536, 'CC BY 4.0', 2019),
  c2: blender('c2', 'Caminandes 2: Gran Dillama', 'caminandes-2', 146.048, 1280, 720, 'CC BY 3.0', 2013),
  c3: blender('c3', 'Caminandes 3: Llamigos', 'caminandes-3', 150.14, 1280, 720, 'CC BY 3.0', 2016),
  wing: blender('wing', 'Wing It!', 'wing-it', 237.917, 1280, 720, 'CC BY 4.0', 2023)
};
FILMS.c2.short = 'Caminandes 2'; FILMS.c3.short = 'Caminandes 3';
export const DOUBLE_POSTER = FD + 'caminandes-double.webp';
export const MOVIE = { title: FILMS.sheriff.title, poster: FILMS.sheriff.poster, hero: FILMS.sheriff.hero };
export const MOVIE_LEN = FILMS.sheriff.dur; // ~583.4 s
export const COUNTDOWN = 300; // "starts in five minutes"
export const TC = 8; // title card with the film's credit (inside the countdown, or between double-feature films)
const STEP = 900; // slots are whole 15-minute steps so shows start on :00 :15 :30 :45 (+5:00)
// the hourly program. kid = what under-13 / unknown-age players see in that slot (same length, same clock)
const PROGRAM = [{ films: ['sheriff'], kid: ['c2', 'c3'] }, { films: ['bbb'] }, { films: ['spring'] }, { films: ['c2', 'c3', 'wing'] }]
  .map((p) => (SHERIFF_IN_THEATER || !p.kid ? p : { films: p.kid })); // flag off: the family lineup for everyone
// true when this viewer must not see the Sheriff in the theater (under 13 / unknown age, or the flag is off)
export const familyOnly = (kid) => !!kid || !SHERIFF_IN_THEATER;
const mod = (a, n) => ((a % n) + n) % n;
// segments of one slot: {k:'card'|'reel', id, o (s from slot start), dur, reel?, ri}
function segsOf(ids) {
  const out = []; let o = COUNTDOWN;
  ids.forEach((id, j) => { const f = FILMS[id]; if (f.credit) { if (j === 0) out.push({ k: 'card', id, o: o - TC, dur: TC }); else { out.push({ k: 'card', id, o, dur: TC }); o += TC; } }
    f.reels.forEach((r, ri) => { out.push({ k: 'reel', id, o, dur: r.dur, reel: r, ri }); o += r.dur; }); });
  return { segs: out, end: o };
}
const SLOTS = (() => { let o = 0; return PROGRAM.map((p) => { const a = segsOf(p.films), b = segsOf(p.kid || p.films);
  const len = Math.max(STEP, Math.ceil((Math.max(a.end, b.end) + 1) / STEP) * STEP); const s = { o, len, adult: { ids: p.films, ...a }, kids: { ids: p.kid || p.films, ...b } }; o += len; return s; }); })();
export const PERIOD = SLOTS.reduce((a, s) => a + s.len, 0); // 3600 s
export const CYCLE = PERIOD; // (old name)
const filmStart = (sl, id) => sl.segs.find((g) => g.k === 'reel' && g.id === id).o;
// the program as plain data (tests / README / editor)
export function program(kid = false) { return SLOTS.map((s, i) => { const v = kid ? s.kids : s.adult; return { i, o: s.o, len: s.len, ids: v.ids, starts: v.ids.map((id) => filmStart(v, id)), end: v.end }; }); }
const isPair = (ids) => ids.length > 1 && ids.every((id) => id[0] === 'c');
export const slotTitle = (ids) => (isPair(ids) ? 'Caminandes Double Feature' : ids.length > 2 ? 'Cartoon Shorts Triple Feature' : ids.map((id) => FILMS[id].title).join(' + '));
export const slotPoster = (ids) => (ids.length > 1 && ids[0] === 'c2' ? DOUBLE_POSTER : FILMS[ids[0]].poster);
// owner "start" helpers: anchor values that put slot k's title card (or 5:00 countdown) at `now`
export function anchorFor(k, nowMs, countdown = false) { const s = SLOTS[mod(k, SLOTS.length)]; return nowMs - (s.o + (countdown ? 0 : COUNTDOWN - TC)) * 1000; }

// where everyone is on the shared timeline. anchor = ms of a program start (0 = the clock hour); kid = family program
// regular schedule (anchor 0): the clock is shifted back 5:00 so every FILM starts on :00 / :15 / :30 / :45 local
// (its 5:00 countdown runs from :55 / :10 / :25 / :40). Whole-hour time zones keep the same minutes everywhere.
export const A0 = -COUNTDOWN * 1000;
export function showAt(nowMs, anchor = 0, off = false, kid = false) {
  anchor = anchor || A0;
  if (off || (SHERIFF_IN_THEATER && !EPS.length)) return { phase: 'off' };
  const ph = mod(nowMs - anchor, PERIOD * 1000) / 1000; let si = 0; while (si < SLOTS.length - 1 && ph >= SLOTS[si + 1].o) si++;
  const S = SLOTS[si], v = kid ? S.kids : S.adult, t = ph - S.o, at = nowMs - t * 1000; // at = ms this slot's countdown began
  const nS = SLOTS[(si + 1) % SLOTS.length], nv = kid ? nS.kids : nS.adult, nAt = at + S.len * 1000, nextSlot = nAt + filmStart(nv, nv.ids[0]) * 1000;
  const base = { si, at, ids: v.ids, title: slotTitle(v.ids), poster: slotPoster(v.ids), slotEnd: at + v.end * 1000, nextAt: nAt, nextSlot, nextIds: nv.ids, nextTitle: slotTitle(nv.ids) };
  const fStart = (id) => at + filmStart(v, id) * 1000, fEnd = (id) => fStart(id) + FILMS[id].dur * 1000;
  const after = (id) => { const j = v.ids.indexOf(id); return j < v.ids.length - 1 ? fStart(v.ids[j + 1]) : nextSlot; };
  const first = v.segs[0];
  if (t < first.o) { const id = v.ids[0]; return { ...base, phase: 'count', id, film: FILMS[id], left: (fStart(id) - nowMs) / 1000, start: fStart(id), end: fEnd(id), next: after(id) }; }
  const g = v.segs.find((q) => t >= q.o && t < q.o + q.dur);
  if (!g) return { ...base, phase: 'end', id: v.ids[v.ids.length - 1], start: fStart(v.ids[0]), end: base.slotEnd, next: nextSlot, left: (nAt - nowMs) / 1000 };
  const f = FILMS[g.id], start = fStart(g.id), end = fEnd(g.id);
  if (g.k === 'card') { const nx = v.segs[v.segs.indexOf(g) + 1]; return { ...base, phase: 'title', id: g.id, film: f, left: (start - nowMs) / 1000, start, end, next: after(g.id), reel: nx.reel }; }
  const epT = t - g.o, ft = (nowMs - start) / 1000;
  return { ...base, phase: 'movie', id: g.id, film: f, reel: g.reel, ep: g.ri, key: g.reel.src, t: ft, epT, epLeft: g.dur - epT, left: f.dur - ft, start, end, next: after(g.id) };
}
// the showtimes board / 2D list: every film in the program with its next n starts (a film playing now keeps its start)
export function listings(nowMs, anchor = 0, off = false, kid = false, n = 3) {
  anchor = anchor || A0;
  if (off) return [];
  const sh = showAt(nowMs, anchor, off, kid), m = new Map();
  const ph = mod(nowMs - anchor, PERIOD * 1000) / 1000, hour0 = nowMs - ph * 1000;
  for (let c = 0; c < 4; c++) for (const s of SLOTS) { const v = kid ? s.kids : s.adult;
    for (const id of v.ids) { const st = hour0 + (c * PERIOD + s.o + filmStart(v, id)) * 1000, f = FILMS[id]; if (st + f.dur * 1000 <= nowMs) continue;
      if (!m.has(id)) m.set(id, { id, film: f, times: [] }); const e = m.get(id); if (e.times.length < n) e.times.push(st); } }
  const out = []; for (const s of SLOTS) for (const id of (kid ? s.kids : s.adult).ids) { const e = m.get(id); if (e && !out.includes(e)) out.push(e); }
  const nowId = sh.phase === 'movie' || sh.phase === 'title' ? sh.id : null; let up = null;
  for (const e of out) { e.now = e.id === nowId; if (!e.now && (!up || e.times[0] < up.times[0])) up = e; }
  for (const e of out) e.next = e === up; return out;
}
export const clockStr = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const runtime = (f) => (f.dur >= 60 ? `${Math.round(f.dur / 60)} min` : `${Math.round(f.dur)} s`);
export const episodes = () => EPS;

// The player: ONE <video> (only while inside; it streams the shown film directly) on ONE full-width curved panel in
// front of the screen. Fill mode is picked from the film's aspect ratio:
//   wide films (Blender, 16:9 / 2.39:1)  -> cover: fill the whole 2.39:1 screen, uniform scale (slight crop, never stretched)
//   portrait (The Sheriff, 720x1156)     -> the sharp film full-height in the centre + both sides filled with a zoomed,
//                                           blurred, darkened copy of the same frame (same texture, no second decode)
const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FS = `uniform sampler2D map; uniform float cw, zy, dim, mode, sx, sy; varying vec2 vUv;
vec3 tap(vec2 p) { return texture2D(map, clamp(p, vec2(0.002), vec2(0.998))).rgb; }
void main() {
  float x = 1.0 - vUv.x, y = vUv.y, d = abs(x - 0.5) - cw * 0.5; vec3 c;
  if (mode > 0.5) c = tap(vec2((x - 0.5) * sx + 0.5, (y - 0.5) * sy + 0.5));
  else if (d <= 0.0) c = tap(vec2((x - 0.5) / cw + 0.5, y));
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
export const fillMode = (w, h) => (w / h < 1.2 ? 'portrait' : 'cover');
export function createMoviePlayer(THREE, ib, { IN, LOW, onBlocked }) {
  const S = IN.SCR, A = S.w / S.h, th = S.w / S.R; // full screen width, same arc as the screen itself
  const geo = new THREE.CylinderGeometry(S.R - 0.03, S.R - 0.03, S.h, 40, 1, true, Math.PI - th / 2, th);
  let video = null, tex = null, cur = '', dims = '', blocked = false, upT = 0, lastSeek = 0, wantSound = false, mode = '';
  const uni = { map: { value: null }, cw: { value: 0.26 }, zy: { value: 0.26 }, dim: { value: 0.42 }, mode: { value: 0 }, sx: { value: 1 }, sy: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VS, fragmentShader: FS, side: THREE.BackSide, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(ib.screen.position); mesh.visible = false; ib.screen.parent.add(mesh);
  function ensure() {
    if (video) return video; video = document.createElement('video');
    video.playsInline = true; video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.preload = 'auto'; video.crossOrigin = 'anonymous'; video.muted = true; video.disablePictureInPicture = true;
    return video;
  }
  // three r170 sizes the texture from .width/.height (0 on a <video> by default -> black) and allocates it once,
  // so a film with other dimensions gets a fresh texture
  function fit(r) {
    const k = r.w + 'x' + r.h, a = r.w / r.h; if (k !== dims) { dims = k; video.width = r.w; video.height = r.h; if (tex) tex.dispose();
      tex = new THREE.Texture(video); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; uni.map.value = tex; }
    mode = fillMode(r.w, r.h);
    if (mode === 'cover') { uni.mode.value = 1; if (a < A) { uni.sx.value = 1; uni.sy.value = a / A; } else { uni.sx.value = A / a; uni.sy.value = 1; } }
    else { uni.mode.value = 0; uni.cw.value = uni.zy.value = Math.min(1, (S.h * a) / S.w); }
  }
  function tryPlay() { const v = video; if (!v || !v.paused) return; v.play().catch(() => { if (!v.muted) { v.muted = true; setBlocked(true); v.play().catch(() => {}); } }); }
  function setBlocked(b) { if (b !== blocked) { blocked = b; onBlocked && onBlocked(b); } }
  // per frame while inside. sh = showAt(); aud = in the auditorium (sound on + texture updates), lobby = muted
  function update(sh, aud, dt) {
    if (!sh || sh.phase !== 'movie') { mesh.visible = false; if (video && !video.paused) video.pause();
      if (sh && sh.reel && sh.reel.src !== cur && ((sh.phase === 'count' && sh.left < 20) || sh.phase === 'title')) load(sh.reel, 0); // buffer the next reel just before it starts
      else if (sh && sh.phase === 'count' && sh.left < 20 && !sh.reel) { const r = sh.film && sh.film.reels[0]; if (r && r.src !== cur) load(r, 0); }
      return; }
    const v = ensure(); if (cur !== sh.reel.src) load(sh.reel, sh.epT);
    wantSound = aud; const mute = !aud || blocked; if (v.muted !== mute) { v.muted = mute; }
    const nowP = performance.now();
    if (v.readyState >= 1 && Math.abs(v.currentTime - sh.epT) > 1.5 && nowP - lastSeek > 2500 && sh.epLeft > 1) { lastSeek = nowP; try { v.currentTime = sh.epT; } catch { /* */ } }
    if (v.paused && !v.ended && sh.epLeft > 0.3) tryPlay();
    mesh.visible = v.readyState >= 2;
    if (aud && mesh.visible && (upT -= dt) <= 0) { upT = LOW ? 1 / 15 : 1 / 30; tex.needsUpdate = true; } // only upload frames you can see
  }
  function load(r, at) { const v = ensure(); if (!r) return; cur = r.src; fit(r); v.src = r.src; try { v.currentTime = at || 0; } catch { /* */ } lastSeek = performance.now();
    v.addEventListener('loadedmetadata', () => { if (at > 0.5) try { v.currentTime = at + (performance.now() - lastSeek) / 1000; } catch { /* */ } }, { once: true }); }
  function unlockSound() { setBlocked(false); if (video) { video.muted = !wantSound; video.play().catch(() => { video.muted = true; setBlocked(true); video.play().catch(() => {}); }); } }
  // leave / destroy: stop the download and free the decoder
  function unload() { if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch { /* */ } } cur = ''; mesh.visible = false; }
  function dispose() { unload(); mesh.removeFromParent(); geo.dispose(); mat.dispose(); if (tex) tex.dispose(); video = null; tex = null; dims = ''; }
  return { update, unload, dispose, unlockSound, get blocked() { return blocked; }, get video() { return video; }, get mode() { return mode; }, get src() { return cur; }, mesh };
}

// --- canvases (screen around the film, countdown + title card, lobby "Now Showing" stand, showtimes board)
const IMGS = new Map(); // lazy: an image is fetched the first time a canvas needs it
const img = (src) => { let i = IMGS.get(src); if (!i) { i = new Image(); i.decoding = 'async'; i.src = src; IMGS.set(src, i); } return i; };
const ok = (i) => i && i.complete && i.naturalWidth > 0;
function cover(g, im, x, y, w, h) { const s = Math.max(w / im.naturalWidth, h / im.naturalHeight), sw = w / s, sh = h / s; g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h); }
function framed(g, src, x, y, w, h) { const im = img(src); g.fillStyle = '#d4af37'; g.fillRect(x - 5, y - 5, w + 10, h + 10); if (ok(im)) cover(g, im, x, y, w, h); else { g.fillStyle = '#3b1d0e'; g.fillRect(x, y, w, h); } }
const F = (wt, px) => `${wt} ${Math.round(px)}px Inter, Arial, sans-serif`;
const bg = (g, w, h, now) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a0610'); gr.addColorStop(1, '#0d0204'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.25; for (let i = 0; i < 30; i++) { const x = (i * 97.3 + now * 7 * (1 + (i % 3))) % w, y = (i * 53.7) % h; g.fillStyle = '#d4af37'; g.fillRect(x, y, 3, 3); } g.globalAlpha = 1; };
// whole screen (canvas is mirrored onto the curved screen by its texture). Returns true when it drew.
export function drawMovieScreen(g, w, h, sh, now) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (sh.phase === 'movie') { // behind the film panel (only seen while it buffers): dark + quiet titles at the sides
    g.fillStyle = '#050304'; g.fillRect(0, 0, w, h); const f = sh.film;
    g.fillStyle = 'rgba(212,175,55,.55)'; g.font = F(900, h * 0.07);
    if (f.id === 'sheriff') { const e = EPS[sh.ep]; g.fillText('THE SHERIFF', w * 0.2, h * 0.42, w * 0.3); g.fillText('OF LONE KEEM', w * 0.2, h * 0.52, w * 0.3);
      g.fillStyle = 'rgba(243,227,195,.45)'; g.font = F(700, h * 0.045); g.fillText(`Episode ${e.n}`, w * 0.8, h * 0.42, w * 0.3); g.fillText(e.title, w * 0.8, h * 0.5, w * 0.3); }
    else { g.fillText(f.title, w / 2, h * 0.45, w * 0.8); g.fillStyle = 'rgba(243,227,195,.5)'; g.font = F(700, h * 0.045); g.fillText(f.credit, w / 2, h * 0.58, w * 0.9); }
    return true;
  }
  bg(g, w, h, now);
  const ph = h * 0.86, pw = ph * 540 / 868, px = w * 0.07, py = (h - ph) / 2, hx = w - px - pw, cx = w / 2, tw = w - 2 * (px + pw) - 40;
  if (sh.phase === 'title') { // the title card: the film + its credit line (CC BY attribution) before it starts
    const f = sh.film; framed(g, f.poster, px, py, pw, ph); framed(g, f.poster, hx, py, pw, ph);
    g.fillStyle = '#d4af37'; g.font = F(800, h * 0.055); g.fillText('LONE KEEM STUDIO PRESENTS', cx, h * 0.17, tw);
    g.fillStyle = '#ffffff'; g.shadowColor = '#d4af37'; g.shadowBlur = 18; g.font = F(900, h * 0.13); g.fillText(f.short, cx, h * 0.37, tw); g.shadowBlur = 0;
    if (f.short !== f.title) { g.fillStyle = '#ffd36b'; g.font = F(800, h * 0.065); g.fillText(f.title.split(': ')[1] || '', cx, h * 0.5, tw); }
    g.fillStyle = '#f3e3c3'; g.font = F(700, h * 0.048); g.fillText(f.credit, cx, h * 0.66, tw);
    g.fillStyle = 'rgba(243,227,195,.75)'; g.font = F(600, h * 0.04); g.fillText(`${f.year} · ${runtime(f)} · Licensed ${f.lic} (creativecommons.org)`, cx, h * 0.76, tw);
    g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.06); g.fillText(`Starting in ${mmss(sh.left)}`, cx, h * 0.88, tw); return true;
  }
  const ids = sh.ids, left = ids.length > 1 ? FILMS[ids[0]].poster : sh.poster, right = ids.length > 1 ? FILMS[ids[1]].poster : FILMS[ids[0]].hero || FILMS[ids[0]].poster;
  if (sh.phase === 'end') {
    framed(g, slotPoster(sh.nextIds), px, py, pw, ph); framed(g, sh.poster, hx, py, pw, ph);
    g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.12); g.fillText('Thanks for watching!', cx, h * 0.3, tw);
    g.fillStyle = '#f3e3c3'; g.font = F(700, h * 0.06); g.fillText(sh.title, cx, h * 0.45, tw);
    if (ids.some((id) => FILMS[id].credit)) { g.fillStyle = 'rgba(243,227,195,.7)'; g.font = F(600, h * 0.04); g.fillText(CREDIT, cx, h * 0.55, tw); }
    g.fillStyle = '#ffffff'; g.font = F(800, h * 0.065); g.fillText(`Up next: ${sh.nextTitle}`, cx, h * 0.7, tw); g.fillStyle = '#ffd36b'; g.fillText(`at ${clockStr(sh.nextSlot)}`, cx, h * 0.81, tw); return true;
  }
  framed(g, left, px, py, pw, ph); framed(g, right, hx, py, pw, ph);
  g.fillStyle = '#d4af37'; g.font = F(800, h * 0.06); g.fillText('★ LONE KEEM STUDIO · UP NEXT ★', cx, h * 0.14, tw);
  g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.085); g.fillText(sh.title, cx, h * 0.28, tw);
  g.fillStyle = '#ffffff'; g.shadowColor = '#d4af37'; g.shadowBlur = 20; g.font = F(900, h * 0.26); g.fillText(mmss(sh.left), cx, h * 0.52, tw); g.shadowBlur = 0;
  const f = sh.film, mins = Math.round(ids.reduce((a, id) => a + FILMS[id].dur, 0) / 60);
  g.fillStyle = 'rgba(243,227,195,.85)'; g.font = F(700, h * 0.05); g.fillText(`Starts ${clockStr(sh.start)} · ${f.id === 'sheriff' ? `${EPS.length} episodes · ` : ''}${mins} min · ${f.rating}`, cx, h * 0.73, tw);
  g.fillStyle = 'rgba(243,227,195,.65)'; g.font = F(600, h * 0.04); g.fillText(f.credit ? CREDIT : 'A Lone Keem original', cx, h * 0.83, tw);
  return true;
}
// lobby "Now Showing" stand by the entrance (portrait canvas): the current or next show + its time
export function drawNowShowing(g, w, h, sh) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1b0b0e'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4af37'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  const playing = sh.phase === 'movie' || sh.phase === 'title', ids = sh.phase === 'end' ? sh.nextIds : sh.ids;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd36b'; g.font = F(900, w * 0.11); g.fillText(playing ? 'NOW SHOWING' : 'UP NEXT', w / 2, h * 0.06, w - 30);
  const pw = w * 0.74, ph = pw * 868 / 540, px = (w - pw) / 2, py = h * 0.105; const src = sh.phase === 'off' ? (SHERIFF_IN_THEATER ? FILMS.sheriff.poster : DOUBLE_POSTER) : playing ? sh.film.poster : slotPoster(ids);
  const im = img(src); if (ok(im)) cover(g, im, px, py, pw, ph); else { g.fillStyle = '#3b1d0e'; g.fillRect(px, py, pw, ph); }
  const y = py + ph + (h - py - ph) / 2; let a = '', b = '';
  if (sh.phase === 'off') { a = 'Showtimes paused'; b = 'Check back soon'; }
  else if (playing) { a = '▶ Playing now'; b = `Then ${clockStr(sh.next)}`; }
  else if (sh.phase === 'end') { a = slotTitle(ids); b = `Starts ${clockStr(sh.nextSlot)}`; }
  else { a = `Starts ${clockStr(sh.start)}`; b = `in ${mmss(sh.left)}`; }
  g.fillStyle = '#fff6dc'; g.font = F(900, w * 0.075); g.fillText(a, w / 2, y - h * 0.03, w - 30); g.fillStyle = '#d4af37'; g.font = F(800, w * 0.07); g.fillText(b, w / 2, y + h * 0.035, w - 30);
}
// lobby showtimes board (landscape canvas): poster thumb, title, runtime, next 3 start times, NOW PLAYING / UP NEXT
export function drawBoard(g, w, h, list, now) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#12070a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d4af37'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#ffd36b'; g.font = F(900, h * 0.075); g.fillText('🕒 SHOWTIMES · AUDITORIUM 1', w / 2, h * 0.07, w - 40);
  g.fillStyle = 'rgba(243,227,195,.6)'; g.font = F(600, h * 0.032); g.fillText(`Your time ${clockStr(now)} · tap for the full list`, w / 2, h * 0.135, w - 40);
  if (!list.length) { g.fillStyle = '#f3e3c3'; g.font = F(800, h * 0.07); g.fillText('Showtimes paused · check back soon', w / 2, h * 0.5, w - 40); return; }
  const top = h * 0.17, bot = h * 0.93, rh = (bot - top) / list.length, pad = 18;
  list.forEach((e, i) => { const y = top + i * rh, f = e.film, th = rh - 10, tw = th * 540 / 868;
    if (e.now || e.next) { g.fillStyle = e.now ? 'rgba(212,175,55,.28)' : 'rgba(212,175,55,.12)'; g.fillRect(pad, y + 3, w - 2 * pad, rh - 6); }
    const im = img(f.poster); if (ok(im)) cover(g, im, pad + 6, y + 5, tw, th); else { g.fillStyle = '#3b1d0e'; g.fillRect(pad + 6, y + 5, tw, th); }
    const x = pad + tw + 22; g.textAlign = 'left'; g.fillStyle = '#fff6dc'; g.font = F(900, Math.min(rh * 0.34, h * 0.05)); g.fillText(f.title, x, y + rh * 0.3, w * 0.5);
    g.fillStyle = 'rgba(243,227,195,.75)'; g.font = F(600, Math.min(rh * 0.2, h * 0.03)); g.fillText(`${runtime(f)} · ${f.rating}${f.credit ? ' · © Blender Foundation | studio.blender.org, CC BY' : ' · A Lone Keem original'}`, x, y + rh * 0.7, w * 0.56);
    g.textAlign = 'right'; const rx = w - pad - 12;
    if (e.now || e.next) { g.fillStyle = e.now ? '#ff5a5a' : '#ffd36b'; g.font = F(900, Math.min(rh * 0.22, h * 0.032)); g.fillText(e.now ? '● NOW PLAYING' : 'UP NEXT', rx, y + rh * 0.28); }
    g.fillStyle = '#ffffff'; g.font = F(800, Math.min(rh * 0.27, h * 0.04)); g.fillText(e.times.map(clockStr).join('  ·  '), rx, y + rh * (e.now || e.next ? 0.66 : 0.5), w * 0.36); });
  g.textAlign = 'center'; g.fillStyle = 'rgba(243,227,195,.55)'; g.font = F(600, h * 0.028); g.fillText('Open movies © Blender Foundation | studio.blender.org, CC BY' + (list.some((e) => e.id === 'sheriff') ? ' · The Sheriff of Lone Keem © Lone Keem' : ''), w / 2, h * 0.965, w - 40);
}
