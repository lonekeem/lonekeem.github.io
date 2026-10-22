// Kemy Helper's team: local pals in matching yellow, not networked. They wander
// like players: look around, wave, sit, browse, and some park the car and hop out.
// The yellow outfit and Helper tag stay on. Only nearby pals are drawn.
// Written by Lone Keem.
import { poseCar } from '../world/cars.js';
import { areaAt, BOUNDS, roadD } from '../world/layout.js';
import { note, setHelperPlace, toastFixed } from './watch.js';
import { placeOf, scrub } from './core.js';
import { ROSTER, crewCount, pathAt, aheadBlocked, groundIssue, teamShown, lifeInit, stepLife } from './team.js';
import { playLabel, stepPlay } from './play.js';

function starGeo(THREE) {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? 0.42 : 1;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i) sh.lineTo(x, y); else sh.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
  g.center();
  return g;
}

function matsOf(THREE) {
  // Flat colors. These pals are cheap local stand-ins, and a night scene
  // must not turn the yellow crew into dark blobs.
  const m = (color, extra) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra));
  return {
    yellow: m('#ffe14a'),
    vest: m('#ffb703'),
    gold: m('#ffd34d'),
    star: m('#6d28d9'),
    ink: m('#3b2508'),
    glass: m('#fff6cc', { transparent: true, opacity: 0.55 })
  };
}

function buildPal(THREE, mats, star) {
  const g = new THREE.Group();
  g.name = 'kemy-helper';
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 3, 8), mats.yellow);
  body.position.y = 0.7;
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.22), mats.vest);
  vest.position.set(0, 0.78, 0.12);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mats.yellow);
  head.position.y = 1.26;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.12, 8), mats.gold);
  cap.position.y = 1.46;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 10), mats.gold);
  brim.position.y = 1.4;
  const badge = new THREE.Mesh(star, mats.star);
  badge.name = 'badge';
  badge.scale.setScalar(0.12);
  badge.position.set(0, 0.82, 0.26);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 2, 6), mats.yellow);
  armL.name = 'armL';
  armL.position.set(-0.34, 0.76, 0);
  armL.rotation.z = 0.25;
  const armR = armL.clone();
  armR.name = 'armR';
  armR.position.x = 0.34;
  armR.rotation.z = -0.25;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), mats.ink);
    e.position.set(s * 0.08, 1.28, 0.2);
    g.add(e);
  }
  g.add(body, vest, head, cap, brim, badge, armL, armR);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return g;
}

function buildCar(THREE, mats, star) {
  const g = new THREE.Group();
  g.name = 'kh-car';
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.4, 2.55), mats.yellow);
  body.position.y = 0.52;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.36, 1.15), mats.vest);
  cabin.position.set(0, 0.86, -0.12);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.26, 1), mats.glass);
  glass.position.set(0, 1.02, -0.12);
  const wgeo = new THREE.CylinderGeometry(0.26, 0.26, 0.16, 8);
  wgeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.68, 0.78], [0.68, 0.78], [-0.68, -0.78], [0.68, -0.78]]) {
    const w = new THREE.Mesh(wgeo, mats.ink);
    w.name = 'wheel';
    w.position.set(x, 0.26, z);
    wheels.push(w);
    g.add(w);
  }
  const badge = new THREE.Mesh(star, mats.star);
  badge.scale.setScalar(0.16);
  badge.position.set(0, 0.76, 1.05);
  g.add(body, cabin, glass, badge);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return g;
}

function dress(root, lead) {
  const badge = root.getObjectByName('badge');
  if (badge) badge.scale.setScalar(lead ? 0.2 : 0.12);
  const armL = root.getObjectByName('armL');
  const armR = root.getObjectByName('armR');
  root.userData.arms = [armL, armR];
}

