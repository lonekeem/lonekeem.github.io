// Lone Keem Studios - search (people, videos, photos, posts, hashtags).
// Free-plan friendly: indexed Firestore queries (username / displayNameLower prefix ranges,
// keywords / hashtags array-contains) merged with a client-side scan of the newest posts and
// profiles, so content that hasn't been re-indexed yet is still found in a small community.
import { fold, words, parseHashtags } from './search-index.js';
import { ICONS } from './icons.js';

const RECENT_KEY = 'lks-recent-searches';
const TABS = [['top', 'Top'], ['users', 'Users'], ['videos', 'Videos'], ['photos', 'Photos'], ['posts', 'Posts'], ['hashtags', 'Hashtags']];
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
  const { doc, getDocs, collection, query, where, orderBy, limit, getCountFromServer } = ctx.fs;
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
  const allMatch = (terms, list) => terms.every((t) => list.some((w) => w.startsWith(t)));
  const visibleUser = (u) => u && !S.blocked.has(u.uid);
  const visiblePost = (p) => p && !S.blocked.has(p.authorId);
  const ms = (p) => p.createdAt?.toMillis?.() || 0;
  const safe = (pr) => pr.catch((e) => { console.warn('search query', e.code || e.message); return null; });

  async function run(raw) {
    const q = raw.trim();
    const isTag = q.startsWith('#'), isUser = q.startsWith('@');
    const terms = words(q.replace(/^[#@]+/, ''));
    if (!terms.length) return null;
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
    const postList = [...pm.values()].filter(visiblePost).filter((p) => isTag ? tagsOf(p).includes(tag) : isUser ? allMatch(terms, [fold(p.authorUsername), ...words(p.authorUsername)]) : allMatch(terms, hay(p)))
      .sort((a, b) => ms(b) - ms(a));
    // hashtags (from everything we've seen)
    const counts = new Map();
    [...pm.values()].filter(visiblePost).forEach((p) => tagsOf(p).forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    const tagNeedle = isTag ? tag : longest;
    const tagList = [...counts.entries()].filter(([t]) => t.startsWith(tagNeedle)).sort((a, b) => (b[0] === tagNeedle) - (a[0] === tagNeedle) || b[1] - a[1]).slice(0, 30);
    return { q, isTag, tag, users: isTag ? [] : userList.slice(0, 30), posts: postList, tags: tagList };
  }

  // ------------------------------------------------------------ recent searches (on this device)
  const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((x) => typeof x === 'string'); } catch { return []; } };
  const saveRecent = (q) => { q = q.trim().slice(0, 80); if (!q) return; localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...recent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 10))); };
  const removeRecent = (q) => localStorage.setItem(RECENT_KEY, JSON.stringify(recent().filter((x) => x !== q)));

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
  const tagChips = (tags) => tags.length
    ? `<div class="chips">${tags.map(([t, c]) => `<a class="chip" href="#/search?q=${encodeURIComponent('#' + t)}" data-tag="${esc(t)}">#${esc(t)}<span>${c}</span></a>`).join('')}</div>`
    : '<p class="muted small">No hashtags yet. Add #tags to your captions to start a trend.</p>';

  // ------------------------------------------------------------ user rows + follow
  function followBtn(u) {
    if (S.user && u.uid === S.user.uid) return '<span class="muted small">You</span>';
    const on = S.following.has(u.uid);
    return `<button class="btn btn-sm ${on ? 'btn-ghost' : ''} sfollow" data-follow="${esc(u.uid)}" aria-pressed="${on}">${on ? 'Following' : 'Follow'}</button>`;
  }
  const userRow = (u) => `<div class="suser">
      <a class="suser-main" href="#/u/${esc(u.username)}" data-save>${avatar(u, '', false)}
        <span class="meta"><span class="nm"><b>${esc(u.displayName)}</b>${badge(u.uid)}</span><span class="muted small">@${esc(u.username)} · <span data-fc="${esc(u.uid)}">${followerCounts.has(u.uid) ? fmtFollowers(followerCounts.get(u.uid)) : '– followers'}</span></span></span></a>
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
      <a class="search-launch" href="#/search" data-open-search role="search" aria-label="Search">${SEARCH_ICON}<span>Search people, videos, #hashtags</span></a>
      <section class="ex-sec"><h2>Trending hashtags</h2><div id="ex-tags"><div class="spinner sm"></div></div></section>
      <section class="ex-sec"><h2>Suggested creators</h2><div id="ex-people" class="people-row"><div class="spinner sm"></div></div></section>`;
    const [tags, people] = await Promise.all([trendingTags(10), suggestedCreators(8)]);
    if (stale(token)) return;
    $('#ex-tags').innerHTML = tagChips(tags);
    $('#ex-people').innerHTML = people.length ? people.map((u) => `<div class="pcard">
        <a href="#/u/${esc(u.username)}">${avatar(u, 'lg', false)}<b>${esc(u.displayName)}${badge(u.uid)}</b><span class="muted small">@${esc(u.username)}</span></a>
        ${followBtn(u)}</div>`).join('') : '<p class="muted small">No creators yet.</p>';
    wireFollow(slot);
  }

  // ------------------------------------------------------------ full-screen search page
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
            <input id="sq" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="80" placeholder="Search people, videos, #hashtags" value="${esc(q)}">
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
        <section class="ssec"><h2>Trending hashtags</h2><div id="s-tags"><div class="spinner sm"></div></div></section>
        <section class="ssec"><h2>Suggested creators</h2><div id="s-people"><div class="spinner sm"></div></div></section>`;
      $('#rclear')?.addEventListener('click', () => { localStorage.removeItem(RECENT_KEY); paintEmpty(); });
      const mySeq = seq;
      const [tags, people] = await Promise.all([trendingTags(12), suggestedCreators(6)]);
      if (stale(token) || mySeq !== seq || q.trim()) return;
      $('#s-tags').innerHTML = tagChips(tags);
      $('#s-people').innerHTML = people.length ? people.map(userRow).join('') : '<p class="muted small">No creators yet.</p>';
      fillFollowerCounts(res);
    }

    function paintResults(r) {
      tabs.hidden = false;
      const vids = r.posts.filter((p) => kindOfPost(p, youTubeId, tikTokId) === 'video');
      const pics = r.posts.filter((p) => kindOfPost(p, youTubeId, tikTokId) === 'image');
      const texts = r.posts.filter((p) => kindOfPost(p, youTubeId, tikTokId) === 'text');
      const media = r.posts.filter((p) => kindOfPost(p, youTubeId, tikTokId) !== 'text');
      const grid = (list) => `<div class="pgrid sgrid">${list.map(gridTile).join('')}</div>`;
      const tagRows = (list) => `<ul class="stags">${list.map(([t, c]) => `<li><a href="#/search?q=${encodeURIComponent('#' + t)}" data-tagq="${esc(t)}"><span class="hico">${IC.hash}</span><span><b>#${esc(t)}</b><span class="muted small">${c} post${c === 1 ? '' : 's'}</span></span></a></li>`).join('')}</ul>`;
      const none = (what) => `<div class="empty sempty"><b>No ${what} for “${esc(r.q)}”</b><br>Try a different spelling, fewer words, or search a #hashtag.</div>`;
      let html = '';
      if (tab === 'top') {
        if (!r.users.length && !r.posts.length && !r.tags.length) html = none('results');
        else {
          if (r.isTag) html += `<div class="shead"><span class="hico lg">${IC.hash}</span><div><h2>#${esc(r.tag)}</h2><span class="muted small">${r.posts.length} post${r.posts.length === 1 ? '' : 's'}</span></div></div>`;
          if (r.users.length) html += `<section class="ssec"><div class="row"><h2>Users</h2><span class="spacer"></span>${r.users.length > 3 ? '<button class="link-btn small" data-goto="users">See all</button>' : ''}</div>${r.users.slice(0, 3).map(userRow).join('')}</section>`;
          if (!r.isTag && r.tags.length) html += `<section class="ssec"><div class="row"><h2>Hashtags</h2><span class="spacer"></span>${r.tags.length > 3 ? '<button class="link-btn small" data-goto="hashtags">See all</button>' : ''}</div>${tagRows(r.tags.slice(0, 3))}</section>`;
          if (media.length) html += `<section class="ssec"><h2>Videos &amp; photos</h2>${grid(media.slice(0, 12))}</section>`;
          if (texts.length) html += `<section class="ssec"><h2>Posts</h2><div id="s-texts"></div></section>`;
        }
      } else if (tab === 'users') html = r.users.length ? r.users.map(userRow).join('') : none('people');
      else if (tab === 'videos') html = vids.length ? grid(vids) : none('videos');
      else if (tab === 'photos') html = pics.length ? grid(pics) : none('photos');
      else if (tab === 'posts') html = texts.length ? '<div id="s-texts"></div>' : none('posts');
      else if (tab === 'hashtags') html = r.tags.length ? tagRows(r.tags) : none('hashtags');
      res.innerHTML = html;
      const tb = $('#s-texts', res);
      if (tb) (tab === 'top' ? texts.slice(0, 5) : texts).forEach((p) => tb.appendChild(postCard(p)));
      fillFollowerCounts(res);
    }

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
        if (saveIt) saveRecent(q);
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
      if (e.target.closest('.gtile, .suser-main, .post a')) saveRecent(q);
    });
    S.unsubs.push(() => { clearTimeout(timer); document.body.classList.remove('search-mode'); });
    await go(!!q.trim());
  }

  return { render, renderExploreTop, trendingTags };
}
