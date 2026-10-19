// Kemy's Bubble Quest - original chiptune SFX and looping tunes, synthesized with WebAudio.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
export function createAudio(settings) {
  let ac = null, master = null, musicGain = null, timer = null, nextT = 0, stepI = 0, song = 0;
  const A = { get muted() { return settings.muted; } };
  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC(); master = ac.createGain(); master.gain.value = settings.muted ? 0 : 0.5; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = settings.music ? 0.32 : 0; musicGain.connect(master); return true;
  }
  function tone(type, f0, f1, dur, vol = 0.25, at = 0, dest = master) {
    if (!ac) return; const t = ac.currentTime + at; const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, at = 0) {
    if (!ac) return; const t = ac.currentTime + at; const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate); const d = b.getChannelData(0);
    let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    const src = ac.createBufferSource(); src.buffer = b; const g = ac.createGain(); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const FX = {
    jump: () => tone('square', 330, 660, 0.12, 0.12),
    swim: () => tone('sine', 300, 520, 0.12, 0.18),
    star: () => { tone('triangle', NOTE(84), 0, 0.08, 0.2); tone('triangle', NOTE(91), 0, 0.14, 0.2, 0.06); },
    big: () => [79, 83, 86, 91, 95].forEach((n, i) => tone('triangle', NOTE(n), 0, 0.18, 0.22, i * 0.06)),
    stomp: () => { tone('square', 220, 90, 0.12, 0.18); noise(0.06, 0.12); },
    hurt: () => { tone('sawtooth', 300, 110, 0.3, 0.15); },
    spring: () => tone('square', 200, 1100, 0.25, 0.12),
    bubble: () => { tone('sine', 500, 900, 0.1, 0.2); tone('sine', 900, 700, 0.08, 0.12, 0.08); },
    trap: () => tone('triangle', 400, 1200, 0.2, 0.18),
    pop: () => { tone('sine', 1200, 300, 0.08, 0.2); noise(0.04, 0.1); },
    heart: () => [72, 76, 79].forEach((n, i) => tone('triangle', NOTE(n), 0, 0.15, 0.2, i * 0.07)),
    power: () => [67, 71, 74, 79, 83].forEach((n, i) => tone('square', NOTE(n), 0, 0.1, 0.1, i * 0.05)),
    check: () => [76, 81].forEach((n, i) => tone('triangle', NOTE(n), 0, 0.2, 0.22, i * 0.1)),
    splash: () => noise(0.18, 0.12),
    clear: () => [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => tone('square', NOTE(n), 0, i === 6 ? 0.5 : 0.14, 0.12, i * 0.11)),
    dead: () => [67, 63, 60, 55].forEach((n, i) => tone('triangle', NOTE(n), 0, 0.22, 0.2, i * 0.14)),
    tap: () => tone('square', 660, 0, 0.05, 0.08), respawn: () => tone('sine', 400, 800, 0.2, 0.12)
  };
  A.play = (name) => { if (settings.muted || !ensure()) return; (FX[name] || (() => {}))(); };
  // three original 16-step loops (melody, bass) per world; numbers are MIDI notes, 0 = rest
  const SONGS = [
    { bpm: 132, mel: [72, 0, 76, 79, 0, 76, 74, 0, 72, 0, 69, 72, 74, 0, 0, 0, 76, 0, 79, 81, 0, 79, 76, 0, 74, 76, 74, 72, 69, 0, 72, 0], bass: [48, 55, 52, 55, 45, 52, 48, 52, 41, 48, 45, 48, 43, 50, 47, 50] },
    { bpm: 112, mel: [69, 0, 72, 0, 76, 0, 74, 72, 0, 69, 0, 67, 69, 0, 0, 0, 72, 0, 76, 0, 79, 77, 76, 0, 74, 0, 72, 74, 76, 0, 0, 0], bass: [45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50, 40, 47, 44, 47] },
    { bpm: 124, mel: [74, 77, 81, 0, 79, 77, 74, 0, 72, 74, 77, 0, 76, 74, 72, 0, 74, 77, 81, 84, 81, 79, 77, 0, 79, 77, 76, 74, 72, 0, 74, 0], bass: [50, 57, 53, 57, 46, 53, 50, 53, 48, 55, 52, 55, 45, 52, 49, 52] }
  ];
  function schedule() {
    const S = SONGS[song]; const dt = 60 / S.bpm / 2;
    while (nextT < ac.currentTime + 0.15) {
      const m = S.mel[stepI % S.mel.length]; if (m) tone('square', NOTE(m), 0, dt * 0.9, 0.09, nextT - ac.currentTime, musicGain);
      if (stepI % 2 === 0) { const b = S.bass[(stepI / 2) % S.bass.length]; tone('triangle', NOTE(b), 0, dt * 1.8, 0.2, nextT - ac.currentTime, musicGain); }
      if (stepI % 4 === 2) { const t = nextT; const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = 6000; const g = ac.createGain(); g.gain.setValueAtTime(0.015, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.04); }
      nextT += dt; stepI++;
    }
  }
  A.music = (i) => { song = i ?? song; if (!ensure()) return; stepI = 0; nextT = ac.currentTime + 0.05; clearInterval(timer); timer = setInterval(schedule, 40); };
  A.stopMusic = () => { clearInterval(timer); timer = null; };
  A.apply = () => { if (!ac) return; master.gain.value = settings.muted ? 0 : 0.5; musicGain.gain.value = settings.music ? 0.32 : 0; };
  A.unlock = () => ensure();
  return A;
}
