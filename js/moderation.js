// Kemy moderator system: blue-check moderators (appointed by the admin), reports inbox,
// warnings / suspensions, moderator notices and an audit log. All enforced by firestore.rules
// (roles/, bans/, hiddenUsers/, modLog/, reports/). No server: "remove account" = permanent
// suspension + hiding the person's posts and comments everywhere.
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, onSnapshot, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const DAY = 86400000;
const FOREVER = () => Timestamp.fromMillis(Date.UTC(9999, 0, 1));
export const TEMPLATES = {
  thanks: ['Thanks for your report! We checked it and took action. 💜', 'Thanks for your report! We looked and it follows the rules, so we left it up. 💜', 'Thanks for helping keep Kemy safe and kind! 💜'],
  warn: ['Please be kind. Your message broke the Kemy rules (no mean words or bullying). Next time your account may be paused.', 'Please only post things that are safe for kids. We removed your post.', 'Please don’t spam or share personal info (like address or phone). This is a warning.'],
  ban: ['Bullying or mean messages', 'Unsafe or grown-up content', 'Spam', 'Sharing personal info', 'Pretending to be someone else']
};
const TYPE_LABEL = { post: 'Video / post', comment: 'Comment', user: 'User', live: 'Live', 'live chat': 'Live chat', 'chat message': 'Chat message', series: 'Series', movie: 'Movie', song: 'Song' };
const STATUS_LABEL = { open: 'Open', review: 'In review', resolved: 'Resolved' };

// A Set that also hides removed accounts (used in place of S.blocked).
export class BlockSet extends Set { constructor(it, hidden) { super(it); this._h = hidden; } has(x) { return super.has(x) || (this._h && this._h.has(x)); } }

