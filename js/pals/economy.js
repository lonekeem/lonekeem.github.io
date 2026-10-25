// Star Coins + inventory (client side). The rules cap earning per source per day, check every
// purchase against config/palShop and keep the balance from going negative.
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, writeBatch, serverTimestamp, deleteDoc }
  from '../fsq.js';
import { ITEM, EARN, dayNo, todaysDeals } from './catalog.js';
import { isUnlimited } from '../inf-pass.js';
// Unlimited (admin or ∞ Pass, js/inf-pass.js): balance shows Infinity ('∞'); purchases record ownership but don't deduct.
export const isAdminUid = isUnlimited; // kept name for older imports (now async)
// ---- live price check (config/palShop, admin-write only; the rules check every purchase against it)
// A brand-new item whose price isn't published yet used to fail with a generic permission-denied error.
// Now: buys check the live doc first. For the admin, a registered hook auto-publishes the missing prices
// (merging, never removing anything) and the buy continues; everyone else gets a clear "not available yet".
let SHOP = null, shopAt = 0, autoPub = null;
export const setShopAutoPublish = (fn) => { autoPub = fn; };
export class ShopError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
export async function ensureLive(db, id, diamonds) {
  const has = () => SHOP && id in ((diamonds ? SHOP.dprices : SHOP.prices) || {}) && id in (SHOP.kinds || {});
  if (!has() || Date.now() - shopAt > 60000) { const s = await getDoc(doc(db, 'config', 'palShop')); SHOP = s.exists() ? s.data() : {}; shopAt = Date.now(); }
  if (has()) return true;
  if (autoPub) { try { await autoPub(); } catch (e) { console.warn('auto-publish prices failed', e); } const s = await getDoc(doc(db, 'config', 'palShop')); SHOP = s.exists() ? s.data() : {}; shopAt = Date.now(); if (has()) return true; }
  throw new ShopError('This item isn’t available yet. Check back soon!', 'kemy/not-live');
}
// clear words for a purchase that the server refused after all our own checks passed
export function buyError(e) { if (e instanceof ShopError || !e || !e.code) return e; if (e.code === 'permission-denied') return new ShopError('That purchase didn’t go through. Please try again.', 'kemy/denied');
  if (e.code === 'unavailable' || e.code === 'deadline-exceeded') return new ShopError('You seem to be offline. Check your connection and try again.', 'kemy/offline'); return e; }
