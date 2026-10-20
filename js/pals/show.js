// Kemy Challenge Show: a kid-safe 3D multi-round elimination party show for up to 30 Pals (plus bots).
// Round 1 Freeze Dash (red light / green light with Sunny Bloom, the giant robot sunflower), then Cookie Carve, Tug Splash,
// Marble Match, Bubble Bridge and the Bumper Summit final. Eliminated Pals get a goofy bubble poof and cheer from the
// Cheer Zone. The host's client runs the show (timers, watcher, bots, results) and syncs it through shows/{CODE}/s/state
// (see show-net.js); everyone simulates their own Pal and self-reports, and the host double-checks Freeze Dash moves
// from reported speed + position (with grace + latency tolerance). Shared controls (js/controls.js) + Graphics (js/gfx.js).
import * as THREE from '../vendor/three-0.170.0.module.min.js';
import { palRig } from './pal3d.js';
import { createControls, buzz } from '../controls.js';
import { createDiamonds, RUN_CAP } from './armory.js';
import { ZTABS, zSayIdx, zEmoteIdx, zEmoteOf, zText } from './show-net.js';
import { openWheel, renderQuickChat, loadOwnedEmotes } from './emote-wheel.js';
import { emoteMs } from './emotes.js';
import { clipFor } from './dances3d.js';
import { SPECIES } from './species.js';
import { gfxPreset, makeRenderer, dprFor, makeSky, envFromSky, proceduralTex, attachGfxSettings, showFps as gfxShowFps } from '../gfx.js';
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const EBEAT = () => performance.now() / 1000 * 116 / 60;
export const ROUNDS = {
  rlgl: { name: 'Freeze Dash', icon: '🌻', time: 75, tip: 'Run on GREEN. When Sunny Bloom turns around and shouts FREEZE, stop moving! Reach the finish line before time runs out.' },
  cookie: { name: 'Cookie Carve', icon: '🍪', time: 50, tip: 'Trace the shape on your candy cookie with your finger. Stay on the line and go gently or it cracks!' },
  tug: { name: 'Tug Splash', icon: '🪢', time: 35, tip: 'Two teams, one rope, one foam pit. Tap PULL right on the beat (when the ring turns green)!' },
  marbles: { name: 'Marble Match', icon: '🔮', time: 40, tip: 'Face your partner! Tap TOSS when the meter is in the gold zone. 3 tosses, closest to the hole wins.' },
  tiles: { name: 'Bubble Bridge', icon: '🫧', time: 75, tip: 'Hop across the tile pairs. One tile in each pair is a bubble that pops! Watch others and pick wisely.' },
  duel: { name: 'Bumper Summit', icon: '👑', time: 60, tip: 'The final! Bump other Pals off the floating summit (tap BUMP). The platform shrinks. Last Pal standing is champion!' }
};
export const PLAN = ['rlgl', 'cookie', 'tug', 'marbles', 'tiles', 'duel'];
export const SHOW = { MAX: 30, PER_ROUND: 8, CHAMP: 40, FINAL: 20, MIN_FIELD: 6 };
const BOT_NAMES = ['Bubbles', 'Pip', 'Mochi', 'Zippy', 'Nugget', 'Sprout', 'Biscuit', 'Comet', 'Pickle', 'Waffles', 'Doodle', 'Tofu', 'Jellybean', 'Pebble', 'Noodle'];
const COLS = ['#ff8fb1', '#8fd8ff', '#ffd23f', '#7ee08a', '#b48cff', '#ffb347', '#6fe0d0', '#ff6b6b'];
let audioCtx = null; const LOD = new Map();
function snd(kind) { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); const a = audioCtx, t = a.currentTime;
  const P = { green: [['triangle', 523, 784, 0.18, 0.09], ['triangle', 784, 1046, 0.22, 0.08, 0.16]], red: [['square', 392, 330, 0.22, 0.07], ['square', 330, 262, 0.3, 0.07, 0.24]], turn: [['sine', 300, 900, 0.45, 0.05]],
    poof: [['sine', 700, 1900, 0.25, 0.09], ['triangle', 1200, 2400, 0.15, 0.05, 0.08]], win: [['triangle', 523, 523, 0.15, 0.08], ['triangle', 659, 659, 0.15, 0.08, 0.15], ['triangle', 784, 784, 0.15, 0.08, 0.3], ['triangle', 1046, 1046, 0.4, 0.09, 0.45]],
    tap: [['sine', 880, 660, 0.08, 0.06]], good: [['triangle', 990, 1320, 0.1, 0.07]], crack: [['sawtooth', 300, 120, 0.12, 0.04]], splash: [['sine', 400, 120, 0.4, 0.1]], bump: [['triangle', 200, 80, 0.15, 0.1]], tick: [['sine', 1200, 1200, 0.05, 0.04]] }[kind];
  if (!P) return; for (const [ty, f0, f1, d, v, dl = 0] of P) { const o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.type = ty; o.frequency.setValueAtTime(f0, t + dl); o.frequency.exponentialRampToValueAtTime(f1, t + dl + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.setValueAtTime(v, t + dl); g.gain.exponentialRampToValueAtTime(0.001, t + dl + d); o.start(t + dl); o.stop(t + dl + d + 0.02); } } catch { /* no audio */ } }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
// deterministic per-show random (bots, tiles, pairs): every client derives the same values from the shared seed
const hash = (s, i) => { let h = (s * 2654435761 + i * 40503) >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
export function botPal(seed, i) { const sp = SPECIES.filter((s) => !s.rare); const s = sp[Math.floor(hash(seed, i * 7 + 1) * sp.length)] || { id: 'bear' };
  return { species: s.id, name: BOT_NAMES[(i + Math.floor(hash(seed, 99) * BOT_NAMES.length)) % BOT_NAMES.length] + ' 🤖', colors: {}, outfit: {}, level: 1 }; }
export const tileSafe = (seed, row) => (hash(seed, 500 + row) < 0.5 ? 0 : 1);
// cookie shapes (normalized -1..1 polylines, closed)
function shapePts(kind) { const P = [];
  if (kind === 'circle') for (let i = 0; i < 64; i++) { const a = i / 64 * TAU; P.push([Math.cos(a) * 0.6, Math.sin(a) * 0.6]); }
  else if (kind === 'star') for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, r = i % 2 ? 0.3 : 0.7; P.push([Math.cos(a) * r, Math.sin(a) * r]); }
  else if (kind === 'heart') for (let i = 0; i < 64; i++) { const t = i / 64 * TAU; P.push([16 * Math.sin(t) ** 3 / 24, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 24]); }
  else if (kind === 'moon') { for (let i = 0; i <= 32; i++) { const a = -Math.PI / 2 + i / 32 * Math.PI; P.push([Math.cos(a) * 0.65 - 0.1, Math.sin(a) * 0.65]); } for (let i = 32; i >= 0; i--) { const a = -Math.PI / 2 + i / 32 * Math.PI; P.push([Math.cos(a) * 0.4 - 0.1, Math.sin(a) * 0.65]); } }
  else if (kind === 'fish') { for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; P.push([Math.cos(a) * 0.5 - 0.1, Math.sin(a) * 0.32]); if (i === 0) { P.push([0.55, 0.3], [0.55, -0.3], [0.4, 0]); } } }
  else if (kind === 'k') P.push([-0.45, -0.65], [-0.2, -0.65], [-0.2, -0.12], [0.25, -0.65], [0.55, -0.65], [0.05, -0.02], [0.55, 0.65], [0.25, 0.65], [-0.2, 0.12], [-0.2, 0.65], [-0.45, 0.65]);
  const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.035)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return out; }
