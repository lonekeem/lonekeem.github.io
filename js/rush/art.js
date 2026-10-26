// Kemy Hill Rush: stage backgrounds, ground, zones, pickups and props. All canvas, no images.
// Drawn in screen pixels; the camera gives world->screen with X(x), Y(y) and ppm (pixels per meter).
const INK = '#2b1d4a';
function hsh(i, s = 0) { let h = Math.imul((i | 0) ^ 0x2545f491, 0x9e3779b1) ^ Math.imul(s | 0, 0x85ebca77); h ^= h >>> 15; h = Math.imul(h, 0xc2b2ae3d); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return `rgb(${f(r)},${f(g)},${f(b)})`; };
export { shade, hsh };

// ---------- sky + parallax
export function drawSky(c, st, cam, W, H, t) {
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, st.sky[0]); g.addColorStop(1, st.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const night = st.night || st.id === 'moon' || st.id === 'volcano';
  if (night) { c.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { const x = ((hsh(i, 3) * W * 1.3 - cam.x * 0.6) % (W * 1.3) + W * 1.3) % (W * 1.3), y = hsh(i, 5) * H * 0.55; c.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 1.3 + i)); c.fillRect(x, y, 2, 2); } c.globalAlpha = 1; }
  // sun / moon / earth
  const sx = W * 0.78, sy = H * 0.2, sr = Math.min(W, H) * 0.075;
  if (st.id === 'moon') { // our planet, cute: blue ball with mint land
    c.fillStyle = '#4fa8ff'; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill(); c.fillStyle = '#7be0a0'; c.beginPath(); c.ellipse(sx - sr * 0.3, sy - sr * 0.1, sr * 0.35, sr * 0.5, 0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(sx + sr * 0.4, sy + sr * 0.35, sr * 0.3, sr * 0.2, 0, 0, 7); c.fill();
  } else {
    const gl = c.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3); gl.addColorStop(0, st.sun); gl.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gl; c.globalAlpha = st.night ? 0.35 : 0.55; c.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6); c.globalAlpha = 1;
    c.fillStyle = st.sun; c.beginPath(); c.arc(sx, sy, sr, 0, 7); c.fill();
    if (st.night) { c.fillStyle = st.sky[1]; c.beginPath(); c.arc(sx + sr * 0.45, sy - sr * 0.2, sr * 0.85, 0, 7); c.fill(); } // crescent
  }
  if (!night && st.id !== 'city') { // puffy clouds
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 5; i++) { const span = W + 300, x = ((hsh(i, 9) * span - cam.x * 2 - t * 6) % span + span) % span - 150, y = H * (0.08 + hsh(i, 11) * 0.25), s = 0.6 + hsh(i, 13) * 0.6;
      c.beginPath(); c.arc(x, y, 26 * s, 0, 7); c.arc(x + 30 * s, y - 12 * s, 32 * s, 0, 7); c.arc(x + 62 * s, y, 24 * s, 0, 7); c.rect(x, y, 62 * s, 24 * s); c.fill(); }
  }
}
// rolling silhouette layer; k = parallax factor
function hills(c, cam, W, H, k, col, base, amp, wl, sd) {
  c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
  for (let sx = 0; sx <= W + 8; sx += 8) { const wx = (sx + cam.x * k * cam.ppm) / 60; const y = base - amp * (0.55 * Math.sin(wx / wl + sd) + 0.3 * Math.sin(wx / (wl * 0.43) + sd * 2) + 0.15 * Math.sin(wx / (wl * 0.17) + sd * 3)); c.lineTo(sx, y); }
  c.lineTo(W, H); c.closePath(); c.fill();
}
const layerY = (cam, W, k, base, amp, wl, sd, sx) => { const wx = (sx + cam.x * k * cam.ppm) / 60; return base - amp * (0.55 * Math.sin(wx / wl + sd) + 0.3 * Math.sin(wx / (wl * 0.43) + sd * 2) + 0.15 * Math.sin(wx / (wl * 0.17) + sd * 3)); };
export function drawParallax(c, st, cam, W, H, t) {
  const fb = H * 0.62, mb = H * 0.74, d = st.deco;
  if (d === 'city') { skyline(c, cam, W, H, 0.15, st.far, H * 0.66, 0.9); skyline(c, cam, W, H, 0.35, st.mid, H * 0.8, 1.3); return; }
  if (d === 'volcano') { // big cone with glowing top
    const vx = ((W * 0.3 - cam.x * cam.ppm * 0.05) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3, vy = H * 0.3;
    c.fillStyle = st.far; c.beginPath(); c.moveTo(vx - W * 0.45, H); c.lineTo(vx - W * 0.06, vy); c.lineTo(vx + W * 0.06, vy); c.lineTo(vx + W * 0.45, H); c.fill();
    const gl = c.createRadialGradient(vx, vy, 4, vx, vy, H * 0.25); gl.addColorStop(0, 'rgba(255,140,60,.9)'); gl.addColorStop(1, 'rgba(255,90,40,0)'); c.fillStyle = gl; c.fillRect(vx - H * 0.25, vy - H * 0.25, H * 0.5, H * 0.5);
    c.fillStyle = '#ff8a3a'; c.beginPath(); c.moveTo(vx - W * 0.06, vy); c.lineTo(vx + W * 0.06, vy); c.lineTo(vx + W * 0.03, vy + H * 0.08); c.lineTo(vx - W * 0.04, vy + H * 0.1); c.fill();
  }
  if (d === 'snow') { // pointy far peaks with snow caps
    const per = 220; c.fillStyle = st.far; const off = (cam.x * cam.ppm * 0.12) % per;
    for (let i = -1; i < W / per + 2; i++) { const x = i * per - off, h = H * (0.32 + 0.12 * hsh(Math.floor((i * per + cam.x * cam.ppm * 0.12) / per), 2));
      c.fillStyle = st.far; c.beginPath(); c.moveTo(x - per * 0.7, fb + 40); c.lineTo(x, fb - h * 0.6); c.lineTo(x + per * 0.7, fb + 40); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - per * 0.16, fb - h * 0.6 + per * 0.16 * 0.85); c.lineTo(x, fb - h * 0.6); c.lineTo(x + per * 0.16, fb - h * 0.6 + per * 0.16 * 0.85); c.lineTo(x + per * 0.05, fb - h * 0.6 + per * 0.2); c.lineTo(x - per * 0.05, fb - h * 0.6 + per * 0.13); c.fill(); }
  }
  if (d === 'beach') { // sea with sparkles
    c.fillStyle = st.far; c.fillRect(0, fb, W, H - fb); c.fillStyle = 'rgba(255,255,255,.6)';
    for (let i = 0; i < 14; i++) { const x = ((hsh(i, 21) * W - cam.x * cam.ppm * 0.1 + t * 10) % W + W) % W, y = fb + 8 + hsh(i, 22) * (H - fb) * 0.5; c.fillRect(x, y, 14 + 10 * Math.sin(t + i), 2); }
  } else if (d !== 'snow') hills(c, cam, W, H, 0.12, st.far, fb, H * 0.1, 3.2, 1.3);
  hills(c, cam, W, H, 0.3, st.mid, mb, H * 0.08, 2.2, 4.1);
  // mid-layer props sitting on that layer
  const k = 0.3, per = 150, off = cam.x * cam.ppm * k;
  for (let i = Math.floor(off / per) - 1; i < (off + W) / per + 1; i++) {
    const r = hsh(i, 77); if (r < 0.35) continue; const sx = i * per - off + hsh(i, 78) * per * 0.6, sy = layerY(cam, W, k, mb, H * 0.08, 2.2, 4.1, sx) + 4, s = (0.6 + hsh(i, 79) * 0.5) * Math.min(1.2, H / 420);
    prop(c, d, sx, sy, s, st, r, t, i);
  }
}
function skyline(c, cam, W, H, k, col, base, sc) {
  const off = cam.x * cam.ppm * k; c.fillStyle = col;
  for (let i = Math.floor(off / 46) - 1; i < (off + W) / 46 + 1; i++) { const w = (34 + hsh(i, 31) * 30) * sc, h = (60 + hsh(i, 32) * 150) * sc, x = i * 46 - off;
    c.fillStyle = col; c.fillRect(x, base - h, w, H); c.fillStyle = 'rgba(255,245,200,.35)';
    for (let wy = base - h + 10 * sc; wy < base - 8; wy += 16 * sc) for (let wx = x + 6 * sc; wx < x + w - 8 * sc; wx += 12 * sc) if (hsh(wx | 0, wy | 0) > 0.45) c.fillRect(wx, wy, 5 * sc, 7 * sc); }
}
function prop(c, d, x, y, s, st, r, t, i) {
  c.save(); c.translate(x, y); c.scale(s, s); c.lineWidth = 3; c.strokeStyle = 'rgba(43,29,74,.35)';
  const blob = (cx, cy, rr, col) => { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, rr, 0, 7); c.fill(); };
  if (d === 'meadow') { if (r > 0.75) { c.fillStyle = '#e7c35a'; c.beginPath(); c.roundRect(-18, -24, 36, 24, 8); c.fill(); c.strokeStyle = '#c79a32'; c.beginPath(); c.moveTo(-18, -12); c.lineTo(18, -12); c.stroke(); }
    else { c.fillStyle = '#8a5a35'; c.fillRect(-4, -40, 8, 40); blob(0, -50, 22, '#4fae3e'); blob(-14, -40, 14, '#5cc049'); blob(14, -42, 15, '#5cc049'); } }
  else if (d === 'desert') { c.fillStyle = '#4fae6a'; c.beginPath(); c.roundRect(-7, -56, 14, 56, 7); c.roundRect(-22, -38, 10, 22, 5); c.roundRect(12, -46, 10, 22, 5); c.rect(-16, -22, 10, 8); c.rect(6, -30, 10, 8); c.fill();
    if (r > 0.8) { c.fillStyle = '#ff7ac8'; c.beginPath(); c.arc(0, -58, 5, 0, 7); c.fill(); } }
  else if (d === 'snow') { c.fillStyle = '#2f7d5a'; for (let k = 0; k < 3; k++) { c.beginPath(); c.moveTo(-24 + k * 5, -10 - k * 18); c.lineTo(0, -40 - k * 18); c.lineTo(24 - k * 5, -10 - k * 18); c.fill(); }
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-8, -62); c.lineTo(0, -76); c.lineTo(8, -62); c.fill(); c.fillStyle = '#6b4a2b'; c.fillRect(-4, -10, 8, 10); }
  else if (d === 'beach') { c.strokeStyle = '#a8743f'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(8, -40, -4, -78); c.stroke(); c.fillStyle = '#3fbf6a';
    for (let k = 0; k < 5; k++) { c.save(); c.translate(-4, -78); c.rotate(-2.6 + k * 0.95 + Math.sin(t + i) * 0.05); c.beginPath(); c.ellipse(20, 0, 22, 6, 0.2, 0, 7); c.fill(); c.restore(); } }
  else if (d === 'jungle') { c.fillStyle = '#5b3a1f'; c.fillRect(-6, -70, 12, 70); blob(0, -78, 30, '#1f7a43'); blob(-24, -64, 20, '#279552'); blob(24, -66, 22, '#279552');
    c.strokeStyle = '#3fa34d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-18, -60); c.quadraticCurveTo(-22, -40, -16, -20); c.stroke(); }
  else if (d === 'volcano') { c.fillStyle = '#3a2430'; c.beginPath(); c.moveTo(-16, 0); c.lineTo(-6, -50 - r * 20); c.lineTo(4, -30); c.lineTo(14, 0); c.fill(); }
  else if (d === 'candy') { c.fillStyle = '#fff'; c.fillRect(-3, -60, 6, 60); const cols = ['#ff7ac8', '#7fd8ff', '#ffd23f', '#9ff0d6']; const col = cols[i & 3];
    if (r > 0.7) { blob(0, 0, 0, col); c.fillStyle = col; c.beginPath(); c.ellipse(0, -14, 20, 16, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-6, -22, 5, 3, -0.4, 0, 7); c.fill(); }
    else { blob(0, -68, 20, col); c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); for (let a = 0; a < 12; a += 0.3) c.lineTo(Math.cos(a + t) * a * 1.5, -68 + Math.sin(a + t) * a * 1.5); c.stroke(); } }
  else if (d === 'spooky') { if (r > 0.7) { c.fillStyle = '#ff9a3a'; c.beginPath(); c.ellipse(0, -14, 18, 14, 0, 0, 7); c.fill(); c.fillStyle = '#4d7c0f'; c.fillRect(-2, -32, 4, 6); c.fillStyle = '#ffe08a'; c.beginPath(); c.arc(-6, -16, 2.5, 0, 7); c.arc(6, -16, 2.5, 0, 7); c.fill(); c.beginPath(); c.arc(0, -10, 5, 0.1, Math.PI - 0.1); c.fill(); }
    else { c.strokeStyle = '#3a2f5a'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -50); c.moveTo(0, -30); c.lineTo(-18, -48); c.moveTo(0, -38); c.lineTo(16, -58); c.stroke(); } }
  else if (d === 'moon') { c.fillStyle = '#7d7898'; c.beginPath(); c.ellipse(0, -6, 18 + r * 10, 10, 0, Math.PI, 0); c.fill(); }
  c.restore();
}

