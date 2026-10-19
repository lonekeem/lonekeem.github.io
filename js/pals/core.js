// Kemy Pals - data: Firestore users/{uid}/pets/{petId}, stats decay computed client-side.
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, writeBatch, serverTimestamp, increment, deleteDoc }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { SPEC } from './art.js';
export const MAX_PALS = 6;
export const STATS = ['happy', 'hunger', 'energy', 'clean']; // hunger = fullness (100 = full)
const DECAY = { happy: 2, hunger: 4, energy: 3, clean: 3 };   // points per hour
export const FLOOR = 5;                                       // a Pal never hits zero (it never "dies")
export const xpToLevel = (xp) => Math.min(50, Math.floor(xp / 100) + 1);
export const isNight = (d = new Date()) => { const h = d.getHours(); return h >= 22 || h < 7; };
export const tsMs = (v) => (v && v.toMillis ? v.toMillis() : typeof v === 'number' ? v : Date.now());
// current stats from the stored snapshot + elapsed real time
export function liveStats(p, now = Date.now()) {
  const hrs = Math.max(0, (now - tsMs(p.at)) / 3600000); const s = { ...p.stats };
  for (const k of STATS) s[k] = s[k] - DECAY[k] * hrs;
  if (isNight()) s.energy = p.stats.energy + 6 * hrs; // resting at night
  const low = ['hunger', 'energy', 'clean'].filter((k) => s[k] < 30).length; s.happy -= low * 1.5 * hrs;
  for (const k of STATS) s[k] = Math.round(Math.max(FLOOR, Math.min(100, s[k])));
  return s;
}
export const moodOf = (s) => ({ dirty: s.clean < 35, sad: s.happy < 30, hungry: s.hunger < 30, tired: s.energy < 25, low: s.happy < 40 || s.energy < 25 });
export function newPal(id, { species, name, colors, pattern, acc }) {
  return { species, name, colors, pattern, acc, xp: 0, level: 1, pats: 0, stats: { happy: 80, hunger: 80, energy: 80, clean: 90 }, at: serverTimestamp(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}
export function createStore(db, uid) {
  const col = () => collection(db, 'users', uid, 'pets');
  const ref = (id) => doc(db, 'users', uid, 'pets', id);
  let lastWrite = 0;
  return {
    async list() { const s = await getDocs(col()); return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); },
    async get(id) { const s = await getDoc(ref(id)); return s.exists() ? { id, ...s.data() } : null; },
    async create(id, data) { await setDoc(ref(id), newPal(id, data)); return this.get(id); },
    // save stats/xp/look. xp gain per write is capped at 60 by the rules, and writes are 1s apart.
    async save(p, patch = {}) {
      const wait = 1100 - (Date.now() - lastWrite); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const xp = Math.min(p.xp + Math.min(60, Math.max(0, patch.xpGain || 0)), 4900);
      const data = { stats: patch.stats || liveStats(p), xp, level: xpToLevel(xp), at: serverTimestamp(), updatedAt: serverTimestamp() };
      for (const k of ['name', 'colors', 'pattern', 'acc', 'species', 'outfit', 'voice']) if (patch[k] !== undefined) data[k] = patch[k];
      lastWrite = Date.now(); await updateDoc(ref(p.id), data);
      Object.assign(p, data, { at: Date.now() }); return p;
    },
    async remove(id) { const pats = await getDocs(collection(db, 'users', uid, 'pets', id, 'pats')); const pd = await getDocs(collection(db, 'users', uid, 'pets', id, 'playdates')); const b = writeBatch(db); pats.docs.forEach((d) => b.delete(d.ref)); pd.docs.forEach((d) => b.delete(d.ref)); b.delete(ref(id)); await b.commit(); },
    async setActive(id) { await updateDoc(doc(db, 'users', uid), { activePet: id }); }
  };
}
// a visitor's daily pat: their pat doc + the pet's pat counter, together in one batch
export async function patPal(db, ownerUid, petId, me) {
  const pr = doc(db, 'users', ownerUid, 'pets', petId, 'pats', me);
  const old = await getDoc(pr); if (old.exists() && Date.now() - tsMs(old.data().at) < 20 * 3600000) return false;
  const b = writeBatch(db); b.set(pr, { uid: me, at: serverTimestamp() }); b.update(doc(db, 'users', ownerUid, 'pets', petId), { pats: increment(1) }); await b.commit(); return true;
}
export async function readPet(db, uid, id) { const s = await getDoc(doc(db, 'users', uid, 'pets', id)); return s.exists() ? { id, ...s.data() } : null; }
export async function firstPet(db, uid) { const s = await getDocs(collection(db, 'users', uid, 'pets')); const l = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); return l[0] || null; }
export const formName = (p) => { const sp = SPEC[p.species]; return sp ? sp.forms[p.level >= 12 ? 2 : p.level >= 5 ? 1 : 0] : ''; };
export { deleteDoc };
// ---- public read API (also for Phase 2: Pal vs Pal games and the Pal Park)
import { query, where, limit } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
export async function listPals(db, uid) { const s = await getDocs(collection(db, 'users', uid, 'pets')); return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); }
// a user's active Pal (users/{uid}.activePet, else their first Pal), readable by anyone
export async function getActivePal(db, uid) {
  const u = await getDoc(doc(db, 'users', uid)); const id = u.exists() ? u.data().activePet : '';
  return (id && await readPet(db, uid, id)) || firstPet(db, uid);
}
// play date: visitor's Pal visits ownerUid's Pal; the rules allow one per visitor per owner Pal per 20 h
export async function playdate(db, ownerUid, petId, me, myPetId) {
  const r = doc(db, 'users', ownerUid, 'pets', petId, 'playdates', me);
  const old = await getDoc(r); if (old.exists() && Date.now() - tsMs(old.data().at) < 20 * 3600000) return false;
  await setDoc(r, { uid: me, pet: myPetId, at: serverTimestamp() }); return true;
}
export async function newPlaydates(db, uid, petId, sinceMs) {
  const s = await getDocs(query(collection(db, 'users', uid, 'pets', petId, 'playdates'), where('at', '>', new Date(sinceMs || 0)), limit(20))); return s.size;
}
