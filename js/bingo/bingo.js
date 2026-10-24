// Pal Bingo — cozy 75-ball rooms. Lazy-loaded from the arcade and the Bingo Hall.
// Stars are prizes for playing (the shared daily win cap). Nothing here is a wager or a purchase.
// Written by Lone Keem.
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, onSnapshot, query, where, orderBy, limit, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { drawPal } from '../pals/art.js';
import { sfx } from '../games/sfx.js';
import { watchGameRotate } from '../rotate.js';
import {
  BOTS, LUCKY_BALLS, PATTERN_NAME, ballsFor, bingoCall, cardFor, cardMiss, cardSlots, claimOk, dayKey, letterOf,
  levelOf, luckyRound, markedWin, masksFor, mix, patternFor, roundAt, roundSeed, weekId
} from './logic.js';

const CSS = `.pb{max-width:1040px;margin:0 auto;padding:10px 10px 24px;color:#2b1d55;font-family:Inter,system-ui,sans-serif}
.pb-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.pb-top h1{font-size:1.25rem;margin:0;flex:1}
.pb-top a,.pb-ico{border:0;background:#fff;border-radius:12px;min-width:40px;height:40px;display:grid;place-items:center;text-decoration:none;color:inherit;font-weight:800}
.pb h1 small{display:block;font-weight:600;font-size:.72rem;opacity:.7}
.pb-hero{width:100%;height:168px;border-radius:18px;display:block;background:#3a2468}
.pb-note{font-size:.8rem;background:#fff6d8;border-radius:12px;padding:8px 10px;margin:8px 0}
.pb-row{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.pb-row button,.pb-row a{border:0;border-radius:14px;padding:10px 12px;font-weight:800;background:#6b4fd6;color:#fff;text-decoration:none}
.pb-row .alt{background:#fff;color:#2b1d55}
.pb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pb-box{background:#fff;border-radius:16px;padding:10px}
.pb-box h2{font-size:.95rem;margin:0 0 6px}
.pb-xp{height:10px;background:#efe7ff;border-radius:99px;overflow:hidden;margin-top:4px}.pb-xp i{display:block;height:100%;background:#ffb31a}
.pb-lock{opacity:.45}
.pb code{font-weight:800;letter-spacing:.12em}
.pb-play{display:flex;flex-direction:column;gap:8px}
.pb-caller{display:flex;align-items:center;gap:10px;background:linear-gradient(180deg,#4a2d86,#2a1848);color:#fff;border-radius:18px;padding:8px}
.pb-face{width:62px;height:62px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#f0b6ea);position:relative;flex:none;animation:pbBob 2.6s ease-in-out infinite;box-shadow:0 5px 0 #c48adf}
.pb-face i{position:absolute;top:22px;width:8px;height:10px;background:#24133f;border-radius:50%;animation:pbBlink 3.6s infinite}
.pb-face i:nth-child(1){left:16px}.pb-face i:nth-child(2){right:16px}
.pb-face b{position:absolute;left:22px;right:22px;bottom:14px;height:7px;border-radius:0 0 8px 8px;background:#d45b8c;transition:height .12s}
.pb-face.talk b{height:14px}
.pb-ball{width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 32% 30%,#fff,#ffe08a 42%,#e7a318);color:#3a2a10;display:grid;place-items:center;font-weight:900;flex:none;box-shadow:inset -5px -6px 0 rgba(80,40,0,.12)}
.pb-ball small{display:block;font-size:11px;margin-top:-4px}
.pb-last{display:flex;gap:4px;flex-wrap:wrap}.pb-last b{background:#fff;color:#2b1d55;border-radius:99px;padding:2px 7px;font-size:12px}
.pb-meta{display:flex;justify-content:space-between;gap:8px;font-weight:800;font-size:.9rem}
.pb-meta .lucky{color:#a15c00}
.pb-board{display:flex;gap:3px;font-size:8px;margin-top:4px}.pb-board b{display:flex;flex-direction:column;gap:1px;flex:1;font-weight:800}
.pb-board i{display:grid;place-items:center;background:#efeaf8;border-radius:3px;min-height:12px;font-style:normal;color:#2b1d55}
.pb-board i.on{background:#6b4fd6;color:#fff}
.pb-cards{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.pb-card{display:grid;grid-template-columns:repeat(5,42px);gap:3px;background:#fff;border-radius:14px;padding:8px;flex:none;border:3px solid transparent}
.pb-card.one{border-color:#ffd34d;box-shadow:0 0 16px #ffd34d}
.pb-card.win{border-color:#6b4fd6}
.pb.theme-meadow .pb-card{background:#f3ffe8}.pb.theme-night .pb-card{background:#1d1630;color:#fff}.pb.theme-lucky .pb-card{background:#fff8e0}
.pb-cell{width:42px;height:42px;border:0;border-radius:8px;background:#f6f1ff;color:inherit;font-weight:800;position:relative}
.pb-cell.free{background:#ffd34d}
.pb-cell.got{animation:pbStamp .28s ease-out}.pb-cell.got::after{content:'';position:absolute;inset:5px;border-radius:50%;border:3px solid var(--daub,#6b4fd6)}
.pb-cell.star::after{border-color:#e7a318;background:rgba(255,211,77,.35)}
.pb-powers{display:flex;gap:6px;flex-wrap:wrap}.pb-powers button{border:0;border-radius:12px;padding:8px 10px;font-weight:800;background:#fff}
.pb-go{position:sticky;bottom:8px;z-index:4}.pb-go button{width:100%;border:0;border-radius:16px;background:#ffd34d;color:#3a2a10;font-weight:900;font-size:22px;padding:12px;box-shadow:0 6px 0 #e0a020}
.pb-go button:disabled{opacity:.55}
.pb-hall{width:100%;height:168px;border-radius:18px;display:block;background:#3a2468;touch-action:manipulation}
.pb-chat{display:flex;gap:6px;flex-wrap:wrap}.pb-chat button{border:0;border-radius:999px;background:#fff;padding:6px 10px;font-weight:800}
.pb-win{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:rgba(28,14,58,.42);pointer-events:none}
.pb-win[hidden]{display:none}.pb-win b{font-size:64px;color:#ffd34d;text-shadow:0 6px 0 #7a4fd0;animation:pbPop .35s ease-out}
.pb-win p{margin:0;text-align:center;font-weight:800;color:#fff;text-shadow:0 2px 0 #2b1d55}
.pb-win span{position:absolute;font-size:22px;animation:pbFly 1s ease-out forwards}
.pb-break{background:#e8fff1;border-radius:12px;padding:8px 10px}
@keyframes pbBob{50%{transform:translateY(-3px)}}@keyframes pbBlink{0%,88%,100%{transform:scaleY(1)}93%{transform:scaleY(.12)}}
@keyframes pbStamp{from{transform:scale(1.4) rotate(-8deg)}to{transform:none}}@keyframes pbPop{from{transform:scale(.4)}to{transform:none}}
@keyframes pbFly{to{transform:translateY(-80px);opacity:0}}
@media (orientation:landscape) and (max-height:520px){.pb-play{display:grid;grid-template-columns:1fr 300px}.pb-side{display:flex;flex-direction:column;gap:8px}.pb-hero,.pb-hall{height:120px}}
@media (prefers-reduced-motion:reduce){.pb-face,.pb-cell.got,.pb-win b{animation:none}}`;