// ---------- ghosts (Spooky Night): friendly, smiling, floating
export function drawGhost(c, x, y, s, t, i) {
  c.save(); c.translate(x, y + Math.sin(t * 2 + i) * 6 * s); c.scale(s, s);
  c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.arc(0, -10, 16, Math.PI, 0); c.lineTo(16, 10);
  for (let k = 0; k < 4; k++) c.quadraticCurveTo(12 - k * 8, 16 + (k % 2) * -6, 8 - k * 8, 10); c.closePath(); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(-5, -10, 2.6, 0, 7); c.arc(5, -10, 2.6, 0, 7); c.fill();
  c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.arc(0, -6, 4, 0.2, Math.PI - 0.2); c.stroke();
  c.fillStyle = 'rgba(255,140,190,.6)'; c.beginPath(); c.arc(-9, -5, 3, 0, 7); c.arc(9, -5, 3, 0, 7); c.fill();
  c.restore();
}

// ---------- ground
// cam: { x, y, ppm, X(x), Y(y), x0, x1 } (x0..x1 = visible world range)
export function drawGround(c, st, terr, cam, W, H, t) {
  const { X, Y } = cam, step = Math.max(0.25, Math.min(1, 6 / cam.ppm)), x0 = Math.floor(cam.x0), x1 = Math.ceil(cam.x1);
  const zones = terr.zonesIn(x0, x1);
  const bridges = zones.filter((z) => z.kind === 'bridge'), walks = zones.filter((z) => z.kind === 'boardwalk');
  // fill height: bridges show a ravine below, boardwalks show sand below
  const fillY = (x) => { for (const z of bridges) if (x > z.a - 0.5 && x < z.b + 0.5) { const u = Math.max(0, Math.min(1, (x - z.a) / (z.b - z.a))); return Math.min(terr.base(x), terr.at(x)) - (z.gap || 6) * Math.sin(Math.PI * u) - 0.3; }
    for (const z of walks) if (x >= z.a - 1 && x <= z.b + 1) return Math.min(terr.at(x), terr.base(x)); return terr.at(x); };
  const pts = []; for (let x = x0; x <= x1 + step; x += step) pts.push([X(x), Y(fillY(x))]);
  const g = c.createLinearGradient(0, Y(cam.y + 2), 0, Y(cam.y - 14)); g.addColorStop(0, st.dirt); g.addColorStop(1, st.dirt2);
  c.fillStyle = g; c.beginPath(); c.moveTo(pts[0][0], H + 10); for (const p of pts) c.lineTo(p[0], p[1]); c.lineTo(pts[pts.length - 1][0], H + 10); c.closePath(); c.fill();
  // dirt specks
  c.fillStyle = 'rgba(0,0,0,.08)'; for (let x = Math.floor(x0 / 2) * 2; x < x1; x += 2) { const r = hsh(x, 5); const gy = fillY(x) - 0.8 - r * 4; c.beginPath(); c.arc(X(x + r), Y(gy), cam.ppm * (0.08 + r * 0.1), 0, 7); c.fill(); }
  // top layer (grass / sand / snow...): thick band following the surface
  const band = 0.38 * cam.ppm;
  c.lineJoin = 'round'; c.lineCap = 'round';
  const surface = (col, w, dy = 0, skip) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); let on = false;
    for (let x = x0; x <= x1 + step; x += step) { if (skip && skip(x)) { on = false; continue; } const sx = X(x), sy = Y(fillY(x)) + dy; if (!on) { c.moveTo(sx, sy); on = true; } else c.lineTo(sx, sy); } c.stroke(); };
  const noTop = (x) => bridges.some((z) => x > z.a - 0.3 && x < z.b + 0.3) || (st.deco === 'city' && false);
  surface(st.top, band, band * 0.35, noTop); surface(st.top2, band * 0.28, 0, noTop);
  // special zone looks
  for (const z of zones) drawZone(c, st, terr, cam, z, t, step);
  // ground props (tiny, every few meters)
  for (let x = Math.floor(x0 / 3) * 3; x < x1; x += 3) { const r = hsh(x, 17); if (r < 0.55 || terr.zoneAt(x)) continue; const gx = x + hsh(x, 18) * 2, gy = terr.at(gx); tiny(c, st.deco, X(gx), Y(gy), cam.ppm, r, t); }
}
function tiny(c, d, x, y, ppm, r, t) {
  const s = ppm / 40; c.save(); c.translate(x, y); c.scale(s, s);
  if (d === 'meadow') { if (r > 0.8) { c.fillStyle = '#fff'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(Math.cos(k * 1.26) * 4, -10 + Math.sin(k * 1.26) * 4, 3, 0, 7); c.fill(); } c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(0, -10, 2.5, 0, 7); c.fill(); }
    else { c.strokeStyle = '#3f9e2e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-6, -9); c.moveTo(0, 0); c.lineTo(0, -12); c.moveTo(4, 0); c.lineTo(6, -9); c.stroke(); } }
  else if (d === 'desert' || d === 'moon' || d === 'volcano') { c.fillStyle = d === 'desert' ? '#c98a45' : d === 'moon' ? '#a19cbd' : '#2a1c24'; c.beginPath(); c.ellipse(0, -2, 6 + r * 4, 4, 0, Math.PI, 0); c.fill();
    if (d === 'volcano' && r > 0.85) { c.fillStyle = `rgba(255,${120 + Math.sin(t * 5 + r * 9) * 60 | 0},40,.9)`; c.beginPath(); c.arc(0, -14 - ((t * 20 + r * 50) % 30), 2, 0, 7); c.fill(); } }
  else if (d === 'snow') { c.fillStyle = '#fff'; c.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + r * 20); c.fillRect(-1, -6, 2, 2); }
  else if (d === 'beach') { c.fillStyle = r > 0.8 ? '#ff9ab8' : '#fff4dd'; c.beginPath(); c.arc(0, -3, 4, Math.PI, 0); c.fill(); }
  else if (d === 'jungle') { c.fillStyle = '#2f9e44'; for (let k = -1; k <= 1; k++) { c.beginPath(); c.ellipse(k * 6, -8, 3, 9, k * 0.5, 0, 7); c.fill(); } }
  else if (d === 'candy') { const cols = ['#ff7ac8', '#7fd8ff', '#ffd23f', '#9ff0d6']; c.fillStyle = cols[(r * 40 | 0) & 3]; c.save(); c.rotate(r * 3); c.fillRect(-4, -6, 8, 3); c.restore(); }
  else if (d === 'spooky') { if (r > 0.85) { c.fillStyle = '#ff9a3a'; c.beginPath(); c.ellipse(0, -5, 7, 5.5, 0, 0, 7); c.fill(); c.fillStyle = '#4d7c0f'; c.fillRect(-1, -12, 2, 3); } }
  c.restore();
}
function drawZone(c, st, terr, cam, z, t, step) {
  const { X, Y, ppm } = cam; const line = (f, col, w, dy = 0) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); for (let x = z.a; x <= z.b + 1e-6; x += step) { const sx = X(x), sy = Y(f(x)) + dy; x === z.a ? c.moveTo(sx, sy) : c.lineTo(sx, sy); } c.stroke(); };
  const at = terr.at;
  if (z.kind === 'loose') { line(at, 'rgba(201,138,69,.55)', ppm * 0.3, ppm * 0.12); c.fillStyle = 'rgba(160,100,40,.35)'; for (let x = z.a; x < z.b; x += 0.7) c.fillRect(X(x), Y(at(x)) + ppm * 0.05, 2, 2); }
  else if (z.kind === 'ice') { line(at, '#bfe6ff', ppm * 0.34, ppm * 0.1); line(at, 'rgba(255,255,255,.9)', ppm * 0.07, -ppm * 0.03); c.fillStyle = '#fff'; for (let x = z.a + 1; x < z.b; x += 3) { const a = Math.abs(Math.sin(t * 2 + x)); c.globalAlpha = a; star4(c, X(x), Y(at(x)) - ppm * 0.15, ppm * 0.12); } c.globalAlpha = 1; }
  else if (z.kind === 'mud') { line(at, '#5a3a1c', ppm * 0.4, ppm * 0.1); c.fillStyle = '#7a5230'; for (let x = z.a + 0.5; x < z.b; x += 1.6) { c.beginPath(); c.ellipse(X(x), Y(at(x)) + ppm * 0.02, ppm * 0.22, ppm * 0.07, 0, 0, 7); c.fill(); } }
  else if (z.kind === 'jelly') { const wob = (x) => at(x) + Math.sin(t * 6 + x) * 0.04; line(wob, '#9ff0d6', ppm * 0.42, ppm * 0.1); line(wob, 'rgba(255,255,255,.8)', ppm * 0.08, -ppm * 0.02); }
  else if (z.kind === 'lava') { const top = terr.poolTop(z); c.save(); c.shadowColor = '#ff7a2a'; c.shadowBlur = ppm * 0.6; line(at, '#ff7a2a', ppm * 0.42, ppm * 0.12); line(at, '#ffd36a', ppm * 0.12, -ppm * 0.02); c.shadowBlur = 0; c.beginPath(); c.moveTo(X(z.a), Y(top)); for (let x = z.a; x <= z.b + 1e-6; x += step) c.lineTo(X(x), Y(Math.min(at(x), top + 0.01)) ); c.lineTo(X(z.b), Y(top)); c.closePath();
    const g = c.createLinearGradient(0, Y(top), 0, Y(top - 1.6)); g.addColorStop(0, '#ffcf4a'); g.addColorStop(1, '#ff5a2a'); c.fillStyle = g; c.fill();
    c.shadowColor = '#ff7a2a'; c.shadowBlur = ppm * 0.8; c.strokeStyle = '#ffe58a'; c.lineWidth = ppm * 0.08; c.beginPath(); for (let x = z.a; x <= z.b; x += 0.3) { const sx = X(x), sy = Y(top) + Math.sin(t * 4 + x * 2) * ppm * 0.04; x === z.a ? c.moveTo(sx, sy) : c.lineTo(sx, sy); } c.stroke(); c.restore();
    c.fillStyle = 'rgba(255,230,140,.9)'; for (let k = 0; k < 3; k++) { const x = z.a + ((t * 0.7 + k * 0.37) % 1) * (z.b - z.a), ph = (t * 1.3 + k) % 1; c.beginPath(); c.arc(X(x), Y(top + ph * 0.8), ppm * 0.08 * (1 - ph), 0, 7); c.fill(); } }
  else if (z.kind === 'boardwalk' || z.kind === 'bridge') {
    const br = z.kind === 'bridge'; const plank = br ? '#a0703f' : '#c8925a', dark = br ? '#6b4423' : '#8f5f32';
    const xa = z.a - 3, xb = z.b + 3;
    if (!br) { c.fillStyle = dark; for (let x = Math.ceil(xa / 2.5) * 2.5; x <= xb; x += 2.5) { const y = at(x), b = terr.base(x); if (y - b > 0.15) c.fillRect(X(x) - ppm * 0.08, Y(y), ppm * 0.16, (y - b) * ppm + 4); } }
    else { // vine ropes from posts at both ends
      const pa = at(z.a) + 1.4, pb = at(z.b) + 1.4; c.strokeStyle = '#3f9e2e'; c.lineWidth = ppm * 0.09;
      c.beginPath(); c.moveTo(X(z.a), Y(pa)); c.quadraticCurveTo(X((z.a + z.b) / 2), Y((pa + pb) / 2 - (z.sag || 0) * 1.6), X(z.b), Y(pb)); c.stroke();
      c.lineWidth = ppm * 0.04; for (let x = z.a + 1; x < z.b; x += 1.2) { const u = (x - z.a) / (z.b - z.a), ry = (pa * (1 - u) + pb * u) - (z.sag || 0) * 1.6 * 2 * u * (1 - u) * 2; c.beginPath(); c.moveTo(X(x), Y(ry)); c.lineTo(X(x), Y(at(x))); c.stroke(); }
      c.fillStyle = '#6b4423'; for (const x of [z.a, z.b]) c.fillRect(X(x) - ppm * 0.1, Y(at(x) + 1.5), ppm * 0.2, ppm * 1.7);
      c.fillStyle = '#7be06c'; for (let x = z.a + 0.6; x < z.b; x += 1.9) { c.beginPath(); c.ellipse(X(x), Y(at(x) + 0.75), ppm * 0.12, ppm * 0.06, 0.6, 0, 7); c.fill(); } }
    const bx0 = br ? z.a - 0.2 : xa, bx1 = br ? z.b + 0.2 : xb;
    c.strokeStyle = dark; c.lineWidth = ppm * 0.26; c.lineCap = 'butt'; c.beginPath(); for (let x = bx0; x <= bx1; x += step) { const sx = X(x), sy = Y(at(x)) + ppm * 0.1; x === bx0 ? c.moveTo(sx, sy) : c.lineTo(sx, sy); } c.stroke();
    c.fillStyle = plank; for (let x = bx0; x < bx1; x += 0.55) { const y = at(x + 0.25), a = Math.atan(terr.slope(x + 0.25)); c.save(); c.translate(X(x + 0.25), Y(y)); c.rotate(-a); c.fillRect(-ppm * 0.24, 0, ppm * 0.48, ppm * 0.16); c.restore(); }
  }
}
function star4(c, x, y, r) { c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r * 0.25, y - r * 0.25); c.lineTo(x + r, y); c.lineTo(x + r * 0.25, y + r * 0.25); c.lineTo(x, y + r); c.lineTo(x - r * 0.25, y + r * 0.25); c.lineTo(x - r, y); c.lineTo(x - r * 0.25, y - r * 0.25); c.closePath(); c.fill(); }

