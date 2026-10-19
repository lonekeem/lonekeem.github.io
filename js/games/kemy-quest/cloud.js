// Optional Firebase sync: best time / stars per level + fastest-time leaderboard.
// Loaded lazily; the game works fully offline without it.
const SDK = 'https://www.gstatic.com/firebasejs/12.4.0';
let F = null;
async function load() {
  if (F) return F;
  const [{ auth, db }, A, S] = await Promise.all([import('../../firebase-init.js'), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`)]);
  F = { auth, db, A, S, user: null, profile: null };
  await new Promise((res) => { const off = A.onAuthStateChanged(auth, async (u) => { F.user = u; F.profile = null;
    if (u) try { const s = await S.getDoc(S.doc(db, 'users', u.uid)); F.profile = s.exists() ? s.data() : null; } catch {}
    res(); off && 0; }); });
  return F;
}
async function awardPal(f, n) {
  try {
    const { readPet, firstPet, createStore } = await import('../../pals/core.js');
    const u = await f.S.getDoc(f.S.doc(f.db, 'users', f.user.uid)); const act = u.exists() && u.data().activePet;
    const p = (act && await readPet(f.db, f.user.uid, act)) || await firstPet(f.db, f.user.uid);
    if (p) await createStore(f.db, f.user.uid).save(p, { xpGain: n });
  } catch {}
}
export const cloud = {
  async user() { try { const f = await load(); return f.user ? { uid: f.user.uid, name: (f.profile && f.profile.displayName) || 'Player' } : null; } catch { return null; } },
  async save(level, timeMs, stars, big) {
    const f = await load(); if (!f.user) return { saved: false, reason: 'signed-out' };
    const { S, db } = f; const ref = S.doc(db, 'kqLevels', level, 'scores', f.user.uid);
    const old = await S.getDoc(ref); const o = old.exists() ? old.data() : null;
    const t = Math.round(timeMs);
    const next = { uid: f.user.uid, level, name: String((f.profile && f.profile.displayName) || 'Player').slice(0, 40), uname: String((f.profile && f.profile.username) || '').slice(0, 30),
      time: o ? Math.min(o.time, t) : t, stars: o ? Math.max(o.stars, stars) : stars, big: o ? Math.max(o.big, big) : big, updatedAt: S.serverTimestamp() };
    if (o && next.time === o.time && next.stars === o.stars && next.big === o.big) return { saved: false, reason: 'no-improvement', best: o.time };
    await S.setDoc(ref, next).finally(() => awardPal(f, 20)); return { saved: true, best: next.time, improved: !o || t < o.time };
  },
  async top(level, n = 10) {
    const { S, db } = await load();
    const q = S.query(S.collection(db, 'kqLevels', level, 'scores'), S.orderBy('time'), S.limit(n));
    return (await S.getDocs(q)).docs.map((d) => d.data());
  }
};
