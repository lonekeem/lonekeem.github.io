// App-wide autoplay for videos outside the full-screen For You feed (Posts, profiles, post pages,
// Movies/Songs/Originals players, search). Written by Lone Keem.
// Plays the one video that is >= 60 % in view, muted + playsinline (the only way iOS allows it),
// pauses it when it scrolls away, and shows a "Tap for sound" button that remembers the choice for
// this session. YouTube iframes marked data-kemy-yt use the IFrame Player API; ones that truly can't
// play here (errors 100/101/150) are hidden and flagged. A slow start just shows a big tap-to-play.
import { canAutoplay, soundOn, setSoundOn, claimAudio, loadYT } from './autoplay.js';
import { isHardYtError, markYtBlocked } from './ytcheck.js';
const SEL = '.post-media video, .wplayer video, video[data-ap], iframe[data-kemy-yt]';
let current = null;
const blockedUI = () => document.hidden || !!document.querySelector('.modal-backdrop .yt-sheet, .mm-root, .live-room');
function cardOf(el) { return el.closest('.post, article, .card, .wcard, .post-media') || el.parentElement; }
function soundBtn(el, setMuted) {
  const host = el.closest('.post-media, .wplayer, .embed') || el.parentElement; if (!host || host.querySelector('.ap-sound')) return;
  host.classList.add('ap-host');
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ap-sound';
  const paint = () => { const on = soundOn(); b.textContent = on ? '🔊' : '🔇 Tap for sound'; b.setAttribute('aria-label', on ? 'Mute' : 'Unmute'); b.classList.toggle('on', on); };
  b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); setSoundOn(!soundOn()); paint(); setMuted(!soundOn()); if (soundOn()) claimAudio('feed'); document.querySelectorAll('.ap-sound').forEach((x) => { if (x !== b) x.dispatchEvent(new Event('kemy-paint')); }); };
  b.addEventListener('kemy-paint', paint); paint(); host.appendChild(b);
}
function tapToPlay(el, play) {
  const host = el.closest('.post-media, .wplayer, .embed') || el.parentElement; if (!host || host.querySelector('.ap-tap')) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'ap-tap'; b.setAttribute('aria-label', 'Tap to play'); b.innerHTML = '<span>▶</span><small>Tap to play</small>';
  b.onclick = (e) => { e.stopPropagation(); b.remove(); play(true); }; host.appendChild(b);
}
function ctl(el) {
  if (el._ap) return el._ap;
  if (el.tagName === 'VIDEO') {
    el.muted = true; el.defaultMuted = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', ''); el.setAttribute('muted', ''); el.loop = true;
    el._ap = { play: (user) => { el.muted = user ? false : !soundOn(); if (user) setSoundOn(true); if (!el.muted) claimAudio('feed');
        el.play().catch(() => { el.muted = true; el.play().catch(() => tapToPlay(el, el._ap.play)); }); },
      pause: () => { try { el.pause(); } catch { /* */ } }, mute: (m) => { el.muted = m; } };
    soundBtn(el, (m) => { el.muted = m; });
    return el._ap;
  }
  // YouTube iframe
  const id = el.dataset.kemyYt; let pl = null, ok = false, timer = 0, want = false;
  const src = new URL(el.src, location.href);
  if (!src.searchParams.get('enablejsapi')) { ['enablejsapi=1', 'mute=1', 'playsinline=1', 'autoplay=0', 'rel=0'].forEach((kv) => { const [k, v] = kv.split('='); src.searchParams.set(k, v); }); src.searchParams.set('origin', location.origin); el.src = src.href; }
  el.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen'); el.removeAttribute('loading');
  const ready = loadYT().then((YT) => new Promise((res) => { pl = new YT.Player(el, { events: {
    onReady: () => res(pl),
    onStateChange: (e) => { if (e.data === 1) { ok = true; clearTimeout(timer); el.parentElement?.parentElement?.querySelector('.ap-tap')?.remove(); if (!pl.isMuted()) claimAudio('feed'); } },
    onError: (e) => { if (isHardYtError(e.data)) { markYtBlocked(id, 'err' + e.data, el.dataset.postId || ''); const c = cardOf(el); if (c) c.hidden = true; } }
  } }); })).catch(() => null);
  el._ap = { play: (user) => { want = true; ready.then((p) => { if (!p || !want) return; try { if (user) setSoundOn(true); if (soundOn() || user) p.unMute(); else p.mute(); p.playVideo(); } catch { /* */ }
        clearTimeout(timer); timer = setTimeout(() => { if (!ok && want) tapToPlay(el, el._ap.play); }, 4000); }); },
    pause: () => { want = false; clearTimeout(timer); try { pl?.pauseVideo?.(); } catch { /* */ } },
    mute: (m) => { try { m ? pl?.mute() : pl?.unMute(); } catch { /* */ } } };
  soundBtn(el, (m) => el._ap.mute(m));
  return el._ap;
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => {
  const el = e.target;
  if (e.isIntersecting && (e.intersectionRatio >= 0.6 || e.intersectionRect.height >= innerHeight * 0.6)) {   // tall videos: most of the screen counts
    if (!canAutoplay() || blockedUI() || el.closest('.vfeed')) return;
    if (current && current !== el) current._ap?.pause();
    current = el; ctl(el).play(false);
  } else if (el._ap) { el._ap.pause(); if (current === el) current = null; }
}), { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] }) : null;
function scan(root) { if (!io) return; (root.querySelectorAll ? root : document).querySelectorAll(SEL).forEach((el) => { if (el._apSeen || el.matches('[data-ap-modal]') || el.closest('.vfeed, .cam-view, .lv-video, .pv-el, .ed-src')) return; el._apSeen = true; io.observe(el); }); }
export function startAutoplayAll() {
  scan(document);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.(SEL)) scan(n.parentElement || document); else scan(n); } }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) current?._ap?.pause(); });
  // Something else (Kemy Radio, theme, a song) started: pause our muted video only if it has sound.
  addEventListener('kemy:media-play', (e) => { const s = e.detail?.source; if (s && s !== 'feed' && s !== 'kemy-sound' && current) { current._ap?.pause(); } });
}
