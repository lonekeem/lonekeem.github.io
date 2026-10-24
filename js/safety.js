// Kemy safety: Community Rules agreement, birthday (13+) check, mod "under 13" flag,
// personal-info warnings, age-clue review items, photo EXIF stripping. Written by Lone Keem
import { doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { scan } from './helper/mod-policy.js';

let C = null; // { S, db, esc, openModal, closeModal, toast, isAdmin, friendlyError }
export function initSafety(ctx) { C = ctx; }

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function ageMonths(y, m, now = new Date()) { return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m); }
export const is13 = (p) => !!(p && Number.isInteger(p.birthY) && ageMonths(p.birthY, p.birthM) >= 156);
// Under 13, unknown age, or a moderator flag. Admins are never limited.
export function limited() {
  if (C && C.isAdmin && C.isAdmin()) return false;
  const S = C && C.S;
  if (!S || !S.user || !S.profile) return false;
  if (flagCache.uid === S.user.uid && flagCache.v === true) return true;
  return !is13(S.profile);
}
export const SAFETY_NOTE = "For safety, links and contact info aren't allowed";
const CONTACT_KIND = new Set(['phone', 'email', 'address', 'social', 'link']);
export function contactBlocked(text) { return CONTACT_KIND.has(scan(String(text || '')).kind); }
// Unknown age, under 13, or a moderator under-13 flag: public chat is phrases only.
export function syncChatMode() {
  const S = C && C.S;
  const admin = !!(C && C.isAdmin && C.isAdmin());
  const user = S && S.user;
  const known = !!(user && S.profile && Number.isInteger(S.profile.birthY) && flagCache.uid === user.uid && flagCache.v !== null);
  const young = !known || !is13(S.profile) || flagCache.v === true;
  window.kemyPhraseOnly = admin ? false : young;
  try { dispatchEvent(new Event('kemy:chat-mode')); } catch { /* no window yet */ }
}

// ---- mod-controlled "under 13" flag (underage/{uid}); cached per session
let flagCache = { uid: '', v: null };
export async function underageFlag(uid) {
  if (!uid) return false;
  if (flagCache.uid === uid && flagCache.v !== null) return flagCache.v;
  let v = false; try { v = (await getDoc(doc(C.db, 'underage', uid))).exists(); } catch { v = false; }
  flagCache = { uid, v }; syncChatMode(); return v;
}
export async function markUnder13(uid, reason = '') {
  await setDoc(doc(C.db, 'underage', uid), { by: C.S.user.uid, reason: String(reason || 'Marked by a moderator').slice(0, 200), at: serverTimestamp() });
}
// Same flag a moderator writes, saved from the birthday when it is under 13.
export async function applyYoungFlag() {
  const S = C && C.S;
  if (!S || !S.user || !S.profile || (C.isAdmin && C.isAdmin())) return;
  if (!Number.isInteger(S.profile.birthY) || is13(S.profile)) return;
  if (flagCache.uid === S.user.uid && flagCache.v === true) return;
  try {
    await markUnder13(S.user.uid, 'Birthday is under 13');
    flagCache = { uid: S.user.uid, v: true };
    syncChatMode();
  } catch { /* already saved, or the rules are not deployed yet */ }
}
export async function undoUnder13(uid) { await deleteDoc(doc(C.db, 'underage', uid)); }

