// 🎬 Theater hush: inside Lone Keem Studio (lobby + auditorium) the only sound is the movie (or an owner-started theater song).
// Local to this player only: pauses the 🎵 player / Kemy radio, the theme, a minimized house radio (audio or YouTube/Spotify embed),
// any other page <audio>/<video> and Pal speech, then resumes exactly what was playing when you walk out. Never writes shared radio state.
const isMedia = (m) => m && typeof m.pause === 'function' && 'paused' in m && m.tagName;
const audible = (m) => isMedia(m) && !m.paused && !m.ended && !m.muted && m.volume > 0;
const ytFrames = () => [...document.querySelectorAll('.kh-radio iframe.kh-yt')];
const yt = (f, func) => { try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*'); } catch { /* */ } };
const stopSpeech = () => { try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel(); } catch { /* */ } };

export function createTheaterHush({ ours, say }) {
  let on = false, saved = [], embWas = false, toldAt = 0;
  const all = () => { const s = new Set(window.__kemyAud || []); document.querySelectorAll('audio, video').forEach((m) => s.add(m)); return [...s]; };
  const mine = (m) => { try { return ours().includes(m); } catch { return false; } };
  // pause every other source; returns how many were stopped
  function sweep() {
    let n = 0;
    for (const m of all()) { if (!isMedia(m) || mine(m) || m.paused) continue; try { m.pause(); n++; } catch { /* */ } }
    if ([...(window.__kemyAud || [])].some((m) => !isMedia(m) && m && m.paused === false)) { ytFrames().forEach((f) => yt(f, 'pauseVideo')); n++; }
    stopSpeech(); return n;
  }
  function enter() {
    if (on) return; on = true;
    saved = all().filter((m) => audible(m) && !mine(m));
    embWas = [...(window.__kemyAud || [])].some((m) => !isMedia(m) && m && m.paused === false);
    // tell embeds / the 🎵 player / the theme to stop (they each listen for this); the sweep catches anything else
    dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'theater' } }));
    sweep(); addEventListener('kemy:media-play', onOther); dispatchEvent(new CustomEvent('kemy:theater-hush', { detail: { on: true } })); // Spotify / Apple house radio (homes.js)
  }
  // something started while inside (🎵 player, a house radio tap, a Pal): keep it paused, the movie wins
  function onOther(e) {
    const s = e.detail && e.detail.source; if (!on || s === 'theater') return;
    setTimeout(() => { if (on && sweep() && say && Date.now() - toldAt > 8000) { toldAt = Date.now(); say('🎬 Music stays paused in the theater. Only the movie plays in here!'); } }, 0);
  }
  function tick() { if (on) sweep(); }
  function leave() {
    if (!on) return; on = false; removeEventListener('kemy:media-play', onOther);
    const list = saved; saved = [];
    for (const m of list) { try { if (m.isConnected === false && !(window.__kemyAud && window.__kemyAud.has(m))) continue; if (m.dataset && m.dataset.kemyTheme) { setTimeout(() => import('../theme.js').then((t) => t.play({ force: true })).catch(() => {}), 300); continue; }
      if (m.dataset && m.dataset.kemyGameMusic) { import('../gamemusic.js').then((g) => g.play()).catch(() => m.play().catch(() => {})); continue; } // via the 🎵 player so its UI + next-track logic stay in step
      if (typeof m.__resync === 'function') m.__resync(); if (m.paused) m.play().catch(() => {}); } catch { /* */ } }
    if (embWas) ytFrames().forEach((f) => yt(f, 'playVideo')); embWas = false;
    dispatchEvent(new CustomEvent('kemy:theater-hush', { detail: { on: false } }));
  }
  return { enter, leave, tick, get on() { return on; } };
}
