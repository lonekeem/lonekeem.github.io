// Pal Zombie Survival co-op (2-4 players) on Firestore, free-tier friendly.
// zLobbies/{CODE}            lobby (host only): host, status open|playing|done, pub, n, wave
// zLobbies/{CODE}/slot/{0-3} one doc per seat, claimed by a player (caps a team at 4)
// zLobbies/{CODE}/p/{uid}    each player's own doc: Pal snapshot, ready, position/aim/fire (~8 Hz while active,
//                            1 Hz idle), hp/down/revive, emote, a rolling window of their zombie hits
// zLobbies/{CODE}/s/state    host-authoritative game state (~6 Hz): wave, zombies, score, kills + diamonds per player
// Host migration: if the host's doc goes quiet for 8 s (or is deleted) the lowest seat takes over (rules check it).
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, limit, onSnapshot, serverTimestamp }
  from '../fsq.js';
export const MAX_TEAM = 4, STALE_MS = 30 * 60e3, QUIET_MS = 8000;
export const EMOTES = ['👋 Hi!', '👍 Nice!', '🆘 Help!', '🤝 Revive me!', '🧟 Behind you!', '➡️ Follow me!', '⭐ Wow!', '🎉 GG!'];
// em codec (int, rules allow -1..999): 0..499 = quick-chat phrase index into ZSAY (the 8 classics first, append-only),
// 500+ = emote/dance index into EMOTE_IDX (append-only)
import { ALL_PHRASES, QUICK_TABS } from './emote-wheel.js';
import { EMOTE_IDX, EMOTE_BY_ID } from './emotes.js';
export const ZSAY = [...EMOTES, ...ALL_PHRASES.filter((p) => !EMOTES.includes(p))];
export const ZTABS = [{ id: 'z', icon: '⚡', name: 'Quick', list: EMOTES }, ...QUICK_TABS];
export const zSayIdx = (text) => ZSAY.indexOf(text);
export const zEmoteIdx = (id) => { const i = EMOTE_IDX.indexOf(id); return i < 0 ? -1 : 500 + i; };
export const zEmoteOf = (em) => (em >= 500 ? EMOTE_IDX[em - 500] || '' : '');
export const zText = (em) => { if (em >= 500) { const d = EMOTE_BY_ID[zEmoteOf(em)]; return d ? `${d.icon} ${d.name}` : ''; } return ZSAY[em] || ''; };
const CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => Array.from({ length: 5 }, () => CH[Math.floor(Math.random() * CH.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5);
export function palSnap(p) { const o = { ...(p.outfit || {}) }; delete o.held; // rings stay (left paw)
  return { species: String(p.species || 'kemy').slice(0, 30), name: String(p.name || '').slice(0, 30), colors: p.colors || {}, outfit: o, level: Number(p.level) || 1, variant: p.variant || '', pattern: p.pattern || 'none' }; }
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);
export function createNet(db, uid) {
  const L = (c) => doc(db, 'zLobbies', c);
  async function seat(code) {
    const slots = await getDocs(collection(db, 'zLobbies', code, 'slot')); const mine = slots.docs.find((d) => d.data().uid === uid); if (mine) return Number(mine.id);
    const taken = new Set(slots.docs.map((d) => d.id));
    for (let s = 0; s < MAX_TEAM; s++) { if (taken.has(String(s))) continue; try { await setDoc(doc(db, 'zLobbies', code, 'slot', String(s)), { uid, at: serverTimestamp() }); return s; } catch { /* someone else got it */ } }
    throw new Error('That team is full (4 players).');
  }
  async function join(code, me) {
    code = cleanCode(code); const l = await getDoc(L(code)); if (!l.exists()) throw new Error('No team with that code.');
    const d = l.data(); if (d.status === 'done' || Date.now() - ms(d.updatedAt) > STALE_MS) throw new Error('That team has finished.');
    if (d.status === 'playing') { const mine = await getDoc(doc(db, 'zLobbies', code, 'p', uid)); if (!mine.exists()) throw new Error('That team already started.'); }
    const slot = await seat(code);
    await setDoc(doc(db, 'zLobbies', code, 'p', uid), { name: me.name, pal: me.pal, slot, ready: false, x: 0, y: 0, z: 4, f: 0, a: 0, fire: false, w: 'goo', hp: 100, down: false, rev: '', em: -1, emAt: 0, hits: [], hs: 0, at: serverTimestamp() });
    return code;
  }
  async function create(me, pub) {
    for (let i = 0; i < 6; i++) { const code = newCode();
      try { await setDoc(L(code), { host: uid, status: 'open', pub: !!pub, n: 1, wave: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }); return join(code, me); } catch (e) { if (i === 5) throw e; } }
  }
  // Quick Match: fill an open public team, else open a new public one. Also sweeps very old lobbies.
  async function quick(me) {
    const s = await getDocs(query(collection(db, 'zLobbies'), where('pub', '==', true), where('status', '==', 'open'), limit(20)));
    const now = Date.now(); const open = [];
    for (const d of s.docs) { const v = d.data(); if (now - ms(v.updatedAt) > STALE_MS) { deleteDoc(d.ref).catch(() => {}); continue; } if (now - ms(v.updatedAt) < 60000 && v.n < MAX_TEAM && v.host !== uid) open.push(d.id); }
    for (const c of open) { try { return await join(c, me); } catch { /* full / gone */ } }
    return create(me, true);
  }
  // live session
  function session(code) {
    const S = { code, lobby: null, players: {}, seen: {}, state: null, me: null, subs: new Set(), stops: [] };
    const emit = (k) => S.subs.forEach((f) => { try { f(k); } catch (e) { console.warn(e); } });
    S.stops.push(onSnapshot(L(code), (d) => { S.lobby = d.exists() ? d.data() : null; emit('lobby'); }));
    S.stops.push(onSnapshot(collection(db, 'zLobbies', code, 'p'), (qs) => { const p = {}; const t = Date.now();
      qs.docs.forEach((d) => { p[d.id] = d.data(); const old = S.players[d.id]; if (!old || ms(old.at) !== ms(d.data().at)) S.seen[d.id] = t; else S.seen[d.id] = S.seen[d.id] || t; });
      S.players = p; if (p[uid]) S.me = S.me || { ...p[uid] }; emit('players'); }));
    S.stops.push(onSnapshot(doc(db, 'zLobbies', code, 's', 'state'), (d) => { S.state = d.exists() ? d.data() : null; emit('state'); }));
    let pending = null, sending = false, lastSend = 0, sState = null, sendingS = false, lastS = 0;
    async function flush() { if (sending || !pending) return; if (!S.me) { setTimeout(flush, 150); return; } const wait = 115 - (Date.now() - lastSend); if (wait > 0) { setTimeout(flush, wait); return; }
      sending = true; const data = { ...S.me, ...pending, at: serverTimestamp() }; pending = null; S.me = { ...data };
      try { await setDoc(doc(db, 'zLobbies', code, 'p', uid), data); } catch (e) { console.warn('zombie p', e.code || e.message); } lastSend = Date.now(); sending = false; if (pending) flush(); }
    async function flushS() { if (sendingS || !sState) return; const wait = 160 - (Date.now() - lastS); if (wait > 0) { setTimeout(flushS, wait); return; }
      sendingS = true; const data = { ...sState, at: serverTimestamp() }; sState = null;
      try { await setDoc(doc(db, 'zLobbies', code, 's', 'state'), data); } catch (e) { console.warn('zombie state', e.code || e.message); } lastS = Date.now(); sendingS = false; if (sState) flushS(); }
    let hb = setInterval(() => { if (S.isHost()) updateDoc(L(code), { n: Object.keys(S.players).length, updatedAt: serverTimestamp() }).catch(() => {}); }, 15000);
    Object.assign(S, {
      uid, isHost: () => !!S.lobby && S.lobby.host === uid,
      fresh: (u) => u === uid || Date.now() - (S.seen[u] || 0) < QUIET_MS,
      on(f) { S.subs.add(f); return () => S.subs.delete(f); },
      send(patch) { pending = { ...(pending || {}), ...patch }; flush(); },
      sendState(st) { sState = st; flushS(); },
      setLobby: (patch) => updateDoc(L(code), { ...patch, updatedAt: serverTimestamp() }),
      // take over as host when the host went quiet / left (lowest fresh seat)
      async maybeTakeOver() { const l = S.lobby; if (!l || l.host === uid) return false; const h = S.players[l.host];
        if (h && Date.now() - (S.seen[l.host] || 0) < QUIET_MS) return false;
        const alive = Object.entries(S.players).filter(([u]) => u !== l.host && S.fresh(u)).sort((a, b) => a[1].slot - b[1].slot);
        if (!alive.length || alive[0][0] !== uid) return false;
        try { await updateDoc(L(code), { host: uid, updatedAt: serverTimestamp() }); return true; } catch (e) { console.warn('takeover', e.code || e.message); return false; } },
      async leave() { clearInterval(hb); S.stops.forEach((f) => f()); S.stops = [];
        try { const others = Object.entries(S.players).filter(([u]) => u !== uid && S.fresh(u)).sort((a, b) => a[1].slot - b[1].slot);
          if (S.isHost()) { if (others.length) await updateDoc(L(code), { host: others[0][0], updatedAt: serverTimestamp() }).catch(() => {});
            else { await deleteDoc(doc(db, 'zLobbies', code, 's', 'state')).catch(() => {}); } }
          const me = S.players[uid]; await deleteDoc(doc(db, 'zLobbies', code, 'p', uid)).catch(() => {}); if (me) await deleteDoc(doc(db, 'zLobbies', code, 'slot', String(me.slot))).catch(() => {});
          if (!others.length) await deleteDoc(L(code)).catch(() => {});
        } catch { /* best effort */ } }
    });
    return S;
  }
  return { create, join, quick, session };
}
