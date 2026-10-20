// Lone Keem Studios - in-game music: a small collapsible player on every game screen.
// Stations of CC0 tracks (data/game-music.json, self-hosted), the Kemy station (theme + community songs),
// and pasted Apple Music / Spotify links (official embeds). Default volume ~35% so game sounds stay audible.
// Events: kemy:media-play / kemy:media-stop / kemy:music {source:'game-music', state, title, station}.
import { musicEmbed, mountMusicEmbed } from './embeds.js';

const K = { vol: 'kemy-gm-vol', st: 'kemy-gm-station', open: 'kemy-gm-open' };
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BASE = new URL('../', import.meta.url).href;
const SRC = 'game-music';

let cfg = null, root = null, audio = null, stations = [], st = null, idx = 0, wantPlay = false, embed = null, kemySongs = null, opts = {};
let volOverride = null; // session-only volume (Pal Park plays the theme playlist softly without changing your saved level)
const vol = () => { if (volOverride != null) return volOverride; const v = parseFloat(ls.get(K.vol)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : (cfg?.defaultVolume ?? 0.35); };
const fire = (state) => {
  const t = st && st.tracks[idx]; const detail = { source: SRC, state, title: t?.title || '', artist: t?.artist || '', station: st?.id || '' };
  dispatchEvent(new CustomEvent(state === 'play' ? 'kemy:media-play' : 'kemy:media-stop', { detail }));
  dispatchEvent(new CustomEvent('kemy:music', { detail }));
};

async function load() {
  if (cfg) return;
  try { cfg = await (await fetch(BASE + 'data/game-music.json')).json(); } catch { cfg = { stations: [], defaultVolume: 0.35 }; }
  stations = cfg.stations.map((s) => ({ ...s, tracks: s.tracks.map((t) => ({ ...t, url: BASE + t.file })) }));
  stations.push({ id: 'kemy', name: 'Kemy', emoji: '⭐', tracks: [], lazy: true });
  stations.push({ id: 'theme', name: 'Theme songs', emoji: '💜', tracks: [], lazy: 'theme' });
}
async function kemyTracks() {
  if (kemySongs) return kemySongs;
  const list = [];
  let themeOff = false; try { const th = await import('./theme.js'); themeOff = th.getMode() === 'off'; if (!themeOff) list.push({ title: th.THEME_TITLE, artist: th.THEME_ARTIST, url: th.THEME_SRC, theme: true }); } catch { /* */ }
  try { const more = opts.kemySongs ? await opts.kemySongs() : []; more.forEach((s) => list.push(s)); } catch { /* offline */ }
  kemySongs = list; return list;
}

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio(); audio.preload = 'none'; audio.setAttribute('playsinline', ''); audio.dataset.kemyGameMusic = '1';
  audio.addEventListener('ended', () => next());
  audio.addEventListener('playing', () => { paint(); fire('play'); });
  audio.addEventListener('pause', () => { paint(); if (!audio.ended) fire('stop'); });
  audio.addEventListener('error', () => { if (wantPlay) setTimeout(next, 400); });
  return audio;
}
async function pick(id) {
  closeEmbed();
  st = stations.find((s) => s.id === id) || stations[0]; ls.set(K.st, st.id); idx = 0;
  if (st.lazy === 'theme') { try { const th = await import('./theme.js'); st.tracks = th.TRACKS.map((t) => ({ title: t.title, artist: t.artist, url: t.src })); } catch { st.tracks = []; } }
  else if (st.lazy) st.tracks = await kemyTracks();
  if (st.tracks.length > 1 && st.id !== 'kemy' && st.id !== 'theme') idx = Math.floor(Math.random() * st.tracks.length);
  paint();
}
function startTrack() {
  const t = st && st.tracks[idx]; if (!t) { paint(); return; }
  const a = ensureAudio(); a.volume = vol(); a.loop = st.tracks.length === 1;
  if (a.dataset.url !== t.url) { a.src = t.url; a.dataset.url = t.url; }
  wantPlay = true; a.play().catch(() => { wantPlay = false; paint(); });
}
export async function play() { await load(); if (!st) await pick(ls.get(K.st) || 'chill'); closeEmbed(); startTrack(); }
export function pause() { wantPlay = false; audio?.pause(); paint(); }
export function next() { if (!st || !st.tracks.length) return; idx = (idx + 1) % st.tracks.length; if (wantPlay || (audio && !audio.paused)) startTrack(); else paint(); }
export function setVolume(v) { volOverride = null; ls.set(K.vol, String(v)); if (audio) audio.volume = v; paint(); }
// Play a station from its first track (playlist order, loops). volume: session-only level. remember=false keeps your saved station.
export async function playStation(id, { volume = null, remember = false } = {}) { await load(); const keep = ls.get(K.st); volOverride = volume; await pick(id); if (!remember && keep) ls.set(K.st, keep); closeEmbed(); startTrack(); }
export const audioEl = () => audio;
export const isPlaying = () => !!audio && !audio.paused;
export const state = () => ({ playing: isPlaying(), station: st?.id || '', title: st?.tracks[idx]?.title || '', volume: audio ? audio.volume : vol(), embed: embed?.service || '' });

