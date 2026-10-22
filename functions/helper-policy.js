// When the daily Kemy Helper digest may send. Pure, so it can be tested without Firebase.
// At most one push per local day, and not during quiet hours. Written by Lone Keem.
function digestDecision({ day, lastDay, openCount, hour }) {
  if (!day || !(hour >= 0 && hour <= 23)) return { send: false, reason: 'clock' };
  if (!openCount) return { send: false, reason: 'none' };
  if (lastDay && lastDay === day) return { send: false, reason: 'already' };
  if (hour >= 21 || hour < 8) return { send: false, reason: 'quiet' };
  return { send: true };
}

function digestBody(n) {
  const c = Math.max(0, Math.min(40, n | 0));
  return 'Kemy Helper: ' + c + (c === 1 ? ' note' : ' notes') + ' to look at.';
}

module.exports = { digestDecision, digestBody };
