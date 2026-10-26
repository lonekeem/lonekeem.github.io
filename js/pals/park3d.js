// Pal Park 3D: a shared, real-3D park. Third-person camera (drag to orbit, pinch/wheel to zoom, no clipping) or
// first-person POV (you ARE your Pal: arms, paws and held items at the bottom of the screen). Joystick + jump/run on
// phones, WASD/Space/Shift on desktop. Physics-lite: gravity, jumping, collisions with trees/rocks/buildings, slopes, stairs.
// World: gentle-hill terrain, instanced trees (oak, pine, birch) with near/far LOD, swaying grass, flowers, a pond with
// water shading, paths, benches, lamps, a playground, a fountain and the purple Kemy Studio. All original, built in code.
// Multiplayer: Firestore presence in rooms of 25 (parkRooms/rN/p/{uid}). While moving, the next
// write waits 120ms after the previous ack (80ms while driving or riding, about 12/s; the rules
// reject anything inside 70ms). Delta-skipped when still, 5 s heartbeat, 20 s stale drop,
// cars render ~130 ms behind with a short velocity extrapolation. Chat via the safety filter.
import { spamOk } from '../spam.js';
import { createLink } from '../games/link.js';
import { getCountFromServer, doc, getDocs, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, addDoc }
  from '../fsq.js';
import { THREE, makePal3D, posePal3D, gfxLevel } from './pal3d.js';
import { WALK_V } from './motion3d.js';
import { getActivePal } from './core.js';
import { clean } from './talk.js';
import { treasures, EMOTES, PHRASES, PORTALS } from './park.js';
import { createControls } from '../controls.js';
import { registerWorld } from '../input.js';
import { openWheel, renderQuickChat, loadOwnedEmotes } from './emote-wheel.js';
import { PHRASES as SAFE_SAY, PHRASE_NOTE, phraseOnly, isPhrase } from '../safe-chat.js';
import { hideKey, isHidden } from '../chat-hide.js';
import { KEMY_NAME, faceName, isAdminUid, noteAdminUid } from '../kemy-name.js';
import { emoteMs, EMOTE_BY_ID } from './emotes.js';
import { WORLD_DANCES, WORLD_DANCE_BY_ID, GROOVE, grooveMove } from './dance-menu.js';
import { musicBeat } from './musicbeat.js';
import { parkGames } from './park-games.js';
import { MINIGAMES } from './minigames.js';
import { addParkHD } from './park-hd.js';
import { attachWorld, worldGround, worldClamp } from '../world/kemyworld.js'; import { roomState } from '../world/layout.js'; // Kemy World: Kemy Street district etc. (own module)
import { presenceGapMs, presenceDeny, afterPresenceDeny, presenceVelInt, extrapSec, keepRemotePal, inVehicle, lookKey, samplePose, takePose, HEARTBEAT_MS, STALE_PRESENCE_MS, RENDER_BEHIND_MS } from './presence-sync.js';
import { gfxPreset, makeRenderer, dprFor, makeSky, envFromSky, proceduralTex, attachGfxSettings, showFps as gfxShowFps } from '../gfx.js';
import { attachRotate } from '../rotate.js';

const PX = 16, CX = 1600, CY = 1200;                 // 1 m = 16 park units; (1600,1200) = plaza centre (same as 2D park)
const toW = (x, y) => [(x - CX) / PX, (y - CY) / PX]; const toP = (x, z) => [Math.round(x * PX + CX), Math.round(z * PX + CY)];
const W = 100, H = 75;                                // world half-size (200 m x 150 m)
const MAX_ROOM = 100, ROOMS = 20, CELL = 160, MAX_DRAWN = 30, HB_MS = HEARTBEAT_MS, STALE_MS = STALE_PRESENCE_MS;
const PORTAL_NAME = { race: 'Pal Race', bubbles: 'Bubble Pop', stars: 'Star Catch', dance: 'Dance-Off' };
const EMO_DANCE = { '👋': 'wave', '💜': 'happyshimmy', '😂': 'bounce', '😮': 'woah', '🎉': 'groove', '😴': 'slowmo', '⭐': 'twirl', '🐾': 'hopclap' };
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
  const edge = Math.max(Math.abs(x) - (W - 12), Math.abs(z) - (H - 12), 0); h += 14 * (1 - Math.exp(-edge * edge * 0.12 / 14)); // rim hills (soft-capped: never a km-high wall)
  return worldGround(x, z, h); }
const WATER_Y = { pond: 0, lake: 0 }; { WATER_Y.pond = ground(POND.x, POND.z) + 2.2; WATER_Y.lake = ground(LAKE.x, LAKE.z) + 2.2; }

