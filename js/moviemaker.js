// Kemy AI Movie Maker. 100% free and client-side:
//  - script: Pollinations text API (no key), with a built-in template writer as the fallback
//  - scene art: Pollinations image API (no key), one seed + style per movie for a consistent look
//  - narration: the browser's own speech voices (preview); captions are burned into the video
//  - music: original loops synthesised with WebAudio in this file
//  - render: <canvas> + MediaRecorder (MP4 where supported, else WebM), then download or post to Community Movies
// Free Pollinations calls are rate limited per IP (≈1 image / 45 s, 1 text / 30 s); a queue waits for
// Retry-After and retries. See docs/ai-movie-maker.md.
import * as AN from './animator.js';
const TEXT_API = 'https://text.pollinations.ai/openai';
const IMG_API = 'https://image.pollinations.ai/prompt/';
const W = 1280, H = 720, FPS = 30;
export const STYLES = {
  cartoon: { name: 'Cartoon', genre: 'Animation', prompt: 'colorful 2D cartoon illustration, bold clean outlines, flat shading, family friendly animated film still' },
  anime: { name: 'Anime', genre: 'Animation', prompt: 'anime film still, cel shaded, vibrant colors, detailed background, studio quality animation' },
  cinematic: { name: 'Cinematic', genre: 'Drama', prompt: 'cinematic film still, dramatic lighting, shallow depth of field, 35mm, color graded, highly detailed' },
  comic: { name: 'Comic', genre: 'Action', prompt: 'comic book panel art, halftone dots, bold ink lines, dynamic composition, vivid colors' },
  claymation: { name: 'Claymation', genre: 'Animation', prompt: 'claymation stop motion still, handmade plasticine characters, soft studio lighting, miniature set' }
};
const MOODS = { theme: 'Kemy theme: Stand Up Strong (Lone Keem)', upbeat: 'Upbeat', calm: 'Calm', epic: 'Epic', spooky: 'Spooky', none: 'No music' };

// ---------------------------------------------------------------- safety
const BLOCK = [
  /\b(nude|nudity|naked|nsfw|porn\w*|sex\w*|erotic\w*|hentai|lingerie|topless|strip(per|tease)|fetish|onlyfans|boobs?|genitals?)\b/i,
  /\b(gore|gory|decapitat\w*|dismember\w*|disembowel\w*|mutilat\w*|torture\w*|beheading|blood\s*bath|guts\s+spill\w*|snuff)\b/i,
  /\b(deepfake|face\s*swap|undress\w*|real\s+person|real\s+photo\s+of)\b/i,
  /\b(trump|biden|obama|kamala|harris|putin|zelensky|elon\s*musk|taylor\s*swift|beyonc[eé]|drake|kanye|rihanna|oprah|pope\s+\w+|king\s+charles|modi|xi\s+jinping|kim\s+jong)\b/i,
  /\b(child|kid|minor|teen|underage|loli)\w*\b[^.]{0,40}\b(nude|naked|sex\w*|erotic\w*)\b/i
];
const COPYRIGHT = /\b(mickey\s*mouse|disney|pixar|marvel|spider-?man|batman|superman|avengers|pok[eé]mon|pikachu|mario|sonic|harry\s*potter|star\s*wars|darth\s*vader|frozen|elsa|shrek|minions?|naruto|goku|dragon\s*ball|barbie|hello\s*kitty|spongebob|simpsons|peppa\s*pig|paw\s*patrol)\b/i;
export function checkPrompt(t) {
  const s = String(t || '');
  if (BLOCK.slice(0, 2).some((r) => r.test(s)) || BLOCK[4].test(s)) return 'Keep it family-friendly: no sexual content or gore.';
  if (BLOCK[2].test(s) || BLOCK[3].test(s)) return 'Real people and deepfakes aren’t allowed. Make up your own characters.';
  if (COPYRIGHT.test(s)) return 'Keep it original: no copyrighted characters or franchises.';
  return '';
}

// ---------------------------------------------------------------- free-API queue (one request at a time, waits on 402/429)
function makeQueue(minGapMs) {
  let chain = Promise.resolve(), last = 0;
  return (task) => {
    const run = chain.then(async () => { const wait = last + minGapMs - Date.now(); if (wait > 0) await sleep(wait); try { return await task(); } finally { last = Date.now(); } });
    chain = run.catch(() => {});
    return run;
  };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textQ = makeQueue(1500), imgQ = makeQueue(1500);
async function withRetry(fn, { tries = 4, onWait } = {}) {
  for (let a = 1; ; a++) {
    try { return await fn(); } catch (e) {
      if (a >= tries || !e.retry) throw e;
      const ms = Math.min(90000, e.retryAfter ? e.retryAfter * 1000 : 4000 * a);
      onWait && onWait(ms); await sleep(ms);
    }
  }
}
const httpErr = (r) => { const e = new Error(r.status === 402 || r.status === 429 ? 'The free AI service is busy.' : `AI service error ${r.status}`); e.retry = r.status === 402 || r.status === 429 || r.status >= 500; e.retryAfter = Number(r.headers.get('Retry-After')) || 0; return e; };

// ---------------------------------------------------------------- script writer
const cleanLine = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
export async function writeScript({ idea, style, scenes, onWait, castHint = '', recap = '' }) {
  const sys = 'You write very short, original, family-friendly animated movie scripts. Never use real people, celebrities or copyrighted characters. Reply with JSON only.';
  const user = `Write a ${scenes}-scene short movie in a ${STYLES[style].name.toLowerCase()} style about: "${idea}".
Return JSON: {"title": string (max 6 words), "scenes": [{"narration": string (one or two sentences, max 28 words, spoken by a narrator), "prompt": string (a vivid visual description of the scene for an image generator, max 40 words, describe the same main characters consistently, no text in the image)}]}. Exactly ${scenes} scenes with a beginning, middle and satisfying ending.${castHint ? ` Keep these exact main characters and describe them the same way in every prompt: ${castHint}.` : ''}${recap ? ` This is the next episode of a series. Previously: ${recap}. Continue the story.` : ''}`;
  try {
    const out = await textQ(() => withRetry(async () => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
      try {
        const r = await fetch(TEXT_API, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
          body: JSON.stringify({ model: 'openai', seed: Math.floor(Math.random() * 1e6), response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
        if (!r.ok) throw httpErr(r);
        const j = await r.json(); const txt = j.choices?.[0]?.message?.content || '';
        const m = txt.match(/\{[\s\S]*\}/); const data = JSON.parse(m ? m[0] : txt);
        if (!Array.isArray(data.scenes) || data.scenes.length < 2) throw new Error('bad script');
        return data;
      } catch (e) { if (e.name === 'AbortError') { e.retry = true; } else if (e instanceof SyntaxError || e.message === 'bad script') e.retry = true; throw e; } finally { clearTimeout(t); }
    }, { tries: 3, onWait }));
    const list = out.scenes.slice(0, scenes).map((s) => ({ narration: cleanLine(s.narration, 220), prompt: cleanLine(s.prompt || s.narration, 300) }));
    if (list.some((s) => checkPrompt(s.narration + ' ' + s.prompt))) throw new Error('unsafe');
    while (list.length < scenes) list.push(...templateScript(idea, scenes).scenes.slice(list.length, list.length + 1));
    return { title: cleanLine(out.title, 60) || titleFrom(idea), scenes: list, source: 'ai' };
  } catch { return { ...templateScript(idea, scenes), source: 'template' }; }
}
async function askJson(sys, user, onWait) {
  return textQ(() => withRetry(async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 60000);
    try {
      const r = await fetch(TEXT_API, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ model: 'openai', seed: Math.floor(Math.random() * 1e6), response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] }) });
      if (!r.ok) throw httpErr(r);
      const j = await r.json(); const txt = j.choices?.[0]?.message?.content || ''; const m = txt.match(/\{[\s\S]*\}/);
      return JSON.parse(m ? m[0] : txt);
    } catch (e) { if (e.name === 'AbortError' || e instanceof SyntaxError) e.retry = true; throw e; } finally { clearTimeout(t); }
  }, { tries: 3, onWait }));
}
// Animated mode: cast + shots (see js/animator.js)
export async function writeAnimatedScript({ idea, style, shots, onWait, castHint = '', recap = '' }) {
  const sys = 'You write very short, original, family-friendly animated cartoon scripts with dialogue. Never use real people, celebrities or copyrighted characters. Reply with JSON only.';
  try {
    const data = await askJson(sys, AN.animatedPrompt({ idea, style: STYLES[style].name.toLowerCase(), shots, castHint, recap }), onWait);
    const out = AN.normalizeScript(data, idea, shots);
    if (out.shots.length < 2) throw new Error('short');
    const all = [out.title, ...out.cast.map((c) => c.name + ' ' + c.look), ...out.shots.flatMap((x) => [x.bg, ...x.lines.map((l) => l.text)])].join(' ');
    if (checkPrompt(all)) throw new Error('unsafe');
    while (out.shots.length < shots) out.shots.push(JSON.parse(JSON.stringify(out.shots[out.shots.length - 1])));
    return { ...out, title: out.title || titleFrom(idea), source: 'ai' };
  } catch { return { ...AN.templateAnimated(idea, shots), source: 'template' }; }
}
const titleFrom = (idea) => cleanLine(idea, 60).replace(/^(a|an|the)\s+/i, '').split(' ').slice(0, 5).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') || 'My Kemy Movie';
export function templateScript(idea, n) {
  const hero = cleanLine(idea, 120) || 'a small hero with a big dream';
  const beats = [
    ['Once upon a time, there was {h}.', 'establishing wide shot introducing {h}, peaceful morning'],
    ['Every day felt the same, until something unexpected happened.', '{h} discovering a mysterious glowing clue'],
    ['Curious and a little nervous, the journey began.', '{h} setting off on a journey across a winding path'],
    ['The road was long, full of surprises and new friends.', '{h} meeting a friendly new companion on the road'],
    ['Then came the biggest challenge of all.', '{h} facing a huge obstacle, dramatic sky'],
    ['For a moment, it felt impossible.', '{h} looking worried in the rain, close up'],
    ['But friends never give up on each other.', '{h} and friends working together, determined'],
    ['With one brave idea, everything changed.', '{h} having a bright idea, light bursting around'],
    ['They gave it everything they had.', 'action shot of {h} racing forward, motion and energy'],
    ['And at last, they did it!', '{h} celebrating a victory, confetti and sparkles'],
    ['Back home, the world looked a little brighter.', '{h} returning home at golden hour, warm light'],
    ['And that was only the beginning. The end.', '{h} looking at the stars, hopeful, wide shot']
  ];
  const pick = n >= beats.length ? beats : [beats[0], ...spread(beats.slice(1, -1), n - 2), beats[beats.length - 1]];
  return { title: titleFrom(idea), scenes: pick.slice(0, n).map(([a, b]) => ({ narration: a.replace('{h}', hero), prompt: b.replaceAll('{h}', hero) })) };
}
function spread(arr, k) { if (k <= 0) return []; const out = []; for (let i = 0; i < k; i++) out.push(arr[Math.floor((i * arr.length) / k)]); return out; }

