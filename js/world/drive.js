// Kemy World driving: your own cars (My Cars), enter / exit with hinged doors, a fixed-step vehicle model (cars.js),
// chase / far / driver-seat cameras (saved per device), speedometer, procedural engine + horn, multiplayer sync through
// Pal Park's existing presence doc (the dance-name field carries a tiny "~c" car code; x/z/yaw are the normal fields),
// remote cars interpolated + predicted. Cars never hurt anyone: people are only nudged aside. Written by Lone Keem.
import { CARS, CAR, CAR_IDX, PAINTS, carItem, buildCar, poseCar, setDoors, setBrakeLights, createVehicle, createEngineSound, honk, registerCarItems } from './cars.js';
import { ROADS, FLAT } from './layout.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export const CAMS = ['chase', 'far', 'pov']; const CAM_NAME = { chase: 'Chase', far: 'Far chase', pov: 'Driver seat' };
export const carCode = (id, color, door) => '~c' + CAR_IDX.indexOf(id).toString(36) + (color | 0).toString(36) + (door ? '1' : '0');
export function parseCar(dn) { if (!dn || dn.slice(0, 2) !== '~c' || dn.length < 5) return null; const id = CAR_IDX[parseInt(dn[2], 36)]; if (!id) return null; return { id, color: parseInt(dn[3], 36) || 0, door: dn[4] === '1' }; }

