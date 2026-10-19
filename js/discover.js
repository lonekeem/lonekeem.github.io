// Lone Keem Studios - outside content for the Funny / News tabs, from data/discover.json.
// That file is built by scripts/discover-fetch.mjs (GitHub Action, every 6 h) from the curated,
// family-friendly list in data/discover-sources.json. We never copy or re-upload anyone's video:
// YouTube items are youtube-nocookie embeds (loaded only when you tap Watch) and news items are
// headline cards that link to the original article. Each is clearly labelled with its source.
let cache = null, at = 0;
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export async function loadDiscover() {
  if (cache && Date.now() - at < 30 * 60e3) return cache;
  try {
    const r = await fetch('data/discover.json?h=' + Math.floor(Date.now() / 36e5), { cache: 'default' });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    const videos = (d.videos || []).filter((v) => /^[\w-]{11}$/.test(v.id)).map((v) => ({
      id: 'yt-' + v.id, external: true, kind: 'youtube', ytId: v.id, short: !!v.short, own: !!v.own,
      linkUrl: v.short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
      text: v.title, source: v.channel, channelId: v.channelId, cat: v.cat, published: v.published, views: v.views || 0,
      sourceUrl: `https://www.youtube.com/channel/${v.channelId}`
    }));
    const news = (d.news || []).filter((n) => /^https:\/\//.test(n.url)).map((n) => ({
      id: 'news-' + hash(n.url), external: true, kind: 'news', cat: 'news', text: n.title, url: n.url, summary: n.summary || '',
      source: n.source, sourceUrl: n.site || '', image: n.image || '', published: n.published, channelId: 'news:' + n.source
    }));
    cache = { videos, news, updatedAt: d.updatedAt || '' }; at = Date.now();
  } catch { cache = cache || { videos: [], news: [], updatedAt: '' }; }
  return cache;
}
