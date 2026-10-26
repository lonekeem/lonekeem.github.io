// Pal Games: real-time Pal vs Pal mini-games (Pal Race, Bubble Pop Battle, Star Catch, Dance-Off).
// Both players play the same seeded course; each writes its own progress ~2x a second (palGames/{id}/live/{uid})
// and the other's Pal is shown as a live ghost, interpolated. Wins go on the palStats leaderboard.
import { doc, getDoc, getDocs, setDoc, updateDoc, collection, query, orderBy, limit, onSnapshot, runTransaction, serverTimestamp, writeBatch, Timestamp, addDoc } from '../fsq.js';
import { createLink } from '../games/link.js';
import { codeFormHtml, codeBoxHtml, wireCodeForms, wireCopyCode, newRoomCode } from '../games/code-join.js';
import { PALS, faceSvg, normLevel, lastMode, saveMode, saveLevel, lastLevel, addBotRecord, whenOffer, offerHtml, COIN_BOT } from '../games/bots.js';
import { drawPal, drawBubble, star } from './art.js';
import { drawDancer } from './dance.js';
import { getActivePal } from './core.js';
export const PAL_GAMES = [
  { id: 'race', name: 'Pal Race', icon: '🏁', blurb: 'Tap to dash and hop over logs. Furthest Pal wins!' },
  { id: 'bubbles', name: 'Bubble Pop Battle', icon: '🫧', blurb: 'Pop more bubbles than your rival. Gold ones are worth 3!' },
  { id: 'stars', name: 'Star Catch', icon: '⭐', blurb: 'Slide your Pal to catch falling gold stars. Dodge the rain clouds!' },
  { id: 'dance', name: 'Pal Dance-Off', icon: '💃', blurb: 'Tap the lanes to the beat. Perfect taps score big!' }
];
const GAME = Object.fromEntries(PAL_GAMES.map((g) => [g.id, g]));
const DUR = 30; const W = 360, H = 480;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const snap = (p) => p ? { species: p.species, name: p.name, colors: p.colors, pattern: p.pattern, acc: p.acc, outfit: p.outfit || {}, level: p.level || 1 } : { species: 'kemy', name: 'Kemy', level: 1 };
// CPU score curves (final scores around these at "normal")
const SKILL = { easy: 0.38, medium: 0.62, hard: 0.82, expert: 0.94 };
// A bot walks the same seeded course and misses more when the level is lower.
export function palCurve(game, seed, level) {
  const skill = SKILL[normLevel(level)] || SKILL.medium;
  const R = rng((seed ^ 0x9e3779b9) >>> 0);
  const course = rng(seed >>> 0);
  const samples = [0];
  if (game === 'race') {
    const items = []; let x = 220;
    while (x < 4000) { items.push({ x, k: course() < 0.25 ? 'star' : 'log', done: false }); x += 110 + course() * 160; }
    let dist = 0, stars = 0, stun = 0;
    const speed = 2.4 + skill * 2.6;
    for (let s = 1; s <= 30; s++) {
      if (stun > 0) stun--; else dist += speed * 48;
      for (const it of items) {
        if (it.done) continue;
        const sx = it.x - dist + 80;
        if (sx > 110 || sx < 30) continue;
        it.done = true;
        if (it.k === 'log') { if (R() > skill) stun = 1; }
        else if (R() < 0.35 + skill * 0.6) stars++;
      }
      samples.push(Math.floor(dist / 50) + stars * 5);
    }
  } else if (game === 'bubbles') {
    let score = 0; const pops = [];
    for (let i = 0; i < 160; i++) { const at = i * 0.19 + course() * 0.1; const gold = course() < 0.12; if (R() < skill * (gold ? 1 : 0.85)) pops.push({ at: at + (1 - skill) * R() * 0.8, n: gold ? 3 : 1 }); }
    pops.sort((a, b) => a.at - b.at);
    let i = 0;
    for (let s = 1; s <= 30; s++) { while (i < pops.length && pops[i].at <= s) { score += pops[i].n; i++; } samples.push(score); }
  } else if (game === 'stars') {
    let score = 0; const hits = [];
    for (let i = 0; i < 120; i++) { const at = i * 0.25 + course() * 0.12; const cloud = course() < 0.15; const big = !cloud && course() < 0.15; const ok = cloud ? R() > skill : R() < skill; if (ok && !cloud) hits.push({ at, n: big ? 3 : 1 }); if (cloud && !ok) hits.push({ at, n: 0, stun: true }); }
    let stun = 0, i = 0;
    for (let s = 1; s <= 30; s++) {
      if (stun > 0) stun--;
      while (i < hits.length && hits[i].at <= s) { if (hits[i].stun) stun = 1; else if (!stun) score += hits[i].n; i++; }
      samples.push(score);
    }
  } else {
    let score = 0;
    for (let i = 0; i < 70; i++) {
      const at = 1.2 + i * 0.4;
      if (R() < skill) score += R() < skill ? 3 : 1;
      if (samples.length <= Math.ceil(at)) while (samples.length <= Math.min(30, Math.ceil(at))) samples.push(score);
    }
    while (samples.length <= 30) samples.push(score);
  }
  return (t) => {
    const x = Math.max(0, Math.min(30, t));
    const a = samples[Math.floor(x)] || 0, b = samples[Math.min(30, Math.ceil(x))] || a;
    return Math.floor(a + (b - a) * (x - Math.floor(x)));
  };
}
// ---------------------------------------------------------------- the four games on one canvas engine
export function playGame(host, game, seed, { pal, oppPal, opp, onTick, sound }) {
  return new Promise((resolve) => {
    const cv = document.createElement('canvas'); const d = Math.min(3, devicePixelRatio || 1); cv.width = W * d; cv.height = H * d; cv.className = 'pg-cv'; host.innerHTML = ''; host.appendChild(cv);
    const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); const R = rng(seed);
    let t0 = performance.now(), t = 0, score = 0, prog = 0, done = false, frame = 0, keyX = 0; const fx = [];
    const S = { x: W / 2, vy: 0, y: 0, dist: 0, speed: 3, stun: 0, items: [], next: 0, lanes: [0, 0, 0, 0], combo: 0, flash: ['', 0] };
    // pre-generate the course from the seed so both players get the same one
    if (game === 'race') { let x = 220; while (x < 4000) { S.items.push({ x, k: R() < 0.25 ? 'star' : 'log' }); x += 110 + R() * 160; } }
    if (game === 'bubbles') for (let i = 0; i < 160; i++) S.items.push({ at: i * 0.19 + R() * 0.1, x: 30 + R() * (W - 60), r: 16 + R() * 14, gold: R() < 0.12, v: 1.1 + R() * 1.1, y: H + 30, live: false, hit: false });
    if (game === 'stars') for (let i = 0; i < 120; i++) S.items.push({ at: i * 0.25 + R() * 0.12, x: 24 + R() * (W - 48), k: R() < 0.15 ? 'cloud' : R() < 0.15 ? 'big' : 'star', v: 2.2 + R() * 1.8, y: -20, live: false });
    if (game === 'dance') for (let i = 0; i < 70; i++) S.items.push({ at: 1.2 + i * 0.4 + (R() < 0.2 ? 0.2 : 0), lane: Math.floor(R() * 4), hit: false });
    const add = (n, x, y, col) => { score += n; fx.push({ x, y, txt: '+' + n, life: 40, col }); sound && sound(n >= 3 ? 'big' : 'pop'); };
    function tap(px, py) {
      if (done) return;
      if (game === 'race') { if (S.y === 0) S.vy = -9.5; S.speed = Math.min(7.5, S.speed + 0.9); sound && sound('jump'); }
      if (game === 'bubbles') for (const b of S.items) if (b.live && !b.hit && Math.hypot(b.x - px, b.y - py) < b.r + 10) { b.hit = true; add(b.gold ? 3 : 1, b.x, b.y, b.gold ? '#ffd34d' : '#9fe0ff'); break; }
      if (game === 'stars') keyX = px;
      if (game === 'dance') { const lane = Math.max(0, Math.min(3, Math.floor(px / (W / 4)))); hitLane(lane); }
    }
    function hitLane(lane) { S.lanes[lane] = 10; let best = null; for (const n of S.items) if (!n.hit && n.lane === lane) { const dt = Math.abs(n.at - t); if (dt < 0.22 && (!best || dt < Math.abs(best.at - t))) best = n; }
      if (best) { best.hit = true; const perfect = Math.abs(best.at - t) < 0.08; S.combo++; add(perfect ? 3 : 1, lane * (W / 4) + W / 8, H - 120, perfect ? '#ffd34d' : '#c9b8ff'); S.flash = [perfect ? 'Perfect!' : 'Good', 30]; } else { S.combo = 0; S.flash = ['Miss', 20]; } }
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    cv.addEventListener('pointerdown', (e) => { e.preventDefault(); const [x, y] = pt(e); tap(x, y); cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (game === 'stars' && e.buttons) keyX = pt(e)[0]; });
    const keys = {}; const kd = (e) => { if (!document.body.contains(cv)) return; keys[e.key] = true; const map = { d: 0, f: 1, j: 2, k: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
      if (game === 'dance' && e.key in map) { e.preventDefault(); hitLane(map[e.key]); } if (game === 'race' && (e.key === ' ' || e.key === 'ArrowUp')) { e.preventDefault(); tap(0, 0); } };
    const ku = (e) => { keys[e.key] = false; }; addEventListener('keydown', kd); addEventListener('keyup', ku);
    let lastTick = 0;
    const loop = (now) => {
      if (!document.body.contains(cv)) { removeEventListener('keydown', kd); removeEventListener('keyup', ku); return; }
      t = Math.min(DUR, (now - t0) / 1000); frame++;
      // gamepad
      const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      if (gp) { if (game === 'stars') keyX = S.x + gp.axes[0] * 40; if (game === 'race' && gp.buttons[0] && gp.buttons[0].pressed && !S.gpA) tap(0, 0); S.gpA = gp.buttons[0] && gp.buttons[0].pressed; }
      update(); draw();
      if (now - lastTick > 500 || t >= DUR) { lastTick = now; onTick && onTick(Math.round(prog), score, t >= DUR); }
      if (t >= DUR && !done) { done = true; removeEventListener('keydown', kd); removeEventListener('keyup', ku); setTimeout(() => resolve(score), 300); }
      if (!done || frame % 2 === 0) requestAnimationFrame(loop);
    };
    function update() {
      for (const f of fx) { f.y -= 1; f.life--; } while (fx.length && fx[0].life <= 0) fx.shift();
      if (game === 'race') {
        S.speed = Math.max(3, S.speed - 0.02); if (S.stun > 0) { S.stun--; } else S.dist += S.speed;
        S.vy += 0.6; S.y = Math.min(0, S.y + S.vy); if (S.y === 0) S.vy = 0;
        for (const it of S.items) { const sx = it.x - S.dist + 80; if (it.done || sx < 60 || sx > 100) continue;
          if (it.k === 'log' && S.y > -18) { it.done = true; S.stun = 36; S.speed = 3; sound && sound('bonk'); }
          if (it.k === 'star' && S.y < -10) { it.done = true; add(5, 80, H - 150, '#ffd34d'); } }
        score = Math.max(score, Math.floor(S.dist / 50) + S.items.filter((i) => i.k === 'star' && i.done).length * 5); prog = Math.min(1000, S.dist / 4);
      }
      if (game === 'bubbles') { for (const b of S.items) { if (!b.live && t >= b.at && b.y > 0) b.live = true; if (b.live && !b.hit) { b.y -= b.v; b.x += Math.sin((frame + b.at * 100) / 30) * 0.5; if (b.y < -40) b.live = false; } } prog = t / DUR * 1000; }
      if (game === 'stars') {
        if (keys.ArrowLeft || keys.a) keyX = S.x - 30; if (keys.ArrowRight || keys.d) keyX = S.x + 30;
        if (S.stun > 0) S.stun--; else S.x += Math.max(-7, Math.min(7, (keyX || S.x) - S.x) * 0.25); S.x = Math.max(24, Math.min(W - 24, S.x));
        for (const s of S.items) { if (!s.live && t >= s.at && s.y < 0) s.live = true; if (!s.live) continue; s.y += s.v;
          if (s.y > H - 110 && s.y < H - 60 && Math.abs(s.x - S.x) < 30) { s.live = false; s.y = H + 99; if (s.k === 'cloud') { S.stun = 50; sound && sound('bonk'); } else add(s.k === 'big' ? 3 : 1, s.x, H - 120, '#ffd34d'); }
          if (s.y > H) s.live = false; }
        prog = t / DUR * 1000;
      }
      if (game === 'dance') { for (let i = 0; i < 4; i++) S.lanes[i] = Math.max(0, S.lanes[i] - 1); if (S.flash[1] > 0) S.flash[1]--; prog = t / DUR * 1000; }
    }
    function draw() {
      const bg = { race: ['#bfe8ff', '#e6f9ff'], bubbles: ['#5aa8ff', '#9fe0ff'], stars: ['#2a1a6a', '#6b4fd6'], dance: ['#3a1458', '#8a2be2'] }[game];
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
      const o = opp ? opp() : null;
      if (game === 'race') {
        c.fillStyle = '#7fd08a'; c.fillRect(0, H - 110, W, 110); c.fillStyle = '#a8e6a0'; c.fillRect(0, H - 250, W, 20); c.fillStyle = '#6fc07a'; c.fillRect(0, H - 230, W, 4);
        for (const it of S.items) { const sx = it.x - S.dist + 80; if (sx < -30 || sx > W + 30 || it.done) continue;
          if (it.k === 'log') { c.fillStyle = '#a0683a'; c.beginPath(); c.roundRect(sx - 12, H - 128, 24, 18, 6); c.fill(); c.fillStyle = '#d8a070'; c.beginPath(); c.ellipse(sx + 10, H - 119, 4, 8, 0, 0, 7); c.fill(); }
          else { c.fillStyle = '#ffd34d'; star(c, sx, H - 165, 9); c.fill(); } }
        // opponent ghost on the back lane
        if (o && oppPal) { const ox = 80 + (o.p * 4 - S.dist) * 0.9; c.globalAlpha = 0.8; drawDancer(c, Math.max(-20, Math.min(W + 20, ox)), H - 236, 46, oppPal, { t: frame, mode: 'walk', face: 1 }); c.globalAlpha = 1; }
        drawDancer(c, 80, H - 110 + S.y, 64, pal, { t: frame, mode: S.stun ? 'shake' : 'walk', face: 1 });
        c.fillStyle = '#fff'; c.font = '700 13px Inter, sans-serif'; c.fillText(`${Math.floor(S.dist / 10)} m`, 12, 56);
      }
      if (game === 'bubbles') { for (const b of S.items) if (b.live && !b.hit) { drawBubble(c, b.x, b.y, b.r); if (b.gold) { c.fillStyle = 'rgba(255,211,77,.55)'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.8, 0, 7); c.fill(); } }
        drawDancer(c, W / 2, H - 14, 70, pal, { t: frame, mode: 'happy' }); }
      if (game === 'stars') { for (const s of S.items) if (s.live) { if (s.k === 'cloud') { c.fillStyle = '#8890a8'; for (const [dx, r] of [[-10, 10], [0, 13], [10, 10]]) { c.beginPath(); c.arc(s.x + dx, s.y, r, 0, 7); c.fill(); } c.fillStyle = '#9fd0ff'; c.fillRect(s.x - 6, s.y + 12, 2, 6); c.fillRect(s.x + 4, s.y + 14, 2, 6); } else { c.fillStyle = '#ffd34d'; star(c, s.x, s.y, s.k === 'big' ? 14 : 9); c.fill(); } }
        c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, H - 60, W, 60); drawDancer(c, S.x, H - 60, 62, pal, { t: frame, mode: S.stun ? 'shake' : 'happy' }); }
      if (game === 'dance') { const lw = W / 4; const cols = ['#ff6fae', '#5aa8ff', '#6fd39a', '#ffd34d'];
        for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(255,255,255,${0.06 + S.lanes[i] * 0.03})`; c.fillRect(i * lw + 2, 60, lw - 4, H - 60); }
        c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(0, H - 122, W, 4);
        for (const n of S.items) { if (n.hit) continue; const y = H - 120 - (n.at - t) * 260; if (y < 50 || y > H) continue; c.fillStyle = cols[n.lane]; c.beginPath(); c.arc(n.lane * lw + lw / 2, y, 16, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '700 14px sans-serif'; c.textAlign = 'center'; c.fillText(['◀', '▼', '▲', '▶'][n.lane], n.lane * lw + lw / 2, y + 5); c.textAlign = 'left'; }
        drawDancer(c, W / 2, H - 20, 72, pal, { t: frame, mode: S.lanes.some((x) => x > 0) ? 'happy' : 'hop' });
        if (S.flash[1] > 0) { c.fillStyle = '#fff'; c.font = '800 22px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(S.flash[0], W / 2, H / 2); c.textAlign = 'left'; } }
      for (const f of fx) { c.globalAlpha = f.life / 40; c.fillStyle = f.col; c.font = '800 18px Inter, sans-serif'; c.fillText(f.txt, f.x, f.y); } c.globalAlpha = 1;
      // HUD
      c.fillStyle = 'rgba(20,8,50,.55)'; c.fillRect(0, 0, W, 40); c.fillStyle = '#fff'; c.font = '800 16px Inter, sans-serif'; c.fillText(`You ${score}`, 12, 26);
      if (o) { c.textAlign = 'right'; c.fillText(`${o.name || 'Rival'} ${o.s}`, W - 12, 26); c.textAlign = 'left'; }
      c.fillStyle = '#ffd34d'; c.fillRect(0, 38, W * (1 - t / DUR), 3); c.textAlign = 'center'; c.fillText(String(Math.ceil(DUR - t)), W / 2, 26); c.textAlign = 'left';
    }
    requestAnimationFrame(loop);
  });
}
// ---------------------------------------------------------------- UI: lobby, CPU, online matches, leaderboard
export function createPalGames(ctx) {
  const { S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal } = ctx;
  wireCopyCode(toast);
  let AC = null; const sound = (k) => { try { AC = AC || new AudioContext(); const o = AC.createOscillator(), g = AC.createGain(); const f = { pop: 880, big: 1320, jump: 520, bonk: 160 }[k] || 600; o.type = k === 'bonk' ? 'square' : 'triangle'; o.frequency.setValueAtTime(f, AC.currentTime); o.frequency.exponentialRampToValueAtTime(f * (k === 'bonk' ? 0.6 : 1.6), AC.currentTime + 0.1); g.gain.setValueAtTime(0.08, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.14); o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.15); } catch {} };
  const me = () => S.user && S.user.uid;
  const reward = (win, cpu) => { dispatchEvent(new CustomEvent('kemy:xp', { detail: { n: win ? (cpu ? 12 : 30) : 10 } })); if (win) dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'win', n: cpu ? COIN_BOT : 25, why: cpu ? 'for beating a bot' : 'for winning' } })); };
  async function myPal() { if (!S.user) return snap(null); try { return snap(await getActivePal(db, S.user.uid)); } catch { return snap(null); } }
  async function lobby(params) {
    const sel = GAME[params.g] ? params.g : 'race';
    main.innerHTML = `<section class="card pad pal-box pg-lobby"><div class="pal-box-head"><h1>🎮 Pal Games</h1><a class="btn btn-sm" href="#/park">🌳 Pal Park</a><a class="btn btn-sm btn-ghost" href="#/games">All games</a></div>
      <p class="muted small">Your Pal competes in 30-second real-time mini-games. Play a friend, get a quick match, or practise against the computer. Wins give your Pal XP and Star Coins.</p>
      <div class="pg-cards">${PAL_GAMES.map((g) => `<button class="pg-card ${g.id === sel ? 'on' : ''}" data-g="${g.id}"><span class="pg-ic">${g.icon}</span><b>${esc(g.name)}</b><small>${esc(g.blurb)}</small></button>`).join('')}</div>
      <div class="g-modes" role="tablist" aria-label="How to play"><button type="button" data-m="cpu" aria-pressed="${lastMode() === 'cpu'}">Play vs Computer</button><button type="button" data-m="quick" aria-pressed="${lastMode() === 'online'}">Play Online (real players)</button><button type="button" data-m="friend" aria-pressed="${lastMode() === 'friend'}">Play a Friend</button></div>
      <form class="pg-friend" id="pg-friend" hidden><input id="pg-handle" placeholder="@friend’s handle (or leave empty for a link)" autocomplete="off"><button class="btn btn-sm" type="submit">Create game</button></form>
      ${codeFormHtml('pg-code', '🎟️ Join with code')}
      <h2 class="pal-sub">🏆 Top Pal players</h2><div id="pg-lb" class="card"><div class="spinner"></div></div></section>`;
    let g = sel; if (S.user) import('./game-emotes.js').then((m) => m.mountGameEmotes(main.firstElementChild, { db, uid: me(), toast })).catch(() => {});
    main.querySelectorAll('[data-g]').forEach((b) => b.onclick = () => { g = b.dataset.g; main.querySelectorAll('[data-g]').forEach((x) => x.classList.toggle('on', x === b)); });
    main.querySelector('[data-m=cpu]').onclick = () => { saveMode('cpu'); difficulty(g); };
    main.querySelector('[data-m=quick]').onclick = () => { saveMode('online'); quick(g); };
    main.querySelector('[data-m=friend]').onclick = () => { saveMode('friend'); if (!requireAuth()) return; const f = main.querySelector('#pg-friend'); f.hidden = false; f.querySelector('input').focus(); };
    main.querySelector('#pg-friend').onsubmit = async (e) => { e.preventDefault(); const h = main.querySelector('#pg-handle').value.trim().replace(/^@/, '').toLowerCase(); let inv = '';
      if (h) { const u = await getDoc(doc(db, 'usernames', h)).catch(() => null); if (!u || !u.exists()) return toast('No one with that handle'); inv = u.data().uid; }
      try { const gid = await create(g, { invitee: inv }); if (inv) await addDoc(collection(db, 'users', inv, 'notifications'), { type: 'game', fromUid: me(), fromName: S.profile.displayName, fromUsername: S.profile.username, postId: gid, text: `${GAME[g].name} (Pal Games)`, createdAt: serverTimestamp(), read: false }).catch(() => {});
        location.hash = '#/games/pals/' + gid; } catch (er) { toast(friendlyError(er)); } };
    wireCodeForms(main, { db, getDoc, doc, uid: () => (S.user ? S.user.uid : ''), toast, needAuth: () => requireAuth() });
    leaderboard();
  }
  async function leaderboard() {
    const box = main.querySelector('#pg-lb'); if (!box) return;
    try { const s = await getDocs(query(collection(db, 'palStats'), orderBy('wins', 'desc'), limit(10))); const rows = s.docs.map((d) => ({ uid: d.id, ...d.data() }));
      box.innerHTML = rows.length ? `<ol class="g-lb">${rows.map((r, i) => `<li class="${r.uid === me() ? 'me' : ''}"><b>${i + 1}</b> <a href="#/u/${esc(r.uname)}">${esc(r.name)}</a> <span class="muted small">@${esc(r.uname)}</span> <span class="pg-w">${r.wins} wins · ${r.games} played</span></li>`).join('')}</ol>` : '<div class="empty">No Pal Games wins yet. Be the first!</div>';
    } catch (e) { box.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
  }
  async function create(game, { invitee = '', quick = false } = {}) {
    const pal = await myPal();
    const data = { game, status: 'waiting', players: [me()], names: [S.profile.displayName], unames: [S.profile.username], pals: [pal], host: me(), invitee, quick, seed: Math.floor(Math.random() * 1e9), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    // short room code as the id so a friend can type it into "Join with code"
    for (let i = 0; i < 5; i++) {
      const code = newRoomCode(); const ref = doc(db, 'palGames', code);
      try { await runTransaction(db, async (tx) => { const [a, b] = [await tx.get(ref), await tx.get(doc(db, 'games', code))]; if (a.exists() || b.exists()) throw new Error('taken'); tx.set(ref, data); }); return code; }
      catch (e) { if (e.message !== 'taken') throw e; }
    }
    throw new Error('Couldn’t make a room code. Try again.');
  }
  async function join(gid) {
    const ref = doc(db, 'palGames', gid); const pal = await myPal();
    await runTransaction(db, async (tx) => { const s = await tx.get(ref); if (!s.exists()) throw new Error('That game is gone.'); const g = s.data(); if (g.players.includes(me())) return; if (g.status !== 'waiting') throw new Error('That game already started.');
      tx.update(ref, { players: [...g.players, me()], names: [...g.names, S.profile.displayName], unames: [...g.unames, S.profile.username], pals: [...g.pals, pal], status: 'active', startAt: Timestamp.fromMillis(Date.now() + 5000), updatedAt: serverTimestamp() }); });
  }
  async function quick(game) {
    if (!requireAuth()) return; const qref = doc(db, 'gameQueue', 'pal-' + game);
    try { const s = await getDoc(qref); const q = s.exists() ? s.data() : null;
      if (q && q.uid && q.uid !== me() && q.gid && Date.now() - (q.at && q.at.toMillis ? q.at.toMillis() : 0) < 90000) {
        try { await runTransaction(db, async (tx) => { const x = await tx.get(qref); if (!x.exists() || x.data().gid !== q.gid) throw new Error('moved'); tx.set(qref, { gid: '', uid: '', at: serverTimestamp() }); }); await join(q.gid); location.hash = '#/games/pals/' + q.gid; return; } catch {}
      }
      const gid = await create(game, { quick: true }); await setDoc(qref, { gid, uid: me(), at: serverTimestamp() }); location.hash = '#/games/pals/' + gid;
    } catch (e) { toast(friendlyError(e)); }
  }
  function difficulty(game) {
    main.innerHTML = `<section class="card pad pal-box pg-lobby"><div class="pal-box-head"><h1>${esc(GAME[game].name)}</h1><button class="btn btn-sm btn-ghost" id="pg-back" type="button">Back</button></div>
      <h2 class="pal-sub">Choose a bot</h2>
      <div class="g-pals" id="g-diff">${PALS.map((p) => `<button type="button" class="g-pal" data-lvl="${p.id}">${faceSvg(p.name, 64)}<b>${esc(p.name)}</b><i class="bot-tag">Bot</i><span>${esc(p.title)}</span><small>${esc(p.line)}</small></button>`).join('')}</div>
      <p class="muted small">Bot games give fewer Star Coins, and they stay off the online scoreboard.</p></section>`;
    main.querySelector('#pg-back').onclick = () => lobby({ g: game });
    main.querySelectorAll('[data-lvl]').forEach((b) => b.onclick = () => { saveLevel(b.dataset.lvl); cpu(game, b.dataset.lvl); });
  }
  async function cpu(game, level) {
    level = normLevel(level || lastLevel());
    const pal = await myPal();
    const bot = PALS.find((p) => p.id === level);
    const cpuPal = { species: { easy: 'puppy', medium: 'kitten', hard: 'fox', expert: 'dragon' }[level], level: 5, name: bot.name };
    main.innerHTML = `<section class="pg-play"><div class="pg-top"><b>${esc(GAME[game].name)}</b> vs ${faceSvg(bot.name, 28)} ${esc(bot.name)} <i class="bot-tag">Bot</i> <span class="muted small">${esc(bot.title)}</span></div><div class="pg-host"></div></section>`;
    const host = main.querySelector('.pg-host'); if (S.user) import('./game-emotes.js').then((m) => m.mountGameEmotes(host, { db, uid: me(), toast })).catch(() => {}); await countdown(host);
    const seed = Math.floor(Math.random() * 1e9);
    const curve = palCurve(game, seed, level);
    const start = performance.now();
    const opp = () => { const tt = Math.min(DUR, (performance.now() - start) / 1000); const s = curve(tt); return { p: Math.min(1000, (s / Math.max(1, curve(DUR))) * 1000), s, name: bot.name }; };
    const score = await playGame(host, game, seed, { pal, oppPal: cpuPal, opp, sound });
    const o = curve(DUR); const win = score > o; reward(win, true);
    addBotRecord('pals', score === o ? 'd' : win ? 'w' : 'l');
    result(game, score, o, bot.name, win, score === o, () => cpu(game, level), true);
  }
  function countdown(host) { return new Promise((r) => { let n = 3; host.innerHTML = `<div class="pg-count">3</div>`; const it = setInterval(() => { n--; const el = host.querySelector('.pg-count'); if (!el) { clearInterval(it); return; } if (n <= 0) { clearInterval(it); r(); } else el.textContent = n; }, 700); }); }
  function result(game, s, o, oname, win, draw, again, vsBot) {
    openModal(`<div class="g-result ${win ? 'win' : ''}"><h2>${draw ? 'Draw!' : win ? 'Your Pal wins! 🎉' : `${esc(oname)} wins!`}</h2><p>${esc(GAME[game].name)}: you ${s} · ${esc(oname)} ${o}</p><p class="small muted">${win ? 'Your Pal got XP and Star Coins!' : 'Your Pal got a little XP for playing.'}</p>
      <div class="btns"><button class="btn" id="pg-again">Play again</button><a class="btn btn-ghost" href="#/games/pals" data-close>Pal Games</a></div></div>`);
    document.querySelector('.modal .btns')?.insertAdjacentHTML('beforeend', '<a class="btn btn-ghost lb-btn" href="#/scores/pals" data-close>🏆 Scoreboard</a>');
    if (!vsBot && S.user && S.profile) import('../leaderboard.js').then((m) => m.recordAndShow('pals', { r: draw ? 'd' : win ? 'w' : 'l', pts: s })).catch(() => {});
    document.getElementById('pg-again').onclick = () => { closeModal(); again(); };
    document.querySelector('.modal a[href="#/games/pals"]')?.addEventListener('click', () => { if (location.hash === '#/games/pals') setTimeout(() => dispatchEvent(new HashChangeEvent('hashchange')), 0); });
  }
  // online match page
  async function match(gid) {
    if (!requireAuth()) return; let unsub = null, unsubL = null, started = false, g = null; const live = {}; const shown = {};
    const link = createLink(); const seen = {}; let ge = null;
    main.innerHTML = `<section class="pg-play"><div class="pg-top" id="pg-top">Loading…</div><span class="k-link-slot"></span><div class="pg-host"></div></section>`;
    link.mount(main.querySelector('.k-link-slot'));
    const host = main.querySelector('.pg-host'), top = main.querySelector('#pg-top');
    let stopped = false;
    const bind = () => {
      if (stopped) return;
      if (unsub) { unsub(); unsub = null; }
      if (unsubL) { unsubL(); unsubL = null; }
      unsub = onSnapshot(doc(db, 'palGames', gid), (s) => {
        if (!document.body.contains(host)) { stopWatch(); return; }
        const pending = !!(s.metadata && s.metadata.hasPendingWrites);
        if (s.exists() && !pending && s.data().updatedAt && s.data().updatedAt.toMillis) link.noteServer(s.data().updatedAt.toMillis());
        link.noteSnap(pending);
        g = s.data(); render();
      }, () => { link.fail(); if (!stopped) setTimeout(bind, 1200); });
      unsubL = onSnapshot(collection(db, 'palGames', gid, 'live'), (qs) => qs.docChanges().forEach((ch) => {
        const d = ch.doc.data(); live[ch.doc.id] = d;
        if (ch.doc.id !== me() && d.emAt && ge && d.emAt !== seen[ch.doc.id]) {
          const first = seen[ch.doc.id] === undefined; seen[ch.doc.id] = d.emAt;
          if (!first || Date.now() - d.emAt < 6000) ge.recv(ch.doc.id, d.em, g && g.names ? g.names[g.players.indexOf(ch.doc.id)] : '');
        }
      }), () => link.fail());
    };
    const wake = () => { if (stopped || document.visibilityState === 'hidden') return; link.setDown(false); bind(); };
    const stopWatch = () => {
      stopped = true;
      removeEventListener('hashchange', stopWatch);
      document.removeEventListener('visibilitychange', wake);
      document.removeEventListener('resume', wake);
      removeEventListener('online', wake);
      if (unsub) { unsub(); unsub = null; }
      if (unsubL) { unsubL(); unsubL = null; }
      link.stop();
    };
    addEventListener('hashchange', stopWatch);
    document.addEventListener('visibilitychange', wake);
    document.addEventListener('resume', wake);
    addEventListener('online', wake);
    try { const s = await getDoc(doc(db, 'palGames', gid)); if (!s.exists()) { top.textContent = 'That game doesn’t exist.'; stopWatch(); return; } g = s.data();
      if (!g.players.includes(me()) && g.status === 'waiting' && (!g.invitee || g.invitee === me())) await join(gid); } catch (e) { top.textContent = friendlyError(e); stopWatch(); return; }
    bind();
    function putHtml(el, sig, html) {
      if (!el || el.dataset.sig === sig) return false;
      el.dataset.sig = sig; el.innerHTML = html; return true;
    }
    function render() {
      if (!g) return; const other = g.players.find((u) => u !== me()); const oi = g.players.indexOf(other);
      if (g.status === 'waiting') { const link = location.href.split('#')[0] + '#/games/pals/' + gid;
        const topHtml = `<b>${esc(GAME[g.game].name)}</b> · waiting for ${g.invitee ? 'your friend' : 'a player'}…`;
        putHtml(top, topHtml, topHtml);
        const ready = !g.invitee && whenOffer(gid, () => render());
        const hostHtml = `<div class="pg-wait">${g.quick || g.invitee ? '' : codeBoxHtml(gid)}<div class="spinner"></div><p>Send this link to a friend:</p><input readonly value="${esc(link)}" onclick="this.select()"><button class="btn btn-sm" id="pg-copy">Copy link</button><p class="small muted">${g.quick ? 'Looking for a real player…' : 'Waiting for your friend…'}</p>${ready ? offerHtml() : ''}</div>`;
        if (putHtml(host, hostHtml, hostHtml)) {
          host.querySelector('#pg-copy').onclick = () => navigator.clipboard && navigator.clipboard.writeText(link).then(() => toast('Link copied'));
          const yes = host.querySelector('[data-bot-yes]'); if (yes) yes.onclick = () => { updateDoc(doc(db, 'palGames', gid), { status: 'done', updatedAt: serverTimestamp() }).catch(() => {}); if (g.quick) setDoc(doc(db, 'gameQueue', 'pal-' + g.game), { gid: '', uid: '', at: serverTimestamp() }).catch(() => {}); difficulty(g.game); };
        }
        return; }
      if (g.status === 'active' && !started && g.players.includes(me())) {
        started = true;
        const topHtml = `<b>${esc(GAME[g.game].name)}</b> · you vs ${esc(g.names[oi])}${(window.kemyModBadge ? window.kemyModBadge(other) : '')}`;
        putHtml(top, 'active:' + topHtml, topHtml);
        go(other, oi);
      }
      if (!g.players.includes(me())) {
        const full = `${esc(g.names.join(' vs '))} · this match is full`;
        putHtml(top, full, full);
      }
    }
    async function go(other, oi) {
      const goAt = () => (g.startAt && g.startAt.toMillis ? g.startAt.toMillis() : link.serverNow());
      const wait = Math.max(0, goAt() - link.serverNow()); host.innerHTML = `<div class="pg-count">${Math.ceil(wait / 1000) || 'Go!'}</div>`;
      const cdi = setInterval(() => { const el = host.querySelector('.pg-count'); const left = Math.ceil((goAt() - link.serverNow()) / 1000); if (el) el.textContent = left > 0 ? left : 'Go!'; }, 250);
      await new Promise((r) => setTimeout(r, wait)); clearInterval(cdi);
      const lref = doc(db, 'palGames', gid, 'live', me()); let lastW = 0, pending = null, best = 0;
      // Pal emotes ride along in the live doc (em/emAt), sent with the next progress write (rules keep the ~2/s limit)
      let emF = {};
      import('./game-emotes.js').then((m) => { ge = m.mountGameEmotes(host, { db, uid: me(), toast, send: async (code) => { emF = { em: code, emAt: Date.now() }; } }); }).catch(() => {});
      const send = (p, s, fin) => {
        best = Math.max(best, s); const now = Date.now();
        const data = { p: Math.max(0, Math.min(1000, p | 0)), s: Math.min(999, best), fin: !!fin, at: serverTimestamp(), ...emF };
        if (!fin && now - lastW < 220) return;
        lastW = now; link.markWrite();
        const t0 = performance.now();
        setDoc(lref, data).then(() => link.noteRtt(performance.now() - t0), () => link.fail());
      };
      const opp = () => { const L = live[other] || { p: 0, s: 0 }; const cur = shown[other] || { p: 0, s: 0 }; cur.p += (L.p - cur.p) * 0.15; cur.s = L.s; shown[other] = cur; return { p: cur.p, s: cur.s, name: g.names[oi] }; };
      const score = await playGame(host, g.game, g.seed, { pal: g.pals[g.players.indexOf(me())], oppPal: g.pals[oi], opp, onTick: (p, s) => send(p, s, false), sound });
      await new Promise((r) => setTimeout(r, 500)); await setDoc(lref, { p: 1000, s: Math.min(999, score), fin: true, at: serverTimestamp(), ...emF }).catch(() => {});
      host.innerHTML = '<div class="pg-wait"><div class="spinner"></div><p>Waiting for your rival to finish…</p></div>';
      const t0 = Date.now(); while (!(live[other] && live[other].fin) && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 400));
      const os = live[other] ? live[other].s : 0; const theyFinished = !!(live[other] && live[other].fin); const win = score > os;
      if (theyFinished) { try { const ps = await getDoc(doc(db, 'palStats', me())); const cur = ps.exists() ? ps.data() : { wins: 0, games: 0 }; const b = writeBatch(db);
        b.set(doc(db, 'palStats', me()), { wins: (cur.wins || 0) + (win ? 1 : 0), games: (cur.games || 0) + 1, last: gid, name: S.profile.displayName, uname: S.profile.username, color: S.profile.color || '', updatedAt: serverTimestamp() });
        b.set(doc(db, 'palGames', gid, 'rec', me()), { at: serverTimestamp() }); await b.commit(); } catch (e) { console.warn('palStats', e.code || e.message); } }
      updateDoc(doc(db, 'palGames', gid), { status: 'done', updatedAt: serverTimestamp() }).catch(() => {});
      reward(win, false); result(g.game, score, os, g.names[oi], win, score === os, () => { location.hash = '#/games/pals?g=' + g.game; });
      host.innerHTML = `<div class="pg-wait"><p>${win ? '🏆 You won!' : score === os ? 'Draw!' : 'Good game!'} ${score} – ${os}</p><a class="btn" href="#/games/pals?g=${g.game}">Play again</a></div>`;
    }
  }
  async function page(b, params) { if (b && b !== 'cpu') return match(b); return lobby(params || {}); }
  return { page, playGame };
}
