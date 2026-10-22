// Hide a chat line after 3 different people report it. The count lives beside the
// message, because live chat and park presence cannot be edited by other players.
import { doc, getDoc, collection, query, where, limit, onSnapshot, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const HIDE_AT = 3;
const hidden = new Set();

export function hideKey(area, uid, text) {
  const a = String(area || 'chat').toLowerCase().replace(/[^a-z]/g, '').slice(0, 8) || 'chat';
  const s = `${a}|${uid}|${String(text || '').slice(0, 80)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${a}_${(h >>> 0).toString(36)}`;
}

export function isHidden(key) { return hidden.has(String(key || '')); }

function paint() {
  document.querySelectorAll('[data-hide]').forEach((el) => { if (hidden.has(el.dataset.hide)) el.hidden = true; });
}

export async function noteReport(db, uid, key) {
  const id = String(key || '');
  if (!/^[a-z]{2,8}_[a-z0-9]{1,12}$/.test(id) || !uid) return 0;
  const ref = doc(db, 'chatHides', id);
  const mine = doc(db, 'chatHides', id, 'by', uid);
  const [cur, seen] = await Promise.all([getDoc(ref), getDoc(mine)]);
  if (seen.exists()) return cur.exists() ? (cur.data().n || 1) : 1;
  const n = cur.exists() ? (Number(cur.data().n) || 0) + 1 : 1;
  const b = writeBatch(db);
  if (!cur.exists()) b.set(ref, { n: 1, area: id.split('_')[0], at: serverTimestamp() });
  else b.update(ref, { n });
  b.set(mine, { at: serverTimestamp() });
  await b.commit();
  if (n >= HIDE_AT) { hidden.add(id); paint(); }
  return n;
}

export function watchHides(db) {
  return onSnapshot(query(collection(db, 'chatHides'), where('n', '>=', HIDE_AT), limit(80)), (qs) => {
    qs.forEach((d) => hidden.add(d.id));
    paint();
  }, () => {});
}
