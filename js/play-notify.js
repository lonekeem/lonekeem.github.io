// Tells Keem when a signed-in Play app player opens Kemy, or signs up there.
// One note per player every 3 hours. The admin's own account is skipped.
// Signed-out visitors are never passed here. No listener: one read, then at most one batch.
// Written by Lone Keem.
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where, writeBatch } from './fsq.js';
import {
  inPlayApp, playJoinText, playNameOk, playTellDue, playToldAt, playVisitText,
  rememberPlayNoted, rememberPlayTold
} from './play-app.js';

const ADMIN_NAME = 'Kemy';
const ADMIN_KEY = 'kemy-play-admin';

function box() {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; }
}

async function findAdmin(db, self) {
  const s = box();
  const saved = s && s.getItem(ADMIN_KEY);
  if (saved && saved !== self && saved !== 'studio') return saved;
  const snap = await getDocs(query(collection(db, 'users'), where('displayName', '==', ADMIN_NAME), limit(5)));
  const hit = snap.docs.find((d) => d.id !== 'studio' && d.id !== self);
  const id = hit ? hit.id : '';
  if (id && s) s.setItem(ADMIN_KEY, id);
  return id;
}

async function stamp(db, uid) {
  await updateDoc(doc(db, 'members', uid), { playApp: true, playAppSeen: serverTimestamp() });
  rememberPlayNoted();
}

// kind: 'visit' (opened the app) or 'join' (just created the account in the app).
// Returns true when this tab session is settled (note sent, or skipped on purpose).
export async function tellPlayAdmin(db, { uid, username, displayName, admin, kind }) {
  if (!uid || !inPlayApp()) return false;
  if (admin) {
    await stamp(db, uid);
    return true;
  }
  const local = playToldAt();
  if (kind !== 'join' && local && !playTellDue(local, Date.now())) {
    await stamp(db, uid);
    return true;
  }
  const ref = doc(db, 'members', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const row = snap.data() || {};
  const name = playNameOk(username) ? username : (row.username || '');
  const shown = displayName || row.displayName || '';
  if (!playNameOk(name) || !shown) return false;
  const told = row.playTold && typeof row.playTold.toMillis === 'function' ? row.playTold.toMillis() : 0;
  if (kind === 'join' ? row.playJoined === true : !playTellDue(told, Date.now())) {
    if (told) rememberPlayTold(told);
    await stamp(db, uid);
    return true;
  }
  const to = await findAdmin(db, uid);
  if (!to) {
    await stamp(db, uid);
    return true;
  }
  const b = writeBatch(db);
  const patch = { playApp: true, playAppSeen: serverTimestamp(), playTold: serverTimestamp() };
  if (kind === 'join') patch.playJoined = true;
  b.update(ref, patch);
  b.set(doc(collection(db, 'users', to, 'notifications')), {
    type: 'play', fromUid: uid, fromName: shown, fromUsername: name, postId: '',
    text: kind === 'join' ? playJoinText(name) : playVisitText(name),
    createdAt: serverTimestamp(), read: false
  });
  try { await b.commit(); }
  catch (e) {
    if (e && e.code === 'permission-denied') {
      rememberPlayTold(Date.now());
      await stamp(db, uid).catch(() => {});
      return true;
    }
    return false;
  }
  rememberPlayTold(Date.now());
  rememberPlayNoted();
  return true;
}
