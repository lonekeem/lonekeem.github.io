// Star Coins + inventory (client side). The rules cap earning per source per day, check every
// purchase against config/palShop and keep the balance from going negative.
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, writeBatch, serverTimestamp, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { ITEM, EARN, dayNo, todaysDeals } from './catalog.js';
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
        await wallet(); const amt = Math.min(n, EARN[src][0], leftToday(src)); if (amt <= 0) return 0;
        const today = dayNo(); const earned = w.day === today ? { ...(w.earned || {}) } : {}; earned[src] = (earned[src] || 0) + amt;
        await gap(); const next = { coins: w.coins + amt, total: w.total + amt, day: today, earned, src, last: serverTimestamp(), updatedAt: serverTimestamp() };
        await updateDoc(wref, next); lastWrite = Date.now(); Object.assign(w, next, { last: Date.now() }); emit(); return amt;
      } catch (e) { console.warn('earn', src, e.code || e.message); w = null; return 0; }
    });
  }
  const priceOf = (id) => { const d = todaysDeals(); return d[id] !== undefined ? d[id] : ITEM[id].p; };
  function buy(id) {
    return q(async () => {
      await wallet(true); await inventory(); const it = ITEM[id]; if (!it || it.ach) throw new Error('That item can’t be bought.');
      const paid = priceOf(id); if (w.coins < paid) throw new Error('Not enough Star Coins yet.');
      if (it.kind !== 'snack' && inv[id]) throw new Error('You already have this.');
      await gap(); const b = writeBatch(db);
      b.update(wref, { coins: w.coins - paid, lastBuy: id, paid, buyAt: serverTimestamp(), updatedAt: serverTimestamp() });
      b.set(doc(db, 'users', uid, 'inv', id), { n: (inv[id] || 0) + 1, at: serverTimestamp() });
      await b.commit(); lastWrite = Date.now(); w.coins -= paid; inv[id] = (inv[id] || 0) + 1; emit(); return paid;
    });
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
  const saveLook = (id, name, outfit) => setDoc(doc(db, 'users', uid, 'looks', id), { name: String(name).slice(0, 20) || 'Look', outfit });
  const delLook = (id) => deleteDoc(doc(db, 'users', uid, 'looks', id));
  return { wallet, inventory, earn, buy, use, claim, setRoom, looks, saveLook, delLook, priceOf, leftToday, sub: (f) => { subs.add(f); return () => subs.delete(f); }, get w() { return w; } };
}
// public: a user's room decor (shown in their profile Pal strip)
export async function roomOf(db, uid) { try { const s = await getDoc(doc(db, 'users', uid, 'pal', 'wallet')); return s.exists() ? s.data().room || [] : []; } catch { return []; } }
