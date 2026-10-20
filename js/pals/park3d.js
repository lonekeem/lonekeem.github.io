// Pal Park 3D: a shared, real-3D park. Third-person camera (drag to orbit, pinch/wheel to zoom, no clipping) or
// first-person POV (you ARE your Pal: arms, paws and held items at the bottom of the screen). Joystick + jump/run on
// phones, WASD/Space/Shift on desktop. Physics-lite: gravity, jumping, collisions with trees/rocks/buildings, slopes, stairs.
// World: gentle-hill terrain, instanced trees (oak, pine, birch) with near/far LOD, swaying grass, flowers, a pond with
// water shading, paths, benches, lamps, a playground, a fountain and the purple Kemy Studio. All original, built in code.
// Multiplayer: Firestore presence in rooms of 25 (parkRooms/rN/p/{uid}), <= 4 writes/s while moving, 15 s heartbeat,
// interpolation, stale cleanup. Chat via the safety filter, bubbles + chat log, report / mute / block.
import { doc, getDocs, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, addDoc }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { THREE, makePal3D, posePal3D, gfxLevel } from './pal3d.js';
import { WALK_V } from './motion3d.js';
import { getActivePal } from './core.js';
import { clean, checkInput } from './talk.js';
import { treasures, EMOTES, PHRASES, PORTALS } from './park.js';
import { createControls } from '../controls.js';
import { openWheel, renderQuickChat, loadOwnedEmotes } from './emote-wheel.js';
import { emoteMs, EMOTE_BY_ID } from './emotes.js';
import { parkGames } from './park-games.js';
import { MINIGAMES } from './minigames.js';

const PX = 16, CX = 1600, CY = 1200;                 // 1 m = 16 park units; (1600,1200) = plaza centre (same as 2D park)
const toW = (x, y) => [(x - CX) / PX, (y - CY) / PX]; const toP = (x, z) => [Math.round(x * PX + CX), Math.round(z * PX + CY)];
const W = 100, H = 75;                                // world half-size (200 m x 150 m)
const MAX_ROOM = 25, ROOMS = 20, SEND_MS = 240, HB_MS = 15000, STALE_MS = 30000;
const PORTAL_NAME = { race: 'Pal Race', bubbles: 'Bubble Pop', stars: 'Star Catch', dance: 'Dance-Off' };
const EMO_DANCE = { '👋': 'wave', '💜': 'happyshimmy', '😂': 'bounce', '😮': 'woah', '🎉': 'groove', '😴': 'slowmo', '⭐': 'twirl', '🐾': 'hopclap' };
const BPM = 112;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };

// ------------------------------------------------------------------ world layout
const POND = { x: -62, z: -48, rx: 20, rz: 13 }, LAKE = { x: 70, z: 50, rx: 22, rz: 16 };
const HUB = { x: 30, z: 20, r: 9 };
const PLAZA_R = 13, STUDIO = { x: -52, z: 38, w: 22, d: 14, h: 11 }, PLAY = { x: 48, z: -36 };
const inEll = (e, x, z, pad = 0) => ((x - e.x) / (e.rx + pad)) ** 2 + ((z - e.z) / (e.rz + pad)) ** 2 < 1;
const ellD = (e, x, z) => Math.sqrt(((x - e.x) / e.rx) ** 2 + ((z - e.z) / e.rz) ** 2);
function pathD(x, z) { // distance to the nearest path centre line (cross paths, plaza ring, loop)
  const r = Math.hypot(x, z); let d = Math.min(Math.abs(x), Math.abs(z), Math.abs(r - PLAZA_R - 1));
  const lr = Math.hypot(x / 1.35, z); d = Math.min(d, Math.abs(lr - 52) * 1.1); return d; }
function ground(x, z) { // gentle hills, flattened at the plaza, paths, studio and playground; bowls under the water
  let h = 2 + Math.sin(x * 0.045) * Math.cos(z * 0.05) * 2.2 + Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4) * 0.8 + Math.cos((x + z) * 0.021) * 1.6;
  const flat = (cx, cz, r0, r1, to) => { const d = Math.hypot(x - cx, z - cz); if (d < r1) { const k = d < r0 ? 1 : 1 - (d - r0) / (r1 - r0); h = h + (to - h) * k * k * (3 - 2 * k); } };
  flat(0, 0, PLAZA_R + 3, PLAZA_R + 14, 2.4); flat(STUDIO.x, STUDIO.z, 16, 26, 2.6); flat(PLAY.x, PLAY.z, 12, 20, 2.2); flat(HUB.x, HUB.z, HUB.r + 3, HUB.r + 10, 2.4);
  for (const e of [POND, LAKE]) { const d = ellD(e, x, z); if (d < 1.5) { const k = Math.max(0, 1.5 - d) / 1.5; h -= k * k * 3.2; } }
  const pd = pathD(x, z); if (pd < 3) h -= (3 - pd) * 0.05;
  const edge = Math.max(Math.abs(x) - (W - 12), Math.abs(z) - (H - 12), 0); h += edge * edge * 0.12; // rim hills
  return h; }
const WATER_Y = { pond: 0, lake: 0 }; { WATER_Y.pond = ground(POND.x, POND.z) + 2.2; WATER_Y.lake = ground(LAKE.x, LAKE.z) + 2.2; }

