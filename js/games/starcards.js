// Star Cards: 2-6 player shedding game. Online, the room host's client deals and referees:
// the shuffled pile + seed live in games/{code}/hands/_dealer (host-only), each hand lives in
// games/{code}/hands/{uid} (only that player can read it), and players send intents. The seed's
// SHA-256 is published when a round is dealt and the seed itself when it ends, so every player can
// re-run the shuffle and check their own deal. Computer players fill empty seats.
import * as C from './cards.js';
import { isBot, tsMs } from './net.js';
import { ask, normLevel, botPlayer, seatName, fillToggleHtml, wireFill, fillBots, whenOffer, stopOffer, offerHtml, lastLevel, onlyBots } from './bots.js';
import { syncPlate, syncPlates } from './plates.js';

const TURN_S = 30;
const CATCH = { easy: 0.35, medium: 0.55, hard: 0.8, expert: 0.95 };
const SUIT = { p: '#8a2be2', g: '#f2b31b', t: '#2bb5a8', r: '#e2558f' };
const ICON = {
  S: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><path d="M7 17 17 7"/></svg>',
  F: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9.5h11.5l-3-3M19 14.5H7.5l3 3"/></svg>',
  W: '<svg viewBox="0 0 24 24"><path d="M12 2 14 10 12 12z" fill="#8a2be2"/><path d="M22 12 14 14 12 12z" fill="#f2b31b"/><path d="M12 22 10 14 12 12z" fill="#2bb5a8"/><path d="M2 12 10 10 12 12z" fill="#e2558f"/><path d="M12 2 10 10 12 12zM22 12 14 10 12 12zM12 22 14 14 12 12zM2 12 10 14 12 12z" fill="#fff" opacity=".85"/></svg>'
};
function face(card) {
  const v = C.valueOf(card);
  if (v === 'W') return `<span class="sc-sym">${ICON.W}</span>`;
  if (v === 'X') return `<span class="sc-sym">${ICON.W}<b class="sc-plus">+4</b></span>`;
  if (v === 'S' || v === 'F') return `<span class="sc-sym ic">${ICON[v]}</span>`;
  if (v === 'D') return '<span class="sc-sym"><b>+2</b></span>';
  return `<span class="sc-sym"><b>${v}</b></span>`;
}
const corner = (card) => { const v = C.valueOf(card); return v === 'W' ? '★' : v === 'X' ? '+4' : v === 'D' ? '+2' : v === 'S' ? '⊘' : v === 'F' ? '⇄' : v; };
export function cardHtml(card, { cls = '', attrs = '' } = {}) {
  const col = C.colorOf(card);
  return `<button class="sc-card ${col ? 'c-' + col : 'c-w'} ${cls}" ${attrs} aria-label="${C.cardName(card)}"><span class="sc-k tl">${corner(card)}</span>${face(card)}<span class="sc-k br">${corner(card)}</span></button>`;
}
const back = (cls = '') => `<span class="sc-card back ${cls}" aria-hidden="true"><span class="sc-logo">KL</span></span>`;

