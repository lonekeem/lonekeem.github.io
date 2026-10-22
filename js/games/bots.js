// Shared computer opponents: named pals, the mode the player last picked, and a
// worker so a search never freezes the page. Bot games pay fewer coins and keep
// their own record, apart from online wins.
const CPU_KEY = 'lks-games-cpu';
const MODE_KEY = 'kemy-play-mode';
const LVL_KEY = 'kemy-bot-lvl';
const FILL_KEY = 'kemy-fill-bots';

export const LEVELS = ['easy', 'medium', 'hard', 'expert'];
export const COIN_ONLINE = 20;
export const COIN_BOT = 8;

export const PALS = [
  { id: 'easy', name: 'Pip', title: 'Easy', line: 'Takes it easy', hue: '#7ecbff', ears: 'puppy' },
  { id: 'medium', name: 'Mochi', title: 'Medium', line: 'Plays a fair game', hue: '#ffb3d9', ears: 'kitten' },
  { id: 'hard', name: 'Nova', title: 'Hard', line: 'Looks for the win', hue: '#c9a6ff', ears: 'fox' },
  { id: 'expert', name: 'Ziggy', title: 'Expert', line: 'Barely misses', hue: '#ffd27a', ears: 'dragon' }
];
const EXTRA = {
  Lulu: { hue: '#9fe0ff', ears: 'puppy' },
  Comet: { hue: '#ffd34d', ears: 'fox' },
  Berry: { hue: '#ff8fb8', ears: 'kitten' },
  Nib: { hue: '#b8f0c0', ears: 'puppy' },
  Echo: { hue: '#d7c4ff', ears: 'kitten' },
  Pixel: { hue: '#9ad7ff', ears: 'fox' },
  Juno: { hue: '#ffe08a', ears: 'dragon' },
  Orbit: { hue: '#ffc1a1', ears: 'puppy' },
  Lyric: { hue: '#c8f5d4', ears: 'kitten' }
};
export const SEAT_NAMES = ['Pip', 'Mochi', 'Nova', 'Ziggy', 'Lulu', 'Comet', 'Berry', 'Nib'];
const BY_NAME = Object.fromEntries([...PALS.map((p) => [p.name, p]), ...Object.entries(EXTRA).map(([name, p]) => [name, p])]);

export function normLevel(v) {
  if (v === 'normal') return 'medium';
  return LEVELS.includes(v) ? v : 'medium';
}
export function palByLevel(level) { return PALS.find((p) => p.id === normLevel(level)) || PALS[1]; }
export function seatName(i) { return SEAT_NAMES[i % SEAT_NAMES.length]; }
export function botPlayer(i, level) {
  const pal = palByLevel(level);
  const others = SEAT_NAMES.filter((n) => n !== pal.name);
  const name = i === 0 ? pal.name : others[(i - 1) % others.length];
  return { uid: 'cpu' + (i + 1), name, bot: true, level: pal.id };
}

const read = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
export function lastMode() { const m = read(MODE_KEY, 'cpu'); return m === 'online' || m === 'friend' || m === 'cpu' ? m : 'cpu'; }
export function saveMode(m) { if (m === 'cpu' || m === 'online' || m === 'friend') write(MODE_KEY, m); }
export function lastLevel() { return normLevel(read(LVL_KEY, 'medium')); }
export function saveLevel(l) { write(LVL_KEY, normLevel(l)); }
export function fillBots() { return read(FILL_KEY, '1') !== '0'; }
export function setFillBots(on) { write(FILL_KEY, on ? '1' : '0'); }

export function botRecords() { try { return JSON.parse(read(CPU_KEY, '{}')); } catch { return {}; } }
export function addBotRecord(type, r) {
  if (r !== 'w' && r !== 'l' && r !== 'd') return;
  const all = botRecords();
  const x = all[type] || { w: 0, l: 0, d: 0 };
  x[r]++;
  all[type] = x;
  write(CPU_KEY, JSON.stringify(all));
}
export function onlyBots(players, me) {
  const foes = (players || []).filter((u) => u && u !== me);
  return foes.length > 0 && foes.every((u) => /^cpu\d$/.test(u));
}

