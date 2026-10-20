// Kemy picture & video check (on-device, free). Before anything is uploaded we look at it with the
// open-source NSFW model from nsfwjs (MIT, Infinite Red; model self-hosted in assets/nsfw/) running
// in TensorFlow.js (Apache-2.0, jsDelivr). Loaded lazily, only when someone uploads.
//   * pictures: 1 look; videos: 8-16 frames spread across the clip (video -> canvas)
//   * clearly grown-up  -> blocked with a kind message + an auto-review item for the moderators
//   * borderline        -> post is held for a moderator (existing heldPosts flow); on places that
//                          can't be held (profile photo, story, snap, covers, comments) it's blocked
//   * captions / titles / hashtags go through the kind-words filter
//   * videos from new accounts (< 3 days) or with fewer than N live posts wait for review
// A determined person can skip a check that runs on their own phone, so reports + review stay on.
// Written by Lone Keem
import { doc, getDoc, setDoc, collection, query, where, getCountFromServer, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { badWord, sneakyWord } from './kindguard.js';

const TF_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const MODEL_URL = new URL('../assets/nsfw/model.json', import.meta.url).href;
const CLASSES = ['Drawing', 'Hentai', 'Neutral', 'Porn', 'Sexy'];
export const LIMITS = { blockPorn: 0.8, blockHentai: 0.8, blockSexy: 0.92, reviewPorn: 0.35, reviewHentai: 0.35, reviewSexy: 0.6, reviewSum: 0.7 };
export const BLOCK_MSG = (kind) => `This ${kind === 'video' ? 'video' : 'picture'} can't be posted on Kemy because it may break our rules 💜`;
export const REVIEW_MSG = 'Your post is being reviewed 🕒';
export const NEW_ACCOUNT_DAYS = 3;

let C = null; // { S, db, isAdmin }
export function initMediaScan(ctx) { C = ctx; }

// ---- model (lazy, once)
let modelP = null; export const stats = { loadMs: 0, lastMs: 0, frames: 0 };
function loadScript(src) {
  return new Promise((res, rej) => { if (window.tf) return res(); const s = document.createElement('script'); s.src = src; s.async = true; s.crossOrigin = 'anonymous'; s.onload = () => res(); s.onerror = () => rej(new Error('tfjs load failed')); document.head.appendChild(s); });
}
export function loadModel() {
  if (!modelP) {
    const t0 = performance.now();
    modelP = (async () => {
      await loadScript(TF_URL);
      const tf = window.tf; await tf.ready();
      const m = await tf.loadLayersModel(MODEL_URL);
      tf.tidy(() => m.predict(tf.zeros([1, 224, 224, 3]))); // warm up
      stats.loadMs = Math.round(performance.now() - t0);
      return m;
    })();
    modelP.catch(() => { modelP = null; });
  }
  return modelP;
}
const cv = () => { const c = document.createElement('canvas'); c.width = c.height = 224; return c; };
function classify(model, canvas) {
  const tf = window.tf;
  const out = tf.tidy(() => model.predict(tf.browser.fromPixels(canvas).toFloat().div(255).reshape([1, 224, 224, 3])).dataSync());
  const s = {}; CLASSES.forEach((k, i) => (s[k] = out[i])); return s;
}

// ---- test hook: mocked scores, honoured ONLY on localhost (never on the live site)
function mock() {
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return null;
  try { const m = JSON.parse(localStorage.getItem('kemyScanMock') || 'null'); return m && typeof m === 'object' ? m : null; } catch { return null; }
}

// ---- frames
async function imageFrames(file) {
  const bmp = await createImageBitmap(file);
  const c = cv(); c.getContext('2d').drawImage(bmp, 0, 0, 224, 224); bmp.close && bmp.close(); return [c];
}
async function videoFrames(file, onStep) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  const wait = (ev, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); v.addEventListener('error', () => { clearTimeout(t); rej(new Error('decode')); }, { once: true }); });
  const frames = [];
  try {
    await wait('loadeddata', 15000);
    // some recordings (e.g. browser-made WebM) report an Infinity duration until you seek to the end
    if (!isFinite(v.duration)) { v.currentTime = 1e7; await wait('seeked', 5000).catch(() => {}); }
    const d = isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const n = Math.max(8, Math.min(16, Math.round(d / 4)));
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(d - 0.05, d * (i + 0.5) / n);
      await wait('seeked', 5000).catch(() => {});
      if (v.readyState >= 2) { const c = cv(); c.getContext('2d').drawImage(v, 0, 0, 224, 224); frames.push(c); }
      onStep && onStep(i + 1, n);
    }
  } finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); }
  return frames;
}