// ---------------------------------------------------------------- images
export function imageUrl(prompt, style, seed) {
  const p = `${prompt}, ${STYLES[style].prompt}, no text, no watermark`;
  return `${IMG_API}${encodeURIComponent(p.slice(0, 600))}?width=1024&height=576&seed=${seed}&nologo=true&safe=true&model=flux`;
}
export async function fetchImage(url, onWait) {
  return imgQ(() => withRetry(async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 120000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw httpErr(r);
      const ct = r.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) { const e = new Error('No image returned'); e.retry = true; throw e; }
      const blob = await r.blob(); const bmp = await createImageBitmap(blob);
      return { blob, bmp, url: URL.createObjectURL(blob) };
    } catch (e) { if (e.name === 'AbortError') e.retry = true; throw e; } finally { clearTimeout(t); }
  }, { tries: 5, onWait }));
}
// Offline fallback art: purple/gold gradient with soft shapes (used when the free image API is unavailable).
export async function placeholderArt(text, seed) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1024, 576) : Object.assign(document.createElement('canvas'), { width: 1024, height: 576 });
  const g = c.getContext('2d'); const rnd = mulberry(seed);
  const gr = g.createLinearGradient(0, 0, 1024, 576); gr.addColorStop(0, `hsl(${260 + rnd() * 30} 70% 25%)`); gr.addColorStop(1, `hsl(${290 + rnd() * 40} 70% 45%)`);
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 576);
  for (let i = 0; i < 14; i++) { g.fillStyle = `hsla(${40 + rnd() * 20} 95% 60% / ${0.08 + rnd() * 0.15})`; g.beginPath(); g.arc(rnd() * 1024, rnd() * 576, 20 + rnd() * 140, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '600 34px Inter, system-ui, sans-serif'; g.textAlign = 'center';
  wrap(g, text, 860).slice(0, 3).forEach((l, i) => g.fillText(l, 512, 260 + i * 44));
  const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }) : await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
  return { blob, bmp: await createImageBitmap(blob), url: URL.createObjectURL(blob), placeholder: true };
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wrap(g, text, maxW) { const words = String(text).split(/\s+/); const lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }

// ---------------------------------------------------------------- music
// Kemy's theme song (default): "Stand Up Strong" (Instrumental), written by Lone Keem. Loops to fit the movie.
let themeBuf = null;
function themeMusic(ac, dest, seconds) {
  const out = ac.createGain(); out.gain.value = 0.0001; out.connect(dest);
  let src = null, stopped = false;
  const t0 = ac.currentTime + 0.05;
  out.gain.exponentialRampToValueAtTime(0.5, t0 + 1.5); out.gain.setValueAtTime(0.5, t0 + Math.max(2, seconds - 2.5)); out.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  (async () => {
    try {
      if (!themeBuf) { const r = await fetch(new URL('../assets/audio/kemy-theme.mp3', import.meta.url)); if (!r.ok) throw new Error('theme ' + r.status); themeBuf = await ac.decodeAudioData(await r.arrayBuffer()); }
      if (stopped) return;
      src = ac.createBufferSource(); src.buffer = themeBuf; src.loop = true; src.connect(out);
      const off = Math.max(0, ac.currentTime - t0); src.start(ac.currentTime, off % themeBuf.duration); src.stop(t0 + seconds + 0.1);
    } catch (e) { console.warn('theme music unavailable', e); }
  })();
  return () => { stopped = true; try { src && src.stop(); } catch { /* */ } out.disconnect(); };
}
// original loops, synthesised
const PROG = { upbeat: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], calm: [[0, 4, 7, 11], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 17]], epic: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], spooky: [[0, 3, 6], [1, 4, 8], [0, 3, 7], [11, 14, 17]] };
const ROOT = { upbeat: 60, calm: 57, epic: 50, spooky: 52 }, BPM = { upbeat: 112, calm: 72, epic: 84, spooky: 66 };
export function startMusic(ac, dest, mood, seconds) {
  if (mood === 'none') return () => {};
  if (mood === 'theme') return themeMusic(ac, dest, seconds);
  const out = ac.createGain(); out.gain.value = 0.0001; out.connect(dest);
  const t0 = ac.currentTime + 0.05; out.gain.exponentialRampToValueAtTime(0.32, t0 + 1.5); out.gain.setValueAtTime(0.32, t0 + Math.max(2, seconds - 2.5)); out.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  const beat = 60 / BPM[mood], bar = beat * 4, nodes = [];
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const note = (m, at, dur, type, vol) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(m); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, at + dur); o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.05); nodes.push(o); };
  const noise = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const hat = (at, vol) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06); s.connect(f).connect(g).connect(out); s.start(at); s.stop(at + 0.1); nodes.push(s); };
  const kick = (at) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.15); g.gain.setValueAtTime(0.7, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.2); o.connect(g).connect(out); o.start(at); o.stop(at + 0.25); nodes.push(o); };
  const prog = PROG[mood], root = ROOT[mood];
  for (let b = 0; b * bar < seconds; b++) {
    const at = t0 + b * bar, ch = prog[b % prog.length];
    ch.forEach((iv) => note(root + iv, at, bar * 0.95, mood === 'spooky' ? 'sine' : 'triangle', mood === 'epic' ? 0.07 : 0.05));
    note(root - 12 + ch[0], at, bar * 0.9, 'sine', 0.12);
    for (let k = 0; k < 8; k++) {
      const st = at + k * beat / 2;
      if (mood === 'upbeat' || mood === 'epic') { if (k % 4 === 0) kick(st); hat(st, k % 2 ? 0.05 : 0.08); }
      if (mood !== 'spooky' && (k % 2 === 0)) note(root + 12 + ch[(k / 2 + b) % ch.length], st, beat * 0.45, 'square', mood === 'calm' ? 0.015 : 0.02);
      if (mood === 'spooky' && k === 6) note(root + 24 + ch[2], st, beat, 'sine', 0.03);
    }
  }
  return () => { nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }); out.disconnect(); };
}

