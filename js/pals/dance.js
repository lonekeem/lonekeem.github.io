// Pal dances: a music bus (is anything playing? where is the beat?), the dance moves, and drawDancer(),
// a drop-in wrapper around drawPal() that makes a Pal dance while music plays (drawPal's API is unchanged).
import { drawPal, SPEC, SPECIES, stageOf } from './art.js';
import { themeAnalyser, themeEl } from '../theme.js';

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
export const danceEnabled = () => ls.get('kemy-pals-dance') !== '0';
export const setDanceEnabled = (on) => ls.set('kemy-pals-dance', on ? '1' : '0');

// ---------------------------------------------------------------- moves
// A pose: x,y body units (y<0 up), r tilt deg, sx/sy squash, k lean, aL/aR arm angles (0 down, 90 out, 180 up,
// negative = across the body), m drawPal mode, f facing, tx text pop, star sparkle. keys are spread over `beats`.
const P = (o) => o;
export const BASIC = [
  { id: 'bounce', name: 'Bubble Bounce', beats: 1, keys: [P({ sy: 0.9, sx: 1.07 }), P({ y: -6, sy: 1.06, sx: 0.96 })], gentle: 1 },
  { id: 'groove', name: 'Side-Step Groove', beats: 2, keys: [P({ x: -5, r: -6, m: 'walk', aL: 40, aR: 20 }), P({ y: -1 }), P({ x: 5, r: 6, m: 'walk', aL: 20, aR: 40 }), P({ y: -1 })] },
  { id: 'twirl', name: 'Twirl Spin', beats: 2, ease: 'linear', keys: [P({ sx: 1 }), P({ sx: 0.15, y: -2 }), P({ sx: -1, f: -1, y: -3, star: 1 }), P({ sx: -0.15, f: -1, y: -2 }), P({ sx: 1 })] },
  { id: 'finwave', name: 'Fin Wave', beats: 1, keys: [P({ aL: 165, aR: 50, r: -4 }), P({ aL: 50, aR: 165, r: 4 })] },
  { id: 'hula', name: 'Hula Sway', beats: 1, keys: [P({ x: -3, r: -8, k: -0.12, aL: 100, aR: 70 }), P({ x: 3, r: 8, k: 0.12, aL: 70, aR: 100 })], gentle: 1 },
  { id: 'beepboop', name: 'Beep-Boop Pop', beats: 2, ease: 'snap', keys: [P({ aL: 90, aR: 0, r: 0 }), P({ aL: 0, aR: 90, r: 0 }), P({ aL: 90, aR: 90, y: -2, tx: 'beep' }), P({ aL: 0, aR: 0, sx: 0.95 })] },
  { id: 'hopclap', name: 'Jump & Clap', beats: 2, keys: [P({ sy: 0.88, aL: 20, aR: 20 }), P({ y: -11, aL: 150, aR: 150 }), P({ y: -11, aL: 178, aR: 178, star: 1, tx: 'clap' }), P({ sy: 0.9, aL: 30, aR: 30 })] },
  { id: 'shoulder', name: 'Shoulder Bop', beats: 1, keys: [P({ aL: 55, aR: 85, y: -1, r: -5 }), P({ aL: 85, aR: 55, y: -1, r: 5 })] },
  { id: 'glide', name: 'Glide Back', beats: 4, ease: 'linear', keys: [P({ x: 5, f: 1, m: 'walk' }), P({ x: -5, f: 1, m: 'walk' }), P({ x: -5, f: -1, m: 'walk' }), P({ x: 5, f: -1, m: 'walk' }), P({ x: 5, f: 1 })] },
  { id: 'ripple', name: 'Ripple Chain', beats: 2, keys: [P({ aL: 120, aR: 70, k: 0.15 }), P({ aL: 90, aR: 90, k: 0, y: -2 }), P({ aL: 70, aR: 120, k: -0.15 }), P({ aL: 90, aR: 90, y: -2 })] },
  { id: 'bodyroll', name: 'Body Roll', beats: 2, keys: [P({}), P({ sy: 0.88, k: 0.2, y: 1, aL: 60, aR: 60 }), P({ sy: 1.08, k: -0.12, y: -2, aL: 80, aR: 80 }), P({})] },
  { id: 'freeze', name: 'Star Freeze', beats: 4, ease: 'snap', keys: [P({ aL: 30, aR: 30 }), P({ y: -8, r: -12, aL: 165, aR: 60, star: 1 }), P({ y: -8, r: -12, aL: 165, aR: 60 }), P({ y: -8, r: -12, aL: 165, aR: 60 }), P({ aL: 30, aR: 30 })] },
];
// Famous moves that go by common generic names, adapted to a Pal's body.
export const TRENDING = [
  { id: 'dab', name: 'the Dab', r: 'c', beats: 4, ease: 'snap', keys: [P({ aL: 30, aR: 30 }), P({ aL: 130, aR: -140, r: -16, x: -2, star: 1 }), P({ aL: 130, aR: -140, r: -16, x: -2 }), P({ aL: -140, aR: 130, r: 16, x: 2 })] },
  { id: 'woah', name: 'the Woah', r: 'c', beats: 2, ease: 'snap', keys: [P({ aL: 70, aR: 70, sy: 1.02 }), P({ aL: 110, aR: -40, r: -10, y: 2, sy: 0.92, x: -2 }), P({ aL: 70, aR: 70 }), P({ aL: -40, aR: 110, r: 10, y: 2, sy: 0.92, x: 2 })] },
  { id: 'griddy', name: 'the Griddy', r: 'r', beats: 4, ease: 'smooth', keys: [P({ x: -2, aL: 40, aR: -25, m: 'walk', y: -1 }), P({ x: 2, aL: -25, aR: 40, m: 'walk' }), P({ x: -2, aL: 40, aR: -25, m: 'walk', y: -1 }), P({ x: 2, aL: -25, aR: 40, m: 'walk' }), P({ x: -1, aL: 40, aR: -25, m: 'walk' }), P({ x: 1, aL: -25, aR: 40, m: 'walk' }), P({ aL: -150, aR: -150, tx: 'goggles', star: 1 }), P({ aL: -150, aR: -150 })] },
  { id: 'runman', name: 'the Running Man', r: 'c', beats: 2, keys: [P({ y: -3, aL: 45, aR: -30, m: 'walk', x: 1 }), P({ y: 0, aL: -30, aR: 45, m: 'walk', x: -1 }), P({ y: -3, aL: 45, aR: -30, m: 'walk', x: 1 }), P({ y: 0, aL: -30, aR: 45, m: 'walk', x: -1 })] },
  { id: 'shuffle', name: 'the Shuffle', r: 'r', beats: 2, ease: 'snap', keys: [P({ x: -3, sx: 1.05, m: 'walk', aL: 60, aR: 30 }), P({ x: 0, y: -2, sy: 1.04 }), P({ x: 3, sx: 1.05, m: 'walk', aL: 30, aR: 60 }), P({ x: 0, y: -2, sy: 1.04 })] },
  { id: 'robot', name: 'the Robot', r: 'c', beats: 4, ease: 'snap', keys: [P({ aL: 90, aR: 0 }), P({ aL: 90, aR: 90 }), P({ aL: 0, aR: 90, r: 8 }), P({ aL: 0, aR: 0, r: 8, f: -1 }), P({ aL: 180, aR: 0, r: 0 }), P({ aL: 0, aR: 180 }), P({ aL: 90, aR: 90, y: -1, tx: 'beep' }), P({ aL: 0, aR: 0 })] },
  { id: 'moonwalk', name: 'the Moonwalk', r: 'l', beats: 4, ease: 'linear', keys: [P({ x: 6, f: 1, m: 'walk', aL: 20, aR: 20 }), P({ x: -6, f: 1, m: 'walk', aL: 20, aR: 20 }), P({ x: -6, f: -1, m: 'walk', y: -2, aL: 175, aR: 20, star: 1 }), P({ x: 6, f: -1, m: 'walk' }), P({ x: 6, f: 1 })] },
  { id: 'sprinkler', name: 'the Sprinkler', r: 'r', beats: 4, ease: 'snap', keys: [P({ aL: -165, aR: 95 }), P({ aL: -165, aR: 75, r: 3 }), P({ aL: -165, aR: 55, r: 6 }), P({ aL: -165, aR: 35, r: 9 }), P({ aL: -165, aR: 95, r: 0, m: 'walk' }), P({ aL: -165, aR: 95 })] },
  { id: 'wave', name: 'the Wave', r: 'r', beats: 4, keys: [P({ aL: 120, aR: 90 }), P({ aL: 90, aR: 90, k: 0.18, y: -1 }), P({ aL: 90, aR: 90, k: -0.18, y: 1 }), P({ aL: 90, aR: 120 }), P({ aL: 90, aR: 90, k: -0.18, y: -1 }), P({ aL: 90, aR: 90, k: 0.18, y: 1 })] },
  { id: 'cabbage', name: 'the Cabbage Patch', r: 'c', beats: 2, ease: 'smooth', keys: [P({ x: -3, y: 0, aL: 60, aR: -50 }), P({ x: 0, y: -3, aL: 70, aR: -40 }), P({ x: 3, y: 0, aL: 60, aR: -50 }), P({ x: 0, y: 2, sy: 0.94, aL: 50, aR: -60 })] },
  { id: 'shoot', name: 'the Shoot', r: 'r', beats: 2, ease: 'snap', keys: [P({ aL: 20, aR: 150 }), P({ aL: 20, aR: 25, y: -5, r: 9, x: 2, m: 'hop' }), P({ aL: 150, aR: 20 }), P({ aL: 25, aR: 20, y: -5, r: -9, x: -2, m: 'hop' })] },
  { id: 'quan', name: 'the Quan', r: 'l', beats: 2, keys: [P({ y: 2, sy: 0.9, aL: 105, aR: 80, r: -6, x: -2 }), P({ y: -2, sy: 1.04, aL: 80, aR: 105, r: 6, x: 2 }), P({ y: 2, sy: 0.9, aL: 105, aR: 80, r: -6, x: -2 }), P({ y: -3, aL: 120, aR: 120, star: 1 })] },
];
export const PRICE = { c: 80, r: 160, l: 320 };
export const RARITY_NAME = { c: 'Common', r: 'Rare', l: 'Legendary' };
let TIKTOK = [];
export const tiktok = () => TIKTOK;
export const allDances = () => [...BASIC, ...TRENDING, ...TIKTOK];
export const danceById = (id) => allDances().find((d) => d.id === id);
export const itemId = (id) => 'dn_' + id;
export const isFree = (d) => BASIC.includes(d);
let loadP = null;
export function loadTrends() {
  if (!loadP) loadP = fetch(new URL('../../data/pal-dances.json', import.meta.url)).then((r) => r.json()).then((j) => {
    TIKTOK = (j.dances || []).filter((d) => /^[a-z]{2,13}$/.test(d.id) && Array.isArray(d.keys) && d.keys.length).map((d) => ({ ...d, group: 'tiktok', r: d.r || 'r' }));
    return TIKTOK;
  }).catch(() => []);
  return loadP;
}
TRENDING.forEach((d) => (d.group = 'trending')); BASIC.forEach((d) => (d.group = 'basic'));

