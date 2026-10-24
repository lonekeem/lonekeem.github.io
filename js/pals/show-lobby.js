// Kemy Challenge Show lobby: Solo vs Bots, Quick Match (fills public rooms up to 30, overflow opens a new room),
// Create Show (code + invite via Messages), Join with Code. The room shows everyone's Pal, a ready check and an
// automatic 10 s countdown once enough players are ready (host can also start early). Bots can fill small rooms.
import { createShowNet, palSnap, cleanCode, MAX_ROOM, ZTABS, zSayIdx, zText, safeName } from './show-net.js';
import { renderQuickChat } from './emote-wheel.js';
import { getActivePal } from './core.js';
const CSS = `.sl{max-width:640px;margin:0 auto;padding:14px;color:#fff}.sl-card{background:linear-gradient(160deg,#ff6b9a 0%,#8a55dc 45%,#2b1d55 100%);border-radius:22px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.3)}
.sl h2{margin:0 0 4px;font-size:26px}.sl .sub{opacity:.9;margin:0 0 12px}.sl-btns{display:grid;gap:10px}.sl-b{min-height:62px;border:0;border-radius:18px;font-size:19px;font-weight:800;display:flex;align-items:center;gap:12px;padding:0 18px;cursor:pointer;color:#2b1d55;background:#ffd23f;text-align:left;text-decoration:none}
.sl-b small{display:block;font-size:13px;font-weight:600;opacity:.75}.sl-b.alt{background:#7ee08a}.sl-b.alt2{background:#8fd8ff}.sl-b.ghost{background:rgba(255,255,255,.14);color:#fff}
.sl-join{display:flex;gap:8px}.sl-join input{flex:1;min-width:0;min-height:56px;border-radius:14px;border:2px solid #ffd23f;background:#140d30;color:#fff;font-size:24px;letter-spacing:6px;text-transform:uppercase;text-align:center;font-weight:800}
.sl-code{font-size:38px;font-weight:900;letter-spacing:8px;text-align:center;background:#140d30;border-radius:16px;padding:8px;margin:6px 0}.sl-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0}
.sl-row button,.sl-row label{min-height:48px;border-radius:14px;border:0;padding:0 14px;font-weight:800;background:rgba(255,255,255,.14);color:#fff;display:flex;align-items:center;gap:6px}
.sl-ps{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px;margin:12px 0}.sl-p{background:rgba(255,255,255,.1);border-radius:14px;padding:6px;text-align:center;border:3px solid transparent;font-size:13px}.sl-p.rdy{border-color:#7ee08a}
.sl-p canvas{width:72px;height:72px;display:block;margin:0 auto}.sl-p b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sl-say{display:inline-block;margin-top:3px;background:#fff;color:#2b1d55;border-radius:10px;padding:2px 7px;font-weight:800;font-size:12px}
.sl-cd{text-align:center;font-size:22px;font-weight:900;margin:6px 0;min-height:1.3em}.sl-qc{margin-top:8px;background:#2b1d55;border-radius:14px;padding:8px}.sl-err{color:#ffe0ea;font-weight:700;min-height:1.2em;margin:8px 0 0}
.sl-inv{display:grid;gap:6px;margin-top:8px}.sl-inv button{min-height:48px;border-radius:12px;border:0;background:#3d2a7a;color:#fff;font-weight:700;display:flex;justify-content:space-between;align-items:center;padding:0 14px}
.sl-how{background:rgba(0,0,0,.2);border-radius:16px;padding:10px 14px;margin-top:12px;font-size:14px}.sl-how li{margin:3px 0}
@media (orientation:landscape) and (max-height:500px){body:has(.sl) .app-header,body:has(.sl) .bottom-nav,body:has(.sl) .site-footer{display:none!important}body:has(.sl) .app-main{padding:6px 8px 8px}.sl{padding:6px}.sl h2{font-size:20px}.sl .sub{margin-bottom:8px}.sl-b{min-height:44px;font-size:16px;padding:0 12px}.sl-join input{min-height:44px;font-size:18px}.sl-how{max-height:22vh;overflow:auto}}`;
const COUNTDOWN = 10;
export function createShowLobby(ctx) {
  const { S, db, main, esc, toast } = ctx; let sess = null, starting = false;
  const css = () => { if (!document.getElementById('sl-css')) { const s = document.createElement('style'); s.id = 'sl-css'; s.textContent = CSS; document.head.appendChild(s); } };
  async function meInfo() { const pal = await getActivePal(db, S.user.uid).catch(() => null); if (!pal) return null; return { name: await safeName((S.profile && S.profile.displayName) || 'Player'), pal: palSnap(pal), rawPal: pal }; }
  const game = async () => { const m = await import('./show.js'); return (ctx.show = ctx.show || m.createShowGame(ctx)); };
  async function page(q = {}) {
    css(); if (sess && !starting) { await sess.leave(); sess = null; }
    const me = await meInfo(); if (!me) { main.innerHTML = '<section class="sl"><div class="sl-card"><h2>🎪 Kemy Challenge Show</h2><p>Hatch a Pal first, then come back to play!</p><a class="sl-b" href="#/pals">🥚 Go to my Pals</a></div></section>'; return; }
    const net = createShowNet(db, S.user.uid);
    main.innerHTML = `<section class="sl"><div class="sl-card"><h2>🎪 Kemy Challenge Show</h2><p class="sub">Up to 30 Pals, 6 silly rounds, 1 champion! Starring Sunny Bloom 🌻 and your host, Hoot 🦉.</p>
      <div class="sl-btns"><button class="sl-b alt2" data-a="quick">⚡ <span>Quick Match<small>Jump into an open show (up to 30 players)</small></span></button>
      <button class="sl-b alt" data-a="create">🎟️ <span>Create a Show<small>Get a code and invite friends</small></span></button>
      <div class="sl-join"><input id="sl-code" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Show code" value="${esc(cleanCode(q.join))}"><button class="sl-b ghost" data-a="join">🔑 Join</button></div>
      <button class="sl-b" data-a="solo">🤖 <span>Solo vs Bots<small>Practice show with 9 bot Pals</small></span></button>
      <button class="sl-b ghost" data-a="casual">🌻 <span>Casual Freeze Dash<small>Caught? Just go back to the start. No pressure!</small></span></button></div>
      <p class="sl-err" role="alert"></p>
      <div class="sl-how"><b>How to play</b><ol><li>🌻 <b>Freeze Dash</b>: move on GREEN, freeze when Sunny Bloom turns (RED). Reach the finish!</li><li>🍪 <b>Cookie Carve</b>: trace the shape without cracking it.</li><li>🪢 <b>Tug Splash</b>: tap PULL on the beat with your team.</li><li>🔮 <b>Marble Match</b>: toss closest to the hole vs your partner.</li><li>🫧 <b>Bubble Bridge</b>: hop the tiles, one in each pair pops!</li><li>👑 <b>Bumper Summit</b>: bump others off the shrinking summit.</li><li>📱 Turn your phone sideways for a bigger view.</li></ol>Out? You bubble-poof to the 📣 Cheer Zone and keep watching. Earn 💎 for every round you survive + a champion bonus.</div></div></section>`;
    const err = (t) => (main.querySelector('.sl-err').textContent = t || '');
    const busy = async (fn) => { main.querySelectorAll('button').forEach((b) => (b.disabled = true)); try { await fn(); } catch (e) { err(e.code === 'permission-denied' ? 'Could not join that show.' : e.message || 'Something went wrong'); main.querySelectorAll('button').forEach((b) => (b.disabled = false)); } };
    main.querySelector('[data-a=solo]').onclick = async () => (await game()).open({ pal: me.rawPal, name: me.name, bots: 9 });
    main.querySelector('[data-a=casual]').onclick = async () => (await game()).open({ pal: me.rawPal, name: me.name, bots: 5, casual: true, plan: ['rlgl'] });
    main.querySelector('[data-a=create]').onclick = () => busy(async () => room(await net.create(me, false), me));
    main.querySelector('[data-a=quick]').onclick = () => busy(async () => room(await net.quick(me), me));
    main.querySelector('[data-a=join]').onclick = () => busy(async () => { const c = cleanCode(main.querySelector('#sl-code').value); if (c.length !== 5) throw new Error('Codes have 5 letters.'); room(await net.join(c, me), me); });
    if (q.join && cleanCode(q.join).length === 5) main.querySelector('[data-a=join]').click();
  }
  function room(code, me) {
    const uid = S.user.uid; sess = createShowNet(db, uid).session(code); starting = false; let fill = true, cdEnd = 0;
    main.innerHTML = `<section class="sl"><div class="sl-card"><h2>🎟️ Show room</h2><p class="sub">Share the code! 2-30 players. When enough Pals are ready, a 10-second countdown starts.</p>
      <div class="sl-code" data-code>${code}</div><div class="sl-row"><button data-x="copy">📋 Copy</button><button data-x="invite">✉️ Invite</button><button data-x="qc">💬 Chat</button><button data-x="leave">🚪 Leave</button></div><div class="sl-qc" hidden></div><div class="sl-inv" hidden></div>
      <div class="sl-cd" aria-live="polite"></div><div class="sl-ps"></div>
      <div class="sl-btns"><button class="sl-b alt" data-x="ready">✅ I’m ready!</button><button class="sl-b" data-x="start" hidden>▶ Start now</button><label class="sl-row" data-host-only hidden style="justify-content:flex-start"><input type="checkbox" data-x="fill" checked> 🤖 Fill with bots up to 6 contestants</label></div><p class="sl-err" role="alert"></p></div></section>`;
    const $ = (s) => main.querySelector(s); const drawn = new Map();
    const render = () => { if (!sess) return; const P = sess.players; const L = sess.lobby; if (!L) { $('.sl-err').textContent = 'This show was closed.'; return; }
      const list = Object.entries(P).sort((a, b) => a[1].slot - b[1].slot); const host = L.host; const isHost = host === uid;
      const key = list.map(([u, d]) => u + d.ready + (d.em >= 0 && Date.now() - (d.emAt || 0) < 8000 ? d.emAt : '')).join('|');
      if (key !== render.key) { render.key = key; $('.sl-ps').innerHTML = list.map(([u, d]) => `<div class="sl-p ${d.ready ? 'rdy' : ''}" data-u="${esc(u)}"><canvas width="144" height="144"></canvas><b>${esc(d.name)}${(window.kemyModBadge ? window.kemyModBadge(u) : '')}${u === host ? ' 👑' : ''}${u === uid ? ' (you)' : ''}</b><span>${d.ready ? '✅ Ready' : '⏳'}</span>${d.em >= 0 && Date.now() - (d.emAt || 0) < 8000 && zText(d.em) ? `<br><span class="sl-say">${esc(zText(d.em))}</span>` : ''}</div>`).join('') + `<div class="sl-p" style="opacity:.6;display:flex;align-items:center;justify-content:center">${list.length}/${MAX_ROOM}</div>`;
        main.querySelectorAll('.sl-p[data-u]').forEach((card, i) => { const d = P[card.dataset.u]; const c = card.querySelector('canvas'); const x = c.getContext('2d'); if (i > 15) { x.font = '56px system-ui'; x.textAlign = 'center'; x.fillText('🐾', 72, 92); return; }
          import('./pal3d.js').then((m) => { x.clearRect(0, 0, 144, 144); if (!m.drawPal3D(x, 72, 124, 66, { ...d.pal }, { mode: d.ready ? 'happy' : 'idle', t: performance.now() / 16 })) import('./art.js').then((a) => a.drawPal && a.drawPal(x, 72, 124, 56, d.pal)); }).catch(() => {}); }); }
      void drawn;
      const mine = P[uid]; $('[data-x=ready]').textContent = mine && mine.ready ? '↩️ Not ready' : '✅ I’m ready!';
      const ready = list.filter(([, d]) => d.ready).length; const need = Math.max(2, Math.ceil(list.length * 0.6)); const enough = list.length >= 2 && ready >= need;
      const st = $('[data-x=start]'); st.hidden = !isHost; st.disabled = list.length < 2 && !fill; $('[data-host-only]').hidden = !isHost;
      st.innerHTML = list.length < 2 ? (fill ? '▶ Start with bots' : '⏳ Need 2+ players') : `▶ Start now (${list.length} players)`;
      // countdown: host writes it into the show state (ph 'wait'); everyone sees it
      const ws = sess.state && sess.state.ph === 'wait' ? sess.state : null;
      if (isHost) { if (enough && !cdEnd) { cdEnd = Date.now() + COUNTDOWN * 1000; sess.sendState({ ph: 'wait', rd: 0, left: COUNTDOWN, seq: Date.now() % 1e9 }); } else if (!enough && cdEnd && !starting) { cdEnd = 0; sess.sendState({ ph: 'wait', rd: 0, left: -1, seq: Date.now() % 1e9 }); } }
      if (!isHost && ws && ws.left >= 0 && ws.seq !== render.ws) { render.ws = ws.seq; cdEnd = Date.now() + ws.left * 1000; } if (!isHost && ws && ws.left < 0) cdEnd = 0;
      $('.sl-cd').textContent = cdEnd ? `🎪 Show starts in ${Math.max(0, Math.ceil((cdEnd - Date.now()) / 1000))}…` : list.length < 2 ? 'Waiting for more players…' : `${ready}/${need} ready to start the countdown`;
      if (isHost && cdEnd && Date.now() >= cdEnd && !starting) start();
      if (L.status === 'playing' && !starting && mine) go(); };
    const tick = setInterval(render, 500);
    const off0 = sess.on(render); const onH = () => { if (!/^#\/arcade\/show/.test(location.hash) && sess && !starting) { off(); const s0 = sess; sess = null; s0.leave(); } }; addEventListener('hashchange', onH);
    const off = () => { off0(); clearInterval(tick); removeEventListener('hashchange', onH); };
    const go = async () => { starting = true; off(); const g = await game(); const s0 = sess; sess = null; const n = Object.keys(s0.players).length; g.open({ pal: me.rawPal, net: s0, name: me.name, bots: fill ? Math.max(0, 6 - n) : 0 }); };
    const start = async () => { if (starting) return; starting = true; try { await sess.setLobby({ status: 'playing', n: Math.min(MAX_ROOM, Object.keys(sess.players).length) }); } catch (e) { starting = false; $('.sl-err').textContent = 'Could not start: ' + (e.message || e.code); return; } starting = false; go(); };
    $('[data-x=fill]').onchange = (e) => { fill = e.target.checked; render(); };
    $('[data-x=start]').onclick = () => start();
    $('[data-x=copy]').onclick = () => { navigator.clipboard?.writeText(code).then(() => toast('Code copied: ' + code), () => toast('Code: ' + code)); };
    $('[data-x=leave]').onclick = async () => { off(); const s0 = sess; sess = null; await s0.leave(); page({}); };
    let lastQ = 0; $('[data-x=qc]').onclick = () => { const b = $('.sl-qc'); b.hidden = !b.hidden; if (!b.hidden) renderQuickChat(b, (x) => { const i = zSayIdx(x); if (i < 0 || Date.now() - lastQ < 1200) return; lastQ = Date.now(); b.hidden = true; sess.send({ em: i, emAt: Date.now() }); }, ZTABS); };
    $('[data-x=ready]').onclick = () => { const m = sess.players[uid]; sess.send({ ready: !(m && m.ready) }); };
    $('[data-x=invite]').onclick = () => { toast('Private messages are off. Share this code: ' + code); };
    window.__slobby = { code, get players() { return sess && sess.players; } };
  }
  return { page };
}
