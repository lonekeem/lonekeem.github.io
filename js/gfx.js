// Shared 3D graphics quality for Pal Park and Pal Zombie Survival: one setting (Auto/Low/Medium/High/Ultra, saved in
// localStorage 'kemy-gfx'), renderer setup (pixel ratio cap, MSAA, tone mapping, sRGB, soft shadows), a procedural
// gradient sky with sun + soft clouds, a procedural environment map, and procedurally painted textures with normal maps.
// Everything is generated in code at runtime: no downloaded or third-party art.
import * as THREE from './vendor/three-0.170.0.module.min.js';

const KEY = 'kemy-gfx', FPSK = 'kemy-gfx-fps';
export const TIERS = ['auto', 'low', 'medium', 'high', 'ultra'];
const LABEL = { auto: 'Auto', low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };
//          pixel-ratio cap, MSAA, shadows, shadow map, grass density, draw distance (m), texture size, anisotropy cap, tree/flower density
export const PRESETS = {
  low:    { dpr: 1.25, aa: false, shadows: false, shadowMap: 512,  grass: 0.35, draw: 150, tex: 256,  aniso: 2,  detail: 0.6, post: false },
  medium: { dpr: 2,    aa: true,  shadows: true,  shadowMap: 1024, grass: 0.7,  draw: 220, tex: 512,  aniso: 4,  detail: 0.85, post: true },
  high:   { dpr: 2.5,  aa: true,  shadows: true,  shadowMap: 2048, grass: 1,    draw: 300, tex: 1024, aniso: 8,  detail: 1, post: true },
  ultra:  { dpr: 3,    aa: true,  shadows: true,  shadowMap: 4096, grass: 1.6,  draw: 400, tex: 1024, aniso: 16, detail: 1.25, post: true },
};
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } return v; };
export function gfxSetting() { const v = ls(KEY); return TIERS.includes(v) ? v : 'auto'; }
export function setGfxSetting(v) { if (TIERS.includes(v)) ls(KEY, v); dispatchEvent(new CustomEvent('kemy:gfx', { detail: v })); }
export function autoTier() { // picks by device: memory, cores, data saver, phone vs desktop
  const n = navigator; const mem = n.deviceMemory || 0, cores = n.hardwareConcurrency || 4;
  if ((n.connection && n.connection.saveData) || (mem && mem < 3) || cores <= 2) return 'low';
  const phone = /iPhone|iPad|Android|Mobile/i.test(n.userAgent || '') || (n.maxTouchPoints > 1 && innerWidth < 900);
  if (phone) return (mem && mem < 6) || cores < 6 ? 'medium' : 'high';
  return mem && mem < 8 ? 'high' : 'ultra'; }
export function gfxTier() { const v = gfxSetting(); return v === 'auto' ? autoTier() : v; }
export const isPhone = () => { const n = navigator; return /iPhone|iPad|iPod|Android|Mobile/i.test(n.userAgent || '') || (n.maxTouchPoints > 1 && Math.min(innerWidth, innerHeight) < 600); };
// phones: pixel ratio capped at 1.5 (1.0 on Low), smaller shadow maps, shorter draw distance: the iPhone fill-rate budget
export function gfxPreset() { const q = { tier: gfxTier(), ...PRESETS[gfxTier()] }; if (isPhone()) { q.phone = true; q.dpr = Math.min(q.dpr, q.tier === 'low' ? 1 : 1.5); q.shadowMap = Math.min(q.shadowMap, q.tier === 'ultra' ? 2048 : 1024); q.draw = Math.min(q.draw, q.tier === 'low' ? 140 : 230); q.grass = Math.min(q.grass, 0.7); } return q; }
export const showFps = () => ls(FPSK) === '1';
export const setShowFps = (on) => { ls(FPSK, on ? '1' : '0'); dispatchEvent(new CustomEvent('kemy:gfx', { detail: 'fps' })); };

export function makeRenderer(canvas, Q, o = {}) {
  const R = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance', ...(o.alpha ? { alpha: true } : {}) });
  R.setPixelRatio(Math.min(devicePixelRatio || 1, Q.dpr)); R.outputColorSpace = THREE.SRGBColorSpace;
  R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = o.exposure ?? 1.0;
  R.shadowMap.enabled = Q.shadows; R.shadowMap.type = THREE.PCFSoftShadowMap; return R; }
