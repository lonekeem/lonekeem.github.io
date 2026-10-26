// Tiny synthesized sound kit (WebAudio, no files). Muted state is remembered per device.
import { masterVol, sfxVol } from '../volume.js';
let ctx = null;
const KEY = 'lks-games-muted';
export const sfx = {
  get muted() { return localStorage.getItem(KEY) === '1'; },
  set muted(v) { localStorage.setItem(KEY, v ? '1' : '0'); },
  play(name) {
    if (this.muted || masterVol() <= 0 || sfxVol() <= 0) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      (SOUNDS[name] || SOUNDS.tap)(ctx);
    } catch { /* audio not available */ }
  }
};
function tone(c, { f = 440, f2 = null, t = 0.12, type = 'sine', v = 0.18, at = 0 }) {
  v = Math.max(0.0001, v * sfxVol() * masterVol());
  const o = c.createOscillator(), g = c.createGain(), s = c.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(f, s);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, s + t);
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(v, s + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, s + t);
  o.connect(g).connect(c.destination); o.start(s); o.stop(s + t + 0.02);
}
// Short filtered noise: a wooden knock (chess pieces landing).
function knock(c, { f = 900, q = 6, t = 0.09, v = 0.5, at = 0 }) {
  v = Math.max(0.0001, v * sfxVol() * masterVol());
  const n = Math.floor(c.sampleRate * t), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), s = c.currentTime + at;
  src.buffer = b; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; g.gain.value = v;
  src.connect(bp).connect(g).connect(c.destination); src.start(s);
}
const SOUNDS = {
  woodMove: (c) => { knock(c, { f: 1100, q: 5, t: 0.07, v: 0.9 }); tone(c, { f: 190, f2: 120, t: 0.08, type: 'sine', v: 0.22 }); },
  woodCapture: (c) => { knock(c, { f: 800, q: 4, t: 0.08, v: 0.9 }); knock(c, { f: 1500, q: 5, t: 0.07, v: 0.7, at: 0.07 }); tone(c, { f: 160, f2: 90, t: 0.12, type: 'sine', v: 0.25, at: 0.07 }); tone(c, { f: 1200, f2: 1800, t: 0.08, type: 'sine', v: 0.06, at: 0.1 }); },
  check: (c) => { knock(c, { f: 1000, q: 5, t: 0.07, v: 0.8 }); [880, 1175].forEach((f, i) => tone(c, { f, t: 0.16, type: 'triangle', v: 0.12, at: 0.06 + i * 0.09 })); },
  turn: (c) => [1046, 1318].forEach((f, i) => tone(c, { f, t: 0.22, type: 'sine', v: 0.09, at: i * 0.09 })),
  cheer: (c) => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, { f, t: 0.26, type: 'triangle', v: 0.14, at: i * 0.09 })),
  tap: (c) => tone(c, { f: 660, t: 0.06, type: 'triangle', v: 0.12 }),
  drop: (c) => { tone(c, { f: 900, f2: 300, t: 0.18, type: 'triangle', v: 0.2 }); tone(c, { f: 180, t: 0.1, type: 'sine', v: 0.25, at: 0.16 }); },
  place: (c) => tone(c, { f: 520, f2: 780, t: 0.1, type: 'triangle', v: 0.16 }),
  capture: (c) => { tone(c, { f: 300, f2: 120, t: 0.16, type: 'square', v: 0.08 }); tone(c, { f: 880, t: 0.08, type: 'triangle', v: 0.12, at: 0.08 }); },
  card: (c) => tone(c, { f: 1400, f2: 700, t: 0.07, type: 'triangle', v: 0.1 }),
  deal: (c) => [0, 0.05, 0.1].forEach((at) => tone(c, { f: 1200, f2: 800, t: 0.05, type: 'triangle', v: 0.08, at })),
  win: (c) => [523, 659, 784, 1046].forEach((f, i) => tone(c, { f, t: 0.22, type: 'triangle', v: 0.16, at: i * 0.1 })),
  lose: (c) => [440, 392, 330].forEach((f, i) => tone(c, { f, t: 0.25, type: 'sine', v: 0.14, at: i * 0.14 })),
  tick: (c) => tone(c, { f: 1000, t: 0.03, type: 'square', v: 0.05 }),
  pop: (c) => tone(c, { f: 700, f2: 1200, t: 0.08, type: 'sine', v: 0.12 }),
  star: (c) => [880, 1320, 1760].forEach((f, i) => tone(c, { f, t: 0.14, type: 'sine', v: 0.1, at: i * 0.05 })),
  right: (c) => [660, 990].forEach((f, i) => tone(c, { f, t: 0.14, type: 'triangle', v: 0.15, at: i * 0.08 })),
  wrong: (c) => tone(c, { f: 220, f2: 160, t: 0.25, type: 'sawtooth', v: 0.06 })
};
