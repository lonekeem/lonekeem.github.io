// Admin-only back-fill for the New Members list.
// Fills members/{uid} from Firebase Auth creation time when an older profile never got a row.
// Also stamps users/{uid}.createdAt when that field is missing. Written by Lone Keem.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { auth: authV1 } = require('firebase-functions/v1');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./push-policy');

async function latestVisit(fs, uid, fallback) {
  try {
    const snap = await fs.collection('users/' + uid + '/devices').orderBy('lastSeen', 'desc').limit(1).get();
    const t = snap.docs[0] && snap.docs[0].get('lastSeen');
    if (t) return t;
  } catch { /* no device list yet */ }
  return fallback || Timestamp.now();
}

// Auth delete fallback. The app writes the real note first (name, @username, join date).
// This only fills a gap, and it never copies the email.
async function writeLeftMember(user) {
  if (!user || !user.uid) return { ok: false };
  const fs = getFirestore();
  const ref = fs.doc('leftMembers/' + user.uid);
  const existing = await ref.get();
  if (existing.exists) return { ok: true, kept: true };
  const name = String(user.displayName || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const created = user.metadata && user.metadata.creationTime
    ? Timestamp.fromDate(new Date(user.metadata.creationTime))
    : Timestamp.now();
  await ref.set({
    displayName: name || 'Member',
    username: '',
    createdAt: created,
    deletedAt: Timestamp.now()
  });
  return { ok: true, kept: false };
}

const recordLeftMember = authV1.user().onDelete(async (user) => {
  try { await writeLeftMember(user); }
  catch (e) { console.error('leftMembers', e); }
});

function signupOf(user) {
  const ids = (user.providerData || []).map((p) => p.providerId);
  if (ids.includes('google.com')) return 'google';
  if (ids.includes('password')) return 'email';
  return '';
}

const backfillMembers = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!policy.isAdminToken(req.auth.token)) throw new HttpsError('permission-denied', 'Admins only.');
  const fs = getFirestore();
  let filled = 0;
  let stamped = 0;
  let scanned = 0;
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    pageToken = res.pageToken;
    const writes = [];
    for (const user of res.users) {
      scanned++;
      const ref = fs.doc('members/' + user.uid);
      const [existing, profile] = await Promise.all([ref.get(), fs.doc('users/' + user.uid).get()]);
      if (existing.exists && existing.get('createdAt')) {
        if (!existing.get('lastActive')) {
          const lastActive = await latestVisit(fs, user.uid, existing.get('createdAt'));
          writes.push({ ref, data: { lastActive }, merge: true });
        }
        continue;
      }
      const p = profile.exists ? profile.data() : null;
      if (!p || typeof p.username !== 'string' || typeof p.displayName !== 'string') continue;
      const created = user.metadata && user.metadata.creationTime
        ? Timestamp.fromDate(new Date(user.metadata.creationTime))
        : (p.createdAt || Timestamp.now());
      const photo = typeof p.photoURL === 'string' ? p.photoURL.slice(0, 500) : '';
      writes.push({
        ref,
        data: {
          displayName: String(p.displayName).slice(0, 50),
          username: String(p.username).slice(0, 20),
          displayNameLower: String(p.displayNameLower || p.displayName || '').toLowerCase().slice(0, 100),
          color: typeof p.color === 'string' && p.color ? p.color.slice(0, 20) : '#8a2be2',
          photoURL: photo,
          createdAt: created,
          lastActive: await latestVisit(fs, user.uid, created),
          signup: signupOf(user)
        }
      });
      writes.push({
        ref: fs.doc('members/' + user.uid + '/secret/email'),
        data: { email: typeof user.email === 'string' ? user.email.slice(0, 200) : '' }
      });
      if (!p.createdAt) writes.push({ ref: profile.ref, data: { createdAt: created }, merge: true });
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = fs.batch();
      writes.slice(i, i + 400).forEach((w) => batch.set(w.ref, w.data, { merge: !!w.merge }));
      await batch.commit();
    }
    filled += writes.filter((w) => /^members\/[^/]+$/.test(w.ref.path) && w.data.createdAt).length;
    stamped += writes.filter((w) => w.data && w.data.lastActive && !w.data.createdAt).length;
  } while (pageToken);
  return { ok: true, filled, stamped, scanned };
});

module.exports = { backfillMembers, signupOf, recordLeftMember, writeLeftMember };
