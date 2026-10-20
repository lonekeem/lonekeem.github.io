// 💜 Support Kemy: optional donation links, configured by the admin in config/donate.
// Hidden when no links are set, and always hidden inside the Android app (TWA) for Google Play payment rules.
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const TWA_KEY = 'kemy-twa';
export function isTWA() {
  try {
    if (document.referrer.startsWith('android-app://')) { sessionStorage.setItem(TWA_KEY, '1'); localStorage.setItem(TWA_KEY, '1'); return true; }
    if (new URLSearchParams(location.search).get('twa') === '1') { localStorage.setItem(TWA_KEY, '1'); return true; }
    return sessionStorage.getItem(TWA_KEY) === '1' || localStorage.getItem(TWA_KEY) === '1';
  } catch { return document.referrer.startsWith('android-app://'); }
}
isTWA(); // remember the flag on first load (referrer is only set on the launch page)

// Built-in default (shows even before the admin saves anything). An admin Cash App link replaces it.
export const DEFAULT_CASHAPP = 'https://cash.app/$lonekeem';
export const DEFAULT_CASHAPP_LABEL = 'Cash App ($lonekeem)';
export const SERVICES = [
  ['kofi', 'Ko-fi', '☕', 'https://ko-fi.com/yourname'],
  ['cashapp', 'Cash App', '💵', 'https://cash.app/$yourname'],
  ['paypal', 'PayPal', '💙', 'https://paypal.me/yourname'],
  ['bmac', 'Buy Me a Coffee', '🍩', 'https://buymeacoffee.com/yourname'],
  ['other', 'Other link', '🔗', 'https://…']
];
export function cleanLink(v) {
  v = String(v || '').trim(); if (!v) return '';
  if (v.length > 300) return null;
  try { const u = new URL(v); return u.protocol === 'https:' && u.hostname.includes('.') ? u.href : null; } catch { return null; }
}

export function createDonate({ db, esc, toast, friendlyError, openModal, closeModal, isAdmin }) {
  let cache = null, inflight = null;
  async function load(force) {
    if (cache && !force) return cache;
    if (!inflight || force) inflight = getDoc(doc(db, 'config', 'donate')).then((s) => (cache = s.exists() ? s.data() : {})).catch(() => (cache = {}));
    return inflight;
  }
  const linksOf = (d) => SERVICES.map(([k, label, ic]) => {
    let url = cleanLink(d[k]);
    if (k === 'cashapp' && !url) return { k, label: DEFAULT_CASHAPP_LABEL, ic: '💵', url: DEFAULT_CASHAPP, def: true };
    return { k, label: k === 'other' ? (d.otherLabel || 'Donate') : label, ic, url };
  }).filter((x) => x.url);
  async function links() { if (isTWA()) return []; return linksOf(await load()); }

  async function openSheet() {
    const L = await links(); if (!L.length) return;
    openModal(`<div class="don-sheet"><h2 style="margin:0 0 6px;font-size:1.25rem">💜 Support Kemy</h2>
      <p style="margin:0 0 6px">Thank you for being here! Help Lone Keem Studios make Kemy even better.</p>
      <p class="muted small" style="margin:0 0 14px">You can give any amount you like. Donating is totally optional, and there are no rewards or perks for donating. Kemy is the same for everyone.</p>
      <div class="stack" style="gap:8px">${L.map((l) => `<a class="btn btn-block don-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${l.ic} ${esc(l.label)}</a>`).join('')}</div>
      <p class="small don-kids" style="margin:14px 0 0">👧🧒 Kids: ask a grown-up before donating.</p>
      <p class="muted small" style="margin:6px 0 0">Links open the service’s own page in a new tab. Written by Lone Keem.</p>
      <button class="btn btn-sm btn-ghost" data-close style="margin-top:12px">Close</button></div>`);
  }

  // Settings button
  async function mountSettings(el) {
    if (!el) return; const L = await links(); if (!L.length || !el.isConnected) return;
    el.innerHTML = `<button type="button" class="btn btn-block don-btn" id="don-open">Support Kemy 💜</button>`;
    el.querySelector('#don-open').onclick = openSheet;
  }
  // Small, dismissible home card
  const HIDE_KEY = 'kemy-don-card-hide';
  async function mountHome(el) {
    if (!el) return;
    try { if (+localStorage.getItem(HIDE_KEY) > Date.now()) return; } catch {}
    const L = await links(); if (!L.length || !el.isConnected) return;
    el.innerHTML = `<div class="card pad don-card"><span aria-hidden="true" style="font-size:1.3rem">💜</span><div style="flex:1;min-width:0"><b>Enjoying Kemy?</b><br><span class="muted small">Help Lone Keem Studios make Kemy even better. Totally optional.</span></div>
      <button type="button" class="btn btn-sm btn-ghost" id="don-home">Support</button><button type="button" class="link-btn don-x" id="don-x" aria-label="Hide this">✕</button></div>`;
    el.querySelector('#don-home').onclick = openSheet;
    el.querySelector('#don-x').onclick = () => { try { localStorage.setItem(HIDE_KEY, String(Date.now() + 30 * 864e5)); } catch {} el.innerHTML = ''; };
  }

  // Admin section
  async function mountAdmin(el) {
    if (!el) return; const d = await load(true);
    el.innerHTML = `<div class="card pad adm-tool" style="margin-bottom:12px"><b style="font-size:1.05rem">💜 Support Kemy (donation links)</b>
      <p class="muted small" style="margin:3px 0 10px">Paste your donation links (https only). Donors pick any amount on that service. Built-in default: 💵 Cash App ($lonekeem), used when the Cash App box is blank; a Cash App link here replaces it, other links are added. Always hidden in the Android app (Google Play rules).</p>
      <form id="don-form">${SERVICES.map(([k, label, ic, ph]) => `<div class="field"><label for="don-${k}">${ic} ${label}</label><input id="don-${k}" type="url" inputmode="url" maxlength="300" placeholder="${esc(ph)}" value="${esc(d[k] || '')}" autocapitalize="none" autocomplete="off" spellcheck="false"></div>`).join('')}
        <div class="field"><label for="don-otherLabel">Button name for “Other link”</label><input id="don-otherLabel" type="text" maxlength="30" placeholder="Donate" value="${esc(d.otherLabel || '')}"></div>
        <button class="btn" type="submit">Save donation links</button> <button class="btn btn-ghost" type="button" id="don-preview">Preview sheet</button></form>
      <p class="small muted" id="don-msg" style="margin:8px 0 0"></p></div>`;
    const msg = el.querySelector('#don-msg');
    el.querySelector('#don-preview').onclick = () => (isTWA() ? toast('Hidden in the Android app') : openSheet());
    el.querySelector('#don-form').onsubmit = async (e) => {
      e.preventDefault(); if (!isAdmin()) return toast('Admins only');
      const out = {};
      for (const [k, label] of SERVICES) { const v = cleanLink(el.querySelector('#don-' + k).value); if (v === null) { msg.textContent = `${label}: use a full https:// link.`; return; } out[k] = v; }
      out.otherLabel = el.querySelector('#don-otherLabel').value.trim().slice(0, 30);
      out.updatedAt = serverTimestamp();
      try { await setDoc(doc(db, 'config', 'donate'), out); await load(true); const n = linksOf(cache).length; msg.textContent = n ? `Saved. ${n} link${n > 1 ? 's' : ''} live.` : 'Saved.'; toast('Donation links saved'); }
      catch (err) { msg.textContent = friendlyError(err); }
    };
  }
  return { mountSettings, mountHome, mountAdmin, openSheet, links, isTWA };
}
