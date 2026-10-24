// Kemy Sounds: background music for a video or sound post.
// Lone Keem Originals reuse js/theme.js (no extra audio files).
// Free Music is data/sounds.json + assets/sounds (loaded only when a track is previewed or played).
import { TRACKS } from './theme.js';
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
      const originals = TRACKS.map((t, i) => ({
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

export function creditText(t) {
  if (!t) return '';
  if (t.section === 'original' || String(t.id || '').startsWith('keem-')) return `Music: '${t.title}' by Lone Keem`;
  if (String(t.license).startsWith('CC BY')) return `Music: '${t.title}' by Kevin MacLeod (incompetech.com), CC BY 4.0`;
  return `Music: '${t.title}' by ${t.artist} (freepd.com), CC0 1.0`;
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

// If the checker module isn't in this build, posting continues.
// When both changes are combined, keep this skip in front of reviewSongFile.
// A "hold" result is not published here: that build's claim path has to run instead.
export async function reviewUploadedSong(file, sound) {
  if (!file || skipsSongCheck(sound)) return { action: 'skip' };
  let mod;
  try { mod = await import('./songcheck.js'); }
  catch { return { action: 'ok' }; }
  if (typeof mod.reviewSongFile !== 'function') return { action: 'ok' };
  return mod.reviewSongFile(file);
}

// ---------------------------------------------------------------- picker
export function mountSoundPicker(host) {
  if (!host) return { get() { return null; }, destroy() {} };
  let picked = null;
  let tab = 'originals';
  let playing = '';
  const preview = new Audio();
  preview.preload = 'none';
  preview.loop = true;
  host.innerHTML = `
    <div class="ks-box">
      <p class="ks-title">🎵 Kemy Sounds</p>
      <div class="ks-tabs" role="tablist" aria-label="Kemy Sounds">
        <button type="button" role="tab" data-tab="originals" aria-selected="true">Originals</button>
        ${MOODS.map(([id, name]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${name}</button>`).join('')}
      </div>
      <p class="ks-sec">Lone Keem Originals</p>
      <div class="ks-list" role="list"></div>
      <label class="ks-sl">Your sound <input type="range" min="0" max="100" value="100" data-ks-orig aria-label="Your sound volume"></label>
      <label class="ks-sl">Music <input type="range" min="0" max="100" value="80" data-ks-vol aria-label="Music volume"></label>
      <p class="ks-status muted small">No sound picked. Your video keeps its own audio.</p>
      <a class="ks-credits-link" href="#/sounds">Credits / Licenses</a>
    </div>`;
  const listEl = host.querySelector('.ks-list');
  const status = host.querySelector('.ks-status');
  const vol = () => (+host.querySelector('[data-ks-vol]').value) / 100;
  const orig = () => (+host.querySelector('[data-ks-orig]').value) / 100;
  const stopPreview = () => { preview.pause(); playing = ''; };
  function paintStatus() {
    if (!picked) { status.textContent = 'No sound picked. Your video keeps its own audio.'; return; }
    trackById(picked.id).then((t) => { status.textContent = t ? creditText(t) : 'Kemy Sound'; }).catch(() => {});
  }
  async function paint() {
    host.querySelectorAll('.ks-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'));
    host.querySelector('.ks-sec').textContent = tab === 'originals' ? 'Lone Keem Originals' : 'Free Music · ' + (MOODS.find(([id]) => id === tab)?.[1] || '');
    let rows = [];
    try {
      const list = await allTracks();
      rows = tab === 'originals' ? list.filter((t) => t.section === 'original') : list.filter((t) => t.mood === tab);
    } catch { listEl.innerHTML = '<p class="muted small">The sound list didn’t load. Try again in a moment.</p>'; return; }
    listEl.innerHTML = rows.map((t) => `<div class="ks-row ${picked && picked.id === t.id ? 'picked' : ''} ${playing === t.id ? 'on' : ''}" role="listitem">
      <button type="button" class="ks-prev" data-id="${esc(t.id)}" aria-label="Preview ${esc(t.title)}"><span aria-hidden="true">${playing === t.id ? '⏸' : '▶'}</span><span class="ks-meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}</small></span></button>
      <button type="button" class="ks-use" data-pick="${esc(t.id)}">${picked && picked.id === t.id ? 'Picked' : 'Pick'}</button>
    </div>`).join('') || '<p class="muted small">Nothing in this group.</p>';
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
  const licLink = (t) => {
    if (t.license === 'CC0 1.0') return `<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0 1.0</a>`;
    if (String(t.license).startsWith('CC BY')) return `<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>`;
    return 'Lone Keem original';
  };
  const row = (t) => `<li><b>${esc(t.title)}</b> — ${esc(t.artist)} · ${licLink(t)}${t.source ? ` · <a href="${esc(t.source)}" target="_blank" rel="noopener noreferrer">Source</a>` : ''}<br><span class="muted">${esc(creditText(t))}</span></li>`;
  root.innerHTML = `
    <a class="back-link" href="#/settings">← Settings</a>
    <h1 class="page-title">🎵 Kemy Sounds</h1>
    <p class="muted">Music players can put behind a video or sound. Free tracks are shortened to about a minute so the app stays small.</p>
    <section class="card pad ks-page">
      <h2>Lone Keem Originals</h2>
      <p class="muted small">Keem’s own songs, already in Kemy. Each one is credited to Lone Keem. These names are on the song checker allow-list.</p>
      <ul class="ks-credits">${orig.map(row).join('')}</ul>
    </section>
    <section class="card pad ks-page">
      <h2>Free Music</h2>
      <p class="muted small">Only music whose license allows use inside an app. <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener noreferrer">CC0 1.0</a> from FreePD (public domain), and <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> from Kevin MacLeod (incompetech.com). A post that uses a CC BY track shows the credit line below.</p>
      ${MOODS.map(([id, name]) => `<h3>${name}</h3><ul class="ks-credits">${free.filter((t) => t.mood === id).map(row).join('')}</ul>`).join('')}
    </section>`;
}
