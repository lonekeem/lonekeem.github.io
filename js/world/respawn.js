// Respawn for Pal Park / Kemy World (walking + driving): menu choice (my house / nearest safe spot / park centre),
// quick button when idle or out of bounds, auto-respawn when falling through the world. Short fade, 5 s cooldown,
// new position synced to the room. Written by Lone Keem.
import { BOUNDS, ALL_ROADS } from './layout.js';
export function attachRespawn(api, W) { const { P, view } = api; const ground = api.ground; const host = W.hud || view;
  const css = document.createElement('style'); css.textContent = `.rs-q{position:absolute;left:50%;transform:translateX(-50%);top:calc(max(8px,env(safe-area-inset-top)) + 58px);pointer-events:auto;height:40px;border-radius:999px;border:2px solid #fff;background:rgba(124,58,237,.9);color:#fff;font:800 14px Inter,sans-serif;padding:0 16px;z-index:9}.rs-q[hidden],.rs-p[hidden]{display:none}
.rs-p{position:absolute;inset:0;z-index:44;display:flex;align-items:center;justify-content:center;background:rgba(10,6,30,.55);pointer-events:auto}.rs-p>div{background:#fff;color:#111;border-radius:18px;padding:16px;width:min(90vw,340px);font:500 14px Inter,sans-serif}.rs-p h3{margin:0 0 8px;color:#111;font:800 18px Inter,sans-serif}
.rs-p button{display:block;width:100%;margin:6px 0 0;border:0;border-radius:12px;padding:12px;font:800 15px Inter,sans-serif;background:#6d28d9;color:#fff;text-align:left}.rs-p button.g{background:#e5e7eb;color:#111;text-align:center}.rs-f{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .25s;z-index:43}`; document.head.appendChild(css);
  const q = document.createElement('button'); q.className = 'rs-q'; q.hidden = true; q.textContent = '↩️ Respawn'; const pan = document.createElement('div'); pan.className = 'rs-p'; pan.hidden = true; const fade = document.createElement('div'); fade.className = 'rs-f'; host.append(q, pan, fade);
  let last = 0, safe = { x: 0, z: 6 }, safeT = 0, still = 0, lp = { x: P.x, z: P.z };
  const say = (t) => (W.say ? W.say(t) : 0); const D = () => W.drive;
  function nearestRoadSpot(x, z) { let best = null, bd = 1e9; for (const r of ALL_ROADS()) { const [ax, az] = r.a, [bx, bz] = r.b; const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz; const t = Math.max(0.03, Math.min(0.97, ((x - ax) * dx + (z - az) * dz) / L2)); const px = ax + dx * t, pz = az + dz * t; const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; const L = Math.sqrt(L2); const side = ((x - px) * -dz + (z - pz) * dx) >= 0 ? 1 : -1; best = { x: px - dz / L * 2 * side, z: pz + dx / L * 2 * side, yaw: Math.atan2(dx, dz), walk: { x: px - dz / L * (r.w / 2 + 1.3) * side, z: pz + dx / L * (r.w / 2 + 1.3) * side } }; } } return best; }
  function go(kind, auto) { const now = Date.now(); if (!auto && now - last < 5000) { say('⏳ Respawn ready in ' + Math.ceil((5000 - (now - last)) / 1000) + ' s'); return false; } last = now; pan.hidden = true; q.hidden = true;
    let spot = kind === 'home' && W.homeSpot ? W.homeSpot() : null; if (!spot && kind === 'center') spot = { x: 0, z: 6, yaw: 0 }; if (!spot) spot = { ...safe, yaw: P.yaw || 0 };
    fade.style.opacity = 1; setTimeout(() => { const d = D(); const m = d && d.mine && d.mine(); W.leaveRoom && W.leaveRoom();
      if (m && m.state !== 'parked' && d.resetAt) { const r = nearestRoadSpot(spot.x, spot.z); d.resetAt(r ? { x: r.x, z: r.z, yaw: r.yaw } : spot); }
      else { const r = kind === 'safe' ? null : null; void r; P.x = spot.x; P.z = spot.z; P.yaw = spot.yaw || 0; P.y = ground(P.x, P.z) + 0.05; P.vy = 0; }
      api.markDirty && api.markDirty(); setTimeout(() => (fade.style.opacity = 0), 120); say('↩️ Respawned'); }, 260); return true; }
  function open() { const home = W.homeSpot && W.homeSpot(); pan.innerHTML = `<div><h3>↩️ Respawn</h3>${home ? '<button data-k="home">🏠 My house</button>' : ''}<button data-k="safe">🛟 Nearest safe spot</button><button data-k="center">🌳 Park center</button><button class="g" data-x>Cancel</button></div>`; pan.hidden = false;
    pan.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => go(b.dataset.k))); pan.querySelector('[data-x]').onclick = () => (pan.hidden = true); pan.onclick = (e) => { if (e.target === pan) pan.hidden = true; }; }
  q.onclick = open;
  function update(dt) { const g = ground(P.x, P.z); const bad = !Number.isFinite(P.x) || !Number.isFinite(P.z) || !Number.isFinite(P.y); const out = P.x < BOUNDS.x0 - 8 || P.x > 530 || P.z < BOUNDS.z0 - 8 || P.z > BOUNDS.z1 + 8;
    if (bad || (P.y < g - 6) || P.y < -40) { if (bad) { P.x = safe.x; P.z = safe.z; P.y = ground(safe.x, safe.z); } go('safe', true); return; }
    if ((safeT += dt) > 1.5 && !out && Math.abs(P.y - g) < 1.2 && P.x < 392) { safeT = 0; const r = nearestRoadSpot(P.x, P.z); safe = r && Math.hypot(r.walk.x - P.x, r.walk.z - P.z) < 25 ? { x: P.x, z: P.z } : { x: P.x, z: P.z }; }
    const moved = Math.hypot(P.x - lp.x, P.z - lp.z) > 0.3; lp = { x: P.x, z: P.z }; still = moved ? 0 : still + dt; q.hidden = !(out || still > 45); }
  W.respawn = { open, go, update, nearestRoadSpot };
  return { update, destroy() { q.remove(); pan.remove(); fade.remove(); css.remove(); } };
}
