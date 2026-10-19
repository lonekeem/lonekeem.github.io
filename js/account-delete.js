// Delete your own account, from Edit profile.
// Everything runs in the browser under your own sign-in; the Firestore rules only let you remove
// your own data. Media files on Cloudinary can't be deleted from a browser (that needs the
// secret key), so they stay on the media host but nothing in the app links to them any more.
import {
  EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, deleteUser, signOut
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, getDocs, collection, collectionGroup, query, where, limit, writeBatch, increment, deleteDoc
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const PAGE = 300;          // docs fetched per query page
const BATCH = 450;         // writes per batch (Firestore max is 500)

export function createAccountDeleter({ auth, db, esc, openModal, closeModal, friendlyError, isProtected, beforeDelete }) {
  // --- helpers
  async function deleteRefs(refs, extra) {
    for (let i = 0; i < refs.length || (extra && i === 0); i += BATCH) {
      const b = writeBatch(db);
      if (extra && i === 0) extra(b);
      refs.slice(i, i + BATCH).forEach((r) => b.delete(r));
      await b.commit();
    }
  }
  // Repeats a query until nothing new is left (each pass deletes what it found; docs that
  // stay, like a blanked "Comment deleted" placeholder, are skipped the next time round).
  async function drain(q, onDocs) {
    const seen = new Set();
    for (let guard = 0; guard < 200; guard++) {
      const s = await getDocs(query(q, limit(PAGE)));
      const fresh = s.docs.filter((d) => !seen.has(d.ref.path));
      if (!fresh.length) return;
      fresh.forEach((d) => seen.add(d.ref.path));
      await onDocs(fresh);
      if (s.size < PAGE) return;
    }
  }
  const sub = async (path) => (await getDocs(collection(db, ...path))).docs.map((d) => d.ref);

  async function run(uid, username, progress) {
    const errors = [];
    const step = async (label, fn) => { progress(label); try { await fn(); } catch (e) { console.warn('delete step failed:', label, e); errors.push(label); } };
    let ownPosts = new Set();

    await step('Ending your live sessions…', () => drain(query(collection(db, 'lives'), where('hostId', '==', uid)), async (docs) => {
      for (const d of docs) {
        const refs = [];
        for (const c of ['chat', 'viewers', 'conns', 'answers']) refs.push(...await sub(['lives', d.id, c]).catch(() => []));
        await deleteRefs(refs);
        await deleteDoc(d.ref);
      }
    }));
    await step('Deleting your stories…', () => drain(query(collection(db, 'stories'), where('authorId', '==', uid)), async (docs) => {
      for (const d of docs) { await deleteRefs(await sub(['stories', d.id, 'viewers']).catch(() => [])); await deleteDoc(d.ref); }
    }));
    await step('Deleting your posts…', () => drain(query(collection(db, 'posts'), where('authorId', '==', uid)), async (docs) => {
      for (const d of docs) {
        ownPosts.add(d.id);
        const refs = [];
        for (const c of ['likes', 'comments', 'views']) refs.push(...await sub(['posts', d.id, c]).catch(() => []));
        // stars on the comments under it
        for (const r of refs.filter((x) => x.parent.id === 'comments')) refs.push(...await sub(['posts', d.id, 'comments', r.id, 'likes']).catch(() => []));
        // The post goes in the first batch, so the rules see it as deleted for its leftovers.
        await deleteRefs(refs, (b) => b.delete(d.ref));
      }
    }));
    await step('Removing your stars on posts and comments…', () => drain(query(collectionGroup(db, 'likes'), where('uid', '==', uid)), async (docs) => {
      for (const d of docs) {
        const target = d.ref.parent.parent;           // the post or comment that was starred
        const b = writeBatch(db); b.delete(d.ref); b.update(target, { likeCount: increment(-1) });
        try { await b.commit(); } catch { await deleteDoc(d.ref).catch(() => {}); }   // target already gone
      }
    }));
    await step('Removing your comments and replies…', () => drain(query(collectionGroup(db, 'comments'), where('authorId', '==', uid)), async (docs) => {
      // Replies first, so their parent counts are right before parents are handled.
      const sorted = [...docs].sort((a, b) => (b.data().parentId ? 1 : 0) - (a.data().parentId ? 1 : 0));
      for (const d of sorted) {
        const c = d.data();
        if (c.deleted) continue;                        // already a blank placeholder
        const postRef = d.ref.parent.parent;
        if (ownPosts.has(postRef.id)) continue;
        const likes = await sub(['posts', postRef.id, 'comments', d.id, 'likes']).catch(() => []);
        const b = writeBatch(db);
        const replies = c.parentId ? 0 : (await getDocs(query(collection(db, 'posts', postRef.id, 'comments'), where('parentId', '==', d.id), limit(1)))).size;
        if (replies) {
          // Others replied: leave a blank "Comment deleted" so their replies keep their place.
          b.update(d.ref, { deleted: true, text: '', authorName: '', authorUsername: '', authorColor: '' });
        } else {
          b.delete(d.ref);
          likes.slice(0, BATCH - 5).forEach((r) => b.delete(r));
          if (c.parentId) b.update(doc(db, 'posts', postRef.id, 'comments', c.parentId), { replyCount: increment(-1), lastReplyId: d.id });
        }
        b.update(postRef, { commentCount: increment(-1), lastCommentId: d.id });
        try {
          await b.commit();
          if (c.parentId) {   // tidy a "Comment deleted" placeholder left with no replies
            const pr = doc(db, 'posts', postRef.id, 'comments', c.parentId);
            const ps = await getDoc(pr).catch(() => null);
            if (ps && ps.exists() && ps.data().deleted && !(ps.data().replyCount > 0)) await deleteDoc(pr).catch(() => {});
          }
        }
        catch {
          // Parent comment or post already gone: try the simpler forms.
          const b2 = writeBatch(db); b2.delete(d.ref); b2.update(postRef, { commentCount: increment(-1), lastCommentId: d.id });
          try { await b2.commit(); } catch { await deleteDoc(d.ref).catch(() => {}); }
        }
      }
    }));
    await step('Removing notifications you sent…', () => drain(query(collectionGroup(db, 'notifications'), where('fromUid', '==', uid)), (docs) => deleteRefs(docs.map((d) => d.ref))));
    await step('Removing follows…', async () => {
      await drain(query(collection(db, 'follows'), where('follower', '==', uid)), (docs) => deleteRefs(docs.map((d) => d.ref)));
      await drain(query(collection(db, 'follows'), where('followee', '==', uid)), (docs) => deleteRefs(docs.map((d) => d.ref)));
    });
    await step('Removing your Pals…', async () => {
      for (const pet of await sub(['users', uid, 'pets']).catch(() => [])) await deleteRefs([...await sub(['users', uid, 'pets', pet.id, 'pats']).catch(() => []), ...await sub(['users', uid, 'pets', pet.id, 'playdates']).catch(() => [])], (b) => b.delete(pet));
    });
    await step('Clearing saved posts, blocks and notifications…', async () => {
      for (const c of ['saved', 'blocks', 'notifications']) await drain(collection(db, 'users', uid, c), (docs) => deleteRefs(docs.map((d) => d.ref)));
    });
    // Profile + @handle together (the rules release the handle only with the profile).
    let profileGone = false;
    await step('Deleting your profile…', async () => {
      const b = writeBatch(db);
      b.delete(doc(db, 'users', uid));
      if (username) b.delete(doc(db, 'usernames', username));
      await b.commit(); profileGone = true;
    });
    if (profileGone) await step('Deleting your messages…', () => drain(query(collection(db, 'chats'), where('participants', 'array-contains', uid)), async (docs) => {
      for (const d of docs) await deleteRefs(await sub(['chats', d.id, 'messages']), (b) => b.delete(d.ref));
    }));
    return { errors, profileGone };
  }

  // --- re-authentication (Firebase only deletes accounts after a recent sign-in)
  const hasPassword = (u) => u.providerData.some((p) => p.providerId === 'password');
  const hasGoogle = (u) => u.providerData.some((p) => p.providerId === 'google.com');
  async function reauth(user, password) {
    if (hasPassword(user)) return reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    if (hasGoogle(user)) return reauthenticateWithPopup(user, new GoogleAuthProvider());
  }

  function open(profile) {
    const user = auth.currentUser;
    if (!user || isProtected(user)) return;
    const handle = profile.username || '';
    const pw = hasPassword(user);
    openModal(`
      <button class="icon-btn close" data-close aria-label="Close">✕</button>
      <h2 class="del-title">Delete your account?</h2>
      <p class="muted small">This can’t be undone. We’ll permanently delete:</p>
      <ul class="del-list small">
        <li>Your profile, <b>@${esc(handle)}</b> handle and photo link</li>
        <li>Your posts and stories, with their comments, stars and views</li>
        <li>Your comments on other people’s posts</li>
        <li>Your follows and followers, saved posts, blocks and notifications</li>
        <li>Your Pals, their pats and play dates</li>
        <li>Your live sessions and your message threads</li>
        <li>Your login</li>
      </ul>
      <p class="muted small">Photos and videos you uploaded stop showing in the app. To have the files themselves removed from our media host, email <a href="mailto:lillykemoy1@gmail.com?subject=Remove%20my%20media%20files">the admin</a>.</p>
      <form id="del-form" autocomplete="off">
        <div class="field"><label for="del-confirm">Type <b>@${esc(handle)}</b> or <b>DELETE</b> to confirm</label>
          <input id="del-confirm" type="text" autocapitalize="none" spellcheck="false" autocomplete="off" required></div>
        ${pw ? `<div class="field"><label for="del-pass">Your password</label><input id="del-pass" type="password" autocomplete="current-password" required></div>`
             : `<p class="muted small">You’ll be asked to sign in with Google again to confirm.</p>`}
        <p class="form-error" id="del-err" role="alert"></p>
        <p class="small muted" id="del-progress" aria-live="polite"></p>
        <div class="row" style="gap:8px;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" data-close>Cancel</button>
        <button class="btn btn-sm btn-danger btn-danger-solid" id="del-go" type="submit" disabled>Delete my account</button></div>
      </form>`);
    const inp = document.getElementById('del-confirm'), go = document.getElementById('del-go'), err = document.getElementById('del-err'), prog = document.getElementById('del-progress');
    const okText = () => { const v = inp.value.trim(); return v === 'DELETE' || v.toLowerCase().replace(/^@/, '') === handle.toLowerCase(); };
    inp.addEventListener('input', () => { go.disabled = !okText(); });
    document.getElementById('del-form').onsubmit = async (e) => {
      e.preventDefault(); err.textContent = '';
      if (!okText()) { err.textContent = `Type @${handle} or DELETE to confirm.`; return; }
      go.disabled = true; inp.disabled = true;
      const lock = () => document.querySelectorAll('#modal-root [data-close]').forEach((b) => (b.disabled = true));
      try {
        prog.textContent = 'Checking it’s you…';
        await reauth(user, pw ? document.getElementById('del-pass').value : '');
      } catch (e2) { prog.textContent = ''; err.textContent = friendlyError(e2); go.disabled = false; inp.disabled = false; return; }
      lock();
      beforeDelete && beforeDelete();
      const uid = user.uid;
      const { errors, profileGone } = await run(uid, handle, (t) => (prog.textContent = t));
      if (!profileGone) { err.textContent = 'We couldn’t delete your profile. Nothing else will be removed from your login. Please try again.'; go.disabled = false; return; }
      prog.textContent = 'Deleting your login…';
      try { await deleteUser(user); }
      catch (e3) {
        if (e3.code === 'auth/requires-recent-login') {
          try { await reauth(user, pw ? document.getElementById('del-pass').value : ''); await deleteUser(user); }
          catch (e4) { err.textContent = 'Your data is deleted, but we couldn’t remove your login: ' + friendlyError(e4); return; }
        } else { err.textContent = 'Your data is deleted, but we couldn’t remove your login: ' + friendlyError(e3); return; }
      }
      try { sessionStorage.setItem('lks-notice', errors.length ? 'Your account was deleted. A few items couldn’t be removed; email the admin if you want them gone.' : 'Your account was deleted.'); } catch {}
      await signOut(auth).catch(() => {});
      closeModal();
      location.replace('index.html');
    };
  }
  return { open, run };
}
