// Sends Kemy web pushes. Triggers cover invites, house visits and turns. The daily reminder
// is scheduled. Announcements are an admin-only callable gated by ADMIN_EMAIL.
// Tokens live in users/{uid}/fcmTokens. Quota lives in users/{uid}/pushQuota/state (Admin SDK only).
// Written by Lone Keem.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./push-policy');

const ORIGIN = 'https://lonekeem.github.io/';
const BAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

function db() { return getFirestore(); }

function realTokens(rows) {
  return rows.filter((t) => t.token && !t.local && !String(t.token).startsWith('emu_') && String(t.token).length > 20);
}

async function prefsOf(uid) {
  const s = await db().doc(`users/${uid}/prefs/push`).get();
  return s.exists ? s.data() : null;
}
async function tokensOf(uid) {
  const qs = await db().collection(`users/${uid}/fcmTokens`).get();
  return qs.docs.map((d) => ({ id: d.id, ...d.data() }));
}
function clockOf(tokens, now) {
  let best = null, bestMs = -1;
  for (const t of tokens) {
    const ms = t.updatedAt && typeof t.updatedAt.toMillis === 'function' ? t.updatedAt.toMillis() : 0;
    if (ms >= bestMs) { best = t; bestMs = ms; }
  }
  return policy.clockFrom(best && best.tz, best && typeof best.tzOffset === 'number' ? best.tzOffset : undefined, now);
}

async function reserve(uid, type, clock) {
  const ref = db().doc(`users/${uid}/pushQuota/state`);
  return db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const decision = policy.decideSend({ type, hour: clock.hour, day: clock.day, quota: s.exists ? s.data() : {} });
    if (decision.ok && decision.next) tx.set(ref, decision.next, { merge: true });
    return decision;
  });
}
async function refund(uid, type, day) {
  const ref = db().doc(`users/${uid}/pushQuota/state`);
  await db().runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return;
    const q = s.data();
    if (q.day !== day) return;
    tx.set(ref, {
      day,
      n: Math.max(0, (Number(q.n) || 0) - 1),
      lastDaily: type === 'daily' && q.lastDaily === day ? '' : (q.lastDaily || '')
    }, { merge: true });
  }).catch((e) => console.error('push refund', e.message));
}

async function deliver(uid, tokens, msg) {
  const real = realTokens(tokens);
  if (!real.length) return { ok: true, local: true, delivered: 0 };
  const link = ORIGIN + msg.url.replace(/^\//, '');
  let res;
  try {
    res = await admin.messaging().sendEachForMulticast({
      tokens: real.map((t) => t.token),
      data: { title: msg.title, body: msg.body, url: msg.url, type: msg.type, tag: msg.tag || msg.type },
      webpush: {
        headers: { Urgency: msg.type === 'turn' ? 'high' : 'normal' },
        fcmOptions: { link },
        notification: {
          title: msg.title,
          body: msg.body,
          icon: ORIGIN + 'icon-192.png',
          badge: ORIGIN + 'favicon-32.png',
          tag: msg.tag || msg.type,
          renotify: msg.type === 'turn'
        }
      }
    });
  } catch (e) {
    console.error('push send', e.message);
    return { ok: false, reason: 'send' };
  }
  await Promise.all(res.responses.map((r, i) => {
    if (r.success) return null;
    const code = r.error && r.error.code;
    if (!BAD_TOKEN.has(code)) return null;
    return db().doc(`users/${uid}/fcmTokens/${real[i].id}`).delete().catch(() => {});
  }));
  const delivered = res.successCount || 0;
  return delivered ? { ok: true, delivered } : { ok: false, reason: 'send' };
}

async function writeInbox(uid, msg) {
  if (!msg.inbox) return;
  await db().collection(`users/${uid}/notifications`).add({
    type: msg.type, fromUid: 'studio', fromName: 'Kemy', fromUsername: 'kemy',
    postId: policy.hashOnly(msg.url), text: policy.clip(msg.body, 140),
    createdAt: FieldValue.serverTimestamp(), read: false
  });
}

// Opt-in, per-type switch, quiet hours and the daily cap all live here.
async function sendToUser(uid, msg) {
  if (!uid || !msg || !msg.type) return { ok: false, reason: 'bad' };
  const pref = await prefsOf(uid);
  if (!pref || pref.enabled !== true || pref[msg.type] === false) return { ok: false, reason: 'off' };
  const tokens = await tokensOf(uid);
  if (!tokens.length) return { ok: false, reason: 'no-token' };
  const clock = clockOf(tokens);
  const decision = await reserve(uid, msg.type, clock);
  if (!decision.ok) return decision;
  const sent = await deliver(uid, tokens, msg);
  if (!sent.ok) {
    if (decision.next) await refund(uid, msg.type, clock.day);
    return sent;
  }
  try { await writeInbox(uid, msg); } catch (e) { console.error('push inbox', e.message); }
  return { ok: true, delivered: sent.delivered || 0, local: !!sent.local };
}

const pushInbox = onDocumentCreated('users/{uid}/notifications/{nid}', async (event) => {
  const n = event.data && event.data.data();
  const msg = policy.inboxPush(n);
  if (!msg) return;
  await sendToUser(event.params.uid, msg);
});

const pushTurn = onDocumentUpdated('games/{gid}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const uid = policy.turnRecipient(before, after);
  if (!uid) return;
  await sendToUser(uid, policy.turnMessage(after, event.params.gid));
});

const pushDailyReady = onSchedule({ schedule: 'every 60 minutes', timeoutSeconds: 120 }, async () => {
  const qs = await db().collectionGroup('prefs').where('enabled', '==', true).get();
  const utcDay = Math.floor(Date.now() / 86400000);
  for (const doc of qs.docs) {
    if (doc.id !== 'push' || doc.get('daily') === false) continue;
    const parent = doc.ref.parent && doc.ref.parent.parent;
    const uid = parent && parent.id;
    if (!uid) continue;
    try {
      const w = await db().doc(`users/${uid}/pal/wallet`).get();
      if (w.exists && w.get('day') === utcDay && ((w.get('earned') || {}).daily > 0)) continue;
      await sendToUser(uid, {
        type: 'daily', title: 'Daily Star Coins', body: 'Your daily Star Coins are ready.',
        url: 'app.html#/pals', tag: 'daily-' + utcDay, inbox: true
      });
    } catch (e) { console.error('daily', uid, e.message); }
  }
});

const sendAnnouncement = onCall({ timeoutSeconds: 120 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (!policy.isAdminToken(req.auth.token)) throw new HttpsError('permission-denied', 'Admins only.');
  const built = policy.buildAnnouncement(req.data || {});
  if (built.error) throw new HttpsError('invalid-argument', built.error);
  const qs = await db().collectionGroup('prefs').where('enabled', '==', true).get();
  let sent = 0, skipped = 0;
  for (const doc of qs.docs) {
    const parent = doc.ref.parent && doc.ref.parent.parent;
    const uid = parent && parent.id;
    if (doc.id !== 'push' || doc.get('announce') === false || !uid) { skipped++; continue; }
    try {
      const r = await sendToUser(uid, {
        type: 'announce', title: built.title, body: built.body, url: built.path, tag: 'announce', inbox: true
      });
      if (r.ok) sent++; else skipped++;
    } catch (e) { skipped++; console.error('announce', uid, e.message); }
  }
  return { ok: true, sent, skipped };
});

module.exports = { pushInbox, pushTurn, pushDailyReady, sendAnnouncement };
