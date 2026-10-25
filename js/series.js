// Series & Episodes for Community Movies. A series doc is a playlist of its owner's own movie posts,
// grouped into seasons:  series/{sid} { ..., seasons, episodes: [{p, s, e}], postIds: [p…] }.
// Followers live in series/{sid}/followers/{uid} and get an 'episode' notification for each new
// episode. "Continue watching" progress is private: users/{uid}/watch/{postId} { sid, t, dur, at }.
// Studio-made series (ownerId 'studio') show as Lone Keem Studios Originals.
import {
  doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, orderBy, limit, writeBatch, serverTimestamp, increment
} from './fsq.js';
import { GENRES, RATINGS, artOf, gradientCss, fmtRuntime, fmtDur } from './works.js';
import { faceName, adminNameClass } from './kemy-name.js';

const MAX_EPISODES = 300;
export const epLabel = (x) => `S${x.s} E${x.e}`;
export const sortEps = (eps) => [...(eps || [])].sort((a, b) => a.s - b.s || a.e - b.e);
// Insert an episode at (s, e); later episodes in that season move down one. Returns a new list.
export function insertEp(eps, p, s, e) {
  const out = (eps || []).filter((x) => x.p !== p).map((x) => ({ ...x }));
  for (const x of out) if (x.s === s && x.e >= e) x.e++;
  out.push({ p, s, e });
  return renumber(out);
}
// Close gaps so each season is numbered 1..n in order.
export function renumber(eps) {
  const out = sortEps(eps).map((x) => ({ ...x })); const n = {};
  for (const x of out) { n[x.s] = (n[x.s] || 0) + 1; x.e = n[x.s]; }
  return out;
}
export function moveEp(eps, p, dir) {
  const out = sortEps(eps).map((x) => ({ ...x })); const i = out.findIndex((x) => x.p === p); const j = i + dir;
  if (i < 0 || j < 0 || j >= out.length || out[j].s !== out[i].s) return out;
  [out[i].e, out[j].e] = [out[j].e, out[i].e];
  return sortEps(out);
}
export const nextEpNumber = (eps, s) => (eps || []).filter((x) => x.s === s).reduce((m, x) => Math.max(m, x.e), 0) + 1;

