// Chess UI ("Capy Chess"): a carved wooden board with plush animal piece sets (capybaras, kitties,
// jungle friends, or classic carved pieces), sliding moves and capture poofs, Ludo-style player cards,
// a VS intro, and a celebration screen. Tap a piece, then tap a highlighted square.
// Local play is against a small alpha-beta engine (module worker when available); online rooms keep the
// same Firestore game shape as before (players[0] = White) so old rooms, rules and codes keep working.
// All art here is original and made for Kemy. Chess assets (css/chess.css, assets/chess/*) load only
// when Chess opens.
import * as C from './chess-engine.js';
import { isBot, tsMs, TURN_SECONDS } from './net.js';
import { ask, palByLevel, normLevel, saveLevel, whenOffer, offerHtml, stopOffer, lastLevel, onlyBots } from './bots.js';
import { codeBoxHtml, codeFormHtml, wireCodeForms } from './code-join.js';

const ART = 'assets/chess/';
export const SETS = [
  { id: 'capy', name: 'Capybara Crew', blurb: 'Sleepy capybaras, an owl bishop' },
  { id: 'kitty', name: 'Kitty Kingdom', blurb: 'Cats in crowns and capes' },
  { id: 'jungle', name: 'Jungle Friends', blurb: 'Red panda, bunny, turtle, fox' },
  { id: 'classic', name: 'Classic', blurb: 'Simple carved pieces' }
];
const BACKS = [['wood', 'Cozy wood'], ['jungle', 'Jungle river'], ['spring', 'Hot spring']];
const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['expert', 'Expert']];
const LV = Object.fromEntries(LEVELS);
const MODES = [['', '60s a move'], ['5', '5 min'], ['10', '10 min']];
const K = { set: 'kemy-chess-set', back: 'kemy-chess-back', side: 'kemy-chess-side', mode: 'kemy-chess-mode' };
const rd = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
export const curSet = () => { const s = rd(K.set, 'capy'); return SETS.some((x) => x.id === s) ? s : 'capy'; };
const curBack = () => { const b = rd(K.back, 'wood'); return BACKS.some((x) => x[0] === b) ? b : 'wood'; };

// Classic set: original rounded silhouettes. White = ivory with a dark outline, Black = charcoal with gold trim.
const SHAPES = {
  p: '<path d="M22.5 9.5a5 5 0 0 1 3.1 8.9c2.3 1.5 3.9 4 3.9 6.9 0 1.7-.6 3.3-1.6 4.6 3.3 1.6 5.6 4.7 6.1 8.6H10.9c.5-3.9 2.8-7 6.1-8.6a7.5 7.5 0 0 1-1.6-4.6c0-2.9 1.6-5.4 3.9-6.9a5 5 0 0 1 3.2-8.9z"/>',
  r: '<path d="M11.5 9h4.5v3.5h3.5V9h6v3.5h3.5V9h4.5v7.5l-3.2 3v11l3.4 3.5v4.5H11.3V34l3.4-3.5v-11l-3.2-3z"/><path d="M15.5 20h14" class="ln"/>',
  n: '<path d="M14.5 38.5c0-6 2.5-9.2 6.6-12.4-3 .3-5.5 1.6-7.6 3.6l-2.6-2.4c.4-5.2 3.8-10.5 8.4-13.6l-.8-4.6 4.2 2.5c7.5 0 13 6.2 13 15.7v11.2z"/><circle cx="21" cy="17" r="1.6" class="eye"/>',
  b: '<path d="M22.5 5.5c1.6 0 2.9 1.3 2.9 2.9 0 .6-.2 1.2-.5 1.7 4.4 2.6 7.6 7.3 7.6 12.2 0 3.4-1.7 6.1-4.2 7.6l2.6 2.6v4H14.1v-4l2.6-2.6c-2.5-1.5-4.2-4.2-4.2-7.6 0-4.9 3.2-9.6 7.6-12.2a2.9 2.9 0 0 1 2.4-4.6z"/><path d="M25.5 15.5l-4.5 6" class="ln"/>',
  q: '<path d="M9 15.5l5.5 13 2.2-15.5 5.8 14 5.8-14 2.2 15.5 5.5-13-2 18.5H11z"/><path d="M11.4 35h22.2v4H11.4z"/><circle cx="9" cy="14" r="2.2"/><circle cx="16.7" cy="11.5" r="2.2"/><circle cx="22.5" cy="10.5" r="2.2"/><circle cx="28.3" cy="11.5" r="2.2"/><circle cx="36" cy="14" r="2.2"/>',
  k: '<path d="M21 2.5h3v3.2h3.2v3H24V13h-3V8.7h-3.2v-3H21z" class="st"/><path d="M22.5 15c5 0 9 2.8 10.6 7.2l2.4-1.4c1.3 2.3.8 6-1.6 9l-1.4 4.2H12.5l-1.4-4.2c-2.4-3-2.9-6.7-1.6-9l2.4 1.4c1.6-4.4 5.6-7.2 10.6-7.2z"/><path d="M11.4 35h22.2v4H11.4z"/>'
};
export function pieceSvg(q) {
  const t = q.toLowerCase(), w = q !== t;
  return `<svg class="ch-pc cx-cl ${w ? 'w' : 'b'}" viewBox="0 0 45 45" aria-hidden="true">${SHAPES[t]}</svg>`;
}
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const START_N = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const sprite = (set, q) => `${ART}${set}/${q === q.toUpperCase() ? 'w' : 'b'}${q.toLowerCase()}.webp`;
export function pieceHtml(q, set = curSet(), cls = '') {
  if (set === 'classic') return pieceSvg(q);
  return `<img class="cx-spr ${cls}" src="${sprite(set, q)}" alt="" draggable="false" decoding="async">`;
}
const preloaded = new Set();
function preload(set) {
  if (set === 'classic' || preloaded.has(set)) return; preloaded.add(set);
  for (const q of 'KQRBNPkqrbnp') { const i = new Image(); i.decoding = 'async'; i.src = sprite(set, q); }
}
function ensureCss() {
  if (document.getElementById('cx-css')) return;
  const l = document.createElement('link'); l.id = 'cx-css'; l.rel = 'stylesheet'; l.href = 'css/chess.css?v=2';
  l.onerror = () => document.querySelectorAll('.cx-game').forEach((e) => { e.style.opacity = '1'; });
  document.head.appendChild(l);
}
const fmt = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const RING_C = 2 * Math.PI * 37;
const count = (b) => { let n = 0; for (const q of b) if (q !== '.') n++; return n; };
const isW = (q) => q !== '.' && q === q.toUpperCase();

