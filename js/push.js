// Optional Kemy push (Firebase Cloud Messaging). Never asks on first load.
// The browser prompt runs only after Turn on notifications, in Settings or after a win.
// Written by Lone Keem.
import { app, db, EMU, VAPID_KEY, VAPID_READY } from './firebase-init.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from './fsq.js';
import { getMessaging, getToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-messaging.js';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-functions.js';
import { deviceId, deviceLabel } from './devices.js';
import { chimeOn, setChimeOn, playChime, chimeSound, setChimeSound, previewSound, CHIME_SOUNDS, validChime, DEFAULT_CHIME } from './chime.js';

const TYPES = [
  ['invite', 'Friend invites and game challenges', 'When someone follows you or asks you to play.'],
  ['turn', 'Your turn', 'When it is your move in an online game.'],
  ['house', 'Kemy Street home', 'When someone rings or visits your house.'],
  ['daily', 'Daily Star Coins', 'A morning reminder when your daily coins are ready.'],
  ['announce', 'Kemy updates', 'Notes from Lone Keem Studios about something new.']
];
const LATER_MS = 7 * 86400000;

let uid = null, prefs = null, toastFn = () => {}, fg = false, fns = null, nudgeTimer = 0, listening = false;
let saveQ = Promise.resolve();
// Writes run one at a time. A failed save does not block the next one.
function queueSave(fn) {
  const run = saveQ.then(fn);
  saveQ = run.then(() => {}, () => {});
  return run;
}

const prefRef = () => doc(db, 'users', uid, 'prefs', 'push');
const tokenRef = () => doc(db, 'users', uid, 'fcmTokens', deviceId());

function zone() {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { tz = ''; }
  return { tz: String(tz).slice(0, 80), tzOffset: new Date().getTimezoneOffset() };
}
function blank(enabled, prev) {
  const p = prev || {};
  const o = { enabled: !!enabled };
  for (const [k] of TYPES) o[k] = p[k] !== false;
  return o;
}
function iosNeedsInstall() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  return ios && !standalone;
}
function say(msg) { try { toastFn(msg); } catch { /* toast is best-effort */ } }

function banner(title, body, url) {
  let el = document.getElementById('push-banner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'push-banner';
    el.className = 'push-banner';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.replaceChildren();
  const text = document.createElement('div');
  const h = document.createElement('b');
  h.textContent = title || 'Kemy';
  const p = document.createElement('p');
  p.textContent = body || '';
  text.append(h, p);
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'btn btn-sm';
  open.textContent = 'Open';
  open.onclick = () => { location.href = url || 'app.html'; el.remove(); };
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-sm btn-ghost';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '✕';
  close.onclick = () => el.remove();
  el.append(text, open, close);
}

async function listenForeground() {
  if (fg || EMU || !VAPID_READY) return;
  const ok = await isSupported().catch(() => false);
  if (!ok) return;
  onMessage(getMessaging(app), (payload) => {
    const d = (payload && payload.data) || {};
    const note = payload && payload.notification;
    banner((note && note.title) || d.title || 'Kemy', (note && note.body) || d.body || '', d.url || 'app.html');
    playChime();
  });
  fg = true;
}

async function obtainToken() {
  if (EMU || !VAPID_READY) {
    if (!EMU) return null;
    return { token: 'emu_' + deviceId(), local: true };
  }
  const ok = await isSupported().catch(() => false);
  if (!ok || !('serviceWorker' in navigator)) return null;
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 5000))
  ]);
  if (!reg) return null;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  return token ? { token, local: false } : null;
}

async function saveToken(got) {
  const z = zone();
  await setDoc(tokenRef(), {
    token: got.token, label: deviceLabel().slice(0, 60), tz: z.tz, tzOffset: z.tzOffset,
    local: !!got.local, updatedAt: serverTimestamp()
  });
}

async function loadPrefs() {
  if (!uid) return;
  try {
    const s = await getDoc(prefRef());
    prefs = s.exists() ? s.data() : null;
  } catch { prefs = prefs || null; }
}