// How a trivia bot answers: choice 0 is the right answer. Higher levels are
// righter and faster.
export function triviaRoll(level, rand = Math.random) {
  const t = {
    easy: { acc: 0.42, min: 2800, span: 9000 },
    medium: { acc: 0.64, min: 1600, span: 5200 },
    hard: { acc: 0.84, min: 700, span: 2800 },
    expert: { acc: 0.96, min: 380, span: 1400 }
  }[normLevel(level)];
  return { choice: rand() < t.acc ? 0 : 1 + Math.floor(rand() * 3), ms: Math.round(t.min + rand() * t.span) };
}
const FEEL = { easy: 420, medium: 640, hard: 820, expert: 980 };
export function feelMs(level) { return (FEEL[normLevel(level)] || 640) + Math.random() * 280; }

function ears(kind, hue) {
  if (kind === 'kitten') return `<path d="M14 28 L20 12 L28 26 M36 26 L44 12 L50 28" fill="${hue}" stroke="#2b1d55" stroke-width="2" stroke-linejoin="round"/>`;
  if (kind === 'fox') return `<path d="M12 30 L18 8 L30 24 M34 24 L46 8 L52 30" fill="${hue}" stroke="#2b1d55" stroke-width="2" stroke-linejoin="round"/>`;
  if (kind === 'dragon') return `<path d="M20 24 L24 8 L28 22 M36 22 L40 8 L44 24" fill="#7dffb0" stroke="#2b1d55" stroke-width="2" stroke-linejoin="round"/>`;
  return `<ellipse cx="16" cy="30" rx="8" ry="10" fill="${hue}" stroke="#2b1d55" stroke-width="2"/><ellipse cx="48" cy="30" rx="8" ry="10" fill="${hue}" stroke="#2b1d55" stroke-width="2"/>`;
}
export function faceSvg(name, px = 64) {
  const pal = BY_NAME[name] || { hue: '#c9a6ff', ears: 'puppy' };
  return `<svg class="bot-face" viewBox="0 0 64 64" width="${px}" height="${px}" aria-hidden="true">${ears(pal.ears, pal.hue)}<circle cx="32" cy="36" r="20" fill="${pal.hue}" stroke="#2b1d55" stroke-width="2"/><circle cx="24" cy="34" r="3.2" fill="#2b1d55"/><circle cx="40" cy="34" r="3.2" fill="#2b1d55"/><circle cx="25" cy="33" r="1" fill="#fff"/><circle cx="41" cy="33" r="1" fill="#fff"/><path d="M26 42 Q32 48 38 42" fill="none" stroke="#2b1d55" stroke-width="2" stroke-linecap="round"/><ellipse cx="20" cy="40" rx="3" ry="2" fill="#ff8fb1" opacity=".7"/><ellipse cx="44" cy="40" rx="3" ry="2" fill="#ff8fb1" opacity=".7"/></svg>`;
}

export function fillToggleHtml() {
  return `<label class="g-fill"><input type="checkbox" data-fill ${fillBots() ? 'checked' : ''}> Fill empty seats with bots</label>`;
}
export function wireFill(root) {
  const c = root && root.querySelector('[data-fill]');
  if (c) c.onchange = () => setFillBots(c.checked);
}
export function offerHtml() {
  return `<div class="g-bot-offer"><p>No real player yet.</p><button type="button" class="btn btn-sm" data-bot-yes>Play a bot instead?</button></div>`;
}

