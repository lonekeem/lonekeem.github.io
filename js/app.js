// Lone Keem Studios community app (plain ES modules, no build step).
import { auth, db, ADMIN_EMAIL, STUDIO_UID } from './firebase-init.js';
import { createWatch } from './watch.js';
import { createComposer } from './create.js';
import { deliveryUrls, LIMITS } from './media-config.js';
import { createSearch, SEARCH_ICON } from './search.js';
import { searchFields, userSearchFields, linkify } from './search-index.js';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, onSnapshot, writeBatch, serverTimestamp, increment, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

// ---------------------------------------------------------------- state
const S = {
  user: null, profile: null, ready: false,
  following: new Set(), blocked: new Set(), saved: new Set(), liked: new Map(),
  unsubs: [], globalUnsubs: [], unreadNotes: false, unreadChats: false
};
const main = document.getElementById('main');
const COLORS = ['#8a2be2', '#4da3ff', '#e2448a', '#2bb673', '#f2a33a', '#6a3df0', '#e05a2b', '#14a3a3'];
const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;
const LINK_RE = /^https:\/\/([a-z0-9-]+\.)*(youtube\.com|youtu\.be|tiktok\.com)\/.*$/i;
const isAdmin = () => !!(S.user && S.user.email === ADMIN_EMAIL && S.user.emailVerified);

// ---------------------------------------------------------------- helpers
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function avatar(p, size = '', link = true) {
  const uid = p.uid || p.authorId || p.id;
  const name = p.displayName || p.authorName || '';
  const color = /^#[0-9a-f]{3,8}$/i.test(p.color || p.authorColor || '') ? (p.color || p.authorColor) : '#8a2be2';
  const uname = p.username || p.authorUsername || '';
  const cls = `avatar ${size} ${uid === STUDIO_UID ? 'studio' : ''}`;
  const inner = esc(initials(name));
  if (link && uname) return `<a class="${cls}" style="--c:${color}" href="#/u/${esc(uname)}" aria-label="${esc(name)} profile">${inner}</a>`;
  return `<span class="${cls}" style="--c:${color}" aria-hidden="true">${inner}</span>`;
}
const badge = (uid) => uid === STUDIO_UID ? '<span class="badge" title="Official studio account" aria-label="Official studio account">✓</span>' : '';
function timeAgo(ts) {
  if (!ts) return 'just now';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function toast(msg) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (root.innerHTML = ''), 3200);
}
function friendlyError(e) {
  const c = e && (e.code || '');
  const map = {
    'auth/email-already-in-use': 'That email already has an account. Try logging in.',
    'auth/invalid-email': 'That email address doesn’t look right.',
    'auth/weak-password': 'Please use a password with at least 6 characters.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with that email.',
    'auth/too-many-requests': 'Too many tries. Please wait a moment and try again.',
    'auth/popup-closed-by-user': 'Sign-in window was closed.',
    'auth/network-request-failed': 'Network problem. Check your connection.',
    'permission-denied': 'You’re going a little fast, or that action isn’t allowed. Wait a few seconds and try again.'
  };
  return map[c] || (e && e.message ? e.message.replace(/^Firebase: /, '') : 'Something went wrong.');
}
function requireAuth() {
  if (!S.user) { location.hash = '#/login?next=' + encodeURIComponent(location.hash || '#/watch'); return false; }
  if (!S.profile) { location.hash = '#/onboard'; return false; }
  return true;
}
const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.5-7 4.5v-16a1 1 0 0 1 1-1z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};

// ---------------------------------------------------------------- data helpers
const profileCache = new Map();
async function getProfile(uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);
  const snap = await getDoc(doc(db, 'users', uid));
  const p = snap.exists() ? { uid, ...snap.data() } : null;
  profileCache.set(uid, p);
  return p;
}
async function uidForUsername(username) {
  const snap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  return snap.exists() ? snap.data().uid : null;
}
async function notify(toUid, type, extra = {}, fromUid = S.user.uid) {
  if (!toUid || toUid === fromUid) return;
  const from = fromUid === S.user.uid ? S.profile : await getProfile(fromUid);
  try {
    await addDoc(collection(db, 'users', toUid, 'notifications'), {
      type, fromUid, fromName: from.displayName, fromUsername: from.username,
      postId: extra.postId || '', text: (extra.text || '').slice(0, 140), createdAt: serverTimestamp(), read: false
    });
  } catch (e) { /* best effort */ }
}
async function isLiked(postId) {
  if (!S.user) return false;
  if (S.liked.has(postId)) return S.liked.get(postId);
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', S.user.uid));
  S.liked.set(postId, snap.exists());
  return snap.exists();
}
const chatIdFor = (a, b) => [a, b].sort().join('_');

// ---------------------------------------------------------------- shared social actions
// Used by post cards, the post page, profiles and the vertical video feed (js/watch.js).
async function likePost(p, on) {
  const b = writeBatch(db);
  const likeRef = doc(db, 'posts', p.id, 'likes', S.user.uid);
  if (on) b.set(likeRef, { createdAt: serverTimestamp() }); else b.delete(likeRef);
  b.update(doc(db, 'posts', p.id), { likeCount: increment(on ? 1 : -1) });
  await b.commit();
  S.liked.set(p.id, on);
  if (on) notify(p.authorId, 'like', { postId: p.id, text: p.text });
}
async function savePost(postId, on) {
  const ref = doc(db, 'users', S.user.uid, 'saved', postId);
  if (on) { await setDoc(ref, { postId, createdAt: serverTimestamp() }); S.saved.add(postId); }
  else { await deleteDoc(ref); S.saved.delete(postId); }
}
async function followUser(uid, on) {
  const ref = doc(db, 'follows', `${S.user.uid}_${uid}`);
  if (on) { await setDoc(ref, { follower: S.user.uid, followee: uid, createdAt: serverTimestamp() }); S.following.add(uid); notify(uid, 'follow'); }
  else { await deleteDoc(ref); S.following.delete(uid); }
}
async function addComment(p, text) {
  const ref = doc(collection(db, 'posts', p.id, 'comments'));
  const b = writeBatch(db);
  b.set(ref, { authorId: S.user.uid, authorName: S.profile.displayName, authorUsername: S.profile.username, authorColor: S.profile.color, text: text.slice(0, 500), createdAt: serverTimestamp() });
  b.update(doc(db, 'posts', p.id), { commentCount: increment(1), lastCommentId: ref.id });
  b.update(doc(db, 'users', S.user.uid), { lastCommentAt: serverTimestamp() });
  await b.commit();
  notify(p.authorId, 'comment', { postId: p.id, text });
}
async function deleteComment(postId, cid) {
  const b = writeBatch(db);
  b.delete(doc(db, 'posts', postId, 'comments', cid));
  b.update(doc(db, 'posts', postId), { commentCount: increment(-1), lastCommentId: cid });
  await b.commit();
}
// Owner or admin. Removes the Firestore doc; the Cloudinary file stays until an admin cleans it
// up (unsigned browser uploads can't delete; see scripts/cloudinary-setup.mjs notes).
async function deletePost(p) {
  await deleteDoc(doc(db, 'posts', p.id));
}
const canDeletePost = (p) => !!(S.user && (p.authorId === S.user.uid || isAdmin()));
const watchCommentsQuery = (postId) => query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(200));

// ---------------------------------------------------------------- embeds
function youTubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1).split('/')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const m = u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/);
    return m ? m[2] : null;
  } catch { return null; }
}
const tikTokId = (url) => { const m = String(url).match(/\/video\/(\d{6,})/); return m ? m[1] : null; };
function mediaHtml(p) {
  const poster = p.poster || p.posterUrl || '';
  const dims = Number(p.width) > 0 && Number(p.height) > 0 ? `width="${Number(p.width)}" height="${Number(p.height)}"` : '';
  if (p.mediaUrl && p.mediaType === 'video') {
    return `<div class="post-media"><video controls playsinline preload="metadata" controlsList="nodownload" ${dims} ${poster ? `poster="${esc(poster)}"` : ''} src="${esc(p.mediaUrl)}"></video></div>`;
  }
  if (p.mediaUrl && p.mediaType === 'image') return `<div class="post-media"><img src="${esc(p.mediaUrl)}" ${dims} alt="Photo posted by ${esc(p.authorName)}" loading="lazy"></div>`;
  if (p.linkUrl) {
    const yt = youTubeId(p.linkUrl);
    if (yt && /^[\w-]+$/.test(yt)) {
      const tall = p.linkUrl.includes('/shorts/');
      return `<div class="post-media"><div class="embed ${tall ? 'tall' : ''}"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}" title="YouTube video" loading="lazy" allowfullscreen allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"></iframe></div></div>`;
    }
    const tt = tikTokId(p.linkUrl);
    if (tt) return `<div class="post-media"><div class="embed tall"><iframe src="https://www.tiktok.com/embed/v2/${esc(tt)}" title="TikTok video" loading="lazy" allowfullscreen allow="encrypted-media"></iframe></div></div>`;
    return `<a class="link-card" href="${esc(p.linkUrl)}" target="_blank" rel="noopener nofollow ugc">${esc(p.linkUrl)}</a>`;
  }
  return '';
}

