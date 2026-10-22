// Chess UI: tap a piece, tap a highlighted square. Local play against a small alpha-beta engine
// (in a module worker when available); online play with an optional chess clock.
import * as C from './chess-engine.js';
import { tsMs, TURN_SECONDS } from './net.js';
import { ask, palByLevel, normLevel, whenOffer, offerHtml, stopOffer, lastLevel, onlyBots } from './bots.js';

// Original piece art: simple rounded silhouettes, gold (white) and purple (black), star on the king.
const SHAPES = {
  p: '<path d="M22.5 9.5a5 5 0 0 1 3.1 8.9c2.3 1.5 3.9 4 3.9 6.9 0 1.7-.6 3.3-1.6 4.6 3.3 1.6 5.6 4.7 6.1 8.6H10.9c.5-3.9 2.8-7 6.1-8.6a7.5 7.5 0 0 1-1.6-4.6c0-2.9 1.6-5.4 3.9-6.9a5 5 0 0 1 3.2-8.9z"/>',
  r: '<path d="M11.5 9h4.5v3.5h3.5V9h6v3.5h3.5V9h4.5v7.5l-3.2 3v11l3.4 3.5v4.5H11.3V34l3.4-3.5v-11l-3.2-3z"/><path d="M15.5 20h14" class="ln"/>',
  n: '<path d="M14.5 38.5c0-6 2.5-9.2 6.6-12.4-3 .3-5.5 1.6-7.6 3.6l-2.6-2.4c.4-5.2 3.8-10.5 8.4-13.6l-.8-4.6 4.2 2.5c7.5 0 13 6.2 13 15.7v11.2z"/><circle cx="21" cy="17" r="1.6" class="eye"/>',
  b: '<path d="M22.5 7.5c1.6 0 2.9 1.3 2.9 2.9 0 .6-.2 1.2-.5 1.7 4.4 2.6 7.6 7.3 7.6 12.2 0 3.4-1.7 6.1-4.2 7.6l2.6 2.6v4H14.1v-4l2.6-2.6c-2.5-1.5-4.2-4.2-4.2-7.6 0-4.9 3.2-9.6 7.6-12.2a2.9 2.9 0 0 1 2.4-4.6z"/><path d="M25.5 17.5l-4.5 6" class="ln"/>',
  q: '<path d="M9 15.5l5.5 13 2.2-15.5 5.8 14 5.8-14 2.2 15.5 5.5-13-2 18.5H11z"/><path d="M11.4 35h22.2v4H11.4z"/><circle cx="9" cy="14" r="2.2"/><circle cx="16.7" cy="11.5" r="2.2"/><circle cx="22.5" cy="10.5" r="2.2"/><circle cx="28.3" cy="11.5" r="2.2"/><circle cx="36" cy="14" r="2.2"/>',
  k: '<path d="M22.5 4.3l1.5 3.2 3.5.4-2.6 2.4.7 3.4-3.1-1.7-3.1 1.7.7-3.4-2.6-2.4 3.5-.4z" class="st"/><path d="M22.5 15c5 0 9 2.8 10.6 7.2l2.4-1.4c1.3 2.3.8 6-1.6 9l-1.4 4.2H12.5l-1.4-4.2c-2.4-3-2.9-6.7-1.6-9l2.4 1.4c1.6-4.4 5.6-7.2 10.6-7.2z"/><path d="M11.4 35h22.2v4H11.4z"/>'
};
export function pieceSvg(q) {
  const t = q.toLowerCase(), w = q !== t;
  return `<svg class="ch-pc ${w ? 'gold' : 'purple'}" viewBox="0 0 45 45" aria-hidden="true">${SHAPES[t]}</svg>`;
}
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const fmt = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function createChess(ctx) {
  const { S, main, esc, $, toast, friendlyError, openModal, closeModal, ui } = ctx;
  const { net } = ui;
  function shell(title, back) {
    ui.shell(esc(title), `<div class="g-players ch-players" id="g-players"></div><div class="g-status" id="g-status" aria-live="polite"></div>
      <div class="g-stage ch-stage"><div class="g-fx"></div><div id="g-board"></div></div>
      <div class="ch-moves" id="ch-moves" aria-label="Moves"></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
  }
  function pickPromo(white) {
    return new Promise((res) => {
      openModal(`<h2 style="font-size:1.2rem">Promote to</h2><div class="ch-promo">${'qrbn'.split('').map((t) => `<button data-p="${t}" aria-label="${NAMES[t]}">${pieceSvg(white ? t.toUpperCase() : t)}</button>`).join('')}</div>`, { dismissable: false });
      document.querySelectorAll('.ch-promo [data-p]').forEach((b) => b.onclick = () => { closeModal(); res(b.dataset.p); });
    });
  }
  // v = { pos, mySide (0 white / 1 black / -1), live, sel, last: 'f-t', onPick }
  function paintBoard(v) {
    const el = $('#g-board'); if (!el) return;
    const p = v.pos, moves = v.live ? C.legal(p) : [];
    const from = new Set(moves.map((m) => m.f)), dests = new Map();
    moves.filter((m) => m.f === v.sel).forEach((m) => { if (!dests.has(m.t)) dests.set(m.t, m); });
    const [lf, lt] = (v.last || '').split('-').map(Number);
    const chk = C.inCheck(p) ? p.b.indexOf(p.w ? 'K' : 'k') : -1;
    const flip = v.mySide === 1;
    let h = `<div class="ch-board ${flip ? 'flip' : ''}">`;
    for (let i = 0; i < 64; i++) {
      const s = flip ? 63 - i : i, r = s >> 3, c = s & 7, q = p.b[s];
      const can = from.has(s), dst = dests.has(s);
      const coord = (flip ? r === 0 : r === 7) ? `<i class="ch-f">${'abcdefgh'[c]}</i>` : '';
      const rk = (flip ? c === 7 : c === 0) ? `<i class="ch-r">${8 - r}</i>` : '';
      h += `<button class="ch-sq ${(r + c) % 2 ? 'dk' : 'lt'} ${s === v.sel ? 'sel' : ''} ${dst ? (q !== '.' || dests.get(s).ep ? 'cap' : 'dst') : ''} ${s === lf || s === lt ? 'last' : ''} ${s === chk ? 'chk' : ''}" data-s="${s}" ${can || dst ? '' : 'tabindex="-1"'} aria-label="${C.sqName(s)}${q !== '.' ? ' ' + (q === q.toUpperCase() ? 'gold ' : 'purple ') + NAMES[q.toLowerCase()] : ''}">${q !== '.' ? pieceSvg(q) : ''}${coord}${rk}</button>`;
    }
    el.innerHTML = h + '</div>';
    el.querySelectorAll('[data-s]').forEach((b) => b.onclick = async () => {
      if (!v.live) return;
      const s = +b.dataset.s;
      if (dests.has(s)) {
        let m = dests.get(s);
        if (m.p) { const t = await pickPromo(p.w); m = moves.find((x) => x.f === m.f && x.t === m.t && x.p === t); }
        v.onMove(m); return;
      }
      v.onSelect(from.has(s) && s !== v.sel ? s : -1); ui.sfx.play('tap');
    });
  }
  function paintMoves(sans) {
    const el = $('#ch-moves'); if (!el) return;
    let h = '';
    for (let i = 0; i < sans.length; i += 2) h += `<span><b>${i / 2 + 1}.</b> ${esc(sans[i])}${sans[i + 1] ? ' ' + esc(sans[i + 1]) : ''}</span>`;
    el.innerHTML = h || '<span class="muted">Gold moves first.</span>';
    el.scrollLeft = el.scrollWidth;
  }
  const sideLbl = (i) => `<span class="g-pc ${i === 0 ? 'gold' : 'purple'}">${pieceSvg(i === 0 ? 'K' : 'k')}</span>`;
  function bar(ps, turn, done, clocks, timer) {
    return ps.map((p, i) => `<div class="g-pl ${!done && turn === i ? 'on' : ''}" data-side="${i}">${ui.chip(p)}${sideLbl(i)}${clocks ? `<span class="ch-clock ${!done && turn === i ? 'run' : ''} ${clocks[i] < 20000 ? 'low' : ''}">${fmt(clocks[i])}</span>` : !done && turn === i && timer != null ? `<span class="g-timer ${timer <= 10 ? 'low' : ''}">${timer}s</span>` : ''}</div>`).join('<span class="g-vs">vs</span>');
  }
  const endText = (o, names) => o.winner === 'draw' ? `Draw: ${o.why.toLowerCase()}.` : `${o.why}! ${names[o.winner === 'w' ? 0 : 1]} wins.`;

  // ------------------------------------------------------------ vs computer
  function local(params) {
    const lvl = normLevel(params.lvl);
    const pal = palByLevel(lvl);
    shell('Chess', '#/games/chess');
    ui.wireEmotes(main, '', () => '');
    const human = params.side === 'b' ? 1 : params.side === 'w' ? 0 : Math.random() < 0.5 ? 0 : 1;
    const me = { uid: ui.myUid(), name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' };
    const cpu = { uid: 'cpu1', name: pal.name, bot: true };
    const ps = human === 0 ? [me, cpu] : [cpu, me];
    let ml = [], pos = C.parse(C.START), keys = [C.key(pos)], sans = [], sel = -1, last = '', over = null, alive = true, thinking = false;
    S.unsubs.push(() => { alive = false; });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="ch-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/chess">Leave</a>`;
    $('#ch-new').onclick = () => local({ ...params, side: '' });
    function refresh() {
      const turn = pos.w ? 0 : 1;
      $('#g-players').innerHTML = bar(ps, turn, !!over);
      const o = C.outcome(pos, keys);
      $('#g-status').textContent = over ? endText(over, ps.map((p) => p.name)) : (o.check ? 'Check! ' : '') + (turn === human ? 'Your move' : `${pal.name} is thinking…`);
      paintBoard({ pos, mySide: human, live: !over && turn === human, sel, last, onSelect: (s) => { sel = s; refresh(); }, onMove: (m) => doMove(m) });
      paintMoves(sans);
      if (!over && turn !== human && !thinking) cpuTurn();
    }
    function doMove(m) {
      sans.push(C.san(pos, m)); ml.push(C.moveStr(m)); last = `${m.f}-${m.t}`;
      pos = C.play(pos, m); keys.push(C.key(pos)); sel = -1;
      ui.sfx.play(m.c ? 'capture' : 'place');
      const o = C.outcome(pos, keys);
      if (o.over) {
        over = o; refresh();
        const res = o.winner === 'draw' ? 'd' : (o.winner === 'w') === (human === 0) ? 'w' : 'l';
        ui.addCpuResult('chess', res);
        ui.resultModal({ title: res === 'd' ? 'Draw' : res === 'w' ? 'You win!' : `${pal.name} wins`, sub: o.why, win: res === 'w', vsBot: true, buttons: [{ label: 'Play again', onClick: () => local({ ...params, side: '' }) }, { label: 'Back to games', href: '#/games' }] });
        return;
      }
      if (o.check) ui.sfx.play('pop');
      refresh();
    }
    async function cpuTurn() {
      thinking = true;
      const s = await ask({ kind: 'chess', board: C.boardOf(pos), cx: C.cxOf(pos), level: lvl });
      thinking = false;
      if (!alive || over) return;
      const m = s && C.findMove(pos, s); if (m) doMove(m);
    }
    refresh();
  }

  // ------------------------------------------------------------ online
  async function online(g0) {
    const gid = g0.id;
    let g = g0, serverG = g0, ended = false, stopHb = null, claimT = 0, sel = -1, joinTried = false, iEnded = false, pendingNo = null;
    shell('Chess', '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    ui.wireEmotes(main, gid, names);
    const side = () => g.players.indexOf(ui.myUid());
    const timed = () => Array.isArray(g.clk) && g.clk.length === 2;
    const tick = setInterval(() => header(), 500);
    S.unsubs.push(() => { clearInterval(tick); clearTimeout(claimT); if (stopHb) stopHb(); });
    const elapsed = () => Math.max(0, net.serverNow() - (tsMs(g.turnAt) || net.serverNow()));
    const clocks = () => { if (!timed()) return null; const c = [...g.clk]; if (g.status === 'active') c[g.turn] = Math.max(0, c[g.turn] - elapsed()); return c; };
    function header() {
      if (!$('#g-players')) return;
      const ps = g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
      while (ps.length < 2) ps.push({ uid: '', name: 'Waiting…' });
      const left = g.status === 'active' ? net.turnLeft(g.turnAt) : null;
      $('#g-players').innerHTML = bar(ps, g.turn, g.status !== 'active', clocks(), left);
      const st = $('#g-status'), me = side();
      if (g.status === 'waiting') st.textContent = me === 0 ? (g.invitee ? 'Waiting for your friend…' : g.quick ? 'Looking for an opponent…' : 'Share the link so a friend can join') : 'Waiting for players';
      else if (g.status === 'done') st.textContent = g.endReason === 'cancelled' ? 'Cancelled' : g.winnerUid === 'draw' ? `Draw${g.why ? '' : ''}` : `${names(g.winnerUid)} wins${g.endReason === 'forfeit' ? ' (resigned)' : g.endReason === 'timeout' ? ' (time ran out)' : ''}`;
      else { const p = C.parse(g.board, g.cx); st.textContent = (C.inCheck(p) ? 'Check! ' : '') + (me === g.turn ? 'Your move' : `${g.names[g.turn]} to move`); }
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
      if (timed()) { const c = [...g.clk]; c[me] = Math.max(0, Math.round(c[me] - elapsed())); upd.clk = c; }
      if (o.over) Object.assign(upd, o.winner === 'draw' ? { status: 'done', winnerUid: 'draw', endReason: 'draw' } : { status: 'done', winnerUid: ui.myUid(), endReason: 'win' });
      pendingNo = upd.moveNo;
      g = { ...g, ...upd, turnAt: { toMillis: () => Date.now() } };
      sel = -1; ui.sfx.play(m.c ? 'capture' : 'place'); draw();
      try { await net.commitMove(gid, expect, upd); if (o.over) iEnded = true; }
      catch (e) { pendingNo = null; iEnded = false; g = serverG.moveNo >= base.moveNo ? serverG : base; draw(); toast(e && e.code === 'stale' ? 'That move already happened.' : friendlyError(e)); }
    }
    function actions() {
      const box = $('#g-actions'); if (!box) return;
      const me = side();
      if (g.status === 'waiting') {
        const offer = me === 0 && !g.invitee && g.players.length < 2 && whenOffer(gid, () => actions());
        box.innerHTML = `${me === 0 ? '<button class="btn btn-sm btn-ghost" id="g-share">Copy invite link</button><button class="btn btn-sm btn-ghost" id="g-cancel">Cancel</button>' : ''}${!ui.signedIn() ? `<a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to play</a>` : ''}${offer ? offerHtml() : ''}`;
      }
      else if (g.status === 'active') box.innerHTML = me >= 0 ? '<button class="btn btn-sm btn-danger" id="g-forfeit">Resign</button><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>' : '<span class="muted small">You’re watching</span><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>';
      else box.innerHTML = `${me >= 0 && g.endReason !== 'cancelled' ? (g.rematch ? `<a class="btn btn-sm" href="#/game/${esc(g.rematch)}">Go to rematch</a>` : '<button class="btn btn-sm" id="g-rematch">Rematch</button>') : ''}<a class="btn btn-sm btn-ghost" href="#/games">Games</a>`;
      const sh = $('#g-share'); if (sh) sh.onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const cn = $('#g-cancel'); if (cn) cn.onclick = async () => { try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('chess', g.mode, gid); location.hash = '#/games'; } catch (e) { toast(friendlyError(e)); } };
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = async () => { stopOffer(gid); try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue('chess', g.mode, gid); } catch { /* already gone */ } location.hash = `#/games/chess/cpu?lvl=${lastLevel()}&mode=${g.mode || ''}`; };
      const ff = $('#g-forfeit'); if (ff) ff.onclick = () => { if (confirm('Resign this game? It counts as a loss.')) net.update(gid, { status: 'done', winnerUid: g.players[1 - side()], endReason: 'forfeit' }).catch((e) => toast(friendlyError(e))); };
      const rm = $('#g-rematch'); if (rm) rm.onclick = async () => {
        rm.disabled = true;
        try { const other = g.players[1 - me]; const nid = await net.createGame('chess', g.mode, { invitee: other, from: gid }); await net.update(gid, { rematch: nid }); net.invite(other, nid, 'Chess rematch').catch(() => {}); location.hash = '#/game/' + nid; }
        catch (e) { toast(friendlyError(e)); rm.disabled = false; }
      };
    }
    function onEnd() {
      if (ended) return; ended = true;
      if (stopHb) { stopHb(); stopHb = null; }
      if (g.endReason === 'cancelled') return;
      const me = side();
      const botGame = onlyBots(g.players, ui.myUid());
      if (me >= 0 && !botGame) setTimeout(() => net.recordResult(g, iEnded || g.endReason !== 'win'), iEnded ? 0 : 2500);
      if (me >= 0 && botGame) ui.addCpuResult('chess', g.winnerUid === ui.myUid() ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l');
      const win = me >= 0 && g.winnerUid === ui.myUid();
      const p = C.parse(g.board, g.cx), o = C.outcome(p, C.replay(g.ml).keys);
      ui.resultModal({ title: g.winnerUid === 'draw' ? 'Draw' : me < 0 ? `${names(g.winnerUid)} wins` : win ? 'You win!' : 'You lost', sub: g.endReason === 'forfeit' ? 'Resigned.' : g.endReason === 'timeout' ? 'Time ran out.' : o.over ? o.why + '.' : '', win, vsBot: botGame,
        buttons: me >= 0 ? [{ label: 'Rematch', onClick: () => $('#g-rematch')?.click() }, { label: 'Back to games', href: '#/games' }] : [{ label: 'Back to games', href: '#/games' }] });
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
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This game was removed. <a href="#/games">Games</a></div>'; return; }
      serverG = ng;
      const prevMove = g.moveNo;
      const rec = net.reconcile(ng.moveNo, pendingNo);
      pendingNo = rec.pending;
      if (!rec.take) { scheduleClaim(); return; }
      g = ng;
      if (g.moveNo !== prevMove && g.turn === side()) ui.sfx.play('place');
      if (g.status === 'active' && side() >= 0 && !stopHb) stopHb = net.heartbeat(gid);
      if (g.status === 'active' && g.moveNo === 0 && g.quick) net.leaveQueue('chess', g.mode, gid);
      if (g.status === 'waiting' && ui.signedIn() && side() < 0 && !joinTried && (!g.invitee || g.invitee === ui.myUid())) { joinTried = true; net.join(gid).catch((e) => toast(friendlyError(e))); }
      draw(); scheduleClaim();
      if (g.status === 'done') onEnd();
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }
  return { local, online };
}
