// One Settings page for Kemy. Links to controls that already exist and saves a copy on the profile.
// Written by Lone Keem.
import { auth, db } from './firebase-init.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { loadSettings, saveSettings } from './controls.js';
import { getVolume as themeVol, setVolume as setThemeVol, getMode as themeMode, setMode as setThemeMode, getPick as themePick, setPick as setThemePick, TRACKS as THEME_TRACKS, PLAYLIST_CREDIT, play as playTheme, stop as stopTheme, isPlaying as themePlaying } from './theme.js';
import { setVolume as setMusicVol, setRadioEnabled } from './gamemusic.js';
import { masterVol, setMasterVol, sfxVol, setSfxVol } from './volume.js';
import { walletState } from './wallet-chip.js';
import { fxOn, setFx } from './polish.js';
import { renderDriveSettings, linkAccount } from './world/drivecfg.js';

const SHARE_URL = 'https://lonekeem.github.io/app.html';
export const APP_VERSION = '2026.10.22';
const SRC = 'kemy-hub-src';
const SAVER = 'kemy-fps-saver';
const PREV = 'kemy-fps-prev';
const SCREEN = 'kemy-screen-fix';
let G = null;
const gfx = () => (G = G || import('./gfx.js'));

if (!document.getElementById('settings-hub-css')) {
  const l = document.createElement('link');
  l.id = 'settings-hub-css';
  l.rel = 'stylesheet';
  l.href = new URL('../css/settings-hub.css', import.meta.url).href;
  document.head.appendChild(l);
}

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
};
const clampInt = (n, a, b, d) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d;
};
const clampNum = (n, a, b, d) => {
  const v = Math.round(Number(n) * 100) / 100;
  return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d;
};
const saverOn = () => ls.get(SAVER) === '1';
const screenOn = () => ls.get(SCREEN) !== '0';

function chosenGfx() {
  if (saverOn()) {
    const prev = ls.get(PREV);
    if (prev && G.TIERS.includes(prev)) return prev;
  }
  return G.gfxSetting();
}
function snapshot() {
  const c = loadSettings();
  return {
    gfx: chosenGfx(),
    saver: saverOn(),
    fps: G.showFps(),
    screen: screenOn(),
    size: clampInt(c.size, 64, 110, 72),
    sens: clampNum(c.sens, 0.3, 2.5, 1),
    opacity: clampNum(c.opacity, 0.3, 1, 0.75),
    lefty: !!c.left,
    haptics: c.haptics !== false,
    master: clampInt(Math.round(masterVol() * 100), 0, 100, 100),
    music: clampInt(Math.round(themeVol() * 100), 0, 100, 20),
    effects: clampInt(Math.round(sfxVol() * 100), 0, 100, 100),
    radio: ls.get('kemy-radio-off') !== '1'
  };
}
let applying = false;
let cloudT = 0;
let cloudUid = null;
async function writeCloud(uid) {
  if (!uid) return false;
  try {
    await setDoc(doc(db, 'users', uid, 'prefs', 'hub'), { ...snapshot(), updatedAt: serverTimestamp() });
    return true;
  } catch { return false; }
}
function persist() {
  if (applying || !cloudUid) return;
  clearTimeout(cloudT);
  const uid = cloudUid;
  cloudT = setTimeout(() => writeCloud(uid), 450);
}
function applyCloud(d) {
  if (!d || typeof d !== 'object') return;
  applying = true;
  try {
    const tier = G.TIERS.includes(d.gfx) ? d.gfx : 'auto';
    if (d.saver === true) {
      ls.set(PREV, tier);
      ls.set(SAVER, '1');
      G.setGfxSetting('low');
    } else {
      ls.set(SAVER, '0');
      G.setGfxSetting(tier);
    }
    G.setShowFps(d.fps === true);
    ls.set(SCREEN, d.screen === false ? '0' : '1');
    dispatchEvent(new Event('kemy:screen-fix'));
    saveSettings({
      size: clampInt(d.size, 64, 110, 72),
      sens: clampNum(d.sens, 0.3, 2.5, 1),
      opacity: clampNum(d.opacity, 0.3, 1, 0.75),
      left: !!d.lefty,
      haptics: d.haptics !== false
    });
    setMasterVol(clampInt(d.master, 0, 100, 100) / 100);
    const music = clampInt(d.music, 0, 100, 20) / 100;
    setThemeVol(music);
    setMusicVol(music);
    setSfxVol(clampInt(d.effects, 0, 100, 100) / 100);
    setRadioEnabled(d.radio !== false);
  } finally { applying = false; }
}
async function sync(uid) {
  cloudUid = uid;
  let snap;
  try { snap = await getDoc(doc(db, 'users', uid, 'prefs', 'hub')); }
  catch { return; }
  if (!snap.exists()) {
    if (await writeCloud(uid)) ls.set(SRC, uid);
    return;
  }
  if (ls.get(SRC) !== uid) {
    applyCloud(snap.data());
    ls.set(SRC, uid);
  }
}

