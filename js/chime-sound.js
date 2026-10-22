// Soft Breeze, the Kemy notification chime. Original synthesis, no recorded or third-party audio.
// E5 (659 Hz) at 0s and B5 (988 Hz) at 0.4s. Each note is a sine plus a second harmonic
// at 0.15, with a copy detuned by +1.5 Hz. 30ms attack, decay exp(-1.8t), 1.8s long.
// Feedback-free echoes at 29/43/67/97/139/191/257 ms, mixed half wet and half dry.
// Peak about 0.5, with a 0.4s fade across the end. About 2.6 seconds.
// Written by Lone Keem.
const DURATION = 2.6;
const NOTE_LEN = 1.8;
const ATTACK = 0.03;
const DECAY = 1.8;
const NOTES = [
  { t: 0, f: 659 },
  { t: 0.4, f: 988 }
];
const TAPS = [
  [0.029, 0.4],
  [0.043, 0.35],
  [0.067, 0.3],
  [0.097, 0.25],
  [0.139, 0.2],
  [0.191, 0.15],
  [0.257, 0.1]
];

let cached = null;
let cachedCtx = null;

function render(sampleRate) {
  const n = Math.round(DURATION * sampleRate);
  const dry = new Float32Array(n);
  const twoPi = Math.PI * 2;
  for (const note of NOTES) {
    const start = Math.round(note.t * sampleRate);
    const len = Math.round(NOTE_LEN * sampleRate);
    const f = note.f;
    for (let i = 0; i < len; i++) {
      const idx = start + i;
      if (idx >= n) break;
      const t = i / sampleRate;
      const attack = t < ATTACK ? t / ATTACK : 1;
      const env = attack * Math.exp(-DECAY * t);
      const voice = Math.sin(twoPi * f * t)
        + 0.15 * Math.sin(twoPi * (2 * f) * t)
        + Math.sin(twoPi * (f + 1.5) * t)
        + 0.15 * Math.sin(twoPi * (2 * f + 1.5) * t);
      dry[idx] += voice * env;
    }
  }
  const delays = TAPS.map(([sec, gain]) => [Math.round(sec * sampleRate), gain]);
  const mix = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let wet = 0;
    for (const [delay, gain] of delays) {
      if (i >= delay) wet += gain * dry[i - delay];
    }
    mix[i] = 0.5 * dry[i] + 0.5 * wet;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(mix[i]);
    if (a > peak) peak = a;
  }
  const scale = peak > 0 ? 0.5 / peak : 0;
  const fadeStart = Math.round((DURATION - 0.4) * sampleRate);
  const fadeLen = n - fadeStart;
  for (let i = 0; i < n; i++) {
    let s = mix[i] * scale;
    if (i >= fadeStart && fadeLen > 0) s *= (fadeLen - (i - fadeStart)) / fadeLen;
    mix[i] = s;
  }
  return mix;
}

export function playChimeSound(ctx, destination, when) {
  if (cachedCtx !== ctx) {
    const data = render(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buffer.getChannelData(0).set(data);
    cached = buffer;
    cachedCtx = ctx;
  }
  const src = ctx.createBufferSource();
  src.buffer = cached;
  src.connect(destination);
  src.start(when);
  src.stop(when + DURATION);
}