// ---------------------------------------------------------------- timeline + drawing
const TITLE_S = 3.2, END_S = 3.4, FADE = 0.7, RECAP_S = 5;
export const sceneSeconds = (s) => Math.min(9, Math.max(4.2, 1.4 + String(s.narration || '').split(/\s+/).length * 0.36));
// Whole-movie plan: optional "Previously on…" card, title, scenes (slideshow) or shots (animated), end card.
export function plan(m) {
  const recap = m.recap ? RECAP_S : 0, t0 = recap + TITLE_S;
  if (m.mode === 'anim') { const a = AN.animTimeline(m.shots, t0); return { mode: 'anim', recap, parts: a.parts, total: a.end + END_S }; }
  let t = t0; const parts = m.scenes.map((s, i) => { const d = sceneSeconds(s); const p = { i, start: t, dur: d }; t += d; return p; });
  return { mode: 'slides', recap, parts, total: t + END_S };
}
function drawRecap(g, m, t) {
  bg(g, t); const a = Math.min(1, t / 0.6) * Math.min(1, (RECAP_S - t) / 0.5);
  g.save(); g.globalAlpha = Math.max(0, a); g.textAlign = 'center';
  g.fillStyle = '#ffd166'; g.font = '700 26px Inter, system-ui, sans-serif'; g.fillText(`PREVIOUSLY ON ${String(m.seriesTitle || '').toUpperCase()}…`, W / 2, H / 2 - 110);
  g.fillStyle = '#fff'; g.font = '500 36px Inter, system-ui, sans-serif'; wrap(g, m.recap, W * 0.78).slice(0, 4).forEach((l, i) => g.fillText(l, W / 2, H / 2 - 40 + i * 50));
  if (m.epLabel) { g.fillStyle = '#c9a8ff'; g.font = '600 24px Inter, system-ui, sans-serif'; g.fillText('Next: ' + m.epLabel, W / 2, H / 2 + 170); }
  g.restore();
}
export function timeline(scenes) { let t = TITLE_S; const parts = scenes.map((s, i) => { const d = sceneSeconds(s); const p = { i, start: t, dur: d }; t += d; return p; }); return { parts, total: t + END_S }; }
function drawCover(g, bmp, t, dur, seed) {
  const r = mulberry(seed), zoomIn = r() > 0.4, z0 = zoomIn ? 1.04 : 1.16, z1 = zoomIn ? 1.16 : 1.04;
  const dx = (r() - 0.5) * 0.08, dy = (r() - 0.5) * 0.06, k = Math.min(1, Math.max(0, t / dur)), e = k * k * (3 - 2 * k);
  const z = z0 + (z1 - z0) * e, s = Math.max(W / bmp.width, H / bmp.height) * z;
  const w = bmp.width * s, h = bmp.height * s;
  g.drawImage(bmp, (W - w) / 2 + dx * W * (e - 0.5), (H - h) / 2 + dy * H * (e - 0.5), w, h);
}
function drawCaption(g, text, alpha) {
  if (!text) return; g.save(); g.globalAlpha = alpha; g.font = '600 38px Inter, system-ui, sans-serif'; g.textAlign = 'center';
  const lines = wrap(g, text, W * 0.8).slice(0, 3), lh = 50, y0 = H - 46 - lines.length * lh;
  const bw = Math.max(...lines.map((l) => g.measureText(l).width)) + 56;
  g.fillStyle = 'rgba(8,3,20,.62)'; roundRect(g, (W - bw) / 2, y0 - 10, bw, lines.length * lh + 24, 18); g.fill();
  g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; lines.forEach((l, i) => g.fillText(l, W / 2, y0 + 30 + i * lh)); g.restore();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function bg(g, t) { const gr = g.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.75); gr.addColorStop(0, '#3b1670'); gr.addColorStop(1, '#07030f'); g.fillStyle = gr; g.fillRect(0, 0, W, H); for (let i = 0; i < 40; i++) { const x = (i * 197 + t * 18 * (1 + (i % 3))) % W, y = (i * 113) % H; g.fillStyle = `rgba(255,${200 + (i % 3) * 18},90,${0.15 + 0.15 * Math.sin(t * 2 + i)})`; g.fillRect(x, y, 2, 2); } }
function drawTitle(g, title, style, t, epLabel) {
  bg(g, t); const a = Math.min(1, t / 0.8) * Math.min(1, (TITLE_S - t) / 0.5 + 0.2);
  g.save(); g.globalAlpha = Math.max(0, a); g.textAlign = 'center'; g.fillStyle = '#ffd166'; g.font = '700 22px Inter, system-ui, sans-serif'; g.fillText(epLabel ? 'A KEMY AI SERIES · ' + epLabel : 'A KEMY AI MOVIE', W / 2, H / 2 - 70);
  g.fillStyle = '#fff'; g.font = '800 72px "Space Grotesk", Inter, system-ui, sans-serif'; wrap(g, title, W * 0.85).slice(0, 2).forEach((l, i, arr) => g.fillText(l, W / 2, H / 2 + 10 + (i - (arr.length - 1) / 2) * 80));
  g.fillStyle = '#c9a8ff'; g.font = '500 24px Inter, system-ui, sans-serif'; g.fillText(STYLES[style].name + ' · Made with AI', W / 2, H / 2 + 110); g.restore();
}
function drawEnd(g, t, author) {
  bg(g, t + 10); const a = Math.min(1, t / 0.6); g.save(); g.globalAlpha = a; g.textAlign = 'center';
  g.fillStyle = '#fff'; g.font = '800 54px "Space Grotesk", Inter, system-ui, sans-serif'; g.fillText('Made with Kemy AI Movie Maker', W / 2, H / 2 - 10);
  g.fillStyle = '#ffd166'; g.font = '600 26px Inter, system-ui, sans-serif'; g.fillText(author ? `by @${author} · Kemy by Lone Keem Studios` : 'Kemy by Lone Keem Studios', W / 2, H / 2 + 44);
  g.fillStyle = '#c9a8ff'; g.font = '500 22px Inter, system-ui, sans-serif'; g.fillText('lonekeem.github.io', W / 2, H / 2 + 86); g.restore();
}
export function drawFrame(g, m, t, author) {
  const tl = m._tl || (m._tl = plan(m));
  if (t < tl.recap) { drawRecap(g, m, t); return; }
  if (t - tl.recap < TITLE_S) { t -= tl.recap; drawTitle(g, m.title, m.style, t, m.epLabel); if (m.mode !== 'anim' && t > TITLE_S - FADE && m.scenes[0]?.img) { g.globalAlpha = (t - (TITLE_S - FADE)) / FADE; drawCover(g, m.scenes[0].img.bmp, 0, tl.parts[0].dur, m.seed); g.globalAlpha = 1; } return; }
  if (t >= tl.total - END_S) { drawEnd(g, t - (tl.total - END_S), author); return; }
  const p = tl.parts.find((x) => t >= x.start && t < x.start + x.dur) || tl.parts[tl.parts.length - 1];
  if (m.mode === 'anim') { AN.drawShot(g, m, p, t - p.start); return; }
  const s = m.scenes[p.i], lt = t - p.start;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (s.img) drawCover(g, s.img.bmp, lt, p.dur, m.seed + p.i * 101);
  const nx = tl.parts[p.i + 1];
  if (lt > p.dur - FADE) { const a = (lt - (p.dur - FADE)) / FADE; g.globalAlpha = a; if (nx && m.scenes[nx.i].img) drawCover(g, m.scenes[nx.i].img.bmp, 0, nx.dur, m.seed + nx.i * 101); else { g.fillStyle = '#07030f'; g.fillRect(0, 0, W, H); } g.globalAlpha = 1; }
  drawCaption(g, s.narration, Math.min(1, lt / 0.4) * Math.min(1, (p.dur - lt) / 0.4));
}