export function createSeries(ctx) {
  const { db, S, esc, toast, friendlyError, isAdmin, requireAuth, avatar, badge, main, stale, postAuthor, notify, upload, tile, CLOUDINARY, deliveryUrls } = ctx;
  const cache = new Map();
  const me = () => S.user && S.user.uid;
  const canEdit = (s) => !!(S.user && (s.ownerId === me() || (s.ownerId === 'studio' && isAdmin())));
  const load = async (sid, fresh) => { if (!fresh && cache.has(sid)) return cache.get(sid); const d = await getDoc(doc(db, 'series', sid)); const v = d.exists() ? { id: d.id, ...d.data() } : null; cache.set(sid, v); return v; };
  const forPost = async (pid) => { const qs = await getDocs(query(collection(db, 'series'), where('postIds', 'array-contains', pid), limit(1))); const d = qs.docs[0]; if (!d) return null; const v = { id: d.id, ...d.data() }; cache.set(v.id, v); return v; };
  const mine = async () => {
    if (!S.user) return [];
    const owners = [me(), ...(isAdmin() ? ['studio'] : [])];
    const out = [];
    for (const o of owners) { const qs = await getDocs(query(collection(db, 'series'), where('ownerId', '==', o), limit(50))); qs.docs.forEach((d) => out.push({ id: d.id, ...d.data() })); }
    return out.sort((a, b) => a.title.localeCompare(b.title));
  };
  const posts = async (ids) => { const r = await Promise.all(ids.map((id) => getDoc(doc(db, 'posts', id)).catch(() => null))); const m = new Map(); r.forEach((d) => d && d.exists() && m.set(d.id, { id: d.id, ...d.data() })); return m; };
  const coverOf = (s, first) => s.cover || (first ? artOf(first) : '');

  // ------------------------------------------------------------ writes
  async function save(s, patch, addedId = '') {
    const eps = renumber(patch.episodes ?? s.episodes ?? []);
    if (eps.length > MAX_EPISODES) throw new Error(`A series can have up to ${MAX_EPISODES} episodes.`);
    const d = { ...patch, episodes: eps, postIds: eps.map((x) => x.p), episodeCount: eps.length, seasons: Math.max(patch.seasons ?? s.seasons ?? 1, ...eps.map((x) => x.s), 1), lastAddedId: addedId || s.lastAddedId || '', updatedAt: serverTimestamp() };
    const b = writeBatch(db); b.update(doc(db, 'series', s.id), d); await b.commit();
    cache.delete(s.id);
    return { ...s, ...d };
  }
  async function addEpisode(s, postId, season, ep, title = '') {
    s = await load(s.id, true);
    if (!s || !canEdit(s)) throw new Error('Only the series owner can add episodes.');
    season = Math.max(1, Math.min(30, Math.round(season) || 1));
    ep = Math.max(1, Math.round(ep) || nextEpNumber(s.episodes, season));
    const isNew = !(s.postIds || []).includes(postId);
    const eps = insertEp(s.episodes, postId, season, ep);
    const out = await save(s, { episodes: eps, seasons: Math.max(s.seasons || 1, season) }, postId);
    if (isNew) notifyFollowers(out, postId, title).catch(() => {});
    return out;
  }
  async function notifyFollowers(s, postId, title) {
    const x = (s.episodes || []).find((e) => e.p === postId); if (!x) return;
    const qs = await getDocs(query(collection(db, 'series', s.id, 'followers'), limit(500)));
    const text = `New episode of ${s.title}: ${epLabel(x)}${title ? ' · ' + title : ''}`.slice(0, 140);
    for (const d of qs.docs) await notify(d.id, 'episode', { postId, text }, s.ownerId === 'studio' ? 'studio' : me());
  }
  async function follow(s, on) {
    if (!requireAuth()) return null;
    const b = writeBatch(db); const f = doc(db, 'series', s.id, 'followers', me());
    if (on) b.set(f, { uid: me(), createdAt: serverTimestamp() }); else b.delete(f);
    b.update(doc(db, 'series', s.id), { followerCount: increment(on ? 1 : -1) });
    await b.commit(); cache.delete(s.id); return on;
  }
  const isFollowing = async (s) => { if (!S.user) return false; try { return (await getDoc(doc(db, 'series', s.id, 'followers', me()))).exists(); } catch { return false; } };
  async function remove(s) {
    const fs = await getDocs(query(collection(db, 'series', s.id, 'followers'), limit(450))).catch(() => ({ docs: [] }));
    const b = writeBatch(db); fs.docs.forEach((d) => b.delete(d.ref)); b.delete(doc(db, 'series', s.id)); await b.commit(); cache.delete(s.id);
  }

  // ------------------------------------------------------------ progress ("continue watching")
  const progKey = (pid) => doc(db, 'users', me(), 'watch', pid);
  async function saveProgress(pid, sid, t, dur) { if (!S.user || !(dur > 0)) return; try { await setDoc(progKey(pid), { sid: sid || '', t: Math.round(t * 10) / 10, dur: Math.round(dur * 10) / 10, at: serverTimestamp() }); } catch { /* best effort */ } }
  async function progressFor(sid) {
    if (!S.user) return new Map();
    try { const qs = await getDocs(query(collection(db, 'users', me(), 'watch'), where('sid', '==', sid), limit(300))); return new Map(qs.docs.map((d) => [d.id, d.data()])); } catch { return new Map(); }
  }
  const pct = (w) => (w && w.dur ? Math.min(1, w.t / w.dur) : 0);
  const done = (w) => w && w.dur && w.t >= w.dur - Math.min(15, w.dur * 0.08);

  // ------------------------------------------------------------ tiles + rows
  function seriesTile(s, first) {
    const art = coverOf(s, first);
    return `<a class="wtile movie stile" href="#/series/${esc(s.id)}" data-sid="${esc(s.id)}" aria-label="${esc(s.title)} (series)">
      <span class="wart" style="${art ? '' : `background:${gradientCss(s.id + s.title)}`}">${art ? `<img src="${esc(art)}" alt="" loading="lazy" onerror="this.remove()">` : `<b class="wart-t">${esc(s.title)}</b>`}
        <span class="sb-series">SERIES</span>${s.rating && s.rating !== 'all' ? `<span class="wb-r">${esc(s.rating)}+</span>` : ''}${s.ownerId === 'studio' ? '<span class="wb-pick">Original</span>' : ''}</span>
      <span class="wmeta"><b>${esc(s.title)}</b><small>${s.seasons > 1 ? s.seasons + ' seasons · ' : ''}${s.episodeCount || 0} episode${s.episodeCount === 1 ? '' : 's'} · ${esc(s.genre)}</small></span></a>`;
  }
  async function firstPosts(list) { const ids = list.map((s) => !s.cover && sortEps(s.episodes)[0]?.p).filter(Boolean); return ids.length ? posts(ids) : new Map(); }
  async function fetchList({ owner, studio, max = 30 } = {}) {
    let q;
    if (owner) q = query(collection(db, 'series'), where('ownerId', '==', owner), limit(max));
    else if (studio) q = query(collection(db, 'series'), where('ownerId', '==', 'studio'), limit(max));
    else q = query(collection(db, 'series'), orderBy('updatedAt', 'desc'), limit(max));
    const qs = await getDocs(q);
    return qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !S.blocked?.has(s.ownerId));
  }
  async function renderTiles(box, list, empty) {
    if (!list.length) { box.innerHTML = empty || ''; return; }
    const f = await firstPosts(list);
    box.innerHTML = list.map((s) => seriesTile(s, f.get(sortEps(s.episodes)[0]?.p))).join('');
  }

  // ------------------------------------------------------------ "Add to a series" (movie compose form + AI Movie Maker)
  function pickerHtml(pre = {}) {
    return `<details class="field spick" ${pre.sid ? 'open' : ''}><summary>📺 Add to a series <span class="muted small">(optional)</span></summary>
      <div class="spick-b"><div class="field"><label for="sp-s">Series</label><select id="sp-s"><option value="">Not part of a series</option></select></div>
      <div class="row spick-n"><div class="field"><label for="sp-season">Season</label><input id="sp-season" type="number" min="1" max="30" value="1"></div>
      <div class="field"><label for="sp-ep">Episode</label><input id="sp-ep" type="number" min="1" max="300" value="1"></div></div>
      <a class="small" href="#/series/new" target="_self">+ Create a new series</a></div></details>`;
  }
  function wirePicker(root, pre = {}) {
    const sel = root.querySelector('#sp-s'), sea = root.querySelector('#sp-season'), ep = root.querySelector('#sp-ep');
    let list = [];
    const fill = () => { const s = list.find((x) => x.id === sel.value); if (!s) return; const season = Number(sea.value) || s.seasons || 1; ep.value = nextEpNumber(s.episodes, season); };
    mine().then((l) => {
      list = l; sel.innerHTML = '<option value="">Not part of a series</option>' + l.map((s) => `<option value="${esc(s.id)}">${esc(s.title)}${s.ownerId === 'studio' ? ' (Studio)' : ''}</option>`).join('');
      if (pre.sid && l.some((s) => s.id === pre.sid)) { sel.value = pre.sid; const s = l.find((x) => x.id === pre.sid); sea.value = pre.season || Math.max(1, s.seasons || 1); fill(); }
    }).catch(() => {});
    sel.onchange = () => { const s = list.find((x) => x.id === sel.value); if (s) sea.value = Math.max(1, ...((s.episodes || []).map((x) => x.s)), 1); fill(); };
    sea.onchange = fill;
    return () => { const s = list.find((x) => x.id === sel.value); return s ? { series: s, season: Number(sea.value) || 1, ep: Number(ep.value) || 1 } : null; };
  }

  // ------------------------------------------------------------ create / edit (#/series/new, #/series/:id/edit)
  async function editPage(sid, token) {
    if (!requireAuth()) return;
    const s = sid ? await load(sid, true) : null;
    if (stale(token)) return;
    if (sid && (!s || !canEdit(s))) { main.innerHTML = '<div class="empty">You can only edit your own series.</div>'; return; }
    main.innerHTML = `<a class="back-link" href="${s ? '#/series/' + esc(s.id) : '#/explore/movies'}">← ${s ? esc(s.title) : 'Movies'}</a>
      <h1 class="page-title">${s ? 'Edit series' : 'New series'}</h1>
      <form class="card pad wform" id="sform" novalidate>
        <div class="field"><label for="s-title">Title</label><input id="s-title" type="text" maxlength="80" value="${esc(s?.title || '')}" required></div>
        <div class="field"><label for="s-desc">Description</label><textarea id="s-desc" maxlength="1000" rows="3" placeholder="What’s the series about?">${esc(s?.desc || '')}</textarea></div>
        <div class="field"><label for="s-genre">Genre</label><select id="s-genre">${GENRES.movie.map((g) => `<option ${s?.genre === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label for="s-cover">Poster / cover (optional)</label><input id="s-cover" type="file" accept="image/jpeg,image/png,image/webp"><p class="small muted">${s?.cover ? 'Pick a new image to replace the current cover.' : 'No cover? We use the first episode’s poster.'}</p></div>
        <fieldset class="wrate"><legend>Age rating</legend>${RATINGS.map(([v, l]) => `<label><input type="radio" name="srating" value="${v}" ${(s?.rating || 'all') === v ? 'checked' : ''}> <span>${l}</span></label>`).join('')}</fieldset>
        <div class="field"><label for="s-ai">AI tools used <span class="muted small">(optional)</span></label><input id="s-ai" type="text" maxlength="100" value="${esc(s?.aiTools || '')}" placeholder="e.g. Sora, Runway, Kemy AI Movie Maker"></div>
        ${isAdmin() && !s ? '<label class="check"><input type="checkbox" id="s-studio"> <span>Lone Keem Studios Original (post as the studio)</span></label>' : ''}
        <p class="form-error" id="s-err"></p>
        <button class="btn btn-block" id="s-go" type="submit">${s ? 'Save changes' : 'Create series'}</button>
      </form>
      ${s ? `<section class="card pad sman"><h2>Episodes</h2><p class="small muted">Reorder with the arrows. Removing an episode keeps the movie; it just leaves the series.</p><div id="s-eps"><div class="spinner"></div></div>
        <h3>Add one of your movies</h3><div class="row"><select id="s-add"><option value="">Choose a movie…</option></select><input id="s-add-season" type="number" min="1" max="30" value="${Math.max(1, s.seasons || 1)}" aria-label="Season" style="width:76px"><button class="btn btn-sm" id="s-add-go" type="button">Add</button></div>
        <div class="sman-foot"><a class="btn btn-sm btn-ghost" href="#/new/aimovie?series=${esc(s.id)}">✨ Make next episode with AI</a><button class="btn btn-sm btn-danger" id="s-del" type="button">Delete series</button></div></section>` : ''}`;
    const $ = (q) => main.querySelector(q);
    $('#sform').onsubmit = async (ev) => {
      ev.preventDefault(); const err = $('#s-err'); err.textContent = '';
      const title = $('#s-title').value.trim(); if (!title) { err.textContent = 'Add a title.'; return; }
      const go = $('#s-go'); go.disabled = true;
      try {
        let cover = s?.cover || '';
        const f = $('#s-cover').files[0];
        if (f) { if (f.size > 10 * 1048576) throw new Error('Images can be up to 10 MB.'); go.textContent = 'Uploading cover…'; const r = await upload(f, CLOUDINARY.uploadPreset, 'lks_series_art'); cover = deliveryUrls(r).mediaUrl; }
        const base = { title: title.slice(0, 80), desc: $('#s-desc').value.trim().slice(0, 1000), genre: $('#s-genre').value, aiTools: $('#s-ai').value.trim().slice(0, 100), rating: main.querySelector('input[name=srating]:checked').value, cover };
        if (s) { await save(s, base); toast('Saved'); location.hash = '#/series/' + s.id; return; }
        const asStudio = isAdmin() && !!$('#s-studio')?.checked;
        const { authorId, author } = await postAuthor(asStudio);
        const ref = doc(collection(db, 'series'));
        await setDoc(ref, { ...base, ownerId: authorId, ownerName: author.displayName, ownerUsername: author.username, ownerColor: author.color || '#8a2be2', seasons: 1, episodes: [], postIds: [], episodeCount: 0, followerCount: 0, lastAddedId: '', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast('Series created'); location.hash = '#/series/' + ref.id + '/edit';
      } catch (e) { err.textContent = e.message && !/firebase/i.test(e.message) ? e.message : friendlyError(e); go.disabled = false; go.textContent = s ? 'Save changes' : 'Create series'; }
    };
    if (!s) return;
    let cur = s;
    const paintEps = async () => {
      const eps = sortEps(cur.episodes); const m = await posts(eps.map((x) => x.p));
      $('#s-eps').innerHTML = eps.length ? eps.map((x, i) => { const p = m.get(x.p); return `<div class="sman-row" data-p="${esc(x.p)}"><b class="sep-l">${epLabel(x)}</b><span class="sman-t">${esc(p ? p.work.title : '(deleted movie)')}</span>
          <button class="icon-btn" data-m="-1" aria-label="Move up" ${i && eps[i - 1].s === x.s ? '' : 'disabled'}>↑</button><button class="icon-btn" data-m="1" aria-label="Move down" ${eps[i + 1] && eps[i + 1].s === x.s ? '' : 'disabled'}>↓</button><button class="icon-btn" data-m="x" aria-label="Remove from series">✕</button></div>`; }).join('') : '<p class="muted small">No episodes yet. Add a movie below, or pick this series when you share a movie.</p>';
    };
    paintEps();
    $('#s-eps').onclick = async (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return; const p = b.closest('[data-p]').dataset.p;
      try { cur = await save(cur, { episodes: b.dataset.m === 'x' ? cur.episodes.filter((x) => x.p !== p) : moveEp(cur.episodes, p, Number(b.dataset.m)) }); paintEps(); } catch (er) { toast(friendlyError(er)); }
    };
    const owner = s.ownerId;
    getDocs(query(collection(db, 'posts'), where('authorId', '==', owner), orderBy('createdAt', 'desc'), limit(100))).then((qs) => {
      const movies = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.type === 'movie' && p.work);
      $('#s-add').innerHTML = '<option value="">Choose a movie…</option>' + movies.map((p) => `<option value="${esc(p.id)}">${esc(p.work.title)}</option>`).join('');
    }).catch(() => {});
    $('#s-add-go').onclick = async () => {
      const pid = $('#s-add').value; if (!pid) return;
      const other = await forPost(pid).catch(() => null);
      if (other && other.id !== cur.id) { toast(`That movie is already in “${other.title}”.`); return; }
      const season = Number($('#s-add-season').value) || 1;
      try { cur = await addEpisode(cur, pid, season, nextEpNumber(cur.episodes, season), $('#s-add').selectedOptions[0].textContent); toast('Episode added'); paintEps(); } catch (er) { toast(er.message || friendlyError(er)); }
    };
    $('#s-del').onclick = async () => { if (!confirm('Delete this series? The movies stay on Kemy.')) return; try { await remove(cur); toast('Series deleted'); location.hash = '#/explore/movies'; } catch (er) { toast(friendlyError(er)); } };
  }

  // ------------------------------------------------------------ series page (#/series/:id)
  async function page(sid, token, seasonPick) {
    main.innerHTML = '<div class="spinner"></div>';
    const s = await load(sid, true); if (stale(token)) return;
    if (!s) { main.innerHTML = '<div class="empty">This series doesn’t exist any more.</div>'; return; }
    const eps = sortEps(s.episodes);
    const [m, prog, following] = await Promise.all([posts(eps.map((x) => x.p)), progressFor(s.id), isFollowing(s)]);
    if (stale(token)) return;
    const live = eps.filter((x) => m.has(x.p));
    const seasons = [...new Set(live.map((x) => x.s))]; if (!seasons.length) seasons.push(1);
    // continue watching: newest progress that isn't finished, else the first unwatched episode
    let cont = null; let best = 0;
    for (const x of live) { const w = prog.get(x.p); if (w && !done(w) && w.at?.toMillis?.() > best) { best = w.at.toMillis(); cont = x; } }
    if (!cont && prog.size) cont = live.find((x) => !done(prog.get(x.p))) || null;
    const season = Number(seasonPick) || cont?.s || seasons[0];
    const first = live[0] ? m.get(live[0].p) : null;
    const art = coverOf(s, first);
    main.innerHTML = `<section class="sbanner" style="${art ? `--bg:url('${esc(art)}')` : `background:${gradientCss(s.id + s.title)}`}">
        <div class="sbanner-in"><span class="sb-series">${s.ownerId === 'studio' ? 'LONE KEEM STUDIOS ORIGINAL' : 'SERIES'}</span>
        <h1>${esc(s.title)}</h1>
        <p class="ssub">${esc(s.genre)} · ${s.seasons > 1 ? s.seasons + ' seasons · ' : ''}${live.length} episode${live.length === 1 ? '' : 's'}${s.rating !== 'all' ? ` · <span class="wb-r inline">${esc(s.rating)}+</span>` : ''} <span class="wb-ai">AI-made</span></p>
        <div class="sby">${avatar({ uid: s.ownerId, displayName: s.ownerName, username: s.ownerUsername, color: s.ownerColor }, 'sm')}<a class="${adminNameClass(s.ownerId)}" href="#/u/${esc(s.ownerUsername)}">${esc(faceName(s.ownerId, s.ownerName))}</a>${badge(s.ownerId)} · <span id="s-fn">${Number(s.followerCount) || 0}</span> followers</div>
        <div class="sacts">${live.length ? `<a class="btn" id="s-play" href="#/post/${esc((cont || live[0]).p)}">${cont ? `▶ Continue ${epLabel(cont)}` : '▶ Play S' + live[0].s + ' E' + live[0].e}</a>` : ''}
          ${canEdit(s) ? `<a class="btn btn-ghost" href="#/series/${esc(s.id)}/edit">Edit series</a><a class="btn btn-ghost" href="#/new/aimovie?series=${esc(s.id)}">✨ Make next episode</a>` : `<button class="btn ${following ? 'btn-ghost' : ''}" id="s-follow" aria-pressed="${following}">${following ? '✓ Following' : '+ Follow'}</button>`}
          ${S.user && !canEdit(s) ? '<button class="btn btn-ghost" id="s-report">Report</button>' : ''}</div></div></section>
      ${s.desc ? `<p class="sdesc">${esc(s.desc)}</p>` : ''}${s.aiTools ? `<p class="small muted">Made with: ${esc(s.aiTools)}</p>` : ''}
      ${seasons.length > 1 ? `<div class="sseasons" role="tablist" aria-label="Seasons">${seasons.map((n) => `<button role="tab" class="chip ${n === season ? 'on' : ''}" data-season="${n}" aria-selected="${n === season}">Season ${n}</button>`).join('')}</div>` : `<h2 class="sseason-h">Season ${season}</h2>`}
      <ol class="seps">${live.filter((x) => x.s === season).map((x) => { const p = m.get(x.p), w = prog.get(x.p), a = artOf(p);
        return `<li><a class="sep ${cont && cont.p === x.p ? 'cont' : ''}" href="#/post/${esc(x.p)}"><span class="sep-th" style="${a ? '' : `background:${gradientCss(p.id + p.work.title)}`}">${a ? `<img src="${esc(a)}" alt="" loading="lazy" onerror="this.remove()">` : ''}${p.work.runtime ? `<span class="sep-rt">${fmtDur(p.work.runtime)}</span>` : ''}${w ? `<span class="sep-pr"><span style="width:${Math.round(pct(w) * 100)}%"></span></span>` : ''}</span>
          <span class="sep-m"><b>${epLabel(x)} · ${esc(p.work.title)}</b>${cont && cont.p === x.p ? '<span class="sep-cw">Continue watching</span>' : done(w) ? '<span class="sep-done">Watched</span>' : ''}<small>${Number(p.viewCount) || 0} views · ★ ${Number(p.likeCount) || 0}${p.work.runtime ? ' · ' + fmtRuntime(p.work.runtime) : ''}</small>${p.text ? `<small class="sep-d">${esc(p.text.slice(0, 120))}</small>` : ''}</span></a></li>`; }).join('') || '<li class="muted">No episodes yet.</li>'}</ol>`;
    main.querySelectorAll('[data-season]').forEach((b) => (b.onclick = () => page(sid, token, b.dataset.season)));
    const fb = main.querySelector('#s-follow');
    if (fb) fb.onclick = async () => {
      if (!requireAuth()) return; const on = fb.getAttribute('aria-pressed') !== 'true'; fb.disabled = true;
      try { await follow(s, on); fb.setAttribute('aria-pressed', on); fb.textContent = on ? '✓ Following' : '+ Follow'; fb.classList.toggle('btn-ghost', on); const n = main.querySelector('#s-fn'); n.textContent = Math.max(0, +n.textContent + (on ? 1 : -1)); toast(on ? 'You’ll be notified when a new episode drops' : 'Unfollowed'); } catch (e) { toast(friendlyError(e)); }
      fb.disabled = false;
    };
    main.querySelector('#s-report')?.addEventListener('click', () => ctx.reportDialog('series', s.id, '', 'Series: ' + s.title));
  }

  // ------------------------------------------------------------ episode bar on a movie page
  async function episodeBar(p, el) {
    const s = await forPost(p.id).catch(() => null); if (!s || !el.isConnected) return null;
    const eps = sortEps(s.episodes); const i = eps.findIndex((x) => x.p === p.id); const x = eps[i];
    const prev = eps[i - 1], next = eps[i + 1];
    const bar = document.createElement('div'); bar.className = 'sepbar';
    bar.innerHTML = `<a class="sepbar-s" href="#/series/${esc(s.id)}"><span class="sb-series">${s.ownerId === 'studio' ? 'ORIGINAL' : 'SERIES'}</span><b>${esc(s.title)}</b></a><span class="sep-l">${epLabel(x)}</span>
      <span class="spacer"></span>${prev ? `<a class="btn btn-sm btn-ghost" href="#/post/${esc(prev.p)}" aria-label="Previous episode ${epLabel(prev)}">‹ ${epLabel(prev)}</a>` : ''}${next ? `<a class="btn btn-sm" href="#/post/${esc(next.p)}" aria-label="Next episode ${epLabel(next)}">${epLabel(next)} ›</a>` : ''}`;
    const body = el.querySelector('.wbody'); body.insertBefore(bar, body.firstChild);
    const t = el.querySelector('.wtitle'); if (t) t.insertAdjacentHTML('afterbegin', `<span class="sep-l">${epLabel(x)}</span> `);
    const vid = el.querySelector('.wplayer video');
    if (vid) {
      // resume + save progress
      if (S.user) getDoc(progKey(p.id)).then((d) => { const w = d.exists() ? d.data() : null; if (w && w.t > 10 && !done(w)) { const go = () => { try { vid.currentTime = w.t; } catch { /* */ } }; vid.readyState >= 1 ? go() : vid.addEventListener('loadedmetadata', go, { once: true }); toast(`Resuming ${epLabel(x)} at ${fmtDur(w.t)}`); } }).catch(() => {});
      let lastSave = 0;
      vid.addEventListener('timeupdate', () => { const n = Date.now(); if (n - lastSave > 5000 && !vid.paused) { lastSave = n; saveProgress(p.id, s.id, vid.currentTime, vid.duration); } });
      vid.addEventListener('pause', () => saveProgress(p.id, s.id, vid.currentTime, vid.duration));
      vid.addEventListener('ended', () => { saveProgress(p.id, s.id, vid.duration, vid.duration); if (next) countdown(el.querySelector('.wplayer'), next, s); });
    }
    return { series: s, ep: x, next, prev };
  }
  async function countdown(box, next, s) {
    const np = (await posts([next.p])).get(next.p); if (!np || !box.isConnected) return;
    const o = document.createElement('div'); o.className = 'snext'; let n = 8;
    o.innerHTML = `<div class="snext-in"><small>Up next · ${epLabel(next)}</small><b>${esc(np.work.title)}</b><div class="snext-ring"><span>${n}</span></div><div class="row"><button class="btn btn-sm" data-n="go">Play now</button><button class="btn btn-sm btn-ghost" data-n="x">Cancel</button></div></div>`;
    box.appendChild(o);
    const tm = setInterval(() => { n--; const sp = o.querySelector('.snext-ring span'); if (sp) sp.textContent = n; if (n <= 0) { clearInterval(tm); if (o.isConnected) location.hash = '#/post/' + next.p; } }, 1000);
    o.onclick = (e) => { const b = e.target.closest('[data-n]'); if (!b) return; clearInterval(tm); if (b.dataset.n === 'go') location.hash = '#/post/' + next.p; else o.remove(); };
    window.addEventListener('hashchange', () => clearInterval(tm), { once: true });
  }

  return { load, forPost, mine, addEpisode, follow, remove, save, page, editPage, episodeBar, pickerHtml, wirePicker, fetchList, renderTiles, seriesTile, canEdit, progressFor };
}
