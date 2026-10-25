// Pal Ludo turn clock + AUTO play. Pure logic (no DOM) so it can be unit tested.
// A human gets ROLL_S seconds to roll and MOVE_S seconds to pick a token. When time runs out the
// turn is played for them (roll + a sensible move) and AUTO switches on; AUTO keeps playing their
// turns until they switch it off. Any turn played on AUTO means that game pays no XP or rewards.
import { aiPick, legal } from './ludo-engine.js';

export const ROLL_S = 15;
export const MOVE_S = 10;
export const TICK_FROM = 3;          // light tick in the last 3 seconds
export const AUTO_DELAY = 1200;      // AUTO still plays at a normal, readable pace
export const AUTO_NOTE = 'No XP or rewards given while on AUTO';
export const AUTO_INFO = 'Miss a turn and your Pal plays it for you. Switch AUTO off any time.';

// One countdown per (turn, phase). arm() restarts only when the key changes.
export function makeClock(now = () => Date.now()) {
  let key = '', t0 = 0, len = 0, fired = false, lastTick = -1;
  return {
    arm(k, secs) { if (k !== key) { key = k; t0 = now(); len = secs * 1000; fired = false; lastTick = -1; } return this; },
    clear() { key = ''; len = 0; },
    get key() { return key; },
    left() { return len ? Math.max(0, len - (now() - t0)) : 0; },
    frac() { return len ? this.left() / len : 0; },
    secs() { return Math.ceil(this.left() / 1000); },
    // true once, when the countdown hits zero
    expired() { if (!len || fired || this.left() > 0) return false; fired = true; return true; },
    // true once per second inside the last TICK_FROM seconds
    tick() { const s = this.secs(); if (len && s > 0 && s <= TICK_FROM && s !== lastTick) { lastTick = s; return true; } return false; }
  };
}

// AUTO state for the local player
export function makeAuto() {
  const a = { on: false, used: 0, missed: 0 };
  a.miss = () => { a.missed++; a.on = true; };
  a.set = (v) => { a.on = !!v; };
  a.played = () => { a.used++; };
  return a;
}
// a sensible move for a timed-out or AUTO turn (no move -> -1)
export const autoMove = (st, die) => (legal(st, die).length ? aiPick(st, die, 'medium', () => 0.5) : -1);
// XP, coins and scoreboard points only when none of your turns were played on AUTO
export const rewardsAllowed = (auto) => !(auto && (auto.used > 0 || auto.on));