function whoText() {
  const p = window.kemyParental;
  if (!p || !p.enabled()) return 'Friends can message and invite you. A parent can change this with the parent PIN.';
  const dm = p.get('dm');
  if (dm === 'off') return 'Messages and invites are off. A parent turned them off.';
  if (dm === 'everyone') return 'Anyone can message you. A parent set this.';
  return 'Friends can message and invite you. A parent set this.';
}
const slider = (id, label, help) => `<div class="set-slider"><label for="${id}">${label} <span class="muted" id="${id}-n"></span></label><input id="${id}" type="range" min="0" max="100" step="1"><p class="muted small">${help}</p></div>`;

function html(ctx) {
  const { esc, avatar, isAdmin, S } = ctx;
  const signed = !!(S.user && S.profile);
  const admin = signed && isAdmin();
  const joy = loadSettings();
  const account = signed ? `
    <div class="set-me">${avatar({ ...S.profile, uid: S.user.uid }, '', false)}
      <div class="who"><b>${esc(S.profile.displayName)}</b><div class="muted small">@${esc(S.profile.username)}</div><div class="muted small">${esc(S.user.email || '')}</div></div></div>
    <div class="set-links">
      <a class="set-link" href="#/settings/account">Edit profile, username and avatar<span class="go" aria-hidden="true">›</span></a>
      <a class="set-link" href="#/pals">Your Pal<span class="go" aria-hidden="true">›</span></a>
      <a class="set-link" href="#/settings/interests">Your interests<span class="go" aria-hidden="true">›</span></a>
      <a class="set-link" href="#/settings/account" id="set-security">Sign-in alerts<span class="go" aria-hidden="true">›</span></a>
    </div>
    <div class="set-actions">
      <button class="btn btn-ghost" type="button" id="set-out">Sign out</button>
      ${admin ? '' : '<button class="btn btn-danger" type="button" id="set-del">Delete account</button>'}
    </div>` : `
    <p>Sign in to change your name, photo and Pal.</p>
    <a class="btn set-sign" href="#/login?next=%23%2Fsettings">Sign in</a>`;
  const ultra = G.gfxSetting() === 'ultra' || ls.get(PREV) === 'ultra';
  return `<section class="set-hub">
    <h1 class="page-title">Settings</h1>
    <p class="set-note">${signed ? 'Saved on this device, and on your profile.' : 'Saved on this device. Sign in to keep a copy on your profile.'}</p>
    <label class="sr-only" for="set-q">Search settings</label>
    <input id="set-q" class="set-q" type="search" placeholder="Try sound, graphics, parent…" autocomplete="off" enterkeyhint="search">
    <div class="set-sections" id="set-sections">
      <article class="set-sec" data-sec="account" data-k="account profile username avatar pal sign in out delete bio photo interests alerts">
        <div class="set-head"><span class="set-ic" aria-hidden="true">👤</span><h2>Account</h2></div>
        ${account}
      </article>
      <article class="set-sec" data-sec="notifications" data-k="notifications notify notification chime sound picker mute push ping master switch">
        <div class="set-head"><span class="set-ic" aria-hidden="true">🔔</span><h2>Notifications</h2></div>
        <div id="push-box"><p class="muted small">Loading notification settings…</p></div>
      </article>
      <article class="set-sec" data-sec="sound" data-k="sound music volume radio master effects theme song playlist chime">
        <div class="set-head"><span class="set-ic" aria-hidden="true">🎵</span><h2>Sound &amp; Music</h2></div>
        ${slider('set-master', 'Master', 'Turns all of Kemy’s sounds up or down together.')}
        ${slider('set-music', 'Music', 'Theme songs and in-world music.')}
        ${slider('set-fxvol', 'Effects', 'Taps, wins and other game sounds.')}
        <label class="set-row" for="set-radio"><span>In-world radio<small>On lets the park and street radio play.</small></span><input id="set-radio" type="checkbox" role="switch" ${ls.get('kemy-radio-off') === '1' ? '' : 'checked'}></label>
        <p class="muted small">Kemy’s theme plays softly on your profile and Pals, and stops for videos and games.</p>
        <div class="seg theme-seg" role="radiogroup" aria-label="Theme song">${[['play', '🎵 Play'], ['mute', '🔇 Mute'], ['off', 'Off']].map(([k, l]) => `<label><input type="radio" name="set-theme-mode" value="${k}" ${themeMode() === k || (k === 'mute' && !themeMode()) ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <label for="set-theme-pick">Playlist</label>
        <select id="set-theme-pick"><option value="all">All songs in order</option><option value="shuffle">Shuffle</option>${THEME_TRACKS.map((t, i) => `<option value="${i}">${esc(t.title)}</option>`).join('')}</select>
        <div class="set-actions"><button class="btn btn-ghost" type="button" id="set-theme" data-theme-ctl>🎵 Play theme</button></div>
        <p class="muted small">${esc(PLAYLIST_CREDIT)}</p>
      </article>
      <article class="set-sec" data-sec="graphics" data-k="graphics quality fps performance screen size zoom low medium high saver battery pal effects">
        <div class="set-head"><span class="set-ic" aria-hidden="true">✨</span><h2>Graphics &amp; Performance</h2></div>
        <p>Picture quality</p>
        <div class="set-tiers" id="set-tiers" role="radiogroup" aria-label="Picture quality" data-ultra="${ultra ? '1' : '0'}"></div>
        <p class="muted small" id="set-saver-note" hidden>FPS-saver is using Low so the game stays smooth.</p>
        <label class="set-row" for="set-saver"><span>FPS-saver<small>Uses Low graphics to help older phones.</small></span><input id="set-saver" type="checkbox" role="switch" ${saverOn() ? 'checked' : ''}></label>
        <label class="set-row" for="set-screen"><span>Keep the screen the right size<small>Stops pinch-zoom in games so the world doesn’t stretch.</small></span><input id="set-screen" type="checkbox" role="switch" ${screenOn() ? 'checked' : ''}></label>
        <label class="set-row" for="set-fx"><span>Fancy effects<small>Glass blur and the animated background.</small></span><input id="set-fx" type="checkbox" ${fxOn() ? 'checked' : ''}></label>
        <label for="set-pal-gfx">Pal graphics</label>
        <select id="set-pal-gfx"><option value="ultra">Ultra</option><option value="high">High</option><option value="low">Low</option><option value="flat">2D art</option></select>
        <label class="set-row" for="set-pal-dance"><span>Pals dance to music</span><input id="set-pal-dance" type="checkbox" disabled></label>
        <label class="set-row" for="set-pal-keep"><span>Keep Pal on screen while scrolling</span><input id="set-pal-keep" type="checkbox" disabled></label>
      </article>
      <article class="set-sec" data-sec="controls" data-k="controls drive joystick steering sensitivity button size opacity camera wheel tilt look haptics left">
        <div class="set-head"><span class="set-ic" aria-hidden="true">🎮</span><h2>Controls</h2></div>
        <p>Walking joystick</p>
        <div class="set-slider"><label for="set-size">Button size <span class="muted" id="set-size-n">${joy.size}</span></label><input id="set-size" type="range" min="64" max="110" step="1" value="${joy.size}"></div>
        <div class="set-slider"><label for="set-sens">Look sensitivity <span class="muted" id="set-sens-n">${joy.sens}</span></label><input id="set-sens" type="range" min="0.3" max="2.5" step="0.1" value="${joy.sens}"></div>
        <div class="set-slider"><label for="set-op">Button opacity <span class="muted" id="set-op-n">${Math.round(joy.opacity * 100)}%</span></label><input id="set-op" type="range" min="0.3" max="1" step="0.05" value="${joy.opacity}"></div>
        <label class="set-row" for="set-left"><span>Left-handed<small>Swaps the walk stick and the look side.</small></span><input id="set-left" type="checkbox" ${joy.left ? 'checked' : ''}></label>
        <label class="set-row" for="set-hap"><span>Vibration</span><input id="set-hap" type="checkbox" ${joy.haptics ? 'checked' : ''}></label>
        <p>Driving, camera and drive buttons</p>
        <div id="set-drive" class="set-drive"></div>
      </article>
      <article class="set-sec" data-sec="privacy" data-k="privacy safety message invite chat filter block blocked parent pin parental">
        <div class="set-head"><span class="set-ic" aria-hidden="true">🛡️</span><h2>Privacy &amp; Safety</h2></div>
        <p><b>Who can message or invite me</b><br>${esc(whoText())}</p>
        <a class="set-link" href="#/settings/parental">Parent info<span class="go" aria-hidden="true">›</span></a>
        <p class="set-status"><i aria-hidden="true">✓</i> Chat filter: on</p>
        <p class="muted small">Kemy hides unkind words in chat. This stays on.</p>
        <h3 style="font-size:1rem;margin:10px 0 4px">Blocked players</h3>
        <div id="set-blocks">${signed ? '<p class="muted small">Loading…</p>' : '<p class="muted small">Sign in to see people you have blocked.</p>'}</div>
      </article>
      <article class="set-sec" data-sec="shop" data-k="shop coins diamonds star store buy dance wallet balance">
        <div class="set-head"><span class="set-ic" aria-hidden="true">⭐</span><h2>Shop &amp; Coins</h2></div>
        <p class="set-bal" id="set-bal"></p>
        <div class="set-links">
          <a class="set-link" href="#/pals/store">Star Coins shop<span class="go" aria-hidden="true">›</span></a>
          <a class="set-link" href="#/pals/shop">Pal shop<span class="go" aria-hidden="true">›</span></a>
          <button class="set-link" type="button" id="set-dance-shop">Dance shop<span class="go" aria-hidden="true">›</span></button>
        </div>
      </article>
      <article class="set-sec" data-sec="help" data-k="help what's new whats qr share bug report credits version intro save home screen">
        <div class="set-head"><span class="set-ic" aria-hidden="true">💜</span><h2>Help</h2></div>
        <div class="set-links">
          <a class="set-link" href="#/updates">What’s New<span class="go" aria-hidden="true">›</span></a>
          <a class="set-link" href="#/feedback">Report a bug<span class="go" aria-hidden="true">›</span></a>
          <button class="set-link" type="button" data-watch-intro>Watch intro<span class="go" aria-hidden="true">›</span></button>
          <button class="set-link" type="button" data-watch-howto>How to save Kemy<span class="go" aria-hidden="true">›</span></button>
        </div>
        <div class="set-qr-wrap">
          <img class="set-qr" alt="QR code that opens Kemy" width="180" height="180" src="assets/kemy-share-qr.svg">
          <p class="set-url">${esc(SHARE_URL)}</p>
          <div class="set-actions">
            <button class="btn" type="button" id="set-share">Share Kemy QR</button>
            <button class="btn btn-ghost" type="button" id="set-copy">Copy link</button>
          </div>
        </div>
        <p class="set-credit">Written by Lone Keem</p>
        <p class="set-ver">Version ${APP_VERSION}</p>
      </article>
      ${admin ? `<article class="set-sec admin" id="set-admin" data-sec="admin" data-k="admin members update announcement post new">
        <div class="set-head"><span class="set-ic" aria-hidden="true">👑</span><h2>Admin</h2></div>
        <div class="set-links">
          <a class="set-link" href="#/members">New Members<span class="go" aria-hidden="true">›</span></a>
          <a class="set-link" href="#/updates">Post an update<span class="go" aria-hidden="true">›</span></a>
          <a class="set-link" href="#/admin">Announcements<span class="go" aria-hidden="true">›</span></a>
        </div>
      </article>` : ''}
    </div>
    <p id="set-none" class="set-none" hidden>Nothing matches that.</p>
  </section>`;
}

function paintGfx() {
  const box = document.getElementById('set-tiers');
  if (!box) return;
  const cur = G.gfxSetting();
  const ultra = cur === 'ultra' || ls.get(PREV) === 'ultra';
  const tiers = ['auto', 'low', 'medium', 'high'].concat(ultra ? ['ultra'] : []);
  const labels = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };
  box.innerHTML = tiers.map((t) => `<button type="button" id="set-gfx-${t}" data-gfx="${t}" class="${t === cur ? 'on' : ''}" aria-pressed="${t === cur}" role="radio">${labels[t]}</button>`).join('');
  box.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      if (saverOn()) {
        ls.set(SAVER, '0');
        const saver = document.getElementById('set-saver');
        if (saver) saver.checked = false;
      }
      G.setGfxSetting(b.dataset.gfx);
      paintGfx();
      persist();
    };
  });
  const note = document.getElementById('set-saver-note');
  if (note) note.hidden = !saverOn();
}
function paintWallet(S) {
  const el = document.getElementById('set-bal');
  if (!el) return;
  if (!S.user) { el.textContent = 'Sign in to see your Star Coins and Diamonds.'; return; }
  const w = walletState();
  const fmt = (n) => (w.admin ? '∞' : n == null ? '…' : Number(n).toLocaleString('en-US'));
  el.innerHTML = `<b>${fmt(w.c)}</b> Star Coins · <b>${fmt(w.d)}</b> Diamonds`;
}
function bindSlider(id, read, write) {
  const el = document.getElementById(id);
  const n = document.getElementById(id + '-n');
  if (!el) return;
  const show = (v) => { el.value = String(v); if (n) n.textContent = v + '%'; };
  show(read());
  el.oninput = () => { write(+el.value); if (n) n.textContent = el.value + '%'; persist(); };
}

export async function page(main, ctx) {
  const { token, stale, toast, S, openDelete, getProfile, palsLoad } = ctx;
  G = await gfx();
  if (stale(token)) return;
  cloudUid = S.user ? S.user.uid : null;
  if (S.user) {
    await sync(S.user.uid);
    linkAccount(db, S.user.uid).catch(() => {});
  }
  if (stale(token)) return;
  main.innerHTML = html(ctx);
  const root = main.querySelector('.set-hub');
  if (!root) return;

  const q = document.getElementById('set-q');
  const none = document.getElementById('set-none');
  q.oninput = () => {
    const n = q.value.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('.set-sec').forEach((s) => {
      const ok = !n || (s.dataset.k || '').includes(n) || (s.querySelector('h2')?.textContent || '').toLowerCase().includes(n);
      s.hidden = !ok;
      if (ok) shown += 1;
    });
    none.hidden = shown > 0;
  };

  import('./push.js').then((m) => m.wireSettings(toast)).catch(() => {
    const b = document.getElementById('push-box');
    if (b) b.textContent = 'Notifications aren’t available right now.';
  });

  bindSlider('set-master', () => Math.round(masterVol() * 100), (v) => setMasterVol(v / 100));
  bindSlider('set-music', () => Math.round(themeVol() * 100), (v) => { const x = v / 100; setThemeVol(x); setMusicVol(x); });
  bindSlider('set-fxvol', () => Math.round(sfxVol() * 100), (v) => setSfxVol(v / 100));
  const radio = document.getElementById('set-radio');
  radio.onchange = () => { setRadioEnabled(radio.checked); persist(); };
  root.querySelectorAll('[name=set-theme-mode]').forEach((r) => {
    r.onchange = () => { setThemeMode(r.value, { start: r.value === 'play' }); toast(r.value === 'play' ? 'Theme song on' : r.value === 'mute' ? 'Theme song muted' : 'Theme song off'); };
  });
  const pick = document.getElementById('set-theme-pick');
  pick.value = themePick();
  pick.onchange = () => { setThemePick(pick.value); toast(pick.value === 'shuffle' ? 'Shuffling theme songs' : pick.value === 'all' ? 'Playing all theme songs' : 'Playing that song'); };
  const themeBtn = document.getElementById('set-theme');
  const paintTheme = () => { themeBtn.textContent = themePlaying() ? '⏸ Stop theme' : '🎵 Play theme'; };
  themeBtn.onclick = async () => { if (themePlaying()) stopTheme(); else await playTheme({ force: true }); paintTheme(); };
  document.addEventListener('kemy-theme', paintTheme);
  S.unsubs.push(() => document.removeEventListener('kemy-theme', paintTheme));

  paintGfx();
  const saver = document.getElementById('set-saver');
  saver.onchange = () => {
    if (saver.checked) {
      const cur = G.gfxSetting();
      if (cur !== 'low') ls.set(PREV, cur);
      else if (!ls.get(PREV)) ls.set(PREV, 'auto');
      ls.set(SAVER, '1');
      G.setGfxSetting('low');
    } else {
      ls.set(SAVER, '0');
      const prev = ls.get(PREV);
      if (prev && G.TIERS.includes(prev)) G.setGfxSetting(prev);
    }
    paintGfx();
    persist();
  };
  const screen = document.getElementById('set-screen');
  screen.onchange = () => {
    ls.set(SCREEN, screen.checked ? '1' : '0');
    dispatchEvent(new Event('kemy:screen-fix'));
    persist();
  };
  document.getElementById('set-fx').onchange = (e) => { setFx(e.target.checked); toast(e.target.checked ? 'Fancy effects on' : 'Fancy effects off'); };
  const palGfx = document.getElementById('set-pal-gfx');
  import('./pals/pal3d.js').then((m) => {
    if (!palGfx.isConnected) return;
    palGfx.value = m.gfxLevel();
    palGfx.onchange = () => { m.setGfx(palGfx.value); toast(palGfx.value === 'flat' ? 'Pals use 2D art' : 'Pal graphics: ' + palGfx.value); };
  }).catch(() => { palGfx.disabled = true; });
  Promise.all([import('./pals/dance.js'), import('./pals/dance-ui.js')]).then(([{ danceEnabled, setDanceEnabled }, { keepOn, setKeep }]) => {
    const d = document.getElementById('set-pal-dance');
    const k = document.getElementById('set-pal-keep');
    if (!d || !k || !d.isConnected) return;
    d.checked = danceEnabled(); k.checked = keepOn(); d.disabled = k.disabled = false;
    d.onchange = (e) => { setDanceEnabled(e.target.checked); toast(e.target.checked ? 'Pals will dance to music' : 'Pal dancing off'); };
    k.onchange = (e) => { setKeep(e.target.checked); toast(e.target.checked ? 'Your Pal stays on screen' : 'Floating Pal off'); };
  }).catch(() => {});

  const saveJoy = () => {
    const size = clampInt(document.getElementById('set-size').value, 64, 110, 72);
    const sens = clampNum(document.getElementById('set-sens').value, 0.3, 2.5, 1);
    const opacity = clampNum(document.getElementById('set-op').value, 0.3, 1, 0.75);
    document.getElementById('set-size-n').textContent = String(size);
    document.getElementById('set-sens-n').textContent = String(sens);
    document.getElementById('set-op-n').textContent = Math.round(opacity * 100) + '%';
    saveSettings({ size, sens, opacity, left: document.getElementById('set-left').checked, haptics: document.getElementById('set-hap').checked });
    persist();
  };
  ['set-size', 'set-sens', 'set-op', 'set-left', 'set-hap'].forEach((id) => {
    document.getElementById(id).oninput = saveJoy;
    document.getElementById(id).onchange = saveJoy;
  });
  renderDriveSettings(document.getElementById('set-drive'));

  paintWallet(S);
  const balT = setTimeout(() => paintWallet(S), 700);
  S.unsubs.push(() => clearTimeout(balT));
  document.getElementById('set-dance-shop').onclick = () => {
    const go = palsLoad ? palsLoad() : Promise.resolve();
    Promise.resolve(go).then(() => dispatchEvent(new Event('kemy:dance-shop'))).catch(() => toast('The Dance Shop isn’t available right now.'));
  };

  const sec = document.getElementById('set-security');
  if (sec) sec.onclick = () => { try { sessionStorage.setItem('lks-focus-security', '1'); } catch { /* */ } };
  const out = document.getElementById('set-out');
  if (out) out.onclick = async () => { await signOut(auth); location.hash = '#/feed'; };
  const del = document.getElementById('set-del');
  if (del && openDelete) del.onclick = () => openDelete();

  if (S.user) loadBlocks(ctx);

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'Kemy', text: 'Come play Kemy', url: SHARE_URL }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    copy();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(SHARE_URL); toast('Link copied'); }
    catch { toast(SHARE_URL); }
  };
  document.getElementById('set-share').onclick = share;
  document.getElementById('set-copy').onclick = copy;
}

async function loadBlocks(ctx) {
  const { S, esc, getProfile, toast } = ctx;
  const box = document.getElementById('set-blocks');
  if (!box || !S.user) return;
  try {
    const snap = await getDocs(collection(db, 'users', S.user.uid, 'blocks'));
    if (!box.isConnected) return;
    if (!snap.size) { box.innerHTML = '<p class="muted small">You haven’t blocked anyone.</p>'; return; }
    const rows = await Promise.all(snap.docs.map(async (d) => {
      const u = getProfile ? await getProfile(d.id).catch(() => null) : null;
      const name = u ? esc(u.displayName) : 'Player';
      const handle = u && u.username ? '@' + esc(u.username) : '';
      return `<div class="set-block"><span>${name} <small class="muted">${handle}</small></span><button type="button" data-unblock="${esc(d.id)}" data-name="${handle || name}">Unblock</button></div>`;
    }));
    if (!box.isConnected) return;
    box.innerHTML = rows.join('');
    box.querySelectorAll('[data-unblock]').forEach((b) => {
      b.onclick = async () => {
        try {
          await deleteDoc(doc(db, 'users', S.user.uid, 'blocks', b.dataset.unblock));
          S.blocked.delete(b.dataset.unblock);
          b.closest('.set-block')?.remove();
          toast('Unblocked ' + (b.dataset.name || 'that player'));
          if (!box.querySelector('.set-block')) box.innerHTML = '<p class="muted small">You haven’t blocked anyone.</p>';
        } catch { toast('Couldn’t unblock them. Try again.'); }
      };
    });
  } catch {
    if (box.isConnected) box.textContent = 'Blocked players aren’t available right now.';
  }
}
