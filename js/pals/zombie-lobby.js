// Pal Zombie Survival lobby: Play Solo, Create Team (short code + invite via Messages), Join with Code, Quick Match.
// Team room shows each player's Pal (with outfit), a ready check, and the host's Start once 2-4 are ready.
import { collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { createNet, palSnap, cleanCode, MAX_TEAM } from './zombie-net.js';
import { getActivePal } from './core.js';
const CSS = `.zl{max-width:620px;margin:0 auto;padding:14px;color:#fff}.zl-card{background:linear-gradient(160deg,#2b1d55,#1b1240);border-radius:22px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.3)}
.zl h2{margin:0 0 4px;font-size:26px}.zl .sub{opacity:.8;margin:0 0 14px}.zl-btns{display:grid;gap:10px}.zl-b{min-height:64px;border:0;border-radius:18px;font-size:19px;font-weight:800;display:flex;align-items:center;gap:12px;padding:0 18px;cursor:pointer;color:#2b1d55;background:#ffd23f;text-align:left}
.zl-b small{display:block;font-size:13px;font-weight:600;opacity:.75}.zl-b.alt{background:#7ee08a}.zl-b.alt2{background:#8fd8ff}.zl-b.ghost{background:rgba(255,255,255,.12);color:#fff}
.zl-join{display:flex;gap:8px}.zl-join input{flex:1;min-height:56px;border-radius:14px;border:2px solid #8a55dc;background:#140d30;color:#fff;font-size:24px;letter-spacing:6px;text-transform:uppercase;text-align:center;font-weight:800}
.zl-code{font-size:40px;font-weight:900;letter-spacing:8px;text-align:center;background:#140d30;border-radius:16px;padding:8px;margin:6px 0}.zl-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0}
.zl-row button{min-height:48px;border-radius:14px;border:0;padding:0 16px;font-weight:800;background:rgba(255,255,255,.14);color:#fff}
.zl-ps{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:12px 0}.zl-p{background:rgba(255,255,255,.08);border-radius:16px;padding:8px;text-align:center;border:3px solid transparent}.zl-p.rdy{border-color:#7ee08a}.zl-p canvas{width:100%;max-width:150px;aspect-ratio:1;display:block;margin:0 auto}
.zl-p b{display:block}.zl-p .st{font-size:13px;font-weight:800}.zl-empty{opacity:.45;display:flex;align-items:center;justify-content:center;min-height:120px;border:2px dashed rgba(255,255,255,.3)}
.zl-err{color:#ffb3c9;font-weight:700;min-height:1.2em;margin:8px 0 0}.zl-inv{display:grid;gap:6px;margin-top:8px}.zl-inv button{min-height:48px;border-radius:12px;border:0;background:#3d2a7a;color:#fff;font-weight:700;display:flex;justify-content:space-between;align-items:center;padding:0 14px}`;
export function createZombieLobby(ctx) {
  const { S, db, main, esc, toast } = ctx; let sess = null, starting = false;
  const css = () => { if (!document.getElementById('zl-css')) { const s = document.createElement('style'); s.id = 'zl-css'; s.textContent = CSS; document.head.appendChild(s); } };
  async function meInfo() { const pal = await getActivePal(db, S.user.uid).catch(() => null); if (!pal) return null; return { name: String((S.profile && S.profile.displayName) || 'Player').slice(0, 30), pal: palSnap(pal), rawPal: pal }; }
  const game = async () => { const m = await import('./zombie.js'); return (ctx.zombie = ctx.zombie || m.createZombieGame(ctx)); };
  async function page(q = {}) {
    css(); if (sess && !starting) { await sess.leave(); sess = null; }
    const me = await meInfo(); if (!me) { main.innerHTML = '<section class="zl"><div class="zl-card"><h2>🧟 Pal Zombie Survival</h2><p>Hatch a Pal first, then come back to play!</p><a class="zl-b" href="#/pals">🥚 Go to my Pals</a></div></section>'; return; }
    const net = createNet(db, S.user.uid);
    main.innerHTML = `<section class="zl"><div class="zl-card"><h2>🧟 Pal Zombie Survival</h2><p class="sub">Splat goofy zombies as ${esc(me.pal.name || 'your Pal')}. Play alone or team up with 2-4 friends!</p>
      <div class="zl-btns"><button class="zl-b" data-a="solo">🎮 <span>Play Solo<small>Just you and your Pal</small></span></button>
      <button class="zl-b alt" data-a="create">👥 <span>Create Team<small>Get a code and invite friends</small></span></button>
      <button class="zl-b alt2" data-a="quick">⚡ <span>Quick Match<small>Join an open team</small></span></button>
      <div class="zl-join"><input id="zl-code" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Team code" value="${esc(cleanCode(q.join))}"><button class="zl-b ghost" data-a="join">🔑 Join</button></div>
      <a class="zl-b ghost" href="#/arcade/armory">🛡️ <span>Zombie Armory<small>Weapons, upgrades and armor</small></span></a></div><p class="zl-err" role="alert"></p></div></section>`;
    const err = (t) => (main.querySelector('.zl-err').textContent = t || '');
    const busy = async (fn) => { main.querySelectorAll('button').forEach((b) => (b.disabled = true)); try { await fn(); } catch (e) { err(e.code === 'permission-denied' ? 'Could not join that team.' : e.message || 'Something went wrong'); main.querySelectorAll('button').forEach((b) => (b.disabled = false)); } };
    main.querySelector('[data-a=solo]').onclick = async () => (await game()).open({ pal: me.rawPal });
    main.querySelector('[data-a=create]').onclick = () => busy(async () => room(await net.create(me, false), me));
    main.querySelector('[data-a=quick]').onclick = () => busy(async () => room(await net.quick(me), me));
    main.querySelector('[data-a=join]').onclick = () => busy(async () => { const c = cleanCode(main.querySelector('#zl-code').value); if (c.length !== 5) throw new Error('Codes have 5 letters.'); room(await net.join(c, me), me); });
    if (q.join && cleanCode(q.join).length === 5) main.querySelector('[data-a=join]').click();
  }
  function room(code, me) {
    const uid = S.user.uid; sess = createNet(db, uid).session(code); starting = false;
    main.innerHTML = `<section class="zl"><div class="zl-card"><h2>👥 Your team</h2><p class="sub">Share this code. 2-4 players, everyone taps Ready, then the host starts.</p>
      <div class="zl-code" data-code>${code}</div><div class="zl-row"><button data-x="copy">📋 Copy code</button><button data-x="invite">✉️ Invite friends</button><button data-x="leave">🚪 Leave</button></div>
      <div class="zl-inv" hidden></div><div class="zl-ps"></div><div class="zl-btns"><button class="zl-b alt" data-x="ready">✅ I’m ready!</button><button class="zl-b" data-x="start" hidden>▶ Start the game</button></div><p class="zl-err" role="alert"></p></div></section>`;
    const $ = (s) => main.querySelector(s); const thumbs = new Map();
    const render = () => { if (!sess) return; const P = sess.players; const L = sess.lobby; if (!L) { $('.zl-err').textContent = 'This team was closed.'; return; }
      const list = Object.entries(P).sort((a, b) => a[1].slot - b[1].slot); const host = L.host;
      $('.zl-ps').innerHTML = [...list.map(([u, d]) => `<div class="zl-p ${d.ready ? 'rdy' : ''}" data-u="${esc(u)}"><canvas width="180" height="180"></canvas><b>${esc(d.name)}${(window.kemyModBadge ? window.kemyModBadge(u) : '')}${u === host ? ' 👑' : ''}${u === uid ? ' (you)' : ''}</b><span class="st">${d.ready ? '✅ Ready' : '⏳ Not ready'}</span></div>`),
        ...Array.from({ length: Math.max(0, MAX_TEAM - list.length) }, () => '<div class="zl-p zl-empty">Waiting for a friend…</div>')].join('');
      main.querySelectorAll('.zl-p[data-u]').forEach((card) => { const d = P[card.dataset.u]; const c = card.querySelector('canvas'); const x = c.getContext('2d');
        import('./pal3d.js').then((m) => { x.clearRect(0, 0, 180, 180); if (!m.drawPal3D(x, 90, 150, 82, { ...d.pal }, { mode: d.ready ? 'happy' : 'idle', t: performance.now() / 16 })) import('./art.js').then((a) => a.drawPal && a.drawPal(x, 90, 150, 70, d.pal)); }).catch(() => {}); });
      const mine = P[uid]; $('[data-x=ready]').textContent = mine && mine.ready ? '↩️ Not ready' : '✅ I’m ready!';
      const allReady = list.length >= 2 && list.every(([, d]) => d.ready); const st = $('[data-x=start]'); st.hidden = host !== uid; st.disabled = !allReady;
      st.innerHTML = allReady ? `▶ Start with ${list.length} players` : list.length < 2 ? '⏳ Need at least 2 players' : '⏳ Waiting for everyone to be ready';
      if (L.status === 'playing' && !starting && mine) go(); };
    const off0 = sess.on(render); const onH = () => { if (!/^#\/arcade\/zombie/.test(location.hash) && sess && !starting) { off(); const s0 = sess; sess = null; s0.leave(); } }; addEventListener('hashchange', onH); const off = () => { off0(); removeEventListener('hashchange', onH); };
    const go = async () => { starting = true; off(); const g = await game(); const s0 = sess; sess = null; g.open({ pal: me.rawPal, net: s0, name: me.name }); };
    $('[data-x=copy]').onclick = () => { navigator.clipboard?.writeText(code).then(() => toast('Code copied: ' + code), () => toast('Code: ' + code)); };
    $('[data-x=leave]').onclick = async () => { off(); const s0 = sess; sess = null; await s0.leave(); page({}); };
    $('[data-x=ready]').onclick = () => { const m = sess.players[uid]; sess.send({ ready: !(m && m.ready) }); };
    $('[data-x=start]').onclick = async () => { const n = Object.keys(sess.players).length; if (n < 2) return; $('[data-x=start]').disabled = true;
      try { sess.sendState({ wave: 0, zs: [], score: 0, kills: {}, dia: {}, over: false, slam: [], seq: 0, n, ts: 0, brk: 2.5, bm: 0 }); await new Promise((r) => setTimeout(r, 400)); await sess.setLobby({ status: 'playing', n }); }
      catch (e) { $('.zl-err').textContent = 'Could not start: ' + (e.message || e.code); $('[data-x=start]').disabled = false; } };
    $('[data-x=invite]').onclick = async () => { const box = $('.zl-inv'); box.hidden = !box.hidden; if (box.hidden) return; box.innerHTML = '<small>Loading your chats…</small>';
      try { const qs = await getDocs(query(collection(db, 'chats'), where('participants', 'array-contains', uid), orderBy('lastAt', 'desc'), limit(8)));
        const others = [...new Set(qs.docs.map((d) => d.data().participants.find((x) => x !== uid)).filter(Boolean))];
        const profs = await Promise.all(others.map((o) => (ctx.getProfile ? ctx.getProfile(o).catch(() => null) : null)));
        box.innerHTML = others.length ? others.map((o, i) => `<button data-to="${esc(o)}">${esc((profs[i] && profs[i].displayName) || 'Friend')}<span>✉️ Invite</span></button>`).join('') : '<small>No chats yet. Share the code instead!</small>';
        box.querySelectorAll('[data-to]').forEach((b) => (b.onclick = async () => { b.disabled = true;
          try { await ctx.sendMessage(b.dataset.to, `🧟 Join my Pal Zombie Survival team! Code ${code} 👉 ${location.origin}${location.pathname}#/arcade/zombie?join=${code}`); b.querySelector('span').textContent = '✓ Sent'; } catch { b.disabled = false; toast('Could not send the invite'); } }));
      } catch { box.innerHTML = '<small>Share the code with your friends!</small>'; } };
    window.__zlobby = { code, get players() { return sess && sess.players; } };
  }
  return { page };
}