export function attachDrive(api, world) {
  const { THREE, scene, P, me, view, S, db, cam, ground, LOW } = api; const uid = (S.user && S.user.uid) || 'anon'; const hud = world.hud; const say = world.say;
  const CK = 'kemy-car-cam', SK = 'kemy-car-cam-set', MK = 'kemy-mycars-' + uid;
  let camMode = CAMS.includes(lsg(CK)) ? lsg(CK) : 'chase'; let camSet = { dist: 6.5, h: 2.4 }; try { camSet = { ...camSet, ...(JSON.parse(lsg(SK) || '{}') || {}) }; } catch { /* */ }
  let pref = {}; try { pref = JSON.parse(lsg(MK) || '{}') || {}; } catch { pref = {}; } pref.colors = pref.colors || {};
  const owned = new Set(CARS.filter((c) => c.free).map((c) => c.id)); let invLoaded = false;
  let econ = null, dia = null; async function loadInv() { try { const [{ createEconomy }, { createDiamonds }] = await Promise.all([import('../pals/economy.js'), import('../pals/armory.js')]); await registerCarItems(); econ = econ || createEconomy(db, uid); dia = dia || createDiamonds(db, uid);
    const inv = await econ.inventory(true); for (const c of CARS) if (inv[carItem(c)]) owned.add(c.id); invLoaded = true; } catch (e) { console.warn('cars inv', e); } }
  loadInv();
  // ---------------------------------------------------------------- my car (one active car at a time)
  let my = null; // { id, color, m, V, state: 'parked'|'enter'|'drive'|'exit', t, door, eng, cy }
  const inp = { thr: 0, brk: 0, steer: 0, hand: 0 }; const held = { gas: 0, brake: 0 };
  function nearestRoad(x, z) { let best = null, bd = 1e9; for (const r of ROADS) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0.05, 0.95); const px = ax + dx * t, pz = az + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; const L = Math.sqrt(L2); best = { x: px - dz / L * 2, z: pz + dx / L * 2, yaw: Math.atan2(dx, dz), d }; } } return best; }
  function spawnCar(id, color, at) { removeCar(); const def = CAR[id]; const m = buildCar(def, color, { noShadow: LOW }); scene.add(m); const V = createVehicle(def, (x, z) => ground(x, z));
    let p = at; if (!p) { const r = nearestRoad(P.x, P.z); p = r && r.d < 40 ? r : { x: P.x + Math.sin(P.yaw) * 3.5, z: P.z + Math.cos(P.yaw) * 3.5, yaw: P.yaw + Math.PI / 2 }; }
    V.place(p.x, p.z, p.yaw); const cy = { x: p.x, z: p.z, r: def.Wd * 0.55, top: 99, mycar: 1 }; api.cyl.push(cy);
    my = { id, color, m, V, state: 'parked', t: 0, door: 0, doorWant: 0, cy, rs: V.update(0, inp) }; poseCar(m, my.rs, 0, 0); window.__kd && (window.__kd.spawned = id); return my; }
  function removeCar() { if (!my) return; if (my.state !== 'parked') exitNow(); scene.remove(my.m); const i = api.cyl.indexOf(my.cy); if (i >= 0) api.cyl.splice(i, 1); my = null; }
  const seatWorld = (car, out) => { car.updateMatrixWorld(true); out.copy(car.userData.seat); out.y -= 0.1; return out.applyMatrix4(car.userData.chassis.matrixWorld); };
  const sv = new THREE.Vector3(), sv2 = new THREE.Vector3();
  // ---------------------------------------------------------------- HUD: My Cars button + drive controls + speedometer
  const css = document.createElement('style'); css.textContent = `.kd-my{position:absolute;left:calc(max(8px,env(safe-area-inset-left)) + 76px);top:calc(max(8px,env(safe-area-inset-top)) + 134px);pointer-events:auto;min-width:48px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(43,29,85,.75);color:#fff;font:800 14px Inter,sans-serif;padding:0 12px}
.kd-drv{position:absolute;inset:0;pointer-events:none;z-index:7}.kd-drv[hidden]{display:none}.kd-pedals{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:calc(max(16px,env(safe-area-inset-bottom)) + 10px);display:flex;gap:10px;align-items:flex-end;pointer-events:auto}
.kd-b{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,.8);background:rgba(30,20,60,.6);color:#fff;font:800 12px Inter,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;gap:2px}.kd-b i{font-style:normal;font-size:26px;line-height:1}
.kd-b.gas{width:92px;height:92px;background:rgba(34,197,94,.6)}.kd-b.brk{background:rgba(232,67,79,.6)}.kd-b.on{transform:scale(.92);filter:brightness(1.3)}
.kd-side{position:absolute;right:max(14px,env(safe-area-inset-right));bottom:calc(max(16px,env(safe-area-inset-bottom)) + 116px);display:flex;gap:8px;pointer-events:auto}.kd-side .kd-b{width:58px;height:58px}
.kd-speed{position:absolute;left:50%;bottom:calc(max(12px,env(safe-area-inset-bottom)) + 58px);transform:translateX(-50%);background:rgba(20,12,45,.7);border:2px solid rgba(255,255,255,.5);border-radius:18px;padding:4px 14px;text-align:center;color:#fff;font:900 26px Inter,sans-serif;font-variant-numeric:tabular-nums;min-width:110px}.kd-speed small{display:block;font:700 11px Inter,sans-serif;opacity:.85}
.kd-speed .rpm{height:5px;border-radius:9px;background:rgba(255,255,255,.2);margin-top:3px;overflow:hidden}.kd-speed .rpm i{display:block;height:100%;background:linear-gradient(90deg,#4ade80,#facc15,#f87171);width:0}
.kd-list{display:grid;gap:10px}.kd-car{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;background:rgba(255,255,255,.08);border-radius:14px;padding:10px}.kd-car .e{font-size:34px}.kd-car b{font-size:16px}.kd-car small{display:block;opacity:.85}.kd-car .row{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.kd-sw{width:30px;height:30px;border-radius:50%;border:3px solid rgba(255,255,255,.4)}.kd-sw.on{border-color:#fff;box-shadow:0 0 0 2px #7c3aed}.kd-car button{margin-top:0!important;min-height:42px!important}
.kc.kd-on .kc-btns{display:none}@media (max-height:500px){.kd-my{top:calc(max(8px,env(safe-area-inset-top)) + 4px);left:auto;right:calc(max(8px,env(safe-area-inset-right)) + 184px)}.kd-side{bottom:calc(max(10px,env(safe-area-inset-bottom)) + 104px)}.kd-speed{bottom:calc(max(8px,env(safe-area-inset-bottom)) + 52px)}}
.kd-set label{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:8px 0}.kd-set select{min-height:40px;border-radius:10px;background:#fff;color:#111;border:0;padding:0 8px;font-size:15px}`; document.head.appendChild(css);
  const myB = document.createElement('button'); myB.type = 'button'; myB.className = 'kd-my'; myB.textContent = '🚗 My Cars'; hud.appendChild(myB);
  const drv = document.createElement('div'); drv.className = 'kd-drv'; drv.hidden = true; drv.innerHTML = `<div class="kd-speed" id="kd-spd">0<small>km/h · D1</small><div class="rpm"><i></i></div></div>
    <div class="kd-side"><button type="button" class="kd-b" data-k="horn" aria-label="Horn"><i>📯</i>Horn</button><button type="button" class="kd-b" data-k="cam" aria-label="Car camera"><i>🎥</i><span>Chase</span></button><button type="button" class="kd-b" data-k="doors" aria-label="Doors"><i>🚪</i>Doors</button><button type="button" class="kd-b" data-k="out" aria-label="Get out"><i>🚶</i>Get out</button></div>
    <div class="kd-pedals"><button type="button" class="kd-b brk" data-k="brake" aria-label="Brake or reverse"><i>🛑</i>Brake/Rev</button><button type="button" class="kd-b gas" data-k="gas" aria-label="Gas"><i>⏩</i>Gas</button></div>`; hud.appendChild(drv);
  const spdEl = drv.querySelector('#kd-spd'); const camLbl = drv.querySelector('[data-k=cam] span'); camLbl.textContent = CAM_NAME[camMode].split(' ')[0];
  drv.querySelectorAll('.kd-b').forEach((b) => { const k = b.dataset.k; const dn = (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* */ } b.classList.add('on');
      if (k === 'gas' || k === 'brake') held[k] = 1; else if (k === 'horn') { honk(); api.markDirty(); } else if (k === 'cam') cycleCam(); else if (k === 'doors') toggleDoors(); else if (k === 'out') getOut(); };
    const up = () => { b.classList.remove('on'); if (k === 'gas' || k === 'brake') held[k] = 0; }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
  const kd = (e) => { if (!my || my.state !== 'drive' || /input|textarea/i.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (k === 'h') honk(); if (k === 'c') cycleCam(); if (k === 'f') getOut(); if (k === ' ') inp.hand = 1; };
  const ku = (e) => { if (e.key === ' ') inp.hand = 0; }; addEventListener('keydown', kd); addEventListener('keyup', ku);
  function cycleCam() { camMode = CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]; lss(CK, camMode); camLbl.textContent = CAM_NAME[camMode].split(' ')[0]; say('🎥 ' + CAM_NAME[camMode]); }
  function toggleDoors() { if (!my) return; if (my.state === 'drive' && my.V.speed() > 0.6) { say('Stop the car to open the doors'); return; } my.doorWant = my.doorWant > 0.5 ? 0 : 1; api.markDirty(); }
  // control settings panel: a Car camera block (saved on this device)
  function carSetHTML() { return `<div class="kd-set gfx-set"><b>🚗 Car camera</b><label>Default view <select data-cc>${CAMS.map((c) => `<option value="${c}" ${c === camMode ? 'selected' : ''}>${CAM_NAME[c]}</option>`).join('')}</select></label>
    <label>Distance <input type="range" min="4" max="12" step="0.5" value="${camSet.dist}" data-cd></label><label>Height <input type="range" min="1.2" max="5" step="0.1" value="${camSet.h}" data-ch></label></div>`; }
  api.tc.on('settings:open', () => { const d = api.tc.root.querySelector('.kc-set'); if (!d || d.querySelector('.kd-set')) return; const w = document.createElement('div'); w.innerHTML = carSetHTML(); const blk = w.firstElementChild; const done = d.querySelector('[data-done]'); (done ? done.parentElement : d.lastElementChild).before(blk);
    blk.querySelector('[data-cc]').onchange = (e) => { camMode = e.target.value; lss(CK, camMode); camLbl.textContent = CAM_NAME[camMode].split(' ')[0]; };
    blk.querySelector('[data-cd]').oninput = (e) => { camSet.dist = +e.target.value; lss(SK, JSON.stringify(camSet)); }; blk.querySelector('[data-ch]').oninput = (e) => { camSet.h = +e.target.value; lss(SK, JSON.stringify(camSet)); }; });
  // My Cars panel (garage list): spawn, paint, buy with Star Coins or Diamonds (existing validated shop paths)
  function openMyCars() { const d = document.createElement('div'); d.className = 'ks-panel'; hud.appendChild(d); const paint = () => {
      d.innerHTML = `<div class="ks-card"><h3>🚗 My Cars</h3><p style="margin:0 0 10px;opacity:.85;font-size:13px">Original Kemy designs. Pocket Pip is free. Others: ⭐ Star Coins or 💎 Diamonds (no real money).${invLoaded ? '' : ' Loading your garage…'}</p><div class="kd-list">${CARS.map((c) => { const own = owned.has(c.id); const col = pref.colors[c.id] ?? c.color;
        return `<div class="kd-car"><span class="e">${c.emoji}</span><div><b>${c.name}</b>${c.prem ? ' <small style="display:inline;color:#ffd23f">PREMIUM</small>' : ''}<small>${c.blurb}</small></div><div class="row">${PAINTS.map((p, i) => `<button type="button" class="kd-sw${i === col ? ' on' : ''}" style="background:${p}" data-col="${c.id}:${i}" aria-label="Paint ${i + 1}"></button>`).join('')}</div>
          <div class="row">${own ? `<button type="button" data-spawn="${c.id}">▶ Drive it</button>` : c.p ? `<button type="button" data-buy="${c.id}">Buy · ⭐ ${c.p}</button>` : `<button type="button" data-buy="${c.id}">Buy · 💎 ${c.d}</button>`}${my && my.id === c.id ? '<button type="button" class="ghost" data-park>Put away</button>' : ''}</div></div>`; }).join('')}</div><button type="button" class="ghost" data-close style="width:100%">Close</button></div>`; };
    paint(); d.onclick = async (e) => { const b = e.target.closest('button'); if (e.target === d || (b && b.dataset.close !== undefined)) { d.remove(); return; } if (!b) return;
      if (b.dataset.col) { const [id, i] = b.dataset.col.split(':'); pref.colors[id] = +i; lss(MK, JSON.stringify(pref)); if (my && my.id === id) { const st = my.state; const pos = { x: my.V.x, z: my.V.z, yaw: my.V.yaw }; const wasIn = st === 'drive'; removeCar(); spawnCar(id, +i, pos); if (wasIn) { my.state = 'drive'; enterSync(); } } paint(); return; }
      if (b.dataset.spawn) { const id = b.dataset.spawn; spawnCar(id, pref.colors[id] ?? CAR[id].color); d.remove(); say(`🚗 ${CAR[id].name} is parked nearby. Walk up and tap Enter car!`); return; }
      if (b.dataset.park !== undefined) { removeCar(); paint(); return; }
      if (b.dataset.buy) { const c = CAR[b.dataset.buy]; if (!confirm(`Buy ${c.name} for ${c.p ? '⭐ ' + c.p + ' Star Coins' : '💎 ' + c.d + ' Diamonds'}?`)) return; b.disabled = true; b.textContent = 'Buying…';
        try { await loadInv(); if (c.p) await econ.buy(carItem(c)); else await dia.buy(carItem(c)); owned.add(c.id); say(`🎉 ${c.name} is yours!`); } catch (er) { say(er && er.code === 'permission-denied' ? 'The shop isn’t ready for cars yet (prices not published). Try again soon!' : (er && er.message) || 'Could not buy right now'); } paint(); } }; }
  myB.onclick = openMyCars;
  // ---------------------------------------------------------------- enter / exit
  function enterSync() { P.dance = carCode(my.id, my.color, my.door > 0.5); P.danceUntil = Date.now() + 864e5; api.markDirty(); }
  function getIn() { if (!my || my.state !== 'parked') return; my.state = 'enter'; my.t = 0; my.from = { x: P.x, z: P.z }; my.cy.r = 0; my.eng = my.eng || createEngineSound(); enterSync(); drv.hidden = false; myB.hidden = true; api.tc.root.classList.add('kd-on'); world.hud.querySelector('.ks-act').hidden = true; window.__kd && (window.__kd.state = 'enter'); }
  function getOut() { if (!my || my.state !== 'drive') return; if (my.V.speed() > 1.2) { say('Slow down to get out 🙂'); return; } my.state = 'exit'; my.t = 0; held.gas = held.brake = 0; }
  function exitNow() { if (!my) return; const c = my.m.userData.def; const s = Math.sin(my.V.yaw), co = Math.cos(my.V.yaw); const side = c.Wd / 2 + 0.8; P.x = my.V.x + co * side; P.z = my.V.z - s * side; P.y = ground(P.x, P.z); me.scale.setScalar(1); me.visible = true;
    my.state = 'parked'; my.cy.x = my.V.x; my.cy.z = my.V.z; my.cy.r = c.Wd * 0.55; P.dance = ''; P.danceUntil = 0; api.markDirty(); drv.hidden = true; myB.hidden = false; api.tc.root.classList.remove('kd-on'); if (my.eng) { my.eng.stop(); my.eng = null; } setBrakeLights(my.m, false); }
  // ---------------------------------------------------------------- remote cars (interpolation + prediction)
  const remote = new Map(); // uid -> { m, id, color, s:{x,z,yaw}, v:{x,z,w}, last:{x,z,yaw,t}, door }
  function remoteCars(dt, nowMs) { const seen = new Set();
    for (const o of api.others.values()) { const pc = parseCar(o.dn); if (!pc) continue; seen.add(o.uid); let R = remote.get(o.uid);
      if (R && (R.id !== pc.id || R.color !== pc.color)) { scene.remove(R.m); remote.delete(o.uid); R = null; }
      if (!R) { const m = buildCar(pc.id, pc.color, { lite: true, noShadow: true }); scene.add(m); R = { m, id: pc.id, color: pc.color, s: { x: o.tx, z: o.tz, yaw: o.tr || 0 }, v: { x: 0, z: 0, w: 0 }, last: { x: o.tx, z: o.tz, yaw: o.tr || 0, t: nowMs }, door: 0, spin: 0 }; remote.set(o.uid, R); }
      if (o.tx !== R.last.x || o.tz !== R.last.z || (o.tr ?? R.last.yaw) !== R.last.yaw) { const dtS = Math.max(0.08, (nowMs - R.last.t) / 1000); let dy = (o.tr ?? R.last.yaw) - R.last.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        R.v = { x: (o.tx - R.last.x) / dtS, z: (o.tz - R.last.z) / dtS, w: dy / dtS }; R.last = { x: o.tx, z: o.tz, yaw: o.tr ?? R.last.yaw, t: nowMs }; }
      const ahead = Math.min(0.6, (nowMs - R.last.t) / 1000); const px = R.last.x + R.v.x * ahead, pz = R.last.z + R.v.z * ahead, pyaw = R.last.yaw + R.v.w * ahead; // predicted
      const k = Math.min(1, dt * 6); R.s.x += (px - R.s.x) * k; R.s.z += (pz - R.s.z) * k; let dy = pyaw - R.s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); R.s.yaw += dy * k;
      const spd = Math.hypot(R.v.x, R.v.z); R.spin += spd / R.m.userData.def.wr * dt; R.door += ((pc.door ? 1 : 0) - R.door) * Math.min(1, dt * 4); setDoors(R.m, R.door);
      const d = Math.hypot(R.s.x - P.x, R.s.z - P.z); R.m.visible = d < (LOW ? 90 : 160); poseCar(R.m, { x: R.s.x, y: ground(R.s.x, R.s.z), z: R.s.z, yaw: R.s.yaw, roll: clamp(-R.v.w * spd * 0.004, -0.06, 0.06) }, clamp(R.v.w * 0.3, -0.5, 0.5), R.spin);
      if (o.obj) { seatWorld(R.m, sv); o.obj.position.copy(sv); o.obj.rotation.y = R.s.yaw; o.obj.scale.setScalar(0.6); sitPose(o.obj, dt); }
      // gentle push: a remote car nudges me aside (never hurts)
      if (!my || my.state === 'parked') { const c = R.m.userData.def; const lx = (P.x - R.s.x) * Math.cos(R.s.yaw) - (P.z - R.s.z) * Math.sin(R.s.yaw), lz = (P.x - R.s.x) * Math.sin(R.s.yaw) + (P.z - R.s.z) * Math.cos(R.s.yaw);
        if (Math.abs(lx) < c.Wd / 2 + 0.45 && Math.abs(lz) < c.L / 2 + 0.45) { const push = (c.Wd / 2 + 0.45 - Math.abs(lx)) * Math.sign(lx || 1) * Math.min(1, dt * 8); P.x += Math.cos(R.s.yaw) * push; P.z -= Math.sin(R.s.yaw) * push; api.markDirty(); } } }
    for (const [id, R] of remote) if (!seen.has(id)) { scene.remove(R.m); remote.delete(id); const o = api.others.get(id); if (o && o.obj) o.obj.scale.setScalar(1); } }
  function sitPose(obj, dt) { const m = obj.userData.m; const J = m.userData.J; obj.userData.st = (obj.userData.st || 0) + dt * 60; api.posePal3D(m, { mode: 'idle', t: obj.userData.st, dt60: dt * 60, still: true });
    for (const n of ['Left', 'Right']) { if (J[n + 'UpperLeg']) J[n + 'UpperLeg'].rotation.x = -1.45; if (J[n + 'LowerLeg']) J[n + 'LowerLeg'].rotation.x = 1.35; if (J[n + 'UpperArm']) J[n + 'UpperArm'].rotation.x = -0.9; } }
  // ---------------------------------------------------------------- per frame
  const camP = new THREE.Vector3(), camL = new THREE.Vector3(); let camInit = false;
  function update(dt, now) { const nowMs = performance.now(); remoteCars(dt, nowMs); if (!my) return;
    const c = my.m.userData.def; my.door += (my.doorWant - my.door) * Math.min(1, dt * 5);
    if (my.state === 'enter' || my.state === 'exit') { my.t += dt; const t = my.state === 'enter' ? my.t : 1.3 - my.t; my.doorWant = t < 0.95 ? 1 : 0; if (my.state === 'exit' && my.t < 0.4) my.doorWant = 1;
      seatWorld(my.m, sv); const s = Math.sin(my.V.yaw), co = Math.cos(my.V.yaw); sv2.set(my.V.x + co * (c.Wd / 2 + 0.8), ground(my.V.x, my.V.z), my.V.z - s * (c.Wd / 2 + 0.8)); const k = clamp((t - 0.3) / 0.6, 0, 1);
      me.position.lerpVectors(sv2, sv, k); me.rotation.y = my.V.yaw + (1 - k) * Math.PI / 2; me.scale.setScalar(1 - k * 0.4); if (k > 0.6) sitPose(me, dt);
      if (my.state === 'enter' && my.t > 1.3) { my.state = 'drive'; camInit = false; say('🚗 Gas ⏩ to drive · Brake 🛑 (hold to reverse) · steer with the joystick'); window.__kd && (window.__kd.state = 'drive'); } if (my.state === 'exit' && my.t > 1.3) { exitNow(); window.__kd && (window.__kd.state = 'parked'); } }
    if (my.state === 'drive' || my.state === 'enter' || my.state === 'exit') { const mv = api.tc.move; const drive = my.state === 'drive';
      const jy = drive && !window.__kdTest ? -mv.y : 0, jx = drive && !window.__kdTest ? mv.x : 0; const T = window.__kdTest || {};
      inp.thr = drive ? clamp(Math.max(held.gas, jy > 0.25 ? jy : 0, T.thr || 0), 0, 1) : 0; inp.brk = drive ? clamp(Math.max(held.brake, jy < -0.25 ? -jy : 0, T.brk || 0), 0, 1) : (my.V.speed() > 0.1 ? 1 : 0); inp.steer = drive ? clamp(-(jx || 0) - (T.steer || 0), -1, 1) : 0;
      const rs = my.V.update(dt, inp, (V) => { // collisions (world colliders), soft: slide + lose speed
        const s = Math.sin(V.yaw), co = Math.cos(V.yaw); let hit = false; for (const f of [c.L * 0.38, 0, -c.L * 0.38]) { const x = V.x + s * f, z = V.z + co * f; const [nx, nz] = api.collide(x, z, ground(x, z)); if (Math.abs(nx - x) + Math.abs(nz - z) > 1e-4) { V.x += (nx - x); V.z += (nz - z); hit = true; } }
        if (hit) { V.vf *= 0.92; V.vl *= 0.8; } });
      my.rs = rs; poseCar(my.m, rs, my.V.steer, my.V.spin); setDoors(my.m, my.door); setBrakeLights(my.m, inp.brk > 0.1 && !my.V.rev);
      if (drive) { seatWorld(my.m, sv); me.position.copy(sv); me.rotation.y = rs.yaw; me.scale.setScalar(0.6); sitPose(me, dt); }
      P.x = my.V.x; P.z = my.V.z; P.yaw = my.V.yaw; P.y = ground(P.x, P.z); P.vy = 0; if (my.V.speed() > 0.05) api.markDirty();
      const code = carCode(my.id, my.color, my.door > 0.5); if (P.dance !== code && my.state !== 'exit') { P.dance = code; P.danceUntil = Date.now() + 864e5; api.markDirty(); }
      // nudge bots out of the way (gently)
      for (const b of world.bots) { const lx = (b.x - my.V.x) * Math.cos(my.V.yaw) - (b.z - my.V.z) * Math.sin(my.V.yaw), lz = (b.x - my.V.x) * Math.sin(my.V.yaw) + (b.z - my.V.z) * Math.cos(my.V.yaw); if (Math.abs(lx) < c.Wd / 2 + 0.5 && Math.abs(lz) < c.L / 2 + 0.6) { b.pause = 1.2; b.k += (lx >= 0 ? 0.004 : -0.004); } }
      if (my.eng) my.eng.set(my.V.rpm, inp.thr, 0.06);
      const kmh = Math.round(Math.abs(my.V.vf) * 3.6); spdEl.firstChild.nodeValue = kmh; spdEl.querySelector('small').textContent = `km/h · ${my.V.rev ? 'R' : 'D' + my.V.gear}${my.V.slip > 0.5 ? ' · drift!' : ''}`; spdEl.querySelector('i').style.width = Math.round(my.V.rpm / c.redline * 100) + '%';
      // camera
      if (drive || my.state === 'exit') { const fx = Math.sin(rs.yaw), fz = Math.cos(rs.yaw);
        if (camMode === 'pov') { seatWorld(my.m, sv); camP.set(sv.x, sv.y + 0.62, sv.z).addScaledVector(new THREE.Vector3(fx, 0, fz), 0.05); camL.set(camP.x + fx * 10, camP.y - 0.7, camP.z + fz * 10); cam.position.copy(camP); cam.lookAt(camL); if (cam.fov !== 72) { cam.fov = 72; cam.updateProjectionMatrix(); } me.visible = false; }
        else { me.visible = true; const dist = camSet.dist * (camMode === 'far' ? 1.9 : 1) + Math.abs(my.V.vf) * 0.04, h = camSet.h * (camMode === 'far' ? 1.6 : 1); const want = new THREE.Vector3(rs.x - fx * dist, rs.y + h, rs.z - fz * dist); want.y = Math.max(want.y, ground(want.x, want.z) + 0.6);
          if (!camInit) { camP.copy(want); camInit = true; } else camP.lerp(want, Math.min(1, dt * 5)); camL.set(rs.x + fx * 2, rs.y + 1.0, rs.z + fz * 2); cam.position.copy(camP); cam.lookAt(camL); if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); } } } }
    else { poseCar(my.m, my.rs, 0, my.V.spin); setDoors(my.m, my.door); }
    window.__kd = Object.assign(window.__kd || {}, { state: my.state, kmh: Math.round(Math.abs(my.V.vf) * 3.6), gear: my.V.gear, rpm: Math.round(my.V.rpm), x: my.V.x, z: my.V.z, yaw: my.V.yaw, pitch: my.rs.pitch, roll: my.rs.roll, heave: my.rs.heave, cam: camMode, remote: remote.size }); }
  // world hooks
  api.prompt = () => { if (my && my.state === 'parked' && Math.hypot(my.V.x - P.x, my.V.z - P.z) < 3.4) return { id: 'enter', label: '🚗 Enter car' }; return null; };
  const prevAct = api.onAction; api.onAction = (a) => { if (a === 'enter') getIn(); else if (prevAct) prevAct(a); };
  api.driving = () => !!my && my.state !== 'parked'; api.myCar = () => (my && my.state !== 'parked' ? { x: my.V.x, z: my.V.z } : null);
  world.move = (m) => (api.driving() ? { x: 0, y: 0, mag: 0, run: false } : m); world.driving = () => api.driving();
  window.__kdApi = { spawn: (id, c, at) => { id = id || 'pip'; if (!owned.has(id) && lsg('kemy-pals-debug') !== '1') return false; spawnCar(id, c ?? 0, at); return true; }, enter: () => getIn(), out: () => getOut(), cam: () => cycleCam(), doors: () => toggleDoors(), test: (o) => { window.__kdTest = o; }, showroom: (x, z) => { CARS.forEach((c, i) => { const m = buildCar(c, c.color); scene.add(m); poseCar(m, { x: x + i * 5.2, y: ground(x + i * 5.2, z), z, yaw: 0.5 }, 0.3, 0); setDoors(m, i % 2 ? 0.8 : 0); }); }, owned: () => [...owned], myCars: () => openMyCars() };
  return { update, destroy() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeCar(); for (const R of remote.values()) scene.remove(R.m); css.remove(); }, spawnCar };
}
void FLAT;
