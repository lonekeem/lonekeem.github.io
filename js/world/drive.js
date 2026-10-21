// Kemy World driving: your own cars (My Cars), enter / exit with hinged doors, a fixed-step vehicle model (cars.js),
// chase / far / driver-seat cameras (saved per device), speedometer, procedural engine + horn, multiplayer sync through
// Pal Park's existing presence doc (the dance-name field carries a tiny "~c" car code; x/z/yaw are the normal fields),
// remote cars interpolated + predicted. Cars never hurt anyone: people are only nudged aside. Written by Lone Keem.
import { CARS, CAR, CAR_IDX, PAINTS, carItem, buildCar, poseCar, setDoors, setBrakeLights, createVehicle, createEngineSound, honk, registerCarItems } from './cars.js';
import { ALL_ROADS, FLAT, roadD } from './layout.js';
import { createDriveHud } from './drivehud.js';
import { getCfg, onCfg, buzz, linkAccount } from './drivecfg.js';
import { createCarFx } from './carfx.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)); const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
export const CAMS = ['chase', 'far', 'pov']; const CAM_NAME = { chase: 'Chase', far: 'Far chase', pov: 'Driver seat' };
export const carCode = (id, color, door) => '~c' + CAR_IDX.indexOf(id).toString(36) + (color | 0).toString(36) + (door ? '1' : '0');
export function parseCar(dn) { if (!dn || dn.slice(0, 2) !== '~c' || dn.length < 5) return null; const id = CAR_IDX[parseInt(dn[2], 36)]; if (!id) return null; return { id, color: parseInt(dn[3], 36) || 0, door: dn[4] === '1' }; }

