// Theater showtimes: the schedule is pure clock math (no writes). Two-hour program. Checks it is deterministic, every film starts on a
// quarter hour with a 5:00 countdown before it, the kid program keeps the same clock, owner anchors still work, and
// with SHERIFF_IN_THEATER off nobody gets the Sheriff in the theater.
// usage: node tests/world/theater-schedule.test.mjs
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FILMS, PERIOD, COUNTDOWN, TC, SHERIFF_IN_THEATER, SHERIFF_SLOT, familyOnly, program, showAt, listings, anchorFor, slotTitle, slotPoster, creditOf } from '../../js/world/theater-movie.js';
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok', name); };
const H = Date.UTC(2026, 9, 27, 18, 0, 0); // an even UTC hour (program hour A) = a whole local hour in America/New_York
const NS = 6; // films on the board (with the flag on, the Sheriff replaces Big Buck Bunny in its slot)
ok('period is two hours', () => assert.equal(PERIOD, 7200));
ok('deterministic', () => { for (let i = 0; i < 500; i++) { const t = H + Math.floor(Math.random() * 86400e3); assert.deepEqual(showAt(t), showAt(t)); assert.deepEqual(listings(t), listings(t)); const a = showAt(t), b = showAt(t + 86400e3 * 7); assert.deepEqual([a.phase, a.id, a.si, Math.round(a.left * 1e3)], [b.phase, b.id, b.si, Math.round(b.left * 1e3)]); } });
ok('slots fit and do not overlap', () => { for (const kid of [false, true]) for (const s of program(kid)) assert.ok(s.end <= s.len, `slot ${s.i} ${s.end} > ${s.len}`); });
ok('every slot opens on a quarter hour with a 5:00 countdown', () => { for (const kid of [false, true]) program(kid).forEach((s, i) => {
  const filmAt = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; // regular schedule
  assert.equal(new Date(filmAt).getUTCMinutes() % 15, 0); assert.equal(new Date(filmAt).getUTCSeconds(), 0);
  const c = showAt(filmAt - COUNTDOWN * 1000 + 500, 0, false, kid); assert.equal(c.phase, 'count'); assert.ok(Math.abs(c.left - (COUNTDOWN - 0.5)) < 0.01, 'countdown ' + c.left);
  const m = showAt(filmAt + 1000, 0, false, kid); assert.equal(m.phase, 'movie'); assert.equal(m.id, s.ids[0]); }); });
ok('exact adult program', () => { const p = program(false).map((s) => s.ids.join('+')); assert.deepEqual(p, ['spring', 'sing+c2', SHERIFF_IN_THEATER ? 'sheriff' : 'bbb', 'c3+wing', 'bbb', 'spring', 'sing+c3', 'c2+wing']); });
ok('hourly clock: every quarter hour (A: Spring, Singularity+C2, BBB, C3+Wing It!; B: BBB, Spring, Singularity+C3, C2+Wing It!)', () => { const at = program(false).map((s) => (s.o + s.starts[0] - COUNTDOWN) / 60); assert.deepEqual(at, [0, 15, 30, 45, 60, 75, 90, 105]);
  assert.deepEqual(program(false).map((s) => s.len), Array(8).fill(900)); });
ok('no long dead gap: every slot ends within 4 min of the next countdown', () => { for (const s of program(false)) assert.ok(s.len - s.end < 240, `slot ${s.i} idle ${s.len - s.end}s`); });
ok('every film plays twice every 2 hours, nothing dropped', () => { const all = program(false).flatMap((s) => s.ids), ids = [...new Set(all)].sort(); assert.deepEqual(ids, ['bbb', 'c2', 'c3', 'sing', 'spring', 'wing']); for (const id of ids) assert.equal(all.filter((x) => x === id).length, 2, id);
  const k = [...new Set(program(true).flatMap((s) => s.ids))].sort(); assert.deepEqual(k, ids); });
ok('removed films are gone (no FILMS entry, no slot, no export)', () => { for (const id of ['ada', 'pepper']) { assert.ok(!(id in FILMS)); assert.ok(!program(false).some((s) => s.ids.includes(id))); } });
ok('Singularity: CC BY 4.0, Blender Studio credit, opens the :15 slot in hour A (then Caminandes 2 after an 8 s title card)', () => { const f = FILMS.sing; assert.equal(f.lic, 'CC BY 4.0'); assert.equal(f.credit, 'Singularity (CC) Blender Foundation | studio.blender.org, CC BY 4.0'); assert.equal(f.rating, 'All ages');
  const s = program(false)[1]; assert.deepEqual(s.ids, ['sing', 'c2']); const st = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; assert.equal(new Date(st).getUTCMinutes(), 15); assert.ok(Math.abs(s.starts[1] - s.starts[0] - (f.dur + TC)) < 1e-6);
  const c = showAt(st - 2000); assert.equal(c.phase, 'title'); assert.equal(c.id, 'sing'); const m = showAt(st + 2000); assert.equal(m.phase, 'movie'); assert.equal(m.id, 'sing'); assert.ok(/singularity\.mp4$/.test(m.reel.src));
  const t2 = showAt(st + (f.dur + TC / 2) * 1000); assert.equal(t2.phase, 'title'); assert.equal(t2.id, 'c2'); assert.equal(showAt(H + (s.o + s.end - COUNTDOWN + 1) * 1000).phase, 'end'); });
