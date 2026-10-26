// Kemy Hill Rush: one run (solo, vs computer, or an online race). Canvas + DOM HUD over the page.
import { createSim, botDrive } from './sim.js';
import { makeTerrain, checkpointAt } from './terrain.js';
import { tuned, STAR_FLIP, STAR_CHECK, DIA_RUN_CAP } from './data.js';
import { makeDriver, drawVehicle, KEMY } from './driver.js';
import { drawSky, drawParallax, drawGround, drawCity, drawStarCoin, drawDiamond, drawFuel, drawGate, drawGhost } from './art.js';

let PL = null; const planck = () => PL || (PL = import('../vendor/planck-1.4.2.min.mjs'));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ORD = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const TAGC = ['#ff7ac8', '#5fd4ff', '#ffd23f', '#9b7bff'];

// opts: { stage, vid, ups, pal, name, seed, mode: 'solo'|'cpu'|'online', raceLen, bots:[{name,pal,vid,ups,skill}],
//         startAt (Date.now() ms when GO), sfx, onEnd(res), onQuit(), onRestart() }
const rotHint = () => { try { return localStorage.getItem('rush-rot-off') !== '1'; } catch { return true; } };
export async function startRun(opts) {
  const P = await planck();
  const st = opts.stage, race = opts.mode !== 'solo', finishX = race ? (opts.raceLen || 600) + 4 : Infinity;
  const sim = createSim(P, { stage: st, seed: opts.seed >>> 0 });
  const terr = sim.terr, sfx = opts.sfx || { play() {} };
  const cache = new Map();
  // ---------- DOM
  const root = document.createElement('div'); root.className = 'rush-run' + (race ? ' race' : '');
  root.innerHTML = `<canvas class="rush-cv"></canvas>
    <div class="rush-hud">
      <button class="rush-pause" aria-label="Pause">❚❚</button>
      <div class="rush-cap">
        ${race ? '<div class="rush-bar prog"><i class="ic">🏁</i><b><s></s></b></div>' : '<div class="rush-bar fuel"><i class="ic drop"></i><b><s></s></b></div>'}
        <div class="rush-bar spd"><i class="ic">⚡</i><b><s></s></b></div>
      </div>
      <div class="rush-chips"><span class="rush-dist">0 m</span><span class="rush-chip">⭐ <em class="st">0</em></span><span class="rush-chip">💎 <em class="di">0</em></span>${race ? '<span class="rush-chip pos">1st</span>' : ''}</div>
    </div>
    <div class="rush-pops"></div><div class="rush-count"></div>${rotHint() ? '<div class="rush-rot" role="status"><span>📱↻ Turn your phone for the best view</span><button type="button" aria-label="Hide this tip">✕</button></div>' : ''}
    <button class="rush-pedal brake" aria-label="Brake"><span>◀</span><small>BRAKE</small></button>
    <button class="rush-pedal gas" aria-label="Gas"><span>▶</span><small>GAS</small></button>
    <div class="rush-pausebox" hidden><div class="rush-card"><h3>Paused</h3>
      <button class="btn btn-block" data-a="resume">▶ Keep driving</button>${race ? '' : '<button class="btn btn-block btn-ghost" data-a="restart">↻ Restart</button>'}<button class="btn btn-block btn-ghost" data-a="quit">✕ ${race ? 'Leave race' : 'Quit run'}</button></div></div>`;
  document.body.appendChild(root); document.documentElement.classList.add('rush-on');
  // landscape first: lock where the platform allows it (Android TWA / Chrome), stay quiet where it doesn't (iOS, desktop).
  // Portrait stays fully playable; rotating mid-run only resizes the canvas, the run itself is untouched.
  const vpm = document.querySelector('meta[name=viewport]'), vp0 = vpm ? vpm.getAttribute('content') : null;
  if (vpm && !/viewport-fit/.test(vp0)) vpm.setAttribute('content', vp0 + ', viewport-fit=cover');
  let locked = false, lockTries = 0;
  const tryLand = () => { if (locked || lockTries > 2) return; lockTries++; try { const o = screen.orientation; if (o && o.lock) { locked = true; o.lock('landscape').catch(() => { locked = false; }); } } catch (e) { locked = false; } };
  tryLand();
  const rot = root.querySelector('.rush-rot');
  if (rot) { const hide = () => rot.remove(); rot.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); try { localStorage.setItem('rush-rot-off', '1'); } catch {} hide(); }); setTimeout(hide, 12000); }
  const cv = root.querySelector('canvas'), c = cv.getContext('2d', { alpha: false });
  const $ = (s) => root.querySelector(s);
  const fuelS = $('.fuel s'), progS = $('.prog s'), spdS = $('.spd s'), distE = $('.rush-dist'), stE = $('.st'), diE = $('.di'), posE = $('.pos'), pops = $('.rush-pops'), countE = $('.rush-count');
  let W = 0, H = 0, DPR = 1;
  const resize = () => { DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px'; };
  const reorient = () => { resize(); setTimeout(resize, 250); };
  resize(); addEventListener('resize', resize); addEventListener('orientationchange', reorient);
  // ---------- cars
  const mkCar = (vid, ups, pal, x) => { const def = tuned(vid, ups || {}); const drv = makeDriver(pal || KEMY, def, cache);
    const car = sim.addCar(def, { x, head: { ...drv.head, r: drv.head.r * 0.85 } });
    // pickup box in body space (y-down): the whole car, roof/driver to tire bottoms, plus a generous margin
    const hx = def.hull.map((v) => v[0]), hy = def.hull.map((v) => v[1]), M = 0.45;
    const box = { x0: Math.min(...hx, ...def.wheels.map((w) => w.x - w.r)) - M, x1: Math.max(...hx, ...def.wheels.map((w) => w.x + w.r)) + M,
      y0: Math.min(...hy, def.seat.top - 0.35, drv.head.y - drv.head.r) - M, y1: Math.max(...hy, ...def.wheels.map((w) => w.y + w.r)) + 0.3 };
    return { car, def, drv, box, lean: 0, bob: 0, pitch: 0, pvx: 0, axf: 0, mood: 'idle', moodT: 0, best: 0, fin: false, ft: 0, deadT: 0, stillT: 0, crashed: false, wa: def.wheels.map(() => 0), prev: null }; };
  const me = mkCar(opts.vid, opts.ups, opts.pal, 4); me.name = opts.name || 'You'; me.me = true;
  const bots = (opts.bots || []).map((b, i) => { const r = mkCar(b.vid, b.ups, b.pal, 4); r.name = b.name; r.skill = b.skill ?? 0.7; r.car.pace = b.pace || 1; r.tag = TAGC[(i + 1) % 4]; r.bot = true; return r; });
  const remotes = new Map(); // uid -> { name, def, drv, samples:[], d, fin, ft, tag }
  // ---------- run state
  const S = { fuel: me.def.fuel, stars: 0, dias: 0, flips: 0, airBest: 0, checks: 0, t: 0, raceT: 0, over: false, paused: false, reason: '', place: 0 };
  const taken = new Set(), fuelXs = terr.fuelXs(200000); let fuelI = 0, nextCheck = 1;
  const startAt = opts.startAt || 0; let go = !startAt || Date.now() >= startAt; let lastCount = -1;
  // ---------- input
  const keys = { gas: 0, brake: 0 }; const ptr = { gas: new Set(), brake: new Set() };
  const pedal = (el, k) => { const on = (e) => { e.preventDefault(); ptr[k].add(e.pointerId); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch {} engine.wake(); tryLand(); };
    const off = (e) => { ptr[k].delete(e.pointerId); if (!ptr[k].size) el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off); el.addEventListener('contextmenu', (e) => e.preventDefault()); };
  pedal($('.gas'), 'gas'); pedal($('.brake'), 'brake');
  const KG = ['ArrowRight', 'ArrowUp', 'KeyD', 'KeyW'], KB = ['ArrowLeft', 'ArrowDown', 'KeyA', 'KeyS'];
  const kd = (e) => { if (KG.includes(e.code)) { keys.gas = 1; e.preventDefault(); engine.wake(); } else if (KB.includes(e.code)) { keys.brake = 1; e.preventDefault(); engine.wake(); } else if (e.code === 'Escape' || e.code === 'KeyP') pause(!S.paused); };
  const ku = (e) => { if (KG.includes(e.code)) keys.gas = 0; else if (KB.includes(e.code)) keys.brake = 0; };
  addEventListener('keydown', kd); addEventListener('keyup', ku);
  const blur = () => { keys.gas = keys.brake = 0; if (!race && !S.over) pause(true); }; addEventListener('blur', blur);
  const visib = () => { if (document.hidden) blur(); }; document.addEventListener('visibilitychange', visib);
  $('.rush-pause').onclick = () => pause(true);
  $('.rush-pausebox').addEventListener('click', (e) => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; sfx.play('tap');
    if (a === 'resume') pause(false); else if (a === 'restart') { stop(); opts.onRestart?.(); } else if (a === 'quit') { stop(); opts.onQuit?.(); } });
  function pause(on) { if (S.over) return; if (race) on = on && true; S.paused = !!on; $('.rush-pausebox').hidden = !on; if (on) engine.idle(); last = performance.now(); }
  // ---------- engine hum (tiny WebAudio, follows the sound mute)
  const engine = (() => { let ac = null, o = null, g = null, f = null;
    return { wake() { if (ac || sfx.muted) return; try { ac = new (window.AudioContext || window.webkitAudioContext)(); o = ac.createOscillator(); o.type = 'sawtooth'; f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; g = ac.createGain(); g.gain.value = 0; o.connect(f).connect(g).connect(ac.destination); o.start(); } catch { ac = null; } },
      set(rpm, on) { if (!ac) return; const n = ac.currentTime; o.frequency.setTargetAtTime(46 + rpm * 120, n, 0.08); g.gain.setTargetAtTime(on ? 0.035 + rpm * 0.03 : 0.012, n, 0.12); },
      idle() { if (ac) g.gain.setTargetAtTime(0, ac.currentTime, 0.05); }, close() { try { ac && ac.close(); } catch {} ac = null; } }; })();
  // ---------- pops / toasts
  const pop = (txt, cls = '') => { const d = document.createElement('div'); d.className = 'rush-pop ' + cls; d.textContent = txt; pops.appendChild(d); setTimeout(() => d.remove(), 1500); };
  // ---------- camera
  const cam = { x: 4, y: 1, ppm: 40, x0: 0, x1: 0, X: (x) => (x - cam.x) * cam.ppm + W * 0.36, Y: (y) => H * 0.58 - (y - cam.y) * cam.ppm };
  // ---------- step logic
  const vel = (r) => r.car.body.getLinearVelocity();
  function carLogic(r, dt) {
    const car = r.car, p = car.body.getPosition(), v = vel(r); r.best = Math.max(r.best, p.x - 4);
    if (r.moodT > 0 && (r.moodT -= dt) <= 0 && r.mood !== 'shake') r.mood = 'idle';
    if (car.landed) { const L = car.landed; car.landed = null; if (L.air > 0.35) puff(r, Math.min(14, 4 + L.air * 6)); const flips = Math.floor((Math.abs(L.spin) + 0.6) / (2 * Math.PI));
      if (r.me && !car.headHit && !car.roofHit && !r.crashed) {
        if (flips) { S.flips += flips; S.stars += STAR_FLIP * flips; pop((flips > 1 ? flips + 'x ' : '') + (L.spin > 0 ? 'Back flip!' : 'Front flip!') + ' +' + STAR_FLIP * flips + '⭐', 'big'); sfx.play('cheer'); }
        if (L.air >= 0.4) S.airBest = Math.max(S.airBest, L.air);
        if (L.air >= 1.2) { const b = Math.round(L.air * 3); S.stars += b; S.airBest = Math.max(S.airBest, L.air); pop('Big air ' + L.air.toFixed(1) + 's +' + b + '⭐'); if (!flips) sfx.play('right'); }
      }
      if (flips || L.air >= 1.2) { r.mood = 'happy'; r.moodT = 1.6; } }
    // crash: head or roof hits the ground, or stuck upside-down
    const upside = Math.cos(car.body.getAngle()) < -0.2, slow = Math.hypot(v.x, v.y) < 0.6;
    r.stillT = upside && slow ? r.stillT + dt : 0;
    if (!r.crashed && !r.fin && (car.headHit || car.roofHit || r.stillT > 3)) { r.crashed = true; r.mood = 'shake'; r.deadT = 0; car.dead = true;
      if (r.me) { sfx.play('lose'); pop(car.headHit ? 'Ouch! Head bonk!' : 'Flipped over!', 'bad'); engine.idle(); } }
    if (r.crashed) { r.deadT += dt;
      if (race && r.deadT > 1.3) { r.crashed = false; r.mood = 'idle'; sim.respawn(car, Math.max(4, p.x - 5)); if (r.me) pop('Back on the road!'); }
      else if (!race && r.me && r.deadT > 1.6) end('crash'); }
    if (race && !r.fin && p.x >= finishX) { r.fin = true; r.ft = S.raceT; r.mood = 'happy'; r.moodT = 99;
      if (r.me) { sfx.play('win'); const pl = placeOf(); pop('Finish! ' + ORD(pl), 'big'); setTimeout(() => end('finish'), 1400); } }
    if (r.fin) { car.gas = 0; car.brake = 1; }
    // suspension bob + lean (smoothed)
    let comp = 0; r.def.wheels.forEach((w, i) => { const lp = car.body.getLocalPoint(car.wheels[i].getPosition()); comp += (-lp.y) - w.y; });
    comp /= r.def.wheels.length; r.bob += (Math.max(-0.1, Math.min(0.1, comp * 0.5)) - r.bob) * 0.15;
    const lt = car.gas && !car.brake ? 0.09 : car.brake && !car.gas ? -0.1 : 0; r.lean += (lt - r.lean) * 0.12;
    // body squat/dive from acceleration (visual only): speeding up tips the nose up a touch, braking dips it
    const ax = (v.x - r.pvx) / dt; r.pvx = v.x; r.axf += ((car.down ? ax : 0) - r.axf) * 0.08; // raw per-step accel is noisy on bumps: filter it first
    r.pitch += (Math.max(-0.05, Math.min(0.05, r.axf * 0.006)) - r.pitch) * 0.1;
    dust(r);
  }
  // ---------- dust / dirt particles (small fixed pool, world space)
  const PN = 90, parts = Array.from({ length: PN }, () => ({ l: 0 })); let pi = 0;
  const dirtC = st.top || st.dirt || '#a88a5c';
  function emit(x, y, vx, vy, s, l) { const q = parts[pi = (pi + 1) % PN]; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.s = s; q.l = q.L = l; }
  function dust(r) { const car = r.car, v = car.body.getLinearVelocity(), sp = Math.abs(v.x); if (r.crashed && sp < 1) return;
    car.wheels.forEach((w, i) => { if (!car.wheelDown[i]) return; const slip = car.slip ? car.slip[i] : 0, rate = Math.min(0.9, slip * 0.08 + (sp > 6 ? (sp - 6) * 0.012 : 0));
      if (Math.random() > rate) return; const p = w.getPosition(), rr = r.def.wheels[i].r;
      emit(p.x - Math.sign(v.x || 1) * rr * 0.6, p.y - rr * 0.85, -v.x * 0.15 - Math.sign(v.x || 1) * (0.5 + Math.random() * 1.5), 0.6 + Math.random() * 1.6, 0.1 + Math.random() * 0.12, 0.5 + Math.random() * 0.4); }); }
  function puff(r, n) { r.car.wheels.forEach((w, i) => { const p = w.getPosition(), rr = r.def.wheels[i].r; for (let k = 0; k < n / 2; k++) emit(p.x + (Math.random() - 0.5) * rr, p.y - rr * 0.9, (Math.random() - 0.5) * 4, 0.4 + Math.random() * 1.8, 0.12 + Math.random() * 0.14, 0.6 + Math.random() * 0.4); }); }
  function drawParts(dt) { c.fillStyle = dirtC; for (const q of parts) { if (q.l <= 0) continue; q.l -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy -= 3 * dt; q.vx *= 1 - 1.5 * dt;
    if (q.x < cam.x0 || q.x > cam.x1) continue; const u = q.l / q.L; c.globalAlpha = Math.max(0, u * 0.55); c.beginPath(); c.arc(cam.X(q.x), cam.Y(q.y), (q.s * (1.6 - u * 0.6)) * cam.ppm, 0, 7); c.fill(); } c.globalAlpha = 1; }
  function placeOf() { // live placement for me: finishers by time, then by distance
    const all = [{ me: true, d: me.best, fin: me.fin, ft: me.ft }, ...bots.map((b) => ({ d: b.best, fin: b.fin, ft: b.ft })), ...[...remotes.values()].map((r) => ({ d: r.d || 0, fin: r.fin, ft: r.ft || 0 }))];
    all.sort((a, b) => (b.fin - a.fin) || (a.fin ? a.ft - b.ft : b.d - a.d)); return all.findIndex((a) => a.me) + 1; }
  function stepOnce(dt) {
    const now = Date.now(); if (!go) { if (now >= startAt) { go = true; countE.textContent = 'GO!'; countE.className = 'rush-count go'; sfx.play('right'); setTimeout(() => { countE.textContent = ''; countE.className = 'rush-count'; }, 700); } }
    S.t += dt; if (go) S.raceT += dt;
    if (race && opts.timeLimit && !S.over && !me.fin) { const left = opts.timeLimit - S.raceT; if (left < 10 && !S.warned) { S.warned = true; pop('10 seconds left!'); } if (left <= 0) { pop('Time!', 'big'); end('time'); } }
    // controls
    const gas = keys.gas || ptr.gas.size ? 1 : 0, brake = keys.brake || ptr.brake.size ? 1 : 0;
    if (!go) { me.car.gas = 0; me.car.brake = 1; for (const b of bots) { b.car.gas = 0; b.car.brake = 1; } }
    else { if (!me.fin && !me.crashed) { me.car.gas = gas; me.car.brake = brake; }
      for (const b of bots) if (!b.fin && !b.crashed) botDrive(b.car, terr, b.skill, S.t + b.skill * 7); }
    sim.step();
    carLogic(me, dt); for (const b of bots) carLogic(b, dt);
    const p = me.car.body.getPosition();
    // fuel (solo only)
    if (!race && go) { const z = terr.zoneAt(p.x); let use = me.def.use * (0.22 + 0.78 * (me.car.gas ? 1 : 0)) * dt * 0.9;
      if (z && z.kind === 'lava' && me.car.down) { use += dt * 4; if ((S.t * 4 | 0) % 4 === 0 && !S._lv) { S._lv = 1; pop('Hot lava! Fuel burning!', 'bad'); setTimeout(() => S._lv = 0, 1500); } }
      S.fuel = Math.max(0, S.fuel - use);
      if (S.fuel <= 0 && !me.car.fuelOut) { me.car.fuelOut = true; pop('Out of fuel…', 'bad'); }
      if (me.car.fuelOut && Math.abs(vel(me).x) < 0.35) { S.outT = (S.outT || 0) + dt; if (S.outT > 2.5) end('fuel'); } else S.outT = 0; }
    // fuel cans
    while (fuelI < fuelXs.length && fuelXs[fuelI] < p.x - 3) fuelI++;
    if (!race && fuelI < fuelXs.length && Math.abs(fuelXs[fuelI] - p.x) < 2.0) { S.fuel = me.def.fuel; me.car.fuelOut = false; S.outT = 0; fuelI++; sfx.play('pop'); pop('Fuel full! 💧'); }
    // pickups near the car (stars, diamonds)
    const hp = me.car.body.getWorldPoint({ x: me.drv.head.x, y: -me.drv.head.y });
    for (let i = Math.floor((p.x - 3) / 40); i <= Math.floor((p.x + 3) / 40); i++) terr.pickups(i).forEach((k, j) => {
      const id = i * 100 + j; if (taken.has(id) || Math.abs(k.x - p.x) > 3.2) return;
      if (!touches(me, k, hp) || me.crashed) return;
      taken.add(id); if (k.t === 'dia') { if (S.dias < (opts.diaCap ?? DIA_RUN_CAP)) { S.dias++; sfx.play('star'); pop('+1 💎'); } else pop('Diamond bag full for this run'); } else { S.stars++; sfx.play('tick'); } });
    // checkpoints
    if (p.x >= checkpointAt(nextCheck) && !me.crashed) { S.checks++; nextCheck++; if (!race) { S.stars += STAR_CHECK; S.fuel = Math.min(me.def.fuel, S.fuel + me.def.fuel * 0.15); pop('Checkpoint! +' + STAR_CHECK + '⭐', 'big'); } else pop('Checkpoint ' + S.checks); sfx.play('right'); }
  }
  // any part of the car counts: body/roof box (in car space), any tire, or the driver's head
  function touches(r, k, hp) { const car = r.car, lp = car.body.getLocalPoint({ x: k.x, y: k.y }), b = r.box, ly = -lp.y;
    if (lp.x > b.x0 && lp.x < b.x1 && ly > b.y0 && ly < b.y1) return true;
    if (Math.hypot(k.x - hp.x, k.y - hp.y) < 1.2) return true;
    return car.wheels.some((w, i) => { const q = w.getPosition(); return Math.hypot(k.x - q.x, k.y - q.y) < r.def.wheels[i].r + 0.55; }); }
  function end(reason) { if (S.over) return; S.over = true; S.reason = reason; engine.idle();
    const res = { reason, dist: Math.round(me.best), stars: S.stars, dias: S.dias, flips: S.flips, air: S.airBest, checks: S.checks, time: S.raceT, fin: me.fin, ft: me.ft, place: race ? placeOf() : 0,
      field: race ? [{ name: me.name, d: Math.round(me.best), fin: me.fin, ft: me.ft, me: true }, ...bots.map((b) => ({ name: b.name, d: Math.round(b.best), fin: b.fin, ft: b.ft, bot: true }))] : null };
    if (opts.mode === 'cpu' && reason === 'finish') { // let bots keep racing a moment so the order is fair
      setTimeout(() => { res.field = [{ name: me.name, d: Math.round(me.best), fin: me.fin, ft: me.ft, me: true }, ...bots.map((b) => ({ name: b.name, d: Math.round(b.best), fin: b.fin, ft: b.ft, bot: true }))]; opts.onEnd?.(res); }, 300); }
    else setTimeout(() => opts.onEnd?.(res), 200); }
  // ---------- draw
  function wheelsOf(r) { const car = r.car; return r.def.wheels.map((w, i) => { const lp = car.body.getLocalPoint(car.wheels[i].getPosition()); return { x: lp.x, y: -lp.y, a: -(car.wheels[i].getAngle() - car.body.getAngle()) }; }); }
  // render interpolation: physics runs at a fixed 60 Hz, frames (60/120 Hz) blend the last two physics states
  // every part of a car (body, wheels, struts, driver bob/lean, squat) comes from the same blended state, so nothing steps at 120 Hz
  const poseNow = (r) => { const b = r.car.body, p = b.getPosition(); return { x: p.x, y: p.y, a: b.getAngle(), w: wheelsOf(r), bob: r.bob, lean: r.lean, pitch: r.pitch }; };
  function poseOf(r, al) { const c1 = poseNow(r), c0 = r.prev; if (!c0 || al >= 1 || Math.abs(c1.x - c0.x) > 3) return c1; const L = (a, b) => a + (b - a) * al; // > 3 m in a step = respawn: no smear
    return { x: L(c0.x, c1.x), y: L(c0.y, c1.y), a: L(c0.a, c1.a), bob: L(c0.bob, c1.bob), lean: L(c0.lean, c1.lean), pitch: L(c0.pitch, c1.pitch), w: c1.w.map((w, i) => ({ x: L(c0.w[i].x, w.x), y: L(c0.w[i].y, w.y), a: L(c0.w[i].a, w.a) })) }; }
  function drawCar(x, y, a, def, drv, o) { const sx = cam.X(x), sy = cam.Y(y); if (sx < -300 || sx > W + 300) return;
    c.save(); c.translate(sx, sy); c.rotate(-a); c.scale(cam.ppm, cam.ppm); drawVehicle(c, def, drv, o); c.restore(); }
  function tag(x, y, name, col, me) { const sx = cam.X(x), sy = cam.Y(y) - cam.ppm * 2.7; if (sx < -100 || sx > W + 100) return;
    c.font = '800 13px system-ui,sans-serif'; const w = c.measureText(name).width + 18; c.fillStyle = col; c.beginPath(); c.roundRect(sx - w / 2, sy - 12, w, 22, 11); c.fill();
    c.strokeStyle = '#2b1d4a'; c.lineWidth = 2; c.stroke(); c.fillStyle = me ? '#2b1d4a' : '#fff'; if (col === '#ffd23f' || col === '#5fd4ff') c.fillStyle = '#2b1d4a';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, sx, sy); c.beginPath(); c.moveTo(sx - 5, sy + 10); c.lineTo(sx + 5, sy + 10); c.lineTo(sx, sy + 16); c.fillStyle = col; c.fill(); }
  let night = null;
  let look = 0;
  function draw(dt = 1 / 60) {
    const al = Math.max(0, Math.min(1, acc / sim.H)), mp = poseOf(me, al), p = { x: mp.x, y: mp.y }, v = vel(me), sp = Math.abs(v.x);
    // smoothed camera, frame-rate independent, leading ahead in the direction of travel
    const k = (r) => 1 - Math.exp(-r * dt);
    const want = Math.min(H / 11, W / 15) * (1 - Math.min(0.22, sp / 160)); cam.ppm += (want - cam.ppm) * k(2.5);
    look += (Math.max(-2, Math.min(W / cam.ppm * 0.16, v.x * 0.3)) - look) * k(1.8);
    cam.x += (p.x + look - cam.x) * k(8); cam.y += (p.y - cam.y) * k(4.5);
    cam.x0 = cam.x - (W * 0.36) / cam.ppm - 1; cam.x1 = cam.x + (W * 0.64) / cam.ppm + 1;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSky(c, st, cam, W, H, S.t); drawParallax(c, st, cam, W, H, S.t);
    if (st.night) for (let i = 0; i < 4; i++) { const per = W * 0.9, gx = ((i * per / 3 + 200 - cam.x * cam.ppm * 0.4) % (per + 200) + per + 200) % (per + 200) - 100; drawGhost(c, gx, H * (0.3 + 0.1 * (i % 2)), Math.min(1.3, H / 500), S.t, i); }
    drawGround(c, st, terr, cam, W, H, S.t); if (st.deco === 'city') drawCity(c, st, terr, cam, W, H);
    // gates
    for (let n = Math.max(1, nextCheck - 1); n <= nextCheck + 1; n++) { const gx = checkpointAt(n); if (gx > cam.x0 - 4 && gx < cam.x1 + 4) drawGate(c, cam.X(gx), cam.Y(terr.at(gx)), cam.ppm, race ? 'CHECK ' + n : '⭐ ' + gx + ' m', false, S.t); }
    if (race && finishX > cam.x0 - 4 && finishX < cam.x1 + 4) drawGate(c, cam.X(finishX), cam.Y(terr.at(finishX)), cam.ppm, 'FINISH', true, S.t);
    // fuel + pickups
    if (!race) for (let i = fuelI; i < fuelXs.length && fuelXs[i] < cam.x1 + 2; i++) { const fx = fuelXs[i]; drawFuel(c, cam.X(fx), cam.Y(terr.path(fx) + 0.65), cam.ppm * 0.45, S.t); }
    for (let i = Math.floor(cam.x0 / 40); i <= Math.floor(cam.x1 / 40); i++) terr.pickups(i).forEach((k, j) => { if (taken.has(i * 100 + j) || k.x < cam.x0 || k.x > cam.x1) return;
      if (k.t === 'dia') drawDiamond(c, cam.X(k.x), cam.Y(k.y), cam.ppm * 0.32, S.t + k.x); else drawStarCoin(c, cam.X(k.x), cam.Y(k.y), cam.ppm * 0.3, S.t + k.x * 0.3); });
    // other racers (behind me)
    const nowS = Date.now() - (opts.lag || 260);
    for (const r of remotes.values()) { const s = sampleAt(r, nowS); if (!s) continue; c.globalAlpha = 0.92;
      drawCar(s.x, s.y, s.a, r.def, r.drv, { wheels: r.def.wheels.map((w) => ({ x: w.x, y: w.y, a: -s.x / w.r })), mood: r.fin ? 'happy' : s.st === 1 ? 'shake' : 'idle', t: S.t }); c.globalAlpha = 1; r._s = s; }
    drawParts(S.paused ? 0 : dt);
    for (const b of bots) { const bp = poseOf(b, al); b._p = bp; c.globalAlpha = 0.92; drawCar(bp.x, bp.y, bp.a, b.def, b.drv, { wheels: bp.w, lean: bp.lean, bob: bp.bob, pitch: bp.pitch, mood: b.mood, t: S.t }); c.globalAlpha = 1; }
    drawCar(p.x, p.y, mp.a, me.def, me.drv, { wheels: mp.w, lean: mp.lean, bob: mp.bob, pitch: mp.pitch, mood: me.mood, t: S.t, night: st.night });
    // night: darkness with headlight cone + glow around the car
    if (st.night) { if (!night) night = document.createElement('canvas'); if (night.width !== cv.width || night.height !== cv.height) { night.width = cv.width; night.height = cv.height; }
      const n = night.getContext('2d'); n.setTransform(DPR, 0, 0, DPR, 0, 0); n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, W, H); n.fillStyle = 'rgba(8,6,28,.8)'; n.fillRect(0, 0, W, H);
      n.globalCompositeOperation = 'destination-out'; const a = mp.a, hx = cam.X(p.x + Math.cos(a) * me.def.hull[3][0] * 0.9), hy = cam.Y(p.y + Math.sin(a) * 1), L = cam.ppm * 12;
      const g = n.createRadialGradient(hx, hy, 0, hx, hy, L); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g;
      n.beginPath(); n.moveTo(hx, hy); n.arc(hx, hy, L, -a - 0.38, -a + 0.3); n.closePath(); n.fill();
      const g2 = n.createRadialGradient(cam.X(p.x), cam.Y(p.y), 0, cam.X(p.x), cam.Y(p.y), cam.ppm * 4.5); g2.addColorStop(0, 'rgba(0,0,0,.95)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g2; n.fillRect(0, 0, W, H);
      for (const r of [...bots]) { const bp = r.car.body.getPosition(); const g3 = n.createRadialGradient(cam.X(bp.x), cam.Y(bp.y), 0, cam.X(bp.x), cam.Y(bp.y), cam.ppm * 3); g3.addColorStop(0, 'rgba(0,0,0,.8)'); g3.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g3; n.fillRect(0, 0, W, H); }
      for (const r of remotes.values()) if (r._s) { const g3 = n.createRadialGradient(cam.X(r._s.x), cam.Y(r._s.y), 0, cam.X(r._s.x), cam.Y(r._s.y), cam.ppm * 3); g3.addColorStop(0, 'rgba(0,0,0,.8)'); g3.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g3; n.fillRect(0, 0, W, H); }
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(night, 0, 0); c.setTransform(DPR, 0, 0, DPR, 0, 0);
      // fireflies stay bright
      c.fillStyle = '#fff59a'; for (let i = 0; i < 10; i++) { const fx = ((i * 173 - cam.x * cam.ppm * 0.8) % (W + 40) + W + 40) % (W + 40), fy = H * 0.35 + Math.sin(S.t * 1.7 + i) * 40 + (i % 3) * 50; c.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 3 + i); c.beginPath(); c.arc(fx, fy, 2.5, 0, 7); c.fill(); } c.globalAlpha = 1; }
    // name tags
    if (race) { for (const r of remotes.values()) if (r._s) tag(r._s.x, r._s.y, r.name, r.tag, false);
      bots.forEach((b) => { const bp = b._p || b.car.body.getPosition(); tag(bp.x, bp.y, b.name, b.tag, false); }); tag(p.x, p.y, 'You', '#ffffff', true); }
    // HUD
    const spF = Math.min(1, sp / (me.def.speed * Math.max(...me.def.wheels.map((w) => w.r)) * 0.9));
    spdS.style.transform = `scaleX(${spF.toFixed(3)})`;
    if (fuelS) { const f = S.fuel / me.def.fuel; fuelS.style.transform = `scaleX(${f.toFixed(3)})`; fuelS.parentNode.parentNode.classList.toggle('low', f < 0.22); }
    if (progS) progS.style.transform = `scaleX(${Math.min(1, me.best / (finishX - 4)).toFixed(3)})`;
    distE.textContent = Math.round(me.best) + ' m' + (race ? ' / ' + (finishX - 4) : ''); stE.textContent = S.stars; diE.textContent = S.dias;
    if (posE) posE.textContent = ORD(placeOf()) + ' / ' + (1 + bots.length + remotes.size);
    engine.set(Math.min(1, spF + (me.car.gas ? 0.25 : 0)), !!me.car.gas && !me.crashed && !S.over);
    if (!go) { const n = Math.ceil((startAt - Date.now()) / 1000); if (n !== lastCount && n >= 1 && n <= 5) { lastCount = n; countE.textContent = n; countE.className = 'rush-count pulse'; void countE.offsetWidth; countE.className = 'rush-count pulse on'; sfx.play('tick'); } }
  }
  function sampleAt(r, t) { const s = r.samples; if (!s.length) return null; if (t <= s[0].t) return s[0];
    for (let i = s.length - 1; i > 0; i--) if (s[i - 1].t <= t) { const a = s[i - 1], b = s[i]; if (t >= b.t) { const dt = Math.min(0.5, (t - b.t) / 1000); return { ...b, x: b.x + (b.v || 0) * dt }; } const u = (t - a.t) / Math.max(1, b.t - a.t); let da = b.a - a.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI; return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, a: a.a + da * u, st: b.st }; }
    return s[s.length - 1]; }
  // ---------- loop
  let last = performance.now(), acc = 0, raf = 0, alive = true;
  function frame(now) { if (!alive) return; raf = requestAnimationFrame(frame);
    let dt = Math.min(0.1, (now - last) / 1000); last = now; if (S.paused) { draw(0); return; }
    acc += dt; let n = 0; while (acc >= sim.H && n < 5) { me.prev = poseNow(me); for (const b of bots) b.prev = poseNow(b); if (!S.over || race) stepOnce(sim.H); acc -= sim.H; n++; } if (n === 5) acc = 0;
    draw(dt); }
  raf = requestAnimationFrame(frame);
  function stop() { alive = false; cancelAnimationFrame(raf); engine.close(); removeEventListener('resize', resize); removeEventListener('orientationchange', reorient); if (vpm && vp0 != null) vpm.setAttribute('content', vp0); if (locked) { try { screen.orientation.unlock(); } catch {} } removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visib); root.remove(); document.documentElement.classList.remove('rush-on'); }
  return {
    stop, root, end,
    tally() { return { stars: S.stars, dias: S.dias, flips: S.flips }; },
    state() { const p = me.car.body.getPosition(), v = vel(me); return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), a: +me.car.body.getAngle().toFixed(3), v: +v.x.toFixed(2), d: Math.round(me.best), fin: me.fin, ft: +me.ft.toFixed(2), st: me.crashed ? 1 : 0 }; },
    setRemote(uid, { name, pal, vid, i }) { let r = remotes.get(uid); if (r) return r; const def = tuned(vid || 'scout', {}); r = { name, def, drv: makeDriver(pal || KEMY, def, cache), samples: [], d: 0, fin: false, ft: 0, tag: TAGC[(i ?? remotes.size + 1) % 4] }; remotes.set(uid, r); return r; },
    pushSample(uid, s) { const r = remotes.get(uid); if (!r) return; const t = Date.now(); const last = r.samples[r.samples.length - 1]; if (last && last.x === s.x && last.y === s.y) { last.t = t; } else r.samples.push({ t, x: s.x, y: s.y, a: s.a, v: s.v, st: s.st }); if (r.samples.length > 12) r.samples.shift(); r.d = s.d || 0; r.fin = !!s.fin; r.ft = s.ft || 0; },
    removeRemote(uid) { remotes.delete(uid); },
    get over() { return S.over; }, pop
  };
}
