// Pal Zombie Survival: a kid-safe 3D wave-survival game. You play as your own Pal (saved outfit + Armory armor)
// in a foggy night arena and splat goofy green zombies with goo, foam, bubbles, frost and a pillow hammer.
// No blood or gore: defeated zombies poof into sparkles and goo. Diamonds (💎) are paid once per run (capped
// server-side), score + best wave go to the scoreboard. Shared touch controls (js/controls.js).
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { palRig, gfxLevel } from './pal3d.js';
import { getActivePal } from './core.js';
import { createControls, buzz } from '../controls.js';
import { ARM, createDiamonds, equippedArmor, RUN_CAP } from './armory.js';
import { createEconomy } from './economy.js';
import { ZTABS, zSayIdx, zEmoteIdx, zEmoteOf, zText } from './zombie-net.js';
import { openWheel, renderQuickChat, loadOwnedEmotes } from './emote-wheel.js';
import { emoteMs } from './emotes.js';
import { clipFor } from './dances3d.js';
const EBEAT = () => performance.now() / 1000 * 116 / 60; // emotes dance at a steady 116 BPM in the game
import { gfxPreset, makeRenderer, dprFor, makeSky, envFromSky, proceduralTex, mergeGeos, attachGfxSettings, showFps as gfxShowFps } from '../gfx.js';
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const WEAPONS = {
  goo: { name: 'Goo Blaster', icon: '🟢', rate: 0.16, dmg: 12, spd: 30, ammo: 30, rel: 1.1, col: 0x6dff5a, r: 0.16, free: 1 },
  foam: { name: 'Foam Launcher', icon: '🧽', rate: 0.5, dmg: 11, spd: 24, ammo: 12, rel: 1.3, col: 0xffb347, r: 0.2, spread: 3, item: 'z_foam' },
  bubble: { name: 'Bubble Cannon', icon: '🫧', rate: 0.7, dmg: 30, spd: 11, ammo: 8, rel: 1.6, col: 0x8fd8ff, r: 0.45, pierce: 1, lift: 1, item: 'z_bubble' },
  freeze: { name: 'Freeze Ray', icon: '❄️', rate: 0.07, dmg: 4, spd: 40, ammo: 70, rel: 1.4, col: 0xbff4ff, r: 0.12, freeze: 1, item: 'z_freeze' },
  hammer: { name: 'Pillow Hammer', icon: '🛏️', rate: 0.45, dmg: 36, melee: 1, free: 1 }
};
const ZTYPES = ['walk', 'run', 'chonk', 'boss'];
const ZT = { // zombie types
  walk: { hp: 30, spd: 1.7, sc: 1, col: 0x7ccf5a, pts: 10, dia: 1 },
  run: { hp: 18, spd: 3.3, sc: 0.8, col: 0xb6f04a, pts: 15, dia: 1 },
  chonk: { hp: 90, spd: 1.1, sc: 1.45, col: 0x4fb59a, pts: 30, dia: 2 },
  boss: { hp: 420, spd: 1.3, sc: 2.6, col: 0x9a6bd6, pts: 300, dia: 15 }
};
const ARENA = 27, MAXZ = 40, MAXP = 90, MAXFX = 700;
let audioCtx = null; const LOD = new Map();
function snd(kind) { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const a = audioCtx, t = a.currentTime, o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
  o.connect(f); f.connect(g); g.connect(a.destination); f.type = 'lowpass'; f.frequency.value = 2400;
  const P = { pew: ['square', 700, 300, 0.07, 0.05], foam: ['triangle', 300, 160, 0.12, 0.07], bub: ['sine', 500, 900, 0.18, 0.08], ice: ['sawtooth', 1400, 1200, 0.05, 0.02], bonk: ['triangle', 220, 90, 0.15, 0.12],
    poof: ['sine', 900, 1800, 0.18, 0.08], groan: ['sawtooth', rnd(110, 160), rnd(70, 95), rnd(0.5, 0.8), 0.05], hurt: ['square', 240, 160, 0.15, 0.06], pick: ['sine', 880, 1760, 0.15, 0.08], boom: ['sawtooth', 160, 40, 0.5, 0.12], wave: ['triangle', 523, 1046, 0.4, 0.08] }[kind];
  if (!P) return; o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
  if (kind === 'groan') { f.frequency.value = 700; const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = 7; lg.gain.value = 18; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + P[3]); }
  g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(0.001, t + P[3]); o.start(t); o.stop(t + P[3] + 0.02); } catch { /* no audio */ } }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const CSS = `.zg{position:fixed;inset:0;z-index:900;background:#140f2e;overflow:hidden;touch-action:none;font-family:system-ui,sans-serif;color:#fff}.zg canvas.zv{position:absolute;inset:0;width:100%;height:100%;display:block}
.zg-hud{position:absolute;left:0;right:112px;top:0;padding:max(8px,env(safe-area-inset-top)) 10px 0;display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start;pointer-events:none;z-index:6}
.zg-hp{width:min(46vw,200px);height:18px;border-radius:99px;background:rgba(0,0,0,.45);border:2px solid #fff;overflow:hidden}.zg-hp i{display:block;height:100%;background:linear-gradient(90deg,#ff6b9a,#ffb3c9);transition:width .15s}
.zg-pill{background:rgba(0,0,0,.45);border-radius:99px;padding:3px 10px;font-weight:800;font-size:14px;white-space:nowrap}.zg-col{display:flex;flex-direction:column;gap:5px}
.zg-tb{position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 56px);right:8px;display:flex;flex-direction:column;gap:6px;z-index:7}.zg-tb button{width:48px;height:48px;border-radius:50%;border:0;background:rgba(0,0,0,.4);color:#fff;font-size:20px}
.zg-msg{position:absolute;left:50%;top:28%;transform:translate(-50%,-50%);font-size:clamp(26px,7vw,48px);font-weight:900;text-shadow:0 4px 0 #2b1d55,0 0 18px #6dff5a;text-align:center;pointer-events:none;z-index:6;transition:opacity .4s}
.zg-boss{position:absolute;left:50%;top:calc(max(8px,env(safe-area-inset-top)) + 118px);transform:translateX(-50%);width:min(70vw,380px);z-index:6;text-align:center;font-weight:800;pointer-events:none}.zg-boss div{height:12px;border-radius:99px;background:rgba(0,0,0,.5);overflow:hidden;border:2px solid #fff}.zg-boss i{display:block;height:100%;background:#b48cff}
.zg-cross{position:absolute;left:50%;top:46%;width:26px;height:26px;margin:-13px;border:3px solid rgba(255,255,255,.85);border-radius:50%;pointer-events:none;z-index:6;transition:transform .1s}.zg-cross.lock{border-color:#ffd23f;transform:scale(.75)}
.zg-panel{position:absolute;inset:0;z-index:10;background:rgba(15,8,40,.82);display:flex;align-items:center;justify-content:center;padding:16px}.zg-card{background:#2b1d55;border-radius:22px;padding:22px;max-width:420px;width:100%;text-align:center}
.zg-card h2{margin:0 0 6px;font-size:28px}.zg-card .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}.zg-card button,.zg-card a{min-height:56px;padding:0 22px;border-radius:16px;border:0;font-size:18px;font-weight:800;background:#ffd23f;color:#2b1d55;text-decoration:none;display:inline-flex;align-items:center}
.zg-card .ghost{background:rgba(255,255,255,.15);color:#fff}.zg-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.zg-stats div{background:rgba(255,255,255,.1);border-radius:12px;padding:8px}.zg-stats b{display:block;font-size:22px}
.zg-team{position:absolute;left:10px;top:calc(max(8px,env(safe-area-inset-top)) + 96px);z-index:6;display:flex;flex-direction:column;gap:4px;pointer-events:none;font-size:13px;font-weight:800}.zg-team div{background:rgba(0,0,0,.45);border-radius:10px;padding:3px 8px;min-width:120px}.zg-team i{display:block;height:6px;border-radius:9px;background:#7ee08a;margin-top:2px}.zg-team .dn{color:#ffb3c9}
.zg-emo{position:absolute;right:62px;top:calc(max(8px,env(safe-area-inset-top)) + 56px);z-index:8;display:grid;grid-template-columns:1fr 1fr;gap:6px}.zg-emo button{min-height:48px;padding:0 12px;border-radius:14px;border:0;background:rgba(43,29,85,.92);color:#fff;font-weight:800;font-size:15px}.zg-emo{display:block;width:min(340px,80vw);background:rgba(27,18,51,.94);padding:8px;border-radius:16px}.zg-emo .qc-list button{min-height:42px;background:#fff;color:#2b1d55}
.zg-rev{position:absolute;left:50%;top:58%;width:160px;height:14px;margin-left:-80px;border-radius:99px;background:rgba(0,0,0,.5);border:2px solid #fff;z-index:6;overflow:hidden}.zg-rev i{display:block;height:100%;width:0;background:#7ee08a}
.zg-dmg{position:absolute;inset:0;pointer-events:none;box-shadow:inset 0 0 80px rgba(255,80,160,.0);transition:box-shadow .2s;z-index:5}`;
export function createZombieGame(ctx) {
  const { S, db, toast } = ctx;
  let G = null;
  async function open(o = {}) {
    if (G) G.quit(true);
    if (!document.getElementById('zg-css')) { const s = document.createElement('style'); s.id = 'zg-css'; s.textContent = CSS; document.head.appendChild(s); }
    const uid = S.user.uid; let pal = o.pal || null; if (!pal) try { pal = await getActivePal(db, uid); } catch { /* */ }
    if (!pal) { toast('Hatch a Pal first, then come back to play!'); location.hash = '#/pals'; return; }
    let inv = o.inv || {}; if (db) try { inv = await createEconomy(db, uid).inventory(true); } catch { /* offline: free gear only */ }
    G = game({ pal, inv, uid, net: o.net || null, name: o.name || '' }); return G;
  }
  function game({ pal, inv, uid, net, name }) {
    const coop = !!net; const isHost = () => !net || net.isHost();
    const has = (id) => !!inv[id];
    const up = { dmg: has('z_dmg') ? 1.25 : 1, hp: has('z_hp') ? 130 : 100, spd: has('z_speed') ? 1.15 : 1, ammo: has('z_ammo') ? 1.5 : 1 };
    const armorId = equippedArmor() && has(equippedArmor()) ? equippedArmor() : ''; const armor = armorId ? ARM[armorId].armor : 0;
    const owned = Object.keys(WEAPONS).filter((k) => WEAPONS[k].free || has(WEAPONS[k].item)); const starBomb = has('z_star');
    const Q = gfxPreset(); const low = Q.tier === 'low'; void gfxLevel; // shared Graphics setting (js/gfx.js)
    // ------------------------------------------------------------ DOM
    const el = document.createElement('div'); el.className = 'zg'; el.innerHTML = `<canvas class="zv"></canvas><div class="zg-dmg"></div><div class="zg-cross"></div>
      <div class="zg-hud"><div class="zg-col"><div class="zg-hp"><i></i></div><span class="zg-pill" data-h="wpn"></span></div><div class="zg-col"><span class="zg-pill" data-h="wave">Wave 1</span><span class="zg-pill" data-h="score">0</span></div><div class="zg-col"><span class="zg-pill" data-h="dia">💎 0</span><span class="zg-pill" data-h="pu" hidden></span></div></div>
      <div class="zg-tb"><button type="button" data-t="pov" aria-label="Switch camera">👁️</button><button type="button" data-t="pause" aria-label="Pause">⏸️</button><button type="button" data-t="wheel" aria-label="Emote wheel">😊</button>${coop ? '<button type="button" data-t="chat" aria-label="Quick chat">💬</button>' : ''}</div>
      <div class="zg-team" ${coop ? '' : 'hidden'}></div><div class="zg-emo" hidden></div><div class="zg-rev" hidden><i></i></div>
      <div class="zg-boss" hidden><span>👑 Big Boss Zombie</span><div><i></i></div></div><div class="zg-msg"></div>`;
    document.body.appendChild(el); document.documentElement.style.overflow = 'hidden';
    const $ = (s) => el.querySelector(s), H = (k) => el.querySelector(`[data-h="${k}"]`);
    const cv = $('canvas.zv');
    // ------------------------------------------------------------ renderer + scene
    const R = makeRenderer(cv, { ...Q, dpr: Math.min(Q.dpr, 2) }, { exposure: 1.1 }); // full-screen action game: pixel ratio capped at 2
    let pr = dprFor({ dpr: Math.min(Q.dpr, 2) }); let prMax = pr; const prMin = Math.min(pr, 1);
    // cosy twilight (kid-friendly, not dark): gradient dusk sky with a big moon glow + soft clouds, light haze only far away
    const scene = new THREE.Scene(); const FOG = new THREE.Color('#9d8fd6'); scene.fog = new THREE.Fog(FOG, 30, 30 + Q.draw * 0.3);
    const sky = makeSky({ sunDir: new THREE.Vector3(-0.55, 0.32, -0.75), top: '#3b3194', hor: '#f3a9c9', ground: '#5c7a63', sun: '#fff1c8', cloud: low ? 0.35 : 0.45, cloudCol: '#ffd9ec', radius: 110 }); scene.add(sky);
    scene.environment = envFromSky(R, sky); scene.environmentIntensity = 0.3;
    const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 130);
    const resize = () => { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 72 : 60; cam.updateProjectionMatrix(); }; resize(); addEventListener('resize', resize);
    scene.add(new THREE.HemisphereLight(0xd8d0ff, 0x46704f, 1.35));
    const moon = new THREE.DirectionalLight(0xffe6d2, 2.2); moon.position.set(-14, 22, -10); scene.add(moon);
    if (Q.shadows) { moon.castShadow = true; moon.shadow.mapSize.set(Math.min(Q.shadowMap, 2048), Math.min(Q.shadowMap, 2048)); const sc = moon.shadow.camera; sc.left = sc.bottom = -36; sc.right = sc.top = 36; sc.near = 1; sc.far = 80; moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.04; }
    const L = (m, c = 0xffffff) => new THREE.MeshLambertMaterial({ color: c, ...m });
    // ground
    const SOIL = proceduralTex('soil', Q, [26, 26]), PATH = proceduralTex('path', Q, [40, 1]), ROCK = proceduralTex('rock', Q, [1, 1]), BARK = proceduralTex('bark', Q, [2, 1]), LEAF = proceduralTex('leaf', Q, [5, 3]);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshLambertMaterial({ color: 0x5f9a58, map: SOIL.map, normalMap: SOIL.normalMap })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const path = new THREE.Mesh(new THREE.RingGeometry(ARENA - 1.2, ARENA + 0.6, 96, 1), new THREE.MeshLambertMaterial({ color: 0xb38d69, map: PATH.map, normalMap: PATH.normalMap })); path.rotation.x = -Math.PI / 2; path.position.y = 0.01; path.receiveShadow = true; scene.add(path);
    { const u = path.geometry.attributes.uv, pp = path.geometry.attributes.position; for (let k = 0; k < u.count; k++) { const a = Math.atan2(pp.getY(k), pp.getX(k)); u.setXY(k, a / (Math.PI * 2) + 0.5, Math.hypot(pp.getX(k), pp.getY(k)) > ARENA - 0.3 ? 1 : 0); } }
    // grass tufts (instanced, wind sway; decoration only)
    const zWind = { value: 0 };
    { const n = Math.round(9000 * Q.grass); const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.05, 0, 0, 0.05, 0, 0, -0.03, 0.14, 0.015, 0.03, 0.14, 0.015, 0, 0.34, 0.07]), 3)); bg.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
      bg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(Array.from({ length: 5 }, () => [0, 1, 0]).flat()), 3));
      const gm = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }); gm.onBeforeCompile = (sh) => { sh.uniforms.wind = zWind; sh.vertexShader = 'uniform float wind; varying float vGy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vec3 ip = instanceMatrix[3].xyz; float k = position.y * 2.; transformed.x += sin(wind * 1.6 + ip.x * .4 + ip.z * .3) * .12 * k; vGy = position.y;');
        sh.fragmentShader = 'varying float vGy;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(.6, 1.0, smoothstep(0., .34, vGy));').replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);'); };
      const gi = new THREE.InstancedMesh(bg, gm, n); const o = new THREE.Object3D(), c = new THREE.Color(); for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 52; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.abs(r - ARENA) < 1.6) { o.position.set(0, -9, 0); } else o.position.set(x, 0, z); o.rotation.y = Math.random() * TAU; o.scale.setScalar(0.7 + Math.random() * 0.8); o.updateMatrix(); gi.setMatrixAt(k, o.matrix); gi.setColorAt(k, c.setHSL(0.26 + Math.random() * 0.07, 0.6 + Math.random() * 0.2, 0.25 + Math.random() * 0.1)); }
      gi.frustumCulled = false; scene.add(gi); }
    // moon sprite
    const moonS = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#fff3b0'); g.addColorStop(0.5, 'rgba(255,240,170,.35)'); g.addColorStop(1, 'rgba(255,240,170,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); }), fog: false, depthWrite: false }));
    moonS.scale.set(16, 16, 1); moonS.position.set(-40, 34, -50); scene.add(moonS);
    // decor (instanced): gravestones ring, trees, glowing pumpkins, lamp posts with point lights
    const inst = (geo, mat, list, fn) => { const m = new THREE.InstancedMesh(geo, mat, list.length); const o = new THREE.Object3D(); list.forEach((p, i) => { fn(o, p, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); scene.add(m); return m; };
    const ring = (n, r0, r1) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + rnd(-0.1, 0.1), r = rnd(r0, r1); return [Math.cos(a) * r, Math.sin(a) * r, a]; });
    const graves = ring(22, ARENA + 1.5, ARENA + 3); inst(new THREE.CapsuleGeometry(0.55, 0.7, 4, 12), L({ map: ROCK.map, normalMap: ROCK.normalMap }, 0xd6d0ee), graves, (o, p) => { o.position.set(p[0], 0.6, p[1]); o.rotation.set(0, -p[2] + Math.PI / 2, rnd(-0.15, 0.15)); o.scale.set(1, 1, 0.35); });
    const trees = ring(low ? 26 : 40, ARENA + 5, 48); const pineG = (() => { const ps = []; for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(1.75 - i * 0.36, 1.9, 16, 2); const q = g.attributes.position; for (let v = 0; v < q.count; v++) { const x = q.getX(v), z = q.getZ(v); const j2 = 1 + Math.sin(Math.atan2(z, x) * 8 + i) * 0.07; q.setXYZ(v, x * j2, q.getY(v) - Math.hypot(x, z) * 0.12, z * j2); } g.computeVertexNormals(); g.rotateY(i * 0.8); g.translate(0, 1.6 + i * 1.05, 0); ps.push(g); } return mergeGeos(ps); })();
    const treeIM = inst(pineG, L({ map: LEAF.map, normalMap: LEAF.normalMap }, 0xffffff), trees, (o, p) => { o.position.set(p[0], 0, p[1]); o.rotation.y = p[2] * 5; o.scale.setScalar(0.8 + ((p[2] * 1000) % 1) * 0.7); });
    { const tc = new THREE.Color(); const TC = [0x2f8a6a, 0x3a9a72, 0x2c7a6e, 0x5aa86a]; trees.forEach((_, i) => treeIM.setColorAt(i, tc.set(TC[i % TC.length]))); treeIM.castShadow = Q.shadows; }
    inst(new THREE.CylinderGeometry(0.2, 0.32, 1.6, 10), L({ map: BARK.map, normalMap: BARK.normalMap }, 0x7a5a44), trees, (o, p) => { o.position.set(p[0], 0.6, p[1]); });
    const pumps = ring(12, ARENA - 4, ARENA - 2);
    inst(new THREE.SphereGeometry(0.5, 10, 8), L({ emissive: 0xff7a00, emissiveIntensity: 0.55 }, 0xff8c1a), pumps, (o, p) => { o.position.set(p[0], 0.3, p[1]); o.scale.set(0.9, 0.65, 0.9); });
    const lamps = [[10, 10], [-10, 10], [10, -10], [-10, -10]].slice(0, low ? 2 : 4);
    inst(new THREE.CylinderGeometry(0.12, 0.15, 3.4, 6), L({}, 0x2a2440), lamps, (o, p) => o.position.set(p[0], 1.7, p[1]));
    inst(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a3 }), lamps, (o, p) => o.position.set(p[0], 3.5, p[1]));
    lamps.forEach(([x, z], i) => { const l = new THREE.PointLight(i % 2 ? 0xffb86b : 0x9dffb0, 18, 16, 1.6); l.position.set(x, 3.3, z); scene.add(l); });
    // blob shadows
    const blobTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }); const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    // ------------------------------------------------------------ player (your Pal)
    const look = { ...pal, outfit: { ...(pal.outfit || {}) } }; delete look.outfit.held; // rings (left paw) stay on: the blaster is in the right paw
    const rig = palRig(look); const P3 = rig.obj; const pr0 = new THREE.Group(); pr0.add(P3); scene.add(pr0);
    P3.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { const m = o.material; o.material = new THREE.MeshLambertMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, side: m.side }); m.dispose(); } o.castShadow = false;
      if (o.isMesh && o.geometry && o.geometry.parameters) { const g = o.geometry, q0 = g.parameters, k = g.type + JSON.stringify(q0); let n = LOD.get(k); // lighter copies for a full-screen phone game
        if (!n) { if (g.type === 'SphereGeometry') n = new THREE.SphereGeometry(q0.radius, 18, 12, q0.phiStart, q0.phiLength, q0.thetaStart, q0.thetaLength); else if (g.type === 'CapsuleGeometry') n = new THREE.CapsuleGeometry(q0.radius, q0.length, 4, 12);
          else if (g.type === 'ConeGeometry') n = new THREE.ConeGeometry(q0.radius, q0.height, 12, 1, q0.openEnded); else if (g.type === 'CylinderGeometry') n = new THREE.CylinderGeometry(q0.radiusTop, q0.radiusBottom, q0.height, Math.min(q0.radialSegments, 12), 1, q0.openEnded); else if (g.type === 'TorusGeometry') n = new THREE.TorusGeometry(q0.radius, q0.tube, 6, Math.min(q0.tubularSegments, 16), q0.arc); if (n) LOD.set(k, n); }
        if (n) o.geometry = n; } });
    { const b = new THREE.Box3().setFromObject(P3); const h = b.max.y - b.min.y || 1; pr0.scale.setScalar(1.45 / h); }
    const J = P3.userData.J; const pShadow = new THREE.Mesh(blobGeo, blobMat); pShadow.scale.setScalar(1.3); scene.add(pShadow);
    pr0.updateMatrixWorld(true); const ws = (b) => 1 / b.getWorldScale(new THREE.Vector3()).x; // armor sized in world units (~Pal torso)
    if (armorId) { const a = ARM[armorId]; const m = L({ transparent: true, opacity: 0.92 }, a.col); const s = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), m); const k0 = ws(J.Chest); s.scale.set(0.62 * k0, 0.55 * k0, 0.55 * k0); s.position.y = 0.02 * k0; J.Chest.add(s);
      if (armorId === 'z_arm_astro') { const v = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28 })); v.scale.setScalar(ws(J.Head)); J.Head.add(v); }
      if (armorId === 'z_arm_card') { const hlm = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.2, 8), m); const kh = ws(J.Head); hlm.scale.setScalar(kh * 0.7); hlm.position.y = 0.3 * kh; J.Head.add(hlm); } }
    const gun = new THREE.Group(); J.RightHand.add(gun); gun.position.set(0, -0.12, 0.08); gun.rotation.x = -1.1;
    const paintGun = () => { gun.clear(); const w = WEAPONS[cur]; const c = w.melee ? 0xffc7e6 : w.col;
      if (w.melee) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), L({}, 0xb48cff)); h.position.y = 0.25; gun.add(h); const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), L({}, c)); p.position.y = 0.52; gun.add(p); }
      else { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8), L({}, 0x6a4bc4)); b.position.y = 0.22; gun.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), L({ emissive: c, emissiveIntensity: 0.5 }, c)); t.position.y = 0.05; gun.add(t); } gun.scale.setScalar(1.6); };
    // ------------------------------------------------------------ zombies (instanced body parts, ~7 draw calls total)
    const zMatSkin = L({ emissive: 0x2a5a1a, emissiveIntensity: 0.6 }), zMatW = new THREE.MeshBasicMaterial({ color: 0xffffff }), zMatK = new THREE.MeshBasicMaterial({ color: 0x1b1030 }), zMatCloth = L({ emissive: 0x221a44, emissiveIntensity: 0.5 });
    const PARTS = [ // geometry, material, local transform [x,y,z, sx,sy,sz], colored by type?
      ['body', new THREE.CapsuleGeometry(0.42, 0.55, 4, 10), zMatCloth, [0, 0.78, 0, 1, 1, 0.85], 1],
      ['head', new THREE.SphereGeometry(0.42, 12, 10), zMatSkin, [0, 1.62, 0.03, 1, 0.95, 1], 2],
      ['armL', new THREE.CapsuleGeometry(0.12, 0.55, 3, 6), zMatSkin, [0.42, 1.12, 0.36, 1, 1, 1], 2],
      ['armR', new THREE.CapsuleGeometry(0.12, 0.55, 3, 6), zMatSkin, [-0.42, 1.12, 0.36, 1, 1, 1], 2],
      ['eyeL', new THREE.SphereGeometry(0.15, 8, 6), zMatW, [0.16, 1.72, 0.36, 1, 1.15, 0.6], 0],
      ['eyeR', new THREE.SphereGeometry(0.11, 8, 6), zMatW, [-0.17, 1.68, 0.37, 1, 1, 0.6], 0],
      ['pupL', new THREE.SphereGeometry(0.06, 6, 5), zMatK, [0.18, 1.7, 0.47, 1, 1, 0.6], 0],
      ['pupR', new THREE.SphereGeometry(0.05, 6, 5), zMatK, [-0.15, 1.69, 0.46, 1, 1, 0.6], 0],
      ['mouth', new THREE.TorusGeometry(0.1, 0.035, 5, 10, Math.PI), zMatK, [0, 1.5, 0.4, 1.2, 1, 1], 0],
      ['blob', blobGeo, blobMat, [0, 0.02, 0, 1.4, 1, 1.4], 0]
    ];
    const ZI = PARTS.map(([n, g, m, t, colored]) => { const im = new THREE.InstancedMesh(g, m, MAXZ); im.count = 0; im.frustumCulled = false; if (colored) im.setColorAt(0, new THREE.Color()); scene.add(im);
      const lm = new THREE.Matrix4().compose(new THREE.Vector3(t[0], t[1], t[2]), n.startsWith('arm') ? new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.35, 0, 0)) : n === 'mouth' ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)) : new THREE.Quaternion(), new THREE.Vector3(t[3], t[4], t[5])); return { n, im, lm, colored }; });
    const hat = new THREE.Group(); { const m = L({}, 0x2b1d55); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12), m); a.position.y = 0.25; hat.add(a); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), m); hat.add(b); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), L({}, 0xffd23f)); band.position.y = 0.08; hat.add(band); } hat.visible = false; scene.add(hat);
    const slamRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9dff6a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); slamRing.visible = false; scene.add(slamRing);
    // projectiles
    const projIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), MAXP); projIM.count = 0; projIM.frustumCulled = false; projIM.setColorAt(0, new THREE.Color()); scene.add(projIM);
    const bombM = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0xffe14a })); bombM.visible = false; scene.add(bombM);
    // sparkle / goo particles
    const fxPos = new Float32Array(MAXFX * 3).fill(-999), fxCol = new Float32Array(MAXFX * 3), fxV = new Float32Array(MAXFX * 3), fxL = new Float32Array(MAXFX); let fxI = 0;
    const fxG = new THREE.BufferGeometry(); fxG.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxG.setAttribute('color', new THREE.BufferAttribute(fxCol, 3));
    const starTex = canvasTex(64, 64, (c) => { c.translate(32, 32); c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 11 : 30, a = (i / 10) * TAU - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); });
    const fx = new THREE.Points(fxG, new THREE.PointsMaterial({ size: 0.42, map: starTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fx.frustumCulled = false; scene.add(fx);
    const tmpC = new THREE.Color(), skinC = new THREE.Color(), clothC = new THREE.Color();
    function burst(x, y, z, n, cols, sp = 4) { for (let i = 0; i < n; i++) { const k = fxI = (fxI + 1) % MAXFX; fxPos[k * 3] = x; fxPos[k * 3 + 1] = y; fxPos[k * 3 + 2] = z; const a = Math.random() * TAU, u = rnd(-1, 1), s = rnd(0.4, 1) * sp;
      fxV[k * 3] = Math.cos(a) * Math.sqrt(1 - u * u) * s; fxV[k * 3 + 1] = Math.abs(u) * s + 1.5; fxV[k * 3 + 2] = Math.sin(a) * Math.sqrt(1 - u * u) * s; fxL[k] = rnd(0.5, 1.1); tmpC.set(cols[i % cols.length]); fxCol[k * 3] = tmpC.r; fxCol[k * 3 + 1] = tmpC.g; fxCol[k * 3 + 2] = tmpC.b; } }
    // power-ups
    const PU = { heart: ['💖', 0xff6b9a], ammo: ['🔋', 0x6dff5a], zoom: ['👟', 0x8fd8ff], shield: ['🛡️', 0xffd23f], dia2: ['💎', 0x7fe3ff] };
    const puMeshes = Object.fromEntries(Object.entries(PU).map(([k, [, c]]) => { const m = new THREE.Mesh(k === 'dia2' ? new THREE.OctahedronGeometry(0.35) : k === 'heart' ? new THREE.SphereGeometry(0.3, 10, 8) : new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ color: c })); return [k, m]; }));
    const shieldM = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false })); shieldM.visible = false; scene.add(shieldM);
    // ------------------------------------------------------------ state
    let cur = 'goo'; const ammo = {}; owned.forEach((k) => (ammo[k] = Math.round((WEAPONS[k].ammo || 0) * up.ammo)));
    const me = { down: false, rev: '', em: -1, emAt: 0, x: coop ? rnd(-3, 3) : 0, z: 4, y: 0, vy: 0, yaw: Math.PI, face: Math.PI, hp: up.hp, inv: 0, dodge: 0, dodgeCd: 0, dx: 0, dz: 0, fireCd: 0, reload: 0, swing: 0, t: 0, bombs: starBomb ? 3 : 0 };
    let zid = 0, teamN = coop ? Math.max(1, Math.min(4, (net.state && net.state.n) || Object.keys(net.players).length || 1)) : 1, kmap = {}, dmap = {}, hitSeq = 0, myHits = [], slamSeq = 0, sendT = 0, stateT = 0, migT = 0, revT = 0, downT = 0, wipeT = 0, lastWaveSeen = 0;
    const team = new Map();
    let pitch = 0.32, pov = false, zs = [], projs = [], pickups = [], bomb = null, wave = 0, toSpawn = 0, spawnT = 0, breakT = 2.5, score = 0, kills = 0, dias = 0, over = false, paused = false, buffs = { zoom: 0, shield: 0, dia2: 0 }, boss = null, msgT = 0, lastGroan = 0;
    const dbg = { fps: 0, frames: 0 }; window.__zombie = { get state() { return { wave, score, kills, dias, hp: Math.round(me.hp), down: me.down, zombies: zs.length, fps: dbg.fps, pr, over, weapon: cur, coop, host: isHost(), team: [...team.values()].map((t) => ({ name: t.name, hp: Math.round(t.hp), down: t.down, x: +t.x.toFixed(1), z: +t.z.toFixed(1), emo: performance.now() < (t.emoUntil || 0) ? t.emo : '', em: t.emSeen })), emo: performance.now() < (me.emoUntil || 0) ? me.emo : '' }; }, game: null };
    const msg = (t, s = 1.6) => { const m = $('.zg-msg'); m.innerHTML = t; m.style.opacity = 1; msgT = s; };
    // ------------------------------------------------------------ controls
    const C = createControls(el, { tutorialKey: 'zombie', tutorialTitle: '🧟 Pal Zombie Survival',
      tips: ['👈 Thumb anywhere on the left: walk (push far to run)', '👉 Drag on the right: look & aim (gentle aim assist helps)', '🎯 Hold <b>Fire</b> to keep shooting', '🦘 Jump over the boss’s goo wave · 💨 Dodge to zip away', '🔁 Swap weapons · ⭐ Star Bomb / reload', 'Zombies are just silly. Splat them into sparkles!'],
      buttons: [{ id: 'fire', icon: '🎯', label: 'Fire', big: 1 }, { id: 'jump', icon: '🦘', label: 'Jump' }, { id: 'dodge', icon: '💨', label: 'Dodge' }, { id: 'switch', icon: '🔁', label: 'Swap' }, { id: 'special', icon: starBomb ? '⭐' : '🔄', label: starBomb ? 'Bomb' : 'Reload' }],
      keys: { ' ': 'jump', f: 'fire', Enter: 'fire', q: 'switch', e: 'special', r: 'special', c: 'dodge', Control: 'dodge' } });
    C.on('jump', () => { if (me.y <= 0.001 && !over && !me.down) { me.vy = 7.2; } });
    C.on('dodge', () => { if (me.dodgeCd <= 0 && !over) { const m = C.move; let dx = m.mag ? 0 : Math.sin(me.face), dz = m.mag ? 0 : Math.cos(me.face); if (m.mag) { const f = fwd(); dx = f[0] * -m.y + -f[1] * m.x; dz = f[1] * -m.y + f[0] * m.x; } const l = Math.hypot(dx, dz) || 1; me.dx = dx / l; me.dz = dz / l; me.dodge = 0.28; me.dodgeCd = 1.1; me.inv = Math.max(me.inv, 0.4); burst(me.x, 0.4, me.z, 10, ['#ffffff', '#bff4ff'], 2); } });
    C.on('switch', () => { const i = owned.indexOf(cur); cur = owned[(i + 1) % owned.length]; me.reload = 0; paintGun(); hud(); });
    C.on('special', () => { if (reviveTarget()) return; if (starBomb && me.bombs > 0 && !bomb) throwBomb(); else startReload(); });
    // mouse look on desktop: drag anywhere on the right half is handled by controls; also allow pointer-lock-free mouse drag
    $('[data-t="pov"]').onclick = () => { pov = !pov; };
    $('[data-t="pause"]').onclick = () => pause(true);
    C.on('settings:open', () => (paused = true)); C.on('settings:closed', () => (paused = false));
    attachGfxSettings(C, () => { const q = gfxPreset(); prMax = dprFor({ dpr: Math.min(q.dpr, 2) }); pr = prMax; R.setPixelRatio(pr); resize(); R.shadowMap.enabled = q.shadows; moon.castShadow = q.shadows && !!Q.shadows; fpsTag.hidden = !gfxShowFps(); }); // live: sharpness, shadows, FPS (grass/AA apply next game)
    const fpsTag = document.createElement('span'); fpsTag.className = 'zg-pill'; fpsTag.style.cssText = 'position:absolute;left:50%;top:calc(env(safe-area-inset-top) + 8px);transform:translateX(-50%);font-variant-numeric:tabular-nums;z-index:5;pointer-events:none'; fpsTag.hidden = !gfxShowFps(); el.appendChild(fpsTag);
    const fwd = () => [Math.sin(me.yaw), Math.cos(me.yaw)];
    // ------------------------------------------------------------ gameplay
    function startReload() { const w = WEAPONS[cur]; if (w.melee || me.reload > 0 || ammo[cur] >= Math.round(w.ammo * up.ammo)) return; me.reload = w.rel / (has('z_ammo') ? 1.25 : 1); }
    function aimDir() { // gentle aim assist: nearest zombie within ~14° of the camera forward
      const [fx0, fz0] = fwd(); let best = null, bd = 0.42;
      for (const z of zs) { if (z.rise > 0) continue; const dx = z.x - me.x, dz = z.z - me.z, d = Math.hypot(dx, dz); if (d > 22 || d < 0.1) continue; const ang = Math.acos(clamp((dx * fx0 + dz * fz0) / d, -1, 1)); if (ang < bd) { bd = ang; best = z; } }
      $('.zg-cross').classList.toggle('lock', !!best);
      if (!best) return [fx0, fz0, null]; const dx = best.x - me.x, dz = best.z - me.z, d = Math.hypot(dx, dz); { let dy = Math.atan2(dx, dz) - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); me.yaw += dy * 0.06; } /* gently turn toward the target */ const k = 0.65; const ax = fx0 + (dx / d - fx0) * k, az = fz0 + (dz / d - fz0) * k, l = Math.hypot(ax, az); return [ax / l, az / l, best];
    }
    function fire() {
      const w = WEAPONS[cur]; if (me.down || me.fireCd > 0 || me.reload > 0) return; me.fireCd = w.rate; const [ax, az] = aimDir(); me.face = Math.atan2(ax, az);
      if (w.melee) { me.swing = 0.3; snd('bonk'); buzz(18); for (const z of zs) { const dx = z.x - me.x, dz = z.z - me.z, d = Math.hypot(dx, dz); if (d < 2.4 + z.t.sc * 0.4 && (dx * ax + dz * az) / (d || 1) > 0.3) { hit(z, w.dmg * up.dmg, ax * 9, az * 9); } } burst(me.x + ax * 1.4, 1, me.z + az * 1.4, 8, ['#ffc7e6', '#ffffff'], 3); return; }
      if (ammo[cur] <= 0) { startReload(); return; } ammo[cur]--; if (ammo[cur] <= 0) startReload();
      const n = w.spread || 1; for (let i = 0; i < n; i++) { if (projs.length >= MAXP) projs.shift(); const a = Math.atan2(ax, az) + (n > 1 ? (i - (n - 1) / 2) * 0.13 : rnd(-0.02, 0.02));
        projs.push({ x: me.x + Math.sin(a) * 0.6, y: me.y + 0.95, z: me.z + Math.cos(a) * 0.6, vx: Math.sin(a) * w.spd, vz: Math.cos(a) * w.spd, life: w.pierce ? 2.2 : 1.1, w, hitSet: w.pierce ? new Set() : null }); }
      snd(cur === 'goo' ? 'pew' : cur === 'foam' ? 'foam' : cur === 'bubble' ? 'bub' : 'ice'); if (cur !== 'freeze') buzz(8);
    }
    function throwBomb() { me.bombs--; const [ax, az] = aimDir(); bomb = { x: me.x, y: 1.2, z: me.z, vx: ax * 11, vy: 6, vz: az * 11 }; bombM.visible = true; snd('pick'); hud(); }
    function hit(z, dmg, kx = 0, kz = 0, w, who = uid) { if (!isHost()) { z.flash = 0.1; if (myHits.length < 39) myHits.push(++hitSeq, z.id, Math.round(dmg) * 10 + (w && w.freeze ? 1 : w && w.lift ? 2 : 0)); return; } z.last = who; z.hp -= dmg; z.flash = 0.1; z.kx += kx * 0.25; z.kz += kz * 0.25; if (w && w.freeze) z.frozen = 2.2; if (w && w.lift && z.t !== ZT.boss) z.lift = 1.2; if (z.hp <= 0) kill(z); }
    function kill(z) { if (z.dead) return; z.dead = true; poof(z); if (!isHost()) return; const who = z.last || uid; kmap[who] = (kmap[who] || 0) + 1; if (who === uid) kills++; score += z.t.pts + wave * 2; if (who === uid) addDia(z.t.dia); else dmap[who] = Math.min(RUN_CAP, (dmap[who] || 0) + z.t.dia); }
    function poof(z) { snd('poof'); buzz(z.t === ZT.boss ? 60 : 12);
      burst(z.x, 1.2 * z.t.sc, z.z, z.t === ZT.boss ? 80 : 22, ['#9dff6a', '#ffe14a', '#ffffff', '#b48cff'], z.t === ZT.boss ? 7 : 4);
      if (z.t === ZT.boss) { boss = null; $('.zg-boss').hidden = true; hat.visible = false; msg('👑 Boss splatted! +💎' + ZT.boss.dia); drop(z.x, z.z, 'heart'); drop(z.x + 1, z.z, 'dia2'); }
      else if ((z.id * 7919) % 100 < 12) drop(z.x, z.z, ['heart', 'ammo', 'ammo', 'zoom', 'shield', coop ? 'heart' : 'dia2'][z.id % 6]); }
    function addDia(n) { const before = dias; dias = Math.min(RUN_CAP, dias + n * (buffs.dia2 > 0 ? 2 : 1)); dmap[uid] = dias; if (before < RUN_CAP && dias >= RUN_CAP) msg('💎 Diamond max for this run!'); }
    function drop(x, z, k) { if (pickups.length > 8) return; const m = puMeshes[k].clone(); m.position.set(x, 0.6, z); scene.add(m); pickups.push({ x, z, k, m, life: 14 }); }
    function spawn(type) { if (zs.length >= MAXZ) return false; const t = ZT[type]; let a, rr, sx, sz, tries = 0; do { a = Math.random() * TAU; rr = rnd(11, ARENA - 1); sx = Math.cos(a) * rr; sz = Math.sin(a) * rr; } while (players().some((q) => Math.hypot(sx - q.x, sz - q.z) < 9) && ++tries < 12); const hpK = (1 + wave * 0.12) * (1 + 0.5 * (teamN - 1));
      const z = { id: ++zid, t, x: sx, z: sz, hp: t.hp * hpK, max: t.hp * hpK, spd: t.spd * (1 + Math.min(0.6, wave * 0.035)) * rnd(0.9, 1.1), ph: Math.random() * 10, rise: 0.7, flash: 0, frozen: 0, lift: 0, kx: 0, kz: 0, slam: 3.5, dead: false };
      if (type === 'boss') { z.hp = z.max = (t.hp + wave * 70) * (1 + 0.6 * (teamN - 1)); boss = z; $('.zg-boss').hidden = false; hat.visible = true; msg('👑 A Big Boss Zombie appears!', 2); snd('groan'); }
      zs.push(z); return true; }
    function nextWave() { wave++; const n = Math.round((5 + wave * 3) * (1 + 0.6 * (teamN - 1))); toSpawn = n; spawnT = 0.5; msg(`🌙 Wave ${wave}${wave % 5 === 0 ? ' · BOSS' : ''}`); snd('wave'); if (wave % 5 === 0) spawn('boss'); if (starBomb) me.bombs = Math.min(5, me.bombs + 1); hud(); }
    function waveDone() { const bonus = 3 + wave; addDia(bonus); for (const u of team.keys()) dmap[u] = Math.min(RUN_CAP, (dmap[u] || 0) + bonus); score += 50 * wave; msg(`✨ Wave ${wave} cleared! +💎${bonus}`); breakT = 3.5; owned.forEach((k) => (ammo[k] = Math.round((WEAPONS[k].ammo || 0) * up.ammo))); me.hp = Math.min(up.hp, me.hp + 15); hud(); }
    function hurt(d) { if (me.inv > 0 || over || me.down) return; if (buffs.shield > 0) { burst(me.x, 1, me.z, 4, ['#ffd23f'], 2); return; } me.hp -= d * (1 - armor); me.inv = 0.6; snd('hurt'); buzz(40); $('.zg-dmg').style.boxShadow = 'inset 0 0 90px rgba(255,80,160,.75)'; setTimeout(() => ($('.zg-dmg').style.boxShadow = ''), 200); if (me.hp <= 0) { me.hp = 0; if (coop) { me.down = true; msg('😵 You’re down! A teammate can revive you', 3); sendMe(true); } else gameOver(); } hud(); }
    function hud() { $('.zg-hp i').style.width = (100 * me.hp) / up.hp + '%'; const w = WEAPONS[cur]; H('wpn').textContent = `${w.icon} ${w.name}${w.melee ? '' : me.reload > 0 ? ' · reloading…' : ' · ' + ammo[cur]}${starBomb ? ' · ⭐' + me.bombs : ''}`;
      H('wave').textContent = `Wave ${wave}`; H('score').textContent = `⭐ ${score}`; H('dia').textContent = `💎 ${dias}${dias >= RUN_CAP ? ' (max)' : ''}`;
      const b = Object.entries(buffs).filter(([, v]) => v > 0).map(([k]) => PU[k][0]).join(' '); H('pu').hidden = !b; H('pu').textContent = b; }

    // ------------------------------------------------------------ co-op (Firestore, host-authoritative zombies)
    function players() { const l = [{ x: me.x, z: me.z, down: me.down, uid }]; if (!net) return l; for (const [u, t] of team) if (net.fresh(u)) l.push({ x: t.x, z: t.z, down: t.down, uid: u }); return l; }
    function nameTex(text, col = '#ffffff') { return canvasTex(256, 64, (c) => { c.font = '800 30px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 7; c.strokeStyle = 'rgba(20,10,50,.85)'; c.strokeText(text, 128, 32); c.fillStyle = col; c.fillText(text, 128, 32); }); }
    function sprite(tex, w = 2.2) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(w, w / 4, 1); sp.renderOrder = 10; return sp; }
    const myBubble = sprite(nameTex(''), 3); myBubble.visible = false; scene.add(myBubble); let myBubT = 0;
    function syncTeam() { if (!net) return; const P = net.players;
      for (const [u, d] of Object.entries(P)) { if (u === uid) continue; let t = team.get(u);
        if (!t) { const r = palRig(d.pal || { species: 'kemy' }); const g = new THREE.Group(); g.add(r.obj); r.obj.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { const m0 = o.material; o.material = new THREE.MeshLambertMaterial({ color: m0.color, map: m0.map, transparent: m0.transparent, opacity: m0.opacity, side: m0.side }); } });
          const b = new THREE.Box3().setFromObject(r.obj); g.scale.setScalar(1.45 / ((b.max.y - b.min.y) || 1)); scene.add(g);
          const label = sprite(nameTex(String(d.name || 'Pal').slice(0, 16), '#ffe9a3')); scene.add(label); const bub = sprite(nameTex(''), 3); bub.visible = false; scene.add(bub);
          const sh = new THREE.Mesh(blobGeo, blobMat); sh.scale.setScalar(1.3); scene.add(sh);
          t = { rig: r, g, label, bub, sh, x: d.x, z: d.z, y: d.y, f: d.f, emSeen: d.emAt, fireCd: 0, name: d.name || 'Pal', t: 0 }; team.set(u, t); msg(`👋 ${esc2(t.name)} joined`, 1.2); }
        Object.assign(t, { tx: d.x, tz: d.z, ty: d.y, tf: d.f, a: d.a, fire: d.fire, w: d.w, hp: d.hp, down: d.down, rev: d.rev });
        if (d.em >= 0 && d.emAt !== t.emSeen) { t.emSeen = d.emAt; t.bub.material.map = nameTex(zText(d.em)); t.bub.visible = true; t.bubT = 3; const eid = zEmoteOf(d.em); if (eid) { t.emo = eid; t.emoUntil = performance.now() + emoteMs(eid); } }
        // host: apply this teammate's new zombie hits (rolling window, deduped by sequence number)
        if (isHost() && Array.isArray(d.hits)) { const seen = t.hitSeen || 0; let top = seen; for (let i = 0; i + 2 < d.hits.length; i += 3) { const sq = d.hits[i]; if (sq <= seen) continue; top = Math.max(top, sq); const z = zs.find((q) => q.id === d.hits[i + 1]); if (!z || z.dead) continue; const code = d.hits[i + 2] % 10; hit(z, Math.floor(d.hits[i + 2] / 10), 0, 0, code === 1 ? WEAPONS.freeze : code === 2 ? WEAPONS.bubble : null, u); } t.hitSeen = top; } }
      for (const [u, t] of team) if (!P[u]) { scene.remove(t.g, t.label, t.bub, t.sh); team.delete(u); msg(`👋 ${esc2(t.name)} left`, 1.2); }
      teamHud(); }
    const esc2 = (x) => String(x).replace(/[&<>"']/g, '');
    function teamHud() { const el2 = $('.zg-team'); if (!el2 || !coop) return; el2.innerHTML = [...team.entries()].map(([u, t]) => `<div class="${t.down ? 'dn' : ''}">${esc2(t.name).slice(0, 14)} ${!net.fresh(u) ? '📶 away' : t.down ? '💤 down' : ''}<i style="width:${Math.max(0, Math.min(100, t.hp || 0))}%"></i></div>`).join(''); }
    function applyState() { const st = net && net.state; if (!st) return; if (isHost()) return;
      if (st.wave !== lastWaveSeen) { if (st.wave > lastWaveSeen && st.wave) { msg(`🌙 Wave ${st.wave}${st.wave % 5 === 0 ? ' · BOSS' : ''}`); snd('wave'); } lastWaveSeen = st.wave; }
      wave = st.wave; score = st.score; teamN = st.n || teamN; dias = Math.min(RUN_CAP, (st.dia || {})[uid] || dias); kills = (st.kills || {})[uid] || kills; toSpawn = st.ts || 0; breakT = st.brk || 0;
      const byId = new Map(zs.map((z) => [z.id, z])); const live = new Set();
      for (let i = 0; i + 5 < st.zs.length; i += 6) { const id = st.zs[i], ty = ZT[ZTYPES[st.zs[i + 1]] || 'walk'], x = st.zs[i + 2] / 10, zz = st.zs[i + 3] / 10, hp = st.zs[i + 4], fl = st.zs[i + 5]; live.add(id);
        let z = byId.get(id); if (!z) { z = { id, t: ty, x, z: zz, tx: x, tz: zz, hp, max: hp, spd: ty.spd, ph: Math.random() * 10, rise: 0.7, flash: 0, frozen: 0, lift: 0, kx: 0, kz: 0, slam: 9, dead: false }; zs.push(z); if (ty === ZT.boss) { boss = z; $('.zg-boss').hidden = false; hat.visible = true; z.max = st.bm || hp; } }
        z.tx = x; z.tz = zz; if (hp < z.hp) z.flash = 0.08; z.hp = hp; z.frozen = fl & 1 ? 0.3 : z.frozen; z.lift = fl & 2 ? Math.max(z.lift, 0.3) : z.lift; zid = Math.max(zid, id); }
      for (const z of zs) if (!live.has(z.id) && !z.dead) { z.dead = true; poof(z); }
      zs = zs.filter((z) => !z.dead);
      if (st.slam && st.slam.length >= 3 && st.slam[2] !== slamSeq) { slamSeq = st.slam[2]; slamRing.visible = true; slamRing.userData = { x: st.slam[0] / 10, z: st.slam[1] / 10, r: 1, hitDone: false }; snd('boom'); }
      if (st.over && !over) gameOver(); }
    function pushState(final) { const flat = []; for (const z of zs.slice(0, 48)) flat.push(z.id, ZTYPES.indexOf(Object.keys(ZT).find((k) => ZT[k] === z.t)), Math.round(z.x * 10), Math.round(z.z * 10), Math.max(0, Math.round(z.hp)), (z.frozen > 0 ? 1 : 0) | (z.lift > 0 ? 2 : 0));
      const ids = [uid, ...team.keys()].slice(0, 4); const pick = (m) => Object.fromEntries(ids.filter((u) => m[u]).map((u) => [u, Math.round(m[u])]));
      net.sendState({ wave, zs: flat, score: Math.round(score), kills: pick(kmap), dia: pick(dmap), over: !!final, slam: slamRing.visible ? [Math.round(slamRing.userData.x * 10), Math.round(slamRing.userData.z * 10), slamSeq] : [], seq: (pushState.n = (pushState.n || 0) + 1), n: teamN, ts: toSpawn, brk: Math.max(0, Math.round(breakT * 10) / 10), bm: boss ? Math.round(boss.max) : 0 }); }
    function sendMe(force) { const busy = C.down('fire') || C.move.mag > 0.05 || me.y > 0 || myHits.length; if (!force && performance.now() - sendT < (busy ? 120 : 1000)) return; sendT = performance.now();
      net.send({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), f: +me.face.toFixed(2), a: +me.yaw.toFixed(2), fire: !!C.down('fire') && !me.down, w: cur, hp: Math.max(0, Math.round(me.hp / up.hp * 100)), down: me.down, rev: me.rev, em: me.em, emAt: me.emAt, hits: myHits.slice(-39), hs: hitSeq });
      if (myHits.length > 39) myHits = myHits.slice(-39); }
    function reviveTarget() { if (!coop || me.down) return null; for (const [u, t] of team) if (t.down && Math.hypot(t.x - me.x, t.z - me.z) < 2.2) return u; return null; }
    let netWall = 0;
    function netStep(dt0) { const nw = performance.now(); const dt = netWall ? Math.min(0.25, (nw - netWall) / 1000) : dt0; netWall = nw; // revive timers use real time so slow phones are not penalized
      // revive: hold Special near a downed teammate; the downed player's client finishes it after 3 s
      const rt = reviveTarget(); C.setLabel('special', rt ? '🤝' : starBomb ? '⭐' : '🔄', rt ? 'Revive' : starBomb ? 'Bomb' : 'Reload');
      const reviving = rt && C.down('special'); me.rev = reviving ? rt : ''; if (reviving) { revT = Math.min(3, revT + dt); } else revT = 0;
      if (me.down) { const helper = [...team.entries()].find(([, t]) => t.rev === uid && Math.hypot(t.x - me.x, t.z - me.z) < 2.6); if (helper) downT += dt; else downT = Math.max(0, downT - dt * 0.5);
        if (downT >= 3) { me.down = false; me.hp = up.hp * 0.5; me.inv = 2; downT = 0; msg('🤝 Revived!', 1.4); snd('pick'); sendMe(true); } }
      const rp = me.down ? downT : revT; const rv = $('.zg-rev'); rv.hidden = !(rp > 0); rv.querySelector('i').style.width = (rp / 3) * 100 + '%';
      // teammates: smooth toward their last position (interpolation), visual fire
      for (const [, t] of team) { const k = Math.min(1, dt * 10); t.x += (t.tx - t.x) * k; t.z += (t.tz - t.z) * k; t.y += (t.ty - t.y) * k; let df = t.tf - t.f; df = Math.atan2(Math.sin(df), Math.cos(df)); t.f += df * k; t.t += dt;
        t.fireCd -= dt; if (t.fire && !t.down && t.fireCd <= 0) { const w = WEAPONS[t.w] || WEAPONS.goo; t.fireCd = w.rate || 0.3; if (!w.melee) { if (projs.length >= MAXP) projs.shift(); projs.push({ x: t.x + Math.sin(t.a) * 0.6, y: t.y + 0.95, z: t.z + Math.cos(t.a) * 0.6, vx: Math.sin(t.a) * w.spd, vz: Math.cos(t.a) * w.spd, life: 1, w, vis: 1 }); } }
        if (t.bubT > 0) { t.bubT -= dt; if (t.bubT <= 0) t.bub.visible = false; } }
      if (myBubT > 0) { myBubT -= dt; if (myBubT <= 0) myBubble.visible = false; }
      sendMe(false);
      if (isHost()) { if (performance.now() - stateT > 160) { stateT = performance.now(); pushState(false); }
        // team wipe: everyone (fresh) down
        const pl = players(); if (pl.every((q) => q.down)) { wipeT += dt; if (wipeT > 0.6 && !over) gameOver(); } else wipeT = 0; }
      else if (performance.now() - migT > 2000) { migT = performance.now(); net.maybeTakeOver().then((took) => { if (took) { msg('👑 You’re the host now', 1.6); const st = net.state || {}; kmap = { ...(st.kills || {}) }; dmap = { ...(st.dia || {}) }; score = st.score || score; for (const z of zs) { z.spd = z.t.spd * (1 + Math.min(0.6, wave * 0.035)); z.slam = 3.5; } } }); }
      if (!coop || teamN <= 1) return; if (me.down && !team.size) gameOver(); }
    function drawTeam() { for (const [, t] of team) { t.g.position.set(t.x, t.y, t.z); t.g.rotation.set(t.down ? -1.3 : 0, t.f, 0); const mv = Math.hypot(t.tx - t.x, t.tz - t.z) > 0.05;
      const tEmo = !t.down && !mv && !t.fire && t.y <= 0.05 && t.emo && performance.now() < t.emoUntil;
      t.rig.pose(t.down ? 'sleep' : t.y > 0.05 ? 'hop' : mv ? 'walk' : 'idle', t.t * 60, tEmo ? clipFor(t.emo)(EBEAT()) : t.fire ? { aR: [20, 85, 8] } : null);
      t.label.position.set(t.x, t.y + 2.05, t.z); t.bub.position.set(t.x, t.y + 2.5, t.z); t.sh.position.set(t.x, 0.02, t.z); }
      myBubble.position.set(me.x, me.y + 2.4, me.z); }
    let netOff = null;
    if (coop) { netOff = net.on((k) => { if (k === 'players') syncTeam(); else if (k === 'state') applyState(); else if (k === 'lobby' && !net.lobby && !over) { msg('The team ended', 2); gameOver(true); } }); syncTeam(); applyState();
      $('[data-t="chat"]').onclick = () => { const e = $('.zg-emo'); e.hidden = !e.hidden; if (!e.hidden) renderQuickChat(e, (x) => { const i = zSayIdx(x); if (i < 0) return; e.hidden = true; zEm(i, x); }, ZTABS); }; }
    // quick-chat / emote: speech bubble over your Pal, synced to the team through the em index (see zombie-net.js)
    let lastEm = 0;
    function zEm(i, text) { if (Date.now() - lastEm < 1200) return; lastEm = Date.now(); me.em = i; me.emAt = Date.now(); myBubble.material.map = nameTex(text); myBubble.visible = true; myBubT = 3; if (coop) sendMe(true); }
    try { loadOwnedEmotes(db, uid)?.catch?.(() => {}); } catch {} // no db (offline/test page) → free emotes only
    $('[data-t="wheel"]').onclick = () => { $('.zg-emo').hidden = true; Promise.resolve().then(() => loadOwnedEmotes(db, uid)).catch(() => {}).then(() => openWheel({ onEmote: (id) => { const i = zEmoteIdx(id); me.emo = id; me.emoUntil = performance.now() + emoteMs(id); if (i >= 0) zEm(i, zText(i)); }, onLocked: (d) => msg(`🔒 ${d.name}: unlock it in the Dance Shop`, 1.6) })); };
    // ------------------------------------------------------------ loop
    const zDummy = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), M = new THREE.Matrix4(), pm = new THREE.Matrix4();
    let last = performance.now(), raf = 0, fpsT = 0, fpsN = 0, slowFor = 0;
    function step(dt) {
      me.t += dt;
      // look
      const lk = C.takeLook(); me.yaw -= lk.dx * 0.0062; pitch = clamp(pitch + lk.dy * 0.004, pov ? -0.5 : 0.05, pov ? 0.6 : 0.95);
      // move (camera-relative, analog)
      const m = me.down ? { x: 0, y: 0, mag: 0 } : C.move; const [fx0, fz0] = fwd(); let mx = fx0 * -m.y + -fz0 * m.x, mz = fz0 * -m.y + fx0 * m.x; const spd = (m.run ? 7.4 : 5) * up.spd * (buffs.zoom > 0 ? 1.35 : 1);
      if (me.dodge > 0) { me.dodge -= dt; mx = me.dx * 3.2; mz = me.dz * 3.2; }
      me.x += mx * spd * dt; me.z += mz * spd * dt; const r = Math.hypot(me.x, me.z); if (r > ARENA - 0.6) { me.x *= (ARENA - 0.6) / r; me.z *= (ARENA - 0.6) / r; }
      if (m.mag > 0.05 && !C.down('fire')) me.face = Math.atan2(mx, mz) ; else if (C.down('fire')) me.face = Math.atan2(fx0, fz0);
      me.vy -= 20 * dt; me.y = Math.max(0, me.y + me.vy * dt); if (me.y === 0) me.vy = 0;
      for (const k in buffs) buffs[k] = Math.max(0, buffs[k] - dt); me.inv -= dt; me.dodgeCd -= dt; me.fireCd -= dt; me.swing -= dt;
      if (me.reload > 0) { me.reload -= dt; if (me.reload <= 0) { ammo[cur] = Math.round(WEAPONS[cur].ammo * up.ammo); hud(); } }
      if (C.down('fire')) fire();
      if (coop) netStep(dt);
      // waves (host only)
      if (!isHost()) { /* guests mirror the host's state */ }
      else if (breakT > 0) { breakT -= dt; if (breakT <= 0) nextWave(); }
      else if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { const roll = Math.random(); const type = wave >= 3 && roll < 0.12 + wave * 0.01 ? 'chonk' : wave >= 2 && roll < 0.45 ? 'run' : 'walk'; if (spawn(type)) toSpawn--; spawnT = Math.max(0.25, 1.4 - wave * 0.08) * rnd(0.6, 1.2); } }
      else if (!zs.length) waveDone();
      // zombies
      if (me.t - lastGroan > 2.2 && zs.length) { lastGroan = me.t + rnd(0, 2); snd('groan'); }
      const tg = players().filter((q) => !q.down);
      for (const z of zs) {
        if (z.rise > 0) { z.rise -= dt; continue; } z.flash -= dt; z.frozen -= dt; z.lift -= dt;
        { const ex = me.x - z.x, ez = me.z - z.z, ed = Math.hypot(ex, ez); if (ed < 0.9 * z.t.sc + 0.3 && me.y < 1.2 * z.t.sc) hurt((z.t === ZT.boss ? 22 : 10) * dt * 2.5); }
        if (!isHost()) { const k = Math.min(1, dt * 8); const ox = z.x, oz = z.z; z.x += (z.tx - z.x) * k; z.z += (z.tz - z.z) * k; const mv = Math.hypot(z.x - ox, z.z - oz); if (mv > 1e-3) z.yaw = Math.atan2(z.x - ox, z.z - oz); z.ph += mv * 2.2; continue; }
        let near = tg[0] || me, nd = 1e9; for (const q of tg) { const dd = (q.x - z.x) ** 2 + (q.z - z.z) ** 2; if (dd < nd) { nd = dd; near = q; } }
        const dx = near.x - z.x, dz = near.z - z.z, d = Math.hypot(dx, dz) || 1; z.yaw = Math.atan2(dx, dz);
        let s = z.spd * (z.frozen > 0 ? 0.3 : 1) * (z.lift > 0 ? 0 : 1); let sx = (dx / d) * s, sz = (dz / d) * s;
        for (const o of zs) { if (o === z) continue; const ox = z.x - o.x, oz = z.z - o.z, od = ox * ox + oz * oz, rr = (z.t.sc + o.t.sc) * 0.55; if (od < rr * rr && od > 1e-4) { const k = (rr - Math.sqrt(od)) * 4; sx += ox * k; sz += oz * k; } }
        z.x += (sx + z.kx) * dt; z.z += (sz + z.kz) * dt; z.kx *= 0.86; z.kz *= 0.86; z.ph += dt * s * 2.2;
        if (z === boss) { z.slam -= dt; if (z.slam <= 0) { z.slam = Math.max(2.4, 4.5 - wave * 0.08); slamRing.visible = true; slamRing.userData = { x: z.x, z: z.z, r: 1, hitDone: false }; slamSeq++; snd('boom'); buzz(30); burst(z.x, 0.3, z.z, 20, ['#9dff6a', '#6dff5a'], 5); } }
      }
      if (slamRing.visible) { const u = slamRing.userData; u.r += dt * 9; slamRing.position.set(u.x, 0.05, u.z); slamRing.scale.setScalar(u.r); slamRing.material.opacity = Math.max(0, 0.85 - u.r / 16); const dd = Math.hypot(me.x - u.x, me.z - u.z); if (!u.hitDone && Math.abs(dd - u.r) < 0.7 && me.y < 0.4) { u.hitDone = true; hurt(18); } if (u.r > 14) slamRing.visible = false; }
      zs = zs.filter((z) => !z.dead);
      // projectiles
      for (const p of projs) { p.x += p.vx * dt; p.z += p.vz * dt; p.life -= dt;
        if (p.vis) continue; for (const z of zs) { if (z.dead || z.rise > 0) continue; const rr = 0.55 * z.t.sc + p.w.r; if ((z.x - p.x) ** 2 + (z.z - p.z) ** 2 < rr * rr) { if (p.hitSet) { if (p.hitSet.has(z)) continue; p.hitSet.add(z); } else p.life = 0;
          hit(z, p.w.dmg * up.dmg, p.vx * 0.15, p.vz * 0.15, p.w); burst(p.x, p.y, p.z, 3, [p.w.col === 0xbff4ff ? '#bff4ff' : '#9dff6a', '#ffffff'], 2); if (!p.hitSet) break; } } }
      projs = projs.filter((p) => p.life > 0);
      if (bomb) { bomb.vy -= 18 * dt; bomb.x += bomb.vx * dt; bomb.y += bomb.vy * dt; bomb.z += bomb.vz * dt; bombM.position.set(bomb.x, bomb.y, bomb.z); bombM.rotation.y += dt * 8;
        if (bomb.y <= 0.2) { for (const z of zs) { const d = Math.hypot(z.x - bomb.x, z.z - bomb.z); if (d < 4.5) hit(z, 90 * up.dmg, (z.x - bomb.x) * 3, (z.z - bomb.z) * 3); } burst(bomb.x, 0.6, bomb.z, 60, ['#ffe14a', '#ffffff', '#ffb3c9'], 8); snd('boom'); buzz(50); bomb = null; bombM.visible = false; hud(); } }
      // pickups
      for (const p of pickups) { p.life -= dt; p.m.rotation.y += dt * 2; p.m.position.y = 0.6 + Math.sin(me.t * 3 + p.x) * 0.15; if (!me.down && Math.hypot(p.x - me.x, p.z - me.z) < 1.2) { p.life = 0; snd('pick'); buzz(15);
        if (p.k === 'heart') me.hp = Math.min(up.hp, me.hp + 30); else if (p.k === 'ammo') { owned.forEach((k) => (ammo[k] = Math.round((WEAPONS[k].ammo || 0) * up.ammo))); me.reload = 0; } else buffs[p.k] = p.k === 'dia2' ? 10 : 7; msg(PU[p.k][0], 0.8); hud(); } if (p.life <= 0) scene.remove(p.m); }
      pickups = pickups.filter((p) => p.life > 0);
      // fx
      for (let i = 0; i < MAXFX; i++) { if (fxL[i] <= 0) continue; fxL[i] -= dt; if (fxL[i] <= 0) { fxPos[i * 3 + 1] = -999; continue; } fxV[i * 3 + 1] -= 6 * dt; fxPos[i * 3] += fxV[i * 3] * dt; fxPos[i * 3 + 1] = Math.max(0.05, fxPos[i * 3 + 1] + fxV[i * 3 + 1] * dt); fxPos[i * 3 + 2] += fxV[i * 3 + 2] * dt; }
      fxG.attributes.position.needsUpdate = true; fxG.attributes.color.needsUpdate = true;
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('.zg-msg').style.opacity = 0; }
      if (boss) $('.zg-boss i').style.width = (100 * Math.max(0, boss.hp)) / boss.max + '%';
      if ((me.t * 10 | 0) % 3 === 0) hud();
    }
    function draw() {
      // player
      pr0.position.set(me.x, me.y, me.z); pr0.rotation.y = me.face; pShadow.position.set(me.x, 0.02, me.z); pShadow.scale.setScalar(1.3 - Math.min(0.6, me.y * 0.3));
      const moving = C.move.mag > 0.05; const firing = C.down('fire') && !WEAPONS[cur].melee; const swing = me.swing > 0 ? (me.swing / 0.3) : 0;
      pr0.rotation.x = me.down ? -1.3 : 0; const myEmo = !me.down && !moving && !firing && !swing && me.y <= 0.05 && me.emo && performance.now() < me.emoUntil;
      rig.pose(me.down ? 'sleep' : me.y > 0.05 ? 'hop' : moving ? 'walk' : 'idle', me.t * 60 * (C.move.run ? 1.4 : 1), myEmo ? clipFor(me.emo)(EBEAT()) : firing || swing ? { aR: swing ? [40, 150 - (1 - swing) * 160, 20] : [20, 85, 8] } : null);
      P3.visible = !pov; shieldM.visible = buffs.shield > 0; shieldM.position.set(me.x, me.y + 0.8, me.z);
      if (me.inv > 0 && !pov) P3.visible = Math.floor(me.t * 20) % 2 === 0 || me.dodge > 0;
      if (coop) drawTeam();
      // camera
      const [fx0, fz0] = fwd();
      if (pov) { cam.position.set(me.x + fx0 * 0.2, me.y + 1.25, me.z + fz0 * 0.2); cam.lookAt(me.x + fx0 * 10, me.y + 1.25 - pitch * 10, me.z + fz0 * 10); }
      else { const dist = 5.2, h = 1.2 + pitch * 3.2; let cx = me.x - fx0 * dist + -fz0 * 0.6, cz = me.z - fz0 * dist + fx0 * 0.6; cam.position.set(cx, me.y + h, cz); cam.lookAt(me.x + fx0 * 3 - fz0 * 0.6, me.y + 1.1, me.z + fz0 * 3 + fx0 * 0.6); }
      // zombies -> instances
      let n = 0; for (const z of zs) { if (!pov && Math.hypot(z.x - cam.position.x, z.z - cam.position.z) < 1.6 * z.t.sc && z !== boss) continue; /* don't block the camera */ const sc = z.t.sc, rise = z.rise > 0 ? -1.8 * (z.rise / 0.7) * sc : 0, wob = Math.sin(z.ph) * 0.14, bob = Math.abs(Math.sin(z.ph)) * 0.06 * sc;
        e3.set(z.frozen > 0 ? 0 : 0.08, z.yaw || 0, z.frozen > 0 ? 0 : wob); q.setFromEuler(e3); v3.set(z.x, rise + bob + (z.lift > 0 ? Math.sin((1.2 - z.lift) / 1.2 * Math.PI) * 2.2 : 0), z.z); s3.set(sc, sc * (1 + Math.sin(z.ph * 2) * 0.03), sc); M.compose(v3, q, s3);
        skinC.setHex(z.flash > 0 ? 0xffffff : z.frozen > 0 ? 0xa8e6ff : z.t.col); const cloth = z.flash > 0 ? 0xffffff : z.frozen > 0 ? 0x9fd8ff : z === boss ? 0x5a3a8a : 0x6a5acd;
        for (const P of ZI) { if (P.n === 'blob') { pm.makeTranslation(z.x, 0.02, z.z); pm.multiply(zDummy.makeScale(1.4 * sc, 1, 1.4 * sc)); } else { pm.multiplyMatrices(M, P.lm); if (P.n.startsWith('arm')) { pm.multiply(zDummy.makeRotationX(Math.sin(z.ph + (P.n === 'armL' ? 0 : 1.6)) * 0.25)); } }
          P.im.setMatrixAt(n, pm); if (P.colored === 2) P.im.setColorAt(n, skinC); else if (P.colored === 1) P.im.setColorAt(n, clothC.setHex(cloth)); }
        if (z === boss) { hat.position.set(z.x, rise + bob + 2.15 * sc, z.z); hat.rotation.set(0, z.yaw || 0, wob); hat.scale.setScalar(sc * 0.7); } n++; }
      for (const P of ZI) { P.im.count = n; P.im.instanceMatrix.needsUpdate = true; if (P.im.instanceColor) P.im.instanceColor.needsUpdate = true; }
      let k = 0; for (const p of projs) { pm.compose(v3.set(p.x, p.y, p.z), q.identity(), s3.setScalar(p.w.r)); projIM.setMatrixAt(k, pm); projIM.setColorAt(k, tmpC.setHex(p.w.col)); k++; } projIM.count = k; projIM.instanceMatrix.needsUpdate = true; if (projIM.instanceColor) projIM.instanceColor.needsUpdate = true;
      zWind.value = performance.now() / 1000; sky.position.copy(cam.position); sky.material.uniforms.t.value = zWind.value; R.render(scene, cam);
    }
    function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, Math.max(0, (now - last) / 1000) || 0); last = now; try { if ((!paused || coop) && !over) step(dt); draw(); } catch (err) { loop.errs = (loop.errs || 0) + 1; if (loop.errs < 5) console.warn('zombie frame', err); }
      fpsN++; fpsT += now - (loop.p || now); loop.p = now; if (fpsT > 1000) { dbg.fps = Math.round((fpsN * 1000) / fpsT); fpsN = 0; fpsT = 0; fpsTag.textContent = dbg.fps + ' fps';
        // dynamic resolution: keep phones smooth
        if (dbg.fps < 40 && pr > prMin) { slowFor++; if (slowFor >= 2) { pr = Math.max(prMin, pr - 0.25); R.setPixelRatio(pr); resize(); slowFor = 0; } } else if (dbg.fps >= 57 && pr < prMax) { slowFor--; if (slowFor <= -4) { pr = Math.min(prMax, pr + 0.25); R.setPixelRatio(pr); resize(); slowFor = 0; } } else slowFor = 0; } }
    // ------------------------------------------------------------ flow
    function panel(html) { window.__kemyNoZoom?.recover(); el.querySelector('.zg-panel')?.remove(); const d = document.createElement('div'); d.className = 'zg-panel'; d.innerHTML = `<div class="zg-card">${html}</div>`; el.appendChild(d); return d; }
    function pause(v) { if (over) return; paused = v; if (!v) { el.querySelector('.zg-panel')?.remove(); return; }
      const d = panel(`<h2>⏸️ Paused</h2><p>Wave ${wave} · ⭐ ${score} · 💎 ${dias}</p><div class="row"><button data-r>▶ Resume</button><button class="ghost" data-c>⚙️ Controls</button><button class="ghost" data-q>🚪 Quit run</button><button class="ghost" data-zv>🔍 Reset view</button></div>`); d.querySelector('[data-zv]').onclick = () => window.__kemyNoZoom?.reset();
      d.querySelector('[data-r]').onclick = () => pause(false); d.querySelector('[data-c]').onclick = () => { d.remove(); C.settings(); C.on('settings:closed', () => (paused = false)); }; d.querySelector('[data-q]').onclick = () => gameOver(true); }
    async function gameOver(quit) { if (over) return; over = true; paused = false; snd('boom'); if (coop) { if (isHost()) pushState(true); const st = net.state || {}; if (!isHost()) { score = st.score || score; } dias = Math.min(RUN_CAP, Math.max(dias, (st.dia || {})[uid] || 0)); kills = Math.max(kills, (st.kills || {})[uid] || 0); }
      const bestK = 'kemy-z-best-' + uid; let best = {}; try { best = JSON.parse(localStorage.getItem(bestK)) || {}; } catch { /* */ }
      const nb = { wave: Math.max(best.wave || 0, wave), score: Math.max(best.score || 0, score) }; try { localStorage.setItem(bestK, JSON.stringify(nb)); } catch { /* */ }
      const d = panel(`<h2>${quit ? '🚪 Run ended' : coop ? '😵 Team wiped!' : '😵 Splatted!'}</h2><p>${coop ? `Your team of ${teamN} survived to wave <b>${wave}</b>.` : `Your Pal survived to wave <b>${wave}</b>.`}</p><div class="zg-stats"><div>Score<b>${score}</b></div><div>Zombies poofed<b>${kills}</b></div><div>Diamonds<b>💎 ${dias}</b></div><div>Best wave<b>${nb.wave}</b></div></div>
        <p class="small" data-dia style="opacity:.85;margin-top:10px">${dias ? 'Saving your Diamonds…' : ''}</p><div class="row"><button data-again>🔁 Play again</button><a class="ghost" href="#/arcade/armory">🛡️ Armory</a><a class="ghost" href="#/arcade">🎮 Arcade</a></div>`);
      window.kemyDonate?.resultCard(d.querySelector('.row'));
      d.querySelector('[data-again]').onclick = () => { destroy(); if (coop) { location.hash = '#/arcade/zombie'; dispatchEvent(new HashChangeEvent('hashchange')); } else open(); };
      d.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => destroy()));
      if (dias && db && !window.__zombieNoSave) { try { const got = await createDiamonds(db, uid).earnRun(dias); const p = d.querySelector('[data-dia]'); if (p) p.textContent = got ? `💎 ${got} Diamonds saved!` : 'Daily Diamond limit reached. Come back tomorrow!'; } catch (e) { const p = d.querySelector('[data-dia]'); if (p) p.textContent = 'Could not save Diamonds right now.'; console.warn('diamonds', e.code || e.message); } }
      if (wave > 0 && db) import('../leaderboard.js').then((lb) => lb.recordScore('pals', { r: wave >= 5 ? 'w' : 'l', pts: Math.min(10000, score) }).then((rank) => { const c = d.querySelector('.zg-card'); if (rank && c) c.insertAdjacentHTML('beforeend', `<p style="margin-top:12px"><a href="#/scores/pals" style="background:none;color:#ffd23f;min-height:0;padding:0">🏆 You ranked #${rank} in Pal Games · Scoreboard</a></p>`); })).catch(() => {});
    }
    function destroy() { if (net && !destroy.done) { destroy.done = 1; netOff && netOff(); net.leave(); } cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('hashchange', onHash); document.removeEventListener('visibilitychange', onVis); C.destroy();
      scene.traverse((o) => { o.geometry?.dispose?.(); }); R.dispose(); R.forceContextLoss?.(); el.remove(); document.documentElement.style.overflow = ''; const gmr = document.getElementById('game-music'); if (gmr) gmr.style.zIndex = ''; if (G === api) G = null; window.__zombie = null; }
    const onHash = () => { if (!/^#\/arcade\/zombie/.test(location.hash)) destroy(); }; addEventListener('hashchange', onHash);
    const onVis = () => { C.reset(); if (document.hidden && !over && !coop) pause(true); }; document.addEventListener('visibilitychange', onVis);
    paintGun(); hud(); raf = requestAnimationFrame(loop); paused = true;
    const startMusic = () => import('../gamemusic.js').then(async (gm) => { await gm.mountGameMusic({ corner: 'top-right' }); const r = document.getElementById('game-music'); if (r) { r.style.zIndex = '950'; r.classList.add('top-right'); } if (gm.state().volume > 0.2) gm.setVolume(0.2); if (!gm.isPlaying()) { const b = document.querySelector('#game-music [data-st="theme"]'); if (b) b.click(); else gm.play(); } }).catch(() => {});
    C.tutorial().then(() => { paused = false; startMusic(); msg('🧟 Get ready…', 2); });
    const api = { quit: (silent) => (silent ? destroy() : gameOver(true)), destroy, _debug: { R, scene, P3, team, net, down: () => { me.hp = 0.1; hurt(999); }, spawn, zs: () => zs, me, projs: () => projs, kill: () => zs.forEach(kill), hitAll: () => zs.slice().forEach((z) => hit(z, 9999)), setHp: (v) => (me.hp = v), skipTo: (w) => { wave = w - 1; zs.length = 0; toSpawn = 0; breakT = 0.01; }, pause } };
    window.__zombie.game = api; return api;
  }
  return { open, get current() { return G; } };
}
