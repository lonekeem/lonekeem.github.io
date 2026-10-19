// Studio Trivia: a 2-8 player party quiz in a room with a code (or solo vs computer players).
// The room host's client is the quiz master: it picks questions, reads answers when the timer
// ends, scores by speed (500 for right + up to 500 for fast) and advances rounds.
import { shuffle } from './cards.js';
import { isBot, tsMs } from './net.js';

const ROUNDS = 10, ROUND_S = 15, REVEAL_MS = 4200;
const BOT_NAMES = ['Nova', 'Echo', 'Pixel', 'Juno', 'Orbit', 'Lyric', 'Comet'];
let BANK = null;
async function bank() {
  if (!BANK) BANK = fetch(new URL('./questions.json', import.meta.url)).then((r) => r.json()).then((j) => j.questions);
  return BANK;
}
const order = (seedKey) => shuffle([0, 1, 2, 3], seedKey);
const pickQs = (n) => shuffle([...Array(150).keys()], String(Math.random())).slice(0, n);
const pointsFor = (ms) => 500 + Math.max(0, Math.round(500 * (1 - ms / (ROUND_S * 1000))));

export function createTrivia(ctx) {
  const { S, db, main, esc, $, toast, friendlyError, requireAuth, stale, ui } = ctx;
  const { net } = ui;

  function frame(title, back) {
    ui.shell(esc(title), `<div class="tv" id="tv"><div class="g-fx"></div><div id="tv-body"></div></div>${ui.emoteBar()}<div class="g-actions" id="g-actions"></div>`, back);
  }
  const letters = ['A', 'B', 'C', 'D'];
  function scoreList(players, scores, gained = {}) {
    const rows = players.map((p) => ({ ...p, s: scores[p.uid] || 0, g: gained[p.uid] || 0 })).sort((a, b) => b.s - a.s);
    return `<ol class="tv-scores">${rows.map((r, i) => `<li class="${r.uid === ui.myUid() || r.me ? 'me' : ''}"><span class="tv-rank">${i + 1}</span>${ui.chip(r)}<span class="tv-pts"><b>${r.s}</b>${r.g ? `<i>+${r.g}</i>` : ''}</span></li>`).join('')}</ol>`;
  }
  // Renders one state of the quiz. v = { phase, round, q, ord, picked, deadline, players, scores, gained, rightIdx }
  function paint(v, onPick) {
    const box = $('#tv-body'); if (!box) return;
    if (v.phase === 'q' || v.phase === 'reveal') {
      const reveal = v.phase === 'reveal';
      box.innerHTML = `<div class="tv-top"><span class="g-tag">${esc(v.q.cat)}</span><span class="muted small">Question ${v.round + 1} of ${ROUNDS}</span><span class="tv-clock" id="tv-clock"></span></div>
        <div class="tv-bar"><span id="tv-bar"></span></div>
        <h2 class="tv-q">${esc(v.q.q)}</h2>
        <div class="tv-choices">${v.ord.map((ai, k) => `<button class="tv-c c${k} ${v.picked === ai ? 'picked' : ''} ${reveal && ai === 0 ? 'right' : ''} ${reveal && v.picked === ai && ai !== 0 ? 'wrong' : ''}" data-a="${ai}" ${v.picked != null || reveal ? 'disabled' : ''}><span class="tv-l">${letters[k]}</span>${esc(v.q.a[ai])}</button>`).join('')}</div>
        ${reveal ? `<div class="tv-reveal">${v.picked === 0 ? `<b class="ok">Right! +${v.gained[ui.myUid() || 'me'] || 0}</b>` : v.picked == null ? '<b>Time’s up</b>' : '<b class="no">Not quite</b>'}</div>${scoreList(v.players, v.scores, v.gained)}`
          : `<p class="muted small center">${v.picked != null ? 'Locked in! Waiting for the others…' : 'Faster right answers score more.'}</p>`}`;
      box.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => { ui.sfx.play('tap'); onPick(+b.dataset.a); });
      const clock = $('#tv-clock'), bar = $('#tv-bar');
      const step = () => {
        if (!clock.isConnected) return;
        const left = Math.max(0, v.deadline - Date.now());
        clock.textContent = reveal ? '' : Math.ceil(left / 1000) + 's';
        bar.style.width = reveal ? '0%' : `${(left / (ROUND_S * 1000)) * 100}%`;
        bar.classList.toggle('low', left < 5000);
        if (!reveal && left > 0) requestAnimationFrame(step);
      };
      step();
    }
  }
  function final(players, scores, isMe, buttons) {
    const box = $('#tv-body'); if (!box) return;
    const rows = players.map((p) => ({ ...p, s: scores[p.uid] || 0 })).sort((a, b) => b.s - a.s);
    box.innerHTML = `<div class="tv-final"><h2>Final scores</h2>
      <div class="tv-podium">${rows.slice(0, 3).map((r, i) => `<div class="pod p${i}">${ui.STAR()}<b>${esc(r.name)}</b><span>${r.s}</span></div>`).join('')}</div>${scoreList(players, scores)}</div>`;
    const top = rows[0]; const tie = rows.length > 1 && rows[1].s === top.s;
    const win = !tie && isMe(top);
    ui.resultModal({ title: tie ? 'Draw at the top!' : win ? 'You win!' : `${top.name} wins`, sub: `${top.s} points`, win, buttons });
  }

  // ------------------------------------------------------------ vs computer
  async function local(params) {
    const qsAll = await bank();
    const lvl = params.lvl === 'easy' ? 'easy' : 'hard';
    frame('Studio Trivia', '#/games/trivia');
    ui.wireEmotes(main, '', () => '');
    const names = shuffle(BOT_NAMES, String(Math.random())).slice(0, 3);
    const players = [{ uid: 'me', name: 'You', me: true }, ...names.map((n, i) => ({ uid: 'cpu' + (i + 1), name: n }))];
    const scores = Object.fromEntries(players.map((p) => [p.uid, 0]));
    const picks = pickQs(ROUNDS); let round = 0, alive = true;
    S.unsubs.push(() => (alive = false));
    $('#g-actions').innerHTML = `<a class="btn btn-sm btn-ghost" href="#/games/trivia">Leave</a>`;
    const playRound = () => {
      if (!alive) return;
      const qi = picks[round], q = qsAll[qi], ord = order('local:' + qi + ':' + round), start = Date.now();
      const ans = {};
      const botTimers = players.filter((p) => p.uid !== 'me').map((p) => setTimeout(() => {
        const acc = lvl === 'easy' ? 0.45 : 0.78;
        ans[p.uid] = { choice: Math.random() < acc ? 0 : 1 + Math.floor(Math.random() * 3), ms: Date.now() - start };
        check();
      }, 1800 + Math.random() * (lvl === 'easy' ? 11000 : 8000)));
      let done = false;
      const v = { phase: 'q', round, q, ord, picked: null, deadline: start + ROUND_S * 1000, players, scores, gained: {} };
      const check = () => { if (!done && Object.keys(ans).length === players.length) end(); };
      const end = () => {
        if (done || !alive) return; done = true; botTimers.forEach(clearTimeout); clearTimeout(tm);
        const gained = {};
        for (const [uid, a] of Object.entries(ans)) if (a.choice === 0) { gained[uid] = pointsFor(a.ms); scores[uid] += gained[uid]; }
        Object.assign(v, { phase: 'reveal', gained });
        ui.sfx.play(ans.me && ans.me.choice === 0 ? 'right' : 'wrong');
        paint(v, () => {});
        setTimeout(() => {
          if (!alive) return;
          round++;
          if (round < ROUNDS) playRound();
          else {
            const top = Object.entries(scores).sort((a, b) => b[1] - a[1]);
            ui.addCpuResult('trivia', top[0][0] === 'me' && top[0][1] !== top[1][1] ? 'w' : top[0][1] === scores.me ? 'd' : 'l');
            final(players, scores, (r) => r.uid === 'me', [{ label: 'Play again', onClick: () => local(params) }, { label: 'Back to games', href: '#/games' }]);
          }
        }, REVEAL_MS);
      };
      const tm = setTimeout(end, ROUND_S * 1000);
      paint(v, (choice) => { ans.me = { choice, ms: Date.now() - start }; v.picked = choice; paint(v, () => {}); check(); });
    };
    playRound();
  }

  // ------------------------------------------------------------ online room
  async function online(g0, token) {
    const qsAll = await bank();
    const gid = g0.id;
    let g = g0, stopHb = null, answers = {}, unsubAns = null, hostTimer = 0, roundSeenAt = 0, lastKey = '', ended = false, autoStart = 0;
    const me = () => ui.myUid();
    const isHost = () => g.host === me();
    const member = () => g.players.includes(me());
    frame('Studio Trivia', '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    ui.wireEmotes(main, gid, names);
    const players = () => g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
    S.unsubs.push(() => { clearTimeout(hostTimer); clearTimeout(autoStart); if (stopHb) stopHb(); if (unsubAns) unsubAns(); });

    function lobby() {
      const box = $('#tv-body'); if (!box) return;
      const ps = players();
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn btn-sm btn-ghost" id="tv-copy">Copy invite link</button></div>
        <h3>${ps.length} / 8 players</h3><div class="g-seats">${ps.map((p) => ui.chip(p, p.uid === g.host ? 'host' : '')).join('')}</div>
        ${isHost() ? `<button class="btn btn-block" id="tv-start" ${ps.length < 2 ? 'disabled' : ''}>${ps.length < 2 ? 'Waiting for at least 2 players' : 'Start the quiz'}</button>${g.quick && ps.length >= 2 ? '<p class="muted small center">Quick rooms start on their own in a few seconds.</p>' : ''}`
          : member() ? '<p class="muted center">Waiting for the host to start…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="tv-join">Join room</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}</div>`;
      $('#tv-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      const st = $('#tv-start'); if (st) st.onclick = () => start();
      const jn = $('#tv-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(autoStart);
      if (isHost() && g.quick && ps.length >= 2) autoStart = setTimeout(() => start(), 12000);
    }
    async function start() {
      if (!isHost() || g.status !== 'waiting') return;
      clearTimeout(autoStart);
      try {
        await net.update(gid, { status: 'active', round: 0, phase: 'q', qs: pickQs(ROUNDS), roundAt: net.fs.serverTimestamp(), scores: Object.fromEntries(g.players.map((u) => [u, 0])), reveal: {} });
        net.leaveQueue('trivia', '', gid);
      } catch (e) { toast(friendlyError(e)); }
    }
    // Host: watch answers, close the round when everyone answered or time is up.
    function hostLoop() {
      if (!isHost() || g.status !== 'active') { if (unsubAns) { unsubAns(); unsubAns = null; } return; }
      if (!unsubAns) unsubAns = net.fs.onSnapshot(net.fs.collection(db, 'games', gid, 'answers'), (qs) => {
        answers = {}; qs.forEach((d) => (answers[d.id] = d.data())); hostCheck();
      }, () => {});
      hostCheck();
    }
    function hostCheck() {
      clearTimeout(hostTimer);
      if (!isHost() || g.status !== 'active') return;
      if (g.phase === 'q') {
        const got = g.players.filter((u) => answers[u] && answers[u].round === g.round).length;
        const left = roundSeenAt + (ROUND_S + 1) * 1000 - Date.now();
        if (got >= g.players.length || left <= 0) closeRound();
        else hostTimer = setTimeout(hostCheck, Math.min(left, 1000));
      } else if (g.phase === 'reveal') {
        const left = roundSeenAt + REVEAL_MS - Date.now();
        hostTimer = setTimeout(nextRound, Math.max(0, left));
      }
    }
    async function closeRound() {
      const scores = { ...(g.scores || {}) }, gained = {};
      const r0 = tsMs(g.roundAt);
      for (const u of g.players) {
        const a = answers[u];
        if (a && a.round === g.round && a.choice === 0) { gained[u] = pointsFor(Math.max(0, tsMs(a.at) - r0)); scores[u] = (scores[u] || 0) + gained[u]; }
      }
      try { await net.update(gid, { phase: 'reveal', scores, reveal: { round: g.round, gained } }); } catch (e) { console.warn(e); }
    }
    async function nextRound() {
      if (g.phase !== 'reveal') return;
      if (g.round + 1 < ROUNDS) {
        try { await net.update(gid, { round: g.round + 1, phase: 'q', roundAt: net.fs.serverTimestamp(), reveal: {} }); } catch (e) { console.warn(e); }
      } else {
        const rows = Object.entries(g.scores || {}).sort((a, b) => b[1] - a[1]);
        const tie = rows.length > 1 && rows[0][1] === rows[1][1];
        try { await net.update(gid, { status: 'done', winnerUid: tie ? 'draw' : rows[0][0], endReason: tie ? 'draw' : 'win' }); iEnded = true; } catch (e) { console.warn(e); }
      }
    }
    let iEnded = false;
    async function pick(choice) {
      v.picked = choice; paint(v, () => {});
      try { await net.fs.setDoc(net.fs.doc(db, 'games', gid, 'answers', me()), { round: g.round, choice, at: net.fs.serverTimestamp() }); }
      catch (e) { toast('Too late for that one'); }
    }
    let v = {};
    function render() {
      $('#g-actions').innerHTML = member() && g.status !== 'done' ? `<a class="btn btn-sm btn-ghost" href="#/games">Leave room</a>` : `<a class="btn btn-sm btn-ghost" href="#/games">Games</a>`;
      if (g.status === 'waiting') { lobby(); return; }
      if (g.status === 'done') {
        if (!ended) {
          ended = true; if (stopHb) { stopHb(); stopHb = null; }
          if (member()) setTimeout(() => net.recordResult(g, iEnded), iEnded ? 0 : 2500);
          final(players(), g.scores || {}, (r) => r.uid === me(), [{ label: 'New room', onClick: async () => { try { location.hash = '#/game/' + await net.createGame('trivia', ''); } catch (e) { toast(friendlyError(e)); } } }, { label: 'Back to games', href: '#/games' }]);
        }
        return;
      }
      const key = g.round + ':' + g.phase;
      if (key !== lastKey) {
        roundSeenAt = Date.now(); lastKey = key;
        const qi = g.qs[g.round], q = qsAll[qi];
        const prevPick = v.round === g.round ? v.picked : null;
        v = { phase: g.phase, round: g.round, q, ord: order(gid + ':' + qi), picked: prevPick, deadline: roundSeenAt + ROUND_S * 1000, players: players(), scores: g.scores || {}, gained: (g.reveal && g.reveal.gained) || {} };
        if (g.phase === 'q') { v.picked = null; ui.sfx.play('pop'); }
        if (g.phase === 'reveal') ui.sfx.play(v.picked === 0 ? 'right' : 'wrong');
        paint(v, member() ? pick : () => {});
      }
      hostLoop();
    }
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This room is gone. <a href="#/games">Games</a></div>'; return; }
      g = ng;
      if (member() && g.status !== 'done' && !stopHb) stopHb = net.heartbeat(gid);
      // Take over as host if the host's heartbeat went quiet.
      if (member() && !isHost() && g.status !== 'done' && g.hb && g.hb[g.host] && Date.now() - tsMs(g.hb[g.host]) > 40000 && g.players.indexOf(me()) === g.players.findIndex((u) => u !== g.host && (!g.hb[u] || Date.now() - tsMs(g.hb[u]) < 40000))) {
        net.fs.updateDoc(net.fs.doc(db, 'games', gid), { host: me(), [`hb.${me()}`]: net.fs.serverTimestamp() }).catch(() => {});
      }
      if (g.status === 'waiting' && ui.signedIn() && !member() && !g.invitee && g.players.length < 8 && !online.tried) { online.tried = true; net.join(gid).catch(() => {}); }
      render();
    }, (e) => toast(friendlyError(e)));
    online.tried = false;
    S.unsubs.push(unsub);
  }
  return { local, online };
}
