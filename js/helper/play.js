// One quiet self-test at a time. A seated helper uses the same bot picks as
// Play vs Computer, off the main thread, and only notes a game that does not finish.
// Written by Lone Keem.

let engines = null;
let running = false;
let label = 'a quick board game';
let wait = 12;
let flip = 0;

export function playLabel() { return label; }

async function match(type, ask, report) {
  const eng = engines[type];
  if (!eng) return;
  label = eng.name;
  let st = { board: eng.init(), turn: 0, last: '' };
  const cap = type === 'klgrid' ? 10 : 43;
  for (let i = 0; i < cap; i++) {
    if (eng.outcome(st)) { label = 'a quick board game'; return; }
    const moves = eng.moves(st);
    if (!moves.length) {
      report({ type: 'error', game: type, text: 'self-test', autoFixed: false });
      label = 'a quick board game';
      return;
    }
    let m;
    try { m = await ask({ kind: 'board', type, st, level: 'easy' }); }
    catch { report({ type: 'error', game: type, text: 'self-test', autoFixed: false }); label = 'a quick board game'; return; }
    m = String(m);
    if (!moves.includes(m)) {
      report({ type: 'error', game: type, text: 'self-test', autoFixed: false });
      label = 'a quick board game';
      return;
    }
    try { st = eng.apply(st, m); }
    catch { report({ type: 'error', game: type, text: 'self-test', autoFixed: false }); label = 'a quick board game'; return; }
  }
  if (!eng.outcome(st)) report({ type: 'error', game: type, text: 'self-test', autoFixed: false });
  label = 'a quick board game';
}

async function run(report) {
  const bots = await import('../games/bots.js');
  const trivia = bots.triviaRoll('easy', () => 0.2);
  if (trivia.choice !== 0 || !Number.isFinite(trivia.ms)) {
    report({ type: 'error', game: 'trivia', text: 'self-test', autoFixed: false });
  }
  if (!engines) engines = (await import('../games/boards.js')).ENGINES;
  const type = flip++ % 2 === 0 ? 'klgrid' : 'stardrop';
  await match(type, bots.ask, report);
}

export function stepPlay(dt, report) {
  if (running) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  wait -= dt;
  if (wait > 0) return;
  wait = 50;
  running = true;
  run(report).catch(() => {}).finally(() => { running = false; label = 'a quick board game'; });
}
