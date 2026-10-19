// Kemy AI Movie Maker, Animated mode (free, all in the browser).
//  - script: the free text AI returns a cast, and shots with a background, characters, actions,
//    expressions, dialogue lines, weather and a camera move (template fallback when it's busy)
//  - art: one background plate per shot + ONE full-body image per character (reused in every shot
//    for consistency), from the free no-key image API; characters are asked for on a plain white
//    background and cut out here with an edge flood-fill (no model download)
//  - animation: 2D puppets on canvas (walk / slide / hop / wave / dance / bob, squash & stretch,
//    entrances + exits, blink + mouth flaps synced to each line), parallax, weather, camera moves, cuts
//  - voices: browser speech with per-character presets (same idea as Pal voices: pitch + rate + hint)
import { VOICES as PAL_VOICES } from './pals/voice.js';

export const W = 1280, H = 720;
export const ACTIONS = { idle: 'Stand + bob', 'walk-in-left': 'Walk in from left', 'walk-in-right': 'Walk in from right', 'walk-out-left': 'Walk out left', 'walk-out-right': 'Walk out right', 'walk-across': 'Walk across', slide: 'Slide over', hop: 'Hop', wave: 'Wave', dance: 'Dance', 'pop-in': 'Pop in' };
export const EXPRESSIONS = { neutral: 'Neutral', happy: 'Happy', sad: 'Sad', surprised: 'Surprised', angry: 'Angry', scared: 'Scared' };
export const WEATHER = { none: 'None', rain: 'Rain', snow: 'Snow', sparkles: 'Sparkles', bubbles: 'Bubbles', leaves: 'Leaves' };
export const CAMERA = { static: 'Still', 'push-in': 'Push in', 'pull-out': 'Pull out', 'pan-left': 'Pan left', 'pan-right': 'Pan right', shake: 'Shake' };
// Movie voice presets (pitch/rate on the device's speech voices, + an optional voice-name hint),
// followed by the free Pal voices.
export const MOVIE_VOICES = [
  { id: 'narrator', name: 'Narrator', pitch: 1, rate: 0.96 },
  { id: 'hero', name: 'Hero', pitch: 1.1, rate: 1.02 },
  { id: 'kid', name: 'Kid', pitch: 1.5, rate: 1.08 },
  { id: 'deep', name: 'Deep', pitch: 0.6, rate: 0.9, hint: /male|david|guy|daniel|fred|alex/i },
  { id: 'grandpa', name: 'Grandpa', pitch: 0.75, rate: 0.82, hint: /male|david|daniel|fred/i },
  { id: 'grandma', name: 'Grandma', pitch: 1.15, rate: 0.85, hint: /female|zira|samantha|karen|moira/i },
  { id: 'villain', name: 'Villain', pitch: 0.5, rate: 0.85, hint: /male|david|daniel/i },
  { id: 'robot', name: 'Robot', pitch: 0.3, rate: 0.95 },
  { id: 'chipmunk', name: 'Chipmunk', pitch: 2, rate: 1.3 },
  { id: 'royal', name: 'Royal', pitch: 1, rate: 0.9, lang: /en-GB/ },
  ...PAL_VOICES.filter((v) => !v.premium).map((v) => ({ id: 'pal_' + v.id, name: 'Pal: ' + v.name, pitch: v.pitch, rate: v.rate, hint: v.hint, lang: v.lang }))
];
export const VOICE_BY_ID = Object.fromEntries(MOVIE_VOICES.map((v) => [v.id, v]));
const pick = (obj, v, d) => (v in obj ? v : d);
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lineSeconds = (text) => clamp(0.9 + String(text || '').split(/\s+/).filter(Boolean).length * 0.36, 1.4, 9);
export const shotSeconds = (s) => clamp(1.2 + (s.lines || []).reduce((a, l) => a + lineSeconds(l.text) + 0.25, 0), 3, 24);

