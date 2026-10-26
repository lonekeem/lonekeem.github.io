// Creator age limits on posts. Written by Lone Keem.
// A post's minAge is 0 (All ages, the default), 13 or 17. Viewers whose birthday says they are
// younger never get the post anywhere; signed-out / no-birthday viewers tap "I'm 13+" / "I'm 17+"
// first (remembered on this device, per level). Filters only use fields already on the post doc.
import { viewerAge } from './safety.js';

export const AGE_LEVELS = [[0, 'All ages'], [13, '13+ only'], [17, '17+ only']];
export const RULES_NOTE = 'Kemy’s rules still apply to every post, 17+ too: no nudity, sexual content, real violence or gore, hate or bullying.';
export const minAgeOf = (p) => { const n = Number(p && p.minAge) || 0; return n >= 17 ? 17 : n >= 13 ? 13 : 0; };

let C = null; // { S, isAdmin, esc, openModal, closeModal, toast, friendlyError, save(p, minAge) }
export function initAgeGate(ctx) { C = ctx; window.kemyAgeHidden = ageHidden; }
const own = (p) => !!(C && C.S.user && (p.authorId === C.S.user.uid || (p.authorId === 'studio' && C.isAdmin())));

// Known age under the post's limit: hide it everywhere (the creator always sees their own).
export function ageHidden(p) {
  const m = minAgeOf(p); if (!m || !C || own(p)) return false;
  const a = viewerAge(); return a !== null && a < m;
}
const KEY = (m) => 'kemy-age-ok-' + m;
export function confirmed(m) {
  try { return localStorage.getItem(KEY(m)) === '1' || (m === 13 && localStorage.getItem(KEY(17)) === '1'); } catch { return false; }
}
// Unknown age (signed out / no birthday yet) and not confirmed for this level on this device.
export function confirmAge(m) { try { localStorage.setItem(KEY(m), '1'); } catch { /* */ } }
export function needsGate(p) {
  const m = minAgeOf(p); if (!m || !C || own(p)) return false;
  return viewerAge() === null && !confirmed(m);
}
export const badgeHtml = (p, cls = '') => { const m = minAgeOf(p); return m ? `<span class="age-badge ${cls}" title="The creator set this for ${m}+">${m}+</span>` : ''; };

// "I'm 13+" / "I'm 17+" check. Resolves true once confirmed (and remembers it).
export function askAge(m) {
  if (confirmed(m)) return Promise.resolve(true);
  return new Promise((done) => {
    C.openModal(`<div class="age-gate"><div class="age-big" aria-hidden="true">${m}+</div>
      <h2>This post is for ${m}+</h2>
      <p class="muted">The creator chose ${m}+ for this one. Are you ${m} or older?</p>
      <div class="row age-btns"><button class="btn" id="age-yes">I’m ${m}+, show it</button><button class="btn btn-ghost" data-close id="age-no">Go back</button></div></div>`);
    const root = document.getElementById('modal-root');
    let ok = false;
    root.querySelector('#age-yes')?.addEventListener('click', () => {
      ok = true; confirmAge(m);
      C.closeModal(); done(true);
    });
    const bd = root.querySelector('.modal-backdrop');
    new MutationObserver((_, o) => { if (!bd.isConnected) { o.disconnect(); if (!ok) done(false); } }).observe(root, { childList: true });
  });
}
// Cover shown in place of the media until the viewer confirms.
export function gateHtml(p, poster = '') {
  const m = minAgeOf(p);
  return `<div class="age-cover" data-age-gate="${m}">${poster ? `<img src="${C.esc(poster)}" alt="" aria-hidden="true">` : ''}
    <div class="age-cover-in"><span class="age-badge lg">${m}+</span><p>The creator set this for ${m}+</p>
    <button type="button" class="btn btn-sm" data-a="agegate" data-age="${m}">I’m ${m}+, show it</button></div></div>`;
}

// Small picker for the composer and the post menu. Read it with pickedAge(root, name).
export function pickerHtml(name = 'minAge', selected = 0) {
  return `<fieldset class="catpick agepick"><legend class="small">Who can watch?</legend>
    <div class="catpick-row">${AGE_LEVELS.map(([v, l]) => `<label class="catchip"><input type="radio" name="${name}" value="${v}" ${minAgeOf({ minAge: selected }) === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <p class="small muted agepick-note">${RULES_NOTE}</p></fieldset>`;
}
export const pickedAge = (root, name = 'minAge') => minAgeOf({ minAge: Number(root.querySelector(`input[name="${name}"]:checked`)?.value) || 0 });

// Post menu → "Age limit": the creator (or an admin) changes it later.
export function editAge(p, after) {
  C.openModal(`<h2>Age limit</h2>${pickerHtml('age-edit', minAgeOf(p))}
    <div class="row" style="justify-content:flex-end;gap:8px"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn" id="age-save">Save</button></div>`);
  const root = document.getElementById('modal-root');
  root.querySelector('#age-save').onclick = async (e) => {
    const v = pickedAge(root, 'age-edit'); e.target.disabled = true;
    try { await C.save(p, v); p.minAge = v; C.closeModal(); C.toast(v ? `Now ${v}+ only` : 'Now for all ages'); after?.(v); }
    catch (err) { e.target.disabled = false; C.toast(C.friendlyError(err)); }
  };
}
