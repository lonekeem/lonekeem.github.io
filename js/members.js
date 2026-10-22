// New Members: an admin-only list of who joined Kemy.
// The directory is members/{uid}. Public profiles stay on users/{uid}. Emails are not on the
// public profile, and this page hides them until the admin taps Show email.
// Written by Lone Keem.
import { auth, db, ADMIN_EMAIL, EMU, app } from './firebase-init.js';
import {
  collection, doc, getDoc, getDocs, getCountFromServer, query, where, orderBy, limit,
  startAfter, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js';

const PAGE = 12;
const TZ = 'America/New_York';
const SIGNUP = { email: 'Email', google: 'Google' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function isAdmin() {
  const u = auth.currentUser;
  return !!(u && u.email === ADMIN_EMAIL && u.emailVerified);
}

export function nyTime(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || Number.isNaN(d.getTime())) return 'Join time not recorded';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(d);
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] && parts[0][0]) || '?').toUpperCase() + (parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() : '');
}

function avatarHtml(m) {
  const color = /^#[0-9a-f]{3,8}$/i.test(m.color || '') ? m.color : '#8a2be2';
  const photo = /^https:\/\/res\.cloudinary\.com\/[^\s"'<>]+$/.test(m.photoURL || '') ? m.photoURL : '';
  const inner = photo ? `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async">` : esc(initials(m.displayName || m.username));
  return `<span class="avatar ${photo ? 'has-photo' : ''}" style="--c:${esc(color)}" aria-hidden="true">${inner}</span>`;
}

function signupLine(kind) {
  return SIGNUP[kind] ? 'Signed up with ' + SIGNUP[kind] : 'Sign-up method not recorded';
}

function millis(ts) {
  return ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;
}

let fns = null;
function functionsApp() {
  if (!fns) {
    fns = getFunctions(app, 'us-central1');
    if (EMU) connectFunctionsEmulator(fns, '127.0.0.1', 5199);
  }
  return fns;
}

export async function memberCountSince(seenAt) {
  const q = seenAt
    ? query(collection(db, 'members'), where('createdAt', '>', seenAt))
    : query(collection(db, 'members'));
  const snap = await getCountFromServer(q);
  return snap.data().count || 0;
}

export async function paintAdminBadge(el) {
  if (!el || !isAdmin()) return;
  try {
    const seen = await getDoc(doc(db, 'users', auth.currentUser.uid, 'prefs', 'members'));
    const n = await memberCountSince(seen.exists() ? seen.get('seenAt') : null);
    el.textContent = n > 99 ? '99+' : String(n);
    el.hidden = n < 1;
  } catch {
    el.hidden = true;
  }
}

function rowHtml(m, fresh) {
  const name = m.displayName || m.username || 'New member';
  const handle = m.username ? '@' + m.username : '';
  return `<article class="nm-row" data-uid="${esc(m.uid)}">
    ${avatarHtml(m)}
    <div class="nm-meta">
      <div class="nm-name"><b>${esc(name)}</b>${fresh ? '<span class="nm-new">New</span>' : ''}</div>
      ${handle ? `<a class="nm-handle" href="#/u/${esc(m.username)}">${esc(handle)}</a>` : ''}
      <p class="nm-when">${esc(nyTime(m.createdAt))}</p>
      <p class="nm-how">${esc(signupLine(m.signup))}</p>
      <button type="button" class="btn btn-sm btn-ghost nm-mail" data-mail="${esc(m.uid)}">Show email</button>
      <p class="nm-email" hidden></p>
    </div>
  </article>`;
}

export async function page(main, { stale, toast } = {}) {
  const say = typeof toast === 'function' ? toast : () => {};
  if (!auth.currentUser) { location.hash = '#/login'; return; }
  if (!isAdmin()) {
    const u = auth.currentUser;
    const wrong = u.email !== ADMIN_EMAIL;
    main.innerHTML = `<section class="card pad center" style="max-width:520px;margin:30px auto"><h1 class="page-title">New Members</h1>
      <p class="muted">${wrong ? 'This list is only for the Kemy admin.' : 'Verify your admin email, then reload this page.'}</p>
      <a class="btn btn-sm btn-ghost" href="#/watch">Back to Kemy</a></section>`;
    return;
  }
  const uid = auth.currentUser.uid;
  let seenMs = 0;
  try {
    const seen = await getDoc(doc(db, 'users', uid, 'prefs', 'members'));
    if (seen.exists()) seenMs = millis(seen.get('seenAt'));
  } catch { /* first visit */ }
  main.innerHTML = `<section class="nm">
    <a class="nm-back" href="#/admin">← Admin</a>
    <h1 class="page-title">New Members</h1>
    <p class="muted small nm-lead">Newest first. Join times are New York time. Emails stay hidden until you tap.</p>
    <label class="check nm-push"><input type="checkbox" id="nm-push"> <span>Ping me when someone new joins<br><span class="muted small">Off during quiet hours (9pm–8am). Turn on notifications in Settings so your phone can get it. When Kemy is closed, the phone plays its own sound.</span></span></label>
    <label class="nm-search" for="nm-q">Search</label>
    <input id="nm-q" type="search" placeholder="Name or @username" autocomplete="off" enterkeyhint="search">
    <p class="small" style="margin:0 0 8px"><button type="button" class="btn btn-sm btn-ghost" id="nm-fill">Fill in older join times</button></p>
    <p class="small muted" id="nm-status"></p>
    <div id="nm-list" aria-live="polite"></div>
    <div id="nm-end"></div>
  </section>`;
  const list = main.querySelector('#nm-list');
  const status = main.querySelector('#nm-status');
  const search = main.querySelector('#nm-q');
  const push = main.querySelector('#nm-push');
  const seen = new Map();
  let mode = 'new';
  let cursor = null;
  let nameCursor = null;
  let displayCursor = null;
  let busy = false;
  let done = false;
  let term = '';

  const paint = (rows, reset) => {
    if (stale && stale()) return;
    if (reset) { list.innerHTML = ''; seen.clear(); }
    const fresh = [];
    for (const m of rows) {
      if (seen.has(m.uid)) continue;
      seen.set(m.uid, m);
      fresh.push(m);
    }
    if (!fresh.length && reset) {
      list.innerHTML = `<div class="card empty">${term ? 'No one matches that search.' : 'No members yet.'}</div>`;
      return;
    }
    const html = fresh.map((m) => rowHtml(m, millis(m.createdAt) > seenMs)).join('');
    if (reset) list.innerHTML = html;
    else list.insertAdjacentHTML('beforeend', html);
  };

  async function loadNew() {
    const parts = [orderBy('createdAt', 'desc'), limit(PAGE)];
    if (cursor) parts.push(startAfter(cursor));
    const snap = await getDocs(query(collection(db, 'members'), ...parts));
    cursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : cursor;
    done = snap.size < PAGE;
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }

  async function loadSearch(q) {
    const end = q + '\uf8ff';
    const nameParts = [where('username', '>=', q), where('username', '<=', end), orderBy('username'), limit(PAGE)];
    const dispParts = [where('displayNameLower', '>=', q), where('displayNameLower', '<=', end), orderBy('displayNameLower'), limit(PAGE)];
    if (nameCursor) nameParts.push(startAfter(nameCursor));
    if (displayCursor) dispParts.push(startAfter(displayCursor));
    const [byName, byDisplay] = await Promise.all([
      getDocs(query(collection(db, 'members'), ...nameParts)),
      getDocs(query(collection(db, 'members'), ...dispParts))
    ]);
    if (byName.docs.length) nameCursor = byName.docs[byName.docs.length - 1];
    if (byDisplay.docs.length) displayCursor = byDisplay.docs[byDisplay.docs.length - 1];
    done = byName.size < PAGE && byDisplay.size < PAGE;
    const map = new Map();
    for (const d of [...byName.docs, ...byDisplay.docs]) map.set(d.id, { uid: d.id, ...d.data() });
    return [...map.values()].sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
  }

  async function more(reset) {
    if (busy || (done && !reset)) return;
    busy = true;
    if (reset) {
      cursor = null; nameCursor = null; displayCursor = null; done = false;
      list.innerHTML = '<div class="spinner"></div>';
    }
    try {
      const rows = mode === 'search' ? await loadSearch(term) : await loadNew();
      if (stale && stale()) return;
      paint(rows, reset);
      const end = main.querySelector('#nm-end');
      if (end) end.textContent = done ? '' : '';
    } catch (e) {
      if (!(stale && stale())) list.innerHTML = `<div class="card empty">${esc(e.message || 'Couldn’t load members.')}</div>`;
    }
    busy = false;
  }

  list.onclick = async (ev) => {
    const btn = ev.target.closest('[data-mail]');
    if (!btn || !isAdmin()) return;
    const row = btn.closest('.nm-row');
    const slot = row && row.querySelector('.nm-email');
    if (!slot) return;
    if (!slot.hidden) { slot.hidden = true; slot.textContent = ''; btn.textContent = 'Show email'; return; }
    btn.disabled = true;
    try {
      const snap = await getDoc(doc(db, 'members', btn.dataset.mail, 'secret', 'email'));
      const email = snap.exists() ? String(snap.get('email') || '') : '';
      slot.textContent = email || 'No email recorded';
      slot.hidden = false;
      btn.textContent = 'Hide email';
    } catch (e) { say(e.message || 'Couldn’t load that email.'); }
    btn.disabled = false;
  };

  let timer = 0;
  search.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      term = search.value.trim().toLowerCase().replace(/^@/, '').slice(0, 40);
      mode = term ? 'search' : 'new';
      more(true);
    }, 250);
  };

  const end = main.querySelector('#nm-end');
  if ('IntersectionObserver' in window && end) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more(false);
    }, { rootMargin: '200px' });
    io.observe(end);
  }

  push.onchange = async () => {
    const on = push.checked;
    push.disabled = true;
    try {
      await setDoc(doc(db, 'config', 'adminAlerts'), { joinPush: on, uid, updatedAt: serverTimestamp() });
      say(on ? 'You’ll get a ping when someone new joins' : 'Join pings are off');
    } catch (e) { push.checked = !on; say(e.message || 'Couldn’t save that.'); }
    push.disabled = false;
  };

  getDoc(doc(db, 'config', 'adminAlerts')).then((s) => {
    if (stale && stale()) return;
    if (s.exists() && s.get('joinPush') === true) push.checked = true;
  }).catch(() => {});

  setDoc(doc(db, 'users', uid, 'prefs', 'members'), { seenAt: serverTimestamp() }).catch(() => {});

  const fill = main.querySelector('#nm-fill');
  fill.onclick = async () => {
    fill.disabled = true;
    status.textContent = 'Checking older join times…';
    try {
      const res = await httpsCallable(functionsApp(), 'backfillMembers')({});
      const n = res && res.data && res.data.filled;
      if (stale && stale()) return;
      status.textContent = n ? `Filled in join times for ${n} ${n === 1 ? 'account' : 'accounts'}.` : 'Join times are up to date.';
      if (n) more(true);
    } catch (e) {
      if (!(stale && stale())) status.textContent = /not-found|unavailable|internal|deadline/.test(String(e && e.code))
        ? 'That step needs the member function deployed.'
        : ((e && e.message) || 'Couldn’t fill those in.');
    }
    fill.disabled = false;
  };

  await more(true);
}
