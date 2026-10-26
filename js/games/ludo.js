// Ludo UI: SVG board, die, tokens. Local play vs computer players; online rooms (2-4 seats,
// computer fill-ins) with commit-reveal dice: every human commits to the end of a SHA-256 hash
// chain before the game starts and reveals one link per roll; the die comes from hashing all
// reveals together with the roll number, so no single player (or the host) can pick a roll.
// Firestore rules check every reveal against the previous link and the die against the reveals.
import * as L from './ludo-engine.js';
import { isBot, tsMs, TURN_SECONDS } from './net.js';
import { ask, normLevel, saveLevel, botPlayer, faceSvg, seatName, fillToggleHtml, wireFill, fillBots, whenOffer, offerHtml, stopOffer, onlyBots, lastLevel } from './bots.js';
import * as T from './ludo-turn.js';
import { codeFormHtml, wireCodeForms } from './code-join.js';

const CELL = 20;
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
const star = (x, y, r, cls) => { let pts = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; pts += `${(x + q * Math.cos(a)).toFixed(1)},${(y + q * Math.sin(a)).toFixed(1)} `; } return `<polygon points="${pts}" class="${cls}"/>`; };
const LIGHT = ['#8ff0a9', '#ffe58a', '#9cc9ff', '#ff9d9d'];
// All Pal Ludo art is original SVG/CSS made for Kemy: a bright 4-colour board, Pal-eared tokens, a CSS cube die.
let boardBg = '';
function background() {
  if (boardBg) return boardBg;
  let h = `<defs>${L.COLORS.map((c, i) => `<radialGradient id="lug${i}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff"/><stop offset=".28" stop-color="${LIGHT[i]}"/><stop offset=".7" stop-color="${c}"/><stop offset="1" stop-color="${L.DARK[i]}"/></radialGradient>`).join('')}</defs>`;
  h += `<rect width="300" height="300" rx="12" class="lu-bg"/>`;
  const yardAt = [[0, 0], [0, 9], [9, 9], [9, 0]];
  yardAt.forEach(([r, c], col) => {
    h += `<rect x="${c * CELL + 1}" y="${r * CELL + 1}" width="${6 * CELL - 2}" height="${6 * CELL - 2}" rx="10" fill="${L.COLORS[col]}" class="lu-yard" data-col="${col}"/>`;
    h += `<rect x="${c * CELL + 16}" y="${r * CELL + 16}" width="${6 * CELL - 32}" height="${6 * CELL - 32}" rx="14" class="lu-yard-in"/>`;
    L.YARD[col].forEach(([yr, yc]) => { h += `<circle cx="${yc * CELL + 10}" cy="${yr * CELL + 10}" r="9" fill="${LIGHT[col]}" class="lu-spot" stroke="${L.DARK[col]}"/>`; });
  });
  L.TRACK.forEach(([r, c], i) => {
    const startCol = L.START.indexOf(i);
    h += `<rect x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}" class="lu-cell" ${startCol >= 0 ? `fill="${L.COLORS[startCol]}"` : ''}/>`;
    if (L.SAFE.has(i)) h += star(c * CELL + 10, r * CELL + 10, 7, startCol >= 0 ? 'lu-safe on' : 'lu-safe');
  });
  L.HOME_COL.forEach((cells, col) => cells.forEach(([r, c]) => { h += `<rect x="${c * CELL}" y="${r * CELL}" width="${CELL}" height="${CELL}" fill="${L.COLORS[col]}" class="lu-hc"/>`; }));
  const C0 = 6 * CELL, C1 = 9 * CELL, M = 7.5 * CELL;
  [[C0, C0, C0, C1, 0], [C0, C0, C1, C0, 1], [C1, C0, C1, C1, 2], [C0, C1, C1, C1, 3]].forEach(([x1, y1, x2, y2, col]) => { h += `<polygon points="${x1},${y1} ${x2},${y2} ${M},${M}" fill="${L.COLORS[col]}" class="lu-tri"/>`; });
  h += `<circle cx="${M}" cy="${M}" r="12" class="lu-hub"/>` + star(M, M, 9, 'lu-center');
  return (boardBg = h);
}
// a shiny round token with little Pal ears and a face
const token = (col) => `<ellipse cx="0" cy="7.5" rx="7.5" ry="2.6" class="lu-tsh"/><path d="M-6.4-3.6-5.6-9.6-1.8-6.4ZM6.4-3.6 5.6-9.6 1.8-6.4Z" fill="${L.DARK[col]}"/><circle r="8" fill="url(#lug${col})" class="lu-tk"/><circle cx="-2.6" cy="-0.6" r="1.15" class="lu-eye"/><circle cx="2.6" cy="-0.6" r="1.15" class="lu-eye"/><path d="M-2.2 2.2Q0 4 2.2 2.2" class="lu-smile"/>`;
function boardSvg(st, movable, mine, rot, pos, mover) {
  let h = `<svg viewBox="0 0 300 300" class="lu-svg" role="img" aria-label="Ludo board"><g transform="rotate(${rot} 150 150)">${background()}`;
  const stack = {};
  const toks = [];
  pos.forEach((tk, p) => tk.forEach((r, t) => {
    const [cr, cc] = L.cellOf(st.cols[p], r, t);
    const key = `${cr},${cc}`; const n = (stack[key] = (stack[key] || 0) + 1) - 1;
    const off = r < 0 || n === 0 ? [0, 0] : [[0, 0], [4, -4], [-4, 4], [4, 4]][n % 4];
    const hop = mover && mover[0] === p && mover[1] === t;
    toks.push({ p, t, x: cc * CELL + 10 + off[0], y: cr * CELL + 10 + off[1], can: mine && p === st.turn && movable.includes(t), last: !mover && st.last && st.last.p === p && st.last.t === t, hop, z: hop ? 2 : 0 });
  }));
  toks.sort((a, b) => (a.can + a.z) - (b.can + b.z));
  for (const k of toks) {
    const col = st.cols[k.p];
    h += `<g transform="translate(${k.x} ${k.y}) rotate(${-rot})"><g class="lu-tok ${k.can ? 'can' : ''} ${k.last ? 'last' : ''} ${k.hop ? 'hop' : ''}" ${k.can ? `data-t="${k.t}" role="button" tabindex="0" aria-label="Move ${L.COLOR_NAMES[col]} token ${k.t + 1}"` : ''}>
      ${k.can ? '<circle r="11.5" class="lu-ring"/>' : ''}${token(col)}</g></g>`;
  }
  return h + '</g></svg>';
}
// CSS 3D cube die: each face is a pip grid; the cube turns to show the rolled face
const FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
const faceHtml = (n) => `<i class="lu-f lu-f${n}">${PIPS[n].map(([x, y]) => `<b style="left:${18 + x * 32}%;top:${18 + y * 32}%"></b>`).join('')}</i>`;
const cubeHtml = () => `<span class="lu-toss"><span class="lu-cube">${[1, 2, 3, 4, 5, 6].map(faceHtml).join('')}</span></span>`;
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
export const ROLL_MS = 1000;
// clockwise quarter turns that put seat `col` at the bottom-left corner of the screen
const rotFor = (col) => ((3 - col + 4) % 4) * 90;
const RING_C = 2 * Math.PI * 37;
const PAL_LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['expert', 'Expert']];
// ---------------------------------------------------------------- small original art (mode cards + hero)
export function miniBoard(x, y, w) {
  const c = w / 15, q = (n) => (n * c).toFixed(1);
  let h = `<g transform="translate(${x} ${y})"><rect width="${w}" height="${w}" rx="${q(1)}" fill="#fff" stroke="#ffd34d" stroke-width="${q(0.6)}"/>`;
  [[0, 0], [9, 0], [9, 9], [0, 9]].forEach(([cx, cy], i) => { h += `<rect x="${q(cx + 0.3)}" y="${q(cy + 0.3)}" width="${q(5.4)}" height="${q(5.4)}" rx="${q(0.8)}" fill="${L.COLORS[i]}"/><rect x="${q(cx + 1.6)}" y="${q(cy + 1.6)}" width="${q(2.8)}" height="${q(2.8)}" rx="${q(0.6)}" fill="#fff"/>`; });
  h += `<rect x="${q(1)}" y="${q(7)}" width="${q(5)}" height="${q(1)}" fill="${L.COLORS[0]}"/><rect x="${q(7)}" y="${q(1)}" width="${q(1)}" height="${q(5)}" fill="${L.COLORS[1]}"/><rect x="${q(9)}" y="${q(7)}" width="${q(5)}" height="${q(1)}" fill="${L.COLORS[2]}"/><rect x="${q(7)}" y="${q(9)}" width="${q(1)}" height="${q(5)}" fill="${L.COLORS[3]}"/>`;
  const m = q(7.5), a = q(6), b = q(9);
  [[a, a, a, b, 0], [a, a, b, a, 1], [b, a, b, b, 2], [a, b, b, b, 3]].forEach(([x1, y1, x2, y2, i]) => { h += `<polygon points="${x1},${y1} ${x2},${y2} ${m},${m}" fill="${L.COLORS[i]}"/>`; });
  return h + '</g>';
}
// a chunky 3D-looking die (top, front and side faces), original art
export function dieArt(x, y, s, n = 5, tilt = 0) {
  const p = PIPS[n].map(([px, py]) => `<circle cx="${(s * (0.22 + px * 0.28)).toFixed(1)}" cy="${(s * (0.22 + py * 0.28)).toFixed(1)}" r="${(s * 0.08).toFixed(1)}" fill="#2b1d55"/>`).join('');
  return `<g transform="translate(${x} ${y}) rotate(${tilt})"><path d="M0 ${s * 0.18}l${s * 0.18}-${s * 0.18}h${s}l-${s * 0.18} ${s * 0.18}z" fill="#ffe9a8"/><path d="M${s} ${s * 0.18}l${s * 0.18}-${s * 0.18}v${s}l-${s * 0.18} ${s * 0.18}z" fill="#d9b8ff"/><rect y="${s * 0.18}" width="${s}" height="${s}" rx="${s * 0.16}" fill="#fff" stroke="#c9a6ff" stroke-width="1.5"/><g transform="translate(0 ${s * 0.18})">${p}</g></g>`;
}
const tok = (x, y, i, r = 6) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="${L.COLORS[i]}" stroke="#fff" stroke-width="1.6"/><circle cx="${-r * 0.3}" cy="${-r * 0.1}" r="${r * 0.14}" fill="#2b1d55"/><circle cx="${r * 0.3}" cy="${-r * 0.1}" r="${r * 0.14}" fill="#2b1d55"/><circle cx="${-r * 0.35}" cy="${-r * 0.45}" r="${r * 0.2}" fill="#fff" opacity=".7"/></g>`;
export const heroArt = () => `<svg class="lu-hero-art" viewBox="0 0 130 120" aria-hidden="true">${miniBoard(6, 16, 84)}${tok(30, 40, 0)}${tok(66, 38, 1)}${tok(68, 76, 2)}${tok(28, 78, 3)}<g class="lu-hd1">${dieArt(84, 58, 28, 6, 12)}</g><g class="lu-hd2">${dieArt(96, 14, 22, 3, -14)}</g><g fill="#ffd34d"><path d="M118 92l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M10 8l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z"/></g></svg>`;
const cardArt = (big) => `<svg viewBox="0 0 100 74" aria-hidden="true">${miniBoard(8, 6, 58)}${dieArt(60, 34, big ? 26 : 22, 6, 10)}${dieArt(70, 6, 16, 4, -12)}</svg>`;

export function createLudo(ctx) {
  const { S, db, main, esc, $, toast, friendlyError, ui } = ctx;
  const { net } = ui;
  function shell(title, back) {
    ui.shell(esc(title), `<div class="lu lx" id="lu"><div class="lx-spark" aria-hidden="true">${'<i></i>'.repeat(9)}</div><div class="g-fx"></div><div id="lu-body"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
    const w = main.querySelector('.gm-wrap'); if (w) w.classList.add('lx-wrap');
    luCur.cube = null; luCur.anim = null; luCur.faceK = ''; luCur.palC = null;
  }
  // ---------------------------------------------------------------- view
  // v = { st, seats, mySeat, die, dieKey, spin, canRoll, movable, note, flagged, rot, auto, team }
  // Corners hold a round gold-ringed avatar with a countdown ring, a name and home count.
  // The single cube die sits in a box beside whoever is playing.
  const luCur = { v: null, on: null, anim: null, cube: null, rx: 0, ry: 0, faceK: '', palC: null, ring: null };
  const posOf = (v, seat) => (v.st.cols[seat] + v.rot / 90) % 4;
  function myPal(cv) {
    if (!ui.signedIn()) return;
    import('../pals/core.js').then((c) => c.getActivePal(db, ui.myUid())).then(async (pal) => {
      if (!pal || !cv.isConnected) return;
      const { drawPal } = await import('../pals/art.js');
      const c = cv.getContext('2d'); c.clearRect(0, 0, 96, 96); drawPal(c, 48, 90, 70, pal, { flat: true, mode: 'idle', t: 0 });
      cv.classList.add('on');
    }).catch(() => {});
  }
  function corners(v) {
    const top = $('#lx-top'), bot = $('#lx-bot');
    const at = [null, null, null, null];
    v.seats.forEach((p, i) => { at[posOf(v, i)] = i; });
    const sig = at.map((i) => (i == null ? '-' : i + ':' + v.seats[i].name + ':' + v.st.cols[i])).join('|') + '|' + v.mySeat + '|' + !!v.team;
    if (top.dataset.sig === sig) return at;
    top.dataset.sig = sig;
    const one = (pos) => {
      const i = at[pos]; const side = pos === 0 || pos === 3 ? 'l' : 'r';
      if (i == null) return `<div class="lx-c lx-empty" data-pos="${pos}"></div>`;
      const p = v.seats[i], col = v.st.cols[i], mine = i === v.mySeat;
      const mate = v.team && v.mySeat >= 0 && i === (v.mySeat + 2) % 4;
      return `<div class="lx-c lx-${side}${mine ? ' me' : ''}" data-pos="${pos}" data-seat="${i}" style="--lc:${L.COLORS[col]};--ld:${L.DARK[col]}">
        <div class="lx-main"><div class="lx-av"><svg viewBox="0 0 80 80" class="lx-ring" aria-hidden="true"><circle cx="40" cy="40" r="37" class="lx-ring-bg"/><circle cx="40" cy="40" r="37" class="lx-ring-p" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="${RING_C.toFixed(1)}"/></svg><span class="lx-face">${faceSvg(p.bot || isBot(p.uid) ? p.name : mine ? 'Mochi' : p.name, 56)}${mine ? '<canvas width="96" height="96" class="lx-pal"></canvas>' : ''}</span></div><div class="lx-dslot"></div></div>
        <div class="lx-name"><span>${esc(mine ? 'You' : p.name)}</span>${mate ? '<em>Partner</em>' : ''}${v.team && !mine && !mate ? '<em class="foe">Rival</em>' : ''}<i class="lx-home">0/4</i><i class="lx-flag" hidden title="A move didn’t check out">⚠</i></div>
        ${mine ? '<div class="lx-pills"><button type="button" class="lx-auto" id="lx-auto" aria-pressed="false"><span class="lx-box"></span>AUTO</button><button type="button" class="lx-pill" id="lx-emo" aria-expanded="false">😊 EMOJI</button></div>' : ''}</div>`;
    };
    top.innerHTML = one(0) + one(1);
    bot.innerHTML = one(3) + one(2);
    const cv = main.querySelector('.lx-pal'); if (cv) myPal(cv);
    const ab = $('#lx-auto'); if (ab) ab.onclick = () => { if (luCur.on && luCur.on.auto) luCur.on.auto(); };
    const eb = $('#lx-emo'); if (eb) eb.onclick = () => { const w = main.querySelector('.gm-wrap'); const on = !w.classList.contains('lx-emo-open'); w.classList.toggle('lx-emo-open', on); eb.setAttribute('aria-expanded', String(on)); };
    main.querySelectorAll('.g-emotes [data-e]').forEach((b) => b.addEventListener('click', () => { main.querySelector('.gm-wrap')?.classList.remove('lx-emo-open'); $('#lx-emo')?.setAttribute('aria-expanded', 'false'); }));
    return at;
  }
  function cube() {
    if (luCur.cube && luCur.cube.isConnected) return luCur.cube;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lu-die3'; b.id = 'lu-roll'; b.innerHTML = cubeHtml();
    b.onclick = () => { if (luCur.v && luCur.v.canRoll && luCur.on) luCur.on.roll(); };
    return (luCur.cube = b);
  }
  // tumble the cube to face n: about a second of spins, then it lands with a little bounce
  function tumble(n) {
    const b = cube(), c = b.querySelector('.lu-cube'), t = b.querySelector('.lu-toss');
    const [fx, fy] = FACE_ROT[n] || [0, 0], quick = reduced();
    luCur.rx = (Math.ceil(luCur.rx / 360) + (quick ? 0 : 2)) * 360 + fx;
    luCur.ry = (Math.ceil(luCur.ry / 360) + (quick ? 0 : 1 + (Math.random() * 2 | 0))) * 360 + fy;
    b.classList.remove('spin');
    c.style.transition = `transform ${quick ? 200 : ROLL_MS}ms cubic-bezier(.15,.65,.25,1)`;
    c.style.transform = `rotateX(${luCur.rx}deg) rotateY(${luCur.ry}deg)`;
    t.classList.remove('go'); void t.offsetWidth; if (!quick) t.classList.add('go');
    ui.sfx.play('tap'); setTimeout(() => ui.sfx.play('place'), quick ? 200 : ROLL_MS - 120);
  }
  function setFace(n) { // show a face without animating (joining mid-game)
    const c = cube().querySelector('.lu-cube'); const [fx, fy] = FACE_ROT[n] || [0, 0];
    luCur.rx = fx; luCur.ry = fy; c.style.transition = 'none'; c.style.transform = `rotateX(${fx}deg) rotateY(${fy}deg)`;
  }
  // the countdown ring on the active corner: frac 1 = full time left
  function ring(seat, frac, show) {
    main.querySelectorAll('.lx-c').forEach((el) => {
      const on = +el.dataset.seat === seat && el.dataset.seat != null;
      el.classList.toggle('on', on);
      const p = el.querySelector('.lx-ring-p'); if (!p) return;
      const f = on && show ? frac : on ? 1 : 0;
      p.setAttribute('stroke-dashoffset', (RING_C * (1 - f)).toFixed(1));
      el.classList.toggle('low', on && show && frac < 0.25);
      el.classList.toggle('bot', on && !show);
    });
  }
  function paint(v, on) {
    const box = $('#lu-body'); if (!box) return;
    luCur.v = v; luCur.on = on;
    const st = v.st, me = v.mySeat;
    if (!box.querySelector('#lu-board')) {
      box.innerHTML = `<div class="lx-row" id="lx-top"></div><div class="lu-board" id="lu-board"></div><div class="lx-row" id="lx-bot"></div><div class="lu-msg" aria-live="polite"><b id="lu-title"></b><span id="lu-note"></span></div>`;
    }
    corners(v);
    main.querySelectorAll('.lx-c[data-seat]').forEach((el) => {
      const i = +el.dataset.seat, pos = v.anim ? v.anim.pos : st.pos;
      const h = el.querySelector('.lx-home'), t = pos[i].filter((r) => r === L.HOME).length + '/4';
      if (h.textContent !== t) h.textContent = t;
      const f = el.querySelector('.lx-flag'); f.hidden = !(v.flagged && v.flagged[i]);
      el.classList.toggle('done', st.pos[i].every((r) => r === L.HOME));
    });
    const ab = $('#lx-auto');
    if (ab) { ab.classList.toggle('on', !!v.auto); ab.setAttribute('aria-pressed', String(!!v.auto)); }
    const board = $('#lu-board');
    const a = luCur.anim, pos = a ? a.pos : st.pos, mv = a ? [] : (v.movable || []);
    const bsig = st.winner + '|' + st.turn + '|' + pos.map((x) => x.join(',')).join(';') + '|' + mv.join(',') + '|' + (st.last ? st.last.p + ':' + st.last.t : '') + '|' + (me >= 0 && st.turn === me ? 1 : 0) + '|' + v.rot + '|' + (a ? 'a' : '');
    if (board.dataset.sig !== bsig) {
      board.dataset.sig = bsig;
      board.innerHTML = boardSvg(st, mv, me >= 0 && st.turn === me, v.rot, pos, a && a.mover);
      board.querySelectorAll('[data-t]').forEach((el) => {
        const f = () => { if (luCur.on) luCur.on.pick(+el.dataset.t); };
        el.addEventListener('click', f);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') f(); });
      });
    }
    // the die lives in the active player's box
    const d = cube(), slot = main.querySelector(`.lx-c[data-seat="${st.turn}"] .lx-dslot`);
    if (slot && d.parentNode !== slot) slot.appendChild(d);
    const cls = 'lu-die3' + (v.spin ? ' spin' : '') + (v.canRoll ? ' can' : '');
    if (d.className !== cls) d.className = cls;
    if (d.disabled !== !v.canRoll) d.disabled = !v.canRoll;
    d.setAttribute('aria-label', v.canRoll ? 'Roll the die' : v.die ? `Die shows ${v.die}` : 'Die');
    if (v.dieKey && v.die && luCur.faceK !== v.dieKey) { const first = !luCur.faceK; luCur.faceK = v.dieKey; if (first && v.noToss) setFace(v.die); else tumble(v.die); }
    const turnName = st.turn === me ? 'Your' : `${v.seats[st.turn].name}’s`;
    const winName = st.winner >= 0 ? (st.winTeam != null ? (st.winTeam === me % 2 ? 'Your team wins!' : `${v.seats[st.winner].name}’s team wins!`) : st.winner === me ? 'You win!' : `${v.seats[st.winner].name} wins!`) : '';
    const title = winName || (me === st.turn ? (v.canRoll ? 'Your roll: tap the die' : v.movable && v.movable.length && !a ? 'Tap a glowing token' : 'Your turn') : `${turnName} turn`);
    const note = v.note || st.msg || '';
    const titleEl = $('#lu-title'), noteEl = $('#lu-note');
    if (titleEl && titleEl.textContent !== title) titleEl.textContent = title;
    if (noteEl && noteEl.textContent !== note) noteEl.textContent = note;
  }
  const repaint = () => { if (luCur.v) paint(luCur.v, luCur.on); };
  // step-by-step token walk (about 0.2 s a square), then the real state lands
  let hopT = 0;
  function hop(prev, next, done) {
    clearTimeout(hopT); const m = next.last;
    if (!prev || !m || m.t < 0 || m.to === m.from) { luCur.anim = null; done(); return; }
    const path = m.from < 0 ? [0] : Array.from({ length: m.to - m.from }, (_, i) => m.from + 1 + i);
    const ms = reduced() ? 50 : 200; let i = 0;
    const go = () => {
      if (i >= path.length) { luCur.anim = null; done(); return; }
      const pos = prev.pos.map((x) => [...x]); pos[m.p][m.t] = path[i++];
      luCur.anim = { pos, mover: [m.p, m.t] }; repaint(); if (i < path.length) ui.sfx.play('tick');
      hopT = setTimeout(go, ms);
    };
    go();
  }
  // AUTO explainer: purple box, gold border, orange close button
  function autoPopup() {
    if (document.querySelector('.lx-pop')) return;
    const el = document.createElement('div'); el.className = 'lx-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'AUTO');
    el.innerHTML = `<div class="lx-pop-in"><button type="button" class="lx-x" aria-label="Close">✕</button><b>AUTO is on</b><p>${T.AUTO_INFO}</p><p class="lx-note"><b>Note:</b> ${T.AUTO_NOTE}</p></div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.querySelector('.lx-x').onclick = close; el.onclick = (e) => { if (e.target === el) close(); };
    S.unsubs.push(close);
  }
  const sound = (prev, st) => { if (!st.last) return; ui.sfx.play(st.last.cap ? 'capture' : st.last.to === L.HOME ? 'star' : 'place'); };

  // ------------------------------------------------------------ vs computer
  // mode 2 = 1 on 1, 4 = four players, team=1 = 2v2 (you + the Pal across the board vs the other two)
  // You always sit bottom-left (red). Bots pause, roll a real tumbling die, then walk their token.
  function local(params) {
    const lvl = normLevel(params.lvl);
    const n = +params.mode === 2 ? 2 : +params.mode === 3 ? 3 : 4;
    const team = n === 4 && params.team === '1';
    shell(team ? 'Pal Ludo · Team' : n === 2 ? 'Pal Ludo · 1 on 1' : 'Pal Ludo · 4 Player', '#/games/ludo');
    ui.wireEmotes(main, '', () => '');
    const me = { uid: ui.myUid(), name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const seats = [me, ...Array.from({ length: n - 1 }, (_, i) => botPlayer(i, lvl))];
    const cols = n === 2 ? [3, 1] : n === 3 ? [3, 0, 1] : [3, 0, 1, 2];
    let st = L.newGame(n, cols, team), die = 0, dieKey = '', movable = [], phase = 'roll', alive = true, autoT = 0, rewardTurns = new Set();
    const clock = T.makeClock(), auto = T.makeAuto();
    const ticker = setInterval(() => { if (alive) tickTurn(); }, 200);
    S.unsubs.push(() => { alive = false; clearInterval(ticker); clearTimeout(autoT); clearTimeout(hopT); });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="lu-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/ludo">Leave</a>`;
    $('#lu-new').onclick = () => local(params);
    const later = (f, ms) => setTimeout(() => { if (alive) f(); }, ms);
    const mine = () => st.winner < 0 && st.turn === 0;
    function refresh() {
      paint({ st, seats, mySeat: 0, die, dieKey, rot: 0, team, auto: auto.on, canRoll: mine() && phase === 'roll' && !auto.on, movable: phase === 'pick' && !auto.on ? movable : [], note: auto.on ? 'AUTO is playing your turns · ' + T.AUTO_NOTE : '' }, { roll: () => roll(false), pick, auto: toggleAuto });
      tickTurn();
    }
    function toggleAuto() { auto.set(!auto.on); if (auto.on) { autoPopup(); planAuto(); } else clearTimeout(autoT); refresh(); }
    function useAuto() { if (!rewardTurns.has(st.k)) { rewardTurns.add(st.k); auto.played(); } }
    // AUTO keeps a normal pace: wait, roll with the full tumble, wait, then move
    function planAuto() {
      if (!auto.on || !mine()) return; clearTimeout(autoT);
      if (phase === 'roll') autoT = later(() => { if (auto.on && mine() && phase === 'roll') { useAuto(); roll(true); } }, T.AUTO_DELAY);
      else if (phase === 'pick' && movable.length) autoT = later(() => { if (auto.on && mine() && phase === 'pick') { useAuto(); apply(T.autoMove(st, die)); } }, T.AUTO_DELAY);
    }
    function tickTurn() {
      if (st.winner >= 0 || phase === 'rolling' || phase === 'anim') { ring(st.turn, 1, false); return; }
      if (!mine()) { clock.clear(); ring(st.turn, 1, false); return; }
      if (auto.on) { ring(0, 1, false); return; }
      if (phase === 'pick' && movable.length < 2) { ring(0, 1, false); return; }
      clock.arm(st.k + phase, phase === 'roll' ? T.ROLL_S : T.MOVE_S);
      ring(0, clock.frac(), true);
      if (clock.tick()) ui.sfx.play('tick');
      if (clock.expired()) { // missed turn: play it and switch AUTO on
        auto.miss(); useAuto(); autoPopup();
        if (phase === 'roll') roll(true); else apply(T.autoMove(st, die));
        refresh();
      }
    }
    function roll(byAuto) {
      if (phase !== 'roll') return;
      if (!byAuto && auto.on) return;
      phase = 'rolling'; die = L.rollFromRandom(); dieKey = 'k' + st.k; refresh();
      later(afterRoll, ROLL_MS + 120);
    }
    function afterRoll() {
      movable = L.legal(st, die); phase = 'pick'; refresh();
      if (!movable.length) later(() => apply(-1), 1000);
      else if (st.turn !== 0) later(() => ask({ kind: 'ludo', st, die, level: lvl }).then((t) => { if (alive && phase === 'pick') apply(t); }), 500);
      else if (auto.on) planAuto();
      else if (movable.length === 1) later(() => { if (phase === 'pick' && !auto.on) apply(movable[0]); }, 800);
    }
    function pick(t) { if (phase === 'pick' && st.turn === 0 && !auto.on && movable.includes(t)) apply(t); }
    function apply(t) {
      if (phase !== 'pick') return;
      const prev = st; st = L.step(st, die, t); movable = []; phase = 'anim';
      hop(prev, st, () => { if (!alive) return; phase = 'roll'; sound(prev, st); landed(); });
    }
    function landed() {
      if (st.winner >= 0) {
        refresh(); const win = team ? st.winTeam === 0 : st.winner === 0; ui.addCpuResult('ludo', win ? 'w' : 'l');
        const paid = T.rewardsAllowed(auto);
        ui.resultModal({ title: win ? (team ? 'Your team wins!' : 'You win!') : team ? `${seats[st.winner].name}’s team wins` : `${seats[st.winner].name} wins`, sub: win && !paid ? 'Some turns were played on AUTO, so no XP or rewards this game.' : team ? 'Both partners got all their tokens home.' : 'All four tokens home.', win, vsBot: true, noReward: !paid, buttons: [{ label: 'Play again', onClick: () => local(params) }, { label: 'Pick a mode', href: '#/games/ludo' }] });
        return;
      }
      refresh();
      if (st.turn !== 0) later(() => { if (phase === 'roll' && st.turn !== 0) roll(true); }, 1200);
      else planAuto();
    }
    refresh();
  }

  // ------------------------------------------------------------ online
  const chainKey = (gid, uid) => `lks-ludo-${gid}-${uid}`;
  function loadChain(gid, uid) { try { return JSON.parse(localStorage.getItem(chainKey(gid, uid)) || 'null'); } catch { return null; } }
  function saveChain(gid, uid, c) {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith('lks-ludo-')); if (keys.length > 6) keys.slice(0, keys.length - 6).forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(chainKey(gid, uid), JSON.stringify(c));
    } catch { /* storage full */ }
  }
  const toLv = (s) => ({ p: L.encodePos(s.pos), n: s.n, turn: s.turn, die: s.die, six: s.six, k: s.k, winner: s.winner, last: s.last, msg: s.msg || '' });
  const fromLv = (lv) => ({ n: lv.n, cols: L.seatColors(lv.n), pos: L.decodePos(lv.p, lv.n), turn: lv.turn, die: lv.die, six: lv.six, k: lv.k, winner: lv.winner, last: lv.last || null, msg: lv.msg || '' });
  async function rollFor(g, k) {
    const cat = g.players.map((u) => (isBot(u) ? '' : (g.rv || {})[u] || '')).join('');
    return L.dieFromHex(await L.sha256hex(cat + String(k)));
  }

  async function online(g0) {
    const gid = g0.id;
    let hopping = false, g = g0, serverG = g0, ended = false, autoT = 0, autoK = '', shownAt = {}, usedK = new Set(), stopHb = null, chain = null, committing = false, sentK = -1, submittedK = -1, dieK = {}, flagged = {}, prevLv = null, botT = 0, joinTried = false, iEnded = false, pendingNo = null, dropTried = '';
    const me = () => ui.myUid();
    const isHost = () => g.host === me();
    const member = () => g.players.includes(me());
    const mySeat = () => g.players.indexOf(me());
    const seats = () => g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
    const humans = () => g.players.filter((u) => !isBot(u));
    const maxSeats = () => Math.max(2, Math.min(4, +g.mode || 4));
    shell('Pal Ludo · Online', '#/games/ludo');
    const clock = T.makeClock(), auto = T.makeAuto();
    ui.wireEmotes(main, gid, (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; });
    let tn = 0;
    const tick = setInterval(() => { if (g.status === 'active') { draw(); if (++tn % 5 === 0) afk(); } }, 200);
    S.unsubs.push(() => { clearInterval(tick); clearTimeout(botT); clearTimeout(autoT); clearTimeout(hopT); stopOffer(gid); if (stopHb) stopHb(); clearTimeout(lobby.t); });
    const roller = () => { const u = g.players[g.lv.turn]; return isBot(u) ? g.host : u; };
    const mover = roller;

    async function commit() {
      if (committing || !member() || g.status !== 'waiting' || (g.rv || {})[me()]) return;
      committing = true;
      try {
        chain = loadChain(gid, me());
        if (!chain) { chain = await L.makeChain(1200); saveChain(gid, me(), chain); }
        await net.update(gid, { [`rv.${me()}`]: chain[chain.length - 1], [`rk.${me()}`]: -1 });
      } catch (e) { toast(friendlyError(e)); }
      committing = false;
    }
    let noChainSaid = false;   // say it once per game, not on every roll
    function reveal(k) {
      if (sentK >= k) return;
      if (!chain) chain = loadChain(gid, me());
      if (!chain) { if (!noChainSaid) { noChainSaid = true; toast('This game was joined on another device, so your dice links aren’t here.'); } return; }
      sentK = k;
      net.update(gid, { [`rv.${me()}`]: chain[chain.length - 2 - k], [`rk.${me()}`]: k }).catch((e) => { sentK = k - 1; toast(friendlyError(e)); });
    }
    const allRevealed = (k) => humans().every((u) => (g.rk || {})[u] === k);
    // the die depends on who is seated (a player who leaves is replaced by a bot), so cache it per roll AND per seating
    const dk = (k) => k + '|' + g.players.join(',');
    async function submit(st, die, token) {
      const k = st.k; if (submittedK >= k || pendingNo != null) return; submittedK = k;
      let ns; try { ns = L.step(st, die, token); } catch { submittedK = k - 1; return; }
      const expect = g.moveNo || 0;
      const upd = { lv: toLv(ns), moveNo: expect + 1, turnAt: net.fs.serverTimestamp() };
      if (ns.winner >= 0) Object.assign(upd, { status: 'done', winnerUid: g.players[ns.winner], endReason: 'win' });
      pendingNo = upd.moveNo;
      const prev = g;
      g = { ...g, ...upd, turnAt: { toMillis: () => Date.now() } };
      prevLv = upd.lv; hopping = true;
      hop(st, ns, () => { hopping = false; sound(st, ns); draw(); });
      if (ns.winner >= 0) iEnded = true;
      try { await net.commitMove(gid, expect, upd); }
      catch (e) { pendingNo = null; iEnded = false; submittedK = k - 1; g = serverG.moveNo >= prev.moveNo ? serverG : prev; draw(); toast(e && e.code === 'stale' ? 'That move already happened.' : friendlyError(e)); }
    }
    // drive the roll / move cycle from the latest snapshot
    async function step() {
      if (g.status !== 'active' || !g.lv || !member()) return;
      const st = fromLv(g.lv), k = st.k, R = roller();
      const rk = g.rk || {};
      if (R === me() && isBot(g.players[st.turn]) && (rk[me()] ?? -1) < k) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) reveal(k); }, 1200); }
      if (R !== me() && rk[R] === k && (rk[me()] ?? -1) < k) reveal(k);
      if (!allRevealed(k)) return;
      const key = dk(k);
      if (dieK[key] == null) { const d = await rollFor(g, k); if (!g.lv || g.lv.k !== k || dk(k) !== key) return; dieK[key] = d; dieK[k] = d; ui.sfx.play('tap'); }
      const die = dieK[key];
      if (mover() !== me()) return;
      const moves = L.legal(st, die);
      if (isBot(g.players[st.turn])) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) ask({ kind: 'ludo', st, die, level: lastLevel() }).then((t) => { if (g.lv && g.lv.k === k) submit(st, die, t); }); }, ROLL_MS + 300); }
      else if (!moves.length) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) submit(st, die, -1); }, ROLL_MS + 1000); }
      else if (moves.length === 1 && !auto.on) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) submit(st, die, moves[0]); }, ROLL_MS + 800); }
    }
    function verify(prev, cur) {
      if (!prev || !cur || cur.k !== prev.k + 1) return;
      const d = dieK[prev.k];
      try {
        const exp = L.step(fromLv(prev), cur.die, cur.last ? cur.last.t : -1);
        if (L.encodePos(exp.pos) !== cur.p || exp.turn !== cur.turn || (d != null && d !== cur.die)) flagged[prev.turn] = true;
      } catch { flagged[prev.turn] = true; }
    }
    // a human who blocks the game for a full turn timer is replaced by a computer player
    function afk() {
      if (g.status !== 'active' || !g.lv || !member()) return;
      if (net.serverNow() - (tsMs(g.turnAt) || net.serverNow()) < (TURN_SECONDS + 5) * 1000) return;
      const k = g.lv.k, rk = g.rk || {}, turnU = g.players[g.lv.turn];
      const blockers = humans().filter((u) => u !== me() && ((rk[u] ?? -1) < k || (u === turnU && allRevealed(k))));
      const okMe = humans().filter((u) => !blockers.includes(u))[0] === me();
      if (!blockers.length || !okMe) return;
      // the roller reveals first and everyone else waits on them, so if the roller is stuck they are the one to replace
      const R = roller();
      drop(blockers.includes(R) && (rk[R] ?? -1) < k ? R : blockers[0]);
    }
    async function drop(uid) {
      const i = g.players.indexOf(uid); if (i < 0 || dropTried === uid + g.lv.k) return; dropTried = uid + g.lv.k;
      const rep = (a, v) => a.map((x, j) => (j === i ? v : x));
      try { await net.update(gid, { players: rep(g.players, 'cpu' + i), names: rep(g.names, seatName(i)), unames: rep(g.unames, ''), colors: rep(g.colors, ''), left: [...(g.left || []), uid], turnAt: net.fs.serverTimestamp() }); }
      catch (e) { console.warn('ludo drop', e.code || e.message); }
    }
    function lobby() {
      const box = $('#lu-body'); if (!box) return;
      const ps = seats(), ready = humans().every((u) => (g.rv || {})[u]);
      const offer = isHost() && !g.invitee && humans().length < 2 && whenOffer(gid, () => draw());
      const sig = ps.map((p) => p.uid + ':' + p.name + ':' + ((g.rv || {})[p.uid] ? 1 : 0)).join('|') + '|' + ready + '|' + offer + '|' + g.host + '|' + member() + '|' + maxSeats();
      if (box.dataset.lsig === sig) {
        clearTimeout(lobby.t);
        if (isHost() && g.quick && humans().length >= 2 && ready) lobby.t = setTimeout(() => start(), humans().length >= maxSeats() ? 1500 : 12000);
        return;
      }
      box.dataset.lsig = sig;
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" data-copy-code="${esc(gid)}">📋 Copy code</button><button class="btn btn-sm btn-ghost" id="lu-copy">Copy invite link</button></div>
        <p class="muted small">${maxSeats()} seats. Bots wear a Bot tag.</p>
        <h3>${ps.length} / ${maxSeats()} seats</h3><div class="g-seats">${ps.map((p, i) => `<div class="g-seat" style="--lc:${L.COLORS[L.seatColors(maxSeats())[i] ?? i]}">${ui.chip(p, p.uid === g.host ? 'host' : '')}${!isBot(p.uid) ? `<span class="muted small">${(g.rv || {})[p.uid] ? 'dice locked in' : 'locking dice…'}</span>` : ''}${isHost() && isBot(p.uid) ? `<button class="link-btn small" data-rm="${i}">remove</button>` : ''}</div>`).join('')}</div>
        ${isHost() ? `${fillToggleHtml()}<div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px"><button class="btn btn-sm btn-ghost" id="lu-bot" ${ps.length >= maxSeats() ? 'disabled' : ''}>+ Bot</button><button class="btn btn-sm" id="lu-start" ${ready ? '' : 'disabled'}>Start game</button></div>${offer ? offerHtml() : ''}`
          : member() ? '<p class="muted center">Waiting for the host to start…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="lu-join">Take a seat</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}
        <p class="muted small center">Fair dice: everyone locks in a secret before the game; each roll mixes everyone’s next secret, so nobody can choose a number.</p></div>`;
      $('#lu-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      wireFill(box);
      const bt = $('#lu-bot'); if (bt) bt.onclick = () => addBot();
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeSeat(+b.dataset.rm));
      const sb = $('#lu-start'); if (sb) sb.onclick = () => start(false);
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = () => start(true);
      const jn = $('#lu-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(lobby.t);
      if (isHost() && g.quick && humans().length >= 2 && ready) lobby.t = setTimeout(() => start(), humans().length >= maxSeats() ? 1500 : 12000);
    }
    async function addBot() {
      const used = new Set(g.players), i = g.players.length;
      if (i >= maxSeats() || used.has('cpu' + i)) return;
      try { await net.update(gid, { players: [...g.players, 'cpu' + i], names: [...g.names, seatName(i)], unames: [...g.unames, ''], colors: [...g.colors, ''] }); } catch (e) { toast(friendlyError(e)); }
    }
    async function removeSeat(i) {
      const f = (a) => a.filter((_, j) => j !== i);
      const ps = f(g.players).map((u, j) => (isBot(u) ? 'cpu' + j : u));
      try { await net.update(gid, { players: ps, names: f(g.names), unames: f(g.unames), colors: f(g.colors) }); } catch (e) { toast(friendlyError(e)); }
    }
    async function start(force) {
      if (!isHost() || g.status !== 'waiting') return;
      clearTimeout(lobby.t);
      const players = [...g.players], names = [...g.names], unames = [...g.unames], colors = [...g.colors];
      if (force || fillBots()) while (players.length < maxSeats()) { const i = players.length; players.push('cpu' + i); names.push(seatName(i)); unames.push(''); colors.push(''); }
      if (players.length < 2) { toast('Waiting for a real player. You can fill empty seats with bots.'); return; }
      const st = L.newGame(players.length);
      try { await net.update(gid, { players, names, unames, colors, status: 'active', lv: toLv(st), moveNo: 0, turnAt: net.fs.serverTimestamp() }); net.leaveQueue('ludo', g.mode, gid); }
      catch (e) { toast(friendlyError(e)); }
    }
    function draw() {
      if (g.status === 'waiting') { lobby(); return; }
      if (!g.lv) { const b = $('#lu-body'); if (b) b.innerHTML = '<div class="spinner"></div>'; return; }
      const st = fromLv(g.lv), seat = mySeat(), k = st.k, rk = g.rk || {};
      const myTurn = seat >= 0 && st.turn === seat && g.status === 'active';
      const revealedAll = allRevealed(k), die = dieK[dk(k)];
      if (revealedAll && die != null && shownAt[k] == null) shownAt[k] = Date.now();
      const landed = shownAt[k] != null && Date.now() - shownAt[k] >= ROLL_MS + 100;
      const canRoll = myTurn && (rk[me()] ?? -1) < k && sentK < k && !auto.on;
      const spin = g.status === 'active' && !revealedAll && (rk[roller()] === k);
      const movable = myTurn && revealedAll && die != null && submittedK < k && landed && !hopping ? L.legal(st, die) : [];
      const note = auto.on && seat >= 0 ? 'AUTO is playing your turns · ' + T.AUTO_NOTE : revealedAll && die != null ? `Rolled ${die}${st.msg ? ' · ' + st.msg : ''}` : st.msg ? `${g.lv.die ? 'Last roll ' + g.lv.die + ' · ' : ''}${st.msg}` : '';
      const rot = seat >= 0 ? rotFor(st.cols[seat]) : 0;
      paint({ st, seats: seats(), mySeat: seat, die: revealedAll && die != null ? die : g.lv.die, dieKey: revealedAll && die != null ? gid + k : '', noToss: g0.status === 'active', spin, rot, auto: auto.on, canRoll, movable: auto.on ? [] : movable, note, flagged }, {
        roll: () => { if (!auto.on) { reveal(k); draw(); } },
        pick: (t) => { if (!auto.on && movable.includes(t)) submit(st, die, t); },
        auto: () => { auto.set(!auto.on); if (auto.on) autoPopup(); autoK = ''; draw(); }
      });
      // turn clock: 15 s to roll, 10 s to move; a missed turn is played and AUTO switches on
      const phase = g.status !== 'active' || hopping ? '' : !revealedAll ? (rk[roller()] === k ? '' : 'r') : landed && submittedK < k ? 'm' : '';
      const human = !isBot(g.players[st.turn]);
      const choose = phase === 'm' ? L.legal(st, die).length : 2;
      if (!phase || !human || choose < 2) ring(st.turn, 1, false);
      else {
        clock.arm(k + phase + st.turn, phase === 'r' ? T.ROLL_S : T.MOVE_S);
        if (myTurn && auto.on) ring(st.turn, 1, false); else ring(st.turn, clock.frac(), true);
        if (myTurn && !auto.on && clock.tick()) ui.sfx.play('tick');
        if (myTurn && !auto.on && clock.expired()) { auto.miss(); autoPopup(); }
      }
      if (myTurn && auto.on && phase && autoK !== k + phase) {
        autoK = k + phase; clearTimeout(autoT);
        if (!usedK.has(k)) { usedK.add(k); auto.played(); }
        autoT = setTimeout(() => { if (!g.lv || g.lv.k !== k || !auto.on) return; if (phase === 'r') { reveal(k); draw(); } else submit(st, die, T.autoMove(st, die)); }, T.AUTO_DELAY);
      }
      const box = $('#g-actions');
      if (box) {
        box.innerHTML = g.status === 'done' ? '<button class="btn btn-sm" id="lu-again">New room</button><a class="btn btn-sm btn-ghost" href="#/games">Games</a>'
          : `<button class="btn btn-sm btn-ghost" id="lu-copy2">Share link</button>${seat >= 0 ? '<button class="btn btn-sm btn-danger" id="lu-leave">Leave game</button>' : '<span class="muted small">You’re watching</span>'}`;
        const c2 = $('#lu-copy2'); if (c2) c2.onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
        const lv = $('#lu-leave'); if (lv) lv.onclick = () => { if (confirm('Leave this game? A computer player takes your seat and it counts as a loss.')) drop(me()); };
        const ag = $('#lu-again'); if (ag) ag.onclick = async () => { try { location.hash = '#/game/' + await net.createGame('ludo', g.mode); } catch (e) { toast(friendlyError(e)); } };
      }
    }
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This room is gone. <a href="#/games">Games</a></div>'; return; }
      serverG = ng;
      const rec = net.reconcile(ng.moveNo, pendingNo);
      pendingNo = rec.pending;
      if (!rec.take) {
        g = { ...ng, lv: g.lv, moveNo: g.moveNo, status: g.status, winnerUid: g.winnerUid || '', endReason: g.endReason || '', turnAt: g.turnAt };
      } else g = ng;
      if (g.lv) {
        if (prevLv && g.lv.k === prevLv.k + 1) { verify(prevLv, g.lv); const a = fromLv(prevLv), b = fromLv(g.lv); hopping = true; hop(a, b, () => { hopping = false; sound(a, b); draw(); }); }
        prevLv = g.lv;
      }
      if (member() && g.status !== 'done' && !stopHb) stopHb = net.heartbeat(gid);
      if (member() && g.status === 'waiting') commit();
      if (member() && !isHost() && g.status !== 'done' && g.hb && g.hb[g.host] && Date.now() - tsMs(g.hb[g.host]) > 40000
          && humans().filter((u) => u !== g.host)[0] === me()) net.fs.updateDoc(net.fs.doc(db, 'games', gid), { host: me(), [`hb.${me()}`]: net.fs.serverTimestamp() }).catch(() => {});
      if (g.status === 'waiting' && ui.signedIn() && !member() && g.players.length < maxSeats() && !joinTried) { joinTried = true; net.join(gid).catch(() => {}); }
      draw();
      step().then(() => draw());
      if (g.status === 'done' && !ended) {
        ended = true; if (stopHb) { stopHb(); stopHb = null; }
        const mine = member() || (g.left || []).includes(me());
        if (mine && !onlyBots(g.players, me())) setTimeout(() => net.recordResult(g, iEnded || (member() && (g.left || []).length > 0)), iEnded ? 0 : 2500);
        const win = g.winnerUid === me();
        const wi = g.players.indexOf(g.winnerUid);
        const botGame = onlyBots(g.players, me());
        if (botGame && mySeat() >= 0) ui.addCpuResult('ludo', win ? 'w' : 'l');
        const paid = T.rewardsAllowed(auto);
        ui.resultModal({ title: win ? 'You win!' : `${wi >= 0 ? g.names[wi] : 'Someone'} wins`, sub: win && !paid ? 'Some turns were played on AUTO, so no XP or rewards this game.' : 'All four tokens home.', win, vsBot: botGame, noReward: !paid, buttons: [{ label: 'New room', onClick: () => $('#lu-again')?.click() }, { label: 'Back to games', href: '#/games' }] });
      }
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }

  // ------------------------------------------------------------ mode picker
  function modes() {
    let lvl = normLevel(lastLevel());
    ui.shell('Pal Ludo', `<div class="lm" id="lm"><div class="lx-spark" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
      <div class="lm-head"><b>Pal Ludo</b><small>Race all four tokens home. Pick how you want to play!</small></div>
      <div class="lm-fan">
        <a class="lm-card lm-red" href="#" data-go="team" aria-label="Team: 2 versus 2, partners sit across and win together"><span class="lm-art">${cardArt()}</span><b class="lm-num">2v2</b><span class="lm-lab">TEAM</span><small>Win with your partner</small></a>
        <a class="lm-card lm-gold lm-mid" href="#" data-go="2" aria-label="1 on 1 against a Pal"><span class="lm-art">${cardArt(true)}</span><b class="lm-num">2</b><span class="lm-lab">1 ON 1</span><small>You vs a Pal</small></a>
        <a class="lm-card lm-green" href="#" data-go="4" aria-label="4 player free for all"><span class="lm-art">${cardArt()}</span><b class="lm-num">4</b><span class="lm-lab">4 PLAYER</span><small>Everyone for themselves</small></a>
      </div>
      <button type="button" class="lm-card lm-blue lm-wide" id="lm-on" aria-expanded="false"><span class="lm-globe" aria-hidden="true">🌍</span><span><span class="lm-lab">PLAY ONLINE</span><small>Real players · bots fill empty seats</small></span></button>
      <div class="lm-online" id="lm-online" hidden>
        <button type="button" class="btn" data-q="2">⚡ Quick match 1 on 1</button>
        <button type="button" class="btn" data-q="4">⚡ Quick match 4 players</button>
        <div class="lm-rooms"><span>🔑 Make a room, share the code</span><button type="button" class="btn btn-ghost" data-room="2">1 on 1 room</button><button type="button" class="btn btn-ghost" data-room="4">4 player room</button></div>
        ${codeFormHtml('lm-code', '🎟️ Join with code')}
      </div>
      <div class="lm-lvl" role="group" aria-label="Bot level"><span>Bot level</span>${PAL_LEVELS.map(([id, t]) => `<button type="button" data-lvl="${id}" class="${id === lvl ? 'on' : ''}">${t}</button>`).join('')}</div>
      <p class="lm-foot"><a href="#/games/ludo?classic=1">More ways to play · invite a friend · scoreboard</a></p></div>`, '#/games');
    const box = $('#lm');
    box.querySelectorAll('[data-lvl]').forEach((b) => b.onclick = () => { lvl = b.dataset.lvl; saveLevel(lvl); box.querySelectorAll('[data-lvl]').forEach((x) => x.classList.toggle('on', x === b)); ui.sfx.play('tap'); });
    box.querySelectorAll('[data-go]').forEach((a) => a.onclick = (e) => { e.preventDefault(); ui.sfx.play('tap'); const m = a.dataset.go; location.hash = `#/games/ludo/cpu?mode=${m === 'team' ? 4 : m}&lvl=${lvl}${m === 'team' ? '&team=1' : ''}`; });
    const on = $('#lm-on'), panel = $('#lm-online');
    on.onclick = () => { panel.hidden = !panel.hidden; on.setAttribute('aria-expanded', String(!panel.hidden)); };
    const go = async (b, f) => { if (!ui.signedIn()) { ctx.requireAuth(); return; } b.disabled = true; try { location.hash = '#/game/' + await f(); } catch (e) { toast(friendlyError(e)); b.disabled = false; } };
    panel.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => go(b, () => net.quickMatch('ludo', b.dataset.q)));
    panel.querySelectorAll('[data-room]').forEach((b) => b.onclick = () => go(b, () => net.createGame('ludo', b.dataset.room)));
    wireCodeForms(panel, { db, getDoc: (r) => net.fs.getDoc(r), doc: (...a) => net.fs.doc(...a), uid: () => (S.user ? S.user.uid : ''), toast, needAuth: () => { if (ui.signedIn()) return true; ctx.requireAuth(); return false; } });
  }
  return { local, online, modes };
}
