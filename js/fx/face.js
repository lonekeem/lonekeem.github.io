// Lone Keem Studios - face tracking (MediaPipe Tasks Vision, Apache-2.0, loaded on demand from the
// official CDN + Google model storage) and the original lens art drawn on top of the video.
const VER = '1.1.1';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
let modP = null, filesP = null;
const mod = () => (modP ??= import(/* webpackIgnore: true */ `${BASE}/vision_bundle.mjs`));
const files = async () => (filesP ??= (await mod()).FilesetResolver.forVisionTasks(`${BASE}/wasm`));
async function create(Klass, opts) {
  const fs = await files();
  try { return await Klass.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'GPU' } }); }
  catch { return Klass.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate: 'CPU' } }); }
}
let faceP = null, segP = null;
export const loadFace = () => (faceP ??= mod().then((m) => create(m.FaceLandmarker, { baseOptions: { modelAssetPath: FACE_MODEL }, runningMode: 'VIDEO', numFaces: 1 })).catch((e) => { faceP = null; throw e; }));
export const loadSeg = () => (segP ??= mod().then((m) => create(m.ImageSegmenter, { baseOptions: { modelAssetPath: SEG_MODEL }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false })).catch((e) => { segP = null; throw e; }));

// ---- landmark groups (MediaPipe face mesh indices)
export const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const EYE_R = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_L = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const BROW_R = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const BROW_L = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276];
const LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];

// Geometry in pixels for a frame of size w x h.
export function geometry(lm, w, h) {
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });
  const avg = (ids) => { let x = 0, y = 0; ids.forEach((i) => { x += lm[i].x; y += lm[i].y; }); return { x: x / ids.length * w, y: y / ids.length * h }; };
  const eyeR = lm.length > 470 ? P(468) : avg(EYE_R), eyeL = lm.length > 470 ? P(473) : avg(EYE_L);
  const roll = Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x);
  const eyeDist = Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y);
  const top = P(10), chin = P(152), left = P(234), right = P(454);
  const faceW = Math.hypot(right.x - left.x, right.y - left.y), faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const center = { x: (top.x + chin.x) / 2, y: (top.y + chin.y) / 2 };
  const mouthOpen = Math.hypot(lm[13].x * w - lm[14].x * w, lm[13].y * h - lm[14].y * h) / Math.max(1, Math.hypot(lm[61].x * w - lm[291].x * w, lm[61].y * h - lm[291].y * h));
  return { P, eyeR, eyeL, roll, eyeDist, top, chin, left, right, faceW, faceH, center, nose: P(1), mouth: avg([13, 14]), cheekR: P(50), cheekL: P(280), upperLip: P(164), mouthOpen };
}

// White-on-black skin mask: face oval minus eyes, brows, lips and nostrils (soft edges).
export function drawSkinMask(ctx, lm, w, h) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const path = (ids, grow = 1) => {
    let cx = 0, cy = 0; ids.forEach((i) => { cx += lm[i].x; cy += lm[i].y; }); cx /= ids.length; cy /= ids.length;
    ctx.beginPath(); ids.forEach((i, k) => { const x = (cx + (lm[i].x - cx) * grow) * w, y = (cy + (lm[i].y - cy) * grow) * h; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
  };
  try { ctx.filter = `blur(${Math.max(1.5, w / 90)}px)`; } catch {}
  ctx.fillStyle = '#fff'; path(OVAL, 0.96); ctx.fill();
  ctx.fillStyle = '#000';
  [[EYE_R, 1.6], [EYE_L, 1.6], [BROW_R, 1.35], [BROW_L, 1.35], [LIPS, 1.18]].forEach(([ids, g]) => { path(ids, g); ctx.fill(); });
  [98, 327].forEach((i) => { ctx.beginPath(); ctx.arc(lm[i].x * w, lm[i].y * h, w * 0.018, 0, 7); ctx.fill(); });
  ctx.restore();
}

// Shader warp parameters for a lens (normalised coordinates for the engine).
export function warpsFor(id, g, w, h) {
  const n = (p) => [p.x / w, p.y / h];
  const r = (px) => px / h;
  const out = { warps: [], swirl: null, mirror: null };
  if (id === 'bigeyes') { out.warps.push([...n(g.eyeR), r(g.eyeDist * 0.55), 0.55], [...n(g.eyeL), r(g.eyeDist * 0.55), 0.55]); }
  if (id === 'bobble') out.warps.push([...n({ x: g.center.x, y: g.center.y - g.faceH * 0.1 }), r(g.faceH * 0.95), 0.42]);
  if (id === 'tinyface') out.warps.push([...n(g.center), r(g.faceH * 0.8), -0.75]);
  if (id === 'bubblenose') out.warps.push([...n(g.nose), r(g.eyeDist * 0.7), 0.7]);
  if (id === 'swirl') out.swirl = [...n(g.center), r(g.faceH * 0.75), 2.4 * Math.sin(performance.now() / 900)];
  if (id === 'mirror') out.mirror = [...n(g.center), r(g.faceH * 0.75), 1];
  return out;
}

// ---- drawing helpers (all original art)
function star(ctx, x, y, r, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
}
export function goldStar(ctx, x, y, r, rot = 0, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.shadowColor = 'rgba(181,123,255,.9)'; ctx.shadowBlur = r * 0.9;
  const gr = ctx.createLinearGradient(x, y - r, x, y + r); gr.addColorStop(0, '#FFE27A'); gr.addColorStop(1, '#FFB400');
  ctx.fillStyle = gr; star(ctx, x, y, r, rot); ctx.fill(); ctx.restore();
}
function sparkle(ctx, x, y, r, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.shadowColor = '#d9b8ff'; ctx.shadowBlur = r;
  ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill(); ctx.restore();
}
function at(ctx, p, rot, fn) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot); fn(); ctx.restore(); }

