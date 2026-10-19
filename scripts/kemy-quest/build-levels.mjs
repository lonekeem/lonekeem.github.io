// Builds assets/kemy-quest/levels.json from the hand-placed layouts below.
// Run: node scripts/kemy-quest/build-levels.mjs
import { writeFileSync } from 'node:fs';
const H = 15;
function L(id, name, theme, w, music) {
  const g = Array.from({ length: H }, () => Array(w).fill('.'));
  const ents = []; let bigN = 0;
  const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < H) g[y][x] = c; };
  const api = {
    G(x0, x1, top, c = '#') { for (let x = x0; x <= x1; x++) for (let y = top; y < H; y++) set(x, y, c); return api; },
    B(x0, y0, x1, y1, c = 'X') { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set(x, y, c); return api; },
    clear(x0, y0, x1, y1) { return api.B(x0, y0, x1, y1, '.'); },
    P(x0, x1, y) { for (let x = x0; x <= x1; x++) set(x, y, '='); return api; },
    spikes(x0, x1, y) { for (let x = x0; x <= x1; x++) set(x, y, '^'); return api; },
    spring(x, y) { set(x, y, 'S'); return api; },
    W(x0, y0, x1, y1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (g[y][x] === '.') set(x, y, '~'); return api; },
    e(t, x, y, o = {}) { ents.push({ t, x, y, ...o }); return api; },
    stars(x0, x1, y, step = 1) { for (let x = x0; x <= x1; x += step) ents.push({ t: 'star', x, y }); return api; },
    arc(x0, y0, n = 5) { const ys = [0, -1, -2, -1, 0, 1, 2]; for (let i = 0; i < n; i++) ents.push({ t: 'star', x: x0 + i, y: y0 + ys[i] }); return api; },
    col(x, y0, y1) { for (let y = y0; y <= y1; y++) ents.push({ t: 'star', x, y }); return api; },
    big(x, y) { ents.push({ t: 'big', x, y, id: bigN++ }); return api; },
    start(x, y) { api._start = [x, y]; return api; },
    done() { if (bigN !== 3) throw new Error(id + ' needs 3 big stars'); return { id, name, theme, music, start: api._start, tiles: g.map((r) => r.join('')), ents }; }
  };
  return api;
}
const levels = [];
// ---------------------------------------------------------------- 1-1 Lily Pond
levels.push(L('1-1', 'Morning Ripples', 'pond', 180, 0)
  .G(0, 30, 12).start(2, 11).e('power', 8, 10).stars(4, 7, 10)
  .B(14, 11, 15, 11, '#').B(18, 10, 19, 11, '#').stars(18, 19, 8)
  .e('snail', 24, 11).P(26, 29, 9).stars(26, 29, 8)
  .G(34, 60, 12).arc(30, 9, 5)
  .spring(38, 11).col(38, 4, 7).P(40, 44, 3).big(43, 2)
  .e('snail', 46, 11).e('snail', 53, 11).stars(47, 52, 10).e('check', 57, 11)
  .G(61, 72, 14).W(61, 12, 72, 13).G(73, 112, 12).W(73, 13, 77, 13).big(77, 13).stars(63, 70, 13, 2)
  .e('urchin', 82, 11).arc(80, 9, 5)
  .B(88, 8, 92, 8, 'X').stars(88, 92, 7).e('snail', 90, 11)
  .clear(97, 12, 99, 14).arc(96, 9, 5).e('frog', 105, 11)
  .G(113, 180, 12).B(112, 11, 113, 11, '#').B(114, 10, 115, 11, '#').B(116, 9, 125, 11, '#').e('heart', 121, 7).stars(117, 124, 8, 2)
  .spikes(129, 131, 11).arc(128, 8, 5).e('check', 135, 11)
  .P(139, 142, 9).P(143, 146, 6).P(147, 149, 4).big(148, 3).stars(139, 145, 5, 2)
  .e('snail', 152, 11).e('snail', 158, 11).stars(160, 168, 10, 2).e('goal', 172, 11)
  .done());
