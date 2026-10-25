// Rich comments: emoji picker (search, categories, recents, skin tones), GIFs (GIPHY, key from
// media-config; hidden until set), photo comments (Cloudinary lks_comment_media) and animated
// Pal stickers drawn with the Pals renderer (js/pals/art.js, owned by the Pals module).
// A comment is text, one media item, or text + one media item:
//   media = { kind: 'gif', id, url, w, h } | { kind: 'photo', url, w, h } | { kind: 'sticker', petId, pose }
import { CLOUDINARY, GIFS, uploadEndpoint, deliveryBase } from './media-config.js';
import { drawPal, heart, star } from './pals/art.js';
import { guardUpload } from './mediascan.js';
import { doc, getDoc, getDocs, collection } from './fsq.js';

export const POSES = [['wave', 'Wave', '👋'], ['love', 'Love', '😍'], ['laugh', 'Laugh', '😂'], ['cry', 'Cry', '😢'], ['wow', 'Wow', '😮'], ['dance', 'Dance', '💃'], ['sleepy', 'Sleepy', '😴']];
const POSE_IDS = POSES.map((p) => p[0]);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const gifsEnabled = () => !!(GIFS && GIFS.key);

// ---------------------------------------------------------------- sheet helper
function sheet(title, cls) {
  const bg = document.createElement('div'); bg.className = 'rc-sheet-bg';
  bg.innerHTML = `<div class="rc-sheet ${cls}" role="dialog" aria-label="${esc(title)}"><div class="rc-sheet-h"><b>${esc(title)}</b><button type="button" class="icon-btn" data-x aria-label="Close">✕</button></div><div class="rc-sheet-b"></div></div>`;
  document.body.appendChild(bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('[data-x]')) close(); });
  return { el: bg.querySelector('.rc-sheet-b'), close, root: bg };
}

