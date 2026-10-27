// 🎬 Lone Keem Studio owner editor (lazy; only the owner/admin ever loads it, and the rules only accept the owner's writes).
// Same color system as house decorating: grouped color families, recents, a custom picker, multi-part items.
// Tabs: Colors (every surface inside + outside, and any placed item) · Add (place / move / turn / remove decor) · Lights · Screen.
import { FAMILIES, recentColors, rememberColor } from './roomedit.js';
import { SURF, ZONES, DEF, ALL_DECOR, OUT_OK, partsOf, hexOk } from './theater-build.js';
import { SHERIFF_IN_THEATER } from './theater-movie.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PART = { A: 'Main', f: 'Frame', s: 'Top', p: 'Pillow', c: 'Cushion' };
const ZN = { li: '🍿 Lobby', la: '🎬 Auditorium', lo: '🏛️ Outside' };
const TINTS = [['', 'Warm white'], ['#ffd6a0', 'Gold'], ['#ff9aa8', 'Rose'], ['#a8c8ff', 'Cool blue'], ['#c9a8ff', 'Purple'], ['#a8ffcf', 'Mint']];
const CSS = `.th-ed{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:min(560px,96vw);max-height:min(52vh,430px);overflow:auto;pointer-events:auto;background:rgba(20,10,14,.94);color:#fff;border:1px solid #d4af37;border-radius:16px;padding:10px 12px;font:600 13px/1.3 Inter,system-ui,sans-serif;z-index:40;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.th-ed h4{margin:6px 0 4px;font-size:12px;color:#f3e3c3;text-transform:uppercase;letter-spacing:.04em}.th-ed .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.th-ed button{font:inherit;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:6px 9px;cursor:pointer}.th-ed button.on{background:#800020;border-color:#d4af37}
.th-ed .sw{width:26px;height:26px;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.5)}.th-ed .sw.on{outline:3px solid #d4af37}.th-ed input[type=color]{width:34px;height:28px;border:0;background:none;padding:0}
.th-ed .tabs{display:flex;gap:6px;margin-bottom:6px;position:sticky;top:-10px;background:rgba(20,10,14,.98);padding:4px 0}.th-ed .x{margin-left:auto}.th-ed .chip{font-size:12px}.th-ed input[type=range]{flex:1;min-width:140px}`;