// owned dances (Pal Shop items dn_<id>) for the signed-in owner, set by the UI
let owned = new Set();
export const setOwned = (ids) => { owned = new Set(ids); };
export const ownsDance = (d) => isFree(d) || owned.has(itemId(d.id));
const favKey = (pal) => 'kemy-pal-dance:' + (pal.id || '') + ':' + (pal.name || '');
export const favOf = (pal) => ls.get(favKey(pal)) || 'free';
export const setFav = (pal, id) => ls.set(favKey(pal), id);

// ---------------------------------------------------------------- music bus
const bus = { on: false, amt: 0, beat: 0, bpm: 116, energy: 0.5, lastT: 0, lastBeatAt: 0, period: 60 / 116, hist: [], src: '' };
const freq = new Uint8Array(256);
function activeMedia() {
  const te = themeEl();
  const pl = window.__kemyPlayer && window.__kemyPlayer.audio;
  for (const m of [...document.querySelectorAll('video, audio'), ...(pl ? [pl] : [])]) {
    if (m.paused || m.ended || m.muted || m.volume === 0) continue;
    if (m === te && m.dataset.stopping) continue;
    return m;
  }
  if (te && !te.paused && !te.dataset.stopping) return te;
  return null;
}
function ytOpen() { return !!document.querySelector('.yt-sheet iframe, iframe[data-kemy-unmuted="1"]'); }
let preview = 0;
export const forcePreview = (on) => { preview += on ? 1 : -1; };
function analyserFor(m) {
  if (!m) return null;
  if (m === themeEl()) return themeAnalyser();
  const pl = window.__kemyPlayer; if (pl && m === pl.audio) { try { return pl.analyser(); } catch { return null; } }
  return null;
}
export function tickBus(now = performance.now() / 1000) {
  if (now - bus.lastT < 0.012) return bus; const dt = Math.min(0.1, now - (bus.lastT || now)); bus.lastT = now;
  const m = activeMedia(); const on = danceEnabled() && (!!m || ytOpen() || preview > 0);
  bus.on = on; bus.src = m ? (m === themeEl() ? 'theme' : m.tagName.toLowerCase()) : ytOpen() ? 'youtube' : preview > 0 ? 'preview' : '';
  bus.amt = Math.max(0, Math.min(1, bus.amt + (on ? dt / 0.45 : -dt / 0.6)));
  const an = analyserFor(m);
  if (an) {
    const n = Math.min(freq.length, an.frequencyBinCount); an.getByteFrequencyData(freq);
    let low = 0; const L = Math.max(2, Math.floor(n * 0.12)); for (let i = 1; i <= L; i++) low += freq[i]; low /= L * 255;
    let all = 0; for (let i = 0; i < n; i++) all += freq[i]; all /= n * 255;
    bus.energy = bus.energy * 0.85 + all * 0.15 * 2.2;
    bus.hist.push(low); if (bus.hist.length > 43) bus.hist.shift();
    const avg = bus.hist.reduce((a, b) => a + b, 0) / bus.hist.length;
    if (low > avg * 1.18 && low > 0.25 && now - bus.lastBeatAt > 0.28) { // onset
      const iv = now - bus.lastBeatAt; if (iv > 0.3 && iv < 1.2) { bus.period = bus.period * 0.8 + iv * 0.2; } bus.lastBeatAt = now;
      bus.beat = Math.round(bus.beat); // snap the phase to the hit
    }
  } else { bus.period = 60 / 116; bus.energy = 0.6; }
  bus.bpm = Math.round(60 / bus.period);
  bus.beat += dt / bus.period;
  return bus;
}
export const busState = () => bus;

