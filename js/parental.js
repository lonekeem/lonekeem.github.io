// Parental Controls for Kemy. Settings live on the profile as `pc` (flags the Firestore rules read
// to block DMs / comments / live chat / going live / game chat when they're off). The 4-digit parent
// PIN is never stored: only SHA-256(salt + ':' + pin) in the private doc parental/{uid}.
// Forgot the PIN? Re-enter the account password (or Google sign-in) to set a new one.
// Billing shop: window.kemyParental.canPurchase() / requirePin(reason) -> Promise<boolean>.
import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

{ const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../css/parental.css', import.meta.url).href; document.head.appendChild(l); }
export const DEFAULTS = { chat: true, dm: 'friends', live: true, cmt: true, buy: 'pin', time: 0, vis: 'public', safe: true };
let uid = null, pc = null, secret = null, unsub = null, unlockedUntil = 0;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const on = () => !!pc;
const get = (k) => (pc ? (pc[k] ?? DEFAULTS[k]) : null);

async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const newSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');
async function loadSecret() { if (!uid) return null; try { const s = await getDoc(doc(db, 'parental', uid)); secret = s.exists() ? s.data() : null; } catch { secret = null; } return secret; }
async function pinOk(pin) { const s = secret || await loadSecret(); if (!s || !/^\d{4}$/.test(pin)) return false; return (await sha(s.salt + ':' + pin)) === s.hash; }
async function savePin(pin) { const salt = newSalt(); const hash = await sha(salt + ':' + pin); await setDoc(doc(db, 'parental', uid), { salt, hash, updatedAt: serverTimestamp() }); secret = { salt, hash }; }

function applyBody() {
  const b = document.body.classList;
  b.toggle('pc-nochat', on() && !get('chat')); b.toggle('pc-nocmt', on() && !get('cmt'));
  b.toggle('pc-nodm', on() && get('dm') === 'off'); b.toggle('pc-nolive', on() && !get('live'));
  b.toggle('pc-safe', on() && !!get('safe'));
}
onAuthStateChanged(auth, (u) => {
  uid = u ? u.uid : null; pc = null; secret = null; if (unsub) unsub(); unsub = null; applyBody();
  if (!u) return;
  unsub = onSnapshot(doc(db, 'users', u.uid), (s) => { pc = s.exists() && s.data().pc ? s.data().pc : null; applyBody(); tick(); }, () => {});
});

// ---------- modal + PIN pad ----------
function modal(html) {
  const w = document.createElement('div'); w.className = 'pc-modal'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
  w.innerHTML = `<div class="pc-box">${html}</div>`; document.body.appendChild(w); return w;
}
function pinPad(title, sub, { allowReset = true } = {}) {
  return new Promise((resolve) => {
    const w = modal(`<h2>${esc(title)}</h2><p class="pc-sub">${esc(sub)}</p><input class="pc-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="4-digit parent PIN"><p class="pc-err" role="alert"></p><div class="pc-row"><button class="pc-btn pc-ghost" data-x>Cancel</button><button class="pc-btn" data-ok>OK</button></div>${allowReset ? '<button class="pc-link" data-reset>Forgot PIN?</button>' : ''}`);
    const i = w.querySelector('.pc-pin'), err = w.querySelector('.pc-err'); setTimeout(() => i.focus(), 50);
    const done = (v) => { w.remove(); resolve(v); };
    w.querySelector('[data-x]').onclick = () => done(null);
    const ok = () => { if (!/^\d{4}$/.test(i.value)) { err.textContent = 'Enter 4 digits.'; return; } done(i.value); };
    w.querySelector('[data-ok]').onclick = ok; i.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
    const r = w.querySelector('[data-reset]'); if (r) r.onclick = async () => { w.remove(); resolve((await resetPin()) ? '__reset' : null); };
  });
}
async function askPin(reason) {
  if (!secret) await loadSecret(); if (!secret) return true;
  for (let n = 0; n < 5; n++) {
    const p = await pinPad('Parent PIN', reason || 'A grown-up needs to enter the parent PIN.');
    if (p === null) return false; if (p === '__reset') return true;
    if (await pinOk(p)) return true;
    toastish('That PIN isn’t right.');
  }
  return false;
}
function toastish(t) { const d = document.createElement('div'); d.className = 'pc-toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2200); }
async function resetPin() {
  const u = auth.currentUser; if (!u) return false;
  const google = u.providerData.some((p) => p.providerId === 'google.com') && !u.providerData.some((p) => p.providerId === 'password');
  try {
    if (google) await reauthenticateWithPopup(u, new GoogleAuthProvider());
    else {
      const pw = await new Promise((res) => {
        const w = modal(`<h2>Reset parent PIN</h2><p class="pc-sub">Enter the password for ${esc(u.email || 'this account')} to set a new PIN.</p><input class="pc-pin pc-pw" type="password" autocomplete="current-password" aria-label="Account password"><div class="pc-row"><button class="pc-btn pc-ghost" data-x>Cancel</button><button class="pc-btn" data-ok>Continue</button></div>`);
        w.querySelector('[data-x]').onclick = () => { w.remove(); res(null); };
        w.querySelector('[data-ok]').onclick = () => { const v = w.querySelector('input').value; w.remove(); res(v); };
      });
      if (!pw) return false;
      await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw));
    }
  } catch { toastish('Couldn’t confirm the account. Try again.'); return false; }
  const a = await pinPad('New parent PIN', 'Choose a new 4-digit PIN.', { allowReset: false }); if (!a) return false;
  const b = await pinPad('Confirm PIN', 'Type the new PIN again.', { allowReset: false }); if (a !== b) { toastish('PINs didn’t match.'); return false; }
  await savePin(a); toastish('New PIN saved 💜'); return true;
}