export const COOKIES = [['circle', '⚪ Circle'], ['star', '⭐ Star'], ['heart', '💖 Heart'], ['moon', '🌙 Moon'], ['fish', '🐟 Fish'], ['k', '🅺 Kemy K']];
const CSS = `.sg{position:fixed;inset:0;z-index:900;background:#8fd8ff;overflow:hidden;touch-action:none;font-family:system-ui,sans-serif;color:#fff}.sg canvas.sg-cv{position:absolute;inset:0;width:100%;height:100%;display:block}
.sg-hud{position:absolute;left:0;right:112px;top:0;padding:max(8px,env(safe-area-inset-top)) 10px 0;display:flex;flex-wrap:wrap;gap:6px;pointer-events:none;z-index:6}.sg-pill{background:rgba(20,10,50,.55);border-radius:99px;padding:4px 11px;font-weight:800;font-size:14px;white-space:nowrap}
.sg-tb{position:absolute;top:calc(max(8px,env(safe-area-inset-top)) + 56px);right:8px;display:flex;flex-direction:column;gap:6px;z-index:7}.sg-tb button{width:48px;height:48px;border-radius:50%;border:0;background:rgba(20,10,50,.5);color:#fff;font-size:20px}
.sg-light{position:absolute;left:50%;top:calc(max(8px,env(safe-area-inset-top)) + 112px);transform:translateX(-50%);z-index:6;pointer-events:none;text-align:center;min-width:200px}
.sg-light b{display:block;font-size:clamp(26px,8vw,46px);font-weight:900;letter-spacing:1px;text-shadow:0 4px 0 rgba(0,0,0,.35);padding:2px 18px;border-radius:20px}.sg-light.g b{background:#2fbf5a}.sg-light.r b{background:#ff4d6d;animation:sgPulse .5s infinite alternate}.sg-light.t b{background:#ffb020}
.sg-light i{display:block;height:8px;border-radius:9px;background:rgba(0,0,0,.35);margin:5px auto 0;width:80%;overflow:hidden}.sg-light i s{display:block;height:100%;background:#fff;transition:width .1s linear}
@keyframes sgPulse{to{transform:scale(1.07)}}.sg-flash{position:absolute;inset:0;pointer-events:none;z-index:5;box-shadow:inset 0 0 0 0 rgba(255,77,109,0);transition:box-shadow .25s}.sg-flash.on{box-shadow:inset 0 0 70px 18px rgba(255,77,109,.75)}
.sg-msg{position:absolute;left:50%;top:34%;transform:translate(-50%,-50%);font-size:clamp(24px,6.5vw,44px);font-weight:900;text-shadow:0 4px 0 #2b1d55,0 0 18px #ffd23f;text-align:center;pointer-events:none;z-index:6;transition:opacity .4s;width:92%}
.sg-panel{position:absolute;inset:0;z-index:10;background:rgba(20,10,60,.72);display:flex;align-items:center;justify-content:center;padding:calc(max(8px,env(safe-area-inset-top)) + 70px) 14px 14px}.sg-card{background:linear-gradient(160deg,#3a2580,#21134f);border-radius:22px;padding:18px;max-width:440px;width:100%;text-align:center;max-height:92vh;overflow:auto}
.sg-card h2{margin:4px 0;font-size:24px}.sg-card p{margin:6px 0}.sg-card .row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:12px}.sg-card button,.sg-card a.b{min-height:52px;padding:0 20px;border-radius:16px;border:0;font-size:17px;font-weight:800;background:#ffd23f;color:#2b1d55;text-decoration:none;display:inline-flex;align-items:center}.sg-card .ghost{background:rgba(255,255,255,.15);color:#fff}
.sg-hoot{display:flex;gap:10px;align-items:center;text-align:left;background:rgba(255,255,255,.1);border-radius:16px;padding:8px}.sg-hoot svg{width:74px;height:74px;flex:none}.sg-hoot p{margin:0;font-weight:700}
.sg-st{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-top:10px}.sg-st span{background:rgba(126,224,138,.25);border-radius:99px;padding:3px 9px;font-size:13px;font-weight:800}.sg-st span.o{background:rgba(255,255,255,.08);opacity:.55;text-decoration:line-through}
.sg-res{text-align:left;margin-top:10px;display:grid;gap:4px}.sg-res div{display:flex;gap:8px;background:rgba(255,255,255,.08);border-radius:10px;padding:5px 10px;font-weight:700}.sg-res div.me{outline:2px solid #ffd23f}.sg-res b{width:34px}
.sg-emo{position:absolute;right:62px;top:calc(max(8px,env(safe-area-inset-top)) + 56px);z-index:8;width:min(340px,80vw);background:rgba(27,18,51,.94);padding:8px;border-radius:16px}.sg-emo .qc-list button{min-height:42px;background:#fff;color:#2b1d55}
.sg-mini{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(30,15,70,.35);padding-top:60px}.sg-mini canvas{background:transparent;touch-action:none;max-width:94vw;max-height:58vh}
.sg-mini .bar{width:min(320px,86vw);height:14px;border-radius:9px;background:rgba(0,0,0,.4);overflow:hidden;border:2px solid #fff}.sg-mini .bar i{display:block;height:100%;width:0}.sg-mini .lbl{font-weight:900;text-shadow:0 2px 0 #2b1d55}
.sg-mini button.big{min-height:76px;min-width:200px;border-radius:40px;border:0;font-size:26px;font-weight:900;background:#ffd23f;color:#2b1d55;box-shadow:0 6px 0 #c79a00}.sg-mini button.big:active{transform:translateY(4px);box-shadow:0 2px 0 #c79a00}
.sg-beat{position:absolute;left:50%;top:76%;width:110px;height:110px;margin:-55px;border-radius:50%;border:6px solid #fff;z-index:6;pointer-events:none;opacity:.9}.sg-beat i{position:absolute;inset:18px;border-radius:50%;background:#ffd23f}
.sg-cheer{position:absolute;left:50%;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 150px);transform:translateX(-50%);z-index:6;background:rgba(255,255,255,.92);color:#2b1d55;border-radius:16px;padding:6px 14px;font-weight:800;pointer-events:none;text-align:center;font-size:14px}`;
const HOOT = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="60" rx="34" ry="36" fill="#8a6bd6"/><ellipse cx="50" cy="68" rx="20" ry="22" fill="#d9ccff"/><circle cx="36" cy="44" r="15" fill="#fff"/><circle cx="64" cy="44" r="15" fill="#fff"/><circle cx="36" cy="44" r="8" fill="#2b1d55"/><circle cx="64" cy="44" r="8" fill="#2b1d55"/><circle cx="39" cy="41" r="3" fill="#fff"/><circle cx="67" cy="41" r="3" fill="#fff"/><path d="M45 56 L55 56 L50 64Z" fill="#ffb020"/><path d="M22 26 L32 34 L20 36Z M78 26 L68 34 L80 36Z" fill="#6a4bc4"/><rect x="34" y="14" width="32" height="10" rx="4" fill="#ffd23f"/><circle cx="50" cy="12" r="5" fill="#ff6b9a"/></svg>`;
export function createShowGame(ctx) {
  const { S, db, toast } = ctx; let G = null;
  async function open(o = {}) {
    if (G) G.destroy();
    if (!document.getElementById('sg-css')) { const s = document.createElement('style'); s.id = 'sg-css'; s.textContent = CSS; document.head.appendChild(s); }
    G = game({ pal: o.pal, uid: S.user.uid, net: o.net || null, name: o.name || 'You', bots: o.bots ?? (o.net ? 0 : 7), casual: !!o.casual, planOpt: o.plan || null }); return G;
  }
  function game({ pal, uid, net, name, bots: nBots0, casual, planOpt }) {
    const solo = !net; const isHost = () => solo || net.isHost();
    const Q = gfxPreset(); const low = Q.tier === 'low';
    const el = document.createElement('div'); el.className = 'sg'; el.setAttribute('data-kemy-game', 'show'); el.innerHTML = `<canvas class="sg-cv"></canvas><div class="sg-flash"></div>
      <div class="sg-hud"><span class="sg-pill" data-h="rd">🎪 Kemy Challenge Show</span><span class="sg-pill" data-h="time">⏱️</span><span class="sg-pill" data-h="alive">👥</span><span class="sg-pill" data-h="dia">💎 0</span></div>
      <div class="sg-light" hidden><b></b><i><s></s></i></div>
      <div class="sg-tb"><button type="button" data-t="pov" aria-label="Switch camera">👁️</button><button type="button" data-t="wheel" aria-label="Emote wheel">😊</button><button type="button" data-t="chat" aria-label="Quick chat">💬</button><button type="button" data-t="spec" aria-label="Watch another player" hidden>👀</button><button type="button" data-t="pause" aria-label="Menu">⏸️</button></div>
      <div class="sg-emo" hidden></div><div class="sg-beat" hidden><i></i></div><div class="sg-cheer" hidden></div><div class="sg-msg"></div>`;
    document.body.appendChild(el); document.documentElement.style.overflow = 'hidden';
    const $ = (s) => el.querySelector(s), H = (k) => el.querySelector(`[data-h="${k}"]`);
    const esc = (x) => String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let msgT = 0; const msg = (t, s = 1.8) => { const m = $('.sg-msg'); m.innerHTML = t; m.style.opacity = 1; msgT = s; };
    // ------------------------------------------------------------ renderer + world
    const cv = $('canvas.sg-cv'); const R = makeRenderer(cv, { ...Q, dpr: Math.min(Q.dpr, 2) }, { exposure: 1.05 });
    let pr = dprFor({ dpr: Math.min(Q.dpr, 2) }); let prMax = pr; const prMin = Math.min(pr, 1);
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog(new THREE.Color('#cfe9ff'), 60, 60 + Q.draw * 0.4);
    const sky = makeSky({ sunDir: new THREE.Vector3(0.4, 0.6, 0.35), top: '#3f8fe8', hor: '#d6efff', ground: '#8cc47a', cloud: 0.5, radius: 160 }); scene.add(sky);
    scene.environment = envFromSky(R, sky); scene.environmentIntensity = 0.35;
    const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 260);
    const resize = () => { const w = innerWidth, h = innerHeight; R.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 72 : 60; cam.updateProjectionMatrix(); }; resize(); addEventListener('resize', resize);
    scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x6a9a58, 1.5));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.4); sun.position.set(20, 40, 18); scene.add(sun); scene.add(sun.target);
    if (Q.shadows) { sun.castShadow = true; sun.shadow.mapSize.set(Math.min(Q.shadowMap, 2048), Math.min(Q.shadowMap, 2048)); const sc = sun.shadow.camera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; }
    const Lm = (c, m = {}) => new THREE.MeshLambertMaterial({ color: c, ...m });
    const GRASS = proceduralTex('grass', Q, [30, 30]), PATH = proceduralTex('path', Q, [3, 14]), WOOD = proceduralTex('wood', Q, [2, 2]), LEAF = proceduralTex('leaf', Q, [3, 3]), BARK = proceduralTex('bark', Q, [1, 2]);
    const gMat = Lm(0x7fbf5f, { map: GRASS.map, normalMap: GRASS.normalMap });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), gMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground);
    // same lawn with a hole over the foam pit (floating rounds); shape is in XY, rotated flat so y -> -z
    const holed = (() => { const sh = new THREE.Shape([new THREE.Vector2(-200, -200), new THREE.Vector2(200, -200), new THREE.Vector2(200, 200), new THREE.Vector2(-200, 200)]); sh.holes.push(new THREE.Path([new THREE.Vector2(-18, -13), new THREE.Vector2(-18, 57), new THREE.Vector2(18, 57), new THREE.Vector2(18, -13)].reverse()));
      const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + 200) / 400, (uv.getY(i) + 200) / 400); const m = new THREE.Mesh(g, gMat); m.rotation.x = -Math.PI / 2; m.position.y = -0.02; m.receiveShadow = true; m.visible = false; scene.add(m); return m; })();
    // scenery ring: trees + flowers + festival flags (instanced; decoration only)
    { const n = low ? 40 : 80; const tg = new THREE.SphereGeometry(2.6, 12, 9), trk = new THREE.CylinderGeometry(0.35, 0.5, 3, 8); const ti = new THREE.InstancedMesh(tg, Lm(0xffffff, { map: LEAF.map }), n), tk = new THREE.InstancedMesh(trk, Lm(0x8a6040, { map: BARK.map }), n); const o = new THREE.Object3D(), c = new THREE.Color();
      for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(-0.05, 0.05), r = rnd(70, 95); const x = Math.cos(a) * r, z = Math.sin(a) * r - 30; const s = rnd(0.8, 1.5); o.position.set(x, 4 * s, z); o.scale.setScalar(s); o.updateMatrix(); ti.setMatrixAt(i, o.matrix); ti.setColorAt(i, c.setHSL(rnd(0.24, 0.36), 0.55, rnd(0.35, 0.5))); o.position.set(x, 1.5 * s, z); o.updateMatrix(); tk.setMatrixAt(i, o.matrix); }
      ti.castShadow = !!Q.shadows; scene.add(ti, tk);
      const fn = Math.round(900 * Q.detail); const fi = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 4), Lm(0xffffff), fn); for (let i = 0; i < fn; i++) { const a = Math.random() * TAU, r = rnd(24, 68); let fx2 = Math.cos(a) * r; if (Math.abs(fx2) < 34) fx2 = Math.sign(fx2 || 1) * (34 + Math.random() * 20); o.position.set(fx2, 0.15, Math.sin(a) * r - 30); o.scale.setScalar(rnd(0.6, 1.4)); o.updateMatrix(); fi.setMatrixAt(i, o.matrix); fi.setColorAt(i, c.set(COLS[i % COLS.length])); } scene.add(fi); }
    // bunting poles around the show grounds
    { const g = new THREE.Group(); for (let i = 0; i < 10; i++) { const x = i % 2 ? 19 : -19, z = 6 - Math.floor(i / 2) * 22; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 8), Lm(0xffffff)); p.position.set(x, 3.5, z); g.add(p);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 3), Lm(new THREE.Color(COLS[i % COLS.length]))); fl.position.set(x, 6.5, z); fl.rotation.z = Math.PI / 2; g.add(fl); } scene.add(g); }
    // Cheer Zone: bleachers on the right, facing the arenas (eliminated Pals keep watching, emoting and cheering here)
    const CZ = { x0: 22, x1: 30, z0: -34, z1: -8, y: 1.2 };
    { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4 + i * 0.4, 28), Lm(0xffffff, { map: WOOD.map })); b.position.set(23.5 + i * 3, (0.4 + i * 0.4) / 2, -21); b.castShadow = b.receiveShadow = true; g.add(b); }
      const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 1.2, 28), Lm(0xb48cff)); deck.position.set(26, 0.6, -21); deck.receiveShadow = true; g.add(deck);
      const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(512, 128, (c) => { c.fillStyle = '#ff6b9a'; c.beginPath(); c.roundRect(4, 4, 504, 120, 40); c.fill(); c.fillStyle = '#fff'; c.font = '900 64px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📣 Cheer Zone', 256, 66); }) })); sign.scale.set(10, 2.5, 1); sign.position.set(26, 7, -21); g.add(sign); scene.add(g); }
    // foam pit (under floating rounds) — soft, bubbly, pastel
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(36, 70), new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x6fb8ff, emissiveIntensity: 0.25, map: canvasTex(256, 256, (c) => { c.fillStyle = '#e8f6ff'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 160; i++) { c.fillStyle = ['#ffd6ec', '#d6f0ff', '#fff', '#e5dcff'][i % 4]; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 16, 0, TAU); c.fill(); } }) }));
    foam.material.map.wrapS = foam.material.map.wrapT = THREE.RepeatWrapping; foam.material.map.repeat.set(6, 12); foam.rotation.x = -Math.PI / 2; foam.position.set(0, -6, -22); foam.visible = false; scene.add(foam);
    const pitWall = new THREE.Mesh(new THREE.BoxGeometry(37, 6, 71), new THREE.MeshLambertMaterial({ color: 0x9a7bdc, side: THREE.BackSide })); pitWall.position.set(0, -3, -22); pitWall.visible = false; scene.add(pitWall);
    // ------------------------------------------------------------ Pals (you, players, bots)
    const blobTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }); const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    function lite(obj) { obj.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { const m = o.material; o.material = new THREE.MeshLambertMaterial({ color: m.color, map: m.map, transparent: m.transparent, opacity: m.opacity, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, side: m.side }); }
      if (o.isMesh && o.geometry && o.geometry.parameters) { const g = o.geometry, q0 = g.parameters, k = g.type + JSON.stringify(q0); let n = LOD.get(k);
        if (!n) { if (g.type === 'SphereGeometry') n = new THREE.SphereGeometry(q0.radius, 14, 10, q0.phiStart, q0.phiLength, q0.thetaStart, q0.thetaLength); else if (g.type === 'CapsuleGeometry') n = new THREE.CapsuleGeometry(q0.radius, q0.length, 3, 10); else if (g.type === 'CylinderGeometry') n = new THREE.CylinderGeometry(q0.radiusTop, q0.radiusBottom, q0.height, Math.min(q0.radialSegments, 10), 1, q0.openEnded); if (n) LOD.set(k, n); }
        if (n) o.geometry = n; } }); }
    function nameTex(text, col = '#ffffff') { return canvasTex(256, 64, (c) => { c.font = '800 30px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 7; c.strokeStyle = 'rgba(20,10,50,.85)'; c.strokeText(text, 128, 32); c.fillStyle = col; c.fillText(text, 128, 32); }); }
    function sprite(tex, w = 2.2) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(w, w / 4, 1); sp.renderOrder = 10; return sp; }
    const bubbleGeo = new THREE.SphereGeometry(1, 18, 12), bubbleMat = new THREE.MeshPhongMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35, shininess: 120, specular: 0xffffff, depthWrite: false });
    const ppl = new Map(); // id -> contestant view { g, rig, label, bub, sh, x,y,z,f, tx,ty,tz,tf, name, bot }
    function addPal(id, p, nm, isMe) { const rig = palRig({ ...p, outfit: { ...(p.outfit || {}) } }); lite(rig.obj); const g = new THREE.Group(); g.add(rig.obj); const b = new THREE.Box3().setFromObject(rig.obj); g.scale.setScalar(1.45 / ((b.max.y - b.min.y) || 1)); scene.add(g);
      rig.obj.traverse((o) => { if (o.isMesh) o.castShadow = !!Q.shadows && (isMe || ppl.size < 8); });
      const label = sprite(nameTex(String(nm || 'Pal').slice(0, 16), isMe ? '#ffd23f' : id[0] === 'b' && id.length < 4 ? '#bfe8ff' : '#ffe9a3')); scene.add(label); const bub = sprite(nameTex(''), 3); bub.visible = false; scene.add(bub);
      const sh = new THREE.Mesh(blobGeo, blobMat); sh.scale.setScalar(1.3); scene.add(sh); const bb = new THREE.Mesh(bubbleGeo, bubbleMat); bb.visible = false; scene.add(bb);
      const v = { id, rig, g, label, bub, sh, bb, x: 0, y: 0, z: 0, f: Math.PI, tx: 0, ty: 0, tz: 0, tf: Math.PI, name: nm, t: Math.random() * 10, bubT: 0, poofT: 0, mv: 0, isMe }; ppl.set(id, v); return v; }
    function dropPal(id) { const v = ppl.get(id); if (!v) return; scene.remove(v.g, v.label, v.bub, v.sh, v.bb); ppl.delete(id); }
    const me = { x: 0, y: 0, z: 0, vy: 0, yaw: Math.PI, face: Math.PI, t: 0, st: 0, sc: 0, tp: 0, bp: [], bseq: 0, em: -1, emAt: 0, out: false, kx: 0, kz: 0, dashCd: 0, ground: true, emo: '', emoUntil: 0 };
    const meV = addPal(uid, pal, name, true);
    // ------------------------------------------------------------ shared show state
    // hs (host): ph intro|play|inter|end, rd, plan, left, light g|t|r|f, lq, ll, alive, out, elim, teams, pairs, rope, seed, rev, nb, bots, bb, champ, casual, seq
    let hs = null; let phaseEnd = 0, lightEnd = 0, stSeen = -1, curRd = -1, curPh = '', lastLq = -1, redAt = 0, light = 'g';
    let endAt = 0, lightEndAt = 0; const botS = []; // host bot sims
    const shared = () => (isHost() ? hs : (net && net.state) || hs);
    const nameOf = (id) => { const v = ppl.get(id); if (v) return v.name; const p = net && net.players[id]; return (p && p.name) || 'Pal'; };
    // ------------------------------------------------------------ arenas (one per round, rebuilt between rounds)
    let arena = null, kind = '', obs = [], carts = [], tiles = [], plat = null, rope = null, watcher = null, platR = 9, cookieKind = 'circle';
    const ARENA_Z = -20;
    function clearArena() { if (arena) { scene.remove(arena); arena.traverse((o) => { if (o.geometry && !LOD.has(o.geometry)) o.geometry.dispose?.(); }); } arena = new THREE.Group(); scene.add(arena); obs = []; carts = []; tiles = []; plat = null; rope = null; watcher = null; foam.visible = pitWall.visible = false; ground.visible = true; holed.visible = false; }
    const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = !!Q.shadows; m.receiveShadow = true; arena.add(m); return m; };
    function lineTex(check) { return canvasTex(256, 32, (c) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { c.fillStyle = check ? ((i + j) % 2 ? '#222' : '#fff') : '#fff'; c.fillRect(i * 16, j * 16, 16, 16); } }); }
    function makeWatcher() { // Sunny Bloom: a giant friendly robot sunflower (original design)
      const w = new THREE.Group(); const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 9, 12), Lm(0x4caf50)); stem.position.y = 4.5; w.add(stem);
      for (const s of [-1, 1]) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), Lm(0x5cc85c)); lf.scale.set(1.6, 0.25, 0.8); lf.position.set(s * 2, 3.5, 0); lf.rotation.z = s * 0.4; w.add(lf); }
      const head = new THREE.Group(); head.position.y = 10.5; w.add(head);
      const petals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), Lm(0xffd23f, { emissive: 0xffa000, emissiveIntensity: 0.25 }), 16); const o = new THREE.Object3D();
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; o.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, -0.2); o.rotation.set(0, 0, a); o.scale.set(1.5, 0.75, 0.3); o.updateMatrix(); petals.setMatrixAt(i, o.matrix); } head.add(petals);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.6, 28), Lm(0x8a5a2b)); back.rotation.x = Math.PI / 2; head.add(back);
      const face = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), Lm(0xb07a3e, { emissive: 0x402000, emissiveIntensity: 0.2 })); face.position.z = 0.31; head.add(face);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0x7dffb0 }); const eyes = []; for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), eyeM); e.scale.z = 0.4; e.position.set(s * 1, 0.5, 0.4); head.add(e); eyes.push(e); }
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.14, 6, 18, Math.PI), new THREE.MeshBasicMaterial({ color: 0x3a2010 })); smile.rotation.z = Math.PI; smile.position.set(0, -0.6, 0.4); head.add(smile);
      const ant = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6b9a })); ant.position.set(0, 5.6, -0.3); head.add(ant);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(14, 70, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xff6b9a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); beam.rotation.x = -Math.PI / 2; beam.position.set(0, -4, 35); head.add(beam);
      w.userData = { head, eyeM, ant, beam, rot: Math.PI, target: Math.PI }; return w; }
    function buildArena(k) { clearArena(); kind = k; const st = shared();
      if (k === 'rlgl') { const track = new THREE.Mesh(new THREE.PlaneGeometry(32, 90), Lm(0xe8d5a8, { map: PATH.map, normalMap: PATH.normalMap })); track.rotation.x = -Math.PI / 2; add(track, 0, 0.005, -36);
        const sl = new THREE.Mesh(new THREE.PlaneGeometry(32, 1), Lm(0xffffff, { map: lineTex(false) })); sl.rotation.x = -Math.PI / 2; add(sl, 0, 0.02, 0);
        const fl = new THREE.Mesh(new THREE.PlaneGeometry(32, 1.6), Lm(0xffffff, { map: lineTex(true) })); fl.rotation.x = -Math.PI / 2; add(fl, 0, 0.02, -70);
        for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 10), Lm(0xff6b9a)); add(post, s * 16, 3, -70); }
        const arch = new THREE.Mesh(new THREE.TorusGeometry(16, 0.35, 8, 40, Math.PI), Lm(0xffd23f)); add(arch, 0, 6, -70);
        const seed = (st && st.seed) || 1; // flower planters (static obstacles) + rolling hay carts (moving obstacles) further down the track
        for (let i = 0; i < 9; i++) { const x = (hash(seed, 50 + i) - 0.5) * 24, z = -14 - i * 5.8; const r = 1.1; const pl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 1.1, 14), Lm(0xc0623a)); add(pl, x, 0.55, z);
          const fl2 = new THREE.Mesh(new THREE.SphereGeometry(r * 0.9, 10, 8), Lm(new THREE.Color(COLS[i % COLS.length]))); fl2.scale.y = 0.6; add(fl2, x, 1.25, z); obs.push({ x, z, r: r + 0.35 }); }
        for (let i = 0; i < 2; i++) { const c = new THREE.Group(); const hay = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2.4, 14), Lm(0xf2c94c)); hay.rotation.z = Math.PI / 2; hay.position.y = 1; c.add(hay); add(c, 0, 0, -38 - i * 16); carts.push({ g: c, hay, z: -38 - i * 16, amp: 11, spd: 0.55 + i * 0.2, ph: i * 2 }); }
        watcher = makeWatcher(); arena.add(watcher); watcher.position.set(0, 0, -84); watcher.scale.setScalar(1.3); }
      else if (k === 'cookie' || k === 'marbles') { const disk = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.5, 0.3, 48), Lm(k === 'cookie' ? 0xffc8dc : 0xc8e6ff)); add(disk, 0, 0.15 - 0.3, ARENA_Z);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(15, 0.25, 8, 64), Lm(0xffffff)); ring.rotation.x = Math.PI / 2; add(ring, 0, 0.05, ARENA_Z);
        const tm = Lm(0xffffff, { map: WOOD.map }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.15, 20), tm); add(t, Math.cos(a) * 8, 1, ARENA_Z + Math.sin(a) * 8); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1, 8), tm); add(leg, Math.cos(a) * 8, 0.5, ARENA_Z + Math.sin(a) * 8);
          const top = k === 'cookie' ? new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 20), Lm(0xe8b04a)) : new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), Lm(new THREE.Color(COLS[i]))); add(top, Math.cos(a) * 8, 1.15, ARENA_Z + Math.sin(a) * 8); } }
      else if (k === 'tug') { foam.visible = pitWall.visible = true; const dm = Lm(0xffffff, { map: WOOD.map });
        add(new THREE.Mesh(new THREE.BoxGeometry(12, 1, 18), dm), 0, -0.5, ARENA_Z + 13); add(new THREE.Mesh(new THREE.BoxGeometry(12, 1, 18), dm), 0, -0.5, ARENA_Z - 13);
        for (const [z, c] of [[ARENA_Z + 21, 0xff6b9a], [ARENA_Z - 21, 0x4aa8ff]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 0.3), Lm(c)); add(f, 0, 1.5, z); }
        rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 44, 8), Lm(0xd9b26a)); rope.rotation.x = Math.PI / 2; add(rope, 0, 0.9, ARENA_Z);
        const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.5), Lm(0xffd23f)); flag.position.y = 0.4; rope.add(flag); rope.userData.flag = flag; }
      else if (k === 'tiles') { foam.visible = pitWall.visible = true; const dm = Lm(0xffffff, { map: WOOD.map }); add(new THREE.Mesh(new THREE.BoxGeometry(14, 1, 8), dm), 0, -0.5, 0); add(new THREE.Mesh(new THREE.BoxGeometry(14, 1, 9), dm), 0, -0.5, -41.5);
        const gm = new THREE.MeshPhongMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.72, shininess: 90, specular: 0xffffff });
        for (let r = 0; r < 8; r++) { tiles.push([]); for (let s = 0; s < 2; s++) { const t = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 2.6), gm.clone()); add(t, s ? 2 : -2, -0.125, -6.3 - r * 4); t.userData = { r, s, broken: false }; tiles[r].push(t); } }
        for (const s of [-1, 1]) for (let r = 0; r < 9; r++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), Lm(0xb48cff)); add(p, s * 4, 0, -4.3 - r * 4); } }
      else if (k === 'duel') { foam.visible = pitWall.visible = true; plat = new THREE.Mesh(new THREE.CylinderGeometry(9, 7, 1.2, 48), Lm(0xffd23f, { map: GRASS.map })); add(plat, 0, -0.6, ARENA_Z);
        const crown = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.3, 8, 20), Lm(0xffb020, { emissive: 0xff8000, emissiveIntensity: 0.4 })); crown.rotation.x = Math.PI / 2; add(crown, 0, 8, ARENA_Z); plat.userData.crown = crown; platR = 9; }
      if (foam.visible) { ground.visible = false; holed.visible = true; } sun.target.position.set(0, 0, ARENA_Z); }
    const floating = () => kind === 'tiles' || kind === 'duel' || kind === 'tug';
    function inCZ(x, z) { return x > CZ.x0 - 1 && x < CZ.x1 + 0.5 && z > CZ.z0 - 1 && z < CZ.z1 + 1; }
    function groundAt(x, z) { if (inCZ(x, z)) return CZ.y;
      if (kind === 'tiles') { if (Math.abs(x) < 7 && z < 4 && z > -4) return 0; if (Math.abs(x) < 7 && z < -37 && z > -46) return 0;
        for (const row of tiles) for (const t of row) if (!t.userData.broken && Math.abs(x - t.position.x) < 1.45 && Math.abs(z - t.position.z) < 1.45) return 0; return null; }
      if (kind === 'duel') return Math.hypot(x, z - ARENA_Z) < platR ? 0 : null;
      if (kind === 'tug') return Math.abs(x) < 6 && (Math.abs(z - ARENA_Z) > 4 && Math.abs(z - ARENA_Z) < 22) ? 0 : null;
      return 0; }
    function tileAt(x, z) { for (const row of tiles) for (const t of row) if (Math.abs(x - t.position.x) < 1.45 && Math.abs(z - t.position.z) < 1.45) return t; return null; }
    function bounds(x, z) { if (inCZ(x, z) || meOut()) return [clamp(x, CZ.x0, CZ.x1), clamp(z, CZ.z0, CZ.z1)];
      if (kind === 'rlgl') return [clamp(x, -15, 15), clamp(z, -80, 8)]; if (kind === 'cookie' || kind === 'marbles') { const d = Math.hypot(x, z - ARENA_Z); return d > 14.5 ? [x * 14.5 / d, ARENA_Z + (z - ARENA_Z) * 14.5 / d] : [x, z]; }
      return [clamp(x, -17, 17), clamp(z, -55, 8)]; }
    function spot(i, n) { if (kind === 'rlgl') return [-13.5 + (i % 10) * 3, 3 + Math.floor(i / 10) * 1.8, Math.PI];
      if (kind === 'tiles') return [-5.5 + (i % 6) * 2.2, 3 - Math.floor(i / 6) * 1.4, Math.PI];
      if (kind === 'duel') { const a = i / Math.max(1, n) * TAU; return [Math.cos(a) * 5.5, ARENA_Z + Math.sin(a) * 5.5, Math.atan2(-Math.cos(a), -Math.sin(a))]; }
      if (kind === 'tug') return [0, ARENA_Z + 6, Math.PI];
      const a = i / Math.max(1, n) * TAU; const r = n > 12 ? 11 : 6.5; return [Math.cos(a) * r, ARENA_Z + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a))]; }
    function tugSpot(id, st) { const A = st.teams || []; const inA = A.includes(id); const team = inA ? A : st.alive.filter((u) => !A.includes(u)); const j = team.indexOf(id); const off = st.rope || 0;
      return [(j % 2 ? 0.55 : -0.55), ARENA_Z + (inA ? 1 : -1) * (5 + j * 1.25) + off, inA ? Math.PI : 0]; }
    const meOut = () => me.out;
    // ------------------------------------------------------------ controls (shared js/controls.js, same as Zombie Survival)
    const C = createControls(el, { tutorialKey: 'show', tutorialTitle: '🎪 Kemy Challenge Show',
      tips: ['👈 Thumb anywhere on the left: walk (push far to run)', '👉 Drag on the right: look around', '🦘 Jump · ⭐ Action button changes each round (Pull, Bump…)', '🌻 Freeze Dash: move on GREEN, freeze on RED!', 'Out? You bubble-poof to the 📣 Cheer Zone. Keep cheering with 😊 and 💬!'],
      buttons: [{ id: 'act', icon: '⭐', label: 'Action', big: 1 }, { id: 'jump', icon: '🦘', label: 'Jump' }],
      keys: { ' ': 'jump', f: 'act', Enter: 'act', e: 'act' } });
    C.on('jump', () => { if (me.ground && canMove() && !me.bubbleT) { me.vy = 7.4; me.ground = false; } });
    C.on('act', () => onAct());
    let paused = false; C.on('settings:open', () => (paused = true)); C.on('settings:closed', () => (paused = false));
    attachGfxSettings(C, () => { const q = gfxPreset(); prMax = dprFor({ dpr: Math.min(q.dpr, 2) }); pr = prMax; R.setPixelRatio(pr); resize(); R.shadowMap.enabled = q.shadows; fpsTag.hidden = !gfxShowFps(); });
    const fpsTag = document.createElement('span'); fpsTag.className = 'sg-pill'; fpsTag.style.cssText = 'position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:5;pointer-events:none'; fpsTag.hidden = !gfxShowFps(); el.appendChild(fpsTag);
    let pitch = 0.3, pov = false, specId = '';
    $('[data-t="pov"]').onclick = () => { pov = !pov; };
    // pause menu (the show keeps running for everyone else; your Pal just stands still while it's open)
    $('[data-t="pause"]').onclick = () => { paused = true; const d = panel(`<h2>⏸️ Menu</h2><p class="small" style="opacity:.8">The show keeps going for everyone else!</p><div class="row" style="flex-direction:column"><button data-r>▶ Resume</button><button class="ghost" data-c>⚙️ Controls &amp; Graphics</button><button class="ghost" data-z>🔍 Reset view</button><button class="ghost" data-q>🚪 Leave the show</button></div>`);
      d.querySelector('[data-r]').onclick = () => { paused = false; closePanel(); }; d.querySelector('[data-c]').onclick = () => { closePanel(); C.settings(); };
      d.querySelector('[data-z]').onclick = () => { try { window.__kemyNoZoom && window.__kemyNoZoom.reset(); } catch { /* */ } resize(); paused = false; closePanel(); msg('🔍 View reset', 1); };
      d.querySelector('[data-q]').onclick = () => { destroy(); location.hash = '#/arcade/show'; }; };
    $('[data-t="spec"]').onclick = () => { const st = shared(); const al = (st && st.alive || []).filter((u) => ppl.has(u)); if (!al.length) { specId = ''; return; } const i = al.indexOf(specId); specId = i + 1 >= al.length ? '' : al[i + 1]; msg(specId ? `👀 Watching ${esc(nameOf(specId))}` : '📣 Back to the Cheer Zone', 1.2); };
    const fwd = () => [Math.sin(me.yaw), Math.cos(me.yaw)];
    // quick chat + emotes: speech bubble over your Pal, synced with the same em codec as Zombie co-op (preset phrases only)
    let lastEm = 0, myBubT = 0;
    function sayEm(i, text) { if (Date.now() - lastEm < 1200) return; lastEm = Date.now(); me.em = i; me.emAt = Date.now(); meV.bub.material.map = nameTex(text); meV.bub.visible = true; myBubT = 3; sendMe(true); }
    $('[data-t="chat"]').onclick = () => { const e = $('.sg-emo'); e.hidden = !e.hidden; if (!e.hidden) renderQuickChat(e, (x) => { const i = zSayIdx(x); if (i < 0) return; e.hidden = true; sayEm(i, x); }, ZTABS); };
    try { loadOwnedEmotes(db, uid)?.catch?.(() => {}); } catch { /* offline */ }
    $('[data-t="wheel"]').onclick = () => { $('.sg-emo').hidden = true; Promise.resolve().then(() => loadOwnedEmotes(db, uid)).catch(() => {}).then(() => openWheel({ onEmote: (id) => { const i = zEmoteIdx(id); me.emo = id; me.emoUntil = performance.now() + emoteMs(id); if (i >= 0) sayEm(i, zText(i)); }, onLocked: (d) => msg(`🔒 ${d.name}: unlock it in the Dance Shop`, 1.6) })); };
    // ------------------------------------------------------------ network: my doc (adaptive rate to stay inside the Firestore free tier)
    let sendT = 0, lastSent = { x: 0, z: 0, y: 0 }, mySlot = 0;
    function sendMe(force) { if (!net) return; const n = Object.keys(net.players).length; const moved = Math.hypot(me.x - lastSent.x, me.z - lastSent.z) > 0.25 || Math.abs(me.y - lastSent.y) > 0.3;
      const gap = moved ? clamp(n * 55, 300, 1600) : 5000; if (!force && performance.now() - sendT < gap) return; sendT = performance.now(); lastSent = { x: me.x, z: me.z, y: me.y };
      net.send({ x: +me.x.toFixed(2), y: +clamp(me.y, -19, 39).toFixed(2), z: +me.z.toFixed(2), f: +me.face.toFixed(2), v: +Math.min(50, me.spd || 0).toFixed(2), st: me.st, r: me.r ?? -1, sc: Math.round(me.sc), tp: me.tp, bp: me.bp.slice(-24), em: me.em, emAt: me.emAt }); }
    function syncPlayers() { if (!net) return; const P = net.players;
      for (const [u, d] of Object.entries(P)) { if (u === uid) { mySlot = d.slot; continue; } let v = ppl.get(u); if (!v) { v = addPal(u, d.pal || { species: 'kemy' }, d.name || 'Pal'); Object.assign(v, { x: d.x, y: d.y, z: d.z, tx: d.x, ty: d.y, tz: d.z }); v.emSeen = d.emAt; }
        Object.assign(v, { tx: d.x, ty: d.y, tz: d.z, tf: d.f, slot: d.slot, st: d.st, r: d.r });
        if (d.em >= 0 && d.emAt !== v.emSeen) { v.emSeen = d.emAt; v.bub.material.map = nameTex(zText(d.em)); v.bub.visible = true; v.bubT = 3; const eid = zEmoteOf(d.em); if (eid) { v.emo = eid; v.emoUntil = performance.now() + emoteMs(eid); } }
        // bumps aimed at me (Bumper Summit), deduped per sender by sequence
        if (Array.isArray(d.bp)) for (let i = 0; i + 3 < d.bp.length; i += 4) { if (d.bp[i] === mySlot && d.bp[i + 3] > (v.bpSeen || 0)) { v.bpSeen = d.bp[i + 3]; if (kind === 'duel' && !me.out) bumped(d.bp[i + 1] / 10, d.bp[i + 2] / 10); } }
        if (isHost()) hostSeePlayer(u, d, v); }
      for (const [u] of ppl) if (u !== uid && u.length > 3 && !P[u]) { dropPal(u); } }
    function bumped(dx, dz) { const l = Math.hypot(dx, dz) || 1; me.kx += dx / l * 11; me.kz += dz / l * 11; me.vy = Math.max(me.vy, 3.5); me.ground = false; snd('bump'); buzz(30); msg('💥 Bonk!', 0.6); }
    // ------------------------------------------------------------ host: runs the show (timers, watcher, bots, results)
    const RED_GRACE = 0.35, HOST_TOL = 0.9; // s of grace after FREEZE (client) / grace + latency tolerance (host check)
    const hostSeen = {}; const hostKO = new Set(); let tapSeen = {}, tugT = 0, pushT = 0, dirty = false;
    function humans() { return solo ? [uid] : Object.entries(net.players).sort((a, b) => a[1].slot - b[1].slot).map(([u]) => u); }
    function hostInit() { const hu = humans().slice(0, SHOW.MAX); const nb = clamp(nBots0, 0, 14); const seed = 1 + Math.floor(Math.random() * 1e6);
      const all = [...hu, ...Array.from({ length: nb }, (_, i) => 'b' + i)]; const N = all.length;
      const plan = N >= 6 ? PLAN.slice() : N >= 3 ? ['rlgl', 'cookie', 'tiles', 'duel'] : ['rlgl', 'marbles', 'duel'];
      const forced = planOpt || window.__showPlan; if (Array.isArray(forced)) plan.splice(0, plan.length, ...forced.filter((x) => ROUNDS[x])); // casual practice / test harness
      hs = { ph: 'intro', rd: 0, nx: 0, plan, left: 6, light: 'g', lq: 0, ll: 0, alive: all, out: [], elim: {}, teams: [], pairs: [], rope: 0, seed, rev: [], nb, bots: [], bb: [], champ: [], casual: !!casual, seq: 1 };
      phaseEnd = performance.now() + 6000; botInit(); push(true); }
    function push(now) { if (!hs) return; dirty = true; if (now) flushHs(); }
    function flushHs() { if (!hs || !dirty) return; dirty = false; pushT = performance.now(); const t = performance.now();
      hs.left = Math.max(0, Math.round((phaseEnd - t) / 100) / 10); hs.ll = Math.max(0, Math.round((lightEnd - t) / 100) / 10); hs.seq++;
      hs.bots = []; for (const b of botS) hs.bots.push(Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.z * 10), Math.round(b.f * 10), b.st);
      if (net) net.sendState(JSON.parse(JSON.stringify(hs))); }
    function botInit() { botS.length = 0; for (let i = 0; i < hs.nb; i++) botS.push({ id: 'b' + i, i, x: CZ.x0 + 1 + (i % 4) * 2, y: CZ.y, z: CZ.z0 + 2 + i, f: -Math.PI / 2, vy: 0, st: 0, sc: 0, kx: 0, kz: 0, t: 0, react: 0, done: 0, row: -1, spd: rnd(3, 5.4), tap: rnd(0.8, 1.35), cd: rnd(1, 3), alive: true }); }
    const bAlive = (b) => hs.alive.includes(b.id);
    function hostSeePlayer(u, d) { // fair FREEZE check on the host: reported speed + position change, after grace + latency tolerance
      if (!hs || hs.ph !== 'play' || hs.plan[hs.rd] !== 'rlgl' || hs.casual || !hs.alive.includes(u) || d.r !== hs.rd || d.st !== 0) return;
      if (hs.light !== 'r' || performance.now() - redAt < HOST_TOL * 1000) { delete hostSeen[u]; return; }
      const prev = hostSeen[u]; hostSeen[u] = { x: d.x, z: d.z };
      if (d.v > 1.3 || (prev && Math.hypot(d.x - prev.x, d.z - prev.z) > 0.9)) { hostKO.add(u); if (!hs.out.includes(u)) { hs.elim[u] = hs.rd * 10000 + clamp(Math.round(-d.z), 0, 9999); hs.out.push(u); hs.alive = hs.alive.filter((x) => x !== u); push(true); } } }
    function resOf(id) { if (id[0] === 'b' && id.length <= 3) { const b = botS[Number(id.slice(1))]; return b ? { st: b.st, sc: b.sc, r: hs.rd } : { st: 2, sc: 0 }; }
      if (id === uid) return { st: me.st, sc: me.sc, r: me.r, tp: me.tp }; const p = net && net.players[id]; if (!p || !net.fresh(id)) return { st: 2, sc: 0, r: -1, gone: 1 }; return p; }
    function beginPlay() { const k = hs.plan[hs.rd]; hs.ph = 'play'; phaseEnd = performance.now() + ROUNDS[k].time * 1000; hostKO.clear(); tapSeen = {}; hs.rope = 0; hs.rev = []; hs.bb = []; hs.teams = []; hs.pairs = [];
      const order = hs.alive.slice().sort((a, b) => hash(hs.seed + hs.rd, a.length + a.charCodeAt(0) * 7 + a.charCodeAt(a.length - 1)) - hash(hs.seed + hs.rd, b.length + b.charCodeAt(0) * 7 + b.charCodeAt(b.length - 1)));
      if (k === 'rlgl') { hs.light = 'g'; hs.lq++; lightEnd = performance.now() + rnd(3, 5) * 1000; redAt = 0; }
      if (k === 'tug') hs.teams = order.filter((_, i) => i % 2 === 0);
      if (k === 'marbles') hs.pairs = order;
      botS.forEach((b, i) => { Object.assign(b, { st: 0, sc: 0, t: 0, kx: 0, kz: 0, vy: 0, done: 0, row: -1, cd: rnd(1, 3), react: 0, moving: false }); if (bAlive(b)) { const ix = hs.alive.indexOf(b.id); const s = k === 'tug' ? tugSpot(b.id, hs) : spot(ix, hs.alive.length); b.x = s[0]; b.z = s[1]; b.y = 0; b.f = s[2]; } else { b.x = CZ.x0 + 1 + (i % 4) * 2; b.z = CZ.z0 + 2 + i * 1.5; b.y = CZ.y; b.f = -Math.PI / 2; } });
      push(true); }
    function finishRound() { const k = hs.plan[hs.rd]; const ids = hs.alive.slice(); let pass = [];
      const sc = (id) => Number(resOf(id).sc) || 0;
      if (k === 'tug') { const A = hs.teams, B = ids.filter((u) => !A.includes(u)); pass = hs.rope > 0.25 ? A : hs.rope < -0.25 ? B : ids; }
      else if (k === 'marbles') { const P = hs.pairs; for (let i = 0; i < P.length; i += 2) { const a = P[i], b = P[i + 1]; if (!b) { pass.push(a); continue; } const ra = resOf(a), rb = resOf(b); const sa = ra.r === hs.rd ? sc(a) : 0, sb = rb.r === hs.rd ? sc(b) : 0; if (sa >= sb) pass.push(a); if (sb >= sa) pass.push(b); } }
      else if (k === 'duel') pass = ids.filter((id) => { const r = resOf(id); return !hostKO.has(id) && r.st !== 2 && !r.gone; });
      else pass = ids.filter((id) => { const r = resOf(id); return !hostKO.has(id) && r.st === 1 && (r.r === hs.rd || id[0] === 'b'); });
      if (k === 'duel' && !pass.length) { const best = Math.max(...ids.map(sc)); pass = ids.filter((id) => sc(id) >= best); }
      if (!pass.length && k !== 'duel') pass = ids; // nobody made it: everyone gets another chance
      for (const id of ids) if (!pass.includes(id)) { hs.elim[id] = hs.rd * 10000 + clamp(Math.round(sc(id)), 0, 9999); if (!hs.out.includes(id)) hs.out.push(id); }
      hs.alive = pass;
      if (k === 'duel' || pass.length <= 1 || hs.rd >= hs.plan.length - 1) { hs.ph = 'end'; hs.champ = pass.slice(); phaseEnd = performance.now(); push(true); return; }
      let nx = hs.rd + 1; while (nx < hs.plan.length - 1 && ((hs.plan[nx] === 'tug' && pass.length < 4) || pass.length <= 2)) nx++;
      hs.nx = Math.min(nx, hs.plan.length - 1); hs.ph = 'inter'; phaseEnd = performance.now() + 9000; push(true); }
    function hostStep(dt) { const t = performance.now(); const k = hs.plan[hs.rd];
      if (hs.ph === 'intro' && t >= phaseEnd) beginPlay();
      else if (hs.ph === 'inter' && t >= phaseEnd) { hs.rd = hs.nx; hs.ph = 'intro'; phaseEnd = t + 6000; push(true); }
      else if (hs.ph === 'play') {
        if (k === 'rlgl') { if (t >= lightEnd) { const L0 = hs.light; // green → (fake-out | turning) → red → green; varied timing
            if (L0 === 'g') { if (Math.random() < 0.18) { hs.light = 'f'; lightEnd = t + 900; } else { hs.light = 't'; lightEnd = t + 650; } }
            else if (L0 === 'f') { hs.light = 'g'; lightEnd = t + rnd(1.2, 3) * 1000; }
            else if (L0 === 't') { hs.light = 'r'; redAt = t; lightEnd = t + rnd(2, 3.6) * 1000; }
            else { hs.light = 'g'; const el2 = (t - (phaseEnd - ROUNDS.rlgl.time * 1000)) / 1000; lightEnd = t + rnd(1.6, el2 > 30 ? 3.2 : 4.8) * 1000; }
            hs.lq++; push(true); } }
        if (k === 'tug' && t - tugT > 500) { tugT = t; const A = hs.teams, B = hs.alive.filter((u) => !A.includes(u)); const pw = (team) => { let s = 0; for (const id of team) { const r = resOf(id); const tp = id[0] === 'b' && id.length <= 3 ? botS[+id.slice(1)].sc : (r.r === hs.rd ? r.tp || 0 : 0); s += Math.max(0, tp - (tapSeen[id] ?? tp)); tapSeen[id] = tp; } return s / Math.max(1, team.length); };
          const d = pw(A) - pw(B); hs.rope = clamp(hs.rope + d * 0.55, -4, 4); push(); if (Math.abs(hs.rope) >= 4) { phaseEnd = t; } }
        if (k === 'tiles') { for (const id of hs.alive) { const r = resOf(id); const tp = id[0] === 'b' && id.length <= 3 ? 0 : r.r === hs.rd ? r.tp : 0; if (tp > 0 && !hs.rev.includes(tp - 1)) { hs.rev.push(tp - 1); push(true); } } }
        // humans' bumps on bots
        if (k === 'duel' && net) for (const [u, p] of Object.entries(net.players)) { if (u === uid || !Array.isArray(p.bp)) continue; const seen = hostSeen['bp' + u] || 0; let top = seen; for (let i = 0; i + 3 < p.bp.length; i += 4) { if (p.bp[i + 3] <= seen) continue; top = Math.max(top, p.bp[i + 3]); const b = botS[p.bp[i] - 100]; if (b) botBump(b, p.bp[i + 1] / 10, p.bp[i + 2] / 10); } hostSeen['bp' + u] = top; }
        botStep(dt, k);
        const unresolved = hs.alive.filter((id) => { const r = resOf(id); return !r.gone && !hostKO.has(id) && !(r.r === hs.rd && r.st !== 0) && !(id[0] === 'b' && id.length <= 3 && r.st !== 0); });
        const duelLeft = k === 'duel' ? hs.alive.filter((id) => { const r = resOf(id); return r.st !== 2 && !r.gone; }).length : 9;
        if (t >= phaseEnd || (k !== 'tug' && k !== 'duel' && !unresolved.length) || duelLeft <= 1) finishRound(); }
      if (t - pushT > (hs.ph === 'play' && botS.some(bAlive) ? 350 : 1500)) push();
      if (dirty && t - pushT > 380) flushHs(); }
    function botBump(b, dx, dz) { const l = Math.hypot(dx, dz) || 1; b.kx += dx / l * 11; b.kz += dz / l * 11; b.vy = 3.5; }
    function botStep(dt, k) { const t = performance.now(); const el2 = ROUNDS[k].time - (phaseEnd - t) / 1000;
      for (const b of botS) { b.t += dt; if (!bAlive(b) || b.st !== 0) { if (b.st === 2 && b.y > -5.5 && floating() && !inCZ(b.x, b.z)) { b.vy -= 20 * dt; b.y = Math.max(-5.5, b.y + b.vy * dt); } continue; }
        if (k === 'rlgl') { const L0 = hs.light; if (L0 === 'g' || L0 === 'f') { b.react = 0; if (!(L0 === 'f' && Math.random() < 0.02)) b.moving = true; }
          else { if (b.stopAt == null) b.stopAt = t + rnd(150, 1150); if (t > b.stopAt) b.moving = false; if (L0 === 'r' && b.moving && t - redAt > RED_GRACE * 1000) { b.st = 2; b.sc = -b.z; } }
          if (L0 === 'g' || L0 === 'f') b.stopAt = null;
          if (b.moving) { b.z -= b.spd * dt; b.x += Math.sin(b.t * 0.7 + b.i) * dt * 1.2; for (const o of obs) { const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz); if (d < o.r + 0.3) { b.x += (dx / (d || 1)) * (o.r + 0.3 - d) + (b.i % 2 ? 0.05 : -0.05); } } b.x = clamp(b.x, -15, 15); b.f = Math.PI; }
          if (b.z < -70) { b.st = 1; b.moving = false; } }
        else if (k === 'cookie') { if (!b.done) b.done = rnd(12, 42); if (el2 > b.done) { b.st = hash(hs.seed, b.i * 13 + hs.rd) < 0.72 ? 1 : 2; b.sc = b.st === 1 ? 100 : rnd(30, 80); } }
        else if (k === 'marbles') { if (!b.done) b.done = rnd(8, 24); if (el2 > b.done) { b.sc = Math.round(rnd(80, 270)); b.st = 1; } }
        else if (k === 'tug') { if (Math.random() < b.tap * dt) b.sc++; const s = tugSpot(b.id, hs); b.x = s[0]; b.z = s[1]; b.f = s[2]; }
        else if (k === 'tiles') { b.cd -= dt; if (b.cd <= 0 && b.row < 8) { b.cd = rnd(1.1, 2.6); const nr = b.row + 1;
            if (nr >= 8) { b.z = -40 - (b.i % 3); b.x = -3 + (b.i % 4) * 2; b.st = 1; b.sc = 8; continue; }
            const safe = tileSafe(hs.seed, nr); const known = hs.rev.includes(nr * 2 + (1 - safe)); const pick = known ? safe : Math.random() < 0.5 ? 0 : 1; b.row = nr; b.x = pick ? 2 : -2; b.z = -6.3 - nr * 4; b.sc = nr;
            if (pick !== safe) { if (!hs.rev.includes(nr * 2 + pick)) hs.rev.push(nr * 2 + pick); b.st = 2; b.vy = 2; push(true); } } }
        else if (k === 'duel') { b.sc = el2; b.cd -= dt; const dx0 = -b.x, dz0 = ARENA_Z - b.z; let tx = dx0, tz = dz0;
          let near = null, nd = 99; for (const [id, v] of ppl) { if (id === b.id || !hs.alive.includes(id)) continue; const vx = id === uid ? me.x : v.x, vz = id === uid ? me.z : v.z; const d = Math.hypot(vx - b.x, vz - b.z); if (d < nd) { nd = d; near = { id, x: vx, z: vz }; } }
          if (near && nd < 5) { tx = near.x - b.x; tz = near.z - b.z; } const l = Math.hypot(tx, tz) || 1; b.x += tx / l * 2.6 * dt; b.z += tz / l * 2.6 * dt; b.f = Math.atan2(tx, tz);
          if (near && nd < 1.7 && b.cd <= 0) { b.cd = rnd(1.4, 3); const ux = (near.x - b.x) / (nd || 1), uz = (near.z - b.z) / (nd || 1);
            if (near.id[0] === 'b' && near.id.length <= 3) botBump(botS[+near.id.slice(1)], ux, uz); else { const slot = near.id === uid ? (solo ? 0 : mySlot) : ppl.get(near.id).slot; if (near.id === uid) bumped(ux, uz); else { hs.bb.push(slot, Math.round(ux * 10), Math.round(uz * 10), (hs.bbq = (hs.bbq || 0) + 1)); hs.bb = hs.bb.slice(-24); push(true); } } } }
        // bot physics (knockback + falling)
        if (b.kx || b.kz) { b.x += b.kx * dt; b.z += b.kz * dt; b.kx *= Math.pow(0.04, dt); b.kz *= Math.pow(0.04, dt); if (Math.abs(b.kx) + Math.abs(b.kz) < 0.05) b.kx = b.kz = 0; }
        if (k === 'duel' || k === 'tiles') { const g = k === 'duel' ? (Math.hypot(b.x, b.z - ARENA_Z) < platR ? 0 : null) : (b.st === 2 ? null : 0); b.vy -= 20 * dt; b.y += b.vy * dt; if (g !== null && b.y <= 0 && b.y > -0.6) { b.y = 0; b.vy = 0; } if (b.y < -1.5 && b.st === 0) { b.st = 2; } } } }
    // ------------------------------------------------------------ client: follow the shared show state
    let panelEl = null, mini = null, survived = 0, rewarded = false, beatT0 = 0;
    const poofed = new Set();
    function panel(html, cls = '') { closePanel(); const d = document.createElement('div'); d.className = 'sg-panel ' + cls; d.innerHTML = `<div class="sg-card">${html}</div>`; el.appendChild(d); panelEl = d; return d; }
    function closePanel() { if (panelEl) { panelEl.remove(); panelEl = null; } }
    const hoot = (t) => `<div class="sg-hoot">${HOOT}<p><small style="opacity:.7">Host Hoot says:</small><br>${t}</p></div>`;
    function meAlive(st) { return st.alive.includes(uid); }
    function sync() { const st = shared(); if (!st || !st.plan) return; const now = performance.now();
      if (st.seq !== stSeen) { stSeen = st.seq; if (!isHost()) { endAt = now + st.left * 1000; lightEndAt = now + st.ll * 1000; } }
      if (isHost()) { endAt = phaseEnd; lightEndAt = lightEnd; }
      // bots from the state (guests) / host sim
      for (let i = 0; i < (st.nb || 0); i++) { const id = 'b' + i; let v = ppl.get(id); if (!v) { const bp = botPal(st.seed, i); v = addPal(id, bp, bp.name); }
        if (isHost()) { const b = botS[i]; if (b) Object.assign(v, { tx: b.x, ty: b.y, tz: b.z, tf: b.f }); } else if (st.bots && st.bots.length >= (i + 1) * 5) { v.tx = st.bots[i * 5] / 10; v.ty = st.bots[i * 5 + 1] / 10; v.tz = st.bots[i * 5 + 2] / 10; v.tf = st.bots[i * 5 + 3] / 10; } }
      // bumps from bots (guests)
      if (!isHost() && kind === 'duel' && Array.isArray(st.bb)) for (let i = 0; i + 3 < st.bb.length; i += 4) if (st.bb[i] === mySlot && st.bb[i + 3] > (sync.bbSeen || 0)) { sync.bbSeen = st.bb[i + 3]; if (!me.out) bumped(st.bb[i + 1] / 10, st.bb[i + 2] / 10); }
      const k = st.plan[st.rd];
      if (st.rd !== curRd || st.ph !== curPh) { const prevPh = curPh; const rdChanged = st.rd !== curRd; curRd = st.rd; curPh = st.ph; onPhase(st, k, prevPh, rdChanged); }
      for (const id of st.out) if (!poofed.has(id)) { poofed.add(id); poof(id, st); }
      if (k === 'rlgl' && st.ph === 'play' && st.lq !== lastLq) { lastLq = st.lq; setLight(st.light); }
      if (k === 'tiles') for (const ix of st.rev || []) { const t = tiles[ix >> 1] && tiles[ix >> 1][ix & 1]; if (t && !t.userData.broken) breakTile(t); }
      if (k === 'tug' && rope) { rope.position.z = ARENA_Z + (st.rope || 0); }
      H('rd').textContent = `${ROUNDS[k].icon} R${st.rd + 1} · ${ROUNDS[k].name}`; const left = Math.max(0, Math.ceil((endAt - now) / 1000));
      H('time').textContent = st.ph === 'play' ? `⏱️ ${left}s` : st.ph === 'end' ? '🏁' : `⏳ ${left}s`; H('alive').textContent = `👥 ${st.alive.length} left`; H('dia').textContent = `💎 ${diaNow(st)}`;
      if (st.ph === 'play' && left <= 5 && left > 0 && left !== sync.tk) { sync.tk = left; snd('tick'); }
      const lt = $('.sg-light'); if (k === 'rlgl' && st.ph === 'play') { lt.hidden = false; const L0 = light; lt.className = 'sg-light ' + (L0 === 'r' ? 'r' : L0 === 't' ? 't' : 'g'); lt.querySelector('b').textContent = L0 === 'r' ? '🔴 FREEZE!' : L0 === 't' ? '🟠 Turning…' : `🟢 GO! ${Math.max(0, Math.ceil((lightEndAt - now) / 1000))}`;
        lt.querySelector('s').style.width = L0 === 'g' || L0 === 'f' ? clamp((lightEndAt - now) / 4000, 0, 1) * 100 + '%' : '0%'; } else lt.hidden = true;
      $('[data-t="spec"]').hidden = !me.out; const ch = $('.sg-cheer'); ch.hidden = !me.out || st.ph === 'end'; if (me.out) ch.innerHTML = '📣 You’re in the Cheer Zone! Cheer with 😊 and 💬 · 👀 to watch';
      if (k === 'tug') { const bt = $('.sg-beat'); bt.hidden = !(st.ph === 'play' && meAlive(st) && !me.out); if (!bt.hidden) { const ph2 = ((now - beatT0) / 750) % 1; const near = Math.min(ph2, 1 - ph2) < 0.14 / 0.75; bt.style.borderColor = near ? '#7ee08a' : '#fff'; bt.querySelector('i').style.transform = `scale(${1 - ph2})`; } } else $('.sg-beat').hidden = true; }
    function diaNow(st) { const champ = st.ph === 'end' && (st.champ || []).includes(uid); return Math.min(RUN_CAP, survived * SHOW.PER_ROUND + (champ ? SHOW.CHAMP : 0)); }
    function setLight(L0) { const prev = light; light = L0; if (L0 === 'r') { redAt = performance.now(); snd('red'); buzz(60); $('.sg-flash').classList.add('on'); msg('🔴 FREEZE!', 1); } else { $('.sg-flash').classList.remove('on'); }
      if (L0 === 't') snd('turn'); if (L0 === 'f') { snd('turn'); } if (L0 === 'g' && prev !== 'g') { snd('green'); if (prev === 'f') msg('😜 Fake-out! Keep going!', 1.2); else msg('🟢 GO GO GO!', 0.8); }
      if (watcher) watcher.userData.target = L0 === 'r' || L0 === 't' ? 0 : L0 === 'f' ? Math.PI * 0.55 : Math.PI; }
    function placeMe(st, k) { const ix = st.alive.indexOf(uid); if (ix < 0) return; const s = k === 'tug' ? tugSpot(uid, st) : spot(ix, st.alive.length); me.x = s[0]; me.z = s[1]; me.y = 0; me.vy = 0; me.kx = me.kz = 0; me.yaw = me.face = s[2]; }
    function toCheer() { me.x = rnd(CZ.x0 + 1, CZ.x1 - 1); me.z = rnd(CZ.z0 + 2, CZ.z1 - 2); me.y = CZ.y; me.vy = 0; me.kx = me.kz = 0; me.yaw = -Math.PI / 2; me.face = -Math.PI / 2; }
    function onPhase(st, k, prevPh, rdChanged) { const R0 = ROUNDS[k];
      if (st.ph === 'intro') { closeMini(); if (rdChanged || kind !== k) buildArena(k); light = 'g'; lastLq = st.lq; if (watcher) watcher.userData.target = watcher.userData.rot = Math.PI;
        if (meAlive(st)) { me.out = false; placeMe(st, k); } else if (!me.out) { me.out = true; toCheer(); }
        const d = panel(`${hoot(`<b>Round ${st.rd + 1}: ${R0.icon} ${R0.name}!</b><br>${R0.tip}`)}<p style="margin-top:10px">👥 <b>${st.alive.length}</b> contestant${st.alive.length === 1 ? '' : 's'} ${meAlive(st) ? '· you’re in! 💪' : '· you’re cheering 📣'}</p><p class="small" style="opacity:.8">Starting in a moment…</p>`, 'intro');
        d.style.background = 'rgba(20,10,60,.35)'; d.style.pointerEvents = 'none'; snd('tick'); }
      else if (st.ph === 'play') { closePanel(); me.r = st.rd; me.st = 0; me.sc = 0; me.tp = 0; me.bp = []; me.bubbleT = 0;
        if (meAlive(st) && !me.out) { placeMe(st, k); msg(`${R0.icon} ${R0.name}: GO!`, 1.2); snd('green'); startMini(st, k); } sendMe(true); }
      else if (st.ph === 'inter') { closeMini(); if (meAlive(st) && !me.out) { survived++; me.st = 1; snd('win'); } const nk = st.plan[st.nx]; const R1 = ROUNDS[nk];
        const list = [...st.alive.map((id) => `<span>✅ ${esc(nameOf(id))}${id === uid ? ' (you)' : ''}</span>`), ...st.out.slice(-12).map((id) => `<span class="o">${esc(nameOf(id))}</span>`)].join('');
        panel(`${hoot(meAlive(st) ? `Amazing! You survived <b>${R0.name}</b>! 🎉 Next up: <b>${R1.icon} ${R1.name}</b>.` : `Thanks for playing <b>${R0.name}</b>! Cheer on the others from the Cheer Zone. Next: <b>${R1.icon} ${R1.name}</b>.`)}
          <h2>📊 Standings</h2><p><b>${st.alive.length}</b> survivor${st.alive.length === 1 ? '' : 's'} · ${st.out.length} in the Cheer Zone</p><div class="sg-st">${list}</div><div class="row"><button data-x>👍 Got it</button></div>`, 'inter').querySelector('[data-x]').onclick = closePanel; }
      else if (st.ph === 'end') showEnd(st); }
    function poof(id, st) { const v = ppl.get(id); if (!v) return; v.poofT = 1.6; v.bb.visible = true; snd('poof'); burst(v.x, v.y + 1, v.z);
      if (id === uid) { me.out = true; me.st = 2; closeMini(); buzz(80); msg(st.plan[st.rd] === 'rlgl' ? '🫧 Caught moving! Bubble poof!' : '🫧 Bubble poof! You’re out!', 2.2); me.bubbleT = 1.6; sendMe(true); }
      else msg(`🫧 ${esc(v.name)} poofed!`, 1); }
    // sparkle particles
    const MAXFX = 400, fxPos = new Float32Array(MAXFX * 3).fill(-999), fxCol = new Float32Array(MAXFX * 3), fxV = new Float32Array(MAXFX * 3), fxL = new Float32Array(MAXFX); let fxI = 0;
    const fxG = new THREE.BufferGeometry(); fxG.setAttribute('position', new THREE.BufferAttribute(fxPos, 3)); fxG.setAttribute('color', new THREE.BufferAttribute(fxCol, 3));
    const fx = new THREE.Points(fxG, new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, depthWrite: false, map: canvasTex(32, 32, (c) => { const g = c.createRadialGradient(16, 16, 2, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 32, 32); }) })); fx.frustumCulled = false; scene.add(fx);
    const tmpC = new THREE.Color();
    function burst(x, y, z, n = 40, cols = ['#bfe8ff', '#ffffff', '#ffd6ec', '#d9ccff']) { for (let i = 0; i < n; i++) { const k = fxI = (fxI + 1) % MAXFX; fxPos[k * 3] = x; fxPos[k * 3 + 1] = y; fxPos[k * 3 + 2] = z; const a = Math.random() * TAU, s = rnd(1, 4); fxV[k * 3] = Math.cos(a) * s; fxV[k * 3 + 1] = rnd(1, 5); fxV[k * 3 + 2] = Math.sin(a) * s; fxL[k] = rnd(0.6, 1.3); tmpC.set(cols[i % cols.length]); fxCol[k * 3] = tmpC.r; fxCol[k * 3 + 1] = tmpC.g; fxCol[k * 3 + 2] = tmpC.b; } }
    function breakTile(t) { t.userData.broken = true; t.visible = false; burst(t.position.x, 0, t.position.z, 30); snd('poof'); }
    // ------------------------------------------------------------ round mini-games (overlays) + action button
    function closeMini() { if (mini) { mini.remove(); mini = null; } C.root.style.display = ''; }
    function startMini(st, k) { closeMini(); beatT0 = performance.now();
      C.setLabel('act', k === 'tug' ? '💪' : k === 'duel' ? '💥' : '⭐', k === 'tug' ? 'Pull!' : k === 'duel' ? 'Bump!' : 'Action');
      if (k === 'cookie') cookieGame(st); else if (k === 'marbles') marbleGame(st); }
    function done(ok, sc) { if (me.st !== 0) return; me.st = ok ? 1 : 2; me.sc = sc; sendMe(true); if (ok) { snd('win'); msg('✅ You made it! Waiting for the others…', 2.2); } }
    function cookieGame(st) { C.root.style.display = 'none'; const ix = Math.max(0, st.alive.indexOf(uid)); const [ck, cname] = COOKIES[Math.floor(hash(st.seed + 7, ix) * COOKIES.length)]; cookieKind = ck;
      mini = document.createElement('div'); mini.className = 'sg-mini'; mini.innerHTML = `<div class="lbl">🍪 Trace the ${cname}! Gently…</div><canvas width="600" height="600" style="width:min(86vw,52vh);height:min(86vw,52vh)"></canvas><div class="lbl">Traced</div><div class="bar"><i style="background:#7ee08a"></i></div><div class="lbl">Cracks</div><div class="bar"><i style="background:#ff6b6b"></i></div>`; el.appendChild(mini);
      const c = mini.querySelector('canvas'), x = c.getContext('2d'), bars = mini.querySelectorAll('.bar i'); const pts = shapePts(ck).map(([a, b]) => [300 + a * 230, 300 + b * 230]); const hit = new Uint8Array(pts.length); let crack = 0, last = null, lastT = 0; const cracks = [];
      const draw = () => { x.clearRect(0, 0, 600, 600); x.fillStyle = '#e9b04f'; x.beginPath(); x.arc(300, 300, 285, 0, TAU); x.fill(); x.fillStyle = '#d99a38'; for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(300 + Math.cos(i * 2.4) * 250 * ((i * 37) % 100) / 100, 300 + Math.sin(i * 2.4) * 250 * ((i * 53) % 100) / 100, 6, 0, TAU); x.fill(); }
        x.lineWidth = 16; x.lineCap = x.lineJoin = 'round'; x.strokeStyle = '#b97a22'; x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p))); x.closePath(); x.stroke();
        x.fillStyle = '#fff6c8'; pts.forEach((p, i) => { if (hit[i]) { x.beginPath(); x.arc(p[0], p[1], 9, 0, TAU); x.fill(); } });
        x.strokeStyle = '#5a3210'; x.lineWidth = 4; for (const k2 of cracks) { x.beginPath(); x.moveTo(k2[0], k2[1]); x.lineTo(k2[0] + k2[2], k2[1] + k2[3]); x.lineTo(k2[0] + k2[2] * 1.6 + 8, k2[1] + k2[3] * 1.4); x.stroke(); }
        const cov = hit.reduce((a, b) => a + b, 0) / pts.length; bars[0].style.width = cov * 100 / 0.9 + '%'; bars[1].style.width = Math.min(100, crack) + '%'; return cov; };
      draw(); const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * 600 / r.width, (e.clientY - r.top) * 600 / r.height]; };
      c.onpointerdown = (e) => { c.setPointerCapture(e.pointerId); last = pos(e); lastT = performance.now(); };
      c.onpointermove = (e) => { if (!last || me.st !== 0) return; const p = pos(e), t = performance.now(); const sp = Math.hypot(p[0] - last[0], p[1] - last[1]) / Math.max(8, t - lastT); last = p; lastT = t;
        let nd = 1e9; pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < nd) nd = d; if (d < 26) hit[i] = 1; });
        if (nd > 40 || sp > 2.6) { crack += nd > 40 ? 2.2 : 1.2; if (Math.random() < 0.25) { cracks.push([p[0], p[1], rnd(-30, 30), rnd(-30, 30)]); snd('crack'); buzz(15); } }
        const cov = draw(); me.sc = Math.round(cov * 100); if (crack >= 100) { snd('crack'); done(false, me.sc); msg('💥 Crack! The cookie broke…', 2); } else if (cov >= 0.9) { done(true, 100); closeMini(); } };
      c.onpointerup = c.onpointercancel = () => { last = null; }; }
    function marbleGame(st) { C.root.style.display = 'none'; const P = st.pairs || []; const ix = P.indexOf(uid); const mate = ix < 0 ? null : P[ix % 2 ? ix - 1 : ix + 1];
      mini = document.createElement('div'); mini.className = 'sg-mini'; mini.innerHTML = `<div class="lbl">🔮 ${mate ? `You vs <b>${esc(nameOf(mate))}</b>` : 'Lucky you: no partner, free pass!'}</div><canvas width="600" height="300" style="width:min(92vw,560px)"></canvas><div class="lbl" data-s>Toss 1 of 3 · Score 0</div><button class="big" type="button">🔮 TOSS</button>`; el.appendChild(mini);
      if (!mate) { done(true, 999); setTimeout(closeMini, 1800); return; }
      const c = mini.querySelector('canvas'), x = c.getContext('2d'); let n = 0, score = 0, roll = null; const hole = () => 380 + (n % 3) * 50; const t0 = performance.now();
      const meter = () => (Math.sin((performance.now() - t0) / 1000 * 3.6) + 1) / 2;
      const draw = () => { if (!mini) return; x.clearRect(0, 0, 600, 300); x.fillStyle = '#c9a27a'; x.beginPath(); x.roundRect(10, 60, 580, 180, 30); x.fill(); x.fillStyle = '#5a3a1e'; x.beginPath(); x.arc(hole(), 150, 22, 0, TAU); x.fill();
        const m = meter(); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(40, 20, 520, 22); const tgt = (hole() - 60) / 520; x.fillStyle = '#ffd23f'; x.fillRect(40 + (tgt - 0.06) * 520, 20, 0.12 * 520, 22); x.fillStyle = '#fff'; x.fillRect(40 + m * 520 - 3, 14, 6, 34);
        if (roll) { const k2 = Math.min(1, (performance.now() - roll.t) / 900); const px = 60 + (roll.to - 60) * (1 - (1 - k2) ** 3); x.fillStyle = '#7fd0ff'; x.beginPath(); x.arc(px, 150, 16, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(px - 5, 145, 5, 0, TAU); x.fill(); if (k2 >= 1 && !roll.done) { roll.done = 1; } }
        requestAnimationFrame(draw); }; draw();
      mini.querySelector('button').onclick = () => { if (n >= 3 || me.st !== 0 || (roll && !roll.done)) return; const m = meter(); const to = 60 + m * 520; const d = Math.abs(to - hole()); const pts = Math.max(0, Math.round(100 - d * 0.9)); score += pts; n++; roll = { t: performance.now(), to };
        snd(pts > 70 ? 'good' : 'tap'); mini.querySelector('[data-s]').textContent = n < 3 ? `Toss ${n + 1} of 3 · Score ${score}` : `Final score ${score}! Waiting for ${nameOf(mate)}…`; me.sc = score; if (n >= 3) { me.st = 1; sendMe(true); } }; }
    function onAct() { const st = shared(); if (!st || st.ph !== 'play' || me.out) return; const k = st.plan[st.rd];
      if (k === 'tug') { const ph2 = ((performance.now() - beatT0) / 750) % 1; if (Math.min(ph2, 1 - ph2) < 0.14 / 0.75) { me.tp++; me.sc = me.tp; snd('good'); buzz(8); } else snd('tap'); sendMe(); }
      else if (k === 'duel') { if (me.dashCd > 0) return; me.dashCd = 1.1; const [fx0, fz0] = [Math.sin(me.face), Math.cos(me.face)]; me.kx += fx0 * 9; me.kz += fz0 * 9; snd('bump');
        for (const [id, v] of ppl) { if (id === uid || !st.alive.includes(id)) continue; const dx = v.x - me.x, dz = v.z - me.z, d = Math.hypot(dx, dz); if (d < 2.2 && (dx * fx0 + dz * fz0) / (d || 1) > 0.2) { const code = id[0] === 'b' && id.length <= 3 ? 100 + Number(id.slice(1)) : v.slot;
          if (solo) { const b = botS[code - 100]; if (b) botBump(b, dx, dz); } else me.bp.push(code, Math.round(dx / d * 10), Math.round(dz / d * 10), (me.bseq = me.bseq + 1)); } }
        if (me.bp.length > 24) me.bp = me.bp.slice(-24); sendMe(true); } }
    const canMove = () => { const st = shared(); if (!st || paused) return false; if (me.out) return !me.bubbleT; const k = st.plan[st.rd]; return st.ph === 'play' ? ['rlgl', 'tiles', 'duel'].includes(k) && me.st === 0 : st.ph === 'inter' && ['rlgl', 'tiles', 'cookie', 'marbles'].includes(k); };
    // ------------------------------------------------------------ my Pal: move, freeze checks, falls
    function eliminateNow(id, sc) { if (hs.out.includes(id)) return; hs.elim[id] = hs.rd * 10000 + clamp(Math.round(sc || 0), 0, 9999); hs.out.push(id); hs.alive = hs.alive.filter((x) => x !== id); if (id[0] === 'b' && id.length <= 3) { const b = botS[+id.slice(1)]; if (b) b.cz = performance.now() + 1700; } push(true); }
    function step(dt) { me.t += dt; const now = performance.now();
      if (isHost() && hs && hs.ph === 'play') { const k0 = hs.plan[hs.rd]; if (k0 !== 'marbles' && k0 !== 'tug') for (const id of hs.alive.slice()) { const r = resOf(id); if (r.st === 2 && (r.r === hs.rd || (id[0] === 'b' && id.length <= 3)) && !(k0 === 'duel' && hs.alive.length <= 1)) eliminateNow(id, r.sc); } }
      if (isHost() && hs) { hostStep(dt); for (const b of botS) if (b.cz && now > b.cz) { b.cz = 0; b.x = rnd(CZ.x0 + 1, CZ.x1 - 1); b.z = rnd(CZ.z0 + 2, CZ.z1 - 2); b.y = CZ.y; b.vy = 0; b.f = -Math.PI / 2; } }
      sync(); const st = shared(); if (!st || !st.plan) return; const k = st.plan[st.rd];
      const lk = C.takeLook(); me.yaw -= lk.dx * 0.0062; pitch = clamp(pitch + lk.dy * 0.004, pov ? -0.5 : 0.05, pov ? 0.6 : 0.95);
      const ox = me.x, oz = me.z;
      if (me.bubbleT > 0) { me.bubbleT -= dt; me.y += dt * 1.6; if (me.bubbleT <= 0) { me.bubbleT = 0; toCheer(); sendMe(true); } }
      else { const m = canMove() ? C.move : { x: 0, y: 0, mag: 0 }; const [fx0, fz0] = fwd(); const mx = fx0 * -m.y + -fz0 * m.x, mz = fz0 * -m.y + fx0 * m.x; const spd = (m.run ? 7.4 : 5);
        me.x += (mx * spd + me.kx) * dt; me.z += (mz * spd + me.kz) * dt; me.kx *= Math.pow(0.04, dt); me.kz *= Math.pow(0.04, dt); if (Math.abs(me.kx) + Math.abs(me.kz) < 0.05) me.kx = me.kz = 0; me.dashCd -= dt;
        if (m.mag > 0.05) me.face = Math.atan2(mx, mz);
        if (k === 'rlgl' && !me.out) { for (const o of obs) { const dx = me.x - o.x, dz = me.z - o.z, d = Math.hypot(dx, dz); if (d < o.r + 0.35) { me.x = o.x + dx / (d || 1) * (o.r + 0.35); me.z = o.z + dz / (d || 1) * (o.r + 0.35); } }
          for (const c of carts) { if (Math.abs(me.z - c.z) < 1.5 && Math.abs(me.x - c.g.position.x) < 1.6 && me.y < 1.6) { me.kz = 9; me.vy = 4; me.ground = false; snd('bump'); msg('🌾 Boing! Hay bale!', 0.8); } } }
        if (!floating() || me.out || inCZ(me.x, me.z)) { const b = bounds(me.x, me.z); me.x = b[0]; me.z = b[1]; }
        else if (k === 'tug') { const s = tugSpot(uid, st); if (st.ph === 'play' && !me.out) { me.x = s[0]; me.z = s[1]; me.face = s[2]; } }
        if (k === 'duel' && plat) { /* soft personal space so Pals don't overlap */ for (const [id, v] of ppl) { if (id === uid || !st.alive.includes(id)) continue; const dx = me.x - v.x, dz = me.z - v.z, d = Math.hypot(dx, dz); if (d < 0.9 && d > 0.01) { me.x += dx / d * (0.9 - d) * 0.5; me.z += dz / d * (0.9 - d) * 0.5; } } }
        const g = groundAt(me.x, me.z); me.vy -= 20 * dt; let ny = me.y + me.vy * dt;
        if (g !== null && me.y >= g - 0.35 && ny <= g) { ny = g; me.vy = 0; me.ground = true; } else me.ground = false; me.y = Math.max(-5.4, ny); if (me.y <= -5.4) me.vy = 0; }
      me.spd = me.spd * 0.5 + (Math.hypot(me.x - ox, me.z - oz) / Math.max(dt, 0.001)) * 0.5;
      // round rules for me
      if (st.ph === 'play' && !me.out && me.st === 0 && st.alive.includes(uid)) {
        if (k === 'rlgl') { me.sc = clamp(-me.z, 0, 70);
          if (light === 'r' && now - redAt > RED_GRACE * 1000 && (me.spd > 0.6 || (!me.ground && me.vy > 0.5))) { if (st.casual) { msg('🫧 Caught! Back to the start (casual)', 1.6); snd('poof'); burst(me.x, 1, me.z); placeMe(st, k); me.spd = 0; } else { me.st = 2; sendMe(true); } }
          if (me.z < -70) done(true, 70); }
        else if (k === 'tiles') { me.sc = clamp(Math.floor((-me.z - 4) / 4), 0, 8); if (me.ground) { const t = tileAt(me.x, me.z); if (t && !t.userData.broken && tileSafe(st.seed, t.userData.r) !== t.userData.s) { breakTile(t); me.tp = t.userData.r * 2 + t.userData.s + 1; msg('🫧 Pop! Wrong tile!', 1.2); sendMe(true); } } if (me.z < -37.5 && me.ground) done(true, 9); }
        else if (k === 'duel') { me.sc = ROUNDS.duel.time - Math.max(0, (endAt - now) / 1000); }
        if (floating() && me.y < -3 && me.st === 0) { snd('splash'); burst(me.x, -5, me.z, 30, ['#ffffff', '#bfe6ff', '#ffd6ec']); if (st.casual && k !== 'duel') { msg('💦 Splash! Try again (casual)', 1.4); placeMe(st, k); } else { me.st = 2; sendMe(true); } } }
      if (k === 'duel' && plat) { const el2 = ROUNDS.duel.time - Math.max(0, (endAt - now) / 1000); platR = st.ph === 'play' ? 9 - 5 * clamp((el2 - 8) / 40, 0, 1) : 9; plat.scale.set(platR / 9, 1, platR / 9); plat.userData.crown.rotation.z += dt; }
      if (net) { sendMe(false); if (!isHost() && now - (step.mig || 0) > 2000) { step.mig = now; net.maybeTakeOver().then((took) => { if (took) { adopt(); msg('👑 You’re running the show now', 1.6); } }); } }
      for (const b of botS) void b; }
    function adopt() { const s0 = net && net.state; if (!s0 || !s0.plan) { hostInit(); return; } hs = JSON.parse(JSON.stringify(s0)); const now = performance.now(); phaseEnd = now + (hs.left || 0) * 1000; lightEnd = now + (hs.ll || 0) * 1000; botInit();
      botS.forEach((b, i) => { if (hs.bots.length >= (i + 1) * 5) { b.x = hs.bots[i * 5] / 10; b.y = hs.bots[i * 5 + 1] / 10; b.z = hs.bots[i * 5 + 2] / 10; b.f = hs.bots[i * 5 + 3] / 10; b.st = hs.bots[i * 5 + 4]; } }); if (hs.light === 'r') redAt = now - 2000; push(true); }
    // ------------------------------------------------------------ draw
    function poseView(v, x, y, z, f, dt, moving, extraOut) { v.g.position.set(x, y, z); v.g.rotation.set(0, f, 0); v.t += dt;
      const emo = !moving && y <= 0.05 + (inCZ(x, z) ? CZ.y : 0) && v.emo && performance.now() < (v.emoUntil || 0);
      const inBub = v.poofT > 0; v.rig.pose(inBub ? 'hop' : y > 0.08 + (inCZ(x, z) ? CZ.y : 0) ? 'hop' : moving ? 'walk' : extraOut || 'idle', v.t * 60 * (moving ? 1.3 : 1), emo ? clipFor(v.emo)(EBEAT()) : null);
      v.label.position.set(x, y + 2.05, z); v.bub.position.set(x, y + 2.5, z); v.sh.position.set(x, Math.max(y > -1 ? 0.02 : -5.95, inCZ(x, z) ? CZ.y + 0.02 : -99), z); v.sh.visible = y > -1 || y < -5;
      v.bb.visible = inBub; if (inBub) { v.bb.position.set(x, y + 0.8, z); v.bb.scale.setScalar(1.1 + Math.sin(v.t * 8) * 0.05); v.poofT -= dt; if (v.poofT <= 0) burst(x, y + 0.8, z, 25); }
      if (v.bubT > 0) { v.bubT -= dt; if (v.bubT <= 0) v.bub.visible = false; } }
    function draw(dt) { const st = shared(); const now = performance.now(); const k = st && st.plan ? st.plan[st.rd] : '';
      // fx
      for (let i = 0; i < MAXFX; i++) { if (fxL[i] <= 0) continue; fxL[i] -= dt; fxV[i * 3 + 1] -= 6 * dt; fxPos[i * 3] += fxV[i * 3] * dt; fxPos[i * 3 + 1] += fxV[i * 3 + 1] * dt; fxPos[i * 3 + 2] += fxV[i * 3 + 2] * dt; if (fxL[i] <= 0) fxPos[i * 3 + 1] = -999; } fxG.attributes.position.needsUpdate = true; fxG.attributes.color.needsUpdate = true;
      // me
      if (me.bubbleT > 0) meV.poofT = Math.max(meV.poofT, 0.05); const moving = me.spd > 0.4 && me.ground;
      poseView(meV, me.x, me.y, me.z, me.face, dt, moving, st && st.ph === 'end' && (st.champ || []).includes(uid) ? 'happy' : null); meV.g.visible = !pov;
      if (myBubT > 0) { myBubT -= dt; if (myBubT <= 0) meV.bub.visible = false; }
      // others (interpolated)
      let n = 0; for (const [id, v] of ppl) { if (id === uid) continue; n++; const kk = Math.min(1, dt * 8); const ox = v.x, oz = v.z; if (Math.hypot(v.tx - v.x, v.tz - v.z) > 12) { v.x = v.tx; v.z = v.tz; v.y = v.ty; } v.x += (v.tx - v.x) * kk; v.z += (v.tz - v.z) * kk; v.y += (v.ty - v.y) * kk; let df = v.tf - v.f; df = Math.atan2(Math.sin(df), Math.cos(df)); v.f += df * kk;
        const mv = Math.hypot(v.x - ox, v.z - oz) / Math.max(dt, 0.001) > 0.5; if (n > 16 && (Math.floor(now / 16) + n) % 2) { v.g.position.set(v.x, v.y, v.z); continue; } // big rooms: pose every other frame
        poseView(v, v.x, v.y, v.z, v.f, dt, mv, st && st.ph === 'end' && (st.champ || []).includes(id) ? 'happy' : null); }
      // watcher
      if (watcher) { const u = watcher.userData; u.rot += (u.target - u.rot) * Math.min(1, dt * 5); u.head.rotation.y = u.rot; const red = light === 'r' && st && st.ph === 'play'; u.eyeM.color.setHex(red ? 0xff4d8d : light === 't' ? 0xffb020 : 0x7dffb0); u.beam.material.opacity = red ? 0.12 + Math.sin(now / 120) * 0.04 : 0; u.ant.scale.setScalar(1 + Math.sin(now / 150) * 0.2); u.head.rotation.z = Math.sin(now / 900) * 0.05; }
      for (const c of carts) { c.g.position.x = Math.sin(now / 1000 * c.spd + c.ph) * c.amp; c.hay.rotation.x += dt * 3; }
      // camera
      const tgt = me.out && specId && ppl.get(specId) ? ppl.get(specId) : null; const cx0 = tgt ? tgt.x : me.x, cy0 = tgt ? tgt.y : me.y, cz0 = tgt ? tgt.z : me.z; const [fx0, fz0] = fwd();
      if (pov && !tgt) { cam.position.set(me.x + fx0 * 0.2, me.y + 1.25, me.z + fz0 * 0.2); cam.lookAt(me.x + fx0 * 10, me.y + 1.25 - pitch * 10, me.z + fz0 * 10); }
      else { const dist = k === 'tug' || k === 'duel' ? 7.5 : 5.6, h = 1.3 + pitch * 3.4; cam.position.set(cx0 - fx0 * dist, Math.max(cy0, -4.5) + h, cz0 - fz0 * dist); cam.lookAt(cx0 + fx0 * 3, Math.max(cy0, -4.5) + 1.1, cz0 + fz0 * 3); }
      sun.position.set(cam.position.x + 20, 40, cam.position.z + 18); sun.target.position.set(cam.position.x, 0, cam.position.z - 6);
      sky.position.copy(cam.position); sky.material.uniforms.t.value = now / 1000; R.render(scene, cam);
      if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('.sg-msg').style.opacity = 0; } }
    let last = performance.now(), raf = 0, fpsT = 0, fpsN = 0, slowFor = 0; const dbg = { fps: 0 };
    function loop(t) { raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (t - last) / 1000); last = t;
      if (!started && isHost() && !solo) begin(); try { if (started || !isHost()) step(dt); draw(dt); } catch (e) { console.error('show loop', e); }
      fpsN++; fpsT += t - (loop.p || t); loop.p = t; if (fpsT > 1000) { dbg.fps = Math.round((fpsN * 1000) / fpsT); fpsN = 0; fpsT = 0; fpsTag.textContent = dbg.fps + ' fps';
        if (dbg.fps < 40 && pr > prMin) { slowFor++; if (slowFor >= 2) { pr = Math.max(prMin, pr - 0.25); R.setPixelRatio(pr); resize(); slowFor = 0; } } else if (dbg.fps >= 57 && pr < prMax) { slowFor--; if (slowFor <= -4) { pr = Math.min(prMax, pr + 0.25); R.setPixelRatio(pr); resize(); slowFor = 0; } } else slowFor = 0; } }
    // ------------------------------------------------------------ results, rewards (capped Diamonds), scoreboard
    function ranking(st) { const champ = st.champ || []; const rest = Object.entries(st.elim || {}).filter(([id]) => !champ.includes(id)).sort((a, b) => b[1] - a[1]);
      const rows = champ.map((id) => ({ id, place: 1 })); let p = champ.length + 1; for (const [id] of rest) rows.push({ id, place: p++ }); return rows; }
    async function showEnd(st) { if (rewarded) return; rewarded = true; closeMini(); const champ = (st.champ || []).includes(uid); if (champ) { survived++; snd('win'); burst(me.x, 2, me.z, 120, ['#ffd23f', '#ff6b9a', '#7ee08a', '#8fd8ff']); }
      const rows = ranking(st); const mine = rows.find((r) => r.id === uid); const dia = diaNow(st);
      const d = panel(`${hoot(champ ? (st.champ.length > 1 ? `👑 You’re one of the <b>final ${st.champ.length}</b> champions! What a show!` : '👑 <b>You are the CHAMPION</b> of the Kemy Challenge Show!') : `What a show! You placed <b>#${mine ? mine.place : '?'}</b>. Champion${st.champ.length > 1 ? 's' : ''}: <b>${st.champ.map((id) => esc(nameOf(id))).join(', ')}</b>`)}
        <h2>🏆 Results</h2><div class="sg-res">${rows.slice(0, 12).map((r) => `<div class="${r.id === uid ? 'me' : ''}"><b>${r.place === 1 ? '👑' : '#' + r.place}</b><span>${esc(nameOf(r.id))}${r.id === uid ? ' (you)' : ''}</span></div>`).join('')}</div>
        <p>Rounds survived: <b>${survived}</b> · 💎 <b>${dia}</b></p><p class="small" data-dia style="opacity:.85">${dia ? 'Saving your Diamonds…' : ''}</p>
        <div class="row"><button data-again>🔁 New show</button><a class="b ghost" href="#/arcade">🎮 Arcade</a></div>`);
      d.querySelector('[data-again]').onclick = () => { destroy(); location.hash = '#/arcade/show'; dispatchEvent(new HashChangeEvent('hashchange')); };
      d.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => destroy()));
      window.__show && (window.__show.result = { place: mine && mine.place, champ, dia, survived });
      if (dia && db && !window.__showNoSave) { try { const got = await createDiamonds(db, uid).earnRun(dia); const p = d.querySelector('[data-dia]'); if (p) p.textContent = got ? `💎 ${got} Diamonds saved!` : 'Daily Diamond limit reached. Come back tomorrow!'; } catch (e) { const p = d.querySelector('[data-dia]'); if (p) p.textContent = 'Could not save Diamonds right now.'; console.warn('diamonds', e.code || e.message); } }
      if (db && !window.__showNoSave) import('../leaderboard.js').then((lb) => lb.recordScore('pals', { r: champ ? 'w' : 'l', pts: Math.min(10000, survived * 100 + (champ ? 500 : 0)) })).catch(() => {});
      if (isHost() && net) net.setLobby({ status: 'done' }).catch(() => {}); }
    let netOff = null, started = false;
    if (net) netOff = net.on((k) => { if (k === 'players') syncPlayers(); else if (k === 'lobby' && !net.lobby && !rewarded) { msg('The show ended', 2); } });
    function begin() { if (started) return; started = true; if (isHost() && !hs) { if (net && net.state && net.state.plan) adopt(); else hostInit(); } }
    function destroy() { if (destroy.done) return; destroy.done = 1; if (net) { netOff && netOff(); net.leave(); } cancelAnimationFrame(raf); removeEventListener('resize', resize); removeEventListener('hashchange', onHash); C.destroy(); closeMini();
      scene.traverse((o) => { o.geometry?.dispose?.(); }); R.dispose(); R.forceContextLoss?.(); el.remove(); document.documentElement.style.overflow = ''; const gmr = document.getElementById('game-music'); if (gmr) gmr.style.zIndex = ''; if (G === api) G = null; window.__show = null; }
    const onHash = () => { if (!/^#\/arcade\/show/.test(location.hash)) destroy(); }; addEventListener('hashchange', onHash);
    // host handoff while playing: if I become host without a local copy, adopt the shared state
    const adoptIv = setInterval(() => { if (destroy.done) return clearInterval(adoptIv); if (started && isHost() && !hs) adopt(); }, 1000);
    window.__show = { get state() { const st = shared(); return st && st.plan && { ph: st.ph, rd: st.rd, round: st.plan && st.plan[st.rd], light, alive: st.alive.length, out: st.out.length, me: { x: +me.x.toFixed(1), z: +me.z.toFixed(1), y: +me.y.toFixed(1), st: me.st, out: me.out, sc: me.sc }, host: isHost(), champ: st.champ, fps: dbg.fps, players: ppl.size, survived, dia: diaNow(st) }; }, result: null };
    raf = requestAnimationFrame(loop);
    const startMusic = () => import('../gamemusic.js').then(async (gm) => { await gm.mountGameMusic({ corner: 'top-right' }); const r = document.getElementById('game-music'); if (r) { r.style.zIndex = '950'; r.classList.add('top-right'); } if (gm.state().volume > 0.2) gm.setVolume(0.2); if (!gm.isPlaying()) { const b = document.querySelector('#game-music [data-st="theme"]'); if (b) b.click(); else gm.play(); } }).catch(() => {});
    C.tutorial().then(() => { begin(); startMusic(); });
    if (net) syncPlayers();
    const api = { destroy, _debug: { me, hs: () => hs, botS, ppl, finish: () => finishRound(), skip: () => { if (hs) { phaseEnd = 0; } }, setLight: (l) => { if (hs) { hs.light = l; hs.lq++; if (l === 'r') redAt = performance.now(); lightEnd = performance.now() + 4000; push(true); } }, tp: (x, z) => { me.x = x; me.z = z; }, passBots: (pr = 0.75) => { for (const b of botS) if (hs && hs.alive.includes(b.id) && b.st === 0) { b.st = Math.random() < pr ? 1 : 2; b.sc = 50; } }, done: (ok) => done(ok, ok ? 100 : 0) } };
    window.__show.game = api; return api;
  }
  return { open, get current() { return G; } };
}
