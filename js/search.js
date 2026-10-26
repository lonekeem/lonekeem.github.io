// Lone Keem Studios - search (people, videos, photos, posts, hashtags).
// Free-plan friendly: indexed Firestore queries (username / displayNameLower prefix ranges,
// keywords / hashtags array-contains) merged with a client-side scan of the newest posts and
// profiles, so content that hasn't been re-indexed yet is still found in a small community.
import { fold, words, parseHashtags } from './search-index.js';
import { ICONS } from './icons.js';
import { blockedQuery, BLOCKED_MSG, matchScore, queryTerms, rankItems, groupOf, itemHay, GROUPS, GAMES, PAGES, palItems, searchCatalog, createTrends } from './search-plus.js';
import { learnSearch, learnTap } from './interests.js';
import { loadDiscover } from './discover.js';
import { ytTile } from './music.js';
import { faceName, adminNameClass } from './kemy-name.js';
import { YOUTUBE } from './media-config.js';

const RECENT_KEY = 'lks-recent-searches';
const TABS = GROUPS;
export const SEARCH_ICON = ICONS.search;
const IC = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 9h15M4 15h15M10 3 8 21M16 3l-2 18"/></svg>'
};
export const kindOfPost = (p, youTubeId, tikTokId) => p.mediaUrl && p.mediaType === 'video' ? 'video' : p.mediaUrl && p.mediaType === 'image' ? 'image'
  : p.linkUrl && ((youTubeId(p.linkUrl) || '').match(/^[\w-]+$/) || tikTokId(p.linkUrl)) ? 'video' : 'text';

