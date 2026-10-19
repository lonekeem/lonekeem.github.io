// Lone Keem Studios icon set. Familiar base shapes (house, compass, plus, bubble, person, bookmark,
// arrow, magnifier, bell, broadcast) restyled one consistent way: 2 px rounded strokes, soft corners,
// one angled "notch" per glyph and a small 4-point spark accent on the key icons. Strokes use the
// studio purple gradient (#lks-g) where the CSS asks for it; the like star stays gold (views.js / app).
const A = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const spark = (x, y, r = 2.6) => `<path class="ks" d="M${x} ${y - r}l${r * 0.32} ${r * 0.68} ${r * 0.68} ${r * 0.32}-${r * 0.68} ${r * 0.32}-${r * 0.32} ${r * 0.68}-${r * 0.32}-${r * 0.68}-${r * 0.68}-${r * 0.32} ${r * 0.68}-${r * 0.32}z"/>`;
const svg = (name, body) => `<svg class="ki ki-${name}" ${A}>${body}</svg>`;

export const ICONS = {
  // House with a soft roof, a notched (angled) top-right eave and a spark for a door light.
  home: svg('home', '<path d="M3.8 10.4 11 4.3a1.6 1.6 0 0 1 2 0l4.5 3.8M20.2 10.6V19a1.8 1.8 0 0 1-1.8 1.8H5.6A1.8 1.8 0 0 1 3.8 19v-8.6"/>' + spark(12, 15, 3)),
  // Compass ring with a star-shaped needle.
  explore: svg('explore', '<path d="M20.6 12A8.6 8.6 0 1 1 12 3.4c2.4 0 4.5 1 6.1 2.5"/><path class="kf" d="M12 6.6l1.5 3.9 3.9 1.5-3.9 1.5-1.5 3.9-1.5-3.9-3.9-1.5 3.9-1.5z"/>'),
  // Plus with a spark in the corner (create).
  create: svg('create', '<path d="M12 6.5v11M6.5 12h11"/>' + spark(18.6, 5.4, 2.4)),
  // Rounded-square speech bubble with an angled tail, notch on the top-right, spark accent.
  messages: svg('messages', '<path d="M15.5 4.2H6A2.6 2.6 0 0 0 3.4 6.8v7.4A2.6 2.6 0 0 0 6 16.8h2v3.6l4.6-3.6H18a2.6 2.6 0 0 0 2.6-2.6V9.6"/><path d="M8 10.6h6.4"/>' + spark(19.4, 4.6, 2.4)),
  // Person: round head, shoulders with a flat angled hem.
  profile: svg('profile', '<circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.4c.6-3.7 3.6-6 7.4-6 2.2 0 4 .7 5.4 2M19.2 20.4h-6"/>'),
  // Round comment bubble with a sharp angled tail and three dots.
  comment: svg('comment', '<path d="M20.4 11.6a8.4 8 0 0 1-12 7.2l-4.6 1.6 1.5-4.2a8 8 0 0 1-.9-4.6A8.4 8 0 0 1 20.4 11.6z"/><path d="M8.4 11.7h.01M12 11.7h.01M15.6 11.7h.01" stroke-width="2.6"/>'),
  // Curved share arrow with a notched tail and a spark at the tip.
  share: svg('share', '<path d="M13.6 5.2 20.4 11l-6.8 5.8v-3.4c-4.6 0-7.8 1.4-10 4.9.8-5.2 3.9-9.2 10-9.8z"/>' + spark(20.2, 4.2, 2.2)),
  // Bookmark with soft top corners and a spark inside.
  save: svg('save', '<path d="M6.6 3.6h10.8a1.2 1.2 0 0 1 1.2 1.2v15.6L12 16.2l-6.6 4.2V4.8a1.2 1.2 0 0 1 1.2-1.2z"/>' + spark(12, 9.6, 2.6)),
  // Magnifier with a glint and an angled handle.
  search: svg('search', '<circle cx="10.6" cy="10.6" r="6.6"/><path d="M15.6 15.6l4.6 4.6"/><path d="M7.6 9.4a3.4 3.4 0 0 1 2-2" stroke-width="1.6"/>'),
  // Bell with a flat notched rim and a spark.
  bell: svg('bell', '<path d="M6 16.4V10a6 6 0 0 1 9.6-4.8M18 10v6.4l1.6 1.6H4.4L6 16.4M10 20.6a2.2 2.2 0 0 0 4 0"/>' + spark(18.6, 4.8, 2.3)),
  // Go Live: broadcast arcs around a star.
  live: svg('live', '<path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2M4.6 4.6a10.4 10.4 0 0 0 0 14.8M19.4 4.6a10.4 10.4 0 0 1 0 14.8"/><path class="kf" d="M12 8.9l.95 2.05 2.05.95-2.05.95L12 14.9l-.95-2.05-2.05-.95 2.05-.95z"/>'),
  // Send (replies / chat): paper-plane-free arrow-in-bubble style.
  send: svg('send', '<path d="M4 12.2 20 4.6l-4.4 15-3.8-6.4z"/><path d="M11.8 13.2 20 4.6"/>'),
  plus: svg('plus', '<path d="M12 6.5v11M6.5 12h11"/>'),
  more: '<svg class="ki ki-more" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.9"/><path d="M12 9.9l2.1 2.1-2.1 2.1-2.1-2.1z"/><circle cx="18.5" cy="12" r="1.9"/></svg>'
};

// One shared gradient for every icon stroke that opts in (userSpaceOnUse so straight lines render).
export function installIconDefs(doc = document) {
  if (doc.getElementById('lks-icon-defs')) return;
  doc.body.insertAdjacentHTML('afterbegin', `<svg id="lks-icon-defs" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="lks-g" gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21"><stop offset="0" stop-color="#d4b3ff"/><stop offset=".55" stop-color="#a45cff"/><stop offset="1" stop-color="#8a2be2"/></linearGradient>
    <linearGradient id="lks-live" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b57bff"/><stop offset="1" stop-color="#6a1fc2"/></linearGradient>
  </defs></svg>`);
}
if (typeof document !== 'undefined') {
  if (document.body) installIconDefs(); else document.addEventListener('DOMContentLoaded', () => installIconDefs());
}
