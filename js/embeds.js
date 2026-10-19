// Apple Music + Spotify official embeds (no keys). Apple: embed.music.apple.com (full songs for signed-in
// subscribers, previews for everyone else). Spotify: open.spotify.com/embed (full tracks for logged-in users,
// previews otherwise). Neither is re-hosted. Media events: kemy:media-play / kemy:media-stop + kemy:music.
export function appleEmbed(url) {
  let u; try { u = new URL(String(url).trim()); } catch { return null; }
  if (!/^(embed\.)?music\.apple\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([a-z]{2})\/(album|playlist|song|station|music-video)\/[^/]*\/?([^/]*)/i) || u.pathname.match(/^\/([a-z]{2})\/(album|playlist|song)\/([^/]+)/i);
  if (!m) return null;
  const kind = u.searchParams.get('i') ? 'song' : m[2].toLowerCase();
  return { service: 'apple', kind, src: 'https://embed.music.apple.com' + u.pathname + (u.search || ''), url: 'https://music.apple.com' + u.pathname + (u.search || ''), height: kind === 'song' ? 175 : 450 };
}
export function spotifyEmbed(url) {
  let u; try { u = new URL(String(url).trim()); } catch { return null; }
  if (u.hostname !== 'open.spotify.com') return null;
  const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,40})/);
  if (!m) return null;
  return { service: 'spotify', kind: m[1], id: m[2], uri: `spotify:${m[1]}:${m[2]}`, src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator`, url: `https://open.spotify.com/${m[1]}/${m[2]}`, height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352 };
}
export const musicEmbed = (url) => appleEmbed(url) || spotifyEmbed(url);
export const MUSIC_LINK_RE = /https:\/\/(?:embed\.)?music\.apple\.com\/[^\s<>"']+|https:\/\/open\.spotify\.com\/[^\s<>"']+/i;
export function findMusicLink(text) { const m = String(text || '').match(MUSIC_LINK_RE); return m ? musicEmbed(m[0]) : null; }

const fire = (state, detail) => {
  if (state === 'play') dispatchEvent(new CustomEvent('kemy:media-play', { detail }));
  else dispatchEvent(new CustomEvent('kemy:media-stop', { detail }));
  dispatchEvent(new CustomEvent('kemy:music', { detail: { ...detail, state } }));
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Spotify iFrame API (public, no key) reports play/pause; loaded once on first need.
let spP = null;
function spotifyApi() {
  if (window.__kemySpotifyApi) return Promise.resolve(window.__kemySpotifyApi);
  if (spP) return spP;
  spP = new Promise((res, rej) => {
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (api) => { window.__kemySpotifyApi = api; try { prev && prev(api); } catch { /* */ } res(api); };
    const s = document.createElement('script'); s.src = 'https://open.spotify.com/embed/iframe-api/v1'; s.async = true;
    s.onerror = () => { spP = null; rej(new Error('spotify api')); }; document.head.appendChild(s);
    setTimeout(() => rej(new Error('timeout')), 8000);
  });
  return spP;
}

// Mount an embed into `box`. Returns { destroy }. source tags the media events (e.g. 'apple-music').
export function mountMusicEmbed(box, e, { source } = {}) {
  const src = source || (e.service === 'apple' ? 'apple-music' : 'spotify');
  const credit = e.service === 'apple'
    ? `<p class="mx-credit">Plays with Apple Music · <a href="${esc(e.url)}" target="_blank" rel="noopener">Open in Apple Music ↗</a> · full songs for subscribers, previews for everyone</p>`
    : `<p class="mx-credit">Plays with Spotify · <a href="${esc(e.url)}" target="_blank" rel="noopener">Open in Spotify ↗</a> · previews unless you’re logged in to Spotify</p>`;
  let playing = false, ctrl = null, dead = false;
  if (e.service === 'apple') {
    box.innerHTML = `<div class="mx-embed apple"><iframe src="${esc(e.src)}" height="${e.height}" title="Apple Music player" allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-agent allow-top-navigation-by-user-activation" loading="lazy"></iframe></div>${credit}`;
    playing = true; fire('play', { source: src, service: 'apple' });   // Apple's embed can't report state: opening counts as play
  } else {
    box.innerHTML = `<div class="mx-embed spotify"><div class="mx-sp"><iframe src="${esc(e.src)}" height="${e.height}" title="Spotify player" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div></div>${credit}`;
    spotifyApi().then((api) => {
      if (dead) return; const host = box.querySelector('.mx-sp'); if (!host) return;
      host.innerHTML = '<div></div>';
      api.createController(host.firstChild, { uri: e.uri, width: '100%', height: e.height }, (c) => {
        ctrl = c; if (dead) { try { c.destroy(); } catch { /* */ } return; }
        c.addListener('playback_update', (ev) => { const p = !ev.data.isPaused; if (p !== playing) { playing = p; fire(p ? 'play' : 'stop', { source: src, service: 'spotify' }); } });
      });
    }).catch(() => { playing = true; fire('play', { source: src, service: 'spotify' }); });   // no state: treat opening as play
  }
  // Other Kemy media starting stops this embed (Spotify can pause; Apple can't, so it is removed).
  const onOther = (ev) => { const s = ev.detail?.source; if (!s || s === src) return; if (ctrl) { try { ctrl.pause(); } catch { /* */ } } };
  addEventListener('kemy:media-play', onOther);
  return {
    service: e.service,
    pause() { if (ctrl) try { ctrl.pause(); } catch { /* */ } },
    destroy() { dead = true; removeEventListener('kemy:media-play', onOther); try { ctrl?.destroy(); } catch { /* */ } box.innerHTML = ''; if (playing) fire('stop', { source: src, service: e.service }); playing = false; }
  };
}