// ---------------------------------------------------------------- 1-2 Lily Pond
levels.push(L('1-2', 'Lily Hop', 'pond', 190, 0)
  .G(0, 20, 10).start(2, 9).e('power', 6, 8).stars(9, 15, 8, 2)
  .G(21, 60, 14).W(21, 10, 60, 13).e('plat', 23, 9, { len: 3, r: 7, sp: 0.006 }).e('puffer', 33, 12, { r: 7 }).stars(24, 44, 12, 2)
  .B(54, 10, 60, 11, 'X').W(54, 12, 60, 13).big(59, 13).stars(46, 52, 9, 2)
  .G(61, 100, 10).e('frog', 67, 9).e('frog', 76, 9).P(70, 73, 7).stars(70, 73, 6)
  .e('urchin', 80, 9).spring(85, 9).P(83, 88, 1).stars(83, 88, 0).big(87, 0)
  .clear(90, 10, 93, 14).e('plat', 89, 9, { len: 2, r: 3, sp: 0.01 }).G(94, 130, 10).e('check', 96, 9)
  .e('snail', 104, 9).e('snail', 113, 9).e('heart', 109, 7).arc(117, 7, 5)
  .G(131, 165, 14).clear(131, 10, 165, 13).W(131, 10, 165, 13).e('puffer', 137, 11, { r: 5 }).e('puffer', 150, 12, { r: 6 }).stars(133, 163, 11, 3)
  .e('plat', 133, 9, { len: 3, r: 10, sp: 0.005 })
  .G(166, 190, 10).spring(170, 9).P(172, 176, 2).big(175, 1).stars(178, 181, 8).e('goal', 184, 9)
  .done());
// ---------------------------------------------------------------- 2-1 Crystal Caves
levels.push(L('2-1', 'Glimmer Tunnels', 'cave', 190, 1)
  .G(0, 190, 12).B(0, 0, 189, 1).start(2, 11).e('power', 5, 11).stars(7, 11, 10)
  .B(14, 2, 30, 7).e('snail', 22, 11).stars(15, 29, 10, 2)
  .spikes(34, 36, 11).arc(33, 9, 5)
  .clear(40, 12, 43, 14).arc(39, 9, 5)
  .clear(47, 12, 52, 14).P(47, 52, 14).big(50, 13).e('vplat', 48, 11, { len: 3, r: 5, sp: 0.008 }).B(53, 7, 60, 11).stars(54, 59, 6)
  .e('urchin', 65, 11).e('snail', 71, 11).stars(62, 70, 10, 2)
  .P(74, 77, 9).P(78, 81, 6).P(82, 85, 3).big(84, 2).stars(78, 81, 5)
  .e('check', 90, 11).spikes(96, 97, 11).B(100, 2, 110, 6).spikes(103, 105, 11).stars(100, 110, 9, 2).e('frog', 115, 11)
  .spring(124, 11).B(126, 4, 129, 11).col(124, 5, 8).stars(126, 129, 3)
  .e('snail', 134, 11).e('snail', 140, 11).e('heart', 138, 9)
  .clear(146, 12, 154, 14).e('plat', 145, 10, { len: 3, r: 7, sp: 0.006 }).stars(147, 153, 8, 2)
  .e('check', 159, 11).P(168, 170, 9).P(171, 173, 6).big(172, 5).e('urchin', 176, 11).stars(162, 166, 10).e('goal', 183, 11)
  .done());
