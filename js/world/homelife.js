// Kemy home life: fridge snacks, cooking, eating at a table, a glass of water, sleeping in bed and a (fully private, frosted) shower.
// Everything rides on the existing presence field dn (dance name), so other Pals inside see it with no extra reads or writes.
// Pal stats (hunger / happy / energy / clean) get a small boost, saved through the normal Pal save (throttled, 1 cached read).
// All original: emoji sprites + simple shapes. Written by Lone Keem.
import { register3D } from '../pals/dances3d.js';
export const FOODS = { apple: ['🍎', 'Apple'], banana: ['🍌', 'Banana'], sandwich: ['🥪', 'Sandwich'], pizza: ['🍕', 'Pizza slice'], cookie: ['🍪', 'Cookie'], cake: ['🍰', 'Cake'], juice: ['🧃', 'Juice'], milk: ['🥛', 'Milk'], icecream: ['🍨', 'Ice cream'], carrot: ['🥕', 'Carrots'] };
export const MEALS = { pancakes: ['🥞', 'Pancakes'], pasta: ['🍝', 'Pasta'], soup: ['🍲', 'Soup'] };
const ALL = { ...FOODS, ...MEALS, water: ['🥛', 'Water'] };
const SIT = { hy: -0.2, hrx: -0.08, cx: 0.06, nx: 0.05, aL: [16, 38, 50], aR: [16, 38, 50], lL: [84, 4, 80], lR: [84, 4, 80], slide: 1 };
let registered = false;
function registerPoses() { if (registered) return; registered = true; const g = { gentle: 1, ease: 'smooth' };
  register3D('sleep', { beats: 4, keys: [{ hy: -0.18, cx: 0.25, nx: 0.35, aL: [20, 40, 100], aR: [20, 40, 100] }, { hy: -0.18, cx: 0.27, nx: 0.37, aL: [20, 40, 100], aR: [20, 40, 100] }], ...g });
  register3D('shower', { beats: 2, keys: [{ aL: [60, 30, 120], aR: [60, 30, 120] }, { aL: [70, 30, 130], aR: [55, 30, 115] }], ...g });
  register3D('fresh', { beats: 2, keys: [{ aL: [140, 5, 15], aR: [140, 5, 15], hy: 0.05 }, { aL: [120, 5, 25], aR: [120, 5, 25] }], ...g });
  register3D('cook', { beats: 1, keys: [{ aR: [30, 70, 60], aL: [20, 40, 70], nx: 0.15 }, { aR: [40, 60, 80], aL: [20, 40, 70], nx: 0.15 }], ...g });
  for (const id of Object.keys(ALL)) { register3D('hold_' + id, { beats: 2, keys: [{ aR: [25, 70, 80] }, { aR: [25, 72, 82] }], ...g });
    register3D('eat_' + id, { beats: 2, keys: [{ ...SIT, aR: [25, 60, 70] }, { ...SIT, aR: [20, 85, 145], nx: 0.1 }], ...g });
    register3D('drink_' + id, { beats: 2, keys: [{ aR: [20, 80, 140], nx: -0.15 }, { aR: [20, 85, 150], nx: -0.2 }], ...g }); } }
