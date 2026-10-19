// Finds a scripted input solution for levels with a beam search over the real simulation,
// then saves them to assets/kemy-quest/solutions.json.
// Run: node tests/kemy-quest/solve.mjs [levelId ...]   (no ids = every level without a stored solution; --all = re-solve all)
// Options via env: BEAM (default 350), STEPS (default 1400), OUT=<dir> writes <dir>/<id>.json instead (for parallel runs),
// MERGE=<dir> merges those files into solutions.json.
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { parseLevel, newWorld, step } from '../../js/games/kemy-quest/sim.js';
const root = new URL('../../', import.meta.url);
const { levels } = JSON.parse(readFileSync(new URL('assets/kemy-quest/levels.json', root)));
const outF = new URL('assets/kemy-quest/solutions.json', root);
const out = existsSync(outF) ? JSON.parse(readFileSync(outF)) : {};
if (process.env.MERGE) {
  for (const f of readdirSync(process.env.MERGE)) if (f.endsWith('.json')) { const id = f.slice(0, -5); out[id] = JSON.parse(readFileSync(process.env.MERGE + '/' + f)); console.log('merged', id); }
  writeFileSync(outF, JSON.stringify(out)); process.exit(0);
}
const M = 6;
// action = [dir, jumpFrames, run]
const ACTS = [[1, 0, 1], [1, 6, 1], [1, 2, 1], [1, 0, 0], [1, 6, 0], [0, 0, 0], [0, 6, 0], [-1, 0, 0], [-1, 6, 0], [-1, 6, 1], [0, 0, 1]];
const inp = (a, f) => ({ left: a[0] < 0, right: a[0] > 0, jump: f < a[1], run: !!a[2], down: false, up: false });
function fitness(L, w) {
  const p = w.p; const B = w.boss;
  let fit = p.x - Math.max(0, p.y - (L.h - 3) * 16) * 4 - (3 - p.hearts) * 160 - (p.y > L.h * 16 ? 500 : 0) + (w.ens.filter((e) => !e.alive || e.trap).length) * 2;
  if (B && B.hp <= 0) fit += 1500 + B.max * 4000 + 600;
  else if (B) {
    const bx = B.x + B.w / 2;
    fit = (B.act ? B.ax0 + 1500 - Math.abs(p.x + 6 - bx) * 0.6 - Math.abs(p.y + p.h - B.y) * 0.4 : p.x) + (B.max - B.hp) * 4000 - (3 - p.hearts) * 260;
  }
  return fit;
}
function solve(L, beamW, maxSteps) {
  let beam = [{ w: newWorld(L), path: [] }];
  for (let s = 0; s < maxSteps; s++) {
    const seen = new Map();
    for (const n of beam) for (let ai = 0; ai < ACTS.length; ai++) {
      const w = structuredClone(n.w); const a = ACTS[ai];
      for (let f = 0; f < M; f++) { step(w, L, inp(a, f)); if (w.over) break; }
      if (w.over === 'dead') continue;
      const path = n.path.concat(ai);
      if (w.over === 'clear') return path;
      const p = w.p; const B = w.boss;
      const key = `${p.x / 4 | 0},${p.y / 4 | 0},${Math.round(p.vx)},${Math.round(p.vy)},${p.hearts},${w.sw},${B ? B.hp + ',' + (B.x / 16 | 0) + ',' + B.ph : ''},${p.power ? 1 : 0}`;
      const fit = fitness(L, w);
      const old = seen.get(key);
      if (!old || old.fit < fit) seen.set(key, { w, path, fit });
    }
    beam = [...seen.values()].sort((a, b) => b.fit - a.fit).slice(0, beamW);
    if (!beam.length) return null;
    if (s % 100 === 0) process.stdout.write(` [${s}] x=${beam[0].w.p.x | 0}${beam[0].w.boss ? ' hp=' + beam[0].w.boss.hp : ''}`);
  }
  return null;
}
const args = process.argv.slice(2); const all = args.includes('--all'); const only = args.filter((a) => !a.startsWith('--'));
const beamW = +(process.env.BEAM || 350), steps = +(process.env.STEPS || 1400);
let failed = 0;
for (const lv of levels) {
  if (only.length ? !only.includes(lv.id) : !all && out[lv.id]) continue;
  const L = parseLevel(lv); const t0 = Date.now();
  process.stdout.write(`${lv.id}:`);
  const path = solve(L, beamW, steps);
  console.log(path ? ` solved in ${path.length * M} frames (${(path.length * M / 60).toFixed(1)}s game time), search ${((Date.now() - t0) / 1000).toFixed(1)}s` : ' NOT SOLVED');
  if (!path) { failed++; continue; }
  const sol = { macro: M, acts: ACTS, path: path.map((i) => i.toString(36)).join('') };
  if (process.env.OUT) { mkdirSync(process.env.OUT, { recursive: true }); writeFileSync(`${process.env.OUT}/${lv.id}.json`, JSON.stringify(sol)); }
  else { out[lv.id] = sol; writeFileSync(outF, JSON.stringify(out)); }
}
process.exit(failed ? 1 : 0);
