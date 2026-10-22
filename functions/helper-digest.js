// Optional admin push: at most one Kemy Helper digest a day, counts only, no note text.
// Written by Lone Keem.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./push-policy');
const helper = require('./helper-policy');

const ORIGIN = 'https://lonekeem.github.io/';

function db() { return getFirestore(); }

async function adminUid() {
  const cfg = await db().doc('config/helperDigest').get();
  if (cfg.exists && cfg.get('uid')) return cfg.get('uid');
  const alerts = await db().doc('config/adminAlerts').get();
  if (alerts.exists && alerts.get('uid')) return alerts.get('uid');
  try {
    const u = await admin.auth().getUserByEmail(policy.ADMIN_EMAIL);
    return u.uid;
  } catch { return ''; }
}

const pushHelperDigest = onSchedule({ schedule: 'every 60 minutes', timeoutSeconds: 60 }, async () => {
  const uid = await adminUid();
  if (!uid) return;
  const tokens = await db().collection(`users/${uid}/fcmTokens`).get();
  const rows = tokens.docs.map((d) => ({ id: d.id, ...d.data() }));
  const best = rows.slice().sort((a, b) => {
    const am = a.updatedAt && a.updatedAt.toMillis ? a.updatedAt.toMillis() : 0;
    const bm = b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : 0;
    return bm - am;
  })[0];
  const clock = policy.clockFrom(best && best.tz, best && typeof best.tzOffset === 'number' ? best.tzOffset : undefined, new Date());
  const cfg = await db().doc('config/helperDigest').get();
  const open = await db().collection('helperReports').where('status', '==', 'open').limit(40).get();
  const decision = helper.digestDecision({ day: clock.day, lastDay: cfg.get('day') || '', openCount: open.size, hour: clock.hour });
  if (!decision.send) return;
  const real = rows.filter((t) => t.token && !t.local && !String(t.token).startsWith('emu_') && String(t.token).length > 20);
  if (real.length) {
    const body = helper.digestBody(open.size);
    try {
      await admin.messaging().sendEachForMulticast({
        tokens: real.map((t) => t.token),
        data: { title: 'Kemy Helper', body, url: 'app.html#/admin', type: 'helper', tag: 'helper-' + clock.day },
        webpush: {
          fcmOptions: { link: ORIGIN + 'app.html#/admin' },
          notification: { title: 'Kemy Helper', body, icon: ORIGIN + 'icon-192.png', tag: 'helper-' + clock.day }
        }
      });
    } catch (e) { console.error('helper digest', e.message); }
  }
  await db().doc('config/helperDigest').set({ day: clock.day, uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
});

module.exports = { pushHelperDigest };