export function verdictFor(scores) {
  let block = null, review = null, top = { Porn: 0, Hentai: 0, Sexy: 0 }, hot = 0;
  for (const s of scores) {
    for (const k of ['Porn', 'Hentai', 'Sexy']) top[k] = Math.max(top[k], s[k] || 0);
    const sum = (s.Porn || 0) + (s.Hentai || 0) + (s.Sexy || 0);
    if (s.Porn >= LIMITS.blockPorn || s.Hentai >= LIMITS.blockHentai || s.Sexy >= LIMITS.blockSexy) block = block || s;
    else if (s.Porn >= LIMITS.reviewPorn || s.Hentai >= LIMITS.reviewHentai || s.Sexy >= LIMITS.reviewSexy || sum >= LIMITS.reviewSum) { review = review || s; hot++; }
  }
  // many borderline frames in one video add up to a block
  if (!block && scores.length >= 8 && hot >= Math.ceil(scores.length / 2) && top.Porn + top.Hentai >= 0.6) block = review;
  const pct = (x) => Math.round(x * 100) + '%';
  const why = `Porn ${pct(top.Porn)}, Hentai ${pct(top.Hentai)}, Sexy ${pct(top.Sexy)}`;
  return { level: block ? 'block' : review ? 'review' : 'ok', top, why };
}

// Scan one file. Returns { level: 'ok' | 'review' | 'block', kind, why, frames, ms }.
export async function scanFile(file, { onStatus } = {}) {
  const kind = /^video\//.test(file && file.type) ? 'video' : /^image\//.test(file && file.type) ? 'image' : 'other';
  if (kind === 'other') return { level: 'ok', kind, why: '', frames: 0, ms: 0 };
  const m = mock(); if (m) { const v = verdictFor(Array.isArray(m) ? m : [m]); return { ...v, kind, frames: Array.isArray(m) ? m.length : 1, ms: 0, mocked: true }; }
  const t0 = performance.now();
  try {
    onStatus && onStatus(kind === 'video' ? 'Checking your video… 💜' : 'Checking your picture… 💜');
    const model = await loadModel();
    const frames = kind === 'video' ? await videoFrames(file, (i, n) => onStatus && onStatus(`Checking your video… ${i}/${n} 💜`)) : await imageFrames(file);
    if (!frames.length) throw new Error('no frames');
    const scores = frames.map((c) => classify(model, c));
    stats.lastMs = Math.round(performance.now() - t0); stats.frames = frames.length;
    return { ...verdictFor(scores), kind, frames: frames.length, ms: stats.lastMs, scores };
  } catch (e) {
    // couldn't check (offline, blocked CDN, video codec the browser can't read): a moderator looks instead
    return { level: 'review', kind, why: 'Safety check couldn’t run (' + (e && e.message || 'error') + ')', frames: 0, ms: Math.round(performance.now() - t0), failed: true };
  }
}

// ---- kind-words on captions, titles, hashtags
export function textProblem(...parts) {
  const t = parts.filter(Boolean).join(' \n ');
  return badWord(t) || sneakyWord(t) ? 'Let’s keep it kind 💜 Please change the words in your caption or title.' : '';
}

