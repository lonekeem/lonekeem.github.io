// New-device sign-in alerts + "Sign out everywhere" (free, client SDK only). Written by Lone Keem.
// - Each browser gets a random device id in localStorage; users/{uid}/devices/{id} = { label, firstSeen, lastSeen, ack }.
//   Only a rough label from the user agent (e.g. "iPhone · Safari"). No IP, no location.
// - A new device => banner on your other devices, a notice on Mod Hub / Admin, and a "Kemy Security" notification.
//   On by default for the admin and moderators; anyone can turn it on in Settings → Security (users/{uid}/prefs/security).
// - Sign out everywhere: users/{uid}.sessionsValidAfter = server time. Every client checks it on load and live,
//   and signs out if it signed in earlier. The rules refuse device / profile / security writes from older sessions.
import { signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, onSnapshot, serverTimestamp
} from './fsq.js';

const KEY = 'kemy-device-id';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function deviceId() {
  let id = localStorage.getItem(KEY);
  if (!id || !/^[A-Za-z0-9]{20}$/.test(id)) {
    const a = crypto.getRandomValues(new Uint8Array(20)), cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    id = Array.from(a, (b) => cs[b % cs.length]).join(''); localStorage.setItem(KEY, id);
  }
  return id;
}
export function deviceLabel(ua = navigator.userAgent) {
  const os = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /iPhone|iPod/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /CrOS/.test(ua) ? 'Chromebook'
    : /Windows/.test(ua) ? 'Windows PC' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux PC' : 'Device';
  const br = /EdgA?\/|Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
}
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
const when = (t) => new Date(ms(t) || Date.now()).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const alertText = (label, t) => `New sign-in on ${label} at ${when(t)}. Not you? Tap Sign out everywhere.`;

