// Lone Keem Studios - Go Live (free, no media server).
// WebRTC peer-to-peer: the broadcaster opens one connection per viewer (capped at LIVE_CAP) using
// free public STUN; Firestore only carries signaling (one offer / one answer per viewer, full SDP
// with candidates, no trickle docs) plus live chat and stars. No TURN relay (no free, reliable,
// no-signup option exists), so a few strict networks can't connect; viewers get a clear message.
// Nothing is recorded or stored: when a live ends only the summary numbers stay on lives/{id}.
import { ICONS } from './icons.js';
import { fmtCount } from './views.js';
import { createFx } from './fx/pipeline.js';
import { mountPicker } from './fx/picker.js';
import { FX_DEFAULT } from './fx/looks.js';
import { emojiPicker, insertAtCursor } from './richcomments.js';
// Emoji in live chat (all live layouts share the .lv-form markup).
if (typeof document !== 'undefined' && !window.__lvEmoji) { window.__lvEmoji = 1; document.addEventListener('click', (e) => { const b = e.target.closest('.lv-emoji'); if (!b) return; const inp = b.parentNode.querySelector('input'); emojiPicker((em) => { insertAtCursor(inp, em); }); }); }

export const LIVE_CAP = 12;
export const LIVE_STALE_MS = 60000;      // no heartbeat for 60 s = ended (no Cloud Functions on Spark)
const HEARTBEAT_MS = 20000;
const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const STAR = '<svg class="lstar-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>';
const IC = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5A8 8 0 0 1 18.6 7M20 14.5A8 8 0 0 1 5.4 17"/><path d="M18.8 3.6V7.4H15M5.2 20.4v-3.8H9"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3.4" width="6" height="11" rx="3"/><path d="M5.6 11.4a6.4 6.4 0 0 0 12.8 0M12 17.8v2.8"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 9.6V6.4a3 3 0 0 0-5.6-1.5M9 9v2.4a3 3 0 0 0 4.6 2.5M5.6 11.4a6.4 6.4 0 0 0 10.2 5.1M18.4 11.4c0 .9-.2 1.8-.5 2.6M12 17.8v2.8M3.6 3.6l16.8 16.8"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8.4" r="3.4"/><path d="M2.8 19.6c.5-3.2 3-5.2 6.2-5.2s5.7 2 6.2 5.2M15.6 5.4a3.2 3.2 0 0 1 0 6.2M17.6 14.6c2 .6 3.3 2.3 3.6 5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
};
export const liveBadge = (small = false) => `<span class="live-badge ${small ? 'sm' : ''}"><span class="lb-star" aria-hidden="true">${STAR}</span>LIVE</span>`;
// YouTube "big lives" stream from YouTube, so the host may not keep this app open: they count as
// live for up to 3 h after the host's app last checked in, and never longer than 12 h.
const YT_STALE_MS = 3 * 3600e3, YT_MAX_MS = 12 * 3600e3;
export const isFresh = (l) => !!l && l.status === 'live' && (l.type === 'youtube'
  ? (l.heartbeatAt?.toMillis?.() || 0) > Date.now() - YT_STALE_MS && (l.startedAt?.toMillis?.() || 0) > Date.now() - YT_MAX_MS
  : (l.heartbeatAt?.toMillis?.() || 0) > Date.now() - LIVE_STALE_MS);
