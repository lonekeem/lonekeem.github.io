// Kemy Sounds: background music for a video or sound post.
// Lone Keem Originals reuse js/theme.js (no extra audio files).
// Free Music is data/sounds.json + assets/sounds (loaded only when a track is previewed or played).
import { TRACKS, ORDER } from './theme.js';
import { soundOn } from './autoplay.js';

const MOODS = [
  ['happy', 'Happy'],
  ['chill', 'Chill'],
  ['hype', 'Hype'],
  ['funny', 'Funny'],
  ['adventure', 'Adventure'],
  ['spooky', 'Spooky'],
];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let freeP = null;
function loadFree() {
  if (!freeP) {
    freeP = fetch(new URL('../data/sounds.json', import.meta.url)).then((r) => {
      if (!r.ok) throw new Error('sounds');
      return r.json();
    }).then((j) => j.tracks || []).catch((e) => { freeP = null; throw e; });
  }
  return freeP;
}
let allP = null;
function allTracks() {
  if (!allP) {
    allP = loadFree().then((free) => {
      const originals = ORDER.map((i) => [TRACKS[i], i]).map(([t, i]) => ({
        id: 'keem-' + i, title: t.title, artist: 'Lone Keem', mood: 'originals', section: 'original',
        license: 'Lone Keem original', source: '', src: t.src,
      }));
      const frees = free.map((t) => ({
        ...t, section: 'free', src: new URL('../' + t.file, import.meta.url).href,
      }));
      return originals.concat(frees);
    }).catch((e) => { allP = null; throw e; });
  }
  return allP;
}
export async function trackById(id) {
  const list = await allTracks();
  return list.find((t) => t.id === id) || null;
}

function viaOf(t) {
  if (t.via) return t.via;
  const src = String(t.source || '');
  if (src.includes('incompetech.com')) return 'incompetech.com';
  if (src.includes('freepd.com')) return 'freepd.com';
  if (src.includes('ccmixter.org')) return 'ccmixter.org';
  if (src.includes('wikimedia.org')) return 'commons.wikimedia.org';
  return '';
}
export function creditText(t) {
  if (!t) return '';
  if (t.section === 'original' || String(t.id || '').startsWith('keem-')) return `Music: '${t.title}' by Lone Keem`;
  const via = viaOf(t);
  const lic = t.license || '';
  return `Music: '${t.title}' by ${t.artist}${via ? ` (${via})` : ''}${lic ? `, ${lic}` : ''}`;
}

// Stored on the post. Credit is looked up from the manifest, not copied onto the document.
export function soundPayload(s) {
  if (!s || !s.id || !/^[a-z0-9-]{1,40}$/.test(s.id)) return null;
  const n = (v, d) => {
    const x = Number(v);
    const y = Number.isFinite(x) ? x : d;
    return Math.round(Math.max(0, Math.min(1, y)) * 100) / 100;
  };
  return { id: s.id, vol: n(s.vol, 0.8), orig: n(s.orig, 1) };
}

// The song checker (js/songcheck.js, a separate change) fingerprints the uploaded file.
// Skip that when a Kemy Sound is the only music ("Your sound" is at 0, or there is no original).
export function skipsSongCheck(sound) {
  return !!(sound && sound.id && !(Number(sound.orig) > 0));
}

// The checker loads only for this call. If it isn't in the build, or it fails, posting continues.
// "hold" means the caller saves a held post (off the feed). "cancel" means don't upload.
export async function reviewUploadedSong(file, sound) {
  if (!file || skipsSongCheck(sound)) return { action: 'skip' };
  let mod;
  try { mod = await import('./songcheck.js'); }
  catch { return { action: 'ok' }; }
  if (typeof mod.reviewSongFile !== 'function') return { action: 'ok' };
  try { return await mod.reviewSongFile(file); }
  catch { return { action: 'ok' }; }
}

