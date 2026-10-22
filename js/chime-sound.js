// PLACEHOLDER sound. Swap this file when the chime is chosen.
// Keep the export name playChimeSound. It is the only place that makes the noise.
// Connect only to destination (the player already keeps it quiet). Finish within 1 second.
// Original synthesis only. No copyrighted or third-party sounds.
// Written by Lone Keem.
export function playChimeSound(ctx, destination, when) {
  tone(ctx, destination, when, 523, 0.18, 0.14, 1.45);
  tone(ctx, destination, when + 0.16, 784, 0.2, 0.11, 1.12);
  sparkle(ctx, destination, when + 0.34);
}

function tone(ctx, destination, when, freq, dur, peak, glide) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq * glide, when);
  o.frequency.exponentialRampToValueAtTime(freq, when + dur * 0.5);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1600, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(filter);
  filter.connect(g);
  g.connect(destination);
  o.start(when);
  o.stop(when + dur + 0.02);
}

function sparkle(ctx, destination, when) {
  [1760, 2093, 2637].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const st = when + i * 0.045;
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, st);
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.03, st + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.07);
    o.connect(g);
    g.connect(destination);
    o.start(st);
    o.stop(st + 0.08);
  });
}
