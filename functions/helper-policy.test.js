const assert = require('assert');
const p = require('./helper-policy');

assert.deepEqual(p.digestDecision({ day: '2026-10-22', lastDay: '', openCount: 3, hour: 10 }), { send: true });
assert.equal(p.digestDecision({ day: '2026-10-22', lastDay: '2026-10-22', openCount: 3, hour: 10 }).reason, 'already');
assert.equal(p.digestDecision({ day: '2026-10-22', lastDay: '', openCount: 0, hour: 10 }).reason, 'none');
assert.equal(p.digestDecision({ day: '2026-10-22', lastDay: '', openCount: 2, hour: 22 }).reason, 'quiet');
assert.equal(p.digestDecision({ day: '2026-10-22', lastDay: '', openCount: 2, hour: 7 }).reason, 'quiet');
assert.equal(p.digestDecision({ day: '', lastDay: '', openCount: 2, hour: 10 }).reason, 'clock');
assert.equal(p.digestBody(1), 'Kemy Helper: 1 note to look at.');
assert.equal(p.digestBody(4), 'Kemy Helper: 4 notes to look at.');
console.log('helper-policy ok');