// ---- birthday fields (signup + first post)
export function birthdayFields(id = 'bd') {
  const y = new Date().getFullYear();
  return `<fieldset class="field bd-field" style="border:0;padding:0;margin:0 0 12px"><legend style="font-weight:500;font-size:.92rem;margin-bottom:6px">Your birthday <span class="muted small">(month and year)</span></legend>
    <div class="row" style="gap:8px"><label class="sr-only" for="${id}-m">Month</label><select id="${id}-m" required class="bd-sel"><option value="">Month</option>${MONTHS.map((n, i) => `<option value="${i + 1}">${n}</option>`).join('')}</select>
    <label class="sr-only" for="${id}-y">Year</label><select id="${id}-y" required class="bd-sel"><option value="">Year</option>${Array.from({ length: 100 }, (_, i) => y - i).map((v) => `<option value="${v}">${v}</option>`).join('')}</select></div>
    <p class="bd-honest">Please enter your real birthday. It keeps Kemy safe and fun.</p>
    <p class="small muted" style="margin:4px 0 0">We only keep the month and year. Once saved it can't be changed (a moderator can fix mistakes).</p></fieldset>`;
}
// Shown once before a player can continue past the birthday step. Saved on the account when we can.
let ageHonestAck = false, ageHonestWait = null;
const ageHonestHtml = () => `<div class="age-honest"><p class="age-honest-mark" aria-hidden="true">🎂</p>
  <h2 id="age-honest-title">Be honest about your age</h2>
  <p>Please enter your real birthday. It keeps Kemy safe and fun for everyone. Accounts with a fake age may be limited or banned.</p>
  <button class="btn btn-block" type="button" id="age-honest-ok">I understand</button></div>`;
export function askAgeHonest() {
  const S = C && C.S;
  if (S && S.profile && S.profile.ageHonestAt) return Promise.resolve(true);
  if (ageHonestAck) return Promise.resolve(true);
  if (ageHonestWait) return ageHonestWait;
  ageHonestWait = new Promise((res) => {
    C.openModal(ageHonestHtml(), { dismissable: false });
    const root = document.getElementById('modal-root');
    const box = root && root.querySelector('.modal');
    if (box) box.setAttribute('aria-labelledby', 'age-honest-title');
    document.getElementById('age-honest-ok').onclick = async () => {
      ageHonestAck = true;
      const btn = document.getElementById('age-honest-ok');
      if (btn) btn.disabled = true;
      try {
        if (S && S.user && S.profile && !S.profile.ageHonestAt) {
          await updateDoc(doc(C.db, 'users', S.user.uid), { ageHonestAt: serverTimestamp() });
          S.profile.ageHonestAt = new Date();
        }
      } catch { /* signup writes the same stamp with the new profile */ }
      ageHonestWait = null;
      C.closeModal();
      res(true);
    };
  });
  return ageHonestWait;
}
export function ageHonestPatch() {
  const S = C && C.S;
  // The live Firestore rules don't allow ageHonestAt on a new profile yet, so sending it
  // blocked sign-up with permission-denied. The note is still shown; it just isn't saved
  // with the profile until the new rules are deployed.
  void S;
  return {};
}
export function ageHonestSaved() { ageHonestAck = false; }
export function readBirthday(id = 'bd') {
  const m = Number(document.getElementById(id + '-m')?.value), y = Number(document.getElementById(id + '-y')?.value);
  return m >= 1 && m <= 12 && y > 1900 ? { birthY: y, birthM: m } : null;
}

const KID_MSG = `<h2 style="font-size:1.25rem">Thanks for being honest! 💜</h2>
  <p>Kemy keeps posting, photos, videos, voice, and the public feed for people 13 and older. Your profile stays private, friend requests stay off, and chat is a list of phrases.</p>
  <p>You can still <b>watch videos</b>, <b>play games</b> and use <b>quick chat</b> in games. Have fun!</p>`;
const FLAG_MSG = `<h2 style="font-size:1.25rem">Some features are paused 💜</h2>
  <p>A Kemy moderator thinks you might be under 13, so posting, uploading, comments and messages are switched off for your account to keep you safe.</p>
  <p>You can still <b>watch</b>, <b>play games</b> and use <b>quick chat</b>. If we got it wrong, you can ask the moderators to take another look.</p>`;
