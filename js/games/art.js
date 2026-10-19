// Original Games art: custom controller icon (same rounded-stroke + spark style as js/icons.js)
// and small SVG covers for each game.
const A = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
export const CONTROLLER = `<svg class="ki ki-games" ${A}><path d="M7.2 7.6h9.6a4.4 4.4 0 0 1 4.3 3.6l.7 4.1a2.7 2.7 0 0 1-4.7 2.3l-1.9-2.1H8.8l-1.9 2.1a2.7 2.7 0 0 1-4.7-2.3l.7-4.1a4.4 4.4 0 0 1 4.3-3.6z"/><path d="M7.6 10.4v3M6.1 11.9h3"/><path class="kf" d="M16 9.9l.62 1.35 1.35.62-1.35.62L16 13.84l-.62-1.35-1.35-.62 1.35-.62z"/><path class="ks" d="M12 2.4l.5 1.1 1.1.5-1.1.5-.5 1.1-.5-1.1-1.1-.5 1.1-.5z"/></svg>`;
export const STAR = (cls = '') => `<svg class="gstar ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7l2.83 5.74 6.33.92-4.58 4.47 1.08 6.3L12 17.15l-5.66 2.98 1.08-6.3-4.58-4.47 6.33-.92z"/></svg>`;
const gstar = (x, y, r, fill) => {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
};
const frame = (inner) => `<svg viewBox="0 0 120 80" class="gcover" aria-hidden="true"><defs>
  <linearGradient id="gc-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a0f4d"/><stop offset="1" stop-color="#0b0614"/></linearGradient>
  <linearGradient id="gc-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4b3ff"/><stop offset="1" stop-color="#8a2be2"/></linearGradient>
  <linearGradient id="gc-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b3"/><stop offset="1" stop-color="#f2a900"/></linearGradient></defs>
  <rect width="120" height="80" rx="14" fill="url(#gc-bg)"/>${inner}</svg>`;
export const COVERS = {
  stardrop: frame((() => {
    let s = '<rect x="22" y="10" width="76" height="62" rx="10" fill="#1a0b33" stroke="url(#gc-p)" stroke-width="2"/>';
    const fills = ['', '', 'g', 'p', '', '', 'p', 'g', 'g', 'p', '', 'p', 'g', 'p', 'g', 'g', 'p', 'p', 'g', 'p'];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const f = fills[r * 5 + c], x = 33 + c * 13.5, y = 22 + r * 13.5;
      s += f ? gstar(x, y, 6, f === 'g' ? 'url(#gc-g)' : 'url(#gc-p)') : `<circle cx="${x}" cy="${y}" r="4.6" fill="#0b0614"/>`;
    }
    return s;
  })()),
  klgrid: frame(`<path d="M47 14v52M73 14v52M34 33h52M34 53h52" stroke="url(#gc-p)" stroke-width="3" stroke-linecap="round"/>
    <text x="40.5" y="29" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="14" fill="url(#gc-g)" text-anchor="middle">K</text>
    <text x="60" y="48" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="14" fill="#c9a6ff" text-anchor="middle">L</text>
    <text x="79.5" y="68" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="14" fill="url(#gc-g)" text-anchor="middle">K</text>
    <text x="40.5" y="68" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="14" fill="#c9a6ff" text-anchor="middle">L</text>`),
  checkers: frame((() => {
    let s = '';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) s += `<rect x="${24 + c * 9}" y="${17 + r * 9}" width="9" height="9" fill="${(r + c) % 2 ? '#5a1fa6' : '#0d0717'}"/>`;
    s += '<rect x="24" y="17" width="72" height="45" rx="2" fill="none" stroke="url(#gc-p)" stroke-width="1.5"/>';
    [[1, 0], [3, 0], [5, 1], [2, 3], [6, 4]].forEach(([c, r], i) => { s += `<circle cx="${28.5 + c * 9}" cy="${21.5 + r * 9}" r="3.6" fill="${i < 3 ? '#1c1c1c' : 'url(#gc-g)'}" stroke="${i < 3 ? '#b57bff' : '#fff3c4'}" stroke-width="1"/>`; });
    return s;
  })()),
  trivia: frame(`<path d="M30 18h60a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H58l-12 10v-10H30a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z" fill="#1a0b33" stroke="url(#gc-p)" stroke-width="2"/>
    <text x="60" y="48" font-family="Space Grotesk,sans-serif" font-weight="700" font-size="26" fill="url(#gc-g)" text-anchor="middle">?</text>
    ${gstar(88, 16, 7, 'url(#gc-g)')}${gstar(26, 62, 4, '#c9a6ff')}`),
  starcards: frame(`<g transform="translate(60 46)">
    <g transform="rotate(-22) translate(-13 -24)"><rect width="26" height="38" rx="5" fill="#2bb5a8" stroke="#fff" stroke-width="1.5"/>${gstar(13, 19, 7, '#fff')}</g>
    <g transform="rotate(-7) translate(-13 -26)"><rect width="26" height="38" rx="5" fill="#e2558f" stroke="#fff" stroke-width="1.5"/>${gstar(13, 19, 7, '#fff')}</g>
    <g transform="rotate(8) translate(-13 -26)"><rect width="26" height="38" rx="5" fill="#f2b31b" stroke="#fff" stroke-width="1.5"/>${gstar(13, 19, 7, '#fff')}</g>
    <g transform="rotate(23) translate(-13 -24)"><rect width="26" height="38" rx="5" fill="#8a2be2" stroke="#fff" stroke-width="1.5"/>${gstar(13, 19, 7, 'url(#gc-g)')}</g></g>`)
};
export const GAMES = [
  { id: 'stardrop', name: 'Star Drop', blurb: 'Drop gold and purple stars. Four in a row wins.', players: '2 players' },
  { id: 'starcards', name: 'Star Cards', blurb: 'Shed your hand first. Shout LAST STAR! at one card.', players: '2-6 players' },
  { id: 'trivia', name: 'Studio Trivia', blurb: 'Fast party quiz: music, movies and more.', players: '2-8 players' },
  { id: 'klgrid', name: 'KL Grid', blurb: 'K vs L on a 3x3 grid, or go Ultimate 9x9.', players: '2 players' },
  { id: 'checkers', name: 'Checkers', blurb: 'Jump, crown and clear the purple board.', players: '2 players' }
];
export const gameName = (id) => (GAMES.find((g) => g.id === id) || { name: 'Game' }).name;
