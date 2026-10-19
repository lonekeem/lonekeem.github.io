// Kemy's Bubble Quest - game shell: screens, loop (fixed 60 Hz), saving, leaderboard, share.
import { parseLevel, newWorld, step, totals, T, BOSSES } from './sim.js?v=2';
import { createRenderer, VW, VH } from './render.js?v=2';
import { createAudio } from './audio.js?v=2';
import { createInput } from './input.js?v=2';
import { starPath } from './art.js?v=2';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (ms) => { const s = ms / 1000; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`; };
const SKEY = 'kq-settings', PKEY = 'kq-progress';
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return d; } };
const WORLDS = [
  { id: 'pond', name: 'Lily Pond', blurb: 'Hop across lily pads, reeds and ripples.', tags: ['Swimming', 'Springs'] },
  { id: 'cave', name: 'Crystal Caves', blurb: 'Glittering tunnels, lifts and spikes.', tags: ['Lifts', 'Low tunnels'] },
  { id: 'reef', name: 'Neon Reef', blurb: 'Swim through glowing coral mazes.', tags: ['Deep water', 'Puffer fish'] },
  { id: 'meadow', name: 'Sunny Meadow', blurb: 'Boing off giant mushrooms and dodge bumblebees.', tags: ['Bouncy mushrooms', 'Bumblebees'] },
  { id: 'sky', name: 'Cloud Kingdom', blurb: 'Puffy clouds crumble and the wind loves to push.', tags: ['Crumbling clouds', 'Wind & updrafts'] },
  { id: 'frost', name: 'Frosty Peaks', blurb: 'Slippery ice, wobbly icicles and sliding penguins.', tags: ['Slippery ice', 'Icicles', 'Penguins'] },
  { id: 'volcano', name: 'Volcano Glow', blurb: 'Time your jumps over lava tides and steam geysers.', tags: ['Lava tides', 'Geysers', 'Rising lava'] },
  { id: 'castle', name: 'Starlight Castle', blurb: 'Flip star switches, outsmart wisps and ride belts.', tags: ['Switch blocks', 'Wisps', 'Conveyor belts'] },
  { id: 'candy', name: 'Candy Falls', blurb: 'Secret sugary levels. Unlock them with Big Stars!', tags: ['Gumball poppers', 'Secret'], bonus: true }
];
const LEGACY = { '2-1': '1-2', '3-1': '2-2' }; // saves from the 6-level version keep their unlocks
const BOSS_LABEL = { bullfrog: 'Bramble', geode: 'Quartzback', jelly: 'Lumajelly', bee: 'Buzzbelle', cloud: 'Nimbo', walrus: 'Tusky', moth: 'Moltara', owl: 'Noctra' };
const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 6 6.5.7-4.9 4.4 1.4 6.4L12 16.9 6.2 20.1l1.4-6.4L2.7 9.3l6.5-.7z"/></svg>';

export async function boot(root, opts = {}) {
  const settings = load(SKEY, { muted: false, music: true, rm: matchMedia('(prefers-reduced-motion: reduce)').matches, hc: false, touch: 'auto' });
  const prog = load(PKEY, { levels: {} });
  const saveS = () => localStorage.setItem(SKEY, JSON.stringify(settings));
  const saveP = () => localStorage.setItem(PKEY, JSON.stringify(prog));
  const data = await (await fetch(new URL('../../../assets/kemy-quest/levels.json?v=2', import.meta.url))).json();
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
  const G = { screen: 'title', L: null, w: null, idx: 0, t: 0, label: '', labelT: 0, acc: 0, last: 0, cloud: null, user: null, speed: 1, page: 0, mapTheme: 'pond' };
  const worldOf = (l) => Math.max(0, WORLDS.findIndex((x) => x.id === l.theme));
  const bossOf = (l) => (l.ents.find((e) => e.t === 'boss') || {}).k;
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
  const done = (id) => !!(prog.levels[id] || {}).done;
  const bigCount = (id) => ((prog.levels[id] || {}).big || []).filter(Boolean).length;
  const totalBig = () => LEVELS.reduce((a, l) => a + bigCount(l.id), 0);
  function unlocked(i) {
    const l = LEVELS[i]; if (!l) return false; if (done(l.id)) return true;
    if (l.need) return totalBig() >= l.need;
    if (i === 0) return true;
    return done(LEVELS[i - 1].id) || !!(LEGACY[l.id] && done(LEGACY[l.id]));
  }
  function renderTitle() {
    setScreen('title', `<div class="kq-title"><h1><span>Kemy's</span> Bubble Quest</h1><p>Hop, swim and blow bubbles across eight glowing worlds.</p>
      <div class="kq-row"><button class="kq-btn big" data-go="map" autofocus>Play</button><button class="kq-btn ghost" data-go="settings">Settings</button></div>
      <p class="kq-small">${G.user ? `Signed in as ${esc(G.user.name)}. Your best times go on the leaderboard.` : `<a href="app.html#/login?next=${encodeURIComponent('kemy-quest.html')}">Sign in</a> to post best times to the leaderboard.`}</p>
      <p class="kq-keys">Move <kbd>←</kbd><kbd>→</kbd> / <kbd>A</kbd><kbd>D</kbd> · Jump <kbd>Space</kbd>/<kbd>Z</kbd> (hold = higher) · Run &amp; bubble <kbd>X</kbd>/<kbd>Shift</kbd> · Pause <kbd>Esc</kbd></p></div>`);
    wire();
  }
  function renderMap() {
    const total = totalBig(); const rm = settings.rm;
    const pages = WORLDS.map((wd, wi) => {
      const lv = LEVELS.map((l, i) => [l, i]).filter(([l]) => l.theme === wd.id); if (!lv.length) return '';
      const open = lv.some(([, i]) => unlocked(i)); const got = lv.reduce((a, [l]) => a + bigCount(l.id), 0);
      const need = wd.bonus ? Math.min(...lv.map(([l]) => l.need || 0)) : 0;
      return `<section class="kq-page kq-world kq-w-${wd.id} ${open ? '' : 'locked'}" data-page="${wi}" aria-label="${wd.bonus ? 'Secret world' : 'World ' + (wi + 1)}: ${esc(wd.name)}">
        <header class="kq-whead"><span class="kq-wn">${wd.bonus ? 'Secret world' : 'World ' + (wi + 1)}</span><h3>${esc(wd.name)}</h3><span class="kq-pill kq-wbig">${STAR_SVG} ${got}/${lv.length * 3}</span>
          <p>${esc(wd.blurb)}</p><div class="kq-tags">${wd.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div></header>
        ${open ? '' : `<p class="kq-lockmsg">${wd.bonus ? `Collect ${need} Big Stars to open the first secret level.` : `Beat the boss of ${esc(WORLDS[wi - 1].name)} to unlock.`}</p>`}
        <div class="kq-levels">${lv.map(([l, i]) => { const u = unlocked(i), bk = bossOf(l), r = prog.levels[l.id] || {};
          return `<div class="kq-lvl ${u ? '' : 'locked'} ${bk ? 'boss' : ''}"><button class="kq-lvl-b" data-play="${i}" ${u ? '' : 'disabled aria-disabled="true"'}><b>${esc(l.id)}${bk ? ' <em>Boss</em>' : ''}</b><span>${esc(l.name)}</span>
            <span class="kq-bigs" aria-label="${bigCount(l.id)} of 3 big stars">${[0, 1, 2].map((k) => `<i class="${(r.big || [])[k] ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</span>
            <small>${u ? (r.best ? 'Best ' + fmt(r.best) : bk ? esc(BOSSES[bk].name) : 'New!') : l.need ? `Needs ${l.need} Big Stars` : 'Locked'}</small></button>
            <button class="kq-lb-b" data-lb="${i}" aria-label="Leaderboard for ${esc(l.id)}">🏆</button></div>`; }).join('')}</div></section>`; }).join('');
    setScreen('map', `<div class="kq-panel kq-map"><div class="kq-bar"><button class="kq-ib" data-go="title" aria-label="Back">←</button><h2>World map</h2><span class="kq-pill" title="Big Stars collected">${STAR_SVG} ${total}/${LEVELS.length * 3}</span></div>
      <div class="kq-pages" tabindex="0" aria-label="Worlds (swipe or use the arrows)">${pages}</div>
      <div class="kq-pager"><button class="kq-ib" data-pg="-1" aria-label="Previous world">‹</button><div class="kq-dots">${WORLDS.map((wd, wi) => `<button data-dot="${wi}" aria-label="${esc(wd.name)}"></button>`).join('')}</div><button class="kq-ib" data-pg="1" aria-label="Next world">›</button></div></div>`);
    wire();
    const box = $('.kq-pages', ui); const n = WORLDS.length;
    const setDots = (pg) => { G.page = pg; G.mapTheme = WORLDS[pg].id; ui.querySelectorAll('[data-dot]').forEach((d, k) => { d.classList.toggle('on', k === pg); d.setAttribute('aria-current', k === pg ? 'true' : 'false'); });
      ui.querySelector('[data-pg="-1"]').disabled = pg === 0; ui.querySelector('[data-pg="1"]').disabled = pg === n - 1; if (prog.page !== pg) { prog.page = pg; saveP(); } };
    const go = (pg, smooth = true) => { pg = Math.max(0, Math.min(n - 1, pg)); box.scrollTo({ left: pg * box.clientWidth, behavior: smooth && !rm ? 'smooth' : 'auto' }); setDots(pg); };
    let st = 0; box.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => { const pg = Math.round(box.scrollLeft / Math.max(1, box.clientWidth)); if (pg !== G.page) setDots(pg); }, 80); }, { passive: true });
    ui.querySelectorAll('[data-pg]').forEach((b) => b.onclick = () => go(G.page + +b.dataset.pg));
    ui.querySelectorAll('[data-dot]').forEach((b) => b.onclick = () => go(+b.dataset.dot));
    box.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { go(G.page + 1); e.preventDefault(); } if (e.key === 'ArrowLeft') { go(G.page - 1); e.preventDefault(); } });
    // open on the saved page, or the newest world with something to play
    let pg = prog.page ?? -1; if (!(pg >= 0 && pg < n)) { pg = 0; WORLDS.forEach((wd, wi) => { if (!wd.bonus && LEVELS.some((l, i) => l.theme === wd.id && unlocked(i))) pg = wi; }); }
    G.renderPage = (k) => go(k, false);
    requestAnimationFrame(() => go(pg, false));
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
  function start(i, speed = 1) {
    G.idx = i; G.L = LEVELS[i]; G.w = newWorld(G.L); R.resetCam(G.w, G.L); G.label = `${G.L.id}  ${G.L.name}`; G.labelT = 150; G.saved = null; G.speed = speed; G.acc = 0;
    input.clear(); setScreen('play'); audio.music(G.L.music ?? worldOf(G.L)); if (!settings.music) audio.apply();
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
      if (e === 'boss') { G.label = G.w.boss.name + '!'; G.labelT = 150; }
      if (e === 'bosshit') { const B = G.w.boss; R.shake = 10; R.burst(B.x + B.w / 2, B.y + 4, '#ffd34d', 12); if (B.hp > 0) { G.label = `${BOSS_LABEL[B.k] || 'Boss'}: ${B.hp} more!`; G.labelT = 70; } }
      if (e === 'bossdown') { const B = G.w.boss; R.burst(B.x + B.w / 2, B.y + B.h / 2, '#ffb3de', 16); G.label = `${BOSS_LABEL[B.k] || 'Boss'} calmed down! Gate open`; G.labelT = 160; }
      if (e === 'switch') R.burst(p.x + 6, p.y + 14, G.w.sw ? '#6fc8ff' : '#ff7fc8', 8);
      if (e === 'crumble' && !settings.rm) R.shake = Math.max(R.shake, 3);
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
    const L = G.L, w = G.w; const ms = Math.round(w.frame * 1000 / 60); const tot = totals(L); const bigBefore = totalBig();
    const rec = prog.levels[L.id] || { done: false, best: 0, stars: 0, big: [false, false, false] };
    const newBest = !rec.best || ms < rec.best;
    rec.done = true; rec.best = newBest ? ms : rec.best; rec.stars = Math.max(rec.stars || 0, w.stars); rec.big = [0, 1, 2].map((k) => !!(rec.big[k] || w.big[k]));
    prog.levels[L.id] = rec; saveP();
    const nBig = w.big.filter(Boolean).length; const next = G.idx + 1 < LEVELS.length && unlocked(G.idx + 1) && !(L.id === '8-5' && LEVELS[G.idx + 1].need);
    const opened = LEVELS.filter((l) => l.need && l.need > bigBefore && l.need <= totalBig()); if (opened.length) setTimeout(() => toast(`Secret level ${opened.map((l) => l.id + ' ' + l.name).join(', ')} unlocked!`), 600);
    const finale = L.id === '8-5';
    setScreen('clear', `<div class="kq-panel kq-clear"><div class="kq-cstar">${STAR_SVG}</div><h2>${finale ? 'Starlight Castle is saved!' : bossOf(L) ? 'Boss cleared!' : 'Level clear!'}</h2><p class="kq-sub">${L.id} ${esc(L.name)}</p>
      <div class="kq-stats"><div><small>Time</small><b>${fmt(ms)}</b>${newBest ? '<em>New best!</em>' : `<em>Best ${fmt(rec.best)}</em>`}</div><div><small>Stars</small><b>${w.stars}/${tot.stars}</b></div><div><small>Big Stars</small><b class="kq-bigs">${[0, 1, 2].map((k) => `<i class="${w.big[k] ? 'got' : ''}">${STAR_SVG}</i>`).join('')}</b></div></div>
      <p class="kq-small kq-cloud">${G.user ? 'Saving to leaderboard…' : `<a href="app.html#/login?next=${encodeURIComponent('kemy-quest.html')}">Sign in</a> to post this time.`}</p>
      <div class="kq-col">${finale ? '<p class="kq-small">Kemy calmed Noctra and every world glows again. Hunt Big Stars to open the secret Candy Falls levels!</p>' : ''}${next ? '<button class="kq-btn" data-c="next" autofocus>Next level</button>' : `<button class="kq-btn" data-c="map" autofocus>${finale || L.need ? 'World map' : 'Back to the map'}</button>`}
      <div class="kq-row"><button class="kq-btn ghost" data-c="replay">Replay</button><button class="kq-btn ghost" data-c="lb">Leaderboard</button><button class="kq-btn ghost" data-c="share">Share my score</button><button class="kq-btn ghost" data-c="map">Map</button></div></div></div>`);
    const on = (k, f) => ui.querySelectorAll(`[data-c=${k}]`).forEach((b) => b.onclick = f);
    on('next', () => { prog.page = worldOf(LEVELS[G.idx + 1]); start(G.idx + 1); }); on('replay', () => start(G.idx)); on('map', renderMap); on('lb', () => renderLB(G.idx, () => { G.screen = 'clear'; renderMap(); }));
    on('share', () => share(L, ms, w.stars, nBig));
    if (G.user && !opts.noCloud) {
      try { const c = await cloud(); const r = await c.save(L.id, ms, w.stars, nBig); const el = $('.kq-cloud', ui); if (el) el.textContent = r.saved ? (r.improved ? 'New personal best posted to the leaderboard!' : 'Stars updated on the leaderboard.') : `Your leaderboard best is ${fmt(r.best || ms)}.`; }
      catch { const el = $('.kq-cloud', ui); if (el) el.textContent = 'Could not reach the leaderboard. Progress is saved on this device.'; }
    }
    // Kemy scoreboard: total stars (best per level) + levels cleared.
    if (G.user && !opts.noCloud) {
      const lv = Object.values(prog.levels || {}); const stars = lv.reduce((n, r) => n + (r.stars || 0), 0), levels = lv.filter((r) => r.done).length;
      import('../../leaderboard.js').then((m) => m.recordAndShow('quest', { stars, levels })).catch(() => {});
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
    if (G.screen === 'title' || (G.screen === 'map' || G.screen === 'settings' || G.screen === 'lb') && !G.w) { R.drawTitle(G.t, G.screen === 'map' ? G.mapTheme : 'pond'); return; }
    if (!G.w) return;
    if (G.screen === 'play') {
      G.acc += dt * G.speed; let n = 0; const cap = 5 * G.speed;
      while (G.acc >= 1000 / 60 && n < cap) {
        G.acc -= 1000 / 60; n++;
        step(G.w, G.L, input.read()); onEvents(G.w.events); R.update(G.w, G.L); if (G.labelT > 0) G.labelT--;
        if (G.w.over === 'clear' && G.w.clearT === 100) { cleared(); break; }
      }
      if (n === cap) G.acc = 0;
    }
    if (G.screen === 'map' || G.screen === 'title') { R.drawTitle(G.t, G.screen === 'map' ? G.mapTheme : 'pond'); return; }
    R.draw(G.w, G.L, G.t, { label: G.labelT > 0 ? G.label : '', labelT: G.labelT });
  }
  layout(); renderTitle(); requestAnimationFrame(frame);
  const m = /lvl=([\w-]+)/.exec(location.hash); if (m) { const i = LEVELS.findIndex((l) => l.id === m[1]); if (i >= 0 && unlocked(i)) start(i); }
  // test / automation hook (read-only state + scripted replays)
  const api = {
    get screen() { return G.screen; }, get world() { return G.w; }, get page() { return G.page; }, levels: LEVELS.map((l) => l.id), start, pause, renderMap, unlocked,
    async replay(i, speed = 1) {
      const sol = (await (await fetch(new URL('../../../assets/kemy-quest/solutions.json?v=2', import.meta.url))).json())[LEVELS[i].id];
      const path = [...sol.path].map((ch) => parseInt(ch, 36)); let f = 0;
      start(i, speed); input.script = () => { const k = Math.floor(f / sol.macro); const a = sol.acts[path[k]] || [0, 0, 0]; const r = { left: a[0] < 0, right: a[0] > 0, jump: (f % sol.macro) < a[1], run: !!a[2], up: false, down: false }; f++; return r; };
      return new Promise((res) => { const iv = setInterval(() => { if (G.w.over) { clearInterval(iv); input.script = null; res({ over: G.w.over, frames: G.w.frame, stars: G.w.stars }); } }, 50); });
    },
    hold(k, v) { input.script = null; const s = api._s ||= { left: false, right: false, up: false, down: false, jump: false, run: false }; s[k] = v; input.script = () => ({ ...s }); },
    release() { input.script = null; api._s = null; }
  };
  window.__kq = api;
  return api;
}
