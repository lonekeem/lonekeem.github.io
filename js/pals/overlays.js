// Kemy Pals overlays: the host's Pal on live screens, and occasional Pal pop-ups while scrolling videos.
// Pure DOM/canvas overlays: nothing is drawn into the video stream.
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import { drawPal, drawBubble, star, heart } from './art.js';
import { getActivePal, liveStats, moodOf, patPal } from './core.js';
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function canvasEl(w, h) { const cv = document.createElement('canvas'); const d = Math.min(3, devicePixelRatio || 1); cv.width = w * d; cv.height = h * d; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); return { cv, c }; }

// ---------------------------------------------------------------- live overlay
export function liveOverlay({ S, db, toast }, root, { liveId, hostId, isHost }) {
  if (!root || !hostId || hostId === 'studio') return () => {};
  let alive = true, pal = null, hidden = false, el = null, unsub = null, obs = null, obs2 = null;
  const st = { t: 0, react: 0, wave: 0, enter: 0, face: -1, caught: [], fx: [], btn: null };
  (async () => {
    try { pal = await getActivePal(db, hostId); } catch { pal = null; }
    if (!alive || !pal || !document.body.contains(root)) return;
    el = document.createElement('div'); el.className = 'pal-live'; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${pal.name}, the streamer's Pal. Tap to pet.`); el.tabIndex = 0;
    const { cv, c } = canvasEl(96, 96); el.appendChild(cv); root.appendChild(el); st.enter = 1;
    if (isHost) { const b = document.createElement('button'); b.className = 'pal-live-hide'; b.type = 'button'; b.textContent = 'Hide Pal'; root.appendChild(b); b.onclick = (e) => { e.stopPropagation(); setHidden(!hidden); }; st.btn = b; }
    const pos = JSON.parse(localStorage.getItem('kemy-pal-live-pos') || 'null'); if (pos) { el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px'; el.style.right = 'auto'; }
    let drag = null, moved = false, lastPet = 0;
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop }; moved = false; try { el.setPointerCapture(e.pointerId); } catch {} });
    el.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) moved = true; if (!moved) return;
      const r = root.getBoundingClientRect(); el.style.left = Math.max(0, Math.min(r.width - 96, drag.l + dx)) + 'px'; el.style.top = Math.max(50, Math.min(r.height - 170, drag.t + dy)) + 'px'; el.style.right = 'auto'; });
    el.addEventListener('pointerup', (e) => { e.stopPropagation(); if (moved) localStorage.setItem('kemy-pal-live-pos', JSON.stringify({ x: el.offsetLeft, y: el.offsetTop })); else pet(); drag = null; });
    el.addEventListener('click', (e) => e.stopPropagation());
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); } });
    async function pet() {
      if (Date.now() - lastPet < 2500) return; lastPet = Date.now(); st.react = 80;
      for (let i = 0; i < 6; i++) st.fx.push({ x: 48, y: 30, vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random(), life: 50, k: i % 2 ? 'heart' : 'star' });
      if (!isHost && S.user && S.profile) try { if (await patPal(db, hostId, pal.id, S.user.uid)) toast(`You patted ${pal.name}! 🐾`); } catch {}
    }
    obs = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.classList && n.classList.contains('lstar')) { st.react = Math.max(st.react, 50); if (st.caught.length < 6) st.caught.push({ y: 0, x: 20 + Math.random() * 56, life: 40 }); } });
    obs.observe(root, { childList: true, subtree: true });
    const cnt = root.querySelector('#lv-count span'); let lastN = cnt ? parseInt(cnt.textContent, 10) || 0 : 0;
    if (cnt) { obs2 = new MutationObserver(() => { const n = parseInt(cnt.textContent, 10) || 0; if (n > lastN) st.wave = 90; lastN = n; }); obs2.observe(cnt, { childList: true, characterData: true, subtree: true }); }
    if (liveId) unsub = onSnapshot(doc(db, 'lives', liveId), (d) => { if (d.exists()) applyHidden(!!d.data().palHidden); }, () => {});
    const mood = moodOf(liveStats(pal));
    const frame = () => {
      if (!alive || !document.body.contains(el)) { cleanup(); return; }
      st.t++; c.clearRect(0, 0, 96, 96);
      if (st.enter < 40) st.enter++; const e = RM() ? 40 : st.enter; const bounce = Math.min(1, e / 22) * (1 + Math.sin(Math.min(e, 40) / 40 * Math.PI) * 0.15);
      let mode = 'idle'; if (st.react > 0) { st.react--; mode = 'react'; } else if (st.wave > 0) { st.wave--; mode = 'happy'; }
      c.save(); c.translate(48, 92); c.scale(bounce, bounce); c.translate(-48, -92);
      drawPal(c, 48, 90, 70, pal, { t: st.t, mode, face: st.face, mood });
      if (st.wave > 0) { c.font = '14px sans-serif'; c.fillText('👋', 70, 30); }
      c.restore();
      for (const s of st.caught) { s.y += 2.4; s.life--; c.fillStyle = '#ffd34d'; star(c, s.x, s.y, 4); c.fill(); }
      st.caught = st.caught.filter((s) => s.life > 0 && s.y < 52);
      for (const p of st.fx) { p.x += p.vx; p.y += p.vy; p.life--; c.globalAlpha = p.life / 50; c.fillStyle = p.k === 'heart' ? '#ff6fae' : '#ffd34d'; if (p.k === 'heart') heart(c, p.x, p.y, 4); else star(c, p.x, p.y, 4); c.fill(); }
      c.globalAlpha = 1; st.fx = st.fx.filter((p) => p.life > 0);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  })();
  function applyHidden(h) { hidden = h; if (el) el.hidden = h; if (st.btn) st.btn.textContent = h ? 'Show Pal' : 'Hide Pal'; if (!h) st.enter = 1; }
  async function setHidden(h) { applyHidden(h); try { await updateDoc(doc(db, 'lives', liveId), { palHidden: h, heartbeatAt: serverTimestamp() }); } catch { toast && toast('Hidden on your screen'); } }
  function cleanup() { alive = false; if (obs) obs.disconnect(); if (obs2) obs2.disconnect(); if (unsub) unsub(); }
  return cleanup;
}

