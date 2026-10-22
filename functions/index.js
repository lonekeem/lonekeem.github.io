// Kemy paid credit (Google Play). Wallets: users/{uid}/pal/wallet {coins,...} and users/{uid}/pal/diamonds {d,...}.
// Only the Admin SDK may raise balances beyond the capped earning rules in firestore.rules; writes stay within
// the key sets allowed by walletShape()/dShape() so later client writes still pass. Stripe: ../functions-stripe.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { setGlobalOptions } = require('firebase-functions/v2');
const { credit, PACKS } = require('./credit');
admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const PKG = 'com.lonekeemstudios.kemy';

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


// 🏷️ Sell your house back (Kemy World). One transaction: you must own homes/{plot} and still hold its deed
// (users/{uid}/inv/{deed}); the deed is consumed, the home doc (cars list, garage, decor, paint) + pal/home are cleared
// and 60% of the real price (config/palShop, same currency as bought) is credited. No deed = no refund, so it pays once per purchase.
// Garage kits stay in the inventory (a new home rebuilds them free) and are not refunded. The admin palace can't be sold.
const HOME_DEEDS = { cottage: ['hs_cottage', 'star', 800], twostory: ['hs_twostory', 'star', 1500], ranch: ['hs_ranch', 'star', 1100],
  manor: ['z_hs_manor', 'dia', 1200], mansion: ['z_hs_mansion', 'dia', 3000], estate: ['z_hs_estate', 'dia', 5000] };
const SELL_RATE = 0.6;
exports.sellHome = onCall({ enforceAppCheck: false }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const plot = String((req.data || {}).plot || '');
  if (!/^h[0-9]{2,3}$|^hm[0-9]{4}$/.test(plot)) throw new HttpsError('invalid-argument', 'Bad plot.');
  if (plot === 'h489') throw new HttpsError('permission-denied', 'The palace can’t be sold.');
  const { getFirestore, FieldValue: FV } = require('firebase-admin/firestore'); const uid = req.auth.uid, fs = getFirestore();
  const href = fs.doc('homes/' + plot), pref = fs.doc(`users/${uid}/pal/home`), sref = fs.doc('config/palShop');
  return fs.runTransaction(async (t) => {
    const [h, shop] = await Promise.all([t.get(href), t.get(sref)]);
    if (!h.exists || h.data().owner !== uid) throw new HttpsError('permission-denied', 'You don’t own this home.');
    const D = HOME_DEEDS[h.data().style]; if (!D) throw new HttpsError('failed-precondition', 'This home can’t be sold.');
    const [item, cur, fallback] = D; const iref = fs.doc(`users/${uid}/inv/${item}`); const inv = await t.get(iref);
    if (!inv.exists) throw new HttpsError('failed-precondition', 'No deed for this home (already sold or claimed free), so there is nothing to refund.');
    const S = shop.exists ? shop.data() : {}; const real = cur === 'star' ? (S.prices || {})[item] : (S.dprices || {})[item];
    const base = Number.isFinite(real) && real > 0 ? real : fallback; const n = Math.floor(base * SELL_RATE);
    const wref = fs.doc(`users/${uid}/pal/${cur === 'star' ? 'wallet' : 'diamonds'}`); const w = await t.get(wref); const now = FV.serverTimestamp();
    if (cur === 'star') { if (w.exists) t.update(wref, { coins: FV.increment(n), updatedAt: now }); else t.set(wref, { coins: n, total: 0, day: Math.floor(Date.now() / 86400000), earned: {}, src: '', last: now, lastBuy: '', paid: 0, buyAt: now, room: [], updatedAt: now }); }
    else { if (w.exists) t.update(wref, { d: FV.increment(n), updatedAt: now }); else t.set(wref, { d: n, total: 0, day: Math.floor(Date.now() / 86400000), today: 0, last: now, lastBuy: '', paid: 0, buyAt: now, updatedAt: now }); }
    t.delete(iref); t.delete(href); t.delete(pref);
    t.set(fs.collection('homeSales').doc(), { uid, plot, style: h.data().style, cur, n, price: base, at: now });
    return { ok: true, cur, n, price: base };
  });
});

// Web push: inbox invites and house visits, your-turn updates, the morning Star Coin reminder,
// and an admin-only announcement callable. See functions/push.js. Written by Lone Keem.
Object.assign(exports, require('./push'));
// New Members back-fill (admin only). The join ping itself lives in push.js.
Object.assign(exports, require('./members'));
