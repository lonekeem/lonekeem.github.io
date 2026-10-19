// Star Cards: 2-6 player shedding game. Online, the room host's client deals and referees:
// the shuffled pile + seed live in games/{code}/hands/_dealer (host-only), each hand lives in
// games/{code}/hands/{uid} (only that player can read it), and players send intents. The seed's
// SHA-256 is published when a round is dealt and the seed itself when it ends, so every player can
// re-run the shuffle and check their own deal. Computer players fill empty seats.
import * as C from './cards.js';
import { isBot, tsMs } from './net.js';

const TURN_S = 30;
const BOT_NAMES = ['Nova', 'Echo', 'Pixel', 'Juno', 'Orbit', 'Lyric'];
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
  let lastSeq = -1, lastTop = '', armed = false;
  function paint(v, h) {
    const box = $('#sc-body'); if (!box) return;
    const pv = v.pv, me = v.mySeat;
    const myTurn = me >= 0 && pv.turn === me && pv.roundWinner < 0;
    const playable = myTurn ? (pv.drew ? (v.drawn && v.hand.includes(v.drawn) && canPlayPv(pv, v.drawn) ? [v.drawn] : []) : v.hand.filter((c) => canPlayPv(pv, c))) : [];
    const order = []; for (let k = 1; k < v.seats.length; k++) order.push(((me < 0 ? 0 : me) + k) % v.seats.length);
    if (me < 0) order.unshift(0);
    const opp = order.map((s) => {
      const p = v.seats[s], n = pv.counts[s];
      return `<div class="sc-opp ${pv.turn === s && pv.roundWinner < 0 ? 'on' : ''} ${pv.exposed === s ? 'exposed' : ''}" data-seat="${s}">${ui.chip(p)}<div class="sc-fan">${Array.from({ length: Math.min(n, 8) }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div><span class="sc-n">${n}</span>${n === 1 && pv.called && pv.called[s] ? '<span class="sc-ls">LAST STAR!</span>' : ''}${pv.target ? `<span class="sc-score">${pv.scores[s]}</span>` : ''}${pv.turn === s && v.timerLeft != null && pv.roundWinner < 0 ? `<span class="g-timer ${v.timerLeft <= 8 ? 'low' : ''}">${v.timerLeft}s</span>` : ''}</div>`;
    }).join('');
    const newTop = pv.top !== lastTop || pv.seq !== lastSeq;
    const canCatch = pv.exposed >= 0 && pv.exposed !== me && me >= 0 && pv.roundWinner < 0;
    const showLast = me >= 0 && pv.roundWinner < 0 && ((myTurn && v.hand.length === 2 && !pv.drew) || pv.exposed === me);
    box.innerHTML = `
      <div class="sc-opps">${opp}</div>
      <div class="sc-table" style="--cur:${SUIT[pv.color]}">
        <div class="sc-dir ${pv.dir < 0 ? 'ccw' : ''}" aria-label="Direction">${ICON.F}</div>
        <button class="sc-pile" id="sc-draw" ${myTurn && !pv.drew ? '' : 'disabled'} aria-label="Draw a card">${back()}${back('b2')}${back('b3')}<span class="sc-pile-n">${pv.deckCount}</span></button>
        <div class="sc-discard">${cardHtml(pv.top, { cls: newTop ? 'land' : '', attrs: 'tabindex="-1" disabled' })}<span class="sc-ring" title="Current colour: ${C.COLOR_NAME[pv.color]}"></span></div>
        <div class="sc-msg" id="sc-msg">${esc(v.msg || '')}</div>
      </div>
      <div class="sc-me ${myTurn ? 'on' : ''}">
        <div class="sc-me-bar">${me >= 0 ? `${ui.chip(v.seats[me])}<span class="sc-n">${v.hand.length} cards</span>${pv.target ? `<span class="sc-score">${pv.scores[me]} pts</span>` : ''}${myTurn && v.timerLeft != null ? `<span class="g-timer ${v.timerLeft <= 8 ? 'low' : ''}">${v.timerLeft}s</span>` : ''}` : '<span class="muted small">You’re watching</span>'}
          <span class="spacer"></span>${v.verified ? `<span class="sc-ver ${v.verified.ok ? 'ok' : 'bad'}" title="${esc(v.verified.text)}">${v.verified.ok ? '✓ deal verified' : '⚠ deal mismatch'}</span>` : ''}</div>
        <div class="sc-btns">
          ${showLast ? `<button class="sc-last ${armed ? 'armed' : ''}" id="sc-last">${ui.STAR()} LAST STAR!</button>` : ''}
          ${canCatch ? `<button class="sc-catch" id="sc-catch">Catch ${esc(v.seats[pv.exposed].name)}! +2</button>` : ''}
          ${myTurn && pv.drew && playable.length ? '<button class="btn btn-sm btn-ghost" id="sc-pass">Keep it &amp; pass</button>' : ''}
        </div>
        <div class="sc-hand" style="--n:${v.hand.length}">${v.hand.map((c, i) => cardHtml(c, { cls: `${playable.includes(c) ? 'can' : myTurn ? 'dim' : ''} ${c === v.drawn && pv.drew ? 'fresh' : ''}`, attrs: `data-i="${i}" style="--i:${i}" ${playable.includes(c) ? '' : 'aria-disabled="true"'}` })).join('')}</div>
        <p class="muted small center sc-hint">${me < 0 ? '' : pv.roundWinner >= 0 ? '' : myTurn ? (pv.drew ? 'You drew. Play it or keep it.' : playable.length ? `Play a ${C.COLOR_NAME[pv.color].toLowerCase()} card, a match, or a Star Wild${v.hand.length === 2 ? ' (tap LAST STAR! first)' : ''}.` : 'No match. Tap the pile to draw.') : `${esc(v.seats[pv.turn].name)}’s turn`}</p>
      </div>`;
    if (newTop) { lastSeq = pv.seq; lastTop = pv.top; }
    box.querySelectorAll('.sc-hand [data-i]').forEach((b) => b.onclick = async () => {
      const c = v.hand[+b.dataset.i];
      if (!playable.includes(c)) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }
      let color;
      if (C.isWild(c)) { color = await pickColor(); if (!color) return; }
      const last = armed && v.hand.length === 2; armed = false;
      ui.sfx.play('card');
      h.send({ t: 'play', card: c, color, last });
    });
    const d = $('#sc-draw'); if (d) d.onclick = () => { ui.sfx.play('deal'); h.send({ t: 'draw' }); };
    const ps = $('#sc-pass'); if (ps) ps.onclick = () => h.send({ t: 'pass' });
    const ls = $('#sc-last'); if (ls) ls.onclick = () => {
      ui.sfx.play('star'); ui.burst(ls, 8);
      if (pv.exposed === me || v.hand.length === 1) h.call({ t: 'last' });
      else { armed = !armed; ls.classList.toggle('armed', armed); toast(armed ? 'LAST STAR! armed: now play your card' : 'LAST STAR! off'); }
    };
    const ct = $('#sc-catch'); if (ct) ct.onclick = () => { ui.sfx.play('pop'); h.call({ t: 'catch' }); };
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
      ui.resultModal({ title: st.matchWinner === mySeat ? 'You win the match!' : `${seats[st.matchWinner].name} wins`, sub: st.target ? `First to ${st.target}: ${st.scores[st.matchWinner]} points` : `+${st.roundPoints} points`, win: st.matchWinner === mySeat, buttons });
      return;
    }
    toast(win ? `You won the round! +${st.roundPoints}` : `${seats[w].name} won the round (+${st.roundPoints})`);
    if (win) ui.burst($('.sc-table'), 16);
    if (onNext) onNext();
  }

  // ------------------------------------------------------------ vs computer
  function local(params) {
    const lvl = params.lvl === 'easy' ? 'easy' : 'hard';
    const bots = Math.max(1, Math.min(5, parseInt(params.bots, 10) || 3));
    const target = params.mode === 'round' ? 0 : 500;
    frame('Star Cards', '#/games/starcards');
    ui.wireEmotes(main, '', () => '');
    const seats = [{ uid: ui.myUid() || '', name: 'You', uname: S.profile ? S.profile.username : '', color: S.profile ? S.profile.color : '' },
      ...C.shuffle(BOT_NAMES, String(Math.random())).slice(0, bots).map((n, i) => ({ uid: 'cpu' + (i + 1), name: n }))];
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
        if (catcher > 0) catchT = setTimeout(() => { if (alive && st.exposed === ex && Math.random() < (lvl === 'hard' ? 0.85 : 0.4)) doAct(catcher, { t: 'catch' }); }, 2200 + Math.random() * 1500);
      }
      if (st.turn !== 0) timer = setTimeout(() => { if (!alive) return; doAct(st.turn, C.aiAction(st, st.turn, lvl)); }, 750 + Math.random() * 600);
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
    S.unsubs.push(() => { clearInterval(tick); if (stopHb) stopHb(); if (unsubHand) unsubHand(); dealer.stop(); });

    // ---------------- dealer (runs only on the host's client)
    const dealer = (() => {
      let st = null, seenI = 0, seenC = 0, chain = Promise.resolve(), botT = 0, afkT = 0, catchT = 0, nextT = 0, loading = false, written = {}, exposedSeen = -1;
      const save = (events, extra = {}) => {
        const snap = JSON.parse(JSON.stringify(st));
        chain = chain.then(async () => {
          const b = net.fs.writeBatch(db);
          const pv = { ...C.publicView(snap), ev: events.slice(-3) };
          const { dealt, ...gextra } = extra;
          b.update(net.fs.doc(db, 'games', gid), { pv, turnAt: net.fs.serverTimestamp(), updatedAt: net.fs.serverTimestamp(), ...gextra });
          b.set(net.fs.doc(db, 'games', gid, 'hands', '_dealer'), { s: JSON.stringify({ st: snap, seenI, seenC }) });
          g.players.forEach((uid, seat) => {
            if (isBot(uid)) return;
            const data = { hand: snap.hands[seat], seat, drawn: snap.drew && snap.turn === seat ? snap.drawn : null, round: snap.round };
            const key = JSON.stringify(data);
            if (written[uid] === key && !extra.status) return;
            written[uid] = key;
            if (extra.dealt) data.dealt = snap.hands[seat];
            b.set(net.fs.doc(db, 'games', gid, 'hands', uid), data, { merge: true });
          });
          await b.commit();
        }).catch((e) => { console.warn('deal write', e.code || e.message); written = {}; });
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
        if (isBot(who)) botT = setTimeout(() => { if (st && isBot(g.players[st.turn])) { apply(st.turn, C.aiAction(st, st.turn, 'hard')); plan(); } }, 900 + Math.random() * 700);
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
        if (it.n && it.n !== seenI) { seenI = it.n; const seat = g.players.indexOf(it.uid); if (seat >= 0) apply(seat, { t: it.t, card: it.card, color: it.color, last: !!it.last }); }
        const cl = g.call || {};
        if (cl.n && cl.n !== seenC) { seenC = cl.n; const seat = g.players.indexOf(cl.uid); if (seat >= 0) apply(seat, { t: cl.t }); }
        plan();
      }
      return {
        start: () => startRound(null), onRoom, act: (seat, a) => { const ev = apply(seat, a); plan(); return ev; },
        stop: () => { clearTimeout(botT); clearTimeout(afkT); clearTimeout(catchT); clearTimeout(nextT); }
      };
    })();
    let iEnded = false;

    function send(a) {
      if (isHost()) { if (!dealer.act(mySeat(), a)) toast('That move isn’t allowed right now'); return; }
      net.update(gid, { intent: { uid: me(), t: a.t, card: a.card || '', color: a.color || '', last: !!a.last, n: Date.now() + Math.random() } }).catch((e) => toast(friendlyError(e)));
    }
    function call(a) {
      if (isHost()) { dealer.act(mySeat(), a); return; }
      net.update(gid, { call: { uid: me(), t: a.t, n: Date.now() + Math.random() } }).catch((e) => toast(friendlyError(e)));
    }
    function lobby() {
      const box = $('#sc-body'); if (!box) return;
      const ps = seats();
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <button class="btn btn-sm btn-ghost" id="sc-copy">Copy invite link</button>
        <p class="muted small">${g.mode === 'round' ? 'Single round' : 'First to 500 points'}</p>
        <h3>${ps.length} / 6 seats</h3><div class="g-seats">${ps.map((p, i) => `<div class="g-seat">${ui.chip(p, p.uid === g.host ? 'host' : '')}${isHost() && isBot(p.uid) ? `<button class="link-btn small" data-rm="${i}">remove</button>` : ''}</div>`).join('')}</div>
        ${isHost() ? `<div class="row" style="justify-content:center;flex-wrap:wrap;gap:8px"><button class="btn btn-sm btn-ghost" id="sc-bot" ${ps.length >= 6 ? 'disabled' : ''}>+ Computer player</button><button class="btn btn-sm" id="sc-start" ${ps.length < 2 ? 'disabled' : ''}>Deal cards</button></div>${g.quick && ps.length >= 2 ? '<p class="muted small center">Quick rooms deal on their own in a few seconds.</p>' : ''}`
          : member() ? '<p class="muted center">Waiting for the host to deal…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="sc-join">Take a seat</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}</div>`;
      $('#sc-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const bt = $('#sc-bot'); if (bt) bt.onclick = () => addBot();
      box.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => removeSeat(+b.dataset.rm));
      const stb = $('#sc-start'); if (stb) stb.onclick = () => startGame();
      const jn = $('#sc-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(lobby.t);
      if (isHost() && g.quick && ps.filter((p) => !isBot(p.uid)).length >= 2) lobby.t = setTimeout(() => startGame(), 12000);
    }
    async function addBot() {
      const used = new Set(g.players);
      const k = [1, 2, 3, 4, 5].find((i) => !used.has('cpu' + i)); if (!k) return;
      const nm = BOT_NAMES[k - 1] + ' (CPU)';
      try { await net.update(gid, { players: [...g.players, 'cpu' + k], names: [...g.names, nm], unames: [...g.unames, ''], colors: [...g.colors, ''] }); } catch (e) { toast(friendlyError(e)); }
    }
    async function removeSeat(i) {
      const f = (a) => a.filter((_, j) => j !== i);
      try { await net.update(gid, { players: f(g.players), names: f(g.names), unames: f(g.unames), colors: f(g.colors) }); } catch (e) { toast(friendlyError(e)); }
    }
    async function startGame() {
      if (!isHost() || g.status !== 'waiting' || g.players.length < 2) return;
      clearTimeout(lobby.t);
      try { await dealer.start(); net.leaveQueue('starcards', '', gid); } catch (e) { toast(friendlyError(e)); }
    }
    function draw() {
      if (g.status === 'waiting') { lobby(); return; }
      if (!g.pv) { const b = $('#sc-body'); if (b) b.innerHTML = '<div class="spinner"></div>'; return; }
      const pv = g.pv, seat = mySeat();
      const key = pv.turn + ':' + pv.seq;
      if (key !== lastTurnKey) { lastTurnKey = key; turnSeenAt = Date.now(); }
      const left = Math.max(0, TURN_S - Math.floor((Date.now() - turnSeenAt) / 1000));
      paint({ seats: seats(), mySeat: seat, pv, hand: seat >= 0 ? hand.hand || [] : [], drawn: hand.drawn, timerLeft: pv.roundWinner < 0 ? left : null, verified, msg: eventMsg(pv.ev, seats()) }, { send, call });
      $('#g-actions').innerHTML = g.status === 'done' ? `<a class="btn btn-sm btn-ghost" href="#/games">Games</a>` : `<button class="btn btn-sm btn-ghost" id="sc-copy2">Share link</button><a class="btn btn-sm btn-ghost" href="#/games">Leave</a>`;
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
      if (member() && !isHost() && g.status === 'active' && g.hb && g.hb[g.host] && Date.now() - tsMs(g.hb[g.host]) > 40000
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
        if (member()) setTimeout(() => net.recordResult(g, iEnded), iEnded ? 0 : 2500);
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
