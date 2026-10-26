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
