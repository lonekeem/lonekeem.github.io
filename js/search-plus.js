// Lone Keem Studios - search extras: kid-safe query filter, typo-tolerant ranking, grouped results,
// built-in catalog (Games, Pals, studio pages), curated outside items and trending searches.
// Pure helpers live here so js/search.js stays small and the tests can import them.
import { fold, words } from './search-index.js';
import { catOf } from './feed-cats.js';

// ---------------------------------------------------------------- kid-safe query filter
// Queries containing these words return a gentle message instead of results (and are never
// counted for trending). Kept short and obvious; the outside content is filtered separately.
const BLOCK = ['sex', 'sexy', 'porn', 'porno', 'nude', 'nudes', 'naked', 'nsfw', 'xxx', 'boobs', 'penis', 'vagina', 'hentai', 'onlyfans',
  'fuck', 'fucking', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut',
  'rape', 'gore', 'suicide', 'selfharm', 'kill myself', 'drugs', 'cocaine', 'heroin', 'meth', 'weed', 'vape', 'beheading', 'gun', 'guns', 'murder', 'twerk', 'twerking', 'strip', 'stripper', 'explicit'];
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
export function blockedQuery(q) {
  const t = fold(q).replace(/[013457@$]/g, (c) => LEET[c] || c);
  const ws = t.match(/[a-z]+/g) || [], squash = ws.join('');
  return BLOCK.some((b) => b.includes(' ') ? t.includes(b) : ws.includes(b) || ((b.length >= 5 || (ws.length > 2 && ws.every((w) => w.length <= 2))) && squash.includes(b)));
}
export const BLOCKED_MSG = 'Let’s keep Kemy friendly for everyone. Try searching for something else, like #funny, music or Pals 🐾';