export async function start(user) {
  uid = user && user.uid;
  if (!listening) {
    listening = true;
    document.addEventListener('kemy:coins', (e) => {
      if (e.detail && e.detail.src === 'win') maybeNudge();
    });
  }
  if (!uid) return;
  await loadPrefs();
  await pullChime();
  if (prefs && prefs.enabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const got = await obtainToken();
      if (got) await saveToken(got);
      listenForeground();
    } catch { /* a quiet refresh should not bother anyone */ }
  }
}
export function stop() {
  uid = null;
  prefs = null;
  clearTimeout(nudgeTimer);
  const n = document.getElementById('push-nudge');
  if (n) n.remove();
}

function paint() {
  const box = document.getElementById('push-box');
  if (!box) return;
  const on = !!(prefs && prefs.enabled);
  box.replaceChildren();
  const lead = document.createElement('p');
  lead.className = 'push-lead';
  lead.textContent = 'Optional. Kemy only pings you after you turn this on, and you can switch it off any time.';
  box.appendChild(lead);
  const hint = document.createElement('p');
  hint.className = 'muted small';
  hint.textContent = 'iPhone: add Kemy to your Home Screen (iOS 16.4 or newer) and open it from that icon. Android and desktop can turn this on right here.';
  box.appendChild(hint);
  box.appendChild(row(
    'push-chime',
    'Chime',
    'Plays your notification sound while Kemy is open, including the What’s New dot. Tap Play below to hear one first.',
    chimeOn(),
    (ev) => {
      setChimeOn(ev.target.checked);
      if (ev.target.checked) playChime();
    }
  ));
  box.appendChild(soundPicker());

  if (!on) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-block';
    btn.id = 'push-on';
    btn.textContent = 'Turn on notifications';
    btn.onclick = () => enable();
    box.appendChild(btn);
  } else {
    box.appendChild(row('push-master', 'Notifications', 'Master switch for this account.', true, (ev) => setMaster(ev.target.checked)));
    const list = document.createElement('div');
    list.className = 'push-types';
    for (const [k, label, help] of TYPES) {
      list.appendChild(row('push-' + k, label, help, prefs[k] !== false, (ev) => setType(k, ev.target.checked)));
    }
    box.appendChild(list);
  }
  const note = document.createElement('p');
  note.className = 'muted small push-note';
  note.textContent = 'Quiet hours are 9pm to 8am in your time zone. Other pings stay under 3 a day so it never gets noisy. Game turns still wait until morning.';
  box.appendChild(note);
  const credit = document.createElement('p');
  credit.className = 'muted small';
  credit.textContent = 'Written by Lone Keem.';
  box.appendChild(credit);
  const card = document.getElementById('push-card');
  if (card) card.dataset.pushState = on ? 'on' : 'off';
}

function row(id, label, help, checked, onchange) {
  const lab = document.createElement('label');
  lab.className = 'push-row';
  const span = document.createElement('span');
  const b = document.createElement('b');
  b.textContent = label;
  const small = document.createElement('small');
  small.textContent = help;
  span.append(b, small);
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.role = 'switch';
  input.checked = !!checked;
  input.setAttribute('aria-label', label);
  input.onchange = onchange;
  lab.append(span, input);
  return lab;
}

async function enable() {
  if (!uid) { say('Sign in first.'); return; }
  if (iosNeedsInstall()) {
    say('On iPhone, tap Share, then Add to Home Screen. Open Kemy from that icon, then turn notifications on.');
    return;
  }
  if (typeof Notification === 'undefined') { say('This browser can’t show notifications.'); return; }
  if (!EMU && !VAPID_READY) { say('Notifications aren’t ready yet. The web push key still needs to be added.'); return; }
  let perm = Notification.permission;
  if (perm === 'default') {
    try { perm = await Notification.requestPermission(); } catch { perm = 'denied'; }
  }
  if (perm !== 'granted') { say('Notifications are blocked in this browser. You can allow them in the site settings.'); return; }
  let got = null;
  try { got = await obtainToken(); } catch { got = null; }
  if (!got || !got.token) { say('Couldn’t turn on notifications on this device.'); return; }
  const next = blank(true, prefs);
  try {
    await queueSave(async () => {
      await setDoc(prefRef(), { ...next, updatedAt: serverTimestamp() });
      await saveToken(got);
    });
  } catch {
    say('Couldn’t save that. Please try again.');
    return;
  }
  prefs = next;
  try { localStorage.removeItem('kemy-push-later'); } catch { /* ignore */ }
  listenForeground();
  const n = document.getElementById('push-nudge');
  if (n) n.remove();
  say('Notifications on');
  paint();
}

