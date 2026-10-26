// Lone Keem Studios Games: hub, routing and the two-player board games (Star Drop, KL Grid,
// Checkers) online and against the computer. Trivia and Star Cards live in trivia.js / starcards.js.
import { recordAndShow } from '../leaderboard.js';
import { faceName, adminNameClass, isAdminUid, ownerBadgeHtml } from '../kemy-name.js';
import { STUDIO_UID } from '../firebase-init.js';
import { ENGINES } from './boards.js';
import { createNet, BOARD_TYPES, EMOTES, TURN_SECONDS, tsMs, isBot } from './net.js';
import { sfx } from './sfx.js';
import { CONTROLLER, STAR, COVERS, GAMES, gameName } from './art.js';
import { createTrivia } from './trivia.js';
import { createStarCards } from './starcards.js';
import { createPool } from './pool.js';
import { createChess } from './chess.js';
import { createLudo, heroArt as ludoArt } from './ludo.js';
import { lastMode, saveMode, lastLevel, saveLevel, PALS, faceSvg, ask, whenOffer, offerHtml, stopOffer, addBotRecord, botRecords, onlyBots, normLevel, COIN_ONLINE, COIN_BOT } from './bots.js';
import { bindProfiles, syncPlates } from './plates.js';
import { codeFormHtml, codeBoxHtml, wireCodeForms, wireCopyCode } from './code-join.js';

export { CONTROLLER };

