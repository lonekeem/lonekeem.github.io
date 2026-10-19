// Lone Keem Studios community app (plain ES modules, no build step).
import { autoplayEnabled, wifiOnly, setAutoplay, setWifiOnly, saveData, canDetectWifi } from './autoplay.js';
import { auth, db, ADMIN_EMAIL, STUDIO_UID } from './firebase-init.js';
import { mountGameMusic, hideGameMusic } from './gamemusic.js';
import { findMusicLink, musicEmbed, mountMusicEmbed } from './embeds.js';
import { catPickerHtml, pickedCat } from './feed-cats.js';
import { createWatch } from './watch.js';
import { createComposer } from './create.js';
import { deliveryUrls, LIMITS, safePhotoURL, keepTrying } from './media-config.js';
import { createStories } from './stories.js';
import { createAvatarEditor } from './avatar-editor.js';
import { createSearch, SEARCH_ICON } from './search.js';
import { searchFields, userSearchFields, linkify } from './search-index.js';
import { viewsHtml, trackVideo, trackVisible, fmtCount, EYE, recordView } from './views.js';
import { createWorks, isWork, DESC as WORK_DESC, WORK_IC, artOf as workArt, gradientCss } from './works.js';
import {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, sendEmailVerification, updateProfile, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, onSnapshot, writeBatch, serverTimestamp, increment, getCountFromServer, Timestamp,
  getAggregateFromServer, sum, limitToLast, deleteField
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { ICONS } from './icons.js';
import { createLive } from './live.js';
import { createAccountDeleter } from './account-delete.js';
import { createComments } from './comments.js';
import { burstStar, onDoubleTap } from './tapstar.js';
import { createGames, CONTROLLER as GAMES_ICON } from './games/index.js';
import { createPals } from './pals/index.js';
import { createPalGames } from './pals/games.js';
import { createPark } from './pals/park.js';
import { initInterests, interestsPage, learnTap, pickTopics, topicChips } from './interests.js';
import { createMusic } from './music.js';
import { loadDiscover } from './discover.js';
import { danceEnabled, setDanceEnabled } from './pals/dance.js';
import { keepOn as palKeepOn, setKeep as setPalKeep } from './pals/dance-ui.js';
import { initThemeMusic, playIntro, play as playTheme, stop as stopTheme, isPlaying as themePlaying, getMode as themeMode, setMode as setThemeMode, getVolume as themeVol, setVolume as setThemeVol, THEME_CREDIT, THEME_TITLE } from './theme.js';

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
// Avatars: profile photo (users/{uid}.photoURL, Cloudinary only) or the coloured initials.
// Posts/comments don't copy the photo, so avatars rendered without one are filled in from the
// cached profile by hydrateAvatars() (a MutationObserver), which keeps photos current everywhere.
function avatar(p, size = '', link = true) {
  const uid = p.uid || p.authorId || p.id || '';
  const name = p.displayName || p.authorName || '';
  const color = /^#[0-9a-f]{3,8}$/i.test(p.color || p.authorColor || '') ? (p.color || p.authorColor) : '#8a2be2';
  const uname = p.username || p.authorUsername || '';
  const studio = uid === STUDIO_UID;
  const cached = profileCache.get(uid);
  const photo = studio ? '' : safePhotoURL(p.photoURL !== undefined ? p.photoURL : cached ? cached.photoURL : '');
  const known = studio || p.photoURL !== undefined || cached !== undefined;
  const cls = `avatar ${size} ${studio ? 'studio' : ''} ${photo ? 'has-photo' : ''}`;
  const ini = esc(initials(name));
  const inner = photo ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async">` : ini;
  const data = `data-uid="${esc(uid)}" data-ini="${ini}"${known ? ' data-h="1"' : ''}`;
  if (link && uname) return `<a class="${cls}" style="--c:${color}" href="#/u/${esc(uname)}" aria-label="${esc(name)} profile" ${data}>${inner}</a>`;
  return `<span class="${cls}" style="--c:${color}" aria-hidden="true" ${data}>${inner}</span>`;
}
function paintAvatar(el, url) {
  const u = safePhotoURL(url);
  if (u) { const img = el.querySelector('img'); if (img && img.getAttribute('src') === u) return; el.innerHTML = `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">`; el.classList.add('has-photo'); }
  else if (el.classList.contains('has-photo')) { el.textContent = el.dataset.ini || ''; el.classList.remove('has-photo'); }
}
function hydrateAvatars() {
  document.querySelectorAll('.avatar[data-uid]:not([data-h])').forEach((el) => {
    el.dataset.h = '1';
    const uid = el.dataset.uid; if (!uid || uid === STUDIO_UID) return;
    getProfile(uid).then((p) => { if (p && p.photoURL && el.isConnected) paintAvatar(el, p.photoURL); }).catch(() => {});
  });
}
let hydrateRaf = 0;
new MutationObserver(() => { cancelAnimationFrame(hydrateRaf); hydrateRaf = requestAnimationFrame(hydrateAvatars); })
  .observe(document.body, { childList: true, subtree: true });
const refreshAvatarsFor = (uid, url) => document.querySelectorAll(`.avatar[data-uid="${CSS.escape(uid)}"]`).forEach((el) => paintAvatar(el, url));
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
  heart: '<svg class="star-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>',
  comment: ICONS.comment,
  save: ICONS.save,
  more: ICONS.more,
  bell: ICONS.bell,
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  google: '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>'
};

// ---------------------------------------------------------------- data helpers
const profileCache = new Map();
const profileInflight = new Map();
async function getProfile(uid) {
  if (profileCache.has(uid)) return profileCache.get(uid);
  if (!profileInflight.has(uid)) {
    profileInflight.set(uid, getDoc(doc(db, 'users', uid)).then((snap) => {
      const p = snap.exists() ? { uid, ...snap.data() } : null;
      profileCache.set(uid, p); profileInflight.delete(uid);
      return p;
    }, (e) => { profileInflight.delete(uid); throw e; }));
  }
  return profileInflight.get(uid);
}
// Fresh read (stories row needs the current storyUntil); keeps the cache in sync.
async function refreshProfile(uid) {
  if (S.user && uid === S.user.uid && S.profile) {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) { S.profile = snap.data(); profileCache.set(uid, { uid, ...S.profile }); }
    return S.profile;
  }
  profileCache.delete(uid);
  return getProfile(uid);
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
// Sends a DM (used by the chat page and story replies). `me` is the sender (studio for the admin).
async function sendMessage(otherUid, text, me = S.user.uid, snapData = null) {
  const cid = chatIdFor(me, otherUid);
  const chatRef = doc(db, 'chats', cid);
  const snap = await getDoc(chatRef).catch(() => null);
  const exists = !!(snap && snap.exists());
  const b = writeBatch(db);
  const meta = { lastMessage: text.slice(0, 1000), lastAt: serverTimestamp(), lastSender: me };
  if (exists) b.update(chatRef, meta);
  else b.set(chatRef, { participants: [me, otherUid].sort(), ...meta, createdAt: serverTimestamp() });
  b.set(doc(collection(db, 'chats', cid, 'messages')), { senderId: me, text: text.slice(0, 1000), createdAt: serverTimestamp(), ...(snapData ? { snap: snapData, viewed: false } : {}) });
  b.update(doc(db, 'users', me), { lastMessageAt: serverTimestamp() });
  await b.commit();
  if (!exists || snap.data().lastSender !== me) notify(otherUid, 'message', { text }, me);
}

