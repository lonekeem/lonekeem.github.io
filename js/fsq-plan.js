// Pure pacing plan for js/fsq.js (no imports, so node tests can load it).
// Each entry mirrors a time gap that firestore.rules enforces, plus a small margin for clock drift.
export const RATE_FIELDS = {
  lastPostAt: 20600, // users/{uid}: rateOk('lastPostAt', 20)
  lastNewChatAt: 8400, // rateOk('lastNewChatAt', 8)
  lastCommentAt: 5400, // rateOk('lastCommentAt', 5)
  lastFollowAt: 2300, // rateOk('lastFollowAt', 2)
  lastMessageAt: 1300 // rateOk('lastMessageAt', 1)
};
export const PATHS = [
  [/^users\/[^/]+\/pets\/[^/]+$/, 1200], // pets updatedAt + 1 s
  [/^users\/[^/]+\/pal\/wallet$/, 1200], // wallet last + 1 s
  [/^users\/[^/]+\/pal\/world$/, 5300], // world at + 5 s
  [/^leaderboard\/[^/]+$/, 3300], // updatedAt + 3 s (10 s for small boards: covered by the retries)
  [/^bingoRooms\/[^/]+\/seats\/[^/]+$/, 2200], // seat at + 2 s
  [/^feedbackQuota\/[^/]+$/, 60500] // one team note a minute: later notes wait their turn
];
// Waits between quiet retries when the server still says no (after the gap itself has been waited out).
export const RETRY_WAITS = [1500, 3500, 7000];
const RETRY_CODES = new Set(['permission-denied', 'aborted', 'unavailable', 'deadline-exceeded', 'cancelled']);
export const retryable = (e) => !!e && RETRY_CODES.has(String(e.code || '').replace(/^firestore\//, ''));
export function laneFor(path, fields) {
  const out = [];
  if (/^users\/[^/]+$/.test(path)) {
    for (const f of fields || []) if (RATE_FIELDS[f]) out.push({ key: path + '#' + f, gap: RATE_FIELDS[f] });
    return out;
  }
  for (const [re, gap] of PATHS) if (re.test(path)) { out.push({ key: path, gap }); break; }
  return out;
}

// Serial lanes: a write waits for earlier writes on the same lane(s), then for the lane's gap since the last
// attempt finished, and is retried quietly (gap + backoff) while the server says no for a retryable reason.
export function createPacer(stats = {}, waits = RETRY_WAITS, sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  const lanes = new Map();
  const lane = (k) => lanes.get(k) || (lanes.set(k, { last: 0, tail: Promise.resolve() }), lanes.get(k));
  const bump = (k) => (stats[k] = (stats[k] || 0) + 1);
  return async function runPaced(lns, attempt) {
    if (!lns.length) return attempt();
    const prev = Promise.all(lns.map((l) => lane(l.key).tail));
    let done; const mine = new Promise((r) => (done = r));
    lns.forEach((l) => (lane(l.key).tail = mine));
    try {
      await prev.catch(() => {});
      for (let i = 0; ; i++) {
        const wait = Math.max(0, ...lns.map((l) => lane(l.key).last + l.gap - Date.now()));
        if (wait > 0) { bump('paced'); await sleep(wait); }
        try { const r = await attempt(); lns.forEach((l) => (lane(l.key).last = Date.now())); return r; }
        catch (e) {
          lns.forEach((l) => (lane(l.key).last = Date.now()));
          if (i >= waits.length || !retryable(e)) { bump('failed'); if (e && typeof e === 'object') e.kemyTried = i + 1; throw e; }
          bump('retried'); await sleep(Math.max(0, waits[i] - Math.min(...lns.map((l) => l.gap))));
        }
      }
    } finally { done(); }
  };
}
