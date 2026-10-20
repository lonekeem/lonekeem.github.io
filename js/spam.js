// Kemy anti-spam: cooldowns, daily post cap for new accounts, repeat / near-duplicate blocking,
// link limits, caps / repeated letters / emoji walls, mass DMs and mass follows.
// Friendly "Slow down a bit 💜" notes; repeat offenders get the same 1-hour auto pause + Mod Hub
// report the kind-words filter uses (safety.autoPause). firestore.rules enforces the parts it can
// (cooldowns, daily cap, links, follow / new-chat rate). Written by Lone Keem
let C = null; // { S, toast, isAdmin, autoPause }
export function initSpam(ctx) { C = ctx; }

export const SPAM = {
  cooldown: { post: 20e3, comment: 5e3, dm: 1.2e3, live: 2e3, park: 2e3, game: 1.5e3 },
  newAcctDays: 3, newDailyPosts: 5, maxLinks: 2,
  dupWindow: { post: 864e5, comment: 36e5, dm: 6e5, live: 6e5, park: 3e5, game: 0 },
  dmNewPeople: { n: 6, ms: 10 * 60e3 }, follows: [{ n: 6, ms: 30e3 }, { n: 30, ms: 10 * 60e3 }],
  strikes: { n: 5, ms: 10 * 60e3 }
};
const now = () => Date.now();
const LS = 'kemy-spam-';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(LS + k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch {} };
const uid = () => (C && C.S.user && C.S.user.uid) || '';
const exempt = () => !C || !C.S.user || (C.isAdmin && C.isAdmin());
const msOf = (t) => !t ? 0 : typeof t.toMillis === 'function' ? t.toMillis() : t instanceof Date ? t.getTime() : typeof t.seconds === 'number' ? t.seconds * 1000 : Number(t) || 0;
export const isNewAccount = (p = C && C.S.profile) => { const c = msOf(p && p.createdAt); return !c || now() - c < SPAM.newAcctDays * 864e5; };

// ---- text checks (pure, exported for tests)
const LINK_RE = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|io|gg|xyz|ly|co|me|tv|app|link|site|online|shop|info|biz|ru|tk|click|top)\b(?:\/\S*)?/gi;
export const countLinks = (t) => (String(t || '').replace(/https:\/\/res\.cloudinary\.com\/\S*/g, '').match(LINK_RE) || []).length;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
export function textProblem(text, { newAcct = false, kind = 'post' } = {}) {
  const t = String(text || '');
  const links = countLinks(t);
  if (links && newAcct && kind !== 'park' && kind !== 'game') return 'New accounts can share links after 3 days. Thanks for understanding!';
  if (links > SPAM.maxLinks) return `Please use at most ${SPAM.maxLinks} links at a time.`;
  const letters = t.replace(/[^\p{L}]/gu, ''), ups = letters.replace(/[^\p{Lu}]/gu, '');
  if (letters.length >= 12 && ups.length / letters.length > 0.7) return 'That’s a lot of CAPS. Try regular letters?';
  const emo = (t.match(EMOJI_RE) || []).length, solid = [...t.replace(/[\s\u200d\ufe0f]/g, '')].length;
  if (emo >= 12 && emo / Math.max(1, solid - emo) > 1.5) return 'That’s a lot of emoji at once. Keep it to a few?';
  if (/(.)\1{7,}/su.test(t.replace(/\s/g, '')) || /(\S{1,4})\1{6,}/su.test(t.replace(/\s/g, ''))) return 'Too many repeated letters.';
  return '';
}
const norm = (t) => String(t || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/https?:\/\/\S+/g, 'L').replace(/[^\p{L}\p{N}]+/gu, '').replace(/(.)\1+/g, '$1');
function grams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
export function similar(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return false; if (a === b) return true;
  if (a.length < 6 || b.length < 6) return false;
  const A = grams(a), B = grams(b); let both = 0; for (const [g, n] of A) both += Math.min(n, B.get(g) || 0);
  return (2 * both) / (a.length - 1 + b.length - 1) >= 0.85;
}