// youtube.com/live/ID, watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID, or a bare 11-character ID.
export function parseYouTubeId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v');
    if (!id) { const m = u.pathname.match(/^\/(?:live|embed|shorts|v)\/([^/?#]+)/); if (m) id = m[1]; }
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

export function createLive(ctx) {
  const { S, db, main, esc, $, avatar, badge, toast, friendlyError, requireAuth, isAdmin, STUDIO_UID, getProfile, followUser, stale, openModal, closeModal } = ctx;
  const { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limitToLast, limit, onSnapshot, writeBatch, serverTimestamp, getCountFromServer } = ctx.fs;
  const liveRef = (id) => doc(db, 'lives', id);
  const sub = (id, c, d) => doc(db, 'lives', id, c, d);
  const me = () => S.user?.uid;

  // ------------------------------------------------------------ discovery (feed / profile)
  async function liveNow() {
    try {
      const snap = await getDocs(query(collection(db, 'lives'), where('status', '==', 'live'), limit(40)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => isFresh(l) && !S.blocked.has(l.hostId))
        .sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
    } catch { return []; }
  }
  // Lives the current person should see in their feed: people they follow, the studio, themselves.
  const relevant = (lives) => lives.filter((l) => l.hostId === STUDIO_UID || l.hostId === me() || S.following.has(l.hostId) || (isAdmin() && l.hostId === STUDIO_UID));
  async function liveFor(uid) {
    try {
      const snap = await getDocs(query(collection(db, 'lives'), where('hostId', '==', uid), where('status', '==', 'live'), limit(5)));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isFresh)[0] || null;
    } catch { return null; }
  }
  function liveCard(l) {
    return `<a class="live-card" href="#/live/${esc(l.id)}" aria-label="${esc(l.hostName)} is live${l.title ? ': ' + esc(l.title) : ''}. Watch now">
      <span class="live-ring">${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, '', false)}</span>
      <span class="lc-meta"><b>${esc(l.hostName)}${badge(l.hostId)}</b><span class="small">${l.title ? esc(l.title) : 'is live now'}</span></span>
      <span class="lc-side">${liveBadge(true)}<span class="small lc-n">${IC.people}${fmtCount(l.viewerCount || 0)}</span></span></a>`;
  }
  // "Live now" strip at the top of the feed + LIVE rings in the stories row.
  async function renderFeed(slot, storiesSlot, storiesDone, token) {
    if (!slot) return;
    const lives = relevant(await liveNow());
    await storiesDone;
    if (stale(token)) return;
    slot.innerHTML = lives.length ? `<section class="live-now" aria-label="Live now"><h2 class="ln-title">${liveBadge(true)} Live now</h2>${lives.map(liveCard).join('')}</section>` : '';
    decorateRow(storiesSlot, lives);
  }
  function decorateRow(slot, lives) {
    if (!slot || !lives.length) return;
    let row = slot.querySelector('.srow');
    if (!row) { slot.innerHTML = '<div class="srow" role="list" aria-label="Stories"></div>'; row = slot.querySelector('.srow'); }
    lives.forEach((l) => {
      let b = row.querySelector(`.sbub[data-uid="${CSS.escape(l.hostId)}"]`);
      if (!b) {
        b = document.createElement('div'); b.className = 'sbub'; b.dataset.uid = l.hostId;
        b.innerHTML = `<button class="sring none">${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, 'story', false)}</button><span class="sname">${esc(l.hostName)}</span>`;
        const own = row.querySelector(`.sbub[data-uid="${CSS.escape(me() || '-')}"]`);
        if (own && l.hostId !== me()) own.after(b); else row.prepend(b);
      }
      b.classList.add('is-live');
      const ring = b.querySelector('.sring');
      ring.dataset.live = l.id; ring.setAttribute('aria-label', `${l.hostName} is live. Watch now`);
      if (!b.querySelector('.live-badge')) ring.insertAdjacentHTML('beforeend', liveBadge(true));
    });
    row.querySelector('.srow-empty')?.remove();
    if (!slot.__liveClick) {
      slot.__liveClick = true;
      slot.addEventListener('click', (e) => {
        const r = e.target.closest('[data-live]'); if (!r || e.target.closest('[data-add]')) return;
        e.stopPropagation(); e.preventDefault(); location.hash = '#/live/' + r.dataset.live;
      }, true);
    }
  }
  async function renderProfile(pav, actionsEl, uid, mine, token) {
    const l = await liveFor(uid);
    if (stale(token) || !pav) return;
    if (l) {
      pav.classList.add('is-live');
      pav.insertAdjacentHTML('beforeend', liveBadge(true));
      pav.style.cursor = 'pointer';
      pav.onclick = () => (location.hash = '#/live/' + l.id);
      actionsEl?.insertAdjacentHTML('afterbegin', `<a class="btn btn-sm live-btn" href="#/live/${esc(l.id)}">${ICONS.live}${mine ? 'Back to your live' : 'Watch live'}</a>`);
    } else if (mine) {
      actionsEl?.insertAdjacentHTML('afterbegin', `<a class="btn btn-sm live-btn" href="#/live/new">${ICONS.live}Go Live</a>`);
    }
  }

  // ------------------------------------------------------------ shared overlay pieces
  // Float stars up the side, or from a tap point (x, y in client coordinates).
  function floatStars(root, n = 1, x = null, y = null) {
    if (x != null) {
      const r = root.getBoundingClientRect();
      const s = document.createElement('span');
      s.className = 'lstar at'; s.innerHTML = STAR;
      s.style.setProperty('--x', (x - r.left) + 'px'); s.style.setProperty('--y', (y - r.top) + 'px');
      s.style.setProperty('--dx', (Math.random() * 60 - 30).toFixed(0) + 'px');
      s.style.setProperty('--rot', (Math.random() * 50 - 25).toFixed(0) + 'deg');
      s.style.setProperty('--sz', (30 + Math.random() * 12).toFixed(0) + 'px');
      root.appendChild(s); setTimeout(() => s.remove(), 2300);
      return;
    }
    const box = root.querySelector('.lv-stars'); if (!box) return;
    n = Math.min(n, 8);
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const s = document.createElement('span');
        s.className = 'lstar'; s.innerHTML = STAR;
        s.style.setProperty('--dx', (Math.random() * 70 - 35).toFixed(0) + 'px');
        s.style.setProperty('--rot', (Math.random() * 60 - 30).toFixed(0) + 'deg');
        s.style.setProperty('--sz', (22 + Math.random() * 14).toFixed(0) + 'px');
        box.appendChild(s); setTimeout(() => s.remove(), 2600);
      }, i * 140);
    }
  }
  // Stars you send: shown instantly, written in batches (one write per ~1.1 s, up to 20 stars
  // each) so even fast tapping stays well inside the free Firestore quota.
  function starSender(root, id) {
    let pending = 0, t = 0, sent = 0;
    const flush = async () => {
      t = 0; if (pending <= 0) return;
      const n = Math.min(20, pending); pending -= n;
      try { await sendStars(id, n); sent += n; } catch { /* live ended or too fast: dropped */ }
      if (pending > 0 && !t) t = setTimeout(flush, 1100);
    };
    return {
      add(x = null, y = null) { floatStars(root, 1, x, y); pending++; if (!t) t = setTimeout(flush, 1100); },
      flushNow() { clearTimeout(t); t = 0; if (pending > 0) sendStars(id, Math.min(20, pending)).catch(() => {}); pending = 0; },
      get pending() { return pending; }, get sent() { return sent; }
    };
  }
  // Running star total for viewers: the live doc's count, or what we've seen since joining.
  function starTotal(root, base) {
    let seen = 0, doc = base || 0;
    const paint = () => { const el = root.querySelector('#lv-starsn'); if (el) el.textContent = fmtCount(Math.max(doc, (base || 0) + seen)); };
    paint();
    return { add(n) { seen += n; paint(); }, doc(n) { doc = Math.max(doc, n || 0); paint(); }, get value() { return Math.max(doc, (base || 0) + seen); } };
  }
  const tapIgnore = (e) => !!e.target.closest('button, a, input, textarea, form, label, .lv-top, .lv-row, .lv-ytnote, .lv-chat, .lv-hostnote, .lv-wait-in .btn');
  const FLAG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>';
  function chatLine(c, cid) {
    const rep = cid && S.user && c.authorId !== me() ? `<button class="lv-rep" data-rep="${esc(cid)}" aria-label="Report message from ${esc(c.name)}">${FLAG}</button>` : '';
    return `<div class="lv-msg" data-cid="${esc(cid || '')}">${avatar({ uid: c.authorId, displayName: c.name, username: c.username, color: c.color }, 'xs', false)}<p><b>${esc(c.name)}</b> <span class="lv-t">${esc(c.text)}</span></p>${rep}</div>`;
  }
  function watchChat(id, root, onStars) {
    let first = true;
    const list = root.querySelector('.lv-chat');
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-rep]'); if (!b) return; const t = b.closest('.lv-msg').querySelector('.lv-t')?.textContent || ''; ctx.reportDialog('live chat', `${id}/${b.dataset.rep}`, id, t); });
    return onSnapshot(query(collection(db, 'lives', id, 'chat'), orderBy('createdAt'), limitToLast(30)), (qs) => {
      qs.docChanges().forEach((ch) => {
        if (ch.type !== 'added') return;
        const c = ch.doc.data();
        if (S.blocked.has(c.authorId)) return;
        if (c.type === 'msg') {
          list.insertAdjacentHTML('beforeend', chatLine(c, ch.doc.id));
          while (list.children.length > 30) list.firstElementChild.remove();
          list.scrollTop = list.scrollHeight;
        } else if (c.type === 'star' && !first) {
          if (c.authorId !== me()) floatStars(root, c.count || 1);
          onStars && onStars(c.count || 1);
        } else if (c.type === 'star' && first) onStars && onStars(c.count || 1, true);
      });
      first = false;
    }, () => {});
  }
  async function sendChat(id, text) {
    const p = S.profile;
    const b = writeBatch(db);
    b.set(doc(collection(db, 'lives', id, 'chat')), { authorId: me(), name: p.displayName, username: p.username, color: p.color, type: 'msg', text, count: 0, createdAt: serverTimestamp() });
    b.update(doc(db, 'users', me()), { lastMessageAt: serverTimestamp() });
    await b.commit();
  }
  async function sendStars(id, count) {
    const p = S.profile;
    const b = writeBatch(db);
    b.set(doc(collection(db, 'lives', id, 'chat')), { authorId: me(), name: p.displayName, username: p.username, color: p.color, type: 'star', text: '', count, createdAt: serverTimestamp() });
    b.update(doc(db, 'users', me()), { lastMessageAt: serverTimestamp() });
    await b.commit();
  }
  function wireChatForm(root, id) {
    const form = root.querySelector('.lv-form'); if (!form) return;
    let last = 0;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const input = form.querySelector('input'); const text = input.value.trim(); if (!text) return;
      if (Date.now() - last < 1100) { toast('Slow down a little'); return; }
      last = Date.now(); input.value = '';
      try { await sendChat(id, text.slice(0, 150)); }
      catch (err) { input.value = text; toast(err.code === 'permission-denied' ? 'Slow down a little, or this live has ended.' : friendlyError(err)); }
    };
  }
  async function waitIce(pc, ms = 3500) {
    if (pc.iceGatheringState === 'complete') return;
    await new Promise((r) => {
      const t = setTimeout(r, ms);
      pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } });
    });
  }
  async function cleanupSubs(id) {
    for (const c of ['conns', 'answers', 'viewers', 'chat']) {
      for (let i = 0; i < 40; i++) {
        try {
          const s = await getDocs(query(collection(db, 'lives', id, c), limit(300)));
          if (s.empty) break;
          await Promise.all(s.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
          if (s.size < 300) break;
        } catch { break; }
      }
    }
  }

  // ------------------------------------------------------------ broadcaster
  let hostSession = null;
  async function pageGoLive(token) {
    if (!requireAuth()) return;
    if (hostSession) { location.replace('#/live/' + hostSession.id); return; }
    document.body.classList.add('live-mode');
    main.innerHTML = `<div class="lv lv-setup" id="lv">
      <video class="lv-video mirror" id="lv-video" autoplay playsinline muted></video>
      <div class="lv-shade"></div>
      <button class="lv-x" id="lv-x" aria-label="Close">${IC.close}</button>
      <div class="lv-setup-panel">
        <h1>${ICONS.live} Go Live</h1>
        <div class="lv-modes" role="radiogroup" aria-label="Type of live">
          <button type="button" class="lv-mode on" role="radio" aria-checked="true" data-mode="app"><b>Live in the app</b><span>Free · up to ${LIVE_CAP} viewers</span></button>
          <button type="button" class="lv-mode" role="radio" aria-checked="false" data-mode="yt"><b>Big live with YouTube</b><span>Unlimited viewers · needs your own YouTube channel</span></button>
        </div>
        <label class="sr-only" for="lv-title">Title</label>
        <input id="lv-title" maxlength="80" placeholder="Add a title (optional)" autocomplete="off">
        ${isAdmin() ? `<label class="check small"><input type="checkbox" id="lv-studio"> Go live as Lone Keem Studios</label>` : ''}
        <div id="lv-app-pane">
          <p class="small">Your camera, straight from this app. Your followers see you in their feed right away. Nothing is recorded.</p>
          <div class="lv-fx" id="lv-fx0" hidden></div>
          <p class="form-error" id="lv-err" role="alert"></p>
          <div class="lv-setup-btns"><button class="btn btn-ghost" id="lv-flip0">${IC.flip}Flip</button><button class="btn btn-ghost" id="lv-fxbtn0" aria-expanded="false">✨ Filters</button><button class="btn lv-start" id="lv-start" disabled>${ICONS.live}Go Live</button></div>
        </div>
        <div id="lv-yt-pane" hidden>
          <p class="small">Stream on YouTube, and it plays right here in the app with your in-app chat and stars. Viewers don’t need YouTube.</p>
          <label class="sr-only" for="lv-yt">YouTube Live link</label>
          <input id="lv-yt" inputmode="url" autocapitalize="none" spellcheck="false" placeholder="Paste your YouTube Live link" autocomplete="off">
          <label class="check small"><input type="checkbox" id="lv-ytchat" checked> In-app chat and stars</label>
          <p class="lv-fxnote">Filters for a big live come from YouTube or your streaming software (like OBS), because the video goes straight from there, not through this app.</p>
          <details class="lv-help"><summary>How do I start a YouTube Live?</summary>
            <ol>
              <li>Open the <b>YouTube</b> app, tap <b>Create (+)</b>, then <b>Go live</b>. The first time, YouTube asks you to verify your channel and can take up to 24 hours to turn live streaming on.</li>
              <li>Going live from a <b>phone</b> needs at least 50 subscribers. From a <b>computer</b> (webcam at youtube.com, or streaming software like OBS) there’s no subscriber minimum.</li>
              <li>Set it to <b>Public</b> or <b>Unlisted</b>, and put <b>https://lonekeem.github.io/</b> in your stream description.</li>
              <li>Tap <b>Share</b>, copy the link, and paste it above.</li>
            </ol>
            <p>Only stream your own channel, and follow the <a href="guidelines.html" target="_blank" rel="noopener">Community Guidelines</a>.</p>
          </details>
          <p class="form-error" id="lv-yterr" role="alert"></p>
          <div class="lv-setup-btns"><button class="btn lv-start" id="lv-yt-start">${ICONS.live}Start big live</button></div>
        </div>
      </div></div>`;
    const v = $('#lv-video');
    let facing = 'user', stream = null, mode = 'app', camTry = 0, fx = null, fxState = { ...FX_DEFAULT }, picker0 = null;
    const preview = () => { v.srcObject = fx && !fx.isFast() ? fx.stream() : stream; v.play().catch(() => {}); };
    const newFx = () => { fx && fx.stop(); fx = createFx(stream, { onNotice: toast, onState: (st) => { fxState = st; picker0 && picker0.set(st); preview(); } }); fx.set(fxState); window.__lksFx = fx; preview(); };
    const getCam = async () => {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 24, max: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      return s;
    };
    const stop = () => { if (fx) { fx.stop(); fx = null; } if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; v.srcObject = null; };
    S.unsubs.push(() => { if (!hostSession) { stop(); document.body.classList.remove('live-mode'); } });
    $('#lv-x').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/feed');
    { const rb = document.getElementById('lv-report'); if (rb) rb.onclick = () => ctx.reportDialog('live', l.id, l.id, `${l.hostName || ''}: ${l.title || 'live'}`); }
    async function startCam() {
      const my = ++camTry;
      $('#lv-err').textContent = ''; $('#lv-start').disabled = true;
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) throw Object.assign(new Error('unsupported'), { name: 'Unsupported' });
        const s = await getCam();
        if (stale(token) || my !== camTry || mode !== 'app') { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s; newFx();
        $('#lv-start').disabled = false;
      } catch (e) {
        if (my !== camTry) return;
        $('#lv-err').textContent = e.name === 'NotAllowedError' ? 'Camera or microphone access is blocked. Allow it in your browser settings, then try again.'
          : e.name === 'Unsupported' ? 'This browser can’t go live in the app. Try the latest Chrome, Safari or Firefox, or use a big live with YouTube.'
          : 'Couldn’t start your camera. Make sure no other app is using it.';
      }
    }
    const setMode = (m) => {
      mode = m;
      $('#lv').querySelectorAll('.lv-mode').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
      $('#lv-app-pane').hidden = m !== 'app'; $('#lv-yt-pane').hidden = m !== 'yt';
      $('#lv').classList.toggle('yt-mode', m === 'yt');
      if (m === 'yt') { camTry++; stop(); setTimeout(() => $('#lv-yt')?.focus(), 30); } else startCam();
    };
    $('#lv').querySelectorAll('.lv-mode').forEach((b) => (b.onclick = () => b.dataset.mode !== mode && setMode(b.dataset.mode)));
    $('#lv-flip0').onclick = async () => {
      facing = facing === 'user' ? 'environment' : 'user';
      try { const s = await getCam(); stop(); stream = s; newFx(); v.classList.toggle('mirror', facing === 'user'); }
      catch { facing = facing === 'user' ? 'environment' : 'user'; toast('Couldn’t switch cameras'); }
    };
    $('#lv-fxbtn0').onclick = () => {
      const box = $('#lv-fx0'); box.hidden = !box.hidden; $('#lv-fxbtn0').setAttribute('aria-expanded', !box.hidden);
      if (!box.hidden && !picker0) picker0 = mountPicker(box, { state: fxState, tab: 'looks', onChange: (st) => { fxState = st; if (fx) { fx.set(st); preview(); } } });
    };
    $('#lv-start').onclick = async () => {
      const btn = $('#lv-start'); btn.disabled = true; $('#lv-err').textContent = '';
      const asStudio = !!$('#lv-studio')?.checked;
      try {
        const id = await createLive($('#lv-title').value.trim().slice(0, 80), asStudio);
        if (stale(token)) return;
        hostSession = { id, raw: stream, fx, fxState, stream: new MediaStream([fx ? fx.videoTrack() : stream.getVideoTracks()[0], ...stream.getAudioTracks()]), facing, asStudio };
        fx = null; // now owned by the broadcast
        history.replaceState(null, '', '#/live/' + id);
        startBroadcast(token);
      } catch (e) {
        btn.disabled = false;
        $('#lv-err').textContent = e.code === 'permission-denied' ? 'Please wait a few seconds and try again (you just posted or went live).' : friendlyError(e);
      }
    };
    $('#lv-yt').addEventListener('input', () => { $('#lv-yterr').textContent = ''; });
    $('#lv-yt-start').onclick = async () => {
      const err = $('#lv-yterr'); err.textContent = '';
      const yt = parseYouTubeId($('#lv-yt').value);
      if (!yt) { err.textContent = 'That doesn’t look like a YouTube link. Paste the link from Share on your YouTube Live (like youtube.com/live/…, youtu.be/… or watch?v=…).'; return; }
      const btn = $('#lv-yt-start'); btn.disabled = true;
      try {
        const id = await createLive($('#lv-title').value.trim().slice(0, 80), !!$('#lv-studio')?.checked, { youtubeId: yt, chatOn: !!$('#lv-ytchat').checked });
        if (stale(token)) return;
        location.replace('#/live/' + id);
      } catch (e) {
        btn.disabled = false;
        err.textContent = e.code === 'permission-denied' ? 'Please wait a few seconds and try again (you just posted or went live).' : friendlyError(e);
      }
    };
    startCam();
  }
  async function createLive(title, asStudio, yt = null) {
    const hostId = asStudio ? STUDIO_UID : me();
    const host = asStudio ? await getProfile(STUDIO_UID) : S.profile;
    // End any of this host's old lives that were left hanging (tab closed, crash).
    try {
      const old = await getDocs(query(collection(db, 'lives'), where('hostId', '==', hostId), where('status', '==', 'live'), limit(5)));
      await Promise.all(old.docs.map((d) => updateDoc(d.ref, { status: 'ended', endedAt: serverTimestamp(), endedBy: 'host', heartbeatAt: serverTimestamp(),
        viewerCount: 0, peakViewers: d.data().peakViewers || 0, totalViewers: d.data().totalViewers || 0, starCount: d.data().starCount || 0 }).catch(() => {})));
    } catch {}
    const ref = doc(collection(db, 'lives'));
    const b = writeBatch(db);
    b.set(ref, { hostId, hostName: host.displayName, hostUsername: host.username, hostColor: host.color, title, status: 'live',
      startedAt: serverTimestamp(), heartbeatAt: serverTimestamp(), viewerCount: 0, peakViewers: 0, totalViewers: 0, starCount: 0,
      ...(yt ? { type: 'youtube', youtubeId: yt.youtubeId, chatOn: yt.chatOn } : {}) });
    b.update(doc(db, 'users', hostId), { lastPostAt: serverTimestamp() });
    await b.commit();
    return ref.id;
  }

  function startBroadcast() {
    const H = hostSession; const id = H.id;
    const startedAt = Date.now();
    const peers = new Map();              // uid -> { pc, connected, unsub, timer }
    const everConnected = new Set();
    let peak = 0, stars = 0, ended = false, micOn = true, lastWrite = 0, writeTimer = 0;
    const host = H.asStudio ? { displayName: 'Lone Keem Studios', username: 'lonekeemstudios', color: '#8a2be2', uid: STUDIO_UID } : { ...S.profile, uid: me() };
    main.innerHTML = `<div class="lv lv-host" id="lv">
      <video class="lv-video ${H.facing === 'user' ? 'mirror' : ''}" id="lv-video" autoplay playsinline muted></video>
      <div class="lv-shade"></div>
      <header class="lv-top">
        <div class="lv-who">${avatar(host, 'sm', false)}<div><b>${esc(host.displayName)}</b><span class="small" id="lv-timer">0:00</span></div></div>
        ${liveBadge()}
        <span class="lv-count" id="lv-count" aria-live="polite">${IC.people}<span>0</span></span>
        <button class="lv-end" id="lv-end">End</button>
      </header>
      <div class="lv-stars" aria-hidden="true"></div>
      <div class="lv-bottom">
        <div class="lv-fx" id="lv-fx" hidden></div>
        <div class="lv-chat" aria-live="polite" aria-label="Live chat"></div>
        <form class="lv-form"><label class="sr-only" for="lv-say">Say something</label><button type="button" class="lv-emoji" aria-label="Emoji">😊</button><input id="lv-say" maxlength="150" placeholder="Say something…" autocomplete="off"><button class="lv-send" aria-label="Send">${ICONS.send}</button></form>
        <div class="lv-tools">
          <button class="lv-tool" id="lv-flip" aria-label="Flip camera">${IC.flip}</button>
          <button class="lv-tool" id="lv-mic" aria-label="Mute microphone" aria-pressed="false">${IC.mic}</button>
          <button class="lv-tool" id="lv-fxbtn" aria-label="Filters" aria-expanded="false">✨</button>
          <span class="lv-starcount" id="lv-starcount" title="Stars">${STAR}<span>0</span></span>
        </div>
      </div></div>`;
    const root = $('#lv'), v = $('#lv-video');
    ctx.palLive && ctx.palLive(root, { liveId: id, hostId: host.uid, isHost: true });
    v.srcObject = H.stream; v.play().catch(() => {});
    const counted = () => [...peers.values()].filter((p) => p.connected).length;
    const paint = () => {
      const n = counted();
      root.querySelector('#lv-count span').textContent = n;
      root.querySelector('#lv-starcount span').textContent = fmtCount(stars);
    };
    const tick = setInterval(() => { const t = root.querySelector('#lv-timer'); if (t) t.textContent = mmss(Date.now() - startedAt); }, 1000);
    const write = async (final = false) => {
      clearTimeout(writeTimer); lastWrite = Date.now();
      const n = counted(); peak = Math.max(peak, n);
      const data = { heartbeatAt: serverTimestamp(), viewerCount: final ? 0 : n, peakViewers: peak, totalViewers: everConnected.size, starCount: stars };
      if (final) Object.assign(data, { status: 'ended', endedAt: serverTimestamp(), endedBy: 'host' });
      try { await updateDoc(liveRef(id), data); } catch (e) { if (!final) console.warn('live heartbeat', e); else throw e; }
    };
    const soon = () => { clearTimeout(writeTimer); writeTimer = setTimeout(() => write(), Math.max(0, 2500 - (Date.now() - lastWrite))); };
    const hb = setInterval(() => write(), HEARTBEAT_MS);
    const recount = () => {
      paint(); soon();
      // Share the upload: fewer viewers = better quality.
      const per = Math.round(Math.max(250000, Math.min(1200000, 4500000 / Math.max(1, counted()))));
      peers.forEach((p) => p.pc.getSenders().forEach((s) => {
        if (s.track?.kind !== 'video') return;
        const prm = s.getParameters(); if (!prm.encodings || !prm.encodings.length) prm.encodings = [{}];
        prm.encodings[0].maxBitrate = per; s.setParameters(prm).catch(() => {});
      }));
    };
    function closePeer(uid, removeDocs = true) {
      const p = peers.get(uid); if (!p) return;
      peers.delete(uid); clearTimeout(p.timer); p.unsub && p.unsub();
      try { p.pc.close(); } catch {}
      if (removeDocs) { deleteDoc(sub(id, 'conns', uid)).catch(() => {}); deleteDoc(sub(id, 'answers', uid)).catch(() => {}); }
      recount();
    }
    async function addPeer(uid) {
      if (ended) return;
      if (peers.has(uid)) closePeer(uid, false);
      if (peers.size >= LIVE_CAP) { setDoc(sub(id, 'conns', uid), { offer: '', full: true, createdAt: serverTimestamp() }).catch(() => {}); return; }
      const pc = new RTCPeerConnection({ iceServers: ICE });
      const p = { pc, connected: false, unsub: null, timer: 0 };
      peers.set(uid, p);
      H.stream.getTracks().forEach((t) => pc.addTrack(t, H.stream));
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === 'connected') { clearTimeout(p.timer); p.connected = true; everConnected.add(uid); recount(); }
        else if (s === 'failed' || s === 'closed') closePeer(uid);
        else if (s === 'disconnected') setTimeout(() => { if (pc.connectionState === 'disconnected') closePeer(uid); }, 8000);
      };
      p.timer = setTimeout(() => { if (!p.connected) closePeer(uid); }, 40000);   // never answered / couldn't connect
      try {
        await pc.setLocalDescription(await pc.createOffer());
        await waitIce(pc);
        if (!peers.has(uid) || peers.get(uid) !== p) return;
        await setDoc(sub(id, 'conns', uid), { offer: pc.localDescription.sdp, full: false, createdAt: serverTimestamp() });
        p.unsub = onSnapshot(sub(id, 'answers', uid), async (d) => {
          if (!d.exists() || p.answered) return;
          p.answered = true;
          try { await pc.setRemoteDescription({ type: 'answer', sdp: d.data().answer }); } catch { closePeer(uid); }
        }, () => {});
      } catch (e) { console.warn('offer failed', e); closePeer(uid); }
    }
    const unsubViewers = onSnapshot(collection(db, 'lives', id, 'viewers'), (qs) => {
      qs.docChanges().forEach((ch) => {
        const uid = ch.doc.id;
        if (S.blocked.has(uid)) return;
        if (ch.type === 'removed') closePeer(uid);
        else addPeer(uid);           // added, or re-joined (modified)
      });
    }, (e) => console.warn('viewers', e));
    // Star messages already in the chat (e.g. after a reload) are a floor for the total, never added twice.
    let initStars = 0;
    const unsubChat = watchChat(id, root, (n, initial) => { if (initial) { initStars += n; stars = Math.max(stars, initStars); paint(); } else { stars += n; paint(); soon(); } });
    const unsubLive = onSnapshot(liveRef(id), (d) => {
      const l = d.data();
      if (l && l.status === 'ended' && l.endedBy === 'admin' && !ended) {
        finish(true).then(() => openModal(`<h2>Your live was ended</h2><p>The studio ended this live because it didn’t follow the <a href="guidelines.html" target="_blank" rel="noopener">community guidelines</a>.</p><div class="btns"><button class="btn" data-close>OK</button></div>`));
      }
    }, () => {});
    wireChatForm(root, id);
    $('#lv-mic').onclick = () => {
      micOn = !micOn; H.stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      const b = $('#lv-mic'); b.innerHTML = micOn ? IC.mic : IC.micOff; b.classList.toggle('off', !micOn);
      b.setAttribute('aria-pressed', !micOn); b.setAttribute('aria-label', micOn ? 'Mute microphone' : 'Unmute microphone');
      toast(micOn ? 'Microphone on' : 'Microphone muted');
    };
    // Filters: the canvas track stays the same while looks/lenses change; only switching to or
    // from "no filter" swaps the sent track (replaceTrack keeps every connection up).
    const swapSent = async (nt) => {
      const cur = H.stream.getVideoTracks()[0];
      if (cur === nt) return;
      await Promise.all([...peers.values()].flatMap((p) => p.pc.getSenders().filter((s) => s.track?.kind === 'video').map((s) => s.replaceTrack(nt).catch(() => {}))));
      if (cur) H.stream.removeTrack(cur);
      H.stream.addTrack(nt); v.srcObject = H.stream; v.play().catch(() => {});
    };
    const applyFx = (st) => { if (!H.fx) return; H.fxState = H.fx.set(st); swapSent(H.fx.videoTrack()); };
    if (H.fx) { window.__lksFx = H.fx; window.__lksApplyFx = (st) => { picker && picker.set(st); applyFx({ ...H.fxState, ...st }); }; }
    let picker = null;
    $('#lv-fxbtn').onclick = () => {
      const box = $('#lv-fx'), btn = $('#lv-fxbtn'); box.hidden = !box.hidden;
      btn.classList.toggle('on', !box.hidden); btn.setAttribute('aria-expanded', !box.hidden);
      if (!H.fx) { box.hidden = true; toast('Filters aren’t available on this device'); return; }
      if (!box.hidden && !picker) picker = mountPicker(box, { state: H.fxState, tab: 'looks', onChange: applyFx });
    };
    $('#lv-flip').onclick = async () => {
      const next = H.facing === 'user' ? 'environment' : 'user';
      try {
        const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: next, width: { ideal: 720 }, height: { ideal: 1280 }, frameRate: { ideal: 24, max: 30 } } });
        const nt = ns.getVideoTracks()[0];
        const oldRaw = H.raw.getVideoTracks()[0];
        H.raw.removeTrack(oldRaw); H.raw.addTrack(nt);
        if (H.fx) H.fx.setSource(nt);
        await swapSent(H.fx ? H.fx.videoTrack() : nt);
        oldRaw.stop();
        H.facing = next; v.classList.toggle('mirror', next === 'user');
      } catch { toast('Couldn’t switch cameras'); }
    };
    $('#lv-end').onclick = () => { if (confirm('End your live?')) finish(); };
    const onHide = () => { if (!ended) updateDoc(liveRef(id), { status: 'ended', endedAt: serverTimestamp(), endedBy: 'host', heartbeatAt: serverTimestamp(), viewerCount: 0, peakViewers: Math.max(peak, counted()), totalViewers: everConnected.size, starCount: stars }).catch(() => {}); };
    window.addEventListener('pagehide', onHide);

    async function finish(byAdmin = false) {
      if (ended) return; ended = true;
      clearInterval(hb); clearInterval(tick); clearTimeout(writeTimer);
      window.removeEventListener('pagehide', onHide);
      peak = Math.max(peak, counted());
      unsubViewers(); unsubChat(); unsubLive();
      [...peers.keys()].forEach((u) => closePeer(u, false));
      H.raw.getTracks().forEach((t) => t.stop());
      if (H.fx) H.fx.stop();
      window.__lksApplyFx = null;
      hostSession = null;
      if (!byAdmin) { try { await write(true); } catch (e) { console.warn('end live', e); } }
      cleanupSubs(id);
      const summary = { dur: Date.now() - startedAt, total: everConnected.size, peak, stars };
      showSummary(summary);
    }
    function showSummary(s) {
      document.body.classList.remove('live-mode');
      main.innerHTML = `<section class="card pad center lv-summary" id="lv-summary">
        <div class="lv-sum-badge">${ICONS.live}</div>
        <h1 class="page-title" style="margin:6px 0 4px">Live ended</h1>
        <p class="muted" style="margin:0 0 16px">Thanks for going live! Here’s how it went.</p>
        <div class="lv-sum-grid">
          <div><b id="sum-dur">${mmss(s.dur)}</b><span>Duration</span></div>
          <div><b id="sum-total">${s.total}</b><span>Viewers</span></div>
          <div><b id="sum-peak">${s.peak}</b><span>Peak at once</span></div>
          <div><b id="sum-stars">${fmtCount(s.stars)}</b><span>Stars</span></div>
        </div>
        <p class="small muted">Nothing was recorded. Only these numbers are saved.</p>
        <div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap"><a class="btn" href="#/feed">Back to feed</a><a class="btn btn-ghost" href="#/live/new">Go live again</a></div>
      </section>`;
    }
    // Leaving the page (another tab in the app) ends the live.
    S.unsubs.push(() => { if (!ended) { finish(); toast('Your live ended'); } });
    window.__lksLive = { role: 'host', id, get viewers() { return counted(); }, get peers() { return peers.size; }, get stars() { return stars; }, end: () => finish() };
    write();
  }

  // ------------------------------------------------------------ viewer
  async function pageLive(id, token) {
    if (hostSession && hostSession.id === id) { startBroadcast(token); return; }
    const snap = await getDoc(liveRef(id));
    if (stale(token)) return;
    if (!snap.exists()) { main.innerHTML = '<div class="empty">This live doesn’t exist. <a href="#/feed">Back to feed</a></div>'; return; }
    const l = { id, ...snap.data() };
    if (!isFresh(l)) { endedView(l); return; }
    if (S.blocked.has(l.hostId)) { main.innerHTML = '<div class="empty">You blocked this account.</div>'; return; }
    if (l.type === 'youtube') return pageYouTube(l, token);
    document.body.classList.add('live-mode');
    const signedIn = !!(S.user && S.profile);
    const mine = signedIn && l.hostId === me();
    const following = S.following.has(l.hostId);
    main.innerHTML = `<div class="lv lv-view" id="lv">
      <video class="lv-video" id="lv-video" autoplay playsinline></video>
      <div class="lv-wait" id="lv-wait"><div class="lv-wait-in">${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, 'lg', false)}<p id="lv-wait-msg">${signedIn ? 'Connecting to the live…' : 'Log in to watch this live.'}</p>
        ${signedIn ? '<div class="spinner"></div>' : `<div class="row" style="justify-content:center;gap:10px"><a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/live/' + id)}">Log in</a><a class="btn btn-sm btn-ghost" href="#/signup">Sign up</a></div>`}</div></div>
      <div class="lv-shade"></div>
      <header class="lv-top">
        <a class="lv-who" href="#/u/${esc(l.hostUsername)}">${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, 'sm', false)}<div><b>${esc(l.hostName)}${badge(l.hostId)}</b><span class="small">${l.title ? esc(l.title) : '@' + esc(l.hostUsername)}</span></div></a>
        ${signedIn && !mine && l.hostId !== me() && !following ? `<button class="lv-follow" id="lv-follow" aria-label="Follow ${esc(l.hostName)}">Follow</button>` : ''}
        ${liveBadge()}
        <span class="lv-count" id="lv-count" aria-live="polite">${IC.people}<span>${fmtCount(l.viewerCount || 0)}</span></span>
        ${signedIn && l.hostId !== me() ? `<button class="lv-report" id="lv-report" aria-label="Report this live">${FLAG}</button>` : ''}
        <button class="lv-x" id="lv-x" aria-label="Leave live">${IC.close}</button>
      </header>
      ${isAdmin() ? `<button class="lv-admin-end" id="lv-admin-end">End live (guidelines)</button>` : ''}
      <button class="lv-unmute" id="lv-unmute" hidden>${IC.muted}<span>Tap for sound</span></button>
      <div class="lv-stars" aria-hidden="true"></div>
      <div class="lv-bottom">
        <div class="lv-chat" aria-live="polite" aria-label="Live chat"></div>
        ${signedIn ? `<div class="lv-row"><form class="lv-form"><label class="sr-only" for="lv-say">Say something</label><button type="button" class="lv-emoji" aria-label="Emoji">😊</button><input id="lv-say" maxlength="150" placeholder="Say something…" autocomplete="off"><button class="lv-send" aria-label="Send">${ICONS.send}</button></form>
          <button class="lv-starbtn" id="lv-starbtn" aria-label="Send a star (or tap the video)">${STAR}<span class="lv-starbadge" id="lv-starsn" aria-label="Total stars">0</span></button></div>` : ''}
      </div></div>`;
    const root = $('#lv'), v = $('#lv-video');
    ctx.palLive && ctx.palLive(root, { liveId: id, hostId: l.hostId, isHost: false });
    let pc = null, left = false, connected = false, connT = 0, starsOut = null;
    const unsubs = [];
    const waitMsg = (html, spinner = false) => { const w = $('#lv-wait'); if (!w) return; w.hidden = false; w.querySelector('#lv-wait-msg').innerHTML = html; const sp = w.querySelector('.spinner'); if (sp) sp.hidden = !spinner; };
    $('#lv-x').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/feed');
    { const rb = document.getElementById('lv-report'); if (rb) rb.onclick = () => ctx.reportDialog('live', l.id, l.id, `${l.hostName || ''}: ${l.title || 'live'}`); }
    const totals = starTotal(root, l.starCount || 0);
    let initStars = 0;
    unsubs.push(watchChat(id, root, (n, initial) => { if (initial) { initStars += n; totals.doc(initStars); } else totals.add(n); }));
    unsubs.push(onSnapshot(liveRef(id), (d) => {
      const x = d.data(); if (!x) return;
      root.querySelector('#lv-count span').textContent = fmtCount(x.viewerCount || 0);
      totals.doc(x.starCount);
      if (x.status === 'ended') ended(x);
    }, () => {}));
    const staleT = setInterval(async () => { try { const d = await getDoc(liveRef(id)); if (!isFresh(d.data())) ended(d.data() || l); } catch {} }, 15000);
    function ended(x) {
      if (left) return; leave();
      endedView({ ...l, ...x, id });
    }
    async function leave() {
      if (left) return; left = true;
      clearInterval(staleT); clearTimeout(connT);
      unsubs.forEach((u) => u());
      starsOut && starsOut.flushNow();
      try { pc && pc.close(); } catch {}
      if (signedIn) { deleteDoc(sub(id, 'viewers', me())).catch(() => {}); deleteDoc(sub(id, 'answers', me())).catch(() => {}); }
      document.body.classList.remove('live-mode');
    }
    S.unsubs.push(leave);
    window.addEventListener('pagehide', leave, { once: true });
    $('#lv-follow')?.addEventListener('click', async (e) => {
      const b = e.currentTarget; const on = !S.following.has(l.hostId); b.disabled = true;
      try { await followUser(l.hostId, on); b.textContent = on ? 'Following' : 'Follow'; b.classList.toggle('on', on); if (on) setTimeout(() => b.remove(), 1500); } catch (err) { toast(friendlyError(err)); }
      b.disabled = false;
    });
    $('#lv-admin-end')?.addEventListener('click', async () => {
      if (!confirm('End this live for breaking the community guidelines?')) return;
      try { await updateDoc(liveRef(id), { status: 'ended', endedAt: serverTimestamp(), endedBy: 'admin' }); toast('Live ended'); } catch (e) { toast(friendlyError(e)); }
    });
    $('#lv-unmute').onclick = () => { v.muted = false; v.play().catch(() => {}); $('#lv-unmute').hidden = true; };
    if (!signedIn) return;
    if (mine) { waitMsg('You’re hosting this live in another tab or on another device.'); return; }
    // Stars: the button, or tap anywhere on the video (each tap floats a star from that spot).
    starsOut = starSender(root, id);
    $('#lv-starbtn').onclick = () => starsOut.add();
    root.addEventListener('click', (e) => { if (tapIgnore(e) || !$('#lv-wait')?.hidden) return; starsOut.add(e.clientX, e.clientY); });
    wireChatForm(root, id);
    // Join: clear any old signaling docs, then ask the host for a connection.
    try {
      await Promise.allSettled([deleteDoc(sub(id, 'answers', me())), deleteDoc(sub(id, 'conns', me())), deleteDoc(sub(id, 'viewers', me()))]);
      if (left) return;
      let handled = false;
      unsubs.push(onSnapshot(sub(id, 'conns', me()), async (d) => {
        if (!d.exists() || handled || left) return;
        const c = d.data();
        if (c.full) { handled = true; waitMsg(`<b>Live is full</b><br>Up to ${LIVE_CAP} people can watch at once. Try again in a little while.<br><button class="btn btn-sm" id="lv-retry" style="margin-top:12px">Try again</button>`); $('#lv-retry').onclick = () => location.reload(); return; }
        if (!c.offer) return;
        handled = true;
        pc = new RTCPeerConnection({ iceServers: ICE });
        pc.ontrack = (e) => {
          if (v.srcObject !== e.streams[0]) {
            v.srcObject = e.streams[0];
            v.play().catch(() => { v.muted = true; v.play().catch(() => {}); $('#lv-unmute').hidden = false; });
          }
        };
        pc.onconnectionstatechange = () => {
          const s = pc.connectionState;
          if (s === 'connected') { connected = true; clearTimeout(connT); $('#lv-wait').hidden = true; }
          if (s === 'failed') cantConnect();
          if (s === 'disconnected') setTimeout(() => { if (pc && pc.connectionState === 'disconnected' && !left) waitMsg('Reconnecting…', true); }, 4000);
        };
        try {
          await pc.setRemoteDescription({ type: 'offer', sdp: c.offer });
          await pc.setLocalDescription(await pc.createAnswer());
          await waitIce(pc);
          if (left) return;
          await setDoc(sub(id, 'answers', me()), { answer: pc.localDescription.sdp, createdAt: serverTimestamp() });
        } catch (e) { console.warn(e); cantConnect(); }
      }, () => {}));
      await setDoc(sub(id, 'viewers', me()), { name: S.profile.displayName, username: S.profile.username, color: S.profile.color, joinedAt: serverTimestamp() });
      connT = setTimeout(() => { if (!connected && !left) cantConnect(); }, 30000);
    } catch (e) {
      waitMsg(e.code === 'permission-denied' ? 'You can’t watch this live.' : esc(friendlyError(e)));
    }
    function cantConnect() {
      if (connected || left) return;
      waitMsg(`<b>Couldn’t connect to this live</b><br>Some networks (like some work, school or mobile networks) block direct video connections, and we don’t use a relay server. Try Wi‑Fi or another network.<br><button class="btn btn-sm" id="lv-retry" style="margin-top:12px">Try again</button>`);
      const r = $('#lv-retry'); if (r) r.onclick = () => location.reload();
    }
    window.__lksLive = { role: 'viewer', id, get starsSent() { return starsOut ? starsOut.sent : 0; }, get starTotal() { return totals.value; }, get connected() { return connected; }, get pc() { return pc; } };
  }
  // ------------------------------------------------------------ YouTube "big live"
  // The video comes from YouTube's own embed player (any number of viewers); chat, stars and the
  // in-app viewer count run through Firestore. To stay inside the free Firestore quota, viewers
  // poll the live doc once a minute instead of listening, and nobody writes a heartbeat except the
  // host's screen (once a minute, only while open).
  let ytApi = null;
  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApi) return ytApi;
    ytApi = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); resolve(window.YT); };
      const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
      sc.onerror = () => { ytApi = null; reject(new Error('YouTube player failed to load')); };
      document.head.appendChild(sc);
      setTimeout(() => reject(new Error('timeout')), 10000);
    });
    return ytApi;
  }
  async function pageYouTube(l, token) {
    const id = l.id, yt = l.youtubeId;
    document.body.classList.add('live-mode');
    const signedIn = !!(S.user && S.profile);
    const host = signedIn && (l.hostId === me() || (l.hostId === STUDIO_UID && isAdmin()));
    const chatOn = l.chatOn !== false;
    const canChat = signedIn && chatOn;
    const following = S.following.has(l.hostId);
    const ytUrl = 'https://www.youtube.com/watch?v=' + encodeURIComponent(yt);
    main.innerHTML = `<div class="lv lv-view lv-ytlive" id="lv">
      <div class="lv-ytbox" id="lv-ytbox"><img class="lv-ytposter" alt="" src="https://i.ytimg.com/vi/${esc(yt)}/hqdefault.jpg"><div class="spinner"></div></div>
      <div class="lv-taplayer" id="lv-taplayer" hidden aria-hidden="true"></div>
      <button class="lv-tapplay" id="lv-tapplay" hidden>${ICONS.live}<span>Tap to play</span></button>
      <div class="lv-shade"></div>
      <header class="lv-top">
        <a class="lv-who" href="#/u/${esc(l.hostUsername)}">${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, 'sm', false)}<div><b>${esc(l.hostName)}${badge(l.hostId)}</b><span class="small">${l.title ? esc(l.title) : '@' + esc(l.hostUsername)}</span></div></a>
        ${signedIn && !host && !following ? `<button class="lv-follow" id="lv-follow" aria-label="Follow ${esc(l.hostName)}">Follow</button>` : ''}
        ${liveBadge()}
        <span class="lv-count" id="lv-count" aria-live="polite" title="Signed-in viewers in the app">${IC.people}<span>${fmtCount(l.viewerCount || 0)}</span></span>
        ${host ? `<button class="lv-end" id="lv-end">End</button>` : ''}
        ${signedIn && l.hostId !== me() ? `<button class="lv-report" id="lv-report" aria-label="Report this live">${FLAG}</button>` : ''}
        ${signedIn && l.hostId !== me() ? `<button class="lv-report" id="lv-report" aria-label="Report this live">${FLAG}</button>` : ''}
        <button class="lv-x" id="lv-x" aria-label="Leave live">${IC.close}</button>
      </header>
      <div class="lv-ytnote" id="lv-ytnote" hidden></div>
      ${isAdmin() && !host ? `<button class="lv-admin-end" id="lv-admin-end">End live (guidelines)</button>` : ''}
      <button class="lv-unmute" id="lv-unmute" hidden>${IC.muted}<span>Tap for sound</span></button>
      <div class="lv-stars" aria-hidden="true"></div>
      <div class="lv-bottom">
        ${host ? `<p class="lv-hostnote small">Closing this screen doesn’t end your live. Tap <b>End</b> when your YouTube stream is over.</p>` : ''}
        ${chatOn ? '<div class="lv-chat" aria-live="polite" aria-label="Live chat"></div>' : ''}
        ${canChat ? `<div class="lv-row"><form class="lv-form"><label class="sr-only" for="lv-say">Say something</label><button type="button" class="lv-emoji" aria-label="Emoji">😊</button><input id="lv-say" maxlength="150" placeholder="Say something…" autocomplete="off"><button class="lv-send" aria-label="Send">${ICONS.send}</button></form>
          <button class="lv-starbtn" id="lv-starbtn" aria-label="Send a star (or tap the video)">${STAR}<span class="lv-starbadge" id="lv-starsn" aria-label="Total stars">0</span></button></div>`
          : !chatOn ? `<a class="btn btn-sm btn-ghost lv-ytchat" href="${ytUrl}" target="_blank" rel="noopener">Chat on YouTube</a>`
          : `<p class="lv-hostnote small"><a href="#/login?next=${encodeURIComponent('#/live/' + id)}">Log in</a> to chat and send stars.</p>`}
      </div></div>`;
    const root = $('#lv');
    ctx.palLive && ctx.palLive(root, { liveId: id, hostId: l.hostId, isHost: !!host });
    let left = false, player = null, playing = false, starsOut = null, stars = l.starCount || 0;
    let peak = l.peakViewers || 0, total = l.totalViewers || 0, lastCount = l.viewerCount || 0;
    const unsubs = []; const timers = [];
    const note = (html) => { const n = $('#lv-ytnote'); if (!n) return; n.hidden = !html; n.innerHTML = html || ''; };
    $('#lv-x').onclick = () => history.length > 1 ? history.back() : (location.hash = '#/feed');
    { const rb = document.getElementById('lv-report'); if (rb) rb.onclick = () => ctx.reportDialog('live', l.id, l.id, `${l.hostName || ''}: ${l.title || 'live'}`); }
    const totals = starTotal(root, l.starCount || 0);
    let initStars = 0;
    if (chatOn) unsubs.push(watchChat(id, root, (n, initial) => {
      if (initial) { initStars += n; stars = Math.max(stars, initStars); totals.doc(initStars); } else { stars += n; totals.add(n); }
    }));
    // Player (lazy: the API script only loads when a YouTube live is opened).
    (async () => {
      const box = $('#lv-ytbox');
      const fallback = () => {
        if (left || !box) return;
        box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}?autoplay=1&playsinline=1&rel=0" title="${esc(l.title || l.hostName + ' live')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
      };
      try {
        const YT = await loadYouTubeApi();
        if (left || stale(token)) return;
        const el = document.createElement('div'); el.id = 'lv-ytplayer'; box.appendChild(el);
        player = new YT.Player(el, {
          host: 'https://www.youtube-nocookie.com', videoId: yt, width: '100%', height: '100%',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: (e) => {
              box.querySelector('.spinner')?.remove();
              $('#lv-taplayer').hidden = false;
              try { e.target.playVideo(); } catch {}
              // Browsers block autoplay with sound: fall back to muted + a "Tap for sound" button.
              setTimeout(() => { if (!left && !playing && player) { try { player.mute(); player.playVideo(); $('#lv-unmute').hidden = false; } catch {} } }, 1500);
            },
            onStateChange: (e) => {
              if (e.data === 1) { playing = true; note(''); box.querySelector('.lv-ytposter')?.remove(); $('#lv-tapplay').hidden = true; }
              if (e.data === 2) { playing = false; $('#lv-tapplay').hidden = false; }
              if (e.data === 0) note(`<b>The YouTube stream has ended.</b> ${host ? 'Tap End to close the live in the app.' : ''}`);
            },
            onError: (e) => {
              const msg = e.data === 101 || e.data === 150 ? 'This stream can’t be played here. It may not exist, be private, or have embedding turned off on YouTube.'
                : e.data === 100 ? 'This stream is private, removed, or hasn’t been published yet.'
                : 'This stream can’t be played right now.';
              note(`<b>${msg}</b> <a href="${ytUrl}" target="_blank" rel="noopener">Watch on YouTube</a>`);
            }
          }
        });
      } catch { fallback(); }
      // Not started yet / offline: YouTube shows its own "waiting" screen; add a gentle hint.
      timers.push(setTimeout(() => { if (!playing && !left && $('#lv-ytnote')?.hidden) note(`Waiting for the stream to start… If nothing plays, the live may not have started on YouTube yet. <a href="${ytUrl}" target="_blank" rel="noopener">Open on YouTube</a>`); }, 15000));
    })();
    $('#lv-unmute').onclick = () => { try { player.unMute(); player.playVideo(); } catch {} $('#lv-unmute').hidden = true; };
    $('#lv-tapplay').onclick = () => { try { player.playVideo(); } catch {} $('#lv-tapplay').hidden = true; };
    // The tap layer sits over the YouTube player: taps send stars (the host's taps play/pause).
    $('#lv-taplayer').addEventListener('click', (e) => {
      if (!player) return;
      if (!playing || host) { try { playing && host ? player.pauseVideo() : player.playVideo(); } catch {} return; }
      if (starsOut) starsOut.add(e.clientX, e.clientY);
      else if (!signedIn) toast('Log in to send stars');
    });
    // Live doc: poll once a minute (cheap for thousands of viewers).
    const poll = async () => {
      try {
        const d = await getDoc(liveRef(id)); const x = d.data();
        if (!x) return ended(l);
        root.querySelector('#lv-count span').textContent = fmtCount(host ? Math.max(lastCount, x.viewerCount || 0) : x.viewerCount || 0);
        totals.doc(x.starCount);
        if (!isFresh(x)) ended({ ...l, ...x });
      } catch {}
    };
    if (!host) timers.push(setInterval(poll, 60000));
    // Host screen: count viewers (one aggregate read) and check in once a minute.
    const hostWrite = async (end = false) => {
      let n = lastCount;
      try { n = (await getCountFromServer(collection(db, 'lives', id, 'viewers'))).data().count; } catch {}
      lastCount = end ? 0 : n; peak = Math.max(peak, n); total = Math.max(total, peak);
      root.querySelector('#lv-count span').textContent = fmtCount(n);
      await updateDoc(liveRef(id), { heartbeatAt: serverTimestamp(), viewerCount: end ? 0 : n, peakViewers: peak, totalViewers: total, starCount: Math.max(stars, l.starCount || 0),
        ...(end ? { status: 'ended', endedAt: serverTimestamp(), endedBy: 'host' } : {}) });
    };
    if (host) {
      hostWrite().catch(() => {});
      timers.push(setInterval(() => hostWrite().then(poll).catch(() => {}), 60000));
      $('#lv-end').onclick = async () => {
        if (!confirm('End your live in the app? (Remember to end the stream on YouTube too.)')) return;
        try { await hostWrite(true); } catch (e) { toast(friendlyError(e)); return; }
        const fin = { ...l, status: 'ended', viewerCount: 0, peakViewers: peak, totalViewers: total, starCount: Math.max(stars, l.starCount || 0) };
        leave(); cleanupSubs(id); endedView(fin);
      };
    }
    function ended(x) { if (left) return; leave(); endedView({ ...l, ...x, id }); }
    function leave() {
      if (left) return; left = true;
      timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
      unsubs.forEach((u) => u());
      starsOut && starsOut.flushNow();
      try { player && player.destroy(); } catch {}
      if (signedIn && !host) deleteDoc(sub(id, 'viewers', me())).catch(() => {});
      document.body.classList.remove('live-mode');
    }
    S.unsubs.push(leave);
    window.addEventListener('pagehide', leave, { once: true });
    $('#lv-follow')?.addEventListener('click', async (e) => {
      const b = e.currentTarget; const on = !S.following.has(l.hostId); b.disabled = true;
      try { await followUser(l.hostId, on); b.textContent = on ? 'Following' : 'Follow'; b.classList.toggle('on', on); if (on) setTimeout(() => b.remove(), 1500); } catch (err) { toast(friendlyError(err)); }
      b.disabled = false;
    });
    $('#lv-admin-end')?.addEventListener('click', async () => {
      if (!confirm('End this live for breaking the community guidelines?')) return;
      try { await updateDoc(liveRef(id), { status: 'ended', endedAt: serverTimestamp(), endedBy: 'admin' }); toast('Live ended'); ended({ status: 'ended', endedBy: 'admin' }); } catch (e) { toast(friendlyError(e)); }
    });
    if (canChat) {
      starsOut = starSender(root, id);
      $('#lv-starbtn').onclick = () => starsOut.add();
      wireChatForm(root, id);
    }
    // Presence for the in-app viewer count: one doc per signed-in viewer (no cap), removed on leave.
    if (signedIn && !host) {
      setDoc(sub(id, 'viewers', me()), { name: S.profile.displayName, username: S.profile.username, color: S.profile.color, joinedAt: serverTimestamp() }).catch(() => {});
    }
    window.__lksLive = { role: host ? 'host' : 'viewer', type: 'youtube', id, get starsSent() { return starsOut ? starsOut.sent : 0; }, get starTotal() { return totals.value; }, get playing() { return playing; }, get note() { return $('#lv-ytnote')?.textContent || ''; }, get player() { return player; } };
  }
  function endedView(l) {
    document.body.classList.remove('live-mode');
    const mine = S.user && (l.hostId === me() || (l.hostId === STUDIO_UID && isAdmin()));
    main.innerHTML = `<section class="card pad center lv-summary" id="lv-ended">
      ${avatar({ uid: l.hostId, displayName: l.hostName, username: l.hostUsername, color: l.hostColor }, 'lg', false)}
      <h1 class="page-title" style="margin:10px 0 4px">This live has ended</h1>
      <p class="muted" style="margin:0 0 14px">${esc(l.hostName || '')}${l.endedBy === 'admin' ? ' · ended by the studio' : ''}</p>
      ${mine ? `<div class="lv-sum-grid"><div><b>${l.totalViewers || 0}</b><span>Viewers</span></div><div><b>${l.peakViewers || 0}</b><span>Peak at once</span></div><div><b>${fmtCount(l.starCount || 0)}</b><span>Stars</span></div></div>` : ''}
      <div class="row" style="justify-content:center;gap:10px;flex-wrap:wrap">${l.hostUsername ? `<a class="btn btn-ghost" href="#/u/${esc(l.hostUsername)}">View profile</a>` : ''}<a class="btn" href="#/feed">Back to feed</a></div>
    </section>`;
  }

  return { pageGoLive, pageLive, renderFeed, renderProfile, liveNow, liveFor };
}
