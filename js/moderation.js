// Kemy moderator system: blue-check moderators (appointed by the admin), reports inbox,
// warnings / suspensions, moderator notices and an audit log. All enforced by firestore.rules
// (roles/, bans/, hiddenUsers/, modLog/, reports/). No server: "remove account" = permanent
// suspension + hiding the person's posts and comments everywhere.
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, orderBy,
  limit, onSnapshot, serverTimestamp, Timestamp, writeBatch, collectionGroup, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

import { markUnder13, undoUnder13 } from './safety.js';
const DAY = 86400000;
const FOREVER = () => Timestamp.fromMillis(Date.UTC(9999, 0, 1));
export const TEMPLATES = {
  thanks: ['Thanks for your report! We checked it and took action. 💜', 'Thanks for your report! We looked and it follows the rules, so we left it up. 💜', 'Thanks for helping keep Kemy safe and kind! 💜'],
  warn: ['Please be kind. Your message broke the Kemy rules (no mean words or bullying). Next time your account may be paused.', 'Please only post things that are safe for kids. We removed your post.', 'Please don’t spam or share personal info (like address or phone). This is a warning.'],
  ban: ['Bullying or mean messages', 'Unsafe or grown-up content', 'Spam', 'Sharing personal info', 'Pretending to be someone else']
};
const TYPE_LABEL = { post: 'Video / post', comment: 'Comment', user: 'User', live: 'Live', 'live chat': 'Live chat', 'chat message': 'Chat message', series: 'Series', movie: 'Movie', song: 'Song' };
const STATUS_LABEL = { open: 'Open', review: 'In review', resolved: 'Resolved' };

// ---------------------------------------------------------------- auto-flag (kid-safe word lists)
// Anything that matches (clearly bad OR borderline) is held for review and never published until a
// moderator restores it.
const AF = [
  ['bad', 'Self-harm words', /\b(kill myself|killing myself|suicide|suicidal|self[- ]?harm|cut myself|want to die|wanna die|end my life)\b/i],
  ['bad', 'Grown-up / sexual words', /\b(sex|sexy|nude|nudes|naked|porn\w*|boobs?|penis|vagina|horny|onlyfans|nsfw|xxx)\b/i],
  ['bad', 'Swear words or slurs', /\b(f+u+c+k\w*|fck\w*|sh[i1]t\w*|b[i1]tch\w*|asshole|bastard|dick|cunt|slut|whore|fag\w*|n[i1]gg\w*|retard\w*|wtf|stfu)\b/i],
  ['borderline', 'Violent words', /\b(kill|murder|gun|shoot|stab|bomb|blood|gore|weapon|terroris\w*|torture|behead)\w*/i],
  ['borderline', 'Personal info (address, phone, email, socials)', /\b(my address|i live at|phone( number)?|my number|password|my school is|credit card|social security|snapchat|whatsapp|discord|meet (me|up))\b|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|[\w.]+@[\w-]+\.\w{2,}/i],
  ['borderline', 'Mean words / bullying', /\b(stupid|dumb|idiot|loser|ugly|fat|shut up|hate you|kys|nobody likes you|damn|hell|crap)\b/i]
];
export function autoFlag(text) {
  const t = String(text || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/0/g, 'o').replace(/[@$]/g, (c) => (c === '@' ? '@' : 's'));
  for (const [level, reason, re] of AF) if (re.test(t)) return { level, reason };
  return null;
}
const postText = (d) => [d.text, d.work && d.work.title, d.work && d.work.lyrics, d.work && d.work.artist].filter(Boolean).join(' \n ');

// A Set that also hides removed accounts (used in place of S.blocked).
export class BlockSet extends Set { constructor(it, hidden) { super(it); this._h = hidden; } has(x) { return super.has(x) || (this._h && this._h.has(x)); } }

