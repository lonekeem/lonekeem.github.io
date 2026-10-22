// Lone Keem Studios - in-game music: a small collapsible player on every game screen.
// Stations of CC0 tracks (data/game-music.json, self-hosted), the Kemy station (theme + community songs),
// and pasted Apple Music / Spotify links (official embeds). Default volume ~35% so game sounds stay audible.
// Events: kemy:media-play / kemy:media-stop / kemy:music {source:'game-music', state, title, station}.
import { musicEmbed, mountMusicEmbed } from './embeds.js';
import { masterVol } from './volume.js';

const K = { vol: 'kemy-gm-vol', st: 'kemy-gm-station', open: 'kemy-gm-open' };
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BASE = new URL('../', import.meta.url).href;
const SRC = 'game-music';
// Kemy Radio = the 'theme' station (js/theme.js TRACKS, files exactly as recorded, loaded only when played).
// Compact pill (equalizer, scrolling title, prev/play/next) + a radio section in the panel. Remembered on this device.
const RK = { shuf: 'kemy-radio-shuffle', rep: 'kemy-radio-repeat', trk: 'kemy-radio-track', off: 'kemy-radio-off' };
// My Playlist: saved Spotify / Apple Music links (this device only), played in a mini card via the official embeds.
const PK = 'kemy-radio-playlists';
let pl = null, card = null;
export function playlistLink(url) {
  const e = musicEmbed(url); if (!e) return null;
  if (e.service === 'spotify' && !['playlist', 'album', 'track'].includes(e.kind)) return null;
  if (e.service === 'apple' && !['playlist', 'album', 'song'].includes(e.kind)) return null;
  return e;
}
export const playlists = () => { try { const a = JSON.parse(ls.get(PK) || '[]'); return Array.isArray(a) ? a.filter((p) => p && p.id && playlistLink(p.url)) : []; } catch { return []; } };
const savePl = (a) => ls.set(PK, JSON.stringify(a.slice(0, 30)));
let themeTracks = [], toastT = 0, lastToast = '';
const isRadio = () => st?.id === 'theme';
const shuffleOn = () => ls.get(RK.shuf) === '1';
const repeatMode = () => { const v = ls.get(RK.rep); return v === 'one' || v === 'off' ? v : 'all'; };
const radioOff = () => ls.get(RK.off) === '1';

