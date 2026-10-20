// Read-saving helpers. Firestore bills every server read (Spark: 50k/day), so repeat reads inside a TTL
// come from the persistent IndexedDB cache (0 billed reads). If the server read fails (e.g. quota
// exhausted / offline) we fall back to whatever is cached so the app still shows content.
import { getDocs, getDocsFromCache, getDoc, getDocFromCache } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
const K = (k) => 'kfc:' + k;
const fresh = (k, ttl) => { try { return Date.now() - (Number(localStorage.getItem(K(k))) || 0) < ttl; } catch { return false; } };
const mark = (k) => { try { localStorage.setItem(K(k), String(Date.now())); } catch { /* full */ } };
export const isQuota = (e) => !!e && (e.code === 'resource-exhausted' || /quota/i.test(e.message || ''));
export const BUSY_MSG = 'Kemy is extra busy right now — try again in a bit 💜';
export async function cachedQuery(key, q, ttl = 300e3) {
  if (fresh(key, ttl)) { try { const s = await getDocsFromCache(q); if (!s.empty) return s; } catch { /* miss */ } }
  try { const s = await getDocs(q); mark(key); return s; }
  catch (e) { try { const s = await getDocsFromCache(q); if (!s.empty) { if (isQuota(e)) window.kemyBusy?.(); return s; } } catch { /* none */ } throw e; }
}
export async function cachedDoc(key, ref, ttl = 300e3) {
  if (fresh(key, ttl)) { try { return await getDocFromCache(ref); } catch { /* miss */ } }
  try { const s = await getDoc(ref); mark(key); return s; }
  catch (e) { try { const s = await getDocFromCache(ref); if (isQuota(e)) window.kemyBusy?.(); return s; } catch { /* none */ } throw e; }
}