export function createStarCards(ctx) {
  const { S, db, main, esc, $, toast, friendlyError, stale, openModal, closeModal, ui } = ctx;
  const { net } = ui;

  function frame(title, backHref) {
    ui.shell(esc(title), `<div class="sc" id="sc"><div class="g-fx"></div><div id="sc-body"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, backHref);
  }
  function pickColor() {
    return new Promise((res) => {
      openModal(`<h2 style="font-size:1.25rem">Pick a colour</h2><div class="sc-pick">${C.COLORS.map((c) => `<button data-c="${c}" style="--sc:${SUIT[c]}" aria-label="${C.COLOR_NAME[c]}">${ui.STAR()}<span>${C.COLOR_NAME[c]}</span></button>`).join('')}</div><button class="btn btn-ghost btn-sm" data-x>Cancel</button>`, { dismissable: false });
      document.querySelectorAll('.sc-pick [data-c]').forEach((b) => b.onclick = () => { closeModal(); res(b.dataset.c); });
      document.querySelector('.modal [data-x]').onclick = () => { closeModal(); res(null); };
    });
  }
  // v = { seats:[{uid,name,uname,color}], mySeat, pv, hand, drawn, timerLeft, verified, msg }
  // Opponent plates and your plate stay in the DOM. The table and hand are rebuilt only when the cards change.
  let lastSeq = -1, lastTop = '', armed = false;
  const scCur = { v: null, h: null };
  function paint(v, h) {
    const box = $('#sc-body'); if (!box) return;
    scCur.v = v; scCur.h = h;
    const pv = v.pv, me = v.mySeat;
    const myTurn = me >= 0 && pv.turn === me && pv.roundWinner < 0;
    const playable = myTurn ? (pv.drew ? (v.drawn && v.hand.includes(v.drawn) && canPlayPv(pv, v.drawn) ? [v.drawn] : []) : v.hand.filter((c) => canPlayPv(pv, c))) : [];
    const order = []; for (let k = 1; k < v.seats.length; k++) order.push(((me < 0 ? 0 : me) + k) % v.seats.length);
    if (me < 0) order.unshift(0);
    if (!box.querySelector('#sc-opps')) {
      box.innerHTML = `<div class="sc-opps" id="sc-opps"></div><div id="sc-table"></div><div class="sc-me" id="sc-me"><div class="sc-me-bar" id="sc-me-bar"></div><div id="sc-rest"></div></div>`;
    }
    syncPlates($('#sc-opps'), order.map((s) => {
      const p = v.seats[s], n = pv.counts[s];
      const on = pv.turn === s && pv.roundWinner < 0;
      const bits = [
        { key: 'fan', className: 'sc-fan', html: Array.from({ length: Math.min(n, 8) }, (_, i) => `<i style="--i:${i}"></i>`).join(''), sig: String(Math.min(n, 8)) },
        { key: 'n', className: 'sc-n', text: String(n) }
      ];
      if (n === 1 && pv.called && pv.called[s]) bits.push({ key: 'ls', className: 'sc-ls', text: 'LAST STAR!' });
      if (pv.target) bits.push({ key: 'pts', className: 'sc-score', text: String(pv.scores[s]) });
      if (on && v.timerLeft != null) bits.push({ key: 'tm', className: 'g-timer' + (v.timerLeft <= 8 ? ' low' : ''), text: v.timerLeft + 's' });
      return { key: 's' + s, className: 'sc-opp' + (on ? ' on' : '') + (pv.exposed === s ? ' exposed' : ''), person: p, bits };
    }));
    const meEl = $('#sc-me');
    const meCls = 'sc-me' + (myTurn ? ' on' : '');
    if (meEl.className !== meCls) meEl.className = meCls;
    const bar = $('#sc-me-bar');
    if (me < 0) {
      if (bar.dataset.mode !== 'watch') { bar.dataset.mode = 'watch'; bar.innerHTML = '<span class="muted small">You’re watching</span>'; }
    } else {
      if (bar.dataset.mode !== 'play') { bar.dataset.mode = 'play'; bar.innerHTML = ''; }
      const bits = [{ key: 'n', className: 'sc-n', text: v.hand.length + ' cards' }];
      if (pv.target) bits.push({ key: 'pts', className: 'sc-score', text: pv.scores[me] + ' pts' });
      if (myTurn && v.timerLeft != null) bits.push({ key: 'tm', className: 'g-timer' + (v.timerLeft <= 8 ? ' low' : ''), text: v.timerLeft + 's' });
      bits.push({ key: 'sp', className: 'spacer', text: '' });
      if (v.verified) bits.push({ key: 'ver', className: 'sc-ver ' + (v.verified.ok ? 'ok' : 'bad'), text: v.verified.ok ? '✓ deal verified' : '⚠ deal mismatch', title: v.verified.text });
      syncPlate(bar, { className: 'sc-me-bar', person: v.seats[me], bits });
    }
    const newTop = pv.top !== lastTop || pv.seq !== lastSeq;
    const canCatch = pv.exposed >= 0 && pv.exposed !== me && me >= 0 && pv.roundWinner < 0;
    const showLast = me >= 0 && pv.roundWinner < 0 && ((myTurn && v.hand.length === 2 && !pv.drew) || pv.exposed === me);
    const playSig = [pv.turn, pv.top, pv.seq, pv.color, pv.dir, pv.drew ? 1 : 0, pv.deckCount, pv.exposed, pv.roundWinner, me, myTurn ? 1 : 0, (v.hand || []).join(','), v.drawn || '', playable.join(','), showLast ? 1 : 0, canCatch ? 1 : 0, armed ? 1 : 0].join('|');
    const table = $('#sc-table');
    const rest = $('#sc-rest');
    if (table.dataset.sig !== playSig) {
      table.dataset.sig = playSig;
      table.innerHTML = `<div class="sc-table" style="--cur:${SUIT[pv.color]}">
        <div class="sc-dir ${pv.dir < 0 ? 'ccw' : ''}" aria-label="Direction">${ICON.F}</div>
        <button class="sc-pile" id="sc-draw" ${myTurn && !pv.drew ? '' : 'disabled'} aria-label="Draw a card">${back()}${back('b2')}${back('b3')}<span class="sc-pile-n">${pv.deckCount}</span></button>
        <div class="sc-discard">${cardHtml(pv.top, { cls: newTop ? 'land' : '', attrs: 'tabindex="-1" disabled' })}<span class="sc-ring" title="Current colour: ${C.COLOR_NAME[pv.color]}"></span></div>
        <div class="sc-msg" id="sc-msg"></div>
      </div>`;
      rest.innerHTML = `<div class="sc-btns">
          ${showLast ? `<button class="sc-last ${armed ? 'armed' : ''}" id="sc-last">${ui.STAR()} LAST STAR!</button>` : ''}
          ${canCatch ? `<button class="sc-catch" id="sc-catch">Catch ${esc(v.seats[pv.exposed].name)}! +2</button>` : ''}
          ${myTurn && pv.drew && playable.length ? '<button class="btn btn-sm btn-ghost" id="sc-pass">Keep it &amp; pass</button>' : ''}
        </div>
        <div class="sc-hand" style="--n:${v.hand.length}">${v.hand.map((c, i) => cardHtml(c, { cls: `${playable.includes(c) ? 'can' : myTurn ? 'dim' : ''} ${c === v.drawn && pv.drew ? 'fresh' : ''}`, attrs: `data-i="${i}" style="--i:${i}" ${playable.includes(c) ? '' : 'aria-disabled="true"'}` })).join('')}</div>
        <p class="muted small center sc-hint" id="sc-hint"></p>`;
      if (newTop) { lastSeq = pv.seq; lastTop = pv.top; }
      rest.querySelectorAll('.sc-hand [data-i]').forEach((b) => b.onclick = async () => {
        const cv = scCur.v, ch = scCur.h; if (!cv || !ch) return;
        const c = cv.hand[+b.dataset.i];
        const pv2 = cv.pv, mine = cv.mySeat;
        const turn = mine >= 0 && pv2.turn === mine && pv2.roundWinner < 0;
        const legal = turn ? (pv2.drew ? (cv.drawn && cv.hand.includes(cv.drawn) && canPlayPv(pv2, cv.drawn) ? [cv.drawn] : []) : cv.hand.filter((x) => canPlayPv(pv2, x))) : [];
        if (!legal.includes(c)) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
        let color;
        if (C.isWild(c)) { color = await pickColor(); if (!color) return; }
        const last = armed && cv.hand.length === 2; armed = false;
        ui.sfx.play('card');
        ch.send({ t: 'play', card: c, color, last });
      });
      const d = $('#sc-draw'); if (d) d.onclick = () => { if (!scCur.h) return; ui.sfx.play('deal'); scCur.h.send({ t: 'draw' }); };
      const ps = $('#sc-pass'); if (ps) ps.onclick = () => { if (scCur.h) scCur.h.send({ t: 'pass' }); };
      const ls = $('#sc-last'); if (ls) ls.onclick = () => {
        const cv = scCur.v, ch = scCur.h; if (!cv || !ch) return;
        ui.sfx.play('star'); ui.burst(ls, 8);
        if (cv.pv.exposed === cv.mySeat || cv.hand.length === 1) ch.call({ t: 'last' });
        else { armed = !armed; ls.classList.toggle('armed', armed); toast(armed ? 'LAST STAR! armed: now play your card' : 'LAST STAR! off'); }
      };
      const ct = $('#sc-catch'); if (ct) ct.onclick = () => { if (!scCur.h) return; ui.sfx.play('pop'); scCur.h.call({ t: 'catch' }); };
    }
    const msgEl = $('#sc-msg'); if (msgEl && msgEl.textContent !== (v.msg || '')) msgEl.textContent = v.msg || '';
    const hint = me < 0 ? '' : pv.roundWinner >= 0 ? '' : myTurn ? (pv.drew ? 'You drew. Play it or keep it.' : playable.length ? `Play a ${C.COLOR_NAME[pv.color].toLowerCase()} card, a match, or a Star Wild${v.hand.length === 2 ? ' (tap LAST STAR! first)' : ''}.` : 'No match. Tap the pile to draw.') : `${v.seats[pv.turn].name}’s turn`;
    const hintEl = $('#sc-hint'); if (hintEl && hintEl.textContent !== hint) hintEl.textContent = hint;
  }
  function canPlayPv(pv, card) { return C.isWild(card) || card[0] === pv.color || (!C.isWild(pv.top) && card[1] === pv.top[1]); }
  function eventMsg(ev, seats) {
    if (!ev || !ev.length) return '';
    const nm = (s) => (seats[s] ? seats[s].name : '');
    const e = ev[ev.length - 1];
    if (e.k === 'play') return `${nm(e.seat)} played ${C.cardName(e.card)}${C.isWild(e.card) ? ' → ' + C.COLOR_NAME[e.color] : ''}`;
    if (e.k === 'drawn') return `${nm(e.seat)} draws ${e.n}`;
    if (e.k === 'skip') return `${nm(e.seat)} is skipped`;
    if (e.k === 'flip') return 'Flip! Direction reversed';
    if (e.k === 'pass') return `${nm(e.seat)} passes`;
    if (e.k === 'draw') return `${nm(e.seat)} drew a card`;
    if (e.k === 'last') return `${nm(e.seat)}: LAST STAR!`;
    if (e.k === 'caught') return `${nm(e.by)} caught ${nm(e.seat)}! +2`;
    if (e.k === 'round') return `${nm(e.seat)} wins the round (+${e.pts})`;
    return '';
  }
  function soundFor(ev) {
    if (!ev || !ev.length) return;
    const k = ev[ev.length - 1].k;
    ui.sfx.play(k === 'play' ? 'card' : k === 'draw' || k === 'drawn' ? 'deal' : k === 'last' ? 'star' : k === 'caught' ? 'capture' : k === 'round' ? 'win' : 'tap');
  }
  function roundModal(st, seats, mySeat, { onNext, final, buttons }) {
    const w = st.roundWinner;
    const win = w === mySeat;
    if (final) {
      ui.resultModal({ title: st.matchWinner === mySeat ? 'You win the match!' : `${seats[st.matchWinner].name} wins`, sub: st.target ? `First to ${st.target}: ${st.scores[st.matchWinner]} points` : `+${st.roundPoints} points`, win: st.matchWinner === mySeat, vsBot: seats.every((p, i) => i === mySeat || isBot(p.uid) || p.bot), buttons });
      return;
    }
    toast(win ? `You won the round! +${st.roundPoints}` : `${seats[w].name} won the round (+${st.roundPoints})`);
    if (win) ui.burst($('.sc-table'), 16);
    if (onNext) onNext();
  }

  // ------------------------------------------------------------ vs computer
  function local(params) {
    const lvl = normLevel(params.lvl);
    const bots = Math.max(1, Math.min(5, parseInt(params.bots, 10) || 3));
    const target = params.mode === 'round' ? 0 : 500;
    frame('Star Cards', '#/games/starcards');
    ui.wireEmotes(main, '', () => '');
    const seats = [{ uid: ui.myUid() || '', name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' },
      ...Array.from({ length: bots }, (_, i) => botPlayer(i, lvl))];
    let st = C.newRound(C.newSeed(), seats.length, { target }), msg = 'Your deal. Match colour or number.', alive = true, timer = 0, catchT = 0;
    S.unsubs.push(() => { alive = false; clearTimeout(timer); clearTimeout(catchT); });
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="sc-new">New game</button><a class="btn btn-sm btn-ghost" href="#/games/starcards">Leave</a>`;
    $('#sc-new').onclick = () => local(params);
    const view = () => ({ seats, mySeat: 0, pv: C.publicView(st), hand: st.hands[0], drawn: st.drew && st.turn === 0 ? st.drawn : null, timerLeft: null, msg });
    const draw = () => paint(view(), { send: (a) => doAct(0, a), call: (a) => doAct(0, a) });
    function doAct(seat, a) {
      if (!alive) return;
      try { const r = C.act(st, seat, a); st = r.st; msg = eventMsg(r.events, seats); if (seat !== 0) soundFor(r.events); } catch (e) { if (seat === 0) toast(e.message); return; }
      after();
    }
    function after() {
      draw();
      clearTimeout(timer);
      if (st.roundWinner >= 0) {
        const final = st.matchWinner >= 0;
        if (final) ui.addCpuResult('starcards', st.matchWinner === 0 ? 'w' : 'l');
        roundModal(st, seats, 0, {
          final, buttons: [{ label: 'Play again', onClick: () => local(params) }, { label: 'Back to games', href: '#/games' }],
          onNext: () => { timer = setTimeout(() => { if (!alive) return; st = C.newRound(C.newSeed(), seats.length, st); msg = `Round ${st.round}`; ui.sfx.play('deal'); after(); }, 2600); }
        });
        return;
      }
      // computer catches a missed LAST STAR!
      if (st.exposed >= 0) {
        clearTimeout(catchT);
        const ex = st.exposed;
        const catcher = seats.findIndex((p, i) => i > 0 && i !== ex);
        if (catcher > 0) catchT = setTimeout(() => { if (alive && st.exposed === ex && Math.random() < (CATCH[lvl] || 0.7)) doAct(catcher, { t: 'catch' }); }, 1600 + Math.random() * 1200);
      }
      if (st.turn !== 0) ask({ kind: 'cards', st, seat: st.turn, level: lvl }).then((a) => { if (alive && st.turn !== 0) doAct(st.turn, a); });
    }
    ui.sfx.play('deal');
    after();
  }

  // ------------------------------------------------------------ online room
  async function online(g0, token) {
    const gid = g0.id;
    let g = g0, hand = { hand: [], drawn: null }, stopHb = null, unsubHand = null, ended = false;
    const me = () => ui.myUid();
    const isHost = () => g.host === me();
    const member = () => g.players.includes(me());
    const mySeat = () => g.players.indexOf(me());
    const seats = () => g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
    const myDealt = {}, hashSeen = {}; let verified = null, turnSeenAt = Date.now(), lastTurnKey = '';
    frame('Star Cards', '#/games');
    ui.wireEmotes(main, gid, (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; });
    const tick = setInterval(() => { if (g.status === 'active') draw(); }, 1000);
    S.unsubs.push(() => { clearInterval(tick); stopOffer(gid); if (stopHb) stopHb(); if (unsubHand) unsubHand(); dealer.stop(); });

    // ---------------- dealer (runs only on the host's client)
    const dealer = (() => {
      let st = null, seenI = 0, seenC = 0, chain = Promise.resolve(), botT = 0, afkT = 0, catchT = 0, nextT = 0, loading = false, written = {}, exposedSeen = -1;
      const save = (events, extra = {}) => {
        const snap = JSON.parse(JSON.stringify(st));
        chain = chain.then(async () => {
          const gameRef = net.fs.doc(db, 'games', gid);
          const hands = [];
          g.players.forEach((uid, seat) => {
            if (isBot(uid)) return;
            const data = { hand: snap.hands[seat], seat, drawn: snap.drew && snap.turn === seat ? snap.drawn : null, round: snap.round };
            const key = JSON.stringify(data);
            if (written[uid] === key && !extra.status) return;
            written[uid] = key;
            if (extra.dealt) data.dealt = snap.hands[seat];
            hands.push([uid, data]);
          });
          const late = hands.length > 4;
          await net.fs.runTransaction(db, async (tx) => {
            const cur = await tx.get(gameRef);
            const pv0 = cur.exists() ? cur.data().pv : null;
            if (pv0 && typeof pv0.seq === 'number' && snap.seq < pv0.seq) { const e = new Error('stale'); e.code = 'stale'; throw e; }
            const pv = { ...C.publicView(snap), ev: events.slice(-3) };
            const { dealt, ...gextra } = extra;
            tx.update(gameRef, { pv, turnAt: net.fs.serverTimestamp(), updatedAt: net.fs.serverTimestamp(), ...gextra });
            tx.set(net.fs.doc(db, 'games', gid, 'hands', '_dealer'), { s: JSON.stringify({ st: snap, seenI, seenC }) });
            if (!late) hands.forEach(([uid, data]) => tx.set(net.fs.doc(db, 'games', gid, 'hands', uid), data, { merge: true }));
          });
          // 5-6 players: all hands in one transaction with the room update goes past the rules' 1000-expression cap, so write them right after
          if (late) { const b = net.fs.writeBatch(db); hands.forEach(([uid, data]) => b.set(net.fs.doc(db, 'games', gid, 'hands', uid), data, { merge: true })); await b.commit(); }
        }).catch(async (e) => {
          console.warn('deal write', e.code || e.message); written = {};
          if (e && e.code === 'stale') { st = null; await ensure(); }
        });
        return chain;
      };
      async function ensure() {
        if (st || loading) return !!st;
        if (!g.pv) return false;
        loading = true;
        try {
          const d = await net.fs.getDoc(net.fs.doc(db, 'games', gid, 'hands', '_dealer'));
          if (d.exists()) { const j = JSON.parse(d.data().s); st = j.st; seenI = j.seenI || 0; seenC = j.seenC || 0; }
        } catch (e) { console.warn(e); }
        loading = false;
        return !!st;
      }
      async function startRound(prev) {
        const seed = C.newSeed(), hash = await C.sha256(seed);
        st = C.newRound(seed, g.players.length, prev || { target: g.mode === 'round' ? 0 : 500 });
        written = {};
        await save([{ k: 'deal' }], { seedHash: hash, status: 'active', dealt: true });
      }
      function apply(seat, a) {
        try { const r = C.act(st, seat, a); st = r.st; save(r.events); return r.events; } catch (e) { return null; }
      }
      let planKey = '', roundDone = 0;
      function plan() {
        if (!st || !isHost() || g.status !== 'active') { clearTimeout(botT); clearTimeout(afkT); planKey = ''; return; }
        const k = st.round + ':' + st.turn + ':' + st.seq + ':' + st.exposed;
        if (k === planKey) return;
        planKey = k;
        clearTimeout(botT); clearTimeout(afkT);
        if (st.roundWinner >= 0) {
          if (roundDone === st.round) return;
          roundDone = st.round;
          clearTimeout(nextT);
          nextT = setTimeout(async () => {
            const rev = [...(g.seeds || []), { round: st.round, seed: st.seed, hash: g.seedHash }].slice(-12);
            if (st.matchWinner >= 0) {
              await save([], { seeds: rev, status: 'done', winnerUid: g.players[st.matchWinner], endReason: 'win' });
              iEnded = true;
            } else { await save([], { seeds: rev }); setTimeout(() => startRound(st), 3500); }
          }, 1200);
          return;
        }
        const who = g.players[st.turn];
        if (isBot(who)) botT = setTimeout(() => { if (st && isBot(g.players[st.turn])) ask({ kind: 'cards', st, seat: st.turn, level: lastLevel() }).then((a) => { if (st && isBot(g.players[st.turn])) { apply(st.turn, a); plan(); } }); }, 80);
        else afkT = setTimeout(() => { if (!st) return; apply(st.turn, st.drew ? { t: 'pass' } : { t: 'draw' }); if (st.drew) apply(st.turn, { t: 'pass' }); plan(); }, (TURN_S + 2) * 1000);
        if (st.exposed >= 0 && st.exposed !== exposedSeen) {
          exposedSeen = st.exposed;
          const catcher = g.players.findIndex((u, i) => isBot(u) && i !== st.exposed);
          if (catcher >= 0) { clearTimeout(catchT); const ex = st.exposed; catchT = setTimeout(() => { if (st && st.exposed === ex && Math.random() < 0.7) { apply(catcher, { t: 'catch' }); plan(); } }, 2500 + Math.random() * 1500); }
        }
        if (st.exposed < 0) exposedSeen = -1;
      }
      async function onRoom() {
        if (!isHost() || g.status !== 'active') return;
        if (!(await ensure())) return;
        const it = g.intent || {};
        if (it.n && it.n !== seenI) {
          seenI = it.n; const seat = g.players.indexOf(it.uid);
          if (seat >= 0 && st && (it.seq == null || it.seq === st.seq)) apply(seat, { t: it.t, card: it.card, color: it.color, last: !!it.last });
        }
        const cl = g.call || {};
        if (cl.n && cl.n !== seenC) {
          seenC = cl.n; const seat = g.players.indexOf(cl.uid);
          if (seat >= 0 && st && (cl.seq == null || cl.seq === st.seq)) apply(seat, { t: cl.t });
        }
        plan();
      }
      return {
        start: () => startRound(null), onRoom, act: (seat, a) => { const ev = apply(seat, a); plan(); return ev; },
        stop: () => { clearTimeout(botT); clearTimeout(afkT); clearTimeout(catchT); clearTimeout(nextT); }
      };
    })();
    let iEnded = false;

    let lockSeq = -1, lockCall = -1;
    function send(a) {
      const seq = g.pv ? g.pv.seq : 0;
      if (isHost()) { if (!dealer.act(mySeat(), a)) toast('That move isn’t allowed right now'); return; }
      if (lockSeq === seq) return;
      lockSeq = seq;
      net.update(gid, { intent: { uid: me(), t: a.t, card: a.card || '', color: a.color || '', last: !!a.last, n: Date.now() + Math.random(), seq } }).catch((e) => { lockSeq = -1; toast(friendlyError(e)); });
    }
    function call(a) {
      const seq = g.pv ? g.pv.seq : 0;
      if (isHost()) { dealer.act(mySeat(), a); return; }
      if (lockCall === seq) return;
      lockCall = seq;
      net.update(gid, { call: { uid: me(), t: a.t, n: Date.now() + Math.random(), seq } }).catch((e) => { lockCall = -1; toast(friendlyError(e)); });
    }
    function lobby() {
      const box = $('#sc-body'); if (!box) return;
      const ps = seats();
      const humans = ps.filter((p) => !isBot(p.uid)).length;
      const offer = isHost() && !g.invitee && humans < 2 && whenOffer(gid, () => draw());
      const sig = ps.map((p) => p.uid + ':' + p.name).join('|') + '|' + offer + '|' + g.host + '|' + member() + '|' + g.mode + '|' + fillBots();
      if (box.dataset.lsig === sig) {
        clearTimeout(lobby.t);
        if (isHost() && g.quick && humans >= 2) lobby.t = setTimeout(() => startGame(), 12000);
        return;
      }
      box.dataset.lsig = sig;
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" data-copy-code="${esc(gid)}">📋 Copy code</button><button class="btn btn-sm btn-ghost" id="sc-copy">Copy invite link</button></div>
        <p class="muted small">${g.mode === 'round' ? 'Single round' : 'First to 500 points'}</p>
        <h3>${ps.length} / 6 seats</h3><div class="g-seats">${ps.map((p, i) => `<div class="g-seat">${ui.chip(p, p.uid === g.host ? 'host' : '')}${isHost() && isBot(p.uid) ? `<button class="link-btn small" data-rm="${i}">remove</button>` : ''}</div>`).join('')}</div>
        ${isHost() ? `${fillToggleHtml()}<div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px"><button class="btn btn-sm btn-ghost" id="sc-bot" ${ps.length >= 6 ? 'disabled' : ''}>+ Bot</button><button class="btn btn-sm" id="sc-start" ${ps.length < 2 && !fillBots() ? 'disabled' : ''}>Deal cards</button></div>${offer ? offerHtml() : ''}${g.quick && humans >= 2 ? '<p class="muted small center">Quick rooms deal on their own in a few seconds.</p>' : ''}`
          : member() ? '<p class="muted center">Waiting for the host to deal…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="sc-join">Take a seat</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}</div>`;
      $('#sc-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      wireFill(box);
      const bt = $('#sc-bot'); if (bt) bt.onclick = () => addBot();
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeSeat(+b.dataset.rm));
      const stb = $('#sc-start'); if (stb) stb.onclick = () => startGame(false);
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = () => startGame(true);
      const jn = $('#sc-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(lobby.t);
      if (isHost() && g.quick && ps.filter((p) => !isBot(p.uid)).length >= 2) lobby.t = setTimeout(() => startGame(), 12000);
    }
    async function addBot() {
      const used = new Set(g.players);
      const k = [1, 2, 3, 4, 5].find((i) => !used.has('cpu' + i)); if (!k) return;
      const nm = seatName(k - 1);
      try { await net.update(gid, { players: [...g.players, 'cpu' + k], names: [...g.names, nm], unames: [...g.unames, ''], colors: [...g.colors, ''] }); } catch (e) { toast(friendlyError(e)); }
    }
    async function removeSeat(i) {
      const f = (a) => a.filter((_, j) => j !== i);
      try { await net.update(gid, { players: f(g.players), names: f(g.names), unames: f(g.unames), colors: f(g.colors) }); } catch (e) { toast(friendlyError(e)); }
    }
    async function startGame(force) {
      if (!isHost() || g.status !== 'waiting') return;
      clearTimeout(lobby.t);
      const players = [...g.players], names = [...g.names], unames = [...g.unames], colors = [...g.colors];
      if (force || fillBots()) while (players.length < 4) { const k = players.length; players.push('cpu' + k); names.push(seatName(k)); unames.push(''); colors.push(''); }
      if (players.length < 2) { toast('Waiting for a real player. You can fill empty seats with bots.'); return; }
      try {
        if (players.length !== g.players.length) { await net.update(gid, { players, names, unames, colors }); g = { ...g, players, names, unames, colors }; }
        await dealer.start(); net.leaveQueue('starcards', '', gid);
      } catch (e) { toast(friendlyError(e)); }
    }
    function draw() {
      if (g.status === 'waiting') { lobby(); return; }
      if (!g.pv) { const b = $('#sc-body'); if (b) b.innerHTML = '<div class="spinner"></div>'; return; }
      const pv = g.pv, seat = mySeat();
      const key = pv.turn + ':' + pv.seq;
      if (key !== lastTurnKey) lastTurnKey = key;
      const left = Math.max(0, TURN_S - Math.floor((net.serverNow() - (tsMs(g.turnAt) || net.serverNow())) / 1000));
      paint({ seats: seats(), mySeat: seat, pv, hand: seat >= 0 ? hand.hand || [] : [], drawn: hand.drawn, timerLeft: pv.roundWinner < 0 ? left : null, verified, msg: eventMsg(pv.ev, seats()) }, { send, call });
      const acts = $('#g-actions');
      if (!acts) return;
      acts.innerHTML = g.status === 'done' ? `<a class="btn btn-sm btn-ghost" href="#/games">Games</a>` : `<button class="btn btn-sm btn-ghost" id="sc-copy2">Share link</button><a class="btn btn-sm btn-ghost" href="#/games">Leave</a>`;
      const c2 = $('#sc-copy2'); if (c2) c2.onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
    }
    async function verify() {
      const last = (g.seeds || [])[(g.seeds || []).length - 1];
      if (!last || verified && verified.round === last.round) return;
      const h = await C.sha256(last.seed);
      let ok = h === last.hash && (!hashSeen[last.round] || hashSeen[last.round] === last.hash);
      let text = ok ? 'The revealed seed matches the hash published at the deal' : 'The revealed seed does not match the published hash';
      const mine = myDealt[last.round];
      if (ok && mine) {
        const d = C.deal(last.seed, g.players.length).hands[mySeat()];
        ok = JSON.stringify(d) === JSON.stringify(mine);
        text = ok ? 'Seed matches its hash, and re-shuffling it gives exactly the hand you were dealt' : 'Your dealt hand doesn’t match the revealed shuffle';
      }
      verified = { round: last.round, ok, text };
      draw();
    }
    let prevSeq = -1, prevRoundWinner = -1;
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This room is gone. <a href="#/games">Games</a></div>'; return; }
      g = ng;
      if (g.seedHash && g.pv) hashSeen[g.pv.round] = hashSeen[g.pv.round] || g.seedHash;
      if (member() && g.status !== 'done' && !stopHb) stopHb = net.heartbeat(gid);
      if (member() && !unsubHand) unsubHand = net.fs.onSnapshot(net.fs.doc(db, 'games', gid, 'hands', me()), (s) => {
        if (!s.exists()) return;
        hand = s.data();
        if (hand.dealt && hand.round && !myDealt[hand.round]) myDealt[hand.round] = hand.dealt;
        draw();
      }, () => {});
      if (member() && !isHost() && g.status === 'active' && g.hb && g.hb[g.host] && net.serverNow() - tsMs(g.hb[g.host]) > 40000
          && g.players.filter((u) => !isBot(u) && u !== g.host)[0] === me()) {
        net.fs.updateDoc(net.fs.doc(db, 'games', gid), { host: me(), [`hb.${me()}`]: net.fs.serverTimestamp() }).catch(() => {});
      }
      if (g.status === 'waiting' && ui.signedIn() && !member() && g.players.length < 6 && !online.tried) { online.tried = true; net.join(gid).catch(() => {}); }
      if (g.pv && g.pv.seq !== prevSeq) {
        if (prevSeq >= 0 && !isHost()) soundFor(g.pv.ev);
        prevSeq = g.pv.seq;
      }
      draw();
      if (g.seeds && g.seeds.length) verify();
      if (g.pv && g.pv.roundWinner >= 0 && prevRoundWinner < 0 && g.status === 'active') roundModal(g.pv, seats(), mySeat(), {});
      prevRoundWinner = g.pv ? g.pv.roundWinner : -1;
      if (g.status === 'done' && !ended) {
        ended = true; if (stopHb) { stopHb(); stopHb = null; }
        const botGame = onlyBots(g.players, me());
        if (member() && !botGame) setTimeout(() => net.recordResult(g, iEnded), iEnded ? 0 : 2500);
        if (member() && botGame) ui.addCpuResult('starcards', g.winnerUid === me() ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l');
        const mw = g.players.indexOf(g.winnerUid);
        roundModal({ ...g.pv, matchWinner: mw }, seats(), mySeat(), { final: true, buttons: [{ label: 'New room', onClick: async () => { try { location.hash = '#/game/' + await net.createGame('starcards', g.mode); } catch (e) { toast(friendlyError(e)); } } }, { label: 'Back to games', href: '#/games' }] });
      }
      dealer.onRoom();
    }, (e) => toast(friendlyError(e)));
    online.tried = false;
    S.unsubs.push(unsub);
  }
  return { local, online };
}