// ---------- city buildings drawn over the plain ground fill
export function drawCity(c, st, terr, cam, W, H) {
  const { X, Y, ppm } = cam; const cols = ['#8e7cc3', '#6f8fd6', '#d98aa8', '#7fb7a6', '#c9a46a'];
  for (const b of terr.buildings(cam.x0 - 10, cam.x1 + 10)) {
    if (b.x1 < cam.x0 - 6) continue; const col = cols[Math.abs(Math.round(b.x0)) % 5], x0 = X(b.x0 - 0.0), x1 = X(b.x1 + (b.up ? 5 : 4)), top = Y(b.h);
    c.fillStyle = col; c.fillRect(x0, top, x1 - x0, H - top + 10);
    c.fillStyle = 'rgba(255,248,214,.75)'; for (let wy = b.h - 1.2; wy > b.h - 14 && Y(wy) < H; wy -= 1.6) for (let wx = b.x0 + 0.8; wx < b.x1 + 3; wx += 1.5) { if (hsh(Math.round(wx * 10), Math.round(wy * 10)) < 0.3) continue; c.fillRect(X(wx), Y(wy), ppm * 0.6, ppm * 0.8); }
    c.fillStyle = '#4a3f6b'; c.fillRect(x0, top - ppm * 0.12, x1 - x0, ppm * 0.2); // roof ledge
    // kicker ramp / walkway
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(X(b.x1), Y(b.h)); for (let x = b.x1; x <= b.x1 + (b.up ? 5 : 4); x += 0.25) c.lineTo(X(x), Y(terr.at(x))); c.lineTo(X(b.x1 + (b.up ? 5 : 4)), Y(b.h)); c.closePath(); c.fill();
    c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    if (b.next && b.next.gap) { // striped awning across the gap
      const gx = b.x1 + 4, n = b.next; c.lineWidth = ppm * 0.3; c.lineCap = 'butt';
      for (let x = gx; x < n.x0; x += 0.5) { c.strokeStyle = (Math.floor((x - gx) / 0.5) & 1) ? '#ff6b8b' : '#fff'; c.beginPath(); c.moveTo(X(x), Y(terr.at(x)) + ppm * 0.12); c.lineTo(X(x + 0.5), Y(terr.at(x + 0.5)) + ppm * 0.12); c.stroke(); } }
  }
}

