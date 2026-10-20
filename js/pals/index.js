import { openBuySheet, coinBadge } from '../buy-sheet.js';
import { sfx, SPECIES_SOUND } from './voice.js';
// Kemy Pals: original virtual pets that live next to your profile.
import { playIntro } from '../theme.js';
import { SPECIES, SPEC, VIBES, BODY_PRESETS, ACC_PRESETS, EYE_PRESETS, PATTERNS, ACCESSORIES, drawPal, drawEgg, drawSnack, drawBubble, star, heart, hueHex, stageOf, shade } from './art.js';
import { liveOverlay, popups } from './overlays.js';
import { createShopUI } from './shop.js';
import { createPalStore } from './store.js';
import { drawBg } from './bgs.js';
import { openTalk } from './talk.js';
import { doc as fdoc, getDoc as fget, setDoc as fset, serverTimestamp as fts } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { roomOf } from './economy.js';
import { DECOR } from './wear.js';
import { drawDancer } from './dance.js';
import { createDanceUI, initFloat, registerDanceItems } from './dance-ui.js';
import { ITEM } from './catalog.js';
import { createStore, liveStats, moodOf, patPal, readPet, firstPet, formName, isNight, xpToLevel, MAX_PALS, tsMs, listPals, getActivePal, playdate, newPlaydates } from './core.js';

