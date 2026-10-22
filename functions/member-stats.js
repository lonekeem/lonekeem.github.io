// Live member totals in stats/members. Auth create adds one, Auth delete subtracts one.
// Event ids make a retry count once. Recount writes the exact numbers. Written by Lone Keem.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./push-policy');

const INACTIVE_MS = 30 * 24 * 60 * 60 * 1000;
const TEST_DOMAINS = ['@example.com', '@example.org', '@test.com', '@mailinator.com'];

// Emulator runs count every account so a join/delete test can move the number.
// Production skips throwaway addresses. A real account with no email still counts.
function isRealAccount(user, env = process.env) {
  if (!user || !user.uid) return false;
  if (env.FUNCTIONS_EMULATOR === 'true' || env.FIREBASE_AUTH_EMULATOR_HOST) return true;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return true;
  if (email.startsWith('emu')) return false;
  if (email.includes('+e2e@')) return false;
  if (TEST_DOMAINS.some((d) => email.endsWith(d))) return false;
  return true;
}

function eventDocId(kind, user, eventId) {
  const created = user && user.metadata && user.metadata.creationTime || '';
  const raw = eventId ? `${kind}:${eventId}` : `${kind}:${user.uid}:${created}`;
  return String(raw).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 700);
}

function userMarkId(uid) {
  return 'user_' + String(uid || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 600);
}

// kind is 'create' (+1 total, +1 active) or 'delete' (-1 total, -1 active, +1 left).
// A delete still counts when the account existed before this counter did.
async function applyMemberDelta(user, eventId, kind, env = process.env) {
  if (kind !== 'create' && kind !== 'delete') return { ok: false };
  if (!isRealAccount(user, env)) return { skipped: true, reason: 'test' };
  const fs = getFirestore();
  const eventRef = fs.doc('memberCountEvents/' + eventDocId(kind, user, eventId));
  const userRef = fs.doc('memberCountEvents/' + userMarkId(user.uid));
  const statsRef = fs.doc('stats/members');
  await fs.runTransaction(async (t) => {
    const ev = await t.get(eventRef);
    const mark = kind === 'create' ? await t.get(userRef) : null;
    if (ev.exists) return;
    if (kind === 'create' && mark.exists && mark.get('open') === true) {
      t.set(eventRef, { kind, uid: user.uid, duplicate: true, at: FieldValue.serverTimestamp() });
      return;
    }
    t.set(eventRef, { kind, uid: user.uid, at: FieldValue.serverTimestamp() });
    if (kind === 'create') {
      t.set(userRef, { open: true, at: FieldValue.serverTimestamp() });
      t.set(statsRef, {
        total: FieldValue.increment(1),
        active: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }
    t.set(userRef, { open: false, at: FieldValue.serverTimestamp() });
    t.set(statsRef, {
      total: FieldValue.increment(-1),
      active: FieldValue.increment(-1),
      left: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { ok: true };
}

// Auth has no count(), so the exact total is a full list filtered the same way as the triggers.
// profiles, active, and left use count(). Active matches the 30-day visit used on the page.
async function runRecount(opts = {}) {
  const env = opts.env || process.env;
  const fs = getFirestore();
  let total = 0;
  let pageToken;
  do {
    const res = await admin.auth().listUsers(1000, pageToken);
    pageToken = res.pageToken;
    for (const user of res.users) if (isRealAccount(user, env)) total++;
  } while (pageToken);
  const cutoff = Timestamp.fromMillis(Date.now() - INACTIVE_MS);
  const [profilesSnap, activeSnap, leftSnap] = await Promise.all([
    fs.collection('users').count().get(),
    fs.collection('members').where('lastActive', '>=', cutoff).count().get(),
    fs.collection('leftMembers').count().get()
  ]);
  const profiles = profilesSnap.data().count || 0;
  const active = activeSnap.data().count || 0;
  const left = leftSnap.data().count || 0;
  await fs.doc('stats/members').set({
    total,
    active,
    left,
    profiles,
    lastVerified: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    source: opts.source || 'recount'
  }, { merge: true });
  return { ok: true, total, active, left, profiles };
}

const recountMembers = onCall({ timeoutSeconds: 300, memory: '512MiB' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!policy.isAdminToken(req.auth.token)) throw new HttpsError('permission-denied', 'Admins only.');
  return runRecount({ source: 'admin' });
});

module.exports = { isRealAccount, eventDocId, applyMemberDelta, runRecount, recountMembers };