export function createDevices({ auth, db, isPrivileged, toast }) {
  const st = { uid: null, unsubs: [], devices: [], alerts: null, authMs: 0, mine: deviceId(), seen: false };
  const privileged = () => !!(isPrivileged && isPrivileged());
  const alertsOn = () => (st.alerts == null ? privileged() : st.alerts);
  const pending = () => alertsOn() ? st.devices.filter((d) => !d.ack && d.id !== st.mine) : [];

  async function kick(msg) {
    stop(); try { await signOut(auth); } catch {}
    toast && toast(msg); location.hash = '#/login';
  }
  function stop() { st.unsubs.forEach((u) => u()); st.unsubs = []; st.uid = null; st.devices = []; st.seen = false; paint(); }

  async function start(user) {
    if (user && st.uid === user.uid) return;
    stop();
    if (!user || sessionStorage.getItem('kemy-deleting')) return;
    const uid = st.uid = user.uid;
    try { st.authMs = Date.parse((await user.getIdTokenResult()).authTime) || 0; } catch { st.authMs = 0; }
    // Sign out everywhere: check on load + live (1 s slack: auth_time is whole seconds).
    st.unsubs.push(onSnapshot(doc(db, 'users', uid), (s) => {
      const v = ms(s.exists() && s.data().sessionsValidAfter);
      if (v && st.authMs && st.authMs + 1000 <= v) kick('You were signed out everywhere. Please sign in again.');
    }, () => {}));
    try { const p = await getDoc(doc(db, 'users', uid, 'prefs', 'security')); st.alerts = p.exists() ? !!p.data().alerts : null; } catch { st.alerts = null; }
    if (st.uid !== uid) return;
    const ref = doc(db, 'users', uid, 'devices', st.mine), label = deviceLabel();
    let isNew = false, others = 0;
    try {
      const cur = await getDoc(ref);
      if (cur.exists()) await updateDoc(ref, { lastSeen: serverTimestamp(), label });
      else {
        others = (await getDocs(collection(db, 'users', uid, 'devices'))).size;
        // The very first device on an account is just "you" (no alert); every later new one is flagged.
        try { await setDoc(ref, { label, firstSeen: serverTimestamp(), lastSeen: serverTimestamp(), ack: others === 0 }); isNew = others > 0; }
        catch (e) { console.warn('device create failed, retrying as update', e.code); await updateDoc(ref, { lastSeen: serverTimestamp() }); }
      }
    } catch (e) { console.warn('device record failed', e); }
    if (st.uid !== uid) return;
    // Opening Kemy counts as a visit, so the admin list can tell who has been quiet for 30 days.
    updateDoc(doc(db, 'members', uid), { lastActive: serverTimestamp() }).catch(() => {});
    if (isNew && alertsOn()) {
      setDoc(doc(collection(db, 'users', uid, 'notifications')), { type: 'security', fromUid: uid, fromName: 'Kemy Security', fromUsername: '',
        postId: st.mine, text: alertText(label), createdAt: serverTimestamp(), read: false }).catch((e) => console.warn('security note failed', e));
    }
    st.unsubs.push(onSnapshot(collection(db, 'users', uid, 'devices'), (s) => {
      st.devices = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.lastSeen) - ms(a.lastSeen));
      const here = st.devices.some((d) => d.id === st.mine);
      if (here) st.seen = true;
      // "Remove" on another device signs this one out.
      else if (st.seen && !s.metadata.hasPendingWrites && !sessionStorage.getItem('kemy-deleting')) { kick('This device was removed from your account. Please sign in again.'); return; }
      paint();
    }, () => {}));
  }

  async function signOutEverywhere() {
    if (!st.uid) return;
    if (!confirm('Sign out on every device, including this one? You’ll need to sign in again everywhere.')) return;
    const uid = st.uid, sess = st.authMs;
    try {
      // Clear the alerts first: once sessionsValidAfter is set, this (older) session can't write them any more.
      await Promise.all(st.devices.filter((d) => !d.ack).map((d) => updateDoc(doc(db, 'users', uid, 'devices', d.id), { ack: true }).catch(() => {})));
      await updateDoc(doc(db, 'users', uid), { sessionsValidAfter: serverTimestamp() });
    } catch (e) { toast && toast('Couldn’t sign out everywhere: ' + (e.code || e.message)); return; }
    // The live listener usually signs us out first; don't sign out a newer session that started meanwhile.
    if (st.uid === uid && st.authMs === sess) kick('Signed out everywhere. Sign in again on the devices you trust.');
  }
  const ackAll = () => Promise.all(pending().map((d) => updateDoc(doc(db, 'users', st.uid, 'devices', d.id), { ack: true }).catch(() => {})));
  async function remove(id) {
    if (!st.uid) return;
    if (id === st.mine && !confirm('Remove this device? You’ll be signed out here.')) return;
    await deleteDoc(doc(db, 'users', st.uid, 'devices', id)).catch((e) => toast && toast(e.code || e.message));
    if (id === st.mine) kick('Device removed. You’re signed out here.');
  }

  // ----- UI: banner (every page), notice (Mod Hub / Admin), Settings → Security
  const noticeBody = () => pending().map((d) => `<p style="margin:0 0 6px">🔐 ${esc(alertText(d.label, d.firstSeen))}</p>`).join('')
    + `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-danger" data-sec-everywhere type="button">Sign out everywhere</button><button class="btn btn-sm btn-ghost" data-sec-ack type="button">It was me</button></div>`;
  function paint() {
    let b = document.getElementById('sec-banner');
    const list = st.uid ? pending() : [];
    if (!list.length) { b && b.remove(); } else {
      if (!b) { b = document.createElement('div'); b.id = 'sec-banner'; b.className = 'sec-banner'; b.setAttribute('role', 'alert'); document.body.appendChild(b); }
      b.innerHTML = `<b>Kemy Security</b>${noticeBody()}`;
    }
    document.querySelectorAll('[data-sec-notice]').forEach((el) => {
      el.dataset.p = '1'; el.hidden = !list.length; el.innerHTML = list.length ? `<b>🔐 Kemy Security · new sign-in${list.length > 1 ? 's' : ''}</b>${noticeBody()}` : '';
    });
    const box = document.getElementById('sec-devices');
    if (box) box.innerHTML = st.devices.length ? st.devices.map((d) => `<div class="list-item sec-dev"><span style="font-size:1.3rem" aria-hidden="true">${/iPhone|Android phone/.test(d.label) ? '📱' : /iPad|tablet/.test(d.label) ? '📲' : '💻'}</span>
      <div class="meta"><b>${esc(d.label)}</b>${d.id === st.mine ? ' <span class="sec-this">This device</span>' : ''}${!d.ack && d.id !== st.mine ? ' <span class="mod-count">new</span>' : ''}<div class="muted small">Last seen ${esc(when(d.lastSeen))} · first ${esc(when(d.firstSeen))}</div></div>
      <button class="btn btn-sm btn-ghost" type="button" data-sec-remove="${esc(d.id)}">Remove</button></div>`).join('') : '<p class="muted small">No devices recorded yet.</p>';
    const cb = document.getElementById('s-sec-alerts'); if (cb) cb.checked = alertsOn();
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-sec-everywhere],[data-sec-ack],[data-sec-remove]'); if (!t) return;
    if (t.hasAttribute('data-sec-everywhere')) signOutEverywhere();
    else if (t.hasAttribute('data-sec-ack')) ackAll();
    else remove(t.getAttribute('data-sec-remove'));
  });
  const noticeHtml = () => '<div class="banner sec-notice" data-sec-notice hidden></div>';
  const settingsHtml = () => `<section class="card pad" style="margin-top:16px" id="security" aria-labelledby="sec-h">
      <h2 id="sec-h" style="font-size:1.05rem">Security</h2>
      <label class="row" style="gap:10px;align-items:center;margin:6px 0"><input type="checkbox" id="s-sec-alerts"> <span>New-device sign-in alerts<br><span class="muted small">A banner and a Kemy Security message when your account signs in on a new device.${privileged() ? ' On by default for admin and moderators.' : ''}</span></span></label>
      <h3 style="font-size:.95rem;margin:12px 0 4px">Devices</h3>
      <div id="sec-devices"><div class="spinner"></div></div>
      <p class="muted small">Kemy only keeps a rough device name (like “iPhone · Safari”) and when it was last used. No IP address or location.</p>
      <button class="btn btn-sm btn-danger" type="button" data-sec-everywhere>Sign out everywhere</button>
    </section>`;
  function wireSettings() {
    const cb = document.getElementById('s-sec-alerts'); if (!cb) return;
    cb.onchange = async () => {
      st.alerts = cb.checked; paint();
      try { await setDoc(doc(db, 'users', st.uid, 'prefs', 'security'), { alerts: cb.checked, updatedAt: serverTimestamp() }); toast && toast(cb.checked ? 'Sign-in alerts on' : 'Sign-in alerts off'); }
      catch (e) { toast && toast(e.code || e.message); }
    };
    paint();
  }
  // Pages re-render main; repaint notices after each route.
  addEventListener('hashchange', () => setTimeout(paint, 0));
  let q = 0;
  new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; if (document.querySelector('[data-sec-notice]:not([data-p])')) paint(); }); })
    .observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
  return { active: () => !!st.uid, start, stop, paint, noticeHtml, settingsHtml, wireSettings, signOutEverywhere };
}
