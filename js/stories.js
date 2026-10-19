// Lone Keem Studios - 24-hour Stories (Instagram / Snapchat style).
// Data: stories/{id} { authorId, authorName, authorUsername, authorColor, mediaType, mediaUrl,
//   posterUrl, width, height, duration, caption, cloudinaryPublicId, createdAt, expiresAt }
//   + stories/{id}/viewers/{viewerUid}. users/{uid}.storyUntil hints that someone has a live story.
// Visibility (enforced by the rules): the owner + followers, or everyone for the studio account.
// Seen state: per viewer in localStorage (instant ring colour) + the viewers subcollection.
import { LIMITS } from './media-config.js';

const IC = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="19" cy="12" r="1.9"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
};
const SEEN_KEY = 'lks-story-seen';
const ms = (t) => (t && t.toMillis ? t.toMillis() : t instanceof Date ? t.getTime() : Number(t) || 0);

export function createStories(ctx) {
  const { S, db, esc, avatar, badge, timeAgo, toast, friendlyError, requireAuth, STUDIO_UID, isAdmin, openStory, sendMessage, refreshProfile, fs } = ctx;
  const { doc, getDoc, getDocs, setDoc, collection, query, where, orderBy, limit, writeBatch, Timestamp, serverTimestamp } = fs;

  // ------------------------------------------------------------ seen (local)
  const seenMap = () => {
    let m = {}; try { m = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { /* */ }
    const now = Date.now(); let dirty = false;
    for (const k of Object.keys(m)) if (m[k] < now) { delete m[k]; dirty = true; }
    if (dirty) localStorage.setItem(SEEN_KEY, JSON.stringify(m));
    return m;
  };
  const markSeenLocal = (st) => { const m = seenMap(); m[st.id] = ms(st.expiresAt) || Date.now() + 864e5; localStorage.setItem(SEEN_KEY, JSON.stringify(m)); };
  const groupSeen = (g, m = seenMap()) => g.items.every((it) => m[it.id]);
  const recordedViews = new Set();

  // ------------------------------------------------------------ loading
  const me = () => (S.user && S.profile ? S.user.uid : null);
  function audience() {
    const ids = me() ? [me(), STUDIO_UID, ...S.following] : [STUDIO_UID];
    return [...new Set(ids)].filter((u) => u && !S.blocked.has(u)).slice(0, 100);
  }
  async function storiesOf(uid, user) {
    if (!user || !user.storyUntil || ms(user.storyUntil) <= Date.now()) return null;
    try {
      const qs = await getDocs(query(collection(db, 'stories'), where('authorId', '==', uid), where('expiresAt', '>', Timestamp.now()), orderBy('expiresAt', 'asc'), limit(30)));
      const items = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => ms(s.expiresAt) > Date.now());
      return items.length ? { uid, user: { uid, ...user }, items } : null;
    } catch (e) { if (e.code !== 'permission-denied') console.warn('stories', uid, e.code || e.message); return null; }
  }
  async function loadGroups(uids) {
    const users = await Promise.all(uids.map((u) => refreshProfile(u).catch(() => null)));
    const groups = (await Promise.all(uids.map((u, i) => storiesOf(u, users[i])))).filter(Boolean);
    const m = seenMap();
    const latest = (g) => Math.max(...g.items.map((i) => ms(i.createdAt)));
    groups.sort((a, b) => (a.uid === me() ? -1 : b.uid === me() ? 1 : 0) || (groupSeen(a, m) - groupSeen(b, m)) || latest(b) - latest(a));
    return { groups, users: Object.fromEntries(uids.map((u, i) => [u, users[i]])) };
  }

  // ------------------------------------------------------------ rings row (Posts feed)
  const ringCls = (g) => (!g ? 'none' : groupSeen(g) ? 'seen' : 'unseen');
  function bubble(u, uid, g, { own = false } = {}) {
    const label = own ? 'Your story' : (u.displayName || u.username || '');
    return `<div class="sbub" data-uid="${esc(uid)}">
      <button class="sring ${ringCls(g)}" data-open="${esc(uid)}" aria-label="${esc(own ? (g ? 'View your story' : 'Add to your story') : `View ${label}’s story`)}">${avatar({ ...u, uid }, 'story', false)}</button>
      ${own ? `<button class="sadd" data-add aria-label="Add to your story">${IC.plus}</button>` : ''}
      <span class="sname">${esc(label)}</span></div>`;
  }
  async function renderRow(slot, token, stale) {
    if (!slot) return;
    const mine = me();
    slot.innerHTML = `<div class="srow" role="list" aria-label="Stories">${mine ? bubble(S.profile, mine, null, { own: true }) : ''}<div class="sbub sk"><span class="sring none"></span></div><div class="sbub sk"><span class="sring none"></span></div></div>`;
    const { groups } = await loadGroups(audience());
    if (stale && stale(token)) return;
    const own = groups.find((g) => g.uid === mine);
    const others = groups.filter((g) => g.uid !== mine);
    if (!mine && !others.length) { slot.innerHTML = ''; return; }
    slot.innerHTML = `<div class="srow" role="list" aria-label="Stories">
      ${mine ? bubble(S.profile, mine, own, { own: true }) : ''}
      ${others.map((g) => bubble(g.user, g.uid, g)).join('')}
      ${mine && !others.length ? `<p class="srow-empty small muted">Stories from people you follow show up here.</p>` : ''}</div>`;
    const ordered = [...(own ? [own] : []), ...others];
    slot.onclick = (e) => {
      if (e.target.closest('[data-add]')) { if (requireAuth()) openStory(); return; }
      const b = e.target.closest('[data-open]'); if (!b) return;
      const uid = b.dataset.open;
      const gi = ordered.findIndex((g) => g.uid === uid);
      if (gi < 0) { if (uid === mine && requireAuth()) openStory(); return; }
      openViewer(ordered, gi, 0, () => renderRow(slot, token, stale));
    };
  }

  // ------------------------------------------------------------ profile: ring + thumbnails
  async function renderProfile(avatarWrap, listSlot, uid, user, token, stale) {
    if (!avatarWrap) return;
    if (S.blocked.has(uid)) return;
    const visible = uid === STUDIO_UID || uid === me() || S.following.has(uid);
    if (!visible) return;
    const fresh = await refreshProfile(uid).catch(() => user);
    const g = await storiesOf(uid, fresh || user);
    if ((stale && stale(token)) || !g) return;
    const repaint = () => {
      avatarWrap.classList.add('has-story'); avatarWrap.classList.toggle('seen', groupSeen(g));
      if (listSlot) listSlot.innerHTML = `<h2 class="sthumbs-title">Stories <span class="muted small">· disappear after 24h</span></h2><div class="sthumbs">${g.items.map((it, i) => `
        <button class="sthumb ${seenMap()[it.id] ? 'seen' : ''}" data-i="${i}" aria-label="Story ${i + 1} of ${g.items.length}, ${esc(timeAgo(it.createdAt))}">
          <img src="${esc(it.posterUrl || it.mediaUrl)}" alt="" loading="lazy"><span>${esc(timeAgo(it.createdAt))}</span></button>`).join('')}</div>`;
    };
    repaint();
    avatarWrap.setAttribute('role', 'button'); avatarWrap.tabIndex = 0;
    avatarWrap.setAttribute('aria-label', `View ${user.displayName}’s story`);
    const go = (i) => openViewer([g], 0, i, repaint);
    avatarWrap.onclick = () => go(Math.max(0, g.items.findIndex((it) => !seenMap()[it.id])));
    avatarWrap.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); avatarWrap.onclick(); } };
    if (listSlot) listSlot.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) go(Number(b.dataset.i)); };
  }

  // ------------------------------------------------------------ viewer
  let V = null;
  function closeViewer() {
    if (!V) return;
    const v = V; V = null;
    cancelAnimationFrame(v.raf); v.cleanup.forEach((f) => { try { f(); } catch { /* */ } });
    v.el.classList.add('closing');
    setTimeout(() => v.el.remove(), 160);
    document.body.classList.remove('story-open');
    v.onClose && v.onClose();
  }
  function openViewer(groups, gi = 0, ii = 0, onClose) {
    closeViewer();
    groups = groups.map((g) => ({ ...g, items: [...g.items] }));
    const el = document.createElement('div');
    el.className = 'sv'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Story viewer');
    el.innerHTML = `<div class="sv-card" id="sv-card">
        <div class="sv-media" id="sv-media"></div>
        <div class="sv-shade" aria-hidden="true"></div>
        <div class="sv-bars" id="sv-bars" aria-hidden="true"></div>
        <div class="sv-head">
          <a class="sv-who" id="sv-who"></a>
          <span class="sv-paused" id="sv-paused" hidden>${IC.pause}</span>
          <button class="sv-btn" id="sv-sound" hidden aria-label="Unmute">${IC.muted}</button>
          <button class="sv-btn" id="sv-more" hidden aria-label="Story options">${IC.more}</button>
          <button class="sv-btn" id="sv-close" aria-label="Close stories">${IC.close}</button>
        </div>
        <p class="story-cap sv-cap" id="sv-cap" hidden></p>
        <div class="sv-foot" id="sv-foot"></div>
        <div class="sv-sheet-root" id="sv-sheet"></div>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('story-open');
    const $ = (id) => el.querySelector('#' + id);
    const card = $('sv-card'), media = $('sv-media'), bars = $('sv-bars'), cap = $('sv-cap'), foot = $('sv-foot');
    V = { el, raf: 0, cleanup: [], onClose };
    const state = { gi, ii, t0: 0, elapsed: 0, paused: false, holds: new Set(), dur: LIMITS.storyImageSeconds, vid: null, muted: false };
    S.unsubs.push(closeViewer);

    const cur = () => groups[state.gi] && groups[state.gi].items[state.ii];
    const owner = () => groups[state.gi] && (groups[state.gi].uid === me() || (groups[state.gi].uid === STUDIO_UID && isAdmin()));
    const setPaused = () => {
      const p = state.holds.size > 0;
      if (p === state.paused) return;
      state.paused = p; $('sv-paused').hidden = !p; el.classList.toggle('paused', p);
      if (state.vid) { if (p) state.vid.pause(); else state.vid.play().catch(() => {}); }
      if (!p) state.t0 = performance.now() - state.elapsed * 1000;
    };
    const hold = (k, on) => { if (on) state.holds.add(k); else state.holds.delete(k); setPaused(); };

    function paintBars() {
      const g = groups[state.gi];
      bars.innerHTML = g.items.map((_, i) => `<span><i style="transform:scaleX(${i < state.ii ? 1 : 0})"></i></span>`).join('');
    }
    function show() {
      const g = groups[state.gi], st = cur();
      if (!g || !st) return closeViewer();
      cancelAnimationFrame(V.raf);
      if (state.vid) { state.vid.pause(); state.vid.removeAttribute('src'); state.vid.load(); state.vid = null; }
      state.elapsed = 0; state.t0 = performance.now(); state.holds.clear(); state.paused = false; $('sv-paused').hidden = true; el.classList.remove('paused');
      paintBars();
      const u = g.user;
      $('sv-who').href = `#/u/${encodeURIComponent(u.username || '')}`;
      $('sv-who').innerHTML = `${avatar({ ...u, uid: g.uid }, 'sm', false)}<b>${esc(u.displayName || '')}</b>${badge(g.uid)}<span>${esc(timeAgo(st.createdAt))}</span>`;
      cap.textContent = st.caption || ''; cap.hidden = !st.caption;
      $('sv-more').hidden = !owner();
      const isVid = st.mediaType === 'video';
      $('sv-sound').hidden = !isVid;
      if (isVid) {
        media.innerHTML = `<video playsinline webkit-playsinline preload="auto" poster="${esc(st.posterUrl || '')}" src="${esc(st.mediaUrl)}"></video>`;
        const v = state.vid = media.querySelector('video');
        v.muted = state.muted;
        state.dur = Math.min(LIMITS.storyVideoSeconds + 1, Number(st.duration) || LIMITS.storyVideoSeconds);
        v.onloadedmetadata = () => { if (Number.isFinite(v.duration) && v.duration > 0) state.dur = Math.min(v.duration, LIMITS.storyVideoSeconds + 1); };
        v.onended = () => next();
        v.play().catch(() => { v.muted = true; state.muted = true; paintSound(); v.play().catch(() => {}); });
        paintSound();
      } else {
        media.innerHTML = `<img src="${esc(st.mediaUrl)}" alt="${esc(st.caption ? 'Story: ' + st.caption : `Story from ${u.displayName || ''}`)}" draggable="false">`;
        state.dur = LIMITS.storyImageSeconds;
      }
      paintFoot();
      markSeen(g, st);
      // preload the next image
      const nx = g.items[state.ii + 1] || (groups[state.gi + 1] && groups[state.gi + 1].items[0]);
      if (nx && nx.mediaType === 'image') { const i = new Image(); i.src = nx.mediaUrl; }
      V.raf = requestAnimationFrame(loop);
    }
    function loop(now) {
      if (!V) return;
      if (!state.paused) {
        state.elapsed = state.vid && state.vid.currentTime > 0 && !state.vid.paused ? state.vid.currentTime : (now - state.t0) / 1000;
        if (state.vid && state.vid.currentTime > 0) state.t0 = now - state.vid.currentTime * 1000;
      }
      const f = Math.min(1, state.elapsed / (state.dur || 5));
      const bar = bars.children[state.ii]?.firstElementChild; if (bar) bar.style.transform = `scaleX(${f})`;
      if (f >= 1 && !state.paused && (!state.vid || state.vid.ended || state.elapsed >= state.dur)) return next();
      V.raf = requestAnimationFrame(loop);
    }
    function paintSound() { const b = $('sv-sound'); b.innerHTML = state.muted ? IC.muted : IC.sound; b.setAttribute('aria-label', state.muted ? 'Unmute' : 'Mute'); }
    function next() {
      const g = groups[state.gi];
      if (state.ii < g.items.length - 1) { state.ii++; show(); }
      else nextGroup();
    }
    function prev() {
      if (state.ii > 0) { state.ii--; show(); }
      else if (state.gi > 0) { state.gi--; state.ii = 0; slide('prev'); show(); }
      else { state.elapsed = 0; state.t0 = performance.now(); if (state.vid) state.vid.currentTime = 0; }
    }
    function nextGroup() {
      if (state.gi < groups.length - 1) { state.gi++; state.ii = firstUnseen(groups[state.gi]); slide('next'); show(); } else closeViewer();
    }
    function prevGroup() { if (state.gi > 0) { state.gi--; state.ii = 0; slide('prev'); show(); } else { card.style.transform = ''; } }
    const firstUnseen = (g) => { const m = seenMap(); const i = g.items.findIndex((it) => !m[it.id]); return i < 0 ? 0 : i; };
    function slide(dir) { card.classList.remove('in-next', 'in-prev'); void card.offsetWidth; card.classList.add(dir === 'next' ? 'in-next' : 'in-prev'); }

    async function markSeen(g, st) {
      markSeenLocal(st);
      if (!me() || g.uid === me() || recordedViews.has(st.id) || (g.uid === STUDIO_UID && isAdmin())) return;
      recordedViews.add(st.id);
      try {
        await setDoc(doc(db, 'stories', st.id, 'viewers', me()), {
          viewedAt: serverTimestamp(), name: S.profile.displayName, username: S.profile.username, color: S.profile.color
        });
      } catch (e) { /* view receipts are best effort */ }
    }

    // ---- footer: owner viewers / reply box
    function paintFoot() {
      const g = groups[state.gi], st = cur();
      if (owner()) {
        foot.innerHTML = `<button class="sv-viewers" id="sv-viewers">${IC.eye}<span id="sv-vcount">Seen by …</span></button>`;
        getDocs(query(collection(db, 'stories', st.id, 'viewers'), orderBy('viewedAt', 'desc'), limit(200))).then((qs) => {
          if (cur() !== st) return;
          const list = qs.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((v) => !S.blocked.has(v.uid));
          st._viewers = list;
          const c = el.querySelector('#sv-vcount'); if (c) c.textContent = list.length ? `Seen by ${list.length}` : 'No views yet';
        }).catch(() => { const c = el.querySelector('#sv-vcount'); if (c) c.textContent = 'Viewers'; });
        $('sv-viewers').onclick = () => viewersSheet(st);
      } else if (me()) {
        foot.innerHTML = `<form class="sv-reply" id="sv-reply"><label class="sr-only" for="sv-rtext">Reply to ${esc(g.user.displayName || '')}</label>
          <input id="sv-rtext" type="text" maxlength="500" autocomplete="off" enterkeyhint="send" placeholder="Reply to ${esc(g.user.displayName || g.user.username || '')}…">
          <button class="sv-btn" type="submit" aria-label="Send reply">${IC.send}</button></form>`;
        const inp = $('sv-rtext');
        inp.onfocus = () => hold('typing', true);
        inp.onblur = () => setTimeout(() => hold('typing', false), 120);
        $('sv-reply').onsubmit = async (ev) => {
          ev.preventDefault();
          const text = inp.value.trim(); if (!text) return;
          inp.disabled = true;
          try {
            const quote = st.caption ? ` “${st.caption.slice(0, 60)}”` : '';
            await sendMessage(g.uid, `↩︎ Replied to your story${quote}: ${text}`);
            closeViewer();
            location.hash = `#/chat/${g.uid}`;
          } catch (e) { inp.disabled = false; toast(e.code === 'permission-denied' ? 'Couldn’t send. You may be sending too fast, or this person isn’t accepting messages.' : friendlyError(e)); }
        };
      } else {
        foot.innerHTML = `<a class="sv-login" href="#/login?next=${encodeURIComponent(location.hash || '#/feed')}">Log in to reply</a>`;
        foot.querySelector('a').onclick = () => closeViewer();
      }
    }
    function sheet(html) {
      hold('sheet', true);
      const root = $('sv-sheet');
      root.innerHTML = `<div class="sv-sheet-bg"></div><div class="sv-sheet" role="dialog" aria-modal="true">${html}</div>`;
      const done = () => { root.innerHTML = ''; hold('sheet', false); };
      root.querySelector('.sv-sheet-bg').onclick = done;
      root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = done));
      return { root, done };
    }
    function viewersSheet(st) {
      const list = st._viewers;
      const { root } = sheet(`<div class="sv-sheet-head"><b>${list ? (list.length ? `Seen by ${list.length}` : 'No views yet') : 'Viewers'}</b><button class="sv-btn dark" data-close aria-label="Close">${IC.close}</button></div>
        <div class="sv-vlist">${list ? (list.length ? list.map((v) => `<a class="list-item" href="#/u/${esc(v.username)}">${avatar({ uid: v.uid, displayName: v.name, username: v.username, color: v.color }, 'sm', false)}<div class="meta"><b>${esc(v.name)}</b><p>@${esc(v.username)} · ${esc(timeAgo(v.viewedAt))}</p></div></a>`).join('') : '<p class="muted small center">When people view this story, they’ll show up here.</p>') : '<div class="spinner"></div>'}</div>`);
      root.querySelectorAll('.sv-vlist a').forEach((a) => (a.onclick = () => closeViewer()));
    }
    $('sv-more').onclick = (e) => {
      e.stopPropagation();
      const st = cur();
      const { root, done } = sheet(`<button class="sv-sheet-act danger" data-a="del">Delete this story</button>
        <button class="sv-sheet-act" data-a="views">${IC.eye} See viewers</button>
        <button class="sv-sheet-act" data-close>Cancel</button>`);
      root.querySelector('[data-a=views]').onclick = () => { done(); viewersSheet(st); };
      root.querySelector('[data-a=del]').onclick = async () => {
        if (!confirm('Delete this story? This can’t be undone.')) return;
        try {
          await deleteStory(st);
          done();
          const g = groups[state.gi];
          g.items.splice(state.ii, 1);
          toast('Story deleted');
          if (!g.items.length) return closeViewer(); // that was their last story
          else if (state.ii >= g.items.length) state.ii = g.items.length - 1;
          show();
        } catch (err) { toast(friendlyError(err)); }
      };
    };
    $('sv-close').onclick = (e) => { e.stopPropagation(); closeViewer(); };
    $('sv-sound').onclick = (e) => { e.stopPropagation(); state.muted = !state.muted; if (state.vid) { state.vid.muted = state.muted; state.vid.play().catch(() => {}); } paintSound(); };

    // ---- gestures: tap left/right, hold to pause, swipe down to close, swipe sideways between people
    let g0 = null;
    const isUi = (t) => t.closest('.sv-head button, .sv-head a, .sv-foot, .sv-sheet-root > *');
    card.addEventListener('pointerdown', (e) => {
      if (isUi(e.target) || e.button > 0) return;
      g0 = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false, held: false };
      g0.timer = setTimeout(() => { if (g0) { g0.held = true; hold('press', true); } }, 200);
      card.setPointerCapture?.(e.pointerId);
    });
    card.addEventListener('pointermove', (e) => {
      if (!g0 || e.pointerId !== g0.id) return;
      const dx = e.clientX - g0.x, dy = e.clientY - g0.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { g0.moved = true; clearTimeout(g0.timer); if (!g0.held) { g0.held = true; hold('press', true); } }
      if (g0.moved) {
        if (dy > 0 && dy > Math.abs(dx)) { card.style.transform = `translateY(${dy}px) scale(${Math.max(0.85, 1 - dy / 1600)})`; el.style.setProperty('--bgA', String(Math.max(0.3, 1 - dy / 500))); }
        else if (Math.abs(dx) > Math.abs(dy)) card.style.transform = `translateX(${dx}px)`;
      }
    });
    const end = (e, cancelled) => {
      if (!g0 || e.pointerId !== g0.id) return;
      const s = g0; g0 = null; clearTimeout(s.timer);
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      card.style.transform = ''; el.style.removeProperty('--bgA');
      hold('press', false);
      if (cancelled) return;
      if (s.moved) {
        if (dy > 90 && dy > Math.abs(dx)) return closeViewer();
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? nextGroup() : prevGroup();
        return;
      }
      if (s.held || performance.now() - s.t > 350) return; // it was a hold-to-pause
      const r = card.getBoundingClientRect();
      if (e.clientX - r.left < r.width * 0.33) prev(); else next();
    };
    card.addEventListener('pointerup', (e) => end(e, false));
    card.addEventListener('pointercancel', (e) => end(e, true));
    card.addEventListener('contextmenu', (e) => e.preventDefault());
    const onKey = (e) => {
      if (!V || e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowDown') nextGroup();
      else if (e.key === 'ArrowUp') prevGroup();
      else if (e.key === ' ') { e.preventDefault(); hold('key', !state.holds.has('key')); }
    };
    document.addEventListener('keydown', onKey);
    const onVis = () => hold('hidden', document.hidden);
    document.addEventListener('visibilitychange', onVis);
    V.cleanup.push(() => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); if (state.vid) state.vid.pause(); });
    V.state = state; V.api = { next, prev, nextGroup, prevGroup, close: closeViewer }; // for tests
    window.__lksStory = V;
    show();
    $('sv-close').focus({ preventScroll: true });
  }

  async function deleteStory(st) {
    const vs = await getDocs(query(collection(db, 'stories', st.id, 'viewers'), limit(400))).catch(() => ({ docs: [] }));
    const b = writeBatch(db);
    vs.docs.forEach((d) => b.delete(d.ref));
    b.delete(doc(db, 'stories', st.id));
    await b.commit();
  }

  // Opens the viewer for one person (used by deep links / avatars elsewhere).
  async function openFor(uid) {
    const u = await refreshProfile(uid).catch(() => null);
    const g = await storiesOf(uid, u);
    if (!g) { toast('No story right now.'); return; }
    openViewer([g], 0, 0);
  }

  return { renderRow, renderProfile, openViewer, openFor, close: closeViewer, seenMap };
}
