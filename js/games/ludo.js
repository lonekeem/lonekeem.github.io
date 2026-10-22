// Ludo UI: SVG board, die, tokens. Local play vs computer players; online rooms (2-4 seats,
// computer fill-ins) with commit-reveal dice: every human commits to the end of a SHA-256 hash
// chain before the game starts and reveals one link per roll; the die comes from hashing all
// reveals together with the roll number, so no single player (or the host) can pick a roll.
// Firestore rules check every reveal against the previous link and the die against the reveals.
import * as L from './ludo-engine.js';
import { isBot, tsMs, TURN_SECONDS } from './net.js';

const BOT_NAMES = ['Nova', 'Echo', 'Pixel', 'Juno'];
const CELL = 20;
const PIPS = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
const dieSvg = (n) => `<svg viewBox="0 0 30 30" aria-hidden="true"><rect x="1.5" y="1.5" width="27" height="27" rx="7" class="lu-die-bg"/>${n ? PIPS[n].map(([x, y]) => `<circle cx="${8 + x * 7}" cy="${8 + y * 7}" r="2.6" class="lu-pip"/>`).join('') : '<text x="15" y="20" text-anchor="middle" class="lu-q">?</text>'}</svg>`;
const star = (x, y, r, cls) => { let pts = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; pts += `${(x + q * Math.cos(a)).toFixed(1)},${(y + q * Math.sin(a)).toFixed(1)} `; } return `<polygon points="${pts}" class="${cls}"/>`; };
let boardBg = '';
function background() {
  if (boardBg) return boardBg;
  let h = `<rect width="300" height="300" rx="16" class="lu-bg"/>`;
  const yardAt = [[0, 0], [0, 9], [9, 9], [9, 0]];
  yardAt.forEach(([r, c], col) => {
    h += `<rect x="${c * CELL + 3}" y="${r * CELL + 3}" width="${6 * CELL - 6}" height="${6 * CELL - 6}" rx="14" fill="${L.COLORS[col]}" class="lu-yard" data-col="${col}"/>`;
    h += `<rect x="${c * CELL + 18}" y="${r * CELL + 18}" width="${6 * CELL - 36}" height="${6 * CELL - 36}" rx="10" class="lu-yard-in"/>`;
    L.YARD[col].forEach(([yr, yc]) => { h += `<circle cx="${yc * CELL + 10}" cy="${yr * CELL + 10}" r="8" class="lu-spot" stroke="${L.COLORS[col]}"/>`; });
  });
  L.TRACK.forEach(([r, c], i) => {
    const startCol = L.START.indexOf(i);
    h += `<rect x="${c * CELL + 1}" y="${r * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="4" class="lu-cell" ${startCol >= 0 ? `fill="${L.COLORS[startCol]}"` : ''}/>`;
    if (L.SAFE.has(i)) h += star(c * CELL + 10, r * CELL + 10, 6.5, startCol >= 0 ? 'lu-safe on' : 'lu-safe');
  });
  L.HOME_COL.forEach((cells, col) => cells.forEach(([r, c]) => { h += `<rect x="${c * CELL + 1}" y="${r * CELL + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="4" fill="${L.COLORS[col]}" class="lu-hc"/>`; }));
  const C0 = 6 * CELL, C1 = 9 * CELL, M = 7.5 * CELL;
  [[C0, C0, C0, C1, 0], [C0, C0, C1, C0, 1], [C1, C0, C1, C1, 2], [C0, C1, C1, C1, 3]].forEach(([x1, y1, x2, y2, col]) => { h += `<polygon points="${x1},${y1} ${x2},${y2} ${M},${M}" fill="${L.COLORS[col]}" class="lu-tri"/>`; });
  h += star(M, M, 13, 'lu-center');
  return (boardBg = h);
}
function boardSvg(st, seats, movable, mine) {
  let h = `<svg viewBox="0 0 300 300" class="lu-svg" role="img" aria-label="Ludo board">${background()}`;
  const stack = {};
  const toks = [];
  st.pos.forEach((tk, p) => tk.forEach((r, t) => {
    const [cr, cc] = L.cellOf(st.cols[p], r, t);
    const key = `${cr},${cc}`; const n = (stack[key] = (stack[key] || 0) + 1) - 1;
    const off = r < 0 || n === 0 ? [0, 0] : [[0, 0], [4, -4], [-4, 4], [4, 4]][n % 4];
    toks.push({ p, t, x: cc * CELL + 10 + off[0], y: cr * CELL + 10 + off[1], can: mine && p === st.turn && movable.includes(t), last: st.last && st.last.p === p && st.last.t === t });
  }));
  toks.sort((a, b) => a.can - b.can);
  for (const k of toks) {
    h += `<g class="lu-tok ${k.can ? 'can' : ''} ${k.last ? 'last' : ''}" style="transform:translate(${k.x}px,${k.y}px)" ${k.can ? `data-t="${k.t}" role="button" tabindex="0" aria-label="Move ${L.COLOR_NAMES[st.cols[k.p]]} token ${k.t + 1}"` : ''}>
      ${k.can ? '<circle r="10.5" class="lu-ring"/>' : ''}<circle r="7.6" fill="${L.COLORS[st.cols[k.p]]}" class="lu-tk"/>${star(0, 0, 4.4, 'lu-tk-star')}</g>`;
  }
  return h + '</svg>';
}

