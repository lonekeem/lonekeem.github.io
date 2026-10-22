// Master and effects volumes. Stored levels stay as the sliders set them.
// Playback multiplies by the master so the two knobs do not compound.
const MASTER = 'kemy-vol-master';
const SFX = 'kemy-sfx-vol';
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
};
const unit = (raw, fallback) => {
  if (raw == null || raw === '') return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
};
export function masterVol() { return unit(ls.get(MASTER), 1); }
export function sfxVol() { return unit(ls.get(SFX), 1); }
export function setMasterVol(v) { ls.set(MASTER, String(unit(v, 1))); dispatchEvent(new CustomEvent('kemy:vol')); }
export function setSfxVol(v) { ls.set(SFX, String(unit(v, 1))); }
export function heard(v) {
  const n = Number(v);
  return Math.max(0, Math.min(1, (Number.isFinite(n) ? n : 0) * masterVol()));
}
