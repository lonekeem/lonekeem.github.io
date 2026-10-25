// Kemy write pacing (tiny, no network of its own). App modules import Firestore from here instead of the
// CDN; it re-exports the whole SDK and wraps the write calls.
// Some rules space writes out (posts 20 s, new chats 8 s, comments 5 s, follows 2 s, chat 1 s, Pal saves,
// wallet, scores, lobbies ...). A write that lands inside its gap is DENIED by the server, which used to
// reach players as an error toast. Here, writes to those spots wait out the gap first and, if the server
// still says no, retry quietly with backoff. Everything else (including live position/presence docs, which
// pace themselves and are replaced by the next tick anyway) goes straight through, untouched.
import * as F from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
export * from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { RATE_FIELDS, laneFor, createPacer } from './fsq-plan.js';

const stats = (window.__kemyWrites = window.__kemyWrites || { paced: 0, retried: 0, failed: 0 });
const runPaced = createPacer(stats);

// Keys of a write's data (object form or the ('field', value, ...) varargs form of update).
function fieldsOf(args) {
  const d = args[0];
  if (typeof d === 'string' || d instanceof F.FieldPath) return args.filter((_, i) => i % 2 === 0).map(String);
  return d && typeof d === 'object' ? Object.keys(d) : [];
}
// Which pacing lanes a single write touches: [{ key, gap }]
function plan(path, args) { return laneFor(path, fieldsOf(args)); }

const guarded = (lns, attempt) => runPaced(lns, attempt);

export function setDoc(ref, ...a) { return guarded(plan(ref.path, a), () => F.setDoc(ref, ...a)); }
export function updateDoc(ref, ...a) { return guarded(plan(ref.path, a), () => F.updateDoc(ref, ...a)); }
export function addDoc(col, ...a) { return guarded(plan(col.path + '/*', a), () => F.addDoc(col, ...a)); }

// A batch records its operations so a denied commit can be replayed into a fresh batch after the gap.
export function writeBatch(db) {
  const ops = [];
  const b = {
    set(ref, ...a) { ops.push(['set', ref, a]); return b; },
    update(ref, ...a) { ops.push(['update', ref, a]); return b; },
    delete(ref) { ops.push(['delete', ref, []]); return b; },
    commit() {
      const seen = new Map();
      for (const [m, ref, a] of ops) if (m !== 'delete') for (const l of plan(ref.path, a)) seen.set(l.key, l);
      return runPaced([...seen.values()], () => {
        const real = F.writeBatch(db);
        for (const [m, ref, a] of ops) real[m](ref, ...a);
        return real.commit();
      });
    }
  };
  return b;
}
export { RATE_FIELDS };
