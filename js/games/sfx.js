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
const SOUNDS = {
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
