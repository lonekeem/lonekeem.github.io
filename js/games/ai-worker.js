// Computer-opponent worker. The page sends a position and a level; the answer
// goes back when the search finishes, so the game buttons stay tappable.
import { ENGINES } from './boards.js';
import { aiMove } from './chess-engine.js';
import { aiShot } from './pool-engine.js';
import { aiPick } from './ludo-engine.js';
import { aiAction } from './cards.js';

self.onmessage = (e) => {
  const d = e.data;
  try {
    let result = null;
    if (d.kind === 'board') result = ENGINES[d.type].ai(d.st, d.level);
    else if (d.kind === 'chess') result = aiMove(d.board, d.cx, d.level);
    else if (d.kind === 'pool') result = aiShot(d.st, d.seat, d.balls, d.level);
    else if (d.kind === 'ludo') result = aiPick(d.st, d.die, d.level);
    else if (d.kind === 'cards') result = aiAction(d.st, d.seat, d.level);
    self.postMessage({ id: d.id, result });
  } catch (err) {
    self.postMessage({ id: d.id, error: String((err && err.message) || err) });
  }
};
