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
import { createFx } from './fx/pipeline.js';
import { mountPicker } from './fx/picker.js';
import { FX_DEFAULT } from './fx/looks.js';
import { onDoubleTap } from './tapstar.js';
import { openEditor } from './snapedit.js';
import { WORK_IC, DESC as WORK_DESC } from './works.js';

// Camera rail icons (same stroke style as the rest of the app)
const SIC = {
  flash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M10 2.5h4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/></svg>',
  beauty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
  lens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/></svg>'
};

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
// 600 -> "10 minutes" ("10 min" when short), 15 -> "15 seconds".
const fmtLimit = (sec, short = false) => sec >= 60
  ? `${Math.round(sec / 60)} ${short ? 'min' : Math.round(sec / 60) === 1 ? 'minute' : 'minutes'}`
  : `${sec} ${short ? 's' : 'seconds'}`;
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
    throw new Error(kind === 'video'
      ? `That video is ${fmtMB(file.size)}, and videos can be up to ${maxMB} MB. Tip: export or save it at 720p (most phones and editing apps have this option), which keeps a 10-minute video under ${maxMB} MB, then try again.`
      : `That photo is ${fmtMB(file.size)}. Photos can be up to ${maxMB} MB.`);
  }
  if (!file.size) throw new Error('That file is empty. Try another one.');
  const url = URL.createObjectURL(file);
  const meta = kind === 'video' ? await videoMeta(url) : await imageMeta(url);
  const duration = known.duration || meta.duration || 0;
  if (kind === 'video' && duration > maxSeconds + 0.5) {
    URL.revokeObjectURL(url);
    throw new Error(forStory
      ? `That video is ${fmtTime(duration)} long. Story videos can be up to ${maxSeconds} seconds; trim it and try again.`
      : `That video is ${fmtTime(duration)} long. Videos can be up to ${fmtLimit(maxSeconds)}; trim it and try again.`);
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
  const { S, main, esc, $, toast, friendlyError, isAdmin, STUDIO_UID, saveMediaPost, saveStory, sendSnap, snapFriends } = ctx;
  let ov = null;       // overlay element (camera or preview)
  let target = 'post'; // 'post' or 'story' (24h story: video up to 15 s, text overlay)
  const isStory = () => target === 'story';
  const maxSec = () => (isStory() ? LIMITS.storyVideoSeconds : LIMITS.cameraVideoSeconds);
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
          // Library files (and the phone's own camera app) get the 10-minute limit; stories stay 15s.
          const info = await inspectFile(file, {}, isStory() ? LIMITS.storyVideoSeconds : LIMITS.maxVideoSeconds, isStory());
          openPreview(file, info, id === 'in-library' ? 'library' : 'capture');
        } catch (e) { toast(e.message || 'That file can’t be used.'); }
      };
    });
  }
  const pickFile = (id) => { const el = document.getElementById(id); if (el) el.click(); };

  // ---------------------------------------------------------------- Post tab (chooser)
  function render(token, { textForm, sub } = {}) {
    const ready = uploadsReady();
    // Camera-first: Create opens straight into the full-screen camera (#/new/menu = the old chooser).
    const sup0 = cameraSupport();
    if (sub !== 'menu' && sub !== 'text' && sup0.stream && sup0.recorder) {
      target = 'post';
      main.innerHTML = `<h1 class="page-title">Create</h1><p class="muted small">Opening camera… <a href="#/new/menu">More options</a></p>`;
      S.unsubs.push(closeOverlay);
      openCamera('snap');
      return;
    }
    main.innerHTML = `
      <h1 class="page-title">Create</h1>
      ${ready ? '' : notReadyNotice()}
      <div class="create-grid">
        <button class="create-opt" data-src="video"><span class="ci">${IC.video}</span><b>Record video</b><small>Up to ${fmtLimit(LIMITS.cameraVideoSeconds)}</small></button>
        <button class="create-opt" data-src="photo"><span class="ci">${IC.photo}</span><b>Take photo</b><small>Front or back camera</small></button>
        <button class="create-opt wide live-opt" data-src="live"><span class="ci">${ICONS.live}</span><b>Go Live</b><small>Stream from your camera to up to ${LIVE_CAP} viewers · live chat + stars</small></button>
        <button class="create-opt wide story-opt" data-src="story"><span class="ci">${IC.story}</span><b>Add to your story</b><small>Photo or video up to ${LIMITS.storyVideoSeconds}s · disappears after ${LIMITS.storyHours} hours</small></button>
        <button class="create-opt wide work-opt mm-opt" data-src="aimovie"><span class="ci">✨</span><b>Make an AI movie</b><small>Type an idea: Kemy writes, paints, narrates and edits it for you. Free.</small></button>
        <button class="create-opt wide work-opt" data-src="movie"><span class="ci">${WORK_IC.movie}</span><b>Movie</b><small>${WORK_DESC.movie.sub}</small></button>
        <button class="create-opt wide work-opt" data-src="song"><span class="ci">${WORK_IC.song}</span><b>Song</b><small>${WORK_DESC.song.sub}</small></button>
        <button class="create-opt wide" data-src="library"><span class="ci">${IC.library}</span><b>Upload from library</b><small>Videos up to ${fmtLimit(LIMITS.maxVideoSeconds, true)} / ${LIMITS.maxVideoMB} MB · photos up to ${LIMITS.maxImageMB} MB</small></button>
      </div>
      <div class="divider">or</div>
      <div id="text-slot"></div>
      ${inputsHtml}`;
    wireInputs(main);
    main.querySelectorAll('.create-opt').forEach((b) => {
      b.onclick = () => {
        const src = b.dataset.src;
        if (src === 'live') { location.hash = '#/live/new'; return; }
        if (src === 'movie' || src === 'song' || src === 'aimovie') { location.hash = '#/new/' + src; return; }
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
    if (sup.stream) return openCamera('snap');
    // No in-page camera: fall back to the library picker (mounted in a temporary overlay).
    mountOverlay(`<div class="cam-msg" role="alert">${IC.story}<h2>Add to your story</h2><p>Pick a photo or a video up to ${LIMITS.storyVideoSeconds} seconds.</p>
      <div class="cam-msg-btns"><button class="btn" data-a="library">Choose from library</button><button class="btn btn-ghost" data-a="close">Cancel</button></div></div>${inputsHtml}`, 'cam-camera has-msg');
    wireInputs(ov);
    ov.querySelector('[data-a=library]').onclick = () => pickFile('in-library');
    ov.querySelector('[data-a=close]').onclick = closeOverlay;
  }

  // ---------------------------------------------------------------- camera (camera-first, lenses)
  // Full-screen camera: the shutter sits bottom-centre inside a row of lens circles; swipe the row
  // to change the lens live (the shutter shows the current one). Tap = photo, hold = video. Swipe
  // the screen left/right for colour looks, tap the screen/face for lenses, double-tap to flip.
  function openCamera(mode = 'snap') {
    let facing = 'user', fx = null, picker = null, fxState = { ...FX_DEFAULT }, lensOpen = false;
    let recorder = null, chunks = [], recStart = 0, raf = 0, recording = false, holdT = 0, pressAt = 0, busy = false;
    let flash = false, timerSec = 0, grid = false;
    const BEAUTY_ORDER = ['off', 'light', 'medium', 'strong'];
    const el = mountOverlay(`
      <video class="cam-view mirror" playsinline muted autoplay aria-label="Camera preview"></video>
      <div class="cam-grid" hidden aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="cam-flash" aria-hidden="true"></div>
      <div class="cam-screenflash" aria-hidden="true"></div>
      <div class="cam-count" hidden aria-live="assertive"></div>
      <div class="cam-top">
        <button class="cam-btn" data-a="close" aria-label="Close camera">${IC.close}</button>
        <div class="cam-timer" hidden><span class="rec-dot" aria-hidden="true"></span><span class="t">0:00</span> / ${fmtTime(maxSec())}</div>
        ${isStory() ? '<span class="cam-story-chip">Story</span>' : `<a class="cam-pill" href="#/live/new" data-a="live">${ICONS.live}<span>Live</span></a><a class="cam-pill" href="#/new/menu" data-a="more">${IC.text}<span>More</span></a>`}
      </div>
      <div class="cam-rail" role="toolbar" aria-label="Camera tools">
        <button class="cam-rbtn" data-a="flip" aria-label="Switch to back camera">${IC.flip}<span>Flip</span></button>
        <button class="cam-rbtn" data-a="flash" aria-pressed="false" aria-label="Flash">${SIC.flash}<span>Flash</span></button>
        <button class="cam-rbtn" data-a="timer" aria-label="Self-timer off">${SIC.timer}<span>Off</span></button>
        <button class="cam-rbtn" data-a="grid" aria-pressed="false" aria-label="Grid">${SIC.grid}<span>Grid</span></button>
        <button class="cam-rbtn" data-a="beauty" aria-label="Smooth skin off">${SIC.beauty}<span>Beauty</span></button>
      </div>
      <div class="cam-msg" hidden role="alert"></div>
      <div class="cam-bottom">
        <div class="cam-lenses" hidden></div>
        <div class="cam-controls">
          <button class="cam-lib" data-a="library" aria-label="Upload from library">${IC.library}</button>
          <button class="cam-shutter" data-a="shutter" aria-label="Take a photo (hold to record video)">
            <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${RING_R}"/><circle class="prog" cx="50" cy="50" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
            <span class="core" aria-hidden="true"></span>
          </button>
          <button class="cam-lensbtn" data-a="lenses" aria-label="Lenses and filters" aria-expanded="false">${SIC.lens}</button>
        </div>
        <p class="cam-hint" aria-live="polite">Tap for a photo · hold for video</p>
      </div>
      ${inputsHtml}`, 'cam-camera snap');
    wireInputs(el);
    const view = el.querySelector('.cam-view'), shutter = el.querySelector('.cam-shutter'), prog = el.querySelector('.prog'), core = shutter.querySelector('.core');
    const timer = el.querySelector('.cam-timer'), tEl = timer.querySelector('.t'), msg = el.querySelector('.cam-msg');
    const hint = el.querySelector('.cam-hint'), flipBtn = el.querySelector('[data-a=flip]'), lensBox = el.querySelector('.cam-lenses');
    const R = (a) => el.querySelector(`[data-a=${a}]`);
    let stream = null;
    window.__lksCam = { get fx() { return fx; }, get state() { return fxState; }, get recording() { return recording; }, get facing() { return facing; } };

    const showView = () => { view.srcObject = fx && !fx.isFast() ? fx.stream() : stream; view.play().catch(() => {}); };
    const applyFx = (st) => { fxState = st; if (fx) { fx.set(st); showView(); } paintBeauty(); };
    function paintBeauty() {
      const b = R('beauty'); const v = fxState.beauty || 'off';
      b.classList.toggle('on', v !== 'off'); b.querySelector('span').textContent = v === 'off' ? 'Beauty' : v[0].toUpperCase() + v.slice(1);
      b.setAttribute('aria-label', `Smooth skin ${v}`);
    }
    function openLenses(tab) {
      if (recording) return;
      lensOpen = true; lensBox.hidden = false; el.classList.add('lenses-open'); R('lenses').setAttribute('aria-expanded', 'true');
      if (!picker) picker = mountPicker(lensBox, { state: fxState, tab: tab || 'funny', ring: core, onChange: applyFx });
      else { if (tab) picker.setTab(tab); picker.set(fxState); }
      hint.textContent = 'Swipe the circles · tap the screen to close';
    }
    function closeLenses() { lensOpen = false; lensBox.hidden = true; el.classList.remove('lenses-open'); R('lenses').setAttribute('aria-expanded', 'false'); hint.textContent = 'Tap for a photo · hold for video'; }

    function showMsg(title, body, actions) {
      msg.innerHTML = `${IC.camoff}<h2>${esc(title)}</h2><p>${body}</p><div class="cam-msg-btns">${actions}</div>`;
      msg.hidden = false; el.classList.add('has-msg');
      msg.querySelector('[data-a=retry]')?.addEventListener('click', start);
      msg.querySelector('[data-a=library]')?.addEventListener('click', () => pickFile('in-library'));
      msg.querySelector('[data-a=native]')?.addEventListener('click', () => pickFile('in-cap-photo'));
    }
    function stopAll() { if (fx) { fx.stop(); fx = null; } if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } }
    async function start() {
      msg.hidden = true; el.classList.remove('has-msg');
      stopAll();
      // 720p keeps a 3-minute recording around 55 MB (under the 100 MB cap).
      const video = { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
      try {
        try { stream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
        catch (e) {
          if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) throw e;
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); // no mic available
        }
        if (!ov || ov !== el) { stopAll(); return; }
        fx = createFx(stream, { onNotice: toast, onState: (st) => { fxState = st; picker && picker.set(st); paintBeauty(); showView(); } });
        fx.set(fxState);
        showView();
        view.classList.toggle('mirror', facing === 'user');
        el.classList.add('live');
        try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); flipBtn.hidden = cams.length < 2; } catch { /* keep */ }
        flipBtn.setAttribute('aria-label', facing === 'user' ? 'Switch to back camera' : 'Switch to front camera');
        if (flash && facing === 'environment') torch(true);
      } catch (e) {
        el.classList.remove('live');
        const n = e && e.name;
        if (n === 'NotAllowedError' || n === 'SecurityError') {
          showMsg('Camera access is blocked',
            'To use the camera here, allow <b>camera</b> and <b>microphone</b> for this site in your browser settings (tap the lock or “aA” icon next to the address), then try again. You can also upload a video or photo from your library.',
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
    async function torch(on) {
      const t = stream && stream.getVideoTracks()[0]; if (!t) return false;
      try { const caps = t.getCapabilities ? t.getCapabilities() : {}; if (!caps.torch) return false; await t.applyConstraints({ advanced: [{ torch: on }] }); return true; } catch { return false; }
    }
    function flip() { if (recording || busy) return; facing = facing === 'user' ? 'environment' : 'user'; start(); }

    // ---- recording (hold the shutter)
    function tick() {
      const s = (performance.now() - recStart) / 1000;
      prog.setAttribute('stroke-dashoffset', String(RING_C * (1 - Math.min(1, s / maxSec()))));
      tEl.textContent = fmtTime(s);
      if (s >= maxSec()) { stopRec(); return; }
      raf = requestAnimationFrame(tick);
    }
    function startRec() {
      if (!stream || recording) return;
      if (!cameraSupport().recorder) { toast('Video recording isn’t supported in this browser. Use your camera app, then upload.'); return; }
      const src = fx && !fx.isFast() ? fx.stream() : stream;
      fx && fx.lock(true);
      const mimeType = pickRecorderMime();
      try { recorder = new MediaRecorder(src, { mimeType, videoBitsPerSecond: LIMITS.recordBitrate, audioBitsPerSecond: 128_000 }); }
      catch { recorder = new MediaRecorder(src); }
      chunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      recorder.onstop = finishRec;
      recorder.start(250);
      recording = true; recStart = performance.now();
      el.classList.add('recording'); timer.hidden = false;
      if (flash && facing === 'user') el.classList.add('screenflash-on');
      hint.textContent = 'Release to stop';
      raf = requestAnimationFrame(tick);
    }
    function stopRec() {
      if (!recording) return;
      recording = false; cancelAnimationFrame(raf);
      el.classList.remove('recording', 'screenflash-on');
      recorder.__dur = (performance.now() - recStart) / 1000;
      try { recorder.stop(); } catch { finishRec(); }
      hint.textContent = 'Tap for a photo · hold for video';
    }
    async function finishRec() {
      fx && fx.lock(false);
      const dur = Math.min(maxSec(), recorder?.__dur || 0);
      const type = (recorder?.mimeType || pickRecorderMime() || 'video/webm').split(';')[0];
      const blob = new Blob(chunks, { type }); chunks = [];
      prog.setAttribute('stroke-dashoffset', String(RING_C)); timer.hidden = true; tEl.textContent = '0:00';
      if (dur < 1 || !blob.size) { hint.textContent = 'That was too short. Hold the button to record.'; return; }
      const file = new File([blob], `snap-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
      try {
        const info = await inspectFile(file, { duration: dur }, maxSec(), isStory());
        stopAll(); edit(file, { ...info, duration: dur });
      } catch (e) { toast(e.message); }
    }
    // ---- photo (with flash + self-timer)
    async function takePhoto() {
      if (!stream || !view.videoWidth || busy) return;
      busy = true;
      try {
        if (timerSec) {
          const cnt = el.querySelector('.cam-count'); cnt.hidden = false;
          for (let i = timerSec; i > 0; i--) { cnt.textContent = i; cnt.classList.remove('pop'); void cnt.offsetWidth; cnt.classList.add('pop'); await new Promise((r) => setTimeout(r, 1000)); if (ov !== el) return; }
          cnt.hidden = true;
        }
        if (flash) {
          if (facing === 'user') { el.classList.add('screenflash-on'); await new Promise((r) => setTimeout(r, 280)); }
          else { await torch(true); await new Promise((r) => setTimeout(r, 250)); }
        }
        const c = document.createElement('canvas');
        c.width = view.videoWidth; c.height = view.videoHeight;
        const g = c.getContext('2d');
        if (facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); }
        g.drawImage(view, 0, 0, c.width, c.height);
        el.classList.remove('screenflash-on'); if (flash && facing !== 'user' && !el.classList.contains('torch-keep')) torch(false);
        el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
        if (!blob) { toast('Couldn’t take the photo. Try again.'); return; }
        const file = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const info = await inspectFile(file, {}, maxSec(), isStory());
        stopAll(); edit(file, info);
      } catch (e) { toast(e.message || 'Couldn’t take the photo.'); }
      finally { busy = false; }
    }
    function edit(file, info) {
      openEditor({
        file, info, story: isStory(), mirror: false, esc, toast,
        lookOf: fxState.look,
        retake: () => openCamera(mode),
        close: () => { closeOverlay(); target = 'post'; },
        mount: (html, cls) => mountOverlay(html, cls),
        friends: () => (snapFriends ? snapFriends() : []),
        sendTo: (dest, outFile, outInfo, extra) => sendTo(dest, outFile, outInfo, extra)
      });
    }

    // ---- shutter: tap = photo, hold = video
    shutter.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || busy) return;
      pressAt = performance.now();
      shutter.setPointerCapture?.(e.pointerId);
      clearTimeout(holdT);
      holdT = setTimeout(() => { if (pressAt) startRec(); }, 320);
    });
    const release = () => {
      if (!pressAt) return;
      clearTimeout(holdT); pressAt = 0;
      if (recording) stopRec(); else takePhoto();
    };
    shutter.addEventListener('pointerup', release);
    shutter.addEventListener('pointercancel', () => { clearTimeout(holdT); if (recording) stopRec(); pressAt = 0; });
    shutter.addEventListener('contextmenu', (e) => e.preventDefault());
    shutter.addEventListener('click', (e) => { if (e.detail === 0) takePhoto(); }); // keyboard Enter/Space = photo
    shutter.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') { e.preventDefault(); recording ? stopRec() : startRec(); } });

    // ---- screen gestures: swipe = looks, tap = lenses, double-tap = flip camera
    let sx = 0, sy = 0, st = 0, swiped = false;
    view.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); swiped = false; });
    view.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 60 && performance.now() - st < 900 && !recording) {
        swiped = true;
        if (!picker) { picker = mountPicker(lensBox, { state: fxState, tab: 'looks', ring: core, onChange: applyFx }); lensBox.hidden = !lensOpen; }
        picker.step('look', dx < 0 ? 1 : -1);
      }
    });
    onDoubleTap(view, {
      ignore: () => swiped,
      single: () => { if (recording) return; if (lensOpen) closeLenses(); else openLenses('funny'); },
      double: () => flip()
    });
    view.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // ---- rail + buttons
    flipBtn.onclick = flip;
    R('flash').onclick = async () => {
      flash = !flash; const b = R('flash'); b.classList.toggle('on', flash); b.setAttribute('aria-pressed', flash);
      b.querySelector('span').textContent = flash ? 'On' : 'Flash';
      if (facing === 'environment') { const t = await torch(flash); if (flash && !t) toast('Flash: your screen lights up for selfies; this camera has no torch.'); }
      else if (flash) toast('Front flash: the screen lights up when you snap');
    };
    R('timer').onclick = () => {
      timerSec = timerSec === 0 ? 3 : timerSec === 3 ? 10 : 0;
      const b = R('timer'); b.classList.toggle('on', !!timerSec); b.querySelector('span').textContent = timerSec ? timerSec + 's' : 'Off';
      b.setAttribute('aria-label', timerSec ? `Self-timer ${timerSec} seconds` : 'Self-timer off');
    };
    R('grid').onclick = () => { grid = !grid; el.querySelector('.cam-grid').hidden = !grid; R('grid').classList.toggle('on', grid); R('grid').setAttribute('aria-pressed', grid); };
    R('beauty').onclick = () => {
      const next = BEAUTY_ORDER[(BEAUTY_ORDER.indexOf(fxState.beauty || 'off') + 1) % BEAUTY_ORDER.length];
      const st2 = { ...fxState, beauty: next }; applyFx(st2); picker && picker.set(st2);
      toast(next === 'off' ? 'Smooth skin off' : `Smooth skin: ${next}`);
    };
    R('lenses').onclick = () => (lensOpen ? closeLenses() : openLenses());
    R('library').onclick = () => pickFile('in-library');
    R('close').onclick = () => { if (recording) { recording = false; cancelAnimationFrame(raf); recorder.onstop = null; try { recorder.stop(); } catch { /* */ } } closeOverlay(); if (location.hash === '#/new') location.hash = '#/new/menu'; };
    el.querySelectorAll('.cam-pill').forEach((a) => a.addEventListener('click', () => closeOverlay()));
    const onKey = (e) => { if (e.key === 'Escape' && ov === el && !recording) closeOverlay(); };
    document.addEventListener('keydown', onKey);
    cleanupFns.push(() => {
      document.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); clearTimeout(holdT);
      if (recorder && recorder.state !== 'inactive') { recorder.onstop = null; try { recorder.stop(); } catch { /* */ } }
      stopAll(); window.__lksCam = null;
    });
    paintBeauty();
    start();
  }

  // ---------------------------------------------------------------- preview + post
  // "Send to" from the editor: Story / Post reuse the caption + upload screen; Friends = view-once snap.
  function sendTo(dest, file, info, extra = {}) {
    if (dest === 'story' || dest === 'post') {
      target = dest;
      inspectFile(file, info.kind === 'video' ? { duration: info.duration, width: info.width, height: info.height } : {}, dest === 'story' ? LIMITS.storyVideoSeconds : LIMITS.maxVideoSeconds, dest === 'story')
        .then((i2) => openPreview(file, { ...info, ...i2 }, 'camera'))
        .catch((e) => toast(e.message || 'That can’t be shared.'));
      return;
    }
    if (dest === 'friends') return sendSnapFlow(file, info, extra.uids || []);
  }
  async function sendSnapFlow(file, info, uids) {
    if (!uids.length) return;
    if (!uploadsReady()) { toast('Uploads are almost ready. Try again soon.'); return; }
    const el = mountOverlay(`<div class="cam-msg snap-sending" role="status"><div class="spinner"></div><h2>Sending snap…</h2><div class="pv-progress"><span></span></div><p class="small muted">To ${uids.length} ${uids.length === 1 ? 'friend' : 'friends'}</p></div>`, 'cam-camera has-msg');
    const barIn = el.querySelector('.pv-progress span');
    try {
      const r = await new Promise((resolve, reject) => {
        const fd = new FormData(); fd.append('file', file, file.name || 'snap');
        fd.append('upload_preset', CLOUDINARY.snapPreset || CLOUDINARY.uploadPreset);
        fd.append('tags', 'lks_snap'); if (S.user) fd.append('context', `uid=${S.user.uid}`);
        const x = new XMLHttpRequest(); x.open('POST', uploadEndpoint());
        x.upload.onprogress = (e) => { if (e.lengthComputable) barIn.style.transform = `scaleX(${e.loaded / e.total})`; };
        x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch { /* */ } (x.status < 300 && j && j.secure_url) ? resolve(j) : reject(new Error((j && j.error && j.error.message) || 'Upload failed')); };
        x.onerror = () => reject(new Error('Network problem. Check your connection and try again.'));
        x.send(fd);
      });
      const d = deliveryUrls(r);
      const n = await sendSnap(uids, { url: d.mediaUrl, kind: d.mediaType, poster: d.mediaType === 'video' ? d.posterUrl : '' });
      closeOverlay(); target = 'post';
      toast(`Snap sent to ${n} ${n === 1 ? 'friend' : 'friends'}`);
      location.hash = uids.length === 1 ? '#/chat/' + uids[0] : '#/messages';
    } catch (e) {
      closeOverlay();
      toast(e && e.code === 'permission-denied' ? 'Couldn’t send to everyone. They may not accept messages.' : (e.message || 'Couldn’t send the snap.'));
    }
  }

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
        dispatchEvent(new CustomEvent('kemy:xp', { detail: { n: 30 } }));
        toast(isVideo && file.size > LIMITS.eagerOnlyMB * 1048576 ? 'Posted! Long videos can take a few minutes to finish processing.' : 'Posted!');
        location.hash = '#/watch/' + id;
      } catch (e) {
        busy = false; postBtn.disabled = false; postBtn.textContent = 'Try again';
        status.textContent = uploaded ? 'Upload finished; the post wasn’t saved yet.' : '';
        if (!uploaded) { bar.hidden = true; barIn.style.transform = 'scaleX(0)'; }
        err.textContent = e && e.code === 'permission-denied' ? 'You can post once every 20 seconds. Wait a moment and tap Try again.' : (e && e.userMessage) || friendlyError(e);
      }
    };

    // Uploads straight to Cloudinary. Big files go in ~20 MB chunks (X-Unique-Upload-Id +
    // Content-Range), each retried up to 3 times, so a long video survives a shaky connection.
    function upload(f, onProgress) {
      const CH = LIMITS.chunkMB * 1048576;
      const fields = (fd) => {
        fd.append('upload_preset', story ? CLOUDINARY.storyPreset : CLOUDINARY.uploadPreset);
        fd.append('tags', story ? 'lks_story' : 'lks_user');
        if (S.user) fd.append('context', `uid=${S.user.uid}`);
      };
      const failMsg = (m, status) => /format|allowed/i.test(m) ? 'That file type isn’t allowed. Use MP4, MOV, WebM, JPG, PNG, HEIC or WebP.'
        : /size|too large/i.test(m) || status === 413 ? 'That file is too big to upload. Try exporting it at 720p.'
        : /preset/i.test(m) ? 'Uploads aren’t set up correctly yet. Please try again later.'
        : 'The upload didn’t go through. Check your connection and try again.';
      // One request; resolves with the parsed JSON (or rejects with a retryable flag).
      const send = (blob, headers, onBytes) => new Promise((resolve, reject) => {
        const fd = new FormData(); fd.append('file', blob, f.name || 'upload'); fields(fd);
        xhr = new XMLHttpRequest();
        xhr.open('POST', uploadEndpoint());
        Object.entries(headers || {}).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) onBytes(Math.min(blob.size, e.loaded * (blob.size / e.total))); };
        xhr.onload = () => {
          const st = xhr.status; let j = null; try { j = JSON.parse(xhr.responseText); } catch { /* */ }
          xhr = null;
          if (st >= 200 && st < 300 && j) return resolve(j);
          const m = (j && j.error && j.error.message) || '';
          const er = new Error(m || 'Upload failed.'); er.userMessage = failMsg(m, st);
          er.retry = st >= 500 || st === 0 || st === 408 || st === 429;
          reject(er);
        };
        xhr.onerror = () => { xhr = null; const er = new Error('Network error'); er.userMessage = 'Network problem during upload. Check your connection and try again.'; er.retry = true; reject(er); };
        xhr.onabort = () => { xhr = null; const er = new Error('aborted'); er.userMessage = 'Upload cancelled.'; er.aborted = true; reject(er); };
        xhr.send(fd);
      });
      const withRetry = async (fn, label) => {
        for (let attempt = 1; ; attempt++) {
          try { return await fn(); }
          catch (e) {
            if (e.aborted || !e.retry || attempt >= 3) throw e;
            status.textContent = `Connection hiccup${label ? ' on ' + label : ''}, retrying (${attempt}/2)…`;
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
      };
      const done = (j) => {
        if (j && j.public_id && j.secure_url) return j;
        const er = new Error('Upload failed.'); er.userMessage = 'The upload didn’t finish. Please try again.'; throw er;
      };
      if (f.size <= CH) return withRetry(() => send(f, null, (b) => onProgress(b / f.size))).then(done);
      return (async () => {
        const id = 'lks-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
        const total = f.size; const parts = Math.ceil(total / CH);
        let last = null;
        for (let i = 0; i < parts; i++) {
          const start = i * CH, end = Math.min(total, start + CH);
          const blob = f.slice(start, end, f.type);
          last = await withRetry(() => send(blob, { 'X-Unique-Upload-Id': id, 'Content-Range': `bytes ${start}-${end - 1}/${total}` },
            (b) => onProgress((start + b) / total)), `part ${i + 1} of ${parts}`);
          onProgress(end / total);
        }
        return done(last);
      })();
    }
  }

  return { render, close: closeOverlay, deliveryUrls, openStory };
}
