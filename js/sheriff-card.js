// Tiny entry cards for "The Sheriff of Lone Keem" (the series page + player live in js/sheriff.js, loaded on demand).
import { SHERIFF_EPISODES, SHERIFF_PROGRESS_KEY as KEY, isOut } from './sheriff-data.js';
const ART = 'assets/series/sheriff/';

function cta() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { p = {}; }
  const out = SHERIFF_EPISODES.filter(isOut);
  if (!out.some((e) => p[e.n] && (p[e.n].t > 5 || p[e.n].done))) return 'Watch now';
  const e = out.find((x) => !(p[x.n] && p[x.n].done));
  return e ? `Resume Ep ${e.n}` : 'Watch again';
}

function newLine() {
  const out = SHERIFF_EPISODES.filter(isOut).length, all = SHERIFF_EPISODES.length;
  return out < all ? `New animated western · ${out} of ${all} episodes out now` : `Animated western · ${all} episodes`;
}

/** kind: 'explore' (wide featured card), 'slide' (For You feed slide), 'tile' (Movies Originals row). */
export function sheriffCard(kind = 'explore') {
  if (kind === 'tile') {
    return `<a class="wtile movie stile sh-tile" href="#/series/sheriff" title="The Sheriff of Lone Keem"><span class="wart"><img src="${ART}ep1.webp" alt="" loading="lazy" decoding="async"><span class="sb-series">Series</span><span class="wb-pick">Original</span></span><span class="wmeta"><b>The Sheriff of Lone Keem</b><small>Lone Keem Studios · Everyone</small></span></a>`;
  }
  if (kind === 'slide') {
    return `<section class="vslide vend vdon vsh-promo" aria-label="The Sheriff of Lone Keem, a Lone Keem Studios Original"><div class="vend-inner vsh-in">
      <img class="vsh-art" src="${ART}ep1.webp" alt="" loading="lazy" decoding="async">
      <span class="sh-orig">Lone Keem Studios Original</span>
      <b class="vsh-t">The Sheriff of Lone Keem</b>
      <small><span class="sh-badge">Everyone</span> ${newLine()}</small>
      <a class="btn" href="#/series/sheriff">▶ ${cta()}</a>
      <button type="button" class="btn btn-ghost btn-sm vsh-skip" data-vsh-skip>Keep scrolling ↓</button>
    </div></section>`;
  }
  return `<a class="sh-feat" href="#/series/sheriff" style="--bg:url('${new URL(ART + 'hero.webp', document.baseURI).href}')"><span class="sh-feat-in"><span class="sh-orig">Lone Keem Studios Original</span><b>The Sheriff of Lone Keem</b><small><span class="sh-badge">Everyone</span> ${newLine()}</small><span class="sh-feat-cta">▶ ${cta()}</span></span></a>`;
}

const prog = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Studio profile: hero banner + the released episodes as cards (each opens the player). */
export function sheriffStudio() {
  const p = prog();
  const cards = SHERIFF_EPISODES.filter(isOut).map((e) => {
    const w = p[e.n] || {}, pct = w.done ? 100 : w.t && e.dur ? Math.min(100, Math.round((100 * w.t) / e.dur)) : 0;
    return `<a class="sh-epc" href="#/series/sheriff/${e.n}" aria-label="Episode ${e.n}: ${e.title}, ${mmss(e.dur)}${w.done ? ', watched' : ''}">
      <span class="sh-epc-art"><img src="${ART}ep${e.n}.webp" alt="" loading="lazy" decoding="async"><span class="sh-epc-dur">${mmss(e.dur)}</span>${w.done ? '<span class="sh-epc-ok" aria-hidden="true">✓</span>' : ''}${pct ? `<span class="sh-epc-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>` : ''}</span>
      <small>Episode ${e.n}</small><b>${e.title}</b></a>`;
  }).join('');
  return `<section class="sh-studio" aria-label="The Sheriff of Lone Keem, a Lone Keem Studios Original series">
    <div class="row sh-studio-h"><h2>📺 The Sheriff of Lone Keem</h2><a class="small" href="#/series/sheriff">See series</a></div>
    ${sheriffCard('explore')}
    <div class="sh-eprow">${cards}</div></section>`;
}

/** Profile posts / movies grid: one tile per released episode (opens the player). */
export function sheriffGridTiles() {
  const p = prog();
  return SHERIFF_EPISODES.filter(isOut).map((e) => `<a class="gtile k-video sh-gtile" href="#/series/sheriff/${e.n}" aria-label="The Sheriff of Lone Keem, Episode ${e.n}: ${e.title}"><img src="${ART}ep${e.n}.webp" alt="" loading="lazy" decoding="async"><span class="gicon"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg></span><span class="sh-gt">Ep ${e.n}${p[e.n]?.done ? ' ✓' : ''}</span></a>`).join('');
}

/** For You: Episode 1 as a normal (static-file) feed video, attributed to the studio. */
export function sheriffFeedPost(studioUid = 'studio') {
  const e = SHERIFF_EPISODES.find((x) => x.n === 1 && isOut(x));
  if (!e) return null;
  return {
    id: 'sheriff-ep1', external: true, sheriff: true, kind: 'sheriff', mediaType: 'video',
    mediaUrl: ART + 'ep1.mp4', poster: ART + 'ep1.webp', authorId: studioUid, authorName: 'Lone Keem Studios',
    authorUsername: 'lonekeemstudios', source: 'Lone Keem Studios', cat: '', dur: e.dur,
    text: `The Sheriff of Lone Keem · Episode 1: ${e.title}`,
    linkUrl: location.origin + location.pathname + '#/series/sheriff', published: '2026-10-26T12:00:00Z'
  };
}
export const SHERIFF_COUNT = () => SHERIFF_EPISODES.filter(isOut).length;