const FAVS = { panda: 'bamboo', redpanda: 'bamboo', koala: 'leaf', lamb: 'leaf', giraffe: 'leaf', turtle: 'leaf', bunny: 'carrot', kitten: 'fish', penguin: 'fish', seal: 'fish', otter: 'fish', lion: 'fish', tiger: 'fish', bear: 'honey', hamster: 'seed', chick: 'seed', duckling: 'seed', owl: 'seed', elephant: 'apple', piglet: 'apple', dragon: 'apple', puppy: 'cookie', unicorn: 'cake', starsprite: 'cake', cloudpuff: 'cake' };
const FAV_FOOD = (sp) => FAVS[sp] || 'berry';
const FOOD_EMO = { bamboo: '🎋', leaf: '🍃', carrot: '🥕', fish: '🐟', honey: '🍯', seed: '🌻', apple: '🍎', cake: '🍰', berry: '🍓', cookie: '🍪' };
export const PALS_COPY = "Meet your Kemy Pal 🐾 Hatch your own cute companion from dozens of Pals like a baby elephant, puppy, panda, baby dragon and more, give it a name, colors and outfits, and watch it hang out next to your profile. Give it bubbly showers, feed it snacks, brush it, tuck it into bed and play catch, and watch it glow up as you level. Collect up to 6 Pals, and let your friends give yours a pat.";
export const PALS_SHORT = 'Pals: hatch, dress up and play with your own cute virtual pet.';
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ACC_LABEL = { none: 'None', bow: 'Bow', crown: 'Crown', shades: 'Star shades', scarf: 'Scarf', hat: 'Hat', badge: 'KL badge' };
const PAT_LABEL = { none: 'Plain', spots: 'Spots', stripes: 'Stripes', sparkle: 'Sparkle' };
// ---------------------------------------------------------------- tiny synth
let ac = null;
const TOYS = [['🧸', 'f_teddy'], ['🏀', 'f_bball'], ['🎈', 'f_balloon_red'], ['🪄', 'f_wand_gold'], ['🎸', 'bigguitar_red'], ['☎️', 'f_phone_purple']];
function snd(kind) {
  if (localStorage.getItem('kemy-pals-mute') === '1') return;
  try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const seq = { happy: [[880, 0.08], [1175, 0.1], [1568, 0.12]], pat: [[660, 0.08], [990, 0.12]], eat: [[300, 0.06], [260, 0.06], [300, 0.06]], bubble: [[700, 0.05]], pop: [[1200, 0.04]], splash: [[400, 0.1]], sparkle: [[1319, 0.07], [1760, 0.07], [2093, 0.1]], hatch: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]], glow: [[523, 0.1], [659, 0.1], [784, 0.1], [988, 0.1], [1319, 0.3]], snore: [[180, 0.3]], toss: [[500, 0.08]], catch: [[784, 0.08], [1047, 0.12]] }[kind] || [[600, 0.06]];
  let t = ac.currentTime;
  for (const [f, d] of seq) { const o = ac.createOscillator(); const g = ac.createGain(); o.type = kind === 'eat' || kind === 'snore' ? 'square' : 'triangle'; o.frequency.setValueAtTime(f, t); if (kind === 'bubble' || kind === 'pop') o.frequency.exponentialRampToValueAtTime(f * 1.8, t + d);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9; }
}
// ---------------------------------------------------------------- canvas helper
function stage(el, w, h) {
  const cv = document.createElement('canvas'); const dpr = Math.min(3, devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.style.touchAction = 'none';
  el.appendChild(cv); const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); return { cv, c, w, h };
}
function loop(fn) { let on = true, t = 0; const f = () => { if (!on) return; if (!document.body.contains(fn.el)) { on = false; return; } t++; fn(t); requestAnimationFrame(f); }; requestAnimationFrame(f); return () => (on = false); }
function particles() {
  const P = []; return { P, add(x, y, kind, n = 6) { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2; const v = 1 + Math.random() * 1.8; P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 50, kind }); } },
    draw(c) { for (const p of P) { p.x += p.vx; p.y += p.vy; p.vy += 0.04; p.life--; c.globalAlpha = Math.max(0, p.life / 50); if (p.kind === 'heart') { c.fillStyle = '#ff6fae'; heart(c, p.x, p.y, 5); c.fill(); } else if (p.kind === 'drop') { c.fillStyle = '#8fd0ff'; c.beginPath(); c.ellipse(p.x, p.y, 2, 3, 0, 0, 7); c.fill(); } else { c.fillStyle = '#ffd34d'; star(c, p.x, p.y, 4.5); c.fill(); c.strokeStyle = '#b26bff'; c.lineWidth = 0.8; c.stroke(); } } c.globalAlpha = 1; for (let i = P.length - 1; i >= 0; i--) if (P[i].life <= 0) P.splice(i, 1); } };
}
export function createPals(ctx) {
  const { S, db, esc, toast, openModal, closeModal, friendlyError, requireAuth } = ctx; const notify = ctx.notify || (() => {});
  if (!document.getElementById('pals-css')) { const l = document.createElement('link'); l.id = 'pals-css'; l.rel = 'stylesheet'; l.href = 'css/pals.css?v=3'; document.head.appendChild(l); }
  let mine = null; // { uid, list, store }
  const pop = popups({ S, db });
  const shop = createShopUI(ctx);
  const palStore = createPalStore({ ...ctx, econ: () => shop.econ(), myPals: (f) => myPals(f), activeOf: (m) => { const id = sessionStorage.getItem('kemy-store-pal'); return (id && m.list.find((x) => x.id === id)) || activeOf(m); }, commit: (p, patch) => commit(p, patch) });
  const dances = createDanceUI(ctx); registerDanceItems();
  const danceOpen = (p, tab) => { if (!S.user) return; dances.open(p, { tab, econOf: shop.econ }); };
  addEventListener('kemy:dance-shop', async () => { const m = await myPals(); const a = m && activeOf(m); if (a) danceOpen(a, 'shop'); else toast('Hatch a Pal first'); });
  const debug = () => localStorage.getItem('kemy-pals-debug') === '1';
  async function myPals(force) {
    if (!S.user || !S.profile) return null;
    if (!mine || mine.uid !== S.user.uid || force) { const store = createStore(db, S.user.uid); mine = { uid: S.user.uid, store, list: await store.list() }; }
    return mine;
  }
  const activeOf = (m) => m.list.find((p) => p.id === S.profile.activePet) || m.list[0] || null;
  function slots(m) {
    const lv = m.list.reduce((a, p) => a + (p.level || 1), 0);
    const streak = +(localStorage.getItem('kemy-pals-streak-' + m.uid) || 0);
    return Math.min(MAX_PALS, 1 + Math.floor((lv - m.list.length) / 4) + (streak >= 7 ? 1 : 0) + (streak >= 30 ? 1 : 0));
  }
  function trackStreak() {
    if (!S.user) return; const k = 'kemy-pals-day-' + S.user.uid, sk = 'kemy-pals-streak-' + S.user.uid; const today = new Date().toDateString();
    const last = localStorage.getItem(k); if (last === today) return;
    const yest = new Date(Date.now() - 864e5).toDateString(); localStorage.setItem(sk, String(last === yest ? +(localStorage.getItem(sk) || 0) + 1 : 1)); localStorage.setItem(k, today);
  }
  // save with level-up / glow-up detection
  async function commit(p, patch, host) {
    const before = stageOf(p.level || 1), lvBefore = p.level || 1;
    try { await mine.store.save(p, patch); } catch (e) { toast(friendlyError(e)); return; }
    if (host && patch.xpGain > 0 && patch.xpGain < 60) shop.earn('care', 5, 'for caring');
    if (stageOf(p.level) > before) glowUp(p); else if (p.level > lvBefore) toast(`${p.name} reached level ${p.level}!`);
    host && host();
  }
  function glowUp(p) {
    snd('glow');
    openModal(`<div class="pal-glow"><div class="pal-glow-stage"></div><h2>Glow up!</h2><p>${esc(p.name)} glowed up into <b>${esc(formName(p))}</b>!</p><button class="btn" data-close>Yay!</button></div>`);
    const host = document.querySelector('.pal-glow-stage'); const s = stage(host, 260, 200); const fx = particles(); const frm = { ...p, level: p.level < 12 ? 4 : 11 };
    const f = (t) => { const c = s.c; c.clearRect(0, 0, 260, 200); const flash = t < 70 ? t / 70 : Math.max(0, 1 - (t - 70) / 40);
      const show = t < 70 ? frm : p; drawPal(c, 130, 180, 130, show, { t, mode: t > 90 ? 'happy' : 'idle' });
      c.fillStyle = `rgba(255,255,255,${flash})`; c.fillRect(0, 0, 260, 200); if (t === 72) fx.add(130, 110, 'star', 24); fx.draw(c); };
    f.el = s.cv; loop(f);
  }
  // ---------------------------------------------------------------- Talk to your Pal
  async function talk(p, isMine, ownerName, ownerUid) {
    let visitorChat = false; if (!isMine) { try { const s = await fget(fdoc(db, 'users', ownerUid, 'pal', 'settings')); visitorChat = s.exists() && !!s.data().visitorChat; } catch {} if (visitorChat && !requireAuth()) return; }
    let inv = {}; if (isMine) { try { inv = await shop.econ().inventory(); } catch {} }
    const m = isMine ? await myPals() : null; const mp = m ? m.list.find((x) => x.id === p.id) || p : p;
    openTalk(ctx, mp, { owner: ownerName || (S.profile && S.profile.username) || 'friend', mine: isMine, visitorChat: !isMine && visitorChat,
      ownsVoice: (id) => !!inv[id], saveVoice: (id) => m.store.save(mp, { voice: id }),
      onHappy: () => { const st = liveStats(mp); st.happy = Math.min(100, st.happy + 2); commit(mp, { stats: st, xpGain: 2 }); shop.earn('chat', 2); } });
  }
  async function visitorSetting(el) {
    let on = false; try { const s = await fget(fdoc(db, 'users', S.user.uid, 'pal', 'settings')); on = s.exists() && !!s.data().visitorChat; } catch {}
    el.checked = on; el.onchange = async () => { try { await fset(fdoc(db, 'users', S.user.uid, 'pal', 'settings'), { visitorChat: el.checked, updatedAt: fts() }); toast(el.checked ? 'Visitors can chat with your Pal' : 'Visitors see friendly preset lines'); } catch (e) { toast(friendlyError(e)); } };
  }
  // ---------------------------------------------------------------- profile strip
  async function renderProfile(el, uid, u, isMine) {
    if (!el) return;
    const tok = String((+el.dataset.palTok || 0) + 1); el.dataset.palTok = tok; const stale = () => el.dataset.palTok !== tok || !document.body.contains(el);
    let list = [];
    try { list = await listPals(db, uid); } catch { list = []; }
    if (!list.length) { if (isMine) { el.innerHTML = `<button class="pal-hatch-cta" id="pal-cta"><span class="pal-egg-ic"></span><span><b>Hatch your Kemy Pal</b><small>${esc(PALS_SHORT.replace('Pals: ', ''))}</small></span></button>`; el.querySelector('#pal-cta').onclick = () => intro(true); miniEgg(el.querySelector('.pal-egg-ic')); } else el.innerHTML = ''; return; }
    if (stale()) return;
    if (isMine) { const m = await myPals(); if (m) list = m.list.slice(); }
    if (stale() || !list.length) return;
    const act = list.find((p) => p.id === u.activePet) || list[0];
    if (isMine) { applyPatBoost(act); applyPlaydates(act); sessionStorage.removeItem('kemy-store-pal'); }
    const shown = [act]; // only the active Pal; the others live in the Pal Box (a playdate guest is added separately)
    const sp = SPEC[act.species] || SPECIES[0];
    el.innerHTML = `<div class="pal-strip" data-pals="1" aria-label="${esc(u.displayName)}'s Pals"><div class="pal-cv"></div>
      <div class="pal-tag"><b>${esc(act.name)}</b><small>${esc(formName(act))} · Lv ${act.level || 1} · <span class="pal-vibe" style="--v:${VIBES[sp.vibe].c}">${VIBES[sp.vibe].name}</span></small><small class="pal-pats">🐾 <b>${act.pats || 0}</b> pats</small></div>
      <div class="pal-btns">${isMine ? '<button class="btn btn-sm" data-pa="care">Care</button><button class="btn btn-sm btn-ghost" data-pa="talk">💬 Talk</button><button class="btn btn-sm btn-ghost" data-pa="dance">💃 Dance</button><a class="btn btn-sm btn-ghost" href="#/pals/store" data-nostore>👗 Store</a><a class="btn btn-sm btn-ghost" href="#/pals">Pal Box</a>' : '<button class="btn btn-sm btn-ghost" data-pa="pat">Pat</button><button class="btn btn-sm btn-ghost" data-pa="talk">💬 Say hi</button><button class="btn btn-sm btn-ghost" data-pa="bring">Bring my Pal</button>'}</div></div>`;
    const host = el.querySelector('.pal-cv'); const W = Math.max(160, Math.min(host.clientWidth || 300, 560)), H = 150; const s = stage(host, W, H);
    const fx = particles();
    const actors = shown.map((p, i) => ({ p, x: W * (0.5 - i * 0.22) + (i ? 0 : 10), tx: 0, face: i % 2 ? 1 : -1, mode: 'idle', until: i * 60, react: 0, mood: moodOf(liveStats(p)), size: i ? 52 : 66 }));
    let guest = null, play = null, curT = 0, room = []; roomOf(db, uid).then((r) => { room = r.filter((id) => ITEM[id]); });
    const f = (t) => { curT = t;
      const c = s.c; c.clearRect(0, 0, W, H); const night = isNight(); const h = new Date().getHours(); if (act && act.bg) drawBg(c, W, H, act.bg, t);
      c.fillStyle = night ? 'rgba(40,30,110,.35)' : h < 10 ? 'rgba(255,210,150,.18)' : h > 17 ? 'rgba(255,150,190,.16)' : 'rgba(170,140,255,.10)'; c.beginPath(); c.roundRect(0, 0, W, H, 18); c.fill();
      c.fillStyle = 'rgba(120,220,160,.35)'; c.beginPath(); c.ellipse(W / 2, H - 6, W * 0.48, 7, 0, 0, 7); c.fill();
      room.forEach((id, i) => { const it = ITEM[id]; const x = [22, W - 26, W * 0.72][i]; c.save(); c.lineWidth = 0.9; try { DECOR[it.st](c, it.col, x, H - 9, 1.5); } catch {} c.restore(); });
      if (night) { c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(W - 22, 18, 7, 0, 7); c.fill(); c.fillStyle = 'rgba(40,30,110,1)'; c.beginPath(); c.arc(W - 19, 16, 6, 0, 7); c.fill(); }
      const all = guest ? [...actors, guest] : actors;
      for (const A of all) {
        if (play && (A === actors[0] || A === guest)) continue;
        if (A.react > 0) { A.react--; A.mode = 'react'; continue; }
        if (A.goTo != null) { const d = A.goTo - A.x; A.face = Math.sign(d) || A.face; A.x += Math.sign(d) * Math.min(Math.abs(d), 1.1); A.mode = 'walk'; if (Math.abs(d) < 1) { A.goTo = null; A.arrived && A.arrived(); } continue; }
        if (night || A.mood.tired) { A.mode = 'sleep'; continue; }
        if (RM()) { A.mode = 'idle'; continue; }
        if (t > A.until) { const r = Math.random(); if (r < 0.45) { A.tx = 30 + Math.random() * (W - 60); A.mode = 'walk'; A.until = t + 600; } else if (r < 0.6 && !A.mood.sad) { A.mode = 'hop'; A.until = t + 70; } else { A.mode = 'idle'; A.until = t + 120 + Math.random() * 160; } }
        if (A.mode === 'walk') { const d = A.tx - A.x; A.face = Math.sign(d) || A.face; A.x += Math.sign(d) * Math.min(Math.abs(d), A.mood.tired ? 0.35 : 0.7); if (Math.abs(d) < 1) { A.mode = 'idle'; A.until = t + 100; } }
      }
      if (play) stepPlay(t, c);
      for (const A of [...all].sort((a, b) => a.size - b.size)) drawDancer(c, A.x, H - 8, A.size, A.guest ? { ...A.p, _others: 1, _off: 0.5 } : (isMine ? A.p : { ...A.p, _others: 1 }), { t, face: A.face, mode: A.mode, mood: { ...A.mood, sad: A.mood.sad && A.mode !== 'react' } });
      if (guest) { c.fillStyle = 'rgba(255,255,255,.85)'; c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(guest.p.name, guest.x, H - 8 - guest.size - 4); c.textAlign = 'left'; }
      fx.draw(c);
    };
    // the two Pals' play-date animations
    const PLAYS = ['high-five', 'chase', 'snack', 'bubbles', 'dance'];
    function stepPlay(t, c) {
      const a = actors[0], g = guest, k = t - play.t0, mid = (a.x + g.x) / 2;
      if (play.kind === 'high-five') { a.mode = g.mode = 'hop'; a.face = Math.sign(g.x - a.x); g.face = -a.face; if (k % 36 === 18) { fx.add(mid, 40, 'star', 6); snd('pat'); } }
      if (play.kind === 'chase') { const ph = Math.sin(k * 0.03); g.x = play.cx + ph * 70; a.x = play.cx + Math.sin(k * 0.03 - 0.6) * 70; a.mode = g.mode = 'walk'; a.face = Math.sign(Math.cos(k * 0.03 - 0.6)) || 1; g.face = Math.sign(Math.cos(k * 0.03)) || 1; }
      if (play.kind === 'snack') { a.mode = g.mode = 'eat'; drawSnack(c, mid, H - 22, 7, 0); if (k % 30 === 0) snd('eat'); }
      if (play.kind === 'bubbles') { a.mode = g.mode = 'react'; if (k % 8 === 0) play.b.push({ x: mid + (Math.random() - 0.5) * 40, y: H - 20, r: 3 + Math.random() * 4 }); for (const b of play.b) { b.y -= 0.8; drawBubble(c, b.x, b.y, b.r); } play.b = play.b.filter((b) => b.y > 0); }
      if (play.kind === 'dance') { a.mode = g.mode = 'happy'; if (k % 40 === 0) fx.add(mid, 30, 'heart', 3); }
      if (k > 240) { play = null; a.mode = g.mode = 'idle'; a.until = g.until = t + 120; finishPlay(); }
    }
    f.el = s.cv; loop(f);
    const hit = (x) => { const all = guest ? [...actors, guest] : actors; return all.find((A) => Math.abs(x - A.x) < A.size * 0.45); };
    let longT = null;
    s.cv.addEventListener('pointerdown', (e) => { if (isMine) longT = setTimeout(() => { longT = null; const r = s.cv.getBoundingClientRect(); const A = hit(e.clientX - r.left); if (A && A !== guest) openSheet(A.p); }, 550); });
    s.cv.addEventListener('pointerup', (e) => { if (isMine && !longT) return; clearTimeout(longT); longT = null;
      const r = s.cv.getBoundingClientRect(); const A = hit((e.clientX - r.left) * W / r.width); if (!A) return;
      A.react = 90; fx.add(A.x, 30, 'heart', 6); fx.add(A.x, 30, 'star', 5); snd('happy'); if (!isMine && A !== guest) doPat(A.p); });
    el.querySelectorAll('[data-pa]').forEach((b) => b.onclick = () => { const k = b.dataset.pa; if (k === 'care') openSheet(act); if (k === 'talk') talk(act, isMine, u.username, uid); if (k === 'dance') danceOpen(act); if (k === 'pat') { actors[0].react = 90; fx.add(actors[0].x, 30, 'star', 10); snd('pat'); doPat(act); } if (k === 'bring') bring(b); });
    async function doPat(p) {
      if (!S.user || !S.profile) { toast('Sign in to pat Pals'); return; }
      try { const ok = await patPal(db, uid, p.id, S.user.uid); if (ok) { p.pats = (p.pats || 0) + 1; if (p === act) el.querySelector('.pal-pats b').textContent = p.pats; toast(`You patted ${p.name}! 🐾`); notify(uid, 'pal_pat', { text: `@${S.profile.username} patted ${p.name}` }); } else toast(`${p.name} already got your pat today. Come back tomorrow!`); }
      catch (e) { toast(friendlyError(e)); }
    }
    async function bring(btn) {
      if (!S.user || !S.profile) { requireAuth(); return; } if (guest) return;
      const m = await myPals(); const mp = m && activeOf(m); if (!mp) { toast('Hatch a Pal first, then bring it to play!'); intro(true); return; }
      btn.disabled = true; guest = { p: mp, x: -20, face: 1, mode: 'walk', until: 1e9, react: 0, mood: moodOf(liveStats(mp)), size: 58, guest: true };
      const a = actors[0]; a.goTo = null; const side = a.x > W / 2 ? -1 : 1; guest.goTo = a.x + side * 38 - (side < 0 ? 0 : 0);
      guest.arrived = () => { play = { kind: PLAYS[Math.floor(Math.random() * PLAYS.length)], t0: curT, cx: a.x, b: [] }; toast(`${mp.name} and ${act.name}: ${play.kind.replace('-', ' ')}!`); };
    }
    async function finishPlay() {
      const mp = guest.p;
      try { const ok = await playdate(db, uid, act.id, S.user.uid, mp.id);
        if (ok) { const st = liveStats(mp); st.happy = Math.min(100, st.happy + 8); await commit(mp, { stats: st, xpGain: 15 }); notify(uid, 'pal_play', { text: `@${S.profile.username}'s ${mp.name} played with ${act.name}` }); toast(`Play date! ${mp.name} and ${act.name} both feel happier 💖`); }
        else toast(`${mp.name} and ${act.name} already had a play date today. They still had fun!`);
      } catch (e) { toast(friendlyError(e)); }
    }
  }
  async function applyPlaydates(p) {
    try { const k = `kemy-pals-play-${p.id}-${S.user.uid}`; const since = +(localStorage.getItem(k) || 0); const n = await newPlaydates(db, S.user.uid, p.id, since); localStorage.setItem(k, String(Date.now()));
      if (n > 0 && since) { const st = liveStats(p); st.happy = Math.min(100, st.happy + 5 * Math.min(n, 4)); commit(p, { stats: st, xpGain: Math.min(60, 10 * n) }); toast(`${p.name} had ${n} play date${n > 1 ? 's' : ''} with friends' Pals!`); } } catch {}
  }
  function applyPatBoost(p) {
    const k = `kemy-pals-pats-${p.id}-${S.user.uid}`; const seen = +(localStorage.getItem(k) || 0); const n = (p.pats || 0) - seen;
    if (n > 0) { localStorage.setItem(k, String(p.pats)); if (seen > 0 || p.pats > 0) { const st = liveStats(p); st.happy = Math.min(100, st.happy + 4 * Math.min(n, 5)); commit(p, { stats: st }); toast(`${p.name} got ${n} new pat${n > 1 ? 's' : ''} from friends! 🐾`); } }
  }
  function miniEgg(el) { if (!el) return; const s = stage(el, 40, 40); const f = (t) => { s.c.clearRect(0, 0, 40, 40); drawEgg(s.c, 20, 38, 34, RM() ? 0 : t); }; f.el = s.cv; loop(f); }
  // ---------------------------------------------------------------- care sheet
  async function openSheet(p0) {
    if (!requireAuth()) return; const m = await myPals(); const p = m.list.find((x) => x.id === p0.id) || p0;
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-sheet">
      <div class="pal-head"><b>${esc(p.name)}</b><small>${esc(formName(p))} · Lv <span data-lv>${p.level}</span></small><div class="pal-xp"><i style="width:${(p.xp % 100)}%"></i></div></div>
      <div class="pal-scene" style="position:relative"><button class="ps-bgbtn" data-store="bg" type="button" aria-label="Change background">🖼️</button><button class="ps-bgbtn ps-rot" data-store="outfits" type="button" aria-label="Dress up">👗</button></div><div class="pal-meters"></div><p class="pal-hint" aria-live="polite">Tap ${esc(p.name)} to play. Pick something to do below.</p>
      <div class="pal-acts">
        <button data-m="shower">🛁<span>Shower</span></button><button data-m="feed">🍓<span>Feed</span></button><button data-m="brush">🪮<span>Brush</span></button>
        <button data-m="catch">⚾<span>Catch</span></button><button data-m="bed">🌙<span>Bed</span></button><button data-m="bandage">🩹<span>Bandage</span></button><button data-m="toys">🧸<span>Toys</span></button>
      </div>
      <p class="small" style="text-align:center"><a href="#/pals/shop" data-close>🛒 Food & treat shop (Star Coins)</a></p>
      <details class="pal-about"><summary>About Pals</summary><p>${esc(PALS_COPY)}</p><p class="small">${esc(SPEC[p.species].blurb)} Vibe: ${VIBES[SPEC[p.species].vibe].name}.</p></details>
      ${debug() ? '<button class="btn btn-sm btn-ghost" data-dbg>Test: +60 XP</button>' : ''}</div>`);
    const root = document.querySelector('.pal-sheet'); root.querySelectorAll('[data-store]').forEach((b) => b.onclick = (ev) => { ev.stopPropagation(); sessionStorage.setItem('kemy-store-pal', p.id); closeModal(); location.hash = b.dataset.store === 'bg' ? '#/pals/store-bg' : '#/pals/store'; }); const W = Math.min(320, root.clientWidth || 320), H = 250; const s = stage(root.querySelector('.pal-scene'), W, H);
    const fx = particles(); const PX = W / 2, PY = H - 30, SIZE = 140;
    const st = liveStats(p); let mood = moodOf(st);
    const G = { mode: 'home', t: 0, react: 0, bubbles: [], drops: [], lather: 0, rinse: false, shake: 0, ptr: null, drag: null, brush: 0, ball: null, throws: 0, catches: 0, palX: PX, sleepT: 0, eat: 0, bandage: false, last: null };
    const hint = (h) => { root.querySelector('.pal-hint').textContent = h; };
    function meters() { const L = { happy: ['💖', 'Happy'], hunger: ['🍓', 'Food'], energy: ['⚡', 'Energy'], clean: ['🫧', 'Clean'] };
      root.querySelector('.pal-meters').innerHTML = Object.keys(L).map((k) => `<div class="pal-m ${st[k] < 30 ? 'low' : ''}" title="${L[k][1]} ${st[k]}%"><span>${L[k][0]}</span><i><b style="width:${st[k]}%"></b></i><small>${L[k][1]}</small></div>`).join('');
      root.querySelector('[data-lv]').textContent = p.level; root.querySelector('.pal-xp i').style.width = (p.xp % 100) + '%';
      root.querySelector('[data-m=bandage]').classList.toggle('glow', mood.low); }
    meters();
    const cute = () => { try { if (localStorage.getItem('kemy-pals-mute') !== '1') sfx(SPECIES_SOUND[p.species] || 'chirp'); } catch { /* */ } };
    const finish = (delta, xp, msg) => { cute(); G.react = 70; for (const k in delta) st[k] = Math.max(5, Math.min(100, st[k] + delta[k])); mood = moodOf(st); meters(); hint(msg); G.mode = 'home'; commit(p, { stats: { ...st }, xpGain: xp }, meters); };
    const near = (x, y, r = 50) => Math.hypot(x - G.palX, y - (PY - SIZE * 0.35)) < r;
    const mouth = () => ({ x: G.palX + 4, y: PY - SIZE * 0.3 });
    root.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => {
      const md = b.dataset.m; G.mode = md; G.palX = PX;
      if (md === 'shower') { G.bubbles = []; G.lather = 0; G.rinse = false; hint('Rub ' + p.name + ' to lather up bubbles!'); }
      if (md === 'feed') { hint(`Drag a snack to ${p.name}'s mouth. The gold one is ${p.name}'s favourite ${FOOD_EMO[FAV_FOOD(p.species)]}`); }
      if (md === 'brush') { G.brush = 0; hint('Brush ' + p.name + ' by rubbing back and forth.'); }
      if (md === 'catch') { G.throws = 0; G.catches = 0; G.ball = { x: 30, y: H - 30, vx: 0, vy: 0, fly: false }; hint('Flick the ball up into the air!'); }
      if (md === 'toys') { G.toy = null; hint('Pick a toy for ' + p.name + ' to play with!'); }
      if (md === 'bed') { G.sleepT = 0; G.dim = 0; snd('snore'); hint('Lights off… sweet dreams, ' + p.name + '. Tap to wake up.'); }
      if (md === 'bandage') { if (!mood.low) { hint(p.name + ' is feeling great! No bandage needed.'); G.mode = 'home'; return; } G.drag = null; hint('Drag the bandage onto ' + p.name + '.'); }
    });
    const dbg = root.querySelector('[data-dbg]'); if (dbg) dbg.onclick = () => commit(p, { stats: { ...st }, xpGain: 60 }, meters);
    const pos = (e) => { const r = s.cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; };
    s.cv.addEventListener('pointerdown', (e) => { const q = pos(e); G.ptr = q; G.last = { ...q, t: performance.now() }; s.cv.setPointerCapture(e.pointerId);
      if (G.mode === 'toys' && !G.toy) { TOYS.forEach((ty, i) => { if (Math.hypot(q.x - (40 + i * 44), q.y - 26) < 20) { G.toy = { id: ty[1], t: 0 }; snd('pop'); cute(); } }); }
      if (G.mode === 'home' && near(q.x, q.y, 60)) { G.react = 90; cute(); fx.add(G.palX, PY - SIZE * 0.6, 'heart', 6); fx.add(G.palX, PY - SIZE * 0.6, 'star', 4); snd('happy'); }
      if (G.mode === 'feed') { for (let i = 0; i < 4; i++) if (Math.hypot(q.x - (40 + i * 30), q.y - 26) < 16) G.drag = { kind: i, x: q.x, y: q.y }; }
      if (G.mode === 'bandage' && Math.hypot(q.x - 34, q.y - 30) < 22) G.drag = { kind: 'b', x: q.x, y: q.y };
      if (G.mode === 'bed') { finish({ energy: Math.min(40, 8 + G.sleepT / 6), happy: 4 }, 8, p.name + ' feels rested!'); }
      if (G.mode === 'shower' && G.rinse === 'done') {}
    });
    s.cv.addEventListener('pointermove', (e) => { if (!G.ptr) return; const q = pos(e); const dx = q.x - G.ptr.x, dy = q.y - G.ptr.y; const dist = Math.hypot(dx, dy);
      if (G.mode === 'shower' && !G.rinse && near(q.x, q.y, 62) && dist > 2) { if (G.bubbles.length < 46 && Math.random() < 0.6) { G.bubbles.push({ x: q.x + (Math.random() - 0.5) * 14, y: q.y + (Math.random() - 0.5) * 14, r: 4 + Math.random() * 6 }); if (Math.random() < 0.3) snd('bubble'); } G.lather = Math.min(1, G.bubbles.length / 40); if (G.lather >= 1) { G.rinse = true; hint('Squeaky! Now move the shower head to rinse.'); } }
      if (G.mode === 'brush' && near(q.x, q.y, 62)) { G.brush += dist; if (Math.random() < 0.15) fx.add(q.x, q.y, 'star', 1); if (G.brush > 700) { snd('sparkle'); fx.add(G.palX, PY - 60, 'star', 12); finish({ clean: 15, happy: 10 }, 10, p.name + ' looks so fluffy and shiny!'); } }
      if (G.drag) { G.drag.x = q.x; G.drag.y = q.y; }
      G.last = { ...G.ptr, t: G.last ? G.last.t : 0 }; G.ptr = q; G.vel = { x: dx, y: dy }; });
    s.cv.addEventListener('pointerup', () => {
      if (G.mode === 'feed' && G.drag) { const mo = mouth(); if (Math.hypot(G.drag.x - mo.x, G.drag.y - mo.y) < 34) { const fav = G.drag.kind === 3; G.eatFood = fav ? FAV_FOOD(p.species) : ['berry', 'cookie', 'cake'][G.drag.kind] || 'berry'; G.eat = 90; snd('eat'); fx.add(mo.x, mo.y - 10, 'heart', fav ? 10 : 4); const full = st.hunger > 90; finish({ hunger: full ? 2 : fav ? 30 : 22, happy: fav ? 12 : 4 }, fav ? 12 : 8, fav ? `Yum yum! ${FOOD_EMO[G.eatFood]} is ${p.name}'s favourite food!` : full ? p.name + ' is full, but loved the treat!' : 'Yum! ' + p.name + ' loved that snack.'); G.mode = 'feed'; } G.drag = null; }
      if (G.mode === 'bandage' && G.drag) { if (near(G.drag.x, G.drag.y, 50)) { G.bandage = true; snd('sparkle'); fx.add(G.palX, PY - 70, 'heart', 8); finish({ happy: 20, energy: 10 }, 8, 'All better! ' + p.name + ' feels much braver.'); } G.drag = null; }
      if (G.mode === 'catch' && G.ball && !G.ball.fly && G.vel && Math.hypot(G.ptr.x - G.ball.x, G.ptr.y - G.ball.y) < 60) {
        const v = G.vel; if (v.y < -1) { G.ball.fly = true; G.ball.vx = Math.max(-6, Math.min(6, v.x * 0.5 + 2.5)); G.ball.vy = Math.max(-9, v.y * 0.6 - 3); G.throws++; snd('toss'); } }
      G.ptr = null; G.vel = null; });
    const f = (t) => {
      G.t = t; const c = s.c; c.clearRect(0, 0, W, H);
      // room
      G.dim = G.mode === 'bed' ? Math.min(1, (G.dim || 0) + 0.012) : Math.max(0, (G.dim || 0) - 0.04);
      if (p.bg && drawBg(c, W, H, p.bg, t)) { /* dimmed below */ } else {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, G.mode === 'bed' ? '#1a1240' : '#f6e8ff'); g.addColorStop(1, G.mode === 'bed' ? '#2a1a5a' : '#dcc8ff'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = G.mode === 'shower' ? '#bfe6ff' : G.mode === 'bed' ? '#3a2a6a' : '#c7f0d4'; c.fillRect(0, H - 34, W, 34); }
      if (G.mode === 'shower') { c.fillStyle = '#fff'; c.strokeStyle = '#9fb8ff'; c.lineWidth = 2; c.beginPath(); c.roundRect(PX - 85, H - 46, 170, 34, 14); c.fill(); c.stroke(); }
      let mode = G.react > 0 ? 'react' : 'idle'; if (G.react > 0) G.react--;
      if (G.eat > 0) { G.eat--; mode = 'eat'; }
      if (G.dim > 0) { c.fillStyle = `rgba(10,6,40,${0.62 * G.dim})`; c.fillRect(0, 0, W, H); if (G.mode === 'bed') { for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(255,240,180,${G.dim * (0.4 + 0.4 * Math.sin(t * 0.05 + i))})`; c.beginPath(); c.arc((i * 71) % W, 12 + (i * 37) % 70, 1.6, 0, 7); c.fill(); } const lg = c.createRadialGradient(W - 30, 30, 2, W - 30, 30, 26); lg.addColorStop(0, `rgba(255,236,170,${G.dim})`); lg.addColorStop(1, 'rgba(255,236,170,0)'); c.fillStyle = lg; c.fillRect(W - 60, 0, 60, 60); } }
      if (G.mode === 'toys') { if (!G.toy) TOYS.forEach((ty, i) => { const x = 40 + i * 44; c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x, 26, 19, 0, 7); c.fill(); c.font = '22px serif'; c.textAlign = 'center'; c.fillText(ty[0], x, 34); });
        else { G.toy.t++; if (G.toy.t % 50 === 1) { fx.add(G.palX, PY - SIZE * 0.7, G.toy.t % 100 === 1 ? 'heart' : 'star', 3); snd('happy'); } if (G.toy.t > 220) { G.toy = null; finish({ happy: 12, energy: -4 }, 10, p.name + ' loved playing!'); } } }
      if (G.mode === 'bed') { mode = 'sleep'; G.sleepT++; if (G.sleepT > 300) finish({ energy: 40, happy: 5 }, 8, p.name + ' had a cozy nap!'); }
      if (G.shake > 0) { G.shake--; mode = 'shake'; if (G.shake % 6 === 0) fx.add(G.palX + (Math.random() - 0.5) * 60, PY - 60, 'drop', 3); if (G.shake === 1) { snd('sparkle'); fx.add(G.palX, PY - 80, 'star', 14); finish({ clean: 100, happy: 8 }, 15, p.name + ' is squeaky clean and sparkly!'); } }
      // catch game: Pal runs to the ball
      if (G.mode === 'catch' && G.ball) { const b = G.ball;
        if (b.fly) { b.x += b.vx; b.y += b.vy; b.vy += 0.25; if (b.x < 8 || b.x > W - 8) b.vx *= -0.7; b.x = Math.max(8, Math.min(W - 8, b.x));
          const d = b.x - G.palX; G.palX += Math.sign(d) * Math.min(Math.abs(d), 3.2); mode = Math.abs(d) > 4 ? 'walk' : 'hop';
          if (b.vy > 0 && b.y > PY - SIZE * 0.55 && Math.abs(b.x - G.palX) < 26) { b.fly = false; G.catches++; snd('catch'); fx.add(G.palX, PY - 90, 'star', 6); b.x = 30; b.y = H - 30; hint(`Caught it! ${G.catches}/${G.throws}`); }
          else if (b.y > H - 20) { b.fly = false; b.x = 30; b.y = H - 30; hint(`Missed! ${G.catches}/${G.throws}`); } }
        if (G.throws >= 5 && !b.fly) { G.ball = null; finish({ happy: 10 + G.catches * 2, energy: -8, hunger: -4 }, 12, `${p.name} caught ${G.catches} of 5! What a game.`); }
      }
      const faceTo = G.mode === 'catch' && G.ball ? Math.sign(G.ball.x - G.palX) || 1 : 1;
      const playing = G.mode === 'toys' && G.toy;
      drawPal(c, G.palX, PY, SIZE, G.eat > 0 && G.eatFood ? { ...p, outfit: { ...(p.outfit || {}), held: 'f_food_' + G.eatFood } } : playing ? { ...p, outfit: { ...(p.outfit || {}), held: G.toy.id } } : p, playing ? { t, mode: 'idle', dance3d: 'happyshimmy', beat: t / 20, amt: 0.8, dance: 'happyshimmy' } : { t, mode: mode === 'idle' && G.mode === 'catch' ? 'idle' : mode, face: faceTo, mood: { dirty: mood.dirty && !(G.mode === 'shower' && G.lather > 0.3), sad: mood.sad && G.react <= 0, bandage: G.bandage || mood.low && G.mode === 'home' && false } });
      // shower layer
      if (G.mode === 'shower') {
        for (const bb of G.bubbles) drawBubble(c, bb.x + Math.sin(t * 0.05 + bb.r) * 0.6, bb.y, bb.r);
        if (G.rinse === true) { const hx = G.ptr ? G.ptr.x : PX + Math.sin(t * 0.03) * 60, hy = 26;
          c.fillStyle = '#c0c8e0'; c.strokeStyle = '#6a6a90'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(hx - 18, hy - 8, 36, 12, 6); c.fill(); c.stroke(); c.fillRect(hx - 3, 0, 6, hy - 8);
          if (t % 2 === 0) for (let i = 0; i < 3; i++) G.drops.push({ x: hx - 14 + Math.random() * 28, y: hy + 4, vy: 3 + Math.random() * 2 });
          if (t % 20 === 0) snd('splash');
          if (SPEC[p.species] && SPEC[p.species].react === 'spray' && t % 3 === 0) G.drops.push({ x: G.palX + 14 + Math.random() * 10, y: PY - SIZE * 0.42, vy: 2 + Math.random() * 2, vx: 1.5 + Math.random() * 1.5 });
        }
        for (const d of G.drops) { d.y += d.vy; d.x += d.vx || 0; c.fillStyle = '#6fb8ff'; c.beginPath(); c.ellipse(d.x, d.y, 1.4, 3, 0, 0, 7); c.fill();
          for (let i = G.bubbles.length - 1; i >= 0; i--) { const bb = G.bubbles[i]; if (Math.hypot(d.x - bb.x, d.y - bb.y) < bb.r + 2) { G.bubbles.splice(i, 1); d.y = H + 10; if (Math.random() < 0.4) snd('pop'); } } }
        G.drops = G.drops.filter((d) => d.y < H - 30);
        if (G.rinse === true && G.bubbles.length === 0) { G.rinse = 'done'; G.drops = []; G.shake = 80; hint(p.name + ' shakes dry!'); }
        if (!G.rinse) { c.fillStyle = 'rgba(80,50,140,.6)'; c.font = 'bold 12px Inter, sans-serif'; c.fillText(`Lather ${Math.round(G.lather * 100)}%`, 10, 18); }
      }
      if (G.mode === 'feed') { for (let i = 0; i < 4; i++) { const fx0 = 40 + i * 30; c.fillStyle = i === 3 ? 'rgba(255,215,90,.9)' : 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(fx0, 26, 14, 0, 7); c.fill(); if (!G.drag || G.drag.kind !== i) { if (i === 3) { c.font = '17px sans-serif'; c.textAlign = 'center'; c.fillText(FOOD_EMO[FAV_FOOD(p.species)], fx0, 32); c.font = '700 8px sans-serif'; c.fillStyle = '#7a4a00'; c.fillText('FAV', fx0, 48); } else drawSnack(c, fx0, 26, 9, i); } }
        if (G.drag) { if (G.drag.kind === 3) { c.font = '22px sans-serif'; c.textAlign = 'center'; c.fillText(FOOD_EMO[FAV_FOOD(p.species)], G.drag.x, G.drag.y + 8); } else drawSnack(c, G.drag.x, G.drag.y, 11, G.drag.kind); } }
      if (G.mode === 'brush' && G.ptr) { c.save(); c.translate(G.ptr.x, G.ptr.y); c.rotate(-0.6); c.fillStyle = '#b47cf0'; c.beginPath(); c.roundRect(-4, 0, 8, 26, 4); c.fill(); c.fillStyle = '#fff3fc'; c.beginPath(); c.roundRect(-9, -8, 18, 9, 3); c.fill(); c.strokeStyle = '#8a55dc'; for (let i = -7; i <= 7; i += 3.5) { c.beginPath(); c.moveTo(i, -8); c.lineTo(i, -13); c.stroke(); } c.restore(); }
      if (G.mode === 'brush') { c.fillStyle = '#8a55dc'; c.fillRect(10, 10, 80 * Math.min(1, G.brush / 700), 6); c.strokeStyle = '#8a55dc'; c.strokeRect(10, 10, 80, 6); }
      if (G.mode === 'bandage') { const bx = G.drag ? G.drag.x : 34, by = G.drag ? G.drag.y : 30; c.save(); c.translate(bx, by); c.rotate(-0.4); c.fillStyle = '#ffe1c4'; c.strokeStyle = '#c99b74'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(-18, -6, 36, 12, 6); c.fill(); c.stroke(); c.fillStyle = '#ffd0d8'; c.fillRect(-6, -4, 12, 8); c.restore(); }
      if (G.mode === 'catch' && G.ball) { c.fillStyle = '#ff7ab8'; c.strokeStyle = '#8a2a5a'; c.lineWidth = 1.5; c.beginPath(); c.arc(G.ball.x, G.ball.y, 8, 0, 7); c.fill(); c.stroke(); c.strokeStyle = '#fff'; c.beginPath(); c.arc(G.ball.x, G.ball.y, 5, 0.3, 2.6); c.stroke(); }
      if (G.mode === 'bed') { c.fillStyle = 'rgba(10,5,30,.35)'; c.fillRect(0, 0, W, H); c.fillStyle = '#8a6ae6'; c.beginPath(); c.roundRect(PX - 60, PY - 30, 120, 34, 12); c.fill(); c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(W - 30, 30, 12, 0, 7); c.fill(); c.fillStyle = '#1a1240'; c.beginPath(); c.arc(W - 25, 26, 10, 0, 7); c.fill(); }
      fx.draw(c);
    };
    f.el = s.cv; loop(f);
  }
  // ---------------------------------------------------------------- creator
  function creator({ pal, slot, first, onDone }) {
    const d = pal ? { species: pal.species, name: pal.name, colors: { ...pal.colors }, pattern: pal.pattern, acc: pal.acc } : { species: 'kemy', name: '', colors: { body: SPEC.kemy.body, accent: SPEC.kemy.acc, eye: '#24133f' }, pattern: 'none', acc: 'none' };
    const chips = (key, list, lab) => list.map((v) => `<button type="button" class="pal-chip ${d[key] === v ? 'on' : ''}" data-${key}="${v}">${esc(lab[v])}</button>`).join('');
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><form class="pal-creator" id="pal-form"><h2>${pal ? 'Style ' + esc(pal.name) : first ? 'Meet your Pal!' : 'New Pal'}</h2><div id="pal-coins" style="text-align:center"></div>
      <div class="pal-prev"></div>
      <div class="pal-l">${pal ? 'Change species <small class="muted">(keeps name, level and look)</small>' : `Choose your Pal <small class="muted">(${SPECIES.length} species · ${SPECIES.length * 3} colour styles)</small>`}</div>
      <input type="search" id="pal-q" placeholder="Search Pals… (cat, dino, sea…)" aria-label="Search Pals" style="width:100%">
      <div class="pal-chips" id="pal-cats">${[['all', 'All'], ['land', '🌳 Land'], ['sea', '🌊 Sea'], ['sky', '☁️ Sky'], ['fantasy', '✨ Fantasy'], ['rare', '★ Rare']].map(([k, n], i) => `<button type="button" class="pal-chip ${i ? '' : 'on'}" data-cat="${k}">${n}</button>`).join('')}</div>
      <div class="pal-sp" role="radiogroup" aria-label="Species">${pal ? '' : '<button type="button" class="pal-chip sp mystery" data-species="mystery" data-c="all" data-n="mystery surprise" title="A surprise Pal!"><span class="pal-q">?</span><b>Mystery egg</b></button>'}${SPECIES.map((s) => `<button type="button" class="pal-chip sp ${d.species === s.id ? 'on' : ''} ${s.rare ? 'rare' : ''}" data-species="${s.id}" data-c="${s.cat}${s.rare ? ' rare' : ''}" data-n="${esc((s.name + ' ' + s.id + ' ' + s.cat).toLowerCase())}" title="${esc(s.blurb)}"><i class="pal-th" data-th="${s.id}"></i><b>${esc(s.name)}</b><small style="color:${s.rare ? '#ffb31a' : VIBES[s.vibe].c}">${s.rare ? `★ ${s.rare} · Rare` : VIBES[s.vibe].name}</small></button>`).join('')}</div>
      <div class="pal-l">Colour style<div class="pal-chips" id="pal-styles"></div></div>
      <label class="pal-l">Name<input id="pal-name" maxlength="20" required placeholder="Give your Pal a name" value="${esc(d.name)}"></label>
      <div class="pal-l">Body<div class="pal-sw">${BODY_PRESETS.map((c) => `<button type="button" style="--c:${c}" data-body="${c}" aria-label="Body color ${c}"></button>`).join('')}</div><input type="range" min="0" max="359" value="290" id="pal-hue" aria-label="Body hue"></div>
      <div class="pal-l">Ears, gills &amp; fins<div class="pal-sw">${ACC_PRESETS.map((c) => `<button type="button" style="--c:${c}" data-accent="${c}" aria-label="Accent color ${c}"></button>`).join('')}</div></div>
      <div class="pal-l">Eyes<div class="pal-sw">${EYE_PRESETS.map((c) => `<button type="button" style="--c:${c}" data-eye="${c}" aria-label="Eye color ${c}"></button>`).join('')}</div></div>
      <div class="pal-l">Pattern<div class="pal-chips">${chips('pattern', PATTERNS, PAT_LABEL)}</div></div>
      <div class="pal-l">Outfit<div class="pal-chips">${chips('acc', ACCESSORIES, ACC_LABEL)}</div></div>
      <button class="btn" type="submit">${pal ? 'Save look' : 'Hatch!'}</button></form>`);
    const f = document.getElementById('pal-form'); const s = stage(f.querySelector('.pal-prev'), 220, 150);
    // thumbnails: a few per frame (3D when available), only for visible tiles
    const thq = [...f.querySelectorAll('[data-th]')]; const thStep = () => { if (!document.body.contains(f)) return; for (let n = 0; n < 4 && thq.length; n++) { const el = thq.shift(); if (el.closest('[hidden]')) { thq.push(el); if (thq.every((x) => x.closest('[hidden]'))) break; continue; } const q = stage(el, 44, 40); drawPal(q.c, 22, 38, 34, { species: el.dataset.th, level: 1 }, { t: 30, mode: 'idle' }); } if (thq.length) requestAnimationFrame(thStep); }; thStep();
    let cat = 'all'; const filt = () => { const qv = f.querySelector('#pal-q').value.trim().toLowerCase(); f.querySelectorAll('.pal-sp [data-species]').forEach((b) => { b.hidden = !((cat === 'all' || b.dataset.c.split(' ').includes(cat)) && (!qv || b.dataset.n.includes(qv))); }); thStep(); };
    f.querySelector('#pal-q').oninput = filt; f.querySelectorAll('[data-cat]').forEach((b) => b.onclick = (e) => { e.stopPropagation(); cat = b.dataset.cat; f.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x === b)); filt(); });
    // 3 colour styles per species (original, pastel, night) = hundreds of Pals
    const styles = () => { const sp = SPEC[d.species]; const el = f.querySelector('#pal-styles'); if (!sp) { el.innerHTML = ''; return; } const hx = (c) => '#' + c.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join(''); const st = [['Original', sp.body, sp.acc], ['Pastel', hx(shade(sp.body, 0.45)), hx(shade(sp.acc, 0.35))], ['Night', hx(shade(sp.body, -0.45)), hx(shade(sp.acc, 0.2))]];
      el.innerHTML = st.map(([n, b, a]) => `<button type="button" class="pal-chip" data-sty="${b}|${a}" style="border-left:14px solid ${b}">${n}</button>`).join(''); };
    styles(); if (shop.econ()) shop.econ().wallet().then((w) => { const el = f.querySelector('#pal-coins'); if (el) el.innerHTML = coinBadge(w.coins); }).catch(() => {}); let owned = {}; shop.econ() && shop.econ().inventory().then((i) => { owned = i || {}; }).catch(() => {});
    const draw = (t) => { s.c.clearRect(0, 0, 220, 150); if (d.species === 'mystery') { drawEgg(s.c, 110, 145, 120, RM() ? 0 : t); return; } drawPal(s.c, 110, 140, 120, { ...d, level: pal ? pal.level : 1 }, { t, mode: t % 300 < 90 ? 'react' : 'idle' }); }; draw.el = s.cv; loop(draw);
    f.addEventListener('click', (e) => { const b = e.target.closest('button[type=button]'); if (!b) return;
      for (const k of ['species', 'pattern', 'acc']) if (b.dataset[k]) { d[k] = b.dataset[k]; f.querySelectorAll(`[data-${k}]`).forEach((x) => x.classList.toggle('on', x === b)); if (k === 'species' && SPEC[d.species]) { d.colors.body = SPEC[d.species].body; d.colors.accent = SPEC[d.species].acc; } }
      for (const k of ['body', 'accent', 'eye']) if (b.dataset[k]) d.colors[k] = b.dataset[k];
      if (b.dataset.sty) { const [bb, aa] = b.dataset.sty.split('|'); d.colors.body = bb; d.colors.accent = aa; }
      if (b.dataset.species) { styles(); const sp = SPEC[d.species]; const sb = f.querySelector('[type=submit]'); sb.textContent = sp && sp.rare && !owned['sp_' + sp.id] ? `Get ${sp.name} for ★${sp.rare}` : pal ? 'Save look' : 'Hatch!'; }
      snd('pop'); });
    f.querySelector('#pal-hue').oninput = (e) => { d.colors.body = hueHex(+e.target.value); };
    f.onsubmit = async (e) => { e.preventDefault(); d.name = f.querySelector('#pal-name').value.trim().slice(0, 20); if (!d.name) return;
      if (d.species === 'mystery') { const pool = SPECIES.filter((x) => !x.rare); const r = pool[Math.floor(Math.random() * pool.length)]; d.species = r.id; d.colors.body = r.body; d.colors.accent = r.acc; toast(`Your mystery egg hatched into a ${r.name}!`); }
      const btn = f.querySelector('[type=submit]'); btn.disabled = true;
      const rsp = SPEC[d.species]; if (rsp && rsp.rare && !owned['sp_' + rsp.id]) { const ec = shop.econ(); let bal = 0; try { bal = (await ec.wallet()).coins || 0; } catch { /* */ }
        const ok = await openBuySheet({ name: rsp.name, price: rsp.rare, icon: '★', balance: bal, note: 'A rare Pal. Star Coins only, no real money.', equipped: pal ? `${d.name} is now a ${rsp.name} ✓` : 'Hatching now ✓',
          buy: async () => { try { await ec.buy('sp_' + rsp.id); owned['sp_' + rsp.id] = 1; return ec.w.coins; } catch (er) { throw new Error(er.code ? friendlyError(er) : er.message || 'Purchase failed'); } } });
        if (!ok) { btn.disabled = false; return; } }
      try { const m = await myPals(); let p;
        if (pal) { p = m.list.find((x) => x.id === pal.id); await m.store.save(p, { name: d.name, colors: d.colors, pattern: d.pattern, acc: d.acc, species: d.species }); }
        else { p = await m.store.create(slot, d); m.list.push(p); m.list.sort((a, b) => a.id.localeCompare(b.id)); if (first || !S.profile.activePet) { await m.store.setActive(p.id); S.profile.activePet = p.id; dispatchEvent(new Event('kemy:pal-changed')); } }
        snd('hatch'); closeModal(); toast(pal ? 'Looking good!' : `Say hi to ${p.name}! 🐾`); onDone && onDone(p);
      } catch (err) { btn.disabled = false; toast(friendlyError(err)); } };
  }
  // ---------------------------------------------------------------- egg hatch intro / what's new
  async function intro(force) {
    if (!S.user || !S.profile) { requireAuth(); return; }
    const m = await myPals(); if (!m) return;
    const isNew = Date.now() - tsMs(S.profile.createdAt) < 3 * 864e5;
    const freeSlot = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].find((id) => !m.list.some((p) => p.id === id));
    if (m.list.length && !force) return;
    openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="pal-intro">${!isNew && !force ? '<span class="pal-new">What’s new</span>' : ''}
      <div class="pal-eggbox"></div><h2>Meet your Kemy Pal 🐾</h2><p>${esc(PALS_COPY.replace('Meet your Kemy Pal 🐾 ', ''))}</p>
      <div class="btns"><button class="btn" id="pal-crack">${m.list.length ? 'Hatch a new egg' : 'Tap the egg to hatch!'}</button><button class="btn btn-ghost" data-close id="pal-skip">Maybe later</button></div></div>`);
    const box = document.querySelector('.pal-eggbox'); const s = stage(box, 200, 150); let cracks = 0, hatched = 0; const fx = particles();
    const f = (t) => { s.c.clearRect(0, 0, 200, 150); if (!hatched) drawEgg(s.c, 100, 140, 120, RM() ? 0 : t * (1 + cracks), cracks); else { hatched++; drawDancer(s.c, 100, 140, 110, { species: 'kemy', level: 1 }, { t, mode: 'happy' }); s.c.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - hatched / 30)})`; s.c.fillRect(0, 0, 200, 150); } fx.draw(s.c); };
    f.el = s.cv; loop(f);
    const crack = () => { cracks++; if (cracks === 1) playIntro(); snd('pop'); fx.add(100, 80, 'star', 4); if (cracks >= 3) { hatched = 1; snd('hatch'); fx.add(100, 70, 'star', 18); setTimeout(() => creator({ slot: freeSlot, first: !m.list.length, onDone: () => { if (location.hash.startsWith('#/u/') || location.hash.startsWith('#/pals')) dispatchEvent(new HashChangeEvent('hashchange')); } }), 900); } };
    s.cv.onclick = crack; document.getElementById('pal-crack').onclick = crack;
  }
  let floatUid = '';
  function onRoute(hash) {
    if (!S.user || !S.profile || S.profile.welcomed === false) return; trackStreak(); shop.daily();
    if (floatUid !== S.user.uid) { floatUid = S.user.uid; dances.setEcon(shop.econ()); dispatchEvent(new Event('kemy:pal-float')); }
    const k = 'kemy-pals-intro-' + S.user.uid; if (localStorage.getItem(k) || /login|signup|onboard|settings|live/.test(hash || '')) return;
    if (document.querySelector('#modal-root .modal')) return;
    localStorage.setItem(k, '1'); myPals().then((m) => { if (m && !m.list.length) intro(false); }).catch(() => {});
  }
  // ---------------------------------------------------------------- Pal Box page
  async function page(main, token, stale, sub) {
    if (sub === 'gallery') return gallery(main);
    if (sub === 'shop') return shop.shopPage(main, { myPals, activeOf, commit });
    if (sub === 'store' || sub === 'store-bg') return palStore.page(main);
    if (!requireAuth()) return; const m = await myPals(true); if (stale && stale(token)) return;
    const n = slots(m); const act = activeOf(m); const firstEmpty = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].find((id) => !m.list.some((p) => p.id === id));
    main.innerHTML = `<section class="card pad pal-box"><div class="pal-box-head"><h1>Pal Box</h1><span class="muted small">${m.list.length}/${MAX_PALS} Pals · ${n} unlocked · <a href="#/pals/gallery">Pal Gallery (${collected().size}/${SPECIES.length})</a></span><a class="pal-coins" href="#/pals/shop" title="Star Coins: open the Pal Shop" id="pal-coins">${shop.coinTxt('…')}</a></div>
      ${m.list.length > 1 ? `<div class="pal-l">Who’s on your profile? <small class="muted">Swipe and tap to switch</small></div><div class="pal-switch" role="radiogroup" aria-label="Active Pal">${m.list.map((p) => `<button role="radio" aria-checked="${act && act.id === p.id}" class="pal-sw-b ${act && act.id === p.id ? 'on' : ''}" data-act="${p.id}"><i data-swc="${p.id}"></i><b>${esc(p.name)}</b></button>`).join('')}</div>` : ''}
      <div class="pal-quick"><a class="btn btn-sm" href="#/pals/shop">🛍️ Pal Shop</a><a class="btn btn-sm btn-ghost" href="#/games/pals">🎮 Pal Games</a><a class="btn btn-sm btn-ghost" href="#/park">🌳 Pal Park</a></div>
      <p class="muted small">${esc(PALS_SHORT)} New eggs unlock as your Pals level up and with daily visit streaks.</p>
      <div class="pal-grid">${['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((id, i) => { const p = m.list.find((x) => x.id === id);
        if (p) return `<div class="pal-card ${act && act.id === id ? 'active' : ''}" data-id="${id}"><div class="pal-thumb"></div><b>${esc(p.name)}</b><small>${esc(formName(p))} · Lv ${p.level}</small>
          <div class="pal-card-b"><button class="btn btn-sm" data-c="care">Care</button><button class="btn btn-sm btn-ghost" data-c="talk">💬 Talk</button><button class="btn btn-sm btn-ghost" data-c="dance">💃 Dance</button><button class="btn btn-sm btn-ghost" data-c="closet">👗 Store</button><button class="btn btn-sm btn-ghost" data-c="style">Colors</button>${act && act.id === id ? '<span class="pal-on">On profile</span>' : '<button class="btn btn-sm btn-ghost" data-c="show">Show on profile</button>'}</div></div>`;
        return id === firstEmpty && m.list.length < n ? `<button class="pal-card egg" data-hatch="${id}"><div class="pal-thumb"></div><b>Egg ready!</b><small>Tap to hatch</small></button>` : `<div class="pal-card locked"><div class="pal-lock">🔒</div><small>Level up your Pals to unlock</small></div>`; }).join('')}</div>
      <label class="check small pal-popset"><input type="checkbox" id="pal-vchat"> Let visitors chat with my Pal (AI)</label>
      <label class="check small pal-popset"><input type="checkbox" id="pal-pops" ${pop.enabled() ? 'checked' : ''}> Pal pop-ups while I scroll videos</label>
      ${debug() ? '<p class="small muted">Test mode is on (debug XP button in the care sheet). <button class="btn btn-sm btn-ghost" id="pal-poptest">Test pop-up</button></p>' : ''}</section>`;
    shop.econ().wallet().then((w) => { const el = main.querySelector('#pal-coins'); if (el) el.innerHTML = shop.coinTxt(w.coins); }).catch(() => {});
    main.querySelectorAll('[data-swc]').forEach((el) => { const p = m.list.find((x) => x.id === el.dataset.swc); const q = stage(el, 56, 50); drawPal(q.c, 28, 47, 40, p, { t: 20, mode: 'idle' }); });
    main.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => { const p = m.list.find((x) => x.id === b.dataset.act); if (act && p.id === act.id) return; try { await m.store.setActive(p.id); S.profile.activePet = p.id; dispatchEvent(new Event('kemy:pal-changed')); snd('pop'); toast(`${p.name} is on your profile now`); page(main); } catch (e) { toast(friendlyError(e)); } });
    visitorSetting(main.querySelector('#pal-vchat'));
    main.querySelector('#pal-pops').onchange = (e) => { pop.set(e.target.checked); toast(e.target.checked ? 'Pal pop-ups on' : 'Pal pop-ups off'); };
    const pt = main.querySelector('#pal-poptest'); if (pt) pt.onclick = () => pop.show(true);
    main.querySelectorAll('.pal-card[data-id]').forEach((card) => { const p = m.list.find((x) => x.id === card.dataset.id); const s = stage(card.querySelector('.pal-thumb'), 110, 90);
      const f = (t) => { s.c.clearRect(0, 0, 110, 90); if (p.bg) drawBg(s.c, 110, 90, p.bg, t); drawDancer(s.c, 55, 84, 74, p, { t, mode: isNight() ? 'sleep' : 'idle', mood: moodOf(liveStats(p)) }); }; f.el = s.cv; loop(f);
      card.querySelectorAll('[data-c]').forEach((b) => b.onclick = async () => { const c = b.dataset.c;
        if (c === 'talk') talk(p, true, S.profile.username, S.user.uid); if (c === 'dance') danceOpen(p); if (c === 'care') openSheet(p); if (c === 'closet') { sessionStorage.setItem('kemy-store-pal', p.id); location.hash = '#/pals/store'; } if (c === 'style') creator({ pal: p, onDone: () => page(main) });
        if (c === 'show') { try { await m.store.setActive(p.id); S.profile.activePet = p.id; dispatchEvent(new Event('kemy:pal-changed')); toast(`${p.name} is on your profile now`); page(main); } catch (e) { toast(friendlyError(e)); } } }); });
    main.querySelectorAll('[data-hatch]').forEach((b) => { const s = stage(b.querySelector('.pal-thumb'), 110, 90); const f = (t) => { s.c.clearRect(0, 0, 110, 90); drawEgg(s.c, 55, 86, 76, RM() ? 0 : t); }; f.el = s.cv; loop(f); b.onclick = () => creator({ slot: b.dataset.hatch, onDone: () => page(main) }); });
  }
  function collected() {
    const k = 'kemy-pals-collected-' + (S.user ? S.user.uid : ''); const set = new Set(JSON.parse(localStorage.getItem(k) || '[]'));
    if (mine) mine.list.forEach((p) => set.add(SPEC[p.species] ? SPEC[p.species].id : p.species)); localStorage.setItem(k, JSON.stringify([...set])); return set;
  }
  async function gallery(main) {
    if (S.user && S.profile) await myPals(); const got = collected();
    main.innerHTML = `<section class="card pad pal-box"><div class="pal-box-head"><h1>Pal Gallery</h1><span class="pal-count">${got.size}/${SPECIES.length} collected</span></div>
      <p class="muted small">Every Pal has a baby, kid and grown-up glow-up form. Hatch one to add it to your collection.</p>
      <div class="pal-gal">${SPECIES.map((s) => `<div class="pal-gcard ${got.has(s.id) ? 'got' : ''}"><div class="pal-thumb" data-g="${s.id}"></div><b>${esc(s.name)}</b><small style="color:${VIBES[s.vibe].c}">${VIBES[s.vibe].name}</small><small>${esc(s.forms.join(' → '))}</small>${got.has(s.id) ? '<span class="pal-got">Collected</span>' : ''}</div>`).join('')}</div>
      <a class="btn btn-sm btn-ghost" href="#/pals">← Pal Box</a></section>`;
    main.querySelectorAll('[data-g]').forEach((el) => { const sp = el.dataset.g; const q = stage(el, 96, 84); let lv = 1; const fn = (t) => { if (t % 180 === 0) lv = lv === 1 ? 5 : lv === 5 ? 12 : 1; q.c.clearRect(0, 0, 96, 84); drawPal(q.c, 48, 80, 64, { species: sp, level: lv }, { t, mode: t % 180 > 130 ? 'react' : 'idle' }); if (!got.has(sp)) { q.c.globalCompositeOperation = 'source-atop'; q.c.fillStyle = 'rgba(40,20,80,.55)'; q.c.fillRect(0, 0, 96, 84); q.c.globalCompositeOperation = 'source-over'; } }; fn.el = q.cv; if (RM()) fn(1); else loop(fn); });
  }
  addEventListener('kemy:coins', (e) => { const d = e.detail || {}; if (S.user && d.src) shop.earn(d.src, d.n || 1, d.why); });
  // XP from activity elsewhere in the app: dispatchEvent(new CustomEvent('kemy:xp', { detail: { n } }))
  addEventListener('kemy:xp', async (e) => { try { const m = await myPals(); if (!m) return; const p = activeOf(m); if (!p) return; await commit(p, { xpGain: Math.min(60, (e.detail && e.detail.n) || 10) }); } catch {} });
  // floating companion (keep-on-screen setting / dancing while music plays elsewhere)
  initFloat({ toast, getPal: async () => { if (!S.user) return null; const m = await myPals(); return m ? activeOf(m) : null; } });
  return { renderProfile, onRoute, page, intro, openSheet, gallery, shop, myPals, activeOf, commit, liveOverlay: (root, o) => liveOverlay({ S, db, toast }, root, o), popups: pop };
}