async function setMaster(on) {
  if (on) { await enable(); return; }
  const next = blank(false, prefs);
  next.enabled = false;
  try {
    await queueSave(async () => {
      await setDoc(prefRef(), { ...next, updatedAt: serverTimestamp() });
      await deleteDoc(tokenRef());
    });
  } catch { say('Couldn’t turn notifications off. Please try again.'); paint(); return; }
  prefs = next;
  say('Notifications off');
  paint();
}

async function setType(key, on) {
  if (!prefs || !prefs.enabled) return;
  const prev = prefs[key] !== false;
  try {
    await queueSave(async () => {
      const next = blank(true, prefs);
      next[key] = !!on;
      prefs = { ...prefs, [key]: !!on };
      await setDoc(prefRef(), { ...next, updatedAt: serverTimestamp() });
    });
    say(on ? 'That ping is on' : 'That ping is off');
  } catch {
    if (prefs) prefs[key] = prev;
    say('Couldn’t save that. Please try again.');
    paint();
  }
}

async function pullChime() {
  if (!uid) return;
  try {
    const s = await getDoc(doc(db, 'users', uid, 'prefs', 'chime'));
    const id = s.exists() ? s.data().sound : '';
    if (validChime(id)) setChimeSound(id);
  } catch { /* keep the sound saved on this device */ }
}
async function chooseSound(id) {
  setChimeSound(id);
  if (!uid) return;
  try {
    await setDoc(doc(db, 'users', uid, 'prefs', 'chime'), { sound: id, updatedAt: serverTimestamp() });
  } catch { say('Saved on this device. It could not be saved on the account.'); }
}
function soundPicker() {
  const wrap = document.createElement('div');
  wrap.className = 'chime-pick';
  const h = document.createElement('h3');
  h.className = 'chime-h';
  h.id = 'chime-h';
  h.textContent = 'Notification sound';
  const note = document.createElement('p');
  note.className = 'muted small chime-note';
  note.textContent = 'When Kemy is closed, your phone plays its own sound. Kemy can’t change that. These play while Kemy is open.';
  const list = document.createElement('div');
  list.className = 'chime-list';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-labelledby', 'chime-h');
  const current = chimeSound();
  for (const s of CHIME_SOUNDS) {
    const row = document.createElement('div');
    row.className = 'chime-opt';
    const lab = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'chime-sound';
    input.value = s.id;
    input.checked = s.id === current;
    input.setAttribute('aria-label', s.id === DEFAULT_CHIME ? s.name + ', Default' : s.name);
    input.onchange = () => { if (input.checked) chooseSound(s.id); };
    const name = document.createElement('span');
    name.textContent = s.name;
    if (s.id === DEFAULT_CHIME) {
      const tag = document.createElement('em');
      tag.className = 'chime-default';
      tag.textContent = 'Default';
      name.append(document.createTextNode(' '), tag);
    }
    lab.append(input, name);
    row.append(lab);
    if (s.file) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm btn-ghost';
      btn.textContent = 'Play';
      btn.setAttribute('aria-label', 'Play ' + s.name);
      btn.onclick = () => previewSound(s.id);
      row.append(btn);
    }
    list.append(row);
  }
  wrap.append(h, note, list);
  return wrap;
}

export async function wireSettings(toast) {
  toastFn = typeof toast === 'function' ? toast : toastFn;
  await loadPrefs();
  await pullChime();
  paint();
}