export function createEconomy(db, uid) {
  const wref = doc(db, 'users', uid, 'pal', 'wallet');
  let w = null, inv = null, chain = Promise.resolve(), lastWrite = 0; const subs = new Set();
  const emit = () => subs.forEach((f) => { try { f(w); } catch {} });
  const gap = async () => { const wait = 1150 - (Date.now() - lastWrite); if (wait > 0) await new Promise((r) => setTimeout(r, wait)); };
  const q = (fn) => (chain = chain.then(fn, fn));  // serialise writes (rules need 1s between earns)
  async function wallet(force) {
    if (w && !force) return w;
    const s = await getDoc(wref);
    if (!s.exists()) {
      await setDoc(wref, { coins: 0, total: 0, day: dayNo(), earned: {}, src: '', last: serverTimestamp(), lastBuy: '', paid: 0, buyAt: serverTimestamp(), room: [], updatedAt: serverTimestamp() });
      lastWrite = Date.now(); w = { coins: 0, total: 0, day: dayNo(), earned: {}, room: [] };
    } else w = s.data();
    if (await isUnlimited(uid)) w = { ...w, coins: Infinity, admin: true };
    emit(); return w;
  }
  async function inventory(force) {
    if (inv && !force) return inv;
    const s = await getDocs(collection(db, 'users', uid, 'inv')); inv = {}; s.docs.forEach((d) => { inv[d.id] = d.data().n || 0; }); return inv;
  }
  const leftToday = (src) => { if (!w) return 0; const used = w.day === dayNo() ? (w.earned || {})[src] || 0 : 0; return Math.max(0, EARN[src][1] - used); };
  // earn coins; silently clamps to what's left of today's cap for that source
  function earn(src, n) {
    return q(async () => {
      try {
        await wallet(); if (w.admin) return 0; const amt = Math.min(n, EARN[src][0], leftToday(src)); if (amt <= 0) return 0;
        const today = dayNo(); const earned = w.day === today ? { ...(w.earned || {}) } : {}; earned[src] = (earned[src] || 0) + amt;
        await gap(); const next = { coins: w.coins + amt, total: w.total + amt, day: today, earned, src, last: serverTimestamp(), updatedAt: serverTimestamp() };
        await updateDoc(wref, next); lastWrite = Date.now(); Object.assign(w, next, { last: Date.now() }); emit(); return amt;
      } catch (e) { console.warn('earn', src, e.code || e.message); w = null; return 0; }
    });
  }
  const priceOf = (id) => { const d = todaysDeals(); return d[id] !== undefined ? d[id] : ITEM[id].p; };
  // back-to-back purchases: queued one at a time; on a stale balance / contention (another tab, an earn landing at the
  // same moment) re-read the wallet and try again instead of failing
  const retry = async (fn) => { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { const c = e && e.code; if (i < 2 && (c === 'permission-denied' || c === 'aborted' || c === 'failed-precondition' || c === 'unavailable')) { w = null; inv = null; await new Promise((r) => setTimeout(r, 400 + i * 600)); continue; } throw e; } } };
  const tap = new Map(); // ~300 ms double-tap guard on the SAME item only (returns the same purchase)
  function buy(id) { const r0 = tap.get(id); if (r0 && Date.now() - r0.t < 300) return r0.p; const p = buy0(id).catch((e) => { throw buyError(e); }); tap.set(id, { t: Date.now(), p }); return p; }
  function buy0(id) {
    return q(() => retry(async () => {
      await wallet(true); await inventory(); const it = ITEM[id]; if (!it || it.ach) throw new ShopError('That item can’t be bought.', 'kemy/no-item');
      const paid = priceOf(id); if (w.coins < paid) throw new ShopError('Not enough Star Coins yet.', 'kemy/coins');
      if (it.kind !== 'snack' && inv[id]) throw new ShopError('You already have this.', 'kemy/owned');
      await ensureLive(db, id, false);
      const b = writeBatch(db); // no client cooldown for buys (the rules only space out earns); queued by q()
      if (w.admin) { // admin: ownership only, balance untouched (rules allow paid 0 for unlimitedFor())
        b.update(wref, { lastBuy: id, paid: 0, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
        b.set(doc(db, 'users', uid, 'inv', id), { n: (inv[id] || 0) + 1, at: serverTimestamp() });
        await b.commit(); lastWrite = Date.now(); inv[id] = (inv[id] || 0) + 1; emit(); return 0;
      }
      b.update(wref, { coins: w.coins - paid, lastBuy: id, paid, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
      b.set(doc(db, 'users', uid, 'inv', id), { n: (inv[id] || 0) + 1, at: serverTimestamp() });
      await b.commit(); lastWrite = Date.now(); w.coins -= paid; inv[id] = (inv[id] || 0) + 1; emit(); return paid;
    }));
  }
  function use(id) {
    return q(async () => { await inventory(); if (!inv[id]) return false; await updateDoc(doc(db, 'users', uid, 'inv', id), { n: inv[id] - 1, at: serverTimestamp() }); inv[id]--; return true; });
  }
  function claim(id, proof) {
    return q(async () => { await inventory(); if (inv[id]) return false; const d = { n: 1, at: serverTimestamp() }; if (proof !== undefined) d.proof = proof;
      await setDoc(doc(db, 'users', uid, 'inv', id), d); inv[id] = 1; return true; });
  }
  function setRoom(room) { return q(async () => { await gap(); await updateDoc(wref, { room: room.slice(0, 3), updatedAt: serverTimestamp() }); lastWrite = Date.now(); w.room = room.slice(0, 3); emit(); }); }
  async function looks() { const s = await getDocs(collection(db, 'users', uid, 'looks')); return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); }
  const saveLook = (id, name, outfit, x = {}) => setDoc(doc(db, 'users', uid, 'looks', id), { name: String(name).slice(0, 20) || 'Look', outfit, ...(x.bg !== undefined ? { bg: x.bg || '', variant: x.variant || '', pattern: x.pattern || 'none' } : {}) });
  const delLook = (id) => deleteDoc(doc(db, 'users', uid, 'looks', id));
  return { wallet, inventory, earn, buy, use, claim, setRoom, looks, saveLook, delLook, priceOf, leftToday, sub: (f) => { subs.add(f); return () => subs.delete(f); }, get w() { return w; } };
}
// public: a user's room decor (shown in their profile Pal strip)
export async function roomOf(db, uid) { try { const s = await getDoc(doc(db, 'users', uid, 'pal', 'wallet')); return s.exists() ? s.data().room || [] : []; } catch { return []; } }
