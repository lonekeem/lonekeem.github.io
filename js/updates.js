// What's New: a kid-friendly list of things added to Kemy.
// updates.json is the fallback. Firestore updates/{id} is what the admin adds, and it wins on the same id.
// The gold dot clears when this page is opened. Last seen is kept on the device and, if signed in, on the account.
// Written by Lone Keem.
import { auth, db, ADMIN_EMAIL } from './firebase-init.js';
import { collection, doc, getDoc, getDocs, setDoc, query, limit, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const SEEN_KEY = 'kemy-updates-seen';
const TYPES = { new: 'New', fix: 'Bug Fix', soon: 'Coming Soon' };
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'fix', label: 'Fixes' },
  { id: 'soon', label: 'Coming Soon' }
];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let activeFilter = 'all';

let pack = null;
let loading = null;

function isAdmin() {
  const u = auth.currentUser;
  return !!(u && u.email === ADMIN_EMAIL && u.emailVerified);
}
export function safeHref(link) {
  const s = String(link || '').trim();
  if (/^#\/[A-Za-z0-9_/?=&%.\-]{1,80}$/.test(s)) return s;
  if (/^[a-z0-9][a-z0-9./_-]{0,80}$/.test(s) && !s.includes('..')) return s;
  return '';
}
export function safeImage(src) {
  const s = String(src || '').trim();
  if (/^[A-Za-z0-9_./-]{1,120}$/.test(s) && !s.includes('..')) return s;
  return '';
}
function pretty(date) {
  const [y, m, d] = String(date).split('-').map(Number);
  if (!y || !m || !d) return '';
  try { return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return date; }
}
export function normalize(raw, id) {
  const date = String((raw && raw.date) || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (raw && raw.hidden === true) return { id: String(id || ''), hidden: true };
  const title = String((raw && raw.title) || '').trim().slice(0, 80);
  const body = String((raw && raw.body) || '').trim().slice(0, 400);
  if (!title || !body) return null;
  const type = TYPES[String((raw && raw.type) || '').toLowerCase()] ? String(raw.type).toLowerCase() : 'new';
  return {
    id: String(id || raw.id || '').slice(0, 40),
    date, title, body, type,
    emoji: String((raw && raw.emoji) || '').trim().slice(0, 16),
    image: safeImage(raw && raw.image),
    link: safeHref(raw && raw.link)
  };
}
// Coming Soon is pinned for display only. The gold dot follows date order, so a shipped
// entry with a newer date still lights the dot while teasers stay at the top of the page.
export function displayOrder(entries) {
  const soon = [];
  const rest = [];
  for (const e of entries || []) (e.type === 'soon' ? soon : rest).push(e);
  return soon.concat(rest);
}
export function passesFilter(entry, filter) {
  if (filter === 'new' || filter === 'fix' || filter === 'soon') return entry.type === filter;
  return true;
}
export function mergeUpdates(base, remote) {
  const map = new Map();
  const order = new Map();
  (base || []).forEach((e, i) => { if (e && e.id) order.set(e.id, i); });
  for (const e of base || []) {
    const n = normalize(e, e && e.id);
    if (n && !n.hidden && n.id) map.set(n.id, n);
  }
  for (const e of remote || []) {
    const n = normalize(e, e && e.id);
    if (!n || !n.id) continue;
    if (n.hidden) map.delete(n.id);
    else map.set(n.id, n);
  }
  // Newest day first. On the same day, keep the order from updates.json.
  return [...map.values()].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate) return byDate;
    const ia = order.has(a.id) ? order.get(a.id) : 1000;
    const ib = order.has(b.id) ? order.get(b.id) : 1000;
    if (ia !== ib) return ia - ib;
    return a.id.localeCompare(b.id);
  });
}
function indexOf(entries, id) { return entries.findIndex((e) => e.id === id); }
export function newerSeen(entries, a, b) {
  const ia = indexOf(entries, a), ib = indexOf(entries, b);
  if (ia < 0) return ib < 0 ? '' : b;
  if (ib < 0) return a;
  return ia <= ib ? a : b;
}
export function hasUnseen(entries, seen) {
  return !!(entries && entries.length && entries[0].id !== seen);
}

async function readSeen(entries) {
  let local = '';
  try { local = localStorage.getItem(SEEN_KEY) || ''; } catch { local = ''; }
  let remote = '';
  const u = auth.currentUser;
  if (u) {
    try {
      const s = await getDoc(doc(db, 'users', u.uid, 'prefs', 'updates'));
      if (s.exists()) remote = String(s.data().seen || '');
    } catch { remote = ''; }
  }
  return newerSeen(entries, local, remote);
}

