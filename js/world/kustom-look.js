// 🔧 Kemy Kustoms: the look of a customized car (paint + finishes + two-tone, wheels + tires, body parts, truck parts,
// lights, neon underglow, decals + wraps, interior, horn). Small and always loaded (the garage UI lazy-loads from kustoms.js).
// Original art only, made in code. No textures and no real lights: every light is an emissive or additive material,
// all materials and part geometries are shared + cached and only their colours/values change, so applying a look or
// animating a light never compiles a new shader mid-play (see b79799c).
// Sync: v1 = 4 base36 chars (the original 8 parts, still written when a look only uses them, so older app versions match).
// v2 = 'q' + base36 of a mixed-radix number with FIXED caps per part (append-only; caps leave room for new options).
// Presence dn: '~c'+car(3) [+'o'+rider8] then 'k'+v1 or 'q'+v2 (only if it fits the 20-char rule; else v1 fallback).
// Home garages: '.k'+v1 (closest old look, for older apps) and '.q'+v2. Written by Lone Keem.
import * as THREE from '../vendor/three-0.170.0.module.min.js';

// ---------------------------------------------------------------- catalog
// cost: none = free basic, p = Star Coins, d = Diamonds (inventory ids: letters/_ only, z_ = diamonds). fit: 't' trucks only, 'c' cars only
const PA = (n, hex, p = 120) => ({ n, hex, id: 'kk_pa_' + n.toLowerCase().replace(/[^a-z]/g, '').slice(0, 10), p });
export const KK = {
  paint: [ // 0 = keep the car's normal colour pick (the 12 free presets)
    { n: 'Preset colour', hex: null }, { n: 'Candy Apple', hex: '#c3102b', id: 'kk_pa_candy', p: 120 }, { n: 'Mint Fizz', hex: '#7ff0c8', id: 'kk_pa_mint', p: 120 },
    { n: 'Sunset', hex: '#ff6a3d', id: 'kk_pa_sunset', p: 120 }, { n: 'Rose Gold', hex: '#e8a598', id: 'kk_pa_rose', p: 120 }, { n: 'Midnight', hex: '#1e2a78', id: 'kk_pa_night', p: 120 },
    PA('Lava', '#ff3b1f'), PA('Tangerine', '#ff8c1a'), PA('Lemon', '#ffe14d'), PA('Lime Pop', '#a3e635'), PA('Jungle', '#15803d'), PA('Aqua', '#22d3ee'),
    PA('Cobalt', '#1d4ed8'), PA('Royal Purple', '#6d28d9'), PA('Lavender', '#c4b5fd'), PA('Hot Pink', '#ff3fa4'), PA('Coral', '#ff7f6e'), PA('Peach', '#ffc6a8'),
    PA('Sand', '#d9c49a'), PA('Chocolate', '#6b3e26'), PA('Forest', '#264d3b'), PA('Steel', '#8a99a8'), PA('Pearl White', '#f4f1ea'), PA('Jet Black', '#0b0b10'),
    PA('Silver', '#c9ccd3'), PA('Gold Rush', '#d4a017', 160), PA('Bronze', '#a0632b'), PA('Ruby', '#9b111e'), PA('Electric', '#00a3ff'), PA('Ice', '#dff6ff')],
  metal: [{ n: 'Gloss' }, { n: 'Metallic', id: 'kk_metal', p: 200 }, { n: 'Matte', id: 'kk_fin_matte', p: 250 }, { n: 'Pearl', id: 'kk_fin_pearl', p: 300 }, { n: 'Chrome', id: 'z_kk_fin_chrome', d: 90 },
    { n: 'Shift: Galaxy', id: 'z_kk_fin_galaxy', d: 120, shift: ['#5b21b6', '#1d4ed8', '#0e7490'] }, { n: 'Shift: Sunset', id: 'z_kk_fin_sunset', d: 120, shift: ['#ff6a3d', '#e11d48', '#a21caf'] }, { n: 'Shift: Ocean', id: 'z_kk_fin_ocean', d: 120, shift: ['#0ea5e9', '#14b8a6', '#4f46e5'] }],
  two: [{ n: 'None' }, ...[['White Top', '#f8fafc'], ['Black Top', '#111318'], ['Silver Top', '#c9ccd3'], ['Cream Top', '#f3e7c9'], ['Red Top', '#d61f3a'], ['Blue Top', '#2563eb'], ['Gold Top', '#d4a017'],
    ['Mint Top', '#7ff0c8'], ['Purple Top', '#7c3aed'], ['Orange Top', '#ff8c1a'], ['Pink Top', '#ff5fb0']].map(([n, hex]) => ({ n, hex, id: 'kk_two_' + n.split(' ')[0].toLowerCase(), p: 200 }))],
  rim: [{ n: 'Stock' }, { n: 'Star Spokes', id: 'kk_rim_star', p: 250 }, { n: 'Turbine', id: 'kk_rim_fan', p: 300 }, { n: 'Gold Mesh', id: 'z_kk_rim_gold', d: 80 }, { n: 'Neon Ring', id: 'kk_rim_neon', p: 400 }, { n: 'Steelie' },
    { n: 'Split Five', id: 'kk_rim_split', p: 300 }, { n: 'Deep Dish', id: 'kk_rim_dish', p: 350 }, { n: 'Beadlock', id: 'kk_rim_bead', p: 350 }, { n: 'Wire', id: 'kk_rim_wire', p: 400 }, { n: 'Blade', id: 'kk_rim_blade', p: 400 }, { n: 'Black Star', id: 'z_kk_rim_bstar', d: 70 }],
  tires: [{ n: 'Stock' }, { n: 'Low-Profile', id: 'kk_ti_low', p: 200, fit: 'c' }, { n: 'Whitewall', id: 'kk_ti_white', p: 200 }, { n: 'All-Terrain', id: 'kk_ti_at', p: 250, fit: 't' }, { n: 'Mud Tires', id: 'kk_ti_mud', p: 350, fit: 't' }, { n: 'Monster Tires', id: 'z_kk_ti_monster', d: 100, fit: 't' }],
  kit: [{ n: 'Stock' }, { n: 'Side Skirts', id: 'kk_kit_skirt', p: 250, fit: 'c' }, { n: 'Front Splitter', id: 'kk_kit_split', p: 250, fit: 'c' }, { n: 'Wide Arches', id: 'kk_kit_wide', p: 350, fit: 'c' }, { n: 'Full Race Kit', id: 'z_kk_kit_race', d: 110, fit: 'c' }],
  hood: [{ n: 'Stock' }, { n: 'Scoop', id: 'kk_hd_scoop', p: 200 }, { n: 'Twin Scoop', id: 'kk_hd_twin', p: 250 }, { n: 'Vents', id: 'kk_hd_vent', p: 200 }, { n: 'Blower', id: 'z_kk_hd_blower', d: 90 }],
  spoiler: [{ n: 'Stock' }, { n: 'Lip' }, { n: 'Ducktail', id: 'kk_sp_duck', p: 200, fit: 'c' }, { n: 'Race Wing', id: 'kk_sp_wing', p: 450, fit: 'c' }, { n: 'Twin Wing', id: 'z_kk_sp_twin', d: 120, fit: 'c' },
    { n: 'Swan Neck', id: 'kk_sp_swan', p: 500, fit: 'c' }, { n: 'Rally Wing', id: 'kk_sp_rally', p: 400, fit: 'c' }, { n: 'Roof Lip', id: 'kk_sp_roof', p: 200 }],
  exhaust: [{ n: 'Stock' }, { n: 'Twin Tips', id: 'kk_ex_twin', p: 150 }, { n: 'Quad Tips', id: 'kk_ex_quad', p: 250 }, { n: 'Big Single', id: 'kk_ex_big', p: 200 }, { n: 'Side Pipes', id: 'kk_ex_side', p: 350 }, { n: 'Chrome Stacks', id: 'kk_ex_stack', p: 400, fit: 't' }],
  rack: [{ n: 'None' }, { n: 'Roof Rack', id: 'kk_rk_rack', p: 200 }, { n: 'Cargo Box', id: 'kk_rk_box', p: 250 }],
  lift: [{ n: 'Stock height', fit: 't' }, { n: 'Lift 2"', id: 'kk_lift_two', p: 200, fit: 't' }, { n: 'Lift 4"', id: 'kk_lift_four', p: 350, fit: 't' }, { n: 'Lift 6"', id: 'z_kk_lift_six', d: 90, fit: 't' }],
  bull: [{ n: 'None', fit: 't' }, { n: 'Bull Bar', id: 'kk_bull_bar', p: 300, fit: 't' }, { n: 'Push Bar', id: 'kk_bull_push', p: 250, fit: 't' }],
  roof: [{ n: 'None', fit: 't' }, { n: 'LED Light Bar', id: 'kk_rf_bar', p: 350, fit: 't' }, { n: 'Four Pods', id: 'kk_rf_pods', p: 300, fit: 't' }, { n: 'Cab Markers', id: 'kk_rf_mark', p: 150, fit: 't' }, { n: 'Bar + Pods', id: 'z_kk_rf_both', d: 100, fit: 't' }],
  head: [{ n: 'Stock' }, { n: 'Round', id: 'kk_hl_round', p: 150 }, { n: 'Square', id: 'kk_hl_square', p: 150 }, { n: 'Angel Eye Halo', id: 'kk_hl_halo', p: 400 }, { n: 'LED Strip', id: 'kk_hl_led', p: 350 }, { n: 'Pop-up', id: 'z_kk_hl_popup', d: 80, fit: 'c' }],
  hcol: [{ n: 'White', hex: '#ffffff' }, { n: 'Warm', hex: '#ffd89a', id: 'kk_hc_warm', p: 100 }, { n: 'Ice Blue', hex: '#a5e8ff', id: 'kk_hc_ice', p: 200 }, { n: 'Yellow', hex: '#ffe14d', id: 'kk_hc_yellow', p: 150 }, { n: 'Purple', hex: '#c9a5ff', id: 'kk_hc_purple', p: 250 }],
  tail: [{ n: 'Stock' }, { n: 'Full Light Bar', id: 'kk_tl_bar', p: 300 }, { n: 'Round Twin', id: 'kk_tl_round', p: 200 }, { n: 'Slim LED', id: 'kk_tl_slim', p: 250 }, { n: 'Triple Pods', id: 'kk_tl_pods', p: 250 }],
  fog: [{ n: 'Off' }, { n: 'White Fog', hex: '#f8fafc', id: 'kk_fog_white', p: 150 }, { n: 'Yellow Fog', hex: '#ffd23f', id: 'kk_fog_yellow', p: 150 }],
  show: [{ n: 'Off' }, { n: 'Light Show', id: 'z_kk_show', d: 120 }],
  glow: [{ n: 'Off' }, { n: 'Purple', hex: '#a855f7', id: 'kk_ug_purple', p: 350 }, { n: 'Blue', hex: '#38bdf8', id: 'kk_ug_blue', p: 350 }, { n: 'Green', hex: '#4ade80', id: 'kk_ug_green', p: 350 }, { n: 'Pink', hex: '#f472b6', id: 'kk_ug_pink', p: 350 }, { n: 'Rainbow', hex: '#ff4d6d', id: 'z_kk_ug_rainbow', d: 150 },
    { n: 'Orange', hex: '#fb923c', id: 'kk_ug_orange', p: 350 }, { n: 'White', hex: '#f1f5f9', id: 'kk_ug_white', p: 350 }, { n: 'Yellow', hex: '#facc15', id: 'kk_ug_yellow', p: 350 }, { n: 'Teal', hex: '#2dd4bf', id: 'kk_ug_teal', p: 350 }, { n: 'Ice', hex: '#bae6fd', id: 'kk_ug_ice', p: 350 }, { n: 'Lime', hex: '#a3e635', id: 'kk_ug_lime', p: 350 }],
  gmode: [{ n: 'Solid' }, { n: 'Pulse', id: 'kk_gm_pulse', p: 200 }, { n: 'Rainbow Cycle', id: 'z_kk_gm_cycle', d: 80 }, { n: 'Color Wave', id: 'kk_gm_wave', p: 300 }],
  decal: [{ n: 'None' }, { n: 'Racing Stripes' }, { n: 'Side Stripe', id: 'kk_dc_side', p: 150 }, { n: 'Lightning', id: 'kk_dc_bolt', p: 300 }, { n: 'Stars', id: 'kk_dc_star', p: 300 }, { n: 'Flames', id: 'z_kk_dc_flame', d: 100 },
    { n: 'Checkers', id: 'kk_dc_check', p: 250 }, { n: 'Waves', id: 'kk_dc_wave', p: 250 }, { n: 'Hearts', id: 'kk_dc_heart', p: 250 }, { n: 'Race Number', id: 'kk_dc_num', p: 200 }, { n: 'Paw Prints', id: 'kk_dc_paw', p: 250 }, { n: 'Zigzag', id: 'kk_dc_zig', p: 200 }],
  wrap: [{ n: 'None' }, { n: 'Carbon Hood', id: 'kk_wr_carbon', p: 300 }, { n: 'Camo', id: 'kk_wr_camo', p: 350 }, { n: 'Galaxy', id: 'z_kk_wr_galaxy', d: 110 }, { n: 'Candy Stripes', id: 'kk_wr_candy', p: 300 },
    { n: 'Bold Bands', id: 'kk_wr_bands', p: 300 }, { n: 'Pixel Blocks', id: 'kk_wr_pixel', p: 350 }, { n: 'Sunset Fade', id: 'kk_wr_fade', p: 350 }],
  tint: [{ n: 'Stock' }, { n: 'Light', c: '#3a4f66', o: 0.3 }, { n: 'Dark', c: '#06080d', o: 0.8, id: 'kk_tn_dark', p: 150 }, { n: 'Purple', c: '#3b1a5c', o: 0.64, id: 'kk_tn_purple', p: 200 },
    { n: 'Ice Blue', c: '#1e5a7a', o: 0.5, id: 'kk_tn_ice', p: 200 }, { n: 'Rose', c: '#6b2140', o: 0.55, id: 'kk_tn_rose', p: 200 }, { n: 'Smoke Silver', c: '#4b5563', o: 0.6, id: 'kk_tn_smoke', p: 150 }],
  inter: [{ n: 'Stock' }, ...[['Red', '#b91c1c'], ['Tan', '#c8a26b'], ['White', '#e5e7eb'], ['Blue', '#1e40af'], ['Purple', '#6d28d9'], ['Mint', '#5eead4'], ['Orange', '#ea580c']].map(([n, hex]) => ({ n: n + ' Seats', hex, id: 'kk_in_' + n.toLowerCase(), p: 150 }))],
  horn: [{ n: 'Classic' }, { n: 'Beep Beep' }, { n: 'Duck Quack', id: 'kk_hn_duck', p: 100 }, { n: 'Melody', id: 'kk_hn_tune', p: 200 }, { n: 'Big Truck', id: 'kk_hn_truck', p: 200 }, { n: 'Space Zap', id: 'z_kk_hn_space', d: 60 },
    { n: 'Bike Bell', id: 'kk_hn_bell', p: 100 }, { n: 'Robot Beep', id: 'kk_hn_robot', p: 150 }, { n: 'Kazoo', id: 'kk_hn_kazoo', p: 150 }, { n: 'Cuckoo', id: 'kk_hn_cuckoo', p: 150 }, { n: 'Choo Choo', id: 'kk_hn_choo', p: 200 }, { n: 'Rising Scale', id: 'kk_hn_scale', p: 200 }],
};
// code order + FIXED caps (never change; append new parts at the end with their own cap)
export const KK_CAPS = [['paint', 36], ['metal', 8], ['rim', 12], ['spoiler', 8], ['decal', 12], ['glow', 12], ['tint', 8], ['horn', 12], ['head', 8], ['hcol', 8], ['tail', 8], ['gmode', 6], ['fog', 4], ['roof', 6],
  ['kit', 6], ['hood', 6], ['exhaust', 6], ['two', 12], ['wrap', 8], ['tires', 6], ['lift', 4], ['bull', 4], ['rack', 4], ['inter', 8], ['show', 2]];