const PHRASES = ['👋', '😄', '🎉', '⭐', 'Nice!', 'Good luck!'];
const DAUBERS = [{ id: 'ink', name: 'Ink', lv: 1, c: '#6b4fd6' }, { id: 'star', name: 'Star', lv: 2, c: '#e7a318' }, { id: 'heart', name: 'Heart', lv: 3, c: '#ff6fae' }, { id: 'crown', name: 'Crown', lv: 5, c: '#3aa0e0' }];
const THEMES = [{ id: 'cozy', name: 'Cozy', lv: 1 }, { id: 'meadow', name: 'Meadow', lv: 2 }, { id: 'night', name: 'Night', lv: 4 }, { id: 'lucky', name: 'Lucky', lv: 6 }];
const POWNAME = { free: 'Free daub', double: 'Double stars', peek: 'Peek next' };
const FALLBACK = { species: 'kemy', name: 'Pal', level: 3, pattern: 'none', acc: 'none', colors: { body: '#f7cdee', accent: '#8a55dc', eye: '#24133f' } };
const FRESH = 25000;

function css() { if (document.getElementById('pb-css')) return; const s = document.createElement('style'); s.id = 'pb-css'; s.textContent = CSS; document.head.appendChild(s); }
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function look(pal, lv) {
  const p = { ...FALLBACK, ...(pal || {}), colors: { ...FALLBACK.colors, ...((pal && pal.colors) || {}) } };
  if (!p.acc || p.acc === 'none') p.acc = lv >= 5 ? 'crown' : lv >= 3 ? 'bow' : 'none';
  return p;
}
let audio = null;
function chirp() {
  if (sfx.muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    [494, 740].forEach((f, i) => { const o = audio.createOscillator(), g = audio.createGain(); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.07, t + i * 0.07 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.18); o.connect(g).connect(audio.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.2); });
  } catch { /* no audio */ }
}

