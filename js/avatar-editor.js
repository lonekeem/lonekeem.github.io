// Lone Keem Studios - profile picture editor: take a photo or pick one from the library,
// square crop with drag + pinch/slider zoom, resize to a 512px JPEG in the browser, then upload
// to Cloudinary with the unsigned avatar preset (folder lks/avatars). Until the real cloud name
// is set (js/media-config.js) the editor works but Save shows the "Uploads are almost ready" notice.
import { CLOUDINARY, LIMITS, uploadsReady, uploadEndpoint, avatarUrl } from './media-config.js';
import { notReadyNotice } from './create.js';
import { guardUpload } from './mediascan.js';

const IC = {
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.6L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M20 20l-4-4"/></svg>'
};
const MAX_INPUT_MB = 20;
const MAX_ZOOM = 4;

export function createAvatarEditor({ esc, toast, friendlyError, getUid, onSaved, onRemoved, hasPhoto }) {
  let ov = null;
  const close = () => { if (ov) { ov._cleanup?.(); ov.remove(); ov = null; document.body.classList.remove('cam-open'); } };
  const mount = (cls, html) => {
    close();
    ov = document.createElement('div');
    ov.className = 'av-ov ' + cls; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = html; document.body.appendChild(ov); document.body.classList.add('cam-open');
    return ov;
  };
  const inputs = `
    <input type="file" id="av-cam" accept="image/*" capture="user" hidden>
    <input type="file" id="av-lib" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*" hidden>`;

  // Step 1: chooser sheet
  function open() {
    const el = mount('av-sheet-ov', `
      <div class="av-sheet" role="document" aria-labelledby="av-title">
        <h2 id="av-title">Profile photo</h2>
        <button class="av-act" data-a="cam">${IC.camera}<span>Take photo</span></button>
        <button class="av-act" data-a="lib">${IC.library}<span>Choose from library</span></button>
        ${hasPhoto() ? `<button class="av-act danger" data-a="rm">${IC.trash}<span>Remove current photo</span></button>` : ''}
        <button class="btn btn-ghost btn-block" data-a="cancel">Cancel</button>
        ${inputs}
      </div>`);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    el.querySelector('[data-a=cancel]').onclick = close;
    el.querySelector('[data-a=cam]').onclick = () => el.querySelector('#av-cam').click();
    el.querySelector('[data-a=lib]').onclick = () => el.querySelector('#av-lib').click();
    const rm = el.querySelector('[data-a=rm]');
    if (rm) rm.onclick = async () => {
      if (!confirm('Remove your profile photo? Your initials will show instead.')) return;
      rm.disabled = true;
      try { await onRemoved(); close(); toast('Profile photo removed'); } catch (e) { rm.disabled = false; toast(friendlyError(e)); }
    };
    ['#av-cam', '#av-lib'].forEach((id) => {
      const inp = el.querySelector(id);
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) loadFile(f); };
    });
  }

  async function loadFile(file) {
    if (!/^image\//.test(file.type || '') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '')) return toast('Please choose a photo (JPG, PNG, WebP or HEIC).');
    if (file.size > MAX_INPUT_MB * 1048576) return toast(`That photo is too big. Choose one under ${MAX_INPUT_MB} MB.`);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => openCrop(img, url);
    img.onerror = () => { URL.revokeObjectURL(url); toast('That photo can’t be opened here. Try a JPG or PNG.'); };
    img.src = url;
  }

  // Step 2: crop + zoom
  function openCrop(img, url) {
    const ready = uploadsReady();
    const el = mount('av-crop-ov', `
      <div class="av-crop">
        <div class="av-head"><button class="cam-btn pill" data-a="back">Cancel</button><b>Move and zoom</b><span style="width:64px"></span></div>
        <div class="av-stage" tabindex="0" aria-label="Drag to move the photo. Use the slider or pinch to zoom.">
          <img class="av-img" src="${esc(url)}" alt="" draggable="false">
          <div class="av-mask" aria-hidden="true"></div>
        </div>
        <div class="av-zoom">${IC.minus}<input type="range" id="av-z" min="1" max="${MAX_ZOOM}" step="0.01" value="1" aria-label="Zoom">${IC.plus}</div>
        ${ready ? '' : notReadyNotice(true)}
        <p class="form-error" id="av-err"></p>
        <div class="av-actions">
          <button class="btn btn-ghost" data-a="cancel">Cancel</button>
          <button class="btn" id="av-save" ${ready ? '' : 'disabled aria-disabled="true"'}>${ready ? 'Save photo' : 'Save · almost ready'}</button>
        </div>
      </div>`);
    const stage = el.querySelector('.av-stage'), im = el.querySelector('.av-img'), zIn = el.querySelector('#av-z');
    const W = img.naturalWidth, H = img.naturalHeight;
    let size = stage.clientWidth || 300;
    let zoom = 1, x = 0, y = 0; // image offset (px, stage coords) of the scaled image's top-left
    const base = () => size / Math.min(W, H); // scale at zoom 1 (image covers the square)
    const clamp = () => {
      const s = base() * zoom, w = W * s, h = H * s;
      x = Math.min(0, Math.max(size - w, x)); y = Math.min(0, Math.max(size - h, y));
    };
    const paint = () => { clamp(); const s = base() * zoom; im.style.width = W * s + 'px'; im.style.height = H * s + 'px'; im.style.transform = `translate(${x}px, ${y}px)`; };
    const center = () => { const s = base(); x = (size - W * s) / 2; y = (size - H * s) / 2; };
    const setZoom = (z, cx = size / 2, cy = size / 2) => {
      z = Math.max(1, Math.min(MAX_ZOOM, z));
      const k = z / zoom; x = cx - (cx - x) * k; y = cy - (cy - y) * k; zoom = z; zIn.value = String(z); paint();
    };
    center(); paint();
    const onResize = () => { const old = size; size = stage.clientWidth || size; const k = size / old; x *= k; y *= k; paint(); };
    window.addEventListener('resize', onResize);
    // drag + pinch
    const pts = new Map(); let pinch0 = null;
    stage.addEventListener('pointerdown', (e) => { stage.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom }; } });
    stage.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && pinch0) {
        const [a, b] = [...pts.values()]; const r = stage.getBoundingClientRect();
        setZoom(pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / (pinch0.d || 1), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      } else if (pts.size === 1) { x += dx; y += dy; paint(); }
    });
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    stage.addEventListener('wheel', (e) => { e.preventDefault(); const r = stage.getBoundingClientRect(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    stage.addEventListener('keydown', (e) => {
      const m = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
      if (m) { e.preventDefault(); x += m[0]; y += m[1]; paint(); }
      if (e.key === '+' || e.key === '=') setZoom(zoom * 1.1);
      if (e.key === '-') setZoom(zoom / 1.1);
    });
    zIn.oninput = () => setZoom(Number(zIn.value));

    // 512px square JPEG of exactly what's inside the frame.
    const toBlob = () => new Promise((resolve, reject) => {
      const s = base() * zoom, out = LIMITS.avatarSize;
      const c = document.createElement('canvas'); c.width = out; c.height = out;
      const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, out, out);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, -x / s, -y / s, size / s, size / s, 0, 0, out, out);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Couldn’t prepare the photo.'))), 'image/jpeg', 0.88);
    });
    el.__avatarCrop = { toBlob, state: () => ({ zoom, x, y, size, W, H }) }; // used by tests

    const back = () => { close(); open(); };
    el.querySelector('[data-a=back]').onclick = back;
    el.querySelector('[data-a=cancel]').onclick = close;
    el._cleanup = () => { window.removeEventListener('resize', onResize); URL.revokeObjectURL(url); };
    const save = el.querySelector('#av-save'), err = el.querySelector('#av-err');
    save.onclick = async () => {
      if (!uploadsReady()) { err.textContent = 'Uploads are almost ready. Please check back very soon.'; return; }
      save.disabled = true; save.textContent = 'Saving…'; err.textContent = '';
      try {
        const blob = await toBlob();
        const r = await upload(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        await onSaved(avatarUrl(r));
        close(); toast('Profile photo updated');
      } catch (e) { save.disabled = false; save.textContent = 'Try again'; err.textContent = e.userMessage || friendlyError(e); }
    };
  }

  async function upload(file) {
    await guardUpload(file, { where: 'avatar' });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', CLOUDINARY.avatarPreset);
    fd.append('tags', 'lks_avatar');
    const uid = getUid(); if (uid) fd.append('context', `uid=${uid}`);
    let res, j = null;
    try { res = await fetch(uploadEndpoint(), { method: 'POST', body: fd }); j = await res.json().catch(() => null); }
    catch { const e = new Error('Network error'); e.userMessage = 'Network problem during upload. Check your connection and try again.'; throw e; }
    if (j && j.public_id && j.secure_url) return j;
    const e = new Error((j && j.error && j.error.message) || 'Upload failed');
    e.userMessage = /preset/i.test(e.message) ? 'Uploads aren’t set up correctly yet. Please try again later.' : 'The upload didn’t go through. Please try again.';
    throw e;
  }

  return { open, close, loadFile };
}
