// New Members: an admin-only list of who joined Kemy, plus one member's detail.
// The directory is members/{uid}. Public profiles stay on users/{uid}. Emails are not on the
// public profile, and this page hides them until the admin taps Show email.
// Detail reads that already exist for the app (wallet, games, homes, follows, Pals) and the
// admin-only device list for last active. Message and suspend reuse Moderator Tools.
// Written by Lone Keem.
import { auth, db, ADMIN_EMAIL, EMU, app } from './firebase-init.js';
import {
  collection, doc, getDoc, getDocs, getCountFromServer, query, where, orderBy, limit,
  startAfter, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js';
import { SPECIES, FOUNDER } from './pals/species.js';

const PAGE = 12;
const TZ = 'America/New_York';
const SIGNUP = { email: 'Email', google: 'Google' };
const PAL_KIND = Object.fromEntries(SPECIES.concat([FOUNDER]).map((s) => [s.id, s.name]));
const GAME_LABEL = {
  stardrop: 'Star Drop', starcards: 'Star Cards', pool: 'Star Pool', chess: 'Chess',
  ludo: 'Ludo', trivia: 'Studio Trivia', klgrid: 'KL Grid', checkers: 'Checkers',
  pals: 'Pal Games', quest: "Kemy's Bubble Quest"
};
const HOUSE_LABEL = {
  cottage: 'Pumpkin Cottage', twostory: 'Maple Two-Story', ranch: 'Sunny Ranch',
  manor: 'Starlight Manor', mansion: 'Moonbeam Mansion', estate: 'Sunrise Grand Estate'
};
const CAR_LABEL = {
  pip: 'Pocket Pip', star: 'Star Racer', cruise: 'Moonlight Cruiser', bear: 'Trail Bear',
  comet: 'Purple Comet', aurora: 'Aurora GT', nova: 'Nova Arrow', blaze: 'Solar Blaze',
  tide: 'Tidal Spark', breeze: 'Sunny Breeze', glide: 'Velvet Glide', storm: 'Thunder Kite',
  aurum: 'Golden Meteor', pixie: 'Pixie Dash'
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function isAdmin() {
  const u = auth.currentUser;
  return !!(u && u.email === ADMIN_EMAIL && u.emailVerified);
}

function nyStamp(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : (ts ? new Date(ts) : null);
  if (!d || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  }).format(d);
}

export function nyTime(ts) {
  return nyStamp(ts) || 'Join time not recorded';
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

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const comma = (n) => num(n).toLocaleString('en-US');

function onKemyStreet(plot) {
  const m = /^h(\d{2,3})$/.exec(String(plot || ''));
  if (!m) return false;
  const n = Number(m[1]);
  return n >= 1 && n <= 98;
}

function carNames(str) {
  const names = [];
  for (const part of String(str || '').split(';').slice(0, 50)) {
    const id = part.split('.')[0];
    if (!id) continue;
    names.push(CAR_LABEL[id] || id);
  }
  return names;
}

function gameLines(gs, ps) {
  const lines = [];
  const seen = new Set();
  const data = gs || {};
  for (const key of Object.keys(data)) {
    const m = /^([a-z0-9]+)_([wld])$/.exec(key);
    if (m) seen.add(m[1]);
  }
  const order = ['stardrop', 'starcards', 'pool', 'chess', 'ludo', 'trivia', 'klgrid', 'checkers', 'pals', 'quest'];
  const types = [...seen].sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) || a.localeCompare(b));
  let played = 0;
  for (const t of types) {
    if (t === 'pals' && ps && num(ps.games)) continue;
    const w = num(data[t + '_w']), l = num(data[t + '_l']), d = num(data[t + '_d']);
    const n = w + l + d;
    if (!n) continue;
    played += n;
    lines.push(`${GAME_LABEL[t] || t}: ${n} played, ${w} ${w === 1 ? 'win' : 'wins'}, ${l} ${l === 1 ? 'loss' : 'losses'}${d ? `, ${d} ${d === 1 ? 'draw' : 'draws'}` : ''}`);
  }
  if (ps && num(ps.games)) {
    const w = num(ps.wins), n = num(ps.games), l = Math.max(0, n - w);
    played += n;
    lines.push(`Pal Games: ${n} played, ${w} ${w === 1 ? 'win' : 'wins'}, ${l} ${l === 1 ? 'loss' : 'losses'}`);
  }
  return { played, lines };
}

