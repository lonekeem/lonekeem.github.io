// ∞ Pass: one helper for "unlimited Star Coins + Diamonds".
// Unlimited = the verified admin account OR a player holding an ∞ Pass (infPass/{uid}, written ONLY by the
// admin - enforced in firestore.rules unlimitedFor()). Purchases still need a real shop item; they just don't deduct.
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, serverTimestamp }
  from './fsq.js';
import { auth, db, ADMIN_EMAIL } from './firebase-init.js';
export const isAdminUser = (u) => !!(u && u.email === ADMIN_EMAIL && u.emailVerified);
const passRef = (uid) => doc(db, 'infPass', uid);
const cache = new Map(); // uid -> bool
export async function hasPass(uid, force) {
  if (!uid) return false; if (!force && cache.has(uid)) return cache.get(uid);
  let on = false; try { const s = await getDoc(passRef(uid)); on = s.exists() && s.data().unlimitedPass === true; } catch { on = false; }
  cache.set(uid, on); return on;
}
// Is this (signed-in) uid unlimited? Only ever true for the current user's own wallet.
export async function isUnlimited(uid) {
  const u = auth.currentUser; if (!u || u.uid !== uid) return false;
  return isAdminUser(u) || hasPass(uid);
}
export function watchPass(uid, cb) {
  return onSnapshot(passRef(uid), (s) => { const on = s.exists() && s.data().unlimitedPass === true; cache.set(uid, on); cb(on); }, () => cb(false));
}
export async function givePass(uid) { await setDoc(passRef(uid), { unlimitedPass: true, grantedBy: auth.currentUser.uid, grantedAt: serverTimestamp() }); cache.set(uid, true); }
export async function removePass(uid) { await deleteDoc(passRef(uid)); cache.set(uid, false); }
// Profile: small ∞ badge for pass holders + admin-only Give/Remove button.
export async function mountProfile(uid, headEl, actionsEl, viewerIsAdmin, toast = () => {}) {
  const on = await hasPass(uid, true);
  if (headEl && on && !headEl.querySelector('.inf-badge')) headEl.insertAdjacentHTML('beforeend', ' <span class="inf-badge" title="∞ Pass: unlimited Star Coins and Diamonds" style="display:inline-block;background:#5b2a8a;color:#fff;border-radius:999px;padding:1px 8px;font-size:.8rem;font-weight:800;vertical-align:middle">∞</span>');
  if (!viewerIsAdmin || !actionsEl) return;
  const b = document.createElement('button'); b.className = 'btn btn-sm btn-ghost'; b.id = 'p-infpass';
  let cur = on; const label = () => { b.textContent = cur ? 'Remove ∞ Pass' : 'Give ∞ Pass'; }; label();
  b.onclick = async () => {
    if (!confirm(cur ? 'Remove the ∞ Pass? Their Star Coins and Diamonds go back to normal.' : 'Give this player the ∞ Pass? They get unlimited Star Coins and Diamonds.')) return;
    b.disabled = true;
    try { if (cur) await removePass(uid); else await givePass(uid); cur = !cur; label(); toast(cur ? '∞ Pass given' : '∞ Pass removed');
      const bd = headEl && headEl.querySelector('.inf-badge'); if (!cur && bd) bd.remove(); if (cur && headEl && !bd) mountProfile(uid, headEl, null, false); }
    catch (e) { toast('Could not update the ∞ Pass'); } finally { b.disabled = false; }
  };
  actionsEl.appendChild(b);
}
