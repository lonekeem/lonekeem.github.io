// Lone Keem Studios - Scoreboards for every game (Firestore: leaderboard/{uid}_{game}, written by the
// player's own client at game end; rules bound every change). Overall board = game "all".
// Older online results are merged in from gameStats / palStats so earlier players show up too.
import { auth, db, STUDIO_UID } from './firebase-init.js';
import { faceName, adminNameClass, isAdminUid, ownerBadgeHtml } from './kemy-name.js';
import { doc, getDoc, getDocs, setDoc, writeBatch, collection, query, where, orderBy, limit, startAfter, serverTimestamp, getCountFromServer }
  from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

export const LB_GAMES = [
  { id: 'all', name: 'Overall Kemy', emoji: '🏆', unit: 'pts' },
  { id: 'chess', name: 'Chess', emoji: '♟️' }, { id: 'checkers', name: 'Checkers', emoji: '🔴' }, { id: 'pool', name: 'Star Pool', emoji: '🎱' },
  { id: 'starcards', name: 'Star Cards', emoji: '🃏' }, { id: 'ludo', name: 'Ludo', emoji: '🎲' }, { id: 'stardrop', name: 'Star Drop', emoji: '⭐' },
  { id: 'klgrid', name: 'KL Grid', emoji: '#️⃣' }, { id: 'trivia', name: 'Studio Trivia', emoji: '❓' },
  { id: 'quest', name: 'Bubble Quest', emoji: '🫧' }, { id: 'pals', name: 'Pal Games', emoji: '🐾' }
];
export const lbName = (g) => (LB_GAMES.find((x) => x.id === g) || { name: 'Game' }).name;
const MATCH = ['chess', 'checkers', 'pool', 'starcards', 'ludo', 'stardrop', 'klgrid', 'trivia', 'pals'];
const CAP = (g) => (g === 'quest' || g === 'all' ? 300 : 3);
export function weekId(d = new Date()) {   // ISO week, e.g. 2026-W43
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, '0')}`;
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const palSnap = (p) => (p ? { species: String(p.species || 'kemy').slice(0, 30), name: String(p.name || '').slice(0, 30), colors: p.colors || {}, pattern: p.pattern || 'none', acc: p.acc || 'none', level: Number(p.level) || 1 } : null);

// ------------------------------------------------------------- writing (at game end)
let palCache = null, palAt = 0, profCache = null;
async function me() {
  const u = auth.currentUser; if (!u) return null;
  if (!profCache || profCache.uid !== u.uid) { const s = await getDoc(doc(db, 'users', u.uid)); if (!s.exists()) return null; profCache = { uid: u.uid, ...s.data() }; }
  if (!palCache || Date.now() - palAt > 300000) { try { const { getActivePal } = await import('./pals/core.js'); palCache = palSnap(await getActivePal(db, u.uid)); palAt = Date.now(); } catch { palCache = null; } }
  return profCache;
}
const chain = { p: Promise.resolve() };
// r: 'w' | 'l' | 'd' for matches; pts = this game's points (trivia, Pal games); quest: { stars, levels } absolute totals.
export function recordScore(game, o = {}) { const job = chain.p.then(() => write(game, o)).catch((e) => { console.warn('scoreboard', e.code || e.message); return null; }); chain.p = job; return job; }
async function write(game, o) {
  const prof = await me(); if (!prof || !LB_GAMES.some((g) => g.id === game) || game === 'all') return null;
  const uid = prof.uid, wk = weekId();
  const ref = doc(db, 'leaderboard', `${uid}_${game}`), allRef = doc(db, 'leaderboard', `${uid}_all`);
  const [s, a] = await Promise.all([getDoc(ref), getDoc(allRef)]);
  const old = s.exists() ? s.data() : null, oa = a.exists() ? a.data() : null;
  const base = (x) => ({ uid, name: prof.displayName, uname: prof.username, color: String(prof.color || '').slice(0, 20), pal: palCache, updatedAt: serverTimestamp(),
    score: x ? x.score : 0, wins: x ? x.wins : 0, losses: x ? x.losses : 0, draws: x ? x.draws : 0, games: x ? x.games : 0, best: x ? x.best : 0, wk, wkScore: x && x.wk === wk ? x.wkScore : 0 });
  const n = { ...base(old), game };
  if (game === 'quest') {
    const stars = Math.max(0, Math.round(o.stars || 0)), lv = Math.max(0, Math.min(500, Math.round(o.levels || 0)));
    const target = Math.max(n.score, Math.min(n.score + (old ? CAP(game) : 3000), stars));
    n.best = Math.max(n.best, lv); n.games += 1;
    var delta = target - n.score; n.score = target;
  } else {
    const r = o.r === 'w' ? 'w' : o.r === 'd' ? 'd' : 'l'; var delta = r === 'w' ? 3 : r === 'd' ? 1 : 0;
    n[r === 'w' ? 'wins' : r === 'd' ? 'draws' : 'losses'] += 1; n.games += 1; n.score += delta;
    if (o.pts != null) n.best = Math.max(n.best, Math.max(0, Math.min(game === 'trivia' ? 50000 : 10000, Math.round(o.pts))));
  }
  n.wkScore += delta;
  const all = { ...base(oa), game: 'all' }; all.score += delta; all.wkScore += delta; all.games += 1;
  if (game !== 'quest') { const r = o.r === 'w' ? 'wins' : o.r === 'd' ? 'draws' : 'losses'; all[r] += 1; }
  all.best = Math.max(all.best, n.score);
  const b = writeBatch(db); b.set(ref, n);
  const wait = (x) => x && x.updatedAt && x.updatedAt.toMillis && Date.now() - x.updatedAt.toMillis() < 11000;
  if (wait(old) || wait(oa)) await new Promise((r) => setTimeout(r, 11500));
  b.set(allRef, all);
  await b.commit();
  return rankOf(game, n);
}
export async function rankOf(game, mine, week = false) {
  if (!mine) return null;
  const q = week ? query(collection(db, 'leaderboard'), where('game', '==', game), where('wk', '==', weekId()), where('wkScore', '>', mine.wkScore))
    : query(collection(db, 'leaderboard'), where('game', '==', game), where('score', '>', mine.score));
  try { return (await getCountFromServer(q)).data().count + 1; } catch { return null; }
}
// Shown on a game's end screen: "You ranked #12 in Chess" (appends to the open result modal, else a toast-like pill).
export function recordAndShow(game, o) {
  return recordScore(game, o).then((rank) => {
    if (!rank) return;
    const html = `<a class="lb-rank" href="${location.pathname.endsWith('kemy-quest.html') ? 'app.html' : ''}#/scores/${game}">🏆 You ranked <b>#${rank}</b> in ${esc(lbName(game))} · Scoreboard</a>`;
    const host = document.querySelector('.modal .g-result, .kq-clear, .modal');
    if (host) host.insertAdjacentHTML('beforeend', html);
    else { const d = document.createElement('div'); d.className = 'lb-rank-pill'; d.innerHTML = html; document.body.appendChild(d); setTimeout(() => d.remove(), 6000); }
  });
}