export const KK_KEYS = KK_CAPS.map(([k]) => k);
const V1 = [['paint', 6], ['metal', 2], ['rim', 6], ['spoiler', 5], ['decal', 6], ['glow', 6], ['tint', 4], ['horn', 6]];
export const KK_ITEMS = KK_KEYS.flatMap((k) => KK[k].filter((o) => o.id).map((o) => ({ ...o, part: k })));
export const blankLook = () => Object.fromEntries(KK_KEYS.map((k) => [k, 0]));
export const fits = (o, truck) => !o || !o.fit || (o.fit === 't') === !!truck;
export async function registerKustomItems() { const cat = await import('../pals/catalog.js');
  cat.addItems(KK_ITEMS.filter((o) => o.p).map((o) => ({ id: o.id, name: '🔧 ' + o.n, kind: 'kustom', p: o.p, r: 'r' })));
  cat.addDiamondItems(KK_ITEMS.filter((o) => o.d).map((o) => ({ id: o.id, name: '🔧 ' + o.n, kind: 'kustom', d: o.d }))); }

// ---------------------------------------------------------------- codes
const b36 = (n) => n.toString(36);
const clampI = (v, n) => { v = v | 0; return v >= 0 && v < n ? v : 0; };
export function normLook(l) { const o = blankLook(); if (l) for (const k of KK_KEYS) o[k] = clampI(l[k], KK[k].length); return o; }
const isV1 = (o) => KK_KEYS.every((k) => { const v = V1.find(([x]) => x === k); return v ? o[k] < v[1] : !o[k]; });
function v1Code(o) { return b36(o.paint * 2 + o.metal) + b36(o.rim * 6 + o.spoiler) + b36(o.decal * 6 + o.glow) + b36(o.tint * 6 + o.horn); }
// closest look an older app can show (parts it doesn't know drop to stock)
export function lookV1(l) { const o = normLook(l); const c = {}; for (const [k, n] of V1) c[k] = o[k] < n ? o[k] : 0; if (o.metal >= 2) c.metal = 1; if (o.glow >= 6) c.glow = 2; const s = v1Code(c); return s === '0000' ? '' : s; }
export function lookCode(l) { const o = normLook(l); if (KK_KEYS.every((k) => !o[k])) return ''; if (isV1(o)) return v1Code(o);
  let n = 0n; for (let i = KK_CAPS.length - 1; i >= 0; i--) { const [k, cap] = KK_CAPS[i]; n = n * BigInt(cap) + BigInt(o[k]); } return 'q' + n.toString(36).padStart(4, '0'); } // v2 codes are always 5+ chars, never confused with 4-char v1
