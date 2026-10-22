// Moderation queue on the admin page. Reports, strikes, and one-tap actions.
// Dismiss, warn, mute, and ban are Keem's taps. The helper never bans. Written by Lone Keem.
import { auth, db } from '../firebase-init.js';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, where, Timestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const HOUR = 3600e3;
const DAY = 864e5;

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ago(t) {
  const ms = t && t.toMillis ? t.toMillis() : (typeof t === 'number' ? t : 0);
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
}

async function load() {
  const [rq, sq] = await Promise.all([
    getDocs(query(collection(db, 'reports'), where('status', '==', 'open'), limit(40))),
    getDocs(query(collection(db, 'helperStrikes'), limit(40)))
  ]);
  const reports = rq.docs.map((d) => ({ id: d.id, ...d.data() }));
  const strikes = sq.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => (s.n | 0) > 0);
  strikes.sort((a, b) => (b.n | 0) - (a.n | 0));
  return { reports, strikes };
}

function paint(host, data, toast, reload) {
  const list = host.querySelector('#mod-list');
  const strikes = host.querySelector('#mod-strikes');
  const status = host.querySelector('#mod-status');
  status.textContent = data.reports.length ? data.reports.length + ' open' : 'No open reports.';
  strikes.innerHTML = data.strikes.length ? data.strikes.map((s) => `<div class="mod-s"><b>${esc(s.id.slice(0, 8))}</b> · ${s.n | 0} strike${s.n === 1 ? '' : 's'} · ${esc(s.lastKind || 'chat')}${s.serious ? ' · serious' : ''}</div>`).join('') : '<p class="muted small">No strikes yet.</p>';
  if (!data.reports.length) { list.innerHTML = '<p class="muted small">The queue is clear. Kemy Helper is still watching chat.</p>'; return; }
  list.innerHTML = data.reports.map((r, i) => `<article class="mod-row" data-i="${i}">
    <b>${esc(r.targetType || 'report')}</b> <span class="muted small">${esc(ago(r.createdAt))}</span>
    <p>${esc(r.reason || '')}</p>
    ${r.excerpt ? `<p class="mod-ex">“${esc(r.excerpt)}”</p>` : ''}
    <p class="muted small">Player ${esc((r.targetUid || r.targetId || '').slice(0, 12))}</p>
    <div class="mod-actions">
      <button type="button" data-a="dismiss">Dismiss</button>
      <button type="button" data-a="warn">Warn</button>
      <button type="button" data-a="mute1">Mute 1h</button>
      <button type="button" data-a="mute24">Mute 24h</button>
      <button type="button" data-a="ban">Ban</button>
      <button type="button" data-a="unban">Unban</button>
    </div>
  </article>`).join('');
  list.querySelectorAll('button').forEach((b) => {
    b.onclick = async () => {
      const row = data.reports[Number(b.closest('article').dataset.i)];
      b.disabled = true;
      try {
        await act(row, b.dataset.a);
        toast && toast('Saved.');
        const next = await load();
        if (host.isConnected) paint(host, next, toast, reload);
      } catch (e) {
        b.disabled = false;
        toast && toast('Could not save that.');
      }
    };
  });
}

async function closeReport(row, action) {
  const me = auth.currentUser;
  await updateDoc(doc(db, 'reports', row.id), {
    status: 'resolved',
    handledBy: me ? me.uid : '',
    handledAt: serverTimestamp(),
    action: String(action || '').slice(0, 40)
  });
}

async function banFor(row, ms, permanent, reason) {
  const uid = row.targetUid || (row.targetType === 'user' ? row.targetId : '');
  if (!uid || uid === (auth.currentUser && auth.currentUser.uid)) return;
  const me = auth.currentUser;
  const until = permanent ? Timestamp.fromMillis(Date.UTC(9999, 0, 1)) : Timestamp.fromMillis(Date.now() + ms);
  await setDoc(doc(db, 'bans', uid), {
    until,
    reason: reason.slice(0, 300),
    permanent: !!permanent,
    hide: false,
    by: me.uid,
    at: serverTimestamp(),
    name: '',
    uname: ''
  });
}

async function warnUser(row) {
  const uid = row.targetUid || (row.targetType === 'user' ? row.targetId : '');
  if (!uid) return;
  const ref = doc(db, 'helperStrikes', uid);
  const cur = await getDoc(ref);
  if (cur.exists()) await updateDoc(ref, { warn: true, warnAt: serverTimestamp() });
  else await setDoc(ref, { n: 0, warn: true, warnAt: serverTimestamp(), ban: false });
}

async function act(row, action) {
  if (action === 'dismiss') return closeReport(row, 'dismiss');
  if (action === 'warn') { await warnUser(row); return closeReport(row, 'warn'); }
  if (action === 'mute1') { await banFor(row, HOUR, false, 'Kemy Helper: chat paused for 1 hour.'); return closeReport(row, 'mute1'); }
  if (action === 'mute24') { await banFor(row, DAY, false, 'Kemy Helper: chat paused for 24 hours.'); return closeReport(row, 'mute24'); }
  if (action === 'ban') { await banFor(row, 0, true, 'Banned by Keem.'); return closeReport(row, 'ban'); }
  if (action === 'unban') {
    const uid = row.targetUid || (row.targetType === 'user' ? row.targetId : '');
    if (uid) await deleteDoc(doc(db, 'bans', uid));
    return closeReport(row, 'unban');
  }
}

export async function mountModAdmin(host, { toast } = {}) {
  if (!host) return;
  if (!document.getElementById('mod-admin-css')) {
    const st = document.createElement('style');
    st.id = 'mod-admin-css';
    st.textContent = `.mod-admin{border:2px solid #6d28d9;background:linear-gradient(160deg,rgba(109,40,217,.28),rgba(255,225,74,.08));margin-bottom:12px}
.mod-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.mod-actions button{min-height:44px;border-radius:999px;border:2px solid #6d28d9;background:#ffe14a;color:#3b2504;font-weight:800;padding:0 12px}
.mod-row{border-top:1px solid rgba(255,255,255,.12);padding:10px 0}
.mod-row p{margin:4px 0}
.mod-ex{background:rgba(255,225,74,.15);border-radius:10px;padding:6px 8px}
.mod-s{padding:4px 0;font-weight:700}`;
    document.head.appendChild(st);
  }
  host.innerHTML = `<div class="card pad adm-tool mod-admin" id="mod-panel"><b style="font-size:1.05rem">🛡️ Moderation</b><p class="muted small" style="margin:3px 0 0">Reports from players and from Kemy Helper. Strikes stay here. You choose mute and ban. The helper never bans.</p><p class="small" id="mod-status">Looking…</p><h3 style="font-size:1rem;margin:8px 0 4px">Strikes</h3><div id="mod-strikes"></div><h3 style="font-size:1rem;margin:10px 0 4px">Reports</h3><div id="mod-list"></div></div>`;
  try {
    const data = await load();
    if (host.isConnected) paint(host, data, toast);
  } catch {
    const status = host.querySelector('#mod-status');
    if (status) status.textContent = 'Could not load the moderation queue.';
  }
}
