// Pal Park HD extras (procedural, no downloaded art): butterflies, drifting petals, puffy 3D clouds, reeds/cattails and
// shoreline foam on the water, flower beds around the plaza, lamp glow halos. Everything is instanced or a single draw
// (Points / InstancedMesh), animated on the GPU, and scaled by the shared Graphics tier (js/gfx.js) so Low stays light.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fogU = () => THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
const glowTex = (() => { let t; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,244,200,1)'); g.addColorStop(0.35, 'rgba(255,226,150,.45)'); g.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }; })();

export function addParkHD(scene, o) {
  const { Q, LOW, ground, pathD, walkable, POND, LAKE, WATER_Y, PLAZA_R, lampHeads = [], W = 100, H = 75 } = o;
  const R = rng(4242), det = Q.detail || 1, ups = []; const T = { value: 0 }, CAM = { value: new THREE.Vector3() };
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- butterflies: 2 hinged wings, flap + flight path in the vertex shader
  { const n = Math.round((LOW ? 14 : 46) * det); const g = new THREE.BufferGeometry();
    // two wings (each 2 tris: fore + hind), x<0 left, x>0 right; hinge at x=0
    const P = [0, 0, 0.02, -0.16, 0, 0.12, -0.13, 0, -0.03, 0, 0, -0.01, -0.11, 0, -0.04, -0.07, 0, -0.13, 0, 0, 0.02, 0.16, 0, 0.12, 0.13, 0, -0.03, 0, 0, -0.01, 0.11, 0, -0.04, 0.07, 0, -0.13];
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const cen = new Float32Array(n * 4), col = new Float32Array(n * 3); const C = ['#ff7ab8', '#ffd447', '#7cc8ff', '#b98cff', '#ff9f4a', '#ffffff']; const c = new THREE.Color();
    for (let i = 0, k = 0; i < n && k < 4000; k++) { const x = (R() - 0.5) * (W * 1.6), z = (R() - 0.5) * (H * 1.6); if (!walkable(x, z, 2)) continue; cen[i * 4] = x; cen[i * 4 + 1] = ground(x, z) + 0.8 + R() * 1.2; cen[i * 4 + 2] = z; cen[i * 4 + 3] = R() * 100; c.set(C[i % C.length]); col.set([c.r, c.g, c.b], i * 3); i++; }
    const ig = new THREE.InstancedBufferGeometry().copy(g); ig.instanceCount = n; ig.setAttribute('cen', new THREE.InstancedBufferAttribute(cen, 4)); ig.setAttribute('bc', new THREE.InstancedBufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({ side: THREE.DoubleSide, fog: true, uniforms: { t: T, ...fogU() },
      vertexShader: `attribute vec4 cen; attribute vec3 bc; uniform float t; varying vec3 vC; varying float vS;
        #include <fog_pars_vertex>
        void main(){ float ph = cen.w, tt = t * .35 + ph; vec3 p = cen.xyz + vec3(sin(tt) * 3. + sin(tt * 2.3) * 1.2, sin(tt * 1.7) * .5 + sin(t * 3. + ph) * .12, cos(tt * .8) * 3. + sin(tt * 1.9) * 1.);
          vec3 d = vec3(cos(tt) * 3. + cos(tt * 2.3) * 2.8, 0., -sin(tt * .8) * 2.4 + cos(tt * 1.9) * 1.9); float yaw = atan(d.x, d.z);
          vec3 q = position * 1.4; float fl = sin(t * 18. + ph * 7.) * 1.1; float s = sign(q.x); float a = s * fl; q = vec3(q.x * cos(a), abs(q.x) * sin(fl) , q.z);
          float cy = cos(yaw), sy = sin(yaw); q = vec3(q.x * cy + q.z * sy, q.y, -q.x * sy + q.z * cy); vC = bc; vS = abs(position.x) / .16;
          vec4 mvPosition = modelViewMatrix * vec4(p + q, 1.); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `varying vec3 vC; varying float vS;
        #include <fog_pars_fragment>
        void main(){ vec3 c = mix(vC * .55, vC, smoothstep(.0, .5, vS)); c = mix(c, vec3(.15,.1,.2), step(.85, vS) * .6); gl_FragColor = vec4(c, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }` });
    const mesh = new THREE.Mesh(ig, m); mesh.frustumCulled = false; scene.add(mesh); }

  // ---------------------------------------------------------------- drifting petals around the camera (one Points draw)
  { const n = Math.round((LOW ? 90 : 420) * det), B = 34; const pos = new Float32Array(n * 3), sd = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = R() * B; pos[i * 3 + 1] = R() * 12; pos[i * 3 + 2] = R() * B; sd[i] = R(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('sd', new THREE.BufferAttribute(sd, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: { t: T, cam: CAM, px: { value: Math.min(devicePixelRatio || 1, Q.dpr) }, ...fogU() },
      vertexShader: `attribute float sd; uniform float t, px; uniform vec3 cam; varying float vSd; varying float vA;
        #include <fog_pars_vertex>
        void main(){ const float B = ${B}.; vec3 p = position; p.y = mod(p.y - t * (.35 + sd * .3), 12.); p.x += sin(t * .7 + sd * 30.) * 1.2 + t * .25; p.z += cos(t * .5 + sd * 17.) * .8;
          vec3 w = cam + mod(p - cam + vec3(B * .5, 0., B * .5), vec3(B, 1e5, B)) - vec3(B * .5, 0., B * .5); w.y = cam.y - 3. + p.y;
          vec4 mvPosition = modelViewMatrix * vec4(w, 1.); gl_Position = projectionMatrix * mvPosition; gl_PointSize = min(px * 12., px * (2.5 + sd * 2.) * (6. / max(1., -mvPosition.z))); vSd = sd; vA = smoothstep(0., 1.5, p.y) * smoothstep(12., 9., p.y);
          #include <fog_vertex>
        }`,
      fragmentShader: `varying float vSd; varying float vA;
        #include <fog_pars_fragment>
        void main(){ vec2 u = gl_PointCoord - .5; float r = length(u * vec2(1., 1.8)); if (r > .5) discard; vec3 c = mix(vec3(1.,.55,.78), vec3(1.,.86,.93), step(.75, vSd)); gl_FragColor = vec4(c, vA * .9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }` });
    const pts = new THREE.Points(g, m); pts.frustumCulled = false; scene.add(pts); }

  // ---------------------------------------------------------------- puffy 3D clouds (instanced lumps, drift slowly; Medium+)
  if (!LOW && !Q.phone) { const NC = Math.round(12 * det), PER = 7; const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#dfe9ff', emissiveIntensity: 0.55, fog: false }), NC * PER);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(); let k = 0;
    for (let c = 0; c < NC; c++) { const a = (c / NC) * 6.28 + R() * 0.4, r = 120 + R() * 90, cx = Math.cos(a) * r, cz = Math.sin(a) * r, cy = 55 + R() * 25, sc = 5 + R() * 4;
      for (let i = 0; i < PER; i++) { const f = 1 - Math.abs(i - (PER - 1) / 2) / PER; p.set(cx + (i - PER / 2) * sc * 0.9, cy + f * sc * 0.6 + R() * sc * 0.3, cz + (R() - 0.5) * sc); s.set(sc * (0.9 + f), sc * (0.6 + f * 0.7), sc * (0.9 + f * 0.6)); mt.compose(p, q, s); im.setMatrixAt(k++, mt); } }
    im.frustumCulled = false; const grp = new THREE.Group(); grp.add(im); scene.add(grp); ups.push((t) => { grp.rotation.y = t * 0.004; }); }

  // ---------------------------------------------------------------- water: reeds + cattails along the shore, soft foam ring
  { const n = Math.round((LOW ? 70 : 240) * det); const stem = new THREE.CylinderGeometry(0.018, 0.03, 1.3, 4, 1); stem.translate(0, 0.65, 0); const head = new THREE.CylinderGeometry(0.055, 0.055, 0.28, 6); head.translate(0, 1.25, 0);
    const sm = new THREE.InstancedMesh(stem, new THREE.MeshStandardMaterial({ color: '#5f9a3a', roughness: 0.8 }), n), hm = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: '#7a4a28', roughness: 0.9 }), n);
    const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e3 = new THREE.Euler(); let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) { const e = i % 2 ? POND : LAKE; const a = R() * 6.28, rr = 0.95 + R() * 0.22; const x = e.x + Math.cos(a) * e.rx * rr, z = e.z + Math.sin(a) * e.rz * rr; if (pathD(x, z) < 2.6) continue;
      const sc = 0.7 + R() * 0.6; e3.set((R() - 0.5) * 0.25, R() * 6, (R() - 0.5) * 0.25); q.setFromEuler(e3); mt.compose(p.set(x, Math.max(ground(x, z), (i % 2 ? WATER_Y.pond : WATER_Y.lake) - 0.75) - 0.05, z), q, s.set(sc, sc, sc)); sm.setMatrixAt(k, mt); hm.setMatrixAt(k, mt); k++; }
    sm.count = hm.count = k; sm.castShadow = hm.castShadow = !LOW; scene.add(sm, hm);
    const foamM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: T }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform float t; varying vec2 vU; void main(){ float a = sin(vU.x * 6.2831 * 18. + t * 1.4) * .5 + .5; float e = smoothstep(0., .5, vU.y) * smoothstep(1., .5, vU.y); gl_FragColor = vec4(1., 1., 1., e * (.25 + a * .35)); }' });
    for (const [e, y] of [[POND, WATER_Y.pond], [LAKE, WATER_Y.lake]]) { const g = new THREE.RingGeometry(0.96, 1.04, 96, 1); const uv = g.attributes.uv, ps = g.attributes.position; for (let i = 0; i < uv.count; i++) { const x = ps.getX(i), yy = ps.getY(i); uv.setXY(i, (Math.atan2(yy, x) / 6.2831 + 1) % 1, Math.hypot(x, yy) > 1 ? 1 : 0); }
      g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, foamM); m.scale.set(e.rx * 1.02, 1, e.rz * 1.02); m.position.set(e.x, y - 0.58, e.z); m.renderOrder = 2; scene.add(m); } }

  // ---------------------------------------------------------------- flower beds around the plaza (stone kerb + dense blooms, instanced)
  { const beds = []; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8, r = PLAZA_R + 6.2; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (pathD(x, z) > 3) beds.push([x, z]); }
    const kerbG = new THREE.TorusGeometry(1.7, 0.18, 6, 28); kerbG.rotateX(Math.PI / 2); const soilG = new THREE.CircleGeometry(1.7, 24); soilG.rotateX(-Math.PI / 2);
    const km = new THREE.InstancedMesh(kerbG, new THREE.MeshStandardMaterial({ color: '#d9cfbd', roughness: 0.85 }), beds.length), so = new THREE.InstancedMesh(soilG, new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 1 }), beds.length);
    const per = LOW ? 18 : Math.round(46 * det); const bloom = new THREE.IcosahedronGeometry(0.14, LOW || Q.phone ? 0 : 1); const fm = new THREE.InstancedMesh(bloom, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.6 }), beds.length * per);
    const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshStandardMaterial({ color: '#4c9a3a', roughness: 0.8, flatShading: true }), beds.length * 6);
    const FC = ['#ff5f9e', '#ffd447', '#ffffff', '#b26bff', '#ff8a4a', '#6fb7ff']; const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), c = new THREE.Color(); let f = 0, l = 0;
    beds.forEach(([x, z], b) => { const y = ground(x, z); mt.compose(p.set(x, y + 0.12, z), q, s.set(1, 1, 1)); km.setMatrixAt(b, mt); mt.compose(p.set(x, y + 0.16, z), q, s); so.setMatrixAt(b, mt);
      for (let i = 0; i < 6; i++) { const a = i * 1.05 + R(); mt.compose(p.set(x + Math.cos(a) * 0.9, y + 0.3, z + Math.sin(a) * 0.9), q, s.set(1.1, 0.7, 1.1)); leaf.setMatrixAt(l++, mt); }
      const col = FC[b % FC.length], col2 = FC[(b + 2) % FC.length]; for (let i = 0; i < per; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * 1.45; mt.compose(p.set(x + Math.cos(a) * r, y + 0.42 + R() * 0.28 - r * 0.08, z + Math.sin(a) * r), q, s.setScalar(0.8 + R() * 0.6)); fm.setMatrixAt(f, mt); fm.setColorAt(f, c.set(R() < 0.6 ? col : col2)); f++; } });
    for (const m of [km, so, fm, leaf]) { m.receiveShadow = true; m.castShadow = !LOW && m !== so; scene.add(m); } }

  // ---------------------------------------------------------------- lamp glow halos (additive sprites; bright daytime so subtle)
  if (!LOW) { const sm = new THREE.SpriteMaterial({ map: glowTex(), color: '#fff3c9', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const h of lampHeads) { const sp = new THREE.Sprite(sm); sp.scale.setScalar(1.6); h.add(sp); } }

  return { update(t, cam) { T.value = RM() ? 0 : t; CAM.value.copy(cam.position); for (const u of ups) u(T.value); } };
}
