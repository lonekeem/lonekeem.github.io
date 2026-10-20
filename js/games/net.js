// Firestore plumbing for Games: creating / joining games and rooms, quick match, heartbeats,
// quick chat, invites and recording results. Turn-based and cheap on purpose (Spark plan).
import { spamOk } from '../spam.js';
import {
  doc, getDoc, getDocs, setDoc, updateDoc, collection, query, orderBy, limit, limitToLast, onSnapshot,
  writeBatch, serverTimestamp, runTransaction, addDoc, Timestamp, deleteField
} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { ENGINES } from './boards.js';
import { rack as poolRack, newState as poolState } from './pool-engine.js';
import { START as CHESS_START, START_CX as CHESS_CX } from './chess-engine.js';

export const BOARD_TYPES = ['stardrop', 'klgrid', 'checkers'];
export const ROOM_TYPES = ['trivia', 'starcards', 'ludo'];
export const TWO_P = [...BOARD_TYPES, 'pool', 'chess'];
export const CHESS_CLOCK = { 5: 300000, 10: 600000 };
export const EMOTES = ['GG', 'Nice!', 'Wow', 'Oops', 'Good luck', 'Rematch?', '★', 'Hmm…', 'Ha!', 'Thanks'];
export const TURN_SECONDS = 60;
export const HB_MS = 20000;
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 6 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
export const isBot = (uid) => /^cpu\d$/.test(uid);
export const tsMs = (t) => (t && t.toMillis ? t.toMillis() : 0);

