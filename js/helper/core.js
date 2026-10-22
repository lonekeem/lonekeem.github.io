// Pure checks for Kemy Helper. No Firebase, no DOM, so the rate limit and the
// "no private data" scrub can be tested on their own. Written by Lone Keem.

export const TYPES = ['error', 'reject', 'load', 'fps', 'stuck', 'bounds', 'under', 'wall', 'float', 'nan', 'desync', 'turn', 'note'];
export const FIX_TOAST = 'Kemy Helper fixed that!';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\b(?:\+?\d[\d\s().-]{7,}\d)\b/g;
const URL = /https?:\/\/\S+/gi;
const HANDLE = /@\w+/g;
const SECRET = /\b(?:password|token|secret|bearer|api[_-]?key)\b\s*[:=]?\s*\S*/gi;

export function scrub(s) {
  return String(s || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(EMAIL, '')
    .replace(PHONE, '')
    .replace(URL, '')
    .replace(HANDLE, '')
    .replace(/@/g, '')
    .replace(SECRET, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export function gameId(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
}

export function placeOf(area, x, z) {
  const name = String(area || '').replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Kemy';
  if (!Number.isFinite(x) || !Number.isFinite(z)) return name;
  const gx = Math.round(x / 20) * 20;
  const gz = Math.round(z / 20) * 20;
  return (name + ' ' + gx + ',' + gz).slice(0, 48);
}

export function deviceLabel(env = {}) {
  const w = Number(env.width) || 0;
  const h = Number(env.height) || 0;
  const phone = Math.min(w, h) > 0 && Math.min(w, h) < 760;
  return (phone ? 'phone' : 'computer') + (env.saveData ? ' saver' : '');
}

export function fingerprint(issue) {
  return (issue.type || 'note') + '|' + gameId(issue.game) + '|' + scrub(issue.text).slice(0, 60);
}

// Same note is skipped for 10 minutes. At most 8 notes per 10 minutes, and
// two writes at least 2 seconds apart so one scan can file a couple of issues.
export function allowSend(mem, now, fp) {
  const at = (mem.at || []).filter((t) => now - t < 600000);
  mem.at = at;
  if (at.length >= 8) return false;
  const prev = mem.fp && mem.fp.get(fp);
  if (prev && now - prev < 600000) return false;
  if (at.length && now - at[at.length - 1] < 2000) return false;
  return true;
}

export function markSent(mem, now, fp) {
  if (!mem.at) mem.at = [];
  if (!mem.fp) mem.fp = new Map();
  mem.at.push(now);
  mem.fp.set(fp, now);
}

export function groupKey(r) {
  return (r.type || 'note') + '|' + scrub(r.text).slice(0, 60);
}

export function turnOf(g) {
  if (!g || g.status !== 'active') return -1;
  if (g.lv && typeof g.lv.turn === 'number') return g.lv.turn;
  if (g.pv && typeof g.pv.turn === 'number') return g.pv.turn;
  if (typeof g.turn === 'number') return g.turn;
  return -1;
}

export function freshMem() {
  return { at: [], fp: new Map(), toastAt: 0 };
}
