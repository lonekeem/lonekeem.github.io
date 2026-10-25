// Kemy Helper's background watch. Listeners are installed once. World and game
// checks are throttled. Notes go to helperReports with no names, emails, or exact trails.
// Written by Lone Keem.
import { auth, db } from '../firebase-init.js';
import { doc, getDoc, writeBatch, collection, serverTimestamp } from '../fsq.js';
import { scrub, gameId, deviceLabel, fingerprint, allowSend, markSent, turnOf, freshMem, TYPES, FIX_TOAST } from './core.js';

const mem = freshMem();
const pending = new Set();
let toastFn = () => {};
let started = false;
let gameWatch = null;
let placeNow = () => ({ game: '', place: '' });

function toastFix() {
  const now = Date.now();
  if (now - mem.toastAt < 5000) return;
  mem.toastAt = now;
  try { toastFn(FIX_TOAST); } catch { /* a toast should never break the game */ }
}

// The player hears about a fix even when the note itself is still in the rate-limit window.
export function toastFixed() { toastFix(); }

export function setHelperPlace(fn) { placeNow = typeof fn === 'function' ? fn : placeNow; }

export function seeGame(info) {
  gameWatch = info || null;
}

async function writeNote(issue, fp) {
  const user = auth.currentUser;
  if (!user || !issue || !TYPES.includes(issue.type)) return false;
  const text = scrub(issue.text);
  if (issue.type === 'note' && text.length < 2) return false;
  const now = Date.now();
  const where = placeNow();
  const data = {
    type: issue.type,
    game: gameId(issue.game != null ? issue.game : where.game),
    place: String(issue.place != null ? issue.place : where.place || '').slice(0, 48),
    device: deviceLabel({
      width: screen.width, height: screen.height,
      saveData: !!(navigator.connection && navigator.connection.saveData)
    }),
    text: text || issue.type,
    autoFixed: !!issue.autoFixed,
    status: 'open',
    at: serverTimestamp()
  };
  const qref = doc(db, 'helperQuota', user.uid);
  let hStart = serverTimestamp();
  let hN = 1;
  try {
    const prev = await getDoc(qref);
    if (prev.exists()) {
      const d = prev.data();
      const startMs = d.hStart && d.hStart.toMillis ? d.hStart.toMillis() : 0;
      if (Date.now() - startMs < 600000) {
        if ((d.hN || 0) >= 8) { markSent(mem, now, fp); return false; }
        hStart = d.hStart;
        hN = (d.hN || 0) + 1;
      }
    }
    markSent(mem, now, fp);
    const batch = writeBatch(db);
    batch.set(qref, { hStart, hN, at: serverTimestamp() });
    batch.set(doc(collection(db, 'helperReports')), data);
    await batch.commit();
  } catch {
    return false;
  }
  if (issue.autoFixed) toastFix();
  return true;
}

export function note(issue) {
  const text = scrub(issue && issue.text);
  const fp = fingerprint({ ...(issue || {}), text });
  if (pending.has(fp) || !allowSend(mem, Date.now(), fp)) return Promise.resolve(false);
  pending.add(fp);
  return writeNote(issue, fp).catch(() => false).finally(() => pending.delete(fp));
}

function onError(e) {
  if (e.target && e.target !== window) return;
  note({ type: 'error', text: (e && e.message) || 'script', autoFixed: false });
}

function onReject(e) {
  const r = e && e.reason;
  const text = (r && (r.message || r.code)) || 'promise';
  note({ type: 'reject', text, autoFixed: false });
}

function retryAsset(el) {
  if (!el || el.dataset.kh) return;
  const tag = el.tagName;
  if (tag !== 'IMG' && tag !== 'AUDIO' && tag !== 'VIDEO' && tag !== 'SOURCE') return;
  const src = el.currentSrc || el.src;
  if (!src || src.startsWith('blob:') || src.startsWith('data:')) return;
  el.dataset.kh = '1';
  try {
    el.removeAttribute('src');
    el.src = src;
  } catch { /* a second try is enough */ }
  note({ type: 'load', text: tag === 'IMG' ? 'picture' : 'media', autoFixed: true });
}

function onResource(e) {
  const el = e.target;
  if (!el || el === window || !el.tagName) return;
  retryAsset(el);
}

let fpsLow = 0;
let fpsN = 0;
let fpsT = 0;
function fpsTick(now) {
  if (document.hidden) { fpsN = 0; fpsT = now; setTimeout(() => requestAnimationFrame(fpsTick), 1500); return; }
  fpsN++;
  if (!fpsT) fpsT = now;
  if (now - fpsT >= 2000) {
    const fps = fpsN * 1000 / (now - fpsT);
    fpsN = 0;
    fpsT = now;
    if (fps > 0 && fps < 18) {
      if (++fpsLow >= 3) { fpsLow = 0; note({ type: 'fps', text: 'low fps', autoFixed: false }); }
    } else fpsLow = Math.max(0, fpsLow - 1);
  }
  requestAnimationFrame(fpsTick);
}

function watchGames() {
  setInterval(() => {
    const w = gameWatch;
    const g = w && w.g;
    if (!g || g.status !== 'active' || document.hidden) return;
    const uid = auth.currentUser && auth.currentUser.uid;
    if (w.grade === 're') {
      if (!w.reSince) w.reSince = Date.now();
      else if (Date.now() - w.reSince > 8000) {
        w.reSince = Date.now();
        note({ type: 'desync', game: g.type, text: 'game reconnected', autoFixed: true });
        try { w.resync && w.resync(); } catch { /* the game watcher restarts itself */ }
      }
    } else w.reSince = 0;
    const seat = Array.isArray(g.players) ? g.players[turnOf(g)] : '';
    const turnAt = g.turnAt && g.turnAt.toMillis ? g.turnAt.toMillis() : 0;
    if (uid && seat === uid && turnAt && Date.now() - turnAt > 90000) {
      note({ type: 'turn', game: g.type, text: 'turn waiting', autoFixed: true });
      try { w.resync && w.resync(); } catch { /* */ }
    }
  }, 5000);
}

export function startHelper({ toast } = {}) {
  if (toast) toastFn = toast;
  if (started) return;
  started = true;
  window.__kemyHelperSee = seeGame;
  addEventListener('error', onError);
  addEventListener('unhandledrejection', onReject);
  addEventListener('error', onResource, true);
  requestAnimationFrame(fpsTick);
  watchGames();
}

export const helperMem = mem;