// ---------- daily time limit ----------
const dayKey = () => `kemyPcT:${uid}:${new Date().toDateString()}`;
const used = () => Number(localStorage.getItem(dayKey()) || 0);
let last = Date.now();
function tick() {
  const now = Date.now(), dt = Math.min(now - last, 60000); last = now;
  if (!uid || !on() || !get('time')) { document.querySelector('.pc-timeup')?.remove(); return; }
  if (document.visibilityState === 'visible' && !document.querySelector('.pc-timeup')) localStorage.setItem(dayKey(), String(used() + dt));
  if (used() >= get('time') * 60000 && now > unlockedUntil && !document.querySelector('.pc-timeup')) timesUp();
}
setInterval(tick, 15000); document.addEventListener('visibilitychange', () => { last = Date.now(); });
function timesUp() {
  document.querySelectorAll('video,audio').forEach((m) => { try { m.pause(); } catch {} });
  const w = document.createElement('div'); w.className = 'pc-timeup'; w.setAttribute('role', 'dialog');
  w.innerHTML = `<div class="pc-box"><div class="pc-moon" aria-hidden="true">🌙</div><h2>Time’s up for today!</h2><p class="pc-sub">You’ve used your ${get('time') >= 60 ? get('time') / 60 + ' hour' + (get('time') > 60 ? 's' : '') : get('time') + ' minutes'} on Kemy today. Great job! Come back tomorrow 💜</p><button class="pc-btn" data-more>Grown-up: unlock with PIN</button></div>`;
  document.body.appendChild(w);
  w.querySelector('[data-more]').onclick = async () => { if (await askPin('Enter the parent PIN to allow more time today (1 hour).')) { unlockedUntil = Date.now() + 3600000; w.remove(); } };
}

// ---------- guards used by the app ----------
const guardMsg = { chat: 'Chat is turned off in Parental Controls.', cmt: 'Comments are turned off in Parental Controls.', dm: 'Messages are turned off in Parental Controls.', live: 'Going live is turned off in Parental Controls.' };
// Capture-phase backup: stop chat/comment/DM sends even if a button slips past the CSS.
document.addEventListener('submit', (e) => {
  if (!on()) return; const f = e.target;
  const k = f.matches('#p3-chat,.lv-form,#pk-f') ? (!get('chat') && 'chat') : f.matches('#comment-form,.comment-form,#vsheet-form') ? (!get('cmt') && 'cmt') : f.matches('#chat-form') ? (get('dm') === 'off' && 'dm') : null;
  if (k) { e.preventDefault(); e.stopImmediatePropagation(); toastish(guardMsg[k]); }
}, true);
document.addEventListener('click', (e) => {
  if (!on() || get('chat')) return;
  if (e.target.closest('.g-emotes button,#pk-chat,#p3-quick,.pal-chip[data-say]')) { e.preventDefault(); e.stopImmediatePropagation(); toastish(guardMsg.chat); }
}, true);

