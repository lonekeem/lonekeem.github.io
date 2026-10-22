const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const p = require('./push-policy');

test('a live join is recent and a back-fill is not', () => {
  const now = Date.UTC(2026, 9, 22, 16, 0, 0);
  assert.equal(p.joinIsLive(now - 60 * 1000, now), true);
  assert.equal(p.joinIsLive(now - 14 * 60 * 1000, now), true);
  assert.equal(p.joinIsLive(now - 16 * 60 * 1000, now), false);
  assert.equal(p.joinIsLive(now + 3 * 60 * 1000, now), false);
  assert.equal(p.joinIsLive(now + 30 * 1000, now), true);
  assert.equal(p.joinIsLive(0, now), false);
  assert.equal(p.joinIsLive(null, now), false);
});

test('quiet hours block every type, including turns', () => {
  for (const hour of [21, 23, 0, 7]) {
    const d = p.decideSend({ type: 'turn', hour, day: '2026-10-22', quota: {} });
    assert.equal(d.ok, false);
    assert.equal(d.reason, 'quiet');
    assert.equal(p.decideSend({ type: 'invite', hour, day: '2026-10-22', quota: {} }).reason, 'quiet');
  }
});

test('8am through 8pm is awake', () => {
  for (const hour of [8, 12, 20]) {
    assert.equal(p.decideSend({ type: 'invite', hour, day: '2026-10-22', quota: {} }).ok, true);
  }
});

test('non-game cap is 3 and turns are not counted', () => {
  const full = { day: '2026-10-22', n: 3 };
  assert.equal(p.decideSend({ type: 'house', hour: 12, day: '2026-10-22', quota: full }).reason, 'cap');
  assert.equal(p.decideSend({ type: 'announce', hour: 12, day: '2026-10-22', quota: full }).reason, 'cap');
  assert.equal(p.decideSend({ type: 'daily', hour: 12, day: '2026-10-22', quota: full }).reason, 'cap');
  const turn = p.decideSend({ type: 'turn', hour: 12, day: '2026-10-22', quota: full });
  assert.equal(turn.ok, true);
  assert.equal(turn.game, true);
  const third = p.decideSend({ type: 'invite', hour: 12, day: '2026-10-22', quota: { day: '2026-10-22', n: 2 } });
  assert.equal(third.ok, true);
  assert.equal(third.next.n, 3);
});

test('a new local day resets the cap and daily sends once', () => {
  const next = p.decideSend({ type: 'daily', hour: 9, day: '2026-10-23', quota: { day: '2026-10-22', n: 3, lastDaily: '2026-10-22' } });
  assert.equal(next.ok, true);
  assert.equal(next.next.n, 1);
  assert.equal(next.next.lastDaily, '2026-10-23');
  assert.equal(p.decideSend({ type: 'daily', hour: 10, day: '2026-10-23', quota: next.next }).reason, 'already');
});

test('clock uses the offset and an IANA zone', () => {
  const utc = p.clockFrom('', 0, new Date('2026-10-22T21:30:00Z'));
  assert.equal(utc.hour, 21);
  assert.equal(utc.day, '2026-10-22');
  const east = p.clockFrom('', 300, new Date('2026-10-22T02:30:00Z'));
  assert.equal(east.hour, 21);
  assert.equal(east.day, '2026-10-21');
  const ny = p.clockFrom('America/New_York', 0, new Date('2026-10-22T12:00:00Z'));
  assert.equal(ny.hour, 8);
  assert.equal(ny.day, '2026-10-22');
});

test('turn pings only the human whose turn just started', () => {
  const base = { status: 'active', type: 'chess', players: ['a', 'b'], turn: 0 };
  assert.equal(p.turnRecipient(base, { ...base, turn: 1 }), 'b');
  assert.equal(p.turnRecipient(base, { ...base, hb: { a: 1 } }), '');
  assert.equal(p.turnRecipient({ ...base, status: 'waiting' }, { ...base, status: 'active' }), '');
  assert.equal(p.turnRecipient(base, { ...base, turn: 1, players: ['a', 'cpu1'] }), '');
  const l0 = { status: 'active', type: 'ludo', players: ['a', 'b'], lv: { turn: 0 } };
  const l1 = { status: 'active', type: 'ludo', players: ['a', 'b'], lv: { turn: 1 } };
  assert.equal(p.turnRecipient(l0, l1), 'b');
  const c0 = { status: 'active', type: 'starcards', players: ['a', 'b', 'c'], pv: { turn: 1 } };
  const c1 = { status: 'active', type: 'starcards', players: ['a', 'b', 'c'], pv: { turn: 2 } };
  assert.equal(p.turnRecipient(c0, c1), 'c');
  assert.equal(p.turnMessage({ type: 'pool' }, 'abc').body, 'Your turn in Star Pool!');
});