export function openTheaterEditor(o) {
  const { K, P, uid } = o; if (!document.getElementById('th-ed-css')) { const s = document.createElement('style'); s.id = 'th-ed-css'; s.textContent = CSS; document.head.appendChild(s); }
  const el = document.createElement('div'); el.className = 'th-ed'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit theater'); K.hud.appendChild(el);
  let tab = 'col', zc = o.zoneHere() === 'lo' ? 'o' : o.zoneHere() === 'li' ? 'l' : 'a', target = null, sel = -1, selPart = 'A';
  const st = () => o.getSt(); const iz = () => o.zoneHere();
  const strip = (cur, on) => { const rec = recentColors(uid); const sw = (h, n) => `<button type="button" class="sw${hexOk(cur) === h ? ' on' : ''}" style="background:${h}" title="${esc(n)}" aria-label="${esc(n)}" data-c="${h}"></button>`;
    on.cb = true; return (rec.length ? `<h4>Recent</h4><div class="row">${rec.map((h) => sw(h, h)).join('')}</div>` : '') + FAMILIES.map((f) => `<h4>${esc(f.name)}</h4><div class="row">${f.colors.map(([h, n]) => sw(h, n)).join('')}</div>`).join('') + `<h4>Custom</h4><div class="row"><input type="color" data-custom value="${hexOk(cur) || '#800020'}"><button type="button" data-reset>↺ Default</button></div>`; };
  function paint() {
    const S = st(); let h = `<div class="tabs">${[['col', '🎨 Colors'], ['add', '🪑 Decor'], ['lt', '💡 Lights'], ['scr', '🎬 Screen']].map(([k, n]) => `<button type="button" data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}<button type="button" class="x" data-close aria-label="Close">✕</button></div>`;
    if (tab === 'col') {
      h += `<div class="row">${Object.entries(ZONES).map(([k, n]) => `<button type="button" data-zone="${k}" class="${zc === k ? 'on' : ''}">${n}</button>`).join('')}</div><h4>Surfaces</h4><div class="row">`;
      h += Object.entries(SURF).filter(([, v]) => v[2] === zc).map(([k, v]) => `<button type="button" class="chip${target === k ? ' on' : ''}" data-surf="${k}"><span class="sw" style="display:inline-block;width:12px;height:12px;vertical-align:-1px;background:${o.sv(k)}"></span> ${esc(v[0])}</button>`).join('') + '</div>';
      const L = o.items(zc === 'o' ? 'lo' : zc === 'l' ? 'li' : 'la');
      if (L.length) h += `<h4>Items here</h4><div class="row">${L.map((it, i) => `<button type="button" class="chip${target === '#' + i ? ' on' : ''}" data-it="${i}">${esc((ALL_DECOR[it.c] || {}).e || '')} ${esc((ALL_DECOR[it.c] || {}).n || it.c)}</button>`).join('')}</div>`;
      if (target && target[0] === '#') { const it = L[+target.slice(1)]; if (it) h += `<h4>Part</h4><div class="row">${['A', ...partsOf(it.c)].map((p) => `<button type="button" data-part="${p}" class="${selPart === p ? 'on' : ''}">${PART[p] || p}</button>`).join('')}</div>`; }
      if (target) { const cur = target[0] === '#' ? (() => { const it = L[+target.slice(1)]; return it ? (selPart === 'A' ? it.col : (it.parts || {})[selPart]) : ''; })() : o.sv(target); h += strip(cur, {}); } else h += '<p>Pick a surface or an item, then a color. Everyone sees it live.</p>';
    } else if (tab === 'add') {
      const z = iz(); const L = o.items(z); const codes = Object.keys(ALL_DECOR).filter((c) => (z === 'lo' ? OUT_OK.includes(c) : true));
      h += `<p>Placing in <b>${ZN[z]}</b> (walk to another area to place there). ${L.length} item${L.length === 1 ? '' : 's'}.</p><h4>Add in front of you</h4><div class="row">${codes.map((c) => `<button type="button" class="chip" data-add="${c}">${esc(ALL_DECOR[c].e || '')} ${esc(ALL_DECOR[c].n || c)}</button>`).join('')}</div>`;
      if (L.length) { h += `<h4>Placed</h4><div class="row">${L.map((it, i) => `<button type="button" class="chip${sel === i ? ' on' : ''}" data-sel="${i}">${esc(ALL_DECOR[it.c].e || '')} ${esc(ALL_DECOR[it.c].n)}</button>`).join('')}</div>`;
        if (sel >= 0 && L[sel]) h += `<h4>Move</h4><div class="row"><button type="button" data-mv="-1,0">⬅️</button><button type="button" data-mv="1,0">➡️</button><button type="button" data-mv="0,-1">⬆️</button><button type="button" data-mv="0,1">⬇️</button><button type="button" data-rot>🔄 Turn</button><button type="button" data-here>📍 To me</button><button type="button" data-del>🗑️ Remove</button></div>`; }
    } else if (tab === 'lt') {
      const lt = S.lt; const manual = o.manualLights ? o.manualLights() : lt.at > S.pl.at;
      h += `<p>${manual ? 'Manual lights (auto-dim comes back when the next movie or song starts or ends).' : 'Auto: lights dim while the movie or a song plays and come back up after.'}</p><h4>House lights</h4><div class="row"><span>🌑</span><input type="range" min="0" max="100" value="${Math.round((manual ? lt.h : 1) * 100)}" data-h><span>☀️</span></div>
        <div class="row"><button type="button" data-lv="1">☀️ House lights up</button><button type="button" data-lv="0.12">🌙 Dim</button><button type="button" data-lv="0">🌑 Dark</button><button type="button" data-auto class="${manual ? '' : 'on'}">🤖 Auto</button></div>
        <h4>Light color</h4><div class="row">${TINTS.map(([c, n]) => `<button type="button" class="chip${(lt.tint || '') === c ? ' on' : ''}" data-tint="${c}">${esc(n)}</button>`).join('')}</div>
        <h4>Spotlight</h4><div class="row"><button type="button" data-sp class="${lt.sp ? 'on' : ''}">🔦 ${lt.sp ? 'On' : 'Off'}</button><input type="color" data-spc value="${hexOk(lt.spc) || '#ffffff'}"></div>`;
    } else {
      if (o.movieInfo) { const { sh, slots = [] } = o.movieInfo(); const now = sh.phase === 'movie' || sh.phase === 'title' ? sh.film.title : sh.title || 'Showtimes'; const tm = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); const m = (x) => { const c = Math.ceil(Math.max(0, x)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
        h += `<h4>🎬 Movies: ${esc(now)}</h4><p>${sh.phase === 'off' ? 'Showtimes are off. The screen shows Coming Soon.' : sh.phase === 'movie' ? `▶️ Playing now (${m(sh.left)} left). Next show ${tm(sh.next)}.` : sh.phase === 'end' ? `Thanks card. Next show ${tm(sh.next)}.` : `⏱️ Next showing ${tm(sh.start)} (in ${m(sh.left)}).`} Hourly program, each show on :00 / :15 / :30 / :45 with a 5-minute countdown: ${slots.map((q) => `:${String(Math.round(q.at / 60)).padStart(2, '0')} ${esc(q.title)}`).join(' · ')}. ${SHERIFF_IN_THEATER ? "Under-13 players see a family film in The Sheriff's slot." : 'The Sheriff of Lone Keem is not in the theater yet (SHERIFF_IN_THEATER in theater-movie.js).'} Everyone sees the same spot. A song you Play below takes over the screen until it ends.</p>
        <div class="row"><button type="button" data-mv2="now">▶️ Start movie now</button><button type="button" data-mv2="count">⏱️ Start 5-min countdown</button><button type="button" data-mv2="sched">📅 Regular times</button></div><div class="row">${slots.map((q) => `<button type="button" data-mv2="now" data-k="${q.i}">▶️ ${esc(q.title)}</button>`).join('')}${sh.phase === 'off' ? '<button type="button" data-mv2="on">✅ Showtimes on</button>' : '<button type="button" data-mv2="off">⏹️ Showtimes off</button>'}</div><h4>🎵 Songs</h4>`; }
      const L = o.songs(); const cur = o.songAt(S.pl.i); const on = o.playing();
      h += `<p>${cur ? (on ? '▶️ Playing: ' : '⏸️ Ready: ') + esc(cur.title || cur.key) : 'No songs yet. The screen shows <b>Now Showing: Coming Soon</b>.'}</p>`;
      if (L.length) { h += `<div class="row"><button type="button" data-tp="play">▶️ Play</button><button type="button" data-tp="pause">⏸️ Pause</button><button type="button" data-tp="next">⏭️ Next</button><button type="button" data-tp="stop">⏹️ Stop</button></div><h4>Playlist</h4><div class="row">${L.map((s, i) => `<button type="button" class="chip${cur === s ? ' on' : ''}" data-song="${i}">🎵 ${esc(s.title || s.key)}${s.artist ? ' · ' + esc(s.artist) : ''}</button>`).join('')}</div>`; }
      else h += '<p>To add a song: put <code>name.mp3</code> + <code>name.json</code> (lyrics) in <code>assets/theater/</code> and add one line to <code>js/world/theater-songs.js</code>.</p>';
    }
    el.innerHTML = h;
  }
  const zKey = () => (zc === 'o' ? 'lo' : zc === 'l' ? 'li' : 'la');
  function setColor(hex) {
    const c = hexOk(hex); if (!target) return; const S = st();
    if (target[0] === '#') { const z = zKey(); const L = o.items(z); const it = L[+target.slice(1)]; if (!it) return; if (selPart === 'A') { if (c) it.col = c; else delete it.col; } else { it.parts = it.parts || {}; if (c) it.parts[selPart] = c; else delete it.parts[selPart]; } o.setItems(z, L); }
    else { const col = { ...S.col }; if (c && c !== DEF[target]) col[target] = c; else delete col[target]; o.save({ col }); o.refresh(); }
    if (c) rememberColor(uid, c); paint();
  }
  const front = () => { const z = iz(); const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); const bx = z === 'lo' ? o.OX : o.RX, bz = z === 'lo' ? o.OZ : o.RZ; return { x: Math.round((P.x + fx * 2 - bx) * 2) / 2, z: Math.round((P.z + fz * 2 - bz) * 2) / 2 }; };
  function lights(patch) { const S = st(); o.save({ lt: { ...S.lt, ...patch, at: Date.now() } }); o.applyLights(true); paint(); }
  el.addEventListener('input', (e) => { const t = e.target; if (t.matches('[data-h]')) { const S = st(); o.save({ lt: { ...S.lt, h: +t.value / 100, at: Date.now() } }); o.applyLights(true); } });
  el.addEventListener('change', (e) => { const t = e.target; if (t.matches('[data-custom]')) setColor(t.value); else if (t.matches('[data-spc]')) lights({ spc: hexOk(t.value), sp: true }); else if (t.matches('[data-h]')) paint(); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset; e.stopPropagation();
    if ('close' in d) { o.close(); return; }
    if (d.tab) { tab = d.tab; sel = -1; } else if (d.zone) { zc = d.zone; target = null; }
    else if (d.surf) target = d.surf; else if (d.it != null) { target = '#' + d.it; selPart = 'A'; } else if (d.part) selPart = d.part;
    else if (d.c) { setColor(d.c); return; } else if ('reset' in d) { setColor(''); return; }
    else if (d.add) { const z = iz(); const L = o.items(z); if (L.length >= (z === 'lo' ? 40 : 60)) { K.say('That area is full: remove something first.'); return; } L.push({ c: d.add, ...front(), r: 0 }); o.setItems(z, L); sel = L.length - 1; }
    else if (d.sel != null) sel = +d.sel;
    else if (d.mv) { const z = iz(); const L = o.items(z); const it = L[sel]; if (it) { const [dx, dz] = d.mv.split(',').map(Number); it.x += dx * 0.5; it.z += dz * 0.5; o.setItems(z, L); } }
    else if ('rot' in d) { const z = iz(); const L = o.items(z); if (L[sel]) { L[sel].r = (L[sel].r + 1) & 3; o.setItems(z, L); } }
    else if ('here' in d) { const z = iz(); const L = o.items(z); if (L[sel]) { Object.assign(L[sel], front()); o.setItems(z, L); } }
    else if ('del' in d) { const z = iz(); const L = o.items(z); if (L[sel]) { L.splice(sel, 1); o.setItems(z, L); sel = -1; } }
    else if (d.lv) lights({ h: +d.lv }); else if ('auto' in d) { const S = st(); o.save({ lt: { ...S.lt, at: 0 } }); o.applyLights(true); }
    else if (d.tint != null) lights({ tint: d.tint }); else if ('sp' in d) lights({ sp: !st().lt.sp });
    else if (d.mv2) o.movieCmd && o.movieCmd(d.mv2, d.k != null ? +d.k : undefined); else if (d.tp) o.transport(d.tp); else if (d.song != null) o.transport('play', +d.song);
    paint();
  });
  paint(); el.repaint = paint; return el;
}
