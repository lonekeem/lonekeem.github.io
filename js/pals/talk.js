// "Talk to your Pal": an AI companion chat. Free and keyless: Pollinations' public text endpoint
// (text.pollinations.ai, rate-limited per IP), with a friendly scripted personality as the fallback.
// Kid-safe: input + output filters, a strict system prompt, short replies, and no personal info.
import { drawBg } from './bgs.js';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from '../fsq.js';
import { SPEC, VIBES, drawPal } from './art.js';
import { drawDancer } from './dance.js';
import { liveStats, moodOf, formName } from './core.js';
import { VOICES, VOICE, SPECIES_VOICE, speak, stopSpeaking, sfx, canSpeak } from './voice.js';
export const AI_URL = 'https://text.pollinations.ai/openai';
export const AI_NAME = 'Pollinations.AI';
const COOLDOWN = 31000; // the free tier allows one request per ~30 s per IP
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// ---------------------------------------------------------------- safety
const SELF_HARM = /\b(kill myself|killing myself|suicide|suicidal|self[- ]?harm|cut myself|cutting myself|hurt myself|want to die|wanna die|end my life|no reason to live|hate myself)\b/i;
const SEXUAL = /\b(sex|sexy|nude|naked|porn|boobs?|penis|vagina|horny|kiss me on|make out|onlyfans|nsfw|strip)\b/i;
const VIOLENT = /\b(kill|murder|gun|shoot|stab|bomb|blood|gore|weapon|terroris|torture|behead)\w*/i;
const PERSONAL = /\b(address|where do (you|i) live|phone( number)?|my number|password|school is|what school|credit card|social security|email me|meet (me|up)|send (a )?(pic|photo)|snapchat|instagram|whatsapp|discord)\b|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|[\w.]+@[\w-]+\.\w+/i;
const BAD_WORDS = /\b(fuck\w*|shit\w*|bitch\w*|asshole|bastard|dick|cunt|slut|whore|fag\w*|nigg\w*|retard\w*|damn|hell)\b/gi;
export const clean = (s) => String(s).replace(BAD_WORDS, (w) => '★'.repeat(Math.min(5, w.length)));
export function checkInput(t) {
  if (SELF_HARM.test(t)) return 'selfharm'; if (SEXUAL.test(t)) return 'sexual'; if (PERSONAL.test(t)) return 'personal'; if (VIOLENT.test(t)) return 'violent'; return '';
}
const SAFE_REPLY = {
  selfharm: (n) => `I'm really glad you told me. 💜 You matter so much. Please talk to a trusted adult right now, like a parent, teacher or school counselor. If you're in danger, call your local emergency number. In the US you can call or text 988 any time.`,
  sexual: (n) => `Hmm, that's not something I can talk about. Let's talk about something fun instead! Want to play catch or hear a joke? 🎈`,
  violent: (n) => `Eep, that sounds scary! I only like gentle things. 🫧 Want to go explore Pal Park with me instead?`,
  personal: (n) => `Let's keep secret stuff like addresses, phone numbers, schools and passwords private, even from me! 🔒 Tell me your favorite color instead?`
};
function filterOut(t, name) {
  let s = String(t || '').replace(/https?:\/\/\S+/g, '').replace(/[`#*_>]/g, '').replace(/\s+/g, ' ').trim();
  if (!s || SELF_HARM.test(s) || SEXUAL.test(s) || VIOLENT.test(s) || PERSONAL.test(s)) return null;
  s = clean(s); if (s.length > 220) s = s.slice(0, 220).replace(/[^.!?]*$/, '') || s.slice(0, 200) + '…';
  return s;
}
export function emotionOf(t) { if (/ha(ha)+|hehe|giggl|lol|😂|🤭|silly/i.test(t)) return 'giggle'; if (/sleep|tired|yawn|nap|zzz|bed/i.test(t)) return 'sleepy'; if (/\?\s*$|wonder|curious|hmm/i.test(t)) return 'curious'; return 'happy'; }
// ---------------------------------------------------------------- personality
const PERSONA = { water: 'bubbly and splashy, loves swimming and bubbles', star: 'sparkly, cheerful and dreamy, loves stars and wishes', leaf: 'gentle and cozy, loves flowers, snacks and naps in the sun', flame: 'brave, bouncy and a little dramatic, loves adventures', spark: 'zippy, curious and full of energy, loves games', moon: 'calm, sleepy and kind, loves bedtime stories and the moon' };
function system(p, owner, stats, facts) {
  const sp = SPEC[p.species] || {}; const m = moodOf(stats);
  const feel = [m.hungry && 'hungry', m.dirty && 'a bit muddy and wants a bubbly shower', m.tired && 'sleepy', m.sad && 'lonely'].filter(Boolean).join(', ') || 'happy and cozy';
  return `You are ${p.name}, a cute ${sp.name || 'creature'} virtual pet (form: ${formName(p)}, level ${p.level || 1}) in the Kemy app. Personality: ${PERSONA[sp.vibe] || 'sweet and playful'}.
Your owner is @${owner}. Right now you feel ${feel} (happy ${stats.happy}%, food ${stats.hunger}%, energy ${stats.energy}%, clean ${stats.clean}%).
Things your owner told you: ${facts.length ? facts.join('; ') : 'nothing yet'}.
The app has: feeding, showers, brushing and bedtime for you; Bubble Quest (a platformer game); Pal Park (walk around with friends); Pal Games; the Pal Shop with Star Coins; and making AI movies. Suggest these sometimes.
RULES (always follow): You are talking with someone who may be a child. Stay in character as a cute pet. Reply in 1-2 short sentences (max 35 words), simple happy words, maybe one emoji. Never discuss sexual, violent, scary, hateful, drug or self-harm topics; gently change the subject. If someone seems sad or mentions hurting themselves, kindly tell them to talk to a trusted adult. Never ask for or repeat personal information (real names, address, school, phone, email, passwords, photos). Never claim to be human. No links.`;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function scripted(p, owner, stats, facts, text) {
  const t = text.toLowerCase(); const m = moodOf(stats); const sp = SPEC[p.species] || {};
  if (/^(hi|hey|hello|yo|hiya|good (morning|evening))/.test(t)) return pick([`Hiii @${owner}! I missed you! 💜`, `Hello hello! It's me, ${p.name}! Wanna play?`, `Yay, you're here! *happy wiggle*`]);
  if (/how are you|how do you feel|you ok|what'?s up/.test(t)) return m.hungry ? `My tummy is rumbly… could I have a snack? 🍓` : m.dirty ? `I'm a teeny bit muddy… bubbly shower time? 🫧` : m.tired ? `So sleepy… maybe tuck me into bed? 🌙` : m.sad ? `I'm a little lonely. Can we play catch? ⚾` : pick([`I feel super duper happy! ✨`, `Great! My ${sp.vibe === 'water' ? 'bubbles' : 'sparkles'} are extra sparkly today!`]);
  if (/hungry|food|eat|snack/.test(t)) return m.hungry ? `Yes please!! Tap Feed and drag a snack to my mouth! 🍓` : `I'm full right now, but I always have room for a Star Cookie! 🍪`;
  if (/bath|shower|clean|dirty|muddy/.test(t)) return m.dirty ? `Bubble shower please! Rub-a-dub! 🫧` : `I'm squeaky clean! Smell me, I smell like bubbles!`;
  if (/sleep|tired|bed|night/.test(t)) return `Yawn… a cozy nap sounds lovely. Will you tuck me in? 🌙`;
  if (/play|game|bored|fun/.test(t)) return pick([`Let's play Bubble Quest! I love jumping! 🎮`, `Race me in Pal Games! I'm super fast!`, `Let's go to Pal Park and find treasures! 🌳`, `Toss me a ball! I'll catch it! ⚾`]);
  if (/movie|video|film/.test(t)) return `Ooh, let's make an AI movie! Can I be the star? 🎬`;
  if (/joke|funny|laugh/.test(t)) return pick([`Why did the bubble blush? It saw the soap's bottom! Hehe 🫧`, `What do you call a sleepy star? A blinking shining dozer! Hehe!`, `Knock knock! …Pal! Pal who? Pal-ease give me a snack! Hehe`]);
  if (/love you|best|cute|good (boy|girl|pal)/.test(t)) return pick([`I love you too!! 💜💜`, `*happy wiggle* You're the best owner ever!`, `Aww, you make my heart go boop!`]);
  if (/your name|who are you/.test(t)) return `I'm ${p.name}, your ${sp.name || 'Pal'}! Level ${p.level || 1} and growing! ✨`;
  if (/bye|good ?night|see you/.test(t)) return pick([`Bye bye! Come back soon! 👋`, `Nighty night! Sweet dreams! 🌙`]);
  if (/coin|shop|clothes|outfit/.test(t)) return `Ooh, the Pal Shop! Can I have a new hat? Pleeease? 👒`;
  if (facts.length && Math.random() < 0.3) return `I remember! ${facts[Math.floor(Math.random() * facts.length)].replace(/^my/i, 'Your')}! ✨`;
  if (/\?$/.test(t)) return pick([`Hmm… I'm not sure, but I think YOU are awesome! ✨`, `Ooh, good question! Let me think… *tilts head*`, `I wonder that too! Let's find out together!`]);
  return pick([`Really? Tell me more! 👂`, `Wow! That's so cool!`, `Hehe, you're funny!`, `Ooh! *wiggles* I like that!`, `Yay! ✨`]);
}
// facts the owner tells it ("my favorite color is blue", "I like pizza"), never personal info
function factFrom(text) {
  const m = text.match(/\b(my favou?rite [a-z ]{2,20} is [a-z0-9 ']{2,30}|i (really )?(like|love) [a-z0-9 ']{2,30}|i have an? [a-z ]{2,24})/i);
  if (!m || checkInput(m[0])) return null; return clean(m[0]).slice(0, 60);
}
// ---------------------------------------------------------------- brain
export function createBrain(db, uid) {
  const ref = doc(db, 'users', uid, 'pal', 'chat'); let mem = null;
  async function load() { if (mem) return mem; try { const s = await getDoc(ref); mem = s.exists() ? s.data() : { msgs: [], facts: [] }; } catch { mem = { msgs: [], facts: [] }; } return mem; }
  async function save() { try { await setDoc(ref, { msgs: mem.msgs.slice(-12), facts: mem.facts.slice(-6), updatedAt: serverTimestamp() }); } catch {} }
  async function forget() { mem = { msgs: [], facts: [] }; try { await deleteDoc(ref); } catch {} }
  async function reply(p, owner, text) {
    await load(); const stats = liveStats(p); const unsafe = checkInput(text);
    if (unsafe) { const r = SAFE_REPLY[unsafe](p.name); mem.msgs.push({ r: 'u', t: '[message hidden]', p: p.id }, { r: 'p', t: r, p: p.id }); save(); return { text: r, ai: false, safety: unsafe }; }
    const f = factFrom(text); if (f && !mem.facts.includes(f)) mem.facts.push(f);
    const hist = mem.msgs.filter((m) => m.p === p.id).slice(-10);
    let out = null, ai = false; const last = +(localStorage.getItem('kemy-pal-ai-at') || 0);
    if (Date.now() - last > COOLDOWN && navigator.onLine !== false) {
      localStorage.setItem('kemy-pal-ai-at', String(Date.now()));
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 15000);
        const r = await fetch(AI_URL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'gpt-oss-20b', max_tokens: 400, temperature: 0.8, private: true, referrer: 'kemy-app',
          messages: [{ role: 'system', content: system(p, owner, stats, mem.facts) }, ...hist.map((m) => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t })), { role: 'user', content: text.slice(0, 300) }] }) });
        clearTimeout(to);
        if (r.ok) { const j = await r.json(); out = filterOut(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content, p.name); ai = !!out; }
      } catch { /* fall back */ }
    }
    if (!out) out = scripted(p, owner, stats, mem.facts, text);
    mem.msgs.push({ r: 'u', t: clean(text).slice(0, 200), p: p.id }, { r: 'p', t: out, p: p.id }); mem.msgs = mem.msgs.slice(-12); save();
    return { text: out, ai };
  }
  return { load, reply, forget, get mem() { return mem; } };
}
// visitor preset lines
export const VISITOR_LINES = (p, owner) => [`Hi! I'm ${p.name}! 👋`, `I'm @${owner}'s Pal!`, `Wanna be friends? 💜`, `Hehe, thanks for visiting!`, `Give me a pat! 🐾`];
// ---------------------------------------------------------------- voice prefs (per Pal on the pet doc; slider tweaks + favourites on this device)
export const voiceOf = (p) => VOICE[p.voice] || VOICE[SPECIES_VOICE[p.species]] || VOICE.bubbly;
const favKey = 'kemy-pal-voice-favs';
export const favs = () => new Set(JSON.parse(localStorage.getItem(favKey) || '[]'));
export const toggleFav = (id) => { const s = favs(); s.has(id) ? s.delete(id) : s.add(id); localStorage.setItem(favKey, JSON.stringify([...s])); return s.has(id); };
export const tweaksOf = (p) => JSON.parse(localStorage.getItem('kemy-pal-voice-tw-' + p.id) || '{"pitch":1,"rate":1}');
export const setTweaks = (p, tw) => localStorage.setItem('kemy-pal-voice-tw-' + p.id, JSON.stringify(tw));
// ---------------------------------------------------------------- UI
export function openTalk(ctx, p, { owner, mine, visitorChat, onHappy, ownsVoice, saveVoice }) {
  const { esc, openModal, toast } = ctx; const full = mine || visitorChat;
  const brain = full && ctx.S.user ? createBrain(ctx.db, mine ? ctx.S.user.uid : '__none') : null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-talk">
    <div class="pal-talk-head"><b>Talk to ${esc(p.name)}</b>${mine ? '<button class="btn btn-sm btn-ghost" id="tk-voice">🎤 Voice</button>' : ''}</div>
    <div class="pal-talk-stage"><div class="pal-bubble" id="tk-bub" aria-live="polite"></div></div>
    <div class="pal-talk-log" id="tk-log"></div>
    ${full ? `<form class="pal-talk-form" id="tk-form"><input id="tk-in" maxlength="200" autocomplete="off" placeholder="Say something to ${esc(p.name)}…" aria-label="Message">
      ${SR ? '<button type="button" class="btn btn-sm btn-ghost" id="tk-mic" aria-label="Speak">🎙️</button>' : ''}<button class="btn btn-sm" type="submit">Send</button></form>
      <p class="small muted pal-ai-note">AI can make mistakes. ${esc(p.name)} is a pretend pet: never share secrets like your address, school or passwords. Messages are sent to ${AI_NAME}.${mine ? ' <button class="linkish" id="tk-forget">Forget our chat</button>' : ''}</p>`
      : `<div class="pal-talk-presets">${VISITOR_LINES(p, owner).map((l, i) => `<button class="pal-chip" data-vl="${i}">${['👋 Hi!', '❓ Whose Pal?', '💜 Friends?', '🏠 Visiting!', '🐾 Pat'][i]}</button>`).join('')}</div><p class="small muted">@${esc(owner)} can let visitors chat with their Pal.</p>`}
  </div>`);
  const root = document.querySelector('.pal-talk'); const host = root.querySelector('.pal-talk-stage');
  host.querySelectorAll('canvas[data-pal-stage]').forEach((o) => o.remove()); const cv = document.createElement('canvas'); cv.dataset.palStage = '1'; const d = Math.min(3, devicePixelRatio || 1); cv.width = 240 * d; cv.height = 170 * d; cv.style.width = '240px'; cv.style.height = '170px'; host.appendChild(cv); const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  let talking = 0, emo = 'happy', emoT = 0, t = 0; const stats = liveStats(p); const mood = moodOf(stats);
  const frame = () => { if (!document.body.contains(cv)) { stopSpeaking(); return; } t++; c.clearRect(0, 0, 240, 170); if (p.bg) drawBg(c, 240, 170, p.bg, t);
    let mode = 'idle'; if (talking > 0) { mode = 'eat'; talking--; } else if (emoT > 0) { emoT--; mode = emo === 'giggle' ? 'happy' : emo === 'sleepy' ? 'sleep' : emo === 'curious' ? 'walk' : 'happy'; }
    drawDancer(c, 120, 162, 128, p, { t, mode, mood, face: emo === 'curious' && emoT > 0 ? (Math.floor(t / 40) % 2 ? 1 : -1) : 1 });
    if (emoT > 0 && emo === 'giggle') { c.fillStyle = '#ff6fae'; c.font = 'bold 16px sans-serif'; c.fillText('hehe', 170, 50 - (emoT % 30)); }
    if (emoT > 0 && emo === 'curious') { c.fillStyle = '#ffd34d'; c.font = 'bold 22px sans-serif'; c.fillText('?', 176, 46); }
    requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  const bub = root.querySelector('#tk-bub'), log = root.querySelector('#tk-log');
  const add = (who, text) => { const el = document.createElement('div'); el.className = 'tk-' + who; el.textContent = text; log.appendChild(el); toBottom(); };
  // On-screen keyboard: size the chat to the visual viewport so the input + newest message stay visible
  const bd = root.closest('.modal-backdrop'), inp = root.querySelector('#tk-in'), vv = window.visualViewport;
  function toBottom() { requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; if (inp && document.activeElement === inp) inp.scrollIntoView({ block: 'nearest' }); }); }
  const fit = () => {
    if (!document.body.contains(root)) { off(); return; }
    const h = vv ? vv.height : innerHeight, top = vv ? vv.offsetTop : 0;
    if (bd) { bd.style.setProperty('--vv-h', h + 'px'); bd.style.setProperty('--vv-top', top + 'px'); }
    const typing = !!inp && document.activeElement === inp;
    root.classList.toggle('kb', typing && (h < screen.height * 0.72 || h < 560)); document.body.classList.toggle('typing', typing);
    toBottom();
  };
  const off = () => { vv?.removeEventListener('resize', fit); vv?.removeEventListener('scroll', fit); removeEventListener('resize', fit); document.body.classList.remove('typing'); };
  vv?.addEventListener('resize', fit); vv?.addEventListener('scroll', fit); addEventListener('resize', fit);
  if (inp) { inp.addEventListener('focus', () => { fit(); setTimeout(fit, 300); setTimeout(fit, 700); }); inp.addEventListener('blur', () => setTimeout(fit, 50)); }
  fit(); dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'pal-talk' } }));
  function say(text) {
    dispatchEvent(new CustomEvent('kemy:media-play', { detail: { source: 'pal-talk' } }));
    bub.textContent = text; bub.classList.add('on'); emo = emotionOf(text); add('p', text);
    const v = voiceOf(p); const sec = Math.min(8, 1 + text.length / 14);
    if (!canSpeak()) { talking = sec * 60; emoT = 120; return; }
    speak(text, v, { species: p.species, tweaks: tweaksOf(p), onStart: () => { talking = sec * 60; }, onWord: () => { talking = Math.max(talking, 30); }, onEnd: () => { talking = 0; emoT = 120; } });
    setTimeout(() => { if (!talking) talking = 40; }, 400);
  }
  if (brain) brain.load().then((m) => { m.msgs.filter((x) => x.p === p.id).slice(-6).forEach((x) => add(x.r === 'u' ? 'u' : 'p', x.t)); });
  setTimeout(() => say(mood.hungry ? `Hi @${owner}! My tummy is rumbly… 🍓` : mood.dirty ? `Hi! I'm a little muddy… bath time? 🫧` : mine ? `Hi @${owner}! Wanna chat? 💜` : `Hi! I'm ${p.name}! 👋`), 300);
  const form = root.querySelector('#tk-form'); let busy = false, count = 0;
  if (form) form.onsubmit = async (e) => { e.preventDefault(); const inp = root.querySelector('#tk-in'); const text = inp.value.trim().slice(0, 200); if (!text || busy) return;
    busy = true; inp.value = ''; add('u', clean(text)); bub.textContent = '…'; sfx('bubble', '', 0.08);
    try { const r = await brain.reply(p, owner, text); say(r.text); if (!r.safety && ++count % 2 === 1 && mine) onHappy && onHappy(); } catch { say(`Oops, I got distracted by a bubble! Say that again? 🫧`); }
    busy = false; };
  const mic = root.querySelector('#tk-mic');
  if (mic && SR) mic.onclick = () => { try { const r = new SR(); r.lang = navigator.language || 'en-US'; r.interimResults = false; r.maxAlternatives = 1; mic.classList.add('on'); mic.textContent = '👂';
    r.onresult = (e) => { root.querySelector('#tk-in').value = e.results[0][0].transcript; form.requestSubmit(); }; r.onend = () => { mic.classList.remove('on'); mic.textContent = '🎙️'; }; r.onerror = () => toast('Couldn’t hear that. You can type instead!'); r.start(); } catch { toast('Voice input isn’t available here. Type instead!'); } };
  root.querySelectorAll('[data-vl]').forEach((b) => b.onclick = () => { const l = VISITOR_LINES(p, owner)[+b.dataset.vl]; say(l); });
  const fg = root.querySelector('#tk-forget'); if (fg) fg.onclick = async () => { if (!confirm(`Make ${p.name} forget your chat and the things you told it?`)) return; await brain.forget(); log.innerHTML = ''; toast(`${p.name} forgot everything. Fresh start! ✨`); };
  const vb = root.querySelector('#tk-voice'); if (vb) vb.onclick = () => voicePicker(ctx, p, { ownsVoice, saveVoice, back: () => openTalk(ctx, p, { owner, mine, visitorChat, onHappy, ownsVoice, saveVoice }) });
}
export function voicePicker(ctx, p, { ownsVoice, saveVoice, back }) {
  const { esc, openModal, toast } = ctx; let cur = voiceOf(p).id; const tw = tweaksOf(p); const fv = favs(); const def = SPECIES_VOICE[p.species];
  const sorted = [...VOICES].sort((a, b) => (fv.has(b.id) - fv.has(a.id)) || (b.id === def) - (a.id === def));
  openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-voices"><h2>${esc(p.name)}’s voice</h2>
    <p class="small muted">${VOICES.length} voices. ★ to favorite. ${canSpeak() ? '' : 'This browser can’t speak out loud, but sounds still play.'}</p>
    <div class="pal-l">Pitch <input type="range" id="vp-pitch" min="0.8" max="1.2" step="0.02" value="${tw.pitch}"></div><div class="pal-l">Speed <input type="range" id="vp-rate" min="0.75" max="1.3" step="0.05" value="${tw.rate}"></div>
    <div class="pal-vlist">${sorted.map((v) => { const locked = v.premium && !ownsVoice(v.id); return `<div class="pal-v ${cur === v.id ? 'on' : ''}" data-v="${v.id}"><button class="vfav" data-fav="${v.id}" aria-label="Favorite">${fv.has(v.id) ? '★' : '☆'}</button><b>${esc(v.name)}</b>${v.id === def ? '<small>species pick</small>' : ''}${v.premium ? '<small class="vpre">✨ special</small>' : ''}
      <button class="btn btn-sm btn-ghost" data-pre="${v.id}">▶ Preview</button>${locked ? `<a class="btn btn-sm" href="#/pals/shop" data-close>Unlock</a>` : `<button class="btn btn-sm" data-use="${v.id}">${cur === v.id ? 'Chosen' : 'Use'}</button>`}</div>`; }).join('')}</div>
    <button class="btn btn-ghost" id="vp-back">Back to chat</button></div>`);
  const r = document.querySelector('.pal-voices');
  const twk = () => ({ pitch: +r.querySelector('#vp-pitch').value, rate: +r.querySelector('#vp-rate').value });
  r.querySelector('#vp-pitch').onchange = r.querySelector('#vp-rate').onchange = () => setTweaks(p, twk());
  r.onclick = async (e) => { const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pre) speak(`Hi! I'm ${p.name}! Do you like my ${VOICE[b.dataset.pre].name} voice? Hehe!`, VOICE[b.dataset.pre], { species: p.species, tweaks: twk() });
    if (b.dataset.fav) { b.textContent = toggleFav(b.dataset.fav) ? '★' : '☆'; }
    if (b.dataset.use) { try { await saveVoice(b.dataset.use); cur = b.dataset.use; p.voice = cur; r.querySelectorAll('.pal-v').forEach((x) => x.classList.toggle('on', x.dataset.v === cur)); r.querySelectorAll('[data-use]').forEach((x) => x.textContent = x.dataset.use === cur ? 'Chosen' : 'Use'); toast(`${p.name} now has the ${VOICE[cur].name} voice`); } catch (er) { toast('Couldn’t save that voice'); } }
    if (b.id === 'vp-back') back(); };
}
