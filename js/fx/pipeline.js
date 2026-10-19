// Lone Keem Studios - live filter pipeline for a camera stream (in-app camera, stories, Go Live).
// raw camera -> hidden <video> -> WebGL engine (+ face/segmentation) -> 2D canvas (+ lens art)
// -> canvas.captureStream(30). The same canvas track is kept while filters change, so a live
// connection never drops; "no filter" is a fast path that hands back the raw camera track.
import { createEngine } from './engine.js';
import { FX_DEFAULT, isFastPath, FUNNY, FUNFX, BEAUTY } from './looks.js';
import * as F from './face.js';

export function createFx(rawIn, { onFace, onNotice, onState } = {}) {
  let raw = rawIn;
  let state = { ...FX_DEFAULT };
  const src = document.createElement('video');
  src.muted = true; src.playsInline = true; src.setAttribute('playsinline', ''); src.autoplay = true;
  const setSrc = (track) => { src.srcObject = new MediaStream([track]); src.play().catch(() => {}); };
  let rawVideo = raw.getVideoTracks()[0]; setSrc(rawVideo);
  const out = document.createElement('canvas'); out.width = 2; out.height = 2;
  const ctx = out.getContext('2d');
  let eng = null; try { eng = createEngine(); } catch (e) { console.warn('fx engine', e); }
  const supported = !!eng;
  const skin = document.createElement('canvas'), skinCtx = skin.getContext('2d');
  let canvasTrack = null, running = false, rafId = 0, last = 0;
  let face = null, seg = null, faceLoad = null, segLoad = null, lm = null, lastDetect = 0, lastSeg = 0, faceSeen = null;
  let scale = 1, fps = 30, locked = false;
  const times = [];
  const art = F.createArt(), spark = F.createSparkle();
  const beautyV = () => (BEAUTY.find((b) => b.id === state.beauty) || BEAUTY[0]).v;
  const funny = () => FUNNY.find((x) => x.id === state.funny) || FUNNY[0];
  const funfx = () => FUNFX.find((x) => x.id === state.fx) || FUNFX[0];
  const needFace = () => state.funny !== 'none' || beautyV() > 0;
  const needSeg = () => !!funfx().seg;
  const stats = { w: 0, h: 0, fps, scale, ms: 0, frames: 0, face: false, faceReady: false, segReady: false, fallbacks: 0 };

  function ensureModels() {
    if (needFace() && !face && !faceLoad) faceLoad = F.loadFace().then((f) => { face = f; stats.faceReady = true; }).catch((e) => { console.warn('face model', e); onNotice && onNotice('Face lenses couldn’t load right now. Check your connection.'); }).finally(() => { faceLoad = null; });
    if (needSeg() && !seg && !segLoad) segLoad = F.loadSeg().then((s) => { seg = s; stats.segReady = true; }).catch((e) => { console.warn('seg model', e); onNotice && onNotice('Background effects couldn’t load, using a simple version.'); }).finally(() => { segLoad = null; });
  }
  function schedule() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
  }
  function frame(now) {
    if (!running) return;
    schedule();
    const vw = src.videoWidth, vh = src.videoHeight;
    if (!vw || src.readyState < 2) return;
    if (now - last < 1000 / fps - 3) return;
    last = now;
    const t0 = performance.now();
    const w = Math.max(2, Math.round(vw * scale / 2) * 2), h = Math.max(2, Math.round(vh * scale / 2) * 2);
    // trackers (face every ~2 frames, segmentation every ~2 frames)
    if (face && needFace() && now - lastDetect > 1000 / Math.min(fps, 24)) {
      try { const r = face.detectForVideo(src, now); lm = r.faceLandmarks && r.faceLandmarks[0] || null; } catch { lm = null; }
      lastDetect = now;
      const has = !!lm; stats.face = has;
      if (has !== faceSeen) { faceSeen = has; onFace && onFace(has); }
    } else if (!needFace()) lm = null;
    if (seg && needSeg() && now - lastSeg > 1000 / Math.min(fps, 20)) {
      lastSeg = now;
      try {
        seg.segmentForVideo(src, now, (res) => {
          const m = res.confidenceMasks && res.confidenceMasks[0]; if (!m) return;
          const f = m.getAsFloat32Array(); const u = new Uint8Array(f.length);
          for (let i = 0; i < f.length; i++) u[i] = f[i] * 255;
          eng.setSegMask({ data: u, w: m.width, h: m.height });
        });
      } catch {}
    } else if (!needSeg()) eng.setSegMask(null);
    const bv = beautyV();
    if (bv > 0 && lm) { const sw = 192, sh = Math.round(sw * vh / vw); if (skin.width !== sw || skin.height !== sh) { skin.width = sw; skin.height = sh; } F.drawSkinMask(skinCtx, lm, sw, sh); eng.setSkinMask(skin); }
    else eng.setSkinMask(null);
    const g = lm ? F.geometry(lm, w, h) : null;
    const wp = g && funny().warp ? F.warpsFor(state.funny, g, w, h) : {};
    eng.render(src, w, h, { look: state.look, beauty: bv, fx: state.fx === 'sparkle' ? 'none' : state.fx, ...wp });
    if (out.width !== w || out.height !== h) { out.width = w; out.height = h; }
    ctx.drawImage(eng.canvas, 0, 0, w, h);
    if (funny().art) art.draw(ctx, state.funny, g || { mouthOpen: 0 }, now, !g);
    if (state.fx === 'sparkle') spark.draw(ctx, w, h, now);
    // performance: lower resolution, then frame rate, then lighten heavy effects
    const ms = performance.now() - t0; times.push(ms); if (times.length > 40) times.shift();
    stats.ms = ms; stats.frames++; stats.w = w; stats.h = h; stats.fps = fps; stats.scale = scale;
    if (times.length === 40) {
      const avg = times.reduce((a, b) => a + b, 0) / 40;
      const budget = 1000 / fps * 0.85;
      if (avg > budget) {
        times.length = 0;
        if (!locked && scale > 0.5) scale = Math.max(0.5, scale - 0.25);
        else if (fps > 20) fps = fps > 24 ? 24 : 20;
        else if (state.beauty === 'strong' || state.beauty === 'medium' || funfx().heavy) {
          stats.fallbacks++;
          const next = { ...state };
          if (funfx().heavy) next.fx = 'none'; else next.beauty = 'light';
          set(next); onState && onState(next);
          onNotice && onNotice('That effect is slow on this phone, so we switched to a lighter one.');
        }
      }
    }
  }
  function start() { if (running || !supported) return; running = true; last = 0; schedule(); }
  function stopLoop() { running = false; cancelAnimationFrame(rafId); }
  function set(next) {
    state = { ...state, ...next };
    if (isFastPath(state) || !supported) stopLoop(); else { ensureModels(); start(); }
    if (!needFace() && faceSeen !== null) { faceSeen = null; onFace && onFace(false); }
    return state;
  }
  return {
    supported, stats, canvas: out,
    get state() { return { ...state }; },
    set,
    isFast: () => isFastPath(state) || !supported,
    // The track to send/record right now: the raw camera on the fast path, otherwise the canvas.
    videoTrack() {
      if (isFastPath(state) || !supported) return rawVideo;
      if (!canvasTrack) { canvasTrack = out.captureStream(30).getVideoTracks()[0]; }
      return canvasTrack;
    },
    // A stream with the current video track + the original audio (for MediaRecorder / previews).
    stream() { return new MediaStream([this.videoTrack(), ...raw.getAudioTracks()]); },
    // Camera flipped: new raw video track (and optionally the new raw stream, for its audio).
    setSource(track, newRaw) { rawVideo = track; if (newRaw) raw = newRaw; setSrc(track); lm = null; },
    lock(on) { locked = !!on; },
    faceAt: () => (lm ? F.geometry(lm, 1, 1) : null),
    stop() { stopLoop(); try { canvasTrack && canvasTrack.stop(); } catch {} canvasTrack = null; src.srcObject = null; eng && eng.destroy(); }
  };
}
