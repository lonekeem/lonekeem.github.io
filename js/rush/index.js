// Kemy Hill Rush: menu, stage select, garage, solo drive and vs-computer races. Online rooms are in online.js.
import { GAME_NAME, STAGES, STAGE, VEHICLES, VEHICLE, UPGRADES, MAX_LV, upgradeCost, tuned, DIA_RUN_CAP, DIA_DAY_CAP, COIN_RUN_CAP, COIN_DAY_CAP, RACE_LEN } from './data.js';
import { rushStore } from './store.js';
import { drawScene } from './scene.js';
import { KEMY, CAPY, snap } from './driver.js';

export function loadCss() {
  if (document.getElementById('rush-css')) return;
  const l = document.createElement('link'); l.id = 'rush-css'; l.rel = 'stylesheet'; l.href = 'css/rush.css?v=2'; document.head.appendChild(l);
}
export function music() { import('../gamemusic.js').then(async (m) => { try { await m.mountGameMusic({ corner: 'top-right' }); if (!m.isPlaying()) m.playStation('theme', { volume: 0.18 }); } catch { /* optional */ } }).catch(() => {}); }
const PAL_TTL = 60000; let palCache = { uid: '', at: 0, pal: null };
export async function myPal(ctx) {
  const uid = ctx.S.user && ctx.S.user.uid; if (!uid) return null;
  if (palCache.uid === uid && Date.now() - palCache.at < PAL_TTL) return palCache.pal;
  try { const { getActivePal } = await import('../pals/core.js'); const p = await getActivePal(ctx.db, uid); palCache = { uid, at: Date.now(), pal: snap(p) }; } catch { palCache = { uid, at: Date.now(), pal: null }; }
  return palCache.pal;
}
export const myName = (ctx) => (ctx.S.profile && (ctx.S.profile.displayName || ctx.S.profile.username)) || 'You';
// draw a scene into a canvas sized by CSS (redraws when it first has a size)
export function paint(cv, o) {
  if (!cv) return;
  const go = () => { const r = cv.getBoundingClientRect(); if (!r.width) return false; const dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); try { drawScene(c, r.width, r.height, o); } catch (e) { console.warn('rush scene', e); } return true; };
  if (!go()) requestAnimationFrame(() => go());
}
// Admin / ∞ Pass in Hill Rush. Same trusted check as the shared wallets (inf-pass.js: verified admin account, or the
// infPass/{uid} doc that only the admin can write). Returns '' | 'admin' | 'inf'. Only ever true for the signed-in user.
export async function passOf(uid) {
  if (!uid) return '';
  try { const [m, f] = await Promise.all([import('../inf-pass.js'), import('../firebase-init.js')]); const u = f.auth.currentUser;
    if (!u || u.uid !== uid) return ''; if (m.isAdminUser(u)) return 'admin'; return (await m.hasPass(uid)) ? 'inf' : ''; } catch { return ''; }
}
export const PASS_LABEL = { admin: '👑 Admin pass', inf: '♾️ ∞ Pass' };
const STAT = (v) => [['Power', v.torque / 60], ['Speed', v.speed / 48], ['Grip', v.grip / 1.5], ['Fuel', v.fuel / 70], ['Air control', v.air / 7], ['Bounce', v.hz / 6.5]];
const fmt = (n) => (n === Infinity ? '∞' : Number(n || 0).toLocaleString('en-US'));

