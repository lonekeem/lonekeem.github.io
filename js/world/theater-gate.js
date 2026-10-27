// 🎬 Lone Keem Studio gate: the tiny always-loaded part of the movie theater (one collider, one far-away box, the door
// prompt, map label and landmark). The real building, parking lot, lobby and auditorium live in theater.js, which is
// imported only once you come within ~170 m (or walk in), so the For You feed and the rest of Kemy World stay fast.
import { THEATER, FLAT, roomState } from './layout.js';

export function attachTheaterGate(api, W, K) {
  const { THREE, P, box } = api; const T = THEATER; const cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2;
  box.push({ x0: T.x0, x1: T.x1, z0: T.z0, z1: T.z1, top: FLAT + T.h + 2, bot: FLAT - 2, theater: 1 });
  const far = new THREE.Group(); far.name = 'theater-far'; W.root.add(far);
  { const m = new THREE.Mesh(K.G.box, K.std('#7d1b1f', { r: 0.8 })); m.scale.set(T.x1 - T.x0, T.h, T.z1 - T.z0); m.position.set(cx, FLAT + T.h / 2, cz); far.add(m);
    const s = new THREE.Mesh(K.G.box, K.std('#800020', { e: '#d4af37', ei: 0.35 })); s.scale.set(1.2, 9, 3.2); s.position.set(T.x1 + 1, FLAT + 12, T.door[1]); far.add(s); }
  let M = null, loading = null, chk = 0;
  function load() {
    if (!loading) loading = import('./theater.js').then((m) => { M = m.attachTheater(api, W, K, { far }); return M; }).catch((e) => { console.warn('theater load', e); loading = null; return null; });
    return loading;
  }
  const near = () => Math.hypot(P.x - cx, P.z - cz) < 170;
  const prevPrompt = api.prompt; api.prompt = () => {
    const p0 = prevPrompt && prevPrompt(); if (p0) return p0;
    if (M) return M.prompt();
    if (P.x < 392 && Math.hypot(P.x - T.door[0], P.z - T.door[1]) < 3.6) return { id: 'th-in', label: '🎬 Enter Lone Keem Studio' };
    return null;
  };
  const prevAct = api.onAction; api.onAction = (a) => {
    if (typeof a === 'string' && a.startsWith('th-')) { load().then((m) => m && m.action(a)); return; }
    if (prevAct) prevAct(a);
  };
  const prevLm = W.landmarks; W.landmarks = () => (prevLm ? prevLm() : []).concat([{ name: '🎬 Lone Keem Studio', x: cx, z: cz, gx: T.door[0] + 2, gz: T.door[1] }]);
  const prevLab = W.mapLabels; W.mapLabels = (g, mx, mz) => { if (prevLab) prevLab(g, mx, mz); g.fillStyle = '#ffd36b'; g.font = 'bold 9px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('🎬 Lone Keem Studio', mx(cx), mz(cz)); g.fillStyle = '#cbd5e1'; g.fillText('🅿️', mx((T.lot.x0 + T.lot.x1) / 2), mz((T.lot.z0 + T.lot.z1) / 2)); };
  window.__theater = { load, get M() { return M; } };
  return {
    update(dt, now) {
      if (M) { M.update(dt, now); return; }
      if ((chk -= dt) > 0) return; chk = 1;
      if (near() || roomState.inId === T.plot) load();
    },
    destroy() { if (M) try { M.destroy(); } catch { /* */ } far.removeFromParent(); if (window.__theater && window.__theater.M === M) window.__theater = null; }
  };
}
