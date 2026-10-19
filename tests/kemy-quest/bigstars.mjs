// Checks that every Big Star can actually be reached: a beam search through the real simulation
// starts from the nearest start/checkpoint before the star and must touch it. Run: node tests/kemy-quest/bigstars.mjs [levelId ...]
import { readFileSync } from 'node:fs';
import { parseLevel, newWorld, step, T } from '../../js/games/kemy-quest/sim.js';
const { levels } = JSON.parse(readFileSync(new URL('../../assets/kemy-quest/levels.json', import.meta.url)));
const ACTS = [[1, 0, 1], [1, 6, 1], [1, 2, 1], [1, 0, 0], [1, 6, 0], [0, 0, 0], [0, 6, 0], [-1, 0, 0], [-1, 6, 0], [-1, 6, 1], [0, 0, 1], [-1, 0, 1], [-1, 2, 1]];
const inp = (a, f) => ({ left: a[0] < 0, right: a[0] > 0, jump: f < a[1], run: !!a[2], down: false, up: false });
function reach(L, big) {
  const w0 = newWorld(L); const p = w0.p; const B = w0.boss;
  const spots = [{ x: L.start[0], y: L.start[1] }, ...L.ents.filter((e) => e.t === 'check')].filter((s) => s.x <= big.x + 2);
  let sp = spots.sort((a, b) => b.x - a.x)[0] || { x: L.start[0], y: L.start[1] };
  if (B && big.x * T >= B.ax1) { B.hp = 0; sp = { x: B.ax1 / T + 1, y: B.fy / T - 1 }; }
  p.x = sp.x * T + 2; p.y = sp.y * T + 1; p.spawn = [p.x, p.y];
  const gx = big.x * T + 8, gy = big.y * T + 8;
  let beam = [{ w: w0 }];
  for (let s = 0; s < 320; s++) {
    const seen = new Map();
    for (const n of beam) for (const a of ACTS) {
      const w = structuredClone(n.w);
      for (let f = 0; f < 6; f++) { step(w, L, inp(a, f)); if (w.over) break; }
      if (w.big[big.id]) return true;
      if (w.over) continue;
      const q = w.p; const key = `${q.x / 6 | 0},${q.y / 6 | 0},${Math.round(q.vx)},${Math.round(q.vy)},${w.sw}`;
      const d = Math.hypot(q.x + 6 - gx, (q.y + 7 - gy) * 1.3); const fit = -d - (3 - q.hearts) * 120 + (((q.x * 7 + q.y * 13) | 0) % 30);
      const old = seen.get(key); if (!old || old.fit < fit) seen.set(key, { w, fit });
    }
    // keep the closest states, but also the best few per 3x3-tile cell so detours (dives, backtracking) survive
    const all = [...seen.values()].sort((a, b) => b.fit - a.fit); const per = new Map(); beam = [];
    for (const n of all) { const c = `${n.w.p.x / 48 | 0},${n.w.p.y / 48 | 0}`; const k = per.get(c) || 0; if (beam.length < 200 || k < 4) { beam.push(n); per.set(c, k + 1); } if (beam.length >= 420) break; }
    if (!beam.length) return false;
  }
  return false;
}
const only = process.argv.slice(2); let fail = 0;
for (const lv of levels) {
  if (only.length && !only.includes(lv.id)) continue;
  const L = parseLevel(lv); const res = lv.ents.filter((e) => e.t === 'big').map((b) => [b, reach(L, b)]);
  const bad = res.filter((r) => !r[1]); if (bad.length) fail++;
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${lv.id} big stars reachable ${res.length - bad.length}/3${bad.length ? ' missing at ' + bad.map(([b]) => `(${b.x},${b.y})`).join(' ') : ''}`);
}
console.log(fail ? `${fail} levels with unreachable Big Stars` : 'all Big Stars reachable'); process.exit(fail ? 1 : 0);
