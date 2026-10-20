// Shared by functions/ and functions-stripe/ (keep both copies identical; check: diff functions/credit.js functions-stripe/credit.js).
const { FieldValue: FV, getFirestore } = require('firebase-admin/firestore');
const PACKS = require('./packs');
const db = () => getFirestore();
const dayNo = () => Math.floor(Date.now() / 86400000);
const safeId = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 1400);

// Idempotent: purchases/{id} is created in the same transaction as the credit.
async function credit(uid, sku, purchaseId, provider, extra = {}) {
  const pack = PACKS[sku]; if (!pack) throw new Error('unknown sku ' + sku);
  const pref = db().doc('purchases/' + safeId(purchaseId));
  const wref = db().doc(`users/${uid}/pal/${pack.cur === 'star' ? 'wallet' : 'diamonds'}`);
  return db().runTransaction(async (t) => {
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

module.exports = { credit, PACKS };
