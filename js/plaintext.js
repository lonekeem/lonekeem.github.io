// "Modded keyboard" clean-up. Fancy-font keyboards type look-alike Unicode (𝐛𝐨𝐥𝐝, ｆｕｌｌ, ⓒⓘⓡⓒⓛⓔ, ꜱᴍᴀʟʟ ᴄᴀᴘꜱ,
// zalgo, zero-width tricks, Cyrillic/Greek look-alikes). plainText() turns it back into regular letters so the
// kind-words filter sees the real words. Emoji and real non-Latin writing (Русский, Ελληνικά, 日本語) are kept;
// Cyrillic/Greek look-alikes are only swapped when they sit inside a word that also has Latin letters.
// Written by Lone Keem.
const INVIS = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\u3164\uFEFF\uFFA0\u{E0000}-\u{E007F}]/gu;
// Keycap/emoji joiners (ZWJ \u200D, VS16 \uFE0F) stay when next to emoji so 👨‍👩‍👧 and ❤️ still work.
const EMOJI = /\p{Extended_Pictographic}/u;
const SMALL = { 'ᴀ': 'a', 'ʙ': 'b', 'ᴄ': 'c', 'ᴅ': 'd', 'ᴇ': 'e', 'ꜰ': 'f', 'ɢ': 'g', 'ʜ': 'h', 'ɪ': 'i', 'ᴊ': 'j', 'ᴋ': 'k', 'ʟ': 'l', 'ᴍ': 'm', 'ɴ': 'n', 'ᴏ': 'o', 'ᴘ': 'p', 'ǫ': 'q', 'ʀ': 'r', 'ꜱ': 's', 'ᴛ': 't', 'ᴜ': 'u', 'ᴠ': 'v', 'ᴡ': 'w', 'ʏ': 'y', 'ᴢ': 'z',
  'ɐ': 'a', 'ɔ': 'c', 'ǝ': 'e', 'ɟ': 'f', 'ƃ': 'g', 'ɥ': 'h', 'ı': 'i', 'ɾ': 'j', 'ʞ': 'k', 'ɯ': 'm', 'ɹ': 'r', 'ʇ': 't', 'ʌ': 'v', 'ʍ': 'w', 'ʎ': 'y', 'ꓘ': 'k', 'ᗪ': 'd', 'ᖴ': 'f', 'ᑕ': 'c', 'ᗩ': 'a', 'ᗷ': 'b', 'ᕼ': 'h', 'ᒪ': 'l', 'ᑎ': 'n', 'ᑭ': 'p', 'ᑌ': 'u', 'ᐯ': 'v', 'ᗯ': 'w', 'ᘔ': 'z' };
// Look-alikes from Cyrillic / Greek / Armenian etc. Only used inside mixed-script words.
const HOMO = { 'а': 'a', 'в': 'b', 'с': 'c', 'ԁ': 'd', 'е': 'e', 'ё': 'e', 'һ': 'h', 'і': 'i', 'ї': 'i', 'ј': 'j', 'к': 'k', 'ӏ': 'l', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'ԛ': 'q', 'г': 'r', 'ѕ': 's', 'т': 't', 'у': 'y', 'ц': 'u', 'ѡ': 'w', 'х': 'x', 'ү': 'y', 'и': 'u', 'п': 'n', 'ь': 'b', 'з': '3', 'ч': '4',
  'α': 'a', 'β': 'b', 'ϲ': 'c', 'ε': 'e', 'η': 'n', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'χ': 'x', 'γ': 'y', 'ω': 'w', 'μ': 'u', 'ѵ': 'v', 'ս': 'u', 'օ': 'o', 'ց': 'g', 'հ': 'h', 'ո': 'n' };
const LATIN = /[a-z]/i;
const NONLAT = /[\u0370-\u03FF\u0400-\u052F\u0530-\u058F]/;
const fold = (s) => s.normalize('NFKD').replace(/\p{M}+/gu, '');
// Does the text contain anything that "regular letters" would change?
export function plainText(input) {
  let s = String(input == null ? '' : input);
  // 1) keep joiners only between emoji; drop zero-width, bidi, fillers, tags
  s = s.replace(/[\u200D\uFE0F\uFE0E]/g, (c, i) => (EMOJI.test(s.slice(Math.max(0, i - 2), i + 3)) || s[i + 1] === '\u20E3' ? c : ''));
  s = s.replace(INVIS, '');
  // 2) NFKC folds math bold/italic/script/fraktur/double-struck, fullwidth, circled, squared(🄰), superscripts
  s = s.normalize('NFKC');
  // Squared/negative letters (🅰 🆂) and regional indicators aren't NFKC-folded: map by code point.
  s = s.replace(/[\u{1F130}-\u{1F149}]/gu, (c) => String.fromCharCode(97 + c.codePointAt(0) - 0x1F130))
    .replace(/[\u{1F150}-\u{1F169}]/gu, (c) => String.fromCharCode(97 + c.codePointAt(0) - 0x1F150))
    .replace(/[\u{1F170}-\u{1F189}]/gu, (c) => String.fromCharCode(97 + c.codePointAt(0) - 0x1F170))
    .replace(/[\u24B6-\u24E9]/g, (c) => { const n = c.charCodeAt(0); return String.fromCharCode(n < 0x24D0 ? 65 + n - 0x24B6 : 97 + n - 0x24D0); });
  // 3) small caps / upside-down / Canadian-syllabics look-alikes
  s = s.replace(/[\u0180-\u02AF\u1D00-\u1D7F\uA720-\uA7FF\u1400-\u167F\uA4D0-\uA4FF]/g, (c) => SMALL[c] || c);
  // 4) zalgo: strip combining marks on Latin letters only (keeps é via recompose, keeps Hindi/Thai/Arabic marks)
  s = s.replace(/([A-Za-z\u00C0-\u024F])(\p{M}+)/gu, (m, b, marks) => (b + marks).normalize('NFC').replace(/\p{M}+/gu, ''));
  s = s.replace(/([\s\p{P}]|^)(?:(?!\uFE0F)\p{M})+/gu, '$1').replace(/(\p{S})(?:(?![\uFE0F\u20E3])\p{M})+/gu, '$1');
  // 5) homoglyphs inside words that mix Latin with Cyrillic/Greek
  s = s.replace(/[\p{L}\p{M}\d]+/gu, (w) => (LATIN.test(fold(w)) && NONLAT.test(w) ? [...w].map((c) => HOMO[c.toLowerCase()] || c).join('') : w));
  return s;
}
export const isFancy = (s) => plainText(s) !== String(s == null ? '' : s);
// Aggressive form used only for the swear check (never shown): plain + lowercase + accents off.
export function checkForm(s) { return fold(plainText(s)).toLowerCase(); }