// ---------------------------------------------------------------- emoji
let EMOJI = null;
const loadEmoji = () => EMOJI || (EMOJI = fetch(new URL('./emoji-data.json', import.meta.url)).then((r) => r.json()));
const TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];
const CAT_IC = { recent: '🕘', smileys: '😀', people: '👋', nature: '🐻', food: '🍔', travel: '🚗', activities: '⚽', objects: '💡', symbols: '❤️', flags: '🏳️' };
const withTone = (e, t) => { if (!t) return e; const cps = [...e.replace(/\uFE0F/g, '')]; return cps[0] + t + cps.slice(1).join(''); };
const recents = () => { try { return JSON.parse(localStorage.getItem('kemy-emoji-recent') || '[]'); } catch { return []; } };
const pushRecent = (e) => { const r = [e, ...recents().filter((x) => x !== e)].slice(0, 32); try { localStorage.setItem('kemy-emoji-recent', JSON.stringify(r)); } catch { /* */ } };
export async function emojiPicker(onPick) {
  const s = sheet('Emoji', 'rc-emoji');
  s.el.innerHTML = '<div class="rc-loading"><div class="spinner"></div></div>';
  const data = await loadEmoji();
  let tone = Number(localStorage.getItem('kemy-emoji-tone') || 0), cat = recents().length ? 'recent' : 'smileys';
  s.el.innerHTML = `<div class="rc-ebar"><input type="search" class="rc-esearch" placeholder="Search emoji" aria-label="Search emoji" autocomplete="off">
      <div class="rc-tones" role="radiogroup" aria-label="Skin tone">${TONES.map((t, i) => `<button type="button" role="radio" data-tone="${i}" aria-label="Skin tone ${i || 'default'}" aria-checked="${i === tone}">${withTone('👋', t)}</button>`).join('')}</div></div>
    <div class="rc-ecats" role="tablist">${['recent', ...data.map((g) => g.id)].map((c) => `<button type="button" role="tab" data-cat="${c}" aria-label="${c}">${CAT_IC[c]}</button>`).join('')}</div>
    <div class="rc-egrid" aria-live="polite"></div>`;
  const grid = s.el.querySelector('.rc-egrid'), q = s.el.querySelector('.rc-esearch');
  const btn = (e) => `<button type="button" class="rc-e" data-e="${esc(withTone(e[0], e[2] ? TONES[tone] : ''))}" title="${esc(e[1])}">${withTone(e[0], e[2] ? TONES[tone] : '')}</button>`;
  const paint = () => {
    const term = q.value.trim().toLowerCase();
    s.el.querySelectorAll('[data-cat]').forEach((b) => b.setAttribute('aria-selected', !term && b.dataset.cat === cat));
    s.el.querySelectorAll('[data-tone]').forEach((b) => b.setAttribute('aria-checked', Number(b.dataset.tone) === tone));
    if (term) { const hits = []; for (const g of data) for (const e of g.e) if (e[1].includes(term)) hits.push(e); grid.innerHTML = hits.length ? hits.slice(0, 240).map(btn).join('') : '<p class="muted small">No emoji found.</p>'; return; }
    if (cat === 'recent') { const r = recents(); grid.innerHTML = r.length ? r.map((e) => `<button type="button" class="rc-e" data-e="${esc(e)}">${e}</button>`).join('') : '<p class="muted small">Emoji you use show up here.</p>'; return; }
    grid.innerHTML = data.find((g) => g.id === cat).e.map(btn).join('');
  };
  s.el.onclick = (e) => {
    const c = e.target.closest('[data-cat]'), t = e.target.closest('[data-tone]'), em = e.target.closest('[data-e]');
    if (c) { cat = c.dataset.cat; q.value = ''; paint(); grid.scrollTop = 0; }
    if (t) { tone = Number(t.dataset.tone); localStorage.setItem('kemy-emoji-tone', tone); paint(); }
    if (em) { pushRecent(em.dataset.e); onPick(em.dataset.e); }
  };
  q.oninput = paint; paint(); if (matchMedia('(pointer:fine)').matches) q.focus();
  return s;
}
export function insertAtCursor(input, text) {
  const a = input.selectionStart ?? input.value.length, b = input.selectionEnd ?? a;
  const max = Number(input.maxLength) > 0 ? Number(input.maxLength) : 1e9;
  if (input.value.length - (b - a) + text.length > max) return;
  input.value = input.value.slice(0, a) + text + input.value.slice(b);
  input.setSelectionRange(a + text.length, a + text.length); input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---------------------------------------------------------------- GIFs (GIPHY)
export const GIF_URL_RE = /^https:\/\/(media[0-9]?|i)\.giphy\.com\/[\w./-]+$/;
async function giphy(path, params) {
  const u = new URL(`https://api.giphy.com/v1/gifs/${path}`);
  Object.entries({ api_key: GIFS.key, rating: GIFS.rating || 'pg', limit: 24, bundle: 'messaging_non_clips', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u); if (!r.ok) throw new Error(r.status === 429 ? 'GIF search is busy. Try again in a minute.' : 'GIFs are unavailable right now.');
  return (await r.json()).data.map((g) => { const im = g.images.fixed_height || g.images.downsized; return { id: g.id, url: (im.webp || im.url).split('?')[0], still: (g.images.fixed_height_still?.url || '').split('?')[0], w: Number(im.width) || 200, h: Number(im.height) || 200, title: g.title || 'GIF' }; }).filter((g) => GIF_URL_RE.test(g.url));
}
export function gifPicker(onPick) {
  const s = sheet('GIFs', 'rc-gif');
  s.el.innerHTML = `<input type="search" class="rc-gsearch" placeholder="Search GIPHY" aria-label="Search GIFs" autocomplete="off"><div class="rc-ggrid"><div class="spinner"></div></div><p class="rc-attrib">Powered by <b>GIPHY</b></p>`;
  const grid = s.el.querySelector('.rc-ggrid'), q = s.el.querySelector('.rc-gsearch'); let t = 0, list = [];
  const load = async () => {
    grid.innerHTML = '<div class="spinner"></div>';
    try { list = q.value.trim() ? await giphy('search', { q: q.value.trim().slice(0, 50) }) : await giphy('trending', {}); grid.innerHTML = list.length ? list.map((g, i) => `<button type="button" class="rc-g" data-i="${i}" aria-label="${esc(g.title)}"><img src="${esc(g.url)}" alt="" loading="lazy"></button>`).join('') : '<p class="muted small">No GIFs found.</p>'; }
    catch (e) { grid.innerHTML = `<p class="muted small">${esc(e.message)}</p>`; }
  };
  q.oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
  grid.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { const g = list[Number(b.dataset.i)]; onPick({ kind: 'gif', id: g.id, url: g.url, w: g.w, h: g.h }); s.close(); } };
  load(); return s;
}

// ---------------------------------------------------------------- photos
export async function shrinkImage(file, max = 1600) {
  if (file.type === 'image/gif') return { blob: file, w: 0, h: 0 };
  const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86)); return { blob, w: c.width, h: c.height };
}
export function uploadCommentPhoto(file, uid, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type)) throw new Error('Use a JPG, PNG, WebP or GIF photo.');
      if (file.size > 15 * 1048576) throw new Error('Photos can be up to 15 MB.');
      await guardUpload(file, { where: 'comment' });
      const { blob, w, h } = await shrinkImage(file);
      if (blob.size > 10 * 1048576) throw new Error('That photo is too big (10 MB max).');
      const fd = new FormData(); fd.append('file', blob, 'comment.jpg'); fd.append('upload_preset', CLOUDINARY.commentPreset || 'lks_comment_media'); fd.append('tags', 'lks_comment'); if (uid) fd.append('context', `uid=${uid}`);
      const x = new XMLHttpRequest(); x.open('POST', uploadEndpoint());
      x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(e.loaded / e.total);
      x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch { /* */ } if (x.status < 300 && j && j.public_id) resolve({ kind: 'photo', url: `${deliveryBase()}image/upload/c_limit,h_1200,w_1200/f_auto,q_auto/v${j.version}/${j.public_id}`, w: j.width || w, h: j.height || h }); else reject(new Error((j && j.error && j.error.message) || 'Upload failed. Try again.')); };
      x.onerror = () => reject(new Error('Network problem during upload.'));
      x.send(fd);
    } catch (e) { reject(e); }
  });
}