// ---------------------------------------------------------------- picker
export function mountSoundPicker(host) {
  if (!host) return { get() { return null; }, destroy() {} };
  let picked = null;
  let tab = 'trending';
  let playing = '';
  const preview = new Audio();
  preview.preload = 'none';
  preview.loop = true;
  host.innerHTML = `
    <div class="ks-box">
      <p class="ks-title">🎵 Kemy Sounds</p>
      <div class="ks-tabs" role="tablist" aria-label="Kemy Sounds">
        <button type="button" role="tab" data-tab="trending" aria-selected="true">Trending</button>
        <button type="button" role="tab" data-tab="originals" aria-selected="false">Originals</button>
        <button type="button" role="tab" data-tab="all" aria-selected="false">All</button>
        ${MOODS.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${name}</button>`).join('')}
      </div>
      <div class="ks-find">
        <input type="search" data-ks-q placeholder="Search songs or artists" aria-label="Search songs or artists" autocomplete="off">
        <select data-ks-artist aria-label="Artist"><option value="">All artists</option></select>
      </div>
      <p class="ks-sec">Trending</p>
      <div class="ks-list" role="list"></div>
      <label class="ks-sl">Your sound <input type="range" min="0" max="100" value="100" data-ks-orig aria-label="Your sound volume"></label>
      <label class="ks-sl">Music <input type="range" min="0" max="100" value="80" data-ks-vol aria-label="Music volume"></label>
      <p class="ks-status muted small">No sound picked. Your video keeps its own audio.</p>
      <a class="ks-credits-link" href="#/sounds">Credits / Licenses</a>
    </div>`;
  const listEl = host.querySelector('.ks-list');
  const status = host.querySelector('.ks-status');
  const qEl = host.querySelector('[data-ks-q]');
  const aEl = host.querySelector('[data-ks-artist]');
  const vol = () => (+host.querySelector('[data-ks-vol]').value) / 100;
  const orig = () => (+host.querySelector('[data-ks-orig]').value) / 100;
  const stopPreview = () => { preview.pause(); playing = ''; };
  function paintStatus() {
    if (!picked) { status.textContent = 'No sound picked. Your video keeps its own audio.'; return; }
    trackById(picked.id).then((t) => { status.textContent = t ? creditText(t) : 'Kemy Sound'; }).catch(() => {});
  }
  async function paint() {
    host.querySelectorAll('.ks-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    const head = tab === 'originals' ? 'Lone Keem Originals'
      : tab === 'trending' ? 'Trending'
      : tab === 'all' ? 'Free Music'
      : 'Free Music · ' + (MOODS.find(([id]) => id === tab)?.[1] || '');
    let pool = [];
    try {
      const list = await allTracks();
      pool = tab === 'originals' ? list.filter((t) => t.section === 'original')
        : tab === 'all' ? list.filter((t) => t.section === 'free')
        : tab === 'trending' ? list.filter((t) => t.section === 'free' && Number(t.trending) > 0).sort((a, b) => Number(a.trending) - Number(b.trending) || a.title.localeCompare(b.title))
        : list.filter((t) => t.mood === tab);
    } catch { listEl.innerHTML = '<p class="muted small">The sound list didn’t load. Try again in a moment.</p>'; return; }
    const curArtist = aEl.value;
    const names = [...new Set(pool.map((t) => t.artist))].sort((a, b) => a.localeCompare(b));
    aEl.innerHTML = `<option value="">All artists</option>${names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}`;
    if (names.includes(curArtist)) aEl.value = curArtist;
    const q = qEl.value.trim().toLowerCase();
    const who = aEl.value;
    const rows = pool.filter((t) => (!who || t.artist === who) && (!q || `${t.title} ${t.artist}`.toLowerCase().includes(q)));
    host.querySelector('.ks-sec').textContent = `${head} · ${rows.length}`;
    listEl.innerHTML = rows.map((t) => `<div class="ks-row ${picked && picked.id === t.id ? 'picked' : ''} ${playing === t.id ? 'on' : ''}" role="listitem">
      <button type="button" class="ks-prev" data-id="${esc(t.id)}" aria-label="Preview ${esc(t.title)}"><span aria-hidden="true">${playing === t.id ? '⏸' : '▶'}</span><span class="ks-meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}${t.vocals ? ' · singing' : ''}</small></span></button>
      <button type="button" class="ks-use" data-pick="${esc(t.id)}">${picked && picked.id === t.id ? 'Picked' : 'Pick'}</button>
    </div>`).join('') || '<p class="muted small">Nothing matches.</p>';
  }
  host.querySelector('.ks-tabs').onclick = (e) => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    tab = b.dataset.tab; stopPreview(); paint();
  };
  listEl.onclick = async (e) => {
    const pick = e.target.closest('[data-pick]');
    const prev = e.target.closest('[data-id]');
    const id = (pick && pick.dataset.pick) || (prev && prev.dataset.id);
    if (!id) return;
    if (pick) {
      picked = { id };
      stopPreview();
      paintStatus();
      paint();
      return;
    }
    if (playing === id) { stopPreview(); paint(); return; }
    const t = await trackById(id);
    if (!t) return;
    stopPreview();
    preview.src = t.src;
    preview.volume = Math.max(0.05, vol());
    preview.play().then(() => { playing = id; paint(); dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'kemy-sound' } })); }).catch(() => {});
  };
  qEl.oninput = () => paint();
  aEl.onchange = () => paint();
  host.querySelector('[data-ks-vol]').oninput = () => { preview.volume = vol(); if (picked) paintStatus(); };
  host.querySelector('[data-ks-orig]').oninput = () => { if (picked) paintStatus(); };
  const onOther = (e) => { if (e.detail?.source !== 'kemy-sound') stopPreview(); };
  addEventListener('kemy:media-play', onOther);
  paint();
  function destroy() {
    stopPreview();
    preview.removeAttribute('src');
    preview.load();
    removeEventListener('kemy:media-play', onOther);
  }
  addEventListener('hashchange', destroy, { once: true });
  return {
    get() { return picked ? soundPayload({ id: picked.id, vol: vol(), orig: orig() }) : null; },
    destroy,
  };
}

// ---------------------------------------------------------------- playback (one bed for the whole app)
let bed = null;
let bedFor = null;
function ensureBed() {
  if (bed) return bed;
  bed = new Audio();
  bed.preload = 'none';
  bed.loop = true;
  bed.setAttribute('playsinline', '');
  return bed;
}
function stopBed() {
  if (!bed) return;
  bed.pause();
  bedFor = null;
}
const wired = new WeakSet();
export function bindBed(media, sound) {
  if (!media) return;
  if (!sound || !sound.id) {
    delete media.dataset.kemySound;
    if (bedFor === media) stopBed();
    return;
  }
  media.dataset.kemySound = sound.id;
  const orig = Number(sound.orig);
  const vol = Number(sound.vol);
  media.dataset.kemyOrig = String(orig > 0 ? orig : 0);
  media.dataset.kemyVol = String(Number.isFinite(vol) ? vol : 0.8);
  if (!(orig > 0)) { media.muted = true; try { media.volume = 0; } catch { /* */ } }
  else { try { media.volume = orig; } catch { /* */ } }
  const kick = () => {
    const id = media.dataset.kemySound;
    if (!id) { if (bedFor === media) stopBed(); return; }
    const o = Number(media.dataset.kemyOrig) || 0;
    if (o <= 0 && !media.muted) media.muted = true;
    // Feed mute (kemyHear 0) and muted autoplay stay quiet. "Tap for sound" sets soundOn.
    const hear = media.dataset.kemyHear === '1' || (media.dataset.kemyHear !== '0' && (soundOn() || (o > 0 && !media.muted)));
    if (media.paused || media.ended || !hear) { if (bedFor === media) stopBed(); return; }
    playBed(media, id, Number(media.dataset.kemyVol));
  };
  if (!wired.has(media)) {
    wired.add(media);
    media.addEventListener('play', kick);
    media.addEventListener('pause', kick);
    media.addEventListener('ended', kick);
    media.addEventListener('seeked', kick);
    media.addEventListener('volumechange', kick);
  } else kick();
}
async function playBed(media, id, vol) {
  const t = await trackById(id);
  if (!t || media.paused || media.dataset.kemyHear === '0') return;
  const a = ensureBed();
  if (bedFor !== media || a.dataset.id !== id) {
    a.preload = 'none';
    a.src = t.src;
    a.dataset.id = id;
    bedFor = media;
  }
  a.volume = Math.max(0, Math.min(1, Number.isFinite(vol) ? vol : 0.8));
  try { if (a.duration && media.currentTime) a.currentTime = media.currentTime % a.duration; } catch { /* */ }
  if (a.paused) a.play().then(() => dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'kemy-sound' } }))).catch(() => {});
}
export function setBedHear(media, on) {
  if (!media || !media.dataset.kemySound) return;
  media.dataset.kemyHear = on ? '1' : '0';
  media.dispatchEvent(new Event('volumechange'));
}

export async function showCredit(root, sound) {
  if (!root || !sound || !sound.id) return;
  let p = root.querySelector('[data-ks-credit]');
  if (!p) {
    p = document.createElement('p');
    p.className = 'ks-credit';
    p.dataset.ksCredit = '';
    (root.querySelector('.post-media, .wbody, .vmeta, .wcard-body') || root).appendChild(p);
  }
  p.hidden = false;
  try {
    const t = await trackById(sound.id);
    p.textContent = creditText(t) || 'Music: Kemy Sound';
  } catch { p.textContent = 'Music: Kemy Sound'; }
  const media = root.querySelector('video, audio');
  if (media) bindBed(media, sound);
}

export async function creditsPage(root) {
  let list = [];
  try { list = await allTracks(); }
  catch { root.innerHTML = '<p class="card pad">The sound list didn’t load. <a href="#/sounds">Try again</a></p>'; return; }
  const orig = list.filter((t) => t.section === 'original');
  const free = list.filter((t) => t.section === 'free');
  const licHref = (license) => {
    const s = String(license || '');
    if (s === 'CC0 1.0' || s === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
    if (/public domain/i.test(s)) return 'https://creativecommons.org/publicdomain/mark/1.0/';
    const sa = s.match(/CC BY-SA\s+([0-9.]+)/i);
    if (sa) return `https://creativecommons.org/licenses/by-sa/${sa[1]}/`;
    const by = s.match(/CC BY\s+([0-9.]+)/i);
    if (by) return `https://creativecommons.org/licenses/by/${by[1]}/`;
    return '';
  };
  const licLink = (t) => {
    const href = licHref(t.license);
    return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(t.license)}</a>` : esc(t.license || 'Lone Keem original');
  };
  const row = (t) => `<li><b>${esc(t.title)}</b> — ${esc(t.artist)} · ${licLink(t)}${t.source ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}<br><span class="muted">${esc(creditText(t))}</span></li>`;
  root.innerHTML = `
    <a class="back-link" href="#/settings">← Settings</a>
    <h1 class="page-title">🎵 Kemy Sounds</h1>
    <p class="muted">Music you can put behind a video or sound. Free tracks are shortened so the app stays small.</p>
    <section class="card pad ks-page">
      <h2>Lone Keem Originals</h2>
      <p class="muted small">Keem’s own songs, already in Kemy. Each one is credited to Lone Keem. These names are on the song checker allow-list.</p>
      <ul class="ks-credits">${orig.map(row).join('')}</ul>
    </section>
    <section class="card pad ks-page">
      <h2>Free Music</h2>
      <p class="muted small">Only licenses that allow an app to keep and share the music: public domain / CC0, CC BY, and CC BY-SA. CC BY and CC BY-SA need the credit line on the post. CC BY-SA also means a remix of that track stays under the same license. Non-commercial and no-derivatives tracks are not included. Trending is the most-played music that fits a video.</p>
      <h3>Trending</h3><ul class="ks-credits">${free.filter((t) => Number(t.trending) > 0).sort((a, b) => Number(a.trending) - Number(b.trending)).map(row).join('')}</ul>
      ${MOODS.map(([id, name]) => `<h3>${name}</h3><ul class="ks-credits">${free.filter((t) => t.mood === id).map(row).join('')}</ul>`).join('')}
    </section>
    <section class="card pad ks-page" data-film-credits><h2>🎬 Lone Keem Studio films</h2><p class="muted small">Open films shown on the theater's big screen on Kemy Street.</p><ul class="ks-credits"></ul></section>`;
  // the theater's open-movie credits (small module, loaded only here)
  // web addresses are plain selectable text here, never links (kid-directed app)
  import('./world/theater-movie.js').then(({ FILMS, PEPPER_EPISODES, licDeed, bareUrl }) => { const ul = root.querySelector('[data-film-credits] ul'); if (!ul) return;
    const u = (x) => `<span class="ks-url" style="user-select:text;-webkit-user-select:text;font-family:ui-monospace,Menlo,monospace">${esc(bareUrl(x))}</span>`;
    const eps = (f) => (f.id === 'pepper' ? `<br><span class="muted">Episodes: ${PEPPER_EPISODES.map((e) => `${e.n}. ${esc(e.title)} (${u(e.page)})`).join(' · ')}. Original comic: Pepper&amp;Carrot by David Revoy, ${u('www.peppercarrot.com')} (CC BY 4.0).</span>` : '');
    ul.innerHTML = Object.values(FILMS).filter((f) => f.credit).map((f) => `<li><b>${esc(f.title)}</b>${f.sub ? ` — ${esc(f.sub)}` : ''} (${esc(f.year)}) — ${esc(f.makers || f.org)} · ${esc(f.lic)} ${u(licDeed(f.lic))} · Source: ${u(f.page || f.src)}<br><span class="muted">${esc(f.credit)}. ${/-SA/.test(f.lic) ? 'Shown unmodified, except' : 'Shown unchanged, except'}${f.reels.length > 1 ? ` split into ${f.reels.length} parts (played back to back) and` : ''} re-encoded to 720p for the app.</span>${eps(f)}</li>`).join(''); }).catch(() => {});
}