// ---------- pickups
export function drawStarCoin(c, x, y, r, t) {
  c.save(); c.translate(x, y); c.scale(Math.abs(Math.cos(t * 3)) * 0.4 + 0.6, 1);
  c.fillStyle = '#ffd23f'; c.strokeStyle = '#d08a00'; c.lineWidth = Math.max(1.5, r * 0.18); c.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(-r * 0.2, -r * 0.25, r * 0.16, 0, 7); c.fill(); c.restore();
}
export function drawDiamond(c, x, y, r, t) {
  c.save(); c.translate(x, y + Math.sin(t * 3) * r * 0.15); c.shadowColor = '#7fe8ff'; c.shadowBlur = r;
  c.fillStyle = '#5fd4ff'; c.strokeStyle = '#1d6fb8'; c.lineWidth = Math.max(1.5, r * 0.14);
  c.beginPath(); c.moveTo(-r, -r * 0.3); c.lineTo(-r * 0.5, -r * 0.8); c.lineTo(r * 0.5, -r * 0.8); c.lineTo(r, -r * 0.3); c.lineTo(0, r); c.closePath(); c.fill(); c.shadowBlur = 0; c.stroke();
  c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.8); c.lineTo(-r * 0.15, -r * 0.3); c.lineTo(-r, -r * 0.3); c.closePath(); c.fill(); c.restore();
}
// fuel: a rounded teal droplet canister with a bolt (original look)
export function drawFuel(c, x, y, r, t) {
  c.save(); c.translate(x, y + Math.sin(t * 2.5) * r * 0.12);
  c.fillStyle = '#2ed3b7'; c.strokeStyle = INK; c.lineWidth = Math.max(2, r * 0.12);
  c.beginPath(); c.moveTo(0, -r * 1.15); c.bezierCurveTo(r * 0.5, -r * 0.5, r * 0.95, -r * 0.05, r * 0.95, r * 0.35); c.arc(0, r * 0.35, r * 0.95, 0, Math.PI); c.bezierCurveTo(-r * 0.95, -r * 0.05, -r * 0.5, -r * 0.5, 0, -r * 1.15); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ffe14d'; c.beginPath(); c.moveTo(r * 0.12, -r * 0.45); c.lineTo(-r * 0.32, r * 0.42); c.lineTo(-r * 0.02, r * 0.42); c.lineTo(-r * 0.14, r * 0.95); c.lineTo(r * 0.34, r * 0.12); c.lineTo(r * 0.04, r * 0.12); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-r * 0.45, r * 0.05, r * 0.14, r * 0.3, 0.3, 0, 7); c.fill(); c.restore();
}
// checkpoint: a mint arch with a star; finish: a purple/yellow arch
export function drawGate(c, x, y, ppm, label, fin, t) {
  const w = 5 * ppm, h = 4.6 * ppm; c.save(); c.translate(x, y); c.lineCap = 'round';
  c.strokeStyle = fin ? '#8a55dc' : '#2ed3b7'; c.lineWidth = ppm * 0.32; c.beginPath(); c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h); c.moveTo(w / 2, 0); c.lineTo(w / 2, -h); c.stroke();
  c.fillStyle = fin ? '#ffd23f' : '#fff'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.roundRect(-w / 2 - ppm * 0.3, -h - ppm * 1.1, w + ppm * 0.6, ppm * 1.1, ppm * 0.4); c.fill(); c.stroke();
  c.fillStyle = INK; c.font = `800 ${Math.round(ppm * 0.62)}px system-ui,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, 0, -h - ppm * 0.55);
  for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff7ac8', '#ffd23f', '#5fd4ff'][i % 3]; c.fillRect(-w / 2 + (i + 0.5) * w / 6 - ppm * 0.12, -h + Math.sin(t * 4 + i) * ppm * 0.1, ppm * 0.24, ppm * 0.42); }
  c.restore();
}
