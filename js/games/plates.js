// In-game profile plates (avatar, name, rank or score). Built once per seat, then only the
// text or class that actually changed is touched, so photos do not reload and timers do not
// restart their pulse. Each player photo is fetched at most once for the whole visit.
import { safePhotoURL } from '../media-config.js';
import { CONTROLLER } from './art.js';
import { faceSvg } from './bots.js';
import { isBot } from './net.js';

let getProfile = null;
const photos = new Map();
const pending = new Map();

export function bindProfiles(fn) { getProfile = typeof fn === 'function' ? fn : null; }

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return (((parts[0] && parts[0][0]) || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function safeColor(c) { return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#8a2be2'; }
function humanId(person) {
  return !!(person && person.uid && person.uname && !person.bot && !isBot(person.uid));
}
function faceKey(person) {
  if (person && (person.bot || isBot(person.uid))) return 'bot:' + (person.name || '');
  if (humanId(person)) return 'u:' + person.uid;
  return 'empty';
}

function paintFaces(uid) {
  const url = photos.get(uid) || '';
  document.querySelectorAll('.plate-face[data-uid]').forEach((el) => { if (el.dataset.uid === uid) applyPhoto(el, url); });
}
function applyPhoto(face, url) {
  if (!url) {
    if (face.classList.contains('has-photo')) {
      face.classList.remove('has-photo');
      face.textContent = face.dataset.ini || '';
    }
    return;
  }
  let img = face.querySelector('img');
  if (!img) {
    face.textContent = '';
    img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    face.appendChild(img);
  }
  if (img.getAttribute('src') !== url) img.setAttribute('src', url);
  face.classList.add('has-photo');
}
function loadPhoto(uid, known) {
  if (!uid || isBot(uid)) return;
  if (known !== undefined) {
    const u = safePhotoURL(known) || '';
    if (photos.get(uid) !== u) { photos.set(uid, u); paintFaces(uid); }
    else if (!photos.has(uid)) photos.set(uid, u);
    return;
  }
  if (photos.has(uid) || pending.has(uid) || !getProfile) return;
  const job = Promise.resolve(getProfile(uid)).then((p) => {
    if (pending.get(uid) !== job) return;
    pending.delete(uid);
    photos.set(uid, safePhotoURL(p && p.photoURL) || '');
    paintFaces(uid);
  }, () => { if (pending.get(uid) === job) { pending.delete(uid); photos.set(uid, ''); } });
  pending.set(uid, job);
}
function consider(person) { if (humanId(person)) loadPhoto(person.uid, person.photoURL); }

function ensureChild(parent, key, tag, className) {
  let el = null;
  for (const ch of parent.children) if (ch.dataset.k === key) { el = ch; break; }
  if (!el) {
    el = document.createElement(tag || 'span');
    el.dataset.k = key;
    parent.appendChild(el);
  }
  if (className != null && el.className !== className) el.className = className;
  return el;
}
function arrange(parent, keys) {
  const want = new Set(keys);
  for (const ch of [...parent.children]) if (ch.dataset && ch.dataset.k && !want.has(ch.dataset.k)) ch.remove();
  let cursor = parent.firstElementChild;
  for (const k of keys) {
    let el = null;
    for (const ch of parent.children) if (ch.dataset.k === k) { el = ch; break; }
    if (!el) continue;
    if (el !== cursor) parent.insertBefore(el, cursor);
    cursor = el.nextElementSibling;
  }
}
function faceClasses(face, human) {
  face.classList.add('avatar', 'sm', 'plate-face');
  face.classList.toggle('gp-bot', !human);
}
function ensureFace(gp, person) {
  let face = null;
  for (const ch of gp.children) if (ch.dataset.k === 'face') { face = ch; break; }
  if (!face) {
    face = document.createElement('span');
    face.dataset.k = 'face';
    face.setAttribute('aria-hidden', 'true');
    gp.insertBefore(face, gp.firstChild);
  }
  const fk = faceKey(person);
  const human = fk.startsWith('u:');
  faceClasses(face, human);
  if (face.dataset.fk !== fk) {
    face.dataset.fk = fk;
    face.classList.remove('has-photo');
    if (!human) {
      face.style.setProperty('--c', '#3b2466');
      delete face.dataset.uid;
      face.innerHTML = fk.startsWith('bot:') ? faceSvg(person.name || '', 28) : CONTROLLER;
    } else {
      const ini = initials(person.name);
      face.dataset.uid = person.uid;
      face.dataset.h = '1';
      face.dataset.ini = ini;
      face.style.setProperty('--c', safeColor(person.color));
      const url = photos.get(person.uid) || '';
      if (url) applyPhoto(face, url);
      else face.textContent = ini;
    }
  } else if (human) {
    const color = safeColor(person.color);
    if (face.style.getPropertyValue('--c') !== color) face.style.setProperty('--c', color);
    const ini = initials(person.name);
    if (face.dataset.ini !== ini) face.dataset.ini = ini;
    if (photos.has(person.uid)) applyPhoto(face, photos.get(person.uid));
  }
  if (human) loadPhoto(person.uid, person.photoURL);
  return face;
}
function ensureName(gp, person) {
  let n = null;
  for (const ch of gp.children) if (ch.dataset.k === 'name') { n = ch; break; }
  if (!n) {
    n = document.createElement('span');
    n.dataset.k = 'name';
    n.className = 'gp-n';
    gp.appendChild(n);
  }
  const label = person.name || '';
  let text = n.firstChild;
  if (!text || text.nodeType !== 3) {
    text = document.createTextNode(label);
    n.insertBefore(text, n.firstChild);
  } else if (text.nodeValue !== label) text.nodeValue = label;
  const bot = !!(person && (person.bot || isBot(person.uid)));
  let tag = n.querySelector(':scope > .bot-tag');
  if (bot) {
    if (!tag) { tag = document.createElement('i'); tag.className = 'bot-tag'; tag.textContent = 'Bot'; n.appendChild(tag); }
  } else if (tag) tag.remove();
  const badge = !bot && humanId(person) && window.kemyModBadge ? window.kemyModBadge(person.uid) : '';
  if ((n.dataset.badge || '') !== badge) {
    n.querySelectorAll('[data-badge]').forEach((el) => el.remove());
    if (badge) {
      const hold = document.createElement('span');
      hold.dataset.badge = '1';
      hold.innerHTML = badge;
      n.appendChild(hold);
    }
    n.dataset.badge = badge;
  }
}
function paintBit(parent, b) {
  const el = ensureChild(parent, b.key, b.tag || 'span', b.className);
  if (b.title != null && el.title !== b.title) el.title = b.title;
  if (b.html != null) {
    const sig = b.sig == null ? b.html : String(b.sig);
    if (el.dataset.sig !== sig) { el.innerHTML = b.html; el.dataset.sig = sig; }
  } else if (b.text != null && el.textContent !== b.text) el.textContent = b.text;
  return el;
}
function paintOne(el, row) {
  if (row.className != null && el.className !== row.className) el.className = row.className;
  if (row.side != null && el.dataset.side !== String(row.side)) el.dataset.side = String(row.side);
  if (row.vars) {
    for (const [k, val] of Object.entries(row.vars)) if (el.style.getPropertyValue(k) !== val) el.style.setProperty(k, val);
  }
  const person = row.person || {};
  if (row.kind === 'chip') {
    ensureFace(el, person);
    ensureName(el, person);
    arrange(el, ['face', 'name']);
    return;
  }
  const leads = row.lead || [];
  const bits = row.bits || [];
  for (const b of leads) paintBit(el, b);
  const gp = ensureChild(el, 'gp', 'div', 'gp' + (row.host ? ' host' : ''));
  ensureFace(gp, person);
  ensureName(gp, person);
  for (const b of bits) paintBit(el, b);
  arrange(el, [...leads.map((b) => b.key), 'gp', ...bits.map((b) => b.key)]);
}

// rows: { key, className, side, vars, host, kind, tag, person, lead, bits }
// bits: { key, className, text, html, sig, title, tag }
export function syncPlates(parent, rows, opts = {}) {
  if (!parent) return;
  for (const row of rows) consider(row.person);
  const keys = [];
  rows.forEach((row, i) => {
    if (opts.sep && i) {
      const vk = 'vs' + i;
      keys.push(vk);
      const vs = ensureChild(parent, vk, 'span', 'g-vs');
      if (vs.textContent !== 'vs') vs.textContent = 'vs';
    }
    keys.push(row.key);
    const el = ensureChild(parent, row.key, row.tag || 'div', null);
    paintOne(el, row);
  });
  arrange(parent, keys);
}
export function syncPlate(el, row) {
  if (!el || !row) return;
  consider(row.person);
  paintOne(el, row);
}
export function setText(el, text) { if (el && el.textContent !== text) el.textContent = text; }