// Original bot-capybara face (CPU avatar): round capy with a tiny antenna and headphones.
function capyFace(bot = true) {
  return `<svg viewBox="0 0 64 64" class="cx-capyface" aria-hidden="true">
    ${bot ? '<path d="M32 9v-5" stroke="#5b4a3a" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="4.5" r="3.4" fill="#5fe3ff" stroke="#1d6c80" stroke-width="1.2"/>' : ''}
    <ellipse cx="17" cy="16" rx="5" ry="4.2" fill="#8a5a33"/><ellipse cx="47" cy="16" rx="5" ry="4.2" fill="#8a5a33"/>
    <ellipse cx="17" cy="16.5" rx="2.4" ry="2" fill="#5e3a1f"/><ellipse cx="47" cy="16.5" rx="2.4" ry="2" fill="#5e3a1f"/>
    <path d="M10 34c0-14 10-22 22-22s22 8 22 22c0 13-10 22-22 22S10 47 10 34z" fill="#b07a48"/>
    <path d="M18 40c0-6 6-9 14-9s14 3 14 9-6 11-14 11-14-5-14-11z" fill="#c99566"/>
    <path d="M20.5 31.5q3.5 2.8 7 0M36.5 31.5q3.5 2.8 7 0" stroke="#3a2414" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <ellipse cx="32" cy="38.5" rx="6.5" ry="4.2" fill="#5a3820"/><ellipse cx="29.6" cy="38" rx="1.3" ry="1.6" fill="#2b190c"/><ellipse cx="34.4" cy="38" rx="1.3" ry="1.6" fill="#2b190c"/>
    <path d="M28.5 45.5q3.5 2.4 7 0" stroke="#3a2414" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="19" cy="40" rx="3.2" ry="2" fill="#f09a8a" opacity=".55"/><ellipse cx="45" cy="40" rx="3.2" ry="2" fill="#f09a8a" opacity=".55"/>
    ${bot ? '<path d="M8.5 36a23.5 23.5 0 0 1 47 0" stroke="#2f3b55" stroke-width="3.2" fill="none"/><rect x="4.5" y="32" width="7" height="11" rx="3" fill="#41c4e8" stroke="#2f3b55" stroke-width="1.6"/><rect x="52.5" y="32" width="7" height="11" rx="3" fill="#41c4e8" stroke="#2f3b55" stroke-width="1.6"/>' : ''}
  </svg>`;
}

// Captured pieces per team: index 0 = what White took (black pieces), 1 = what Black took.
function capsOf(b) {
  const n = {}; for (const q of b) if (q !== '.') n[q] = (n[q] || 0) + 1;
  const took = [[], []]; const val = [0, 0];
  for (const t of 'qrbnp') {
    const lostB = Math.max(0, START_N[t] - (n[t] || 0)), lostW = Math.max(0, START_N[t] - (n[t.toUpperCase()] || 0));
    for (let i = 0; i < lostB; i++) took[0].push(t);
    for (let i = 0; i < lostW; i++) took[1].push(t.toUpperCase());
    val[0] += lostB * VAL[t]; val[1] += lostW * VAL[t];
  }
  return [0, 1].map((i) => ({ list: took[i], adv: val[i] - val[1 - i] }));
}

// ---------------------------------------------------------------- board view
// 64 static square buttons take the taps; pieces live in their own layer (pointer-events: none) so a
// move is a CSS transform slide instead of a repaint, and a capture can "poof".
function boardView(host, sfx) {
  host.innerHTML = `<div class="cx-frame"><div class="cx-board"><div class="cx-sqs"></div><div class="cx-pcs"></div><div class="cx-fx"></div></div><div class="cx-files" aria-hidden="true"></div><div class="cx-ranks" aria-hidden="true"></div></div>`;
  const sqs = host.querySelector('.cx-sqs'), pcs = host.querySelector('.cx-pcs'), fx = host.querySelector('.cx-fx');
  let flip = null, prev = null, set = curSet(), onTap = null;
  const map = new Map(), btns = [];
  const disp = (s) => { const r = s >> 3, c = s & 7; return flip ? [7 - r, 7 - c] : [r, c]; };
  function place(el, s) { const [r, c] = disp(s); el.style.transform = `translate(${c * 100}%,${r * 100}%)`; el.style.zIndex = String(10 + r); el.dataset.s = s; }
  function layout(f) {
    flip = f; sqs.textContent = '';
    for (let i = 0; i < 64; i++) {
      const s = f ? 63 - i : i, r = s >> 3, c = s & 7, b = document.createElement('button');
      b.type = 'button'; b.dataset.s = s; b.dataset.base = 'cx-sq ' + ((r + c) % 2 ? 'dk' : 'lt'); b.className = b.dataset.base;
      b.style.backgroundPosition = `${(s * 37) % 100}% ${(s * 61 + r * 13) % 100}%`;
      b.onclick = () => onTap && onTap(s);
      sqs.appendChild(b); btns[s] = b;
    }
    host.querySelector('.cx-files').innerHTML = [...(f ? 'hgfedcba' : 'abcdefgh')].map((x) => `<i>${x}</i>`).join('');
    host.querySelector('.cx-ranks').innerHTML = [...(f ? '12345678' : '87654321')].map((x) => `<i>${x}</i>`).join('');
    map.forEach((el, s) => place(el, s));
  }
  function setQ(el, q) { el.dataset.q = q; el.innerHTML = `<span class="cx-pi">${pieceHtml(q, set)}</span>`; }
  function make(q, s) { const el = document.createElement('div'); el.className = 'cx-pc'; setQ(el, q); place(el, s); pcs.appendChild(el); return el; }
  function hop(el, t) { el.classList.remove('mv'); void el.offsetWidth; el.classList.add('mv'); place(el, t); setTimeout(() => el.classList.remove('mv'), 360); }
  function kill(el, s, quiet) {
    el.classList.add('gone'); setTimeout(() => el.remove(), 420);
    if (quiet) return;
    const [r, c] = disp(s), p = document.createElement('div');
    p.className = 'cx-poof'; p.style.transform = `translate(${c * 100}%,${r * 100}%)`;
    p.innerHTML = '<i></i><i></i><i></i><i></i><i></i><i></i><b>✦</b>';
    setTimeout(() => { fx.appendChild(p); setTimeout(() => p.remove(), 700); }, 150);
  }
  function sync(b, last) {
    const bs = typeof b === 'string' ? b : b.join('');
    if (prev === bs) return;
    const moved = new Set();
    if (prev && last) {
      const [f, t] = String(last).split('-').map(Number), el = map.get(f);
      if (el && prev[f] !== '.' && bs[f] === '.' && bs[t] !== '.' && isW(prev[f]) === isW(bs[t])) {
        let cap = prev[t] !== '.' ? t : -1;
        if (/p/i.test(prev[f]) && (f & 7) !== (t & 7) && prev[t] === '.') cap = (f & 56) | (t & 7);
        if (cap >= 0 && map.get(cap)) { kill(map.get(cap), cap); map.delete(cap); }
        map.delete(f); hop(el, t); map.set(t, el); moved.add(t);
        if (/k/i.test(prev[f]) && Math.abs((t & 7) - (f & 7)) === 2) {
          const rf = t > f ? f + 3 : f - 4, rt = t > f ? f + 1 : f - 1, rk = map.get(rf);
          if (rk) { map.delete(rf); setTimeout(() => hop(rk, rt), 90); map.set(rt, rk); moved.add(rt); }
        }
      }
    }
    for (const [s, el] of [...map]) if (bs[s] === '.') { if (prev) kill(el, s, true); else el.remove(); map.delete(s); }
    for (let s = 0; s < 64; s++) {
      const q = bs[s]; if (q === '.') continue;
      const el = map.get(s);
      if (!el) { const n = make(q, s); map.set(s, n); if (prev) n.classList.add('in'); }
      else if (el.dataset.q !== q) setQ(el, q);
    }
    prev = bs;
  }
  function paint(v) {
    if (v.flip !== flip) layout(v.flip);
    onTap = v.onTap;
    sync(v.pos.b, v.last);
    const [lf, lt] = String(v.last || '').split('-').map(Number);
    for (let s = 0; s < 64; s++) {
      const b = btns[s], d = v.dests.get(s), q = v.pos.b[s];
      b.className = b.dataset.base + (s === v.sel ? ' sel' : '') + (d ? (q !== '.' || d.ep ? ' cap' : ' dst') : '') + (s === lf || s === lt ? ' last' : '') + (s === v.chk ? ' chk' : '') + (v.from.has(s) ? ' can' : '');
      b.tabIndex = v.from.has(s) || d ? 0 : -1;
      b.setAttribute('aria-label', C.sqName(s) + (q !== '.' ? ` ${isW(q) ? 'white' : 'black'} ${NAMES[q.toLowerCase()]}` : '') + (d ? ', move here' : ''));
    }
    map.forEach((el, s) => { el.classList.toggle('sel', s === v.sel); el.classList.toggle('chk', s === v.chk); });
  }
  return {
    paint,
    setSet(s) { set = s; map.forEach((el) => el.remove()); map.clear(); prev = null; },
    get set() { return set; }
  };
}