// ---------------------------------------------------------------- post card
function postCard(p, { detail = false } = {}) {
  const el = document.createElement('article');
  el.className = 'card post';
  el.dataset.postId = p.id;
  const mine = S.user && (p.authorId === S.user.uid || (p.authorId === STUDIO_UID && isAdmin()));
  el.innerHTML = `
    <div class="post-head">
      ${avatar(p)}
      <div class="who">
        <a class="name" href="#/u/${esc(p.authorUsername)}">${esc(p.authorName)}</a>${badge(p.authorId)}
        <div class="handle">@${esc(p.authorUsername)} · <a href="#/post/${esc(p.id)}" class="muted" style="text-decoration:none">${esc(timeAgo(p.createdAt))}</a></div>
      </div>
      <div class="menu-wrap">
        <button class="act" data-a="menu" aria-label="More options" aria-haspopup="true" aria-expanded="false">${ICON.more}</button>
        <div class="menu" hidden>
          ${!detail ? `<button data-a="open">Open post</button>` : ''}
          <button data-a="copy">Copy link</button>
          ${S.user && !mine ? `<button data-a="report">Report post</button>` : ''}
          ${S.user && !mine && p.authorId !== STUDIO_UID ? `<button data-a="block" class="danger">Block @${esc(p.authorUsername)}</button>` : ''}
          ${mine || isAdmin() ? `<button data-a="delete" class="danger">Delete post</button>` : ''}
        </div>
      </div>
    </div>
    ${p.text ? `<p class="post-text">${linkify(esc(p.text))}</p>` : ''}
    ${mediaHtml(p)}
    <div class="actions">
      <button class="act like" data-a="like" aria-pressed="false" aria-label="Like">${ICON.heart}<span class="n">${Number(p.likeCount) || 0}</span></button>
      <a class="act" href="#/post/${esc(p.id)}" aria-label="Comments">${ICON.comment}<span>${Number(p.commentCount) || 0}</span></a>
      <button class="act saved" data-a="save" aria-pressed="false" aria-label="Save to favorites">${ICON.save}</button>
    </div>`;
  const likeBtn = $('[data-a=like]', el), saveBtn = $('[data-a=save]', el);
  const setLike = (on) => { likeBtn.classList.toggle('on', on); likeBtn.setAttribute('aria-pressed', on); };
  const setSave = (on) => { saveBtn.classList.toggle('on', on); saveBtn.setAttribute('aria-pressed', on); saveBtn.setAttribute('aria-label', on ? 'Remove from saved' : 'Save to favorites'); };
  setSave(S.saved.has(p.id));
  isLiked(p.id).then(setLike).catch(() => {});

  likeBtn.onclick = async () => {
    if (!requireAuth()) return;
    const on = !likeBtn.classList.contains('on');
    const n = $('.n', likeBtn); const cur = parseInt(n.textContent, 10) || 0;
    setLike(on); n.textContent = Math.max(0, cur + (on ? 1 : -1)); likeBtn.disabled = true;
    try {
      await likePost(p, on);
    } catch (e) { setLike(!on); n.textContent = cur; toast(friendlyError(e)); }
    likeBtn.disabled = false;
  };
  saveBtn.onclick = async () => {
    if (!requireAuth()) return;
    const on = !S.saved.has(p.id); setSave(on);
    try {
      await savePost(p.id, on); toast(on ? 'Saved to your profile' : 'Removed from saved');
    } catch (e) { setSave(!on); toast(friendlyError(e)); }
  };
  const menuBtn = $('[data-a=menu]', el), menu = $('.menu', el);
  menuBtn.onclick = (ev) => {
    ev.stopPropagation();
    const open = menu.hidden; closeMenus(); menu.hidden = !open; menuBtn.setAttribute('aria-expanded', open);
  };
  menu.onclick = async (ev) => {
    const a = ev.target.closest('button')?.dataset.a; if (!a) return;
    menu.hidden = true;
    if (a === 'open') location.hash = '#/post/' + p.id;
    if (a === 'copy') {
      const url = location.origin + location.pathname + '#/post/' + p.id;
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link:', url); }
    }
    if (a === 'report') reportDialog('post', p.id, p.id, p.text);
    if (a === 'block') blockUser(p.authorId, p.authorUsername);
    if (a === 'delete') {
      if (!confirm('Delete this post? This can’t be undone.')) return;
      try { await deletePost(p); el.remove(); toast('Post deleted'); if (detail) location.hash = '#/feed'; }
      catch (e) { toast(friendlyError(e)); }
    }
  };
  return el;
}
function closeMenus() { $$('.menu').forEach((m) => (m.hidden = true)); }
document.addEventListener('click', closeMenus);

function renderPosts(container, posts, emptyMsg) {
  container.innerHTML = '';
  const visible = posts.filter((p) => !S.blocked.has(p.authorId));
  if (!visible.length) { container.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
  visible.forEach((p) => container.appendChild(postCard(p)));
}

// ---------------------------------------------------------------- moderation actions
function reportDialog(targetType, targetId, postId, excerpt) {
  if (!requireAuth()) return;
  openModal(`
    <h2 style="font-size:1.25rem">Report ${esc(targetType)}</h2>
    <p>Tell us what’s wrong. Reports go privately to the studio.</p>
    <form id="report-form" style="text-align:left">
      <div class="field"><label for="report-reason">Reason</label>
      <textarea id="report-reason" maxlength="500" required placeholder="e.g. spam, stolen content, harassment, explicit content"></textarea></div>
      <p class="form-error" id="report-err"></p>
      <div class="btns"><button class="btn" type="submit">Send report</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`);
  $('#report-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const reason = $('#report-reason').value.trim(); if (!reason) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reporterId: S.user.uid, targetType, targetId, postId: postId || '', reason: reason.slice(0, 500),
        excerpt: String(excerpt || '').slice(0, 300), createdAt: serverTimestamp()
      });
      closeModal(); toast('Thanks. The report was sent.');
    } catch (e) { $('#report-err').textContent = friendlyError(e); }
  };
}
async function blockUser(uid, username) {
  if (!requireAuth()) return;
  if (!confirm(`Block @${username}? They won’t be able to follow you, comment on your posts, or message you, and you won’t see their posts.`)) return;
  try {
    await setDoc(doc(db, 'users', S.user.uid, 'blocks', uid), { createdAt: serverTimestamp() });
    S.blocked.add(uid);
    await Promise.allSettled([deleteDoc(doc(db, 'follows', `${S.user.uid}_${uid}`)), deleteDoc(doc(db, 'follows', `${uid}_${S.user.uid}`))]);
    S.following.delete(uid);
    toast(`Blocked @${username}`); route();
  } catch (e) { toast(friendlyError(e)); }
}
async function unblockUser(uid, username) {
  try { await deleteDoc(doc(db, 'users', S.user.uid, 'blocks', uid)); S.blocked.delete(uid); toast(`Unblocked @${username}`); route(); }
  catch (e) { toast(friendlyError(e)); }
}

// ---------------------------------------------------------------- modal
function openModal(inner, { dismissable = true } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" role="dialog" aria-modal="true"><div class="card modal">${inner}</div></div>`;
  const bd = $('.modal-backdrop', root);
  if (dismissable) bd.addEventListener('click', (e) => { if (e.target === bd || e.target.closest('[data-close]')) closeModal(); });
  setTimeout(() => $('.modal input, .modal textarea, .modal .btn', root)?.focus(), 30);
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// The welcome "Watch now" button always points at the studio's newest video post.
async function newestStudioVideo() {
  try {
    const snap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', STUDIO_UID), orderBy('createdAt', 'desc'), limit(10)));
    const v = snap.docs.find((d) => d.data().mediaType === 'video' || d.data().linkUrl);
    return v ? v.id : 'stand-up-strong';
  } catch { return 'stand-up-strong'; }
}
async function showWelcome() {
  const name = S.profile.displayName;
  S.profile.welcomed = true;
  openModal(`
    <button class="icon-btn close" data-close aria-label="Close">✕</button>
    <img class="logo" src="logo.png" alt="Lone Keem Studios KL logo" width="84" height="84">
    <h2 id="welcome-title">Welcome to Lone Keem Studios, ${esc(name)}!</h2>
    <p>This is where AI meets imagination. Watch our latest drop, follow the studio for new movies and music, and share what you create with the community.</p>
    <div class="btns">
      <a class="btn" id="welcome-watch" href="#/watch/stand-up-strong" data-close>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
        Watch now</a>
      <a class="btn btn-ghost" href="#/settings" data-close>Set up my profile</a>
    </div>`);
  newestStudioVideo().then((id) => { const a = $('#welcome-watch'); if (a) a.href = '#/watch/' + id; });
  try { await updateDoc(doc(db, 'users', S.user.uid), { welcomed: true }); } catch (e) { console.warn(e); }
}

// ---------------------------------------------------------------- header / nav
function renderChrome(name) {
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name || a.dataset.also === name));
  const ha = document.getElementById('header-actions');
  const searchBtn = `<a class="icon-btn" href="#/search" data-open-search aria-label="Search">${SEARCH_ICON}</a>`;
  if (S.user && S.profile) {
    ha.innerHTML = `${searchBtn}
      ${isAdmin() ? `<a class="icon-btn" href="#/admin" aria-label="Admin">${ICON.shield}</a>` : ''}
      <a class="icon-btn" href="#/notifications" aria-label="Notifications">${ICON.bell}${S.unreadNotes ? '<span class="dot"></span>' : ''}</a>
      ${avatar({ ...S.profile, uid: S.user.uid }, 'sm')}`;
  } else if (S.user && !S.profile) {
    ha.innerHTML = `<button class="icon-btn" id="hdr-signout">Sign out</button>`;
    $('#hdr-signout').onclick = () => signOut(auth);
  } else {
    ha.innerHTML = `${searchBtn}<a class="signin-pill" href="#/login">Sign in</a>`;
  }
  document.getElementById('msg-dot').hidden = !S.unreadChats;
}