function banActive(ban) {
  return !!(ban && ban.until && typeof ban.until.toMillis === 'function' && ban.until.toMillis() > Date.now());
}

async function revealEmail(uid, slot, btn, say) {
  if (!slot.hidden) { slot.hidden = true; slot.textContent = ''; btn.textContent = 'Show email'; return; }
  btn.disabled = true;
  try {
    const snap = await getDoc(doc(db, 'members', uid, 'secret', 'email'));
    const email = snap.exists() ? String(snap.get('email') || '') : '';
    slot.textContent = email || 'No email recorded';
    slot.hidden = false;
    btn.textContent = 'Hide email';
  } catch (e) { say(e.message || 'Couldn’t load that email.'); }
  btn.disabled = false;
}

async function loadDetail(uid) {
  const safe = (p) => p.catch(() => null);
  const [userSnap, wallet, diamonds, games, pals, homes, banSnap, devices, followers, following, inDocs, outDocs] = await Promise.all([
    safe(getDoc(doc(db, 'users', uid))),
    safe(getDoc(doc(db, 'users', uid, 'pal', 'wallet'))),
    safe(getDoc(doc(db, 'users', uid, 'pal', 'diamonds'))),
    safe(getDoc(doc(db, 'gameStats', uid))),
    safe(getDoc(doc(db, 'palStats', uid))),
    safe(getDocs(query(collection(db, 'homes'), where('owner', '==', uid), limit(8)))),
    safe(getDoc(doc(db, 'bans', uid))),
    safe(getDocs(query(collection(db, 'users', uid, 'devices'), orderBy('lastSeen', 'desc'), limit(8)))),
    safe(getCountFromServer(query(collection(db, 'follows'), where('followee', '==', uid)))),
    safe(getCountFromServer(query(collection(db, 'follows'), where('follower', '==', uid)))),
    safe(getDocs(query(collection(db, 'follows'), where('followee', '==', uid), limit(200)))),
    safe(getDocs(query(collection(db, 'follows'), where('follower', '==', uid), limit(200))))
  ]);
  let pal = null;
  const activeId = userSnap && userSnap.exists() ? String(userSnap.get('activePet') || '') : '';
  if (activeId) {
    const pet = await safe(getDoc(doc(db, 'users', uid, 'pets', activeId)));
    if (pet && pet.exists()) pal = { id: pet.id, ...pet.data() };
  }
  if (!pal) {
    const pets = await safe(getDocs(collection(db, 'users', uid, 'pets')));
    const first = pets && pets.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id))[0];
    pal = first || null;
  }
  let last = null;
  if (devices && devices.docs) {
    for (const d of devices.docs) {
      const t = d.get('lastSeen');
      if (t && (!last || millis(t) > millis(last))) last = t;
    }
  }
  const outSet = new Set((outDocs && outDocs.docs || []).map((d) => d.get('followee')));
  let mutual = 0;
  for (const d of (inDocs && inDocs.docs) || []) if (outSet.has(d.get('follower'))) mutual += 1;
  const capped = !!((inDocs && inDocs.size >= 200) || (outDocs && outDocs.size >= 200));
  const street = [];
  if (homes && homes.docs) {
    for (const h of homes.docs) {
      if (!onKemyStreet(h.id)) continue;
      street.push({ id: h.id, style: h.get('style') || '', cars: carNames(h.get('cars')) });
    }
  }
  return {
    pal, last,
    coins: wallet && wallet.exists() ? wallet.get('coins') : 0,
    diamonds: diamonds && diamonds.exists() ? diamonds.get('d') : 0,
    games: games && games.exists() ? games.data() : null,
    pals: pals && pals.exists() ? pals.data() : null,
    street,
    ban: banSnap && banSnap.exists() ? banSnap.data() : null,
    followers: followers ? (followers.data().count || 0) : 0,
    following: following ? (following.data().count || 0) : 0,
    mutual, capped,
    devicesOk: !!devices
  };
}

function rowHtml(m, fresh) {
  const name = m.displayName || m.username || 'New member';
  const handle = m.username ? '@' + m.username : '';
  return `<article class="nm-row">
    <button type="button" class="nm-open" data-open="${esc(m.uid)}" aria-label="Open ${esc(name)}">
      ${avatarHtml(m)}
      <span class="nm-meta">
        <span class="nm-name"><b>${esc(name)}</b>${fresh ? '<span class="nm-new">New</span>' : ''}</span>
        ${handle ? `<span class="nm-handle">${esc(handle)}</span>` : ''}
        <span class="nm-when">${esc(nyTime(m.createdAt))}</span>
        <span class="nm-how">${esc(signupLine(m.signup))}</span>
      </span>
      <span class="nm-go" aria-hidden="true">›</span>
    </button>
    <button type="button" class="btn btn-sm btn-ghost nm-mail" data-mail="${esc(m.uid)}">Show email</button>
    <p class="nm-email" hidden></p>
  </article>`;
}

