// 🎬 Lone Keem Studio NPC sims: a small fixed pool (outside on the plaza / lot / sidewalks + a few in the nearby streets,
// lobby staff in burgundy LKS uniforms, a couple of lobby visitors, a few moviegoers already in their seats).
// Cheap: simple paths, pose updates only near you (every 4th frame farther away), hidden past ~40 m or in the other area.
// Tap one (or the 💬 button) for a bubble: Wave / Say hi / Ask about the movie / Dance together. Canned kid-safe lines only;
// there is no typed chat here. Staff also open the snack menu or hand you a (free) ticket.
const SPEC = ['kemy', 'puppy', 'kitten', 'bunny', 'panda', 'fox', 'penguin', 'duckling', 'frog', 'owl', 'unicorn', 'hamster', 'koala', 'lamb', 'otter'];
const NAMES = ['Rosa', 'Dex', 'Ivy', 'Kai', 'Nell', 'Otis', 'Wren', 'Zuri', 'Benny', 'Lola', 'Remy', 'Tess', 'Gus', 'Pia', 'Arlo', 'Mae', 'Finn', 'Juno', 'Sami'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const HI = ['Hi there! 😊', 'Hey! Nice to meet you!', 'Hello, friend! 💜', 'Hiya! Love your Pal!', 'Welcome to Lone Keem Studio! 🎬'];
const WAVE = ['👋 Hey hey!', '👋 Hi!', '👋 Wave back!', '👋 Hello!'];
const SOON = ['It says Coming Soon! I can’t wait 🍿', 'Keem is picking the songs. It’s going to be great! 🎶', 'Coming soon! Let’s save the best seats 🪑', 'I heard the big screen does karaoke! 🎤'];
const IDLE_OUT = ['This theater is so big! 🎬', 'Popcorn time? 🍿', 'Look at those lights! ✨', 'I love the marquee!', 'Let’s go see a show!'];
const IDLE_IN = ['These seats are comfy 🪑', 'Shh, the show is starting! 🤫', 'Pass the popcorn? 🍿', 'Best seat in the house!'];
const STAFF = ['Snacks are this way! 🍿', 'Enjoy the show! 🎬', 'Tickets are free today! 🎟️', 'Need a snack? Just ask!'];

export function attachTheaterNpcs(api, W, K, o) {
  const { THREE, P, LOW, Q } = api; const { RX, RZ } = o; const phone = !!(Q && Q.phone);
  const root = new THREE.Group(); root.name = 'theater-npcs'; W.root.add(root);
  const npcs = []; let n0 = 0; const VIS = LOW ? 30 : 40, NEAR = LOW ? 14 : 22;
  function mk(d) {
    const i = n0++; const ps = { species: SPEC[(i * 7) % SPEC.length], name: NAMES[i % NAMES.length], colors: {}, pattern: '', acc: '', outfit: d.k === 'staff' ? {} : (i % 4 === 1 ? { hat: 'beanie' } : {}), level: 3 + (i % 8) };
    let obj; try { obj = api.palObj(ps, d.zone === 'out' && !LOW && !phone); } catch { return null; } obj.visible = false; root.add(obj);
    const n = { ...d, obj, ps, name: ps.name + (d.k === 'staff' ? ' · LKS Crew' : ''), short: ps.name, x: 0, z: 0, y: 0, yaw: d.yaw || 0, t: Math.random() * 100, seg: 0, u: 0, dir: 1, pause: Math.random() * 2, say: '', sayAt: 0, anim: '', animUntil: 0, face: 0, f: i };
    if (d.k === 'staff') uniform(obj); if (d.at) { n.x = d.at[0]; n.z = d.at[1]; } else if (d.path) { n.x = d.path[0][0]; n.z = d.path[0][1]; }
    npcs.push(n); return n;
  }
  // burgundy uniform (#800020) with gold / cream trim, an LKS name tag and a cap
  const uM = new THREE.MeshStandardMaterial({ color: '#800020', roughness: 0.7 }), gM = new THREE.MeshStandardMaterial({ color: '#d4af37', roughness: 0.35, metalness: 0.6, emissive: '#3a2a00', emissiveIntensity: 0.4 }), cM = new THREE.MeshStandardMaterial({ color: '#f3e3c3', roughness: 0.6 });
  const tagTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#d4af37'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#800020'; g.font = '900 40px Inter, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LKS', 64, 34); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  function uniform(obj) {
    const m = obj.userData.m; const J = m && m.userData && m.userData.J; if (!J || !J.TB) return;
    const torso = J.TB.children.find((c) => c.isMesh && c.geometry && c.geometry.type === 'LatheGeometry');
    const shirt = torso ? new THREE.Mesh(torso.geometry, uM) : new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), uM);
    if (torso) { shirt.scale.copy(torso.scale).multiplyScalar(1.05); shirt.position.copy(torso.position); } else { shirt.scale.set(1, 1.1, 0.9); shirt.position.y = 0.2; } J.TB.add(shirt);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.035, 6, 28), gM); belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.9, 1); belt.position.y = 0.0; J.TB.add(belt);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.04, 6, 22), cM); collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.9, 1); collar.position.y = 0.55; J.TB.add(collar);
    for (const y of [0.18, 0.34]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), gM); b.position.set(0, y, 0.39); J.TB.add(b); }
    const tg = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshBasicMaterial({ map: tagTex })); tg.position.set(0.17, 0.33, 0.335); tg.rotation.y = 0.35; J.TB.add(tg);
    if (J.Head) { obj.updateMatrixWorld(true); const bb = new THREE.Box3(); J.Head.traverse((c) => { if (c.isMesh && !c.userData.deco) { c.geometry.computeBoundingBox(); const b = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld); bb.union(b); } });
      if (!bb.isEmpty()) { const ws = J.Head.getWorldScale(new THREE.Vector3()).x || 1; const hw = Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 / ws; const top = J.Head.worldToLocal(new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2));
        const r = Math.max(0.12, hw * 0.62); const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r, r * 0.55, 18), uM); cap.position.set(top.x, top.y - r * 0.12, top.z); J.Head.add(cap);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.01, r * 1.01, r * 0.12, 18), gM); band.position.set(top.x, top.y - r * 0.3, top.z); J.Head.add(band);
        const brim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, r * 0.06, 16, 1, false, -Math.PI / 2, Math.PI), uM); brim.position.set(top.x, top.y - r * 0.36, top.z + r * 0.55); J.Head.add(brim); } }
  }
  // ---- the pool (world coords outside, local room coords inside)
  const out = [
    { k: 'walk', zone: 'out', path: [[60.6, 184], [60.6, 230]] }, { k: 'walk', zone: 'out', path: [[71.4, 186], [71.4, 228]] }, { k: 'walk', zone: 'out', path: [[20.4, 183], [20.4, 231], [56, 230.6], [20.4, 231]] },
    { k: 'idle', zone: 'out', at: [61.4, 199.6], yaw: -Math.PI / 2 }, { k: 'idle', zone: 'out', at: [62.4, 214.2], yaw: -Math.PI / 2 },
    // nearby town (the streets around the theater block)
    { k: 'walk', zone: 'out', path: [[18, 179.5], [85, 179.5]] }, { k: 'walk', zone: 'out', path: [[85, 236.5], [18, 236.5]] }, { k: 'walk', zone: 'out', path: [[17.2, 236], [17.2, 180]] }
  ];
  for (const d of LOW ? out.slice(0, 6) : out) mk(d);
  let inBuilt = false, ib = null;
  function inReady(b) {
    ib = b; if (inBuilt) return; inBuilt = true;
    const staff = [{ at: [-13, 8.35], role: 'snack' }, { at: [-9, 8.35], role: 'snack' }, { at: [11.5, 8.35], role: 'ticket' }, { at: [4.6, 5.3], role: 'usher' }];
    for (const s of staff) mk({ k: 'staff', zone: 'in', at: s.at, yaw: 0, role: s.role, y: 4 });
    mk({ k: 'walk', zone: 'in', path: [[-3, 19.5], [-3, 12.2], [6, 12.2], [6, 19.5]], loop: true, y: 4 });
    mk({ k: 'lobbysit', zone: 'in', y: 4 });
    const idx = []; const rowsN = ib.seats.length / 8; for (const [r, c] of [[2, 0.5], [3, 0.42], [4, 0.6], [1, 0.2], [5, 0.85]]) { const base = r * rowsN; const j = base + Math.floor(c * rowsN); idx.push(j); }
    for (const j of LOW ? idx.slice(0, 3) : idx) mk({ k: 'sit', zone: 'in', seatI: j });
  }
  const worldXZ = (n) => (n.zone === 'in' ? [n.x + RX, n.z + RZ] : [n.x, n.z]);
  function seatOf(n) { if (n.k === 'sit' && ib) return ib.wSeats[n.seatI]; if (n.k === 'lobbysit') { const L = o.lobbySeats ? o.lobbySeats() : []; return L[3] || L[0] || null; } return null; }
  function seatTaken(s) { for (const n of npcs) { const q = seatOf(n); if (q && Math.hypot(q.x - s.x, q.z - s.z) < 0.4) return true; } return false; }
  // ---- per frame
  const ground = (x, z) => (api.ground ? api.ground(x, z) : 0); let talking = null, bub = null, bubAt = 0;
  function update(dt, now) {
    const inside = o.isInside(); const bt = api.beatNow ? api.beatNow() : { beat: now * 2 }; const showing = !!o.nowShowing();
    for (const n of npcs) {
      const here = (n.zone === 'in') === inside; if (!here) { if (n.obj.visible) { n.obj.visible = false; K.hideTag(n); } continue; }
      const st = seatOf(n);
      let [wx, wz] = st ? [st.x, st.z] : worldXZ(n); const d = Math.hypot(wx - P.x, wz - P.z); n.d = d;
      n.obj.visible = d < VIS; if (!n.obj.visible) { K.hideTag(n); continue; }
      let moving = false;
      if (!st && n.path && !(talking === n && Date.now() < n.face)) {
        if (n.pause > 0) n.pause -= dt; else if (d < 0.9) n.pause = 1.2; else {
          const a = n.path[n.seg], b = n.path[(n.seg + 1) % n.path.length]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; n.u += 0.9 * dt / L; moving = true;
          if (n.u >= 1) { n.u = 0; n.seg = (n.seg + 1) % n.path.length; if (!n.loop && n.path.length === 2 && n.seg === 0) n.path = [n.path[1], n.path[0]]; if (Math.random() < 0.35) { n.pause = 1.5 + Math.random() * 2.5; if (Math.random() < 0.5) { n.say = pick(n.zone === 'in' ? IDLE_IN : IDLE_OUT); n.sayAt = Date.now(); } } }
          const nx = a[0] + (b[0] - a[0]) * n.u, nz = a[1] + (b[1] - a[1]) * n.u; n.yaw = Math.atan2(nx - n.x, nz - n.z) || n.yaw; n.x = nx; n.z = nz; }
      } else if (!st && n.k === 'staff' && Math.random() < dt * 0.02 && d < 14) { n.say = pick(STAFF); n.sayAt = Date.now(); }
      [wx, wz] = st ? [st.x, st.z] : worldXZ(n);
      if (talking === n && Date.now() < n.face && !st) n.yaw = Math.atan2(P.x - wx, P.z - wz);
      const y = st ? st.y - 0.36 : n.zone === 'in' ? o.FLAT + o.IN.LY : ground(wx, wz);
      n.obj.position.set(wx, y, wz); n.obj.rotation.y = st ? st.yaw : n.yaw; n.t += dt * 60; n.f++;
      const nr = d < NEAR; if (nr || n.f % 4 === 0) {
        const k60 = dt * 60 * (nr ? 1 : 4); let ps;
        if (st) ps = { mode: 'idle', t: n.t, dt60: k60, dance3d: 'sit', beat: bt.beat, amt: 1 };
        else if (moving && n.pause <= 0) { const g = api.gaitFor(n.obj, 0.9, false); ps = { mode: 'walk', t: n.t, dt60: k60, speed: g.speed, cadence: g.cadence, stride: g.stride }; }
        else ps = { mode: 'idle', t: n.t, dt60: k60 };
        if (!st && Date.now() < n.animUntil) { ps.mode = 'idle'; ps.dance3d = n.anim; ps.beat = bt.beat; ps.amt = 1; }
        else if (!st && n.sayAt && Date.now() - n.sayAt < 2500 && n.k !== 'staff') { ps.dance3d = 'wave'; ps.beat = bt.beat; ps.amt = 0.8; }
        try { api.posePal3D(n.obj.userData.m, ps); } catch { /* */ }
      }
      if (d < 24) K.tag(n, n.name, wx, y + (st ? 1.5 : 1.85), wz); else K.hideTag(n);
      void showing;
    }
    // declutter: an NPC name tag never sits on top of a real player's tag or its Report / Block buttons
    if ((dcT -= dt) <= 0) { dcT = 0.25; const R = []; for (const e of document.querySelectorAll('#p3-tags .p3-tag')) if (e.style.display !== 'none') { const q = e.getBoundingClientRect(); if (q.width) R.push(q); }
      for (const n of npcs) { const el = n.tagEl; if (!el) continue; let hit = false; if (el.style.display !== 'none' && R.length) { const r = el.getBoundingClientRect(); hit = R.some((q) => r.left < q.right + 4 && r.right > q.left - 4 && r.top < q.bottom + 2 && r.bottom > q.top - 2); } const v = hit ? 'hidden' : ''; if (el.style.visibility !== v) el.style.visibility = v; } }
    if (bub && (Date.now() - bubAt > 15000 || !talking || !talking.obj.visible || talking.d > (talking.d0 || 3) + 3)) closeBub();
  }
  let dcT = 0;
  function nearest() { let b = null, bd = 9; for (const n of npcs) { if (!n.obj.visible || n.d == null) continue; const lim = n.k === 'staff' ? 2.7 : 2.0; if (n.d < lim && n.d < bd) { bd = n.d; b = n; } } return b; }
  // ---- tap to talk
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const rz = api.tc && api.tc.root && api.tc.root.querySelector('.kc-r'); let ts = null;
  const onDown = (e) => { if (e.button > 0) return; ts = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; };
  const onUp = (e) => { if (!ts || e.pointerId !== ts.id) return; const ok = Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 12 && performance.now() - ts.t < 400; ts = null; if (!ok) return;
    const vis = npcs.filter((n) => n.obj.visible && n.d < 18); if (!vis.length) return; const cv = api.view.querySelector('canvas') || api.view; const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, api.cam); const hit = ray.intersectObjects(vis.map((n) => n.obj), true)[0]; if (!hit) return;
    let ob = hit.object; while (ob.parent && !vis.some((n) => n.obj === ob)) ob = ob.parent; const n = vis.find((q) => q.obj === ob); if (n) talk(n); };
  if (rz) { rz.addEventListener('pointerdown', onDown); rz.addEventListener('pointerup', onUp); }
  function closeBub() { if (bub) bub.remove(); bub = null; talking = null; }
  function talk(n) {
    closeBub(); talking = n; n.d0 = n.d || 2; n.face = Date.now() + 6000; n.pause = Math.max(n.pause, 6); bubAt = Date.now();
    const d = document.createElement('div'); d.className = 'th-bub'; bub = d; K.hud.appendChild(d);
    const staffB = n.role === 'snack' ? '<button type="button" data-t="snack">🍿 Snack menu</button>' : n.role === 'ticket' ? '<button type="button" data-t="ticket">🎟️ Get a ticket</button>' : n.role === 'usher' ? '<button type="button" data-t="seat">🪑 Where do I sit?</button>' : '';
    d.innerHTML = `<div><b>${n.short}</b>${n.k === 'staff' ? ' · LKS Crew 🎬' : ''}</div><div class="th-bn">${staffB}<button type="button" data-t="wave">👋 Wave</button><button type="button" data-t="hi">🙂 Say hi</button><button type="button" data-t="movie">🎬 Ask about the movie</button><button type="button" data-t="dance">💃 Dance together</button><button type="button" class="ghost" data-t="x">✕</button></div>`;
    d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const t = b.dataset.t; bubAt = Date.now(); n.face = Date.now() + 6000;
      const sayN = (s) => { n.say = s; n.sayAt = Date.now(); };
      if (t === 'x') closeBub();
      else if (t === 'wave') { o.emote('👋'); n.anim = 'wave'; n.animUntil = Date.now() + 3000; sayN(pick(WAVE)); }
      else if (t === 'hi') { o.emote('💜'); sayN(`${pick(HI)} I’m ${n.short}.`); }
      else if (t === 'movie') { const m = o.nowShowing(); sayN(m ? `We’re showing “${m}” right now! Sing along! 🎤` : pick(SOON)); }
      else if (t === 'dance') { o.emote('🎉'); n.anim = 'groove'; n.animUntil = Date.now() + 5000; sayN('Let’s dance! 💃🕺'); }
      else if (t === 'snack') { closeBub(); o.snackMenu(n.short); }
      else if (t === 'ticket') { closeBub(); o.ticket(); sayN('Enjoy the show! 🎟️'); }
      else if (t === 'seat') sayN('Any seat you like! Just walk up and tap 🪑 Sit. Free entry! 🎬'); });
  }
  return { update, nearest, talk, seatTaken, inReady, get list() { return npcs; },
    destroy() { closeBub(); if (rz) { rz.removeEventListener('pointerdown', onDown); rz.removeEventListener('pointerup', onUp); } for (const n of npcs) K.hideTag(n), n.tagEl && n.tagEl.remove(), n.bubEl && n.bubEl.remove(); root.removeFromParent(); } };
}
