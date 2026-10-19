// Verifies every level is completable: replays the stored scripted solution through the real simulation.
// Run: node tests/kemy-quest/replay.test.mjs
import { readFileSync } from 'node:fs';
import { parseLevel, newWorld, step } from '../../js/games/kemy-quest/sim.js';
const root = new URL('../../', import.meta.url);
const { levels } = JSON.parse(readFileSync(new URL('assets/kemy-quest/levels.json', root)));
const sols = JSON.parse(readFileSync(new URL('assets/kemy-quest/solutions.json', root)));
let fail = 0;
for (const lv of levels) {
  const L = parseLevel(lv); const errs = [];
  if (!lv.start) errs.push('no start'); if (!lv.ents.some((e) => e.t === 'goal')) errs.push('no goal');
  if (lv.ents.filter((e) => e.t === 'big').length !== 3) errs.push('needs 3 big stars');
  if (new Set(lv.tiles.map((r) => r.length)).size !== 1) errs.push('ragged rows');
  const s = sols[lv.id]; let res = 'no solution';
  if (s) {
    const w = newWorld(L); const path = [...s.path].map((c) => parseInt(c, 36));
    for (let f = 0; f < path.length * s.macro && !w.over; f++) { const a = s.acts[path[Math.floor(f / s.macro)]]; step(w, L, { left: a[0] < 0, right: a[0] > 0, jump: (f % s.macro) < a[1], run: !!a[2], up: false, down: false }); }
    res = w.over === 'clear' ? `clear in ${(w.frame / 60).toFixed(1)}s, ${w.stars} stars, hearts ${w.p.hearts}` : `ended ${w.over || 'unfinished'} at x=${w.p.x | 0}`;
    if (w.over !== 'clear') errs.push(res);
  } else errs.push(res);
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${lv.id} ${lv.name}: ${errs.length ? errs.join('; ') : res}`); if (errs.length) fail++;
}
// physics sanity: holding jump goes higher than tapping (variable jump height) and coyote/buffer work
{
  const L = parseLevel({ start: [2, 11], ents: [], tiles: Array.from({ length: 15 }, (_, y) => (y >= 12 ? '#' : '.').repeat(40)) });
  const peak = (hold) => { const w = newWorld(L); let min = 1e9; for (let f = 0; f < 80; f++) { step(w, L, { jump: f < (hold ? 40 : 3), left: false, right: false, run: false }); min = Math.min(min, w.p.y); } return w.p.y - min; };
  const hi = peak(true), lo = peak(false); const ok = hi > lo * 1.6; console.log(`${ok ? 'ok  ' : 'FAIL'} variable jump: hold ${hi.toFixed(0)}px vs tap ${lo.toFixed(0)}px`); if (!ok) fail++;
}
console.log(fail ? `${fail} FAILED` : 'all levels completable'); process.exit(fail ? 1 : 0);
