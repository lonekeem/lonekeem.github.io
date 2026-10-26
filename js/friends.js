// In-game "Add friend" (Pal Park, house visits, game player cards, results screens).
// A request is friendreq/{fromUid}_{toUid}. Only when the receiver taps Accept does one batch flip it to
// 'accepted' and write BOTH follows (sender→receiver, receiver→sender). Decline / ignore changes nothing.
// firestore.rules: 13+ with a known age on both sides, no blocks, not paused; 20 a day (friendcap/{uid}),
// one per person until answered, 3 days before asking again after a decline.
import { doc, getDoc, collection, query, where, onSnapshot, writeBatch, serverTimestamp } from './fsq.js';

const DAY = 864e5, COOL = 3 * DAY, CAP = 20;
const REAL = /^[A-Za-z0-9]{20,40}$/; // a signed-in person (bots are cpu1 / b0 / …)
const GAME_ROUTE = /^#\/(park|street|arcade|game\/|games\/.)/;
let C = null, started = false;
const incoming = new Map(); // fromUid -> request data (pending, to me)
const outgoing = new Set(); // toUid (pending, from me)
const cooling = new Map();  // toUid -> ms when I may ask again (after a decline)
const followsMe = new Map(); // uid -> bool
const names = new Map();     // uid -> { name, uname }
let unsubs = [];

const me = () => (C && C.S.user ? C.S.user.uid : '');
const esc = (s) => (C ? C.esc(s) : String(s));
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
function eligible(uid) { return !!uid && REAL.test(uid) && uid !== me() && uid !== C.STUDIO_UID; }
function off() { return !C || !C.S.user || C.limited() || C.suspended(); }

// ---------------------------------------------------------------- state
export function state(uid) {
  if (!eligible(uid) || !C.S.user) return 'none';
  if (C.S.blocked && C.S.blocked.has(uid)) return 'blocked';
  if (C.S.following.has(uid) && followsMe.get(uid)) return 'friends';
  if (incoming.has(uid)) return 'incoming';
  if (outgoing.has(uid) || (cooling.get(uid) || 0) > Date.now()) return 'requested';
  return 'add';
}
const LABEL = { add: '➕ Add friend', requested: '⏳ Requested', friends: '✓ Friends', incoming: '💜 Accept friend', blocked: 'Blocked' };
const MINI = { add: '➕', requested: '⏳', friends: '✓', incoming: '💜' };
const checking = new Set();
async function learn(uid) { // one-time look at follows + any old request, so the button shows the right state
  if (checking.has(uid) || followsMe.has(uid) || !me()) return; checking.add(uid);
  try {
    const [f, r] = await Promise.all([getDoc(doc(C.db, 'follows', uid + '_' + me())), getDoc(doc(C.db, 'friendreq', me() + '_' + uid))]);
    followsMe.set(uid, f.exists());
    if (r.exists()) { const d = r.data(); if (d.status === 'declined') cooling.set(uid, ms(d.at) + COOL); }
  } catch (e) { followsMe.set(uid, false); }
  paintAll();
}