export function createModeration(ctx) {
  const { S, db, esc, toast, friendlyError, isAdmin, avatar, timeAgo, getProfile, openModal, closeModal, onChange } = ctx;
  S.mods = S.mods || new Set(); S.hidden = S.hidden || new Set(); S.ban = null; S.modOpen = 0;
  let reportsUnsub = null;
  const $ = (s, r = document) => r.querySelector(s);
  const iAmMod = () => !!S.user && (isAdmin() || S.mods.has(S.user.uid));
  const isModUid = (uid) => S.mods.has(uid);
  const badge = (uid) => (uid && S.mods.has(uid)) ? '<span class="badge mod-badge" data-modbadge role="button" tabindex="0" title="Kemy Moderator" aria-label="Kemy Moderator">✓</span>' : '';
  window.kemyModBadge = badge; window.kemyIsMod = isModUid;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-modbadge]'); if (!b) return; e.preventDefault(); e.stopPropagation(); toast('✓ Kemy Moderator · helps keep Kemy safe and kind'); }, true);

  // Public data, loaded for everyone (signed in or not).
  let rolesOk; const rolesReady = new Promise((r) => (rolesOk = r)); setTimeout(() => rolesOk(), 3000);
  onSnapshot(collection(db, 'roles'), (qs) => { S.mods = new Set(qs.docs.filter((d) => d.data().mod).map((d) => d.id)); rolesOk(); if (S.user) watchReports(); onChange && onChange('mods'); }, () => rolesOk());
  onSnapshot(collection(db, 'hiddenUsers'), (qs) => { S.hidden.clear(); qs.docs.forEach((d) => S.hidden.add(d.id)); }, () => {});

  const activeBan = (b) => b && b.until && b.until.toMillis() > Date.now() ? b : null;
  async function loadMine() {
    if (reportsUnsub) { reportsUnsub(); reportsUnsub = null; }
    S.ban = null; S.modOpen = 0;
    if (!S.user) return;
    try { const s = await getDoc(doc(db, 'bans', S.user.uid)); S.ban = s.exists() ? activeBan(s.data()) : null; } catch (e) { /* no ban */ }
    S.globalUnsubs && S.globalUnsubs.push(onSnapshot(doc(db, 'bans', S.user.uid), (s) => { const was = !!S.ban; S.ban = s.exists() ? activeBan(s.data()) : null; if (was !== !!S.ban) onChange && onChange('ban'); }, () => {}));
    watchReports();
  }
  function watchReports() {
    if (reportsUnsub || !iAmMod()) return;
    reportsUnsub = onSnapshot(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(300)), (qs) => {
      S.modOpen = qs.docs.filter((d) => (d.data().status || 'open') !== 'resolved').length; onChange && onChange('count');
    }, () => {});
    S.globalUnsubs && S.globalUnsubs.push(() => { if (reportsUnsub) reportsUnsub(); reportsUnsub = null; });
  }

  // ------------------------------------------------------------ helpers
  const myName = () => (S.profile && S.profile.displayName) || 'Moderator';
  const log = (action, targetUid, targetName, detail = '', reportId = '') =>
    addDoc(collection(db, 'modLog'), { by: S.user.uid, byName: myName().slice(0, 60), action, targetUid: targetUid || '', targetName: String(targetName || '').slice(0, 60), reportId, detail: String(detail).slice(0, 400), at: serverTimestamp() }).catch((e) => console.warn('modLog', e));
  const notice = (uid, text, postId = '') => setDoc(doc(collection(db, 'users', uid, 'notifications')), { type: 'mod', fromUid: S.user.uid, fromName: 'Kemy Moderators', fromUsername: '', postId: postId || '', text: String(text).slice(0, 400), createdAt: serverTimestamp(), read: false });
  const fmtUntil = (b) => b.permanent ? 'permanently' : 'until ' + b.until.toDate().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  const mark = (rid, status, action = '') => updateDoc(doc(db, 'reports', rid), { status, action, handledBy: S.user.uid, handledAt: serverTimestamp() });

  async function targetUidOf(r) {
    if (r.targetUid) return r.targetUid;
    try {
      if (r.targetType === 'user') return r.targetId;
      if (r.targetType === 'comment') { const s = await getDoc(doc(db, 'posts', r.postId, 'comments', r.targetId)); return s.exists() ? s.data().authorId : ''; }
      if (r.targetType === 'live' || r.targetType === 'live chat') { if (r.targetType === 'live') { const s = await getDoc(doc(db, 'lives', r.targetId)); return s.exists() ? s.data().hostId : ''; } const [l, c] = r.targetId.split('/'); const s = await getDoc(doc(db, 'lives', l, 'chat', c)); return s.exists() ? (s.data().uid || s.data().authorId || '') : ''; }
      if (r.targetType === 'series') { const s = await getDoc(doc(db, 'series', r.targetId)); return s.exists() ? s.data().ownerId : ''; }
      const s = await getDoc(doc(db, 'posts', r.postId || r.targetId)); return s.exists() ? s.data().authorId : '';
    } catch (e) { return ''; }
  }
  async function removeContent(r) {
    const t = r.targetType;
    if (t === 'post' || t === 'movie' || t === 'song') await deleteDoc(doc(db, 'posts', r.postId || r.targetId));
    else if (t === 'comment') { const cs = await getDoc(doc(db, 'posts', r.postId, 'comments', r.targetId)); if (cs.exists()) await ctx.comments().deleteComment(r.postId, { id: cs.id, ...cs.data() }); }
    else if (t === 'live chat') { const [lid, cid] = r.targetId.split('/'); await deleteDoc(doc(db, 'lives', lid, 'chat', cid)); }
    else if (t === 'chat message') { const [cid, mid] = r.targetId.split('/'); await deleteDoc(doc(db, 'chats', cid, 'messages', mid)); }
    else if (t === 'series') await deleteDoc(doc(db, 'series', r.targetId));
    else throw new Error('Nothing to remove for a ' + t + ' report. Use Suspend instead.');
  }

  // ------------------------------------------------------------ dialogs
  function templatePicker(list, id) { return `<div class="mod-tpl">${list.map((t, i) => `<button type="button" class="chip" data-tpl="${i}">${esc(t.length > 44 ? t.slice(0, 42) + '…' : t)}</button>`).join('')}</div>`; }
  function wireTpl(list, ta) { document.querySelectorAll('.modal [data-tpl]').forEach((b) => (b.onclick = () => { ta.value = list[+b.dataset.tpl]; ta.focus(); })); }

  function messageDialog(uid, name, kind, { reportId = '', postId = '' } = {}) {
    const list = kind === 'warn' ? TEMPLATES.warn : TEMPLATES.thanks;
    openModal(`<h2 style="font-size:1.2rem">${kind === 'warn' ? '⚠️ Warn' : '💌 Message'} ${esc(name || 'user')}</h2>
      <p class="muted small">Sent as an in-app notification from <b>Kemy Moderators</b>.</p>
      <form id="mod-msg" style="text-align:left">${templatePicker(list)}
        <div class="field"><label for="mod-msg-t">Message</label><textarea id="mod-msg-t" maxlength="400" required>${esc(list[0])}</textarea></div>
        <div class="btns"><button class="btn" type="submit">Send</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`);
    const ta = $('#mod-msg-t'); wireTpl(list, ta);
    return new Promise((res) => { $('#mod-msg').onsubmit = async (e) => { e.preventDefault(); try { await notice(uid, ta.value.trim(), postId); log(kind === 'warn' ? 'warn' : 'message', uid, name, ta.value.trim(), reportId); closeModal(); toast('Sent ✓'); res(true); } catch (er) { toast(friendlyError(er)); } }; });
  }

  function banDialog(uid, name, uname, { reportId = '' } = {}) {
    if (uid === S.user.uid) return toast('You can’t suspend yourself');
    if (S.mods.has(uid) && !isAdmin()) return toast('Only the admin can suspend a moderator');
    openModal(`<h2 style="font-size:1.2rem">⛔ Suspend ${esc(name || 'user')}</h2>
      <form id="mod-ban" style="text-align:left">
        <div class="mod-dur" role="radiogroup" aria-label="How long">
          <label><input type="radio" name="dur" value="1" checked> 1 day</label><label><input type="radio" name="dur" value="7"> 7 days</label>
          <label><input type="radio" name="dur" value="30"> 30 days</label><label><input type="radio" name="dur" value="perm"> Permanent</label></div>
        <label class="small" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="mod-hide"> Remove account: hide all their posts &amp; comments</label>
        ${templatePicker(TEMPLATES.ban)}
        <div class="field"><label for="mod-ban-r">Reason (they will see this)</label><textarea id="mod-ban-r" maxlength="300" required>${esc(TEMPLATES.ban[0])}</textarea></div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mod-ban-n" checked> Send them a notice with the reason</label>
        <div class="btns"><button class="btn btn-danger" type="submit">Suspend</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`);
    const ta = $('#mod-ban-r'); wireTpl(TEMPLATES.ban, ta);
    $('#mod-hide').onchange = (e) => { if (e.target.checked) document.querySelector('input[name=dur][value=perm]').checked = true; };
    return new Promise((res) => { $('#mod-ban').onsubmit = async (e) => {
      e.preventDefault(); const v = document.querySelector('input[name=dur]:checked').value, hide = $('#mod-hide').checked, perm = v === 'perm' || hide, reason = ta.value.trim();
      const until = perm ? FOREVER() : Timestamp.fromMillis(Date.now() + (+v) * DAY);
      try {
        await setDoc(doc(db, 'bans', uid), { until, reason, permanent: perm, hide, by: S.user.uid, at: serverTimestamp(), name: String(name || '').slice(0, 60), uname: String(uname || '').slice(0, 30) });
        if (hide) await setDoc(doc(db, 'hiddenUsers', uid), { by: S.user.uid, at: serverTimestamp() });
        const when = perm ? 'permanently' : `for ${v} day${v === '1' ? '' : 's'}`;
        if ($('#mod-ban-n').checked) await notice(uid, `Your Kemy account is suspended ${when}. Reason: ${reason}`).catch(() => {});
        log(hide ? 'remove-account' : 'ban', uid, name, `${when}: ${reason}`, reportId);
        closeModal(); toast(`${name || 'User'} suspended ${when}`); res(true);
      } catch (er) { toast(friendlyError(er)); }
    }; });
  }
  async function unban(uid, name) {
    if (!confirm(`Unsuspend ${name || 'this user'}?`)) return false;
    try { await deleteDoc(doc(db, 'bans', uid)); await deleteDoc(doc(db, 'hiddenUsers', uid)).catch(() => {}); log('unban', uid, name); await notice(uid, 'Your Kemy account is active again. Please follow the rules and be kind. 💜').catch(() => {}); toast('Unsuspended'); return true; }
    catch (e) { toast(friendlyError(e)); return false; }
  }

  // ------------------------------------------------------------ suspended screen
  function suspendedHtml() {
    const b = S.ban;
    return `<section class="card pad center mod-susp"><div style="font-size:3rem" aria-hidden="true">⏸️</div><h1 class="page-title">Your account is paused</h1>
      <p>Your account is suspended <b>${esc(fmtUntil(b))}</b> for: <b>${esc(b.reason)}</b></p>
      <p class="muted small">While it’s paused you can’t post, comment, chat, talk in Pal Park or join games. ${b.permanent ? '' : 'It turns back on by itself when the time is up.'} If you think this is a mistake, ask a grown-up to email <a href="mailto:lillykemoy1@gmail.com?subject=Kemy%20account%20suspension">the Kemy team</a>.</p>
      <div class="btns" style="justify-content:center;flex-wrap:wrap"><a class="btn btn-sm btn-ghost" href="#/notifications">Notifications</a><a class="btn btn-sm btn-ghost" href="#/settings">Settings</a><a class="btn btn-sm btn-ghost" href="guidelines.html">Kemy rules</a></div></section>`;
  }
  const isSuspended = () => !!(S.user && activeBan(S.ban) && !isAdmin());

  // ------------------------------------------------------------ user search
  async function searchUsers(q) {
    q = q.trim().toLowerCase().replace(/^@/, ''); if (q.length < 1) return [];
    const end = q + '\uf8ff', seen = new Map();
    const runs = await Promise.allSettled([
      getDocs(query(collection(db, 'users'), where('usernameLower', '>=', q), where('usernameLower', '<=', end), limit(10))),
      getDocs(query(collection(db, 'users'), where('displayNameLower', '>=', q), where('displayNameLower', '<=', end), limit(10)))]);
    runs.forEach((r) => r.status === 'fulfilled' && r.value.docs.forEach((d) => seen.set(d.id, { uid: d.id, ...d.data() })));
    return [...seen.values()];
  }
  function userRow(u, { roles = false } = {}) {
    const mod = S.mods.has(u.uid);
    return `<div class="list-item mod-user" data-uid="${esc(u.uid)}">${avatar(u, '', false)}<div class="meta"><b>${esc(u.displayName)}</b>${badge(u.uid)}<p>@${esc(u.username)}${mod ? ' · Moderator' : ''}</p>
      <div class="mod-acts">${roles ? (mod ? '<button class="btn btn-sm btn-ghost" data-u="unmod">Remove moderator</button>' : '<button class="btn btn-sm" data-u="mod">Make moderator</button>')
        : `<a class="btn btn-sm btn-ghost" href="#/u/${esc(u.username)}">Profile</a><button class="btn btn-sm btn-ghost" data-u="warn">Warn</button><button class="btn btn-sm btn-danger" data-u="ban">Suspend</button><button class="btn btn-sm btn-ghost" data-u="unban">Unsuspend</button>`}</div></div></div>`;
  }
  function wireUserList(box, users, { roles = false, onDone } = {}) {
    box.innerHTML = users.length ? users.map((u) => userRow(u, { roles })).join('') : '<div class="empty">No one found.</div>';
    box.onclick = async (e) => {
      const b = e.target.closest('[data-u]'); if (!b) return; const uid = b.closest('[data-uid]').dataset.uid; const u = users.find((x) => x.uid === uid); if (!u) return;
      const a = b.dataset.u;
      if (a === 'mod' || a === 'unmod') {
        if (!isAdmin()) return toast('Only the admin can change moderators');
        try {
          if (a === 'mod') { await setDoc(doc(db, 'roles', uid), { mod: true, name: String(u.displayName || '').slice(0, 60), uname: String(u.username || '').slice(0, 30), by: S.user.uid, at: serverTimestamp() }); S.mods.add(uid); log('make-mod', uid, u.displayName); notice(uid, 'You are now a Kemy Moderator ✓ Find Moderator Tools in the top bar. Thank you for keeping Kemy kind!').catch(() => {}); toast(`${u.displayName} is now a moderator ✓`); }
          else { if (!confirm(`Remove ${u.displayName} as a moderator?`)) return; await deleteDoc(doc(db, 'roles', uid)); S.mods.delete(uid); log('remove-mod', uid, u.displayName); toast('Moderator removed'); }
          wireUserList(box, users, { roles, onDone }); onDone && onDone();
        } catch (er) { toast(friendlyError(er)); }
      } else if (a === 'warn') messageDialog(uid, u.displayName, 'warn');
      else if (a === 'ban') banDialog(uid, u.displayName, u.username);
      else if (a === 'unban') unban(uid, u.displayName);
    };
  }

  // ------------------------------------------------------------ admin page section
  async function adminSection(root) {
    root.innerHTML = `<div class="card pad adm-tool mod-card" style="margin-bottom:12px"><b style="font-size:1.05rem"><span class="badge mod-badge" aria-hidden="true">✓</span> Moderators</b>
      <p class="muted small" style="margin:3px 0 8px">Moderators get a blue check and the Moderator Tools (reports, warnings, suspensions). Only you can add or remove them.</p>
      <div id="adm-mods-list"><div class="spinner"></div></div>
      <div class="field" style="margin-top:10px"><label for="adm-mod-q">Find a person by name or @handle</label><input id="adm-mod-q" type="search" placeholder="e.g. maya or @maya" autocomplete="off"></div>
      <div id="adm-mod-res"></div>
      <p class="small" style="margin:10px 0 0"><a class="btn btn-sm" href="#/mod">🛡️ Open Moderator Tools</a> <a class="btn btn-sm btn-ghost" href="#/mod/log">📜 Audit log</a></p></div>`;
    const listBox = $('#adm-mods-list', root), res = $('#adm-mod-res', root);
    const showMods = async () => {
      const snap = await getDocs(collection(db, 'roles')).catch(() => null); const ids = snap ? snap.docs.map((d) => d.id) : [];
      const users = (await Promise.all(ids.map((id) => getProfile(id)))).filter(Boolean);
      if (!users.length) listBox.innerHTML = '<p class="muted small">No moderators yet.</p>'; else wireUserList(listBox, users, { roles: true, onDone: showMods });
    };
    showMods();
    let t = 0; $('#adm-mod-q', root).oninput = (e) => { clearTimeout(t); const q = e.target.value; t = setTimeout(async () => { if (!q.trim()) { res.innerHTML = ''; return; } wireUserList(res, await searchUsers(q), { roles: true, onDone: showMods }); }, 250); };
  }

  // ------------------------------------------------------------ Moderator Tools page (#/mod, #/mod/users, #/mod/log)
  async function page(tab, token, stale) {
    const main = ctx.main;
    if (!S.user) { location.hash = '#/login'; return; }
    if (!iAmMod()) { main.innerHTML = '<section class="card pad center" style="max-width:520px;margin:30px auto"><h1 class="page-title">🛡️ Moderators only</h1><p class="muted">This page is for Kemy moderators.</p><a class="btn btn-sm btn-ghost" href="#/watch">Back to Kemy</a></section>'; return; }
    tab = tab || 'reports';
    main.innerHTML = `<div class="mod-page"><h1 class="page-title">🛡️ Moderator Tools</h1>
      <nav class="tabs mod-tabs"><a href="#/mod" class="${tab === 'reports' ? 'active' : ''}">🚩 Reports${S.modOpen ? ` <span class="mod-count">${S.modOpen}</span>` : ''}</a><a href="#/mod/users" class="${tab === 'users' ? 'active' : ''}">👥 Users</a>${isAdmin() ? `<a href="#/mod/log" class="${tab === 'log' ? 'active' : ''}">📜 Audit log</a><a href="#/admin">⚙️ Team</a>` : ''}</nav>
      <div id="mod-body"><div class="spinner"></div></div></div>`;
    const body = $('#mod-body');
    if (tab === 'users') return usersTab(body);
    if (tab === 'log') return logTab(body);
    return reportsTab(body, token, stale);
  }

  async function usersTab(body) {
    body.innerHTML = `<div class="card pad"><div class="field"><label for="mod-uq">Find a person by name or @handle</label><input id="mod-uq" type="search" placeholder="Search people" autocomplete="off"></div><div id="mod-ures"></div></div>
      <h2 class="mod-h2">⛔ Suspended accounts</h2><div id="mod-bans" class="card" style="padding:6px"><div class="spinner"></div></div>`;
    let t = 0; $('#mod-uq').oninput = (e) => { clearTimeout(t); const q = e.target.value; t = setTimeout(async () => { if (!q.trim()) { $('#mod-ures').innerHTML = ''; return; } wireUserList($('#mod-ures'), await searchUsers(q)); }, 250); };
    try {
      const snap = await getDocs(query(collection(db, 'bans'), orderBy('at', 'desc'), limit(100)));
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((b) => activeBan(b));
      const box = $('#mod-bans');
      box.innerHTML = rows.length ? rows.map((b) => `<div class="list-item" data-uid="${esc(b.uid)}"><div class="meta"><b>${esc(b.name || b.uid)}</b> <span class="muted small">@${esc(b.uname || '')}</span><p>${esc(fmtUntil(b))} · ${esc(b.reason)}${b.hide ? ' · content hidden' : ''}</p><div class="mod-acts"><button class="btn btn-sm btn-ghost" data-unban>Unsuspend</button></div></div></div>`).join('') : '<div class="empty">No one is suspended.</div>';
      box.onclick = async (e) => { const b = e.target.closest('[data-unban]'); if (!b) return; const row = b.closest('[data-uid]'); const r = rows.find((x) => x.uid === row.dataset.uid); if (await unban(r.uid, r.name)) row.remove(); };
    } catch (e) { $('#mod-bans').innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
  }

  async function logTab(body) {
    if (!isAdmin()) { body.innerHTML = '<div class="empty">Only the admin can see the audit log.</div>'; return; }
    try {
      const snap = await getDocs(query(collection(db, 'modLog'), orderBy('at', 'desc'), limit(200)));
      const L = { ban: '⛔ suspended', 'remove-account': '🗑️ removed account of', unban: '✅ unsuspended', warn: '⚠️ warned', message: '💌 messaged', remove: '🗑️ removed content by', dismiss: '👍 dismissed report about', review: '👀 is reviewing report about', 'make-mod': '✓ made moderator', 'remove-mod': '✕ removed moderator' };
      body.innerHTML = `<div class="card" style="padding:6px">${snap.docs.length ? snap.docs.map((d) => { const x = d.data(); return `<div class="list-item"><div class="meta"><div><b>${esc(x.byName)}</b> ${esc(L[x.action] || x.action)} <b>${esc(x.targetName || '')}</b> <span class="muted small">· ${esc(timeAgo(x.at))}</span></div>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}</div></div>`; }).join('') : '<div class="empty">No moderator actions yet.</div>'}</div>`;
    } catch (e) { body.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
  }

  async function reportsTab(body, token, stale) {
    let snap; try { snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(300))); } catch (e) { body.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; return; }
    if (stale && stale(token)) return;
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data(), status: d.data().status || 'open' }));
    let fs = 'todo', ft = 'all';
    body.innerHTML = `<div class="mod-filters"><div class="chips" id="mod-fs">${[['todo', 'To do'], ['open', 'Open'], ['review', 'In review'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button type="button" class="chip ${k === fs ? 'on' : ''}" data-fs="${k}">${l} <small>${all.filter((r) => k === 'all' || r.status === k || (k === 'todo' && r.status !== 'resolved')).length}</small></button>`).join('')}</div>
      <label class="sr-only" for="mod-ft">Type</label><select id="mod-ft" class="mod-select"><option value="all">All types</option>${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div id="mod-list"></div>`;
    const list = $('#mod-list'); const profs = new Map(); const prof = async (uid) => { if (!uid) return null; if (!profs.has(uid)) profs.set(uid, await getProfile(uid).catch(() => null)); return profs.get(uid); };
    const draw = async () => {
      const rs = all.filter((r) => (fs === 'all' || r.status === fs || (fs === 'todo' && r.status !== 'resolved')) && (ft === 'all' || r.targetType === ft));
      list.innerHTML = rs.length ? '' : '<div class="card empty">No reports here. 🎉</div>';
      for (const r of rs) {
        const el = document.createElement('div'); el.className = 'card pad mod-rep st-' + r.status; el.dataset.rid = r.id; list.appendChild(el);
        const [reporter, tuid] = await Promise.all([prof(r.reporterId), r._t != null ? r._t : targetUidOf(r)]); r._t = tuid;
        const target = await prof(tuid); r._tn = target ? target.displayName : ''; r._tu = target ? target.username : '';
        const t = r.targetType, link = t === 'user' ? (target ? `#/u/${target.username}` : '') : t === 'series' ? `#/series/${r.targetId}` : (t === 'live' || t === 'live chat') ? `#/live/${r.postId || r.targetId}` : t === 'chat message' ? '' : `#/post/${r.postId || r.targetId}`;
        const banned = tuid ? await getDoc(doc(db, 'bans', tuid)).then((s) => s.exists() && activeBan(s.data())).catch(() => false) : false;
        el.innerHTML = `<div class="row" style="flex-wrap:wrap;gap:6px"><span class="tag mod-type">${esc(TYPE_LABEL[t] || t)}</span><span class="mod-st">${esc(STATUS_LABEL[r.status])}${r.action ? ' · ' + esc(r.action) : ''}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(r.createdAt))}</span></div>
          ${r.excerpt ? `<blockquote class="mod-quote">${esc(r.excerpt)}</blockquote>` : ''}
          <p style="margin:6px 0 2px"><b>Reason:</b> ${esc(r.reason)}</p>
          <p class="muted small" style="margin:0">Reported user: ${target ? `<b>${esc(target.displayName)}</b>${badge(tuid)} @${esc(target.username)}` : '<i>unknown / deleted</i>'}${banned ? ' · <b style="color:#ff6b8a">suspended</b>' : ''}<br>Reporter: ${reporter ? `${esc(reporter.displayName)} @${esc(reporter.username)}` : 'unknown'}</p>
          <div class="mod-acts">${link ? `<a class="btn btn-sm btn-ghost" href="${esc(link)}">Open</a>` : ''}
            ${r.status === 'open' ? '<button class="btn btn-sm btn-ghost" data-a="review">👀 In review</button>' : ''}
            <button class="btn btn-sm btn-ghost" data-a="dismiss">👍 Dismiss</button>
            ${['user', 'live'].includes(t) ? '' : '<button class="btn btn-sm btn-danger" data-a="remove">🗑️ Remove content</button>'}
            ${tuid ? `<button class="btn btn-sm btn-ghost" data-a="warn">⚠️ Warn</button>${banned ? '<button class="btn btn-sm btn-ghost" data-a="unban">✅ Unsuspend</button>' : '<button class="btn btn-sm btn-danger" data-a="ban">⛔ Suspend</button>'}` : ''}
            ${reporter ? '<button class="btn btn-sm btn-ghost" data-a="thank">💌 Reply to reporter</button>' : ''}</div>`;
      }
    };
    list.onclick = async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const el = b.closest('[data-rid]'); const r = all.find((x) => x.id === el.dataset.rid); const a = b.dataset.a;
      const tn = r._tn || '';
      const done = async (status, action) => { await mark(r.id, status, action); r.status = status; r.action = action; S.modOpen = all.filter((x) => x.status !== 'resolved').length; onChange && onChange('count'); };
      try {
        if (a === 'review') { await done('review', ''); log('review', r._t, tn, r.reason, r.id); toast('Marked in review'); }
        else if (a === 'dismiss') { await done('resolved', 'dismissed'); log('dismiss', r._t, tn, r.reason, r.id); toast('Report dismissed'); }
        else if (a === 'remove') { if (!confirm('Remove the reported content for everyone?')) return; await removeContent(r); await done('resolved', 'removed'); log('remove', r._t, tn, `${r.targetType}: ${r.excerpt || r.targetId}`, r.id); toast('Content removed'); }
        else if (a === 'warn') { if (await messageDialog(r._t, tn, 'warn', { reportId: r.id })) await done('resolved', 'warned'); }
        else if (a === 'ban') { if (await banDialog(r._t, tn, r._tu, { reportId: r.id })) await done('resolved', 'suspended'); }
        else if (a === 'unban') await unban(r._t, tn);
        else if (a === 'thank') { const rp = await prof(r.reporterId); await messageDialog(r.reporterId, rp ? rp.displayName : 'reporter', 'thanks', { reportId: r.id }); return; }
        draw();
      } catch (er) { toast(friendlyError(er)); }
    };
    $('#mod-fs').onclick = (e) => { const b = e.target.closest('[data-fs]'); if (!b) return; fs = b.dataset.fs; $('#mod-fs').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); draw(); };
    $('#mod-ft').onchange = (e) => { ft = e.target.value; draw(); };
    draw();
  }

  return { rolesReady, iAmMod, badge, loadMine, watchReports, page, adminSection, isSuspended, suspendedHtml, banDialog, messageDialog };
}