export function blockedHtml(flagged) {
  return `<div class="card pad safety-block" id="safety-block" style="max-width:520px;margin:20px auto;text-align:center">${flagged ? FLAG_MSG : KID_MSG}
    <div class="btns" style="justify-content:center;flex-wrap:wrap;gap:8px"><a class="btn" href="#/watch">▶️ Watch</a><a class="btn btn-ghost" href="#/games">🎮 Games</a>${flagged ? '<a class="btn btn-ghost" href="#/support" id="safety-appeal">🛡️ Appeal to moderators</a>' : ''}<a class="btn btn-ghost" href="#/rules">📜 Rules</a></div></div>`;
}
function showBlocked(flagged) {
  C.openModal(blockedHtml(flagged).replace('<div class="btns"', '<div class="btns" data-close-on-nav="1"'));
  document.querySelectorAll('#safety-block a').forEach((a) => a.addEventListener('click', () => C.closeModal()));
}

// ---- Community Rules
export const RULES = [
  ['💜', 'Be kind', 'Treat everyone the way you want to be treated. Cheer people on!'],
  ['🚫', 'No bullying', 'No mean comments, teasing, threats or ganging up on anyone.'],
  ['🧼', 'Keep it clean', 'No swearing and no adult, scary or violent content.'],
  ['🔒', 'Keep your info private', 'Never share your address, school, phone number, email, or a link to another app. Players can’t privately message each other.'],
  ['🎨', 'Post your own stuff', 'Only post videos and pictures you made yourself (it\'s OK if you made them on another app). Don\'t upload other people\'s videos — use 🔁 Repost to share Kemy posts you like.'],
  ['🎵', 'No copyrighted music or videos', 'Don\'t upload songs, shows or movies made by someone else.'],
  ['🙅', 'No false reports', 'Only report real problems. Reporting people to be mean or as a joke can pause your reporting.'],
  ['🚩', 'Report anything that feels wrong', 'Tap ⋯ or 🚩 Report. Moderators check every report, and it\'s private.']
];
export function rulesHtml() {
  return `<ol class="rules-list" style="list-style:none;padding:0;margin:0 0 12px;text-align:left">${RULES.map(([e, t, d]) => `<li style="display:flex;gap:10px;margin:0 0 10px"><span style="font-size:1.5rem" aria-hidden="true">${e}</span><div><b>${t}</b><br><span class="muted small">${d}</span></div></li>`).join('')}</ol>`;
}
export function rulesPage(main) {
  const S = C.S, agreed = !!(S.profile && S.profile.rulesAt);
  main.innerHTML = `<div class="card pad" style="max-width:600px;margin:0 auto" id="rules-page"><h1 class="page-title">📜 Kemy Community Rules</h1>
    <p>Kemy is for creators of all ages, including kids and teens. These rules keep it fun and safe for everyone.</p>${rulesHtml()}
    <p class="small muted">If someone breaks the rules, moderators can remove posts, pause accounts or block people. Full details: <a href="guidelines.html">Community Guidelines</a>.</p>
    ${S.user && S.profile ? (agreed ? '<p class="form-ok">✅ You agreed to the rules. Thank you!</p>' : '<button class="btn btn-block" id="rules-agree">I agree</button>') : ''}
    <p class="small muted center" style="margin-top:14px">Written by Lone Keem</p></div>`;
  const b = document.getElementById('rules-agree');
  if (b) b.onclick = async () => { b.disabled = true; try { await saveAgree(); C.toast('Thanks for agreeing! 💜'); rulesPage(main); } catch (e) { b.disabled = false; C.toast(C.friendlyError(e)); } };
}
async function saveAgree() {
  const S = C.S; await updateDoc(doc(C.db, 'users', S.user.uid), { rulesAt: serverTimestamp() });
  S.profile.rulesAt = new Date();
}