function showNudge() {
  if (!uid || (prefs && prefs.enabled) || document.getElementById('push-nudge')) return;
  const el = document.createElement('div');
  el.id = 'push-nudge';
  el.className = 'push-nudge';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Turn on notifications');
  const h = document.createElement('b');
  h.textContent = 'Nice win!';
  const p = document.createElement('p');
  p.textContent = 'Want a ping when it’s your turn or a friend asks you to play? You can turn it off any time in Settings.';
  const rowEl = document.createElement('div');
  rowEl.className = 'push-nudge-row';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'btn';
  yes.textContent = 'Turn on notifications';
  yes.onclick = () => { el.remove(); enable(); };
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn btn-ghost';
  no.textContent = 'Not now';
  no.onclick = () => {
    try { localStorage.setItem('kemy-push-later', String(Date.now())); } catch { /* ignore */ }
    el.remove();
  };
  rowEl.append(yes, no);
  el.append(h, p, rowEl);
  document.body.appendChild(el);
}

export function maybeNudge() {
  if (!uid || (prefs && prefs.enabled)) return;
  try {
    const t = +localStorage.getItem('kemy-push-later') || 0;
    if (t && Date.now() - t < LATER_MS) return;
  } catch { return; }
  const started = Date.now();
  const tick = () => {
    if (!uid || (prefs && prefs.enabled)) return;
    if (document.querySelector('.modal-backdrop')) {
      if (Date.now() - started > 20000) return;
      nudgeTimer = setTimeout(tick, 400);
      return;
    }
    showNudge();
  };
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(tick, 500);
}

export function adminHtml() {
  return `<div class="card pad adm-tool" id="push-admin" style="margin-bottom:12px">
    <b style="font-size:1.05rem">📣 Update announcement</b>
    <p class="muted small">Sends a push to people who turned on Kemy updates. Quiet hours (9pm–8am their time) and the 3-a-day limit still apply. Anyone who switched this off won’t get it.</p>
    <label for="push-an-title">Title</label>
    <input id="push-an-title" maxlength="40" placeholder="New in Kemy" autocomplete="off">
    <label for="push-an-body">Message</label>
    <textarea id="push-an-body" maxlength="140" rows="3" placeholder="A short, friendly note"></textarea>
    <label for="push-an-url">Opens in Kemy</label>
    <input id="push-an-url" maxlength="80" value="#/feed" autocomplete="off" spellcheck="false">
    <button class="btn" type="button" id="push-an-send">Send announcement</button>
    <p class="small muted" id="push-an-msg" style="margin:8px 0 0"></p>
  </div>`;
}

function functionsApp() {
  if (!fns) {
    fns = getFunctions(app, 'us-central1');
    if (EMU) connectFunctionsEmulator(fns, '127.0.0.1', 5199);
  }
  return fns;
}

export async function sendAnnounce(data) {
  const fn = httpsCallable(functionsApp(), 'sendAnnouncement');
  const res = await fn(data || {});
  return res.data || {};
}

export function wireAdmin(toast) {
  toastFn = typeof toast === 'function' ? toast : toastFn;
  const b = document.getElementById('push-an-send');
  if (!b || b.dataset.wired) return;
  b.dataset.wired = '1';
  b.onclick = async () => {
    const msg = document.getElementById('push-an-msg');
    b.disabled = true;
    if (msg) msg.textContent = 'Sending…';
    try {
      const d = await sendAnnounce({
        title: document.getElementById('push-an-title').value,
        body: document.getElementById('push-an-body').value,
        url: document.getElementById('push-an-url').value
      });
      if (msg) msg.textContent = `Sent to ${d.sent || 0} ${d.sent === 1 ? 'person' : 'people'}. ${d.skipped || 0} skipped (off, quiet hours, or the daily limit).`;
      say('Announcement sent');
    } catch (e) {
      const code = (e && e.code) || '';
      if (msg) msg.textContent = /not-found|unavailable|internal/.test(code)
        ? 'The announcement function isn’t deployed yet.'
        : ((e && e.message) || 'Couldn’t send that.');
    }
    b.disabled = false;
  };
}