export function createSearch(ctx) {
  const { S, db, main, esc, $, avatar, badge, toast, friendlyError, requireAuth, followUser, gridTile, postCard, STUDIO_UID,
    youTubeId, tikTokId, stale, canGoBack } = ctx;
  const { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where, orderBy, limit, getCountFromServer, serverTimestamp } = ctx.fs;
  const trends = createTrends({ db, fs: ctx.fs, getUid: () => S.user?.uid });
  const { openModal, seriesList, seriesTile } = ctx;
  const cache = { posts: null, postsAt: 0, users: null, usersAt: 0 };
  const followerCounts = new Map();

  // ------------------------------------------------------------ data
  async function recentPosts() {
    if (cache.posts && Date.now() - cache.postsAt < 60000) return cache.posts;
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(150)));
    cache.posts = snap.docs.map((d) => ({ id: d.id, ...d.data() })); cache.postsAt = Date.now();
    return cache.posts;
  }
  async function recentUsers() {
    if (cache.users && Date.now() - cache.usersAt < 120000) return cache.users;
    const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(200)));
    cache.users = snap.docs.map((d) => ({ uid: d.id, ...d.data() })); cache.usersAt = Date.now();
    return cache.users;
  }
  const tagsOf = (p) => (Array.isArray(p.hashtags) ? p.hashtags : parseHashtags(p.text));
  const hay = (p) => [...words(p.text), ...words(p.authorName), ...words(p.authorUsername), fold(p.authorUsername), ...tagsOf(p)];
  const userHay = (u) => [fold(u.username), ...words(u.username), ...words(u.displayName)];
  const allMatch = (terms, list) => matchScore(terms, list) > 0;
  const visibleUser = (u) => u && !S.blocked.has(u.uid);
  const visiblePost = (p) => p && !S.blocked.has(p.authorId) && !window.kemyReportHidden?.(p) && !window.kemyAgeHidden?.(p);
  const ms = (p) => p.createdAt?.toMillis?.() || 0;
  const safe = (pr) => pr.catch((e) => { console.warn('search query', e.code || e.message); return null; });

  async function run(raw) {
    const q = raw.trim();
    const isTag = q.startsWith('#'), isUser = q.startsWith('@');
    const terms = queryTerms(q);
    if (!terms.length) return null;
    if (blockedQuery(q)) return { q, blocked: true };
    const longest = [...terms].sort((a, b) => b.length - a.length)[0].slice(0, 15);
    const tag = fold(q.replace(/^#+/, '')).replace(/[^\p{L}\p{N}_]/gu, '');
    const posts = collection(db, 'posts'), users = collection(db, 'users');
    const uname = fold(q.replace(/^@+/, '')).replace(/\s+/g, '');
    const phrase = terms.join(' ');
    const [byName, byDisplay, byKw, byTag, scanP, scanU] = await Promise.all([
      isTag ? null : safe(getDocs(query(users, where('username', '>=', uname), where('username', '<=', uname + '\uf8ff'), orderBy('username'), limit(20)))),
      isTag ? null : safe(getDocs(query(users, where('displayNameLower', '>=', phrase), where('displayNameLower', '<=', phrase + '\uf8ff'), orderBy('displayNameLower'), limit(20)))),
      isTag || isUser ? null : safe(getDocs(query(posts, where('keywords', 'array-contains', longest), orderBy('createdAt', 'desc'), limit(60)))),
      isTag && tag ? safe(getDocs(query(posts, where('hashtags', 'array-contains', tag), orderBy('createdAt', 'desc'), limit(60)))) : null,
      safe(recentPosts()), isTag ? null : safe(recentUsers())
    ]);
    const [disc, pals, series, ytMore] = await Promise.all([safe(loadDiscover()), isTag || isUser ? [] : palItems(), isTag || isUser ? [] : safe(seriesListCached()), isTag || isUser ? null : safe(youTubeMore(q))]);
    // users
    const um = new Map();
    for (const s of [byName, byDisplay]) s?.docs.forEach((d) => um.set(d.id, { uid: d.id, ...d.data() }));
    (scanU || []).filter((u) => allMatch(terms, userHay(u))).forEach((u) => um.set(u.uid, u));
    const userList = [...um.values()].filter(visibleUser).filter((u) => allMatch(terms, userHay(u)))
      .sort((a, b) => (fold(b.username) === uname) - (fold(a.username) === uname) || (b.uid === STUDIO_UID) - (a.uid === STUDIO_UID) || fold(a.username).localeCompare(fold(b.username)));
    // posts
    const pm = new Map();
    for (const s of [byKw, byTag]) s?.docs.forEach((d) => pm.set(d.id, { id: d.id, ...d.data() }));
    (scanP || []).forEach((p) => pm.set(p.id, p));
    const postList = [...pm.values()].filter(visiblePost).filter((p) => isTag ? tagsOf(p).includes(tag) : isUser ? allMatch(terms, [fold(p.authorUsername), ...words(p.authorUsername)]) : allMatch(terms, itemHay(p)))
      ;
    const ranked = isTag ? postList.sort((a, b) => ms(b) - ms(a)) : rankItems(terms, postList);
    const outside = isUser ? [] : (disc?.videos || []).filter((v) => isTag ? (v.cat === tag || fold(v.text).includes('#' + tag)) : true);
    const outRanked = isTag ? outside.slice(0, 24) : rankItems(terms, outside);
    const groups = { videos: [], music: [], mvideos: [], movies: [], posts: [] };
    for (const p of [...ranked, ...outRanked]) { const g = groupOf(p); (groups[g] || groups.videos).push(p); }
    const seriesHits = (series || []).filter((x) => matchScore(terms, [...words(x.title), ...words(x.genre), ...words(x.desc), ...words(x.ownerName)]) > 0);
    // hashtags (from everything we've seen)
    const counts = new Map();
    [...pm.values()].filter(visiblePost).forEach((p) => tagsOf(p).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const tagNeedle = isTag ? tag : longest;
    const tagList = [...counts.entries()].filter(([t]) => t.startsWith(tagNeedle)).sort((a, b) => (b[0] === tagNeedle) - (a[0] === tagNeedle) || b[1] - a[1]).slice(0, 30);
    return { q, isTag, tag, users: isTag ? [] : userList.slice(0, 30), posts: ranked, tags: tagList, groups, series: seriesHits,
      games: isTag || isUser ? [] : searchCatalog(terms, [...PAGES, ...GAMES]), pals: isTag || isUser ? [] : searchCatalog(terms, pals || []).slice(0, 12), ytMore: ytMore || [] };
  }
  let seriesCache = null, seriesAt = 0;
  async function seriesListCached() {
    if (seriesCache && Date.now() - seriesAt < 120000) return seriesCache;
    seriesCache = seriesList ? await seriesList() : []; seriesAt = Date.now(); return seriesCache;
  }
  // Optional: with a YouTube Data API key in js/media-config.js (YOUTUBE.key) add a "More from YouTube" row
  // (safeSearch strict, embeddable only). Without a key this does nothing. Results are cached per query.
  const ytCache = new Map();
  async function youTubeMore(q) {
    if (!YOUTUBE?.key) return [];
    const k = fold(q).trim(); if (ytCache.has(k)) return ytCache.get(k);
    const u = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&safeSearch=strict&videoEmbeddable=true&maxResults=12&q=' + encodeURIComponent(q) + '&key=' + encodeURIComponent(YOUTUBE.key);
    const r = await fetch(u); if (!r.ok) return [];
    const d = await r.json();
    const list = (d.items || []).map((it) => ({ id: 'yt-' + it.id.videoId, external: true, kind: 'youtube', ytId: it.id.videoId, text: it.snippet.title, source: it.snippet.channelTitle, channelId: it.snippet.channelId,
      linkUrl: 'https://www.youtube.com/watch?v=' + it.id.videoId, sourceUrl: 'https://www.youtube.com/channel/' + it.snippet.channelId })).filter((v) => /^[\w-]{11}$/.test(v.ytId) && !blockedQuery(v.text));
    ytCache.set(k, list); return list;
  }

  // ------------------------------------------------------------ recent searches (on this device)
  const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => typeof x === 'string'); } catch { return []; } };
  const saveRecent = (q) => { q = q.trim().slice(0, 80); if (!q) return; localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...recent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10))); pushRecent(); };
  const removeRecent = (q) => { localStorage.setItem(RECENT_KEY, JSON.stringify(recent().filter((x) => x !== q))); pushRecent(true); };
  // Signed in: search history is also kept in your private users/{uid}/prefs/search doc (owner-only,
  // max 20, deleted with "Clear all" and with your account) so it follows you across devices.
  let pushT = 0, pulled = '';
  const histRef = () => (S.user ? doc(db, 'users', S.user.uid, 'prefs', 'search') : null);
  function pushRecent(now) {
    const ref = histRef(); if (!ref) return;
    clearTimeout(pushT); pushT = setTimeout(() => { setDoc(ref, { recent: recent().slice(0, 20), updatedAt: serverTimestamp() }).catch(() => {}); }, now ? 0 : 4000);
  }
  async function pullRecent() {
    const ref = histRef(); if (!ref || pulled === S.user.uid) return; pulled = S.user.uid;
    try { const d = await getDoc(ref); if (d.exists()) { const r = (d.data().recent || []).filter((x) => typeof x === 'string'); const mine = recent();
      localStorage.setItem(RECENT_KEY, JSON.stringify([...mine, ...r.filter((x) => !mine.some((m) => m.toLowerCase() === x.toLowerCase()))].slice(0, 10))); } } catch { /* */ }
  }
  function clearRecent() { localStorage.removeItem(RECENT_KEY); const ref = histRef(); if (ref) deleteDoc(ref).catch(() => {}); }

  // ------------------------------------------------------------ trending / suggested
  async function trendingTags(n = 12) {
    const posts = (await safe(recentPosts())) || [];
    const c = new Map();
    posts.filter(visiblePost).forEach((p) => tagsOf(p).forEach((t) => c.set(t, (c.get(t) || 0) + 1)));
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  }
  async function suggestedCreators(n = 8) {
    const [posts, users] = await Promise.all([safe(recentPosts()), safe(recentUsers())]);
    const byId = new Map((users || []).map((u) => [u.uid, u]));
    const order = [STUDIO_UID];
    (posts || []).forEach((p) => { if (!order.includes(p.authorId)) order.push(p.authorId); });
    return order.map((id) => byId.get(id)).filter(Boolean).filter(visibleUser).filter((u) => !S.user || u.uid !== S.user.uid).slice(0, n);
  }
  // Pinned category chips (always shown in Explore) before the trending hashtags.
  const BROWSE = [['funny', '😂 Funny'], ['dance', '💃 Dance'], ['music videos', '🎬 Music videos'], ['songs', '🎶 Songs'], ['gaming', '🎮 Games'], ['pals', '🐾 Pals'], ['animals', '🐶 Animals'], ['movies', '🎞️ Movies'], ['learning', '💡 Learning']];
  const PINNED = [['funny', '😂 Funny'], ['comedy', '🎭 Comedy']];
  const pinnedChips = () => PINNED.map(([t, l]) => `<a class="chip chip-pin" href="#/search?q=${encodeURIComponent('#' + t)}" data-tag="${t}">${l}</a>`).join('');
  const tagChips = (tags) => tags.length
    ? `<div class="chips">${pinnedChips()}${tags.filter(([t]) => !PINNED.some(([p]) => p === String(t).toLowerCase())).map(([t, c]) => `<a class="chip" href="#/search?q=${encodeURIComponent('#' + t)}" data-tag="${esc(t)}">#${esc(t)}<span>${c}</span></a>`).join('')}</div>`
    : `<div class="chips">${pinnedChips()}</div><p class="muted small">Add #tags to your captions to start a trend.</p>`;

  // ------------------------------------------------------------ user rows + follow
  function followBtn(u) {
    if (S.user && u.uid === S.user.uid) return '<span class="muted small">You</span>';
    const on = S.following.has(u.uid);
    return `<button class="btn btn-sm ${on ? 'btn-ghost' : ''} sfollow" data-follow="${esc(u.uid)}" aria-pressed="${on}">${on ? 'Following' : 'Follow'}</button>`;
  }
  const userRow = (u) => `<div class="suser">
      <a class="suser-main" href="#/u/${esc(u.username)}" data-save>${avatar(u, '', false)}
        <span class="meta"><span class="nm"><b class="${adminNameClass(u.uid)}">${esc(faceName(u.uid, u.displayName))}</b>${badge(u.uid)}</span><span class="muted small">@${esc(u.username)} · <span data-fc="${esc(u.uid)}">${followerCounts.has(u.uid) ? fmtFollowers(followerCounts.get(u.uid)) : '– followers'}</span></span></span></a>
      ${followBtn(u)}</div>`;
  const fmtFollowers = (n) => `${fmtCount(n)} follower${n === 1 ? '' : 's'}`;
  const fmtCount = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
  function fillFollowerCounts(root) {
    root.querySelectorAll('[data-fc]').forEach(async (el) => {
      const uid = el.dataset.fc;
      if (!followerCounts.has(uid)) {
        try { followerCounts.set(uid, (await getCountFromServer(query(collection(db, 'follows'), where('followee', '==', uid)))).data().count); }
        catch { return; }
      }
      root.querySelectorAll(`[data-fc="${CSS.escape(uid)}"]`).forEach((x) => (x.textContent = fmtFollowers(followerCounts.get(uid))));
    });
  }
  function wireFollow(root) {
    root.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-follow]'); if (!b) return;
      e.preventDefault();
      if (!requireAuth()) return;
      const uid = b.dataset.follow, on = !S.following.has(uid);
      b.disabled = true;
      try {
        await followUser(uid, on);
        if (followerCounts.has(uid)) followerCounts.set(uid, followerCounts.get(uid) + (on ? 1 : -1));
        root.querySelectorAll(`[data-follow="${CSS.escape(uid)}"]`).forEach((x) => { x.textContent = on ? 'Following' : 'Follow'; x.classList.toggle('btn-ghost', on); x.setAttribute('aria-pressed', on); });
        root.querySelectorAll(`[data-fc="${CSS.escape(uid)}"]`).forEach((x) => { if (followerCounts.has(uid)) x.textContent = fmtFollowers(followerCounts.get(uid)); });
      } catch (err) { toast(friendlyError(err)); }
      b.disabled = false;
    });
  }

  // ------------------------------------------------------------ Explore tab blocks
  async function renderExploreTop(slot, token) {
    slot.innerHTML = `
      <a class="search-launch" href="#/search" data-open-search role="search" aria-label="Search">${SEARCH_ICON}<span>Search videos, music, creators, Pals, #hashtags</span></a>
      <section class="ex-sec"><h2>Trending hashtags</h2><div id="ex-tags"><div class="spinner sm"></div></div></section>
      <section class="ex-sec"><h2>Suggested creators</h2><div id="ex-people" class="people-row"><div class="spinner sm"></div></div></section>`;
    const [tags, people] = await Promise.all([trendingTags(10), suggestedCreators(8)]);
    if (stale(token)) return;
    $('#ex-tags').innerHTML = tagChips(tags);
    $('#ex-people').innerHTML = people.length ? people.map((u) => `<div class="pcard">
        <a href="#/u/${esc(u.username)}">${avatar(u, 'lg', false)}<b class="${adminNameClass(u.uid)}">${esc(faceName(u.uid, u.displayName))}${badge(u.uid)}</b><span class="muted small">@${esc(u.username)}</span></a>
        ${followBtn(u)}</div>`).join('') : '<p class="muted small">No creators yet.</p>';
    wireFollow(slot);
  }

  // ------------------------------------------------------------ full-screen search page
  // Apple Music results via the free iTunes Search API (no key): clean versions only, kid-safe text filter.
  const appleCache = new Map();
  async function appleSearch(q, n) {
    const k = q.toLowerCase() + '|' + n; if (appleCache.has(k)) return appleCache.get(k);
    let out = [];
    try {
      const u = `https://itunes.apple.com/search?term=${encodeURIComponent(q.replace(/^[#@]+/, ''))}&entity=song&limit=${Math.min(50, n * 2)}&explicit=No&country=us&lang=en_us`;
      const d = await (await fetch(u)).json();
      out = (d.results || []).filter((t) => t.previewUrl && t.trackViewUrl && t.trackExplicitness !== 'explicit' && t.collectionExplicitness !== 'explicit' && !blockedQuery(`${t.trackName} ${t.artistName} ${t.collectionName || ''}`))
        .slice(0, n).map((t) => ({ title: t.trackName, artist: t.artistName, art: (t.artworkUrl100 || '').replace('100x100', '120x120'), preview: t.previewUrl, url: t.trackViewUrl }));
    } catch { /* offline or blocked */ }
    appleCache.set(k, out); return out;
  }
  async function render(qs, token) {
    const params = new URLSearchParams(qs || '');
    let q = params.get('q') || '';
    let tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'top';
    document.body.classList.add('search-mode');
    main.innerHTML = `
      <section class="search-page">
        <form class="sbar" id="sform" role="search" action="#">
          <button type="button" class="icon-btn sback" id="sback" aria-label="Back">${IC.back}</button>
          <div class="sinput">${SEARCH_ICON}
            <label for="sq" class="sr-only">Search</label>
            <input id="sq" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" placeholder="Search videos, music, creators, Pals, #hashtags" value="${esc(q)}">
            <button type="button" class="sclear" id="sclear" aria-label="Clear search" ${q ? '' : 'hidden'}>${IC.x}</button>
          </div>
        </form>
        <nav class="stabs" id="stabs" aria-label="Result type" ${q.trim() ? '' : 'hidden'}>${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'active' : ''}" aria-pressed="${k === tab}">${l}</button>`).join('')}</nav>
        <div id="sres" aria-live="polite"></div>
      </section>`;
    const input = $('#sq'), res = $('#sres'), tabs = $('#stabs'), clear = $('#sclear');
    const primer = window.__lksSearchPrimer;
    input.focus({ preventScroll: true });
    if (primer) { primer.remove(); window.__lksSearchPrimer = null; }
    wireFollow(res);
    let timer = 0, seq = 0, last = null;

    const setUrl = () => {
      const p = new URLSearchParams(); if (q.trim()) p.set('q', q.trim()); if (tab !== 'top' && q.trim()) p.set('tab', tab);
      history.replaceState(null, '', '#/search' + (p.toString() ? '?' + p : ''));
    };
    const paintTabs = () => tabs.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on);
      if (on && !tabs.hidden) tabs.scrollTo({ left: Math.max(0, b.offsetLeft - 40), behavior: 'smooth' });
    });

    async function paintEmpty() {
      tabs.hidden = true;
      const rs = recent();
      res.innerHTML = `
        ${rs.length ? `<section class="ssec"><div class="row"><h2>Recent searches</h2><span class="spacer"></span><button class="link-btn small" id="rclear">Clear all</button></div>
          <ul class="recent">${rs.map((r) => `<li><a href="#/search?q=${encodeURIComponent(r)}" data-recent="${esc(r)}">${IC.clock}<span>${esc(r)}</span></a><button class="icon-btn rdel" data-del="${esc(r)}" aria-label="Remove ${esc(r)} from recent searches">${IC.x}</button></li>`).join('')}</ul></section>` : ''}
        <section class="ssec"><h2>Browse</h2><div class="chips">${BROWSE.map(([q2, l]) => `<a class="chip" href="#/search?q=${encodeURIComponent(q2)}" data-recent="${esc(q2)}">${l}</a>`).join('')}<a class="chip chip-pin" href="#/music">🎵 Music</a></div></section>
        <section class="ssec"><h2>Trending searches</h2><div id="s-trend"><div class="spinner sm"></div></div></section>
        <section class="ssec"><h2>Trending hashtags</h2><div id="s-tags"><div class="spinner sm"></div></div></section>
        <section class="ssec"><h2>Suggested creators</h2><div id="s-people"><div class="spinner sm"></div></div></section>`;
      $('#rclear')?.addEventListener('click', () => { clearRecent(); paintEmpty(); });
      trends.top(8).then((t) => { const box = $('#s-trend'); if (!box || q.trim()) return; box.innerHTML = t.length ? `<ul class="recent">${t.map((x) => `<li><a href="#/search?q=${encodeURIComponent(x.q)}" data-recent="${esc(x.q)}">🔥<span>${esc(x.q)}</span></a></li>`).join('')}</ul>` : '<p class="muted small">Popular searches show up here.</p>'; });
      const mySeq = seq;
      const [tags, people] = await Promise.all([trendingTags(12), suggestedCreators(6)]);
      if (stale(token) || mySeq !== seq || q.trim()) return;
      $('#s-tags').innerHTML = tagChips(tags);
      $('#s-people').innerHTML = people.length ? people.map(userRow).join('') : '<p class="muted small">No creators yet.</p>';
      fillFollowerCounts(res);
    }

    function paintResults(r) {
      if (r.blocked) { tabs.hidden = true; res.innerHTML = `<div class="empty sempty sblocked">🌈 <b>${esc(BLOCKED_MSG)}</b></div>`; return; }
      tabs.hidden = false;
      const G = r.groups, kemy = (l) => l.filter((p) => !p.external), out = (l) => l.filter((p) => p.external);
      const grid = (list) => `<div class="pgrid sgrid">${list.map(gridTile).join('')}</div>`;
      const ytRow = (list) => list.length ? `<div class="yt-row">${list.map((v) => ytTile(v, esc)).join('')}</div>` : '';
      const mixed = (list, n) => { const k = kemy(list).slice(0, n), o = out(list).slice(0, n); return (k.length ? grid(k) : '') + ytRow(o); };
      const cat = (list) => `<ul class="scat">${list.map((x) => `<li><a href="${esc(x.href)}" data-cat-item="${esc(x.cat)}"><span class="scat-ic">${x.cover ? `<img src="${esc(x.cover)}" alt="" width="40" height="28" style="width:40px;height:28px;object-fit:cover;border-radius:8px">` : x.kind === 'game' ? '🎮' : x.kind === 'pal' ? '🐾' : esc(x.emoji || '✨')}</span><span><b>${esc(x.name)}</b><span class="muted small">${x.kind === 'game' ? 'Game' : x.kind === 'pal' ? 'Pal species' : 'In Kemy'}</span></span></a></li>`).join('')}</ul>`;
      const seriesHtml = (list) => list.length ? `<div class="wrow">${list.map((x) => seriesTile ? seriesTile(x) : `<a href="#/series/${esc(x.id)}">${esc(x.title)}</a>`).join('')}</div>` : '';
      const tagRows = (list) => `<ul class="stags">${list.map(([t, c]) => `<li><a href="#/search?q=${encodeURIComponent('#' + t)}" data-tagq="${esc(t)}"><span class="hico">${IC.hash}</span><span><b>#${esc(t)}</b><span class="muted small">${c} post${c === 1 ? '' : 's'}</span></span></a></li>`).join('')}</ul>`;
      const none = (what) => `<div class="empty sempty"><b>No ${what} for “${esc(r.q)}”</b><br>Try a different spelling, fewer words, or search a #hashtag.</div>`;
      const sec = (key, title, body, count) => body ? `<section class="ssec"><div class="row"><h2>${title}</h2><span class="spacer"></span>${count > 4 ? `<button class="link-btn small" data-goto="${key}">See all</button>` : ''}</div>${body}</section>` : '';
      const songs = G.music, movies = G.movies, vids = G.videos, mv = G.mvideos;
      const total = r.users.length + r.posts.length + r.tags.length + vids.length + mv.length + songs.length + movies.length + r.series.length + r.games.length + r.pals.length + r.ytMore.length;
      let html = '';
      if (tab === 'top') {
        if (!total) html = none('results');
        else {
          if (r.isTag) html += `<div class="shead"><span class="hico lg">${IC.hash}</span><div><h2>#${esc(r.tag)}</h2><span class="muted small">${r.posts.length} post${r.posts.length === 1 ? '' : 's'}</span></div></div>`;
          html += sec('games', 'In Kemy', r.games.length ? cat(r.games.slice(0, 4)) : '', r.games.length);
          html += sec('creators', 'Creators', r.users.length ? r.users.slice(0, 3).map(userRow).join('') : '', r.users.length);
          html += sec('music', 'Music &amp; Songs', songs.length ? mixed(songs, 6) : '', songs.length);
          html += sec('mvideos', 'Music Videos', mv.length ? mixed(mv, 6) : '', mv.length);
          html += sec('videos', 'Videos', vids.length ? mixed(vids, 6) : '', vids.length);
          html += sec('movies', 'Movies &amp; Series', movies.length || r.series.length ? seriesHtml(r.series.slice(0, 6)) + mixed(movies, 6) : '', movies.length + r.series.length);
          html += sec('pals', 'Pals', r.pals.length ? cat(r.pals.slice(0, 4)) : '', r.pals.length);
          html += sec('hashtags', 'Hashtags', !r.isTag && r.tags.length ? tagRows(r.tags.slice(0, 3)) : '', r.tags.length);
          if (G.posts.length) html += `<section class="ssec"><h2>Posts</h2><div id="s-texts"></div></section>`;
          if (r.ytMore.length) html += `<section class="ssec"><h2>More from YouTube</h2>${ytRow(r.ytMore)}</section>`;
        }
      } else if (tab === 'creators') html = r.users.length ? r.users.map(userRow).join('') : none('creators');
      else if (tab === 'videos') html = vids.length ? mixed(vids, 60) : none('videos');
      else if (tab === 'music') html = songs.length ? mixed(songs, 60) : none('songs');
      else if (tab === 'mvideos') html = mv.length ? mixed(mv, 60) : none('music videos');
      else if (tab === 'movies') html = movies.length || r.series.length ? seriesHtml(r.series) + mixed(movies, 60) : none('movies or series');
      else if (tab === 'pals') html = r.pals.length ? cat(r.pals) : none('Pals');
      else if (tab === 'games') html = r.games.length ? cat(r.games) : none('games');
      else if (tab === 'hashtags') html = r.tags.length ? tagRows(r.tags) : none('hashtags');
      if ((tab === 'top' || tab === 'music') && !r.isTag) html += `<section class="ssec" id="s-apple"><div class="row"><h2>Apple Music previews</h2></div><div class="apple-row"><div class="spinner sm"></div></div></section>`;
      res.innerHTML = html;
      if (res.querySelector('#s-apple')) appleSearch(r.q, tab === 'music' ? 20 : 6).then((list) => {
        const box = res.querySelector('#s-apple .apple-row'); if (!box || !last || last.q !== r.q) return;
        if (!list.length) { res.querySelector('#s-apple').remove(); return; }
        box.innerHTML = list.map((t) => `<div class="apple-item"><img src="${esc(t.art)}" alt="" loading="lazy"><div class="am"><b>${esc(t.title)}</b><small>${esc(t.artist)} · 30-second preview</small>
          <audio controls preload="none" src="${esc(t.preview)}" data-apple-preview></audio></div><a class="am-open" href="${esc(t.url)}" target="_blank" rel="noopener">Open in Apple Music ↗</a></div>`).join('') + '<p class="mx-credit">Previews provided courtesy of Apple Music (iTunes Search).</p>';
        box.querySelectorAll('audio').forEach((a) => {
          a.addEventListener('play', () => { box.querySelectorAll('audio').forEach((o) => o !== a && o.pause()); dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'apple-preview' } })); dispatchEvent(new CustomEvent('kemy:music', { detail: { source: 'apple-preview', state: 'play' } })); });
          a.addEventListener('pause', () => { dispatchEvent(new CustomEvent('kemy:media-stop', { detail: { source: 'apple-preview' } })); dispatchEvent(new CustomEvent('kemy:music', { detail: { source: 'apple-preview', state: 'stop' } })); });
        });
        const off = (e) => { if (e.detail?.source !== 'apple-preview') box.querySelectorAll('audio').forEach((o) => o.pause()); };
        addEventListener('kemy:media-play', off); S.unsubs.push(() => removeEventListener('kemy:media-play', off));
      });
      const tb = $('#s-texts', res);
      if (tb) G.posts.slice(0, 5).forEach((p) => tb.appendChild(postCard(p)));
      fillFollowerCounts(res);
    }
    res.addEventListener('click', (e) => {
      const y = e.target.closest('[data-yt]'); if (!y || !last) return;
      const all = [...(last.groups ? Object.values(last.groups).flat() : []), ...(last.ytMore || [])];
      const v = all.find((x) => x.ytId === y.dataset.yt); if (!v) return;
      saveRecent(q); learnTap(v); import('./music.js').then((m) => m.openYouTube(v, { openModal, esc }));
    });

    async function go(saveIt) {
      clearTimeout(timer);
      const mySeq = ++seq;
      clear.hidden = !q;
      setUrl();
      if (!q.trim() || !words(q.replace(/^[#@]+/, '')).length) { last = null; return paintEmpty(); }
      if (!last || last.q !== q.trim()) res.innerHTML = '<div class="spinner"></div>';
      try {
        const r = await run(q);
        if (stale(token) || mySeq !== seq) return;
        last = r; paintResults(r);
        if (saveIt && !r.blocked) { saveRecent(q); learnSearch(q); trends.count(q); }
      } catch (e) { if (mySeq === seq) res.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
    }
    input.addEventListener('input', () => { q = input.value; clear.hidden = !q; clearTimeout(timer); timer = setTimeout(() => go(false), 300); });
    $('#sform').addEventListener('submit', (e) => { e.preventDefault(); q = input.value; input.blur(); go(true); });
    clear.onclick = () => { input.value = q = ''; input.focus(); go(false); };
    $('#sback').onclick = () => { if (canGoBack()) history.back(); else location.hash = '#/explore'; };
    tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; tab = b.dataset.tab; paintTabs(); setUrl(); if (last) paintResults(last); });
    res.addEventListener('click', (e) => {
      const del = e.target.closest('[data-del]');
      if (del) { e.preventDefault(); removeRecent(del.dataset.del); paintEmpty(); return; }
      const goto = e.target.closest('[data-goto]');
      if (goto) { tab = goto.dataset.goto; paintTabs(); setUrl(); paintResults(last); window.scrollTo(0, 0); return; }
      const rec = e.target.closest('[data-recent]');
      const tg = e.target.closest('[data-tagq], [data-tag]');
      if (rec || tg) {
        e.preventDefault();
        q = rec ? rec.dataset.recent : '#' + (tg.dataset.tagq || tg.dataset.tag);
        input.value = q; tab = 'top'; paintTabs(); go(true); window.scrollTo(0, 0); return;
      }
      const tile = e.target.closest('.gtile, .wtile, .suser-main, .post a, [data-cat-item]');
      if (tile && last) {
        saveRecent(q); learnSearch(q);
        const id = (tile.getAttribute('href') || '').match(/#\/(?:watch|post)\/([\w-]+)/)?.[1];
        const p = id && last.posts.find((x) => x.id === id);
        if (p) learnTap(p);
        else if (tile.dataset.catItem) learnTap({ id: 'cat:' + tile.dataset.catItem, cat: tile.dataset.catItem });
        else { const un = (tile.getAttribute('href') || '').match(/#\/u\/([\w.]+)/)?.[1]; const u = un && last.users.find((x) => x.username === un); if (u) learnTap({ uid: u.uid }); }
      }
    });
    S.unsubs.push(() => { clearTimeout(timer); document.body.classList.remove('search-mode'); });
    pullRecent().then(() => { if (!q.trim() && !stale(token)) paintEmpty(); });
    await go(!!q.trim());
  }

  return { render, renderExploreTop, trendingTags };
}