const emo = new Map();
function sprite(THREE, e, sz) { let t = emo.get(e); if (!t) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = '50px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 32, 36); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; emo.set(e, t); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.setScalar(sz); return s; }
export function parseAct(dn) { if (!dn || typeof dn !== 'string') return null; if (['sleep', 'shower', 'fresh', 'cook'].includes(dn)) return { k: dn }; const m = /^(hold|eat|drink)_([a-z]+)$/.exec(dn); return m && ALL[m[2]] ? { k: m[1], it: m[2] } : null; }

export function attachHomeLife(api, H) { // H: { P, room(): {I, cx, cz}|null, inside(): house|null, say, sitAt(spot), unsit() }
  const { THREE } = api; const P = api.P; registerPoses();
  let held = null, busy = null, menu = null; // busy: { k, t, dur, done() }
  const css = document.createElement('style'); css.textContent = `#kh-life{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));z-index:2147483000;background:#f8fafc;color:#111;border-radius:14px;padding:8px;box-shadow:0 4px 16px #0004;max-width:min(240px,60vw);font:600 13px system-ui}
#kh-life b{display:block;margin:0 2px 6px}#kh-life .g{display:flex;flex-wrap:wrap;gap:4px}#kh-life button{border:0;border-radius:10px;background:#e2e8f0;color:#111;padding:6px 7px;font:600 12px system-ui;cursor:pointer}#kh-life button:active{background:#cbd5e1}#kh-life .x{background:#fee2e2}
@media (orientation:landscape) and (max-height:500px){#kh-life{bottom:calc(120px + env(safe-area-inset-bottom))}}`; document.head.appendChild(css);
  // ---- stats: one cached read of my Pal, small boosts, saved at most once a minute (the Pal save is throttled + rules-limited too)
  let pal = null, palP = null, boost = {}, lastSave = 0, store = null;
  async function bump(o) { for (const k in o) boost[k] = (boost[k] || 0) + o[k]; if (Date.now() - lastSave > 60000) flush(); }
  async function flush() { if (!Object.keys(boost).length || !api.db || !api.S?.user) return; lastSave = Date.now(); try { const core = await import('../pals/core.js'); if (!palP) palP = core.getActivePal(api.db, api.S.user.uid).catch(() => null); pal = pal || await palP; if (!pal) return; store = store || core.createStore(api.db, api.S.user.uid);
      const s = core.liveStats(pal); for (const k in boost) if (k in s) s[k] = Math.min(100, s[k] + boost[k]); boost = {}; await store.save(pal, { stats: s }); } catch (e) { console.warn('pal stats', e.code || e.message || e); } }
  // ---- sound: soft filtered noise (sizzle / water) if WebAudio exists
  let ac = null, noise = null; function hiss(kind, dur) { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const n = ac.sampleRate * dur | 0; const b = ac.createBuffer(1, n, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (kind === 'sizzle' ? (Math.random() < 0.3 ? 1 : 0.3) : 0.6);
      const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = kind === 'sizzle' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'sizzle' ? 3000 : 900; const g = ac.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(kind === 'sizzle' ? 0.05 : 0.06, ac.currentTime + 0.3); g.gain.setValueAtTime(kind === 'sizzle' ? 0.05 : 0.06, ac.currentTime + dur - 0.5); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      s.connect(f); f.connect(g); g.connect(ac.destination); s.start(); noise = s; } catch { /* no audio */ } }
  function stopHiss() { try { noise && noise.stop(); } catch { /* */ } noise = null; }
  // ---- my dn
  function setDn(dn, ms = 864e5) { P.dance = dn; P.danceUntil = dn ? Date.now() + ms : 0; api.markDirty && api.markDirty(); api.send && api.send(true); }
  const restDn = () => (P.sit ? 'sit' : held ? 'hold_' + held : '');
  function closeMenu() { if (menu) { menu.remove(); menu = null; } const r = H.room(); if (r && r.I.fridgeDoor) r.I.fridgeDoor.userData.want = 0; }
  function openMenu(title, list, pick) { closeMenu(); menu = document.createElement('div'); menu.id = 'kh-life'; menu.innerHTML = `<b>${title}</b><div class="g">${Object.entries(list).map(([k, [e, n]]) => `<button data-k="${k}">${e} ${n}</button>`).join('')}<button class="x" data-k="">✕</button></div>`;
    menu.onclick = (ev) => { const b = ev.target.closest('button'); if (!b) return; const k = b.dataset.k; closeMenu(); if (k) pick(k); }; document.body.appendChild(menu); }
  const near = (q, r = 1.25) => Math.hypot(q.s[0] - P.x, q.s[1] - P.z) < r && Math.abs(P.y - q.y) < 1.2;
  function spots() { const r = H.room(); return (r && r.I.spots) || []; }
  function start(k, dur, dn, done) { busy = { k, t: 0, t0: performance.now(), dur, done }; setDn(dn, dur * 1000 + 3000); }
  // ---- prompts (one small pill at a time; homes.js shows it bottom-right)
  function prompt() { if (!H.inside()) return null; if (busy) return busy.k === 'sleep' ? { id: 'kh:life:wake', label: '☀️ Wake up' } : { id: 'kh:life:wait', label: '⏳ …' };
    const sat = P.sit && P.sit.seat; if (sat) { if (sat.c[0] === 'b') return { id: 'kh:life:sleep', label: '😴 Sleep' }; if (held && !/^(juice|milk|water)$/.test(held)) return { id: 'kh:life:eat', label: '😋 Eat ' + ALL[held][1] }; if (held) return { id: 'kh:life:drinkheld', label: '🥤 Drink ' + ALL[held][1] }; return null; }
    for (const q of spots()) if (near(q)) { if (q.k === 'fridge') return { id: 'kh:life:fridge', label: '🧊 Open fridge' }; if (q.k === 'stove') return { id: 'kh:life:stove', label: '🍳 Cook' }; if (q.k === 'sink') return { id: 'kh:life:sink', label: '🚰 Drink water' }; if (q.k === 'shower') return { id: 'kh:life:shower', label: '🚿 Shower' }; }
    if (held) return { id: 'kh:life:eatnow', label: (/^(juice|milk)$/.test(held) ? '🥤 Drink ' : '😋 Eat ') + ALL[held][1] }; return null; }
  function act(k) { const spot = (n) => spots().find((q) => q.k === n);
    if (k === 'fridge') { const r = H.room(); if (r && r.I.fridgeDoor) r.I.fridgeDoor.userData.want = 1; P.yaw = spot('fridge').yaw; openMenu('🧊 Fridge · pick a snack', FOODS, (it) => { held = it; setDn('hold_' + it); H.say(ALL[it][0] + ' Got ' + ALL[it][1] + '! Sit at a table or chair to eat it.'); }); }
    else if (k === 'stove') { const q = spot('stove'); P.yaw = q.yaw; openMenu('🍳 Cook a meal', MEALS, (it) => { hiss('sizzle', 4); start('cook', 4, 'cook', () => { stopHiss(); held = it; setDn('hold_' + it); H.say(ALL[it][0] + ' ' + ALL[it][1] + ' ready! Find a seat to eat.'); }); }); }
    else if (k === 'sink') { const q = spot('sink'); P.yaw = q.yaw; hiss('water', 1.2); start('drink', 3, 'drink_water', () => { setDn(restDn()); bump({ hunger: 2, happy: 2 }); H.say('💧 Ahh, fresh water!'); }); }
    else if (k === 'shower') { const q = spot('shower'); H.sitAt({ x: q.o[0], z: q.o[1], y: q.y + 0.6, yaw: q.yaw, back: [q.s[0], q.s[1], q.y], dn: 'shower' }); hiss('water', 6); start('shower', 6, 'shower', () => { stopHiss(); H.unsit(); start('fresh', 2, 'fresh', () => { setDn(restDn()); }); bump({ clean: 30, happy: 4 }); H.say('✨ Squeaky clean!'); }); }
    else if (k === 'sleep') { const s = P.sit.seat; const r0 = H.room(); const pr = r0 && r0.I.seats().find((q) => q !== s && q.c === s.c && Math.abs(q.yaw - s.yaw) < 0.01 && Math.hypot(q.x - s.x, q.z - s.z) < 1.3); const mx = pr ? (s.x + pr.x) / 2 : s.x, mz = pr ? (s.z + pr.z) / 2 : s.z; const cxb = mx - s.fx * 0.9, czb = mz - s.fz * 0.9; H.sitAt({ x: cxb + s.fx * 0.35, z: czb + s.fz * 0.35, y: s.y + 0.02, yaw: s.yaw, back: P.sit.back, dn: 'sleep', seat: s }); busy = { k: 'sleep', t: 0, t0: performance.now(), dur: 1e9 }; setDn('sleep'); dim(true); H.say('😴 Sweet dreams… tap Wake up any time.'); }
    else if (k === 'wake') { const slept = busy && busy.t; busy = null; dim(false); H.unsit(); setDn(restDn()); if (slept > 5) bump({ energy: Math.min(40, Math.round(slept / 3)), happy: 3 }); H.say('☀️ Good morning!'); }
    else if (k === 'eat' || k === 'drinkheld' || k === 'eatnow') { const it = held; if (!it) return; const drink = /^(juice|milk|water)$/.test(it); start('eat', 4, (drink || !P.sit ? (drink ? 'drink_' : 'hold_') : 'eat_') + it, () => { held = null; setDn(P.sit ? 'sit' : ''); crumbs = drink ? 0 : 1.5; P.e = '😋'; P.eAt = Date.now(); api.markDirty && api.markDirty(); bump({ hunger: MEALS[it] ? 30 : drink ? 8 : 15, happy: MEALS[it] ? 8 : 4 }); H.say(ALL[it][0] + ' Yum!'); }); } }
  // ---- lights (only on my screen) while I sleep
  let dimmed = null; function dim(on) { const L = [api.hemi, api.sun].filter(Boolean); if (on && !dimmed) { dimmed = L.map((l) => l.intensity); L.forEach((l) => { l.intensity *= 0.45; }); } else if (!on && dimmed) { L.forEach((l, i) => { l.intensity = dimmed[i]; }); dimmed = null; } }
  // ---- props on every Pal (me + others inside) from their dn
  let crumbs = 0; const props = new Map(); // obj -> { key, g }
  function propsFor(obj, dn, t) { if (!obj) return; const a = parseAct(dn); const key = a ? a.k + ':' + (a.it || '') : ''; let e = props.get(obj); const m = obj.userData.m || obj;
    if (!e || e.key !== key) { if (e && e.g) { obj.remove(e.g); e.g.traverse((q) => q.material && q.material.dispose()); } e = { key, g: null }; props.set(obj, e); m.rotation.x = 0;
      if (a) { const g = new THREE.Group(); e.g = g; obj.add(g); const Hh = 1.45;
        if (a.k === 'sleep') { const q = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.24, 1.15), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.95 })); q.position.set(0, 0.3, -0.45); g.add(q); const f = new THREE.Mesh(new THREE.BoxGeometry(0.97, 0.26, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff })); f.position.set(0, 0.3, 0.12); g.add(f); for (let i = 0; i < 3; i++) { const z = sprite(THREE, '💤', 0.3); z.userData.z = i; g.add(z); } }
        else if (a.k === 'shower') { const mat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.3 }); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.0, 24, 1, true), mat); c.position.y = 0.85; g.add(c); const top = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), mat); top.rotation.x = Math.PI / 2; top.position.y = 1.85; g.add(top); // frosted + opaque: the Pal is fully hidden
          for (let i = 0; i < 4; i++) { const r = sprite(THREE, '🫧', 0.22); r.userData.b = i; g.add(r); } for (let i = 0; i < 3; i++) { const s = sprite(THREE, '☁️', 0.45); s.userData.s = i; g.add(s); } for (let i = 0; i < 4; i++) { const d = sprite(THREE, '💧', 0.14); d.userData.w = i; g.add(d); } }
        else if (a.k === 'fresh') { for (let i = 0; i < 6; i++) { const s = sprite(THREE, '✨', 0.26); s.userData.f = i; g.add(s); } }
        else if (a.k === 'cook') { for (let i = 0; i < 3; i++) { const s = sprite(THREE, i ? '💨' : '🔥', 0.26); s.userData.c = i; g.add(s); } }
        else { const it = sprite(THREE, ALL[a.it][0], 0.34); it.userData.hand = a.k; g.add(it); } } }
    if (m.visible !== !(a && a.k === 'shower')) m.visible = !(a && a.k === 'shower'); // behind the frosted curtain the Pal is simply not drawn
    if (!e.g) return; const lying = a && a.k === 'sleep'; m.rotation.x = lying ? -Math.PI / 2 : 0; if (lying) { m.position.y = 0.18; try { for (const ey of m.userData.J?.eyes || []) { const l = ey.userData.lid; if (l) l.position.y = l.userData.shut; } } catch { /* */ } } else if (e.lay) m.position.y = 0; e.lay = lying;
    for (const c of e.g.children) { const u = c.userData;
      if (u.z != null) { const k = (t * 0.45 + u.z / 3) % 1; c.position.set(0.25 + k * 0.3, 0.6 + k * 0.7, -0.9); c.material.opacity = 1 - k; }
      else if (u.b != null) { const k = (t * 0.5 + u.b / 4) % 1; const an = u.b * 1.6 + t; c.position.set(Math.cos(an) * 0.7, 0.3 + k * 1.6, Math.sin(an) * 0.7); c.material.opacity = 1 - k; }
      else if (u.s != null) { const k = (t * 0.25 + u.s / 3) % 1; c.position.set(Math.sin(u.s * 2) * 0.3, 1.9 + k * 0.8, Math.cos(u.s * 2) * 0.3); c.material.opacity = (1 - k) * 0.8; }
      else if (u.w != null) { const k = (t * 1.6 + u.w / 4) % 1; c.position.set(Math.cos(u.w * 1.6) * 0.66, 1.8 - k * 1.6, Math.sin(u.w * 1.6) * 0.66); }
      else if (u.f != null) { const an = u.f * 1.05 + t * 2; c.position.set(Math.cos(an) * 0.6, 0.4 + (u.f % 3) * 0.45 + Math.sin(t * 3 + u.f) * 0.08, Math.sin(an) * 0.6); }
      else if (u.c != null) { const k = (t * 0.6 + u.c / 3) % 1; c.position.set(0, (u.c ? 1.1 + k * 0.7 : 1.0), 0.75); c.material.opacity = u.c ? 1 - k : 0.9; c.visible = true; }
      else if (u.hand) { const bob = u.hand === 'eat' || u.hand === 'drink' ? Math.max(0, Math.sin(t * 5)) : 0; c.position.set(-0.28, (u.hand === 'drink' ? 1.05 : 0.75) + bob * 0.3, 0.35 - bob * 0.1); } } }
  let T = 0; const crumbS = [];
  function update(dt) { T += dt;
    if (busy) { busy.t = (performance.now() - busy.t0) / 1000; if (busy.t >= busy.dur) { const d = busy.done; busy = null; d && d(); } }
    if (!H.inside()) { if (busy && busy.k === 'sleep') act('wake'); if (menu) closeMenu(); if (held) { held = null; } }
    // fridge door swing
    const r = H.room(); if (r && r.I.fridgeDoor) { const fd = r.I.fridgeDoor; const w = (fd.userData.want || 0) * -1.6; fd.rotation.y += (w - fd.rotation.y) * Math.min(1, dt * 6); }
    // props for me and everyone else inside
    const myDn = P.dance && Date.now() < P.danceUntil ? P.dance : (held ? 'hold_' + held : ''); propsFor(api.me, myDn, T);
    if (api.others) for (const o of api.others.values()) propsFor(o.obj, H.inside() && o.dn, T);
    if (crumbs > 0) { crumbs -= dt; if (!crumbS.length) for (let i = 0; i < 5; i++) { const c = sprite(THREE, '🟤', 0.05); api.scene.add(c); crumbS.push(c); } crumbS.forEach((c, i) => { const k = 1 - crumbs / 1.5; c.position.set(P.x + Math.sin(i * 2.3) * 0.25, P.y + 0.9 - k * 0.8 + i * 0.02, P.z + Math.cos(i * 2.3) * 0.25); c.visible = true; }); }
    else if (crumbS.length) { crumbS.forEach((c) => { api.scene.remove(c); c.material.dispose(); }); crumbS.length = 0; } }
  function destroy() { closeMenu(); css.remove(); dim(false); stopHiss(); flush(); for (const [o, e] of props) if (e.g) o.remove(e.g); props.clear(); }
  addEventListener('pagehide', flush);
  return { prompt, act, update, destroy, held: () => held, busy: () => busy && busy.k, flush };
}