export function attachDrive(api, world) { const W_EXTRA = {};
  const { THREE, scene, P, me, view, S, db, cam, ground, LOW, Q } = api; const uid = (S.user && S.user.uid) || 'anon'; const hud = world.hud; const say = world.say;
  const CK = 'kemy-car-cam', SK = 'kemy-car-cam-set', MK = 'kemy-mycars-' + uid;
  let camMode = CAMS.includes(lsg(CK)) ? lsg(CK) : 'chase'; let camSet = { dist: 6.5, h: 2.4 }; try { camSet = { ...camSet, ...(JSON.parse(lsg(SK) || '{}') || {}) }; } catch { /* */ }
  let pref = {}; try { pref = JSON.parse(lsg(MK) || '{}') || {}; } catch { pref = {}; } pref.colors = pref.colors || {};
  const owned = new Set(CARS.filter((c) => c.free).map((c) => c.id)); let invLoaded = false;
  let econ = null, dia = null; async function loadInv() { try { const [{ createEconomy }, { createDiamonds }] = await Promise.all([import('../pals/economy.js'), import('../pals/armory.js')]); await registerCarItems(); econ = econ || createEconomy(db, uid); dia = dia || createDiamonds(db, uid);
    const inv = await econ.inventory(true); for (const c of CARS) if (inv[carItem(c)]) owned.add(c.id); invLoaded = true; } catch (e) { console.warn('cars inv', e); } }
  const invP = loadInv(); const carsChanged = () => dispatchEvent(new CustomEvent('kemy:cars-changed'));
  // every car I own (+ my paint pick + plate) for homes.js (parked at my house for everyone)
  async function ownedCars() { await invP; if (lsg('kemy-pals-debug') === '1' && pref.fakeAll) CARS.forEach((c) => owned.add(c.id)); return CARS.filter((c) => owned.has(c.id)).map((c) => ({ id: c.id, color: pref.colors[c.id] ?? c.color, plate: (pref.plates || {})[c.id] || null })); }
  // ---------------------------------------------------------------- my car (one active car at a time)
  let my = null; // { id, color, m, V, state: 'parked'|'enter'|'drive'|'exit', t, door, eng, cy }
  const inp = { thr: 0, brk: 0, steer: 0, hand: 0 }; const held = { gas: 0, brake: 0 };
  function nearestRoad(x, z) { let best = null, bd = 1e9; for (const r of ALL_ROADS()) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0.05, 0.95); const px = ax + dx * t, pz = az + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; const L = Math.sqrt(L2); best = { x: px - dz / L * 2, z: pz + dx / L * 2, yaw: Math.atan2(dx, dz), d }; } } return best; }
  function spawnCar(id, color, at) { removeCar(); const def = CAR[id]; const m = buildCar(def, color, { noShadow: LOW }); scene.add(m); const V = createVehicle(def, (x, z) => ground(x, z));
    let p = at; if (!p) { const r = nearestRoad(P.x, P.z); p = r && r.d < 40 ? r : { x: P.x + Math.sin(P.yaw) * 3.5, z: P.z + Math.cos(P.yaw) * 3.5, yaw: P.yaw + Math.PI / 2 }; }
    V.place(p.x, p.z, p.yaw); const cy = { x: p.x, z: p.z, r: def.Wd * 0.55, top: 99, mycar: 1 }; api.cyl.push(cy);
    my = { id, color, m, V, state: 'parked', t: 0, door: 0, doorWant: 0, cy, rs: V.update(0, inp) }; poseCar(m, my.rs, 0, 0); window.__kd && (window.__kd.spawned = id); return my; }
  function removeCar() { if (!my) return; if (my.state !== 'parked') exitNow(); scene.remove(my.m); const i = api.cyl.indexOf(my.cy); if (i >= 0) api.cyl.splice(i, 1); my = null; }
  function dropCy() { const i = my ? api.cyl.indexOf(my.cy) : -1; if (i >= 0) api.cyl.splice(i, 1); }
  // input never stays latched: pedals, handbrake, joystick all cleared on enter/exit/blur
  function resetInput() { try { H.reset(); } catch { /* */ } held.gas = held.brake = 0; inp.thr = inp.brk = inp.steer = inp.hand = 0; try { api.tc.reset && api.tc.reset(); } catch { /* */ } document.querySelectorAll('.kd-b.on').forEach((b) => b.classList.remove('on')); if (my) { my.stuckT = 0; } }
  addEventListener('blur', () => resetInput());
  // unstick: try small moves out of whatever we are wedged in, else put the car upright on the nearest road
  function freeAt(x, z, yaw, c) { const s = Math.sin(yaw), co = Math.cos(yaw); for (const f of [c.L * 0.38, 0, -c.L * 0.38]) { const px = x + s * f, pz = z + co * f; const [nx, nz] = api.collide(px, pz, ground(px, pz)); if (Math.abs(nx - px) + Math.abs(nz - pz) > 1e-3) return false; } return true; }
  function resetCar(toRoad) { if (!my) return; const c = my.m.userData.def; let p = null;
    if (!toRoad) for (const d of [0.8, -0.8, 1.6, -1.6, 2.4]) for (const sd of [0, 0.9, -0.9]) { const x = my.V.x + Math.sin(my.V.yaw) * d + Math.cos(my.V.yaw) * sd, z = my.V.z + Math.cos(my.V.yaw) * d - Math.sin(my.V.yaw) * sd; if (freeAt(x, z, my.V.yaw, c)) { p = { x, z, yaw: my.V.yaw }; break; } if (p) break; }
    if (!p) { const r = nearestRoad(my.V.x, my.V.z); p = r || { x: my.V.x, z: my.V.z, yaw: my.V.yaw }; }
    my.V.place(p.x, p.z, p.yaw); my.V.rev = false; my.V.gear = 1; my.V.heave = my.V.pitch = my.V.roll = my.V.hv = my.V.pv = my.V.rv = 0; my.stuckT = 0; held.gas = held.brake = 0; inp.hand = 0; api.markDirty(); }
  const seatWorld = (car, out) => { car.updateMatrixWorld(true); out.copy(car.userData.seat); out.y -= 0.1; return out.applyMatrix4(car.userData.chassis.matrixWorld); };
  const V_REV = (q) => q.V.rev || (q.V.vf < 0.6 && held.brake > 0.5);
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
    <div class="kd-side"><button type="button" class="kd-b" data-k="horn" aria-label="Horn"><i>📯</i>Horn</button><button type="button" class="kd-b" data-k="cam" aria-label="Car camera"><i>🎥</i><span>Chase</span></button><button type="button" class="kd-b" data-k="doors" aria-label="Doors"><i>🚪</i>Doors</button><button type="button" class="kd-b" data-k="reset" aria-label="Flip or reset car"><i>🔄</i>Reset</button><button type="button" class="kd-b" data-k="out" aria-label="Get out"><i>🚶</i>Get out</button></div>
    <div class="kd-pedals"><button type="button" class="kd-b brk" data-k="brake" aria-label="Brake or reverse"><i>🛑</i>Brake/Rev</button><button type="button" class="kd-b gas" data-k="gas" aria-label="Gas"><i>⏩</i>Gas</button></div>`; hud.appendChild(drv);
  drv.style.display = 'none'; // classic overlay kept only for its buttons' wiring; the new HUD below replaces it
  const H = createDriveHud(api, { host: hud, toast: (t) => say(t), onKey: (k) => { if (k === 'horn') { honk(); api.markDirty(); buzz(10); } else if (k === 'cam') cycleCam(); else if (k === 'doors') toggleDoors(); else if (k === 'out') getOut(); else if (k === 'reset') { if (world.respawn) world.respawn.open(); else { resetCar(true); } } else if (k === 'set') H.openSettings(); } });
  const FX = createCarFx(api); linkAccount(db, uid);
  if (!lsg(CK)) camMode = getCfg().cam; onCfg((g) => { if (CAMS.includes(g.cam) && g.cam !== camMode && !lsg(CK + '-manual')) camMode = g.cam; });
  const spdEl = drv.querySelector('#kd-spd'); const camLbl = drv.querySelector('[data-k=cam] span'); camLbl.textContent = CAM_NAME[camMode].split(' ')[0];
  drv.querySelectorAll('.kd-b').forEach((b) => { const k = b.dataset.k; const dn = (e) => { e.preventDefault(); e.stopPropagation(); try { b.setPointerCapture(e.pointerId); } catch { /* */ } b.classList.add('on');
      if (k === 'gas' || k === 'brake') held[k] = 1; else if (k === 'horn') { honk(); api.markDirty(); } else if (k === 'cam') cycleCam(); else if (k === 'doors') toggleDoors(); else if (k === 'out') getOut(); else if (k === 'reset') { resetCar(true); say('🔄 Car flipped upright on the road'); } };
    const up = () => { b.classList.remove('on'); if (k === 'gas' || k === 'brake') held[k] = 0; }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); });
  const kd = (e) => { if (!my || my.state !== 'drive' || /input|textarea/i.test(e.target.tagName)) return; const k = e.key.toLowerCase(); if (k === 'h') honk(); if (k === 'c') cycleCam(); if (k === 'f') getOut(); if (k === ' ') { inp.hand = 1; keyHand = 1; } };
  const ku = (e) => { if (e.key === ' ') { inp.hand = 0; keyHand = 0; } }; let keyHand = 0; addEventListener('keydown', kd); addEventListener('keyup', ku);
  function cycleCam() { camMode = CAMS[(CAMS.indexOf(camMode) + 1) % CAMS.length]; lss(CK, camMode); lss(CK + '-manual', '1'); camLbl.textContent = CAM_NAME[camMode].split(' ')[0]; say('🎥 ' + CAM_NAME[camMode]); }
  function toggleDoors() { if (!my) return; if (my.state === 'drive' && my.V.speed() > 0.6) { say('Stop the car to open the doors'); return; } my.doorWant = my.doorWant > 0.5 ? 0 : 1; api.markDirty(); }
  // control settings panel: a Car camera block (saved on this device)
  function carSetHTML() { return `<div class="kd-set gfx-set"><b>🚗 Car camera</b><label>Default view <select data-cc>${CAMS.map((c) => `<option value="${c}" ${c === camMode ? 'selected' : ''}>${CAM_NAME[c]}</option>`).join('')}</select></label>
    <label>Distance <input type="range" min="4" max="12" step="0.5" value="${camSet.dist}" data-cd></label><label>Height <input type="range" min="1.2" max="5" step="0.1" value="${camSet.h}" data-ch></label></div>`; }
  api.tc.on('settings:open', () => { const d = api.tc.root.querySelector('.kc-set'); if (!d || d.querySelector('.kd-set')) return; const w = document.createElement('div'); w.innerHTML = carSetHTML(); const blk = w.firstElementChild; const done = d.querySelector('[data-done]'); (done ? done.parentElement : d.lastElementChild).before(blk);
    blk.querySelector('[data-cc]').onchange = (e) => { camMode = e.target.value; lss(CK, camMode); camLbl.textContent = CAM_NAME[camMode].split(' ')[0]; };
    blk.querySelector('[data-cd]').oninput = (e) => { camSet.dist = +e.target.value; lss(SK, JSON.stringify(camSet)); }; blk.querySelector('[data-ch]').oninput = (e) => { camSet.h = +e.target.value; lss(SK, JSON.stringify(camSet)); };
    const more = document.createElement('div'); more.className = 'kd-set gfx-set'; more.innerHTML = '<b>🚗 Driving controls</b><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"><button type="button" data-dc>🎮 Driving settings</button><button type="button" data-de>✏️ Edit layout</button><button type="button" data-rs>↩️ Respawn</button></div>'; blk.after(more);
    more.querySelector('[data-dc]').onclick = () => { d.querySelector('[data-done]')?.click(); H.openSettings(); }; more.querySelector('[data-de]').onclick = () => { d.querySelector('[data-done]')?.click(); H.editLayout(); }; more.querySelector('[data-rs]').onclick = () => { d.querySelector('[data-done]')?.click(); world.respawn && world.respawn.open(); }; });
  // My Cars panel (garage list): spawn, paint, buy with Star Coins or Diamonds (existing validated shop paths)
  function openMyCars() { const d = document.createElement('div'); d.className = 'ks-panel'; hud.appendChild(d); const paint = () => {
      d.innerHTML = `<div class="ks-card"><h3>🚗 My Cars</h3><p style="margin:0 0 10px;opacity:.85;font-size:13px">Original Kemy designs. Pocket Pip is free. Others: ⭐ Star Coins or 💎 Diamonds (no real money).${invLoaded ? '' : ' Loading your garage…'}</p><div class="kd-list">${CARS.map((c) => { const own = owned.has(c.id); const col = pref.colors[c.id] ?? c.color;
        return `<div class="kd-car"><span class="e">${c.emoji}</span><div><b>${c.name}</b>${c.prem ? ' <small style="display:inline;color:#ffd23f">PREMIUM</small>' : ''}<small>${c.blurb}</small></div><div class="row">${PAINTS.map((p, i) => `<button type="button" class="kd-sw${i === col ? ' on' : ''}" style="background:${p}" data-col="${c.id}:${i}" aria-label="Paint ${i + 1}"></button>`).join('')}</div>
          <div class="row">${own ? `<button type="button" data-spawn="${c.id}">▶ Drive it</button>` : c.p ? `<button type="button" data-buy="${c.id}">Buy · ⭐ ${c.p}</button>` : `<button type="button" data-buy="${c.id}">Buy · 💎 ${c.d}</button>`}${my && my.id === c.id ? '<button type="button" class="ghost" data-park>Put away</button>' : ''}</div></div>`; }).join('')}</div><button type="button" class="ghost" data-close style="width:100%">Close</button></div>`; };
    paint(); d.onclick = async (e) => { const b = e.target.closest('button'); if (e.target === d || (b && b.dataset.close !== undefined)) { d.remove(); return; } if (!b) return;
      if (b.dataset.col) { const [id, i] = b.dataset.col.split(':'); pref.colors[id] = +i; lss(MK, JSON.stringify(pref)); carsChanged(); if (my && my.id === id) { const st = my.state; const pos = { x: my.V.x, z: my.V.z, yaw: my.V.yaw }; const wasIn = st === 'drive'; removeCar(); spawnCar(id, +i, pos); if (wasIn) { my.state = 'drive'; enterSync(); } } paint(); return; }
      if (b.dataset.spawn) { const id = b.dataset.spawn; spawnCar(id, pref.colors[id] ?? CAR[id].color); d.remove(); say(`🚗 ${CAR[id].name} is parked nearby. Walk up and tap Enter car!`); return; }
      if (b.dataset.park !== undefined) { removeCar(); paint(); return; }
      if (b.dataset.buy) { const c = CAR[b.dataset.buy]; if (!confirm(`Buy ${c.name} for ${c.p ? '⭐ ' + c.p + ' Star Coins' : '💎 ' + c.d + ' Diamonds'}?`)) return; b.disabled = true; b.textContent = 'Buying…';
        try { await loadInv(); if (c.p) await econ.buy(carItem(c)); else await dia.buy(carItem(c)); owned.add(c.id); carsChanged(); say(`🎉 ${c.name} is yours!`); } catch (er) { say(er && er.code === 'permission-denied' ? 'The shop isn’t ready for cars yet (prices not published). Try again soon!' : (er && er.message) || 'Could not buy right now'); } paint(); } }; }
  myB.onclick = openMyCars;
  // ---------------------------------------------------------------- enter / exit
  function enterSync() { P.dance = myCode(); P.danceUntil = Date.now() + 864e5; api.markDirty(); }
  function getIn() { if (!my || my.state !== 'parked') return; my.state = 'enter'; my.t = 0; my.from = { x: P.x, z: P.z }; my.cy.r = 0; dropCy(); resetInput(); my.eng = my.eng || createEngineSound(); enterSync(); H.show(true); H.setFade(true); setTimeout(() => H.setFade(false), 320); buzz(20); myB.hidden = true; api.tc.root.classList.add('kd-on'); world.hud.querySelector('.ks-act').hidden = true; window.__kd && (window.__kd.state = 'enter'); }
  function getOut() { if (!my || my.state !== 'drive') return; if (my.V.speed() > 1.2) { say('Slow down to get out 🙂'); return; } my.state = 'exit'; my.t = 0; held.gas = held.brake = 0; }
  function exitNow() { if (!my) return; const c = my.m.userData.def; const s = Math.sin(my.V.yaw), co = Math.cos(my.V.yaw); const side = c.Wd / 2 + 0.8; P.x = my.V.x + co * side; P.z = my.V.z - s * side; P.y = ground(P.x, P.z); me.scale.setScalar(1); me.visible = true;
    my.state = 'parked'; my.cy.x = my.V.x; my.cy.z = my.V.z; my.cy.r = c.Wd * 0.55; if (!api.cyl.includes(my.cy)) api.cyl.push(my.cy); resetInput(); P.dance = ''; P.danceUntil = 0; api.markDirty(); H.show(false); H.setFade(true); setTimeout(() => H.setFade(false), 320); myB.hidden = false; api.tc.root.classList.remove('kd-on'); if (my.eng) { my.eng.stop(); my.eng = null; } setBrakeLights(my.m, false); }
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
      if ((!my || my.state === 'parked') && !(ride && ride.drv === o.uid)) { const c = R.m.userData.def; const lx = (P.x - R.s.x) * Math.cos(R.s.yaw) - (P.z - R.s.z) * Math.sin(R.s.yaw), lz = (P.x - R.s.x) * Math.sin(R.s.yaw) + (P.z - R.s.z) * Math.cos(R.s.yaw);
        if (Math.abs(lx) < c.Wd / 2 + 0.45 && Math.abs(lz) < c.L / 2 + 0.45) { const push = (c.Wd / 2 + 0.45 - Math.abs(lx)) * Math.sign(lx || 1) * Math.min(1, dt * 8); P.x += Math.cos(R.s.yaw) * push; P.z -= Math.sin(R.s.yaw) * push; api.markDirty(); } } }
    for (const [id, R] of remote) if (!seen.has(id)) { scene.remove(R.m); remote.delete(id); const o = api.others.get(id); if (o && o.obj) o.obj.scale.setScalar(1); } }
  function sitPose(obj, dt) { const m = obj.userData.m; const J = m.userData.J; obj.userData.st = (obj.userData.st || 0) + dt * 60; api.posePal3D(m, { mode: 'idle', t: obj.userData.st, dt60: dt * 60, still: true });
    for (const n of ['Left', 'Right']) { if (J[n + 'UpperLeg']) J[n + 'UpperLeg'].rotation.x = -1.45; if (J[n + 'LowerLeg']) J[n + 'LowerLeg'].rotation.x = 1.35; if (J[n + 'UpperArm']) J[n + 'UpperArm'].rotation.x = -0.9; } }
  // ---------------------------------------------------------------- per frame
  const camP = new THREE.Vector3(), camL = new THREE.Vector3(); let camInit = false;
  function update(dt, now) { const nowMs = performance.now(); remoteCars(dt, nowMs); rideTick(dt, nowMs); if (!my) return;
    const c = my.m.userData.def; my.door += (my.doorWant - my.door) * Math.min(1, dt * 5);
    if (my.state === 'enter' || my.state === 'exit') { my.t += dt; const t = my.state === 'enter' ? my.t : 1.3 - my.t; my.doorWant = t < 0.95 ? 1 : 0; if (my.state === 'exit' && my.t < 0.4) my.doorWant = 1;
      seatWorld(my.m, sv); const s = Math.sin(my.V.yaw), co = Math.cos(my.V.yaw); sv2.set(my.V.x + co * (c.Wd / 2 + 0.8), ground(my.V.x, my.V.z), my.V.z - s * (c.Wd / 2 + 0.8)); const k = clamp((t - 0.3) / 0.6, 0, 1);
      me.position.lerpVectors(sv2, sv, k); me.rotation.y = my.V.yaw + (1 - k) * Math.PI / 2; me.scale.setScalar(1 - k * 0.4); if (k > 0.6) sitPose(me, dt);
      if (my.state === 'enter' && my.t > 1.3) { my.state = 'drive'; camInit = false; say('🚗 Gas ⏩ to drive · Brake 🛑 (hold to reverse) · steer with the joystick'); window.__kd && (window.__kd.state = 'drive'); } if (my.state === 'exit' && my.t > 1.3) { exitNow(); window.__kd && (window.__kd.state = 'parked'); } }
    if (my.state === 'drive' || my.state === 'enter' || my.state === 'exit') { const mv = api.tc.move; const drive = my.state === 'drive';
      const jy = drive && !window.__kdTest ? -mv.y : 0, jx = drive && !window.__kdTest ? mv.x : 0; const T = window.__kdTest || {};
      const g = getCfg(); const hi = drive ? H.input(dt, my) : { steer: 0, thr: 0, brk: 0, hand: 0, shift: 0 }; my.V.manual = g.trans === 'manual'; my.V.tc = g.tc; my.V.abs = g.abs; my.V.drift = g.drift; if (hi.shift) my.V.wantShift = hi.shift;
      inp.thr = drive ? clamp(Math.max(held.gas, hi.thr, jy > 0.25 ? jy : 0, T.thr || 0), 0, 1) : 0; inp.brk = drive ? clamp(Math.max(held.brake, hi.brk, jy < -0.25 ? -jy : 0, T.brk || 0), 0, 1) : (my.V.speed() > 0.1 ? 1 : 0);
      inp.steer = drive ? clamp(-hi.steer - (jx || 0) - (T.steer || 0), -1, 1) : 0; if (drive && hi.hand) inp.hand = 1; else if (drive && !keyHand) inp.hand = 0;
      if (drive && g.assist && !g.drift && Math.abs(inp.steer) < 0.05 && my.V.speed() > 3) inp.steer = clamp(-my.V.r * 0.35, -0.3, 0.3);
      if (drive && g.autoBrake && my.V.vf > 2) { const look = 2 + my.V.vf * 0.5, ax = my.V.x + Math.sin(my.V.yaw) * look, az = my.V.z + Math.cos(my.V.yaw) * look; const [bx, bz] = api.collide(ax, az, ground(ax, az)); if (Math.abs(bx - ax) + Math.abs(bz - az) > 1e-3) { inp.brk = Math.max(inp.brk, 0.85); inp.thr = 0; } }
      const rs = my.V.update(dt, inp, (V) => { // collisions (world colliders), soft: slide + lose speed
        const s = Math.sin(V.yaw), co = Math.cos(V.yaw); let px = 0, pz = 0; for (const f of [c.L * 0.38, 0, -c.L * 0.38]) { const x = V.x + s * f, z = V.z + co * f; const [nx, nz] = api.collide(x, z, ground(x, z)); if (Math.abs(nx - x) + Math.abs(nz - z) > 1e-4) { V.x += (nx - x); V.z += (nz - z); px += nx - x; pz += nz - z; } }
        const pl = Math.hypot(px, pz); if (pl > 1e-4) { const into = -(s * px + co * pz) / pl; if (into * V.vf > 0) { const nowB = performance.now(); if (Math.abs(V.vf) > 3 && nowB - (my.bz || 0) > 400) { my.bz = nowB; buzz(25); V.vf = -V.vf * 0.28; /* soft bounce off */ } else V.vf *= 0.9; } V.vl *= 0.85; } });
      if (drive) { const want = Math.max(inp.thr, V_REV(my) ? inp.brk : 0); if (want > 0.3 && my.V.speed() < 0.35) { my.stuckT = (my.stuckT || 0) + dt; if (my.stuckT > 1.5) { my.nudges = (my.nudges || 0) + 1; resetCar(my.nudges > 2); if (my.nudges > 2) { my.nudges = 0; say('🔄 Car reset onto the road'); } } } else { my.stuckT = 0; if (my.V.speed() > 3) my.nudges = 0; } }
      // lane assist: hands off the wheel on a road -> gently line up with the road (either direction)
      if (drive && Math.abs(inp.steer) < 0.05 && my.V.vf > 7) { my.laT = (my.laT || 0) - dt; if (my.laT <= 0) { my.laT = 0.25; my.la = nearestRoad(my.V.x, my.V.z); } const r0 = my.la; if (r0 && r0.d < 7) { let dy = r0.yaw - my.V.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); if (Math.abs(dy) > Math.PI / 2) dy = Math.atan2(Math.sin(dy + Math.PI), Math.cos(dy + Math.PI)); if (Math.abs(dy) < 0.3) my.V.yaw += dy * Math.min(1, dt * 0.9); } }
      my.rs = rs; poseCar(my.m, rs, my.V.steer, my.V.spin); setDoors(my.m, my.door); setBrakeLights(my.m, inp.brk > 0.1 && !my.V.rev);
      if (drive) { seatWorld(my.m, sv); me.position.copy(sv); me.rotation.y = rs.yaw; me.scale.setScalar(0.6); sitPose(me, dt); }
      P.x = my.V.x; P.z = my.V.z; P.yaw = my.V.yaw; P.y = ground(P.x, P.z); P.vy = 0; if (my.V.speed() > 0.05) api.markDirty();
      const code = myCode(); if (P.dance !== code && my.state !== 'exit') { P.dance = code; P.danceUntil = Date.now() + 864e5; api.markDirty(); }
      // nudge bots out of the way (gently)
      for (const b of world.bots) { const lx = (b.x - my.V.x) * Math.cos(my.V.yaw) - (b.z - my.V.z) * Math.sin(my.V.yaw), lz = (b.x - my.V.x) * Math.sin(my.V.yaw) + (b.z - my.V.z) * Math.cos(my.V.yaw); if (Math.abs(lx) < c.Wd / 2 + 0.5 && Math.abs(lz) < c.L / 2 + 0.6) { b.pause = 1.2; b.k += (lx >= 0 ? 0.004 : -0.004); } }
      if (my.eng) my.eng.set(my.V.rpm, inp.thr, 0.06);
      const kmh = Math.round(Math.abs(my.V.vf) * 3.6); if (drive) H.gauges(kmh, my.V.rpm, c.redline, my.V.gear, my.V.rev); if (my.V.shifted) { my.V.shifted = 0; buzz(10); }
      FX.update(dt, my.m, my.V, rs, (api.nightU && api.nightU.value) || 0, roadD(rs.x, rs.z) > 1.5, inp.brk > 0.6);
      H.blur.style.opacity = !LOW && (Q.tier === 'high' || Q.tier === 'ultra' || api.ULTRA) && drive ? clamp((Math.abs(my.V.vf) - 16) / 18, 0, 0.85) : 0;
      // camera
      if (drive || my.state === 'exit') { const fx = Math.sin(rs.yaw), fz = Math.cos(rs.yaw);
        if (camMode === 'pov') { seatWorld(my.m, sv); camP.set(sv.x, sv.y + 0.62, sv.z).addScaledVector(new THREE.Vector3(fx, 0, fz), 0.05); camL.set(camP.x + fx * 10, camP.y - 0.7, camP.z + fz * 10); cam.position.copy(camP); cam.lookAt(camL); if (cam.fov !== 72) { cam.fov = 72; cam.updateProjectionMatrix(); } me.visible = false; }
        else { me.visible = true; const dist = camSet.dist * (camMode === 'far' ? 1.9 : 1) + Math.abs(my.V.vf) * 0.04, h = camSet.h * (camMode === 'far' ? 1.6 : 1); const want = new THREE.Vector3(rs.x - fx * dist, rs.y + h, rs.z - fz * dist); want.y = Math.max(want.y, ground(want.x, want.z) + 0.6);
          if (!camInit) { camP.copy(want); camInit = true; } else camP.lerp(want, Math.min(1, dt * 5)); camL.set(rs.x + fx * 2, rs.y + 1.0, rs.z + fz * 2); cam.position.copy(camP); if (getCfg().shake && Math.abs(my.V.vf) > 14) { const k = Math.min(1, (Math.abs(my.V.vf) - 14) / 20) * 0.035, t = nowMs / 1000; camP.x += Math.sin(t * 37) * k; camP.y += Math.sin(t * 43 + 1) * k; } cam.position.copy(camP); cam.lookAt(camL); const fv = getCfg().fov + Math.min(8, Math.abs(my.V.vf) * 0.2); if (Math.abs(cam.fov - fv) > 0.3) { cam.fov = fv; cam.updateProjectionMatrix(); } } } }
    else { poseCar(my.m, my.rs, 0, my.V.spin); setDoors(my.m, my.door); FX.update(dt, null); H.blur.style.opacity = 0; }
    window.__kd = Object.assign(window.__kd || {}, { state: my.state, kmh: Math.round(Math.abs(my.V.vf) * 3.6), gear: my.V.gear, rpm: Math.round(my.V.rpm), x: my.V.x, z: my.V.z, yaw: my.V.yaw, pitch: my.rs.pitch, roll: my.rs.roll, heave: my.rs.heave, cam: camMode, remote: remote.size }); }
  // ---------------------------------------------------------------- 🧑‍🤝‍🧑 Ride along: passenger seat (synced through the presence 'dn' code, no extra writes)
  // passenger asks '~q'+driver8 -> driver accepts (auto for mutual follows, else a popup) by adding 'o'+passenger8 to its car code -> passenger shows '~r'+driver8
  const U8 = (u) => String(u || '').slice(0, 8); const me8 = U8(uid); let rider = null, riderSeen = 0; let ride = null; const asked = new Map(); const sp = new THREE.Vector3();
  const myCode = () => carCode(my.id, my.color, my.door > 0.5) + (rider ? 'o' + rider : '');
  const riderOf = (dn) => (dn && dn.slice(0, 2) === '~c' && dn[5] === 'o' ? dn.slice(6, 14) : null);
  const seatP = (car, out) => { car.updateMatrixWorld(true); out.copy(car.userData.seat); out.x = -out.x; out.y -= 0.1; return out.applyMatrix4(car.userData.chassis.matrixWorld); };
  const rcss = document.createElement('style'); rcss.textContent = `.kr-k{left:auto!important;transform:none!important;right:calc(max(8px,env(safe-area-inset-right)) + 6px);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 236px)!important}.kr-k button{font-size:12px!important;padding:6px 10px!important}.kr-bar{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 74px);display:flex;gap:8px;pointer-events:auto;z-index:9}.kr-bar[hidden],.kr-pop[hidden]{display:none}.kr-bar button,.kr-pop button{border:2px solid #fff;border-radius:999px;background:rgba(30,20,60,.8);color:#fff;font:800 14px Inter,sans-serif;height:44px;padding:0 16px}
.kr-pop{position:absolute;left:50%;transform:translateX(-50%);top:calc(max(10px,env(safe-area-inset-top)) + 60px);background:rgba(255,255,255,.97);color:#111;border-radius:16px;padding:10px 12px;pointer-events:auto;z-index:20;font:700 14px Inter,sans-serif;text-align:center;max-width:90vw}.kr-pop button{background:#6d28d9;margin:6px 4px 0;height:40px}.kr-pop button.g{background:#9ca3af}`; document.head.appendChild(rcss);
  const rbar = document.createElement('div'); rbar.className = 'kr-bar'; rbar.hidden = true; rbar.innerHTML = '<button data-c>🎥 Camera</button><button data-x>🚪 Exit ride</button>'; hud.appendChild(rbar);
  // driver side: drop the passenger (they can ask again later; a dropped rider is not auto-accepted for 2 min)
  const kbar = document.createElement('div'); kbar.className = 'kr-bar kr-k'; kbar.hidden = true; kbar.innerHTML = '<button data-k>👋 Drop passenger</button>'; hud.appendChild(kbar); const kicked = new Map();
  kbar.querySelector('[data-k]').onclick = () => { if (!rider) return; kicked.set(rider, performance.now()); rider = null; if (my) { P.dance = myCode(); P.danceUntil = Date.now() + 864e5; api.markDirty(); } say('👋 Passenger dropped off'); kbar.hidden = true; };
  const rpop = document.createElement('div'); rpop.className = 'kr-pop'; rpop.hidden = true; hud.appendChild(rpop);
  rbar.querySelector('[data-x]').onclick = () => leaveRide('🚪 You hopped out'); rbar.querySelector('[data-c]').onclick = () => { if (ride) { ride.cam = ride.cam === 'pov' ? 'chase' : ride.cam === 'chase' ? 'far' : 'pov'; say('🎥 ' + ride.cam); } };
  function askRide(du) { const o = api.others.get(du); if (!o || !parseCar(o.dn)) return; if (my && my.state !== 'parked') return; ride = { drv: du, st: 'ask', t: performance.now(), cam: 'chase' }; P.dance = '~q' + U8(du); P.danceUntil = Date.now() + 864e5; api.markDirty(); say('🧑‍🤝‍🧑 Asking ' + (o.name || 'the driver') + ' for a ride…'); }
  function leaveRide(msg) { if (!ride) return; const R = remote.get(ride.drv); ride = null; P.dance = ''; P.danceUntil = 0; me.scale.setScalar(1); me.visible = true; rbar.hidden = true; if (R) { const s = Math.sin(R.s.yaw), co = Math.cos(R.s.yaw), c = R.m.userData.def; const x = R.s.x - co * (c.Wd / 2 + 0.9), z = R.s.z + s * (c.Wd / 2 + 0.9); const [nx, nz] = api.collide(x, z, ground(x, z)); P.x = nx; P.z = nz; P.y = ground(nx, nz); } api.markDirty(); if (msg) say(msg); window.__kd && (window.__kd.ride = null); }
  async function isFriend(u) { try { const { doc: d2, getDoc: g2 } = await import('https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'); const [a, b] = await Promise.all([g2(d2(db, 'follows', uid + '_' + u)), g2(d2(db, 'follows', u + '_' + uid))]); return a.exists() && b.exists(); } catch { return false; } }
  function accept(o) { rider = U8(o.uid); riderSeen = performance.now(); rpop.hidden = true; if (my) { P.dance = myCode(); P.danceUntil = Date.now() + 864e5; api.markDirty(); } say('🧑‍🤝‍🧑 ' + (o.name || 'A Pal') + ' hopped in!'); }
  function rideTick(dt, nowMs) {
    // driver side: requests + my passenger in my car
    if (my && my.state !== 'parked') { for (const o of api.others.values()) { if (o.dn === '~q' + me8 && !rider && !asked.has(o.uid) && !(kicked.has(U8(o.uid)) && nowMs - kicked.get(U8(o.uid)) < 120000)) { asked.set(o.uid, nowMs); isFriend(o.uid).then((f) => { if (rider || !my || my.state === 'parked') return; if (f) accept(o); else { rpop.innerHTML = `🧑‍🤝‍🧑 <b>${String(o.name || 'A Pal').replace(/[<>&]/g, '')}</b> wants to ride along<br><button data-a>Accept</button><button class="g" data-n>No thanks</button>`; rpop.hidden = false; rpop.querySelector('[data-a]').onclick = () => accept(o); rpop.querySelector('[data-n]').onclick = () => { rpop.hidden = true; }; setTimeout(() => { rpop.hidden = true; }, 40000); } }); }
        if (rider && U8(o.uid) === rider && (o.dn === '~r' + me8 || o.dn === '~q' + me8)) { riderSeen = nowMs; if (o.obj && o.dn === '~r' + me8) { seatP(my.m, sp); o.obj.position.copy(sp); o.obj.rotation.y = my.V.yaw; o.obj.scale.setScalar(0.6); sitPose(o.obj, dt); } } }
      if (rider && nowMs - riderSeen > 8000) { rider = null; P.dance = myCode(); api.markDirty(); } }
    else if (rider) rider = null;
    kbar.hidden = !(rider && my && my.state === 'drive');
    for (const [u, t] of asked) if (nowMs - t > 30000) asked.delete(u);
    // third parties: show other drivers' passengers in their cars
    for (const o of api.others.values()) if (o.obj && o.dn && o.dn.slice(0, 2) === '~r' && o.dn.slice(2) !== me8) { for (const [du, R] of remote) if (U8(du) === o.dn.slice(2) && riderOf(api.others.get(du)?.dn) === U8(o.uid)) { seatP(R.m, sp); o.obj.position.copy(sp); o.obj.rotation.y = R.s.yaw; o.obj.scale.setScalar(0.6); sitPose(o.obj, dt); } }
    // passenger side
    if (!ride) return; const o = api.others.get(ride.drv); const R = remote.get(ride.drv); const okd = o && riderOf(o.dn) === me8;
    if (ride.st === 'ask') { if (okd && R) { ride.st = 'on'; P.dance = '~r' + U8(ride.drv); api.markDirty(); rbar.hidden = false; say('🚗 Riding with ' + (o.name || 'a Pal') + ' · 🎥 to switch view · 🚪 to hop out'); } else if (!o || !parseCar(o.dn) || nowMs - ride.t > 45000) { leaveRide('No answer this time 🙂'); return; } else return; }
    if (!okd || !R) { leaveRide('🚗 The ride ended'); return; }
    seatP(R.m, sp); me.position.copy(sp); me.rotation.y = R.s.yaw; me.scale.setScalar(0.6); sitPose(me, dt); P.x = R.s.x; P.z = R.s.z; P.y = ground(P.x, P.z);
    const fx = Math.sin(R.s.yaw), fz = Math.cos(R.s.yaw);
    if (ride.cam === 'pov') { me.visible = false; camP.set(sp.x, sp.y + 0.62, sp.z); camL.set(camP.x + fx * 10, camP.y - 0.7, camP.z + fz * 10); cam.position.copy(camP); cam.lookAt(camL); }
    else { me.visible = true; const dist = ride.cam === 'far' ? 12 : 6.5, h = ride.cam === 'far' ? 3.8 : 2.4; const want = new THREE.Vector3(R.s.x - fx * dist, ground(R.s.x, R.s.z) + h, R.s.z - fz * dist); camP.lerp(want, Math.min(1, dt * 5)); if (camP.distanceTo(want) > 30) camP.copy(want); camL.set(R.s.x + fx * 2, ground(R.s.x, R.s.z) + 1, R.s.z + fz * 2); cam.position.copy(camP); cam.lookAt(camL); }
    window.__kd = Object.assign(window.__kd || {}, { ride: ride.st, rideCam: ride.cam }); }
  // world hooks
  api.prompt = () => { if (my && my.state === 'parked' && Math.hypot(my.V.x - P.x, my.V.z - P.z) < 3.4) return { id: 'enter', label: '🚗 Enter car' };
    if (!ride && (!my || my.state === 'parked')) for (const [du, R] of remote) if (Math.hypot(R.s.x - P.x, R.s.z - P.z) < 3.6 && !riderOf(api.others.get(du)?.dn)) return { id: 'ride:' + du, label: '🧑‍🤝‍🧑 Ride along' }; return null; };
  const prevAct = api.onAction; api.onAction = (a) => { if (a === 'enter') getIn(); else if (a && a.startsWith('ride:')) askRide(a.slice(5)); else if (prevAct) prevAct(a); };
  api.driving = () => !!my && my.state !== 'parked'; api.myCar = () => (my && my.state !== 'parked' ? { x: my.V.x, z: my.V.z } : null);
  world.move = (m) => (api.driving() || (ride && ride.st === 'on') ? { x: 0, y: 0, mag: 0, run: false } : m); world.driving = () => api.driving() || !!(ride && ride.st === 'on'); api.riding = () => !!(ride && ride.st === 'on');
  window.__kdApi = { remotes: () => [...remote.keys()], askRide, leaveRide, accept: (u) => { const o = api.others.get(u); if (o) accept(o); }, rider: () => rider, ride: () => ride, spawn: (id, c, at) => { id = id || 'pip'; if (!owned.has(id) && lsg('kemy-pals-debug') !== '1') return false; spawnCar(id, c ?? 0, at); return true; }, enter: () => getIn(), out: () => getOut(), cam: () => cycleCam(), reset: (r) => resetCar(r !== false), stuckProbe: () => ({ stuckT: my && my.stuckT, nudges: my && my.nudges, ownCy: !!my && api.cyl.includes(my.cy) }), doors: () => toggleDoors(), test: (o) => { window.__kdTest = o; }, showroom: (x, z) => { CARS.forEach((c, i) => { const m = buildCar(c, c.color); scene.add(m); poseCar(m, { x: x + i * 5.2, y: ground(x + i * 5.2, z), z, yaw: 0.5 }, 0.3, 0); setDoors(m, i % 2 ? 0.8 : 0); }); }, owned: () => [...owned], myCars: () => openMyCars() };
  const mine = () => (my ? { id: my.id, color: my.color, x: my.V.x, z: my.V.z, yaw: my.V.yaw, state: my.state, speed: my.V.speed() } : null);
  function stash() { if (!my) return; exitNow(); removeCar(); } // park in a garage bay: hop out and the car stays in the bay
  function place(id, color, at, enter) { if (!CAR[id]) return null; spawnCar(id, color, at); if (enter) getIn(); return my; }
  function isOwned(id) { return owned.has(id); }
  W_EXTRA.ownedCars = ownedCars; W_EXTRA.pref = pref; W_EXTRA.savePref = () => { lss(MK, JSON.stringify(pref)); carsChanged(); }; W_EXTRA.owned = owned;
  return { ...W_EXTRA, update, destroy() { removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeCar(); for (const R of remote.values()) scene.remove(R.m); css.remove(); rcss.remove(); rbar.remove(); rpop.remove(); H.destroy(); FX.destroy(); }, spawnCar, mine, stash, place, removeCar, isOwned, resetCar, resetAt: (p) => { if (!my) return; my.V.place(p.x, p.z, p.yaw || 0); my.V.rev = false; my.V.gear = 1; my.stuckT = 0; api.markDirty(); } };
}
void FLAT;
