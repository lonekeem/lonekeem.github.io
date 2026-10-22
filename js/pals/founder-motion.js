// Founder axolotl motion. Change these numbers to retune him; a reference video can replace the timings later.
// Times are in the Pal clock (about 60 ticks a second). Angles on the wave are degrees.
export const FOUNDER_MOTION = {
  idleBob: 0.05,        // how high the body rises and falls while standing
  idleBobSpeed: 0.075,  // bob speed
  gillWiggle: 0.18,     // how far each gill fan swings
  gillSpeed: 0.14,
  tailSway: 0.48,       // side-to-side tail travel
  tailSpeed: 0.085,
  smile: 0.12,          // resting smile, kept small
  blinkEvery: 210,      // ticks between blinks
  blinkFrames: 6,       // how long the eyes stay shut
  waveArm: 'aL',        // which hand waves: aL left, aR right
  waveLift: 156,        // arm raised, degrees
  waveSwing: 20,        // how wide the wave is
  waveForward: 18,
  waveElbow: 32,
  waveSpeed: 0.38,
  waveEvery: 960,       // idle: wave about every 16 seconds
  waveLen: 150,         // how long that idle wave lasts
  waveDelay: 300,
};

/** Extra life on top of the shared idle / walk / wave poses. Does not replace the walk gait. */
export function founderPose(P, t, mode, M = FOUNDER_MOTION) {
  const o = { ...P, smile: (P.smile || 0) + M.smile, tw: M.tailSpeed };
  const bob = Math.sin(t * M.idleBobSpeed) * M.idleBob;
  if (mode === 'idle') o.hy = (o.hy || 0) + bob;
  else if (mode === 'walk' || mode === 'run') o.hy = (o.hy || 0) + bob * 0.35;
  const elapsed = (t + M.waveDelay) % M.waveEvery;
  const waving = mode === 'wave' || (mode === 'idle' && elapsed < M.waveLen);
  if (!waving) return o;
  const u = mode === 'wave' ? 1 : Math.sin(Math.min(1, elapsed / M.waveLen) * Math.PI);
  const k = Math.min(1, u * 1.45);
  const s = Math.sin(t * M.waveSpeed);
  const arm = [M.waveLift + s * M.waveSwing, M.waveForward, M.waveElbow + s * 14, 4];
  const rest = o[M.waveArm] || [24, 6, 14, 0];
  o[M.waveArm] = rest.map((v, i) => v + ((arm[i] ?? v) - v) * k);
  o.smile = M.smile + 0.2 * k;
  o.nz = (o.nz || 0) + 0.08 * k;
  return o;
}
