const assert = require('assert');
const p = require('./mod-policy');

const kind = (t) => p.scan(t).kind;
const ok = p.scan('Want to play Star Drop?');
assert.equal(ok.action, 'ok');
assert.equal(ok.strike, false);
assert.equal(ok.ban, false);

const word = p.scan('this is shit');
assert.equal(word.action, 'mask');
assert.equal(word.strike, true);
assert.equal(word.serious, false);
assert.equal(word.ban, false);
assert.ok(!/shit/i.test(word.text));

assert.equal(p.scan('f u c k').kind, 'word');
assert.equal(p.scan('sh1t').action, 'mask');
assert.equal(p.scan('hello friend').action, 'ok');
assert.equal(p.scan('oh hell').kind, 'mild');
assert.equal(p.scan('oh hell').strike, false);

assert.equal(kind('nigg test'), 'slur');
assert.equal(p.scan('nigg test').serious, true);
assert.equal(p.scan('nigg test').ban, false);
assert.equal(kind('send nudes'), 'sexual');
assert.equal(kind('i will kill you'), 'violent');
assert.equal(kind('call me at 415-555-0199'), 'phone');
assert.equal(kind('email me kid@example.com'), 'email');
assert.equal(kind('i live at 12 Oak Street'), 'address');
assert.equal(kind('add me on discord'), 'social');
assert.equal(kind('look https://example.com/a'), 'link');
assert.equal(p.scan('look https://example.com/a').serious, false);
assert.equal(kind('ping me on telegram'), 'social');
assert.equal(kind('my kik is bob'), 'social');
assert.equal(kind('five one two three four five six'), 'phone');
assert.equal(kind('add me on snap'), 'social');
assert.equal(p.scan('Nice car!').action, 'ok');
assert.equal(p.scan('hello friend').action, 'ok');
assert.equal(kind('how old are you'), 'groom');
assert.equal(p.scan('how old are you').strike, false);
assert.equal(p.scan('how old are you').action, 'block');
assert.equal(kind('are you alone'), 'groom');
assert.equal(kind('send pic'), 'groom');
assert.equal(kind("don't tell your parents"), 'groom');
assert.equal(kind('where do you live'), 'groom');
assert.equal(kind('what school do you go to'), 'groom');
assert.equal(p.scan('I like school').action, 'ok');
assert.equal(p.scan('class assignment').action, 'ok');
assert.equal(p.scan('snapshot').action, 'ok');
assert.equal(p.scan('oh hell').kind, 'mild');

const care = p.scan('i want to die');
assert.equal(care.action, 'care');
assert.equal(care.strike, false);
assert.equal(care.ban, false);
assert.ok(/988/.test(p.CARE_NOTE));

assert.equal(p.nameProblem('Sunny'), false);
assert.equal(p.nameProblem('hello'), false);
assert.equal(p.nameProblem('shithead'), true);
assert.equal(p.nameProblem('12 Oak Street'), true);

assert.deepEqual(p.nextStep(0), { step: 'warn', muteMs: 0, ban: false });
assert.equal(p.nextStep(1).step, 'mute');
assert.equal(p.nextStep(1).muteMs, 10 * 60 * 1000);
assert.equal(p.nextStep(4).ban, false);
assert.equal(p.nextStep(1).ban, false);

const now = 1_000_000;
assert.equal(p.flood([now - 1000, now - 2000], now, 8).bad, false);
assert.equal(p.flood(Array.from({ length: 8 }, (_, i) => now - i * 1000), now, 8).bad, true);
assert.equal(p.flood(Array.from({ length: 8 }, (_, i) => now - i * 1000), now, 8).ban, false);
assert.equal(p.flood(Array.from({ length: 8 }, (_, i) => now - 60000 - i), now, 8).bad, false);

const hits = [1, 2, 3, 4].map((i) => ({ id: 'pal', at: now - i * 1000 }));
assert.equal(p.harass(hits, now).bad, true);
assert.equal(p.harass(hits, now).serious, true);
assert.equal(p.harass(hits, now).ban, false);
assert.equal(p.harass(hits.slice(0, 2), now).bad, false);

assert.equal(p.grief(1000).flag, false);
assert.equal(p.grief(45000).flag, true);
assert.equal(p.grief(45000).ban, false);

assert.equal(p.snapshot(['a: hi', 'b: hello']).includes('a: hi'), true);
assert.ok(p.snapshot(['x'.repeat(400)]).length <= 300);
assert.equal(p.WARN, "Kemy Helper: let's keep it kind!");

console.log('mod-policy ok');