let cfg = null, root = null, audio = null, stations = [], st = null, idx = 0, wantPlay = false, embed = null, kemySongs = null, opts = {};
let volOverride = null; // session-only volume (Pal Park plays the theme playlist softly without changing your saved level)
const baseVol = () => { if (volOverride != null) return volOverride; const v = parseFloat(ls.get(K.vol)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : (cfg?.defaultVolume ?? 0.35); };
const playVol = () => Math.max(0, Math.min(1, baseVol() * masterVol()));
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
  audio.addEventListener('ended', () => { if (isRadio() && repeatMode() === 'off' && !shuffleOn() && idx === st.tracks.length - 1) { wantPlay = false; paint(); fire('stop'); return; } next(); });
  audio.addEventListener('playing', () => { paint(); fire('play'); });
  audio.addEventListener('pause', () => { paint(); if (!audio.ended) fire('stop'); });
  audio.addEventListener('error', () => { if (wantPlay) setTimeout(next, 400); });
  return audio;
}
async function pick(id) {
  closeEmbed();
  st = stations.find((s) => s.id === id) || stations[0]; ls.set(K.st, st.id); idx = 0;
  if (st.lazy === 'theme') { await loadTheme(); st.tracks = themeTracks; const t = parseInt(ls.get(RK.trk), 10); if (st.tracks[t]) idx = t; }
  else if (st.lazy) st.tracks = await kemyTracks();
  if (st.tracks.length > 1 && st.id !== 'kemy' && st.id !== 'theme') idx = Math.floor(Math.random() * st.tracks.length);
  paint();
}
function startTrack() {
  const t = st && st.tracks[idx]; if (!t) { paint(); return; }
  const a = ensureAudio(); a.volume = playVol(); a.loop = st.tracks.length === 1 || (isRadio() && repeatMode() === 'one');
  if (isRadio()) { ls.set(RK.trk, String(idx)); ls.set(RK.off, '0'); if (lastToast !== t.url) { lastToast = t.url; toast(t); } }
  if (a.dataset.url !== t.url) { a.preload = 'none'; a.src = t.url; a.dataset.url = t.url; }
  wantPlay = true; a.play().catch(() => { wantPlay = false; paint(); });
}
export async function play() { await load(); if (!st) await pick(ls.get(K.st) || 'chill'); closeEmbed(); startTrack(); }
export function pause() { wantPlay = false; audio?.pause(); paint(); }
export function next() { if (!st || !st.tracks.length) return; const n = st.tracks.length; if (isRadio() && shuffleOn() && n > 1) { let j; do j = Math.floor(Math.random() * n); while (j === idx); idx = j; } else idx = (idx + 1) % n; if (wantPlay || (audio && !audio.paused)) startTrack(); else paint(); }
export function prev() { if (!st || !st.tracks.length) return; if (audio && !audio.paused && audio.currentTime > 3 && audio.dataset.url === st.tracks[idx]?.url) { audio.currentTime = 0; return; } idx = (idx - 1 + st.tracks.length) % st.tracks.length; if (wantPlay || (audio && !audio.paused)) startTrack(); else paint(); }
async function loadTheme() { if (themeTracks.length) return; try { const th = await import('./theme.js'); themeTracks = th.TRACKS.map((t) => ({ title: t.title, artist: t.artist, url: t.src, dur: t.dur, cover: t.cover || '', credit: t.credit || '' })); } catch { themeTracks = []; } }
// Kemy Radio controls (also used by the pill / panel). i: track index in the theme playlist.
export async function radioPlay(i = null) { await load(); closeEmbed(); if (!isRadio()) await pick('theme'); if (i != null && st.tracks[i]) idx = i; ls.set(RK.off, '0'); startTrack(); }
export function radioToggle() { if (isPlaying()) pause(); else radioPlay(); }
export function setShuffle(v) { ls.set(RK.shuf, v ? '1' : '0'); paint(); }
export function setRepeat(v) { ls.set(RK.rep, v); if (audio && isRadio()) audio.loop = v === 'one'; paint(); }
export function turnRadioOff() { ls.set(RK.off, '1'); if (isRadio()) pause(); paint(); }
export function setRadioEnabled(on) { ls.set(RK.off, on ? '0' : '1'); if (!on && isRadio()) pause(); paint(); }
export const radioState = () => ({ on: !radioOff(), shuffle: shuffleOn(), repeat: repeatMode(), track: isRadio() ? idx : parseInt(ls.get(RK.trk), 10) || 0, title: isRadio() ? st.tracks[idx]?.title || '' : '', playing: isRadio() && isPlaying(), tracks: themeTracks.map((t) => t.title) });
function toast(t) {
  const el = root?.querySelector('.gmr-toast'); if (!el || root.hidden) return;
  el.textContent = `Now playing: ${t.title} – ${t.artist}`; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 2600);
}
export function setVolume(v) { volOverride = null; ls.set(K.vol, String(v)); if (audio) audio.volume = playVol(); paint(); }
addEventListener('kemy:vol', () => { if (audio) audio.volume = playVol(); });
// Play a station from its first track (playlist order, loops). volume: session-only level. remember=false keeps your saved station.
export async function playStation(id, { volume = null, remember = false } = {}) { await load(); const keep = ls.get(K.st); volOverride = volume; await pick(id); if (id === 'theme' && radioOff()) { if (!remember && keep) ls.set(K.st, keep); paint(); return; } if (!remember && keep) ls.set(K.st, keep); closeEmbed(); startTrack(); }
export const audioEl = () => audio;
export const isPlaying = () => !!audio && !audio.paused;
export const state = () => ({ playing: isPlaying(), station: st?.id || '', title: st?.tracks[idx]?.title || '', volume: baseVol(), embed: embed?.service || '' });

function closeEmbed() { if (embed) { embed.destroy(); embed = null; } pl = null; if (card) { card.hidden = true; card.querySelector('.gmp-box').innerHTML = ''; } const b = root?.querySelector('.gm-embed'); if (b) b.innerHTML = ''; }
function openLink(url) {
  const e = musicEmbed(url); const err = root.querySelector('.gm-err');
  if (!e) { err.textContent = 'Paste an Apple Music or Spotify song, album or playlist link.'; return; }
  err.textContent = ''; pause(); closeEmbed();
  embed = mountMusicEmbed(root.querySelector('.gm-embed'), e, { source: SRC + '-' + e.service });
  paint();
}