// ---------------------------------------------------------------- script
export function normalizeScript(data, fallbackIdea, nShots) {
  const castIn = Array.isArray(data.cast) ? data.cast.slice(0, 4) : [];
  const cast = castIn.map((c, i) => ({ id: 'c' + i, name: clean(c.name, 24) || 'Hero', look: clean(c.look || c.description, 200) || 'a friendly cartoon character', voice: VOICE_BY_ID[c.voice] ? c.voice : ['hero', 'kid', 'deep', 'grandma'][i % 4] }));
  if (!cast.length) cast.push({ id: 'c0', name: 'Hero', look: clean(fallbackIdea, 160), voice: 'hero' });
  const byName = (n) => cast.find((c) => c.name.toLowerCase() === String(n || '').toLowerCase()) || null;
  const shots = (Array.isArray(data.shots) ? data.shots : []).slice(0, nShots).map((s, si) => {
    const chars = (Array.isArray(s.characters) ? s.characters : Array.isArray(s.chars) ? s.chars : []).slice(0, 3).map((c, i, arr) => {
      const who = byName(c.name) || cast[i % cast.length];
      return { cid: who.id, action: pick(ACTIONS, c.action, si === 0 ? 'walk-in-left' : 'idle'), expr: pick(EXPRESSIONS, c.expression || c.expr, 'happy'), x: clamp(Number(c.x) || (arr.length === 1 ? 0.5 : 0.28 + (0.44 * i) / Math.max(1, arr.length - 1)), 0.1, 0.9) };
    });
    if (!chars.length) chars.push({ cid: cast[0].id, action: 'idle', expr: 'happy', x: 0.5 });
    const lines = (Array.isArray(s.lines) ? s.lines : Array.isArray(s.dialogue) ? s.dialogue : []).slice(0, 4).map((l) => { const who = byName(l.who || l.speaker || l.name); return { who: who ? who.id : 'narrator', text: clean(l.text || l.line, 160) }; }).filter((l) => l.text);
    if (!lines.length && s.narration) lines.push({ who: 'narrator', text: clean(s.narration, 160) });
    return { bg: clean(s.background || s.bg || s.setting, 220) || 'a colorful open meadow', chars, lines, weather: pick(WEATHER, s.weather, 'none'), camera: pick(CAMERA, s.camera, ['push-in', 'pan-right', 'static', 'pan-left'][si % 4]) };
  });
  return { title: clean(data.title, 60), cast, shots };
}
export function templateAnimated(idea, n) {
  const hero = clean(idea, 100) || 'a small hero';
  const cast = [{ id: 'c0', name: 'Pip', look: `${hero}, cute round cartoon character`, voice: 'kid' }, { id: 'c1', name: 'Bo', look: 'a friendly fluffy cartoon companion with big eyes', voice: 'deep' }];
  const beats = [
    { bg: 'a sunny cartoon village street, morning', chars: [{ cid: 'c0', action: 'walk-in-left', expr: 'happy', x: 0.4 }], lines: [{ who: 'narrator', text: `Meet Pip: ${hero}.` }, { who: 'c0', text: 'Today feels like a big day!' }], weather: 'sparkles', camera: 'push-in' },
    { bg: 'a quiet park with a big old tree', chars: [{ cid: 'c0', action: 'idle', expr: 'surprised', x: 0.35 }, { cid: 'c1', action: 'walk-in-right', expr: 'happy', x: 0.68 }], lines: [{ who: 'c1', text: 'Hi! Are you looking for adventure too?' }, { who: 'c0', text: 'Always!' }], weather: 'leaves', camera: 'static' },
    { bg: 'a stormy hill path, dramatic clouds', chars: [{ cid: 'c0', action: 'walk-across', expr: 'scared', x: 0.5 }, { cid: 'c1', action: 'hop', expr: 'neutral', x: 0.7 }], lines: [{ who: 'narrator', text: 'But the path got harder.' }, { who: 'c0', text: 'Stay close, Bo!' }], weather: 'rain', camera: 'shake' },
    { bg: 'a snowy mountain top at sunset', chars: [{ cid: 'c0', action: 'dance', expr: 'happy', x: 0.4 }, { cid: 'c1', action: 'wave', expr: 'happy', x: 0.62 }], lines: [{ who: 'c1', text: 'We made it!' }, { who: 'c0', text: 'Together, we can do anything.' }], weather: 'snow', camera: 'pull-out' },
    { bg: 'a cozy home at night with glowing windows', chars: [{ cid: 'c0', action: 'walk-out-right', expr: 'happy', x: 0.5 }], lines: [{ who: 'narrator', text: 'And that was only the beginning.' }], weather: 'bubbles', camera: 'pan-right' }
  ];
  const shots = []; for (let i = 0; i < n; i++) shots.push(JSON.parse(JSON.stringify(beats[i === n - 1 ? beats.length - 1 : Math.min(i, beats.length - 2)])));
  return { title: clean(idea, 60).split(' ').slice(0, 5).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') || 'My Kemy Cartoon', cast, shots };
}
export function animatedPrompt({ idea, style, shots, castHint, recap }) {
  return `Write a ${shots}-shot ANIMATED short film (${style} style) about: "${idea}".${castHint ? ` Reuse these exact main characters: ${castHint}.` : ''}${recap ? ` Previously: ${recap}.` : ''}
Return JSON only: {"title": string (max 6 words), "cast": [{"name": string, "look": string (visual description for drawing them, max 25 words, include colors), "voice": one of ${MOVIE_VOICES.slice(0, 10).map((v) => v.id).join('|')}}] (1-3 characters),
"shots": [{"background": string (the empty setting only, no characters, max 25 words), "characters": [{"name": string, "action": one of ${Object.keys(ACTIONS).join('|')}, "expression": one of ${Object.keys(EXPRESSIONS).join('|')}, "x": number 0.15-0.85}], "lines": [{"who": character name or "narrator", "text": string (max 20 words)}] (1-3 lines), "weather": one of ${Object.keys(WEATHER).join('|')}, "camera": one of ${Object.keys(CAMERA).join('|')}}]}. Exactly ${shots} shots with a beginning, middle and happy ending. Family friendly, original characters only.`;
}
export const charPrompt = (look, styleP) => `${look}, full body character, standing, facing the viewer, centered, whole body visible head to feet, plain solid pure white background, no shadow, no ground, no text, ${styleP}`;
export const bgPrompt = (bg, styleP) => `${bg}, empty background plate with no people and no characters, wide establishing shot, ${styleP}, no text`;

// ---------------------------------------------------------------- cut-out (edge flood fill on a plain background)
export async function cutout(bmp, tol = 46) {
  const maxS = 640, k = Math.min(1, maxS / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  const im = g.getImageData(0, 0, w, h), d = im.data;
  // background colour = median of the border pixels
  const border = []; for (let x = 0; x < w; x += 4) { border.push(x, (h - 1) * w + x); } for (let y = 0; y < h; y += 4) { border.push(y * w, y * w + w - 1); }
  const med = [0, 1, 2].map((ch) => { const v = border.map((i) => d[i * 4 + ch]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const dist = (i) => { const o = i * 4; return Math.abs(d[o] - med[0]) + Math.abs(d[o + 1] - med[1]) + Math.abs(d[o + 2] - med[2]); };
  const bg = new Uint8Array(w * h), stack = [];
  for (const i of border) if (dist(i) < tol * 3) { bg[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) if (j >= 0 && !bg[j] && dist(j) < tol * 3) { bg[j] = 1; stack.push(j); }
  }
  let minX = w, minY = h, maxX = 0, maxY = 0, kept = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (bg[i]) { d[i * 4 + 3] = 0; continue; }
    // soften the edge: pixels touching background fade a little
    const edge = (x && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y && bg[i - w]) || (y < h - 1 && bg[i + w]);
    if (edge) d[i * 4 + 3] = 150;
    kept++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const ok = kept > w * h * 0.03 && kept < w * h * 0.92;
  if (!ok) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  g.putImageData(im, 0, 0);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = new OffscreenCanvas(cw, ch); out.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  const sprite = await createImageBitmap(out);
  // face guess: widest row in the top third ≈ head; mouth ~62% down the head, eyes ~42%
  let headBottom = Math.round(ch * 0.28);
  return { bmp: sprite, w: cw, h: ch, ok, face: { x: 0.5, eyeY: (headBottom * 0.5) / ch, mouthY: (headBottom * 0.78) / ch, headH: headBottom / ch } };
}

// ---------------------------------------------------------------- timeline
export function animTimeline(shots, startAt) {
  let t = startAt; const parts = shots.map((s, i) => {
    const d = shotSeconds(s); let lt = 0.6; const lines = (s.lines || []).map((l) => { const x = { ...l, start: lt, dur: lineSeconds(l.text) }; lt += x.dur + 0.25; return x; });
    const p = { i, start: t, dur: d, lines }; t += d; return p;
  });
  return { parts, end: t };
}

// ---------------------------------------------------------------- particles
const rnd = (i, s = 1) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
function weather(g, kind, t, cam) {
  if (kind === 'none') return;
  g.save();
  const n = { rain: 140, snow: 90, sparkles: 50, bubbles: 28, leaves: 26 }[kind] || 0;
  for (let i = 0; i < n; i++) {
    const depth = 0.5 + rnd(i, 3), px = (rnd(i) * (W + 200) - cam.x * 40 * depth + W * 4) % (W + 200) - 100;
    if (kind === 'rain') { const y = (rnd(i, 2) * H + t * 900 * depth) % (H + 60) - 30; g.strokeStyle = `rgba(190,210,255,${0.25 + 0.3 * depth})`; g.lineWidth = depth * 1.6; g.beginPath(); g.moveTo(px, y); g.lineTo(px - 6 * depth, y + 26 * depth); g.stroke(); }
    if (kind === 'snow') { const y = (rnd(i, 2) * H + t * 60 * depth) % (H + 20) - 10, x = px + Math.sin(t * 1.3 + i) * 14; g.fillStyle = `rgba(255,255,255,${0.5 + 0.4 * depth})`; g.beginPath(); g.arc(x, y, 2 + 2.5 * depth, 0, 7); g.fill(); }
    if (kind === 'sparkles') { const y = rnd(i, 2) * H, a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); g.fillStyle = `rgba(255,${200 + (i % 3) * 20},120,${a})`; star4(g, px, y, (3 + 5 * depth) * a); }
    if (kind === 'bubbles') { const y = H + 30 - ((rnd(i, 2) * H + t * 50 * depth) % (H + 60)), x = px + Math.sin(t + i) * 18; g.strokeStyle = `rgba(220,240,255,${0.5 + 0.3 * depth})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6 + 10 * depth, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(x - 3 * depth, y - 4 * depth, 2.5 * depth, 0, 7); g.fill(); }
    if (kind === 'leaves') { const y = (rnd(i, 2) * H + t * 70 * depth) % (H + 40) - 20, x = px + Math.sin(t * 1.5 + i) * 40; g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.fillStyle = ['#e9862b', '#d95f2b', '#f2b134', '#9fbf3b'][i % 4]; g.beginPath(); g.ellipse(0, 0, 9 * depth, 4.5 * depth, 0, 0, 7); g.fill(); g.restore(); }
  }
  if (kind === 'rain') { g.fillStyle = 'rgba(20,30,60,.18)'; g.fillRect(0, 0, W, H); }
  g.restore();
}
function star4(g, x, y, r) { g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); }

// ---------------------------------------------------------------- puppets
const ease = (x) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));
function puppetPose(ch, lt, dur) {
  const a = ch.action, x0 = ch.x; let x = x0, y = 0, rot = 0, sx = 1, sy = 1, alpha = 1, walking = false;
  const inT = ease(lt / 1.6), outT = ease((lt - (dur - 1.8)) / 1.6);
  if (a === 'walk-in-left') { x = -0.15 + (x0 + 0.15) * inT; walking = inT < 1; }
  else if (a === 'walk-in-right') { x = 1.15 - (1.15 - x0) * inT; walking = inT < 1; }
  else if (a === 'walk-out-left') { x = x0 - (x0 + 0.2) * outT; walking = outT > 0 && outT < 1; }
  else if (a === 'walk-out-right') { x = x0 + (1.2 - x0) * outT; walking = outT > 0 && outT < 1; }
  else if (a === 'walk-across') { x = -0.12 + 1.24 * (lt / dur); walking = true; }
  else if (a === 'slide') { x = x0 - 0.18 + 0.36 * ease(lt / dur); }
  else if (a === 'pop-in') { const k = ease(lt / 0.5); sx = sy = 0.2 + 0.8 * k + Math.sin(Math.min(1, lt / 0.7) * Math.PI) * 0.12; alpha = k; }
  if (walking) { const ph = lt * 9; y = -Math.abs(Math.sin(ph)) * 14; rot = Math.sin(ph) * 0.05; const sq = Math.abs(Math.cos(ph)); sy = 1 - 0.05 * sq; sx = 1 + 0.04 * sq; }
  else if (a === 'hop') { const ph = (lt * 1.6) % 1; const h = Math.sin(ph * Math.PI); y = -h * 70; sy = ph < 0.08 || ph > 0.92 ? 0.86 : 1 + 0.08 * h; sx = 2 - sy; }
  else if (a === 'dance') { y = -Math.abs(Math.sin(lt * 5)) * 20; rot = Math.sin(lt * 5) * 0.16; sx = 1 + 0.05 * Math.sin(lt * 10); sy = 2 - sx; x += Math.sin(lt * 2.5) * 0.02; }
  else if (a === 'wave') { rot = Math.sin(lt * 7) * 0.06; y = -Math.abs(Math.sin(lt * 3.5)) * 5; }
  else { y = Math.sin(lt * 2.2 + x0 * 9) * 4; sy = 1 + Math.sin(lt * 2.2 + x0 * 9) * 0.012; } // idle breathing
  const facing = a === 'walk-in-right' || a === 'walk-out-left' ? -1 : 1;
  return { x, y, rot, sx, sy, alpha, walking, facing };
}
// A tinted copy of a sprite (only its own pixels), cached per colour.
function tinted(sprite, tint) {
  sprite._tint = sprite._tint || {};
  if (!sprite._tint[tint]) { const c = new OffscreenCanvas(sprite.w, sprite.h), x = c.getContext('2d'); x.drawImage(sprite.bmp, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = tint; x.fillRect(0, 0, sprite.w, sprite.h); sprite._tint[tint] = c; }
  return sprite._tint[tint];
}
function drawPuppet(g, ch, sprite, lt, dur, talking, mouthOpen, cam) {
  const P = puppetPose(ch, lt, dur);
  const targetH = H * 0.58 * (ch.scale || 1), k = targetH / sprite.h, w = sprite.w * k, h = targetH;
  const expr = ch.expr;
  let ey = 0, ex = 0, tilt = 0, tint = '';
  if (expr === 'sad') { ey = 6; tilt = -0.04; tint = 'rgba(70,110,200,.16)'; }
  if (expr === 'angry') { ex = Math.sin(lt * 40) * 2.5; tint = 'rgba(230,40,40,.14)'; }
  if (expr === 'scared') { ex = Math.sin(lt * 55) * 2; }
  if (expr === 'surprised' && lt < 0.6) { ey = -Math.sin((lt / 0.6) * Math.PI) * 30; }
  // talking: a tiny bounce + stretch on each syllable
  let tsy = 1; if (talking) tsy = 1 + 0.02 * Math.max(0, mouthOpen);
  const baseX = P.x * W + ex - cam.x * 18, baseY = H * 0.94 + P.y + ey;
  g.save(); g.globalAlpha = P.alpha;
  // shadow
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(baseX, H * 0.945, w * 0.32 * (1 + P.y / 300), 12, 0, 0, 7); g.fill();
  g.translate(baseX, baseY); g.rotate(P.rot + tilt); g.scale(P.facing * P.sx, P.sy * tsy);
  g.drawImage(tint ? tinted(sprite, tint) : sprite.bmp, -w / 2, -h, w, h);
  // face overlay: blink + mouth (positions from the cut-out guess, adjustable per character)
  const f = sprite.face, fx = (f.x - 0.5) * w, eyeY = -h + f.eyeY * h, mouthY = -h + f.mouthY * h, fw = w * 0.12;
  const blink = ((lt + (ch.x * 7)) % 3.4) < 0.12;
  if (blink) { g.fillStyle = 'rgba(30,20,40,.85)'; g.fillRect(fx - fw * 1.3, eyeY - 2, fw * 2.6, 5); }
  if (talking) { const o = Math.max(0, mouthOpen); g.fillStyle = '#2a1020'; g.beginPath(); g.ellipse(fx, mouthY, fw * 0.45, 2 + o * fw * 0.42, 0, 0, 7); g.fill(); if (o > 0.4) { g.fillStyle = '#e8577a'; g.beginPath(); g.ellipse(fx, mouthY + o * fw * 0.2, fw * 0.25, o * fw * 0.15, 0, 0, 7); g.fill(); } }
  g.restore();
  // expression extras
  const headX = baseX, headY = baseY - h * 0.98;
  g.save(); g.font = '700 38px Inter, system-ui, sans-serif'; g.textAlign = 'center';
  if (expr === 'surprised' && lt < 1.6) { g.fillStyle = '#ffd166'; g.fillText('!', headX + w * 0.32, headY + 10); }
  if (expr === 'happy' && ch.action === 'dance') { g.fillStyle = '#ffd166'; g.fillText('♪', headX - w * 0.4 + Math.sin(lt * 3) * 8, headY + 30); }
  if (expr === 'angry') { g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(headX + w * 0.34, headY + 6 - (lt * 30) % 30, 9, 0, 7); g.fill(); }
  if (expr === 'sad') { g.fillStyle = 'rgba(120,180,255,.9)'; const ty = (lt * 60) % 50; g.beginPath(); g.arc(headX + (f.x - 0.5) * w + w * 0.08, baseY - h + f.eyeY * h + 12 + ty, 4, 0, 7); g.fill(); }
  if (ch.action === 'wave') { g.font = '48px "Apple Color Emoji","Segoe UI Emoji",system-ui'; g.save(); g.translate(headX + w * 0.48, headY + h * 0.25); g.rotate(Math.sin(lt * 9) * 0.5); g.fillText('👋', 0, 0); g.restore(); }
  g.restore();
}

// ---------------------------------------------------------------- frame
// m: { style, shots:[{bgImg, chars, lines, weather, camera}], castById:{id:{sprite,name}} }, part from animTimeline, lt = time in shot
export function drawShot(g, m, part, lt, opts = {}) {
  const s = m.shots[part.i], dur = part.dur;
  const u = lt / dur;
  const cam = { x: 0, z: 1, sx: 0, sy: 0 };
  if (s.camera === 'push-in') cam.z = 1 + 0.12 * ease(u);
  if (s.camera === 'pull-out') cam.z = 1.14 - 0.12 * ease(u);
  if (s.camera === 'pan-left') cam.x = 1 - 2 * u;
  if (s.camera === 'pan-right') cam.x = -1 + 2 * u;
  if (s.camera === 'shake') { cam.sx = Math.sin(lt * 31) * 5; cam.sy = Math.cos(lt * 27) * 4; cam.z = 1.04; }
  g.save(); g.fillStyle = '#0a0614'; g.fillRect(0, 0, W, H);
  g.translate(W / 2 + cam.sx, H / 2 + cam.sy); g.scale(cam.z, cam.z); g.translate(-W / 2, -H / 2);
  // far layer: background plate, moves least (parallax)
  if (s.bgImg) { const b = s.bgImg.bmp, sc = Math.max(W / b.width, H / b.height) * 1.12; const bw = b.width * sc, bh = b.height * sc; g.drawImage(b, (W - bw) / 2 - cam.x * W * 0.035, (H - bh) / 2, bw, bh); }
  else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3b1670'); gr.addColorStop(1, '#120a22'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  // mid layer: soft haze near the ground
  const hz = g.createLinearGradient(0, H * 0.6, 0, H); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(1, 'rgba(10,5,25,.35)'); g.fillStyle = hz; g.fillRect(0, 0, W, H);
  // who's talking now
  const cur = part.lines.find((l) => lt >= l.start && lt < l.start + l.dur);
  const mouth = cur ? Math.abs(Math.sin((lt - cur.start) * 13)) * (0.6 + 0.4 * Math.sin((lt - cur.start) * 5.3)) : 0;
  const order = [...s.chars].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const ch of order) {
    const c = m.castById[ch.cid]; if (!c || !c.sprite) continue;
    const talking = !!cur && cur.who === ch.cid && (opts.liveMouth ? opts.liveMouth() : true);
    drawPuppet(g, ch, c.sprite, lt, dur, talking, opts.liveMouth ? opts.liveMouth() : mouth, cam);
  }
  g.restore();
  // near layer: weather moves most
  weather(g, s.weather, lt + part.i * 7, cam);
  // cut flash at the start of a shot
  if (lt < 0.18) { g.fillStyle = `rgba(0,0,0,${1 - lt / 0.18})`; g.fillRect(0, 0, W, H); }
  // dialogue caption
  if (cur) {
    const who = cur.who === 'narrator' ? '' : (m.castById[cur.who]?.name || '');
    const a = Math.min(1, (lt - cur.start) / 0.2) * Math.min(1, (cur.start + cur.dur - lt) / 0.2);
    caption(g, who, cur.text, a);
  }
}
function caption(g, who, text, alpha) {
  g.save(); g.globalAlpha = Math.max(0, alpha); g.font = '600 34px Inter, system-ui, sans-serif';
  const words = String(text).split(/\s+/), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W * 0.78 && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  const lh = 44, bh = lines.length * lh + (who ? 40 : 0) + 24, y = H - bh - 28;
  g.fillStyle = 'rgba(8,4,18,.72)'; const bw = W * 0.84; g.beginPath(); g.roundRect ? g.roundRect((W - bw) / 2, y, bw, bh, 18) : g.rect((W - bw) / 2, y, bw, bh); g.fill();
  g.textAlign = 'center'; let ty = y + 40;
  if (who) { g.fillStyle = '#ffd166'; g.font = '800 26px "Space Grotesk", Inter, system-ui, sans-serif'; g.fillText(who.toUpperCase(), W / 2, ty - 6); ty += 36; g.font = '600 34px Inter, system-ui, sans-serif'; }
  g.fillStyle = '#fff'; lines.forEach((l, i) => g.fillText(l, W / 2, ty + i * lh));
  g.restore();
}
export function voiceFor(voices, preset) {
  const v = preset || MOVIE_VOICES[0];
  let list = voices; if (v.lang) { const l = list.filter((x) => v.lang.test(x.lang)); if (l.length) list = l; }
  if (v.hint) { const h = list.find((x) => v.hint.test(x.name)); if (h) return h; }
  return list.find((x) => /^en/i.test(x.lang)) || list[0] || null;
}