// ---------------------------------------------------------------- actions
function fail(e) {
  const m = String((e && (e.code || e.message)) || '');
  if (/friends-off/.test(m)) return C.toast('Friend requests are off on this account.');
  if (/friends-cap/.test(m)) return C.toast(`You’ve sent ${CAP} friend requests today. Try again tomorrow!`);
  C.toast('Couldn’t send that friend request. They may not be able to get friend requests.');
}
export async function send(uid, name, uname) {
  if (!C.S.user) { location.hash = '#/login'; return; }
  if (name) names.set(uid, { name, uname });
  if (C.limited()) return fail({ code: 'friends-off' });
  if (C.suspended()) return C.toast('Your account is paused right now.');
  if (C.S.blocked.has(uid)) return C.toast('Unblock them first to add them as a friend.');
  const st = state(uid);
  if (st === 'incoming') return accept(uid);
  if (st === 'friends') return C.toast('You’re already friends 💜');
  if (st === 'requested') return C.toast('Friend request sent. Waiting for them to say yes!');
  if (st !== 'add') return;
  const db = C.db, my = me();
  try {
    const capRef = doc(db, 'friendcap', my), reqRef = doc(db, 'friendreq', my + '_' + uid);
    const [cs, rs] = await Promise.all([getDoc(capRef), getDoc(reqRef)]);
    if (rs.exists()) { const d = rs.data();
      if (d.status === 'pending') { outgoing.add(uid); paintAll(); return C.toast('Friend request sent. Waiting for them to say yes!'); }
      if (d.status === 'declined' && ms(d.at) + COOL > Date.now()) { cooling.set(uid, ms(d.at) + COOL); paintAll(); return C.toast('Friend request sent. Waiting for them to say yes!'); } }
    const cap = cs.exists() ? cs.data() : null, fresh = !cap || ms(cap.start) + DAY < Date.now();
    if (!fresh && cap.n >= CAP) return fail({ code: 'friends-cap' });
    const b = writeBatch(db);
    b.set(capRef, fresh ? { start: serverTimestamp(), n: 1, at: serverTimestamp() } : { start: cap.start, n: cap.n + 1, at: serverTimestamp() });
    b.set(reqRef, { from: my, to: uid, name: C.S.profile.displayName, uname: C.S.profile.username, status: 'pending', at: serverTimestamp() });
    outgoing.add(uid); paintAll();
    await b.commit();
    C.notify(uid, 'friend');
    C.toast(`Friend request sent${name ? ' to ' + name : ''} 💜`);
  } catch (e) { outgoing.delete(uid); paintAll(); fail(e); }
}
export async function accept(from) {
  if (off()) return C.toast(C.limited() ? 'Friend requests are off on this account.' : 'Your account is paused right now.');
  const db = C.db, my = me();
  try {
    const [a, b2] = await Promise.all([getDoc(doc(db, 'follows', from + '_' + my)), getDoc(doc(db, 'follows', my + '_' + from))]);
    const b = writeBatch(db);
    b.update(doc(db, 'friendreq', from + '_' + my), { status: 'accepted', at: serverTimestamp() });
    if (!a.exists()) b.set(doc(db, 'follows', from + '_' + my), { follower: from, followee: my, createdAt: serverTimestamp() });
    if (!b2.exists()) b.set(doc(db, 'follows', my + '_' + from), { follower: my, followee: from, createdAt: serverTimestamp() });
    await b.commit();
    const who = incoming.get(from) || names.get(from); incoming.delete(from);
    C.S.following.add(from); followsMe.set(from, true); paintAll(); closeToast(from);
    C.notify(from, 'friend_ok');
    C.toast(`You and ${(who && who.name) || 'your new friend'} are friends now 💜`);
    dispatchEvent(new CustomEvent('kemy:friends', { detail: { uid: from } }));
  } catch (e) { C.toast('Couldn’t accept that friend request right now.'); }
}
export async function decline(from) {
  try {
    const b = writeBatch(C.db); b.update(doc(C.db, 'friendreq', from + '_' + me()), { status: 'declined', at: serverTimestamp() }); await b.commit();
    incoming.delete(from); paintAll(); closeToast(from);
  } catch (e) { C.toast('Couldn’t do that right now.'); }
}