export function createGames(ctx) {
  const { S, db, main, esc, $, avatar, toast, friendlyError, requireAuth, openModal, closeModal, stale } = ctx;
  wireCopyCode(toast);
  const joinCodes = (root, needAuth) => wireCodeForms(root, { db, getDoc: (r) => net.fs.getDoc(r), doc: (...a) => net.fs.doc(...a), uid: () => (S.user ? S.user.uid : ''), toast, needAuth: needAuth ? () => requireAuth() : null });
  bindProfiles(ctx.getProfile);
  if (!document.getElementById('games-css')) {
    const l = document.createElement('link'); l.id = 'games-css'; l.rel = 'stylesheet'; l.href = 'css/games.css?v=9'; document.head.appendChild(l);
  }
  const net = createNet({ db, S });
  const signedIn = () => !!(S.user && S.profile);
  const myUid = () => (S.user ? S.user.uid : '');
  const link = (gid) => `${location.origin}${location.pathname}#game/${gid}`;
  const cpuRec = () => botRecords();
  const addCpuResult = (type, r) => addBotRecord(type, r);
  const qs = (s) => Object.fromEntries(new URLSearchParams(s || ''));
  const chip = (p, extra = '') => {
    const bot = isBot(p.uid) || p.bot;
    const face = bot ? `<span class="avatar sm gp-bot" style="--c:#3b2466" aria-hidden="true">${faceSvg(p.name, 28)}</span>` : (p.uid && p.uname ? avatar({ uid: p.uid, displayName: p.name, username: p.uname, color: p.color }, 'sm', false) : `<span class="avatar sm gp-bot" style="--c:#3b2466" aria-hidden="true">${CONTROLLER}</span>`);
    return `<div class="gp ${extra}">${face}<span class="gp-n">${esc(p.name)}${bot ? '<i class="bot-tag">Bot</i>' : (p.uid ? (window.kemyModBadge ? window.kemyModBadge(p.uid) : '') : '')}</span></div>`;
  };
  const gearBtn = () => `<a class="g-icon g-gear" href="#/settings" aria-label="Settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></a>`;
  const muteBtn = () => `<button class="g-icon" data-g="mute" aria-pressed="${sfx.muted}" aria-label="${sfx.muted ? 'Turn sound on' : 'Mute sound'}">${sfx.muted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.2L12 5.6v12.8l-4.8-3.9H4z"/><path d="M15.6 9a4.2 4.2 0 0 1 0 6M18.4 6.4a8 8 0 0 1 0 11.2"/></svg>'}</button>`;
  function wireMute(root) {
    root.querySelectorAll('[data-g=mute]').forEach((b) => b.onclick = () => {
      sfx.muted = !sfx.muted; b.outerHTML = muteBtn(); wireMute(root); if (!sfx.muted) sfx.play('tap');
    });
  }
  function shell(title, body, back = '#/games') {
    main.innerHTML = `<section class="gm-wrap">
      <nav class="g-top-pick" aria-label="Where to play" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 12px"><a class="g-qbtn" href="#/park" style="flex-direction:column;padding:12px 6px;font-weight:700">🌳<span>Pal Park</span></a><a class="g-qbtn" href="#/arcade" style="flex-direction:column;padding:12px 6px;font-weight:700">🕹️<span>Arcade</span></a><a class="g-qbtn" href="#g-all" data-jump-all style="flex-direction:column;padding:12px 6px;font-weight:700">🎲<span>All games</span></a></nav>
      <div class="gm-bar"><a class="g-icon" href="${back}" aria-label="Back">←</a><h1>${title}</h1><div class="g-tools"><span class="k-link-slot"></span>${muteBtn()}${gearBtn()}</div></div>${body}</section>`;
    wireMute(main);
    main.querySelector('[data-jump-all]')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('g-all')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    net.link.mount(main.querySelector('.k-link-slot'));
  }
  function burst(host, n = 14) {
    if (!host) return;
    const box = document.createElement('div'); box.className = 'g-burst';
    for (let i = 0; i < n; i++) { const s = document.createElement('span'); s.innerHTML = STAR(); s.style.setProperty('--a', `${(360 / n) * i}deg`); s.style.setProperty('--d', `${60 + Math.random() * 70}px`); box.appendChild(s); }
    host.appendChild(box); setTimeout(() => box.remove(), 1200);
  }
  function floatEmote(host, e, who) {
    if (!host) return;
    const el = document.createElement('div'); el.className = 'g-float' + (e === 6 ? ' is-star' : '');
    el.innerHTML = e === 6 ? `${STAR()}<small>${esc(who)}</small>` : `<b>${esc(EMOTES[e] || '')}</b><small>${esc(who)}</small>`;
    el.style.left = `${15 + Math.random() * 60}%`;
    host.appendChild(el); setTimeout(() => el.remove(), 2600);
    sfx.play(e === 6 ? 'star' : 'pop');
  }
  const emoteBar = () => `<div class="g-emotes" role="group" aria-label="Quick chat"><button data-ew class="ge-in" aria-label="Emote wheel: your Pal dances">😊</button>${EMOTES.map((t, i) => `<button data-e="${i}" class="${i === 6 ? 'em-star' : ''}" aria-label="${i === 6 ? 'Send a gold star' : esc(t)}">${i === 6 ? STAR() : esc(t)}</button>`).join('')}</div>`;
  function wireEmotes(root, gid, names) {
    const host = root.querySelector('.g-fx');
    const local = !gid;
    root.querySelectorAll('.g-emotes [data-e]').forEach((b) => b.onclick = async () => {
      const e = +b.dataset.e;
      floatEmote(host, e, 'You');
      if (local) return;
      if (!signedIn()) { requireAuth(); return; }
      b.disabled = true; setTimeout(() => (b.disabled = false), 1500);
      try { await net.sendEmote(gid, e); } catch (err) { toast(friendlyError(err)); }
    });
    // Pal emote wheel + avatar cards (js/pals/game-emotes.js): emote codes >= 100 ride the same chat channel
    let ge = null; const bar = root.querySelector('.g-emotes'); const ewb = root.querySelector('.g-emotes [data-ew]');
    if (bar && ewb) import('../pals/game-emotes.js').then((m) => { ge = m.mountGameEmotes(bar, { db, uid: signedIn() ? myUid() : '', button: ewb, requireAuth, toast, send: local ? null : (code) => net.sendEmote(gid, code) }); }).catch(() => { ewb.hidden = true; });
    if (gid) S.unsubs.push(net.watchChat(gid, (m) => { if (m.uid === myUid()) return; if (m.e >= 100) { ge && ge.recv(m.uid, m.e, names(m.uid) || 'Player'); return; } floatEmote(host, m.e, names(m.uid)); }));
  }
  let curType = '', curPlayers = null, curGid = '';
  // A friend tapped Rematch on a game we just finished together: follow them into the new room
  // (only when the rematch shows up while we're watching, not when reopening an old game).
  function rematchFollower(gid) {
    let seen = null;
    return (g, isPlayer) => {
      const was = seen; seen = g.rematch || '';
      if (was === null || was || !seen || !isPlayer || g.status !== 'done') return;
      const here = '#/game/' + gid; // the player who tapped Rematch has already moved on by then
      setTimeout(() => { if (location.hash.split('?')[0] === here) { closeModal(); toast('Rematch! Joining the new game…'); location.hash = '#/game/' + seen; } }, 1500);
    };
  }
  // html/cls (optional): a game can draw its own celebration (chess win screen); rewards stay on this path.
  function resultModal({ title, sub, win, buttons, pts, spectator, vsBot, noReward, html, cls }) {
    openModal(`<div class="g-result ${win ? 'win' : ''} ${cls || ''}">${html != null ? html : `<div class="g-result-star">${STAR()}</div><h2>${esc(title)}</h2><p>${esc(sub || '')}</p>`}
      <div class="btns">${buttons.map((b, i) => `<${b.href ? 'a' : 'button'} class="btn ${i ? 'btn-ghost' : ''}" ${b.href ? `href="${b.href}" data-close` : `data-i="${i}"`}>${esc(b.label)}</${b.href ? 'a' : 'button'}>`).join('')}</div></div>`);
    const m = document.querySelector('.modal');
    buttons.forEach((b, i) => { if (b.onClick) { const el = m.querySelector(`[data-i="${i}"]`); if (el) el.onclick = () => { closeModal(); b.onClick(); }; } });
    const lbBtn = document.createElement('a'); lbBtn.className = 'btn btn-ghost lb-btn'; lbBtn.href = '#/scores/' + (curType || 'all'); lbBtn.textContent = '🏆 Scoreboard'; lbBtn.dataset.close = ''; m.querySelector('.btns')?.appendChild(lbBtn);
    if (!vsBot && !noReward && curType && signedIn() && !spectator && !/^Game cancelled/i.test(title)) {
      // the seat list is from when the page opened: a friend who joined from the link wasn't in it yet, so check the game again
      const r = win ? 'w' : /^Draw/i.test(title) ? 'd' : 'l', type = curType;
      const known = !curPlayers || curPlayers.includes(myUid());
      const seated = known || !curGid ? Promise.resolve(known)
        : net.fs.getDoc(net.fs.doc(db, 'games', curGid)).then((s) => s.exists() && [...(s.data().players || []), ...(s.data().left || [])].includes(myUid())).catch(() => false);
      seated.then((ok) => { if (ok) recordAndShow(type, { r, pts }); });
    }
    if (win) { burst(m, 18); sfx.play('win'); if (!noReward) dispatchEvent(new CustomEvent('kemy:xp', { detail: { n: vsBot ? 12 : 25 } })); if (!noReward) dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'win', n: vsBot ? COIN_BOT : COIN_ONLINE, why: vsBot ? 'for beating a bot' : 'for winning' } })); } else sfx.play(title.startsWith('Draw') ? 'tap' : 'lose');
  }
  const ui = { shell, chip, rematchFollower, emoteBar, wireEmotes, burst, floatEmote, resultModal, link, net, signedIn, myUid, addCpuResult, sfx, STAR, CONTROLLER, wireMute, muteBtn };
  const trivia = createTrivia({ ...ctx, ui });
  const cards = createStarCards({ ...ctx, ui });
  const pool = createPool({ ...ctx, ui });
  const chess = createChess({ ...ctx, ui });
  const ludo = createLudo({ ...ctx, ui });

  // ------------------------------------------------------------ hub
  async function hub(token) {
    const rec = cpuRec();
    main.innerHTML = `<section class="gm-wrap">
      <a class="wn-hub" href="#/updates"><span aria-hidden="true">✨</span><span><b>What's New</b><small>See everything new in Kemy</small></span><span class="wn-dot" data-wn-dot hidden></span></a>
      <a class="sk-hub" href="#/share"><span class="sk-hub-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4h6.2v6.2H4zM13.8 4H20v6.2h-6.2zM4 13.8h6.2V20H4z"/><path d="M14.2 14.2h2v2h-2zM17.8 14.2h2v2h-2zM14.2 17.8h2v2h-2zM17.8 17.8h2v2h-2z" fill="currentColor" stroke="none"/></svg></span><span><b>Share Kemy</b><small>QR code to get the app. 10+ free games, no ads.</small></span></a>
      <a class="zf-hero ks-hero" href="#/street" aria-label="Visit Kemy Street: a Halloween trick-or-treat neighborhood in Pal Park" style="background:radial-gradient(120% 90% at 85% 15%,#7a4fb0 0,#3b2470 45%,#140c2e 100%);border-color:rgba(255,138,31,.6)"><span class="zf-badge">🎃 New World · Kemy Street</span><svg class="zf-zom" viewBox="0 0 120 130" aria-hidden="true"><circle cx="92" cy="22" r="12" fill="#fff8e1"/><path d="M14 72 L42 50 L70 72 V118 H14Z" fill="#f3d1dc"/><path d="M8 74 L42 44 L76 74" fill="none" stroke="#5b3a7a" stroke-width="8" stroke-linejoin="round"/><rect x="34" y="92" width="14" height="26" rx="2" fill="#8a3ffc"/><rect x="20" y="80" width="10" height="9" fill="#ffd27a"/><rect x="54" y="80" width="10" height="9" fill="#ffd27a"/><g><ellipse cx="92" cy="108" rx="20" ry="16" fill="#ff8a1f"/><path d="M84 102 l4 -6 l4 6z M96 102 l4 -6 l4 6z" fill="#ffe08a"/><path d="M82 110 q10 9 20 0" stroke="#ffe08a" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="90" y="88" width="4" height="7" fill="#4d7c0f"/></g></svg>
        <span class="zf-txt"><b>Kemy Street</b><small>Trick-or-treat a big friendly neighborhood: knock on doors for candy + Star Coins, ride past the cartoon cars, hang out with up to 30 friends. Walk there from Pal Park too!</small><span class="zf-play" style="background:#ff8a1f;color:#2b1d55">▶ Visit</span></span></a>
      <nav class="ks-worlds" aria-label="Pick a world" style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><a class="g-qbtn" href="#/park" style="flex:1">🌳 Pal Park</a><a class="g-qbtn" href="#/street" style="flex:1">🎃 Kemy Street</a><span class="g-qbtn" style="flex:1;opacity:.6" aria-disabled="true">✨ More worlds soon</span></nav>
      <a class="pk-hero" href="#/park" aria-label="Enter Pal Park: walk, play and hang out with friends in 3D"><span class="zf-badge">🌳 Featured · Pal Park 3D</span><svg class="pk-art" viewBox="0 0 200 120" aria-hidden="true"><defs><linearGradient id="pkS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa8ff"/><stop offset="1" stop-color="#c9ecff"/></linearGradient></defs><rect width="200" height="120" rx="14" fill="url(#pkS)"/><circle cx="168" cy="22" r="11" fill="#fff3b0"/><g fill="#fff"><ellipse cx="46" cy="24" rx="16" ry="7"/><ellipse cx="58" cy="20" rx="11" ry="8"/><ellipse cx="128" cy="30" rx="13" ry="5"/></g><path d="M0 74 Q50 56 100 70 T200 64 V120 H0Z" fill="#7cc044"/><path d="M0 88 Q60 76 120 90 T200 86 V120 H0Z" fill="#5fae3c"/><path d="M84 120 Q96 96 104 84 L112 84 Q112 98 132 120Z" fill="#e3c799"/><g><rect x="22" y="60" width="4" height="16" fill="#7a4a28"/><circle cx="24" cy="54" r="12" fill="#3f9a3c"/><rect x="172" y="56" width="4" height="18" fill="#7a4a28"/><path d="M174 30 L188 60 H160Z" fill="#2f7d3a"/><rect x="146" y="66" width="3" height="12" fill="#7a4a28"/><circle cx="147" cy="62" r="8" fill="#5fb84a"/></g><ellipse cx="62" cy="92" rx="20" ry="5" fill="#8fd8ff" stroke="#e2d9c8" stroke-width="2"/><path d="M62 90 V78 M62 78 q-6 -6 -10 2 M62 78 q6 -6 10 2" stroke="#e8f8ff" stroke-width="2" fill="none"/><g><circle cx="140" cy="96" r="3" fill="#ff6fae"/><circle cx="150" cy="100" r="3" fill="#ffd447"/><circle cx="30" cy="98" r="3" fill="#b26bff"/><circle cx="40" cy="104" r="3" fill="#fff"/></g><g class="pk-bf"><path d="M120 46 l-6 -5 l1 7z M120 46 l6 -5 l-1 7z" fill="#ff7ab8"/></g><g><ellipse cx="108" cy="98" rx="10" ry="11" fill="#b98cff"/><circle cx="104" cy="95" r="2" fill="#2b1d55"/><circle cx="112" cy="95" r="2" fill="#2b1d55"/><path d="M104 101 q4 3 8 0" stroke="#2b1d55" stroke-width="1.6" fill="none"/><ellipse cx="100" cy="86" rx="3" ry="5" fill="#b98cff"/><ellipse cx="116" cy="86" rx="3" ry="5" fill="#b98cff"/></g></svg><span class="zf-txt"><b>Pal Park</b><small>Walk your Pal around a sunny 3D park with friends: chat, dance, find treasures and jump into mini-games.</small><span class="zf-play pk-play">▶ Play</span></span></a>
      <a class="cs-hero" href="#/arcade/show" aria-label="Play the Kemy Challenge Show"><span class="zf-badge">🆕 New · up to 30 players</span><svg class="cs-sun" viewBox="0 0 120 150" aria-hidden="true"><rect x="55" y="70" width="10" height="80" rx="5" fill="#4caf50"/><ellipse cx="38" cy="112" rx="18" ry="7" fill="#5cc85c" transform="rotate(-25 38 112)"/><g fill="#ffd23f" stroke="#e7a92b" stroke-width="2">${Array.from({ length: 14 }, (_, i) => `<ellipse cx="60" cy="22" rx="9" ry="20" transform="rotate(${i * 360 / 14} 60 60)"/>`).join('')}</g><circle cx="60" cy="60" r="27" fill="#b07a3e"/><circle cx="50" cy="55" r="6" fill="#7dffb0"/><circle cx="70" cy="55" r="6" fill="#7dffb0"/><path d="M48 70 Q60 80 72 70" stroke="#3a2010" stroke-width="4" fill="none" stroke-linecap="round"/></svg>
        <span class="zf-txt"><b>Kemy Challenge Show</b><small>Freeze Dash 🌻 · Cookie Carve 🍪 · Tug Splash 🪢 · Bubble Bridge 🫧 · Bumper Summit 👑. Last Pal standing wins!</small><span class="zf-play cs-play">▶ Play</span></span></a>
      <a class="zf-hero" href="#/arcade/zombie" aria-label="Play Pal Zombie Survival"><span class="zf-badge">⭐ Featured Game</span><svg class="zf-zom" viewBox="0 0 120 130" aria-hidden="true"><g stroke="#1d3b14" stroke-width="3" stroke-linejoin="round"><path d="M10 70 L48 64 L48 76 L12 82Z" fill="#8fd16a"/><ellipse cx="62" cy="96" rx="30" ry="30" fill="#7cc35a"/><rect x="40" y="88" width="44" height="34" rx="10" fill="#6a4fc4"/><path d="M50 92 l10 0 M70 104 l10 0" stroke="#a99be8"/><circle cx="62" cy="48" r="32" fill="#8fd16a"/><path d="M18 58 L50 54 L50 66 L20 72Z" fill="#8fd16a"/></g><circle cx="50" cy="44" r="10" fill="#fff" stroke="#1d3b14" stroke-width="3"/><circle cx="76" cy="40" r="7" fill="#fff" stroke="#1d3b14" stroke-width="3"/><circle cx="52" cy="46" r="4" fill="#222"/><circle cx="75" cy="42" r="3" fill="#222"/><path d="M48 62 q14 10 28 0" fill="#3a1a1a" stroke="#1d3b14" stroke-width="3"/><path d="M60 66 q4 10 9 2" fill="#ff8fb1" stroke="#1d3b14" stroke-width="2"/><path d="M70 22 l6 -8 M74 24 l10 -4" stroke="#1d3b14" stroke-width="3" stroke-linecap="round"/><path d="M36 30 l8 6 M40 26 l2 8" stroke="#5a3a2a" stroke-width="2.4"/></svg><img class="zf-pal" src="assets/featured/pal-bear.webp" alt="" width="215" height="187"><div class="zf-txt"><b>Pal Zombie Survival</b><small>Team up with your Pal and splat goofy zombies with bubble blasters!</small><span class="zf-play">▶ Play</span></div></a><a class="zf-hero bg-hero" href="#/arcade/bingo" aria-label="Play Pal Bingo"><span class="zf-badge">🆕 New · Featured Game</span><svg class="bg-art" viewBox="0 0 142 122" aria-hidden="true"><circle cx="118" cy="18" r="14" fill="#fff3a0" opacity=".9"/><g transform="rotate(-6 71 50)"><rect x="28" y="12" width="85" height="60" rx="9" fill="#3fa9ff" stroke="#1d4f9a" stroke-width="2"/><text x="40.5" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">B</text><text x="55.5" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">I</text><text x="70.5" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">N</text><text x="85.5" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">G</text><text x="100.5" y="25" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">O</text><rect x="34" y="30" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="49" y="30" width="13" height="10" rx="2" fill="#fff"/><rect x="64" y="30" width="13" height="10" rx="2" fill="#fff"/><rect x="79" y="30" width="13" height="10" rx="2" fill="#fff"/><rect x="94" y="30" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="34" y="42" width="13" height="10" rx="2" fill="#fff"/><rect x="49" y="42" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="64" y="42" width="13" height="10" rx="2" fill="#fff"/><rect x="79" y="42" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="94" y="42" width="13" height="10" rx="2" fill="#fff"/><rect x="34" y="54" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="49" y="54" width="13" height="10" rx="2" fill="#fff"/><rect x="64" y="54" width="13" height="10" rx="2" fill="#ff6b9a"/><rect x="79" y="54" width="13" height="10" rx="2" fill="#fff"/><rect x="94" y="54" width="13" height="10" rx="2" fill="#fff"/></g><g transform="translate(18 92)"><circle r="15" fill="#ff4d6d" stroke="#7a3d00" stroke-width="1.5"/><circle r="9.3" fill="#fff"/><text y="-1.5" text-anchor="middle" font-size="7" font-weight="900" fill="#ff4d6d">B</text><text y="6" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b1d55">12</text><ellipse cx="-6.0" cy="-7.5" rx="4.2" ry="2.4" fill="#fff" opacity=".8" transform="rotate(-30)"/></g><g transform="translate(44 104)"><circle r="15" fill="#3fa9ff" stroke="#7a3d00" stroke-width="1.5"/><circle r="9.3" fill="#fff"/><text y="-1.5" text-anchor="middle" font-size="7" font-weight="900" fill="#3fa9ff">I</text><text y="6" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b1d55">22</text><ellipse cx="-6.0" cy="-7.5" rx="4.2" ry="2.4" fill="#fff" opacity=".8" transform="rotate(-30)"/></g><g transform="translate(72 96)"><circle r="15" fill="#ffd23f" stroke="#7a3d00" stroke-width="1.5"/><circle r="9.3" fill="#fff"/><text y="-1.5" text-anchor="middle" font-size="7" font-weight="900" fill="#ffd23f">N</text><text y="6" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b1d55">38</text><ellipse cx="-6.0" cy="-7.5" rx="4.2" ry="2.4" fill="#fff" opacity=".8" transform="rotate(-30)"/></g><g transform="translate(98 104)"><circle r="15" fill="#4cd07d" stroke="#7a3d00" stroke-width="1.5"/><circle r="9.3" fill="#fff"/><text y="-1.5" text-anchor="middle" font-size="7" font-weight="900" fill="#4cd07d">G</text><text y="6" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b1d55">50</text><ellipse cx="-6.0" cy="-7.5" rx="4.2" ry="2.4" fill="#fff" opacity=".8" transform="rotate(-30)"/></g><g transform="translate(124 92)"><circle r="15" fill="#ff8a1f" stroke="#7a3d00" stroke-width="1.5"/><circle r="9.3" fill="#fff"/><text y="-1.5" text-anchor="middle" font-size="7" font-weight="900" fill="#ff8a1f">O</text><text y="6" text-anchor="middle" font-size="7.5" font-weight="900" fill="#2b1d55">75</text><ellipse cx="-6.0" cy="-7.5" rx="4.2" ry="2.4" fill="#fff" opacity=".8" transform="rotate(-30)"/></g></svg><span class="zf-txt"><b>Pal Bingo</b><small>Grab your card, listen for your numbers, and shout BINGO!</small><span class="zf-play bg-play">▶ Play</span></span></a><a class="zf-hero lu-hero" href="#/games/ludo" aria-label="Play Pal Ludo: 1 on 1, team or 4 player"><span class="zf-badge">🎲 Pal Ludo</span>${ludoArt()}<span class="zf-txt"><b>Pal Ludo</b><small>Roll the dice, race your Pals home. 1 on 1, Team or 4 Player.</small><span class="zf-play lu-play">▶ Play</span></span></a><a class="zf-hero cxh-hero" href="#/games/chess" aria-label="Play Capy Chess: plush capybara pieces, vs the CPU or a friend"><span class="zf-badge">♟️ New · Capy Chess</span><img class="cxh-art" src="assets/featured/chess-capy.webp" alt="" width="520" height="390" loading="lazy" decoding="async"><span class="zf-txt"><b>Capy Chess</b><small>Plush capybara pieces on a wooden board. Play the CPU or a friend.</small><span class="zf-play cxh-play">▶ Play</span></span></a><a class="zf-hero rsh-hero" href="#/games/rush" aria-label="Play Kemy Hill Rush: drive your Pal over bouncy hills, solo, vs the computer or online"><span class="zf-badge">🚙 New · Kemy Hill Rush</span><img class="cxh-art rsh-art" src="assets/featured/rush-hero.webp" alt="" width="520" height="390" loading="lazy" decoding="async"><span class="zf-txt"><b>Kemy Hill Rush</b><small>Your Pal drives over bouncy hills. Flip, grab stars and race friends!</small><span class="zf-play rsh-play">▶ Drive</span></span></a><a class="zf-arcade" href="#/arcade">🕹️ Open the Arcade <span aria-hidden="true">›</span></a>
      <div class="g-hero"><span class="g-hero-ic">${CONTROLLER}</span><div><h1>Games</h1><p class="muted">Free, turn-based and made by the studio. Play friends, get matched, or take on the computer.</p></div><div class="g-tools">${muteBtn()}${gearBtn()}</div></div>
      <div class="g-quick">
        <a class="g-qbtn" href="#/games/pick/friend"><span>${STAR()}</span>Play a friend</a>
        <a class="g-qbtn" href="#/games/pick/quick"><span>${CONTROLLER}</span>Quick match</a>
        <a class="g-qbtn" href="#/games/pick/cpu"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7.5" width="14" height="11" rx="3.4"/><path d="M12 7.5V4.6M9.4 12.4h.01M14.6 12.4h.01M9.6 15.6h4.8"/></svg></span>Play the computer</a>
      </div>
      <a class="g-scores" href="#/scores">🏆 <span><b>Scoreboards</b><small>Every game, every player, with their Pal</small></span></a>
      <form class="g-code" id="g-code" data-joincode><label for="g-code-in" class="sr-only">Room code</label><input id="g-code-in" maxlength="7" placeholder="Have a room code? Join with code" autocapitalize="characters" autocomplete="off" spellcheck="false"><button class="btn btn-sm" type="submit">Join</button></form>
      <a class="g-palgames" href="#/games/pals"><span>🐾</span><div><b>Pal Games</b><small>Your Pal vs friends in real time: Pal Race, Bubble Pop Battle, Star Catch and Dance-Off</small></div><span class="g-tag">New</span></a>
      <h2 class="g-h2" id="g-all">All games</h2>
      <div class="g-cards"><a class="g-card" href="#/arcade/bingo"><span class="g-thumb"><img class="gcover" src="assets/bingo-cover.svg" alt="" width="120" height="80"><i class="g-new">NEW</i></span><div class="g-card-t"><b>Pal Bingo</b><span class="muted small">Call, tap and shout BINGO with friends. ⭐ prizes, never a bet.</span><span class="g-tag">Up to 20</span></div></a>${GAMES.map((g) => `<a class="g-card" href="#/games/${g.id}">${COVERS[g.id]}<div class="g-card-t"><b>${esc(g.name)}</b><span class="muted small">${esc(g.blurb)}</span><span class="g-tag">${esc(g.players)}</span></div></a>`).join('')}<a class="g-card" href="kemy-quest.html" data-game="kemy-quest"><img src="assets/kemy-quest/cover.svg" alt="" width="120" height="90" style="width:100%;height:auto;border-radius:14px"><div class="g-card-t"><b>Kemy's Bubble Quest</b><span class="muted small">Hop, swim and blow bubbles with Kemy the axolotl.</span><span class="g-tag">1 player</span></div></a></div>
      <h2 class="g-h2">Your record</h2>
      <div class="card g-record" id="g-record">${signedIn() ? '<div class="spinner"></div>' : '<p class="muted small" style="margin:0">Your vs-computer record is saved on this device. <a href="#/login?next=%23%2Fgames">Sign in</a> to play online and get on the leaderboard.</p>'}</div>
      <h2 class="g-h2">Top players</h2>
      <nav class="tabs g-lb-tabs" id="g-lb-tabs">${GAMES.map((g, i) => `<button data-t="${g.id}" class="${i ? '' : 'active'}">${esc(g.name)}</button>`).join('')}</nav>
      <div class="card" id="g-lb"><div class="spinner"></div></div>
    </section>`;
    import('../updates.js').then((m) => m.paintDots()).catch(() => {});
    wireMute(main);
    joinCodes(main, false);
    const recRow = (id, on, off) => `<div class="g-rec-row"><b>${esc(gameName(id))}</b><span>${on ? `<i class="w">${on.w}W</i> <i class="l">${on.l}L</i>${on.d ? ` <i>${on.d}D</i>` : ''}` : '<span class="muted">-</span>'}</span><span class="muted small">${off ? `vs computer ${off.w}-${off.l}${off.d ? '-' + off.d : ''}` : ''}</span></div>`;
    const paintRec = (st) => { const box = $('#g-record'); if (!box) return; box.innerHTML = GAMES.map((g) => { const on = st && (st[g.id + '_w'] || st[g.id + '_l'] || st[g.id + '_d']) ? { w: st[g.id + '_w'] || 0, l: st[g.id + '_l'] || 0, d: st[g.id + '_d'] || 0 } : null; return recRow(g.id, on, rec[g.id]); }).join('') + (signedIn() ? '' : `<p class="muted small" style="margin:8px 0 0"><a href="#/login?next=%23%2Fgames">Sign in</a> to play online and get on the leaderboard.</p>`); };
    if (signedIn()) net.getStats(myUid()).then((st) => { if (!stale(token)) paintRec(st); }).catch(() => paintRec({}));
    else paintRec(null);
    const lb = async (type) => {
      const box = $('#g-lb'); box.innerHTML = '<div class="spinner"></div>';
      try {
        const rows = await net.leaderboard(type);
        if (stale(token)) return;
        box.innerHTML = rows.length ? `<ol class="g-lb">${rows.map((r, i) => `<li class="${r.uid === myUid() ? 'me' : ''}"><span class="g-rank">${i < 3 ? STAR('r' + i) : ''}<b>${i + 1}</b></span>${avatar({ uid: r.uid, displayName: r.name, username: r.uname, color: r.color }, 'sm', true)}<a href="#/u/${esc(r.uname)}" class="g-lb-n${adminNameClass(r.uid) ? ' ' + adminNameClass(r.uid) : ''}">${esc(faceName(r.uid, r.name))}${r.uid === STUDIO_UID || isAdminUid(r.uid) ? ownerBadgeHtml() : (window.kemyModBadge ? window.kemyModBadge(r.uid) : '')}<small class="muted">@${esc(r.uname)}</small></a><span class="g-lb-s"><b>${r[type + '_w'] || 0}</b> W · ${r[type + '_l'] || 0} L</span></li>`).join('')}</ol>`
          : '<div class="empty">No online wins yet. Be the first on the board!</div>';
      } catch (e) { box.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; }
    };
    $('#g-lb-tabs').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; [...$('#g-lb-tabs').children].forEach((x) => x.classList.toggle('active', x === b)); lb(b.dataset.t); };
    lb(GAMES[0].id);
    lobbyEmotes();
  }
  function pick(what) {
    const label = { friend: 'Play a friend', quick: 'Quick match', cpu: 'Play the computer' }[what] || 'Pick a game';
    shell(esc(label), `<p class="muted">Pick a game.</p><div class="g-cards g-cards-sm">${GAMES.map((g) => `<a class="g-card" href="#/games/${g.id}?do=${esc(what)}">${COVERS[g.id]}<div class="g-card-t"><b>${esc(g.name)}</b><span class="g-tag">${esc(g.players)}</span></div></a>`).join('')}</div>`);
  }

  // ------------------------------------------------------------ per-game lobby page
  // lobby / hub: the emote wheel makes your Pal dance on a small card (local only, nothing synced)
  const lobbyEmotes = () => { const host = main.firstElementChild; if (host && signedIn()) import('../pals/game-emotes.js').then((m) => m.mountGameEmotes(host, { db, uid: myUid(), toast })).catch(() => {}); };
  async function gamePage(type, params) {
    const g = GAMES.find((x) => x.id === type);
    if (!g) { main.innerHTML = '<div class="empty">Game not found. <a href="#/games">Games</a></div>'; return; }
    const room = type === 'trivia' || type === 'starcards' || type === 'ludo';
    const modes = type === 'klgrid' ? [['classic', 'Classic 3x3'], ['ultimate', 'Ultimate 9x9']] : type === 'starcards' ? [['500', 'Play to 500'], ['round', 'Single round']] : type === 'chess' ? [['', '60s a move'], ['5', '5 min clock'], ['10', '10 min clock']] : type === 'ludo' ? [['4', '4 seats'], ['3', '3 seats'], ['2', '2 seats']] : null;
    const picked = params.do === 'quick' ? 'online' : params.do === 'friend' || params.do === 'cpu' ? params.do : lastMode();
    let how = picked === 'online' || picked === 'friend' || picked === 'cpu' ? picked : 'cpu';
    shell(esc(g.name), `
      <div class="g-detail">${COVERS[type]}<p class="muted">${esc(g.blurb)} <span class="g-tag">${esc(g.players)}</span></p></div>
      ${modes ? `<div class="g-seg" role="radiogroup" aria-label="Rules">${modes.map(([v, l], i) => `<label><input type="radio" name="g-mode" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div>` : ''}
      <div class="g-modes" role="tablist" aria-label="How to play">
        <button type="button" data-how="cpu" aria-pressed="${how === 'cpu'}">Play vs Computer</button>
        <button type="button" data-how="online" aria-pressed="${how === 'online'}">Play Online (real players)</button>
        <button type="button" data-how="friend" aria-pressed="${how === 'friend'}">Play a Friend</button>
      </div>
      <div id="g-how"></div>
      <h2 class="g-h2">Top players</h2><div class="card" id="g-lb"><div class="spinner"></div></div>`, '#/games');
    const mode = () => document.querySelector('input[name=g-mode]:checked')?.value || '';
    const paintHow = () => {
      const box = $('#g-how'); if (!box) return;
      saveMode(how);
      main.querySelectorAll('[data-how]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.how === how ? 'true' : 'false'));
      if (how === 'cpu') {
        box.innerHTML = `<section class="card pad" id="g-diff"><h2 class="g-h2" style="margin-top:0">Choose a bot</h2>
          ${type === 'starcards' ? `<label class="small muted g-inline-l">Computer players <select id="g-bots">${[1, 2, 3, 4, 5].map((n) => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
          <div class="g-pals">${PALS.map((p) => `<button type="button" class="g-pal" data-lvl="${p.id}">${faceSvg(p.name, 64)}<b>${esc(p.name)}</b><i class="bot-tag">Bot</i><span>${esc(p.title)}</span><small>${esc(p.line)}</small></button>`).join('')}</div>
          <p class="muted small">Bot games give fewer Star Coins, and they stay off the online scoreboard.</p></section>`;
        box.querySelectorAll('[data-lvl]').forEach((a) => a.onclick = () => {
          saveLevel(a.dataset.lvl);
          const extra = type === 'starcards' ? `&bots=${$('#g-bots').value}` : '';
          location.hash = `#/games/${type}/cpu?lvl=${a.dataset.lvl}&mode=${mode()}${extra}`;
        });
        return;
      }
      if (how === 'online') {
        box.innerHTML = `<section class="card pad"><h2 class="g-h2" style="margin-top:0">Real players</h2><p class="muted small">We look for someone who is waiting right now. If nobody joins in about half a minute, you can play a bot instead. Bots are labeled Bot.</p><button class="btn btn-block" id="g-quick">Find a match</button></section>`;
        const busy = (b, on, t) => { b.disabled = on; if (t) b.textContent = t; };
        $('#g-quick').onclick = async () => {
          if (!requireAuth()) return;
          const b = $('#g-quick'); busy(b, true, 'Looking…');
          try { const gid = await net.quickMatch(type, mode()); location.hash = '#/game/' + gid; }
          catch (e) { toast(friendlyError(e)); busy(b, false, 'Find a match'); }
        };
        return;
      }
      box.innerHTML = `<section class="card pad"><h2 class="g-h2" style="margin-top:0">A friend</h2>
        <form id="g-inv" class="g-inline"><label for="g-handle" class="sr-only">Friend's @handle</label><input id="g-handle" placeholder="@handle" autocapitalize="none" autocomplete="off" spellcheck="false"><button class="btn btn-sm" type="submit">Invite</button></form>
        <p class="muted small">They get a notification. Or <button class="link-btn" id="g-link">${room ? 'open a room' : 'make a game'} and share the code</button>.</p>
        <h2 class="g-h2">Got a code?</h2>${codeFormHtml('g-joincode', 'Join with code')}<p class="muted small">Type the room code your friend sees on their screen.</p></section>`;
      joinCodes(box, true);
      $('#g-link').onclick = async () => {
        if (!requireAuth()) return;
        try { const gid = await net.createGame(type, mode()); location.hash = '#/game/' + gid; } catch (e) { toast(friendlyError(e)); }
      };
      $('#g-inv').onsubmit = async (ev) => {
        ev.preventDefault();
        if (!requireAuth()) return;
        const h = $('#g-handle').value.trim().replace(/^@/, '').toLowerCase();
        if (!h) { toast('Type your friend’s @handle'); return; }
        try {
          const uid = await net.uidForHandle(h);
          if (!uid) { toast(`No one has the handle @${h}`); return; }
          if (uid === myUid()) { toast('That’s you! Invite someone else.'); return; }
          const gid = await net.createGame(type, mode(), { invitee: room ? '' : uid });
          await net.invite(uid, gid, `${g.name}${room ? ' · room ' + gid : ''}`).catch((e) => toast('Game made, but the invite didn’t send: ' + friendlyError(e)));
          toast(`Invite sent to @${h}`);
          location.hash = '#/game/' + gid;
        } catch (e) { toast(friendlyError(e)); }
      };
    };
    main.querySelectorAll('[data-how]').forEach((b) => b.onclick = () => { how = b.dataset.how; paintHow(); });
    paintHow();
    net.leaderboard(type).then((rows) => {
      const box = $('#g-lb'); if (!box) return;
      box.innerHTML = rows.length ? `<ol class="g-lb">${rows.map((r, i) => `<li class="${r.uid === myUid() ? 'me' : ''}"><span class="g-rank">${i < 3 ? STAR('r' + i) : ''}<b>${i + 1}</b></span>${avatar({ uid: r.uid, displayName: r.name, username: r.uname, color: r.color }, 'sm', true)}<a href="#/u/${esc(r.uname)}" class="g-lb-n${adminNameClass(r.uid) ? ' ' + adminNameClass(r.uid) : ''}">${esc(faceName(r.uid, r.name))}${r.uid === STUDIO_UID || isAdminUid(r.uid) ? ownerBadgeHtml() : (window.kemyModBadge ? window.kemyModBadge(r.uid) : '')}<small class="muted">@${esc(r.uname)}</small></a><span class="g-lb-s"><b>${r[type + '_w'] || 0}</b> W · ${r[type + '_l'] || 0} L</span></li>`).join('')}</ol>` : '<div class="empty">No online wins yet.</div>';
    }).catch((e) => { const box = $('#g-lb'); if (box) box.innerHTML = `<div class="empty">${esc(friendlyError(e))}</div>`; });
    lobbyEmotes();
  }

  // ------------------------------------------------------------ board rendering
  const PIECE = { a: 'gold', b: 'purple' };
  function renderBoard(el, type, st, opt) {
    const { mySide, legal, onMove, lastCell, line = [], flip } = opt;
    const myTurn = mySide === st.turn && opt.live;
    const L = new Set(legal || []);
    if (type === 'stardrop') {
      let h = '<div class="sd-board">';
      for (let c = 0; c < 7; c++) {
        h += `<button class="sd-col ${myTurn && L.has(String(c)) ? 'can' : ''}" data-m="${c}" aria-label="Drop in column ${c + 1}" ${myTurn && L.has(String(c)) ? '' : 'disabled'}>`;
        for (let r = 0; r < 6; r++) {
          const i = r * 7 + c, v = st.board[i];
          h += `<span class="sd-cell ${line.includes(i) ? 'win' : ''}">${v !== '.' ? `<span class="sd-piece ${PIECE[v]} ${i === lastCell ? 'drop' : ''}" style="--r:${r + 1}">${STAR()}</span>` : ''}</span>`;
        }
        h += '</button>';
      }
      el.innerHTML = h + '</div>';
    } else if (type === 'klgrid' && st.board.length === 9) {
      el.innerHTML = `<div class="kl-board">${[...st.board].map((v, i) => `<button class="kl-cell ${line.includes(i) ? 'win' : ''} ${i === lastCell ? 'pop' : ''}" data-m="${i}" ${myTurn && L.has(String(i)) ? '' : 'disabled'} aria-label="Square ${i + 1}${v !== '.' ? (v === 'a' ? ', K' : ', L') : ''}">${v === 'a' ? '<span class="kl-k">K</span>' : v === 'b' ? '<span class="kl-l">L</span>' : ''}</button>`).join('')}</div>`;
    } else if (type === 'klgrid') {
      const big = ENGINES.klgrid.bigCells(st.board);
      const active = new Set([...L].map((m) => Math.floor(+m / 9)));
      let h = '<div class="kl-ult">';
      for (let b = 0; b < 9; b++) {
        h += `<div class="kl-sub ${myTurn && active.has(b) ? 'live' : ''} ${big[b] === 'a' ? 'won-k' : big[b] === 'b' ? 'won-l' : ''} ${line.includes(b) ? 'win' : ''}">`;
        for (let i = 0; i < 9; i++) {
          const idx = b * 9 + i, v = st.board[idx];
          h += `<button class="kl-cell sm ${idx === lastCell ? 'pop' : ''}" data-m="${idx}" ${myTurn && L.has(String(idx)) ? '' : 'disabled'} aria-label="Board ${b + 1} square ${i + 1}">${v === 'a' ? '<span class="kl-k">K</span>' : v === 'b' ? '<span class="kl-l">L</span>' : ''}</button>`;
        }
        if (big[b] === 'a' || big[b] === 'b') h += `<span class="kl-big ${big[b] === 'a' ? 'kl-k' : 'kl-l'}">${big[b] === 'a' ? 'K' : 'L'}</span>`;
        h += '</div>';
      }
      el.innerHTML = h + '</div>';
    } else if (type === 'checkers') {
      const { sqRC } = ENGINES.checkers;
      const sel = opt.sel ?? -1;
      const fromSet = new Set((legal || []).map((m) => +m.split('-')[0]));
      const dests = new Map();
      (legal || []).filter((m) => +m.split('-')[0] === sel).forEach((m) => { const to = +m.split('-').pop(); if (!dests.has(to)) dests.set(to, m); });
      const lastPath = (opt.lastMove || '').split('-').filter(Boolean).map(Number);
      let cells = [];
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) cells.push([r, c]);
      if (flip) cells = cells.reverse();
      let h = '<div class="ck-board">';
      for (const [r, c] of cells) {
        if ((r + c) % 2 === 0) { h += '<span class="ck-sq light"></span>'; continue; }
        const s = r * 4 + (c >> 1), v = st.board[s];
        const can = myTurn && fromSet.has(s), dest = myTurn && dests.has(s);
        h += `<button class="ck-sq dark ${s === sel ? 'sel' : ''} ${dest ? 'dest' : ''} ${lastPath.includes(s) ? 'last' : ''}" data-s="${s}" ${can || dest ? '' : 'disabled'} aria-label="Square ${s + 1}">${v !== '.' ? `<span class="ck-p ${v.toLowerCase() === 'a' ? 'gold' : 'purple'} ${v === 'A' || v === 'B' ? 'king' : ''} ${s === lastCell ? 'moved' : ''}">${v === 'A' || v === 'B' ? STAR() : ''}</span>` : ''}</button>`;
      }
      el.innerHTML = h + '</div>';
      el.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
        const s = +b.dataset.s;
        if (dests.has(s) && sel >= 0) { onMove(dests.get(s)); return; }
        opt.onSelect(s === sel ? -1 : s); sfx.play('tap');
      });
      return;
    }
    el.querySelectorAll('[data-m]').forEach((b) => b.onclick = () => onMove(b.dataset.m));
  }
  const pieceLabel = (type, side) => type === 'klgrid' ? (side === 0 ? 'K' : 'L') : (side === 0 ? 'Gold' : 'Purple');
  function boardShell(type, mode, title, back) {
    shell(esc(title), `
      <div class="g-players" id="g-players"></div>
      <div class="g-status" id="g-status" aria-live="polite"></div>
      <div class="g-stage g-${type}"><div class="g-fx"></div><div id="g-board"></div></div>
      ${emoteBar()}
      <div class="g-actions" id="g-actions"></div>`, back);
  }
  function paintPlayers(type, ps, turn, timer, done) {
    const parent = $('#g-players'); if (!parent) return;
    syncPlates(parent, ps.map((p, i) => {
      const on = !done && turn === i;
      const bits = [type === 'klgrid'
        ? { key: 'pc', className: 'g-pc ' + (i === 0 ? 'gold' : 'purple'), text: i === 0 ? 'K' : 'L' }
        : { key: 'pc', className: 'g-pc ' + (i === 0 ? 'gold' : 'purple'), html: STAR(), sig: 'star' }];
      if (on && timer != null) bits.push({ key: 'tm', className: 'g-timer' + (timer <= 10 ? ' low' : ''), text: timer + 's' });
      return { key: 'p' + i, className: 'g-pl' + (on ? ' on' : ''), side: String(i), person: p, bits };
    }), { sep: true });
  }
  const sndFor = (type, st, prev) => type === 'stardrop' ? 'drop' : type === 'checkers' ? ((prev && (prev.board.replace(/[^.]/g, '').length < st.board.replace(/[^.]/g, '').length)) ? 'capture' : 'place') : 'place';

  // ------------------------------------------------------------ vs computer (local)
  function localBoard(type, params) {
    const lvl = normLevel(params.lvl);
    const mode = type === 'klgrid' && params.mode === 'ultimate' ? 'ultimate' : 'classic';
    const E = ENGINES[type];
    const humanSide = Math.random() < 0.5 ? 0 : 1;
    let st = { board: E.init(mode), turn: 0, last: '', no: 0 }, sel = -1, over = null, lastCell = -1, thinking = false;
    const me = signedIn() ? { uid: myUid(), name: 'You', uname: S.profile.username, color: S.profile.color } : { uid: '', name: 'You' };
    const pal = PALS.find((p) => p.id === lvl);
    const cpu = { uid: 'cpu1', name: pal.name, bot: true };
    const ps = humanSide === 0 ? [me, cpu] : [cpu, me];
    boardShell(type, mode, `${gameName(type)}${mode === 'ultimate' ? ' Ultimate' : ''}`, `#/games/${type}`);
    $('#g-actions').innerHTML = `<button class="btn btn-sm btn-ghost" id="g-restart">New game</button><a class="btn btn-sm btn-ghost" href="#/games/${type}">Leave</a>`;
    $('#g-restart').onclick = () => localBoard(type, params);
    wireEmotes(main, '', () => '');
    const alive = { v: true }; S.unsubs.push(() => (alive.v = false));
    function draw() {
      if (!$('#g-board')) return;
      paintPlayers(type, ps, st.turn, null, !!over);
      $('#g-status').textContent = over ? (over.winner === 'draw' ? 'Draw!' : over.winner === humanSide ? 'You win!' : `${pal.name} wins`) : st.turn === humanSide ? `Your turn (${pieceLabel(type, humanSide)})` : `${pal.name} is thinking…`;
      renderBoard($('#g-board'), type, st, { mySide: humanSide, live: !over && !thinking, legal: over ? [] : E.moves(st), lastCell, line: over ? over.line : [], sel, flip: humanSide === 1, lastMove: st.last,
        onSelect: (s) => { sel = s; draw(); }, onMove: (m) => move(m) });
    }
    function finish() {
      over = E.outcome(st); if (!over) return false;
      draw();
      const r = over.winner === 'draw' ? 'd' : over.winner === humanSide ? 'w' : 'l';
      addCpuResult(type, r);
      setTimeout(() => alive.v && resultModal({ title: r === 'w' ? 'You win!' : r === 'l' ? `${pal.name} wins` : 'Draw!', sub: r === 'w' ? 'Nice play. Bot wins pay fewer coins.' : 'Run it back?', win: r === 'w', vsBot: true,
        buttons: [{ label: 'Play again', onClick: () => localBoard(type, params) }, { label: 'Back to games', href: '#/games' }] }), 700);
      return true;
    }
    function move(m) {
      const prev = st;
      try { st = { ...E.apply(st, m), no: st.no + 1 }; } catch (e) { toast(e.message); return; }
      lastCell = st.cell; sel = -1; sfx.play(sndFor(type, st, prev));
      if (finish()) return;
      draw();
      if (st.turn !== humanSide) cpuTurn();
    }
    async function cpuTurn() {
      thinking = true; draw();
      const m = await ask({ kind: 'board', type, st: { board: st.board, turn: st.turn, last: st.last }, level: lvl });
      if (!alive.v) return;
      thinking = false;
      if (m) move(m);
    }
    draw();
    if (st.turn !== humanSide) cpuTurn();
  }

  // ------------------------------------------------------------ online board game
  async function onlineBoard(g0, token) {
    const gid = g0.id, type = g0.type, E = ENGINES[type];
    let g = g0, serverG = g0, sel = -1, lastSeenMove = -1, ended = false, claimTimer = 0, joinedAsk = false, pendingNo = null;
    const title = `${gameName(type)}${g.mode === 'ultimate' ? ' Ultimate' : ''}`;
    boardShell(type, g.mode, title, '#/games');
    const names = (uid) => { const i = g.players.indexOf(uid); return i >= 0 ? g.names[i] : 'A fan'; };
    wireEmotes(main, gid, names);
    let stopHb = null;
    const tick = setInterval(() => draw(false), 1000);
    S.unsubs.push(() => { clearInterval(tick); clearTimeout(claimTimer); if (stopHb) stopHb(); });
    const mySide = () => g.players.indexOf(myUid());
    async function claim(reason) {
      try { await net.update(gid, { status: 'done', winnerUid: reason === 'forfeit' ? g.players[1 - mySide()] : myUid(), endReason: reason }); }
      catch (e) { if (reason === 'forfeit') toast(friendlyError(e)); }
    }
    function actions() {
      const box = $('#g-actions'); if (!box) return;
      const side = mySide();
      if (g.status === 'waiting') {
        const offer = side === 0 && !g.invitee && g.players.length < 2 && whenOffer(gid, () => draw());
        box.innerHTML = `${side === 0 && !g.quick && !g.invitee ? codeBoxHtml(gid) : ''}${side === 0 ? `<button class="btn btn-sm btn-ghost" id="g-share">Copy invite link</button><button class="btn btn-sm btn-ghost" id="g-cancel">Cancel</button>` : ''}${side < 0 && signedIn() ? '<button class="btn btn-sm" id="g-join">Join this game</button>' : ''}${!signedIn() ? `<a class="btn btn-sm" href="#/login?next=${encodeURIComponent('#/game/' + gid)}">Sign in to play</a>` : ''}${offer ? offerHtml() : ''}`;
      } else if (g.status === 'active') {
        box.innerHTML = side >= 0 ? `<button class="btn btn-sm btn-danger" id="g-forfeit">Forfeit</button><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>` : `<span class="muted small">You’re watching</span><button class="btn btn-sm btn-ghost" id="g-share">Share link</button>`;
      } else {
        box.innerHTML = `${side >= 0 && g.endReason !== 'cancelled' ? (g.rematch ? `<a class="btn btn-sm" href="#/game/${esc(g.rematch)}">${S.user && g.players.indexOf(myUid()) >= 0 ? 'Go to rematch' : 'Watch rematch'}</a>` : '<button class="btn btn-sm" id="g-rematch">Rematch</button>') : ''}<a class="btn btn-sm btn-ghost" href="#/games">Games</a>`;
      }
      const sh = $('#g-share'); if (sh) sh.onclick = async () => { try { await navigator.clipboard.writeText(link(gid)); toast('Link copied'); } catch { prompt('Copy this link:', link(gid)); } };
      const cn = $('#g-cancel'); if (cn) cn.onclick = async () => { try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue(type, g.mode, gid); location.hash = '#/games'; } catch (e) { toast(friendlyError(e)); } };
      const by = box.querySelector('[data-bot-yes]'); if (by) by.onclick = async () => { stopOffer(gid); try { await net.update(gid, { status: 'done', endReason: 'cancelled' }); net.leaveQueue(type, g.mode, gid); } catch { /* already gone */ } location.hash = `#/games/${type}/cpu?lvl=${lastLevel()}&mode=${g.mode || ''}`; };
      const jn = $('#g-join'); if (jn) jn.onclick = async () => { try { await net.join(gid); } catch (e) { toast(friendlyError(e)); } };
      const ff = $('#g-forfeit'); if (ff) ff.onclick = () => { if (confirm('Forfeit this game? It counts as a loss.')) claim('forfeit'); };
      const rm = $('#g-rematch'); if (rm) rm.onclick = async () => {
        rm.disabled = true;
        try {
          const other = g.players[1 - side];
          const nid = await net.createGame(type, g.mode, { invitee: other, from: gid });
          await net.update(gid, { rematch: nid });
          net.invite(other, nid, `${gameName(type)} rematch`).catch(() => {});
          location.hash = '#/game/' + nid;
        } catch (e) { toast(friendlyError(e)); rm.disabled = false; }
      };
    }
    function draw(full = true) {
      if (!$('#g-board')) return;
      const st = { board: g.board, turn: g.turn, last: g.last, no: g.moveNo };
      const side = mySide(), done = g.status === 'done';
      const ps = g.players.map((uid, i) => ({ uid, name: g.names[i], uname: g.unames[i], color: g.colors[i] }));
      while (ps.length < 2) ps.push({ uid: '', name: 'Waiting…' });
      const left = g.status === 'active' ? net.turnLeft(g.turnAt) : null;
      paintPlayers(type, ps, g.turn, left, done || g.status === 'waiting');
      const status = $('#g-status');
      if (g.status === 'waiting') status.textContent = side === 0 ? (g.invitee ? 'Waiting for your friend to join…' : g.quick ? 'Looking for an opponent…' : 'Share the room code (below) or link so a friend can join') : 'Waiting for players';
      else if (done) status.textContent = g.endReason === 'cancelled' ? 'This game was cancelled' : g.winnerUid === 'draw' ? 'Draw!' : `${names(g.winnerUid)} wins${g.endReason === 'forfeit' ? ' (forfeit)' : g.endReason === 'timeout' ? ' (time ran out)' : ''}`;
      else status.textContent = side === g.turn ? `Your turn (${pieceLabel(type, side)})${left <= 15 ? ` · ${left}s left` : ''}` : `${g.names[g.turn]}’s turn`;
      if (left != null && left <= 5 && side === g.turn && !full) sfx.play('tick');
      if (!full) return;
      const out = done ? E.outcome(st) : null;
      renderBoard($('#g-board'), type, st, { mySide: side, live: g.status === 'active' && side >= 0, legal: g.status === 'active' ? E.moves(st) : [], lastCell: g.lastCell ?? cellOf(st), line: out ? out.line : [], sel, flip: side === 1, lastMove: g.last,
        onSelect: (s) => { sel = s; draw(); }, onMove: (m) => move(m) });
      actions();
    }
    const cellOf = (st) => (type === 'stardrop' && st.last !== '' ? (() => { for (let r = 0; r < 6; r++) if (st.board[r * 7 + +st.last] !== '.') return r * 7 + +st.last; return -1; })() : type === 'checkers' ? +String(st.last).split('-').pop() : st.last === '' ? -1 : +st.last);
    async function move(m) {
      if (pendingNo != null || g.status !== 'active' || mySide() !== g.turn) return;
      const st = { board: g.board, turn: g.turn, last: g.last, no: g.moveNo };
      let nx; try { nx = E.apply(st, m); } catch (e) { toast(e.message); return; }
      const out = E.outcome({ ...nx, no: st.no + 1 });
      const expect = g.moveNo || 0;
      const upd = { board: nx.board, turn: nx.turn, last: m, moveNo: expect + 1, turnAt: net.fs.serverTimestamp() };
      if (out) Object.assign(upd, { status: 'done', winnerUid: out.winner === 'draw' ? 'draw' : myUid(), endReason: out.winner === 'draw' ? 'draw' : 'win' });
      pendingNo = upd.moveNo;
      g = { ...g, ...upd, turnAt: { toMillis: () => Date.now() } }; sel = -1; sfx.play(sndFor(type, nx, st)); draw();
      try { await net.commitMove(gid, expect, upd); if (out) iEnded = true; }
      catch (e) {
        pendingNo = null; iEnded = false; g = serverG; sel = -1; draw();
        toast(e && e.code === 'stale' ? 'That move already happened.' : friendlyError(e));
      }
    }
    let iEnded = false;
    function onEnd() {
      if (ended) return; ended = true;
      if (stopHb) { stopHb(); stopHb = null; }
      if (g.endReason === 'cancelled') return;
      const side = mySide();
      const botGame = onlyBots(g.players, myUid());
      if (side >= 0 && !botGame) setTimeout(() => net.recordResult(g, iEnded || g.endReason === 'timeout' || g.endReason === 'forfeit'), iEnded ? 0 : 2500);
      if (side >= 0 && botGame) addCpuResult(type, g.winnerUid === myUid() ? 'w' : g.winnerUid === 'draw' ? 'd' : 'l');
      const win = side >= 0 && g.winnerUid === myUid();
      const title = g.winnerUid === 'draw' ? 'Draw!' : side < 0 ? `${names(g.winnerUid)} wins` : win ? 'You win!' : 'You lost';
      const sub = g.endReason === 'forfeit' ? (win ? 'Your opponent forfeited.' : 'Game forfeited.') : g.endReason === 'timeout' ? (win ? 'Your opponent ran out of time.' : 'Time ran out.') : win ? 'Stars well played.' : '';
      setTimeout(() => {
        if (stale(token)) return;
        resultModal({ title, sub, win, vsBot: botGame, buttons: side >= 0 ? [{ label: 'Rematch', onClick: () => $('#g-rematch')?.click() }, { label: 'Back to games', href: '#/games' }] : [{ label: 'Back to games', href: '#/games' }] });
      }, 800);
    }
    // Auto-claim when the other player's clock runs out or their heartbeat goes quiet.
    function scheduleClaim() {
      clearTimeout(claimTimer);
      const side = mySide();
      if (g.status !== 'active' || side < 0 || g.turn === side) return;
      const other = g.players[1 - side];
      const tTurn = (tsMs(g.turnAt) || net.serverNow()) + (TURN_SECONDS + 6) * 1000 - net.serverNow();
      const hb = g.hb && g.hb[other] ? tsMs(g.hb[other]) : 0;
      const tHb = hb ? hb + 48000 - Date.now() : Infinity;
      claimTimer = setTimeout(async () => { await claim('timeout'); }, Math.max(1500, Math.min(tTurn, tHb)));
    }
    const followRm = rematchFollower(gid);
    const unsub = net.watchGame(gid, (ng) => {
      if (!ng) { main.innerHTML = '<div class="empty">This game was removed. <a href="#/games">Games</a></div>'; return; }
      serverG = ng;
      const prevMove = g.moveNo; const prevStatus = g.status;
      const rec = net.reconcile(ng.moveNo, pendingNo);
      pendingNo = rec.pending;
      if (!rec.take) { scheduleClaim(); return; }
      g = ng;
      if (g.moveNo !== prevMove && g.moveNo > 0 && lastSeenMove >= 0 && g.players[g.turn] === myUid()) sfx.play(type === 'stardrop' ? 'drop' : 'place');
      lastSeenMove = g.moveNo;
      if (g.status === 'active' && mySide() >= 0 && !stopHb) stopHb = net.heartbeat(gid);
      if (g.status !== 'waiting' && prevStatus === 'waiting' && g.status === 'active') { sfx.play('star'); net.leaveQueue(type, g.mode, gid); }
      draw(); scheduleClaim();
      if (g.status === 'done') onEnd();
      followRm(g, mySide() >= 0);
      // Signed-in visitor on a waiting game they're invited to (or an open one): offer to join.
      if (g.status === 'waiting' && signedIn() && mySide() < 0 && !joinedAsk && (g.invitee === myUid() || !g.invitee)) {
        joinedAsk = true; net.join(gid).catch((e) => toast(friendlyError(e)));
      }
    }, (e) => toast(friendlyError(e)));
    S.unsubs.push(unsub);
  }

  // ------------------------------------------------------------ router entry points
  async function page(a, b, q, token) {
    const params = qs(q);
    curType = ''; curPlayers = null; curGid = '';
    if (!a) return hub(token);
    if (b === 'cpu' || b === 'local' || params.cpu) curType = a;
    if (a === 'pick') return pick(b);
    if (a === 'rush') return import('../rush/index.js').then((m) => m.page({ ...ctx, ui }, b, params, token));
    if (a === 'kemy-quest') { location.replace('kemy-quest.html' + (b ? '#lvl=' + b : '')); return; }
    if (b === 'cpu') {
      if (BOARD_TYPES.includes(a)) return localBoard(a, params);
      if (a === 'trivia') return trivia.local(params);
      if (a === 'starcards') return cards.local(params);
      if (a === 'pool') return pool.local(params);
      if (a === 'chess') return chess.local(params);
      if (a === 'ludo') return ludo.local(params);
    }
    if (a === 'ludo' && !b && !params.classic && !params.do) return ludo.modes(params);
    if (a === 'chess' && !b && !params.classic && !params.do) return chess.lobby(params);
    return gamePage(a, params);
  }
  async function open(gid, token) {
    const snap = await net.fs.getDoc(net.fs.doc(db, 'games', gid));
    if (stale(token)) return;
    if (!snap.exists()) { const pg = await net.fs.getDoc(net.fs.doc(db, 'palGames', gid)).catch(() => null); if (pg && pg.exists()) { location.replace('#/games/pals/' + gid); return; } main.innerHTML = `<div class="empty">No game or room called “${esc(gid)}”. <a href="#/games">Games</a></div>`; return; }
    const g = { id: snap.id, ...snap.data() };
    curType = g.type; curPlayers = [...(g.players || []), ...(g.left || [])]; curGid = g.id;
    if (BOARD_TYPES.includes(g.type)) return onlineBoard(g, token);
    if (g.type === 'trivia') return trivia.online(g, token);
    if (g.type === 'starcards') return cards.online(g, token);
    if (g.type === 'pool') return pool.online(g, token);
    if (g.type === 'chess') return chess.online(g, token);
    if (g.type === 'ludo') return ludo.online(g, token);
    if (g.type === 'rush') return import('../rush/online.js').then((m) => m.online({ ...ctx, ui }, g, token));
  }
  async function renderProfile(el, uid) {
    if (!el) return;
    try {
      const st = await net.getStats(uid);
      const rows = GAMES.filter((g) => st[g.id + '_w'] || st[g.id + '_l'] || st[g.id + '_d']);
      if (!rows.length) { if (uid === myUid()) el.innerHTML = `<a class="g-prof" href="#/games">${CONTROLLER}<span><b>Games</b> · play friends or the computer</span></a><a class="g-prof g-prof-z" href="#/park">🌳<span><b>Pal Park</b> · walk with friends</span></a><a class="g-prof g-prof-z" href="#/arcade/zombie">🧟<span><b>Pal Zombie Survival</b> · play now</span></a>`; return; }
      el.innerHTML = `<a class="g-prof" href="#/games" aria-label="Game record">${CONTROLLER}${rows.map((g) => `<span><b>${esc(g.name)}</b> ${st[g.id + '_w'] || 0}W ${st[g.id + '_l'] || 0}L${st[g.id + '_d'] ? ` ${st[g.id + '_d']}D` : ''}</span>`).join('')}</a><a class="g-prof g-prof-z" href="#/arcade/zombie">🧟<span><b>Pal Zombie Survival</b> · play now</span></a>`;
    } catch { /* optional */ }
  }
  return { page, open, renderProfile, CONTROLLER };
}
