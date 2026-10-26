// Pal voices: 24 cute presets on top of the browser's speech synthesis (best natural/neural voice the
// device has), plus code-generated giggles, squeaks and species sounds through Web Audio.
// Note: browsers don't let speech-synthesis audio pass through Web Audio, so the "effects" (echo,
// bubbly tremolo, robot ring-mod) are applied to the generated sound layers that play with the voice;
// each preset still sounds different on devices with only one voice thanks to pitch, rate and layers.
export const VOICES = [
  { id: 'squeaky', name: 'Squeaky', pitch: 1.9, rate: 1.15, sfx: 'squeak', fx: '' },
  { id: 'bubbly', name: 'Bubbly', pitch: 1.7, rate: 1.1, sfx: 'bubble', fx: 'tremolo' },
  { id: 'sleepy', name: 'Sleepy', pitch: 1.5, rate: 0.85, sfx: 'yawn', fx: '' },
  { id: 'tiny', name: 'Tiny', pitch: 2, rate: 1.2, sfx: 'squeak', fx: '' },
  { id: 'giggly', name: 'Giggly', pitch: 1.8, rate: 1.12, sfx: 'giggle', fx: '' },
  { id: 'sparkle', name: 'Sparkle', pitch: 1.75, rate: 1.05, sfx: 'chime', fx: 'echo' },
  { id: 'chirpy', name: 'Chirpy', pitch: 1.9, rate: 1.18, sfx: 'chirp', fx: '' },
  { id: 'bouncy', name: 'Bouncy', pitch: 1.7, rate: 1.2, sfx: 'boing', fx: '' },
  { id: 'whisper', name: 'Whisper', pitch: 1.55, rate: 0.9, sfx: 'hehe', fx: '', vol: 0.55 },
  { id: 'singsong', name: 'Sing-Song', pitch: 1.65, rate: 1.0, sfx: 'chime', fx: 'echo', sing: true },
  { id: 'robocute', name: 'Robo-Cute', pitch: 1.6, rate: 1.05, sfx: 'robo', fx: 'ring' },
  { id: 'sweetie', name: 'Sweetie', pitch: 1.7, rate: 1.0, sfx: 'hehe', fx: '' },
  { id: 'hyper', name: 'Hyper', pitch: 1.85, rate: 1.35, sfx: 'giggle', fx: '' },
  { id: 'grumpy', name: 'Grumpy-Cute', pitch: 1.4, rate: 0.95, sfx: 'hmph', fx: '' },
  { id: 'ocean', name: 'Ocean Bubble', pitch: 1.6, rate: 1.0, sfx: 'bubble', fx: 'tremolo' },
  { id: 'jelly', name: 'Jelly', pitch: 1.75, rate: 0.95, sfx: 'wobble', fx: 'tremolo' },
  { id: 'babydragon', name: 'Baby Dragon', pitch: 1.45, rate: 1.0, sfx: 'roar', fx: '' },
  { id: 'cowboy', name: 'Cowboy Pup', pitch: 1.5, rate: 0.95, sfx: 'yip', fx: '', lang: /en-(US|AU)/, hint: /male|david|guy|alex|daniel/i },
  { id: 'bloom', name: 'Bloom', pitch: 1.7, rate: 1.0, sfx: 'chime', fx: '', lang: /en-(GB|IE)/ },
  { id: 'koala', name: 'Gumleaf', pitch: 1.6, rate: 0.95, sfx: 'hehe', fx: '', lang: /en-AU/ },
  // shop-unlock voices (Star Coins)
  { id: 'vx_royal', name: 'Royal', pitch: 1.5, rate: 0.9, sfx: 'fanfare', fx: 'echo', lang: /en-GB/, premium: 1 },
  { id: 'vx_space', name: 'Space Cadet', pitch: 1.7, rate: 1.05, sfx: 'robo', fx: 'ring', premium: 1 },
  { id: 'vx_bonjour', name: 'Bonjour Bun', pitch: 1.75, rate: 1.0, sfx: 'hehe', fx: '', lang: /fr/, premium: 1 },
  { id: 'vx_star', name: 'Superstar', pitch: 1.8, rate: 1.1, sfx: 'chime', fx: 'echo', sing: true, premium: 1 }
];
export const VOICE = Object.fromEntries(VOICES.map((v) => [v.id, v]));
export const SPECIES_VOICE = { kemy: 'bubbly', elephant: 'sweetie', puppy: 'bouncy', kitten: 'giggly', bunny: 'tiny', panda: 'sleepy', redpanda: 'chirpy', fox: 'sparkle', koala: 'koala', penguin: 'ocean', duckling: 'squeaky', chick: 'chirpy', piglet: 'giggly', lamb: 'sweetie', giraffe: 'singsong', lion: 'grumpy', tiger: 'hyper', bear: 'sleepy', hedgehog: 'tiny', hamster: 'squeaky', otter: 'ocean', seal: 'bubbly', turtle: 'sleepy', frog: 'bouncy', owl: 'whisper', unicorn: 'sparkle', dragon: 'babydragon', starsprite: 'sparkle', cloudpuff: 'whisper', jelly: 'jelly' };
export const SPECIES_SOUND = { elephant: 'toot', kitten: 'purr', puppy: 'yip', chick: 'chirp', duckling: 'chirp', owl: 'hoot', dragon: 'roar', lion: 'roar', tiger: 'roar', kemy: 'bubble', jelly: 'wobble', penguin: 'squeak', piglet: 'oink', frog: 'ribbit', lamb: 'baa', capybara: 'mellow' };
let AC = null;
const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; };
function out(fx, vol = 0.18) {
  const a = ac(); if (!a) return null; const g = a.createGain(); g.gain.value = vol; let node = g;
  if (fx === 'echo') { const d = a.createDelay(); d.delayTime.value = 0.16; const fb = a.createGain(); fb.gain.value = 0.35; g.connect(d); d.connect(fb); fb.connect(d); d.connect(a.destination); }
  if (fx === 'tremolo' || fx === 'ring') { const m = a.createGain(); m.gain.value = fx === 'ring' ? 0 : 0.6; const o = a.createOscillator(); o.frequency.value = fx === 'ring' ? 60 : 9; const og = a.createGain(); og.gain.value = 0.5; o.connect(og); og.connect(m.gain); o.start(); o.stop(a.currentTime + 2); g.connect(m); m.connect(a.destination); return g; }
  g.connect(a.destination); return node;
}
function blip(dst, f0, f1, t0, dur, type = 'sine', v = 1) {
  const a = ac(); const o = a.createOscillator(); const e = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, a.currentTime + t0); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), a.currentTime + t0 + dur);
  e.gain.setValueAtTime(0.0001, a.currentTime + t0); e.gain.exponentialRampToValueAtTime(v, a.currentTime + t0 + 0.015); e.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur); o.connect(e); e.connect(dst); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + 0.02);
}
function noise(dst, t0, dur, f = 400, am = 0) {
  const a = ac(); const b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (am ? 0.5 + 0.5 * Math.sin(i / a.sampleRate * am * 6.28) : 1);
  const s = a.createBufferSource(); s.buffer = b; const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = f; const e = a.createGain(); e.gain.setValueAtTime(0.0001, a.currentTime + t0); e.gain.exponentialRampToValueAtTime(0.8, a.currentTime + t0 + 0.05); e.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  s.connect(fl); fl.connect(e); e.connect(dst); s.start(a.currentTime + t0);
}
// cute sound effects, all generated in code
export function sfx(kind, fx = '', vol = 0.18) {
  const d = out(fx, vol); if (!d) return; const B = (...x) => blip(d, ...x);
  switch (kind) {
    case 'giggle': for (let i = 0; i < 5; i++) B(900 + i * 60, 1300 + i * 80, i * 0.09, 0.07, 'triangle'); break;
    case 'hehe': B(700, 1000, 0, 0.1, 'triangle'); B(760, 1100, 0.16, 0.1, 'triangle'); break;
    case 'squeak': B(1400, 2300, 0, 0.12, 'sine'); break;
    case 'bubble': for (let i = 0; i < 4; i++) B(300 + Math.random() * 300, 900 + Math.random() * 400, i * 0.07, 0.06, 'sine'); break;
    case 'chime': [1047, 1319, 1568].forEach((f, i) => B(f, f, i * 0.08, 0.35, 'sine', 0.6)); break;
    case 'chirp': B(2000, 3200, 0, 0.06); B(2200, 3400, 0.1, 0.06); break;
    case 'boing': B(200, 700, 0, 0.25, 'sine'); break;
    case 'yawn': B(500, 260, 0, 0.6, 'triangle', 0.5); break;
    case 'robo': [880, 660, 990].forEach((f, i) => B(f, f, i * 0.08, 0.07, 'square', 0.3)); break;
    case 'hmph': B(300, 200, 0, 0.18, 'sawtooth', 0.3); break;
    case 'wobble': B(400, 700, 0, 0.3, 'sine'); B(700, 400, 0.3, 0.3, 'sine'); break;
    case 'roar': noise(d, 0, 0.35, 700); B(220, 140, 0, 0.35, 'sawtooth', 0.25); break;
    case 'yip': B(900, 1500, 0, 0.08, 'triangle'); B(950, 1600, 0.12, 0.08, 'triangle'); break;
    case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => B(f, f, i * 0.1, 0.18, 'triangle', 0.5)); break;
    case 'toot': B(330, 520, 0, 0.12, 'sawtooth', 0.35); B(520, 700, 0.12, 0.35, 'sawtooth', 0.35); break;   // elephant trunk toot
    case 'mellow': B(260, 220, 0, 0.32, 'sine', 0.6); B(330, 262, 0.26, 0.42, 'sine', 0.5); break; // capybara: a soft, sleepy 'mm-hmm'
    case 'purr': noise(d, 0, 0.8, 180, 22); break;
    case 'hoot': B(500, 430, 0, 0.25, 'sine'); B(500, 430, 0.35, 0.3, 'sine'); break;
    case 'oink': B(260, 360, 0, 0.12, 'sawtooth', 0.3); B(280, 380, 0.16, 0.12, 'sawtooth', 0.3); break;
    case 'ribbit': B(180, 260, 0, 0.08, 'square', 0.3); B(200, 280, 0.12, 0.1, 'square', 0.3); break;
    case 'baa': B(520, 480, 0, 0.4, 'sawtooth', 0.25); break;
  }
}
// best natural-sounding device voice for a preset
export function baseVoice(preset) {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || []; if (!vs.length) return null;
  const want = preset.lang || /^en/; let best = null, bs = -1;
  for (const v of vs) { let s = 0; if (want.test(v.lang)) s += 10; else if (/^en/.test(v.lang)) s += 4;
    if (/natural|neural|online|premium|enhanced/i.test(v.name)) s += 6; if (/google/i.test(v.name)) s += 3;
    if (preset.hint ? preset.hint.test(v.name) : /female|samantha|aria|jenny|zira|karen|moira|tessa|libby|sonia|emma|ava|allison/i.test(v.name)) s += 2;
    if (s > bs) { bs = s; best = v; } }
  return best;
}
export const canSpeak = () => 'speechSynthesis' in window;
// speak with a preset; tweaks = { pitch, rate } multipliers from the sliders
export function speak(text, preset, { species, tweaks = {}, onStart, onEnd, onWord } = {}) {
  preset = preset || VOICE.bubbly; const lead = preset.sfx;
  sfx(lead, preset.fx); if (!canSpeak()) { setTimeout(() => { onStart && onStart(); setTimeout(() => onEnd && onEnd(), Math.min(4000, text.length * 55)); }, 200); return; }
  speechSynthesis.cancel();
  const clean = text.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').replace(/\*/g, '');
  const parts = preset.sing ? clean.split(/(?<=[,.!?])\s+/) : [clean];
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part); const bv = baseVoice(preset); if (bv) { u.voice = bv; u.lang = bv.lang; }
    u.pitch = Math.max(0.1, Math.min(2, preset.pitch * (tweaks.pitch || 1) + (preset.sing ? (i % 2 ? 0.15 : -0.1) : 0)));
    u.rate = Math.max(0.5, Math.min(2, preset.rate * (tweaks.rate || 1))); u.volume = preset.vol || 1;
    if (i === 0) u.onstart = () => onStart && onStart();
    u.onboundary = () => onWord && onWord();
    if (i === parts.length - 1) u.onend = u.onerror = () => { onEnd && onEnd(); if (preset.fx === 'tremolo' || preset.fx === 'ring') sfx(preset.sfx, preset.fx, 0.1); else if (Math.random() < 0.6) sfx(/[!?]$/.test(clean.trim()) ? 'giggle' : 'hehe', preset.fx, 0.12); };
    speechSynthesis.speak(u);
  });
  if (species && SPECIES_SOUND[species] && Math.random() < 0.5) setTimeout(() => sfx(SPECIES_SOUND[species], '', 0.12), 150);
}
export const stopSpeaking = () => { try { speechSynthesis.cancel(); } catch {} };
if (canSpeak()) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
