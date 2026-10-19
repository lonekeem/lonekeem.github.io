// Finds a scripted input solution for every level with a beam search over the real simulation,
// then saves them to assets/kemy-quest/solutions.json. Run: node tests/kemy-quest/solve.mjs [levelId]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseLevel, newWorld, step } from '../../js/games/kemy-quest/sim.js';
const root = new URL('../../', import.meta.url);
const { levels } = JSON.parse(readFileSync(new URL('assets/kemy-quest/levels.json', root)));
const outF = new URL('assets/kemy-quest/solutions.json', root);
const out = existsSync(outF) ? JSON.parse(readFileSync(outF)) : {};
const M = 6;
// action = [dir, jumpFrames, run]
const ACTS = [[1, 0, 1], [1, 6, 1], [1, 2, 1], [1, 0, 0], [1, 6, 0], [0, 0, 0], [0, 6, 0], [-1, 0, 0], [-1, 6, 0], [-1, 6, 1], [0, 0, 1]];
const inp = (a, f) => ({ left: a[0] < 0, right: a[0] > 0, jump: f < a[1], run: !!a[2], down: false, up: false });
function solve(L, beamW = 350, maxSteps = 900) {
  let beam = [{ w: newWorld(L), path: [] }];
  for (let s = 0; s < maxSteps; s++) {
    const seen = new Map();
    for (const n of beam) for (let ai = 0; ai < ACTS.length; ai++) {
      const w = structuredClone(n.w); const a = ACTS[ai];
      for (let f = 0; f < M; f++) { step(w, L, inp(a, f)); if (w.over) break; }
      if (w.over === 'dead') continue;
      const path = n.path.concat(ai);
      if (w.over === 'clear') return path;
      const p = w.p; const plat = L.ents.some((e) => e.t === 'plat' || e.t === 'vplat') ? (w.frame / 30 | 0) % 12 : 0;
      const key = `${p.x / 4 | 0},${p.y / 4 | 0},${Math.round(p.vx)},${Math.round(p.vy)},${p.hearts},${plat}`;
      const fit = p.x - Math.max(0, p.y - (L.h - 3) * 16) * 4 - (3 - p.hearts) * 160 - (p.y > L.h * 16 ? 500 : 0) + (w.ens.filter((e) => !e.alive || e.trap).length) * 2;
      const old = seen.get(key);
      if (!old || old.fit < fit) seen.set(key, { w, path, fit });
    }
    beam = [...seen.values()].sort((a, b) => b.fit - a.fit).slice(0, beamW);
    if (!beam.length) return null;
    if (s % 100 === 0) process.stdout.write(` [${s}] x=${beam[0].w.p.x | 0}`);
  }
  return null;
}
const only = process.argv[2];
for (const lv of levels) {
  if (only && lv.id !== only) continue;
  const L = parseLevel(lv); const t0 = Date.now();
  process.stdout.write(`${lv.id}:`);
  const path = solve(L);
  console.log(path ? ` solved in ${path.length * M} frames (${(path.length * M / 60).toFixed(1)}s game time), search ${((Date.now() - t0) / 1000).toFixed(1)}s` : ' NOT SOLVED');
  if (path) out[lv.id] = { macro: M, acts: ACTS, path: path.join('') .length ? path.map((i) => i.toString(36)).join('') : '' };
}
writeFileSync(outF, JSON.stringify(out));