// ---- auto-review item (self-report, no quota, shows in the Mod Hub reports inbox)
export async function fileAutoReview(r, where, caption = '') {
  if (!C || !C.S.user) return;
  const me = C.S.user.uid;
  await setDoc(doc(collection(C.db, 'reports')), {
    reporterId: me, targetType: 'post', targetId: 'autoscan-' + Date.now().toString(36), postId: '',
    reason: `🤖 Picture/video check blocked a ${r.kind} (${where}${r.frames > 1 ? ', ' + r.frames + ' frames' : ''}): ${r.why}`.slice(0, 500),
    excerpt: String(caption || '').slice(0, 300), targetUid: me, status: 'open', createdAt: serverTimestamp()
  }).catch(() => {});
}

// ---- new-account video rule (admin setting config/mediaReview.minApproved, default 3)
let cfg = null;
export async function reviewConfig() {
  if (cfg && Date.now() - cfg.at < 300e3) return cfg;
  const s = await getDoc(doc(C.db, 'config', 'mediaReview')).catch(() => null);
  const n = s && s.exists() ? Number(s.data().minApproved) : 3;
  cfg = { minApproved: Number.isInteger(n) && n >= 0 ? n : 3, at: Date.now() }; return cfg;
}
export async function saveReviewConfig(minApproved) {
  const n = Math.max(0, Math.min(50, Math.round(Number(minApproved) || 0)));
  await setDoc(doc(C.db, 'config', 'mediaReview'), { minApproved: n, updatedAt: serverTimestamp() }); cfg = null; return n;
}
export async function newAccountReason(uid) {
  if (!C || C.isAdmin() || uid === 'studio') return '';
  const p = C.S.profile || {}; const made = p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : 0;
  if (made && Date.now() - made < NEW_ACCOUNT_DAYS * 864e5) return `🌱 New account (under ${NEW_ACCOUNT_DAYS} days): first videos are checked by a moderator`;
  const { minApproved } = await reviewConfig(); if (!minApproved) return '';
  const n = await getCountFromServer(query(collection(C.db, 'posts'), where('authorId', '==', uid))).then((x) => x.data().count).catch(() => minApproved);
  return n < minApproved ? `🌱 Fewer than ${minApproved} approved posts: videos are checked by a moderator` : '';
}

// ---- pending hold, picked up by holdOrSet for the next post save
let pend = null;
export function takeHold() { const p = pend; pend = null; return p && Date.now() - p.at < 3600e3 ? p : null; }
export function clearHold() { pend = null; }

// One call for every upload spot. Throws (with userMessage) when the file must not be uploaded.
// where: 'post' | 'movie' | 'cover' | 'story' | 'snap' | 'avatar' | 'series' | 'comment'
export async function guardUpload(file, { where = 'post', caption = '', title = '', onStatus } = {}) {
  const tp = textProblem(caption, title); if (tp) { const e = new Error(tp); e.userMessage = tp; throw e; }
  if (C && C.isAdmin()) return { level: 'ok' };
  if (where === 'story' && C && C.S.watchedMe) { const m = 'Stories are paused for now while a moderator checks your posts 💜 You can still share a post; it will be reviewed first.'; const e = new Error(m); e.userMessage = m; throw e; }
  const canHold = where === 'post' || where === 'movie' || where === 'cover';
  const r = await scanFile(file, { onStatus });
  if (r.level === 'block' || (r.level === 'review' && !canHold && !r.failed)) {
    fileAutoReview(r, where, [title, caption].filter(Boolean).join(' · '));
    const e = new Error(BLOCK_MSG(r.kind)); e.userMessage = BLOCK_MSG(r.kind); e.scanBlocked = true; throw e;
  }
  if (r.level === 'review' && canHold) pend = pend || { reason: '🤖 Picture/video check: ' + r.why, level: 'borderline', at: Date.now() };
  else if (r.kind === 'video' && canHold && C && C.S.user && !pend) {
    const why = await newAccountReason(C.S.user.uid); if (why) pend = { reason: why, level: 'borderline', at: Date.now() };
  }
  return r;
}
