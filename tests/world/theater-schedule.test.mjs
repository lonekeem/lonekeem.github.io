// Theater showtimes: the schedule is pure clock math (no writes). Checks it is deterministic, every film starts on a
// quarter hour with a 5:00 countdown before it, the kid program keeps the same clock, owner anchors still work, and
// with SHERIFF_IN_THEATER off nobody gets the Sheriff in the theater.
// usage: node tests/world/theater-schedule.test.mjs
import assert from 'node:assert/strict';
import { FILMS, PERIOD, COUNTDOWN, TC, SHERIFF_IN_THEATER, familyOnly, program, showAt, listings, anchorFor, slotTitle } from '../../js/world/theater-movie.js';
let n = 0; const ok = (name, f) => { f(); n++; console.log('ok', name); };
const H = Date.UTC(2026, 9, 27, 18, 0, 0); // a whole UTC hour = a whole local hour in America/New_York
ok('period is one hour', () => assert.equal(PERIOD, 3600));
ok('deterministic', () => { for (let i = 0; i < 500; i++) { const t = H + Math.floor(Math.random() * 86400e3); assert.deepEqual(showAt(t), showAt(t)); assert.deepEqual(listings(t), listings(t)); const a = showAt(t), b = showAt(t + 86400e3 * 7); assert.deepEqual([a.phase, a.id, a.si, Math.round(a.left * 1e3)], [b.phase, b.id, b.si, Math.round(b.left * 1e3)]); } });
ok('slots fit and do not overlap', () => { for (const kid of [false, true]) for (const s of program(kid)) assert.ok(s.end <= s.len, `slot ${s.i} ${s.end} > ${s.len}`); });
ok('every slot opens on a quarter hour with a 5:00 countdown', () => { for (const kid of [false, true]) program(kid).forEach((s, i) => {
  const filmAt = H + (s.o + s.starts[0] - COUNTDOWN) * 1000; // regular schedule
  assert.equal(new Date(filmAt).getUTCMinutes() % 15, 0); assert.equal(new Date(filmAt).getUTCSeconds(), 0);
  const c = showAt(filmAt - COUNTDOWN * 1000 + 500, 0, false, kid); assert.equal(c.phase, 'count'); assert.ok(Math.abs(c.left - (COUNTDOWN - 0.5)) < 0.01, 'countdown ' + c.left);
  const m = showAt(filmAt + 1000, 0, false, kid); assert.equal(m.phase, 'movie'); assert.equal(m.id, s.ids[0]); }); });
ok('exact adult program', () => { const p = program(false).map((s) => s.ids.join('+')); assert.deepEqual(p, SHERIFF_IN_THEATER ? ['sheriff', 'bbb', 'spring', 'sing'] : ['c2+c3+wing', 'bbb', 'spring', 'sing']); });
ok('Sheriff off in the theater: one flag, family lineup for everyone, no Sheriff anywhere', () => { assert.equal(SHERIFF_IN_THEATER, false); assert.equal(familyOnly(false), true); assert.deepEqual(program(false), program(true));
  for (let t = H; t < H + 3600e3; t += 7e3) { const x = showAt(t); assert.notEqual(x.id, 'sheriff'); assert.ok(!x.ids.includes('sheriff') && !x.nextIds.includes('sheriff') && !/Sheriff/.test(x.title + x.nextTitle)); assert.ok(!(x.reel && /series\/sheriff/.test(x.reel.src))); assert.ok(!listings(t).some((e) => e.id === 'sheriff')); }
  const c = showAt(H - COUNTDOWN * 1000 + 1000); assert.equal(c.phase, 'count'); assert.equal(c.id, 'c2'); assert.equal(c.title, 'Cartoon Shorts Triple Feature'); });
ok('kid program swaps only the Sheriff slot, same clock', () => { const a = program(false), k = program(true); assert.deepEqual(k[0].ids, ['c2', 'c3', 'wing']); for (let i = 1; i < 4; i++) assert.deepEqual(k[i], a[i]); assert.deepEqual(a.map((s) => s.o), k.map((s) => s.o));
  for (let t = H; t < H + 3600e3; t += 7e3) { const x = showAt(t, 0, false, true); assert.notEqual(x.id, 'sheriff'); assert.ok(!listings(t, 0, false, true).some((e) => e.id === 'sheriff')); } });
ok('title card with credit before each Blender film', () => { for (const s of program(false)) s.ids.forEach((id, j) => { if (!FILMS[id].credit) return; const st = H + (s.o + s.starts[j] - COUNTDOWN) * 1000; const x = showAt(st - (TC / 2) * 1000); assert.equal(x.phase, 'title'); assert.equal(x.id, id); assert.match(FILMS[id].credit, /(©|\(CC\)) Blender Foundation \| studio\.blender\.org, CC BY/); }); });
ok('board lists 3 future times per film', () => { for (let t = H; t < H + 3600e3; t += 60e3) { const L = listings(t); assert.equal(L.length, SHERIFF_IN_THEATER ? 4 : 6); for (const e of L) { assert.equal(e.times.length, 3); assert.ok(e.times[0] + e.film.dur * 1000 > t); } assert.ok(L.filter((e) => e.next).length <= 1); } });
ok('owner start-now anchor', () => { const now = H + 1234567; for (let k = 0; k < 4; k++) { const a = anchorFor(k, now); const x = showAt(now + 100, a); assert.equal(x.phase, FILMS[program()[k].ids[0]].credit ? 'title' : 'count'); assert.ok(x.left < TC + 0.01); assert.equal(x.si, k); const c = showAt(now + 100, anchorFor(k, now, true)); assert.equal(c.phase, 'count'); assert.equal(c.si, k); } });
ok('off = nothing', () => { assert.equal(showAt(H, 0, true).phase, 'off'); assert.deepEqual(listings(H, 0, true), []); });
ok('Singularity: CC BY 4.0, Blender Studio credit, starts at :45', () => { const f = FILMS.sing; assert.equal(f.lic, 'CC BY 4.0'); assert.equal(f.credit, 'Singularity (CC) Blender Foundation | studio.blender.org, CC BY 4.0'); assert.equal(f.rating, 'All ages');
  const s = program(false)[3]; assert.deepEqual(s.ids, ['sing']); assert.equal(new Date(H + (s.o + s.starts[0] - COUNTDOWN) * 1000).getUTCMinutes(), 45); });
ok('titles', () => { assert.equal(slotTitle(['c2', 'c3']), 'Caminandes Double Feature'); assert.equal(slotTitle(['c2', 'c3', 'wing']), 'Cartoon Shorts Triple Feature'); });
console.log(`${n}/${n} passed`);