export function createChess(ctx) {
  const { S, db, main, esc, $, avatar, toast, friendlyError, openModal, closeModal, ui } = ctx;
  const { net } = ui;
  let BV = null, CARDS = null;

  // ---------------------------------------------------------------- shared screen
  function shell(title, back) {
    ensureCss(); preload(curSet());
    ui.shell(esc(title), `<div class="cx-game" data-back="${curBack()}" style="opacity:0">
      <div class="cx-slot cx-top" id="cx-top"></div>
      <div class="g-stage ch-stage cx-stage"><div class="g-fx"></div><div id="g-board" class="cx-host"></div></div>
      <div class="cx-pillrow"><div class="g-status cx-pill" id="g-status" aria-live="polite"></div></div>
      <div class="cx-slot cx-bot" id="cx-bot"></div>
      <div class="ch-moves cx-moves" id="ch-moves" aria-label="Moves"></div>
      ${ui.emoteBar()}<div class="g-actions cx-actions" id="g-actions"></div></div>`, back);
    BV = boardView($('#g-board'));
    CARDS = cardsView();
    // phones: bring the whole table (both cards + board) into view under the sticky header
    requestAnimationFrame(() => { const g = $('.cx-game'), h = document.querySelector('header'); if (!g || innerHeight > 1000) return;
      const hb = h && /sticky|fixed/.test(getComputedStyle(h).position) ? h.getBoundingClientRect().bottom : 0;
      const dy = g.getBoundingClientRect().top - hb - 4; if (dy > 8) window.scrollBy(0, dy); });
  }
  function pickPromo(white) {
    return new Promise((res) => {
      openModal(`<div class="cx-promo-m"><h2>Promote your pawn</h2><div class="ch-promo cx-promo">${'qrbn'.split('').map((t) => `<button data-p="${t}" aria-label="${NAMES[t]}">${pieceHtml(white ? t.toUpperCase() : t)}<small>${NAMES[t]}</small></button>`).join('')}</div></div>`, { dismissable: false });
      document.querySelectorAll('.cx-promo [data-p]').forEach((b) => b.onclick = () => { closeModal(); res(b.dataset.p); });
    });
  }
  // v = { pos, mySide (0 white / 1 black / -1), live, sel, last: 'f-t', onSelect, onMove }
  function paintBoard(v) {
    if (!BV || !$('#g-board')) return;
    const p = v.pos, moves = v.live ? C.legal(p) : [];
    const from = new Set(moves.map((m) => m.f)), dests = new Map();
    moves.filter((m) => m.f === v.sel).forEach((m) => { if (!dests.has(m.t)) dests.set(m.t, m); });
    const chk = C.inCheck(p) ? p.b.indexOf(p.w ? 'K' : 'k') : -1;
    BV.paint({ pos: p, flip: v.mySide === 1, sel: v.sel, last: v.last, dests, from, chk, onTap: async (s) => {
      if (!v.live) return;
      if (dests.has(s)) {
        let m = dests.get(s);
        if (m.p) { const t = await pickPromo(p.w); m = moves.find((x) => x.f === m.f && x.t === m.t && x.p === t); }
        v.onMove(m); return;
      }
      v.onSelect(from.has(s) && s !== v.sel ? s : -1); ui.sfx.play('tap');
    } });
  }
  function paintMoves(sans) {
    const el = $('#ch-moves'); if (!el) return;
    let h = '';
    for (let i = 0; i < sans.length; i += 2) h += `<span><b>${i / 2 + 1}.</b> ${esc(sans[i])}${sans[i + 1] ? ' ' + esc(sans[i + 1]) : ''}</span>`;
    el.innerHTML = h || '<span class="muted">White moves first.</span>';
    el.scrollLeft = el.scrollWidth;
  }
  function moveSfx(prevB, pos) {
    ui.sfx.play(count(prevB) > count(pos.b) ? 'woodCapture' : 'woodMove');
    if (C.inCheck(pos)) setTimeout(() => ui.sfx.play('check'), 140);
  }
  function setPill(text, kind) {
    const el = $('#g-status'); if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    el.className = 'g-status cx-pill' + (kind ? ' ' + kind : '');
  }

  // ---------------------------------------------------------------- player cards
  function face(p, big) {
    if (!p || !p.uid) return `<span class="cx-av cx-empty" aria-hidden="true">${capyFace(false)}</span>`;
    if (p.bot || isBot(p.uid)) return `<span class="cx-av cx-botav" aria-hidden="true">${capyFace(true)}</span>`;
    const base = p.uname ? avatar({ uid: p.uid, displayName: p.name, username: p.uname, color: p.color }, big ? 'lg' : 'md', false) : `<span class="cx-av cx-guest">${capyFace(false)}</span>`;
    return `<span class="cx-av">${base}<canvas class="cx-pal" width="96" height="96" data-pal="${esc(p.uid)}" aria-hidden="true"></canvas></span>`;
  }
  function hydratePals(root) {
    if (!ui.signedIn()) return;
    root.querySelectorAll('canvas[data-pal]').forEach((cv) => {
      const uid = cv.dataset.pal; if (!uid || isBot(uid)) return;
      import('../pals/core.js').then((c) => c.getActivePal(db, uid)).then(async (pal) => {
        if (!pal || !cv.isConnected) return;
        const { drawPal } = await import('../pals/art.js');
        const c = cv.getContext('2d'); c.clearRect(0, 0, 96, 96); drawPal(c, 48, 106, 112, pal, { flat: true, mode: 'idle', t: 0 });
        cv.classList.add('on');
      }).catch(() => {});
    });
  }
  const teamName = (i) => (i === 0 ? 'White' : 'Black');
  function nameOf(p, me) {
    if (!p || !p.uid) return { n: 'Waiting…', s: 'seat open' };
    if (p.bot || isBot(p.uid)) return { n: p.lvl ? `CPU (${LV[p.lvl] || 'Medium'})` : esc(p.name || 'CPU'), s: p.lvl ? `${esc(p.name)} the bot-capy` : 'bot-capy' };
    return { n: me ? 'You' : esc(p.name || 'Player'), s: p.uname ? '@' + esc(p.uname) : (me ? 'guest' : '') };
  }
  // d = { team, me, person, on, over, frac, low, clock, caps:{list,adv}, status }
  function cardsView() {
    const sig = {};
    function html(d) {
      const t = d.team === 0 ? 'w' : 'b', nm = nameOf(d.person, d.me), set = curSet();
      return `<div class="cx-card t-${t}${d.me ? ' me' : ''}">
        <div class="cx-face"><svg class="cx-ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="cx-ring-bg" cx="40" cy="40" r="37"/><circle class="cx-ring-p" cx="40" cy="40" r="37" stroke-dasharray="${RING_C.toFixed(1)}"/></svg>${face(d.person)}</div>
        <div class="cx-info"><div class="cx-name"><b>${nm.n}</b>${nm.s ? `<small>${nm.s}</small>` : ''}</div>
          <div class="cx-teamrow"><span class="cx-chip t-${t}"><span class="cx-chipk">${pieceHtml(t === 'w' ? 'K' : 'k', set)}</span>${d.me ? 'You · ' : ''}${teamName(d.team)}</span><span class="cx-stat"></span></div>
          <div class="cx-caps"></div></div>
        <div class="cx-clock" aria-label="clock"></div></div>`;
    }
    function render(slot, d) {
      const host = $(slot === 'top' ? '#cx-top' : '#cx-bot'); if (!host) return;
      const key = [d.team, d.me, d.person && d.person.uid, d.person && d.person.name, d.person && d.person.lvl, curSet()].join('|');
      if (sig[slot] !== key) { sig[slot] = key; host.innerHTML = html(d); hydratePals(host); }
      const el = host.firstElementChild; if (!el) return;
      el.classList.toggle('on', !!d.on); el.classList.toggle('idle', !d.on && !d.over); el.classList.toggle('low', !!d.low);
      const ring = el.querySelector('.cx-ring-p'); const off = (RING_C * (1 - Math.max(0, Math.min(1, d.frac == null ? 1 : d.frac)))).toFixed(1);
      if (ring.getAttribute('stroke-dashoffset') !== off) ring.setAttribute('stroke-dashoffset', off);
      const ck = el.querySelector('.cx-clock'); const ct = d.clock || ''; if (ck.textContent !== ct) ck.textContent = ct; ck.hidden = !ct;
      const st = el.querySelector('.cx-stat'); const sv = d.status || ''; if (st.textContent !== sv) st.textContent = sv; st.className = 'cx-stat' + (/reconnect/.test(sv) ? ' warn' : '');
      const capKey = d.caps ? d.caps.list.join('') + d.caps.adv + curSet() : '';
      const cp = el.querySelector('.cx-caps');
      if (cp.dataset.k !== capKey) { cp.dataset.k = capKey; cp.innerHTML = d.caps ? d.caps.list.map((q) => `<span class="cx-cap">${pieceHtml(q)}</span>`).join('') + (d.caps.adv > 0 ? `<b class="cx-adv">+${d.caps.adv}</b>` : '') : ''; }
    }
    return { render, reset() { for (const k in sig) delete sig[k]; } };
  }

  // ---------------------------------------------------------------- VS intro + end screens
  function vsIntro(a, b, mySide, ms = 2300) {
    return new Promise((res) => {
      const pane = (p, i) => { const nm = nameOf(p, i === mySide); return `<div class="cx-vs-p t-${i ? 'b' : 'w'}"><div class="cx-vs-face">${face(p, true)}</div><b>${nm.n}</b><small>${nm.s || ''}</small><span class="cx-chip t-${i ? 'b' : 'w'}"><span class="cx-chipk">${pieceHtml(i ? 'k' : 'K')}</span>${i === mySide ? 'You · ' : ''}${teamName(i)}</span></div>`; };
      const el = document.createElement('div'); el.className = 'cx-vs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Match intro');
      el.innerHTML = `<div class="cx-vs-in">${pane(a, 0)}<div class="cx-vs-x">VS</div>${pane(b, 1)}</div><p class="cx-vs-tip">White moves first · tap to start</p>`;
      const show = () => { document.body.appendChild(el); hydratePals(el); ui.sfx.play('deal'); setTimeout(end, ms); };
      // let the app's "Welcome to Chess" loading screen fade out first
      let tries = 0; const wait = () => { if (done) return; if (document.getElementById('kemy-load') && tries++ < 12) setTimeout(wait, 150); else show(); };
      let done = false; const end = () => { if (done) return; done = true; el.classList.add('out'); setTimeout(() => el.remove(), 320); res(); };
      el.onclick = end; wait();
      S.unsubs.push(end);
    });
  }
  const confetti = () => { const cs = ['#ffd34d', '#ff7aa8', '#5fd3ff', '#8be38b', '#fff', '#b98cff']; let h = ''; for (let i = 0; i < 42; i++) h += `<i style="left:${(i * 37) % 100}%;background:${cs[i % cs.length]};animation-delay:${((i * 53) % 90) / 100}s;animation-duration:${1.8 + ((i * 29) % 12) / 10}s;--r:${(i * 47) % 360}deg"></i>`; return `<div class="cx-confetti" aria-hidden="true">${h}</div>`; };
  // kind: 'win' | 'lose' | 'draw' | 'watch'
  function endHtml({ kind, title, reason, mySide, winSide }) {
    const k = (i) => pieceHtml(i === 0 ? 'K' : 'k', curSet(), 'big');
    if (kind === 'win' || kind === 'watch') return `<div class="cx-end cx-win">${confetti()}<div class="cx-stage-end"><div class="cx-dance">${k(kind === 'win' ? mySide : winSide)}</div><div class="cx-glow"></div></div><h2>${esc(title)}</h2><p class="cx-why">${esc(reason)}</p></div>`;
    if (kind === 'draw') return `<div class="cx-end cx-draw"><div class="cx-stage-end two"><div class="cx-sway">${k(0)}</div><div class="cx-sway d2">${k(1)}</div></div><h2>${esc(title)}</h2><p class="cx-why">${esc(reason)}</p><p class="cx-cheer">Evenly matched! Go again?</p></div>`;
    return `<div class="cx-end cx-lose"><div class="cx-stage-end"><div class="cx-sleep">${pieceHtml(mySide === 0 ? 'P' : 'p', curSet(), 'big')}<span class="cx-z" aria-hidden="true"><i>z</i><i>z</i><i>z</i></span></div></div><h2>${esc(title)}</h2><p class="cx-why">${esc(reason)}</p><p class="cx-cheer">Every game makes you sharper. Rematch?</p></div>`;
  }

  // ---------------------------------------------------------------- style picker (pieces + table)
  function setTiles(sel) {
    return SETS.map((s) => `<button type="button" class="cx-set${s.id === sel ? ' on' : ''}" data-set="${s.id}" aria-pressed="${s.id === sel}"><span class="cx-set-art">${s.id === 'classic' ? pieceSvg('K') + pieceSvg('k') : `<img src="${sprite(s.id, 'K')}" alt="" loading="lazy"><img src="${sprite(s.id, 'k')}" alt="" loading="lazy">`}</span><b>${s.name}</b><small>${s.blurb}</small></button>`).join('');
  }
  const backTiles = (sel) => BACKS.map(([id, n]) => `<button type="button" class="cx-back b-${id}${id === sel ? ' on' : ''}" data-back="${id}" aria-pressed="${id === sel}"><span></span>${n}</button>`).join('');
  function wireStyle(root, onChange) {
    root.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => { wr(K.set, b.dataset.set); preload(b.dataset.set); root.querySelectorAll('[data-set]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); ui.sfx.play('woodMove'); onChange && onChange(); });
    root.querySelectorAll('[data-back]').forEach((b) => b.onclick = () => { wr(K.back, b.dataset.back); root.querySelectorAll('[data-back]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); ui.sfx.play('tap'); onChange && onChange(); });
  }
  function stylePicker(redraw) {
    openModal(`<div class="cx-style"><h2>Pieces &amp; table</h2><div class="cx-sets">${setTiles(curSet())}</div><h3>Table</h3><div class="cx-backs">${backTiles(curBack())}</div><div class="btns"><button class="btn" data-close>Done</button></div></div>`);
    const m = document.querySelector('.cx-style');
    wireStyle(m, () => { const g = $('.cx-game'); if (g) g.dataset.back = curBack(); if (BV && BV.set !== curSet()) { BV.setSet(curSet()); CARDS && CARDS.reset(); } redraw(); });
    m.querySelector('[data-close]').onclick = () => closeModal();
  }

  // ---------------------------------------------------------------- vs computer
  function local(params) {
    const lvl = normLevel(params.lvl || lastLevel()); saveLevel(lvl);
    const pal = palByLevel(lvl);
    shell('Chess', '#/games/chess');
    ui.wireEmotes(main, '', () => '');
    const human = params.side === 'b' ? 1 : params.side === 'w' ? 0 : Math.random() < 0.5 ? 0 : 1;
    const me = { uid: ui.myUid() || 'me', name: S.profile ? S.profile.displayName || 'You' : 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const cpu = { uid: 'cpu1', name: pal.name, bot: true, lvl };
    const ps = human === 0 ? [me, cpu] : [cpu, me];
    let ml = [], pos = C.parse(C.START), keys = [C.key(pos)], sans = [], sel = -1, last = '', over = null, alive = true, thinking = false, ready = false;
    S.unsubs.push(() => { alive = false; });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="ch-new">New game</button><button class="btn btn-sm btn-ghost" id="cx-style">🎨 Pieces</button><a class="btn btn-sm btn-ghost" href="#/games/chess">Leave</a>`;
    $('#ch-new').onclick = () => local({ ...params, side: params.side || '' });
    $('#cx-style').onclick = () => stylePicker(refresh);
    function cards() {
      const turn = pos.w ? 0 : 1, caps = capsOf(pos.b);
      [['top', 1 - human], ['bot', human]].forEach(([slot, i]) => CARDS.render(slot, { team: i, me: i === human, person: ps[i], on: !over && turn === i, over: !!over, frac: 1, caps: caps[i], status: !over && turn === i && i !== human ? 'thinking…' : '' }));
    }
    function refresh() {
      if (!alive || !$('#g-board')) return;
      const turn = pos.w ? 0 : 1, o = C.outcome(pos, keys);
      cards();
      if (over) setPill(over.winner === 'draw' ? `Draw · ${over.why}` : (over.winner === 'w') === (human === 0) ? `You win · ${over.why}` : `${pal.name} wins · ${over.why}`, 'done');
      else if (turn === human) setPill((o.check ? 'Check! ' : '') + 'Your turn', o.check ? 'mine chk' : 'mine');
      else setPill(`CPU (${LV[lvl]}) is thinking…`, 'theirs');
      paintBoard({ pos, mySide: human, live: ready && !over && turn === human, sel, last, onSelect: (s) => { sel = s; refresh(); }, onMove: (m) => doMove(m) });
      paintMoves(sans);
      if (ready && !over && turn !== human && !thinking) cpuTurn();
    }
    function doMove(m) {
      const before = pos.b.join('');
      sans.push(C.san(pos, m)); ml.push(C.moveStr(m)); last = `${m.f}-${m.t}`;
      pos = C.play(pos, m); keys.push(C.key(pos)); sel = -1;
      moveSfx(before, pos);
      const o = C.outcome(pos, keys);
      if (o.over) {
        over = o; refresh();
        const res = o.winner === 'draw' ? 'd' : (o.winner === 'w') === (human === 0) ? 'w' : 'l';
        ui.addCpuResult('chess', res);
        setTimeout(() => alive && ui.resultModal({ title: res === 'd' ? 'Draw' : res === 'w' ? 'You win!' : `${pal.name} wins`, sub: o.why, win: res === 'w', vsBot: true, cls: 'cx-result',
          html: endHtml({ kind: res === 'w' ? 'win' : res === 'd' ? 'draw' : 'lose', title: res === 'w' ? 'You win!' : res === 'd' ? "It's a draw!" : 'Nice try!', reason: res === 'w' ? `${o.why}! You beat CPU (${LV[lvl]}).` : res === 'd' ? o.why : `CPU (${LV[lvl]}) won by ${o.why.toLowerCase()}.`, mySide: human }),
          buttons: [{ label: 'Rematch', onClick: () => local({ ...params }) }, { label: 'New game', href: '#/games/chess' }, { label: 'Home', href: '#/games' }] }), 650);
        return;
      }
      refresh();
      if ((pos.w ? 0 : 1) === human) setTimeout(() => alive && ui.sfx.play('turn'), 320);
    }
    async function cpuTurn() {
      thinking = true;
      const t0 = Date.now();
      const s = await ask({ kind: 'chess', board: C.boardOf(pos), cx: C.cxOf(pos), level: lvl });
      const wait = 420 - (Date.now() - t0); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      thinking = false;
      if (!alive || over) return;
      const m = s && C.findMove(pos, s); if (m) doMove(m);
    }
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__cx = { pos: () => pos, human };  // local tests only
    refresh();
    vsIntro(ps[0], ps[1], human, params.fast ? 300 : 1700).then(() => { ready = true; refresh(); if (human === 0) ui.sfx.play('turn'); });
  }

  // ---------------------------------------------------------------- online
  async function online(g0) {
    const gid = g0.id;
    let g = g0, serverG = g0, ended = false, stopHb = null, claimT = 0, sel = -1, joinTried = false, iEnded = false, pendingNo = null, vsShown = false;
    shell('Chess', '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    ui.wireEmotes(main, gid, names);
    const side = () => g.players.indexOf(ui.myUid());
    const timed = () => Array.isArray(g.clk) && g.clk.length === 2;
    const tick = setInterval(() => header(), 500);
    let gone = false; // a late timer (e.g. the 25 s bot offer) must not paint into the next page
    S.unsubs.push(() => { gone = true; stopOffer(gid); clearInterval(tick); clearTimeout(claimT); if (stopHb) stopHb(); });
    const elapsed = () => Math.max(0, net.serverNow() - (tsMs(g.turnAt) || net.serverNow()));
    const clocks = () => { if (!timed()) return null; const c = [...g.clk]; if (g.status === 'active' && (g.moveNo || 0) > 0) c[g.turn] = Math.max(0, c[g.turn] - elapsed()); return c; };
    const person = (i) => (g.players[i] ? { uid: g.players[i], name: g.names[i], uname: g.unames && g.unames[i], color: g.colors && g.colors[i], bot: isBot(g.players[i]) } : null);
    function header() {
      if (!$('#g-board')) return;
      const me = side(), active = g.status === 'active', ck = clocks(), base = (+g.mode || 0) * 60000 || (timed() ? Math.max(...g.clk, 1) : 0);
      const left = active ? net.turnLeft(g.turnAt) : null, caps = capsOf(g.board || C.START);
      const bottom = me >= 0 ? me : 0;
      [['top', 1 - bottom], ['bot', bottom]].forEach(([slot, i]) => {
        const on = active && g.turn === i, p = person(i);
        let status = '';
        if (!p) status = g.status === 'waiting' ? 'waiting…' : '';
        else if (active && i !== me && !p.bot) { const hb = g.hb && g.hb[p.uid] ? tsMs(g.hb[p.uid]) : 0; if (hb && net.serverNow() - hb > 30000) status = 'reconnecting…'; }
        if (!status && on && i !== me) status = me >= 0 ? 'thinking…' : 'to move';
        CARDS.render(slot, { team: i, me: i === me, person: p, on, over: g.status === 'done', caps: caps[i], status,
          frac: ck ? ck[i] / base : on && left != null ? left / TURN_SECONDS : 1,
          low: ck ? on && ck[i] < 20000 : on && left != null && left <= 10,
          clock: ck ? fmt(ck[i]) : on && left != null ? left + 's' : '' });
      });
      if (g.status === 'waiting') setPill(me === 0 ? (g.invitee ? 'Waiting for your friend…' : g.quick ? 'Looking for an opponent…' : 'Share the room code below so a friend can join') : 'Waiting for players', 'wait');
      else if (g.status === 'done') setPill(g.endReason === 'cancelled' ? 'Game cancelled' : g.winnerUid === 'draw' ? 'Draw' : `${g.winnerUid === ui.myUid() ? 'You win' : names(g.winnerUid) + ' wins'}${g.endReason === 'forfeit' ? ' · resigned' : g.endReason === 'timeout' ? ' · time ran out' : ''}`, 'done');
      else {
        const p = C.parse(g.board, g.cx), chk = C.inCheck(p) ? 'Check! ' : '';
        if (me === g.turn) setPill(chk + 'Your turn', chk ? 'mine chk' : 'mine');
        else setPill(chk + (me >= 0 ? `${g.names[g.turn]}'s turn` : `${teamName(g.turn)} · ${g.names[g.turn]} to move`), 'theirs');
      }
    }
    function draw() {
      const p = C.parse(g.board, g.cx), me = side();
      const live = g.status === 'active' && me === g.turn;
      paintBoard({ pos: p, mySide: me < 0 ? 0 : me, live, sel, last: g.last, onSelect: (s) => { sel = s; draw(); }, onMove: (m) => move(m) });
      paintMoves(C.replay(g.ml).sans);
      header(); actions();
    }
    async function move(m) {
      if (pendingNo != null || g.status !== 'active' || side() !== g.turn) return;
      const base = g;
      const p = C.parse(g.board, g.cx), me = side();
      const r = C.replay(g.ml);
      const np = C.play(p, m), mstr = C.moveStr(m), keys = [...r.keys, C.key(np)];
      const o = C.outcome(np, keys);
      const expect = g.moveNo || 0;
      const upd = { board: C.boardOf(np), cx: C.cxOf(np), ml: (g.ml ? g.ml + ' ' : '') + mstr, last: mstr, turn: 1 - g.turn, moveNo: expect + 1, turnAt: net.fs.serverTimestamp() };
      if (timed()) { const c = [...g.clk]; if (expect > 0) c[me] = Math.max(0, Math.round(c[me] - elapsed())); upd.clk = c; } // clocks start after White's first move
      if (o.over) Object.assign(upd, o.winner === 'draw' ? { status: 'done', winnerUid: 'draw', endReason: 'draw' } : { status: 'done', winnerUid: ui.myUid(), endReason: 'win' });
      pendingNo = upd.moveNo;
      g = { ...g, ...upd, turnAt: { toMillis: () => Date.now() } };
      sel = -1; moveSfx(p.b, np); draw();
      try { await net.commitMove(gid, expect, upd); if (o.over) iEnded = true; }
      catch (e) { pendingNo = null; iEnded = false; g = serverG.moveNo >= base.moveNo ? serverG : base; draw(); toast(e && e.code === 'stale' ? 'That move already happened.' : friendlyError(e)); }
    }
    function actions() {
      const box = $('#g-actions'); if (!box || gone) return;
      const me = side(), sty = '<button class="btn btn-sm btn-ghost" id="cx-style">🎨 Pieces</button>';
      if (g.status === 'waiting') {
        const offer = me === 0 && !g.invitee && g.players.length < 2 && whenOffer(gid, () => actions());
        box.innerHTML = `${me === 0 && !g.quick && !g.invitee ? codeBoxHtml(gid) : ''}${me === 0 ? '<button class="btn btn-sm btn-ghost" id="g-share">Copy invite link</button><button class="btn btn-sm btn-ghost" id="g-cancel">Cancel</button>' : ''}${!ui.signedIn() ? `<a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to play</a>` : ''}${offer ? offerHtml() : ''}${sty}`;
      }
      else if (g.status === 'active') box.innerHTML = (me >= 0 ? '<button class="btn btn-sm btn-danger" id="g-forfeit">Resign</button><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>' : '<span class="muted small">You’re watching</span><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>') + sty;
      else box.innerHTML = `${me >= 0 && g.endReason !== 'cancelled' ? (g.rematch ? `<a class="btn btn-sm" href="#/game/${esc(g.rematch)}">Go to rematch</a>` : '<button class="btn btn-sm" id="g-rematch">Rematch</button>') : ''}<a class="btn btn-sm btn-ghost" href="#/games/chess">New game</a><a class="btn btn-sm btn-ghost" href="#/games">Games</a>${sty}`;
      const sh = $('#g-share'); if (sh) sh.onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const cn = $('#g-cancel'); if (cn) cn.onclick = async () => { try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('chess', g.mode, gid); location.hash = '#/games/chess'; } catch (e) { toast(friendlyError(e)); } };
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = async () => { stopOffer(gid); try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('chess', g.mode, gid); } catch { /* already gone */ } location.hash = `#/games/chess/cpu?lvl=${lastLevel()}&mode=${g.mode || ''}`; };
      const ff = $('#g-forfeit'); if (ff) ff.onclick = () => { if (confirm('Resign this game? It counts as a loss.')) net.update(gid, { status: 'done', winnerUid: g.players[1 - side()], endReason: 'forfeit' }).catch((e) => toast(friendlyError(e))); };
      const rm = $('#g-rematch'); if (rm) rm.onclick = async () => {
        rm.disabled = true;
        try { const other = g.players[1 - me]; const nid = await net.createGame('chess', g.mode, { invitee: other, from: gid }); await net.update(gid, { rematch: nid }); net.invite(other, nid, 'Chess rematch').catch(() => {}); location.hash = '#/game/' + nid; }
        catch (e) { toast(friendlyError(e)); rm.disabled = false; }
      };
      const st = $('#cx-style'); if (st) st.onclick = () => stylePicker(draw);
    }
    function onEnd() {
      if (ended) return; ended = true;
      if (stopHb) { stopHb(); stopHb = null; }
      if (g.endReason === 'cancelled') return;
      const me = side();
      const botGame = onlyBots(g.players, ui.myUid());
      if (me >= 0 && !botGame) setTimeout(() => net.recordResult(g, iEnded || g.endReason !== 'win'), iEnded ? 0 : 2500);
      if (me >= 0 && botGame) ui.addCpuResult('chess', g.winnerUid === ui.myUid() ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l');
      const win = me >= 0 && g.winnerUid === ui.myUid(), draw = g.winnerUid === 'draw';
      const p = C.parse(g.board, g.cx), o = C.outcome(p, C.replay(g.ml).keys);
      const winSide = g.players.indexOf(g.winnerUid), opp = me >= 0 ? g.names[1 - me] : '';
      const why = g.endReason === 'forfeit' ? (win ? `${opp} resigned.` : me >= 0 ? 'You resigned.' : `${g.names[1 - winSide] || 'A player'} resigned.`)
        : g.endReason === 'timeout' ? (win ? `${opp} ran out of time.` : me >= 0 ? 'Your time ran out.' : 'Time ran out.')
        : o.over ? (draw ? o.why + '.' : win ? `${o.why}! You beat ${opp}.` : me >= 0 ? `${names(g.winnerUid)} won by ${o.why.toLowerCase()}.` : o.why + '.') : '';
      const title = draw ? 'Draw' : me < 0 ? `${names(g.winnerUid)} wins` : win ? 'You win!' : 'You lost';
      const kind = draw ? 'draw' : me < 0 ? 'watch' : win ? 'win' : 'lose';
      setTimeout(() => {
        if (!$('#g-board')) return;
        ui.resultModal({ title, sub: why, win, vsBot: botGame, cls: 'cx-result',
          html: endHtml({ kind, title: draw ? "It's a draw!" : kind === 'lose' ? 'Nice try!' : title, reason: why, mySide: me < 0 ? 0 : me, winSide: winSide < 0 ? 0 : winSide }),
          buttons: me >= 0 ? [{ label: 'Rematch', onClick: () => $('#g-rematch')?.click() }, { label: 'New game', href: '#/games/chess' }, { label: 'Home', href: '#/games' }] : [{ label: 'New game', href: '#/games/chess' }, { label: 'Home', href: '#/games' }] });
      }, 600);
    }
    function scheduleClaim() {
      clearTimeout(claimT);
      const me = side();
      if (g.status !== 'active' || me < 0 || g.turn === me) return;
      const other = g.players[1 - me];
      const tTurn = timed() ? g.clk[g.turn] + 4000 - elapsed() : (TURN_SECONDS + 6) * 1000 - elapsed();
      const hb = g.hb && g.hb[other] ? tsMs(g.hb[other]) : 0;
      const tHb = hb ? hb + 48000 - Date.now() : Infinity;
      claimT = setTimeout(() => net.update(gid, { status: 'done', winnerUid: ui.myUid(), endReason: 'timeout' }).catch(() => { claimT = setTimeout(scheduleClaim, 4000); }), Math.max(1500, Math.min(tTurn, tHb)));
    }
    function maybeVs() {
      if (vsShown || g.status !== 'active' || (g.moveNo || 0) > 0 || g.players.length < 2) return;
      vsShown = true;
      const k = 'cx-vs-' + gid; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* ok */ }
      const me = side();
      vsIntro(person(0), person(1), me).then(() => { if (side() === 0 && g.status === 'active' && !(g.moveNo > 0)) ui.sfx.play('turn'); });
    }
    const followRm = ui.rematchFollower(gid);
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This game was removed. <a href="#/games">Games</a></div>'; return; }
      serverG = ng;
      const prevMove = g.moveNo, prevBoard = g.board;
      const rec = net.reconcile(ng.moveNo, pendingNo);
      pendingNo = rec.pending;
      if (!rec.take) { scheduleClaim(); return; }
      g = ng;
      if (g.moveNo !== prevMove && prevBoard && g.board) { moveSfx(prevBoard, C.parse(g.board, g.cx)); if (g.turn === side() && g.status === 'active') setTimeout(() => ui.sfx.play('turn'), 320); }
      if (g.status === 'active' && side() >= 0 && !stopHb) stopHb = net.heartbeat(gid);
      if (g.status === 'active' && g.moveNo === 0 && g.quick) net.leaveQueue('chess', g.mode, gid);
      if (g.status === 'waiting' && ui.signedIn() && side() < 0 && !joinTried && (!g.invitee || g.invitee === ui.myUid())) { joinTried = true; net.join(gid).catch((e) => toast(friendlyError(e))); }
      draw(); scheduleClaim(); maybeVs();
      if (g.status === 'done') onEnd();
      followRm(g, side() >= 0);
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }

  // ---------------------------------------------------------------- lobby
  function lobby() {
    ensureCss(); preload(curSet());
    let lvl = normLevel(lastLevel()), mode = rd(K.mode, ''), sideP = rd(K.side, '');
    if (!MODES.some((m) => m[0] === mode)) mode = '';
    if (!['', 'w', 'b'].includes(sideP)) sideP = '';
    const seg = (name, list, cur) => `<div class="cxl-seg" role="group" aria-label="${name}">${list.map(([id, t]) => `<button type="button" data-${name}="${id}" class="${id === cur ? 'on' : ''}" aria-pressed="${id === cur}">${t}</button>`).join('')}</div>`;
    const hero = () => { const s = curSet(); return `${pieceHtml('n', s, 'h1')}${pieceHtml('K', s, 'h2')}${pieceHtml('q', s, 'h3')}${pieceHtml('B', s, 'h4')}`; };
    ui.shell('Chess', `<div class="cxl cx-game" id="cxl" data-back="${curBack()}" style="opacity:0">
      <div class="cxl-hero"><div class="cxl-hero-art" id="cxl-hero" aria-hidden="true">${hero()}</div><div class="cxl-title"><b>Capy Chess</b><small>Cozy pieces, real chess. Checkmate the King to win!</small></div></div>
      <div class="cxl-grid">
        <button type="button" class="cxl-card c-cpu" data-go="cpu"><span class="cxl-ic">${capyFace(true)}</span><b>vs CPU</b><small>Practice with a bot-capy</small></button>
        <button type="button" class="cxl-card c-friend" data-go="friend"><span class="cxl-ic">🔑</span><b>Play a Friend</b><small>Make a room code</small></button>
        <button type="button" class="cxl-card c-join" data-go="join" aria-expanded="false"><span class="cxl-ic">🎟️</span><b>Join with code</b><small>Type your friend's code</small></button>
        <button type="button" class="cxl-card c-quick" data-go="quick"><span class="cxl-ic">⚡</span><b>Quick match</b><small>Play someone online</small></button>
      </div>
      <div class="cxl-join" id="cxl-join" hidden>${codeFormHtml('cxl-code', '🎟️ Room code')}</div>
      <section class="cxl-opts">
        <div class="cxl-row"><span>CPU level</span>${seg('lvl', LEVELS, lvl)}</div>
        <div class="cxl-row"><span>Play as</span>${seg('side', [['', 'Random'], ['w', 'White'], ['b', 'Black']], sideP)}</div>
        <div class="cxl-row"><span>Online clock</span>${seg('mode', MODES, mode)}</div>
      </section>
      <section class="cxl-box"><h3>Pieces</h3><div class="cx-sets">${setTiles(curSet())}</div></section>
      <section class="cxl-box"><h3>Table</h3><div class="cx-backs">${backTiles(curBack())}</div></section>
      <p class="cxl-foot"><a href="#/games/chess?classic=1">Invite by @handle · scoreboard · more ways to play</a></p></div>`, '#/games');
    const box = $('#cxl');
    const wireSeg = (name, fn) => box.querySelectorAll(`[data-${name}]`).forEach((b) => b.onclick = () => { fn(b.dataset[name]); box.querySelectorAll(`[data-${name}]`).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); ui.sfx.play('tap'); });
    wireSeg('lvl', (v) => { lvl = v; saveLevel(v); });
    wireSeg('side', (v) => { sideP = v; wr(K.side, v); });
    wireSeg('mode', (v) => { mode = v; wr(K.mode, v); });
    wireStyle(box, () => { box.dataset.back = curBack(); $('#cxl-hero').innerHTML = hero(); });
    const go = async (b, f) => { if (!ui.signedIn()) { ctx.requireAuth(); return; } b.disabled = true; try { location.hash = '#/game/' + await f(); } catch (e) { toast(friendlyError(e)); b.disabled = false; } };
    const join = $('#cxl-join');
    box.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => {
      ui.sfx.play('woodMove');
      const w = b.dataset.go;
      if (w === 'cpu') location.hash = `#/games/chess/cpu?lvl=${lvl}&side=${sideP}`;
      else if (w === 'friend') go(b, () => net.createGame('chess', mode));
      else if (w === 'quick') go(b, () => net.quickMatch('chess', mode));
      else { join.hidden = !join.hidden; b.setAttribute('aria-expanded', String(!join.hidden)); if (!join.hidden) join.querySelector('input')?.focus(); }
    });
    wireCodeForms(join, { db, getDoc: (r) => net.fs.getDoc(r), doc: (...a) => net.fs.doc(...a), uid: () => (S.user ? S.user.uid : ''), toast, needAuth: () => { if (ui.signedIn()) return true; ctx.requireAuth(); return false; } });
  }
  return { local, online, lobby };
}
