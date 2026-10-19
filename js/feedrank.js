// Lone Keem Studios - client-side feed ranking (no servers, no paid APIs).
//
// For You score = engagement × freshness × your interests, then a diversity pass:
//   engagement  log of (stars×2 + comments×3 + shares×4 + views×0.2)
//   freshness   decays with age (half weight after ~1.5 days, keeps falling slowly)
//   interests   per-category and per-creator weights learned from what you watch to the end,
//               star, comment, share or save (up) and what you swipe past quickly (down)
//   diversity   the same creator can't appear twice within 3 slots and each repeat counts less
// Trending = most engagement per hour over the last 72 h (falls back to 7 days when it's quiet).
// Interests live in localStorage and, when signed in, in users/{uid}/prefs/feed (private to you).
import { catOf, CAT_IDS } from './feed-cats.js';

const HOUR = 3600e3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ms = (p) => p.createdAt?.toMillis?.() || (typeof p.createdAt === 'number' ? p.createdAt : Date.parse(p.published || '') || 0);
export const creatorKey = (p) => p.external ? 'yt:' + (p.channelId || p.source || '') : (p.authorId || '');

export function engagement(p) {
  return (Number(p.likeCount) || 0) * 2 + (Number(p.commentCount) || 0) * 3 + (Number(p.shareCount) || 0) * 4 + (Number(p.viewCount) || 0) * 0.2;
}
export function freshness(p, now = Date.now()) {
  const h = Math.max(0, (now - ms(p)) / HOUR);
  return 1 / Math.pow(1 + h / 36, 1.2);
}
export function interest(p, prefs) {
  const c = prefs?.cats?.[catOf(p) || p.cat] || 0, a = prefs?.creators?.[creatorKey(p)] || 0;
  return clamp(1 + 0.35 * c + 0.25 * a, 0.3, 3);
}
// rnd: 0..1 jitter so the feed isn't identical every visit (exploration).
export function forYouScore(p, prefs, { now = Date.now(), following = new Set(), seen = {}, rnd = Math.random } = {}) {
  let eng = Math.log1p(engagement(p));
  if (p.external) eng = Math.log1p(Math.log10(1 + (Number(p.views) || 0)) * 2) * 0.8; // outside videos: YouTube views count much less
  let s = (1 + eng) * freshness(p, now) * interest(p, prefs);
  if (!p.external && following.has(p.authorId)) s *= 1.3;
  if (p.studio || p.authorId === 'studio') s *= 1.1;
  const last = seen[p.id]; if (last && now - last < 3 * 24 * HOUR) s *= 0.25;   // already watched lately
  return s * (1 + 0.15 * rnd());
}
export function trendingScore(p, now = Date.now()) {
  const h = Math.max(0, (now - ms(p)) / HOUR);
  return engagement(p) / Math.pow(h + 2, 1.3);
}
// Greedy re-rank: never the same creator within `gap` slots; repeats count less each time.
export function diversify(items, scoreOf, gap = 3) {
  const pool = items.map((p) => ({ p, s: scoreOf(p) })), out = [], count = {};
  while (pool.length) {
    let best = -1, bestS = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const k = creatorKey(pool[i].p);
      const recent = out.slice(-gap).some((q) => creatorKey(q) === k);
      let s = pool[i].s * Math.pow(0.6, count[k] || 0);
      if (recent) s *= 0.05;
      if (out.length && catOf(out[out.length - 1]) && catOf(out[out.length - 1]) === catOf(pool[i].p)) s *= 0.85;
      if (s > bestS) { bestS = s; best = i; }
    }
    const [{ p }] = pool.splice(best, 1);
    const k = creatorKey(p); count[k] = (count[k] || 0) + 1; out.push(p);
  }
  return out;
}
export function rankForYou(items, prefs, opts = {}) {
  return diversify(items, (p) => forYouScore(p, prefs, opts));
}
export function rankTrending(items, now = Date.now()) {
  let win = items.filter((p) => !p.external && now - ms(p) < 72 * HOUR && engagement(p) > 0);
  if (win.length < 5) win = items.filter((p) => !p.external && now - ms(p) < 7 * 24 * HOUR);
  return diversify(win, (p) => trendingScore(p, now) + 1e-6);
}
// Put one outside item after every `every` Kemy posts (Kemy creators come first).
export function mixIn(own, outside, every = 2) {
  if (!own.length) return outside.slice();
  const out = []; let j = 0;
  own.forEach((p, i) => { out.push(p); if ((i + 1) % every === 0 && j < outside.length) out.push(outside[j++]); });
  while (j < outside.length) out.push(outside[j++]);
  return out;
}