export function createModeration(ctx) {
  const { S, db, esc, toast, friendlyError, isAdmin, avatar, timeAgo, getProfile, openModal, closeModal, onChange } = ctx;
  S.mods = S.mods || new Set(); S.modsAI = S.modsAI || new Set(); S.hidden = S.hidden || new Set(); S.ban = null; S.modOpen = 0;
  let reportsUnsub = null;
  const $ = (s, r = document) => r.querySelector(s);
  const iAmMod = () => !!S.user && (isAdmin() || S.mods.has(S.user.uid));
  const isModUid = (uid) => S.mods.has(uid);
  const aiTag = (uid) => (uid && S.modsAI.has(uid)) ? '<span class="ai-tag" title="This moderator is an AI helper, not a person">🤖 AI Helper</span>' : '';
  const badge = (uid) => (uid && S.mods.has(uid)) ? '<span class="badge mod-badge" data-modbadge role="button" tabindex="0" title="Kemy Moderator" aria-label="Kemy Moderator">✓</span>' + aiTag(uid) : '';
  const isAIme = () => !!S.user && S.modsAI.has(S.user.uid) && !isAdmin();
  window.kemyModBadge = badge; window.kemyIsMod = isModUid;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-modbadge]'); if (!b) return; e.preventDefault(); e.stopPropagation(); toast('✓ Kemy Moderator · helps keep Kemy safe and kind'); }, true);

  // Public data, loaded for everyone (signed in or not).
  let rolesOk; const rolesReady = new Promise((r) => (rolesOk = r)); setTimeout(() => rolesOk(), 3000);
  onSnapshot(collection(db, 'roles'), (qs) => { S.mods = new Set(qs.docs.filter((d) => d.data().mod).map((d) => d.id)); S.modsAI = new Set(qs.docs.filter((d) => d.data().mod && d.data().ai).map((d) => d.id)); rolesOk(); if (S.user) watchReports(); onChange && onChange('mods'); }, () => rolesOk());
  onSnapshot(collection(db, 'hiddenUsers'), (qs) => { S.hidden.clear(); qs.docs.forEach((d) => S.hidden.add(d.id)); }, () => {});

  const activeBan = (b) => b && b.until && b.until.toMillis() > Date.now() ? b : null;
  async function loadMine() {
    if (reportsUnsub) { reportsUnsub(); reportsUnsub = null; }
    S.ban = null; S.modOpen = 0;
    if (!S.user) return;
    try { const s = await getDoc(doc(db, 'bans', S.user.uid)); S.banDoc = s.exists(); S.ban = s.exists() ? activeBan(s.data()) : null; } catch (e) { /* no ban */ }
    S.globalUnsubs && S.globalUnsubs.push(onSnapshot(doc(db, 'bans', S.user.uid), (s) => { S.banDoc = s.exists(); if (s.exists()) S.watchedMe = true; const was = !!S.ban; S.ban = s.exists() ? activeBan(s.data()) : null; if (was !== !!S.ban) onChange && onChange('ban'); }, () => {}));
    try { const w = await getDoc(doc(db, 'watchlist', S.user.uid)); S.watchedMe = isWatched(w); } catch { S.watchedMe = false; }
    S.globalUnsubs && S.globalUnsubs.push(onSnapshot(doc(db, 'watchlist', S.user.uid), (w) => { S.watchedMe = isWatched(w); }, () => {}));
    watchReports();
  }
  // ---- watchlist: warned / suspended / restricted users. Their pictures + videos are held for review
  // (rules enforce it), stories are paused. A ban doc (even expired) counts too.
  const isWatched = (w) => !!S.banDoc || (!!w && w.exists() && w.data().until && w.data().until.toMillis() > Date.now());
  const WATCH_DAYS = 30;
  function watchUser(uid, reason, until) {
    return setDoc(doc(db, 'watchlist', uid), { reason: String(reason || '').slice(0, 200), by: S.user.uid, at: serverTimestamp(), until: until || Timestamp.fromMillis(Date.now() + WATCH_DAYS * DAY) }).catch(() => {});
  }
  function watchReports() {
    if (reportsUnsub || !iAmMod()) return; setTimeout(() => watchCounts(), 0);
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

  function messageDialog(uid, name, kind, { reportId = '', postId = '', ref = '', prefill = '' } = {}) {
    const list = kind === 'warn' ? TEMPLATES.warn : TEMPLATES.thanks;
    openModal(`<h2 style="font-size:1.2rem">${kind === 'warn' ? '⚠️ Warn' : '💌 Message'} ${esc(name || 'user')}</h2>
      <p class="muted small">Goes to their <b>Kemy Moderators</b> thread (they can reply) + a notification.</p>
      <form id="mod-msg" style="text-align:left">${templatePicker(list)}
        <div class="field"><label for="mod-msg-t">Message</label><textarea id="mod-msg-t" maxlength="1000" required>${esc(prefill || list[0])}</textarea></div>
        <div class="btns"><button class="btn" type="submit">Send</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`);
    const ta = $('#mod-msg-t'); wireTpl(list, ta);
    return new Promise((res) => { $('#mod-msg').onsubmit = async (e) => { e.preventDefault(); try { await sendThread(uid, ta.value.trim(), ref || (reportId ? 'report:' + reportId : '')); log(kind === 'warn' ? 'warn' : 'message', uid, name, ta.value.trim(), reportId); if (kind === 'warn') watchUser(uid, 'Warned: ' + ta.value.trim()); closeModal(); toast('Sent ✓'); res(true); } catch (er) { toast(friendlyError(er)); } }; });
  }

  // ---- moderator invites (admin sends, user answers)
  async function sendInvite(uid, u) {
    if (!isAdmin()) throw new Error('Only the admin can invite moderators');
    await setDoc(doc(db, 'modInvites', uid), { status: 'pending', by: S.user.uid, at: serverTimestamp(), name: String(u.displayName || '').slice(0, 60), uname: String(u.username || '').slice(0, 30) });
    u._inv = 'pending'; notice(uid, 'Lone Keem invited you to be a Kemy Moderator! 🛡️ Tap to read what moderators do and answer.', 'invite').catch(() => {});
    log('invite-mod', uid, u.displayName); toast(`Invite sent to ${u.displayName} ✉️`);
  }
  async function cancelInvite(uid, u) { await setDoc(doc(db, 'modInvites', uid), { status: 'cancelled', by: S.user.uid, at: serverTimestamp(), name: String(u.displayName || '').slice(0, 60), uname: String(u.username || '').slice(0, 30) }); u._inv = ''; log('cancel-invite', uid, u.displayName); toast('Invite cancelled'); }
  async function removeMod(uid, u) { if (!confirm(`Remove ${u.displayName} as a moderator?`)) return; await deleteDoc(doc(db, 'roles', uid)); await deleteDoc(doc(db, 'modInvites', uid)).catch(() => {}); S.mods.delete(uid); log('remove-mod', uid, u.displayName); toast('Moderator removed'); }
  async function inviteState(uid) { const s = await getDoc(doc(db, 'modInvites', uid)).catch(() => null); return s && s.exists() ? s.data().status : ''; }
  // Profile button (admin only)
  async function profileButton(uid, u, el) {
    if (!isAdmin() || !el || uid === S.user.uid || uid === 'studio') return;
    const draw = async () => { const st = S.mods.has(uid) ? 'mod' : await inviteState(uid);
      el.innerHTML = st === 'mod' ? '<button class="btn btn-sm btn-ghost" data-iv="unmod">🛡️ Remove moderator</button>' : st === 'pending' ? '<button class="btn btn-sm btn-ghost" data-iv="cancel">⏳ Invite pending · Cancel</button>' : '<button class="btn btn-sm" data-iv="mod">🛡️ Invite as moderator</button>'; };
    el.onclick = async (e) => { const b = e.target.closest('[data-iv]'); if (!b) return; try { const a = b.dataset.iv; if (a === 'mod') await sendInvite(uid, u); else if (a === 'cancel') await cancelInvite(uid, u); else await removeMod(uid, u); draw(); } catch (er) { toast(friendlyError(er)); } };
    draw();
  }
  // Invite page for the invited user (#/mod-invite)
  async function invitePage(main) {
    if (!S.user) { location.hash = '#/login'; return; }
    const s = await getDoc(doc(db, 'modInvites', S.user.uid)).catch(() => null); const iv = s && s.exists() ? s.data() : null;
    if (!iv || iv.status !== 'pending') { main.innerHTML = `<section class="card pad center mod-susp"><div style="font-size:2.4rem">🛡️</div><h1 class="page-title">${iv && iv.status === 'accepted' ? 'You’re a Kemy Moderator ✓' : 'No open invite'}</h1><p class="muted">${iv && iv.status === 'accepted' ? 'Open the Mod Hub from the 🛡️ Mod button.' : iv && iv.status === 'declined' ? 'You declined the invite. That’s okay!' : 'There’s no moderator invite for you right now.'}</p><a class="btn btn-sm" href="${iv && iv.status === 'accepted' ? '#/mod' : '#/watch'}">${iv && iv.status === 'accepted' ? 'Open Mod Hub' : 'Back to Kemy'}</a></section>`; return; }
    main.innerHTML = `<section class="card pad mod-susp mod-invite" style="text-align:left"><div style="font-size:2.6rem;text-align:center">🛡️</div><h1 class="page-title" style="text-align:center">Lone Keem invited you to be a Kemy Moderator</h1>
      <p>Moderators help keep Kemy safe, kind and fun for everyone. You’ll get a blue <span class="badge mod-badge" aria-hidden="true">✓</span> check next to your name and the <b>Mod Hub</b>.</p>
      <h3 class="hub-h3">What moderators do</h3><ul class="small"><li>Check reports and posts the safety filter held for review</li><li>Restore posts that are fine, remove ones that break the rules</li><li>Send friendly warnings and, if needed, pause accounts for a while</li><li>Answer messages and bug reports from the community</li></ul>
      <h3 class="hub-h3">Moderator rules</h3><ul class="small"><li>Be fair and kind, even when someone wasn’t</li><li>Never share anyone’s reports, messages or personal info</li><li>Don’t use your powers for friends, arguments or jokes</li><li>Every action is logged and seen by the admin</li><li>Ask a grown-up or the admin when you’re not sure</li></ul>
      <div class="btns" style="justify-content:center;flex-wrap:wrap;margin-top:14px"><button class="btn" id="iv-yes">✅ Accept</button><button class="btn btn-ghost" id="iv-no">Decline</button></div></section>`;
    const answer = async (yes) => {
      try { const b = writeBatch(db); b.update(doc(db, 'modInvites', S.user.uid), { status: yes ? 'accepted' : 'declined', answeredAt: serverTimestamp() });
        if (yes) b.set(doc(db, 'roles', S.user.uid), { mod: true, name: String(S.profile.displayName || '').slice(0, 60), uname: String(S.profile.username || '').slice(0, 30), by: iv.by, at: serverTimestamp() });
        await b.commit();
        setDoc(doc(collection(db, 'users', iv.by, 'notifications')), { type: 'mod_invite', fromUid: S.user.uid, fromName: S.profile.displayName, fromUsername: S.profile.username, postId: '', text: yes ? 'accepted your moderator invite ✅' : 'declined your moderator invite', createdAt: serverTimestamp(), read: false }).catch(() => {});
        if (yes) { S.mods.add(S.user.uid); toast('Welcome to the team! 🛡️'); location.hash = '#/mod'; setTimeout(() => location.reload(), 300); } else { toast('Invite declined'); invitePage(main); }
      } catch (e) { toast(friendlyError(e)); } };
    $('#iv-yes').onclick = () => answer(true); $('#iv-no').onclick = () => answer(false);
  }
  function watchInvite() { if (!S.user) return; S.globalUnsubs && S.globalUnsubs.push(onSnapshot(doc(db, 'modInvites', S.user.uid), (s) => {
    const pend = s.exists() && s.data().status === 'pending'; S.modInvite = pend;
    if (pend && !sessionStorage.getItem('kemy-inv-shown') && !/mod-invite/.test(location.hash)) { sessionStorage.setItem('kemy-inv-shown', '1');
      if (!document.querySelector('#modal-root .modal')) openModal(`<div style="font-size:2.4rem" aria-hidden="true">🛡️</div><h2 style="font-size:1.25rem">You’re invited to be a Kemy Moderator!</h2><p class="muted">Lone Keem invited you to help keep Kemy safe and kind.</p><div class="btns"><a class="btn" href="#/mod-invite" data-close>See invite</a><button class="btn btn-ghost" data-close>Later</button></div>`); }
  }, () => {})); }

  // Two-way Kemy Moderators thread (modThreads/{uid}/m), plus a notification ping.
  async function sendThread(uid, text, ref = '') {
    const u = await getProfile(uid).catch(() => null); const b = writeBatch(db);
    b.set(doc(db, 'modThreads', uid), { uid, name: String((u && u.displayName) || '').slice(0, 60), uname: String((u && u.username) || '').slice(0, 30), lastAt: serverTimestamp(), lastText: text.slice(0, 200), lastFrom: 'mod', unreadUser: true, unreadMod: false, ref: String(ref).slice(0, 120) });
    b.set(doc(collection(db, 'modThreads', uid, 'm')), { from: 'mod', by: S.user.uid, byName: myName().slice(0, 60), text: text.slice(0, 1000), createdAt: serverTimestamp(), ref: String(ref).slice(0, 120) });
    await b.commit();
    notice(uid, 'New message from Kemy Moderators: ' + text.slice(0, 300)).catch(() => {});
  }

  function banDialog(uid, name, uname, { reportId = '' } = {}) {
    if (uid === S.user.uid) return toast('You can’t suspend yourself');
    if (S.mods.has(uid) && !isAdmin()) return toast('Only the admin can suspend a moderator');
    openModal(`<h2 style="font-size:1.2rem">⛔ Suspend ${esc(name || 'user')}</h2>
      <form id="mod-ban" style="text-align:left">
        <div class="mod-dur" role="radiogroup" aria-label="How long">
          <label><input type="radio" name="dur" value="1" checked> 1 day</label><label><input type="radio" name="dur" value="7"> 7 days</label>
          ${isAIme() ? '<span class="muted small">AI helper: up to 7 days</span></div>' : `<label><input type="radio" name="dur" value="30"> 30 days</label><label><input type="radio" name="dur" value="perm"> Permanent</label></div>
        <label class="small" style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="mod-hide"> Remove account: hide all their posts &amp; comments</label>`}
        ${templatePicker(TEMPLATES.ban)}
        <div class="field"><label for="mod-ban-r">Reason (they will see this)</label><textarea id="mod-ban-r" maxlength="300" required>${esc(TEMPLATES.ban[0])}</textarea></div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="mod-ban-n" checked> Send them a notice with the reason</label>
        <div class="btns"><button class="btn btn-danger" type="submit">Suspend</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div></form>`);
    const ta = $('#mod-ban-r'); wireTpl(TEMPLATES.ban, ta);
    if ($('#mod-hide')) $('#mod-hide').onchange = (e) => { if (e.target.checked) document.querySelector('input[name=dur][value=perm]').checked = true; };
    return new Promise((res) => { $('#mod-ban').onsubmit = async (e) => {
      e.preventDefault(); const v = document.querySelector('input[name=dur]:checked').value, hide = !!($('#mod-hide') && $('#mod-hide').checked), perm = v === 'perm' || hide, reason = ta.value.trim();
      const until = perm ? FOREVER() : Timestamp.fromMillis(Date.now() + (+v) * DAY);
      try {
        await setDoc(doc(db, 'bans', uid), { until, reason, permanent: perm, hide, by: S.user.uid, at: serverTimestamp(), name: String(name || '').slice(0, 60), uname: String(uname || '').slice(0, 30) });
        if (hide) await setDoc(doc(db, 'hiddenUsers', uid), { by: S.user.uid, at: serverTimestamp() });
        await watchUser(uid, 'Suspended: ' + reason, perm ? FOREVER() : Timestamp.fromMillis(until.toMillis() + WATCH_DAYS * DAY));
        const when = perm ? 'permanently' : `for ${v} day${v === '1' ? '' : 's'}`;
        if ($('#mod-ban-n').checked) await sendThread(uid, `Your Kemy account is suspended ${when}. Reason: ${reason}. You can reply here if you think this is a mistake.`, reportId ? 'report:' + reportId : '').catch(() => notice(uid, `Your Kemy account is suspended ${when}. Reason: ${reason}`).catch(() => {}));
        log(hide ? 'remove-account' : 'ban', uid, name, `${when}: ${reason}`, reportId);
        closeModal(); toast(`${name || 'User'} suspended ${when}`); res(true);
      } catch (er) { toast(friendlyError(er)); }
    }; });
  }
  async function unban(uid, name) {
    if (!confirm(`Unsuspend ${name || 'this user'}?`)) return false;
    try { await deleteDoc(doc(db, 'bans', uid)); await deleteDoc(doc(db, 'hiddenUsers', uid)).catch(() => {}); log('unban', uid, name); await watchUser(uid, 'Recently unsuspended'); await notice(uid, 'Your Kemy account is active again. Please follow the rules and be kind. 💜').catch(() => {}); toast('Unsuspended'); return true; }
    catch (e) { toast(friendlyError(e)); return false; }
  }

  // "Under 13" flag (underage/{uid}): mods + Kemy Helper mark, admin + human mods undo.
  const isU13 = (uid) => getDoc(doc(db, 'underage', uid)).then((s) => s.exists()).catch(() => false);
  async function u13(uid, name, on, reportId = '') {
    if (on) { if (!confirm(`Mark ${name || 'this user'} as under 13? Posting, uploads, comments and DMs turn off. They can still watch and play, and can appeal.`)) return false;
      await markUnder13(uid, reportId ? 'From a review item' : 'From user lookup'); log('mark-u13', uid, name, '', reportId);
      await notice(uid, 'A Kemy moderator thinks you might be under 13, so posting, comments and messages are paused for your safety. You can still watch and play games. If this is a mistake, tap Appeal to moderators. 💜').catch(() => {});
      toast('Marked under 13'); return true; }
    if (!confirm(`Undo the under-13 mark for ${name || 'this user'}?`)) return false;
    await undoUnder13(uid); log('undo-u13', uid, name, '', reportId); await notice(uid, 'Your account can post and chat again. Please follow the Community Rules. 💜').catch(() => {}); toast('Under-13 mark removed'); return true;
  }
  const u13Btn = (flag) => flag ? (isAIme() ? '<span class="tag">🧒 Marked under 13</span>' : '<button class="btn btn-sm btn-ghost" data-u13="off">↩️ Undo under 13</button>') : '<button class="btn btn-sm btn-ghost" data-u13="on">🧒 Mark under 13</button>';

  // False-report strikes (reportStrikes/{uid}). Only a moderator tapping "False report" adds one.
  const STRIKE_MS = 30 * DAY;
  const getStrikes = (uid) => getDoc(doc(db, 'reportStrikes', uid)).then((s) => (s.exists() ? s.data() : null)).catch(() => null);
  const tms = (x) => (x && x.toMillis ? x.toMillis() : 0);
  async function addFalseStrike(uid, name, reportId = '') {
    const old = await getStrikes(uid); const now = Date.now();
    const times = [...((old && old.times) || []).filter((x) => now - tms(x) < STRIKE_MS), Timestamp.fromMillis(now)].slice(-20);
    const n = ((old && old.n) || 0) + 1; let blocks = (old && old.blocks) || 0, flag = !!(old && old.flag), until = (old && old.until) || Timestamp.fromMillis(now), msg = '';
    const blockedNow = tms(until) > now;
    if (blocks >= 1 && !blockedNow) { until = Timestamp.fromMillis(now + 30 * DAY); blocks++; flag = true; msg = 'Reporting is paused for 30 days because of repeated reports that weren’t real problems. A Kemy admin will look at your account. 💜'; }
    else if (times.length >= 3 && !blockedNow) { until = Timestamp.fromMillis(now + 7 * DAY); blocks++; msg = 'Reporting is paused for 7 days because several recent reports weren’t real problems. Please only report real problems 💜'; }
    else if (n === 1) msg = 'Thanks for helping keep Kemy safe! Your recent report wasn’t a real problem. Please only report real problems 💜';
    else msg = 'Another report wasn’t a real problem. Please only report real problems 💜 Too many can pause reporting.';
    await setDoc(doc(db, 'reportStrikes', uid), { n, times, until, blocks, flag, by: S.user.uid, at: serverTimestamp() });
    log('false-report', uid, name, `strike ${n}${tms(until) > now ? ' · reporting blocked until ' + new Date(tms(until)).toLocaleDateString() : ''}${flag ? ' · flagged for admin' : ''}`, reportId);
    await sendThread(uid, msg, reportId ? 'report:' + reportId : '').catch(() => {});
    return { n, until, flag };
  }
  async function undoStrike(uid, name) {
    const old = await getStrikes(uid); if (!old) return;
    if (!confirm(`Undo one false-report strike for ${name || 'this user'}? This also lifts any reporting pause.`)) return;
    if (old.n <= 1) await deleteDoc(doc(db, 'reportStrikes', uid));
    else await setDoc(doc(db, 'reportStrikes', uid), { n: old.n - 1, times: (old.times || []).slice(0, -1), until: Timestamp.now(), blocks: old.blocks || 0, flag: false, by: S.user.uid, at: serverTimestamp() });
    log('undo-strike', uid, name); toast('Strike removed');
  }
  const strikeLine = (st) => !st ? '' : `<span class="tag" style="background:#3a1020;color:#ffd6e0">🚫 ${st.n} false-report strike${st.n > 1 ? 's' : ''}${tms(st.until) > Date.now() ? ' · reporting paused' : ''}${st.flag ? ' · ⚑ admin' : ''}</span>`;

  // ------------------------------------------------------------ suspended screen
  function suspendedHtml() {
    const b = S.ban;
    return `<section class="card pad center mod-susp"><div style="font-size:3rem" aria-hidden="true">⏸️</div><h1 class="page-title">Your account is paused</h1>
      <p>Your account is suspended <b>${esc(fmtUntil(b))}</b> for: <b>${esc(b.reason)}</b></p>
      <p class="muted small">While it’s paused you can’t post, comment, chat, talk in Pal Park or join games. ${b.permanent ? '' : 'It turns back on by itself when the time is up.'} If you think this is a mistake, ask a grown-up to email <a href="mailto:lillykemoy1@gmail.com?subject=Kemy%20account%20suspension">the Kemy team</a>.</p>
      <div class="btns" style="justify-content:center;flex-wrap:wrap"><a class="btn btn-sm" href="#/support">💬 Message the moderators</a><a class="btn btn-sm btn-ghost" href="#/notifications">Notifications</a><a class="btn btn-sm btn-ghost" href="#/settings">Settings</a><a class="btn btn-sm btn-ghost" href="guidelines.html">Kemy rules</a></div></section>`;
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
      <div class="mod-acts">${roles ? (mod ? `<button class="btn btn-sm btn-ghost" data-u="unmod">Remove moderator</button><button class="btn btn-sm btn-ghost" data-u="ai">${S.modsAI.has(u.uid) ? 'Remove 🤖 AI Helper flag' : '🤖 Mark as AI Helper'}</button>` : u._inv === 'pending' ? '<span class="mod-st">⏳ Invite pending</span><button class="btn btn-sm btn-ghost" data-u="cancel">Cancel invite</button>' : `${u._inv === 'declined' ? '<span class="mod-st">✕ Declined</span>' : ''}<button class="btn btn-sm" data-u="mod">🛡️ ${u._inv === 'declined' ? 'Invite again' : 'Invite as moderator'}</button>`)
        : `<a class="btn btn-sm btn-ghost" href="#/u/${esc(u.username)}">Profile</a><button class="btn btn-sm btn-ghost" data-u="warn">Warn</button><button class="btn btn-sm btn-danger" data-u="ban">Suspend</button><button class="btn btn-sm btn-ghost" data-u="unban">Unsuspend</button><button class="btn btn-sm btn-ghost" data-u="watch">👀 Hold their pictures & videos</button><button class="btn btn-sm btn-ghost" data-u="unwatch">Stop holding</button>`}</div></div></div>`;
  }
  function wireUserList(box, users, { roles = false, onDone } = {}) {
    box.innerHTML = users.length ? users.map((u) => userRow(u, { roles })).join('') : '<div class="empty">No one found.</div>';
    box.onclick = async (e) => {
      const b = e.target.closest('[data-u]'); if (!b) return; const uid = b.closest('[data-uid]').dataset.uid; const u = users.find((x) => x.uid === uid); if (!u) return;
      const a = b.dataset.u;
      if (a === 'ai') { if (!isAdmin()) return; const on = !S.modsAI.has(uid);
        if (on && S.modsAI.size && !confirm('Kemy should have only ONE AI helper. Replace the current one?')) return;
        try { if (on) for (const o of [...S.modsAI]) { const r = await getDoc(doc(db, 'roles', o)); if (r.exists()) await setDoc(doc(db, 'roles', o), { ...r.data(), ai: false, by: S.user.uid, at: serverTimestamp() }); }
          const r = await getDoc(doc(db, 'roles', uid)); await setDoc(doc(db, 'roles', uid), { ...r.data(), ai: on, by: S.user.uid, at: serverTimestamp() }); if (on) S.modsAI.add(uid); else S.modsAI.delete(uid);
          log(on ? 'make-ai' : 'remove-ai', uid, u.displayName); toast(on ? '🤖 Marked as the AI Helper' : 'AI flag removed'); wireUserList(box, users, { roles, onDone }); } catch (er) { toast(friendlyError(er)); } return; }
      if (a === 'mod' || a === 'unmod' || a === 'cancel') {
        if (!isAdmin()) return toast('Only the admin can change moderators');
        try {
          if (a === 'mod') { await sendInvite(uid, u); }
          else if (a === 'cancel') { await cancelInvite(uid, u); }
          else { await removeMod(uid, u); }
          wireUserList(box, users, { roles, onDone }); onDone && onDone();
        } catch (er) { toast(friendlyError(er)); }
      } else if (a === 'warn') messageDialog(uid, u.displayName, 'warn');
      else if (a === 'ban') banDialog(uid, u.displayName, u.username);
      else if (a === 'unban') unban(uid, u.displayName);
      else if (a === 'watch') { const why = prompt('Why? (only moderators see this)', 'Restricted by a moderator'); if (why === null) return; await watchUser(uid, 'Restricted: ' + why); log('watch', uid, u.displayName, why); toast(`👀 ${u.displayName}'s pictures & videos will be held for ${WATCH_DAYS} days`); }
      else if (a === 'unwatch') { try { await deleteDoc(doc(db, 'watchlist', uid)); log('unwatch', uid, u.displayName); toast('No longer holding their posts'); } catch (er) { toast(friendlyError(er)); } }
    };
  }

  // ------------------------------------------------------------ admin page section
  async function adminSection(root) {
    root.innerHTML = `<div class="card pad adm-tool mod-card" style="margin-bottom:12px"><b style="font-size:1.05rem"><span class="badge mod-badge" aria-hidden="true">✓</span> Moderators</b>
      <p class="muted small" style="margin:3px 0 8px">Moderators get a blue check and the Mod Hub. Tap “Invite as moderator”: they get an invite card and choose Accept or Decline. Only you can invite or remove moderators.</p>
      <div id="adm-mods-list"><div class="spinner"></div></div>
      <div class="field" style="margin-top:10px"><label for="adm-mod-q">Find a person by name or @handle</label><input id="adm-mod-q" type="search" placeholder="e.g. maya or @maya" autocomplete="off"></div>
      <div id="adm-mod-res"></div>
      <p class="small" style="margin:10px 0 0"><a class="btn btn-sm" href="#/mod">🛡️ Open Moderator Tools</a> <a class="btn btn-sm btn-ghost" href="#/mod/log">📜 Audit log</a></p></div>`;
    const listBox = $('#adm-mods-list', root), res = $('#adm-mod-res', root);
    const showMods = async () => {
      const [snap, ivs] = await Promise.all([getDocs(collection(db, 'roles')).catch(() => null), getDocs(collection(db, 'modInvites')).catch(() => null)]);
      const ids = snap ? snap.docs.map((d) => d.id) : [];
      const inv = new Map(ivs ? ivs.docs.filter((d) => ['pending', 'declined'].includes(d.data().status) && !ids.includes(d.id)).map((d) => [d.id, d.data().status]) : []);
      const users = (await Promise.all([...ids, ...inv.keys()].map((id) => getProfile(id).then((u) => u && { ...u, _inv: inv.get(id) || '' })))).filter(Boolean);
      if (!users.length) listBox.innerHTML = '<p class="muted small">No moderators or invites yet.</p>'; else wireUserList(listBox, users, { roles: true, onDone: showMods });
    };
    showMods();
    let t = 0; $('#adm-mod-q', root).oninput = (e) => { clearTimeout(t); const q = e.target.value; t = setTimeout(async () => { if (!q.trim()) { res.innerHTML = ''; return; } const us = await searchUsers(q); const ivs = await getDocs(collection(db, 'modInvites')).catch(() => null); const im = new Map(ivs ? ivs.docs.map((d) => [d.id, d.data().status]) : []); wireUserList(res, us.map((x) => ({ ...x, _inv: im.get(x.uid) || '' })), { roles: true, onDone: showMods }); }, 250); };
  }

  // ------------------------------------------------------------ Mod Hub (#/mod/<tab>)
  const TABS = [['home', '📊', 'Dashboard'], ['queue', '🕒', 'Review queue'], ['reports', '🚩', 'Reports'], ['users', '👥', 'Users'], ['bugs', '🐞', 'Bugs & feedback'], ['content', '🔎', 'Content'], ['inbox', '💬', 'Mod inbox'], ['notes', '📝', 'Team notes'], ['log', '📜', 'Audit log', 1], ['team', '⚙️', 'Admin', 1]];
  const cnt = { reports: 0, queue: 0, inbox: 0, bugs: 0 };
  let hubUnsubs = [];
  function watchCounts() {
    if (hubUnsubs.length || !iAmMod()) return;
    hubUnsubs.push(onSnapshot(query(collection(db, 'heldPosts'), limit(200)), (q) => { cnt.queue = q.size; paintCounts(); }, () => {}));
    hubUnsubs.push(onSnapshot(query(collection(db, 'modThreads'), where('unreadMod', '==', true), limit(100)), (q) => { cnt.inbox = q.size; paintCounts(); }, () => {}));
    hubUnsubs.push(onSnapshot(query(collection(db, 'feedback'), where('status', '==', 'new'), limit(100)), (q) => { cnt.bugs = q.size; paintCounts(); }, () => {}));
    S.globalUnsubs && S.globalUnsubs.push(() => { hubUnsubs.forEach((u) => u()); hubUnsubs = []; });
  }
  function totalCount() { return (S.modOpen || 0) + cnt.queue + cnt.inbox; }
  function paintCounts() {
    cnt.reports = S.modOpen || 0; S.modTotal = totalCount();
    document.querySelectorAll('[data-hubcount]').forEach((el) => { const n = cnt[el.dataset.hubcount] || 0; el.textContent = n > 99 ? '99+' : n; el.hidden = !n; });
    onChange && onChange('count');
  }
  async function page(tab, token, stale) {
    const main = ctx.main;
    if (!S.user) { location.hash = '#/login'; return; }
    if (!iAmMod()) { main.innerHTML = '<section class="card pad center" style="max-width:520px;margin:30px auto"><h1 class="page-title">🛡️ Moderators only</h1><p class="muted">This page is for Kemy moderators.</p><a class="btn btn-sm btn-ghost" href="#/watch">Back to Kemy</a></section>'; return; }
    watchCounts();
    tab = tab || 'home'; if (!TABS.some((t) => t[0] === tab) || (TABS.find((t) => t[0] === tab)[3] && !isAdmin())) tab = 'home';
    main.innerHTML = `<div class="hub"><div class="hub-top"><h1 class="page-title">🛡️ Mod Hub</h1><span class="muted small">${isAdmin() ? 'Admin' : isAIme() ? 'AI Helper 🤖' : 'Moderator'} · ${esc(myName())}</span></div>${ctx.secNotice ? ctx.secNotice() : ''}
      <nav class="hub-nav" aria-label="Mod Hub sections">${TABS.filter((t) => !t[3] || isAdmin()).filter((t) => !(isAIme() && t[0] === 'log')).map(([k, ic, l]) => `<a href="#/mod/${k}" class="${k === tab ? 'on' : ''}"><span aria-hidden="true">${ic}</span> ${l}${cnt[k] !== undefined ? `<span class="mod-count" data-hubcount="${k}" ${cnt[k] ? '' : 'hidden'}>${cnt[k]}</span>` : ''}</a>`).join('')}</nav>
      <div id="mod-body" class="hub-body"><div class="spinner"></div></div></div>`;
    paintCounts(); ctx.secPaint && ctx.secPaint();
    const body = $('#mod-body'); setTimeout(() => main.querySelector('.hub-nav .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 0);
    const T = { home: homeTab, queue: queueTab, reports: reportsTab, users: usersTab, bugs: bugsTab, content: contentTab, inbox: inboxTab, notes: notesTab, log: logTab, team: teamTab };
    try { await T[tab](body, token, stale); } catch (e) { body.innerHTML = `<div class="card empty">${esc(friendlyError(e))}</div>`; }
  }
  const startOfDay = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return Timestamp.fromDate(d); };
  const countQ = (q) => getCountFromServer(q).then((r) => r.data().count).catch(() => '–');
  async function homeTab(body) {
    const [newUsers, bans, held, flags, bugs] = await Promise.all([
      countQ(query(collection(db, 'users'), where('createdAt', '>=', startOfDay()))),
      countQ(query(collection(db, 'bans'), where('until', '>', Timestamp.now()))),
      countQ(collection(db, 'heldPosts')),
      countQ(query(collection(db, 'heldPosts'), where('level', 'in', ['bad', 'borderline']))),
      countQ(query(collection(db, 'feedback'), where('status', 'in', ['new', 'progress'])))]);
    const tile = (n, l, href, ic) => `<a class="hub-tile" href="${href}"><span class="ic">${ic}</span><b>${n}</b><span>${l}</span></a>`;
    body.innerHTML = `<div class="hub-tiles">${tile(S.modOpen || 0, 'Open reports', '#/mod/reports', '🚩')}${tile(held, 'Held for review', '#/mod/queue', '🕒')}${tile(flags, 'Auto-flagged', '#/mod/queue', '🤖')}${tile(cnt.inbox, 'Unread messages', '#/mod/inbox', '💬')}${tile(newUsers, 'New users today', '#/mod/users', '🌱')}${tile(bans, 'Active suspensions', '#/mod/users', '⛔')}${tile(bugs, 'Open bugs & feedback', '#/mod/bugs', '🐞')}</div>
      <h2 class="mod-h2">🤖 Helper summary</h2><div class="card" style="padding:6px" id="hub-ai"><div class="spinner"></div></div>
      ${isAIme() ? '' : '<h2 class="mod-h2">🕘 Recent actions</h2><div class="card" style="padding:6px" id="hub-recent"><div class="spinner"></div></div>'}
      <h2 class="mod-h2">📝 Latest team notes</h2><div class="card" style="padding:6px" id="hub-notes"><div class="spinner"></div></div>`;
    if ($('#hub-recent')) logList($('#hub-recent'), 8); notesList($('#hub-notes'), 4, true);
    getDocs(query(collection(db, 'modNotes'), orderBy('createdAt', 'desc'), limit(40))).then((q) => { const xs = q.docs.map((d) => d.data()).filter((x) => S.modsAI.has(x.by)).slice(0, 5);
      $('#hub-ai').innerHTML = xs.length ? xs.map((x) => `<div class="list-item"><div class="meta"><div><b>${esc(x.byName)}</b>${aiTag(x.by)} <span class="muted small">· ${esc(timeAgo(x.createdAt))}</span></div><p style="white-space:pre-wrap">${esc(x.text)}</p></div></div>`).join('') : `<div class="empty">${S.modsAI.size ? 'No helper notes yet.' : 'No AI helper set up yet.'}</div>`; }).catch(() => { $('#hub-ai').innerHTML = ''; });
  }

  // ---- Review queue (held + auto-flagged)
  async function queueTab(body) {
    const snap = await getDocs(query(collection(db, 'heldPosts'), orderBy('createdAt', 'desc'), limit(100)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    body.innerHTML = `<div id="q-rep"></div>${isAdmin() ? '<div class="card pad" id="q-cfg"><b>🌱 New-account video check</b><p class="muted small" style="margin:3px 0 8px">Videos from accounts under 3 days old, or with fewer than this many live posts, wait here for review first.</p><label class="small" for="q-n">Approved posts needed</label> <input id="q-n" type="number" min="0" max="50" inputmode="numeric" style="width:5em"> <button class="btn btn-sm" id="q-n-save">Save</button> <span class="small muted" id="q-n-msg"></span></div>' : ''}<p class="muted small">Auto-flagged posts (and posts a moderator pulled) are hidden from everyone until you act. The poster sees “Your post is being reviewed”.</p><div id="q-list"></div>`;
    reportedPosts($('#q-rep'));
    if (isAdmin()) { const ms = await import('./mediascan.js'); const inp = $('#q-n'); ms.reviewConfig().then((c) => (inp.value = c.minApproved)); $('#q-n-save').onclick = async () => { try { inp.value = await ms.saveReviewConfig(inp.value); $('#q-n-msg').textContent = '✅ Saved'; } catch (er) { $('#q-n-msg').textContent = friendlyError(er); } }; }
    const list = $('#q-list');
    const draw = () => { list.innerHTML = items.length ? items.map((h) => { const p = h.post || {}; const media = p.poster || (p.mediaType === 'image' ? p.mediaUrl : '');
      return `<div class="card pad mod-rep st-open" data-id="${esc(h.id)}"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag mod-type">${esc(p.type === 'media' ? (p.mediaType === 'video' ? 'Video' : 'Photo') : p.type || 'post')}</span><span class="mod-st">${h.level === 'bad' ? '🤖 Auto-flag · bad' : h.level === 'borderline' ? '🤖 Auto-flag · borderline' : '👀 Pulled by a moderator'}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(h.createdAt))}</span></div>
        <p style="margin:8px 0 4px"><b>Why:</b> ${esc(h.reason)}</p>
        <div class="q-prev">${media ? `<img src="${esc(media)}" alt="" loading="lazy">` : ''}<div><b>${esc(p.authorName || '')}</b>${badge(h.authorId)} <span class="muted small">@${esc(p.authorUsername || '')}</span>${p.work && p.work.title ? `<p><b>${esc(p.work.title)}</b></p>` : ''}<blockquote class="mod-quote">${esc(p.text || '(no text)')}</blockquote>${p.mediaType === 'video' && p.mediaUrl ? `<video src="${esc(p.mediaUrl)}" controls playsinline preload="none" style="max-width:100%;border-radius:12px"></video>` : ''}</div></div>
        <div class="mod-acts"><button class="btn btn-sm" data-q="restore">✅ Restore post</button><button class="btn btn-sm btn-danger" data-q="delete">🗑️ Delete post</button><button class="btn btn-sm btn-danger" data-q="warn">⚠️ Delete + Warn</button><button class="btn btn-sm btn-danger" data-q="ban">⛔ Suspend</button><button class="btn btn-sm btn-ghost" data-q="user">👤 User</button></div></div>`; }).join('') : '<div class="card empty">Nothing waiting for review. 🎉</div>'; };
    draw();
    list.onclick = async (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return; const id = b.closest('[data-id]').dataset.id; const h = items.find((x) => x.id === id); const p = h.post || {}; const a = b.dataset.q;
      const gone = () => { items.splice(items.indexOf(h), 1); draw(); };
      try {
        if (a === 'restore') { const bt = writeBatch(db); bt.set(doc(db, 'posts', id), p); bt.delete(doc(db, 'heldPosts', id)); await bt.commit(); log('restore', h.authorId, p.authorName, (p.text || '').slice(0, 120)); notice(h.authorId, 'Good news! Your post was reviewed and is now live. 💜', id).catch(() => {}); toast('Post restored'); gone(); }
        else if (a === 'delete') { if (!confirm('Delete this post for good?')) return; await deleteDoc(doc(db, 'heldPosts', id)); log('remove', h.authorId, p.authorName, 'held post: ' + (p.text || '').slice(0, 120)); notice(h.authorId, 'Your post was reviewed and removed because it didn’t follow the Kemy rules.').catch(() => {}); toast('Post deleted'); gone(); }
        else if (a === 'warn') { await deleteDoc(doc(db, 'heldPosts', id)); log('remove', h.authorId, p.authorName, 'held post: ' + (p.text || '').slice(0, 120)); gone(); messageDialog(h.authorId, p.authorName, 'warn', { ref: 'post:' + id, prefill: `We removed your post because it broke the Kemy rules (${h.reason.toLowerCase()}). Please keep Kemy safe and kind. This is a warning.` }); }
        else if (a === 'ban') { if (await banDialog(h.authorId, p.authorName, p.authorUsername)) { await deleteDoc(doc(db, 'heldPosts', id)).catch(() => {}); gone(); } }
        else if (a === 'user') location.hash = '#/mod/users?u=' + h.authorId;
      } catch (er) { toast(friendlyError(er)); }
    };
  }
  // Live posts hidden by 3+ reports from different people (posts.reportCount - reportOk >= 3).
  async function reportedPosts(box) {
    const snap = await getDocs(query(collection(db, 'posts'), where('reportCount', '>=', 3), limit(50))).catch(() => null);
    const items = snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => (p.reportCount || 0) - (p.reportOk || 0) >= 3) : [];
    if (!items.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<h3 class="hub-h3">🚩 Hidden by reports (${items.length})</h3>` + items.map((p) => { const media = p.poster || (p.mediaType === 'image' ? p.mediaUrl : '');
      return `<div class="card pad mod-rep st-open" data-id="${esc(p.id)}"><p style="margin:0 0 4px"><b>Why:</b> ${esc(String(p.reportCount))} different people reported it · hidden from everyone else</p><div class="q-prev">${media ? `<img src="${esc(media)}" alt="" loading="lazy">` : ''}<div><b>${esc(p.authorName || '')}</b> <span class="muted small">@${esc(p.authorUsername || '')}</span><blockquote class="mod-quote">${esc(p.text || (p.work && p.work.title) || '(no text)')}</blockquote>${p.mediaType === 'video' && p.mediaUrl ? `<video src="${esc(p.mediaUrl)}" controls playsinline preload="none" style="max-width:100%;border-radius:12px"></video>` : ''}</div></div>
        <div class="mod-acts"><button class="btn btn-sm" data-r="keep">✅ It’s fine, show it</button><button class="btn btn-sm btn-ghost" data-r="hold">🕒 Move to held</button><button class="btn btn-sm btn-danger" data-r="delete">🗑️ Delete post</button><a class="btn btn-sm btn-ghost" href="#/mod/reports">🚩 Reports</a></div></div>`; }).join('');
    box.onclick = async (e) => {
      const b = e.target.closest('[data-r]'); if (!b) return; const card = b.closest('[data-id]'); const p = items.find((x) => x.id === card.dataset.id);
      try {
        if (b.dataset.r === 'keep') { await updateDoc(doc(db, 'posts', p.id), { reportOk: p.reportCount }); log('restore', p.authorId, p.authorName, 'kept after reports: ' + (p.text || '').slice(0, 100)); }
        else if (b.dataset.r === 'hold') await holdLivePost(p, `Hidden by ${p.reportCount} reports`);
        else { if (!confirm('Delete this post for good?')) return; await deleteDoc(doc(db, 'posts', p.id)); log('remove', p.authorId, p.authorName, 'reported post: ' + (p.text || '').slice(0, 100)); notice(p.authorId, 'Your post was reviewed and removed because it didn’t follow the Kemy rules.').catch(() => {}); }
        card.remove(); toast('Done');
      } catch (er) { toast(friendlyError(er)); }
    };
  }
  async function holdLivePost(p, reason = 'Pulled for review by a moderator') {
    const s = await getDoc(doc(db, 'posts', p.id)); if (!s.exists()) throw new Error('That post is gone');
    const b = writeBatch(db); b.set(doc(db, 'heldPosts', p.id), { post: s.data(), reason, level: 'mod', authorId: s.data().authorId, by: S.user.uid, createdAt: serverTimestamp() }); b.delete(doc(db, 'posts', p.id)); await b.commit();
    log('hold', s.data().authorId, s.data().authorName, (s.data().text || '').slice(0, 120));
  }

  // ---- Users: lookup + history
  async function usersTab(body) {
    const pre = new URLSearchParams(location.hash.split('?')[1] || '').get('u');
    body.innerHTML = `<div class="card pad"><div class="field"><label for="mod-uq">Find a person by name or @handle</label><input id="mod-uq" type="search" placeholder="Search people" autocomplete="off"></div><div id="mod-ures"></div></div>
      <div id="mod-uprof"></div>
      <h2 class="mod-h2">⛔ Suspended accounts</h2><div id="mod-bans" class="card" style="padding:6px"><div class="spinner"></div></div>`;
    const showRes = (users) => { const box = $('#mod-ures'); box.innerHTML = users.length ? users.map((u) => `<button type="button" class="list-item hub-urow" data-pick="${esc(u.uid)}">${avatar(u, '', false)}<div class="meta"><b>${esc(u.displayName)}</b>${badge(u.uid)}<p>@${esc(u.username)}</p></div></button>`).join('') : '<div class="empty">No one found.</div>'; box.onclick = (e) => { const b = e.target.closest('[data-pick]'); if (b) userProfile(b.dataset.pick); }; };
    let t = 0; $('#mod-uq').oninput = (e) => { clearTimeout(t); const q = e.target.value; t = setTimeout(async () => { if (!q.trim()) { $('#mod-ures').innerHTML = ''; return; } showRes(await searchUsers(q)); }, 250); };
    if (pre) userProfile(pre);
    try {
      const snap = await getDocs(query(collection(db, 'bans'), orderBy('at', 'desc'), limit(100)));
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((b) => activeBan(b));
      const box = $('#mod-bans');
      box.innerHTML = rows.length ? rows.map((b) => `<div class="list-item" data-uid="${esc(b.uid)}"><div class="meta"><b>${esc(b.name || b.uid)}</b> <span class="muted small">@${esc(b.uname || '')}</span><p>${esc(fmtUntil(b))} · ${esc(b.reason)}${b.hide ? ' · content hidden' : ''}</p><div class="mod-acts"><button class="btn btn-sm btn-ghost" data-open>Open</button><button class="btn btn-sm btn-ghost" data-unban>Unsuspend</button></div></div></div>`).join('') : '<div class="empty">No one is suspended.</div>';
      box.onclick = async (e) => { const row = e.target.closest('[data-uid]'); if (!row) return; if (e.target.closest('[data-open]')) return userProfile(row.dataset.uid); if (!e.target.closest('[data-unban]')) return; const r = rows.find((x) => x.uid === row.dataset.uid); if (await unban(r.uid, r.name)) row.remove(); };
    } catch (e) { $('#mod-bans').innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
  }
  async function userProfile(uid) {
    const box = $('#mod-uprof'); if (!box) return; box.innerHTML = '<div class="spinner"></div>';
    const u = await getProfile(uid); if (!u) { box.innerHTML = '<div class="card empty">Profile not found (maybe deleted).</div>'; return; }
    const safe = (p) => p.then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []);
    const [banS, against, by, posts, held, hist, u13flag, ust] = await Promise.all([
      getDoc(doc(db, 'bans', uid)).catch(() => null),
      safe(getDocs(query(collection(db, 'reports'), where('targetUid', '==', uid), limit(30)))),
      safe(getDocs(query(collection(db, 'reports'), where('reporterId', '==', uid), limit(30)))),
      safe(getDocs(query(collection(db, 'posts'), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(12)))),
      safe(getDocs(query(collection(db, 'heldPosts'), where('authorId', '==', uid), limit(20)))),
      safe(getDocs(query(collection(db, 'modLog'), where('targetUid', '==', uid), limit(50)))), isU13(uid), getStrikes(uid)]);
    const ban = banS && banS.exists() ? activeBan(banS.data()) : null; const warns = hist.filter((x) => x.action === 'warn');
    const joined = u.createdAt && u.createdAt.toDate ? u.createdAt.toDate().toLocaleDateString() : '';
    box.innerHTML = `<div class="card pad hub-prof"><div class="row" style="gap:12px;align-items:center">${avatar({ ...u, uid }, 'lg', false)}<div style="min-width:0"><h2 style="margin:0;font-size:1.2rem">${esc(u.displayName)}${badge(uid)}</h2><p class="muted small" style="margin:2px 0">@${esc(u.username)}${joined ? ' · joined ' + esc(joined) : ''}</p>${ban ? `<p class="small" style="margin:0;color:#ffb3c1"><b>Suspended ${esc(fmtUntil(ban))}</b> · ${esc(ban.reason)}</p>` : '<p class="small" style="margin:0;color:#b5f5d3">Active account</p>'}</div></div>
      <div class="hub-stats"><span><b>${against.length}</b> reports about them</span><span><b>${warns.length}</b> warnings</span><span><b>${by.length}</b> reports they sent</span><span><b>${held.length}</b> held posts</span></div>
      ${ust ? `<p class="small" style="margin:6px 0">${strikeLine(ust)}${tms(ust.until) > Date.now() ? ` <span class="muted">until ${esc(new Date(tms(ust.until)).toLocaleDateString())}</span>` : ''}</p>` : ''}<div class="mod-acts">${ust && !isAIme() ? '<button class="btn btn-sm btn-ghost" data-p="unstrike">↩️ Undo a false-report strike</button>' : ''}${u13Btn(u13flag)}<a class="btn btn-sm btn-ghost" href="#/u/${esc(u.username)}">Profile</a><button class="btn btn-sm" data-p="msg">💬 Message</button><button class="btn btn-sm btn-ghost" data-p="warn">⚠️ Warn</button>${ban ? '<button class="btn btn-sm btn-ghost" data-p="unban">✅ Unsuspend</button>' : '<button class="btn btn-sm btn-danger" data-p="ban">⛔ Suspend</button>'}</div>
      <h3 class="hub-h3">History</h3>${hist.length ? hist.sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0)).map((x) => `<p class="small hub-hist"><b>${esc(ACT[x.action] || x.action)}</b> by ${esc(x.byName)} · ${esc(timeAgo(x.at))}${x.detail ? `<br><span class="muted">${esc(x.detail)}</span>` : ''}</p>`).join('') : '<p class="muted small">No moderator actions yet.</p>'}
      <h3 class="hub-h3">Reports about them</h3>${against.length ? against.map((r) => `<p class="small hub-hist"><b>${esc(TYPE_LABEL[r.targetType] || r.targetType)}</b> · ${esc(STATUS_LABEL[r.status || 'open'])} · ${esc(timeAgo(r.createdAt))}<br><span class="muted">${esc(r.reason)}</span></p>`).join('') : '<p class="muted small">None.</p>'}
      <h3 class="hub-h3">Recent posts</h3>${posts.length ? posts.map((p) => `<p class="small hub-hist"><a href="#/post/${esc(p.id)}">${esc((p.work && p.work.title) || p.text || p.mediaType || 'post').slice(0, 90)}</a> · ${esc(timeAgo(p.createdAt))}</p>`).join('') : '<p class="muted small">No posts.</p>'}</div>`;
    box.onclick = async (e) => { const ub = e.target.closest('[data-u13]'); if (ub) { try { if (await u13(uid, u.displayName, ub.dataset.u13 === 'on')) userProfile(uid); } catch (er) { toast(friendlyError(er)); } return; }
      const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p;
      if (a === 'msg') { await messageDialog(uid, u.displayName, 'thanks', { prefill: ' ' }); }
      else if (a === 'warn') await messageDialog(uid, u.displayName, 'warn');
      else if (a === 'ban') await banDialog(uid, u.displayName, u.username);
      else if (a === 'unban') await unban(uid, u.displayName);
      else if (a === 'unstrike') { try { await undoStrike(uid, u.displayName); } catch (er) { toast(friendlyError(er)); } }
      userProfile(uid); };
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Bugs & feedback
  async function bugsTab(body) {
    const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(150)));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() })); let f = 'open';
    const FB = { new: 'New', progress: 'In progress', fixed: 'Fixed', closed: 'Closed' };
    body.innerHTML = `<div class="mod-filters"><div class="chips" id="fb-f">${[['open', 'To do'], ['new', 'New'], ['progress', 'In progress'], ['fixed', 'Fixed'], ['all', 'All']].map(([k, l]) => `<button type="button" class="chip ${k === f ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div><div id="fb-list"></div>`;
    const list = $('#fb-list');
    const draw = () => { const rs = all.filter((x) => f === 'all' || x.status === f || (f === 'open' && (x.status === 'new' || x.status === 'progress')));
      list.innerHTML = rs.length ? rs.map((x) => `<div class="card pad mod-rep st-${x.status === 'new' ? 'open' : x.status === 'progress' ? 'review' : 'resolved'}" data-id="${esc(x.id)}"><div class="row" style="gap:6px;flex-wrap:wrap"><span class="tag mod-type">${x.kind === 'bug' ? '🐞 Bug' : x.kind === 'idea' ? '💡 Idea' : '💜 Feedback'}</span><span class="mod-st">${esc(FB[x.status] || x.status)}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(x.createdAt))}</span></div>
        <blockquote class="mod-quote">${esc(x.text)}</blockquote><p class="muted small" style="margin:0">From ${esc(x.name || 'someone')}${x.page ? ' · on ' + esc(x.page) : ''}${x.ua ? `<br>${esc(x.ua.slice(0, 120))}` : ''}</p>
        <div class="field" style="margin-top:8px"><label class="small" for="fbn-${esc(x.id)}">Notes</label><textarea id="fbn-${esc(x.id)}" maxlength="1000" rows="2">${esc(x.note || '')}</textarea></div>
        <div class="mod-acts"><button class="btn btn-sm btn-ghost" data-s="progress">🔧 In progress</button><button class="btn btn-sm" data-s="fixed">✅ Fixed</button><button class="btn btn-sm btn-ghost" data-s="closed">Close</button><button class="btn btn-sm btn-ghost" data-s="note">💾 Save note</button><button class="btn btn-sm btn-ghost" data-s="reply">💬 Reply</button></div></div>`).join('') : '<div class="card empty">Nothing here. 🎉</div>'; };
    draw();
    $('#fb-f').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; f = b.dataset.f; $('#fb-f').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); draw(); };
    list.onclick = async (e) => { const b = e.target.closest('[data-s]'); if (!b) return; const id = b.closest('[data-id]').dataset.id; const x = all.find((y) => y.id === id); const a = b.dataset.s; const note = document.getElementById('fbn-' + id).value.trim();
      if (a === 'reply') return messageDialog(x.uid, x.name, 'thanks', { ref: 'feedback:' + id, prefill: x.kind === 'bug' ? 'Thanks for telling us about this bug! We are looking at it. 🔧' : 'Thanks for your feedback! 💜' });
      const status = a === 'note' ? x.status : a;
      try { await updateDoc(doc(db, 'feedback', id), { status, note, handledBy: S.user.uid, handledAt: serverTimestamp() }); x.status = status; x.note = note; log('feedback', x.uid, x.name, `${status}: ${x.text.slice(0, 80)}`); toast('Saved'); draw(); } catch (er) { toast(friendlyError(er)); } };
  }

  // ---- Content tools
  async function contentTab(body) {
    body.innerHTML = `<div class="card pad"><div class="field"><label for="ct-q">Search posts and comments by text</label><input id="ct-q" type="search" placeholder="e.g. a word, #hashtag or @user" autocomplete="off"></div>
      <div class="chips" id="ct-k"><button type="button" class="chip on" data-k="posts">Posts</button><button type="button" class="chip" data-k="comments">Comments</button></div></div><div id="ct-res"></div>`;
    let kind = 'posts', t = 0; const res = $('#ct-res');
    const run = async () => { const q = $('#ct-q').value.trim().toLowerCase(); if (!q) { res.innerHTML = ''; return; } res.innerHTML = '<div class="spinner"></div>';
      if (kind === 'posts') {
        const w = q.replace(/^@/, '').split(/\s+/)[0]; let docs = [];
        const tries = q.startsWith('#') ? [query(collection(db, 'posts'), where('hashtags', 'array-contains', q.slice(1)), limit(40))] : q.startsWith('@') ? [] : [query(collection(db, 'posts'), where('keywords', 'array-contains', w), limit(40))];
        if (q.startsWith('@')) { const us = await searchUsers(w); if (us[0]) tries.push(query(collection(db, 'posts'), where('authorId', '==', us[0].uid), orderBy('createdAt', 'desc'), limit(40))); }
        for (const tq of tries) docs = docs.concat((await getDocs(tq).catch(() => ({ docs: [] }))).docs);
        if (!docs.length) docs = (await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(300)))).docs.filter((d) => postText(d.data()).toLowerCase().includes(q));
        const ps = docs.map((d) => ({ id: d.id, ...d.data() }));
        res.innerHTML = ps.length ? ps.map((p) => `<div class="card pad mod-rep" data-id="${esc(p.id)}"><div class="row" style="gap:6px"><b>${esc(p.authorName)}</b>${badge(p.authorId)}<span class="muted small">@${esc(p.authorUsername)} · ${esc(timeAgo(p.createdAt))}</span>${p.featured ? '<span class="mod-st">★ Featured</span>' : ''}</div>
          <blockquote class="mod-quote">${esc(((p.work && p.work.title) ? p.work.title + ' — ' : '') + (p.text || p.mediaType || ''))}</blockquote>
          <div class="mod-acts"><a class="btn btn-sm btn-ghost" href="#/post/${esc(p.id)}">Open</a><button class="btn btn-sm btn-ghost" data-c="hold">🕒 Hide for review</button><button class="btn btn-sm btn-danger" data-c="del">🗑️ Delete</button>${isAdmin() && (p.type === 'movie' || p.type === 'song') ? `<button class="btn btn-sm btn-ghost" data-c="feat">${p.featured ? '☆ Unfeature' : '★ Feature'}</button>` : ''}<button class="btn btn-sm btn-ghost" data-c="user" data-u="${esc(p.authorId)}">👤 User</button></div></div>`).join('') : '<div class="card empty">No posts found.</div>';
        res.onclick = async (e) => { const b = e.target.closest('[data-c]'); if (!b) return; const id = b.closest('[data-id]').dataset.id; const p = ps.find((x) => x.id === id); const a = b.dataset.c;
          try { if (a === 'hold') { await holdLivePost(p); toast('Hidden and moved to the Review queue'); b.closest('[data-id]').remove(); }
            else if (a === 'del') { if (!confirm('Delete this post for everyone?')) return; await deleteDoc(doc(db, 'posts', id)); log('remove', p.authorId, p.authorName, 'post: ' + (p.text || '').slice(0, 120)); toast('Deleted'); b.closest('[data-id]').remove(); }
            else if (a === 'feat') { await updateDoc(doc(db, 'posts', id), { featured: !p.featured }); p.featured = !p.featured; log(p.featured ? 'feature' : 'unfeature', p.authorId, p.authorName, (p.work && p.work.title) || ''); toast(p.featured ? 'Featured in Studio Picks' : 'Unfeatured'); run(); }
            else if (a === 'user') location.hash = '#/mod/users?u=' + b.dataset.u; } catch (er) { toast(friendlyError(er)); } };
      } else {
        const snap = await getDocs(query(collectionGroup(db, 'comments'), limit(500)));
        const cs = snap.docs.map((d) => ({ id: d.id, postId: d.ref.parent.parent.id, ...d.data() })).filter((c) => !c.deleted && String(c.text || '').toLowerCase().includes(q.replace(/^@/, '')) || (q.startsWith('@') && c.authorUsername === q.slice(1)));
        res.innerHTML = cs.length ? cs.slice(0, 60).map((c) => `<div class="card pad mod-rep" data-id="${esc(c.id)}"><div class="row" style="gap:6px"><b>${esc(c.authorName)}</b>${badge(c.authorId)}<span class="muted small">@${esc(c.authorUsername)} · ${esc(timeAgo(c.createdAt))}</span></div><blockquote class="mod-quote">${esc(c.text)}</blockquote>
          <div class="mod-acts"><a class="btn btn-sm btn-ghost" href="#/post/${esc(c.postId)}">Open post</a><button class="btn btn-sm btn-danger" data-c="del">🗑️ Remove comment</button><button class="btn btn-sm btn-ghost" data-c="warn">⚠️ Remove + Warn</button></div></div>`).join('') : '<div class="card empty">No comments found (searches the newest 500).</div>';
        res.onclick = async (e) => { const b = e.target.closest('[data-c]'); if (!b) return; const c = cs.find((x) => x.id === b.closest('[data-id]').dataset.id);
          try { await ctx.comments().deleteComment(c.postId, c); log('remove', c.authorId, c.authorName, 'comment: ' + c.text.slice(0, 120)); b.closest('[data-id]').remove(); toast('Comment removed');
            if (b.dataset.c === 'warn') messageDialog(c.authorId, c.authorName, 'warn', { ref: 'comment:' + c.id }); } catch (er) { toast(friendlyError(er)); } };
      } };
    $('#ct-q').oninput = () => { clearTimeout(t); t = setTimeout(run, 350); };
    $('#ct-k').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; kind = b.dataset.k; $('#ct-k').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); run(); };
  }

  // ---- Mod inbox (two-way threads)
  async function inboxTab(body) {
    const open = new URLSearchParams(location.hash.split('?')[1] || '').get('t');
    if (open) return threadView(body, open, true);
    body.innerHTML = `<div class="row" style="flex-wrap:wrap;gap:8px;margin-bottom:10px"><p class="muted small" style="margin:0;flex:1">Private threads between the Kemy Moderators team and a user. They see it as “Kemy Moderators” and can reply.</p><button class="btn btn-sm" id="ib-new">✉️ New message</button></div><div class="card" style="padding:6px" id="ib-list"><div class="spinner"></div></div>`;
    $('#ib-new').onclick = () => { openModal(`<h2 style="font-size:1.2rem">✉️ Message a user</h2><div class="field" style="text-align:left"><label for="ib-q">Name or @handle</label><input id="ib-q" type="search" autocomplete="off"></div><div id="ib-r"></div><div class="btns"><button class="btn btn-ghost" data-close>Cancel</button></div>`);
      let t = 0; $('#ib-q').oninput = (e) => { clearTimeout(t); t = setTimeout(async () => { const us = await searchUsers(e.target.value); $('#ib-r').innerHTML = us.map((u) => `<button type="button" class="list-item hub-urow" data-t="${esc(u.uid)}">${avatar(u, '', false)}<div class="meta"><b>${esc(u.displayName)}</b><p>@${esc(u.username)}</p></div></button>`).join(''); $('#ib-r').onclick = (ev) => { const b = ev.target.closest('[data-t]'); if (b) { closeModal(); location.hash = '#/mod/inbox?t=' + b.dataset.t; } }; }, 250); }; };
    const snap = await getDocs(query(collection(db, 'modThreads'), orderBy('lastAt', 'desc'), limit(100)));
    $('#ib-list').innerHTML = snap.docs.length ? snap.docs.map((d) => { const x = d.data(); return `<a class="list-item ${x.unreadMod ? 'unread' : ''}" href="#/mod/inbox?t=${esc(d.id)}">${avatar({ uid: d.id, displayName: x.name, username: x.uname }, '', false)}<div class="meta"><div class="row"><b>${esc(x.name || d.id)}</b>${x.unreadMod ? '<span class="mod-count" style="margin-left:6px">new</span>' : ''}<span class="spacer"></span><span class="muted small">${esc(timeAgo(x.lastAt))}</span></div><p>${x.lastFrom === 'mod' ? 'You: ' : ''}${esc(x.lastText)}</p>${x.ref ? `<p class="muted small">🔗 ${esc(x.ref)}</p>` : ''}</div></a>`; }).join('') : '<div class="empty">No conversations yet.</div>';
  }
  // Shared thread view: moderators (asMod) or the user themself (#/support).
  async function threadView(root, uid, asMod) {
    const u = asMod ? await getProfile(uid) : S.profile; const list = asMod ? [...TEMPLATES.thanks, ...TEMPLATES.warn] : [];
    root.innerHTML = `<section class="chat hub-thread">${asMod ? `<div class="chat-head"><a class="icon-btn" href="#/mod/inbox" aria-label="Back">←</a>${avatar({ ...(u || {}), uid }, '', false)}<div><b>${esc(u ? u.displayName : uid)}</b>${badge(uid)}<div class="muted small">@${esc(u ? u.username : '')} · <a href="#/mod/users?u=${esc(uid)}">user history</a></div></div></div>`
      : `<div class="chat-head"><a class="icon-btn" href="#/messages" aria-label="Back">←</a><span class="avatar mod-av" aria-hidden="true">🛡️</span><div><b>Kemy Moderators</b><span class="badge mod-badge" aria-hidden="true">✓</span><div class="muted small">The Kemy safety team. Be kind, and never share personal info.</div></div></div>`}
      <div class="chat-log" id="th-log" aria-live="polite"><div class="spinner"></div></div>
      ${asMod ? templatePicker(list) : ''}
      <form class="chat-form" id="th-form"><label for="th-text" class="sr-only">Message</label><input id="th-text" type="text" maxlength="1000" placeholder="${asMod ? 'Reply as Kemy Moderators…' : 'Write to the moderators…'}" autocomplete="off" required><button class="btn btn-sm" type="submit">Send</button></form></section>`;
    if (asMod) document.querySelectorAll('.hub-thread [data-tpl]').forEach((b) => (b.onclick = () => { $('#th-text').value = list[+b.dataset.tpl]; $('#th-text').focus(); }));
    const logEl = $('#th-log'); let thread = null;
    const un1 = onSnapshot(doc(db, 'modThreads', uid), (s) => { thread = s.exists() ? s.data() : null; if (thread && (asMod ? thread.unreadMod : thread.unreadUser)) updateDoc(doc(db, 'modThreads', uid), asMod ? { unreadMod: false } : { unreadUser: false }).catch(() => {}); }, () => {});
    const un2 = onSnapshot(query(collection(db, 'modThreads', uid, 'm'), orderBy('createdAt', 'asc'), limit(300)), (qs) => {
      logEl.innerHTML = qs.docs.length ? qs.docs.map((d) => { const m = d.data(); const mine = asMod ? m.from === 'mod' : m.from === 'user';
        return `<div class="bubble ${mine ? 'mine' : ''}">${m.from === 'mod' && asMod ? `<small class="muted">${esc(m.byName)}</small>${aiTag(m.by)}<br>` : m.from === 'mod' && S.modsAI.has(m.by) ? `${aiTag(m.by)}<br>` : ''}${esc(m.text)}<time>${esc(timeAgo(m.createdAt))}${m.ref ? ' · ' + esc(m.ref) : ''}</time></div>`; }).join('')
        : `<p class="muted small center">${asMod ? 'Start the conversation.' : 'No messages yet. The moderators will write here if they need you.'}</p>`;
      logEl.scrollTop = logEl.scrollHeight; }, (e) => { logEl.innerHTML = `<p class="muted small center">${esc(friendlyError(e))}</p>`; });
    S.unsubs.push(un1, un2);
    $('#th-form').onsubmit = async (e) => { e.preventDefault(); const inp = $('#th-text'); const text = inp.value.trim(); if (!text) return; inp.value = '';
      try { if (asMod) { await sendThread(uid, text, (thread && thread.ref) || ''); log('message', uid, u && u.displayName, text); }
        else { if (!thread) { inp.value = text; return toast('You can reply once the moderators message you. To report a problem use Settings → Report a bug / Send feedback.'); }
          const b = writeBatch(db); b.set(doc(db, 'modThreads', uid), { ...thread, lastAt: serverTimestamp(), lastText: text.slice(0, 200), lastFrom: 'user', unreadUser: false, unreadMod: true });
          b.set(doc(collection(db, 'modThreads', uid, 'm')), { from: 'user', by: uid, byName: String(S.profile.displayName || '').slice(0, 60), text, createdAt: serverTimestamp(), ref: thread.ref || '' }); await b.commit(); }
      } catch (er) { inp.value = text; toast(friendlyError(er)); } };
  }

  // ---- Team notes
  async function notesList(box, n, compact) {
    const snap = await getDocs(query(collection(db, 'modNotes'), orderBy('createdAt', 'desc'), limit(n))).catch(() => null);
    const ns = snap ? snap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
    box.innerHTML = ns.length ? ns.map((x) => `<div class="list-item ${x.done ? 'hub-done' : ''}" data-id="${esc(x.id)}"><div class="meta"><div><b>${esc(x.byName)}</b>${aiTag(x.by)} <span class="muted small">· ${esc(timeAgo(x.createdAt))}</span></div><p style="white-space:pre-wrap">${esc(x.text)}</p>${compact ? '' : `<div class="mod-acts"><button class="btn btn-sm btn-ghost" data-n="done">${x.done ? '↩️ Reopen' : '✅ Done'}</button>${x.by === S.user.uid || isAdmin() ? '<button class="btn btn-sm btn-ghost" data-n="del">Delete</button>' : ''}</div>`}</div></div>`).join('') : '<div class="empty">No notes yet.</div>';
    box.onclick = async (e) => { const b = e.target.closest('[data-n]'); if (!b) return; const x = ns.find((y) => y.id === b.closest('[data-id]').dataset.id);
      try { if (b.dataset.n === 'done') await updateDoc(doc(db, 'modNotes', x.id), { done: !x.done }); else await deleteDoc(doc(db, 'modNotes', x.id)); notesList(box, n, compact); } catch (er) { toast(friendlyError(er)); } };
  }
  async function notesTab(body) {
    body.innerHTML = `<form class="card pad" id="nt-f"><div class="field"><label for="nt-t">Handoff note for the team</label><textarea id="nt-t" maxlength="1000" rows="3" required placeholder="e.g. Keep an eye on @name in Pal Park tonight"></textarea></div><button class="btn btn-sm" type="submit">📌 Post note</button></form><div class="card" style="padding:6px;margin-top:12px" id="nt-list"><div class="spinner"></div></div>`;
    const box = $('#nt-list'); notesList(box, 60);
    $('#nt-f').onsubmit = async (e) => { e.preventDefault(); const t = $('#nt-t').value.trim(); if (!t) return;
      try { await addDoc(collection(db, 'modNotes'), { by: S.user.uid, byName: myName().slice(0, 60), text: t, done: false, createdAt: serverTimestamp() }); $('#nt-t').value = ''; notesList(box, 60); } catch (er) { toast(friendlyError(er)); } };
  }

  // ---- Audit log (admin) + recent actions
  const ACT = { 'false-report': '🚫 false-report strike for', 'undo-strike': '↩️ removed a false-report strike from', 'mark-u13': '🧒 marked under 13', 'undo-u13': '↩️ removed under-13 mark from', 'make-ai': '🤖 marked as AI Helper', 'remove-ai': 'removed AI Helper flag from', 'auto-timeout': '⏳ auto timeout for', 'keep-timeout': '⏳ kept timeout for', 'invite-mod': '✉️ invited as moderator', 'cancel-invite': '✕ cancelled moderator invite for', ban: '⛔ suspended', 'remove-account': '🗑️ removed account of', unban: '✅ unsuspended', warn: '⚠️ warned', message: '💬 messaged', remove: '🗑️ removed content by', dismiss: '👍 dismissed report about', review: '👀 is reviewing report about', 'make-mod': '✓ made moderator', watch: '👀 started holding pictures & videos from', unwatch: '👀 stopped holding posts from', 'remove-mod': '✕ removed moderator', restore: '✅ restored post by', hold: '🕒 held post by', feedback: '🐞 updated feedback from', feature: '★ featured', unfeature: '☆ unfeatured' };
  async function logList(box, n) {
    try { const snap = await getDocs(query(collection(db, 'modLog'), orderBy('at', 'desc'), limit(n)));
      box.innerHTML = snap.docs.length ? snap.docs.map((d) => { const x = d.data(); return `<div class="list-item"><div class="meta"><div><b>${esc(x.byName)}</b> ${esc(ACT[x.action] || x.action)} <b>${esc(x.targetName || '')}</b> <span class="muted small">· ${esc(timeAgo(x.at))}</span></div>${x.detail ? `<p>${esc(x.detail)}</p>` : ''}</div></div>`; }).join('') : '<div class="empty">No moderator actions yet.</div>';
    } catch (e) { box.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
  }
  async function logTab(body) { body.innerHTML = '<div class="card" style="padding:6px" id="lg"></div>'; await logList($('#lg'), 300); }
  async function teamTab(body) {
    body.innerHTML = `<div id="tm-mods"></div><div class="card pad adm-tool"><b>🛍️ Publish shop prices</b><p class="muted small" style="margin:3px 0 8px">Sends every price in the app to the live shop.</p><button class="btn btn-sm" id="tm-shop">Publish shop prices</button> <a class="btn btn-sm btn-ghost" href="#/admin">All admin tools</a><p class="small muted" id="tm-shop-msg"></p></div>`;
    adminSection($('#tm-mods'));
    $('#tm-shop').onclick = async () => { const m = $('#tm-shop-msg'); m.textContent = 'Publishing…'; try { await ctx.publishShop(); m.textContent = '✅ Shop prices published'; log('publish-shop', '', '', ''); } catch (e) { m.textContent = friendlyError(e); } };
  }

  // ---- auto-flag hook used by every "new post" batch
  // force = { reason, level } from the picture/video check or the new-account video rule
  function holdOrSet(b, ref, data, force) {
    const media = !!(data.mediaUrl || (data.work && data.work.cover));
    const f = (!isAdmin() && data.authorId !== 'studio' ? autoFlag(postText(data)) : null) || (force && force.reason ? { reason: String(force.reason).slice(0, 200), level: 'borderline' } : null)
      || (media && S.watchedMe && !isAdmin() && data.authorId !== 'studio' ? { reason: '👀 Watchlist (warned, suspended or restricted): pictures & videos are checked first', level: 'borderline' } : null);
    if (!f) { b.set(ref, data); return null; }
    b.set(doc(db, 'heldPosts', ref.id), { post: data, reason: f.reason, level: f.level, authorId: data.authorId, createdAt: serverTimestamp() });
    S.lastHeld = ref.id; return f;
  }
  async function heldNotice(id) {
    if (!S.user) return '';
    const s = await getDoc(doc(db, 'heldPosts', id)).catch(() => null);
    if (!s || !s.exists() || s.data().authorId !== S.user.uid) return '';
    return `<section class="card pad center mod-susp"><div style="font-size:2.6rem" aria-hidden="true">🕒</div><h1 class="page-title">Your post is being reviewed</h1><p>Kemy’s safety check spotted something it wasn’t sure about, so a moderator will look at your post soon. Only you can see this note. If it’s okay, it goes live.</p><blockquote class="mod-quote" style="text-align:left">${esc(s.data().post.text || '')}</blockquote><div class="btns" style="justify-content:center"><a class="btn btn-sm" href="#/watch">Back to Kemy</a><a class="btn btn-sm btn-ghost" href="guidelines.html">Kemy rules</a></div></section>`;
  }
  // ---- user-facing: Kemy Moderators thread + feedback form
  async function supportPage(main) {
    if (!S.user) { location.hash = '#/login'; return; }
    await threadView(main, S.user.uid, false);
  }
  function feedbackPage(main) {
    if (!S.user) { location.hash = '#/login?next=' + encodeURIComponent('#/feedback'); return; }
    main.innerHTML = `<section class="card pad" style="max-width:560px;margin:10px auto"><h1 class="page-title">🐞 Report a bug / Send feedback</h1><p class="muted small">Tell the Kemy team what broke or what you’d love to see. Please don’t include personal info.</p>
      <form id="fb-form"><div class="mod-dur" role="radiogroup" aria-label="Type"><label><input type="radio" name="fbk" value="bug" checked> 🐞 Bug</label><label><input type="radio" name="fbk" value="idea"> 💡 Idea</label><label><input type="radio" name="fbk" value="feedback"> 💜 Feedback</label></div>
        <div class="field" style="margin-top:10px"><label for="fb-t">What happened?</label><textarea id="fb-t" maxlength="1500" rows="5" required placeholder="e.g. The Post button doesn’t work on the Explore page"></textarea></div>
        <p class="form-error" id="fb-err"></p><button class="btn" type="submit">Send</button></form>
      <h2 class="mod-h2">Your reports</h2><div id="fb-mine"><div class="spinner"></div></div></section>`;
    const FB = { new: '🆕 New', progress: '🔧 In progress', fixed: '✅ Fixed', closed: 'Closed' };
    const mine = async () => { const s = await getDocs(query(collection(db, 'feedback'), where('uid', '==', S.user.uid), limit(30))).catch(() => null); const xs = s ? s.docs.map((d) => d.data()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)) : [];
      $('#fb-mine').innerHTML = xs.length ? xs.map((x) => `<div class="card pad" style="margin-bottom:8px"><div class="row"><b>${esc(FB[x.status] || x.status)}</b><span class="spacer"></span><span class="muted small">${esc(timeAgo(x.createdAt))}</span></div><p class="small" style="margin:6px 0 0;white-space:pre-wrap">${esc(x.text)}</p></div>`).join('') : '<p class="muted small">Nothing sent yet.</p>'; };
    mine();
    $('#fb-form').onsubmit = async (e) => { e.preventDefault(); const text = $('#fb-t').value.trim(); if (!text) return;
      try { await addDoc(collection(db, 'feedback'), { uid: S.user.uid, name: String((S.profile && S.profile.displayName) || '').slice(0, 60), kind: document.querySelector('input[name=fbk]:checked').value, text, page: String(document.referrer || location.hash).slice(0, 200), ua: navigator.userAgent.slice(0, 300), status: 'new', note: '', createdAt: serverTimestamp() });
        $('#fb-t').value = ''; toast('Thank you! The Kemy team got it. 💜'); mine(); } catch (er) { $('#fb-err').textContent = friendlyError(er); } };
  }
  function watchMyThread(cb) { if (!S.user) return; S.globalUnsubs && S.globalUnsubs.push(onSnapshot(doc(db, 'modThreads', S.user.uid), (s) => cb(!!(s.exists() && s.data().unreadUser), s.exists()), () => {})); }

  async function reportsTab(body, token, stale) {
    let snap; try { snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(300))); } catch (e) { body.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; return; }
    if (stale && stale(token)) return;
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data(), status: d.data().status || 'open' }));
    let fs = 'todo', ft = 'all'; const expanded = new Set(); let strikes = new Map();
    body.innerHTML = `<div class="mod-filters"><div class="chips" id="mod-fs">${[['todo', 'To do'], ['open', 'Open'], ['review', 'In review'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => `<button type="button" class="chip ${k === fs ? 'on' : ''}" data-fs="${k}">${l} <small>${all.filter((r) => k === 'all' || r.status === k || (k === 'todo' && r.status !== 'resolved')).length}</small></button>`).join('')}</div>
      <label class="sr-only" for="mod-ft">Type</label><select id="mod-ft" class="mod-select"><option value="all">All types</option>${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div id="mod-list"></div>`;
    const list = $('#mod-list'); const profs = new Map(); const prof = async (uid) => { if (!uid) return null; if (!profs.has(uid)) profs.set(uid, await getProfile(uid).catch(() => null)); return profs.get(uid); };
    const draw = async () => {
      const rs = all.filter((r) => (fs === 'all' || r.status === fs || (fs === 'todo' && r.status !== 'resolved')) && (ft === 'all' || r.targetType === ft));
      list.innerHTML = rs.length ? '' : '<div class="card empty">No reports here. 🎉</div>';
      // Mass reports against one user from the same reporter collapse into the first one.
      const groups = new Map(); rs.forEach((r) => { if (!r.targetUid || r.targetUid === r.reporterId) return; const g = r.reporterId + '>' + r.targetUid; groups.set(g, [...(groups.get(g) || []), r]); });
      strikes = new Map(); const stOf = async (u) => { if (!strikes.has(u)) strikes.set(u, await getStrikes(u)); return strikes.get(u); };
      for (const r of rs) {
        const gk = r.reporterId + '>' + r.targetUid, grp = groups.get(gk) || [r];
        if (grp.length > 1 && grp[0] !== r && !expanded.has(gk)) continue;
        const el = document.createElement('div'); el.className = 'card pad mod-rep st-' + r.status; el.dataset.rid = r.id; list.appendChild(el);
        const [reporter, tuid] = await Promise.all([prof(r.reporterId), r._t != null ? r._t : targetUidOf(r)]); r._t = tuid;
        const target = await prof(tuid); r._tn = target ? target.displayName : ''; r._tu = target ? target.username : '';
        const t = r.targetType, link = t === 'user' ? (target ? `#/u/${target.username}` : '') : t === 'series' ? `#/series/${r.targetId}` : (t === 'live' || t === 'live chat') ? `#/live/${r.postId || r.targetId}` : t === 'chat message' ? '' : `#/post/${r.postId || r.targetId}`;
        const u13flag = tuid ? await isU13(tuid) : false;
        const banned = tuid ? await getDoc(doc(db, 'bans', tuid)).then((s) => s.exists() && activeBan(s.data())).catch(() => false) : false;
        const rst = r.reporterId !== tuid ? await stOf(r.reporterId) : null;
        const hist = all.filter((x) => x.reporterId === r.reporterId && x.reporterId !== x.targetUid);
        const histFalse = hist.filter((x) => x.action === 'false report').length;
        const histLine = r.reporterId === tuid ? '' : `<p class="muted small mod-rhist" style="margin:2px 0 0">Reporter history: <b>${hist.length}</b> report${hist.length === 1 ? '' : 's'} sent${histFalse ? ` · <b>${histFalse}</b> marked false` : ''}${hist.filter((x) => Date.now() - tms(x.createdAt) < DAY).length > 4 ? ' · ⚠️ many today' : ''} ${strikeLine(rst)}</p>`;
        const grpLine = grp.length > 1 && grp[0] === r ? `<p class="small" style="margin:4px 0 0"><button type="button" class="link-btn" data-grp="${esc(gk)}">${expanded.has(gk) ? '▲ Hide' : '▼ Show'} ${grp.length - 1} more report${grp.length > 2 ? 's' : ''} from the same reporter about this user</button></p>` : '';
        el.innerHTML = `<div class="row" style="flex-wrap:wrap;gap:6px"><span class="tag mod-type">${esc(TYPE_LABEL[t] || t)}</span><span class="mod-st">${esc(STATUS_LABEL[r.status])}${r.action ? ' · ' + esc(r.action) : ''}</span><span class="spacer"></span><span class="muted small">${esc(timeAgo(r.createdAt))}</span></div>
          ${r.excerpt ? `<blockquote class="mod-quote">${esc(r.excerpt)}</blockquote>` : ''}
          <p style="margin:6px 0 2px"><b>Reason:</b> ${esc(r.reason)}</p>
          <p class="muted small" style="margin:0">Reported user: ${target ? `<b>${esc(target.displayName)}</b>${badge(tuid)} @${esc(target.username)}` : '<i>unknown / deleted</i>'}${banned ? ' · <b style="color:#ff6b8a">suspended</b>' : ''}<br>Reporter: ${reporter ? `${esc(reporter.displayName)} @${esc(reporter.username)}` : 'unknown'}</p>
          ${histLine}${grpLine}
          <div class="mod-acts">${link ? `<a class="btn btn-sm btn-ghost" href="${esc(link)}">Open</a>` : ''}${r.reporterId !== tuid && r.status !== 'resolved' ? '<button class="btn btn-sm btn-ghost" data-a="false">🚫 False report</button>' : ''}${tuid && (/under 13/i.test(r.reason || '') || u13flag) ? u13Btn(u13flag) : ''}
            ${r.status === 'open' ? '<button class="btn btn-sm btn-ghost" data-a="review">👀 In review</button>' : ''}
            <button class="btn btn-sm btn-ghost" data-a="dismiss">👍 Dismiss</button>
            ${['user', 'live'].includes(t) ? '' : '<button class="btn btn-sm btn-danger" data-a="remove">🗑️ Remove content</button>'}
            ${tuid ? `<button class="btn btn-sm btn-ghost" data-a="warn">⚠️ Warn</button>${banned ? '<button class="btn btn-sm btn-ghost" data-a="unban">✅ Unsuspend</button>' : '<button class="btn btn-sm btn-danger" data-a="ban">⛔ Suspend</button>'}` : ''}
            ${/^🤖 Auto timeout/.test(r.reason || '') ? `${banned ? '<button class="btn btn-sm" data-a="lift">⏳ Lift timeout</button>' : ''}<button class="btn btn-sm btn-ghost" data-a="keep">✋ Keep</button>` : reporter && r.reporterId !== tuid ? '<button class="btn btn-sm btn-ghost" data-a="thank">💌 Reply to reporter</button>' : ''}</div>`;
      }
    };
    list.onclick = async (e) => {
      const gb = e.target.closest('[data-grp]'); if (gb) { const g = gb.dataset.grp; expanded.has(g) ? expanded.delete(g) : expanded.add(g); draw(); return; }
      const ub = e.target.closest('[data-u13]'); if (ub) { const r0 = all.find((x) => x.id === ub.closest('[data-rid]').dataset.rid); try { if (await u13(r0._t, r0._tn, ub.dataset.u13 === 'on', r0.id)) { if (ub.dataset.u13 === 'on') { await mark(r0.id, 'resolved', 'marked under 13'); r0.status = 'resolved'; r0.action = 'marked under 13'; } draw(); } } catch (er) { toast(friendlyError(er)); } return; }
      const b = e.target.closest('[data-a]'); if (!b) return; const el = b.closest('[data-rid]'); const r = all.find((x) => x.id === el.dataset.rid); const a = b.dataset.a;
      const tn = r._tn || '';
      const done = async (status, action) => { await mark(r.id, status, action); r.status = status; r.action = action; S.modOpen = all.filter((x) => x.status !== 'resolved').length; onChange && onChange('count'); };
      try {
        if (a === 'review') { await done('review', ''); log('review', r._t, tn, r.reason, r.id); toast('Marked in review'); }
        else if (a === 'false') {
          const rp = await prof(r.reporterId);
          if (!confirm(`Mark this as a FALSE report? It closes with no action against ${tn || 'the reported user'}, and ${rp ? rp.displayName : 'the reporter'} gets a false-report strike (kind warning; 3 in 30 days pauses reporting for 7 days).`)) return;
          await done('resolved', 'false report'); const res = await addFalseStrike(r.reporterId, rp ? rp.displayName : '', r.id); strikes.delete(r.reporterId);
          toast(`False report: strike ${res.n}${tms(res.until) > Date.now() ? ' · reporting paused' : ''}${res.flag ? ' · flagged for admin' : ''}`);
        }
        else if (a === 'dismiss') { await done('resolved', 'dismissed'); log('dismiss', r._t, tn, r.reason, r.id); toast('Report dismissed'); }
        else if (a === 'remove') { if (!confirm('Remove the reported content for everyone?')) return; await removeContent(r); await done('resolved', 'removed'); log('remove', r._t, tn, `${r.targetType}: ${r.excerpt || r.targetId}`, r.id); toast('Content removed'); }
        else if (a === 'warn') { if (await messageDialog(r._t, tn, 'warn', { reportId: r.id })) await done('resolved', 'warned'); }
        else if (a === 'ban') { if (await banDialog(r._t, tn, r._tu, { reportId: r.id })) await done('resolved', 'suspended'); }
        else if (a === 'unban') await unban(r._t, tn);
        else if (a === 'lift') { await deleteDoc(doc(db, 'bans', r._t)); await done('resolved', 'timeout lifted'); log('unban', r._t, tn, 'lifted auto timeout', r.id); notice(r._t, 'Your 1-hour pause was lifted early. Please keep Kemy kind! 💜').catch(() => {}); toast('Timeout lifted'); }
        else if (a === 'keep') { await done('resolved', 'timeout kept'); log('keep-timeout', r._t, tn, r.reason, r.id); toast('Timeout kept'); }
        else if (a === 'thank') { const rp = await prof(r.reporterId); await messageDialog(r.reporterId, rp ? rp.displayName : 'reporter', 'thanks', { reportId: r.id }); return; }
        draw();
      } catch (er) { toast(friendlyError(er)); }
    };
    $('#mod-fs').onclick = (e) => { const b = e.target.closest('[data-fs]'); if (!b) return; fs = b.dataset.fs; $('#mod-fs').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b)); draw(); };
    $('#mod-ft').onchange = (e) => { ft = e.target.value; draw(); };
    draw();
  }

  return { aiTag, rolesReady, iAmMod, badge, loadMine, watchReports, watchCounts, totalCount, page, adminSection, isSuspended, suspendedHtml, banDialog, messageDialog, holdOrSet, heldNotice, profileButton, invitePage, watchInvite, holdLivePost, supportPage, feedbackPage, watchMyThread };
}
