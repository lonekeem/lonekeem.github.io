// Kemy World driving settings: presets + every steering / pedal / assist option, saved per device (localStorage)
// and to the signed-in account (users/{uid}/pal/drive). Also renders the sectioned "🚗 Driving" settings page.
// Written by Lone Keem.
const KEY = 'kemy-drive-cfg-v1';
export const STEER_STYLES = [['wheel', '🎡 Steering wheel', 'Drag the wheel to turn'], ['arrows', '◀ ▶ Arrows', 'Tap and hold arrow buttons'], ['joystick', '🕹️ Joystick', 'Thumb stick on the left'], ['tilt', '📱 Tilt', 'Tilt your phone like a wheel'],
  ['slider', '↔️ Slider bar', 'Slide along a bar'], ['tap', '👆 Tap halves', 'Touch left or right side of the screen'], ['swipe', '✋ Swipe-drag', 'Drag anywhere to steer'], ['one', '🤚 One-handed', 'One stick: steer + gas/brake']];
export const WHEEL_SKINS = [['sport', 'Sport'], ['classic', 'Classic'], ['racing', 'Racing'], ['kemy', 'Kemy purple']];
export const DEFAULTS = { preset: 'balanced', style: 'arrows', skin: 'sport', sens: 1, speed: 1, ret: 1, dead: 0.06, range: 360, assist: true, smooth: 0.35, invert: false,
  tiltSens: 1, tiltInvert: false, tiltZero: 0, pedals: 'pedals', analog: true, holdGas: true, autoGas: false, autoBrake: false, tc: true, abs: true, drift: false, hand: true,
  haptics: true, shake: true, units: 'kmh', trans: 'auto', cam: 'chase', fov: 62, hud: 'classic', size: 1, opacity: 0.85, theme: 'night', lefty: false };
export const PRESETS = {
  easy: { style: 'arrows', sens: 0.8, speed: 0.8, ret: 1.4, dead: 0.1, assist: true, smooth: 0.5, autoGas: true, autoBrake: true, tc: true, abs: true, drift: false, trans: 'auto', hud: 'minimal' },
  balanced: { sens: 1, speed: 1, ret: 1, dead: 0.06, assist: true, smooth: 0.35, autoGas: false, autoBrake: false, tc: true, abs: true, drift: false, trans: 'auto', hud: 'classic' },
  realistic: { style: 'wheel', sens: 1, speed: 0.85, ret: 0.8, dead: 0.03, range: 540, assist: false, smooth: 0.2, autoGas: false, autoBrake: false, tc: true, abs: true, drift: false, trans: 'auto', hud: 'full' },
  drift: { sens: 1.25, speed: 1.4, ret: 1.2, dead: 0.03, assist: false, smooth: 0.15, tc: false, abs: true, drift: true, trans: 'manual', hud: 'full' },
  pro: { sens: 1.15, speed: 1.3, ret: 0.9, dead: 0.02, range: 900, assist: false, smooth: 0.1, autoGas: false, autoBrake: false, tc: false, abs: false, drift: false, trans: 'manual', hud: 'full' } };
const lsg = (k) => { try { return localStorage.getItem(k); } catch { return null; } }, lss = (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } };
let cfg = null; const subs = new Set();
export function getCfg() { if (!cfg) { let s = {}; try { s = JSON.parse(lsg(KEY) || '{}'); } catch { /* */ } cfg = { ...DEFAULTS, ...s }; } return cfg; }
let acct = null, saveT = 0;
export function setCfg(patch, fromAcct) { Object.assign(getCfg(), patch); lss(KEY, JSON.stringify(cfg)); subs.forEach((f) => { try { f(cfg); } catch { /* */ } });
  if (acct && !fromAcct) { clearTimeout(saveT); saveT = setTimeout(() => acct.save(cfg), 1500); } }