// ---------------------------------------------------------------- engine
const lerp = (a, b, k) => a + (b - a) * k;
const ease = { smooth: (k) => 0.5 - Math.cos(k * Math.PI) / 2, linear: (k) => k, snap: (k) => (k < 0.65 ? 0 : (k - 0.65) / 0.35) };
const NUM = ['x', 'y', 'r', 'sx', 'sy', 'k', 'aL', 'aR'];
const DEF = { x: 0, y: 0, r: 0, sx: 1, sy: 1, k: 0, aL: 25, aR: 25 };
export function poseAt(d, beat) {
  const n = d.keys.length, per = d.beats / n, b = ((beat % d.beats) + d.beats) % d.beats;
  const i = Math.floor(b / per) % n, j = (i + 1) % n, k = (ease[d.ease || 'smooth'] || ease.smooth)((b - i * per) / per);
  const A = d.keys[i], B = d.keys[j], o = {};
  for (const f of NUM) o[f] = lerp(A[f] ?? DEF[f], B[f] ?? DEF[f], k);
  o.m = A.m; o.f = A.f; o.tx = A.tx; o.star = A.star; o.prog = k; return o;
}
// which dance is a Pal doing right now? Freestyle mixes owned moves every 4 bars; trending moves are picked 3x as often.
function seedOf(pal) { let h = 7; for (const ch of String((pal.id || '') + (pal.name || '') + pal.species)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
export function danceFor(pal, beat, forced) {
  if (forced) return forced;
  if (RM()) return BASIC.find((d) => d.id === (Math.floor(beat / 8) % 2 ? 'hula' : 'bounce'));
  const fav = pal._dance || favOf(pal); const fd = fav !== 'free' && danceById(fav);
  if (fd && ownsDance(fd)) return fd;
  const mine = pal._others ? BASIC : allDances().filter(ownsDance);
  const pool = []; for (const d of mine) { pool.push(d); if (d.group !== 'basic') pool.push(d, d); }
  const phrase = Math.floor(beat / 8); const h = (seedOf(pal) + phrase * 2654435761) >>> 0;
  return pool[h % pool.length] || BASIC[0];
}

// arms: little rounded nubs at the shoulders, in the Pal's body colour
function sparkle(c, x, y, s, t) {
  c.save(); c.translate(x, y); c.rotate(t * 0.05); c.fillStyle = '#ffd34d'; c.beginPath();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.42 : s; const a = (i / 10) * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  c.closePath(); c.fill(); c.restore();
}
// Drop-in for drawPal: dances while music plays (st.dance = dance object forces one, e.g. a shop preview).
export function drawDancer(c, x, y, size, pal, st = {}) {
  const b = tickBus(); const amt = st.dance ? 1 : b.amt;
  if (amt <= 0.001 || (!st.dance && !danceEnabled())) return drawPal(c, x, y, size, pal, st);
  const gentle = RM(); const beat = st.beat ?? (b.beat + (pal._off || 0));
  const d = danceFor(pal, beat, st.dance); const p = poseAt(d, beat);
  const A = amt * (gentle ? 0.4 : 1) * (0.75 + Math.min(0.5, b.energy) * 0.5); const k = size / 40;
  c.save();
  c.translate(x + p.x * k * A, y + p.y * k * A);
  c.rotate((p.r * A * Math.PI) / 180);
  const sx = lerp(1, p.sx, gentle ? 0 : amt), sy = lerp(1, p.sy, A);
  c.transform(1, 0, p.k * A, 1, 0, 0); c.scale(sx || 0.01, sy);
  const face = (p.f && amt > 0.5 ? p.f : (st.face || 1));
  // the dance drives the Pal's own rig (shoulders/elbows, hips/knees) instead of an overlay
  const aL = lerp(14, p.aL ?? 14, amt), aR = lerp(14, p.aR ?? 14, amt), bend = Math.max(0, p.y || 0) * 9 * A;
  const rig = { aL: face < 0 ? aR : aL, aR: face < 0 ? aL : aR, eL: p.eL ?? 16, eR: p.eR ?? 16, kL: 4 + bend + (p.kL || 0) * A, kR: 4 + bend + (p.kR || 0) * A, hL: bend * 0.5 + (p.hL || 0) * A, hR: bend * 0.5 + (p.hR || 0) * A };
  drawPal(c, 0, 0, size, pal, { ...st, t: st.t, face, mode: amt > 0.5 ? (p.m || 'idle') : st.mode, rig });
  c.restore();
  if (!gentle && amt > 0.6) {
    if (p.star) { const t = st.t || 0; sparkle(c, x - size * 0.42, y - size * 0.9, size * 0.09, t); sparkle(c, x + size * 0.45, y - size * 0.75, size * 0.07, t + 20); }
    if (p.tx && size >= 40) { c.save(); c.font = `700 ${Math.round(size * 0.18)}px Inter, sans-serif`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(60,20,110,.8)'; c.lineWidth = 3; c.strokeText(p.tx, x + size * 0.5, y - size * 1.0); c.fillText(p.tx, x + size * 0.5, y - size * 1.0); c.restore(); }
  }
}
export const isDancing = () => bus.amt > 0.01;
// keep the bus fresh even when no Pal is on screen (so the floating Pal knows music started); cheap
setInterval(() => { if (!document.hidden) tickBus(); }, 200);
