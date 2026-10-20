// Kemy World car effects: headlight beams at night, tire smoke on hard slides, skid marks, dust off-road,
// tire squeal audio. Pools + instancing, scaled by graphics tier (low = marks + dust only, few). Written by Lone Keem.
export function createCarFx(api) { const { THREE, scene, Q, LOW, ULTRA } = api; const tier = LOW ? 0 : Q.tier === 'medium' ? 1 : 2;
  const root = new THREE.Group(); root.name = 'car-fx'; scene.add(root);
  // skid marks: ring buffer of dark quads
  const NM = [80, 200, 360][tier]; const mg = new THREE.PlaneGeometry(0.24, 0.5); mg.rotateX(-Math.PI / 2); const marks = new THREE.InstancedMesh(mg, new THREE.MeshBasicMaterial({ color: '#141414', transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), NM);
  marks.count = 0; marks.frustumCulled = false; root.add(marks); let mi = 0; const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), UP = new THREE.Vector3(0, 1, 0);
  const lastW = [null, null];
  function mark(i, x, y, z, yaw) { const p = lastW[i]; if (p && Math.hypot(p[0] - x, p[1] - z) < 0.35) return; lastW[i] = [x, z]; q.setFromAxisAngle(UP, yaw); M.compose(v.set(x, y + 0.03, z), q, s); marks.setMatrixAt(mi, M); mi = (mi + 1) % NM; marks.count = Math.min(NM, marks.count + 1); marks.instanceMatrix.needsUpdate = true; }
  // smoke + dust: sprite particles
  const tex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const NP = [16, 40, 80][tier]; const parts = []; for (let i = 0; i < NP; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; root.add(sp); parts.push({ sp, life: 0, vx: 0, vy: 0, vz: 0, max: 1 }); }
  let pi = 0; function puff(x, y, z, col, size, vy) { const p = parts[pi]; pi = (pi + 1) % NP; p.sp.visible = true; p.sp.position.set(x, y, z); p.sp.material.color.set(col); p.sp.scale.setScalar(size); p.life = 0; p.max = 0.9 + Math.random() * 0.6; p.vx = (Math.random() - 0.5) * 0.8; p.vz = (Math.random() - 0.5) * 0.8; p.vy = vy; p.s0 = size; }
  // headlight beams (soft cones, every tier) + real spotlights (medium+)
  const beamG = new THREE.ConeGeometry(1.6, 9, 16, 1, true); beamG.translate(0, -4.5, 0); beamG.rotateX(-Math.PI / 2); const beamM = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const beams = [new THREE.Mesh(beamG, beamM), new THREE.Mesh(beamG, beamM)]; beams.forEach((b) => root.add(b)); const spots = tier ? [new THREE.SpotLight('#fff1c9', 0, 32, 0.5, 0.6, 1.4), new THREE.SpotLight('#fff1c9', 0, 32, 0.5, 0.6, 1.4)] : []; spots.forEach((l) => { root.add(l); root.add(l.target); });
  // tire squeal: filtered noise
  let ac = null, sq = null; function squeal(k) { try { if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac = new AC(); const n = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const src = ac.createBufferSource(); src.buffer = n; src.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 6; const g = ac.createGain(); g.gain.value = 0; src.connect(bp).connect(g).connect(ac.destination); src.start(); sq = { g, bp }; }
      sq.g.gain.setTargetAtTime(Math.min(0.12, k * 0.12), ac.currentTime, 0.05); sq.bp.frequency.setTargetAtTime(1500 + k * 900, ac.currentTime, 0.1); } catch { /* */ } }
  let em = 0;
  function update(dt, car, V, rs, night, offRoad, braking) { for (const p of parts) if (p.sp.visible) { p.life += dt; const k = p.life / p.max; if (k >= 1) { p.sp.visible = false; continue; } p.sp.position.x += p.vx * dt; p.sp.position.y += p.vy * dt; p.sp.position.z += p.vz * dt; p.sp.scale.setScalar(p.s0 * (1 + k * 2.2)); p.sp.material.opacity = (1 - k) * 0.5; }
    if (!car) { beams.forEach((b) => (b.visible = false)); spots.forEach((l) => (l.intensity = 0)); squeal(0); return; }
    const def = car.userData.def; const sy = Math.sin(rs.yaw), cy = Math.cos(rs.yaw); const spd = Math.abs(V.vf);
    const rear = [-1, 1].map((sd) => [rs.x - sy * def.L * 0.33 + cy * sd * def.Wd * 0.42, rs.z - cy * def.L * 0.33 - sy * sd * def.Wd * 0.42]); const y = api.ground(rs.x, rs.z);
    const sliding = V.slip > 0.55 && spd > 4, skid = sliding || (braking && spd > 6 && !V.abs);
    if (skid && !offRoad) rear.forEach(([x, z], i) => mark(i, x, y, z, rs.yaw)); else { lastW[0] = lastW[1] = null; }
    em += dt; const rate = [0.12, 0.06, 0.035][tier];
    if (em > rate) { em = 0; if (sliding && !offRoad && tier) rear.forEach(([x, z]) => puff(x, y + 0.3, z, '#e5e7eb', 0.9, 0.6)); else if (offRoad && spd > 3) rear.forEach(([x, z]) => puff(x, y + 0.2, z, '#c8a26b', 0.7 + spd * 0.04, 0.4)); }
    squeal(sliding && !offRoad ? Math.min(1, V.slip - 0.4) : 0);
    // lights: beams follow the front of the car
    const on = night > 0.3; beamM.opacity = on ? 0.07 + night * 0.06 : 0; [-1, 1].forEach((sd, i) => { const fx = rs.x + sy * def.L * 0.48 + cy * sd * def.Wd * 0.33, fz = rs.z + cy * def.L * 0.48 - sy * sd * def.Wd * 0.33, fy = y + def.H * 0.42;
      beams[i].visible = on; beams[i].position.set(fx, fy, fz); beams[i].rotation.set(0.12, rs.yaw, 0); if (spots[i]) { spots[i].intensity = on ? 40 * night : 0; spots[i].position.set(fx, fy, fz); spots[i].target.position.set(fx + sy * 12, fy - 1.6, fz + cy * 12); } }); void ULTRA; }
  return { update, destroy() { scene.remove(root); try { ac && ac.close(); } catch { /* */ } } };
}
