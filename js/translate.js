// Auto-translate (free only, no keys). Shows chats, posts, comments and captions in the viewer's language.
// 1) Chrome's on-device Translator + LanguageDetector when available (private, unlimited).
// 2) Otherwise MyMemory's free anonymous API (~5,000 chars/day per IP), then a public Lingva instance.
// Only visible text that looks like another language is sent. Results are cached (memory + localStorage)
// and run through the kind-words filter before showing. If limits are hit we show the original + a Translate button.
// Written by Lone Keem.
import { badWord, sneakyWord } from './kindguard.js';
const PK = 'kemy-translate', CK = 'kemy-tx-cache', QK = 'kemy-tx-quota';
export const LANGS = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch', pl: 'Polish', tr: 'Turkish', ru: 'Russian', uk: 'Ukrainian', ar: 'Arabic', hi: 'Hindi', bn: 'Bengali', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', vi: 'Vietnamese', id: 'Indonesian', tl: 'Filipino', sv: 'Swedish', el: 'Greek', he: 'Hebrew', th: 'Thai', sw: 'Swahili' };
const navLang = () => { const l = (navigator.language || 'en').slice(0, 2).toLowerCase(); return LANGS[l] ? l : 'en'; };
export function getPrefs() { let p = {}; try { p = JSON.parse(localStorage.getItem(PK) || '{}'); } catch (_) {} return { auto: p.auto !== false, to: LANGS[p.to] ? p.to : navLang() }; }
export function setPrefs(o) { localStorage.setItem(PK, JSON.stringify({ ...getPrefs(), ...o })); resetAll(); }
// ---- language guess (cheap, local) ----
const SCRIPTS = [[/[\u0400-\u04FF]/, 'ru'], [/[\u0370-\u03FF]/, 'el'], [/[\u0590-\u05FF]/, 'he'], [/[\u0600-\u06FF]/, 'ar'], [/[\u0900-\u097F]/, 'hi'], [/[\u0980-\u09FF]/, 'bn'], [/[\u0E00-\u0E7F]/, 'th'], [/[\u3040-\u30FF]/, 'ja'], [/[\uAC00-\uD7AF]/, 'ko'], [/[\u4E00-\u9FFF]/, 'zh']];
const STOP = {
  en: 'the and you is are to of it this that what my your with for was have not hi hello love so like',
  es: 'el la los las de que y en es por para con una un muy pero como hola qué gracias está estoy tu yo mi amigo bien también',
  fr: 'le la les de des et est je tu il une un pour pas que qui avec bonjour merci très mais oui c\'est suis ça',
  de: 'der die das und ist ich du nicht ein eine mit auf für hallo danke sehr aber ja wie bin',
  pt: 'o a os de que e é não um uma para com muito obrigado olá você eu está mas como também',
  it: 'il lo la di che e è non un una per con ciao grazie molto ma sono come anche',
  nl: 'de het een en is ik je niet van dat met hallo dank heel maar ook',
  id: 'dan yang di ini itu aku kamu tidak ada untuk dengan terima kasih halo',
  tr: 've bir bu ben sen çok ne için merhaba teşekkürler değil',
  pl: 'i w nie jest to się na że jak cześć dziękuję bardzo',
};
const SW = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));
export function guessLang(t) {
  const s = String(t || ''); for (const [re, l] of SCRIPTS) if (re.test(s)) { if (l === 'ru' && /[іїєґ]/i.test(s)) return 'uk'; return l; }
  const words = s.toLowerCase().match(/[\p{L}']+/gu) || []; if (words.length < 2) return '';
  let best = '', bs = 0, en = 0;
  for (const [l, set] of Object.entries(SW)) { let n = 0; for (const w of words) if (set.has(w)) n++; if (l === 'en') en = n; if (n > bs) { bs = n; best = l; } }
  if (/[ñ¿¡]/.test(s)) return 'es'; if (/[ãõ]/.test(s)) return 'pt'; if (/ß/.test(s)) return 'de';
  return bs >= 1 && (best === 'en' || bs > en) ? best : '';
}
let detector = null;
// Chrome's built-in AI can stall while a model downloads: never wait more than ~1.5s on it.
const within = (p, ms = 1500) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms))]);
async function detect(t) {
  try { if (detector == null && self.LanguageDetector) { detector = false; if ((await within(self.LanguageDetector.availability())) === 'available') detector = await within(self.LanguageDetector.create()); } } catch (_) { detector = false; }
  if (detector) { try { const r = (await within(detector.detect(t)))[0]; if (r && r.confidence > 0.6 && r.detectedLanguage !== 'und') return r.detectedLanguage.slice(0, 2); } catch (_) {} }
  return guessLang(t);
}
// ---- cache ----
const mem = new Map(); let disk = {}; try { disk = JSON.parse(localStorage.getItem(CK) || '{}'); } catch (_) {}
const saveDisk = () => { const k = Object.keys(disk); if (k.length > 400) k.slice(0, k.length - 400).forEach((x) => delete disk[x]); try { localStorage.setItem(CK, JSON.stringify(disk)); } catch (_) {} };
const today = () => new Date().toISOString().slice(0, 10);
const quotaOut = () => localStorage.getItem(QK) === today();
// ---- translators ----
const chromeTx = {};
async function viaChrome(t, from, to) {
  if (!self.Translator) return null; const k = from + '>' + to;
  try { if (!chromeTx[k]) { const a = await within(self.Translator.availability({ sourceLanguage: from, targetLanguage: to })); if (a !== 'available') return null; chromeTx[k] = await within(self.Translator.create({ sourceLanguage: from, targetLanguage: to }), 4000); } return await within(chromeTx[k].translate(t), 5000); } catch (_) { return null; }
}
async function viaMyMemory(t, from, to) {
  if (quotaOut()) return null;
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t.slice(0, 500))}&langpair=${from}|${to}`, { signal: AbortSignal.timeout(8000) }); const j = await r.json();
    if (r.status === 429 || j.quotaFinished || j.responseStatus === 429 || /MYMEMORY WARNING/i.test(j.responseData?.translatedText || '')) { localStorage.setItem(QK, today()); return null; }
    if (j.responseStatus !== 200 && j.responseStatus !== '200') return null; return j.responseData?.translatedText || null;
  } catch (_) { return null; }
}
async function viaLingva(t, from, to) {
  try { const r = await fetch(`https://lingva.ml/api/v1/${from}/${to}/${encodeURIComponent(t.slice(0, 500))}`, { signal: AbortSignal.timeout(8000) }); if (!r.ok) return null; const j = await r.json(); return j.translation && j.translation.trim().toLowerCase() !== t.trim().toLowerCase() ? j.translation : null; } catch (_) { return null; }
}
const unesc = (s) => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; };
// Mean words in a translation are masked so a translation can never sneak them in.
export function kindMask(s) { let out = String(s); for (let i = 0; i < 6; i++) { const w = badWord(out) || sneakyWord(out); if (!w) break; const re = new RegExp(w.split('').join('[^a-z]*'), 'i'); if (!re.test(out)) return '💜'; out = out.replace(re, '💜'); } return out; }
export async function translateText(t, to = getPrefs().to, from) {
  t = String(t || '').trim(); if (!t) return null; from = from || (await detect(t)); if (!from || from === to) return null;
  const key = from + '|' + to + '|' + t; if (mem.has(key)) return mem.get(key); if (disk[key]) return { text: disk[key], from };
  const p = (async () => { let r = await viaChrome(t, from, to); if (r == null) r = await viaMyMemory(t, from, to); if (r == null) r = await viaLingva(t, from, to);
    if (r == null) { mem.delete(key); return { failed: true, from }; } r = kindMask(unesc(r)); disk[key] = r; saveDisk(); return { text: r, from }; })();
  mem.set(key, p); return p;
}
// ---- DOM ----
const FULL = '.post-text, .comment .text:not(.cdel), .lv-t, .gtext, .story-cap:not(.pv-story-cap), .caption, [data-tx]';
const OWN = '.bubble:not(.snapmsg)'; // DMs + Mod threads: text sits beside <time>/<button>
const SEL = FULL + ', ' + OWN;
const ownNodes = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
const textOf = (el) => (el.matches(OWN) ? ownNodes(el).map((n) => n.textContent).join(' ') : el.textContent).trim();
function line(el, html) { let l = el._txLine; if (!l) { l = document.createElement('div'); l.className = 'tx-line'; el._txLine = l; if (el.matches(OWN)) el.insertBefore(l, el.querySelector('time')); else el.insertAdjacentElement('afterend', l); } l.innerHTML = html; return l; }
function show(el, res) {
  const name = LANGS[res.from] || res.from.toUpperCase();
  if (!el._txOrig) el._txOrig = el.matches(OWN) ? ownNodes(el).map((n) => n.textContent) : el.innerHTML;
  const setTr = (on) => {
    if (el.matches(OWN)) { const ns = ownNodes(el); ns.forEach((n, i) => { n.textContent = on ? (i ? '' : res.text) : (el._txOrig[i] || ''); }); }
    else { el._txSelf = 1; if (on) el.textContent = res.text; else el.innerHTML = el._txOrig; Promise.resolve().then(() => { el._txSelf = 0; }); }
    line(el, on ? `Translated from ${name} · <button type="button" class="tx-btn">See original</button>` : `<button type="button" class="tx-btn">See translation</button>`).querySelector('button').onclick = (e) => { e.stopPropagation(); setTr(!on); };
  };
  setTr(true);
}
async function run(el, manual) {
  if (el._txBusy || el._txDone) return; const t = textOf(el); if (!t || t.length > 2000) return;
  const P = getPrefs(); if (!P.auto && !manual) { const g = guessLang(t); if (g && g !== P.to) offer(el); return; }
  el._txBusy = 1; const res = await translateText(t, P.to); el._txBusy = 0; if (!res) return;
  if (res.failed) { offer(el, res.from); return; } el._txDone = 1; show(el, res);
}
function offer(el, from) { line(el, `${from && LANGS[from] ? LANGS[from] + ' · ' : ''}<button type="button" class="tx-btn">Translate</button>`).querySelector('button').onclick = (e) => { e.stopPropagation(); el._txDone = 0; localStorage.removeItem(QK); run(el, true); }; }
let io = null;
function resetAll() { document.querySelectorAll(SEL).forEach((el) => { if (el._txOrig) { if (el.matches(OWN)) ownNodes(el).forEach((n, i) => { n.textContent = el._txOrig[i] || ''; }); else el.innerHTML = el._txOrig; } el._txLine?.remove(); el._txLine = el._txOrig = null; el._txDone = 0; io && io.observe(el); }); }
export function initTranslate() {
  if (!('IntersectionObserver' in self)) return;
  io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }), { rootMargin: '100px' });
  const scan = (root) => { if (root.matches && root.matches(SEL)) io.observe(root); root.querySelectorAll && root.querySelectorAll(SEL).forEach((el) => io.observe(el)); };
  scan(document.body);
  new MutationObserver((ms) => ms.forEach((m) => {
    const t = m.target; // reused boxes (story captions) get new text: start over for that box
    if (t.nodeType === 1 && t.matches(FULL) && !t._txSelf && t._txOrig != null && [...m.addedNodes].some((n) => n.nodeType === 3)) { t._txLine?.remove(); t._txLine = t._txOrig = null; t._txDone = 0; io.observe(t); }
    m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !n.classList.contains('tx-line')) scan(n); });
  })).observe(document.body, { childList: true, subtree: true });
}
// Settings card
export function settingsHtml() { const P = getPrefs(); return `<section class="card pad" style="margin-top:16px" aria-labelledby="tx-h"><h2 id="tx-h" style="font-size:1.05rem">Translation</h2>
  <label class="row" style="gap:10px;margin-bottom:10px"><input type="checkbox" id="s-tx-auto" ${P.auto ? 'checked' : ''}> <span>Auto-translate chats, posts and comments</span></label>
  <div class="field" style="margin:0"><label for="s-tx-to">Translate to</label><select id="s-tx-to">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === P.to ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
  <p class="muted small" style="margin:8px 0 0">Free translation: on-device in Chrome when it can, otherwise a free public service (limited each day). If it runs out, tap “Translate”.</p></section>`; }
export function wireSettings(root = document) { const a = root.querySelector('#s-tx-auto'), s = root.querySelector('#s-tx-to'); if (a) a.onchange = () => setPrefs({ auto: a.checked }); if (s) s.onchange = () => setPrefs({ to: s.value }); }