export function createPark3D(ctx) {
  const { S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal } = ctx;
  let stop = null;
  async function page() {
    if (!requireAuth()) return; if (stop) stop();
    if (!document.getElementById('p3-css')) { const l = document.createElement('link'); l.id = 'p3-css'; l.rel = 'stylesheet'; l.href = new URL('../../css/park3d.css', import.meta.url).href; document.head.appendChild(l); }
    const Q = gfxPreset(); const ULTRA = Q.tier === 'ultra', LOW = Q.tier === 'low'; void gfxLevel; // shared Graphics setting (js/gfx.js)
    main.innerHTML = `<section class="p3"><div class="p3-view" id="p3-view">
      <canvas id="park-cv" class="p3-cv" tabindex="0" aria-label="Pal Park 3D. WASD or arrows to walk, Q and E to turn, Space to jump, E or Space to enter, F to report. Drag or two-finger scroll to look."></canvas>
      <div class="p3-top"><a class="p3-b" href="#/pals" aria-label="Leave Pal Park">✕</a><b>🌳 Pal Park</b><span id="park-room" class="p3-room"></span><span class="k-link-slot"></span><span id="park-found" class="p3-found"></span><span class="p3-fps" id="p3-fps"></span></div><button class="p3-b" id="p3-rot" type="button" aria-label="Rotate. Tap for landscape">🔄</button><button class="p3-b" id="p3-set" aria-label="Control settings">⚙️</button>
      <div class="p3-log" id="p3-log" aria-live="polite"></div>
      <div class="p3-tags" id="p3-tags"></div>
      <form class="p3-chat" id="p3-chat"><input id="p3-t" maxlength="60" placeholder="Say something nice…" autocomplete="off" enterkeyhint="send" aria-label="Chat message"><button class="p3-send" aria-label="Send">➤</button><button type="button" class="p3-b" id="p3-quick" aria-label="Quick phrases">💬</button></form>
      <div class="p3-panel" id="park-panel" hidden></div><div class="p3-hint" id="p3-hint"></div><button type="button" class="p3-rotip" id="p3-rotip" hidden>📱 Tip: Turn your phone sideways for a bigger view, or tap 🔄 to rotate!</button><div class="p3-load" id="p3-load">Building the park…</div></div></section>`;
    document.body.classList.add('p3-on');
    const view = main.querySelector('#p3-view'), cv = main.querySelector('#park-cv');
    const $ = (s) => main.querySelector(s);
    // ---------------------------------------------------------------- renderer
    const R = makeRenderer(cv, Q, { exposure: 1.0 });   // MSAA (not Low), ACES tone mapping, sRGB output, soft shadows
    const DPR = dprFor(Q); let dprK = 1;
    let lost = false; cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; }); cv.addEventListener('webglcontextrestored', () => { lost = false; });
    const scene = new THREE.Scene(); const SKY = new THREE.Color('#9fd3ff'), FOG = new THREE.Color('#bfe0fb'); void SKY;
    scene.fog = new THREE.Fog(FOG, Q.draw * 0.6, Q.draw * 1.15);   // light haze only far away
    const farCap = (Q.phone || LOW) ? 260 : 340;
    const cam = new THREE.PerspectiveCamera(60, 1, 0.12, Math.min(farCap, Q.draw * 1.15 + 24)); // near 0.12: more depth precision on long roads
    // Size from the canvas box after layout, rotation, and the browser chrome settle. A 0×0 or pre-CSS
    // reading (the in-flow column, before .p3-view is 100dvw×100dvh) must not stick, or the Pal stretches.
    const viewInfo = { w: 0, h: 0, aspect: 1, dpr: 1, buf: [0, 0] };
    let rafA = 0, rafB = 0;
    const applySize = () => {
      const r = cv.getBoundingClientRect();
      const w = r.width, h = r.height;
      if (w < 2 || h < 2) return false;
      const pr = Math.min(devicePixelRatio || 1, Q.dpr) * dprK;
      if (Math.abs(viewInfo.w - w) < 0.5 && Math.abs(viewInfo.h - h) < 0.5 && Math.abs(viewInfo.dpr - pr) < 0.01) return true;
      viewInfo.w = w; viewInfo.h = h; viewInfo.dpr = pr;
      R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
      viewInfo.aspect = cam.aspect; viewInfo.buf = [cv.width, cv.height];
      return true;
    };
    const follow = () => { cancelAnimationFrame(rafA); cancelAnimationFrame(rafB); rafA = requestAnimationFrame(() => { applySize(); rafB = requestAnimationFrame(applySize); }); };
    const schedule = () => { applySize(); follow(); };
    cv.style.width = '100%'; cv.style.height = '100%';
    const ro = new ResizeObserver(applySize); ro.observe(cv);
    const vv = window.visualViewport;
    addEventListener('resize', schedule); addEventListener('orientationchange', schedule);
    document.addEventListener('fullscreenchange', schedule); document.addEventListener('webkitfullscreenchange', schedule);
    if (vv) { vv.addEventListener('resize', schedule); vv.addEventListener('scroll', schedule); }
    const unhookSize = () => { removeEventListener('resize', schedule); removeEventListener('orientationchange', schedule); document.removeEventListener('fullscreenchange', schedule); document.removeEventListener('webkitfullscreenchange', schedule); if (vv) { vv.removeEventListener('resize', schedule); vv.removeEventListener('scroll', schedule); } cancelAnimationFrame(rafA); cancelAnimationFrame(rafB); ro.disconnect(); };
    schedule();
    // lights
    const hemi = new THREE.HemisphereLight('#d6ecff', '#6c9a48', LOW ? 0.75 : 0.68); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1d6', 3.1); sun.position.set(40, 70, 25); scene.add(sun); scene.add(sun.target);
    if (Q.shadows) { sun.castShadow = true; const sm = Q.shadowMap; sun.shadow.mapSize.set(sm, sm); const sc = sun.shadow.camera; sc.left = sc.bottom = -34; sc.right = sc.top = 34; sc.near = 10; sc.far = 140; sun.shadow.bias = -0.0008; sun.shadow.normalBias = Q.phone ? 0.07 : 0.05; sun.shadow.radius = Q.phone ? 1 : 2; if (ULTRA) { sc.left = sc.bottom = -46; sc.right = sc.top = 46; } }
    // procedural sky (gradient + sun + soft fbm clouds) and an environment map baked from it
    const sky = makeSky({ sunDir: sun.position, top: '#2c7be5', hor: '#b4dcff', ground: '#a8cf96', cloud: LOW ? 0.4 : 0.52, fogColor: scene.fog.color, mountains: true }); scene.add(sky); const skyMat = sky.material;
    const fitSky = () => sky.scale.setScalar(cam.far * 0.92 / 400); fitSky(); // the dome always sits inside the far plane
    scene.environment = envFromSky(R, sky); scene.environmentIntensity = 0.22;
    const R0 = rng(7); const clouds = new THREE.Group(); // clouds now live in the sky shader
    { const NC = LOW ? 60 : 140; let k = 0; for (let c = 0; c < NC / 7; c++) { R0(); R0(); R0(); for (let i = 0; i < 7 && k < NC; i++, k++) { R0(); R0(); R0(); R0(); } } } // keep the seeded layout (trees/rocks) identical to before


    // ---------------------------------------------------------------- terrain
    const seg = ULTRA ? 220 : LOW ? 90 : 160;
    const tg = new THREE.PlaneGeometry(W * 2 + 60, H * 2 + 60, seg, Math.round(seg * 0.75)); tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position, cols = new Float32Array(pos.count * 3), surf = new Float32Array(pos.count * 2); const cA = new THREE.Color('#4a9a30'), cB = new THREE.Color('#7cc044'), cP = new THREE.Color('#d2b283'), cS = new THREE.Color('#c9b98a'), cPl = new THREE.Color('#d8d2c6'), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = ground(x, z); pos.setY(i, y);
      const n = Math.sin(x * 0.3) * Math.cos(z * 0.27) * 0.5 + 0.5; tmp.copy(cA).lerp(cB, n * 0.8 + (y - 2) * 0.05);
      const pd = pathD(x, z); if (pd < 2.2) { const k = Math.min(1, (2.2 - pd) / 0.8); tmp.lerp(cP, k); surf[i * 2] = k; }
      if (Math.hypot(x, z) < PLAZA_R) { tmp.copy(cPl); surf[i * 2 + 1] = 1; }
      for (const e of [POND, LAKE]) { const d = ellD(e, x, z); if (d < 1.25) tmp.lerp(cS, Math.min(1, (1.25 - d) * 5)); }
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b; }
    tg.setAttribute('color', new THREE.BufferAttribute(cols, 3)); tg.setAttribute('surf', new THREE.BufferAttribute(surf, 2)); tg.computeVertexNormals();
    // procedural detail textures (grass / dirt path / plaza tiles) blended per vertex, sampled in world space at two scales to hide tiling
    const TX = { grass: proceduralTex('grass', Q), path: proceduralTex('path', Q), tile: proceduralTex('tile', Q) };
    const avgLin = (cv) => { const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); x.drawImage(cv, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data; return new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace); };
    const tgN = TX.grass.normalMap; tgN.repeat.set((W * 2 + 60) * 0.18, (H * 2 + 60) * 0.18);
    const terrainM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.35, normalMap: tgN, normalScale: new THREE.Vector2(0.7, 0.7) });
    terrainM.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, { tG: { value: TX.grass.map }, tP: { value: TX.path.map }, tT: { value: TX.tile.map }, aG: { value: avgLin(TX.grass.map.image) }, aP: { value: avgLin(TX.path.map.image) }, aT: { value: avgLin(TX.tile.map.image) } });
      sh.vertexShader = 'attribute vec2 surf; varying vec2 vSurf; varying vec2 vXZ;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSurf = surf; vXZ = position.xz;');
      sh.fragmentShader = 'uniform sampler2D tG, tP, tT; uniform vec3 aG, aP, aT; varying vec2 vSurf; varying vec2 vXZ;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        vec3 dg = texture2D(tG, vXZ * .18).rgb / aG * mix(vec3(1.), texture2D(tG, vXZ * .027 + .37).rgb / aG, .45);
        vec3 det = mix(dg, texture2D(tP, vXZ * .22).rgb / aP, vSurf.x); det = mix(det, texture2D(tT, vXZ * .2).rgb / aT, vSurf.y);
        diffuseColor.rgb *= clamp(det, 0., 2.);`); };
    const terrain = new THREE.Mesh(tg, terrainM); terrain.receiveShadow = true; scene.add(terrain);
    // plaza tiles ring + kerb
    const kerb = new THREE.Mesh(new THREE.TorusGeometry(PLAZA_R, 0.25, 8, 64), new THREE.MeshStandardMaterial({ color: '#b8ad9c', roughness: 0.8 })); kerb.rotation.x = Math.PI / 2; kerb.position.y = 2.42; kerb.receiveShadow = true; scene.add(kerb);

    // ---------------------------------------------------------------- water (pond + lake): fresnel, waves, sky reflection
    const waterU = { t: { value: 0 }, sunDir: { value: sun.position.clone().normalize() } };
    const waterM = new THREE.ShaderMaterial({ transparent: true, uniforms: { ...waterU, fogColor: { value: FOG }, fogNear: { value: scene.fog.near }, fogFar: { value: scene.fog.far } }, fog: true,
      vertexShader: 'varying vec3 vW; varying float vFog; void main(){ vec4 w = modelMatrix * vec4(position,1.); vW = w.xyz; vec4 mv = viewMatrix * w; vFog = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: `uniform float t; uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear, fogFar; varying vec3 vW; varying float vFog;
        vec2 W2(vec2 p, vec2 d, float k, float s){ float ph = dot(p, d) * k + t * s; return d * cos(ph) * k; }
        void main(){ vec2 p = vW.xz; vec2 g = W2(p, vec2(.8,.6), .9, 1.3) * .22 + W2(p, vec2(-.4,.92), 1.4, 1.7) * .15 + W2(p, vec2(.95,-.3), 2.6, 2.4) * .08 + W2(p, vec2(-.7,-.7), 4.1, 3.1) * .05 + W2(p, vec2(.2,.98), 7.3, 4.2) * .025;
          vec3 n = normalize(vec3(-g.x, 1., -g.y)); vec3 v = normalize(cameraPosition - vW); float fr = .04 + .96 * pow(1. - max(dot(n, v), 0.), 5.);
          vec3 r = reflect(-v, n); float ry = max(r.y, 0.); vec3 skyc = mix(vec3(.80,.91,1.), vec3(.22,.5,.92), pow(ry, .5));            // reflected procedural sky
          vec3 deep = vec3(.03,.24,.36), shallow = vec3(.16,.55,.6); vec3 body = mix(shallow, deep, smoothstep(.0, .9, length(g) * 2. + .35));
          vec3 c = mix(body, skyc, clamp(fr * 1.2 + .12, 0., 1.)); vec3 h = normalize(sunDir + v); c += vec3(1.,.96,.88) * (pow(max(dot(n,h),0.), 400.) * 3. + pow(max(dot(n,h),0.), 60.) * .25);
          float f = smoothstep(fogNear, fogFar, vFog); gl_FragColor = vec4(mix(c, fogColor, f), .9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }` });
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
    function blob(r, ws, hs, seed) { // smooth, lumpy foliage cluster (indexed sphere, displaced, smooth normals)
      const g = new THREE.SphereGeometry(r, ws, hs); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = 1 + Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 + seed * 1.3) * 0.09 + Math.sin(y * 4.3 + seed * 2.1) * 0.06; p.setXYZ(i, x * k, y * k * 0.92, z * k); } g.computeVertexNormals(); return g; }
    function leafGeo(kind, detail) { // layered foliage clusters merged into one geometry per kind/detail
      const parts = []; const R1 = rng(kind.length * 31 + detail); const ws = detail ? 16 : 8, hs = detail ? 12 : 6;
      if (kind === 'pine') for (let i = 0; i < 5; i++) { const g = new THREE.ConeGeometry(2.5 - i * 0.42, 2.3, detail ? 18 : 9, 2); const p = g.attributes.position;
          for (let v = 0; v < p.count; v++) { const x = p.getX(v), y = p.getY(v), z = p.getZ(v); const rr = Math.hypot(x, z); const jag = 1 + Math.sin(Math.atan2(z, x) * 9 + i) * 0.08; p.setXYZ(v, x * jag, y - rr * 0.12, z * jag); }
          g.computeVertexNormals(); g.rotateY(i * 0.7); g.translate(0, 2.7 + i * 1.25, 0); parts.push(g); }
      else { const oak = kind === 'oak'; const n = oak ? (detail ? 13 : 7) : (detail ? 9 : 5); const cy = oak ? 4.9 : 5.3;
        parts.push(blob(oak ? 2.1 : 1.4, ws, hs, 1).translate(0, cy + 0.4, 0));
        for (let i = 0; i < n; i++) { const a = i * 2.39996, el = (R1() - 0.35) * 1.2, rad = oak ? 1.6 + R1() * 0.5 : 0.9 + R1() * 0.4; const r = oak ? 1.05 + R1() * 0.6 : 0.75 + R1() * 0.4;
          parts.push(blob(r, ws, hs, i * 3.7).translate(Math.cos(a) * rad, cy + el * (oak ? 1.1 : 1.6) + (oak ? 0 : (i / n - 0.5) * 2), Math.sin(a) * rad)); } }
      const g = mergeGeos(parts); // vertex colour: darker inside/below (cheap ambient occlusion), brighter sun-side tops
      const p = g.attributes.position, nn = g.attributes.normal, col = new Float32Array(p.count * 3); g.computeBoundingBox(); const b = g.boundingBox;
      for (let v = 0; v < p.count; v++) { const hy = (p.getY(v) - b.min.y) / (b.max.y - b.min.y); const out = Math.max(0, nn.getX(v) * p.getX(v) + nn.getZ(v) * p.getZ(v)) / 2.5; const k = Math.min(1.15, 0.5 + hy * 0.45 + out * 0.25 + Math.max(0, nn.getY(v)) * 0.15);
        col[v * 3] = k; col[v * 3 + 1] = k; col[v * 3 + 2] = k * 0.95; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; }
    function mergeGeos(gs) { // tiny merge (position + normal + uv), keeps smooth normals; avoids pulling in the addons
      const ng = gs.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; ng.forEach((g) => (n += g.attributes.position.count));
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0; ng.forEach((g) => { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
      const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return out; }
    const LEAF = proceduralTex('leaf', Q, [6, 4]), BARK = proceduralTex('bark', Q, [2, 1]);
    const swayMat = (m, amt) => { m.onBeforeCompile = (sh) => { sh.uniforms.wind = wind; sh.vertexShader = 'uniform float wind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
        #else
        vec3 ip = vec3(0.);
        #endif
        float hk = max(position.y - 2., 0.) * ${amt.toFixed(3)}; transformed.x += sin(wind * 1.1 + ip.x * .3 + ip.z * .2) * hk; transformed.z += cos(wind * .9 + ip.x * .25) * hk * .7;
        transformed += normal * sin(wind * 3.7 + position.x * 2.3 + position.z * 1.9 + ip.x) * ${(amt * 0.6).toFixed(3)};`); }; return m; };
    const leafMat = (flat) => swayMat(new THREE.MeshStandardMaterial({ color: '#ffffff', map: LEAF.map, normalMap: flat ? null : LEAF.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.78, vertexColors: true }), 0.045);
    const barkMat = (c) => new THREE.MeshStandardMaterial({ color: c, map: BARK.map, normalMap: BARK.normalMap, roughness: 0.9 });
    const KINDS = { oak: { leaf: ['#4ea33b', '#5cb145', '#6cbd4c', '#3f9437'], trunk: '#7a563a', h: 3.4, n: ULTRA ? 140 : LOW ? 60 : 110 }, pine: { leaf: ['#2f7d43', '#3a8a4a', '#2a7040'], trunk: '#5f4129', h: 2.6, n: ULTRA ? 120 : LOW ? 50 : 90 }, birch: { leaf: ['#98cc59', '#b2d863', '#eac552'], trunk: '#efeae0', h: 4.2, n: ULTRA ? 80 : LOW ? 30 : 60 } };
    const trees = [];
    for (const [kind, K] of Object.entries(KINDS)) { const pts = []; let tries = 0;
      while (pts.length < K.n && tries++ < 4000) { const x = (R0() - 0.5) * (W * 2 - 10), z = (R0() - 0.5) * (H * 2 - 10); if (!freeSpot(x, z, 2)) continue; if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4.5)) continue; const t = { x, z, kind, s: 0.8 + R0() * 0.55, rot: R0() * 6.28, c: K.leaf[Math.floor(R0() * K.leaf.length)] }; pts.push(t); trees.push(t); cyl.push({ x, z, r: 0.45 * t.s, top: 99 }); }
      const trunkG = (() => { const t = new THREE.CylinderGeometry(0.2, 0.4, K.h + 0.6, 12, 3); t.translate(0, (K.h + 0.6) / 2, 0); if (kind === 'pine') return t;
        const parts = [t]; for (let i = 0; i < 3; i++) { const b = new THREE.CylinderGeometry(0.06, 0.12, 1.6, 6); b.translate(0, 0.8, 0); b.rotateZ(0.9); b.rotateY(i * 2.1); b.translate(0, K.h * 0.75 + i * 0.25, 0); parts.push(b); } return mergeGeos(parts); })();
      const mk = (g, m, cnt) => { const im = new THREE.InstancedMesh(g, m, cnt); im.castShadow = !LOW; im.receiveShadow = !LOW; im.count = 0; scene.add(im); return im; };
      K.near = { trunk: mk(trunkG, barkMat(K.trunk), pts.length), leaf: mk(leafGeo(kind, 1), leafMat(false), pts.length) };
      K.far = { trunk: mk(trunkG, barkMat(K.trunk), pts.length), leaf: mk(leafGeo(kind, 0), leafMat(true), pts.length) };
      K.far.trunk.castShadow = K.far.leaf.castShadow = false; K.pts = pts; }
    const _c2 = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    const NEAR_TREE = ULTRA ? 55 : LOW ? 22 : 38;
    function lodTrees(px, pz) { for (const K of Object.values(KINDS)) { let a = 0, b = 0;
      for (const t of K.pts) { const d = Math.hypot(t.x - px, t.z - pz); const L = d < NEAR_TREE ? K.near : K.far; const i = d < NEAR_TREE ? a++ : b++;
        _q.setFromAxisAngle(Y, t.rot); _s.setScalar(t.s); _p.set(t.x, ground(t.x, t.z) - 0.2, t.z); _m.compose(_p, _q, _s); L.trunk.setMatrixAt(i, _m); L.leaf.setMatrixAt(i, _m); L.leaf.setColorAt(i, _c.set(t.c)); }
      K.near.trunk.count = K.near.leaf.count = a; K.far.trunk.count = K.far.leaf.count = b;
      for (const L of [K.near, K.far]) { L.trunk.instanceMatrix.needsUpdate = L.leaf.instanceMatrix.needsUpdate = true; if (L.leaf.instanceColor) L.leaf.instanceColor.needsUpdate = true; L.trunk.computeBoundingSphere(); L.leaf.computeBoundingSphere(); } } }

    // ---------------------------------------------------------------- rocks
    { const n = LOW ? 30 : 60; const rg = new THREE.SphereGeometry(1, LOW ? 10 : 18, LOW ? 8 : 12); { const p = rg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + Math.sin(x * 2.3 + z * 1.7) * 0.12 + Math.cos(y * 3.1 + x) * 0.08 + (Math.abs(x) > 0.6 ? -0.05 : 0); p.setXYZ(i, x * k, y * (y < 0 ? 0.55 : 0.75) * k, z * k); } rg.computeVertexNormals(); }
      const RT = proceduralTex('rock', Q, [2, 1]);
      const rm = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: '#a7a399', map: RT.map, normalMap: RT.normalMap, roughness: 0.9 }), n); rm.castShadow = rm.receiveShadow = !LOW; let k = 0, tries = 0;
      while (k < n && tries++ < 2000) { const x = (R0() - 0.5) * (W * 2 - 12), z = (R0() - 0.5) * (H * 2 - 12); if (!freeSpot(x, z, 1)) continue; const s = 0.5 + R0() * 1.4; const gy = ground(x, z);
        _q.setFromEuler(new THREE.Euler(R0(), R0() * 6, R0() * 0.3)); _m.compose(_p.set(x, gy + s * 0.25, z), _q, _s.set(s * 1.2, s, s)); rm.setMatrixAt(k++, _m); cyl.push({ x, z, r: s * 1.05, top: gy + s * 0.85 }); }
      rm.count = k; scene.add(rm); }

    // ---------------------------------------------------------------- grass (instanced blades, wind sway in the vertex shader) + flowers
    const wind = { value: 0 };
    { const n = Math.round(46000 * Q.grass); const bg = new THREE.BufferGeometry(); // curved, tapered 3-segment blade; base-to-tip gradient in the shader
      bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.045, 0, 0, 0.045, 0, 0, -0.036, 0.13, 0.012, 0.036, 0.13, 0.012, -0.02, 0.26, 0.04, 0.02, 0.26, 0.04, 0, 0.4, 0.09]), 3));
      bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 7 }, () => [0, 1, 0]).flat()), 3)); bg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6]);
      const gm = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
      gm.onBeforeCompile = (sh) => { sh.uniforms.wind = wind; sh.vertexShader = 'uniform float wind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix * vec4(0.,0.,0.,1.); float k = position.y * 1.8; transformed.x += sin(wind * 1.7 + ip.x * .35 + ip.z * .22) * .16 * k; transformed.z += cos(wind * 1.3 + ip.x * .2) * .09 * k; vGy = position.y;`).replace('void main() {', 'varying float vGy;\nvoid main() {');
        sh.fragmentShader = 'varying float vGy;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(.6, 1.05, smoothstep(0., .4, vGy));').replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);'); };
      const gr = new THREE.InstancedMesh(bg, gm, n); gr.receiveShadow = !LOW; let k = 0, tries = 0; const R2 = rng(99);
      while (k < n && tries++ < n * 3) { const near = R2() < 0.55; const x = near ? (R2() - 0.5) * 110 : (R2() - 0.5) * W * 2, z = near ? (R2() - 0.5) * 90 : (R2() - 0.5) * H * 2;
        if (!walkable(x, z, 1) || pathD(x, z) < 2.4 || Math.hypot(x, z) < PLAZA_R + 1.2 || (Math.abs(x - STUDIO.x) < STUDIO.w / 2 + 3 && Math.abs(z - STUDIO.z) < STUDIO.d / 2 + 4) || Math.hypot(x - PLAY.x, z - PLAY.z) < 11 || Math.hypot(x - HUB.x, z - HUB.z) < HUB.r + 2.5) continue;
        const s = 0.7 + R2() * 0.9; _q.setFromAxisAngle(Y, R2() * 6.28); _m.compose(_p.set(x, ground(x, z) - 0.03, z), _q, _s.set(s, s * (0.8 + R2() * 0.6), s)); gr.setMatrixAt(k, _m); gr.setColorAt(k, _c.setHSL(0.22 + R2() * 0.08, 0.55 + R2() * 0.2, 0.3 + R2() * 0.16)); k++; }
      gr.count = k; gr.frustumCulled = false; scene.add(gr);
      const LP = LOW || Q.phone; const fn = Math.round((LP ? 900 : 1600) * Q.detail); const fg = (() => { const ps = []; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const pt = new THREE.SphereGeometry(0.06, LP ? 5 : 8, LP ? 3 : 6); pt.scale(1, 0.35, 0.6); pt.translate(0.065, 0, 0); pt.rotateY(a); ps.push(pt); } const c = new THREE.SphereGeometry(0.035, LP ? 5 : 8, LP ? 3 : 6); c.scale(1, 0.6, 1); c.translate(0, 0.012, 0); ps.push(c);
        const g = mergeGeos(ps); const col = new Float32Array(g.attributes.position.count * 3).fill(1); const cc = c.toNonIndexed().attributes.position.count; for (let v = col.length / 3 - cc; v < col.length / 3; v++) { col[v * 3] = 4; col[v * 3 + 1] = 3; col[v * 3 + 2] = 0.3; } // yellow centre (x instance colour)
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.rotateX(-0.25); g.translate(0, 0.33, 0); return g; })();
      const fl = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, vertexColors: true }), fn); const stemG = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 3); stemG.translate(0, 0.16, 0); const st = new THREE.InstancedMesh(stemG, std('#3d7a2c'), fn); const FC = ['#ff6fae', '#ffd447', '#ffffff', '#b26bff', '#ff8a4a', '#6fb7ff']; k = 0; tries = 0;
      while (k < fn && tries++ < fn * 5) { const x = (R2() - 0.5) * W * 2, z = (R2() - 0.5) * H * 2; if (!walkable(x, z, 1) || pathD(x, z) < 2.6 || Math.hypot(x, z) < PLAZA_R + 2 || Math.hypot(x - PLAY.x, z - PLAY.z) < 12 || (Math.abs(x - STUDIO.x) < 15 && Math.abs(z - STUDIO.z) < 12)) continue;
        // clumps: flowers like company
        const cx = x, cz = z, cnt = 3 + Math.floor(R2() * 5), col = FC[Math.floor(R2() * FC.length)];
        for (let j = 0; j < cnt && k < fn; j++, k++) { const fx = cx + (R2() - 0.5) * 1.6, fz = cz + (R2() - 0.5) * 1.6; _m.compose(_p.set(fx, ground(fx, fz), fz), _q.identity(), _s.setScalar(0.8 + R2() * 0.5)); fl.setMatrixAt(k, _m); st.setMatrixAt(k, _m); fl.setColorAt(k, _c.set(col)); } }
      fl.count = st.count = k; scene.add(fl, st);
      // bushes: soft layered leaf clusters along paths and around the edges (decoration only; no colliders, so walking is unchanged)
      const nb = Math.round(150 * Q.detail); const bgeo = (() => { const ps = [blob(0.75, 12, 9, 2).translate(0, 0.45, 0)]; for (let i = 0; i < 5; i++) { const a = i * 1.26; ps.push(blob(0.5 + (i % 2) * 0.12, 10, 8, i * 5.1).translate(Math.cos(a) * 0.6, 0.35 + (i % 3) * 0.12, Math.sin(a) * 0.6)); } const g = mergeGeos(ps);
        const col = new Float32Array(g.attributes.position.count * 3); const pp = g.attributes.position; for (let v = 0; v < pp.count; v++) { const k2 = 0.55 + Math.min(1, pp.getY(v) / 1.1) * 0.55; col[v * 3] = col[v * 3 + 1] = col[v * 3 + 2] = k2; } g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; })();
      const bu = new THREE.InstancedMesh(bgeo, leafMat(false), nb); bu.castShadow = Q.shadows; bu.receiveShadow = true; const BC = ['#4fa53e', '#5fb84a', '#3e9a3c', '#77c255']; const FLW = ['#ff7ab8', '#ffffff', '#ffd447']; k = 0; tries = 0;
      while (k < nb && tries++ < nb * 30) { const x = (R2() - 0.5) * (W * 2 - 12), z = (R2() - 0.5) * (H * 2 - 12); const pd = pathD(x, z); if (!walkable(x, z, 2) || pd < 3.4 || pd > 9 || Math.hypot(x, z) < PLAZA_R + 4 || Math.hypot(x - PLAY.x, z - PLAY.z) < 14 || (Math.abs(x - STUDIO.x) < 15 && Math.abs(z - STUDIO.z) < 12) || Math.hypot(x - HUB.x, z - HUB.z) < HUB.r + 4) continue;
        const sc = 0.7 + R2() * 0.7; _q.setFromAxisAngle(Y, R2() * 6.28); _m.compose(_p.set(x, ground(x, z) - 0.1, z), _q, _s.set(sc, sc * (0.8 + R2() * 0.3), sc)); bu.setMatrixAt(k, _m); bu.setColorAt(k, _c.set(BC[k % BC.length]).lerp(_c2.set(FLW[k % 3]), R2() < 0.2 ? 0.25 : 0)); k++; }
      bu.count = k; scene.add(bu); }

    // ---------------------------------------------------------------- benches, lamps (along the paths)
    const WT = proceduralTex('wood', Q, [1, 1]), STN = proceduralTex('rock', Q, [3, 1]); const wood = new THREE.MeshStandardMaterial({ color: '#b07a4b', map: WT.map, normalMap: WT.normalMap, roughness: 0.7 }), iron = new THREE.MeshStandardMaterial({ color: '#3b3550', roughness: 0.35, metalness: 0.6 }), stone = new THREE.MeshStandardMaterial({ color: '#e2d9c8', map: STN.map, normalMap: STN.normalMap, roughness: 0.85 });
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

    // HD extras: butterflies, petals, 3D clouds, reeds + foam, flower beds, lamp glow (js/pals/park-hd.js, tier-scaled)
    const hd = addParkHD(scene, { Q, LOW, ground, pathD, walkable, POND, LAKE, WATER_Y, PLAZA_R, lampHeads, W, H });

    // ---------------------------------------------------------------- Kemy Studio (purple, original design) with porch stairs you can climb
    { const g = new THREE.Group(); const y0 = 2.6; g.position.set(STUDIO.x, y0, STUDIO.z); scene.add(g);
      const SD = proceduralTex('siding', Q, [3, 2]); const purple = new THREE.MeshStandardMaterial({ color: '#8a4cf0', map: SD.map, normalMap: SD.normalMap, roughness: 0.6 }), lilac = std('#c9a8ff', { r: 0.6 }), glass = new THREE.MeshStandardMaterial({ color: '#2a1b55', emissive: '#6f5bff', emissiveIntensity: 0.25, roughness: 0.1, metalness: 0.4 });
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
    if (!document.body.contains(cv)) { unhookSize(); R.dispose(); return; }
    const snapOf = (p) => (p ? { species: p.species, name: p.name, colors: p.colors || {}, pattern: p.pattern || '', acc: p.acc || '', outfit: p.outfit || {}, level: p.level || 1, variant: p.variant || '' } : { species: 'kemy', name: 'Kemy', level: 1, outfit: {} });
    let palSnap = snapOf(pal);
    const HEIGHT = 1.45;
    let J; const D2R = Math.PI / 180; const bodyParts = [], armParts = new Set();
    function dress(holder, ps, shadow) { const m = makePal3D(ps); const bb = new THREE.Box3().setFromObject(m); const h = Math.max(0.5, bb.max.y - bb.min.y); const k = HEIGHT / h; m.scale.multiplyScalar(k); m.position.y = -bb.min.y * k;
      m.traverse((o) => { if (o.isMesh) { o.castShadow = shadow; o.frustumCulled = false; } });
      for (const c of [...holder.children]) holder.remove(c); holder.add(m); holder.userData.m = m; holder.userData.eye = (bb.max.y - bb.min.y) * k * 0.82;
      J = m.userData.J; bodyParts.length = 0; armParts.clear(); holder.traverse((o) => { if (o.isMesh) bodyParts.push(o); });
      for (const n of ['LeftUpperArm', 'RightUpperArm']) if (J && J[n]) J[n].traverse((o) => armParts.add(o)); return holder; }
    function palObj(ps, shadow) { return dress(new THREE.Group(), ps, shadow); }
    const me = palObj(palSnap, !LOW); scene.add(me);
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
      for (const b of box) { if (b.top <= feet + STEP || (b.bot != null && b.bot > feet + 1.7)) continue; if (x > b.x0 - RAD && x < b.x1 + RAD && z > b.z0 - RAD && z < b.z1 + RAD) { const pl = x - (b.x0 - RAD), pr = (b.x1 + RAD) - x, pb = z - (b.z0 - RAD), pf = (b.z1 + RAD) - z; const mn = Math.min(pl, pr, pb, pf); if (mn === pl) x = b.x0 - RAD; else if (mn === pr) x = b.x1 + RAD; else if (mn === pb) z = b.z0 - RAD; else z = b.z1 + RAD; } }
      for (const e of [POND, LAKE]) if (inEll(e, x, z, -1.5)) { const d = ellD(e, x, z) || 1e-3; const k = (1 - 1.5 / Math.min(e.rx, e.rz)) / d; x = e.x + (x - e.x) * k * 1.001; z = e.z + (z - e.z) * k * 1.001; }
      return worldClamp(x, z); }

    // ---------------------------------------------------------------- camera (3rd person orbit with anti-clip, or POV)
    const CK = 'kemy-park-cam-' + S.user.uid; let pov = lsg(CK) === 'pov';
    const C = { yaw: Math.PI, pitch: 0.32, dist: 7.5, cur: 7.5, look: 0 };
    const toggleCam = () => { pov = !pov; lss(CK, pov ? 'pov' : 'tp'); paintCam(); hint(pov ? 'First-person: you are your Pal 👀' : 'Third-person camera'); };
    const paintCam = () => { const b = tc && tc.root.querySelector('[data-b=cam]'); if (!b) return; b.setAttribute('aria-pressed', pov); b.classList.toggle('lock', pov); b.setAttribute('aria-label', pov ? 'Camera: first-person. Tap for third-person' : 'Camera: third-person. Tap for first-person'); };
    let tc = null;
    function camBlocked(x, y, z) { if (y < ground(x, z) + 0.25) return true; if (roomState.box && y > P.y + 2.85) return true; for (const b of box) if (b.bot != null && y < b.bot) continue; else if (b.top > 50 && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true; else if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y < b.top) return true;
      for (const c of cyl) if (Math.hypot(c.x - x, c.z - z) < c.r + 0.15 && y < Math.min(c.top, 7)) return true; return false; }
    const tgt = new THREE.Vector3();
    function updateCam(dt) {
      if (roomState.camOv) { try { if (roomState.camOv(cam, dt)) return; } catch { roomState.camOv = null; } }
      if (pov) { // eye camera: a little behind the (hidden) head so both arms + paws sit in the lower part of the view
        me.updateMatrixWorld(true); const hp = new THREE.Vector3(); J.Head.getWorldPosition(hp); const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
        cam.position.set(hp.x - fx * 0.38, hp.y + 0.12, hp.z - fz * 0.38); const pitch = C.pitch - 0.17;
        cam.lookAt(cam.position.x + fx * Math.cos(pitch), cam.position.y - Math.sin(pitch), cam.position.z + fz * Math.cos(pitch)); if (cam.fov !== 70) { cam.fov = 70; cam.updateProjectionMatrix(); } return; }
      if (cam.fov !== 60) { cam.fov = 60; cam.updateProjectionMatrix(); }
      tgt.set(P.x, P.y + 1.2, P.z);
      const inR = !!roomState.box, pit = inR ? Math.min(C.pitch, 0.22) : C.pitch; const dir = new THREE.Vector3(Math.sin(C.yaw) * Math.cos(pit), Math.sin(pit), Math.cos(C.yaw) * Math.cos(pit));
      let d = inR ? Math.min(C.dist, 4.2) : C.dist; for (let i = 1; i <= 28; i++) { const s = (i / 28) * (inR ? Math.min(C.dist, 4.2) : C.dist); if (camBlocked(tgt.x + dir.x * s, tgt.y + dir.y * s, tgt.z + dir.z * s)) { d = Math.max(0.3, s - 0.3); break; } }
      C.cur += (d - C.cur) * Math.min(1, (d < C.cur ? 18 : 4) * dt);
      cam.position.copy(tgt).addScaledVector(dir, C.cur); cam.lookAt(tgt); }

    // ---------------------------------------------------------------- input: joystick, buttons, keys, drag-orbit, pinch, wheel
    const keys = {}; const typing = () => /input|textarea/i.test(document.activeElement && document.activeElement.tagName);
    const kd = (e) => { if (typing()) return; if (e.target && e.target.closest && e.target.closest('.kh-note-btn, .kh-radio')) return; const k = e.key.toLowerCase(); keys[k] = true; if (k === 'enter') { $('#p3-t').focus(); e.preventDefault(); } };
    const ku = (e) => { keys[e.key.toLowerCase()] = false; }; addEventListener('keydown', kd); addEventListener('keyup', ku);
    let jumpQ = false;
    let runT = false;
    tc = createControls(view, { tutorialKey: 'park', tutorialTitle: '🌳 Welcome to Pal Park!', keys: { ' ': 'jump', v: 'cam' },
      onZoom: (z) => { C.dist = Math.max(2.5, Math.min(16, C.dist * z)); },
      tips: ['🕹️ Put your thumb down anywhere on the left and slide to walk. Slide all the way to run.', '👆 Drag to look. Two-finger drag looks. Pinch or scroll zooms. Q and E turn.', '⤒ Jump. E or Space enters a door or car when the button is showing. F talks to Kemy Patrol.', '😊 Emote, or 💃 pick a dance move. While music plays, tap 🕺 Dance to dance to the song’s beat (move to stop).', '👁 Switch between behind-your-Pal and through-your-Pal’s eyes.', '📱 Turn your phone sideways for a bigger view, or tap 🔄 to rotate.', 'A controller walks with the left stick and looks with the right stick.'],
      buttons: [{ id: 'jump', icon: '⤒', label: 'Jump', big: true }, { id: 'run', icon: '🏃', label: 'Run' }, { id: 'emote', icon: '😊', label: 'Emote' }, { id: 'dance', icon: '💃', label: 'Moves' }, { id: 'cam', icon: '👁', label: 'Camera' }, { id: 'groove', icon: '🕺', label: 'Dance' }] });
    tc.on('jump', () => { jumpQ = true; }); tc.on('run', () => { runT = !runT; tc.root.querySelector('[data-b=run]')?.classList.toggle('lock', runT); hint(runT ? 'Running 🏃' : 'Walking'); });
    tc.on('emote', () => openEmotes()); tc.on('dance', () => openDances()); tc.on('groove', () => toggleGroove()); { const gb = tc.root.querySelector('[data-b=groove]'); if (gb) gb.hidden = true; } tc.on('cam', () => toggleCam());
    paintCam(); $('#p3-set').onclick = () => tc.settings();
    attachGfxSettings(tc, (e) => { if (e.fps) { fpsEl.hidden = !(gfxShowFps() || dbgFps); return; } if (e.changed) { tc.root.querySelector('.kc-set')?.remove(); setTimeout(() => page(), 50); } }); // Graphics tier: rebuild the scene with the new tier
    { // tap a Pal. Two-finger look, pinch, and scroll zoom live in the shared controls.
      const rz = tc.root.querySelector('.kc-r'); let ts = null;
      rz.addEventListener('pointerdown', (e) => { if (e.button > 0) return; ts = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
      const up = (e) => { if (!ts || e.pointerId !== ts.id) return; if (e.type === 'pointerup' && Math.hypot(e.clientX - ts.x, e.clientY - ts.y) < 12 && performance.now() - ts.t < 400) tap(e); ts = null; };
      rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up); }
    const jv = { x: 0, y: 0, test: false };
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function tap(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam);
      const objs = [...others.values()].filter((o) => o.obj && o.obj.visible).map((o) => o.obj); if (!pov) objs.push(me);
      const hit = ray.intersectObjects(objs, true)[0]; if (!hit) return; let o = hit.object; while (o.parent && !o.userData.uid && o !== me) o = o.parent;
      if (o === me) { emote(['🎉', '💜', '⭐', '😂'][Math.floor(Math.random() * 4)]); return; } const other = others.get(o.userData.uid); if (other) playerCard(other); }

    // ---------------------------------------------------------------- multiplayer presence (Firestore)
    let room = 'r1', roomN = 0;
    const countRoom = async (i) => {
      const qy = query(collection(db, 'parkRooms', 'r' + i, 'p'), where('at', '>', Timestamp.fromMillis(Date.now() - STALE_MS)));
      const s = await Promise.race([
        getCountFromServer(qy),
        new Promise((_, rej) => setTimeout(() => rej(new Error('room-count')), 4000))
      ]);
      return s.data().count;
    };
    for (let i = 1; i <= ROOMS; i++) { try { const n = await countRoom(i); if (n < MAX_ROOM) { room = 'r' + i; roomN = n; break; } } catch { break; } }
    if (!document.body.contains(cv)) { unhookSize(); R.dispose(); return; }
    $('#park-room').textContent = `Room ${room.slice(1)}`;
    const meRef = doc(db, 'parkRooms', room, 'p', S.user.uid); let extras = true;
    const sync = { vel: null, plate: '' }; let plateOk = true, denyStreak = 0;
    const base = () => { const [x, y] = toP(P.x, P.z); const o = { x: Math.max(-21000, Math.min(10000, x)), y: Math.max(0, Math.min(60000, y)), /* big world: x -1300..385 m, z up to 3460 m (rules mirror this) */ d: P.d, e: P.e, eAt: P.eAt, say: P.say, sayAt: P.sayAt, tgt: P.tgt, c: cellOf(P.x, P.z), name: S.profile.displayName, uname: S.profile.username, color: S.profile.color || '#8a2be2', pal: palSnap, at: serverTimestamp() };
      if (extras) { const iv = presenceVelInt(SV.vx, SV.vz); o.vx = iv.vx; o.vz = iv.vz; o.ct = Date.now(); o.an = SV.an; o.h = Math.max(0, Math.min(2000, Math.round(P.y * 10))); o.r = ((Math.round(P.yaw * 180 / Math.PI) % 360) + 360) % 360; o.dn = P.dance && Date.now() < P.danceUntil ? P.dance : ''; o.v = 3; if (plateOk && sync.plate) o.pl = sync.plate; } if (inOk && roomState.inId) o.in = roomState.inId; return o; }; let inOk = true;
    // interest management: presence carries its 160 m cell; I only listen to the 3x3 cells around me (re-centred with
    // 30 m hysteresis, faster while driving). Writes wait 120ms after each ack and are skipped when the quantized pose has not changed.
    function cellOf(x, z) { return Math.floor(x / CELL) + '_' + Math.floor(z / CELL); }
    let ctr = { i: Math.floor(P.x / CELL), j: Math.floor(P.z / CELL) }; const cells9 = () => { const a = []; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) a.push((ctr.i + di) + '_' + (ctr.j + dj)); return a; };
    // my smoothed velocity (m/s) + anim state, sent with each update so others can interpolate / dead-reckon
    const SV = { vx: 0, vz: 0, an: 'idle', px: P.x, pz: P.z, sx: 0, sz: 0 };
    function svTick(dt) { if (dt <= 0) return; const ix = (P.x - SV.px) / dt, iz = (P.z - SV.pz) / dt; SV.px = P.x; SV.pz = P.z;
      if (sync.vel) { SV.vx = sync.vel.x; SV.vz = sync.vel.z; SV.an = 'drive'; }
      else { const k = Math.min(1, dt * 6); SV.vx += ((Math.abs(ix) < 80 ? ix : 0) - SV.vx) * k; SV.vz += ((Math.abs(iz) < 80 ? iz : 0) - SV.vz) * k;
        const sp = Math.hypot(SV.vx, SV.vz); SV.an = P.dance === 'sit' ? 'sit' : sp > 9 ? 'drive' : sp > 2.6 ? 'run' : sp > 0.4 ? 'walk' : 'idle'; }
      // extra update on a big turn or a stop, so others see it right away (still waits out the write gap)
      const sent = Math.hypot(SV.sx, SV.sz), now = Math.hypot(SV.vx, SV.vz); const turn = sent > 1 && now > 1 && (SV.sx * SV.vx + SV.sz * SV.vz) / (sent * now) < 0.8; const stop = sent > 1 && now < 0.3;
      const big = Math.hypot(ix, iz) * dt > 8 || (P.dance || '') !== SV.dn; if (big) { SV.dn = P.dance || ''; SV.big = true; }
      if ((turn || stop || SV.big) && Date.now() - lastSend > 500) { SV.big = false; dirty = true; send(false); } }
    let lastSend = 0, nextOk = 0, dirty = true, sending = false, nearN = 1, lastSig = ''; const net = { ok: 0, err: '', snaps: 0, snapErr: '' };
    const link = createLink(); link.mount(document.querySelector('#park-cv') && view.querySelector('.k-link-slot'));
    const sigOf = (o) => [o.x, o.y, o.h, o.r, o.vx, o.vz, o.an, o.dn, o.d, o.e, o.say, o.in || '', o.c, o.pl || '', lookKey(o.pal)].join('|');
    const send = async (force) => {
      if (roomState.inId) return; // indoor poses go to houseHere, not the outdoor park room
      const now = Date.now();
      if (sending) { dirty = true; return; }
      if (now < nextOk) return; // 120ms after the last ack: the rules reject a closer pair, and a retry must not strip dn
      if (!force && !dirty && now - lastSend < HB_MS) return;
      const body = base(); const sig = sigOf(body);
      if (!force && sig === lastSig && now - lastSend < HB_MS) { dirty = false; return; }
      sending = true; lastSend = now; dirty = false; SV.sx = SV.vx; SV.sz = SV.vz;
      const t0 = performance.now(); link.markWrite();
      try { await setDoc(meRef, body); lastSig = sig; net.ok++; denyStreak = 0; const fast = !!(sync.vel) || SV.an === 'drive' || (typeof P.dance === 'string' && P.dance[0] === '~'); nextOk = Date.now() + presenceGapMs(fast); link.noteRtt(performance.now() - t0); }
      catch (e) {
        net.err = e.code || String(e); net.fails = (net.fails || 0) + 1; link.fail();
        try { const q = base(); delete q.at; net.last = JSON.stringify(q).slice(0, 600); } catch { /* */ }
        dirty = true;
        if (e.code === 'permission-denied') { const d = presenceDeny({ indoors: !!roomState.inId, inDen: net.inDen || 0 }); if (d.dropExtras) extras = false; net.inDen = d.inDen; if (d.giveUpInside) inOk = false; const step = afterPresenceDeny(denyStreak, !!(body.pl)); denyStreak = step.streak; if (step.dropPlate) plateOk = false; nextOk = Date.now() + d.waitMs; }
        else nextOk = Date.now() + 200;
      }
      sending = false;
      // A ride request can land while a write is already in flight. Flush it as soon as the rule allows, even if the next frame is late.
      if (dirty) { const wait = Math.max(0, nextOk - Date.now()) + 15; setTimeout(() => { if (dirty && !sending) send(false); }, wait); }
    };
    await send(true);
    const others = new Map(); const blocked = S.blocked || new Set(); const MK = 'kemy-park-muted-' + S.user.uid; const muted = new Set(JSON.parse(lsg(MK) || '[]'));
    // Presence: ~8 writes/s on foot, ~12/s while driving or riding (80ms after each ack). Only fresh docs. The listener detaches while the tab is hidden.
    // Your own pal is predicted locally and never corrected from this doc (that is what used to rubber-band).
    // WIDE mode (whole room, client-side nearest-30) unless the room is crowded: players on older cached builds don't send 'c',
    // so a cell-only query would hide them. A failing cell query falls back to WIDE and is logged visibly.
    let wide = roomN <= 40; net.mode = () => (wide ? 'wide' : 'cells');
    const listen = () => { let first = true; const fresh = where('at', '>', Timestamp.fromMillis(Date.now() - STALE_MS * 3)); const qy = wide ? query(collection(db, 'parkRooms', room, 'p'), fresh) : query(collection(db, 'parkRooms', room, 'p'), where('c', 'in', cells9()), fresh); return onSnapshot(qy, (qs) => {
      if (roomState.inId) return; // the house channel owns avatars until you step outside
      link.noteSnap(!!(qs.metadata && qs.metadata.hasPendingWrites));
      if (first) { first = false; const cached = !!(qs.metadata && qs.metadata.fromCache); if (!cached) { const ids = new Set(qs.docs.map((d) => d.id)); for (const [id, o] of others) { if (ids.has(id) || o.house) continue; if (Math.hypot((o.x || 0) - P.x, (o.z || 0) - P.z) > CELL * 1.6) drop(id); } } }
      const now = Date.now(); net.snaps++; net.reads = (net.reads || 0) + Math.max(1, qs.docChanges().length);
      qs.docChanges().forEach((ch) => { const id = ch.doc.id; if (id === S.user.uid) return; if (ch.type === 'removed') { if (!(others.get(id) && others.get(id).house)) drop(id); return; }
        const d = ch.doc.data(); const at = d.at && d.at.toMillis ? d.at.toMillis() : now;
        if (now - at > 120000) { deleteDoc(ch.doc.ref).catch(() => {}); return; }
        const [x, z] = toW(d.x, d.y); let o = others.get(id);
        if (!o) { o = { uid: id, x, z, ix: x, iz: z, ivx: 0, ivz: 0, iyaw: typeof d.r === 'number' ? d.r * Math.PI / 180 : 0, dl: 120, fade: 0, y: typeof d.h === 'number' ? d.h / 10 : ground(x, z), yaw: typeof d.r === 'number' ? d.r * Math.PI / 180 : 0, seenS: d.sayAt || 0, seenE: d.eAt || 0, t: Math.random() * 100 }; others.set(id, o); }
        { const ct = typeof d.ct === 'number' ? d.ct : at; const off = Date.now() - ct; o.off = o.off == null ? off : Math.min(off, o.off + (off - o.off) * 0.1); const B = o.buf || (o.buf = []);
          if (!B.length || ct > B[B.length - 1].t) { const st = B.length >= 8 ? B.shift() : {}; st.t = ct; st.x = x; st.z = z; st.yaw = typeof d.r === 'number' ? d.r * Math.PI / 180 : null; st.vx = (d.vx || 0) / 10; st.vz = (d.vz || 0) / 10; B.push(st); } o.an = d.an || ''; }
        if (d.name === KEMY_NAME) noteAdminUid(id);
        Object.assign(o, { tx: x, tz: z, th: typeof d.h === 'number' ? d.h / 10 : null, tr: typeof d.r === 'number' ? d.r * Math.PI / 180 : null, dn: d.dn || '', pl: d.pl || '', name: d.name, uname: d.uname, color: d.color, pal: d.pal, at, e: d.e, eAt: d.eAt, say: d.say, sayAt: d.sayAt, tgt: d.tgt });
        if (d.sayAt && d.sayAt > o.seenS && d.say && !isHidden(hideKey('park', id, clean(d.say)))) { o.seenS = d.sayAt; if (!muted.has(id) && !blocked.has(id)) logMsg(d.name, clean(d.say), d.color, { uid: id, uname: d.uname }); }
        if (d.eAt && d.eAt > o.seenE) { o.seenE = d.eAt; if (d.e && EMO_DANCE[d.e]) { o.dance = EMO_DANCE[d.e]; o.danceUntil = performance.now() + 6000; } if (d.tgt === S.user.uid && d.e === '🐾') toast(`@${d.uname} petted your Pal! 💜`); } });
    }, (e) => { net.snapErr = e.code || String(e); link.fail(); console.error('[Kemy presence] listener failed (' + (wide ? 'wide' : 'cells') + '):', e); if (!wide) { wide = true; toast('⚠️ Nearby-player sync hiccup, switching to full-room sync'); } setTimeout(() => { if (document.body.contains(cv)) { try { unsubL && unsubL(); } catch { /* */ } unsubL = listen(); } }, 1500); }); };
    let unsubL = listen();
    const recenter = () => { const cx = (ctr.i + 0.5) * CELL, cz = (ctr.j + 0.5) * CELL; if (Math.abs(P.x - cx) < CELL / 2 + 30 && Math.abs(P.z - cz) < CELL / 2 + 30) return; ctr = { i: Math.floor(P.x / CELL), j: Math.floor(P.z / CELL) }; net.recenters = (net.recenters || 0) + 1; if (wide) return; if (unsubL) { unsubL(); unsubL = listen(); } };
    setInterval(() => { if (document.body.contains(cv)) { recenter(); let n = 0; for (const o of others.values()) if (Math.hypot(o.x - P.x, o.z - P.z) < 150) n++; nearN = n; const rl = $('#park-room'); if (rl) { const t = `Room ${room.slice(1)} · 👥 ${others.size + 1}`; if (rl.textContent !== t) { rl.textContent = t; rl.title = `Up to ${MAX_ROOM} players per room; new rooms open automatically`; } } } }, 1000);
    let hideT = 0;
    const onVisHide = () => {
      if (unsubL) { unsubL(); unsubL = null; }
      clearTimeout(hideT);
      hideT = setTimeout(() => { if (document.hidden || document.visibilityState === 'hidden') deleteDoc(meRef).catch(() => {}); }, 12000);
      link.setDown(true);
    };
    const onVisShow = () => {
      if (!document.body.contains(cv)) return;
      clearTimeout(hideT); link.setDown(false);
      if (!unsubL) unsubL = listen();
      dirty = true; send(true);
    };
    const onVis = () => { if (document.hidden) onVisHide(); else onVisShow(); };
    const onOff = () => link.setDown(true), onOn = () => { link.setDown(false); dirty = true; send(true); };
    const onFreeze = () => onVisHide();
    const onResume = () => onVisShow();
    addEventListener('offline', onOff); addEventListener('online', onOn);
    document.addEventListener('visibilitychange', onVis);
    document.addEventListener('freeze', onFreeze);
    document.addEventListener('resume', onResume);
    const unsub = () => { document.removeEventListener('visibilitychange', onVis); document.removeEventListener('freeze', onFreeze); document.removeEventListener('resume', onResume); removeEventListener('offline', onOff); removeEventListener('online', onOn); clearTimeout(hideT); link.stop(); if (unsubL) unsubL(); unsubL = null; };
    function drop(id) { const o = others.get(id); if (!o) return; if (o.obj) { scene.remove(o.obj); } o.tag?.remove(); others.delete(id); }

    // ---------------------------------------------------------------- name tags + speech bubbles (HTML overlay, crisp on phones)
    const tags = $('#p3-tags');
    function tagFor(o, mine) {
      if (o.tag) return o.tag;
      const el = document.createElement('div'); el.className = 'p3-tag' + (mine ? ' me' : '');
      el.innerHTML = `<div class="p3-bub" hidden></div><span></span>`;
      const span = el.querySelector('span');
      const who = mine ? (S.user && S.user.uid) : o.uid;
      const label = faceName(who, mine ? 'You · ' + (palSnap.name || 'Pal') : (o.name || ''));
      span.dataset.n = label; span.textContent = label;
      if (isAdminUid(who)) span.classList.add('kemy-admin-name');
      const mb = (window.kemyFaceBadge ? window.kemyFaceBadge(who) : (window.kemyModBadge ? window.kemyModBadge(who) : ''));
      if (mb) span.insertAdjacentHTML('beforeend', mb);
      if (!mine) {
        const tools = document.createElement('span');
        tools.className = 'p3-safe';
        tools.innerHTML = '<button type="button" data-act="report">Report</button><button type="button" data-act="block">Block</button>';
        tools.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = e.target.closest('button')?.dataset.act;
          if (!act || !o.uid) return;
          if (act === 'report') {
            const key = hideKey('park', o.uid, o.say || o.name || '');
            if (window.kemyModLine && o.say) window.kemyModLine((o.name || 'Someone') + ': ' + o.say);
            if (window.kemyModReport) window.kemyModReport({ targetType: 'user', targetId: o.uid, targetUid: o.uid, name: '@' + (o.uname || 'player'), hideKey: key });
            else report(o);
          } else if (confirm(`Block @${o.uname || 'player'}? You won’t see them in Pal Park.`)) {
            setDoc(doc(db, 'users', S.user.uid, 'blocks', o.uid), { createdAt: serverTimestamp() }).then(() => { blocked.add(o.uid); drop(o.uid); toast(`Blocked @${o.uname || 'player'}`); }).catch((er) => toast(friendlyError(er)));
          }
        });
        el.appendChild(tools);
      }
      tags.appendChild(el); o.tag = el; return el;
    }
    const meTag = { }; tagFor(meTag, true);
    let palGen = 0;
    const onPal = () => { const gen = ++palGen; getActivePal(db, S.user.uid).then((p) => { if (gen !== palGen || !p || !document.body.contains(cv)) return; const next = snapOf(p); if (lookKey(next) === lookKey(palSnap) && next.name === palSnap.name) return; palSnap = next; dress(me, palSnap, !LOW); me.userData.povVis = undefined; dirty = true; const span = meTag.tag && meTag.tag.querySelector(':scope > span'); if (span) { const label = 'You · ' + (palSnap.name || 'Pal'); span.dataset.n = label; span.textContent = label; } }).catch(() => {}); };
    addEventListener('kemy:pal-changed', onPal);
    const v3 = new THREE.Vector3();
    function placeTag(o, x, y, z, say, sayAt, hide) {
      const el = o.tag; if (!el) return;
      if (o !== meTag && o.name) {
        const span = el.querySelector(':scope > span');
        const label = faceName(o.uid, o.name);
        if (span && span.dataset.n !== label) {
          span.dataset.n = label; span.textContent = label;
          if (isAdminUid(o.uid)) span.classList.add('kemy-admin-name');
          const mb = window.kemyFaceBadge ? window.kemyFaceBadge(o.uid) : (window.kemyModBadge ? window.kemyModBadge(o.uid) : '');
          if (mb) span.insertAdjacentHTML('beforeend', mb);
        }
      }
      v3.set(x, y, z).project(cam);
      const vis = !hide && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
      const disp = vis ? '' : 'none';
      if (el.style.display !== disp) el.style.display = disp;
      if (!vis) return;
      const w = view.clientWidth, h = view.clientHeight;
      const tf = `translate(${((v3.x + 1) / 2 * w).toFixed(1)}px,${((1 - v3.y) / 2 * h).toFixed(1)}px) translate(-50%,-100%)`;
      if (el.style.transform !== tf) el.style.transform = tf;
      const b = el.firstChild; const show = say && Date.now() - sayAt < 7000;
      if (show) { if (b.dataset.s !== String(sayAt)) { b.dataset.s = String(sayAt); b.textContent = say; const who = o === meTag ? (S.user && S.user.uid) : o.uid; const mb = (window.kemyFaceBadge ? window.kemyFaceBadge(who) : (window.kemyModBadge ? window.kemyModBadge(who) : '')); if (mb) b.insertAdjacentHTML('afterbegin', mb + ' '); } if (b.hidden) b.hidden = false; }
      else if (!b.hidden) b.hidden = true;
    }
    // chat log
    const log = $('#p3-log');
    function logMsg(name, text, color, meta) {
      const d = document.createElement('div'); d.className = 'p3-msg';
      if (meta && meta.uid) { const key = hideKey('park', meta.uid, text); d.dataset.hide = key; if (isHidden(key)) d.hidden = true; }
      const who = meta && meta.uid;
      const shown = isAdminUid(who) ? (KEMY_NAME + (String(name || '').includes('(you)') ? ' (you)' : '')) : (name || 'Someone');
      const b = document.createElement('b'); b.textContent = shown + ': '; b.style.color = isAdminUid(who) ? '#ff2d2d' : (color || '#d9c2ff');
      if (isAdminUid(who)) b.classList.add('kemy-admin-name');
      d.append(b, document.createTextNode(text));
      if (meta && meta.uid && meta.uid !== S.user.uid) {
        const bar = document.createElement('span'); bar.className = 'p3-safe';
        bar.innerHTML = '<button type="button" data-act="report">Report</button><button type="button" data-act="block">Block</button>';
        bar.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = e.target.closest('button')?.dataset.act;
          if (act === 'report') {
            if (window.kemyModLine) window.kemyModLine((name || 'Someone') + ': ' + text);
            if (window.kemyModReport) window.kemyModReport({ targetType: 'chat message', targetId: meta.uid, targetUid: meta.uid, name: '@' + (meta.uname || 'player'), hideKey: d.dataset.hide });
          } else if (act === 'block' && confirm(`Block @${meta.uname || 'player'}?`)) {
            setDoc(doc(db, 'users', S.user.uid, 'blocks', meta.uid), { createdAt: serverTimestamp() }).then(() => { blocked.add(meta.uid); drop(meta.uid); d.remove(); toast('Blocked'); }).catch((er) => toast(friendlyError(er)));
          }
        });
        d.append(bar);
      }
      log.appendChild(d); while (log.children.length > 30) log.firstChild.remove(); log.scrollTop = log.scrollHeight; log.classList.add('fresh'); clearTimeout(log._t); log._t = setTimeout(() => log.classList.remove('fresh'), 8000); if (window.kemyModLine) window.kemyModLine((name || 'Someone') + ': ' + text);
    }
    log.addEventListener('click', (e) => { if (e.target.closest('button')) return; log.classList.toggle('open'); });
    // chat input
    let lastSay = 0, burst = [], sayT = 0, sayNext = '';
    function applyPhrase() {
      const on = phraseOnly();
      const form = $('#p3-chat'); if (form) form.classList.toggle('phrases', on);
      const b = $('#p3-quick'); if (b) { b.textContent = on ? 'Say' : '💬'; b.setAttribute('aria-label', on ? 'Pick a phrase' : 'Quick phrases'); }
    }
    applyPhrase();
    addEventListener('kemy:chat-mode', applyPhrase);
    function say(t) {
      if (phraseOnly() && !isPhrase(t)) { toast(PHRASE_NOTE); return false; }
      const gate = window.kemyChatGate ? window.kemyChatGate(t, 'park', '') : { ok: true, text: t };
      if (!gate.ok) return false;
      t = gate.text;
      if (!spamOk('park', t)) return false;
      // Quick lines wait their turn (2.5 s apart, 6 per 30 s; the newest waiting line wins), never refused.
      sayNext = t;
      const out = () => { sayT = 0; const now = Date.now(); lastSay = now; burst.push(now); P.say = clean(sayNext).slice(0, 60); P.sayAt = now; dirty = true; try { send(true); logMsg(S.profile.displayName + ' (you)', P.say, S.profile.color, { uid: S.user.uid }); } catch { /* left the park */ } };
      const now = Date.now(); burst = burst.filter((x) => now - x < 30000);
      const wait = Math.max(2500 - (now - lastSay), burst.length >= 6 ? burst[burst.length - 6] + 30000 - now : 0);
      if (wait > 0) { if (!sayT) sayT = setTimeout(out, wait); return true; }
      out(); return true;
    }
    $('#p3-chat').onsubmit = (e) => { e.preventDefault(); if (phraseOnly()) { $('#p3-quick').click(); return; } const inp = $('#p3-t'); const v = inp.value.trim(); if (!v) { inp.blur(); return; } if (say(v)) { inp.value = ''; inp.blur(); } };
    const panel = $('#park-panel'); const toggle = (k) => { const open = panel.hidden || panel.dataset.k !== k; panel.hidden = !open; panel.dataset.k = k; return open; };
    // quick chat: tabbed tap-to-say phrases (greetings, teamwork, GG, compliments, park, emoji); the text bar stays too
    $('#p3-quick').onclick = () => { if (!toggle('c')) return; const tabs = phraseOnly() ? [{ id: 'say', icon: '💬', name: 'Say', list: SAFE_SAY }] : undefined; renderQuickChat(panel, (x) => { if (say(x)) panel.hidden = true; }, tabs); };
    // emote wheel: 8 favourite slots (player picks), the classic emoji reactions underneath, shop shortcut
    loadOwnedEmotes(db, S.user.uid);
    function openEmotes() { panel.hidden = true; loadOwnedEmotes(db, S.user.uid).then(() => openWheel({ onEmote: emoteDance, reactions: EMOTES, onReact: (x) => emote(x), onShop: () => dispatchEvent(new Event('kemy:dance-shop')), onLocked: (d) => { toast(`🔒 ${d.name} is in the Dance Shop`); dispatchEvent(new Event('kemy:dance-shop')); } })); }
    // a wheel emote/dance: synced to everyone through the existing dance-name field (dn), cleared when it ends
    function emoteDance(id) { const d = EMOTE_BY_ID[id]; P.dance = id; P.danceUntil = Date.now() + emoteMs(id); P.tgt = ''; dirty = true; send(true); hint(`${(d && d.icon) || '💃'} ${(d && d.name) || 'Dance!'}`); paintDanceBtn(); }
    function paintDanceBtn() { const b = tc.root.querySelector('[data-b=dance]'); if (b) b.classList.toggle('lock', !!(P.dance && WORLD_DANCE_BY_ID[P.dance] && Date.now() < P.danceUntil)); }
    function stopWorldDance() { if (P.dance === 'sit' || (P.dance && P.dance[0] === '~')) return; P.dance = ''; P.danceUntil = 0; dirty = true; send(true); paintDanceBtn(); }
    function startWorldDance(id) { const d = WORLD_DANCE_BY_ID[id]; if (!d) return; P.dance = d.id; P.danceUntil = Date.now() + 864e5; P.tgt = ''; dirty = true; send(true); hint(`${d.icon} ${d.name}`); paintDanceBtn(); import('../gamemusic.js').then((gm) => { if (!gm.isPlaying()) gm.playStation('theme', { volume: 0.14 }); }).catch(() => {}); }
    function openDances() { if (!toggle('d')) return; const cur = P.dance; panel.innerHTML = `<div class="p3-dances">${WORLD_DANCES.map((d) => `<button type="button" data-wd="${d.id}" class="${cur === d.id ? 'on' : ''}"><span class="ic" aria-hidden="true">${d.icon}</span>${d.name}</button>`).join('')}<button type="button" data-wd-stop class="stop">Stop</button></div>`; }
    panel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.wd) { startWorldDance(b.dataset.wd); panel.hidden = true; } if (b.dataset.wdStop != null) { stopWorldDance(); panel.hidden = true; hint('Dance stopped'); } if (b.dataset.e) { emote(b.dataset.e); panel.hidden = true; } if (b.dataset.say) { say(b.dataset.say); panel.hidden = true; } });
    function emote(x, tgt = '') { P.e = x; P.eAt = Date.now(); P.tgt = tgt; if (EMO_DANCE[x]) { P.dance = EMO_DANCE[x]; P.danceUntil = Date.now() + 6000; } dirty = true; send(true); }
    function playerCard(o) {
      const isM = muted.has(o.uid);
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="park-card"><h2 class="${isAdminUid(o.uid) ? 'kemy-admin-name' : ''}">${esc(faceName(o.uid, o.name))}</h2><p class="muted">@${esc(o.uname)} · with ${esc((o.pal && o.pal.name) || 'their Pal')}</p>
        <div class="btns"><a class="btn btn-sm" href="#/u/${esc(o.uname)}" data-close>View profile</a><button class="btn btn-sm btn-ghost" id="pc-pet">🐾 Pet their Pal</button><button class="btn btn-sm btn-ghost" id="pc-mute">${isM ? '🔈 Unmute' : '🔇 Mute chat'}</button><button class="btn btn-sm btn-ghost" id="pc-rep">Report</button><button class="btn btn-sm btn-ghost" id="pc-block">Block</button></div></div>`);
      document.getElementById('pc-pet').onclick = () => { closeModal(); emote('🐾', o.uid); toast(`You petted ${(o.pal && o.pal.name) || 'their Pal'}! 💜`); };
      document.getElementById('pc-mute').onclick = () => { if (isM) muted.delete(o.uid); else muted.add(o.uid); lss(MK, JSON.stringify([...muted])); closeModal(); toast(isM ? `Unmuted @${o.uname}` : `Muted @${o.uname}. You won’t see their chat.`); };
      document.getElementById('pc-rep').onclick = () => { closeModal(); if (window.kemyModReport) window.kemyModReport({ targetType: 'user', targetId: o.uid, targetUid: o.uid, name: '@' + (o.uname || 'player'), hideKey: hideKey('park', o.uid, o.say || '') }); else report(o); };
      document.getElementById('pc-block').onclick = async () => { if (!confirm(`Block @${o.uname}? You won’t see them in Pal Park.`)) return; try { await setDoc(doc(db, 'users', S.user.uid, 'blocks', o.uid), { createdAt: serverTimestamp() }); blocked.add(o.uid); drop(o.uid); closeModal(); toast(`Blocked @${o.uname}`); } catch (er) { toast(friendlyError(er)); } }; }
    function report(o) {
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><form class="park-card" id="pr-f"><h2>Report @${esc(o.uname)}</h2><select id="pr-r"><option>Mean or rude chat</option><option>Inappropriate name or Pal</option><option>Spam</option><option>Something else</option></select><textarea id="pr-t" maxlength="300" placeholder="What happened? (optional)"></textarea><button class="btn">Send report</button></form>`);
      document.getElementById('pr-f').onsubmit = async (e) => { e.preventDefault(); try { await addDoc(collection(db, 'reports'), { reporterId: S.user.uid, targetType: 'user', targetId: o.uid, postId: '', reason: ('Pal Park: ' + document.getElementById('pr-r').value + '. ' + document.getElementById('pr-t').value).slice(0, 500), excerpt: String(o.say || '').slice(0, 300), createdAt: serverTimestamp() }); closeModal(); toast('Thanks. The report was sent.'); } catch (er) { toast(friendlyError(er)); } }; }
    const hintEl = $('#p3-hint'); function hint(t) { hintEl.textContent = t; hintEl.classList.add('on'); clearTimeout(hintEl._t); hintEl._t = setTimeout(() => hintEl.classList.remove('on'), 2200); }
    attachRotate($('#p3-rot'), hint);
    function showRotTip() {
      if (!document.body.contains(view)) return;
      const KEY = 'kemy-rot-tip'; let n = 0;
      try { n = parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch { return; }
      if (n >= 3) return;
      const el = $('#p3-rotip'); if (!el) return;
      try { localStorage.setItem(KEY, String(n + 1)); } catch { /* still show it this time */ }
      el.hidden = false; el.onclick = () => { el.hidden = true; };
    }
    setTimeout(() => { const p = tc.tutorial(); if (p && p.then) p.then(showRotTip); else showRotTip(); }, 600);

    // ---------------------------------------------------------------- music: the theme playlist, softly, looping (🎵 player stays available)
    let gm = null; import('../gamemusic.js').then(async (m) => { gm = m; await m.mountGameMusic({ corner: 'top-right' }); if (!m.isPlaying() && document.body.contains(cv)) m.playStation('theme', { volume: 0.18 }); }).catch(() => {});
    // the beat of whatever is playing (game radio, theme player or a house TV), from each song's measured beat grid (musicbeat.js)
    const beatNow = () => musicBeat();
    // 🕺 Dance: shows only while music plays (not while driving). Tap = dance to the beat, tap again or move = stop; stops when the music does.
    // Presence: just the dn field on the normal write (no forced write, still waits out the write gap), and taps are paced (<= 1 change / 0.7 s).
    let grooveTap = 0, grooveOff = 0, grooveShown = null, grooveFr = 0; const GROOVE_TAP_MS = 700;
    const grooveBtn = () => tc.root.querySelector('[data-b=groove]');
    const grooving = () => P.dance === GROOVE && Date.now() < P.danceUntil;
    function setGroove(on) { if (on === grooving()) return; P.dance = on ? GROOVE : ''; P.danceUntil = on ? Date.now() + 864e5 : 0; P.tgt = ''; dirty = true; send(false); paintDanceBtn(); grooveBtn()?.classList.toggle('lock', on); if (window.__p3) window.__p3.grooveSets = (window.__p3.grooveSets || 0) + 1; }
    function toggleGroove() { const now = Date.now(); if (now - grooveTap < GROOVE_TAP_MS) return; grooveTap = now; const b = beatNow(); if (grooving()) { setGroove(false); hint('Dance stopped'); return; } if (!b.on || W3.driving()) { hint('🎵 Play some music to dance'); return; } setGroove(true); hint(`🕺 Dancing to the beat (${Math.round(b.bpm)} bpm). Move or tap again to stop.`); }
    function grooveTick(bt) { const gNow = performance.now(); if (gNow - grooveFr < 200) return; grooveFr = gNow; const drv = !!W3.driving(), show = bt.on && !drv; if (show !== grooveShown) { grooveShown = show; const el = grooveBtn(); if (el) el.hidden = !show; }
      if (grooving()) { if (bt.on && !drv) grooveOff = 0; else if (!grooveOff) grooveOff = Date.now(); else if (Date.now() - grooveOff > 1500) { grooveOff = 0; setGroove(false); hint('🎵 Music stopped'); } } else grooveBtn()?.classList.remove('lock'); }

    // distance culling for the whole Pal Park build (terrain, trees, grass, flowers, props): one group, hidden when you are far
    // away (e.g. driving in the southern towns it used to cost ~1M triangles + ~150 draw calls for things you cannot see);
    // the dense ground detail (grass / flower instancing) gets its own, much shorter range
    const parkG = new THREE.Group(), parkDet = new THREE.Group(); parkG.name = 'park'; parkDet.name = 'park-detail';
    { const keep = new Set([sky, hemi, sun, sun.target, me]); for (const o of [...scene.children]) { if (keep.has(o) || o.userData.uid) continue; const n = o.isInstancedMesh ? (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * o.count : 0; (n > 40000 ? parkDet : parkG).add(o); } scene.add(parkG, parkDet); }
    // merge every static park prop (benches, lamps, studio, fences, kerbs…) into one mesh per material: ~180 draw calls -> a few dozen
    const mergedInfo = { before: 0, after: 0 };
    { scene.updateMatrixWorld(true); const skipRoots = new Set([window.__p3play, window.__p3star && window.__p3star.parent, ...portals.map((p) => p.disc), ...items.map((it) => it.m)].filter(Boolean));
      const bins = new Map(), dead = [];
      const skip = (o) => { for (let q = o; q && q !== parkG; q = q.parent) if (skipRoots.has(q) || q.userData.uid || q.userData.noMerge) return true; return false; };
      parkG.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.morphTargetInfluences || Array.isArray(o.material)) return; const m = o.material; if (!m || m.isShaderMaterial || m.transparent || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return;
        if (o.geometry.attributes.position.count > 20000 || skip(o)) return; const g = o.geometry; const names = Object.keys(g.attributes).filter((n) => ['position', 'normal', 'uv', 'color'].includes(n)).sort();
        if (!names.includes('normal')) return; const key = m.uuid + '|' + names.join(',') + '|' + o.castShadow + o.receiveShadow; if (!bins.has(key)) bins.set(key, { m, names, shadow: [o.castShadow, o.receiveShadow], parts: [] }); bins.get(key).parts.push(o); });
      for (const b of bins.values()) { if (b.parts.length < 2) continue; let n = 0; const geos = b.parts.map((o) => { const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()); g.applyMatrix4(o.matrixWorld); n += g.attributes.position.count; return g; });
        const out = new THREE.BufferGeometry(); for (const nm of b.names) { const sz = geos[0].attributes[nm].itemSize; const arr = new Float32Array(n * sz); let off = 0; for (const g of geos) { const a = g.attributes[nm]; arr.set(a.array.length === a.count * sz ? a.array : Float32Array.from({ length: a.count * sz }, (_, i) => a.array[i]), off); off += a.count * sz; } out.setAttribute(nm, new THREE.BufferAttribute(arr, sz)); }
        geos.forEach((g) => g.dispose()); out.computeBoundingSphere(); const mm = new THREE.Mesh(out, b.m); [mm.castShadow, mm.receiveShadow] = b.shadow; mm.name = 'park-merged'; parkG.add(mm); mergedInfo.before += b.parts.length; mergedInfo.after++; dead.push(...b.parts); }
      for (const o of dead) o.parent && o.parent.remove(o); }
    const parkCull = () => { const dx = Math.max(0, Math.abs(P.x) - (W + 30)), dz = Math.max(0, Math.abs(P.z) - (H + 30)), d = Math.hypot(dx, dz); parkG.visible = d < Q.draw * 0.8; parkDet.visible = d < 50; };
    const W3 = attachWorld({ THREE, scene, R, Q, LOW, ULTRA, box, cyl, P, me, view, hint, S, db, toast, sky, sun, hemi, ground, cam, palObj, others, gaitFor, posePal3D, beatNow: () => beatNow(), proceduralTex, terrainMat: terrainM, tc, collide, floorAt, markDirty: () => { dirty = true; }, send: (f) => send(f), sync, quietPark: () => { for (const id of [...others.keys()]) if (!(others.get(id) && others.get(id).house)) drop(id); }, dropPal: (id) => drop(id) });
    const unWorld = registerWorld({
      active: () => document.body.contains(cv),
      driving: () => !!(W3.driving && W3.driving()),
      interact: () => { const b = document.getElementById('ks-act'); if (b && !b.hidden) { b.click(); return true; } return false; },
      decorating: () => !!(window.__kh && window.__kh.deco),
      decorate: (pressed) => !!(window.__khApi && window.__khApi.decoratePad && window.__khApi.decoratePad(pressed)),
      patrol: () => { const h = document.querySelector('.kh-act'); if (h && !h.hidden) { h.click(); return; } if (window.kemyModReport) window.kemyModReport({ targetType: 'world', targetId: 'park', name: 'a problem' }); },
      menu: () => tc.settings(),
      map: () => { const m = document.getElementById('ks-map'); if (m) m.click(); },
      use: () => openEmotes(),
      jump: () => { jumpQ = true; },
      hotbar: (n) => { if (EMOTES[n]) emote(EMOTES[n]); },
      zoom: (dir) => { C.dist = Math.max(2.5, Math.min(16, C.dist * (dir > 0 ? 0.92 : 1.08))); },
      back: () => { const b = document.querySelector('#modal-root [data-close]'); if (b) b.click(); }
    });
    if (/^#\/street/.test(location.hash)) W3.spawnStreet();
    // ---------------------------------------------------------------- main loop
    let fast = 0, qStep = 0, drvCls = false, cullAt = 0; const applyDraw = () => { scene.fog.near = Q.draw * 0.6; scene.fog.far = Q.draw * 1.15; waterM.uniforms.fogNear.value = scene.fog.near; waterM.uniforms.fogFar.value = scene.fog.far; cam.far = Math.min(farCap, Q.draw * 1.15 + 24); cam.updateProjectionMatrix(); fitSky(); };
    R.shadowMap.autoUpdate = !(Q.phone || LOW); let shN = 0; // phones: shadow map re-rendered every third frame (the sun follows the player slowly)
    let alive = true, last = performance.now(), frames = 0, fpsT = last, fps = 0, slow = 0, lodT = 0, portalCd = 0; lodTrees(P.x, P.z);
    const fpsEl = $('#p3-fps'); const dbgFps = lsg('kemy-pals-debug') === '1' || /fps/.test(location.hash + location.search); if (!(dbgFps || gfxShowFps())) fpsEl.hidden = true;
    $('#p3-load').remove(); hint('Drag to look around · 👁 switches camera');
    const others3D = () => others.values(); let drawSet = null, fr = 0, recFast = 0; const DELAY = 120;
    // On foot: play about 120 ms behind. In a car: a fixed 130 ms behind, linear between snapshots,
    // dead-reckon only a short gap, and snap the shown pose only on a real teleport.
    function interp(o, dt) { const B = o.buf; if (!B || !B.length) { o.ix = o.tx; o.iz = o.tz; o.ivx = 0; o.ivz = 0; return; }
      const veh = inVehicle(o.dn) || o.an === 'drive';
      if (veh) {
        o.dl = RENDER_BEHIND_MS;
        const pose = samplePose(B, Date.now() - (o.off || 0), RENDER_BEHIND_MS, extrapSec(o.an, o.dn));
        if (!pose) return;
        const shown = takePose(o.ix == null ? null : { x: o.ix, z: o.iz, yaw: o.iyaw || 0 }, pose);
        o.ix = shown.x; o.iz = shown.z; o.ivx = pose.vx; o.ivz = pose.vz; o.iyaw = shown.yaw; return;
      }
      const span = B.length >= 2 ? B[B.length - 1].t - B[B.length - 2].t : 100;
      const want = Math.min(150, Math.max(DELAY, Math.min(150, span * 1.1)));
      o.dl = (o.dl ?? DELAY) + (want - (o.dl ?? DELAY)) * Math.min(1, dt * 8);
      const rt = Date.now() - (o.off || 0) - o.dl; let a = B[0], b = null;
      for (let i = 0; i < B.length - 1; i++) if (B[i].t <= rt && B[i + 1].t >= rt) { a = B[i]; b = B[i + 1]; break; }
      let x, z, vx, vz; if (b) { const u = (rt - a.t) / Math.max(1, b.t - a.t), s1 = (b.t - a.t) / 1000; /* Hermite: positions + velocities, so curves stay round */ const u2 = u * u, u3 = u2 * u, h1 = 2 * u3 - 3 * u2 + 1, h2 = -2 * u3 + 3 * u2, h3 = u3 - 2 * u2 + u, h4 = u3 - u2;
        x = h1 * a.x + h2 * b.x + (h3 * a.vx + h4 * b.vx) * s1; z = h1 * a.z + h2 * b.z + (h3 * a.vz + h4 * b.vz) * s1; vx = (b.x - a.x) / s1; vz = (b.z - a.z) / s1; }
      else { const L = rt < B[0].t ? B[0] : B[B.length - 1]; const cap = extrapSec(o.an, o.dn); const ah = Math.max(0, Math.min(cap, (rt - L.t) / 1000)); x = L.x + L.vx * ah; z = L.z + L.vz * ah; vx = ah < cap ? L.vx : 0; vz = ah < cap ? L.vz : 0; }
      if (o.ix == null || Math.hypot(x - o.ix, z - o.iz) > 8) { o.ix = x; o.iz = z; } else { const k = Math.min(1, dt * 45); o.ix += (x - o.ix) * k; o.iz += (z - o.iz) * k; } o.ivx = vx; o.ivz = vz;
      let yw = null; if (b && a.yaw != null && b.yaw != null) { let dy = b.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yw = a.yaw + dy * Math.max(0, Math.min(1, (rt - a.t) / Math.max(1, b.t - a.t))); } else { const L = B[B.length - 1]; if (L.yaw != null) yw = L.yaw; }
      const sp = Math.hypot(vx, vz); o.iyaw = yw != null ? yw : sp > 0.4 ? Math.atan2(vx, vz) : o.iyaw || 0; }
    function frame(now) {
      if (!alive) return; if (!document.body.contains(cv)) { cleanup(); return; }
      requestAnimationFrame(frame); if (lost || document.hidden) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; frames++; window.__p3.frame++; const c0 = performance.now();
      if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; fpsEl.textContent = fps.toFixed(0) + ' fps'; window.__p3.fps = fps;
        // auto quality from measured FPS: 1) pixel ratio down to 1.0, 2) shadows off, 3) shorter draw distance; climbs back when smooth
        if (fps < 40 && now > 6000) { if (++slow >= 3) { slow = 0; fast = 0; if (DPR * dprK > 1.01) { dprK = Math.max(1 / DPR, dprK - 0.15); applySize(); } else if (sun.castShadow) { sun.castShadow = false; R.shadowMap.enabled = false; qStep = 2; } else if (Q.draw > 110) { Q.draw = Math.round(Q.draw * 0.8); applyDraw(); qStep = 3; } } }
        else { slow = Math.max(0, slow - 1); if (fps > 56 && ++fast >= 8 && dprK < 1) { fast = 0; dprK = Math.min(1, dprK + 0.1); applySize(); } }
        window.__p3.q = { dpr: +(DPR * dprK).toFixed(2), shadows: sun.castShadow, draw: Q.draw, step: qStep, tier: Q.tier, phone: !!Q.phone }; }
      // input -> move relative to the camera
      const mv = W3.move(jv.test ? { x: jv.x, y: jv.y, run: false } : tc.move); if (W3.driving()) jumpQ = false; let ix = mv.x, iz = mv.y; const lk = tc.takeLook(); if (lk.dx || lk.dy) { C.yaw -= lk.dx * 0.008; C.pitch = Math.max(pov ? -0.6 : -0.15, Math.min(pov ? 1.2 : 1.25, C.pitch + lk.dy * 0.006)); }
      if (P.sit && (Math.hypot(ix, iz) > 0.3 || jumpQ)) { const f = P.sit.off; if (f) f(); else P.sit = null; jumpQ = false; ix = iz = 0; } // move/jump = stand up
      const im = Math.min(1, Math.hypot(ix, iz)); const running = runT || mv.run || keys.shift; const sp = (running ? RUN_V : WALK_W) * im;
      if (im > 0.08) { const a = Math.atan2(ix, iz) + C.yaw - Math.PI; const want = Math.atan2(-Math.sin(a), -Math.cos(a)); const mx = Math.sin(want), mz = Math.cos(want);
        let nx = P.x + mx * sp * dt, nz = P.z + mz * sp * dt; [nx, nz] = collide(nx, nz, P.y); P.x = nx; P.z = nz;
        if (!pov) { let dy = want - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P.yaw += dy * Math.min(1, 12 * dt); } else P.yaw = C.yaw + Math.PI; P.d = mx >= 0 ? 1 : -1; dirty = true; if (P.dance !== 'sit' && !(P.dance && P.dance[0] === '~')) { P.dance = ''; P.danceUntil = 0; paintDanceBtn(); } }
      else if (pov) P.yaw = C.yaw + Math.PI;
      // gravity, ground, stairs and slopes
      const fl = floorAt(P.x, P.z, P.y);
      if (jumpQ && P.onGround) { P.vy = JUMP; P.onGround = false; dirty = true; } jumpQ = false;
      P.vy -= GRAV * dt; P.y += P.vy * dt;
      if (P.y <= fl) { if (!P.onGround && P.vy < -2) dirty = true; P.y = fl; P.vy = 0; P.onGround = true; } else if (P.onGround && P.y - fl < 0.35 && P.vy <= 0) { P.y = fl; P.vy = 0; } else P.onGround = false;
      if (!P.onGround && P.y > fl + 0.35) P.onGround = false;
      if (P.sit) { P.x = P.sit.x; P.z = P.sit.z; P.y = P.sit.y; P.yaw = P.sit.yaw; P.vy = 0; P.onGround = true; } // seated on a bed/chair/couch
      if (!P.onGround) dirty = true; // stream the jump arc (send() still caps it at ~4/s)
      if (P.danceUntil && Date.now() > P.danceUntil && P.dance) { P.dance = ''; dirty = true; } // tell others the dance ended
      const aboard = !!(W3.driving && W3.driving()); if (!aboard) { me.position.set(P.x, P.y, P.z); me.rotation.y = P.yaw; }
      // animation on the rig
      const bt = beatNow(); grooveTick(bt); const dancing = P.dance && P.dance[0] !== '~' && Date.now() < P.danceUntil;
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
      svTick(dt); if (Math.hypot(SV.vx, SV.vz) > 18) { recFast += dt; if (recFast >= 0.25) { recFast = 0; recenter(); } } else recFast = 0; const nowMs = Date.now(); if (!(fr % 15) || !drawSet) { const L = [...others.values()].map((o) => [Math.hypot(o.x - P.x, o.z - P.z), o.uid]).sort((a, b) => a[0] - b[0]); drawSet = new Set(L.slice(0, MAX_DRAWN).map((q) => q[1])); } fr++;
      for (const o of others3D()) {
        if (blocked.has(o.uid) || nowMs - o.at > (o.house ? 8000 : STALE_MS)) { drop(o.uid); continue; }
        if (o.obj && o.pal) { const lk = lookKey(o.pal); if (o.objKey && o.objKey !== lk) { scene.remove(o.obj); o.obj = null; } } // re-dress when they change outfit, colours, or accessories
        interp(o, dt); const nearD = Math.hypot((o.ix ?? o.x) - P.x, (o.iz ?? o.z) - P.z); if (!keepRemotePal(drawSet.has(o.uid), o.dn, nearD, LOW)) { o.x = o.ix; o.z = o.iz; if (o.obj) o.obj.visible = false; if (o.tag) o.tag.style.display = 'none'; o.hidAt = o.hidAt || nowMs; if (o.obj && nowMs - o.hidAt > 20000) { scene.remove(o.obj); o.obj = null; o.objKey = null; } continue; } o.hidAt = 0;
        if (!o.obj && o.pal) { try { o.obj = palObj(o.pal, !LOW); o.objKey = lookKey(o.pal); o.obj.userData.uid = o.uid; o.obj.traverse((c) => { c.userData.uid = c.userData.uid || undefined; }); scene.add(o.obj); } catch { o.obj = null; } tagFor(o); }
        const px = o.x, pz = o.z; o.x = o.ix; o.z = o.iz; o.jump = Math.max(o.jump || 0, Math.hypot(o.x - px, o.z - pz)); const mvd = o.buf && o.buf.length ? Math.hypot(o.ivx, o.ivz) : Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3);
        const gy = floorAt(o.x, o.z, o.y + 0.3); const holdY = o.dn === 'sit' || o.dn === 'sleep'; const aimY = o.th != null ? (holdY ? o.th : Math.max(o.th, gy - 0.05)) : gy; o.y += (aimY - o.y) * Math.min(1, dt * 10);
        const riding = inVehicle(o.dn); if (riding && o.iyaw != null) o.yaw = o.iyaw; else if (o.buf && o.buf.length) { let dy = o.iyaw - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 22); } else if (o.tr != null) { let dy = o.tr - o.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); o.yaw += dy * Math.min(1, dt * 22); } else if (mvd > 0.3) o.yaw = Math.atan2(o.x - px, o.z - pz);
        if (!o.obj) continue; const dist = Math.hypot(o.x - P.x, o.z - P.z); const lim = riding ? (LOW ? 90 : 170) : (LOW ? 60 : 110); const showAt = o.obj.userData.on ? lim + 16 : lim - 8; o.obj.userData.on = dist < showAt; if (o.obj.parent === scene) { o.obj.visible = o.obj.userData.on; o.obj.position.set(o.x, o.y, o.z); o.obj.rotation.y = o.yaw; } if (!riding && o.fade < 1 && o.obj.parent === scene) { o.fade = Math.min(1, (o.fade || 0) + dt * 3); o.obj.scale.setScalar(0.2 + 0.8 * o.fade * o.fade * (3 - 2 * o.fade)); }
        const near = dist < (ULTRA ? 30 : LOW ? 12 : 20); o.t += dt * 60; o.lodN = (o.lodN || 0) + 1;
        if (o.obj.visible && (near || o.lodN % (dist > 45 ? 6 : 3) === 0)) { const air = o.th != null && o.th > gy + 0.3 && o.dn !== 'sit'; const dnDance = o.dn && o.dn[0] !== '~' ? o.dn : ''; const od = dnDance || ((o.dance && performance.now() < o.danceUntil) ? o.dance : '');
          const run2 = mvd > 2.6; const g2 = gaitFor(o.obj, mvd, run2); const s2 = { mode: air ? 'hop' : mvd > 0.6 ? (run2 ? 'run' : 'walk') : 'idle', t: o.t, dt60: dt * 60 * (near ? 1 : 3), speed: mvd > 0.6 ? g2.speed : 0, cadence: g2.cadence, stride: g2.stride, extra: run2 ? { cx: 0.22, nx: -0.08 } : null, jumpK: 0.5 }; if (od && mvd < 0.6 && !air) { s2.dance3d = od; s2.beat = bt.beat; s2.amt = 1; } posePal3D(o.obj.userData.m, s2); }
        if (o.shN !== near) { o.shN = near; o.obj.traverse((c) => { if (c.isMesh) c.castShadow = near && !LOW; }); }
        const said = clean(o.say || ''); placeTag(o, o.x, o.y + HEIGHT + 0.35, o.z, muted.has(o.uid) || isHidden(hideKey('park', o.uid, said)) ? '' : said, o.sayAt || 0, !o.obj.visible || dist > (roomState.inId ? 48 : 28)); }
      placeTag(meTag, P.x, P.y + HEIGHT + 0.35, P.z, P.say, P.sayAt, pov && Date.now() - P.sayAt > 7000);
      // treasures & portals
      for (const it of items) { if (found.has(it.id)) continue; it.m.rotation.y += dt * 2; it.m.position.y = ground(it.x, it.z) + 1 + Math.sin(now / 400 + it.x) * 0.15;
        if (Math.hypot(it.x - P.x, it.z - P.z) < 1.3 && Math.abs(P.y + 0.8 - it.m.position.y) < 1.6) { found.add(it.id); it.m.visible = false; lss(tk, JSON.stringify([...found])); paintFound(); dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'park', n: 10, why: 'for a treasure' } })); hint('✨ Treasure found! +10 Star Coins'); } }
      if (portalCd > 0) portalCd -= dt; for (const pt of portals) { pt.disc.material.opacity = 0.45 + Math.sin(now / 300 + pt.x) * 0.15; if (portalCd <= 0 && Math.hypot(pt.x - P.x, pt.z - P.z) < 1.2) { portalCd = 4; if (confirm(`Play ${pt.name}?`)) { location.hash = pt.href; return; } } }
      // world animation
      const tt = now / 1000; wind.value = RM() ? 0 : tt; skyMat.uniforms.t.value = RM() ? 0 : tt; sky.position.copy(cam.position); waterM.uniforms.t.value = tt; hd.update(tt, cam);
      for (let i = 0; i < NSP; i++) { const s = spV[i]; s.life += dt * 0.9; if (s.life > 1) { s.life -= 1; s.a = Math.random() * 6.28; } const l = s.life, r = 0.2 + l * (i % 2 ? 1.5 : 0.9), y = 3.6 + l * 2.6 - l * l * 3.6 * (i % 2 ? 1.2 : 1.6); spP[i * 3] = Math.cos(s.a) * r; spP[i * 3 + 1] = Math.max(0.6, y); spP[i * 3 + 2] = Math.sin(s.a) * r; } spG.attributes.position.needsUpdate = true;
      clouds.position.x = (tt * 0.6) % 120; const pg = window.__p3play; if (pg && !RM()) { pg.userData.seats.forEach((s, i) => (s.rotation.x = Math.sin(tt * 1.6 + i * 1.3) * 0.35)); pg.userData.plank.rotation.z = Math.sin(tt * 0.9) * 0.22; }
      if (window.__p3star) window.__p3star.rotation.y = tt;
      if ((lodT += dt) > 0.6) { lodT = 0; lodTrees(P.x, P.z); } if (now - cullAt > 500) { cullAt = now; parkCull(); } // wall-clock: also right on a stuttering phone
      // shadows follow the player
      sun.target.position.set(P.x, P.y, P.z); sun.position.set(P.x + 40, P.y + 70, P.z + 25);
      if (!aboard) updateCam(dt); send(false);
      { const dv = !!W3.driving(); if (dv !== drvCls) { drvCls = dv; document.body.classList.toggle('p3-drive', dv); } }
      W3.update(dt, now); if (!R.shadowMap.autoUpdate) R.shadowMap.needsUpdate = (++shN % 3) === 0; R.render(scene, cam); const cms = performance.now() - c0; window.__p3.cpu = window.__p3.cpu * 0.95 + cms * 0.05;
      window.__p3.pos = { x: P.x, y: P.y, z: P.z, onGround: P.onGround, mode: st.mode, dance: st.dance3d || '', yaw: P.yaw, pov, cam: cam.position.toArray(), camDist: C.cur, others: others.size, room };
    }
    window.__p3 = { groove: () => { const b = beatNow(); return { on: grooving(), shown: grooveShown, music: b.on, bpm: b.bpm, key: b.key, beat: b.beat, move: grooveMove(b.beat), dn: P.dance, sets: (window.__p3 && window.__p3.grooveSets) || 0 }; }, toggleGroove: () => toggleGroove(), fps: 0, frame: 0, view: viewInfo, cpu: 0, net, oth: others, scene: () => scene, merged: () => mergedInfo, camState: () => ({ yaw: C.yaw, pitch: C.pitch, dist: C.dist }), gfx: () => ({ calls: R.info.render.calls, triangles: R.info.render.triangles, geometries: R.info.memory.geometries, textures: R.info.memory.textures }), extras: () => extras, pos: null, input: (o) => { jv.test = true; if ('x' in o) jv.x = o.x; if ('y' in o) jv.y = o.y; if (o.jump) jumpQ = true; if ('run' in o) runT = o.run; }, toggleCam: () => toggleCam(), othersInfo: () => [...others.values()].map((o) => ({ y: o.y, th: o.th, dn: o.dn, ground: ground(o.x, o.z) })), treeTest: () => { let best = null, bd = 1e9; for (const t of trees) { const d = Math.hypot(t.x - P.x, t.z - P.z); if (d < bd && d > 6) { bd = d; best = t; } } if (!best) return null; const a = Math.atan2(best.x - P.x, best.z - P.z); P.x = best.x - Math.sin(a) * 4; P.z = best.z - Math.cos(a) * 4; P.y = ground(P.x, P.z); C.yaw = a + Math.PI; return { tx: best.x, tz: best.z, r: 0.45 * best.s }; }, emoteDance: (id) => emoteDance(id), teleport: (x, z, y) => { P.x = x; P.z = z; P.y = (y ?? ground(x, z)) + 0.1; dirty = true; }, colliders: () => ({ cyl: cyl.length, box: box.length }), ground, STUDIO, PLAY, HUB, portals: () => portals.map((p) => ({ id: p.id, x: p.x, z: p.z })), emote, say: (t) => say(t), setYaw: (y) => { C.yaw = y; }, dance: () => P.dance };
    requestAnimationFrame(frame); cv.focus({ preventScroll: true });
    const bye = () => { deleteDoc(meRef).catch(() => {}); };
    addEventListener('beforeunload', bye); addEventListener('pagehide', bye);
    function cleanup() { if (!alive) return; alive = false; removeEventListener('kemy:pal-changed', onPal); try { unWorld(); } catch { /* */ } try { W3.destroy(); } catch { /* */ } unsub(); bye(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); unhookSize(); removeEventListener('beforeunload', bye); removeEventListener('pagehide', bye);
      document.body.classList.remove('p3-on', 'p3-drive'); tc?.destroy(); try { scene.traverse((o) => { o.geometry?.dispose?.(); }); R.dispose(); R.forceContextLoss?.(); } catch { /* */ } delete window.__p3star; delete window.__p3play; }
    stop = cleanup;
  }
  return { page };
}
