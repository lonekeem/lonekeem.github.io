// 🔔 Doorbell answers: an owner lets a visitor in (or says "not now") from the Notifications inbox, the
// in-app ring card, or the pop-up in Pal Park. The answer lives on homes/{plot}.door = { visitorUid: ms }:
// a positive value lets that visitor in until then (30 min, used once), a negative value (-ms) is "not now"
// or "asked to leave" (10 min, the house stays closed to them). firestore.rules (houseHere) honor a let-in
// for unblocked visitors only. Only the owner can write their home doc. Written by Lone Keem.
import { doc, getDoc, updateDoc, serverTimestamp } from '../fsq.js';

export const LET_MS = 30 * 60 * 1000;
export const NO_MS = 10 * 60 * 1000;
const DOOR_MAX = 20;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const isRing = (n) => !!(n && n.type === 'house' && n.fromUid && /rang your doorbell/.test(String(n.text || '')));
// 'in' = let in (until v), 'no' = not now / asked to leave (for 10 min), '' = nothing
export function doorState(home, who, now = Date.now()) {
  const v = home && home.door && typeof home.door[who] === 'number' ? home.door[who] : 0;
  if (v > now) return 'in';
  if (v < 0 && now + v < NO_MS) return 'no';
  return '';
}
function prune(door, now) {
  const out = {};
  const live = Object.entries(door && typeof door === 'object' ? door : {}).filter(([, v]) => typeof v === 'number' && (v > now || (v < 0 && now + v < NO_MS)));
  live.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  for (const [k, v] of live.slice(0, DOOR_MAX - 1)) out[k] = v;
  return out;
}

// yes = let in, no = not now / ask to leave. Returns 'in' | 'no' | 'blocked' | 'notmine' | 'gone'.
export async function answerDoor(db, S, plot, who, yes) {
  const me = S && S.user && S.user.uid;
  if (!db || !me || !who || who === me || !/^h[0-9]{2,3}$|^hm[0-9]{4}$/.test(String(plot || ''))) return 'gone';
  if (yes && S.blocked && S.blocked.has(who)) return 'blocked';
  if (yes) { try { if ((await getDoc(doc(db, 'users', me, 'blocks', who))).exists()) return 'blocked'; } catch { /* rules re-check */ } }
  const ref = doc(db, 'homes', plot);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().owner !== me) return 'notmine';
  const now = Date.now();
  const door = prune(snap.data().door, now);
  door[who] = yes ? now + LET_MS : -now;
  await updateDoc(ref, { door, name: S.profile.displayName, at: serverTimestamp() });
  answered(who + ':' + plot);
  return yes ? 'in' : 'no';
}
// An invite from the guest list replaces any "not now" (owner only; updateDoc swaps the whole map)
export async function forgetDoor(db, S, plot, home, who) {
  if (!home || !home.door || !(who in home.door)) return;
  const door = prune(home.door, Date.now()); delete door[who];
  await updateDoc(doc(db, 'homes', plot), { door, name: S.profile.displayName, at: serverTimestamp() });
}

// Soft two-tone ding-dong (WebAudio, no file). Follows the inbox chime mute.
let ac = null;
export function dingDong() {
  try { if (localStorage.getItem('kemy-chime-mute') === '1') return; } catch { /* */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = ac || new AC(); if (ac.state === 'suspended') ac.resume().catch(() => {});
    const t0 = ac.currentTime + 0.02;
    [[659.3, 0], [523.3, 0.42]].forEach(([f, d]) => {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2;
      const g2 = ac.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.16, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.1);
      o.start(t0 + d); o2.start(t0 + d); o.stop(t0 + d + 1.15); o2.stop(t0 + d + 1.15);
    });
  } catch { /* no audio */ }
}

// Visitor's Pal as a small picture (egg if none / slow)
const thumbs = new Map();
export async function palPic(db, who) {
  if (thumbs.has(who)) return thumbs.get(who);
  let out = { url: '', name: '' };
  try {
    const [{ getActivePal }, art] = await Promise.all([import('../pals/core.js'), import('../pals/art.js')]);
    const pal = await getActivePal(db, who);
    if (pal) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 96;
      art.drawPal(cv.getContext('2d'), 48, 92, 72, pal, { t: 0, mode: 'idle', face: 1 });
      out = { url: cv.toDataURL('image/png'), name: String(pal.name || '').slice(0, 20) };
    }
  } catch { /* egg */ }
  thumbs.set(who, out); return out;
}

