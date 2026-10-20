// Kemy payment provider abstraction. NO secrets here; everything below is public config.
// Providers: (1) Google Play Billing via Digital Goods API + PaymentRequest (inside the Android TWA
// com.lonekeemstudios.kemy), (2) a web card checkout via a Stripe Payment Link (future).
// When neither is configured/available, the shop shows packs with a 'Coming soon' badge and disabled buttons.
//
// IMPORTANT: this file NEVER credits Star Coins or Diamonds. Crediting must happen SERVER-SIDE
// (Cloud Function / backend) after verifying the purchase token with the Google Play Developer API
// (purchases.products.get, then consume/acknowledge) or a Stripe webhook (checkout.session.completed).
// Firestore rules must keep wallet/diamonds writes away from clients for paid credit. (future)
export const PACKS = [
  { id: 'stars_100', cur: 'star', amount: 100, bonus: 0, usd: 0.99 },
  { id: 'stars_550', cur: 'star', amount: 500, bonus: 50, usd: 4.99 },
  { id: 'stars_1200', cur: 'star', amount: 1000, bonus: 200, usd: 9.99, tag: 'Popular' },
  { id: 'stars_2600', cur: 'star', amount: 2000, bonus: 600, usd: 14.99 },
  { id: 'stars_3600', cur: 'star', amount: 2600, bonus: 1000, usd: 19.99, tag: 'Best value' },
  { id: 'diamonds_10', cur: 'diamond', amount: 10, bonus: 0, usd: 0.99 },
  { id: 'diamonds_55', cur: 'diamond', amount: 50, bonus: 5, usd: 4.99 },
  { id: 'diamonds_120', cur: 'diamond', amount: 100, bonus: 20, usd: 9.99, tag: 'Popular' },
  { id: 'diamonds_260', cur: 'diamond', amount: 200, bonus: 60, usd: 14.99 },
  { id: 'diamonds_360', cur: 'diamond', amount: 260, bonus: 100, usd: 19.99, tag: 'Best value' }
];
// Turn on later: PLAY_ENABLED=true once the in-app products above exist (same IDs) in Play Console.
// STRIPE_LINKS: paste public Payment Link URLs (https://buy.stripe.com/...) per pack id. Links are public, not secrets.
export const CONFIG = { PLAY_ENABLED: false, PLAY_METHOD: 'https://play.google.com/billing', STRIPE_LINKS: {} };

let playSvc = null, playDetails = null;
export const inTwa = () => typeof window !== 'undefined' && 'getDigitalGoodsService' in window;
async function play() {
  if (!CONFIG.PLAY_ENABLED || !inTwa()) return null;
  if (playSvc) return playSvc;
  try { playSvc = await window.getDigitalGoodsService(CONFIG.PLAY_METHOD); } catch (e) { playSvc = null; }
  return playSvc;
}
// Which providers can sell right now: { play: bool, card: bool, ready: bool }
export async function status() {
  const svc = await play(); const card = Object.keys(CONFIG.STRIPE_LINKS).length > 0;
  if (svc && !playDetails) { try { playDetails = await svc.getDetails(PACKS.map((p) => p.id)); } catch (e) { playDetails = []; } }
  return { play: !!svc, card, ready: !!svc || card };
}
// Localised Play price if known, else USD list price.
export function priceOf(p) { const d = (playDetails || []).find((x) => x.itemId === p.id);
  if (d && d.price) { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: d.price.currency }).format(d.price.value); } catch (e) {} }
  return '$' + p.usd.toFixed(2); }
// Start a purchase. Returns { ok, provider, token? }. Does NOT credit anything (see header).
export async function buy(p, uid) {
  const svc = await play();
  if (svc) {
    const req = new PaymentRequest([{ supportedMethods: CONFIG.PLAY_METHOD, data: { sku: p.id } }], { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } });
    const res = await req.show(); const token = res.details && res.details.purchaseToken; await res.complete('success');
    // FUTURE: POST { uid, sku: p.id, token } to a backend that verifies with Google Play, credits the
    // wallet server-side, then consumes the purchase. Until then nothing is credited.
    return { ok: true, provider: 'play', token };
  }
  const link = CONFIG.STRIPE_LINKS[p.id];
  if (link) { const u = new URL(link); if (uid) u.searchParams.set('client_reference_id', uid); location.href = u.toString(); return { ok: true, provider: 'card' }; }
  return { ok: false, provider: null };
}
