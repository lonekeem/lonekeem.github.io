// Official admin display name. The account id and permissions stay as they are;
// only the name people see, and who is allowed to use it, live here.
// The same pattern is enforced in firestore.rules (reservedKemy).

export const KEMY_NAME = 'Kemy';
export const KEMY_RED = '#ff2d2d';

// "Kemy", "KEMY", "Kemy_", "K3my", "k.e.m.y" — not longer names like "kemyfan".
const RESERVED_KEMY = /^[^a-z]*k[^a-z]*[e3][^a-z]*m[^a-z]*y[^a-z]*$/;

const adminUids = new Set();

export function reservedKemy(raw) {
  return RESERVED_KEMY.test(String(raw ?? '').toLowerCase());
}

export function noteAdminUid(uid) {
  if (uid) adminUids.add(String(uid));
}

export function clearAdminUids() { adminUids.clear(); }

export function rememberKemy(uid, displayName) {
  if (uid && displayName === KEMY_NAME) noteAdminUid(uid);
}

export function isAdminUid(uid) {
  return !!uid && adminUids.has(String(uid));
}

export function faceName(uid, name) {
  return isAdminUid(uid) ? KEMY_NAME : String(name ?? '');
}

export function adminNameClass(uid) {
  return isAdminUid(uid) ? 'kemy-admin-name' : '';
}

// Owner (studio or the admin account) outranks a moderator check.
export function badgeKind(uid, { studioUid = 'studio', mod = false } = {}) {
  if (uid === studioUid || isAdminUid(uid)) return 'owner';
  if (mod) return 'mod';
  return '';
}

export function ownerBadgeHtml() {
  return '<span class="badge owner-badge" title="Kemy" aria-label="Verified">✓</span>';
}
