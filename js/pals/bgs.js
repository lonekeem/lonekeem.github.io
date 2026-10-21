// Pal backgrounds: original procedural scenes drawn on canvas (no image downloads, ~0 KB each).
// id prefix: b_ = free (rules allow without purchase), bp_ = premium (needs users/{uid}/inv/{id}).
// Each scene: sky gradient, ground, scenery layer, optional animated particles. Static layers are cached per size.
const S = (id, name, sky, ground, deco, fx, p = 0, r = 'c') => ({ id, name, sky, ground, deco, fx, p, r, kind: 'bg' });
export const BGS = [
  S('b_studio', 'Kemy Purple Studio', ['#2a1458', '#6b3fd6'], '#3a1f78', 'studio', 'sparkle'),
  S('b_bedroom', 'Cozy Bedroom', ['#ffd9e8', '#ffeef5'], '#c99a7a', 'bedroom', null),
  S('b_park', 'Sunny Park', ['#7ec8ff', '#d8f0ff'], '#6cc46a', 'park', null),
  S('b_beach', 'Beach Day', ['#5ec8ff', '#c8f0ff'], '#ffe2a0', 'beach', null),
  S('b_space', 'Outer Space', ['#05031a', '#1c1250'], null, 'planets', 'stars'),
  S('b_underwater', 'Under the Sea', ['#0a5a9a', '#3ac0e0'], '#e8d29a', 'sea', 'bubbles'),
  S('b_candy', 'Candy Land', ['#ffc6f0', '#fff0fa'], '#ff9ccf', 'candy', null),
  S('b_snowy', 'Snowy Mountain', ['#9ab8e8', '#e8f2ff'], '#ffffff', 'mountains', 'snow'),
  S('b_citynight', 'City at Night', ['#0c0a2a', '#3a2a6a'], '#1a1530', 'city', 'twinkle'),
  S('b_rainbow', 'Rainbow Sky', ['#9ad8ff', '#fff6d8'], '#8ad870', 'rainbow', null),
  S('b_forest', 'Green Forest', ['#a8e0b0', '#e8f8e0'], '#4a9a50', 'trees', 'leaves'),
  S('b_desert', 'Desert Dunes', ['#ffb36a', '#ffe8b0'], '#f0c070', 'dunes', null),
  S('b_castle', 'Fairy Castle', ['#c8a8ff', '#ffe0f0'], '#9ad890', 'castle', 'sparkle'),
  S('b_school', 'School Day', ['#9ad0ff', '#e8f6ff'], '#b0b8c0', 'school', null),
  S('b_gaming', 'Gaming Room', ['#1a1040', '#3a1a7a'], '#24184a', 'gaming', 'twinkle'),
  S('b_meadow', 'Flower Meadow', ['#a8dcff', '#f0faff'], '#7ad070', 'flowers', null),
  S('b_sunset', 'Sunset Hills', ['#ff7a8a', '#ffd08a'], '#c06a8a', 'hills', null),
  S('b_farm', 'Little Farm', ['#8ad0ff', '#e0f4ff'], '#8ac860', 'farm', null),
  S('b_clouds', 'Above the Clouds', ['#7ab8ff', '#ffffff'], null, 'clouds', null),
  S('b_library', 'Story Library', ['#e8c8a0', '#fff0dc'], '#a0704a', 'books', null),
  S('b_kitchen', 'Cupcake Bakery', ['#fff0d8', '#fffaf0'], '#e0b890', 'kitchen', null),
  S('b_garden', 'Secret Garden', ['#b8e8c0', '#f0fff0'], '#5ab060', 'garden', 'leaves'),
  S('b_bubbles', 'Bubble Party', ['#7ad8ff', '#e0f8ff'], null, 'none', 'bubbles'),
  S('b_stars', 'Falling Stars', ['#120a3a', '#3a2080'], null, 'moon', 'falling'),
  S('b_confetti', 'Confetti Pop', ['#fff0fa', '#ffe0f0'], null, 'none', 'confetti'),
  S('b_snowfall', 'Snow Day', ['#b8cce8', '#eef4ff'], '#ffffff', 'pines', 'snow'),
  S('b_pumpkin', 'Pumpkin Patch', ['#3a1a5a', '#ff9a4a'], '#5a3a2a', 'pumpkins', null),
  S('b_winter', 'Winter Holiday', ['#1a2a5a', '#4a6aaa'], '#ffffff', 'giftree', 'snow'),
  S('b_hearts', 'Heart Day', ['#ffb3cf', '#ffe8f0'], null, 'none', 'hearts'),
  S('b_spring', 'Spring Blossoms', ['#c8e8ff', '#fff0f8'], '#9ad880', 'blossom', 'petals'),
  S('b_bobatea', 'Bubble Tea Shop', ['#ffe0c8', '#fff4ea'], '#d8a878', 'boba', 'bubbles'),
  S('b_unicorn', 'Pastel Unicorn Meadow', ['#e0c8ff', '#fff0fa'], '#b8f0d0', 'rainbow', 'sparkle'),
  S('b_kawaii', 'Kawaii Stars', ['#ffd0ec', '#d8c8ff'], null, 'kawaii', 'twinkle'),
  S('b_icecream', 'Ice Cream Beach', ['#9ae0ff', '#fff0f8'], '#ffe8c0', 'icecream', null),
  S('b_flowergdn', 'Flower Garden', ['#d0f0ff', '#fff8f0'], '#8ad870', 'garden', 'petals'),
  // premium
  S('bp_concert', 'Concert Stage', ['#0a0420', '#2a0a5a'], '#150a2a', 'stage', 'lights', 250, 'r'),
  S('bp_galaxy', 'Galaxy Swirl', ['#0a0230', '#5a1a8a'], null, 'galaxy', 'stars', 300, 'e'),
  S('bp_aurora', 'Aurora Night', ['#04122a', '#1a3a5a'], '#e8f4ff', 'aurora', 'twinkle', 300, 'e'),
  S('bp_volcano', 'Dragon Volcano', ['#3a0a1a', '#ff6a3a'], '#3a1a1a', 'volcano', 'embers', 250, 'r'),
  S('bp_moon', 'Moon Base', ['#000010', '#101040'], '#9a9ab0', 'moonbase', 'stars', 250, 'r'),
  S('bp_reef', 'Rainbow Reef', ['#0a6ab0', '#5ae0f0'], '#f0d8a0', 'reef', 'bubbles', 200, 'r'),
  S('bp_gold', 'Golden Palace', ['#ffe08a', '#fff8e0'], '#e0b040', 'palace', 'sparkle', 600, 'l'),
  S('bp_crystal', 'Crystal Cave', ['#1a1050', '#5a3aa0'], '#2a1a60', 'crystals', 'sparkle', 350, 'e'),
  S('bp_cloudcastle', 'Cloud Castle', ['#9ad0ff', '#fff6ff'], null, 'cloudcastle', 'sparkle', 400, 'e'),
  S('bp_disco', 'Disco Party', ['#1a0430', '#5a0a6a'], '#2a0a3a', 'disco', 'lights', 300, 'e'),
  S('bp_jungle', 'Jungle Waterfall', ['#5ab080', '#c8f0d0'], '#3a8a4a', 'jungle', 'leaves', 200, 'r'),
  S('bp_sakura', 'Cherry Blossom Night', ['#2a1a4a', '#8a5a9a'], '#4a3a5a', 'blossom', 'petals', 250, 'r'),
  // ✨ 2026 cute collection (scenery2 below: layered gradient art, soft shading, no images)
  S('b_pastelsky', 'Pastel Cloud Sky', ['#bfe3ff', '#ffe6f4'], null, 'v2pastel', 'sparkle'),
  S('b_starmoon', 'Starry Moon Night', ['#0d0b33', '#3b2a7a'], '#1e1850', 'v2moon', 'twinkle'),
  S('b_sakuragdn', 'Cherry Blossom Garden', ['#ffe3ef', '#fff6fa'], '#a8dc9a', 'v2sakura', 'petals'),
  S('b_rbmeadow', 'Rainbow Meadow', ['#a6dcff', '#fff7e0'], '#86d47a', 'v2rbmeadow', null),
  S('b_bubblesea', 'Bubble Lagoon', ['#2a8ad0', '#9ae8f0'], '#f2dca8', 'v2sea', 'bubbles'),
  S('b_cozyroom', 'Cozy Pastel Bedroom', ['#ffe8d8', '#fff5ec'], '#d8a888', 'v2room', null),
  S('b_beachset', 'Beach Sunset', ['#ff8a7a', '#ffd8a0'], '#f6d49a', 'v2beach', null),
  S('b_ccsunset', 'Cotton Candy Sunset', ['#ffa8d8', '#a8c8ff'], null, 'v2cotton', 'sparkle'),
  S('bp_candyking', 'Sweet Candy Kingdom', ['#ffd0ee', '#fff2fb'], '#ffb0d8', 'v2candy', 'sparkle', 150, 'r'),
  S('bp_snowcabin', 'Snowy Cabin', ['#7a90c8', '#dce8ff'], '#ffffff', 'v2cabin', 'snow', 200, 'r'),
  S('bp_heartglow', 'Heart Sparkles', ['#ff8ac0', '#ffe0ef'], null, 'v2hearts', 'hearts', 150, 'r'),
  S('bp_bakery', 'Strawberry Bakery', ['#ffe4e8', '#fff8f0'], '#e8b890', 'v2bakery', null, 180, 'r'),
  S('bp_planets', 'Planet Parade', ['#08052a', '#2a1660'], null, 'v2planets', 'stars', 250, 'r'),
  S('bp_fairywood', 'Fairy Forest', ['#1e3a3a', '#5a8a7a'], '#2e5a40', 'v2fairy', 'sparkle', 250, 'e'),
  S('bp_lavender', 'Lavender Fields', ['#c8b8ff', '#ffe8f4'], '#9a7ad0', 'v2lavender', 'petals', 150, 'r'),
  S('bp_klstudio', 'Lone Keem Studios KL Stage', ['#1a0a3a', '#4a1a8a'], '#24104a', 'v2kl', 'sparkle', 400, 'e'),
];
export const BG = Object.fromEntries(BGS.map((b) => [b.id, b]));
const cache = new Map();
const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
function circ(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function tri(c, x, y, w, h) { c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x, y - h); c.lineTo(x + w / 2, y); c.fill(); }
// ---- ✨ cute collection: softer layered art (gradient hills, glow, rounded shapes)
const rg = (c, x, y, r, a, b2) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b2); return g; };
function cloud(c, x, y, k, col = '#ffffff') { c.fillStyle = col; for (const [dx, dy, r] of [[0, 0, 1], [0.9, 0.2, 0.75], [-0.9, 0.25, 0.7], [0.4, -0.5, 0.7], [-0.4, -0.4, 0.6]]) circ(c, x + dx * k, y + dy * k, r * k); }
function hill(c, W, y, amp, col, ph = 0) { c.fillStyle = col; c.beginPath(); c.moveTo(0, c.canvas.height); c.lineTo(0, y); for (let x = 0; x <= W; x += 8) c.lineTo(x, y - Math.sin(x / W * Math.PI * 1.6 + ph) * amp); c.lineTo(W, c.canvas.height); c.fill(); }
function heartP(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x + r * 1.6, y - r * 0.2, x + r * 0.7, y - r * 1.3, x, y - r * 0.4); c.bezierCurveTo(x - r * 0.7, y - r * 1.3, x - r * 1.6, y - r * 0.2, x, y + r * 0.9); c.fill(); }
function starS(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.fill(); }
function tree(c, x, gy, h, crown, trunk = '#9a6a4a') { c.fillStyle = trunk; c.fillRect(x - h * 0.05, gy - h * 0.55, h * 0.1, h * 0.55); for (const [dx, dy, r] of [[0, -0.7, 0.32], [-0.22, -0.55, 0.24], [0.22, -0.55, 0.24]]) { c.fillStyle = crown; circ(c, x + dx * h, gy + dy * h, r * h); } }
function scenery2(c, W, H, b) {
  const d = b.deco, gy = H * 0.78, R = rnd(b.id.length * 131 + b.id.charCodeAt(3) * 17);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const glow = (x, y, r, col) => { c.fillStyle = rg(c, x, y, r, col, 'rgba(255,255,255,0)'); c.fillRect(x - r, y - r, r * 2, r * 2); };
  if (d === 'v2pastel' || d === 'v2cotton') { glow(W * 0.78, H * 0.2, H * 0.35, 'rgba(255,250,220,.9)'); for (let i = 0; i < 6; i++) cloud(c, R() * W, H * (0.15 + R() * 0.55), H * (0.06 + R() * 0.05), d === 'v2cotton' ? ['#ffd6ee', '#e6dcff', '#fff0f8'][i % 3] : '#ffffff'); cloud(c, W * 0.2, H * 0.98, H * 0.16, '#fff'); cloud(c, W * 0.7, H * 1.0, H * 0.18, d === 'v2cotton' ? '#ffe0f2' : '#f4f8ff'); }
  if (d === 'v2moon') { glow(W * 0.78, H * 0.22, H * 0.3, 'rgba(255,240,190,.55)'); c.fillStyle = '#fff3c4'; circ(c, W * 0.78, H * 0.22, H * 0.1); c.fillStyle = b.sky[0]; circ(c, W * 0.81, H * 0.19, H * 0.09); c.fillStyle = '#fff8d8'; for (let i = 0; i < 14; i++) starS(c, R() * W, R() * H * 0.6, 1.5 + R() * 2.5); hill(c, W, gy - 4, 10, '#2a2468'); }
  if (d === 'v2sakura' || d === 'v2rbmeadow' || d === 'v2lavender') { glow(W * 0.15, H * 0.15, H * 0.3, 'rgba(255,255,230,.8)'); if (d === 'v2rbmeadow') ['#ff8a8a', '#ffc07a', '#fff08a', '#9ae08a', '#8ac8ff', '#c0a0ff'].forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.85; c.lineWidth = H * 0.04; c.beginPath(); c.arc(W / 2, gy + 6, W * 0.4 - i * H * 0.04, Math.PI, 0); c.stroke(); c.globalAlpha = 1; });
    cloud(c, W * 0.2, H * 0.25, H * 0.05); cloud(c, W * 0.8, H * 0.3, H * 0.045);
    hill(c, W, gy - 14, 12, d === 'v2lavender' ? '#b8a0e8' : '#bfe8a8', 0.5); hill(c, W, gy, 8, b.ground, 2);
    if (d === 'v2sakura') for (const x of [0.12, 0.88]) { c.fillStyle = '#8a5a4a'; c.fillRect(W * x - 4, gy - H * 0.42, 8, H * 0.42); for (let i = 0; i < 9; i++) { c.fillStyle = ['#ffc0d8', '#ffd8e8', '#ff9cc4'][i % 3]; circ(c, W * x + (R() - 0.5) * H * 0.34, gy - H * 0.42 + (R() - 0.5) * H * 0.22, H * (0.06 + R() * 0.04)); } }
    if (d === 'v2lavender') for (let r = 0; r < 4; r++) for (let i = 0; i < 16; i++) { c.fillStyle = r % 2 ? '#8a5ad0' : '#a87ae8'; const x = i * W / 15 + r * 6, y = gy + 6 + r * (H - gy) / 4; c.beginPath(); c.ellipse(x, y, 2.4, 6, 0, 0, 7); c.fill(); }
    else for (let i = 0; i < 22; i++) { c.fillStyle = ['#ffffff', '#ffd0e4', '#fff08a', '#ffb0c8'][i % 4]; circ(c, R() * W, gy + 6 + R() * (H - gy - 8), 2.6); } }
  if (d === 'v2sea') { for (let i = 0; i < 5; i++) { c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(W * (0.1 + i * 0.2), 0); c.lineTo(W * (0.18 + i * 0.2), 0); c.lineTo(W * (0.05 + i * 0.22), gy); c.lineTo(W * (0.0 + i * 0.22), gy); c.fill(); }
    hill(c, W, gy + 4, 5, b.ground); for (let i = 0; i < 7; i++) { const x = R() * W; c.strokeStyle = ['#ff8ab0', '#ffb04a', '#7ad0a0', '#c08aff'][i % 4]; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + 12, gy, x - 4, gy - H * 0.12); c.stroke(); }
    c.fillStyle = '#ffb0c8'; starS(c, W * 0.3, gy + 12, 7); c.fillStyle = '#fff0c8'; circ(c, W * 0.7, gy + 14, 5); }
  if (d === 'v2room' || d === 'v2bakery') { c.fillStyle = d === 'v2room' ? 'rgba(255,190,210,.35)' : 'rgba(255,160,170,.25)'; for (let x = 0; x < W; x += 22) c.fillRect(x, 0, 11, gy);
    c.fillStyle = '#fff'; c.fillRect(W * 0.08, H * 0.12, W * 0.26, H * 0.3); c.fillStyle = d === 'v2room' ? '#bfe3ff' : '#ffd8e0'; c.fillRect(W * 0.1, H * 0.14, W * 0.22, H * 0.26); if (d === 'v2room') { cloud(c, W * 0.2, H * 0.26, H * 0.035); c.fillStyle = '#fff6b0'; starS(c, W * 0.27, H * 0.18, 4); }
    if (d === 'v2room') { c.fillStyle = '#ffb8d0'; c.beginPath(); c.roundRect(W * 0.58, gy - H * 0.2, W * 0.38, H * 0.2, 10); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.roundRect(W * 0.6, gy - H * 0.26, W * 0.12, H * 0.08, 8); c.fill(); c.fillStyle = '#ffe48a'; circ(c, W * 0.5, H * 0.2, 6); c.fillStyle = 'rgba(255,240,180,.5)'; circ(c, W * 0.5, H * 0.2, 14); c.fillStyle = '#c8a0ff'; c.beginPath(); c.ellipse(W * 0.45, gy + (H - gy) * 0.5, W * 0.22, (H - gy) * 0.3, 0, 0, 7); c.fill(); }
    else { c.fillStyle = '#fff'; c.fillRect(0, gy - H * 0.22, W, H * 0.22); c.fillStyle = '#ff9cb8'; for (let x = 0; x < W; x += 16) { c.beginPath(); c.arc(x + 8, gy - H * 0.22, 8, 0, Math.PI); c.fill(); }
      for (let i = 0; i < 4; i++) { const x = W * (0.2 + i * 0.2), y = gy - H * 0.26; c.fillStyle = '#f0c890'; c.fillRect(x - 9, y, 18, 10); c.fillStyle = ['#ffb0c8', '#fff0f8', '#c8a0ff', '#ffe08a'][i]; circ(c, x, y, 10); c.fillStyle = '#ff4a6a'; circ(c, x, y - 9, 3); }
      c.fillStyle = '#ffe8b0'; c.beginPath(); c.roundRect(W * 0.62, H * 0.12, W * 0.3, H * 0.14, 8); c.fill(); c.fillStyle = '#3a1a1a'; c.font = `700 ${H * 0.06}px sans-serif`; c.fillText('Bakery', W * 0.655, H * 0.215); } }
  if (d === 'v2beach') { glow(W * 0.5, gy - 10, H * 0.45, 'rgba(255,230,150,.9)'); c.fillStyle = '#ffe07a'; circ(c, W * 0.5, gy - 12, H * 0.1); c.fillStyle = '#ff9a8a'; c.fillRect(0, gy - 16, W, 16); c.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 5; i++) c.fillRect(W * 0.3 + R() * W * 0.4, gy - 14 + i * 3, 20 + R() * 20, 1.5);
    hill(c, W, gy + 2, 4, b.ground); c.fillStyle = '#8a5a3a'; c.save(); c.translate(W * 0.12, gy + 4); c.rotate(-0.2); c.fillRect(-3, -H * 0.4, 6, H * 0.4); c.restore(); c.fillStyle = '#4ab070'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(W * 0.12 - H * 0.07 + Math.cos(i * 1.3) * 18, gy - H * 0.38, 18, 6, i * 1.3, 0, 7); c.fill(); } }
  if (d === 'v2candy') { hill(c, W, gy - 18, 14, '#ffd8ee'); for (let i = 0; i < 5; i++) { const x = W * (0.08 + i * 0.21); c.fillStyle = '#fff'; c.fillRect(x - 2, gy - H * 0.3, 4, H * 0.3); c.fillStyle = `hsl(${i * 70 + 300},90%,75%)`; circ(c, x, gy - H * 0.32, H * 0.075); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, gy - H * 0.32, H * 0.045, 0, 5); c.stroke(); }
    c.fillStyle = '#ffeaf6'; c.fillRect(W * 0.66, H * 0.32, W * 0.22, gy - H * 0.32); c.fillStyle = '#ff9ccf'; for (const x of [0.64, 0.84]) { c.fillRect(W * x, H * 0.24, W * 0.06, gy - H * 0.24); tri(c, W * (x + 0.03), H * 0.24, W * 0.09, H * 0.1); } }
  if (d === 'v2cabin') { c.fillStyle = '#a8b8e8'; tri(c, W * 0.25, gy, W * 0.7, H * 0.5); c.fillStyle = '#fff'; tri(c, W * 0.25, gy - H * 0.36, W * 0.2, H * 0.14); for (let i = 0; i < 4; i++) { c.fillStyle = '#3a7a5a'; tri(c, W * (0.08 + i * 0.12), gy, 22, 46); c.fillStyle = '#fff'; tri(c, W * (0.08 + i * 0.12), gy - 30, 12, 16); }
    c.fillStyle = '#9a5a3a'; c.fillRect(W * 0.6, gy - H * 0.24, W * 0.3, H * 0.24); c.fillStyle = '#fff'; tri(c, W * 0.75, gy - H * 0.24, W * 0.38, H * 0.14); c.fillStyle = '#ffd86a'; c.fillRect(W * 0.65, gy - H * 0.17, W * 0.07, H * 0.07); c.fillStyle = 'rgba(255,216,106,.3)'; circ(c, W * 0.685, gy - H * 0.135, 16); c.fillStyle = '#6a3a2a'; c.fillRect(W * 0.78, gy - H * 0.13, W * 0.06, H * 0.13); }
  if (d === 'v2hearts') { for (let i = 0; i < 14; i++) { const x = R() * W, y = R() * H, r = 4 + R() * 12; c.fillStyle = `rgba(255,${200 + R() * 55 | 0},${220 + R() * 35 | 0},${0.5 + R() * 0.4})`; heartP(c, x, y, r); } c.fillStyle = '#fff'; heartP(c, W * 0.5, H * 0.4, H * 0.12); c.fillStyle = '#ff6fae'; heartP(c, W * 0.5, H * 0.4, H * 0.1); glow(W * 0.5, H * 0.35, H * 0.3, 'rgba(255,255,255,.5)'); }
  if (d === 'v2planets') { for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.6})`; circ(c, R() * W, R() * H, R() * 1.4 + 0.4); }
    for (const [x, y, r, a, b2, ring] of [[0.18, 0.25, 0.09, '#ffb0d8', '#c060a0', 0], [0.75, 0.22, 0.13, '#ffe08a', '#e09a3a', 1], [0.5, 0.62, 0.07, '#9ae0ff', '#3a8ad0', 0], [0.88, 0.7, 0.05, '#c8a8ff', '#7a4ad0', 0]]) { c.fillStyle = rg(c, W * x - H * r * 0.4, H * y - H * r * 0.4, H * r * 1.6, a, b2); circ(c, W * x, H * y, H * r); if (ring) { c.strokeStyle = 'rgba(255,240,200,.8)'; c.lineWidth = 3; c.beginPath(); c.ellipse(W * x, H * y, H * r * 1.7, H * r * 0.45, -0.3, 0, 7); c.stroke(); } }
    c.fillStyle = '#fff'; starS(c, W * 0.32, H * 0.15, 5); }
  if (d === 'v2fairy') { for (let i = 0; i < 6; i++) tree(c, (i + 0.5) * W / 6 + (R() - 0.5) * 20, gy, H * (0.5 + R() * 0.2), i % 2 ? '#3a7a5a' : '#4a9a6a', '#5a3a2a'); hill(c, W, gy, 6, b.ground);
    for (let i = 0; i < 4; i++) { const x = W * (0.12 + i * 0.25), y = gy + 8; c.fillStyle = '#fff4e0'; c.fillRect(x - 2, y - 8, 4, 8); c.fillStyle = ['#ff6a8a', '#c88aff', '#ffb04a', '#6ad0ff'][i]; c.beginPath(); c.ellipse(x, y - 9, 8, 5, 0, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; circ(c, x - 3, y - 11, 1.2); circ(c, x + 3, y - 10, 1.2); }
    for (let i = 0; i < 12; i++) { const x = R() * W, y = R() * gy; c.fillStyle = 'rgba(255,240,150,.25)'; circ(c, x, y, 7); c.fillStyle = '#fff6a0'; circ(c, x, y, 2); } }
  if (d === 'v2kl') { for (let i = 0; i < 5; i++) { c.fillStyle = `rgba(255,207,58,${0.05 + i * 0.015})`; c.beginPath(); c.moveTo(W * (0.1 + i * 0.2), 0); c.lineTo(W * 0.5 - 40 + i * 20, gy); c.lineTo(W * 0.5 - 20 + i * 20, gy); c.fill(); }
    const lx = W * 0.19, ly = H * 0.25; glow(lx, ly, H * 0.28, 'rgba(255,207,58,.35)'); c.fillStyle = '#ffcf3a'; circ(c, lx, ly, H * 0.14); c.fillStyle = '#4a1a8a'; circ(c, lx, ly, H * 0.118);
    c.fillStyle = '#ffd84a'; c.font = `900 ${H * 0.15}px Arial Black, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 ${H * 0.13}px Arial Black, Arial, sans-serif`; c.fillText('KL', lx, ly + 1); c.font = `700 ${H * 0.045}px sans-serif`; c.fillStyle = '#fff3c4'; c.fillText('LONE KEEM', lx, ly + H * 0.2); c.fillText('STUDIOS', lx, ly + H * 0.255); c.textAlign = 'start'; c.textBaseline = 'alphabetic';
    c.fillStyle = '#ffcf3a'; c.fillRect(0, gy - 4, W, 4); for (let i = 0; i < 8; i++) starS(c, R() * W, R() * H * 0.25 + 6, 2 + R() * 2); }
  if (b.ground && !['v2sakura', 'v2rbmeadow', 'v2lavender', 'v2sea', 'v2beach', 'v2fairy'].includes(d)) { c.fillStyle = b.ground; c.fillRect(0, gy, W, H - gy); if (d === 'v2room' || d === 'v2bakery') { c.fillStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x < W; x += 24) c.fillRect(x, gy, 2, H - gy); } }
  if (d === 'v2room') { c.fillStyle = '#c8a0ff'; c.beginPath(); c.ellipse(W * 0.45, gy + (H - gy) * 0.5, W * 0.22, (H - gy) * 0.3, 0, 0, 7); c.fill(); }
}
function scenery(c, W, H, b) {
  if (b.deco && b.deco.startsWith('v2')) return scenery2(c, W, H, b);
  const gy = H * 0.78, R = rnd(b.id.length * 7919 + b.id.charCodeAt(2) * 31); const d = b.deco;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, b.sky[0]); g.addColorStop(1, b.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
  const A = (col, f) => { c.fillStyle = col; f(); };
  if (d === 'planets' || d === 'galaxy' || d === 'moonbase') { A('#ffd34d', () => circ(c, W * 0.8, H * 0.22, H * 0.1)); A('#ff8ab8', () => circ(c, W * 0.15, H * 0.3, H * 0.06)); c.strokeStyle = '#ffe8a0'; c.lineWidth = 2; c.beginPath(); c.ellipse(W * 0.8, H * 0.22, H * 0.17, H * 0.04, -0.3, 0, 7); c.stroke(); }
  if (d === 'galaxy') { for (let i = 0; i < 160; i++) { const a = i * 0.25, r = i * 0.6 * H / 120; c.fillStyle = `hsla(${280 + i},90%,75%,.5)`; circ(c, W / 2 + Math.cos(a) * r * 1.6, H * 0.4 + Math.sin(a) * r * 0.6, 1.6); } }
  if (d === 'aurora') for (let k = 0; k < 3; k++) { c.fillStyle = `hsla(${140 + k * 40},90%,60%,.22)`; c.beginPath(); c.moveTo(0, H * 0.2 + k * 12); for (let x = 0; x <= W; x += 10) c.lineTo(x, H * 0.25 + k * 14 + Math.sin(x / 30 + k) * 14); c.lineTo(W, H * 0.55); c.lineTo(0, H * 0.55); c.fill(); }
  if (d === 'moon' || d === 'moonbase') A('#fff6d0', () => circ(c, W * 0.2, H * 0.2, H * 0.08));
  if (d === 'mountains' || d === 'volcano') { A(d === 'volcano' ? '#5a2a2a' : '#7a8ab8', () => { tri(c, W * 0.25, gy, W * 0.6, H * 0.55); tri(c, W * 0.72, gy, W * 0.7, H * 0.65); }); if (d === 'mountains') A('#fff', () => { tri(c, W * 0.72, gy - H * 0.47, W * 0.17, H * 0.18); tri(c, W * 0.25, gy - H * 0.4, W * 0.14, H * 0.15); }); else A('#ff6a2a', () => tri(c, W * 0.72, gy - H * 0.52, W * 0.14, H * 0.13)); }
  if (d === 'hills' || d === 'farm' || d === 'park' || d === 'flowers' || d === 'rainbow' || d === 'garden') { A(b.ground, () => { c.beginPath(); c.ellipse(W * 0.2, gy, W * 0.5, H * 0.18, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(W * 0.85, gy, W * 0.5, H * 0.14, 0, 0, 7); c.fill(); }); }
  if (d === 'rainbow' || d === 'candy') ['#ff6a7a', '#ffb34a', '#ffe64a', '#6ad870', '#4aa8ff', '#9a6aff'].forEach((col, i) => { c.strokeStyle = col; c.lineWidth = H * 0.035; c.beginPath(); c.arc(W / 2, gy, W * 0.42 - i * H * 0.035, Math.PI, 0); c.stroke(); });
  if (d === 'clouds' || d === 'cloudcastle' || d === 'park' || d === 'beach' || d === 'farm' || d === 'school') A('rgba(255,255,255,.9)', () => { for (let i = 0; i < 4; i++) { const x = R() * W, y = H * (0.1 + R() * 0.3); circ(c, x, y, H * 0.06); circ(c, x + H * 0.07, y + 3, H * 0.05); circ(c, x - H * 0.07, y + 4, H * 0.045); } });
  if (d === 'clouds' || d === 'cloudcastle') A('#fff', () => { for (let i = 0; i < 8; i++) circ(c, i * W / 7, H * 0.95, H * 0.16); });
  if (d === 'castle' || d === 'cloudcastle' || d === 'palace') { const col = d === 'palace' ? '#ffd34d' : '#e8d0ff'; A(col, () => { c.fillRect(W * 0.62, H * 0.35, W * 0.26, gy - H * 0.35); for (const x of [0.6, 0.86]) c.fillRect(W * x, H * 0.25, W * 0.06, gy - H * 0.25); }); A(d === 'palace' ? '#ff9a3a' : '#ff8ab8', () => { for (const x of [0.63, 0.89]) tri(c, W * x, H * 0.25, W * 0.09, H * 0.12); }); }
  if (d === 'trees' || d === 'jungle' || d === 'garden' || d === 'park') for (let i = 0; i < (d === 'park' ? 2 : 6); i++) { const x = (i + 0.5) * W / (d === 'park' ? 2 : 6) + (R() - 0.5) * 20; A('#8a5a3a', () => c.fillRect(x - 4, gy - H * 0.25, 8, H * 0.25)); A(d === 'jungle' ? '#2a8a4a' : '#3aa050', () => circ(c, x, gy - H * 0.3, H * 0.12)); }
  if (d === 'pines' || d === 'giftree') for (let i = 0; i < 5; i++) { const x = (i + 0.5) * W / 5; A('#2a7a4a', () => { tri(c, x, gy, H * 0.18, H * 0.32); }); if (d === 'giftree') A(['#ff4a5a', '#ffd34d', '#4aa8ff'][i % 3], () => c.fillRect(x - 8, gy - 10, 16, 12)); }
  if (d === 'dunes') A('#e8b060', () => { c.beginPath(); c.ellipse(W * 0.3, gy, W * 0.5, H * 0.12, 0, 0, 7); c.fill(); });
  if (d === 'sea' || d === 'reef') for (let i = 0; i < 7; i++) { const x = R() * W; c.strokeStyle = d === 'reef' ? `hsl(${i * 50},80%,65%)` : '#2a9a6a'; c.lineWidth = 5; c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + 14, H * 0.8, x, H * 0.62); c.stroke(); }
  if (d === 'beach') A('#3ab0e8', () => c.fillRect(0, gy - H * 0.1, W, H * 0.1));
  if (d === 'city' || d === 'moonbase') for (let i = 0; i < 9; i++) { const w = W / 9, h = H * (0.2 + R() * 0.35); A(d === 'city' ? '#241a4a' : '#5a5a7a', () => c.fillRect(i * w, gy - h, w - 3, h)); A('#ffe68a', () => { for (let k = 0; k < 6; k++) if (R() > 0.5) c.fillRect(i * w + 4 + (k % 2) * (w / 2 - 2), gy - h + 6 + Math.floor(k / 2) * 12, 4, 5); }); }
  if (d === 'stage' || d === 'disco') { A('#3a1a6a', () => c.fillRect(0, gy - 6, W, 10)); if (d === 'disco') { A('#d8d8f0', () => circ(c, W / 2, H * 0.14, H * 0.07)); } }
  if (d === 'studio') { A('rgba(255,255,255,.08)', () => { for (let i = 0; i < 6; i++) c.fillRect(i * W / 6 + 6, 0, W / 12, H); }); A('#ffd34d', () => { c.font = `700 ${H * 0.09}px sans-serif`; c.fillText('★', W * 0.08, H * 0.2); c.fillText('★', W * 0.84, H * 0.3); }); }
  if (d === 'bedroom' || d === 'library' || d === 'kitchen' || d === 'school' || d === 'gaming') {
    if (d === 'bedroom') { A('#ffffff', () => c.fillRect(W * 0.08, H * 0.15, W * 0.22, H * 0.25)); A('#8ad0ff', () => c.fillRect(W * 0.1, H * 0.17, W * 0.18, H * 0.21)); A('#ff9ccf', () => c.fillRect(W * 0.6, gy - H * 0.16, W * 0.34, H * 0.16)); }
    if (d === 'library') for (let s = 0; s < 3; s++) for (let i = 0; i < 14; i++) A(`hsl(${i * 37},60%,55%)`, () => c.fillRect(W * 0.05 + i * W * 0.064, H * (0.12 + s * 0.2), W * 0.05, H * 0.16));
    if (d === 'kitchen') { A('#fff', () => c.fillRect(0, gy - H * 0.2, W, H * 0.2)); A('#ff9ccf', () => { for (let i = 0; i < 5; i++) circ(c, W * (0.12 + i * 0.19), gy - H * 0.24, H * 0.04); }); }
    if (d === 'school') { A('#2a5a3a', () => c.fillRect(W * 0.2, H * 0.12, W * 0.6, H * 0.32)); A('#fff', () => { c.font = `600 ${H * 0.07}px sans-serif`; c.fillText('A B C  1 2 3', W * 0.26, H * 0.3); }); }
    if (d === 'gaming') { A('#4aa8ff', () => c.fillRect(W * 0.3, H * 0.12, W * 0.4, H * 0.28)); A('#ff4fd8', () => c.fillRect(0, gy - 3, W, 3)); }
  }
  if (d === 'pumpkins') for (let i = 0; i < 4; i++) A('#ff8a2a', () => { c.beginPath(); c.ellipse(W * (0.12 + i * 0.25), gy + 8, H * 0.07, H * 0.05, 0, 0, 7); c.fill(); });
  if (d === 'candy') for (let i = 0; i < 4; i++) { const x = W * (0.1 + i * 0.27); A('#fff', () => c.fillRect(x - 2, gy - H * 0.25, 4, H * 0.25)); A(`hsl(${i * 80},90%,70%)`, () => circ(c, x, gy - H * 0.27, H * 0.07)); }
  if (d === 'flowers' || d === 'meadow' || d === 'garden' || d === 'blossom') for (let i = 0; i < 18; i++) A(`hsl(${R() * 360},90%,75%)`, () => circ(c, R() * W, d === 'blossom' ? H * (0.1 + R() * 0.4) : gy + R() * (H - gy), d === 'blossom' ? 5 : 3.5));
  if (d === 'crystals') for (let i = 0; i < 7; i++) A(`hsla(${260 + i * 15},90%,70%,.85)`, () => tri(c, R() * W, gy + 4, 16, H * (0.15 + R() * 0.2)));
  if (d === 'farm') { A('#d84a3a', () => c.fillRect(W * 0.7, gy - H * 0.28, W * 0.2, H * 0.28)); A('#8a2a2a', () => tri(c, W * 0.8, gy - H * 0.28, W * 0.24, H * 0.12)); }
  if (d === 'boba') { A('#ffffff', () => c.fillRect(0, gy - H * 0.22, W, H * 0.22)); for (let i = 0; i < 4; i++) { const x = W * (0.14 + i * 0.24); A(['#f0c8a0', '#c8a0ff', '#ffb3cf', '#a8e8c0'][i], () => c.fillRect(x - 12, gy - H * 0.38, 24, H * 0.16)); A('#3a2a2a', () => { for (let k = 0; k < 4; k++) circ(c, x - 6 + k * 4, gy - H * 0.24, 2.5); }); A('#ff6fae', () => c.fillRect(x + 4, gy - H * 0.48, 3, H * 0.12)); } }
  if (d === 'kawaii') { c.font = `700 ${H * 0.08}px sans-serif`; for (let i = 0; i < 9; i++) { c.fillStyle = ['#ffe680', '#ffffff', '#ff9ccf'][i % 3]; c.fillText(i % 2 ? '★' : '♥', R() * W * 0.9, H * (0.1 + R() * 0.8)); } }
  if (d === 'icecream') { A('#7ad0ff', () => c.fillRect(0, gy - H * 0.08, W, H * 0.08)); for (let i = 0; i < 3; i++) { const x = W * (0.15 + i * 0.35); A('#e0a060', () => tri(c, x, gy + H * 0.02, -0.0001, 0)); A('#e0a060', () => { c.beginPath(); c.moveTo(x - 14, gy - H * 0.22); c.lineTo(x + 14, gy - H * 0.22); c.lineTo(x, gy); c.fill(); }); A(['#ffb3cf', '#c8f0d0', '#fff0c0'][i], () => circ(c, x, gy - H * 0.26, 16)); } }
  if (b.ground) { A(b.ground, () => c.fillRect(0, gy, W, H - gy)); }
  if (d === 'books' || d === 'kitchen' || d === 'bedroom') A('rgba(0,0,0,.08)', () => { for (let x = 0; x < W; x += 24) c.fillRect(x, gy, 2, H - gy); });
}
export function drawBg(c, W, H, id, t = 0) {
  const b = BG[id]; if (!b) return false;
  const k = id + W + 'x' + H; let cv = cache.get(k);
  if (!cv) { cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const q = cv.getContext('2d'); q.scale(2, 2); scenery(q, W, H, b); cache.set(k, cv); if (cache.size > 30) cache.delete(cache.keys().next().value); }
  c.save(); c.beginPath(); c.roundRect(0, 0, W, H, 18); c.clip(); c.drawImage(cv, 0, 0, W, H);
  const fx = b.fx; const R = rnd(7);
  if (fx) for (let i = 0; i < 26; i++) { const x0 = R() * W, y0 = R() * H, sp = 0.3 + R() * 0.7, ph = R() * 6;
    if (fx === 'stars' || fx === 'twinkle' || fx === 'sparkle') { c.fillStyle = `rgba(255,${fx === 'sparkle' ? 236 : 255},${fx === 'sparkle' ? 160 : 255},${0.4 + 0.5 * Math.abs(Math.sin(t * 0.04 * sp + ph))})`; circ(c, x0, fx === 'twinkle' ? y0 * 0.6 : y0, fx === 'sparkle' ? 1.8 : 1.3); }
    else if (fx === 'snow' || fx === 'petals' || fx === 'leaves' || fx === 'confetti' || fx === 'falling' || fx === 'hearts' || fx === 'embers') {
      const dir = fx === 'embers' ? -1 : 1; const y = ((y0 + dir * t * sp * 0.6) % H + H) % H, x = x0 + Math.sin(t * 0.02 + ph) * 8;
      c.fillStyle = fx === 'snow' ? 'rgba(255,255,255,.9)' : fx === 'petals' ? '#ffc6e0' : fx === 'leaves' ? '#7ad070' : fx === 'embers' ? '#ffb04a' : fx === 'hearts' ? '#ff6fae' : fx === 'falling' ? '#ffe68a' : `hsl(${i * 47},90%,62%)`;
      if (fx === 'confetti') c.fillRect(x, y, 4, 6); else if (fx === 'hearts') { c.font = '10px sans-serif'; c.fillText('♥', x, y); } else if (fx === 'falling') { c.fillRect(x, y, 1.5, 6); circ(c, x + 0.7, y + 6, 2); } else circ(c, x, y, fx === 'snow' ? 2 : 2.4); }
    else if (fx === 'bubbles') { const y = ((y0 - t * sp * 0.5) % H + H) % H; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x0 + Math.sin(t * 0.03 + ph) * 5, y, 3 + sp * 4, 0, 7); c.stroke(); }
    else if (fx === 'lights' && i < 6) { c.fillStyle = `hsla(${(i * 60 + t) % 360},90%,65%,.18)`; const x = W * (i + 0.5) / 6; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + Math.sin(t * 0.02 + i) * W * 0.25 - 30, H); c.lineTo(x + Math.sin(t * 0.02 + i) * W * 0.25 + 30, H); c.fill(); } }
  c.restore(); return true;
}
