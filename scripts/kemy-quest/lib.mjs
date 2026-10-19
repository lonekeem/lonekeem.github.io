// Level-building helpers shared by scripts/kemy-quest/worlds/*.mjs. Every level is placed by hand with these.
export function L(id, name, theme, w, music, H = 15) {
  const g = Array.from({ length: H }, () => Array(w).fill('.'));
  const ents = []; let bigN = 0; const props = {};
  const set = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < H) g[y][x] = c; };
  const api = {
    H,
    G(x0, x1, top, c = '#') { for (let x = x0; x <= x1; x++) for (let y = top; y < H; y++) set(x, y, c); return api; },
    B(x0, y0, x1, y1, c = 'X') { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set(x, y, c); return api; },
    clear(x0, y0, x1, y1) { return api.B(x0, y0, x1, y1, '.'); },
    row(x0, x1, y, c) { for (let x = x0; x <= x1; x++) set(x, y, c); return api; },
    P(x0, x1, y) { return api.row(x0, x1, y, '='); },
    spikes(x0, x1, y) { return api.row(x0, x1, y, '^'); },
    spring(x, y) { set(x, y, 'S'); return api; },
    ice(x0, x1, y) { return api.row(x0, x1, y, 'I'); },
    IG(x0, x1, top) { api.G(x0, x1, top); return api.ice(x0, x1, top); },
    MG(x0, x1, top) { api.G(x0, x1, top); return api.mush(x0, x1, top); },
    mush(x0, x1, y) { return api.row(x0, x1, y, 'M'); },
    belt(x0, x1, y, dir) { return api.row(x0, x1, y, dir > 0 ? '>' : '<'); },
    crumb(x0, x1, y) { return api.row(x0, x1, y, 'C'); },
    swA(x0, x1, y, y1 = y) { return api.B(x0, y, x1, y1, 'A'); },
    swB(x0, x1, y, y1 = y) { return api.B(x0, y, x1, y1, 'B'); },
    gate(x, y0, y1) { return api.B(x, y0, x, y1, 'D'); },
    lava(x0, x1, top) { for (let x = x0; x <= x1; x++) for (let y = top; y < H; y++) set(x, y, 'L'); return api; },
    W(x0, y0, x1, y1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (g[y] && g[y][x] === '.') set(x, y, '~'); return api; },
    e(t, x, y, o = {}) { ents.push({ t, x, y, ...o }); return api; },
    wind(x, y, ww, hh, o) { ents.push({ t: 'wind', x, y, w: ww, h: hh, ...o }); return api; },
    boss(k, x, y, a0, a1, o = {}) { ents.push({ t: 'boss', k, x, y, a0, a1, ...o }); return api; },
    stars(x0, x1, y, step = 1) { for (let x = x0; x <= x1; x += step) ents.push({ t: 'star', x, y }); return api; },
    arc(x0, y0, n = 5) { const ys = [0, -1, -2, -1, 0, 1, 2]; for (let i = 0; i < n; i++) ents.push({ t: 'star', x: x0 + i, y: y0 + ys[i] }); return api; },
    col(x, y0, y1) { for (let y = y0; y <= y1; y++) ents.push({ t: 'star', x, y }); return api; },
    big(x, y) { ents.push({ t: 'big', x, y, id: bigN++ }); return api; },
    start(x, y) { api._start = [x, y]; return api; },
    prop(o) { Object.assign(props, o); return api; },
    done() {
      if (bigN !== 3) console.error('!! ' + id + ' has ' + bigN + ' big stars');
      const n = ents.filter((e) => e.t === 'star').length; if (n > 80) throw new Error(id + ' has more than 80 stars');
      return { id, name, theme, music, start: api._start, ...props, tiles: g.map((r) => r.join('')), ents };
    }
  };
  return api;
}