// ---------------------------------------------------------------- 2-2 Crystal Caves
levels.push(L('2-2', 'Echo Drop', 'cave', 200, 1)
  .G(0, 12, 12).B(0, 0, 199, 0).start(2, 11).e('power', 5, 11).spring(11, 11).col(11, 6, 9)
  .G(13, 22, 5, 'X').e('frog', 18, 4).stars(14, 21, 3, 2)
  .e('plat', 23, 6, { len: 2, r: 3, sp: 0.01 }).G(28, 40, 6, 'X').e('urchin', 34, 5).stars(29, 39, 4, 2)
  .P(41, 44, 4).big(43, 3)
  .G(41, 60, 12).e('snail', 46, 11).e('snail', 54, 11).stars(45, 56, 10, 2).e('check', 58, 11)
  .G(61, 65, 12).e('vplat', 62, 11, { len: 3, r: 8, sp: 0.006 }).G(66, 72, 3, 'X').stars(66, 72, 2)
  .G(73, 100, 12).spikes(80, 82, 11).arc(79, 8, 5).e('frog', 88, 11).e('urchin', 94, 11)
  .P(95, 97, 9).P(98, 100, 6).big(99, 5)
  .G(104, 106, 10).e('plat', 107, 10, { len: 2, r: 3, sp: 0.01 }).stars(103, 107, 8)
  .G(112, 200, 12).e('check', 114, 11).e('snail', 120, 11).e('snail', 127, 11).e('frog', 133, 11).e('heart', 124, 9)
  .spring(140, 11).B(142, 4, 146, 11).col(140, 5, 8).big(144, 2)
  .e('urchin', 155, 11).spikes(160, 161, 11).arc(159, 8, 4).e('urchin', 166, 11).stars(170, 186, 10, 2).e('goal', 190, 11)
  .done());
// ---------------------------------------------------------------- 3-1 Neon Reef (swim)
levels.push(L('3-1', 'Coral Glow', 'reef', 180, 2)
  .G(0, 8, 3).start(2, 2).G(9, 167, 14).W(9, 3, 167, 13)
  .B(12, 9, 16, 10).big(14, 13).stars(10, 18, 6, 2)
  .B(20, 9, 22, 13).e('urchin', 21, 8).e('puffer', 25, 7, { r: 5 })
  .B(30, 3, 32, 7).stars(30, 32, 10).B(40, 8, 41, 13).e('puffer', 45, 5, { r: 6 }).stars(43, 53, 9, 2)
  .e('puffer', 58, 10, { r: 5 }).e('check', 70, 13).stars(60, 76, 6, 2)
  .e('puffer', 78, 6, { r: 7 }).B(83, 9, 88, 11).big(86, 13)
  .B(92, 3, 110, 7).B(92, 11, 110, 13).e('urchin', 101, 10).stars(93, 109, 9, 2)
  .e('puffer', 113, 9, { r: 5 }).e('check', 120, 13).e('heart', 124, 6)
  .B(128, 3, 129, 9).B(134, 7, 135, 13).e('puffer', 140, 7, { r: 6 }).big(150, 1).stars(140, 160, 5, 2)
  .G(168, 180, 3).e('goal', 175, 2)
  .done());
// ---------------------------------------------------------------- 3-2 Neon Reef
levels.push(L('3-2', 'Deep Lights', 'reef', 200, 2)
  .G(0, 30, 8).start(2, 7).e('power', 4, 7).e('snail', 14, 7).e('urchin', 22, 7).stars(8, 28, 6, 3)
  .G(31, 62, 14).W(31, 8, 62, 13).e('puffer', 37, 10, { r: 6 }).e('puffer', 47, 12, { r: 4 }).e('urchin', 45, 13).big(33, 13)
  .B(55, 8, 56, 11).stars(36, 60, 10, 3)
  .G(63, 90, 8).e('check', 65, 7).e('frog', 72, 7).spikes(76, 78, 7).arc(75, 4, 5).P(80, 83, 4).stars(80, 83, 3)
  .e('plat', 91, 7, { len: 2, r: 4, sp: 0.01 }).G(97, 120, 8).e('snail', 104, 7).e('urchin', 110, 7)
  .spring(114, 7).P(115, 119, 1).big(118, 0).col(114, 2, 5)
  .G(121, 160, 14).W(121, 8, 160, 13).B(130, 8, 150, 10).e('puffer', 133, 12, { r: 5 }).e('puffer', 146, 11, { r: 2 }).stars(123, 158, 12, 3)
  .G(161, 200, 8).e('check', 163, 7).e('frog', 170, 7).e('frog', 178, 7).e('urchin', 184, 7).P(193, 197, 4).big(195, 3).e('heart', 168, 5).e('goal', 190, 7)
  .done());
writeFileSync(new URL('../../assets/kemy-quest/levels.json', import.meta.url), JSON.stringify({ version: 1, levels }));
console.log('levels:', levels.map((l) => `${l.id} ${l.tiles[0].length}x${l.tiles.length} ents=${l.ents.length}`).join(', '));
