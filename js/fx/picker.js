// Lone Keem Studios - filter picker: tabs (Looks · Beauty · Funny · Fun FX) over a centre-snapping
// row of circles. Whatever sits in the centre ring is applied live. Used by the camera and Go Live.
import { LOOKS, BEAUTY, FUNNY, FUNFX } from './looks.js';

export const TABS = [
  { id: 'funny', name: 'Funny', key: 'funny', items: FUNNY },
  { id: 'looks', name: 'Looks', key: 'look', items: LOOKS },
  { id: 'beauty', name: 'Beauty', key: 'beauty', items: BEAUTY },
  { id: 'fx', name: 'Fun FX', key: 'fx', items: FUNFX }
];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function itemFace(tab, it) {
  if (tab.id === 'looks') return `<span class="fxi-sw" style="background:linear-gradient(135deg,${it.sw[0]},${it.sw[1]})"></span>`;
  if (tab.id === 'beauty') return `<span class="fxi-ic fxi-beauty" data-v="${it.id}">${it.id === 'off' ? '∅' : '✦'.repeat(BEAUTY.indexOf(it))}</span>`;
  return `<span class="fxi-ic ${it.icon === 'KL' ? 'fxi-kl' : ''}">${esc(it.icon)}</span>`;
}

// opts: { state, onChange(state, info), tab, ring: element shown in the centre (optional) }
export function mountPicker(root, opts) {
  let state = { ...opts.state };
  let tab = TABS.find((t) => t.id === (opts.tab || 'funny')) || TABS[0];
  root.classList.add('fxp');
  root.innerHTML = `
    <div class="fxp-name" aria-live="polite"></div>
    <div class="fxp-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" data-tab="${t.id}">${t.name}<i></i></button>`).join('')}</div>
    <div class="fxp-row" role="listbox" aria-label="Filters"></div>
    <p class="fxp-hint" hidden>May be slow on older phones</p>`;
  const row = root.querySelector('.fxp-row'), nameEl = root.querySelector('.fxp-name'), hintEl = root.querySelector('.fxp-hint');
  let nameT = 0, scrollT = 0, programmatic = false;
  const cur = () => tab.items.find((it) => it.id === state[tab.key]) || tab.items[0];
  function flashName(text) { nameEl.textContent = text; nameEl.classList.add('on'); clearTimeout(nameT); nameT = setTimeout(() => nameEl.classList.remove('on'), 1400); }
  function paintTabs() {
    root.querySelectorAll('[data-tab]').forEach((b) => {
      const t = TABS.find((x) => x.id === b.dataset.tab); const on = t === tab;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
      const active = state[t.key] && state[t.key] !== 'none' && state[t.key] !== 'off';
      b.querySelector('i').hidden = !active;
    });
  }
  function renderRow() {
    row.innerHTML = tab.items.map((it) => `<button type="button" class="fxi${it.heavy ? ' heavy' : ''}" role="option" data-id="${it.id}" aria-label="${esc(it.name)}">${itemFace(tab, it)}</button>`).join('');
    paintSel(); requestAnimationFrame(() => centre(cur().id, false));
  }
  function paintSel() {
    const id = cur().id;
    row.querySelectorAll('.fxi').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    hintEl.hidden = !cur().heavy;
    opts.ring && (opts.ring.innerHTML = itemFace(tab, cur()));
  }
  function centre(id, smooth = true) {
    const b = row.querySelector(`[data-id="${id}"]`); if (!b) return;
    programmatic = true;
    row.scrollTo({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
    setTimeout(() => (programmatic = false), smooth ? 450 : 50);
  }
  function choose(id, announce = true) {
    if (state[tab.key] === id) return;
    state = { ...state, [tab.key]: id };
    paintSel(); paintTabs();
    const it = cur(); if (announce) flashName(it.name + (it.hint ? ' · ' + it.hint : ''));
    opts.onChange && opts.onChange({ ...state }, { tab: tab.id, item: it });
  }
  row.addEventListener('click', (e) => { const b = e.target.closest('.fxi'); if (!b) return; choose(b.dataset.id); centre(b.dataset.id); });
  row.addEventListener('scroll', () => {
    if (programmatic || !row.clientWidth) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      if (programmatic || !row.clientWidth) return;
      const mid = row.scrollLeft + row.clientWidth / 2; let best = null, bd = 1e9;
      row.querySelectorAll('.fxi').forEach((b) => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < bd) { bd = d; best = b; } });
      if (best) choose(best.dataset.id);
    }, 120);
  }, { passive: true });
  root.querySelector('.fxp-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]'); if (!b) return;
    tab = TABS.find((t) => t.id === b.dataset.tab); paintTabs(); renderRow();
    opts.onTab && opts.onTab(tab.id);
  });
  paintTabs(); renderRow();
  return {
    get state() { return { ...state }; },
    get tab() { return tab.id; },
    setTab(id) { const t = TABS.find((x) => x.id === id); if (t && t !== tab) { tab = t; paintTabs(); renderRow(); } },
    set(next, announce = false) { state = { ...state, ...next }; paintTabs(); paintSel(); centre(cur().id); if (announce) flashName(cur().name); },
    step(key, dir) { // cycle a category (used by full-screen swipes for looks)
      const t = TABS.find((x) => x.key === key); const i = t.items.findIndex((it) => it.id === state[key]);
      const n = t.items[(i + dir + t.items.length) % t.items.length];
      state = { ...state, [key]: n.id }; paintTabs(); if (t === tab) { paintSel(); centre(n.id); }
      flashName(n.name); opts.onChange && opts.onChange({ ...state }, { tab: t.id, item: n });
    },
    flash: flashName
  };
}
