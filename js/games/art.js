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
COVERS.pool = frame(`<rect x="20" y="14" width="80" height="52" rx="8" fill="url(#gc-g)"/><rect x="25" y="19" width="70" height="42" rx="4" fill="#3d1580"/>
    ${[[25, 19], [60, 18], [95, 19], [25, 61], [60, 62], [95, 61]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#05020a"/>`).join('')}
    <circle cx="70" cy="40" r="5" fill="#f2b31b"/><circle cx="78.5" cy="35" r="5" fill="#e2558f"/><circle cx="78.5" cy="45" r="5" fill="#fff"/><path d="M73.5 45h10" stroke="#2bb5a8" stroke-width="3.4"/>
    <circle cx="86" cy="40" r="5" fill="#0d0a14"/>${gstar(86, 40, 3, '#ffc83d')}<circle cx="40" cy="40" r="5" fill="#f7f3ff"/>
    <path d="M34 40H8" stroke="url(#gc-p)" stroke-width="3" stroke-linecap="round"/><path d="M46 40h16" stroke="#fff" stroke-width="1" stroke-dasharray="2 2" opacity=".7"/>`);
COVERS.chess = frame(`${(() => { let s = ''; for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) s += `<rect x="${33 + c * 9}" y="${22 + r * 9}" width="9" height="9" fill="${(r + c) % 2 ? '#5a1fa6' : '#2a0f4d'}"/>`; return s; })()}
    <rect x="33" y="22" width="54" height="36" fill="none" stroke="url(#gc-p)" stroke-width="1.5" rx="2"/>
    <path d="M52 50c0-6 1.8-8.4 5-11-2.3.2-4.2 1.2-5.8 2.8l-2-1.9c.3-4 2.9-8.1 6.5-10.5l-.6-3.5 3.2 1.9c5.8 0 10 4.8 10 12.1V50z" fill="url(#gc-g)" stroke="#fff3c4" stroke-width=".8"/>
    <path d="M73 31l1.2 2.5 2.7.3-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.3z" fill="#c9a6ff"/><path d="M73 40c3.6 0 6.5 2 7.6 5.2l1.7-1c1 1.7.6 4.3-1.1 6.5L80 53H66l-1.2-2.3c-1.7-2.2-2.1-4.8-1.1-6.5l1.7 1c1.1-3.2 4-5.2 7.6-5.2z" fill="#3b1670" stroke="#c9a6ff" stroke-width="1"/>`);
COVERS.ludo = frame(`<g transform="translate(36 16)">
    <rect width="20" height="20" rx="5" fill="#8a2be2"/><rect x="28" width="20" height="20" rx="5" fill="#f2b31b"/><rect x="28" y="28" width="20" height="20" rx="5" fill="#2bb5a8"/><rect y="28" width="20" height="20" rx="5" fill="#e2558f"/>
    <rect x="20" y="0" width="8" height="48" fill="#1a0b33"/><rect x="0" y="20" width="48" height="8" fill="#1a0b33"/>
    <polygon points="20,20 28,20 24,24" fill="#f2b31b"/><polygon points="28,20 28,28 24,24" fill="#2bb5a8"/><polygon points="28,28 20,28 24,24" fill="#e2558f"/><polygon points="20,28 20,20 24,24" fill="#8a2be2"/>
    <circle cx="10" cy="10" r="4.5" fill="#fff"/><circle cx="38" cy="38" r="4.5" fill="#fff"/></g>
    <g transform="translate(90 52) rotate(14)"><rect x="-9" y="-9" width="18" height="18" rx="4.5" fill="#fff3c4" stroke="url(#gc-g)" stroke-width="1.5"/><circle cx="-4" cy="-4" r="1.8" fill="#2a0f4d"/><circle cx="4" cy="4" r="1.8" fill="#2a0f4d"/><circle cx="0" cy="0" r="1.8" fill="#2a0f4d"/></g>`);
COVERS.rush = frame(`<path d="M0 62C22 50 36 44 58 50s40 2 62-12V80H0z" fill="#5a1fa6"/><path d="M0 62C22 50 36 44 58 50s40 2 62-12" fill="none" stroke="url(#gc-g)" stroke-width="2.4"/>
    <g transform="translate(60 40) rotate(-12)"><rect x="-17" y="-8" width="34" height="11" rx="4.5" fill="#2bb5a8" stroke="#fff" stroke-width="1.2"/><path d="M-9-8l3-9h12l5 9z" fill="#c9a6ff" stroke="#fff" stroke-width="1.2"/>
    <circle cx="0" cy="-12" r="3.6" fill="#fff3c4"/><circle cx="-10" cy="4" r="5.6" fill="#1a0b33" stroke="#c9a6ff" stroke-width="1.6"/><circle cx="10" cy="4" r="5.6" fill="#1a0b33" stroke="#c9a6ff" stroke-width="1.6"/></g>
    ${gstar(26, 26, 6, 'url(#gc-g)')}${gstar(92, 18, 5, '#ffc83d')}<path d="M100 30l4 4-4 5-4-5z" fill="#7fe3ff" stroke="#fff" stroke-width=".8"/>`);
export const GAMES = [
  { id: 'stardrop', name: 'Star Drop', blurb: 'Drop gold and purple stars. Four in a row wins.', players: '2 players' },
  { id: 'starcards', name: 'Star Cards', blurb: 'Shed your hand first. Shout LAST STAR! at one card.', players: '2-6 players' },
  { id: 'pool', name: 'Star Pool', blurb: 'Gold rails, purple felt. Sink your group, then call the 8.', players: '2 players' },
  { id: 'chess', name: 'Chess', blurb: 'Gold vs purple. Full rules, optional clocks.', players: '2 players' },
  { id: 'ludo', name: 'Pal Ludo', blurb: 'Roll fair dice, race four tokens home.', players: '2-4 players' },
  { id: 'trivia', name: 'Studio Trivia', blurb: 'Fast party quiz: music, movies and more.', players: '2-8 players' },
  { id: 'klgrid', name: 'KL Grid', blurb: 'K vs L on a 3x3 grid, or go Ultimate 9x9.', players: '2 players' },
  { id: 'checkers', name: 'Checkers', blurb: 'Jump, crown and clear the purple board.', players: '2 players' },
  { id: 'rush', name: 'Kemy Hill Rush', blurb: 'Drive your Pal over bouncy hills. Flip, collect stars, race friends.', players: '1-4 players' }
];
export const gameName = (id) => (GAMES.find((g) => g.id === id) || { name: 'Game' }).name;