// Ask once for birthday, then the rules. Resolves true only if the user may post/upload/comment/DM.
// Admin and the studio account skip it.
export async function gate() {
  const S = C.S; if (!S.user || !S.profile) return false;
  if (C.isAdmin()) return true;
  if (await underageFlag(S.user.uid)) { showBlocked(is13(S.profile)); return false; }
  if (!Number.isInteger(S.profile.birthY)) {
    if (!(await askAgeHonest())) return false;
    const ok = await new Promise((res) => {
      C.openModal(`<h2 style="font-size:1.25rem">Quick safety check 🎂</h2><p>Before you post, tell us your birthday. This keeps Kemy safe for kids and teens.</p>
        <form id="bd-form" style="text-align:left">${birthdayFields('gbd')}<p class="form-error" id="bd-err"></p>
        <div class="btns"><button class="btn" type="submit">Save</button><button class="btn btn-ghost" type="button" data-close>Not now</button></div></form>`);
      const f = document.getElementById('bd-form');
      f.querySelector('[data-close]').addEventListener('click', () => res(false));
      f.onsubmit = async (ev) => { ev.preventDefault(); const bd = readBirthday('gbd'); if (!bd) { document.getElementById('bd-err').textContent = 'Pick a month and a year.'; return; }
        try { await updateDoc(doc(C.db, 'users', S.user.uid), { ...bd, ...ageHonestPatch() }); Object.assign(S.profile, bd); ageHonestSaved(); C.closeModal(); res(true); }
        catch (e) { document.getElementById('bd-err').textContent = C.friendlyError(e); } };
    });
    if (!ok) return false;
  }
  if (!is13(S.profile)) { await applyYoungFlag(); showBlocked(false); return false; }
  if (!S.profile.rulesAt) {
    const ok = await new Promise((res) => {
      C.openModal(`<h2 style="font-size:1.25rem">📜 Kemy Community Rules</h2><p>Please read these once before your first post.</p>${rulesHtml()}<p class="form-error" id="ra-err"></p>
        <div class="btns"><button class="btn" id="ra-yes">I agree</button><button class="btn btn-ghost" type="button" data-close id="ra-no">Not now</button></div>`);
      document.getElementById('ra-no').addEventListener('click', () => res(false));
      document.getElementById('ra-yes').onclick = async () => { try { await saveAgree(); C.closeModal(); res(true); } catch (e) { document.getElementById('ra-err').textContent = C.friendlyError(e); } };
    });
    if (!ok) return false;
  }
  return true;
}
// Quiet check (no dialogs) for hiding/showing composer UI.
export const canPostNow = () => { const S = C.S; return !!(S.profile && (C.isAdmin() || (is13(S.profile) && S.profile.rulesAt && flagCache.v !== true))); };

