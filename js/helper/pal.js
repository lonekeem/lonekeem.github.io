// Kemy Helper in the 3D world: one local pal, purple and gold, labeled, walking a
// patrol through Pal Park and Kemy Street. Not networked. Checks are throttled.
// Written by Lone Keem.
import { poseCar } from '../world/cars.js';
import { areaAt, BOUNDS, roadD } from '../world/layout.js';
import { note, setHelperPlace, toastFixed } from './watch.js';
import { placeOf, scrub } from './core.js';

const PATH = [
  [0, 6], [22, 6], [22, -24], [-20, -24], [-20, 18], [0, 34],
  [0, 88], [-46, 100], [46, 100], [46, 142], [-46, 142], [0, 108], [0, 62]
];

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

function buildPal(THREE) {
  const g = new THREE.Group();
  g.name = 'kemy-helper';
  const purple = new THREE.MeshStandardMaterial({ color: '#6d28d9', roughness: 0.5, metalness: 0.04 });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd34d', roughness: 0.32, metalness: 0.42, emissive: '#c98900', emissiveIntensity: 0.18 });
  const ink = new THREE.MeshStandardMaterial({ color: '#24133f', roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.46, 4, 8), purple);
  body.position.y = 0.7;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 12), gold);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.62;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), purple);
  head.position.y = 1.28;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.14, 10), gold);
  cap.position.y = 1.5;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 12), gold);
  brim.position.y = 1.42;
  const badge = new THREE.Mesh(starGeo(THREE), gold);
  badge.scale.setScalar(0.16);
  badge.position.set(0, 0.86, 0.3);
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), purple);
  armL.position.set(-0.36, 0.78, 0);
  armL.rotation.z = 0.3;
  const armR = armL.clone();
  armR.position.x = 0.36;
  armR.rotation.z = -0.3;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), ink);
    e.position.set(s * 0.09, 1.3, 0.22);
    g.add(e);
  }
  g.add(body, belt, head, cap, brim, badge, armL, armR);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  g.userData.arms = [armL, armR];
  return g;
}