function addPlaylist(url) {
  const e = playlistLink(url), err = root.querySelector('.gmp-err');
  if (!e) { err.textContent = 'Hmm, that link didn’t work. Paste a Spotify or Apple Music playlist, album or song link (like open.spotify.com/playlist/…).'; return; }
  const a = playlists(); const name = (e.service === 'apple' ? 'Apple Music ' : 'Spotify ') + e.kind.replace('song', 'song').replace(/^./, (c) => c.toUpperCase()) + ' ' + (a.length + 1);
  const p = { id: 'p' + Date.now().toString(36), name, url: e.url };
  savePl([...a, p]); err.textContent = ''; root.querySelector('#gmp-url').value = ''; drawPl(); playPlaylist(p.id);
}
function drawPl() {
  const a = playlists(), ul = root.querySelector('.gmp-list');
  ul.innerHTML = a.length ? a.map((p) => `<li data-pid="${esc(p.id)}"><button type="button" class="gmp-play" aria-label="Play ${esc(p.name)}">${playlistLink(p.url).service === 'apple' ? '🍎' : '🟢'} <b>${esc(p.name)}</b></button><button type="button" class="gmp-ren" aria-label="Rename ${esc(p.name)}">✏️</button><button type="button" class="gmp-del" aria-label="Remove ${esc(p.name)}">🗑️</button></li>`).join('') : '<li class="small muted gmp-none">No playlists yet. Paste one above!</li>';
  paint();
}
export function playPlaylist(id) {
  const p = playlists().find((x) => x.id === id); const e = p && playlistLink(p.url); if (!e) return;
  pause(); closeEmbed();
  if (!card) {
    card = document.createElement('div'); card.className = 'gmp-card'; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'My Playlist player');
    card.innerHTML = '<div class="gmp-head"><span class="gmr-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b class="gmp-name"></b><button type="button" class="gmp-min" aria-label="Shrink player">▴</button><button type="button" class="gmp-close" aria-label="Stop playlist">✕</button></div><div class="gmp-box"></div>';
    document.body.appendChild(card);
    card.querySelector('.gmp-close').onclick = () => { closeEmbed(); paint(); };
    card.querySelector('.gmp-min').onclick = () => { const m = card.classList.toggle('min'); card.querySelector('.gmp-min').textContent = m ? '▾' : '▴'; card.querySelector('.gmp-min').setAttribute('aria-label', m ? 'Show player' : 'Shrink player'); };
  }
  card.classList.toggle('top-right', root.classList.contains('top-right'));
  card.classList.toggle('pnl', root.classList.contains('open')); card.hidden = false; card.querySelector('.gmp-name').textContent = p.name;
  embed = mountMusicEmbed(card.querySelector('.gmp-box'), { ...e, height: e.service === 'apple' ? 175 : 152 }, { source: SRC + '-playlist' });
  pl = p; paint();
}

function paint() {
  if (!root) return;
  const t = st?.tracks[idx]; const on = isPlaying();
  root.classList.toggle('playing', on || !!embed); root.classList.toggle('radio-on', on || !!pl);
  root.querySelector('.gm-fab').setAttribute('aria-label', on ? 'Game music playing: open player' : 'Game music: open player');
  root.querySelector('.gm-pp').textContent = on ? '⏸' : '▶'; root.querySelector('.gm-pp').setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  root.querySelector('.gm-now').innerHTML = embed ? `${embed.service === 'apple' ? 'Apple Music' : 'Spotify'} link` : t ? `<b>${esc(t.title)}</b><small>${esc(t.artist)}${t.license ? ' · CC0' : ''}</small>` : (st?.id === 'kemy' ? '<small>No Kemy songs yet</small>' : '<small>Pick a station</small>');
  const rp = root.querySelector('.gm-radio'), radio = isRadio();
  root.classList.toggle('radio-off', radioOff() && !(on && !radio) && !pl);
  const label = pl ? `🎧 My Playlist: ${pl.name}` : embed ? 'Music link' : t ? `Now playing: ${t.title} – ${t.artist}` : 'Kemy Radio';
  const mq = rp.querySelector('.gmr-t'); if (mq.dataset.l !== label) { mq.dataset.l = label; mq.innerHTML = `<span>${esc(label)}</span><span aria-hidden="true">${esc(label)}</span>`; }
  rp.querySelector('.gmr-info').setAttribute('aria-label', `${label}. Open Kemy Radio`);
  rp.querySelector('.gmr-pp').textContent = on ? '⏸' : '▶'; rp.querySelector('.gmr-pp').setAttribute('aria-label', on ? 'Pause' : 'Play Kemy Radio');
  root.querySelectorAll('[data-rt]').forEach((b) => { const a = radio && +b.dataset.rt === idx; b.classList.toggle('on', a); b.setAttribute('aria-current', a ? 'true' : 'false'); });
  const sh = root.querySelector('.gmr-shuf'); sh.setAttribute('aria-pressed', String(shuffleOn())); sh.classList.toggle('on', shuffleOn());
  const rm = repeatMode(), re = root.querySelector('.gmr-rep'); re.textContent = rm === 'one' ? '🔂 Repeat one' : rm === 'off' ? '➡️ Repeat off' : '🔁 Repeat all'; re.classList.toggle('on', rm !== 'off');
  root.querySelector('.gmr-off').textContent = radioOff() ? '📻 Radio on' : '⏻ Radio off';
  root.querySelectorAll('[data-pid]').forEach((li) => li.classList.toggle('on', li.dataset.pid === pl?.id));
  root.querySelectorAll('[data-st]').forEach((b) => { const a = b.dataset.st === st?.id; b.classList.toggle('on', a); b.setAttribute('aria-pressed', a); });
  const r = root.querySelector('.gm-vol'); if (document.activeElement !== r) r.value = String(Math.round(baseVol() * 100));
}