// ---------------------------------------------------------------- learned interests
const WEIGHT = { star: 1, comment: 1.2, share: 1.5, save: 1, complete: 0.6, watch: 0.4, skip: -0.4, open: 0.3 };
export function emptyPrefs() { return { v: 1, cats: {}, creators: {}, seen: {} }; }
// Pure update (used by the store below and the tests). amount scales `watch` (0..1).
export function learn(prefs, p, kind, amount = 1) {
  const w = (WEIGHT[kind] || 0) * (kind === 'watch' ? clamp(amount, 0, 1) : 1);
  if (!w) return prefs;
  const c = catOf(p) || (CAT_IDS.includes(p.cat) ? p.cat : ''), a = creatorKey(p);
  if (c) prefs.cats[c] = clamp((prefs.cats[c] || 0) * 0.98 + w, -3, 5);
  if (a) prefs.creators[a] = clamp((prefs.creators[a] || 0) * 0.98 + w * 0.8, -3, 5);
  return prefs;
}
function trim(prefs) {
  const top = (o, n) => Object.fromEntries(Object.entries(o).filter(([, v]) => Math.abs(v) > 0.05).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, n).map(([k, v]) => [k, Math.round(v * 100) / 100]));
  prefs.cats = top(prefs.cats, CAT_IDS.length); prefs.creators = top(prefs.creators, 50);
  const cut = Date.now() - 7 * 24 * HOUR;
  prefs.seen = Object.fromEntries(Object.entries(prefs.seen || {}).filter(([, t]) => t > cut).slice(-400));
  return prefs;
}
// Store: localStorage always; Firestore (own private doc) when signed in, at most once a minute.
export function createPrefsStore({ db, fs, uid }) {
  const key = 'kemy-feed-prefs-' + (uid || 'anon');
  let prefs = emptyPrefs(), dirty = false, timer = 0, loaded = null;
  try { prefs = Object.assign(emptyPrefs(), JSON.parse(localStorage.getItem(key) || '{}')); } catch { /* fresh */ }
  const ref = uid && fs ? fs.doc(db, 'users', uid, 'prefs', 'feed') : null;
  async function load() {
    if (loaded) return loaded;
    loaded = (async () => {
      if (!ref) return prefs;
      try {
        const s = await fs.getDoc(ref);
        if (s.exists()) { const d = s.data(); for (const f of ['cats', 'creators']) for (const [k, v] of Object.entries(d[f] || {})) if (!(k in prefs[f])) prefs[f][k] = v; }
      } catch { /* offline: local only */ }
      return prefs;
    })();
    return loaded;
  }
  const saveLocal = () => { try { localStorage.setItem(key, JSON.stringify(trim(prefs))); } catch { /* full */ } };
  let lastFlush = 0;
  // Writes at most once a minute (tab switches just reschedule); `force` when the app is hidden.
  async function flush(force = false) {
    if (!dirty || !ref) return;
    if (!force && Date.now() - lastFlush < 60e3) { if (!timer) timer = setTimeout(() => flush(true), 60e3 - (Date.now() - lastFlush)); return; }
    clearTimeout(timer); timer = 0; dirty = false; lastFlush = Date.now();
    trim(prefs);
    try { await fs.setDoc(ref, { cats: prefs.cats, creators: prefs.creators, updatedAt: fs.serverTimestamp() }); } catch { dirty = true; }
  }
  return {
    get prefs() { return prefs; },
    load, flush,
    signal(p, kind, amount) {
      learn(prefs, p, kind, amount);
      if (kind === 'watch' || kind === 'complete' || kind === 'skip' || kind === 'open') prefs.seen[p.id] = Date.now();
      saveLocal(); dirty = true;
      if (ref && !timer) timer = setTimeout(() => flush(true), 60e3);
    }
  };
}