export function attachHelper(api, W) {
  const { THREE, scene, P, view } = api;
  const ground = api.ground;
  const mats = matsOf(THREE);
  const star = starGeo(THREE);
  const proto = buildPal(THREE, mats, star);
  const carProto = buildCar(THREE, mats, star);
  const members = ROSTER.map((src) => {
    const m = {
      id: src.id, role: src.role, name: src.name, lead: !!src.lead, job: src.job,
      speed: src.speed, side: src.side || 0, path: src.path || null,
      dist: src.dist || 0, x: src.x || 0, z: src.z || 0, yaw: src.yaw || 0,
      life: lifeInit(), mode: 'go', onFoot: src.role !== 'drive', say: '',
      fx: src.x || 0, fz: src.z || 0, fyaw: src.yaw || 0,
      root: null, car: null, tag: null, bub: null, stool: null, toy: null, prevG: null, spin: 0, cool: 0, step: 0
    };
    if (m.path) {
      const p = pathAt(m.path, m.dist, m.side);
      m.x = p.x; m.z = p.z; m.yaw = p.yaw;
      m.fx = p.x; m.fz = p.z; m.fyaw = p.yaw;
    }
    return m;
  });

  const tags = view;
  if (!document.getElementById('kh-css')) {
    const st = document.createElement('style');
    st.id = 'kh-css';
    st.textContent = `.ks-tag.kh{z-index:8;pointer-events:auto;cursor:pointer;background:#ffe14a;border:2px solid #6d28d9;color:#3b2504;font-weight:800;padding:3px 8px}
.ks-tag.kh.lead{background:#ffd34d}
.kh-act{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(18px,env(safe-area-inset-bottom)) + 132px);pointer-events:auto;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid #6d28d9;background:#ffe14a;color:#3b2504;font:800 15px Inter,system-ui,sans-serif;z-index:8;box-shadow:0 4px 14px rgba(0,0,0,.28)}
.kh-act[hidden]{display:none}
.ks-panel[hidden]{display:none}
.kh-card textarea{width:100%;min-height:88px;border-radius:12px;border:0;padding:10px;font:600 16px Inter,system-ui,sans-serif;box-sizing:border-box;color:#24133f}
.kh-card .row{display:flex;gap:8px}
.kh-card .row button{flex:1}
.kh-job{margin:0 0 8px;font-weight:700}
.kh-say{position:absolute;z-index:8;max-width:140px;background:#fff;color:#3b2504;border:2px solid #6d28d9;border-radius:12px;padding:3px 8px;font:700 12px Inter,system-ui,sans-serif;pointer-events:none;white-space:nowrap}
.kh-say[hidden]{display:none}`;
    document.head.appendChild(st);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kh-act';
  btn.hidden = true;
  btn.textContent = 'Kemy Helper';
  const panel = document.createElement('div');
  panel.className = 'ks-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="ks-card kh-card"><h3 data-title>Kemy Helper</h3><p class="kh-job" data-job></p><p style="margin:0 0 8px;opacity:.9">I keep chat kind. You can report a player, or tell me if something in the game is broken.</p><textarea maxlength="140" placeholder="A broken spot (optional)" aria-label="What happened?"></textarea><div class="row"><button type="button" data-r>Report</button><button type="button" data-s>Send note</button><button type="button" class="ghost" data-x>Close</button></div></div>`;
  (W.hud || view).append(btn, panel);
  const box = panel.querySelector('textarea');
  const sendB = panel.querySelector('[data-s]');
  const titleEl = panel.querySelector('[data-title]');
  const jobEl = panel.querySelector('[data-job]');
  let focus = members[0];
  panel.querySelector('[data-x]').onclick = () => { panel.hidden = true; };
  panel.onclick = (e) => { if (e.target === panel) panel.hidden = true; };
  panel.querySelector('[data-r]').onclick = () => {
    panel.hidden = true;
    if (window.kemyModReport) window.kemyModReport({ targetType: 'chat message', targetId: 'helper', name: focus && focus.lead ? 'Kemy Helper' : 'Helper' });
  };
  btn.onclick = () => {
    titleEl.textContent = focus && focus.lead ? 'Kemy Helper' : 'Helper';
    const job = focus ? focus.job : '';
    jobEl.textContent = focus && focus.mode === 'play' ? job.replace('a quick game', playLabel()) : job;
    panel.hidden = false;
    box.focus();
  };
  sendB.onclick = () => {
    const text = scrub(box.value);
    if (text.length < 2) { if (W.say) W.say('Tell me a little more.'); return; }
    sendB.disabled = true;
    note({ type: 'note', text, autoFixed: false, game: placeGame(P.x, P.z), place: here() }).finally(() => { sendB.disabled = false; });
    box.value = '';
    panel.hidden = true;
    if (W.say) W.say('Thanks. Kemy Helper wrote that down.');
  };

  let griefAt = 0;
  let griefFrom = null;
  let griefSent = 0;
  const SPAWNS = [[0, 8], [30, 31]];
  function watchGrief() {
    const now = Date.now();
    if (now - griefAt < 1000) return;
    griefAt = now;
    let near = false;
    for (let i = 0; i < SPAWNS.length; i++) if (Math.hypot(P.x - SPAWNS[i][0], P.z - SPAWNS[i][1]) < 2.2) near = true;
    if (!griefFrom) griefFrom = { x: P.x, z: P.z, t: now };
    const moved = Math.hypot(P.x - griefFrom.x, P.z - griefFrom.z);
    if (!near || moved > 1.2) { griefFrom = { x: P.x, z: P.z, t: now }; return; }
    if (now - griefFrom.t >= 45000 && now - griefSent > 600000 && window.kemyModFlag) {
      griefSent = now;
      window.kemyModFlag('', 'grief', '', now - griefFrom.t);
    }
  }
  let cap = members.length;
  let flagT = 0;
  let scanT = 0;
  let stuckFor = 0;
  let last = { x: P.x, z: P.z };
  let carBad = 0;
  let fixingUntil = 0;
  let glanceI = 0;
  const tv = new THREE.Vector3();
  const showDist = () => (api.LOW ? 46 : 72);

  function flags() {
    let saver = false, saveData = false;
    try { saver = localStorage.getItem('kemy-fps-saver') === '1'; } catch { /* */ }
    try { saveData = !!(navigator.connection && navigator.connection.saveData); } catch { /* */ }
    const tier = api.Q && api.Q.tier;
    return { low: !!api.LOW, saver, saveData, tier, shown: teamShown() };
  }
  function refreshCap() { cap = crewCount(flags()); }
  const onToggle = () => { flagT = 2; };
  addEventListener('kemy:helper-team', onToggle);
  refreshCap();

  function here() { return placeOf(areaAt(P.x, P.z), P.x, P.z); }
  function placeGame(px, pz) {
    const name = areaAt(px, pz).toLowerCase();
    if (name.includes('street')) return 'street';
    if (name.includes('park')) return 'park';
    return 'world';
  }
  setHelperPlace(() => ({ game: placeGame(P.x, P.z), place: here() }));

  function ensure(m) {
    if (!m.root) {
      m.root = proto.clone(true);
      dress(m.root, m.lead);
      if (m.id === 'play') {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.28, 8), mats.vest);
        stool.position.y = 0.14;
        const toy = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.18), mats.star);
        toy.position.set(0, 0.72, 0.36);
        stool.frustumCulled = false;
        toy.frustumCulled = false;
        stool.visible = false;
        toy.visible = false;
        m.stool = stool;
        m.toy = toy;
        m.root.add(stool, toy);
      }
      scene.add(m.root);
      m.root.visible = false;
    }
    if (m.role === 'drive' && !m.car) {
      m.car = carProto.clone(true);
      m.car.userData.wheels = [];
      m.car.traverse((o) => { if (o.name === 'wheel') m.car.userData.wheels.push(o); });
      scene.add(m.car);
      m.car.add(m.root);
      m.root.position.set(0, 0.42, -0.15);
      m.root.scale.setScalar(0.68);
      m.root.rotation.set(0, 0, 0);
      m.car.visible = false;
    }
    if (!m.tag) {
      m.tag = document.createElement('div');
      m.tag.className = 'ks-tag kh' + (m.lead ? ' lead' : '');
      m.tag.textContent = m.name;
      m.tag.dataset.n = m.name;
      m.tag.onclick = (e) => { e.stopPropagation(); focus = m; btn.click(); };
      tags.appendChild(m.tag);
      m.bub = document.createElement('div');
      m.bub.className = 'kh-say';
      m.bub.hidden = true;
      tags.appendChild(m.bub);
    }
  }

  function mount(m, onFoot) {
    if (!m.car || !m.root) return;
    if (onFoot && m.root.parent === m.car) {
      scene.add(m.root);
      m.root.scale.set(1, 1, 1);
      m.root.position.set(m.fx, ground(m.fx, m.fz), m.fz);
      m.root.rotation.set(0, m.fyaw, 0);
    } else if (!onFoot && m.root.parent !== m.car) {
      m.car.add(m.root);
      m.root.scale.setScalar(0.68);
      m.root.position.set(0, 0.42, -0.15);
      m.root.rotation.set(0, 0, 0);
    }
  }

  function spot(m) {
    return placeOf(areaAt(m.x, m.z), m.x, m.z);
  }
  function fixMember(m, type, text) {
    const now = performance.now();
    if (now < m.cool) return;
    m.cool = now + 4000;
    if (m.path) {
      m.dist += 8;
      const p = pathAt(m.path, m.dist, m.side);
      m.x = p.x; m.z = p.z; m.yaw = p.yaw;
      m.fx = p.x; m.fz = p.z; m.fyaw = p.yaw;
      m.life.mode = 'go'; m.life.left = 0; m.life.say = ''; m.life.spot = null; m.onFoot = m.role !== 'drive';
    }
    toastFixed();
    note({ type, text, autoFixed: true, game: placeGame(m.x, m.z), place: spot(m) });
  }

  function fixPlayer(type, text) {
    const nowMs = performance.now();
    if (nowMs < fixingUntil) return;
    fixingUntil = nowMs + 2500;
    const go = W.respawn && W.respawn.go;
    if (go) go('safe', true);
    else { P.x = 0; P.z = 6; P.y = ground(0, 6) + 0.1; P.vy = 0; }
    toastFixed();
    note({ type, text, autoFixed: true, game: placeGame(Number.isFinite(P.x) ? P.x : 0, Number.isFinite(P.z) ? P.z : 6), place: here() });
  }

  function scan(dt) {
    scanT += dt;
    const badNum = !Number.isFinite(P.x) || !Number.isFinite(P.y) || !Number.isFinite(P.z);
    const gy = Number.isFinite(P.x) && Number.isFinite(P.z) ? ground(P.x, P.z) : 0;
    const under = Number.isFinite(P.y) && (P.y < -30 || P.y < gy - 6);
    const out = Number.isFinite(P.x) && (P.x < BOUNDS.x0 - 8 || P.x > BOUNDS.x1 + 8 || P.z < BOUNDS.z0 - 8 || P.z > BOUNDS.z1 + 8);
    if (badNum) { fixPlayer('nan', 'position'); stuckFor = 0; return; }
    if (under) { fixPlayer('under', 'under the map'); return; }
    if (out) { fixPlayer('bounds', 'out of bounds'); return; }
    if (scanT < 1) return;
    scanT = 0;
    const mv = api.tc && api.tc.move;
    const mag = mv ? Math.hypot(mv.x || 0, mv.y || 0) : 0;
    const dist = Math.hypot(P.x - last.x, P.z - last.z);
    const driving = W.driving && W.driving();
    if (mag > 0.45 && dist < 0.15 && !P.sit && !driving) stuckFor += 1;
    else stuckFor = 0;
    last = { x: P.x, z: P.z };
    if (stuckFor >= 4) { stuckFor = 0; fixPlayer('stuck', 'could not move'); }
    const mine = W.drive && W.drive.mine && W.drive.mine();
    if (mine) {
      const heave = (window.__kd && window.__kd.heave) || 0;
      const floatY = !Number.isFinite(mine.x) || !Number.isFinite(mine.z) || Math.abs(heave) > 3;
      const offRoad = mine.state === 'drive' && mine.speed < 0.4 && roadD(mine.x, mine.z) > 16;
      if (floatY || offRoad) carBad += 1;
      else carBad = 0;
      if (carBad >= 2 && W.drive.resetAt && W.respawn && W.respawn.nearestRoadSpot) {
        carBad = 0;
        const spotR = W.respawn.nearestRoadSpot(Number.isFinite(mine.x) ? mine.x : 0, Number.isFinite(mine.z) ? mine.z : 100);
        if (spotR) W.drive.resetAt({ x: spotR.x, z: spotR.z, yaw: spotR.yaw || 0 });
        toastFixed();
        note({ type: floatY ? (Number.isFinite(mine.x) ? 'float' : 'nan') : 'wall', text: 'car', autoFixed: true, game: placeGame(P.x, P.z), place: here() });
      }
    }
    const cars = W.cars || [];
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.m) continue;
      if (Math.hypot(c.m.position.x - P.x, c.m.position.z - P.z) > 50 && Number.isFinite(c.m.position.y)) continue;
      const py = c.m.position.y;
      const want = c.drive && W.loopAt && c.d != null ? W.loopAt(c.d, c.lane || -2, c.L) : null;
      const gy2 = ground(want ? want.x : c.m.position.x, want ? want.z : c.m.position.z);
      const lost = !Number.isFinite(py) || py > gy2 + 3.5 || py < gy2 - 1.2 || (want && Math.hypot(c.m.position.x - want.x, c.m.position.z - want.z) > 8);
      if (!lost) continue;
      const p = want || { x: c.x || 0, z: c.z || 100, yaw: c.yaw || 0 };
      poseCar(c.m, { x: p.x, y: ground(p.x, p.z), z: p.z, yaw: p.yaw || 0 }, 0, 0);
      toastFixed();
      note({ type: Number.isFinite(py) ? 'float' : 'nan', text: 'parked car', autoFixed: true, game: 'street', place: placeOf(areaAt(p.x, p.z), p.x, p.z) });
      break;
    }
    const bots = W.bots || [];
    for (let i = 0; i < bots.length; i++) {
      const b = bots[i];
      if (Number.isFinite(b.x) && Number.isFinite(b.z)) continue;
      const a = b.seg && b.seg[0];
      if (!a) continue;
      b.x = a[0]; b.z = a[1]; b.k = 0;
      toastFixed();
      note({ type: 'nan', text: 'walker', autoFixed: true, game: 'street', place: placeOf('Kemy Street', a[0], a[1]) });
      break;
    }
  }

  function glance(m) {
    const gy = ground(m.x, m.z);
    const issue = groundIssue(m.prevG, gy);
    if (Number.isFinite(gy)) m.prevG = gy;
    if (m.role === 'drive') {
      const off = roadD(m.x, m.z);
      if (!Number.isFinite(m.x) || !Number.isFinite(m.z) || off > 4) { fixMember(m, 'wall', 'helper car'); return; }
    }
    if (!issue) return;
    if (m.role === 'drive' || issue === 'nan') fixMember(m, issue === 'nan' ? 'nan' : issue === 'under' ? 'under' : 'float', 'helper');
    else note({ type: issue === 'under' ? 'under' : issue === 'nan' ? 'nan' : 'float', text: 'hole', autoFixed: false, game: 'world', place: spot(m) });
  }

  function obstacles() {
    const out = [];
    if (Number.isFinite(P.x)) out.push([P.x, P.z]);
    const mine = W.drive && W.drive.mine && W.drive.mine();
    if (mine && Number.isFinite(mine.x) && Number.isFinite(mine.z)) out.push([mine.x, mine.z]);
    return out;
  }

  function sim(m, dt, blocks, driving) {
    const feetX = Number.isFinite(m.fx) ? m.fx : m.x;
    const feetZ = Number.isFinite(m.fz) ? m.fz : m.z;
    let hold = false;
    if (m.role === 'drive' && m.life.mode !== 'park') {
      for (let i = 0; i < blocks.length; i++) {
        const px = blocks[i][0], pz = blocks[i][1];
        if (Math.hypot(m.x - px, m.z - pz) < 3.6 || aheadBlocked(m.x, m.z, m.yaw, px, pz, 8)) hold = true;
      }
    } else if (m.role !== 'drive' && !driving && Math.hypot(feetX - P.x, feetZ - P.z) < 2.8) hold = true;
    m.hold = hold;
    if (hold && m.role !== 'drive' && m.life.mode === 'go' && performance.now() > m.life.greet) {
      m.life.mode = 'wave';
      m.life.left = 1.8;
      m.life.elapsed = 0;
      m.life.say = 'Hi!';
      m.life.yaw = null;
      m.life.greet = performance.now() + 9000;
    }
    const p = stepLife(m.life, m, dt);
    m.mode = p.mode;
    m.onFoot = p.onFoot;
    m.say = p.say;
    m.moving = p.moving;
    if (m.role === 'drive') {
      m.x = p.carX; m.z = p.carZ; m.yaw = p.carYaw;
      m.fx = p.x; m.fz = p.z; m.fyaw = p.onFoot ? p.yaw : p.carYaw;
    } else {
      m.x = m.fx = p.x; m.z = m.fz = p.z;
      m.yaw = p.yaw;
      if (hold && p.mode !== 'sit' && p.mode !== 'play') m.yaw = Math.atan2(P.x - m.fx, P.z - m.fz);
      m.fyaw = m.yaw;
    }
  }

  function pose(m, show) {
    const sitting = m.mode === 'sit' || m.mode === 'play';
    const gy = show ? ground(m.x, m.z) : 0;
    if (m.car) {
      m.car.visible = show;
      if (m.root) m.root.visible = show;
      if (!show) return;
      m.car.position.set(m.x, gy, m.z);
      m.car.rotation.y = m.yaw;
      m.car.updateMatrixWorld(true);
      mount(m, m.onFoot);
      if (m.moving) {
        m.spin += m.speed * 0.4;
        const wheels = m.car.userData.wheels;
        for (let i = 0; i < wheels.length; i++) wheels[i].rotation.x = m.spin;
      }
    }
    if (!m.root) return;
    if (!m.car) {
      m.root.visible = show;
      if (!show) return;
    }
    if (!m.car || m.onFoot) {
      const fg = show ? ground(m.fx, m.fz) : 0;
      m.root.position.set(m.fx, fg + (sitting ? 0.36 : 0), m.fz);
      m.root.rotation.set(sitting ? 1.05 : 0, m.fyaw, 0);
      m.root.scale.set(1, sitting ? 0.62 : 1, 1);
    }
    if (m.stool) m.stool.visible = m.mode === 'play';
    if (m.toy) m.toy.visible = m.mode === 'play';
    m.step += m.moving ? 0.16 : 0.08;
    const arms = m.root.userData.arms;
    if (!arms || !arms[0]) return;
    arms[0].position.y = 0.76;
    arms[1].position.y = 0.76;
    arms[0].rotation.z = 0.25;
    arms[1].rotation.z = -0.25;
    if (sitting) {
      arms[0].rotation.x = -1.25;
      arms[1].rotation.x = -1.25;
      arms[0].rotation.z = 0.45;
      arms[1].rotation.z = -0.45;
      return;
    }
    if (m.mode === 'wave') {
      arms[0].rotation.x = 0.35;
      arms[1].position.y = 1.2;
      arms[1].rotation.z = -0.35;
      arms[1].rotation.x = Math.sin(m.step * 8) * 0.45;
      return;
    }
    if (m.mode === 'shop' || m.mode === 'look') {
      arms[0].rotation.x = -0.35;
      arms[1].rotation.x = -0.55;
      return;
    }
    const swing = m.moving ? Math.sin(m.step * 2) * 0.45 : Math.sin(m.step) * 0.08;
    arms[0].rotation.x = swing;
    arms[1].rotation.x = -swing;
    if (!m.car || m.onFoot) m.root.position.y += m.moving ? Math.abs(Math.sin(m.step * 2)) * 0.05 : 0;
  }

  function tagAt(m, show, dist) {
    if (!m.tag) return;
    if (!show || dist > 34) {
      if (m.tag.style.display !== 'none') m.tag.style.display = 'none';
      if (m.bub && !m.bub.hidden) m.bub.hidden = true;
      return;
    }
    const head = m.car && !m.onFoot ? m.car.localToWorld(tv.set(0, 1.7, -0.15)) : tv.set(m.fx, ground(m.fx, m.fz) + (m.mode === 'sit' || m.mode === 'play' ? 1.25 : 1.8), m.fz);
    head.project(api.cam);
    const vis = head.z < 1 && Math.abs(head.x) < 1.05 && Math.abs(head.y) < 1.05;
    const disp = vis ? '' : 'none';
    if (m.tag.style.display !== disp) m.tag.style.display = disp;
    if (!vis) { if (m.bub && !m.bub.hidden) m.bub.hidden = true; return; }
    const w = view.clientWidth, h = view.clientHeight;
    const px = (head.x + 1) / 2 * w, py = (1 - head.y) / 2 * h;
    const left = Math.round(px - m.tag.offsetWidth / 2) + 'px';
    const top = Math.round(py - m.tag.offsetHeight) + 'px';
    if (m.tag.style.left !== left) m.tag.style.left = left;
    if (m.tag.style.top !== top) m.tag.style.top = top;
    if (m.tag.style.transform !== 'none') m.tag.style.transform = 'none';
    if (m.bub) {
      const talk = !!(show && vis && m.say);
      if (m.bub.hidden !== !talk) m.bub.hidden = !talk;
      if (talk) {
        if (m.bub.textContent !== m.say) m.bub.textContent = m.say;
        m.bub.style.left = left;
        m.bub.style.top = Math.round(py - m.tag.offsetHeight - 28) + 'px';
        m.bub.style.transform = 'none';
      }
    }
  }

  function update(dt) {
    dt = Math.max(0, Math.min(0.1, dt || 0));
    flagT += dt;
    if (flagT >= 1) { flagT = 0; refreshCap(); }
    const driving = !!(W.driving && W.driving());
    const blocks = obstacles();
    const reach = showDist();
    let closest = 1e9;
    let closestM = null;
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const on = i < cap;
      if (!on) {
        if (m.root) m.root.visible = false;
        if (m.car) m.car.visible = false;
        if (m.tag && m.tag.style.display !== 'none') m.tag.style.display = 'none';
        if (m.bub && !m.bub.hidden) m.bub.hidden = true;
        continue;
      }
      sim(m, dt, blocks, driving);
      const nearX = m.onFoot ? m.fx : m.x;
      const nearZ = m.onFoot ? m.fz : m.z;
      const d = Math.hypot(nearX - P.x, nearZ - P.z);
      const show = d < reach;
      if (show || d < reach + 36) ensure(m);
      if (m.root) {
        pose(m, show);
        tagAt(m, show, d);
      }
      if (d < closest) { closest = d; closestM = m; }
    }
    const talk = closestM && closest < 2.8 && (closestM.role !== 'drive' || closestM.onFoot || closestM.hold || closest < 2.6);
    btn.hidden = !talk;
    if (talk) focus = closestM;
    if (cap > 2) {
      const seat = members[2];
      stepPlay(dt, (issue) => note(Object.assign({ place: placeOf(areaAt(seat.x, seat.z), seat.x, seat.z) }, issue)));
    }
    const tick = Math.floor(performance.now() / 1000);
    if (tick !== glanceI && cap > 0) {
      glanceI = tick;
      const g = members[tick % cap];
      if (g) glance(g);
    }
    scan(dt);
    watchGrief();
    const lead = members[0];
    const pub = window.__kh || (window.__kh = {});
    pub.x = lead.x;
    pub.z = lead.z;
    pub.near = closest;
    pub.tag = lead.tag;
    pub.cap = cap;
    pub.focus = focus ? focus.id : '';
    pub.members = members.map((m, i) => ({ id: m.id, role: m.role, name: m.name, x: m.fx, z: m.fz, carX: m.x, carZ: m.z, shown: i < cap, job: m.job, mode: m.mode, onFoot: m.onFoot, say: m.say || '' }));
    pub.step = (n) => { const k = Math.max(1, Math.min(400, n | 0)); for (let i = 0; i < k; i++) update(0.05); };
  }

  return {
    update,
    destroy() {
      removeEventListener('kemy:helper-team', onToggle);
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (m.car) scene.remove(m.car);
        else if (m.root) scene.remove(m.root);
        if (m.tag) m.tag.remove();
        if (m.bub) m.bub.remove();
      }
      btn.remove();
      panel.remove();
      const gone = new Set();
      const drop = (o) => { if (o.geometry && !gone.has(o.geometry)) { gone.add(o.geometry); o.geometry.dispose(); } };
      proto.traverse(drop);
      carProto.traverse(drop);
      for (const k of Object.keys(mats)) if (mats[k] && mats[k].dispose) mats[k].dispose();
    }
  };
}
