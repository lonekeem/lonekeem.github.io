// The visible side of Kemy Helper moderation: the warning popup, a report with
// the recent chat, and a note the server can strike on. Written by Lone Keem.
import { auth, db } from '../firebase-init.js';
import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { CARE_NOTE, WARN, nameProblem, scan, snapshot } from './mod-policy.js';

const lines = [];
let unsub = null;
let seenWarn = 0;
const AREAS = ['park', 'street', 'plains', 'towns', 'dm', 'live', 'comment', 'game', 'name', 'grief'];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function rememberLine(line) {
  const t = String(line || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!t) return;
  lines.push(t);
  if (lines.length > 8) lines.shift();
}

export function recentChat() { return snapshot(lines); }

export function showWarn(extra) {
  let el = document.getElementById('kh-warn');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kh-warn';
    el.innerHTML = `<div role="dialog" aria-modal="true" aria-labelledby="kh-warn-title"><b id="kh-warn-title">Kemy Helper</b><p id="kh-warn-text"></p><p id="kh-warn-more"></p><button type="button" id="kh-warn-ok">OK</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#kh-warn-ok').onclick = () => { el.hidden = true; };
    el.addEventListener('click', (e) => { if (e.target === el) el.hidden = true; });
  }
  el.querySelector('#kh-warn-text').textContent = WARN;
  el.querySelector('#kh-warn-more').textContent = extra || 'Mean words, personal info, and links stay out of Kemy. A repeat pauses chat for 10 minutes.';
  el.hidden = false;
}

export function showCare() {
  let el = document.getElementById('kh-care');
  if (!el) {
    el = document.createElement('div');
    el.id = 'kh-care';
    el.innerHTML = `<div role="dialog" aria-modal="true"><b>Kemy Helper</b><p id="kh-care-text"></p><button type="button" id="kh-care-ok">OK</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#kh-care-ok').onclick = () => { el.hidden = true; };
  }
  el.querySelector('#kh-care-text').textContent = CARE_NOTE;
  el.hidden = false;
}

function ensureCss() {
  if (document.getElementById('kh-mod-css')) return;
  const st = document.createElement('style');
  st.id = 'kh-mod-css';
  st.textContent = `#kh-warn,#kh-care,#kh-report{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:rgba(20,10,40,.55);padding:18px}
#kh-warn[hidden],#kh-care[hidden],#kh-report[hidden]{display:none}
#kh-warn > div,#kh-care > div,#kh-report > div{max-width:380px;width:100%;background:#ffe14a;color:#3b2504;border:3px solid #6d28d9;border-radius:18px;padding:16px;font-family:Inter,system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.35)}
#kh-warn b,#kh-care b,#kh-report b{font-size:1.15rem}
#kh-warn p,#kh-care p{margin:8px 0}
#kh-warn-text{font-weight:800;font-size:1.05rem}
#kh-warn button,#kh-care button,#kh-report button{min-height:44px;border-radius:999px;font-weight:800}
#kh-warn-ok,#kh-care-ok,#kh-rep-send{width:100%;border:0;background:#6d28d9;color:#fff}
#kh-report label{display:flex;gap:8px;align-items:center;margin:0 0 6px;font-weight:700}
#kh-report textarea,#kh-snap{width:100%;box-sizing:border-box;border-radius:12px;border:0;padding:8px;color:#24133f;font:600 14px Inter,system-ui,sans-serif}
#kh-snap{min-height:72px;background:#fff6cc;margin:8px 0}
#kh-report .row{display:flex;gap:8px;margin-top:8px}
#kh-report .row button{flex:1}
#kh-rep-x{background:#fff;color:#3b2504;border:2px solid #6d28d9}`;
  document.head.appendChild(st);
}

export async function flag(text, area, target, still) {
  const user = auth.currentUser;
  if (!user) return;
  const where = AREAS.includes(area) ? area : 'park';
  const data = {
    uid: user.uid,
    text: String(text || '').slice(0, 200),
    area: where,
    target: String(target || '').slice(0, 128),
    at: serverTimestamp()
  };
  if (still) data.still = Math.max(0, Math.min(600000, still | 0));
  try { await addDoc(collection(db, 'worldChat'), data); } catch { /* the popup already showed */ }
}

export function gate(text, area, target) {
  const s = scan(text);
  if (s.action === 'care') { showCare(); return { ok: false, text: '' }; }
  if (s.action === 'block') { flag(text, area, target); showWarn(); return { ok: false, text: '' }; }
  if (s.action === 'mask' && s.strike) { flag(text, area, target); showWarn(); return { ok: true, text: s.text }; }
  if (s.action === 'mask') return { ok: true, text: s.text };
  return { ok: true, text: String(text || '') };
}

const REASONS = [
  ['bullying', 'Mean or rude'],
  ['spam', 'Spam'],
  ['personal', 'Sharing personal info'],
  ['name', 'Bad name'],
  ['other', 'Something else']
];

