// Comment threads: replies (one level, like most apps) and stars on comments.
// Shared by the post page and the video comment sheet.
import {
  doc, getDoc, deleteDoc, collection, query, orderBy, limit, onSnapshot, writeBatch, serverTimestamp, increment, deleteField
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { fmtCount } from './views.js';
import * as safety from './safety.js';
import { attachComposer, mediaHtml, hydrateStickers } from './richcomments.js';

const MEDIA_LABEL = { gif: 'sent a GIF', photo: 'sent a photo', sticker: 'sent a Pal sticker' };
export const commentLabel = (c) => (c && c.text) || (c && c.media && MEDIA_LABEL[c.media.kind]) || '';

const STAR = '<svg class="star-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>';
export const commentsQuery = (db, postId) => query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(500));
const isLive = (c) => !c.deleted;

export function createComments(ctx) {
  const { db, S, esc, avatar, badge, timeAgo, linkify, toast, friendlyError, isAdmin, reportDialog, notify } = ctx;
  const likedCache = new Map(); // "postId/cid" -> bool

  async function addComment(p, text, reply, media) {
    const ref = doc(collection(db, 'posts', p.id, 'comments'));
    const b = writeBatch(db);
    const base = { authorId: S.user.uid, authorName: S.profile.displayName, authorUsername: S.profile.username, authorColor: S.profile.color, text: text.slice(0, 500), createdAt: serverTimestamp(), likeCount: 0 };
    if (media) base.media = media;
    text = text || MEDIA_LABEL[media && media.kind] || '';
    if (reply) {
      b.set(ref, { ...base, parentId: reply.parentId });
      b.update(doc(db, 'posts', p.id, 'comments', reply.parentId), { replyCount: increment(1), lastReplyId: ref.id });
    } else b.set(ref, { ...base, replyCount: 0 });
    b.update(doc(db, 'posts', p.id), { commentCount: increment(1), lastCommentId: ref.id });
    b.update(doc(db, 'users', S.user.uid), { lastCommentAt: serverTimestamp() });
    await b.commit();
    if (reply) {
      notify(reply.uid, 'reply', { postId: p.id, text });
      if (p.authorId !== reply.uid) notify(p.authorId, 'comment', { postId: p.id, text });
    } else notify(p.authorId, 'comment', { postId: p.id, text });
    return ref.id;
  }
  // Replies update their parent; a comment that still has replies becomes "Comment deleted".
  async function deleteComment(postId, c, hasReplies) {
    const b = writeBatch(db);
    const ref = doc(db, 'posts', postId, 'comments', c.id);
    if (!c.parentId && (hasReplies ?? (c.replyCount || 0) > 0)) {
      b.update(ref, { deleted: true, text: '', authorName: '', authorUsername: '', authorColor: '', media: deleteField() });
    } else {
      b.delete(ref);
      if (c.parentId) {
        const par = await getDoc(doc(db, 'posts', postId, 'comments', c.parentId)).catch(() => null);
        if (par && par.exists()) b.update(par.ref, { replyCount: increment(-1), lastReplyId: c.id });
      }
    }
    b.update(doc(db, 'posts', postId), { commentCount: increment(-1), lastCommentId: c.id });
    await b.commit();
    if (c.parentId) await tidyParent(postId, c.parentId);
  }
  // Removes a "Comment deleted" placeholder once its last reply is gone.
  async function tidyParent(postId, parentId) {
    try {
      const ref = doc(db, 'posts', postId, 'comments', parentId);
      const s = await getDoc(ref);
      if (s.exists() && s.data().deleted && !(s.data().replyCount > 0)) await deleteDoc(ref);
    } catch { /* best effort */ }
  }
  async function starComment(postId, c, on) {
    const b = writeBatch(db);
    const r = doc(db, 'posts', postId, 'comments', c.id, 'likes', S.user.uid);
    if (on) b.set(r, { uid: S.user.uid, createdAt: serverTimestamp() }); else b.delete(r);
    b.update(doc(db, 'posts', postId, 'comments', c.id), { likeCount: increment(on ? 1 : -1) });
    await b.commit();
    likedCache.set(postId + '/' + c.id, on);
    if (on) notify(c.authorId, 'comment_like', { postId, text: commentLabel(c) });
  }

  // Mounts a live thread into `box`. Returns an unsubscribe function.
  function mount({ p, box, form, input, err, onCount, cls = '' }) {
    const expanded = new Set();
    let reply = null; let last = [];
    const me = () => S.user && S.user.uid;
    const chip = form ? document.createElement('div') : null;
    if (chip) { chip.className = 'reply-chip'; chip.hidden = true; form.parentNode.insertBefore(chip, form); }
    const setReply = (r) => {
      reply = r;
      if (!chip) return;
      chip.hidden = !r;
      if (r) {
        chip.innerHTML = `<span>Replying to <b>@${esc(r.handle)}</b></span><button type="button" class="link-btn small" aria-label="Cancel reply">Cancel</button>`;
        chip.querySelector('button').onclick = () => { setReply(null); input.value = ''; input.placeholder = 'Add a comment…'; };
        input.placeholder = `Reply to @${r.handle}…`;
        if (r.mention && !input.value.startsWith('@' + r.handle)) input.value = '@' + r.handle + ' ';
        input.focus(); input.setSelectionRange(input.value.length, input.value.length);
      } else input.placeholder = 'Add a comment…';
    };
    function row(c, isReply) {
      const el = document.createElement('div');
      el.className = 'comment' + (isReply ? ' reply' : '') + (c.deleted ? ' is-deleted' : '');
      el.dataset.cid = c.id;
      if (c.deleted) {
        el.innerHTML = `<span class="avatar sm cdel-av" aria-hidden="true"></span><div class="body"><div class="text muted cdel">Comment deleted</div></div>`;
        return el;
      }
      const mine = me() && c.authorId === me();
      const canDelete = me() && (mine || isAdmin() || p.authorId === me());
      const liked = likedCache.get(p.id + '/' + c.id) === true;
      const n = Math.max(0, c.likeCount || 0);
      el.innerHTML = `${avatar({ uid: c.authorId, displayName: c.authorName, username: c.authorUsername, color: c.authorColor }, 'sm')}
        <div class="body"><div><a class="cname" href="#/u/${esc(c.authorUsername)}">${esc(c.authorName)}</a>${badge(c.authorId)} <span class="muted small">${esc(timeAgo(c.createdAt))}</span></div>
        ${c.text ? `<div class="text">${linkify(esc(c.text))}</div>` : ''}${mediaHtml(c)}
        <div class="cacts small">${me() && S.profile ? '<button type="button" class="link-btn small" data-c="reply">Reply</button>' : ''}${me() && !mine ? '<button type="button" class="link-btn small" data-c="report">Report</button>' : ''}${canDelete ? '<button type="button" class="link-btn small cdel-btn" data-c="del">Delete</button>' : ''}</div></div>
        <button type="button" class="cstar ${liked ? 'on' : ''}" data-c="star" aria-pressed="${liked}" aria-label="${liked ? 'Remove your star' : 'Give this comment a star'}">${STAR}<span class="cn">${n ? fmtCount(n) : ''}</span></button>`;
      return el;
    }
    function render(all) {
      last = all;
      const vis = all.filter((c) => c.deleted || !S.blocked.has(c.authorId));
      const tops = vis.filter((c) => !c.parentId);
      const topIds = new Set(tops.map((c) => c.id));
      const kids = new Map();
      for (const c of vis) {
        if (!c.parentId) continue;
        if (!topIds.has(c.parentId)) { tops.push(c); continue; }   // orphaned reply: show on its own
        if (!kids.has(c.parentId)) kids.set(c.parentId, []);
        kids.get(c.parentId).push(c);
      }
      onCount && onCount(all.filter(isLive).length);
      box.innerHTML = '';
      const shown = tops.filter((c) => !c.deleted || (kids.get(c.id) || []).length);
      if (!shown.length) { box.innerHTML = `<p class="muted small ${cls}" style="margin:20px 0;text-align:center">No comments yet. Be the first!</p>`; return; }
      for (const c of shown) {
        const wrap = document.createElement('div'); wrap.className = 'cthread';
        wrap.appendChild(row(c, false));
        const rs = kids.get(c.id) || [];
        if (rs.length) {
          const open = expanded.has(c.id);
          const tog = document.createElement('button');
          tog.type = 'button'; tog.className = 'link-btn small creplies-tog'; tog.dataset.toggle = c.id;
          tog.setAttribute('aria-expanded', open);
          tog.textContent = open ? 'Hide replies' : `View ${rs.length} ${rs.length === 1 ? 'reply' : 'replies'}`;
          const list = document.createElement('div'); list.className = 'creplies'; list.hidden = !open;
          rs.forEach((r) => list.appendChild(row(r, true)));
          wrap.appendChild(tog); wrap.appendChild(list);
        }
        box.appendChild(wrap);
      }
      hydrateStickers(box, db);
      // Which of these have I starred? (one read per starred comment, cached)
      if (me()) {
        const todo = vis.filter((c) => !c.deleted && (c.likeCount || 0) > 0 && !likedCache.has(p.id + '/' + c.id));
        if (todo.length) Promise.all(todo.map((c) => getDoc(doc(db, 'posts', p.id, 'comments', c.id, 'likes', me()))
          .then((s) => likedCache.set(p.id + '/' + c.id, s.exists())).catch(() => {})))
          .then(() => { if (last === all) render(all); });
      }
    }
    box.onclick = async (e) => {
      const t = e.target.closest('[data-c], [data-toggle]'); if (!t) return;
      if (t.dataset.toggle) { const id = t.dataset.toggle; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(last); return; }
      const cid = t.closest('.comment').dataset.cid; const c = last.find((x) => x.id === cid); if (!c) return;
      const a = t.dataset.c;
      if (a === 'reply') {
        const parentId = c.parentId || c.id; expanded.add(parentId);
        setReply({ parentId, handle: c.authorUsername, uid: c.authorId, mention: !!c.parentId });
      }
      if (a === 'report') reportDialog('comment', c.id, p.id, commentLabel(c) + (c.media && c.media.url ? ' ' + c.media.url : ''));
      if (a === 'del') {
        const hasReplies = !c.parentId && last.some((x) => x.parentId === c.id);
        if (!confirm(hasReplies ? 'Delete this comment? Its replies stay, under “Comment deleted”.' : 'Delete this comment?')) return;
        try { await deleteComment(p.id, c, hasReplies); toast('Comment deleted'); } catch (er) { toast(friendlyError(er)); }
      }
      if (a === 'star') {
        if (!me()) { location.hash = '#/login?next=' + encodeURIComponent(location.hash); return; }
        const on = !t.classList.contains('on'); t.disabled = true;
        // optimistic
        t.classList.toggle('on', on); t.setAttribute('aria-pressed', on);
        const cn = t.querySelector('.cn'); const n = Math.max(0, (c.likeCount || 0) + (on ? 1 : -1)); cn.textContent = n ? fmtCount(n) : '';
        const key = p.id + '/' + c.id; const was = likedCache.get(key) === true;
        likedCache.set(key, on);   // before the write, so snapshot re-renders keep the new state
        try { await starComment(p.id, c, on); }
        catch (er) { likedCache.set(key, was); render(last); toast(friendlyError(er)); }
        t.disabled = false;
      }
    };
    const unsub = onSnapshot(commentsQuery(db, p.id), (qs) => render(qs.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => { box.innerHTML = `<p class="muted small">${esc(friendlyError(e))}</p>`; });
    const rc = form ? attachComposer({ form, input, S, db, toast }) : null;
    if (form) form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (rc && rc.busy) { toast('Wait for the photo to finish uploading.'); return; }
      const text = input.value.trim(); const media = rc && rc.media; if (!text && !media) return;
      if (err) err.textContent = '';
      const btn = form.querySelector('button[type=submit], button:not([type])'); if (btn) btn.disabled = true;
      try {
        const r = reply && last.some((x) => x.id === reply.parentId && !x.deleted) ? reply : null;
        if (reply && !r) throw Object.assign(new Error('That comment was deleted.'), { code: 'gone' });
        if (!(await safety.gate())) { if (btn) btn.disabled = false; return; }
        if (text && !safety.piiOk(text)) { if (btn) btn.disabled = false; return; }
        await addComment(p, text, r, media);
        safety.scanAge(text, 'comment', p.id, p.id);
        input.value = ''; rc && rc.clear(); setReply(null);
      } catch (e2) {
        if (err) err.textContent = e2.code === 'permission-denied' ? 'Please wait a few seconds between comments.' : e2.code === 'gone' ? 'That comment was deleted, so you can’t reply to it.' : friendlyError(e2);
      }
      if (btn) btn.disabled = false;
    };
    return () => { unsub(); chip && chip.remove(); if (rc) { rc.bar.remove(); form.__rc = null; } };
  }
  return { mount, addComment, deleteComment, starComment, tidyParent };
}
