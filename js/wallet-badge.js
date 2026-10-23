// Which wallet badge stays up. One in the top bar while that bar is open, one floating
// chip when a game hides the bar, and the buy sheet keeps its own. Everything else
// is removed. Called on mount and again when the route or the header changes.

export function chipWhere(el) {
  if (!el || typeof el.closest !== 'function') return 'other';
  if (el.closest('.bs-ov')) return 'sheet';
  if (el.id === 'wallet-fab') return 'fab';
  if (el.closest('#header-actions')) return 'header';
  return 'other';
}

export function reconcileBadges({ game, headerOpen, loggedIn, chips }) {
  const list = chips || [];
  const sheet = list.filter((c) => c.where === 'sheet');
  if (!loggedIn) return sheet;
  const headers = list.filter((c) => c.where === 'header');
  const fabs = list.filter((c) => c.where === 'fab');
  if (!game || headerOpen) return headers.length ? [headers[0], ...sheet] : [{ where: 'header', create: true }, ...sheet];
  return fabs.length ? [fabs[0], ...sheet] : [{ where: 'fab', id: 'wallet-fab', create: true }, ...sheet];
}

export function planBadges(state) {
  const chips = state.chips || [];
  const keep = reconcileBadges(state);
  const kept = new Set(keep.filter((k) => k.el));
  return {
    keep,
    remove: chips.filter((c) => c.el && !kept.has(c)),
    create: keep.filter((k) => k.create).map((k) => k.where),
  };
}
