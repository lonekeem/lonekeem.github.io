// Kemy paid credit. Wallets: users/{uid}/pal/wallet {coins,...} and users/{uid}/pal/diamonds {d,...}.
// Only the Admin SDK (here) may raise balances beyond the capped earning rules in firestore.rules.
// Writes stay within the key sets allowed by walletShape()/dShape() so later client writes still pass.
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const PACKS = require('./packs');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const db = admin.firestore();
const { FieldValue: FV } = require('firebase-admin/firestore');
const PKG = 'com.lonekeemstudios.kemy';
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// Optional: Stripe price id / payment link id -> pack id (used if the session has no metadata.pack).
const STRIPE_MAP = {};

const dayNo = () => Math.floor(Date.now() / 86400000);
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 1400);

// Idempotent: purchases/{id} is created in the same transaction as the credit.
async function credit(uid, sku, purchaseId, provider, extra = {}) {
  const pack = PACKS[sku]; if (!pack) throw new Error('unknown sku ' + sku);
  const pref = db.doc('purchases/' + safeId(purchaseId));
  const wref = db.doc(`users/${uid}/pal/${pack.cur === 'star' ? 'wallet' : 'diamonds'}`);
  return db.runTransaction(async (t) => {
    const [p, w] = await Promise.all([t.get(pref), t.get(wref)]);
    if (p.exists) return { credited: false, already: true, uid: p.data().uid };
    const now = FV.serverTimestamp();
    if (pack.cur === 'star') {
      if (w.exists) t.update(wref, { coins: FV.increment(pack.n), updatedAt: now });
      else t.set(wref, { coins: pack.n, total: 0, day: dayNo(), earned: {}, src: '', last: now, lastBuy: '', paid: 0, buyAt: now, room: [], updatedAt: now });
    } else {
      if (w.exists) t.update(wref, { d: FV.increment(pack.n), updatedAt: now });
      else t.set(wref, { d: pack.n, total: 0, day: dayNo(), today: 0, last: now, lastBuy: '', paid: 0, buyAt: now, updatedAt: now });
    }
    t.set(pref, { uid, sku, cur: pack.cur, n: pack.n, provider, at: now, ...extra });
    return { credited: true, cur: pack.cur, n: pack.n };
  });
}

async function playApi() {
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  return google.androidpublisher({ version: 'v3', auth });
}

exports.verifyPlayPurchase = onCall({ enforceAppCheck: false }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const { sku, purchaseToken } = req.data || {};
  if (!PACKS[sku] || typeof purchaseToken !== 'string' || purchaseToken.length < 10 || purchaseToken.length > 4096)
    throw new HttpsError('invalid-argument', 'Bad sku or purchaseToken.');
  const uid = req.auth.uid;
  let ap, r;
  try { ap = await playApi(); r = (await ap.purchases.products.get({ packageName: PKG, productId: sku, token: purchaseToken })).data; }
  catch (e) {
    const code = e.code || (e.response && e.response.status);
    console.error('play verify failed', code, e.message);
    if (code === 401 || code === 403) throw new HttpsError('failed-precondition', 'Google Play verification is not set up yet (service account not linked in Play Console API access). Nothing was charged to your wallet; contact support.');
    if (code === 404 || code === 400) throw new HttpsError('not-found', 'Purchase not found on Google Play.');
    throw new HttpsError('unavailable', 'Could not reach Google Play. Try again.');
  }
  if (r.purchaseState !== 0) throw new HttpsError('failed-precondition', r.purchaseState === 2 ? 'Purchase is still pending.' : 'Purchase was cancelled.');
  const res = await credit(uid, sku, 'play_' + purchaseToken, 'play', { orderId: r.orderId || null });
  if (res.already && res.uid !== uid) throw new HttpsError('permission-denied', 'This purchase belongs to another account.');
  // Consumable packs: consume so they can be bought again (consume also acknowledges).
  try {
    if (r.consumptionState !== 1) await ap.purchases.products.consume({ packageName: PKG, productId: sku, token: purchaseToken });
  } catch (e) {
    console.error('consume failed', e.message);
    try { if (r.acknowledgementState !== 1) await ap.purchases.products.acknowledge({ packageName: PKG, productId: sku, token: purchaseToken, requestBody: {} }); } catch (e2) { console.error('ack failed', e2.message); }
  }
  return { ok: true, ...res, uid: undefined };
});

exports.stripeWebhook = onRequest({ secrets: [STRIPE_WEBHOOK_SECRET], cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
  const stripe = require('stripe')('sk_unused'); // only used for signature verification (no API calls)
  let ev;
  try { ev = stripe.webhooks.constructEvent(req.rawBody, req.get('stripe-signature'), STRIPE_WEBHOOK_SECRET.value()); }
  catch (e) { res.status(400).send('Bad signature'); return; }
  if (ev.type !== 'checkout.session.completed') { res.json({ ignored: ev.type }); return; }
  const s = ev.data.object;
  if (s.payment_status !== 'paid') { res.json({ ignored: 'unpaid' }); return; }
  const uid = s.client_reference_id;
  const sku = (s.metadata && s.metadata.pack) || STRIPE_MAP[s.payment_link] || STRIPE_MAP[s.metadata && s.metadata.price];
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !PACKS[sku]) { console.error('stripe: unmapped', s.id, uid, sku, s.payment_link); res.json({ ignored: 'unmapped' }); return; }
  try { const r = await credit(uid, sku, 'stripe_' + s.id, 'stripe', { session: s.id, link: s.payment_link || null }); res.json({ ok: true, ...r }); }
  catch (e) { console.error('stripe credit failed', e); res.status(500).send('retry'); }
});