// ---------------------------------------------------------------- live: incoming toasts + "they said yes"
function startLive() {
  stopLive(); const my = me(); if (!my) return;
  let boot = true;
  unsubs.push(onSnapshot(query(collection(C.db, 'friendreq'), where('to', '==', my), where('status', '==', 'pending')), (qs) => {
    for (const ch of qs.docChanges()) { const d = ch.doc.data();
      if (ch.type === 'removed') { incoming.delete(d.from); closeToast(d.from); continue; }
      if (C.S.blocked.has(d.from)) continue; // hidden
      incoming.set(d.from, d); names.set(d.from, { name: d.name, uname: d.uname });
      if (ch.type === 'added' && (!boot || ms(d.at) > Date.now() - 120e3)) showToast(d); }
    boot = false; paintAll();
  }, () => {}));
  unsubs.push(onSnapshot(query(collection(C.db, 'friendreq'), where('from', '==', my), where('status', '==', 'pending')), (qs) => {
    for (const ch of qs.docChanges()) { const d = ch.doc.data();
      if (ch.type !== 'removed') { outgoing.add(d.to); continue; }
      outgoing.delete(d.to);
      getDoc(doc(C.db, 'friendreq', my + '_' + d.to)).then((s) => { const x = s.exists() ? s.data() : null;
        if (x && x.status === 'accepted') { C.S.following.add(d.to); followsMe.set(d.to, true); const n = names.get(d.to);
          C.toast(`🎉 ${(n && n.name) || 'Your friend'} said yes! You’re friends now.`); dispatchEvent(new CustomEvent('kemy:friends', { detail: { uid: d.to } })); }
        else if (x && x.status === 'declined') cooling.set(d.to, ms(x.at) + COOL); // quietly: shows "Requested" until the cooldown ends
        paintAll(); }).catch(() => {});
    }
    paintAll();
  }, () => {}));
}
function stopLive() { unsubs.forEach((u) => { try { u(); } catch (e) { /* */ } }); unsubs = []; incoming.clear(); outgoing.clear(); }
function showToast(d) {
  if (off()) return; closeToast(d.from);
  const el = document.createElement('div'); el.className = 'kf-toast'; el.dataset.from = d.from; el.setAttribute('role', 'status');
  el.innerHTML = `<span class="kf-t-ic" aria-hidden="true">💜</span><span class="kf-t-txt"><b>${esc(d.name)}</b> wants to be friends</span>
    <span class="kf-t-btns"><button type="button" class="kf-t-yes">Accept</button><button type="button" class="kf-t-no">Not now</button></span>`;
  el.querySelector('.kf-t-yes').onclick = () => accept(d.from);
  el.querySelector('.kf-t-no').onclick = () => closeToast(d.from); // stays in the inbox
  document.body.appendChild(el); el._t = setTimeout(() => el.remove(), 15000);
}
function closeToast(from) { document.querySelectorAll(`.kf-toast[data-from="${CSS.escape(from)}"]`).forEach((e) => { clearTimeout(e._t); e.remove(); }); }

// ---------------------------------------------------------------- buttons
function paint(el) { const uid = el.dataset.kfBtn || el.dataset.kfPlus; const st = state(uid); if (st === 'add' || st === 'requested') learn(uid);
  if (el.dataset.kfBtn) { el.dataset.p = '1'; el.textContent = LABEL[st] || ''; el.hidden = st === 'none' || st === 'blocked' || off(); el.classList.toggle('kf-on', st === 'friends'); el.disabled = st === 'requested' || st === 'friends'; }
  else { el.textContent = MINI[st] || ''; el.hidden = !MINI[st] || off(); el.dataset.st = st; el.setAttribute('aria-label', (LABEL[st] || '').replace(/^\S+ /, '') + (el.dataset.kfName ? ': ' + el.dataset.kfName : '')); } }
export function paintAll() { document.querySelectorAll('[data-kf-btn],[data-kf-plus]').forEach(paint); }
// Full-size button for a player card / mini profile sheet.
export function buttonHtml(uid, name = '', uname = '') {
  if (!eligible(uid) || !C || !C.S.user || off()) return '';
  if (name) names.set(uid, { name, uname });
  const st = state(uid); if (st === 'add' || st === 'requested') learn(uid);
  return `<button type="button" class="btn kf-btn ${st === 'friends' ? 'kf-on' : ''}" data-kf-btn="${esc(uid)}" ${st === 'requested' || st === 'friends' ? 'disabled' : ''}>${LABEL[st] || ''}</button>`;
}