// ---- strikes -> pause + Mod Hub report
function strike(reason, text) {
  const k = 'strikes-' + uid(); const s = load(k, []).filter((x) => now() - x < SPAM.strikes.ms); s.push(now()); save(k, s);
  if (s.length >= SPAM.strikes.n && C.autoPause) { save(k, []); C.autoPause({ reason: 'Kept spamming: ' + reason, text, word: '' }); return true; }
  return false;
}
function slow(msg, text, isStrike = true) {
  const paused = isStrike && !exempt() && strike(msg, text);
  if (!paused) C.toast('Slow down a bit 💜 ' + msg);
  return false;
}

// Main gate before any write that carries text. kind: post | comment | dm | live | park | game.
// Returns true if OK to send (and records it), false if blocked (note already shown).
export function spamOk(kind, text = '', { to = '', linkUrl = '' } = {}) {
  if (exempt()) return true;
  const u = uid(), t = now();
  const lastK = `last-${kind}-${u}`, last = load(lastK, 0), cd = SPAM.cooldown[kind] || 0;
  if (cd && t - last < cd) return slow(`You can send again in ${Math.ceil((cd - (t - last)) / 1000)} s.`, text, false);
  if (kind === 'post' && isNewAccount()) {
    const day = Math.floor(t / 864e5), p = C.S.profile || {};
    if (p.postDay === day && (p.postsToday || 0) >= SPAM.newDailyPosts) return slow(`New accounts can make ${SPAM.newDailyPosts} posts a day. More unlock after 3 days!`, text, false);
  }
  const prob = textProblem(text + (linkUrl && isNewAccount() && !/youtu|tiktok/.test(linkUrl) ? ' ' + linkUrl : ''), { newAcct: isNewAccount(), kind });
  if (prob) return slow(prob, text);
  const win = SPAM.dupWindow[kind] || 0;
  if (win && norm(text)) {
    const hk = `hist-${kind === 'post' || kind === 'comment' ? 'pc' : 'chat'}-${u}`;
    const hist = load(hk, []).filter((h) => t - h.t < win);
    // posts / comments: no repeats; chat: the same line at most twice in the window
    const same = hist.filter((h) => similar(h.x, text));
    const tooMany = (kind === 'post' || kind === 'comment') ? same.length >= 1 : same.length >= 2;
    if (tooMany) return slow('That looks like the same message again. Try saying something new!', text);
    hist.push({ t, x: String(text).slice(0, 300), to }); save(hk, hist.slice(-30));
  }
  if (kind === 'dm' && to) {
    const k = 'dmto-' + u, list = load(k, []).filter((x) => t - x.t < SPAM.dmNewPeople.ms);
    if (!list.some((x) => x.to === to) && new Set(list.map((x) => x.to)).size >= SPAM.dmNewPeople.n) return slow('You’re messaging a lot of people at once. Take a short break!', text);
    list.push({ t, to }); save(k, list.slice(-50));
  }
  save(lastK, t);
  return true;
}
export function followOk() {
  if (exempt()) return true;
  const k = 'follows-' + uid(), t = now(), list = load(k, []).filter((x) => t - x < 10 * 60e3);
  for (const w of SPAM.follows) if (list.filter((x) => t - x < w.ms).length >= w.n) return slow('You’re following lots of people really fast. Take a short break!', '');
  list.push(t); save(k, list); return true;
}
// Fields to write with lastPostAt (daily cap counter, checked by firestore.rules).
export function postStamp(authorId, ts) {
  const o = { lastPostAt: ts };
  if (!C || !C.S.user || authorId !== C.S.user.uid) return o;
  const p = C.S.profile || {}, day = Math.floor(now() / 864e5);
  o.postDay = Math.max(day, p.postDay || 0); o.postsToday = p.postDay === o.postDay ? (p.postsToday || 0) + 1 : 1;
  return o;
}
// Call after a successful post commit so the next counter is right.
export function postDone(stamp) { if (C && C.S.profile && stamp && 'postDay' in stamp) Object.assign(C.S.profile, { postDay: stamp.postDay, postsToday: stamp.postsToday }); }
