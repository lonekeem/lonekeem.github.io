import {
  KEMY_NAME, KEMY_RED, reservedKemy, noteAdminUid, clearAdminUids, faceName,
  isAdminUid, badgeKind, ownerBadgeHtml, adminNameClass, rememberKemy
} from '../js/kemy-name.js';

let failed = 0;
const ok = (cond, msg) => { if (!cond) { failed++; console.error('FAIL', msg); } };

for (const n of ['Kemy', 'kemy', 'KEMY', 'Kemy_', 'kemy_', 'K3my', 'k3my', 'k.e.m.y', '  Kemy  ', 'Kemy!']) {
  ok(reservedKemy(n), 'reserved ' + JSON.stringify(n));
}
for (const n of ['kemyfan', 'Alex', 'mykemy', 'kem', 'kkemy', 'Keemy', 'k3mmy', '']) {
  ok(!reservedKemy(n), 'open ' + JSON.stringify(n));
}

clearAdminUids();
ok(faceName('player', 'Alex') === 'Alex', 'player keeps their name');
ok(adminNameClass('player') === '', 'player has no admin class');
ok(badgeKind('player') === '', 'player has no badge');
ok(badgeKind('mod1', { mod: true }) === 'mod', 'moderator stays a mod badge');
ok(badgeKind('studio') === 'owner', 'studio is an owner');
ok(badgeKind('studio', { mod: true }) === 'owner', 'owner beats moderator');

noteAdminUid('boss');
rememberKemy('other', 'Alex');
ok(!isAdminUid('other'), 'a normal name is not the admin');
rememberKemy('boss2', KEMY_NAME);
ok(isAdminUid('boss') && isAdminUid('boss2'), 'admin uids are remembered');
ok(faceName('boss', 'Lilly') === 'Kemy', 'admin display name is Kemy');
ok(faceName('boss2', 'Something') === KEMY_NAME, 'stored Kemy name stays Kemy');
ok(adminNameClass('boss') === 'kemy-admin-name', 'admin name class');
ok(badgeKind('boss', { mod: true }) === 'owner', 'admin check beats the blue mod check');
ok(ownerBadgeHtml().includes('owner-badge') && !ownerBadgeHtml().includes('mod-badge'), 'owner badge is the red check');
ok(KEMY_RED === '#ff2d2d', 'admin name color is red');
ok(KEMY_NAME === 'Kemy', 'spelling');

if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('kemy-name tests ok');