// View-once snaps from the camera editor (js/snapedit.js): sent one friend at a time (1 msg/s rule).
async function sendSnap(uids, snapData) {
  let sent = 0;
  for (const uid of uids) {
    if (sent) await new Promise((r) => setTimeout(r, 1150));
    await sendMessage(uid, snapData.kind === 'video' ? '🎥 Snap' : '📸 Snap', S.user.uid, snapData);
    sent++;
  }
  return sent;
}
// People you follow (newest first), for "Send to → Friends".
async function snapFriends() {
  let fol = [...S.following];
  if (!fol.length) { const qs = await getDocs(query(collection(db, 'follows'), where('follower', '==', S.user.uid), limit(200))).catch(() => null); fol = qs ? qs.docs.map((d) => d.data().followee) : []; }
  const ids = fol.filter((u) => !S.blocked.has(u) && u !== S.user?.uid).slice(0, 60);
  const list = await Promise.all(ids.map(async (uid) => { const u = await getProfile(uid).catch(() => null); return u ? { uid, ...u, photoURL: safePhotoURL(u.photoURL) } : null; }));
  return list.filter(Boolean);
}
// Full-screen view-once viewer; marks the message viewed (which deletes the link) when it opens.
function openSnap(ref, m) {
  const ov = document.createElement('div'); ov.className = 'snap-view'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Snap');
  const sn = m.snap;
  ov.innerHTML = `${sn.kind === 'video' ? `<video src="${esc(sn.url)}" ${sn.poster ? `poster="${esc(sn.poster)}"` : ''} autoplay playsinline webkit-playsinline></video>` : `<img src="${esc(sn.url)}" alt="Snap">`}
    <div class="snap-view-bar"><span></span></div><button class="snap-view-x" aria-label="Close">✕</button><p class="snap-view-tip">Tap to close · this snap disappears after you view it</p>`;
  document.body.appendChild(ov);
  updateDoc(ref, { viewed: true, snap: deleteField() }).catch((e) => console.warn('snap viewed', e));
  const bar = ov.querySelector('.snap-view-bar span'); let t0 = performance.now(), raf = 0;
  const media = ov.querySelector('video,img');
  const dur = () => (sn.kind === 'video' ? (media.duration || 10) * 1000 : 10000);
  const tick = () => { const p = sn.kind === 'video' ? (media.currentTime * 1000) / dur() : (performance.now() - t0) / dur(); bar.style.transform = `scaleX(${Math.min(1, p)})`; if (p >= 1 || (sn.kind === 'video' && media.ended)) return close(); raf = requestAnimationFrame(tick); };
  const close = () => { cancelAnimationFrame(raf); ov.remove(); };
  ov.onclick = close; raf = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- shared social actions
// Used by post cards, the post page, profiles and the vertical video feed (js/watch.js).
async function likePost(p, on) {
  const b = writeBatch(db);
  const likeRef = doc(db, 'posts', p.id, 'likes', S.user.uid);
  if (on) b.set(likeRef, { uid: S.user.uid, createdAt: serverTimestamp() }); else b.delete(likeRef);
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
// Comments, replies and comment stars live in comments.js.
const comments = createComments({
  db, S, esc, avatar: (...x) => avatar(...x), badge: (...x) => badge(...x), timeAgo: (...x) => timeAgo(...x), linkify: (...x) => linkify(...x),
  toast: (m) => toast(m), friendlyError: (e) => friendlyError(e), isAdmin: () => isAdmin(),
  reportDialog: (...x) => reportDialog(...x), notify: (...x) => notify(...x)
});
const addComment = (p, text) => comments.addComment(p, text);
const deleteComment = (postId, c) => comments.deleteComment(postId, typeof c === 'string' ? { id: c } : c);
// Owner or admin. Removes the Firestore doc; the Cloudinary file stays until an admin cleans it
// up (unsigned browser uploads can't delete; see scripts/cloudinary-setup.mjs notes).
async function deletePost(p) {
  await deleteDoc(doc(db, 'posts', p.id));
  // Admin: the Cloudinary files can only be erased with the API secret, which never ships in the site.
  // Show the ready-to-run local cleanup command instead (scripts/cloudinary-cleanup.mjs).
  const urls = [p.mediaUrl, p.poster, p.work && p.work.cover].filter((u) => /res\.cloudinary\.com\//.test(u || ''));
  if (isAdmin() && urls.length) adminMediaCleanup(urls);
}
function adminMediaCleanup(urls) {
  const cmd = `bash -c 'set -a; source ~/.config/lks/cloudinary.env; set +a; node scripts/cloudinary-cleanup.mjs --delete ${urls.map((u) => `"${u}"`).join(' ')}'`;
  setTimeout(() => {
    openModal(`<h2 style="font-size:1.2rem">Delete the media files too?</h2>
      <p class="small muted">The post is gone. Its ${urls.length} file${urls.length > 1 ? 's are' : ' is'} still on Cloudinary. Run this in the repo on the admin computer (it reads the key from ~/.config/lks/cloudinary.env):</p>
      <textarea id="amc-cmd" readonly rows="5" style="width:100%;font:12px ui-monospace,monospace">${esc(cmd)}</textarea>
      <p class="small muted">Or run the script with no file names for a full orphan sweep (dry run first).</p>
      <div class="btns"><button class="btn" id="amc-copy" type="button">Copy command</button><button class="btn btn-ghost" type="button" data-close>Close</button></div>`);
    $('#amc-copy').onclick = async () => { try { await navigator.clipboard.writeText(cmd); toast('Copied'); } catch { $('#amc-cmd').select(); } };
  }, 300);
}
let works = null;
function getWorks() {
  if (!works) works = createWorks({ db, fs: { doc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch, serverTimestamp, updateDoc }, S, esc, toast, friendlyError, isAdmin, requireAuth, avatar, badge, timeAgo, linkify, postAuthor, searchFields, likePost, isLiked, savePost, reportDialog, deletePost, recordView, stale, main, notify });
  return works;
}
const canDeletePost = (p) => !!(S.user && (p.authorId === S.user.uid || isAdmin()));

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
    return `<div class="post-media"><video controls playsinline preload="metadata" controlsList="nodownload" ${dims} ${poster ? `poster="${esc(poster)}"` : ''} src="${esc(p.mediaUrl)}"></video><div class="media-note" hidden role="status"></div></div>`;
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
  // Apple Music / Spotify link in the text: tap to load the official player (opening it counts as a play).
  const mx = findMusicLink(p.text);
  if (mx) return `<div class="post-media post-mx" data-mx="${esc(mx.url)}"><button type="button" class="btn btn-sm mx-open">▶ Play on ${mx.service === 'apple' ? 'Apple Music' : 'Spotify'}</button><p class="mx-credit">${mx.service === 'apple' ? 'Apple Music' : 'Spotify'} ${esc(mx.kind)} · official player</p></div>`;
  return '';
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.post-mx .mx-open'); if (!b) return;
  const box = b.closest('.post-mx'); const m = musicEmbed(box.dataset.mx); if (!m) return;
  e.preventDefault(); e.stopPropagation(); box._mx = mountMusicEmbed(box, m, { source: m.service === 'apple' ? 'apple-music' : 'spotify' });
  S.unsubs.push(() => { try { box._mx?.destroy(); } catch { /* */ } });
});

// ---------------------------------------------------------------- post card
function postCard(p, { detail = false } = {}) {
  if (isWork(p)) return getWorks().card(p);
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
      <button class="act like" data-a="like" aria-pressed="false" aria-label="Give a star">${ICON.heart}<span class="n">${Number(p.likeCount) || 0}</span></button>
      <a class="act" href="#/post/${esc(p.id)}" aria-label="Comments">${ICON.comment}<span>${Number(p.commentCount) || 0}</span></a>
      <button class="act saved" data-a="save" aria-pressed="false" aria-label="Save to favorites">${ICON.save}</button>
      ${viewsHtml(p.viewCount, p.id, 'act views')}
    </div>`;
  const likeBtn = $('[data-a=like]', el), saveBtn = $('[data-a=save]', el);
  const setLike = (on) => { likeBtn.classList.toggle('on', on); likeBtn.setAttribute('aria-pressed', on); likeBtn.setAttribute('aria-label', on ? 'Remove your star' : 'Give a star'); };
  const setSave = (on) => { saveBtn.classList.toggle('on', on); saveBtn.setAttribute('aria-pressed', on); saveBtn.setAttribute('aria-label', on ? 'Remove from saved' : 'Save to favorites'); };
  setSave(S.saved.has(p.id));
  isLiked(p.id).then(setLike).catch(() => {});
  // Views: videos after a few seconds of playback, everything else after ~2 s on screen.
  const pv = $('.post-media video', el);
  if (pv) trackVideo(pv, p.id, p.authorId); else trackVisible(el, p.id, p.authorId);
  if (pv) {
    const note = $('.media-note', el);
    keepTrying(pv, (st) => {
      note.hidden = st === 'ok';
      note.textContent = st === 'failed' ? 'This video couldn’t load. Try again later.'
        : 'Still processing… long videos can take a few minutes. It’ll play here when it’s ready.';
    });
  }

  // Double-tap the photo/video to give a star (never removes one).
  const media = $('.post-media', el);
  if (media && !media.querySelector('iframe')) onDoubleTap(media, {
    double: (e) => {
      if (!S.user || !S.profile) { requireAuth(); return; }
      burstStar(media, e.clientX, e.clientY);
      if (!likeBtn.classList.contains('on') && !likeBtn.disabled) likeBtn.onclick();
    }
  });
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
const accountDeleter = createAccountDeleter({
  auth, db, esc, openModal, closeModal, friendlyError,
  isProtected: (u) => u.uid === STUDIO_UID || (u.email === ADMIN_EMAIL && u.emailVerified),
  // Stop live listeners first so they don't error while data disappears.
  beforeDelete: () => { S.unsubs.forEach((u) => u()); S.unsubs = []; S.globalUnsubs.forEach((u) => u()); S.globalUnsubs = []; }
});
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
    <img class="logo" src="kemy-logo.png" alt="Kemy app icon" width="84" height="84" style="border-radius:22%">
    <h2 id="welcome-title">Welcome to Kemy, ${esc(name)}!</h2>
    <p>Kemy is the free app from Lone Keem Studios, where AI meets imagination. Watch our latest drop, follow the studio for new movies and music, and share what you create with the community.</p>
    <div class="btns">
      <a class="btn" id="welcome-watch" href="#/watch/stand-up-strong" data-close>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
        Watch now</a>
      <a class="btn btn-ghost" href="#/settings" data-close>Set up my profile</a>
    </div>
    <p class="small muted" style="margin:10px 0 0"><button type="button" class="link-btn" id="welcome-theme" data-theme-ctl aria-pressed="false">🎵 Play Kemy’s theme</button> · ${esc(THEME_TITLE)} by Keem</p>
    <form class="welcome-bio" id="welcome-bio">
      <div class="row"><label for="w-bio"><b>Add a bio</b> <span class="muted small">(optional)</span></label><span class="spacer"></span><span class="small muted counter" id="w-bio-n"></span></div>
      <textarea id="w-bio" maxlength="160" rows="3" placeholder="Who are you? What do you make? ✨"></textarea>
      <div class="row"><span class="small muted">Up to 4 lines · emoji, @names and #tags work</span><span class="spacer"></span><button class="btn btn-sm" type="submit">Save bio</button></div>
    </form>`);
  { const ta = $('#w-bio'); if (ta) { wireCounter(ta, $('#w-bio-n'), 160); limitLines(ta);
    $('#welcome-bio').onsubmit = async (ev) => { ev.preventDefault(); const bio = cleanBio(ta.value); if (!bio) { ta.focus(); return; }
      try { await updateDoc(doc(db, 'users', S.user.uid), { bio }); S.profile.bio = bio; profileCache.set(S.user.uid, { uid: S.user.uid, ...S.profile }); $('#welcome-bio').innerHTML = '<p class="small" style="margin:0">✅ Bio saved. Change it any time in Edit profile.</p>'; }
      catch (e) { toast(friendlyError(e)); } }; } }
  { const tb = $('#welcome-theme'); const paint = () => { const on = themePlaying(); tb.textContent = on ? '⏸ Pause Kemy’s theme' : '🎵 Play Kemy’s theme'; tb.setAttribute('aria-pressed', on); };
    tb.onclick = async () => { if (themePlaying()) setThemeMode('mute'); else { setThemeMode('play', { start: false }); await playTheme({ fromStart: true }); } paint(); };
    document.addEventListener('kemy-theme', paint); $('#welcome-watch').addEventListener('click', () => stopTheme(0.4));
    playIntro().then(paint); }
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
  [/^#\/watch(?:\/(following|funny|news|dance|trending))?(?:\/([\w-]+))?$/, pageWatch, 'watch'],
  [/^#\/feed$/, pageFeed, 'feed'],
  [/^#\/explore(?:\/(movies|songs))?$/, pageExplore, 'explore'],
  [/^#\/search(?:\?(.*))?$/, pageSearch, 'explore'],
  [/^#\/new(?:\/(text|menu|movie|song|aimovie))?(?:\?(.*))?$/, pageCompose, 'new'],
  [/^#\/series\/new$/, (t) => getWorks().series().editPage(null, t), 'explore'],
  [/^#\/series\/([\w-]+)\/edit$/, (id, t) => getWorks().series().editPage(id, t), 'explore'],
  [/^#\/series\/([\w-]+)$/, (id, t) => getWorks().series().page(id, t), 'explore'],
  [/^#\/messages(?:\/(studio))?$/, pageInbox, 'messages'],
  [/^#\/chat\/([\w-]+)(?:\/(studio))?$/, pageChat, 'messages'],
  [/^#\/me$/, pageMe, 'me'],
  [/^#\/u\/([a-z0-9_.]{1,30})(?:\/(saved|movies|songs|series))?$/i, pageProfile, 'me'],
  [/^#\/(followers|following)\/([\w-]+)$/, pageFollowList, 'me'],
  [/^#\/post\/([\w-]+)$/, pagePost, ''],
  [/^#\/live\/new$/, (t) => live.pageGoLive(t), 'new'],
  [/^#\/live\/([\w-]+)$/, (id, t) => live.pageLive(id, t), ''],
  [/^#\/pals(?:\/(gallery|shop))?$/, (sub, t) => pals.page(main, t, stale, sub), 'me'],
  [/^#\/park$/, () => park.page(), 'me'],
  [/^#\/games\/pals(?:\/([\w-]+))?(?:\?(.*))?$/, (b, q) => palGames.page(b, Object.fromEntries(new URLSearchParams(q || ''))), 'games'],
  [/^#\/games(?:\/([\w-]+))?(?:\/([\w-]+))?(?:\?(.*))?$/, (a, b, q, t) => games.page(a, b, q, t), 'games'],
  [/^#\/game\/([\w-]+)$/, (id, t) => games.open(id, t), 'games'],
  [/^#\/settings$/, pageSettings, 'me'],
  [/^#\/settings\/interests$/, (t) => interestsPage({ main, esc, toast, getDoc, doc, db, loadDiscover, stale, token: t }), 'me'],
  [/^#\/music$/, (t) => music.page(t), 'explore'],
  [/^#\/notifications(?:\/(studio))?$/, pageNotifications, ''],
  [/^#\/admin$/, pageAdmin, ''],
  [/^#\/login(?:\?.*)?$/, pageLogin, 'me'],
  [/^#\/signup$/, pageSignup, 'me'],
  [/^#\/reset$/, pageReset, 'me'],
  [/^#\/onboard$/, pageOnboard, 'me']
];
let routeToken = 0, navCount = 0;
// In-game music player: shown on every game screen (#/games…, #/game/…, Pal games), hidden elsewhere.
const kemySongsForGames = async () => {
  const snap = await getDocs(query(collection(db, 'posts'), where('type', '==', 'song'), orderBy('createdAt', 'desc'), limit(25)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.mediaUrl && !(p.work && p.work.explicit) && !S.blocked.has(p.authorId))
    .map((p) => ({ title: (p.work && p.work.title) || 'Song', artist: (p.work && p.work.artist) || p.authorName || 'Kemy', url: p.mediaUrl }));
};
function gameMusicFor(hash) {
  if (/^#\/games?(\/|\?|$)/.test(hash)) mountGameMusic({ kemySongs: kemySongsForGames }).catch(() => {});
  else hideGameMusic();
}
async function route() {
  navCount++;
  if (!S.ready) return;
  S.unsubs.forEach((u) => u()); S.unsubs = [];
  closeModal();
  // Accept short deep links like app.html#watch/<postId> as well as #/watch/<postId>.
  const hash = (location.hash || '#/watch').replace(/^#watch\b/, '#/watch').replace(/^#game\//, '#/game/');
  const token = ++routeToken;
  for (const [re, fn, nav] of routes) {
    const m = hash.match(re);
    if (m) {
      renderChrome(nav);
      main.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
      document.body.classList.toggle('feed-mode', nav === 'watch' && fn === pageWatch);
      document.body.classList.remove('live-mode');
      window.scrollTo(0, 0);
      gameMusicFor(hash);
      try { await fn(...m.slice(1), token); }
      catch (e) { console.error(e); if (token === routeToken) main.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
      if (token === routeToken && S.profile && S.profile.welcomed === false && !/onboard|login|signup/.test(hash)) showWelcome();
      else if (token === routeToken) pals.onRoute(hash);
      return;
    }
  }
  document.body.classList.remove('feed-mode');
  main.innerHTML = '<div class="empty">Page not found. <a href="#/watch">Go home</a></div>';
}
initInterests({ S, db, fs: { doc, getDoc, setDoc, serverTimestamp } });
window.addEventListener('hashchange', route);
initThemeMusic();
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
  blockUser, deletePost, canDeletePost, linkify, SEARCH_ICON, comments,
  openStory: () => { if (requireAuth()) composer.openStory(); },
  views: { viewsHtml, trackVideo, trackVisible },
  fs: { doc, getDoc, getDocs, collection, query, where, limit, onSnapshot, orderBy, writeBatch, serverTimestamp, increment, setDoc }
});
async function pageWatch(tab, postId, token) { return watch.render(postId, token, tab || 'foryou'); }
const stories = createStories({
  S, db, esc, avatar, badge, timeAgo, toast, friendlyError, requireAuth, STUDIO_UID, isAdmin,
  openStory: () => composer.openStory(), sendMessage, refreshProfile,
  fs: { doc, getDoc, getDocs, setDoc, collection, query, where, orderBy, limit, writeBatch, Timestamp, serverTimestamp }
});
const live = createLive({ palLive: (root, o) => pals.liveOverlay(root, o),
  S, db, main, esc, $, avatar, badge, toast, friendlyError, requireAuth, isAdmin, STUDIO_UID, getProfile, followUser, stale, openModal, closeModal, reportDialog: (...x) => reportDialog(...x),
  fs: { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limitToLast, limit, onSnapshot, writeBatch, serverTimestamp, getCountFromServer }
});
const pals = createPals({ S, db, esc, toast, openModal, closeModal, friendlyError, requireAuth, notify });
const palGames = createPalGames({ S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal });
const park = createPark({ S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal });
const games = createGames({ S, db, main, esc, $, avatar, toast, friendlyError, requireAuth, openModal, closeModal, stale, getProfile });
const search = createSearch({
  S, db, main, esc, $, avatar, badge, toast, friendlyError, requireAuth, followUser, gridTile: (p) => gridTile(p), postCard: (p) => postCard(p),
  STUDIO_UID, youTubeId, tikTokId, stale, canGoBack: () => navCount > 1,
  fs: { doc, getDoc, setDoc, updateDoc, deleteDoc, increment, serverTimestamp, getDocs, collection, query, where, orderBy, limit, getCountFromServer },
  openModal, seriesList: () => getWorks().series().fetchList({ max: 40 }), seriesTile: (x) => getWorks().series().seriesTile(x)
});
const music = createMusic({ S, db, main, esc, openModal, stale, getWorks, gridTile: (p) => gridTile(p), learnTap, STUDIO_UID, fs: { getDocs, collection, query, where, orderBy, limit } });

// ---------------------------------------------------------------- pages: feed / explore
const feedToggle = (active) => `<nav class="feed-toggle" aria-label="Feed"><a href="#/watch" class="${active === 'watch' ? 'active' : ''}">For You</a><a href="#/feed" class="${active === 'feed' ? 'active' : ''}">Posts</a></nav>`;
async function pageFeed(token) {
  if (!S.user || !S.profile) {
    main.innerHTML = `${feedToggle('feed')}
      <section class="card pad center stack">
        <img class="auth-logo" src="kemy-logo.png" alt="" width="64" height="64" style="border-radius:22%">
        <h1 class="page-title" style="margin:0">Join the community</h1>
        <p class="muted" style="margin:6px 0 0">Follow the studio for new movies and music, star and comment on drops, save favorites, share your own creations, and message other fans.</p>
        <div class="row" style="justify-content:center;flex-wrap:wrap"><a class="btn" href="#/signup">Create account</a><a class="btn btn-ghost" href="#/login">Log in</a></div>
      </section>
      <div id="live-now"></div>
      <div id="stories" class="stories-slot"></div>
      <h2 style="margin:26px 0 14px;font-size:1.2rem">Latest from the community</h2>
      <div id="posts"></div>`;
    live.renderFeed($('#live-now'), $('#stories'), stories.renderRow($('#stories'), token, stale), token);
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20)));
    if (stale(token)) return;
    renderPosts($('#posts'), snap.docs.map((d) => ({ id: d.id, ...d.data() })), 'No posts yet.');
    return;
  }
  const verified = S.user.emailVerified || S.user.providerData.some((p) => p.providerId === 'google.com');
  main.innerHTML = `
    ${verified ? '' : `<div class="banner">Check your inbox to verify <b>${esc(S.user.email)}</b>. <button class="link-btn" id="resend">Resend email</button></div>`}
    ${feedToggle('feed')}
    <div id="live-now"></div>
    <div id="stories" class="stories-slot"></div>
    <div class="row"><h1 class="page-title">Posts</h1><span class="spacer"></span><a class="btn btn-sm btn-ghost" href="#/new">New post</a></div>
    <div id="posts"><div class="spinner"></div></div>`;
  live.renderFeed($('#live-now'), $('#stories'), stories.renderRow($('#stories'), token, stale), token);
  const rs = $('#resend'); if (rs) rs.onclick = async () => { try { await sendEmailVerification(S.user); toast('Verification email sent'); } catch (e) { toast(friendlyError(e)); } };
  const authors = [...new Set([S.user.uid, STUDIO_UID, ...S.following])].filter((u) => !S.blocked.has(u));
  const chunks = []; for (let i = 0; i < authors.length; i += 30) chunks.push(authors.slice(i, i + 30));
  const results = await Promise.all(chunks.map((c) => getDocs(query(collection(db, 'posts'), where('authorId', 'in', c), orderBy('createdAt', 'desc'), limit(40)))));
  if (stale(token)) return;
  const ms = (p) => p.createdAt?.toMillis?.() || Date.now();
  const posts = results.flatMap((r) => r.docs.map((d) => ({ id: d.id, ...d.data() }))).sort((a, b) => ms(b) - ms(a)).slice(0, 60);
  renderPosts($('#posts'), posts, 'Your feed is empty. <a href="#/explore">Explore</a> to find people to follow, or <a href="#/new">make your first post</a>.');
}

async function pageExplore(tab, token) {
  if (token === undefined && typeof tab !== 'string') { token = tab; } if (typeof tab !== 'string') tab = '';
  const tabs = `<nav class="tabs ex-tabs" aria-label="Explore"><a href="#/explore" class="${tab ? '' : 'active'}">Posts</a><a href="#/explore/movies" class="${tab === 'movies' ? 'active' : ''}">${WORK_IC.movie}Movies</a><a href="#/explore/songs" class="${tab === 'songs' ? 'active' : ''}">${WORK_IC.song}Songs</a><a href="#/music">🎵 Music</a></nav>`;
  if (tab) { main.innerHTML = `<h1 class="page-title">Explore</h1>${tabs}<div id="wx"></div>`; return getWorks().explore($('#wx'), tab === 'movies' ? 'movie' : 'song', token); }
  main.innerHTML = `
    <h1 class="page-title">Explore</h1>${tabs}
    <a class="g-promo" href="#/games">${GAMES_ICON}<span><b>Games</b><small>Star Pool, Star Drop, checkers, Trivia &amp; more. Play friends or the computer.</small></span><span aria-hidden="true">›</span></a>
    <div id="ex-top"></div>
    <h2 style="margin:22px 0 14px;font-size:1.15rem">Recent posts</h2>
    <div id="posts"><div class="spinner"></div></div>`;
  search.renderExploreTop($('#ex-top'), token);
  const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(30)));
  if (stale(token)) return;
  renderPosts($('#posts'), snap.docs.map((d) => ({ id: d.id, ...d.data() })), 'No posts yet. Be the first!');
}
async function pageSearch(qs, token) { return search.render(qs, token); }
// Bios: keep up to 4 lines + emoji; @mentions and #hashtags become links. Website: https only.
const BIO_MAX = 160, BIO_LINES = 4;
const cleanBio = (t) => String(t || '').replace(/\r/g, '').split('\n').slice(0, BIO_LINES).join('\n').replace(/\n{2,}/g, '\n').trim().slice(0, BIO_MAX);
function bioHtml(t) {
  return esc(cleanBio(t)).replace(/(^|[\s(])@([a-z0-9_.]{3,20})\b/gi, (m, a, u) => `${a}<a href="#/u/${u.toLowerCase()}">@${u}</a>`)
    .replace(/(^|[\s(])#([\p{L}\p{N}_]{1,40})/gu, (m, a, h) => `${a}<a href="#/search?q=${encodeURIComponent('#' + h)}">#${h}</a>`);
}
const WEBSITE_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/[^\s"'<>]*)?$/i;
const safeWebsite = (u) => (typeof u === 'string' && u.length <= 100 && WEBSITE_RE.test(u) ? u : '');
const normWebsite = (u) => { u = String(u || '').trim(); if (!u) return ''; if (/^http:\/\//i.test(u)) return null; if (!/^https:\/\//i.test(u)) u = 'https://' + u; return safeWebsite(u) ? u : null; };
const prettyUrl = (u) => u.replace(/^https:\/\/(www\.)?/i, '').replace(/\/$/, '');
function wireCounter(input, out, max) { const f = () => { out.textContent = `${input.value.length}/${max}`; out.classList.toggle('warn', input.value.length > max - 15); }; input.addEventListener('input', f); f(); }
function limitLines(ta, n = BIO_LINES) { ta.addEventListener('input', () => { const l = ta.value.split('\n'); if (l.length > n) { const pos = ta.selectionStart; ta.value = l.slice(0, n).join('\n') + ' ' + l.slice(n).join(' '); ta.selectionStart = ta.selectionEnd = Math.min(pos, ta.value.length); ta.dispatchEvent(new Event('input')); } }); }

const userRow = (u) => `<a class="list-item" href="#/u/${esc(u.username)}">${avatar(u, '', false)}<div class="meta"><b>${esc(u.displayName)}</b>${badge(u.uid)}<p>@${esc(u.username)}${u.bio ? ' · ' + esc(cleanBio(u.bio).replace(/\n/g, ' ')) : ''}</p></div></a>`;

// ---------------------------------------------------------------- compose (Post tab)
// Camera / photo / library flow lives in js/create.js; the text + link form stays here.
const composer = createComposer({ S, main, esc, $, toast, friendlyError, isAdmin, STUDIO_UID, saveMediaPost, saveStory, sendSnap, snapFriends });
async function pageCompose(sub, qs, token) {
  if (!requireAuth()) return;
  const pre = Object.fromEntries(new URLSearchParams(qs || ''));
  if (pre.series) { pre.sid = pre.series; }
  if (sub === 'movie' || sub === 'song') return getWorks().composePage(sub, token, pre);
  if (sub === 'aimovie') { const { createMovieMaker } = await import('./moviemaker.js'); return createMovieMaker({ S, main, esc, toast, friendlyError, publishMovie: (o) => getWorks().publishMovie(o), series: getWorks().series(), pre, getPost: async (id) => { const d = await getDoc(doc(db, 'posts', id)); return d.exists() ? { id: d.id, ...d.data() } : null; } }).page(token); }
  composer.render(token, { sub, textForm: (slot) => textComposeForm(slot, sub === 'text') });
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
        ${catPickerHtml('post-cat', '', esc)}
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
        type: linkUrl ? 'link' : 'text', text, linkUrl, mediaUrl: '', mediaType: '', poster: '', ...(pickedCat(main, 'post-cat') ? { cat: pickedCat(main, 'post-cat') } : {}),
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
async function saveMediaPost({ upload, info, caption, asStudio, cat = '' }) {
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
    cloudinaryPublicId: String(upload.public_id).slice(0, 255), ...(cat ? { cat } : {}),
    ...searchFields({ text: caption, authorName: author.displayName, authorUsername: author.username }),
    createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: authorId === STUDIO_UID
  });
  b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp() });
  await b.commit();
  return ref.id;
}

// Saves a 24h story after the Cloudinary upload. expiresAt is set a little under 24 h from the
// client clock so the rule (expiresAt <= server time + 24 h) holds even with a few minutes of skew.
async function saveStory({ upload, info, caption, asStudio }) {
  const urls = deliveryUrls(upload);
  const { authorId, author } = await postAuthor(asStudio);
  const ref = doc(collection(db, 'stories'));
  const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const expiresAt = Timestamp.fromMillis(Date.now() + LIMITS.storyHours * 3600e3 - 5 * 60e3);
  const b = writeBatch(db);
  b.set(ref, {
    authorId, authorName: author.displayName, authorUsername: author.username, authorColor: author.color,
    mediaType: urls.mediaType, mediaUrl: urls.mediaUrl, posterUrl: urls.posterUrl,
    width: n(upload.width || info.width, 20000), height: n(upload.height || info.height, 20000),
    duration: urls.mediaType === 'video' ? Math.min(LIMITS.storyVideoSeconds + 1, Math.round((Number(upload.duration) || Number(info.duration) || 0) * 10) / 10) : 0,
    caption: String(caption || '').slice(0, LIMITS.storyCaptionMax),
    cloudinaryPublicId: String(upload.public_id).slice(0, 255),
    createdAt: serverTimestamp(), expiresAt
  });
  b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp(), storyUntil: expiresAt });
  await b.commit();
  if (authorId === S.user.uid) S.profile.storyUntil = expiresAt;
  profileCache.delete(authorId);
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
        ? `<form class="comment-form" id="comment-form"><label for="comment-text" class="sr-only">Add a comment</label><input id="comment-text" type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off"><button class="btn btn-sm" type="submit">Send</button></form><p class="form-error" id="comment-err"></p>`
        : `<p class="muted small" style="margin-top:12px"><a href="#/login?next=${encodeURIComponent('#/post/' + postId)}">Log in</a> or <a href="#/signup">create an account</a> to comment.</p>`}
    </section>`;
  if (isWork(p)) getWorks().page(p, $('#post-slot'), []); else $('#post-slot').appendChild(postCard(p, { detail: true }));
  const form = $('#comment-form');
  S.unsubs.push(comments.mount({ p, box: $('#comments'), form, input: $('#comment-text'), err: $('#comment-err'),
    onCount: (n) => { const s = $('#post-slot a.act[aria-label="Comments"] span'); if (s) s.textContent = n; } }));
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
  const [fers, fing, pc, tot] = await Promise.all([
    getCountFromServer(query(collection(db, 'follows'), where('followee', '==', uid))),
    getCountFromServer(query(collection(db, 'follows'), where('follower', '==', uid))),
    getCountFromServer(query(collection(db, 'posts'), where('authorId', '==', uid))),
    // Total stars (likeCount) + views across all of their posts (server-side sums, one cheap aggregate read).
    // (Two separate sums: each needs its own authorId+field index, and a doc missing one field
    // must still count toward the other.)
    Promise.all(['likeCount', 'viewCount'].map((f) => getAggregateFromServer(query(collection(db, 'posts'), where('authorId', '==', uid)), { n: sum(f) })
      .then((a) => Number(a.data().n) || 0).catch(() => 0))).then(([likes, views]) => ({ likes, views }))
  ]);
  if (stale(token)) return;
  const isFollowing = S.following.has(uid);
  main.innerHTML = `
    <section class="card pad">
      <div class="profile-head">
        <div class="pav" id="pav">${avatar(u, 'lg', false)}</div>
        <div style="min-width:0">
          <h1>${esc(u.displayName)}${badge(uid)}</h1>
          <div class="muted">@${esc(u.username)}${u.pronouns ? ` · <span class="pronouns">${esc(String(u.pronouns).slice(0, 20))}</span>` : ''}</div>
          <div class="stats small">
            <span><b>${pc.data().count}</b> posts</span>
            <a href="#/followers/${esc(uid)}"><b id="fers">${fers.data().count}</b> followers</a>
            <a href="#/following/${esc(uid)}"><b>${fing.data().count}</b> following</a>
          </div>
          <div class="stats small stats-2">
            <span id="plikes" title="${Number(tot.likes) || 0} stars">${ICON.heart}<b>${fmtCount(tot.likes)}</b> stars</span>
            <span id="pviews" title="${Number(tot.views) || 0} views">${EYE}<b>${fmtCount(tot.views)}</b> views</span>
          </div>
        </div>
      </div>
      <div id="ppal"></div>
      ${u.bio ? `<p class="bio">${bioHtml(u.bio)}</p>` : mine ? `<a class="btn btn-sm btn-ghost add-bio" href="#/settings" id="add-bio">✍️ Add a bio</a>` : ''}
      ${safeWebsite(u.website) ? `<a class="pweb" href="${esc(u.website)}" target="_blank" rel="nofollow noopener noreferrer ugc">🔗 ${esc(prettyUrl(u.website))}</a>` : ''}
      <div id="pstories"></div>
      <div id="pgames"></div>
      <div class="profile-actions">
        ${mine ? `<a class="btn btn-sm btn-ghost" href="#/settings">Edit profile</a><button class="btn btn-sm btn-ghost" id="signout">Log out</button>` : ''}
        ${!mine && !blocked ? `<button class="btn btn-sm ${isFollowing ? 'btn-ghost' : ''}" id="follow">${isFollowing ? 'Following' : 'Follow'}</button>` : ''}
        ${!mine && !blocked && !(uid === STUDIO_UID && isAdmin()) ? `<a class="btn btn-sm btn-ghost" href="#/chat/${esc(uid)}" id="msg">Message</a>` : ''}
        ${!mine && S.user && uid !== STUDIO_UID ? `<button class="btn btn-sm btn-ghost" id="report-user">Report</button>` : ''}
        ${!mine && S.user && uid !== STUDIO_UID ? (blocked ? `<button class="btn btn-sm btn-danger" id="unblock">Unblock</button>` : `<button class="btn btn-sm btn-danger" id="block">Block</button>`) : ''}
      </div>
    </section>
    <nav class="tabs" aria-label="Profile"><a href="#/u/${esc(u.username)}" class="${tab ? '' : 'active'}">Posts</a><a href="#/u/${esc(u.username)}/movies" class="${tab === 'movies' ? 'active' : ''}">Movies</a><a href="#/u/${esc(u.username)}/songs" class="${tab === 'songs' ? 'active' : ''}">Songs</a><a href="#/u/${esc(u.username)}/series" class="${tab === 'series' ? 'active' : ''}">Series</a>${mine ? `<a href="#/u/${esc(u.username)}/saved" class="${tab === 'saved' ? 'active' : ''}">Saved</a>` : ''}</nav>
    <div id="posts"><div class="spinner"></div></div>`;
  $('#add-bio')?.addEventListener('click', () => sessionStorage.setItem('lks-focus-bio', '1'));
  $('#signout')?.addEventListener('click', async () => { await signOut(auth); location.hash = '#/feed'; });
  if (!blocked) stories.renderProfile($('#pav'), $('#pstories'), uid, u, token, stale);
  if (!blocked) games.renderProfile($('#pgames'), uid);
  if (!blocked) pals.renderProfile($('#ppal'), uid, u, mine);
  if (!blocked) live.renderProfile($('#pav'), $('.profile-actions'), uid, mine || (uid === STUDIO_UID && isAdmin()), token);
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
  } else if (tab === 'series') {
    const ser = getWorks().series(); const list = await ser.fetchList({ owner: uid, max: 50 }).catch(() => []);
    if (stale(token)) return;
    $('#posts').innerHTML = '<div class="wgrid"></div>';
    await ser.renderTiles($('#posts .wgrid'), list, `<div class="empty">No series yet.${mine ? ' <a href="#/series/new">Start a series</a>.' : ''}</div>`);
  } else if (tab === 'movies' || tab === 'songs') {
    const ps = await getDocs(query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(100)));
    if (stale(token)) return;
    const kind = tab === 'movies' ? 'movie' : 'song';
    getWorks().grid($('#posts'), ps.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.type === kind), mine ? `No ${tab} yet. <a href="#/new/${kind}">Share your first ${kind}</a>.` : `No ${tab} yet.`);
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
  if (isWork(p)) { const art = workArt(p); return `<a class="gtile k-work" href="#/post/${esc(p.id)}" aria-label="${esc(p.type)}: ${esc(p.work.title)}" style="${art ? '' : `background:${gradientCss(p.id + p.work.title)}`}">${art ? `<img src="${esc(art)}" alt="" loading="lazy">` : `<span class="gtext">${esc(p.work.title)}</span>`}<span class="gicon">${WORK_IC[p.type]}</span>${viewsHtml(p.viewCount, p.id, 'gviews')}</a>`; }
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
    ${viewsHtml(p.viewCount, p.id, 'gviews')}</a>`;
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
      <div class="av-edit" id="av-edit">
        <button type="button" class="av-pick" id="av-pick" aria-label="Change profile photo">${avatar({ ...p, uid: S.user.uid }, 'lg', false)}<span class="av-cam" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4A1.5 1.5 0 0 1 9.8 5h4.4a1.5 1.5 0 0 1 1.2.6L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8z"/><circle cx="12" cy="13" r="3.5"/></svg></span></button>
        <div><button type="button" class="link-btn" id="av-change">${safePhotoURL(p.photoURL) ? 'Change profile photo' : 'Add a profile photo'}</button>
        <p class="muted small" style="margin:2px 0 0">${safePhotoURL(p.photoURL) ? 'Your photo shows everywhere your name does.' : 'Until you add one, your avatar uses your initials and the color below.'}</p></div>
      </div>
      <div class="field"><label for="s-name">Display name</label><input id="s-name" type="text" maxlength="50" required value="${esc(p.displayName)}"></div>
      <div class="field"><label for="s-user">Username</label><input id="s-user" type="text" maxlength="20" required value="${esc(p.username)}" autocapitalize="none" autocomplete="off" spellcheck="false">
        <p class="small muted" style="margin:4px 0 0">3–20 characters: lowercase letters, numbers, dot, underscore.</p></div>
      <div class="field"><div class="row"><label for="s-bio">Bio</label><span class="spacer"></span><span class="small muted counter" id="s-bio-n" aria-live="polite"></span></div><textarea id="s-bio" maxlength="160" rows="4" style="min-height:96px" placeholder="Tell people about yourself ✨ Use @names and #tags">${esc(p.bio)}</textarea>
        <p class="small muted" style="margin:4px 0 0">Up to 4 lines. Emoji, @mentions and #hashtags work.</p></div>
      <div class="field"><div class="row"><label for="s-pro">Pronouns <span class="muted small">(optional)</span></label><span class="spacer"></span><span class="small muted counter" id="s-pro-n"></span></div><input id="s-pro" type="text" maxlength="20" placeholder="e.g. she/her" value="${esc(p.pronouns || '')}" autocomplete="off"></div>
      <div class="field"><div class="row"><label for="s-web">Website <span class="muted small">(optional)</span></label><span class="spacer"></span><span class="small muted counter" id="s-web-n"></span></div><input id="s-web" type="text" inputmode="url" maxlength="100" placeholder="https://your-site.com" value="${esc(p.website || '')}" autocapitalize="none" autocomplete="url" spellcheck="false"></div>
      <fieldset class="field" style="border:0;padding:0;margin:0 0 14px"><legend style="font-weight:500;font-size:.92rem;margin-bottom:8px">Avatar color</legend>
        <div class="color-row">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === p.color ? 'checked' : ''}><span class="swatch" style="background:${c}" title="${c}"></span></label>`).join('')}</div></fieldset>
      <p class="form-error" id="s-err"></p>
      <button class="btn btn-block" type="submit">Save changes</button>
    </form>
    <section class="card pad" style="margin-top:16px" aria-labelledby="pb-h">
      <h2 id="pb-h" style="font-size:1.05rem">Playback</h2>
      <label class="row" style="gap:10px;align-items:center;margin:6px 0"><input type="checkbox" id="s-autoplay" ${autoplayEnabled() ? 'checked' : ''}> <span>Autoplay videos</span></label>
      <label class="row" style="gap:10px;align-items:center;margin:6px 0"><input type="checkbox" id="s-autoplay-wifi" ${wifiOnly() ? 'checked' : ''} ${autoplayEnabled() ? '' : 'disabled'}> <span>Autoplay on Wi-Fi only</span></label>
      <p class="muted small" id="s-ap-note">Videos start muted as you scroll. ${saveData() ? 'Data Saver is on, so videos wait for a tap.' : ''}${canDetectWifi() ? '' : ' (This browser can’t tell Wi-Fi from mobile data, so Wi-Fi only has no effect here.)'}</p>
    </section>
    <a class="card pad set-link" href="#/settings/interests" style="margin-top:16px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit"><span style="font-size:1.4rem" aria-hidden="true">✨</span><span><b>Your interests</b><br><span class="muted small">See and change what shapes your For You feed</span></span><span class="spacer"></span><span aria-hidden="true">›</span></a>
    <section class="card pad" style="margin-top:16px" aria-labelledby="snd-h">
      <h2 id="snd-h" style="font-size:1.05rem">Sound</h2>
      <p class="muted small" style="margin:0 0 8px">Kemy’s theme plays softly on your profile, Pals and settings, and stops for videos, lives and games.</p>
      <div class="seg theme-seg" role="radiogroup" aria-label="Theme song">${[['play', '🎵 Play'], ['mute', '🔇 Mute'], ['off', 'Off']].map(([k, l]) => `<label><input type="radio" name="s-theme-mode" value="${k}" ${themeMode() === k || (k === 'mute' && !themeMode()) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label for="s-theme-vol" style="margin-top:12px">Volume <span class="muted small" id="s-theme-vol-n">${Math.round(themeVol() * 100)}%</span></label>
      <input type="range" id="s-theme-vol" min="0" max="100" step="5" value="${Math.round(themeVol() * 100)}" style="width:100%">
      <div class="row" style="flex-wrap:wrap;margin-top:10px"><button class="btn btn-sm btn-ghost" type="button" id="s-theme" data-theme-ctl>🎵 Play theme</button></div>
      <p class="muted small" style="margin:10px 0 0" id="s-theme-credit"><b>${esc(THEME_TITLE)}</b><br>${esc(THEME_CREDIT)}. Written by Lone Keem.</p>
    </section>
    <section class="card pad" style="margin-top:16px" aria-labelledby="spals-h">
      <h2 id="spals-h" style="font-size:1.05rem">Pals</h2>
      <label class="row" style="gap:10px;align-items:center;margin:6px 0"><input type="checkbox" id="s-pal-dance" ${danceEnabled() ? 'checked' : ''}> <span>Pals dance to music<br><span class="muted small">When the theme song, a song or a music video plays.</span></span></label>
      <label class="row" style="gap:10px;align-items:center;margin:6px 0"><input type="checkbox" id="s-pal-keep" ${palKeepOn() ? 'checked' : ''}> <span>Keep Pal on screen while scrolling<br><span class="muted small">A small Pal in the corner. Double-tap it to hide, triple-tap the screen to bring it back, drag to move.</span></span></label>
      <p class="small" style="margin:8px 0 0"><button type="button" class="btn btn-sm btn-ghost" id="s-dance-shop">💃 Dances &amp; Dance Shop</button></p>
    </section>
    <section class="card pad" style="margin-top:16px">
      <h2 style="font-size:1.05rem">Account</h2>
      <p class="muted small">Signed in as ${esc(S.user.email || '')}</p>
      <div class="row" style="flex-wrap:wrap"><button class="btn btn-sm btn-ghost" id="s-reset">Send password reset email</button><button class="btn btn-sm btn-ghost" id="s-out">Log out</button></div>
    </section>
    ${isAdmin() ? '' : `<section class="card pad danger-zone" style="margin-top:16px" aria-labelledby="dz-h">
      <h2 id="dz-h" style="font-size:1.05rem">Delete account</h2>
      <p class="muted small">Permanently delete your profile, posts, stories, comments, follows, messages and login. This can’t be undone.</p>
      <button class="btn btn-sm btn-danger" id="s-delete" type="button">Delete account</button>
    </section>`}`;
  $('#s-autoplay').onchange = (e) => { setAutoplay(e.target.checked); $('#s-autoplay-wifi').disabled = !e.target.checked; toast(e.target.checked ? 'Autoplay on' : 'Autoplay off'); };
  $('#s-autoplay-wifi').onchange = (e) => { setWifiOnly(e.target.checked); };
  wireCounter($('#s-bio'), $('#s-bio-n'), 160); limitLines($('#s-bio'));
  wireCounter($('#s-pro'), $('#s-pro-n'), 20); wireCounter($('#s-web'), $('#s-web-n'), 100);
  if (sessionStorage.getItem('lks-focus-bio')) { sessionStorage.removeItem('lks-focus-bio'); setTimeout(() => { const t = $('#s-bio'); if (t) { t.scrollIntoView({ block: 'center' }); t.focus(); } }, 60); }
  document.querySelectorAll('[name=s-theme-mode]').forEach((r) => { r.onchange = () => { setThemeMode(r.value, { start: r.value === 'play' }); toast(r.value === 'play' ? 'Theme song on' : r.value === 'mute' ? 'Theme song muted' : 'Theme song off'); }; });
  $('#s-pal-dance').onchange = (e) => { setDanceEnabled(e.target.checked); toast(e.target.checked ? 'Pals will dance to music 💃' : 'Pal dancing off'); };
  $('#s-pal-keep').onchange = (e) => { setPalKeep(e.target.checked); toast(e.target.checked ? 'Your Pal will stay on screen' : 'Floating Pal off'); };
  $('#s-dance-shop').onclick = () => dispatchEvent(new Event('kemy:dance-shop'));
  $('#s-theme-vol').oninput = (e) => { const v = +e.target.value / 100; setThemeVol(v); $('#s-theme-vol-n').textContent = e.target.value + '%'; };
  { const b = $('#s-theme'); const paint = () => { b.textContent = themePlaying() ? '⏸ Stop theme' : '🎵 Play theme'; };
    b.onclick = async () => { if (themePlaying()) stopTheme(); else await playTheme({ force: true }); paint(); };
    document.addEventListener('kemy-theme', paint); S.unsubs.push(() => document.removeEventListener('kemy-theme', paint)); }
  $('#s-out').onclick = async () => { await signOut(auth); location.hash = '#/feed'; };
  const del = $('#s-delete');
  if (del) del.onclick = () => accountDeleter.open(S.profile);
  const setPhoto = async (url) => {
    await updateDoc(doc(db, 'users', S.user.uid), { photoURL: url });
    S.profile.photoURL = url;
    profileCache.set(S.user.uid, { uid: S.user.uid, ...S.profile });
    refreshAvatarsFor(S.user.uid, url);
    const c = $('#av-change'); if (c) c.textContent = url ? 'Change profile photo' : 'Add a profile photo';
    const h = $('#av-edit p'); if (h) h.textContent = url ? 'Your photo shows everywhere your name does.' : 'Until you add one, your avatar uses your initials and the color below.';
  };
  const editor = createAvatarEditor({
    esc, toast, friendlyError, getUid: () => S.user && S.user.uid,
    hasPhoto: () => !!safePhotoURL(S.profile.photoURL), onSaved: setPhoto, onRemoved: () => setPhoto('')
  });
  S.unsubs.push(editor.close);
  $('#av-pick').onclick = editor.open; $('#av-change').onclick = editor.open;
  $('#s-reset').onclick = async () => { try { await sendPasswordResetEmail(auth, S.user.email); toast('Password reset email sent'); } catch (e) { toast(friendlyError(e)); } };
  $('#settings').onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $('#s-err'); err.textContent = '';
    const displayName = $('#s-name').value.trim();
    const username = $('#s-user').value.trim().toLowerCase().replace(/^@/, '');
    const bio = cleanBio($('#s-bio').value);
    const pronouns = $('#s-pro').value.trim().slice(0, 20);
    const website = normWebsite($('#s-web').value);
    if (website === null) { err.textContent = 'Website must be a valid https:// link (up to 100 characters).'; return; }
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
      b.update(doc(db, 'users', S.user.uid), { displayName, username, bio, pronouns, website, color, ...userSearchFields({ displayName, username }) });
      await b.commit();
      Object.assign(S.profile, { displayName, username, bio, pronouns, website, color });
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
    const snaps = new Map();
    log.innerHTML = qs.docs.length ? qs.docs.map((d) => {
      const m = d.data();
      if ('viewed' in m) {
        const mine = m.senderId === me, open = !m.viewed && m.snap && !mine;
        if (open) snaps.set(d.id, m);
        const label = mine ? (m.viewed ? 'Opened' : 'Delivered') : (m.viewed ? 'Opened' : 'Tap to view snap');
        return `<${open ? 'button' : 'div'} class="bubble snapmsg ${mine ? 'mine' : ''} ${m.viewed ? 'opened' : 'new'}" ${open ? `data-snap="${esc(d.id)}"` : ''}><span class="snap-ic" aria-hidden="true"></span><span><b>${m.snap?.kind === 'video' || /🎥/.test(m.text) ? 'Video snap' : 'Snap'}</b><small>${label}</small></span><time>${esc(timeAgo(m.createdAt))}</time></${open ? 'button' : 'div'}>`;
      }
      return `<div class="bubble ${m.senderId === me ? 'mine' : ''}">${esc(m.text)}<time>${esc(timeAgo(m.createdAt))}</time></div>`;
    }).join('') : `<p class="muted small center">Say hi to ${esc(other.displayName)} 👋</p>`;
    log.querySelectorAll('[data-snap]').forEach((b) => (b.onclick = () => { const id = b.dataset.snap; openSnap(doc(db, 'chats', cid, 'messages', id), snaps.get(id)); b.removeAttribute('data-snap'); b.onclick = null; b.disabled = true; b.classList.replace('new', 'opened'); b.querySelector('small').textContent = 'Opened'; }));
    log.scrollTop = log.scrollHeight; markSeen();
  }, (e) => { log.innerHTML = `<p class="muted small center">${esc(friendlyError(e))}</p>`; });
  S.unsubs.push(unsub);
  const form = $('#chat-form');
  if (form) form.onsubmit = async (ev) => {
    ev.preventDefault();
    const input = $('#chat-text'); const text = input.value.trim(); if (!text) return;
    input.value = '';
    try {
      await sendMessage(otherUid, text, me);
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
  const verb = { follow: 'started following you', like: 'gave your post a star', comment: 'commented on your post', reply: 'replied to your comment', comment_like: 'gave your comment a star', message: 'sent you a message', game: 'invited you to play', pal_pat: 'patted your Pal', pal_play: 'brought their Pal over to play', episode: 'posted a new episode' };
  $('#notes').innerHTML = items.length ? items.map((n) => {
    const href = n.type === 'message' ? `#/chat/${esc(n.fromUid)}${owner === STUDIO_UID ? '/studio' : ''}` : n.type === 'game' ? `#/game/${esc(n.postId)}` : n.postId ? `#/post/${esc(n.postId)}` : `#/u/${esc(n.fromUsername)}`;
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
    const isLive = r.targetType === 'live' || r.targetType === 'live chat';
    const link = r.targetType === 'user' ? (target ? `#/u/${target.username}` : '') : r.targetType === 'series' ? `#/series/${r.targetId}` : isLive ? `#/live/${r.postId || r.targetId}` : `#/post/${r.postId || r.targetId}`;
    const el = document.createElement('div'); el.className = 'card pad'; el.style.marginBottom = '12px';
    el.innerHTML = `<div class="row"><span class="tag" style="text-transform:uppercase;font-size:.75rem;color:var(--blue)">${esc(r.targetType)}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(r.createdAt))}</span></div>
      <p style="margin:10px 0 4px"><b>Reason:</b> ${esc(r.reason)}</p>
      ${r.excerpt ? `<p class="muted small" style="margin:0 0 6px">“${esc(r.excerpt)}”</p>` : ''}
      <p class="muted small" style="margin:0">Reported by @${esc(reporter?.username || 'unknown')}</p>
      <div class="profile-actions">${link ? `<a class="btn btn-sm btn-ghost" href="${esc(link)}">Open</a>` : ''}
        ${r.targetType !== 'user' && r.targetType !== 'live' ? '<button class="btn btn-sm btn-danger" data-a="remove">Delete content</button>' : ''}
        <button class="btn btn-sm btn-ghost" data-a="dismiss">Dismiss</button></div>`;
    el.onclick = async (e) => {
      const a = e.target.dataset.a; if (!a) return;
      try {
        if (a === 'remove') {
          if (!confirm('Delete the reported content?')) return;
          if (r.targetType === 'post') await deleteDoc(doc(db, 'posts', r.targetId));
          else if (r.targetType === 'live chat') { const [lid, cid] = r.targetId.split('/'); await deleteDoc(doc(db, 'lives', lid, 'chat', cid)); }
          else {
            const cs = await getDoc(doc(db, 'posts', r.postId, 'comments', r.targetId));
            if (cs.exists()) await comments.deleteComment(r.postId, { id: cs.id, ...cs.data() });
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
  main.innerHTML = `<section class="card pad auth-card"><div class="center"><img class="auth-logo" src="kemy-logo.png" alt="Kemy app icon" width="64" height="64" style="border-radius:22%">
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
      <p class="small muted" style="margin:4px 0 0">3–20 characters: lowercase letters, numbers, dot, underscore.</p></div>
    <fieldset class="field topics-field" style="border:0;padding:0;margin:0 0 14px"><legend style="font-weight:500;font-size:.92rem;margin-bottom:6px">What do you like? <span class="muted small">(optional, shapes your For You feed)</span></legend>${topicChips('topic', (() => { try { return JSON.parse(sessionStorage.getItem('kemy-topics') || '[]'); } catch { return []; } })())}</fieldset>`;
}
// Remember topic picks from the sign-up / onboarding form until the profile exists.
document.addEventListener('change', (e) => { if (e.target.name !== 'topic' || !e.target.closest('#onboard-form, #signup-form, .auth-card, form')) return; if (location.hash.startsWith('#/settings')) return;
  const picks = [...document.querySelectorAll('input[name=topic]:checked')].map((i) => i.value); try { sessionStorage.setItem('kemy-topics', JSON.stringify(picks)); } catch { /* */ } });
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
  try { const t = JSON.parse(sessionStorage.getItem('kemy-topics') || '[]'); if (t.length) { pickTopics(t); } sessionStorage.removeItem('kemy-topics'); } catch { /* */ }
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

// While a text field is focused on a touch device, hide the bottom nav (with interactive-widget=resizes-content it would ride on top of the keyboard)
{
  const TXT = 'input:not([type=range],[type=checkbox],[type=radio],[type=color],[type=file],[type=button],[type=submit]), textarea, [contenteditable]:not([contenteditable=false])';
  document.addEventListener('focusin', (e) => { if (matchMedia('(pointer: coarse)').matches && e.target.matches?.(TXT)) document.body.classList.add('kb-open'); });
  document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement?.matches?.(TXT)) document.body.classList.remove('kb-open'); }, 60));
}