export const onCfg = (f) => (subs.add(f), () => subs.delete(f));
export function applyPreset(id) { setCfg({ ...(PRESETS[id] || {}), preset: id }); }
export function resetCfg() { cfg = { ...DEFAULTS }; setCfg({}); }
// account sync (best-effort; the device copy always works)
export async function linkAccount(db, uid) { if (!db || !uid || acct) return; try { const { doc, getDoc, setDoc, serverTimestamp } = await import('../fsq.js'); const ref = doc(db, 'users', uid, 'pal', 'drive');
    acct = { save: (c) => setDoc(ref, { cfg: JSON.stringify(c).slice(0, 4000), at: serverTimestamp() }).catch(() => {}) }; const d = await getDoc(ref); if (d.exists() && !lsg(KEY)) { try { setCfg(JSON.parse(d.data().cfg), true); } catch { /* */ } } } catch { /* */ } }

// ---------------------------------------------------------------- the settings page (sections, short descriptions)
const css = `.dc{color:#111;font:500 14px Inter,system-ui,sans-serif}.dc h4{margin:14px 0 4px;font:800 15px Inter,sans-serif;color:#4c1d95}.dc .d{font-size:12px;color:#555;margin:0 0 6px}.dc .r{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eee}
.dc .r span{flex:1}.dc input[type=range]{width:46%}.dc select{min-height:36px;border-radius:10px;border:1px solid #ccc;background:#fff;color:#111;padding:0 6px}.dc .chips{display:flex;flex-wrap:wrap;gap:6px}.dc .chip{border:2px solid #ddd;background:#fff;color:#111;border-radius:12px;padding:7px 10px;font:700 13px Inter,sans-serif}.dc .chip.on{border-color:#7c3aed;background:#ede9fe}
.dc .chip small{display:block;font-weight:500;color:#555}.dc .btns button{margin:8px 6px 0 0;border:0;border-radius:12px;padding:10px 14px;font:800 14px Inter,sans-serif;background:#6d28d9;color:#fff}.dc .btns button.g{background:#e5e7eb;color:#111}.dc .tst{height:120px;border-radius:14px;background:linear-gradient(#bfe3ff,#e9f5ff);position:relative;overflow:hidden;margin-top:6px;touch-action:none}
.dc .tst .road{position:absolute;left:0;right:0;bottom:0;height:60px;background:#3b3d48}.dc .tst .car{position:absolute;bottom:18px;left:50%;width:40px;height:22px;margin-left:-20px;border-radius:8px 8px 4px 4px;background:#7c3aed;transition:transform .05s}.dc .tst .v{position:absolute;top:6px;left:8px;font:700 12px Inter,sans-serif;color:#111}`;
export function renderDriveSettings(el, opts = {}) { const c = getCfg(); if (!document.getElementById('dc-css')) { const s = document.createElement('style'); s.id = 'dc-css'; s.textContent = css; document.head.appendChild(s); }
  const rng = (k, label, min, max, step, d, fmt = (v) => v) => `<div class="r"><span>${label}<div class="d">${d}</div></span><b data-o="${k}">${fmt(c[k])}</b><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${c[k]}"></div>`;
  const tog = (k, label, d) => `<div class="r"><span>${label}<div class="d">${d}</div></span><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''} style="width:22px;height:22px"></div>`;
  const sel = (k, label, list, d) => `<div class="r"><span>${label}<div class="d">${d}</div></span><select data-k="${k}">${list.map(([v, n]) => `<option value="${v}" ${String(c[k]) === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  el.innerHTML = `<div class="dc">
  <h4>⭐ Presets</h4><p class="d">Start from a feel, then fine-tune anything below (it becomes Custom).</p><div class="chips">${[['easy', 'Easy'], ['balanced', 'Balanced'], ['realistic', 'Realistic'], ['drift', 'Drift'], ['pro', 'Pro'], ['custom', 'Custom']].map(([v, n]) => `<button class="chip ${c.preset === v ? 'on' : ''}" data-p="${v}">${n}</button>`).join('')}</div>
  <h4>🎮 Steering style</h4><div class="chips">${STEER_STYLES.map(([v, n, d]) => `<button class="chip ${c.style === v ? 'on' : ''}" data-s="${v}">${n}<small>${d}</small></button>`).join('')}</div>
  ${sel('skin', 'Wheel skin', WHEEL_SKINS, 'Look of the on-screen wheel')}
  <h4>🎛️ Steering tuning</h4>${rng('sens', 'Sensitivity', 0.4, 2, 0.05, 'How much the car turns for your input', (v) => (+v).toFixed(2))}${rng('speed', 'Steering speed', 0.4, 2, 0.05, 'How fast the wheels turn', (v) => (+v).toFixed(2))}
  ${rng('ret', 'Return to center', 0.2, 2.5, 0.05, 'How fast steering straightens when you let go', (v) => (+v).toFixed(2))}${rng('dead', 'Dead zone', 0, 0.3, 0.01, 'Ignore tiny movements', (v) => Math.round(v * 100) + '%')}
  ${rng('range', 'Wheel rotation', 90, 900, 30, 'Degrees of turn for full lock (wheel style)', (v) => v + '°')}${rng('smooth', 'Smoothing', 0, 0.9, 0.05, 'Softens jerky input', (v) => Math.round(v * 100) + '%')}
  ${tog('assist', 'Steering assist', 'Auto-straightens and helps catch slides')}${tog('invert', 'Invert steering', 'Swap left and right')}
  <h4>📱 Tilt</h4>${rng('tiltSens', 'Tilt sensitivity', 0.4, 2.5, 0.05, 'Less tilt needed when higher', (v) => (+v).toFixed(2))}${tog('tiltInvert', 'Invert tilt', 'For upside-down holding')}
  <div class="btns"><button class="g" data-a="calib">🎯 Calibrate tilt (hold level)</button></div>
  <h4>🦶 Pedals</h4>${sel('pedals', 'Gas & brake as', [['pedals', 'Pedals'], ['buttons', 'Buttons'], ['slider', 'Slider']], 'Pick what feels best')}
  ${tog('analog', 'Analog throttle', 'Press higher on the pedal for more gas')}${tog('holdGas', 'Hold to drive', 'Off = tap gas to toggle cruise')}${tog('autoGas', 'Auto-accelerate', 'Car drives itself forward; you steer')}${tog('hand', 'Handbrake button', 'Show a handbrake for drifts')}
  <h4>🛟 Assists</h4>${tog('tc', 'Traction control', 'Stops wheelspin')}${tog('abs', 'ABS', 'Keeps steering while braking hard')}${tog('drift', 'Drift assist', 'Easier, friendlier slides')}${tog('autoBrake', 'Auto-brake', 'Slows down before you bump into things')}
  <h4>⚙️ Car</h4>${sel('trans', 'Transmission', [['auto', 'Automatic'], ['manual', 'Manual (shift buttons)']], 'Manual shows ▲ ▼ gear buttons')}${sel('units', 'Speed units', [['kmh', 'km/h'], ['mph', 'mph']], '')}
  ${sel('cam', 'Default camera', [['chase', 'Chase'], ['far', 'Far chase'], ['pov', 'Driver seat']], '')}${rng('fov', 'Field of view', 50, 90, 1, 'Wider feels faster', (v) => v + '°')}
  <h4>🖥️ HUD & buttons</h4>${sel('hud', 'HUD style', [['minimal', 'Minimal'], ['classic', 'Classic'], ['full', 'Full (gauges + map)']], '')}${rng('size', 'Button size', 0.7, 1.4, 0.05, '', (v) => Math.round(v * 100) + '%')}${rng('opacity', 'Button opacity', 0.3, 1, 0.05, '', (v) => Math.round(v * 100) + '%')}
  ${sel('theme', 'Color theme', [['night', 'Night'], ['kemy', 'Kemy purple'], ['sport', 'Sport red'], ['ice', 'Ice blue']], '')}${tog('lefty', 'Left-handed layout', 'Pedals on the left, steering on the right')}${tog('haptics', 'Haptics', 'Little buzzes on bumps and shifts')}${tog('shake', 'Camera shake', 'Subtle shake at high speed')}
  <h4>🧪 Test drive</h4><p class="d">Drag or tilt here to feel your steering.</p><div class="tst"><div class="v">steer 0%</div><div class="road"></div><div class="car"></div></div>
  <div class="btns">${opts.edit ? '<button data-a="edit">✏️ Edit layout</button>' : ''}<button class="g" data-a="reset">Reset all</button></div></div>`;
  const pick = (attr, k) => el.querySelectorAll(`[data-${attr}]`).forEach((b) => (b.onclick = () => { if (attr === 'p') { if (b.dataset.p !== 'custom') applyPreset(b.dataset.p); else setCfg({ preset: 'custom' }); } else setCfg({ [k]: b.dataset[attr], preset: 'custom' }); renderDriveSettings(el, opts); }));
  pick('p'); pick('s', 'style');
  el.querySelectorAll('[data-k]').forEach((i) => { i.oninput = i.onchange = () => { const k = i.dataset.k; let v = i.type === 'checkbox' ? i.checked : i.type === 'range' ? +i.value : i.value; setCfg({ [k]: v, preset: 'custom' }); const o = el.querySelector(`[data-o="${k}"]`); if (o) o.textContent = i.type === 'range' ? (/^(dead|smooth|size|opacity)$/.test(k) ? Math.round(v * 100) + '%' : /^(range|fov)$/.test(k) ? v + '°' : v.toFixed(2)) : v; if (k === 'preset') renderDriveSettings(el, opts); }; });
  el.querySelector('[data-a=reset]').onclick = () => { resetCfg(); renderDriveSettings(el, opts); };
  el.querySelector('[data-a=calib]').onclick = async () => { await askTilt(); const b = el.querySelector('[data-a=calib]'); b.textContent = '🎯 Hold level…'; setTimeout(() => { setCfg({ tiltZero: tiltNow() }); b.textContent = '✅ Calibrated'; }, 800); };
  if (opts.edit) el.querySelector('[data-a=edit]').onclick = () => opts.edit();
  // test drive: drag or tilt
  const t = el.querySelector('.tst'), car = t.querySelector('.car'), v = t.querySelector('.v'); let drag = null, st = 0, raf = 0; const tick = () => { const g = getCfg(); let r = drag != null ? drag : g.style === 'tilt' ? tiltSteer(g) : 0; r = shapeSteer(r, g); st += (r - st) * (1 - g.smooth * 0.9) * 0.3; car.style.transform = `translateX(${st * 120}px) rotate(${st * 20}deg)`; v.textContent = 'steer ' + Math.round(st * 100) + '%'; if (el.isConnected) raf = requestAnimationFrame(tick); };
  t.onpointerdown = (e) => { t.setPointerCapture(e.pointerId); const b = t.getBoundingClientRect(); drag = ((e.clientX - b.left) / b.width - 0.5) * 2; }; t.onpointermove = (e) => { if (drag == null) return; const b = t.getBoundingClientRect(); drag = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - 0.5) * 2)); }; t.onpointerup = t.onpointercancel = () => (drag = null); cancelAnimationFrame(raf); tick(); }