test('inbox events map to invite and house only', () => {
  assert.equal(p.inboxPush({ type: 'like', fromName: 'A' }), null);
  const g = p.inboxPush({ type: 'game', fromName: 'Ada', postId: 'g1', text: 'Star Pool' });
  assert.equal(g.type, 'invite');
  assert.equal(g.url, 'app.html#/game/g1');
  const pal = p.inboxPush({ type: 'game', fromName: 'Ada', postId: 'p1', text: 'Pal Race (Pal Games)' });
  assert.match(pal.url, /games\/pals/);
  const house = p.inboxPush({ type: 'house', fromName: 'Bea', text: 'rang your doorbell on Kemy Street', postId: 'h02' });
  assert.equal(house.type, 'house');
  assert.match(house.body, /doorbell/);
  assert.equal(house.url, 'app.html#/street');
  const follow = p.inboxPush({ type: 'follow', fromName: 'Cam', fromUsername: 'cam' });
  assert.equal(follow.url, 'app.html#/u/cam');
});

test('announcements stay on Kemy and strip outside links', () => {
  assert.equal(p.isAdminToken({ email: p.ADMIN_EMAIL, email_verified: true }), true);
  assert.equal(p.isAdminToken({ email: p.ADMIN_EMAIL, email_verified: false }), false);
  assert.equal(p.isAdminToken({ email: 'other@example.com', email_verified: true }), false);
  assert.equal(p.isAdminToken(null), false);
  const ok = p.buildAnnouncement({ title: 'New dances', body: 'Try the new Pal dances today.', url: '#/pals' });
  assert.equal(ok.path, 'app.html#/pals');
  assert.equal(p.hashOnly(ok.path), '#/pals');
  const stripped = p.buildAnnouncement({ title: 'Hi', body: 'See https://evil.example/x now', url: 'app.html#/feed' });
  assert.equal(stripped.body.includes('http'), false);
  assert.equal(p.buildAnnouncement({ title: 'Hi', body: 'Hello friends', url: 'https://evil.example' }).error.includes('Kemy'), true);
  assert.ok(p.buildAnnouncement({ title: 'H', body: 'Hello', url: '#/feed' }).error);
});

test('web push public key is set and rules lock tokens to the owner', () => {
  const root = path.join(__dirname, '..');
  const init = fs.readFileSync(path.join(root, 'js/firebase-init.js'), 'utf8');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const vapid = 'BFJgem6Y2W1JaR-2eBHu0lZbOtP49qgiunK6wxgB1FJsqp0grTN0iTnM_hvp5B2YE0ww_UdXzn_zRxUr9QZ2Svc';
  assert.match(init, new RegExp("VAPID_KEY = '" + vapid + "'"));
  assert.equal(/^[A-Za-z0-9_-]{80,}$/.test(vapid), true);
  assert.equal(init.includes('REPLACE_WITH_WEB_PUSH_VAPID_PUBLIC_KEY'), false);
  assert.equal(init.includes('BEGIN PRIVATE'), false);
  assert.match(init, new RegExp("ADMIN_EMAIL = '" + p.ADMIN_EMAIL.replace('.', '\\.') + "'"));
  assert.match(rules, /match \/fcmTokens\/\{id\}/);
  assert.match(rules, /uid == me\(\)/);
  assert.match(rules, /docId == 'push'/);
  assert.match(rules, /'house'/);
  assert.match(sw, /firebase-messaging-sw\.js/);
  assert.equal(fs.existsSync(path.join(root, 'firebase-messaging-sw.js')), true);
});
