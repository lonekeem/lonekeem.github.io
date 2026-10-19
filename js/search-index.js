// Lone Keem Studios - search helpers (Firestore has no full-text search).
// Posts store `keywords` (lowercase words + 2..15-char prefixes, max 100) and `hashtags`
// (max 20, parsed from #tags in the caption). Users store usernameLower / displayNameLower.
// Queries use array-contains (posts) and prefix ranges (users); see js/search.js.
export const MAX_KEYWORDS = 100, MAX_HASHTAGS = 20, MAX_PREFIX = 15, MIN_PREFIX = 2;

export const fold = (s) => String(s || '').normalize('NFKD').replace(/\p{M}+/gu, '').toLowerCase();
export const words = (s) => fold(s).match(/[\p{L}\p{N}_]+/gu) || [];

const TAG_RE = /(^|[^\p{L}\p{N}_&#])#([\p{L}\p{N}_]{1,40})/gu;
export function parseHashtags(text) {
  const out = [];
  for (const m of String(text || '').matchAll(TAG_RE)) {
    const t = fold(m[2]);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_HASHTAGS) break;
  }
  return out;
}

// Full words first (so long captions still index every distinct word up to the cap),
// then prefixes for as-you-type matching.
export function buildKeywords({ text = '', authorName = '', authorUsername = '' } = {}) {
  const ws = [];
  const add = (w) => { if (w && !ws.includes(w)) ws.push(w); };
  add(fold(authorUsername)); words(authorUsername).forEach(add);
  words(authorName).forEach(add);
  parseHashtags(text).forEach(add);
  words(text).forEach(add);
  const out = [];
  const push = (k) => { if (k.length >= MIN_PREFIX && !out.includes(k) && out.length < MAX_KEYWORDS) out.push(k); };
  ws.forEach((w) => push(w.slice(0, 40)));
  for (const w of ws) for (let i = MIN_PREFIX; i < Math.min(w.length, MAX_PREFIX + 1); i++) push(w.slice(0, i));
  return out;
}
export const searchFields = (p) => ({ keywords: buildKeywords(p), hashtags: parseHashtags(p.text) });
export const userSearchFields = (u) => ({ usernameLower: fold(u.username), displayNameLower: fold(u.displayName).slice(0, 100) });

// Turn #tags and @mentions in already-escaped caption HTML into links.
export function linkify(escaped) {
  return escaped
    .replace(TAG_RE, (all, pre, tag) => `${pre}<a class="tag-link" href="#/search?q=${encodeURIComponent('#' + fold(tag))}">#${tag}</a>`)
    .replace(/(^|[^\w&/.@])@([a-z0-9_.]{3,20})/gi, (all, pre, u) => {
      const name = u.replace(/\.+$/, ''); const rest = u.slice(name.length);
      return name.length >= 3 ? `${pre}<a class="mention-link" href="#/u/${name.toLowerCase()}">@${name}</a>${rest}` : all;
    });
}