export function openReport({ targetType = 'user', targetId = '', targetUid = '', name = 'player', postId = '' } = {}) {
  ensureCss();
  const user = auth.currentUser;
  if (!user) return;
  try { dispatchEvent(new Event('kemy:patrol')); } catch { /* no window */ }
  let el = document.getElementById('kh-report');
  if (el) el.remove();
  el = document.createElement('div');
  el.id = 'kh-report';
  const snap = recentChat();
  el.innerHTML = `<form><b>Report ${esc(name || 'player')}</b><p style="margin:6px 0 8px">Kemy Helper sends this to Keem with the recent chat.</p>
    ${REASONS.map(([k, l], i) => `<label><input type="radio" name="kh-why" value="${k}" ${i ? '' : 'required'}> ${esc(l)}</label>`).join('')}
    <div id="kh-snap" aria-label="Recent chat">${esc(snap || 'No recent chat yet.')}</div>
    <textarea id="kh-rep-note" maxlength="200" placeholder="What happened? (optional)"></textarea>
    <p id="kh-rep-err" style="color:#7a1b1b;font-weight:700;min-height:1.2em"></p>
    <div class="row"><button type="submit" id="kh-rep-send">Send report</button><button type="button" id="kh-rep-x">Close</button></div></form>`;
  document.body.appendChild(el);
  el.querySelector('#kh-rep-x').onclick = () => el.remove();
  el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  el.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    const pick = el.querySelector('input[name=kh-why]:checked');
    const err = el.querySelector('#kh-rep-err');
    if (!pick) { err.textContent = 'Pick a reason.'; return; }
    const lbl = (REASONS.find((r) => r[0] === pick.value) || ['', 'Other'])[1];
    const note = el.querySelector('#kh-rep-note').value.trim();
    const reason = (lbl + (note ? ' · ' + note : '')).slice(0, 500);
    const send = el.querySelector('#kh-rep-send');
    send.disabled = true;
    try {
      const b = writeBatch(db);
      b.set(doc(collection(db, 'reports')), {
        reporterId: user.uid,
        targetType,
        targetId: String(targetId || 'world').slice(0, 200),
        postId: String(postId || '').slice(0, 200),
        reason,
        excerpt: snap.slice(0, 300),
        targetUid: String(targetUid || '').slice(0, 128),
        status: 'open',
        createdAt: serverTimestamp()
      });
      const qref = doc(db, 'reportQuota', user.uid);
      const qSnap = await getDoc(qref).catch(() => null);
      const q = qSnap && qSnap.exists() ? qSnap.data() : null;
      const now = Date.now();
      const ms = (x) => (x && x.toMillis ? x.toMillis() : 0);
      const hOld = q && now - ms(q.hStart) < 3600e3 - 5e3;
      const dOld = q && now - ms(q.dStart) < 864e5 - 5e3;
      if ((hOld && q.hN >= 10) || (dOld && q.dN >= 30)) { err.textContent = 'You’ve sent a lot of reports today. Thank you!'; send.disabled = false; return; }
      const t = serverTimestamp();
      b.set(qref, { hStart: hOld ? q.hStart : t, hN: hOld ? q.hN + 1 : 1, dStart: dOld ? q.dStart : t, dN: dOld ? q.dN + 1 : 1, at: t });
      await b.commit();
      el.remove();
    } catch (er) {
      err.textContent = 'Couldn’t send the report right now.';
      send.disabled = false;
    }
  };
}

function watchStrikes(uid) {
  if (unsub) unsub();
  unsub = onSnapshot(doc(db, 'helperStrikes', uid), (s) => {
    if (!s.exists()) return;
    const d = s.data() || {};
    const at = typeof d.warnAt === 'number' ? d.warnAt : (d.warnAt && d.warnAt.toMillis ? d.warnAt.toMillis() : 0);
    if (!at || at === seenWarn) return;
    seenWarn = at;
    if (d.care && !d.warn) { showCare(); return; }
    const until = typeof d.muteUntil === 'number' ? d.muteUntil : 0;
    const paused = until > Date.now();
    showWarn(paused ? 'Chat is paused for 10 minutes. Keem is the one who can ban or mute for longer.' : '');
  }, () => {});
}

export function startMod() {
  ensureCss();
  window.kemyChatGate = gate;
  window.kemyModFlag = flag;
  window.kemyModWarn = () => showWarn();
  window.kemyModReport = openReport;
  window.kemyModLine = rememberLine;
  window.kemyNameBad = nameProblem;
  window.kemyModRecent = recentChat;
  const bind = (user) => { if (user) watchStrikes(user.uid); else if (unsub) { unsub(); unsub = null; } };
  bind(auth.currentUser);
  auth.onAuthStateChanged(bind);
}