// Show on game screens; hidden (and stopped) elsewhere.
export async function mountGameMusic(o = {}) {
  opts = { ...opts, ...o };
  await load(); await loadTheme();
  if (!document.getElementById('gm-css')) { const l = document.createElement('link'); l.id = 'gm-css'; l.rel = 'stylesheet'; l.href = BASE + 'css/gamemusic.css'; document.head.appendChild(l); }
  if (!root) {
    root = document.createElement('div'); root.className = 'gm'; root.id = 'game-music';
    root.innerHTML = `<button type="button" class="gm-fab" aria-expanded="false" aria-controls="gm-panel"><span aria-hidden="true">🎵</span></button>
      <div class="gm-radio" role="group" aria-label="Kemy Radio"><button type="button" class="gmr-info"><span class="gmr-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="gmr-mq"><span class="gmr-t"></span></span></button><button type="button" class="gmr-prev" aria-label="Previous song">⏮</button><button type="button" class="gmr-pp" aria-label="Play">▶</button><button type="button" class="gmr-next" aria-label="Next song">⏭</button></div>
      <div class="gmr-toast" role="status" hidden></div>
      <section class="gm-panel" id="gm-panel" role="region" aria-label="Game music" hidden>
        <div class="gm-top"><b>📻 Kemy Radio</b><button type="button" class="gm-x" aria-label="Collapse music player">▾</button></div>
        <ol class="gmr-list">${themeTracks.map((t, i) => `<li><button type="button" data-rt="${i}">${t.cover ? `<img class="gmr-cover" src="${esc(t.cover)}" alt="" width="44" height="44">` : ''}<span class="gmr-meta"><b>${esc(t.title)}</b><small>${esc(t.artist)}${t.dur ? ` · ${Math.floor(t.dur / 60)}:${String(Math.round(t.dur % 60)).padStart(2, '0')}` : ''}</small>${t.credit ? `<small class="gmr-credit">${esc(t.credit)}</small>` : ''}</span></button></li>`).join('')}</ol>
        <div class="gmr-opts"><button type="button" class="gmr-shuf" aria-pressed="false">🔀 Shuffle</button><button type="button" class="gmr-rep">🔁 Repeat all</button><button type="button" class="gmr-off">⏻ Radio off</button></div>
        <label class="gm-vrow"><span aria-hidden="true">🔉</span><span class="sr-only">Music volume</span><input class="gm-vol" type="range" min="0" max="100" step="1"></label>
        <div class="gm-top gm-more"><b>🎧 My Playlist</b></div>
        <form class="gmp-add"><label for="gmp-url" class="sr-only">Paste playlist link</label><input id="gmp-url" type="url" inputmode="url" placeholder="Paste playlist link (Spotify / Apple Music)" autocomplete="off"><button class="btn btn-sm" type="submit">Save</button></form>
        <p class="gmp-err gm-err small" role="alert"></p>
        <ul class="gmp-list"></ul>
        <p class="gm-cr small muted">Saved on this device only. Previews for everyone; full songs if you’re signed in to Spotify Premium or Apple Music.</p>
        <div class="gm-top gm-more"><b>More game music</b></div>
        <div class="gm-st">${stations.map((s) => `<button type="button" data-st="${s.id}" aria-pressed="false">${s.emoji} ${esc(s.name)}</button>`).join('')}</div>
        <div class="gm-row"><button type="button" class="gm-pp" aria-label="Play music">▶</button><button type="button" class="gm-next" aria-label="Skip track">⏭</button><div class="gm-now"></div></div>
        <form class="gm-link"><label for="gm-url" class="sr-only">Apple Music or Spotify link</label><input id="gm-url" type="url" inputmode="url" placeholder="Paste an Apple Music or Spotify link" autocomplete="off"><button class="btn btn-sm" type="submit">Play</button></form>
        <p class="gm-err small" role="alert"></p>
        <div class="gm-embed"></div>
        <p class="gm-cr small muted">Free music: CC0 tracks (see Credits), Kemy songs, or your own Apple Music / Spotify link.</p>
      </section>`;
    document.body.appendChild(root);
    const panel = root.querySelector('.gm-panel'), fab = root.querySelector('.gm-fab');
    const setOpen = (v) => { panel.hidden = !v; fab.setAttribute('aria-expanded', v); root.classList.toggle('open', v); ls.set(K.open, v ? '1' : '0'); card?.classList.toggle('pnl', v); };
    fab.onclick = () => setOpen(panel.hidden);
    // in the Park / 3D games the player is just the 🎵 button: the panel is a popover that closes on any tap outside it
    const gameMode = () => document.body.classList.contains('p3-on') || document.documentElement.classList.contains('kz-game');
    if (gameMode() && !panel.hidden) setOpen(false);
    document.addEventListener('pointerdown', (e) => { if (!panel.hidden && gameMode() && !root.contains(e.target) && !(card && card.contains(e.target))) setOpen(false); }, true);
    root.querySelector('.gm-x').onclick = () => setOpen(false);
    root.querySelector('.gm-pp').onclick = () => (isPlaying() ? pause() : play());
    root.querySelector('.gm-next').onclick = () => next();
    root.querySelector('.gmr-info').onclick = () => setOpen(panel.hidden);
    root.querySelector('.gmr-prev').onclick = () => (st && st.tracks.length && !embed ? prev() : radioPlay());
    root.querySelector('.gmr-pp').onclick = () => radioToggle();
    root.querySelector('.gmr-next').onclick = () => (st && st.tracks.length && !embed ? next() : radioPlay());
    root.querySelector('.gmr-list').onclick = (e) => { const b = e.target.closest('[data-rt]'); if (b) radioPlay(+b.dataset.rt); };
    root.querySelector('.gmr-shuf').onclick = () => setShuffle(!shuffleOn());
    root.querySelector('.gmr-rep').onclick = () => setRepeat({ all: 'one', one: 'off', off: 'all' }[repeatMode()]);
    root.querySelector('.gmr-off').onclick = () => (radioOff() ? radioPlay() : turnRadioOff());
    root.querySelector('.gm-st').onclick = async (e) => { const b = e.target.closest('[data-st]'); if (!b) return; if (b.dataset.st === 'theme' && radioOff() && !e.isTrusted) { await pick('theme'); return; } await pick(b.dataset.st); startTrack(); };
    root.querySelector('.gm-vol').oninput = (e) => setVolume(e.target.value / 100);
    root.querySelector('.gmp-add').onsubmit = (e) => { e.preventDefault(); addPlaylist(root.querySelector('#gmp-url').value); };
    root.querySelector('.gmp-list').onclick = (e) => {
      const li = e.target.closest('[data-pid]'); if (!li) return; const id = li.dataset.pid;
      if (e.target.closest('.gmp-play')) playPlaylist(id);
      else if (e.target.closest('.gmp-del')) { if (pl?.id === id) closeEmbed(); savePl(playlists().filter((p) => p.id !== id)); drawPl(); }
      else if (e.target.closest('.gmp-ren')) { const a = playlists(), p = a.find((x) => x.id === id); const n = prompt('Rename playlist', p.name); if (n && n.trim()) { p.name = n.trim().slice(0, 40); savePl(a); if (pl?.id === id) { pl = p; card.querySelector('.gmp-name').textContent = p.name; } drawPl(); } }
    };
    root.querySelector('.gm-link').onsubmit = (e) => { e.preventDefault(); openLink(root.querySelector('#gm-url').value); };
    // Videos / other players starting take over; the tab going hidden pauses (resumes when back if it was playing).
    addEventListener('kemy:media-play', (e) => { const s = e.detail?.source || ''; if (!s.startsWith(SRC) && isPlaying()) { pause(); } });
    let resume = false;
    document.addEventListener('visibilitychange', () => { if (document.hidden) { resume = isPlaying(); if (resume) audio.pause(); } else if (resume) { resume = false; startTrack(); } });
    await pick(ls.get(K.st) || 'chill'); drawPl();
  }
  root.hidden = false; root.classList.toggle('top-right', opts.corner === 'top-right'); paint();
  return root;
}
export function hideGameMusic() { if (!root) return; pause(); volOverride = null; closeEmbed(); root.hidden = true; }
