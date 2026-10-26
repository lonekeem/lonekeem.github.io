// Pal Park: a shared 2D world. Walk your active Pal (plus a little avatar) around, see other players in
// real time, emote, chat with safe bubbles, pet other Pals, find treasures, and hop into Pal Games portals.
// Spark-friendly: rooms of ~20 (parkRooms/r1..r20/p/{uid}), position writes only while moving and at most
// 4/s (enforced by the rules), a 15 s heartbeat when idle, interpolation, and stale presence cleanup.
import { spamOk } from '../spam.js';
import { doc, getDocs, setDoc, deleteDoc, collection, query, where, onSnapshot, serverTimestamp, Timestamp, addDoc }
  from '../fsq.js';
import { drawPal, star, heart, drawBubble } from './art.js';
import { getActivePal } from './core.js';
import { clean, checkInput } from './talk.js';
import { DECOR } from './wear.js';
import { drawDancer } from './dance.js';
import { createPark3D } from './park3d.js';
import { PHRASES as SAFE_SAY, PHRASE_NOTE, phraseOnly, isPhrase, needsBirthday, unlockTyping, BIRTHDAY_NOTE } from '../safe-chat.js';
import { hideKey, isHidden } from '../chat-hide.js';
import { webglOK } from './pal3d.js';
export const WORLD = { w: 3200, h: 2400 };
export const ZONES = [
  { id: 'pond', name: 'Lily Pond', x: 0, y: 0, w: 1600, h: 1200, col: '#bfe9d0' },
  { id: 'meadow', name: 'Meadow', x: 1600, y: 0, w: 1600, h: 1200, col: '#c8efa8' },
  { id: 'candy', name: 'Candy Plaza', x: 0, y: 1200, w: 1600, h: 1200, col: '#ffd6ec' },
  { id: 'beach', name: 'Beach', x: 1600, y: 1200, w: 1600, h: 1200, col: '#fbe7b0' }
];
const WATER = [{ x: 500, y: 330, rx: 360, ry: 230 }, { x: 2900, y: 2050, rx: 520, ry: 420 }]; // pond + sea (not walkable)
export const PORTALS = [{ g: 'race', x: 1470, y: 1080 }, { g: 'bubbles', x: 1730, y: 1080 }, { g: 'stars', x: 1470, y: 1320 }, { g: 'dance', x: 1730, y: 1320 }];
const PORTAL_NAME = { race: 'Pal Race', bubbles: 'Bubble Pop', stars: 'Star Catch', dance: 'Dance-Off' };
export const EMOTES = ['👋', '💜', '😂', '😮', '🎉', '😴', '⭐', '🐾'];
export const PHRASES = ['Hi! 👋', 'Nice Pal!', 'Wanna play?', 'Follow me!', 'Love your outfit!', 'GG!', 'Let’s race!', 'Bye! 👋', 'Found a treasure!', 'So cute!'];
const MAX_ROOM = 20, ROOMS = 20, SEND_MS = 1000, HB_MS = 15000, STALE_MS = 30000;
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const inWater = (x, y) => WATER.some((w) => ((x - w.x) / w.rx) ** 2 + ((y - w.y) / w.ry) ** 2 < 1);
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dayNo = () => Math.floor(Date.now() / 86400000);
// today's hidden treasures (same for everyone; each player can collect each once)
export function treasures() { const R = rng(dayNo() * 7919); const out = []; const kinds = { pond: 'pearl', meadow: 'flower', candy: 'candy', beach: 'shell' };
  for (const z of ZONES) for (let i = 0; i < 4; i++) { let x, y, n = 0; do { x = z.x + 80 + R() * (z.w - 160); y = z.y + 80 + R() * (z.h - 160); n++; } while ((inWater(x, y) || Math.hypot(x - 1600, y - 1200) < 260) && n < 30); out.push({ id: `${z.id}${i}`, x, y, k: kinds[z.id] }); }
  return out; }
