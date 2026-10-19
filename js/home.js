// Homepage add-ons: header account button + like / comment / save bar on studio videos.
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, onSnapshot, writeBatch, setDoc, deleteDoc, serverTimestamp, increment
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (n) => { const p = String(n || '?').trim().split(/\s+/); return ((p[0]?.[0] || '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
let me = null, profile = null;

const slot = document.getElementById('account-slot');
function renderAccount() {
  if (!slot) return;
  if (me && profile) {
    const color = /^#[0-9a-f]{3,8}$/i.test(profile.color || '') ? profile.color : '#8a2be2';
    slot.innerHTML = `<a class="acct-btn" href="app.html#/feed" aria-label="Open the community"><span class="acct-label">Community</span><span class="acct-avatar" style="--c:${color}">${esc(initials(profile.displayName))}</span></a>`;
  } else if (me) {
    slot.innerHTML = `<a class="acct-pill" href="app.html#/onboard">Finish sign-up</a>`;
  } else {
    slot.innerHTML = `<a class="acct-pill" href="app.html#/login"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>Sign in</a>`;
  }
}

const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
const BUBBLE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>';
const MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.5-7 4.5v-16a1 1 0 0 1 1-1z"/></svg>';

const bars = [];
document.querySelectorAll('[data-post-id]').forEach((card) => {
  const postId = card.dataset.postId;
  const bar = document.createElement('div');
  bar.className = 'social-bar';
  bar.innerHTML = `
    <button class="soc like" aria-pressed="false" aria-label="Like">${HEART}<span class="n">0</span></button>
    <a class="soc" href="app.html#/post/${esc(postId)}" aria-label="Comments">${BUBBLE}<span class="c">0</span></a>
    <button class="soc save" aria-pressed="false" aria-label="Save to favorites">${MARK}</button>`;
  card.querySelector('.info').appendChild(bar);
  const like = bar.querySelector('.like'), save = bar.querySelector('.save');
  const state = { liked: false, saved: false, count: 0 };
  const paint = () => {
    like.classList.toggle('on', state.liked); like.setAttribute('aria-pressed', state.liked);
    save.classList.toggle('on', state.saved); save.setAttribute('aria-pressed', state.saved);
  };
  onSnapshot(doc(db, 'posts', postId), (d) => {
    if (!d.exists()) return;
    bar.querySelector('.n').textContent = d.data().likeCount || 0;
    bar.querySelector('.c').textContent = d.data().commentCount || 0;
  }, () => {});
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
