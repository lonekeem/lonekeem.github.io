// Lone Keem Studios - Post tab: in-app camera (getUserMedia + MediaRecorder), photo capture,
// library upload, preview + caption, and direct browser upload to Cloudinary (unsigned preset).
// Falls back to <input type=file capture> where the camera APIs aren't available (older iOS).
// Until js/media-config.js has a real cloud name, the whole UI works but posting shows an
// "Uploads are almost ready" notice instead of trying (and failing) to upload.
import {
  CLOUDINARY, LIMITS, VIDEO_EXT, IMAGE_EXT, uploadsReady, uploadEndpoint, deliveryUrls
} from './media-config.js';
import { ICONS } from './icons.js';
import { LIVE_CAP } from './live.js';

const IC = {
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.6L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3.5V8h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20.5V16h-4.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>',
  story: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" stroke-dasharray="2.6 2.4"/><path d="M12 3a9 9 0 0 1 9 9"/><path d="M12 8v8M8 12h8"/></svg>',
  camoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M15.5 10.5 21.5 7v10l-2.3-1.3M13 6h1.5a1 1 0 0 1 1 1v3.5M15.5 15.5V17a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h2.5"/></svg>'
};
const RING_R = 46, RING_C = 2 * Math.PI * RING_R;
const VIDEO_MIME = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const IMAGE_MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', webp: 'image/webp' };
const LIB_ACCEPT = 'video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/heic,image/heif,image/webp,.mp4,.mov,.webm,.jpg,.jpeg,.png,.heic,.heif,.webp';

const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtMB = (b) => (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + ' MB';
const extOf = (name) => (String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';

export const notReadyNotice = (compact) => compact ? `
  <div class="notice soon" role="status">${IC.spark}<div><b>Uploads are almost ready</b>
  Posting photos and videos opens very soon. Thanks for your patience!</div></div>` : `
  <div class="notice soon" role="status">${IC.spark}<div><b>Uploads are almost ready</b>
  Photo and video posting is being switched on right now. You can try the camera and preview your clip;
  the Post button opens up very soon. Text posts and YouTube/TikTok links work today.</div></div>`;

// ------------------------------------------------------------------ file checks
export function classify(file) {
  const ext = extOf(file.name);
  const t = (file.type || '').toLowerCase();
  if (t.startsWith('video/') || VIDEO_EXT.includes(ext)) {
    return Object.values(VIDEO_MIME).some((m) => t.startsWith(m)) || VIDEO_EXT.includes(ext) ? 'video' : '';
  }
  if (t.startsWith('image/') || IMAGE_EXT.includes(ext)) {
    return Object.values(IMAGE_MIME).includes(t) || IMAGE_EXT.includes(ext) ? 'image' : '';
  }
  return '';
}
function videoMeta(url) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(t); v.removeAttribute('src'); v.load(); resolve(r); };
    const t = setTimeout(() => finish({ duration: 0, width: 0, height: 0, unknown: true }), 8000);
    v.onerror = () => finish({ duration: 0, width: 0, height: 0, unknown: true });
    v.onloadedmetadata = () => {
      const out = () => finish({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
      if (Number.isFinite(v.duration)) return out();
      // MediaRecorder WebM files report Infinity until you seek to the end.
      v.ondurationchange = () => { if (Number.isFinite(v.duration)) out(); };
      v.currentTime = 1e101;
    };
    v.src = url;
  });
}
function imageMeta(url) {
  return new Promise((resolve) => {
    const i = new Image();
    i.onload = () => resolve({ width: i.naturalWidth, height: i.naturalHeight });
    i.onerror = () => resolve({ width: 0, height: 0, unknown: true });
    i.src = url;
  });
}
// Returns { kind, url, duration, width, height, previewable } or throws a friendly Error.
export async function inspectFile(file, known = {}, maxSeconds = LIMITS.maxVideoSeconds, forStory = false) {
  const kind = classify(file);
  if (!kind) throw new Error('That file type isn’t supported. Use MP4, MOV or WebM videos, or JPG, PNG, HEIC or WebP photos.');
  const maxMB = kind === 'video' ? LIMITS.maxVideoMB : LIMITS.maxImageMB;
  if (file.size > maxMB * 1048576) {
    throw new Error(kind === 'video' ? `That video is ${fmtMB(file.size)}. Videos can be up to ${maxMB} MB.` : `That photo is ${fmtMB(file.size)}. Photos can be up to ${maxMB} MB.`);
  }
  if (!file.size) throw new Error('That file is empty. Try another one.');
  const url = URL.createObjectURL(file);
  const meta = kind === 'video' ? await videoMeta(url) : await imageMeta(url);
  const duration = known.duration || meta.duration || 0;
  if (kind === 'video' && duration > maxSeconds + 0.5) {
    URL.revokeObjectURL(url);
    throw new Error(forStory
      ? `That video is ${fmtTime(duration)} long. Story videos can be up to ${maxSeconds} seconds; trim it and try again.`
      : `That video is ${fmtTime(duration)} long. Videos can be up to ${maxSeconds} seconds; trim it and try again.`);
  }
  return { kind, url, duration, width: meta.width || 0, height: meta.height || 0, previewable: !meta.unknown };
}

