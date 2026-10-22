// House TV helpers. YouTube is the full-length option. Spotify and Apple stay 30-second
// previews unless the listener is signed in to their own paid account.
// These links belong in homes/{plot}.radio only. Chat, names, and bios still go through
// kidSafe, which blocks https:// — do not run a TV link through that filter.

export const PREVIEW_NOTE = 'Spotify & Apple Music play 30-sec previews unless signed in to your own paid account';
export const YT_MAX = 20;
export const TITLE_MAX = 80;
export const LIST_MAX = 2400;

export const RADIO_RE = /^https:\/\/(?:open\.spotify\.com|embed\.music\.apple\.com|music\.apple\.com|(?:www\.|m\.)?youtube\.com|(?:www\.)?youtube-nocookie\.com|(?:www\.)?youtu\.be)\//;

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const BAD_TITLE = /https?:\/\/|www\.|discord\.gg|discord\.com/i;

// Accepts watch, youtu.be, shorts, embed, live, m.youtube.com, and music.youtube.com.
// Timed params (t, start, end) are ignored so the house TV never cuts the video short.
export function ytId(url) {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
      id = u.searchParams.get('v') || (u.pathname.match(/\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/) || [])[1] || '';
    }
    return YT_ID.test(id) ? id : '';
  } catch { return ''; }
}

export function ytWatchUrl(id) { return 'https://www.youtube.com/watch?v=' + id; }

// playsinline is always on (iPhone Safari and Android TWA). autoplay is only set for a real tap.
// There is no start= and no end=, so nothing here is a 30-second preview.
export function ytEmbedSrc(id, { autoplay = false, origin = '' } = {}) {
  const q = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', modestbranding: '1' });
  if (autoplay) q.set('autoplay', '1');
  if (origin) q.set('origin', origin);
  return 'https://www.youtube-nocookie.com/embed/' + id + '?' + q.toString();
}

export function radioLinkOk(url) {
  const u = String(url || '').trim();
  if (!u || u.length > 300) return false;
  if (ytId(u)) return true;
  return RADIO_RE.test(u) && !/youtube|youtu\.be/i.test(u);
}

export function canonicalLink(url) {
  const id = ytId(url);
  return id ? ytWatchUrl(id) : String(url || '').trim();
}

export function cleanTitle(raw) {
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX);
}

export function titleOk(t) {
  return typeof t === 'string' && t.length >= 1 && t.length <= TITLE_MAX && !/[\n\t]/.test(t) && !BAD_TITLE.test(t);
}

export function safeTitle(raw) {
  const t = cleanTitle(raw);
  return titleOk(t) ? t : 'YouTube';
}

export function parseYtList(raw) {
  const out = []; const seen = new Set();
  for (const line of String(raw || '').split('\n')) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const id = line.slice(0, tab);
    if (!YT_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title: safeTitle(line.slice(tab + 1)) });
    if (out.length >= YT_MAX) break;
  }
  return out;
}

// One video per line: "VIDEOID<tab>Title\n". Empty string means no list (omit the field).
export function serYtList(items) {
  const lines = []; const seen = new Set();
  for (const it of items || []) {
    const id = String((it && it.id) || '');
    if (!YT_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    lines.push(id + '\t' + safeTitle(it.title));
    if (lines.length >= YT_MAX) break;
  }
  return lines.map((l) => l + '\n').join('');
}

export function ytListOk(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= LIST_MAX
    && /^([A-Za-z0-9_-]{11}\t[^\n\t]{1,80}\n){1,20}$/.test(s) && !BAD_TITLE.test(s);
}

// Playback identity ignores the saved list, so a rename or reorder does not restart the video.
export function playKeyOf(Rd) {
  if (!Rd || (Rd.k !== 'link' && Rd.k !== 'kemy')) return '';
  if (Rd.k === 'kemy') return 'kemy|' + (Rd.t | 0);
  const id = ytId(Rd.url || '');
  if (id) return 'link|' + id;
  const u = String(Rd.url || '').trim();
  return radioLinkOk(u) ? 'link|' + u : '';
}

// Build the radio map the owner writes. The whole map is replaced on merge, so the list and
// the last link are copied forward. Pass list:'' to clear it. A YouTube url is stored without t/start/end.
export function radioKeep(prev, next) {
  const p = prev || {}; const n = next || {};
  const k = n.k === 'link' || n.k === 'kemy' || n.k === 'off' ? n.k : 'off';
  const out = { k };
  if (k === 'link') {
    const u = canonicalLink(n.url != null ? n.url : '');
    if (!radioLinkOk(u)) return null;
    out.url = u;
  } else {
    const keep = canonicalLink(p.url || '');
    if (keep && radioLinkOk(keep)) out.url = keep;
  }
  if (k === 'kemy') {
    const t = n.t | 0;
    out.t = t >= 0 && t < 50 ? t : 0;
    const s = Number(n.s);
    out.s = Number.isFinite(s) ? Math.round(s) : Date.now();
  }
  let list = '';
  if (n.list === '') list = '';
  else if (n.list != null) list = typeof n.list === 'string' && ytListOk(n.list) ? n.list : serYtList(typeof n.list === 'string' ? parseYtList(n.list) : n.list);
  else if (typeof p.list === 'string' && p.list) list = ytListOk(p.list) ? p.list : serYtList(parseYtList(p.list));
  if (list) out.list = list;
  return out;
}
