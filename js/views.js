// Lone Keem Studios - view counts ("play-star" icon: a play triangle with a small sparkle).
// A view counts once per signed-in person per post (posts/{id}/views/{uid} + viewCount +1 in one
// batch; the security rules allow exactly +1 and only together with a brand-new views doc), and
// once per device for signed-out visitors (localStorage guard; rules allow only viewCount +1).
// Videos count after ~2.5 s of actual playback, photos / text posts after ~2 s on screen.
import { auth, db } from './firebase-init.js';
import { doc, writeBatch, updateDoc, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const VIDEO_VIEW_SECONDS = 2.5;
export const PHOTO_VIEW_MS = 2000;
export const EYE = '<svg class="views-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 5.2v13.6L17.5 12z"/><path d="M19.6 2.4l.75 1.75 1.75.75-1.75.75-.75 1.75-.75-1.75-1.75-.75 1.75-.75z" fill="currentColor" stroke="none"/></svg>';

// 999 · 1.2K · 12K · 3.4M
export function fmtCount(n) {
  n = Math.max(0, Number(n) || 0);
  const t = (v, s) => (Math.floor(v * 10) / 10).toFixed(1).replace(/\.0$/, '') + s;
  if (n >= 1e9) return t(n / 1e9, 'B');
  if (n >= 1e6) return t(n / 1e6, 'M');
  if (n >= 1e4) return Math.floor(n / 1e3) + 'K';
  if (n >= 1e3) return t(n / 1e3, 'K');
  return String(Math.floor(n));
}
export const viewsLabel = (n) => `${fmtCount(n)} view${Number(n) === 1 ? '' : 's'}`;
export const viewsHtml = (n, id = '', cls = 'views') => `<span class="${cls}" ${id ? `data-views-for="${String(id).replace(/[^\w-]/g, '')}" data-n="${Number(n) || 0}"` : ''} title="${viewsLabel(n)}" aria-label="${viewsLabel(n)}">${EYE}<span class="vn">${fmtCount(n)}</span></span>`;
// Bump every on-screen counter for a post by one (after this device added a view).
export function bumpCounters(postId, root = document) {
  root.querySelectorAll(`[data-views-for="${CSS.escape(postId)}"]`).forEach((el) => {
    const n = (Number(el.dataset.n) || 0) + 1; el.dataset.n = n;
    const vn = el.querySelector('.vn'); if (vn) vn.textContent = fmtCount(n);
    el.title = viewsLabel(n); el.setAttribute('aria-label', viewsLabel(n));
  });
}
// Set every on-screen counter for a post to a known value (e.g. from a live snapshot).
export function setCounters(postId, n, root = document) {
  root.querySelectorAll(`[data-views-for="${CSS.escape(postId)}"]`).forEach((el) => {
    el.dataset.n = Number(n) || 0;
    const vn = el.querySelector('.vn'); if (vn) vn.textContent = fmtCount(n);
    el.title = viewsLabel(n); el.setAttribute('aria-label', viewsLabel(n));
  });
}

const KEY = 'lks-viewed';
let seen;
function store() {
  if (!seen) { try { seen = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { seen = new Set(); } }
  return seen;
}
function remember(k) {
  const s = store(); s.add(k);
  try { localStorage.setItem(KEY, JSON.stringify([...s].slice(-3000))); } catch {}
}
const inflight = new Set();
const listeners = new Set();
// Called with (postId) whenever this device just added a view, so every visible counter can +1.
export function onViewCounted(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Returns true if this call added a view.
export async function recordView(postId, authorId = '') {
  if (!postId) return false;
  const u = auth.currentUser;
  if (u && authorId && authorId === u.uid) return false;      // your own views don't count
  const k = (u ? u.uid : 'anon') + ':' + postId;
  if (store().has(k) || inflight.has(k)) return false;
  inflight.add(k);
  try {
    if (u) {
      const b = writeBatch(db);
      b.set(doc(db, 'posts', postId, 'views', u.uid), { createdAt: serverTimestamp() });
      b.update(doc(db, 'posts', postId), { viewCount: increment(1) });
      await b.commit();
    } else {
      await updateDoc(doc(db, 'posts', postId), { viewCount: increment(1) });
    }
    remember(k);
    if (typeof document !== 'undefined') bumpCounters(postId);
    listeners.forEach((fn) => { try { fn(postId); } catch {} });
    return true;
  } catch (e) {
    // permission-denied = already viewed from this account (or post gone): never retry.
    if (e && (e.code === 'permission-denied' || e.code === 'not-found')) remember(k);
    return false;
  } finally { inflight.delete(k); }
}

// Count a <video> once it has really played VIDEO_VIEW_SECONDS (seeking doesn't count).
export function trackVideo(video, postId, authorId) {
  if (!video || video.__lksView) return;
  video.__lksView = true;
  let played = 0, last = null;
  const tick = () => {
    if (video.paused || video.seeking) { last = null; return; }
    const t = video.currentTime;
    if (last !== null && t > last && t - last < 1.5) played += t - last;
    last = t;
    if (played >= VIDEO_VIEW_SECONDS) { video.removeEventListener('timeupdate', tick); recordView(postId, authorId); }
  };
  video.addEventListener('timeupdate', tick);
  video.addEventListener('pause', () => { last = null; });
  video.addEventListener('seeking', () => { last = null; });
}

// Count an element (photo / text post) once 60% of it (or half the screen) stays visible for PHOTO_VIEW_MS.
const timers = new WeakMap();
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    const el = e.target;
    if (e.isIntersecting && (e.intersectionRatio >= 0.6 || e.intersectionRect.height >= window.innerHeight * 0.5) && !document.hidden) {
      if (!timers.has(el)) timers.set(el, setTimeout(() => {
        timers.delete(el);
        if (!el.isConnected) return;
        io.unobserve(el);
        recordView(el.dataset.viewId, el.dataset.viewAuthor);
      }, PHOTO_VIEW_MS));
    } else if (timers.has(el)) { clearTimeout(timers.get(el)); timers.delete(el); }
  });
}, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }) : null;
export function trackVisible(el, postId, authorId = '') {
  if (!io || !el || !postId) return;
  el.dataset.viewId = postId; el.dataset.viewAuthor = authorId;
  io.observe(el);
}
// Visibility check used by tests / debugging.
export const _viewedKeys = () => [...store()];
