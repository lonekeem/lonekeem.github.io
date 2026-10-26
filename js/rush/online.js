// Kemy Hill Rush online: 2-4 racers on the same seed and stage. Rooms reuse games/{CODE} (net.js); each racer posts
// games/{CODE}/car/{uid} a few times a second; everyone draws the others from those docs with name tags.
import { STAGES, STAGE, VEHICLE, RACE_LEN } from './data.js';
import { rushStore } from './store.js';
import { KEMY } from './driver.js';
import { loadCss, music, myPal, paint, rushDias } from './index.js';
import { codeBoxHtml } from '../games/code-join.js';

const CD = 4000; const LIMIT = { sprint: 150, classic: 260 }; const ORD = ['', '1st', '2nd', '3rd', '4th'];
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
export const parseMode = (m) => { const [s, len] = String(m || '').split('-'); return { stage: STAGE[s] ? s : 'countryside', len: len === 'classic' ? 'classic' : 'sprint' }; };
const order = (rows, winner) => { const o = rows.slice().sort((a, b) => (b.fin - a.fin) || (a.fin ? a.ft - b.ft : b.d - a.d)); const wi = o.findIndex((r) => r.uid === winner); if (wi > 0) o.unshift(o.splice(wi, 1)[0]); return o; };

export async function online(ctx, g0, token) {
  const { ui, esc, toast, main, S, db } = ctx; const net = ui.net, fs = net.fs; loadCss(); music();
  const gid = g0.id, me = ui.myUid(); let g = g0, cars = {}, game = null, finalS = null, finalOk = false, soonT = 0, stopHb = null, ended = false, shown = false, joinTried = false, myRes = null, sendT = 0, lastSend = 0, sending = false, queueT = 0, autoT = 0, twoAt = 0, doneT = 0, postN = 1, alive = true;
  const st = rushStore(me); const pal = (await myPal(ctx)) || KEMY; if (ctx.stale && ctx.stale(token)) return;
  const member = () => g.players.includes(me), isHost = () => g.host === me;
  const carRef = (u) => fs.doc(db, 'games', gid, 'car', u);
  S.unsubs.push(() => { alive = false; clearInterval(sendT); clearInterval(queueT); clearTimeout(autoT); clearTimeout(doneT); clearTimeout(soonT); if (stopHb) stopHb(); if (game) game.stop(); });
  // cars (positions, Pals, finish) for everyone in the room
  const unCars = fs.onSnapshot(fs.collection(db, 'games', gid, 'car'), (qs) => {
    qs.docChanges().forEach((ch) => { const u = ch.doc.id, d = ch.doc.data(); cars[u] = d;
      if (game && u !== me && g.players.includes(u)) { const i = g.players.indexOf(u); game.setRemote(u, { name: g.names[i] || 'Racer', pal: d.pal || KEMY, vid: VEHICLE[d.vid] ? d.vid : 'scout', i }); game.pushSample(u, d); } });
    if (g.status === 'waiting') draw(); else maybeFinish();
  }, () => {});
  S.unsubs.push(unCars);
  let wrote = false;
  async function writeCar(extra) { const now = Date.now(); if (sending || now - lastSend < 260) return false; sending = true; lastSend = now;
    try { await fs.setDoc(carRef(me), { ...extra, at: fs.serverTimestamp() }, { merge: true }); return true; } catch (e) { return false; } finally { sending = false; } }
  const seatCar = () => writeCar({ x: 0, y: 0, a: 0, v: 0, d: 0, fin: false, ft: 0, st: 0, pal, vid: st.d.vid }).then((ok) => { if (ok) wrote = true; });

  function draw() {
    if (!alive || game) return; const m = parseMode(g.mode), s = STAGE[m.stage];
    if (g.status === 'waiting') {
      const can = isHost() && g.players.length >= 2; const host = isHost();
      ui.shell('Kemy Hill Rush · Online', `<div class="rush-page rush-wait">
        ${codeBoxHtml(gid)}
        <div class="rush-hero" style="aspect-ratio:16/6"><canvas id="rw-hc"></canvas></div>
        <p><b>${s.emoji} ${esc(s.name)}</b> · ${RACE_LEN[m.len]} m race · <span class="muted">${esc(s.quirk)}</span></p>
        ${host ? `<label class="muted small" for="rw-st">Stage (you pick for everyone)</label>
          <select id="rw-st" class="input">${STAGES.filter((x) => st.d.stages.includes(x.id) || x.id === m.stage).map((x) => `<option value="${x.id}" ${x.id === m.stage ? 'selected' : ''}>${x.emoji} ${esc(x.name)}</option>`).join('')}</select>
          <div class="rush-modes"><button type="button" class="btn btn-sm ${m.len === 'sprint' ? '' : 'btn-ghost'}" data-len="sprint">Sprint ${RACE_LEN.sprint} m</button><button type="button" class="btn btn-sm ${m.len === 'classic' ? '' : 'btn-ghost'}" data-len="classic">Long ${RACE_LEN.classic} m</button></div>` : ''}
        <h3 class="rush-h">Racers ${g.players.length} / 4</h3>
        <div class="rush-wait" id="rw-seats">${g.players.map((u, i) => `<div class="rush-seat"${u !== me ? ` data-kf-uid="${esc(u)}" data-kf-name="${esc(g.names[i] || '')}"` : ''}><canvas data-u="${u}"></canvas><span>${esc(g.names[i])}${u === g.host ? ' 👑' : ''}${u === me ? ' (you)' : ''}<br><small class="muted">${esc((VEHICLE[(cars[u] || {}).vid] || VEHICLE.scout).name)}</small></span></div>`).join('')}</div>
        ${member() ? (host ? `<button type="button" class="btn btn-block" id="rw-go" ${can ? '' : 'disabled'}>${can ? '🏁 Start race' : 'Waiting for a friend to join…'}</button>${g.quick ? '<p class="muted small">Quick match starts by itself when racers join.</p>' : ''}` : '<p class="muted">Waiting for the host to start…</p>')
          : ui.signedIn() ? '<p class="muted">Joining…</p>' : '<button type="button" class="btn btn-block" id="rw-sign">Sign in to race</button>'}
        <a class="btn btn-ghost btn-block" href="#/games/rush">Leave</a></div>`, '#/games/rush');
      paint(main.querySelector('#rw-hc'), { stage: s, camX: 30, ax: 0.5, ay: 0.7, t: 2, cars: g.players.slice(0, 4).map((u, i) => ({ vid: VEHICLE[(cars[u] || {}).vid] ? cars[u].vid : 'scout', pal: (cars[u] || {}).pal || KEMY, x: 30 - (g.players.length - 1) * 2.6 + i * 5.2, s: 0.8 })) });
      main.querySelectorAll('.rush-page [data-u]').forEach((cv) => { const c = cars[cv.dataset.u] || {}; paint(cv, { stage: s, camX: 30, ax: 0.5, ay: 0.78, ppm: 9, t: 2, cars: [{ vid: VEHICLE[c.vid] ? c.vid : 'scout', pal: c.pal || KEMY, x: 30 }] }); });
      const sel = main.querySelector('#rw-st'); if (sel) sel.onchange = () => net.update(gid, { mode: sel.value + '-' + m.len }).catch((e) => toast(ctx.friendlyError(e)));
      main.querySelectorAll('.rush-page [data-len]').forEach((b) => b.onclick = () => net.update(gid, { mode: m.stage + '-' + b.dataset.len }).catch((e) => toast(ctx.friendlyError(e))));
      const go = main.querySelector('#rw-go'); if (go) go.onclick = () => start();
      const si = main.querySelector('#rw-sign'); if (si) si.onclick = () => ctx.requireAuth();
    } else if (g.status === 'active' && !member()) {
      ui.shell('Kemy Hill Rush · Online', `<div class="rush-page"><p>🏁 This race already started.</p><div class="rush-res">${order(g.players.map((u, i) => ({ uid: u, name: g.names[i], ...(cars[u] || { d: 0 }) })), '').map((r, i) => `<div><span>${ORD[i + 1]} · ${esc(r.name)}</span><span>${r.fin ? (+r.ft).toFixed(1) + ' s' : (r.d | 0) + ' m'}</span></div>`).join('')}</div><a class="btn btn-block" href="#/games/rush">Back to Kemy Hill Rush</a></div>`, '#/games/rush');
    }
  }
  async function start() {
    if (!isHost() || g.status !== 'waiting' || g.players.length < 2) return; const b = main.querySelector('#rw-go'); if (b) b.disabled = true;
    try { await net.update(gid, { status: 'active', roundAt: fs.serverTimestamp(), round: (Math.random() * 1e9) | 0 }); net.leaveQueue('rush', g.mode, gid); } catch (e) { toast(ctx.friendlyError(e)); if (b) b.disabled = false; }
  }
  // quick match: keep our room on the queue until 4 are in, start by itself at 4 (or 2+ after 15 s)
  function hostLobby() {
    if (!isHost() || g.status !== 'waiting' || !g.quick) { clearInterval(queueT); queueT = 0; clearTimeout(autoT); autoT = 0; return; }
    const post = () => fs.setDoc(fs.doc(db, 'gameQueue', 'rush'), { gid, uid: me, at: fs.serverTimestamp() }).catch(() => {});
    if (g.players.length < 4 && !queueT) queueT = setInterval(() => { if (g.status === 'waiting' && g.players.length < 4) post(); }, 20000);
    // someone took our queue spot: put the room straight back so the 3rd and 4th racers land here too
    if (g.players.length > 1 && g.players.length < 4 && g.players.length !== postN) { postN = g.players.length; post(); }
    if (g.players.length >= 4) { clearTimeout(autoT); autoT = setTimeout(start, 1500); return; }
    if (g.players.length >= 2) { if (!twoAt) twoAt = Date.now(); if (!autoT) autoT = setTimeout(start, Math.max(500, 15000 - (Date.now() - twoAt))); }
  }
  async function race() {
    const m = parseMode(g.mode), s = STAGE[m.stage]; const { startRun } = await import('./game.js'); if (!alive || game) return;
    const startAt = Date.now() + (ms(g.roundAt) + CD - net.serverNow()); const lim = LIMIT[m.len];
    game = await startRun({ stage: s, vid: st.d.vid, ups: st.ups(st.d.vid), pal, name: 'You', seed: g.round | 0, mode: 'online', raceLen: RACE_LEN[m.len], timeLimit: lim, startAt: Math.max(Date.now() + 800, startAt), sfx: ui.sfx, lag: 520,
      onQuit: () => { location.hash = '#/games/rush'; }, onRestart: () => { location.hash = '#/games/rush'; },
      onEnd: (r) => { myRes = r; finalS = game ? game.state() : null; sendFinal(); if (game) game.pop(r.fin ? 'Waiting for the others…' : 'Race over!', 'big'); maybeFinish(); } });
    g.players.forEach((u, i) => { if (u === me) return; const c = cars[u] || {}; game.setRemote(u, { name: g.names[i] || 'Racer', pal: c.pal || KEMY, vid: VEHICLE[c.vid] ? c.vid : 'scout', i }); if (c.at) game.pushSample(u, c); });
    sendT = setInterval(() => { if (!game || myRes) return; if (Date.now() < startAt) return; writeCar(game.state()); }, 300);
  }
  async function sendFinal() { clearInterval(sendT); if (!finalS) { finalOk = true; return; } for (let i = 0; i < 8 && alive; i++) { await new Promise((r) => setTimeout(r, i ? 450 : 320)); if (await writeCar(finalS)) { finalOk = true; maybeFinish(); return; } } finalOk = true; maybeFinish(); }
  const deadline = () => ms(g.roundAt) + CD + LIMIT[parseMode(g.mode).len] * 1000 + 6000;
  function rows() { return g.players.map((u, i) => { const c = cars[u] || {}; const mine = u === me && myRes; return { uid: u, name: g.names[i] || 'Racer', fin: mine ? !!myRes.fin : !!c.fin, ft: mine ? +myRes.ft || 0 : +c.ft || 0, d: mine ? myRes.dist : +c.d || 0 }; }); }
  function maybeFinish() {
    if (!game || shown || !myRes) return;
    const all = g.players.every((u) => u === me || (cars[u] || {}).fin); const late = net.serverNow() > deadline();
    if (g.status === 'done') return showSoon();
    if (isHost() && (all || late) && !ended && finalOk) { ended = true; const o = order(rows(), ''); net.update(gid, { status: 'done', winnerUid: o[0].uid, endReason: all ? 'finish' : 'time' }).catch(() => { ended = false; }); }
    if (!doneT) doneT = setTimeout(() => { doneT = 0; if (!shown && (all || net.serverNow() > deadline() + 8000)) show(true); else maybeFinish(); }, all ? 9000 : Math.max(2000, deadline() - net.serverNow() + 9000));
  }
  // give the last car writes a moment to arrive before the final standings are drawn
  function showSoon() { if (!soonT && !shown) soonT = setTimeout(() => show(), 1200); }
  function show(local) {
    if (shown) return; shown = true; if (stopHb) { stopHb(); stopHb = null; }
    const o = order(rows(), g.status === 'done' ? g.winnerUid : ''); const place = o.findIndex((r) => r.uid === me) + 1; const win = g.status === 'done' ? g.winnerUid === me : false;
    const got = st.addStars(Math.round((myRes ? myRes.stars : 0) + ([0, 60, 35, 20, 10][place] || 0))); const dias = !local && ui.signedIn() && myRes && myRes.dias ? rushDias(ctx, st, me, myRes.dias) : 0;
    if (game) { game.stop(); game = null; }
    if (g.status === 'done' && !local) setTimeout(() => net.recordResult(g), 1500);
    ui.resultModal({ title: win ? 'You win!' : `${ORD[place]} place`, win, pts: myRes ? myRes.dist : 0, noReward: !!local,
      html: `<h2>${win ? '🏆 You win!' : `🏁 You came ${ORD[place]}`}</h2><p>${esc(STAGE[parseMode(g.mode).stage].name)} · ${RACE_LEN[parseMode(g.mode).len]} m</p>
        <div class="rush-res">${o.map((r, i) => `<div class="${r.uid === me ? 'me' : ''}"><span>${ORD[i + 1]} · ${esc(r.name)}${r.uid === me ? ' (you)' : ''}</span><span>${r.fin ? r.ft.toFixed(2) + ' s' : (r.d | 0) + ' m'}</span></div>`).join('')}<div><span>Rush Stars</span><span>⭐ +${got}</span></div>${dias ? `<div><span>Diamonds</span><span>💎 +${dias}</span></div>` : ''}</div>`,
      buttons: [{ label: '🔁 New room', onClick: async () => { try { location.hash = '#/game/' + await net.createGame('rush', g.mode); } catch (e) { toast(ctx.friendlyError(e)); } } }, { label: 'Menu', href: '#/games/rush' }] });
    main.innerHTML = '<div class="empty">Race over. <a href="#/games/rush">Back to Kemy Hill Rush</a></div>';
  }
  const unsub = net.watchGame(gid, (ng) => {
    if (!alive) return; if (!ng) { main.innerHTML = '<div class="empty">This room is gone. <a href="#/games/rush">Kemy Hill Rush</a></div>'; return; }
    const prev = g; g = { ...ng, id: gid };
    if (member() && g.status !== 'done' && !stopHb) stopHb = net.heartbeat(gid);
    if (g.status === 'waiting' && ui.signedIn() && !member() && g.players.length < 4 && !joinTried) { joinTried = true; net.join(gid).catch((e) => toast(ctx.friendlyError(e))); }
    if (member() && g.status === 'waiting' && !wrote) seatCar();
    hostLobby();
    if (g.status === 'active' && member() && !game && !myRes) { race(); return; }
    if (g.status === 'done') { if (game || myRes) { if (!myRes && game) { const s0 = game.state(); myRes = { ...s0, dist: s0.d, ...game.tally() }; } showSoon(); } else if (!shown) { shown = true; ui.shell('Kemy Hill Rush · Online', `<div class="rush-page"><p>🏁 This race is over.</p><div class="rush-res">${order(rows(), g.winnerUid).map((r, i) => `<div><span>${ORD[i + 1]} · ${esc(r.name)}</span><span>${r.fin ? r.ft.toFixed(2) + ' s' : (r.d | 0) + ' m'}</span></div>`).join('')}</div><a class="btn btn-block" href="#/games/rush">Back to Kemy Hill Rush</a></div>`, '#/games/rush'); }
      return; }
    if (prev.status !== g.status || g.status === 'waiting' || !member()) draw();
  }, (e) => toast(ctx.friendlyError(e)));
  S.unsubs.push(unsub);
}