// Per-lens state (particles etc.)
export function createArt() {
  const parts = [];
  let lastShout = 0;
  function drawParts(ctx) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += p.r * 0.02; p.life -= 0.02; p.rot += 0.08;
      if (p.life <= 0) { parts.splice(i, 1); continue; } goldStar(ctx, p.x, p.y, p.r, p.rot, Math.min(1, p.life * 1.5)); }
  }
  return {
    draw(ctx, id, g, t, noFace = false) {
      if (noFace) { drawParts(ctx); return; }
      const s = g.eyeDist, rot = g.roll;
      if (id === 'crown') at(ctx, g.top, rot, () => {
        const W = g.faceW * 0.95, H = W * 0.42, y = -H * 0.35;
        ctx.save(); ctx.shadowColor = 'rgba(138,43,226,.8)'; ctx.shadowBlur = W * 0.08;
        const gr = ctx.createLinearGradient(0, y - H, 0, y); gr.addColorStop(0, '#FFE58A'); gr.addColorStop(1, '#E39B00'); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(-W / 2, y); ctx.lineTo(-W / 2, y - H * 0.55); ctx.lineTo(-W * 0.28, y - H * 0.25); ctx.lineTo(-W * 0.12, y - H); ctx.lineTo(0, y - H * 0.35);
        ctx.lineTo(W * 0.12, y - H); ctx.lineTo(W * 0.28, y - H * 0.25); ctx.lineTo(W / 2, y - H * 0.55); ctx.lineTo(W / 2, y); ctx.closePath(); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#8a2be2'; [-0.3, 0, 0.3].forEach((k) => { ctx.beginPath(); ctx.arc(W * k, y - H * 0.18, W * 0.045, 0, 7); ctx.fill(); });
        goldStar(ctx, 0, y - H * 1.05, W * 0.07, 0);
      });
      if (id === 'shades') {
        at(ctx, { x: (g.eyeR.x + g.eyeL.x) / 2, y: (g.eyeR.y + g.eyeL.y) / 2 }, rot, () => {
          ctx.save(); ctx.strokeStyle = '#2a0a4a'; ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.05); ctx.quadraticCurveTo(0, -s * 0.18, s * 0.2, -s * 0.05); ctx.stroke(); ctx.restore();
          [-1, 1].forEach((d) => { goldStar(ctx, d * s * 0.5, 0, s * 0.42, 0); ctx.save(); ctx.fillStyle = 'rgba(40,10,70,.82)'; star(ctx, d * s * 0.5, s * 0.02, s * 0.3, 0); ctx.fill(); ctx.restore(); });
        });
      }
      if (id === 'klsticker') at(ctx, g.cheekL, rot, () => {
        const r = s * 0.3; ctx.save(); ctx.rotate(-0.2); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = r * 0.3;
        const gr = ctx.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, '#b57bff'); gr.addColorStop(1, '#5a17b0'); ctx.fillStyle = gr;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-r, -r * 0.75, r * 2, r * 1.5, r * 0.45) : ctx.rect(-r, -r * 0.75, r * 2, r * 1.5); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#FFD24A'; ctx.font = `800 ${r * 0.95}px "Space Grotesk", Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KL', 0, r * 0.05); ctx.restore();
      });
      if (id === 'cheeks' || id === 'blush') [g.cheekR, g.cheekL].forEach((c, k) => at(ctx, c, rot, () => {
        ctx.save(); ctx.fillStyle = id === 'blush' ? 'rgba(255,90,140,.55)' : 'rgba(255,120,190,.35)';
        ctx.beginPath(); ctx.ellipse(0, s * 0.05, s * 0.28, s * 0.17, 0, 0, 7); ctx.fill();
        if (id === 'blush') { ctx.strokeStyle = 'rgba(200,30,90,.6)'; ctx.lineWidth = s * 0.025; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.1 - s * 0.04, s * 0.12); ctx.lineTo(i * s * 0.1 + s * 0.04, -s * 0.02); ctx.stroke(); } }
        ctx.restore();
        if (id === 'cheeks') for (let i = 0; i < 3; i++) { const a = t / 400 + i * 2.1 + k; sparkle(ctx, Math.cos(a) * s * 0.22, Math.sin(a * 1.3) * s * 0.12, s * (0.06 + 0.03 * Math.sin(t / 200 + i)), 0.9); }
      }));
      if (id === 'pup') {
        at(ctx, g.top, rot, () => [-1, 1].forEach((d) => {
          ctx.save(); ctx.translate(d * g.faceW * 0.42, g.faceH * 0.02); ctx.rotate(d * (0.35 + 0.06 * Math.sin(t / 300)));
          const gr = ctx.createLinearGradient(0, -s * 0.6, 0, s * 0.6); gr.addColorStop(0, '#7a4bc2'); gr.addColorStop(1, '#3d1a73'); ctx.fillStyle = gr;
          ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 0.3, s * 0.62, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#c9a2ff'; ctx.beginPath(); ctx.ellipse(0, s * 0.2, s * 0.16, s * 0.42, 0, 0, 7); ctx.fill(); ctx.restore();
        }));
        at(ctx, g.nose, rot, () => { ctx.save(); ctx.fillStyle = '#1b0a2e'; ctx.beginPath(); ctx.ellipse(0, -s * 0.02, s * 0.2, s * 0.14, 0, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(-s * 0.06, -s * 0.07, s * 0.05, s * 0.03, 0, 0, 7); ctx.fill(); ctx.restore(); });
        if (g.mouthOpen > 0.3) at(ctx, g.mouth, rot, () => { ctx.save(); ctx.fillStyle = '#ff6fa8'; ctx.beginPath(); ctx.ellipse(0, s * 0.25, s * 0.14, s * 0.24, 0, 0, 7); ctx.fill(); ctx.restore(); });
      }
      if (id === 'alien') at(ctx, g.top, rot, () => [-1, 1].forEach((d) => {
        const sway = Math.sin(t / 350 + d) * s * 0.08;
        ctx.save(); ctx.strokeStyle = '#5be37a'; ctx.lineWidth = s * 0.06; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(d * s * 0.3, 0); ctx.quadraticCurveTo(d * s * 0.45, -s * 0.6, d * s * 0.55 + sway, -s * 1.0); ctx.stroke();
        ctx.fillStyle = '#9dff8a'; ctx.shadowColor = '#b57bff'; ctx.shadowBlur = s * 0.3; ctx.beginPath(); ctx.arc(d * s * 0.55 + sway, -s * 1.05, s * 0.13, 0, 7); ctx.fill(); ctx.restore();
      }));
      if (id === 'dapper') {
        at(ctx, g.upperLip, rot, () => { ctx.save(); ctx.fillStyle = '#2b1606';
          ctx.beginPath(); ctx.moveTo(0, -s * 0.02);
          ctx.bezierCurveTo(-s * 0.15, -s * 0.12, -s * 0.38, -s * 0.05, -s * 0.48, -s * 0.16); ctx.bezierCurveTo(-s * 0.5, -s * 0.02, -s * 0.3, s * 0.1, 0, s * 0.04);
          ctx.bezierCurveTo(s * 0.3, s * 0.1, s * 0.5, -s * 0.02, s * 0.48, -s * 0.16); ctx.bezierCurveTo(s * 0.38, -s * 0.05, s * 0.15, -s * 0.12, 0, -s * 0.02); ctx.fill(); ctx.restore(); });
        at(ctx, g.eyeL, rot, () => { ctx.save(); ctx.strokeStyle = '#FFC83D'; ctx.lineWidth = s * 0.05; ctx.shadowColor = 'rgba(138,43,226,.7)'; ctx.shadowBlur = s * 0.1;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(200,220,255,.18)'; ctx.fill();
          ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.moveTo(s * 0.21, s * 0.21); ctx.quadraticCurveTo(s * 0.5, s * 0.9, s * 0.3, s * 1.4); ctx.stroke(); ctx.restore(); });
      }
      if (id === 'starmouth' && g.mouthOpen > 0.33 && t - lastShout > 70) {
        lastShout = t;
        for (let i = 0; i < 2; i++) { const a = rot + Math.PI / 2 + (Math.random() - 0.5) * 1.6; const sp = s * (0.04 + Math.random() * 0.05);
          parts.push({ x: g.mouth.x, y: g.mouth.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - s * 0.02, r: s * (0.08 + Math.random() * 0.08), life: 1, rot: Math.random() * 3 }); }
      }
      drawParts(ctx);
    }
  };
}

// Fun FX overlay: gold stars drifting around the frame.
export function createSparkle() {
  const st = [];
  return {
    draw(ctx, w, h, t) {
      const m = Math.min(w, h);
      while (st.length < 14) st.push({ x: Math.random() * w, y: h + Math.random() * h * 0.3, r: m * (0.012 + Math.random() * 0.02), v: m * (0.0015 + Math.random() * 0.003), ph: Math.random() * 6, rot: Math.random() * 3 });
      st.forEach((p) => { p.y -= p.v; p.x += Math.sin(t / 900 + p.ph) * 0.6; p.rot += 0.01;
        if (p.y < -p.r * 3) { p.y = h + p.r * 3; p.x = Math.random() * w; }
        const a = 0.55 + 0.45 * Math.sin(t / 300 + p.ph);
        if (p.ph > 3) goldStar(ctx, p.x, p.y, p.r, p.rot, a); else sparkle(ctx, p.x, p.y, p.r * 1.1, a); });
    }
  };
}
