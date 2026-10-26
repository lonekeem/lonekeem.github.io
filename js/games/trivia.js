// Studio Trivia: a 2-8 player party quiz in a room with a code (or solo vs computer players).
// The room host's client is the quiz master: it picks questions, reads answers when the timer
// ends, scores by speed (500 for right + up to 500 for fast) and advances rounds.
import { shuffle } from './cards.js';
import { isBot, tsMs } from './net.js';
import { normLevel, botPlayer, seatName, triviaRoll, fillToggleHtml, wireFill, fillBots, whenOffer, stopOffer, offerHtml, lastLevel, onlyBots } from './bots.js';
import { syncPlates } from './plates.js';

const ROUNDS = 10, ROUND_S = 15, REVEAL_MS = 4200;
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
  // Renders one state of the quiz. The question card is rebuilt when the question changes.
  // Player chips and the score rows stay put and only change the number that moved.
  let quiz = null, clockRaf = 0;
  function tickClock() {
    cancelAnimationFrame(clockRaf);
    const run = () => {
      const clock = $('#tv-clock'), bar = $('#tv-bar');
      if (!clock || !clock.isConnected || !quiz) return;
      const v = quiz, reveal = v.phase === 'reveal';
      const left = Math.max(0, v.deadline - Date.now());
      const label = reveal ? '' : Math.ceil(left / 1000) + 's';
      if (clock.textContent !== label) clock.textContent = label;
      const w = reveal ? '0%' : (left / (ROUND_S * 1000)) * 100 + '%';
      if (bar && bar.style.width !== w) bar.style.width = w;
      if (bar) bar.classList.toggle('low', !reveal && left < 5000);
      if (!reveal && left > 0) clockRaf = requestAnimationFrame(run);
    };
    run();
  }
  function paint(v, onPick) {
    const box = $('#tv-body'); if (!box) return;
    if (v.phase !== 'q' && v.phase !== 'reveal') return;
    quiz = v;
    const reveal = v.phase === 'reveal';
    let qwrap = box.querySelector('#tv-qwrap');
    const qsig = v.round + '|' + v.q.q;
    if (!qwrap || qwrap.dataset.q !== qsig) {
      box.innerHTML = `<div id="tv-qwrap" data-q="${esc(qsig)}"><div class="tv-top"><span class="g-tag">${esc(v.q.cat)}</span><span class="muted small">Question ${v.round + 1} of ${ROUNDS}</span><span class="tv-clock" id="tv-clock"></span></div>
        <div class="tv-bar"><span id="tv-bar"></span></div>
        <h2 class="tv-q">${esc(v.q.q)}</h2>
        <div class="tv-choices">${v.ord.map((ai, k) => `<button class="tv-c c${k}" data-a="${ai}" data-k="${k}"><span class="tv-l">${letters[k]}</span>${esc(v.q.a[ai])}</button>`).join('')}</div></div>
        <div id="tv-reveal"></div><div id="tv-plates"></div><p class="muted small center" id="tv-foot"></p>`;
      box.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => { ui.sfx.play('tap'); onPick(+b.dataset.a); });
    }
    box.querySelectorAll('.tv-c').forEach((b) => {
      const ai = +b.dataset.a, k = +b.dataset.k;
      const cls = `tv-c c${k}${v.picked === ai ? ' picked' : ''}${reveal && ai === 0 ? ' right' : ''}${reveal && v.picked === ai && ai !== 0 ? ' wrong' : ''}`;
      if (b.className !== cls) b.className = cls;
      const dis = v.picked != null || reveal;
      if (b.disabled !== dis) b.disabled = dis;
    });
    const rev = $('#tv-reveal');
    const plates = $('#tv-plates');
    if (reveal) {
      const msg = v.picked === 0 ? `<b class="ok">Right! +${(v.gained && (v.gained[ui.myUid() || 'me'] || v.gained.me)) || 0}</b>` : v.picked == null ? '<b>Time’s up</b>' : '<b class="no">Not quite</b>';
      if (rev.dataset.m !== msg) { rev.dataset.m = msg; rev.innerHTML = `<div class="tv-reveal">${msg}</div>`; }
      plates.className = '';
      let ol = plates.querySelector('.tv-scores');
      if (!ol) { plates.innerHTML = '<ol class="tv-scores"></ol>'; ol = plates.querySelector('.tv-scores'); }
      const rows = v.players.map((p) => ({ ...p, s: (v.scores && v.scores[p.uid]) || 0, g: (v.gained && v.gained[p.uid]) || 0 })).sort((a, b) => b.s - a.s);
      syncPlates(ol, rows.map((r, i) => ({
        key: r.uid || ('r' + i), tag: 'li', className: (r.uid === ui.myUid() || r.me) ? 'me' : '', person: r,
        lead: [{ key: 'rank', className: 'tv-rank', text: String(i + 1) }],
        bits: [{ key: 'pts', className: 'tv-pts', html: `<b>${r.s}</b>${r.g ? `<i>+${r.g}</i>` : ''}`, sig: r.s + ':' + (r.g || 0) }]
      })));
      const foot = $('#tv-foot'); if (foot && foot.textContent) foot.textContent = '';
    } else {
      if (rev && rev.firstChild) { rev.innerHTML = ''; rev.dataset.m = ''; }
      plates.className = 'tv-who';
      if (plates.querySelector('.tv-scores')) plates.innerHTML = '';
      syncPlates(plates, v.players.map((p, i) => ({ key: p.uid || ('p' + i), kind: 'chip', className: 'gp', person: p })));
      const foot = $('#tv-foot');
      const ft = v.picked != null ? 'Locked in! Waiting for the others…' : 'Faster right answers score more.';
      if (foot && foot.textContent !== ft) foot.textContent = ft;
    }
    tickClock();
  }
  function final(players, scores, isMe, buttons) {
    const box = $('#tv-body'); if (!box) return;
    const rows = players.map((p) => ({ ...p, s: scores[p.uid] || 0 })).sort((a, b) => b.s - a.s);
    box.innerHTML = `<div class="tv-final"><h2>Final scores</h2>
      <div class="tv-podium">${rows.slice(0, 3).map((r, i) => `<div class="pod p${i}">${ui.STAR()}<b>${esc(r.name)}</b>${r.bot || isBot(r.uid) ? '<i class="bot-tag">Bot</i>' : ''}<span>${r.s}</span></div>`).join('')}</div>${scoreList(players, scores)}</div>`;
    const top = rows[0]; const tie = rows.length > 1 && rows[1].s === top.s;
    const win = !tie && isMe(top);
    const vsBot = players.filter((p) => !isMe(p)).every((p) => isBot(p.uid) || p.bot);
    ui.resultModal({ title: tie ? 'Draw at the top!' : win ? 'You win!' : `${top.name} wins`, sub: `${top.s} points`, win, vsBot, buttons, pts: (rows.find(isMe) || {}).s });
  }

  // ------------------------------------------------------------ vs computer
  async function local(params) {
    const qsAll = await bank();
    const lvl = normLevel(params.lvl);
    frame('Studio Trivia', '#/games/trivia');
    ui.wireEmotes(main, '', () => '');
    const players = [{ uid: 'me', name: 'You', me: true, bot: false }, ...Array.from({ length: 3 }, (_, i) => ({ ...botPlayer(i, lvl), me: false }))];
    const scores = Object.fromEntries(players.map((p) => [p.uid, 0]));
    const picks = pickQs(ROUNDS); let round = 0, alive = true;
    S.unsubs.push(() => (alive = false));
    $('#g-actions').innerHTML = `<a class="btn btn-sm btn-ghost" href="#/games/trivia">Leave</a>`;
    const playRound = () => {
      if (!alive) return;
      const qi = picks[round], q = qsAll[qi], ord = order('local:' + qi + ':' + round), start = Date.now();
      const ans = {};
      const botTimers = players.filter((p) => p.uid !== 'me').map((p) => {
        const roll = triviaRoll(lvl);
        return setTimeout(() => { ans[p.uid] = { choice: roll.choice, ms: roll.ms }; check(); }, roll.ms);
      });
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
    let g = g0, stopHb = null, answers = {}, unsubAns = null, hostTimer = 0, lastKey = '', ended = false, autoStart = 0, botPlan = {}, botTimers = [];
    const phaseLeft = () => {
      const start = tsMs(g.phase === 'q' ? g.roundAt : g.updatedAt) || net.serverNow();
      const total = g.phase === 'q' ? (ROUND_S + 1) * 1000 : REVEAL_MS;
      return start + total - net.serverNow();
    };
    async function hostWrite(expect, patch) {
      const ref = net.fs.doc(db, 'games', gid);
      await net.fs.runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists()) { const e = new Error('over'); e.code = 'over'; throw e; }
        const cur = s.data();
        if (expect.status && cur.status !== expect.status) { const e = new Error('stale'); e.code = 'stale'; throw e; }
        if (expect.phase && cur.phase !== expect.phase) { const e = new Error('stale'); e.code = 'stale'; throw e; }
        if (expect.round != null && cur.round !== expect.round) { const e = new Error('stale'); e.code = 'stale'; throw e; }
        tx.update(ref, { ...patch, updatedAt: net.fs.serverTimestamp() });
      });
    }
    const me = () => ui.myUid();
    const isHost = () => g.host === me();
    const member = () => g.players.includes(me());
    frame('Studio Trivia', '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    ui.wireEmotes(main, gid, names);
    const players = () => g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
    S.unsubs.push(() => { clearTimeout(hostTimer); clearTimeout(autoStart); botTimers.forEach(clearTimeout); stopOffer(gid); if (stopHb) stopHb(); if (unsubAns) unsubAns(); });

    function lobby() {
      const box = $('#tv-body'); if (!box) return;
      const ps = players();
      const humans = ps.filter((p) => !isBot(p.uid)).length;
      const offer = isHost() && !g.invitee && humans < 2 && whenOffer(gid, () => render());
      const sig = ps.map((p) => p.uid + ':' + p.name).join('|') + '|' + offer + '|' + g.host + '|' + member() + '|' + fillBots() + '|' + humans;
      if (box.dataset.lsig === sig) {
        clearTimeout(autoStart);
        if (isHost() && g.quick && ps.length >= 2) autoStart = setTimeout(() => start(), 12000);
        return;
      }
      box.dataset.lsig = sig;
      box.innerHTML = `<div class="g-room"><p class="muted small">Room code</p><div class="g-roomcode">${esc(gid)}</div>
        <div class="row" style="justify-content:center;gap:8px;flex-wrap:wrap"><button class="btn btn-sm" data-copy-code="${esc(gid)}">📋 Copy code</button><button class="btn btn-sm btn-ghost" id="tv-copy">Copy invite link</button></div>
        <h3>${ps.length} / 8 players</h3><div class="g-seats">${ps.map((p) => ui.chip(p, p.uid === g.host ? 'host' : '')).join('')}</div>
        ${isHost() ? `${fillToggleHtml()}<button class="btn btn-block" id="tv-start">${humans < 2 && !fillBots() ? 'Waiting for a real player' : 'Start the quiz'}</button>${offer ? offerHtml() : ''}${g.quick && humans >= 2 ? '<p class="muted small center">Quick rooms start on their own in a few seconds.</p>' : ''}`
          : member() ? '<p class="muted center">Waiting for the host to start…</p>'
          : ui.signedIn() ? '<button class="btn btn-block" id="tv-join">Join room</button>' : `<a class="btn btn-block" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to join</a>`}</div>`;
      $('#tv-copy').onclick = async () => { try { await navigator.clipboard.writeText(ui.link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', ui.link(gid)); } };
      wireFill(box);
      const st = $('#tv-start'); if (st) st.onclick = () => start(false);
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = () => start(true);
      const jn = $('#tv-join'); if (jn) jn.onclick = async () => { jn.disabled = true; try { await net.join(gid); } catch (e) { toast(friendlyError(e)); jn.disabled = false; } };
      clearTimeout(autoStart);
      if (isHost() && g.quick && ps.length >= 2) autoStart = setTimeout(() => start(), 12000);
    }
    async function start(force) {
      if (!isHost() || g.status !== 'waiting') return;
      clearTimeout(autoStart);
      const players = [...g.players], names = [...g.names], unames = [...g.unames], colors = [...g.colors];
      if (force || fillBots()) while (players.length < 4) { const i = players.length; players.push('cpu' + i); names.push(seatName(i)); unames.push(''); colors.push(''); }
      if (players.length < 2) { toast('Waiting for a real player. You can fill empty seats with bots.'); return; }
      try {
        await hostWrite({ status: 'waiting' }, { status: 'active', players, names, unames, colors, round: 0, phase: 'q', qs: pickQs(ROUNDS), roundAt: net.fs.serverTimestamp(), scores: Object.fromEntries(players.map((u) => [u, 0])), reveal: {} });
        g = { ...g, players, names, unames, colors };
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
    function planBots() {
      if (!isHost() || g.phase !== 'q' || botPlan[g.round]) return;
      botPlan[g.round] = {};
      for (const u of g.players) if (isBot(u)) {
        const roll = triviaRoll(lastLevel());
        botPlan[g.round][u] = { ...roll, ready: false };
        botTimers.push(setTimeout(() => { if (botPlan[g.round] && botPlan[g.round][u]) botPlan[g.round][u].ready = true; hostCheck(); }, roll.ms));
      }
    }
    function hostCheck() {
      clearTimeout(hostTimer);
      if (!isHost() || g.status !== 'active') return;
      if (g.phase === 'q') {
        planBots();
        const humans = g.players.filter((u) => !isBot(u));
        const got = humans.filter((u) => answers[u] && answers[u].round === g.round).length;
        const roundBots = botPlan[g.round] || {};
        const botsDue = g.players.filter(isBot).every((u) => roundBots[u] && roundBots[u].ready);
        const left = phaseLeft();
        if ((got >= humans.length && botsDue) || left <= 0) closeRound();
        else hostTimer = setTimeout(hostCheck, Math.min(left, 1000));
      } else if (g.phase === 'reveal') {
        const left = phaseLeft();
        hostTimer = setTimeout(nextRound, Math.max(0, left));
      }
    }
    async function closeRound() {
      const scores = { ...(g.scores || {}) }, gained = {};
      const r0 = tsMs(g.roundAt);
      for (const u of g.players) {
        const planned = botPlan[g.round] && botPlan[g.round][u];
        const a = isBot(u) ? (planned || triviaRoll(lastLevel())) : answers[u];
        const choice = a && (a.choice != null ? a.choice : null);
        const onRound = isBot(u) || (answers[u] && answers[u].round === g.round);
        if (onRound && choice === 0) { gained[u] = pointsFor(isBot(u) ? a.ms : Math.max(0, tsMs(a.at) - r0)); scores[u] = (scores[u] || 0) + gained[u]; }
      }
      try { await hostWrite({ phase: 'q', round: g.round }, { phase: 'reveal', scores, reveal: { round: g.round, gained } }); } catch (e) { if (!(e && e.code === 'stale')) console.warn(e); }
    }
    async function nextRound() {
      if (g.phase !== 'reveal') return;
      if (g.round + 1 < ROUNDS) {
        try { await hostWrite({ phase: 'reveal', round: g.round }, { round: g.round + 1, phase: 'q', roundAt: net.fs.serverTimestamp(), reveal: {} }); } catch (e) { if (!(e && e.code === 'stale')) console.warn(e); }
      } else {
        const rows = Object.entries(g.scores || {}).sort((a, b) => b[1] - a[1]);
        const tie = rows.length > 1 && rows[0][1] === rows[1][1];
        try { await hostWrite({ phase: 'reveal', round: g.round }, { status: 'done', winnerUid: tie ? 'draw' : rows[0][0], endReason: tie ? 'draw' : 'win' }); iEnded = true; } catch (e) { if (!(e && e.code === 'stale')) console.warn(e); }
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
      const acts = $('#g-actions');
      if (!acts) return;
      acts.innerHTML = member() && g.status !== 'done' ? `<a class="btn btn-sm btn-ghost" href="#/games">Leave room</a>` : `<a class="btn btn-sm btn-ghost" href="#/games">Games</a>`;
      if (g.status === 'waiting') { lobby(); return; }
      if (g.status === 'done') {
        if (!ended) {
          ended = true; if (stopHb) { stopHb(); stopHb = null; }
          const botGame = onlyBots(g.players, me());
          if (member() && !botGame) setTimeout(() => net.recordResult(g, iEnded), iEnded ? 0 : 2500);
          if (member() && botGame) ui.addCpuResult('trivia', g.winnerUid === me() ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l');
          final(players(), g.scores || {}, (r) => r.uid === me(), [{ label: 'New room', onClick: async () => { try { location.hash = '#/game/' + await net.createGame('trivia', ''); } catch (e) { toast(friendlyError(e)); } } }, { label: 'Back to games', href: '#/games' }]);
        }
        return;
      }
      const key = g.round + ':' + g.phase;
      if (key !== lastKey) {
        lastKey = key;
        const qi = g.qs[g.round], q = qsAll[qi];
        const prevPick = v.round === g.round ? v.picked : null;
        const start = tsMs(g.roundAt) || net.serverNow();
        v = { phase: g.phase, round: g.round, q, ord: order(gid + ':' + qi), picked: prevPick, deadline: Date.now() + (start + ROUND_S * 1000 - net.serverNow()), players: players(), scores: g.scores || {}, gained: (g.reveal && g.reveal.gained) || {} };
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
