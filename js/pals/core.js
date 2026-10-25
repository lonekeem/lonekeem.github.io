// Kemy Pals - data: Firestore users/{uid}/pets/{petId}, stats decay computed client-side.
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, writeBatch, serverTimestamp, increment, deleteDoc, deleteField }
  from '../fsq.js';
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
const FREE_LOOK = /^(f_[a-z0-9_]{1,13}|b_[a-z0-9_]{1,13})$/;
const PAID_ID = /^[a-z_]{2,16}$/;
const BASIC_PATTERN = new Set(['none', 'spots', 'stripes', 'sparkle']);
// Each new paid id makes the rules read that closet doc, and those reads are expensive.
// Three per write stays under the 1000-expression cap; a full look is a few writes a second apart.
const PAID_PER_WRITE = 3;
export const isPaidLookId = (id) => typeof id === 'string' && id !== '' && !BASIC_PATTERN.has(id) && !FREE_LOOK.test(id) && PAID_ID.test(id);
function outfitSoFar(prev, target, seen) {
  const base = prev || {}; const o = {};
  for (const [k, v] of Object.entries(target)) {
    if (!v) continue;
    if (isPaidLookId(v) && base[k] !== v && !seen.has('outfit:' + k)) { if (base[k]) o[k] = base[k]; }
    else o[k] = v;
  }
  return o;
}
// Steps that reach the final look. Each step changes at most PAID_PER_WRITE paid ids; free edits go out first.
export function lookSteps(p, patch) {
  const deltas = [];
  if (patch.outfit && typeof patch.outfit === 'object') {
    const prev = p.outfit || {};
    for (const [k, v] of Object.entries(patch.outfit)) if (prev[k] !== v && isPaidLookId(v)) deltas.push({ key: 'outfit:' + k, id: v });
  }
  for (const f of ['bg', 'variant', 'pattern', 'voice']) {
    if (patch[f] === undefined || patch[f] === p[f]) continue;
    if (f === 'voice' && !(typeof patch[f] === 'string' && patch[f].startsWith('vx_'))) continue;
    if (isPaidLookId(patch[f])) deltas.push({ key: f, id: patch[f] });
  }
  if (patch.species !== undefined && patch.species !== p.species && /^rx[a-z]+$/.test(patch.species)) deltas.push({ key: 'species', id: 'sp_' + patch.species });
  const groups = [];
  for (let i = 0; i < deltas.length; i += PAID_PER_WRITE) groups.push(deltas.slice(i, i + PAID_PER_WRITE));
  if (!groups.length) groups.push([]);
  const seen = new Set();
  return groups.map((g) => {
    g.forEach((d) => seen.add(d.key));
    const step = {}; let first = seen.size === g.length;
    if (first) for (const k of ['name', 'colors', 'acc']) if (patch[k] !== undefined) step[k] = patch[k];
    if (patch.outfit) step.outfit = outfitSoFar(p.outfit, patch.outfit, seen);
    for (const f of ['bg', 'variant', 'pattern', 'voice']) {
      if (patch[f] === undefined) continue;
      const vx = f === 'voice' && typeof patch[f] === 'string' && patch[f].startsWith('vx_');
      const paid = isPaidLookId(patch[f]) && (f !== 'voice' || vx);
      if (!paid || seen.has(f)) step[f] = patch[f];
    }
    if (patch.species !== undefined && (!/^rx[a-z]+$/.test(patch.species) || patch.species === p.species || seen.has('species'))) step.species = patch.species;
    return step;
  });
}
export function createStore(db, uid) {
  const col = () => collection(db, 'users', uid, 'pets');
  const ref = (id) => doc(db, 'users', uid, 'pets', id);
  let lastWrite = 0, chain = Promise.resolve();
  return {
    async list() { const s = await getDocs(col()); return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); },
    async get(id) { const s = await getDoc(ref(id)); return s.exists() ? { id, ...s.data() } : null; },
    async create(id, data) { await setDoc(ref(id), newPal(id, data)); return this.get(id); },
    // save stats/xp/look. xp gain per write is capped at 60 by the rules, and writes are 1s apart.
    // Saves are queued one at a time (rapid shop taps used to fire two writes inside the rules' 1 s window and get
    // a generic permission-denied error); the gap is measured from when the last write FINISHED, and a write
    // that still lands too soon (network jitter, another tab) is retried after a short wait.
    save(p, patch = {}) { const run = () => this._save(p, patch); const pr = chain.then(run, run); chain = pr.catch(() => {}); return pr; },
    async _save(p, patch = {}) {
      for (let tryN = 0; ; tryN++) { try { return await this._save1(p, patch); } catch (e) { if (e && e.code === 'permission-denied' && tryN < 1) { lastWrite = Date.now(); continue; } throw e; } }
    },
    async _save1(p, patch = {}) {
      const steps = lookSteps(p, patch);
      const ids = [];
      if (patch.outfit) { const prev = p.outfit || {}; for (const [k, v] of Object.entries(patch.outfit)) if (prev[k] !== v && isPaidLookId(v)) ids.push(v); }
      for (const f of ['bg', 'variant', 'pattern', 'voice']) if (patch[f] !== undefined && patch[f] !== p[f] && isPaidLookId(patch[f]) && (f !== 'voice' || String(patch[f]).startsWith('vx_'))) ids.push(patch[f]);
      if (patch.species && patch.species !== p.species && /^rx[a-z]+$/.test(patch.species)) ids.push('sp_' + patch.species);
      for (const id of ids) {
        const inv = await getDoc(doc(db, 'users', uid, 'inv', id));
        if (!inv.exists() || typeof inv.data().n !== 'number') { const err = new Error('That item isn’t in your closet yet.'); err.code = 'kemy/not-owned'; throw err; }
      }
      const xp = Math.min((p.xp || 0) + Math.min(60, Math.max(0, patch.xpGain || 0)), 4900);
      let last = null;
      for (let i = 0; i < steps.length; i++) {
        const wait = 1150 - (Date.now() - lastWrite); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        const data = { stats: patch.stats || liveStats(p), xp, level: xpToLevel(xp), at: serverTimestamp(), updatedAt: serverTimestamp(), ...steps[i] };
        const noBg = data.bg === ''; if (noBg) data.bg = deleteField();
        try { await updateDoc(ref(p.id), data); } finally { lastWrite = Date.now(); }
        last = data; if (noBg) last = { ...data, bg: '' };
      }
      const noBg = last && last.bg === '';
      Object.assign(p, last, { at: Date.now() }); if (noBg) p.bg = ''; return p;
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
import { query, where, limit } from '../fsq.js';
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
