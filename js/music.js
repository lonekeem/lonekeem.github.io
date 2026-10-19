// Lone Keem Studios - Music: Lone Keem Studios songs + music videos, Kemy Community Songs and curated,
// family-friendly official music videos from YouTube (data/discover.json, category "music", built from
// public RSS by scripts/discover-fetch.mjs; shown as youtube-nocookie embeds, never re-uploaded).
// Songs play in the persistent mini player (js/works.js), which keeps playing while you browse.
import { loadDiscover } from './discover.js';
import { play as playTheme, stop as stopTheme, isPlaying as themePlaying, THEME_TITLE } from './theme.js';

const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// Tile for a curated outside music video (opens the YouTube player sheet).
export function ytTile(v, esc) {
  return `<button type="button" class="yt-tile" data-yt="${esc(v.ytId)}" aria-label="${esc(v.text)} (YouTube · ${esc(v.source)})">
    <span class="yt-art"><img src="${ytThumb(v.ytId)}" alt="" loading="lazy" decoding="async"><span class="yt-play" aria-hidden="true">▶</span></span>
    <span class="yt-meta"><b>${esc(v.text)}</b><small>From YouTube · ${esc(v.source)}</small></span></button>`;
}
// Full player sheet for a YouTube item. Stops the theme + mini player first (kemy:media-play).
export function openYouTube(v, { openModal, esc, onClose } = {}) {
  window.dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'youtube' } }));
  try { window.__kemyPlayer?.audio?.pause(); } catch { /* */ }
  stopTheme(150);
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.ytId)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button>
    <div class="yt-sheet"><div class="yt-frame${v.short ? ' short' : ''}"><iframe src="${src}" title="${esc(v.text)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
    <h2 style="font-size:1.05rem;margin:10px 0 2px">${esc(v.text)}</h2>
    <p class="muted small" style="margin:0">From YouTube · <a href="${esc(v.sourceUrl || 'https://www.youtube.com')}" target="_blank" rel="noopener">${esc(v.source)}</a> · <a href="${esc(v.linkUrl)}" target="_blank" rel="noopener">Open on YouTube</a></p></div>`);
  onClose && onClose();
}
export function wireYouTube(root, items, ctx) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-yt]'); if (!b) return;
    const v = items.find((x) => x.ytId === b.dataset.yt); if (!v) return;
    e.preventDefault(); ctx.onOpen && ctx.onOpen(v); openYouTube(v, ctx);
  });
}
export async function musicVideos() {
  const d = await loadDiscover();
  return d.videos.filter((v) => v.cat === 'music' || v.channelId === 'UCKE0Xnj818IDaHvIcRiq0Bg'); // + KIDZ BOP (listed under Dance)
}

export function createMusic(ctx) {
  const { S, db, main, esc, openModal, stale, getWorks, gridTile, learnTap, STUDIO_UID } = ctx;
  const { getDocs, collection, query, where, orderBy, limit } = ctx.fs;
  const ms = (p) => p.createdAt?.toMillis?.() || 0;
  async function page(token) {
    main.innerHTML = `<h1 class="page-title">Music</h1>
      <p class="muted" style="margin-top:-6px">Songs and music videos from Lone Keem Studios, the Kemy community and family-friendly music channels. Songs keep playing while you browse.</p>
      <a class="search-launch" href="#/search?q=music" role="search" aria-label="Search music">🔎<span>Search songs, music videos, artists</span></a>
      <section class="card pad mus-theme"><div class="row" style="gap:12px;align-items:center"><button class="btn btn-sm" type="button" id="mus-theme" data-theme-ctl>🎵 Play</button><div><b>Kemy’s theme: ${THEME_TITLE}</b><br><span class="muted small">Written by Lone Keem</span></div></div></section>
      <section class="ex-sec"><div class="row"><h2>Lone Keem Studios</h2></div><div class="wrow" id="mus-studio-songs"><div class="spinner sm"></div></div><div id="mus-studio-vids"></div></section>
      <section class="ex-sec"><div class="row"><h2>Kemy Community Songs</h2><span class="spacer"></span><a class="small" href="#/explore/songs">See all</a></div><div class="wrow" id="mus-songs"><div class="spinner sm"></div></div></section>
      <section class="ex-sec"><div class="row"><h2>Music videos</h2><span class="spacer"></span><span class="muted small">Curated from YouTube</span></div><div class="yt-row" id="mus-yt"><div class="spinner sm"></div></div></section>
      <p class="muted small">Want to share your own song? <a href="#/new/song">Post a song</a> · <a href="#/watch/music">Music in the video feed</a></p>`;
    const tb = main.querySelector('#mus-theme');
    const paint = () => { tb.textContent = themePlaying() ? '⏸ Stop' : '🎵 Play'; };
    tb.onclick = async () => { if (themePlaying()) stopTheme(); else { try { window.__kemyPlayer?.audio?.pause(); } catch { /* */ } await playTheme({ force: true }); } paint(); };
    document.addEventListener('kemy-theme', paint);
    S.unsubs.push(() => document.removeEventListener('kemy-theme', paint));
    const W = getWorks();
    const [studio, songs, yts] = await Promise.all([
      getDocs(query(collection(db, 'posts'), where('authorId', '==', STUDIO_UID), orderBy('createdAt', 'desc'), limit(40))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
      getDocs(query(collection(db, 'posts'), where('type', '==', 'song'), limit(60))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))).catch(() => []),
      musicVideos().catch(() => [])
    ]);
    if (stale(token)) return;
    const ok = (p) => !S.blocked.has(p.authorId);
    const sSongs = studio.filter((p) => p.type === 'song' && W.isWork(p));
    const sVids = studio.filter((p) => p.type !== 'song' && (p.mediaType === 'video' || p.linkUrl || p.type === 'movie'));
    const ss = main.querySelector('#mus-studio-songs');
    if (sSongs.length) { W.grid(ss, sSongs, ''); } else ss.innerHTML = '';
    main.querySelector('#mus-studio-vids').innerHTML = sVids.length ? `<h3 style="font-size:.95rem;margin:12px 0 8px">Music videos</h3><div class="pgrid">${sVids.slice(0, 12).map(gridTile).join('')}</div>` : '';
    if (!sSongs.length && !sVids.length) ss.innerHTML = '<p class="muted small">New music from Lone Keem Studios lands here.</p>';
    const cs = songs.filter((p) => ok(p) && W.isWork(p) && p.authorId !== STUDIO_UID).sort((a, b) => ms(b) - ms(a)).slice(0, 18);
    W.grid(main.querySelector('#mus-songs'), cs, 'No community songs yet. <a href="#/new/song">Be the first</a>.');
    const yr = main.querySelector('#mus-yt');
    const byCh = new Map(); yts.forEach((v) => { if (!byCh.has(v.source)) byCh.set(v.source, []); byCh.get(v.source).push(v); });
    // Interleave channels so one channel doesn't fill the row.
    const mixed = []; let more = true; for (let i = 0; more; i++) { more = false; for (const l of byCh.values()) if (l[i]) { mixed.push(l[i]); more = true; } }
    yr.innerHTML = mixed.length ? mixed.slice(0, 24).map((v) => ytTile(v, esc)).join('') : '<p class="muted small">Music videos are refreshed a few times a day. Check back soon.</p>';
    wireYouTube(yr, mixed, { openModal, esc, onOpen: (v) => learnTap && learnTap(v) });
  }
  return { page };
}