export function attachHelper(api, W) {
  const { THREE, scene, P, view } = api;
  const ground = api.ground;
  const root = buildPal(THREE);
  scene.add(root);
  const tv = new THREE.Vector3();
  const tag = document.createElement('div');
  tag.className = 'ks-tag kh';
  tag.textContent = 'Kemy Helper';
  tag.dataset.n = 'Kemy Helper';
  const tags = view.querySelector('#ks-tags') || view;
  tags.appendChild(tag);
  if (!document.getElementById('kh-css')) {
    const st = document.createElement('style');
    st.id = 'kh-css';
    st.textContent = `.ks-tag.kh{background:#6d28d9;border:2px solid #ffd34d;color:#fff;font-weight:800;padding:3px 8px}
.kh-act{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(max(18px,env(safe-area-inset-bottom)) + 132px);pointer-events:auto;min-height:44px;padding:0 16px;border-radius:999px;border:2px solid #ffd34d;background:#6d28d9;color:#fff;font:800 15px Inter,system-ui,sans-serif;z-index:8;box-shadow:0 4px 14px rgba(0,0,0,.35)}
.kh-act[hidden]{display:none}
.kh-card textarea{width:100%;min-height:88px;border-radius:12px;border:0;padding:10px;font:600 16px Inter,system-ui,sans-serif;box-sizing:border-box;color:#24133f}
.kh-card .row{display:flex;gap:8px}
.kh-card .row button{flex:1}`;
    document.head.appendChild(st);
  }
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kh-act';
  btn.hidden = true;
  btn.textContent = 'Report a problem';
  const panel = document.createElement('div');
  panel.className = 'ks-panel';
  panel.hidden = true;
  panel.innerHTML = `<div class="ks-card kh-card"><h3>Kemy Helper</h3><p style="margin:0 0 8px;opacity:.9">Tell me what went wrong. Skip names, emails, and phone numbers.</p><textarea maxlength="140" placeholder="What happened?" aria-label="What happened?"></textarea><div class="row"><button type="button" data-s>Send note</button><button type="button" class="ghost" data-x>Close</button></div></div>`;
  (W.hud || view).append(btn, panel);
  const box = panel.querySelector('textarea');
  const sendB = panel.querySelector('[data-s]');
  panel.querySelector('[data-x]').onclick = () => { panel.hidden = true; };
  panel.onclick = (e) => { if (e.target === panel) panel.hidden = true; };
  btn.onclick = () => { panel.hidden = false; box.focus(); };
  sendB.onclick = () => {
    const text = scrub(box.value);
    if (text.length < 2) { if (W.say) W.say('Tell me a little more.'); return; }
    sendB.disabled = true;
    note({ type: 'note', text, autoFixed: false, game: placeGame(P.x, P.z), place: here() }).finally(() => { sendB.disabled = false; });
    box.value = '';
    panel.hidden = true;
    if (W.say) W.say('Thanks. Kemy Helper wrote that down.');
  };

  let seg = 0;
  let along = 0;
  let x = PATH[0][0];
  let z = PATH[0][1];
  let yaw = 0;
  let step = 0;
  let scanT = 0;
  let stuckFor = 0;
  let last = { x: P.x, z: P.z };
  let carBad = 0;
  let wave = 0;
  let fixingUntil = 0;

  function here() { return placeOf(areaAt(P.x, P.z), P.x, P.z); }
  function placeGame(px, pz) { return pz > 77 && px < 100 ? 'street' : 'park'; }
  setHelperPlace(() => ({ game: placeGame(P.x, P.z), place: here() }));

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
      const fy = ground(mine.x, mine.z);
      const heave = (window.__kd && window.__kd.heave) || 0;
      const floatY = !Number.isFinite(mine.x) || !Number.isFinite(mine.z) || Math.abs(heave) > 3;
      const offRoad = mine.state === 'drive' && mine.speed < 0.4 && roadD(mine.x, mine.z) > 16;
      if (floatY || offRoad) carBad += 1;
      else carBad = 0;
      if (carBad >= 2 && W.drive.resetAt && W.respawn && W.respawn.nearestRoadSpot) {
        carBad = 0;
        const spot = W.respawn.nearestRoadSpot(Number.isFinite(mine.x) ? mine.x : 0, Number.isFinite(mine.z) ? mine.z : 100);
        if (spot) W.drive.resetAt({ x: spot.x, z: spot.z, yaw: spot.yaw || 0 });
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
      b.x = a[0];
      b.z = a[1];
      b.k = 0;
      toastFixed();
      note({ type: 'nan', text: 'walker', autoFixed: true, game: 'street', place: placeOf('Kemy Street', a[0], a[1]) });
      break;
    }
  }

  function update(dt) {
    const a = PATH[seg];
    const b = PATH[(seg + 1) % PATH.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nearP = Math.hypot(x - P.x, z - P.z);
    const pause = nearP < 2.8 && !(W.driving && W.driving());
    if (!pause) {
      along += 1.35 * dt;
      if (along >= L) { along = 0; seg = (seg + 1) % PATH.length; }
    }
    const k = Math.max(0, Math.min(1, along / L));
    const nx = a[0] + (b[0] - a[0]) * k;
    const nz = a[1] + (b[1] - a[1]) * k;
    if (!pause && (nx !== x || nz !== z)) yaw = Math.atan2(nx - x, nz - z);
    else if (pause) yaw = Math.atan2(P.x - x, P.z - z);
    x = nx;
    z = nz;
    const d = Math.hypot(x - P.x, z - P.z);
    const show = d < (api.LOW ? 48 : 80);
    root.visible = show;
    if (show) {
      root.position.set(x, ground(x, z), z);
      root.rotation.y = yaw;
      const bob = pause ? Math.sin(step) * 0.03 : Math.abs(Math.sin(step * 2)) * 0.06;
      root.position.y += bob;
      step += dt * (pause ? 2 : 6);
      const arms = root.userData.arms;
      const swing = pause ? Math.sin(step) * 0.35 : Math.sin(step * 2) * 0.5;
      if (arms) { arms[0].rotation.x = swing; arms[1].rotation.x = -swing; }
      wave = pause ? Math.min(1, wave + dt * 2) : Math.max(0, wave - dt * 2);
      if (arms && wave > 0) arms[1].rotation.x = -0.8 * wave;
    }
    btn.hidden = !(pause && d < 2.8);
    if (show && d < 36) {
      tv.set(x, ground(x, z) + 1.85, z).project(api.cam);
      const vis = tv.z < 1 && Math.abs(tv.x) < 1.05 && Math.abs(tv.y) < 1.05;
      const disp = vis ? '' : 'none';
      if (tag.style.display !== disp) tag.style.display = disp;
      if (vis) {
        const w = view.clientWidth, h = view.clientHeight;
        const px = (tv.x + 1) / 2 * w, py = (1 - tv.y) / 2 * h;
        const tf = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px) translate(-50%,-100%)`;
        if (tag.style.transform !== tf) tag.style.transform = tf;
      }
    } else if (tag.style.display !== 'none') tag.style.display = 'none';
    scan(dt);
    const pub = window.__kh || (window.__kh = {});
    pub.x = x;
    pub.z = z;
    pub.near = d;
    pub.tag = tag;
  }

  return {
    update,
    destroy() { scene.remove(root); tag.remove(); btn.remove(); panel.remove(); }
  };
}