export function parseLook(s) { s = String(s || '');
  if (/^[0-9a-z]{4}$/.test(s)) { const v = [...s].map((c) => parseInt(c, 36)); return normLook({ paint: v[0] >> 1, metal: v[0] & 1, rim: Math.floor(v[1] / 6), spoiler: v[1] % 6, decal: Math.floor(v[2] / 6), glow: v[2] % 6, tint: Math.floor(v[3] / 6), horn: v[3] % 6 }); }
  if (!/^q[0-9a-z]{4,16}$/.test(s)) return blankLook();
  let n = 0n; for (const ch of s.slice(1)) n = n * 36n + BigInt(parseInt(ch, 36)); const o = {}; for (const [k, cap] of KK_CAPS) { o[k] = Number(n % BigInt(cap)); n /= BigInt(cap); } return normLook(o); }
// presence dn suffix for a look, given how many chars are left under the 20-char rule
export function lookDn(l, room) { const c = lookCode(l); if (!c) return ''; if (c[0] !== 'q') return 'k' + c; if (c.length <= room) return c; const v = lookV1(l); return v ? 'k' + v : ''; }
// presence dn: '~c' + car(3) [+ 'o' + rider8] [+ 'k' + code4 | 'q' + code]
export function dnLook(dn) { if (!dn || dn.slice(0, 2) !== '~c') return ''; const o = dn[2] === 'z' ? 1 : 0; for (const i of [5 + o, 14 + o]) { if (dn[i] === 'k') { const c = dn.slice(i + 1, i + 5); if (/^[0-9a-z]{4}$/.test(c)) return c; } if (dn[i] === 'q' && /^q[0-9a-z]{1,16}$/.test(dn.slice(i))) return dn.slice(i); } return ''; }
// which priced items a look needs (to check ownership before saving)
export function lookNeeds(l, truck) { const o = normLook(l); return KK_KEYS.map((k) => KK[k][o[k]]).filter((x) => x && x.id && (truck === undefined || fits(x, truck))); }

// ---------------------------------------------------------------- shared materials (values only; same programs as the car's own)
const MAT = new Map(); const mat = (k, f) => { if (!MAT.has(k)) MAT.set(k, f()); return MAT.get(k); };
// every paint finish keeps clearcoat on (like the stock paint) so they all share one shader program
const FIN = [{ metalness: 0.55, roughness: 0.28, clearcoatRoughness: 0.06, envMapIntensity: 1.25 }, { metalness: 0.95, roughness: 0.17, clearcoatRoughness: 0.03, envMapIntensity: 1.6 },
  { metalness: 0.15, roughness: 0.85, clearcoatRoughness: 1, envMapIntensity: 0.6 }, { metalness: 0.6, roughness: 0.22, clearcoatRoughness: 0.02, envMapIntensity: 1.8 }, { metalness: 1, roughness: 0.05, clearcoatRoughness: 0.02, envMapIntensity: 2.2 }];
const paintFor = (hex, f) => mat('kp' + hex + f, () => { const fi = FIN[f] || FIN[0]; const c = new THREE.Color(hex); if (f === 3) c.lerp(new THREE.Color('#ffffff'), 0.22); if (f === 4) c.lerp(new THREE.Color('#ffffff'), 0.45);
  return new THREE.MeshPhysicalMaterial({ color: c, clearcoat: 1, ...fi }); });
const ANIM = []; // { m, kind, ... } animated in tickKustoms (colour/opacity/intensity only)
const anim = (k, f, a) => mat(k, () => { const m = f(); ANIM.push({ m, ...a }); return m; });
const shiftMat = (i) => anim('ks' + i, () => new THREE.MeshPhysicalMaterial({ color: KK.metal[i].shift[0], clearcoat: 1, ...FIN[1] }), { kind: 'shift', pal: KK.metal[i].shift.map((h) => new THREE.Color(h)) });
const flat = (hex, o = {}) => mat('kf' + hex + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.45, metalness: o.m ?? 0.1, envMapIntensity: o.e ?? 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
const solid = (hex, o = {}) => mat('kz' + hex + JSON.stringify(o), () => new THREE.MeshStandardMaterial({ color: hex, roughness: o.r ?? 0.45, metalness: o.m ?? 0.1, envMapIntensity: o.e ?? 1 }));
const glowStd = (hex, i = 2.5) => mat('kg' + hex + i, () => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i, roughness: 0.3 }));
const glowFloor = (hex, op) => mat('ku' + hex + op, () => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
const tintMat = (glass, t) => mat('kt' + t.c + t.o, () => { const m = glass.clone(); m.color.set(t.c); m.opacity = t.o; return m; });
const seatMat = (seat, hex) => mat('ki' + hex, () => { const m = seat.clone(); m.color.set(hex); return m; });
const headMat = (head, hex) => mat('kh' + hex, () => { const m = head.clone(); m.color.set(hex); if (m.emissive) m.emissive.set(hex); return m; });
// animated neon: one shared material per (colour, mode, layer); modes never alternate sides (non-emergency on purpose)
const FLOOR = (hex, op) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending });
const BAR = (hex) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 2.5, roughness: 0.3 });
function neon(hex, mode, layer) { const op = layer === 0 ? 0.6 : 0.24; const make = layer === 2 ? () => BAR(hex) : () => FLOOR(hex, op);
  if (!mode) return layer === 2 ? glowStd(hex) : glowFloor(hex, op);
  const kind = ['', 'pulse', 'cycle', 'wave', 'show'][mode]; const key = mode === 2 || mode === 4 ? 'kn' + kind + layer : 'kn' + kind + hex + layer;
  return anim(key, make, { kind, layer, op, base: new THREE.Color(hex), hsl: new THREE.Color(hex).getHSL({}) }); }
// light-show accents (halo rings, LED strips, roof bars): slow synced breathing + colour chase, all together on every light
const showMat = (hex) => anim('kw' + hex, () => BAR(hex), { kind: 'breathe', base: new THREE.Color(hex) });
const _c = new THREE.Color();
export function tickKustoms(now) { if (!ANIM.length) return; const t = now / 1000;
  for (const a of ANIM) { const m = a.m;
    if (a.kind === 'shift') { const p = a.pal, u = (t / 4) % p.length, i = Math.floor(u); _c.copy(p[i]).lerp(p[(i + 1) % p.length], u - i); m.color.copy(_c); }
    else if (a.kind === 'pulse') { const k = 0.55 + 0.45 * Math.sin(t * 2.4); if (a.layer === 2) m.emissiveIntensity = 0.8 + 2 * k; else m.opacity = a.op * (0.35 + 0.65 * k); }
    else if (a.kind === 'cycle' || a.kind === 'show') { m.color.setHSL((t / (a.kind === 'show' ? 5 : 2.6) + a.layer * 0.08) % 1, 1, 0.6); if (a.emissive || m.emissive) m.emissive.copy(m.color);
      if (a.kind === 'show' && a.layer !== 2) m.opacity = a.op * (0.6 + 0.4 * Math.sin(t * 1.6)); }
    else if (a.kind === 'wave') { const h = a.hsl; m.color.setHSL((h.h + 0.09 * Math.sin(t * 1.3 + a.layer)) % 1, h.s, h.l); if (m.emissive) m.emissive.copy(m.color); }
    else if (a.kind === 'breathe') { m.emissiveIntensity = 1.2 + 1.3 * (0.5 + 0.5 * Math.sin(t * 1.6)); m.color.setHSL((t / 6) % 1, 0.9, 0.62); m.emissive.copy(m.color); } } }

