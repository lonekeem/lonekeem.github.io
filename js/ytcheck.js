// YouTube "can it play here?" checks. Written by Lone Keem.
// Only videos that truly can't play inside Kemy are hidden: IFrame API errors 100 (removed/private),
// 101/150 (owner turned off embedding), or a failed oEmbed check (401/403/404). Slow starts are NOT hidden.
// Results are cached in localStorage; the admin gets one report per post per device (posts are never deleted).
import { loadYT } from './autoplay.js';
const K = 'kemy-yt-blocked', HARD = [100, 101, 150];
let map; const load = () => { if (!map) { try { map = JSON.parse(localStorage.getItem(K) || '{}'); } catch { map = {}; } } return map; };
export const isYtBlocked = (id) => !!(id && load()[id]);
export const isHardYtError = (code) => HARD.includes(Number(code));
let reporter = null;
// app.js hands us a function that files a moderator report (signed-in users only, via the existing reports rules).
export function setYtReporter(fn) { reporter = fn; }
export function markYtBlocked(id, why, postId) {
  if (!id) return; const m = load(); if (m[id]) return; m[id] = { why: String(why), at: Date.now() };
  try { localStorage.setItem(K, JSON.stringify(m)); } catch { /* full */ }
  window.dispatchEvent(new CustomEvent('kemy:yt-blocked', { detail: { id, why, postId } }));
  if (postId && !/^yt-/.test(postId) && reporter) { try { reporter(postId, id, why); } catch { /* */ } }
}
// Free oEmbed check (CORS-enabled). true = embeddable, false = not embeddable, null = unknown (offline etc).
export async function oembedOk(id) {
  try {
    const r = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id), { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (r.ok) return true; if ([400, 401, 403, 404].includes(r.status)) return false; return null;
  } catch { return null; }
}
// Hidden muted test player: resolves false on a hard error, true when ready/playing, null if unsure.
export function testPlayer(id, ms = 6000) {
  return loadYT().then((YT) => new Promise((res) => {
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px;opacity:0;pointer-events:none';
    const el = document.createElement('div'); host.appendChild(el); document.body.appendChild(host);
    let done = false, pl = null;
    const end = (v) => { if (done) return; done = true; clearTimeout(t); try { pl?.destroy(); } catch { /* */ } host.remove(); res(v); };
    const t = setTimeout(() => end(null), ms);
    pl = new YT.Player(el, { videoId: id, host: 'https://www.youtube-nocookie.com', playerVars: { autoplay: 1, mute: 1, playsinline: 1, controls: 0 },
      events: { onReady: (e) => { try { e.target.mute(); e.target.playVideo(); } catch { /* */ } },
        onStateChange: (e) => { if (e.data === 1 || e.data === 3) end(true); },
        onError: (e) => end(isHardYtError(e.data) ? false : null) } });
  })).catch(() => null);
}
// Upload-time check. Returns '' when OK, or the friendly message.
export const YT_NO_EMBED = 'This YouTube video doesn’t allow playing in other apps, so it can’t be added.';
export async function checkYtForUpload(id) {
  if (!id) return '';
  const o = await oembedOk(id);
  if (o === false) { markYtBlocked(id, 'oembed'); return YT_NO_EMBED; }
  const t = await testPlayer(id);
  if (t === false) { markYtBlocked(id, 'player'); return YT_NO_EMBED; }
  return '';
}