export function createLudo(ctx) {
  const { S, db, main, esc, $, toast, friendlyError, ui } = ctx;
  const { net } = ui;
  function shell(title, back) {
    ui.shell(esc(title), `<div class="lu" id="lu"><div class="g-fx"></div><div id="lu-body"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
  }
  // v = { st, seats, mySeat, die, rolling, canRoll, movable, timer, note, flagged }
  function paint(v, on) {
    const box = $('#lu-body'); if (!box) return;
    const st = v.st, me = v.mySeat;
    const home = (p) => st.pos[p].filter((r) => r === L.HOME).length;
    box.innerHTML = `<div class="lu-seats">${v.seats.map((p, i) => `<div class="lu-seat ${st.winner < 0 && st.turn === i ? 'on' : ''}" style="--lc:${L.COLORS[st.cols[i]]}">${ui.chip(p)}<span class="lu-home">${home(i)}/4</span>${v.flagged && v.flagged[i] ? '<span class="lu-flag" title="A move didn’t check out">⚠</span>' : ''}${st.winner < 0 && st.turn === i && v.timer != null ? `<span class="g-timer ${v.timer <= 10 ? 'low' : ''}">${v.timer}s</span>` : ''}</div>`).join('')}</div>
      <div class="lu-board">${boardSvg(st, v.seats, v.movable || [], me >= 0 && st.turn === me)}</div>
      <div class="lu-ctrl"><button class="lu-die ${v.rolling ? 'rolling' : ''} ${v.canRoll ? 'can' : ''}" id="lu-roll" ${v.canRoll ? '' : 'disabled'} aria-label="${v.canRoll ? 'Roll the die' : 'Die'}" style="--lc:${L.COLORS[st.cols[st.turn]]}">${dieSvg(v.rolling ? 0 : v.die)}</button>
        <div class="lu-msg"><b>${st.winner >= 0 ? `${esc(v.seats[st.winner].name)} wins!` : me === st.turn ? (v.canRoll ? 'Your roll' : v.movable && v.movable.length ? 'Tap a glowing token' : 'Your turn') : `${esc(v.seats[st.turn].name)}’s turn`}</b><span class="muted small">${esc(v.note || st.msg || '')}</span></div></div>`;
    const rb = $('#lu-roll'); if (rb && v.canRoll) rb.onclick = () => on.roll();
    box.querySelectorAll('[data-t]').forEach((el) => { const f = () => on.pick(+el.dataset.t); el.addEventListener('click', f); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') f(); }); });
  }
  const sound = (prev, st) => { if (!st.last) return; ui.sfx.play(st.last.cap ? 'capture' : st.last.to === L.HOME ? 'star' : 'place'); };

  // ------------------------------------------------------------ vs computer
  function local(params) {
    const lvl = ['easy', 'medium', 'hard'].includes(params.lvl) ? params.lvl : 'medium';
    const n = Math.max(2, Math.min(4, +params.mode || 4));
    shell('Ludo', '#/games/ludo');
    ui.wireEmotes(main, '', () => '');
    const me = { uid: ui.myUid(), name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const seats = [me, ...Array.from({ length: n - 1 }, (_, i) => ({ uid: 'cpu' + (i + 1), name: `${BOT_NAMES[i]} · ${lvl[0].toUpperCase() + lvl.slice(1)}` }))];
    let st = L.newGame(n), die = 0, rolling = false, movable = [], phase = 'roll', alive = true;
    S.unsubs.push(() => { alive = false; });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="lu-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/ludo">Leave</a>`;
    $('#lu-new').onclick = () => local(params);
    const later = (f, ms) => setTimeout(() => { if (alive) f(); }, ms);
    function refresh() { paint({ st, seats, mySeat: 0, die, rolling, canRoll: st.winner < 0 && st.turn === 0 && phase === 'roll' && !rolling, movable: phase === 'pick' ? movable : [] }, { roll, pick }); }
    function roll() {
      if (phase !== 'roll' || rolling) return;
      rolling = true; ui.sfx.play('tap'); refresh();
      later(() => { rolling = false; die = L.rollFromRandom(); afterRoll(); }, 550);
    }
    function afterRoll() {
      movable = L.legal(st, die); phase = 'pick'; refresh();
      if (!movable.length) later(() => apply(-1), 900);
      else if (st.turn !== 0) later(() => apply(L.aiPick(st, die, lvl)), 650);
      else if (movable.length === 1) later(() => { if (phase === 'pick') apply(movable[0]); }, 700);
    }
    function pick(t) { if (phase === 'pick' && st.turn === 0 && movable.includes(t)) apply(t); }
    function apply(t) {
      const prev = st; st = L.step(st, die, t); phase = 'roll'; movable = []; sound(prev, st);
      if (st.winner >= 0) {
        refresh(); const win = st.winner === 0; ui.addCpuResult('ludo', win ? 'w' : 'l');
        ui.resultModal({ title: win ? 'You win!' : `${seats[st.winner].name.split(' ·')[0]} wins`, sub: 'All four tokens home.', win, buttons: [{ label: 'Play again', onClick: () => local(params) }, { label: 'Back to games', href: '#/games' }] });
        return;
      }
      refresh();
      if (st.turn !== 0) later(() => { rolling = true; refresh(); later(() => { rolling = false; die = L.rollFromRandom(); afterRoll(); }, 550); }, 600);
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
    let g = g0, serverG = g0, ended = false, stopHb = null, chain = null, committing = false, sentK = -1, submittedK = -1, dieK = {}, flagged = {}, prevLv = null, botT = 0, joinTried = false, iEnded = false, pendingNo = null, dropTried = '';
    const me = () => ui.myUid();
    const isHost = () => g.host === me();
    const member = () => g.players.includes(me());
    const mySeat = () => g.players.indexOf(me());
    const seats = () => g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
    const humans = () => g.players.filter((u) => !isBot(u));
    const maxSeats = () => Math.max(2, Math.min(4, +g.mode || 4));
    shell('Ludo', '#/games');
    ui.wireEmotes(main, gid, (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; });
    const tick = setInterval(() => { if (g.status === 'active') { draw(); afk(); } }, 1000);
    S.unsubs.push(() => { clearInterval(tick); clearTimeout(botT); if (stopHb) stopHb(); clearTimeout(lobby.t); });
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
    function reveal(k) {
      if (sentK >= k) return;
      if (!chain) chain = loadChain(gid, me());
      if (!chain) { toast('This game was joined on another device, so your dice links aren’t here.'); return; }
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
      draw();
      if (ns.winner >= 0) iEnded = true;
      try { await net.commitMove(gid, expect, upd); }
      catch (e) { pendingNo = null; iEnded = false; submittedK = k - 1; g = serverG.moveNo >= prev.moveNo ? serverG : prev; draw(); toast(e && e.code === 'stale' ? 'That move already happened.' : friendlyError(e)); }
    }
    // drive the roll / move cycle from the latest snapshot
    async function step() {
      if (g.status !== 'active' || !g.lv || !member()) return;
      const st = fromLv(g.lv), k = st.k, R = roller();
      const rk = g.rk || {};
      if (R === me() && isBot(g.players[st.turn]) && (rk[me()] ?? -1) < k) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) reveal(k); }, 700); }
      if (R !== me() && rk[R] === k && (rk[me()] ?? -1) < k) reveal(k);
      if (!allRevealed(k)) return;
      const key = dk(k);
      if (dieK[key] == null) { const d = await rollFor(g, k); if (!g.lv || g.lv.k !== k || dk(k) !== key) return; dieK[key] = d; dieK[k] = d; ui.sfx.play('tap'); }
      const die = dieK[key];
      if (mover() !== me()) return;
      const moves = L.legal(st, die);
      if (isBot(g.players[st.turn])) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) submit(st, die, L.aiPick(st, die, 'hard')); }, 750); }
      else if (!moves.length) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) submit(st, die, -1); }, 1000); }
      else if (moves.length === 1) { clearTimeout(botT); botT = setTimeout(() => { if (g.lv && g.lv.k === k) submit(st, die, moves[0]); }, 900); }
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
      drop(blockers[0]);
    }
    async function drop(uid) {
      const i = g.players.indexOf(uid); if (i < 0 || dropTried === uid + g.lv.k) return; dropTried = uid + g.lv.k;
      const rep = (a, v) => a.map((x, j) => (j === i ? v : x));
      try { await net.update(gid, { players: rep(g.players, 'cpu' + i), names: rep(g.names, BOT_NAMES[i] + ' (CPU)'), unames: rep(g.unames, ''), colors: rep(g.colors, ''), left: [...(g.left || []), uid], turnAt: net.fs.serverTimestamp() }); }
      catch (e) { console.warn('ludo drop', e.code || e.message); }
    }
    function lobby() {
      const box = $('#lu-body'); if (!box) return;
      const ps = seats(), ready = humans().every((u) => (g.rv || {})[u]);
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <button class="btn btn-sm btn-ghost" id="lu-copy">Copy invite link</button>
        <p class="muted small">${maxSeats()} seats · computer players fill empty seats</p>
        <h3>${ps.length} / ${maxSeats()} seats</h3><div class="g-seats">${ps.map((p, i) => `<div class="g-seat" style="--lc:${L.COLORS[L.seatColors(maxSeats())[i] ?? i]}">${ui.chip(p, p.uid === g.host ? 'host' : '')}${!isBot(p.uid) ? `<span class="muted small">${(g.rv || {})[p.uid] ? 'dice locked in' : 'locking dice…'}</span>` : ''}${isHost() && isBot(p.uid) ? `<button class="link-btn small" data-rm="${i}">remove</button>` : ''}</div>`).join('')}</div>
        ${isHost() ? `<div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px"><button class="btn btn-sm btn-ghost" id="lu-bot" ${ps.length >= maxSeats() ? 'disabled' : ''}>+ Computer player</button><button class="btn btn-sm" id="lu-start" ${ready ? '' : 'disabled'}>Start game</button></div>`
          : member() ? '<p class="muted center">Waiting for the host to start…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="lu-join">Take a seat</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}
        <p class="muted small center">Fair dice: everyone locks in a secret before the game; each roll mixes everyone’s next secret, so nobody can choose a number.</p></div>`;
      $('#lu-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const bt = $('#lu-bot'); if (bt) bt.onclick = () => addBot();
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeSeat(+b.dataset.rm));
      const sb = $('#lu-start'); if (sb) sb.onclick = () => start();
      const jn = $('#lu-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(lobby.t);
      if (isHost() && g.quick && humans().length >= 2 && ready) lobby.t = setTimeout(() => start(), humans().length >= maxSeats() ? 1500 : 12000);
    }
    async function addBot() {
      const used = new Set(g.players), i = g.players.length;
      if (i >= maxSeats() || used.has('cpu' + i)) return;
      try { await net.update(gid, { players: [...g.players, 'cpu' + i], names: [...g.names, BOT_NAMES[i] + ' (CPU)'], unames: [...g.unames, ''], colors: [...g.colors, ''] }); } catch (e) { toast(friendlyError(e)); }
    }
    async function removeSeat(i) {
      const f = (a) => a.filter((_, j) => j !== i);
      const ps = f(g.players).map((u, j) => (isBot(u) ? 'cpu' + j : u));
      try { await net.update(gid, { players: ps, names: f(g.names), unames: f(g.unames), colors: f(g.colors) }); } catch (e) { toast(friendlyError(e)); }
    }
    async function start() {
      if (!isHost() || g.status !== 'waiting') return;
      clearTimeout(lobby.t);
      const players = [...g.players], names = [...g.names], unames = [...g.unames], colors = [...g.colors];
      while (players.length < maxSeats()) { const i = players.length; players.push('cpu' + i); names.push(BOT_NAMES[i] + ' (CPU)'); unames.push(''); colors.push(''); }
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
      const canRoll = myTurn && (rk[me()] ?? -1) < k && sentK < k;
      const rolling = g.status === 'active' && !revealedAll && (rk[roller()] === k);
      const movable = myTurn && revealedAll && die != null && submittedK < k ? L.legal(st, die) : [];
      const left = g.status === 'active' ? net.turnLeft(g.turnAt) : null;
      const note = revealedAll && die != null ? `Rolled ${die}${st.msg ? ' · ' + st.msg : ''}` : st.msg ? `${g.lv.die ? 'Last roll ' + g.lv.die + ' · ' : ''}${st.msg}` : '';
      paint({ st, seats: seats(), mySeat: seat, die: revealedAll && die != null ? die : g.lv.die, rolling, canRoll, movable, timer: left, note, flagged }, {
        roll: () => { reveal(k); draw(); },
        pick: (t) => { if (movable.includes(t)) submit(st, die, t); }
      });
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
        if (prevLv && g.lv.k === prevLv.k + 1) { verify(prevLv, g.lv); sound(fromLv(prevLv), fromLv(g.lv)); }
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
        if (mine) setTimeout(() => net.recordResult(g, iEnded || (member() && (g.left || []).length > 0)), iEnded ? 0 : 2500);
        const win = g.winnerUid === me();
        const wi = g.players.indexOf(g.winnerUid);
        ui.resultModal({ title: win ? 'You win!' : `${wi >= 0 ? g.names[wi] : 'Someone'} wins`, sub: 'All four tokens home.', win, buttons: [{ label: 'New room', onClick: () => $('#lu-again')?.click() }, { label: 'Back to games', href: '#/games' }] });
      }
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }
  return { local, online };
}