// ---------------------------------------------------------------- router
const routes = [
  [/^#?\/?$/, () => location.replace('#/watch'), 'watch'],
  [/^#\/watch(?:\/([\w-]+))?$/, pageWatch, 'watch'],
  [/^#\/feed$/, pageFeed, 'feed'],
  [/^#\/explore$/, pageExplore, 'explore'],
  [/^#\/search(?:\?(.*))?$/, pageSearch, 'explore'],
  [/^#\/new(?:\/(text))?$/, pageCompose, 'new'],
  [/^#\/messages(?:\/(studio))?$/, pageInbox, 'messages'],
  [/^#\/chat\/([\w-]+)(?:\/(studio))?$/, pageChat, 'messages'],
  [/^#\/me$/, pageMe, 'me'],
  [/^#\/u\/([a-z0-9_.]{1,30})(?:\/(saved))?$/i, pageProfile, 'me'],
  [/^#\/(followers|following)\/([\w-]+)$/, pageFollowList, 'me'],
  [/^#\/post\/([\w-]+)$/, pagePost, ''],
  [/^#\/settings$/, pageSettings, 'me'],
  [/^#\/notifications(?:\/(studio))?$/, pageNotifications, ''],
  [/^#\/admin$/, pageAdmin, ''],
  [/^#\/login(?:\?.*)?$/, pageLogin, 'me'],
  [/^#\/signup$/, pageSignup, 'me'],
  [/^#\/reset$/, pageReset, 'me'],
  [/^#\/onboard$/, pageOnboard, 'me']
];
let routeToken = 0, navCount = 0;
async function route() {
  navCount++;
  if (!S.ready) return;
  S.unsubs.forEach((u) => u()); S.unsubs = [];
  closeModal();
  // Accept short deep links like app.html#watch/<postId> as well as #/watch/<postId>.
  const hash = (location.hash || '#/watch').replace(/^#watch\b/, '#/watch');
  const token = ++routeToken;
  for (const [re, fn, nav] of routes) {
    const m = hash.match(re);
    if (m) {
      renderChrome(nav);
      main.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
      document.body.classList.toggle('feed-mode', nav === 'watch' && fn === pageWatch);
      window.scrollTo(0, 0);
      try { await fn(...m.slice(1), token); }
      catch (e) { console.error(e); if (token === routeToken) main.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
      if (token === routeToken && S.profile && S.profile.welcomed === false && !/onboard|login|signup/.test(hash)) showWelcome();
      return;
    }
  }
  document.body.classList.remove('feed-mode');
  main.innerHTML = '<div class="empty">Page not found. <a href="#/watch">Go home</a></div>';
}
window.addEventListener('hashchange', route);
// Search icons: focus a throwaway input inside the tap so phones (iOS) open the keyboard,
// then the search page moves focus to the real box.
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-open-search]'); if (!a || e.defaultPrevented) return;
  e.preventDefault();
  if (location.hash.startsWith('#/search')) { document.getElementById('sq')?.focus(); return; }
  const t = document.createElement('input');
  t.type = 'search'; t.setAttribute('aria-hidden', 'true'); t.tabIndex = -1;
  t.style.cssText = 'position:fixed;top:8px;left:8px;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0';
  document.body.appendChild(t); t.focus();
  window.__lksSearchPrimer = t; setTimeout(() => t.remove(), 2000);
  location.hash = a.getAttribute('href');
});
const stale = (t) => t !== routeToken;

// ---------------------------------------------------------------- page: vertical video feed (For You)
const watch = createWatch({
  S, db, main, STUDIO_UID, esc, $, avatar, badge, timeAgo, toast, friendlyError, openModal, closeModal, isAdmin, stale,
  isLiked, likePost, savePost, followUser, addComment, deleteComment, reportDialog, youTubeId, tikTokId,
  blockUser, deletePost, canDeletePost, linkify, SEARCH_ICON, commentsQuery: watchCommentsQuery,
  fs: { doc, getDoc, getDocs, collection, query, where, limit, onSnapshot }
});
async function pageWatch(postId, token) { return watch.render(postId, token); }
const search = createSearch({
  S, db, main, esc, $, avatar, badge, toast, friendlyError, requireAuth, followUser, gridTile: (p) => gridTile(p), postCard: (p) => postCard(p),
  STUDIO_UID, youTubeId, tikTokId, stale, canGoBack: () => navCount > 1,
  fs: { doc, getDocs, collection, query, where, orderBy, limit, getCountFromServer }
});

// ---------------------------------------------------------------- pages: feed / explore
const feedToggle = (active) => `<nav class="feed-toggle" aria-label="Feed"><a href="#/watch" class="${active === 'watch' ? 'active' : ''}">For You</a><a href="#/feed" class="${active === 'feed' ? 'active' : ''}">Posts</a></nav>`;
async function pageFeed(token) {
  if (!S.user || !S.profile) {
    main.innerHTML = `${feedToggle('feed')}
      <section class="card pad center stack">
        <img class="auth-logo" src="logo.png" alt="" width="64" height="64">
        <h1 class="page-title" style="margin:0">Join the community</h1>
        <p class="muted" style="margin:6px 0 0">Follow the studio for new movies and music, like and comment on drops, save favorites, share your own creations, and message other fans.</p>
        <div class="row" style="justify-content:center;flex-wrap:wrap"><a class="btn" href="#/signup">Create account</a><a class="btn btn-ghost" href="#/login">Log in</a></div>
      </section>
      <h2 style="margin:26px 0 14px;font-size:1.2rem">Latest from the community</h2>
      <div id="posts"></div>`;
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20)));
    if (stale(token)) return;
    renderPosts($('#posts'), snap.docs.map((d) => ({ id: d.id, ...d.data() })), 'No posts yet.');
    return;
  }
  const verified = S.user.emailVerified || S.user.providerData.some((p) => p.providerId === 'google.com');
  main.innerHTML = `
    ${verified ? '' : `<div class="banner">Check your inbox to verify <b>${esc(S.user.email)}</b>. <button class="link-btn" id="resend">Resend email</button></div>`}
    ${feedToggle('feed')}
    <div class="row"><h1 class="page-title">Posts</h1><span class="spacer"></span><a class="btn btn-sm btn-ghost" href="#/new">New post</a></div>
    <div id="posts"><div class="spinner"></div></div>`;
  const rs = $('#resend'); if (rs) rs.onclick = async () => { try { await sendEmailVerification(S.user); toast('Verification email sent'); } catch (e) { toast(friendlyError(e)); } };
  const authors = [...new Set([S.user.uid, STUDIO_UID, ...S.following])].filter((u) => !S.blocked.has(u));
  const chunks = []; for (let i = 0; i < authors.length; i += 30) chunks.push(authors.slice(i, i + 30));
  const results = await Promise.all(chunks.map((c) => getDocs(query(collection(db, 'posts'), where('authorId', 'in', c), orderBy('createdAt', 'desc'), limit(40)))));
  if (stale(token)) return;
  const ms = (p) => p.createdAt?.toMillis?.() || Date.now();
  const posts = results.flatMap((r) => r.docs.map((d) => ({ id: d.id, ...d.data() }))).sort((a, b) => ms(b) - ms(a)).slice(0, 60);
  renderPosts($('#posts'), posts, 'Your feed is empty. <a href="#/explore">Explore</a> to find people to follow, or <a href="#/new">make your first post</a>.');
}

async function pageExplore(token) {
  main.innerHTML = `
    <h1 class="page-title">Explore</h1>
    <div id="ex-top"></div>
    <h2 style="margin:22px 0 14px;font-size:1.15rem">Recent posts</h2>
    <div id="posts"><div class="spinner"></div></div>`;
  search.renderExploreTop($('#ex-top'), token);
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30)));
  if (stale(token)) return;
  renderPosts($('#posts'), snap.docs.map((d) => ({ id: d.id, ...d.data() })), 'No posts yet. Be the first!');
}
async function pageSearch(qs, token) { return search.render(qs, token); }
const userRow = (u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, '', false)}<div class="meta"><b>${esc(u.displayName)}</b>${badge(u.uid)}<p>@${esc(u.username)}${u.bio ? ' · ' + esc(u.bio) : ''}</p></div></a>`;

// ---------------------------------------------------------------- compose (Post tab)
// Camera / photo / library flow lives in js/create.js; the text + link form stays here.
const composer = createComposer({ S, main, esc, $, toast, friendlyError, isAdmin, STUDIO_UID, saveMediaPost });
async function pageCompose(sub, token) {
  if (!requireAuth()) return;
  composer.render(token, { textForm: (slot) => textComposeForm(slot, sub === 'text') });
}
async function postAuthor(asStudio) {
  const authorId = asStudio ? STUDIO_UID : S.user.uid;
  profileCache.delete(STUDIO_UID);
  return { authorId, author: asStudio ? await getProfile(STUDIO_UID) : S.profile };
}
function textComposeForm(slot, open) {
  slot.innerHTML = `
    <details class="card pad text-compose" id="text-compose" ${open ? 'open' : ''}>
      <summary><b>Write a text post or share a link</b><span class="muted small">YouTube or TikTok links show up in For You</span></summary>
      <form id="compose" style="margin-top:14px">
        ${isAdmin() ? `<label class="check" style="margin-bottom:14px"><input type="checkbox" id="as-studio"> <span>Post as <b>Lone Keem Studios</b> (official studio post)</span></label>` : ''}
        <div class="field"><label for="post-text">What do you want to share?</label>
          <textarea id="post-text" maxlength="${LIMITS.captionMax}" placeholder="Share an idea, a creation, or what you thought of the latest drop…"></textarea>
          <div class="small muted" style="text-align:right"><span id="count">0</span>/${LIMITS.captionMax}</div></div>
        <div class="field"><label for="post-link">YouTube or TikTok link <span class="muted">(optional)</span></label>
          <input id="post-link" type="url" inputmode="url" placeholder="https://youtube.com/watch?v=…"></div>
        <p class="small muted">By posting you agree to the <a href="guidelines.html">Community Guidelines</a>. Only share things you made or have the right to share.</p>
        <p class="form-error" id="compose-err"></p>
        <button class="btn btn-block" type="submit" id="compose-btn">Post</button>
      </form>
    </details>`;
  $('#post-text').oninput = (e) => ($('#count').textContent = e.target.value.length);
  $('#compose').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('#compose-err'); err.textContent = '';
    const text = $('#post-text').value.trim();
    const linkUrl = $('#post-link').value.trim();
    const asStudio = isAdmin() && !!$('#as-studio')?.checked;
    if (linkUrl && !LINK_RE.test(linkUrl)) { err.textContent = 'Links must be a YouTube or TikTok URL starting with https://'; return; }
    if (!text && !linkUrl) { err.textContent = 'Write something or add a link.'; return; }
    const btn = $('#compose-btn'); btn.disabled = true; btn.textContent = 'Posting…';
    try {
      const { authorId, author } = await postAuthor(asStudio);
      const ref = doc(collection(db, 'posts'));
      const b = writeBatch(db);
      b.set(ref, {
        authorId, authorName: author.displayName, authorUsername: author.username, authorColor: author.color,
        type: linkUrl ? 'link' : 'text', text, linkUrl, mediaUrl: '', mediaType: '', poster: '',
        ...searchFields({ text, authorName: author.displayName, authorUsername: author.username }),
        createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: authorId === STUDIO_UID
      });
      b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp() });
      await b.commit();
      toast('Posted!');
      location.hash = '#/post/' + ref.id;
    } catch (e) {
      err.textContent = e.code === 'permission-denied' ? 'You can post once every 20 seconds. Please wait a moment and try again.' : friendlyError(e);
      btn.disabled = false; btn.textContent = 'Post';
    }
  };
}
// Saves a photo/video post after the Cloudinary upload finished. Same post model as text/link
// posts plus mediaType, mediaUrl, poster/posterUrl, width, height, duration, cloudinaryPublicId.
async function saveMediaPost({ upload, info, caption, asStudio }) {
  const urls = deliveryUrls(upload);
  const { authorId, author } = await postAuthor(asStudio);
  const ref = doc(collection(db, 'posts'));
  const b = writeBatch(db);
  const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const duration = urls.mediaType === 'video' ? Math.min(LIMITS.maxVideoSeconds + 1, Math.round((Number(upload.duration) || Number(info.duration) || 0) * 10) / 10) : 0;
  b.set(ref, {
    authorId, authorName: author.displayName, authorUsername: author.username, authorColor: author.color,
    type: 'media', text: caption.slice(0, LIMITS.captionMax), linkUrl: '',
    mediaUrl: urls.mediaUrl, mediaType: urls.mediaType, poster: urls.posterUrl, posterUrl: urls.posterUrl,
    width: n(upload.width || info.width, 20000), height: n(upload.height || info.height, 20000), duration,
    cloudinaryPublicId: String(upload.public_id).slice(0, 255),
    ...searchFields({ text: caption, authorName: author.displayName, authorUsername: author.username }),
    createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: authorId === STUDIO_UID
  });
  b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp() });
  await b.commit();
  return ref.id;
}

// ---------------------------------------------------------------- post detail + comments
async function pagePost(postId, token) {
  const snap = await getDoc(doc(db, 'posts', postId));
  if (stale(token)) return;
  if (!snap.exists()) { main.innerHTML = '<div class="empty">This post was removed or doesn’t exist. <a href="#/explore">Explore</a></div>'; return; }
  const p = { id: snap.id, ...snap.data() };
  main.innerHTML = `<div id="post-slot"></div>
    <section class="card pad" aria-labelledby="c-title">
      <h2 id="c-title" style="font-size:1.1rem">Comments</h2>
      <div id="comments"><div class="spinner"></div></div>
      ${S.user && S.profile
        ? `<form class="comment-form" id="comment-form"><label for="comment-text" class="sr-only">Add a comment</label><input id="comment-text" type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off" required><button class="btn btn-sm" type="submit">Send</button></form><p class="form-error" id="comment-err"></p>`
        : `<p class="muted small" style="margin-top:12px"><a href="#/login?next=${encodeURIComponent('#/post/' + postId)}">Log in</a> or <a href="#/signup">create an account</a> to comment.</p>`}
    </section>`;
  $('#post-slot').appendChild(postCard(p, { detail: true }));
  const unsub = onSnapshot(watchCommentsQuery(postId), (qs) => {
    const box = $('#comments'); if (!box) return;
    const list = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !S.blocked.has(c.authorId));
    box.innerHTML = list.length ? '' : '<p class="muted small">No comments yet. Say something nice!</p>';
    list.forEach((c) => {
      const canDelete = S.user && (c.authorId === S.user.uid || isAdmin() || p.authorId === S.user.uid);
      const row = document.createElement('div'); row.className = 'comment';
      row.innerHTML = `${avatar({ uid: c.authorId, displayName: c.authorName, username: c.authorUsername, color: c.authorColor }, 'sm')}
        <div class="body"><div><a style="font-weight:600;color:var(--text);text-decoration:none" href="#/u/${esc(c.authorUsername)}">${esc(c.authorName)}</a>${badge(c.authorId)} <span class="muted small">${esc(timeAgo(c.createdAt))}</span></div>
        <div class="text">${linkify(esc(c.text))}</div>
        <div class="small">${S.user && c.authorId !== S.user.uid ? '<button class="link-btn small" data-a="report">Report</button>' : ''} ${canDelete ? '<button class="link-btn small" data-a="del" style="color:#ffb3c1;margin-left:10px">Delete</button>' : ''}</div></div>`;
      row.onclick = async (e) => {
        const a = e.target.dataset.a;
        if (a === 'report') reportDialog('comment', c.id, postId, c.text);
        if (a === 'del' && confirm('Delete this comment?')) {
          try {
            await deleteComment(postId, c.id); toast('Comment deleted');
          } catch (err) { toast(friendlyError(err)); }
        }
      };
      box.appendChild(row);
    });
  }, (e) => { const box = $('#comments'); if (box) box.innerHTML = `<p class="muted small">${esc(friendlyError(e))}</p>`; });
  S.unsubs.push(unsub);
  const form = $('#comment-form');
  if (form) form.onsubmit = async (ev) => {
    ev.preventDefault();
    const input = $('#comment-text'); const text = input.value.trim(); if (!text) return;
    const err = $('#comment-err'); err.textContent = '';
    const btn = $('button', form); btn.disabled = true;
    try {
      await addComment(p, text);
      input.value = '';
    } catch (e) { err.textContent = e.code === 'permission-denied' ? 'Please wait a few seconds between comments.' : friendlyError(e); }
    btn.disabled = false;
  };
}

// ---------------------------------------------------------------- profiles
async function pageMe() {
  if (!requireAuth()) return;
  location.replace('#/u/' + S.profile.username);
}
async function pageProfile(username, tab, token) {
  username = username.toLowerCase();
  const uid = await uidForUsername(username);
  if (stale(token)) return;
  if (!uid) { main.innerHTML = '<div class="empty">No one has that username. <a href="#/explore">Explore</a></div>'; return; }
  profileCache.delete(uid);
  const u = await getProfile(uid);
  if (stale(token)) return;
  if (!u) { main.innerHTML = '<div class="empty">This profile is not available.</div>'; return; }
  const mine = !!(S.user && uid === S.user.uid);
  const blocked = S.blocked.has(uid);
  const [fers, fing, pc] = await Promise.all([
    getCountFromServer(query(collection(db, 'follows'), where('followee', '==', uid))),
    getCountFromServer(query(collection(db, 'follows'), where('follower', '==', uid))),
    getCountFromServer(query(collection(db, 'posts'), where('authorId', '==', uid)))
  ]);
  if (stale(token)) return;
  const isFollowing = S.following.has(uid);
  main.innerHTML = `
    <section class="card pad">
      <div class="profile-head">
        ${avatar(u, 'lg', false)}
        <div style="min-width:0">
          <h1>${esc(u.displayName)}${badge(uid)}</h1>
          <div class="muted">@${esc(u.username)}</div>
          <div class="stats small">
            <span><b>${pc.data().count}</b> posts</span>
            <a href="#/followers/${esc(uid)}"><b id="fers">${fers.data().count}</b> followers</a>
            <a href="#/following/${esc(uid)}"><b>${fing.data().count}</b> following</a>
          </div>
        </div>
      </div>
      ${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ''}
      <div class="profile-actions">
        ${mine ? `<a class="btn btn-sm btn-ghost" href="#/settings">Edit profile</a><button class="btn btn-sm btn-ghost" id="signout">Log out</button>` : ''}
        ${!mine && !blocked ? `<button class="btn btn-sm ${isFollowing ? 'btn-ghost' : ''}" id="follow">${isFollowing ? 'Following' : 'Follow'}</button>` : ''}
        ${!mine && !blocked && !(uid === STUDIO_UID && isAdmin()) ? `<a class="btn btn-sm btn-ghost" href="#/chat/${esc(uid)}" id="msg">Message</a>` : ''}
        ${!mine && S.user && uid !== STUDIO_UID ? `<button class="btn btn-sm btn-ghost" id="report-user">Report</button>` : ''}
        ${!mine && S.user && uid !== STUDIO_UID ? (blocked ? `<button class="btn btn-sm btn-danger" id="unblock">Unblock</button>` : `<button class="btn btn-sm btn-danger" id="block">Block</button>`) : ''}
      </div>
    </section>
    ${mine ? `<nav class="tabs" aria-label="Profile"><a href="#/u/${esc(u.username)}" class="${tab ? '' : 'active'}">Posts</a><a href="#/u/${esc(u.username)}/saved" class="${tab ? 'active' : ''}">Saved</a></nav>` : '<div style="height:16px"></div>'}
    <div id="posts"><div class="spinner"></div></div>`;
  $('#signout')?.addEventListener('click', async () => { await signOut(auth); location.hash = '#/feed'; });
  $('#report-user')?.addEventListener('click', () => reportDialog('user', uid, '', '@' + u.username));
  $('#block')?.addEventListener('click', () => blockUser(uid, u.username));
  $('#unblock')?.addEventListener('click', () => unblockUser(uid, u.username));
  $('#msg')?.addEventListener('click', (e) => { if (!S.user) { e.preventDefault(); requireAuth(); } });
  const fb = $('#follow');
  if (fb) fb.onclick = async () => {
    if (!requireAuth()) return;
    fb.disabled = true;
    const n = $('#fers');
    try {
      if (S.following.has(uid)) {
        await followUser(uid, false); fb.textContent = 'Follow'; fb.classList.remove('btn-ghost'); n.textContent = +n.textContent - 1;
      } else {
        await followUser(uid, true); fb.textContent = 'Following'; fb.classList.add('btn-ghost'); n.textContent = +n.textContent + 1;
      }
    } catch (e) { toast(friendlyError(e)); }
    fb.disabled = false;
  };
  if (blocked) { $('#posts').innerHTML = '<div class="empty">You blocked this account.</div>'; return; }
  if (tab === 'saved' && mine) {
    const sv = await getDocs(query(collection(db, 'users', uid, 'saved'), orderBy('createdAt', 'desc'), limit(60)));
    const posts = (await Promise.all(sv.docs.map((d) => getDoc(doc(db, 'posts', d.id))))).filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }));
    if (stale(token)) return;
    renderGrid($('#posts'), posts, 'Nothing saved yet. Tap the bookmark on any post to save it here.');
  } else {
    const ps = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(40)));
    if (stale(token)) return;
    renderGrid($('#posts'), ps.docs.map((d) => ({ id: d.id, ...d.data() })), mine ? 'You haven’t posted yet. <a href="#/new">Make your first post</a>.' : 'No posts yet.');
  }
}
// Instagram / TikTok style 3-column grid of a user's posts. Media opens in the For You player.
const GRID_IC = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h7"/></svg>'
};
function gridTile(p) {
  const yt = p.linkUrl ? youTubeId(p.linkUrl) : null;
  const kind = p.mediaUrl && p.mediaType === 'video' ? 'video' : p.mediaUrl && p.mediaType === 'image' ? 'image'
    : yt && /^[\w-]+$/.test(yt) ? 'youtube' : p.linkUrl && tikTokId(p.linkUrl) ? 'tiktok' : 'text';
  const thumb = kind === 'video' ? (p.posterUrl || p.poster) : kind === 'image' ? (p.posterUrl || p.mediaUrl) : kind === 'youtube' ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : '';
  const href = kind === 'text' ? `#/post/${esc(p.id)}` : `#/watch/${esc(p.id)}`;
  const label = `${kind === 'video' ? 'Video' : kind === 'image' ? 'Photo' : kind === 'text' ? 'Post' : 'Video link'}${p.text ? ': ' + p.text.slice(0, 60) : ''}`;
  const inner = thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">`
    : kind === 'video' ? `<video src="${esc(p.mediaUrl)}#t=0.5" preload="metadata" muted playsinline tabindex="-1" aria-hidden="true"></video>`
    : `<span class="gtext">${esc((p.text || p.linkUrl || '').slice(0, 120))}</span>`;
  return `<a class="gtile k-${kind}" href="${href}" aria-label="${esc(label)}">${inner}
    <span class="gicon">${kind === 'image' ? GRID_IC.photo : kind === 'text' ? GRID_IC.text : GRID_IC.play}</span>
    <span class="glikes">${ICON.heart}${Number(p.likeCount) || 0}</span></a>`;
}
function renderGrid(container, posts, emptyMsg) {
  const visible = posts.filter((p) => !S.blocked.has(p.authorId));
  container.innerHTML = visible.length ? `<div class="pgrid">${visible.map(gridTile).join('')}</div>` : `<div class="empty">${emptyMsg}</div>`;
}
async function pageFollowList(kind, uid, token) {
  const u = await getProfile(uid);
  const field = kind === 'followers' ? 'followee' : 'follower';
  const other = kind === 'followers' ? 'follower' : 'followee';
  const snap = await getDocs(query(collection(db, 'follows'), where(field, '==', uid), limit(100)));
  const people = (await Promise.all(snap.docs.map((d) => getProfile(d.data()[other])))).filter(Boolean);
  if (stale(token)) return;
  main.innerHTML = `<h1 class="page-title">${kind === 'followers' ? 'Followers' : 'Following'}</h1>
    <p class="muted" style="margin-top:-8px">${u ? '@' + esc(u.username) : ''}</p>
    <div class="card" style="padding:6px">${people.length ? people.map(userRow).join('') : '<div class="empty">No one yet.</div>'}</div>`;
}

// ---------------------------------------------------------------- settings
async function pageSettings() {
  if (!requireAuth()) return;
  const p = S.profile;
  main.innerHTML = `
    <h1 class="page-title">Edit profile</h1>
    <form id="settings" class="card pad">
      <div class="row" style="margin-bottom:16px">${avatar({ ...p, uid: S.user.uid }, 'lg', false)}<p class="muted small" style="margin:0">Your avatar uses your initials and the color you pick below.</p></div>
      <div class="field"><label for="s-name">Display name</label><input id="s-name" type="text" maxlength="50" required value="${esc(p.displayName)}"></div>
      <div class="field"><label for="s-user">Username</label><input id="s-user" type="text" maxlength="20" required value="${esc(p.username)}" autocapitalize="none" autocomplete="off" spellcheck="false">
        <p class="small muted" style="margin:4px 0 0">3–20 characters: lowercase letters, numbers, dot, underscore.</p></div>
      <div class="field"><label for="s-bio">Bio</label><textarea id="s-bio" maxlength="160" style="min-height:72px" placeholder="Tell people about yourself">${esc(p.bio)}</textarea></div>
      <fieldset class="field" style="border:0;padding:0;margin:0 0 14px"><legend style="font-weight:500;font-size:.92rem;margin-bottom:8px">Avatar color</legend>
        <div class="color-row">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === p.color ? 'checked' : ''}><span class="swatch" style="background:${c}" title="${c}"></span></label>`).join('')}</div></fieldset>
      <p class="form-error" id="s-err"></p>
      <button class="btn btn-block" type="submit">Save changes</button>
    </form>
    <section class="card pad" style="margin-top:16px">
      <h2 style="font-size:1.05rem">Account</h2>
      <p class="muted small">Signed in as ${esc(S.user.email || '')}</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn btn-sm btn-ghost" id="s-reset">Send password reset email</button><button class="btn btn-sm btn-ghost" id="s-out">Log out</button></div>
      <p class="small muted">Want your account deleted? Message <a href="#/u/lonekeemstudios">@lonekeemstudios</a> and we’ll remove it.</p>
    </section>`;
  $('#s-out').onclick = async () => { await signOut(auth); location.hash = '#/feed'; };
  $('#s-reset').onclick = async () => { try { await sendPasswordResetEmail(auth, S.user.email); toast('Password reset email sent'); } catch (e) { toast(friendlyError(e)); } };
  $('#settings').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('#s-err'); err.textContent = '';
    const displayName = $('#s-name').value.trim();
    const username = $('#s-user').value.trim().toLowerCase().replace(/^@/, '');
    const bio = $('#s-bio').value.trim();
    const color = $('input[name=color]:checked')?.value || p.color;
    if (!displayName) { err.textContent = 'Please enter a display name.'; return; }
    if (!USERNAME_RE.test(username)) { err.textContent = 'Usernames are 3–20 characters: lowercase letters, numbers, dot or underscore.'; return; }
    try {
      const b = writeBatch(db);
      if (username !== p.username) {
        if (await uidForUsername(username)) { err.textContent = 'That username is taken.'; return; }
        b.set(doc(db, 'usernames', username), { uid: S.user.uid });
        b.delete(doc(db, 'usernames', p.username));
      }
      b.update(doc(db, 'users', S.user.uid), { displayName, username, bio, color, ...userSearchFields({ displayName, username }) });
      await b.commit();
      Object.assign(S.profile, { displayName, username, bio, color });
      profileCache.set(S.user.uid, { uid: S.user.uid, ...S.profile });
      updateProfile(S.user, { displayName }).catch(() => {});
      toast('Profile saved');
      location.hash = '#/u/' + username;
    } catch (e) { err.textContent = friendlyError(e); }
  };
}

// ---------------------------------------------------------------- messages
const seenMap = () => JSON.parse(localStorage.getItem('lks-seen') || '{}');
async function pageInbox(asStudio) {
  if (!requireAuth()) return;
  const me = asStudio && isAdmin() ? STUDIO_UID : S.user.uid;
  main.innerHTML = `
    <div class="row" style="flex-wrap:wrap"><h1 class="page-title">Messages</h1><span class="spacer"></span>
    ${isAdmin() ? `<nav class="tabs" style="margin:0;border:0"><a href="#/messages" class="${me === STUDIO_UID ? '' : 'active'}">Mine</a><a href="#/messages/studio" class="${me === STUDIO_UID ? 'active' : ''}">Studio inbox</a></nav>` : ''}</div>
    <div class="card" style="padding:6px" id="inbox"><div class="spinner"></div></div>
    <p class="muted small" style="margin-top:14px">Start a chat from anyone’s profile with the <b>Message</b> button.</p>`;
  const unsub = onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', me), orderBy('lastAt', 'desc'), limit(50)), async (qs) => {
    const seen = seenMap();
    const rows = await Promise.all(qs.docs.map(async (d) => {
      const c = d.data(); const other = c.participants.find((x) => x !== me);
      if (S.blocked.has(other)) return '';
      const u = (await getProfile(other)) || { displayName: 'Unknown', username: '' };
      const unread = c.lastSender !== me && (c.lastAt?.toMillis?.() || 0) > (seen[d.id] || 0);
      return `<a class="list-item ${unread ? 'unread' : ''}" href="#/chat/${esc(other)}${me === STUDIO_UID ? '/studio' : ''}">${avatar({ ...u, uid: other }, '', false)}
        <div class="meta"><div class="row"><b>${esc(u.displayName)}</b>${badge(other)}<span class="spacer"></span><span class="muted small">${esc(timeAgo(c.lastAt))}</span></div>
        <p>${c.lastSender === me ? 'You: ' : ''}${esc(c.lastMessage)}</p></div></a>`;
    }));
    const box = $('#inbox'); if (!box) return;
    box.innerHTML = rows.join('') || '<div class="empty">No messages yet.</div>';
  }, (e) => { const box = $('#inbox'); if (box) box.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; });
  S.unsubs.push(unsub);
}
async function pageChat(otherUid, asStudio, token) {
  if (!requireAuth()) return;
  const me = asStudio && isAdmin() ? STUDIO_UID : S.user.uid;
  if (otherUid === me) { location.hash = '#/messages'; return; }
  const other = await getProfile(otherUid);
  if (stale(token)) return;
  if (!other) { main.innerHTML = '<div class="empty">That person isn’t available.</div>'; return; }
  const cid = chatIdFor(me, otherUid);
  const chatRef = doc(db, 'chats', cid);
  const chatSnap = await getDoc(chatRef);
  if (stale(token)) return;
  let chatExists = chatSnap.exists();
  let lastSender = chatExists ? chatSnap.data().lastSender : '';
  main.innerHTML = `
    <section class="chat">
      <div class="chat-head"><a class="icon-btn" href="#/messages${me === STUDIO_UID ? '/studio' : ''}" aria-label="Back to messages">←</a>${avatar({ ...other, uid: otherUid })}
        <div><b>${esc(other.displayName)}</b>${badge(otherUid)}<div class="muted small">@${esc(other.username)}${me === STUDIO_UID ? ' · replying as Lone Keem Studios' : ''}</div></div></div>
      <div class="chat-log" id="log" aria-live="polite"></div>
      ${S.blocked.has(otherUid) ? '<p class="muted small center">You blocked this account. Unblock them from their profile to chat.</p>' :
      `<form class="chat-form" id="chat-form"><label for="chat-text" class="sr-only">Message</label><input id="chat-text" type="text" maxlength="1000" placeholder="Message…" autocomplete="off" required><button class="btn btn-sm" type="submit">Send</button></form>`}
    </section>`;
  const log = $('#log');
  const markSeen = () => { const s = seenMap(); s[cid] = Date.now(); localStorage.setItem('lks-seen', JSON.stringify(s)); };
  const unsub = onSnapshot(query(collection(db, 'chats', cid, 'messages'), orderBy('createdAt', 'asc'), limit(300)), (qs) => {
    log.innerHTML = qs.docs.length ? qs.docs.map((d) => {
      const m = d.data();
      return `<div class="bubble ${m.senderId === me ? 'mine' : ''}">${esc(m.text)}<time>${esc(timeAgo(m.createdAt))}</time></div>`;
    }).join('') : `<p class="muted small center">Say hi to ${esc(other.displayName)} 👋</p>`;
    log.scrollTop = log.scrollHeight; markSeen();
  }, (e) => { log.innerHTML = `<p class="muted small center">${esc(friendlyError(e))}</p>`; });
  S.unsubs.push(unsub);
  const form = $('#chat-form');
  if (form) form.onsubmit = async (ev) => {
    ev.preventDefault();
    const input = $('#chat-text'); const text = input.value.trim(); if (!text) return;
    input.value = '';
    try {
      const b = writeBatch(db);
      const meta = { lastMessage: text.slice(0, 1000), lastAt: serverTimestamp(), lastSender: me };
      if (chatExists) b.update(chatRef, meta);
      else b.set(chatRef, { participants: [me, otherUid].sort(), ...meta, createdAt: serverTimestamp() });
      b.set(doc(collection(db, 'chats', cid, 'messages')), { senderId: me, text: text.slice(0, 1000), createdAt: serverTimestamp() });
      b.update(doc(db, 'users', me), { lastMessageAt: serverTimestamp() });
      await b.commit();
      if (!chatExists || lastSender !== me) notify(otherUid, 'message', { text }, me);
      chatExists = true; lastSender = me;
    } catch (e) {
      input.value = text;
      toast(e.code === 'permission-denied' ? 'Couldn’t send. You may be sending too fast, or this person isn’t accepting messages.' : friendlyError(e));
    }
  };
  setTimeout(() => $('#chat-text')?.focus(), 50);
}

// ---------------------------------------------------------------- notifications
async function pageNotifications(asStudio, token) {
  if (!requireAuth()) return;
  const owner = asStudio && isAdmin() ? STUDIO_UID : S.user.uid;
  main.innerHTML = `<div class="row" style="flex-wrap:wrap"><h1 class="page-title">Notifications</h1><span class="spacer"></span>
    ${isAdmin() ? `<nav class="tabs" style="margin:0;border:0"><a href="#/notifications" class="${owner === STUDIO_UID ? '' : 'active'}">Mine</a><a href="#/notifications/studio" class="${owner === STUDIO_UID ? 'active' : ''}">Studio</a></nav>` : ''}</div>
    <div class="card" style="padding:6px" id="notes"><div class="spinner"></div></div>`;
  const snap = await getDocs(query(collection(db, 'users', owner, 'notifications'), orderBy('createdAt', 'desc'), limit(60)));
  if (stale(token)) return;
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((n) => !S.blocked.has(n.fromUid));
  const verb = { follow: 'started following you', like: 'liked your post', comment: 'commented on your post', message: 'sent you a message' };
  $('#notes').innerHTML = items.length ? items.map((n) => {
    const href = n.type === 'message' ? `#/chat/${esc(n.fromUid)}${owner === STUDIO_UID ? '/studio' : ''}` : n.postId ? `#/post/${esc(n.postId)}` : `#/u/${esc(n.fromUsername)}`;
    return `<a class="list-item ${n.read ? '' : 'unread'}" href="${href}">${avatar({ uid: n.fromUid, displayName: n.fromName, username: n.fromUsername }, '', false)}
      <div class="meta"><div><b>${esc(n.fromName)}</b> ${verb[n.type] || ''} <span class="muted small">· ${esc(timeAgo(n.createdAt))}</span></div>${n.text ? `<p>${esc(n.text)}</p>` : ''}</div></a>`;
  }).join('') : '<div class="empty">No notifications yet.</div>';
  items.filter((n) => !n.read).forEach((n) => updateDoc(doc(db, 'users', owner, 'notifications', n.id), { read: true }).catch(() => {}));
}

// ---------------------------------------------------------------- admin
async function pageAdmin(token) {
  if (!requireAuth()) return;
  if (!isAdmin()) { main.innerHTML = '<div class="empty">Admins only.</div>'; return; }
  const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100)));
  if (stale(token)) return;
  const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  main.innerHTML = `<h1 class="page-title">Admin · Reports</h1>
    <div class="card pad" style="margin-bottom:14px"><div class="row" style="flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>Search index</b><p class="muted small" style="margin:2px 0 0">Adds search keywords and #hashtags to every post and profile that’s missing them.</p></div><button class="btn btn-sm" id="reindex">Build search index</button></div><p class="small muted" id="reindex-msg" style="margin:8px 0 0"></p></div>
    <p class="muted small">You can delete any post or comment from its menu. Studio tools: <a href="#/messages/studio">studio inbox</a> · <a href="#/notifications/studio">studio notifications</a> · <a href="#/new">post as the studio</a>.</p>
    <div id="reports"></div>`;
  $('#reindex').onclick = async () => {
    const b = $('#reindex'), m = $('#reindex-msg'); b.disabled = true; m.textContent = 'Working…';
    try { const r = await rebuildSearchIndex((n, t) => (m.textContent = `Updated ${n} of ${t}…`)); m.textContent = `Done. Checked ${r.posts} posts and ${r.users} profiles; updated ${r.updated}.`; }
    catch (e) { m.textContent = friendlyError(e); }
    b.disabled = false;
  };
  const box = $('#reports');
  if (!reports.length) { box.innerHTML = '<div class="card empty">No reports right now.</div>'; return; }
  for (const r of reports) {
    const reporter = await getProfile(r.reporterId);
    const target = r.targetType === 'user' ? await getProfile(r.targetId) : null;
    const link = r.targetType === 'user' ? (target ? `#/u/${target.username}` : '') : `#/post/${r.postId || r.targetId}`;
    const el = document.createElement('div'); el.className = 'card pad'; el.style.marginBottom = '12px';
    el.innerHTML = `<div class="row"><span class="tag" style="text-transform:uppercase;font-size:.75rem;color:var(--blue)">${esc(r.targetType)}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(r.createdAt))}</span></div>
      <p style="margin:10px 0 4px"><b>Reason:</b> ${esc(r.reason)}</p>
      ${r.excerpt ? `<p class="muted small" style="margin:0 0 6px">“${esc(r.excerpt)}”</p>` : ''}
      <p class="muted small" style="margin:0">Reported by @${esc(reporter?.username || 'unknown')}</p>
      <div class="profile-actions">${link ? `<a class="btn btn-sm btn-ghost" href="${esc(link)}">Open</a>` : ''}
        ${r.targetType !== 'user' ? '<button class="btn btn-sm btn-danger" data-a="remove">Delete content</button>' : ''}
        <button class="btn btn-sm btn-ghost" data-a="dismiss">Dismiss</button></div>`;
    el.onclick = async (e) => {
      const a = e.target.dataset.a; if (!a) return;
      try {
        if (a === 'remove') {
          if (!confirm('Delete the reported content?')) return;
          if (r.targetType === 'post') await deleteDoc(doc(db, 'posts', r.targetId));
          else {
            const b = writeBatch(db);
            b.delete(doc(db, 'posts', r.postId, 'comments', r.targetId));
            b.update(doc(db, 'posts', r.postId), { commentCount: increment(-1), lastCommentId: r.targetId });
            await b.commit();
          }
        }
        await deleteDoc(doc(db, 'reports', r.id)); el.remove(); toast(a === 'remove' ? 'Content deleted' : 'Report dismissed');
      } catch (err) { toast(friendlyError(err)); }
    };
    box.appendChild(el);
  }
}

// ---------------------------------------------------------------- auth pages
let pendingProfile = null;
let pendingNext = null;
const nextHash = () => {
  const n = decodeURIComponent(location.hash.split('?next=')[1] || '#/watch');
  return /^#\/(login|signup|onboard|reset)/.test(n) ? '#/watch' : n;
};
function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
function authShell(title, sub, body) {
  main.innerHTML = `<section class="card pad auth-card"><div class="center"><img class="auth-logo" src="logo.png" alt="Lone Keem Studios KL logo" width="64" height="64">
    <h1 style="font-size:1.5rem">${title}</h1><p class="muted" style="margin:6px 0 18px">${sub}</p></div>${body}</section>`;
}
const googleBlock = `<div class="divider">or</div><button class="btn btn-block google-btn" type="button" id="google">${ICON.google}Continue with Google</button>`;
async function googleSignIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  pendingNext = nextHash();
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, provider);
    toast(friendlyError(e));
  }
}
async function pageLogin() {
  if (S.user && S.profile) { location.replace(nextHash()); return; }
  authShell('Log in', 'Welcome back to Lone Keem Studios.', `
    <form id="login-form">
      <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="l-pass">Password</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
      <p class="form-error" id="l-err"></p>
      <button class="btn btn-block" type="submit" id="l-btn">Log in</button>
    </form>
    <p class="center small" style="margin:12px 0 0"><a href="#/reset">Forgot password?</a></p>
    ${googleBlock}
    <p class="center small muted" style="margin-top:18px">New here? <a href="#/signup">Create an account</a></p>`);
  $('#google').onclick = googleSignIn;
  $('#login-form').onsubmit = async (ev) => {
    ev.preventDefault(); $('#l-err').textContent = '';
    pendingNext = nextHash();
    try { await signInWithEmailAndPassword(auth, $('#l-email').value.trim(), $('#l-pass').value); }
    catch (e) { $('#l-err').textContent = friendlyError(e); }
  };
}
function profileFields(prefillName = '') {
  return `
    <div class="field"><label for="p-name">Display name</label><input id="p-name" type="text" maxlength="50" autocomplete="name" required value="${esc(prefillName)}"></div>
    <div class="field"><label for="p-user">Username</label><input id="p-user" type="text" maxlength="20" required autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="e.g. keemfan">
      <p class="small muted" style="margin:4px 0 0">3–20 characters: lowercase letters, numbers, dot, underscore.</p></div>`;
}
const agreeField = `<label class="check field"><input type="checkbox" id="p-agree" required> <span>I’m 13 or older and I agree to the <a href="terms.html" target="_blank">Terms</a>, <a href="privacy.html" target="_blank">Privacy</a> and <a href="guidelines.html" target="_blank">Community Guidelines</a>.</span></label>`;
const readProfileForm = () => ({
  displayName: $('#p-name').value.trim(),
  username: $('#p-user').value.trim().toLowerCase().replace(/^@/, '')
});
async function pageSignup() {
  if (S.user) { location.replace(S.profile ? '#/feed' : '#/onboard'); return; }
  authShell('Create your account', 'Join the Lone Keem Studios community.', `
    <form id="signup-form">
      ${profileFields()}
      <div class="field"><label for="p-email">Email</label><input id="p-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="p-pass">Password</label><input id="p-pass" type="password" autocomplete="new-password" minlength="6" required></div>
      ${agreeField}
      <p class="form-error" id="p-err"></p>
      <button class="btn btn-block" type="submit" id="p-btn">Create account</button>
    </form>
    ${googleBlock}
    <p class="center small muted" style="margin-top:18px">Already have an account? <a href="#/login">Log in</a></p>`);
  $('#google').onclick = () => {
    if (!$('#p-agree').checked) { $('#p-err').textContent = 'Please confirm you’re 13+ and agree to the Terms first.'; return; }
    googleSignIn();
  };
  $('#signup-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('#p-err'); err.textContent = '';
    const { displayName, username } = readProfileForm();
    if (!displayName) { err.textContent = 'Please enter a display name.'; return; }
    if (!USERNAME_RE.test(username)) { err.textContent = 'Usernames are 3–20 characters: lowercase letters, numbers, dot or underscore.'; return; }
    const btn = $('#p-btn'); btn.disabled = true; btn.textContent = 'Creating…';
    try {
      if (await uidForUsername(username)) throw new Error('That username is taken. Try another.');
      pendingProfile = { displayName, username };
      const cred = await createUserWithEmailAndPassword(auth, $('#p-email').value.trim(), $('#p-pass').value);
      updateProfile(cred.user, { displayName }).catch(() => {});
      sendEmailVerification(cred.user).catch(() => {});
    } catch (e) { pendingProfile = null; err.textContent = friendlyError(e); btn.disabled = false; btn.textContent = 'Create account'; }
  };
}
async function pageOnboard() {
  if (!S.user) { location.replace('#/signup'); return; }
  if (S.profile) { location.replace('#/feed'); return; }
  authShell('Pick your username', 'One last step to finish your profile.', `
    <form id="onboard-form">${profileFields(S.user.displayName || '')}${agreeField}<p class="form-error" id="p-err"></p>
    <button class="btn btn-block" type="submit">Continue</button></form>
    <p class="center small muted" style="margin-top:14px"><button class="link-btn" id="ob-out">Use a different account</button></p>`);
  $('#ob-out').onclick = () => signOut(auth);
  $('#onboard-form').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('#p-err'); err.textContent = '';
    const { displayName, username } = readProfileForm();
    if (!displayName) { err.textContent = 'Please enter a display name.'; return; }
    if (!USERNAME_RE.test(username)) { err.textContent = 'Usernames are 3–20 characters: lowercase letters, numbers, dot or underscore.'; return; }
    try { await createProfile(displayName, username); go(pendingNext || '#/feed'); pendingNext = null; }
    catch (e) { err.textContent = friendlyError(e); }
  };
}
async function pageReset() {
  authShell('Reset password', 'We’ll email you a link to set a new password.', `
    <form id="reset-form"><div class="field"><label for="r-email">Email</label><input id="r-email" type="email" autocomplete="email" required></div>
    <p class="form-error" id="r-err"></p><p class="form-ok" id="r-ok"></p><button class="btn btn-block" type="submit">Send reset link</button></form>
    <p class="center small muted" style="margin-top:14px"><a href="#/login">Back to log in</a></p>`);
  $('#reset-form').onsubmit = async (ev) => {
    ev.preventDefault(); $('#r-err').textContent = ''; $('#r-ok').textContent = '';
    try { await sendPasswordResetEmail(auth, $('#r-email').value.trim()); $('#r-ok').textContent = 'If that email has an account, a reset link is on its way.'; }
    catch (e) { $('#r-err').textContent = friendlyError(e); }
  };
}