// ---- personal info warning
const PII = [
  [/(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/, 'a phone number'],
  [/[\w.+-]+@[\w-]+\.[\w.-]{2,}/, 'an email address'],
  [/\b\d{1,5}\s+(?:[A-Za-z]+\s){1,3}(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|court|ct|boulevard|blvd|way|place|pl|terrace|circle)\b/i, 'a home address'],
  [/\bi\s*(?:go to|attend)\s+[A-Z][\w.]*(?:\s+[A-Z][\w.]*)*\s+(?:elementary|middle|high|school|academy)/i, 'the name of your school']
];
export function piiFound(text) { const t = String(text || ''); for (const [re, what] of PII) if (re.test(t)) return what; return ''; }
// Returns true to continue posting.
export function piiOk(text) {
  if (contactBlocked(text)) { if (C && C.toast) C.toast(SAFETY_NOTE); return false; }
  const w = piiFound(text); if (!w) return true;
  return confirm(`⚠️ Heads up! This looks like it has ${w}.\n\nSharing personal info online can be unsafe. Kemy recommends removing it.\n\nPost anyway?`);
}

// ---- age clues -> review item "Possible under 13" (never auto-locks)
const CLUES = [
  /\b(?:i\s*['’]?\s*m|im|i\s+am)\s+(?:only\s+|just\s+)?(?:[5-9]|1[0-2]|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:years?\s*old|yrs?\s*old|y\s*\/?\s*o)\b/i,
  /\b(?:i\s*['’]?\s*m|im|i\s+am)\s+(?:only\s+|just\s+)?(?:[5-9]|1[0-2])\s*(?:[!.]+\s*|$)(?=$|[^\d])/i,
  /\bmy\s+age\s+is\s+(?:[5-9]|1[0-2])\b|\bi\s+(?:just\s+)?turned\s+(?:[5-9]|1[0-2])\b(?!\s*(?:%|years?\s+ago|minutes|days))/i,
  /\bi\s*['’]?\s*(?:m|am)\s+in\s+(?:the\s+)?(?:1st|2nd|3rd|4th|5th|6th|first|second|third|fourth|fifth|sixth)\s+grade\b/i,
  /\b(?:my|in)\s+(?:1st|2nd|3rd|4th|5th|6th|first|second|third|fourth|fifth|sixth)\s+grade\s+(?:class|teacher)\b/i,
  /\bmy\s+(?:mom|mommy|dad|daddy|mum|parents?)\s+(?:said|won['’]?t\s+let|doesn['’]?t\s+let|took\s+my\s+(?:phone|tablet|ipad))\b/i,
  /\b(?:i\s*['’]?\s*m|im|i\s+am)\s+in\s+elementary(?:\s+school)?\b|\bmy\s+elementary\s+school\b/i
];
export function ageClue(text) { const t = String(text || '').slice(0, 2000); for (const re of CLUES) { const m = t.match(re); if (m) return m[0].trim(); } return ''; }
const flagged = new Set();
export async function scanAge(text, where = 'post', targetId = '', postId = '') {
  try {
    const S = C.S; if (!S.user || C.isAdmin()) return;
    const clue = ageClue(text); if (!clue) return;
    const key = S.user.uid; if (flagged.has(key) || sessionStorage.getItem('kemy-agec-' + key)) return;
    flagged.add(key); sessionStorage.setItem('kemy-agec-' + key, '1');
    const tt = ['post', 'comment', 'user', 'chat message'].includes(where) ? where : 'user';
    await addDoc(collection(C.db, 'reports'), {
      reporterId: S.user.uid, targetType: tt, targetId: String(targetId || S.user.uid).slice(0, 200), postId: String(postId || '').slice(0, 200),
      reason: `🧒 Possible under 13 (auto clue: “${clue.slice(0, 60)}”). Please review; nothing was locked.`,
      excerpt: String(text).slice(0, 300), targetUid: S.user.uid, status: 'open', createdAt: serverTimestamp()
    });
  } catch (e) { console.warn('age scan', e && e.code); }
}

// ---- strip EXIF / location from photos by re-encoding through a canvas (JPEG/PNG/WebP/HEIC that the browser can decode)
export async function stripExif(file) {
  try {
    if (!file || !/^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.type || '') || /gif/i.test(file.type)) return file;
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0); bmp.close && bmp.close();
    const png = /png/i.test(file.type);
    const blob = await new Promise((r) => cv.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.92));
    if (!blob) return file;
    const name = String(file.name || 'photo').replace(/\.(heic|heif|webp)$/i, '.jpg');
    return new File([blob], png ? name : name.replace(/\.png$/i, '.jpg'), { type: blob.type, lastModified: Date.now() });
  } catch { return file; }
}

// ---- shared 1-hour auto pause + Mod Hub report (kind-words filter and anti-spam, js/spam.js)
export async function autoPause({ reason, text = '', word = '', note = '💜 Let’s keep it kind. Your account is paused for 1 hour.' }) {
  const S = C.S; C.toast(note);
  if (!S.user || C.isAdmin()) return;
  try { await setDoc(doc(C.db, 'bans', S.user.uid), { until: Timestamp.fromMillis(Date.now() + 3600e3 - 30e3), reason: String(reason).slice(0, 300), permanent: false, hide: false, by: 'auto', at: serverTimestamp(), name: String(S.profile?.displayName || '').slice(0, 60), uname: String(S.profile?.username || '').slice(0, 30) }); } catch (e) { console.warn('auto timeout', e.code); }
  try { await addDoc(collection(C.db, 'reports'), { reporterId: S.user.uid, targetType: 'user', targetId: S.user.uid, targetUid: S.user.uid, postId: '', reason: `🤖 Auto timeout (1 hour): ${reason}${word ? ` (“${word}”)` : ''}. Lift it or keep it.`.slice(0, 500), excerpt: String(text).slice(0, 300), status: 'open', createdAt: serverTimestamp() }); } catch (e) { console.warn('auto report', e.code); }
}