ok('mid-movie join lands on the right film + position (any second of the 2 hours)', () => { for (let k = 0; k < 2000; k++) { const t = H + Math.random() * 7200e3, x = showAt(t); if (x.phase !== 'movie') continue; assert.ok(Math.abs(x.epT - x.t) < 1e-3); assert.ok(x.epT >= 0 && x.epLeft > 0); assert.equal(x.nextReel, null); } });
ok('every film is one reel file < 50 MB with its poster on disk', () => { for (const id of ['bbb', 'spring', 'c2', 'c3', 'wing', 'sing']) { const f = FILMS[id]; assert.equal(f.reels.length, 1); for (const u of [f.reels[0].src, f.poster]) assert.ok(statSync(fileURLToPath(u)).size < 50e6, u); } });
ok('Sheriff off in the theater: one flag, family lineup for everyone, no Sheriff anywhere', () => { assert.equal(SHERIFF_IN_THEATER, false); assert.equal(familyOnly(false), true); assert.deepEqual(program(false), program(true));
  for (let t = H; t < H + 7200e3; t += 7e3) { const x = showAt(t); assert.notEqual(x.id, 'sheriff'); assert.ok(!x.ids.includes('sheriff') && !x.nextIds.includes('sheriff') && !/Sheriff/.test(x.title + x.nextTitle)); assert.ok(!(x.reel && /series\/sheriff/.test(x.reel.src))); assert.ok(!listings(t).some((e) => e.id === 'sheriff')); }
  const c = showAt(H - COUNTDOWN * 1000 + 1000); assert.equal(c.phase, 'count'); assert.equal(c.id, 'spring'); assert.equal(c.title, 'Spring'); });
ok('kid program swaps only the Sheriff slot, same clock', () => { const a = program(false), k = program(true); assert.deepEqual(k[SHERIFF_SLOT].ids, ['bbb']); for (let i = 0; i < a.length; i++) if (i !== SHERIFF_SLOT) assert.deepEqual(k[i], a[i]); assert.deepEqual(a.map((s) => s.o), k.map((s) => s.o));
  for (let t = H; t < H + 7200e3; t += 7e3) { const x = showAt(t, 0, false, true); assert.notEqual(x.id, 'sheriff'); assert.ok(!listings(t, 0, false, true).some((e) => e.id === 'sheriff')); } });
ok('title card with credit before each film (Blender)', () => { for (const s of program(false)) s.ids.forEach((id, j) => { if (!FILMS[id].credit) return; const st = H + (s.o + s.starts[j] - COUNTDOWN) * 1000; const x = showAt(st - (TC / 2) * 1000); assert.equal(x.phase, 'title'); assert.equal(x.id, id); assert.match(FILMS[id].credit, /(©|\(CC\)) Blender Foundation \| studio\.blender\.org, CC BY/); }); });
ok('exact credit lines', () => {
  for (const f of Object.values(FILMS)) assert.ok(!/Morevna|Revoy|BY-SA/.test(f.credit || ''), f.id); assert.equal(creditOf(['sing', 'c2']), '© Blender Foundation | studio.blender.org, CC BY'); assert.match(creditOf(['c3', 'wing']), /^© Blender Foundation/); });
ok('board lists 3 future times per film', () => { for (let t = H; t < H + 7200e3; t += 60e3) { const L = listings(t); assert.equal(L.length, NS); for (const e of L) { assert.equal(e.times.length, 3); assert.ok(e.times[0] + e.film.dur * 1000 > t); } assert.ok(L.filter((e) => e.next).length <= 1); } });
ok('owner start-now anchor', () => { const now = H + 1234567; for (let k = 0; k < program().length; k++) { const a = anchorFor(k, now); const x = showAt(now + 100, a); assert.equal(x.phase, FILMS[program()[k].ids[0]].credit ? 'title' : 'count'); assert.ok(x.left < TC + 0.01); assert.equal(x.si, k); const c = showAt(now + 100, anchorFor(k, now, true)); assert.equal(c.phase, 'count'); assert.equal(c.si, k); } });
ok('off = nothing', () => { assert.equal(showAt(H, 0, true).phase, 'off'); assert.deepEqual(listings(H, 0, true), []); });
ok('titles + posters', () => { assert.equal(slotTitle(['c2', 'c3']), 'Caminandes Double Feature'); assert.equal(slotTitle(['sing']), 'Singularity'); assert.equal(slotTitle(['c3', 'wing']), 'Caminandes 3: Llamigos + Wing It!'); assert.equal(slotPoster(['c2', 'wing']), FILMS.c2.poster); assert.equal(slotPoster(['c2', 'c3']).split('/').pop(), 'caminandes-double.webp'); });
console.log(`${n}/${n} passed`);