export function openBingo(ctx, q = {}) {
  if (!ctx.requireAuth()) return;
  css();
  const { main, db, toast, friendlyError } = ctx;
  const uid = ctx.S.user.uid;
  const prof = ctx.S.profile || {};
  const myName = String(prof.displayName || 'Pal').slice(0, 50);
  const myCol = String(prof.color || '#b26bff').slice(0, 20);
  const fast = q.fast === '1';
  const SK = 'kemy-bingo-v1-' + uid;
  let prog = {}; try { prog = JSON.parse(localStorage.getItem(SK) || '{}'); } catch { prog = {}; }
  prog = { xp: 0, daubs: 0, days: 0, day: '', gift: '', powers: [], dauber: 'ink', theme: 'cozy', auto: true, cards: 1, stickers: { b: [], p: [] }, ch: null, ...prog };
  if (!prog.stickers) prog.stickers = { b: [], p: [] };
  const persist = () => { try { localStorage.setItem(SK, JSON.stringify(prog)); } catch { /* full */ } };
  const lv = () => levelOf(prog.xp);
  const slots = () => cardSlots(lv());
  let econ = null;
  async function prize(n, why) {
    try {
      if (!econ) { const { createEconomy } = await import('../pals/economy.js'); econ = createEconomy(db, uid); }
      const g = await econ.earn('win', Math.max(1, Math.min(25, n | 0)));
      if (g) toast(`+${g} ⭐ ${why}`);
      else if (!prize.capped) { prize.capped = 1; toast('Today’s prize stars are full. You can keep playing just for fun.'); }
      return g || 0;
    } catch (e) { console.warn('bingo prize', e); return 0; }
  }
  const today = dayKey();
  let gifted = false;
  if (prog.day !== today) {
    prog.days = (prog.days | 0) + 1; prog.day = today; prog.gift = today;
    prog.ch = { day: today, daub: 0, rounds: 0, corners: 0, got: {} }; persist(); gifted = true;
  }
  const ch = () => { if (!prog.ch || prog.ch.day !== today) prog.ch = { day: today, daub: 0, rounds: 0, corners: 0, got: {} }; return prog.ch; };
  const session0 = Date.now(); let broke = false;
  let dead = false, mode = 'lobby', roomId = '', room = null, seats = [], unsubR = null, unsubS = null, hb = 0;
  let claim = 0, emo = 0, lastSeat = 0, seatQ = Promise.resolve(), myPal = null;
  let daubed = new Set(), frees = new Map(), paidRound = -1, peekUntil = 0, doubleOn = false, missUntil = 0, winUntil = 0, winText = '';
  let seenBall = -1, tickN = 0, drum = 0, botShown = -1, botCache = { seed: 0, at: 0 }, ge = null, seenEmo = new Map(), spots = [];
  const palCache = new Map();
  const arm = () => { if (!dead) watchGameRotate(); };

  function grantCh() {
    const c = ch(), goals = { daub: ['Daub 50 numbers', 50], corners: ['Win with four corners', 1], rounds: ['Play 2 rounds', 2] };
    for (const [k, [label, goal]] of Object.entries(goals)) {
      if ((c[k] || 0) >= goal && !c.got[k]) { c.got[k] = 1; prog.xp += 10; persist(); prize(8, 'for “' + label + '”'); toast('Challenge complete: ' + label); }
    }
  }
  function addDaubs(n) {
    const prev = Math.floor(prog.daubs / 12); prog.daubs += n; prog.xp += n; const next = Math.floor(prog.daubs / 12);
    if (next > prev && prog.powers.length < 3) { const id = ['free', 'double', 'peek'][(next - 1) % 3]; prog.powers.push(id); toast('Power-up earned: ' + POWNAME[id]); }
    ch().daub += n; persist(); grantCh();
  }
  function stickerBall(n) { if (!LUCKY_BALLS.includes(n) || prog.stickers.b.includes(n)) return; prog.stickers.b.push(n); persist(); toast('Sticker: ball ' + n); }
  function stickerPat(id) { if (prog.stickers.p.includes(id)) return; prog.stickers.p.push(id); persist(); }

  async function loadPal(who) {
    if (!who || String(who).startsWith('bot-')) return null;
    if (!palCache.has(who)) palCache.set(who, import('../pals/core.js').then((m) => m.getActivePal(db, who)).catch(() => null));
    return palCache.get(who);
  }
  loadPal(uid).then((p) => { myPal = p; });

  function clock() {
    if (!room || !room.start || !room.start.toMillis) return null;
    return roundAt(room.start.toMillis(), Date.now(), fast);
  }
  function writeSeat(extra) {
    if (!roomId || dead) return seatQ;
    const body = { name: myName, col: myCol, n: Math.min(slots(), Math.max(1, prog.cards | 0)), claim, emo, at: serverTimestamp(), ...extra };
    if (extra && 'claim' in extra) claim = extra.claim;
    if (extra && 'emo' in extra) emo = extra.emo;
    seatQ = seatQ.then(async () => {
      const wait = 2200 - (Date.now() - lastSeat); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      if (dead || !roomId) return;
      await setDoc(doc(db, 'bingoRooms', roomId, 'seats', uid), { name: myName, col: myCol, n: body.n, claim, emo, at: serverTimestamp() });
      lastSeat = Date.now();
    }).catch((e) => console.warn('bingo seat', e && e.code));
    return seatQ;
  }
  function dropSeat() {
    clearInterval(hb); hb = 0; if (unsubR) unsubR(); if (unsubS) unsubS(); unsubR = unsubS = null;
    const id = roomId; roomId = ''; room = null; seats = [];
    if (id) deleteDoc(doc(db, 'bingoRooms', id, 'seats', uid)).catch(() => {});
  }
  async function ensure(id, pub) {
    const ref = doc(db, 'bingoRooms', id);
    const s = await getDoc(ref); if (s.exists()) return;
    const seed = 1 + Math.floor(Math.random() * 1e9);
    try { await setDoc(ref, { host: uid, code: id, pub: !!pub, seed, start: serverTimestamp() }); }
    catch (e) { const again = await getDoc(ref); if (!again.exists()) throw e; }
  }
  async function freshCount(id) {
    try {
      const s = await getDocs(collection(db, 'bingoRooms', id, 'seats')); const now = Date.now();
      return s.docs.filter((d) => { const at = d.data().at; return at && at.toMillis && now - at.toMillis() < FRESH; }).length;
    } catch { return 0; }
  }
  function listen(id) {
    dropSeat(); roomId = id; mode = 'hall'; daubed = new Set(); frees = new Map(); seenBall = -1; botShown = -1; claim = 0; emo = 0;
    paintHall();
    unsubR = onSnapshot(doc(db, 'bingoRooms', id), (s) => { room = s.exists() ? s.data() : null; });
    unsubS = onSnapshot(collection(db, 'bingoRooms', id, 'seats'), (s) => {
      const now = Date.now();
      seats = s.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at && d.data().at.toMillis ? d.data().at.toMillis() : 0 })).filter((x) => now - x.at < FRESH || x.id === uid);
      seats.forEach((x) => { if (!seenEmo.has(x.id)) { seenEmo.set(x.id, x.emo || 0); return; } if (seenEmo.get(x.id) === (x.emo || 0) || x.id === uid) return; seenEmo.set(x.id, x.emo || 0); onEmo(x); });
    });
    writeSeat({});
    hb = setInterval(() => writeSeat({}), 8000);
  }
  function onEmo(x) {
    const host = main.querySelector('.pb-floats'); if (!host) return;
    if (x.emo >= 100) { ge && ge.recv(x.id, x.emo, x.name); return; }
    const el = document.createElement('b'); el.textContent = (PHRASES[(x.emo || 1) - 1] || '⭐') + ' ' + x.name; host.appendChild(el); setTimeout(() => el.remove(), 2400);
  }
  async function joinPublic() {
    try {
      for (const id of ['hall', 'hall2', 'hall3']) {
        await ensure(id, true);
        if (await freshCount(id) < 20) { listen(id); return; }
      }
      toast('Public halls are full. Try a private room with friends.');
    } catch (e) { toast(friendlyError ? friendlyError(e) : 'Could not open the hall'); }
  }
  async function makePrivate() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let id = '';
    for (let i = 0; i < 5; i++) id += A[Math.floor(Math.random() * A.length)];
    try { await ensure(id, false); listen(id); toast('Room code ' + id); } catch (e) { toast(friendlyError ? friendlyError(e) : 'Could not make a room'); }
  }
  async function joinCode(raw) {
    const id = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (id.length < 4) { toast('Codes look like ABCDE'); return; }
    const s = await getDoc(doc(db, 'bingoRooms', id));
    if (!s.exists() || s.data().pub) { toast('No private room with that code'); return; }
    listen(id);
  }

  function roster() {
    const humans = seats.filter((s) => s.id === uid || Date.now() - s.at < FRESH);
    const me = humans.find((s) => s.id === uid) || { id: uid, name: myName };
    const others = humans.filter((s) => s.id !== uid).slice(0, 9);
    const bots = humans.length >= 6 ? [] : BOTS.slice(0, Math.min(6, 6 - humans.length));
    return [me, ...others, ...bots].slice(0, 10);
  }
  function drawRoom(cv, frame, moods) {
    if (!cv) return; const dpr = Math.min(1.5, devicePixelRatio || 1); const w = cv.clientWidth || 320, h = cv.clientHeight || 160;
    if (cv.width !== Math.floor(w * dpr)) { cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr); }
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f7e7c2'); g.addColorStop(0.45, '#6b4c93'); g.addColorStop(1, '#3a2468'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,220,150,.9)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(18 + i * ((w - 20) / 6), 14, 3.5, 0, 7); c.fill(); }
    c.fillStyle = '#e6c39a'; c.beginPath(); c.ellipse(w / 2, h * 0.82, w * 0.42, h * 0.16, 0, 0, 7); c.fill();
    const pals = roster(); spots = [];
    pals.forEach((p, i) => {
      const x = (w / (pals.length + 1)) * (i + 1), y = h * 0.8;
      const bot = BOTS.find((b) => b.id === p.id);
      const base = bot ? { species: bot.species, acc: bot.acc, level: 4, name: bot.name } : (p.id === uid ? (myPal || FALLBACK) : (p._pal || FALLBACK));
      if (!bot && p.id !== uid && !p._pal) { p._wait = p._wait || loadPal(p.id).then((got) => { p._pal = got || FALLBACK; }); }
      const mood = (moods && moods.get(p.id)) || 'idle';
      drawPal(c, x, y, Math.min(64, h * 0.42), look(base, p.id === uid ? lv() : 3), { t: frame * 2 + i * 12, mode: mood, flat: true, face: x < w / 2 ? 1 : -1 });
      c.font = '700 11px Inter,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(43,29,85,.8)'; c.lineWidth = 3;
      const tag = (p.name || (bot && bot.name) || 'Pal').slice(0, 16); c.strokeText(tag, x, y + 16); c.fillText(tag, x, y + 16);
      spots.push({ id: p.id, x, y, me: p.id === uid });
    });
  }

  function paintLobby() {
    mode = 'lobby'; const slotsN = slots(), lvN = lv();
    const c = ch();
    const goals = [['daub', 'Daub 50 numbers', 50], ['corners', 'Win with four corners', 1], ['rounds', 'Play 2 rounds', 2]];
    main.innerHTML = `<section class="pb theme-${esc(prog.theme)}" style="--daub:${esc((DAUBERS.find((d) => d.id === prog.dauber) || DAUBERS[0]).c)}">
      <div class="pb-top"><a href="#/arcade" aria-label="Back to arcade">←</a><h1>Pal Bingo 🎱⭐<small>Cozy 75-ball rooms · pals included</small></h1><div data-k-rot></div><button class="pb-ico" type="button" data-mute aria-label="Sound">${sfx.muted ? '🔇' : '🔊'}</button></div>
      <canvas class="pb-hero" aria-label="Your pal and friends in the bingo hall"></canvas>
      <p class="pb-note">⭐ Stars are prizes for playing, with a daily cap. No shop, no bets, no real money.</p>
      ${gifted ? '<p class="pb-note">Welcome in. Here’s a small prize for showing up today — missing a day never takes anything away.</p>' : ''}
      <div class="pb-box"><b>Level ${lvN}</b> · Play days ${prog.days | 0}<div class="pb-xp"><i style="width:${(prog.xp % 30) / 30 * 100}%"></i></div></div>
      <div class="pb-row"><button type="button" data-pub>Join a public hall</button><button type="button" data-priv>Private room</button></div>
      <form class="pb-row" data-code><input aria-label="Room code" maxlength="5" placeholder="Friend code" autocapitalize="characters" autocomplete="off" style="border-radius:12px;border:0;padding:10px;font-weight:800;width:8rem"><button class="alt" type="submit">Join</button></form>
      <div class="pb-grid">
        <div class="pb-box"><h2>Cards</h2><div class="pb-row">${[1, 2, 3, 4].map((n) => `<button type="button" class="${n === Math.min(prog.cards, slotsN) ? '' : 'alt'} ${n > slotsN ? 'pb-lock' : ''}" data-cards="${n}">${n}${n > slotsN ? ' 🔒' : ''}</button>`).join('')}</div><p class="pb-note">More cards unlock as you play. Never for sale.</p></div>
        <div class="pb-box"><h2>Dauber &amp; card</h2><div class="pb-row">${DAUBERS.map((d) => `<button type="button" class="${prog.dauber === d.id ? '' : 'alt'} ${lvN < d.lv ? 'pb-lock' : ''}" data-daub="${d.id}" ${lvN < d.lv ? 'disabled' : ''}>${esc(d.name)}</button>`).join('')}</div><div class="pb-row">${THEMES.map((t) => `<button type="button" class="${prog.theme === t.id ? '' : 'alt'} ${lvN < t.lv ? 'pb-lock' : ''}" data-theme="${t.id}" ${lvN < t.lv ? 'disabled' : ''}>${esc(t.name)}</button>`).join('')}</div></div>
      </div>
      <div class="pb-box"><h2>Today’s challenges</h2><ul>${goals.map(([k, label, goal]) => `<li>${c.got && c.got[k] ? '✅' : '▫️'} ${esc(label)} (${Math.min(goal, c[k] || 0)}/${goal})</li>`).join('')}</ul><p class="pb-note">A new set each day you visit. Skipping a day just starts fresh.</p></div>
      <details class="pb-box"><summary><b>Sticker book</b></summary><p>Balls: ${LUCKY_BALLS.map((n) => prog.stickers.b.includes(n) ? n : '·').join(' ')}</p><p>Patterns: ${['line', 'corners', 'x', 'heart', 'star', 'crown', 'blackout'].map((id) => prog.stickers.p.includes(id) ? PATTERN_NAME[id] : '·').join(' · ')}</p></details>
      <div class="pb-box"><h2>This week</h2><div data-week>Loading…</div><p><a href="#/scores/bingo?tab=week">Full weekly board</a></p></div>
      <p class="pb-note">Rounds are about 2–3 minutes. Power-ups (free daub, double stars, peek) are earned by playing, not bought. Chat is quick phrases and emotes only.</p>
      <div class="pb-break" data-break hidden>You’ve been playing a while. A break is nice too — come back whenever you like.</div>
    </section>`;
    const hero = main.querySelector('.pb-hero');
    const fake = [{ id: uid, name: myName }, ...BOTS.slice(0, 4)];
    const prev = seats; seats = fake; drawRoom(hero, 20, new Map()); seats = prev;
    main.querySelector('[data-mute]').onclick = () => { sfx.muted = !sfx.muted; paintLobby(); };
    main.querySelector('[data-pub]').onclick = () => joinPublic();
    main.querySelector('[data-priv]').onclick = () => makePrivate();
    main.querySelector('[data-code]').onsubmit = (e) => { e.preventDefault(); joinCode(e.target.querySelector('input').value); };
    main.querySelectorAll('[data-cards]').forEach((b) => b.onclick = () => { const n = +b.dataset.cards; if (n > slots()) { toast('Play a little more to unlock another card'); return; } prog.cards = n; persist(); paintLobby(); });
    main.querySelectorAll('[data-daub]').forEach((b) => b.onclick = () => { prog.dauber = b.dataset.daub; persist(); paintLobby(); });
    main.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => { prog.theme = b.dataset.theme; persist(); paintLobby(); });
    if (gifted) prize(5, 'for visiting today');
    gifted = false;
    weekBoard(); arm(); breakNote();
  }
  async function weekBoard() {
    const el = main.querySelector('[data-week]'); if (!el) return;
    try {
      const s = await getDocs(query(collection(db, 'leaderboard'), where('game', '==', 'bingo'), where('wk', '==', weekId()), orderBy('wkScore', 'desc'), limit(5)));
      const rows = s.docs.map((d) => d.data());
      el.innerHTML = rows.length ? `<ol>${rows.map((r) => `<li>${esc(r.name)} · ${r.wkScore | 0} pts</li>`).join('')}</ol>` : '<p>No wins yet this week. Yours could be first.</p>';
    } catch { if (el) el.textContent = 'The weekly board will show wins once a few rounds are in.'; }
  }
  function paintHall() {
    const dcol = (DAUBERS.find((d) => d.id === prog.dauber) || DAUBERS[0]).c;
    main.innerHTML = `<section class="pb theme-${esc(prog.theme)}" style="--daub:${esc(dcol)}">
      <div class="pb-top"><button class="pb-ico" type="button" data-leave aria-label="Back to lobby">←</button><h1>Pal Bingo<small data-code></small></h1><div data-k-rot></div><button class="pb-ico" type="button" data-mute aria-label="Sound">${sfx.muted ? '🔇' : '🔊'}</button></div>
      <div class="pb-play"><div>
        <div class="pb-caller"><div class="pb-face" data-face><i></i><i></i><b></b></div><div class="pb-ball" data-ball><small>—</small>—</div><div><div class="pb-last" data-last></div><button type="button" class="alt" data-board style="margin-top:6px;border:0;border-radius:10px;padding:6px 8px;font-weight:800">Called board</button><div class="pb-board" data-grid hidden></div></div></div>
        <div class="pb-meta"><span data-pat>Pattern</span><span data-time></span></div>
        <p class="pb-note" data-peek hidden></p>
        <div class="pb-cards" data-cards></div>
        <div class="pb-powers" data-pow></div>
        <div class="pb-go"><button type="button" data-bingo>BINGO!</button></div>
      </div><div class="pb-side">
        <canvas class="pb-hall" data-hall aria-label="Bingo hall and pals"></canvas>
        <div class="pb-chat" aria-label="Quick chat">${PHRASES.map((p, i) => `<button type="button" data-say="${i}">${esc(p)}</button>`).join('')}<button type="button" data-emo aria-label="Emote">😊</button></div>
        <div class="pb-floats" style="min-height:1.2em;font-weight:800"></div>
        <p class="pb-note">Tap a number to stamp it, or leave auto-daub on. Tap your pal to emote.</p>
        <label class="pb-note"><input type="checkbox" data-auto ${prog.auto ? 'checked' : ''}> Auto-daub</label>
        <div class="pb-break" data-break hidden>You’ve been playing a while. A break is nice too — come back whenever you like.</div>
      </div></div>
      <div class="pb-win" data-win hidden><div><b>BINGO!</b><p data-wint></p></div></div>
    </section>`;
    main.querySelector('[data-leave]').onclick = () => { dropSeat(); paintLobby(); };
    main.querySelector('[data-mute]').onclick = () => { sfx.muted = !sfx.muted; paintHall(); };
    main.querySelector('[data-auto]').onchange = (e) => { prog.auto = e.target.checked; persist(); };
    main.querySelector('[data-board]').onclick = () => { const g = main.querySelector('[data-grid]'); g.hidden = !g.hidden; };
    main.querySelector('[data-bingo]').onclick = () => pressBingo();
    main.querySelectorAll('[data-say]').forEach((b) => b.onclick = () => { const i = +b.dataset.say; float(PHRASES[i] + ' you'); writeSeat({ emo: i + 1 }); });
    main.querySelector('[data-cards]').onclick = (e) => { const btn = e.target.closest('[data-k]'); if (!btn) return; tapCell(btn.dataset.k); };
    const hall = main.querySelector('[data-hall]');
    hall.onclick = (e) => { const r = hall.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; const hit = spots.find((s) => Math.hypot(s.x - x, s.y - y) < 36); if (hit && hit.me) main.querySelector('[data-emo]')?.click(); };
    import('../pals/game-emotes.js').then((m) => { if (dead || mode !== 'hall') return; ge = m.mountGameEmotes(main.querySelector('.pb'), { db, uid, button: main.querySelector('[data-emo]'), toast, send: (code) => writeSeat({ emo: code }) }); }).catch(() => {});
    arm();
  }
  function float(text) { const host = main.querySelector('.pb-floats'); if (!host) return; const el = document.createElement('b'); el.textContent = text; host.appendChild(el); setTimeout(() => el.remove(), 2400); }
  function liveRound() {
    const ck = clock(); if (!ck || !room) return null;
    const seed = roundSeed(room.seed || 1, ck.round);
    const balls = ballsFor(seed); const pat = patternFor(ck.round); const masks = masksFor(pat);
    const called = new Set(balls.slice(0, ck.called));
    const n = Math.min(slots(), Math.max(1, prog.cards | 0));
    const cards = Array.from({ length: n }, (_, i) => cardFor(seed, uid, i));
    return { ck, seed, balls, pat, masks, called, cards };
  }
  function tapCell(key) {
    const st = liveRound(); if (!st || !st.ck.live) return;
    const [ci, k] = key.split(':').map(Number); const card = st.cards[ci]; if (!card) return;
    const n = card[k]; if (k === 12) return;
    if (st.called.has(n)) { if (!daubed.has(n)) { daubed.add(n); addDaubs(1); stickerBall(n); sfx.play('place'); } return; }
    if (prog.powers.includes('free') && !frees.has(ci)) { frees.set(ci, k); prog.powers.splice(prog.powers.indexOf('free'), 1); persist(); sfx.play('star'); toast('Free daub placed'); return; }
    toast('That number has not been called yet');
  }
  function usePower(id) {
    const i = prog.powers.indexOf(id); if (i < 0) return; const st = liveRound(); if (!st) return;
    if (id === 'peek') { prog.powers.splice(i, 1); peekUntil = Date.now() + 8000; persist(); return; }
    if (id === 'double') { prog.powers.splice(i, 1); doubleOn = true; persist(); toast('Your next win prize is doubled'); return; }
    if (id === 'free') {
      let best = null, bm = 99;
      st.cards.forEach((card, ci) => { if (frees.has(ci)) return; const miss = cardMiss(card, st.called, st.masks, -1); if (miss < bm && miss > 0) { bm = miss; best = { card, ci }; } });
      if (!best) { toast('Nothing to daub on the pattern right now'); return; }
      const cell = best.card.findIndex((n, k) => k !== 12 && !st.called.has(n) && st.masks.some((m) => m[k]));
      if (cell < 0) return; frees.set(best.ci, cell); prog.powers.splice(i, 1); persist(); sfx.play('star');
    }
  }
  function pressBingo() {
    const st = liveRound(); if (!st || !st.ck.live) { toast('Wait for the next round'); return; }
    let win = false, one = false, needMark = false;
    st.cards.forEach((card, ci) => {
      const free = frees.has(ci) ? frees.get(ci) : -1;
      const miss = cardMiss(card, st.called, st.masks, free);
      if (miss === 0 && markedWin(card, daubed, st.masks, free)) win = true;
      else if (miss === 0) needMark = true;
      else if (miss === 1) one = true;
    });
    if (needMark && !win) { toast('Stamp the called numbers first'); return; }
    if (!win) { missUntil = Date.now() + 1600; sfx.play('lose'); toast(one ? 'So close — one number away' : 'Not yet. Keep going!'); return; }
    const C = st.ck.called;
    const botAt = botBingo(st);
    const earlier = seats.some((s) => s.id !== uid && s.claim > 0 && s.claim < C) || (botAt && botAt < C);
    claim = C; writeSeat({ claim: C });
    const lucky = luckyRound(st.ck.round);
    let stars = earlier ? 5 : (lucky ? 18 : 12);
    if (!earlier && doubleOn) stars = Math.min(25, stars * 2);
    doubleOn = false;
    if (paidRound !== st.ck.round) { paidRound = st.ck.round; prize(stars, earlier ? 'for a bingo' : 'for winning the round'); prog.xp += 20; ch().rounds += 1; if (st.pat === 'corners') ch().corners += 1; stickerPat(st.pat); persist(); grantCh(); dispatchEvent(new CustomEvent('kemy:xp', { detail: { n: 12 } })); import('../leaderboard.js').then((m) => m.recordScore('bingo', { r: earlier ? 'l' : 'w', pts: stars })).catch(() => {}); }
    winText = earlier ? 'You got BINGO too!' : (lucky ? 'Lucky Star win!' : 'You won this round!');
    winUntil = Date.now() + 4200; sfx.play('win');
  }
  function botBingo(st) {
    const humans = seats.filter((s) => Date.now() - s.at < FRESH).length || 1;
    const key = st.seed + ':' + st.pat + ':' + humans;
    if (botCache.key === key) return botCache.at;
    let best = 0;
    if (humans < 6) { const n = Math.min(6, 6 - humans); for (let i = 0; i < n; i++) { const c = bingoCall(st.seed, BOTS[i].id, 1, st.pat); if (c && (!best || c < best)) best = c; } }
    botCache = { key, at: best }; return best;
  }
  function syncCards(st) {
    const host = main.querySelector('[data-cards]'); if (!host) return;
    const sig = st.ck.round + ':' + st.cards.length;
    if (host.dataset.sig !== sig) {
      host.dataset.sig = sig; host.dataset.fresh = '1'; daubed = new Set([0]); frees = new Map();
      host.innerHTML = st.cards.map((card, ci) => `<div class="pb-card" data-ci="${ci}">${card.map((n, k) => `<button type="button" class="pb-cell${k === 12 ? ' free got' : ''}" data-k="${ci}:${k}">${k === 12 ? '★' : n}</button>`).join('')}</div>`).join('');
    }
    if (prog.auto) {
      let added = 0; const fresh = host.dataset.fresh === '1';
      st.cards.forEach((card) => card.forEach((n) => { if (n && st.called.has(n) && !daubed.has(n)) { daubed.add(n); added++; if (!fresh) stickerBall(n); } }));
      if (fresh) host.dataset.fresh = ''; else if (added) addDaubs(added);
    }
    if (st.ck.live) host.dataset.played = String(st.ck.round);
    host.querySelectorAll('.pb-card').forEach((cardEl) => {
      const ci = +cardEl.dataset.ci; const card = st.cards[ci]; const free = frees.has(ci) ? frees.get(ci) : -1;
      const miss = cardMiss(card, st.called, st.masks, free);
      cardEl.classList.toggle('one', miss === 1 && st.ck.live); cardEl.classList.toggle('win', miss === 0);
      cardEl.querySelectorAll('.pb-cell').forEach((cell, k) => {
        const on = k === free || (k !== 12 && daubed.has(card[k]));
        const was = cell.classList.contains('got');
        cell.classList.toggle('got', on || k === 12); cell.classList.toggle('star', k === free);
        if (on && !was) { cell.classList.remove('got'); void cell.offsetWidth; cell.classList.add('got'); }
      });
    });
  }
  function tick() {
    if (dead) return;
    tickN++;
    if (mode === 'lobby') { const cv = main.querySelector('.pb-hero'); if (cv && tickN % 2 === 0) { const prev = seats; seats = [{ id: uid, name: myName }, ...BOTS.slice(0, 4)]; drawRoom(cv, tickN, new Map([[uid, 'idle']])); seats = prev; } return; }
    const st = liveRound(); const face = main.querySelector('[data-face]');
    if (!st) { if (face) face.classList.remove('talk'); return; }
    if (st.ck.round !== botShown && st.ck.called === 0) { botShown = -1; if (paidRound !== st.ck.round) { /* new round */ } }
    if (seenBall !== st.ck.called) {
      if (seenBall >= 0 && st.ck.called > seenBall && st.ck.live) { chirp(); sfx.play('pop'); face && face.classList.add('talk'); setTimeout(() => face && face.classList.remove('talk'), 420); }
      seenBall = st.ck.called;
    }
    const ball = st.ck.called ? st.balls[st.ck.called - 1] : 0;
    const ballEl = main.querySelector('[data-ball]'); if (ballEl) ballEl.innerHTML = ball ? `<small>${letterOf(ball)}</small>${ball}` : '<small>…</small>•';
    const last = main.querySelector('[data-last]'); if (last) last.innerHTML = st.balls.slice(Math.max(0, st.ck.called - 5), st.ck.called).reverse().map((n) => `<b>${letterOf(n)}${n}</b>`).join('');
    const patEl = main.querySelector('[data-pat]'); if (patEl) patEl.innerHTML = `${PATTERN_NAME[st.pat]}${luckyRound(st.ck.round) ? ' · <span class="lucky">Lucky Star</span>' : ''}`;
    const timeEl = main.querySelector('[data-time]'); if (timeEl) { const s = Math.ceil(st.ck.left / 1000); timeEl.textContent = st.ck.live ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Next round soon'; }
    const codeEl = main.querySelector('[data-code]'); if (codeEl) codeEl.textContent = room && room.pub ? 'Public hall' : 'Code ' + roomId;
    const grid = main.querySelector('[data-grid]');
    if (grid && !grid.hidden && tickN % 4 === 0) {
      const cols = [[], [], [], [], []];
      for (let n = 1; n <= 75; n++) cols[Math.floor((n - 1) / 15)].push(n);
      grid.innerHTML = 'BINGO'.split('').map((L, i) => `<b>${L}${cols[i].map((n) => `<i class="${st.called.has(n) ? 'on' : ''}">${n}</i>`).join('')}</b>`).join('');
    }
    const peek = main.querySelector('[data-peek]');
    if (peek) { const show = peekUntil > Date.now() && st.ck.called < 75; peek.hidden = !show; if (show) { const n = st.balls[st.ck.called]; peek.textContent = 'Next ball: ' + letterOf(n) + n; } }
    const pow = main.querySelector('[data-pow]');
    if (pow && tickN % 8 === 0) pow.innerHTML = prog.powers.length ? prog.powers.map((id) => `<button type="button" data-pow="${id}">${POWNAME[id]}</button>`).join('') : '<span>Play to earn a power-up</span>';
    syncCards(st);
    const one = st.cards.some((card, ci) => cardMiss(card, st.called, st.masks, frees.has(ci) ? frees.get(ci) : -1) === 1);
    if (one && st.ck.live && st.ck.nextIn < 800 && drum < 3) { drum++; sfx.play('tick'); } if (!one) drum = 0;
    const botAt = botBingo(st);
    if (botAt && st.ck.called >= botAt && botShown !== st.ck.round) { botShown = st.ck.round; const who = BOTS[(botAt + st.ck.round) % BOTS.length]; float(who.name + ' called BINGO!'); sfx.play('star'); }
    const cardHost = main.querySelector('[data-cards]');
    if (!st.ck.live && cardHost && cardHost.dataset.played === String(st.ck.round) && paidRound !== st.ck.round && daubed.size > 1) { paidRound = st.ck.round; ch().rounds += 1; persist(); prize(3, 'for playing the round'); grantCh(); }
    const moods = new Map();
    const dancing = new Set();
    if (winUntil > Date.now()) dancing.add(uid);
    seats.forEach((s) => { if (s.claim && claimOk(st.seed, s.id, s.n || 1, st.pat, s.claim) && st.ck.called >= s.claim) dancing.add(s.id); });
    if (botShown === st.ck.round) BOTS.forEach((b) => dancing.add(b.id));
    roster().forEach((p) => {
      let m = 'idle';
      if (dancing.has(p.id) || (p.id === uid && winUntil > Date.now())) m = 'happy';
      else if (p.id === uid && missUntil > Date.now()) m = missUntil - Date.now() > 800 ? 'shake' : 'happy';
      else if (p.id === uid && one) m = 'hop';
      moods.set(p.id, m);
    });
    if (tickN % 2 === 0) drawRoom(main.querySelector('[data-hall]'), tickN, moods);
    const win = main.querySelector('[data-win]');
    if (win) { win.hidden = winUntil <= Date.now(); const t = win.querySelector('[data-wint]'); if (t) t.textContent = winText; if (!win.hidden && !win.dataset.fx) { win.dataset.fx = '1'; for (let i = 0; i < 14; i++) { const s = document.createElement('span'); s.textContent = i % 2 ? '⭐' : '🎱'; s.style.left = (10 + Math.random() * 80) + '%'; s.style.top = (30 + Math.random() * 30) + '%'; win.appendChild(s); } } if (win.hidden) delete win.dataset.fx; }
    breakNote();
    window.__pb = { ready: st.cards.some((card, ci) => cardMiss(card, st.called, st.masks, frees.has(ci) ? frees.get(ci) : -1) === 0), celeb: winUntil > Date.now(), called: st.ck.called, round: st.ck.round, pat: st.pat, bots: roster().filter((p) => String(p.id).startsWith('bot-')).length, seats: seats.length, room: roomId };
  }
  function breakNote() {
    const el = main.querySelector('[data-break]'); if (!el) return;
    if (!broke && Date.now() - session0 > 45 * 60 * 1000) broke = true;
    el.hidden = !broke;
  }
  const onPow = (e) => { const b = e.target.closest && e.target.closest('[data-pow]'); if (b && mode === 'hall') usePower(b.dataset.pow); };
  main.addEventListener('click', onPow);
  paintLobby();
  const loop = () => { if (dead) return; try { tick(); } catch (e) { console.warn('bingo', e); } };
  const iv = setInterval(loop, 200);
  const onHash = () => { if (!location.hash.startsWith('#/arcade/bingo')) stop(); };
  addEventListener('hashchange', onHash);
  function stop() { dead = true; clearInterval(iv); removeEventListener('hashchange', onHash); main.removeEventListener('click', onPow); dropSeat(); window.__pb = null; }
  return { destroy: stop };
}