const waits = new Map();
const timers = new Map();
export function whenOffer(gid, fn) {
  if (!waits.has(gid)) waits.set(gid, Date.now());
  const left = 25000 - (Date.now() - waits.get(gid));
  if (left <= 0) return true;
  if (!timers.has(gid)) timers.set(gid, setTimeout(() => { timers.delete(gid); fn(); }, left));
  return false;
}
export function stopOffer(gid) {
  clearTimeout(timers.get(gid));
  timers.delete(gid);
  waits.delete(gid);
}

let worker = null;
const pending = new Map();
let seq = 0;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.error) p.fail(new Error(e.data.error));
    else p.ok(e.data.result);
  };
  worker.onerror = () => {
    worker = null;
    for (const p of pending.values()) p.fail(new Error('worker'));
    pending.clear();
  };
  return worker;
}
async function runLocal(msg) {
  if (msg.kind === 'board') { const { ENGINES } = await import('./boards.js'); return ENGINES[msg.type].ai(msg.st, msg.level); }
  if (msg.kind === 'chess') { const m = await import('./chess-engine.js'); return m.aiMove(msg.board, msg.cx, msg.level); }
  if (msg.kind === 'pool') { const m = await import('./pool-engine.js'); return m.aiShot(msg.st, msg.seat, msg.balls, msg.level); }
  if (msg.kind === 'ludo') { const m = await import('./ludo-engine.js'); return m.aiPick(msg.st, msg.die, msg.level); }
  if (msg.kind === 'cards') { const m = await import('./cards.js'); return m.aiAction(msg.st, msg.seat, msg.level); }
  return null;
}
// Runs the pick off the main thread, then waits out a short thinking pause
// so the move does not appear on the same frame the player tapped.
export function ask(msg) {
  const t0 = Date.now();
  const finish = (result) => new Promise((r) => setTimeout(() => r(result), Math.max(80, feelMs(msg.level) - (Date.now() - t0))));
  return new Promise((ok, fail) => {
    try {
      const id = ++seq;
      pending.set(id, { ok, fail });
      getWorker().postMessage({ ...msg, id });
    } catch (e) { fail(e); }
  }).catch(() => runLocal(msg)).then(finish);
}

if (typeof document !== 'undefined' && !document.getElementById('k-bot-css')) {
  const s = document.createElement('style');
  s.id = 'k-bot-css';
  s.textContent = `.tv-who{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:0 0 10px}.tv-who .gp{background:rgba(255,255,255,.05);border-radius:999px;padding:2px 8px 2px 2px}.g-modes{display:grid;gap:8px;margin:0 0 12px}.g-modes button{border:2px solid rgba(181,123,255,.4);background:rgba(20,10,36,.72);color:inherit;border-radius:16px;padding:12px 14px;font:800 15px/1.2 Inter,sans-serif;text-align:left;cursor:pointer}.g-modes button[aria-pressed="true"]{border-color:#ffc83d;background:linear-gradient(135deg,rgba(138,43,226,.5),rgba(242,169,0,.22));color:#fff}.g-pals{display:grid;grid-template-columns:1fr 1fr;gap:8px}.g-pal{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 8px 12px;border-radius:16px;border:2px solid rgba(181,123,255,.35);background:rgba(20,10,36,.72);color:inherit;cursor:pointer;font:inherit}.g-pal b{font-family:"Space Grotesk",sans-serif;font-size:1rem}.g-pal small{color:var(--muted,#c9b8e8);font-size:.75rem}.bot-tag{display:inline-block;margin-left:4px;font-style:normal;font-size:.62rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:1px 6px;border-radius:999px;background:#ffc83d;color:#2b1d55;vertical-align:1px}.g-bot-offer{margin-top:10px;padding:10px;border-radius:14px;border:1px dashed rgba(255,200,61,.75);text-align:center}.g-bot-offer p{margin:0 0 8px}.g-fill{display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0;font-size:.92rem}.bot-face{display:block}.gp .bot-face{width:28px;height:28px}.g-think{font-weight:700}`;
  document.head.appendChild(s);
}