function blockedScreen(text) { return `<div class="pc-block"><div class="pc-moon" aria-hidden="true">🛡️</div><h2>Not available</h2><p>${esc(text)}</p><a class="btn" href="#/feed">Back to Kemy</a></div>`; }
export function routeBlock(hash) {
  if (!on()) return null;
  if (!get('live') && /^#\/live\/new/.test(hash)) return blockedScreen(guardMsg.live);
  if (get('dm') === 'off' && /^#\/(chat|messages)(\/|$)/.test(hash)) return blockedScreen(guardMsg.dm);
  return null;
}
// Restricted mode: hide posts marked mature/sensitive (and anything with open reports).
export function hidePost(p) {
  if (!on() || !get('safe') || !p) return false;
  return !!(p.mature || (p.work && p.work.explicit) || p.sensitive || p.nsfw || ((Number(p.reportCount) || 0) - (Number(p.reportOk) || 0) > 0));
}
// Profile visibility for other viewers: 'private' | 'friends' (follow both ways) | 'public'.
export async function profileHidden(u, ownerUid) {
  const v = u && u.pc && u.pc.vis; const me = auth.currentUser?.uid;
  if (!v || v === 'public' || me === ownerUid) return false;
  if (v === 'private' || !me) return true;
  const ex = (id) => getDoc(doc(db, 'follows', id)).then((d) => d.exists()).catch(() => false);
  const [a, b] = await Promise.all([ex(`${me}_${ownerUid}`), ex(`${ownerUid}_${me}`)]);
  return !(a && b);
}
export function privateProfileHtml(name) { return `<div class="pc-block"><div class="pc-moon" aria-hidden="true">🔒</div><h2>This profile is private</h2><p>Only people @${esc(name)} has chosen can see this profile.</p><a class="btn" href="#/explore">Explore</a></div>`; }

// ---------- purchases (for js/billing.js) ----------
function canPurchase() { return !on() || get('buy') !== 'block'; }
async function requirePin(reason) {
  if (!on()) return true;
  if (get('buy') === 'block') { toastish('Purchases are turned off in Parental Controls.'); return false; }
  if (get('buy') === 'open') return true;
  return askPin(reason || 'A grown-up needs to enter the parent PIN to buy this.');
}
window.kemyParental = { canPurchase, requirePin, enabled: on, get: (k) => get(k), askPin, hidePost };

// ---------- Settings page ----------
export function settingsLink() {
  return `<a class="card pad set-link" href="#/settings/parental" id="set-parental" style="margin-top:16px;display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit"><span style="font-size:1.4rem" aria-hidden="true">🛡️</span><span><b>Parental Controls</b><br><span class="muted small">${on() ? 'On · locked with a parent PIN' : 'Set a parent PIN to manage chat, purchases and screen time'}</span></span><span class="spacer"></span><span aria-hidden="true">›</span></a>`;
}
const seg = (name, val, opts) => `<div class="pc-seg" role="radiogroup" aria-label="${esc(name)}">${opts.map(([k, l]) => `<label><input type="radio" name="pc-${name}" value="${k}" ${String(val) === String(k) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
export async function page(main) {
  if (!uid) { location.hash = '#/login'; return; }
  await loadSecret();
  if (on() && secret) {
    main.innerHTML = blockedScreen('Enter the parent PIN to open Parental Controls.').replace('Not available', 'Parental Controls').replace('<a class="btn" href="#/feed">Back to Kemy</a>', '<button class="btn" id="pc-unlock">Enter PIN</button> <a class="btn btn-ghost" href="#/settings">Back</a>');
    const go = async () => { if (await askPin('Enter the parent PIN to change Parental Controls.')) render(main); };
    main.querySelector('#pc-unlock').onclick = go; go(); return;
  }
  render(main);
}
function render(main) {
  const v = { ...DEFAULTS, ...(pc || {}) };
  main.innerHTML = `<div class="pc-page"><div class="row" style="gap:8px;align-items:center"><a class="icon-btn" href="#/settings" aria-label="Back to settings">←</a><h1 class="page-title" style="margin:0">Parental Controls</h1></div>
    <section class="pc-card"><p>${on() ? 'Parental Controls are <b>on</b>. Changes need the parent PIN.' : 'Pick a 4-digit parent PIN to turn on Parental Controls. Kids can’t change these settings without it.'}</p></section>
    <form id="pc-form" class="pc-card">
      <h2>Chat in games &amp; Pal Park</h2>${seg('chat', v.chat, [[true, 'On'], [false, 'Off']])}
      <h2>Direct messages</h2><p class="pc-note">Private messages between players are turned off for everyone. This can’t be switched back on. Public chat in games and Pal Park stays on, with a safety filter.</p>${seg('dm', 'off', [['off', 'Off']])}
      <h2>Going live</h2>${seg('live', v.live, [[true, 'On'], [false, 'Off']])}
      <h2>Commenting</h2>${seg('cmt', v.cmt, [[true, 'On'], [false, 'Off']])}
      <h2>Real-money purchases</h2>${seg('buy', v.buy, [['block', 'Blocked'], ['pin', 'Need PIN'], ['open', 'Allowed']])}
      <h2>Daily time limit</h2>${seg('time', v.time, [[30, '30m'], [60, '1h'], [120, '2h'], [0, 'Off']])}
      <h2>Profile visibility</h2>${window.kemyPhraseOnly !== false ? '<p class="pc-note">This account is under 13, or has no birthday yet, so the profile stays private. A parent PIN cannot turn that off. Kemy does not have a separate parent-consent check.</p>' + seg('vis', 'private', [['private', 'Private']]) : seg('vis', v.vis, [['private', 'Private'], ['friends', 'Friends'], ['public', 'Public']])}
      <h2>Restricted mode</h2>${seg('safe', v.safe, [[true, 'On'], [false, 'Off']])}<p class="pc-note">Hides posts marked mature or sensitive, and posts other people have reported.</p>
      <p class="pc-err" id="pc-err" role="alert"></p>
      <button class="pc-btn pc-wide" type="submit">${on() ? 'Save' : 'Set PIN & turn on'}</button>
    </form>
    ${on() ? '<section class="pc-card"><div class="pc-row"><button class="pc-btn pc-ghost" id="pc-chpin">Change PIN</button><button class="pc-btn pc-ghost" id="pc-off">Turn off</button></div></section>' : ''}</div>`;
  const f = main.querySelector('#pc-form');
  const read = () => { const r = (n) => f.querySelector(`input[name="pc-${n}"]:checked`).value; return { chat: r('chat') === 'true', dm: r('dm'), live: r('live') === 'true', cmt: r('cmt') === 'true', buy: r('buy'), time: Number(r('time')), vis: window.kemyPhraseOnly !== false ? 'private' : r('vis'), safe: r('safe') === 'true' }; };
  f.onsubmit = async (e) => {
    e.preventDefault(); const val = read(), err = f.querySelector('#pc-err'); err.textContent = '';
    try {
      if (!secret) {
        const a = await pinPad('Create parent PIN', 'Pick 4 digits only a grown-up knows.', { allowReset: false }); if (!a) return;
        const b = await pinPad('Confirm PIN', 'Type the PIN again.', { allowReset: false }); if (a !== b) { err.textContent = 'PINs didn’t match. Try again.'; return; }
        await savePin(a);
      }
      await updateDoc(doc(db, 'users', uid), { pc: val }); pc = val; applyBody(); toastish('Parental Controls saved 💜'); render(main);
    } catch (x) { console.error(x); err.textContent = 'Couldn’t save. Check your connection and try again.'; }
  };
  const ch = main.querySelector('#pc-chpin'); if (ch) ch.onclick = async () => {
    const a = await pinPad('New parent PIN', 'Choose a new 4-digit PIN.', { allowReset: false }); if (!a) return;
    const b = await pinPad('Confirm PIN', 'Type it again.', { allowReset: false }); if (a !== b) { toastish('PINs didn’t match.'); return; }
    await savePin(a); toastish('PIN changed');
  };
  const off = main.querySelector('#pc-off'); if (off) off.onclick = async () => {
    if (!confirm('Turn off Parental Controls and remove the PIN?')) return;
    await updateDoc(doc(db, 'users', uid), { pc: deleteField() }); await deleteDoc(doc(db, 'parental', uid)).catch(() => {});
    secret = null; pc = null; applyBody(); toastish('Parental Controls are off'); render(main);
  };
}
