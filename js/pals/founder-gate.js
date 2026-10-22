// The Founder Pal is the admin's axolotl. Same check as the red owner badge's account:
// only a verified admin (isAdmin) may equip species "founder". It is not in the hatch list or the shop.
export const FOUNDER_SPECIES = 'founder';

let adminCheck = () => false;
/** App startup passes the live isAdmin() check. Tests can pass the flag directly to founderAllowed. */
export function setFounderAdminCheck(fn) { adminCheck = typeof fn === 'function' ? fn : () => false; }

export function founderAllowed(species, admin = adminCheck()) {
  return species !== FOUNDER_SPECIES || !!admin;
}

export function assertFounderSpecies(species, admin = adminCheck()) {
  if (founderAllowed(species, admin)) return;
  const err = new Error('Only the admin can have the Founder Pal.');
  err.code = 'founder-only';
  throw err;
}
