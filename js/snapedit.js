// Lone Keem Studios - edit screen after a capture: Text, Draw, Stickers, Captions, Filter, Trim,
// Save, then "Send to" (your Story, a Post, or friends as a view-once snap).
import { LOOKS, lookById } from './fx/looks.js';
import { createEngine } from './fx/engine.js';
import { goldStar } from './fx/face.js';

const PALETTE = ['#ffffff', '#111111', '#FFC83D', '#8a2be2', '#b57bff', '#ff4fa3', '#2ee6ff', '#4cff8f', '#ff3b3b'];
const EMOJI = ['😂', '😍', '🔥', '💜', '✨', '🎬', '🎵', '👑', '😎', '🥳', '💯', '🙌', '😜', '🤩', '🌙', '⚡', '🍿', '🎤', '🫶', '😭', '👀', '🌈'];
// Original vector stickers (drawn on a canvas, never copied art)
const ART = {
  star: (g, s) => goldStar(g, s / 2, s / 2, s * 0.42, 0),
  stars3: (g, s) => { goldStar(g, s * 0.32, s * 0.6, s * 0.24, -0.2); goldStar(g, s * 0.68, s * 0.42, s * 0.3, 0.2); goldStar(g, s * 0.5, s * 0.82, s * 0.13, 0); },
  kl: (g, s) => { const r = s * 0.42; const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, '#b57bff'); gr.addColorStop(1, '#5a17b0'); g.fillStyle = gr;
    g.beginPath(); g.roundRect ? g.roundRect(s / 2 - r, s / 2 - r * 0.72, r * 2, r * 1.44, r * 0.4) : g.rect(s / 2 - r, s / 2 - r * 0.72, r * 2, r * 1.44); g.fill();
    g.fillStyle = '#FFD24A'; g.font = `800 ${r * 0.95}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KL', s / 2, s / 2 + r * 0.04); },
  lonekeem: (g, s) => { g.save(); g.translate(s / 2, s / 2); g.rotate(-0.08); g.fillStyle = '#120024'; g.strokeStyle = '#FFC83D'; g.lineWidth = s * 0.03;
    g.beginPath(); g.roundRect ? g.roundRect(-s * 0.46, -s * 0.16, s * 0.92, s * 0.32, s * 0.08) : g.rect(-s * 0.46, -s * 0.16, s * 0.92, s * 0.32); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = `800 ${s * 0.13}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LONE KEEM', 0, s * 0.01); g.restore(); },
  burst: (g, s) => { g.save(); g.translate(s / 2, s / 2); g.fillStyle = '#8a2be2'; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? s * 0.3 : s * 0.46; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.fillStyle = '#FFD24A'; g.font = `900 ${s * 0.17}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WOW!', 0, s * 0.01); g.restore(); },
  heartstar: (g, s) => { g.save(); g.fillStyle = '#ff4fa3'; g.translate(s / 2, s * 0.55); g.beginPath(); g.moveTo(0, s * 0.3); g.bezierCurveTo(-s * 0.55, -s * 0.05, -s * 0.2, -s * 0.45, 0, -s * 0.15); g.bezierCurveTo(s * 0.2, -s * 0.45, s * 0.55, -s * 0.05, 0, s * 0.3); g.fill(); g.restore(); goldStar(g, s * 0.72, s * 0.25, s * 0.14, 0.3); }
};
const artURL = new Map();
function artImage(id) {
  if (artURL.has(id)) return artURL.get(id);
  const c = document.createElement('canvas'); c.width = c.height = 256; ART[id](c.getContext('2d'), 256);
  artURL.set(id, c); return c;
}
const fmt = (s) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const SVG = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c2-1 3-3 5-3s2 2 4 2 3-2 3-2"/><path d="m14 4 6 6-8 8-6-6z"/></svg>',
  sticker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v-.5A7.5 7.5 0 0 0 12.5 4h-1A7.5 7.5 0 0 0 4 11.5v1A7.5 7.5 0 0 0 11.5 20h.5l8-8z"/><path d="M12 20v-4a4 4 0 0 1 4-4h4"/><circle cx="9" cy="10" r=".8" fill="currentColor"/><circle cx="14" cy="9" r=".8" fill="currentColor"/></svg>',
  caption: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="9" width="18" height="6" rx="2"/><path d="M7 12h10"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="5"/><circle cx="15" cy="9" r="5"/><circle cx="12" cy="15" r="5"/></svg>',
  trim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
};

// opts: { file, info, story, esc, toast, lookOf, retake(), close(), mount(html, cls), sendTo(dest, file, info, extra), friends() }
export function openEditor(opts) {
  const { file, info, esc, toast } = opts;
  const isVideo = info.kind === 'video';
  const url = info.url || URL.createObjectURL(file);
  const el = opts.mount(`
    <div class="ed" data-tool="">
      <div class="ed-stage">
        <div class="ed-media">
          ${isVideo ? `<video class="ed-src" src="${url}" playsinline webkit-playsinline loop autoplay muted></video>` : `<img class="ed-src" src="${url}" alt="Your snap">`}
          <canvas class="ed-fx" hidden></canvas>
          <canvas class="ed-draw"></canvas>
          <div class="ed-layers"></div>
        </div>
      </div>
      <div class="ed-top">
        <button class="cam-btn" data-a="discard" aria-label="Discard and retake">${SVG.close}</button>
        <span class="ed-chip">${isVideo ? 'Video · <span class="ed-dur">' + fmt(info.duration) + '</span>' : 'Photo'}</span>
        ${isVideo ? '<button class="cam-btn ed-sound" data-a="sound" aria-label="Turn sound on">🔇</button>' : '<span></span>'}
      </div>
      <div class="ed-rail" role="toolbar" aria-label="Edit tools">
        <button data-t="text" aria-label="Text">${SVG.text}<span>Text</span></button>
        <button data-t="draw" aria-label="Draw">${SVG.draw}<span>Draw</span></button>
        <button data-t="sticker" aria-label="Stickers">${SVG.sticker}<span>Stickers</span></button>
        <button data-t="caption" aria-label="Caption">${SVG.caption}<span>Caption</span></button>
        <button data-t="filter" aria-label="Filter">${SVG.filter}<span>Filter</span></button>
        ${isVideo ? `<button data-t="trim" aria-label="Trim">${SVG.trim}<span>Trim</span></button>` : ''}
        <button data-t="save" aria-label="Save to device">${SVG.save}<span>Save</span></button>
      </div>
      <div class="ed-panel" hidden></div>
      <div class="ed-trash" hidden aria-hidden="true">${SVG.trash}</div>
      <div class="ed-bottom">
        <button class="ed-story" data-a="story"><span class="ed-story-dot"></span>My Story</button>
        <button class="btn ed-sendbtn" data-a="send">Send to ${SVG.send}</button>
      </div>
      <div class="ed-busy" hidden><div><div class="ed-bar"><span></span></div><p>Preparing…</p></div></div>
    </div>`, 'cam-edit');
  const $ = (s) => el.querySelector(s);
  const ed = el.querySelector('.ed');
  const stage = $('.ed-stage'), box = $('.ed-media'), src = $('.ed-src'), fxc = $('.ed-fx'), drawC = $('.ed-draw'), layersEl = $('.ed-layers'), panel = $('.ed-panel'), trash = $('.ed-trash');
  let look = opts.lookOf && opts.lookOf !== 'none' ? 'none' : 'none'; // the live look is already baked in
  let tool = '', trimA = 0, trimB = isVideo ? info.duration : 0, strokes = [], cur = null, penColor = '#FFC83D', penSize = 6;
  const layers = []; // {id, type:'text'|'sticker'|'caption', x, y, s, r, text, color, emoji, art, el}
  let eng = null, fxRaf = 0;
  window.__lksEdit = { layers, strokes, get look() { return look; }, get trim() { return [trimA, trimB]; } };

  // ---- fit the media box to the stage keeping the aspect ratio
  const natural = () => isVideo ? [src.videoWidth || info.width || 720, src.videoHeight || info.height || 1280] : [src.naturalWidth || info.width || 1080, src.naturalHeight || info.height || 1920];
  function fit() {
    const [w, h] = natural(); const sw = stage.clientWidth, sh = stage.clientHeight; if (!w || !h || !sw) return;
    const k = Math.min(sw / w, sh / h); const bw = Math.round(w * k), bh = Math.round(h * k);
    box.style.width = bw + 'px'; box.style.height = bh + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (drawC.width !== Math.round(bw * dpr)) { drawC.width = Math.round(bw * dpr); drawC.height = Math.round(bh * dpr); redraw(); }
    layers.forEach(place);
  }
  if (isVideo) src.addEventListener('loadedmetadata', fit); else if (src.complete) requestAnimationFrame(fit); else src.addEventListener('load', fit);
  window.addEventListener('resize', fit);
  requestAnimationFrame(fit);

  // ---- filter preview (WebGL engine on the photo, or each video frame)
  function paintFx() {
    if (look === 'none') { fxc.hidden = true; src.style.visibility = ''; cancelAnimationFrame(fxRaf); return; }
    if (!eng) { try { eng = createEngine(fxc); } catch { eng = null; } }
    if (!eng) { toast('Filters aren’t supported on this device'); look = 'none'; return; }
    fxc.hidden = false; src.style.visibility = 'hidden';
    const [w, h] = natural(); const k = Math.min(1, 1280 / Math.max(w, h));
    const once = () => eng.render(src, Math.round(w * k), Math.round(h * k), { look });
    cancelAnimationFrame(fxRaf);
    if (isVideo) { const loop = () => { if (src.readyState >= 2) once(); fxRaf = requestAnimationFrame(loop); }; loop(); } else once();
  }

  // ---- drawing
  function redraw() {
    const g = drawC.getContext('2d'); g.clearRect(0, 0, drawC.width, drawC.height);
    const all = cur ? [...strokes, cur] : strokes;
    all.forEach((s) => { g.strokeStyle = s.c; g.lineWidth = s.w * drawC.width; g.lineCap = 'round'; g.lineJoin = 'round';
      if (s.c === '#FFC83D' || s.c === '#8a2be2') { g.shadowColor = 'rgba(181,123,255,.8)'; g.shadowBlur = s.w * drawC.width * 1.2; } else g.shadowBlur = 0;
      g.beginPath(); s.p.forEach(([x, y], i) => (i ? g.lineTo(x * drawC.width, y * drawC.height) : g.moveTo(x * drawC.width, y * drawC.height))); if (s.p.length === 1) g.lineTo(s.p[0][0] * drawC.width + 0.1, s.p[0][1] * drawC.height); g.stroke(); });
  }
  const rel = (e) => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  drawC.addEventListener('pointerdown', (e) => { if (tool !== 'draw') return; drawC.setPointerCapture(e.pointerId); cur = { c: penColor, w: penSize / 400, p: [rel(e)] }; redraw(); });
  drawC.addEventListener('pointermove', (e) => { if (!cur) return; cur.p.push(rel(e)); redraw(); });
  const endStroke = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
  drawC.addEventListener('pointerup', endStroke); drawC.addEventListener('pointercancel', endStroke);

  // ---- layers (text / sticker / caption): drag, pinch to scale/rotate, drop on the bin to delete
  let lid = 0;
  function place(L) {
    const b = box.getBoundingClientRect();
    if (L.type === 'caption') { L.el.style.top = (L.y * 100) + '%'; return; }
    L.el.style.left = (L.x * 100) + '%'; L.el.style.top = (L.y * 100) + '%';
    L.el.style.transform = `translate(-50%,-50%) rotate(${L.r}rad) scale(${L.s})`;
    if (L.type === 'text') L.el.style.fontSize = (0.085 * b.width) + 'px';
    if (L.type === 'sticker') { L.el.style.width = L.el.style.height = (0.28 * b.width) + 'px'; L.el.style.fontSize = (0.2 * b.width) + 'px'; }
  }
  function addLayer(L) {
    L.id = ++lid; L.s = L.s || 1; L.r = L.r || 0;
    const d = document.createElement('div'); d.className = 'ed-layer ed-' + L.type; L.el = d;
    if (L.type === 'text') { d.textContent = L.text; d.style.color = L.color; }
    if (L.type === 'caption') { d.textContent = L.text; }
    if (L.type === 'sticker') { if (L.art) { const c = artImage(L.art); const im = document.createElement('img'); im.src = c.toDataURL(); im.alt = ''; d.appendChild(im); } else d.textContent = L.emoji; }
    layersEl.appendChild(d); layers.push(L); place(L); wireLayer(L); return L;
  }
  function removeLayer(L) { L.el.remove(); layers.splice(layers.indexOf(L), 1); }
  function wireLayer(L) {
    const pts = new Map(); let start = null, moved = false;
    L.el.addEventListener('pointerdown', (e) => {
      if (tool === 'draw') return;
      e.stopPropagation(); L.el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
      start = { x: L.x, y: L.y, s: L.s, r: L.r, pts: new Map(pts) };
      if (pts.size === 1) trash.hidden = false;
    });
    L.el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      const b = box.getBoundingClientRect();
      const P = [...pts.values()], S0 = [...start.pts.values()];
      if (P.length >= 2 && S0.length >= 2) {
        const d0 = Math.hypot(S0[1][0] - S0[0][0], S0[1][1] - S0[0][1]), d1 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]);
        const a0 = Math.atan2(S0[1][1] - S0[0][1], S0[1][0] - S0[0][0]), a1 = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]);
        if (L.type !== 'caption') { L.s = Math.max(0.3, Math.min(5, start.s * d1 / Math.max(1, d0))); L.r = start.r + a1 - a0; }
      } else {
        const [sx, sy] = S0[0], [x, y] = P[0];
        if (Math.abs(x - sx) + Math.abs(y - sy) > 4) moved = true;
        if (L.type !== 'caption') L.x = start.x + (x - sx) / b.width;
        L.y = Math.max(0.03, Math.min(0.97, start.y + (y - sy) / b.height));
        const tr = trash.getBoundingClientRect(); trash.classList.toggle('hot', y > tr.top - 10 && Math.abs(x - (tr.left + tr.width / 2)) < 60);
      }
      place(L);
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if (pts.size === 0) {
        if (trash.classList.contains('hot')) removeLayer(L);
        else if (!moved && (L.type === 'text' || L.type === 'caption')) editText(L);
        trash.hidden = true; trash.classList.remove('hot');
      } else start = { x: L.x, y: L.y, s: L.s, r: L.r, pts: new Map(pts) };
    };
    L.el.addEventListener('pointerup', up); L.el.addEventListener('pointercancel', up);
  }

  // ---- text entry
  function editText(L, type = 'text') {
    const isCap = (L ? L.type : type) === 'caption';
    let color = L ? L.color : '#ffffff';
    panel.hidden = false; ed.dataset.tool = 'typing';
    panel.innerHTML = `<div class="ed-type ${isCap ? 'cap' : ''}"><textarea maxlength="${isCap ? 80 : 120}" rows="${isCap ? 1 : 3}" placeholder="${isCap ? 'Add a caption…' : 'Type something…'}" aria-label="${isCap ? 'Caption' : 'Text'}">${L ? esc(L.text) : ''}</textarea>
      ${isCap ? '' : `<div class="ed-pal">${PALETTE.map((c) => `<button style="background:${c}" data-c="${c}" aria-label="Colour ${c}" class="${c === color ? 'on' : ''}"></button>`).join('')}</div>`}
      <button class="btn btn-sm ed-done">Done</button></div>`;
    const ta = panel.querySelector('textarea'); ta.style.color = isCap ? '#fff' : color; setTimeout(() => ta.focus(), 30);
    panel.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { color = b.dataset.c; ta.style.color = color; panel.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }));
    panel.querySelector('.ed-done').onclick = () => {
      const t = ta.value.trim(); panel.hidden = true; ed.dataset.tool = ''; setTool('');
      if (L) { if (!t) removeLayer(L); else { L.text = t; L.el.textContent = t; if (!isCap) { L.color = color; L.el.style.color = color; } } return; }
      if (!t) return;
      if (isCap) { const old = layers.find((x) => x.type === 'caption'); if (old) removeLayer(old); addLayer({ type: 'caption', x: 0.5, y: 0.7, text: t }); }
      else addLayer({ type: 'text', x: 0.5, y: 0.4, text: t, color });
    };
  }

  // ---- tools
  function setTool(t) {
    tool = tool === t ? '' : t; ed.dataset.tool = tool;
    el.querySelectorAll('.ed-rail [data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === tool));
    panel.hidden = true; panel.innerHTML = '';
    if (!tool) return;
    if (tool === 'text') { tool = ''; editText(null, 'text'); return; }
    if (tool === 'caption') { tool = ''; const c = layers.find((x) => x.type === 'caption'); editText(c || null, 'caption'); return; }
    if (tool === 'save') { tool = ''; ed.dataset.tool = ''; save(); el.querySelectorAll('.ed-rail [data-t]').forEach((b) => b.classList.remove('on')); return; }
    panel.hidden = false;
    if (tool === 'draw') {
      panel.innerHTML = `<div class="ed-drawbar"><div class="ed-pal">${PALETTE.map((c) => `<button style="background:${c}" data-c="${c}" aria-label="Pen colour ${c}" class="${c === penColor ? 'on' : ''}"></button>`).join('')}</div>
        <input type="range" min="2" max="24" value="${penSize}" aria-label="Pen size"><button class="cam-btn" data-a="undo" aria-label="Undo">${SVG.undo}</button></div>`;
      panel.querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { penColor = b.dataset.c; panel.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('on', x === b)); }));
      panel.querySelector('input').oninput = (e) => (penSize = +e.target.value);
      panel.querySelector('[data-a=undo]').onclick = () => { strokes.pop(); redraw(); };
    }
    if (tool === 'sticker') {
      panel.innerHTML = `<div class="ed-stickers">${Object.keys(ART).map((k) => `<button data-art="${k}" aria-label="${k} sticker"><img src="${artImage(k).toDataURL()}" alt=""></button>`).join('')}${EMOJI.map((e) => `<button data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
      panel.querySelectorAll('button').forEach((b) => (b.onclick = () => { addLayer({ type: 'sticker', x: 0.5, y: 0.45, art: b.dataset.art, emoji: b.dataset.emoji }); setTool(''); }));
    }
    if (tool === 'filter') {
      panel.innerHTML = `<div class="ed-looks">${LOOKS.map((l) => `<button data-look="${l.id}" class="${l.id === look ? 'on' : ''}"><span style="background:linear-gradient(135deg,${l.sw[0]},${l.sw[1]})"></span><small>${esc(l.name)}</small></button>`).join('')}</div>`;
      panel.querySelectorAll('[data-look]').forEach((b) => (b.onclick = () => { look = b.dataset.look; panel.querySelectorAll('[data-look]').forEach((x) => x.classList.toggle('on', x === b)); paintFx(); }));
    }
    if (tool === 'trim') {
      const D = info.duration || src.duration || 0;
      panel.innerHTML = `<div class="ed-trim"><div class="ed-trimrow"><input type="range" class="a" min="0" max="${D}" step="0.1" value="${trimA}" aria-label="Start"><input type="range" class="b" min="0" max="${D}" step="0.1" value="${trimB}" aria-label="End"></div><p class="ed-trimlab"></p></div>`;
      const a = panel.querySelector('.a'), b = panel.querySelector('.b'), lab = panel.querySelector('.ed-trimlab');
      const paint = () => { lab.textContent = `${fmt(trimA)} – ${fmt(trimB)} · ${(trimB - trimA).toFixed(1)}s`; el.querySelector('.ed-dur').textContent = fmt(trimB - trimA); };
      a.oninput = () => { trimA = Math.min(+a.value, trimB - 1); a.value = trimA; src.currentTime = trimA; paint(); };
      b.oninput = () => { trimB = Math.max(+b.value, trimA + 1); b.value = trimB; src.currentTime = Math.max(trimA, trimB - 1.5); paint(); };
      paint();
    }
  }
  el.querySelectorAll('.ed-rail [data-t]').forEach((b) => (b.onclick = () => setTool(b.dataset.t)));
  if (isVideo) src.addEventListener('timeupdate', () => { if (src.currentTime >= trimB - 0.05 || src.currentTime < trimA - 0.2) src.currentTime = trimA; });
  $('[data-a=sound]')?.addEventListener('click', () => { src.muted = !src.muted; $('[data-a=sound]').textContent = src.muted ? '🔇' : '🔊'; src.play().catch(() => {}); });

  // ---- export
  const edited = () => look !== 'none' || layers.length || strokes.length || (isVideo && (trimA > 0.05 || trimB < (info.duration || 0) - 0.05));
  function drawOverlays(g, W, H) {
    if (strokes.length) g.drawImage(drawC, 0, 0, W, H);
    const bw = box.getBoundingClientRect().width || W, k = W / bw;
    layers.forEach((L) => {
      g.save();
      if (L.type === 'caption') {
        const fs = Math.round(W * 0.042), padY = fs * 0.55; const y = L.y * H;
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, y - fs / 2 - padY, W, fs + padY * 2);
        g.fillStyle = '#fff'; g.font = `600 ${fs}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.text, W / 2, y, W * 0.94);
      } else {
        g.translate(L.x * W, L.y * H); g.rotate(L.r); g.scale(L.s, L.s);
        if (L.type === 'text') {
          const fs = W * 0.085; g.font = `800 ${fs}px "Space Grotesk", Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = fs * 0.15; g.fillStyle = L.color;
          const lines = L.text.split('\n'); lines.forEach((ln, i) => g.fillText(ln, 0, (i - (lines.length - 1) / 2) * fs * 1.15));
        } else if (L.art) { const s = W * 0.28; g.drawImage(artImage(L.art), -s / 2, -s / 2, s, s); }
        else { const fs = W * 0.2; g.font = `${fs}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L.emoji, 0, fs * 0.05); }
      }
      g.restore();
    });
    void k;
  }
  const busyEl = $('.ed-busy'), bar = busyEl.querySelector('.ed-bar span'), busyP = busyEl.querySelector('p');
  async function exportFile() {
    if (!edited()) return { file, info };
    const [w, h] = natural(); const k = Math.min(1, (isVideo ? 1280 : 1920) / Math.max(w, h));
    const W = Math.round(w * k / 2) * 2, H = Math.round(h * k / 2) * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let e2 = null; if (look !== 'none') { try { e2 = createEngine(); } catch { e2 = null; } }
    const frame = () => { if (e2) g.drawImage(e2.render(src, W, H, { look }), 0, 0, W, H); else g.drawImage(src, 0, 0, W, H); drawOverlays(g, W, H); };
    if (!isVideo) {
      frame(); e2 && e2.destroy();
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      const out = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
      return { file: out, info: { ...info, url: URL.createObjectURL(out), width: W, height: H } };
    }
    // video: replay through the canvas in real time and record it (with the original sound)
    busyEl.hidden = false; busyP.textContent = 'Preparing your video…'; bar.style.transform = 'scaleX(0)';
    const v = document.createElement('video'); v.src = url; v.playsInline = true; v.muted = false; v.preload = 'auto';
    await new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; });
    let audio = [];
    try { const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(); const s = ac.createMediaElementSource(v); const d = ac.createMediaStreamDestination(); s.connect(d); audio = d.stream.getAudioTracks(); v.__ac = ac; } catch { v.muted = true; }
    const outStream = new MediaStream([c.captureStream(30).getVideoTracks()[0], ...audio]);
    const mime = ['video/mp4;codecs=avc1,mp4a', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch { return false; } }) || '';
    const rec = new MediaRecorder(outStream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
    const parts = []; rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    v.currentTime = trimA; await new Promise((r) => { v.onseeked = r; setTimeout(r, 1500); });
    const srcEl = src; // engine draws from the replay video
    rec.start(250); await v.play().catch(() => {});
    await new Promise((resolve) => {
      const step = () => {
        if (v.currentTime >= trimB - 0.03 || v.ended) return resolve();
        if (e2) g.drawImage(e2.render(v, W, H, { look }), 0, 0, W, H); else g.drawImage(v, 0, 0, W, H);
        drawOverlays(g, W, H);
        bar.style.transform = `scaleX(${Math.min(1, (v.currentTime - trimA) / Math.max(0.1, trimB - trimA))})`;
        (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(step) : requestAnimationFrame(step));
      };
      step();
    });
    v.pause(); rec.stop(); await done; v.__ac && v.__ac.close(); e2 && e2.destroy(); void srcEl;
    busyEl.hidden = true;
    const type = (mime || 'video/webm').split(';')[0];
    const out = new File(parts, `snap-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`, { type });
    return { file: out, info: { ...info, duration: Math.round((trimB - trimA) * 10) / 10, url: URL.createObjectURL(out), width: W, height: H } };
  }
  async function save() {
    try {
      const r = await exportFile();
      const a = document.createElement('a'); a.href = URL.createObjectURL(r.file); a.download = 'kemy-' + r.file.name; document.body.appendChild(a); a.click(); a.remove();
      toast('Saved to your device');
    } catch (e) { busyEl.hidden = true; toast('Couldn’t save this one. Try again.'); console.warn(e); }
  }
  async function go(dest, extra) {
    try {
      if (dest === 'story' && isVideo && trimB - trimA > 15.5) { toast('Stories can be up to 15 seconds. Use Trim first.'); setTool('trim'); return; }
      const r = await exportFile();
      cleanup();
      opts.sendTo(dest, r.file, r.info, extra);
    } catch (e) { busyEl.hidden = true; toast('Something went wrong preparing your snap. Try again.'); console.warn(e); }
  }
  // ---- Send to
  $('[data-a=story]').onclick = () => go('story');
  $('[data-a=send]').onclick = async () => {
    panel.hidden = false; ed.dataset.tool = 'send';
    panel.innerHTML = `<div class="ed-send" role="dialog" aria-label="Send to">
      <div class="ed-send-head"><b>Send to</b><button class="cam-btn" data-a="sx" aria-label="Close">${SVG.close}</button></div>
      <button class="ed-dest" data-d="story"><span class="ed-dest-ic">◎</span><span><b>My Story</b><small>Your followers · 24 hours</small></span></button>
      <button class="ed-dest" data-d="post"><span class="ed-dest-ic">▦</span><span><b>Post</b><small>Add a caption and share to your profile</small></span></button>
      <p class="ed-send-sub">Private snaps are turned off. Players can’t message each other.</p></div>`;
    panel.querySelector('[data-a=sx]').onclick = () => { panel.hidden = true; ed.dataset.tool = ''; };
    panel.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => go(b.dataset.d)));
  };
  $('[data-a=discard]').onclick = () => { if ((layers.length || strokes.length) && !confirm('Discard this snap?')) return; cleanup(); opts.retake(); };
  function cleanup() { cancelAnimationFrame(fxRaf); window.removeEventListener('resize', fit); eng && eng.destroy(); eng = null; window.__lksEdit = null; }
  return { el, exportFile };
}
