// Theater showtimes: the schedule is pure clock math (no writes). Two-hour program. Checks it is deterministic, every film starts on a
// quarter hour with a 5:00 countdown before it, the kid program keeps the same clock, owner anchors still work, and
// with SHERIFF_IN_THEATER off nobody gets the Sheriff in the theater.
// usage: node tests/world/theater-schedule.test.mjs
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FILMS, PERIOD, COUNTDOWN, TC, SHERIFF_IN_THEATER, SHERIFF_SLOT, PEPPER_CREDIT, PEPPER_EPISODES, familyOnly, program, showAt, listings, anchorFor, slotTitle, creditOf } from '../../js/world/theater-movie.js';
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok', name); };
const H = Date.UTC(2026, 9, 27, 18, 0, 0); // an even UTC hour (program hour A) = a whole local hour in America/New_York
const NS = 7; // films on the board (with the flag on, the Sheriff replaces Big Buck Bunny in its slot)
ok('period is two hours', () => assert.equal(PERIOD, 7200));
ok('deterministic', () => { for (let i = 0; i < 500; i++) { const t = H + Math.floor(Math.random() * 86400e3); assert.deepEqual(showAt(t), showAt(t)); assert.deepEqual(listings(t), listings(t)); const a = showAt(t), b = showAt(t + 86400e3 * 7); assert.deepEqual([a.phase, a.id, a.si, Math.round(a.left * 1e3)], [b.phase, b.id, b.si, Math.round(b.left * 1e3)]); } });
ok('slots fit and do not overlap', () => { for (const kid of [false, true]) for (const s of program(kid)) assert.ok(s.end <= s.len, `slot ${s.i} ${s.end} > ${s.len}`); });
ok('every slot opens on a quarter hour with a 5:00 countdown', () => { for (const kid of [false, true]) program(kid).forEach((s, i) => {
  const filmAt = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; // regular schedule
  assert.equal(new Date(filmAt).getUTCMinutes() % 15, 0); assert.equal(new Date(filmAt).getUTCSeconds(), 0);
  const c = showAt(filmAt - COUNTDOWN * 1000 + 500, 0, false, kid); assert.equal(c.phase, 'count'); assert.ok(Math.abs(c.left - (COUNTDOWN - 0.5)) < 0.01, 'countdown ' + c.left);
  const m = showAt(filmAt + 1000, 0, false, kid); assert.equal(m.phase, 'movie'); assert.equal(m.id, s.ids[0]); }); });
ok('exact adult program', () => { const p = program(false).map((s) => s.ids.join('+')); assert.deepEqual(p, SHERIFF_IN_THEATER ? ['pepper', 'sing', 'sheriff', 'pepper', 'spring', 'c2+c3+wing'] : ['pepper', 'sing', 'bbb', 'pepper', 'spring', 'c2+c3+wing']); });
ok('hourly clock: Pepper&Carrot :00 + Singularity :30 + BBB :45 (hour A), Pepper&Carrot :00 + Spring :30 + shorts :45 (hour B)', () => { const at = program(false).map((s) => (s.o + s.starts[0] - COUNTDOWN) / 60); assert.deepEqual(at, [0, 30, 45, 60, 90, 105]);
  assert.deepEqual(program(false).map((s) => s.len), [1800, 900, 900, 1800, 900, 900]); });
ok('no long dead gap: every slot ends within 15 min of the next countdown', () => { for (const s of program(false)) assert.ok(s.len - s.end < 900, `slot ${s.i} idle ${s.len - s.end}s`); });
ok('every film plays at least once every 2 hours, nothing dropped', () => { const ids = [...new Set(program(false).flatMap((s) => s.ids))].sort(); assert.deepEqual(ids, ['bbb', 'c2', 'c3', 'pepper', 'sing', 'spring', 'wing']);
  const k = [...new Set(program(true).flatMap((s) => s.ids))].sort(); assert.deepEqual(k, ids); });
ok('removed film is gone (no FILMS entry, no slot)', () => { assert.ok(!('ada' in FILMS)); assert.ok(!program(false).some((s) => s.ids.includes('ada'))); });
ok('Singularity: CC BY 4.0, Blender Studio credit, own :30 slot in hour A', () => { const f = FILMS.sing; assert.equal(f.lic, 'CC BY 4.0'); assert.equal(f.credit, 'Singularity (CC) Blender Foundation | studio.blender.org, CC BY 4.0'); assert.equal(f.rating, 'All ages');
  const s = program(false)[1]; assert.deepEqual(s.ids, ['sing']); const st = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; assert.equal(new Date(st).getUTCMinutes(), 30);
  const c = showAt(st - 2000); assert.equal(c.phase, 'title'); assert.equal(c.id, 'sing'); const m = showAt(st + 2000); assert.equal(m.phase, 'movie'); assert.equal(m.id, 'sing'); assert.ok(/singularity\.mp4$/.test(m.reel.src));
  assert.equal(showAt(H + (s.o + s.end - COUNTDOWN + 1) * 1000).phase, 'end'); });
ok('Pepper&Carrot: eps 3-6 back to back (5 reels), 16:48, own 5:00 countdown', () => { const f = FILMS.pepper; assert.deepEqual(PEPPER_EPISODES.map((e) => e.n), [3, 4, 5, 6]); assert.equal(f.reels.length, 5); assert.ok(Math.abs(f.dur - 1008.215) < 0.01);
  const s = program(false)[0], st = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; const c = showAt(st - COUNTDOWN * 1000 + 500); assert.equal(c.phase, 'count'); assert.equal(c.id, 'pepper'); assert.ok(Math.abs(c.left - 299.5) < 0.01);
  assert.deepEqual([3, 4, 5, 6].map((n) => showAt(st + (f.reels.findIndex((r) => r.epN === n) >= 0 ? f.reels.filter((r, i) => i < f.reels.findIndex((q) => q.epN === n)).reduce((a, r) => a + r.dur, 0) + 2 : 0) * 1000).reel.epN), [3, 4, 5, 6]); });
