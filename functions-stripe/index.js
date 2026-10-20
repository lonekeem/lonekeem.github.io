// Kemy paid credit (Stripe Payment Links -> checkout.session.completed). Separate codebase so the Play function
// can deploy before the STRIPE_WEBHOOK_SECRET secret exists.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { setGlobalOptions } = require('firebase-functions/v2');
const { credit, PACKS } = require('./credit');
admin.initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// Optional: Stripe payment link id (plink_...) or price id -> pack id, used when the session has no metadata.pack.
const STRIPE_MAP = {};

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