// ---------------------------------------------------------------- Pal stickers
const petCache = new Map();
export function getPet(db, uid, petId) {
  const k = uid + '/' + petId; if (!petCache.has(k)) petCache.set(k, getDoc(doc(db, 'users', uid, 'pets', petId)).then((s) => (s.exists() ? { id: petId, ...s.data() } : null)).catch(() => null));
  return petCache.get(k);
}
export function drawSticker(c, pal, pose, t) {
  const W = c.canvas.width, H = c.canvas.height, s = Math.min(W, H) * 0.62, cx = W / 2, cy = H * 0.56;
  c.clearRect(0, 0, W, H);
  const mode = { wave: 'idle', love: 'happy', laugh: 'happy', cry: 'shake', wow: 'hop', dance: 'happy', sleepy: 'sleep' }[pose] || 'idle';
  c.save();
  if (pose === 'dance') { c.translate(Math.sin(t * 0.15) * W * 0.08, 0); c.translate(cx, cy); c.rotate(Math.sin(t * 0.15) * 0.18); c.translate(-cx, -cy); }
  drawPal(c, cx, cy, s, pal, { t: t * 1.6, mode, face: 1, mood: pose === 'cry' ? { sad: true } : pose === 'sleepy' ? {} : {} });
  c.restore();
  const k = W / 120;
  c.save(); c.lineCap = 'round';
  if (pose === 'wave') { c.font = `${28 * k}px system-ui, "Apple Color Emoji","Segoe UI Emoji"`; c.save(); c.translate(W * 0.8, H * 0.38); c.rotate(Math.sin(t * 0.3) * 0.5); c.fillText('👋', -14 * k, 10 * k); c.restore(); }
  if (pose === 'love') for (let i = 0; i < 3; i++) { const p = ((t * 0.02 + i / 3) % 1); c.globalAlpha = 1 - p; c.fillStyle = '#ff5c9d'; heart(c, W * (0.25 + i * 0.25), H * (0.35 - p * 0.3), 7 * k); c.fill(); }
  if (pose === 'laugh') { c.fillStyle = '#ffd166'; c.font = `800 ${16 * k}px Inter, system-ui`; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 0.4); c.fillText('HA', W * 0.72, H * 0.24 + Math.sin(t * 0.4) * 3 * k); c.fillText('HA', W * 0.1, H * 0.3 + Math.cos(t * 0.4) * 3 * k); }
  if (pose === 'cry') for (let i = 0; i < 2; i++) { const p = ((t * 0.04 + i * 0.5) % 1); c.globalAlpha = 1 - p * 0.8; c.fillStyle = '#6ec1ff'; c.beginPath(); const x = cx + (i ? 0.16 : -0.16) * s, y = cy - 0.08 * s + p * 0.4 * s; c.arc(x, y, 3.2 * k, 0, 7); c.fill(); }
  if (pose === 'wow') { c.fillStyle = '#ffd166'; for (let i = 0; i < 4; i++) { const a = t * 0.05 + i * Math.PI / 2; star(c, cx + Math.cos(a) * W * 0.4, H * 0.45 + Math.sin(a) * H * 0.32, 5 * k * (0.7 + 0.3 * Math.sin(t * 0.3 + i))); c.fill(); } c.font = `900 ${22 * k}px Inter, system-ui`; c.fillText('!', W * 0.78, H * 0.26); }
  if (pose === 'dance') { c.fillStyle = '#c9a8ff'; c.font = `${16 * k}px system-ui`; c.globalAlpha = 0.9; c.fillText('♪', W * 0.12, H * 0.3 + Math.sin(t * 0.2) * 6 * k); c.fillText('♫', W * 0.78, H * 0.26 + Math.cos(t * 0.2) * 6 * k); }
  if (pose === 'sleepy') { c.fillStyle = '#e4d6ff'; c.font = `800 ${12 * k}px Inter, system-ui`; for (let i = 0; i < 3; i++) { const p = ((t * 0.012 + i / 3) % 1); c.globalAlpha = 1 - p; c.fillText('z', W * (0.66 + p * 0.2), H * (0.34 - p * 0.24)); } }
  c.restore();
}
// Animate every sticker canvas in `root` while it's on screen (one shared rAF loop).
const live = new Set(); let raf = 0;
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => es.forEach((e) => { e.target.__vis = e.isIntersecting; }), { rootMargin: '100px' }) : null;
function loop() { raf = 0; let any = false; for (const cv of live) { if (!cv.isConnected) { live.delete(cv); io && io.unobserve(cv); continue; } any = true; if (cv.__vis === false || !cv.__pal) continue; cv.__t = (cv.__t || 0) + 1; drawSticker(cv.getContext('2d'), cv.__pal, cv.dataset.pose, cv.__t); } if (any) raf = requestAnimationFrame(loop); }
export function animateSticker(cv, pal) { cv.__pal = pal; live.add(cv); io && io.observe(cv); if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawSticker(cv.getContext('2d'), pal, cv.dataset.pose, 20); live.delete(cv); return; } if (!raf) raf = requestAnimationFrame(loop); }
export function hydrateStickers(root, db) {
  root.querySelectorAll('canvas.rc-sticker:not([data-ready])').forEach(async (cv) => { cv.dataset.ready = '1'; const pal = await getPet(db, cv.dataset.uid, cv.dataset.pet); if (pal) animateSticker(cv, pal); else cv.replaceWith(Object.assign(document.createElement('span'), { className: 'muted small', textContent: 'Pal sticker' })); });
}
export async function stickerPicker(db, uid, onPick) {
  const s = sheet('Pal stickers', 'rc-stick');
  s.el.innerHTML = '<div class="spinner"></div>';
  const pals = (await getDocs(collection(db, 'users', uid, 'pets')).catch(() => ({ docs: [] }))).docs.map((d) => ({ id: d.id, ...d.data() }));
  if (!pals.length) { s.el.innerHTML = '<p class="muted">Hatch a Kemy Pal first, then send animated stickers of it. <a href="#/pals">Meet your Pal</a></p>'; return s; }
  let cur = pals[0];
  const paint = () => {
    s.el.innerHTML = `${pals.length > 1 ? `<div class="rc-pals">${pals.map((p) => `<button type="button" class="chip ${p.id === cur.id ? 'on' : ''}" data-pal="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : ''}
      <div class="rc-sgrid">${POSES.map(([id, label]) => `<button type="button" class="rc-s" data-pose="${id}" aria-label="${esc(cur.name)}: ${label}"><canvas class="rc-sticker" width="120" height="120" data-pose="${id}"></canvas><small>${label}</small></button>`).join('')}</div>`;
    s.el.querySelectorAll('canvas.rc-sticker').forEach((cv) => animateSticker(cv, cur));
  };
  s.el.onclick = (e) => { const p = e.target.closest('[data-pal]'), b = e.target.closest('button[data-pose]'); if (p) { cur = pals.find((x) => x.id === p.dataset.pal); paint(); } else if (b) { onPick({ kind: 'sticker', petId: cur.id, pose: b.dataset.pose }); s.close(); } };
  paint(); return s;
}

// ---------------------------------------------------------------- rendering a comment's media
export function mediaHtml(c) {
  const m = c && c.media; if (!m) return '';
  if (m.kind === 'gif' && GIF_URL_RE.test(m.url)) return `<div class="rc-media rc-m-gif"><img src="${esc(m.url)}" alt="GIF" loading="lazy" width="${Number(m.w) || 200}" height="${Number(m.h) || 200}"><span class="rc-gif-tag">GIPHY</span></div>`;
  if (m.kind === 'photo' && /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\//.test(m.url)) return `<a class="rc-media rc-m-photo" href="${esc(m.url)}" target="_blank" rel="noopener"><img src="${esc(m.url)}" alt="Photo comment" loading="lazy" ${m.w ? `width="${Number(m.w)}" height="${Number(m.h)}"` : ''}></a>`;
  if (m.kind === 'sticker' && POSE_IDS.includes(m.pose)) return `<div class="rc-media rc-m-sticker"><canvas class="rc-sticker" width="120" height="120" data-uid="${esc(c.authorId)}" data-pet="${esc(m.petId)}" data-pose="${esc(m.pose)}" aria-label="Pal sticker: ${esc(m.pose)}"></canvas></div>`;
  return '';
}

// ---------------------------------------------------------------- composer toolbar for a comment form
export function attachComposer({ form, input, S, db, toast, allowMedia = true }) {
  if (!form || form.__rc) return form && form.__rc;
  const bar = document.createElement('div'); bar.className = 'rc-bar';
  bar.innerHTML = `<button type="button" class="rc-btn" data-r="emoji" aria-label="Emoji">😊</button>
    ${allowMedia && gifsEnabled() ? '<button type="button" class="rc-btn rc-gifbtn" data-r="gif" aria-label="GIF">GIF</button>' : ''}
    ${allowMedia ? '<label class="rc-btn" aria-label="Photo">📷<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic" data-r="photo" hidden></label><button type="button" class="rc-btn" data-r="sticker" aria-label="Pal sticker">🐾</button>' : ''}
    <div class="rc-att" hidden></div>`;
  form.parentNode.insertBefore(bar, form.nextSibling);
  const att = bar.querySelector('.rc-att');
  let media = null, uploading = null;
  const paintAtt = () => {
    att.hidden = !media && !uploading;
    if (uploading) { att.innerHTML = `<span class="rc-up"><span class="spinner sm"></span> Uploading photo… <span class="rc-pct"></span></span>`; return; }
    if (!media) { att.innerHTML = ''; return; }
    const prev = media.kind === 'sticker' ? `<canvas class="rc-sticker" width="80" height="80" data-pose="${media.pose}"></canvas>` : `<img src="${esc(media.url)}" alt="">`;
    att.innerHTML = `<span class="rc-prev">${prev}<button type="button" class="rc-rm" aria-label="Remove attachment">✕</button></span>${media.kind === 'gif' ? '<small class="rc-attrib">Powered by GIPHY</small>' : ''}`;
    if (media.kind === 'sticker') getPet(db, S.user.uid, media.petId).then((p) => { const cv = att.querySelector('canvas'); if (p && cv) animateSticker(cv, p); });
    att.querySelector('.rc-rm').onclick = () => { media = null; paintAtt(); };
  };
  const need = () => { if (!S.user) { location.hash = '#/login?next=' + encodeURIComponent(location.hash); return false; } return true; };
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (!b || b.tagName === 'INPUT') return;
    const r = b.dataset.r;
    if (r === 'emoji') emojiPicker((em) => insertAtCursor(input, em));
    if (r === 'gif' && need()) gifPicker((g) => { media = g; paintAtt(); });
    if (r === 'sticker' && need()) stickerPicker(db, S.user.uid, (st) => { media = st; paintAtt(); });
  });
  const fileIn = bar.querySelector('input[data-r=photo]');
  if (fileIn) fileIn.onchange = async () => {
    const f = fileIn.files[0]; fileIn.value = ''; if (!f || !need()) return;
    uploading = true; media = null; paintAtt();
    try { media = await (uploading = uploadCommentPhoto(f, S.user.uid, (p) => { const el = att.querySelector('.rc-pct'); if (el) el.textContent = Math.round(p * 100) + '%'; })); }
    catch (er) { toast && toast(er.message); }
    uploading = null; paintAtt();
  };
  const api = {
    get media() { return media; },
    get busy() { return !!uploading; },
    clear() { media = null; paintAtt(); },
    bar
  };
  form.__rc = api; return api;
}