async function loadFresh() {
  let base = [];
  try {
    const res = await fetch('updates.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) base = data;
    }
  } catch { base = []; }
  let remote = [];
  try {
    const snap = await getDocs(query(collection(db, 'updates'), limit(80)));
    remote = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { remote = []; }
  const entries = mergeUpdates(base, remote);
  const seen = await readSeen(entries);
  pack = { entries, seen };
  return pack;
}
function ensure() {
  if (pack) return Promise.resolve(pack);
  if (!loading) loading = loadFresh().finally(() => { loading = null; });
  return loading;
}

async function markSeen(id) {
  if (!id) return;
  if (pack) pack.seen = id;
  try { localStorage.setItem(SEEN_KEY, id); } catch { /* private mode */ }
  const u = auth.currentUser;
  if (!u) return;
  try { await setDoc(doc(db, 'users', u.uid, 'prefs', 'updates'), { seen: id, updatedAt: serverTimestamp() }); }
  catch { /* the device copy still clears the dot */ }
}

export async function paintDots() {
  try { await ensure(); } catch { return; }
  const on = hasUnseen(pack.entries, pack.seen);
  document.querySelectorAll('[data-wn-dot]').forEach((d) => { d.hidden = !on; });
}

function card(e) {
  const when = pretty(e.date);
  const type = TYPES[e.type] ? e.type : 'new';
  const art = e.image ? `<img class="wn-img" src="${esc(e.image)}" alt="">` : '';
  const play = e.link ? `<a class="btn wn-play" href="${esc(e.link)}">Play it</a>` : '';
  return `<article class="wn-card">
    <div class="wn-emoji" aria-hidden="true">${esc(e.emoji || '✨')}</div>
    <div>
      <p class="wn-meta"><span class="wn-tag wn-tag-${type}">${esc(TYPES[type])}</span><span class="wn-date">${esc(when)}</span></p>
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.body)}</p>
      ${art}
      ${play}
    </div>
  </article>`;
}

function listHtml(entries) {
  const shown = displayOrder(entries).filter((e) => passesFilter(e, activeFilter));
  if (!shown.length) {
    const empty = activeFilter === 'fix' ? 'No bug fixes in this list yet.'
      : activeFilter === 'new' ? 'No new features in this list yet.'
      : activeFilter === 'soon' ? 'Nothing coming soon just yet.'
      : 'Nothing new just yet. Check back soon.';
    return `<div class="card pad empty">${empty}</div>`;
  }
  return shown.map(card).join('');
}

function tabsHtml() {
  return `<div class="wn-tabs" role="tablist" aria-label="Filter updates">${FILTERS.map((f) =>
    `<button type="button" class="wn-tab" role="tab" data-wn-filter="${f.id}" aria-selected="${f.id === activeFilter ? 'true' : 'false'}">${f.label}</button>`
  ).join('')}</div>`;
}

function formHtml() {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `<form class="card pad wn-form" id="wn-form">
    <h2>Add an update</h2>
    <p class="muted small">Only the Kemy admin can post. It shows up here for everyone. Same id replaces that entry. When a Coming Soon idea ships, post the same id, pick New, and set today's date.</p>
    <label for="wn-type">Type</label>
    <select id="wn-type" required>
      <option value="new">New</option>
      <option value="fix">Bug Fix</option>
      <option value="soon">Coming Soon</option>
    </select>
    <label for="wn-date">Date</label>
    <input id="wn-date" type="date" required value="${iso}">
    <label for="wn-id">Id <span class="muted small">(optional, like star-pool, to replace that entry)</span></label>
    <input id="wn-id" type="text" maxlength="40" placeholder="Filled in from the title" autocomplete="off" spellcheck="false">
    <label for="wn-title">Title</label>
    <input id="wn-title" type="text" maxlength="80" required placeholder="A short name" autocomplete="off">
    <label for="wn-body">For kids</label>
    <textarea id="wn-body" maxlength="400" rows="3" required placeholder="One or two friendly sentences"></textarea>
    <label for="wn-emoji">Emoji <span class="muted small">(optional)</span></label>
    <input id="wn-emoji" type="text" maxlength="16" placeholder="🌟" autocomplete="off">
    <label for="wn-image">Picture in Kemy <span class="muted small">(optional, like assets/featured/pal-bear.webp)</span></label>
    <input id="wn-image" type="text" maxlength="120" placeholder="Leave blank for no picture" autocomplete="off" spellcheck="false">
    <label for="wn-link">Play it link <span class="muted small">(optional)</span></label>
    <input id="wn-link" type="text" maxlength="80" placeholder="#/games/pool" autocomplete="off" spellcheck="false">
    <label class="check wn-ping"><input type="checkbox" id="wn-ping"> <span>Also send the update notification to people who turned that on</span></label>
    <button class="btn" type="submit" id="wn-save">Post update</button>
    <p class="small muted" id="wn-msg"></p>
  </form>`;
}

function slug(title) {
  const s = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  return s.length >= 3 ? s : ('new-' + Math.random().toString(36).slice(2, 8));
}

function wireForm(toast) {
  const form = document.getElementById('wn-form');
  if (!form) return;
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const msg = document.getElementById('wn-msg');
    const btn = document.getElementById('wn-save');
    const title = document.getElementById('wn-title').value.trim();
    const body = document.getElementById('wn-body').value.trim();
    const date = document.getElementById('wn-date').value;
    const type = document.getElementById('wn-type').value;
    const emoji = document.getElementById('wn-emoji').value.trim();
    const image = safeImage(document.getElementById('wn-image').value);
    const link = safeHref(document.getElementById('wn-link').value);
    const ping = document.getElementById('wn-ping').checked;
    if (msg) msg.textContent = '';
    if (!TYPES[type]) {
      if (msg) msg.textContent = 'Pick New, Bug Fix or Coming Soon.';
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || title.length < 1 || body.length < 1) {
      if (msg) msg.textContent = 'Add a date, a title and a short description.';
      return;
    }
    if (document.getElementById('wn-image').value.trim() && !image) {
      if (msg) msg.textContent = 'Pictures stay inside Kemy, like icon-192.png. No web addresses.';
      return;
    }
    if (document.getElementById('wn-link').value.trim() && !link) {
      if (msg) msg.textContent = 'Play links look like #/games/pool.';
      return;
    }
    const typed = document.getElementById('wn-id').value.trim().toLowerCase();
    const id = typed || slug(title);
    if (!/^[a-z0-9-]{3,40}$/.test(id)) {
      if (msg) msg.textContent = 'Ids use lowercase letters, numbers and dashes.';
      return;
    }
    btn.disabled = true;
    try {
      const ref = doc(db, 'updates', id);
      const existing = await getDoc(ref);
      const data = { date, type, title: title.slice(0, 80), body: body.slice(0, 400) };
      if (emoji) data.emoji = emoji.slice(0, 16);
      if (image) data.image = image;
      if (link) data.link = link;
      data.createdAt = existing.exists() && existing.data().createdAt ? existing.data().createdAt : serverTimestamp();
      await setDoc(ref, data);
      const entry = normalize({ ...data, emoji, image, link }, id);
      if (entry && pack) pack.entries = mergeUpdates(pack.entries, [entry]);
      const head = pack && pack.entries && pack.entries[0];
      if (head) markSeen(head.id);
      let pingNote = '';
      if (ping) {
        try {
          const m = await import('./push.js');
          const res = await m.sendAnnounce({ title: title.slice(0, 40), body: body.slice(0, 140), url: link || '#/updates' });
          pingNote = ` Notification sent to ${res.sent || 0}.`;
        } catch (e) {
          const code = (e && e.code) || '';
          pingNote = /not-found|unavailable|internal/.test(code)
            ? ' The entry is saved. The notification function is not deployed yet.'
            : ' The entry is saved. The notification could not be sent.';
        }
      }
      if (msg) msg.textContent = 'Posted.' + pingNote;
      toast && toast('Update posted');
      const list = document.getElementById('wn-list');
      if (list && pack) list.innerHTML = listHtml(pack.entries);
      form.reset();
      const typePick = document.getElementById('wn-type');
      if (typePick) typePick.value = 'new';
      document.getElementById('wn-date').value = date;
    } catch (e) {
      if (msg) msg.textContent = (e && e.code === 'permission-denied') ? 'Only the Kemy admin can post updates.' : 'Could not save that. Please try again.';
    }
    btn.disabled = false;
  };
}