ok('mid-movie join lands on the right reel + position (any second, both Pepper&Carrot showings)', () => { for (const si of [0, 3]) { const s = program(false)[si], st = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; const R = FILMS.pepper.reels; assert.deepEqual(s.ids, ['pepper']);
  for (let k = 0; k < 300; k++) { const ft = Math.random() * FILMS.pepper.dur, x = showAt(st + ft * 1000); let o = 0, i = 0; while (ft >= o + R[i].dur) o += R[i++].dur; assert.equal(x.reel, R[i]); assert.ok(Math.abs(x.epT - (ft - o)) < 1e-3); assert.ok(Math.abs(x.epLeft - (R[i].dur - (ft - o))) < 1e-3);
    const y = showAt(st + (o + R[i].dur - 5) * 1000); assert.equal(y.nextReel, R[i + 1] || null); } } });
ok('reel files are < 50 MB parts listed in order', () => { for (const id of ['pepper']) FILMS[id].reels.forEach((r, i) => { assert.equal(r.i, i); assert.ok(/\.mp4$/.test(r.src)); assert.equal(r.w, 1280); assert.equal(r.h, 720); assert.ok(statSync(fileURLToPath(r.src)).size < 50e6, r.src); }); });
ok('Sheriff off in the theater: one flag, family lineup for everyone, no Sheriff anywhere', () => { assert.equal(SHERIFF_IN_THEATER, false); assert.equal(familyOnly(false), true); assert.deepEqual(program(false), program(true));
  for (let t = H; t < H + 7200e3; t += 7e3) { const x = showAt(t); assert.notEqual(x.id, 'sheriff'); assert.ok(!x.ids.includes('sheriff') && !x.nextIds.includes('sheriff') && !/Sheriff/.test(x.title + x.nextTitle)); assert.ok(!(x.reel && /series\/sheriff/.test(x.reel.src))); assert.ok(!listings(t).some((e) => e.id === 'sheriff')); }
  const c = showAt(H - COUNTDOWN * 1000 + 1000); assert.equal(c.phase, 'count'); assert.equal(c.id, 'pepper'); assert.equal(c.title, 'Pepper&Carrot'); });
ok('kid program swaps only the Sheriff slot, same clock', () => { const a = program(false), k = program(true); assert.deepEqual(k[SHERIFF_SLOT].ids, ['bbb']); for (let i = 0; i < a.length; i++) if (i !== SHERIFF_SLOT) assert.deepEqual(k[i], a[i]); assert.deepEqual(a.map((s) => s.o), k.map((s) => s.o));
  for (let t = H; t < H + 7200e3; t += 7e3) { const x = showAt(t, 0, false, true); assert.notEqual(x.id, 'sheriff'); assert.ok(!listings(t, 0, false, true).some((e) => e.id === 'sheriff')); } });
ok('title card with credit before each film (Blender, Morevna)', () => { for (const s of program(false)) s.ids.forEach((id, j) => { if (!FILMS[id].credit) return; const st = H + (s.o + s.starts[j] - COUNTDOWN) * 1000; const x = showAt(st - (TC / 2) * 1000); assert.equal(x.phase, 'title'); assert.equal(x.id, id); assert.match(FILMS[id].credit, id === 'pepper' ? /^Pepper & Carrot Motion Comic by Morevna Project, based on Pepper&Carrot by David Revoy, CC BY-SA 4\.0$/ : /(©|\(CC\)) Blender Foundation \| studio\.blender\.org, CC BY/); }); });
ok('exact credit lines', () => {
  assert.equal(FILMS.pepper.credit, 'Pepper & Carrot Motion Comic by Morevna Project, based on Pepper&Carrot by David Revoy, CC BY-SA 4.0'); assert.equal(PEPPER_CREDIT, FILMS.pepper.credit); assert.equal(creditOf(['pepper']), PEPPER_CREDIT); assert.match(creditOf(['c2', 'c3', 'wing']), /^© Blender Foundation/); });
ok('board lists 3 future times per film', () => { for (let t = H; t < H + 7200e3; t += 60e3) { const L = listings(t); assert.equal(L.length, NS); for (const e of L) { assert.equal(e.times.length, 3); assert.ok(e.times[0] + e.film.dur * 1000 > t); } assert.ok(L.filter((e) => e.next).length <= 1); } });
ok('owner start-now anchor', () => { const now = H + 1234567; for (let k = 0; k < program().length; k++) { const a = anchorFor(k, now); const x = showAt(now + 100, a); assert.equal(x.phase, FILMS[program()[k].ids[0]].credit ? 'title' : 'count'); assert.ok(x.left < TC + 0.01); assert.equal(x.si, k); const c = showAt(now + 100, anchorFor(k, now, true)); assert.equal(c.phase, 'count'); assert.equal(c.si, k); } });
ok('off = nothing', () => { assert.equal(showAt(H, 0, true).phase, 'off'); assert.deepEqual(listings(H, 0, true), []); });
ok('titles', () => { assert.equal(slotTitle(['c2', 'c3']), 'Caminandes Double Feature'); assert.equal(slotTitle(['c2', 'c3', 'wing']), 'Cartoon Shorts Triple Feature'); assert.equal(slotTitle(['sing']), 'Singularity'); assert.equal(slotTitle(['pepper']), 'Pepper&Carrot'); });
console.log(`${n}/${n} passed`);
