// Kemy Challenge Show multiplayer (up to 30 contestants per room, overflow rooms) on Firestore, free-tier friendly.
// shows/{CODE}            room (host only): host, status open|playing|done, pub, n, createdAt, updatedAt
// shows/{CODE}/slot/{0-29} one doc per seat (caps a room at 30)
// shows/{CODE}/p/{uid}    each player's own doc: Pal snapshot, ready, position + speed (adaptive 1-3 Hz moving, ~0.2 Hz idle),
//                         st (0 playing, 1 passed, 2 out), round index, round score, taps, bumps, emote/quick chat index
// shows/{CODE}/s/state    host-authoritative show state (~2 Hz, only on change): phase, round, light, timers, out/alive lists,
//                         bots, results, diamonds. Host migration like Zombie co-op: if the host goes quiet for 8 s the
//                         lowest fresh seat takes over (rules check it).
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, limit, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { ZSAY, ZTABS, zSayIdx, zEmoteIdx, zEmoteOf, zText, palSnap, cleanCode } from './zombie-net.js';
export { ZSAY, ZTABS, zSayIdx, zEmoteIdx, zEmoteOf, zText, palSnap, cleanCode };
export const MAX_ROOM = 30, STALE_MS = 30 * 60e3, QUIET_MS = 8000;
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
// safe display name: the moderation word filter (js/moderation.js autoFlag) replaces flagged names with "Player"
export async function safeName(n) { n = String(n || 'Player').slice(0, 24); try { const m = await import('../moderation.js'); if (m.autoFlag && m.autoFlag(n)) return 'Player'; } catch { /* */ } return n; }
export function createShowNet(db, uid) {
  const L = (c) => doc(db, 'shows', c);
  async function seat(code) {
    const slots = await getDocs(collection(db, 'shows', code, 'slot')); const mine = slots.docs.find((d) => d.data().uid === uid); if (mine) return Number(mine.id);
    const taken = new Set(slots.docs.map((d) => d.id)); const order = Array.from({ length: MAX_ROOM }, (_, i) => i).filter((s) => !taken.has(String(s)));
    for (const s of order.slice(0, 6)) { try { await setDoc(doc(db, 'shows', code, 'slot', String(s)), { uid, at: serverTimestamp() }); return s; } catch { /* taken */ } }
    throw new Error('That show is full (30 players).');
  }
  async function join(code, me) {
    code = cleanCode(code); const l = await getDoc(L(code)); if (!l.exists()) throw new Error('No show with that code.');
    const d = l.data(); if (d.status === 'done' || Date.now() - ms(d.updatedAt) > STALE_MS) throw new Error('That show has finished.');
    if (d.status === 'playing') { const mine = await getDoc(doc(db, 'shows', code, 'p', uid)); if (!mine.exists()) throw new Error('That show already started. Try Quick Match!'); }
    const slot = await seat(code);
    await setDoc(doc(db, 'shows', code, 'p', uid), { name: me.name, pal: me.pal, slot, ready: false, x: 0, y: 0, z: 0, f: 0, v: 0, st: 0, r: -1, sc: 0, tp: 0, bp: [], em: -1, emAt: 0, at: serverTimestamp() });
    return code;
  }
  async function create(me, pub) {
    for (let i = 0; i < 6; i++) { const code = newCode();
      try { await setDoc(L(code), { host: uid, status: 'open', pub: !!pub, n: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return join(code, me); } catch (e) { if (i === 5) throw e; } }
  }
  // Quick Match: fill the fullest open public room that still has seats (overflow → a new room), sweeping stale ones.
  async function quick(me) {
    const s = await getDocs(query(collection(db, 'shows'), where('pub', '==', true), where('status', '==', 'open'), limit(25)));
    const now = Date.now(); const open = [];
    for (const d of s.docs) { const v = d.data(); if (now - ms(v.updatedAt) > STALE_MS) { deleteDoc(d.ref).catch(() => {}); continue; } if (now - ms(v.updatedAt) < 60000 && v.n < MAX_ROOM && v.host !== uid) open.push([d.id, v.n]); }
    open.sort((a, b) => b[1] - a[1]);
    for (const [c] of open) { try { return await join(c, me); } catch { /* full / gone */ } }
    return create(me, true);
  }
  function session(code) {
    const S = { code, lobby: null, players: {}, seen: {}, state: null, me: null, subs: new Set(), stops: [] };
    const emit = (k) => S.subs.forEach((f) => { try { f(k); } catch (e) { console.warn(e); } });
    S.stops.push(onSnapshot(L(code), (d) => { S.lobby = d.exists() ? d.data() : null; emit('lobby'); }));
    S.stops.push(onSnapshot(collection(db, 'shows', code, 'p'), (qs) => { const p = {}; const t = Date.now();
      qs.docs.forEach((d) => { p[d.id] = d.data(); const old = S.players[d.id]; if (!old || ms(old.at) !== ms(d.data().at)) S.seen[d.id] = t; else S.seen[d.id] = S.seen[d.id] || t; });
      S.players = p; if (p[uid]) S.me = S.me || { ...p[uid] }; emit('players'); }));
    S.stops.push(onSnapshot(doc(db, 'shows', code, 's', 'state'), (d) => { S.state = d.exists() ? d.data() : null; S.stateAt = Date.now(); emit('state'); }));
    let pending = null, sending = false, lastSend = 0, sState = null, sendingS = false, lastS = 0;
    async function flush() { if (sending || !pending) return; if (!S.me) { setTimeout(flush, 150); return; } const wait = 260 - (Date.now() - lastSend); if (wait > 0) { setTimeout(flush, wait); return; }
      sending = true; const data = { ...S.me, ...pending, at: serverTimestamp() }; pending = null; S.me = { ...data };
      try { await setDoc(doc(db, 'shows', code, 'p', uid), data); } catch (e) { console.warn('show p', e.code || e.message); } lastSend = Date.now(); sending = false; if (pending) flush(); }
    async function flushS() { if (sendingS || !sState) return; const wait = 400 - (Date.now() - lastS); if (wait > 0) { setTimeout(flushS, wait); return; }
      sendingS = true; const data = { ...sState, at: serverTimestamp() }; sState = null;
      try { await setDoc(doc(db, 'shows', code, 's', 'state'), data); } catch (e) { console.warn('show state', e.code || e.message); } lastS = Date.now(); sendingS = false; if (sState) flushS(); }
    const hb = setInterval(() => { if (S.isHost()) updateDoc(L(code), { n: Math.min(MAX_ROOM, Object.keys(S.players).length), updatedAt: serverTimestamp() }).catch(() => {}); }, 15000);
    Object.assign(S, {
      uid, isHost: () => !!S.lobby && S.lobby.host === uid,
      fresh: (u) => u === uid || Date.now() - (S.seen[u] || 0) < QUIET_MS,
      on(f) { S.subs.add(f); return () => S.subs.delete(f); },
      send(patch) { pending = { ...(pending || {}), ...patch }; flush(); },
      sendState(st) { sState = st; flushS(); },
      setLobby: (patch) => updateDoc(L(code), { ...patch, updatedAt: serverTimestamp() }),
      async maybeTakeOver() { const l = S.lobby; if (!l || l.host === uid) return false; const h = S.players[l.host];
        if (h && Date.now() - (S.seen[l.host] || 0) < QUIET_MS) return false;
        const alive = Object.entries(S.players).filter(([u]) => u !== l.host && S.fresh(u)).sort((a, b) => a[1].slot - b[1].slot);
        if (!alive.length || alive[0][0] !== uid) return false;
        try { await updateDoc(L(code), { host: uid, updatedAt: serverTimestamp() }); return true; } catch (e) { console.warn('takeover', e.code || e.message); return false; } },
      async leave() { clearInterval(hb); S.stops.forEach((f) => f()); S.stops = [];
        try { const others = Object.entries(S.players).filter(([u]) => u !== uid && S.fresh(u)).sort((a, b) => a[1].slot - b[1].slot);
          if (S.isHost()) { if (others.length) await updateDoc(L(code), { host: others[0][0], updatedAt: serverTimestamp() }).catch(() => {}); else await deleteDoc(doc(db, 'shows', code, 's', 'state')).catch(() => {}); }
          const me = S.players[uid]; await deleteDoc(doc(db, 'shows', code, 'p', uid)).catch(() => {}); if (me) await deleteDoc(doc(db, 'shows', code, 'slot', String(me.slot))).catch(() => {});
          if (!others.length) await deleteDoc(L(code)).catch(() => {});
        } catch { /* best effort */ } }
    });
    return S;
  }
  return { create, join, quick, session };
}
