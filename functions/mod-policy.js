// Kid-safe chat decisions for the Kemy Helper. Pure: no Firebase.
// A first problem is a warning. A repeat within a day pauses chat for 10 minutes.
// This never chooses a ban. Written by Lone Keem.
const MUTE_MS = 10 * 60 * 1000;
const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;
const FLOOD_WINDOW_MS = 30 * 1000;
const HARASS_MAX = 4;
const HARASS_WINDOW_MS = 10 * 60 * 1000;
const GRIEF_MS = 45 * 1000;
const WARN = "Kemy Helper: let's keep it kind!";
const CARE_NOTE = "I'm really glad you said something. Please tell a trusted adult right now. In the US you can call or text 988.";

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' };

function fold(s) {
  let x = String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  x = x.replace(/[0134578@$!]/g, (c) => LEET[c] || c);
  x = x.replace(/\b([a-z])(?:[\s._*\-]+(?=[a-z]\b))/g, '$1');
  return x;
}

const CARE = /\b(kill myself|killing myself|suicide|suicidal|self[- ]?harm|cut myself|cutting myself|hurt myself|want to die|wanna die|end my life|no reason to live)\b/i;
const SLUR = /\b(nigg\w*|fag\w*|retard\w*)\b/i;
const SEX = /\b(sex|sexy|nudes?|naked|porn|boobs?|penis|vagina|horny|onlyfans|nsfw)\b/i;
const VIOLENT = /\b(kill you|murder|shoot you|stab you|i('?ll| will) (kill|hurt)|bomb|terroris\w*|torture)\b/i;
const WORD = /\b(fuck\w*|shit\w*|bitch\w*|asshole|bastard|dick|cunt|slut|whore|wtf|stfu|piss|twat)\b/i;
const MILD = /\b(damn|hell)\b/i;
const PHONE = /\b(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b|(?:\d[\s.\-()]*){10,}/;
const SPELLED = /\b(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)(?:[\s,.-]+(?:zero|oh|one|two|three|four|five|six|seven|eight|nine)){5,}\b/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|gg|xyz|ly|app|link|io)\b/i;
const SOCIAL = /\b(snapchat|snap|instagram|insta|whatsapp|discord|tiktok|telegram|kik)\b|tik tok|\b(my snap|add me on|add me|text me|dm me)\b|\bdiscord\.gg\b|\bt\.me\/|\bwa\.me\b/i;
const HANDLE = /(?:snap(?:chat)?|discord|insta(?:gram)?|tik\s?tok|whatsapp|telegram|kik)[^\n]{0,30}@[a-z0-9._]{2,}|@[a-z0-9._]{2,}[^\n]{0,30}(?:snap(?:chat)?|discord|insta(?:gram)?|tik\s?tok|whatsapp|telegram|kik)|\b[a-z0-9._]{2,32}#\d{4}\b/i;
const ADDRESS = /\b\d{1,5}\s+[a-z0-9.' ]{2,30}\s(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|blvd|boulevard)\b/i;
const GROOM = /\b(how old are you|how old r u|how old ru|what(?:'s| is) your age|whats your age|\basl\b|a\/s\/l|where do you live|where you live|what(?:'s| is) your address|whats your address|your address|what school|which school|your school|school do you|are you alone|r u alone|you alone|home alone|send (?:me )?(?:a )?pic\b|send (?:me )?(?:a )?photo\b|send pic|don'?t tell (?:your|anyone)|dont tell (?:your|anyone)|keep this (?:a )?secret)\b/i;

function stars(w) { return '★'.repeat(Math.min(5, String(w).length)); }

function maskOf(raw) {
  return String(raw || '').replace(WORD, stars).replace(MILD, stars);
}

function scan(text) {
  const raw = String(text || '');
  const t = fold(raw);
  const none = { action: 'ok', kind: 'ok', text: raw, strike: false, serious: false, ban: false };
  if (!t.trim()) return none;
  if (CARE.test(t) || CARE.test(raw)) return { action: 'care', kind: 'care', text: '', strike: false, serious: false, ban: false };
  if (SLUR.test(t)) return { action: 'block', kind: 'slur', text: '', strike: true, serious: true, ban: false };
  if (SEX.test(t)) return { action: 'block', kind: 'sexual', text: '', strike: true, serious: true, ban: false };
  if (VIOLENT.test(t)) return { action: 'block', kind: 'violent', text: '', strike: true, serious: true, ban: false };
  if (GROOM.test(t) || GROOM.test(raw)) return { action: 'block', kind: 'groom', text: '', strike: false, serious: true, ban: false };
  if (PHONE.test(raw) || SPELLED.test(raw)) return { action: 'block', kind: 'phone', text: '', strike: true, serious: true, ban: false };
  if (EMAIL.test(raw) || EMAIL.test(t)) return { action: 'block', kind: 'email', text: '', strike: true, serious: true, ban: false };
  if (ADDRESS.test(raw) || ADDRESS.test(t)) return { action: 'block', kind: 'address', text: '', strike: true, serious: true, ban: false };
  if (HANDLE.test(raw) || SOCIAL.test(t) || SOCIAL.test(raw)) return { action: 'block', kind: 'social', text: '', strike: true, serious: true, ban: false };
  if (LINK.test(raw) || LINK.test(t)) return { action: 'block', kind: 'link', text: '', strike: true, serious: false, ban: false };
  if (WORD.test(t) || WORD.test(raw)) return { action: 'mask', kind: 'word', text: maskOf(raw), strike: true, serious: false, ban: false };
  if (MILD.test(t) || MILD.test(raw)) return { action: 'mask', kind: 'mild', text: maskOf(raw), strike: false, serious: false, ban: false };
  return none;
}

function nameProblem(name) {
  const s = scan(name);
  return s.action === 'mask' || s.action === 'block';
}

// prior is how many strikes this person already has inside the window, before this one.
function nextStep(prior) {
  const n = Math.max(0, prior | 0);
  if (n <= 0) return { step: 'warn', muteMs: 0, ban: false };
  return { step: 'mute', muteMs: MUTE_MS, ban: false };
}

function flood(times, now, max) {
  const cap = max || 8;
  const hit = (times || []).filter((t) => now - t < FLOOD_WINDOW_MS);
  const bad = hit.length >= cap;
  return { bad, n: hit.length, serious: bad, ban: false };
}

function harass(events, now) {
  const recent = (events || []).filter((e) => e && now - e.at < HARASS_WINDOW_MS);
  const counts = {};
  let worst = 0;
  let who = '';
  for (let i = 0; i < recent.length; i++) {
    const id = String(recent[i].id || '');
    if (!id) continue;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > worst) { worst = counts[id]; who = id; }
  }
  const bad = worst >= HARASS_MAX;
  return { bad, target: who, n: worst, serious: bad, ban: false };
}

function grief(stillMs) {
  const flag = (stillMs | 0) >= GRIEF_MS;
  return { flag, serious: flag, ban: false };
}

function snapshot(lines) {
  const parts = (lines || []).slice(-6).map((l) => String(l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  let s = parts.join(' | ');
  if (s.length > 300) s = s.slice(0, 300);
  return s;
}

module.exports = {
  MUTE_MS, STRIKE_WINDOW_MS, WARN, CARE_NOTE, GRIEF_MS,
  scan, nameProblem, nextStep, flood, harass, grief, snapshot
};