// shared steering shaping (dead zone, invert, sensitivity curve)
export function shapeSteer(r, g = getCfg()) { if (g.invert) r = -r; const a = Math.abs(r); if (a < g.dead) return 0; const k = (a - g.dead) / (1 - g.dead); return Math.sign(r) * Math.min(1, Math.pow(k, 1.25 / g.sens) * g.sens); }
// tilt (DeviceOrientation gamma/beta depending on orientation); iOS needs a permission tap
let tilt = 0, tiltOn = false;
export async function askTilt() { try { if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false; } } catch { return false; }
  if (!tiltOn) { tiltOn = true; addEventListener('deviceorientation', (e) => { const land = (screen.orientation && /landscape/.test(screen.orientation.type)) || innerWidth > innerHeight; const ang = (screen.orientation && screen.orientation.angle) || 0; tilt = land ? (e.beta || 0) * (ang === 270 || ang === -90 ? -1 : 1) : (e.gamma || 0); }); } return true; }
export const tiltNow = () => tilt;
export const tiltSteer = (g = getCfg()) => Math.max(-1, Math.min(1, (tilt - g.tiltZero) / 35 * g.tiltSens * (g.tiltInvert ? -1 : 1)));
export function buzz(ms) { try { if (getCfg().haptics && navigator.vibrate) navigator.vibrate(ms); } catch { /* */ } }
