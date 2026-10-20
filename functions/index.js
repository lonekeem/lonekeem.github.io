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