// Creates the profile, reserves the username, and auto-follows the studio, all in one batch.
async function createProfile(displayName, username) {
  if (await uidForUsername(username)) throw new Error('That username is taken. Try another.');
  const uid = S.user.uid;
  const b = writeBatch(db);
  b.set(doc(db, 'usernames', username), { uid });
  b.set(doc(db, 'users', uid), {
    displayName: displayName.slice(0, 50), username, bio: '', color: COLORS[Math.floor(Math.random() * COLORS.length)],
    ...userSearchFields({ displayName: displayName.slice(0, 50), username }),
    createdAt: serverTimestamp(), welcomed: false
  });
  b.set(doc(db, 'follows', `${uid}_${STUDIO_UID}`), { follower: uid, followee: STUDIO_UID, createdAt: serverTimestamp() });
  await b.commit();
  await loadSession();
}

// ---------------------------------------------------------------- session
async function loadSession() {
  const uid = S.user.uid;
  const snap = await getDoc(doc(db, 'users', uid));
  S.profile = snap.exists() ? snap.data() : null;
  if (!S.profile) return;
  profileCache.set(uid, { uid, ...S.profile });
  const [fol, blk, sav] = await Promise.all([
    getDocs(query(collection(db, 'follows'), where('follower', '==', uid), limit(500))),
    getDocs(collection(db, 'users', uid, 'blocks')),
    getDocs(query(collection(db, 'users', uid, 'saved'), limit(500)))
  ]);
  backfillSearch(uid).catch((e) => console.warn('search backfill', e.code || e.message));
  S.following = new Set(fol.docs.map((d) => d.data().followee));
  S.blocked = new Set(blk.docs.map((d) => d.id));
  S.saved = new Set(sav.docs.map((d) => d.id));
  S.globalUnsubs.forEach((u) => u()); S.globalUnsubs = [];
  S.globalUnsubs.push(onSnapshot(query(collection(db, 'users', uid, 'notifications'), where('read', '==', false), limit(1)), (qs) => {
    S.unreadNotes = !qs.empty;
    if (S.ready) renderChrome($('.bottom-nav [data-nav].active')?.dataset.nav);
  }, () => {}));
  S.globalUnsubs.push(onSnapshot(query(collection(db, 'chats'), where('participants', 'array-contains', uid), orderBy('lastAt', 'desc'), limit(20)), (qs) => {
    const seen = seenMap();
    S.unreadChats = qs.docs.some((d) => d.data().lastSender !== uid && (d.data().lastAt?.toMillis?.() || 0) > (seen[d.id] || 0) && !location.hash.includes(d.data().participants.find((x) => x !== uid)));
    document.getElementById('msg-dot').hidden = !S.unreadChats;
  }, () => {}));
}

