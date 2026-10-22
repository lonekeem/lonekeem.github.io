// Server moderation for Kemy chat. Watches real chat writes, masks or removes
// what should not be stored, records a strike, and pauses chat for 10 minutes
// after a repeat. Never bans. Serious notes ping Keem. Written by Lone Keem.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const policy = require('./mod-policy');
const pushPolicy = require('./push-policy');

const ORIGIN = 'https://lonekeem.github.io/';
const keemCache = new Map();

function db() { return getFirestore(); }

async function isKeem(uid) {
  if (!uid) return false;
  if (keemCache.has(uid)) return keemCache.get(uid);
  let yes = false;
  try {
    const u = await admin.auth().getUser(uid);
    yes = u.email === pushPolicy.ADMIN_EMAIL;
  } catch { yes = false; }
  keemCache.set(uid, yes);
  return yes;
}

async function adminUid() {
  const cfg = await db().doc('config/helperDigest').get();
  if (cfg.exists && cfg.get('uid')) return cfg.get('uid');
  const alerts = await db().doc('config/adminAlerts').get();
  if (alerts.exists && alerts.get('uid')) return alerts.get('uid');
  try {
    const u = await admin.auth().getUserByEmail(pushPolicy.ADMIN_EMAIL);
    return u.uid;
  } catch { return ''; }
}

async function placeMute(uid, ms) {
  const ref = db().doc('bans/' + uid);
  const cur = await ref.get();
  const untilMs = Date.now() + ms;
  if (cur.exists) {
    const c = cur.data() || {};
    if (c.permanent === true || c.hide === true) return;
    const until = c.until && typeof c.until.toMillis === 'function' ? c.until.toMillis() : 0;
    if (until > untilMs) return;
  }
  const user = await db().doc('users/' + uid).get();
  const u = user.exists ? user.data() : {};
  await ref.set({
    until: Timestamp.fromMillis(untilMs),
    reason: policy.WARN + ' Chat is paused for 10 minutes.',
    permanent: false,
    hide: false,
    by: 'kemy-helper',
    at: FieldValue.serverTimestamp(),
    name: String(u.displayName || '').slice(0, 60),
    uname: String(u.username || '').slice(0, 30)
  });
}

async function tellKeem(uid, info) {
  const adminId = await adminUid();
  const kind = String(info.kind || 'report').slice(0, 24);
  const nice = {
    grief: 'someone may be blocking a spawn',
    name: 'a name needs a look',
    slur: 'a mean word in chat',
    sexual: 'something not for kids',
    violent: 'a scary message',
    phone: 'a phone number in chat',
    email: 'an email address in chat',
    address: 'an address in chat',
    social: 'a social handle in chat',
    harass: 'repeated messages at one player',
    spam: 'a flood of messages',
    word: 'mean words in chat',
    link: 'a link in chat'
  };
  const reason = ('Kemy Helper: ' + (nice[kind] || 'a report needs you') + '.').slice(0, 500);
  await db().collection('reports').add({
    reporterId: uid,
    targetType: 'user',
    targetId: uid,
    targetUid: uid,
    postId: '',
    reason,
    excerpt: '',
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
    serious: true
  });
  if (!adminId || adminId === uid) return;
  const body = 'Kemy Helper: a serious report needs you.';
  await db().collection('users/' + adminId + '/notifications').add({
    type: 'mod',
    fromUid: 'studio',
    fromName: 'Kemy Helper',
    fromUsername: '',
    postId: '',
    text: body,
    createdAt: FieldValue.serverTimestamp(),
    read: false
  });
  try {
    const tokens = await db().collection('users/' + adminId + '/fcmTokens').get();
    const real = tokens.docs.map((d) => d.data()).filter((t) => t.token && !t.local && !String(t.token).startsWith('emu_') && String(t.token).length > 20);
    if (!real.length) return;
    await admin.messaging().sendEachForMulticast({
      tokens: real.map((t) => t.token),
      data: { title: 'Kemy Helper', body, url: 'app.html#/admin', type: 'helper', tag: 'helper-mod' },
      webpush: {
        fcmOptions: { link: ORIGIN + 'app.html#/admin' },
        notification: { title: 'Kemy Helper', body, icon: ORIGIN + 'icon-192.png', tag: 'helper-mod' }
      }
    });
  } catch (e) { console.error('helper mod notify', e.message); }
}

