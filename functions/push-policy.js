// Kid-safe push policy for Kemy. Pure checks (no Firebase) so they can be tested on their own.
// Quiet hours 9pm–8am local, and at most 3 non-game pings a day. Game turns skip the daily cap
// but still wait until morning. Written by Lone Keem.
// ADMIN_EMAIL must match js/firebase-init.js and firestore.rules.
const ADMIN_EMAIL = 'lillykemoy1@gmail.com';
const NON_GAME_CAP = 3;
const GAME_NAMES = {
  stardrop: 'Star Drop', starcards: 'Star Cards', pool: 'Star Pool', chess: 'Chess',
  ludo: 'Ludo', trivia: 'Studio Trivia', klgrid: 'KL Grid', checkers: 'Checkers'
};

function isAdminToken(token) {
  return !!(token && token.email === ADMIN_EMAIL && token.email_verified === true);
}

// tzOffset is Date#getTimezoneOffset (minutes to add to local time to get UTC).
function clockFrom(tz, tzOffset, now = new Date()) {
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23', hour: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
      let hour = Number(parts.hour);
      if (hour === 24) hour = 0;
      if (Number.isFinite(hour) && parts.year) return { hour, day: `${parts.year}-${parts.month}-${parts.day}` };
    } catch { /* fall through to the offset */ }
  }
  const off = Number.isFinite(tzOffset) ? tzOffset : 0;
  const local = new Date(now.getTime() - off * 60000);
  return { hour: local.getUTCHours(), day: local.toISOString().slice(0, 10) };
}

function decideSend({ type, hour, day, quota }) {
  const q = quota || {};
  if (!(hour >= 0 && hour <= 23) || !day) return { ok: false, reason: 'clock' };
  if (hour >= 21 || hour < 8) return { ok: false, reason: 'quiet' };
  if (type === 'turn') return { ok: true, game: true };
  const same = q.day === day;
  const n = same ? (Number(q.n) || 0) : 0;
  if (type === 'daily' && q.lastDaily === day) return { ok: false, reason: 'already' };
  if (n >= NON_GAME_CAP) return { ok: false, reason: 'cap' };
  return {
    ok: true,
    next: { day, n: n + 1, lastDaily: type === 'daily' ? day : (q.lastDaily || '') }
  };
}

const BOT = /^cpu\d$/;
function turnIndex(g) {
  if (!g || g.status !== 'active') return null;
  if (g.lv && typeof g.lv.turn === 'number') return g.lv.turn;
  if (g.pv && typeof g.pv.turn === 'number') return g.pv.turn;
  if (typeof g.turn === 'number') return g.turn;
  return null;
}
function seatUid(g, i) {
  if (!g || !Array.isArray(g.players) || i == null || i < 0 || i >= g.players.length) return '';
  const u = g.players[i];
  return typeof u === 'string' && u && !BOT.test(u) ? u : '';
}
// Only when a live game's turn actually changes. Heartbeats and the opening move (the host
// is already looking at the board) do not ping anyone.
function turnRecipient(before, after) {
  if (!before || before.status !== 'active') return '';
  const next = turnIndex(after);
  if (next == null) return '';
  if (turnIndex(before) === next) return '';
  return seatUid(after, next);
}

function clip(s, max) {
  return String(s || '').replace(/[\u0000-\u001f]/g, ' ').replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function inboxPush(n) {
  if (!n || typeof n !== 'object') return null;
  const name = clip(n.fromName, 40) || 'A friend';
  if (n.type === 'follow') {
    return { type: 'invite', title: 'New friend', body: `${name} followed you`, url: `app.html#/u/${encodeURIComponent(n.fromUsername || '')}`, tag: 'invite-follow' };
  }
  if (n.type === 'game') {
    const pal = String(n.text || '').includes('Pal Games');
    const id = String(n.postId || '');
    return {
      type: 'invite',
      title: 'Game challenge',
      body: pal ? `${name} challenged you to ${clip(n.text, 60)}` : `${name} invited you to play`,
      url: pal ? `app.html#/games/pals/${encodeURIComponent(id)}` : `app.html#/game/${encodeURIComponent(id)}`,
      tag: 'invite-' + id.slice(0, 40)
    };
  }
  if (n.type === 'house') {
    const ring = /doorbell|rang/i.test(String(n.text || ''));
    return {
      type: 'house',
      title: 'Kemy Street',
      body: ring ? `${name} rang your doorbell` : `${name} visited your home`,
      url: 'app.html#/street',
      tag: 'house-' + String(n.postId || '').slice(0, 20)
    };
  }
  return null;
}

function turnMessage(after, gid) {
  const name = GAME_NAMES[after && after.type] || 'your game';
  const id = String(gid || '');
  return { type: 'turn', title: 'Your turn', body: `Your turn in ${name}!`, url: `app.html#/game/${encodeURIComponent(id)}`, tag: `turn-${id}` };
}

function safePath(input) {
  const s = String(input || '').trim();
  if (/^app\.html#\/[A-Za-z0-9_/?=&%.\-]{0,120}$/.test(s)) return s;
  if (/^#\/[A-Za-z0-9_/?=&%.\-]{0,120}$/.test(s)) return 'app.html' + s;
  return '';
}

function buildAnnouncement(data) {
  const d = data || {};
  const title = clip(d.title, 40);
  const body = clip(d.body, 140);
  const path = safePath(d.url || '#/feed');
  if (title.length < 2) return { error: 'Add a short title.' };
  if (body.length < 2) return { error: 'Add a short message.' };
  if (!path) return { error: 'Use a Kemy link like #/feed.' };
  return { title, body, path };
}

// A live signup, not a back-fill of an older account. createdAt within 15 minutes, plus a little clock skew.
const JOIN_WINDOW_MS = 15 * 60 * 1000;
function joinIsLive(createdAtMs, nowMs) {
  const t = Number(createdAtMs);
  const now = Number(nowMs);
  if (!Number.isFinite(t) || !Number.isFinite(now) || t <= 0) return false;
  return now + 120000 >= t && now - t <= JOIN_WINDOW_MS;
}

function hashOnly(path) {
  const i = String(path || '').indexOf('#');
  return (i >= 0 ? path.slice(i) : '#/feed').slice(0, 100);
}

module.exports = {
  ADMIN_EMAIL, NON_GAME_CAP, GAME_NAMES, isAdminToken, clockFrom, decideSend,
  turnRecipient, inboxPush, turnMessage, safePath, buildAnnouncement, hashOnly, clip, joinIsLive
};