// Mini profile sheet (from a ➕ on a game card): Add friend · View profile · Report.
function sheet(uid, el) {
  const n = names.get(uid) || {}; const name = n.name || el.dataset.kfName || 'Player', uname = n.uname || el.dataset.kfUname || '';
  document.querySelector('.kf-sheet')?.remove();
  const s = document.createElement('div'); s.className = 'kf-sheet'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-label', name);
  s.innerHTML = `<div class="kf-card"><b class="kf-name">${esc(name)}</b>${uname ? `<span class="kf-un">@${esc(uname)}</span>` : ''}
    <div class="kf-acts">${buttonHtml(uid, name, uname)}${uname ? `<a class="btn btn-ghost" href="#/u/${esc(uname)}">View profile</a>` : ''}<button type="button" class="btn btn-ghost kf-rep">Report</button></div>
    <button type="button" class="kf-x" aria-label="Close">✕</button></div>`;
  s.onclick = (e) => { if (e.target === s || e.target.closest('.kf-x') || e.target.closest('a')) s.remove(); };
  s.querySelector('.kf-rep').onclick = () => { s.remove(); if (window.kemyModReport) window.kemyModReport({ targetType: 'user', targetId: uid, targetUid: uid, name: '@' + (uname || name) }); };
  document.body.appendChild(s);
  if (!n.name && C.getProfile) C.getProfile(uid).then((p) => { if (!p || !s.isConnected) return; names.set(uid, { name: p.displayName || name, uname: p.username || '' }); sheet(uid, el); }).catch(() => {});
}
// A "Add friend" strip for results screens: uids = the players of that game.
export function row(uids, nameOf) {
  if (!C || !C.S.user || off()) return null;
  const list = [...new Set((uids || []).filter(eligible))].slice(0, 8); if (!list.length) return null;
  const el = document.createElement('div'); el.className = 'kf-row'; el.innerHTML = '<span class="kf-row-h">Play again sometime? Add a friend:</span>';
  for (const u of list) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'kf-chip'; b.dataset.kfRowUid = u;
    const n = (nameOf && nameOf(u)) || names.get(u); if (n) names.set(u, typeof n === 'string' ? { name: n } : n);
    b.innerHTML = `<span class="kf-chip-n">${esc((names.get(u) || {}).name || 'Player')}</span><span data-kf-plus="${esc(u)}" class="kf-plus kf-inline"></span>`;
    el.appendChild(b);
    if (!names.has(u) && C.getProfile) C.getProfile(u).then((p) => { if (p) { names.set(u, { name: p.displayName, uname: p.username }); b.querySelector('.kf-chip-n').textContent = p.displayName; } }).catch(() => {});
  }
  requestAnimationFrame(paintAll); return el;
}

// ---------------------------------------------------------------- decorate game screens with a small ➕
const HOSTS = '.zl-p[data-u],.sl-p[data-u],[data-kf-uid]';
const AVS = '.avatar[data-uid]';
function plusFor(uid, name) { const b = document.createElement('button'); b.type = 'button'; b.className = 'kf-plus'; b.dataset.kfPlus = uid; if (name) b.dataset.kfName = name; paint(b); return b; }
function decorate() {
  if (!C || !C.S.user || off() || !GAME_ROUTE.test(location.hash)) { document.querySelectorAll('.kf-plus:not(.kf-inline)').forEach((e) => e.remove()); return; }
  const roots = [document.body];
  for (const r of roots) {
    r.querySelectorAll(HOSTS).forEach((h) => { const uid = h.dataset.kfUid || h.dataset.u; if (!eligible(uid)) return;
      if (h.querySelector(':scope > .kf-plus')) return; h.classList.add('kf-host'); h.appendChild(plusFor(uid, h.dataset.kfName || h.querySelector('b')?.textContent?.replace(/\s*(👑|\(you\))\s*/g, '') || '')); });
    r.querySelectorAll(AVS).forEach((a) => { const uid = a.dataset.uid; if (!eligible(uid) || a.closest('.kf-row,.kf-sheet,[data-kf-uid],.zl-p,.sl-p,.list-item,.lb-row')) return;
      const nx = a.nextElementSibling; if (nx && nx.dataset && nx.dataset.kfPlus === uid) return;
      const old = a.parentElement && a.parentElement.querySelector(`:scope > .kf-plus[data-kf-plus="${CSS.escape(uid)}"]`);
      a.after(old || plusFor(uid, a.getAttribute('aria-label')?.replace(/ profile$/, '') || '')); });
  }
}
let queued = false;
function schedule() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; decorate(); document.querySelectorAll('[data-kf-plus]:not([data-st]),[data-kf-btn]:not([data-p])').forEach((e) => { e.dataset.p = '1'; paint(e); }); }); }