// ---------------------------------------------------------------- UI
export function createMovieMaker(ctx) {
  const { S, main, esc, toast, friendlyError, publishMovie, series: SER, pre = {} } = ctx;
  let m = null; // slideshow: { mode:'slides', idea, style, mood, voice, title, scenes:[{narration,prompt,seed,img}], seed }
  //               animated:  { mode:'anim', ..., cast:[{id,name,look,voice,img,sprite}], castById, shots:[{bg,chars,lines,weather,camera,seed,bgImg}] }
  let ser = null; // series this is the next episode of (owner only)
  const voices = () => (window.speechSynthesis ? speechSynthesis.getVoices().filter((v) => /^en|^es|^fr|^pt|^de/i.test(v.lang)) : []);
  async function page(token) {
    main.innerHTML = `<div class="mm">
      <a class="back-link" href="#/new/menu">← Create</a>
      <h1 class="page-title">✨ Kemy AI Movie Maker</h1>
      <p class="muted" style="margin-top:-6px">Type an idea, pick a style, and Kemy writes the script, paints every scene and turns it into a movie with captions, narration and music. Free.</p>
      <div id="mm-series"></div>
      <form class="card pad mm-form" id="mm-form" novalidate>
        <fieldset class="mm-styles mm-modes"><legend>Kind of movie</legend>
          <label><input type="radio" name="mm-mode" value="anim" checked><span>🎭 Animated<small>characters move, talk and act</small></span></label>
          <label><input type="radio" name="mm-mode" value="slides"><span>🖼️ Storybook<small>painted scenes with pan + zoom</small></span></label></fieldset>
        <div class="field"><div class="row"><label for="mm-idea">Your movie idea</label><span class="spacer"></span><span class="small muted" id="mm-idea-n">0/300</span></div>
          <textarea id="mm-idea" maxlength="300" rows="3" placeholder="e.g. A shy robot who learns to dance at the city’s first moon festival"></textarea></div>
        <fieldset class="mm-styles"><legend>Style</legend>${Object.entries(STYLES).map(([k, v], i) => `<label><input type="radio" name="mm-style" value="${k}" ${i ? '' : 'checked'}><span>${v.name}</span></label>`).join('')}</fieldset>
        <div class="mm-row">
          <div class="field"><label for="mm-n" id="mm-n-l">Shots</label><select id="mm-n">${[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
          <div class="field"><label for="mm-mood">Music</label><select id="mm-mood">${Object.entries(MOODS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="field"><label for="mm-voice">Narrator voice</label><select id="mm-voice"><option value="">Default voice</option></select></div>
        </div>
        <p class="notice small mm-note">🛡️ Keep it original and family-friendly: no copyrighted characters, real people, sexual content or gore. Movies you post follow the <a href="guidelines.html" target="_blank">Community Guidelines</a>.</p>
        <p class="form-error" id="mm-err"></p>
        <button class="btn btn-block" id="mm-go" type="submit">Write my movie</button>
        <p class="small muted mm-free">Uses free AI services, which allow about one picture every 45 seconds per person. Animated movies paint one picture per character plus one per shot, so a 4-shot cartoon with 2 characters takes about 5 minutes. Kemy waits and retries for you.</p>
      </form>
      <div id="mm-work"></div></div>`;
    const $ = (s) => main.querySelector(s);
    $('#mm-idea').oninput = () => ($('#mm-idea-n').textContent = `${$('#mm-idea').value.length}/300`);
    const mode = () => main.querySelector('input[name=mm-mode]:checked').value;
    main.querySelectorAll('input[name=mm-mode]').forEach((r) => (r.onchange = () => { $('#mm-n-l').textContent = mode() === 'anim' ? 'Shots' : 'Scenes'; }));
    const fillVoices = () => { const sel = $('#mm-voice'); if (!sel) return; const cur = sel.value; sel.innerHTML = '<option value="">Default voice</option>' + voices().map((v) => `<option value="${esc(v.name)}">${esc(v.name.replace(/Microsoft |Google /, ''))} (${esc(v.lang)})</option>`).join(''); sel.value = cur; };
    fillVoices(); if (window.speechSynthesis) speechSynthesis.onvoiceschanged = fillVoices;
    // "Make next episode": reuse the series' style, characters and seed
    if (pre.sid && SER) {
      try {
        const s = await SER.load(pre.sid, true);
        if (s && SER.canEdit(s)) {
          ser = s; const eps = [...(s.episodes || [])].sort((a, b) => a.s - b.s || a.e - b.e); const last = eps[eps.length - 1];
          const season = Math.max(1, last ? last.s : 1); const ep = (eps.filter((x) => x.s === season).reduce((mx, x) => Math.max(mx, x.e), 0)) + 1;
          ser._next = { season, ep };
          let recapText = '';
          if (last) { try { const p = (await ctx.getPost?.(last.p)) || null; if (p) recapText = `${p.work.title}. ${p.text || ''}`.slice(0, 220); } catch { /* */ } }
          $('#mm-series').innerHTML = `<div class="card pad mm-ser"><span class="sb-series">NEXT EPISODE</span> <b>${esc(s.title)}</b> · S${season} E${ep}
            <p class="small muted">${s.ai ? 'Kemy reuses this series’ style, characters and seed so the new episode matches.' : 'This episode’s style and characters will be saved to the series so future episodes match.'}</p>
            <label class="check small"><input type="checkbox" id="mm-recap" ${recapText ? 'checked' : ''}> <span>Start with a “Previously on ${esc(s.title)}…” card</span></label>
            <textarea id="mm-recap-t" maxlength="220" rows="2" placeholder="What happened last time?">${esc(recapText)}</textarea></div>`;
          if (s.ai?.style && STYLES[s.ai.style]) main.querySelector(`input[name=mm-style][value=${s.ai.style}]`).checked = true;
          if (s.ai?.look === 'anim' || s.ai?.look === 'slides') main.querySelector(`input[name=mm-mode][value=${s.ai.look}]`).checked = true;
          $('#mm-idea').placeholder = 'What happens in this episode?';
        }
      } catch { /* not fatal */ }
    }
    $('#mm-form').onsubmit = async (e) => {
      e.preventDefault(); const err = $('#mm-err'); err.textContent = '';
      if ($('#mm-form').classList.contains('mm-collapsed')) { $('#mm-form').classList.remove('mm-collapsed'); $('#mm-go').textContent = 'Write my movie'; return; }
      const idea = $('#mm-idea').value.trim();
      if (idea.length < 8) { err.textContent = 'Describe your idea in a few words.'; return; }
      const bad = checkPrompt(idea); if (bad) { err.textContent = bad; return; }
      const style = main.querySelector('input[name=mm-style]:checked').value, md = mode();
      const seed = ser?.ai?.seed || Math.floor(Math.random() * 1e6);
      const recap = ser && $('#mm-recap')?.checked ? $('#mm-recap-t').value.trim() : '';
      if (recap && checkPrompt(recap)) { err.textContent = checkPrompt(recap); return; }
      const castHint = ser?.ai?.cast ? ser.ai.cast.map((c) => `${c.name}: ${c.look}`).join('; ') : '';
      m = { mode: md, idea, style, mood: $('#mm-mood').value, voice: $('#mm-voice').value, seed, scenes: [], recap, seriesTitle: ser?.title || '', epLabel: ser ? `S${ser._next.season} E${ser._next.ep}` : '' };
      $('#mm-go').disabled = true; $('#mm-go').textContent = 'Writing the script…';
      const onWait = (ms) => ($('#mm-go').textContent = `AI is busy, retrying in ${Math.ceil(ms / 1000)}s…`);
      const n = Number($('#mm-n').value);
      if (md === 'anim') {
        const sc = await writeAnimatedScript({ idea, style, shots: n, onWait, castHint, recap });
        m.title = sc.title;
        // keep the series' cast (names, looks, voices) so characters stay the same
        if (ser?.ai?.cast?.length) { const keep = ser.ai.cast; sc.cast.forEach((c, i) => { const k = keep.find((x) => x.name.toLowerCase() === c.name.toLowerCase()) || keep[i]; if (k) { c.look = k.look; c.voice = k.voice || c.voice; if (keep.find((x) => x.name.toLowerCase() === c.name.toLowerCase())) c.name = k.name; } }); }
        m.cast = sc.cast.map((c, i) => ({ ...c, seed: seed + 500 + i * 13, img: null, sprite: null })); m.castById = Object.fromEntries(m.cast.map((c) => [c.id, c]));
        m.shots = sc.shots.map((x, i) => ({ ...x, seed: seed + i, bgImg: null }));
        if (sc.source === 'template') toast('The free AI writer is busy, so Kemy wrote a starter cartoon. Edit anything.');
      } else {
        const sc = await writeScript({ idea, style, scenes: n, onWait, castHint, recap });
        m.title = sc.title; m.scenes = sc.scenes.map((x, i) => ({ ...x, seed: seed + i, img: null }));
        if (sc.source === 'template') toast('The free AI writer is busy, so Kemy wrote a starter script. Edit any line.');
      }
      $('#mm-go').disabled = false; $('#mm-go').textContent = 'Start over with a new script';
      $('#mm-form').classList.add('mm-collapsed');
      editor(); paintAll();
    };
  }
  function sceneCard(s, i) {
    return `<div class="mm-scene card" data-i="${i}">
      <div class="mm-art">${s.img ? `<img src="${s.img.url}" alt="Scene ${i + 1}">` : `<div class="mm-wait"><div class="spinner"></div><small>${esc(s.status || 'Waiting in line…')}</small></div>`}<span class="mm-num">${i + 1}</span>${s.img?.placeholder ? '<span class="mm-ph">Placeholder</span>' : ''}</div>
      <div class="mm-fields">
        <label class="small muted">Narration</label><textarea class="mm-nar" maxlength="220" rows="2">${esc(s.narration)}</textarea>
        <details><summary class="small">Picture prompt</summary><textarea class="mm-pr" maxlength="300" rows="3">${esc(s.prompt)}</textarea></details>
        <div class="mm-btns">
          <button type="button" class="btn btn-sm btn-ghost" data-a="regen">↻ New picture</button>
          <label class="btn btn-sm btn-ghost">⬆ Own image<input type="file" accept="image/*" data-a="own" hidden></label>
          <button type="button" class="icon-btn" data-a="up" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button>
          <button type="button" class="icon-btn" data-a="down" aria-label="Move down" ${i < m.scenes.length - 1 ? '' : 'disabled'}>↓</button>
          <button type="button" class="icon-btn" data-a="del" aria-label="Delete scene" ${m.scenes.length > 2 ? '' : 'disabled'}>🗑</button>
        </div></div></div>`;
  }
  function editor() {
    const box = main.querySelector('#mm-work');
    box.innerHTML = `<div class="mm-head"><input id="mm-title" type="text" maxlength="60" value="${esc(m.title)}" aria-label="Movie title"><span class="small muted" id="mm-status"></span></div>
      ${m.mode === 'anim' ? '<h3 class="mm-h">Characters</h3><div class="mm-cast"></div><h3 class="mm-h">Shots</h3>' : ''}
      <div class="mm-scenes"></div>
      <button type="button" class="btn btn-sm btn-ghost" id="mm-add">+ Add a ${m.mode === 'anim' ? 'shot' : 'scene'}</button>
      <div class="card pad mm-out">
        <canvas id="mm-cv" width="${W}" height="${H}"></canvas>
        <div class="pv-progress" id="mm-prog" hidden><span></span></div><p class="small muted" id="mm-rstat"></p>
        <div class="mm-btns">
          <button class="btn btn-ghost" id="mm-play" type="button">▶ Preview with narration</button>
          <button class="btn" id="mm-render" type="button">🎬 Make the video</button>
        </div>
        <label class="check small"><input type="checkbox" id="mm-tabaudio"> <span>Record the narrator voice too (desktop Chrome: share this tab with audio when asked)</span></label>
        <div id="mm-result"></div>
      </div>`;
    const $ = (s) => box.querySelector(s);
    $('#mm-title').oninput = () => { m.title = $('#mm-title').value.trim() || 'My Kemy Movie'; m._tl = null; };
    $('#mm-add').onclick = () => { if (m.mode === 'anim') { if (m.shots.length >= 12) return toast('12 shots max.'); const last = m.shots[m.shots.length - 1]; m.shots.push({ ...JSON.parse(JSON.stringify({ ...last, bgImg: null })), bgImg: last.bgImg, lines: [{ who: 'narrator', text: 'And then…' }] }); m._tl = null; paintScenes(); return; } if (m.scenes.length >= 12) return toast('12 scenes max.'); m.scenes.push({ narration: 'And then…', prompt: m.scenes.at(-1)?.prompt || m.idea, seed: m.seed + m.scenes.length + 50, img: null }); m._tl = null; paintScenes(); loadImages(); };
    $('#mm-play').onclick = () => preview();
    $('#mm-render').onclick = () => render();
    paintScenes();
  }
  const ready = () => (m.mode === 'anim' ? m.shots.every((x) => x.bgImg) && m.cast.every((c) => c.sprite) : m.scenes.every((x) => x.img));
  function paintScenes() {
    if (m.mode === 'anim') return paintAnim();
    const list = main.querySelector('.mm-scenes'); if (!list) return;
    list.innerHTML = m.scenes.map(sceneCard).join('');
    list.querySelectorAll('.mm-scene').forEach((el) => {
      const i = Number(el.dataset.i), s = m.scenes[i];
      el.querySelector('.mm-nar').oninput = (e) => { s.narration = e.target.value; m._tl = null; };
      el.querySelector('.mm-pr').onchange = (e) => { const bad = checkPrompt(e.target.value); if (bad) { toast(bad); e.target.value = s.prompt; return; } s.prompt = e.target.value; };
      el.querySelector('[data-a=regen]').onclick = () => { const bad = checkPrompt(s.prompt); if (bad) return toast(bad); s.seed += 7919; s.img = null; s.status = ''; paintScenes(); loadImages(); };
      el.querySelector('[data-a=own]').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 10 * 1048576) return toast('Images can be up to 10 MB.'); s.img = { blob: f, bmp: await createImageBitmap(f), url: URL.createObjectURL(f) }; paintScenes(); };
      el.querySelector('[data-a=up]').onclick = () => { [m.scenes[i - 1], m.scenes[i]] = [m.scenes[i], m.scenes[i - 1]]; m._tl = null; paintScenes(); };
      el.querySelector('[data-a=down]').onclick = () => { [m.scenes[i + 1], m.scenes[i]] = [m.scenes[i], m.scenes[i + 1]]; m._tl = null; paintScenes(); };
      el.querySelector('[data-a=del]').onclick = () => { m.scenes.splice(i, 1); m._tl = null; paintScenes(); };
    });
    const done = m.scenes.filter((s) => s.img).length, st = main.querySelector('#mm-status');
    if (st) st.textContent = done < m.scenes.length ? `Painting scenes: ${done}/${m.scenes.length}` : `${m.scenes.length} scenes ready · ${Math.round(plan(m).total)}s`;
    const r = main.querySelector('#mm-render'); if (r) r.disabled = done < m.scenes.length;
  }
  // ------------------------------------------------ animated editor: cast + per-shot controls
  const opt = (obj, v) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  function paintAnim() {
    const cast = main.querySelector('.mm-cast'), list = main.querySelector('.mm-scenes'); if (!cast || !list) return;
    cast.innerHTML = m.cast.map((c, i) => `<div class="mm-char card" data-c="${i}">
      <div class="mm-cimg">${c.sprite ? `<canvas width="160" height="200" class="mm-cprev" title="Tap your character's mouth to line up the talking mouth"></canvas>` : `<div class="mm-wait"><div class="spinner"></div><small>${esc(c.status || 'Waiting in line…')}</small></div>`}</div>
      <div class="mm-fields"><input class="mm-cname" type="text" maxlength="24" value="${esc(c.name)}" aria-label="Character name">
        <details><summary class="small">Look</summary><textarea class="mm-clook" maxlength="200" rows="3">${esc(c.look)}</textarea></details>
        <label class="small muted">Voice</label><select class="mm-cvoice">${AN.MOVIE_VOICES.map((v) => `<option value="${v.id}" ${v.id === c.voice ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
        <div class="mm-btns"><button type="button" class="btn btn-sm btn-ghost" data-a="ctest">▶ Voice</button><button type="button" class="btn btn-sm btn-ghost" data-a="cregen">↻ Redraw</button><label class="btn btn-sm btn-ghost">⬆ Own image<input type="file" accept="image/*" data-a="cown" hidden></label></div>
        ${c.sprite && !c.sprite.ok ? '<p class="small muted">Couldn’t cut this one out cleanly. Try Redraw.</p>' : c.sprite ? '<p class="small muted">Tap the mouth on the picture to line up lip-sync.</p>' : ''}</div></div>`).join('');
    cast.querySelectorAll('.mm-char').forEach((el) => {
      const c = m.cast[Number(el.dataset.c)];
      const cv = el.querySelector('.mm-cprev');
      if (cv) { const g = cv.getContext('2d'); const draw = () => { g.clearRect(0, 0, 160, 200); const k = Math.min(150 / c.sprite.w, 190 / c.sprite.h), w = c.sprite.w * k, h = c.sprite.h * k, x0 = (160 - w) / 2, y0 = (200 - h) / 2; g.drawImage(c.sprite.bmp, x0, y0, w, h); g.strokeStyle = '#ffd166'; g.lineWidth = 2; g.beginPath(); g.arc(x0 + c.sprite.face.x * w, y0 + c.sprite.face.mouthY * h, 6, 0, 7); g.stroke(); cv._map = { x0, y0, w, h }; }; draw();
        cv.onclick = (ev) => { const r = cv.getBoundingClientRect(), mp = cv._map; const x = ((ev.clientX - r.left) * (160 / r.width) - mp.x0) / mp.w, y = ((ev.clientY - r.top) * (200 / r.height) - mp.y0) / mp.h; if (x < 0 || x > 1 || y < 0 || y > 1) return; c.sprite.face.x = x; c.sprite.face.mouthY = y; c.sprite.face.eyeY = Math.max(0.02, y - 0.07); draw(); }; }
      el.querySelector('.mm-cname').oninput = (e) => { c.name = e.target.value.trim() || 'Hero'; };
      el.querySelector('.mm-clook').onchange = (e) => { const bad = checkPrompt(e.target.value); if (bad) { toast(bad); e.target.value = c.look; return; } c.look = e.target.value; };
      el.querySelector('.mm-cvoice').onchange = (e) => { c.voice = e.target.value; };
      el.querySelector('[data-a=ctest]').onclick = () => { speechSynthesis?.cancel(); speakAs(c.voice, `Hi, I'm ${c.name}!`); };
      el.querySelector('[data-a=cregen]').onclick = () => { c.seed += 7919; c.img = null; c.sprite = null; c.status = ''; paintScenes(); loadImages(); };
      el.querySelector('[data-a=cown]').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; if (f.size > 10 * 1048576) return toast('Images can be up to 10 MB.'); const bmp = await createImageBitmap(f); c.img = { blob: f, bmp, url: URL.createObjectURL(f) }; c.sprite = await AN.cutout(bmp); paintScenes(); };
    });
    const who = (v) => `<option value="narrator" ${v === 'narrator' ? 'selected' : ''}>Narrator</option>` + m.cast.map((c) => `<option value="${c.id}" ${v === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    list.innerHTML = m.shots.map((x, i) => `<div class="mm-scene mm-shot card" data-i="${i}">
      <div class="mm-art">${x.bgImg ? `<canvas width="640" height="360" class="mm-sprev"></canvas>` : `<div class="mm-wait"><div class="spinner"></div><small>${esc(x.status || 'Waiting in line…')}</small></div>`}<span class="mm-num">${i + 1}</span></div>
      <div class="mm-fields">
        <details><summary class="small">Background</summary><textarea class="mm-bg" maxlength="220" rows="2">${esc(x.bg)}</textarea></details>
        ${x.chars.map((ch, j) => `<div class="mm-pup" data-j="${j}"><select class="mm-pwho" aria-label="Character">${m.cast.map((c) => `<option value="${c.id}" ${c.id === ch.cid ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          <select class="mm-pact" aria-label="Action">${opt(AN.ACTIONS, ch.action)}</select><select class="mm-pexp" aria-label="Expression">${opt(AN.EXPRESSIONS, ch.expr)}</select>
          <input class="mm-px" type="range" min="10" max="90" value="${Math.round(ch.x * 100)}" aria-label="Position"><button type="button" class="icon-btn" data-a="prm" aria-label="Remove character">✕</button></div>`).join('')}
        ${x.chars.length < 3 ? '<button type="button" class="link-btn small" data-a="padd">+ Character in this shot</button>' : ''}
        ${x.lines.map((l, j) => `<div class="mm-line" data-j="${j}"><select class="mm-lwho" aria-label="Who says it">${who(l.who)}</select><input class="mm-ltext" type="text" maxlength="160" value="${esc(l.text)}" aria-label="Line"><button type="button" class="icon-btn" data-a="lrm" aria-label="Remove line">✕</button></div>`).join('')}
        ${x.lines.length < 4 ? '<button type="button" class="link-btn small" data-a="ladd">+ Line</button>' : ''}
        <div class="mm-row2"><label class="small">Weather <select class="mm-w">${opt(AN.WEATHER, x.weather)}</select></label><label class="small">Camera <select class="mm-cam">${opt(AN.CAMERA, x.camera)}</select></label></div>
        <div class="mm-btns"><button type="button" class="btn btn-sm btn-ghost" data-a="regen">↻ New background</button>
          <button type="button" class="icon-btn" data-a="up" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button><button type="button" class="icon-btn" data-a="down" aria-label="Move down" ${i < m.shots.length - 1 ? '' : 'disabled'}>↓</button>
          <button type="button" class="icon-btn" data-a="del" aria-label="Delete shot" ${m.shots.length > 2 ? '' : 'disabled'}>🗑</button></div></div></div>`).join('');
    list.querySelectorAll('.mm-shot').forEach((el) => {
      const i = Number(el.dataset.i), x = m.shots[i];
      const prev = () => { const cv = el.querySelector('.mm-sprev'); if (!cv || !ready()) return drawThumb(cv, x); const P = plan(m); const part = P.parts[i]; const g = cv.getContext('2d'); g.save(); g.scale(0.5, 0.5); AN.drawShot(g, m, part, Math.min(part.dur * 0.55, 2.2)); g.restore(); };
      const drawThumb = (cv, sh) => { if (!cv) return; const g = cv.getContext('2d'); const b = sh.bgImg.bmp; g.drawImage(b, 0, 0, 640, 360); sh.chars.forEach((ch) => { const c = m.castById[ch.cid]; if (!c?.sprite) return; const h = 210, w = c.sprite.w * (h / c.sprite.h); g.drawImage(c.sprite.bmp, ch.x * 640 - w / 2, 340 - h, w, h); }); };
      prev();
      const ch = (e) => x.chars[Number(e.target.closest('[data-j]').dataset.j)], ln = (e) => x.lines[Number(e.target.closest('[data-j]').dataset.j)];
      el.querySelector('.mm-bg').onchange = (e) => { const bad = checkPrompt(e.target.value); if (bad) { toast(bad); e.target.value = x.bg; return; } x.bg = e.target.value; };
      el.querySelectorAll('.mm-pwho').forEach((s2) => (s2.onchange = (e) => { ch(e).cid = e.target.value; prev(); }));
      el.querySelectorAll('.mm-pact').forEach((s2) => (s2.onchange = (e) => { ch(e).action = e.target.value; prev(); }));
      el.querySelectorAll('.mm-pexp').forEach((s2) => (s2.onchange = (e) => { ch(e).expr = e.target.value; prev(); }));
      el.querySelectorAll('.mm-px').forEach((s2) => (s2.oninput = (e) => { ch(e).x = Number(e.target.value) / 100; prev(); }));
      el.querySelectorAll('.mm-lwho').forEach((s2) => (s2.onchange = (e) => { ln(e).who = e.target.value; }));
      el.querySelectorAll('.mm-ltext').forEach((s2) => (s2.onchange = (e) => { const bad = checkPrompt(e.target.value); if (bad) { toast(bad); e.target.value = ln(e).text; return; } ln(e).text = e.target.value.trim(); m._tl = null; status(); }));
      el.querySelector('.mm-w').onchange = (e) => { x.weather = e.target.value; };
      el.querySelector('.mm-cam').onchange = (e) => { x.camera = e.target.value; };
      el.onclick = (e) => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        if (a === 'prm') { x.chars.splice(Number(e.target.closest('[data-j]').dataset.j), 1); }
        else if (a === 'padd') { x.chars.push({ cid: m.cast[x.chars.length % m.cast.length].id, action: 'idle', expr: 'happy', x: 0.3 + 0.2 * x.chars.length }); }
        else if (a === 'lrm') { x.lines.splice(Number(e.target.closest('[data-j]').dataset.j), 1); }
        else if (a === 'ladd') { x.lines.push({ who: x.chars[0]?.cid || 'narrator', text: '…' }); }
        else if (a === 'regen') { const bad = checkPrompt(x.bg); if (bad) return toast(bad); x.seed += 7919; x.bgImg = null; x.status = ''; paintScenes(); loadImages(); return; }
        else if (a === 'up') { [m.shots[i - 1], m.shots[i]] = [m.shots[i], m.shots[i - 1]]; }
        else if (a === 'down') { [m.shots[i + 1], m.shots[i]] = [m.shots[i], m.shots[i + 1]]; }
        else if (a === 'del') { m.shots.splice(i, 1); }
        else return;
        m._tl = null; paintScenes();
      };
    });
    status();
  }
  function status() {
    const st = main.querySelector('#mm-status'); if (!st) return;
    if (m.mode === 'anim') { const need = m.cast.length + m.shots.length, have = m.cast.filter((c) => c.sprite).length + m.shots.filter((x) => x.bgImg).length; st.textContent = have < need ? `Painting: ${have}/${need} pictures` : `${m.shots.length} shots ready · ${Math.round(plan(m).total)}s`; }
    const r = main.querySelector('#mm-render'); if (r) r.disabled = !ready();
  }
  let loading = false;
  async function loadImages() {
    if (m.mode === 'anim') return loadAnim();
    if (loading) return; loading = true;
    try {
      for (;;) {
        const s = m.scenes.find((x) => !x.img && !x.busy); if (!s) break;
        s.busy = true; s.status = 'Painting…'; paintScenes();
        const mine = m;
        try { s.img = await fetchImage(imageUrl(s.prompt, m.style, s.seed), (ms) => { s.status = `Free AI is busy, next try in ${Math.ceil(ms / 1000)}s`; paintScenes(); }); }
        catch { s.img = await placeholderArt(s.narration, s.seed); toast('The free picture service is busy. Scene ' + (m.scenes.indexOf(s) + 1) + ' got a placeholder; tap “New picture” later.'); }
        s.busy = false; if (mine !== m) return; paintScenes();
      }
    } finally { loading = false; }
  }
  async function loadAnim() {
    if (loading) return; loading = true; const mine = m; const sp = STYLES[m.style].prompt;
    try {
      for (;;) {
        if (mine !== m) return;
        const c = m.cast.find((x) => !x.sprite && !x.busy);
        if (c) {
          c.busy = true; c.status = 'Drawing…'; paintScenes();
          try { c.img = await fetchImage(`${IMG_API}${encodeURIComponent(AN.charPrompt(c.look, sp).slice(0, 600))}?width=768&height=1024&seed=${c.seed}&nologo=true&safe=true&model=flux`, (ms) => { c.status = `Free AI is busy, next try in ${Math.ceil(ms / 1000)}s`; paintScenes(); }); c.sprite = await AN.cutout(c.img.bmp); }
          catch { c.img = await placeholderArt(c.name, c.seed); c.sprite = await AN.cutout(c.img.bmp); c.sprite.ok = false; toast(`The free picture service is busy. ${c.name} got a placeholder; tap Redraw later.`); }
          c.busy = false; paintScenes(); continue;
        }
        const x = m.shots.find((y) => !y.bgImg && !y.busy); if (!x) break;
        x.busy = true; x.status = 'Painting…'; paintScenes();
        try { x.bgImg = await fetchImage(`${IMG_API}${encodeURIComponent(AN.bgPrompt(x.bg, sp).slice(0, 600))}?width=1024&height=576&seed=${x.seed}&nologo=true&safe=true&model=flux`, (ms) => { x.status = `Free AI is busy, next try in ${Math.ceil(ms / 1000)}s`; paintScenes(); }); }
        catch { x.bgImg = await placeholderArt(x.bg, x.seed); toast('The free picture service is busy. A shot got a placeholder background; tap “New background” later.'); }
        x.busy = false; paintScenes();
      }
    } finally { loading = false; }
  }
  function paintAll() { loadImages(); }
  const speakAs = (vid, text) => new Promise((res) => {
    if (!window.speechSynthesis || !text) return res();
    const preset = AN.VOICE_BY_ID[vid] || AN.MOVIE_VOICES[0];
    const u = new SpeechSynthesisUtterance(text); const vs = voices(); const named = vid === 'narrator' && m?.voice ? vs.find((x) => x.name === m.voice) : null;
    const v = named || AN.voiceFor(vs, preset); if (v) u.voice = v; u.pitch = Math.min(2, preset.pitch); u.rate = preset.rate; u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
  });
  // speech
  const speak = (text) => new Promise((res) => {
    if (!window.speechSynthesis || !text) return res();
    const u = new SpeechSynthesisUtterance(text); const v = voices().find((x) => x.name === m.voice); if (v) u.voice = v; u.rate = 0.98; u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
  });
  // playback engine shared by preview + render
  async function play(g, { record, onProgress, withVoice = true, stream }) {
    m._tl = null; const tl = plan(m);
    const cues = m.mode === 'anim' ? tl.parts.flatMap((p) => p.lines.map((l) => ({ at: p.start + l.start, text: l.text, voice: l.who === 'narrator' ? 'narrator' : (m.castById[l.who]?.voice || 'hero') }))) : [];
    let cue = 0;
    const ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume();
    const dest = ac.createMediaStreamDestination(); const mix = ac.createGain(); mix.connect(dest); mix.connect(ac.destination);
    const stopMusic = startMusic(ac, mix, m.mood, tl.total);
    if (stream) { try { const src = ac.createMediaStreamSource(stream); src.connect(dest); } catch { /* */ } }
    let rec = null, chunks = [];
    if (record) {
      const vs = g.canvas.captureStream(FPS); const tracks = [...vs.getVideoTracks(), ...dest.stream.getAudioTracks()];
      const mime = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error('This browser can’t record video. Try Chrome, Edge or Safari 16+.');
      rec = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 4_000_000 }); rec.ondataavailable = (e) => e.data.size && chunks.push(e.data); rec.start(1000);
    }
    const t0 = performance.now(); let spoken = -1, stopped = false;
    await new Promise((res) => {
      const step = () => {
        if (stopped) return res();
        const t = (performance.now() - t0) / 1000;
        drawFrame(g, m, Math.min(t, tl.total - 0.001), S.profile?.username);
        if (m.mode === 'anim') { while (withVoice && cue < cues.length && t >= cues[cue].at) { speechSynthesis?.cancel(); speakAs(cues[cue].voice, cues[cue].text); cue++; } }
        else { const p = tl.parts.findIndex((x) => t >= x.start + 0.3 && t < x.start + x.dur);
          if (withVoice && p > spoken) { spoken = p; speechSynthesis?.cancel(); speak(m.scenes[p].narration); } }
        onProgress && onProgress(Math.min(1, t / tl.total));
        if (t >= tl.total) return res();
        requestAnimationFrame(step);
      };
      play.stop = () => { stopped = true; };
      requestAnimationFrame(step);
    });
    stopMusic(); speechSynthesis?.cancel();
    let blob = null;
    if (rec) { await new Promise((r) => { rec.onstop = r; rec.stop(); }); blob = new Blob(chunks, { type: rec.mimeType.split(';')[0] }); }
    setTimeout(() => ac.close(), 300);
    return { blob, seconds: tl.total };
  }
  async function preview() {
    if (!ready()) return toast('Wait until every picture is painted.');
    const g = main.querySelector('#mm-cv').getContext('2d'); await play(g, { record: false });
  }
  async function render() {
    if (!ready()) return toast('Wait until every picture is painted.');
    const texts = m.mode === 'anim' ? m.shots.flatMap((x) => x.lines.map((l) => l.text)).concat(m.cast.map((c) => c.name)) : m.scenes.map((x) => x.narration);
    const bad = texts.map((x) => checkPrompt(x + ' ' + m.title)).find(Boolean); if (bad) return toast(bad);
    const q = (s) => main.querySelector(s);
    const btn = q('#mm-render'), prog = q('#mm-prog'), bar = prog.querySelector('span'), st = q('#mm-rstat');
    let stream = null;
    if (q('#mm-tabaudio').checked && navigator.mediaDevices?.getDisplayMedia) {
      try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true, selfBrowserSurface: 'include' }); stream.getVideoTracks().forEach((t) => t.stop()); if (!stream.getAudioTracks().length) { toast('No tab audio was shared, so the voice won’t be in the file.'); stream = null; } }
      catch { stream = null; }
    }
    btn.disabled = true; prog.hidden = false; st.textContent = 'Recording your movie in real time… keep this tab open.';
    try {
      const { blob, seconds } = await play(q('#mm-cv').getContext('2d'), { record: true, withVoice: true, stream, onProgress: (f) => (bar.style.transform = `scaleX(${f})`) });
      stream?.getTracks().forEach((t) => t.stop());
      m.file = new File([blob], `${(m.title || 'kemy-movie').replace(/[^\w-]+/g, '-').slice(0, 40)}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`, { type: blob.type }); m.seconds = seconds;
      st.textContent = `Done: ${Math.round(seconds)}s · ${(blob.size / 1048576).toFixed(1)} MB`;
      result();
    } catch (e) { st.textContent = e.message || 'Recording failed.'; }
    finally { btn.disabled = false; }
  }
  function result() {
    const box = main.querySelector('#mm-result'); const url = URL.createObjectURL(m.file);
    box.innerHTML = `<video class="mm-video" src="${url}" controls playsinline></video>
      <div class="mm-btns"><a class="btn btn-ghost" href="${url}" download="${esc(m.file.name)}">⬇ Download</a></div>
      <form class="mm-post" id="mm-post">
        <h3>Post to Community Movies</h3>
        <div class="field"><label for="mm-ptitle">Title</label><input id="mm-ptitle" type="text" maxlength="80" value="${esc(m.title)}"></div>
        <div class="field"><label for="mm-pdesc">Description</label><textarea id="mm-pdesc" maxlength="1000" rows="2">${esc(m.idea)}</textarea></div>
        <div class="field"><label for="mm-pgenre">Genre</label><select id="mm-pgenre">${['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Fantasy', 'Romance', 'Animation', 'Music', 'Documentary', 'Other'].map((g) => `<option ${g === STYLES[m.style].genre ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
        ${SER ? SER.pickerHtml({ sid: ser?.id }) : ''}
        <p class="small muted">Shows the <b>AI-made</b> badge and “Made with: Kemy AI Movie Maker”. Rated All ages.</p>
        <label class="check small"><input type="checkbox" id="mm-rights"> <span>I made this or have the rights to share it, and it follows the <a href="guidelines.html" target="_blank">Community Guidelines</a>.</span></label>
        <div class="pv-progress" hidden><span></span></div><p class="form-error" id="mm-perr"></p>
        <button class="btn btn-block" id="mm-publish" type="submit">Post movie</button>
      </form>`;
    const pickSeries = SER ? SER.wirePicker(box, ser ? { sid: ser.id, season: ser._next.season } : {}) : () => null;
    box.querySelector('#mm-post').onsubmit = async (e) => {
      e.preventDefault(); const q = (s) => box.querySelector(s); const err = q('#mm-perr'); err.textContent = '';
      if (!S.user) return (location.hash = '#/login');
      if (!q('#mm-rights').checked) { err.textContent = 'Please confirm you made this or have the rights to share it.'; return; }
      const title = q('#mm-ptitle').value.trim(), desc = q('#mm-pdesc').value.trim(); const bad = checkPrompt(title + ' ' + desc); if (bad) { err.textContent = bad; return; }
      const bar = q('.pv-progress'), bi = bar.querySelector('span'); bar.hidden = false; q('#mm-publish').disabled = true;
      try {
        const sp = pickSeries();
        const id = await publishMovie({ file: m.file, title: title || m.title, desc, genre: q('#mm-pgenre').value, runtime: m.seconds, onProgress: (f) => (bi.style.transform = `scaleX(${f})`), seriesPick: sp });
        if (sp && SER) { try { const fresh = await SER.load(sp.series.id, true); await SER.save(fresh, { ai: { style: m.style, seed: m.seed, look: m.mode, cast: (m.cast || []).map((c) => ({ name: c.name, look: c.look, voice: c.voice })) } }); } catch { /* style memory is optional */ } }
        toast('Movie posted!'); location.hash = '#/post/' + id;
      } catch (e2) { q('#mm-publish').disabled = false; err.textContent = e2?.code === 'permission-denied' ? 'You can post once every 20 seconds. Try again in a moment.' : (e2.message || friendlyError(e2)); }
    };
  }
  window.__kemyMM = { get m() { return m; } };
  return { page };
}