function closeEmbed() { if (embed) { embed.destroy(); embed = null; } const b = root?.querySelector('.gm-embed'); if (b) b.innerHTML = ''; }
function openLink(url) {
  const e = musicEmbed(url); const err = root.querySelector('.gm-err');
  if (!e) { err.textContent = 'Paste an Apple Music or Spotify song, album or playlist link.'; return; }
  err.textContent = ''; pause(); closeEmbed();
  embed = mountMusicEmbed(root.querySelector('.gm-embed'), e, { source: SRC + '-' + e.service });
  paint();
}

function paint() {
  if (!root) return;
  const t = st?.tracks[idx]; const on = isPlaying();
  root.classList.toggle('playing', on || !!embed);
  root.querySelector('.gm-fab').setAttribute('aria-label', on ? 'Game music playing: open player' : 'Game music: open player');
  root.querySelector('.gm-pp').textContent = on ? '⏸' : '▶'; root.querySelector('.gm-pp').setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  root.querySelector('.gm-now').innerHTML = embed ? `${embed.service === 'apple' ? 'Apple Music' : 'Spotify'} link` : t ? `<b>${esc(t.title)}</b><small>${esc(t.artist)}${t.license ? ' · CC0' : ''}</small>` : (st?.id === 'kemy' ? '<small>No Kemy songs yet</small>' : '<small>Pick a station</small>');
  root.querySelectorAll('[data-st]').forEach((b) => { const a = b.dataset.st === st?.id; b.classList.toggle('on', a); b.setAttribute('aria-pressed', a); });
  const r = root.querySelector('.gm-vol'); if (document.activeElement !== r) r.value = String(Math.round((audio ? audio.volume : vol()) * 100));
}

// Show on game screens; hidden (and stopped) elsewhere.
export async function mountGameMusic(o = {}) {
  opts = { ...opts, ...o };
  await load();
  if (!document.getElementById('gm-css')) { const l = document.createElement('link'); l.id = 'gm-css'; l.rel = 'stylesheet'; l.href = BASE + 'css/gamemusic.css'; document.head.appendChild(l); }
  if (!root) {
    root = document.createElement('div'); root.className = 'gm'; root.id = 'game-music';
    root.innerHTML = `<button type="button" class="gm-fab" aria-expanded="false" aria-controls="gm-panel"><span aria-hidden="true">🎵</span></button>
      <section class="gm-panel" id="gm-panel" role="region" aria-label="Game music" hidden>
        <div class="gm-top"><b>Game music</b><button type="button" class="gm-x" aria-label="Collapse music player">▾</button></div>
        <div class="gm-st">${stations.map((s) => `<button type="button" data-st="${s.id}" aria-pressed="false">${s.emoji} ${esc(s.name)}</button>`).join('')}</div>
        <div class="gm-row"><button type="button" class="gm-pp" aria-label="Play music">▶</button><button type="button" class="gm-next" aria-label="Skip track">⏭</button><div class="gm-now"></div></div>
        <label class="gm-vrow"><span aria-hidden="true">🔉</span><span class="sr-only">Music volume</span><input class="gm-vol" type="range" min="0" max="100" step="1"></label>
        <form class="gm-link"><label for="gm-url" class="sr-only">Apple Music or Spotify link</label><input id="gm-url" type="url" inputmode="url" placeholder="Paste an Apple Music or Spotify link" autocomplete="off"><button class="btn btn-sm" type="submit">Play</button></form>
        <p class="gm-err small" role="alert"></p>
        <div class="gm-embed"></div>
        <p class="gm-cr small muted">Free music: CC0 tracks (see Credits), Kemy songs, or your own Apple Music / Spotify link.</p>
      </section>`;
    document.body.appendChild(root);
    const panel = root.querySelector('.gm-panel'), fab = root.querySelector('.gm-fab');
    const setOpen = (v) => { panel.hidden = !v; fab.setAttribute('aria-expanded', v); root.classList.toggle('open', v); ls.set(K.open, v ? '1' : '0'); };
    fab.onclick = () => setOpen(panel.hidden);
    root.querySelector('.gm-x').onclick = () => setOpen(false);
    root.querySelector('.gm-pp').onclick = () => (isPlaying() ? pause() : play());
    root.querySelector('.gm-next').onclick = () => next();
    root.querySelector('.gm-st').onclick = async (e) => { const b = e.target.closest('[data-st]'); if (!b) return; await pick(b.dataset.st); startTrack(); };
    root.querySelector('.gm-vol').oninput = (e) => setVolume(e.target.value / 100);
    root.querySelector('.gm-link').onsubmit = (e) => { e.preventDefault(); openLink(root.querySelector('#gm-url').value); };
    // Videos / other players starting take over; the tab going hidden pauses (resumes when back if it was playing).
    addEventListener('kemy:media-play', (e) => { const s = e.detail?.source || ''; if (!s.startsWith(SRC) && isPlaying()) { pause(); } });
    let resume = false;
    document.addEventListener('visibilitychange', () => { if (document.hidden) { resume = isPlaying(); if (resume) audio.pause(); } else if (resume) { resume = false; startTrack(); } });
    await pick(ls.get(K.st) || 'chill');
  }
  root.hidden = false; root.classList.toggle('top-right', opts.corner === 'top-right'); paint();
  return root;
}
export function hideGameMusic() { if (!root) return; pause(); volOverride = null; closeEmbed(); root.hidden = true; }