// ---------------------------------------------------------------- inbox (js/app.js pageNotifications hook)
export function noteHtml(n, av, who, when) {
  if (n.type === 'friend_ok') return `<a class="list-item ${n.read ? '' : 'unread'}" href="#/u/${esc(n.fromUsername)}">${av}<div class="meta"><div><b>${who}</b> accepted your friend request. You’re friends now 💜 <span class="muted small">· ${esc(when)}</span></div></div></a>`;
  return `<div class="list-item kf-note ${n.read ? '' : 'unread'}" data-kf-note="${esc(n.fromUid)}">${av}<div class="meta"><div><a href="#/u/${esc(n.fromUsername)}"><b>${who}</b></a> wants to be friends <span class="muted small">· ${esc(when)}</span></div>
    <div class="kf-note-acts"><span class="muted small">…</span></div></div></div>`;
}
export function wireNotes(root) {
  if (!root) return;
  const seen = new Set();
  root.querySelectorAll('[data-kf-note]').forEach(async (el) => {
    const from = el.dataset.kfNote, acts = el.querySelector('.kf-note-acts');
    if (seen.has(from)) { acts.innerHTML = ''; return; } seen.add(from); // one request per person: only the newest note gets the buttons
    let d = null; try { const s = await getDoc(doc(C.db, 'friendreq', from + '_' + me())); d = s.exists() ? s.data() : null; } catch (e) { /* */ }
    if (d && d.status === 'pending' && !C.S.blocked.has(from)) {
      acts.innerHTML = '<button type="button" class="btn btn-sm kf-yes">Accept</button> <button type="button" class="btn btn-sm btn-ghost kf-no">Decline</button>';
      acts.querySelector('.kf-yes').onclick = async () => { acts.innerHTML = '<span class="muted small">…</span>'; incoming.set(from, d); await accept(from); wireNotes(root); };
      acts.querySelector('.kf-no').onclick = async () => { acts.innerHTML = '<span class="muted small">…</span>'; await decline(from); wireNotes(root); };
    } else acts.innerHTML = `<span class="muted small">${d && d.status === 'accepted' ? '✓ Friends' : d && d.status === 'declined' ? 'Declined' : 'No longer pending'}</span>`;
  });
}