// ---------------------------------------------------------------- scroll pop-ups
const LINES = { hungry: ['Feed me! 🍓', 'Snack time?', 'My tummy rumbled!'], dirty: ['Bath time? 🫧', 'I rolled in mud…'], tired: ['So sleepy…', 'Nap soon? 🌙'], sad: ['I miss you!', 'Play with me?'], ok: ['Hi hi! 👋', 'Ooh, nice video!', 'Wheee!', 'You’re the best!', 'Peekaboo!', '✨ So cool!'] };
// any screen where you scroll through videos: For You, Following, Explore, Movies/Songs, profiles, stories
export const POP_ROUTES = /^(#?$|#\/(watch|feed|explore|search|works|movies|songs|stories|story|post\/))/; // never on profiles (#/u/, #/me): the profile Pal is already there
export function popups({ S, db }) {
  const KEY = 'kemy-pals-popups', LAST = 'kemy-pals-pop-last';
  let pal = null, shown = false, scrolled = 0, loaded = 0;
  const enabled = () => localStorage.getItem(KEY) !== 'off';
  async function ensure() { if (!S.user || !S.profile) return null; if (pal && Date.now() - loaded < 300000) return pal; try { pal = await getActivePal(db, S.user.uid); loaded = Date.now(); } catch { pal = null; } return pal; }
  const onScroll = () => {
    if (shown || !enabled() || !POP_ROUTES.test(location.hash || '')) return;
    if (++scrolled < 25) return;
    if (Date.now() - +(localStorage.getItem(LAST) || 0) < 4 * 60000) return;
    if (Math.random() > 0.06) return;
    scrolled = 0; show();
  };
  document.addEventListener('scroll', onScroll, { capture: true, passive: true });
  document.addEventListener('wheel', onScroll, { passive: true }); document.addEventListener('touchmove', onScroll, { passive: true });
  addEventListener('hashchange', () => { if (!POP_ROUTES.test(location.hash || '')) document.querySelectorAll('.pal-pop').forEach((e) => { e.remove(); shown = false; }); });
  async function show(force) {
    const p = await ensure(); if ((!force && !POP_ROUTES.test(location.hash || '')) || document.querySelector('.pal-strip, .pal-pop') || document.activeElement?.matches?.('input, textarea, [contenteditable]')) return; if (!p || shown || (!force && !enabled())) return; shown = true; localStorage.setItem(LAST, String(Date.now()));
    const mood = moodOf(liveStats(p)); const key = mood.hungry ? 'hungry' : mood.dirty ? 'dirty' : mood.tired ? 'tired' : mood.sad ? 'sad' : 'ok';
    const line = LINES[key][Math.floor(Math.random() * LINES[key].length)]; const side = Math.random() < 0.5 ? 'left' : 'right';
    const el = document.createElement('div'); el.className = `pal-pop ${side}${RM() ? ' rm' : ''}`; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${p.name} says: ${line}. Tap to say bye.`); el.tabIndex = 0;
    const say = document.createElement('span'); say.className = 'pal-pop-say'; say.textContent = line; el.appendChild(say);
    const { cv, c } = canvasEl(90, 90); el.appendChild(cv); document.body.appendChild(el);
    let t = 0, poof = 0, on = true; const face = side === 'left' ? 1 : -1;
    const f = () => { if (!on || !el.isConnected) return; t++; c.clearRect(0, 0, 90, 90);
      if (poof) { poof++; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; drawBubble(c, 45 + Math.cos(a) * poof * 1.4, 50 + Math.sin(a) * poof * 1.4, Math.max(1, 6 - poof * 0.2)); } if (poof > 24) { on = false; el.remove(); shown = false; } }
      else drawPal(c, 45, 86, 68, p, { t, face, mode: t < 90 && !RM() ? 'happy' : 'idle', mood });
      requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const bye = (e) => { if (e) { e.stopPropagation(); e.preventDefault(); } if (poof) return; poof = 1; el.classList.add('poof'); };
    el.addEventListener('click', bye); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') bye(e); });
    setTimeout(() => { if (on && !poof) { el.classList.add('out'); setTimeout(() => { on = false; el.remove(); shown = false; }, 600); } }, 7000);
  }
  return { show, enabled, set(v) { localStorage.setItem(KEY, v ? 'on' : 'off'); } };
}