// ------------------------------------------------------------- Pal thumbnails (cached data URLs)
const thumbs = new Map(); let artP = null;
const artMod = () => (artP ||= import('./pals/art.js').catch((e) => { artP = null; throw e; }));
async function palThumb(pal) {
  if (!pal) return '';
  const k = JSON.stringify(pal); if (thumbs.has(k)) return thumbs.get(k);
  try {
    const drawPalFn = (await Promise.race([artMod(), new Promise((_, j) => setTimeout(() => j(new Error('slow')), 5000))])).drawPal;
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d');
    drawPalFn(c, 48, 92, 72, pal, { t: 0, mode: 'idle', face: 1 });
    const url = cv.toDataURL('image/png'); thumbs.set(k, url); return url;
  } catch { return ''; }   // egg for now; retried next render
}

// ------------------------------------------------------------- reading
const PAGE = 100;
async function topDocs(game, tab, after) {
  const c = collection(db, 'leaderboard');
  const q = tab === 'week' ? query(c, where('game', '==', game), where('wk', '==', weekId()), orderBy('wkScore', 'desc'), ...(after ? [startAfter(after)] : []), limit(PAGE))
    : query(c, where('game', '==', game), orderBy('score', 'desc'), ...(after ? [startAfter(after)] : []), limit(PAGE));
  const s = await getDocs(q); return { rows: s.docs.map((d) => d.data()), last: s.docs[s.docs.length - 1] || null, more: s.docs.length === PAGE };
}
async function legacy(game) {   // earlier online results (before scoreboards existed)
  try {
    if (game === 'pals') { const s = await getDocs(query(collection(db, 'palStats'), orderBy('wins', 'desc'), limit(PAGE))); return s.docs.map((d) => ({ uid: d.id, name: d.data().name, uname: d.data().uname, color: d.data().color, wins: d.data().wins || 0, games: d.data().games || 0, losses: Math.max(0, (d.data().games || 0) - (d.data().wins || 0)), draws: 0, score: 3 * (d.data().wins || 0), legacy: true })); }
    if (!MATCH.includes(game)) return [];
    const s = await getDocs(query(collection(db, 'gameStats'), orderBy(`${game}_w`, 'desc'), limit(PAGE)));
    return s.docs.map((d) => { const x = d.data(), w = x[game + '_w'] || 0, l = x[game + '_l'] || 0, dr = x[game + '_d'] || 0; return { uid: d.id, name: x.name, uname: x.uname, color: x.color, wins: w, losses: l, draws: dr, games: w + l + dr, score: 3 * w + dr, legacy: true }; }).filter((r) => r.games);
  } catch { return []; }
}
function merge(rows, old) {
  const m = new Map(rows.map((r) => [r.uid, r]));
  old.forEach((o) => { const r = m.get(o.uid); if (!r) m.set(o.uid, o); else if (o.score > r.score) m.set(o.uid, { ...r, wins: Math.max(r.wins, o.wins), losses: Math.max(r.losses, o.losses), draws: Math.max(r.draws, o.draws), games: Math.max(r.games, o.games), score: o.score }); });
  return [...m.values()].sort((a, b) => b.score - a.score || (b.wins || 0) - (a.wins || 0));
}
async function friendsDocs(game, uids) {
  const out = []; const list = [...uids].slice(0, 300);
  for (let i = 0; i < list.length; i += 30) { const s = await getDocs(query(collection(db, 'leaderboard'), where('game', '==', game), where('uid', 'in', list.slice(i, i + 30)))); s.docs.forEach((d) => out.push(d.data())); }
  return out;
}
function scoreText(game, r, tab) {
  const v = tab === 'week' ? r.wkScore : r.score;
  if (game === 'quest') return { big: `${v}★`, small: `Lv ${r.best || 0} reached` };
  if (game === 'all') return { big: `${v}`, small: `${r.games || 0} games` };
  const rate = r.games ? Math.round((100 * (r.wins || 0)) / r.games) : 0;
  return { big: tab === 'week' ? `${v} pts` : `${r.wins || 0} W`, small: tab === 'week' ? `this week` : `${rate}% wins · ${r.games || 0} played${game === 'trivia' && r.best ? ` · best ${r.best}` : game === 'pals' && r.best ? ` · best ${r.best}` : ''}` };
}
const EGG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><ellipse cx="24" cy="27" rx="14" ry="17" fill="#fff4d6" stroke="#e8c36a" stroke-width="2"/><path d="M14 26l5-3 5 4 5-4 5 3" fill="none" stroke="#e8c36a" stroke-width="2"/></svg>')}`;

