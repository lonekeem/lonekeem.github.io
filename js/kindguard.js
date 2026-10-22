// "Let's keep it kind": live as-you-type check on every text box in the app (chat bars, comments,
// captions, bios, names, park / lobby chat). A bad word highlights the hint, disables Send/Post and
// blocks Enter. Tricks that only a stricter check catches on submit (s.p.a.c.e.d letters, l33t,
// repeated letters) or 3+ blocked tries in 10 minutes => 1-hour timeout + an item in the Mod Hub.
import { plainText, isFancy } from './plaintext.js';
export { plainText, isFancy };
const WORDS = [
  'fuck', 'fuk', 'fck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'cunt', 'slut', 'whore', 'fag', 'faggot', 'nigga', 'nigger',
  'retard', 'wtf', 'stfu', 'porn', 'nude', 'nudes', 'naked', 'sexy', 'sex', 'penis', 'vagina', 'boobs', 'horny', 'kys', 'kill yourself',
  'pussy', 'cock', 'motherfucker', 'dumbass', 'jackass', 'piss', 'twat', 'wanker', 'idiot', 'stupid', 'loser', 'shut up', 'hate you', 'ugly', 'nobody likes you'
];
const ROOTS = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'fagg', 'porn', 'pussy', 'motherf', 'whore', 'slut', 'asshole', 'retard'];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WRE = new RegExp('(^|[^a-z])(' + WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|') + ')(?:s|es|ing|ed|er|y)?(?=$|[^a-z])', 'i');
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '€': 'e' };
const loose = (t) => plainText(String(t || '')).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
// Word found with a normal check (what we highlight as you type).
export function badWord(t) { const m = loose(t).replace(/[0-9!|@$+€]/g, (c) => LEET[c] || c).match(WRE); return m ? m[2] : ''; }
// Stricter check used on submit: drop separators, undo l33t, squash repeated letters.
export function sneakyWord(t) {
  // join runs of single letters ("f u c k", "f.u.c.k", "f-u-c-k"), undo l33t, squash repeats (3+)
  let x = loose(t).replace(/\b([a-z0-9@$!|])(?:[\s._*\-]+(?=[a-z0-9@$!|]\b))/g, '$1');
  x = x.replace(/[0-9!|@$+€]/g, (c) => LEET[c] || c).replace(/[._*\-]/g, '').replace(/(.)\1{2,}/g, '$1').replace(/(.)\1+/g, '$1$1');
  for (const tok of x.split(/[^a-z]+/)) { if (!tok) continue; const sq = tok.replace(/(.)\1+/g, '$1');
    const r = ROOTS.find((r) => tok.startsWith(r) || sq.startsWith(r.replace(/(.)\1+/g, '$1')) || tok.endsWith(r)); if (r) return r; }
  return '';
}
const FIELD = 'input:not([type]), input[type=text], input[type=search], textarea';
export function initKindGuard({ onBypass, onBlock } = {}) {
  let tries = [];
  const box = (el) => el.closest('form') || el.parentElement;
  const hintFor = (el) => { let h = el._kindHint; if (!h) { h = document.createElement('div'); h.className = 'kind-hint'; h.setAttribute('role', 'status'); h.setAttribute('aria-live', 'polite'); el._kindHint = h; el.insertAdjacentElement('afterend', h); } return h; };
  const btns = (el) => [...box(el).querySelectorAll('button, input[type=submit]')].filter((b) => b !== el && b.type !== 'reset' && !b.closest('.kind-hint'));
  function check(el) {
    if (!el || !el.matches || !el.matches(FIELD) || el.readOnly || el.type === 'password' || el.type === 'email' || el.dataset.kindOff != null) return '';
    const w = badWord(el.value);
    if (w) {
      el.classList.add('kind-bad'); el.setAttribute('aria-invalid', 'true');
      const h = hintFor(el); h.hidden = false; h.innerHTML = `💜 <b>Let’s keep it kind.</b> “<mark>${esc(w)}</mark>” isn’t allowed on Kemy.`;
      btns(el).forEach((b) => { if (!b.disabled) { b.disabled = true; b.dataset.kindDis = '1'; } });
    } else if (el.classList.contains('kind-bad')) {
      el.classList.remove('kind-bad'); el.removeAttribute('aria-invalid'); if (el._kindHint) el._kindHint.hidden = true;
      btns(el).forEach((b) => { if (b.dataset.kindDis) { b.disabled = false; delete b.dataset.kindDis; } });
    }
    return w;
  }
  const blocked = (el, text, sneaky) => {
    const now = Date.now(); tries = tries.filter((x) => now - x < 600000); tries.push(now);
    if (sneaky || tries.length >= 3) { tries = []; onBypass && onBypass({ text: String(text).slice(0, 280), word: sneaky || badWord(text), sneaky: !!sneaky }); }
  };
  // Modded / fancy-font keyboards: swap look-alike letters for regular ones right in the box (keeps the caret),
  // so what gets saved is plain text. A mean word hidden in fancy letters counts as a workaround.
  const note = (el) => { const h = hintFor(el); if (el.classList.contains('kind-bad')) return; h.hidden = false; h.innerHTML = '💜 Please use regular letters — we switched them for you.'; clearTimeout(el._kindNoteT); el._kindNoteT = setTimeout(() => { if (!el.classList.contains('kind-bad')) h.hidden = true; }, 3500); };
  function unfancy(el) {
    if (!el || !el.matches || !el.matches(FIELD) || el.readOnly || el.type === 'password' || el.type === 'email' || el.dataset.kindOff != null) return;
    const v = el.value; if (!isFancy(v)) return;
    const pos = el.selectionStart; const nv = plainText(v);
    el.value = nv; try { if (pos != null) { const c = plainText(v.slice(0, pos)).length; el.setSelectionRange(c, c); } } catch (_) {}
    note(el);
    const w = badWord(nv) || sneakyWord(nv);
    if (w && !el._kindFancyHit) { el._kindFancyHit = 1; setTimeout(() => { el._kindFancyHit = 0; }, 10000); blocked(el, nv, w); }
  }
  document.addEventListener('input', (e) => { if (!e.isComposing) unfancy(e.target); check(e.target); }, true);
  // Enter / submit / Send clicks while a nearby field has a bad word (or a sneaky one) are stopped.
  const guard = (el, e) => {
    if (!el || !el.matches || !el.matches(FIELD) || el.type === 'password' || el.type === 'email' || el.dataset.kindOff != null) return false;
    const w = check(el); const sn = !w && sneakyWord(el.value);
    if (!w && !sn) return false;
    e.preventDefault(); e.stopImmediatePropagation();
    if (sn) { const h = hintFor(el); h.hidden = false; h.innerHTML = '💜 <b>Let’s keep it kind.</b> Tricky spellings of mean words aren’t allowed either.'; el.classList.add('kind-bad'); }
    if (onBlock) onBlock({ text: String(el.value || '').slice(0, 200), word: sn || w });
    blocked(el, el.value, sn); return true;
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && e.target.matches && e.target.matches('input')) guard(e.target, e); }, true);
  document.addEventListener('submit', (e) => { for (const el of e.target.querySelectorAll(FIELD)) if (guard(el, e)) return; }, true);
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button, input[type=submit]'); if (!b) return;
    const c = b.closest('form') || b.parentElement; if (!c) return;
    for (const el of c.querySelectorAll(FIELD)) if (guard(el, e)) return;
  }, true);
  return { check, badWord, sneakyWord };
}
