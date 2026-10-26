// Kemy Hill Rush save: Rush Stars, owned vehicles, upgrades, unlocked stages, best distances (this device, per player).
// Rush Stars only buy things inside this game. Kemy Star Coins / diamonds go through the shared, server-capped wallets.
import { STAGES, VEHICLES, VEHICLE, STAGE, MAX_LV, upgradeCost } from './data.js';
const day = () => new Date().toISOString().slice(0, 10);
export function rushStore(uid) {
  const key = 'lks-rush:' + (uid || 'guest');
  let d = {}; try { d = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { d = {}; }
  d = { stars: 0, owned: ['scout'], ups: {}, vid: 'scout', stage: 'countryside', stages: ['countryside'], best: {}, total: 0, coin: { d: '', n: 0 }, dia: { d: '', n: 0 }, ...d };
  if (!VEHICLE[d.vid] || !d.owned.includes(d.vid)) d.vid = 'scout';
  if (!STAGE[d.stage] || !d.stages.includes(d.stage)) d.stage = 'countryside';
  const save = () => { try { localStorage.setItem(key, JSON.stringify(d)); } catch { /* private mode */ } };
  const lv = (vid, up) => Math.max(0, Math.min(MAX_LV, ((d.ups[vid] || {})[up]) | 0));
  return {
    get d() { return d; }, save, lv,
    ups: (vid) => ({ ...(d.ups[vid] || {}) }),
    addStars(n) { n = Math.max(0, Math.min(5000, Math.round(n) || 0)); d.stars += n; d.total += n; save(); return n; },
    spend(n) { if (n <= 0 || d.stars < n) return false; d.stars -= n; save(); return true; },
    buyVehicle(vid) { const v = VEHICLE[vid]; if (!v || d.owned.includes(vid) || !this.spend(v.cost)) return false; d.owned.push(vid); d.vid = vid; save(); return true; },
    upgrade(vid, up) { const l = lv(vid, up); if (l >= MAX_LV || !d.owned.includes(vid) || !this.spend(upgradeCost(vid, up, l))) return false; d.ups[vid] = { ...(d.ups[vid] || {}), [up]: l + 1 }; save(); return true; },
    unlockStage(id) { const s = STAGE[id]; if (!s || d.stages.includes(id) || !this.spend(s.cost)) return false; d.stages.push(id); d.stage = id; save(); return true; },
    pick(kind, id) { if (kind === 'vid' && d.owned.includes(id)) d.vid = id; if (kind === 'stage' && d.stages.includes(id)) d.stage = id; save(); },
    best(id, m) { if (m == null) return d.best[id] || 0; const nb = m > (d.best[id] || 0); if (nb) { d.best[id] = Math.round(m); save(); } return nb; },
    // daily caps for the real wallets (the wallets also cap on the server)
    take(kind, want, cap) { const b = d[kind]; if (b.d !== day()) { b.d = day(); b.n = 0; } const n = Math.max(0, Math.min(want, cap - b.n)); b.n += n; save(); return n; },
    give(kind, n) { const b = d[kind]; if (b.d === day()) { b.n = Math.max(0, b.n - n); save(); } },
    STAGES, VEHICLES
  };
}