function pickRecorderMime() {
  if (!window.MediaRecorder) return '';
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
}
export const cameraSupport = () => ({
  stream: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false,
  recorder: !!window.MediaRecorder && !!pickRecorderMime()
});

// ------------------------------------------------------------------ composer
export function createComposer(ctx) {
  const { S, main, esc, $, toast, friendlyError, isAdmin, STUDIO_UID, saveMediaPost, saveStory } = ctx;
  let ov = null;       // overlay element (camera or preview)
  let target = 'post'; // 'post' or 'story' (24h story: video up to 15 s, text overlay)
  const isStory = () => target === 'story';
  const maxSec = () => (isStory() ? LIMITS.storyVideoSeconds : LIMITS.maxVideoSeconds);
  let stream = null;
  let cleanupFns = [];

  function closeOverlay() {
    cleanupFns.forEach((f) => { try { f(); } catch { /* ignore */ } }); cleanupFns = [];
    stopStream();
    if (ov) { ov.remove(); ov = null; }
    document.body.classList.remove('cam-open');
  }
  function stopStream() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
  function mountOverlay(html, cls) {
    closeOverlay();
    ov = document.createElement('div');
    ov.className = 'cam ' + (cls || '');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = html;
    document.body.appendChild(ov);
    document.body.classList.add('cam-open');
    return ov;
  }

  // Hidden file inputs live on the Post page so they can be clicked from a user gesture.
  const inputsHtml = `
    <input type="file" id="in-library" accept="${LIB_ACCEPT}" hidden>
    <input type="file" id="in-cap-video" accept="video/*" capture="environment" hidden>
    <input type="file" id="in-cap-photo" accept="image/*" capture="environment" hidden>`;
  function wireInputs(root) {
    ['in-library', 'in-cap-video', 'in-cap-photo'].forEach((id) => {
      const el = root.querySelector('#' + id); if (!el) return;
      el.onchange = async () => {
        const file = el.files && el.files[0]; el.value = '';
        if (!file) return;
        try {
          const info = await inspectFile(file, {}, maxSec(), isStory());
          openPreview(file, info, id === 'in-library' ? 'library' : 'capture');
        } catch (e) { toast(e.message || 'That file can’t be used.'); }
      };
    });
  }
  const pickFile = (id) => { const el = document.getElementById(id); if (el) el.click(); };

  // ---------------------------------------------------------------- Post tab (chooser)
  function render(token, { textForm } = {}) {
    const ready = uploadsReady();
    main.innerHTML = `
      <h1 class="page-title">Create</h1>
      ${ready ? '' : notReadyNotice()}
      <div class="create-grid">
        <button class="create-opt" data-src="video"><span class="ci">${IC.video}</span><b>Record video</b><small>Up to ${LIMITS.maxVideoSeconds} seconds</small></button>
        <button class="create-opt" data-src="photo"><span class="ci">${IC.photo}</span><b>Take photo</b><small>Front or back camera</small></button>
        <button class="create-opt wide live-opt" data-src="live"><span class="ci">${ICONS.live}</span><b>Go Live</b><small>Stream from your camera to up to ${LIVE_CAP} viewers · live chat + stars</small></button>
        <button class="create-opt wide story-opt" data-src="story"><span class="ci">${IC.story}</span><b>Add to your story</b><small>Photo or video up to ${LIMITS.storyVideoSeconds}s · disappears after ${LIMITS.storyHours} hours</small></button>
        <button class="create-opt wide" data-src="library"><span class="ci">${IC.library}</span><b>Upload from library</b><small>Videos up to ${LIMITS.maxVideoSeconds}s / ${LIMITS.maxVideoMB} MB · photos up to ${LIMITS.maxImageMB} MB</small></button>
      </div>
      <div class="divider">or</div>
      <div id="text-slot"></div>
      ${inputsHtml}`;
    wireInputs(main);
    main.querySelectorAll('.create-opt').forEach((b) => {
      b.onclick = () => {
        const src = b.dataset.src;
        if (src === 'live') { location.hash = '#/live/new'; return; }
        if (src === 'story') return openStory();
        target = 'post';
        if (src === 'library') return pickFile('in-library');
        const sup = cameraSupport();
        if (!sup.stream || (src === 'video' && !sup.recorder)) return pickFile(src === 'video' ? 'in-cap-video' : 'in-cap-photo');
        openCamera(src);
      };
    });
    textForm($('#text-slot'));
    S.unsubs.push(closeOverlay);
  }

  // Story camera: opened from the Create page, the "+" on your avatar in the stories row,
  // or the For You overlay. Needs the inputs in the DOM, so it brings its own.
  function openStory() {
    target = 'story';
    const sup = cameraSupport();
    if (sup.stream) return openCamera('photo');
    // No in-page camera: fall back to the library picker (mounted in a temporary overlay).
    mountOverlay(`<div class="cam-msg" role="alert">${IC.story}<h2>Add to your story</h2><p>Pick a photo or a video up to ${LIMITS.storyVideoSeconds} seconds.</p>
      <div class="cam-msg-btns"><button class="btn" data-a="library">Choose from library</button><button class="btn btn-ghost" data-a="close">Cancel</button></div></div>${inputsHtml}`, 'cam-camera has-msg');
    wireInputs(ov);
    ov.querySelector('[data-a=library]').onclick = () => pickFile('in-library');
    ov.querySelector('[data-a=close]').onclick = closeOverlay;
  }

  // ---------------------------------------------------------------- camera
  function openCamera(mode = 'video') {
    let facing = 'user';
    let recorder = null, chunks = [], recStart = 0, raf = 0, recording = false, pressAt = 0, startedThisPress = false;
    const el = mountOverlay(`
      <video class="cam-view mirror" playsinline muted autoplay aria-label="Camera preview"></video>
      <div class="cam-flash" aria-hidden="true"></div>
      <div class="cam-top">
        <button class="cam-btn" data-a="close" aria-label="Close camera">${IC.close}</button>
        <div class="cam-timer" hidden><span class="rec-dot" aria-hidden="true"></span><span class="t">0:00</span> / ${fmtTime(maxSec())}</div>
        ${isStory() ? '<span class="cam-story-chip">Story</span>' : ''}
        <button class="cam-btn" data-a="flip" aria-label="Switch to back camera">${IC.flip}</button>
      </div>
      <div class="cam-msg" hidden role="alert"></div>
      <div class="cam-bottom">
        <div class="cam-modes" role="radiogroup" aria-label="Camera mode">
          <button role="radio" data-mode="video">Video</button><button role="radio" data-mode="photo">Photo</button>
        </div>
        <div class="cam-controls">
          <button class="cam-lib" data-a="library" aria-label="Upload from library">${IC.library}</button>
          <button class="cam-shutter" data-a="shutter" aria-label="Record video">
            <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${RING_R}"/><circle class="prog" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
            <span class="core" aria-hidden="true"></span>
          </button>
          <span class="cam-side"></span>
        </div>
        <p class="cam-hint" aria-live="polite"></p>
      </div>
      ${inputsHtml}`, 'cam-camera');
    wireInputs(el);
    const view = el.querySelector('.cam-view'), shutter = el.querySelector('.cam-shutter'), prog = el.querySelector('.prog');
    const timer = el.querySelector('.cam-timer'), tEl = timer.querySelector('.t'), msg = el.querySelector('.cam-msg');
    const hint = el.querySelector('.cam-hint'), flipBtn = el.querySelector('[data-a=flip]');

    function paintMode() {
      el.dataset.mode = mode;
      el.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      shutter.setAttribute('aria-label', mode === 'video' ? (recording ? 'Stop recording' : 'Record video') : 'Take photo');
      hint.textContent = mode === 'video' ? (recording ? 'Tap to stop' : `Tap to record, or hold · up to ${maxSec()}s`) : (isStory() ? 'Tap for a photo story' : 'Tap to take a photo');
    }
    function showMsg(title, body, actions) {
      msg.innerHTML = `${IC.camoff}<h2>${esc(title)}</h2><p>${body}</p><div class="cam-msg-btns">${actions}</div>`;
      msg.hidden = false; el.classList.add('has-msg');
      msg.querySelector('[data-a=retry]')?.addEventListener('click', start);
      msg.querySelector('[data-a=library]')?.addEventListener('click', () => pickFile('in-library'));
      msg.querySelector('[data-a=native]')?.addEventListener('click', () => pickFile(mode === 'video' ? 'in-cap-video' : 'in-cap-photo'));
    }
    async function start() {
      msg.hidden = true; el.classList.remove('has-msg');
      stopStream();
      const video = { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
      try {
        try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
        catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); // no mic available
        }
        if (!ov || ov !== el) { stopStream(); return; }
        view.srcObject = stream;
        view.classList.toggle('mirror', facing === 'user');
        await view.play().catch(() => {});
        el.classList.add('live');
        try {
          const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
          flipBtn.hidden = cams.length < 2;
        } catch { /* keep flip visible */ }
        flipBtn.setAttribute('aria-label', facing === 'user' ? 'Switch to back camera' : 'Switch to front camera');
      } catch (e) {
        el.classList.remove('live');
        const n = e && e.name;
        if (n === 'NotAllowedError' || n === 'SecurityError') {
          showMsg('Camera access is blocked',
            'To record here, allow <b>camera</b> and <b>microphone</b> for this site in your browser settings (tap the lock or “aA” icon next to the address), then try again. You can also upload a video or photo from your library.',
            '<button class="btn" data-a="retry">Try again</button><button class="btn btn-ghost" data-a="library">Upload from library</button>');
        } else if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'NotReadableError') {
          showMsg(n === 'NotReadableError' ? 'Camera is busy' : 'No camera found',
            n === 'NotReadableError' ? 'Another app may be using your camera. Close it and try again.' : 'We couldn’t find a camera on this device. You can still upload from your library.',
            '<button class="btn" data-a="retry">Try again</button><button class="btn btn-ghost" data-a="library">Upload from library</button>');
        } else {
          showMsg('Camera unavailable', 'Your browser couldn’t open the camera. Use your phone’s camera app instead, or upload from your library.',
            '<button class="btn" data-a="native">Open camera app</button><button class="btn btn-ghost" data-a="library">Upload from library</button>');
        }
      }
    }

    function tick() {
      const el2 = (performance.now() - recStart) / 1000;
      const f = Math.min(1, el2 / maxSec());
      prog.setAttribute('stroke-dashoffset', String(RING_C * (1 - f)));
      tEl.textContent = fmtTime(el2);
      if (el2 >= maxSec()) { stopRec(); return; }
      raf = requestAnimationFrame(tick);
    }
    function startRec() {
      if (!stream || recording) return;
      const mimeType = pickRecorderMime();
      try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 }); }
      catch { recorder = new MediaRecorder(stream); }
      chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = finishRec;
      recorder.start(250);
      recording = true; recStart = performance.now();
      el.classList.add('recording'); timer.hidden = false; flipBtn.disabled = true;
      el.querySelector('.cam-modes').setAttribute('aria-disabled', 'true');
      paintMode(); raf = requestAnimationFrame(tick);
    }
    function stopRec() {
      if (!recording) return;
      recording = false; cancelAnimationFrame(raf);
      el.classList.remove('recording'); flipBtn.disabled = false;
      el.querySelector('.cam-modes').removeAttribute('aria-disabled');
      recorder.__dur = (performance.now() - recStart) / 1000;
      try { recorder.stop(); } catch { finishRec(); }
      paintMode();
    }
    async function finishRec() {
      const dur = Math.min(maxSec(), recorder?.__dur || 0);
      const type = (recorder?.mimeType || pickRecorderMime() || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type }); chunks = [];
      prog.setAttribute('stroke-dashoffset', String(RING_C)); timer.hidden = true; tEl.textContent = '0:00';
      if (dur < 1 || !blob.size) { hint.textContent = 'That was too short. Tap to record, or hold the button.'; return; }
      const file = new File([blob], `recording-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
      try {
        const info = await inspectFile(file, { duration: dur }, maxSec(), isStory());
        stopStream();
        openPreview(file, { ...info, duration: dur }, 'camera', mode);
      } catch (e) { toast(e.message); }
    }
    function takePhoto() {
      if (!stream || !view.videoWidth) return;
      const c = document.createElement('canvas');
      c.width = view.videoWidth; c.height = view.videoHeight;
      const g = c.getContext('2d');
      if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
      g.drawImage(view, 0, 0, c.width, c.height);
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      c.toBlob(async (blob) => {
        if (!blob) return toast('Couldn’t take the photo. Try again.');
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        try { const info = await inspectFile(file, {}, maxSec(), isStory()); stopStream(); openPreview(file, info, 'camera', mode); }
        catch (e) { toast(e.message); }
      }, 'image/jpeg', 0.92);
    }

    // Shutter: photo = tap. Video = tap to start / tap to stop, or hold and release to stop.
    shutter.addEventListener('pointerdown', (e) => {
      if (mode !== 'video' || e.button > 0) return;
      pressAt = performance.now(); startedThisPress = false;
      if (!recording) { startRec(); startedThisPress = true; }
      shutter.setPointerCapture?.(e.pointerId);
    });
    shutter.addEventListener('pointerup', () => {
      if (mode !== 'video' || !pressAt) return;
      const held = performance.now() - pressAt; pressAt = 0;
      if (recording && (!startedThisPress || held > 450)) stopRec();
    });
    shutter.addEventListener('pointercancel', () => { if (pressAt && recording && performance.now() - pressAt > 450) stopRec(); pressAt = 0; });
    shutter.addEventListener('contextmenu', (e) => e.preventDefault());
    shutter.addEventListener('click', (e) => {
      if (mode === 'photo') return takePhoto();
      if (e.detail === 0) { recording ? stopRec() : startRec(); } // keyboard
    });
    el.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
      if (recording) return;
      if (b.dataset.mode === 'video' && !cameraSupport().recorder) { pickFile('in-cap-video'); return; }
      mode = b.dataset.mode; paintMode();
    }));
    flipBtn.onclick = () => { if (recording) return; facing = facing === 'user' ? 'environment' : 'user'; start(); };
    el.querySelector('[data-a=close]').onclick = () => { if (recording) { recording = false; cancelAnimationFrame(raf); recorder.onstop = null; try { recorder.stop(); } catch { /* */ } } closeOverlay(); };
    el.querySelector('[data-a=library]').onclick = () => pickFile('in-library');
    const onKey = (e) => { if (e.key === 'Escape' && ov === el && !recording) closeOverlay(); };
    document.addEventListener('keydown', onKey);
    cleanupFns.push(() => {
      document.removeEventListener('keydown', onKey); cancelAnimationFrame(raf);
      if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; try { recorder.stop(); } catch { /* */ } }
    });
    paintMode();
    start();
  }

  // ---------------------------------------------------------------- preview + post
  function openPreview(file, info, source, camMode) {
    const ready = uploadsReady();
    let xhr = null, uploaded = null, busy = false;
    const isVideo = info.kind === 'video';
    const story = isStory();
    const panel = story ? `
      <form class="pv-panel" id="pv-form" novalidate>
        ${ready ? '' : notReadyNotice(true)}
        <label for="pv-caption" class="sr-only">Text on your story</label>
        <input id="pv-caption" type="text" maxlength="${LIMITS.storyCaptionMax}" placeholder="Add text to your story…" autocomplete="off" enterkeyhint="done">
        <div class="pv-row small muted"><span>${isAdmin() ? '<label class="check pv-studio"><input type="checkbox" id="pv-studio"> <span>Share as <b>Lone Keem Studios</b></span></label>' : 'Visible to your followers for 24 hours.'}</span><span><span id="pv-count">0</span>/${LIMITS.storyCaptionMax}</span></div>
        <div class="pv-progress" hidden aria-hidden="true"><span></span></div>
        <p class="pv-status small muted" aria-live="polite"></p>
        <p class="form-error" id="pv-err"></p>
        <div class="pv-actions">
          <button type="button" class="btn btn-ghost" data-a="cancel">Cancel</button>
          <button type="submit" class="btn" id="pv-post" ${ready ? '' : 'disabled aria-disabled="true"'}>${ready ? 'Share to story' : 'Share · almost ready'}</button>
        </div>
      </form>` : `
      <form class="pv-panel" id="pv-form" novalidate>
        ${ready ? '' : notReadyNotice(true)}
        <label for="pv-caption" class="sr-only">Caption</label>
        <textarea id="pv-caption" maxlength="${LIMITS.captionMax}" rows="2" placeholder="Write a caption…"></textarea>
        <div class="pv-row small muted"><span>${isAdmin() ? '<label class="check pv-studio"><input type="checkbox" id="pv-studio"> <span>Post as <b>Lone Keem Studios</b></span></label>' : 'By posting you agree to the <a href="guidelines.html">Community Guidelines</a>.'}</span><span><span id="pv-count">0</span>/${LIMITS.captionMax}</span></div>
        <div class="pv-progress" hidden aria-hidden="true"><span></span></div>
        <p class="pv-status small muted" aria-live="polite"></p>
        <p class="form-error" id="pv-err"></p>
        <div class="pv-actions">
          <button type="button" class="btn btn-ghost" data-a="cancel">Cancel</button>
          <button type="submit" class="btn" id="pv-post" ${ready ? '' : 'disabled aria-disabled="true"'}>${ready ? 'Post' : 'Post · almost ready'}</button>
        </div>
      </form>`;
    const el = mountOverlay(`
      <div class="pv-media ${isVideo ? 'is-video' : 'is-image'}">
        ${info.previewable
          ? (isVideo
            ? `<video class="pv-el" src="${esc(info.url)}" playsinline webkit-playsinline autoplay loop muted aria-label="Your video"></video><button class="pv-sound" data-a="sound" aria-pressed="false">Tap for sound</button>`
            : `<img class="pv-el" src="${esc(info.url)}" alt="Your photo">`)
          : `<div class="pv-nopreview">${isVideo ? IC.video : IC.photo}<p>Preview isn’t available in this browser, but the ${isVideo ? 'video' : 'photo'} can still be posted.</p></div>`}
        ${story ? '<p class="story-cap pv-story-cap" hidden></p>' : ''}
      </div>
      <div class="cam-top pv-top">
        <button class="cam-btn pill" data-a="retake">${IC.back}<span>${source === 'library' ? 'Choose another' : 'Retake'}</span></button>
        <span class="pv-chip">${story ? 'Story · ' : ''}${isVideo ? `Video · ${fmtTime(info.duration)}` : 'Photo'} · ${fmtMB(file.size)}</span>
      </div>
      ${panel}
      ${inputsHtml}`, 'cam-preview' + (story ? ' is-story' : ''));
    wireInputs(el);
    const media = el.querySelector('.pv-el');
    if (media && isVideo) {
      media.addEventListener('click', () => (media.paused ? media.play() : media.pause()));
      const sb = el.querySelector('[data-a=sound]');
      sb.onclick = () => { media.muted = !media.muted; sb.setAttribute('aria-pressed', !media.muted); sb.textContent = media.muted ? 'Tap for sound' : 'Sound on'; media.play().catch(() => {}); };
    }
    const cap = el.querySelector('#pv-caption');
    const capOv = el.querySelector('.pv-story-cap');
    cap.oninput = () => {
      el.querySelector('#pv-count').textContent = cap.value.length;
      if (capOv) { capOv.textContent = cap.value; capOv.hidden = !cap.value.trim(); }
    };
    const bar = el.querySelector('.pv-progress'), barIn = bar.querySelector('span'), status = el.querySelector('.pv-status'), err = el.querySelector('#pv-err');
    const postBtn = el.querySelector('#pv-post');
    const revoke = () => URL.revokeObjectURL(info.url);
    cleanupFns.push(() => { if (xhr) xhr.abort(); revoke(); });

    el.querySelector('[data-a=retake]').onclick = () => {
      if (busy && !confirm('Stop uploading and go back?')) return;
      if (source === 'camera') openCamera(camMode || (isVideo ? 'video' : 'photo'));
      else { closeOverlay(); pickFile(source === 'library' ? 'in-library' : (isVideo ? 'in-cap-video' : 'in-cap-photo')); }
    };
    el.querySelector('[data-a=cancel]').onclick = () => {
      if (busy && !confirm('Cancel this upload?')) return;
      closeOverlay(); target = 'post';
    };
    el.querySelector('#pv-form').onsubmit = async (ev) => {
      ev.preventDefault();
      if (!uploadsReady()) { err.textContent = 'Uploads are almost ready. Please check back very soon.'; return; }
      if (busy) return;
      err.textContent = ''; busy = true; postBtn.disabled = true; postBtn.textContent = 'Posting…';
      try {
        if (!uploaded) {
          bar.hidden = false; status.textContent = 'Uploading… 0%';
          uploaded = await upload(file, (f) => { barIn.style.transform = `scaleX(${f})`; status.textContent = f >= 1 ? 'Processing…' : `Uploading… ${Math.round(f * 100)}%`; });
        }
        const asStudio = isAdmin() && !!el.querySelector('#pv-studio')?.checked;
        if (story) {
          status.textContent = 'Sharing your story…';
          await saveStory({ upload: uploaded, info, caption: cap.value.trim().slice(0, LIMITS.storyCaptionMax), asStudio });
          closeOverlay(); target = 'post';
          toast('Added to your story');
          if (location.hash === '#/feed') window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = '#/feed';
          return;
        }
        status.textContent = 'Saving your post…';
        const id = await saveMediaPost({ upload: uploaded, info, caption: cap.value.trim(), asStudio });
        closeOverlay();
        toast('Posted!');
        location.hash = '#/watch/' + id;
      } catch (e) {
        busy = false; postBtn.disabled = false; postBtn.textContent = 'Try again';
        status.textContent = uploaded ? 'Upload finished; the post wasn’t saved yet.' : '';
        if (!uploaded) { bar.hidden = true; barIn.style.transform = 'scaleX(0)'; }
        err.textContent = e && e.code === 'permission-denied' ? 'You can post once every 20 seconds. Wait a moment and tap Try again.' : (e && e.userMessage) || friendlyError(e);
      }
    };

    function upload(f, onProgress) {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('upload_preset', story ? CLOUDINARY.storyPreset : CLOUDINARY.uploadPreset);
        fd.append('tags', story ? 'lks_story' : 'lks_user');
        if (S.user) fd.append('context', `uid=${S.user.uid}`);
        xhr = new XMLHttpRequest();
        xhr.open('POST', uploadEndpoint());
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
        xhr.onload = () => {
          let j = null; try { j = JSON.parse(xhr.responseText); } catch { /* */ }
          xhr = null;
          if (j && j.public_id && j.secure_url) return resolve(j);
          const m = (j && j.error && j.error.message) || '';
          const er = new Error(m || 'Upload failed.');
          er.userMessage = /format|allowed/i.test(m) ? 'That file type isn’t allowed. Use MP4, MOV, WebM, JPG, PNG, HEIC or WebP.'
            : /size|too large/i.test(m) ? 'That file is too big to upload.'
            : /preset/i.test(m) ? 'Uploads aren’t set up correctly yet. Please try again later.'
            : 'The upload didn’t go through. Check your connection and try again.';
          reject(er);
        };
        xhr.onerror = () => { xhr = null; const er = new Error('Network error'); er.userMessage = 'Network problem during upload. Check your connection and try again.'; reject(er); };
        xhr.onabort = () => { xhr = null; const er = new Error('aborted'); er.userMessage = 'Upload cancelled.'; reject(er); };
        xhr.send(fd);
      });
    }
  }

  return { render, close: closeOverlay, deliveryUrls, openStory };
}