// ---------------------------------------------------------------- cached part geometry
const GEO = new Map(); const geo = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
const box = (x, y, z) => geo(`b${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (r, h, n = 20) => geo(`c${r.toFixed(3)}|${h.toFixed(3)}|${n}`, () => new THREE.CylinderGeometry(r, r, h, n));
const tor = (R, t, n = 20, arc = Math.PI * 2) => geo(`t${R.toFixed(3)}|${t.toFixed(3)}|${n}|${arc.toFixed(2)}`, () => new THREE.TorusGeometry(R, t, 6, n, arc));
const RIMS = new Map();
function rimTemplate(style, r, w, chrome, trim) { const k = style + '|' + r.toFixed(3) + '|' + w.toFixed(3); if (RIMS.has(k)) return RIMS.get(k);
  const g = new THREE.Group(); const add = (gm, m, f) => { const o = new THREE.Mesh(gm, m); if (f) f(o); g.add(o); return o; }; const axle = (o) => { o.rotation.z = Math.PI / 2; };
  const gold = flat('#f5c542', { m: 1, r: 0.2, e: 1.5 }); const blk = solid('#16161c', { m: 0.6, r: 0.35 });
  const spokes = (n, m, wd, len, off = 0, tw = 0) => { for (let i = 0; i < n; i++) add(box(w * wd, r * len, r * 0.12), m, (o) => { const a = i / n * Math.PI * 2 + off; o.rotation.set(a, 0, tw); o.position.set(0, Math.cos(a) * r * len * 0.5, Math.sin(a) * r * len * 0.5); }); };
  if (style === 1) { add(cyl(r * 0.66, w * 0.8), trim, axle); for (let i = 0; i < 5; i++) add(box(w * 0.24, r * 0.6, r * 0.2), chrome, (o) => { const a = i / 5 * Math.PI * 2; o.rotation.x = a; o.position.set(0, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); }); add(cyl(r * 0.18, w * 1.04, 12), chrome, axle); }
  else if (style === 2) { add(cyl(r * 0.66, w * 0.84), chrome, axle); for (let i = 0; i < 10; i++) add(box(w * 0.9, r * 0.56, r * 0.06), trim, (o) => { const a = i / 10 * Math.PI * 2; o.rotation.set(a, 0, 0.5); o.position.set(0, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36); }); add(cyl(r * 0.2, w * 1.04, 12), chrome, axle); }
  else if (style === 3) { add(cyl(r * 0.66, w * 0.82), trim, axle); for (let i = 0; i < 8; i++) for (const t of [-0.35, 0.35]) add(box(w * 0.9, r * 1.24, r * 0.05), gold, (o) => { o.rotation.x = i / 8 * Math.PI + t; }); add(cyl(r * 0.67, w * 0.5), gold, (o) => { axle(o); o.scale.set(1, 0.4, 1); }); add(cyl(r * 0.16, w * 1.04, 12), gold, axle); }
  else if (style === 4) { add(cyl(r * 0.66, w * 0.84), trim, axle); const tg = geo('tr' + r.toFixed(3), () => new THREE.TorusGeometry(r * 0.56, r * 0.05, 8, 28));
    for (const sx of [-1, 1]) add(tg, glowStd('#22d3ee'), (o) => { o.rotation.y = Math.PI / 2; o.position.x = sx * w * 0.4; }); for (let i = 0; i < 6; i++) add(box(w * 0.92, r * 1.0, r * 0.08), chrome, (o) => { o.rotation.x = i / 6 * Math.PI; }); add(cyl(r * 0.16, w * 1.04, 12), chrome, axle); }
  else if (style === 5) { add(cyl(r * 0.64, w * 0.84), flat('#f1f5f9', { m: 0.4, r: 0.35 }), axle); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(cyl(r * 0.08, w * 0.88, 10), trim, (o) => { axle(o); o.position.set(0, Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); }); } add(cyl(r * 0.2, w * 1.0, 12), chrome, axle); }
  else if (style === 6) { add(cyl(r * 0.66, w * 0.8), trim, axle); for (const off of [-0.13, 0.13]) spokes(5, chrome, 0.9, 1.2, off); add(cyl(r * 0.17, w * 1.04, 12), chrome, axle); }
  else if (style === 7) { add(cyl(r * 0.66, w * 0.86), chrome, axle); add(cyl(r * 0.5, w * 0.92), trim, axle); spokes(5, chrome, 0.95, 0.9); add(cyl(r * 0.15, w * 1.04, 12), chrome, axle); }
  else if (style === 8) { add(cyl(r * 0.66, w * 0.84), blk, axle); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; add(cyl(r * 0.05, w * 0.92, 6), chrome, (o) => { axle(o); o.position.set(0, Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56); }); } spokes(6, trim, 0.9, 0.8); add(cyl(r * 0.2, w * 1.02, 12), chrome, axle); }
  else if (style === 9) { add(cyl(r * 0.66, w * 0.6), trim, axle); for (let i = 0; i < 18; i++) add(box(w * 0.86, r * 1.28, r * 0.025), chrome, (o) => { o.rotation.set(i / 18 * Math.PI, 0, (i % 2 ? 1 : -1) * 0.35); }); add(cyl(r * 0.22, w * 1.04, 12), chrome, axle); }
  else if (style === 10) { add(cyl(r * 0.66, w * 0.82), trim, axle); for (let i = 0; i < 3; i++) add(box(w * 0.9, r * 0.62, r * 0.3), chrome, (o) => { const a = i / 3 * Math.PI * 2; o.rotation.set(a + 0.5, 0, 0); o.position.set(0, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); }); add(cyl(r * 0.16, w * 1.04, 12), chrome, axle); }
  else if (style === 11) { add(cyl(r * 0.66, w * 0.8), blk, axle); for (let i = 0; i < 5; i++) add(box(w * 0.26, r * 0.62, r * 0.22), trim, (o) => { const a = i / 5 * Math.PI * 2; o.rotation.x = a; o.position.set(0, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); }); add(cyl(r * 0.16, w * 1.04, 12), gold, axle); }
  g.userData.kk = 1; RIMS.set(k, g); return g; }

// ---------------------------------------------------------------- surface probe (once per car model, cached): top height along the length
const PROBE = new Map(); const rc = new THREE.Raycaster(); const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(0, -1, 0);
function probeTop(car) { const c = car.userData.def; const key = c.id + (car.userData.lite ? 'l' : ''); if (PROBE.has(key)) return PROBE.get(key);
  const ch = car.userData.chassis; const paint = car.userData.paint, glass = car.userData.cab;
  const hits = ch.children.filter((m) => m.isMesh && (m.material === paint || m === glass) && m.geometry.type !== 'TorusGeometry' && m.geometry.type !== 'ConeGeometry' && m.geometry.type !== 'SphereGeometry' && !m.userData.roof).map((m) => { const o = new THREE.Mesh(m.geometry); o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale); o.userData.glass = m === glass; o.updateMatrixWorld(true); return o; });
  const N = 44, out = []; for (const x of [0, 0.16]) { const row = []; for (let i = 0; i <= N; i++) { const z = -c.L / 2 + (c.L * i) / N; v0.set(x, c.H + 3, z); rc.set(v0, v1); const h = rc.intersectObjects(hits, false)[0]; row.push(h ? { y: h.point.y, glass: h.object.userData.glass, z } : null); } out.push(row); }
  PROBE.set(key, out); return out; }
const topAt = (car, z) => { const P = probeTop(car)[0]; let best = null; for (const p of P) if (p && (!best || Math.abs(p.z - z) < Math.abs(best.z - z))) best = p; return best ? best.y : car.userData.def.H * 0.6; };

// ---------------------------------------------------------------- side art (decals + wraps): flat shapes on the doors, no textures
function shapeGeo(pts) { const s = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))); return new THREE.ShapeGeometry(s); }
const star = (u, v, R) => (L, B) => starPts(u * L, v * B, R * B);
const dot = (u, v, R, n = 14) => (L, B) => Array.from({ length: n }, (_, i) => [u * L + Math.cos(i / n * Math.PI * 2) * R * B, v * B + Math.sin(i / n * Math.PI * 2) * R * B]);
const paw = (u, v) => [[dot(u, v, 0.11, 12), 'a'], ...[-1, 0, 1].map((d) => [(L, B) => dot(0, 0, 0.045, 8)(L, B).map(([x, y]) => [x + u * L + d * 0.12 * B, y + (v + 0.17 + (d ? 0 : 0.03)) * B]), 'a'])];
function starPts(cx, cy, R) { const p = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? R * 0.45 : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
const rect = (u0, v0, u1, v1) => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
const heart = (u, v, R) => (L, B) => Array.from({ length: 20 }, (_, i) => { const t = i / 20 * Math.PI * 2; return [u * L + R * B * Math.sin(t) ** 3, v * B + R * B * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16]; });
const SIDE = { // u: 0 = front end of the band -> 1 = rear end, v: 0..1 band height; [polygon, colour]
  2: [[rect(0, 0.52, 1, 0.72), 'a'], [rect(0.04, 0.8, 0.96, 0.87), 'a']],
  3: [[[[0, 0.62], [0.45, 0.9], [0.42, 0.66], [1, 0.74], [0.55, 0.28], [0.58, 0.52]], '#fde047']],
  4: [[star(0.2, 0.55, 0.42), '#fde047'], [star(0.5, 0.6, 0.31), 'a'], [star(0.78, 0.52, 0.22), '#fde047']],
  5: [[[[0, 0.12], [0.62, 0.18], [0.36, 0.3], [0.86, 0.42], [0.5, 0.5], [1, 0.62], [0.46, 0.68], [0.72, 0.84], [0, 0.9]], '#fb923c'], [[[0, 0.28], [0.4, 0.3], [0.24, 0.4], [0.58, 0.48], [0.3, 0.55], [0.64, 0.63], [0.28, 0.7], [0, 0.74]], '#fde047', 0.004]],
  6: Array.from({ length: 12 }, (_, i) => { const cx = i % 6, cy = Math.floor(i / 6); return [rect(0.55 + cx * 0.075, 0.3 + cy * 0.25, 0.625 + cx * 0.075, 0.55 + cy * 0.25), (cx + cy) % 2 ? '#111318' : '#f8fafc']; }),
  7: [[[...Array.from({ length: 13 }, (_, i) => [i / 12, 0.45 + 0.12 * Math.sin(i / 12 * Math.PI * 4)]), [1, 0.25], [0, 0.25]], '#38bdf8'], [[...Array.from({ length: 13 }, (_, i) => [i / 12, 0.62 + 0.1 * Math.sin(i / 12 * Math.PI * 4 + 1)]), [1, 0.52], [0, 0.52]], '#e0f2fe', 0.004]],
  8: [[heart(0.25, 0.55, 0.34), '#ff5fb0'], [heart(0.52, 0.6, 0.26), '#f472b6'], [heart(0.76, 0.5, 0.2), '#ff5fb0']],
  9: [[dot(0.5, 0.52, 0.42, 22), '#f8fafc'], [(L, B) => [[-0.13, 0.26], [0.14, 0.26], [0.02, -0.28], [-0.07, -0.28], [0.03, 0.17], [-0.13, 0.17]].map(([x, y]) => [0.5 * L + x * B, 0.52 * B + y * B]), '#111318', 0.004]],
  10: [[0.2, 0.3], [0.36, 0.5], [0.52, 0.28], [0.68, 0.48], [0.84, 0.3]].flatMap(([u, v]) => paw(u, v)),
  11: [[[[0, 0.4], [0.12, 0.7], [0.25, 0.4], [0.37, 0.7], [0.5, 0.4], [0.62, 0.7], [0.75, 0.4], [0.87, 0.7], [1, 0.4], [1, 0.52], [0.87, 0.82], [0.75, 0.52], [0.62, 0.82], [0.5, 0.52], [0.37, 0.82], [0.25, 0.52], [0.12, 0.82], [0, 0.52]], '#a3e635']],
};
const WRAP = {
  2: [[rect(0, 0, 1, 1), '#4d5d3a'], [[[0.05, 0.2], [0.25, 0.1], [0.32, 0.45], [0.12, 0.6]], '#2f3b24', 0.003], [[[0.4, 0.5], [0.62, 0.35], [0.7, 0.8], [0.48, 0.9]], '#7a6a45', 0.003], [[[0.72, 0.1], [0.95, 0.2], [0.9, 0.55], [0.75, 0.45]], '#2f3b24', 0.003], [[[0.2, 0.7], [0.35, 0.65], [0.38, 0.95], [0.18, 0.92]], '#7a6a45', 0.003]],
  3: [[rect(0, 0, 1, 1), '#1e1b4b'], [[[0, 0.3], [1, 0.6], [1, 0.75], [0, 0.45]], '#6d28d9', 0.003], ...[[0.1, 0.8], [0.3, 0.2], [0.45, 0.85], [0.6, 0.3], [0.8, 0.75], [0.92, 0.2]].map(([u, v]) => [star(u, v, 0.09), '#f8fafc', 0.005])],
  4: Array.from({ length: 7 }, (_, i) => [[[i / 7, 0], [i / 7 + 0.07, 0], [i / 7 + 0.17, 1], [i / 7 + 0.1, 1]], i % 2 ? '#f8fafc' : '#ff5fb0']),
  5: [[rect(0.12, 0, 0.24, 1), '#111318'], [rect(0.3, 0, 0.36, 1), '#111318'], [rect(0.7, 0, 0.82, 1), '#f8fafc']],
  6: Array.from({ length: 24 }, (_, i) => [rect((i % 8) / 8 + 0.01, Math.floor(i / 8) / 3 + 0.02, (i % 8) / 8 + 0.115, Math.floor(i / 8) / 3 + 0.3), ['#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a855f7'][(i * 7) % 5]]),
  7: [[rect(0, 0, 1, 0.34), '#7c3aed'], [rect(0, 0.33, 1, 0.67), '#ec4899'], [rect(0, 0.66, 1, 1), '#fb923c']],
};
function sideSet(car, spec, tag, light, g) { const c = car.userData.def, U = car.userData, r = c.wr, W = c.Wd; const k = U.kk || {};
  const axF = k.axF ?? c.L * 0.33, axR = k.axR ?? -c.L * 0.32; const zf = axF - r * 1.3, zr = axR + r * 1.3, len = Math.max(0.4, zf - zr); const yb = r * 1.02 + (k.truck && c.style !== 'truck' ? 0.1 : 0), bh = Math.max(0.2, Math.min(0.42, (k.bedY || c.H * 0.45) - yb - 0.04));
  const ac = light ? '#1f2937' : '#f8fafc';
  for (const s of [1, -1]) spec.forEach(([pts, ck, lift], i) => { const key = `ds${tag}|${i}|${len.toFixed(2)}|${bh.toFixed(2)}|${s}`;
      const gm = geo(key, () => { const P = typeof pts === 'function' ? pts(len, bh) : pts.map(([u, v]) => [u * len, v * bh]); const sg = shapeGeo(P.map(([u, v]) => [s < 0 ? -u : u, v]));
        if (s < 0) { const ix = sg.index.array; for (let j = 0; j < ix.length; j += 3) { const t = ix[j]; ix[j] = ix[j + 1]; ix[j + 1] = t; } } return sg; });
      const m = new THREE.Mesh(gm, flat(ck === 'a' ? ac : ck)); m.rotation.y = s * Math.PI / 2; m.position.set(s * (W / 2 + 0.036 + (lift || 0) + (tag[0] === 'd' ? 0.006 : 0)), yb, zf); g.add(m); }); }
function topBand(car, x0, x1, zFrom, zTo, hex, key, g) { const gm = geo(key + (car.userData.lite ? 'l' : ''), () => { const P = probeTop(car); const pos = []; const row = P[Math.abs((x0 + x1) / 2) > 0.08 ? 1 : 0];
    for (let i = 0; i < row.length - 1; i++) { const a = row[i], b = row[i + 1]; if (!a || !b || a.glass || b.glass || Math.abs(a.y - b.y) > 0.22 || a.z < zFrom || b.z > zTo) continue;
      const ya = a.y + 0.012, yb = b.y + 0.012; pos.push(x0, ya, a.z, x1, yb, b.z, x1, ya, a.z, x0, ya, a.z, x0, yb, b.z, x1, yb, b.z); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.computeVertexNormals(); return gg; });
  g.add(new THREE.Mesh(gm, flat(hex))); }
function decalGroup(car, style, light) { const c = car.userData.def; const g = new THREE.Group(); g.userData.kk = 1;
  if (style === 1) { for (const xs of [-0.17, 0.17]) topBand(car, xs - 0.07, xs + 0.07, -99, 99, light ? '#1f2937' : '#f8fafc', 'st' + c.id + xs, g); return g; }
  if (SIDE[style]) sideSet(car, SIDE[style], 'd' + style, light, g); return g; }
function wrapGroup(car, style) { const c = car.userData.def, W = c.Wd; const g = new THREE.Group(); g.userData.kk = 1; if (!style) return g;
  if (style === 1) { const zc = (car.userData.kk && car.userData.kk.cabF) || c.L * 0.1; topBand(car, -W * 0.36, W * 0.36, zc + 0.05, 99, '#1c1d22', 'wc' + c.id, g); return g; }
  if (style === 5) { topBand(car, -W * 0.12, W * 0.12, -99, 99, '#111318', 'wb' + c.id, g); }
  if (WRAP[style]) sideSet(car, WRAP[style], 'w' + style, false, g); return g; }

// ---------------------------------------------------------------- spoilers
function spoilerGroup(car, style, paint, trim) { const c = car.userData.def, W = c.Wd, k = car.userData.kk || {}; const g = new THREE.Group(); g.userData.kk = 1; if (!style) return g;
  const P = probeTop(car)[0]; let yT = c.H * 0.6; for (let i = 0; i < 6; i++) if (P[i] && !P[i].glass) { yT = P[i].y; break; } const zB = -c.L / 2;
  const add = (gm, m, f) => { const o = new THREE.Mesh(gm, m); f(o); o.castShadow = !car.userData.lite; g.add(o); return o; };
  if (style === 1) add(box(W * 0.78, 0.04, 0.16), paint, (o) => { o.position.set(0, yT + 0.03, zB + 0.12); o.rotation.x = 0.3; });
  else if (style === 2) add(box(W * 0.86, 0.06, 0.32), paint, (o) => { o.position.set(0, yT + 0.06, zB + 0.18); o.rotation.x = 0.38; });
  else if (style === 3 || style === 4) { const h = style === 4 ? 0.42 : 0.32; add(box(W * 0.94, 0.05, 0.38), paint, (o) => { o.position.set(0, yT + h, zB + 0.22); o.rotation.x = 0.1; });
    for (const s of [-1, 1]) { add(box(0.05, h, 0.14), trim, (o) => { o.position.set(s * W * 0.3, yT + h / 2, zB + 0.26); }); add(box(0.03, 0.2, 0.42), trim, (o) => { o.position.set(s * W * 0.47, yT + h, zB + 0.22); }); }
    if (style === 4) { add(box(W * 0.9, 0.04, 0.3), paint, (o) => { o.position.set(0, yT + h - 0.17, zB + 0.24); o.rotation.x = 0.14; }); add(box(W * 0.9, 0.02, 0.03), glowStd('#c084fc'), (o) => { o.position.set(0, yT + h + 0.03, zB + 0.03); }); } }
  else if (style === 5) { const h = 0.4; add(box(W * 0.96, 0.05, 0.4), trim, (o) => { o.position.set(0, yT + h, zB + 0.24); o.rotation.x = 0.12; });
    for (const s of [-1, 1]) { add(box(0.04, 0.12, 0.12), trim, (o) => o.position.set(s * W * 0.28, yT + 0.06, zB + 0.34)); add(box(0.04, h, 0.06), trim, (o) => { o.position.set(s * W * 0.28, yT + h * 0.62, zB + 0.28); o.rotation.x = -0.5; }); add(box(0.03, 0.22, 0.44), paint, (o) => o.position.set(s * W * 0.48, yT + h, zB + 0.24)); } }
  else if (style === 6) { const y = (k.roofY || c.H) + 0.02, z = (k.cabB ?? zB + 1) + 0.15; add(box(W * 0.84, 0.05, 0.3), paint, (o) => { o.position.set(0, y + 0.12, z - 0.05); o.rotation.x = 0.15; }); for (const s of [-1, 1]) add(box(0.04, 0.14, 0.18), trim, (o) => o.position.set(s * W * 0.3, y + 0.05, z)); }
  else if (style === 7) { const y = (k.roofY || c.H) - 0.02; let z = zB + 1; const P0 = probeTop(car)[0]; for (const p of P0) if (p && p.y > y - 0.25) { z = p.z; break; } add(box(W * 0.62, 0.04, 0.24), paint, (o) => { o.position.set(0, y + 0.03, z - 0.06); o.rotation.x = 0.22; }); }
  return g; }

// ---------------------------------------------------------------- underglow (flat additive planes + two glow bars; no lights added)
function glowGroup(car, hex, mode) { const c = car.userData.def; const g = new THREE.Group(); g.userData.kk = 1;
  const pl = geo('ugp', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)); const lift = (car.userData.kk && car.userData.kk.truck) ? 0.02 : 0;
  const a = new THREE.Mesh(pl, neon(hex, mode, 0)); a.scale.set(c.Wd * 0.92, 1, c.L * 0.86); a.position.y = -0.03; a.renderOrder = 1; g.add(a);
  const b = new THREE.Mesh(pl, neon(hex, mode, 1)); b.scale.set(c.Wd * 1.5, 1, c.L * 1.12); b.position.y = -0.035; b.renderOrder = 1; g.add(b);
  for (const s of [-1, 1]) { const o = new THREE.Mesh(box(0.03, 0.03, c.L * 0.5), neon(hex, mode, 2)); o.position.set(s * (c.Wd / 2 - 0.1), c.wr * 0.42 + lift, 0); g.add(o); }
  g.userData.floor = [a, b]; return g; }

// ---------------------------------------------------------------- lights + body + truck parts
function roofSpan(car) { const k = car.userData.kk || {}; const y = k.roofY || car.userData.def.H; const P = probeTop(car)[0].filter((p) => p && p.y > y - 0.09); if (!P.length) return [k.cabB ?? -0.5, k.cabF ?? 0.5];
  return [Math.min(...P.map((p) => p.z)), Math.max(...P.map((p) => p.z))]; }
function partsGroup(car, l, M, pm, hm, TR) { const c = car.userData.def, U = car.userData, k = U.kk || {}, W = c.Wd, r = c.wr; const g = new THREE.Group(); g.userData.kk = 1; const tails = [];
  const add = (gm, m, f) => { const o = new THREE.Mesh(gm, m); if (f) f(o); g.add(o); return o; }; const fwd = (o) => { o.rotation.x = Math.PI / 2; };
  const by = k.by ?? c.H * 0.4, hz = k.hz ?? c.L / 2, fz = k.fz ?? c.L / 2, rz = k.rz ?? c.L / 2, ty = k.ty ?? c.H * 0.45, bumpY = k.bumpY ?? r * 0.75, roofY = k.roofY ?? c.H, hx = W * 0.33;
  const hcol = KK.hcol[l.hcol].hex; const acc = (hex) => (l.show ? showMat('x') : glowStd(hex)); const chrome = M.chrome(), trim = M.trim();
  // headlights
  if (l.head) for (const s of [-1, 1]) { const x = s * hx;
    if (l.head === 1 || l.head === 3) { const R = l.head === 3 ? 0.1 : 0.12; add(cyl(R, 0.08, 16), hm, (o) => { fwd(o); o.position.set(x, by, fz - 0.03); }); add(tor(R + 0.015, 0.018, 18), chrome, (o) => o.position.set(x, by, fz + 0.005));
      if (l.head === 3) add(tor(R + 0.05, 0.02, 22), acc(hcol), (o) => o.position.set(x, by, fz + 0.012)); }
    else if (l.head === 2) { add(box(0.3, 0.16, 0.08), hm, (o) => o.position.set(x, by, fz - 0.03)); add(box(0.34, 0.2, 0.05), trim, (o) => o.position.set(x, by, fz - 0.06)); }
    else if (l.head === 4) { add(box(W * 0.26, 0.05, 0.07), hm, (o) => o.position.set(s * W * 0.3, by + 0.02, fz - 0.02)); add(box(W * 0.26, 0.022, 0.06), acc(hcol), (o) => o.position.set(s * W * 0.3, by - 0.05, fz - 0.02)); }
    else if (l.head === 5) { add(box(W * 0.24, 0.13, 0.3), pm, (o) => { o.position.set(x, by + 0.12, hz - 0.1); o.rotation.x = -0.15; }); add(box(W * 0.2, 0.08, 0.03), hm, (o) => o.position.set(x, by + 0.13, hz + 0.06)); } }
  if (l.head === 4) add(box(W * 0.2, 0.022, 0.05), acc(hcol), (o) => o.position.set(0, by - 0.05, fz - 0.02));
  if (l.fog) for (const s of [-1, 1]) add(cyl(0.055, 0.06, 12), glowStd(KK.fog[l.fog].hex, 1.8), (o) => { fwd(o); o.position.set(s * W * 0.3, bumpY + 0.13, fz + 0.01); });
  // tail lights (registered as the car's brake lights)
  const tl = (gm, f) => { const o = add(gm, M.tail(), f); o.userData.tail = 1; tails.push(o); }; const tz = -rz - 0.01;
  if (l.tail === 1) tl(box(W * 0.86, 0.07, 0.05), (o) => o.position.set(0, ty, tz));
  for (const s of [-1, 1]) { if (l.tail === 2) for (const xx of [0.22, 0.36]) tl(cyl(0.065, 0.05, 14), (o) => { fwd(o); o.position.set(s * W * xx, ty, tz); });
    if (l.tail === 3) tl(box(W * 0.3, 0.035, 0.05), (o) => o.position.set(s * W * 0.3, ty + 0.02, tz));
    if (l.tail === 4) for (const xx of [0.2, 0.29, 0.38]) tl(box(0.08, 0.08, 0.05), (o) => o.position.set(s * W * xx, ty, tz)); }
  // roof lights (trucks): static, never flashing or alternating
  const [rz0, rz1] = roofSpan(car); const rfz = rz1 - 0.12;
  if (l.roof === 1 || l.roof === 4) { add(box(W * 0.66, 0.08, 0.1), acc('#fff7cc'), (o) => o.position.set(0, roofY + 0.09, rfz)); add(box(W * 0.68, 0.1, 0.1), trim, (o) => o.position.set(0, roofY + 0.09, rfz - 0.07)); for (const s of [-1, 1]) add(box(0.04, 0.1, 0.08), trim, (o) => o.position.set(s * W * 0.3, roofY + 0.03, rfz - 0.05)); }
  if (l.roof === 2) for (const xx of [-0.3, -0.1, 0.1, 0.3]) { add(cyl(0.075, 0.07, 14), acc('#fff7cc'), (o) => { fwd(o); o.position.set(xx * W, roofY + 0.12, rfz); }); add(box(0.04, 0.1, 0.04), trim, (o) => o.position.set(xx * W, roofY + 0.04, rfz - 0.03)); }
  if (l.roof === 4) for (const s of [-1, 1]) add(cyl(0.075, 0.07, 14), acc('#fff7cc'), (o) => { fwd(o); o.position.set(s * W * 0.22, bumpY + 0.2, fz + 0.1); });
  if (l.roof === 3) for (const xx of [-0.3, -0.15, 0, 0.15, 0.3]) add(box(0.09, 0.05, 0.06), glowStd('#ffb020', 1.6), (o) => o.position.set(xx * W, roofY + 0.025, rfz + 0.04));
  // body kit (cars)
  const axF = k.axF ?? c.L * 0.33, axR = k.axR ?? -c.L * 0.32; const span = axF - axR - r * 2.3;
  if (l.kit === 1 || l.kit === 4) for (const s of [-1, 1]) add(box(0.08, 0.14, span), pm, (o) => o.position.set(s * (W / 2 + 0.01), r * 0.42, (axF + axR) / 2));
  if (l.kit === 2 || l.kit === 4) { add(box(W * 0.96, 0.035, 0.24), trim, (o) => o.position.set(0, Math.max(0.1, bumpY - 0.16), fz - 0.06)); for (const s of [-1, 1]) add(box(0.03, 0.08, 0.2), trim, (o) => o.position.set(s * W * 0.47, Math.max(0.1, bumpY - 0.13), fz - 0.06)); }
  if (l.kit === 3 || l.kit === 4) for (const z of [axF, axR]) for (const s of [-1, 1]) add(tor(r * 1.18, r * 0.2, 18, Math.PI), pm, (o) => { o.rotation.y = Math.PI / 2; o.position.set(s * (W / 2 + 0.06), r, z); o.scale.set(1, 1, 1.5); });
  if (l.kit === 4) { add(box(W * 0.7, 0.08, 0.24), trim, (o) => o.position.set(0, Math.max(0.12, bumpY - 0.1), -rz + 0.08)); for (const xx of [-0.2, 0, 0.2]) add(box(0.02, 0.12, 0.22), trim, (o) => o.position.set(xx * W, Math.max(0.14, bumpY - 0.06), -rz + 0.08)); }
  // hood
  if (l.hood) { const z = (k.cabF ?? 0) + (fz - (k.cabF ?? 0)) * 0.45, y = topAt(car, z);
    if (l.hood === 1) { add(box(W * 0.3, 0.12, 0.6), pm, (o) => o.position.set(0, y + 0.04, z)); add(box(W * 0.26, 0.07, 0.03), trim, (o) => o.position.set(0, y + 0.06, z + 0.3)); }
    if (l.hood === 2) for (const s of [-1, 1]) { add(box(W * 0.16, 0.1, 0.5), pm, (o) => o.position.set(s * W * 0.15, y + 0.03, z)); add(box(W * 0.13, 0.06, 0.03), trim, (o) => o.position.set(s * W * 0.15, y + 0.05, z + 0.25)); }
    if (l.hood === 3) for (const s of [-1, 1]) for (let i = 0; i < 3; i++) add(box(W * 0.2, 0.025, 0.05), trim, (o) => o.position.set(s * W * 0.18, topAt(car, z - 0.15 + i * 0.13) + 0.012, z - 0.15 + i * 0.13));
    if (l.hood === 4) { add(box(0.42, 0.2, 0.34), chrome, (o) => o.position.set(0, y + 0.1, z)); add(box(0.36, 0.16, 0.24), trim, (o) => o.position.set(0, y + 0.28, z + 0.02)); for (const s of [-1, 1]) add(cyl(0.05, 0.12, 10), chrome, (o) => o.position.set(s * 0.12, y + 0.24, z - 0.12)); } }
  // exhaust
  const ey = Math.max(0.14, bumpY - 0.1), tip = (x, R) => add(cyl(R, 0.24, 12), chrome, (o) => { fwd(o); o.position.set(x, ey, -rz - 0.04); });
  if (l.exhaust === 1) for (const s of [-1, 1]) tip(s * W * 0.3, 0.05);
  if (l.exhaust === 2) for (const s of [-1, 1]) for (const xx of [0.26, 0.35]) tip(s * W * xx, 0.045);
  if (l.exhaust === 3) tip(W * 0.3, 0.1);
  if (l.exhaust === 4) for (const s of [-1, 1]) add(cyl(0.06, span + r * 0.6, 12), chrome, (o) => { fwd(o); o.position.set(s * (W / 2 + 0.08), r * 0.42, (axF + axR) / 2); });
  if (l.exhaust === 5) { const y0 = k.bedY ?? c.H * 0.55, h = roofY - y0 + 0.5; for (const s of [-1, 1]) add(cyl(0.07, h, 12), chrome, (o) => o.position.set(s * (W / 2 - 0.08), y0 + h / 2, (k.cabB ?? -0.5) - 0.06)); }
  // roof rack / cargo box
  if (l.rack) { const len = Math.max(0.5, (rz1 - rz0) * 0.85), zc = (rz0 + rz1) / 2 - (l.roof ? 0.1 : 0), y = roofY + 0.05;
    for (const s of [-1, 1]) { add(box(0.04, 0.04, len), trim, (o) => o.position.set(s * W * 0.32, y + 0.02, zc)); add(box(0.04, 0.06, 0.04), trim, (o) => o.position.set(s * W * 0.32, y - 0.01, zc + len * 0.4)); add(box(0.04, 0.06, 0.04), trim, (o) => o.position.set(s * W * 0.32, y - 0.01, zc - len * 0.4)); }
    if (l.rack === 1) for (let i = -1; i <= 1; i++) add(box(W * 0.66, 0.03, 0.04), trim, (o) => o.position.set(0, y + 0.05, zc + i * len * 0.35));
    else add(box(W * 0.5, 0.2, len * 0.85), solid('#1f2937', { r: 0.5 }), (o) => o.position.set(0, y + 0.13, zc)); }
  // bull bar / push bar (trucks)
  if (l.bull === 1) { const z = fz + 0.16; for (const s of [-1, 1]) add(cyl(0.04, 0.55, 10), chrome, (o) => o.position.set(s * W * 0.22, bumpY + 0.24, z));
    add(cyl(0.04, W * 0.5, 10), chrome, (o) => { o.rotation.z = Math.PI / 2; o.position.set(0, bumpY + 0.5, z); }); add(box(W * 0.62, 0.1, 0.1), chrome, (o) => o.position.set(0, bumpY, z - 0.04)); }
  if (l.bull === 2) { const z = fz + 0.14; for (const s of [-1, 1]) add(box(0.08, 0.5, 0.08), trim, (o) => o.position.set(s * W * 0.2, bumpY + 0.2, z)); for (const yy of [0, 0.42]) add(box(W * 0.5, 0.08, 0.1), trim, (o) => o.position.set(0, bumpY + yy, z)); add(box(W * 0.46, 0.06, 0.04), M.rubber(), (o) => o.position.set(0, bumpY + 0.21, z + 0.05)); }
  return { g, tails }; }

// ---------------------------------------------------------------- apply a look to a car built by buildCar (idempotent; cheap)
const LIFT = [0, 0.1, 0.2, 0.3], TIRE = [[1, 1], [0.9, 1.03], [1, 1], [1.2, 1.06], [1.25, 1.15], [1.35, 1.3]];
export function applyKustom(car, look, mats) { const U = car.userData; if (!U || !U.chassis || !U.def) return; const c = U.def; const TR = !!(c.truck || c.style === 'truck');
  const l = normLook(look); for (const k of KK_KEYS) if (!fits(KK[k][l[k]], TR)) l[k] = 0; const key = lookCode(l); if (U.kkKey === key) return; U.kkKey = key;
  const M = mats(); const ch = U.chassis; const base = U.paint;
  if (!U.kkPaint) { U.kkPaint = []; U.kkTwo = []; U.kkGlass = []; U.kkSeat = []; ch.traverse((m) => { if (!m.isMesh) return; if (m.material === base) (m.userData.roof || m.userData.flare ? U.kkTwo : U.kkPaint).push(m); if (m.material === M.glass()) U.kkGlass.push(m); if (m.userData.seat) U.kkSeat.push(m); });
    U.kkTails0 = U.tails.slice(); U.kkHeads = U.heads || []; }
  // paint finish + two-tone
  const hex = KK.paint[l.paint].hex || ('#' + base.color.getHexString()); const pm = l.metal >= 5 ? shiftMat(l.metal) : l.paint || l.metal ? paintFor(hex, l.metal) : base; for (const m of U.kkPaint) m.material = pm;
  const tm = l.two ? paintFor(KK.two[l.two].hex, l.metal >= 5 ? 1 : l.metal) : pm; for (const m of U.kkTwo) m.material = tm;
  // tint + interior
  const t = KK.tint[l.tint]; const gm = l.tint ? tintMat(M.glass(), t) : M.glass(); for (const m of U.kkGlass) m.material = gm;
  const sm = l.inter ? seatMat(M.seat(), KK.inter[l.inter].hex) : M.seat(); for (const m of U.kkSeat) m.material = sm;
  // headlight colour (also tints the night beam on your own car via userData.headHex) + style
  const hm = l.hcol ? headMat(M.head(), KK.hcol[l.hcol].hex) : M.head(); U.headHex = l.hcol ? KK.hcol[l.hcol].hex : null; for (const m of U.kkHeads) { m.material = hm; m.visible = !l.head; }
  // remove old parts
  for (const o of U.kkParts || []) o.parent && o.parent.remove(o); U.kkParts = [];
  // wheels: rims + tires (+ lift)
  const ww = (U.kk && U.kk.ww) || c.wr * 0.75 * (TR ? 1.3 : 1); const [twx, ts] = TIRE[l.tires];
  for (const w of U.wheels) { const sp = w.sp; if (!w.rim0) w.rim0 = sp.children[1]; const cur = sp.children[1]; const want = l.rim ? rimTemplate(l.rim, c.wr, ww, M.chrome(), M.trim()).clone() : w.rim0;
    if (cur !== want) { sp.remove(cur); sp.add(want); } want.scale.setScalar(l.tires === 1 ? 1.12 : 1); for (const o of sp.children.slice(2)) sp.remove(o);
    if (l.tires === 2) for (const sx of [-1, 1]) { const ring = new THREE.Mesh(tor(c.wr * 0.66, c.wr * 0.07, 24), solid('#f8fafc', { r: 0.5 })); ring.rotation.y = Math.PI / 2; ring.position.x = sx * ww * 0.36; sp.add(ring); }
    sp.scale.set(twx, ts, ts); }
  U.wrY = ts > 1 ? c.wr * ts : 0; U.lift = c.wr * (ts - 1) + (TR ? LIFT[l.lift] : 0); for (const w of U.wheels) w.st.position.y = U.wrY || c.wr; if (U.chY0 === undefined) U.chY0 = ch.position.y; ch.position.y = U.chY0 + U.lift;
  const light = new THREE.Color(hex).getHSL({}).l > 0.68;
  const P = partsGroup(car, l, M, pm, hm, TR);
  for (const m of U.kkTails0) m.visible = !l.tail; U.tails = l.tail ? P.tails : U.kkTails0;
  const parts = [spoilerGroup(car, l.spoiler, pm, M.trim()), decalGroup(car, l.decal, light), wrapGroup(car, l.wrap), P.g];
  if (l.glow || l.show) { const mode = l.show ? 4 : l.glow === 5 ? 2 : l.gmode; const gg = glowGroup(car, l.glow ? KK.glow[l.glow].hex : '#a855f7', mode); gg.position.y = -U.lift; for (const b of gg.children.slice(2)) b.position.y += U.lift; parts.push(gg); }
  for (const p of parts) { if (!p.children.length) continue; ch.add(p); U.kkParts.push(p); }
  U.look = l; }
export function hornOf(look) { return normLook(look).horn; }

// ---------------------------------------------------------------- horns (Web Audio, original little synth sounds)
let AC = null; const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch { AC = null; } return AC; };
function tone(a, type, f0, f1, t0, dur, vol = 0.06) { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); o.connect(g); g.connect(a.destination);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.setValueAtTime(vol, t0 + dur * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.start(t0); o.stop(t0 + dur + 0.02); }
export function playHorn(h, fallback) { if (!h) { if (fallback) fallback(); return; } const a = ac(); if (!a) return; const t = a.currentTime;
  if (h === 1) { for (const d of [0, 0.18]) { tone(a, 'square', 520, 520, t + d, 0.12, 0.05); tone(a, 'square', 650, 650, t + d, 0.12, 0.04); } }
  else if (h === 2) { for (const d of [0, 0.2]) tone(a, 'sawtooth', 900, 480, t + d, 0.16, 0.05); }
  else if (h === 3) { [523, 659, 784, 1047].forEach((f, i) => tone(a, 'triangle', f, f, t + i * 0.11, 0.13, 0.08)); }
  else if (h === 4) { tone(a, 'sawtooth', 170, 165, t, 0.7, 0.05); tone(a, 'sawtooth', 214, 210, t, 0.7, 0.04); }
  else if (h === 5) { for (const d of [0, 0.16]) tone(a, 'sine', 1500, 220, t + d, 0.15, 0.07); }
  else if (h === 6) { for (const d of [0, 0.22]) { tone(a, 'sine', 2100, 2080, t + d, 0.2, 0.06); tone(a, 'sine', 2650, 2630, t + d, 0.16, 0.03); } }
  else if (h === 7) { [880, 660, 990].forEach((f, i) => tone(a, 'square', f, f, t + i * 0.09, 0.07, 0.04)); }
  else if (h === 8) { for (let i = 0; i < 6; i++) tone(a, 'sawtooth', 300 + (i % 2) * 20, 300 + (i % 2) * 20, t + i * 0.06, 0.07, 0.04); }
  else if (h === 9) { tone(a, 'sine', 880, 870, t, 0.18, 0.07); tone(a, 'sine', 698, 690, t + 0.22, 0.26, 0.07); }
  else if (h === 10) { for (const d of [0, 0.42]) { tone(a, 'triangle', 392, 380, t + d, 0.34, 0.05); tone(a, 'triangle', 494, 480, t + d, 0.34, 0.04); tone(a, 'triangle', 587, 570, t + d, 0.34, 0.03); } }
  else if (h === 11) { [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => tone(a, 'triangle', f, f, t + i * 0.07, 0.08, 0.06)); } }
