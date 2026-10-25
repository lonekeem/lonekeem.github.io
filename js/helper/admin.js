// Admin list of Kemy Helper notes. Grouped, counted, and marked fixed. No player names.
// Written by Lone Keem.
import { auth, db } from '../firebase-init.js';
import { collection, getDocs, query, where, limit, doc, writeBatch, serverTimestamp, setDoc } from '../fsq.js';
import { groupKey, scrub } from './core.js';

const LABEL = {
  error: 'Script error', reject: 'Background error', load: 'Failed load', fps: 'Low fps',
  stuck: 'Stuck player', bounds: 'Out of bounds', under: 'Under the map', wall: 'Inside a wall',
  float: 'Floating', nan: 'Broken position', desync: 'Game out of sync', turn: 'Stuck turn', note: 'Player note'
};

function ago(t) {
  const ms = t && t.toMillis ? t.toMillis() : 0;
  if (!ms) return '';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' d ago';
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function mountHelperAdmin(host, { stale, token, toast } = {}) {
  if (!host) return;
  if (!document.getElementById('kh-admin-css')) {
    const st = document.createElement('style');
    st.id = 'kh-admin-css';
    st.textContent = `.kh-admin{border:2px solid #ffd34d;background:linear-gradient(160deg,rgba(109,40,217,.35),rgba(255,211,77,.08))}
.kh-counts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.kh-counts span{background:rgba(255,255,255,.08);border-radius:999px;padding:4px 10px;font-weight:700;font-size:.85rem}
.kh-g{border-top:1px solid rgba(255,255,255,.12);padding:10px 0}
.kh-g b{color:#ffd34d}
.kh-g button{min-height:44px}`;
    document.head.appendChild(st);
  }
  host.innerHTML = `<div class="card pad adm-tool kh-admin" id="kh-box"><b style="font-size:1.05rem">🛠️ Kemy Helper Reports</b><p class="muted small" style="margin:3px 0 0">Notes from the helper and from players. Grouped by issue. No names or contact info.</p><p class="small" id="kh-status">Looking…</p><div id="kh-list"></div></div>`;
  try {
    const u = auth.currentUser;
    if (u) await setDoc(doc(db, 'config', 'helperDigest'), { uid: u.uid, updatedAt: serverTimestamp() }, { merge: true });
  } catch { /* the daily digest also looks up the admin account */ }
  let rows = [];
  try {
    const qs = await getDocs(query(collection(db, 'helperReports'), where('status', '==', 'open'), limit(80)));
    rows = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    if (!stale || !stale(token)) host.querySelector('#kh-status').textContent = 'Could not load helper notes.';
    return;
  }
  if (stale && stale(token)) return;
  paint(host, rows, toast);
}

function paint(host, rows, toast) {
  const status = host.querySelector('#kh-status');
  const list = host.querySelector('#kh-list');
  if (!rows.length) { status.textContent = 'No helper notes right now. Kemy Helper is keeping watch.'; list.innerHTML = ''; return; }
  const counts = {};
  const groups = new Map();
  for (const r of rows) {
    counts[r.type] = (counts[r.type] || 0) + 1;
    const k = groupKey(r);
    const g = groups.get(k) || { key: k, type: r.type, text: scrub(r.text), n: 0, ids: [], place: r.place || '', game: r.game || '', device: r.device || '', at: r.at, auto: 0 };
    g.n++;
    g.ids.push(r.id);
    if (r.autoFixed) g.auto++;
    const ms = r.at && r.at.toMillis ? r.at.toMillis() : 0;
    const prev = g.at && g.at.toMillis ? g.at.toMillis() : 0;
    if (ms >= prev) { g.at = r.at; g.place = r.place || g.place; g.game = r.game || g.game; g.device = r.device || g.device; }
    groups.set(k, g);
  }
  const bits = [`<span>${rows.length} open</span>`];
  Object.keys(counts).sort().forEach((t) => bits.push(`<span>${esc(LABEL[t] || t)} ${counts[t]}</span>`));
  status.innerHTML = `<span class="kh-counts">${bits.join('')}</span>`;
  const ordered = [...groups.values()].sort((a, b) => b.n - a.n);
  list.innerHTML = ordered.map((g, i) => `<div class="kh-g"><div class="row" style="gap:8px;align-items:center"><div style="flex:1"><b>${esc(LABEL[g.type] || g.type)}</b> × ${g.n}${g.auto ? ` · ${g.auto} auto-fixed` : ''}<div class="muted small">${esc(g.text || '')}</div><div class="muted small">${esc([g.game, g.place, g.device, ago(g.at)].filter(Boolean).join(' · '))}</div></div><button class="btn btn-sm" type="button" data-i="${i}">Mark fixed</button></div></div>`).join('');
  list.querySelectorAll('button').forEach((b) => {
    b.onclick = async () => {
      const g = ordered[+b.dataset.i];
      if (!g) return;
      b.disabled = true;
      try {
        for (let i = 0; i < g.ids.length; i += 10) {
          const batch = writeBatch(db);
          g.ids.slice(i, i + 10).forEach((id) => batch.update(doc(db, 'helperReports', id), { status: 'fixed', fixedAt: serverTimestamp() }));
          await batch.commit();
        }
        if (toast) toast('Marked fixed');
        const left = rows.filter((r) => !g.ids.includes(r.id));
        paint(host, left, toast);
      } catch {
        b.disabled = false;
        if (toast) toast('Could not mark that fixed');
      }
    };
  });
}
