// Lone Keem Studios - "For You" vertical video feed (TikTok / Reels style).
// One video per screen, CSS scroll-snap, autoplay-in-view via IntersectionObserver.
// Every video post in Firestore shows up here automatically: studio + community uploads
// (mediaType 'video', e.g. Cloudinary H.264 MP4 with a so_1 jpg poster), photo posts
// (mediaType 'image', shown as full-screen image slides), plus any post with a YouTube or
// TikTok link (shown as a poster card with a Watch button, because third-party embeds can't
// autoplay or swipe well).
// All likes / comments / saves / follows go through the shared actions in app.js.

const IC = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.8 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.3 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h12a1 1 0 0 1 1 1v16l-7-4.5-7 4.5v-16a1 1 0 0 1 1-1z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4.5 21 11l-7 6.5V14c-5 0-8.5 1.5-11 5.5 1-5.5 4-10 11-11z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

export function createWatch(ctx) {
  const { S, db, main, STUDIO_UID, esc, $, avatar, badge, timeAgo, toast, friendlyError, openModal, isAdmin, stale,
    isLiked, likePost, savePost, followUser, addComment, deleteComment, reportDialog, youTubeId, tikTokId, commentsQuery,
    blockUser, deletePost, canDeletePost, linkify, SEARCH_ICON } = ctx;
  const { doc, getDoc, getDocs, collection, query, where, limit, onSnapshot } = ctx.fs;
  let muted = true; // stays the same while scrolling between videos
  let session = null;

  const ms = (p) => p.createdAt?.toMillis?.() || 0;
  const fmt = (n) => { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); };
  function kindOf(p) {
    if (p.mediaType === 'video' && p.mediaUrl) return 'video';
    if (p.mediaType === 'image' && p.mediaUrl) return 'image';
    if (p.linkUrl) {
      const yt = youTubeId(p.linkUrl);
      if (yt && /^[\w-]+$/.test(yt)) return 'youtube';
      if (tikTokId(p.linkUrl)) return 'tiktok';
    }
    return '';
  }
  async function loadPosts() {
    const posts = collection(db, 'posts');
    const [v, im, l] = await Promise.all([
      getDocs(query(posts, where('mediaType', '==', 'video'), limit(60))),
      getDocs(query(posts, where('mediaType', '==', 'image'), limit(60))),
      getDocs(query(posts, where('type', '==', 'link'), limit(60)))
    ]);
    const seen = new Map();
    [...v.docs, ...im.docs, ...l.docs].forEach((d) => seen.set(d.id, { id: d.id, ...d.data() }));
    return [...seen.values()].filter((p) => kindOf(p) && !S.blocked.has(p.authorId)).sort((a, b) => ms(b) - ms(a));
  }

  // ------------------------------------------------------------ slide markup
  function slideHtml(p, i) {
    const kind = kindOf(p);
    const mine = S.user && p.authorId === S.user.uid;
    const following = S.following.has(p.authorId);
    let poster = p.poster || p.posterUrl || '';
    if (kind === 'youtube') poster = `https://i.ytimg.com/vi/${youTubeId(p.linkUrl)}/hqdefault.jpg`;
    const media = kind === 'image'
      ? `<img class="vimage" src="${esc(p.mediaUrl)}" alt="${esc(p.text ? p.text.slice(0, 120) : 'Photo by ' + p.authorName)}" ${i > 1 ? 'loading="lazy"' : ''} decoding="async" draggable="false">
         <div class="vfail" hidden><p>This photo couldn’t load.</p></div>`
      : kind === 'video'
      ? `<video class="vvideo" playsinline webkit-playsinline loop muted preload="none" disablepictureinpicture controlslist="nodownload noplaybackrate"
           ${poster ? `poster="${esc(poster)}"` : ''} data-src="${esc(p.mediaUrl)}" aria-label="${esc(p.text || 'Video')}" oncontextmenu="return false;"></video>
         <div class="vstate" aria-hidden="true">${IC.play}</div><div class="vspin" aria-hidden="true"></div>
         <div class="vprogress" aria-hidden="true"><span></span></div>
         <div class="vfail" hidden><p>This video is still processing. It’ll play in a moment…</p></div>`
      : `<div class="vcard">
           ${poster ? `<img class="vthumb" src="${esc(poster)}" alt="" loading="lazy">` : `<div class="vthumb vthumb-tt" aria-hidden="true">TikTok</div>`}
           <button class="btn vwatch" data-a="watch">${IC.play}Watch</button>
           <p class="small vsrc">${kind === 'youtube' ? 'YouTube' : 'TikTok'} video</p>
         </div>
         <div class="vembed" hidden></div>`;
    return `
      <section class="vslide" data-i="${i}" data-id="${esc(p.id)}" data-kind="${kind}" aria-roledescription="${kind === 'image' ? 'photo' : 'video'}" aria-label="${esc(p.authorName)}: ${esc((p.text || '').slice(0, 80))}">
        <div class="vbg" ${poster ? `style="background-image:url('${esc(poster)}')"` : ''} aria-hidden="true"></div>
        ${media}
        <div class="vgrad" aria-hidden="true"></div>
        <div class="vmeta">
          <div class="vcreator">
            ${avatar(p, '', true)}
            <a class="vname" href="#/u/${esc(p.authorUsername)}">${esc(p.authorName)}${badge(p.authorId)}</a>
            ${mine ? '' : `<button class="vfollow ${following ? 'on' : ''}" data-a="follow" data-uid="${esc(p.authorId)}" aria-pressed="${following}">${following ? 'Following' : 'Follow'}</button>`}
          </div>
          ${p.text ? `<p class="vcaption" data-a="more">${linkify(esc(p.text))}</p>` : ''}
          <p class="vsub">@${esc(p.authorUsername)} · ${esc(timeAgo(p.createdAt))}</p>
        </div>
        <div class="vrail">
          <button class="vact like" data-a="like" aria-pressed="false" aria-label="Like">${IC.heart}<span class="n">${fmt(p.likeCount)}</span></button>
          <button class="vact" data-a="comment" aria-label="Comments">${IC.comment}<span class="c">${fmt(p.commentCount)}</span></button>
          <button class="vact save" data-a="save" aria-pressed="${S.saved.has(p.id)}" aria-label="Save">${IC.save}<span>${S.saved.has(p.id) ? 'Saved' : 'Save'}</span></button>
          <button class="vact" data-a="share" aria-label="Share">${IC.share}<span>Share</span></button>
          ${S.user ? `<button class="vact vmore" data-a="menu" aria-label="More options" aria-haspopup="dialog">${IC.more}</button>` : ''}
        </div>
      </section>`;
  }
  function endHtml(count) {
    const following = S.following.has(STUDIO_UID);
    return `
      <section class="vslide vend" data-kind="end" data-i="${count}" aria-label="End of feed">
        <div class="vend-inner">
          <img src="logo.png" alt="Lone Keem Studios KL logo" width="84" height="84">
          <h2>${count ? 'More drops coming soon' : 'Videos are on the way'}</h2>
          <p>${count ? 'You’re all caught up. ' : ''}Follow Lone Keem Studios to catch the next music video and movie the moment it lands.</p>
          <button class="btn vfollow-studio ${following ? 'btn-ghost' : ''}" data-a="follow" data-uid="${STUDIO_UID}" aria-pressed="${following}">${following ? 'Following Lone Keem Studios ✓' : 'Follow Lone Keem Studios'}</button>
          <div class="vend-row">
            ${count ? `<button class="btn btn-ghost btn-sm" data-a="replay">Watch again</button>` : ''}
            <a class="btn btn-ghost btn-sm" href="#/feed">Browse posts</a>
          </div>
          ${count ? `<p class="small muted">${count} post${count === 1 ? '' : 's'} in the feed so far</p>` : ''}
        </div>
      </section>`;
  }

  // ------------------------------------------------------------ sign-in prompt
  function needAuth(postId, what) {
    if (S.user && S.profile) return false;
    if (S.user && !S.profile) { location.hash = '#/onboard'; return true; }
    const next = encodeURIComponent('#/watch' + (postId ? '/' + postId : ''));
    openModal(`
      <button class="icon-btn close" data-close aria-label="Close">✕</button>
      <img class="logo" src="logo.png" alt="Lone Keem Studios KL logo" width="72" height="72">
      <h2 id="signin-title">Sign in to ${esc(what)}</h2>
      <p>Watching is free for everyone. Create a free account to like, comment, save favorites and follow creators.</p>
      <div class="btns">
        <a class="btn" href="#/signup" data-close>Create account</a>
        <a class="btn btn-ghost" href="#/login?next=${next}" data-close>Log in</a>
      </div>`);
    document.querySelector('.modal-backdrop')?.classList.add('signin-prompt');
    return true;
  }

  // ------------------------------------------------------------ main render
  async function render(postId, token) {
    const posts = await loadPosts();
    if (stale(token)) return;
    let startId = postId || '';
    if (postId && !posts.some((p) => p.id === postId)) {
      const snap = await getDoc(doc(db, 'posts', postId));
      if (stale(token)) return;
      if (snap.exists()) {
        const p = { id: snap.id, ...snap.data() };
        if (!kindOf(p)) { location.replace('#/post/' + postId); return; }
        posts.unshift(p);
      } else { toast('That video isn’t available anymore.'); startId = ''; }
    }

    main.innerHTML = `
      <a class="vhome" href="index.html" aria-label="Lone Keem Studios home page"><img src="logo.png" alt="" width="34" height="34"><span>Lone Keem Studios</span></a>
      <div class="vwrap" id="vwrap">
        <div class="vtop">
          <nav class="feed-toggle on-video" aria-label="Feed"><a href="#/watch" class="active" aria-current="page">For You</a><a href="#/feed">Posts</a></nav>
          <button class="vmute" id="vmute" aria-pressed="true" aria-label="Unmute"></button>
          <a class="vsearch" href="#/search" data-open-search aria-label="Search">${SEARCH_ICON}</a>
          <button class="vunmute-hint" id="vunmute-hint" tabindex="-1" aria-hidden="true"></button>
        </div>
        <div class="vfeed" id="vfeed" tabindex="-1" aria-label="Video feed. Swipe up or press the down arrow for the next video.">
          ${posts.map(slideHtml).join('')}${endHtml(posts.length)}
        </div>
        <div class="vsheet-root" id="vsheet-root"></div>
      </div>`;

    const feed = $('#vfeed'), wrap = $('#vwrap'), muteBtn = $('#vmute'), hint = $('#vunmute-hint'), sheetRoot = $('#vsheet-root');
    const slides = [...feed.querySelectorAll('.vslide')];
    const byId = new Map(posts.map((p) => [p.id, p]));
    let active = -1, sheetUnsub = null;

    const paintMute = () => {
      muteBtn.innerHTML = muted ? IC.muted : IC.sound;
      muteBtn.classList.toggle('is-muted', muted);
      hint.innerHTML = `${IC.muted}<span>Tap to unmute</span>`;
      hint.hidden = !muted;
      muteBtn.setAttribute('aria-pressed', muted);
      muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    };
    paintMute();
    const vid = (i) => slides[i]?.querySelector('video');
    function playActive() {
      const v = vid(active); if (!v) return;
      if (!v.getAttribute('src')) { v.src = v.dataset.src; v.preload = 'auto'; }
      v.muted = muted;
      const sl = slides[active];
      v.play().then(() => sl.classList.remove('paused')).catch(() => {
        if (!v.muted) { muted = true; v.muted = true; paintMute(); v.play().then(() => sl.classList.remove('paused')).catch(() => sl.classList.add('paused')); }
        else sl.classList.add('paused');
      });
    }
    function closeEmbed(sl) {
      const box = sl?.querySelector('.vembed'); if (!box || box.hidden) return;
      box.innerHTML = ''; box.hidden = true; sl.querySelector('.vcard').hidden = false;
    }
    function activate(i) {
      if (i === active) return;
      const prev = slides[active];
      if (prev) { vid(active)?.pause(); closeEmbed(prev); }
      active = i;
      wrap.dataset.kind = slides[i].dataset.kind || '';
      // Preload only the current and the next video; free anything far away.
      slides.forEach((sl, j) => {
        const v = sl.querySelector('video'); if (!v) return;
        if (j === i || j === i + 1) { if (!v.getAttribute('src')) { v.preload = 'auto'; v.src = v.dataset.src; } }
        else {
          v.pause();
          if (Math.abs(j - i) > 2 && v.getAttribute('src')) { v.removeAttribute('src'); v.preload = 'none'; v.load(); }
        }
      });
      const id = slides[i].dataset.id;
      if (id && location.hash.startsWith('#/watch')) history.replaceState(null, '', '#/watch/' + id);
      playActive();
    }

    // Autoplay the slide that is (mostly) on screen; pause the rest.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) activate(+e.target.dataset.i);
        else if (!e.isIntersecting) { const v = e.target.querySelector('video'); if (v && !v.paused) v.pause(); }
      });
    }, { root: feed, threshold: [0, 0.6] });

    // Per-video events: progress bar, buffering spinner, fit (cover when the shape matches the screen).
    slides.forEach((sl) => {
      const v = sl.querySelector('video'); if (!v) return;
      const bar = sl.querySelector('.vprogress span');
      v.addEventListener('timeupdate', () => { if (v.duration) bar.style.transform = `scaleX(${v.currentTime / v.duration})`; });
      v.addEventListener('waiting', () => sl.classList.add('loading'));
      v.addEventListener('playing', () => { sl.classList.remove('loading'); sl.classList.remove('paused'); });
      v.addEventListener('canplay', () => sl.classList.remove('loading'));
      v.addEventListener('loadedmetadata', () => {
        const vr = v.videoWidth / v.videoHeight, sr = sl.clientWidth / sl.clientHeight;
        sl.classList.toggle('fit-cover', Math.abs(vr - sr) / sr < 0.2);
      });
      v.addEventListener('click', () => {
        if (v.paused) { v.muted = muted; v.play().catch(() => {}); sl.classList.remove('paused'); }
        else { v.pause(); sl.classList.add('paused'); }
      });
    });

    // Photos: cover the screen when the shape is close to the screen's, otherwise letterbox.
    slides.forEach((sl) => {
      const img = sl.querySelector('.vimage'); if (!img) return;
      const fit = () => { const r = img.naturalWidth / img.naturalHeight, sr = sl.clientWidth / sl.clientHeight; sl.classList.toggle('fit-cover', Math.abs(r - sr) / sr < 0.2); };
      if (img.complete && img.naturalWidth) fit(); else img.addEventListener('load', fit);
      img.addEventListener('error', () => { sl.querySelector('.vfail').hidden = false; });
    });
    // Fresh Cloudinary uploads: the eager H.264 version can take a moment; retry a few times.
    slides.forEach((sl) => {
      const v = sl.querySelector('video'); if (!v) return;
      let tries = 0;
      v.addEventListener('error', () => {
        if (!v.getAttribute('src') || !/res\.cloudinary\.com/.test(v.dataset.src) || tries >= 6) return;
        tries++; sl.querySelector('.vfail').hidden = false;
        setTimeout(() => {
          if (!v.getAttribute('src')) return;
          v.src = v.dataset.src + (v.dataset.src.includes('?') ? '&' : '?') + 'r=' + tries; v.load();
          if (slides[active] === sl) playActive();
        }, 6000);
      });
      v.addEventListener('playing', () => { sl.querySelector('.vfail').hidden = true; });
    });

    // Likes: show the current user's state.
    posts.forEach((p, i) => isLiked(p.id).then((on) => paintLike(slides[i], on)).catch(() => {}));
    function paintLike(sl, on) { const b = sl.querySelector('[data-a=like]'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Unlike' : 'Like'); }
    function paintSave(sl, on) { const b = sl.querySelector('[data-a=save]'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.querySelector('span').textContent = on ? 'Saved' : 'Save'; }
    function paintFollow(uid, on) {
      feed.querySelectorAll(`[data-a=follow][data-uid="${CSS.escape(uid)}"]`).forEach((b) => {
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
        if (b.classList.contains('vfollow-studio')) { b.classList.toggle('btn-ghost', on); b.textContent = on ? 'Following Lone Keem Studios ✓' : 'Follow Lone Keem Studios'; }
        else b.textContent = on ? 'Following' : 'Follow';
      });
    }
    posts.forEach((p, i) => paintSave(slides[i], S.saved.has(p.id)));

    // One delegated handler for every overlay button.
    feed.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-a]'); if (!btn) return;
      const sl = btn.closest('.vslide'); const p = byId.get(sl?.dataset.id);
      const a = btn.dataset.a;
      if (a === 'more') { if (!ev.target.closest('a')) btn.classList.toggle('open'); return; }
      if (a === 'replay') { slides[0].scrollIntoView({ behavior: 'smooth' }); return; }
      if (a === 'share') return share(p);
      if (a === 'comment') return openComments(p, sl);
      if (a === 'watch') return openEmbed(p, sl);
      if (a === 'menu') return openMenu(p, sl);
      if (a === 'like') {
        if (needAuth(p.id, 'like videos')) return;
        const on = !btn.classList.contains('on'); const n = btn.querySelector('.n');
        const cur = Number(p.likeCount) || 0;
        paintLike(sl, on); p.likeCount = Math.max(0, cur + (on ? 1 : -1)); n.textContent = fmt(p.likeCount); btn.disabled = true;
        if (on) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
        try { await likePost(p, on); } catch (e) { paintLike(sl, !on); p.likeCount = cur; n.textContent = fmt(cur); toast(friendlyError(e)); }
        btn.disabled = false; return;
      }
      if (a === 'save') {
        if (needAuth(p.id, 'save videos')) return;
        const on = !S.saved.has(p.id); paintSave(sl, on);
        try { await savePost(p.id, on); toast(on ? 'Saved to your profile' : 'Removed from saved'); }
        catch (e) { paintSave(sl, !on); toast(friendlyError(e)); }
        return;
      }
      if (a === 'follow') {
        const uid = btn.dataset.uid;
        if (needAuth(p?.id || '', 'follow creators')) return;
        const on = !S.following.has(uid); paintFollow(uid, on); btn.disabled = true;
        try { await followUser(uid, on); toast(on ? 'Following' : 'Unfollowed'); }
        catch (e) { paintFollow(uid, !on); toast(friendlyError(e)); }
        btn.disabled = false;
      }
    });

    hint.onclick = () => muteBtn.click();
    muteBtn.onclick = () => {
      muted = !muted; paintMute();
      const v = vid(active);
      if (v) { v.muted = muted; if (v.paused) playActive(); }
    };

    async function share(p) {
      const url = location.origin + location.pathname + '#/watch/' + p.id;
      if (navigator.share) {
        try { await navigator.share({ title: `${p.authorName} on Lone Keem Studios`, text: (p.text || '').slice(0, 120), url }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(url); toast('Link copied'); }
      catch { prompt('Copy this link:', url); }
    }

    function openEmbed(p, sl) {
      const box = sl.querySelector('.vembed'); const kind = sl.dataset.kind;
      const src = kind === 'youtube'
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youTubeId(p.linkUrl))}?autoplay=1&playsinline=1&rel=0`
        : `https://www.tiktok.com/player/v1/${encodeURIComponent(tikTokId(p.linkUrl))}?autoplay=1&rel=0`;
      box.innerHTML = `<button class="vembed-close" data-a="close-embed" aria-label="Close player">${IC.close}</button>
        <div class="vembed-frame ${kind === 'tiktok' || p.linkUrl.includes('/shorts/') ? 'tall' : ''}"><iframe src="${esc(src)}" title="${kind === 'youtube' ? 'YouTube' : 'TikTok'} video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
      box.hidden = false; sl.querySelector('.vcard').hidden = true;
      box.querySelector('.vembed-close').onclick = (e) => { e.stopPropagation(); closeEmbed(sl); };
    }

    // ---------------------------------------------------------- more menu (copy / report / block / delete)
    function openMenu(p, sl) {
      closeSheet();
      const mine = S.user && p.authorId === S.user.uid;
      sheetRoot.innerHTML = `
        <div class="vsheet-backdrop" data-close-sheet></div>
        <section class="vsheet vmenu" role="dialog" aria-modal="true" aria-label="Post options">
          <div class="vsheet-grab" aria-hidden="true"></div>
          <button data-m="copy">Copy link</button>
          <button data-m="open">Open post page</button>
          ${S.user && !mine ? '<button data-m="report">Report post</button>' : ''}
          ${S.user && !mine && p.authorId !== STUDIO_UID ? `<button data-m="block" class="danger">Block @${esc(p.authorUsername)}</button>` : ''}
          ${canDeletePost(p) ? '<button data-m="delete" class="danger">Delete post</button>' : ''}
          <button data-close-sheet class="vmenu-cancel">Cancel</button>
        </section>`;
      requestAnimationFrame(() => sheetRoot.classList.add('open'));
      sheetRoot.querySelectorAll('[data-close-sheet]').forEach((b) => (b.onclick = closeSheet));
      sheetRoot.querySelector('.vmenu').addEventListener('click', async (e) => {
        const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
        closeSheet();
        if (m === 'copy') {
          const url = location.origin + location.pathname + '#/watch/' + p.id;
          try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link:', url); }
        }
        if (m === 'open') location.hash = '#/post/' + p.id;
        if (m === 'report') reportDialog('post', p.id, p.id, p.text || (p.mediaType ? p.mediaType + ' post' : ''));
        if (m === 'block') blockUser(p.authorId, p.authorUsername);
        if (m === 'delete') {
          if (!confirm('Delete this post? This can’t be undone.')) return;
          try {
            await deletePost(p); toast('Post deleted');
            const v = sl.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
            sl.classList.add('vremoved');
            sl.innerHTML = '<div class="vend-inner"><h2>Post deleted</h2><p>Swipe for the next one.</p></div>';
          } catch (err) { toast(friendlyError(err)); }
        }
      });
    }

    // ---------------------------------------------------------- comment bottom sheet
    function closeSheet() {
      if (sheetUnsub) { sheetUnsub(); sheetUnsub = null; }
      const s = sheetRoot.querySelector('.vsheet');
      if (!s) return;
      sheetRoot.classList.remove('open');
      setTimeout(() => { if (!sheetRoot.classList.contains('open')) sheetRoot.innerHTML = ''; }, 220);
    }
    function openComments(p, sl) {
      closeSheet();
      const signedIn = S.user && S.profile;
      sheetRoot.innerHTML = `
        <div class="vsheet-backdrop" data-close-sheet></div>
        <section class="vsheet" role="dialog" aria-modal="true" aria-labelledby="vsheet-title">
          <div class="vsheet-grab" aria-hidden="true"></div>
          <header><h2 id="vsheet-title"><span class="vsc">${fmt(p.commentCount)}</span> <span class="vsw">${Number(p.commentCount) === 1 ? 'comment' : 'comments'}</span></h2>
            <button class="icon-btn" data-close-sheet aria-label="Close comments">${IC.close}</button></header>
          <div class="vsheet-list" id="vsheet-list"><div class="spinner"></div></div>
          ${signedIn
            ? `<form class="comment-form vsheet-form" id="vsheet-form"><label for="vsheet-text" class="sr-only">Add a comment</label><input id="vsheet-text" type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off" required><button class="btn btn-sm" type="submit">Send</button></form><p class="form-error" id="vsheet-err"></p>`
            : `<div class="vsheet-signin"><p class="small">Sign in to join the conversation.</p><a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/watch/' + p.id)}">Log in</a><a class="btn btn-sm btn-ghost" href="#/signup">Sign up</a></div>`}
        </section>`;
      requestAnimationFrame(() => sheetRoot.classList.add('open'));
      sheetRoot.querySelectorAll('[data-close-sheet]').forEach((b) => (b.onclick = closeSheet));
      sheetUnsub = onSnapshot(commentsQuery(p.id), (qs) => {
        const box = sheetRoot.querySelector('#vsheet-list'); if (!box) return;
        const list = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !S.blocked.has(c.authorId));
        p.commentCount = qs.size;
        sheetRoot.querySelector('.vsc').textContent = fmt(qs.size);
        sheetRoot.querySelector('.vsw').textContent = qs.size === 1 ? 'comment' : 'comments';
        sl.querySelector('[data-a=comment] .c').textContent = fmt(qs.size);
        box.innerHTML = list.length ? '' : '<p class="muted small center" style="margin:28px 0">No comments yet. Be the first!</p>';
        list.forEach((c) => {
          const canDelete = S.user && (c.authorId === S.user.uid || isAdmin() || p.authorId === S.user.uid);
          const row = document.createElement('div'); row.className = 'comment';
          row.innerHTML = `${avatar({ uid: c.authorId, displayName: c.authorName, username: c.authorUsername, color: c.authorColor }, 'sm')}
            <div class="body"><div><a style="font-weight:600;color:var(--text);text-decoration:none" href="#/u/${esc(c.authorUsername)}">${esc(c.authorName)}</a>${badge(c.authorId)} <span class="muted small">${esc(timeAgo(c.createdAt))}</span></div>
            <div class="text">${linkify(esc(c.text))}</div>
            <div class="small">${S.user && c.authorId !== S.user.uid ? '<button class="link-btn small" data-c="report">Report</button>' : ''} ${canDelete ? '<button class="link-btn small" data-c="del" style="color:#ffb3c1;margin-left:10px">Delete</button>' : ''}</div></div>`;
          row.onclick = async (e) => {
            const a = e.target.dataset.c;
            if (a === 'report') reportDialog('comment', c.id, p.id, c.text);
            if (a === 'del' && confirm('Delete this comment?')) {
              try { await deleteComment(p.id, c.id); toast('Comment deleted'); } catch (err) { toast(friendlyError(err)); }
            }
          };
          box.appendChild(row);
        });
      }, (e) => { const box = sheetRoot.querySelector('#vsheet-list'); if (box) box.innerHTML = `<p class="muted small">${esc(friendlyError(e))}</p>`; });
      const form = sheetRoot.querySelector('#vsheet-form');
      if (form) form.onsubmit = async (ev) => {
        ev.preventDefault();
        const input = form.querySelector('input'); const text = input.value.trim(); if (!text) return;
        const err = sheetRoot.querySelector('#vsheet-err'); err.textContent = '';
        const b = form.querySelector('button'); b.disabled = true;
        try { await addComment(p, text); input.value = ''; }
        catch (e) { err.textContent = e.code === 'permission-denied' ? 'Please wait a few seconds between comments.' : friendlyError(e); }
        b.disabled = false;
      };
    }

    // ---------------------------------------------------------- keyboard
    const go = (d) => { const t = slides[Math.min(slides.length - 1, Math.max(0, active + d))]; t?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    const onKey = (e) => {
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.modal-backdrop') || sheetRoot.classList.contains('open')) return;
      if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === ' ' && !e.target.closest?.('button, a')) { e.preventDefault(); vid(active)?.click(); }
      else if (e.key === 'm') muteBtn.click();
    };
    document.addEventListener('keydown', onKey);
    const onVis = () => { if (document.hidden) vid(active)?.pause(); else if (active >= 0 && !sheetRoot.classList.contains('open')) playActive(); };
    document.addEventListener('visibilitychange', onVis);

    // Start at the deep-linked video (if any), then begin observing.
    const startIndex = Math.max(0, startId ? posts.findIndex((p) => p.id === startId) : 0);
    feed.scrollTop = startIndex * feed.clientHeight;
    slides.forEach((sl) => io.observe(sl));
    feed.focus({ preventScroll: true });
    session = { wrap };

    S.unsubs.push(() => {
      io.disconnect();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      if (sheetUnsub) sheetUnsub();
      slides.forEach((sl) => { const v = sl.querySelector('video'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); } });
      session = null;
    });
  }

  return { render, get active() { return session; } };
}