// ---------------------------------------------------------------- setup
const CSS_TXT = `
.kf-plus{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;min-width:24px;padding:0;border-radius:50%;border:2px solid #fff;background:#7c3aed;color:#fff;font:800 12px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.35);vertical-align:top;margin-left:-12px;position:relative;z-index:2;top:-6px;flex:none}
.kf-plus[data-st=friends]{background:#16a34a}.kf-plus[data-st=requested]{background:#6b7280}.kf-plus[data-st=incoming]{background:#db2777}
.kf-plus[hidden]{display:none}
.kf-host{position:relative}.kf-host>.kf-plus{position:absolute;top:4px;right:4px;margin:0}
.p3-safe button.kf-plus{padding:0;border:2px solid #fff;background:#7c3aed;font:800 11px/1 system-ui,sans-serif;width:22px;height:22px;min-width:22px}.p3-safe button.kf-plus[data-st=friends]{background:#16a34a}.p3-safe button.kf-plus[data-st=requested]{background:#6b7280}.p3-safe button.kf-plus[data-st=incoming]{background:#db2777}
[data-kf-inline].kf-host>.kf-plus{position:static;margin:0 0 0 3px;width:18px;height:18px;min-width:18px;font-size:10px;border-width:1px;vertical-align:middle}
.kf-plus.kf-inline{position:static;margin:0 0 0 6px;top:0;width:22px;height:22px;min-width:22px}
.kf-btn.kf-on{background:#16a34a;color:#fff;opacity:1}
.kf-toast{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top));z-index:2147480300;display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;background:#2b1d55;color:#fff;border:2px solid #a78bfa;border-radius:18px;padding:10px 12px;box-shadow:0 10px 30px rgba(0,0,0,.5);width:min(calc(100% - 20px),420px);box-sizing:border-box;font:600 14px system-ui,sans-serif}
.kf-t-btns{display:flex;gap:6px;flex:0 0 auto}.kf-t-txt{flex:1 1 40%;min-width:0;line-height:1.25}.kf-toast button{min-height:36px!important;padding:0 12px!important}
.kf-toast button{min-height:40px;padding:0 14px;border-radius:999px;border:0;font:800 14px system-ui,sans-serif;cursor:pointer}.kf-t-yes{background:#22c55e;color:#06260f}.kf-t-no{background:rgba(255,255,255,.15);color:#fff}
.kf-sheet{position:fixed;inset:0;z-index:2147480250;background:rgba(10,5,30,.55);display:flex;align-items:flex-end;justify-content:center}
.kf-card{position:relative;background:#1b1428;color:#fff;border:1px solid #4c3a7a;border-radius:20px 20px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom));width:min(480px,100%);text-align:center;font-family:system-ui,sans-serif}
.kf-name{display:block;font-size:20px}.kf-un{opacity:.7;font-size:14px}.kf-acts{display:flex;flex-direction:column;gap:8px;margin-top:12px}.kf-acts .btn{min-height:46px}
.kf-x{position:absolute;top:8px;right:10px;background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
.kf-row{margin:10px 0 4px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-items:center}.kf-row-h{width:100%;font-size:13px;opacity:.8}
.kf-chip{display:inline-flex;align-items:center;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:inherit;padding:4px 6px 4px 12px;font:700 13px system-ui,sans-serif;cursor:pointer}
.kf-note-acts{margin-top:6px;display:flex;gap:6px}`;
export function initFriends(ctx) {
  C = ctx;
  if (!document.getElementById('kf-css')) { const st = document.createElement('style'); st.id = 'kf-css'; st.textContent = CSS_TXT; document.head.appendChild(st); }
  document.addEventListener('click', (e) => {
    const plus = e.target.closest('[data-kf-plus]'), btn = e.target.closest('[data-kf-btn]'), chip = e.target.closest('[data-kf-row-uid]');
    if (btn) { e.preventDefault(); e.stopPropagation(); const uid = btn.dataset.kfBtn, n = names.get(uid) || {}; send(uid, n.name, n.uname); return; }
    if (chip) { e.preventDefault(); e.stopPropagation(); const uid = chip.dataset.kfRowUid, n = names.get(uid) || {}; send(uid, n.name, n.uname); return; }
    if (plus) { e.preventDefault(); e.stopPropagation(); sheet(plus.dataset.kfPlus, plus); }
  }, true);
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  addEventListener('hashchange', schedule);
  window.kemyFriends = { send, accept, decline, state, buttonHtml, row, noteHtml, wireNotes, paintAll };
}
// Call on sign-in / sign-out.
export function friendsUser(on) {
  followsMe.clear(); cooling.clear(); checking.clear();
  if (on) { startLive(); started = true; } else if (started) { stopLive(); started = false; }
  schedule();
}