function wireTabs() {
  document.querySelectorAll('[data-wn-filter]').forEach((btn) => {
    btn.onclick = () => {
      activeFilter = btn.getAttribute('data-wn-filter') || 'all';
      document.querySelectorAll('[data-wn-filter]').forEach((b) => {
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      const list = document.getElementById('wn-list');
      if (list && pack) list.innerHTML = listHtml(pack.entries);
    };
  });
}

export async function page(main, ctx) {
  const token = ctx && ctx.token;
  const stale = (ctx && ctx.stale) || (() => false);
  const toast = ctx && ctx.toast;
  activeFilter = 'all';
  main.innerHTML = '<div class="spinner" role="status" aria-label="Loading"></div>';
  try { await ensure(); } catch { pack = pack || { entries: [], seen: '' }; }
  if (stale(token)) return;
  const entries = (pack && pack.entries) || [];
  main.innerHTML = `<section class="wn-page">
    <h1 class="page-title">What's New</h1>
    <p class="wn-lead">Coming soon sits at the top. New things and fixes follow, newest first.</p>
    <p class="muted small wn-credit">Written by Lone Keem.</p>
    ${tabsHtml()}
    <div class="wn-list" id="wn-list">${listHtml(entries)}</div>
    ${isAdmin() ? formHtml() : ''}
  </section>`;
  wireTabs();
  if (isAdmin()) wireForm(toast);
  // Date order, not the pinned Coming Soon card, so a newer shipped entry still lights the dot.
  if (entries[0]) markSeen(entries[0].id);
}