export async function page(main, { stale, toast, mod } = {}) {
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
    <div id="nm-shell">
    <a class="nm-back" href="#/admin">← Admin</a>
    <h1 class="page-title">New Members</h1>
    <p class="muted small nm-lead">Newest first. Tap a member for their Pal, games, and home. Times are New York time. Emails stay hidden until you tap.</p>
    <label class="check nm-push"><input type="checkbox" id="nm-push"> <span>Ping me when someone new joins<br><span class="muted small">Off during quiet hours (9pm–8am). Turn on notifications in Settings so your phone can get it. When Kemy is closed, the phone plays its own sound.</span></span></label>
    <label class="nm-search" for="nm-q">Search</label>
    <input id="nm-q" type="search" placeholder="Name or @username" autocomplete="off" enterkeyhint="search">
    <p class="small" style="margin:0 0 8px"><button type="button" class="btn btn-sm btn-ghost" id="nm-fill">Fill in older join times</button></p>
    <p class="small muted" id="nm-status"></p>
    <div id="nm-list" aria-live="polite"></div>
    <div id="nm-end"></div>
    </div>
    <div id="nm-detail" hidden></div>
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

  const shell = main.querySelector('#nm-shell');
  const detail = main.querySelector('#nm-detail');
  let detailToken = 0;
  const closeDetail = () => {
    detailToken += 1;
    detail.hidden = true;
    detail.innerHTML = '';
    shell.hidden = false;
  };
  const detailHtml = (m, info) => {
    const name = m.displayName || m.username || 'Member';
    const handle = m.username ? '@' + m.username : '';
    const kind = info.pal ? (PAL_KIND[info.pal.species] || info.pal.species || 'Pal') : '';
    const nick = info.pal ? (info.pal.name || kind) : '';
    const palLine = info.pal
      ? `Pal: ${nick}${kind && nick !== kind ? ' · ' + kind : ''}${info.pal.level ? ' · level ' + num(info.pal.level) : ''}`
      : 'No Pal yet';
    const rec = gameLines(info.games, info.pals);
    const house = info.street.length
      ? info.street.map((h) => `${HOUSE_LABEL[h.style] || 'House'} on Kemy Street (${h.id})`).join(', ')
      : 'No house on Kemy Street';
    const cars = info.street.reduce((all, h) => all.concat(h.cars), []);
    const friendN = info.capped ? info.mutual + ' or more' : String(info.mutual);
    const friendWord = info.mutual === 1 && !info.capped ? 'friend' : 'friends';
    const paused = banActive(info.ban);
    const banNote = !paused ? '' : info.ban.permanent
      ? 'Suspended from chat.' + (info.ban.reason ? ' ' + info.ban.reason + '.' : '') + ' This pause does not end on its own.'
      : 'Suspended from chat until ' + (nyStamp(info.ban.until) || 'later') + '.' + (info.ban.reason ? ' ' + info.ban.reason + '.' : '');
    const self = m.uid === uid;
    const actions = self
      ? '<p class="nm-note">This is your account.</p>'
      : `<p class="nm-note">A message is an inbox note from Kemy Moderators. They can reply. Suspending is the pause already in Moderator Tools: it stops chat, posts, Pal Park talk, and games.</p>
        <div class="nm-acts">
          <button type="button" class="btn" data-act="msg">Message</button>
          ${paused ? '<button type="button" class="btn btn-ghost" data-act="unban">Unsuspend</button>' : '<button type="button" class="btn btn-danger" data-act="ban">Suspend from chat</button>'}
        </div>`;
    return `<button type="button" class="nm-back" id="nm-back">← New Members</button>
      <article class="nm-card-detail">
        <div class="nm-detail-head">${avatarHtml(m)}<div><h1>${esc(name)}</h1>${handle ? `<a class="nm-handle" href="#/u/${esc(m.username)}">${esc(handle)}</a>` : ''}<p class="nm-pal">${esc(palLine)}</p></div></div>
        <p class="nm-when">Joined ${esc(nyTime(m.createdAt))}</p>
        <p class="nm-when">Last active ${esc(info.devicesOk ? (nyStamp(info.last) || 'Not recorded yet') : 'Not available')}</p>
        ${banNote ? `<p class="nm-ban">${esc(banNote)}</p>` : ''}
        <div class="nm-stats">
          <div class="nm-stat"><b>${esc(comma(info.coins))}</b><span>Star Coins</span></div>
          <div class="nm-stat"><b>${esc(comma(info.diamonds))}</b><span>Diamonds</span></div>
          <div class="nm-stat"><b>${esc(String(rec.played))}</b><span>Games played</span></div>
          <div class="nm-stat"><b>${esc(friendN)}</b><span>${esc(friendWord)}</span></div>
        </div>
        <h2 class="nm-h2">Records</h2>
        <p class="nm-block">${rec.lines.length ? rec.lines.map((line) => esc(line)).join('<br>') : 'No games recorded yet.'}</p>
        <h2 class="nm-h2">Kemy Street</h2>
        <p class="nm-block">${esc(house)}</p>
        <p class="nm-block">${esc(cars.length ? cars.join(', ') : 'No cars parked on Kemy Street')}</p>
        <h2 class="nm-h2">Friends</h2>
        <p class="nm-block">${esc(friendN)} ${esc(friendWord)} (you both follow each other) · ${info.followers} followers · ${info.following} following</p>
        <h2 class="nm-h2">Email</h2>
        <button type="button" class="btn btn-sm btn-ghost nm-mail" data-mail="${esc(m.uid)}">Show email</button>
        <p class="nm-email" hidden></p>
        <h2 class="nm-h2">Admin actions</h2>
        ${actions}
      </article>`;
  };
  async function openDetail(memberUid) {
    if (!isAdmin() || !shell || !detail) return;
    const token = ++detailToken;
    const m = seen.get(memberUid) || { uid: memberUid };
    shell.hidden = true;
    detail.hidden = false;
    detail.innerHTML = `<button type="button" class="nm-back" id="nm-back">← New Members</button><div class="spinner"></div>`;
    detail.querySelector('#nm-back').onclick = closeDetail;
    let info;
    try { info = await loadDetail(memberUid); }
    catch (e) {
      if (token !== detailToken || (stale && stale())) return;
      detail.innerHTML = `<button type="button" class="nm-back" id="nm-back">← New Members</button><div class="card empty">${esc(e.message || 'Couldn’t open that member.')}</div>`;
      detail.querySelector('#nm-back').onclick = closeDetail;
      return;
    }
    if (token !== detailToken || (stale && stale())) return;
    detail.innerHTML = detailHtml(m, info);
    const back = detail.querySelector('#nm-back');
    back.onclick = closeDetail;
    back.focus();
    window.scrollTo(0, 0);
  }
  detail.onclick = async (ev) => {
    if (!isAdmin()) return;
    const mail = ev.target.closest('[data-mail]');
    if (mail) {
      const slot = detail.querySelector('.nm-email');
      if (slot) revealEmail(mail.dataset.mail, slot, mail, say);
      return;
    }
    const act = ev.target.closest('[data-act]');
    if (!act || !mod) return;
    const mailBtn = detail.querySelector('[data-mail]');
    const memberUid = mailBtn && mailBtn.dataset.mail;
    if (!memberUid) return;
    const m = seen.get(memberUid) || { uid: memberUid };
    const name = m.displayName || m.username || 'Member';
    if (act.dataset.act === 'msg' && mod.messageDialog) {
      mod.messageDialog(memberUid, name, 'thanks', { prefill: 'Hi! This is a note from Kemy. 💜' });
      return;
    }
    if (act.dataset.act === 'ban' && mod.banDialog) {
      const pending = mod.banDialog(memberUid, name, m.username || '');
      if (pending && typeof pending.then === 'function') pending.then((ok) => { if (ok) openDetail(memberUid); });
      return;
    }
    if (act.dataset.act === 'unban' && mod.unban) {
      const ok = await mod.unban(memberUid, name);
      if (ok) openDetail(memberUid);
    }
  };

  list.onclick = (ev) => {
    if (!isAdmin()) return;
    const mail = ev.target.closest('[data-mail]');
    if (mail) {
      const row = mail.closest('.nm-row');
      const slot = row && row.querySelector('.nm-email');
      if (slot) revealEmail(mail.dataset.mail, slot, mail, say);
      return;
    }
    const open = ev.target.closest('[data-open]');
    if (open) openDetail(open.dataset.open);
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