export const dprFor = (Q) => Math.min(devicePixelRatio || 1, Q.dpr);

// ------------------------------------------------------------ sky: gradient + sun disc/halo + 2-layer fbm clouds
const NOISE = `float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a*vn(p); p = p*2.03 + 7.1; a *= .5; } return s; }`;
export function makeSky(o = {}) {
  const u = { sunDir: { value: (o.sunDir || new THREE.Vector3(0.45, 0.75, 0.3)).clone().normalize() }, top: { value: new THREE.Color(o.top || '#2f7fe6') }, hor: { value: new THREE.Color(o.hor || '#bfe3ff') },
    ground: { value: new THREE.Color(o.ground || '#9cc4a0') }, sunCol: { value: new THREE.Color(o.sun || '#fff4dc') }, cloud: { value: o.cloud ?? 0.55 }, cloudCol: { value: new THREE.Color(o.cloudCol || '#ffffff') }, t: { value: 0 },
    // fogC: the scene fog colour (shared Color object, so day/night lerps follow); mount: 0 = none, 1 = distant hazy ranges on the horizon
    fogC: { value: o.fogColor || new THREE.Color(o.hor || '#bfe3ff') }, mount: { value: o.mountains ? 1 : 0 } };
  // pure maths per pixel (no textures at all, so nothing can ever stretch); far plane trick keeps it behind everything
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: u,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position.z = gl_Position.w * .99999; }',
    fragmentShader: `uniform vec3 sunDir, top, hor, ground, sunCol, cloudCol, fogC; uniform float cloud, t, mount; varying vec3 vP; ${NOISE}
      void main(){ vec3 d = normalize(vP); float h = max(d.y, 0.); vec3 c = mix(hor, top, pow(h, .5));
        float s = max(dot(d, sunDir), 0.); c += sunCol * (smoothstep(.9994, .9997, s) * 3. + pow(s, 64.) * .35 + pow(s, 6.) * .12);
        if (cloud > 0. && d.y > 0.) { vec2 q = d.xz / (d.y + .12) * 1.2; q.x += t * .004;
          float n = fbm(q * .9) * .65 + fbm(q * 2.7 + 3.) * .35; float cv = smoothstep(1. - cloud, 1.05 - cloud * .55, n) * smoothstep(0., .18, d.y);
          vec3 cc = mix(cloudCol * .82, cloudCol * 1.04, smoothstep(.4, .8, n)) + sunCol * pow(s, 8.) * .25; c = mix(c, cc, cv * .9); }
        // horizon haze = fog colour, so terrain fading into the fog meets the sky without a seam
        c = mix(c, fogC, pow(1. - smoothstep(0., .16, d.y), 1.5));
        if (mount > 0.) { vec2 az = normalize(d.xz + 1e-5);
          float r1 = .035 + .05 * fbm(az * 3.1 + 11.) + .02 * vn(az * 19. + 3.), r2 = .02 + .035 * fbm(az * 5.3 + 2.);
          float ey = d.y + .004;
          vec3 m1 = mix(fogC, vec3(.32, .42, .52) * (fogC * 1.1), .38), m2 = mix(fogC, vec3(.28, .4, .36) * (fogC * 1.2), .55);
          c = mix(c, m1 + vec3(1.) * pow(s, 12.) * .05, smoothstep(r1 + .002, r1 - .002, ey) * .9);
          c = mix(c, m2, smoothstep(r2 + .002, r2 - .002, ey) * .92); }
        if (d.y < 0.) c = mix(mount > 0. ? fogC : hor, ground, min(1., -d.y * (mount > 0. ? 2. : 5.)));
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const m = new THREE.Mesh(new THREE.SphereGeometry(o.radius || 400, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -1; m.userData.u = u; return m; }
// procedural environment map from the sky (PBR reflections / ambient)
export function envFromSky(R, sky) { const pm = new THREE.PMREMGenerator(R); const s = new THREE.Scene(); const c = sky.clone(); c.material = sky.material.clone(); c.material.uniforms.cloud.value = sky.material.uniforms.cloud.value * 0.6; c.scale.setScalar(0.2); s.add(c);
  const rt = pm.fromScene(s, 0.02, 0.1, 200); pm.dispose(); c.material.dispose(); return rt.texture; }

// ------------------------------------------------------------ procedural textures (canvas): albedo + normal map from a height field
const cache = new Map();
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vnoise(S, seed) { const g = new Float32Array(S * S); const r = rnd(seed); for (let i = 0; i < g.length; i++) g[i] = r(); return (x, y, P = 256) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const at = (a, b) => g[((b % P + P) % P) * S + ((a % P + P) % P)];
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy; }; }
function fbmT(n, x, y, oct, base) { let s = 0, a = 0.5, f = base; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2; a *= 0.5; } return s; } // tileable when base is integer & grid = base*2^k
function toTex(cv, srgb, Q, rep) { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Q.aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; if (rep) t.repeat.set(rep[0], rep[1]); return t; }
function normalFrom(H, S, strength) { const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'); const im = x.createImageData(S, S);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const h = (a, b) => H[((b + S) % S) * S + ((a + S) % S)]; const dx = (h(i + 1, j) - h(i - 1, j)) * strength, dy = (h(i, j + 1) - h(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1); const k = (j * S + i) * 4; im.data[k] = (-dx / l * 0.5 + 0.5) * 255; im.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); return cv; }
// paint(i,j,S,noises) -> [r,g,b,height]
function bake(name, S, paint, nStr, Q) { const k = name + S; if (cache.has(k)) return cache.get(k);
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'); const im = x.createImageData(S, S); const H = new Float32Array(S * S);
  const N = [vnoise(256, 11), vnoise(256, 23), vnoise(256, 37)]; const px = new Array(4);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { paint(i / S, j / S, N, px); const k2 = j * S + i; H[k2] = px[3]; const o = k2 * 4; im.data[o] = px[0]; im.data[o + 1] = px[1]; im.data[o + 2] = px[2]; im.data[o + 3] = 255; }
  x.putImageData(im, 0, 0); const out = { cv, ncv: normalFrom(H, S, nStr * S / 512), x }; cache.set(k, out); return out; }
const T = (N, w, u, v, base, oct = 4) => { let s = 0, a = 0.5, f = base; for (let i = 0; i < oct; i++) { s += a * N[w](u * f, v * f, Math.round(f)); f *= 2; a *= 0.5; } return s; };
const mix = (a, b, t) => a + (b - a) * t, cl = (v) => Math.max(0, Math.min(255, v));
const PAINT = {
  // grass ground: tufts, clover, light/dark patches; mean ~1 so vertex tints stay in charge of overall color
  grass: (u, v, N, o) => { const n = T(N, 0, u, v, 8), f = T(N, 1, u, v, 64, 2), b = N[2](u * 128, v * 128, 128); const t = n * 0.6 + f * 0.4; const blade = Math.max(0, Math.min(1, (b - 0.62) * 5));
    o[0] = cl(200 + (t - 0.5) * 120 + blade * 40 - (b < 0.2 ? 40 : 0)); o[1] = cl(225 + (t - 0.5) * 90 + blade * 30); o[2] = cl(170 + (t - 0.5) * 80); o[3] = t * 0.6 + blade * 0.4; },
  // dirt path with pebbles
  path: (u, v, N, o) => { const n = T(N, 0, u, v, 8), f = T(N, 1, u, v, 32, 3); const p = N[2](u * 48, v * 48, 48); const peb = p > 0.68 ? (p - 0.68) / 0.32 : 0;
    const c = 0.85 + (n - 0.5) * 0.35 + (f - 0.5) * 0.25 + peb * 0.35; o[0] = cl(235 * c); o[1] = cl(222 * c); o[2] = cl(200 * c - peb * 20); o[3] = f * 0.4 + peb; },
  // plaza stone tiles
  tile: (u, v, N, o) => { const g = 8, x = u * g, y = v * g + (Math.floor(u * g) % 2) * 0.5; const fx = x - Math.floor(x), fy = y - Math.floor(y); const e = Math.min(fx, 1 - fx, fy, 1 - fy); const gr = e < 0.035 ? 0 : 1;
    const id = N[2](Math.floor(x) * 7, Math.floor(y) * 3); const n = T(N, 1, u, v, 32, 3); const c = gr ? 0.9 + (id - 0.5) * 0.18 + (n - 0.5) * 0.15 : 0.6; o[0] = cl(240 * c); o[1] = cl(234 * c); o[2] = cl(222 * c); o[3] = gr ? 0.6 + n * 0.3 - (e < 0.07 ? (0.07 - e) * 5 : 0) : 0; },
  // bark: vertical ridges
  bark: (u, v, N, o) => { const r = T(N, 0, u * 6, v, 2, 4); const ridge = Math.abs(Math.sin((u * 18 + r * 3) * Math.PI)); const n = T(N, 1, u, v, 32, 2);
    const c = 0.55 + ridge * 0.45 + (n - 0.5) * 0.2; o[0] = cl(230 * c); o[1] = cl(215 * c); o[2] = cl(200 * c); o[3] = ridge * 0.8 + n * 0.2; },
  // leaves: overlapping leaf blobs with veins, near-white so instance color tints them
  leaf: (u, v, N, o) => { const s = 24, x = u * s, y = v * s; const ix = Math.floor(x), iy = Math.floor(y); let best = 9, sh = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const wx = (ix + a + s) % s, wy = (iy + b + s) % s; const cx = ix + a + N[2](wx * 7, wy * 5), cy = iy + b + N[1](wx * 3, wy * 11); const d = Math.hypot((x - cx) * 1.6, y - cy); if (d < best) { best = d; sh = N[0](wx * 9, wy * 13); } }
    const vein = Math.abs((x % 1) - 0.5) < 0.03 ? 0.85 : 1; const c = (0.78 + sh * 0.22 - Math.max(0, best - 0.45) * 0.35) * vein; o[0] = cl(225 * c); o[1] = cl(245 * c); o[2] = cl(205 * c); o[3] = 1 - Math.min(1, best * 1.4); },
  // wood planks (benches, playground)
  wood: (u, v, N, o) => { const pl = Math.floor(v * 4); const g = T(N, 0, u, v * 4 + pl * 3, 4, 3); const ring = Math.sin((v * 4 - pl + g * 2.5) * 22) * 0.5 + 0.5; const seam = (v * 4 - pl) < 0.04 ? 0.55 : 1;
    const c = (0.78 + ring * 0.18 + (g - 0.5) * 0.25) * seam; o[0] = cl(240 * c); o[1] = cl(215 * c); o[2] = cl(185 * c); o[3] = ring * 0.3 + (seam < 1 ? 0 : 0.7); },
  // painted siding for buildings
  siding: (u, v, N, o) => { const b = v * 16, f = b - Math.floor(b); const n = T(N, 1, u, v, 16, 3); const c = (f < 0.06 ? 0.72 : 0.94 + f * 0.06) + (n - 0.5) * 0.08; o[0] = cl(250 * c); o[1] = cl(248 * c); o[2] = cl(252 * c); o[3] = f < 0.06 ? 0 : 0.5 + f * 0.5; },
  // rock / stone
  rock: (u, v, N, o) => { const n = T(N, 0, u, v, 4, 5), f = T(N, 1, u, v, 32, 3); const cr = Math.abs(N[2](u * 16, v * 16, 16) - 0.5) < 0.03 ? 0.7 : 1; const c = (0.72 + (n - 0.5) * 0.5 + (f - 0.5) * 0.3) * cr; o[0] = cl(235 * c); o[1] = cl(232 * c); o[2] = cl(226 * c); o[3] = n * 0.7 + f * 0.3 - (cr < 1 ? 0.2 : 0); },
  // spooky-cute soil for the zombie arena
  soil: (u, v, N, o) => { const n = T(N, 0, u, v, 8), f = T(N, 1, u, v, 64, 2), b = N[2](u * 96, v * 96, 96); const tuft = Math.max(0, Math.min(1, (b - 0.6) * 4)); const c = 0.9 + (n - 0.5) * 0.3 + (f - 0.5) * 0.12;
    o[0] = cl(215 * c - tuft * 20); o[1] = cl(230 * c + tuft * 25); o[2] = cl(220 * c - tuft * 10); o[3] = n * 0.6 + tuft * 0.25; },
};
const NSTR = { grass: 1.6, path: 3, tile: 4, bark: 4, leaf: 2.5, wood: 2, siding: 3, rock: 4, soil: 1.5 };
// returns { map, normalMap } (fresh Texture objects sharing a cached canvas, so each can have its own repeat)
export function proceduralTex(kind, Q, rep, size) { const S = size || (kind === 'tile' || kind === 'siding' || kind === 'wood' ? Math.min(512, Q.tex) : Q.tex); const b = bake(kind, Math.min(S, 1024), PAINT[kind], NSTR[kind], Q);
  return { map: toTex(b.cv, true, Q, rep), normalMap: toTex(b.ncv, false, Q, rep) }; }

// ------------------------------------------------------------ settings UI (injected into the shared controls ⚙️ panel)
export function gfxSettingsHTML() { const cur = gfxSetting(); return `<div class="gfx-set"><b>🎨 Graphics</b><div class="gfx-tiers" role="radiogroup" aria-label="Graphics quality">${TIERS.map((t) => `<button type="button" role="radio" aria-checked="${t === cur}" data-gfx="${t}" class="${t === cur ? 'on' : ''}">${LABEL[t]}</button>`).join('')}</div>
  <small class="gfx-note">${cur === 'auto' ? 'Auto picked <b>' + LABEL[autoTier()] + '</b> for this device.' : 'Lower = smoother on older phones. Higher = sharper, more grass and shadows.'}</small>
  <label class="gfx-fps"><input type="checkbox" data-gfx-fps ${showFps() ? 'checked' : ''}> Show FPS</label></div>`; }
const CSS = `.kc-set .kc-card{max-height:88vh;overflow:auto}.gfx-set{margin:10px 0 4px;padding:10px;border-radius:14px;background:rgba(255,255,255,.08);display:grid;gap:8px;text-align:left}.gfx-tiers{display:flex;gap:4px;flex-wrap:wrap}
.gfx-tiers button{flex:1 1 auto;min-width:52px;padding:8px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;font:inherit;font-size:13px;font-weight:700}
.gfx-tiers button.on{background:#7b3fe4;border-color:#b28bff;color:#fff}.gfx-note{opacity:.8;font-size:12px}.gfx-fps{display:flex;gap:6px;align-items:center;font-size:14px}`;
export function attachGfxSettings(controls, onChange) { // controls = createControls() result; adds a Graphics block whenever its ⚙️ panel opens
  if (!document.getElementById('gfx-css')) { const st = document.createElement('style'); st.id = 'gfx-css'; st.textContent = CSS; document.head.appendChild(st); }
  const build = (anchor, replace) => { const w = document.createElement('div'); w.innerHTML = gfxSettingsHTML(); const blk = w.firstElementChild; if (replace) anchor.replaceWith(blk); else anchor.parentElement.insertBefore(blk, anchor);
    blk.addEventListener('click', (e) => { const b = e.target.closest('[data-gfx]'); if (!b) return; const prev = gfxTier(); setGfxSetting(b.dataset.gfx); build(blk, true); onChange && onChange({ tier: gfxTier(), changed: prev !== gfxTier() }); });
    blk.querySelector('[data-gfx-fps]').onchange = (e) => { setShowFps(e.target.checked); onChange && onChange({ tier: gfxTier(), changed: false, fps: true }); }; };
  controls.on('settings:open', () => { const d = controls.root && controls.root.querySelector('.kc-set'); if (!d || d.querySelector('.gfx-set')) return; const done = d.querySelector('[data-done]'); build(done ? done.parentElement : d.lastElementChild, false); }); }
export function mergeGeos(gs) { // position + normal + uv merge (keeps smooth normals)
  const ng = gs.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; ng.forEach((g) => (n += g.attributes.position.count));
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0; ng.forEach((g) => { if (!g.attributes.normal) g.computeVertexNormals(); P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; });
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); return out; }
export { THREE };
