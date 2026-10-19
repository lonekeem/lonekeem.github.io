// Homepage add-ons: header account button + star (like) / comment / save bar on studio videos.
import { auth, db } from './firebase-init.js';
import { safePhotoURL } from './media-config.js';
import { ICONS } from './icons.js';
import { viewsHtml, setCounters, trackVideo, trackVisible } from './views.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, onSnapshot, writeBatch, setDoc, deleteDoc, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) => { const p = String(n || '?').trim().split(/\s+/); return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
let me = null, profile = null;

const slot = document.getElementById('account-slot');
// One-time notice (e.g. "Your account was deleted.") left by the app before redirecting here.
try {
  const note = sessionStorage.getItem('lks-notice');
  if (note) {
    sessionStorage.removeItem('lks-notice');
    const n = document.createElement('div');
    n.className = 'site-notice'; n.setAttribute('role', 'status'); n.textContent = note;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('out'), 5200); setTimeout(() => n.remove(), 5800);
  }
} catch {}
function renderAccount() {
  if (!slot) return;
  if (me && profile) {
    const color = /^#[0-9a-f]{3,8}$/i.test(profile.color || '') ? profile.color : '#8a2be2';
    slot.innerHTML = `<a class="acct-btn" href="app.html#/feed" aria-label="Open the community"><span class="acct-label">Community</span><span class="acct-avatar" style="--c:${color}">${safePhotoURL(profile.photoURL) ? `<img src="${esc(safePhotoURL(profile.photoURL))}" alt="">` : esc(initials(profile.displayName))}</span></a>`;
  } else if (me) {
    slot.innerHTML = `<a class="acct-pill" href="app.html#/onboard">Finish sign-up</a>`;
  } else {
    slot.innerHTML = `<a class="acct-pill" href="app.html#/login">${ICONS.profile}Sign in</a>`;
  }
}

const HEART = '<svg class="star-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>';
const BUBBLE = ICONS.comment;
const MARK = ICONS.save;

const bars = [];
document.querySelectorAll('[data-post-id]').forEach((card) => {
  const postId = card.dataset.postId;
  const bar = document.createElement('div');
  bar.className = 'social-bar';
  bar.innerHTML = `
    <button class="soc like" aria-pressed="false" aria-label="Give a star">${HEART}<span class="n">0</span></button>
    <a class="soc" href="app.html#/post/${esc(postId)}" aria-label="Comments">${BUBBLE}<span class="c">0</span></a>
    ${viewsHtml(0, postId, 'soc views')}
    <button class="soc save" aria-pressed="false" aria-label="Save to favorites">${MARK}</button>`;
  card.querySelector('.info').appendChild(bar);
  const like = bar.querySelector('.like'), save = bar.querySelector('.save');
  const state = { liked: false, saved: false, count: 0 };
  const paint = () => {
    like.classList.toggle('on', state.liked); like.setAttribute('aria-pressed', state.liked); like.setAttribute('aria-label', state.liked ? 'Remove your star' : 'Give a star');
    save.classList.toggle('on', state.saved); save.setAttribute('aria-pressed', state.saved);
  };
  onSnapshot(doc(db, 'posts', postId), (d) => {
    if (!d.exists()) return;
    bar.querySelector('.n').textContent = d.data().likeCount || 0;
    bar.querySelector('.c').textContent = d.data().commentCount || 0;
    setCounters(postId, d.data().viewCount || 0, card);
  }, () => {});
  // Views: the card's video counts after a few seconds of playback (audio cards the same; others on screen).
  const media = card.querySelector('video, audio');
  if (media) trackVideo(media, postId, 'studio'); else trackVisible(card, postId, 'studio');
  const needAccount = () => {
    if (!me) { location.href = 'app.html#/login?next=' + encodeURIComponent('#/post/' + postId); return true; }
    if (!profile) { location.href = 'app.html#/onboard'; return true; }
    return false;
  };
  like.onclick = async () => {
    if (needAccount()) return;
    const on = !state.liked; state.liked = on; paint(); like.disabled = true;
    try {
      const b = writeBatch(db);
      const ref = doc(db, 'posts', postId, 'likes', me.uid);
      if (on) b.set(ref, { createdAt: serverTimestamp() }); else b.delete(ref);
      b.update(doc(db, 'posts', postId), { likeCount: increment(on ? 1 : -1) });
      await b.commit();
    } catch (e) { state.liked = !on; paint(); }
    like.disabled = false;
  };
  save.onclick = async () => {
    if (needAccount()) return;
    const on = !state.saved; state.saved = on; paint();
    try {
      const ref = doc(db, 'users', me.uid, 'saved', postId);
      if (on) await setDoc(ref, { postId, createdAt: serverTimestamp() }); else await deleteDoc(ref);
    } catch (e) { state.saved = !on; paint(); }
  };
  bars.push({ postId, state, paint });
});

onAuthStateChanged(auth, async (user) => {
  me = user; profile = null;
  if (user) {
    try { const s = await getDoc(doc(db, 'users', user.uid)); profile = s.exists() ? s.data() : null; } catch {}
  }
  renderAccount();
  for (const b of bars) {
    b.state.liked = false; b.state.saved = false;
    if (user && profile) {
      try {
        const [l, s] = await Promise.all([getDoc(doc(db, 'posts', b.postId, 'likes', user.uid)), getDoc(doc(db, 'users', user.uid, 'saved', b.postId))]);
        b.state.liked = l.exists(); b.state.saved = s.exists();
      } catch {}
    }
    b.paint();
  }
});