export function createPark3D(ctx) {
  const { S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal } = ctx;
  let stop = null;
  async function page() {
    if (!requireAuth()) return; if (stop) stop();
    if (!document.getElementById('p3-css')) { const l = document.createElement('link'); l.id = 'p3-css'; l.rel = 'stylesheet'; l.href = new URL('../../css/park3d.css', import.meta.url).href; document.head.appendChild(l); }
    const gfx = gfxLevel() === 'flat' ? 'low' : gfxLevel(); const ULTRA = gfx === 'ultra', LOW = gfx === 'low';
    main.innerHTML = `<section class="p3"><div class="p3-view" id="p3-view">
      <canvas id="park-cv" class="p3-cv" tabindex="0" aria-label="Pal Park 3D. Joystick or WASD to walk, Space to jump, Shift to run. Drag to look around."></canvas>
      <div class="p3-top"><a class="p3-b" href="#/pals" aria-label="Leave Pal Park">✕</a><b>🌳 Pal Park</b><span id="park-room" class="p3-room"></span><span id="park-found" class="p3-found"></span><span class="p3-fps" id="p3-fps"></span></div><button class="p3-b" id="p3-set" aria-label="Control settings">⚙️</button>
      <div class="p3-log" id="p3-log" aria-live="polite"></div>
      <div class="p3-tags" id="p3-tags"></div>
      <form class="p3-chat" id="p3-chat"><input id="p3-t" maxlength="60" placeholder="Say something nice…" autocomplete="off" enterkeyhint="send" aria-label="Chat message"><button class="p3-send" aria-label="Send">➤</button><button type="button" class="p3-b" id="p3-quick" aria-label="Quick phrases">💬</button></form>
      <div class="p3-panel" id="park-panel" hidden></div><div class="p3-hint" id="p3-hint"></div><div class="p3-load" id="p3-load">Building the park…</div></div></section>`;
    document.body.classList.add('p3-on');
    const view = main.querySelector('#p3-view'), cv = main.querySelector('#park-cv');
    const $ = (s) => main.querySelector(s);
    // ---------------------------------------------------------------- renderer
    const R = new THREE.WebGLRenderer({ canvas: cv, antialias: !LOW, powerPreference: 'high-performance' });
    const DPR = Math.min(devicePixelRatio || 1, ULTRA ? 2 : LOW ? 1 : 1.5); let dprK = 1;
    R.setPixelRatio(DPR); R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    R.shadowMap.enabled = !LOW; R.shadowMap.type = THREE.PCFSoftShadowMap;
    let lost = false; cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; }); cv.addEventListener('webglcontextrestored', () => { lost = false; });
    const scene = new THREE.Scene(); const SKY = new THREE.Color('#a9d8ff'), FOG = new THREE.Color('#cfe6f5');
    scene.fog = new THREE.Fog(FOG, LOW ? 45 : 70, LOW ? 120 : 190);
    const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 420);
    const size = () => { const w = view.clientWidth || innerWidth, h = view.clientHeight || innerHeight; R.setPixelRatio(DPR * dprK); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    size(); addEventListener('resize', size);
    // lights
    const hemi = new THREE.HemisphereLight('#dff1ff', '#6a8f4e', 1.1); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff3dc', 2.6); sun.position.set(40, 70, 25); scene.add(sun); scene.add(sun.target);
    if (!LOW) { sun.castShadow = true; const sm = ULTRA ? 2048 : 1024; sun.shadow.mapSize.set(sm, sm); const sc = sun.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 10; sc.far = 160; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4; }
    // sky dome (gradient + sun glow) and clouds
    const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { sunDir: { value: sun.position.clone().normalize() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w; }',
      fragmentShader: 'uniform vec3 sunDir; varying vec3 vP; void main(){ float h = max(vP.y, 0.); vec3 top = vec3(.28,.55,.93), hor = vec3(.78,.89,.97); vec3 c = mix(hor, top, pow(h, .55)); float s = max(dot(vP, sunDir), 0.); c += vec3(1.,.9,.7) * (pow(s, 600.) * 4. + pow(s, 12.) * .25); if (vP.y < 0.) c = mix(hor, vec3(.62,.75,.6), min(1., -vP.y * 4.)); gl_FragColor = vec4(c, 1.); }' });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
    const R0 = rng(7);
    const cloudG = new THREE.IcosahedronGeometry(1, LOW ? 1 : 2), cloudM = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#c8d8ea', emissiveIntensity: 0.35, fog: false });
    const NC = LOW ? 60 : 140, clouds = new THREE.InstancedMesh(cloudG, cloudM, NC); const cloudBase = [];
    { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0;
      for (let c = 0; c < NC / 7; c++) { const cx = (R0() - 0.5) * 520, cz = (R0() - 0.5) * 520, cy = 85 + R0() * 35;
        for (let i = 0; i < 7 && k < NC; i++, k++) { p.set(cx + (i - 3) * 6 + R0() * 4, cy + R0() * 3, cz + R0() * 6); const r = 6 + R0() * 6; s.set(r * 1.4, r * 0.7, r); m.compose(p, q, s); clouds.setMatrixAt(k, m); cloudBase.push(p.clone()); } } }
    clouds.frustumCulled = false; scene.add(clouds);

    // ---------------------------------------------------------------- terrain
    const seg = ULTRA ? 220 : LOW ? 90 : 160;
    const tg = new THREE.PlaneGeometry(W * 2 + 60, H * 2 + 60, seg, Math.round(seg * 0.75)); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3); const cA = new THREE.Color('#5d9b3c'), cB = new THREE.Color('#7fb84e'), cP = new THREE.Color('#d9c49a'), cS = new THREE.Color('#c9b98a'), cPl = new THREE.Color('#d8d2c6'), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = ground(x, z); pos.setY(i, y);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5; tmp.copy(cA).lerp(cB, n * 0.8 + (y - 2) * 0.05);
      const pd = pathD(x, z); if (pd < 2.2) tmp.lerp(cP, Math.min(1, (2.2 - pd) / 0.8));
      if (Math.hypot(x, z) < PLAZA_R) tmp.copy(cPl);
      for (const e of [POND, LAKE]) { const d = ellD(e, x, z); if (d < 1.25) tmp.lerp(cS, Math.min(1, (1.25 - d) * 5)); }
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b; }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })); terrain.receiveShadow = true; scene.add(terrain);
    // plaza tiles ring + kerb
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(PLAZA_R, 0.25, 8, 64), new THREE.MeshStandardMaterial({ color: '#b8ad9c', roughness: 0.8 })); kerb.rotation.x = Math.PI / 2; kerb.position.y = 2.42; kerb.receiveShadow = true; scene.add(kerb);

    // ---------------------------------------------------------------- water (pond + lake): fresnel, waves, sky reflection
    const waterU = { t: { value: 0 }, sunDir: { value: sun.position.clone().normalize() } };
    const waterM = new THREE.ShaderMaterial({ transparent: true, uniforms: { ...waterU, fogColor: { value: FOG }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } }, fog: true,
      vertexShader: 'varying vec3 vW; varying float vFog; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vFog = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float t; uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear, fogFar; varying vec3 vW; varying float vFog;
        void main(){ vec2 p = vW.xz; float a = sin(p.x*.9+t*1.3)*.5+sin(p.y*1.1-t*1.1)*.5+sin((p.x+p.y)*2.3+t*2.)*.25+sin((p.x-p.y)*3.1-t*2.6)*.15;
          vec3 n = normalize(vec3(cos(p.x*.9+t*1.3)*.25+cos((p.x+p.y)*2.3+t*2.)*.3, 1., cos(p.y*1.1-t*1.1)*.25+cos((p.x-p.y)*3.1-t*2.6)*.2));
          vec3 v = normalize(cameraPosition - vW); float fr = pow(1. - max(dot(n, v), 0.), 3.); vec3 deep = vec3(.06,.3,.42), shallow = vec3(.25,.6,.66), skyc = vec3(.62,.82,.97);
          vec3 c = mix(mix(deep, shallow, .4 + a*.1), skyc, .25 + fr*.6); vec3 h = normalize(sunDir + v); c += vec3(1.,.95,.85) * pow(max(dot(n,h),0.), 180.) * 1.6;
          float f = smoothstep(fogNear, fogFar, vFog); gl_FragColor = vec4(mix(c, fogColor, f), .86); }` });
    const water = [];
    for (const [e, y] of [[POND, WATER_Y.pond], [LAKE, WATER_Y.lake]]) { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, waterM); m.scale.set(e.rx * 1.25, 1, e.rz * 1.25); m.position.set(e.x, y - 0.6, e.z); scene.add(m); water.push(m); }
    // lily pads
    { const lg = new THREE.CircleGeometry(0.6, 12, 0.3, Math.PI * 1.8); lg.rotateX(-Math.PI / 2); const lm = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: '#4f9a4a', roughness: 0.6 }), 24); const m = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < 24; i++) { const a = R0() * 6.28, r = 0.3 + R0() * 0.6; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R0() * 6); m.compose(new THREE.Vector3(POND.x + Math.cos(a) * POND.rx * r, WATER_Y.pond - 0.55, POND.z + Math.sin(a) * POND.rz * r), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.7 + R0())); lm.setMatrixAt(i, m); } scene.add(lm); }

    // ---------------------------------------------------------------- colliders: cylinders {x,z,r,top} and boxes {x0,x1,z0,z1,top,bot}
    const cyl = [], box = [];
    const addBox = (x, z, w, d, top, bot = -99, rot = 0) => { box.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, top, bot }); };
    const walkable = (x, z, pad = 0) => !(inEll(POND, x, z, pad) || inEll(LAKE, x, z, pad)) && Math.abs(x) < W - 4 && Math.abs(z) < H - 4;
    const freeSpot = (x, z, r) => walkable(x, z, 3) && pathD(x, z) > 3 + r && Math.hypot(x, z) > PLAZA_R + 4 + r && Math.hypot(x - STUDIO.x, z - STUDIO.z) > 20 && Math.hypot(x - PLAY.x, z - PLAY.z) > 17 && Math.hypot(x - HUB.x, z - HUB.z) > HUB.r + 5;

    // ---------------------------------------------------------------- trees: 3 kinds, instanced, near (detailed) + far (simple) LOD
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: 0, flatShading: !!o.flat, ...(o.e ? { emissive: o.e, emissiveIntensity: o.ei ?? 1 } : {}) });
    function leafGeo(kind, detail) { // merged crown blobs, built once per kind/detail
      const parts = []; const R1 = rng(kind.length * 31 + detail);
      if (kind === 'pine') for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(2.3 - i * 0.45, 2.6, detail ? 10 : 6); g.translate(0, 3 + i * 1.5, 0); parts.push(g); }
      else { const n = kind === 'oak' ? 7 : 5; for (let i = 0; i < n; i++) { const g = new THREE.IcosahedronGeometry(kind === 'oak' ? 1.7 : 1.2, detail ? 2 : 0); const a = i * 2.4, r = i ? (kind === 'oak' ? 1.4 : 0.9) : 0; g.scale(1, 0.85, 1); g.translate(Math.cos(a) * r, (kind === 'oak' ? 4.6 : 5) + (R1() - 0.3) * 1.3 + (i ? 0 : 0.6), Math.sin(a) * r); parts.push(g); } }
      return mergeGeos(parts); }
    function mergeGeos(gs) { // tiny merge (position + normal), avoids pulling in the addons
      const ng = gs.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; ng.forEach((g) => (n += g.attributes.position.count));
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0; ng.forEach((g) => { g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; });
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return out; }
    const KINDS = { oak: { leaf: ['#3f8a35', '#4f9c3c', '#5aa844'], trunk: '#6b4a32', h: 3.4, n: ULTRA ? 140 : LOW ? 60 : 110 }, pine: { leaf: ['#2f6b3a', '#2b5e35'], trunk: '#5a3d28', h: 2.6, n: ULTRA ? 120 : LOW ? 50 : 90 }, birch: { leaf: ['#8cc04f', '#a4cc5a', '#e0b84a'], trunk: '#e8e4da', h: 4.2, n: ULTRA ? 80 : LOW ? 30 : 60 } };
    const trees = [];
    for (const [kind, K] of Object.entries(KINDS)) { const pts = []; let tries = 0;
      while (pts.length < K.n && tries++ < 4000) { const x = (R0() - 0.5) * (W * 2 - 10), z = (R0() - 0.5) * (H * 2 - 10); if (!freeSpot(x, z, 2)) continue; if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue; const t = { x, z, kind, s: 0.8 + R0() * 0.55, rot: R0() * 6.28, c: K.leaf[Math.floor(R0() * K.leaf.length)] }; pts.push(t); trees.push(t); cyl.push({ x, z, r: 0.45 * t.s, top: 99 }); }
      const trunkG = new THREE.CylinderGeometry(0.22, 0.38, K.h, 8); trunkG.translate(0, K.h / 2, 0);
      const mk = (g, m, cnt) => { const im = new THREE.InstancedMesh(g, m, cnt); im.castShadow = !LOW; im.receiveShadow = !LOW; im.count = 0; scene.add(im); return im; };
      K.near = { trunk: mk(trunkG, std(K.trunk), pts.length), leaf: mk(leafGeo(kind, 1), std('#ffffff', { r: 0.8 }), pts.length) };
      K.far = { trunk: mk(trunkG, std(K.trunk), pts.length), leaf: mk(leafGeo(kind, 0), std('#ffffff', { r: 0.9, flat: true }), pts.length) };
      K.far.trunk.castShadow = K.far.leaf.castShadow = false; K.pts = pts; }
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    const NEAR_TREE = ULTRA ? 55 : LOW ? 22 : 38;
    function lodTrees(px, pz) { for (const K of Object.values(KINDS)) { let a = 0, b = 0;
      for (const t of K.pts) { const d = Math.hypot(t.x - px, t.z - pz); const L = d < NEAR_TREE ? K.near : K.far; const i = d < NEAR_TREE ? a++ : b++;
        _q.setFromAxisAngle(Y, t.rot); _s.setScalar(t.s); _p.set(t.x, ground(t.x, t.z) - 0.2, t.z); _m.compose(_p, _q, _s); L.trunk.setMatrixAt(i, _m); L.leaf.setMatrixAt(i, _m); L.leaf.setColorAt(i, _c.set(t.c)); }
      K.near.trunk.count = K.near.leaf.count = a; K.far.trunk.count = K.far.leaf.count = b;
      for (const L of [K.near, K.far]) { L.trunk.instanceMatrix.needsUpdate = L.leaf.instanceMatrix.needsUpdate = true; if (L.leaf.instanceColor) L.leaf.instanceColor.needsUpdate = true; L.trunk.computeBoundingSphere(); L.leaf.computeBoundingSphere(); } } }

    // ---------------------------------------------------------------- rocks
    { const n = LOW ? 30 : 60; const rg = new THREE.DodecahedronGeometry(1, 1); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 7.1) * 0.12), p.getY(i) * (0.7 + Math.cos(i * 3.3) * 0.1), p.getZ(i)); rg.computeVertexNormals(); }
      const rm = new THREE.InstancedMesh(rg, std('#8e8a83', { r: 0.95, flat: true }), n); rm.castShadow = rm.receiveShadow = !LOW; let k = 0, tries = 0;
      while (k < n && tries++ < 2000) { const x = (R0() - 0.5) * (W * 2 - 12), z = (R0() - 0.5) * (H * 2 - 12); if (!freeSpot(x, z, 1)) continue; const s = 0.5 + R0() * 1.4; const gy = ground(x, z);
        _q.setFromEuler(new THREE.Euler(R0(), R0() * 6, R0() * 0.3)); _m.compose(_p.set(x, gy + s * 0.25, z), _q, _s.set(s * 1.2, s, s)); rm.setMatrixAt(k++, _m); cyl.push({ x, z, r: s * 1.05, top: gy + s * 0.85 }); }
      rm.count = k; scene.add(rm); }

    // ---------------------------------------------------------------- grass (instanced blades, wind sway in the vertex shader) + flowers
    const wind = { value: 0 };
    { const n = ULTRA ? 52000 : LOW ? 7000 : 22000; const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.05, 0, 0, 0.05, 0, 0, 0, 0.36, 0.02]), 3)); bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
      const gm = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      gm.onBeforeCompile = (sh) => { sh.uniforms.wind = wind; sh.vertexShader = 'uniform float wind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.); float k = position.y * 1.8; transformed.x += sin(wind * 1.7 + ip.x * .35 + ip.z * .22) * .16 * k; transformed.z += cos(wind * 1.3 + ip.x * .2) * .09 * k;`); };
      const gr = new THREE.InstancedMesh(bg, gm, n); gr.receiveShadow = !LOW; let k = 0, tries = 0; const R2 = rng(99);
      while (k < n && tries++ < n * 3) { const near = R2() < 0.55; const x = near ? (R2() - 0.5) * 110 : (R2() - 0.5) * W * 2, z = near ? (R2() - 0.5) * 90 : (R2() - 0.5) * H * 2;
        if (!walkable(x, z, 1) || pathD(x, z) < 2.4 || Math.hypot(x, z) < PLAZA_R + 1.2 || (Math.abs(x - STUDIO.x) < STUDIO.w / 2 + 3 && Math.abs(z - STUDIO.z) < STUDIO.d / 2 + 4) || Math.hypot(x - PLAY.x, z - PLAY.z) < 11 || Math.hypot(x - HUB.x, z - HUB.z) < HUB.r + 2.5) continue;
        const s = 0.7 + R2() * 0.9; _q.setFromAxisAngle(Y, R2() * 6.28); _m.compose(_p.set(x, ground(x, z) - 0.03, z), _q, _s.set(s, s * (0.8 + R2() * 0.6), s)); gr.setMatrixAt(k, _m); gr.setColorAt(k, _c.setHSL(0.25 + R2() * 0.05, 0.5, 0.2 + R2() * 0.12)); k++; }
      gr.count = k; gr.frustumCulled = false; scene.add(gr);
      const fn = LOW ? 400 : 1600; const fg = new THREE.IcosahedronGeometry(0.11, 0); fg.translate(0, 0.32, 0); const fl = new THREE.InstancedMesh(fg, std('#ffffff', { r: 0.6 }), fn); const stemG = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3); stemG.translate(0, 0.16, 0); const st = new THREE.InstancedMesh(stemG, std('#3d7a2c'), fn); const FC = ['#ff6fae', '#ffd447', '#ffffff', '#b26bff', '#ff8a4a', '#6fb7ff']; k = 0; tries = 0;
      while (k < fn && tries++ < fn * 5) { const x = (R2() - 0.5) * W * 2, z = (R2() - 0.5) * H * 2; if (!walkable(x, z, 1) || pathD(x, z) < 2.6 || Math.hypot(x, z) < PLAZA_R + 2 || Math.hypot(x - PLAY.x, z - PLAY.z) < 12 || (Math.abs(x - STUDIO.x) < 15 && Math.abs(z - STUDIO.z) < 12)) continue;
        // clumps: flowers like company
        const cx = x, cz = z, cnt = 3 + Math.floor(R2() * 5), col = FC[Math.floor(R2() * FC.length)];
        for (let j = 0; j < cnt && k < fn; j++, k++) { const fx = cx + (R2() - 0.5) * 1.6, fz = cz + (R2() - 0.5) * 1.6; _m.compose(_p.set(fx, ground(fx, fz), fz), _q.identity(), _s.setScalar(0.8 + R2() * 0.5)); fl.setMatrixAt(k, _m); st.setMatrixAt(k, _m); fl.setColorAt(k, _c.set(col)); } }
      fl.count = st.count = k; scene.add(fl, st); }

    // ---------------------------------------------------------------- benches, lamps (along the paths)
    const wood = std('#9a6b43', { r: 0.7 }), iron = std('#3b3550', { r: 0.4 }), stone = std('#cfc6b6', { r: 0.85 });
    const lampHeads = [];
    function bench(x, z, ry) { const g = new THREE.Group(); const y = ground(x, z);
      for (let i = 0; i < 3; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.14), wood); sl.position.set(0, 0.48, -0.18 + i * 0.18); g.add(sl); const bk = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.05), wood); bk.position.set(0, 0.68 + i * 0.16, -0.3); g.add(bk); }
      for (const sx of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), iron); l.position.set(sx, 0.25, -0.05); g.add(l); }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = !LOW; o.receiveShadow = true; } }); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g); addBox(x, z, 1.4, 1.4, y + 0.52); }
    function lamp(x, z) { const g = new THREE.Group(); const y = ground(x, z); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 3.4, 8), iron); p.position.y = 1.7; g.add(p);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), std('#fff6d8', { e: '#ffe7a8', ei: 0.6 })); h.position.y = 3.5; g.add(h); lampHeads.push(h); const c = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.25, 12), iron); c.position.y = 3.78; g.add(c);
      g.traverse((o) => { if (o.isMesh) o.castShadow = !LOW; }); g.position.set(x, y, z); scene.add(g); cyl.push({ x, z, r: 0.18, top: 99 }); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; lamp(Math.cos(a) * (PLAZA_R + 2.6), Math.sin(a) * (PLAZA_R + 2.6)); bench(Math.cos(a) * (PLAZA_R - 2), Math.sin(a) * (PLAZA_R - 2), -a - Math.PI / 2); }
    for (const d of [24, 40, 60, 80]) for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = sx * d, z = sz * d; if (Math.abs(z) > H - 8 || Math.abs(x) > W - 8) continue; if (!walkable(x, z, 4)) continue; lamp(x + (sz ? 2.6 : 0), z + (sx ? 2.6 : 0)); if (d % 40 === 0 && walkable(x - (sz ? 3.2 : 0), z - (sx ? 3.2 : 0), 4)) bench(x - (sz ? 3.4 : 0), z - (sx ? 3.4 : 0), sx ? 0 : Math.PI / 2); }

    // ---------------------------------------------------------------- fountain (plaza centre): basin, tiers, animated spray
    const fountain = new THREE.Group(); scene.add(fountain); const fy = 2.4; fountain.position.set(0, fy, 0);
    { const b = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.8, 40, 1, true), stone); b.position.y = 0.4; const rim = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.22, 10, 48), stone); rim.rotation.x = Math.PI / 2; rim.position.y = 0.82;
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2.2, 20), stone); t1.position.y = 1.1; const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.6, 0.45, 32), stone); bowl.position.y = 2.25; const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.2, 16), stone); t2.position.y = 2.9;
      const wd = new THREE.Mesh(new THREE.CircleGeometry(4.15, 40).rotateX(-Math.PI / 2), waterM); wd.position.y = 0.66;
      [b, rim, t1, bowl, t2].forEach((m) => { m.castShadow = !LOW; m.receiveShadow = true; fountain.add(m); }); fountain.add(wd); }
    const NSP = LOW ? 160 : 420; const spG = new THREE.BufferGeometry(); const spP = new Float32Array(NSP * 3), spV = []; for (let i = 0; i < NSP; i++) spV.push({ a: Math.random() * 6.28, life: Math.random() });
    spG.setAttribute('position', new THREE.BufferAttribute(spP, 3)); const spray = new THREE.Points(spG, new THREE.PointsMaterial({ color: '#e8f8ff', size: 0.12, transparent: true, opacity: 0.85, depthWrite: false })); spray.position.copy(fountain.position); spray.frustumCulled = false; scene.add(spray);
    cyl.push({ x: 0, z: 0, r: 4.5, top: fy + 0.85 }); cyl.push({ x: 0, z: 0, r: 0.9, top: 99 });

    // ---------------------------------------------------------------- Kemy Studio (purple, original design) with porch stairs you can climb
    { const g = new THREE.Group(); const y0 = 2.6; g.position.set(STUDIO.x, y0, STUDIO.z); scene.add(g);
      const purple = std('#7b3fe4', { r: 0.55 }), lilac = std('#c9a8ff', { r: 0.6 }), glass = new THREE.MeshStandardMaterial({ color: '#2a1b55', emissive: '#6f5bff', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.4 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(STUDIO.w, STUDIO.h, STUDIO.d), purple); body.position.y = STUDIO.h / 2 + 1.2; g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(STUDIO.w + 1.2, 0.6, STUDIO.d + 1.2), lilac); roof.position.y = STUDIO.h + 1.5; g.add(roof);
      const base = new THREE.Mesh(new THREE.BoxGeometry(STUDIO.w + 2, 1.2, STUDIO.d + 6), stone); base.position.set(0, 0.6, 2); g.add(base);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) { if (r === 0 && c === 2) continue; const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.1), glass); w.position.set(-8 + c * 4, 4.2 + r * 4, STUDIO.d / 2 + 0.03); g.add(w); }
      const door = new THREE.Mesh(new THREE.BoxGeometry(3, 3.6, 0.12), std('#ffd447', { r: 0.4 })); door.position.set(0, 3, STUDIO.d / 2 + 0.05); g.add(door);
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const x = sc.getContext('2d'); x.fillStyle = '#fff'; x.font = '900 78px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('KEMY STUDIO', 256, 66);
      const sgT = new THREE.CanvasTexture(sc); sgT.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: sgT, transparent: true })); sign.position.set(0, STUDIO.h - 0.6, STUDIO.d / 2 + 0.08); g.add(sign);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), std('#ffd447', { e: '#ffb800', ei: 0.5 })); star.position.set(0, STUDIO.h + 3, 0); g.add(star); g.userData.star = star;
      // porch steps (stairs: each step is a box you can step up)
      for (let i = 0; i < 4; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3 * (i + 1), 0.7), stone); st.position.set(0, 0.15 * (i + 1), STUDIO.d / 2 + 5 + 0.35 + (3 - i) * 0.7); g.add(st); }
      g.traverse((o) => { if (o.isMesh) { o.castShadow = !LOW; o.receiveShadow = true; } }); window.__p3star = star;
      addBox(STUDIO.x, STUDIO.z, STUDIO.w, STUDIO.d, 99);                                           // walls
      addBox(STUDIO.x, STUDIO.z + 2, STUDIO.w + 2, STUDIO.d + 6, y0 + 1.2);                      // porch top
      for (let i = 0; i < 4; i++) addBox(STUDIO.x, STUDIO.z + STUDIO.d / 2 + 5 + 0.35 + (3 - i) * 0.7, 6, 0.7, y0 + 0.3 * (i + 1)); }

    // ---------------------------------------------------------------- playground: tower with stairs, slide, swings, see-saw
    { const g = new THREE.Group(); const y0 = 2.2; g.position.set(PLAY.x, y0, PLAY.z); scene.add(g);
      const red = std('#ff5a6e', { r: 0.5 }), blue = std('#4f8dff', { r: 0.5 }), yel = std('#ffd447', { r: 0.5 }), mulch = std('#b7835a', { r: 1 });
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.12, 40), mulch); pad.position.y = 0.06; pad.receiveShadow = true; g.add(pad);
      const TH = 2.4; const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 3), yel); deck.position.y = TH; g.add(deck);
      for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, TH + 1.6, 10), blue); p.position.set(sx, (TH + 1.6) / 2, sz); g.add(p); }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.4, 4), red); roof.position.y = TH + 2.3; roof.rotation.y = Math.PI / 4; g.add(roof);
      const NS = 8; for (let i = 0; i < NS; i++) { const h = TH * (i + 1) / NS; const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.6), yel); s.position.set(-1.5 - 0.5 * (NS - i) + 0.25, h - 0.09, 0); g.add(s); addBox(PLAY.x - 1.5 - 0.5 * (NS - i) + 0.25, PLAY.z, 0.5, 1.6, y0 + h); }
      addBox(PLAY.x, PLAY.z, 3, 3, y0 + TH + 0.12);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.12, 1.2), red); sl.position.set(3.55, TH / 2 + 0.06, 0); sl.rotation.z = -Math.atan2(TH, 4.1); g.add(sl); for (const sz of [-0.62, 0.62]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(4.75, 0.25, 0.06), red); rail.position.set(3.55, TH / 2 + 0.2, sz); rail.rotation.z = sl.rotation.z; g.add(rail); }
      for (let i = 0; i < 6; i++) addBox(PLAY.x + 1.9 + i * 0.62, PLAY.z, 0.62, 1.2, y0 + TH - (i + 0.5) * TH / 6);  // the slide surface (slope)
      const swings = new THREE.Group(); swings.position.set(-2, 0, -7); g.add(swings); const fr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 8), blue); fr.rotation.z = Math.PI / 2; fr.position.y = 3; swings.add(fr);
      for (const sx of [-2.4, 2.4]) for (const sz of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.3, 8), blue); l.position.set(sx, 1.5, sz * 0.6); l.rotation.x = sz > 0 ? -0.35 : 0.35; swings.add(l); }
      const seats = []; for (const sx of [-1, 1]) { const sw = new THREE.Group(); sw.position.set(sx, 3, 0); const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.4, 4), iron); r1.position.y = -1.2; const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.35), red); seat.position.y = -2.4; sw.add(r1, seat); swings.add(sw); seats.push(sw); } g.userData.seats = seats;
      cyl.push({ x: PLAY.x - 4.4, z: PLAY.z - 7, r: 0.25, top: 99 }, { x: PLAY.x + 0.4, z: PLAY.z - 7, r: 0.25, top: 99 });
      const ss = new THREE.Group(); ss.position.set(4, 0, 6); g.add(ss); const piv = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.6, 12), blue); piv.position.y = 0.3; const plank = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 0.45), yel); plank.position.y = 0.65; ss.add(piv, plank); g.userData.plank = plank;
      g.traverse((o) => { if (o.isMesh) { o.castShadow = !LOW; o.receiveShadow = true; } }); window.__p3play = g; }

    // ---------------------------------------------------------------- game portals + treasures
    // Game Hub: an arc of booths with glowing portals (js/pals/park-games.js; other mini-games plug in there)
    const portals = [];
    { const g = new THREE.Group(); scene.add(g); const hy = ground(HUB.x, HUB.z);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(HUB.r + 2.5, HUB.r + 2.5, 0.14, 48), std('#e9ddff', { r: 0.7 })); pad.position.set(HUB.x, hy + 0.05, HUB.z); pad.receiveShadow = true; g.add(pad);
      const sc = document.createElement('canvas'); sc.width = 512; sc.height = 128; const x = sc.getContext('2d'); x.fillStyle = '#7c3aed'; x.beginPath(); x.roundRect(8, 8, 496, 112, 40); x.fill(); x.fillStyle = '#fff'; x.font = '900 64px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🎮 GAME HUB', 256, 68);
      const tex = new THREE.CanvasTexture(sc); tex.colorSpace = THREE.SRGBColorSpace; const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })); sign.position.set(HUB.x, hy + 4.4, HUB.z - HUB.r - 0.5); g.add(sign);
      for (const sx of [-2.8, 2.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 8), iron); p.position.set(HUB.x + sx, hy + 2.2, HUB.z - HUB.r - 0.55); g.add(p); cyl.push({ x: HUB.x + sx, z: HUB.z - HUB.r - 0.55, r: 0.15, top: 99 }); }
      const games = [...MINIGAMES.filter((g) => !g.href).map((g) => ({ id: g.id, name: g.name.replace(/^Pal /, ''), emoji: g.emoji, color: g.color || '#b26bff', href: '#/arcade/' + g.id })), ...parkGames()].slice(0, 8); const N = Math.max(games.length, 6);
      for (let i = 0; i < N; i++) { const gm = games[i]; const a = Math.PI * (0.15 + 0.7 * (i / (N - 1))); const bx = HUB.x + Math.cos(a) * HUB.r, bz = HUB.z + Math.sin(a) * HUB.r; const face = Math.atan2(HUB.x - bx, HUB.z - bz);
        const booth = new THREE.Group(); booth.position.set(bx, hy, bz); booth.rotation.y = face; g.add(booth); const col = gm ? gm.color : '#9ca3af';
        const arch = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.18, 12, 40, Math.PI), std(col, { r: 0.4 })); arch.position.y = 2.1; booth.add(arch);
        for (const sx of [-1.35, 1.35]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.1, 12), std(col, { r: 0.4 })); l.position.set(sx, 1.05, 0); booth.add(l); }
        const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 40), new THREE.MeshBasicMaterial({ color: gm ? col : '#d1d5db', transparent: true, opacity: gm ? 0.55 : 0.25, side: THREE.DoubleSide })); disc.position.y = 1.7; booth.add(disc);
        const c2 = document.createElement('canvas'); c2.width = 256; c2.height = 96; const y2 = c2.getContext('2d'); y2.fillStyle = 'rgba(30,16,60,.85)'; y2.beginPath(); y2.roundRect(4, 4, 248, 88, 24); y2.fill(); y2.fillStyle = '#fff'; y2.font = '800 34px Inter, Arial, sans-serif'; y2.textAlign = 'center'; y2.textBaseline = 'middle'; y2.fillText(gm ? `${gm.emoji} ${gm.name}` : '✨ Coming soon', 128, 50);
        const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace; const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.98), new THREE.MeshBasicMaterial({ map: t2, transparent: true, side: THREE.DoubleSide })); lab.position.y = 3.9; booth.add(lab);
        booth.traverse((o) => { if (o.isMesh && o !== disc && o !== lab) o.castShadow = !LOW; }); for (const sx of [-1.35, 1.35]) cyl.push({ x: bx + Math.cos(face) * sx, z: bz - Math.sin(face) * sx, r: 0.25, top: 99 });
        if (gm) portals.push({ ...gm, x: bx, z: bz, r: disc, disc }); } }
    const tk = 'kemy-park-found-' + S.user.uid + '-' + Math.floor(Date.now() / 86400000); const found = new Set(JSON.parse(lsg(tk) || '[]'));
    const gemG = new THREE.OctahedronGeometry(0.35, 0), gemM = { pearl: '#f4f0ff', flower: '#ff6fae', candy: '#ffd447', shell: '#ffb38a' };
    const items = treasures().map((it) => { let [x, z] = toW(it.x, it.y); x *= 1.0; z *= 1.0; for (let n = 0; n < 12 && !freeSpotLoose(x, z); n++) { x *= 0.85; z *= 0.85; } const m = new THREE.Mesh(gemG, std(gemM[it.k] || '#fff', { e: gemM[it.k], ei: 0.5, r: 0.2 })); m.position.set(x, ground(x, z) + 1, z); m.visible = !found.has(it.id); scene.add(m); return { ...it, x, z, m }; });
    function freeSpotLoose(x, z) { return walkable(x, z, 2) && !box.some((b) => x > b.x0 - 1 && x < b.x1 + 1 && z > b.z0 - 1 && z < b.z1 + 1) && !cyl.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.8); }
    const foundEl = $('#park-found'); const paintFound = () => { foundEl.textContent = `✨ ${found.size}/${items.length}`; }; paintFound();

    // ---------------------------------------------------------------- my Pal
    const pal = await getActivePal(db, S.user.uid).catch(() => null);
    if (!document.body.contains(cv)) { R.dispose(); return; }
    const palSnap = pal ? { species: pal.species, name: pal.name, colors: pal.colors || {}, pattern: pal.pattern || '', acc: pal.acc || '', outfit: pal.outfit || {}, level: pal.level || 1, variant: pal.variant || '' } : { species: 'kemy', name: 'Kemy', level: 1, outfit: {} };
    const HEIGHT = 1.45;
    function palObj(ps, shadow) { const m = makePal3D(ps); const holder = new THREE.Group(); holder.add(m);
      const bb = new THREE.Box3().setFromObject(m); const h = Math.max(0.5, bb.max.y - bb.min.y); const k = HEIGHT / h * 1.0; m.scale.multiplyScalar(k); m.position.y = -bb.min.y * k;
      m.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.frustumCulled = false; } }); holder.userData = { m, eye: (bb.max.y - bb.min.y) * k * 0.82 }; return holder; }
    const me = palObj(palSnap, !LOW); scene.add(me);
    const J = me.userData.m.userData.J; const D2R = Math.PI / 180; const bodyParts = [], armParts = new Set(); me.traverse((o) => { if (o.isMesh) bodyParts.push(o); }); for (const n of ['LeftUpperArm', 'RightUpperArm']) J[n].traverse((o) => armParts.add(o));
    // eye height per species: the head bone's world height in rest pose
    { me.updateMatrixWorld(true); const hp = new THREE.Vector3(); J.Head.getWorldPosition(hp); me.userData.eye = Math.max(0.5, hp.y + 0.12); }
    // spawn near the plaza
    const P = { x: (Math.random() - 0.5) * 6, z: PLAZA_R + 4 + Math.random() * 3, y: 0, vy: 0, yaw: Math.PI, onGround: true, t: 0, run: false, dance: '', danceUntil: 0, e: '', eAt: 0, say: '', sayAt: 0, tgt: '', d: 1 };
    P.y = ground(P.x, P.z);

    // ---------------------------------------------------------------- physics-lite
    const RAD = 0.42, STEP = 0.55, GRAV = 26, JUMP = 9.2, WALK_W = 1.7, RUN_V = 3.6;
    // gait matching (js/pals/motion3d.js): ground speed -> gait speed (walk 1, run 2.3) + cadence so the feet don't skate
    // ground speed -> gait (js/pals/motion3d.js): walk speed ~1, run ~2.3, longer stride (walk x1.7, run x1.5) and cadence matched exactly so feet stay planted
    const STRIDE = 1.7; const gaitFor = (obj, v, run) => { const sc = obj.userData.m.scale.x, L = obj.userData.m.userData.J.legL || 0.54; const v1 = WALK_V * 60 * sc * (L / 0.54); if (v < 0.15) return { speed: 0, cadence: 1, stride: 1 };
      const speed = run ? 2.3 : Math.max(0.6, Math.min(1, v / (v1 * STRIDE * 3))); const stride = run ? 1.5 : STRIDE; return { speed, stride, cadence: Math.max(0.6, Math.min(3.6, v / (v1 * speed * stride))) }; };
    function floorAt(x, z, feet) { let f = ground(x, z); for (const b of box) if (x > b.x0 - RAD * 0.5 && x < b.x1 + RAD * 0.5 && z > b.z0 - RAD * 0.5 && z < b.z1 + RAD * 0.5 && b.top < 50 && b.top <= feet + STEP && b.top > f) f = b.top;
      for (const c of cyl) if (c.top < 50 && Math.hypot(c.x - x, c.z - z) < c.r && c.top <= feet + STEP && c.top > f) f = c.top; return f; }
    function collide(x, z, feet) { // push out of anything taller than a step
      for (const c of cyl) { if (c.top <= feet + STEP) continue; const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + RAD; if (d < m && d > 1e-4) { x = c.x + dx / d * m; z = c.z + dz / d * m; } }
      for (const b of box) { if (b.top <= feet + STEP) continue; if (x > b.x0 - RAD && x < b.x1 + RAD && z > b.z0 - RAD && z < b.z1 + RAD) { const pl = x - (b.x0 - RAD), pr = (b.x1 + RAD) - x, pb = z - (b.z0 - RAD), pf = (b.z1 + RAD) - z; const mn = Math.min(pl, pr, pb, pf); if (mn === pl) x = b.x0 - RAD; else if (mn === pr) x = b.x1 + RAD; else if (mn === pb) z = b.z0 - RAD; else z = b.z1 + RAD; } }
      for (const e of [POND, LAKE]) if (inEll(e, x, z, -1.5)) { const d = ellD(e, x, z) || 1e-3; const k = (1 - 1.5 / Math.min(e.rx, e.rz)) / d; x = e.x + (x - e.x) * k * 1.001; z = e.z + (z - e.z) * k * 1.001; }
      x = Math.max(-W + 3, Math.min(W - 3, x)); z = Math.max(-H + 3, Math.min(H - 3, z)); return [x, z]; }

    // ---------------------------------------------------------------- camera (3rd person orbit with anti-clip, or POV)
    const CK = 'kemy-park-cam-' + S.user.uid; let pov = lsg(CK) === 'pov';
    const C = { yaw: Math.PI, pitch: 0.32, dist: 7.5, cur: 7.5, look: 0 };
    const toggleCam = () => { pov = !pov; lss(CK, pov ? 'pov' : 'tp'); paintCam(); hint(pov ? 'First-person: you are your Pal 👀' : 'Third-person camera'); };
    const paintCam = () => { const b = tc && tc.root.querySelector('[data-b=cam]'); if (!b) return; b.setAttribute('aria-pressed', pov); b.classList.toggle('lock', pov); b.setAttribute('aria-label', pov ? 'Camera: first-person. Tap for third-person' : 'Camera: third-person. Tap for first-person'); };
    let tc = null;
    function camBlocked(x, y, z) { if (y < ground(x, z) + 0.25) return true; for (const b of box) if (b.top > 50 && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true; else if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.top) return true;
      for (const c of cyl) if (Math.hypot(c.x - x, c.z - z) < c.r + 0.15 && y < Math.min(c.top, 7)) return true; return false; }
    const tgt = new THREE.Vector3();
    function updateCam(dt) {
      if (pov) { // eye camera: a little behind the (hidden) head so both arms + paws sit in the lower part of the view
        me.updateMatrixWorld(true); const hp = new THREE.Vector3(); J.Head.getWorldPosition(hp); const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
        cam.position.set(hp.x - fx * 0.38, hp.y + 0.12, hp.z - fz * 0.38); const pitch = C.pitch - 0.17;
        cam.lookAt(cam.position.x + fx * Math.cos(pitch), cam.position.y - Math.sin(pitch), cam.position.z + fz * Math.cos(pitch)); if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); } return; }
      if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
      tgt.set(P.x, P.y + 1.2, P.z);
      const dir = new THREE.Vector3(Math.sin(C.yaw) * Math.cos(C.pitch), Math.sin(C.pitch), Math.cos(C.yaw) * Math.cos(C.pitch));
      let d = C.dist; for (let i = 1; i <= 28; i++) { const s = (i / 28) * C.dist; if (camBlocked(tgt.x + dir.x * s, tgt.y + dir.y * s, tgt.z + dir.z * s)) { d = Math.max(0.3, s - 0.3); break; } }
      C.cur += (d - C.cur) * Math.min(1, (d < C.cur ? 18 : 4) * dt);
      cam.position.copy(tgt).addScaledVector(dir, C.cur); cam.lookAt(tgt); }

    // ---------------------------------------------------------------- input: joystick, buttons, keys, drag-orbit, pinch, wheel
    const keys = {}; const typing = () => /input|textarea/i.test(document.activeElement && document.activeElement.tagName);
    const kd = (e) => { if (typing()) return; const k = e.key.toLowerCase(); keys[k] = true; if (k === 'enter') { $('#p3-t').focus(); e.preventDefault(); } };
    const ku = (e) => { keys[e.key.toLowerCase()] = false; }; addEventListener('keydown', kd); addEventListener('keyup', ku);
    let jumpQ = false;
    let runT = false;
    tc = createControls(view, { tutorialKey: 'park', tutorialTitle: '🌳 Welcome to Pal Park!', keys: { ' ': 'jump', v: 'cam', e: 'emote' },
      tips: ['🕹️ Put your thumb down anywhere on the left and slide to walk. Slide all the way to run.', '👆 Drag on the right to look around. Pinch to zoom.', '⤒ Big button = jump. 🏃 = run on/off.', '😊 Emote or dance (with music on, everyone dances to the beat!)', '👁 Switch between behind-your-Pal and through-your-Pal’s eyes.', '💬 Type in the chat bar to talk. Be kind!'],
      buttons: [{ id: 'jump', icon: '⤒', label: 'Jump', big: true }, { id: 'run', icon: '🏃', label: 'Run' }, { id: 'emote', icon: '😊', label: 'Emote' }, { id: 'cam', icon: '👁', label: 'Camera' }] });
    tc.on('jump', () => { jumpQ = true; }); tc.on('run', () => { runT = !runT; tc.root.querySelector('[data-b=run]')?.classList.toggle('lock', runT); hint(runT ? 'Running 🏃' : 'Walking'); });
    tc.on('emote', () => openEmotes()); tc.on('cam', () => toggleCam());
    paintCam(); setTimeout(() => tc.tutorial(), 600); $('#p3-set').onclick = () => tc.settings();
    { // tap a Pal + two-finger pinch zoom on the look side (the shared controls handle the drag-to-look)
      const rz = tc.root.querySelector('.kc-r'); const pts = new Map(); let p0 = 0, ts = null;
      rz.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; p0 = Math.hypot(a[0] - b[0], a[1] - b[1]); } ts = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
      rz.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && p0) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); C.dist = Math.max(2.5, Math.min(16, C.dist * p0 / d)); p0 = d; tc.takeLook(); } });
      const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) p0 = 0; if (ts && e.type === 'pointerup' && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 10 && performance.now() - ts.t < 350) tap(e); ts = null; };
      rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
      tc.root.addEventListener('wheel', (e) => { e.preventDefault(); C.dist = Math.max(2.5, Math.min(16, C.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false }); }
    const jv = { x: 0, y: 0, test: false };
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function tap(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      const objs = [...others.values()].filter((o) => o.obj && o.obj.visible).map((o) => o.obj); if (!pov) objs.push(me);
      const hit = ray.intersectObjects(objs, true)[0]; if (!hit) return; let o = hit.object; while (o.parent && !o.userData.uid && o !== me) o = o.parent;
      if (o === me) { emote(['🎉', '💜', '⭐', '😂'][Math.floor(Math.random() * 4)]); return; } const other = others.get(o.userData.uid); if (other) playerCard(other); }

    // ---------------------------------------------------------------- multiplayer presence (Firestore)
    let room = 'r1';
    for (let i = 1; i <= ROOMS; i++) { try { const s = await getDocs(query(collection(db, 'parkRooms', 'r' + i, 'p'), where('at', '>', Timestamp.fromMillis(Date.now() - STALE_MS)))); const n = s.docs.filter((d) => d.id !== S.user.uid).length; if (n < MAX_ROOM) { room = 'r' + i; break; } } catch { break; } }
    if (!document.body.contains(cv)) { R.dispose(); return; }
    $('#park-room').textContent = `Room ${room.slice(1)}`;
    const meRef = doc(db, 'parkRooms', room, 'p', S.user.uid); let extras = true;
    const base = () => { const [x, y] = toP(P.x, P.z); const o = { x: Math.max(0, Math.min(4000, x)), y: Math.max(0, Math.min(4000, y)), d: P.d, e: P.e, eAt: P.eAt, say: P.say, sayAt: P.sayAt, tgt: P.tgt, name: S.profile.displayName, uname: S.profile.username, color: S.profile.color || '#8a2be2', pal: palSnap, at: serverTimestamp() };
      if (extras) { o.h = Math.max(0, Math.min(2000, Math.round(P.y * 10))); o.r = ((Math.round(P.yaw * 180 / Math.PI) % 360) + 360) % 360; o.dn = P.dance && Date.now() < P.danceUntil ? P.dance : ''; o.v = 3; } return o; };
    let lastSend = 0, dirty = true, sending = false; const net = { ok: 0, err: '', snaps: 0, snapErr: '' };
    const send = async (force) => { const now = Date.now(); if (sending || (!force && (!dirty || now - lastSend < SEND_MS) && now - lastSend < HB_MS)) return; sending = true; lastSend = now; dirty = false;
      try { await setDoc(meRef, base()); net.ok++; } catch (e) { net.err = e.code || String(e); net.fails = (net.fails || 0) + 1; try { const q = base(); delete q.at; net.last = JSON.stringify(q).slice(0, 600); } catch { /* */ } if (e.code === 'permission-denied') { if (extras) { extras = false; dirty = true; lastSend = 0; } else lastSend = now + 300; } } sending = false; };
    await send(true);
    const others = new Map(); const blocked = S.blocked || new Set(); const MK = 'kemy-park-muted-' + S.user.uid; const muted = new Set(JSON.parse(lsg(MK) || '[]'));
    const unsub = onSnapshot(collection(db, 'parkRooms', room, 'p'), (qs) => {
      const now = Date.now(); net.snaps++;
      qs.docChanges().forEach((ch) => { const id = ch.doc.id; if (id === S.user.uid) return; if (ch.type === 'removed') { drop(id); return; }
        const d = ch.doc.data(); const at = d.at && d.at.toMillis ? d.at.toMillis() : now;
        if (now - at > 120000) { deleteDoc(ch.doc.ref).catch(() => {}); return; }
        const [x, z] = toW(d.x, d.y); let o = others.get(id);
        if (!o) { o = { uid: id, x, z, y: ground(x, z), yaw: 0, seenS: d.sayAt || 0, seenE: d.eAt || 0, t: Math.random() * 100 }; others.set(id, o); }
        Object.assign(o, { tx: x, tz: z, th: typeof d.h === 'number' ? d.h / 10 : null, tr: typeof d.r === 'number' ? d.r * Math.PI / 180 : null, dn: d.dn || '', name: d.name, uname: d.uname, color: d.color, pal: d.pal, at, e: d.e, eAt: d.eAt, say: d.say, sayAt: d.sayAt, tgt: d.tgt });
        if (d.sayAt && d.sayAt > o.seenS && d.say) { o.seenS = d.sayAt; if (!muted.has(id) && !blocked.has(id)) logMsg(d.name, clean(d.say), d.color); }
        if (d.eAt && d.eAt > o.seenE) { o.seenE = d.eAt; if (d.e && EMO_DANCE[d.e]) { o.dance = EMO_DANCE[d.e]; o.danceUntil = performance.now() + 6000; } if (d.tgt === S.user.uid && d.e === '🐾') toast(`@${d.uname} petted your Pal! 💜`); } });
    }, (e) => { net.snapErr = e.code || String(e); });
    function drop(id) { const o = others.get(id); if (!o) return; if (o.obj) { scene.remove(o.obj); } o.tag?.remove(); others.delete(id); }

    // ---------------------------------------------------------------- name tags + speech bubbles (HTML overlay, crisp on phones)
    const tags = $('#p3-tags');
    function tagFor(o, mine) { if (o.tag) return o.tag; const el = document.createElement('div'); el.className = 'p3-tag' + (mine ? ' me' : ''); el.innerHTML = `<div class="p3-bub" hidden></div><span></span>`; el.querySelector('span').textContent = mine ? 'You · ' + (palSnap.name || 'Pal') : `${o.name || ''}`; { const mb = (window.kemyModBadge ? window.kemyModBadge(mine ? (S.user && S.user.uid) : o.uid) : ''); if (mb) el.querySelector('span').insertAdjacentHTML('beforeend', mb); } tags.appendChild(el); o.tag = el; return el; }
    const meTag = { }; tagFor(meTag, true);
    const v3 = new THREE.Vector3();
    function placeTag(o, x, y, z, say, sayAt, hide) { const el = o.tag; v3.set(x, y, z).project(cam); const vis = !hide && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; el.style.display = vis ? '' : 'none'; if (!vis) return;
      const w = view.clientWidth, h = view.clientHeight; el.style.transform = `translate(${((v3.x + 1) / 2 * w).toFixed(1)}px,${((1 - v3.y) / 2 * h).toFixed(1)}px) translate(-50%,-100%)`;
      const b = el.firstChild; const show = say && Date.now() - sayAt < 7000; if (show) { if (b.dataset.s !== String(sayAt)) { b.dataset.s = String(sayAt); b.textContent = say; const mb = (window.kemyModBadge ? window.kemyModBadge(o === meTag ? (S.user && S.user.uid) : o.uid) : ''); if (mb) b.insertAdjacentHTML('afterbegin', mb + ' '); } b.hidden = false; } else b.hidden = true; }
    // chat log
    const log = $('#p3-log'); function logMsg(name, text, color) { const d = document.createElement('div'); d.className = 'p3-msg'; const b = document.createElement('b'); b.textContent = (name || 'Someone') + ': '; b.style.color = color || '#d9c2ff'; d.append(b, document.createTextNode(text)); log.appendChild(d); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight; log.classList.add('fresh'); clearTimeout(log._t); log._t = setTimeout(() => log.classList.remove('fresh'), 8000); }
    log.addEventListener('click', () => log.classList.toggle('open'));
    // chat input
    let lastSay = 0, burst = [];
    function say(t) { const now = Date.now(); burst = burst.filter((x) => now - x < 30000); if (now - lastSay < 2500 || burst.length >= 6) { toast('Slow down a little 🙂'); return false; } lastSay = now; burst.push(now); P.say = clean(t).slice(0, 60); P.sayAt = now; dirty = true; send(true); logMsg(S.profile.displayName + ' (you)', P.say, S.profile.color); return true; }
    $('#p3-chat').onsubmit = (e) => { e.preventDefault(); const inp = $('#p3-t'); const v = inp.value.trim(); if (!v) { inp.blur(); return; } if (checkInput(v)) { toast('Let’s keep Pal Park friendly and private 💜'); return; } if (say(v)) { inp.value = ''; inp.blur(); } };
    const panel = $('#park-panel'); const toggle = (k) => { const open = panel.hidden || panel.dataset.k !== k; panel.hidden = !open; panel.dataset.k = k; return open; };
    // quick chat: tabbed tap-to-say phrases (greetings, teamwork, GG, compliments, park, emoji); the text bar stays too
    $('#p3-quick').onclick = () => { if (!toggle('c')) return; renderQuickChat(panel, (x) => { if (say(x)) panel.hidden = true; }); };
    // emote wheel: 8 favourite slots (player picks), the classic emoji reactions underneath, shop shortcut
    loadOwnedEmotes(db, S.user.uid);
    function openEmotes() { panel.hidden = true; loadOwnedEmotes(db, S.user.uid).then(() => openWheel({ onEmote: emoteDance, reactions: EMOTES, onReact: (x) => emote(x), onShop: () => dispatchEvent(new Event('kemy:dance-shop')), onLocked: (d) => { toast(`🔒 ${d.name} is in the Dance Shop`); dispatchEvent(new Event('kemy:dance-shop')); } })); }
    // a wheel emote/dance: synced to everyone through the existing dance-name field (dn), cleared when it ends
    function emoteDance(id) { const d = EMOTE_BY_ID[id]; P.dance = id; P.danceUntil = Date.now() + emoteMs(id); P.tgt = ''; dirty = true; send(true); hint(`${(d && d.icon) || '💃'} ${(d && d.name) || 'Dance!'}`); }
    panel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) { emote(b.dataset.e); panel.hidden = true; } if (b.dataset.say) { say(b.dataset.say); panel.hidden = true; } });
    function emote(x, tgt = '') { P.e = x; P.eAt = Date.now(); P.tgt = tgt; if (EMO_DANCE[x]) { P.dance = EMO_DANCE[x]; P.danceUntil = Date.now() + 6000; } dirty = true; send(true); }
    function playerCard(o) {
      const isM = muted.has(o.uid);
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="park-card"><h2>${esc(o.name)}</h2><p class="muted">@${esc(o.uname)} · with ${esc((o.pal && o.pal.name) || 'their Pal')}</p>
        <div class="btns"><a class="btn btn-sm" href="#/u/${esc(o.uname)}" data-close>View profile</a><button class="btn btn-sm btn-ghost" id="pc-pet">🐾 Pet their Pal</button><button class="btn btn-sm btn-ghost" id="pc-mute">${isM ? '🔈 Unmute' : '🔇 Mute chat'}</button><button class="btn btn-sm btn-ghost" id="pc-rep">Report</button><button class="btn btn-sm btn-ghost" id="pc-block">Block</button></div></div>`);
      document.getElementById('pc-pet').onclick = () => { closeModal(); emote('🐾', o.uid); toast(`You petted ${(o.pal && o.pal.name) || 'their Pal'}! 💜`); };
      document.getElementById('pc-mute').onclick = () => { if (isM) muted.delete(o.uid); else muted.add(o.uid); lss(MK, JSON.stringify([...muted])); closeModal(); toast(isM ? `Unmuted @${o.uname}` : `Muted @${o.uname}. You won’t see their chat.`); };
      document.getElementById('pc-rep').onclick = () => { closeModal(); report(o); };
      document.getElementById('pc-block').onclick = async () => { if (!confirm(`Block @${o.uname}? You won’t see them in Pal Park.`)) return; try { await setDoc(doc(db, 'users', S.user.uid, 'blocks', o.uid), { createdAt: serverTimestamp() }); blocked.add(o.uid); drop(o.uid); closeModal(); toast(`Blocked @${o.uname}`); } catch (er) { toast(friendlyError(er)); } }; }
    function report(o) {
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><form class="park-card" id="pr-f"><h2>Report @${esc(o.uname)}</h2><select id="pr-r"><option>Mean or rude chat</option><option>Inappropriate name or Pal</option><option>Spam</option><option>Something else</option></select><textarea id="pr-t" maxlength="300" placeholder="What happened? (optional)"></textarea><button class="btn">Send report</button></form>`);
      document.getElementById('pr-f').onsubmit = async (e) => { e.preventDefault(); try { await addDoc(collection(db, 'reports'), { reporterId: S.user.uid, targetType: 'user', targetId: o.uid, postId: '', reason: ('Pal Park: ' + document.getElementById('pr-r').value + '. ' + document.getElementById('pr-t').value).slice(0, 500), excerpt: String(o.say || '').slice(0, 300), createdAt: serverTimestamp() }); closeModal(); toast('Thanks. The report was sent.'); } catch (er) { toast(friendlyError(er)); } }; }
    const hintEl = $('#p3-hint'); function hint(t) { hintEl.textContent = t; hintEl.classList.add('on'); clearTimeout(hintEl._t); hintEl._t = setTimeout(() => hintEl.classList.remove('on'), 2200); }

    // ---------------------------------------------------------------- music: the theme playlist, softly, looping (🎵 player stays available)
    let gm = null; import('../gamemusic.js').then(async (m) => { gm = m; await m.mountGameMusic({ corner: 'top-right' }); if (!m.isPlaying() && document.body.contains(cv)) m.playStation('theme', { volume: 0.18 }); }).catch(() => {});
    const beatNow = () => { const a = gm && gm.audioEl && gm.audioEl(); if (a && !a.paused) return { on: true, beat: a.currentTime * BPM / 60 }; return { on: false, beat: performance.now() / 1000 * BPM / 60 }; };

    // ---------------------------------------------------------------- main loop
    let alive = true, last = performance.now(), frames = 0, fpsT = last, fps = 0, slow = 0, lodT = 0, portalCd = 0; lodTrees(P.x, P.z);
    const fpsEl = $('#p3-fps'); const showFps = lsg('kemy-pals-debug') === '1' || /fps/.test(location.hash + location.search); if (!showFps) fpsEl.hidden = true;
    $('#p3-load').remove(); hint('Drag to look around · 👁 switches camera');
    const others3D = () => [...others.values()];
    function frame(now) {
      if (!alive) return; if (!document.body.contains(cv)) { cleanup(); return; }
      requestAnimationFrame(frame); if (lost || document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; frames++; window.__p3.frame++; const c0 = performance.now();
      if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; fpsEl.textContent = fps.toFixed(0) + ' fps'; window.__p3.fps = fps;
        if (fps < 26 && now > 8000) { if (++slow >= 4 && dprK > 0.6) { dprK = Math.max(0.6, dprK - 0.15); size(); slow = 0; } } else slow = Math.max(0, slow - 1); }
      // input -> move relative to the camera
      const mv = jv.test ? { x: jv.x, y: jv.y, run: false } : tc.move; let ix = mv.x, iz = mv.y; const lk = tc.takeLook(); if (lk.dx || lk.dy) { C.yaw -= lk.dx * 0.008; C.pitch = Math.max(pov ? -0.6 : -0.15, Math.min(pov ? 1.2 : 1.25, C.pitch + lk.dy * 0.006)); }
      const im = Math.min(1, Math.hypot(ix, iz)); const running = runT || mv.run || keys.shift; const sp = (running ? RUN_V : WALK_W) * im;
      if (im > 0.08) { const a = Math.atan2(ix, iz) + C.yaw - Math.PI; const want = Math.atan2(-Math.sin(a), -Math.cos(a)); const mx = Math.sin(want), mz = Math.cos(want);
        let nx = P.x + mx * sp * dt, nz = P.z + mz * sp * dt; [nx, nz] = collide(nx, nz, P.y); P.x = nx; P.z = nz;
        if (!pov) { let dy = want - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, 12 * dt); } else P.yaw = C.yaw + Math.PI; P.d = mx >= 0 ? 1 : -1; dirty = true; P.danceUntil = 0; }
      else if (pov) P.yaw = C.yaw + Math.PI;
      // gravity, ground, stairs and slopes
      const fl = floorAt(P.x, P.z, P.y);
      if (jumpQ && P.onGround) { P.vy = JUMP; P.onGround = false; dirty = true; } jumpQ = false;
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= fl) { if (!P.onGround && P.vy < -2) dirty = true; P.y = fl; P.vy = 0; P.onGround = true; } else if (P.onGround && P.y - fl < 0.35 && P.vy <= 0) { P.y = fl; P.vy = 0; } else P.onGround = false;
      if (!P.onGround && P.y > fl + 0.35) P.onGround = false;
      if (!P.onGround) dirty = true; // stream the jump arc (send() still caps it at ~4/s)
      if (P.danceUntil && Date.now() > P.danceUntil && P.dance) { P.dance = ''; dirty = true; } // tell others the dance ended
      me.position.set(P.x, P.y, P.z); me.rotation.y = P.yaw;
      // animation on the rig
      const bt = beatNow(); const dancing = P.dance && Date.now() < P.danceUntil;
      P.t += dt * 60; const dt60 = dt * 60; const gv = sp; P.turnS = (P.turnS || 0) * 0.85 + (P.lastYaw != null ? Math.atan2(Math.sin(P.yaw - P.lastYaw), Math.cos(P.yaw - P.lastYaw)) / Math.max(dt, 1e-3) * 0.15 * 0.15 : 0); P.lastYaw = P.yaw;
      let mode = 'idle'; const st = { t: P.t, dt60, turn: Math.max(-1, Math.min(1, P.turnS)) };
      if (!P.onGround) { mode = 'hop'; st.jumpK = Math.max(0.15, Math.min(0.85, 0.5 - P.vy / (JUMP * 2) * 0.7)); }
      else if (im > 0.08) { const g = gaitFor(me, gv, running); mode = running ? 'run' : 'walk'; st.speed = g.speed; st.cadence = g.cadence; st.stride = g.stride; if (running) st.extra = { cx: 0.22, nx: -0.08 }; }
      else if (dancing && !bt.on && P.dance === 'wave') mode = 'wave';
      st.mode = mode;
      if (dancing && P.onGround && im < 0.08) { st.dance3d = P.dance; st.beat = bt.beat; st.amt = 1; st.mode = 'idle'; }
      posePal3D(me.userData.m, st);
      if (pov) { // arms forward + elbows bent so paws (and held items) are in view; walk/wave/dance motion rides on top
        for (const [n, sg] of [['Left', 1], ['Right', -1]]) { J[n + 'UpperArm'].rotation.x -= 55 * D2R; J[n + 'UpperArm'].rotation.z += sg * 32 * D2R; J[n + 'LowerArm'].rotation.x -= 70 * D2R; } }
      if (pov !== me.userData.povVis) { me.userData.povVis = pov; for (const o of bodyParts) o.visible = !pov || armParts.has(o); } // only arms/paws/held items in first-person
      // others: interpolate, LOD (full rig near, simple pose far, hidden very far)
      const nowMs = Date.now(); for (const o of others3D()) {
        if (blocked.has(o.uid) || nowMs - o.at > STALE_MS * 2) { drop(o.uid); continue; }
        if (!o.obj && o.pal) { try { o.obj = palObj(o.pal, !LOW); o.obj.userData.uid = o.uid; o.obj.traverse((c) => { c.userData.uid = c.userData.uid || undefined; }); scene.add(o.obj); } catch { o.obj = null; } tagFor(o); }
        const k = Math.min(1, dt * 8); const px = o.x, pz = o.z; o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; const mvd = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3);
        const gy = floorAt(o.x, o.z, o.y + 0.3); o.y += ((o.th != null ? Math.max(o.th, gy - 0.05) : gy) - o.y) * Math.min(1, dt * 10);
        if (o.tr != null) { let dy = o.tr - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 10); } else if (mvd > 0.3) o.yaw = Math.atan2(o.x - px, o.z - pz);
        if (!o.obj) continue; const dist = Math.hypot(o.x - P.x, o.z - P.z); o.obj.visible = dist < (LOW ? 60 : 110); o.obj.position.set(o.x, o.y, o.z); o.obj.rotation.y = o.yaw;
        const near = dist < (ULTRA ? 30 : LOW ? 12 : 20); o.t += dt * 60; o.lodN = (o.lodN || 0) + 1;
        if (o.obj.visible && (near || o.lodN % 3 === 0)) { const air = o.th != null && o.th > gy + 0.3; const od = (o.dance && performance.now() < o.danceUntil) || o.dn ? (o.dn || o.dance) : '';
          const run2 = mvd > 2.6; const g2 = gaitFor(o.obj, mvd, run2); const s2 = { mode: air ? 'hop' : mvd > 0.6 ? (run2 ? 'run' : 'walk') : 'idle', t: o.t, dt60: dt * 60 * (near ? 1 : 3), speed: mvd > 0.6 ? g2.speed : 0, cadence: g2.cadence, stride: g2.stride, extra: run2 ? { cx: 0.22, nx: -0.08 } : null, jumpK: 0.5 }; if (od && mvd < 0.6 && !air) { s2.dance3d = od; s2.beat = bt.beat; s2.amt = 1; } posePal3D(o.obj.userData.m, s2); }
        o.obj.traverse((c) => { if (c.isMesh) c.castShadow = near && !LOW; });
        placeTag(o, o.x, o.y + HEIGHT + 0.35, o.z, muted.has(o.uid) ? '' : clean(o.say || ''), o.sayAt || 0, !o.obj.visible || dist > 45); }
      placeTag(meTag, P.x, P.y + HEIGHT + 0.35, P.z, P.say, P.sayAt, pov && Date.now() - P.sayAt > 7000);
      // treasures & portals
      for (const it of items) { if (found.has(it.id)) continue; it.m.rotation.y += dt * 2; it.m.position.y = ground(it.x, it.z) + 1 + Math.sin(now / 400 + it.x) * 0.15;
        if (Math.hypot(it.x - P.x, it.z - P.z) < 1.3 && Math.abs(P.y + 0.8 - it.m.position.y) < 1.6) { found.add(it.id); it.m.visible = false; lss(tk, JSON.stringify([...found])); paintFound(); dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'park', n: 10, why: 'for a treasure' } })); hint('✨ Treasure found! +10 Star Coins'); } }
      if (portalCd > 0) portalCd -= dt; for (const pt of portals) { pt.disc.material.opacity = 0.45 + Math.sin(now / 300 + pt.x) * 0.15; if (portalCd <= 0 && Math.hypot(pt.x - P.x, pt.z - P.z) < 1.2) { portalCd = 4; if (confirm(`Play ${pt.name}?`)) { location.hash = pt.href; return; } } }
      // world animation
      const tt = now / 1000; wind.value = RM() ? 0 : tt; waterM.uniforms.t.value = tt;
      for (let i = 0; i < NSP; i++) { const s = spV[i]; s.life += dt * 0.9; if (s.life > 1) { s.life -= 1; s.a = Math.random() * 6.28; } const l = s.life, r = 0.2 + l * (i % 2 ? 1.5 : 0.9), y = 3.6 + l * 2.6 - l * l * 3.6 * (i % 2 ? 1.2 : 1.6); spP[i * 3] = Math.cos(s.a) * r; spP[i * 3 + 1] = Math.max(0.6, y); spP[i * 3 + 2] = Math.sin(s.a) * r; } spG.attributes.position.needsUpdate = true;
      clouds.position.x = (tt * 0.6) % 120; const pg = window.__p3play; if (pg && !RM()) { pg.userData.seats.forEach((s, i) => (s.rotation.x = Math.sin(tt * 1.6 + i * 1.3) * 0.35)); pg.userData.plank.rotation.z = Math.sin(tt * 0.9) * 0.22; }
      if (window.__p3star) window.__p3star.rotation.y = tt;
      if ((lodT += dt) > 0.6) { lodT = 0; lodTrees(P.x, P.z); }
      // shadows follow the player
      sun.target.position.set(P.x, P.y, P.z); sun.position.set(P.x + 40, P.y + 70, P.z + 25);
      updateCam(dt); send(false);
      R.render(scene, cam); const cms = performance.now() - c0; window.__p3.cpu = window.__p3.cpu * 0.95 + cms * 0.05;
      window.__p3.pos = { x: P.x, y: P.y, z: P.z, onGround: P.onGround, mode: st.mode, dance: st.dance3d || '', yaw: P.yaw, pov, cam: cam.position.toArray(), camDist: C.cur, others: others.size, room };
    }
    window.__p3 = { fps: 0, frame: 0, cpu: 0, net, extras: () => extras, pos: null, input: (o) => { jv.test = true; if ('x' in o) jv.x = o.x; if ('y' in o) jv.y = o.y; if (o.jump) jumpQ = true; if ('run' in o) runT = o.run; }, toggleCam: () => toggleCam(), othersInfo: () => [...others.values()].map((o) => ({ y: o.y, th: o.th, dn: o.dn, ground: ground(o.x, o.z) })), treeTest: () => { let best = null, bd = 1e9; for (const t of trees) { const d = Math.hypot(t.x - P.x, t.z - P.z); if (d < bd && d > 6) { bd = d; best = t; } } if (!best) return null; const a = Math.atan2(best.x - P.x, best.z - P.z); P.x = best.x - Math.sin(a) * 4; P.z = best.z - Math.cos(a) * 4; P.y = ground(P.x, P.z); C.yaw = a + Math.PI; return { tx: best.x, tz: best.z, r: 0.45 * best.s }; }, emoteDance: (id) => emoteDance(id), teleport: (x, z) => { P.x = x; P.z = z; P.y = ground(x, z) + 0.1; }, colliders: () => ({ cyl: cyl.length, box: box.length }), ground, STUDIO, PLAY, HUB, portals: () => portals.map((p) => ({ id: p.id, x: p.x, z: p.z })), emote, say: (t) => say(t), setYaw: (y) => { C.yaw = y; } };
    requestAnimationFrame(frame); cv.focus({ preventScroll: true });
    const bye = () => { deleteDoc(meRef).catch(() => {}); };
    addEventListener('beforeunload', bye); addEventListener('pagehide', bye);
    function cleanup() { if (!alive) return; alive = false; unsub(); bye(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', size); removeEventListener('beforeunload', bye); removeEventListener('pagehide', bye);
      document.body.classList.remove('p3-on'); tc?.destroy(); try { scene.traverse((o) => { o.geometry?.dispose?.(); }); R.dispose(); R.forceContextLoss?.(); } catch { /* */ } delete window.__p3star; delete window.__p3play; }
    stop = cleanup;
  }
  return { page };
}