export function createNet({ db, S }) {
  const meSeat = () => ({ uid: S.user.uid, name: S.profile.displayName, uname: S.profile.username, color: S.profile.color || '#8a2be2' });

  function baseGame(type, mode, extra = {}) {
    const m = meSeat();
    const g = {
      type, mode: mode || '', status: 'waiting', players: [m.uid], names: [m.name], unames: [m.uname], colors: [m.color],
      host: m.uid, invitee: '', quick: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      winnerUid: '', endReason: '', rematch: '', hb: { [m.uid]: serverTimestamp() }, ...extra
    };
    if (BOARD_TYPES.includes(type)) Object.assign(g, { board: ENGINES[type].init(mode), turn: 0, moveNo: 0, last: '', turnAt: serverTimestamp() });
    if (type === 'pool') Object.assign(g, { pos: poolRack(), ps: JSON.stringify(poolState()), shot: null, turn: 0, moveNo: 0, turnAt: serverTimestamp() });
    if (type === 'chess') Object.assign(g, { board: CHESS_START, cx: CHESS_CX, ml: '', last: '', clk: CHESS_CLOCK[mode] ? [CHESS_CLOCK[mode], CHESS_CLOCK[mode]] : [], turn: 0, moveNo: 0, turnAt: serverTimestamp() });
    return g;
  }
  async function createGame(type, mode, { invitee = '', quick = false, from = '' } = {}) {
    if (ROOM_TYPES.includes(type)) {
      for (let i = 0; i < 5; i++) {
        const code = newCode(); const ref = doc(db, 'games', code);
        const g = baseGame(type, mode, { invitee, quick, from });
        if (type === 'trivia') Object.assign(g, { round: -1, qs: [], roundLen: 15, scores: {} });
        if (type === 'starcards') Object.assign(g, { intent: {}, call: {}, seedHash: '', seeds: [] });
        if (type === 'ludo') Object.assign(g, { lv: null, rv: {}, rk: {}, left: [], moveNo: 0 });
        try {
          await runTransaction(db, async (tx) => { const s = await tx.get(ref); if (s.exists()) throw new Error('taken'); tx.set(ref, g); });
          return code;
        } catch (e) { if (e.message !== 'taken') throw e; }
      }
      throw new Error('Couldn’t make a room code. Try again.');
    }
    const ref = doc(collection(db, 'games'));
    await setDoc(ref, baseGame(type, mode, { invitee, quick, from }));
    return ref.id;
  }
  // Join a waiting game (board games start right away; rooms wait for the host).
  async function join(gid) {
    const ref = doc(db, 'games', gid); const m = meSeat();
    return runTransaction(db, async (tx) => {
      const s = await tx.get(ref); if (!s.exists()) throw new Error('That game doesn’t exist.');
      const g = s.data();
      if (g.players.includes(m.uid)) return g;
      if (g.status !== 'waiting') throw new Error('That game already started. You can watch it.');
      const max = TWO_P.includes(g.type) ? 2 : g.type === 'trivia' ? 8 : g.type === 'ludo' ? Math.max(2, Math.min(4, +g.mode || 4)) : 6;
      if (g.players.length >= max) throw new Error('That room is full.');
      if (g.invitee && g.invitee !== m.uid) throw new Error('This game is for someone else.');
      const upd = {
        players: [...g.players, m.uid], names: [...g.names, m.name], unames: [...g.unames, m.uname], colors: [...g.colors, m.color],
        updatedAt: serverTimestamp()
      };
      if (TWO_P.includes(g.type)) Object.assign(upd, { status: 'active', turnAt: serverTimestamp() });
      tx.update(ref, upd);
      return { ...g, ...upd };
    });
  }
  // Quick match: one queue slot per game (and mode). If someone fresh is waiting, take their
  // game; otherwise open a game and wait in the slot.
  async function quickMatch(type, mode) {
    const qid = mode && mode !== 'classic' && (BOARD_TYPES.includes(type) || type === 'chess' || type === 'ludo') ? `${type}-${mode}` : type;
    const qref = doc(db, 'gameQueue', qid);
    const snap = await getDoc(qref).catch(() => null);
    const q = snap && snap.exists() ? snap.data() : null;
    if (q && q.uid && q.uid !== S.user.uid && q.gid && Date.now() - tsMs(q.at) < 90000) {
      try {
        await runTransaction(db, async (tx) => {
          const s = await tx.get(qref);
          if (!s.exists() || s.data().gid !== q.gid) throw new Error('moved');
          tx.set(qref, { gid: '', uid: '', at: serverTimestamp() });
        });
        await join(q.gid);
        return q.gid;
      } catch (e) { /* someone else took it: open our own */ }
    }
    const gid = await createGame(type, mode, { quick: true });
    await setDoc(qref, { gid, uid: S.user.uid, at: serverTimestamp() });
    return gid;
  }
  async function leaveQueue(type, mode, gid) {
    const qid = mode && mode !== 'classic' && (BOARD_TYPES.includes(type) || type === 'chess' || type === 'ludo') ? `${type}-${mode}` : type;
    try {
      const qref = doc(db, 'gameQueue', qid);
      const s = await getDoc(qref);
      if (s.exists() && s.data().gid === gid) await setDoc(qref, { gid: '', uid: '', at: serverTimestamp() });
    } catch { /* ignore */ }
  }
  const watchGame = (gid, cb, err) => onSnapshot(doc(db, 'games', gid), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), err);
  const update = (gid, data) => updateDoc(doc(db, 'games', gid), { ...data, updatedAt: serverTimestamp() });
  const beat = (gid) => updateDoc(doc(db, 'games', gid), { [`hb.${S.user.uid}`]: serverTimestamp() }).catch(() => {});
  function heartbeat(gid) {
    beat(gid);
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') beat(gid); }, HB_MS);
    const vis = () => { if (document.visibilityState === 'visible') beat(gid); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }
  const sendEmote = (gid, e) => !spamOk('game', '') ? Promise.resolve(null) : addDoc(collection(db, 'games', gid, 'chat'), { uid: S.user.uid, e, at: serverTimestamp() });
  const watchChat = (gid, cb) => onSnapshot(query(collection(db, 'games', gid, 'chat'), orderBy('at'), limitToLast(8)), (qs) => {
    qs.docChanges().forEach((c) => { if (c.type === 'added' && !c.doc.metadata.hasPendingWrites) cb({ id: c.doc.id, ...c.doc.data() }); });
  }, () => {});

  // Records the finished game for every human player that hasn't been recorded yet.
  // `all` = write everyone's record (the client that ended the game); otherwise only our own.
  async function recordResult(g, all = false) {
    if (!S.user || g.status !== 'done' || !g.winnerUid) return;
    const left = g.left || [];
    if (!g.players.includes(S.user.uid) && !left.includes(S.user.uid)) return;
    const humans = [...g.players, ...left].filter((u, i, a) => !isBot(u) && a.indexOf(u) === i && (all || u === S.user.uid));
    const todo = [];
    for (const uid of humans) {
      const rec = await getDoc(doc(db, 'games', g.id, 'rec', uid)).catch(() => null);
      if (rec && !rec.exists()) todo.push(uid);
    }
    for (let i = 0; i < todo.length; i += 3) {
      const b = writeBatch(db);
      for (const uid of todo.slice(i, i + 3)) {
        let idx = g.players.indexOf(uid), prof = null;
        if (idx < 0) { const u = await getDoc(doc(db, 'users', uid)).catch(() => null); prof = u && u.exists() ? u.data() : null; if (!prof) continue; }
        const key = `${g.type}_${g.winnerUid === uid ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l'}`;
        const st = await getDoc(doc(db, 'gameStats', uid)).catch(() => null);
        const cur = st && st.exists() ? Number(st.data()[key]) || 0 : 0;
        b.set(doc(db, 'gameStats', uid), {
          [key]: cur + 1, last: g.id, updatedAt: serverTimestamp(), name: prof ? prof.displayName : g.names[idx], uname: prof ? prof.username : g.unames[idx], color: (prof ? prof.color : g.colors[idx]) || ''
        }, { merge: true });
        b.set(doc(db, 'games', g.id, 'rec', uid), { at: serverTimestamp() });
      }
      try { await b.commit(); } catch (e) { console.warn('record', e.code || e.message); if (all) return recordResult(g, false); }
    }
  }
  const getStats = async (uid) => { const s = await getDoc(doc(db, 'gameStats', uid)); return s.exists() ? s.data() : {}; };
  async function leaderboard(type) {
    const s = await getDocs(query(collection(db, 'gameStats'), orderBy(`${type}_w`, 'desc'), limit(10)));
    return s.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }
  // Invite: a notification in the existing system (type 'game', postId = game id).
  async function invite(toUid, gid, label) {
    await addDoc(collection(db, 'users', toUid, 'notifications'), {
      type: 'game', fromUid: S.user.uid, fromName: S.profile.displayName, fromUsername: S.profile.username,
      postId: gid, text: String(label).slice(0, 140), createdAt: serverTimestamp(), read: false
    });
  }
  async function uidForHandle(h) {
    const s = await getDoc(doc(db, 'usernames', String(h).toLowerCase().replace(/^@/, '')));
    return s.exists() ? s.data().uid : null;
  }
  return {
    createGame, join, quickMatch, leaveQueue, watchGame, update, heartbeat, beat, sendEmote, watchChat, recordResult, getStats,
    leaderboard, invite, uidForHandle, meSeat,
    fs: { doc, getDoc, getDocs, setDoc, updateDoc, collection, onSnapshot, writeBatch, serverTimestamp, runTransaction, Timestamp, deleteField, query, orderBy, limit }
  };
}
