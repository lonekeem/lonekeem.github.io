// Kemy's Bubble Quest - game shell: screens, loop (fixed 60 Hz), saving, leaderboard, share.
import { parseLevel, newWorld, step, totals, T } from './sim.js';
import { createRenderer, VW, VH } from './render.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { starPath } from './art.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => { const s = ms / 1000; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`; };
const SKEY = 'kq-settings', PKEY = 'kq-progress';
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const WORLDS = [{ id: 'pond', name: 'Lily Pond' }, { id: 'cave', name: 'Crystal Caves' }, { id: 'reef', name: 'Neon Reef' }];
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z"/></svg>';

export async function boot(root, opts = {}) {
  const settings = load(SKEY, { muted: false, music: true, rm: matchMedia('(prefers-reduced-motion: reduce)').matches, hc: false, touch: 'auto' });
  const prog = load(PKEY, { levels: {} });
  const saveS = () => localStorage.setItem(SKEY, JSON.stringify(settings));
  const saveP = () => localStorage.setItem(PKEY, JSON.stringify(prog));
  const data = await (await fetch(new URL('../../../assets/kemy-quest/levels.json', import.meta.url))).json();
  const LEVELS = data.levels.map(parseLevel);
  root.innerHTML = `
    <div class="kq-stage"><canvas class="kq-canvas" aria-label="Kemy's Bubble Quest game"></canvas></div>
    <div class="kq-hudbtns"><button class="kq-ib" data-a="pause" aria-label="Pause">${'<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>'}</button></div>
    <div class="kq-touch" aria-hidden="true">
      <div class="kq-pad"><button data-k="left" aria-label="Left"><svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg></button><button data-k="right" aria-label="Right"><svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg></button></div>
      <div class="kq-acts"><button data-k="run" class="kq-bub" aria-label="Run and bubble"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="9.5" cy="9.5" r="1.6"/></svg><small>RUN</small></button><button data-k="jump" class="kq-jmp" aria-label="Jump"><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg><small>JUMP</small></button></div>
    </div>
    <div class="kq-ui" role="dialog" aria-live="polite"></div><div class="kq-toast" role="status"></div>`;
  const canvas = $('.kq-canvas', root), ui = $('.kq-ui', root), touchEl = $('.kq-touch', root);
  const R = createRenderer(canvas); const audio = createAudio(settings); const input = createInput(touchEl);
  R.opts = settings;
  const G = { screen: 'title', L: null, w: null, idx: 0, t: 0, label: '', labelT: 0, acc: 0, last: 0, cloud: null, user: null };
  const toast = (m) => { const t = $('.kq-toast', root); t.textContent = m; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2400); };
  const showTouch = () => settings.touch === 'on' || (settings.touch === 'auto' && (matchMedia('(pointer: coarse)').matches || /[?&]touch=1/.test(location.search)));
  function layout() {
    const vw = root.clientWidth || innerWidth, vh = root.clientHeight || innerHeight; const t = showTouch() && G.screen === 'play';
    root.classList.toggle('kq-has-touch', t); const portrait = vh > vw; root.classList.toggle('kq-portrait', portrait);
    const ctrlH = t && portrait ? Math.min(240, vh * 0.36) : 0;
    const stage = $('.kq-stage', root); stage.style.height = (vh - ctrlH) + 'px';
    R.resize(vw, vh - ctrlH);
  }
  addEventListener('resize', layout); addEventListener('orientationchange', () => setTimeout(layout, 200));
  const cloud = () => (G.cloud ||= import('./cloud.js').then((m) => m.cloud).catch(() => null));
  cloud().then(async (c) => { if (c) { G.user = await c.user(); if (G.screen === 'title') renderTitle(); } });
  // -------------------------------------------------- screens
  function setScreen(s, html) {
    G.screen = s; ui.innerHTML = html || ''; ui.classList.toggle('on', !!html); root.dataset.screen = s;
    input.playing = s === 'play'; layout();
    ui.querySelectorAll('button,a').forEach((b) => b.addEventListener('click', () => audio.play('tap')));
    const first = ui.querySelector('[autofocus],button'); if (first && !matchMedia('(pointer: coarse)').matches) first.focus({ preventScroll: true });
  }
  const unlocked = (i) => i === 0 || !!(prog.levels[LEVELS[i - 1].id] || {}).done;
  const bigCount = (id) => ((prog.levels[id] || {}).big || []).filter(Boolean).length;
  function renderTitle() {
    setScreen('title', `<div class="kq-title"><h1><span>Kemy's</span> Bubble Quest</h1><p>Hop, swim and blow bubbles across three glowing worlds.</p>
      <div class="kq-row"><button class="kq-btn big" data-go="map" autofocus>Play</button><button class="kq-btn ghost" data-go="settings">Settings</button></div>
      <p class="kq-small">${G.user ? `Signed in as ${esc(G.user.name)}. Your best times go on the leaderboard.` : `<a href="app.html#/login?next=${encodeURIComponent('kemy-quest.html')}">Sign in</a> to post best times to the leaderboard.`}</p>
      <p class="kq-keys">Move <kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> · Jump <kbd>Space</kbd>/<kbd>Z</kbd> (hold = higher) · Run &amp; bubble <kbd>X</kbd>/<kbd>Shift</kbd> · Pause <kbd>Esc</kbd></p></div>`);
    wire();
  }
  function renderMap() {
    const total = LEVELS.reduce((a, l) => a + bigCount(l.id), 0);
    setScreen('map', `<div class="kq-panel kq-map"><div class="kq-bar"><button class="kq-ib" data-go="title" aria-label="Back">←</button><h2>World map</h2><span class="kq-pill">${STAR_SVG} ${total}/${LEVELS.length * 3}</span></div>
      ${WORLDS.map((wd) => `<section class="kq-world kq-w-${wd.id}"><h3>${wd.name}</h3><div class="kq-levels">${LEVELS.map((l, i) => l.theme !== wd.id ? '' : `
        <div class="kq-lvl ${unlocked(i) ? '' : 'locked'}"><button class="kq-lvl-b" data-play="${i}" ${unlocked(i) ? '' : 'disabled aria-disabled="true"'}><b>${l.id}</b><span>${esc(l.name)}</span>
          <span class="kq-bigs" aria-label="${bigCount(l.id)} of 3 big stars">${[0, 1, 2].map((k) => `<i class="${((prog.levels[l.id] || {}).big || [])[k] ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</span>
          <small>${unlocked(i) ? ((prog.levels[l.id] || {}).best ? 'Best ' + fmt(prog.levels[l.id].best) : 'New!') : 'Locked'}</small></button>
          <button class="kq-lb-b" data-lb="${i}" aria-label="Leaderboard for ${l.id}">🏆</button></div>`).join('')}</div></section>`).join('')}</div>`);
    wire();
  }
  function renderSettings(back) {
    const tg = (k, label) => `<label class="kq-tg"><input type="checkbox" data-s="${k}" ${settings[k] ? 'checked' : ''}><span>${label}</span></label>`;
    setScreen('settings', `<div class="kq-panel"><div class="kq-bar"><button class="kq-ib" data-back aria-label="Back">←</button><h2>Settings</h2></div>
      ${tg('muted', 'Mute all sound')}${tg('music', 'Music')}${tg('rm', 'Reduced motion')}${tg('hc', 'High-contrast hazards (colorblind-safe)')}
      <label class="kq-tg sel"><span>Touch controls</span><select data-s="touch"><option value="auto">Auto</option><option value="on">On</option><option value="off">Off</option></select></label>
      <button class="kq-btn" data-back>Done</button></div>`);
    ui.querySelector('select').value = settings.touch;
    ui.querySelectorAll('[data-s]').forEach((el) => el.onchange = () => { settings[el.dataset.s] = el.type === 'checkbox' ? el.checked : el.value; saveS(); audio.apply(); R.opts = settings; });
    ui.querySelectorAll('[data-back]').forEach((b) => b.onclick = back);
  }
  async function renderLB(i, back) {
    const l = LEVELS[i];
    setScreen('lb', `<div class="kq-panel"><div class="kq-bar"><button class="kq-ib" data-back aria-label="Back">←</button><h2>${l.id} ${esc(l.name)} · Fastest</h2></div><div class="kq-lb"><div class="kq-spin"></div></div><button class="kq-btn" data-back>Back</button></div>`);
    ui.querySelectorAll('[data-back]').forEach((b) => b.onclick = back);
    const box = $('.kq-lb', ui);
    try {
      const c = await cloud(); if (!c) throw new Error('offline');
      const rows = await c.top(l.id, 10); if (G.screen !== 'lb') return;
      box.innerHTML = rows.length ? `<ol>${rows.map((r, k) => `<li class="${G.user && r.uid === G.user.uid ? 'me' : ''}"><span class="rk">${k + 1}</span><span class="av" style="--h:${(r.uid.charCodeAt(0) * 37) % 360}">${esc((r.name || '?')[0].toUpperCase())}</span><span class="nm">${esc(r.name)}${r.uname ? ` <small>@${esc(r.uname)}</small>` : ''}</span><span class="bg">${STAR_SVG}${r.big}</span><b>${fmt(r.time)}</b></li>`).join('')}</ol>`
        : '<p class="kq-small">No times yet. Be the first!</p>';
      if (!G.user) box.insertAdjacentHTML('beforeend', `<p class="kq-small"><a href="app.html#/login?next=${encodeURIComponent('kemy-quest.html')}">Sign in</a> to add your time.</p>`);
    } catch { box.innerHTML = '<p class="kq-small">Leaderboard is offline right now. Your progress is still saved on this device.</p>'; }
  }
  function wire() {
    ui.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { audio.unlock(); const g = b.dataset.go; if (g === 'map') renderMap(); else if (g === 'title') renderTitle(); else if (g === 'settings') renderSettings(renderTitle); });
    ui.querySelectorAll('[data-play]').forEach((b) => b.onclick = () => { audio.unlock(); start(+b.dataset.play); });
    ui.querySelectorAll('[data-lb]').forEach((b) => b.onclick = () => renderLB(+b.dataset.lb, renderMap));
  }
  // -------------------------------------------------- play
  function start(i) {
    G.idx = i; G.L = LEVELS[i]; G.w = newWorld(G.L); R.resetCam(G.w, G.L); G.label = `${G.L.id}  ${G.L.name}`; G.labelT = 150; G.saved = null;
    input.clear(); setScreen('play'); audio.music(WORLDS.findIndex((x) => x.id === G.L.theme)); if (!settings.music) audio.apply();
    if (location.hash !== '#lvl=' + G.L.id) history.replaceState(null, '', '#lvl=' + G.L.id);
  }
  function pause() {
    if (G.screen === 'play') {
      setScreen('pause', `<div class="kq-panel kq-pause"><h2>Paused</h2><div class="kq-col"><button class="kq-btn" data-p="resume" autofocus>Resume</button><button class="kq-btn ghost" data-p="restart">Restart level</button><button class="kq-btn ghost" data-p="settings">Settings</button><button class="kq-btn ghost" data-p="map">World map</button></div></div>`);
      ui.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { const a = b.dataset.p; if (a === 'resume') resume(); if (a === 'restart') start(G.idx); if (a === 'map') { audio.stopMusic(); renderMap(); } if (a === 'settings') renderSettings(() => { G.screen = 'play'; pause(); }); });
    } else if (G.screen === 'pause') resume();
  }
  function resume() { setScreen('play'); G.last = performance.now(); input.clear(); }
  input.onPause = () => { if (G.screen === 'play' || G.screen === 'pause') pause(); };
  $('[data-a=pause]', root).onclick = () => pause();
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.screen === 'play') pause(); });
  function onEvents(ev) {
    const p = G.w.p;
    for (const e of ev) {
      audio.play(e);
      if (e === 'star') R.burst(p.x + 6, p.y + 4, '#ffd34d', 6);
      if (e === 'big') { R.burst(p.x + 6, p.y + 4, '#ffd34d', 14); G.label = 'Big Star!'; G.labelT = 90; }
      if (e === 'stomp' || e === 'pop') R.burst(p.x + 6, p.y + 14, '#ffffff', 6);
      if (e === 'hurt') R.shake = 12;
      if (e === 'check') { G.label = 'Checkpoint!'; G.labelT = 80; R.burst(p.x + 6, p.y, '#ffb3de', 10); }
      if (e === 'power') { G.label = 'Bubble power! Press X / RUN'; G.labelT = 150; }
      if (e === 'clear') { audio.stopMusic(); }
      if (e === 'dead') { audio.stopMusic(); setTimeout(died, 900); }
    }
  }
  function died() {
    if (G.w.over !== 'dead') return;
    setScreen('dead', `<div class="kq-panel kq-pause"><h2>Oops!</h2><p>Kemy needs a little rest. Try again?</p><div class="kq-col"><button class="kq-btn" data-d="retry" autofocus>Try again</button><button class="kq-btn ghost" data-d="map">World map</button></div></div>`);
    ui.querySelector('[data-d=retry]').onclick = () => start(G.idx); ui.querySelector('[data-d=map]').onclick = renderMap;
  }
  async function cleared() {
    const L = G.L, w = G.w; const ms = Math.round(w.frame * 1000 / 60); const tot = totals(L);
    const rec = prog.levels[L.id] || { done: false, best: 0, stars: 0, big: [false, false, false] };
    const newBest = !rec.best || ms < rec.best;
    rec.done = true; rec.best = newBest ? ms : rec.best; rec.stars = Math.max(rec.stars || 0, w.stars); rec.big = [0, 1, 2].map((k) => !!(rec.big[k] || w.big[k]));
    prog.levels[L.id] = rec; saveP();
    const nBig = w.big.filter(Boolean).length; const next = G.idx + 1 < LEVELS.length;
    setScreen('clear', `<div class="kq-panel kq-clear"><div class="kq-cstar">${STAR_SVG}</div><h2>Level clear!</h2><p class="kq-sub">${L.id} ${esc(L.name)}</p>
      <div class="kq-stats"><div><small>Time</small><b>${fmt(ms)}</b>${newBest ? '<em>New best!</em>' : `<em>Best ${fmt(rec.best)}</em>`}</div><div><small>Stars</small><b>${w.stars}/${tot.stars}</b></div><div><small>Big Stars</small><b class="kq-bigs">${[0, 1, 2].map((k) => `<i class="${w.big[k] ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</b></div></div>
      <p class="kq-small kq-cloud">${G.user ? 'Saving to leaderboard…' : `<a href="app.html#/login?next=${encodeURIComponent('kemy-quest.html')}">Sign in</a> to post this time.`}</p>
      <div class="kq-col">${next ? '<button class="kq-btn" data-c="next" autofocus>Next level</button>' : '<button class="kq-btn" data-c="map" autofocus>You beat every level! Map</button>'}
      <div class="kq-row"><button class="kq-btn ghost" data-c="replay">Replay</button><button class="kq-btn ghost" data-c="lb">Leaderboard</button><button class="kq-btn ghost" data-c="share">Share my score</button><button class="kq-btn ghost" data-c="map">Map</button></div></div></div>`);
    const on = (k, f) => ui.querySelectorAll(`[data-c=${k}]`).forEach((b) => b.onclick = f);
    on('next', () => start(G.idx + 1)); on('replay', () => start(G.idx)); on('map', renderMap); on('lb', () => renderLB(G.idx, () => { G.screen = 'clear'; renderMap(); }));
    on('share', () => share(L, ms, w.stars, nBig));
    if (G.user && !opts.noCloud) {
      try { const c = await cloud(); const r = await c.save(L.id, ms, w.stars, nBig); const el = $('.kq-cloud', ui); if (el) el.textContent = r.saved ? (r.improved ? 'New personal best posted to the leaderboard!' : 'Stars updated on the leaderboard.') : `Your leaderboard best is ${fmt(r.best || ms)}.`; }
      catch { const el = $('.kq-cloud', ui); if (el) el.textContent = 'Could not reach the leaderboard. Progress is saved on this device.'; }
    }
  }
  async function share(L, ms, stars, nBig) {
    const url = `${location.origin}${location.pathname}#lvl=${L.id}`;
    const text = `I cleared ${L.id} ${L.name} in Kemy's Bubble Quest in ${fmt(ms)} with ${stars} stars and ${nBig}/3 Big Stars! Can you beat it?`;
    try { if (navigator.share) { await navigator.share({ title: "Kemy's Bubble Quest", text, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Score and link copied. Paste it into a post!'); } catch { prompt('Copy your score:', `${text} ${url}`); }
  }
  // -------------------------------------------------- loop
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(100, now - (G.last || now)); G.last = now; G.t++;
    if (G.screen === 'title' || (G.screen === 'map' || G.screen === 'settings' || G.screen === 'lb') && !G.w) { R.drawTitle(G.t); return; }
    if (!G.w) return;
    if (G.screen === 'play') {
      G.acc += dt; let n = 0;
      while (G.acc >= 1000 / 60 && n < 5) {
        G.acc -= 1000 / 60; n++;
        step(G.w, G.L, input.read()); onEvents(G.w.events); R.update(G.w, G.L); if (G.labelT > 0) G.labelT--;
        if (G.w.over === 'clear' && G.w.clearT === 100) { cleared(); break; }
      }
      if (n === 5) G.acc = 0;
    }
    if (G.screen === 'map' || G.screen === 'title') { R.drawTitle(G.t); return; }
    R.draw(G.w, G.L, G.t, { label: G.labelT > 0 ? G.label : '', labelT: G.labelT });
  }
  layout(); renderTitle(); requestAnimationFrame(frame);
  const m = /lvl=(\d-\d)/.exec(location.hash); if (m) { const i = LEVELS.findIndex((l) => l.id === m[1]); if (i >= 0 && unlocked(i)) start(i); }
  // test / automation hook (read-only state + scripted replays)
  const api = {
    get screen() { return G.screen; }, get world() { return G.w; }, levels: LEVELS.map((l) => l.id), start, pause, renderMap,
    async replay(i, speed = 1) {
      const sol = (await (await fetch(new URL('../../../assets/kemy-quest/solutions.json', import.meta.url))).json())[LEVELS[i].id];
      const path = [...sol.path].map((ch) => parseInt(ch, 36)); let f = 0;
      start(i); input.script = () => { const k = Math.floor(f / sol.macro); const a = sol.acts[path[k]] || [0, 0, 0]; const r = { left: a[0] < 0, right: a[0] > 0, jump: (f % sol.macro) < a[1], run: !!a[2], up: false, down: false }; f++; return r; };
      return new Promise((res) => { const iv = setInterval(() => { if (G.w.over) { clearInterval(iv); input.script = null; res({ over: G.w.over, frames: G.w.frame, stars: G.w.stars }); } }, 50); });
    },
    hold(k, v) { input.script = null; const s = api._s ||= { left: false, right: false, up: false, down: false, jump: false, run: false }; s[k] = v; input.script = () => ({ ...s }); },
    release() { input.script = null; api._s = null; }
  };
  window.__kq = api;
  return api;
}
