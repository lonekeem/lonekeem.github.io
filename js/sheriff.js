// "The Sheriff of Lone Keem": a Lone Keem Studios Original mini-series (3 episodes, made for everyone).
// Loaded on demand from the #/series/sheriff route only, so it never slows down startup or the For You feed.
// Episodes are plain static MP4s in assets/series/sheriff/ that stream with range requests (preload
// "metadata", never in the service worker cache). Watch progress stays on this device in localStorage.
// Routes: #/series/sheriff (series page) and #/series/sheriff/<n> (full-screen player). Written by Lone Keem.
import { claimAudio } from './autoplay.js';
import { sheriffOk, sheriffAgeCard } from './sheriff-age.js';
import { SHERIFF_EPISODES, SHERIFF_PROGRESS_KEY, isOut, sheriffPostId } from './sheriff-data.js';

const DIR = 'assets/series/sheriff/';
export const SERIES = {
  id: 'sheriff', title: 'The Sheriff of Lone Keem', studio: 'Lone Keem Studios', creator: 'Keem', rating: '13+',
  tagline: 'A one-eyed lizard sheriff takes on the toughest outlaw in the little western town of Lone Keem.',
  hero: DIR + 'hero.webp',
  cast: ['Gecko', 'Big Mike', 'Mrs. Foster', 'Jimmy', 'Deputy John']
};
const DESC = {
  1: 'A stranger with an eyepatch walks into the Lone Keem saloon and gets on Big Mike’s bad side.',
  2: 'Gecko hitches a ride with Mrs. Foster, a rancher who can keep a secret.',
  3: 'Big Mike’s gang comes knocking at the Foster ranch, and Gecko is ready.'
};
// Release state lives in js/sheriff-data.js (`released: true/false` per episode).
export const EPISODES = SHERIFF_EPISODES.map((e) => ({ ...e, desc: DESC[e.n] || '', src: `${DIR}ep${e.n}.mp4`, poster: `${DIR}ep${e.n}.webp` }));
const OUT = () => EPISODES.filter(isOut);