async function apply(uid, scan, extra) {
  if (!uid || uid === 'studio') return;
  if (await isKeem(uid)) return;
  const ref = db().doc('helperStrikes/' + uid);
  const now = Date.now();
  let alert = null;
  let muteMs = 0;
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? snap.data() : {};
    if (scan.action === 'care' || scan.kind === 'care') {
      tx.set(ref, { care: true, careAt: now, ban: false }, { merge: true });
      return;
    }
    const area = extra.area || '';
    const msgKey = area === 'game' ? 'gameMsgs' : 'msgs';
    const max = area === 'game' ? 20 : 8;
    const prev = Array.isArray(d[msgKey]) ? d[msgKey] : [];
    const msgs = prev.filter((t) => now - t < 30000);
    msgs.push(now);
    let targets = Array.isArray(d.targets) ? d.targets.filter((e) => e && now - e.at < 600000) : [];
    if (extra.target && scan.strike) targets.push({ id: String(extra.target).slice(0, 128), at: now });
    targets = targets.slice(-12);
    const flooded = policy.flood(msgs, now, max);
    const har = policy.harass(targets, now);
    const strike = !!(scan.strike || flooded.bad || har.bad);
    const base = { [msgKey]: msgs.slice(-12), targets, ban: false };
    if (!strike) { tx.set(ref, base, { merge: true }); return; }
    const recent = (Array.isArray(d.recent) ? d.recent : []).filter((t) => now - t < policy.STRIKE_WINDOW_MS);
    const decision = policy.nextStep(recent.length);
    recent.push(now);
    const serious = !!(scan.serious || flooded.bad || har.bad);
    const kind = scan.kind && scan.kind !== 'ok' ? scan.kind : (har.bad ? 'harass' : 'spam');
    const patch = Object.assign({}, base, {
      n: (Number(d.n) || 0) + 1,
      recent: recent.slice(-10),
      warn: decision.step === 'warn',
      warnAt: now,
      lastKind: String(kind).slice(0, 24),
      serious,
      muteUntil: decision.muteMs ? now + decision.muteMs : (Number(d.muteUntil) || 0),
      ban: false
    });
    if (serious && !(d.alertAt && now - d.alertAt < 600000)) {
      patch.alertAt = now;
      alert = { kind, area };
    }
    if (decision.muteMs) muteMs = decision.muteMs;
    tx.set(ref, patch, { merge: true });
  });
  if (muteMs) await placeMute(uid, muteMs);
  if (alert) await tellKeem(uid, alert);
}

async function handleMessage(uid, text, ref, field, target, area, alwaysDelete) {
  const scan = policy.scan(text || '');
  if (ref && alwaysDelete) await ref.delete().catch(() => {});
  else if (ref && scan.action === 'mask') await ref.update({ [field]: scan.text }).catch(() => {});
  else if (ref && (scan.action === 'block' || scan.action === 'care')) await ref.delete().catch(() => {});
  await apply(uid, scan, { target: target || '', area: area || 'chat' });
}

const moderateDm = onDocumentCreated('chats/{chatId}/messages/{mid}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.senderId) return;
  const parts = String(event.params.chatId || '').split('_');
  const target = parts.find((p) => p && p !== d.senderId) || '';
  await handleMessage(d.senderId, d.text, event.data.ref, 'text', target, 'dm', false);
});

const moderateLive = onDocumentCreated('lives/{liveId}/chat/{cid}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || d.type === 'star' || !d.authorId) return;
  await handleMessage(d.authorId, d.text, event.data.ref, 'text', '', 'live', false);
});

const moderateComment = onDocumentCreated('posts/{postId}/comments/{cid}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.authorId) return;
  await handleMessage(d.authorId, d.text, event.data.ref, 'text', '', 'comment', false);
});

const moderateGame = onDocumentCreated('games/{gid}/chat/{cid}', async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.uid) return;
  await apply(d.uid, { action: 'ok', kind: 'ok', strike: false, serious: false, ban: false }, { area: 'game' });
});

const moderateWorld = onDocumentCreated('worldChat/{id}', async (event) => {
  const d = (event.data && event.data.data()) || {};
  const ref = event.data && event.data.ref;
  if (!d.uid) { if (ref) await ref.delete().catch(() => {}); return; }
  if (d.area === 'grief') {
    const g = policy.grief(Number(d.still) || 0);
    if (g.flag) await apply(d.uid, { action: 'block', kind: 'grief', strike: true, serious: true, ban: false }, { area: 'grief' });
    if (ref) await ref.delete().catch(() => {});
    return;
  }
  if (d.area === 'name') {
    if (policy.nameProblem(d.text)) await apply(d.uid, { action: 'block', kind: 'name', strike: true, serious: true, ban: false }, { area: 'name' });
    if (ref) await ref.delete().catch(() => {});
    return;
  }
  await handleMessage(d.uid, d.text, ref, 'text', d.target || '', d.area || 'park', true);
});

module.exports = { moderateDm, moderateLive, moderateComment, moderateGame, moderateWorld };
