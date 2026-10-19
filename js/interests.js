// Lone Keem Studios - "Your interests": one shared For You interest store (js/feedrank.js) used by the
// feed, search and Settings, plus the onboarding topic picker. Searches and tapped search results
// nudge the same category / creator weights the feed already learns from watching.
import { createPrefsStore } from './feedrank.js';
import { CATS, catOf } from './feed-cats.js';
import { parseHashtags } from './search-index.js';

export const TOPICS = ['funny', 'dance', 'music', 'gaming', 'pals', 'news', 'movies', 'animals', 'sports', 'art', 'learning'];
let store = null, storeUid = null, env = null;
// Call once from app.js with { S, db, fs: { doc, getDoc, setDoc, serverTimestamp } }.
export function initInterests(e) { env = e; }
export function prefsStore() {
  if (!env) throw new Error('initInterests first');
  const uid = env.S.user?.uid || '';
  if (!store || storeUid !== uid) { store?.flush(true); store = createPrefsStore({ db: env.db, fs: env.fs, uid }); storeUid = uid; }
  return store;
}
// Category a search query points at ("#dance", "funny cats", "kidz bop songs").
export function queryCat(q) {
  const t = String(q || '');
  return catOf({ text: t.replace(/#/g, ' '), hashtags: parseHashtags(t) }) || (/\b(song|songs|music|mv|kidz ?bop|lyrics?|singer|band)\b/i.test(t) ? 'music' : '');
}
// A submitted search: boosts its category (if any).
export function learnSearch(q) {
  const cat = queryCat(q); if (!cat) return '';
  try { prefsStore().signal({ id: 'search:' + cat, cat }, 'search'); } catch { /* */ }
  return cat;
}
// A tapped search result: boosts its category and creator (Kemy user uid or YouTube channel).
export function learnTap(item) {
  if (!item) return;
  const p = item.uid ? { id: 'u:' + item.uid, authorId: item.uid, cat: item.cat || '' } : item;
  try { prefsStore().signal(p, 'tap'); } catch { /* */ }
}
export function pickTopics(ids) {
  prefsStore().edit((pr) => { for (const id of ids) if (TOPICS.includes(id)) pr.cats[id] = Math.max(pr.cats[id] || 0, 2); });
}
export const topicChips = (name = 'topic', picked = []) => `<div class="topic-chips">${TOPICS.map((id) => { const c = CATS.find((x) => x.id === id);
  return `<label class="catchip"><input type="checkbox" name="${name}" value="${id}" ${picked.includes(id) ? 'checked' : ''}><span>${c.emoji} ${c.label}</span></label>`; }).join('')}</div>`;
export const pickedTopics = (root, name = 'topic') => [...root.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value).filter((v) => TOPICS.includes(v));

// Settings > Your interests.
export async function interestsPage({ main, esc, toast, getDoc, doc, db, loadDiscover, stale, token }) {
  const st = prefsStore(); await st.load();
  if (stale && stale(token)) return;
  const root = document.createElement('div'); main.innerHTML = ''; main.appendChild(root);
  const disc = await loadDiscover().catch(() => ({ videos: [] }));
  const ytName = new Map(disc.videos.map((v) => ['yt:' + v.channelId, v.source]));
  const names = new Map();
  async function nameOf(k) {
    if (names.has(k)) return names.get(k);
    let n = k.startsWith('yt:') ? (ytName.get(k) || 'YouTube channel') + ' · YouTube' : k.startsWith('news:') ? k.slice(5) : '';
    if (!n) { try { const s = await getDoc(doc(db, 'users', k)); n = s.exists() ? '@' + s.data().username : 'Creator'; } catch { n = 'Creator'; } }
    names.set(k, n); return n;
  }
  async function paint() {
    const pr = st.prefs;
    const cats = Object.entries(pr.cats || {}).filter(([k, v]) => v > 0.05 && CATS.some((c) => c.id === k)).sort((a, b) => b[1] - a[1]);
    const crs = Object.entries(pr.creators || {}).filter(([, v]) => v > 0.05).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const bar = (v) => `<span class="ibar" aria-hidden="true"><span style="width:${Math.min(100, Math.round(v / 5 * 100))}%"></span></span>`;
    root.innerHTML = `<h1 class="page-title">Your interests</h1>
      <p class="muted">Kemy uses these to put things you like first in <b>For You</b>. They come from the topics you pick, what you watch, star, share and save, and what you search for and tap in search. They stay private to you.</p>
      <section class="card pad"><h2 style="font-size:1.05rem">Favorite topics</h2><form id="i-topics">${topicChips('topic', cats.filter(([, v]) => v >= 2).map(([k]) => k))}<button class="btn btn-sm" type="submit" style="margin-top:10px">Save topics</button></form></section>
      <section class="card pad" style="margin-top:16px"><h2 style="font-size:1.05rem">Topics Kemy learned</h2>
        ${cats.length ? `<ul class="ilist">${cats.map(([k, v]) => { const c = CATS.find((x) => x.id === k); return `<li><span>${c.emoji} ${c.label}</span>${bar(v)}<button class="btn btn-sm btn-ghost" data-rm-cat="${k}" aria-label="Remove ${c.label}">Remove</button></li>`; }).join('')}</ul>` : '<p class="muted small">Nothing yet. Watch, search and star things you like.</p>'}</section>
      <section class="card pad" style="margin-top:16px"><h2 style="font-size:1.05rem">Creators &amp; channels</h2>
        ${crs.length ? `<ul class="ilist" id="i-crs">${crs.map(([k, v]) => `<li><span data-nm="${esc(k)}">…</span>${bar(v)}<button class="btn btn-sm btn-ghost" data-rm-cr="${esc(k)}">Remove</button></li>`).join('')}</ul>` : '<p class="muted small">No creators yet.</p>'}</section>
      <section class="card pad" style="margin-top:16px"><h2 style="font-size:1.05rem">Start over</h2><p class="muted small">Clears learned topics, creators and recently watched, so For You starts fresh. Your search history is in Search (Clear all).</p>
        <button class="btn btn-sm btn-danger" id="i-reset" type="button">Reset interests</button></section>
      <p style="margin-top:16px"><a href="#/settings">← Back to settings</a></p>`;
    root.querySelectorAll('[data-nm]').forEach(async (el) => { el.textContent = await nameOf(el.dataset.nm); });
  }
  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-rm-cat]'), r = e.target.closest('[data-rm-cr]');
    if (c) { st.edit((pr) => { delete pr.cats[c.dataset.rmCat]; }); toast('Removed'); paint(); }
    else if (r) { st.edit((pr) => { delete pr.creators[r.dataset.rmCr]; }); toast('Removed'); paint(); }
    else if (e.target.closest('#i-reset')) { if (!confirm('Reset your interests? For You will start fresh.')) return; st.edit((pr) => { pr.cats = {}; pr.creators = {}; pr.seen = {}; }); toast('Interests reset'); paint(); }
  });
  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'i-topics') return; e.preventDefault();
    const ids = pickedTopics(e.target);
    st.edit((pr) => { for (const id of TOPICS) { if (ids.includes(id)) pr.cats[id] = Math.max(pr.cats[id] || 0, 2); else if ((pr.cats[id] || 0) >= 2) pr.cats[id] = 0.5; } });
    toast('Topics saved'); paint();
  });
  await paint();
}