// ------------------------------------------------------------ progress (this device only)
export const PROGRESS_KEY = SHERIFF_PROGRESS_KEY;
const DONE_LEFT = 20; // seconds before the end that count as "watched" (credits / next-time tease)
export function readProgress() {
  try { const v = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
function writeProgress(n, t, d, done) {
  const all = readProgress(); const old = all[n] || {};
  all[n] = { t: Math.max(0, Math.round(t || 0)), d: Math.round(d || old.d || 0), done: !!(done || old.done), at: Date.now() };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(all)); } catch { /* private mode / full: progress just isn't kept */ }
}
const isDone = (w) => !!(w && w.done);
const resumeAt = (w) => (w && w.t > 5 && (!w.d || w.t < w.d - DONE_LEFT) ? w.t : 0); // a watched episode can still be part-way through a rewatch
// Play/Resume target: the most recent unfinished episode, else the first unwatched, else episode 1.
export function nextUp(prog = readProgress()) {
  let best = null;
  for (const e of OUT()) { const w = prog[e.n]; if (resumeAt(w) && (!best || w.at > prog[best.n].at)) best = e; }
  if (best) return { ep: best, resume: resumeAt(prog[best.n]) };
  const fresh = OUT().find((e) => !isDone(prog[e.n]));
  return { ep: fresh || EPISODES[0], resume: 0, again: !fresh };
}
export const clock = (s) => { s = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const mins = (s) => `${Math.max(1, Math.round(s / 60))} min`;
// The app title lives in app.html. The player changes it per episode and must put it back
// on the series page and on every other page.
const APP_TITLE = document.title;
function restoreTitle() {
  if (/^#\/?series\/sheriff\/\d/.test(location.hash || '')) return; // the open player sets the episode title
  document.title = APP_TITLE;
}

function loadCss() {
  if (document.getElementById('sheriff-css')) return;
  const l = document.createElement('link'); l.id = 'sheriff-css'; l.rel = 'stylesheet'; l.href = 'css/sheriff.css?v=3'; document.head.appendChild(l);
}
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
const STAR = '<svg class="star-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>';
const CMT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/></svg>';
const XIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

// ------------------------------------------------------------ series page
export function page(main, { ep, toast, social } = {}) {
  loadCss();
  // Rated 13+: under 13 / unknown age (trusted birthday, js/sheriff-age.js) get the friendly card, never the player
  if (!sheriffOk()) { document.body.classList.remove('sh-playing'); restoreTitle(); main.innerHTML = sheriffAgeCard(); return; }
  if (ep) return player(main, Number(ep), { toast, social });
  document.body.classList.remove('sh-playing');
  restoreTitle();
  addEventListener('hashchange', () => { fromSeries = /^#\/series\/sheriff\/\d$/.test(location.hash); }, { once: true });
  const prog = readProgress(); const up = nextUp(prog);
  const label = up.resume ? `Resume Episode ${up.ep.n} · ${clock(up.resume)}` : up.again ? (OUT().length > 1 ? 'Watch again from Episode 1' : 'Watch Episode 1 again') : `Play Episode ${up.ep.n}`;
  const out = OUT().length, soon = EPISODES.length - out;
  const total = EPISODES.reduce((s, e) => s + e.dur, 0);
  main.innerHTML = `
    <div class="sh-page">
      <a class="sh-back-link" href="#/explore/movies">${BACK}<span>Movies</span></a>
      <section class="sbanner sh-hero" style="--bg:url('${esc(new URL(SERIES.hero, document.baseURI).href)}')" aria-labelledby="sh-title">
        <div class="sbanner-in">
          <span class="sb-series">LONE KEEM STUDIOS ORIGINAL</span>
          <h1 id="sh-title">${esc(SERIES.title)}</h1>
          <p class="ssub"><span class="sh-rating" title="Rated 13+">${esc(SERIES.rating)}</span> Western · ${EPISODES.length} episodes${soon ? ` · ${out === 1 ? 'Episode 1' : out + ' episodes'} out now` : ` · ${mins(total)}`} · No ads</p>
          <p class="sh-tagline">${esc(SERIES.tagline)}</p>${soon ? '' : '<p class="sh-more-badge"><span>🤠 More episodes coming soon</span></p>'}
          <div class="sacts"><a class="btn sh-play" id="sh-play" href="#/series/sheriff/${up.ep.n}">${PLAY}<span>${esc(label)}</span></a></div>
        </div>
      </section>
      <h2 class="sseason-h">Episodes</h2>
      <ol class="seps sh-eps">${EPISODES.map((e) => { if (!isOut(e)) return lockedCard(e); const w = prog[e.n]; const r = resumeAt(w); const done = isDone(w);
        const pct = done ? 1 : r && w.d ? Math.min(1, r / w.d) : 0;
        return `<li><a class="sep sh-ep ${r ? 'cont' : ''}" href="#/series/sheriff/${e.n}" data-ep="${e.n}" aria-label="Episode ${e.n}: ${esc(e.title)}, ${clock(e.dur)}${done ? ', watched' : r ? ', resume at ' + clock(r) : ''}">
          <span class="sep-th sh-th"><img src="${esc(e.poster)}" alt="" width="540" height="868" loading="lazy" decoding="async"><span class="sep-rt">${clock(e.dur)}</span>${pct ? `<span class="sep-pr"><span style="width:${Math.round(pct * 100)}%"></span></span>` : ''}${done ? '<span class="sh-check" aria-hidden="true">✓</span>' : ''}</span>
          <span class="sep-m"><span class="sep-l">Episode ${e.n}</span><b>${esc(e.title)}</b>${r ? `<span class="sep-cw">Resume at ${clock(r)}</span>` : done ? '<span class="sep-done">✓ Watched</span>' : ''}<small>${clock(e.dur)}</small><small class="sep-d">${esc(e.desc)}</small></span></a></li>`; }).join('')}</ol>
      ${soon ? '' : `<section class="sh-more" aria-label="More episodes coming soon"><span class="sh-more-ic" aria-hidden="true">🤠</span><div><b>More episodes coming soon</b><p>That’s all of Season 1 for now. Gecko will be back in Lone Keem soon, so saddle up for more adventures.</p></div></section>`}
      <section class="sh-about">
        <h2 class="sseason-h">About the series</h2>
        <p>A western set in the dusty town of Lone Keem (pop. 42). Starring Gecko, a lizard sheriff with an eyepatch, with Big Mike, Mrs. Foster, Jimmy and Deputy John.</p>
        <p class="small muted">Created by ${esc(SERIES.creator)} · A ${esc(SERIES.studio)} production · Rated ${esc(SERIES.rating)} · No ads</p>
      </section>
    </div>`;
  if (social) cardCounts(main, social);
}
// Small star / comment counts on the episode cards (one read per released episode).
function cardCounts(main, so) {
  OUT().forEach((e) => {
    so.fs.getDoc(so.fs.doc(so.db, 'posts', sheriffPostId(e.n))).then((d) => {
      if (!d.exists() || !main.contains(main.querySelector('.sh-page'))) return;
      const x = d.data(); if (so.hidden({ id: d.id, ...x })) return;
      const m = main.querySelector(`.sh-ep[data-ep="${e.n}"] .sep-m small`); if (!m || m.parentNode.querySelector('.sh-soc')) return;
      m.insertAdjacentHTML('afterend', `<span class="sh-soc" aria-label="${Number(x.likeCount) || 0} stars, ${Number(x.commentCount) || 0} comments"><span>⭐ ${so.fmt(x.likeCount)}</span><span>💬 ${so.fmt(x.commentCount)}</span></span>`);
    }).catch(() => {});
  });
}

// Not released yet: poster + title, no link, no play.
const lockedCard = (e) => `<li><div class="sep sh-ep sh-locked" data-ep="${e.n}" aria-disabled="true" aria-label="Episode ${e.n}: ${esc(e.title)}, coming soon">
  <span class="sep-th sh-th"><img src="${esc(e.poster)}" alt="" width="540" height="868" loading="lazy" decoding="async"><span class="sh-soon">Coming soon</span><span class="sh-lock" aria-hidden="true">🔒</span></span>
  <span class="sep-m"><span class="sep-l">Episode ${e.n}</span><b>${esc(e.title)}</b><span class="sh-soon-l">Coming soon</span><small class="sep-d">${esc(e.desc)}</small></span></div></li>`;

// ------------------------------------------------------------ full-screen vertical player
let cur = null; // { cleanup } of the open player
let fromSeries = false; // the player was opened from the series page, so Back can just go back in history
function player(main, n, { toast, social } = {}) {
  if (cur) cur.cleanup();
  const canBack = fromSeries; fromSeries = false;
  let ep = EPISODES.find((e) => e.n === n);
  if (!ep || !isOut(ep)) { if (ep) toast?.(`Episode ${ep.n} is coming soon.`); location.replace('#/series/sheriff'); return; }
  document.body.classList.add('sh-playing');
  main.innerHTML = `
    <div class="shp" id="shp" role="dialog" aria-modal="true" aria-label="${esc(SERIES.title)} player">
      <video class="shp-video" playsinline webkit-playsinline controls preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture oncontextmenu="return false;"></video>
      <div class="shp-top">
        <a class="shp-back" href="#/series/sheriff" data-a="back" aria-label="Back to series">${BACK}<span>Series</span></a>
        <div class="shp-title"><small>${esc(SERIES.title)}</small><b id="shp-name"></b></div>
      </div>
      <button class="shp-bigplay" type="button" data-a="play" aria-label="Play" hidden>${PLAY}</button>
      <button class="btn shp-next" type="button" data-a="next" hidden></button>
      <div class="shp-rail" id="shp-rail" hidden>
        <button class="vact like shp-act" type="button" data-a="star" aria-pressed="false" aria-label="Give a star">${STAR}<span class="n">0</span></button>
        <button class="vact shp-act" type="button" data-a="cmt" aria-label="Comments">${CMT}<span class="c">0</span></button>
      </div>
      <div class="shp-end" id="shp-end" hidden></div>
      <div class="vsheet-root shp-sheet" id="shp-sheet"></div>
    </div>`;
  const root = main.querySelector('#shp'), v = root.querySelector('video'), nextBtn = root.querySelector('.shp-next'),
    end = root.querySelector('#shp-end'), big = root.querySelector('.shp-bigplay'), name = root.querySelector('#shp-name');
  let timer = null, lastSave = 0, cancelled = false;
  const soc = socialRail(root, social, () => ep, v);
  const next = () => EPISODES.find((e) => e.n === ep.n + 1);
  const save = (done) => { if (v.currentTime > 0 || done) writeProgress(ep.n, done ? (v.duration || ep.dur) : v.currentTime, v.duration || ep.dur, done || (v.duration && v.duration - v.currentTime <= DONE_LEFT)); };
  const stopCountdown = () => { clearInterval(timer); timer = null; };
  const tryPlay = () => { const p = v.play(); if (p && p.catch) p.then(() => { big.hidden = true; }).catch(() => { big.hidden = false; }); };
  function load(e, auto) {
    stopCountdown(); cancelled = false; ep = e;
    end.hidden = true; end.innerHTML = ''; nextBtn.hidden = true;
    name.textContent = `Episode ${e.n} · ${e.title}`; document.title = `${e.title} · ${SERIES.title} | Kemy`;
    history.replaceState(null, '', '#/series/sheriff/' + e.n);
    v.poster = e.poster; v.src = e.src; soc.bind(e.n);
    const at = resumeAt(readProgress()[e.n]);
    if (at) { v.addEventListener('loadedmetadata', () => { try { v.currentTime = at; } catch { /* */ } }, { once: true }); toast?.(`Resuming Episode ${e.n} at ${clock(at)}`); }
    if (auto) tryPlay(); else big.hidden = false;
  }
  function showEnd() {
    const nx = next(); end.hidden = false; nextBtn.hidden = true;
    if (!nx) {
      end.innerHTML = `<div class="shp-end-in sh-complete"><small>Season 1 complete</small><img class="shp-end-art" src="${esc(SERIES.hero)}" alt="" width="720" height="600"><b>You finished ${esc(SERIES.title)}!</b><p>That’s all ${EPISODES.length} episodes of Season 1. Thanks for riding with Gecko!</p><p class="sh-more-l">More episodes coming soon! 🤠</p><p>Created by ${esc(SERIES.creator)} · ${esc(SERIES.studio)}</p>
        <div class="row"><a class="btn" href="#/series/sheriff" data-a="back">Back to series</a><button class="btn btn-ghost" type="button" data-a="again">Watch again</button></div></div>`;
      return;
    }
    if (!isOut(nx)) {
      end.innerHTML = `<div class="shp-end-in"><small>Episode ${nx.n} · Coming soon</small><b>${esc(nx.title)}</b>
        <img class="shp-end-art sh-end-locked" src="${esc(nx.poster)}" alt="" width="540" height="868">
        <p>Episode ${nx.n} is coming soon. Check back here for the next chapter of ${esc(SERIES.title)}.</p>
        <div class="row"><button class="btn" type="button" disabled aria-disabled="true">Episode ${nx.n} coming soon</button><a class="btn btn-ghost" href="#/series/sheriff" data-a="back">Back to series</a><button class="btn btn-ghost" type="button" data-a="again">Watch again</button></div></div>`;
      return;
    }
    if (cancelled) { end.innerHTML = upNextHtml(nx, 0); return; }
    let s = 5; end.innerHTML = upNextHtml(nx, s);
    timer = setInterval(() => { s--; const c = end.querySelector('.shp-count'); if (c) c.textContent = s; if (s <= 0) { stopCountdown(); load(nx, true); } }, 1000);
  }
  const upNextHtml = (nx, s) => `<div class="shp-end-in"><small>Up next · Episode ${nx.n}</small><b>${esc(nx.title)}</b>
    <img class="shp-end-art" src="${esc(nx.poster)}" alt="" width="540" height="868">
    ${s ? `<p class="shp-count-line">Starts in <span class="shp-count">${s}</span></p>` : ''}
    <div class="row"><button class="btn" type="button" data-a="go">${PLAY}<span>Play now</span></button>${s ? '<button class="btn btn-ghost" type="button" data-a="cancel">Cancel</button>' : ''}<a class="btn btn-ghost" href="#/series/sheriff" data-a="back">Back to series</a></div></div>`;
  v.addEventListener('timeupdate', () => {
    const left = (v.duration || ep.dur) - v.currentTime, nx = next();
    nextBtn.hidden = !(nx && left <= DONE_LEFT && left > 0.3 && end.hidden);
    if (!nextBtn.hidden && nextBtn.dataset.n !== String(nx.n)) {
      nextBtn.dataset.n = nx.n; const ok = isOut(nx);
      nextBtn.classList.toggle('shp-soon', !ok); nextBtn.setAttribute('aria-disabled', String(!ok));
      nextBtn.innerHTML = ok ? `<span>Next episode</span>${PLAY}` : `<span>Episode ${nx.n} coming soon</span>`;
      nextBtn.setAttribute('aria-label', ok ? `Next episode: Episode ${nx.n}, ${nx.title}` : `Episode ${nx.n}, ${nx.title}, is coming soon`);
    }
    const t = Date.now(); if (t - lastSave > 4000 && !v.paused) { lastSave = t; save(); }
  });
  v.addEventListener('play', () => { big.hidden = true; claimAudio('series'); if (!end.hidden) { stopCountdown(); end.hidden = true; } });
  v.addEventListener('pause', () => { if (!v.ended) save(); });
  v.addEventListener('ended', () => { save(true); showEnd(); });
  v.addEventListener('error', () => { if (v.getAttribute('src')) toast?.('This episode couldn’t load. Check your connection and try again.'); });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'play') tryPlay();
    else if (a === 'next' || a === 'go') { const nx = next(); if (nx && isOut(nx)) { save(a === 'next' ? false : true); load(nx, true); } }
    else if (a === 'cancel') { cancelled = true; stopCountdown(); end.innerHTML = upNextHtml(next(), 0); }
    else if (a === 'again') { writeProgress(EPISODES[0].n, 0, EPISODES[0].dur, false); load(EPISODES[0], true); }
    else if (a === 'back') { e.preventDefault(); goBack(); }
  });
  function goBack() { save(); if (canBack && history.length > 1) history.back(); else location.hash = '#/series/sheriff'; }
  const onKey = (e) => { if (e.key === 'Escape' && document.getElementById('shp')) { if (soc.close()) return; goBack(); } };
  const onHide = () => { if (document.hidden) save(); };
  const cleanup = () => { stopCountdown(); soc.stop(); try { save(); v.pause(); } catch { /* */ } removeEventListener('hashchange', onHash); removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', save0); document.body.classList.remove('sh-playing'); cur = null; restoreTitle(); };
  const save0 = () => save();
  const onHash = () => { if (!/^#\/series\/sheriff\/\d/.test(location.hash)) cleanup(); };
  addEventListener('hashchange', onHash); addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', save0);
  cur = { cleanup };
  load(ep, true);
}

// ------------------------------------------------------------ stars + comments in the player
// Each episode is the real post posts/sheriff-ep<n> (Lone Keem Studios), so this is Kemy's shared star
// action (likePost) and comment list / form / report / block / safety filters (comments.mount).
function socialRail(root, so, curEp, v) {
  const rail = root.querySelector('#shp-rail'), sheet = root.querySelector('#shp-sheet');
  const star = rail.querySelector('[data-a=star]'), sn = star.querySelector('.n'), cn = rail.querySelector('[data-a=cmt] .c');
  let p = null, unsub = null, sheetUnsub = null, wasPlaying = false, n = 0, busy = false;
  const noop = { bind() {}, stop() {}, close: () => false };
  if (!so) return noop;
  const paintStar = (on) => { star.classList.toggle('on', on); star.setAttribute('aria-pressed', String(on)); star.setAttribute('aria-label', on ? 'Remove your star' : 'Give a star'); };
  const paint = () => { sn.textContent = so.fmt(p.likeCount); cn.textContent = so.fmt(p.commentCount); };
  function bind(epN) {
    if (epN === n && p) return; n = epN; stopDoc(); closeSheet(true); rail.hidden = true; p = null;
    const id = sheriffPostId(epN);
    unsub = so.fs.onSnapshot(so.fs.doc(so.db, 'posts', id), (d) => {
      if (n !== epN) return;
      if (!d.exists()) { rail.hidden = true; p = null; return; }
      const x = { id: d.id, ...d.data() };
      if (so.hidden(x)) { rail.hidden = true; p = null; return; }
      const first = !p; p = Object.assign(p || {}, x); if (!busy) paint(); rail.hidden = false;
      if (first) so.isLiked(id).then((on) => { if (n === epN) paintStar(on); }).catch(() => {});
    }, () => { rail.hidden = true; });
  }
  function stopDoc() { if (unsub) { unsub(); unsub = null; } }
  function signIn(what) {
    if (so.S.user && !so.S.profile) { location.hash = '#/onboard'; return; }
    openSheet(`<div class="vsheet-backdrop" data-close-sheet></div>
      <section class="vsheet shp-signin" role="dialog" aria-modal="true" aria-label="Sign in">
        <div class="vsheet-grab" aria-hidden="true"></div>
        <header><h2>Sign in to ${so.esc(what)}</h2><button class="icon-btn" data-close-sheet aria-label="Close">${XIC}</button></header>
        <div class="vsheet-signin"><p class="small">Watching is free. Create a free account to give stars and comment.</p><a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/series/sheriff/' + n)}">Log in</a><a class="btn btn-sm btn-ghost" href="#/signup">Sign up</a></div>
      </section>`);
  }
  const signedIn = () => !!(so.S.user && so.S.profile);
  function openSheet(html) {
    closeSheet(true); wasPlaying = !v.paused && !v.ended; if (wasPlaying) v.pause();
    sheet.innerHTML = html; requestAnimationFrame(() => sheet.classList.add('open'));
    sheet.querySelectorAll('[data-close-sheet]').forEach((b) => (b.onclick = () => closeSheet()));
  }
  function closeSheet(quiet) {
    if (sheetUnsub) { sheetUnsub(); sheetUnsub = null; }
    if (!sheet.innerHTML) return false;
    sheet.classList.remove('open'); sheet.innerHTML = '';
    if (!quiet && wasPlaying) v.play().catch(() => {});
    wasPlaying = false; return true;
  }
  function openComments() {
    const c = Number(p.commentCount) || 0;
    openSheet(`<div class="vsheet-backdrop" data-close-sheet></div>
      <section class="vsheet" role="dialog" aria-modal="true" aria-labelledby="shp-sheet-title">
        <div class="vsheet-grab" aria-hidden="true"></div>
        <header><h2 id="shp-sheet-title"><span class="vsc">${so.fmt(c)}</span> <span class="vsw">${c === 1 ? 'comment' : 'comments'}</span> <small class="shp-sheet-ep">· Episode ${n}</small></h2>
          <button class="icon-btn" data-close-sheet aria-label="Close comments">${XIC}</button></header>
        <div class="vsheet-list" id="shp-sheet-list"><div class="spinner"></div></div>
        ${signedIn()
          ? `<form class="comment-form vsheet-form" id="shp-sheet-form"><label for="shp-sheet-text" class="sr-only">Add a comment</label><input id="shp-sheet-text" type="text" maxlength="500" placeholder="Add a comment…" autocomplete="off"><button class="btn btn-sm" type="submit">Send</button></form><p class="form-error" id="shp-sheet-err"></p>`
          : `<div class="vsheet-signin"><p class="small">Sign in to join the conversation.</p><a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/series/sheriff/' + n)}">Log in</a><a class="btn btn-sm btn-ghost" href="#/signup">Sign up</a></div>`}
      </section>`);
    const form = sheet.querySelector('#shp-sheet-form');
    sheetUnsub = so.comments.mount({
      p, box: sheet.querySelector('#shp-sheet-list'), form, input: form && form.querySelector('input'), err: sheet.querySelector('#shp-sheet-err'),
      onCount: (k) => {
        p.commentCount = k; cn.textContent = so.fmt(k);
        const h = sheet.querySelector('.vsc'); if (h) { h.textContent = so.fmt(k); sheet.querySelector('.vsw').textContent = k === 1 ? 'comment' : 'comments'; }
      }
    });
  }
  rail.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-a]'); if (!b || !p) return;
    e.stopPropagation();
    if (b.dataset.a === 'cmt') return openComments();
    if (!signedIn()) return signIn('give stars');
    if (busy) return;
    const on = !star.classList.contains('on'), was = Number(p.likeCount) || 0;
    busy = true; paintStar(on); p.likeCount = Math.max(0, was + (on ? 1 : -1)); sn.textContent = so.fmt(p.likeCount);
    if (on) { star.classList.remove('pop'); void star.offsetWidth; star.classList.add('pop'); }
    try { await so.likePost(p, on); } catch (err) { paintStar(!on); p.likeCount = was; sn.textContent = so.fmt(was); so.toast?.(so.friendlyError(err)); }
    busy = false;
  });
  return { bind, stop() { stopDoc(); closeSheet(true); }, close: () => closeSheet() };
}
