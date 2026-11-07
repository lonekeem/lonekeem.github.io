// One account's bunny hangs the ears it already has. Not a look system and not a new species.
// Owner is non-enumerable so pet saves and presence docs never gain a field.
// Verified from the public usernames/tilly.eyelash doc (uid below) and users/{uid}:
// username tilly.eyelash, displayName Tilly.Eyelash, activePet p1, species bunny.
export const FLOPPY_BUNNY_UID = 'gXcJPbspiFdjP8wkgLWWqkHa5rg2';

export function withOwner(pal, uid) {
  if (pal && uid && pal.owner !== uid) Object.defineProperty(pal, 'owner', { value: uid, enumerable: false, configurable: true });
  return pal;
}

export function copyPal(pal, extra) {
  const o = { ...(pal || {}), ...(extra || {}) };
  if (pal && pal.owner) Object.defineProperty(o, 'owner', { value: pal.owner, enumerable: false, configurable: true });
  return o;
}

export function floppyBunny(pal) {
  return !!(pal && pal.species === 'bunny' && pal.owner === FLOPPY_BUNNY_UID);
}
