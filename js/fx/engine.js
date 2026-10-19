// Lone Keem Studios - WebGL filter engine. One fragment shader does: face warps (bulge / pinch /
// swirl / mirror), skin-masked smoothing ("Smooth skin"), an effect (soft glow, background blur,
// neon edge, studio backdrop) and the colour look. Works on <video>, <img> or <canvas> sources.
import { lookById } from './looks.js';

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = vec2((p.x+1.)*.5, (1.-p.y)*.5); gl_Position = vec4(p,0.,1.); }`;
const FS = `precision mediump float;
varying vec2 v;
uniform sampler2D T, M, K;
uniform vec2 R; uniform float A, uTime;
uniform float uExp, uCon, uSat, uTemp, uTint, uFade, uVig, uHue, uMono, uSplit, uGrain;
uniform vec3 uSh, uHi;
uniform int uFx; uniform float hasM, hasK, uBeauty;
uniform vec4 W0, W1, W2, uSw, uMi;
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
vec2 warp(vec2 p, vec4 w){
  if (w.z <= 0.) return p;
  vec2 d = (p - w.xy) * vec2(A, 1.); float l = length(d);
  if (l >= w.z) return p;
  float k = 1. - l / w.z; float s = 1. - w.w * k * k;
  return w.xy + d * s / vec2(A, 1.);
}
vec3 tex(vec2 p){ return texture2D(T, clamp(p, vec2(.001), vec2(.999))).rgb; }
vec3 blur(vec2 p, float rad){
  vec3 s = vec3(0.); for (int i = 0; i < 16; i++){ float fi = float(i); float a = fi * 2.39996; float r = sqrt((fi + .5) / 16.);
    s += tex(p + vec2(cos(a), sin(a)) * r * rad * R); } return s / 16.;
}
float hash(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 backdrop(vec2 p){
  vec3 top = vec3(.20,.05,.36), bot = vec3(.03,.0,.08);
  vec3 c = mix(top, bot, p.y);
  float spot = smoothstep(.75, 0., length((p - vec2(.5,.08)) * vec2(A*.7, 1.)));
  c += vec3(.55,.3,.9) * spot * .55;
  vec2 g = fract(p * vec2(A*14., 14.)); float star = step(.985, hash(floor(p * vec2(A*60., 60.)))) * (.5 + .5 * sin(uTime * 2. + p.x * 40.));
  c += vec3(1., .83, .3) * star * .8;
  return c;
}
void main(){
  vec2 p = v;
  // face warps
  p = warp(p, W0); p = warp(p, W1); p = warp(p, W2);
  if (uSw.z > 0.) { vec2 d = (p - uSw.xy) * vec2(A,1.); float l = length(d);
    if (l < uSw.z) { float k = 1. - l / uSw.z; float an = uSw.w * k * k; float cs = cos(an), sn = sin(an);
      d = vec2(d.x*cs - d.y*sn, d.x*sn + d.y*cs); p = uSw.xy + d / vec2(A,1.); } }
  if (uMi.w > 0.) { vec2 d = (p - uMi.xy) * vec2(A,1.); if (abs(d.y) < uMi.z && abs(d.x) < uMi.z * .8 && d.x > 0.) p.x = uMi.x - d.x / A; }
  vec3 c = tex(p);
  // smooth skin (edge-preserving, only where the skin mask says so)
  if (uBeauty > 0. && hasK > 0.) {
    float k = texture2D(K, v).r;
    if (k > .02) {
      vec3 s = vec3(0.); float ws = 0.;
      for (int i = 0; i < 16; i++){ float fi = float(i); float a = fi * 2.39996; float r = sqrt((fi + .5) / 16.);
        vec3 q = tex(p + vec2(cos(a), sin(a)) * r * (4. + 7. * uBeauty) * R); vec3 df = q - c; float w = exp(-dot(df, df) * 60.); s += q * w; ws += w; }
      s /= ws; float amt = k * uBeauty;
      c = mix(c, s, amt);
      float l = lum(c); c = mix(c, c * 1.04 + .025, amt * .55);          // gentle lift
      c = mix(c, c + (vec3(l) * vec3(1.03, .99, .97) - c) * .25, amt * .4); // even out tone
    }
  }
  // effects
  if (uFx == 1) { vec3 b = blur(p, 14.); c = 1. - (1. - c) * (1. - b * .5); c = mix(c, b, .15); }
  else if (uFx == 2 || uFx == 4) {
    float m = hasM > 0. ? texture2D(M, v).r : 1. - smoothstep(.28, .52, length((v - vec2(.5,.45)) * vec2(A, 1.)));
    m = smoothstep(.25, .75, m);
    vec3 bg = uFx == 2 ? blur(p, 26.) : backdrop(v);
    c = mix(bg, c, m);
  }
  else if (uFx == 3) {
    float tl = lum(tex(p + vec2(-1.,-1.)*R*1.5)), t = lum(tex(p + vec2(0.,-1.)*R*1.5)), tr = lum(tex(p + vec2(1.,-1.)*R*1.5));
    float l = lum(tex(p + vec2(-1.,0.)*R*1.5)), r = lum(tex(p + vec2(1.,0.)*R*1.5));
    float bl = lum(tex(p + vec2(-1.,1.)*R*1.5)), b = lum(tex(p + vec2(0.,1.)*R*1.5)), br = lum(tex(p + vec2(1.,1.)*R*1.5));
    float gx = tr + 2.*r + br - tl - 2.*l - bl, gy = bl + 2.*b + br - tl - 2.*t - tr;
    float e = smoothstep(.12, .55, length(vec2(gx, gy)));
    c = c * .45 + vec3(.72, .36, 1.) * e * 1.6 + vec3(1., .85, .4) * e * e * .4;
  }
  // colour look
  c *= pow(2., uExp);
  c.r += uTemp * .1; c.b -= uTemp * .1; c.g -= uTint * .05; c.r += uTint * .02; c.b += uTint * .03;
  if (uHue != 0.) { float an = radians(uHue); float cs = cos(an), sn = sin(an);
    mat3 toY = mat3(.299, .596, .211, .587, -.274, -.523, .114, -.322, .312);
    mat3 toR = mat3(1., 1., 1., .956, -.272, -1.106, .621, -.647, 1.703);
    vec3 y = toY * c; y = vec3(y.x, y.y*cs - y.z*sn, y.y*sn + y.z*cs); c = toR * y; }
  float L = lum(c);
  c = mix(vec3(L), c, uSat); c = mix(c, vec3(L), uMono);
  c = (c - .5) * uCon + .5;
  if (uSplit > 0.) { vec3 tone = mix(uSh, uHi, smoothstep(.1, .9, L)); c = mix(c, c * (.55 + .9 * tone), uSplit); }
  c = c * (1. - uFade * .22) + uFade * .09;
  if (uVig > 0.) c *= 1. - uVig * smoothstep(.35, .95, length((v - .5) * vec2(1., 1.)) * 1.4);
  if (uGrain > 0.) c += (hash(v * 917. + uTime) - .5) * uGrain;
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`;

export function createEngine(canvas = document.createElement('canvas')) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false })
    || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
  if (!gl) return null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ap = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(ap); gl.vertexAttribPointer(ap, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['T', 'M', 'K', 'R', 'A', 'uTime', 'uExp', 'uCon', 'uSat', 'uTemp', 'uTint', 'uFade', 'uVig', 'uHue', 'uMono', 'uSplit', 'uGrain', 'uSh', 'uHi', 'uFx', 'hasM', 'hasK', 'uBeauty', 'W0', 'W1', 'W2', 'uSw', 'uMi']
    .forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));
  const mkTex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([255])); return t; };
  const tT = mkTex(0), tM = mkTex(1), tK = mkTex(2);
  gl.uniform1i(U.T, 0); gl.uniform1i(U.M, 1); gl.uniform1i(U.K, 2);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  let hasM = 0, hasK = 0;
  const FX = { none: 0, glow: 1, bgblur: 2, neon: 3, backdrop: 4 };
  const t0 = performance.now();
  return {
    canvas, gl,
    // mask: { data: Uint8Array, w, h } (segmentation confidence 0..255) or null
    setSegMask(mask) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tM);
      if (mask) { gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, mask.w, mask.h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask.data); hasM = 1; } else hasM = 0;
    },
    // skin mask: a canvas (white = skin) or null
    setSkinMask(c) {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tK);
      if (c) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); hasK = 1; } else hasK = 0;
    },
    // params: { look, beauty (0..1), fx, warps: [vec4 x3], swirl: vec4, mirror: vec4 }
    render(src, w, h, params = {}) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tT);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
      const L = typeof params.look === 'object' ? params.look : lookById(params.look);
      gl.uniform2f(U.R, 1 / w, 1 / h); gl.uniform1f(U.A, w / h); gl.uniform1f(U.uTime, (performance.now() - t0) / 1000);
      gl.uniform1f(U.uExp, L.exp || 0); gl.uniform1f(U.uCon, L.con ?? 1); gl.uniform1f(U.uSat, L.sat ?? 1);
      gl.uniform1f(U.uTemp, L.temp || 0); gl.uniform1f(U.uTint, L.tint || 0); gl.uniform1f(U.uFade, L.fade || 0);
      gl.uniform1f(U.uVig, L.vig || 0); gl.uniform1f(U.uHue, L.hue || 0); gl.uniform1f(U.uMono, L.mono || 0);
      gl.uniform1f(U.uSplit, L.split || 0); gl.uniform1f(U.uGrain, L.grain || 0);
      gl.uniform3fv(U.uSh, L.sh || [0.5, 0.5, 0.5]); gl.uniform3fv(U.uHi, L.hi || [0.5, 0.5, 0.5]);
      gl.uniform1i(U.uFx, FX[params.fx] || 0); gl.uniform1f(U.hasM, hasM); gl.uniform1f(U.hasK, hasK);
      gl.uniform1f(U.uBeauty, params.beauty || 0);
      const wz = params.warps || [];
      gl.uniform4fv(U.W0, wz[0] || [0, 0, 0, 0]); gl.uniform4fv(U.W1, wz[1] || [0, 0, 0, 0]); gl.uniform4fv(U.W2, wz[2] || [0, 0, 0, 0]);
      gl.uniform4fv(U.uSw, params.swirl || [0, 0, 0, 0]); gl.uniform4fv(U.uMi, params.mirror || [0, 0, 0, 0]);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tM);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tK);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return canvas;
    },
    destroy() { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch {} }
  };
}
