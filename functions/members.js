// Admin-only back-fill for the New Members list.
// Fills members/{uid} from Firebase Auth creation time when an older profile never got a row.
// Also stamps users/{uid}.createdAt when that field is missing. Written by Lone Keem.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./push-policy');

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
      if (existing.exists && existing.get('createdAt')) continue;
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
    filled += writes.filter((w) => /^members\/[^/]+$/.test(w.ref.path)).length;
  } while (pageToken);
  return { ok: true, filled, scanned };
});

module.exports = { backfillMembers, signupOf };