// Lazy search-index backfill: when someone signs in, add the search fields to their own
// profile and their own recent posts (and the studio's, for the admin) if they're missing.
async function backfillSearch(uid) {
  if (sessionStorage.getItem('lks-bf-' + uid)) return;
  const p = S.profile;
  const want = userSearchFields(p);
  if (p.usernameLower !== want.usernameLower || p.displayNameLower !== want.displayNameLower) {
    await updateDoc(doc(db, 'users', uid), want); Object.assign(p, want);
  }
  const authors = isAdmin() ? [uid, STUDIO_UID] : [uid];
  for (const a of authors) {
    const snap = await getDocs(query(collection(db, 'posts'), where('authorId', '==', a), orderBy('createdAt', 'desc'), limit(50)));
    const todo = snap.docs.filter((d) => !Array.isArray(d.data().keywords) || !Array.isArray(d.data().hashtags));
    for (const d of todo) await updateDoc(d.ref, searchFields(d.data()));
  }
  if (isAdmin()) {
    const st = await getProfile(STUDIO_UID);
    if (st && st.usernameLower !== userSearchFields(st).usernameLower) await updateDoc(doc(db, 'users', STUDIO_UID), userSearchFields(st));
  }
  sessionStorage.setItem('lks-bf-' + uid, '1');
}
// Admin: (re)build search fields for every post and profile.
async function rebuildSearchIndex(onProgress) {
  const [ps, us] = await Promise.all([getDocs(query(collection(db, 'posts'), limit(1000))), getDocs(query(collection(db, 'users'), limit(1000)))]);
  const jobs = [];
  ps.docs.forEach((d) => { const f = searchFields(d.data()); if (JSON.stringify(f.keywords) !== JSON.stringify(d.data().keywords) || JSON.stringify(f.hashtags) !== JSON.stringify(d.data().hashtags)) jobs.push([d.ref, f]); });
  us.docs.forEach((d) => { const u = d.data(); if (!u.username) return; const f = userSearchFields(u); if (f.usernameLower !== u.usernameLower || f.displayNameLower !== u.displayNameLower) jobs.push([d.ref, f]); });
  for (let i = 0; i < jobs.length; i += 400) {
    const b = writeBatch(db); jobs.slice(i, i + 400).forEach(([r, f]) => b.update(r, f)); await b.commit();
    onProgress(Math.min(jobs.length, i + 400), jobs.length);
  }
  return { posts: ps.size, users: us.size, updated: jobs.length };
}

getRedirectResult(auth).catch((e) => toast(friendlyError(e)));
onAuthStateChanged(auth, async (user) => {
  S.ready = false;
  S.user = user; S.profile = null; S.liked.clear();
  S.following = new Set(); S.blocked = new Set(); S.saved = new Set();
  S.globalUnsubs.forEach((u) => u()); S.globalUnsubs = []; S.unreadNotes = S.unreadChats = false;
  if (user) {
    try {
      await loadSession();
      if (!S.profile && pendingProfile) {
        const p = pendingProfile; pendingProfile = null;
        try { await createProfile(p.displayName, p.username); } catch (e) { toast(friendlyError(e)); }
      }
    } catch (e) { console.error(e); }
  }
  S.ready = true;
  if (user && !S.profile) return go('#/onboard');
  if (user && /^#\/(login|signup|onboard)/.test(location.hash)) { const n = pendingNext || nextHash(); pendingNext = null; return go(n); }
  route();
});