export function createPark(ctx) {
  const { S, db, main, esc, toast, friendlyError, requireAuth, openModal, closeModal } = ctx;
  let stop = null; let p3 = null;
  async function page() {
    if (!requireAuth()) return; if (stop) stop();
    // real-3D park (with the shared rig) whenever WebGL is available and 3D isn't switched off; the 2D park stays as fallback
    if (webglOK() && !/[?&]park=2d/.test(location.search)) { p3 = p3 || createPark3D(ctx); return p3.page(); }
    main.innerHTML = `<section class="park"><div class="park-top"><b>🌳 Pal Park</b><span id="park-zone" class="park-zone"></span><span id="park-room" class="muted small"></span><a class="btn btn-sm" href="#/arcade" id="park-arcade">🎮 Arcade</a><a class="btn btn-sm btn-ghost" href="#/pals">Leave</a></div>
      <div class="park-view"><canvas id="park-cv" tabindex="0" aria-label="Pal Park. Use arrow keys or WASD to walk."></canvas>
        <div class="park-joy" id="park-joy" aria-hidden="true"><i></i></div>
        <div class="park-btns"><button class="btn btn-sm" id="pk-emote" aria-label="Emotes">😊</button><button class="btn btn-sm" id="pk-chat" aria-label="Chat">💬</button><button class="btn btn-sm" id="pk-act" aria-label="Pet nearby Pal" disabled>🐾</button><button class="btn btn-sm btn-ghost" id="pk-rep" disabled>Report</button><button class="btn btn-sm btn-ghost" id="pk-block" disabled>Block</button></div>
        <div class="park-panel" id="park-panel" hidden></div><div class="park-found" id="park-found"></div></div>
      <p class="small muted park-help">Walk with the joystick, arrow keys/WASD or a gamepad. Tap a player for Report/Block. Find 16 treasures a day for Star Coins! Step into a portal to play Pal Games.</p></section>`;
    const cv = main.querySelector('#park-cv'); const view = main.querySelector('.park-view'); const c = cv.getContext('2d');
    let VW = 360, VH = 520, DPR = Math.min(2, devicePixelRatio || 1);
    const size = () => { VW = view.clientWidth || 360; VH = Math.max(300, view.getBoundingClientRect().height || innerHeight - 60); cv.width = VW * DPR; cv.height = VH * DPR; cv.style.width = VW + 'px'; cv.style.height = VH + 'px'; };
    size(); addEventListener('resize', size);
    const pal = await getActivePal(db, S.user.uid).catch(() => null);
    const palSnap = pal ? { species: pal.species, name: pal.name, colors: pal.colors, pattern: pal.pattern, acc: pal.acc, outfit: pal.outfit || {}, level: pal.level || 1 } : { species: 'kemy', name: 'Kemy', level: 1 };
    // pick a room with space
    let room = 'r1';
    for (let i = 1; i <= ROOMS; i++) { try { const s = await getDocs(query(collection(db, 'parkRooms', 'r' + i, 'p'), where('at', '>', Timestamp.fromMillis(Date.now() - STALE_MS)))); const n = s.docs.filter((d) => d.id !== S.user.uid).length; if (n < MAX_ROOM) { room = 'r' + i; break; } } catch { break; } }
    main.querySelector('#park-room').textContent = `Room ${room.slice(1)}`;
    const meRef = doc(db, 'parkRooms', room, 'p', S.user.uid);
    const P = { x: 1600 + (Math.random() - 0.5) * 200, y: 1200 + 180, d: 1, px: 0, py: 0, e: '', eAt: 0, say: '', sayAt: 0, tgt: '', moving: false };
    P.px = P.x; P.py = P.y;
    const others = new Map(); const blocked = S.blocked || new Set();
    const base = () => ({ x: Math.round(P.x), y: Math.round(P.y), d: P.d, e: P.e, eAt: P.eAt, say: P.say, sayAt: P.sayAt, tgt: P.tgt, name: S.profile.displayName, uname: S.profile.username, color: S.profile.color || '#8a2be2', pal: palSnap, at: serverTimestamp() });
    let lastSend = 0, dirty = true, sending = false;
    const send = async (force) => { const now = Date.now(); if (sending || (!force && (!dirty || now - lastSend < SEND_MS) && now - lastSend < HB_MS)) return; sending = true; lastSend = now; dirty = false; try { await setDoc(meRef, base()); } catch (e) { if (e.code === 'permission-denied') lastSend = now + 300; } sending = false; };
    await send(true);
    // Presence costs 1 read per other player's write, so: ~1 write/s max (was ~4/s), only fresh docs,
    // and the listener detaches while the tab is hidden.
    const listen = () => onSnapshot(query(collection(db, 'parkRooms', room, 'p'), where('at', '>', Timestamp.fromMillis(Date.now() - STALE_MS * 2))), (qs) => {
      const now = Date.now();
      qs.docChanges().forEach((ch) => { const id = ch.doc.id; if (id === S.user.uid) return; if (ch.type === 'removed') { others.delete(id); return; }
        const d = ch.doc.data(); const at = d.at && d.at.toMillis ? d.at.toMillis() : now;
        if (now - at > 120000) { deleteDoc(ch.doc.ref).catch(() => {}); return; }  // clean up stale presence
        const o = others.get(id) || { x: d.x, y: d.y, px: d.x - 30, py: d.y, seenE: 0, seenS: 0 };
        Object.assign(o, { tx: d.x, ty: d.y, d: d.d, name: d.name, uname: d.uname, color: d.color, pal: d.pal, at, e: d.e, eAt: d.eAt, say: d.say, sayAt: d.sayAt, tgt: d.tgt, uid: id });
        if (d.tgt === S.user.uid && d.eAt > (o.seenT || 0) && d.e === '🐾') { o.seenT = d.eAt; P.petted = 90; toast(`@${d.uname} petted your Pal! 💜`); }
        others.set(id, o); });
    }, () => {});
    let unsubL = listen();
    const onVis = () => { if (document.hidden) { if (unsubL) { unsubL(); unsubL = null; } } else if (!unsubL && document.body.contains(cv)) { unsubL = listen(); send(true); } };
    document.addEventListener('visibilitychange', onVis);
    const unsub = () => { document.removeEventListener('visibilitychange', onVis); if (unsubL) unsubL(); unsubL = null; };
    // collectibles
    const tk = 'kemy-park-found-' + S.user.uid + '-' + dayNo(); const found = new Set(JSON.parse(localStorage.getItem(tk) || '[]')); const items = treasures();
    const foundEl = main.querySelector('#park-found'); const paintFound = () => { foundEl.textContent = `✨ ${found.size}/${items.length}`; }; paintFound();
    // input
    const keys = {}; const kd = (e) => { if (/input|textarea/i.test(document.activeElement && document.activeElement.tagName)) return; keys[e.key.toLowerCase()] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); if (e.key === 'e') act(); };
    const ku = (e) => { keys[e.key.toLowerCase()] = false; }; addEventListener('keydown', kd); addEventListener('keyup', ku);
    const joy = main.querySelector('#park-joy'), knob = joy.querySelector('i'); let jv = { x: 0, y: 0 }, jid = null;
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); move(e); });
    const move = (e) => { if (e.pointerId !== jid) return; const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), max = r.width / 2 - 10; if (m > max) { dx *= max / m; dy *= max / m; } jv = { x: dx / max, y: dy / max }; knob.style.transform = `translate(${dx}px,${dy}px)`; };
    joy.addEventListener('pointermove', move); const jend = () => { jid = null; jv = { x: 0, y: 0 }; knob.style.transform = ''; }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    // tap a player -> profile/report/block card
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); const wx = e.clientX - r.left + cam.x, wy = e.clientY - r.top + cam.y;
      for (const o of others.values()) if (Math.hypot(o.x - wx, o.y - 20 - wy) < 30 || Math.hypot(o.px - wx, o.py - 20 - wy) < 30) { playerCard(o); return; } });
    function playerCard(o) {
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><div class="park-card"><h2>${esc(o.name)}</h2><p class="muted">@${esc(o.uname)} · with ${esc((o.pal && o.pal.name) || 'their Pal')}</p>
        <div class="btns">${window.kemyFriends ? window.kemyFriends.buttonHtml(o.uid, o.name, o.uname) : ''}<a class="btn btn-sm" href="#/u/${esc(o.uname)}" data-close>View profile</a><button class="btn btn-sm btn-ghost" id="pc-pet">🐾 Pet their Pal</button><button class="btn btn-sm btn-ghost" id="pc-rep">Report</button><button class="btn btn-sm btn-ghost" id="pc-block">Block</button></div></div>`);
      document.getElementById('pc-pet').onclick = () => { closeModal(); petOther(o); };
      document.getElementById('pc-rep').onclick = () => { closeModal(); if (window.kemyModReport) window.kemyModReport({ targetType: 'user', targetId: o.uid, targetUid: o.uid, name: '@' + (o.uname || 'player'), hideKey: hideKey('park', o.uid, o.say || '') }); else report(o); };
      document.getElementById('pc-block').onclick = async () => { if (!confirm(`Block @${o.uname}? You won’t see them in Pal Park.`)) return; try { await setDoc(doc(db, 'users', S.user.uid, 'blocks', o.uid), { createdAt: serverTimestamp() }); blocked.add(o.uid); others.delete(o.uid); closeModal(); toast(`Blocked @${o.uname}`); } catch (er) { toast(friendlyError(er)); } };
    }
    function report(o) {
      openModal(`<button class="icon-btn close" data-close aria-label="Close">✕</button><form class="park-card" id="pr-f"><h2>Report @${esc(o.uname)}</h2><select id="pr-r"><option>Mean or rude chat</option><option>Inappropriate name or Pal</option><option>Spam</option><option>Something else</option></select><textarea id="pr-t" maxlength="300" placeholder="What happened? (optional)"></textarea><button class="btn">Send report</button></form>`);
      document.getElementById('pr-f').onsubmit = async (e) => { e.preventDefault(); try { await addDoc(collection(db, 'reports'), { reporterId: S.user.uid, targetType: 'user', targetId: o.uid, postId: '', reason: ('Pal Park: ' + document.getElementById('pr-r').value + '. ' + document.getElementById('pr-t').value).slice(0, 500), excerpt: String(o.say || '').slice(0, 300), createdAt: serverTimestamp() }); closeModal(); toast('Thanks. The report was sent.'); } catch (er) { toast(friendlyError(er)); } };
    }
    const panel = main.querySelector('#park-panel');
    const toggle = (k) => { const open = panel.hidden || panel.dataset.k !== k; panel.hidden = !open; panel.dataset.k = k; return open; };
    main.querySelector('#pk-emote').onclick = () => { if (!toggle('e')) return; panel.innerHTML = EMOTES.map((x) => `<button class="pk-e" data-e="${x}">${x}</button>`).join(''); };
    main.querySelector('#pk-chat').onclick = () => { if (!toggle('c')) return;
      const kid = phraseOnly();
      const list = kid ? SAFE_SAY : PHRASES;
      panel.innerHTML = list.map((x) => `<button class="pal-chip" data-say="${esc(x)}">${esc(x)}</button>`).join('') + (kid ? `<p class="small" style="margin:8px 0 0">${esc(PHRASE_NOTE)}</p>${needsBirthday() ? `<button type="button" class="pal-chip" data-type="1">✏️ ${esc(BIRTHDAY_NOTE)}</button>` : ''}` : `<form id="pk-f" class="pk-f"><input id="pk-t" maxlength="40" placeholder="Say something nice…" autocomplete="off"><button class="btn btn-sm">Say</button></form>`);
      const f = panel.querySelector('#pk-f'); if (f) f.onsubmit = (e) => { e.preventDefault(); const v = panel.querySelector('#pk-t').value.trim(); if (!v) return; if (checkInput(v)) { toast('Let’s keep Pal Park friendly and private 💜'); return; } say(clean(v)); panel.hidden = true; }; };
    panel.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.e) { emote(b.dataset.e); panel.hidden = true; } if (b.dataset.say) { say(b.dataset.say); panel.hidden = true; } if (b.dataset.type) { panel.hidden = true; unlockTyping().then((ok) => { if (ok) { toast('You can type now 💜'); main.querySelector('#pk-chat').click(); } }); } });
    let lastSay = 0, sayT = 0, sayNext = ''; function say(t) {
      if (phraseOnly() && !isPhrase(t)) return toast(PHRASE_NOTE);
      const gate = window.kemyChatGate ? window.kemyChatGate(t, 'park', '') : { ok: true, text: t };
      if (!gate.ok) return;
      t = gate.text;
      if (!spamOk('park', t)) return;
      // Lines said within 2 s wait their turn (the newest one wins) instead of being refused.
      sayNext = t; const out = () => { sayT = 0; lastSay = Date.now(); P.say = sayNext.slice(0, 60); P.sayAt = Date.now(); dirty = true; try { send(true); } catch { /* left the park */ } };
      const wait = 2000 - (Date.now() - lastSay); if (wait > 0) { if (!sayT) sayT = setTimeout(out, wait); return; } out();
    }
    function emote(x, tgt = '') { P.e = x; P.eAt = Date.now(); P.tgt = tgt; dirty = true; send(true); }
    let near = null; const actBtn = main.querySelector('#pk-act'); actBtn.onclick = () => act();
    const repBtn = main.querySelector('#pk-rep'), blockBtn = main.querySelector('#pk-block');
    repBtn.onclick = () => { if (!near) return; if (window.kemyModLine && near.say) window.kemyModLine((near.name || 'Someone') + ': ' + near.say); if (window.kemyModReport) window.kemyModReport({ targetType: 'chat message', targetId: near.uid, targetUid: near.uid, name: '@' + (near.uname || 'player'), hideKey: hideKey('park', near.uid, near.say || '') }); else report(near); };
    blockBtn.onclick = async () => { if (!near) return; if (!confirm(`Block @${near.uname}?`)) return; try { await setDoc(doc(db, 'users', S.user.uid, 'blocks', near.uid), { createdAt: serverTimestamp() }); blocked.add(near.uid); others.delete(near.uid); toast(`Blocked @${near.uname}`); } catch (er) { toast(friendlyError(er)); } };
    function act() { if (near) petOther(near); }
    function petOther(o) { emote('🐾', o.uid); o.hearts = 70; toast(`You petted ${(o.pal && o.pal.name) || 'their Pal'}! 💜`); P.happy = 60; }
    // game loop
    const cam = { x: 0, y: 0 }; let t = 0, alive = true, lastFrame = performance.now(), portalCd = 0;
    const loop = (now) => {
      if (!alive) return; if (!document.body.contains(cv)) { cleanup(); return; }
      const dt = Math.min(2, (now - lastFrame) / 16.67); lastFrame = now; t++;
      let vx = 0, vy = 0; if (keys.arrowleft || keys.a) vx--; if (keys.arrowright || keys.d) vx++; if (keys.arrowup || keys.w) vy--; if (keys.arrowdown || keys.s) vy++;
      const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; if (gp) { if (Math.abs(gp.axes[0]) > 0.2) vx += gp.axes[0]; if (Math.abs(gp.axes[1]) > 0.2) vy += gp.axes[1]; if (gp.buttons[0] && gp.buttons[0].pressed && !P.gpA) act(); P.gpA = gp.buttons[0] && gp.buttons[0].pressed; }
      vx += jv.x; vy += jv.y; const m = Math.hypot(vx, vy); const sp = 3.4 * dt;
      P.moving = m > 0.1; if (P.moving) { vx /= Math.max(1, m); vy /= Math.max(1, m); const nx = Math.max(20, Math.min(WORLD.w - 20, P.x + vx * sp)), ny = Math.max(40, Math.min(WORLD.h - 10, P.y + vy * sp)); if (!inWater(nx, P.y)) P.x = nx; if (!inWater(P.x, ny)) P.y = ny; if (Math.abs(vx) > 0.1) P.d = vx > 0 ? 1 : -1; dirty = true; }
      // pal follows
      P.px = P.x; P.py = P.y;
      send(false);
      // others: interpolate to latest target, pal follows
      const nowMs = Date.now(); near = null; let nd = 70;
      for (const [id, o] of others) { if (blocked.has(id) || nowMs - o.at > STALE_MS * 2) { if (nowMs - o.at > STALE_MS * 2) others.delete(id); continue; }
        const k = 0.18 * dt; o.mv = Math.hypot(o.tx - o.x, o.ty - o.y) > 1; o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.px = o.x; o.py = o.y;
        const dd = Math.hypot(o.px - P.x, o.py - P.y); if (dd < nd) { nd = dd; near = o; } }
      actBtn.disabled = !near; if (repBtn) repBtn.disabled = !near; if (blockBtn) blockBtn.disabled = !near;
      // treasures
      for (const it of items) if (!found.has(it.id) && Math.hypot(it.x - P.x, it.y - P.y) < 34) { found.add(it.id); localStorage.setItem(tk, JSON.stringify([...found])); paintFound(); dispatchEvent(new CustomEvent('kemy:coins', { detail: { src: 'park', n: 10, why: 'for a treasure' } })); P.happy = 50; }
      // portals
      if (portalCd > 0) portalCd--; for (const pt of PORTALS) if (Math.hypot(pt.x - P.x, pt.y - P.y) < 40 && !portalCd) { portalCd = 200; if (confirm(`Jump into the ${PORTAL_NAME[pt.g]} portal?`)) { location.hash = '#/games/pals?g=' + pt.g; return; } }
      const z = ZONES.find((q) => P.x >= q.x && P.x < q.x + q.w && P.y >= q.y && P.y < q.y + q.h); main.querySelector('#park-zone').textContent = z ? z.name : '';
      cam.x = Math.max(0, Math.min(WORLD.w - VW, P.x - VW / 2)); cam.y = Math.max(0, Math.min(WORLD.h - VH, P.y - VH / 2));
      draw(); requestAnimationFrame(loop);
    };
    function draw() {
      c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, VW, VH); c.save(); c.translate(-cam.x, -cam.y);
      for (const z of ZONES) { c.fillStyle = z.col; c.fillRect(z.x, z.y, z.w, z.h); }
      // paths + plaza fountain
      c.fillStyle = '#efe2c8'; c.fillRect(1540, 0, 120, WORLD.h); c.fillRect(0, 1140, WORLD.w, 120); c.beginPath(); c.arc(1600, 1200, 230, 0, 7); c.fill();
      c.fillStyle = '#9fd8ff'; c.beginPath(); c.arc(1600, 1200, 70, 0, 7); c.fill(); c.strokeStyle = '#c8b8a0'; c.lineWidth = 8; c.stroke(); c.lineWidth = 1;
      if (!RM()) for (let i = 0; i < 5; i++) drawBubble(c, 1600 + Math.sin(t * 0.03 + i) * 20, 1200 - ((t * 1.2 + i * 30) % 90), 4);
      // water
      for (const w of WATER) { c.fillStyle = '#7cc8f0'; c.beginPath(); c.ellipse(w.x, w.y, w.rx, w.ry, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 6; c.stroke(); c.lineWidth = 1; }
      c.fillStyle = '#5fae6e'; for (const [x, y] of [[420, 300], [560, 380], [480, 420], [650, 280]]) { c.beginPath(); c.ellipse(x, y, 26, 16, 0, 0.3, 6.1); c.lineTo(x, y); c.fill(); }
      // zone decorations (deterministic)
      const R = rng(42); for (let i = 0; i < 120; i++) { const z = ZONES[i % 4]; const x = z.x + R() * z.w, y = z.y + R() * z.h; if (inWater(x, y) || Math.abs(x - 1600) < 90 || Math.abs(y - 1200) < 90) continue; if (x < cam.x - 60 || x > cam.x + VW + 60 || y < cam.y - 60 || y > cam.y + VH + 60) continue;
        if (z.id === 'meadow') { DECOR.plant(c, '#5fae6e', x, y, 1.6); } if (z.id === 'pond') { c.fillStyle = '#ff9ccf'; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.fillStyle = '#5fae6e'; c.fillRect(x - 1, y, 2, 12); }
        if (z.id === 'candy') { c.fillStyle = ['#ff6fae', '#b26bff', '#5aa8ff'][i % 3]; c.beginPath(); c.arc(x, y - 22, 14, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 2, y - 10, 4, 22); }
        if (z.id === 'beach') { c.fillStyle = '#f0c070'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); if (i % 5 === 0) { c.fillStyle = '#ff6f6f'; c.beginPath(); c.moveTo(x, y - 40); c.arc(x, y - 40, 26, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - 1, y - 40, 2, 40); } } }
      for (const z of ZONES) { c.fillStyle = 'rgba(60,30,90,.55)'; c.font = '800 28px Inter, sans-serif'; c.fillText(z.name, z.x + 40, z.y + 60); }
      // portals
      for (const pt of PORTALS) { const g = c.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 34); g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#b26bff'); g.addColorStop(1, 'rgba(178,107,255,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(pt.x, pt.y, 34, 22, 0, 0, 7); c.fill();
        c.strokeStyle = '#ffd34d'; c.lineWidth = 2; c.beginPath(); c.ellipse(pt.x, pt.y, 30 + Math.sin(t * 0.08) * 3, 19, 0, 0, 7); c.stroke(); c.lineWidth = 1; c.fillStyle = '#3a1458'; c.font = '700 12px Inter, sans-serif'; c.textAlign = 'center'; c.fillText(PORTAL_NAME[pt.g], pt.x, pt.y + 38); c.textAlign = 'left'; }
      // treasures
      for (const it of items) { if (found.has(it.id)) continue; const bob = Math.sin(t * 0.08 + it.x) * 3; c.fillStyle = { pearl: '#fff8f0', flower: '#ff6fae', candy: '#ff4f8f', shell: '#ffb3a0' }[it.k]; c.beginPath(); c.arc(it.x, it.y + bob, 9, 0, 7); c.fill(); c.strokeStyle = '#ffd34d'; c.stroke(); c.fillStyle = '#ffd34d'; star(c, it.x + 8, it.y - 10 + bob, 4); c.fill(); }
      // people, sorted by y
      const list = [...[...others.values()].filter((o) => !blocked.has(o.uid)).map((o) => ({ o, y: o.y })), { o: null, y: P.y }].sort((a, b) => a.y - b.y);
      for (const { o } of list) { if (o) person(o.x, o.y, o.px, o.py, o.d, o.mv, o.color, o.name, o.pal, o, false); else person(P.x, P.y, P.px, P.py, P.d, P.moving, S.profile.color || '#8a2be2', 'You', palSnap, P, true); }
      c.restore();
      // minimap
      const mw = 90, mh = 68; c.fillStyle = 'rgba(30,10,60,.45)'; c.fillRect(VW - mw - 8, 8, mw, mh); for (const z of ZONES) { c.fillStyle = z.col; c.fillRect(VW - mw - 8 + z.x / WORLD.w * mw, 8 + z.y / WORLD.h * mh, z.w / WORLD.w * mw, z.h / WORLD.h * mh); }
      c.fillStyle = '#b26bff'; for (const o of others.values()) { c.fillRect(VW - mw - 8 + o.x / WORLD.w * mw - 1.5, 8 + o.y / WORLD.h * mh - 1.5, 3, 3); } c.fillStyle = '#e8434f'; c.fillRect(VW - mw - 8 + P.x / WORLD.w * mw - 2, 8 + P.y / WORLD.h * mh - 2, 4, 4);
    }
    function person(x, y, px, py, d, mv, color, name, ps, st, mine) {
      if (x < cam.x - 80 || x > cam.x + VW + 80 || y < cam.y - 80 || y > cam.y + VH + 80) return;
      // pal
      const happy = (st.happy || st.hearts || st.petted) ? 'happy' : null; if (st.happy) st.happy--; if (st.hearts) st.hearts--; if (st.petted) st.petted--;
      drawDancer(c, px, py, 44, ps || { species: 'kemy' }, { t, mode: happy || (mv ? 'walk' : 'idle'), face: d });
      if (st.hearts || st.petted) { c.fillStyle = '#ff6fae'; heart(c, px, py - 50 - ((t % 40) / 2), 5); c.fill(); }
      // you are your Pal: name tag, bubble and emote ride on the Pal itself (no separate avatar figure)
      x = px; y = py - 30; const b = mv ? Math.abs(Math.sin(t * 0.3)) * 3 : 0;
      c.fillStyle = mine ? '#ffd34d' : '#fff'; c.font = '700 11px Inter, sans-serif'; c.textAlign = 'center'; c.strokeStyle = 'rgba(30,10,60,.6)'; c.lineWidth = 3; c.strokeText(name, x, y - 52 - b); c.fillText(name, x, y - 52 - b); c.lineWidth = 1;
      const nowMs = Date.now();
      const sayHide = st.say && isHidden(hideKey('park', mine ? (S.user && S.user.uid) : (st.uid || ''), st.say));
      if (st.say && !sayHide && nowMs - st.sayAt < 6000) { c.font = '600 12px Inter, sans-serif'; const tw = Math.min(180, c.measureText(st.say).width + 16); c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x - tw / 2, y - 88 - b, tw, 24, 10); c.fill(); c.fillStyle = '#2a1458'; c.fillText(st.say.slice(0, 30), x, y - 71 - b); }
      if (st.e && nowMs - st.eAt < 3000) { c.font = '24px sans-serif'; c.fillText(st.e, x + 22, y - 44 - b - ((nowMs - st.eAt) / 150)); }
      c.textAlign = 'left';
    }
    requestAnimationFrame(loop); cv.focus();
    const bye = () => { deleteDoc(meRef).catch(() => {}); };
    addEventListener('beforeunload', bye); addEventListener('pagehide', bye);
    function cleanup() { if (!alive) return; alive = false; unsub(); bye(); removeEventListener('keydown', kd); removeEventListener('keyup', ku); removeEventListener('resize', size); removeEventListener('beforeunload', bye); removeEventListener('pagehide', bye); }
    stop = cleanup;
  }
  return { page };
}
