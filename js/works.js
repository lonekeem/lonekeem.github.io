// Kemy community Movies + Songs. Stored as posts (type 'movie' | 'song') with a validated `work`
// map, so stars, comments + replies, saves, views/plays, reports, search, feeds, profiles and
// account deletion all reuse the post system. Uploads go straight to Cloudinary (unsigned presets).
import { CLOUDINARY, LIMITS, uploadEndpoint, deliveryUrls, deliveryBase as cloudBase } from './media-config.js';

export const GENRES = {
  movie: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Fantasy', 'Romance', 'Animation', 'Music', 'Documentary', 'Other'],
  song: ['Hip-Hop', 'R&B', 'Pop', 'Rock', 'Gospel', 'Afrobeats', 'Dancehall/Reggae', 'Electronic', 'Country', 'Lo-fi', 'Other']
};
export const DESC = {
  movie: { heading: 'Community Movies', intro: 'Your film, your vision, made with AI. Share the short films, trailers and full-length movies you’ve created with AI tools, from sci-fi epics to five-minute comedies. Post it, collect gold stars, and get discovered by the Kemy community.', sub: 'Share an AI movie: upload up to 10 min, or link YouTube for any length.' },
  song: { heading: 'Community Songs', intro: 'Made a track with AI? Drop it here. Share your AI-created songs and beats, add your lyrics and cover art, and let the Kemy community press play, leave gold stars and find your sound.', sub: 'Share an AI song: upload audio or link YouTube, then add lyrics and cover art.' }
};
const RATINGS = [['all', 'All ages'], ['13', '13+'], ['16', '16+'], ['18', '18+']];
const AUDIO_EXT = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga'];
const VIDEO_EXT = ['mp4', 'mov', 'webm'];
const PLAY_SECONDS = 10;
export const isWork = (p) => p && (p.type === 'movie' || p.type === 'song') && p.work;
export function ytIdFrom(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(u.hostname)) return '';
    let id = u.hostname.endsWith('youtu.be') ? u.pathname.slice(1).split('/')[0] : u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/) || [])[2] || '';
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}
export const ytThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const fmtDur = (s) => { s = Math.max(0, Math.round(Number(s) || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const fmtRuntime = (s) => { s = Number(s) || 0; if (!s) return ''; if (s < 3600) return s < 60 ? `${Math.round(s)}s` : `${Math.round(s / 60)} min`; return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`; };
// Deterministic purple/gold gradient for songs/movies without art.
function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
export function gradientCss(seed) { const h = hue(seed); const a = 255 + (h % 50), b = (h >> 3) % 2 ? 40 + ((h >> 5) % 15) : 300 + ((h >> 5) % 30); return `linear-gradient(135deg,hsl(${a} 75% 42%),hsl(${b} 85% ${(h >> 8) % 2 ? 55 : 35}%))`; }
export function artOf(p) {
  const w = p.work || {};
  if (p.type === 'song') return w.cover || (w.yt ? ytThumb(w.yt) : '');
  return p.poster || w.cover || (w.yt ? ytThumb(w.yt) : '');
}
const AI_BADGE = '<span class="wb-ai" title="Made with AI">AI-made</span>';
const E_BADGE = '<span class="wb-e" title="Explicit" aria-label="Explicit">E</span>';
const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11-6.86a1 1 0 0 0 0-1.7l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5.5v13l9-6.5zM16 5h3v14h-3z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
export const WORK_IC = {
  movie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.6"/><path d="M2.5 9.2h19M7 5l2 4.2M12.2 5l2 4.2M17.4 5l2 4.2"/></svg>',
  song: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5.5l11-2v12.6"/><circle cx="6.4" cy="18" r="2.8"/><circle cx="17.4" cy="16.1" r="2.8"/></svg>'
};

export function createWorks(ctx) {
  const { db, fs, S, esc, toast, friendlyError, isAdmin, requireAuth, avatar, badge, timeAgo, linkify, postAuthor, searchFields, likePost, isLiked, savePost, reportDialog, deletePost, recordView, stale, main } = ctx;
  const { doc, getDoc, getDocs, collection, query, where, orderBy, limit, writeBatch, serverTimestamp, updateDoc } = fs;
  const isMine = (p) => S.user && p.authorId === S.user.uid;
  const gate18 = new Set(JSON.parse(sessionStorage.getItem('kemy-18') || '[]'));
  const confirm18 = (id) => { gate18.add(id); sessionStorage.setItem('kemy-18', JSON.stringify([...gate18])); };
  const blurred = (p) => p.type === 'movie' && p.work.rating === '18' && !gate18.has(p.id) && !isMine(p);

  // ---------------------------------------------------------------- tiles + feed cards
  function tile(p, { size = '' } = {}) {
    const w = p.work, art = artOf(p);
    const meta = p.type === 'song' ? esc(w.artist || p.authorName) : `${esc(w.genre)}${w.runtime ? ' · ' + fmtRuntime(w.runtime) : ''}`;
    return `<a class="wtile ${p.type} ${size} ${blurred(p) ? 'blur18' : ''}" href="#/post/${esc(p.id)}" data-id="${esc(p.id)}" aria-label="${esc(w.title)} (${p.type === 'song' ? 'song' : 'movie'})">
      <span class="wart" style="${art ? '' : `background:${gradientCss(p.id + w.title)}`}">${art ? `<img src="${esc(art)}" alt="" loading="lazy" onerror="this.parentNode.style.background='linear-gradient(135deg,#5b21b6,#c026d3 70%,#f5b301)';this.remove()" decoding="async">` : `<b class="wart-t">${esc(w.title)}</b>`}
        ${p.type === 'movie' && w.rating && w.rating !== 'all' ? `<span class="wb-r">${esc(w.rating)}+</span>` : ''}${p.featured ? '<span class="wb-pick">★ Pick</span>' : ''}</span>
      <span class="wmeta"><b>${esc(w.title)}</b><small>${meta}</small><span class="wbadges">${AI_BADGE}${w.explicit ? E_BADGE : ''}<span class="wstat">${STAR}${Number(p.likeCount) || 0}</span></span></span></a>`;
  }
  // Poster card for feeds (replaces the normal post card).
  function card(p) {
    const el = document.createElement('article');
    el.className = 'card post wcard'; el.dataset.postId = p.id;
    el.innerHTML = `<div class="post-head">${avatar(p)}<div class="who"><a class="name" href="#/u/${esc(p.authorUsername)}">${esc(p.authorName)}</a>${badge(p.authorId)}
      <div class="handle">shared a ${p.type === 'song' ? 'song' : 'movie'} · ${esc(timeAgo(p.createdAt))}</div></div></div>
      <div class="wcard-body">${tile(p, { size: 'wide' })}${p.text ? `<p class="wcard-desc">${esc(p.text.slice(0, 160))}${p.text.length > 160 ? '…' : ''}</p>` : ''}</div>`;
    return el;
  }

  // ---------------------------------------------------------------- uploads (Cloudinary, chunked)
  function upload(file, preset, tag, onProgress) {
    const CH = (LIMITS.chunkMB || 20) * 1048576;
    const send = (blob, headers, base) => new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append('file', blob, file.name || 'upload'); fd.append('upload_preset', preset); fd.append('tags', tag);
      if (S.user) fd.append('context', `uid=${S.user.uid}`);
      const x = new XMLHttpRequest(); x.open('POST', uploadEndpoint());
      Object.entries(headers || {}).forEach(([k, v]) => x.setRequestHeader(k, v));
      x.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress((base + e.loaded * (blob.size / e.total)) / file.size);
      x.onload = () => { let j = null; try { j = JSON.parse(x.responseText); } catch { /* */ } if (x.status < 300 && j) resolve(j); else { const er = new Error((j && j.error && j.error.message) || 'Upload failed'); er.retry = x.status >= 500 || x.status === 0; reject(er); } };
      x.onerror = () => { const er = new Error('Network problem during upload. Check your connection and try again.'); er.retry = true; reject(er); };
      x.send(fd);
    });
    const retry = async (fn) => { for (let a = 1; ; a++) { try { return await fn(); } catch (e) { if (!e.retry || a >= 3) throw e; await new Promise((r) => setTimeout(r, 1500 * a)); } } };
    if (file.size <= CH) return retry(() => send(file, null, 0));
    return (async () => {
      const id = 'kemy-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); let last = null;
      for (let s = 0; s < file.size; s += CH) {
        const e = Math.min(file.size, s + CH);
        last = await retry(() => send(file.slice(s, e, file.type), { 'X-Unique-Upload-Id': id, 'Content-Range': `bytes ${s}-${e - 1}/${file.size}` }, s));
      }
      return last;
    })();
  }
  const origUrl = (u) => { const m = String(u || '').match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(?:[^/]*_[^/]*\/)+(v\d+\/.+)$/); return m ? m[1] + m[2] : ''; };
  const audioUrl = (r) => `${cloudBase()}video/upload/ac_mp3,br_192k/${r.version ? 'v' + r.version + '/' : ''}${r.public_id}.mp3`;
  const squareUrl = (r) => `${cloudBase()}image/upload/c_fill,g_auto,h_800,w_800/f_auto,q_auto/${r.version ? 'v' + r.version + '/' : ''}${r.public_id}`;
  const probe = (file, kind) => new Promise((resolve) => {
    const el = document.createElement(kind); el.preload = 'metadata'; el.muted = true;
    const u = URL.createObjectURL(file); let done = false;
    const fin = (d) => { if (done) return; done = true; URL.revokeObjectURL(u); resolve(Number.isFinite(d) ? d : 0); };
    el.onloadedmetadata = () => { if (el.duration === Infinity) { el.currentTime = 1e7; el.ontimeupdate = () => fin(el.duration); } else fin(el.duration); };
    el.onerror = () => fin(0); setTimeout(() => fin(0), 8000); el.src = u;
  });

  // ---------------------------------------------------------------- compose page (#/new/movie, #/new/song)
  function composePage(kind, token) {
    if (!requireAuth()) return;
    const D = DESC[kind], isSong = kind === 'song';
    main.innerHTML = `
      <a class="back-link" href="#/new/menu">← Create</a>
      <h1 class="page-title">${isSong ? 'Share a song' : 'Share a movie'}</h1>
      <p class="muted" style="margin-top:-6px">${esc(D.sub)}</p>
      <form class="card pad wform" id="wform" novalidate>
        <fieldset class="wsrc"><legend>Source</legend>
          <label><input type="radio" name="src" value="youtube" ${isSong ? '' : 'checked'}> <span><b>YouTube link</b><small>${isSong ? 'Any length' : 'Recommended for full-length films · any length'}</small></span></label>
          <label><input type="radio" name="src" value="upload" ${isSong ? 'checked' : ''}> <span><b>Upload a file</b><small>${isSong ? 'MP3, M4A/AAC, WAV or OGG · up to 10 min / 100 MB' : 'MP4, MOV or WebM · up to 10 min / 100 MB'}</small></span></label>
        </fieldset>
        <div class="field" data-src="youtube"><label for="w-yt">YouTube link</label><input id="w-yt" type="text" inputmode="url" placeholder="https://youtube.com/watch?v=…" autocomplete="off"></div>
        <div class="field" data-src="youtube"><label for="w-rt">Runtime (minutes)</label><input id="w-rt" type="number" min="0" max="1440" step="1" placeholder="e.g. ${isSong ? '3' : '12'}"></div>
        <div class="field" data-src="upload"><label for="w-file">${isSong ? 'Audio file' : 'Movie file'}</label><input id="w-file" type="file" accept="${isSong ? 'audio/*,.mp3,.m4a,.aac,.wav,.ogg' : 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm'}"><p class="small muted" id="w-fileinfo"></p></div>
        <div class="field"><div class="row"><label for="w-title">Title</label><span class="spacer"></span><span class="small muted counter" id="w-title-n"></span></div><input id="w-title" type="text" maxlength="80" required></div>
        ${isSong ? `<div class="field"><label for="w-artist">Artist name</label><input id="w-artist" type="text" maxlength="50" value="${esc(S.profile.displayName)}"></div>` : ''}
        <div class="field"><label for="w-genre">Genre</label><select id="w-genre">${GENRES[kind].map((g) => `<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label for="w-art">${isSong ? 'Cover art (square image, optional)' : 'Poster / thumbnail (optional)'}</label><input id="w-art" type="file" accept="image/jpeg,image/png,image/webp">
          <p class="small muted">${isSong ? 'No cover? We’ll make a gradient cover with your title.' : 'No poster? We use the YouTube thumbnail or a frame from your video.'}</p></div>
        <div class="field"><div class="row"><label for="w-desc">Description</label><span class="spacer"></span><span class="small muted counter" id="w-desc-n"></span></div><textarea id="w-desc" maxlength="1000" rows="3" placeholder="${isSong ? 'What’s the story behind the track?' : 'What’s your movie about?'} #hashtags work"></textarea></div>
        ${isSong ? `<details class="field wlyrics"><summary>Lyrics (optional)</summary><textarea id="w-lyrics" maxlength="5000" rows="8" placeholder="Paste your lyrics…"></textarea><div class="small muted counter" id="w-lyrics-n"></div></details>
          <label class="check"><input type="checkbox" id="w-explicit"> <span>Explicit lyrics <span class="wb-e">E</span></span></label>` :
          `<fieldset class="wrate"><legend>Age rating</legend>${RATINGS.map(([v, l], i) => `<label><input type="radio" name="rating" value="${v}" ${i ? '' : 'checked'}> <span>${l}</span></label>`).join('')}</fieldset>`}
        <div class="field"><label for="w-ai">AI tools used <span class="muted small">(optional)</span></label><input id="w-ai" type="text" maxlength="100" placeholder="${isSong ? 'e.g. Suno, Udio' : 'e.g. Sora, Runway, Suno'}"></div>
        <label class="check wrights"><input type="checkbox" id="w-rights"> <span>I made this or have the rights to share it, and it follows the <a href="guidelines.html" target="_blank">Community Guidelines</a>.</span></label>
        <div class="pv-progress" hidden><span></span></div><p class="small muted" id="w-status" aria-live="polite"></p>
        <p class="form-error" id="w-err"></p>
        <button class="btn btn-block" type="submit" id="w-go">${isSong ? 'Share song' : 'Share movie'}</button>
      </form>`;
    const $ = (s) => main.querySelector(s);
    const counters = [['#w-title', '#w-title-n', 80], ['#w-desc', '#w-desc-n', 1000], ['#w-lyrics', '#w-lyrics-n', 5000]];
    counters.forEach(([a, b, m]) => { const i = $(a), o = $(b); if (!i) return; const f = () => (o.textContent = `${i.value.length}/${m}`); i.oninput = f; f(); });
    const src = () => main.querySelector('input[name=src]:checked').value;
    const paintSrc = () => main.querySelectorAll('[data-src]').forEach((e) => (e.hidden = e.dataset.src !== src()));
    main.querySelectorAll('input[name=src]').forEach((r) => (r.onchange = paintSrc)); paintSrc();
    let fileDur = 0;
    $('#w-file').onchange = async () => {
      const f = $('#w-file').files[0]; const info = $('#w-fileinfo'); fileDur = 0; if (!f) { info.textContent = ''; return; }
      const ext = (f.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
      if (!(isSong ? AUDIO_EXT : VIDEO_EXT).includes(ext)) { info.textContent = isSong ? 'Use an MP3, M4A/AAC, WAV or OGG file.' : 'Use an MP4, MOV or WebM file.'; return; }
      if (f.size > 100 * 1048576) { info.textContent = 'That file is over 100 MB.'; return; }
      info.textContent = 'Checking length…'; fileDur = await probe(f, isSong ? 'audio' : 'video');
      info.textContent = fileDur ? `${fmtDur(fileDur)} · ${(f.size / 1048576).toFixed(1)} MB${fileDur > 600.5 ? ' · too long (max 10 min)' : ''}` : `${(f.size / 1048576).toFixed(1)} MB`;
      if (!$('#w-title').value) { $('#w-title').value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80); $('#w-title').oninput(); }
    };
    $('#wform').onsubmit = async (ev) => {
      ev.preventDefault();
      const err = $('#w-err'); err.textContent = '';
      const title = $('#w-title').value.trim(), desc = $('#w-desc').value.trim(), genre = $('#w-genre').value, aiTools = $('#w-ai').value.trim();
      if (!title) { err.textContent = 'Add a title.'; return; }
      if (!$('#w-rights').checked) { err.textContent = 'Please confirm you made this or have the rights to share it.'; return; }
      let yt = '', runtime = 0, file = null;
      if (src() === 'youtube') {
        yt = ytIdFrom($('#w-yt').value); if (!yt) { err.textContent = 'Paste a valid YouTube link.'; return; }
        runtime = Math.max(0, Math.min(1440, Math.round(Number($('#w-rt').value) || 0))) * 60;
      } else {
        file = $('#w-file').files[0]; if (!file) { err.textContent = isSong ? 'Choose an audio file.' : 'Choose a video file.'; return; }
        const ext = (file.name.toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
        if (!(isSong ? AUDIO_EXT : VIDEO_EXT).includes(ext)) { err.textContent = 'That file type isn’t supported.'; return; }
        if (file.size > 100 * 1048576) { err.textContent = 'Files can be up to 100 MB.'; return; }
        if (fileDur > 600.5) { err.textContent = 'Uploads can be up to 10 minutes. Link YouTube for longer ones.'; return; }
        runtime = Math.round(fileDur * 10) / 10;
      }
      const art = $('#w-art').files[0];
      if (art && art.size > 10 * 1048576) { err.textContent = 'Images can be up to 10 MB.'; return; }
      const go = $('#w-go'), bar = $('.pv-progress'), barIn = bar.querySelector('span'), status = $('#w-status');
      go.disabled = true; bar.hidden = false;
      const prog = (base, span) => (f) => (barIn.style.transform = `scaleX(${base + span * Math.min(1, f)})`);
      try {
        let cover = '', poster = '', mediaUrl = '', mediaType = '';
        if (art) { status.textContent = 'Uploading artwork…'; const r = await upload(art, CLOUDINARY.uploadPreset, 'lks_work_art', prog(0, file ? 0.15 : 0.9)); cover = isSong ? squareUrl(r) : deliveryUrls(r).mediaUrl; if (!isSong) poster = deliveryUrls(r).posterUrl; }
        if (file) {
          status.textContent = isSong ? 'Uploading your song…' : 'Uploading your movie…';
          const r = await upload(file, isSong ? (CLOUDINARY.songPreset || 'lks_songs') : CLOUDINARY.uploadPreset, isSong ? 'lks_song' : 'lks_movie', prog(art ? 0.15 : 0, art ? 0.8 : 0.95));
          if (isSong) { mediaUrl = audioUrl(r); mediaType = 'audio'; if (r.duration) runtime = Math.round(r.duration * 10) / 10; }
          else { const d = deliveryUrls(r); mediaUrl = d.mediaUrl; mediaType = 'video'; if (!poster) poster = d.posterUrl; if (r.duration) runtime = Math.round(r.duration * 10) / 10; }
          runtime = Math.min(runtime, 601);
        }
        status.textContent = 'Saving…';
        const { authorId, author } = await postAuthor(false);
        const work = { title: title.slice(0, 80), genre, aiTools: aiTools.slice(0, 100), runtime, yt, cover, rights: true };
        if (isSong) { work.artist = ($('#w-artist').value.trim() || author.displayName).slice(0, 50); work.lyrics = $('#w-lyrics').value.slice(0, 5000); work.explicit = $('#w-explicit').checked; }
        else work.rating = main.querySelector('input[name=rating]:checked').value;
        const ref = doc(collection(db, 'posts'));
        const b = writeBatch(db);
        b.set(ref, {
          authorId, authorName: author.displayName, authorUsername: author.username, authorColor: author.color,
          type: kind, text: desc.slice(0, 1000), linkUrl: yt ? `https://www.youtube.com/watch?v=${yt}` : '', mediaUrl, mediaType, poster: isSong ? '' : poster,
          work, ...searchFields({ text: [title, desc, genre, work.artist || '', aiTools].join(' '), authorName: author.displayName, authorUsername: author.username }),
          createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false
        });
        b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp() });
        await b.commit();
        barIn.style.transform = 'scaleX(1)';
        toast(isSong ? 'Song shared!' : 'Movie shared!');
        location.hash = '#/post/' + ref.id;
      } catch (e) {
        go.disabled = false; status.textContent = '';
        err.textContent = e && e.code === 'permission-denied' ? 'You can post once every 20 seconds. Wait a moment and try again.' : (e && e.message && !/firebase/i.test(e.message) ? e.message : friendlyError(e));
      }
    };
  }

  // ---------------------------------------------------------------- persistent mini player (songs)
  const player = (() => {
    const audio = new Audio(); audio.preload = 'metadata'; audio.crossOrigin = 'anonymous';
    // A brand-new upload's transcoded copy can take a minute to exist on Cloudinary; fall back to the original file meanwhile.
    audio.addEventListener('error', () => { const o = origUrl(audio.src); if (o && o !== audio.src) { const t = audio.currentTime; audio.src = o; audio.currentTime = t; audio.play().catch(() => {}); } });
    let queue = [], idx = -1, cur = null, played = 0, last = null, counted = false, ac = null, an = null;
    const bar = document.createElement('div'); bar.className = 'mini-player'; bar.hidden = true;
    bar.innerHTML = `<a class="mp-art" href="#/"></a><a class="mp-meta" href="#/"><b></b><small></small></a>
      <button class="mp-btn" data-a="pp" aria-label="Play">${PLAY}</button><button class="mp-btn" data-a="next" aria-label="Next song">${NEXT}</button><button class="mp-btn" data-a="x" aria-label="Close player">${CLOSE}</button>
      <span class="mp-prog"><span></span></span>`;
    document.body.appendChild(bar);
    const listeners = new Set(); const emit = () => listeners.forEach((f) => f());
    function analyser() {
      if (an || !audio.src) return an;
      try { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); const s = ac.createMediaElementSource(audio); an = ac.createAnalyser(); an.fftSize = 128; s.connect(an); an.connect(ac.destination); } catch { an = null; }
      return an;
    }
    function paint() {
      bar.hidden = !cur; document.body.classList.toggle('has-mini', !!cur);
      if (!cur) return;
      const w = cur.work, art = artOf(cur);
      bar.querySelector('.mp-art').href = bar.querySelector('.mp-meta').href = '#/post/' + cur.id;
      bar.querySelector('.mp-art').innerHTML = art ? `<img src="${esc(art)}" alt="">` : '';
      bar.querySelector('.mp-art').style.background = art ? '' : gradientCss(cur.id + w.title);
      bar.querySelector('.mp-meta b').textContent = w.title; bar.querySelector('.mp-meta small').textContent = w.artist || cur.authorName;
      const pp = bar.querySelector('[data-a=pp]'); pp.innerHTML = audio.paused ? PLAY : PAUSE; pp.setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
      bar.querySelector('[data-a=next]').disabled = queue.length < 2;
    }
    function media() {
      if (!('mediaSession' in navigator) || !cur) return;
      const art = artOf(cur);
      navigator.mediaSession.metadata = new MediaMetadata({ title: cur.work.title, artist: cur.work.artist || cur.authorName, album: 'Kemy · Community Songs', artwork: art ? [{ src: art, sizes: '512x512' }] : [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png' }] });
      const h = { play: () => audio.play(), pause: () => audio.pause(), nexttrack: () => next(), previoustrack: () => { audio.currentTime = 0; }, seekto: (d) => { audio.currentTime = d.seekTime; }, stop: () => close() };
      Object.entries(h).forEach(([k, f]) => { try { navigator.mediaSession.setActionHandler(k, f); } catch { /* */ } });
    }
    function load(p) {
      cur = p; played = 0; last = null; counted = false;
      audio.src = p.mediaUrl; audio.currentTime = 0;
      analyser(); ac && ac.resume && ac.resume();
      audio.play().catch(() => {}); media(); paint(); emit();
    }
    function play(p, list = []) {
      if (!p || p.type !== 'song' || !p.mediaUrl) return;
      queue = (list.length ? list : [p]).filter((x) => x.type === 'song' && x.mediaUrl); idx = Math.max(0, queue.findIndex((x) => x.id === p.id));
      if (idx === -1 || !queue.length) { queue = [p]; idx = 0; }
      if (cur && cur.id === p.id) { audio.paused ? audio.play() : audio.pause(); return; }
      load(p);
    }
    function next() { if (queue.length < 2) return; idx = (idx + 1) % queue.length; load(queue[idx]); }
    function close() { audio.pause(); audio.removeAttribute('src'); audio.load(); cur = null; paint(); emit(); }
    audio.addEventListener('timeupdate', () => {
      if (!cur) return;
      bar.querySelector('.mp-prog span').style.transform = `scaleX(${audio.duration ? audio.currentTime / audio.duration : 0})`;
      if (!audio.paused && !audio.seeking) { const t = audio.currentTime; if (last !== null && t > last && t - last < 1.5) played += t - last; last = t; }
      if (!counted && played >= PLAY_SECONDS) { counted = true; recordView(cur.id, cur.authorId); }
      emit();
    });
    audio.addEventListener('seeking', () => (last = null));
    ['play', 'pause'].forEach((e) => audio.addEventListener(e, () => { paint(); emit(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing'; }));
    audio.addEventListener('ended', () => { if (queue.length > 1) next(); else { paint(); emit(); } });
    audio.addEventListener('error', () => { if (cur) toast('This song couldn’t play. It may still be processing; try again in a minute.'); });
    bar.querySelector('[data-a=pp]').onclick = () => (audio.paused ? audio.play() : audio.pause());
    bar.querySelector('[data-a=next]').onclick = next;
    bar.querySelector('[data-a=x]').onclick = close;
    return { audio, play, next, close, get cur() { return cur; }, on: (f) => { listeners.add(f); return () => listeners.delete(f); }, analyser: () => an };
  })();
  window.__kemyPlayer = player;

  // ---------------------------------------------------------------- work page (#/post/:id)
  function page(p, slot, more = []) {
    const w = p.work, isSong = p.type === 'song', art = artOf(p);
    const el = document.createElement('article'); el.className = 'card wpage ' + p.type; el.dataset.postId = p.id;
    const player18 = blurred(p);
    const ytEmbed = w.yt ? `<div class="wplayer yt"><button class="wfacade" data-a="yt" style="background-image:url('${ytThumb(w.yt)}')" aria-label="Play ${esc(w.title)}"><span class="wplay">${PLAY}</span></button></div>` : '';
    el.innerHTML = `
      ${isSong ? `<div class="wsong-top"><div class="wcover" style="${art ? '' : `background:${gradientCss(p.id + w.title)}`}">${art ? `<img src="${esc(art)}" alt="Cover art for ${esc(w.title)}" onerror="this.parentNode.style.background='linear-gradient(135deg,#5b21b6,#c026d3 70%,#f5b301)';this.remove()">` : `<b class="wart-t">${esc(w.title)}</b>`}</div>
          ${p.mediaUrl ? `<canvas class="wviz" width="600" height="120" aria-hidden="true"></canvas>
          <div class="wctl"><button class="wpp" data-a="pp" aria-label="Play">${PLAY}</button><input class="wseek" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="wtime">0:00 / ${fmtDur(w.runtime)}</span></div>` : ytEmbed}</div>`
        : `<div class="wmovie-top">${player18 ? `<div class="wgate" style="${art ? `background-image:url('${esc(art)}')` : ''}"><div><b>18+ movie</b><p>This movie is rated 18+ by its creator.</p><button class="btn btn-sm" data-a="18">I’m 18 or older, show it</button></div></div>`
          : w.yt ? ytEmbed : `<div class="wplayer"><video controls playsinline preload="metadata" controlsList="nodownload" ${p.poster ? `poster="${esc(p.poster)}"` : ''} src="${esc(p.mediaUrl)}"></video></div>`}</div>`}
      <div class="wbody">
        <h1 class="wtitle">${esc(w.title)}</h1>
        <div class="wsub">${isSong ? `<b>${esc(w.artist || p.authorName)}</b> · ` : ''}${esc(w.genre)}${w.runtime ? ' · ' + fmtRuntime(w.runtime) : ''}${!isSong && w.rating ? ` · <span class="wb-r inline">${w.rating === 'all' ? 'All ages' : esc(w.rating) + '+'}</span>` : ''} ${AI_BADGE}${w.explicit ? E_BADGE : ''}${p.featured ? '<span class="wb-pick">★ Studio Pick</span>' : ''}</div>
        <div class="wby">${avatar(p)}<div><a class="name" href="#/u/${esc(p.authorUsername)}">${esc(p.authorName)}</a>${badge(p.authorId)}<div class="muted small">${esc(timeAgo(p.createdAt))} · <span class="wviews">${Number(p.viewCount) || 0}</span> ${isSong ? 'plays' : 'views'}</div></div></div>
        <div class="wacts">
          <button class="wact like" data-a="like" aria-pressed="false" aria-label="Give a gold star">${STAR}<span class="n">${Number(p.likeCount) || 0}</span></button>
          <button class="wact" data-a="save" aria-pressed="false" aria-label="Save">Save</button>
          <button class="wact" data-a="share" aria-label="Share">Share</button>
          ${S.user && !isMine(p) ? '<button class="wact" data-a="report">Report</button>' : ''}
          ${isAdmin() ? `<button class="wact" data-a="feature">${p.featured ? 'Unfeature' : 'Feature in Studio Picks'}</button>` : ''}
          ${isMine(p) || isAdmin() ? '<button class="wact danger" data-a="delete">Delete</button>' : ''}
        </div>
        ${p.text ? `<p class="wdesc">${linkify(esc(p.text))}</p>` : ''}
        ${w.aiTools ? `<p class="small muted">Made with: ${esc(w.aiTools)}</p>` : ''}
        ${isSong && w.lyrics ? `<details class="wlyr"><summary>Lyrics</summary><pre>${esc(w.lyrics)}</pre></details>` : ''}
      </div>
      <div class="wmore" hidden><h2>More from ${esc(p.authorName)}</h2><div class="wrow"></div></div>`;
    slot.appendChild(el);
    const q = (s) => el.querySelector(s);
    // views / plays
    const vid = q('video');
    if (vid) { tenSeconds(vid, p); vid.addEventListener('error', () => { const o = origUrl(vid.currentSrc || vid.src); if (o && o !== vid.src) vid.src = o; }, { once: true }); }
    const wireYt = () => { const f = q('[data-a=yt]'); if (f) f.onclick = () => { f.parentElement.innerHTML = `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(w.yt)}?autoplay=1&rel=0" title="${esc(w.title)}" allowfullscreen allow="autoplay; encrypted-media; picture-in-picture"></iframe></div>`; setTimeout(() => recordView(p.id, p.authorId), PLAY_SECONDS * 1000); }; };
    wireYt();
    q('[data-a="18"]')?.addEventListener('click', () => { confirm18(p.id); slot.innerHTML = ''; page(p, slot, more); });
    // song controls
    if (isSong && p.mediaUrl) {
      const pp = q('[data-a=pp]'), seek = q('.wseek'), time = q('.wtime'), cv = q('.wviz');
      const paintCtl = () => {
        const on = player.cur && player.cur.id === p.id, a = player.audio;
        pp.innerHTML = on && !a.paused ? PAUSE : PLAY; pp.setAttribute('aria-label', on && !a.paused ? 'Pause' : 'Play');
        if (on && a.duration) { if (!seek.matches(':active')) seek.value = Math.round((a.currentTime / a.duration) * 1000); time.textContent = `${fmtDur(a.currentTime)} / ${fmtDur(a.duration)}`; }
      };
      pp.onclick = () => player.play(p, more.length ? [p, ...more] : [p]);
      seek.oninput = () => { const a = player.audio; if (player.cur && player.cur.id === p.id && a.duration) a.currentTime = (seek.value / 1000) * a.duration; };
      const off = player.on(paintCtl); paintCtl();
      // visualizer: purple → gold bars
      const g = cv.getContext('2d'); let raf = 0, t = 0; const data = new Uint8Array(64);
      const grad = g.createLinearGradient(0, 120, 0, 0); grad.addColorStop(0, '#8a2be2'); grad.addColorStop(0.6, '#b57bff'); grad.addColorStop(1, '#FFC83D');
      const draw = () => {
        if (!cv.isConnected) { off(); cancelAnimationFrame(raf); return; }
        t += 0.05; g.clearRect(0, 0, 600, 120);
        const on = player.cur && player.cur.id === p.id && !player.audio.paused, an = player.analyser();
        let real = false; if (on && an) { an.getByteFrequencyData(data); real = data.some((v) => v > 0); }
        const n = 40, bw = 600 / n;
        for (let i = 0; i < n; i++) {
          const v = real ? data[Math.floor(i * 1.4)] / 255 : on ? 0.25 + 0.35 * Math.abs(Math.sin(t * 2 + i * 0.5) * Math.cos(t + i * 0.13)) : 0.06 + 0.04 * Math.sin(t + i * 0.4);
          const h = Math.max(4, v * 116);
          g.fillStyle = grad; g.shadowColor = 'rgba(181,123,255,.7)'; g.shadowBlur = on ? 10 : 0;
          g.beginPath(); (g.roundRect ? g.roundRect(i * bw + 2, 120 - h, bw - 4, h, 3) : g.rect(i * bw + 2, 120 - h, bw - 4, h)); g.fill();
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    }
    // actions
    const likeBtn = q('[data-a=like]'), saveBtn = q('[data-a=save]');
    const setLike = (on) => { likeBtn.classList.toggle('on', on); likeBtn.setAttribute('aria-pressed', on); };
    const setSave = (on) => { saveBtn.classList.toggle('on', on); saveBtn.textContent = on ? 'Saved' : 'Save'; };
    setSave(S.saved.has(p.id)); isLiked(p.id).then(setLike).catch(() => {});
    likeBtn.onclick = async () => {
      if (!requireAuth()) return; const on = !likeBtn.classList.contains('on'); const n = q('.like .n'); const c = +n.textContent || 0;
      setLike(on); n.textContent = Math.max(0, c + (on ? 1 : -1)); likeBtn.disabled = true;
      try { await likePost(p, on); } catch (e) { setLike(!on); n.textContent = c; toast(friendlyError(e)); } likeBtn.disabled = false;
    };
    saveBtn.onclick = async () => { if (!requireAuth()) return; const on = !S.saved.has(p.id); setSave(on); try { await savePost(p.id, on); toast(on ? 'Saved' : 'Removed from saved'); } catch (e) { setSave(!on); toast(friendlyError(e)); } };
    q('[data-a=share]').onclick = async () => { const url = location.origin + location.pathname + '#/post/' + p.id; try { if (navigator.share) await navigator.share({ title: w.title, text: `${w.title} on Kemy`, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* cancelled */ } };
    q('[data-a=report]')?.addEventListener('click', () => reportDialog(p.type, p.id, p.id, w.title));
    q('[data-a=feature]')?.addEventListener('click', async (e) => { try { const on = !p.featured; await updateDoc(doc(db, 'posts', p.id), { featured: on }); p.featured = on; e.target.textContent = on ? 'Unfeature' : 'Feature in Studio Picks'; toast(on ? 'Added to Studio Picks' : 'Removed from Studio Picks'); } catch (er) { toast(friendlyError(er)); } });
    q('[data-a=delete]')?.addEventListener('click', async () => { if (!confirm(`Delete this ${p.type}? This can’t be undone.`)) return; try { if (player.cur && player.cur.id === p.id) player.close(); await deletePost(p); toast('Deleted'); location.hash = '#/explore/' + (isSong ? 'songs' : 'movies'); } catch (e) { toast(friendlyError(e)); } });
    // more from this creator
    getDocs(query(collection(db, 'posts'), where('authorId', '==', p.authorId), orderBy('createdAt', 'desc'), limit(24))).then((qs) => {
      const list = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => isWork(x) && x.id !== p.id).slice(0, 10);
      if (!list.length || !el.isConnected) return;
      more.splice(0, more.length, ...list.filter((x) => x.type === 'song'));
      q('.wmore').hidden = false; q('.wmore .wrow').innerHTML = list.map((x) => tile(x)).join('');
    }).catch(() => {});
    return el;
  }
  function tenSeconds(v, p) {
    let played = 0, last = null, done = false;
    v.addEventListener('timeupdate', () => { if (done || v.paused || v.seeking) { last = null; return; } const t = v.currentTime; if (last !== null && t > last && t - last < 1.5) played += t - last; last = t; if (played >= PLAY_SECONDS) { done = true; recordView(p.id, p.authorId); } });
  }

  // ---------------------------------------------------------------- explore tab
  async function explore(root, kind, token) {
    const D = DESC[kind], isSong = kind === 'song';
    root.innerHTML = `
      <section class="wsec">
        <h2 class="wsec-h">${WORK_IC[kind]} ${esc(D.heading)}</h2>
        <p class="wintro clamp" id="wintro">${esc(D.intro)}</p><button class="link-btn wmorebtn" type="button" aria-expanded="false">more</button>
        <a class="btn btn-sm wnew" href="#/new/${kind}">+ Share ${isSong ? 'a song' : 'a movie'}</a>${isSong ? '' : '<a class="btn btn-sm btn-ghost wnew wmm" href="#/new/aimovie">✨ Make an AI movie</a>'}
        <div class="wpicks" hidden><h3>★ Studio Picks</h3><div class="wrow"></div></div>
        <div class="wchips" role="toolbar" aria-label="Genres"><button class="chip on" data-g="">All</button>${GENRES[kind].map((g) => `<button class="chip" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
        <div class="wsort" role="tablist"><button class="on" data-s="createdAt">New</button><button data-s="viewCount">${isSong ? 'Most played' : 'Most viewed'}</button><button data-s="likeCount">Top starred</button></div>
        <div class="wgrid"><div class="spinner"></div></div>
      </section>`;
    const q = (s) => root.querySelector(s);
    wireMore(root);
    let sort = 'createdAt', genre = '', list = [];
    const paint = () => { const v = list.filter((p) => isWork(p) && !S.blocked.has(p.authorId) && (!genre || p.work.genre === genre)); q('.wgrid').innerHTML = v.length ? v.map((p) => tile(p)).join('') : `<div class="empty">No ${isSong ? 'songs' : 'movies'} here yet. <a href="#/new/${kind}">Share the first one</a>.</div>`; wireTiles(q('.wgrid'), v); };
    const load = async () => {
      q('.wgrid').innerHTML = '<div class="spinner"></div>';
      try { const qs = await getDocs(query(collection(db, 'posts'), where('type', '==', kind), orderBy(sort, 'desc'), limit(60))); if (stale(token)) return; list = qs.docs.map((d) => ({ id: d.id, ...d.data() })); }
      catch (e) { // index still building: fall back to newest, sorted on the client
        const qs = await getDocs(query(collection(db, 'posts'), where('type', '==', kind), limit(100))).catch(() => null); if (stale(token)) return;
        list = qs ? qs.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(b[sort]?.toMillis?.() ?? b[sort]) || 0) - (Number(a[sort]?.toMillis?.() ?? a[sort]) || 0)) : [];
      }
      paint();
    };
    root.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { genre = b.dataset.g; root.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
    root.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { sort = b.dataset.s; root.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
    getDocs(query(collection(db, 'posts'), where('type', '==', kind), where('featured', '==', true), limit(12))).then((qs) => {
      const picks = qs.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isWork); if (!picks.length || stale(token)) return;
      q('.wpicks').hidden = false; q('.wpicks .wrow').innerHTML = picks.map((p) => tile(p)).join(''); wireTiles(q('.wpicks .wrow'), picks);
    }).catch(() => {});
    await load();
  }
  // Song tiles: a tap on the art plays in the mini player; the title opens the page.
  function wireTiles(box, list) {
    const songs = list.filter((p) => p.type === 'song' && p.mediaUrl);
    box.querySelectorAll('.wtile.song').forEach((a) => {
      const p = songs.find((x) => x.id === a.dataset.id); if (!p) return;
      const btn = document.createElement('button'); btn.className = 'wtile-play'; btn.type = 'button'; btn.setAttribute('aria-label', 'Play ' + p.work.title); btn.innerHTML = PLAY;
      btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); player.play(p, songs); };
      a.querySelector('.wart').appendChild(btn);
    });
  }
  function wireMore(root) {
    const p = root.querySelector('.wintro'), b = root.querySelector('.wmorebtn'); if (!p || !b) return;
    requestAnimationFrame(() => { if (p.scrollHeight <= p.clientHeight + 2) b.hidden = true; });
    b.onclick = () => { const open = p.classList.toggle('clamp') === false; b.textContent = open ? 'less' : 'more'; b.setAttribute('aria-expanded', open); };
  }
  function grid(container, posts, empty) {
    const v = posts.filter((p) => isWork(p) && !S.blocked.has(p.authorId));
    container.innerHTML = v.length ? `<div class="wgrid">${v.map((p) => tile(p)).join('')}</div>` : `<div class="empty">${empty}</div>`;
    wireTiles(container, v);
  }
  // Post a finished movie file (used by the Kemy AI Movie Maker). Same rules as the compose form.
  async function publishMovie({ file, title, desc = '', genre = 'Animation', aiTools = 'Kemy AI Movie Maker', rating = 'all', runtime = 0, onProgress }) {
    if (!requireAuth()) throw new Error('Sign in to post.');
    if (file.size > 100 * 1048576) throw new Error('Movies can be up to 100 MB.');
    if (runtime > 600.5) throw new Error('Uploads can be up to 10 minutes.');
    const r = await upload(file, CLOUDINARY.uploadPreset, 'lks_movie', onProgress);
    const d = deliveryUrls(r);
    const rt = Math.min(601, Math.round((r.duration || runtime) * 10) / 10);
    const { authorId, author } = await postAuthor(false);
    const work = { title: String(title).slice(0, 80), genre: GENRES.movie.includes(genre) ? genre : 'Animation', aiTools: aiTools.slice(0, 100), runtime: rt, yt: '', cover: '', rights: true, rating };
    const ref = doc(collection(db, 'posts'));
    const b = writeBatch(db);
    b.set(ref, {
      authorId, authorName: author.displayName, authorUsername: author.username, authorColor: author.color,
      type: 'movie', text: String(desc).slice(0, 1000), linkUrl: '', mediaUrl: d.mediaUrl, mediaType: 'video', poster: d.posterUrl,
      work, ...searchFields({ text: [work.title, desc, work.genre, aiTools].join(' '), authorName: author.displayName, authorUsername: author.username }),
      createdAt: serverTimestamp(), likeCount: 0, commentCount: 0, lastCommentId: '', studio: false
    });
    b.update(doc(db, 'users', authorId), { lastPostAt: serverTimestamp() });
    await b.commit();
    return ref.id;
  }
  return { isWork, card, page, explore, grid, composePage, tile, player, publishMovie };
}