// ---------------------------------------------------------------- typo-tolerant matching
// Optimal string alignment distance (Damerau-Levenshtein with adjacent swaps), capped for speed.
export function editDistance(a, b, cap = 3) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length, n = b.length; let p2 = null, p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i]; let rowMin = i;
    for (let j = 1; j <= n; j++) {
      let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
      c.push(v); if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1; p2 = p; p = c;
  }
  return p[n];
}
const allow = (t) => (t.length >= 8 ? 2 : t.length >= 4 ? 1 : 0);
// How well one query term matches a word: 1 exact, 0.85 prefix, ~0.6 typo, 0 no match.
export function termScore(t, w) {
  if (!t || !w) return 0;
  if (w === t) return 1;
  if (w.startsWith(t)) return 0.85 - Math.min(0.2, (w.length - t.length) * 0.01);
  const k = allow(t); if (!k) return 0;
  const d = Math.min(editDistance(t, w, k), w.length > t.length ? editDistance(t, w.slice(0, t.length), k) + 0.5 : 9);
  return d <= k ? 0.65 - d * 0.12 : 0;
}
// Score a list of words (title first) against the query terms. Every term must match something.
export function matchScore(terms, hay) {
  if (!terms.length) return 0; let total = 0;
  for (const t of terms) { let best = 0; for (const w of hay) { const s = termScore(t, w); if (s > best) { best = s; if (s === 1) break; } } if (!best) return 0; total += best; }
  return total / terms.length;
}
export const queryTerms = (q) => words(String(q || '').replace(/^[#@]+/, ''));

// ---------------------------------------------------------------- built-in catalog
export const GAMES = [
  ['quest', 'Kemy’s Bubble Quest', 'kemy-quest.html', 'platformer axolotl bubbles adventure levels'],
  ['pool', 'Star Pool', '#/games/pool', 'pool billiards 8 ball snooker'],
  ['chess', 'Chess', '#/games/chess', 'chess checkmate board'],
  ['ludo', 'Ludo', '#/games/ludo', 'ludo dice race board'],
  ['checkers', 'Checkers', '#/games/checkers', 'checkers draughts board'],
  ['stardrop', 'Star Drop', '#/games/stardrop', 'connect four in a row'],
  ['starcards', 'Star Cards', '#/games/starcards', 'cards uno card game last star'],
  ['trivia', 'Studio Trivia', '#/games/trivia', 'trivia quiz questions'],
  ['klgrid', 'KL Grid', '#/games/klgrid', 'tic tac toe ultimate grid'],
  ['palgames', 'Pal Games', '#/games/pals', 'pal race bubble pop star catch dance off'],
  ['bingo', 'Pal Bingo', '#/arcade/bingo', 'bingo hall 75 ball daub call tap friends', 'assets/bingo-cover.svg'],
  ['park', 'Pal Park', '#/park', 'pal park walk treasures friends']
].map(([id, name, href, kw, cover]) => ({ id, name, href, kw, kind: 'game', cat: 'gaming', ...(cover ? { cover } : {}) }));
export const PAGES = [
  { id: 'music', name: 'Music', href: '#/music', kw: 'music songs music videos kidz bop playlist listen', kind: 'page', cat: 'music', emoji: '🎵' },
  { id: 'aimovie', name: 'AI Movie Maker', href: '#/new/aimovie', kw: 'ai movie maker make a movie story animation', kind: 'page', cat: 'movies', emoji: '🎬' },
  { id: 'pals', name: 'Kemy Pals', href: '#/pals', kw: 'pals virtual pet hatch egg', kind: 'page', cat: 'pals', emoji: '🐾' },
  { id: 'movies', name: 'Community Movies', href: '#/explore/movies', kw: 'movies films series episodes', kind: 'page', cat: 'movies', emoji: '🎞️' },
  { id: 'songs', name: 'Community Songs', href: '#/explore/songs', kw: 'songs music tracks', kind: 'page', cat: 'music', emoji: '🎶' },
  { id: 'live', name: 'Go live', href: '#/live/new', kw: 'live stream broadcast', kind: 'page', cat: 'other', emoji: '🔴' },
  { id: 'share', name: 'Share Kemy', href: '#/share', kw: 'share qr code link get the app download scan', kind: 'page', cat: 'other', emoji: '📲' },
  { id: 'theme', name: 'Kemy’s theme: Kemy on the Screen', href: '#/settings', kw: 'kemy on the screen theme song keem lone keem music', kind: 'page', cat: 'music', emoji: '🎵' }
];
// Pals come from js/pals/species.js (lazy, so search doesn't load the Pals art up front).
let palCache = null;
export async function palItems() {
  if (palCache) return palCache;
  try { const { SPECIES } = await import('./pals/species.js'); palCache = SPECIES.map((s) => ({ id: s.id, name: s.name, href: '#/pals/gallery', kw: [s.vibe, ...(s.forms || [])].join(' '), kind: 'pal', cat: 'pals' })); }
  catch { palCache = []; }
  return palCache;
}
export function searchCatalog(terms, list) {
  return list.map((x) => ({ x, s: matchScore(terms, [...words(x.name), ...words(x.kw)]) })).filter((r) => r.s > 0).sort((a, b) => b.s - a.s).map((r) => r.x);
}

// ---------------------------------------------------------------- groups
export const GROUPS = [
  ['top', 'Top'], ['videos', 'Videos'], ['music', 'Music & Songs'], ['mvideos', 'Music Videos'], ['movies', 'Movies & Series'],
  ['creators', 'Creators'], ['pals', 'Pals'], ['games', 'Games'], ['hashtags', 'Hashtags']
];
const MV = /\b(music ?video|official video|mv|lyric|lyrics|song|kidz bop|dance video|remix|cover)\b/i;
// Which group a Kemy post or outside item belongs to.
export function groupOf(p) {
  if (p.external) return p.kind === 'news' ? 'videos' : (p.cat === 'music' || MV.test(p.text || '')) ? 'mvideos' : 'videos';
  if (p.type === 'song') return 'music';
  if (p.type === 'movie') return catOf(p) === 'music' || p.work?.genre === 'Music' ? 'mvideos' : 'movies';
  if (p.mediaType === 'video' || p.linkUrl) return catOf(p) === 'music' ? 'mvideos' : 'videos';
  return 'posts';
}
export const itemHay = (p) => [...words(p.work?.title), ...words(p.text), ...words(p.authorName), ...words(p.authorUsername), fold(p.authorUsername || ''),
  ...words(p.source), ...(p.hashtags || []), ...words(p.work?.artist), ...words(p.work?.genre), ...words(catOf(p))];
// Rank: relevance first, then a little engagement and freshness so ties favour good, recent posts.
export function rankItems(terms, items) {
  const now = Date.now();
  return items.map((p) => {
    const titleS = matchScore(terms, [...words(p.work?.title || p.text).slice(0, 12)]);
    const s = Math.max(titleS * 1.15, matchScore(terms, itemHay(p)));
    if (!s) return null;
    const t = p.createdAt?.toMillis?.() || Date.parse(p.published || '') || 0;
    const eng = Math.log1p((p.likeCount || 0) * 2 + (p.commentCount || 0) * 3 + (p.viewCount || 0) * 0.2 + (p.external ? Math.log10(1 + (p.views || 0)) : 0));
    return { p, s: s * 10 + eng * 0.4 + (t ? 2 / (1 + (now - t) / 6048e5) : 0) + (p.studio || p.authorId === 'studio' ? 0.5 : 0) };
  }).filter(Boolean).sort((a, b) => b.s - a.s).map((r) => r.p);
}

// ---------------------------------------------------------------- trending searches (shared, free-tier friendly)
// One small doc per (day, normalized query): searchTrends/{day}_{slug} { day, q, n }. Each signed-in user
// adds at most one count per query per day (remembered on the device), only for kid-safe queries
// of 2-30 plain characters. The list shows queries searched by 2+ people today/yesterday.
export const trendSlug = (q) => fold(q).replace(/[^a-z0-9# ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
export const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
export function trendKey(q) { const s = trendSlug(q); return s.length >= 2 && !blockedQuery(s) ? s : ''; }
export function createTrends({ db, fs, getUid }) {
  const { doc, getDoc, setDoc, updateDoc, increment, getDocs, collection, query, where, orderBy, limit } = fs;
  const SEEN = 'kemy-trend-seen';
  let cache = null, at = 0;
  async function count(q) {
    const s = trendKey(q); if (!s || !getUid()) return;
    const day = dayKey(); let seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch { /* */ }
    if (seen.day !== day) seen = { day, q: [] };
    if (seen.q.includes(s) || seen.q.length >= 30) return;
    seen.q.push(s); localStorage.setItem(SEEN, JSON.stringify(seen));
    const id = day + '_' + s.replace(/[#\s]/g, (c) => (c === '#' ? '~' : '-'));
    const ref = doc(db, 'searchTrends', id);
    try { await updateDoc(ref, { n: increment(1) }); }
    catch { try { await setDoc(ref, { day, q: s, n: 1 }); } catch { /* someone else created it: ignore */ } }
  }
  async function top(n = 10) {
    if (cache && Date.now() - at < 5 * 60e3) return cache.slice(0, n);
    const days = [dayKey(), dayKey(Date.now() - 864e5)], m = new Map();
    for (const day of days) {
      try { const s = await getDocs(query(collection(db, 'searchTrends'), where('day', '==', day), orderBy('n', 'desc'), limit(20)));
        s.docs.forEach((d) => { const x = d.data(); if (!blockedQuery(x.q)) m.set(x.q, (m.get(x.q) || 0) + x.n); }); } catch { /* offline / index building */ }
    }
    cache = [...m.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).map(([q, c]) => ({ q, c })); at = Date.now();
    return cache.slice(0, n);
  }
  return { count, top };
}