const REASON = { fuel: ['⛽ Out of fuel!', 'Grab the fuel cans to keep going.'], crash: ['💫 Bonk!', 'Your Pal bumped their head. Land on your wheels!'], quit: ['Run over', ''], finish: ['🏁 Finish!', ''], time: ['⏱️ Time!', ''] };
export async function page(ctx, b, params, token) {
  const { ui, esc, toast, main } = ctx; loadCss(); music();
  const uid = ui.myUid ? ui.myUid() : (ctx.S.user && ctx.S.user.uid) || '';
  const st = rushStore(uid);
  const [pass, pal0] = await Promise.all([passOf(uid), myPal(ctx)]); let pal = pal0; if (ctx.stale && ctx.stale(token)) return; st.setPass(pass);
  const D = () => st.d; const $ = (s) => main.querySelector(s);
  const bank = () => `<span class="rush-bank" title="Rush Stars buy cars, upgrades and stages">⭐ ${fmt(D().stars)} <small>Rush Stars</small></span>${pass ? `<span class="rush-pass" title="Every car and stage is open, upgrades are free">${PASS_LABEL[pass]} · all open</span>` : ''}`;
  const tap = () => ui.sfx.play('tap');
  if (b === 'garage') return garage(); if (b === 'stages') return stages();
  return menu();

  function menu() {
    const s = STAGE[D().stage], v = VEHICLE[D().vid];
    ui.shell(GAME_NAME, `<div class="rush-page" id="rush">
      <div class="rush-top">${bank()}<span class="muted small">Drive, flip and collect stars!</span></div>
      <div class="rush-hero"><canvas id="rush-hc" aria-label="${esc(v.name)} on ${esc(s.name)}"></canvas>
        <button class="btn rush-go" id="rush-go" type="button">▶ Drive</button></div>
      <div class="rush-modes">
        <button type="button" class="rush-mode go" data-m="solo"><b>🚙 Drive</b><small>${esc(s.name)} · best ${fmt(st.best(s.id))} m</small></button>
        <button type="button" class="rush-mode cpu" data-m="cpu"><b>🤖 Play vs computer</b><small>Race 3 bots to ${RACE_LEN.sprint} m</small></button>
        <button type="button" class="rush-mode on" data-m="online" aria-expanded="false"><b>🌍 Online race</b><small>2–4 players, same hills</small></button>
      </div>
      <div class="rush-on" id="rush-on" hidden>
        <div class="rush-modes">
          <button type="button" class="btn" data-q="1">⚡ Quick match</button>
          <button type="button" class="btn btn-ghost" data-room="sprint">🔑 Make a room (${RACE_LEN.sprint} m)</button>
          <button type="button" class="btn btn-ghost" data-room="classic">🔑 Long race room (${RACE_LEN.classic} m)</button>
        </div>
        <div id="rush-code-f"></div>
        <p class="muted small">Online races use the stage you picked (the room host picks for everyone). Fuel is off, crashes respawn you.</p>
      </div>
      <div class="rush-modes">
        <a class="rush-mode" href="#/games/rush/stages"><b>${s.emoji} Stages</b><small>${D().stages.length} / ${STAGES.length} unlocked</small></a>
        <a class="rush-mode" href="#/games/rush/garage"><b>🔧 Garage</b><small>${esc(v.name)} · ${D().owned.length} / ${VEHICLES.length} cars</small></a>
      </div>
      <p class="muted small">Gas = right pedal or → / D · Brake = left pedal or ← / A · In the air, gas tilts back and brake tilts forward. Land a flip for bonus stars! Don’t bonk your head.</p>
    </div>`, '#/games');
    paint($('#rush-hc'), { stage: s, camX: 34, ax: 0.42, ay: 0.64, cars: [{ vid: v.id, pal, x: 34, ups: st.ups(v.id), mood: 'happy' }], items: [{ t: 'star', x: 40 }, { t: 'star', x: 42 }, { t: 'dia', x: 45, y: undefined }, { t: 'fuel', x: 49 }], t: 2 });
    $('#rush-go').onclick = () => { tap(); solo(); };
    main.querySelectorAll('.rush-page [data-m]').forEach((el) => el.onclick = () => { tap(); const m = el.dataset.m;
      if (m === 'solo') solo(); else if (m === 'cpu') cpu(); else { const p = $('#rush-on'); p.hidden = !p.hidden; el.setAttribute('aria-expanded', String(!p.hidden)); } });
    if (params.do === 'quick' || params.do === 'friend') { const p = $('#rush-on'); if (p) { p.hidden = false; main.querySelector('[data-m=online]')?.setAttribute('aria-expanded', 'true'); } }
    import('../games/code-join.js').then((cj) => { const f = $('#rush-code-f'); if (!f) return; f.innerHTML = cj.codeFormHtml('rush-code', '🎟️ Join with code');
      cj.wireCodeForms(f, { db: ctx.db, getDoc: (r) => ui.net.fs.getDoc(r), doc: (...a) => ui.net.fs.doc(...a), uid: () => uid, toast, needAuth: () => { if (ui.signedIn()) return true; ctx.requireAuth(); return false; } }); });
    const go = async (el, f) => { if (!ui.signedIn()) { ctx.requireAuth(); return; } el.disabled = true; try { location.hash = '#/game/' + await f(); } catch (e) { toast(ctx.friendlyError ? ctx.friendlyError(e) : String(e.message || e)); el.disabled = false; } };
    const modeOf = (len) => STAGE[D().stage].id + '-' + len;
    main.querySelectorAll('.rush-page [data-q]').forEach((el) => el.onclick = () => go(el, () => ui.net.quickMatch('rush', 'countryside-sprint')));
    main.querySelectorAll('.rush-page [data-room]').forEach((el) => el.onclick = () => go(el, () => ui.net.createGame('rush', modeOf(el.dataset.room))));
  }

  function stages() {
    ui.shell('Stages', `<div class="rush-page"><div class="rush-top">${bank()}<span class="muted small">${st.pass ? 'Every world is open with your pass.' : 'Earn Rush Stars to unlock new worlds.'}</span></div>
      <div class="rush-grid" id="rush-sg">${STAGES.map((s) => { const open = st.opened(s.id); return `<button type="button" class="rush-card2 ${open ? '' : 'lock'} ${D().stage === s.id ? 'sel' : ''}" data-s="${s.id}" aria-label="${esc(s.name)}${open ? '' : ', locked, ' + s.cost + ' stars'}">
        <canvas></canvas>${open ? '' : `<span class="lk">🔒 ⭐ ${fmt(s.cost)}</span>`}<b>${s.emoji} ${esc(s.name)}</b><small>${esc(s.quirk)}</small>
        <span class="best">${open ? (st.best(s.id) ? '🏁 Best ' + fmt(st.best(s.id)) + ' m' : 'Not driven yet') : esc(s.blurb)}</span></button>`; }).join('')}</div>
      <a class="btn btn-ghost btn-block" href="#/games/rush">⬅ Back</a></div>`, '#/games/rush');
    const cards = [...main.querySelectorAll('#rush-sg [data-s]')]; let i = 0;
    const next = () => { if (i >= cards.length || !document.body.contains(cards[0])) return; const el = cards[i++], s = STAGE[el.dataset.s]; paint(el.querySelector('canvas'), { stage: s, camX: 30, ppm: 0, ax: 0.42, ay: 0.66, t: 3, cars: [{ vid: D().vid, pal, x: 30, ups: st.ups(D().vid) }], items: [{ t: 'star', x: 35 }, { t: 'dia', x: 38 }] }); setTimeout(next, 16); };
    next();
    cards.forEach((el) => el.onclick = () => { const s = STAGE[el.dataset.s];
      if (st.opened(s.id)) { st.pick('stage', s.id); tap(); location.hash = '#/games/rush'; return; }
      if (D().stars < s.cost) { ui.sfx.play('wrong'); toast(`You need ⭐ ${fmt(s.cost - D().stars)} more Rush Stars for ${s.name}.`); return; }
      if (!confirm(`Unlock ${s.name} for ⭐ ${fmt(s.cost)} Rush Stars?`)) return;
      if (st.unlockStage(s.id)) { ui.sfx.play('cheer'); toast(`${s.emoji} ${s.name} unlocked!`); stages(); } });
  }

  function garage() {
    const vid = params.v && VEHICLE[params.v] ? params.v : D().vid; const v = VEHICLE[vid], own = st.owns(vid), tv = tuned(vid, st.ups(vid));
    ui.shell('Garage', `<div class="rush-page"><div class="rush-top">${bank()}<span class="muted small">Pick a car, then tune it up.</span></div>
      <div class="rush-hero"><canvas id="rush-gc"></canvas></div>
      <div><h3 class="rush-h">${esc(v.name)} <small class="muted">${esc(v.type)}</small></h3>
        <div class="rush-stats">${STAT(tv).map(([n, f]) => `<div><span style="width:78px">${n}</span><b><s style="width:${Math.round(Math.max(0.06, Math.min(1, f)) * 100)}%"></s></b></div>`).join('')}</div></div>
      ${own ? `<div class="rush-ups">${UPGRADES.map((u) => { const l = st.lv(vid, u.id), c = upgradeCost(vid, u.id, l); return `<div class="rush-up"><span style="font-size:24px">${u.icon}</span><span><b>${u.name}</b> <small class="muted">${u.what}</small><span class="pips">${Array.from({ length: MAX_LV }, (_, k) => `<i class="${k < l ? 'on' : ''}"></i>`).join('')}</span></span>
        ${l >= MAX_LV ? '<span class="btn btn-sm btn-ghost" aria-disabled="true">MAX</span>' : `<button type="button" class="btn btn-sm" data-up="${u.id}" ${st.canPay(c) ? '' : 'aria-disabled="true"'}>${pass ? 'Free' : '⭐ ' + fmt(c)}</button>`}</div>`; }).join('')}
        ${pass && UPGRADES.some((u) => st.lv(vid, u.id) < MAX_LV) ? '<button type="button" class="btn btn-ghost btn-block" id="rush-max">⚡ Max every upgrade (free with your pass)</button>' : ''}</div>
        ${D().vid === vid ? '<p class="muted small">✅ You are driving this one.</p>' : `<button type="button" class="btn btn-block" id="rush-use">Drive the ${esc(v.name)}</button>`}`
        : `<button type="button" class="btn btn-block" id="rush-buy">🔓 Unlock for ⭐ ${fmt(v.cost)}</button>`}
      <h3 class="rush-h">All cars</h3>
      <div class="rush-grid" id="rush-vg">${VEHICLES.map((x) => { const o = st.owns(x.id); return `<button type="button" class="rush-card2 ${o ? '' : 'lock'} ${x.id === vid ? 'sel' : ''}" data-v="${x.id}"><canvas></canvas>${o ? '' : `<span class="lk">🔒 ⭐ ${fmt(x.cost)}</span>`}<b>${esc(x.name)}</b><small>${esc(x.type)}</small>${D().vid === x.id ? '<span class="best">Driving</span>' : ''}</button>`; }).join('')}</div>
      <a class="btn btn-ghost btn-block" href="#/games/rush">⬅ Back</a></div>`, '#/games/rush');
    paint($('#rush-gc'), { stage: STAGE[D().stage], camX: 30, ax: 0.5, ay: 0.7, ppm: 0, t: 1, cars: [{ vid, pal, x: 30, ups: st.ups(vid), mood: own ? 'happy' : 'idle', s: 1.15 }] });
    const cards = [...main.querySelectorAll('.rush-page [data-v]')]; let i = 0;
    const next = () => { if (i >= cards.length || !document.body.contains(cards[0])) return; const el = cards[i++]; paint(el.querySelector('canvas'), { stage: STAGE.countryside, camX: 30, ax: 0.5, ay: 0.72, t: 1, cars: [{ vid: el.dataset.v, pal, x: 30 }] }); setTimeout(next, 16); };
    next();
    cards.forEach((el) => el.onclick = () => { tap(); params = { ...params, v: el.dataset.v }; garage(); scrollTo(0, 0); });
    main.querySelectorAll('.rush-page [data-up]').forEach((el) => el.onclick = () => { const u = el.dataset.up, c = upgradeCost(vid, u, st.lv(vid, u));
      if (!st.canPay(c)) { ui.sfx.play('wrong'); toast(`You need ⭐ ${fmt(c - D().stars)} more Rush Stars.`); return; }
      if (st.upgrade(vid, u)) { ui.sfx.play('star'); garage(); } });
    const buy = $('#rush-buy'); if (buy) buy.onclick = () => { if (D().stars < v.cost) { ui.sfx.play('wrong'); toast(`You need ⭐ ${fmt(v.cost - D().stars)} more Rush Stars. Drive to earn more!`); return; }
      if (!confirm(`Unlock the ${v.name} for ⭐ ${fmt(v.cost)} Rush Stars?`)) return; if (st.buyVehicle(vid)) { ui.sfx.play('cheer'); toast(`${v.name} is yours!`); garage(); } };
    const mx = $('#rush-max'); if (mx) mx.onclick = () => { if (st.maxAll(vid, UPGRADES.map((u) => u.id))) { ui.sfx.play('cheer'); garage(); } };
    const use = $('#rush-use'); if (use) use.onclick = () => { st.pick('vid', vid); tap(); garage(); };
  }

  // ---------------------------------------------------------------- play
  async function run(mode) {
    const { startRun } = await import('./game.js');
    const s = STAGE[D().stage], vid = D().vid; pal = await myPal(ctx);
    const bots = mode === 'cpu' ? botField(s) : [];
    const g = await startRun({ stage: s, vid, ups: st.ups(vid), pal: pal || KEMY, name: mode === 'cpu' ? 'You' : myName(ctx), seed: (Math.random() * 1e9) | 0, mode, raceLen: RACE_LEN.sprint, timeLimit: mode === 'cpu' ? 150 : 0, bots, diaCap: pass ? Infinity : DIA_RUN_CAP,
      startAt: mode === 'cpu' ? Date.now() + 3200 : 0, sfx: ui.sfx,
      onQuit: () => menu(), onRestart: () => run(mode), onEnd: (r) => { g.stop(); mode === 'cpu' ? cpuEnd(r) : soloEnd(r, s); } });
  }
  function solo() { run('solo'); }
  function cpu() { run('cpu'); }
  // bots drive YOUR car (fair race): two a little slower, one even (a notch faster on the late stages)
  function botField(s) {
    const vid = D().vid, u = st.ups(vid), e = u.engine || 0, lv = (d) => ({ ...u, engine: Math.max(0, Math.min(5, e + d)) });
    const hard = STAGES.indexOf(s) >= 5 ? 1 : 0;
    return [{ name: 'Capy Bot', pal: CAPY, vid, ups: lv(0), skill: 0.5, pace: 0.9 }, { name: 'Kemy Bot', pal: KEMY, vid, ups: lv(0), skill: 0.6, pace: 0.96 }, { name: 'Zippy Capy', pal: CAPY, vid, ups: lv(hard), skill: 0.72, pace: 1 }];
  }

  async function soloEnd(r, s) {
    const nb = st.best(s.id, r.dist); const got = st.addStars(r.stars);
    // real wallets: Star Coins for a good run, diamonds found on the road (both capped per run and per day)
    // pass holders already have ∞ Star Coins + diamonds (the wallets skip earning for them), so nothing is sent
    let coins = 0, dias = 0; const signed = ui.signedIn() && !pass;
    if (signed && r.dist >= 150) coins = st.take('coin', Math.min(COIN_RUN_CAP, 1 + Math.floor(r.dist / 200)), COIN_DAY_CAP);
    if (signed && r.dias) dias = st.take('dia', Math.min(DIA_RUN_CAP, r.dias), DIA_DAY_CAP);
    const rows = [['Distance', fmt(r.dist) + ' m' + (nb ? ' · NEW BEST!' : '')], ['Best on ' + s.name, fmt(st.best(s.id)) + ' m'], ['Rush Stars', pass ? '⭐ ∞ (+' + fmt(got) + ')' : '⭐ +' + fmt(got)], ['Flips', r.flips], ['Best air', (r.air || 0).toFixed(1) + ' s'], ['Checkpoints', r.checks]];
    if (coins) rows.push(['Kemy Star Coins', '🪙 +' + coins]); if (dias) rows.push(['Diamonds', '💎 +' + dias]);
    if (pass) rows.push(['Diamonds found', '💎 ' + (r.dias | 0) + ' · wallet ∞'], [PASS_LABEL[pass], 'all cars, stages, upgrades']);
    else if (!signed) rows.push(['Sign in', 'to earn coins + 💎']);
    const [t, sub] = REASON[r.reason] || REASON.quit;
    ui.resultModal({ title: t, win: nb && r.dist > 30, noReward: true, cls: 'rush-result', html: `<h2>${t}</h2><p>${sub}</p><div class="rush-res">${rows.map(([a, b]) => `<div><span>${a}</span><span>${b}</span></div>`).join('')}</div>`,
      buttons: [{ label: '▶ Drive again', onClick: () => run('solo') }, { label: '🔧 Garage', href: '#/games/rush/garage' }, { label: 'Menu', onClick: () => menu() }] });
    menu();
    if (coins) { try { const { createEconomy } = await import('../pals/economy.js'); const econ = createEconomy(ctx.db, uid); await econ.earn('win', coins); } catch (e) { st.give('coin', coins); console.warn('rush coins', e); } }
    if (dias) { const { createDiamonds } = await import('../pals/armory.js'); const w = createDiamonds(ctx.db, uid); queueDias(w, dias); }
  }
  function cpuEnd(r) {
    const field = (r.field || []).slice().sort((a, b) => (b.fin - a.fin) || (a.fin ? a.ft - b.ft : b.d - a.d)); const place = field.findIndex((x) => x.me) + 1; const win = place === 1 && r.fin;
    const got = st.addStars(Math.round(r.stars + (r.fin ? [0, 60, 35, 20, 10][place] || 0 : 0)));
    if (ui.addCpuResult) try { ui.addCpuResult('rush', win ? 'w' : 'l'); } catch { /* optional */ }
    const ORD = ['', '1st', '2nd', '3rd', '4th'];
    ui.resultModal({ title: win ? 'You win!' : ORD[place] + ' place', win, vsBot: true, noReward: !win, cls: 'rush-result',
      html: `<h2>${win ? '🏆 You win!' : `🏁 You came ${ORD[place]}`}</h2><p>${r.fin ? 'Finished in ' + r.ft.toFixed(1) + ' s' : 'Out of time at ' + fmt(r.dist) + ' m'}</p>
        <div class="rush-res">${field.map((x, i) => `<div class="${x.me ? 'me' : ''}"><span>${ORD[i + 1]} · ${esc(x.name)}</span><span>${x.fin ? x.ft.toFixed(1) + ' s' : fmt(x.d) + ' m'}</span></div>`).join('')}<div><span>Rush Stars</span><span>${pass ? '⭐ ∞' : '⭐ +' + got}</span></div></div>`,
      buttons: [{ label: '▶ Race again', onClick: () => run('cpu') }, { label: 'Menu', onClick: () => menu() }] });
    menu();
  }
}
// Diamonds found in an online race: same per-run and per-day caps as solo, same queued wallet save.
export function rushDias(ctx, st, uid, n) { if (st.pass) return 0; const d = st.take('dia', Math.min(DIA_RUN_CAP, n | 0), DIA_DAY_CAP);
  if (d) import('../pals/armory.js').then(({ createDiamonds }) => queueDias(createDiamonds(ctx.db, uid), d)).catch((e) => console.warn('rush diamonds', e)); return d; }
// One diamond save at a time (the wallet allows one save every ~46 s), kept alive across runs.
let diaQ = Promise.resolve();
function queueDias(w, n) { diaQ = diaQ.then(() => w.earnRun(n)).catch((e) => console.warn('rush diamonds', e)); }