// One ring card at a time; more ringers wait in line. Used by the app (anywhere) and Pal Park.
const queue = []; const done = new Map(); let cardEl = null;
function css() {
  if (document.getElementById('kemy-bell-css')) return;
  const s = document.createElement('style'); s.id = 'kemy-bell-css';
  s.textContent = `.kemy-bell{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);z-index:2147480400;width:min(92vw,360px);box-sizing:border-box;background:#fffaf0;color:#2a1f14;border-radius:18px;box-shadow:0 10px 34px rgba(0,0,0,.35);padding:12px 14px;font:600 15px Inter,system-ui,sans-serif;animation:kbIn .25s ease-out}
@keyframes kbIn{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}
.kemy-bell .kb-top{display:flex;gap:10px;align-items:center}.kemy-bell img,.kemy-bell .kb-egg{width:58px;height:58px;border-radius:14px;background:#ffe9c7;flex:none;object-fit:contain;display:grid;place-items:center;font-size:30px}
.kemy-bell b{font-weight:800}.kemy-bell small{display:block;color:#7a6650;font-weight:600;margin-top:2px}
.kemy-bell .kb-row{display:flex;gap:8px;margin-top:10px}.kemy-bell button{flex:1;min-height:46px;border:0;border-radius:12px;font:800 16px Inter,system-ui,sans-serif;cursor:pointer}
.kemy-bell [data-kb-yes]{background:#2fa84f;color:#fff}.kemy-bell [data-kb-no]{background:#eadfce;color:#4a3a28}.kemy-bell button:disabled{opacity:.85}
.kemy-bell .kb-more{font-size:12px;color:#7a6650;margin-top:6px;text-align:center}`;
  document.head.appendChild(s);
}
// r = { uid, name, username, plot }; ctx = { db, S, toast, onAnswer }
export function ringCard(r, ctx) {
  if (!r || !r.uid || !r.plot || !ctx || !ctx.S || !ctx.S.user || r.uid === ctx.S.user.uid) return;
  if (ctx.S.blocked && ctx.S.blocked.has(r.uid)) return;
  const k = r.uid + ':' + r.plot;
  if (Date.now() - (done.get(k) || 0) < 60 * 1000) return;
  if (queue.some((q) => q.k === k) || (cardEl && cardEl.dataset.k === k)) return;
  queue.push({ ...r, k, ctx, at: Date.now() });
  if (!cardEl) next();
  else paintMore();
}
// answered anywhere (inbox, card, room menu): drop it from the line
function answered(k) { done.set(k, Date.now()); const i = queue.findIndex((q) => q.k === k); if (i >= 0) queue.splice(i, 1); paintMore(); if (cardEl && cardEl.dataset.k === k && !cardEl.dataset.busy) close(); }
function paintMore() { const m = cardEl && cardEl.querySelector('.kb-more'); if (m) m.textContent = queue.length ? `+${queue.length} more at the door` : ''; }
function close() { if (cardEl) cardEl.remove(); cardEl = null; setTimeout(next, 250); }
function next() {
  if (cardEl) return;
  let r; while ((r = queue.shift()) && Date.now() - r.at > 10 * 60 * 1000) { /* stale ring */ }
  if (!r) return;
  css(); const { db, S, toast } = r.ctx; const say = (t) => { try { toast && toast(t); } catch { /* */ } };
  const el = document.createElement('div'); el.className = 'kemy-bell'; el.dataset.k = r.k; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-label', r.name + ' is at your door');
  el.innerHTML = `<div class="kb-top"><span class="kb-egg" aria-hidden="true">🥚</span><div>🔔 <b>${esc(r.name)}</b> is at your door<small>@${esc(r.username || 'pal')}<span class="kb-pal"></span></small></div></div>
    <div class="kb-row"><button data-kb-yes>Let in</button><button data-kb-no>Not now</button></div><div class="kb-more"></div>`;
  document.body.appendChild(el); cardEl = el; paintMore(); dingDong();
  palPic(db, r.uid).then((p) => { if (!el.isConnected) return; if (p.url) { const img = new Image(); img.src = p.url; img.alt = p.name ? p.name + ', their Pal' : 'their Pal'; el.querySelector('.kb-egg').replaceWith(img); } if (p.name) el.querySelector('.kb-pal').textContent = ' · Pal: ' + p.name; });
  const yes = el.querySelector('[data-kb-yes]'), no = el.querySelector('[data-kb-no]');
  const answer = async (ok) => {
    el.dataset.busy = '1'; yes.disabled = no.disabled = true; (ok ? yes : no).textContent = ok ? 'Letting in…' : '…';
    try {
      const res = await answerDoor(db, S, r.plot, r.uid, ok);
      done.set(r.k, Date.now());
      if (res === 'in') { yes.textContent = 'Let in ✓'; say('🏠 You let ' + r.name + ' in'); }
      else if (res === 'no') { no.textContent = 'Not now ✓'; }
      else if (res === 'blocked') say('You blocked this player.');
      else if (res === 'notmine') say('That home isn’t yours anymore.');
      try { r.ctx.onAnswer && r.ctx.onAnswer(r, res); } catch { /* */ }
      setTimeout(close, 900);
    } catch (e) {
      delete el.dataset.busy; yes.disabled = no.disabled = false; yes.textContent = 'Let in'; no.textContent = 'Not now';
      say(e && e.code === 'permission-denied' ? '⚠️ Could not open the door. Try again in a moment.' : 'Could not answer the door');
    }
  };
  yes.onclick = () => answer(true); no.onclick = () => answer(false);
  setTimeout(() => { if (cardEl === el && !yes.disabled) close(); }, 3 * 60 * 1000);
}
export const ringQueueSize = () => queue.length + (cardEl ? 1 : 0);