export async function scoreboardPage(main, { game = 'all', tab = 'all', S, stale = () => false } = {}) {
  if (!LB_GAMES.some((g) => g.id === game)) game = 'all';
  if (!['all', 'week', 'friends'].includes(tab)) tab = 'all';
  const uid = auth.currentUser && auth.currentUser.uid;
  const link = (g, t) => `#/scores/${g}${t !== 'all' ? '?tab=' + t : ''}`;
  main.innerHTML = `<section class="lb-page">
    <div class="lb-head"><h1>🏆 Scoreboards</h1><a class="btn btn-sm btn-ghost" href="#/games">Games</a></div>
    <nav class="lb-games" aria-label="Game">${LB_GAMES.map((g) => `<a href="${link(g.id, tab)}" class="${g.id === game ? 'on' : ''}" ${g.id === game ? 'aria-current="page"' : ''}>${g.emoji} ${esc(g.name)}</a>`).join('')}</nav>
    <nav class="lb-tabs" aria-label="Time">${[['all', 'All-time'], ['week', 'This week'], ['friends', 'Friends']].map(([t, l]) => `<a href="${link(game, t)}" class="${t === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <p class="lb-how small">${esc(howScored(game))}</p>
    <ol class="lb-list" id="lb-list"><li class="lb-load"><div class="spinner"></div></li></ol>
    <button class="btn btn-sm btn-ghost lb-more" id="lb-more" hidden>Load more</button>
    <div class="lb-me" id="lb-me" hidden></div></section>`;
  const list = main.querySelector('#lb-list'), more = main.querySelector('#lb-more'), meBox = main.querySelector('#lb-me');
  let rows = [], last = null;
  const load = async () => {
    if (tab === 'friends') {
      if (!uid) { rows = null; return; }
      const ids = new Set([...(S && S.following ? S.following : []), uid]); rows = (await friendsDocs(game, ids)).sort((a, b) => b.score - a.score);
    } else {
      const t = await topDocs(game, tab); last = t.last; more.hidden = !t.more;
      rows = tab === 'all' ? merge(t.rows, await legacy(game)) : t.rows;
    }
  };
  const timed = (ms) => Promise.race([load(), new Promise((_, j) => setTimeout(() => j(Object.assign(new Error('timeout'), { code: 'timeout' })), ms))]);
  let err = null;
  for (const ms of [9000, 20000]) { try { await timed(ms); err = null; break; } catch (e) { err = e; if (stale()) return; } }
  if (err) { list.innerHTML = `<li class="lb-empty">Couldn’t load the scoreboard (${esc(err.code || err.message)}). <a href="#" id="lb-retry">Try again</a></li>`; list.querySelector('#lb-retry').onclick = (e) => { e.preventDefault(); scoreboardPage(main, { game, tab, S, stale }); }; return; }
  if (stale()) return;
  if (rows === null) { list.innerHTML = '<li class="lb-empty">Log in to see your friends’ scores.</li>'; return; }
  const render = async (from) => {
    const html = await Promise.all(rows.slice(from).map(async (r, i) => rowHtml(game, tab, r, from + i + 1, r.uid === uid)));
    if (from === 0) list.innerHTML = html.join('') || `<li class="lb-empty">No scores yet${tab === 'week' ? ' this week' : ''}. Play ${esc(game === 'all' ? 'any game' : lbName(game))} to get on the board!</li>`;
    else list.insertAdjacentHTML('beforeend', html.join(''));
  };
  await render(0);
  more.onclick = async () => { more.disabled = true; const t = await topDocs(game, tab, last); last = t.last; more.hidden = !t.more; more.disabled = false; const n = rows.length; const seen = new Set(rows.map((r) => r.uid)); rows = rows.concat(t.rows.filter((r) => !seen.has(r.uid))); await render(n); };
  list.onclick = (e) => { const li = e.target.closest('[data-u]'); if (li && li.dataset.u) location.hash = '#/u/' + li.dataset.u; };
  list.onkeydown = (e) => { if (e.key === 'Enter') list.onclick(e); };
  // Your own rank, pinned at the bottom.
  if (uid) {
    const i = rows.findIndex((r) => r.uid === uid); let mine = i >= 0 ? rows[i] : null, rank = i >= 0 ? i + 1 : null;
    if (!mine && tab !== 'friends') { const s = await getDoc(doc(db, 'leaderboard', `${uid}_${game}`)).catch(() => null); if (s && s.exists()) { mine = s.data(); if (tab !== 'week' || mine.wk === weekId()) rank = await rankOf(game, mine, tab === 'week'); else mine = null; } }
    meBox.hidden = false;
    meBox.innerHTML = mine ? `<ol class="lb-list mine">${await rowHtml(game, tab, mine, rank || '–', true)}</ol>` : `<p class="lb-empty small">You’re not on this board yet. Finish a game of ${esc(game === 'all' ? 'anything' : lbName(game))} to join!</p>`;
    meBox.onclick = list.onclick;
  }
}
async function rowHtml(game, tab, r, rank, mine) {
  const img = (await palThumb(r.pal)) || EGG; const t = scoreText(game, r, tab); const medal = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  return `<li class="lb-row ${medal} ${mine ? 'me' : ''}" data-u="${esc(r.uname || '')}" tabindex="0" role="link" aria-label="Rank ${rank}: ${esc(r.name)}, ${esc(t.big)}">
    <span class="lb-rank-n">${medal ? `<span class="lb-medal" aria-hidden="true">★</span>` : ''}${rank}</span>
    <span class="lb-who"><b class="${adminNameClass(r.uid)}">${esc(faceName(r.uid, r.name || 'Player'))}</b>${r.uid === STUDIO_UID || isAdminUid(r.uid) ? ownerBadgeHtml() : (window.kemyModBadge ? window.kemyModBadge(r.uid) : '')}<small>@${esc(r.uname || '')}${mine ? ' · you' : ''}</small></span>
    <img class="lb-pal" src="${img}" alt="${r.pal ? esc((r.pal.name || 'Pal') + ' the ' + r.pal.species) : 'No Pal yet (egg)'}" width="40" height="40" loading="lazy">
    <span class="lb-score"><b>${esc(t.big)}</b><small>${esc(t.small)}</small></span></li>`;
}
function howScored(game) {
  if (game === 'all') return 'Overall: every game adds up. Win = 3 pts, draw = 1, Bubble Quest = 1 pt per star.';
  if (game === 'quest') return 'Bubble Quest: total stars collected (your best per level). Also shows the highest level reached.';
  if (game === 'trivia') return 'Studio Trivia: ranked by points (win 3, draw 1). Shows wins, win rate and your best quiz score.';
  if (game === 'pals') return 'Pal Games: ranked by points (win 3, draw 1). Shows wins, win rate and your best round score.';
  return `${lbName(game)}: ranked by points (win 3, draw 1), vs friends or the computer. Shows wins and win rate.`;
}
